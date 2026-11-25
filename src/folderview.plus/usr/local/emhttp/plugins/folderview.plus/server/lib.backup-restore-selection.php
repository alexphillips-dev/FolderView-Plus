<?php
function restoreLatestBackupSnapshot(string $type, ?string $expectedName = null, ?string $reviewHash = null): array {
    $type = ensureType($type);
    return withConfigMutationLock(static function () use ($type, $expectedName, $reviewHash): array {
        $snapshots = listBackupSnapshots($type, $reviewHash !== null);
        foreach ($snapshots as $snapshot) {
            if (($snapshot['count'] ?? 0) <= 0) continue;
            if (($expectedName !== null && $snapshot['name'] !== $expectedName)
                || ($reviewHash !== null && !hash_equals($snapshot['reviewHash'], $reviewHash))) {
                throw new FVPlusConfigConflictException('The selected backup changed. Refresh and try again.');
            }
            return restoreBackupSnapshot($type, (string)$snapshot['name'], ['createSafetyBackup' => true, 'reviewHash' => $reviewHash]);
        }
        throw new RuntimeException($snapshots === [] ? 'No backups available.' : 'No non-empty backups available.');
    });
}

function isUndoBackupReason(string $reason): bool {
    return preg_match('/^(before|pre|undo|transaction)-/', strtolower(trim($reason))) === 1;
}

function fvplusBackupUndoCurrentState(string $type): array {
    $metadata = readConfigMetadata($type, true, false);
    return [
        'folderRevision' => $metadata['folderRevision'], 'folderSha256' => $metadata['folderSha256'],
        'prefsRevision' => $metadata['prefsRevision'], 'prefsSha256' => $metadata['prefsSha256'],
        'templatesSha256' => hash('sha256', json_encode(readFolderTemplates($type, normalize: false), JSON_THROW_ON_ERROR))
    ];
}

function restoreLatestUndoBackupSnapshot(string $type): array {
    $type = ensureType($type);
    return withConfigMutationLock(static function () use ($type): array {
        $snapshots = listBackupSnapshots($type, true);
        $cursor = readJsonObjectFile(getBackupsDirPath() . "/.$type-undo.json");
        $consumed = isset($cursor['state']) && $cursor['state'] === fvplusBackupUndoCurrentState($type)
            ? array_intersect_assoc(array_filter((array)($cursor['checkpoints'] ?? []), 'is_string'),
                array_column($snapshots, 'reviewHash', 'name')) : [];
        foreach ($snapshots as $snapshot) {
            $name = $snapshot['name'];
            if (!isset($snapshot['count']) || !isUndoBackupReason($snapshot['reason']) || isset($consumed[$name])) continue;
            $consumed[$name] = $snapshot['reviewHash'];
            if (fvplusRestoreSafetyBackupMatchesCurrent($type, readBackupSnapshot($type, $name, $snapshot['reviewHash']))) continue;
            // A subsequent Undo continues past the consumed snapshots unless configuration changed again.
            return restoreBackupSnapshot($type, $name, ['undoBackups' => $consumed, 'reviewHash' => $snapshot['reviewHash']]);
        }
        throw new RuntimeException('No undo-capable backups found.');
    });
}
