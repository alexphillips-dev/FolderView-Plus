<?php
function restoreBackupSnapshot(string $type, string $name, array $options = []): array {
    $type = ensureType($type);
    return withConfigMutationLock(static function () use ($type, $name, $options): array {
        // Resolve and validate the target before creating or pruning any backup.
        $snapshot = readBackupSnapshot($type, $name);
        $folders = normalizeFolderMapPayload($snapshot['folders']);
        $prefs = reconcileManualOrderPrefs($snapshot['prefs'] ?? readTypePrefs($type), $folders);
        $paths = [];
        foreach ([getFolderFilePath($type), getTypePrefsPath($type), getConfigMetadataPath($type)] as $path) {
            $paths[] = $path;
            $paths[] = getLastGoodJsonPath($path);
        }
        if ($type === 'docker') $paths[] = fvplusEnvironmentDockerAutostartPath();
        $before = fvplusEnvironmentCaptureFiles($paths);
        $backup = ($options['createSafetyBackup'] ?? false) === true
            ? createBackupSnapshot($type, 'before-restore-' . bin2hex(random_bytes(6)), false)
            : null;
        try {
            writeRawFolderMap($type, $folders);
            fvplusEnvironmentTransactionStage($options, 'folders');
            writeTypePrefs($type, $prefs);
            fvplusEnvironmentTransactionStage($options, 'prefs');
            if ($type === 'docker') {
                syncContainerOrder('docker');
                fvplusEnvironmentTransactionStage($options, 'docker-order');
            }
            if (jsonObjectsDiffer($folders, readRawFolderMap($type)) || jsonObjectsDiffer($prefs, readTypePrefs($type))) {
                throw new RuntimeException('Restore failed.');
            }
        } catch (Throwable $error) {
            fvplusEnvironmentRestoreFiles($before);
            throw $error;
        }
        // The safety snapshot must remain usable even when restored retention is one.
        if (is_array($backup)) {
            $backup['pruned'] = pruneBackupSnapshots($type, getTypeBackupRetention($type), [$backup['name']]);
        }
        try {
            appendDiagnosticsHistoryEvent('backup_restore', $type, [
                'name' => $snapshot['name'], 'folderCount' => count($folders),
                'prefsRestored' => $snapshot['prefs'] !== null
            ], 'ok', 'server');
        } catch (Throwable $error) {
            // Optional history must not turn a committed restore into an error.
        }
        return [
            'name' => $snapshot['name'], 'restoredAt' => gmdate('c'), 'count' => count($folders),
            'prefsRestored' => $snapshot['prefs'] !== null, 'backup' => $backup
        ];
    });
}

function restoreLatestBackupSnapshot(string $type): array {
    $type = ensureType($type);
    return withConfigMutationLock(static function () use ($type): array {
        $snapshots = listBackupSnapshots($type);
        if (empty($snapshots)) throw new RuntimeException('No backups available.');
        foreach ($snapshots as $snapshot) {
            $count = $snapshot['count'] ?? null;
            if ($count !== null && (int)$count <= 0) continue;
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
            if (isUndoBackupReason((string)($snapshot['reason'] ?? ''))) {
                return restoreBackupSnapshot($type, (string)$snapshot['name']);
            }
        }
        throw new RuntimeException('No undo-capable backups found.');
    });
}
