<?php
namespace FolderBoundary {
    function writeRawFolderMap(string $type, array $folders): void {
        \writeRawFolderMap($type, $folders); $GLOBALS['folder_boundary']['written'] = true;
        if (($GLOBALS['folder_boundary']['stage'] ?? '') === 'folders') throw new \RuntimeException('Injected folder write failure.');
    }
    function writeTypePrefs(string $type, array $prefs): array {
        $result = \writeTypePrefs($type, $prefs);
        if (($GLOBALS['folder_boundary']['stage'] ?? '') === 'prefs') throw new \RuntimeException('Injected preference write failure.');
        return $result;
    }
    function syncContainerOrder(string $type): void {
        if (($GLOBALS['folder_boundary']['stage'] ?? '') === 'native') {
            file_put_contents(\fvplusEnvironmentDockerAutostartPath(), 'Injected native mutation.');
            throw new \RuntimeException('Injected native order failure.');
        }
    }
    function readRawFolderMap(string $type): array {
        $value = \readRawFolderMap($type);
        return !empty($GLOBALS['folder_boundary']['written']) && ($GLOBALS['folder_boundary']['stage'] ?? '') === 'readback'
            ? ['tampered' => []] : $value;
    }
}
namespace {
    function fvplus_assert_folder_payload_shape(array $payload): void {}
    class DockerClient {
        public function getDockerContainers(): array { return []; }
        public function getDockerJSON(string $path): array { return []; }
    }
    $server = $argv[1]; $root = $argv[2]; $request = json_decode(file_get_contents($root . '/request.json'), true, 512, JSON_THROW_ON_ERROR);
    $_SERVER['DOCUMENT_ROOT'] = $root . '/host';
    require $server . '/lib.php';
    foreach (['lib.folder-mutations.php', 'lib.folder-rules.php'] as $file) {
        $source = str_replace('__DIR__', var_export($server, true), file_get_contents($server . '/' . $file));
        eval('namespace FolderBoundary; use \\RuntimeException; use \\Throwable; use \\FVPlusConfigConflictException;' . substr($source, 5));
    }
    $type = $request['type'];
    foreach (['docker', 'vm'] as $seedType) {
        writeRawFolderMap($seedType, ['parent' => ['name' => 'Parent'],
            'child' => ['name' => 'Child', 'parentId' => 'parent', 'containers' => ['resource']],
            'target' => ['name' => 'Target']]);
        writeTypePrefs($seedType, ['sortMode' => 'manual', 'manualOrder' => ['parent', 'child', 'target'],
            'backupSchedule' => ['enabled' => false], 'dockerStartOrder' => ['mode' => 'unmanaged']]);
    }
    file_put_contents(fvplusEnvironmentDockerAutostartPath(), "original-native 5\n");
    $paths = fvplusTypeTransactionPaths($type);
    foreach ($paths as $path) if (is_file($path)) chmod($path, 0600);
    $capture = static fn(): array => fvplusEnvironmentCaptureFiles($paths);
    $before = $capture();
    $other = fvplusEnvironmentCaptureFiles(fvplusTypeTransactionPaths($type === 'docker' ? 'vm' : 'docker'));
    $metadata = readConfigMetadata($type, false);
    $GLOBALS['folder_boundary'] = ['stage' => $request['stage'], 'written' => false];
    $error = ''; $result = null;
    try {
        if ($request['operation'] === 'bulk') {
            $result = FolderBoundary\bulkAssignItemsToFolders($type, [['folderId' => 'target', 'items' => ['resource']]], ['resource' => []]);
        } else {
            $child = readRawFolderMap($type)['child']; $child['parentId'] = 'target';
            $result = FolderBoundary\applyFolderBatchOperations($type, ['deletes' => [], 'creates' => [],
                'upserts' => [['id' => 'child', 'folder' => $child]], 'manualOrder' => ['target', 'child', 'parent'],
                'expectedPrefsRevision' => $metadata['prefsRevision']], $metadata['folderRevision']);
        }
    } catch (Throwable $failure) { $error = $failure->getMessage(); }
    $GLOBALS['folder_boundary']['stage'] = '';
    echo json_encode(['error' => $error, 'result' => $result, 'exactRestored' => $before === $capture(),
        'otherUnchanged' => $other === fvplusEnvironmentCaptureFiles(fvplusTypeTransactionPaths($type === 'docker' ? 'vm' : 'docker')),
        'folders' => readRawFolderMap($type), 'prefs' => readTypePrefs($type)], JSON_THROW_ON_ERROR);
}
