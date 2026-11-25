<?php
require_once __DIR__ . '/lib.recovery-native-transaction.php';

function fvplusTypeTransactionPaths(string $type, bool $includeNative = true): array {
    $type = ensureType($type);
    $paths = [getLegacyMigrationMarkerPath($type, 'folders'), getLegacyMigrationMarkerPath($type, 'prefs')];
    foreach ([getFolderFilePath($type), getTypePrefsPath($type), getConfigMetadataPath($type)] as $path) {
        $paths[] = $path; $paths[] = getLastGoodJsonPath($path);
    }
    if ($includeNative && $type === 'docker') $paths[] = fvplusEnvironmentDockerAutostartPath();
    return $paths;
}

function fvplusEnvironmentTransactionPaths(array $extraPaths = []): array {
    $paths = array_merge(...array_map(static fn(string $type): array => fvplusTypeTransactionPaths($type, false), FVPLUS_ALLOWED_TYPES));
    $workspacePath = getThemeWorkspacePath();
    $paths[] = $workspacePath;
    $paths[] = getLastGoodJsonPath($workspacePath);
    foreach (['docker', 'vm', 'dashboard'] as $scope) {
        $paths[] = fvplusThemeWorkspaceGeneratedCssPath($scope);
    }
    foreach ($extraPaths as $path) {
        $safePath = trim((string)$path);
        if ($safePath !== '') {
            $paths[] = $safePath;
        }
    }
    return array_values(array_unique($paths));
}

function fvplusEnvironmentCaptureFiles(array $paths): array {
    return array_values(array_map(static fn($path): array => fvplusTransactionCaptureFile((string)$path), $paths));
}

function fvplusEnvironmentRestoreFiles(array $snapshots): void {
    fvplusTransactionRestoreFiles($snapshots);
}

function fvplusEnvironmentTransactionStage(array $options, string $stage): void {
    $callback = $options['afterStage'] ?? null;
    if (is_callable($callback)) {
        $callback($stage);
    }
}

function fvplusEnvironmentDockerAutostartPath(): string {
    $testPath = PHP_SAPI === 'cli' ? trim((string)getenv('FVPLUS_TEST_DOCKER_AUTOSTART_FILE')) : '';
    if ($testPath !== '') {
        return $testPath;
    }
    $dockerMan = @parse_ini_file('/boot/config/plugins/dockerMan/dockerMan.cfg') ?: [];
    return (string)($dockerMan['autostart-file'] ?? '/var/lib/docker/unraid-autostart');
}

function fvplusEnvironmentWriteTarget(array $normalized, array $options, array $nativeFiles, callable $onWrite): array {
    $counts = [];
    foreach (FVPLUS_ALLOWED_TYPES as $type) {
        $folders = $normalized['types'][$type]['folders'];
        $prefs = $normalized['types'][$type]['prefs'];
        fvplusWriteConfigPayload($type, 'folder', getFolderFilePath($type), $folders);
        fvplusEnvironmentTransactionStage($options, $type . '-folders');
        writeTypePrefs($type, $prefs);
        fvplusEnvironmentTransactionStage($options, $type . '-prefs');
        $counts[$type] = count($folders);
    }
    $workspace = writeThemeWorkspace((array)($normalized['themeWorkspace'] ?? defaultThemeWorkspace()));
    fvplusEnvironmentTransactionStage($options, 'theme-workspace');
    $dockerOrderSync = fvplusApplyRecoveryNativeState($nativeFiles, $options, $onWrite);
    return ['counts' => $counts, 'workspace' => $workspace, 'dockerOrderSync' => $dockerOrderSync];
}

function fvplusEnvironmentVerifyTarget(array $normalized, bool $preserveHierarchy): void {
    foreach (FVPLUS_ALLOWED_TYPES as $type) {
        $expected = (array)($normalized['types'][$type] ?? []);
        $storedFolders = $preserveHierarchy ? readFolderMapForTreeIntegrity($type) : readRawFolderMap($type);
        if (jsonObjectsDiffer($expected['folders'], $storedFolders)) {
            throw new RuntimeException("Environment transaction verification failed for $type folders.");
        }
        if (jsonObjectsDiffer(normalizeTypePrefs((array)($expected['prefs'] ?? [])), readTypePrefs($type))) {
            throw new RuntimeException("Environment transaction verification failed for $type preferences.");
        }
    }
    if (jsonObjectsDiffer(normalizeThemeWorkspacePayload($normalized['themeWorkspace'] ?? []), readThemeWorkspace())) {
        throw new RuntimeException('Environment transaction verification failed for Theme Workspace.');
    }
}

