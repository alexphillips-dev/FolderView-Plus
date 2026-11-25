<?php
$server = $argv[1];
$root = $argv[2];
$scenario = $argv[3];
$_SERVER['DOCUMENT_ROOT'] = "$root/host";

class DockerClient {
    public function getDockerJSON(string $path, string $method = 'GET', &$status = null, ?callable $consume = null): array {
        $status = true;
        if ($consume !== null) $consume('[]');
        return [];
    }
}

if ($scenario === 'rule-get') {
    $_SERVER['REQUEST_METHOD'] = 'GET';
    $_SERVER['SCRIPT_FILENAME'] = "$server/rule_preview.php";
    $_GET = ['type' => 'docker'];
    $body = file_get_contents($_SERVER['SCRIPT_FILENAME']);
    eval(substr(str_replace('/usr/local/emhttp/plugins/folderview.plus/server/lib.php', "$server/lib.php", $body), 5));
    exit;
}
if ($scenario === 'tree-get') {
    $_SERVER['REQUEST_METHOD'] = 'GET';
    $_SERVER['SCRIPT_FILENAME'] = "$server/read.php";
    $_GET = ['type' => 'vm', 'treeIntegrity' => '1'];
    $body = file_get_contents($_SERVER['SCRIPT_FILENAME']);
    eval(substr(str_replace('/usr/local/emhttp/plugins/folderview.plus/server/lib.php', "$server/lib.php", $body), 5));
    exit;
}
if ($scenario === 'seed-rule-get') define('FVPLUS_READ_ONLY_REQUEST', true);
require "$server/lib.php";

function outputAuditFixture(array $result): void {
    echo json_encode($result, JSON_THROW_ON_ERROR);
    exit;
}

if ($scenario === 'seed-rule-get') {
    writeRawFolderMap('docker', ['fixture' => ['name' => 'Fixture']]);
    writeTypePrefs('docker', ['autoRules' => [
        ['id' => 'fixture-rule', 'kind' => 'name_regex', 'pattern' => '^fixture$', 'folderId' => 'fixture']
    ]]);
    outputAuditFixture(['seeded' => true]);
}

if ($scenario === 'seed-tree-get') {
    writeRawFolderMap('vm', [0 => ['name' => 'Zero'], 'a' => ['name' => 'A'], 'b' => ['name' => 'B']]);
    $path = getFolderFilePath('vm');
    $folders = readJsonObjectFile($path);
    $folders[0]['parentId'] = 'missing-parent';
    $folders['a']['parentId'] = 'b';
    $folders['b']['parentId'] = 'a';
    writeJsonObjectAtomic($path, fvplusJsonKeyedMap($folders));
    $visibleFolders = json_decode(readFolder('vm'), true);
    outputAuditFixture(['visibleOrphanParent' => $visibleFolders[0]['parentId'], 'storedOrphanParent' => readJsonObjectFile($path)[0]['parentId']]);
}

if ($scenario === 'repair-tree') {
    $type = 'vm';
    $path = getFolderFilePath($type);
    $snapshot = readFolderMapForTreeIntegrity($type);
    $revision = readConfigMetadata($type, true, false)['folderRevision'];
    $operations = ['backupReason' => 'before-tree-integrity-repair', 'upserts' => [
        ['id' => '0', 'folder' => array_replace($snapshot[0], ['parentId' => ''])],
        ['id' => 'a', 'folder' => array_replace($snapshot['a'], ['parentId' => ''])]
    ]];
    $before = file_get_contents($path);
    $rejected = false;
    try {
        applyFolderBatchOperations($type, $operations, (string)($revision - 1));
    } catch (FVPlusConfigConflictException $error) {
        $rejected = file_get_contents($path) === $before && listBackupSnapshots($type) === [];
    }
    $result = applyFolderBatchOperations($type, $operations, (string)$revision);
    $archive = readJsonObjectFile(getBackupSnapshotPath($type, $result['backup']['name']));
    $repaired = readFolderMapForTreeIntegrity($type);
    restoreBackupSnapshot($type, $result['backup']['name'], ['createSafetyBackup' => true]);
    outputAuditFixture(['rejected' => $rejected, 'backupParent' => $archive['folders'][0]['parentId'],
        'backupCycle' => $archive['folders']['a']['parentId'], 'repaired' => $repaired,
        'restored' => readFolderMapForTreeIntegrity($type)]);
}

