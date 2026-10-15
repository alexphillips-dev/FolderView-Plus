<?php
$root = $argv[1]; $server = $argv[2];
$request = json_decode(file_get_contents($root . '/request.json'), true, 512, JSON_THROW_ON_ERROR);
foreach (['config', 'source', 'host', 'legacy'] as $directory) mkdir($root . '/' . $directory, 0770, true);
foreach (['CONFIG_DIR' => 'config', 'STORAGE_DIR' => 'config', 'SOURCE_DIR' => 'source', 'FOLDER_VIEW3_CONFIG_DIR' => 'legacy'] as $key => $directory) putenv('FVPLUS_TEST_' . $key . '=' . $root . '/' . $directory);
putenv('FVPLUS_TEST_DOCKER_AUTOSTART_FILE=' . $root . '/config/native-autostart');
$_SERVER['DOCUMENT_ROOT'] = $root . '/host';
require $server . '/lib.php';
require_once $server . '/lib.validation.php';
function migrationFiles(string $root): array {
    $files = [];
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));
    foreach ($iterator as $entry) if ($entry->isFile()) $files[str_replace('\\', '/', substr($entry->getPathname(), strlen($root) + 1))] = hash_file('sha256', $entry->getPathname());
    ksort($files); return $files;
}
if (($request['seed'] ?? true) !== false) {
    foreach (['docker', 'vm'] as $type) {
        writeRawFolderMap($type, ['original' => ['name' => 'Original fixture', 'containers' => ['original-member']]]);
        writeTypePrefs($type, array_replace(defaultTypePrefs(), ['liveRefreshEnabled' => true]));
    }
    writeThemeWorkspace(defaultThemeWorkspace());
}
if (isset($request['workspace'])) writeJsonObjectWithLastGood(getThemeWorkspacePath(), $request['workspace']);
if (!empty($request['corruptWorkspace'])) file_put_contents(getThemeWorkspacePath(), '{invalid');
$before = migrationFiles($root . '/config');
$operation = $request['operation'] ?? 'plan'; $bundle = $request['bundle'];
try {
    $bundle = decodeFolderView3BundlePayloadString($request['raw'] ?? json_encode($bundle, JSON_THROW_ON_ERROR));
    $plan = buildFolderView3MigrationPlan($bundle, 'synthetic.json');
    $result = ['plan' => $plan, 'report' => folderView3MigrationReport($plan)];
    if (isset($request['inventory'])) {
        require __DIR__ . '/folderview3-upstream-membership.php';
        $labels = array_map(static fn(array $info): string => getFolderLabelValueFromLabels(dockerInfoLabelsForName(['item' => $info], 'item')), $request['inventory']);
        $result['legacyMembership'] = fv3_compute_folder_membership($bundle['docker'], array_keys($request['inventory']), $labels)['containers'];
        $result['membership'] = buildLegacyFolderMembership($plan['target']['types']['docker']['folders'], array_keys($request['inventory']), $request['inventory'], 'docker', $plan['target']['types']['docker']['prefs']['autoRules']);
    }
    if (in_array($operation, ['installed', 'installed-stale'], true)) {
        foreach (['docker', 'vm', 'settings', 'autostart', 'css_config'] as $key) {
            if (isset($bundle[$key])) file_put_contents($root . '/legacy/' . ($key === 'css_config' ? 'css-config' : $key) . '.json', json_encode($bundle[$key]));
        }
        $first = buildFolderView3MigrationPlan(fvplusFolderView3ReadInstalledBundle());
        usleep(1100000);
        $second = buildFolderView3MigrationPlan(fvplusFolderView3ReadInstalledBundle());
        $result['stableDigest'] = $first['source']['digest'] === $second['source']['digest'];
        if ($operation === 'installed-stale') { file_put_contents($root . '/legacy/settings.json', '{"default_preview":"0"}'); $before = migrationFiles($root . '/config'); }
        $result['applied'] = applyFolderView3Migration(fvplusFolderView3ReadInstalledBundle(), 'installed', $first['source']['digest']);
    } elseif ($operation === 'stale') {
        writeRawFolderMap('docker', ['concurrent' => ['name' => 'Concurrent fixture']]);
        $before = migrationFiles($root . '/config');
        applyFolderView3Migration($bundle, 'synthetic.json', $plan['source']['digest']);
    } elseif (in_array($operation, ['apply', 'repeat', 'failure', 'editor', 'verification-failure', 'rollback-failure', 'diagnostics-failure', 'observer-failure'], true)) {
        $options = ['afterStage' => static function(string $stage) use ($operation): void {
            if ($operation === 'verification-failure' && $stage === 'theme-workspace') writeRawFolderMap('docker', []);
            if ($operation === 'rollback-failure' && $stage === 'vm-prefs') { $path = getFolderFilePath('docker'); unlink($path); mkdir($path); throw new RuntimeException('Fixture rollback failure'); }
            if ($operation === 'failure' && $stage === 'vm-prefs') throw new RuntimeException('Fixture failure');
        }];
        if ($operation === 'diagnostics-failure') mkdir(diagnosticsHistoryPath());
        if ($operation === 'observer-failure') {
            $result['applied'] = ['transaction' => applyEnvironmentSnapshotTransaction($plan['target'], '', ['onOutcome' => static function(): void { throw new RuntimeException('Observer failure'); }])];
        } else $result['applied'] = applyFolderView3Migration($bundle, 'synthetic.json', $plan['source']['digest'], false, $options);
        $first = [readRawFolderMap('docker'), readRawFolderMap('vm'), readTypePrefs('docker'), readTypePrefs('vm'), readThemeWorkspace()];
        if ($operation === 'repeat') {
            $next = buildFolderView3MigrationPlan($bundle);
            applyFolderView3Migration($bundle, 'synthetic.json', $next['source']['digest']);
            $result['repeatEqual'] = !jsonObjectsDiffer($first, [readRawFolderMap('docker'), readRawFolderMap('vm'), readTypePrefs('docker'), readTypePrefs('vm'), readThemeWorkspace()]);
        }
        if ($operation === 'editor') {
            $folder = readRawFolderMap('vm')['lab']; unset($folder['memberIdentities'], $folder['membershipPolicy']);
            updateFolder('vm', json_encode($folder), 'lab', readConfigMetadata('vm', true)['folderRevision']);
        }
        $result['stored'] = [readRawFolderMap('docker'), readRawFolderMap('vm'), readTypePrefs('docker'), readTypePrefs('vm'), readThemeWorkspace()];
        if (isset($request['inventory'])) $result['startOrderContext'] = buildDockerStartOrderContext($request['inventory']);
    }
    $result['error'] = '';
} catch (Throwable $error) { $result = ['error' => $error->getMessage()]; }
$after = migrationFiles($root . '/config');
// Transaction-created backups/history are intentionally retained after compensation.
$protected = static fn(array $files): array => array_filter($files, static fn($key): bool => !str_contains($key, 'backup') && !str_contains($key, 'rollback') && !str_contains($key, 'history') && !str_ends_with($key, '.lock'), ARRAY_FILTER_USE_KEY);
$result['unchanged'] = $before === $after;
$result['protectedUnchanged'] = $protected($before) === $protected($after);
$result['before'] = $before; $result['after'] = $after;
$result['diagnosticEvents'] = readDiagnosticsHistoryEvents(20);
if (!empty($request['includeSupportBundle'])) {
    $redactor = diagnosticsCreateSupportBundleRedactor('sanitized');
    $result['supportBundleHistory'] = diagnosticsBuildSupportBundleHealthAndHistorySection(['importExportHistory' => ['events' => $result['diagnosticEvents']]], [], $redactor);
}
echo json_encode($result, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