function applyEnvironmentSnapshotTransaction(array $snapshot, string $sourceName = '', array $options = []): array {
    // Only the adapter for stored rollback checkpoints requests preservation of saved links.
    $preserveHierarchy = ($options['preserveHierarchy'] ?? false) === true;
    $normalized = normalizeEnvironmentSnapshotPayload($snapshot, $preserveHierarchy);
    $reason = trim((string)($options['reason'] ?? 'environment-import')) ?: 'environment-import';
    return withConfigMutationLock(static function() use ($normalized, $sourceName, $options, $reason, $preserveHierarchy): array {
        $phase = 'capture'; $checkpointAvailable = false;
        $notify = static function(string $rollback = 'not-needed') use ($options, &$phase, &$checkpointAvailable): void {
            try {
                if (is_callable($options['onOutcome'] ?? null)) $options['onOutcome'](['phase' => $phase, 'rollback' => $rollback, 'checkpointAvailable' => $checkpointAvailable]);
            } catch (Throwable $diagnosticsError) { /* Diagnostics must never affect a transaction. */ }
        };
        if (is_callable($options['beforeWrite'] ?? null)) $options['beforeWrite']();
        $notify();
        $snapshots = fvplusEnvironmentCaptureFiles(fvplusEnvironmentTransactionPaths());
        $nativeFiles = fvplusRecoveryCaptureNativeFiles($options);
        $nativeWrites = [];
        $recordNativeWrite = fvplusTransactionRecordFileWrites($nativeWrites);
        $typeResults = [];
        try {
            fvplusEnvironmentTransactionStage($options, 'captured');
            $rollback = createGlobalRollbackSnapshot('before-' . $reason, [], false,
                $nativeFiles['autostart']['before'] ?? null, $nativeFiles['batchWaits']['before'] ?? null);
            $checkpointAvailable = true;
            $retention = [];
            foreach (FVPLUS_ALLOWED_TYPES as $type) {
                $retention[$type] = getTypeBackupRetention($type);
                $typeResults[$type] = ['backup' => createBackupSnapshot($type, 'transaction-' . $reason, false)];
            }
            $phase = 'writing'; $notify();
            $written = fvplusEnvironmentWriteTarget($normalized, $options, $nativeFiles, $recordNativeWrite);
            $phase = 'verification'; $notify();
            fvplusEnvironmentVerifyTarget($normalized, $preserveHierarchy);
            foreach ($nativeFiles as ['target' => $target]) fvplusVerifyNativeAutostartTarget($target['path'], $target);
            fvplusEnvironmentTransactionStage($options, 'verified');
        } catch (Throwable $error) {
            try {
                fvplusEnvironmentRestoreFiles(array_merge($snapshots, array_values($nativeWrites)));
            } catch (Throwable $rollbackError) {
                $notify('failed');
                throw new RuntimeException($error->getMessage() . ' ' . $rollbackError->getMessage(), 0, $error);
            }
            foreach ($typeResults as $type => $result) {
                if (isset($result['backup']['name'])) @unlink(getBackupSnapshotPath($type, $result['backup']['name']));
            }
            $notify('complete');
            throw new RuntimeException($error->getMessage() . ' All changed configuration was restored.', 0, $error);
        }
        $protected = array_merge((array)($options['preserveRollbackNames'] ?? []), [$rollback['name']]);
        $rollback['pruned'] = pruneGlobalRollbackSnapshots(FVPLUS_GLOBAL_ROLLBACK_HISTORY_MAX, $protected);
        foreach (FVPLUS_ALLOWED_TYPES as $type) {
            $backup = $typeResults[$type]['backup'];
            $backup['pruned'] = pruneBackupSnapshots($type, $retention[$type], [$backup['name']]);
            $typeResults[$type] = ['backup' => $backup, 'folderCount' => (int)($written['counts'][$type] ?? 0)];
        }
        $phase = 'verified'; $notify();
        $summary = buildEnvironmentSnapshotSummary($normalized, $sourceName);
        $workspace = (array)$written['workspace'];
        return [
            'summary' => $summary,
            'types' => $typeResults,
            'rollback' => $rollback,
            'verified' => true,
            ...($written['dockerOrderSync'] !== null ? ['dockerOrderSync' => $written['dockerOrderSync']] : []),
            'themeWorkspace' => [
                'managedThemeCount' => count((array)($workspace['themes'] ?? [])),
                'activeThemeId' => trim((string)($workspace['activeThemeId'] ?? ''))
            ]
        ];
    });
}
