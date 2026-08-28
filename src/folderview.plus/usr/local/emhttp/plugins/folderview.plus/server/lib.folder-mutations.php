<?php
function updateFolder(string $type, string $content, string $id = '', $expectedRevision = '') : array {
        $type = ensureType($type);
        if (strlen($content) > FVPLUS_MAX_FOLDER_CONTENT_RAW_BYTES) {
            throw new RuntimeException('Folder payload exceeds raw upload limit.');
        }
        $isCreate = empty($id);
        if (!$isCreate) {
            assertExpectedConfigRevision($type, 'folder', $expectedRevision);
        }
        if (empty($id)) {
            $id = generateId();
        } else {
            $id = normalizeFolderIdValue($id);
            if ($id === '') {
                throw new InvalidArgumentException('Invalid folder identifier.');
            }
        }
        $fileData = readRawFolderMap($type);
        $decodedContent = json_decode($content, true);
        if (!is_array($decodedContent)) {
            throw new RuntimeException('Invalid folder payload.');
        }
        fvplus_assert_folder_payload_shape($decodedContent);
        $existingFolder = is_array($fileData[$id] ?? null)
            ? normalizeFolderContentPayload((array)$fileData[$id])
            : null;
        $nextFolder = normalizeFolderContentPayload($decodedContent);
        $normalizedPreview = json_encode($nextFolder, JSON_UNESCAPED_SLASHES);
        if (!is_string($normalizedPreview)) {
            throw new RuntimeException('Failed to normalize folder payload.');
        }
        if (strlen($normalizedPreview) > FVPLUS_MAX_FOLDER_CONTENT_BYTES) {
            throw new RuntimeException('Folder payload too large after normalization.');
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
        $nextFolder['createdAt'] = $createdAt;
        $nextFolder['updatedAt'] = gmdate('c');
        $fileData[$id] = $nextFolder;
        $fileData = normalizeFolderParentLinks($fileData);
        writeRawFolderMap($type, $fileData);
        syncManualOrderWithFolders($type, $fileData);
        try {
            appendDiagnosticsHistoryEvent($isCreate ? 'folder_create' : 'folder_update', $type, [
                'folderId' => $id,
                'folderCount' => count($fileData),
                'sourceScript' => basename((string)($_SERVER['SCRIPT_NAME'] ?? ''))
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
        if (!is_array($deletes) || !is_array($upserts) || !is_array($creates)) {
            throw new RuntimeException('Batch operations must contain delete, update, and create arrays.');
        }
        $operationCount = count($deletes) + count($upserts) + count($creates);
        if ($operationCount <= 0) {
            throw new RuntimeException('No folder operations were provided.');
        }
        if ($operationCount > FVPLUS_MAX_FOLDER_BATCH_OPERATIONS) {
            throw new RuntimeException('Folder batch exceeds the maximum operation count.');
        }

        $normalizedDeletes = [];
        foreach ($deletes as $rawId) {
            $id = trim((string)$rawId);
            if ($id === '' || strlen($id) > 128) {
                throw new RuntimeException('Batch delete contains an invalid folder ID.');
            }
            $normalizedDeletes[] = $id;
        }

        $normalizeBatchFolder = static function ($rawEntry, bool $requiresId): array {
            if (!is_array($rawEntry)) {
                throw new RuntimeException('Batch folder operation must be an object.');
            }
            $id = $requiresId ? trim((string)($rawEntry['id'] ?? '')) : '';
            if ($requiresId && ($id === '' || strlen($id) > 128)) {
                throw new RuntimeException('Batch update contains an invalid folder ID.');
            }
            $folder = $rawEntry['folder'] ?? null;
            if (!is_array($folder)) {
                throw new RuntimeException('Batch folder operation is missing a valid folder payload.');
            }
            fvplus_assert_folder_payload_shape($folder);
            $rawPreview = json_encode($folder, JSON_UNESCAPED_SLASHES);
            if (!is_string($rawPreview) || strlen($rawPreview) > FVPLUS_MAX_FOLDER_CONTENT_RAW_BYTES) {
                throw new RuntimeException('Batch folder payload exceeds the raw upload limit.');
            }
            $normalized = normalizeFolderContentPayload($folder);
            $normalizedPreview = json_encode($normalized, JSON_UNESCAPED_SLASHES);
            if (!is_string($normalizedPreview) || strlen($normalizedPreview) > FVPLUS_MAX_FOLDER_CONTENT_BYTES) {
                throw new RuntimeException('Batch folder payload is too large after normalization.');
            }
            return [
                'id' => $id,
                'folder' => $normalized
            ];
        };

        $normalizedUpserts = [];
        foreach ($upserts as $entry) {
            $normalizedUpserts[] = $normalizeBatchFolder($entry, true);
        }
        $normalizedCreates = [];
        foreach ($creates as $entry) {
            $normalizedCreates[] = $normalizeBatchFolder($entry, false);
        }

        return withConfigMutationLock(static function () use (
            $type,
            $normalizedDeletes,
            $normalizedUpserts,
            $normalizedCreates,
            $operationCount,
            $expectedRevision
        ): array {
            $startedAt = microtime(true);
            assertExpectedConfigRevision($type, 'folder', $expectedRevision);
            $originalFolders = readRawFolderMap($type);
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
                $deletedIds[] = $id;
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
                $updatedIds[] = $id;
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

            $nextFolders = normalizeFolderParentLinks($nextFolders);
            $nextPrefs = reconcileManualOrderPrefs($originalPrefs, $nextFolders);
            $folderWriteCommitted = false;
            $prefsWriteCommitted = false;
            try {
                writeRawFolderMap($type, $nextFolders);
                $folderWriteCommitted = true;
                if ($nextPrefs !== $originalPrefs) {
                    writeTypePrefs($type, $nextPrefs);
                    $prefsWriteCommitted = true;
                }
                if ($type === 'docker') {
                    syncContainerOrder($type);
                }
            } catch (Throwable $error) {
                $rollbackErrors = [];
                if ($folderWriteCommitted) {
                    try {
                        writeRawFolderMap($type, $originalFolders);
                    } catch (Throwable $rollbackError) {
                        $rollbackErrors[] = 'folders: ' . $rollbackError->getMessage();
                    }
                    if ($prefsWriteCommitted) {
                        try {
                            writeTypePrefs($type, $originalPrefs);
                        } catch (Throwable $rollbackError) {
                            $rollbackErrors[] = 'preferences: ' . $rollbackError->getMessage();
                        }
                    }
                    if ($type === 'docker') {
                        try {
                            syncContainerOrder($type);
                        } catch (Throwable $rollbackError) {
                            $rollbackErrors[] = 'Docker order: ' . $rollbackError->getMessage();
                        }
                    }
                }
                $rollbackDetail = count($rollbackErrors) > 0
                    ? ' Automatic rollback had errors (' . implode('; ', $rollbackErrors) . ').'
                    : ($folderWriteCommitted ? ' Automatic rollback restored the original configuration.' : ' No configuration write was committed.');
                throw new RuntimeException('Folder batch transaction failed: ' . $error->getMessage() . $rollbackDetail, 0, $error);
            }

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
                'createdIds' => $createdIds,
                'folderCount' => count($nextFolders),
                'dockerOrderSynced' => $type === 'docker',
                'durationMs' => $durationMs,
                'metadata' => readConfigMetadata($type, false)
            ];
        });
    }
    function applyFolderMemberIdentityPatches(string $type, array $patches): array { $type = ensureType($type);
        $fileData = readRawFolderMap($type);
        $changedFolderIds = [];
        $renameCount = 0;
        $identityCount = 0;
        foreach ($patches as $rawFolderId => $rawPatch) {
            $folderId = truncateUtf8String(trim((string)$rawFolderId), 64);
            if ($folderId === '' || !is_array($rawPatch) || !is_array($fileData[$folderId] ?? null)) {
                continue;
            }
            $folder = normalizeFolderContentPayload((array)$fileData[$folderId]);
            $renames = is_array($rawPatch['renames'] ?? null) ? $rawPatch['renames'] : [];
            foreach ($renames as $rawOldName => $rawNewName) {
                $oldName = truncateUtf8String(trim((string)$rawOldName), 512);
                $newName = truncateUtf8String(trim((string)$rawNewName), 512);
                if ($oldName === '' || $newName === '' || $oldName === $newName) {
                    continue;
                }
                $oldIndex = array_search($oldName, $folder['containers'], true);
                if ($oldIndex === false || in_array($newName, $folder['containers'], true)) {
                    continue;
                }
                $folder['containers'][$oldIndex] = $newName;
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
                if (!is_array($incomingIdentities[$memberName] ?? null)) {
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
    }
    function applyFolderSettingsPayload(string $type, array $targetIds, array $settingsPayload): array {
        $type = ensureType($type);
        $normalizedSettings = normalizeFolderSettingsTransferPayload($settingsPayload);
        $normalizedTargetIds = [];
        foreach ($targetIds as $targetId) {
            $safeTargetId = truncateUtf8String(trim((string)$targetId), 64);
            if ($safeTargetId === '' || in_array($safeTargetId, $normalizedTargetIds, true)) {
                continue;
            }
            $normalizedTargetIds[] = $safeTargetId;
        }
        if (count($normalizedTargetIds) <= 0) {
            throw new RuntimeException('Select at least one target folder.');
        }

        $fileData = readRawFolderMap($type);
        foreach ($normalizedTargetIds as $targetId) {
            if (!is_array($fileData[$targetId] ?? null)) {
                throw new RuntimeException('Target folder not found.');
            }
        }

        $backup = createBackupSnapshot($type, 'before-apply-folder-settings');
        $updatedAt = gmdate('c');
        foreach ($normalizedTargetIds as $targetId) {
            $existingFolder = normalizeFolderContentPayload((array)$fileData[$targetId]);
            $createdAt = normalizeIsoTimestamp($existingFolder['createdAt'] ?? '');
            if ($createdAt === '') {
                $createdAt = gmdate('c');
            }
            $existingFolder['icon'] = $normalizedSettings['icon'] ?? '';
            $existingFolder['settings'] = is_array($normalizedSettings['settings'] ?? null) ? $normalizedSettings['settings'] : [];
            $existingFolder['actions'] = is_array($normalizedSettings['actions'] ?? null) ? $normalizedSettings['actions'] : [];
            $existingFolder['createdAt'] = $createdAt;
            $existingFolder['updatedAt'] = $updatedAt;
            $fileData[$targetId] = normalizeFolderContentPayload($existingFolder);
            $fileData[$targetId]['createdAt'] = $createdAt;
            $fileData[$targetId]['updatedAt'] = $updatedAt;
        }

        $fileData = normalizeFolderParentLinks($fileData);
        writeRawFolderMap($type, $fileData);
        syncManualOrderWithFolders($type, $fileData);
        try {
            appendDiagnosticsHistoryEvent('folder_settings_apply', $type, [
                'folderIds' => $normalizedTargetIds,
                'targetCount' => count($normalizedTargetIds),
                'backupName' => (string)($backup['name'] ?? ''),
                'sourceScript' => basename((string)($_SERVER['SCRIPT_NAME'] ?? ''))
            ], 'ok', 'server');
        } catch (Throwable $err) {
            // Keep apply flow non-fatal.
        }

        return [
            'updatedIds' => $normalizedTargetIds,
            'updatedCount' => count($normalizedTargetIds),
            'backup' => $backup,
            'settings' => $normalizedSettings
        ];
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
        writeRawFolderMap($type, $fileData);
        syncManualOrderWithFolders($type, $fileData);
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
            writeJsonObjectWithLastGood($prefsPath, defaultTypePrefs());
        }
    }