if ($scenario === 'partial-import-cycle') {
    $type = 'vm';
    writeRawFolderMap($type, [
        'alpha' => ['name' => 'Alpha'], 'beta' => ['name' => 'Beta', 'parentId' => 'alpha']
    ]);
    writeTypePrefs($type, ['backupSchedule' => ['enabled' => false]]);
    $revision = readConfigMetadata($type)['folderRevision'];
    $paths = fvplusTypeTransactionPaths($type);
    $before = fvplusEnvironmentCaptureFiles($paths);
    $moveAlpha = ['id' => 'alpha', 'folder' => ['name' => 'Alpha', 'parentId' => 'beta']];
    $operations = ['backupReason' => 'before-import-transaction-merge', 'upserts' => [$moveAlpha]];
    $error = '';
    $deleteError = '';
    try {
        applyFolderBatchOperations($type, $operations, $revision);
    } catch (FVPlusConfigConflictException $failure) {
        $error = $failure->getMessage();
    }
    try {
        applyFolderBatchOperations($type, ['deletes' => ['alpha'], 'preserveParentLinks' => true], $revision);
    } catch (FVPlusConfigConflictException $failure) {
        $deleteError = $failure->getMessage();
    }
    $unchanged = $before === fvplusEnvironmentCaptureFiles($paths) && listBackupSnapshots($type) === [];
    $operations['upserts'][] = ['id' => 'beta', 'folder' => ['name' => 'Beta', 'parentId' => '']];
    $applied = applyFolderBatchOperations($type, $operations, $revision);
    applyFolderBatchOperations($type, [
        'deletes' => ['beta'], 'preserveParentLinks' => true,
        'upserts' => [['id' => 'beta', 'folder' => ['name' => 'Replacement Beta', 'parentId' => '']]]
    ], $applied['metadata']['folderRevision']);
    outputAuditFixture(['error' => $error, 'deleteError' => $deleteError, 'unchanged' => $unchanged, 'updated' => $applied['updatedIds'],
        'parents' => array_column(readFolderMapForTreeIntegrity($type), 'parentId'), 'backup' => $applied['backup']]);
}

