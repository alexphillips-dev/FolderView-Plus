<?php
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
            $modified = (int)@filemtime($path);
            $created = new DateTimeImmutable('@' . $modified);
            $rawCreated = is_array($decoded) ? ($decoded['createdAt'] ?? null) : null;
            if (is_string($rawCreated) && preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/D', $rawCreated)) {
                try { $created = new DateTimeImmutable($rawCreated); }
                catch (Throwable $error) { /* Historical or damaged metadata falls back to file time. */ }
            }
            $created = $created->setTimezone(new DateTimeZone('UTC'));
            $entries[] = [
                '_sortCreated' => $created->format('Y-m-d\TH:i:s.uP'),
                '_sortModified' => $modified,
                'name' => $file,
                'createdAt' => $created->format('Y-m-d\TH:i:s.vP'),
                'size' => (int)@filesize($path),
                'reason' => $reason,
                'pluginVersion' => $pluginVersion,
                'traceId' => $traceId,
                'transactionId' => $transactionId,
                'dockerCount' => $dockerCount,
                'vmCount' => $vmCount
            ];
        }
        usort($entries, static function (array $a, array $b): int {
            return strcmp($b['_sortCreated'], $a['_sortCreated'])
                ?: ($b['_sortModified'] <=> $a['_sortModified'])
                ?: strnatcmp(pathinfo($b['name'], PATHINFO_FILENAME), pathinfo($a['name'], PATHINFO_FILENAME));
        });
        foreach ($entries as &$entry) unset($entry['_sortCreated'], $entry['_sortModified']);
        unset($entry);
        return $entries;
    }

    function pruneGlobalRollbackSnapshots(int $keep = FVPLUS_GLOBAL_ROLLBACK_HISTORY_MAX, array $protectedNames = []): array {
        return withConfigMutationLock(static function () use ($keep, $protectedNames): array {
            $keep = max(1, $keep);
            $snapshots = listGlobalRollbackSnapshots();
            $removed = [];
            if (count($snapshots) <= $keep) {
                return $removed;
            }
            $remaining = count($snapshots);
            foreach (array_reverse($snapshots) as $snapshot) {
                if ($remaining <= $keep) break;
                if (in_array((string)$snapshot['name'], $protectedNames, true)) continue;
                try {
                    $path = getGlobalRollbackSnapshotPath((string)$snapshot['name']);
                    if (file_exists($path) && @unlink($path)) {
                        $removed[] = (string)$snapshot['name'];
                        $remaining--;
                    }
                } catch (Throwable $err) {
                    continue;
                }
            }
            return $removed;

        });
    }

    function createGlobalRollbackSnapshot(string $reason = 'manual', array $protectedNames = []): array {
        return withConfigMutationLock(static function () use ($reason, $protectedNames): array {
            $rollbackDir = getGlobalRollbackDirPath();
            if (!is_dir($rollbackDir)) {
                @mkdir($rollbackDir, 0770, true);
            }
            $slugReason = trim((string)preg_replace('/[^a-zA-Z0-9_-]+/', '-', strtolower($reason)), '-');
            if ($slugReason === '') {
                $slugReason = 'manual';
            }
            $baseName = sprintf('global-%s-%s', gmdate('Ymd-His'), $slugReason);
            $filename = $baseName . '.json';
            for ($suffix = 1; file_exists($rollbackDir . '/' . $filename) || is_link($rollbackDir . '/' . $filename); $suffix++) {
                $filename = $baseName . '-' . $suffix . '.json';
            }
            $createdAt = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.uP');
            $payload = [
                'rollbackSchemaVersion' => FVPLUS_GLOBAL_ROLLBACK_SCHEMA_VERSION,
                'pluginVersion' => readInstalledVersion(),
                'createdAt' => $createdAt,
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
            $pruned = pruneGlobalRollbackSnapshots(FVPLUS_GLOBAL_ROLLBACK_HISTORY_MAX, $protectedNames);
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
                'createdAt' => $createdAt,
                'reason' => $reason,
                'pluginVersion' => $payload['pluginVersion'],
                'dockerCount' => count($payload['types']['docker']['folders']),
                'vmCount' => count($payload['types']['vm']['folders']),
                'managedThemeCount' => count((array)($payload['themeWorkspace']['themes'] ?? [])),
                'traceId' => getRequestTraceId(),
                'transactionId' => getRequestTransactionId(),
                'pruned' => $pruned
            ];

        });
    }

    function restoreGlobalRollbackSnapshot(string $name, array $options = []): array {
        return withConfigMutationLock(static function () use ($name, $options): array {
            $path = getGlobalRollbackSnapshotPath($name);
            $safeName = basename($path);
            if (!is_file($path)) throw new RuntimeException('Rollback snapshot file not found.');
            $decoded = json_decode((string)@file_get_contents($path), true);
            if (!is_array($decoded)) throw new RuntimeException('Rollback snapshot is not valid JSON.');
            if (($decoded['rollbackSchemaVersion'] ?? null) !== FVPLUS_GLOBAL_ROLLBACK_SCHEMA_VERSION
                || !is_array($decoded['types'] ?? null)) {
                throw new RuntimeException('Rollback snapshot format or schema version is unsupported.');
            }
            $types = [];
            foreach (FVPLUS_ALLOWED_TYPES as $type) {
                $entry = $decoded['types'][$type] ?? null;
                if (!is_array($entry) || !is_array($entry['folders'] ?? null)
                    || (array_key_exists('prefs', $entry) && !is_array($entry['prefs']))) {
                    throw new RuntimeException('Rollback snapshot is missing required type data.');
                }
                $types[$type] = ['folders' => $entry['folders'], 'prefs' => $entry['prefs'] ?? readTypePrefs($type)];
            }
            // Older checkpoints can omit Theme Workspace; retain its current state in that adapter.
            $workspace = $decoded['themeWorkspace'] ?? readThemeWorkspace();
            if (!is_array($workspace)) throw new RuntimeException('Rollback snapshot contains invalid Theme Workspace data.');
            $target = ['types' => $types, 'themeWorkspace' => $workspace];
            $transaction = applyEnvironmentSnapshotTransaction($target, $safeName,
                array_merge($options, ['reason' => 'global-rollback', 'preserveRollbackNames' => [$safeName]]));
            $counts = ['docker' => count($types['docker']['folders']), 'vm' => count($types['vm']['folders'])];
            try {
                appendDiagnosticsHistoryEvent('rollback_restore', null, [
                    'name' => $safeName, 'dockerCount' => $counts['docker'], 'vmCount' => $counts['vm']
                ], 'ok', 'server');
            } catch (Throwable $error) { /* Optional history cannot change a committed restore. */ }
            return ['name' => $safeName, 'restoredAt' => gmdate('c'),
                'dockerCount' => $counts['docker'], 'vmCount' => $counts['vm'],
                'undoSnapshot' => (string)($transaction['rollback']['name'] ?? ''), 'verified' => true];
        });
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
        $restored = restoreGlobalRollbackSnapshot($target);
        $restored['targetName'] = $target;
        return $restored;
    }
