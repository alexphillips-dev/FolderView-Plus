<?php

require_once __DIR__ . '/lib.setup-assistant-rollback.php';

function restoreGlobalRollbackSnapshot(string $name, array $options = []): array {
    return withConfigMutationLock(static function () use ($name, $options): array {
        $guardedSetup = array_key_exists('setupFence', $options);
        if ($guardedSetup) {
            fvplusAssertSetupAssistantFence($name, $options['setupFence']);
            $options['syncDockerOrder'] = false;
        }
        $path = getGlobalRollbackSnapshotPath($name);
        if (!is_file($path)) throw new RuntimeException('Rollback snapshot file not found.');
        $decoded = fvplusValidateGlobalRollbackPayload(json_decode((string)@file_get_contents($path), true));
        $types = $decoded['types'];
        foreach (FVPLUS_ALLOWED_TYPES as $type) $types[$type]['prefs'] ??= readTypePrefs($type);
        // Older checkpoints can omit Theme Workspace; retain its current state in that adapter.
        $target = ['types' => $types, 'themeWorkspace' => $decoded['themeWorkspace'] ?? readThemeWorkspace()];
        $transaction = applyEnvironmentSnapshotTransaction($target, $name,
            array_merge($options, ['reason' => 'global-rollback', 'preserveRollbackNames' => [$name],
                'preserveHierarchy' => true,
                'nativeAutostart' => $guardedSetup ? null : ($decoded['nativeDockerAutostart'] ?? null),
                'nativeBatchWaits' => $guardedSetup ? null : ($decoded['nativeDockerBatchWaits'] ?? null)]));
        $counts = ['docker' => count($types['docker']['folders']), 'vm' => count($types['vm']['folders'])];
        try {
            appendDiagnosticsHistoryEvent('rollback_restore', null, [
                'name' => $name, 'dockerCount' => $counts['docker'], 'vmCount' => $counts['vm']
            ], 'ok', 'server');
        } catch (Throwable $error) { /* Optional history cannot change a committed restore. */ }
        return ['name' => $name, 'restoredAt' => gmdate('c'),
            'dockerCount' => $counts['docker'], 'vmCount' => $counts['vm'],
            'undoSnapshot' => (string)($transaction['rollback']['name'] ?? ''), 'verified' => true,
            ...(isset($transaction['dockerOrderSync']) ? ['dockerOrderSync' => $transaction['dockerOrderSync']] : [])];
    });
}

function fvplusRestoreSelectedGlobalRollbackSnapshot(bool $previous, ?string $expectedName): array {
    return withConfigMutationLock(static function () use ($previous, $expectedName): array {
        $snapshots = array_slice(listGlobalRollbackSnapshots(), $previous ? 1 : 0);
        foreach ($snapshots as $snapshot) {
            if (!$snapshot['restorable']) continue;
            $name = $snapshot['name'];
            if ($expectedName !== null && $name !== $expectedName) {
                throw new FVPlusConfigConflictException('Rollback restore failed.');
            }
            $restored = restoreGlobalRollbackSnapshot($name);
            return $previous ? [...$restored, 'targetName' => $name] : $restored;
        }
        throw new RuntimeException($previous ? 'No previous rollback snapshot available.' : 'No rollback snapshots available.');
    });
}

function restoreLatestGlobalRollbackSnapshot(?string $expectedName = null): array {
    return fvplusRestoreSelectedGlobalRollbackSnapshot(false, $expectedName);
}

function restorePreviousGlobalRollbackSnapshot(?string $expectedName = null): array {
    return fvplusRestoreSelectedGlobalRollbackSnapshot(true, $expectedName);
}
