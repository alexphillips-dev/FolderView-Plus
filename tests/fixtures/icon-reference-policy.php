<?php
$server = $argv[1]; $root = $argv[2];
$_SERVER['DOCUMENT_ROOT'] = "$root/host";
$request = json_decode(file_get_contents($argv[3] ?? "$root/request.json"), true, 512, JSON_THROW_ON_ERROR);
if (empty($request['noAuthority'])) $_SERVER['HTTP_HOST'] = 'fixture.test';
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

function iconFixtureMutation(string $server, string $file, string $action, array $fields = []): array {
    $_SERVER['SCRIPT_FILENAME'] = "$server/$file";
    $_SERVER['REQUEST_METHOD'] = 'POST';
    $_SERVER['HTTP_ORIGIN'] = 'http://fixture.test';
    $_SERVER['HTTP_X_FV_REQUEST'] = '1';
    $nonce = fvplus_issue_mutation_nonce($file, $action);
    $_POST = $_REQUEST = $fields + ['action' => $action, 'token' => getConfiguredRequestToken(),
        '_fv_nonce' => $nonce['nonce'], '_fv_transaction' => 'tx-icon-reference-fixture-001'];
    $endpoint = file_get_contents("$server/$file");
    $endpoint = preg_replace('~require_once\([^;]+;~', '', $endpoint, 1);
    $endpoint = substr(str_replace('__DIR__', var_export($server, true), $endpoint), 5);
    if ($file === 'diagnostics.php') {
        // The live Docker and VM status refresh is independent of the repaired configuration.
        $endpoint = 'namespace IconReferenceFixture; function getDiagnosticsSnapshot(): array { return []; } ' . $endpoint;
    }
    ob_start(); eval($endpoint); $response = json_decode(ob_get_clean(), true);
    releaseConfigMutationLock();
    return [http_response_code(), $response];
}

