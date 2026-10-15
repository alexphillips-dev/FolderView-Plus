<?php
namespace CaptureFault {
    // Evaluate the actual source unchanged in this namespace. Only these I/O
    // boundaries are injected; all other calls fall through to real PHP/plugin code.
    function file_get_contents(string $path) {
        if ($path === ($GLOBALS['capture_faults']['read'] ?? '')) {
            return !empty($GLOBALS['capture_faults']['partial']) ? substr(\file_get_contents($path), 0, 3) : false;
        }
        return \file_get_contents($path);
    }
    function lstat(string $path) {
        return $path === ($GLOBALS['capture_faults']['stat'] ?? '') ? false : \lstat($path);
    }
    function unlink(string $path): bool {
        return in_array($path, $GLOBALS['capture_faults']['unlink'] ?? [], true) ? false : \unlink($path);
    }
    function chmod(string $path, int $mode): bool {
        return in_array($path, $GLOBALS['capture_faults']['chmod'] ?? [], true) ? false : \chmod($path, $mode);
    }
    function writeDurableFileAtomic(string $path, string $content, array $options = []): array {
        if (in_array($path, $GLOBALS['capture_faults']['write'] ?? [], true)) {
            throw new \RuntimeException('Synthetic rollback write failure.');
        }
        return \writeDurableFileAtomic($path, $content, $options);
    }
    function writeThemeWorkspaceManagedAssetsUnprotected(array $workspace): void {
        \writeThemeWorkspaceManagedAssetsUnprotected($workspace);
        if (!empty($GLOBALS['capture_faults']['apply'])) throw new \RuntimeException('Synthetic original theme failure.');
    }
}
namespace {
    class DockerClient {
        public function getDockerContainers(): array { return []; }
        public function getDockerJSON(string $path): array { return []; }
    }
    $server = $argv[1]; $root = $argv[2];
    require "$server/lib.php";
    require "$server/lib.i18n.php";
    $request = json_decode(file_get_contents("$root/request.json"), true, 512, JSON_THROW_ON_ERROR);
    foreach (['lib.transaction-files.php', 'lib.environment-transaction.php', 'lib.theme-update-plan.php', 'lib.backup-restore.php', 'lib.folderview3-apply.php'] as $file) {
        if (!is_file("$server/$file")) continue;
        $source = file_get_contents("$server/$file");
        $source = str_replace('__DIR__', var_export($server, true), $source); // Preserve production-relative includes inside eval.
        eval('namespace CaptureFault; use \\RuntimeException; use \\Throwable;' . substr($source, 5));
    }
    function fixtureFiles(string $root): array {
        $files = [];
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));
        foreach ($iterator as $file) {
            if ($file->isLink() || !$file->isFile()) continue;
            // The native Windows lock handle denies reads from another handle.
            if ($file->getFilename() === '.config-mutation.lock') continue;
            $files[$file->getPathname()] = [base64_encode(file_get_contents($file->getPathname())), $file->getPerms() & 0777];
        }
        ksort($files);
        return $files;
    }
    $owner = $request['owner'];
    $capture = $owner === 'theme' ? static fn(array $paths): array => array_map('CaptureFault\\fvplusThemeUpdateCaptureFile', $paths)
        : 'CaptureFault\\fvplusEnvironmentCaptureFiles';
    $restore = $owner === 'theme' ? 'CaptureFault\\fvplusThemeUpdateRestoreFiles' : 'CaptureFault\\fvplusEnvironmentRestoreFiles';
    $operation = $request['operation'];
    $result = [];
    if (in_array($operation, ['failed-read', 'short-read', 'stat-failure', 'roundtrip', 'unsupported', 'rollback-errors'], true)) {
        $present = "$root/config/present"; $empty = "$root/config/empty"; $missing = "$root/config/missing";
        file_put_contents($present, "original\0bytes"); file_put_contents($empty, '');
        chmod($present, 0600); chmod($empty, 0640);
        if (in_array($operation, ['failed-read', 'short-read', 'stat-failure'], true)) {
            $GLOBALS['capture_faults'][$operation === 'stat-failure' ? 'stat' : 'read'] = $present;
            $GLOBALS['capture_faults']['partial'] = $operation === 'short-read';
            try { $snapshots = $capture([$present]); $result['rejected'] = false; }
            catch (Throwable $error) { $result = ['rejected' => true, 'error' => $error->getMessage()]; }
            if (isset($snapshots)) $restore($snapshots);
            $result['unchanged'] = file_get_contents($present) === "original\0bytes";
        } elseif ($operation === 'unsupported') {
            mkdir($missing);
            try { $capture([$missing]); $result['rejected'] = false; }
            catch (Throwable $error) { $result = ['rejected' => true, 'error' => $error->getMessage()]; }
        } elseif ($operation === 'roundtrip') {
            $before = fixtureFiles("$root/config");
            $snapshots = $capture([$present, $empty, $missing]);
            foreach ([$present, $empty, $missing] as $path) { file_put_contents($path, 'changed'); chmod($path, 0644); }
            $restore($snapshots); clearstatcache();
            $result = ['same' => $before === fixtureFiles("$root/config"), 'emptyExists' => is_file($empty),
                'emptyBytes' => file_get_contents($empty), 'missingExists' => file_exists($missing)];
        } else {
            $newA = "$root/config/new-a"; $newB = "$root/config/new-b";
            $modeFile = "$root/config/mode-file"; file_put_contents($modeFile, 'mode original');
            $snapshots = $capture([$newA, $newB, $present, $modeFile, $empty]);
            foreach ([$newA, $newB, $present, $modeFile, $empty] as $path) file_put_contents($path, 'changed');
            $GLOBALS['capture_faults'] = ['unlink' => [$newA, $newB], 'write' => [$present], 'chmod' => [$modeFile]];
            try { $restore($snapshots); $result['error'] = ''; }
            catch (Throwable $error) { $result['error'] = $error->getMessage(); }
            $result['continued'] = file_get_contents($empty) === '';
            $result['remaining'] = is_file($newA) && is_file($newB) && file_get_contents($present) === 'changed';
        }
    } else {
        foreach (['docker', 'vm'] as $type) {
            writeRawFolderMap($type, ['old' => ['name' => 'Old fixture']]);
            writeTypePrefs($type, ['dockerStartOrder' => ['mode' => 'unmanaged'], 'backupSchedule' => ['enabled' => false]]);
        }
        $workspace = defaultThemeWorkspace();
        $workspace['profiles'][0]['layers']['global']['customCss'] = '.old-fixture { opacity: .8; }';
        writeThemeWorkspace($workspace);
        file_put_contents(fvplusEnvironmentDockerAutostartPath(), "fixture-native 5\n");
        $backup = createBackupSnapshot('docker', 'fixture-target');
        $bundle = ['fv3_export_version' => 1, 'docker' => ['new' => ['name' => 'New fixture']], 'vm' => [],
            'settings' => [], 'css_config' => [], 'custom_styles' => [],
            'native_autostart' => ['fixture-native 10']];
        $digest = buildFolderView3MigrationPlan($bundle, 'fixture.json')['source']['digest'];
        $target = normalizeEnvironmentSnapshotPayload(['types' => ['docker' => ['folders' => ['new' => ['name' => 'New fixture']]],
            'vm' => ['folders' => []]], 'themeWorkspace' => $workspace]);
        $target['themeWorkspace']['profiles'][0]['layers']['global']['customCss'] = '.new-fixture { opacity: .7; }';
        acquireConfigMutationLock();
        $paths = fvplusEnvironmentTransactionPaths([fvplusEnvironmentDockerAutostartPath()]);
        foreach ($paths as $path) if (is_file($path)) chmod($path, 0600);
        clearstatcache();
        if (!empty($request['legacyWorkspace'])) {
            $legacy = ['variables' => [], 'customCss' => '.legacy-fixture { opacity: .5; }'];
            writeJsonObjectWithLastGood(getThemeWorkspacePath(), $legacy);
        }
        $before = fixtureFiles("$root/config");
        $vmBefore = file_get_contents(getFolderFilePath('vm'));
        $GLOBALS['capture_faults']['read'] = strpos($owner, 'theme') === 0 ? fvplusThemeWorkspaceGeneratedCssPath('vm') : getFolderFilePath('docker');
        if ($operation === 'entry-rollback') {
            $GLOBALS['capture_faults'] = ['write' => [getFolderFilePath('docker')], 'apply' => $owner === 'theme'];
            if ($owner === 'theme') $GLOBALS['capture_faults']['write'] = [fvplusThemeWorkspaceGeneratedCssPath('docker')];
        }
        $stages = [];
        $options = ['syncDockerOrder' => false, 'createSafetyBackup' => true, 'afterStage' => static function(string $stage) use (&$stages, $operation): void {
            $stages[] = $stage;
            if ($operation === 'entry-rollback' && in_array($stage, ['docker-prefs', 'prefs'], true)) {
                throw new RuntimeException('Synthetic original apply failure.');
            }
        }];
        try {
            if ($owner === 'theme') CaptureFault\fvplusThemeWorkspaceApplyAtomic($target['themeWorkspace']);
            elseif ($owner === 'theme-assets') CaptureFault\fvplusThemeWorkspaceApplyAtomic($target['themeWorkspace'], false);
            elseif ($owner === 'restore') CaptureFault\restoreBackupSnapshot('docker', $backup['name'], $options);
            elseif ($owner === 'migration') CaptureFault\applyFolderView3Migration($bundle, 'fixture.json', $digest, true, $options);
            else CaptureFault\applyEnvironmentSnapshotTransaction($target, 'fixture', $options);
            $result['rejected'] = false;
        } catch (Throwable $error) {
            $result = ['rejected' => true, 'error' => $error->getMessage(), 'previous' => $error->getPrevious() ? $error->getPrevious()->getMessage() : ''];
        }
        clearstatcache();
        $result['unchanged'] = $before === fixtureFiles("$root/config");
        $withoutDiagnostics = static fn(array $files): array => array_filter($files, static fn($path): bool => !str_contains($path, 'diagnostics.history.json'), ARRAY_FILTER_USE_KEY);
        $result['protectedUnchanged'] = $withoutDiagnostics($before) === $withoutDiagnostics(fixtureFiles("$root/config"));
        $result['diagnosticEvents'] = readDiagnosticsHistoryEvents(20);
        $result['stages'] = $stages;
        $result['nativeUnchanged'] = file_get_contents(fvplusEnvironmentDockerAutostartPath()) === "fixture-native 5\n";
        $result['vmRestored'] = file_get_contents(getFolderFilePath('vm')) === $vmBefore;
    }
    if (isset($result['error'])) $result['translation'] = fvplus_localize_response_keys(['error' => $result['error']]);
    echo json_encode($result, JSON_THROW_ON_ERROR);
}
