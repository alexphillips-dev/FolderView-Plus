<?php
namespace InventoryRepairFixture {
    function syncContainerOrder(string $type): void {
        $GLOBALS['inventory_order_calls'][] = $type;
        if (!empty($GLOBALS['inventory_request']['repairSyncFailure'])) {
            file_put_contents(\fvplusEnvironmentDockerAutostartPath(), 'Modified native order');
            throw new \RuntimeException('Injected late Docker order failure.');
        }
    }
    function writeRawFolderMap(string $type, array $folders): void {
        if (empty($GLOBALS['inventory_request']['repairWriteFailure'])) { \writeRawFolderMap($type, $folders); return; }
        putenv('FVPLUS_STORAGE_FAILURE_INJECTION=1');
        putenv('FVPLUS_STORAGE_FAILURE_STAGE=rename');
        try { \writeRawFolderMap($type, $folders); }
        finally { putenv('FVPLUS_STORAGE_FAILURE_INJECTION'); putenv('FVPLUS_STORAGE_FAILURE_STAGE'); }
    }
}
namespace InventorySyncFixture {
    function applyDockerStartOrderSequenceWaits(array $lines, array $sequence): array {
        if (!empty($GLOBALS['inventory_request']['hostChange'])) {
            $path = $GLOBALS['inventory_native_path'];
            $code = 'file_put_contents(' . var_export($path, true) . ', "docker-extra 88\\ndocker-present 99\\n");';
            $process = proc_open([PHP_BINARY, '-r', $code], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
            if (!is_resource($process)) throw new \RuntimeException('Fixture native writer unavailable');
            foreach ($pipes as $pipe) { stream_get_contents($pipe); fclose($pipe); }
            if (proc_close($process) !== 0) throw new \RuntimeException('Fixture native writer failed');
            $GLOBALS['inventory_host_written'] = file_get_contents($path);
        }
        return \applyDockerStartOrderSequenceWaits($lines, $sequence);
    }
}
namespace {
    function var_split($line, $index = 0): string { return array_pad(explode(' ', $line), $index + 1, '')[$index]; }
    class DockerUtil {
        public static function loadJSON($path): array { return is_file($path) ? (json_decode(file_get_contents($path), true) ?: []) : []; }
        public static function ensureImageTag(string $image): string { return $image; }
        public static function driver(): array { return []; }
        public static function host(): string { return '127.0.0.1'; }
    }
    class DockerTemplates { public function getTemplates(string $scope): array { return []; } }
    class DockerUpdate {
        public function getUpdateStatus($image): ?bool {
            $GLOBALS['inventory_calls'][] = ['image-cache', $image];
            return $GLOBALS['inventory_request']['imageCache'][$image] ?? null;
        }
    }
    class DockerClient {
        public function getDockerContainers(): array {
            $GLOBALS['inventory_calls'][] = ['docker-cached-list'];
            if ($GLOBALS['inventory_request']['scenario'] === 'stale-cache') return [['Name' => 'cached-gone']];
            return array_map(static fn ($item) => ['Name' => ltrim($item['Names'][0] ?? '', '/')], $GLOBALS['inventory_docker']);
        }
        public function getDockerJSON($url, $method = 'GET', &$code = null, $callback = null, $unchunk = false) {
            $request = $GLOBALS['inventory_request']; $scenario = $request['scenario'];
            $GLOBALS['inventory_calls'][] = ['docker-list', func_num_args(), $unchunk];
            if ($scenario === 'socket-output' || ($scenario === 'late-socket-output' &&
                count(array_filter($GLOBALS['inventory_calls'], static fn($call) => $call[0] === 'docker-list')) === 2)) {
                echo 'synthetic-private-socket-detail';
                return [];
            }
            $code = in_array($scenario, ['failed-list', 'disabled'], true) ? null : ($scenario === 'http-error' ? 'Error code 500' : true);
            $items = $GLOBALS['inventory_docker'];
            if (in_array($scenario, ['failed-list', 'disabled', 'http-error'], true)) $items = [];
            if ($scenario === 'empty') $items = [];
            $body = $scenario === 'malformed-body' ? '[' : json_encode($items);
            if ($scenario === 'multiline') $body = json_encode($items, JSON_PRETTY_PRINT);
            if ($scenario === 'object-body') $body = '{}';
            if ($scenario === 'missing-body') $body = '';
            if ($callback) {
                if (!empty($request['rejectVerifiedInventory'])) $code = null;
                if ($scenario === 'echo-error') { echo 'private-socket-marker'; $code = null; }
                foreach (explode("\n", $body) as $line) $callback($line . "\n");
                if (!empty($request['failNativeWrite'])) {
                    putenv('FVPLUS_STORAGE_FAILURE_INJECTION=1');
                    putenv('FVPLUS_STORAGE_FAILURE_STAGE=rename');
                }
            }
            return $scenario === 'multiline' ? [] : $items;
        }
        public function getContainerDetails($id) {
            $GLOBALS['inventory_calls'][] = ['docker-detail'];
            if ($GLOBALS['inventory_request']['scenario'] === 'failed-detail') return [];
            if ($GLOBALS['inventory_request']['scenario'] === 'detail-output') {
                echo 'synthetic-private-socket-detail';
                return [];
            }
            $name = 'docker-present';
            foreach ($GLOBALS['inventory_docker'] as $item) if (($item['Id'] ?? '') === $id) $name = ltrim($item['Names'][0] ?? '', '/');
            if (isset($GLOBALS['inventory_request']['details'][$name])) return ['Name' => "/$name"] + $GLOBALS['inventory_request']['details'][$name];
            return ['Name' => "/$name", 'Config' => ['Image' => 'fixture/image:latest'],
                'State' => ['Running' => false], 'HostConfig' => ['NetworkMode' => 'host']];
        }
    }
    class Libvirt {
        public bool $stale = false;
        public function connect(): bool {
            $GLOBALS['inventory_calls'][] = ['vm-connect'];
            return !in_array($GLOBALS['inventory_request']['scenario'], ['failed-connect', 'disabled'], true);
        }
        public function get_domains() {
            $GLOBALS['inventory_calls'][] = ['vm-wrapper-list'];
            if ($this->stale) return ['cached-gone'];
            $items = libvirt_list_domains(null);
            return $items ?: false; // Characterize Unraid's empty-list truthiness wrapper.
        }
        public function get_domain_by_name($name) {
            return $GLOBALS['inventory_request']['scenario'] === 'failed-lookup' ? false : $name;
        }
        public function domain_get_info($name) {
            if ($this->stale) return false;
            if ($GLOBALS['inventory_request']['scenario'] === 'missing-state') return [];
            if ($GLOBALS['inventory_request']['scenario'] === 'failed-detail' && $name === 'vm-extra') return false;
            return ['state' => 1];
        }
        public function domain_state_translate($state): string { return 'running'; }
        public function domain_get_uuid($name): string {
            return $GLOBALS['inventory_request']['scenario'] === 'missing-uuid' ? '' : '00000000-0000-0000-0000-000000000001';
        }
        public function domain_get_autostart($name): bool { return false; }
        public function domain_get_description($name): string { return ''; }
        public function domain_get_icon_url($name): string { return ''; }
    }
    function libvirt_connect($uri, $readonly) {
        $GLOBALS['inventory_calls'][] = ['vm-native-connect', $readonly];
        return $GLOBALS['inventory_request']['scenario'] === 'failed-native-connect' ? false : true;
    }
    function libvirt_list_domains($connection) {
        $GLOBALS['inventory_calls'][] = ['vm-native-list'];
        $scenario = $GLOBALS['inventory_request']['scenario'];
        if ($scenario === 'failed-list') return false;
        if ($scenario === 'empty') return [];
        if ($scenario === 'malformed-list') return ['vm-present', null];
        if ($scenario === 'duplicate') return ['vm-present', 'vm-present'];
        if ($scenario === 'renamed') return ['vm-renamed'];
        return $scenario === 'failed-detail' ? ['vm-present', 'vm-extra'] : ['vm-present'];
    }
    $server = $argv[1]; $root = $argv[2];
    $GLOBALS['inventory_request'] = json_decode(file_get_contents("$root/request.json"), true, 512, JSON_THROW_ON_ERROR);
    $GLOBALS['inventory_calls'] = []; $GLOBALS['inventory_order_calls'] = [];
    $request = $GLOBALS['inventory_request']; $type = $request['type'];
    $operation = $request['operation'] ?? 'repair';
    $name = $request['scenario'] === 'renamed' ? 'docker-renamed' : 'docker-present';
    $GLOBALS['inventory_docker'] = [['Id' => str_repeat('a', 64), 'Names' => ["/$name"],
        'Labels' => ['net.unraid.docker.managed' => 'composeman'], 'Image' => 'fixture/image:latest', 'State' => 'exited']];
    if ($request['scenario'] === 'malformed-list') $GLOBALS['inventory_docker'][] = ['Names' => []];
    if ($request['scenario'] === 'duplicate') $GLOBALS['inventory_docker'][] = $GLOBALS['inventory_docker'][0];
    if ($operation !== 'repair' && !in_array($request['scenario'], ['empty', 'malformed-list', 'duplicate'], true)) {
        $extra = $GLOBALS['inventory_docker'][0]; $extra['Id'] = str_repeat('b', 64); $extra['Names'] = ['/docker-extra'];
        $GLOBALS['inventory_docker'][] = $extra;
    }
    if (isset($request['docker'])) $GLOBALS['inventory_docker'] = $request['docker'];
    if (isset($request['uiCache'])) file_put_contents("$root/config/docker-ui.json", json_encode($request['uiCache']));
    $_SERVER['DOCUMENT_ROOT'] = "$root/host";
    putenv("FVPLUS_TEST_SECURITY_STATE_PATH=$root/config/fixture-security.json");
    require "$server/lib.php"; require "$server/lib.i18n.php";
    $storageSource = str_replace('__DIR__', var_export($server, true), file_get_contents("$server/lib.custom-icon-storage.php"));
    eval('namespace InventoryRepairFixture; use \\RuntimeException; use \\Throwable;' . substr($storageSource, 5));
    $dockerManPaths = ['autostart-file' => "$root/config/native-autostart", 'webui-info' => "$root/config/docker-ui.json"];
    $GLOBALS['inventory_native_path'] = "$root/config/native-autostart";
    putenv("FVPLUS_TEST_DOCKER_AUTOSTART_FILE=$root/config/native-autostart");
    foreach (['docker', 'vm'] as $seedType) {
        $members = ["$seedType-present", "$seedType-missing"];
        if ($request['scenario'] === 'failed-detail' && $seedType === 'vm') $members[] = 'vm-extra';
        $folder = $seedType === 'docker' && isset($request['dockerFolder'])
            ? $request['dockerFolder'] : ['name' => 'Fixture', 'containers' => $members];
        if ($request['scenario'] === 'renamed') $folder['memberIdentities']["$seedType-present"] = $seedType === 'docker'
            ? ['kind' => 'docker', 'containerId' => str_repeat('a', 64)]
            : ['kind' => 'vm', 'uuid' => '00000000-0000-0000-0000-000000000001'];
        writeRawFolderMap($seedType, $seedType === 'docker' && isset($request['dockerFolders'])
            ? $request['dockerFolders'] : ['fixture' => $folder]);
        $prefs = ['backupSchedule' => ['enabled' => false, 'retention' => empty($request['retainPriorBackup']) ? 25 : 1]];
        if ($operation !== 'repair' && $seedType === 'docker') $prefs['dockerStartOrder'] = $request['plan'] ?? ['mode' => 'docker-page'];
        writeTypePrefs($seedType, $prefs);
    }
    if (isset($request['peerFolderName'])) {
        $peerFolders = readRawFolderMap($type);
        $peerFolders['root']['name'] = $request['peerFolderName'];
        writeRawFolderMap($type, $peerFolders);
    }
    $priorBackup = !empty($request['retainPriorBackup']) ? createBackupSnapshot($type, 'manual') : null;
    $priorPath = $priorBackup === null ? null : getBackupSnapshotPath($type, $priorBackup['name']);
    $priorHash = $priorPath === null ? null : hash_file('sha256', $priorPath);
    if (!empty($request['failRepairHistory'])) mkdir(diagnosticsHistoryPath());
    file_put_contents("$root/config/native-autostart", "docker-present 0\nstale-host-entry 0\n");
    if ($operation !== 'repair') file_put_contents("$root/config/native-autostart", "docker-extra 19\r\n\r\ndocker-present 7\nstale-host-entry 31\n");
    if (isset($request['nativeAutostart'])) file_put_contents("$root/config/native-autostart", $request['nativeAutostart']);
    if (isset($request['nativePageOrder'])) file_put_contents("$root/config/native-userprefs", $request['nativePageOrder']);
    if ($request['scenario'] === 'stale-cache') {
        writeReadInfoCache($type, 'state', ['cached-gone' => []]);
        writeReadInfoCache($type, 'full', ['cached-gone' => []]);
        $lv = new Libvirt(); $lv->stale = true;
    }
    if (isset($request['cachedRuntimeDetails'])) {
        fv3_write_json_cache_payload(getReadInfoCachePath('docker', 'full'), [
            'type' => 'docker', 'mode' => 'full', 'data' => $request['cachedRuntimeDetails']
        ]);
    }
    if (!empty($request['corruptConfig'])) file_put_contents("$root/config/$type.json", '{');
    $folderFile = getFolderFilePath($type);
    $folderData = [
        'corrupt' => '{',
        'scalar' => 'true',
        'invalid-folder' => '{"fixture":true}',
        'invalid-members' => '{"fixture":{"name":"Fixture","containers":true}}',
        'empty' => '[]'
    ];
    foreach (['folderPrimary' => $folderFile, 'folderLastGood' => getLastGoodJsonPath($folderFile)] as $key => $file) {
        $condition = $request[$key] ?? '';
        if ($condition === 'missing') unlink($file);
        elseif (isset($folderData[$condition])) file_put_contents($file, $folderData[$condition]);
    }
    $heldOrderLock = null;
    if (($request['syncLock'] ?? '') === 'blocked') mkdir(dockerSyncOrderLockPath());
    if (($request['syncLock'] ?? '') === 'held') {
        $heldOrderLock = fopen(dockerSyncOrderLockPath(), 'c+');
        if (!is_resource($heldOrderLock) || !flock($heldOrderLock, LOCK_EX | LOCK_NB)) {
            throw new RuntimeException('Fixture could not acquire the Docker order lock.');
        }
    }
    $legacy = !empty($request['legacy']) ? readInfoState($type) : null;
    function fixtureInventoryFiles(string $root): array {
        $result = [];
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));
        foreach ($iterator as $file) {
            if (!$file->isFile() || $file->isLink() || in_array($file->getFilename(), ['.config-mutation.lock', 'docker-sync-order.lock'], true)) continue;
            $result[$file->getPathname()] = [base64_encode(file_get_contents($file->getPathname())), $file->getPerms() & 0777];
        }
        ksort($result); return $result;
    }
    $before = fixtureInventoryFiles("$root/config"); $error = ''; $repair = null;
    $response = null; $responseStatus = null; $nativeBefore = file_get_contents("$root/config/native-autostart");
    $nativeModeBefore = fileperms("$root/config/native-autostart") & 0777;
    try {
        if ($operation === 'repair') $repair = \InventoryRepairFixture\fvplusRepairOrphanedMemberReferences($type);
        elseif ($operation === 'sync-hook') syncContainerOrder($type);
        elseif ($operation === 'sync-race') {
            eval('namespace InventorySyncFixture; use \\Throwable; use \\DockerClient;' . str_replace('__DIR__', var_export($server, true), substr(file_get_contents("$server/lib.docker-order.php"), 5)));
            $response = \InventorySyncFixture\syncContainerOrder('docker');
        } else {
            $isMutationRequest = in_array($operation, ['sync', 'start-sync', 'start-toggle', 'start-save', 'diagnostics-sync', 'batch'], true);
            $_SERVER['REQUEST_METHOD'] = $isMutationRequest ? 'POST' : 'GET';
            $endpoint = ['read' => 'read_info.php', 'snapshot' => 'runtime_snapshot.php',
                'diagnostics' => 'diagnostics.php', 'diagnostics-sync' => 'diagnostics.php', 'sync' => 'sync_order.php',
                'preview' => 'docker_start_order.php', 'start-sync' => 'docker_start_order.php',
                'start-toggle' => 'docker_start_order.php', 'start-save' => 'prefs.php', 'batch' => 'batch.php'][$operation];
            $_SERVER['SCRIPT_NAME'] = "/plugins/folderview.plus/server/$endpoint";
            $_SERVER['SCRIPT_FILENAME'] = "$server/$endpoint";
            $_SERVER['REQUEST_URI'] = $_SERVER['SCRIPT_NAME'];
            $_GET = ['type' => $type, 'mode' => $request['mode'] ?? 'full', 'nocache' => ($request['force'] ?? true) ? '1' : '0'];
            if (!empty($request['liveupdate'])) $_GET['liveupdate'] = '1';
            if ($operation === 'diagnostics') $_GET['action'] = 'report';
            if ($operation === 'preview') $_GET['action'] = 'preview';
            $_POST = $isMutationRequest ? ['type' => $type] : [];
            if ($operation === 'start-sync') $_POST['action'] = 'sync';
            if ($operation === 'start-toggle') {
                $_POST += ['action' => 'autostart', 'container' => $request['container'], 'enabled' => $request['enabled']];
            }
            if ($operation === 'start-save') {
                $_POST['prefs'] = json_encode(['dockerStartOrder' => $request['planPatch']]);
                $_POST['expectedRevision'] = (string)readConfigMetadata($type)['prefsRevision'];
            }
            if ($operation === 'diagnostics-sync') $_POST['action'] = 'sync_docker_order';
            if ($operation === 'batch') {
                $_POST['operations'] = json_encode($request['batchOperations']
                    ?? ['creates' => [['folder' => ['name' => 'Persisted while native unavailable']]]]);
                if (isset($request['expectedRevision'])) $_POST['expectedRevision'] = (string)$request['expectedRevision'];
            }
            $_REQUEST = array_merge($_GET, $_POST);
            if ($isMutationRequest && empty($request['withoutToken'])) {
                $token = getConfiguredRequestToken();
                $_SERVER['HTTP_X_FV_REQUEST'] = '1'; $_SERVER['HTTP_X_FV_TOKEN'] = $token;
                $_SERVER['HTTP_X_FV_NONCE'] = fvplus_issue_mutation_nonce($endpoint, $_POST['action'] ?? '')['nonce'];
            }
            $body = substr(file_get_contents("$server/$endpoint"), 5);
            $body = str_replace('/usr/local/emhttp/plugins/folderview.plus/server/', str_replace('\\', '/', $server) . '/', $body);
            ob_start(); eval($body); $response = json_decode(ob_get_clean(), true, 512, JSON_THROW_ON_ERROR);
            $responseStatus = http_response_code() ?: 200;
        }
    }
    catch (Throwable $failure) { $error = $failure->getMessage(); }
    finally {
        if (is_resource($heldOrderLock)) fclose($heldOrderLock);
        if (!empty($request['failNativeWrite'])) putenv('FVPLUS_STORAGE_FAILURE_INJECTION=0');
    }
    $after = fixtureInventoryFiles("$root/config");
    clearstatcache(true, "$root/config/native-autostart");
    $localized = $error === '' ? null : fvplus_localize_response_keys(['ok' => false, 'error' => $error]);
    $retry = null;
    if (!empty($request['retry'])) {
        $GLOBALS['inventory_request']['scenario'] = 'healthy';
        $retry = \InventoryRepairFixture\fvplusRepairOrphanedMemberReferences($type);
    }
    echo json_encode(['before' => $before, 'after' => $after, 'error' => $error, 'repair' => $repair,
        'calls' => $GLOBALS['inventory_calls'], 'orderCalls' => $GLOBALS['inventory_order_calls'],
        'localized' => $localized, 'legacy' => $legacy, 'retry' => $retry,
        'response' => $response, 'responseStatus' => $responseStatus, 'syncPending' => hasDockerSyncOrderPending(),
        'nativeBefore' => $nativeBefore, 'hostWritten' => $GLOBALS['inventory_host_written'] ?? null,
        'nativePageOrder' => is_file("$root/config/native-userprefs") ? file_get_contents("$root/config/native-userprefs") : null,
        'nativeModeBefore' => $nativeModeBefore, 'nativeMode' => fileperms("$root/config/native-autostart") & 0777,
        'folders' => readRawFolderMap($type), 'otherFolders' => readRawFolderMap($type === 'docker' ? 'vm' : 'docker'),
        'metadata' => readConfigMetadata($type, false), 'backups' => listBackupSnapshots($type),
        'priorBackupRetained' => $priorPath !== null && is_file($priorPath) && hash_file('sha256', $priorPath) === $priorHash,
        'native' => file_get_contents("$root/config/native-autostart")], JSON_UNESCAPED_SLASHES);
}