if ($scenario === 'ordinary-hierarchy-writes') {
    $type = 'vm';
    writeRawFolderMap($type, [
        'alpha' => ['name' => 'Alpha'], 'orphan' => ['name' => 'Orphan'],
        'cycle-a' => ['name' => 'Cycle A'], 'cycle-b' => ['name' => 'Cycle B'],
        'parent' => ['name' => 'Parent', 'parentId' => 'alpha'],
        'child' => ['name' => 'Child', 'parentId' => 'parent']
    ]);
    $knownGood = createBackupSnapshot($type);
    $config = getFolderFilePath($type);
    $stored = readFolderMapForTreeIntegrity($type);
    $stored['orphan']['parentId'] = 'missing';
    $stored['cycle-a']['parentId'] = 'cycle-b';
    $stored['cycle-b']['parentId'] = 'cycle-a';
    writeJsonObjectWithLastGood($config, fvplusJsonKeyedMap($stored));
    $links = static fn(array $folders): array => array_combine(array_keys($folders), array_column($folders, 'parentId'));
    $revision = readConfigMetadata($type)['folderRevision'];
    $edited = updateFolder($type, json_encode(array_replace($stored['alpha'], ['name' => 'Renamed Alpha']), JSON_THROW_ON_ERROR), 'alpha', $revision);
    $afterEdit = $links(readFolderMapForTreeIntegrity($type));
    $archivesAfterEdit = count(listBackupSnapshots($type));
    $paths = fvplusTypeTransactionPaths($type);
    $before = fvplusEnvironmentCaptureFiles($paths);
    $reactivationConflicts = 0;
    foreach ([
        ['id' => 'missing', 'createOnly' => true, 'folder' => ['name' => 'A newly available parent']],
        ['id' => 'cycle-a', 'folder' => ['name' => 'Cycle A', 'parentId' => '']]
    ] as $entry) {
        try {
            applyFolderBatchOperations($type, ['upserts' => [$entry], 'backupReason' => 'before-import-transaction-merge'],
                $edited['folderRevision']);
        } catch (FVPlusConfigConflictException $failure) {
            $reactivationConflicts++;
        }
    }
    $reactivationUnchanged = $before === fvplusEnvironmentCaptureFiles($paths)
        && count(listBackupSnapshots($type)) === $archivesAfterEdit;
    $batch = applyFolderBatchOperations($type, ['deletes' => ['parent'], 'backupReason' => 'before-delete-parent'],
        $edited['folderRevision']);
    $afterDelete = $links(readFolderMapForTreeIntegrity($type));
    $mirrored = $afterDelete === $links(readJsonObjectFile(getLastGoodJsonPath($config)));
    $checkpoint = readBackupSnapshot($type, $batch['backup']['name']);
    $undo = restoreLatestUndoBackupSnapshot($type);
    $afterUndo = $links(readFolderMapForTreeIntegrity($type));
    runScheduledBackups($type);
    $scheduledUnchanged = getTypeBackupSchedule($type)['skipReason'] === 'unchanged-config';
    restoreBackupSnapshot($type, $knownGood['name'], ['createSafetyBackup' => true]);
    $afterExplicitRestore = $links(readFolderMapForTreeIntegrity($type));
    outputAuditFixture(compact('afterEdit', 'archivesAfterEdit', 'reactivationConflicts', 'reactivationUnchanged',
        'afterDelete', 'mirrored', 'afterUndo', 'scheduledUnchanged', 'afterExplicitRestore')
        + ['checkpointPreserved' => $checkpoint['preserveHierarchy'] ?? false, 'undoRestoredBatch' => $undo['name'] === $batch['backup']['name']]);
}

if ($scenario === 'batch-create-only') {
    $type = 'vm';
    writeRawFolderMap($type, ['source' => ['name' => 'Source']]);
    writeTypePrefs($type, ['sortMode' => 'manual', 'manualOrder' => ['source']]);
    $meta = readConfigMetadata($type);
    $entry = static fn(string $id, array $config = []): array =>
        ['id' => $id, 'createOnly' => true, 'folder' => ['name' => 'Clone'] + $config];
    $paths = fvplusTypeTransactionPaths($type);
    $before = fvplusEnvironmentCaptureFiles($paths);
    $failures = 0;
    foreach ([
        [['upserts' => [$entry('clone')]], ''],
        [['upserts' => [$entry('source')]], $meta['folderRevision']],
        [['upserts' => [$entry('source')], 'deletes' => ['source']], $meta['folderRevision']],
        [['upserts' => [$entry('clone'), ['id' => 'clone', 'folder' => ['name' => 'Conflicting write']]]], $meta['folderRevision']],
        [['upserts' => [['id' => 'clone', 'createOnly' => 'yes', 'folder' => ['name' => 'Clone']]]], $meta['folderRevision']],
        [['upserts' => [$entry('invalid id')]], $meta['folderRevision']]
    ] as [$operations, $revision]) {
        try {
            applyFolderBatchOperations($type, $operations, $revision);
        } catch (RuntimeException $failure) {
            $failures++;
        }
    }
    $unchanged = $before === fvplusEnvironmentCaptureFiles($paths);
    $longId = str_repeat('a', 128);
    $result = applyFolderBatchOperations($type, [
        'upserts' => [
            $entry($longId, ['settings' => ['child_folder_order' => ['clone-child']]]),
            $entry('clone-child', ['parentId' => $longId])
        ],
        'manualOrder' => ['source', $longId, 'clone-child'], 'expectedPrefsRevision' => $meta['prefsRevision']
    ], $meta['folderRevision']);
    $folders = readFolderMapForTreeIntegrity($type);
    $edit = applyFolderBatchOperations($type, [
        'upserts' => [['id' => $longId, 'folder' => array_replace($folders[$longId], ['name' => 'Renamed clone'])]]
    ], $result['metadata']['folderRevision']);
    outputAuditFixture(compact('failures', 'unchanged') + ['created' => $result['createdIds'], 'updated' => $result['updatedIds'],
        'edited' => $edit['updatedIds'],
        'folderRevisionDelta' => $result['metadata']['folderRevision'] - $meta['folderRevision'],
        'parent' => $folders['clone-child']['parentId'], 'children' => $folders[$longId]['settings']['child_folder_order'],
        'manualOrder' => readTypePrefs($type)['manualOrder']]);
}

