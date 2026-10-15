<?php
// Synthetic HTTP host: production endpoint and storage, with a test-only authentication adapter.
$root = $argv[1]; $server = $argv[2];
$request = json_decode(file_get_contents($root . '/request.json'), true, 512, JSON_THROW_ON_ERROR);
foreach (['config', 'source', 'host'] as $directory) if (!is_dir($root . '/' . $directory)) mkdir($root . '/' . $directory, 0770, true);
foreach (['CONFIG_DIR' => 'config', 'STORAGE_DIR' => 'config', 'SOURCE_DIR' => 'source'] as $key => $directory) putenv('FVPLUS_TEST_' . $key . '=' . $root . '/' . $directory);
putenv('FVPLUS_TEST_DOCKER_AUTOSTART_FILE=' . $root . '/config/native-autostart');
$_SERVER['DOCUMENT_ROOT'] = $root . '/host';
$_SERVER['REQUEST_METHOD'] = 'POST';
$_SERVER['SCRIPT_NAME'] = '/plugins/folderview.plus/server/environment_snapshot.php';
require $server . '/lib.php';
if (!file_exists($root . '/initialized')) {
    foreach (['docker', 'vm'] as $type) { writeRawFolderMap($type, ['original' => ['name' => 'Original synthetic folder']]); writeTypePrefs($type, defaultTypePrefs()); }
    writeThemeWorkspace(defaultThemeWorkspace()); file_put_contents($root . '/initialized', '1');
}
if (($request['action'] ?? '') === 'fixture_read') {
    echo json_encode(['docker' => readRawFolderMap('docker'), 'vm' => readRawFolderMap('vm'), 'prefs' => readTypePrefs('docker'), 'workspace' => readThemeWorkspace()], JSON_THROW_ON_ERROR); return;
}
if (($request['action'] ?? '') === 'fixture_history') { echo json_encode(['events' => readDiagnosticsHistoryEvents(20)], JSON_THROW_ON_ERROR); return; }
$GLOBALS['fvplusMutationGuardComplete'] = true;
$_REQUEST = $_POST = $request;
$endpoint = file_get_contents($server . '/environment_snapshot.php');
$endpoint = str_replace('require_once("/usr/local/emhttp/plugins/folderview.plus/server/lib.php");', '', $endpoint);
eval('?>' . $endpoint);