if (empty($request['skipSeed'])) {
    $customDir = customIconDirPath();
    @mkdir($customDir, 0770, true);
    @mkdir("$root/source/images/custom", 0770, true);
    file_put_contents("$customDir/before.png", base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j+X8AAAAASUVORK5CYII='));
    chmod("$customDir/before.png", 0640);
    if (!empty($request['collision'])) file_put_contents("$customDir/after.png", 'collision');
    foreach (['docker', 'vm'] as $type) {
        $folders = $request['kind'] === 'folder' && (($request['type'] ?? 'docker') === $type || !empty($request['bothRepairTypes']))
            ? ['fixture' => ['name' => 'Fixture folder', 'icon' => $request['reference'], 'containers' => []]] : [];
        writeRawFolderMap($type, $folders);
        $prefs = defaultTypePrefs();
        if (!empty($request['retainPriorArchives'])) $prefs['backupSchedule']['retention'] = 1;
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
        if (($request['type'] ?? 'docker') === $type && ($request['kind'] ?? '') === 'template') {
            writeFolderTemplates($type, [['id' => 'fixture-template', 'name' => 'Fixture template', 'icon' => $request['reference']]]);
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
    $path = match ($request['kind']) {
        'folder' => getFolderFilePath($type),
        'template' => getTemplatePath($type),
        default => getTypePrefsPath($type)
    };
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
    $capture = static function () use ($root): array {
        return array_filter(@iconFixtureState($root), static fn(string $key): bool => strpos($key, 'security.audit.json') === false, ARRAY_FILTER_USE_KEY);
    };
    ensureConfiguredRequestTokenFile();
    $before = $capture();
    [$status, $response] = iconFixtureMutation($server, 'upload_custom_icon.php', 'delete', ['name' => 'before.png']);
    $exactUnchanged = $before === $capture(); $mirrorProtected = true;
    if (($request['mirrorState'] ?? '') === 'unreadable') {
        clearstatcache(true, $mirrorPath); $mirrorProtected = (fileperms($mirrorPath) & 0777) === 0000;
        chmod($mirrorPath, $mirrorMode); $mirrorProtected = $mirrorProtected && file_get_contents($mirrorPath) === $mirrorBytes;
    }
    echo json_encode(['response' => $response, 'status' => $status,
        'usageCount' => count($usage['before.png'] ?? []), 'diagnosticsCount' => count($diagnostics['before.png'] ?? []),
        'sameProjection' => $usage === $diagnostics, 'observational' => $observational, 'exactUnchanged' => $exactUnchanged, 'mirrorProtected' => $mirrorProtected,
        'missingPrimaryRemainsMissing' => !file_exists($path),
        'mirrorExists' => is_file(getLastGoodJsonPath($path)),
        'iconRetained' => is_file(customIconDirPath() . '/before.png')], JSON_THROW_ON_ERROR); exit;
}

if (($request['policyAction'] ?? '') === 'guarded-delete') {
    [$status, $response] = iconFixtureMutation($server, 'upload_custom_icon.php', 'delete', ['name' => 'before.png']);
    echo json_encode(['status' => $status, 'response' => $response,
        'iconRetained' => is_file(customIconDirPath() . '/before.png')]); exit;
}
if (($request['policyAction'] ?? '') === 'usage') {
    $map = customIconUsageMap();
    $diagnostics = diagnosticsBuildCustomIconUsageMap();
    echo json_encode(['usage' => $map['before.png'] ?? [], 'diagnostics' => $diagnostics['before.png'] ?? []]); exit;
}
if (($request['policyAction'] ?? '') === 'repair') {
    $type = $request['type'] ?? 'docker';
    $templatePath = getTemplatePath($type);
    $templatePaths = [$templatePath, getLastGoodJsonPath($templatePath)];
    if (!empty($request['corruptTemplatePrimary'])) file_put_contents($templatePath, '{broken');
    $originalTemplates = readFolderTemplateFile($templatePath) ?? readFolderTemplateFile($templatePaths[1]);
    unlink(customIconDirPath() . '/before.png');
    if (!is_link(fvplusCustomIconRuntimeDirPath())) unlink(fvplusCustomIconRuntimeDirPath() . '/before.png');
    $beforeUsage = customIconUsageMap();
    $priorArchives = [];
    if (!empty($request['retainPriorArchives'])) {
        foreach (['docker', 'vm'] as $sourceType) {
            $archive = createBackupSnapshot($sourceType, 'before-import');
            $archivePath = getBackupSnapshotPath($sourceType, $archive['name']);
            $priorArchives[$archivePath] = hash_file('sha256', $archivePath);
        }
    }
    if (!empty($request['policyFault'])) {
        $GLOBALS['icon_policy_fault'] = $request['policyFault'];
        $GLOBALS['icon_policy_fault_type'] = $request['policyFaultType'] ?? null;
        eval('namespace IconPolicyFault;
            function scandir(string $path) { return $GLOBALS["icon_policy_fault"] === "inventory" ? false : \\scandir($path); }
            function writeRawFolderMap(string $type, array $folders): void {
                \\writeRawFolderMap($type, $folders);
                if ($GLOBALS["icon_policy_fault"] === "folders" && in_array($GLOBALS["icon_policy_fault_type"], [null, $type], true)) throw new \\RuntimeException("Injected icon folder failure.");
            }
            function writeTypePrefs(string $type, array $prefs): array {
                $saved = \\writeTypePrefs($type, $prefs);
                if ($GLOBALS["icon_policy_fault"] === "prefs") throw new \\RuntimeException("Injected icon preference failure.");
                return $saved;
            }
            function fvplusWriteBackupTemplateRecords(string $type, array $records): void {
                \\fvplusWriteBackupTemplateRecords($type, $records);
                if ($GLOBALS["icon_policy_fault"] === "templates") throw new \\RuntimeException("Injected icon template failure.");
            }');
        eval('namespace IconPolicyFault; use \\RuntimeException; use \\Throwable;' . substr(file_get_contents($server . '/lib.custom-icon-repair.php'), 5));
        $paths = array_merge(fvplusTypeTransactionPaths('docker', false), fvplusTypeTransactionPaths('vm', false), $templatePaths);
        $before = fvplusEnvironmentCaptureFiles($paths); $error = '';
        try { IconPolicyFault\fvplusRepairMissingCustomIconReferences(); }
        catch (Throwable $failure) { $error = $failure->getMessage(); }
        $archivesRetained = true;
        foreach ($priorArchives as $path => $hash) {
            $archivesRetained = $archivesRetained && is_file($path) && hash_file('sha256', $path) === $hash;
        }
        echo json_encode(['error' => $error, 'exactRestored' => $before === fvplusEnvironmentCaptureFiles($paths),
            'archivesRetained' => $archivesRetained]); exit;
    }
    $paths = array_merge(fvplusTypeTransactionPaths('docker', false), fvplusTypeTransactionPaths('vm', false), $templatePaths);
    $before = fvplusEnvironmentCaptureFiles($paths);
    [$status, $response] = iconFixtureMutation($server, 'diagnostics.php', 'repair_missing_custom_icons', ['type' => $request['type']]);
    $result = $response['repair'] ?? null;
    $afterUsage = customIconUsageMap();
    $output = ['beforeCount' => count($beforeUsage['before.png'] ?? []), 'result' => $result, 'response' => $response,
        'status' => $status, 'configUnchanged' => $before === fvplusEnvironmentCaptureFiles($paths),
        'afterCount' => count($afterUsage['before.png'] ?? []),
        'archiveCounts' => array_column(listBackupSnapshots($type), 'count')];
    if (!empty($request['verifyTemplateRepair'])) {
        $output['retainedTemplateFields'] = readFolderTemplateFile($templatePath) === array_replace($originalTemplates,
            [0 => array_replace($originalTemplates[0], ['icon' => ''])]);
        $output['mirrorMatches'] = readFolderTemplateFile($templatePath) === readFolderTemplateFile($templatePaths[1]);
        $output['repeatCount'] = fvplusRepairMissingCustomIconReferences()['repairedFolderCount'];
        $restore = restoreLatestUndoBackupSnapshot($type);
        $output['undoRestoredTemplates'] = ($restore['templatesRestored'] ?? false)
            && $originalTemplates === readFolderTemplateFile($templatePath)
            && $originalTemplates === readFolderTemplateFile($templatePaths[1]);
        $modified = $originalTemplates;
        $modified[0]['name'] = 'Other fixture name';
        writeJsonObjectWithLastGood($templatePath, $modified);
        $output['undoRechecksTemplateChange'] = restoreLatestUndoBackupSnapshot($type)['name'] === $restore['name']
            && $originalTemplates === readFolderTemplateFile($templatePath);
        fvplusRepairMissingCustomIconReferences();
        writeRawFolderMap($type, ['fixture' => ['name' => 'Fixture folder']]);
        applyFolderTemplateToFolder($type, 'fixture-template', 'fixture');
        $output['reapplyKeepsReferenceRemoved'] = !isset(customIconUsageMap()['before.png']);
    }
    echo json_encode($output); exit;
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
