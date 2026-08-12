<?php
function getBackupSnapshotPath(string $type, string $name): string {
        $type = ensureType($type);
        $safeName = basename($name);
        if ($safeName !== $name || !preg_match('/^' . preg_quote($type, '/') . '-.*\.json$/', $safeName)) {
            throw new RuntimeException('Invalid backup file name.');
        }
        return getBackupsDirPath() . "/$safeName";
    }

    function pruneBackupSnapshots(string $type, int $keep = 25): array {
        $type = ensureType($type);
        $keep = max(1, $keep);
        $snapshots = listBackupSnapshots($type);
        $removed = [];
        if (count($snapshots) <= $keep) {
            return $removed;
        }
        $toRemove = array_slice($snapshots, $keep);
        foreach ($toRemove as $snapshot) {
            try {
                $path = getBackupSnapshotPath($type, (string)$snapshot['name']);
                if (file_exists($path)) {
                    @unlink($path);
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
            || strpos($normalized, 'transaction-') === 0
            || strpos($normalized, 'rollback') !== false;
    }

    function getBackupPayloadFolderCount($decoded): ?int {
        if (!is_array($decoded)) {
            return null;
        }
        if (isset($decoded['folders']) && is_array($decoded['folders'])) {
            return count($decoded['folders']);
        }
        if (!array_key_exists('schemaVersion', $decoded) && !array_key_exists('type', $decoded) && !array_key_exists('prefs', $decoded)) {
            return count($decoded);
        }
        return null;
    }

    function createBackupSnapshot(string $type, string $reason = 'manual'): array {
        $type = ensureType($type);
        $folders = readRawFolderMap($type);
        $folderCount = count($folders);
        if ($folderCount === 0 && !backupReasonAllowsEmptySnapshot($reason)) {
            try {
                appendDiagnosticsHistoryEvent('backup_skipped', $type, [
                    'reason' => $reason,
                    'folderCount' => 0,
                    'skipReason' => 'empty-folder-map'
                ], 'ok', 'server');
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
        $filename = sprintf('%s-%s-%s.json', $type, gmdate('Ymd-His'), $slugReason);
        $payload = [
            'schemaVersion' => FVPLUS_EXPORT_SCHEMA_VERSION,
            'pluginVersion' => readInstalledVersion(),
            'exportedAt' => gmdate('c'),
            'type' => $type,
            'mode' => 'full',
            'reason' => $reason,
            'traceId' => getRequestTraceId(),
            'transactionId' => getRequestTransactionId(),
            'configurationMetadata' => readConfigMetadata($type, true),
            'folders' => $folders,
            'prefs' => $prefs
        ];
        writeJsonObjectAtomic("$backupDir/$filename", $payload);
        $pruned = pruneBackupSnapshots($type, getTypeBackupRetention($type));
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
    }

    function findRecentPrefsBackupSnapshot(string $type, int $windowSeconds): ?array {
        $type = ensureType($type);
        $backupDir = getBackupsDirPath();
        if ($windowSeconds <= 0 || !is_dir($backupDir)) {
            return null;
        }
        $latestPath = '';
        $latestMtime = 0;
        foreach ((array)@scandir($backupDir) as $file) {
            if (!is_string($file) || !preg_match('/^' . preg_quote($type, '/') . '-.*-before-prefs-update\.json$/', $file)) {
                continue;
            }
            $path = "$backupDir/$file";
            $mtime = is_file($path) ? (int)@filemtime($path) : 0;
            if ($mtime > $latestMtime) {
                $latestMtime = $mtime;
                $latestPath = $path;
            }
        }
        if ($latestPath === '' || max(0, time() - $latestMtime) > $windowSeconds) {
            return null;
        }
        $decoded = @json_decode((string)@file_get_contents($latestPath), true);
        return [
            'name' => basename($latestPath),
            'createdAt' => gmdate('c', $latestMtime),
            'size' => (int)@filesize($latestPath),
            'reason' => 'before-prefs-update',
            'count' => getBackupPayloadFolderCount($decoded),
            'traceId' => is_array($decoded) ? normalizeRequestTraceId((string)($decoded['traceId'] ?? '')) : '',
            'transactionId' => is_array($decoded) ? normalizeRequestTransactionId((string)($decoded['transactionId'] ?? '')) : ''
        ];
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

    function listBackupSnapshots(string $type): array {
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
            $decoded = @json_decode((string)@file_get_contents($path), true);
            $reason = '';
            $count = null;
            $traceId = '';
            $transactionId = '';
            if (is_array($decoded)) {
                $reason = (string)($decoded['reason'] ?? '');
                $count = getBackupPayloadFolderCount($decoded);
                $traceId = normalizeRequestTraceId((string)($decoded['traceId'] ?? ''));
                $transactionId = normalizeRequestTransactionId((string)($decoded['transactionId'] ?? ''));
            }
            $entries[] = [
                'name' => $file,
                'createdAt' => gmdate('c', (int)@filemtime($path)),
                'size' => (int)@filesize($path),
                'reason' => $reason,
                'count' => $count,
                'traceId' => $traceId,
                'transactionId' => $transactionId
            ];
        }
        usort($entries, function($a, $b) {
            return strcmp($b['createdAt'], $a['createdAt']);
        });
        return $entries;
    }

    function readBackupSnapshot(string $type, string $name): array {
        $type = ensureType($type);
        $path = getBackupSnapshotPath($type, $name);
        $safeName = basename($path);
        if (!file_exists($path)) {
            throw new RuntimeException('Backup file not found.');
        }

        $raw = (string)@file_get_contents($path);
        $decoded = @json_decode($raw, true);
        if (!is_array($decoded)) {
            throw new RuntimeException('Backup payload is not valid JSON.');
        }
        validateBackupPayloadType($decoded, $type);
        $folders = normalizeImportedFoldersPayload($decoded);
        if (!is_array($folders)) {
            $folders = [];
        }
        $prefs = is_array($decoded['prefs'] ?? null) ? normalizeTypePrefs($decoded['prefs']) : null;

        return [
            'name' => $safeName,
            'createdAt' => gmdate('c', (int)@filemtime($path)),
            'reason' => (string)($decoded['reason'] ?? ''),
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
            'folders' => $folders
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

    function normalizeImportedFoldersPayload($decoded): array {
        if (!is_array($decoded)) {
            throw new RuntimeException('Backup payload is not a JSON object.');
        }
        if (array_key_exists('folders', $decoded) && is_array($decoded['folders'])) {
            return $decoded['folders'];
        }
        return $decoded;
    }

    function validateBackupPayloadType(array $decoded, string $type): void {
        $type = ensureType($type);
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

    function restoreBackupSnapshot(string $type, string $name): array {
        $type = ensureType($type);
        $path = getBackupSnapshotPath($type, $name);
        $safeName = basename($path);
        if (!file_exists($path)) {
            throw new RuntimeException('Backup file not found.');
        }
        $decoded = @json_decode((string)@file_get_contents($path), true);
        if (is_array($decoded)) {
            validateBackupPayloadType($decoded, $type);
        }
        $folders = normalizeImportedFoldersPayload($decoded);
        writeRawFolderMap($type, is_array($folders) ? $folders : []);
        syncManualOrderWithFolders($type, is_array($folders) ? $folders : []);
        if ($type === 'docker') {
            syncContainerOrder('docker');
        }
        try {
            appendDiagnosticsHistoryEvent('backup_restore', $type, [
                'name' => $safeName,
                'folderCount' => count(is_array($folders) ? $folders : [])
            ], 'ok', 'server');
        } catch (Throwable $err) {
            // Non-fatal.
        }
        return [
            'name' => $safeName,
            'restoredAt' => gmdate('c'),
            'count' => count(is_array($folders) ? $folders : [])
        ];
    }

    function restoreLatestBackupSnapshot(string $type): array {
        $snapshots = listBackupSnapshots($type);
        if (empty($snapshots)) {
            throw new RuntimeException('No backups available.');
        }
        foreach ($snapshots as $snapshot) {
            $count = $snapshot['count'] ?? null;
            if ($count !== null && (int)$count <= 0) {
                continue;
            }
            return restoreBackupSnapshot($type, (string)$snapshot['name']);
        }
        throw new RuntimeException('No non-empty backups available.');
    }

    function isUndoBackupReason(string $reason): bool {
        $normalized = strtolower(trim($reason));
        if ($normalized === '') {
            return false;
        }
        return strpos($normalized, 'before-') === 0
            || strpos($normalized, 'pre-') === 0
            || strpos($normalized, 'undo-') === 0
            || strpos($normalized, 'transaction-') === 0;
    }

    function restoreLatestUndoBackupSnapshot(string $type): array {
        $type = ensureType($type);
        $snapshots = listBackupSnapshots($type);
        foreach ($snapshots as $snapshot) {
            $reason = (string)($snapshot['reason'] ?? '');
            if (!isUndoBackupReason($reason)) {
                continue;
            }
            return restoreBackupSnapshot($type, (string)$snapshot['name']);
        }
        throw new RuntimeException('No undo-capable backups found.');
    }
