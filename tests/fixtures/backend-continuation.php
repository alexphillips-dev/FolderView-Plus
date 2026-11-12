<?php
$server = $argv[1]; $root = $argv[2]; $mode = $argv[3];
foreach (['config', 'source', 'host'] as $dir) mkdir("$root/$dir", 0700, true);
putenv("FVPLUS_TEST_CONFIG_DIR=$root/config");
putenv("FVPLUS_TEST_SOURCE_DIR=$root/source");
putenv("FVPLUS_TEST_DOCKER_AUTOSTART_FILE=$root/config/native-autostart");
$_SERVER['DOCUMENT_ROOT'] = "$root/host";
require "$server/lib.php";
if ($mode === 'migration') {
    $type = $argv[4]; $keyed = $argv[5] === 'keyed';
    $ids = $type === 'vm'
        ? ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222']
        : [str_repeat('a', 64), str_repeat('b', 64)];
    $images = ['synthetic/removed:latest', 'synthetic/retained:latest'];
    $bundle = ['fv3_export_version' => 1, 'docker' => [], 'vm' => [], 'settings' => [], 'css_config' => [], 'custom_styles' => []];
    $bundle[$type] = [
        'first' => ['name' => 'First', 'containers' => ['duplicate']],
        'second' => ['name' => 'Second', 'containers' => ['duplicate', 'retained'],
            'containerIds' => $keyed ? array_combine(['duplicate', 'retained'], $ids) : $ids,
            'containerImages' => $keyed ? array_combine(['duplicate', 'retained'], $images) : $images]
    ];
    $plan = buildFolderView3MigrationPlan($bundle);
    applyFolderView3Migration($bundle, 'synthetic.json', $plan['source']['digest']);
    echo json_encode(['planned' => $plan['target']['types'][$type]['folders']['second'],
        'stored' => readRawFolderMap($type)['second'], 'expectedId' => $ids[1], 'expectedImage' => $images[1]], JSON_THROW_ON_ERROR);
} elseif ($mode === 'actions') {
    $types = [];
    foreach (['docker', 'vm'] as $prefsType) {
        $metadataType = $prefsType === 'docker' ? 'vm' : 'docker';
        $types[$prefsType] = array_column(diagnosticsBuildRecommendedActions([
            $prefsType => ['integrityChecks' => ['invalidAutoRules' => ['count' => 1]]],
            $metadataType => ['integrityChecks' => ['configurationMetadata' => ['issuesCount' => 1]]]
        ], []), 'action');
    }
    echo json_encode($types, JSON_THROW_ON_ERROR);
}