if ($scenario === 'template-target-profiles') {
    $type = 'docker';
    writeTypePrefs($type, ['dockerStartOrder' => ['mode' => 'unmanaged']]);
    writeRawFolderMap($type, [
        'source' => ['name' => 'Source', 'icon' => '/source.png', 'containers' => ['source-app'], 'settings' => [
            'webui_profiles' => [['id' => 'source-profile', 'name' => 'Source tools', 'containers' => ['source-app']]]
        ]],
        'target' => ['name' => 'Target', 'icon' => '/target.png', 'containers' => ['target-app'], 'settings' => [
            'webui_profiles' => [['id' => 'target-profile', 'name' => 'Target tools', 'containers' => ['target-app']]]
        ]]
    ]);
    $template = createFolderTemplateFromFolder($type, 'source', 'Visual settings')['template'];
    $before = readRawFolderMap($type)['target'];
    applyFolderTemplateToFolder($type, $template['id'], 'target');
    $after = readRawFolderMap($type)['target'];
    outputAuditFixture(['templateProfiles' => $template['settings']['webui_profiles'] ?? null,
        'targetProfiles' => $after['settings']['webui_profiles'], 'beforeProfiles' => $before['settings']['webui_profiles'],
        'targetMembers' => $after['containers'], 'targetIcon' => $after['icon']]);
}

if ($scenario === 'capacity') {
    $type = 'vm';
    $targetMembers = array_map(static fn(int $i): string => "member-$i", range(1, folderNormalizationCollectionLimit('containers')));
    writeRawFolderMap($type, [
        'full' => ['name' => 'Full', 'containers' => $targetMembers],
        'source' => ['name' => 'Source', 'containers' => ['incoming']]
    ]);
    writeTypePrefs($type, ['autoRules' => [
        ['id' => 'incoming-rule', 'kind' => 'name_regex', 'pattern' => '^incoming$', 'folderId' => 'full']
    ]]);
    $paths = fvplusTypeTransactionPaths($type, false);
    $before = fvplusEnvironmentCaptureFiles($paths);
    $revision = readConfigMetadata($type, false)['folderRevision'];
    $inventory = ['incoming' => [], 'member-1' => []];
    $asSingleMove = [['folderId' => 'full', 'items' => ['incoming']]];
    $errors = [];
    try {
        bulkAssignItemsToFolders($type, $asSingleMove, $inventory, $revision, true);
    } catch (RuntimeException $error) {
        $errors['editor'] = $error->getMessage();
    }
    $preview = fvplusBuildRulePreview($type, $inventory);
    try {
        fvplusApplyRulePreview($type, $preview['digest'], $inventory);
    } catch (RuntimeException $error) {
        $errors['rule'] = $error->getMessage();
    }
    $unchanged = $before === fvplusEnvironmentCaptureFiles($paths);
    $rejectedArchives = listBackupSnapshots($type);
    $move = bulkAssignItemsToFolders($type, [
        ...$asSingleMove, ['folderId' => 'source', 'items' => ['member-1']]
    ], $inventory, $revision, true);
    $after = readRawFolderMap($type);
    outputAuditFixture(['errors' => $errors, 'unchanged' => $unchanged, 'rejectedArchives' => $rejectedArchives,
        'fullCount' => count($after['full']['containers']), 'fullTail' => end($after['full']['containers']),
        'source' => $after['source']['containers'], 'assigned' => array_column($move['results'], 'assigned'),
        'backupCreated' => !empty($move['backup']['name'])]);
}

