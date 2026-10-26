<?php
$root = $argv[1];
foreach (['config', 'host'] as $directory) mkdir($root . '/' . $directory, 0770, true);
putenv('FVPLUS_TEST_CONFIG_DIR=' . $root . '/config');
putenv('FVPLUS_TEST_STORAGE_DIR=' . $root . '/config');
$_SERVER['DOCUMENT_ROOT'] = $root . '/host';
require $argv[2] . '/lib.php';
$request = json_decode(file_get_contents($root . '/request.json'), true, 512, JSON_THROW_ON_ERROR);
$results = [];
if (($request['operation'] ?? '') === 'startup') {
    writeRawFolderMap('docker', $request['folders']);
    writeTypePrefs('docker', array_replace(defaultTypePrefs(), ['autoRules' => $request['rules'], 'sortMode' => 'manual', 'manualOrder' => array_reverse(array_keys($request['folders']))]));
    $context = buildDockerStartOrderContext($request['info']);
    echo json_encode(['folders' => $context['folders'], 'order' => array_keys($context['orderedFolders']), 'members' => $context['folderContainers']], JSON_THROW_ON_ERROR); exit;
}
if (($request['operation'] ?? '') === 'validate') {
    writeRawFolderMap($request['type'], $request['folders']);
    try { fvplusValidateRuleChanges($request['type'], $request['current'], $request['next']); echo 'true'; }
    catch (Throwable $error) { echo 'false'; }
    exit;
}

if (($request['operation'] ?? '') === 'preview-apply') {
    $type = $request['type'];
    writeRawFolderMap($type, $request['folders']);
    writeTypePrefs($type, array_replace(defaultTypePrefs(), ['autoRules' => $request['rules']]));
    $tree = static function () use ($root): array {
        $state = [];
        foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root . '/config', FilesystemIterator::SKIP_DOTS)) as $file) {
            if ($file->isFile()) $state[substr($file->getPathname(), strlen($root))] = hash_file('sha256', $file->getPathname());
        }
        ksort($state); return $state;
    };
    $before = $tree();
    $preview = fvplusBuildRulePreview($type, $request['info']);
    $readOnly = $before === $tree();
    if (!empty($request['corrupt'])) file_put_contents(getFolderFilePath($type), '{');
    if (!empty($request['mutateRules'])) writeTypePrefs($type, array_replace(defaultTypePrefs(), ['autoRules' => $request['mutateRules']]));
    if (!empty($request['mutateFolders'])) writeRawFolderMap($type, $request['mutateFolders']);
    $preApply = $tree(); $result = null; $error = null;
    try { $result = fvplusApplyRulePreview($type, $preview['digest'], $request['nextInfo'] ?? $request['info']); }
    catch (Throwable $failure) { $error = ['class' => get_class($failure), 'message' => $failure->getMessage()]; }
    echo json_encode(['preview' => $preview, 'readOnly' => $readOnly, 'result' => $result, 'error' => $error,
        'failedApplyReadOnly' => $preApply === $tree(), 'folders' => readJsonObjectFile(getFolderFilePath($type))], JSON_THROW_ON_ERROR);
    exit;
}

if (($request['operation'] ?? '') === 'membership') {
    echo json_encode(fvplusBuildMembershipSnapshot($request['type'], $request['folders'], $request['rules'], $request['info']), JSON_THROW_ON_ERROR);
    exit;
}
if (($request['operation'] ?? '') === 'diagnostics') {
    $folders = $request['folders']; $info = $request['info'];
    $prefs = array_replace(defaultTypePrefs(), ['autoRules' => $request['rules']]);
    $snapshot = diagnosticsBuildStateSnapshot('docker', $folders, $prefs, $info, 'sanitized');
    $integrity = diagnosticsBuildIntegrityChecks('docker', $folders, $prefs, $info, 'sanitized');
    echo json_encode(['snapshot' => $snapshot, 'integrity' => $integrity], JSON_THROW_ON_ERROR);
    exit;
}
foreach ($request['cases'] ?? [] as $case) {
    $results[] = autoRuleDecision($case['rules'], $case['name'], $case['info'], $case['type'], $case['folders'] ?? null);
}
echo json_encode($results, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
