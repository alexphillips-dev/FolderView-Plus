<?php
require_once __DIR__ . '/lib.legacy-regex-conversion.php';

    function bulkAssignItemsToFolders(string $type, array $assignments, ?array $verifiedInventory = null): array {
        $type = ensureType($type);
        if (count($assignments) <= 0) {
            throw new RuntimeException('At least one folder assignment is required.');
        }
        if (count($assignments) > FVPLUS_MAX_FOLDER_BATCH_OPERATIONS) {
            throw new RuntimeException('Bulk assignment exceeds the maximum target folder count.');
        }

        $validSet = array_fill_keys(array_keys($verifiedInventory ?? readInfo($type)), true);
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

            if (count($changedFolderIds) > 0) {
                $snapshots = fvplusEnvironmentCaptureFiles(fvplusTypeTransactionPaths($type));
                try {
                    writeRawFolderMap($type, $nextFolders);
                    if ($type === 'docker') syncContainerOrder('docker');
                    if (jsonObjectsDiffer($nextFolders, readRawFolderMap($type))) {
                        throw new RuntimeException('Bulk assignment transaction verification failed.');
                    }
                } catch (Throwable $error) {
                    try {
                        fvplusTransactionRestoreAfterFailure($snapshots, $error, 'fvplusEnvironmentRestoreFiles');
                    } catch (Throwable $rollbackError) {
                        throw new RuntimeException('Bulk assignment transaction failed: ' . $rollbackError->getMessage(), 0, $error);
                    }
                    throw new RuntimeException('Bulk assignment transaction failed: ' . $error->getMessage()
                        . ' Automatic rollback restored the original configuration.', 0, $error);
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
