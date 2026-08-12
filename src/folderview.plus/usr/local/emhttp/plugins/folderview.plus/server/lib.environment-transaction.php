<?php
function fvplusEnvironmentTransactionPaths(array $extraPaths = []): array {
    $paths = [];
    foreach (FVPLUS_ALLOWED_TYPES as $type) {
        foreach ([getFolderFilePath($type), getTypePrefsPath($type), getConfigMetadataPath($type)] as $path) {
            $paths[] = $path;
            $paths[] = getLastGoodJsonPath($path);
        }
    }
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
    $snapshots = [];
    foreach ($paths as $path) {
        $safePath = (string)$path;
        $snapshots[] = [
            'path' => $safePath,
            'exists' => is_file($safePath),
            'content' => is_file($safePath) ? (string)@file_get_contents($safePath) : ''
        ];
    }
    return $snapshots;
}

function fvplusEnvironmentRestoreFiles(array $snapshots): void {
    $errors = [];
    foreach ($snapshots as $snapshot) {
        $path = (string)($snapshot['path'] ?? '');
        if ($path === '') {
            continue;
        }
        try {
            if (!empty($snapshot['exists'])) {
                writeDurableFileAtomic($path, (string)($snapshot['content'] ?? ''));
            } elseif (file_exists($path) && !@unlink($path)) {
                throw new RuntimeException('Unable to remove newly-created transaction file.');
            }
        } catch (Throwable $error) {
            $errors[] = basename($path) . ': ' . $error->getMessage();
        }
    }
    if (count($errors) > 0) {
        throw new RuntimeException('Transaction rollback was incomplete: ' . implode('; ', $errors));
    }
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

function fvplusEnvironmentWriteTarget(array $normalized, array $options): array {
    $counts = [];
    foreach (FVPLUS_ALLOWED_TYPES as $type) {
        $entry = (array)($normalized['types'][$type] ?? []);
        $folders = (array)($entry['folders'] ?? []);
        $prefs = (array)($entry['prefs'] ?? defaultTypePrefs());
        writeRawFolderMap($type, $folders);
        fvplusEnvironmentTransactionStage($options, $type . '-folders');
        writeTypePrefs($type, $prefs);
        syncManualOrderWithFolders($type, $folders);
        fvplusEnvironmentTransactionStage($options, $type . '-prefs');
        $counts[$type] = count($folders);
    }
    $workspace = writeThemeWorkspace((array)($normalized['themeWorkspace'] ?? defaultThemeWorkspace()));
    fvplusEnvironmentTransactionStage($options, 'theme-workspace');
    if (($options['syncDockerOrder'] ?? true) !== false) {
        syncContainerOrder('docker');
        fvplusEnvironmentTransactionStage($options, 'docker-order');
    }
    $externalApply = $options['externalApply'] ?? null;
    if (is_callable($externalApply)) {
        $externalApply();
        fvplusEnvironmentTransactionStage($options, 'external');
    }
    return ['counts' => $counts, 'workspace' => $workspace];
}

function fvplusEnvironmentVerifyTarget(array $normalized): void {
    foreach (FVPLUS_ALLOWED_TYPES as $type) {
        $expected = (array)($normalized['types'][$type] ?? []);
        if (jsonObjectsDiffer(normalizeFolderMapPayload((array)($expected['folders'] ?? [])), readRawFolderMap($type))) {
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
    $normalized = normalizeEnvironmentSnapshotPayload($snapshot);
    $reason = trim((string)($options['reason'] ?? 'environment-import')) ?: 'environment-import';
    return withConfigMutationLock(static function() use ($normalized, $sourceName, $options, $reason): array {
        $rollback = createGlobalRollbackSnapshot('before-' . $reason);
        $typeResults = [];
        foreach (FVPLUS_ALLOWED_TYPES as $type) {
            $typeResults[$type] = ['backup' => createBackupSnapshot($type, 'transaction-' . $reason)];
        }
        $extraPaths = (array)($options['extraPaths'] ?? []);
        if (($options['syncDockerOrder'] ?? true) !== false) {
            $extraPaths[] = fvplusEnvironmentDockerAutostartPath();
        }
        $snapshots = fvplusEnvironmentCaptureFiles(fvplusEnvironmentTransactionPaths($extraPaths));
        try {
            fvplusEnvironmentTransactionStage($options, 'captured');
            $written = fvplusEnvironmentWriteTarget($normalized, $options);
            fvplusEnvironmentVerifyTarget($normalized);
            fvplusEnvironmentTransactionStage($options, 'verified');
            foreach (FVPLUS_ALLOWED_TYPES as $type) {
                $typeResults[$type]['folderCount'] = (int)($written['counts'][$type] ?? 0);
            }
        } catch (Throwable $error) {
            try {
                fvplusEnvironmentRestoreFiles($snapshots);
            } catch (Throwable $rollbackError) {
                throw new RuntimeException($error->getMessage() . ' ' . $rollbackError->getMessage(), 0, $error);
            }
            throw new RuntimeException($error->getMessage() . ' All changed configuration was restored.', 0, $error);
        }
        $summary = buildEnvironmentSnapshotSummary($normalized, $sourceName);
        $workspace = (array)$written['workspace'];
        return [
            'summary' => $summary,
            'types' => $typeResults,
            'rollback' => $rollback,
            'verified' => true,
            'themeWorkspace' => [
                'managedThemeCount' => count((array)($workspace['themes'] ?? [])),
                'activeThemeId' => trim((string)($workspace['activeThemeId'] ?? ''))
            ]
        ];
    });
}
