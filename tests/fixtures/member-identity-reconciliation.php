<?php
$root = $argv[1];
$_SERVER['DOCUMENT_ROOT'] = $root . '/host';
putenv('FVPLUS_TEST_CONFIG_DIR=' . $root . '/config');
putenv('FVPLUS_TEST_STORAGE_DIR=' . $root . '/config');
require $argv[2] . '/lib.php';
$request = json_decode(file_get_contents($root . '/request.json'), true, 512, JSON_THROW_ON_ERROR);
$type = 'vm';
writeRawFolderMap($type, $request['folders']);
if (isset($request['assignTo'])) {
    bulkAssignItemsToFolders($type, [['folderId' => $request['assignTo'], 'items' => ['Renamed']]], $request['inventory']);
}
$before = readConfigMetadata($type, false);
$result = applyFolderMemberIdentityPatches($type, $request['patches']);
$folders = readRawFolderMap($type);
echo json_encode(['before' => $before, 'result' => $result, 'folders' => $folders], JSON_THROW_ON_ERROR);
