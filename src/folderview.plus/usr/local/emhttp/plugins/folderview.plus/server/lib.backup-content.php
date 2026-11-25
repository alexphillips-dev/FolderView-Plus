<?php
// Preserve folder/list order; only scheduler bookkeeping is excluded from recovery content.
function backupConfigurationFingerprint(array $folders, array $prefs): string {
    unset($prefs['backupSchedule']['lastRunAt']);
    return hash('sha256', json_encode(['folders' => $folders, 'prefs' => $prefs], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
}

function latestBackupConfiguration(string $type): ?array {
    $type = ensureType($type);
    foreach (listBackupSnapshots($type) as $backup) {
        if (!isset($backup['count'])) continue;
        $payload = readJsonObjectFile(getBackupSnapshotPath($type, $backup['name']));
        if (!is_array($payload) || ($payload['schemaVersion'] ?? null) !== FVPLUS_EXPORT_SCHEMA_VERSION
            || ($payload['type'] ?? '') !== $type || ($payload['mode'] ?? '') !== 'full'
            || !is_array($payload['folders'] ?? null) || !is_array($payload['prefs'] ?? null)) continue;
        try {
            return [...$backup, 'fingerprint' => backupConfigurationFingerprint($payload['folders'], $payload['prefs'])];
        } catch (JsonException $error) {
            continue;
        }
    }
    return null;
}
