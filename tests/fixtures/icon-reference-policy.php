<?php
$server = $argv[1]; $root = $argv[2];
$_SERVER['DOCUMENT_ROOT'] = "$root/host";
$request = json_decode(file_get_contents($argv[3] ?? "$root/request.json"), true, 512, JSON_THROW_ON_ERROR);
if (($request['runtimeMode'] ?? 'copy') === 'copy') {
    @mkdir("$root/source/images/custom", 0770, true);
    file_put_contents("$root/source/images/custom/fixture-unmanaged.txt", 'keep');
}
require "$server/lib.php";
require "$server/lib.custom-icon-endpoint-foundation.php";
require "$server/lib.custom-icon-validation.php";
require $request['originalActions'] ?? "$server/lib.custom-icon-actions.php";
if (!empty($request['waitStart'])) {
    file_put_contents("$root/" . $request['ready'], 'ready');
    $deadline = microtime(true) + 15;
    while (!file_exists("$root/" . $request['waitStart'])) {
        if (microtime(true) > $deadline) throw new RuntimeException('Fixture start timeout');
        usleep(10000);
    }
}

function iconFixtureState(string $root): array {
    $result = [];
    foreach (["$root/config", "$root/source/images/custom"] as $base) {
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($base, FilesystemIterator::SKIP_DOTS));
        foreach ($iterator as $entry) {
            if (!$entry->isFile() || strpos($entry->getFilename(), '.lock') !== false) continue;
            $path = $entry->getPathname();
            $result[str_replace('\\', '/', substr($path, strlen($root) + 1))] = [base64_encode(file_get_contents($path)), fileperms($path) & 0777];
        }
    }
    ksort($result); return $result;
}

