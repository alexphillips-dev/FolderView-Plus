<?php
// Exercise real folder persistence against isolated synthetic configuration files.
function fvplus_assert_folder_payload_shape(array $payload): void {}
define('FVPLUS_CONFIG_ONLY_BOOTSTRAP', true);
$server = $argv[1]; $root = $argv[2];
$request = json_decode(file_get_contents($root . '/request.json'), true, 512, JSON_THROW_ON_ERROR);
$_SERVER['DOCUMENT_ROOT'] = $root . '/host';
require $server . '/lib.php';
$type = $request['type'];
$initial = ['name' => 'Fixture', 'containers' => ['first', 'second'], 'settings' => ['preview_rows' => 2],
    'createdAt' => '2026-01-01T00:00:00+00:00', 'updatedAt' => '2026-02-01T00:00:00+00:00'];
if ($request['operation'] === 'migrated') {
    $initial['membershipPolicy'] = 'folderview3';
    $initial['memberIdentities'] = ['first' => $type === 'vm' ? ['kind' => 'vm', 'uuid' => 'fixture-uuid']
        : ['kind' => 'docker', 'containerId' => 'fixture-container-id']];
}
writeRawFolderMap($type, ['parent' => ['name' => 'Parent'], 'folder' => $initial,
    'child' => ['name' => 'Child', 'parentId' => 'folder']]);
writeTypePrefs($type, ['sortMode' => 'manual', 'manualOrder' => ['parent', 'folder', 'child'],
    'backupSchedule' => ['enabled' => false], 'dockerStartOrder' => ['mode' => 'unmanaged']]);
$folders = readRawFolderMap($type);
readTypePrefs($type);
appendDiagnosticsHistoryEvent('fixture_seed', $type);
$metadata = readConfigMetadata($type, false);
$paths = [];
foreach ([getFolderFilePath($type), getTypePrefsPath($type), getConfigMetadataPath($type), diagnosticsHistoryPath()] as $path) {
    $paths[] = $path; $paths[] = getLastGoodJsonPath($path);
}
$capture = static function () use ($paths): array {
    return array_map(static fn($path) => is_file($path) ? file_get_contents($path) : null, $paths);
};
$before = $capture();
$payload = $folders['folder'];
unset($payload['createdAt'], $payload['updatedAt']);
$payload = array_reverse($payload, true);
$revision = $metadata['folderRevision'];
$operation = $request['operation'];
if ($operation === 'stale') $revision--;
if ($operation === 'appearance') $payload['settings']['preview_rows'] = 4;
if ($operation === 'members') $payload['containers'] = ['second', 'first', 'third'];
if ($operation === 'parent') $payload['parentId'] = 'child';
if ($operation === 'normalized-parent') $payload['parentId'] = 'missing';
if ($operation === 'migrated') unset($payload['membershipPolicy'], $payload['memberIdentities']);
if (in_array($operation, ['noop', 'normalized-parent', 'migrated'], true)) {
    putenv('FVPLUS_STORAGE_FAILURE_INJECTION=1');
    putenv('FVPLUS_STORAGE_FAILURE_STAGE=file-flush');
}
$error = ''; $result = null;
try {
    $result = withConfigMutationLock(static fn() => updateFolder($type, json_encode($payload),
        $operation === 'create' ? '' : 'folder', $revision));
} catch (Throwable $failure) { $error = get_class($failure); }
putenv('FVPLUS_STORAGE_FAILURE_INJECTION'); putenv('FVPLUS_STORAGE_FAILURE_STAGE');
$after = $capture();
$redactor = diagnosticsCreateSupportBundleRedactor('sanitized');
$safeTimings = diagnosticsSupportBundleRedactEventDetails([
    'validationReadMs' => 12, 'folderPersistenceMs' => 34, 'manualOrderSyncMs' => 0,
    'privateNotes' => 'private-value'
], 'details', $redactor);
echo json_encode(['error' => $error, 'result' => $result, 'beforeRevision' => $metadata['folderRevision'],
    'unchanged' => $before === $after, 'folders' => readRawFolderMap($type),
    'history' => readDiagnosticsHistoryEvents(10), 'safeTimings' => $safeTimings], JSON_THROW_ON_ERROR);
