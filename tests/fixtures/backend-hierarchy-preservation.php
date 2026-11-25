<?php
[$script, $server, $root, $scenario] = $argv;
foreach (['config', 'source', 'host'] as $dir) mkdir("$root/$dir", 0700);
putenv("FVPLUS_TEST_CONFIG_DIR=$root/config");
putenv("FVPLUS_TEST_SOURCE_DIR=$root/source");
putenv("FVPLUS_TEST_DOCUMENT_ROOT=$root/host");
putenv("FVPLUS_TEST_STORAGE_DIR=$root/config");
$nativePath = "$root/config/native-autostart";
putenv("FVPLUS_TEST_DOCKER_AUTOSTART_FILE=$nativePath");
$_SERVER['DOCUMENT_ROOT'] = "$root/host";
require "$server/lib.php";

$saveStoredFolders = static function (string $type, array $folders): void {
    fvplusWriteConfigPayload($type, 'folder', getFolderFilePath($type), normalizeFolderMapPayload($folders, false));
};
$storedParents = static function (string $type): array {
    return array_column(readFolderMapForTreeIntegrity($type), 'parentId');
};
$legacyFolders = [
    'target' => ['name' => 'Original'],
    'orphan' => ['name' => 'Orphan', 'parentId' => 'missing-parent'],
    'cycle-a' => ['name' => 'Cycle A', 'parentId' => 'cycle-b'],
    'cycle-b' => ['name' => 'Cycle B', 'parentId' => 'cycle-a']
];

