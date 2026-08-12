<?php
function getTypeBackupSchedule(string $type): array {
        $type = ensureType($type);
        $prefs = readTypePrefs($type);
        $schedule = is_array($prefs['backupSchedule'] ?? null) ? $prefs['backupSchedule'] : [];
        return [
            'enabled' => normalizeBool($schedule['enabled'] ?? false, false),
            'intervalHours' => normalizeIntInRange($schedule['intervalHours'] ?? 24, 1, 168, 24),
            'retention' => normalizeIntInRange($schedule['retention'] ?? 25, 1, 200, 25),
            'lastRunAt' => is_string($schedule['lastRunAt'] ?? null) ? (string)$schedule['lastRunAt'] : ''
        ];
    }

    function getTypeBackupRetention(string $type): int {
        $schedule = getTypeBackupSchedule($type);
        return normalizeIntInRange($schedule['retention'] ?? 25, 1, 200, 25);
    }

    function maybeRunScheduledBackup(string $type): void {
        static $running = [];
        $type = ensureType($type);
        if (isset($running[$type])) {
            return;
        }

        $running[$type] = true;
        try {
            $schedule = getTypeBackupSchedule($type);
            if (($schedule['enabled'] ?? false) !== true) {
                return;
            }
            $intervalHours = normalizeIntInRange($schedule['intervalHours'] ?? 24, 1, 168, 24);
            $now = time();
            $lastRun = 0;
            if (!empty($schedule['lastRunAt'])) {
                $parsed = strtotime((string)$schedule['lastRunAt']);
                if (is_int($parsed) || is_float($parsed)) {
                    $lastRun = (int)$parsed;
                }
            }
            $intervalSeconds = $intervalHours * 3600;
            if ($lastRun > 0 && ($now - $lastRun) < $intervalSeconds) {
                return;
            }

            createBackupSnapshot($type, 'scheduled');
            $prefs = readTypePrefs($type);
            $nextSchedule = is_array($prefs['backupSchedule'] ?? null) ? $prefs['backupSchedule'] : [];
            $nextSchedule['enabled'] = true;
            $nextSchedule['intervalHours'] = $intervalHours;
            $nextSchedule['retention'] = normalizeIntInRange($schedule['retention'] ?? 25, 1, 200, 25);
            $nextSchedule['lastRunAt'] = gmdate('c', $now);
            $prefs['backupSchedule'] = $nextSchedule;
            writeTypePrefs($type, $prefs);
            try {
                appendDiagnosticsHistoryEvent('backup_schedule_run', $type, [
                    'intervalHours' => $intervalHours,
                    'retention' => $nextSchedule['retention']
                ], 'ok', 'server');
            } catch (Throwable $err) {
                // Non-fatal.
            }
        } finally {
            unset($running[$type]);
        }
    }

    function runScheduledBackups(?string $type = null): array {
        $results = [];
        if ($type !== null && $type !== '') {
            $resolvedType = ensureType($type);
            maybeRunScheduledBackup($resolvedType);
            $results[$resolvedType] = getTypeBackupSchedule($resolvedType);
            return $results;
        }
        foreach (FVPLUS_ALLOWED_TYPES as $resolvedType) {
            maybeRunScheduledBackup($resolvedType);
            $results[$resolvedType] = getTypeBackupSchedule($resolvedType);
        }
        return $results;
    }

    function getBackupsDirPath(): string {
        global $configDir;
        return "$configDir/backups";
    }

    function getGlobalRollbackDirPath(): string {
        global $configDir;
        return "$configDir/rollback";
    }

    function getGlobalRollbackSnapshotPath(string $name): string {
        $safeName = basename($name);
        if ($safeName !== $name || !preg_match('/^global-[0-9]{8}-[0-9]{6}-[a-z0-9_-]+\.json$/', $safeName)) {
            throw new RuntimeException('Invalid rollback snapshot file name.');
        }
        return getGlobalRollbackDirPath() . "/$safeName";
    }

    function listGlobalRollbackSnapshots(): array {
        $rollbackDir = getGlobalRollbackDirPath();
        if (!is_dir($rollbackDir)) {
            return [];
        }
        $entries = [];
        foreach ((array)@scandir($rollbackDir) as $file) {
            if (!is_string($file) || $file === '.' || $file === '..') {
                continue;
            }
            if (!preg_match('/^global-[0-9]{8}-[0-9]{6}-[a-z0-9_-]+\.json$/', $file)) {
                continue;
            }
            $path = "$rollbackDir/$file";
            if (!is_file($path)) {
                continue;
            }
            $decoded = @json_decode((string)@file_get_contents($path), true);
            $reason = '';
            $pluginVersion = '';
            $traceId = '';
            $transactionId = '';
            $dockerCount = null;
            $vmCount = null;
            if (is_array($decoded)) {
                $reason = (string)($decoded['reason'] ?? '');
                $pluginVersion = (string)($decoded['pluginVersion'] ?? '');
                $traceId = normalizeRequestTraceId((string)($decoded['traceId'] ?? ''));
                $transactionId = normalizeRequestTransactionId((string)($decoded['transactionId'] ?? ''));
                $types = is_array($decoded['types'] ?? null) ? $decoded['types'] : [];
                $dockerFolders = $types['docker']['folders'] ?? null;
                $vmFolders = $types['vm']['folders'] ?? null;
                if (is_array($dockerFolders)) {
                    $dockerCount = count($dockerFolders);
                }
                if (is_array($vmFolders)) {
                    $vmCount = count($vmFolders);
                }
            }
            $entries[] = [
                'name' => $file,
                'createdAt' => gmdate('c', (int)@filemtime($path)),
                'size' => (int)@filesize($path),
                'reason' => $reason,
                'pluginVersion' => $pluginVersion,
                'traceId' => $traceId,
                'transactionId' => $transactionId,
                'dockerCount' => $dockerCount,
                'vmCount' => $vmCount
            ];
        }
        usort($entries, function($a, $b) {
            return strcmp((string)$b['createdAt'], (string)$a['createdAt']);
        });
        return $entries;
    }

    function pruneGlobalRollbackSnapshots(int $keep = FVPLUS_GLOBAL_ROLLBACK_HISTORY_MAX): array {
        $keep = max(1, $keep);
        $snapshots = listGlobalRollbackSnapshots();
        $removed = [];
        if (count($snapshots) <= $keep) {
            return $removed;
        }
        $toRemove = array_slice($snapshots, $keep);
        foreach ($toRemove as $snapshot) {
            try {
                $path = getGlobalRollbackSnapshotPath((string)$snapshot['name']);
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

    function createGlobalRollbackSnapshot(string $reason = 'manual'): array {
        $rollbackDir = getGlobalRollbackDirPath();
        if (!is_dir($rollbackDir)) {
            @mkdir($rollbackDir, 0770, true);
        }
        $slugReason = trim((string)preg_replace('/[^a-zA-Z0-9_-]+/', '-', strtolower($reason)), '-');
        if ($slugReason === '') {
            $slugReason = 'manual';
        }
        $filename = sprintf('global-%s-%s.json', gmdate('Ymd-His'), $slugReason);
        $payload = [
            'rollbackSchemaVersion' => FVPLUS_GLOBAL_ROLLBACK_SCHEMA_VERSION,
            'pluginVersion' => readInstalledVersion(),
            'createdAt' => gmdate('c'),
            'reason' => $reason,
            'traceId' => getRequestTraceId(),
            'transactionId' => getRequestTransactionId(),
            'types' => [
                'docker' => [
                    'folders' => readRawFolderMap('docker'),
                    'prefs' => readTypePrefs('docker')
                ],
                'vm' => [
                    'folders' => readRawFolderMap('vm'),
                    'prefs' => readTypePrefs('vm')
                ]
            ],
            'themeWorkspace' => readThemeWorkspace()
        ];
        writeJsonObjectAtomic("$rollbackDir/$filename", $payload);
        $pruned = pruneGlobalRollbackSnapshots(FVPLUS_GLOBAL_ROLLBACK_HISTORY_MAX);
        try {
            appendDiagnosticsHistoryEvent('rollback_create', null, [
                'name' => $filename,
                'reason' => $reason,
                'dockerCount' => count($payload['types']['docker']['folders']),
                'vmCount' => count($payload['types']['vm']['folders']),
                'managedThemeCount' => count((array)($payload['themeWorkspace']['themes'] ?? [])),
                'prunedCount' => count($pruned)
            ], 'ok', 'server');
        } catch (Throwable $err) {
            // Keep rollback checkpoint creation non-fatal.
        }
        return [
            'name' => $filename,
            'createdAt' => gmdate('c'),
            'reason' => $reason,
            'pluginVersion' => $payload['pluginVersion'],
            'dockerCount' => count($payload['types']['docker']['folders']),
            'vmCount' => count($payload['types']['vm']['folders']),
            'managedThemeCount' => count((array)($payload['themeWorkspace']['themes'] ?? [])),
            'traceId' => getRequestTraceId(),
            'transactionId' => getRequestTransactionId(),
            'pruned' => $pruned
        ];
    }

    function restoreGlobalRollbackSnapshot(string $name): array {
        $path = getGlobalRollbackSnapshotPath($name);
        $safeName = basename($path);
        if (!file_exists($path)) {
            throw new RuntimeException('Rollback snapshot file not found.');
        }
        $decoded = @json_decode((string)@file_get_contents($path), true);
        if (!is_array($decoded)) {
            throw new RuntimeException('Rollback snapshot is not valid JSON.');
        }
        $typesData = is_array($decoded['types'] ?? null) ? $decoded['types'] : [];
        $counts = [];
        foreach (FVPLUS_ALLOWED_TYPES as $type) {
            $entry = is_array($typesData[$type] ?? null) ? $typesData[$type] : [];
            $folders = is_array($entry['folders'] ?? null) ? $entry['folders'] : [];
            $prefs = is_array($entry['prefs'] ?? null) ? $entry['prefs'] : readTypePrefs($type);

            writeRawFolderMap($type, $folders);
            syncManualOrderWithFolders($type, $folders);
            writeTypePrefs($type, $prefs);
            if ($type === 'docker') {
                syncContainerOrder('docker');
            }
            $counts[$type] = count($folders);
        }
        if (is_array($decoded['themeWorkspace'] ?? null)) {
            writeThemeWorkspace($decoded['themeWorkspace']);
        }

        try {
            appendDiagnosticsHistoryEvent('rollback_restore', null, [
                'name' => $safeName,
                'dockerCount' => (int)($counts['docker'] ?? 0),
                'vmCount' => (int)($counts['vm'] ?? 0)
            ], 'ok', 'server');
        } catch (Throwable $err) {
            // Non-fatal.
        }
        return [
            'name' => $safeName,
            'restoredAt' => gmdate('c'),
            'dockerCount' => (int)($counts['docker'] ?? 0),
            'vmCount' => (int)($counts['vm'] ?? 0)
        ];
    }

    function restoreLatestGlobalRollbackSnapshot(): array {
        $snapshots = listGlobalRollbackSnapshots();
        if (empty($snapshots)) {
            throw new RuntimeException('No rollback snapshots available.');
        }
        return restoreGlobalRollbackSnapshot((string)$snapshots[0]['name']);
    }

    function restorePreviousGlobalRollbackSnapshot(): array {
        $snapshots = listGlobalRollbackSnapshots();
        if (count($snapshots) < 2) {
            throw new RuntimeException('No previous rollback snapshot available.');
        }
        $target = (string)$snapshots[1]['name'];
        $undo = createGlobalRollbackSnapshot('before-global-rollback');
        $restored = restoreGlobalRollbackSnapshot($target);
        $restored['targetName'] = $target;
        $restored['undoSnapshot'] = (string)($undo['name'] ?? '');
        return $restored;
    }
