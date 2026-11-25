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