if (empty($request['skipSeed'])) {
    $customDir = customIconDirPath();
    @mkdir($customDir, 0770, true);
    @mkdir("$root/source/images/custom", 0770, true);
    file_put_contents("$customDir/before.png", base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j+X8AAAAASUVORK5CYII='));
    chmod("$customDir/before.png", 0640);
    if (!empty($request['collision'])) file_put_contents("$customDir/after.png", 'collision');
    foreach (['docker', 'vm'] as $type) {
        $folders = $request['kind'] === 'folder' && ($request['type'] ?? 'docker') === $type
            ? ['fixture' => ['name' => 'Fixture folder', 'icon' => $request['reference'], 'containers' => []]] : [];
        writeRawFolderMap($type, $folders);
        $prefs = defaultTypePrefs();
        if (($request['type'] ?? 'docker') === $type && ($request['kind'] ?? '') === 'defaults') {
            $prefs['folderDefaults']['profile']['icon'] = $request['reference'];
        }
        if (($request['type'] ?? 'docker') === $type && ($request['kind'] ?? '') === 'group') {
            $prefs['folderGroups'] = [['id' => 'custom:fixture', 'name' => 'Fixture group', 'folders' => [['name' => 'Future folder', 'icon' => $request['reference']]]]];
        }
        writeTypePrefs($type, $prefs);
        if (($request['type'] ?? 'docker') === $type && ($request['kind'] ?? '') === 'group') {
            // Preserve legacy persisted aliases that current normalization would replace.
            $raw = readJsonObjectFile(getTypePrefsPath($type));
            $raw['folderGroups'][0]['folders'][0]['icon'] = $request['reference'];
            writeJsonObjectWithLastGood(getTypePrefsPath($type), $raw);
        }
    }
    syncCustomIconMetadataIndex($customDir);
    syncCustomIconPublicRuntime();
}
if (!empty($request['seedOnly'])) { echo json_encode(['seeded' => true]); exit; }
if (!empty($request['holdSave'])) {
    withConfigMutationLock(static function () use ($root): void {
        file_put_contents("$root/save-locked", 'ready');
        $deadline = microtime(true) + 15;
        while (!file_exists("$root/release-save")) {
            if (microtime(true) > $deadline) throw new RuntimeException('Fixture release timeout');
            usleep(10000);
        }
        writeRawFolderMap('docker', ['concurrent' => ['name' => 'Concurrent folder', 'icon' => '/plugins/folderview.plus/images/custom/before.png', 'containers' => []]]);
    });
    echo json_encode(['saved' => true]); exit;
}
if (!empty($request['corrupt'])) file_put_contents(getTypePrefsPath('vm'), '{broken');

if (($request['policyAction'] ?? '') === 'recoverable') {
    $type = $request['type'];
    $path = $request['kind'] === 'folder' ? getFolderFilePath($type) : getTypePrefsPath($type);
    if (($request['unavailable'] ?? 'missing') === 'malformed') file_put_contents($path, '{broken');
    else unlink($path);
    $mirrorPath = getLastGoodJsonPath($path);
    $mirrorBytes = file_get_contents($mirrorPath); $mirrorMode = fileperms($mirrorPath) & 0777;
    if (($request['mirrorState'] ?? '') === 'symlink') {
        $outside = $root . '/outside-reference-owner.json'; file_put_contents($outside, $mirrorBytes);
        unlink($mirrorPath);
        if (!@symlink($outside, $mirrorPath)) { echo json_encode(['unsupportedSymlink' => true]); exit; }
    }
    if (($request['mirrorState'] ?? '') === 'unreadable') {
        @chmod($mirrorPath, 0000); clearstatcache(true, $mirrorPath);
        if (is_readable($mirrorPath)) { echo json_encode(['unsupportedPermissions' => true]); exit; }
    }
    $primaryBefore = is_file($path) ? file_get_contents($path) : null;
    $usage = customIconUsageMap(); $diagnostics = diagnosticsBuildCustomIconUsageMap();
    $observational = $primaryBefore === (is_file($path) ? file_get_contents($path) : null);
    $_SERVER['SCRIPT_FILENAME'] = $server . '/upload_custom_icon.php';
    $_SERVER['REQUEST_METHOD'] = 'POST'; $_SERVER['HTTP_HOST'] = 'fixture.test';
    $_SERVER['HTTP_ORIGIN'] = 'http://fixture.test'; $_SERVER['HTTP_X_FV_REQUEST'] = '1';
    $nonce = fvplus_issue_mutation_nonce('upload_custom_icon.php', 'delete');
    $_POST = ['action' => 'delete', 'name' => 'before.png', 'token' => getConfiguredRequestToken(),
        '_fv_nonce' => $nonce['nonce'], '_fv_transaction' => 'tx-lastgood-icon-delete-001'];
    $_REQUEST = $_POST;
    $capture = static function () use ($root): array {
        return array_filter(@iconFixtureState($root), static fn(string $key): bool => strpos($key, 'security.audit.json') === false, ARRAY_FILTER_USE_KEY);
    };
    $before = $capture();
    $endpoint = file_get_contents($server . '/upload_custom_icon.php');
    $endpoint = preg_replace('~require_once\([^;]+;~', '', $endpoint, 1);
    $endpoint = str_replace('__DIR__', var_export($server, true), $endpoint);
    ob_start(); eval(substr($endpoint, 5)); $response = json_decode(ob_get_clean(), true);
    $exactUnchanged = $before === $capture(); $mirrorProtected = true;
    if (($request['mirrorState'] ?? '') === 'unreadable') {
        clearstatcache(true, $mirrorPath); $mirrorProtected = (fileperms($mirrorPath) & 0777) === 0000;
        chmod($mirrorPath, $mirrorMode); $mirrorProtected = $mirrorProtected && file_get_contents($mirrorPath) === $mirrorBytes;
    }
    echo json_encode(['response' => $response, 'status' => http_response_code(),
        'usageCount' => count($usage['before.png'] ?? []), 'diagnosticsCount' => count($diagnostics['before.png'] ?? []),
        'sameProjection' => $usage === $diagnostics, 'observational' => $observational, 'exactUnchanged' => $exactUnchanged, 'mirrorProtected' => $mirrorProtected,
        'missingPrimaryRemainsMissing' => !file_exists($path),
        'mirrorExists' => is_file(getLastGoodJsonPath($path)),
        'iconRetained' => is_file(customIconDirPath() . '/before.png')], JSON_THROW_ON_ERROR); exit;
}

if (($request['policyAction'] ?? '') === 'usage') {
    $map = customIconUsageMap();
    $diagnostics = diagnosticsBuildCustomIconUsageMap();
    echo json_encode(['usage' => $map['before.png'] ?? [], 'diagnostics' => $diagnostics['before.png'] ?? []]); exit;
}
if (($request['policyAction'] ?? '') === 'repair') {
    unlink(customIconDirPath() . '/before.png');
    if (!is_link(fvplusCustomIconRuntimeDirPath())) unlink(fvplusCustomIconRuntimeDirPath() . '/before.png');
    $beforeUsage = customIconUsageMap();
    if (!empty($request['policyFault'])) {
        $GLOBALS['icon_policy_fault'] = $request['policyFault'];
        eval('namespace IconPolicyFault;
            function scandir(string $path) { return $GLOBALS["icon_policy_fault"] === "inventory" ? false : \\scandir($path); }
            function writeRawFolderMap(string $type, array $folders): void {
                \\writeRawFolderMap($type, $folders);
                if ($GLOBALS["icon_policy_fault"] === "folders") throw new \\RuntimeException("Injected icon folder failure.");
            }
            function writeTypePrefs(string $type, array $prefs): array {
                $saved = \\writeTypePrefs($type, $prefs);
                if ($GLOBALS["icon_policy_fault"] === "prefs") throw new \\RuntimeException("Injected icon preference failure.");
                return $saved;
            }');
        eval('namespace IconPolicyFault; use \\RuntimeException; use \\Throwable;' . substr(file_get_contents($server . '/lib.custom-icon-repair.php'), 5));
        $paths = array_merge(fvplusTypeTransactionPaths('docker', false), fvplusTypeTransactionPaths('vm', false));
        $before = fvplusEnvironmentCaptureFiles($paths); $error = '';
        try { IconPolicyFault\fvplusRepairMissingCustomIconReferences(); }
        catch (Throwable $failure) { $error = $failure->getMessage(); }
        echo json_encode(['error' => $error, 'exactRestored' => $before === fvplusEnvironmentCaptureFiles($paths)]); exit;
    }
    $result = fvplusRepairMissingCustomIconReferences();
    $afterUsage = customIconUsageMap();
    echo json_encode(['beforeCount' => count($beforeUsage['before.png'] ?? []), 'result' => $result,
        'afterCount' => count($afterUsage['before.png'] ?? [])]); exit;
}
$before = iconFixtureState($root);
$_POST = ['from' => 'before.png', 'to' => $request['to'] ?? 'after', 'selectedIcon' => $request['selectedIcon'] ?? '', 'name' => 'before.png'];
if (!empty($request['fault'])) {
    $GLOBALS['icon_fixture_fault'] = $request['fault'];
    eval('namespace IconRenameFault; use \\RuntimeException; use \\Throwable; '
        . substr(file_get_contents("$server/lib.custom-icon-rename.php"), 5));
    eval('namespace IconRenameFault;
        function writeCustomIconMetadataIndex(array $meta): void {
            \\writeCustomIconMetadataIndex($meta);
            if ($GLOBALS["icon_fixture_fault"] === "metadata") {
                $GLOBALS["icon_fixture_fault"] = "";
                throw new \\RuntimeException("Synthetic metadata failure after commit");
            }
        }
        function fvplusMirrorPersistentCustomIconsToRuntime(): array {
            $result = \\fvplusMirrorPersistentCustomIconsToRuntime();
            if ($GLOBALS["icon_fixture_fault"] === "mirror") {
                $GLOBALS["icon_fixture_fault"] = "";
                throw new \\RuntimeException("Synthetic mirror failure after publication");
            }
            return $result;
        }');
}
try {
    $response = !empty($request['contender'])
        ? withCustomIconLock(true, static function () use ($root): array {
            file_put_contents("$root/rename-locked", 'ready');
            return withConfigMutationLock('renameCustomIconUnlocked');
        })
        : (!empty($request['fault'])
        ? withCustomIconLock(true, static fn(): array => withConfigMutationLock('IconRenameFault\\renameCustomIconUnlocked'))
        : (($request['action'] ?? 'rename') === 'delete' ? handleCustomIconDeleteAction() : handleCustomIconRenameAction()));
    $error = null;
} catch (Throwable $failure) { $response = null; $error = $failure->getMessage(); }
echo json_encode(['error' => $error, 'response' => $response, 'runtimeLinked' => is_link(fvplusCustomIconRuntimeDirPath()),
    'before' => $before, 'after' => iconFixtureState($root)], JSON_THROW_ON_ERROR);