if ($scenario === 'rollback') {
    $saveStoredFolders('docker', $legacyFolders);
    $saveStoredFolders('vm', $legacyFolders);
    $originalParents = $storedParents('vm');
    file_put_contents($nativePath, "fixture-first 14\n");
    $options = ['syncDockerOrder' => false, 'nativeAutostart' => ['exists' => true, 'content' => "fixture-second 20\n", 'mode' => 0644]];
    $snapshot = exportEnvironmentSnapshotPayload();
    $exportParents = array_column($snapshot['types']['vm']['folders'], 'parentId');
    $snapshot['types']['vm']['folders']['target']['name'] = 'Imported';
    $snapshot['types']['vm']['folders']['orphan']['parentId'] = 'another-missing-parent';
    $transaction = applyEnvironmentSnapshotTransaction($snapshot, 'fixture.json', $options);
    $checkpoint = $transaction['rollback']['name'];
    $captured = json_decode(file_get_contents(getGlobalRollbackSnapshotPath($checkpoint)), true);
    $capturedParents = array_column($captured['types']['vm']['folders'], 'parentId');
    $importParents = $storedParents('vm');
    $failedVerification = '';
    try {
        restoreGlobalRollbackSnapshot($checkpoint, ['afterStage' => static function (string $stage) use ($saveStoredFolders): void {
            if ($stage !== 'vm-folders') return;
            $saved = readFolderMapForTreeIntegrity('vm');
            $saved['orphan']['parentId'] = '';
            $saveStoredFolders('vm', $saved);
        }]);
    } catch (RuntimeException $error) {
        $failedVerification = $error->getMessage();
    }
    $failedRestoreParents = $storedParents('vm');
    $failedRestoreNative = file_get_contents($nativePath);
    $restored = restoreGlobalRollbackSnapshot($checkpoint);
    $restoredVmParents = $storedParents('vm');
    $restoredDockerParents = $storedParents('docker');
    $restoredNative = file_get_contents($nativePath);
    $restoredName = readRawFolderMap('vm')['target']['name'];
    $historicalName = 'global-20251125-000000-historical.json';
    $historical = $captured;
    unset($historical['nativeDockerAutostart'], $historical['themeWorkspace']);
    foreach (FVPLUS_ALLOWED_TYPES as $type) {
        $historical['types'][$type] = ['folders' => normalizeFolderParentLinks($captured['types'][$type]['folders'])];
    }
    writeJsonObjectAtomic(getGlobalRollbackSnapshotPath($historicalName), $historical);
    $historicalResult = restoreGlobalRollbackSnapshot($historicalName, ['syncDockerOrder' => false]);
    echo json_encode([
        'originalParents' => $originalParents, 'exportParents' => $exportParents, 'capturedParents' => $capturedParents,
        'importParents' => $importParents, 'failedVerification' => $failedVerification,
        'failedRestoreParents' => $failedRestoreParents, 'failedRestoreNative' => $failedRestoreNative,
        'restoredVmParents' => $restoredVmParents, 'restoredDockerParents' => $restoredDockerParents,
        'restoredNative' => $restoredNative, 'restoredName' => $restoredName, 'result' => $restored,
        'historical' => ['verified' => $historicalResult['verified'], 'parents' => $storedParents('vm')]
    ], JSON_THROW_ON_ERROR);
} elseif ($scenario === 'rule') {
    $saveStoredFolders('vm', $legacyFolders);
    writeTypePrefs('vm', ['autoRules' => [['id' => 'match-fixture', 'folderId' => 'target',
        'effect' => 'include', 'kind' => 'name_regex', 'pattern' => '^fixture-member$']]]);
    $inventory = ['fixture-member' => ['name' => 'fixture-member', 'uuid' => '00000000-0000-0000-0000-000000000001']];
    $files = [getFolderFilePath('vm'), getTypePrefsPath('vm'), getConfigMetadataPath('vm')];
    $before = array_map('file_get_contents', $files);
    $preview = fvplusBuildRulePreview('vm', $inventory);
    $after = array_map('file_get_contents', $files);
    $legacyFolders['orphan']['parentId'] = 'different-missing-parent';
    $saveStoredFolders('vm', $legacyFolders);
    $stale = false;
    try {
        fvplusApplyRulePreview('vm', $preview['digest'], $inventory);
    } catch (FVPlusConfigConflictException $error) {
        $stale = true;
    }
    $ready = fvplusBuildRulePreview('vm', $inventory);
    $applied = fvplusApplyRulePreview('vm', $ready['digest'], $inventory);
    $saved = readFolderMapForTreeIntegrity('vm');
    $backup = readBackupSnapshot('vm', $applied['backup']['name']);
    $malformed = $saved;
    $malformed['orphan']['containers'] = 'not an array';
    writeJsonObjectAtomic(getFolderFilePath('vm'), $malformed);
    $rejected = '';
    try {
        fvplusBuildRulePreview('vm', $inventory);
    } catch (RuntimeException $error) {
        $rejected = $error->getMessage();
    }
    echo json_encode([
        'previewIsReadOnly' => $before === $after, 'preview' => $preview, 'stale' => $stale, 'assigned' => $applied['assignedCount'],
        'parents' => array_column($saved, 'parentId'), 'containers' => $saved['target']['containers'],
        'backupParents' => array_column($backup['folders'], 'parentId'), 'malformedRejected' => $rejected
    ], JSON_THROW_ON_ERROR);
} elseif ($scenario === 'template') {
    writeRawFolderMap('vm', [
        'source' => ['name' => 'Source', 'settings' => [
            'child_folder_order' => ['source-b', 'source-a'],
            'webui_profiles' => [['id' => 'source-profile', 'name' => 'Source profile', 'containers' => ['source-member']]],
            'fixtureBehavior' => 'portable'
        ]],
        'source-a' => ['name' => 'Source A', 'parentId' => 'source'],
        'source-b' => ['name' => 'Source B', 'parentId' => 'source'],
        'target' => ['name' => 'Target', 'settings' => [
            'child_folder_order' => ['target-b', 'target-a'],
            'webui_profiles' => [['id' => 'target-profile', 'name' => 'Target profile', 'containers' => ['target-member']]],
            'fixtureBehavior' => 'original'
        ]],
        'target-a' => ['name' => 'Target A', 'parentId' => 'target'],
        'target-b' => ['name' => 'Target B', 'parentId' => 'target']
    ]);
    $created = createFolderTemplateFromFolder('vm', 'source', 'Operations fixture');
    $legacyTemplate = $created['template'];
    $legacyTemplate['id'] = 'historical';
    $legacyTemplate['settings'] = readRawFolderMap('vm')['source']['settings'];
    writeJsonObjectWithLastGood(getTemplatePath('vm'), [$created['template'], $legacyTemplate]);
    applyFolderTemplateToFolder('vm', 'historical', 'target');
    $saved = readRawFolderMap('vm');
    echo json_encode([
        'createdSettings' => $created['template']['settings'], 'settings' => $saved['target']['settings'],
        'traversal' => orderFolderBranchIds($saved, [], true)
    ], JSON_THROW_ON_ERROR);
} elseif ($scenario === 'child-order') {
    writeRawFolderMap('vm', ['parent' => ['name' => 'Parent'], 'short' => ['name' => 'Short', 'parentId' => 'parent']]);
    $prefix = str_repeat('f', 64);
    $longest = $prefix . str_repeat('a', 64);
    $long = $prefix . 'a';
    $order = [$longest, $long, $prefix, 'short'];
    $revision = readConfigMetadata('vm')['folderRevision'];
    $updated = applyFolderBatchOperations('vm', ['upserts' => [
        ['id' => 'parent', 'folder' => ['name' => 'Parent', 'settings' => ['child_folder_order' => $order]]],
        ['id' => $prefix, 'createOnly' => true, 'folder' => ['name' => '64-byte child', 'parentId' => 'parent']],
        ['id' => $long, 'createOnly' => true, 'folder' => ['name' => '65-byte child', 'parentId' => 'parent']],
        ['id' => $longest, 'createOnly' => true, 'folder' => ['name' => '128-byte child', 'parentId' => 'parent']]
    ]], $revision);
    $saved = readRawFolderMap('vm');
    echo json_encode([
        'expectedOrder' => $order, 'savedOrder' => $saved['parent']['settings']['child_folder_order'],
        'alias' => $saved['parent']['settings']['childFolderOrder'], 'createdIds' => $updated['createdIds'],
        'traversal' => orderFolderBranchIds($saved, [], true)
    ], JSON_THROW_ON_ERROR);
}
