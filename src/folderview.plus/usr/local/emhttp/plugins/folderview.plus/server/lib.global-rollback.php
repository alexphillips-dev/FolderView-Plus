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
            $restorable = false;
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
                try {
                    fvplusValidateGlobalRollbackPayload($decoded);
                    $restorable = true;
                } catch (RuntimeException $error) { /* Keep damaged checkpoints visible for inspection. */ }
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
                'restorable' => $restorable,
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
            $oldestFirst = array_reverse($snapshots);
            // Prune damaged snapshots before sacrificing a usable checkpoint.
            usort($oldestFirst, static fn(array $a, array $b): int => $a['restorable'] <=> $b['restorable']);
            foreach ($oldestFirst as $snapshot) {
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

    function createGlobalRollbackSnapshot(string $reason = 'manual', array $protectedNames = [], bool $prune = true, ?array $nativeAutostart = null): array {
        return withConfigMutationLock(static function () use ($reason, $protectedNames, $prune, $nativeAutostart): array {
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
                        'folders' => readRawFolderMap('docker', preserveHierarchy: true),
                        'prefs' => readTypePrefs('docker')
                    ],
                    'vm' => [
                        'folders' => readRawFolderMap('vm', preserveHierarchy: true),
                        'prefs' => readTypePrefs('vm')
                    ]
                ],
                'themeWorkspace' => readThemeWorkspace()
            ];
            if ($nativeAutostart !== null) {
                // Checkpoints can contain arbitrary native bytes, but never a path supplied at restore.
                $payload['nativeDockerAutostart'] = ['exists' => $nativeAutostart['exists'],
                    'contentBase64' => base64_encode($nativeAutostart['content']), 'mode' => $nativeAutostart['mode']];
            }
            writeJsonObjectAtomic("$rollbackDir/$filename", $payload);
            $pruned = $prune ? pruneGlobalRollbackSnapshots(FVPLUS_GLOBAL_ROLLBACK_HISTORY_MAX, [$filename, ...$protectedNames]) : [];
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

    function fvplusValidateGlobalRollbackPayload($decoded): array {
        if (!is_array($decoded)) throw new RuntimeException('Rollback snapshot is not valid JSON.');
        if (($decoded['rollbackSchemaVersion'] ?? null) !== FVPLUS_GLOBAL_ROLLBACK_SCHEMA_VERSION
            || !is_array($decoded['types'] ?? null)) {
            throw new RuntimeException('Rollback snapshot format or schema version is unsupported.');
        }
        foreach (FVPLUS_ALLOWED_TYPES as $type) {
            $entry = $decoded['types'][$type] ?? null;
            if (!is_array($entry) || !is_array($entry['folders'] ?? null)
                || (array_key_exists('prefs', $entry) && !is_array($entry['prefs']))) {
                throw new RuntimeException('Rollback snapshot is missing required type data.');
            }
            fvplusAssertSnapshotFolderMap($entry['folders'], 'Rollback snapshot is missing required type data.');
        }
        if (isset($decoded['themeWorkspace']) && !is_array($decoded['themeWorkspace'])) {
            throw new RuntimeException('Rollback snapshot contains invalid Theme Workspace data.');
        }
        if (array_key_exists('nativeDockerAutostart', $decoded)) {
            $native = $decoded['nativeDockerAutostart'];
            $content = is_string($native['contentBase64'] ?? null) ? base64_decode($native['contentBase64'], true) : false;
            $mode = $native['mode'] ?? null;
            if (!is_bool($native['exists'] ?? null) || $content === false
                || (!$native['exists'] && ($content !== '' || $mode !== null))
                || ($native['exists'] && (!is_int($mode) || $mode < 0 || $mode > 0777))) {
                throw new RuntimeException('Rollback snapshot format or schema version is unsupported.');
            }
            $decoded['nativeDockerAutostart'] = ['exists' => $native['exists'], 'content' => $content, 'mode' => $mode];
        }
        return $decoded;
    }

    function fvplusVerifyNativeAutostartTarget(string $path, array $expected): void {
        $actual = fvplusTransactionCaptureFile($path);
        if ($actual['exists'] !== $expected['exists'] || $actual['content'] !== $expected['content']
            || (isset($expected['mode']) && $actual['mode'] !== $expected['mode'])) {
            throw new RuntimeException('Native Docker autostart verification failed.');
        }
    }

    require_once __DIR__ . '/lib.global-rollback-restore.php';