if ($scenario === 'undo') {
    $type = 'vm';
    writeRawFolderMap($type, ['earlier' => ['name' => 'Earlier']]);
    $meaningful = createBackupSnapshot($type, 'before-folder-editor-bulk-move', false);
    writeRawFolderMap($type, ['current' => ['name' => 'Current']]);
    $incoming = exportEnvironmentSnapshotPayload();
    $incoming['types'][$type]['folders'] = ['replacement' => ['name' => 'Replacement']];
    $paths = fvplusEnvironmentTransactionPaths();
    $before = fvplusEnvironmentCaptureFiles($paths);
    $failure = '';
    try {
        applyEnvironmentSnapshotTransaction($incoming, 'fixture', [
            'syncDockerOrder' => false,
            'afterStage' => static function (string $stage): void {
                if ($stage === 'vm-folders') throw new RuntimeException('Fixture failure');
            }
        ]);
    } catch (RuntimeException $error) {
        $failure = $error->getMessage();
    }
    $unchanged = $before === fvplusEnvironmentCaptureFiles($paths);
    $otherArchives = listBackupSnapshots('docker');
    $remaining = array_column(listBackupSnapshots($type), 'name');
    $legacy = createBackupSnapshot($type, 'transaction-environment-import', false);
    $undone = restoreLatestUndoBackupSnapshot($type);
    outputAuditFixture(['failure' => $failure, 'unchanged' => $unchanged, 'otherArchives' => $otherArchives, 'remaining' => $remaining,
        'meaningful' => $meaningful['name'], 'legacy' => $legacy['name'], 'restored' => $undone['name'], 'current' => array_keys(readRawFolderMap($type))]);
}

if ($scenario === 'hierarchy') {
    $prefix = str_repeat('a', 64);
    $parent = $prefix . str_repeat('x', 64);
    $incoming = exportEnvironmentSnapshotPayload();
    $incoming['types']['vm']['folders'] = [
        $prefix => ['name' => 'Prefix'],
        $parent => ['name' => 'Parent'],
        'child' => ['name' => 'Child', 'parent_id' => $parent],
        'overlong' => ['name' => 'Overlong', 'parentId' => $parent . 'x'],
        0 => ['name' => 'Numeric', 'parentId' => '0'],
        'numeric-child' => ['name' => 'Numeric child', 'parentId' => '0']
    ];
    $applied = applyEnvironmentSnapshotTransaction($incoming, 'fixture', ['syncDockerOrder' => false]);
    $current = readRawFolderMap('vm');
    $exported = exportEnvironmentSnapshotPayload();
    outputAuditFixture(['verified' => $applied['verified'], 'parent' => $parent, 'child' => $current['child']['parentId'],
        'exportedParent' => $exported['types']['vm']['folders']['child']['parentId'],
        'overlong' => $current['overlong']['parentId'], 'self' => $current[0]['parentId'], 'numericChild' => $current['numeric-child']['parentId']]);
}

if ($scenario === 'templates') {
    $type = 'vm';
    writeRawFolderMap($type, ['fixture' => ['name' => 'Fixture']]);
    createFolderTemplateFromFolder($type, 'fixture', 'Saved template');
    $path = getTemplatePath($type);
    $mirror = getLastGoodJsonPath($path);
    file_put_contents($path, '{"invalid":"rows"}');
    $onCorrupt = array_column(readFolderTemplates($type), 'name');
    unlink($path);
    $onMissing = array_column(readFolderTemplates($type), 'name');
    $afterCreate = array_column(createFolderTemplateFromFolder($type, 'fixture', 'New template')['templates'], 'name');
    $mirrored = file_get_contents($path) === file_get_contents($mirror);
    file_put_contents($path, 'invalid primary');
    file_put_contents($mirror, 'invalid mirror');
    $error = '';
    try {
        createFolderTemplateFromFolder($type, 'fixture', 'Unsafe template');
    } catch (FVPlusStorageException $rejected) {
        $error = $rejected->getMessage();
    }
    outputAuditFixture(['onCorrupt' => $onCorrupt, 'onMissing' => $onMissing, 'afterCreate' => $afterCreate,
        'mirrored' => $mirrored, 'error' => $error, 'unavailable' => [file_get_contents($path), file_get_contents($mirror)]]);
}

throw new RuntimeException('Unknown fixture scenario.');
