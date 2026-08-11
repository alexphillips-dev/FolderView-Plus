<?php
function legacyRegexMigrationLockPath(string $type): string {
        global $configDir;
        $type = ensureType($type);
        if (!is_dir($configDir)) {
            @mkdir($configDir, 0770, true);
        }
        return $configDir . '/' . $type . '-legacy-regex-migration.lock';
    }

    function migrateLegacyRegexToAutoRule(string $type, string $folderId, string $expectedPattern): array {
        $type = ensureType($type);
        $folderId = trim($folderId);
        $expectedPattern = (string)$expectedPattern;
        if ($folderId === '') {
            throw new RuntimeException('Folder ID is required.');
        }
        if ($expectedPattern === '') {
            throw new RuntimeException('Legacy regex pattern is required.');
        }

        $lockHandle = @fopen(legacyRegexMigrationLockPath($type), 'c+');
        if (!is_resource($lockHandle) || !@flock($lockHandle, LOCK_EX)) {
            if (is_resource($lockHandle)) {
                @fclose($lockHandle);
            }
            throw new RuntimeException('Legacy regex conversion is busy. Try again.');
        }

        $result = null;
        try {
            $folders = readRawFolderMap($type);
            if (!array_key_exists($folderId, $folders) || !is_array($folders[$folderId])) {
                throw new RuntimeException('Folder not found.');
            }
            $legacyPattern = (string)($folders[$folderId]['regex'] ?? '');
            if ($legacyPattern === '') {
                throw new RuntimeException('This folder no longer has a legacy regex to convert.');
            }
            if (!hash_equals($legacyPattern, $expectedPattern)) {
                throw new RuntimeException('The legacy regex changed after this editor loaded. Reload and review it before converting.');
            }
            $probe = '/' . str_replace('/', '\\/', $legacyPattern) . '/';
            if (@preg_match($probe, '') === false) {
                throw new RuntimeException('The legacy regex is invalid and cannot be converted.');
            }

            $prefs = readTypePrefs($type);
            $rules = is_array($prefs['autoRules'] ?? null) ? array_values($prefs['autoRules']) : [];
            $existingRule = null;
            foreach ($rules as $rule) {
                if (!is_array($rule)) {
                    continue;
                }
                if (
                    (string)($rule['folderId'] ?? '') === $folderId
                    && normalizeBool($rule['enabled'] ?? true, true) === true
                    && (string)($rule['effect'] ?? 'include') === 'include'
                    && (string)($rule['kind'] ?? 'name_regex') === 'name_regex'
                    && (string)($rule['pattern'] ?? '') === $legacyPattern
                ) {
                    $existingRule = $rule;
                    break;
                }
            }

            $created = false;
            if ($existingRule === null) {
                $existingRule = [
                    'id' => 'rule-' . gmdate('YmdHis') . '-' . generateId(8),
                    'enabled' => true,
                    'folderId' => $folderId,
                    'effect' => 'include',
                    'kind' => 'name_regex',
                    'pattern' => $legacyPattern,
                    'labelKey' => '',
                    'labelValue' => ''
                ];
                // Converted legacy matching is a fallback. Existing advanced policy keeps priority.
                $rules[] = $existingRule;
                $created = true;
            }

            $nextPrefs = normalizeTypePrefs(array_merge($prefs, ['autoRules' => $rules]));
            $nextFolders = $folders;
            $nextFolders[$folderId]['regex'] = '';
            $backup = createBackupSnapshot($type, 'before-legacy-regex-conversion');

            try {
                $savedPrefs = writeTypePrefs($type, $nextPrefs);
                writeRawFolderMap($type, $nextFolders);
            } catch (Throwable $writeError) {
                try {
                    writeTypePrefs($type, $prefs);
                    writeRawFolderMap($type, $folders);
                } catch (Throwable $rollbackError) {
                    throw new RuntimeException(
                        'Legacy regex conversion failed and rollback also failed: ' . $rollbackError->getMessage(),
                        0,
                        $writeError
                    );
                }
                throw new RuntimeException('Legacy regex conversion failed; original data was restored.', 0, $writeError);
            }

            $result = [
                'type' => $type,
                'folderId' => $folderId,
                'pattern' => $legacyPattern,
                'created' => $created,
                'rule' => $existingRule,
                'prefs' => $savedPrefs,
                'folder' => $nextFolders[$folderId],
                'backup' => $backup
            ];
        } finally {
            @flock($lockHandle, LOCK_UN);
            @fclose($lockHandle);
        }

        if (!is_array($result)) {
            throw new RuntimeException('Legacy regex conversion did not complete.');
        }
        try {
            syncManualOrderWithFolders($type, readRawFolderMap($type));
            if ($type === 'docker') {
                syncContainerOrder('docker');
            }
        } catch (Throwable $error) {
            // The conversion is already committed; a later refresh can safely reconcile order.
        }
        try {
            appendDiagnosticsHistoryEvent('legacy_regex_conversion', $type, [
                'traceId' => getRequestTraceId(),
                'folderId' => $folderId,
                'ruleId' => (string)($result['rule']['id'] ?? ''),
                'created' => (bool)($result['created'] ?? false),
                'backupCreated' => is_array($result['backup'] ?? null)
            ], 'ok', 'server');
        } catch (Throwable $error) {
            // Diagnostics are non-fatal after the transactional conversion succeeds.
        }
        return $result;
    }

    function bulkAssignItemsToFolders(string $type, array $assignments): array {
        $type = ensureType($type);
        if (count($assignments) <= 0) {
            throw new RuntimeException('At least one folder assignment is required.');
        }
        if (count($assignments) > FVPLUS_MAX_FOLDER_BATCH_OPERATIONS) {
            throw new RuntimeException('Bulk assignment exceeds the maximum target folder count.');
        }

        $validSet = array_fill_keys(array_keys(readInfo($type)), true);
        $normalizedByFolder = [];
        $skippedByFolder = [];
        $targetByItem = [];
        $requestedItemCount = 0;
        foreach ($assignments as $assignment) {
            if (!is_array($assignment)) {
                throw new RuntimeException('Bulk assignment entries must be objects.');
            }
            $folderId = trim((string)($assignment['folderId'] ?? ''));
            $items = $assignment['items'] ?? null;
            if ($folderId === '' || strlen($folderId) > 128) {
                throw new RuntimeException('Bulk assignment contains an invalid folder ID.');
            }
            if (!is_array($items)) {
                throw new RuntimeException('Bulk assignment items must be an array.');
            }
            if (!array_key_exists($folderId, $normalizedByFolder)) {
                $normalizedByFolder[$folderId] = [];
                $skippedByFolder[$folderId] = [];
            }
            foreach ($items as $item) {
                $name = trim((string)$item);
                if ($name === '' || isset($normalizedByFolder[$folderId][$name])) {
                    continue;
                }
                $requestedItemCount++;
                if ($requestedItemCount > FVPLUS_MAX_BULK_ASSIGN_BATCH_ITEMS) {
                    throw new RuntimeException('Bulk assignment exceeds the maximum item count.');
                }
                $invalid = preg_match('/[\x00-\x1F\x7F]/u', $name) === 1;
                if (!$invalid && !isset($validSet[$name])) {
                    $len = strlen($name);
                    $invalid = $len < 1 || $len > 255;
                }
                if ($invalid) {
                    $skippedByFolder[$folderId][] = $name;
                    continue;
                }
                $existingTarget = (string)($targetByItem[$name] ?? '');
                if ($existingTarget !== '' && $existingTarget !== $folderId) {
                    throw new RuntimeException("Bulk assignment item '$name' targets more than one folder.");
                }
                $targetByItem[$name] = $folderId;
                $normalizedByFolder[$folderId][$name] = true;
            }
        }

        return withConfigMutationLock(static function () use ($type, $normalizedByFolder, $skippedByFolder, $targetByItem): array {
            $startedAt = microtime(true);
            $originalFolders = readRawFolderMap($type);
            foreach (array_keys($normalizedByFolder) as $folderId) {
                if (!array_key_exists($folderId, $originalFolders)) {
                    throw new RuntimeException("Bulk assignment target folder '$folderId' was not found.");
                }
            }

            $nextFolders = $originalFolders;
            $removedFrom = [];
            $changedFolderIds = [];
            if (count($targetByItem) > 0) {
                foreach ($nextFolders as $id => &$folder) {
                    $members = normalizeFolderMembers($folder['containers'] ?? []);
                    $nextMembers = [];
                    foreach ($members as $member) {
                        if (isset($targetByItem[$member])) {
                            if (!isset($removedFrom[$member])) {
                                $removedFrom[$member] = [];
                            }
                            $removedFrom[$member][] = $id;
                            continue;
                        }
                        $nextMembers[] = $member;
                    }
                    $folder['containers'] = $nextMembers;
                }
                unset($folder);

                foreach ($normalizedByFolder as $folderId => $requested) {
                    $targetMembers = normalizeFolderMembers($nextFolders[$folderId]['containers'] ?? []);
                    foreach (array_keys($requested) as $name) {
                        if (!in_array($name, $targetMembers, true)) {
                            $targetMembers[] = $name;
                        }
                    }
                    $nextFolders[$folderId]['containers'] = $targetMembers;
                }

                foreach ($nextFolders as $folderId => $folder) {
                    $beforeMembers = normalizeFolderMembers($originalFolders[$folderId]['containers'] ?? []);
                    $afterMembers = normalizeFolderMembers($folder['containers'] ?? []);
                    if ($beforeMembers !== $afterMembers) {
                        $changedFolderIds[] = $folderId;
                    }
                }
            }

            $folderWriteCommitted = false;
            if (count($changedFolderIds) > 0) {
                try {
                    writeRawFolderMap($type, $nextFolders);
                    $folderWriteCommitted = true;
                    if ($type === 'docker') {
                        syncContainerOrder('docker');
                    }
                } catch (Throwable $error) {
                    $rollbackErrors = [];
                    if ($folderWriteCommitted) {
                        try {
                            writeRawFolderMap($type, $originalFolders);
                        } catch (Throwable $rollbackError) {
                            $rollbackErrors[] = 'folders: ' . $rollbackError->getMessage();
                        }
                        if ($type === 'docker') {
                            try {
                                syncContainerOrder('docker');
                            } catch (Throwable $rollbackError) {
                                $rollbackErrors[] = 'Docker order: ' . $rollbackError->getMessage();
                            }
                        }
                    }
                    $rollbackDetail = count($rollbackErrors) > 0
                        ? ' Automatic rollback had errors (' . implode('; ', $rollbackErrors) . ').'
                        : ($folderWriteCommitted ? ' Automatic rollback restored the original configuration.' : ' No configuration write was committed.');
                    throw new RuntimeException('Bulk assignment transaction failed: ' . $error->getMessage() . $rollbackDetail, 0, $error);
                }
            }

            $results = [];
            $assignedCount = 0;
            $skippedInvalidCount = 0;
            foreach ($normalizedByFolder as $folderId => $requested) {
                $assigned = array_keys($requested);
                $skippedInvalid = array_values($skippedByFolder[$folderId] ?? []);
                $assignedCount += count($assigned);
                $skippedInvalidCount += count($skippedInvalid);
                $removedForTarget = [];
                foreach ($assigned as $name) {
                    if (isset($removedFrom[$name])) {
                        $removedForTarget[$name] = $removedFrom[$name];
                    }
                }
                $results[] = [
                    'folderId' => $folderId,
                    'assigned' => $assigned,
                    'removedFrom' => $removedForTarget,
                    'count' => count($assigned),
                    'skippedInvalid' => $skippedInvalid
                ];
            }

            $durationMs = (int)round((microtime(true) - $startedAt) * 1000);
            try {
                appendDiagnosticsHistoryEvent('folder_batch_assignment', $type, [
                    'targetFolderCount' => count($normalizedByFolder),
                    'assignedCount' => $assignedCount,
                    'skippedInvalidCount' => $skippedInvalidCount,
                    'changedFolderCount' => count($changedFolderIds),
                    'durationMs' => $durationMs,
                    'sourceScript' => basename((string)($_SERVER['SCRIPT_NAME'] ?? ''))
                ], 'ok', 'server');
            } catch (Throwable $error) {
                // Keep the committed assignment successful if diagnostics logging fails.
            }

            return [
                'type' => $type,
                'results' => $results,
                'assignedCount' => $assignedCount,
                'skippedInvalidCount' => $skippedInvalidCount,
                'changedFolderIds' => $changedFolderIds,
                'changedFolderCount' => count($changedFolderIds),
                'dockerOrderSynced' => $type === 'docker' && count($changedFolderIds) > 0,
                'durationMs' => $durationMs,
                'metadata' => readConfigMetadata($type, false)
            ];
        });
    }

    function bulkAssignItemsToFolder(string $type, string $folderId, array $items): array {
        $type = ensureType($type);
        $folderId = trim($folderId);
        $batch = bulkAssignItemsToFolders($type, [[
            'folderId' => $folderId,
            'items' => $items
        ]]);
        $result = is_array($batch['results'][0] ?? null) ? $batch['results'][0] : [];
        return [
            'type' => $type,
            'folderId' => $folderId,
            'assigned' => array_values((array)($result['assigned'] ?? [])),
            'removedFrom' => (array)($result['removedFrom'] ?? []),
            'count' => (int)($result['count'] ?? 0),
            'skippedInvalid' => array_values((array)($result['skippedInvalid'] ?? [])),
            'changedFolderIds' => array_values((array)($batch['changedFolderIds'] ?? [])),
            'durationMs' => (int)($batch['durationMs'] ?? 0),
            'metadata' => (array)($batch['metadata'] ?? [])
        ];
    }
