<?php
function writeFolderMapAndManualOrder(string $type, array $folders, bool $reordered = false): float {
    return withConfigMutationLock(static function () use ($type, $folders, $reordered): float {
        $snapshots = fvplusEnvironmentCaptureFiles(fvplusTypeTransactionPaths($type, false));
        try {
            writeRawFolderMap($type, $folders);
            $persistedAt = microtime(true);
            $prefs = readTypePrefs($type);
            $nextPrefs = reconcileManualOrderPrefs($prefs, $folders);
            if ($reordered) {
                $nextPrefs['manualOrder'] = array_map('strval', array_keys($folders));
                if ($nextPrefs['sortMode'] !== 'alpha') $nextPrefs['sortMode'] = 'manual';
            }
            if ($reordered || $nextPrefs !== $prefs) writeTypePrefs($type, $nextPrefs);
            return $persistedAt;
        } catch (Throwable $error) {
            $changed = array_filter($snapshots, static function (array $snapshot): bool {
                try {
                    return fvplusTransactionCaptureFile($snapshot['path']) !== $snapshot;
                } catch (Throwable $readError) {
                    return true;
                }
            });
            $failureSnapshot = getDurableStorageRuntimeSnapshot();
            try {
                fvplusTransactionRestoreAfterFailure($changed, $error, 'fvplusTransactionRestoreFiles');
            } finally {
                $GLOBALS['fvplus_durable_storage_snapshot'] = $failureSnapshot;
            }
            throw $error;
        }
    });
}

