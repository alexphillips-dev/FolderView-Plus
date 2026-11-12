<?php
namespace AuditRead {
    function readConfigMetadata(string $type, bool $reconcile = true): array {
        $probe = fopen(\getConfigMutationLockPath(), 'c+');
        $available = flock($probe, LOCK_EX | LOCK_NB);
        if ($available) flock($probe, LOCK_UN);
        fclose($probe);
        $GLOBALS['contenderCouldWrite'] = $available;
        if ($available) {
            if ($GLOBALS['mode'] === 'folder') \writeRawFolderMap($type, ['new' => ['name' => 'New fixture']]);
            else \writeTypePrefs($type, ['sortMode' => 'alpha']);
        }
        return \readConfigMetadata($type, $reconcile);
    }
    function syncContainerOrder(string $type): void {}
    function writeRawFolderMap(string $type, array $folders): void {
        \writeRawFolderMap($type, $folders);
        if (!empty($GLOBALS['bulkFault'])) {
            $GLOBALS['bulkFault'] = false;
            throw new \RuntimeException('Injected bulk commit failure');
        }
    }
    function writeCustomIconMetadataIndex(array $meta): void {
        \writeCustomIconMetadataIndex($meta);
        if (($GLOBALS['deleteFault'] ?? '') === 'metadata') {
            $GLOBALS['deleteFault'] = '';
            throw new \RuntimeException('Injected metadata failure');
        }
    }
    function fvplusMirrorPersistentCustomIconsToRuntime(): array {
        if (($GLOBALS['deleteFault'] ?? '') === 'mirror') {
            $GLOBALS['deleteFault'] = '';
            return ['ready' => false];
        }
        return \fvplusMirrorPersistentCustomIconsToRuntime();
    }
}
namespace {
    $server = $argv[1]; $root = $argv[2]; $mode = $argv[3];
    foreach (['config', 'source', 'host'] as $dir) mkdir("$root/$dir", 0700, true);
    putenv("FVPLUS_TEST_CONFIG_DIR=$root/config");
    putenv("FVPLUS_TEST_SOURCE_DIR=$root/source");
    putenv("FVPLUS_TEST_DOCKER_AUTOSTART_FILE=$root/config/native-autostart");
    $_SERVER['DOCUMENT_ROOT'] = "$root/host";
    require "$server/lib.php";
    if ($mode === 'folder' || $mode === 'prefs') {
        writeRawFolderMap('vm', ['old' => ['name' => 'Old fixture']]);
        writeTypePrefs('vm', ['sortMode' => 'created']);
        $before = readConfigMetadata('vm');
        $endpoint = $mode === 'folder' ? 'read.php' : 'prefs.php';
        $_SERVER['REQUEST_METHOD'] = 'GET';
        $_SERVER['SCRIPT_FILENAME'] = "$server/$endpoint";
        $_GET = $_REQUEST = ['type' => 'vm', 'includeMetadata' => '1'];
        $source = preg_replace('/^<\?php\s*/', '', file_get_contents("$server/$endpoint"));
        $source = preg_replace('/^require_once\([^\n]+\);\s*$/m', '', $source);
        ob_start();
        eval('namespace AuditRead;' . str_replace('?>', '', $source));
        $response = json_decode(ob_get_clean(), true);
        echo json_encode(['blocked' => !$GLOBALS['contenderCouldWrite'], 'before' => $before,
            'response' => $response, 'persisted' => readConfigMetadata('vm')]);
    } elseif ($mode === 'bulk') {
        $type = $argv[4];
        $identity = $type === 'vm' ? ['kind' => 'vm', 'uuid' => 'fixture-uuid']
            : ['kind' => 'docker', 'containerId' => str_repeat('a', 64), 'image' => 'fixture:latest'];
        writeRawFolderMap($type, ['source' => ['name' => 'Source', 'containers' => ['fixture-member'],
            'memberIdentities' => ['fixture-member' => $identity]], 'target' => ['name' => 'Target']]);
        if (($argv[5] ?? '') === 'collision') {
            $folders = readRawFolderMap($type);
            $folders['target']['containers'] = ['fixture-member'];
            $identity[$type === 'vm' ? 'uuid' : 'containerId'] = $type === 'vm' ? 'target-uuid' : str_repeat('b', 64);
            $folders['target']['memberIdentities'] = ['fixture-member' => $identity];
            writeRawFolderMap($type, $folders);
        }
        $before = readRawFolderMap($type);
        // Only host Docker order synchronization is replaced; all configuration I/O is real.
        $source = str_replace('__DIR__', var_export($server, true), substr(file_get_contents("$server/lib.folder-rules.php"), 5));
        eval('namespace AuditRead; use \\RuntimeException; use \\Throwable;' . $source);
        $GLOBALS['bulkFault'] = ($argv[5] ?? '') === 'rollback';
        $snapshots = fvplusEnvironmentCaptureFiles(fvplusTypeTransactionPaths($type));
        $error = ''; $result = null;
        try { $result = \AuditRead\bulkAssignItemsToFolders($type, [['folderId' => 'target', 'items' => ['fixture-member']]], ['fixture-member' => []]); }
        catch (Throwable $failure) { $error = $failure->getMessage(); }
        $restored = $snapshots === fvplusEnvironmentCaptureFiles(fvplusTypeTransactionPaths($type));
        echo json_encode(['result' => $result, 'before' => $before, 'after' => readRawFolderMap($type), 'error' => $error, 'restored' => $restored]);
    } elseif ($mode === 'delete') {
        require "$server/lib.custom-icon-endpoint-foundation.php";
        require "$server/lib.custom-icon-validation.php";
        require "$server/lib.custom-icon-actions.php";
        $runtime = fvplusCustomIconRuntimeDirPath();
        $mirror = ($argv[4] ?? '') === 'mirror';
        if ($mirror) {
            if (is_link($runtime)) unlink($runtime);
            if (!is_dir($runtime)) mkdir($runtime, 0700, true);
            file_put_contents("$runtime/!unmanaged.txt", 'keep');
        }
        $icon = customIconDirPath() . '/fixture.png';
        file_put_contents($icon, base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j+X8AAAAASUVORK5CYII='));
        syncCustomIconMetadataIndex(customIconDirPath());
        fvplusEnsureCustomIconStorageReady(false);
        if ($mirror) copy(customIconMetadataPath(), "$runtime/.metadata.json");
        $paths = [$icon, customIconMetadataPath(), getLastGoodJsonPath(customIconMetadataPath())];
        if ($mirror) $paths = array_merge($paths, ["$runtime/fixture.png", "$runtime/.metadata.json"]);
        $before = array_map('fvplusTransactionCaptureFile', $paths);
        $source = str_replace('__DIR__', var_export($server, true), substr(file_get_contents("$server/lib.custom-icon-actions.php"), 5));
        eval('namespace AuditRead; use \\RuntimeException; use \\Throwable;' . $source);
        $_POST = ['name' => 'fixture.png'];
        $GLOBALS['deleteFault'] = $argv[5] ?? '';
        $error = '';
        try { $result = \AuditRead\handleCustomIconDeleteAction(); }
        catch (Throwable $failure) { $error = $failure->getMessage(); }
        clearstatcache();
        $after = array_map('fvplusTransactionCaptureFile', $paths);
        $restored = $before === $after;
        if ($error !== '') $result = \AuditRead\handleCustomIconDeleteAction();
        clearstatcache();
        echo json_encode(['error' => $error, 'restored' => $restored, 'deleted' => $result['deleted'],
            'persistentExists' => file_exists($icon), 'publicExists' => file_exists("$runtime/fixture.png"),
            'metadataContainsIcon' => isset(readCustomIconMetadataIndex()['fixture.png'])]);
    } elseif ($mode === 'migration') {
        $runtime = fvplusCustomIconRuntimeDirPath();
        if (is_link($runtime)) unlink($runtime);
        if (!is_dir($runtime)) mkdir($runtime, 0700, true);
        file_put_contents("$runtime/only-copy.png", 'synthetic-icon-bytes');
        if (($argv[4] ?? '') === 'mirror') file_put_contents("$runtime/000-unmanaged.txt", 'keep');
        putenv('FVPLUS_STORAGE_FAILURE_INJECTION=1');
        putenv('FVPLUS_STORAGE_FAILURE_STAGE=temp-write');
        $error = '';
        try { fvplusEnsureCustomIconStorageReady(); } catch (Throwable $failure) { $error = $failure->getMessage(); }
        clearstatcache();
        $preserved = !is_link($runtime) && file_get_contents("$runtime/only-copy.png") === 'synthetic-icon-bytes';
        putenv('FVPLUS_STORAGE_FAILURE_INJECTION=0');
        putenv('FVPLUS_STORAGE_FAILURE_STAGE=');
        $health = fvplusEnsureCustomIconStorageReady();
        echo json_encode(['error' => $error, 'preserved' => $preserved, 'ready' => $health['publicReady'],
            'persistent' => file_get_contents(fvplusCustomIconDirPath() . '/only-copy.png'),
            'public' => file_get_contents("$runtime/only-copy.png")]);
    }
}
