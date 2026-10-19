<?php
$server = $argv[1];
$request = json_decode(file_get_contents($argv[2]), true, 512, JSON_THROW_ON_ERROR);
$_SERVER['DOCUMENT_ROOT'] = getenv('FVPLUS_TEST_DOCUMENT_ROOT');
require $server . '/lib.php';
require_once $server . '/lib.validation.php';
$type = $request['type'] ?? 'docker';
$source = ['name' => 'Source fixture', 'icon' => 'source.svg', 'containers' => ['source-member'], 'regex' => 'source', 'settings' => [
    'preview' => 4, 'preview_rows' => 3, 'preview_border_color' => '#112233', 'folder_accent_color' => '#445566',
    'expand_tab' => true, 'custom_future_setting' => 'source', 'override_default_actions' => true,
    'child_folder_order' => ['source-child'], 'webui_profiles' => [['id' => 'source', 'name' => 'Source', 'containers' => ['source-member']]]],
    'actions' => [['type' => 1, 'name' => 'Script', 'script' => 'echo fixture'], ['type' => 0, 'name' => 'Member action', 'containers' => ['source-member']]]];
$target = ['name' => 'Target fixture', 'icon' => 'target.svg', 'parentId' => 'parent', 'containers' => ['target-member'], 'regex' => 'target',
    'settings' => ['preview' => 1, 'preview_rows' => 1, 'preview_border_color' => '#abcdef', 'folder_accent_color' => '#fedcba', 'expand_tab' => false,
        'custom_future_setting' => 'target', 'override_default_actions' => true, 'child_folder_order' => ['target-child'],
        'webui_profiles' => [['id' => 'target', 'name' => 'Target', 'containers' => ['target-member']]]],
    'actions' => [['type' => 0, 'name' => 'Target action', 'containers' => ['target-member']]]];
writeRawFolderMap($type, ['parent' => ['name' => 'Parent'], 'target' => $target]);
writeTypePrefs($type, defaultTypePrefs());
$original = readRawFolderMap($type)['target'];
function transferFiles(): array {
    $files = [];
    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator(getenv('FVPLUS_TEST_CONFIG_DIR'), FilesystemIterator::SKIP_DOTS)) as $file) {
        if ($file->isFile()) $files[$file->getFilename()] = hash_file('sha256', $file->getPathname());
    }
    ksort($files); return $files;
}
$before = transferFiles();
$options = ['categories' => $request['categories'] ?? ['appearance'], 'preview' => true];
$payload = array_intersect_key($source, array_flip(['icon', 'settings', 'actions']));
$ids = $request['targetIds'] ?? ['target'];
$error = '';
$result = null;
try {
    $preview = applySelectiveFolderSettings($type, $ids, $payload, $options);
    $afterPreview = transferFiles();
    if (($request['scenario'] ?? '') === 'stale') {
        $folders = readRawFolderMap($type); $folders['target']['settings']['expand_tab'] = true; writeRawFolderMap($type, $folders);
    }
    $options['expectedRevision'] = $preview['folderRevision'];
    $options['preview'] = false;
    if (($request['scenario'] ?? '') === 'backup-failure') {
        putenv('FVPLUS_STORAGE_FAILURE_INJECTION=1'); putenv('FVPLUS_STORAGE_FAILURE_STAGE=rename');
    }
    if (($request['scenario'] ?? '') !== 'preview') $result = applySelectiveFolderSettings($type, $ids, $payload, $options);
    $after = transferFiles();
    $repeat = ($request['scenario'] ?? '') === 'preview' ? null : applySelectiveFolderSettings($type, ['target'], $payload, ['categories' => $options['categories']]);
    $afterRepeat = transferFiles();
} catch (Throwable $exception) { $error = $exception->getMessage(); }
echo json_encode(['before' => $before, 'afterPreview' => $afterPreview ?? null, 'after' => $after ?? transferFiles(), 'afterRepeat' => $afterRepeat ?? null,
    'original' => $original, 'target' => readRawFolderMap($type)['target'], 'preview' => $preview ?? null, 'result' => $result, 'repeat' => $repeat ?? null,
    'error' => $error, 'backups' => listBackupSnapshots($type), 'categoryKeys' => array_map('folderSettingsTransferCategory', $request['keys'] ?? [])]);