function updateFolder(string $type, string $content, string $id = '', $expectedRevision = '') : array {
        $startedAt = microtime(true);
        $type = ensureType($type);
        if (strlen($content) > FVPLUS_MAX_FOLDER_CONTENT_RAW_BYTES) {
            throw new RuntimeException('Folder payload exceeds raw upload limit.');
        }
        $isCreate = $id === '';
        if (!$isCreate) {
            assertExpectedConfigRevision($type, 'folder', $expectedRevision);
        }
        if ($isCreate) {
            $id = generateId();
        } else {
            $id = normalizeFolderIdValue($id);
            if ($id === '') {
                throw new InvalidArgumentException('Invalid folder identifier.');
            }
        }
        $fileData = readRawFolderMap($type);
        if (!$isCreate && !isset($fileData[$id])) {
            throw new RuntimeException('Folder not found.');
        }
        $originalFileData = $fileData;
        $decodedContent = json_decode($content, true);
        if (!is_array($decodedContent)) {
            throw new RuntimeException('Invalid folder payload.');
        }
        fvplus_assert_folder_payload_shape($decodedContent);
        if ($type === 'docker') fvplusAssertWebuiProfileLimits($decodedContent['settings'] ?? []);
        $existingFolder = is_array($fileData[$id] ?? null)
            ? normalizeFolderContentPayload((array)$fileData[$id])
            : null;
        $submittedPattern = (string)($decodedContent['regex'] ?? '');
        if ($submittedPattern !== (string)($existingFolder['regex'] ?? '') && !fvplusLegacyFolderRegexIsValid($submittedPattern)) {
            throw new InvalidArgumentException('Correct invalid rules before saving.');
        }
        $nextFolder = preserveMigratedFolderReferences(normalizeFolderContentPayload($decodedContent), $existingFolder ?? []);
        if ($isCreate && $nextFolder['parentId'] !== '' && !array_key_exists($nextFolder['parentId'], $fileData)) {
            throw new FVPlusConfigConflictException('Selected parent folder no longer exists.');
        }
        $normalizedPreview = json_encode($nextFolder, JSON_UNESCAPED_SLASHES);
        if (!is_string($normalizedPreview)) {
            throw new RuntimeException('Failed to normalize folder payload.');
        }
        if (strlen($normalizedPreview) > FVPLUS_MAX_FOLDER_CONTENT_BYTES) {
            throw new RuntimeException('Folder payload too large after normalization.');
        }
        $fileData[$id] = $nextFolder;
        $fileData = normalizeFolderParentLinks($fileData);
        if (!$isCreate && is_array($existingFolder)) {
            $beforeComparable = $originalFileData;
            $afterComparable = $fileData;
            unset($beforeComparable[$id]['createdAt'], $beforeComparable[$id]['updatedAt'],
                $afterComparable[$id]['createdAt'], $afterComparable[$id]['updatedAt']);
            if (fvplus_security_canonicalize($beforeComparable) === fvplus_security_canonicalize($afterComparable)) {
                return readConfigMetadata($type, false);
            }
        }
        $createdAt = normalizeIsoTimestamp($nextFolder['createdAt'] ?? '');
        if (is_array($existingFolder)) {
            $existingCreatedAt = normalizeIsoTimestamp($existingFolder['createdAt'] ?? '');
            if ($existingCreatedAt !== '') {
                $createdAt = $existingCreatedAt;
            }
        }
        if ($createdAt === '') {
            $createdAt = gmdate('c');
        }
        $fileData[$id]['createdAt'] = $createdAt;
        $fileData[$id]['updatedAt'] = gmdate('c');
        $validatedAt = microtime(true);
        $persistedAt = writeFolderMapAndManualOrder($type, $fileData);
        $syncedAt = microtime(true);
        try {
            appendDiagnosticsHistoryEvent($isCreate ? 'folder_create' : 'folder_update', $type, [
                'folderId' => $id,
                'folderCount' => count($fileData),
                'sourceScript' => basename((string)($_SERVER['SCRIPT_NAME'] ?? '')),
                'validationReadMs' => max(0, min(86400000, (int)round(($validatedAt - $startedAt) * 1000))),
                'folderPersistenceMs' => max(0, min(86400000, (int)round(($persistedAt - $validatedAt) * 1000))),
                'manualOrderSyncMs' => max(0, min(86400000, (int)round(($syncedAt - $persistedAt) * 1000))),
                'durationMs' => max(0, min(86400000, (int)round(($syncedAt - $startedAt) * 1000)))
            ], 'ok', 'server');
        } catch (Throwable $err) {
            // Keep update flow non-fatal.
        }
        return readConfigMetadata($type, false);
    }

    function applyFolderBatchOperations(string $type, array $operations, $expectedRevision = ''): array {
        $type = ensureType($type);
        $deletes = $operations['deletes'] ?? [];
        $upserts = $operations['upserts'] ?? [];
        $creates = $operations['creates'] ?? [];
        $backupReason = $operations['backupReason'] ?? '';
        if (!is_string($backupReason) || ($backupReason !== '' && (!preg_match('/^before-(?:import-transaction-(?:merge|skip|replace)|clear-all|tree-integrity-repair|delete-[a-zA-Z0-9._:-]{1,128})$/D', $backupReason)
            || trim((string)$expectedRevision) === ''))) {
            throw new RuntimeException('Invalid folder batch safety backup request.');
        }
        $preserveParentLinks = $operations['preserveParentLinks'] ?? false;
        if (!is_bool($preserveParentLinks) || ($preserveParentLinks && trim((string)$expectedRevision) === '')) {
            throw new RuntimeException('Invalid folder payload.');
        }
        $importing = $preserveParentLinks || str_starts_with($backupReason, 'before-import-transaction-');
        [$manualOrder, $expectedPrefsRevision] = parseBatchManualOrder($operations);
        if (!is_array($deletes) || !is_array($upserts) || !is_array($creates)) {
            throw new RuntimeException('Batch operations must contain delete, update, and create arrays.');
        }
        $operationCount = assertBatchFolderOperationCount($deletes, $upserts, $creates);
        [$normalizedDeletes, $normalizedUpserts, $normalizedCreates] =
            normalizeBatchFolderOperations($type, $deletes, $upserts, $creates, $expectedRevision);

        return withConfigMutationLock(static function () use (
            $type,
            $normalizedDeletes,
            $normalizedUpserts,
            $normalizedCreates,
            $manualOrder,
            $expectedPrefsRevision,
            $operationCount,
            $expectedRevision,
            $backupReason,
            $importing
        ): array {
            $startedAt = microtime(true);
            assertExpectedConfigRevision($type, 'folder', $expectedRevision);
            assertBatchManualOrderRevision($type, $manualOrder, $expectedPrefsRevision);
            $repairingHierarchy = $backupReason === 'before-tree-integrity-repair';
            $storedFolders = $repairingHierarchy ? readFolderMapForTreeIntegrity($type) : readRawFolderMap($type, false, true);
            $originalFolders = $repairingHierarchy ? $storedFolders : normalizeFolderParentLinks($storedFolders);
            foreach ($normalizedUpserts as $entry) {
                if ($entry['createOnly'] && array_key_exists($entry['id'], $originalFolders)) {
                    throw new FVPlusConfigConflictException('The preview changed. Run the preview again before applying.');
                }
            }
            $originalPrefs = readTypePrefs($type);
            $nextFolders = $originalFolders;
            $deletedIds = [];
            $updatedIds = [];
            $createdIds = [];
            $now = gmdate('c');

            foreach ($normalizedDeletes as $id) {
                if (!array_key_exists($id, $nextFolders)) {
                    continue;
                }
                $deletedParentId = normalizeFolderParentIdValue($nextFolders[$id]['parentId'] ?? '');
                unset($nextFolders[$id]);
                $deletedIds[] = $id;
                // Import applies the reviewed parent links exactly. A normal delete promotes children.
                if ($importing) continue;
                foreach ($nextFolders as &$folder) {
                    if (!is_array($folder)) {
                        continue;
                    }
                    $parentId = normalizeFolderParentIdValue($folder['parentId'] ?? ($folder['parent_id'] ?? ''));
                    if ($parentId === $id) {
                        $folder['parentId'] = $deletedParentId;
                    }
                }
                unset($folder);
            }

            foreach ($normalizedUpserts as $entry) {
                $id = (string)$entry['id'];
                $nextFolder = (array)$entry['folder'];
                $existingFolder = is_array($nextFolders[$id] ?? null)
                    ? normalizeFolderContentPayload((array)$nextFolders[$id])
                    : null;
                $createdAt = normalizeIsoTimestamp($nextFolder['createdAt'] ?? '');
                if (is_array($existingFolder)) {
                    $existingCreatedAt = normalizeIsoTimestamp($existingFolder['createdAt'] ?? '');
                    if ($existingCreatedAt !== '') {
                        $createdAt = $existingCreatedAt;
                    }
                }
                if ($createdAt === '') {
                    $createdAt = $now;
                }
                $nextFolder['createdAt'] = $createdAt;
                $nextFolder['updatedAt'] = $now;
                $nextFolders[$id] = $nextFolder;
                if ($entry['createOnly']) $createdIds[] = $id;
                else $updatedIds[] = $id;
            }

            foreach ($normalizedCreates as $entry) {
                do {
                    $id = generateId();
                } while (array_key_exists($id, $nextFolders));
                $nextFolder = (array)$entry['folder'];
                $createdAt = normalizeIsoTimestamp($nextFolder['createdAt'] ?? '');
                $nextFolder['createdAt'] = $createdAt !== '' ? $createdAt : $now;
                $nextFolder['updatedAt'] = $now;
                $nextFolders[$id] = $nextFolder;
                $createdIds[] = $id;
            }

            $validFolders = normalizeFolderParentLinks($nextFolders);
            if (!$repairingHierarchy && $validFolders !== $nextFolders) {
                throw new FVPlusConfigConflictException('The preview changed. Run the preview again before applying.');
            }
            $nextFolders = $validFolders;
            if (!$repairingHierarchy) preserveUnchangedFolderParentLinks($nextFolders, $storedFolders);
            $nextPrefs = reconcileManualOrderPrefs($originalPrefs, $nextFolders);
            if ($manualOrder !== null) {
                $nextPrefs = applyBatchManualOrderPrefs($nextPrefs, $nextFolders, $manualOrder);
            }
            $snapshots = fvplusEnvironmentCaptureFiles(fvplusTypeTransactionPaths($type, false));
            $nativeWrites = [];
            $recordNativeWrite = fvplusTransactionRecordFileWrites($nativeWrites);
            $backup = createFolderBatchSafetyBackup($type, $backupReason, $originalFolders, $nextFolders, $repairingHierarchy);
            try {
                $writtenFolders = writeRawFolderMap($type, $nextFolders, $repairingHierarchy);
                if ($nextPrefs !== $originalPrefs) writeTypePrefs($type, $nextPrefs);
                $dockerSync = $type === 'docker' ? syncContainerOrder($type, $recordNativeWrite) : null;
                if (jsonObjectsDiffer($writtenFolders, readRawFolderMap($type, false, true))
                    || jsonObjectsDiffer($nextPrefs, readTypePrefs($type))) {
                    throw new RuntimeException('Folder batch transaction verification failed.');
                }
            } catch (Throwable $error) {
                try {
                    fvplusTransactionRestoreAfterFailure(array_merge($snapshots, array_values($nativeWrites)), $error, 'fvplusEnvironmentRestoreFiles');
                } catch (Throwable $rollbackError) {
                    throw new RuntimeException('Folder batch transaction failed: ' . $rollbackError->getMessage(), 0, $error);
                }
                if (!empty($backup['name'])) @unlink(getBackupSnapshotPath($type, $backup['name']));
                throw new RuntimeException('Folder batch transaction failed: ' . $error->getMessage()
                    . ' Automatic rollback restored the original configuration.', 0, $error);
            }
            if (!empty($backup['name'])) $backup['pruned'] = pruneBackupSnapshots($type, getTypeBackupRetention($type), [$backup['name']]);

            $durationMs = (int)round((microtime(true) - $startedAt) * 1000);
            try {
                appendDiagnosticsHistoryEvent('folder_batch_mutation', $type, [
                    'requestedCount' => $operationCount,
                    'deletedCount' => count($deletedIds),
                    'updatedCount' => count($updatedIds),
                    'createdCount' => count($createdIds),
                    'folderCount' => count($nextFolders),
                    'durationMs' => $durationMs,
                    'sourceScript' => basename((string)($_SERVER['SCRIPT_NAME'] ?? ''))
                ], 'ok', 'server');
            } catch (Throwable $err) {
                // Keep the committed transaction successful if diagnostics logging fails.
            }

            return [
                'requestedCount' => $operationCount,
                'deletedIds' => $deletedIds,
                'updatedIds' => $updatedIds,
                'updatedFolder' => $operationCount === 1 && isset($updatedIds[0]) ? $nextFolders[$updatedIds[0]] : null,
                'createdIds' => $createdIds,
                'folderCount' => count($nextFolders),
                'dockerOrderSynced' => ($dockerSync['syncOutcome'] ?? null) === 'synced',
                'durationMs' => $durationMs,
                'backup' => $backup,
                'metadata' => readConfigMetadata($type, false)
            ];
        });
    }
    function applyFolderMemberIdentityPatches(string $type, array $patches): array {
        $type = ensureType($type);
        return withConfigMutationLock(static function () use ($type, $patches): array {
            $fileData = readRawFolderMap($type);
            $claimed = array_fill_keys(array_merge(...array_column($fileData, 'containers')), true);
            $changedFolderIds = [];
            $renameCount = 0;
            $identityCount = 0;
            foreach ($patches as $rawFolderId => $rawPatch) {
                $folderId = normalizeFolderIdValue($rawFolderId);
                if ($folderId === '' || !is_array($rawPatch) || !is_array($fileData[$folderId] ?? null)) {
                    continue;
                }
                $folder = normalizeFolderContentPayload((array)$fileData[$folderId]);
                $previous = is_array($rawPatch['previousIdentities'] ?? null) ? $rawPatch['previousIdentities'] : [];
                $base = normalizeFolderContentPayload(['containers' => array_keys($previous), 'memberIdentities' => $previous]);
                $eligible = [];
                foreach ($folder['containers'] as $name) {
                    if (array_key_exists($name, $previous)
                        && ($folder['memberIdentities'][$name] ?? null) === ($base['memberIdentities'][$name] ?? null)) {
                        $eligible[$name] = true;
                    }
                }
                $renames = is_array($rawPatch['renames'] ?? null) ? $rawPatch['renames'] : [];
                foreach ($renames as $rawOldName => $rawNewName) {
                    $oldName = truncateUtf8String(trim((string)$rawOldName), 512);
                    $newName = truncateUtf8String(trim((string)$rawNewName), 512);
                    if ($oldName === '' || $newName === '' || $oldName === $newName) {
                        continue;
                    }
                    $oldIndex = array_search($oldName, $folder['containers'], true);
                    if ($oldIndex === false || !isset($eligible[$oldName]) || isset($claimed[$newName])) {
                        continue;
                    }
                    $folder['containers'][$oldIndex] = $newName;
                    $claimed[$newName] = $eligible[$newName] = true;
                    $folder['hiddenPreviewMembers'] = array_map(static function ($name) use ($oldName, $newName) {
                        return $name === $oldName ? $newName : $name;
                    }, normalizeFolderMembers($folder['hiddenPreviewMembers'] ?? []));
                    foreach ($folder['actions'] as &$action) {
                        if (!is_array($action)) {
                            continue;
                        }
                        foreach (['containers', 'conatiners'] as $targetKey) {
                            if (!is_array($action[$targetKey] ?? null)) {
                                continue;
                            }
                            $action[$targetKey] = array_map(static function ($name) use ($oldName, $newName) {
                                return trim((string)$name) === $oldName ? $newName : trim((string)$name);
                            }, $action[$targetKey]);
                        }
                    }
                    unset($action);
                    $profiles = fvplusNormalizeWebuiProfiles($folder['settings']['webui_profiles'] ?? []);
                    foreach ($profiles as &$profile) $profile['containers'] = array_values(array_unique(array_map(static fn($name) => $name === $oldName ? $newName : $name, $profile['containers'])));
                    unset($profile); $folder['settings']['webui_profiles'] = $profiles;
                    if (is_array($folder['memberIdentities'][$oldName] ?? null)) {
                        $folder['memberIdentities'][$newName] = $folder['memberIdentities'][$oldName];
                        unset($folder['memberIdentities'][$oldName]);
                    }
                    $renameCount++;
                }
                $incomingIdentities = is_array($rawPatch['memberIdentities'] ?? null) ? $rawPatch['memberIdentities'] : [];
                foreach ($folder['containers'] as $memberName) {
                    if (!isset($eligible[$memberName]) || !is_array($incomingIdentities[$memberName] ?? null)) {
                        continue;
                    }
                    $candidate = normalizeFolderContentPayload([
                        'containers' => [$memberName],
                        'memberIdentities' => [$memberName => $incomingIdentities[$memberName]]
                    ]);
                    $identity = $candidate['memberIdentities'][$memberName] ?? null;
                    if (!is_array($identity)) {
                        continue;
                    }
                    if (($folder['memberIdentities'][$memberName] ?? null) !== $identity) {
                        $folder['memberIdentities'][$memberName] = $identity;
                        $identityCount++;
                    }
                }
                $nextFolder = normalizeFolderContentPayload($folder);
                if (jsonObjectsDiffer($fileData[$folderId], $nextFolder)) {
                    $nextFolder['updatedAt'] = gmdate('c');
                    $fileData[$folderId] = $nextFolder;
                    $changedFolderIds[] = $folderId;
                }
            }
            if (count($changedFolderIds) > 0) {
                writeRawFolderMap($type, $fileData);
                try {
                    appendDiagnosticsHistoryEvent('member_identity_reconcile', $type, [
                        'folderIds' => $changedFolderIds,
                        'renameCount' => $renameCount,
                        'identityCount' => $identityCount
                    ], 'ok', 'runtime');
                } catch (Throwable $err) {
                    // Keep automatic reconciliation non-fatal.
                }
            }
            return [
                'changedFolderIds' => $changedFolderIds,
                'renameCount' => $renameCount,
                'identityCount' => $identityCount,
                'metadata' => readConfigMetadata($type, true)
            ];
        });
    }
    function applyFolderSettingsPayload(string $type, array $targetIds, array $settingsPayload, array $options = []): array {
        return applySelectiveFolderSettings($type, $targetIds, $settingsPayload, $options);
    }

    function deleteFolder(string $type, string $id) : void {
        $type = ensureType($type);
        $fileData = readRawFolderMap($type);
        $deletedParentId = normalizeFolderParentIdValue($fileData[$id]['parentId'] ?? '');
        unset($fileData[$id]);
        foreach ($fileData as $folderId => &$folder) {
            if (!is_array($folder)) {
                continue;
            }
            $parentId = normalizeFolderParentIdValue($folder['parentId'] ?? ($folder['parent_id'] ?? ''));
            if ($parentId === $id) {
                $folder['parentId'] = $deletedParentId;
            }
        }
        unset($folder);
        $fileData = normalizeFolderParentLinks($fileData);
        writeFolderMapAndManualOrder($type, $fileData);
        try {
            appendDiagnosticsHistoryEvent('folder_delete', $type, [
                'folderId' => $id,
                'folderCount' => count($fileData),
                'sourceScript' => basename((string)($_SERVER['SCRIPT_NAME'] ?? ''))
            ], 'ok', 'server');
        } catch (Throwable $err) {
            // Keep delete flow non-fatal.
        }
    }

    function generateId(int $length = 20) : string {
        return substr(str_replace(['+', '/', '='], '', base64_encode(random_bytes((int)ceil($length * 3 / 4)))), 0, $length);
    }

    function createFile(string $type): void {
        $type = ensureType($type);
        global $configDir;
        if (!is_dir($configDir)) {
            @mkdir($configDir, 0770, true);
        }
        $filePath = "$configDir/$type.json";
        if (!file_exists($filePath)) {
            writeJsonObjectWithLastGood($filePath, []);
        }
        $prefsPath = getTypePrefsPath($type);
        if (!file_exists($prefsPath)) {
            readTypePrefs($type);
        }
    }
