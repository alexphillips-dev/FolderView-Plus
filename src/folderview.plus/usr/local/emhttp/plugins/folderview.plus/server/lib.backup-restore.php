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
        $folders = normalizeFolderMapPayload($snapshot['folders']);
        $before = fvplusEnvironmentCaptureFiles(fvplusTypeTransactionPaths($type));
        try {
            $prefs = $editorUndo ? readTypePrefs($type) : reconcileManualOrderPrefs($snapshot['prefs'] ?? readTypePrefs($type), $folders);
            $backup = $editorUndo || ($options['createSafetyBackup'] ?? false) === true
                ? createBackupSnapshot($type, 'before-restore-' . bin2hex(random_bytes(6)), false)
                : null;
            writeRawFolderMap($type, $folders);
            fvplusEnvironmentTransactionStage($options, 'folders');
            if (!$editorUndo) {
                writeTypePrefs($type, $prefs);
                fvplusEnvironmentTransactionStage($options, 'prefs');
            }
            if ($type === 'docker') {
                syncContainerOrder('docker');
                fvplusEnvironmentTransactionStage($options, 'docker-order');
            }
            if (jsonObjectsDiffer($folders, readRawFolderMap($type)) || jsonObjectsDiffer($prefs, readTypePrefs($type))) {
                throw new RuntimeException('Restore failed.');
            }
        } catch (Throwable $error) {
            fvplusTransactionRestoreAfterFailure($before, $error, static function(array $files): void { fvplusEnvironmentRestoreFiles($files); });
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
            'prefsRestored' => !$editorUndo && $snapshot['prefs'] !== null, 'backup' => $backup
        ];
    });
}

function restoreLatestBackupSnapshot(string $type): array {
    $type = ensureType($type);
    return withConfigMutationLock(static function () use ($type): array {
        $snapshots = listBackupSnapshots($type);
        if (empty($snapshots)) throw new RuntimeException('No backups available.');
        foreach ($snapshots as $snapshot) {
            if (($snapshot['count'] ?? 0) <= 0) continue;
            return restoreBackupSnapshot($type, (string)$snapshot['name'], ['createSafetyBackup' => true]);
        }
        throw new RuntimeException('No non-empty backups available.');
    });
}

function isUndoBackupReason(string $reason): bool {
    $normalized = strtolower(trim($reason));
    return strpos($normalized, 'before-') === 0
        || strpos($normalized, 'pre-') === 0
        || strpos($normalized, 'undo-') === 0
        || strpos($normalized, 'transaction-') === 0;
}

function restoreLatestUndoBackupSnapshot(string $type): array {
    $type = ensureType($type);
    return withConfigMutationLock(static function () use ($type): array {
        foreach (listBackupSnapshots($type) as $snapshot) {
            if (!isset($snapshot['count']) || !isUndoBackupReason((string)($snapshot['reason'] ?? ''))) continue;
            return restoreBackupSnapshot($type, (string)$snapshot['name']);
        }
        throw new RuntimeException('No undo-capable backups found.');
    });
}
