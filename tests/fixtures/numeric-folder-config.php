<?php

$server = str_replace('\\', '/', $argv[1]);
$_SERVER['DOCUMENT_ROOT'] = $argv[2] . '/host';
define('FVPLUS_CONFIG_ONLY_BOOTSTRAP', true);
require "$server/lib.php";

function numericFolderConfigRequest(string $endpoint, string $method, array $params): object|array {
    global $server;
    static $requestId = 0;
    $_SERVER['SCRIPT_FILENAME'] = "$server/$endpoint.php";
    $_SERVER['REQUEST_METHOD'] = $method;
    $_SERVER['HTTP_HOST'] = 'fixture.test';
    $_SERVER['HTTP_ORIGIN'] = 'http://fixture.test';
    $_SERVER['HTTP_X_FV_REQUEST'] = '1';
    $_GET = $_POST = [];
    if ($method === 'POST') {
        $nonce = fvplus_issue_mutation_nonce("$endpoint.php");
        $_POST = $params + ['token' => getConfiguredRequestToken(), '_fv_nonce' => $nonce['nonce'],
            '_fv_transaction' => 'tx-numeric-fixture-' . (++$requestId)];
        $_REQUEST = $_POST;
    } else {
        $_GET = $_REQUEST = $params;
    }
    $source = file_get_contents($_SERVER['SCRIPT_FILENAME']);
    $source = str_replace('/usr/local/emhttp/plugins/folderview.plus/server/', "$server/", $source);
    $source = str_replace("define('FVPLUS_CONFIG_ONLY_BOOTSTRAP', true);", '', $source);
    ob_start();
    eval(substr($source, 5));
    $response = json_decode(ob_get_clean(), false, 512, JSON_THROW_ON_ERROR);
    if (is_object($response) && ($response->ok ?? true) === false) throw new RuntimeException(json_encode($response));
    return $response;
}

$type = 'vm';
$folderId = '0';
$metadata = readConfigMetadata($type, true);
$batch = numericFolderConfigRequest('batch', 'POST', ['type' => $type, 'expectedRevision' => (string)$metadata['folderRevision'],
    'operations' => json_encode(['upserts' => [['id' => $folderId, 'folder' => ['name' => 'Numeric ID']]]], JSON_THROW_ON_ERROR)]);
$saved = numericFolderConfigRequest('prefs', 'POST', ['type' => $type,
    'prefs' => json_encode(['sortMode' => 'manual', 'manualOrder' => [$folderId],
        'expandedFolderState' => (object)[$folderId => true]], JSON_THROW_ON_ERROR)]);
$beforeReads = readConfigMetadata($type, false);
$direct = numericFolderConfigRequest('read', 'GET', ['type' => $type]);
$withMetadata = numericFolderConfigRequest('read', 'GET', ['type' => $type, 'includeMetadata' => '1']);
$snapshot = numericFolderConfigRequest('runtime_snapshot', 'GET', ['type' => 'all', 'mode' => 'config']);
$afterReads = readConfigMetadata($type, false);
$backup = createBackupSnapshot($type, 'fixture');
$backupPath = getBackupSnapshotPath($type, $backup['name']);
$reordered = applyFolderBatchOperations($type, ['manualOrder' => [$folderId], 'expectedPrefsRevision' => $afterReads['prefsRevision'],
    'upserts' => [['id' => $folderId, 'folder' => ['name' => 'Renamed numeric ID']]]], $afterReads['folderRevision']);
$restored = restoreBackupSnapshot($type, $backup['name']);
$result = [
    'ids' => $batch->result->updatedIds,
    'direct' => $direct,
    'metadata' => $withMetadata->folders,
    'stablePrefsAfterReads' => $beforeReads['prefsRevision'] === $afterReads['prefsRevision'] && $beforeReads['prefsSha256'] === $afterReads['prefsSha256'],
    'manualOrder' => readTypePrefs($type)['manualOrder'],
    'reordered' => $reordered['updatedIds'],
    'restored' => $restored['count'],
    'saved' => $saved->prefs->expandedFolderState,
    'loaded' => numericFolderConfigRequest('prefs', 'GET', ['type' => $type])->prefs->expandedFolderState,
    'snapshot' => $snapshot->snapshots->$type,
    'backup' => numericFolderConfigRequest('backup', 'GET', ['type' => $type, 'action' => 'read', 'name' => $backup['name']])->snapshot,
    // Decode the stored envelope without losing the JSON object markers.
    'backupFile' => json_decode(file_get_contents($backupPath), false, 512, JSON_THROW_ON_ERROR),
    'environment' => numericFolderConfigRequest('environment_snapshot', 'GET', ['action' => 'export'])->snapshot->types->$type
];
foreach (['1' => true, '0' => false] as $id => $expanded) {
    $updated = numericFolderConfigRequest('prefs', 'POST', ['type' => $type,
        'prefs' => json_encode(['expandedFolderState' => (object)[$id => $expanded]], JSON_THROW_ON_ERROR)]);
}
$result['expandedDelta'] = $updated->prefs->expandedFolderState;
echo json_encode($result, JSON_THROW_ON_ERROR);
