<?php
function getBackupSnapshotPath(string $type, string $name): string {
        $type = ensureType($type);
        $safeName = basename($name);
        if ($safeName !== $name || !preg_match('/^' . preg_quote($type, '/') . '-.*\.json$/', $safeName)) {
            throw new RuntimeException('Invalid backup file name.');
        }
        return getBackupsDirPath() . "/$safeName";
    }

    function pruneBackupSnapshots(string $type, int $keep = 25, array $protectedNames = []): array {
        $type = ensureType($type);
        $keep = max(1, $keep);
        $snapshots = listBackupSnapshots($type);
        $removed = [];
        if (count($snapshots) <= $keep) {
            return $removed;
        }
        $protected = array_filter($snapshots, static fn($entry): bool => in_array($entry['name'], $protectedNames, true));
        $unprotected = array_values(array_filter($snapshots, static fn($entry): bool => !in_array($entry['name'], $protectedNames, true)));
        // Preserve time order within each group while giving usable backups the retained slots.
        usort($unprotected, static fn(array $a, array $b): int => isset($b['count']) <=> isset($a['count']));
        $toRemove = array_slice($unprotected, max(0, $keep - count($protected)));
        foreach ($toRemove as $snapshot) {
            try {
                $path = getBackupSnapshotPath($type, (string)$snapshot['name']);
                if (file_exists($path) && @unlink($path)) {
                    $removed[] = (string)$snapshot['name'];
                }
            } catch (Throwable $err) {
                continue;
            }
        }
        return $removed;
    }

    function backupReasonAllowsEmptySnapshot(string $reason): bool {
        $normalized = strtolower(trim($reason));
        if ($normalized === '') {
            return false;
        }
        return strpos($normalized, 'before-import') === 0
            || strpos($normalized, 'before-restore') === 0
            || strpos($normalized, 'before-template') === 0
            || $normalized === 'before-repair-missing-custom-icons'
            || strpos($normalized, 'transaction-') === 0
            || strpos($normalized, 'rollback') !== false;
    }

    function createFolderBatchSafetyBackup(string $type, string $reason, array $before, array $after, bool $preserveHierarchy): ?array {
        $backup = $reason !== '' && jsonObjectsDiffer($before, $after)
            ? createBackupSnapshot($type, $reason, false, ['preserveHierarchy' => $preserveHierarchy]) : null;
        if ($preserveHierarchy && empty($backup['name'])) {
            throw new RuntimeException('A pre-repair backup could not be verified, so no folder links were changed.');
        }
        return $backup;
    }

    function getBackupPayloadFolderCount(array $decoded, string $type): ?int {
        try {
            fvplusBackupTemplateRecords($decoded);
            return count(normalizeImportedFoldersPayload($decoded, $type));
        } catch (RuntimeException $error) {
            // Keep malformed backups visible for inspection and deletion.
            return null;
        }
    }

    function createBackupSnapshot(string $type, string $reason = 'manual', bool $prune = true, array $options = []): array {
        return withConfigMutationLock(static function () use ($type, $reason, $prune, $options): array {
            $type = ensureType($type);
            $preserveHierarchy = ($options['preserveHierarchy'] ?? false) === true;
            $folders = $preserveHierarchy
                ? readFolderMapForTreeIntegrity($type)
                : readRawFolderMap($type, false, true);
            $preserveHierarchy = $preserveHierarchy || normalizeFolderParentLinks($folders) !== $folders;
            $folderCount = count($folders);
            if ($folderCount === 0 && !backupReasonAllowsEmptySnapshot($reason)) {
                try {
                    appendDiagnosticsHistoryEvent('backup_skipped', $type, [
                        'reason' => $reason,
                        'folderCount' => 0,
                        'skipReason' => 'empty-folder-map'
                    ], 'skipped', 'server');
                } catch (Throwable $err) {
                    // Keep backup skip reporting non-fatal.
                }
                return [
                    'name' => '',
                    'createdAt' => gmdate('c'),
                    'count' => 0,
                    'traceId' => getRequestTraceId(),
                    'transactionId' => getRequestTransactionId(),
                    'pruned' => [],
                    'skipped' => true,
                    'skipReason' => 'empty-folder-map'
                ];
            }
            $prefs = readTypePrefs($type);
            $backupDir = getBackupsDirPath();
            if (!is_dir($backupDir)) {
                @mkdir($backupDir, 0770, true);
            }
            $slugReason = trim((string)preg_replace('/[^a-zA-Z0-9_-]+/', '-', strtolower($reason)), '-');
            if ($slugReason === '') {
                $slugReason = 'manual';
            }
            $baseName = sprintf('%s-%s-%s', $type, gmdate('Ymd-His'), $slugReason);
            $filename = $baseName . '.json';
            for ($suffix = 1; file_exists("$backupDir/$filename") || is_link("$backupDir/$filename"); $suffix++) {
                $filename = $baseName . '-' . $suffix . '.json';
            }
            $payload = [
                'schemaVersion' => FVPLUS_EXPORT_SCHEMA_VERSION,
                'pluginVersion' => readInstalledVersion(),
                'exportedAt' => gmdate('c'),
                'createdAt' => (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.uP'),
                'type' => $type,
                'mode' => 'full',
                'reason' => $reason,
                'traceId' => getRequestTraceId(),
                'transactionId' => getRequestTransactionId(),
                'configurationMetadata' => readConfigMetadata($type, true),
                'folders' => $folders,
                'prefs' => $prefs
            ];
            if ($preserveHierarchy) $payload['preserveHierarchy'] = true;
            if (isset($options['templateRecords'])) $payload['templates'] = $options['templateRecords'];
            writeJsonObjectAtomic("$backupDir/$filename", fvplusJsonTypeConfig($payload));
            $pruned = $prune ? pruneBackupSnapshots($type, getTypeBackupRetention($type), [$filename]) : [];
            try {
                appendDiagnosticsHistoryEvent('backup_create', $type, [
                    'reason' => $reason,
                    'name' => $filename,
                    'folderCount' => $folderCount,
                    'prunedCount' => count($pruned)
                ], 'ok', 'server');
            } catch (Throwable $err) {
                // Keep backup creation non-fatal.
            }
            return [
                'name' => $filename,
                'createdAt' => gmdate('c'),
                'count' => $folderCount,
                'traceId' => getRequestTraceId(),
                'transactionId' => getRequestTransactionId(),
                'pruned' => $pruned,
                'skipped' => false
            ];
        });
    }

    function findRecentPrefsBackupSnapshot(string $type, int $windowSeconds): ?array {
        $type = ensureType($type);
        $backupDir = getBackupsDirPath();
        if ($windowSeconds <= 0 || !is_dir($backupDir)) {
            return null;
        }
        foreach (listBackupSnapshots($type) as $snapshot) {
            if (!preg_match('/^' . preg_quote($type, '/') . '-.*-before-prefs-update(?:-[0-9]+)?\.json$/', $snapshot['name'])) {
                continue;
            }
            $mtime = strtotime($snapshot['createdAt']) ?: 0;
            if (max(0, time() - $mtime) > $windowSeconds) return null;
            $snapshot['reason'] = 'before-prefs-update';
            return $snapshot;
        }
        return null;
    }

    function createCoalescedPrefsBackupSnapshot(string $type, int $windowSeconds = 30): array {
        $type = ensureType($type);
        $windowSeconds = max(0, min(120, $windowSeconds));
        $recent = findRecentPrefsBackupSnapshot($type, $windowSeconds);
        if (is_array($recent)) {
            return [
                ...$recent,
                'pruned' => [],
                'skipped' => false,
                'coalesced' => true
            ];
        }
        return [
            ...createBackupSnapshot($type, 'before-prefs-update'),
            'coalesced' => false
        ];
    }

    function listBackupSnapshots(string $type, bool $includeReviewHash = false): array {
        $type = ensureType($type);
        $backupDir = getBackupsDirPath();
        if (!is_dir($backupDir)) {
            return [];
        }
        $entries = [];
        foreach ((array)@scandir($backupDir) as $file) {
            if (!is_string($file) || $file === '.' || $file === '..') {
                continue;
            }
            if (!preg_match('/^' . preg_quote($type, '/') . '-.*\.json$/', $file)) {
                continue;
            }
            $path = "$backupDir/$file";
            if (!is_file($path)) {
                continue;
            }
            $raw = (string)@file_get_contents($path);
            $decoded = @json_decode($raw, true);
            $reason = '';
            $count = null;
            $traceId = '';
            $transactionId = '';
            if (is_array($decoded)) {
                $reason = (string)($decoded['reason'] ?? '');
                $count = getBackupPayloadFolderCount($decoded, $type);
                $traceId = normalizeRequestTraceId((string)($decoded['traceId'] ?? ''));
                $transactionId = normalizeRequestTransactionId((string)($decoded['transactionId'] ?? ''));
            }
            $created = gmdate('Y-m-d\TH:i:s', (int)@filemtime($path)) . '.000000+00:00';
            if (is_string($decoded['createdAt'] ?? null) && preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}\+00:00$/D', $decoded['createdAt'])) {
                $created = $decoded['createdAt'];
            }
            $entries[] = [
                '_sortCreated' => $created,
                'name' => $file,
                'createdAt' => gmdate('c', (int)@filemtime($path)),
                'size' => (int)@filesize($path),
                'reason' => $reason,
                'count' => $count,
                'traceId' => $traceId,
                'transactionId' => $transactionId,
                ...($includeReviewHash && $count !== null ? ['reviewHash' => hash('sha256', $raw)] : [])
            ];
        }
        usort($entries, function($a, $b) {
            return strcmp($b['_sortCreated'], $a['_sortCreated']) ?: strnatcmp($b['name'], $a['name']);
        });
        foreach ($entries as &$entry) unset($entry['_sortCreated']);
        unset($entry);
        return $entries;
    }

    function readBackupSnapshot(string $type, string $name, ?string $reviewHash = null): array {
        $type = ensureType($type);
        $path = getBackupSnapshotPath($type, $name);
        $safeName = basename($path);
        $raw = @file_get_contents($path);
        if ($reviewHash !== null && ($raw === false || !hash_equals(hash('sha256', $raw), $reviewHash))) {
            throw new FVPlusConfigConflictException('The selected backup changed. Refresh and try again.');
        }
        if ($raw === false) {
            throw new RuntimeException('Backup file not found.');
        }

        $decoded = @json_decode($raw, true);
        if (!is_array($decoded)) {
            throw new RuntimeException('Backup payload is not valid JSON.');
        }
        $folders = normalizeImportedFoldersPayload($decoded, $type);
        $prefs = is_array($decoded['prefs'] ?? null) ? normalizeTypePrefs($decoded['prefs']) : null;
        $templates = fvplusBackupTemplateRecords($decoded);
        $reason = (string)($decoded['reason'] ?? '');
        $preserveHierarchy = ($decoded['preserveHierarchy'] ?? false) === true
            && ($decoded['schemaVersion'] ?? null) === FVPLUS_EXPORT_SCHEMA_VERSION
            && ($decoded['mode'] ?? null) === 'full';

        return [
            'name' => $safeName,
            'createdAt' => gmdate('c', (int)@filemtime($path)),
            'reason' => $reason,
            'schemaVersion' => array_key_exists('schemaVersion', $decoded) ? $decoded['schemaVersion'] : null,
            'pluginVersion' => (string)($decoded['pluginVersion'] ?? ''),
            'exportedAt' => (string)($decoded['exportedAt'] ?? ''),
            'traceId' => normalizeRequestTraceId((string)($decoded['traceId'] ?? '')),
            'transactionId' => normalizeRequestTransactionId((string)($decoded['transactionId'] ?? '')),
            'count' => count($folders),
            'configurationMetadata' => is_array($decoded['configurationMetadata'] ?? null)
                ? normalizeConfigMetadata($decoded['configurationMetadata'], $type)
                : null,
            'prefs' => $prefs,
            'folders' => $folders,
            ...($preserveHierarchy ? ['preserveHierarchy' => true] : []),
            ...($templates === null ? [] : ['templates' => $templates])
        ];
    }

    function deleteBackupSnapshot(string $type, string $name): array {
        $path = getBackupSnapshotPath($type, $name);
        if (!file_exists($path)) {
            throw new RuntimeException('Backup file not found.');
        }
        if (!@unlink($path)) {
            throw new RuntimeException('Failed to delete backup file.');
        }
        try {
            appendDiagnosticsHistoryEvent('backup_delete', $type, [
                'name' => basename($path)
            ], 'ok', 'server');
        } catch (Throwable $err) {
            // Non-fatal.
        }
        return [
            'name' => basename($path),
            'deletedAt' => gmdate('c')
        ];
    }

    function deleteAllBackupSnapshots(string $type): array {
        $type = ensureType($type);
        $snapshots = listBackupSnapshots($type);
        $deleted = [];
        $failed = [];
        foreach ($snapshots as $snapshot) {
            $name = (string)($snapshot['name'] ?? '');
            if ($name === '') {
                continue;
            }
            try {
                $deleted[] = deleteBackupSnapshot($type, $name);
            } catch (Throwable $err) {
                $failed[] = [
                    'name' => $name,
                    'error' => $err->getMessage()
                ];
            }
        }
        try {
            appendDiagnosticsHistoryEvent('backup_delete_all', $type, [
                'deletedCount' => count($deleted),
                'failedCount' => count($failed)
            ], empty($failed) ? 'ok' : 'warning', 'server');
        } catch (Throwable $err) {
            // Non-fatal.
        }
        return [
            'deletedCount' => count($deleted),
            'failedCount' => count($failed),
            'deleted' => $deleted,
            'failed' => $failed,
            'deletedAt' => gmdate('c')
        ];
    }

    function normalizeImportedFoldersPayload(array $decoded, string $type): array {
        validateBackupPayloadType($decoded, $type);
        $folders = $decoded['folders'] ?? $decoded;
        if (!is_array($folders) || (!isset($decoded['folders']) && (array_key_exists('folders', $decoded)
            || array_key_exists('schemaVersion', $decoded) || array_key_exists('prefs', $decoded)))) {
            throw new RuntimeException('Backup payload is not a JSON object.');
        }
        if (array_key_exists('prefs', $decoded) && !is_array($decoded['prefs'])) {
            throw new RuntimeException('Invalid prefs payload: expected JSON object.');
        }
        fvplusAssertSnapshotFolderMap($folders, 'Backup contains invalid folder data.', 'Backup contains invalid folder membership data.');
        return $folders;
    }

    function validateBackupPayloadType(array $decoded, string $type): void {
        $type = ensureType($type);
        if (array_key_exists('schemaVersion', $decoded) && $decoded['schemaVersion'] !== FVPLUS_EXPORT_SCHEMA_VERSION) {
            throw new RuntimeException('Backup schema version is unsupported.');
        }
        if (isset($decoded['type']) && !is_string($decoded['type'])) {
            throw new RuntimeException('Backup payload has an invalid type.');
        }
        $declaredRaw = strtolower(trim((string)($decoded['type'] ?? '')));
        if ($declaredRaw !== '' && !in_array($declaredRaw, FVPLUS_ALLOWED_TYPES, true)) {
            throw new RuntimeException('Backup payload has an invalid type.');
        }
        if ($declaredRaw !== '' && $declaredRaw !== $type) {
            throw new RuntimeException("Backup type \"$declaredRaw\" does not match \"$type\".");
        }
        if (array_key_exists('schemaVersion', $decoded) && $declaredRaw === '') {
            throw new RuntimeException('Backup payload is missing a required type marker.');
        }
    }

    function fvplusBackupTemplateRecords(array $payload): ?array {
        if (!array_key_exists('templates', $payload)) return null;
        $templates = $payload['templates'];
        if (!is_array($templates) || count(array_filter($templates, 'is_array')) !== count($templates)) {
            throw new RuntimeException('Unable to load saved templates.');
        }
        return $templates;
    }

    function fvplusWriteBackupTemplateRecords(string $type, array $templates): void {
        $path = getTemplatePath($type);
        writeJsonObjectWithLastGood($path, $templates);
        if ($templates !== readFolderTemplateFile($path) || $templates !== readFolderTemplateFile(getLastGoodJsonPath($path))) {
            throw new FVPlusStorageException('Unable to load saved templates.');
        }
    }

    function fvplusRestoreSafetyBackupMatchesCurrent(string $type, array $safety): bool {
        $preserveHierarchy = ($safety['preserveHierarchy'] ?? false) === true;
        $folders = normalizeFolderMapPayload($safety['folders'], !$preserveHierarchy);
        $currentFolders = $preserveHierarchy ? readFolderMapForTreeIntegrity($type) : readRawFolderMap($type);
        $prefs = readTypePrefs($type);
        return !jsonObjectsDiffer($folders, $currentFolders)
            && !jsonObjectsDiffer(reconcileManualOrderPrefs($safety['prefs'] ?? $prefs, $folders), $prefs)
            && (!isset($safety['templates']) || !jsonObjectsDiffer($safety['templates'],
                readFolderTemplates($type, requireAvailable: true, normalize: false)));
    }

    require_once __DIR__ . '/lib.backup-restore.php';
