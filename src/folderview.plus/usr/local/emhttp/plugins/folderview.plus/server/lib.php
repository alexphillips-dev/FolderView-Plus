<?php
    define('FV3_DEBUG_MODE', false); // << SET TO true TO ENABLE LOGGING TO FILE >>
    $fv3_debug_log_file = "/tmp/folder_view3_php_debug.log"; 

    function fv3_debug_log($message) {
        if (FV3_DEBUG_MODE) {
            global $fv3_debug_log_file;
            $timestamp = date("Y-m-d H:i:s");
            if (is_array($message) || is_object($message)) {
                $message = json_encode($message);
            }
            @file_put_contents($fv3_debug_log_file, "[$timestamp] $message\n", FILE_APPEND);
        }
    }

    if (FV3_DEBUG_MODE && isset($_GET['type']) && basename($_SERVER['SCRIPT_NAME']) === 'read_info.php') {
        @file_put_contents($fv3_debug_log_file, "--- FolderView Plus lib.php readInfo Start ---\n");
    }

    $folderVersion = 1.0;
    $configDir = "/boot/config/plugins/folderview.plus";
    $sourceDir = "/usr/local/emhttp/plugins/folderview.plus";
    $documentRoot = $_SERVER['DOCUMENT_ROOT'] ?? '/usr/local/emhttp';

    require_once("$documentRoot/webGui/include/Helpers.php");
    require_once("$documentRoot/plugins/dynamix.docker.manager/include/DockerClient.php");
    require_once ("$documentRoot/plugins/dynamix.vm.manager/include/libvirt_helpers.php");

    function fv3_cache_root(): string {
        static $cacheRoot = null;
        if (is_string($cacheRoot) && $cacheRoot !== '') {
            return $cacheRoot;
        }
        $cacheRoot = '/tmp/folderview.plus-cache';
        if (!is_dir($cacheRoot)) {
            @mkdir($cacheRoot, 0770, true);
        }
        return $cacheRoot;
    }

    function fv3_read_json_cache_payload(string $path): ?array {
        if (!is_file($path)) {
            return null;
        }
        $raw = @file_get_contents($path);
        if (!is_string($raw) || trim($raw) === '') {
            return null;
        }
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : null;
    }

    function fv3_write_json_cache_payload(string $path, array $payload): void {
        $directory = dirname($path);
        if (!is_dir($directory)) {
            @mkdir($directory, 0770, true);
        }
        $encoded = json_encode($payload, JSON_UNESCAPED_SLASHES);
        if (!is_string($encoded) || $encoded === '') {
            return;
        }
        $tmpPath = $path . '.tmp';
        if (@file_put_contents($tmpPath, $encoded, LOCK_EX) !== false) {
            @rename($tmpPath, $path);
            @chmod($path, 0644);
            return;
        }
        @file_put_contents($path, $encoded, LOCK_EX);
        @chmod($path, 0644);
    }

    function fv3_get_tailscale_cache_path(string $containerName, string $kind): string {
        $safeName = preg_replace('/[^a-zA-Z0-9_.-]+/', '_', $containerName);
        $safeKind = preg_replace('/[^a-z]+/', '', strtolower($kind)) ?: 'value';
        return fv3_cache_root() . "/tailscale/{$safeName}-{$safeKind}.json";
    }

    function fv3_read_tailscale_cache(string $containerName, string $kind, int $ttlSeconds): ?array {
        if ($ttlSeconds <= 0) {
            return null;
        }
        $path = fv3_get_tailscale_cache_path($containerName, $kind);
        $mtime = (int)@filemtime($path);
        if ($mtime <= 0) {
            return null;
        }
        $age = time() - $mtime;
        if ($age < 0 || $age > $ttlSeconds) {
            return null;
        }
        $payload = fv3_read_json_cache_payload($path);
        if (!is_array($payload)) {
            return null;
        }
        if (($payload['container'] ?? '') !== $containerName || ($payload['kind'] ?? '') !== $kind) {
            return null;
        }
        return [
            'found' => ($payload['found'] ?? false) === true,
            'value' => is_string($payload['value'] ?? null) ? (string)$payload['value'] : null
        ];
    }

    function fv3_write_tailscale_cache(string $containerName, string $kind, ?string $value): void {
        fv3_write_json_cache_payload(fv3_get_tailscale_cache_path($containerName, $kind), [
            'container' => $containerName,
            'kind' => $kind,
            'found' => is_string($value) && trim($value) !== '',
            'value' => is_string($value) ? $value : null,
            'generatedAt' => gmdate('c')
        ]);
    }

    function fv3_get_tailscale_ip_from_container(string $containerName, bool $containerRunning = true): ?string {
        if (empty($containerName) || !preg_match('/^[a-zA-Z0-9_.-]+$/', $containerName)) {
            fv3_debug_log("    fv3_get_tailscale_ip_from_container: Invalid container name for exec: $containerName");
            return null;
        }

        $cached = fv3_read_tailscale_cache($containerName, 'ip', FVPLUS_TAILSCALE_EXEC_CACHE_TTL);
        if (is_array($cached)) {
            return $cached['found'] ? (string)$cached['value'] : null;
        }
        if (!$containerRunning) {
            fv3_debug_log("    fv3_get_tailscale_ip_from_container: Skipping exec for stopped container $containerName");
            return null;
        }

        $command = "docker exec " . escapeshellarg($containerName) . " tailscale ip -4 2>/dev/null";
        fv3_debug_log("    fv3_get_tailscale_ip_from_container: Executing: $command for $containerName");
        $output = [];
        $return_var = -1;
        @exec($command, $output, $return_var);

        if ($return_var === 0 && !empty($output) && filter_var(trim($output[0]), FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            $ip = trim($output[0]);
            fv3_write_tailscale_cache($containerName, 'ip', $ip);
            fv3_debug_log("    fv3_get_tailscale_ip_from_container: Found IP for $containerName: $ip");
            return $ip;
        }
        fv3_write_tailscale_cache($containerName, 'ip', null);
        fv3_debug_log("    fv3_get_tailscale_ip_from_container: No valid IP found for $containerName. Output: " . json_encode($output) . ", Return: $return_var");
        return null;
    }

    function fv3_get_tailscale_fqdn_from_container(string $containerName, bool $containerRunning = true): ?string {
        if (empty($containerName) || !preg_match('/^[a-zA-Z0-9_.-]+$/', $containerName)) {
            fv3_debug_log("    fv3_get_tailscale_fqdn_from_container: Invalid container name for exec: $containerName");
            return null;
        }

        $cached = fv3_read_tailscale_cache($containerName, 'fqdn', FVPLUS_TAILSCALE_EXEC_CACHE_TTL);
        if (is_array($cached)) {
            return $cached['found'] ? (string)$cached['value'] : null;
        }
        if (!$containerRunning) {
            fv3_debug_log("    fv3_get_tailscale_fqdn_from_container: Skipping exec for stopped container $containerName");
            return null;
        }

        $command = "docker exec " . escapeshellarg($containerName) . " tailscale status --peers=false --json 2>/dev/null";
        fv3_debug_log("    fv3_get_tailscale_fqdn_from_container: Executing: $command for $containerName");
        $output_lines = [];
        $return_var = -1;
        @exec($command, $output_lines, $return_var);
        $json_output = implode("\n", $output_lines);

        if ($return_var === 0 && !empty($json_output)) {
            $status_data = json_decode($json_output, true);
            if (isset($status_data['Self']['DNSName'])) {
                $dnsName = rtrim((string)$status_data['Self']['DNSName'], '.');
                fv3_write_tailscale_cache($containerName, 'fqdn', $dnsName);
                fv3_debug_log("    fv3_get_tailscale_fqdn_from_container: Found DNSName for $containerName: " . $dnsName);
                return $dnsName;
            }
        }
        fv3_write_tailscale_cache($containerName, 'fqdn', null);
        fv3_debug_log("    fv3_get_tailscale_fqdn_from_container: No DNSName found for $containerName. Output: " . $json_output . ", Return: $return_var");
        return null;
    }

    const FVPLUS_EXPORT_SCHEMA_VERSION = 1;
    const FVPLUS_REMOTE_MANIFEST_URL = "https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/main/folderview.plus.plg";
    const FVPLUS_ALLOWED_TYPES = ['docker', 'vm'];
    const FVPLUS_DIAGNOSTICS_SCHEMA_VERSION = 2;
    const FVPLUS_DIAGNOSTICS_HISTORY_MAX = 250;
    const FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY = 'sanitized';
    const FVPLUS_RULE_KINDS = ['name_regex', 'label', 'label_contains', 'label_starts_with', 'image_regex', 'compose_project_regex'];
    const FVPLUS_RULE_EFFECTS = ['include', 'exclude'];
    const FVPLUS_RUNTIME_PREFS_SCHEMA = 2;
    const FVPLUS_GLOBAL_ROLLBACK_SCHEMA_VERSION = 1;
    const FVPLUS_GLOBAL_ROLLBACK_HISTORY_MAX = 20;
    const FVPLUS_MAX_FOLDER_CONTENT_BYTES = 131072;
    const FVPLUS_MAX_FOLDER_CONTENT_RAW_BYTES = 1048576;
    const FVPLUS_MAX_FOLDER_NESTED_DEPTH = 6;
    const FVPLUS_MAX_FOLDER_ARRAY_ITEMS = 250;
    const FVPLUS_MAX_FOLDER_STRING_BYTES = 2048;
    const FVPLUS_DOCKER_FOLDER_LABEL_KEYS = ['folderview.plus', 'folder.view3', 'folder.view2', 'folder.view'];
    const FVPLUS_DEFAULT_FOLDER_STATUS_COLORS = [
        'started' => '#ffffff',
        'paused' => '#b8860b',
        'stopped' => '#ff4d4d'
    ];
    const FVPLUS_LEGACY_CONFIG_DIRS = [
        '/boot/config/plugins/folder.view3',
        '/boot/config/plugins/folder.view2',
        '/boot/config/plugins/folder.view'
    ];
    const FVPLUS_RUNTIME_CONFLICT_PLUGINS = [
        'folder.view3' => [
            'name' => 'Folder View 3',
            'runtimeDir' => '/usr/local/emhttp/plugins/folder.view3',
            'markers' => [
                'folder.view3.Docker.page',
                'folder.view3.VMs.page',
                'folder.view3.Dashboard.page',
                'scripts/docker.js',
                'scripts/vm.js',
                'scripts/dashboard.js'
            ]
        ],
        'folder.view2' => [
            'name' => 'Folder View 2',
            'runtimeDir' => '/usr/local/emhttp/plugins/folder.view2',
            'markers' => [
                'folder.view2.Docker.page',
                'folder.view2.VMs.page',
                'folder.view2.Dashboard.page',
                'scripts/docker.js',
                'scripts/vm.js',
                'scripts/dashboard.js'
            ]
        ]
    ];
    const FVPLUS_REQUEST_TOKEN_ENFORCEMENT = 'strict';
    const FVPLUS_VERBOSE_API_ERRORS = false;
    const FVPLUS_API_ERROR_LOG = '/tmp/folderview.plus.api-error.log';
    const FVPLUS_INFO_CACHE_TTL_FULL = 2;
    const FVPLUS_INFO_CACHE_TTL_STATE = 2;
    const FVPLUS_DOCKER_TEMPLATE_CACHE_TTL = 300;
    const FVPLUS_TAILSCALE_EXEC_CACHE_TTL = 20;

    function fvplus_detect_runtime_plugin_conflicts(): array {
        $detected = [];
        foreach (FVPLUS_RUNTIME_CONFLICT_PLUGINS as $id => $meta) {
            $runtimeDir = (string)($meta['runtimeDir'] ?? '');
            if ($runtimeDir === '' || !@is_dir($runtimeDir)) {
                continue;
            }

            $markers = [];
            $legacyMarker = trim((string)($meta['marker'] ?? ''));
            if ($legacyMarker !== '') {
                $markers[] = $legacyMarker;
            }
            $markerList = $meta['markers'] ?? [];
            if (is_array($markerList)) {
                foreach ($markerList as $entry) {
                    $candidate = trim((string)$entry);
                    if ($candidate !== '') {
                        $markers[] = $candidate;
                    }
                }
            }
            $markers = array_values(array_unique($markers));
            if (count($markers) === 0) {
                continue;
            }

            $hasRuntimeMarker = false;
            foreach ($markers as $marker) {
                if (@is_file($runtimeDir . '/' . $marker)) {
                    $hasRuntimeMarker = true;
                    break;
                }
            }

            if ($hasRuntimeMarker) {
                $detected[] = [
                    'id' => (string)$id,
                    'name' => (string)($meta['name'] ?? $id),
                    'runtimeDir' => $runtimeDir
                ];
            }
        }
        return $detected;
    }

    function fvplus_render_runtime_conflict_notice(string $surfaceLabel = ''): void {
        $conflicts = fvplus_detect_runtime_plugin_conflicts();
        if (count($conflicts) === 0) {
            return;
        }
        $names = array_map(static fn(array $entry): string => (string)($entry['name'] ?? ''), $conflicts);
        $names = array_values(array_filter(array_map('trim', $names), static fn(string $value): bool => $value !== ''));
        $ids = array_map(static fn(array $entry): string => (string)($entry['id'] ?? ''), $conflicts);
        $ids = array_values(array_filter(array_map('trim', $ids), static fn(string $value): bool => $value !== ''));
        $conflictKeyRaw = implode('|', count($ids) > 0 ? $ids : $names);
        $conflictKey = htmlspecialchars($conflictKeyRaw, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $pluginText = htmlspecialchars(implode(', ', $names), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $pluginData = htmlspecialchars(implode('|', $names), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $isSettingsSurface = trim($surfaceLabel) !== '' && stripos($surfaceLabel, 'settings') !== false;
        $scope = trim($surfaceLabel) !== ''
            ? htmlspecialchars($surfaceLabel, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
            : 'this page';
        echo '<div class="fv-runtime-conflict-banner" data-conflict-key="' . $conflictKey . '" data-conflict-plugins="' . $pluginData . '" style="margin:12px 0 16px 0;padding:14px 16px;border:1px solid rgba(255,153,0,0.45);background:linear-gradient(180deg, rgba(120,60,0,0.22), rgba(50,26,0,0.22));border-radius:10px;line-height:1.5;">';
        echo '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">';
        echo '<i class="fa fa-exclamation-triangle" aria-hidden="true" style="font-size:1.2rem;color:#ffbf78;"></i>';
        echo '<div style="font-size:1.34rem;font-weight:800;line-height:1.1;letter-spacing:0.01em;color:#ffd7a2;">Safe mode active</div>';
        echo '</div>';
        if ($isSettingsSurface) {
            echo '<div style="margin-bottom:8px;">Runtime injection is paused because another Folder View plugin is installed. ';
            echo 'You can still review settings here, but Docker/VM/Dashboard folder rendering is disabled until the conflict is removed.</div>';
        } else {
            echo '<div style="margin-bottom:8px;">Folder rendering is paused on <strong>' . $scope . '</strong> to prevent runtime conflicts.</div>';
        }
        echo '<div style="margin-bottom:8px;">Detected conflicting runtime plugin(s): <strong>' . $pluginText . '</strong>.</div>';
        echo '<div style="margin-bottom:8px;">Keep <strong>FolderView Plus</strong> installed. Remove only the conflicting plugin listed above.</div>';
        echo '<div style="font-weight:700;font-size:1.08rem;margin-bottom:4px;">How to fix</div>';
        echo '<ol style="margin:0 0 10px 20px;padding:0;">';
        echo '<li>Open <strong>Plugins</strong>.</li>';
        echo '<li>Remove: <strong>' . $pluginText . '</strong>.</li>';
        echo '<li>Refresh this page to re-enable FolderView Plus.</li>';
        echo '</ol>';
        echo '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">';
        echo '<button type="button" class="btn" onclick="window.location.href=\'/Plugins\'" style="margin:0;">Open Plugins</button>';
        echo '<a href="https://forums.unraid.net/topic/197631-plugin-folderview-plus/" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;align-self:center;line-height:1.2;margin:0;white-space:nowrap;">Support Thread</a>';
        echo '</div>';
        echo '</div>';
        $conflictStorageKey = trim((string)$conflictKeyRaw);
        if ($conflictStorageKey === '') {
            $conflictStorageKey = 'runtime-conflict';
        }
        echo '<script>(function(){try{localStorage.setItem(\'fv.runtimeConflict.active.v1\',' . json_encode($conflictStorageKey, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . ');localStorage.removeItem(\'fv.runtimeConflict.resolvedPending.v1\');}catch(_fvErr){}})();</script>';
    }

    function ensureType(string $type): string {
        if (!in_array($type, FVPLUS_ALLOWED_TYPES, true)) {
            throw new InvalidArgumentException("Invalid type: $type");
        }
        return $type;
    }

    function normalizeReadInfoMode(string $mode): string {
        $normalized = strtolower(trim($mode));
        return $normalized === 'state' ? 'state' : 'full';
    }

    function getReadInfoCacheDirectory(): string {
        static $path = null;
        if (is_string($path) && $path !== '') {
            return $path;
        }
        $path = fv3_cache_root() . '/read-info';
        if (!is_dir($path)) {
            @mkdir($path, 0770, true);
        }
        return $path;
    }

    function getReadInfoCachePath(string $type, string $mode): string {
        $safeType = ensureType($type);
        $safeMode = normalizeReadInfoMode($mode);
        return getReadInfoCacheDirectory() . "/$safeType-$safeMode.json";
    }

    function readReadInfoCachePayload(string $path): ?array {
        if (!is_file($path)) {
            return null;
        }
        $raw = @file_get_contents($path);
        if (!is_string($raw) || trim($raw) === '') {
            return null;
        }
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : null;
    }

    function readReadInfoCacheIfFresh(string $type, string $mode, int $ttlSeconds): ?array {
        if ($ttlSeconds <= 0) {
            return null;
        }
        $cachePath = getReadInfoCachePath($type, $mode);
        if (!is_file($cachePath)) {
            return null;
        }
        $modifiedAt = (int)@filemtime($cachePath);
        if ($modifiedAt <= 0) {
            return null;
        }
        $ageSeconds = time() - $modifiedAt;
        if ($ageSeconds < 0 || $ageSeconds > $ttlSeconds) {
            return null;
        }

        $payload = readReadInfoCachePayload($cachePath);
        if (!is_array($payload)) {
            return null;
        }
        if ((string)($payload['type'] ?? '') !== ensureType($type)) {
            return null;
        }
        if ((string)($payload['mode'] ?? '') !== normalizeReadInfoMode($mode)) {
            return null;
        }
        $data = $payload['data'] ?? null;
        return is_array($data) ? $data : null;
    }

    function writeReadInfoCache(string $type, string $mode, array $data): void {
        $cachePath = getReadInfoCachePath($type, $mode);
        $directory = dirname($cachePath);
        if (!is_dir($directory)) {
            @mkdir($directory, 0770, true);
        }
        $payload = [
            'type' => ensureType($type),
            'mode' => normalizeReadInfoMode($mode),
            'generatedAt' => gmdate('c'),
            'data' => $data
        ];
        $encoded = json_encode($payload, JSON_UNESCAPED_SLASHES);
        if (!is_string($encoded) || $encoded === '') {
            return;
        }
        $tmpPath = $cachePath . '.tmp';
        if (@file_put_contents($tmpPath, $encoded, LOCK_EX) !== false) {
            @rename($tmpPath, $cachePath);
            @chmod($cachePath, 0644);
            return;
        }
        @file_put_contents($cachePath, $encoded, LOCK_EX);
        @chmod($cachePath, 0644);
    }

    function readInfoCached(string $type, string $mode = 'full', ?int $ttlSeconds = null, bool $forceRefresh = false): array {
        $safeType = ensureType($type);
        $safeMode = normalizeReadInfoMode($mode);
        $effectiveTtl = $ttlSeconds;
        if (!is_int($effectiveTtl)) {
            $effectiveTtl = ($safeMode === 'state') ? FVPLUS_INFO_CACHE_TTL_STATE : FVPLUS_INFO_CACHE_TTL_FULL;
        }
        $effectiveTtl = max(0, min(30, $effectiveTtl));

        if (!$forceRefresh) {
            $cached = readReadInfoCacheIfFresh($safeType, $safeMode, $effectiveTtl);
            if (is_array($cached)) {
                return $cached;
            }
        }

        $data = ($safeMode === 'state') ? readInfoState($safeType) : readInfo($safeType);
        if (is_array($data) && $effectiveTtl > 0) {
            writeReadInfoCache($safeType, $safeMode, $data);
        }
        return is_array($data) ? $data : [];
    }

    function getRequestHeaderValue(string $name): string {
        $key = 'HTTP_' . strtoupper(str_replace('-', '_', trim($name)));
        return isset($_SERVER[$key]) ? trim((string)$_SERVER[$key]) : '';
    }

    function normalizeHostForCompare(string $host): string {
        $host = strtolower(trim($host));
        if ($host === '') {
            return '';
        }
        if ($host[0] === '[' && substr($host, -1) === ']') {
            return substr($host, 1, -1);
        }
        return $host;
    }

    function parseHostPortFromUrl(string $url): array {
        $parts = @parse_url($url);
        if (!is_array($parts)) {
            return ['', null];
        }
        $host = normalizeHostForCompare((string)($parts['host'] ?? ''));
        if ($host === '') {
            return ['', null];
        }
        $port = isset($parts['port']) ? (int)$parts['port'] : null;
        if ($port === null) {
            $scheme = strtolower((string)($parts['scheme'] ?? ''));
            if ($scheme === 'http') {
                $port = 80;
            } elseif ($scheme === 'https') {
                $port = 443;
            }
        }
        return [$host, $port];
    }

    function parseCurrentRequestHostPort(): array {
        $hostHeader = trim((string)($_SERVER['HTTP_HOST'] ?? ''));
        if ($hostHeader === '') {
            return ['', null];
        }
        $isHttps = !empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off';
        $probeUrl = ($isHttps ? 'https://' : 'http://') . $hostHeader;
        [$host, $port] = parseHostPortFromUrl($probeUrl);
        if ($host === '') {
            return ['', null];
        }
        if ($port === null && isset($_SERVER['SERVER_PORT'])) {
            $serverPort = (int)$_SERVER['SERVER_PORT'];
            if ($serverPort > 0) {
                $port = $serverPort;
            }
        }
        return [$host, $port];
    }

    function isSameOriginHeaderValue(string $urlValue): bool {
        if ($urlValue === '' || strtolower($urlValue) === 'null') {
            return false;
        }
        [$requestHost, $requestPort] = parseCurrentRequestHostPort();
        if ($requestHost === '') {
            return false;
        }
        [$headerHost, $headerPort] = parseHostPortFromUrl($urlValue);
        if ($headerHost === '' || $headerHost !== $requestHost) {
            return false;
        }
        if ($headerPort !== null && $requestPort !== null && $headerPort !== $requestPort) {
            return false;
        }
        return true;
    }

    function isTrustedMutationContext(): bool {
        // Do not require client headers to exist; only block when a provided
        // Origin/Referer explicitly points to a different host/port.
        $origin = getRequestHeaderValue('Origin');
        if ($origin !== '' && !isSameOriginHeaderValue($origin)) {
            return false;
        }
        $referer = getRequestHeaderValue('Referer');
        if ($referer !== '' && !isSameOriginHeaderValue($referer)) {
            return false;
        }
        return true;
    }

    function getOptionalRequestTokenPath(): string {
        global $configDir;
        return "$configDir/request.token";
    }

    function normalizeRequestTokenEnforcementMode(string $mode): string {
        $normalized = strtolower(trim($mode));
        if (in_array($normalized, ['off', 'compat', 'strict'], true)) {
            return $normalized;
        }
        return 'compat';
    }

    function getRequestTokenEnforcementMode(): string {
        return normalizeRequestTokenEnforcementMode(FVPLUS_REQUEST_TOKEN_ENFORCEMENT);
    }

    function ensureConfiguredRequestTokenFile(): void {
        $path = getOptionalRequestTokenPath();
        if (file_exists($path)) {
            return;
        }
        $parent = dirname($path);
        if (!is_dir($parent)) {
            @mkdir($parent, 0770, true);
        }
        try {
            $token = bin2hex(random_bytes(24));
        } catch (Throwable $error) {
            return;
        }
        if ($token === '') {
            return;
        }
        @file_put_contents($path, $token, LOCK_EX);
        @chmod($path, 0600);
    }

    function getConfiguredRequestToken(): string {
        ensureConfiguredRequestTokenFile();
        $path = getOptionalRequestTokenPath();
        if (!file_exists($path)) {
            return '';
        }
        $token = trim((string)@file_get_contents($path));
        if ($token === '') {
            return '';
        }
        if (!preg_match('/^[A-Za-z0-9._~-]{16,128}$/', $token)) {
            return '';
        }
        return $token;
    }

    function emitRequestTokenMetaTag(): void {
        $token = getConfiguredRequestToken();
        if ($token === '') {
            return;
        }
        echo '<meta name="fv-request-token" content="'
            . htmlspecialchars($token, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
            . '">' . "\n";
    }

    function validateOptionalRequestToken(): bool {
        $mode = getRequestTokenEnforcementMode();
        if ($mode === 'off') {
            return false;
        }
        $expected = getConfiguredRequestToken();
        if ($expected === '') {
            return false;
        }
        $provided = trim((string)($_POST['token'] ?? getRequestHeaderValue('X-FV-Token')));
        if ($provided === '') {
            if ($mode === 'strict') {
                throw new RuntimeException('Invalid request token.');
            }
            return false;
        }
        if (!hash_equals($expected, $provided)) {
            throw new RuntimeException('Invalid request token.');
        }
        return true;
    }

    function hasExplicitMutationRequestHeader(): bool {
        return trim(getRequestHeaderValue('X-FV-Request')) === '1';
    }

    function requireMutationRequestGuard(): void {
        if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'POST') {
            throw new RuntimeException('Unsupported method.');
        }
        $tokenMode = getRequestTokenEnforcementMode();
        $tokenRequiredForBypass = $tokenMode !== 'off' && getConfiguredRequestToken() !== '';
        $tokenValidated = validateOptionalRequestToken();
        $headerValidated = hasExplicitMutationRequestHeader() && ($tokenValidated || !$tokenRequiredForBypass);
        if (!isTrustedMutationContext() && !$headerValidated) {
            throw new RuntimeException('Blocked by request guard.');
        }
    }

    function fvplus_json_response(array $payload, int $statusCode = 200): void {
        if (!headers_sent()) {
            header('Content-Type: application/json');
            header('X-Content-Type-Options: nosniff');
            header('Cache-Control: no-store, no-cache, must-revalidate');
        }
        http_response_code($statusCode);
        $encoded = json_encode($payload, JSON_UNESCAPED_SLASHES);
        if ($encoded === false) {
            http_response_code(500);
            echo '{"ok":false,"error":"JSON encoding failed."}';
            return;
        }
        echo $encoded;
    }

    function fvplus_json_ok(array $payload = []): void {
        $data = ['ok' => true];
        foreach ($payload as $key => $value) {
            if ($key === 'ok') {
                continue;
            }
            $data[$key] = $value;
        }
        fvplus_json_response($data, 200);
    }

    function fvplus_json_error(string $message, int $statusCode = 400, array $payload = []): void {
        $data = [
            'ok' => false,
            'error' => $message
        ];
        foreach ($payload as $key => $value) {
            if ($key === 'ok' || $key === 'error') {
                continue;
            }
            $data[$key] = $value;
        }
        fvplus_json_response($data, $statusCode);
    }

    function fvplus_log_api_exception(Throwable $error): void {
        $timestamp = gmdate('c');
        $line = sprintf(
            "[%s] %s in %s:%d | %s\n",
            $timestamp,
            get_class($error),
            (string)$error->getFile(),
            (int)$error->getLine(),
            (string)$error->getMessage()
        );
        @file_put_contents(FVPLUS_API_ERROR_LOG, $line, FILE_APPEND);
        @error_log(trim($line));
    }

    function fvplus_get_api_error_status(Throwable $error): int {
        if ($error instanceof InvalidArgumentException || $error instanceof RuntimeException) {
            return 400;
        }
        return 500;
    }

    function fvplus_get_api_error_message(Throwable $error): string {
        if (FVPLUS_VERBOSE_API_ERRORS || FV3_DEBUG_MODE) {
            return (string)$error->getMessage();
        }
        if ($error instanceof InvalidArgumentException || $error instanceof RuntimeException) {
            return (string)$error->getMessage();
        }
        return 'Request failed.';
    }

    function fvplus_json_try(callable $handler): void {
        try {
            $result = $handler();
            if (is_array($result)) {
                if (array_key_exists('ok', $result)) {
                    fvplus_json_response($result, $result['ok'] === false ? 400 : 200);
                } else {
                    fvplus_json_ok($result);
                }
            } elseif ($result !== null) {
                fvplus_json_ok(['data' => $result]);
            }
        } catch (Throwable $e) {
            fvplus_log_api_exception($e);
            fvplus_json_error(fvplus_get_api_error_message($e), fvplus_get_api_error_status($e));
        }
    }

    function normalizeBool($value, bool $default = false): bool {
        if (is_bool($value)) {
            return $value;
        }
        if (is_string($value)) {
            $trimmed = strtolower(trim($value));
            if ($trimmed === 'true' || $trimmed === '1' || $trimmed === 'yes' || $trimmed === 'on') {
                return true;
            }
            if ($trimmed === 'false' || $trimmed === '0' || $trimmed === 'no' || $trimmed === 'off') {
                return false;
            }
        }
        if (is_int($value) || is_float($value)) {
            return (bool)$value;
        }
        return $default;
    }

    function normalizeIntInRange($value, int $min, int $max, int $default): int {
        if (!is_numeric($value)) {
            return $default;
        }
        $number = (int)$value;
        if ($number < $min) {
            return $min;
        }
        if ($number > $max) {
            return $max;
        }
        return $number;
    }

    function normalizeStringIdList($value): array {
        if (!is_array($value)) {
            return [];
        }
        $out = [];
        foreach ($value as $item) {
            $id = trim((string)$item);
            if ($id === '' || in_array($id, $out, true)) {
                continue;
            }
            $out[] = $id;
        }
        return $out;
    }

    function normalizeExpandedStateMap($value): array {
        if (!is_array($value)) {
            return [];
        }
        $out = [];
        foreach ($value as $rawId => $expanded) {
            $id = trim((string)$rawId);
            if ($id === '' || array_key_exists($id, $out)) {
                continue;
            }
            $out[$id] = normalizeBool($expanded, false);
        }
        return $out;
    }

    function truncateUtf8String(string $value, int $maxBytes): string {
        if ($maxBytes <= 0) {
            return '';
        }
        if (strlen($value) <= $maxBytes) {
            return $value;
        }
        return substr($value, 0, $maxBytes);
    }

    function normalizeFolderNestedValue($value, int $depth = 0) {
        if ($depth > FVPLUS_MAX_FOLDER_NESTED_DEPTH) {
            return null;
        }
        if (is_array($value)) {
            $out = [];
            $count = 0;
            $isList = array_keys($value) === range(0, count($value) - 1);
            foreach ($value as $key => $item) {
                $count++;
                if ($count > FVPLUS_MAX_FOLDER_ARRAY_ITEMS) {
                    break;
                }
                $normalized = normalizeFolderNestedValue($item, $depth + 1);
                if ($isList) {
                    $out[] = $normalized;
                    continue;
                }
                $safeKey = truncateUtf8String(trim((string)$key), 64);
                if ($safeKey === '') {
                    continue;
                }
                $out[$safeKey] = $normalized;
            }
            return $out;
        }
        if (is_string($value)) {
            return truncateUtf8String($value, FVPLUS_MAX_FOLDER_STRING_BYTES);
        }
        if (is_int($value) || is_float($value) || is_bool($value) || $value === null) {
            return $value;
        }
        return truncateUtf8String((string)$value, FVPLUS_MAX_FOLDER_STRING_BYTES);
    }

    function normalizeFolderContentPayload(array $content): array {
        $normalized = normalizeFolderNestedValue($content);
        if (!is_array($normalized)) {
            $normalized = [];
        }

        $normalized['name'] = truncateUtf8String(trim((string)($normalized['name'] ?? '')), 160);
        if ($normalized['name'] === '') {
            $normalized['name'] = 'Folder';
        }
        $normalized['icon'] = truncateUtf8String(trim((string)($normalized['icon'] ?? '')), 2048);
        $normalized['regex'] = truncateUtf8String((string)($normalized['regex'] ?? ''), 1024);
        $normalized['containers'] = array_slice(normalizeFolderMembers($normalized['containers'] ?? []), 0, 5000);
        $rawParentId = $normalized['parentId'] ?? ($normalized['parent_id'] ?? ($normalized['parent'] ?? ''));
        $normalized['parentId'] = truncateUtf8String(trim((string)$rawParentId), 64);
        unset($normalized['parent_id'], $normalized['parent']);

        if (!is_array($normalized['settings'] ?? null)) {
            $normalized['settings'] = [];
        }
        if (!is_array($normalized['actions'] ?? null)) {
            $normalized['actions'] = [];
        } else {
            $normalized['actions'] = array_values($normalized['actions']);
        }

        return $normalized;
    }

    function normalizeFolderParentIdValue($value): string {
        if (!is_string($value) && !is_numeric($value)) {
            return '';
        }
        return truncateUtf8String(trim((string)$value), 64);
    }

    function normalizeFolderParentLinks(array $folders): array {
        if (count($folders) === 0) {
            return $folders;
        }

        foreach ($folders as $id => &$folder) {
            if (!is_array($folder)) {
                $folder = [];
            }
            $parentId = normalizeFolderParentIdValue($folder['parentId'] ?? ($folder['parent_id'] ?? ''));
            if ($parentId === $id || $parentId === '' || !array_key_exists($parentId, $folders)) {
                $parentId = '';
            }
            $folder['parentId'] = $parentId;
            unset($folder['parent_id']);
        }
        unset($folder);

        foreach (array_keys($folders) as $id) {
            $seen = [];
            $cursor = $id;
            while (true) {
                if (!array_key_exists($cursor, $folders) || !is_array($folders[$cursor])) {
                    break;
                }
                $parentId = normalizeFolderParentIdValue($folders[$cursor]['parentId'] ?? '');
                if ($parentId === '') {
                    break;
                }
                if (!array_key_exists($parentId, $folders)) {
                    $folders[$cursor]['parentId'] = '';
                    break;
                }
                if ($parentId === $id || isset($seen[$parentId])) {
                    $folders[$cursor]['parentId'] = '';
                    break;
                }
                $seen[$cursor] = true;
                $cursor = $parentId;
            }
        }

        return $folders;
    }

    function normalizeIsoTimestamp($value): string {
        $raw = trim((string)$value);
        if ($raw === '') {
            return '';
        }
        $parsed = @strtotime($raw);
        if ($parsed === false) {
            return '';
        }
        return gmdate('c', (int)$parsed);
    }

    function readInstalledVersion(): string {
        global $configDir;
        $versionPath = "$configDir/version";
        if (!file_exists($versionPath)) {
            return '0.0.0';
        }
        $version = trim((string)@file_get_contents($versionPath));
        return $version === '' ? '0.0.0' : $version;
    }

    function readInstalledManifestPathCandidates(): array {
        global $configDir, $sourceDir;
        $candidates = [
            "$configDir/folderview.plus.plg",
            '/boot/config/plugins/folderview.plus.plg',
            "$sourceDir/folderview.plus.plg"
        ];
        $unique = [];
        foreach ($candidates as $path) {
            $normalized = trim((string)$path);
            if ($normalized === '' || in_array($normalized, $unique, true)) {
                continue;
            }
            if (is_file($normalized)) {
                $unique[] = $normalized;
            }
        }
        return $unique;
    }

    function readInstalledManifestPath(): string {
        global $configDir;
        $preferred = "$configDir/folderview.plus.plg";
        if (is_file($preferred)) {
            return $preferred;
        }
        $candidates = readInstalledManifestPathCandidates();
        if (count($candidates) > 0) {
            return (string)$candidates[0];
        }
        return $preferred;
    }

    function normalizeChangesBlockLines(string $block): array {
        $lines = [];
        foreach (explode("\n", str_replace(["\r\n", "\r"], "\n", $block)) as $line) {
            $trimmed = trim((string)$line);
            if ($trimmed === '') {
                continue;
            }
            $trimmed = preg_replace('/^\s*[-*]\s*/', '', $trimmed);
            $trimmed = trim((string)$trimmed);
            if ($trimmed !== '') {
                $lines[] = $trimmed;
            }
        }
        return $lines;
    }

    function isChangesBoilerplateLine(string $line): bool {
        $lowered = strtolower(trim($line));
        if ($lowered === '') {
            return false;
        }
        return $lowered === 'maintenance: release metadata and packaging sync.'
            || $lowered === 'maintenance: release metadata and packaging sync'
            || $lowered === 'maintenance: automated release metadata update.'
            || $lowered === 'maintenance: automated release metadata update';
    }

    function filterBoilerplateChangesLines(array $lines): array {
        if (count($lines) <= 1) {
            return $lines;
        }
        $filtered = [];
        foreach ($lines as $line) {
            $trimmed = trim((string)$line);
            if ($trimmed === '') {
                continue;
            }
            if (isChangesBoilerplateLine($trimmed)) {
                continue;
            }
            $filtered[] = $trimmed;
        }
        return count($filtered) > 0 ? $filtered : $lines;
    }

    function applyChangesLineLimit(array $lines, int $maxLines): array {
        if ($maxLines > 0 && count($lines) > $maxLines) {
            $lines = array_slice($lines, 0, $maxLines);
            $lines[] = '...';
        }
        return $lines;
    }

    function extractChangesBlockForVersion(string $content, string $version): array {
        $version = trim($version);
        if ($version === '') {
            return [];
        }
        $pattern = '/^###\s*' . preg_quote($version, '/') . '\s*$(.*?)(?=^###|\z)/ms';
        if (!preg_match($pattern, $content, $match)) {
            return [];
        }
        $block = trim((string)($match[1] ?? ''));
        if ($block === '') {
            return [];
        }
        return normalizeChangesBlockLines($block);
    }

    function extractLatestChangesBlock(string $content): array {
        if (!preg_match('/^###\s*([0-9][0-9A-Za-z._-]*)\s*$(.*?)(?=^###|\z)/ms', $content, $match)) {
            return [];
        }
        $version = trim((string)($match[1] ?? ''));
        $block = trim((string)($match[2] ?? ''));
        if ($version === '' || $block === '') {
            return [];
        }
        return [
            'sourceVersion' => $version,
            'lines' => normalizeChangesBlockLines($block)
        ];
    }

    function extractChangesEntries(string $content): array {
        if (!preg_match_all('/^###\s*([0-9][0-9A-Za-z._-]*)\s*$(.*?)(?=^###|\z)/ms', $content, $matches, PREG_SET_ORDER)) {
            return [];
        }
        $entries = [];
        foreach ($matches as $match) {
            $version = trim((string)($match[1] ?? ''));
            if ($version === '') {
                continue;
            }
            $block = trim((string)($match[2] ?? ''));
            $entries[] = [
                'version' => $version,
                'lines' => normalizeChangesBlockLines($block)
            ];
        }
        return $entries;
    }

    function extractPreviousChangesEntry(string $content, string $version): array {
        $targetVersion = trim($version);
        if ($targetVersion === '') {
            return [];
        }
        $entries = extractChangesEntries($content);
        $entryCount = count($entries);
        if ($entryCount === 0) {
            return [];
        }
        for ($index = 0; $index < $entryCount; $index += 1) {
            $entryVersion = trim((string)($entries[$index]['version'] ?? ''));
            if ($entryVersion !== $targetVersion) {
                continue;
            }
            if (($index + 1) >= $entryCount) {
                return [];
            }
            return (array)$entries[$index + 1];
        }
        return [];
    }

    function buildUniqueCurrentChangesLines(array $currentLines, array $previousLines): array {
        if (count($currentLines) === 0 || count($previousLines) === 0) {
            return $currentLines;
        }
        $previousLookup = [];
        foreach ($previousLines as $line) {
            $normalized = trim((string)$line);
            if ($normalized === '') {
                continue;
            }
            $previousLookup[$normalized] = true;
        }
        if (count($previousLookup) === 0) {
            return $currentLines;
        }
        $unique = [];
        foreach ($currentLines as $line) {
            $normalized = trim((string)$line);
            if ($normalized === '') {
                continue;
            }
            if (isset($previousLookup[$normalized])) {
                continue;
            }
            $unique[] = $normalized;
        }
        if (count($unique) === 0) {
            return $currentLines;
        }
        return $unique;
    }

    function readChangesSummaryForVersion(string $version, int $maxLines = 14, bool $allowFallback = true): array {
        $requestedVersion = trim($version);
        if ($requestedVersion === '') {
            $requestedVersion = readInstalledVersion();
        }

        $latestFallback = [];
        foreach (readInstalledManifestPathCandidates() as $manifestPath) {
            $raw = @file_get_contents($manifestPath);
            if (!is_string($raw) || trim($raw) === '') {
                continue;
            }
            $content = str_replace(["\r\n", "\r"], "\n", $raw);
            $matchedLines = extractChangesBlockForVersion($content, $requestedVersion);
            if (count($matchedLines) > 0) {
                $displayLines = $matchedLines;
                $previousEntry = extractPreviousChangesEntry($content, $requestedVersion);
                $displayLines = buildUniqueCurrentChangesLines($displayLines, (array)($previousEntry['lines'] ?? []));
                $displayLines = filterBoilerplateChangesLines($displayLines);
                return [
                    'version' => $requestedVersion,
                    'sourceVersion' => $requestedVersion,
                    'lines' => applyChangesLineLimit($displayLines, $maxLines),
                    'usedFallback' => false,
                    'manifestPath' => $manifestPath
                ];
            }

            if (count($latestFallback) === 0) {
                $latestFallback = extractLatestChangesBlock($content);
                if (count($latestFallback) > 0) {
                    $latestFallback['manifestPath'] = $manifestPath;
                }
            }
        }

        if ($allowFallback && count($latestFallback) > 0 && count($latestFallback['lines'] ?? []) > 0) {
            $latestLines = filterBoilerplateChangesLines((array)($latestFallback['lines'] ?? []));
            return [
                'version' => $requestedVersion,
                'sourceVersion' => (string)($latestFallback['sourceVersion'] ?? ''),
                'lines' => applyChangesLineLimit($latestLines, $maxLines),
                'usedFallback' => true,
                'manifestPath' => (string)($latestFallback['manifestPath'] ?? '')
            ];
        }

        return [
            'version' => $requestedVersion,
            'sourceVersion' => '',
            'lines' => [],
            'usedFallback' => false,
            'manifestPath' => ''
        ];
    }

    function classifyChangesCategory(array $lines): array {
        $text = strtolower(implode("\n", array_map(static function ($line): string {
            return trim((string)$line);
        }, $lines)));
        if (trim($text) === '') {
            return [
                'id' => 'bugfix',
                'label' => 'Bug Fix Update',
                'headline' => 'This update includes bug fixes and quality improvements.'
            ];
        }

        $scores = [
            'feature' => 0,
            'bugfix' => 0,
            'security' => 0,
            'performance' => 0,
            'ui' => 0,
            'maintenance' => 0
        ];
        $keywords = [
            'feature' => ['add', 'added', 'new', 'introduce', 'enhancement', 'support', 'wizard', 'module', 'column'],
            'bugfix' => ['fix', 'fixed', 'bug', 'regression', 'resolve', 'issue', 'broken', 'correct'],
            'security' => ['security', 'harden', 'token', 'guard', 'sanitize', 'xss', 'csrf', 'permission', 'auth'],
            'performance' => ['performance', 'optimiz', 'faster', 'cache', 'latency', 'speed', 'efficient'],
            'ui' => ['ui', 'ux', 'layout', 'style', 'responsive', 'mobile', 'visual', 'usability', 'alignment'],
            'maintenance' => ['maintenance', 'release', 'metadata', 'packaging', 'sync', 'build', 'ci', 'test', 'docs', 'documentation', 'cleanup', 'refactor', 'lint', 'guardrail', 'quality']
        ];

        foreach ($keywords as $category => $terms) {
            $score = 0;
            foreach ($terms as $term) {
                if (strpos($text, $term) !== false) {
                    $score += 1;
                }
            }
            $scores[$category] = $score;
        }

        arsort($scores);
        $orderedCategories = array_keys($scores);
        $topCategory = (string)($orderedCategories[0] ?? 'bugfix');
        $topScore = (int)($scores[$topCategory] ?? 0);
        $secondCategory = (string)($orderedCategories[1] ?? '');
        $secondScore = (int)($scores[$secondCategory] ?? 0);

        if ($topScore > 0 && $secondScore > 0 && abs($topScore - $secondScore) <= 1) {
            return [
                'id' => 'mixed',
                'label' => 'Mixed Update',
                'headline' => 'This update includes features, fixes, and quality improvements.'
            ];
        }

        if ($topScore <= 0) {
            $topCategory = 'bugfix';
        }

        $labels = [
            'feature' => 'Feature Update',
            'bugfix' => 'Bug Fix Update',
            'security' => 'Security Update',
            'performance' => 'Performance Update',
            'ui' => 'UI/UX Update',
            'maintenance' => 'Maintenance Update',
            'mixed' => 'Mixed Update'
        ];
        $headlines = [
            'feature' => 'This update includes new features and enhancements.',
            'bugfix' => 'This update includes bug fixes and quality improvements.',
            'security' => 'This update includes security hardening and safety improvements.',
            'performance' => 'This update includes performance and reliability improvements.',
            'ui' => 'This update includes UI and usability improvements.',
            'maintenance' => 'This update includes maintenance and quality improvements.',
            'mixed' => 'This update includes features, fixes, and quality improvements.'
        ];

        return [
            'id' => $topCategory,
            'label' => (string)$labels[$topCategory],
            'headline' => (string)$headlines[$topCategory]
        ];
    }

    function readCurrentVersionChangeSummary(int $maxLines = 14): array {
        $summary = readChangesSummaryForVersion(readInstalledVersion(), $maxLines, false);
        $category = classifyChangesCategory((array)($summary['lines'] ?? []));
        $summary['category'] = (string)($category['id'] ?? 'bugfix');
        $summary['categoryLabel'] = (string)($category['label'] ?? 'Bug Fix Update');
        $summary['headline'] = (string)($category['headline'] ?? 'This update includes bug fixes and quality improvements.');
        return $summary;
    }

    function readChangesLinesForVersion(string $version, int $maxLines = 14): array {
        $summary = readChangesSummaryForVersion($version, $maxLines);
        return (array)($summary['lines'] ?? []);
    }

    function readCurrentVersionChanges(int $maxLines = 14): array {
        return readChangesLinesForVersion(readInstalledVersion(), $maxLines);
    }

    function getLegacyConfigDirCandidates(): array {
        $candidates = [];
        foreach (FVPLUS_LEGACY_CONFIG_DIRS as $dir) {
            if (is_dir($dir)) {
                $candidates[] = $dir;
            }
        }
        return $candidates;
    }

    function readJsonObjectFile(string $path): ?array {
        if (!file_exists($path)) {
            return null;
        }
        $decoded = @json_decode((string)@file_get_contents($path), true);
        return is_array($decoded) ? $decoded : null;
    }

    function getLastGoodJsonPath(string $path): string {
        return $path . '.lastgood';
    }

    function writeJsonObjectAtomic(string $path, array $payload): void {
        $parent = dirname($path);
        if (!is_dir($parent)) {
            @mkdir($parent, 0770, true);
        }
        $encoded = json_encode($payload, JSON_UNESCAPED_SLASHES);
        if (!is_string($encoded) || $encoded === '') {
            throw new RuntimeException("Failed to encode JSON payload for '$path'.");
        }
        $tmpPath = $path . '.tmp';
        if (@file_put_contents($tmpPath, $encoded, LOCK_EX) === false) {
            throw new RuntimeException("Failed to write temp JSON payload for '$path'.");
        }
        if (!@rename($tmpPath, $path)) {
            @unlink($tmpPath);
            throw new RuntimeException("Failed to replace JSON payload for '$path'.");
        }
        @chmod($path, 0644);
    }

    function writeJsonObjectWithLastGood(string $path, array $payload): void {
        writeJsonObjectAtomic($path, $payload);
        $lastGoodPath = getLastGoodJsonPath($path);
        try {
            writeJsonObjectAtomic($lastGoodPath, $payload);
        } catch (Throwable $error) {
            // Keep primary writes non-fatal if last-good mirror fails.
        }
    }

    function recoverJsonObjectFromLastGood(string $path): ?array {
        $lastGoodPath = getLastGoodJsonPath($path);
        $decoded = readJsonObjectFile($lastGoodPath);
        if (!is_array($decoded)) {
            return null;
        }
        try {
            writeJsonObjectAtomic($path, $decoded);
        } catch (Throwable $error) {
            // Keep recovery best-effort.
        }
        return $decoded;
    }

    function normalizeFolderMapPayload($value): array {
        if (!is_array($value)) {
            return [];
        }
        $normalized = [];
        foreach ($value as $id => $folder) {
            $safeId = trim((string)$id);
            if ($safeId === '' || !is_array($folder)) {
                continue;
            }
            if (array_key_exists($safeId, $normalized)) {
                continue;
            }
            $normalized[$safeId] = normalizeFolderContentPayload($folder);
        }
        return normalizeFolderParentLinks($normalized);
    }

    function jsonObjectsDiffer(array $a, array $b): bool {
        return json_encode($a, JSON_UNESCAPED_SLASHES) !== json_encode($b, JSON_UNESCAPED_SLASHES);
    }

    function getLegacyMigrationMarkerPath(string $type, string $kind): string {
        global $configDir;
        $safeType = ensureType($type);
        $safeKind = $kind === 'prefs' ? 'prefs' : 'folders';
        return "$configDir/.legacy-migrated-$safeType-$safeKind";
    }

    function hasLegacyMigrationMarker(string $type, string $kind): bool {
        return file_exists(getLegacyMigrationMarkerPath($type, $kind));
    }

    function markLegacyMigrationComplete(string $type, string $kind): void {
        global $configDir;
        if (!is_dir($configDir)) {
            @mkdir($configDir, 0770, true);
        }
        @file_put_contents(getLegacyMigrationMarkerPath($type, $kind), gmdate('c'));
    }

    function migrateLegacyTypeDataIfNeeded(string $type, string $kind): void {
        $type = ensureType($type);
        $safeKind = $kind === 'prefs' ? 'prefs' : 'folders';
        if (hasLegacyMigrationMarker($type, $safeKind)) {
            return;
        }

        $targetPath = $safeKind === 'prefs' ? getTypePrefsPath($type) : getFolderFilePath($type);
        $targetData = readJsonObjectFile($targetPath);

        // Keep existing non-empty data/prefs untouched.
        if ($safeKind === 'prefs' && is_array($targetData)) {
            if (normalizeTypePrefs($targetData) !== defaultTypePrefs()) {
                return;
            }
        }
        if ($safeKind === 'folders' && is_array($targetData) && count($targetData) > 0) {
            return;
        }

        $legacyName = $safeKind === 'prefs' ? "$type.prefs.json" : "$type.json";
        foreach (getLegacyConfigDirCandidates() as $legacyDir) {
            $legacyPath = "$legacyDir/$legacyName";
            $legacyData = readJsonObjectFile($legacyPath);
            if (!is_array($legacyData)) {
                continue;
            }

            if ($safeKind === 'prefs') {
                $legacyData = normalizeTypePrefs($legacyData);
                if ($legacyData === defaultTypePrefs()) {
                    continue;
                }
            } else {
                $legacyData = normalizeFolderMapPayload($legacyData);
                if (count($legacyData) === 0) {
                    continue;
                }
            }

            writeJsonObjectWithLastGood($targetPath, $legacyData);
            markLegacyMigrationComplete($type, $safeKind);
            return;
        }
    }

    function getCustomOverrideDirs(string $kind): array {
        global $configDir;
        $safeKind = $kind === 'styles' ? 'styles' : 'scripts';
        $dirs = [];

        $currentDir = "$configDir/$safeKind";
        if (is_dir($currentDir)) {
            $dirs[] = $currentDir;
        }

        foreach (getLegacyConfigDirCandidates() as $legacyDir) {
            $path = "$legacyDir/$safeKind";
            if (is_dir($path)) {
                $dirs[] = $path;
            }
        }

        return array_values(array_unique($dirs));
    }

    function getFolderFilePath(string $type): string {
        global $configDir;
        return "$configDir/$type.json";
    }

    function readRawFolderMap(string $type): array {
        $type = ensureType($type);
        migrateLegacyTypeDataIfNeeded($type, 'folders');
        $path = getFolderFilePath($type);
        if (!file_exists($path)) {
            createFile($type);
        }
        $decoded = readJsonObjectFile($path);
        $recoveredFromLastGood = false;
        if (!is_array($decoded)) {
            $decoded = recoverJsonObjectFromLastGood($path);
            $recoveredFromLastGood = is_array($decoded);
        }
        if (!is_array($decoded)) {
            $decoded = [];
        }

        $normalized = normalizeFolderMapPayload($decoded);
        if ($recoveredFromLastGood || jsonObjectsDiffer($decoded, $normalized)) {
            writeRawFolderMap($type, $normalized);
        }
        return $normalized;
    }

    function writeRawFolderMap(string $type, array $folders): void {
        $type = ensureType($type);
        $path = getFolderFilePath($type);
        $normalized = normalizeFolderMapPayload($folders);
        writeJsonObjectWithLastGood($path, $normalized);
    }

    function getTypePrefsPath(string $type): string {
        global $configDir;
        return "$configDir/$type.prefs.json";
    }

    function defaultTypePrefs(): array {
        return [
            'sortMode' => 'created',
            'manualOrder' => [],
            'pinnedFolderIds' => [],
            'expandedFolderState' => [],
            'hideEmptyFolders' => false,
            'appColumnWidth' => 'standard',
            'setupWizardCompleted' => false,
            'settingsMode' => 'basic',
            'autoRules' => [],
            'badges' => [
                'running' => true,
                'stopped' => false,
                'updates' => true
            ],
            'runtimePrefsSchema' => FVPLUS_RUNTIME_PREFS_SCHEMA,
            'liveRefreshEnabled' => false,
            'liveRefreshSeconds' => 20,
            'performanceMode' => false,
            'lazyPreviewEnabled' => false,
            'lazyPreviewThreshold' => 30,
            'health' => [
                'cardsEnabled' => true,
                'runtimeBadgeEnabled' => false,
                'compact' => false,
                'warnStoppedPercent' => 60,
                'criticalStoppedPercent' => 90,
                'profile' => 'balanced',
                'updatesMode' => 'maintenance',
                'allStoppedMode' => 'critical'
            ],
            'status' => [
                'mode' => 'summary',
                'displayMode' => 'balanced',
                'trendEnabled' => true,
                'attentionAccent' => true,
                'warnStoppedPercent' => 60
            ],
            'backupSchedule' => [
                'enabled' => false,
                'intervalHours' => 24,
                'retention' => 25,
                'lastRunAt' => ''
            ],
            'importPresets' => [
                'defaultId' => 'builtin:merge',
                'custom' => []
            ]
        ];
    }

    function normalizeImportPresetName(string $name): string {
        $trimmed = trim($name);
        if ($trimmed === '') {
            return '';
        }
        return truncateUtf8String($trimmed, 64);
    }

    function normalizeImportPresetMode(string $mode): string {
        $normalized = strtolower(trim($mode));
        if ($normalized === 'replace' || $normalized === 'skip') {
            return $normalized;
        }
        return 'merge';
    }

    function normalizeTypeImportPresets($value): array {
        $incoming = is_array($value) ? $value : [];
        $rawCustom = is_array($incoming['custom'] ?? null) ? $incoming['custom'] : [];
        $custom = [];
        $seenIds = [];

        foreach ($rawCustom as $row) {
            if (!is_array($row)) {
                continue;
            }
            $id = trim((string)($row['id'] ?? ''));
            if ($id === '' || strpos($id, 'builtin:') === 0 || in_array($id, $seenIds, true)) {
                continue;
            }
            $name = normalizeImportPresetName((string)($row['name'] ?? ''));
            if ($name === '') {
                continue;
            }
            $seenIds[] = $id;
            $custom[] = [
                'id' => truncateUtf8String($id, 96),
                'name' => $name,
                'mode' => normalizeImportPresetMode((string)($row['mode'] ?? 'merge')),
                'dryRunOnly' => normalizeBool($row['dryRunOnly'] ?? false, false)
            ];
            if (count($custom) >= 30) {
                break;
            }
        }

        $defaultId = trim((string)($incoming['defaultId'] ?? 'builtin:merge'));
        if ($defaultId === '') {
            $defaultId = 'builtin:merge';
        }
        $defaultAllowed = [
            'builtin:merge',
            'builtin:replace',
            'builtin:skip',
            'builtin:dryrun'
        ];
        if (!in_array($defaultId, $defaultAllowed, true)) {
            $found = false;
            foreach ($custom as $row) {
                if ((string)$row['id'] === $defaultId) {
                    $found = true;
                    break;
                }
            }
            if (!$found) {
                $defaultId = 'builtin:merge';
            }
        }

        return [
            'defaultId' => $defaultId,
            'custom' => $custom
        ];
    }

    function normalizeBadgePrefs($badges): array {
        $incoming = is_array($badges) ? $badges : [];
        return [
            'running' => !array_key_exists('running', $incoming) ? true : (bool)$incoming['running'],
            'stopped' => !array_key_exists('stopped', $incoming) ? false : (bool)$incoming['stopped'],
            'updates' => !array_key_exists('updates', $incoming) ? true : (bool)$incoming['updates']
        ];
    }

    function normalizeAppColumnWidth($value): string {
        $normalized = strtolower(trim((string)$value));
        if (in_array($normalized, ['compact', 'standard', 'wide'], true)) {
            return $normalized;
        }
        return 'standard';
    }

    function normalizeTypePrefs(array $prefs): array {
        $normalized = defaultTypePrefs();
        $sortMode = $prefs['sortMode'] ?? $normalized['sortMode'];
        if (!in_array($sortMode, ['created', 'manual', 'alpha'], true)) {
            $sortMode = 'created';
        }
        $normalized['sortMode'] = $sortMode;

        $manualOrder = $prefs['manualOrder'] ?? [];
        if (!is_array($manualOrder)) {
            $manualOrder = [];
        }
        $normalized['manualOrder'] = normalizeStringIdList($manualOrder);
        $normalized['pinnedFolderIds'] = normalizeStringIdList($prefs['pinnedFolderIds'] ?? []);
        $normalized['expandedFolderState'] = normalizeExpandedStateMap($prefs['expandedFolderState'] ?? []);
        $normalized['hideEmptyFolders'] = normalizeBool($prefs['hideEmptyFolders'] ?? false, false);
        $normalized['appColumnWidth'] = normalizeAppColumnWidth($prefs['appColumnWidth'] ?? 'standard');
        $normalized['setupWizardCompleted'] = normalizeBool($prefs['setupWizardCompleted'] ?? false, false);
        $settingsMode = (string)($prefs['settingsMode'] ?? 'basic');
        $normalized['settingsMode'] = $settingsMode === 'advanced' ? 'advanced' : 'basic';

        $autoRules = $prefs['autoRules'] ?? [];
        if (!is_array($autoRules)) {
            $autoRules = [];
        }
        $normalizedRules = [];
        foreach ($autoRules as $rule) {
            if (!is_array($rule)) {
                continue;
            }
            $kind = (string)($rule['kind'] ?? 'name_regex');
            if (!in_array($kind, FVPLUS_RULE_KINDS, true)) {
                $kind = 'name_regex';
            }
            $effect = (string)($rule['effect'] ?? 'include');
            if (!in_array($effect, FVPLUS_RULE_EFFECTS, true)) {
                $effect = 'include';
            }
            $normalizedRules[] = [
                'id' => (string)($rule['id'] ?? generateId(12)),
                'enabled' => (bool)($rule['enabled'] ?? true),
                'folderId' => (string)($rule['folderId'] ?? ''),
                'effect' => $effect,
                'kind' => $kind,
                'pattern' => (string)($rule['pattern'] ?? ''),
                'labelKey' => (string)($rule['labelKey'] ?? ''),
                'labelValue' => (string)($rule['labelValue'] ?? '')
            ];
        }
        $normalized['autoRules'] = $normalizedRules;
        $normalized['badges'] = normalizeBadgePrefs($prefs['badges'] ?? []);
        $runtimePrefsSchema = normalizeIntInRange($prefs['runtimePrefsSchema'] ?? 0, 0, FVPLUS_RUNTIME_PREFS_SCHEMA, 0);
        $runtimePrefsReady = $runtimePrefsSchema >= FVPLUS_RUNTIME_PREFS_SCHEMA;
        $normalized['runtimePrefsSchema'] = FVPLUS_RUNTIME_PREFS_SCHEMA;
        $normalized['liveRefreshEnabled'] = $runtimePrefsReady
            ? normalizeBool($prefs['liveRefreshEnabled'] ?? false, false)
            : false;
        $normalized['liveRefreshSeconds'] = normalizeIntInRange($prefs['liveRefreshSeconds'] ?? 20, 10, 300, 20);
        $normalized['performanceMode'] = $runtimePrefsReady
            ? normalizeBool($prefs['performanceMode'] ?? false, false)
            : false;
        $normalized['lazyPreviewEnabled'] = $runtimePrefsReady
            ? normalizeBool($prefs['lazyPreviewEnabled'] ?? false, false)
            : false;
        $normalized['lazyPreviewThreshold'] = normalizeIntInRange($prefs['lazyPreviewThreshold'] ?? 30, 10, 200, 30);
        $healthIncoming = is_array($prefs['health'] ?? null) ? $prefs['health'] : [];
        $healthProfile = strtolower(trim((string)($healthIncoming['profile'] ?? 'balanced')));
        if (!in_array($healthProfile, ['strict', 'balanced', 'lenient'], true)) {
            $healthProfile = 'balanced';
        }
        $healthUpdatesMode = strtolower(trim((string)($healthIncoming['updatesMode'] ?? 'maintenance')));
        if (!in_array($healthUpdatesMode, ['maintenance', 'warn', 'ignore'], true)) {
            $healthUpdatesMode = 'maintenance';
        }
        $healthAllStoppedMode = strtolower(trim((string)($healthIncoming['allStoppedMode'] ?? 'critical')));
        if (!in_array($healthAllStoppedMode, ['critical', 'warn'], true)) {
            $healthAllStoppedMode = 'critical';
        }
        $normalized['health'] = [
            'cardsEnabled' => !array_key_exists('cardsEnabled', $healthIncoming)
                ? true
                : normalizeBool($healthIncoming['cardsEnabled'], true),
            'runtimeBadgeEnabled' => normalizeBool($healthIncoming['runtimeBadgeEnabled'] ?? false, false),
            'compact' => normalizeBool($healthIncoming['compact'] ?? false, false),
            'warnStoppedPercent' => normalizeIntInRange($healthIncoming['warnStoppedPercent'] ?? 60, 0, 100, 60),
            'criticalStoppedPercent' => normalizeIntInRange($healthIncoming['criticalStoppedPercent'] ?? 90, 0, 100, 90),
            'profile' => $healthProfile,
            'updatesMode' => $healthUpdatesMode,
            'allStoppedMode' => $healthAllStoppedMode
        ];
        $statusIncoming = is_array($prefs['status'] ?? null) ? $prefs['status'] : [];
        $statusMode = strtolower(trim((string)($statusIncoming['mode'] ?? 'summary')));
        if (!in_array($statusMode, ['summary', 'dominant'], true)) {
            $statusMode = 'summary';
        }
        $statusDisplayMode = strtolower(trim((string)($statusIncoming['displayMode'] ?? 'balanced')));
        if (!in_array($statusDisplayMode, ['simple', 'balanced', 'detailed'], true)) {
            $statusDisplayMode = 'balanced';
        }
        $normalized['status'] = [
            'mode' => $statusMode,
            'displayMode' => $statusDisplayMode,
            'trendEnabled' => !array_key_exists('trendEnabled', $statusIncoming)
                ? true
                : normalizeBool($statusIncoming['trendEnabled'], true),
            'attentionAccent' => !array_key_exists('attentionAccent', $statusIncoming)
                ? true
                : normalizeBool($statusIncoming['attentionAccent'], true),
            'warnStoppedPercent' => normalizeIntInRange($statusIncoming['warnStoppedPercent'] ?? 60, 0, 100, 60)
        ];

        $scheduleIncoming = is_array($prefs['backupSchedule'] ?? null) ? $prefs['backupSchedule'] : [];
        $normalized['backupSchedule'] = [
            'enabled' => normalizeBool($scheduleIncoming['enabled'] ?? false, false),
            'intervalHours' => normalizeIntInRange($scheduleIncoming['intervalHours'] ?? 24, 1, 168, 24),
            'retention' => normalizeIntInRange($scheduleIncoming['retention'] ?? 25, 1, 200, 25),
            'lastRunAt' => is_string($scheduleIncoming['lastRunAt'] ?? null) ? (string)$scheduleIncoming['lastRunAt'] : ''
        ];
        $normalized['importPresets'] = normalizeTypeImportPresets($prefs['importPresets'] ?? []);
        return $normalized;
    }

    function readTypePrefs(string $type): array {
        $type = ensureType($type);
        migrateLegacyTypeDataIfNeeded($type, 'prefs');
        $path = getTypePrefsPath($type);
        $parent = dirname($path);
        if (!is_dir($parent)) {
            @mkdir($parent, 0770, true);
        }
        if (!file_exists($path)) {
            return writeTypePrefs($type, defaultTypePrefs());
        }
        $decoded = readJsonObjectFile($path);
        $recoveredFromLastGood = false;
        if (!is_array($decoded)) {
            $decoded = recoverJsonObjectFromLastGood($path);
            $recoveredFromLastGood = is_array($decoded);
        }
        if (!is_array($decoded)) {
            $decoded = [];
        }
        $normalized = normalizeTypePrefs($decoded);
        if ($recoveredFromLastGood || jsonObjectsDiffer($decoded, $normalized)) {
            writeTypePrefs($type, $normalized);
        }
        return $normalized;
    }

    function writeTypePrefs(string $type, array $prefs): array {
        $type = ensureType($type);
        $path = getTypePrefsPath($type);
        $normalized = normalizeTypePrefs($prefs);
        writeJsonObjectWithLastGood($path, $normalized);
        return $normalized;
    }

    function reorderFoldersByIdList(string $type, array $orderedIds): array {
        $type = ensureType($type);
        $folders = readRawFolderMap($type);
        $reordered = [];

        foreach ($orderedIds as $id) {
            $id = (string)$id;
            if ($id === '' || !array_key_exists($id, $folders)) {
                continue;
            }
            $reordered[$id] = $folders[$id];
            unset($folders[$id]);
        }

        foreach ($folders as $id => $folder) {
            $reordered[$id] = $folder;
        }

        writeRawFolderMap($type, $reordered);

        // Keep manual prefs synchronized when present.
        $prefs = readTypePrefs($type);
        $prefs['manualOrder'] = array_keys($reordered);
        if (($prefs['sortMode'] ?? 'created') !== 'alpha') {
            $prefs['sortMode'] = 'manual';
        }
        writeTypePrefs($type, $prefs);

        if ($type === 'docker') {
            syncContainerOrder('docker');
        }

        try {
            appendDiagnosticsHistoryEvent('reorder', $type, [
                'folderCount' => count($reordered),
                'orderedIdsCount' => count($orderedIds)
            ], 'ok', 'server');
        } catch (Throwable $err) {
            // Keep core behavior non-fatal if diagnostics logging fails.
        }

        return $reordered;
    }

    function reorderFolderMapByPrefs(string $type, array $folders): array {
        $prefs = readTypePrefs($type);
        $sortMode = $prefs['sortMode'] ?? 'created';
        $applyPinnedOrder = function(array $ordered) use ($prefs): array {
            $pinnedIds = normalizeStringIdList($prefs['pinnedFolderIds'] ?? []);
            if (count($pinnedIds) === 0) {
                return $ordered;
            }
            $next = [];
            foreach ($pinnedIds as $id) {
                if (array_key_exists($id, $ordered)) {
                    $next[$id] = $ordered[$id];
                    unset($ordered[$id]);
                }
            }
            foreach ($ordered as $id => $folder) {
                $next[$id] = $folder;
            }
            return $next;
        };

        if ($sortMode === 'alpha') {
            $keys = array_keys($folders);
            usort($keys, function($a, $b) use ($folders) {
                $nameA = strtolower(trim((string)($folders[$a]['name'] ?? $a)));
                $nameB = strtolower(trim((string)($folders[$b]['name'] ?? $b)));
                $cmp = strnatcmp($nameA, $nameB);
                return $cmp !== 0 ? $cmp : strnatcmp((string)$a, (string)$b);
            });
            $ordered = [];
            foreach ($keys as $key) {
                $ordered[$key] = $folders[$key];
            }
            return $applyPinnedOrder($ordered);
        }

        if ($sortMode === 'manual') {
            $ordered = [];
            $manualOrder = $prefs['manualOrder'] ?? [];
            foreach ($manualOrder as $id) {
                if (array_key_exists($id, $folders)) {
                    $ordered[$id] = $folders[$id];
                    unset($folders[$id]);
                }
            }
            foreach ($folders as $id => $folder) {
                $ordered[$id] = $folder;
            }
            return $applyPinnedOrder($ordered);
        }

        return $applyPinnedOrder($folders);
    }

    function syncManualOrderWithFolders(string $type, array $folders): void {
        $prefs = readTypePrefs($type);
        if (($prefs['sortMode'] ?? 'created') !== 'manual') {
            return;
        }
        $order = [];
        foreach ($prefs['manualOrder'] as $id) {
            if (array_key_exists($id, $folders)) {
                $order[] = $id;
            }
        }
        foreach (array_keys($folders) as $id) {
            if (!in_array($id, $order, true)) {
                $order[] = $id;
            }
        }
        if ($order !== ($prefs['manualOrder'] ?? [])) {
            $prefs['manualOrder'] = $order;
            writeTypePrefs($type, $prefs);
        }
    }

    function getTypeBackupSchedule(string $type): array {
        $type = ensureType($type);
        $prefs = readTypePrefs($type);
        $schedule = is_array($prefs['backupSchedule'] ?? null) ? $prefs['backupSchedule'] : [];
        return [
            'enabled' => normalizeBool($schedule['enabled'] ?? false, false),
            'intervalHours' => normalizeIntInRange($schedule['intervalHours'] ?? 24, 1, 168, 24),
            'retention' => normalizeIntInRange($schedule['retention'] ?? 25, 1, 200, 25),
            'lastRunAt' => is_string($schedule['lastRunAt'] ?? null) ? (string)$schedule['lastRunAt'] : ''
        ];
    }

    function getTypeBackupRetention(string $type): int {
        $schedule = getTypeBackupSchedule($type);
        return normalizeIntInRange($schedule['retention'] ?? 25, 1, 200, 25);
    }

    function maybeRunScheduledBackup(string $type): void {
        static $running = [];
        $type = ensureType($type);
        if (isset($running[$type])) {
            return;
        }

        $running[$type] = true;
        try {
            $schedule = getTypeBackupSchedule($type);
            if (($schedule['enabled'] ?? false) !== true) {
                return;
            }
            $intervalHours = normalizeIntInRange($schedule['intervalHours'] ?? 24, 1, 168, 24);
            $now = time();
            $lastRun = 0;
            if (!empty($schedule['lastRunAt'])) {
                $parsed = strtotime((string)$schedule['lastRunAt']);
                if (is_int($parsed) || is_float($parsed)) {
                    $lastRun = (int)$parsed;
                }
            }
            $intervalSeconds = $intervalHours * 3600;
            if ($lastRun > 0 && ($now - $lastRun) < $intervalSeconds) {
                return;
            }

            createBackupSnapshot($type, 'scheduled');
            $prefs = readTypePrefs($type);
            $nextSchedule = is_array($prefs['backupSchedule'] ?? null) ? $prefs['backupSchedule'] : [];
            $nextSchedule['enabled'] = true;
            $nextSchedule['intervalHours'] = $intervalHours;
            $nextSchedule['retention'] = normalizeIntInRange($schedule['retention'] ?? 25, 1, 200, 25);
            $nextSchedule['lastRunAt'] = gmdate('c', $now);
            $prefs['backupSchedule'] = $nextSchedule;
            writeTypePrefs($type, $prefs);
            try {
                appendDiagnosticsHistoryEvent('backup_schedule_run', $type, [
                    'intervalHours' => $intervalHours,
                    'retention' => $nextSchedule['retention']
                ], 'ok', 'server');
            } catch (Throwable $err) {
                // Non-fatal.
            }
        } finally {
            unset($running[$type]);
        }
    }

    function runScheduledBackups(?string $type = null): array {
        $results = [];
        if ($type !== null && $type !== '') {
            $resolvedType = ensureType($type);
            maybeRunScheduledBackup($resolvedType);
            $results[$resolvedType] = getTypeBackupSchedule($resolvedType);
            return $results;
        }
        foreach (FVPLUS_ALLOWED_TYPES as $resolvedType) {
            maybeRunScheduledBackup($resolvedType);
            $results[$resolvedType] = getTypeBackupSchedule($resolvedType);
        }
        return $results;
    }

    function getBackupsDirPath(): string {
        global $configDir;
        return "$configDir/backups";
    }

    function getGlobalRollbackDirPath(): string {
        global $configDir;
        return "$configDir/rollback";
    }

    function getGlobalRollbackSnapshotPath(string $name): string {
        $safeName = basename($name);
        if ($safeName !== $name || !preg_match('/^global-[0-9]{8}-[0-9]{6}-[a-z0-9_-]+\.json$/', $safeName)) {
            throw new RuntimeException('Invalid rollback snapshot file name.');
        }
        return getGlobalRollbackDirPath() . "/$safeName";
    }

    function listGlobalRollbackSnapshots(): array {
        $rollbackDir = getGlobalRollbackDirPath();
        if (!is_dir($rollbackDir)) {
            return [];
        }
        $entries = [];
        foreach ((array)@scandir($rollbackDir) as $file) {
            if (!is_string($file) || $file === '.' || $file === '..') {
                continue;
            }
            if (!preg_match('/^global-[0-9]{8}-[0-9]{6}-[a-z0-9_-]+\.json$/', $file)) {
                continue;
            }
            $path = "$rollbackDir/$file";
            if (!is_file($path)) {
                continue;
            }
            $decoded = @json_decode((string)@file_get_contents($path), true);
            $reason = '';
            $pluginVersion = '';
            $dockerCount = null;
            $vmCount = null;
            if (is_array($decoded)) {
                $reason = (string)($decoded['reason'] ?? '');
                $pluginVersion = (string)($decoded['pluginVersion'] ?? '');
                $types = is_array($decoded['types'] ?? null) ? $decoded['types'] : [];
                $dockerFolders = $types['docker']['folders'] ?? null;
                $vmFolders = $types['vm']['folders'] ?? null;
                if (is_array($dockerFolders)) {
                    $dockerCount = count($dockerFolders);
                }
                if (is_array($vmFolders)) {
                    $vmCount = count($vmFolders);
                }
            }
            $entries[] = [
                'name' => $file,
                'createdAt' => gmdate('c', (int)@filemtime($path)),
                'size' => (int)@filesize($path),
                'reason' => $reason,
                'pluginVersion' => $pluginVersion,
                'dockerCount' => $dockerCount,
                'vmCount' => $vmCount
            ];
        }
        usort($entries, function($a, $b) {
            return strcmp((string)$b['createdAt'], (string)$a['createdAt']);
        });
        return $entries;
    }

    function pruneGlobalRollbackSnapshots(int $keep = FVPLUS_GLOBAL_ROLLBACK_HISTORY_MAX): array {
        $keep = max(1, $keep);
        $snapshots = listGlobalRollbackSnapshots();
        $removed = [];
        if (count($snapshots) <= $keep) {
            return $removed;
        }
        $toRemove = array_slice($snapshots, $keep);
        foreach ($toRemove as $snapshot) {
            try {
                $path = getGlobalRollbackSnapshotPath((string)$snapshot['name']);
                if (file_exists($path)) {
                    @unlink($path);
                    $removed[] = (string)$snapshot['name'];
                }
            } catch (Throwable $err) {
                continue;
            }
        }
        return $removed;
    }

    function createGlobalRollbackSnapshot(string $reason = 'manual'): array {
        $rollbackDir = getGlobalRollbackDirPath();
        if (!is_dir($rollbackDir)) {
            @mkdir($rollbackDir, 0770, true);
        }
        $slugReason = trim((string)preg_replace('/[^a-zA-Z0-9_-]+/', '-', strtolower($reason)), '-');
        if ($slugReason === '') {
            $slugReason = 'manual';
        }
        $filename = sprintf('global-%s-%s.json', gmdate('Ymd-His'), $slugReason);
        $payload = [
            'rollbackSchemaVersion' => FVPLUS_GLOBAL_ROLLBACK_SCHEMA_VERSION,
            'pluginVersion' => readInstalledVersion(),
            'createdAt' => gmdate('c'),
            'reason' => $reason,
            'types' => [
                'docker' => [
                    'folders' => readRawFolderMap('docker'),
                    'prefs' => readTypePrefs('docker')
                ],
                'vm' => [
                    'folders' => readRawFolderMap('vm'),
                    'prefs' => readTypePrefs('vm')
                ]
            ]
        ];
        @file_put_contents("$rollbackDir/$filename", json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
        $pruned = pruneGlobalRollbackSnapshots(FVPLUS_GLOBAL_ROLLBACK_HISTORY_MAX);
        try {
            appendDiagnosticsHistoryEvent('rollback_create', null, [
                'name' => $filename,
                'reason' => $reason,
                'dockerCount' => count($payload['types']['docker']['folders']),
                'vmCount' => count($payload['types']['vm']['folders']),
                'prunedCount' => count($pruned)
            ], 'ok', 'server');
        } catch (Throwable $err) {
            // Keep rollback checkpoint creation non-fatal.
        }
        return [
            'name' => $filename,
            'createdAt' => gmdate('c'),
            'reason' => $reason,
            'pluginVersion' => $payload['pluginVersion'],
            'dockerCount' => count($payload['types']['docker']['folders']),
            'vmCount' => count($payload['types']['vm']['folders']),
            'pruned' => $pruned
        ];
    }

    function restoreGlobalRollbackSnapshot(string $name): array {
        $path = getGlobalRollbackSnapshotPath($name);
        $safeName = basename($path);
        if (!file_exists($path)) {
            throw new RuntimeException('Rollback snapshot file not found.');
        }
        $decoded = @json_decode((string)@file_get_contents($path), true);
        if (!is_array($decoded)) {
            throw new RuntimeException('Rollback snapshot is not valid JSON.');
        }
        $typesData = is_array($decoded['types'] ?? null) ? $decoded['types'] : [];
        $counts = [];
        foreach (FVPLUS_ALLOWED_TYPES as $type) {
            $entry = is_array($typesData[$type] ?? null) ? $typesData[$type] : [];
            $folders = is_array($entry['folders'] ?? null) ? $entry['folders'] : [];
            $prefs = is_array($entry['prefs'] ?? null) ? $entry['prefs'] : readTypePrefs($type);

            writeRawFolderMap($type, $folders);
            syncManualOrderWithFolders($type, $folders);
            writeTypePrefs($type, $prefs);
            if ($type === 'docker') {
                syncContainerOrder('docker');
            }
            $counts[$type] = count($folders);
        }

        try {
            appendDiagnosticsHistoryEvent('rollback_restore', null, [
                'name' => $safeName,
                'dockerCount' => (int)($counts['docker'] ?? 0),
                'vmCount' => (int)($counts['vm'] ?? 0)
            ], 'ok', 'server');
        } catch (Throwable $err) {
            // Non-fatal.
        }
        return [
            'name' => $safeName,
            'restoredAt' => gmdate('c'),
            'dockerCount' => (int)($counts['docker'] ?? 0),
            'vmCount' => (int)($counts['vm'] ?? 0)
        ];
    }

    function restoreLatestGlobalRollbackSnapshot(): array {
        $snapshots = listGlobalRollbackSnapshots();
        if (empty($snapshots)) {
            throw new RuntimeException('No rollback snapshots available.');
        }
        return restoreGlobalRollbackSnapshot((string)$snapshots[0]['name']);
    }

    function restorePreviousGlobalRollbackSnapshot(): array {
        $snapshots = listGlobalRollbackSnapshots();
        if (count($snapshots) < 2) {
            throw new RuntimeException('No previous rollback snapshot available.');
        }
        $target = (string)$snapshots[1]['name'];
        $undo = createGlobalRollbackSnapshot('before-global-rollback');
        $restored = restoreGlobalRollbackSnapshot($target);
        $restored['targetName'] = $target;
        $restored['undoSnapshot'] = (string)($undo['name'] ?? '');
        return $restored;
    }

    function getBackupSnapshotPath(string $type, string $name): string {
        $type = ensureType($type);
        $safeName = basename($name);
        if ($safeName !== $name || !preg_match('/^' . preg_quote($type, '/') . '-.*\.json$/', $safeName)) {
            throw new RuntimeException('Invalid backup file name.');
        }
        return getBackupsDirPath() . "/$safeName";
    }

    function pruneBackupSnapshots(string $type, int $keep = 25): array {
        $type = ensureType($type);
        $keep = max(1, $keep);
        $snapshots = listBackupSnapshots($type);
        $removed = [];
        if (count($snapshots) <= $keep) {
            return $removed;
        }
        $toRemove = array_slice($snapshots, $keep);
        foreach ($toRemove as $snapshot) {
            try {
                $path = getBackupSnapshotPath($type, (string)$snapshot['name']);
                if (file_exists($path)) {
                    @unlink($path);
                    $removed[] = (string)$snapshot['name'];
                }
            } catch (Throwable $err) {
                continue;
            }
        }
        return $removed;
    }

    function createBackupSnapshot(string $type, string $reason = 'manual'): array {
        $type = ensureType($type);
        $folders = readRawFolderMap($type);
        $prefs = readTypePrefs($type);
        $backupDir = getBackupsDirPath();
        if (!is_dir($backupDir)) {
            @mkdir($backupDir, 0770, true);
        }
        $slugReason = trim((string)preg_replace('/[^a-zA-Z0-9_-]+/', '-', strtolower($reason)), '-');
        if ($slugReason === '') {
            $slugReason = 'manual';
        }
        $filename = sprintf('%s-%s-%s.json', $type, gmdate('Ymd-His'), $slugReason);
        $payload = [
            'schemaVersion' => FVPLUS_EXPORT_SCHEMA_VERSION,
            'pluginVersion' => readInstalledVersion(),
            'exportedAt' => gmdate('c'),
            'type' => $type,
            'mode' => 'full',
            'reason' => $reason,
            'folders' => $folders,
            'prefs' => $prefs
        ];
        @file_put_contents("$backupDir/$filename", json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
        $pruned = pruneBackupSnapshots($type, getTypeBackupRetention($type));
        try {
            appendDiagnosticsHistoryEvent('backup_create', $type, [
                'reason' => $reason,
                'name' => $filename,
                'folderCount' => count($folders),
                'prunedCount' => count($pruned)
            ], 'ok', 'server');
        } catch (Throwable $err) {
            // Keep backup creation non-fatal.
        }
        return [
            'name' => $filename,
            'createdAt' => gmdate('c'),
            'count' => count($folders),
            'pruned' => $pruned
        ];
    }

    function listBackupSnapshots(string $type): array {
        $type = ensureType($type);
        $backupDir = getBackupsDirPath();
        if (!is_dir($backupDir)) {
            return [];
        }
        $entries = [];
        foreach ((array)@scandir($backupDir) as $file) {
            if (!is_string($file) || $file === '.' || $file === '..') {
                continue;
            }
            if (!preg_match('/^' . preg_quote($type, '/') . '-.*\.json$/', $file)) {
                continue;
            }
            $path = "$backupDir/$file";
            if (!is_file($path)) {
                continue;
            }
            $decoded = @json_decode((string)@file_get_contents($path), true);
            $reason = '';
            $count = null;
            if (is_array($decoded)) {
                $reason = (string)($decoded['reason'] ?? '');
                if (isset($decoded['folders']) && is_array($decoded['folders'])) {
                    $count = count($decoded['folders']);
                }
            }
            $entries[] = [
                'name' => $file,
                'createdAt' => gmdate('c', (int)@filemtime($path)),
                'size' => (int)@filesize($path),
                'reason' => $reason,
                'count' => $count
            ];
        }
        usort($entries, function($a, $b) {
            return strcmp($b['createdAt'], $a['createdAt']);
        });
        return $entries;
    }

    function readBackupSnapshot(string $type, string $name): array {
        $type = ensureType($type);
        $path = getBackupSnapshotPath($type, $name);
        $safeName = basename($path);
        if (!file_exists($path)) {
            throw new RuntimeException('Backup file not found.');
        }

        $raw = (string)@file_get_contents($path);
        $decoded = @json_decode($raw, true);
        if (!is_array($decoded)) {
            throw new RuntimeException('Backup payload is not valid JSON.');
        }
        validateBackupPayloadType($decoded, $type);
        $folders = normalizeImportedFoldersPayload($decoded);
        if (!is_array($folders)) {
            $folders = [];
        }
        $prefs = is_array($decoded['prefs'] ?? null) ? normalizeTypePrefs($decoded['prefs']) : null;

        return [
            'name' => $safeName,
            'createdAt' => gmdate('c', (int)@filemtime($path)),
            'reason' => (string)($decoded['reason'] ?? ''),
            'schemaVersion' => array_key_exists('schemaVersion', $decoded) ? $decoded['schemaVersion'] : null,
            'pluginVersion' => (string)($decoded['pluginVersion'] ?? ''),
            'exportedAt' => (string)($decoded['exportedAt'] ?? ''),
            'count' => count($folders),
            'prefs' => $prefs,
            'folders' => $folders
        ];
    }

    function deleteBackupSnapshot(string $type, string $name): array {
        $path = getBackupSnapshotPath($type, $name);
        if (!file_exists($path)) {
            throw new RuntimeException('Backup file not found.');
        }
        if (!@unlink($path)) {
            throw new RuntimeException('Failed to delete backup file.');
        }
        try {
            appendDiagnosticsHistoryEvent('backup_delete', $type, [
                'name' => basename($path)
            ], 'ok', 'server');
        } catch (Throwable $err) {
            // Non-fatal.
        }
        return [
            'name' => basename($path),
            'deletedAt' => gmdate('c')
        ];
    }

    function normalizeImportedFoldersPayload($decoded): array {
        if (!is_array($decoded)) {
            throw new RuntimeException('Backup payload is not a JSON object.');
        }
        if (array_key_exists('folders', $decoded) && is_array($decoded['folders'])) {
            return $decoded['folders'];
        }
        return $decoded;
    }

    function validateBackupPayloadType(array $decoded, string $type): void {
        $type = ensureType($type);
        $declaredRaw = strtolower(trim((string)($decoded['type'] ?? '')));
        if ($declaredRaw !== '' && !in_array($declaredRaw, FVPLUS_ALLOWED_TYPES, true)) {
            throw new RuntimeException('Backup payload has an invalid type.');
        }
        if ($declaredRaw !== '' && $declaredRaw !== $type) {
            throw new RuntimeException("Backup type \"$declaredRaw\" does not match \"$type\".");
        }
        if (array_key_exists('schemaVersion', $decoded) && $declaredRaw === '') {
            throw new RuntimeException('Backup payload is missing a required type marker.');
        }
    }

    function restoreBackupSnapshot(string $type, string $name): array {
        $type = ensureType($type);
        $path = getBackupSnapshotPath($type, $name);
        $safeName = basename($path);
        if (!file_exists($path)) {
            throw new RuntimeException('Backup file not found.');
        }
        $decoded = @json_decode((string)@file_get_contents($path), true);
        if (is_array($decoded)) {
            validateBackupPayloadType($decoded, $type);
        }
        $folders = normalizeImportedFoldersPayload($decoded);
        writeRawFolderMap($type, is_array($folders) ? $folders : []);
        syncManualOrderWithFolders($type, is_array($folders) ? $folders : []);
        if ($type === 'docker') {
            syncContainerOrder('docker');
        }
        try {
            appendDiagnosticsHistoryEvent('backup_restore', $type, [
                'name' => $safeName,
                'folderCount' => count(is_array($folders) ? $folders : [])
            ], 'ok', 'server');
        } catch (Throwable $err) {
            // Non-fatal.
        }
        return [
            'name' => $safeName,
            'restoredAt' => gmdate('c'),
            'count' => count(is_array($folders) ? $folders : [])
        ];
    }

    function restoreLatestBackupSnapshot(string $type): array {
        $snapshots = listBackupSnapshots($type);
        if (empty($snapshots)) {
            throw new RuntimeException('No backups available.');
        }
        return restoreBackupSnapshot($type, $snapshots[0]['name']);
    }

    function isUndoBackupReason(string $reason): bool {
        $normalized = strtolower(trim($reason));
        if ($normalized === '') {
            return false;
        }
        return strpos($normalized, 'before-') === 0
            || strpos($normalized, 'pre-') === 0
            || strpos($normalized, 'undo-') === 0
            || strpos($normalized, 'transaction-') === 0;
    }

    function restoreLatestUndoBackupSnapshot(string $type): array {
        $type = ensureType($type);
        $snapshots = listBackupSnapshots($type);
        foreach ($snapshots as $snapshot) {
            $reason = (string)($snapshot['reason'] ?? '');
            if (!isUndoBackupReason($reason)) {
                continue;
            }
            return restoreBackupSnapshot($type, (string)$snapshot['name']);
        }
        throw new RuntimeException('No undo-capable backups found.');
    }

    function normalizeRuntimeItemNames($items): array {
        if (!is_array($items)) {
            return [];
        }
        $normalized = [];
        foreach ($items as $item) {
            $name = trim((string)$item);
            if ($name === '' || in_array($name, $normalized, true)) {
                continue;
            }
            $normalized[] = $name;
        }
        return $normalized;
    }

    function runtimeActionAllowed(string $type, string $action, string $stateKind): bool {
        $type = ensureType($type);
        $normalizedAction = strtolower(trim($action));
        $normalizedState = in_array($stateKind, ['started', 'paused', 'stopped'], true) ? $stateKind : 'stopped';
        if (!in_array($normalizedAction, ['start', 'stop', 'pause', 'resume'], true)) {
            return false;
        }
        if ($normalizedAction === 'start') {
            return $normalizedState === 'stopped';
        }
        if ($normalizedAction === 'stop') {
            return $type === 'docker'
                ? ($normalizedState === 'started' || $normalizedState === 'paused')
                : ($normalizedState === 'started');
        }
        if ($normalizedAction === 'pause') {
            return $normalizedState === 'started';
        }
        if ($normalizedAction === 'resume') {
            return $normalizedState === 'paused';
        }
        return false;
    }

    function runShellActionCommand(string $command): array {
        $output = [];
        $exitCode = 0;
        @exec($command . ' 2>&1', $output, $exitCode);
        return [
            'ok' => $exitCode === 0,
            'exitCode' => (int)$exitCode,
            'output' => array_slice(array_values($output), 0, 8)
        ];
    }

    function executeFolderRuntimeAction(string $type, string $action, array $items): array {
        $type = ensureType($type);
        $normalizedAction = strtolower(trim($action));
        if (!in_array($normalizedAction, ['start', 'stop', 'pause', 'resume'], true)) {
            throw new RuntimeException('Unsupported runtime action.');
        }

        $names = normalizeRuntimeItemNames($items);
        if (count($names) === 0) {
            return [
                'type' => $type,
                'action' => $normalizedAction,
                'requested' => 0,
                'executed' => 0,
                'succeeded' => 0,
                'failed' => 0,
                'skipped' => [],
                'errors' => [],
                'results' => [],
                'executedAt' => gmdate('c')
            ];
        }

        $info = readInfo($type);
        $results = [];
        $errors = [];
        $skipped = [];
        $succeeded = 0;
        $failed = 0;
        $executed = 0;

        foreach ($names as $name) {
            if (!array_key_exists($name, $info)) {
                $failed++;
                $errors[] = [
                    'item' => $name,
                    'reason' => 'Item was not found in current runtime info.'
                ];
                continue;
            }

            $item = is_array($info[$name]) ? $info[$name] : [];
            $stateKind = $type === 'docker'
                ? diagnosticsStateKindForDockerItem($item)
                : diagnosticsStateKindForVmItem($item);
            if (!runtimeActionAllowed($type, $normalizedAction, $stateKind)) {
                $skipped[] = [
                    'item' => $name,
                    'state' => $stateKind,
                    'reason' => 'Action is not applicable for current state.'
                ];
                continue;
            }

            if ($type === 'docker') {
                $dockerAction = $normalizedAction === 'resume' ? 'unpause' : $normalizedAction;
                $command = 'docker ' . $dockerAction . ' ' . escapeshellarg($name);
            } else {
                $vmAction = $normalizedAction;
                if ($vmAction === 'start') {
                    $command = 'virsh start ' . escapeshellarg($name);
                } elseif ($vmAction === 'stop') {
                    $command = 'virsh shutdown ' . escapeshellarg($name);
                } elseif ($vmAction === 'pause') {
                    $command = 'virsh suspend ' . escapeshellarg($name);
                } else {
                    $command = 'virsh resume ' . escapeshellarg($name);
                }
            }

            $executed++;
            $commandResult = runShellActionCommand($command);
            if ($commandResult['ok']) {
                $succeeded++;
            } else {
                $failed++;
                $errors[] = [
                    'item' => $name,
                    'reason' => 'Command failed.',
                    'exitCode' => $commandResult['exitCode'],
                    'output' => $commandResult['output']
                ];
            }
            $results[] = [
                'item' => $name,
                'state' => $stateKind,
                'command' => $command,
                'ok' => $commandResult['ok'],
                'exitCode' => $commandResult['exitCode'],
                'output' => $commandResult['output']
            ];
        }

        try {
            appendDiagnosticsHistoryEvent('runtime_bulk_action', $type, [
                'action' => $normalizedAction,
                'requested' => count($names),
                'executed' => $executed,
                'succeeded' => $succeeded,
                'failed' => $failed,
                'skipped' => count($skipped)
            ], $failed > 0 ? 'warning' : 'ok', 'server');
        } catch (Throwable $err) {
            // Non-fatal.
        }

        return [
            'type' => $type,
            'action' => $normalizedAction,
            'requested' => count($names),
            'executed' => $executed,
            'succeeded' => $succeeded,
            'failed' => $failed,
            'skipped' => $skipped,
            'errors' => $errors,
            'results' => $results,
            'executedAt' => gmdate('c')
        ];
    }

    function getTemplatePath(string $type): string {
        global $configDir;
        $type = ensureType($type);
        return "$configDir/$type.templates.json";
    }

    function normalizeTemplateEntry(array $template): ?array {
        $id = trim((string)($template['id'] ?? ''));
        $name = trim((string)($template['name'] ?? ''));
        if ($name === '') {
            return null;
        }
        if ($id === '') {
            $id = generateId(12);
        }
        $settings = is_array($template['settings'] ?? null) ? $template['settings'] : [];
        $actions = is_array($template['actions'] ?? null) ? array_values($template['actions']) : [];
        return [
            'id' => $id,
            'name' => $name,
            'icon' => (string)($template['icon'] ?? ''),
            'regex' => (string)($template['regex'] ?? ''),
            'settings' => $settings,
            'actions' => $actions,
            'createdAt' => is_string($template['createdAt'] ?? null) ? (string)$template['createdAt'] : gmdate('c'),
            'updatedAt' => gmdate('c')
        ];
    }

    function readFolderTemplates(string $type): array {
        $type = ensureType($type);
        $path = getTemplatePath($type);
        if (!file_exists($path)) {
            return [];
        }
        $decoded = @json_decode((string)@file_get_contents($path), true);
        if (!is_array($decoded)) {
            return [];
        }
        $rows = [];
        foreach ($decoded as $row) {
            if (!is_array($row)) {
                continue;
            }
            $normalized = normalizeTemplateEntry($row);
            if (!$normalized) {
                continue;
            }
            $rows[] = $normalized;
        }
        return $rows;
    }

    function writeFolderTemplates(string $type, array $templates): array {
        $type = ensureType($type);
        $path = getTemplatePath($type);
        $parent = dirname($path);
        if (!is_dir($parent)) {
            @mkdir($parent, 0770, true);
        }
        $rows = [];
        foreach ($templates as $row) {
            if (!is_array($row)) {
                continue;
            }
            $normalized = normalizeTemplateEntry($row);
            if (!$normalized) {
                continue;
            }
            $rows[] = $normalized;
        }
        @file_put_contents($path, json_encode(array_values($rows), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
        return array_values($rows);
    }

    function createFolderTemplateFromFolder(string $type, string $folderId, string $templateName): array {
        $type = ensureType($type);
        $folderId = trim($folderId);
        if ($folderId === '') {
            throw new RuntimeException('Folder ID is required.');
        }
        $name = trim($templateName);
        if ($name === '') {
            throw new RuntimeException('Template name is required.');
        }

        $folders = readRawFolderMap($type);
        if (!array_key_exists($folderId, $folders)) {
            throw new RuntimeException('Folder not found.');
        }
        $folder = is_array($folders[$folderId]) ? $folders[$folderId] : [];
        $template = [
            'id' => generateId(12),
            'name' => $name,
            'icon' => (string)($folder['icon'] ?? ''),
            'regex' => (string)($folder['regex'] ?? ''),
            'settings' => is_array($folder['settings'] ?? null) ? $folder['settings'] : [],
            'actions' => is_array($folder['actions'] ?? null) ? $folder['actions'] : [],
            'createdAt' => gmdate('c')
        ];

        $templates = readFolderTemplates($type);
        $templates[] = $template;
        $saved = writeFolderTemplates($type, $templates);
        try {
            appendDiagnosticsHistoryEvent('template_create', $type, [
                'templateId' => $template['id'],
                'templateName' => $name,
                'folderId' => $folderId
            ], 'ok', 'server');
        } catch (Throwable $err) {
            // Non-fatal.
        }
        return [
            'template' => $template,
            'templates' => $saved
        ];
    }

    function deleteFolderTemplate(string $type, string $templateId): array {
        $type = ensureType($type);
        $templateId = trim($templateId);
        if ($templateId === '') {
            throw new RuntimeException('Template ID is required.');
        }
        $templates = readFolderTemplates($type);
        $next = array_values(array_filter($templates, function($template) use ($templateId) {
            return (string)($template['id'] ?? '') !== $templateId;
        }));
        if (count($next) === count($templates)) {
            throw new RuntimeException('Template not found.');
        }
        $saved = writeFolderTemplates($type, $next);
        try {
            appendDiagnosticsHistoryEvent('template_delete', $type, [
                'templateId' => $templateId
            ], 'ok', 'server');
        } catch (Throwable $err) {
            // Non-fatal.
        }
        return $saved;
    }

    function applyFolderTemplateToFolder(string $type, string $templateId, string $folderId): array {
        $type = ensureType($type);
        $templateId = trim($templateId);
        $folderId = trim($folderId);
        if ($templateId === '' || $folderId === '') {
            throw new RuntimeException('Template ID and folder ID are required.');
        }
        $templates = readFolderTemplates($type);
        $template = null;
        foreach ($templates as $row) {
            if ((string)($row['id'] ?? '') === $templateId) {
                $template = $row;
                break;
            }
        }
        if (!is_array($template)) {
            throw new RuntimeException('Template not found.');
        }

        $folders = readRawFolderMap($type);
        if (!array_key_exists($folderId, $folders)) {
            throw new RuntimeException('Target folder not found.');
        }
        $folder = is_array($folders[$folderId]) ? $folders[$folderId] : [];
        $folder['icon'] = (string)($template['icon'] ?? ($folder['icon'] ?? ''));
        $folder['regex'] = (string)($template['regex'] ?? ($folder['regex'] ?? ''));
        $folder['settings'] = is_array($template['settings'] ?? null) ? $template['settings'] : (is_array($folder['settings'] ?? null) ? $folder['settings'] : []);
        $folder['actions'] = is_array($template['actions'] ?? null) ? $template['actions'] : (is_array($folder['actions'] ?? null) ? $folder['actions'] : []);
        $folders[$folderId] = $folder;
        writeRawFolderMap($type, $folders);
        syncManualOrderWithFolders($type, $folders);
        if ($type === 'docker') {
            syncContainerOrder('docker');
        }
        try {
            appendDiagnosticsHistoryEvent('template_apply', $type, [
                'templateId' => $templateId,
                'folderId' => $folderId
            ], 'ok', 'server');
        } catch (Throwable $err) {
            // Non-fatal.
        }
        return [
            'folderId' => $folderId,
            'templateId' => $templateId
        ];
    }

    function checkRemotePluginUpdate(): array {
        $manifestUrl = FVPLUS_REMOTE_MANIFEST_URL;
        $requestUrl = $manifestUrl . '?_=' . time();
        $checkedAt = gmdate('c');
        $currentVersion = readInstalledVersion();
        $startedAt = microtime(true);
        $context = stream_context_create([
            'http' => [
                'timeout' => 8,
                'ignore_errors' => true,
                'header' => "Cache-Control: no-cache\r\nPragma: no-cache\r\nUser-Agent: FolderViewPlus/1.0\r\n"
            ]
        ]);
        $content = @file_get_contents($requestUrl, false, $context);
        $durationMs = (int)round((microtime(true) - $startedAt) * 1000);
        $statusLine = '';
        if (isset($http_response_header) && is_array($http_response_header) && isset($http_response_header[0])) {
            $statusLine = (string)$http_response_header[0];
        }
        if ($content === false) {
            return [
                'ok' => false,
                'checkedAt' => $checkedAt,
                'currentVersion' => $currentVersion,
                'remoteVersion' => null,
                'updateAvailable' => false,
                'manifestUrl' => $manifestUrl,
                'requestUrl' => $requestUrl,
                'responseStatus' => $statusLine,
                'durationMs' => $durationMs,
                'error' => 'Unable to fetch remote plugin manifest.'
            ];
        }
        if (!preg_match('/<!ENTITY version "([^"]+)">/', $content, $match)) {
            return [
                'ok' => false,
                'checkedAt' => $checkedAt,
                'currentVersion' => $currentVersion,
                'remoteVersion' => null,
                'updateAvailable' => false,
                'manifestUrl' => $manifestUrl,
                'requestUrl' => $requestUrl,
                'responseStatus' => $statusLine,
                'durationMs' => $durationMs,
                'error' => 'Remote manifest did not include a version entity.'
            ];
        }
        $remoteVersion = trim((string)$match[1]);
        $updateAvailable = version_compare($remoteVersion, $currentVersion, '>');
        return [
            'ok' => true,
            'checkedAt' => $checkedAt,
            'currentVersion' => $currentVersion,
            'remoteVersion' => $remoteVersion,
            'updateAvailable' => $updateAvailable,
            'manifestUrl' => $manifestUrl,
            'requestUrl' => $requestUrl,
            'responseStatus' => $statusLine,
            'durationMs' => $durationMs,
            'error' => null
        ];
    }

    function readFolder(string $type) : string {
        $type = ensureType($type);
        maybeRunScheduledBackup($type);
        $folders = readRawFolderMap($type);
        syncManualOrderWithFolders($type, $folders);
        $ordered = reorderFolderMapByPrefs($type, $folders);
        return json_encode($ordered);
    }

    function readUserPrefs(string $type) : string {
        $userPrefsDir = "/boot/config/plugins";
        $prefsFilePath = '';
        if($type == 'docker') { $prefsFilePath = "$userPrefsDir/dockerMan/userprefs.cfg"; }
        elseif($type == 'vm') { $prefsFilePath = "$userPrefsDir/dynamix.vm.manager/userprefs.cfg"; }
        else { return '[]'; }
        if(!file_exists($prefsFilePath)) { return '[]'; }
        $parsedIni = @parse_ini_file($prefsFilePath);
        return json_encode(array_values($parsedIni ?: []));
    }

    function normalizeFolderMembers($members): array {
        $raw = [];
        if (is_array($members)) {
            $isList = array_keys($members) === range(0, count($members) - 1);
            if ($isList) {
                $raw = $members;
            } else {
                $raw = array_keys($members);
            }
        }
        $normalized = [];
        foreach ($raw as $item) {
            $name = trim((string)$item);
            if ($name === '' || in_array($name, $normalized, true)) {
                continue;
            }
            $normalized[] = $name;
        }
        return $normalized;
    }

    function getFolderLabelValueFromLabels($labels): string {
        if (!is_array($labels)) {
            return '';
        }
        foreach (FVPLUS_DOCKER_FOLDER_LABEL_KEYS as $key) {
            if (isset($labels[$key]) && trim((string)$labels[$key]) !== '') {
                return trim((string)$labels[$key]);
            }
        }
        return '';
    }

    function basenameFromPathish(string $value): string {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return '';
        }
        $first = trim(explode(',', $trimmed)[0] ?? '');
        if ($first === '') {
            return '';
        }
        $normalized = str_replace('\\', '/', $first);
        $normalized = rtrim($normalized, '/');
        if ($normalized === '') {
            return '';
        }
        $parts = explode('/', $normalized);
        $last = trim((string)end($parts));
        return $last;
    }

    function getComposeProjectValueFromLabels($labels): string {
        if (!is_array($labels)) {
            return '';
        }
        $explicit = trim((string)($labels['com.docker.compose.project'] ?? ''));
        if ($explicit !== '') {
            return $explicit;
        }
        $fromWorkingDir = basenameFromPathish((string)($labels['com.docker.compose.project.working_dir'] ?? ''));
        if ($fromWorkingDir !== '') {
            return $fromWorkingDir;
        }
        $configFiles = trim((string)($labels['com.docker.compose.project.config_files'] ?? ''));
        if ($configFiles !== '') {
            $firstConfig = trim(explode(',', $configFiles)[0] ?? '');
            if ($firstConfig !== '') {
                $normalized = str_replace('\\', '/', $firstConfig);
                $fromConfigDir = basenameFromPathish(dirname($normalized));
                if ($fromConfigDir !== '') {
                    return $fromConfigDir;
                }
            }
        }
        return '';
    }

    function getNormalizedDockerManagerFromLabels($labels) {
        if (!is_array($labels)) {
            return false;
        }
        $manager = strtolower(trim((string)($labels['net.unraid.docker.managed'] ?? '')));
        if ($manager === '' && getComposeProjectValueFromLabels($labels) !== '') {
            $manager = 'composeman';
        }
        return $manager === '' ? false : $manager;
    }

    function serverRegexMatches(string $pattern, string $input): bool {
        if (trim($pattern) === '') {
            return false;
        }
        $regex = '/' . str_replace('/', '\/', $pattern) . '/';
        return @preg_match($regex, $input) === 1;
    }

    function dockerInfoLabelsForName(array $infoByName, string $name): array {
        $item = $infoByName[$name] ?? null;
        if (!is_array($item)) {
            return [];
        }
        if (isset($item['Labels']) && is_array($item['Labels'])) {
            return $item['Labels'];
        }
        if (isset($item['info']['Config']['Labels']) && is_array($item['info']['Config']['Labels'])) {
            return $item['info']['Config']['Labels'];
        }
        return [];
    }

    function dockerInfoImageForName(array $infoByName, string $name): string {
        $item = $infoByName[$name] ?? null;
        if (!is_array($item)) {
            return '';
        }
        if (isset($item['info']['Config']['Image'])) {
            return (string)$item['info']['Config']['Image'];
        }
        if (isset($item['Image'])) {
            return (string)$item['Image'];
        }
        return '';
    }

    function dockerInfoComposeProjectForName(array $infoByName, string $name): string {
        $labels = dockerInfoLabelsForName($infoByName, $name);
        return getComposeProjectValueFromLabels($labels);
    }

    function autoRuleMatchesItem(array $rule, string $name, array $infoByName, string $type): bool {
        $kind = (string)($rule['kind'] ?? 'name_regex');
        if ($kind === 'name_regex') {
            return serverRegexMatches((string)($rule['pattern'] ?? ''), $name);
        }
        if ($type !== 'docker') {
            return false;
        }
        if ($kind === 'label') {
            $labelKey = (string)($rule['labelKey'] ?? '');
            if ($labelKey === '') {
                return false;
            }
            $labels = dockerInfoLabelsForName($infoByName, $name);
            if (!array_key_exists($labelKey, $labels)) {
                return false;
            }
            $expected = (string)($rule['labelValue'] ?? '');
            return $expected === '' || (string)$labels[$labelKey] === $expected;
        }
        if ($kind === 'label_contains') {
            $labelKey = (string)($rule['labelKey'] ?? '');
            $expected = strtolower((string)($rule['labelValue'] ?? ''));
            if ($labelKey === '' || $expected === '') {
                return false;
            }
            $labels = dockerInfoLabelsForName($infoByName, $name);
            if (!array_key_exists($labelKey, $labels)) {
                return false;
            }
            return strpos(strtolower((string)$labels[$labelKey]), $expected) !== false;
        }
        if ($kind === 'label_starts_with') {
            $labelKey = (string)($rule['labelKey'] ?? '');
            $expected = strtolower((string)($rule['labelValue'] ?? ''));
            if ($labelKey === '' || $expected === '') {
                return false;
            }
            $labels = dockerInfoLabelsForName($infoByName, $name);
            if (!array_key_exists($labelKey, $labels)) {
                return false;
            }
            return strpos(strtolower((string)$labels[$labelKey]), $expected) === 0;
        }
        if ($kind === 'image_regex') {
            return serverRegexMatches((string)($rule['pattern'] ?? ''), dockerInfoImageForName($infoByName, $name));
        }
        if ($kind === 'compose_project_regex') {
            return serverRegexMatches((string)($rule['pattern'] ?? ''), dockerInfoComposeProjectForName($infoByName, $name));
        }
        return false;
    }

    function autoRuleDecision(array $rules, string $name, array $infoByName, string $type): array {
        $firstIncludeRule = null;
        foreach ($rules as $rule) {
            if (!is_array($rule) || normalizeBool($rule['enabled'] ?? true, true) !== true) {
                continue;
            }
            if (!autoRuleMatchesItem($rule, $name, $infoByName, $type)) {
                continue;
            }
            $effect = (string)($rule['effect'] ?? 'include');
            if ($effect === 'exclude') {
                return [
                    'assignedRule' => null,
                    'blockedBy' => $rule
                ];
            }
            if ($firstIncludeRule === null) {
                $firstIncludeRule = $rule;
            }
        }
        if ($firstIncludeRule !== null) {
            return [
                'assignedRule' => $firstIncludeRule,
                'blockedBy' => null
            ];
        }
        return [
            'assignedRule' => null,
            'blockedBy' => null
        ];
    }

    function bulkAssignItemsToFolder(string $type, string $folderId, array $items): array {
        $type = ensureType($type);
        $folderId = trim($folderId);
        if ($folderId === '') {
            throw new RuntimeException('Folder ID is required.');
        }

        $folders = readRawFolderMap($type);
        if (!array_key_exists($folderId, $folders)) {
            throw new RuntimeException('Target folder not found.');
        }

        $validNames = array_keys(readInfo($type));
        $validSet = array_fill_keys($validNames, true);
        $requested = [];
        foreach ($items as $item) {
            $name = trim((string)$item);
            if ($name === '' || isset($requested[$name]) || !isset($validSet[$name])) {
                continue;
            }
            $requested[$name] = true;
        }
        $itemNames = array_keys($requested);
        if (empty($itemNames)) {
            return [
                'type' => $type,
                'folderId' => $folderId,
                'assigned' => [],
                'removedFrom' => [],
                'count' => 0
            ];
        }

        $removedFrom = [];
        foreach ($folders as $id => &$folder) {
            $members = normalizeFolderMembers($folder['containers'] ?? []);
            $nextMembers = [];
            foreach ($members as $member) {
                if (in_array($member, $itemNames, true)) {
                    if (!isset($removedFrom[$member])) {
                        $removedFrom[$member] = [];
                    }
                    $removedFrom[$member][] = $id;
                    continue;
                }
                $nextMembers[] = $member;
            }
            $folder['containers'] = $nextMembers;
        }
        unset($folder);

        $targetMembers = normalizeFolderMembers($folders[$folderId]['containers'] ?? []);
        foreach ($itemNames as $name) {
            if (!in_array($name, $targetMembers, true)) {
                $targetMembers[] = $name;
            }
        }
        $folders[$folderId]['containers'] = $targetMembers;

        writeRawFolderMap($type, $folders);
        syncManualOrderWithFolders($type, $folders);
        if ($type === 'docker') {
            syncContainerOrder('docker');
        }

        return [
            'type' => $type,
            'folderId' => $folderId,
            'assigned' => $itemNames,
            'removedFrom' => $removedFrom,
            'count' => count($itemNames)
        ];
    }

    function normalizeDiagnosticsPrivacyMode(string $mode): string {
        return strtolower(trim($mode)) === 'full' ? 'full' : FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY;
    }

    function diagnosticsHistoryPath(): string {
        global $configDir;
        return "$configDir/diagnostics.history.json";
    }

    function diagnosticsNormalizeEventDetails($value, int $depth = 0) {
        if ($depth > 4) {
            return null;
        }
        if (is_array($value)) {
            $normalized = [];
            $count = 0;
            foreach ($value as $key => $item) {
                if ($count >= 50) {
                    break;
                }
                $normalized[(string)$key] = diagnosticsNormalizeEventDetails($item, $depth + 1);
                $count++;
            }
            return $normalized;
        }
        if (is_string($value)) {
            return substr($value, 0, 256);
        }
        if (is_bool($value) || is_int($value) || is_float($value) || is_null($value)) {
            return $value;
        }
        return (string)$value;
    }

    function readDiagnosticsHistoryEvents(int $limit = 50): array {
        $path = diagnosticsHistoryPath();
        if (!file_exists($path)) {
            return [];
        }
        $decoded = @json_decode((string)@file_get_contents($path), true);
        if (!is_array($decoded)) {
            return [];
        }
        $events = array_values(array_filter($decoded, function($row) {
            return is_array($row) && !empty($row['timestamp']) && !empty($row['action']);
        }));
        usort($events, function($a, $b) {
            return strcmp((string)($b['timestamp'] ?? ''), (string)($a['timestamp'] ?? ''));
        });
        return array_slice($events, 0, max(1, $limit));
    }

    function buildDiagnosticsTimeline(array $events, int $limit = 25): array {
        $rows = [];
        $max = max(1, $limit);
        $count = 0;
        foreach ($events as $event) {
            if (!is_array($event) || $count >= $max) {
                continue;
            }
            $details = is_array($event['details'] ?? null) ? $event['details'] : [];
            $summaryParts = [];
            foreach (['reason', 'name', 'folderId', 'folderCount', 'itemCount'] as $key) {
                if (array_key_exists($key, $details) && $details[$key] !== null && $details[$key] !== '') {
                    $summaryParts[] = $key . '=' . (is_scalar($details[$key]) ? (string)$details[$key] : json_encode($details[$key]));
                }
            }
            $rows[] = [
                'timestamp' => (string)($event['timestamp'] ?? ''),
                'action' => (string)($event['action'] ?? ''),
                'type' => $event['type'] ?? null,
                'status' => (string)($event['status'] ?? 'ok'),
                'summary' => implode(', ', $summaryParts)
            ];
            $count++;
        }
        return $rows;
    }

    function appendDiagnosticsHistoryEvent(string $action, ?string $type = null, array $details = [], string $status = 'ok', string $source = 'server'): array {
        $action = trim($action);
        if ($action === '') {
            throw new RuntimeException('Diagnostics event action is required.');
        }

        global $configDir;
        if (!is_dir($configDir)) {
            @mkdir($configDir, 0770, true);
        }

        $path = diagnosticsHistoryPath();
        $decoded = @json_decode((string)@file_get_contents($path), true);
        $events = is_array($decoded) ? $decoded : [];

        $event = [
            'id' => generateId(16),
            'timestamp' => gmdate('c'),
            'action' => $action,
            'type' => $type ? ensureType($type) : null,
            'status' => trim($status) === '' ? 'ok' : substr(trim($status), 0, 32),
            'source' => trim($source) === '' ? 'server' : substr(trim($source), 0, 64),
            'details' => diagnosticsNormalizeEventDetails($details)
        ];

        $events[] = $event;
        if (count($events) > FVPLUS_DIAGNOSTICS_HISTORY_MAX) {
            $events = array_slice($events, -FVPLUS_DIAGNOSTICS_HISTORY_MAX);
        }
        @file_put_contents($path, json_encode(array_values($events), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
        return $event;
    }

    function diagnosticsHashShort(string $value): string {
        return substr(hash('sha256', $value), 0, 12);
    }

    function diagnosticsMaskIp(string $ip): string {
        $ip = trim($ip);
        if ($ip === '') {
            return '';
        }
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            $parts = explode('.', $ip);
            if (count($parts) === 4) {
                return $parts[0] . '.' . $parts[1] . '.x.x';
            }
        }
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
            $parts = explode(':', $ip);
            $head = implode(':', array_slice($parts, 0, 2));
            return $head . '::';
        }
        return '[redacted]';
    }

    function readUnraidVersionString(): ?string {
        $candidates = [
            '/etc/unraid-version',
            '/etc/unraid-version.txt',
            '/etc/version'
        ];
        foreach ($candidates as $path) {
            if (!file_exists($path)) {
                continue;
            }
            $raw = trim((string)@file_get_contents($path));
            if ($raw === '') {
                continue;
            }
            $lines = preg_split('/\R+/', $raw) ?: [];
            foreach ($lines as $line) {
                $line = trim((string)$line);
                if ($line === '') {
                    continue;
                }
                if (preg_match('/([0-9]+\.[0-9]+(?:\.[0-9]+)?(?:[-._a-zA-Z0-9]+)?)/', $line, $match)) {
                    return (string)$match[1];
                }
                return $line;
            }
        }
        return null;
    }

    function getEnvironmentSnapshot(string $privacyMode): array {
        $mode = normalizeDiagnosticsPrivacyMode($privacyMode);
        $userAgent = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
        $clientIp = (string)($_SERVER['REMOTE_ADDR'] ?? '');
        return [
            'capturedAt' => gmdate('c'),
            'timezone' => @date_default_timezone_get(),
            'phpVersion' => PHP_VERSION,
            'serverSoftware' => (string)($_SERVER['SERVER_SOFTWARE'] ?? ''),
            'os' => php_uname('s') . ' ' . php_uname('r'),
            'unraidVersion' => readUnraidVersionString(),
            'request' => [
                'privacyMode' => $mode,
                'userAgent' => $mode === 'full' ? $userAgent : null,
                'userAgentHash' => $userAgent !== '' ? diagnosticsHashShort($userAgent) : null,
                'clientIp' => $mode === 'full' ? $clientIp : diagnosticsMaskIp($clientIp),
                'clientIpHash' => $clientIp !== '' ? diagnosticsHashShort($clientIp) : null
            ]
        ];
    }

    function diagnosticsFileHashSnapshot(string $path, string $privacyMode): array {
        $exists = file_exists($path);
        $mode = normalizeDiagnosticsPrivacyMode($privacyMode);
        $label = basename($path);
        return [
            'file' => $label,
            'path' => $mode === 'full' ? $path : $label,
            'exists' => $exists,
            'size' => $exists ? (int)@filesize($path) : 0,
            'modifiedAt' => $exists ? gmdate('c', (int)@filemtime($path)) : null,
            'sha256' => $exists ? @hash_file('sha256', $path) : null
        ];
    }

    function getDiagnosticsKeyFileHashes(string $privacyMode): array {
        return [
            'dockerFolders' => diagnosticsFileHashSnapshot(getFolderFilePath('docker'), $privacyMode),
            'vmFolders' => diagnosticsFileHashSnapshot(getFolderFilePath('vm'), $privacyMode),
            'dockerPrefs' => diagnosticsFileHashSnapshot(getTypePrefsPath('docker'), $privacyMode),
            'vmPrefs' => diagnosticsFileHashSnapshot(getTypePrefsPath('vm'), $privacyMode)
        ];
    }

    function diagnosticsNormalizeStatusColor($value, string $fallback): string {
        $value = is_string($value) ? trim($value) : '';
        if (!preg_match('/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/', $value)) {
            return $fallback;
        }
        if (strlen($value) === 4) {
            return '#' . strtolower($value[1] . $value[1] . $value[2] . $value[2] . $value[3] . $value[3]);
        }
        return strtolower($value);
    }

    function diagnosticsFolderStatusColors(array $folder): array {
        $settings = is_array($folder['settings'] ?? null) ? $folder['settings'] : [];
        return [
            'started' => diagnosticsNormalizeStatusColor($settings['status_color_started'] ?? null, FVPLUS_DEFAULT_FOLDER_STATUS_COLORS['started']),
            'paused' => diagnosticsNormalizeStatusColor($settings['status_color_paused'] ?? null, FVPLUS_DEFAULT_FOLDER_STATUS_COLORS['paused']),
            'stopped' => diagnosticsNormalizeStatusColor($settings['status_color_stopped'] ?? null, FVPLUS_DEFAULT_FOLDER_STATUS_COLORS['stopped'])
        ];
    }

    function diagnosticsBuildRegex(string $pattern): string {
        return '/' . str_replace('/', '\/', $pattern) . '/';
    }

    function diagnosticsRegexIsValid(string $pattern): bool {
        if (trim($pattern) === '') {
            return true;
        }
        return @preg_match(diagnosticsBuildRegex($pattern), '') !== false;
    }

    function diagnosticsRegexMatches(string $pattern, string $subject): bool {
        if (trim($pattern) === '') {
            return false;
        }
        if (!diagnosticsRegexIsValid($pattern)) {
            return false;
        }
        return @preg_match(diagnosticsBuildRegex($pattern), $subject) === 1;
    }

    function diagnosticsDockerLabelsForItem($item): array {
        if (!is_array($item)) {
            return [];
        }
        if (isset($item['Labels']) && is_array($item['Labels'])) {
            return $item['Labels'];
        }
        if (isset($item['info']['Config']['Labels']) && is_array($item['info']['Config']['Labels'])) {
            return $item['info']['Config']['Labels'];
        }
        return [];
    }

    function diagnosticsAutoRuleMatches(array $rule, string $name, array $infoByName, string $type): bool {
        return autoRuleMatchesItem($rule, $name, $infoByName, $type);
    }

    function diagnosticsFirstMatchingRule(array $rules, string $name, array $infoByName, string $type): ?array {
        $decision = autoRuleDecision($rules, $name, $infoByName, $type);
        return is_array($decision['assignedRule'] ?? null) ? $decision['assignedRule'] : null;
    }

    function diagnosticsFormatNames(array $names, string $privacyMode): array {
        $names = array_values(array_unique(array_map('strval', $names)));
        if (normalizeDiagnosticsPrivacyMode($privacyMode) === 'full') {
            return array_slice($names, 0, 30);
        }
        return array_slice(array_map('diagnosticsHashShort', $names), 0, 30);
    }

    function diagnosticsPathDescriptor(string $path, string $privacyMode): array {
        $exists = file_exists($path);
        return [
            'path' => normalizeDiagnosticsPrivacyMode($privacyMode) === 'full' ? $path : basename($path),
            'exists' => $exists,
            'isDir' => $exists ? is_dir($path) : false,
            'isFile' => $exists ? is_file($path) : false,
            'readable' => $exists ? is_readable($path) : false,
            'writable' => $exists ? is_writable($path) : false
        ];
    }

    function diagnosticsCustomIconExtensions(): array {
        return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'];
    }

    function diagnosticsCustomIconNameFromIconValue(string $value): string {
        $path = trim($value);
        if ($path === '') {
            return '';
        }
        $hashPos = strpos($path, '#');
        if ($hashPos !== false) {
            $path = substr($path, 0, $hashPos);
        }
        $queryPos = strpos($path, '?');
        if ($queryPos !== false) {
            $path = substr($path, 0, $queryPos);
        }
        $decoded = @rawurldecode($path);
        if (is_string($decoded) && $decoded !== '') {
            $path = $decoded;
        }
        $path = preg_replace('#^https?://[^/]+#i', '', $path);
        $path = str_replace('\\', '/', trim((string)$path));
        if ($path === '') {
            return '';
        }

        $prefixes = [
            '/plugins/folderview.plus/images/custom/',
            '/usr/local/emhttp/plugins/folderview.plus/images/custom/',
            'plugins/folderview.plus/images/custom/',
            'usr/local/emhttp/plugins/folderview.plus/images/custom/'
        ];
        $candidate = '';
        foreach ($prefixes as $prefix) {
            if (strpos($path, $prefix) === 0) {
                $candidate = basename(substr($path, strlen($prefix)));
                break;
            }
        }
        if ($candidate === '') {
            return '';
        }
        $safe = basename(trim($candidate));
        if ($safe === '' || $safe !== $candidate) {
            return '';
        }
        $extension = strtolower((string)pathinfo($safe, PATHINFO_EXTENSION));
        if ($extension === '' || !in_array($extension, diagnosticsCustomIconExtensions(), true)) {
            return '';
        }
        return $safe;
    }

    function diagnosticsBuildCustomIconUsageMap(): array {
        $usage = [];
        foreach (['docker', 'vm'] as $type) {
            $folders = readRawFolderMap($type);
            foreach ($folders as $folderId => $folder) {
                if (!is_array($folder)) {
                    continue;
                }
                $name = diagnosticsCustomIconNameFromIconValue((string)($folder['icon'] ?? ''));
                if ($name === '') {
                    continue;
                }
                if (!isset($usage[$name]) || !is_array($usage[$name])) {
                    $usage[$name] = [];
                }
                $usage[$name][] = [
                    'type' => $type,
                    'folderId' => (string)$folderId,
                    'folderName' => trim((string)($folder['name'] ?? (string)$folderId))
                ];
            }
        }
        return $usage;
    }

    function diagnosticsBuildCustomIconStorage(string $privacyMode): array {
        global $sourceDir;
        $privacyMode = normalizeDiagnosticsPrivacyMode($privacyMode);
        $directory = "$sourceDir/images/custom";
        $descriptor = diagnosticsPathDescriptor($directory, $privacyMode);
        $extensions = diagnosticsCustomIconExtensions();
        $usageMap = diagnosticsBuildCustomIconUsageMap();
        $fileCount = 0;
        $totalBytes = 0;
        $inUseIconCount = 0;
        $orphanedIconCount = 0;
        $referenceCount = 0;
        $topReferences = [];

        if (is_dir($directory)) {
            foreach ((array)@scandir($directory) as $name) {
                if ($name === '.' || $name === '..' || $name !== basename($name)) {
                    continue;
                }
                $path = "$directory/$name";
                if (!is_file($path)) {
                    continue;
                }
                $extension = strtolower((string)pathinfo($name, PATHINFO_EXTENSION));
                if ($extension === '' || !in_array($extension, $extensions, true)) {
                    continue;
                }
                $fileCount++;
                $totalBytes += max(0, (int)@filesize($path));
                $refs = is_array($usageMap[$name] ?? null) ? $usageMap[$name] : [];
                $refCount = count($refs);
                if ($refCount > 0) {
                    $inUseIconCount++;
                    $referenceCount += $refCount;
                    $topReferences[] = [
                        'name' => $privacyMode === 'full' ? $name : diagnosticsHashShort($name),
                        'referenceCount' => $refCount
                    ];
                } else {
                    $orphanedIconCount++;
                }
            }
        }

        usort($topReferences, static function (array $a, array $b): int {
            $cmp = ((int)($b['referenceCount'] ?? 0)) <=> ((int)($a['referenceCount'] ?? 0));
            if ($cmp !== 0) {
                return $cmp;
            }
            return strcmp((string)($a['name'] ?? ''), (string)($b['name'] ?? ''));
        });

        $issues = [];
        if ($descriptor['exists'] !== true) {
            $issues[] = 'Custom icon directory is missing.';
        } elseif ($descriptor['isDir'] !== true) {
            $issues[] = 'Custom icon path is not a directory.';
        }
        if ($descriptor['exists'] === true && $descriptor['writable'] !== true) {
            $issues[] = 'Custom icon directory is not writable.';
        }

        $repairHint = 'mkdir -p ' . escapeshellarg($directory) . ' && chmod -R 775 ' . escapeshellarg($directory);
        return [
            'path' => $descriptor,
            'fileCount' => $fileCount,
            'totalBytes' => $totalBytes,
            'inUseIconCount' => $inUseIconCount,
            'orphanedIconCount' => $orphanedIconCount,
            'referenceCount' => $referenceCount,
            'topReferences' => array_slice($topReferences, 0, 15),
            'issues' => $issues,
            'repairHint' => $repairHint
        ];
    }

    function diagnosticsBuildPathHealth(string $type, string $privacyMode): array {
        global $configDir, $sourceDir;
        $folderPath = getFolderFilePath($type);
        $prefsPath = getTypePrefsPath($type);
        $backupDir = getBackupsDirPath();
        $issues = [];

        $configDesc = diagnosticsPathDescriptor($configDir, $privacyMode);
        $sourceDesc = diagnosticsPathDescriptor($sourceDir, $privacyMode);
        $folderDesc = diagnosticsPathDescriptor($folderPath, $privacyMode);
        $prefsDesc = diagnosticsPathDescriptor($prefsPath, $privacyMode);
        $backupDesc = diagnosticsPathDescriptor($backupDir, $privacyMode);

        if ($configDesc['exists'] !== true || $configDesc['isDir'] !== true) {
            $issues[] = 'Config directory is missing.';
        } elseif ($configDesc['writable'] !== true) {
            $issues[] = 'Config directory is not writable.';
        }
        if ($sourceDesc['exists'] !== true || $sourceDesc['isDir'] !== true) {
            $issues[] = 'Plugin source directory is missing.';
        }
        if ($folderDesc['exists'] === true && $folderDesc['isFile'] !== true) {
            $issues[] = 'Folder map path is not a file.';
        }
        if ($folderDesc['exists'] === true && $folderDesc['writable'] !== true) {
            $issues[] = 'Folder map file is not writable.';
        }
        if ($prefsDesc['exists'] === true && $prefsDesc['isFile'] !== true) {
            $issues[] = 'Preferences path is not a file.';
        }
        if ($prefsDesc['exists'] === true && $prefsDesc['writable'] !== true) {
            $issues[] = 'Preferences file is not writable.';
        }
        if ($backupDesc['exists'] === true && $backupDesc['isDir'] !== true) {
            $issues[] = 'Backups path is not a directory.';
        }
        if ($backupDesc['exists'] === true && $backupDesc['writable'] !== true) {
            $issues[] = 'Backups directory is not writable.';
        }

        $legacyRemnants = [];
        foreach (FVPLUS_LEGACY_CONFIG_DIRS as $legacyDir) {
            if (!is_dir($legacyDir)) {
                continue;
            }
            $legacyRemnants[] = [
                'path' => normalizeDiagnosticsPrivacyMode($privacyMode) === 'full' ? $legacyDir : basename($legacyDir),
                'dockerExists' => file_exists("$legacyDir/docker.json"),
                'vmExists' => file_exists("$legacyDir/vm.json"),
                'prefsDockerExists' => file_exists("$legacyDir/docker.prefs.json"),
                'prefsVmExists' => file_exists("$legacyDir/vm.prefs.json")
            ];
        }

        return [
            'ok' => count($issues) === 0,
            'issues' => $issues,
            'paths' => [
                'configDir' => $configDesc,
                'sourceDir' => $sourceDesc,
                'folderFile' => $folderDesc,
                'prefsFile' => $prefsDesc,
                'backupDir' => $backupDesc
            ],
            'legacyRemnants' => $legacyRemnants
        ];
    }

    function diagnosticsBuildIntegrityChecks(string $type, array $folders, array $prefs, array $infoByName, string $privacyMode): array {
        $validNames = array_keys($infoByName);
        $validSet = array_fill_keys($validNames, true);
        $nameBuckets = [];
        $invalidRegexFolders = [];
        $invalidIconFolders = [];
        $orphanedMembers = [];
        $explicitAssignments = [];
        $regexAssignments = [];
        $effectiveAssignments = [];

        foreach ($folders as $folderId => $folder) {
            $folderName = trim((string)($folder['name'] ?? $folderId));
            $bucketKey = strtolower($folderName);
            if (!isset($nameBuckets[$bucketKey])) {
                $nameBuckets[$bucketKey] = ['name' => $folderName, 'folderIds' => []];
            }
            $nameBuckets[$bucketKey]['folderIds'][] = (string)$folderId;

            $members = normalizeFolderMembers($folder['containers'] ?? []);
            foreach ($members as $member) {
                $explicitAssignments[$member][] = (string)$folderId;
                $effectiveAssignments[$member][] = (string)$folderId;
                if (!isset($validSet[$member])) {
                    if (!isset($orphanedMembers[$folderId])) {
                        $orphanedMembers[$folderId] = [];
                    }
                    $orphanedMembers[$folderId][] = $member;
                }
            }

            $regex = (string)($folder['regex'] ?? '');
            if ($regex !== '') {
                if (!diagnosticsRegexIsValid($regex)) {
                    $invalidRegexFolders[] = (string)$folderId;
                } else {
                    foreach ($validNames as $name) {
                        if (diagnosticsRegexMatches($regex, $name)) {
                            $regexAssignments[$name][] = (string)$folderId;
                            if (!in_array((string)$folderId, $effectiveAssignments[$name] ?? [], true)) {
                                $effectiveAssignments[$name][] = (string)$folderId;
                            }
                        }
                    }
                }
            }

            $icon = trim((string)($folder['icon'] ?? ''));
            if ($icon !== '') {
                $isLocalPath = strpos($icon, '/') === 0;
                $isHttpUrl = stripos($icon, 'http://') === 0 || stripos($icon, 'https://') === 0;
                $isDataUri = stripos($icon, 'data:image/') === 0;
                if (!$isLocalPath && !$isHttpUrl && !$isDataUri) {
                    $invalidIconFolders[] = (string)$folderId;
                }
            }

            if ($type === 'docker') {
                $folderName = trim((string)($folder['name'] ?? ''));
                if ($folderName !== '') {
                    foreach ($validNames as $name) {
                        $labelValue = getFolderLabelValueFromLabels(dockerInfoLabelsForName($infoByName, $name));
                        if ($labelValue === '' || $labelValue !== $folderName) {
                            continue;
                        }
                        if (!in_array((string)$folderId, $effectiveAssignments[$name] ?? [], true)) {
                            $effectiveAssignments[$name][] = (string)$folderId;
                        }
                    }
                }
            }
        }

        $rules = is_array($prefs['autoRules'] ?? null) ? $prefs['autoRules'] : [];
        $invalidRules = [];
        foreach ($rules as $idx => $rule) {
            if (!is_array($rule)) {
                $invalidRules[] = ['index' => $idx, 'reason' => 'Rule entry is not an object.'];
                continue;
            }
            $folderId = (string)($rule['folderId'] ?? '');
            $kind = (string)($rule['kind'] ?? 'name_regex');
            $effect = (string)($rule['effect'] ?? 'include');
            if ($folderId === '' || !array_key_exists($folderId, $folders)) {
                $invalidRules[] = ['index' => $idx, 'id' => (string)($rule['id'] ?? ''), 'reason' => 'Rule folder target is missing or invalid.'];
            }
            if (!in_array($effect, FVPLUS_RULE_EFFECTS, true)) {
                $invalidRules[] = ['index' => $idx, 'id' => (string)($rule['id'] ?? ''), 'reason' => 'Rule effect is invalid.'];
            }
            if (!in_array($kind, FVPLUS_RULE_KINDS, true)) {
                $invalidRules[] = ['index' => $idx, 'id' => (string)($rule['id'] ?? ''), 'reason' => 'Rule kind is invalid.'];
                continue;
            }
            if (in_array($kind, ['name_regex', 'image_regex', 'compose_project_regex'], true)) {
                $pattern = (string)($rule['pattern'] ?? '');
                if ($pattern === '') {
                    $invalidRules[] = ['index' => $idx, 'id' => (string)($rule['id'] ?? ''), 'reason' => 'Regex-based rule pattern is empty.'];
                } elseif (!diagnosticsRegexIsValid($pattern)) {
                    $invalidRules[] = ['index' => $idx, 'id' => (string)($rule['id'] ?? ''), 'reason' => 'Regex-based rule pattern is invalid.'];
                }
            }
            if (in_array($kind, ['label', 'label_contains', 'label_starts_with'], true)) {
                if ($type !== 'docker') {
                    $invalidRules[] = ['index' => $idx, 'id' => (string)($rule['id'] ?? ''), 'reason' => 'Label rules are only valid for docker.'];
                }
                $labelKey = (string)($rule['labelKey'] ?? '');
                if ($labelKey === '') {
                    $invalidRules[] = ['index' => $idx, 'id' => (string)($rule['id'] ?? ''), 'reason' => 'Label rule key is empty.'];
                }
                if (in_array($kind, ['label_contains', 'label_starts_with'], true) && trim((string)($rule['labelValue'] ?? '')) === '') {
                    $invalidRules[] = ['index' => $idx, 'id' => (string)($rule['id'] ?? ''), 'reason' => 'Label contains/starts-with rule value is empty.'];
                }
            }
        }

        foreach ($validNames as $name) {
            $rule = diagnosticsFirstMatchingRule($rules, $name, $infoByName, $type);
            if (!$rule) {
                continue;
            }
            $folderId = (string)($rule['folderId'] ?? '');
            if ($folderId !== '' && array_key_exists($folderId, $folders)) {
                if (!in_array($folderId, $effectiveAssignments[$name] ?? [], true)) {
                    $effectiveAssignments[$name][] = $folderId;
                }
            }
        }

        $duplicateNames = [];
        foreach ($nameBuckets as $bucket) {
            $ids = array_values(array_unique(array_map('strval', $bucket['folderIds'] ?? [])));
            if (count($ids) > 1) {
                $duplicateNames[] = [
                    'name' => normalizeDiagnosticsPrivacyMode($privacyMode) === 'full' ? (string)($bucket['name'] ?? '') : null,
                    'nameHash' => diagnosticsHashShort((string)($bucket['name'] ?? '')),
                    'folderIds' => $ids
                ];
            }
        }

        $buildConflicts = function(array $assignmentMap) use ($privacyMode): array {
            $examples = [];
            $count = 0;
            foreach ($assignmentMap as $name => $folderIds) {
                $ids = array_values(array_unique(array_map('strval', $folderIds)));
                if (count($ids) <= 1) {
                    continue;
                }
                $count++;
                if (count($examples) < 30) {
                    $examples[] = [
                        'item' => normalizeDiagnosticsPrivacyMode($privacyMode) === 'full' ? (string)$name : null,
                        'itemHash' => diagnosticsHashShort((string)$name),
                        'folderIds' => $ids,
                        'folderCount' => count($ids)
                    ];
                }
            }
            return ['count' => $count, 'examples' => $examples];
        };

        $missingManualOrderIds = [];
        foreach (($prefs['manualOrder'] ?? []) as $manualId) {
            $manualId = (string)$manualId;
            if ($manualId !== '' && !array_key_exists($manualId, $folders)) {
                $missingManualOrderIds[] = $manualId;
            }
        }
        $missingPinnedFolderIds = [];
        foreach (($prefs['pinnedFolderIds'] ?? []) as $pinnedId) {
            $pinnedId = (string)$pinnedId;
            if ($pinnedId !== '' && !array_key_exists($pinnedId, $folders)) {
                $missingPinnedFolderIds[] = $pinnedId;
            }
        }

        $pathHealth = diagnosticsBuildPathHealth($type, $privacyMode);
        $pathIssueCount = count($pathHealth['issues'] ?? []);

        $orphanedCount = 0;
        $orphanedByFolder = [];
        foreach ($orphanedMembers as $folderId => $members) {
            $members = array_values(array_unique(array_map('strval', $members)));
            $orphanedCount += count($members);
            $orphanedByFolder[] = [
                'folderId' => (string)$folderId,
                'count' => count($members),
                'items' => diagnosticsFormatNames($members, $privacyMode)
            ];
        }

        $issuesCount = count($duplicateNames)
            + count($invalidRegexFolders)
            + count($invalidIconFolders)
            + count($invalidRules)
            + count($missingManualOrderIds)
            + count($missingPinnedFolderIds)
            + $orphanedCount
            + $buildConflicts($effectiveAssignments)['count']
            + $pathIssueCount;

        return [
            'ok' => $issuesCount === 0,
            'issuesCount' => $issuesCount,
            'duplicateFolderNames' => [
                'count' => count($duplicateNames),
                'examples' => array_slice($duplicateNames, 0, 30)
            ],
            'orphanedMembers' => [
                'count' => $orphanedCount,
                'folders' => $orphanedByFolder
            ],
            'invalidFolderRegex' => [
                'count' => count($invalidRegexFolders),
                'folderIds' => array_values(array_unique($invalidRegexFolders))
            ],
            'invalidFolderIconPaths' => [
                'count' => count($invalidIconFolders),
                'folderIds' => array_values(array_unique($invalidIconFolders))
            ],
            'invalidAutoRules' => [
                'count' => count($invalidRules),
                'rules' => array_slice($invalidRules, 0, 40)
            ],
            'missingManualOrderIds' => [
                'count' => count($missingManualOrderIds),
                'ids' => array_values(array_unique($missingManualOrderIds))
            ],
            'missingPinnedFolderIds' => [
                'count' => count($missingPinnedFolderIds),
                'ids' => array_values(array_unique($missingPinnedFolderIds))
            ],
            'duplicateAssignments' => [
                'explicit' => $buildConflicts($explicitAssignments),
                'regex' => $buildConflicts($regexAssignments),
                'effective' => $buildConflicts($effectiveAssignments)
            ],
            'pathHealth' => $pathHealth
        ];
    }

    function diagnosticsStateKindForDockerItem(array $item): string {
        $state = is_array($item['info']['State'] ?? null) ? $item['info']['State'] : [];
        $running = (bool)($state['Running'] ?? false);
        $paused = (bool)($state['Paused'] ?? false);
        if ($running && !$paused) {
            return 'started';
        }
        if ($running && $paused) {
            return 'paused';
        }
        return 'stopped';
    }

    function diagnosticsStateKindForVmItem(array $item): string {
        $state = strtolower(trim((string)($item['state'] ?? '')));
        if ($state === 'running') {
            return 'started';
        }
        if (in_array($state, ['paused', 'pmsuspended', 'unknown'], true)) {
            return 'paused';
        }
        return 'stopped';
    }

    function diagnosticsBuildStateSnapshot(string $type, array $folders, array $prefs, array $infoByName, string $privacyMode): array {
        $validNames = array_keys($infoByName);
        $rules = is_array($prefs['autoRules'] ?? null) ? $prefs['autoRules'] : [];
        $ruleTargetByName = [];
        foreach ($validNames as $name) {
            $rule = diagnosticsFirstMatchingRule($rules, $name, $infoByName, $type);
            $ruleTargetByName[$name] = $rule ? (string)($rule['folderId'] ?? '') : '';
        }

        $badges = is_array($prefs['badges'] ?? null) ? $prefs['badges'] : [];
        $showRunningBadge = !array_key_exists('running', $badges) ? true : (bool)$badges['running'];
        $showStoppedBadge = array_key_exists('stopped', $badges) && (bool)$badges['stopped'];
        $showUpdateBadge = !array_key_exists('updates', $badges) ? true : (bool)$badges['updates'];

        $snapshotFolders = [];
        $folderStatusTotals = ['running' => 0, 'paused' => 0, 'stopped' => 0];
        $memberTotals = ['started' => 0, 'paused' => 0, 'stopped' => 0, 'total' => 0];

        foreach ($folders as $folderId => $folder) {
            $members = normalizeFolderMembers($folder['containers'] ?? []);
            $regex = (string)($folder['regex'] ?? '');
            if ($regex !== '' && diagnosticsRegexIsValid($regex)) {
                foreach ($validNames as $name) {
                    if (diagnosticsRegexMatches($regex, $name) && !in_array($name, $members, true)) {
                        $members[] = $name;
                    }
                }
            }
            if ($type === 'docker') {
                $folderName = trim((string)($folder['name'] ?? ''));
                if ($folderName !== '') {
                    foreach ($validNames as $name) {
                        $labelValue = getFolderLabelValueFromLabels(dockerInfoLabelsForName($infoByName, $name));
                        if ($labelValue !== '' && $labelValue === $folderName && !in_array($name, $members, true)) {
                            $members[] = $name;
                        }
                    }
                }
            }
            foreach ($validNames as $name) {
                if (($ruleTargetByName[$name] ?? '') === (string)$folderId && !in_array($name, $members, true)) {
                    $members[] = $name;
                }
            }

            $started = 0;
            $paused = 0;
            $stopped = 0;
            foreach ($members as $name) {
                $item = $infoByName[$name] ?? null;
                if (!is_array($item)) {
                    continue;
                }
                $kind = $type === 'docker' ? diagnosticsStateKindForDockerItem($item) : diagnosticsStateKindForVmItem($item);
                if ($kind === 'started') {
                    $started++;
                } elseif ($kind === 'paused') {
                    $paused++;
                } else {
                    $stopped++;
                }
            }

            $total = count($members);
            $statusKind = 'stopped';
            $statusCount = $stopped;
            if ($started > 0) {
                $statusKind = 'running';
                $statusCount = $started;
            } elseif ($paused > 0) {
                $statusKind = 'paused';
                $statusCount = $paused;
            }
            $statusText = sprintf('%d/%d %s', $statusCount, $total, $statusKind === 'running' ? 'started' : $statusKind);
            $badgeVisible = true;
            if ($statusKind === 'running') {
                $badgeVisible = $showRunningBadge;
            } elseif ($statusKind === 'stopped') {
                $badgeVisible = $showStoppedBadge;
            }

            $folderStatusTotals[$statusKind]++;
            $memberTotals['started'] += $started;
            $memberTotals['paused'] += $paused;
            $memberTotals['stopped'] += $stopped;
            $memberTotals['total'] += $total;

            $snapshotFolders[$folderId] = [
                'folderId' => (string)$folderId,
                'folderName' => normalizeDiagnosticsPrivacyMode($privacyMode) === 'full' ? (string)($folder['name'] ?? $folderId) : null,
                'folderNameHash' => diagnosticsHashShort((string)($folder['name'] ?? $folderId)),
                'members' => [
                    'total' => $total,
                    'started' => $started,
                    'paused' => $paused,
                    'stopped' => $stopped,
                    'items' => normalizeDiagnosticsPrivacyMode($privacyMode) === 'full' ? array_slice($members, 0, 40) : []
                ],
                'status' => [
                    'kind' => $statusKind,
                    'text' => $statusText,
                    'badgeVisible' => $badgeVisible,
                    'colors' => diagnosticsFolderStatusColors(is_array($folder) ? $folder : [])
                ]
            ];
        }

        return [
            'summary' => [
                'folderTotalsByStatus' => $folderStatusTotals,
                'memberTotals' => $memberTotals,
                'badgePrefs' => [
                    'running' => $showRunningBadge,
                    'stopped' => $showStoppedBadge,
                    'updates' => $showUpdateBadge
                ]
            ],
            'folders' => $snapshotFolders
        ];
    }

    function getDiagnosticsSnapshot(string $privacyMode = FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY): array {
        $privacyMode = normalizeDiagnosticsPrivacyMode($privacyMode);
        $types = ['docker', 'vm'];
        $typesData = [];
        foreach ($types as $type) {
            $folderPath = getFolderFilePath($type);
            $prefsPath = getTypePrefsPath($type);
            $folders = readRawFolderMap($type);
            $prefs = readTypePrefs($type);
            $backups = listBackupSnapshots($type);
            $templates = readFolderTemplates($type);
            $infoByName = readInfo($type);
            $integrityChecks = diagnosticsBuildIntegrityChecks($type, $folders, $prefs, $infoByName, $privacyMode);
            $stateSnapshot = diagnosticsBuildStateSnapshot($type, $folders, $prefs, $infoByName, $privacyMode);
            $typesData[$type] = [
                'folderPath' => $privacyMode === 'full' ? $folderPath : basename($folderPath),
                'prefsPath' => $privacyMode === 'full' ? $prefsPath : basename($prefsPath),
                'foldersExists' => file_exists($folderPath),
                'prefsExists' => file_exists($prefsPath),
                'folderCount' => count($folders),
                'sortMode' => $prefs['sortMode'] ?? 'created',
                'ruleCount' => count($prefs['autoRules'] ?? []),
                'manualOrderCount' => count($prefs['manualOrder'] ?? []),
                'pinnedFolderCount' => count($prefs['pinnedFolderIds'] ?? []),
                'hideEmptyFolders' => normalizeBool($prefs['hideEmptyFolders'] ?? false, false),
                'appColumnWidth' => normalizeAppColumnWidth($prefs['appColumnWidth'] ?? 'standard'),
                'setupWizardCompleted' => normalizeBool($prefs['setupWizardCompleted'] ?? false, false),
                'settingsMode' => (($prefs['settingsMode'] ?? 'basic') === 'advanced') ? 'advanced' : 'basic',
                'runtimePrefsSchema' => normalizeIntInRange($prefs['runtimePrefsSchema'] ?? FVPLUS_RUNTIME_PREFS_SCHEMA, 0, FVPLUS_RUNTIME_PREFS_SCHEMA, FVPLUS_RUNTIME_PREFS_SCHEMA),
                'liveRefreshEnabled' => normalizeBool($prefs['liveRefreshEnabled'] ?? false, false),
                'liveRefreshSeconds' => normalizeIntInRange($prefs['liveRefreshSeconds'] ?? 20, 10, 300, 20),
                'performanceMode' => normalizeBool($prefs['performanceMode'] ?? false, false),
                'lazyPreviewEnabled' => normalizeBool($prefs['lazyPreviewEnabled'] ?? false, false),
                'lazyPreviewThreshold' => normalizeIntInRange($prefs['lazyPreviewThreshold'] ?? 30, 10, 200, 30),
                'health' => [
                    'cardsEnabled' => normalizeBool($prefs['health']['cardsEnabled'] ?? true, true),
                    'runtimeBadgeEnabled' => normalizeBool($prefs['health']['runtimeBadgeEnabled'] ?? false, false),
                    'compact' => normalizeBool($prefs['health']['compact'] ?? false, false),
                    'warnStoppedPercent' => normalizeIntInRange($prefs['health']['warnStoppedPercent'] ?? 60, 0, 100, 60),
                    'criticalStoppedPercent' => normalizeIntInRange($prefs['health']['criticalStoppedPercent'] ?? 90, 0, 100, 90),
                    'profile' => in_array(strtolower(trim((string)($prefs['health']['profile'] ?? 'balanced'))), ['strict', 'balanced', 'lenient'], true)
                        ? strtolower(trim((string)($prefs['health']['profile'] ?? 'balanced')))
                        : 'balanced',
                    'updatesMode' => in_array(strtolower(trim((string)($prefs['health']['updatesMode'] ?? 'maintenance'))), ['maintenance', 'warn', 'ignore'], true)
                        ? strtolower(trim((string)($prefs['health']['updatesMode'] ?? 'maintenance')))
                        : 'maintenance',
                    'allStoppedMode' => in_array(strtolower(trim((string)($prefs['health']['allStoppedMode'] ?? 'critical'))), ['critical', 'warn'], true)
                        ? strtolower(trim((string)($prefs['health']['allStoppedMode'] ?? 'critical')))
                        : 'critical'
                ],
                'status' => [
                    'mode' => in_array(strtolower(trim((string)($prefs['status']['mode'] ?? 'summary'))), ['summary', 'dominant'], true)
                        ? strtolower(trim((string)($prefs['status']['mode'] ?? 'summary')))
                        : 'summary',
                    'displayMode' => in_array(strtolower(trim((string)($prefs['status']['displayMode'] ?? 'balanced'))), ['simple', 'balanced', 'detailed'], true)
                        ? strtolower(trim((string)($prefs['status']['displayMode'] ?? 'balanced')))
                        : 'balanced',
                    'trendEnabled' => normalizeBool($prefs['status']['trendEnabled'] ?? true, true),
                    'attentionAccent' => normalizeBool($prefs['status']['attentionAccent'] ?? true, true),
                    'warnStoppedPercent' => normalizeIntInRange($prefs['status']['warnStoppedPercent'] ?? 60, 0, 100, 60)
                ],
                'backupSchedule' => getTypeBackupSchedule($type),
                'lastBackup' => $backups[0] ?? null,
                'backupCount' => count($backups),
                'templateCount' => count($templates),
                'integrityChecks' => $integrityChecks,
                'stateSnapshot' => $stateSnapshot
            ];
        }

        $historyEvents = readDiagnosticsHistoryEvents(80);
        return [
            'schemaVersion' => FVPLUS_DIAGNOSTICS_SCHEMA_VERSION,
            'privacyMode' => $privacyMode,
            'checkedAt' => gmdate('c'),
            'pluginVersion' => readInstalledVersion(),
            'environment' => getEnvironmentSnapshot($privacyMode),
            'hashes' => getDiagnosticsKeyFileHashes($privacyMode),
            'customIcons' => diagnosticsBuildCustomIconStorage($privacyMode),
            'importExportHistory' => [
                'retained' => count(readDiagnosticsHistoryEvents(FVPLUS_DIAGNOSTICS_HISTORY_MAX)),
                'returned' => count($historyEvents),
                'events' => $historyEvents
            ],
            'recentTimeline' => buildDiagnosticsTimeline($historyEvents, 25),
            'update' => checkRemotePluginUpdate(),
            'types' => $typesData
        ];
    }

    function syncContainerOrder(string $type): void {
        global $configDir;
        fv3_debug_log("syncContainerOrder called for type: $type");

        if ($type !== 'docker') { return; }

        $prefsFile = "/boot/config/plugins/dockerMan/userprefs.cfg";
        if (!file_exists($prefsFile)) { return; }

        $currentPrefs = @parse_ini_file($prefsFile);
        $currentOrder = $currentPrefs ? array_values($currentPrefs) : [];

        $foldersFile = "$configDir/docker.json";
        $folders = file_exists($foldersFile) ? (json_decode(file_get_contents($foldersFile), true) ?: []) : [];

        $dockerClient = new DockerClient();
        $allContainerNames = array_column($dockerClient->getDockerContainers(), 'Name');
        $prefs = readTypePrefs('docker');
        $rules = is_array($prefs['autoRules'] ?? null) ? $prefs['autoRules'] : [];
        $infoByName = readInfo('docker');
        $ruleTargetByName = [];
        $labelTargetByName = [];
        foreach ($allContainerNames as $name) {
            $decision = autoRuleDecision($rules, $name, $infoByName, 'docker');
            $assignedRule = is_array($decision['assignedRule'] ?? null) ? $decision['assignedRule'] : null;
            $ruleTargetByName[$name] = $assignedRule ? (string)($assignedRule['folderId'] ?? '') : '';
            $labels = dockerInfoLabelsForName($infoByName, $name);
            $labelTargetByName[$name] = getFolderLabelValueFromLabels($labels);
        }

        $folderContainers = [];
        $assignedContainers = [];
        foreach ($folders as $folderId => $folder) {
            $members = $folder['containers'] ?? [];
            if (!empty($folder['regex'])) {
                $regex = '/' . str_replace('/', '\/', $folder['regex']) . '/';
                foreach ($allContainerNames as $name) {
                    if (@preg_match($regex, $name) && !in_array($name, $members)) {
                        $members[] = $name;
                    }
                }
            }
            $folderName = trim((string)($folder['name'] ?? ''));
            if ($folderName !== '') {
                foreach ($allContainerNames as $name) {
                    if (($labelTargetByName[$name] ?? '') === $folderName && !in_array($name, $members, true)) {
                        $members[] = $name;
                    }
                }
            }
            foreach ($allContainerNames as $name) {
                if (($ruleTargetByName[$name] ?? '') === (string)$folderId && !in_array($name, $members, true)) {
                    $members[] = $name;
                }
            }
            $members = array_values(array_filter($members, function($m) use ($allContainerNames, $assignedContainers) {
                return in_array($m, $allContainerNames) && !in_array($m, $assignedContainers);
            }));
            $folderContainers["folder-$folderId"] = $members;
            $assignedContainers = array_merge($assignedContainers, $members);
        }

        $newOrder = [];
        $seen = [];
        $folderPlaceholders = array_keys($folderContainers);

        // Preserve non-folder container order from userprefs, but always rebuild
        // folder placeholder order from docker.json to avoid stale/reversed order.
        foreach ($currentOrder as $item) {
            if (in_array($item, $folderPlaceholders, true)) {
                continue;
            }
            if (in_array($item, $assignedContainers, true)) {
                continue;
            }
            if (in_array($item, $allContainerNames, true) && !in_array($item, $seen, true)) {
                $newOrder[] = $item;
                $seen[] = $item;
            }
        }

        foreach ($allContainerNames as $name) {
            if (!in_array($name, $seen, true) && !in_array($name, $assignedContainers, true)) {
                $newOrder[] = $name;
                $seen[] = $name;
            }
        }

        // Append folders in folder definition order.
        foreach ($folderPlaceholders as $placeholder) {
            foreach ($folderContainers[$placeholder] as $ct) {
                if (!in_array($ct, $seen, true)) {
                    $newOrder[] = $ct;
                    $seen[] = $ct;
                }
            }
            if (!in_array($placeholder, $seen, true)) {
                $newOrder[] = $placeholder;
                $seen[] = $placeholder;
            }
        }

        $ini = "";
        foreach ($newOrder as $i => $name) {
            $ini .= ($i + 1) . '="' . $name . '"' . "\n";
        }
        file_put_contents($prefsFile, $ini);
        fv3_debug_log("syncContainerOrder: wrote userprefs.cfg with " . count($newOrder) . " entries");

        // Reorder autostart file to match new container order
        $dockerManPaths = @parse_ini_file('/boot/config/plugins/dockerMan/dockerMan.cfg') ?: [];
        $autoStartFile = $dockerManPaths['autostart-file'] ?? "/var/lib/docker/unraid-autostart";
        if (file_exists($autoStartFile)) {
            $autoStartLines = @file($autoStartFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
            // Build name→line map to preserve delay values (format: "name" or "name delay")
            $autoStartMap = [];
            foreach ($autoStartLines as $line) {
                $parts = explode(' ', $line, 2);
                $autoStartMap[$parts[0]] = $line;
            }
            // Remove stale entries (containers that no longer exist)
            foreach ($autoStartMap as $name => $line) {
                if (!in_array($name, $allContainerNames)) {
                    fv3_debug_log("syncContainerOrder: removing stale autostart entry '$name' (container no longer exists)");
                    unset($autoStartMap[$name]);
                }
            }

            // Rebuild autostart file in $newOrder sequence, only for containers already in autostart
            $newAutoStart = [];
            foreach ($newOrder as $name) {
                if (isset($autoStartMap[$name])) {
                    $newAutoStart[] = $autoStartMap[$name];
                    unset($autoStartMap[$name]);
                }
            }
            // Append any autostart containers not in $newOrder (shouldn't happen, but safety net)
            foreach ($autoStartMap as $line) {
                $newAutoStart[] = $line;
            }
            file_put_contents($autoStartFile, implode("\n", $newAutoStart) . "\n");
            fv3_debug_log("syncContainerOrder: wrote autostart file with " . count($newAutoStart) . " entries");
        }
    }

    function updateFolder(string $type, string $content, string $id = '') : void {
        $type = ensureType($type);
        if (strlen($content) > FVPLUS_MAX_FOLDER_CONTENT_RAW_BYTES) {
            throw new RuntimeException('Folder payload exceeds raw upload limit.');
        }
        $isCreate = empty($id);
        if (empty($id)) {
            $id = generateId();
        }
        $fileData = readRawFolderMap($type);
        $decodedContent = json_decode($content, true);
        if (!is_array($decodedContent)) {
            throw new RuntimeException('Invalid folder payload.');
        }
        $existingFolder = is_array($fileData[$id] ?? null)
            ? normalizeFolderContentPayload((array)$fileData[$id])
            : null;
        $nextFolder = normalizeFolderContentPayload($decodedContent);
        $normalizedPreview = json_encode($nextFolder, JSON_UNESCAPED_SLASHES);
        if (!is_string($normalizedPreview)) {
            throw new RuntimeException('Failed to normalize folder payload.');
        }
        if (strlen($normalizedPreview) > FVPLUS_MAX_FOLDER_CONTENT_BYTES) {
            throw new RuntimeException('Folder payload too large after normalization.');
        }
        $createdAt = normalizeIsoTimestamp($nextFolder['createdAt'] ?? '');
        if (is_array($existingFolder)) {
            $existingCreatedAt = normalizeIsoTimestamp($existingFolder['createdAt'] ?? '');
            if ($existingCreatedAt !== '') {
                $createdAt = $existingCreatedAt;
            }
        }
        if ($createdAt === '') {
            $createdAt = gmdate('c');
        }
        $nextFolder['createdAt'] = $createdAt;
        $nextFolder['updatedAt'] = gmdate('c');
        $fileData[$id] = $nextFolder;
        $fileData = normalizeFolderParentLinks($fileData);
        writeRawFolderMap($type, $fileData);
        syncManualOrderWithFolders($type, $fileData);
        try {
            appendDiagnosticsHistoryEvent($isCreate ? 'folder_create' : 'folder_update', $type, [
                'folderId' => $id,
                'folderCount' => count($fileData),
                'sourceScript' => basename((string)($_SERVER['SCRIPT_NAME'] ?? ''))
            ], 'ok', 'server');
        } catch (Throwable $err) {
            // Keep update flow non-fatal.
        }
    }

    function deleteFolder(string $type, string $id) : void {
        $type = ensureType($type);
        $fileData = readRawFolderMap($type);
        $deletedParentId = normalizeFolderParentIdValue($fileData[$id]['parentId'] ?? '');
        unset($fileData[$id]);
        foreach ($fileData as $folderId => &$folder) {
            if (!is_array($folder)) {
                continue;
            }
            $parentId = normalizeFolderParentIdValue($folder['parentId'] ?? ($folder['parent_id'] ?? ''));
            if ($parentId === $id) {
                $folder['parentId'] = $deletedParentId;
            }
        }
        unset($folder);
        $fileData = normalizeFolderParentLinks($fileData);
        writeRawFolderMap($type, $fileData);
        syncManualOrderWithFolders($type, $fileData);
        try {
            appendDiagnosticsHistoryEvent('folder_delete', $type, [
                'folderId' => $id,
                'folderCount' => count($fileData),
                'sourceScript' => basename((string)($_SERVER['SCRIPT_NAME'] ?? ''))
            ], 'ok', 'server');
        } catch (Throwable $err) {
            // Keep delete flow non-fatal.
        }
    }

    function generateId(int $length = 20) : string {
        return substr(str_replace(['+', '/', '='], '', base64_encode(random_bytes((int)ceil($length * 3 / 4)))), 0, $length);
    }

    function createFile(string $type): void {
        $type = ensureType($type);
        global $configDir;
        if (!is_dir($configDir)) {
            @mkdir($configDir, 0770, true);
        }
        $filePath = "$configDir/$type.json";
        if (!file_exists($filePath)) {
            writeJsonObjectWithLastGood($filePath, []);
        }
        $prefsPath = getTypePrefsPath($type);
        if (!file_exists($prefsPath)) {
            writeJsonObjectWithLastGood($prefsPath, defaultTypePrefs());
        }
    }

    function repairPluginPaths(): array {
        global $configDir;
        $created = [];
        if (!is_dir($configDir)) {
            @mkdir($configDir, 0770, true);
            $created[] = $configDir;
        }
        foreach (['styles', 'scripts', 'backups', 'rollback'] as $name) {
            $path = "$configDir/$name";
            if (!is_dir($path)) {
                @mkdir($path, 0770, true);
                $created[] = $path;
            }
        }
        foreach (FVPLUS_ALLOWED_TYPES as $type) {
            createFile($type);
            readTypePrefs($type); // Normalize and ensure defaults.
        }
        return [
            'createdPaths' => $created,
            'configDir' => $configDir
        ];
    }

    function getDockerTemplateCachePath(): string {
        return fv3_cache_root() . '/docker-template-index/cache.json';
    }

    function buildDockerTemplateSignature(array $templateFiles): string {
        $parts = [];
        foreach ($templateFiles as $templateFile) {
            $path = trim((string)($templateFile['path'] ?? ''));
            if ($path === '') {
                continue;
            }
            $parts[] = $path . '|' . (int)@filemtime($path) . '|' . (int)@filesize($path);
        }
        sort($parts, SORT_STRING);
        return hash('sha256', implode("\n", $parts));
    }

    function readDockerTemplateCache(string $signature): ?array {
        $payload = fv3_read_json_cache_payload(getDockerTemplateCachePath());
        if (!is_array($payload)) {
            return null;
        }
        if (($payload['signature'] ?? '') !== $signature) {
            return null;
        }
        $generatedAt = strtotime((string)($payload['generatedAt'] ?? ''));
        if ($generatedAt <= 0 || (time() - $generatedAt) > FVPLUS_DOCKER_TEMPLATE_CACHE_TTL) {
            return null;
        }
        $templates = $payload['templates'] ?? null;
        return is_array($templates) ? $templates : null;
    }

    function writeDockerTemplateCache(string $signature, array $templates): void {
        fv3_write_json_cache_payload(getDockerTemplateCachePath(), [
            'signature' => $signature,
            'generatedAt' => gmdate('c'),
            'templates' => $templates
        ]);
    }

    function buildDockerTemplateIndex(array $templateFiles): array {
        $allXmlTemplates = [];
        foreach ($templateFiles as $templateFile) {
            $path = trim((string)($templateFile['path'] ?? ''));
            if ($path === '' || !is_file($path)) {
                continue;
            }
            $doc = new DOMDocument();
            if (!@$doc->load($path)) {
                continue;
            }
            $templateName = trim((string)($doc->getElementsByTagName('Name')->item(0)->nodeValue ?? ''));
            $templateImage = DockerUtil::ensureImageTag((string)($doc->getElementsByTagName('Repository')->item(0)->nodeValue ?? ''));
            if ($templateName === '' || $templateImage === '') {
                continue;
            }
            $allXmlTemplates[$templateName . '|' . $templateImage] = [
                'WebUi' => trim((string)($doc->getElementsByTagName('WebUI')->item(0)->nodeValue ?? '')),
                'TSUrlRaw' => trim((string)($doc->getElementsByTagName('TailscaleWebUI')->item(0)->nodeValue ?? '')),
                'TSServeMode' => trim((string)($doc->getElementsByTagName('TailscaleServe')->item(0)->nodeValue ?? 'no')),
                'TSTailscaleEnabled' => strtolower(trim((string)($doc->getElementsByTagName('TailscaleEnabled')->item(0)->nodeValue ?? 'false'))) === 'true',
                'registry' => trim((string)($doc->getElementsByTagName('Registry')->item(0)->nodeValue ?? '')),
                'Support' => trim((string)($doc->getElementsByTagName('Support')->item(0)->nodeValue ?? '')),
                'Project' => trim((string)($doc->getElementsByTagName('Project')->item(0)->nodeValue ?? '')),
                'DonateLink' => trim((string)($doc->getElementsByTagName('DonateLink')->item(0)->nodeValue ?? '')),
                'ReadMe' => trim((string)($doc->getElementsByTagName('ReadMe')->item(0)->nodeValue ?? '')),
                'Shell' => trim((string)($doc->getElementsByTagName('Shell')->item(0)->nodeValue ?? 'sh')),
                'path' => $path
            ];
        }
        return $allXmlTemplates;
    }

    function getDockerTemplateIndexCached(DockerTemplates $dockerTemplates): array {
        $templateFiles = $dockerTemplates->getTemplates('all');
        if (!is_array($templateFiles) || empty($templateFiles)) {
            return [];
        }
        $signature = buildDockerTemplateSignature($templateFiles);
        $cached = readDockerTemplateCache($signature);
        if (is_array($cached)) {
            return $cached;
        }
        $templates = buildDockerTemplateIndex($templateFiles);
        writeDockerTemplateCache($signature, $templates);
        return $templates;
    }

    function readInfoState(string $type): array {
        $type = ensureType($type);
        $info = [];

        if ($type === 'docker') {
            global $dockerManPaths;
            $dockerClient = new DockerClient();
            $containers = $dockerClient->getDockerJSON("/containers/json?all=1");
            if (!is_array($containers)) {
                return [];
            }

            $autoStartFile = $dockerManPaths['autostart-file'] ?? "/var/lib/docker/unraid-autostart";
            $autoStartLines = @file($autoStartFile, FILE_IGNORE_NEW_LINES) ?: [];
            $autoStartSet = [];
            foreach ($autoStartLines as $line) {
                $trimmed = trim((string)$line);
                if ($trimmed === '') {
                    continue;
                }
                $parts = preg_split('/\s+/', $trimmed, 2);
                $name = trim((string)($parts[0] ?? ''));
                if ($name !== '') {
                    $autoStartSet[$name] = true;
                }
            }

            foreach ($containers as $container) {
                $name = ltrim((string)($container['Names'][0] ?? ''), '/');
                if ($name === '') {
                    continue;
                }
                $labels = is_array($container['Labels'] ?? null) ? $container['Labels'] : [];
                $stateRaw = strtolower(trim((string)($container['State'] ?? '')));
                $statusRaw = trim((string)($container['Status'] ?? ''));
                $running = $stateRaw === 'running';
                $paused = ($stateRaw === 'paused') || (stripos($statusRaw, 'paused') !== false);
                $stateKind = $running ? ($paused ? 'paused' : 'running') : 'stopped';
                $manager = getNormalizedDockerManagerFromLabels($labels);

                $info[$name] = [
                    'name' => $name,
                    'id' => substr(str_replace('sha256:', '', (string)($container['Id'] ?? '')), 0, 12),
                    'state' => $stateKind,
                    'running' => $running,
                    'paused' => $paused,
                    'status' => $statusRaw,
                    'autostart' => isset($autoStartSet[$name]),
                    'manager' => $manager,
                    'composeProject' => getComposeProjectValueFromLabels($labels),
                    'folderLabel' => getFolderLabelValueFromLabels($labels)
                ];
            }
            ksort($info);
            return $info;
        }

        if ($type === 'vm') {
            global $lv;
            if (!isset($lv)) {
                $lv = new Libvirt();
                if (!$lv->connect()) {
                    return [];
                }
            }
            $vms = $lv->get_domains();
            if (!is_array($vms)) {
                return [];
            }
            foreach ($vms as $vm) {
                $res = $lv->get_domain_by_name($vm);
                if (!$res) {
                    continue;
                }
                $dom = $lv->domain_get_info($res);
                $state = strtolower(trim((string)$lv->domain_state_translate($dom['state'] ?? '')));
                if ($state === '') {
                    $state = 'stopped';
                }
                $name = trim((string)$vm);
                if ($name === '') {
                    continue;
                }
                $info[$name] = [
                    'name' => $name,
                    'uuid' => (string)$lv->domain_get_uuid($res),
                    'state' => $state,
                    'autostart' => (bool)$lv->domain_get_autostart($res)
                ];
            }
            ksort($info);
            return $info;
        }

        return [];
    }

    function readInfo(string $type): array {
        fv3_debug_log("readInfo called for type: $type");
        $info = [];
        if ($type == "docker") {
            global $dockerManPaths, $documentRoot;
            global $driver, $host; 
            if (!isset($driver) || !is_array($driver)) { $driver = DockerUtil::driver(); fv3_debug_log("Initialized \$driver: " . json_encode($driver)); }
            if (!isset($host)) { $host = DockerUtil::host(); fv3_debug_log("Initialized \$host: " . $host); }

            $dockerClient = new DockerClient();
            $DockerUpdate = new DockerUpdate();
            $dockerTemplates = new DockerTemplates();

            $cts = $dockerClient->getDockerJSON("/containers/json?all=1");
            $autoStartFile = $dockerManPaths['autostart-file'] ?? "/var/lib/docker/unraid-autostart";
            $autoStartLines = @file($autoStartFile, FILE_IGNORE_NEW_LINES) ?: [];
            $autoStart = array_map('var_split', $autoStartLines);

            // Remove stale entries from autostart file (containers that no longer exist)
            $allCtNames = array_map(function($c) { return ltrim($c['Names'][0] ?? '', '/'); }, $cts);
            $cleanedLines = array_filter($autoStartLines, function($line) use ($allCtNames) {
                $parts = explode(' ', $line, 2);
                return in_array($parts[0], $allCtNames);
            });
            if (count($cleanedLines) < count($autoStartLines)) {
                file_put_contents($autoStartFile, implode("\n", $cleanedLines) . "\n");
                fv3_debug_log("readInfo: removed " . (count($autoStartLines) - count($cleanedLines)) . " stale autostart entries");
                $autoStart = array_map('var_split', $cleanedLines);
            }

            $allXmlTemplates = getDockerTemplateIndexCached($dockerTemplates);

            foreach ($cts as $key => &$ct) {
                $ct['info'] = $dockerClient->getContainerDetails($ct['Id']);
                if (empty($ct['info'])) { fv3_debug_log("Skipped container due to empty details: ID " . ($ct['Id'] ?? 'N/A')); continue; }

                $containerName = substr($ct['info']['Name'], 1);
                $ct['info']['Name'] = $containerName;
                fv3_debug_log("Processing Container: $containerName (ID: " . ($ct['Id'] ?? 'N/A') . ")");

                $ct['info']['State']['Autostart'] = in_array($containerName, $autoStart);
                $ct['info']['Config']['Image'] = DockerUtil::ensureImageTag($ct['info']['Config']['Image']);
                $ct['info']['State']['Updated'] = $DockerUpdate->getUpdateStatus($ct['info']['Config']['Image']);
                $ct['info']['State']['manager'] = getNormalizedDockerManagerFromLabels($ct['Labels'] ?? []);
                $ct['shortId'] = substr(str_replace('sha256:', '', $ct['Id']), 0, 12);
                $ct['shortImageId'] = substr(str_replace('sha256:', '', $ct['ImageID']), 0, 12);
                $ct['info']['State']['WebUi'] = ''; $ct['info']['State']['TSWebUi'] = '';
                $ct['info']['Shell'] = 'sh'; $ct['info']['template'] = null;
                $rawWebUiString = ''; $rawTsXmlUrl = ''; $tsServeModeFromXml = 'no';
                $isTailscaleEnabledForContainer = false;

                $templateKey = $containerName . '|' . $ct['info']['Config']['Image'];
                $templateData = $allXmlTemplates[$templateKey] ?? null;

                if ($ct['info']['State']['manager'] == 'dockerman' && !is_null($templateData)) {
                    $rawWebUiString = $templateData['WebUi']; $rawTsXmlUrl = $templateData['TSUrlRaw'];
                    $tsServeModeFromXml = $templateData['TSServeMode'];
                    $isTailscaleEnabledForContainer = $templateData['TSTailscaleEnabled'];
                    $ct['info']['registry'] = $templateData['registry']; $ct['info']['Support'] = $templateData['Support']; $ct['info']['Project'] = $templateData['Project']; $ct['info']['DonateLink'] = $templateData['DonateLink']; $ct['info']['ReadMe'] = $templateData['ReadMe']; $ct['info']['Shell'] = $templateData['Shell'] ?: 'sh'; $ct['info']['template'] = ['path' => $templateData['path']];
                } else {
                    $rawWebUiString = $ct['Labels']['net.unraid.docker.webui'] ?? '';
                    $rawTsXmlUrl = $ct['Labels']['net.unraid.docker.tailscale.webui'] ?? '';
                    $tsServeModeFromXml = $ct['Labels']['net.unraid.docker.tailscale.servemode'] ?? ($ct['Labels']['net.unraid.docker.tailscale.funnel'] === 'true' ? 'funnel' : 'no');
                    $isTailscaleEnabledForContainer = strtolower($ct['Labels']['net.unraid.docker.tailscale.enabled'] ?? 'false') === 'true';
                    $ct['info']['Shell'] = $ct['Labels']['net.unraid.docker.shell'] ?? 'sh';
                }
                fv3_debug_log("  $containerName: Using ".($templateData && $ct['info']['State']['manager'] == 'dockerman' ? "XML" : "Label")." data. TailscaleEnabled: " . ($isTailscaleEnabledForContainer ? 'true' : 'false'));
                fv3_debug_log("    $containerName: Raw WebUI: '$rawWebUiString', Raw TS XML URL: '$rawTsXmlUrl', TS Serve Mode: '$tsServeModeFromXml'");
                
                // --- Populate $ct['info']['Ports'] ---
                $ct['info']['Ports'] = [];
                $currentNetworkMode = $ct['HostConfig']['NetworkMode'] ?? 'unknown';
                $currentNetworkDriver = $driver[$currentNetworkMode] ?? null;
                
                $containerIpAddress = null; 
                if ($currentNetworkMode !== 'host' && $currentNetworkDriver !== 'bridge') {
                    $containerNetworkSettings = $ct['NetworkSettings']['Networks'][$currentNetworkMode] ?? null;
                    if ($containerNetworkSettings && !empty($containerNetworkSettings['IPAddress'])) { $containerIpAddress = $containerNetworkSettings['IPAddress']; }
                } elseif ($currentNetworkMode === 'host') {
                    $containerIpAddress = $host; 
                }
                fv3_debug_log("  $containerName: NetworkMode: $currentNetworkMode, Driver: " . ($currentNetworkDriver ?: 'N/A') . ", ContainerIP (for custom/host): " . ($containerIpAddress ?: 'N/A'));
                fv3_debug_log("  $containerName: HostConfig.PortBindings: " . json_encode($ct['info']['HostConfig']['PortBindings'] ?? []));
                fv3_debug_log("  $containerName: Config.ExposedPorts: " . json_encode($ct['info']['Config']['ExposedPorts'] ?? []));

                if (isset($ct['info']['HostConfig']['PortBindings']) && is_array($ct['info']['HostConfig']['PortBindings']) && !empty($ct['info']['HostConfig']['PortBindings'])) {
                    fv3_debug_log("  $containerName: Processing HostConfig.PortBindings...");
                    foreach ($ct['info']['HostConfig']['PortBindings'] as $containerPortProtocol => $hostBindings) {
                        if (is_array($hostBindings) && !empty($hostBindings)) {
                            list($privatePort, $protocol) = explode('/', $containerPortProtocol);
                            $protocol = strtoupper($protocol ?: 'TCP');
                            $hostBinding = $hostBindings[0];
                            $publicIp = ($hostBinding['HostIp'] === '0.0.0.0' || empty($hostBinding['HostIp'])) ? $host : $hostBinding['HostIp'];
                            $publicPort = $hostBinding['HostPort'] ?? null; 

                            fv3_debug_log("    $containerName Binding: Private=$privatePort/$protocol, Public=$publicIp:" . ($publicPort ?: 'N/A'));
                            $ct['info']['Ports'][] = [
                                'PrivateIP'   => null, // For bridge mappings, the "private IP" is internal to Docker, not usually the container's specific IP on another net
                                'PrivatePort' => $privatePort,
                                'PublicIP'    => $publicIp,
                                'PublicPort'  => $publicPort, 
                                'NAT'         => true, 
                                'Type'        => $protocol
                            ];
                        }
                    }
                } elseif (isset($ct['info']['Config']['ExposedPorts']) && is_array($ct['info']['Config']['ExposedPorts'])) {
                    fv3_debug_log("  $containerName: Processing Config.ExposedPorts (Network: $currentNetworkMode)...");
                    foreach ($ct['info']['Config']['ExposedPorts'] as $containerPortProtocol => $emptyValue) {
                        list($privatePort, $protocol) = explode('/', $containerPortProtocol);
                        $protocol = strtoupper($protocol ?: 'TCP');
                        
                        $effectiveIp = null;
                        $effectivePort = $privatePort; 

                        if ($currentNetworkMode === 'host') {
                            $effectiveIp = $host;
                        } elseif ($currentNetworkMode !== 'none' && $containerIpAddress) {
                            $effectiveIp = $containerIpAddress;
                        }
                        
                        fv3_debug_log("    $containerName Exposed: Private=$privatePort/$protocol, EffectiveIP=" . ($effectiveIp ?: 'null') . ", EffectivePort=$effectivePort");
                        $ct['info']['Ports'][] = [
                            'PrivateIP'   => $containerIpAddress, 
                            'PrivatePort' => $privatePort,
                            'PublicIP'    => $effectiveIp, 
                            'PublicPort'  => $effectivePort, 
                            'NAT'         => false,
                            'Type'        => $protocol
                        ];
                     }
                }
                
                if ($currentNetworkMode === 'none') {
                    fv3_debug_log("  $containerName: NetworkMode is 'none'. Adjusting public port aspects.");
                    $tempPorts = [];
                    if(isset($ct['info']['Config']['ExposedPorts']) && is_array($ct['info']['Config']['ExposedPorts'])){
                        foreach($ct['info']['Config']['ExposedPorts'] as $containerPortProtocol => $emptyValue) {
                            list($privatePort, $protocol) = explode('/', $containerPortProtocol);
                            $protocol = strtoupper($protocol ?: 'TCP');
                            $tempPorts[] = [
                                'PrivateIP'   => null, // No specific container IP accessible
                                'PrivatePort' => $privatePort,
                                'PublicIP'    => null,
                                'PublicPort'  => null, 
                                'NAT'         => false, 
                                'Type'        => $protocol
                            ];
                        }
                    }
                    $ct['info']['Ports'] = $tempPorts;
                }
                ksort($ct['info']['Ports']);
                fv3_debug_log("  $containerName: Final ct[info][Ports]: " . json_encode($ct['info']['Ports']));

                $finalWebUi = '';
                if (!empty($rawWebUiString)) {
                    if (strpos($rawWebUiString, '[IP]') === false && strpos($rawWebUiString, '[PORT:') === false) { $finalWebUi = $rawWebUiString; } 
                    else {
                        $webUiIp = $host; 
                        if ($currentNetworkMode === 'host') { $webUiIp = $host; } 
                        elseif ($currentNetworkDriver !== 'bridge' && $containerIpAddress) { $webUiIp = $containerIpAddress; }
                        if (strpos($currentNetworkMode, 'container:') === 0 || $currentNetworkMode === 'none') { $finalWebUi = ''; } 
                        else {
                            $tempWebUi = str_replace("[IP]", $webUiIp ?: '', $rawWebUiString);
                            if (preg_match("%\[PORT:(\d+)\]%", $tempWebUi, $matches)) {
                                $internalPortFromTemplate = $matches[1]; $mappedPublicPort = $internalPortFromTemplate; 
                                foreach ($ct['info']['Ports'] as $p) {
                                    if (isset($p['PrivatePort']) && $p['PrivatePort'] == $internalPortFromTemplate) {
                                        $isNatEquivalent = (($p['NAT'] ?? false) === true);
                                        $mappedPublicPort = ($isNatEquivalent && !empty($p['PublicPort'])) ? $p['PublicPort'] : $p['PrivatePort'];
                                        break;
                                    }
                                }
                                $tempWebUi = preg_replace("%\[PORT:\d+\]%", $mappedPublicPort, $tempWebUi);
                            }
                            $finalWebUi = $tempWebUi;
                        }
                    }
                }
                $ct['info']['State']['WebUi'] = $finalWebUi;
                fv3_debug_log("  $containerName: Resolved Standard WebUi: '$finalWebUi'");
                
                $finalTsWebUi = '';
                if ($isTailscaleEnabledForContainer) { 
                    fv3_debug_log("  $containerName: Tailscale is ENABLED. Attempting to resolve TS WebUI.");
                    $baseTsTemplateFromHelper = '';
                    if (!empty($rawTsXmlUrl)) { 
                        $baseTsTemplateFromHelper = generateTSwebui($rawTsXmlUrl, $tsServeModeFromXml, $rawWebUiString); 
                    } elseif (!empty($ct['Labels']['net.unraid.docker.tailscale.webui'])) {
                        $baseTsTemplateFromHelper = $ct['Labels']['net.unraid.docker.tailscale.webui'];
                    }
                    fv3_debug_log("    $containerName: Base TS WebUI from generateTSwebui/label: '$baseTsTemplateFromHelper'");

                    if (!empty($baseTsTemplateFromHelper)) {
                        if (strpos($baseTsTemplateFromHelper, '[hostname]') !== false || strpos($baseTsTemplateFromHelper, '[HOSTNAME]') !== false) {
                            $tsFqdn = fv3_get_tailscale_fqdn_from_container($containerName, (bool)($ct['info']['State']['Running'] ?? false)); 
                            if ($tsFqdn) {
                                $finalTsWebUi = str_replace(["[hostname][magicdns]", "[HOSTNAME][MAGICDNS]"], $tsFqdn, $baseTsTemplateFromHelper);
                                if (strpos($baseTsTemplateFromHelper, 'http://[hostname]') === 0) {
                                    $finalTsWebUi = str_replace('http://', 'https://', $finalTsWebUi);
                                }
                            } else { fv3_debug_log("    $containerName: TS WebUI: Could not resolve [hostname] via exec."); $finalTsWebUi = ''; }
                        } elseif (strpos($baseTsTemplateFromHelper, '[noserve]') !== false || strpos($baseTsTemplateFromHelper, '[NOSERVE]') !== false) {
                            $tsIP = fv3_get_tailscale_ip_from_container($containerName, (bool)($ct['info']['State']['Running'] ?? false)); 
                            if ($tsIP) {
                                $finalTsWebUi = str_replace(["[noserve]", "[NOSERVE]"], $tsIP, $baseTsTemplateFromHelper);
                                $internalPortForTS = null;
                                if (preg_match('/\[PORT:(\d+)\]/i', $baseTsTemplateFromHelper, $portMatches)) { 
                                    $internalPortForTS = $portMatches[1];
                                } elseif (preg_match('/\[PORT:(\d+)\]/i', $rawWebUiString, $portMatches)) { 
                                    $internalPortForTS = $portMatches[1];
                                } elseif (preg_match('/:(\d+)/', $finalTsWebUi, $portMatchesNoserve)) { 
                                    $internalPortForTS = $portMatchesNoserve[1];
                                }
                                
                                if ($internalPortForTS !== null) {
                                   $finalTsWebUi = preg_replace('/\[PORT:\d+\]/i', $internalPortForTS, $finalTsWebUi);
                                   if (strpos($baseTsTemplateFromHelper, '[noserve]:[PORT:') === false && preg_match('/:(\d+)/', $baseTsTemplateFromHelper, $portMatchesRawBase)) {
                                       if ($portMatchesRawBase[1] != $internalPortForTS) { 
                                          $finalTsWebUi = str_replace(":$portMatchesRawBase[1]", ":$internalPortForTS", $finalTsWebUi);
                                       }
                                   }
                                }
                            } else { fv3_debug_log("    $containerName: TS WebUI: Could not resolve [noserve] via exec."); $finalTsWebUi = ''; }
                        } else {
                            $finalTsWebUi = $baseTsTemplateFromHelper; 
                        }
                    }
                } else {
                    fv3_debug_log("  $containerName: Tailscale is NOT enabled or no TS URL defined in template/label.");
                }
                $ct['info']['State']['TSWebUi'] = $finalTsWebUi;
                fv3_debug_log("  $containerName: Resolved TS WebUi: '$finalTsWebUi'");
                
                $info[$containerName] = $ct;
            }
            unset($ct); 

        } elseif ($type == "vm") {
            global $lv;
            if (!isset($lv)) { 
                $lv = new Libvirt();
                if (!$lv->connect()) { fv3_debug_log("VM: Libvirt connection failed."); return []; }
            }
            $vms = $lv->get_domains();
            fv3_debug_log("VM: Found " . count($vms) . " VMs.");
            if (!empty($vms)) {
                foreach ($vms as $vm) {
                    $res = $lv->get_domain_by_name($vm);
                    if (!$res) { fv3_debug_log("VM: Could not get domain by name for $vm."); continue; }
                    $dom = $lv->domain_get_info($res);
                    $vcpus = (int)($dom['nrVirtCpu'] ?? 0);
                    $memoryKiB = (int)($dom['memory'] ?? 0);
                    if ($memoryKiB <= 0) {
                        $memoryKiB = (int)($dom['maxMem'] ?? 0);
                    }
                    $storageBytes = 0;
                    if (method_exists($lv, 'domain_get_xml') && function_exists('simplexml_load_string')) {
                        $domainXml = @((string)$lv->domain_get_xml($res));
                        if ($domainXml !== '') {
                            $xml = @simplexml_load_string($domainXml);
                            if ($xml !== false && isset($xml->devices->disk)) {
                                foreach ($xml->devices->disk as $diskNode) {
                                    $deviceType = strtolower(trim((string)($diskNode['device'] ?? '')));
                                    if ($deviceType !== '' && $deviceType !== 'disk') {
                                        continue;
                                    }
                                    $sourcePath = trim((string)($diskNode->source['file'] ?? ''));
                                    if ($sourcePath === '') {
                                        continue;
                                    }
                                    $diskBytes = @filesize($sourcePath);
                                    if ($diskBytes !== false && $diskBytes > 0) {
                                        $storageBytes += (int)$diskBytes;
                                    }
                                }
                            }
                        }
                    }
                    $info[$vm] = [
                        'uuid' => $lv->domain_get_uuid($res), 'name' => $vm,
                        'description' => $lv->domain_get_description($res),
                        'autostart' => $lv->domain_get_autostart($res),
                        'state' => $lv->domain_state_translate($dom['state']),
                        'vcpus' => $vcpus,
                        'memoryKiB' => $memoryKiB,
                        'storageBytes' => $storageBytes,
                        'icon' => $lv->domain_get_icon_url($res),
                        'logs' => (is_file("/var/log/libvirt/qemu/$vm.log") ? "libvirt/qemu/$vm.log" : '')
                    ];
                }
            }
        }
        fv3_debug_log("readInfo for type: $type completed.");
        return $info;
    }

    function readUnraidOrder(string $type): array {
        fv3_debug_log("readUnraidOrder called for type: $type");
        $user_prefs_path = "/boot/config/plugins";
        $order = [];
        if ($type == "docker") {
            $dockerClient = new DockerClient();
            $containersFromUnraid = $dockerClient->getDockerContainers(); 
            $prefs_file = "$user_prefs_path/dockerMan/userprefs.cfg";

            if (file_exists($prefs_file)) {
                $prefs_ini = @parse_ini_file($prefs_file);
                if ($prefs_ini) { 
                    $prefs_array = array_values($prefs_ini);
                    $sort = [];
                    $count_containers = count($containersFromUnraid);
                    foreach ($containersFromUnraid as $ct_item)  { 
                        $search = array_search($ct_item['Name'], $prefs_array);
                        $sort[] = ($search === false) ? ($count_containers + count($sort) + 1) : $search; 
                    }
                    if (!empty($sort)) { 
                         @array_multisort($sort,SORT_NUMERIC,$containersFromUnraid);
                    } else { 
                         @usort($containersFromUnraid, function($a, $b) { return strnatcasecmp($a['Name'], $b['Name']); });
                    }
                } else { 
                    @usort($containersFromUnraid, function($a, $b) { return strnatcasecmp($a['Name'], $b['Name']); });
                }
            } else { 
                 @usort($containersFromUnraid, function($a, $b) { return strnatcasecmp($a['Name'], $b['Name']); });
            }
            $order = array_column($containersFromUnraid, 'Name');

        } elseif ($type == "vm") {
            global $lv;
            if (!isset($lv)) { $lv = new Libvirt(); if (!$lv->connect()) { fv3_debug_log("VM Order: Libvirt connection failed."); return []; } }

            $prefs_file = "$user_prefs_path/dynamix.vm.manager/userprefs.cfg";
            $vms = $lv->get_domains();

            if (!empty($vms)) {
                if (file_exists($prefs_file)) {
                    $prefs_ini = @parse_ini_file($prefs_file);
                     if ($prefs_ini) {
                        $prefs_array = array_values($prefs_ini);
                        $sort = [];
                        $count_vms = count($vms);
                        foreach ($vms as $vm_name) {
                            $search = array_search($vm_name, $prefs_array);
                            $sort[] = ($search === false) ? ($count_vms + count($sort) + 1) : $search;
                        }
                        if (!empty($sort)) {
                            @array_multisort($sort, SORT_NUMERIC, $vms);
                        } else {
                             natcasesort($vms);
                        }
                    } else {
                       natcasesort($vms);
                    }
                } else {
                    natcasesort($vms);
                }
                $order = array_values($vms);
            }
        }
        fv3_debug_log("readUnraidOrder for type: $type completed. Order: " . json_encode($order));
        return $order;
    }
    function pathToMultiDimArray($dir) {
        $final = [];
        try {
            if (!is_dir($dir) || !is_readable($dir)) return $final;
            $elements = array_diff(scandir($dir), ['.', '..']);
            foreach ($elements as $el) {
                $newEl = "{$dir}/{$el}";
                if(is_dir($newEl)) {
                    array_push($final, ["name" => $el, "path" => $newEl, "sub" => pathToMultiDimArray($newEl)]);
                } else if(is_file($newEl)) {
                    array_push($final, ["name" => $el, "path" => $newEl]);
                }
            }
        } catch (Throwable $err) { fv3_debug_log("Error in pathToMultiDimArray for $dir: " . $err->getMessage()); }
        return $final;
    }
    function dirToArrayOfFiles($dir, $fileFilter = NULL, $folderFilter = NULL) {
        $final = [];
        if (!is_array($dir)) return $final; 
        foreach ($dir as $el) {
            if (!is_array($el) || !isset($el['name'])) continue; 
            if(isset($el['sub']) && (!isset($folderFilter) || (isset($folderFilter) && !preg_match($folderFilter, $el['name'])))) {
                $final = array_merge($final, dirToArrayOfFiles($el['sub'], $fileFilter, $folderFilter));
            } else if(!isset($el['sub']) && (!isset($fileFilter) || (isset($fileFilter) && preg_match($fileFilter, $el['name'])))) {
                array_push($final, $el);
            }
        }
        return $final;
    }
?>
