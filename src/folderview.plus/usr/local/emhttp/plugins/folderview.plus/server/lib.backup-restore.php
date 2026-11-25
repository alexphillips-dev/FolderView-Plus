<?php
function restoreBackupSnapshot(string $type, string $name, array $options = []): array {
    $type = ensureType($type);
    return withConfigMutationLock(static function () use ($type, $name, $options): array {
        // Resolve and validate the target before creating or pruning any backup.
        $snapshot = readBackupSnapshot($type, $name);
        $editorUndo = isset($options['expectedFolderRevision']);
        if ($editorUndo && ($snapshot['reason'] !== 'before-folder-editor-bulk-move'
            || ($snapshot['configurationMetadata']['folderRevision'] ?? null) !== $options['expectedFolderRevision'] - 1)) {
            throw new FVPlusConfigConflictException('Undo failed.');
        }
        if ($editorUndo) assertExpectedConfigRevision($type, 'folder', $options['expectedFolderRevision']);
        $preserveHierarchy = !$editorUndo && ($snapshot['preserveHierarchy'] ?? false) === true;
        $folders = normalizeFolderMapPayload($snapshot['folders'], !$preserveHierarchy);
        $templates = $editorUndo ? null : ($snapshot['templates'] ?? null);
        $templatePath = getTemplatePath($type);
        $undoPath = getBackupsDirPath() . "/.$type-undo.json";
        $undoBackups = $options['undoBackups'] ?? null;
        $paths = fvplusTypeTransactionPaths($type);
        if ($templates !== null) array_push($paths, $templatePath, getLastGoodJsonPath($templatePath));
        if ($undoBackups !== null) $paths[] = $undoPath;
        $before = fvplusEnvironmentCaptureFiles($paths);
        try {
            $prefs = $editorUndo ? readTypePrefs($type) : reconcileManualOrderPrefs($snapshot['prefs'] ?? readTypePrefs($type), $folders);
            $backup = null;
            if ($editorUndo || ($options['createSafetyBackup'] ?? false) === true) {
                $backupOptions = ['preserveHierarchy' => $preserveHierarchy];
                if ($templates !== null) {
                    $backupOptions['templateRecords'] = readFolderTemplates($type, requireAvailable: true, normalize: false);
                }
                $backup = createBackupSnapshot($type, 'before-restore-' . bin2hex(random_bytes(6)), false, $backupOptions);
            }
            if ($preserveHierarchy) fvplusWriteConfigPayload($type, 'folder', getFolderFilePath($type), $folders);
            else writeRawFolderMap($type, $folders);
            fvplusEnvironmentTransactionStage($options, 'folders');
            if (!$editorUndo) {
                writeTypePrefs($type, $prefs);
                fvplusEnvironmentTransactionStage($options, 'prefs');
            }
            if ($templates !== null) {
                fvplusWriteBackupTemplateRecords($type, $templates);
                fvplusEnvironmentTransactionStage($options, 'templates');
            }
            if ($type === 'docker') {
                syncContainerOrder('docker');
                fvplusEnvironmentTransactionStage($options, 'docker-order');
            }
            $savedFolders = $preserveHierarchy ? readFolderMapForTreeIntegrity($type) : readRawFolderMap($type);
            if (jsonObjectsDiffer($folders, $savedFolders) || jsonObjectsDiffer($prefs, readTypePrefs($type))
                || ($templates !== null && ($templates !== readFolderTemplateFile($templatePath)
                    || $templates !== readFolderTemplateFile(getLastGoodJsonPath($templatePath))))) {
                throw new RuntimeException('Restore failed.');
            }
            if ($undoBackups !== null) {
                writeJsonObjectAtomic($undoPath, ['state' => fvplusBackupUndoCurrentState($type), 'checkpoints' => $undoBackups]);
            }
        } catch (Throwable $error) {
            fvplusTransactionRestoreAfterFailure($before, $error, static function(array $files): void { fvplusEnvironmentRestoreFiles($files); });
            if (isset($backup['name'])) @unlink(getBackupSnapshotPath($type, $backup['name']));
            throw $error;
        }
        // The safety snapshot must remain usable even when restored retention is one.
        if (is_array($backup)) {
            $backup['pruned'] = pruneBackupSnapshots($type, getTypeBackupRetention($type), [$backup['name']]);
        }
        try {
            appendDiagnosticsHistoryEvent('backup_restore', $type, [
                'name' => $snapshot['name'], 'folderCount' => count($folders),
                'prefsRestored' => !$editorUndo && $snapshot['prefs'] !== null
            ], 'ok', 'server');
        } catch (Throwable $error) {
            // Optional history must not turn a committed restore into an error.
        }
        return [
            'name' => $snapshot['name'], 'restoredAt' => gmdate('c'), 'count' => count($folders),
            'prefsRestored' => !$editorUndo && $snapshot['prefs'] !== null, 'backup' => $backup,
            ...($templates === null ? [] : ['templatesRestored' => true])
        ];
    });
}

require_once __DIR__ . '/lib.backup-restore-selection.php';
