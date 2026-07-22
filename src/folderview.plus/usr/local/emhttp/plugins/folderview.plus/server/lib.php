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
    if (PHP_SAPI === 'cli') {
        $testConfigDir = trim((string)getenv('FVPLUS_TEST_CONFIG_DIR'));
        $testSourceDir = trim((string)getenv('FVPLUS_TEST_SOURCE_DIR'));
        if ($testConfigDir !== '') {
            $configDir = $testConfigDir;
        }
        if ($testSourceDir !== '') {
            $sourceDir = $testSourceDir;
        }
    }
    $documentRoot = $_SERVER['DOCUMENT_ROOT'] ?? '/usr/local/emhttp';
    $fvplusHostDependencyStatus = [];

    if (!class_exists('FVPlusConfigConflictException')) {
        class FVPlusConfigConflictException extends RuntimeException {}
    }

    function fvplus_register_host_dependency_status(string $key, string $path, bool $loaded, string $detail = ''): void {
        global $fvplusHostDependencyStatus;
        $safeKey = trim($key);
        if ($safeKey === '') {
            return;
        }
        $fvplusHostDependencyStatus[$safeKey] = [
            'path' => $path,
            'loaded' => $loaded,
            'detail' => trim($detail)
        ];
    }

    function fvplus_safe_require_once(string $key, string $path): bool {
        $safePath = trim($path);
        if ($safePath === '') {
            fvplus_register_host_dependency_status($key, $safePath, false, 'Empty dependency path.');
            return false;
        }
        if (!is_file($safePath)) {
            fvplus_register_host_dependency_status($key, $safePath, false, 'Dependency file not found.');
            return false;
        }
        try {
            require_once($safePath);
            fvplus_register_host_dependency_status($key, $safePath, true, 'Loaded.');
            return true;
        } catch (Throwable $error) {
            fvplus_register_host_dependency_status($key, $safePath, false, 'Failed to load: ' . trim((string)$error->getMessage()));
            fv3_debug_log("Host dependency failed to load [$key] at $safePath: " . $error->getMessage());
            return false;
        }
    }

    function fvplus_get_host_dependency_status(): array {
        global $fvplusHostDependencyStatus;
        return is_array($fvplusHostDependencyStatus) ? $fvplusHostDependencyStatus : [];
    }

    fvplus_safe_require_once('helpers', "$documentRoot/webGui/include/Helpers.php");
    fvplus_safe_require_once('docker', "$documentRoot/plugins/dynamix.docker.manager/include/DockerClient.php");
    fvplus_safe_require_once('libvirt', "$documentRoot/plugins/dynamix.vm.manager/include/libvirt_helpers.php");
    fvplus_safe_require_once('validation', '/usr/local/emhttp/plugins/folderview.plus/server/lib.validation.php');

    if (!function_exists('autov')) {
        function autov($path): void {
            echo htmlspecialchars((string)$path, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        }
    }

    function fvplus_append_query_arg(string $url, string $key, string $value): string {
        $safeUrl = trim($url);
        $safeKey = trim($key);
        if ($safeUrl === '' || $safeKey === '' || $value === '') {
            return $safeUrl;
        }
        $fragment = '';
        $fragmentPos = strpos($safeUrl, '#');
        if ($fragmentPos !== false) {
            $fragment = substr($safeUrl, $fragmentPos);
            $safeUrl = substr($safeUrl, 0, $fragmentPos);
        }
        $pattern = '/([?&])' . preg_quote($safeKey, '/') . '=[^&]*/';
        if (preg_match($pattern, $safeUrl)) {
            $replaced = preg_replace($pattern, '$1' . $safeKey . '=' . $value, $safeUrl, 1);
            return (is_string($replaced) ? $replaced : $safeUrl) . $fragment;
        }
        $separator = strpos($safeUrl, '?') === false ? '?' : '&';
        return $safeUrl . $separator . $safeKey . '=' . $value . $fragment;
    }

    function fvplus_read_asset_version_token(): string {
        static $versionToken = null;
        if (is_string($versionToken) && $versionToken !== '') {
            return $versionToken;
        }
        global $configDir;
        $version = trim(readInstalledVersion());
        if ($version === '' || $version === '0.0.0') {
            $versionPath = "$configDir/version";
            $mtime = @filemtime($versionPath);
            if (is_int($mtime) && $mtime > 0) {
                $version = (string)$mtime;
            }
        }
        if ($version === '') {
            $version = '0';
        }
        $versionToken = rawurlencode($version);
        return $versionToken;
    }

    function fvplus_normalize_plugin_asset_public_path(string $path): string {
        global $sourceDir, $documentRoot;
        $safePath = trim($path);
        if ($safePath === '') {
            return '';
        }
        if (strpos($safePath, '/plugins/folderview.plus/') === 0) {
            return $safePath;
        }
        $normalizedPath = str_replace('\\', '/', $safePath);
        $publicPrefixPos = strpos($normalizedPath, '/plugins/folderview.plus/');
        if ($publicPrefixPos !== false) {
            return substr($normalizedPath, $publicPrefixPos);
        }
        $resolvedPath = realpath($safePath);
        if (!is_string($resolvedPath) || $resolvedPath === '') {
            return '';
        }
        $resolvedPath = str_replace('\\', '/', $resolvedPath);
        $roots = [
            realpath($sourceDir),
            realpath($documentRoot . '/plugins/folderview.plus')
        ];
        foreach ($roots as $root) {
            if (!is_string($root) || $root === '') {
                continue;
            }
            $normalizedRoot = rtrim(str_replace('\\', '/', $root), '/');
            if ($resolvedPath === $normalizedRoot) {
                return '/plugins/folderview.plus';
            }
            $prefix = $normalizedRoot . '/';
            if (strpos($resolvedPath, $prefix) === 0) {
                return '/plugins/folderview.plus/' . ltrim(substr($resolvedPath, strlen($prefix)), '/');
            }
        }
        return '';
    }

    function fvplus_versioned_plugin_asset_path(string $path): string {
        $publicPath = fvplus_normalize_plugin_asset_public_path($path);
        if ($publicPath === '') {
            return trim($path);
        }
        return fvplus_append_query_arg($publicPath, 'v', fvplus_read_asset_version_token());
    }

    function fvplus_asset_url(string $path): string {
        $safePath = trim($path);
        if ($safePath === '') {
            return '';
        }
        $pluginAssetPath = fvplus_normalize_plugin_asset_public_path($safePath);
        if ($pluginAssetPath !== '') {
            return htmlspecialchars(fvplus_versioned_plugin_asset_path($pluginAssetPath), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        }
        ob_start();
        autov($safePath);
        $captured = trim((string)ob_get_clean());
        if ($captured !== '') {
            return $captured;
        }
        return htmlspecialchars($safePath, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    function fvplus_asset(string $path): void {
        echo fvplus_asset_url($path);
    }

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
    const FVPLUS_ENVIRONMENT_SNAPSHOT_SCHEMA_VERSION = 1;
    const FVPLUS_ENVIRONMENT_SNAPSHOT_KIND = 'environment_snapshot';
    const FVPLUS_REMOTE_MANIFEST_URL = "https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/main/folderview.plus.plg";
    const FVPLUS_ALLOWED_TYPES = ['docker', 'vm'];
    const FVPLUS_DIAGNOSTICS_SCHEMA_VERSION = 2;
    const FVPLUS_DIAGNOSTICS_HISTORY_MAX = 250;
    const FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY = 'sanitized';
    const FVPLUS_RULE_KINDS = ['name_regex', 'label', 'label_contains', 'label_starts_with', 'image_regex', 'compose_project_regex'];
    const FVPLUS_RULE_EFFECTS = ['include', 'exclude'];
    const FVPLUS_RUNTIME_PREFS_SCHEMA = 4;
    const FVPLUS_RUNTIME_TOGGLE_PREFS_SCHEMA = 2;
    const FVPLUS_PRIVACY_MODE_PREFS_SCHEMA = 3;
    const FVPLUS_CONFIG_METADATA_SCHEMA_VERSION = 1;
    const FVPLUS_CONFIG_MUTATION_LOCK_TIMEOUT_SECONDS = 10;
    const FVPLUS_CUSTOM_ICON_METADATA_SCHEMA_VERSION = 1;
    const FVPLUS_THEME_WORKSPACE_SCHEMA_VERSION = 1;
    const FVPLUS_GLOBAL_ROLLBACK_SCHEMA_VERSION = 1;
    const FVPLUS_GLOBAL_ROLLBACK_HISTORY_MAX = 20;
    const FVPLUS_THEME_WORKSPACE_MAX_THEMES = 24;
    const FVPLUS_THEME_WORKSPACE_MAX_FILES_PER_THEME = 16;
    const FVPLUS_THEME_WORKSPACE_MAX_FILE_BYTES = 262144;
    const FVPLUS_THEME_WORKSPACE_MAX_CUSTOM_CSS_BYTES = 65536;
    const FVPLUS_MAX_FOLDER_CONTENT_BYTES = 131072;
    const FVPLUS_MAX_FOLDER_CONTENT_RAW_BYTES = 1048576;
    const FVPLUS_MAX_FOLDER_BATCH_RAW_BYTES = 8388608;
    const FVPLUS_MAX_FOLDER_BATCH_OPERATIONS = 500;
    const FVPLUS_MAX_BULK_ASSIGN_BATCH_ITEMS = 5000;
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
    const FVPLUS_INFO_CACHE_TTL_FULL = 8;
    const FVPLUS_INFO_CACHE_TTL_STATE = 12;
    const FVPLUS_DOCKER_TEMPLATE_CACHE_TTL = 300;
    const FVPLUS_TAILSCALE_EXEC_CACHE_TTL = 20;

    require_once(__DIR__ . '/lib.api-contract.php');
    require_once(__DIR__ . '/lib.preflight.php');
    require_once(__DIR__ . '/lib.prefs.php');
    require_once(__DIR__ . '/lib.diagnostics.php');

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
        echo '<div class="fv-runtime-conflict-banner" data-conflict-key="' . $conflictKey . '" data-conflict-plugins="' . $pluginData . '" style="margin:12px 0 16px 0;padding:14px 16px;border:1px solid var(--orange, #f0a30a);background:transparent;color:var(--text, currentColor);border-radius:10px;line-height:1.5;">';
        echo '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">';
        echo '<i class="fa fa-exclamation-triangle" aria-hidden="true" style="font-size:1.2rem;color:var(--orange, #f0a30a);"></i>';
        echo '<div style="font-size:1.34rem;font-weight:800;line-height:1.1;letter-spacing:0.01em;color:var(--orange, #f0a30a);">Safe mode active</div>';
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

    function normalizeRequestTraceId(string $value): string {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return '';
        }
        if (!preg_match('/^[A-Za-z0-9._:-]{6,96}$/', $trimmed)) {
            return '';
        }
        return $trimmed;
    }

    function getRequestTraceId(): string {
        static $traceId = null;
        if (is_string($traceId) && $traceId !== '') {
            return $traceId;
        }
        $candidates = [
            (string)($_POST['_fv_trace'] ?? ''),
            (string)($_GET['_fv_trace'] ?? ''),
            getRequestHeaderValue('X-FV-Trace')
        ];
        foreach ($candidates as $candidate) {
            $normalized = normalizeRequestTraceId($candidate);
            if ($normalized !== '') {
                $traceId = $normalized;
                return $traceId;
            }
        }
        try {
            $generated = 'fv-' . bin2hex(random_bytes(8));
        } catch (Throwable $error) {
            $generated = 'fv-' . substr(sha1(uniqid('', true)), 0, 16);
        }
        $traceId = normalizeRequestTraceId($generated);
        if ($traceId === '') {
            $traceId = 'fv-fallback';
        }
        return $traceId;
    }

    function normalizeRequestTransactionId(string $value): string {
        $trimmed = trim($value);
        if ($trimmed === '' || !preg_match('/^[A-Za-z0-9._:-]{6,96}$/', $trimmed)) {
            return '';
        }
        return $trimmed;
    }

    function getRequestTransactionId(): string {
        static $transactionId = null;
        if (is_string($transactionId) && $transactionId !== '') {
            return $transactionId;
        }
        $candidates = [
            (string)($_POST['_fv_transaction'] ?? ''),
            (string)($_GET['_fv_transaction'] ?? ''),
            getRequestHeaderValue('X-FV-Transaction')
        ];
        foreach ($candidates as $candidate) {
            $normalized = normalizeRequestTransactionId($candidate);
            if ($normalized !== '') {
                $transactionId = $normalized;
                return $transactionId;
            }
        }
        $transactionId = normalizeRequestTransactionId('tx-' . substr(hash('sha256', getRequestTraceId()), 0, 24));
        return $transactionId !== '' ? $transactionId : 'tx-fallback';
    }

    function emitRequestTraceHeader(): void {
        if (!headers_sent()) {
            header('X-FV-Trace: ' . getRequestTraceId());
            header('X-FV-Transaction: ' . getRequestTransactionId());
        }
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
        try {
            writeDurableFileAtomic($path, $token, ['mode' => 0600]);
        } catch (Throwable $error) {
            // Request-token creation remains optional in compatibility mode.
        }
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

    function emitNoCachePageHeaders(): void {
        if (headers_sent()) {
            return;
        }
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        header('Pragma: no-cache');
        header('Expires: 0');
    }

    function emitNoCacheMetaTags(): void {
        echo '<meta http-equiv="Cache-Control" content="no-store, no-cache, must-revalidate, max-age=0">' . "\n";
        echo '<meta http-equiv="Pragma" content="no-cache">' . "\n";
        echo '<meta http-equiv="Expires" content="0">' . "\n";
    }

    function emitPluginPageVersionSentinelScript(string $pageKey): void {
        $safePageKey = trim($pageKey);
        if ($safePageKey === '') {
            $safePageKey = 'page';
        }
        $version = readInstalledVersion();
        echo '<script>(function(){try{' .
            'const win=window;' .
            'if(!win||!win.sessionStorage){return;}' .
            'const currentVersion=' . json_encode($version, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . ';' .
            'const pageKey=' . json_encode($safePageKey, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . ';' .
            'const path=String(win.location&&win.location.pathname||pageKey);' .
            'const storageKey=`fvplus.page-version:${pageKey}:${path}`;' .
            'const reloadKey=`${storageKey}:reloaded`; ' .
            'const previousVersion=String(win.sessionStorage.getItem(storageKey)||"").trim();' .
            'const lastReloadedVersion=String(win.sessionStorage.getItem(reloadKey)||"").trim();' .
            'win.sessionStorage.setItem(storageKey,currentVersion);' .
            'if(previousVersion&&previousVersion!==currentVersion&&lastReloadedVersion!==currentVersion){' .
                'win.sessionStorage.setItem(reloadKey,currentVersion);' .
                'win.location.reload();' .
                'return;' .
            '}' .
            'if(previousVersion===currentVersion&&lastReloadedVersion===currentVersion){' .
                'win.sessionStorage.removeItem(reloadKey);' .
            '}' .
        '}catch(_error){}})();</script>' . "\n";
    }

    function emitRuntimePreflightBannerBootstrap(array $preflight, string $contextLabel = 'Runtime'): void {
        $issues = is_array($preflight['issues'] ?? null) ? array_values($preflight['issues']) : [];
        if (count($issues) === 0) {
            return;
        }
        $encodedIssues = json_encode($issues, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $encodedContext = json_encode(trim($contextLabel) !== '' ? trim($contextLabel) : 'Runtime', JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if (!is_string($encodedIssues) || !is_string($encodedContext)) {
            return;
        }
        echo '<script>(function(){try{' .
            'const win=window;' .
            'const banner=win.FolderViewPlusFatalBanner||null;' .
            'const issues=' . $encodedIssues . ';' .
            'const context=' . $encodedContext . ';' .
            'if(!Array.isArray(issues)||issues.length===0){return;}' .
            'const runtimeContext=(win.FolderViewPlusFatalRuntimeContext&&typeof win.FolderViewPlusFatalRuntimeContext==="object")?win.FolderViewPlusFatalRuntimeContext:{};' .
            'runtimeContext.preflight={issues:issues};' .
            'win.FolderViewPlusFatalRuntimeContext=runtimeContext;' .
            'if(!banner){return;}' .
            'if(typeof banner.setPhase==="function"){banner.setPhase("server-preflight");}' .
            'if(typeof banner.recordAction==="function"){banner.recordAction(context+" runtime preflight reported diagnostics");}' .
            'const fatalIssue=issues.find((issue)=>String(issue&&issue.severity||"").toLowerCase()==="fatal")||null;' .
            'if(fatalIssue){' .
                'const error=new Error(String(fatalIssue.message||fatalIssue.title||context+" runtime preflight failed"));' .
                'error.fvplusBannerShown=true;' .
                'banner.reportFatalError(error,{' .
                    'context:context,' .
                    'title:String(fatalIssue.title||context+" runtime preflight failed"),' .
                    'message:String(fatalIssue.message||"FolderView Plus detected a fatal environment issue before the runtime could start."),' .
                    'code:String(fatalIssue.code||"FVPLUS-RUN-ENV-001"),' .
                    'phase:"server-preflight",' .
                    'category:String(fatalIssue.category||"environment"),' .
                    'detailLabel:"Diagnostics",' .
                    'details:Array.isArray(fatalIssue.details)?fatalIssue.details:[]' .
                '});' .
                'return;' .
            '}' .
            'const details=[];' .
            'issues.forEach((issue)=>{' .
                'const title=String(issue&&issue.title||"Notice").trim();' .
                'if(title){details.push(title);}' .
                'const lines=Array.isArray(issue&&issue.details)?issue.details:[];' .
                'lines.forEach((line)=>{' .
                    'const normalized=String(line||"").trim();' .
                    'if(normalized){details.push(normalized);}' .
                '});' .
            '});' .
            'banner.reportDegradedState("Preflight warnings detected",{' .
                'context:context,' .
                'title:context+" troubleshooting notice",' .
                'message:"FolderView Plus detected page conditions that may affect runtime behavior or supportability.",' .
                'code:"FVPLUS-RUN-ENV-002",' .
                'phase:"server-preflight",' .
                'category:"environment-warning",' .
                'detailLabel:"Checks to review",' .
                'details:details' .
            '});' .
        '}catch(_error){}})();</script>' . "\n";
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
        if (trim(getRequestHeaderValue('X-FV-Request')) === '1') {
            return true;
        }
        $requestFlag = trim((string)($_POST['_fv_request'] ?? $_GET['_fv_request'] ?? ''));
        return $requestFlag === '1';
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
        acquireConfigMutationLock();
    }

    function fvplus_json_response(array $payload, int $statusCode = 200): void {
        if (!headers_sent()) {
            header('Content-Type: application/json');
            header('X-Content-Type-Options: nosniff');
            header('Cache-Control: no-store, no-cache, must-revalidate');
            emitRequestTraceHeader();
        }
        http_response_code($statusCode);
        if (!array_key_exists('traceId', $payload)) {
            $payload['traceId'] = getRequestTraceId();
        }
        if (!array_key_exists('transactionId', $payload)) {
            $payload['transactionId'] = getRequestTransactionId();
        }
        $encoded = json_encode($payload, JSON_UNESCAPED_SLASHES);
        if ($encoded === false) {
            http_response_code(500);
            echo '{"ok":false,"error":"JSON encoding failed."}';
            return;
        }
        echo $encoded;
    }

    function fvplus_json_ok(array $payload = []): void {
        $data = [
            'ok' => true,
            'traceId' => getRequestTraceId(),
            'transactionId' => getRequestTransactionId()
        ];
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
            'error' => $message,
            'traceId' => getRequestTraceId(),
            'transactionId' => getRequestTransactionId()
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
        $traceId = getRequestTraceId();
        $transactionId = getRequestTransactionId();
        $line = sprintf(
            "[%s] [trace:%s] [transaction:%s] [audit:%s] %s in %s:%d | %s\n",
            $timestamp,
            $traceId,
            $transactionId,
            fvplus_get_current_api_audit_category() ?: 'unclassified',
            get_class($error),
            (string)$error->getFile(),
            (int)$error->getLine(),
            (string)$error->getMessage()
        );
        @file_put_contents(FVPLUS_API_ERROR_LOG, $line, FILE_APPEND);
        @error_log(trim($line));
    }

    function fvplus_get_api_error_status(Throwable $error): int {
        if ($error instanceof FVPlusApiContractException) {
            return max(400, min(599, (int)$error->getCode()));
        }
        if ($error instanceof FVPlusConfigConflictException) {
            return 409;
        }
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
            fvplus_enforce_current_api_contract();
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
        $normalized['hiddenPreviewMembers'] = array_values(array_intersect(
            $normalized['containers'],
            array_slice(normalizeFolderMembers($normalized['hiddenPreviewMembers'] ?? ($normalized['hidden_preview'] ?? [])), 0, 5000)
        ));
        unset($normalized['hidden_preview']);
        $rawMemberIdentities = is_array($normalized['memberIdentities'] ?? null)
            ? $normalized['memberIdentities']
            : (is_array($normalized['member_identities'] ?? null) ? $normalized['member_identities'] : []);
        $normalizedMemberIdentities = [];
        foreach ($normalized['containers'] as $memberName) {
            if (!is_array($rawMemberIdentities[$memberName] ?? null)) {
                continue;
            }
            $rawIdentity = $rawMemberIdentities[$memberName];
            $kind = strtolower(trim((string)($rawIdentity['kind'] ?? 'docker'))) === 'vm' ? 'vm' : 'docker';
            if ($kind === 'vm') {
                $uuid = truncateUtf8String(trim((string)($rawIdentity['uuid'] ?? ($rawIdentity['id'] ?? ''))), 128);
                if ($uuid !== '') {
                    $normalizedMemberIdentities[$memberName] = ['kind' => 'vm', 'uuid' => $uuid];
                }
                continue;
            }
            $mountDestinations = [];
            $rawMountDestinations = $rawIdentity['mountDestinations'] ?? ($rawIdentity['mount_destinations'] ?? []);
            if (is_array($rawMountDestinations)) {
                foreach ($rawMountDestinations as $rawDestination) {
                    $destination = truncateUtf8String(trim((string)$rawDestination), 512);
                    if ($destination !== '' && !in_array($destination, $mountDestinations, true)) {
                        $mountDestinations[] = $destination;
                    }
                }
                sort($mountDestinations, SORT_NATURAL | SORT_FLAG_CASE);
            }
            $identity = [
                'kind' => 'docker',
                'containerId' => truncateUtf8String(trim((string)($rawIdentity['containerId'] ?? ($rawIdentity['container_id'] ?? ($rawIdentity['id'] ?? '')))), 64),
                'image' => truncateUtf8String(trim((string)($rawIdentity['image'] ?? ($rawIdentity['Image'] ?? ''))), 512),
                'imageId' => truncateUtf8String(trim((string)($rawIdentity['imageId'] ?? ($rawIdentity['image_id'] ?? ($rawIdentity['shortImageId'] ?? '')))), 64),
                'composeProject' => truncateUtf8String(trim((string)($rawIdentity['composeProject'] ?? ($rawIdentity['compose_project'] ?? ''))), 256),
                'template' => truncateUtf8String(trim((string)($rawIdentity['template'] ?? '')), 512),
                'mountDestinations' => $mountDestinations
            ];
            if ($identity['containerId'] !== '' || $identity['image'] !== '' || $identity['imageId'] !== '') {
                $normalizedMemberIdentities[$memberName] = $identity;
            }
        }
        $normalized['memberIdentities'] = $normalizedMemberIdentities;
        unset($normalized['member_identities']);
        $rawParentId = $normalized['parentId'] ?? ($normalized['parent_id'] ?? ($normalized['parent'] ?? ''));
        $normalized['parentId'] = truncateUtf8String(trim((string)$rawParentId), 64);
        unset($normalized['parent_id'], $normalized['parent']);

        if (!is_array($normalized['settings'] ?? null)) {
            $normalized['settings'] = [];
        }
        $rawPreviewRows = $normalized['settings']['preview_rows']
            ?? ($normalized['settings']['previewRows']
                ?? ($normalized['preview_rows']
                    ?? ($normalized['previewRows'] ?? null)));
        if ($rawPreviewRows !== null) {
            $normalized['settings']['preview_rows'] = is_numeric($rawPreviewRows)
                ? (int)$rawPreviewRows
                : truncateUtf8String(trim((string)$rawPreviewRows), 16);
            $normalized['settings']['previewRows'] = $normalized['settings']['preview_rows'];
        }
        unset(
            $normalized['preview_rows'],
            $normalized['previewRows']
        );
        $previewOverflow = strtolower(trim((string)($normalized['settings']['preview_overflow'] ?? ($normalized['settings']['previewOverflow'] ?? 'default'))));
        $normalized['settings']['preview_overflow'] = in_array($previewOverflow, ['default', 'expand_row', 'scroll'], true) ? $previewOverflow : 'default';
        $normalized['settings']['previewOverflow'] = $normalized['settings']['preview_overflow'];
        $normalized['settings']['preview_row_separator'] = filter_var(
            $normalized['settings']['preview_row_separator'] ?? ($normalized['settings']['previewRowSeparator'] ?? false),
            FILTER_VALIDATE_BOOLEAN
        );
        $normalized['settings']['previewRowSeparator'] = $normalized['settings']['preview_row_separator'];
        $separatorColor = trim((string)($normalized['settings']['preview_row_separator_color'] ?? '#afa89e'));
        $normalized['settings']['preview_row_separator_color'] = preg_match('/^#[0-9a-f]{6}$/i', $separatorColor) ? strtolower($separatorColor) : '#afa89e';
        $rawPreviewHideNestedItems = $normalized['settings']['preview_hide_nested_items']
            ?? ($normalized['settings']['previewHideNestedItems']
                ?? ($normalized['preview_hide_nested_items']
                    ?? ($normalized['previewHideNestedItems'] ?? null)));
        if ($rawPreviewHideNestedItems !== null) {
            $normalized['settings']['preview_hide_nested_items'] = filter_var($rawPreviewHideNestedItems, FILTER_VALIDATE_BOOLEAN);
            $normalized['settings']['previewHideNestedItems'] = $normalized['settings']['preview_hide_nested_items'];
        }
        unset(
            $normalized['preview_hide_nested_items'],
            $normalized['previewHideNestedItems']
        );
        $rawChildFolderOrder = $normalized['settings']['child_folder_order']
            ?? ($normalized['settings']['childFolderOrder']
                ?? ($normalized['child_folder_order']
                    ?? ($normalized['childFolderOrder'] ?? [])));
        $childFolderOrder = [];
        if (is_array($rawChildFolderOrder)) {
            foreach ($rawChildFolderOrder as $rawChildFolderId) {
                $childFolderId = truncateUtf8String(trim((string)$rawChildFolderId), 64);
                if ($childFolderId === '' || in_array($childFolderId, $childFolderOrder, true)) {
                    continue;
                }
                $childFolderOrder[] = $childFolderId;
            }
        }
        $normalized['settings']['child_folder_order'] = $childFolderOrder;
        $normalized['settings']['childFolderOrder'] = $childFolderOrder;
        unset(
            $normalized['child_folder_order'],
            $normalized['childFolderOrder']
        );
        $rawPreviewChildFolderDepth = $normalized['settings']['preview_child_folder_depth']
            ?? ($normalized['settings']['previewChildFolderDepth']
                ?? ($normalized['preview_child_folder_depth']
                    ?? ($normalized['previewChildFolderDepth'] ?? null)));
        if ($rawPreviewChildFolderDepth !== null) {
            $depthToken = strtolower(trim((string)$rawPreviewChildFolderDepth));
            if ($depthToken === '0' || $depthToken === 'all' || $depthToken === 'unlimited') {
                $normalizedDepth = 0;
            } elseif (is_numeric($depthToken)) {
                $normalizedDepth = max(1, min(3, (int)$depthToken));
            } else {
                $normalizedDepth = 0;
            }
            $normalized['settings']['preview_child_folder_depth'] = $normalizedDepth;
            $normalized['settings']['previewChildFolderDepth'] = $normalizedDepth;
        }
        unset(
            $normalized['preview_child_folder_depth'],
            $normalized['previewChildFolderDepth']
        );
        $rawPreviewHoverAnimation = $normalized['settings']['preview_hover_animation']
            ?? ($normalized['settings']['previewHoverAnimation']
                ?? ($normalized['preview_hover_animation']
                    ?? ($normalized['previewHoverAnimation'] ?? null)));
        if ($rawPreviewHoverAnimation !== null) {
            $animationToken = strtolower(trim((string)$rawPreviewHoverAnimation));
            $animationAliases = ['grow' => 'pop', 'pulse' => 'glow', 'spin' => 'flip'];
            $animationToken = $animationAliases[$animationToken] ?? $animationToken;
            $allowedAnimations = ['none', 'lift', 'bounce', 'pop', 'glow', 'flip', 'wiggle'];
            if (!in_array($animationToken, $allowedAnimations, true)) {
                $animationToken = 'none';
            }
            $normalized['settings']['preview_hover_animation'] = $animationToken;
            $normalized['settings']['previewHoverAnimation'] = $animationToken;
        }
        unset(
            $normalized['preview_hover_animation'],
            $normalized['previewHoverAnimation']
        );
        $rawDropdownStyle = $normalized['settings']['dropdown_style']
            ?? ($normalized['settings']['dropdownStyle']
                ?? ($normalized['settings']['chevron_style']
                    ?? ($normalized['settings']['chevronStyle']
                        ?? ($normalized['dropdown_style']
                            ?? ($normalized['dropdownStyle']
                                ?? ($normalized['chevron_style']
                                    ?? ($normalized['chevronStyle'] ?? null)))))));
        if ($rawDropdownStyle !== null) {
            $normalized['settings']['dropdown_style'] = truncateUtf8String(trim((string)$rawDropdownStyle), 32);
            $normalized['settings']['dropdownStyle'] = $normalized['settings']['dropdown_style'];
            $normalized['settings']['chevron_style'] = $normalized['settings']['dropdown_style'];
            $normalized['settings']['chevronStyle'] = $normalized['settings']['dropdown_style'];
        }
        unset(
            $normalized['dropdown_style'],
            $normalized['dropdownStyle'],
            $normalized['chevron_style'],
            $normalized['chevronStyle']
        );
        if (!is_array($normalized['actions'] ?? null)) {
            $normalized['actions'] = [];
        } else {
            $normalized['actions'] = array_values($normalized['actions']);
        }

        return $normalized;
    }

    function normalizeFolderSettingsTransferPayload(array $payload): array {
        fvplus_assert_folder_settings_payload_shape($payload);

        $normalized = [];
        $normalized['icon'] = truncateUtf8String(trim((string)($payload['icon'] ?? '')), 2048);
        $normalized['settings'] = [];
        if (array_key_exists('settings', $payload) && is_array($payload['settings'])) {
            $settingsCarrier = normalizeFolderContentPayload(['settings' => $payload['settings']]);
            $normalized['settings'] = is_array($settingsCarrier['settings'] ?? null) ? $settingsCarrier['settings'] : [];
        }

        $normalizedActions = [];
        if (array_key_exists('actions', $payload) && is_array($payload['actions'])) {
            foreach ($payload['actions'] as $action) {
                if (!is_array($action)) {
                    continue;
                }
                $normalizedAction = normalizeFolderNestedValue($action);
                if (!is_array($normalizedAction)) {
                    continue;
                }
                $actionType = (int)($normalizedAction['type'] ?? 0);
                if ($actionType !== 1) {
                    continue;
                }
                if (isset($normalizedAction['containers'])) {
                    unset($normalizedAction['containers']);
                }
                if (isset($normalizedAction['conatiners'])) {
                    unset($normalizedAction['conatiners']);
                }
                $normalizedActions[] = $normalizedAction;
            }
        }
        if (($normalized['settings']['override_default_actions'] ?? false) === true && count($normalizedActions) <= 0) {
            $normalized['settings']['override_default_actions'] = false;
        }
        $normalized['actions'] = array_values($normalizedActions);

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
        $pattern = '/^###\s*' . preg_quote($version, '/') . '\s*$(.*?)(?=^###\s*[0-9][0-9A-Za-z._-]*\s*$|\z)/ms';
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
        if (!preg_match('/^###\s*([0-9][0-9A-Za-z._-]*)\s*$(.*?)(?=^###\s*[0-9][0-9A-Za-z._-]*\s*$|\z)/ms', $content, $match)) {
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
        if (!preg_match_all('/^###\s*([0-9][0-9A-Za-z._-]*)\s*$(.*?)(?=^###\s*[0-9][0-9A-Za-z._-]*\s*$|\z)/ms', $content, $matches, PREG_SET_ORDER)) {
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

    function readReleaseNoteCategoryContract(): array {
        static $contract = null;
        if (is_array($contract)) {
            return $contract;
        }

        $contract = [
            'schemaVersion' => 1,
            'categories' => []
        ];
        $contractPath = dirname(__DIR__) . '/release-note-categories.json';
        $decoded = readJsonObjectFile($contractPath);
        if (!is_array($decoded) || !is_array($decoded['categories'] ?? null)) {
            return $contract;
        }

        $allowedSummaryCategories = ['feature', 'bugfix', 'security', 'performance', 'ui', 'maintenance'];
        $seen = [];
        foreach ($decoded['categories'] as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $tag = trim((string)($entry['tag'] ?? ''));
            $summaryCategory = strtolower(trim((string)($entry['summaryCategory'] ?? '')));
            $tagKey = strtolower($tag);
            if (
                $tag === ''
                || !preg_match('/^[A-Za-z][A-Za-z0-9 \/-]{0,39}$/', $tag)
                || isset($seen[$tagKey])
                || !in_array($summaryCategory, $allowedSummaryCategories, true)
            ) {
                continue;
            }
            $seen[$tagKey] = true;
            $contract['categories'][] = [
                'tag' => $tag,
                'summaryCategory' => $summaryCategory
            ];
        }
        $contract['schemaVersion'] = max(1, (int)($decoded['schemaVersion'] ?? 1));
        return $contract;
    }

    function releaseNoteCategoryTags(): array {
        return array_values(array_map(static function (array $entry): string {
            return (string)($entry['tag'] ?? '');
        }, (array)(readReleaseNoteCategoryContract()['categories'] ?? [])));
    }

    function releaseNoteCategorySummaryMap(): array {
        $map = [];
        foreach ((array)(readReleaseNoteCategoryContract()['categories'] ?? []) as $entry) {
            $tag = strtolower(trim((string)($entry['tag'] ?? '')));
            $summaryCategory = strtolower(trim((string)($entry['summaryCategory'] ?? '')));
            if ($tag !== '' && $summaryCategory !== '') {
                $map[$tag] = $summaryCategory;
            }
        }
        return $map;
    }

    function classifyChangesCategory(array $lines): array {
        $text = strtolower(implode("\n", array_map(static function ($line): string {
            return trim((string)$line);
        }, $lines)));
        if (trim($text) === '') {
            return [
                'id' => 'bugfix',
                'label' => 'Bug Fix Update'
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

        $tagSummaryMap = releaseNoteCategorySummaryMap();
        foreach ($lines as $line) {
            $trimmed = ltrim(trim((string)$line), '-* ');
            $separator = strpos($trimmed, ':');
            if ($separator === false) {
                continue;
            }
            $tagKey = strtolower(trim(substr($trimmed, 0, $separator)));
            $summaryCategory = (string)($tagSummaryMap[$tagKey] ?? '');
            if ($summaryCategory !== '' && array_key_exists($summaryCategory, $scores)) {
                $scores[$summaryCategory] += 3;
            }
        }

        foreach ($keywords as $category => $terms) {
            $score = 0;
            foreach ($terms as $term) {
                if (strpos($text, $term) !== false) {
                    $score += 1;
                }
            }
            $scores[$category] += $score;
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
                'label' => 'Mixed Update'
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
        return [
            'id' => $topCategory,
            'label' => (string)$labels[$topCategory]
        ];
    }

    function stripChangesLineDecoration(string $line): string {
        $cleaned = trim($line);
        $cleaned = preg_replace('/^#{1,6}\s+/', '', $cleaned);
        $categoryTags = releaseNoteCategoryTags();
        if (count($categoryTags) > 0) {
            $escapedTags = array_map(static function (string $tag): string {
                return preg_quote($tag, '/');
            }, $categoryTags);
            $cleaned = preg_replace('/^(?:' . implode('|', $escapedTags) . '):\s*/i', '', (string)$cleaned);
        }
        return trim((string)$cleaned);
    }

    function buildChangesHeadline(array $lines, string $version = ''): string {
        foreach ($lines as $line) {
            $trimmed = trim((string)$line);
            if (preg_match('/^#{1,6}\s+\S/', $trimmed)) {
                $heading = stripChangesLineDecoration($trimmed);
                if ($heading !== '') {
                    return $heading;
                }
            }
        }

        $fallbackLines = [];
        foreach ($lines as $line) {
            $trimmed = trim((string)$line);
            if ($trimmed === '' || $trimmed === '...') {
                continue;
            }
            $cleaned = stripChangesLineDecoration($trimmed);
            if ($cleaned === '') {
                continue;
            }
            $fallbackLines[] = $cleaned;
            if (!preg_match('/^(?:Quality|Test|Maintenance):\s*/i', $trimmed)) {
                return $cleaned;
            }
        }

        if (count($fallbackLines) > 0) {
            return (string)$fallbackLines[0];
        }

        $safeVersion = trim($version);
        return $safeVersion !== ''
            ? "Release notes are unavailable for FolderView Plus {$safeVersion}."
            : 'Release notes are unavailable for this installed version.';
    }

    function filterChangesDetailLines(array $lines): array {
        $details = [];
        foreach ($lines as $line) {
            $trimmed = trim((string)$line);
            if ($trimmed === '' || preg_match('/^#{1,6}\s+\S/', $trimmed)) {
                continue;
            }
            $details[] = $trimmed;
        }
        return $details;
    }

    function readCurrentVersionChangeSummary(int $maxLines = 14): array {
        $summary = readChangesSummaryForVersion(readInstalledVersion(), $maxLines, false);
        $releaseLines = (array)($summary['lines'] ?? []);
        $category = classifyChangesCategory($releaseLines);
        $summary['category'] = (string)($category['id'] ?? 'bugfix');
        $summary['categoryLabel'] = (string)($category['label'] ?? 'Bug Fix Update');
        $summary['headline'] = buildChangesHeadline($releaseLines, (string)($summary['version'] ?? ''));
        $summary['lines'] = filterChangesDetailLines($releaseLines);
        return $summary;
    }

    function readJsonObjectFile(string $path): ?array {
        if (!file_exists($path)) {
            return null;
        }
        $decoded = @json_decode((string)@file_get_contents($path), true);
        return is_array($decoded) ? $decoded : null;
    }

    function getConfigMutationLockPath(): string {
        global $configDir;
        if (!is_dir($configDir)) {
            @mkdir($configDir, 0770, true);
        }
        return "$configDir/.config-mutation.lock";
    }

    function acquireConfigMutationLock(): void {
        if (is_resource($GLOBALS['fvplus_config_mutation_lock_handle'] ?? null)) {
            return;
        }
        $handle = @fopen(getConfigMutationLockPath(), 'c+');
        if (!is_resource($handle)) {
            throw new RuntimeException('Unable to open the configuration mutation lock.');
        }
        $startedAt = microtime(true);
        $locked = false;
        while ((microtime(true) - $startedAt) <= FVPLUS_CONFIG_MUTATION_LOCK_TIMEOUT_SECONDS) {
            if (@flock($handle, LOCK_EX | LOCK_NB)) {
                $locked = true;
                break;
            }
            usleep(25000);
        }
        if (!$locked) {
            @fclose($handle);
            throw new RuntimeException('FolderView Plus configuration is busy. Please retry the action.');
        }
        $GLOBALS['fvplus_config_mutation_lock_handle'] = $handle;
        register_shutdown_function(static function (): void {
            $active = $GLOBALS['fvplus_config_mutation_lock_handle'] ?? null;
            if (!is_resource($active)) {
                return;
            }
            @flock($active, LOCK_UN);
            @fclose($active);
            $GLOBALS['fvplus_config_mutation_lock_handle'] = null;
        });
    }

    function releaseConfigMutationLock(): void {
        $handle = $GLOBALS['fvplus_config_mutation_lock_handle'] ?? null;
        if (!is_resource($handle)) {
            return;
        }
        @flock($handle, LOCK_UN);
        @fclose($handle);
        $GLOBALS['fvplus_config_mutation_lock_handle'] = null;
    }

    function withConfigMutationLock(callable $callback) {
        $alreadyHeld = is_resource($GLOBALS['fvplus_config_mutation_lock_handle'] ?? null);
        if (!$alreadyHeld) {
            acquireConfigMutationLock();
        }
        try {
            return $callback();
        } finally {
            if (!$alreadyHeld) {
                releaseConfigMutationLock();
            }
        }
    }

    function getLastGoodJsonPath(string $path): string {
        return $path . '.lastgood';
    }

    function createAtomicWriteTempPath(string $path): string {
        $parent = dirname($path);
        $prefix = basename($path) . '.tmp.';
        $tempPath = @tempnam($parent, $prefix);
        if (is_string($tempPath) && $tempPath !== '') {
            return $tempPath;
        }

        try {
            return $path . '.tmp.' . getmypid() . '.' . bin2hex(random_bytes(6));
        } catch (Throwable $error) {
            return $path . '.tmp.' . getmypid() . '.' . uniqid('', true);
        }
    }

    function fvplusStorageFailureStage(): string {
        $enabled = trim((string)getenv('FVPLUS_STORAGE_FAILURE_INJECTION')) === '1';
        if (!$enabled) {
            return '';
        }
        return strtolower(trim((string)getenv('FVPLUS_STORAGE_FAILURE_STAGE')));
    }

    function fvplusStorageFailureInjected(string $stage): bool {
        return fvplusStorageFailureStage() === strtolower(trim($stage));
    }

    function fvplusStorageThrowInjectedFailure(string $stage, string $path): void {
        if (fvplusStorageFailureInjected($stage)) {
            throw new RuntimeException("Injected durable storage failure at '$stage' for '" . basename($path) . "'.");
        }
    }

    function fvplusFlushFileHandleBestEffort($handle): bool {
        if (!is_resource($handle)) {
            return false;
        }
        if (!@fflush($handle)) {
            return false;
        }
        if (!function_exists('fsync')) {
            return true;
        }
        return @fsync($handle);
    }

    function fvplusFlushDirectoryBestEffort(string $directory): bool {
        if (!function_exists('fsync') || !is_dir($directory)) {
            return false;
        }
        $handle = @fopen($directory, 'r');
        if (!is_resource($handle)) {
            return false;
        }
        try {
            return @fsync($handle);
        } finally {
            @fclose($handle);
        }
    }

    function getDurableStorageRuntimeSnapshot(): array {
        $snapshot = $GLOBALS['fvplus_durable_storage_snapshot'] ?? [];
        return is_array($snapshot) ? $snapshot : [];
    }

    function writeDurableFileAtomic(string $path, string $contents, array $options = []): array {
        $transactionId = getRequestTransactionId();
        $traceId = getRequestTraceId();
        $tmpPath = '';
        $handle = null;
        $fileFlushed = false;
        $directoryFlushed = false;
        try {
            $parent = dirname($path);
            fvplusStorageThrowInjectedFailure('parent-create', $path);
            if (!is_dir($parent) && !@mkdir($parent, 0770, true) && !is_dir($parent)) {
                throw new RuntimeException("Failed to create durable storage directory for '$path'.");
            }
            fvplusStorageThrowInjectedFailure('read-only', $path);
            if (!is_writable($parent)) {
                throw new RuntimeException("Durable storage directory is read-only for '$path'.");
            }

            $existingMode = is_file($path) ? ((int)@fileperms($path) & 0777) : 0;
            $requestedMode = max(0, (int)($options['mode'] ?? 0644));
            $mode = $existingMode > 0 ? $existingMode : ($requestedMode > 0 ? $requestedMode : 0644);
            fvplusStorageThrowInjectedFailure('temp-create', $path);
            $tmpPath = createAtomicWriteTempPath($path);
            $handle = @fopen($tmpPath, 'c+b');
            if (!is_resource($handle)) {
                throw new RuntimeException("Failed to open temp durable payload for '$path'.");
            }
            if (!@flock($handle, LOCK_EX) || !@ftruncate($handle, 0) || @rewind($handle) === false) {
                throw new RuntimeException("Failed to prepare temp durable payload for '$path'.");
            }
            fvplusStorageThrowInjectedFailure('temp-write', $path);

            $length = strlen($contents);
            $written = 0;
            if (fvplusStorageFailureInjected('interrupted-write')) {
                $partialLength = max(1, (int)floor(max(1, $length) / 2));
                @fwrite($handle, substr($contents, 0, $partialLength));
                throw new RuntimeException("Injected interrupted durable write for '" . basename($path) . "'.");
            }
            while ($written < $length) {
                $chunk = @fwrite($handle, substr($contents, $written));
                if ($chunk === false || $chunk <= 0) {
                    throw new RuntimeException("Failed to complete temp durable payload for '$path' (storage may be full).");
                }
                $written += $chunk;
                if (fvplusStorageFailureInjected('disk-full') && $written < $length) {
                    throw new RuntimeException("Injected full-disk durable write failure for '" . basename($path) . "'.");
                }
            }
            if (fvplusStorageFailureInjected('disk-full')) {
                throw new RuntimeException("Injected full-disk durable write failure for '" . basename($path) . "'.");
            }
            fvplusStorageThrowInjectedFailure('file-flush', $path);
            $fileFlushed = fvplusFlushFileHandleBestEffort($handle);
            if (!$fileFlushed) {
                throw new RuntimeException("Failed to flush temp durable payload for '$path'.");
            }
            @flock($handle, LOCK_UN);
            @fclose($handle);
            $handle = null;

            fvplusStorageThrowInjectedFailure('rename', $path);
            if (!@rename($tmpPath, $path)) {
                throw new RuntimeException("Failed to atomically replace durable payload for '$path'.");
            }
            $tmpPath = '';
            @chmod($path, $mode);
            if (!fvplusStorageFailureInjected('directory-flush')) {
                $directoryFlushed = fvplusFlushDirectoryBestEffort($parent);
            }

            $result = [
                'ok' => true,
                'target' => basename($path),
                'bytes' => $length,
                'traceId' => $traceId,
                'transactionId' => $transactionId,
                'fileFlushed' => $fileFlushed,
                'directoryFlushed' => $directoryFlushed,
                'committedAt' => gmdate('c')
            ];
            $GLOBALS['fvplus_durable_storage_snapshot'] = $result;
            return $result;
        } catch (Throwable $error) {
            if (is_resource($handle)) {
                @flock($handle, LOCK_UN);
                @fclose($handle);
            }
            if ($tmpPath !== '' && file_exists($tmpPath)) {
                @unlink($tmpPath);
            }
            $GLOBALS['fvplus_durable_storage_snapshot'] = [
                'ok' => false,
                'target' => basename($path),
                'traceId' => $traceId,
                'transactionId' => $transactionId,
                'failedStage' => fvplusStorageFailureStage(),
                'failedAt' => gmdate('c')
            ];
            throw $error;
        }
    }

    function writeJsonObjectAtomic(string $path, array $payload): void {
        $encoded = json_encode($payload, JSON_UNESCAPED_SLASHES);
        if (!is_string($encoded) || $encoded === '') {
            throw new RuntimeException("Failed to encode JSON payload for '$path'.");
        }
        writeDurableFileAtomic($path, $encoded);
    }

    function writeJsonObjectWithLastGood(string $path, array $payload): void {
        writeJsonObjectAtomic($path, $payload);
        $lastGoodPath = getLastGoodJsonPath($path);
        try {
            fvplusStorageThrowInjectedFailure('last-good', $lastGoodPath);
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

    function getConfigMetadataPath(string $type): string {
        global $configDir;
        $safeType = ensureType($type);
        return "$configDir/$safeType.metadata.json";
    }

    function configMetadataTimestampFromPath(string $path): string {
        $mtime = is_file($path) ? (int)@filemtime($path) : 0;
        return $mtime > 0 ? gmdate('c', $mtime) : '';
    }

    function configMetadataHashFromPath(string $path): string {
        if (!is_file($path)) {
            return '';
        }
        $hash = @hash_file('sha256', $path);
        return is_string($hash) ? strtolower(trim($hash)) : '';
    }

    function defaultConfigMetadata(string $type): array {
        $safeType = ensureType($type);
        $folderPath = getFolderFilePath($safeType);
        $prefsPath = getTypePrefsPath($safeType);
        $now = gmdate('c');
        return [
            'schemaVersion' => FVPLUS_CONFIG_METADATA_SCHEMA_VERSION,
            'type' => $safeType,
            'createdAt' => $now,
            'updatedAt' => $now,
            'folderRevision' => is_file($folderPath) ? 1 : 0,
            'prefsRevision' => is_file($prefsPath) ? 1 : 0,
            'folderUpdatedAt' => configMetadataTimestampFromPath($folderPath),
            'prefsUpdatedAt' => configMetadataTimestampFromPath($prefsPath),
            'folderSha256' => configMetadataHashFromPath($folderPath),
            'prefsSha256' => configMetadataHashFromPath($prefsPath),
            'externalChangeCount' => 0,
            'lastExternalChangeAt' => '',
            'lastTraceId' => '',
            'lastTransactionId' => '',
            'lastMutationAt' => ''
        ];
    }

    function normalizeConfigMetadata($value, string $type): array {
        $safeType = ensureType($type);
        $incoming = is_array($value) ? $value : [];
        $defaults = defaultConfigMetadata($safeType);
        $createdAt = normalizeIsoTimestamp($incoming['createdAt'] ?? '');
        if ($createdAt === '') {
            $createdAt = (string)$defaults['createdAt'];
        }
        $updatedAt = normalizeIsoTimestamp($incoming['updatedAt'] ?? '');
        if ($updatedAt === '') {
            $updatedAt = (string)$defaults['updatedAt'];
        }
        return [
            'schemaVersion' => FVPLUS_CONFIG_METADATA_SCHEMA_VERSION,
            'type' => $safeType,
            'createdAt' => $createdAt,
            'updatedAt' => $updatedAt,
            'folderRevision' => max(0, (int)($incoming['folderRevision'] ?? $defaults['folderRevision'])),
            'prefsRevision' => max(0, (int)($incoming['prefsRevision'] ?? $defaults['prefsRevision'])),
            'folderUpdatedAt' => normalizeIsoTimestamp($incoming['folderUpdatedAt'] ?? ''),
            'prefsUpdatedAt' => normalizeIsoTimestamp($incoming['prefsUpdatedAt'] ?? ''),
            'folderSha256' => strtolower(trim((string)($incoming['folderSha256'] ?? ''))),
            'prefsSha256' => strtolower(trim((string)($incoming['prefsSha256'] ?? ''))),
            'externalChangeCount' => max(0, (int)($incoming['externalChangeCount'] ?? 0)),
            'lastExternalChangeAt' => normalizeIsoTimestamp($incoming['lastExternalChangeAt'] ?? ''),
            'lastTraceId' => normalizeRequestTraceId((string)($incoming['lastTraceId'] ?? '')),
            'lastTransactionId' => normalizeRequestTransactionId((string)($incoming['lastTransactionId'] ?? '')),
            'lastMutationAt' => normalizeIsoTimestamp($incoming['lastMutationAt'] ?? '')
        ];
    }

    function writeConfigMetadata(string $type, array $metadata): array {
        $safeType = ensureType($type);
        $normalized = normalizeConfigMetadata($metadata, $safeType);
        writeJsonObjectWithLastGood(getConfigMetadataPath($safeType), $normalized);
        return $normalized;
    }

    function readConfigMetadata(string $type, bool $reconcile = true): array {
        $safeType = ensureType($type);
        return withConfigMutationLock(static function () use ($safeType, $reconcile): array {
            $path = getConfigMetadataPath($safeType);
            $decoded = readJsonObjectFile($path);
            $recovered = false;
            if (!is_array($decoded)) {
                $decoded = recoverJsonObjectFromLastGood($path);
                $recovered = is_array($decoded);
            }
            $metadata = normalizeConfigMetadata($decoded, $safeType);
            $changed = $recovered || !is_array($decoded) || jsonObjectsDiffer($decoded, $metadata);

            if ($reconcile) {
                $now = gmdate('c');
                $targets = [
                    'folder' => getFolderFilePath($safeType),
                    'prefs' => getTypePrefsPath($safeType)
                ];
                foreach ($targets as $kind => $targetPath) {
                    $hashKey = $kind . 'Sha256';
                    $revisionKey = $kind . 'Revision';
                    $updatedKey = $kind . 'UpdatedAt';
                    $actualHash = configMetadataHashFromPath($targetPath);
                    $storedHash = strtolower(trim((string)($metadata[$hashKey] ?? '')));
                    if (is_array($decoded) && $storedHash !== $actualHash) {
                        $metadata[$revisionKey] = max(0, (int)$metadata[$revisionKey]) + 1;
                        $metadata['externalChangeCount'] = max(0, (int)$metadata['externalChangeCount']) + 1;
                        $metadata['lastExternalChangeAt'] = $now;
                        $changed = true;
                    }
                    if ($storedHash !== $actualHash) {
                        $metadata[$hashKey] = $actualHash;
                        $metadata[$updatedKey] = configMetadataTimestampFromPath($targetPath);
                        $changed = true;
                    }
                }
                if ($changed) {
                    $metadata['updatedAt'] = $now;
                }
            }

            if ($changed) {
                return writeConfigMetadata($safeType, $metadata);
            }
            return $metadata;
        });
    }

    function commitConfigMetadataWrite(string $type, string $kind, string $targetPath, array $metadata): array {
        $safeType = ensureType($type);
        if (!in_array($kind, ['folder', 'prefs'], true)) {
            throw new RuntimeException('Unsupported configuration metadata kind.');
        }
        $now = gmdate('c');
        $revisionKey = $kind . 'Revision';
        $updatedKey = $kind . 'UpdatedAt';
        $hashKey = $kind . 'Sha256';
        $metadata = normalizeConfigMetadata($metadata, $safeType);
        $metadata[$revisionKey] = max(0, (int)$metadata[$revisionKey]) + 1;
        $metadata[$updatedKey] = $now;
        $metadata[$hashKey] = configMetadataHashFromPath($targetPath);
        $metadata['updatedAt'] = $now;
        $metadata['lastTraceId'] = getRequestTraceId();
        $metadata['lastTransactionId'] = getRequestTransactionId();
        $metadata['lastMutationAt'] = $now;
        return writeConfigMetadata($safeType, $metadata);
    }

    function rebuildConfigMetadata(string $type): array {
        $safeType = ensureType($type);
        return withConfigMutationLock(static function () use ($safeType): array {
            $path = getConfigMetadataPath($safeType);
            $decoded = readJsonObjectFile($path);
            if (!is_array($decoded)) {
                $decoded = readJsonObjectFile(getLastGoodJsonPath($path));
            }
            $previous = normalizeConfigMetadata($decoded, $safeType);
            $rebuilt = defaultConfigMetadata($safeType);
            $rebuilt['createdAt'] = (string)($previous['createdAt'] ?? $rebuilt['createdAt']);
            $rebuilt['folderRevision'] = max(1, (int)($previous['folderRevision'] ?? 0) + 1);
            $rebuilt['prefsRevision'] = max(1, (int)($previous['prefsRevision'] ?? 0) + 1);
            $rebuilt['externalChangeCount'] = max(0, (int)($previous['externalChangeCount'] ?? 0)) + 1;
            $rebuilt['lastExternalChangeAt'] = gmdate('c');
            $rebuilt['updatedAt'] = gmdate('c');
            return writeConfigMetadata($safeType, $rebuilt);
        });
    }

    function assertExpectedConfigRevision(string $type, string $kind, $expectedRevision): array {
        $safeType = ensureType($type);
        $metadata = readConfigMetadata($safeType, true);
        $raw = trim((string)$expectedRevision);
        if ($raw === '') {
            return $metadata;
        }
        if (!ctype_digit($raw)) {
            throw new RuntimeException('Invalid expected configuration revision.');
        }
        $key = $kind === 'prefs' ? 'prefsRevision' : 'folderRevision';
        $expected = (int)$raw;
        $current = max(0, (int)($metadata[$key] ?? 0));
        if ($expected !== $current) {
            throw new FVPlusConfigConflictException(sprintf(
                'This %s configuration changed in another page or browser tab (expected revision %d, current revision %d). Refresh before saving again.',
                $kind === 'prefs' ? 'preferences' : 'folder',
                $expected,
                $current
            ));
        }
        return $metadata;
    }

    function getThemeWorkspacePath(): string {
        global $configDir;
        return "$configDir/theme-workspace.json";
    }

    function fvplusThemeWorkspaceGeneratedCssPath(string $type): string {
        global $configDir;
        $safeType = trim((string)$type);
        if (!in_array($safeType, ['docker', 'vm', 'dashboard'], true)) {
            throw new RuntimeException('Unsupported theme workspace asset type.');
        }
        return "$configDir/styles/fvplus-managed.theme.$safeType.css";
    }

    function defaultThemeWorkspace(): array {
        return [
            'schemaVersion' => FVPLUS_THEME_WORKSPACE_SCHEMA_VERSION,
            'activeThemeId' => '',
            'themes' => [],
            'variables' => [],
            'customCss' => '',
            'lastCheckedAt' => ''
        ];
    }

    function fvplusThemeWorkspaceNormalizeSource(array $source): array {
        return [
            'input' => truncateUtf8String(trim((string)($source['input'] ?? '')), 512),
            'kind' => truncateUtf8String(trim((string)($source['kind'] ?? '')), 32),
            'owner' => truncateUtf8String(trim((string)($source['owner'] ?? '')), 128),
            'repo' => truncateUtf8String(trim((string)($source['repo'] ?? '')), 128),
            'branch' => truncateUtf8String(trim((string)($source['branch'] ?? '')), 128),
            'path' => truncateUtf8String(trim((string)($source['path'] ?? '')), 512),
            'defaultBranch' => truncateUtf8String(trim((string)($source['defaultBranch'] ?? '')), 128),
            'commitSha' => truncateUtf8String(trim((string)($source['commitSha'] ?? '')), 128),
            'canCheckUpdates' => !empty($source['canCheckUpdates']),
            'rawUrl' => truncateUtf8String(trim((string)($source['rawUrl'] ?? '')), 1024)
        ];
    }

    function fvplusThemeWorkspaceNormalizeColorValue($value): string {
        $safeValue = truncateUtf8String(trim((string)$value), 128);
        if ($safeValue === '') {
            return '';
        }
        if (preg_match('/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i', $safeValue)) {
            return $safeValue;
        }
        if (preg_match('/^rgba?\(\s*(?:\d{1,3}\s*,\s*){2}\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i', $safeValue)) {
            return $safeValue;
        }
        if (preg_match('/^hsla?\(\s*\d{1,3}(?:deg)?\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i', $safeValue)) {
            return $safeValue;
        }
        return '';
    }

    function fvplusThemeWorkspaceNormalizeVariableMap($value): array {
        $incoming = is_array($value) ? $value : [];
        $normalized = [];
        foreach ($incoming as $key => $rawValue) {
            $token = trim((string)$key);
            if ($token === '' || !preg_match('/^--[A-Za-z0-9._-]+$/', $token)) {
                continue;
            }
            $safeValue = fvplusThemeWorkspaceNormalizeColorValue($rawValue);
            if ($safeValue === '') {
                continue;
            }
            $normalized[$token] = $safeValue;
            if (count($normalized) >= 96) {
                break;
            }
        }
        ksort($normalized, SORT_STRING);
        return $normalized;
    }

    function fvplusThemeWorkspaceDetectTabsFromPath(string $path, int $fallbackCssCount = 0): array {
        $normalized = strtolower(trim($path));
        if ($normalized === '') {
            return [];
        }
        $tabs = [];
        foreach (['docker', 'vm', 'dashboard'] as $tab) {
            if (preg_match('/(^|[._\/-])' . preg_quote($tab, '/') . '([._\/-]|$)/', $normalized)) {
                $tabs[] = $tab;
            }
        }
        if (count($tabs) <= 0 && $fallbackCssCount === 1) {
            return ['docker', 'vm', 'dashboard'];
        }
        return array_values(array_unique($tabs));
    }

    function fvplusThemeWorkspaceNormalizeThemeFiles($value): array {
        $incoming = is_array($value) ? $value : [];
        $normalized = [];
        foreach ($incoming as $file) {
            if (!is_array($file)) {
                continue;
            }
            $content = (string)($file['content'] ?? '');
            if ($content === '' || strlen($content) > FVPLUS_THEME_WORKSPACE_MAX_FILE_BYTES) {
                continue;
            }
            $path = truncateUtf8String(trim((string)($file['path'] ?? $file['name'] ?? '')), 512);
            $tabsIncoming = is_array($file['tabs'] ?? null) ? $file['tabs'] : fvplusThemeWorkspaceDetectTabsFromPath($path, 1);
            $tabs = [];
            foreach ($tabsIncoming as $tab) {
                $safeTab = trim((string)$tab);
                if (in_array($safeTab, ['docker', 'vm', 'dashboard'], true) && !in_array($safeTab, $tabs, true)) {
                    $tabs[] = $safeTab;
                }
            }
            if (count($tabs) <= 0) {
                continue;
            }
            $normalized[] = [
                'name' => truncateUtf8String(trim((string)($file['name'] ?? basename($path))), 160),
                'path' => $path,
                'sourceUrl' => truncateUtf8String(trim((string)($file['sourceUrl'] ?? '')), 1024),
                'tabs' => array_values($tabs),
                'sha256' => hash('sha256', $content),
                'content' => $content
            ];
            if (count($normalized) >= FVPLUS_THEME_WORKSPACE_MAX_FILES_PER_THEME) {
                break;
            }
        }
        return $normalized;
    }

    function fvplusThemeWorkspaceNormalizeThemeRecord($value): array {
        $source = is_array($value) ? $value : [];
        $files = fvplusThemeWorkspaceNormalizeThemeFiles($source['files'] ?? []);
        $identity = trim((string)($source['id'] ?? ''));
        if ($identity === '') {
            $identity = substr(hash('sha256', json_encode([
                'source' => fvplusThemeWorkspaceNormalizeSource(is_array($source['source'] ?? null) ? $source['source'] : []),
                'name' => (string)($source['name'] ?? ''),
                'files' => array_map(static function(array $file): string {
                    return (string)($file['sha256'] ?? '');
                }, $files)
            ], JSON_UNESCAPED_SLASHES)), 0, 16);
        }
        $warnings = [];
        foreach ((array)($source['warnings'] ?? []) as $warning) {
            $safeWarning = truncateUtf8String(trim((string)$warning), 280);
            if ($safeWarning !== '' && !in_array($safeWarning, $warnings, true)) {
                $warnings[] = $safeWarning;
            }
        }
        return [
            'id' => truncateUtf8String($identity, 64),
            'name' => truncateUtf8String(trim((string)($source['name'] ?? '')), 160),
            'importedAt' => normalizeIsoTimestamp((string)($source['importedAt'] ?? '')) ?: gmdate('c'),
            'lastCheckedAt' => normalizeIsoTimestamp((string)($source['lastCheckedAt'] ?? '')),
            'updateAvailable' => !empty($source['updateAvailable']),
            'warnings' => $warnings,
            'source' => fvplusThemeWorkspaceNormalizeSource(is_array($source['source'] ?? null) ? $source['source'] : []),
            'files' => $files
        ];
    }

    function normalizeThemeWorkspacePayload($value): array {
        $incoming = is_array($value) ? $value : [];
        $themesIncoming = is_array($incoming['themes'] ?? null) ? $incoming['themes'] : [];
        $themes = [];
        $seenIds = [];
        foreach ($themesIncoming as $theme) {
            $normalizedTheme = fvplusThemeWorkspaceNormalizeThemeRecord($theme);
            $themeId = trim((string)($normalizedTheme['id'] ?? ''));
            if ($themeId === '' || isset($seenIds[$themeId])) {
                continue;
            }
            $seenIds[$themeId] = true;
            $themes[] = $normalizedTheme;
            if (count($themes) >= FVPLUS_THEME_WORKSPACE_MAX_THEMES) {
                break;
            }
        }
        $activeThemeId = truncateUtf8String(trim((string)($incoming['activeThemeId'] ?? '')), 64);
        if ($activeThemeId !== '' && !isset($seenIds[$activeThemeId])) {
            $activeThemeId = '';
        }
        return [
            'schemaVersion' => FVPLUS_THEME_WORKSPACE_SCHEMA_VERSION,
            'activeThemeId' => $activeThemeId,
            'themes' => $themes,
            'variables' => fvplusThemeWorkspaceNormalizeVariableMap($incoming['variables'] ?? []),
            'customCss' => truncateUtf8String((string)($incoming['customCss'] ?? ''), FVPLUS_THEME_WORKSPACE_MAX_CUSTOM_CSS_BYTES),
            'lastCheckedAt' => normalizeIsoTimestamp((string)($incoming['lastCheckedAt'] ?? ''))
        ];
    }

    function fvplusThemeWorkspaceBuildVariablesCss(array $variables): string {
        if (count($variables) <= 0) {
            return '';
        }
        $lines = [':root {'];
        foreach ($variables as $token => $value) {
            $lines[] = "  $token: $value;";
        }
        $lines[] = '}';
        return implode("\n", $lines);
    }

    function writeThemeWorkspaceManagedAssets(array $workspace): void {
        $normalized = normalizeThemeWorkspacePayload($workspace);
        $activeTheme = null;
        foreach ((array)($normalized['themes'] ?? []) as $theme) {
            if (trim((string)($theme['id'] ?? '')) === trim((string)($normalized['activeThemeId'] ?? ''))) {
                $activeTheme = $theme;
                break;
            }
        }
        $variablesCss = fvplusThemeWorkspaceBuildVariablesCss((array)($normalized['variables'] ?? []));
        $customCss = trim((string)($normalized['customCss'] ?? ''));
        foreach (['docker', 'vm', 'dashboard'] as $type) {
            $chunks = [
                '/* FolderView Plus generated Theme Workspace asset. Do not edit manually. */'
            ];
            if ($variablesCss !== '') {
                $chunks[] = $variablesCss;
            }
            if (is_array($activeTheme)) {
                foreach ((array)($activeTheme['files'] ?? []) as $file) {
                    $tabs = is_array($file['tabs'] ?? null) ? $file['tabs'] : [];
                    if (!in_array($type, $tabs, true)) {
                        continue;
                    }
                    $fileName = trim((string)($file['name'] ?? $file['path'] ?? 'theme.css'));
                    $chunks[] = "/* Imported theme: $fileName */\n" . (string)($file['content'] ?? '');
                }
            }
            if ($customCss !== '') {
                $chunks[] = "/* Theme Workspace custom CSS */\n" . $customCss;
            }
            $output = trim(implode("\n\n", array_filter($chunks, static function($chunk): bool {
                return trim((string)$chunk) !== '';
            })));
            $path = fvplusThemeWorkspaceGeneratedCssPath($type);
            if ($output === '' || $output === '/* FolderView Plus generated Theme Workspace asset. Do not edit manually. */') {
                if (file_exists($path)) {
                    @unlink($path);
                }
                continue;
            }
            writeJsonObjectAtomic(dirname($path) . '/.theme-workspace.touch', ['updatedAt' => gmdate('c')]);
            @unlink(dirname($path) . '/.theme-workspace.touch');
            $parent = dirname($path);
            if (!is_dir($parent)) {
                @mkdir($parent, 0770, true);
            }
            writeDurableFileAtomic($path, $output . "\n");
        }
    }

    function writeThemeWorkspace(array $workspace): array {
        $normalized = normalizeThemeWorkspacePayload($workspace);
        writeJsonObjectWithLastGood(getThemeWorkspacePath(), $normalized);
        writeThemeWorkspaceManagedAssets($normalized);
        return $normalized;
    }

    function ensureThemeWorkspaceManagedAssets(): array {
        $workspace = normalizeThemeWorkspacePayload(readJsonObjectFile(getThemeWorkspacePath()) ?? defaultThemeWorkspace());
        writeThemeWorkspaceManagedAssets($workspace);
        return $workspace;
    }

    function readThemeWorkspace(): array {
        $path = getThemeWorkspacePath();
        if (!file_exists($path)) {
            return writeThemeWorkspace(defaultThemeWorkspace());
        }
        $decoded = readJsonObjectFile($path);
        $recoveredFromLastGood = false;
        if (!is_array($decoded)) {
            $decoded = recoverJsonObjectFromLastGood($path);
            $recoveredFromLastGood = is_array($decoded);
        }
        if (!is_array($decoded)) {
            $decoded = defaultThemeWorkspace();
        }
        $normalized = normalizeThemeWorkspacePayload($decoded);
        if ($recoveredFromLastGood || jsonObjectsDiffer($decoded, $normalized)) {
            return writeThemeWorkspace($normalized);
        }
        writeThemeWorkspaceManagedAssets($normalized);
        return $normalized;
    }

    function normalizeEnvironmentSnapshotPayload($payload): array {
        if (!is_array($payload)) {
            throw new RuntimeException('Environment snapshot must be a JSON object.');
        }

        $typesIncoming = is_array($payload['types'] ?? null) ? $payload['types'] : null;
        if (!is_array($typesIncoming)) {
            throw new RuntimeException('Environment snapshot is missing required type data.');
        }

        $normalizedTypes = [];
        foreach (FVPLUS_ALLOWED_TYPES as $type) {
            $entry = is_array($typesIncoming[$type] ?? null) ? $typesIncoming[$type] : [];
            $folders = normalizeFolderMapPayload(is_array($entry['folders'] ?? null) ? $entry['folders'] : []);
            $prefs = normalizeTypePrefs(is_array($entry['prefs'] ?? null) ? $entry['prefs'] : []);
            $normalizedTypes[$type] = [
                'folders' => $folders,
                'prefs' => $prefs
            ];
        }

        return [
            'kind' => FVPLUS_ENVIRONMENT_SNAPSHOT_KIND,
            'schemaVersion' => FVPLUS_ENVIRONMENT_SNAPSHOT_SCHEMA_VERSION,
            'pluginVersion' => trim((string)($payload['pluginVersion'] ?? '')),
            'exportedAt' => trim((string)($payload['exportedAt'] ?? '')),
            'types' => $normalizedTypes,
            'themeWorkspace' => normalizeThemeWorkspacePayload($payload['themeWorkspace'] ?? [])
        ];
    }

    function buildEnvironmentSnapshotSummary(array $snapshot, string $sourceName = ''): array {
        $normalized = normalizeEnvironmentSnapshotPayload($snapshot);
        $dockerFolders = is_array($normalized['types']['docker']['folders'] ?? null) ? $normalized['types']['docker']['folders'] : [];
        $vmFolders = is_array($normalized['types']['vm']['folders'] ?? null) ? $normalized['types']['vm']['folders'] : [];
        $dockerPrefs = is_array($normalized['types']['docker']['prefs'] ?? null) ? $normalized['types']['docker']['prefs'] : [];
        $vmPrefs = is_array($normalized['types']['vm']['prefs'] ?? null) ? $normalized['types']['vm']['prefs'] : [];
        $themeWorkspace = is_array($normalized['themeWorkspace'] ?? null) ? $normalized['themeWorkspace'] : defaultThemeWorkspace();
        $activeThemeId = trim((string)($themeWorkspace['activeThemeId'] ?? ''));
        $activeThemeName = '';
        foreach ((array)($themeWorkspace['themes'] ?? []) as $theme) {
            if (trim((string)($theme['id'] ?? '')) === $activeThemeId) {
                $activeThemeName = trim((string)($theme['name'] ?? $activeThemeId));
                break;
            }
        }

        $warnings = [];
        $currentVersion = trim(readInstalledVersion());
        $snapshotVersion = trim((string)($normalized['pluginVersion'] ?? ''));
        if ($snapshotVersion !== '' && $currentVersion !== '' && $snapshotVersion !== $currentVersion) {
            $warnings[] = "Snapshot was exported by FolderView Plus $snapshotVersion and will be applied to $currentVersion.";
        }

        return [
            'kind' => FVPLUS_ENVIRONMENT_SNAPSHOT_KIND,
            'schemaVersion' => FVPLUS_ENVIRONMENT_SNAPSHOT_SCHEMA_VERSION,
            'pluginVersion' => $snapshotVersion,
            'currentPluginVersion' => $currentVersion,
            'exportedAt' => trim((string)($normalized['exportedAt'] ?? '')),
            'sourceName' => trim($sourceName),
            'docker' => [
                'folderCount' => count($dockerFolders),
                'sortMode' => trim((string)($dockerPrefs['sortMode'] ?? 'created'))
            ],
            'vm' => [
                'folderCount' => count($vmFolders),
                'sortMode' => trim((string)($vmPrefs['sortMode'] ?? 'created'))
            ],
            'themeWorkspace' => [
                'managedThemeCount' => count((array)($themeWorkspace['themes'] ?? [])),
                'activeThemeId' => $activeThemeId,
                'activeThemeName' => $activeThemeName,
                'customCssBytes' => strlen((string)($themeWorkspace['customCss'] ?? ''))
            ],
            'warnings' => array_values(array_unique(array_filter($warnings, static function($value): bool {
                return trim((string)$value) !== '';
            })))
        ];
    }

    function exportEnvironmentSnapshotPayload(): array {
        $snapshot = [
            'kind' => FVPLUS_ENVIRONMENT_SNAPSHOT_KIND,
            'schemaVersion' => FVPLUS_ENVIRONMENT_SNAPSHOT_SCHEMA_VERSION,
            'pluginVersion' => readInstalledVersion(),
            'exportedAt' => gmdate('c'),
            'types' => [
                'docker' => [
                    'folders' => readRawFolderMap('docker'),
                    'prefs' => readTypePrefs('docker'),
                    'configurationMetadata' => readConfigMetadata('docker', true)
                ],
                'vm' => [
                    'folders' => readRawFolderMap('vm'),
                    'prefs' => readTypePrefs('vm'),
                    'configurationMetadata' => readConfigMetadata('vm', true)
                ]
            ],
            'themeWorkspace' => readThemeWorkspace()
        ];
        return normalizeEnvironmentSnapshotPayload($snapshot);
    }

    function decodeEnvironmentSnapshotPayloadString(string $rawPayload): array {
        $trimmed = trim($rawPayload);
        if ($trimmed === '') {
            throw new RuntimeException('Environment snapshot payload is empty.');
        }
        $decoded = @json_decode($trimmed, true);
        if (!is_array($decoded)) {
            throw new RuntimeException('Environment snapshot is not valid JSON.');
        }
        return normalizeEnvironmentSnapshotPayload($decoded);
    }

    function previewEnvironmentSnapshotPayload(array $snapshot, string $sourceName = ''): array {
        $normalized = normalizeEnvironmentSnapshotPayload($snapshot);
        return [
            'summary' => buildEnvironmentSnapshotSummary($normalized, $sourceName)
        ];
    }

    function importEnvironmentSnapshotPayload(array $snapshot, string $sourceName = ''): array {
        $normalized = normalizeEnvironmentSnapshotPayload($snapshot);
        $rollback = createGlobalRollbackSnapshot('before-environment-import');
        $typeResults = [];

        foreach (FVPLUS_ALLOWED_TYPES as $type) {
            $typeResults[$type] = [
                'backup' => createBackupSnapshot($type, 'before-environment-import')
            ];
        }

        foreach (FVPLUS_ALLOWED_TYPES as $type) {
            $entry = is_array($normalized['types'][$type] ?? null) ? $normalized['types'][$type] : [];
            $folders = is_array($entry['folders'] ?? null) ? $entry['folders'] : [];
            $prefs = is_array($entry['prefs'] ?? null) ? $entry['prefs'] : defaultTypePrefs();
            writeRawFolderMap($type, $folders);
            writeTypePrefs($type, $prefs);
            syncManualOrderWithFolders($type, $folders);
            if ($type === 'docker') {
                syncContainerOrder('docker');
            }
            $typeResults[$type]['folderCount'] = count($folders);
        }

        $workspace = writeThemeWorkspace($normalized['themeWorkspace'] ?? defaultThemeWorkspace());
        $summary = buildEnvironmentSnapshotSummary($normalized, $sourceName);

        try {
            appendDiagnosticsHistoryEvent('environment_import', null, [
                'sourceName' => trim($sourceName),
                'dockerCount' => (int)($summary['docker']['folderCount'] ?? 0),
                'vmCount' => (int)($summary['vm']['folderCount'] ?? 0),
                'managedThemeCount' => (int)($summary['themeWorkspace']['managedThemeCount'] ?? 0),
                'rollbackName' => (string)($rollback['name'] ?? '')
            ], 'ok', 'server');
        } catch (Throwable $err) {
            // Keep import non-fatal if diagnostics logging fails.
        }

        return [
            'summary' => $summary,
            'types' => $typeResults,
            'rollback' => $rollback,
            'themeWorkspace' => [
                'managedThemeCount' => count((array)($workspace['themes'] ?? [])),
                'activeThemeId' => trim((string)($workspace['activeThemeId'] ?? ''))
            ]
        ];
    }

    function fvplusThemeWorkspaceScanCss(string $css): array {
        $warnings = [];
        $severe = [];
        $rules = [
            ['pattern' => '/expression\s*\(/i', 'message' => 'CSS contains expression().'],
            ['pattern' => '/javascript\s*:/i', 'message' => 'CSS contains javascript: URLs.'],
            ['pattern' => '/behavior\s*:/i', 'message' => 'CSS contains behavior: rules.']
        ];
        foreach ($rules as $rule) {
            if (preg_match($rule['pattern'], $css)) {
                $severe[] = $rule['message'];
            }
        }
        if (preg_match('/@import\s+(url\()?["\']?(https?:)?\/\//i', $css)) {
            $warnings[] = 'CSS contains remote @import rules.';
        }
        if (preg_match('/url\s*\(\s*["\']?data:text\/html/i', $css)) {
            $warnings[] = 'CSS contains data:text/html URLs.';
        }
        return [
            'warnings' => array_values(array_unique($warnings)),
            'severe' => array_values(array_unique($severe))
        ];
    }

    function fvplusThemeWorkspaceFetchText(string $url, int $timeoutSeconds = 10): array {
        $requestUrl = trim($url);
        if ($requestUrl === '') {
            return ['ok' => false, 'error' => 'Empty URL.', 'content' => '', 'status' => ''];
        }
        $statusLine = '';
        $responseHeaders = [];
        $context = stream_context_create([
            'http' => [
                'timeout' => max(2, min(20, $timeoutSeconds)),
                'ignore_errors' => true,
                'header' => "Cache-Control: no-cache\r\nPragma: no-cache\r\nUser-Agent: FolderViewPlus/1.0\r\nAccept: application/json, text/plain, */*\r\n"
            ]
        ]);
        $content = @file_get_contents($requestUrl, false, $context);
        if (isset($http_response_header) && is_array($http_response_header)) {
            $responseHeaders = $http_response_header;
            $statusLine = (string)($http_response_header[0] ?? '');
        }
        if ($content === false) {
            return ['ok' => false, 'error' => 'Unable to fetch remote content.', 'content' => '', 'status' => $statusLine];
        }
        return [
            'ok' => preg_match('/\s2\d\d\s/', $statusLine) === 1 || $statusLine === '',
            'error' => '',
            'content' => (string)$content,
            'status' => $statusLine,
            'headers' => $responseHeaders
        ];
    }

    function fvplusThemeWorkspaceFetchJson(string $url, int $timeoutSeconds = 10): array {
        $response = fvplusThemeWorkspaceFetchText($url, $timeoutSeconds);
        if (!$response['ok']) {
            return $response + ['json' => null];
        }
        $decoded = json_decode((string)($response['content'] ?? ''), true);
        if (!is_array($decoded)) {
            return ['ok' => false, 'error' => 'Remote response was not valid JSON.', 'content' => (string)($response['content'] ?? ''), 'status' => (string)($response['status'] ?? ''), 'json' => null];
        }
        $response['json'] = $decoded;
        return $response;
    }

    function fvplusParseGithubThemeSourceInput(string $input): array {
        $raw = trim($input);
        if ($raw === '') {
            throw new RuntimeException('Theme source is required.');
        }
        if (preg_match('#^https?://raw\.githubusercontent\.com/([^/]+)/([^/]+)/([^/]+)/(.+?\.css)$#i', $raw, $match)) {
            return [
                'kind' => 'github_file',
                'owner' => $match[1],
                'repo' => $match[2],
                'branch' => $match[3],
                'path' => $match[4],
                'rawUrl' => $raw
            ];
        }
        if (preg_match('#^https?://github\.com/([^/]+)/([^/]+)/(blob|raw)/([^/]+)/(.+?\.css)$#i', $raw, $match)) {
            return [
                'kind' => 'github_file',
                'owner' => $match[1],
                'repo' => $match[2],
                'branch' => $match[4],
                'path' => $match[5],
                'rawUrl' => 'https://raw.githubusercontent.com/' . $match[1] . '/' . $match[2] . '/' . $match[4] . '/' . $match[5]
            ];
        }
        if (preg_match('#^https?://github\.com/([^/]+)/([^/]+)(?:/tree/([^/]+)(?:/(.+))?)?$#i', $raw, $match)) {
            return [
                'kind' => 'github_repo',
                'owner' => $match[1],
                'repo' => $match[2],
                'branch' => trim((string)($match[3] ?? '')),
                'path' => trim((string)($match[4] ?? '')),
                'rawUrl' => ''
            ];
        }
        if (preg_match('#^([^/\s]+)/([^/\s]+)(?:/tree/([^/\s]+)(?:/(.+))?)?$#', $raw, $match)) {
            return [
                'kind' => 'github_repo',
                'owner' => $match[1],
                'repo' => $match[2],
                'branch' => trim((string)($match[3] ?? '')),
                'path' => trim((string)($match[4] ?? '')),
                'rawUrl' => ''
            ];
        }
        throw new RuntimeException('Unsupported GitHub theme source format.');
    }

    function fvplusResolveGithubThemeRepoMeta(string $owner, string $repo): array {
        $apiUrl = 'https://api.github.com/repos/' . rawurlencode($owner) . '/' . rawurlencode($repo);
        $response = fvplusThemeWorkspaceFetchJson($apiUrl, 10);
        if (!$response['ok']) {
            throw new RuntimeException('Failed to read GitHub repository metadata.');
        }
        $json = is_array($response['json'] ?? null) ? $response['json'] : [];
        return [
            'defaultBranch' => trim((string)($json['default_branch'] ?? 'main'))
        ];
    }

    function fvplusResolveGithubBranchHeadSha(string $owner, string $repo, string $branch): string {
        $apiUrl = 'https://api.github.com/repos/' . rawurlencode($owner) . '/' . rawurlencode($repo) . '/branches/' . rawurlencode($branch);
        $response = fvplusThemeWorkspaceFetchJson($apiUrl, 10);
        if (!$response['ok']) {
            return '';
        }
        return trim((string)($response['json']['commit']['sha'] ?? ''));
    }

    function fvplusImportGithubThemeFiles(string $sourceInput): array {
        $parsed = fvplusParseGithubThemeSourceInput($sourceInput);
        $owner = trim((string)($parsed['owner'] ?? ''));
        $repo = trim((string)($parsed['repo'] ?? ''));
        $branch = trim((string)($parsed['branch'] ?? ''));
        $pathPrefix = ltrim(trim((string)($parsed['path'] ?? '')), '/');
        if ($owner === '' || $repo === '') {
            throw new RuntimeException('Theme source is missing repository information.');
        }
        $repoMeta = fvplusResolveGithubThemeRepoMeta($owner, $repo);
        if ($branch === '') {
            $branch = trim((string)($repoMeta['defaultBranch'] ?? 'main')) ?: 'main';
        }
        $commitSha = fvplusResolveGithubBranchHeadSha($owner, $repo, $branch);
        $warnings = [];
        $files = [];
        if (($parsed['kind'] ?? '') === 'github_file') {
            $filePath = $pathPrefix;
            $rawUrl = trim((string)($parsed['rawUrl'] ?? ''));
            $fileResponse = fvplusThemeWorkspaceFetchText($rawUrl, 10);
            if (!$fileResponse['ok']) {
                throw new RuntimeException('Failed to fetch GitHub CSS file.');
            }
            $scan = fvplusThemeWorkspaceScanCss((string)$fileResponse['content']);
            if (count($scan['severe']) > 0) {
                throw new RuntimeException(implode(' ', $scan['severe']));
            }
            $warnings = array_values(array_unique(array_merge($warnings, (array)$scan['warnings'])));
            $files[] = [
                'name' => basename($filePath),
                'path' => $filePath,
                'sourceUrl' => $rawUrl,
                'tabs' => fvplusThemeWorkspaceDetectTabsFromPath($filePath, 1),
                'content' => (string)$fileResponse['content']
            ];
        } else {
            $treeUrl = 'https://api.github.com/repos/' . rawurlencode($owner) . '/' . rawurlencode($repo) . '/git/trees/' . rawurlencode($branch) . '?recursive=1';
            $treeResponse = fvplusThemeWorkspaceFetchJson($treeUrl, 12);
            if (!$treeResponse['ok']) {
                throw new RuntimeException('Failed to read GitHub repository tree.');
            }
            $tree = is_array($treeResponse['json']['tree'] ?? null) ? $treeResponse['json']['tree'] : [];
            $cssCandidates = [];
            foreach ($tree as $entry) {
                if (!is_array($entry)) {
                    continue;
                }
                if (trim((string)($entry['type'] ?? '')) !== 'blob') {
                    continue;
                }
                $entryPath = ltrim(trim((string)($entry['path'] ?? '')), '/');
                if ($entryPath === '' || !preg_match('/\.css$/i', $entryPath)) {
                    continue;
                }
                if ($pathPrefix !== '' && strpos(strtolower($entryPath), strtolower($pathPrefix)) !== 0) {
                    continue;
                }
                if (preg_match('#(^|/)(node_modules|vendor|dist|build|coverage|\.git)/#i', $entryPath)) {
                    continue;
                }
                $cssCandidates[] = $entryPath;
            }
            if (count($cssCandidates) <= 0) {
                throw new RuntimeException('No CSS theme files were found in the selected GitHub repository.');
            }
            $fallbackCssCount = count($cssCandidates);
            foreach ($cssCandidates as $entryPath) {
                $tabs = fvplusThemeWorkspaceDetectTabsFromPath($entryPath, $fallbackCssCount);
                if (count($tabs) <= 0) {
                    continue;
                }
                $rawUrl = 'https://raw.githubusercontent.com/' . $owner . '/' . $repo . '/' . $branch . '/' . $entryPath;
                $fileResponse = fvplusThemeWorkspaceFetchText($rawUrl, 10);
                if (!$fileResponse['ok']) {
                    continue;
                }
                $scan = fvplusThemeWorkspaceScanCss((string)$fileResponse['content']);
                if (count($scan['severe']) > 0) {
                    throw new RuntimeException(implode(' ', $scan['severe']));
                }
                $warnings = array_values(array_unique(array_merge($warnings, (array)$scan['warnings'])));
                $files[] = [
                    'name' => basename($entryPath),
                    'path' => $entryPath,
                    'sourceUrl' => $rawUrl,
                    'tabs' => $tabs,
                    'content' => (string)$fileResponse['content']
                ];
                if (count($files) >= FVPLUS_THEME_WORKSPACE_MAX_FILES_PER_THEME) {
                    break;
                }
            }
            if (count($files) <= 0) {
                throw new RuntimeException('No compatible Docker, VM, or Dashboard CSS files were found.');
            }
        }
        return [
            'name' => $owner . '/' . $repo,
            'warnings' => $warnings,
            'files' => $files,
            'source' => [
                'input' => $sourceInput,
                'kind' => (string)($parsed['kind'] ?? 'github_repo'),
                'owner' => $owner,
                'repo' => $repo,
                'branch' => $branch,
                'path' => $pathPrefix,
                'defaultBranch' => trim((string)($repoMeta['defaultBranch'] ?? 'main')),
                'commitSha' => $commitSha,
                'canCheckUpdates' => true,
                'rawUrl' => trim((string)($parsed['rawUrl'] ?? ''))
            ]
        ];
    }

    function fvplusThemeWorkspaceBuildThemeRecordFromImport(array $imported): array {
        $source = is_array($imported['source'] ?? null) ? $imported['source'] : [];
        $identity = strtolower(trim((string)($source['owner'] ?? ''))) . '|' . strtolower(trim((string)($source['repo'] ?? ''))) . '|' . trim((string)($source['branch'] ?? '')) . '|' . trim((string)($source['path'] ?? ''));
        $themeId = substr(hash('sha256', $identity), 0, 16);
        return fvplusThemeWorkspaceNormalizeThemeRecord([
            'id' => $themeId,
            'name' => (string)($imported['name'] ?? $themeId),
            'importedAt' => gmdate('c'),
            'lastCheckedAt' => '',
            'updateAvailable' => false,
            'warnings' => $imported['warnings'] ?? [],
            'source' => $source,
            'files' => $imported['files'] ?? []
        ]);
    }

    function scanThemeWorkspaceGithub(string $sourceInput): array {
        $workspace = readThemeWorkspace();
        $imported = fvplusImportGithubThemeFiles($sourceInput);
        $themeRecord = fvplusThemeWorkspaceBuildThemeRecordFromImport($imported);
        $themeId = trim((string)($themeRecord['id'] ?? ''));
        $exists = false;
        foreach ((array)($workspace['themes'] ?? []) as $existingTheme) {
            if (trim((string)($existingTheme['id'] ?? '')) === $themeId) {
                $exists = true;
                break;
            }
        }
        return [
            'theme' => $themeRecord,
            'exists' => $exists,
            'fileCount' => count((array)($themeRecord['files'] ?? [])),
            'warnings' => (array)($themeRecord['warnings'] ?? [])
        ];
    }

    function importThemeWorkspaceGithub(string $sourceInput): array {
        $workspace = readThemeWorkspace();
        $imported = fvplusImportGithubThemeFiles($sourceInput);
        $themeRecord = fvplusThemeWorkspaceBuildThemeRecordFromImport($imported);
        $themeId = trim((string)($themeRecord['id'] ?? ''));
        $themes = [];
        $replaced = false;
        foreach ((array)($workspace['themes'] ?? []) as $existingTheme) {
            $existingId = trim((string)($existingTheme['id'] ?? ''));
            if ($existingId === $themeId) {
                $themes[] = $themeRecord;
                $replaced = true;
                continue;
            }
            $themes[] = $existingTheme;
        }
        if (!$replaced) {
            $themes[] = $themeRecord;
        }
        $workspace['themes'] = $themes;
        if (trim((string)($workspace['activeThemeId'] ?? '')) === '') {
            $workspace['activeThemeId'] = $themeId;
        }
        $saved = writeThemeWorkspace($workspace);
        return [
            'theme' => $themeRecord,
            'workspace' => $saved
        ];
    }

    function activateThemeWorkspaceTheme(string $themeId): array {
        $workspace = readThemeWorkspace();
        $safeThemeId = truncateUtf8String(trim($themeId), 64);
        foreach ((array)($workspace['themes'] ?? []) as $theme) {
            if (trim((string)($theme['id'] ?? '')) === $safeThemeId) {
                $workspace['activeThemeId'] = $safeThemeId;
                return writeThemeWorkspace($workspace);
            }
        }
        throw new RuntimeException('Theme not found.');
    }

    function deactivateThemeWorkspaceTheme(): array {
        $workspace = readThemeWorkspace();
        $workspace['activeThemeId'] = '';
        return writeThemeWorkspace($workspace);
    }

    function deleteThemeWorkspaceTheme(string $themeId): array {
        $workspace = readThemeWorkspace();
        $safeThemeId = truncateUtf8String(trim($themeId), 64);
        $themes = [];
        $deleted = false;
        foreach ((array)($workspace['themes'] ?? []) as $theme) {
            if (trim((string)($theme['id'] ?? '')) === $safeThemeId) {
                $deleted = true;
                continue;
            }
            $themes[] = $theme;
        }
        if (!$deleted) {
            throw new RuntimeException('Theme not found.');
        }
        $workspace['themes'] = $themes;
        if (trim((string)($workspace['activeThemeId'] ?? '')) === $safeThemeId) {
            $workspace['activeThemeId'] = '';
        }
        return writeThemeWorkspace($workspace);
    }

    function saveThemeWorkspaceCustomize($variables, string $customCss): array {
        $workspace = readThemeWorkspace();
        $workspace['variables'] = fvplusThemeWorkspaceNormalizeVariableMap($variables);
        $workspace['customCss'] = truncateUtf8String($customCss, FVPLUS_THEME_WORKSPACE_MAX_CUSTOM_CSS_BYTES);
        return writeThemeWorkspace($workspace);
    }

    function checkThemeWorkspaceUpdates(): array {
        $workspace = readThemeWorkspace();
        $themes = [];
        $checkedAt = gmdate('c');
        $updateCount = 0;
        foreach ((array)($workspace['themes'] ?? []) as $theme) {
            $normalizedTheme = fvplusThemeWorkspaceNormalizeThemeRecord($theme);
            $source = is_array($normalizedTheme['source'] ?? null) ? $normalizedTheme['source'] : [];
            $canCheck = !empty($source['canCheckUpdates']);
            $latestSha = '';
            if ($canCheck) {
                $latestSha = fvplusResolveGithubBranchHeadSha(
                    (string)($source['owner'] ?? ''),
                    (string)($source['repo'] ?? ''),
                    (string)($source['branch'] ?? ($source['defaultBranch'] ?? 'main'))
                );
            }
            $normalizedTheme['lastCheckedAt'] = $checkedAt;
            $normalizedTheme['updateAvailable'] = $latestSha !== '' && $latestSha !== trim((string)($source['commitSha'] ?? ''));
            if ($normalizedTheme['updateAvailable']) {
                $updateCount += 1;
            }
            $themes[] = $normalizedTheme;
        }
        $workspace['themes'] = $themes;
        $workspace['lastCheckedAt'] = $checkedAt;
        $saved = writeThemeWorkspace($workspace);
        return [
            'workspace' => $saved,
            'updateCount' => $updateCount,
            'checkedAt' => $checkedAt
        ];
    }

    function updateThemeWorkspaceTheme(string $themeId): array {
        $workspace = readThemeWorkspace();
        $safeThemeId = truncateUtf8String(trim($themeId), 64);
        if ($safeThemeId === '') {
            throw new RuntimeException('Theme is required.');
        }
        $themes = [];
        $updated = false;
        foreach ((array)($workspace['themes'] ?? []) as $theme) {
            $normalizedTheme = fvplusThemeWorkspaceNormalizeThemeRecord($theme);
            if (trim((string)($normalizedTheme['id'] ?? '')) !== $safeThemeId) {
                $themes[] = $normalizedTheme;
                continue;
            }
            $source = is_array($normalizedTheme['source'] ?? null) ? $normalizedTheme['source'] : [];
            $sourceInput = trim((string)($source['input'] ?? ''));
            if ($sourceInput === '') {
                throw new RuntimeException('Theme does not have a saved GitHub source to update from.');
            }
            $imported = fvplusImportGithubThemeFiles($sourceInput);
            $replacement = fvplusThemeWorkspaceBuildThemeRecordFromImport($imported);
            $replacement['id'] = $safeThemeId;
            $replacement['importedAt'] = (string)($normalizedTheme['importedAt'] ?? gmdate('c'));
            $replacement['lastCheckedAt'] = gmdate('c');
            $replacement['updateAvailable'] = false;
            $themes[] = fvplusThemeWorkspaceNormalizeThemeRecord($replacement);
            $updated = true;
        }
        if (!$updated) {
            throw new RuntimeException('Theme not found.');
        }
        $workspace['themes'] = $themes;
        $workspace['lastCheckedAt'] = gmdate('c');
        return writeThemeWorkspace($workspace);
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

    function resolveFolderEditorRequestedContext(string $type, string $requestedRef): array {
        $safeType = ensureType($type);
        $safeRequestedRef = trim((string)$requestedRef);
        if ($safeRequestedRef === '') {
            return [
                'requestedId' => '',
                'resolvedId' => '',
                'resolvedBy' => '',
                'folder' => null
            ];
        }

        $candidateIds = array_values(array_unique(array_filter([
            $safeRequestedRef,
            urldecode($safeRequestedRef)
        ], static fn($value) => trim((string)$value) !== '')));

        $folders = readRawFolderMap($safeType);

        foreach ($candidateIds as $candidateId) {
            $safeCandidateId = trim((string)$candidateId);
            if ($safeCandidateId !== '' && array_key_exists($safeCandidateId, $folders)) {
                return [
                    'requestedId' => $safeRequestedRef,
                    'resolvedId' => $safeCandidateId,
                    'resolvedBy' => 'key',
                    'folder' => normalizeFolderContentPayload($folders[$safeCandidateId] ?? [])
                ];
            }
        }

        foreach ($candidateIds as $candidateId) {
            $safeCandidateId = trim((string)$candidateId);
            if ($safeCandidateId === '') {
                continue;
            }
            foreach ($folders as $folderId => $folder) {
                $safeFolderId = trim((string)$folderId);
                $folderMetaId = trim((string)($folder['id'] ?? $folder['folderId'] ?? ''));
                if ($safeFolderId === $safeCandidateId || $folderMetaId === $safeCandidateId) {
                    return [
                        'requestedId' => $safeRequestedRef,
                        'resolvedId' => $safeFolderId,
                        'resolvedBy' => 'metadata',
                        'folder' => normalizeFolderContentPayload($folder)
                    ];
                }
            }
        }

        foreach ($candidateIds as $candidateId) {
            $safeCandidateId = trim((string)$candidateId);
            if ($safeCandidateId === '') {
                continue;
            }
            $matches = [];
            foreach ($folders as $folderId => $folder) {
                if (trim((string)($folder['name'] ?? '')) !== $safeCandidateId) {
                    continue;
                }
                $matches[] = [
                    'id' => trim((string)$folderId),
                    'folder' => normalizeFolderContentPayload($folder)
                ];
            }
            if (count($matches) === 1) {
                return [
                    'requestedId' => $safeRequestedRef,
                    'resolvedId' => $matches[0]['id'],
                    'resolvedBy' => 'name',
                    'folder' => $matches[0]['folder']
                ];
            }
        }

        return [
            'requestedId' => $safeRequestedRef,
            'resolvedId' => '',
            'resolvedBy' => '',
            'folder' => null
        ];
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
        writeDurableFileAtomic(getLegacyMigrationMarkerPath($type, $kind), gmdate('c'));
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
        withConfigMutationLock(static function () use ($type, $folders): void {
            $path = getFolderFilePath($type);
            $metadata = readConfigMetadata($type, true);
            $normalized = normalizeFolderMapPayload($folders);
            writeJsonObjectWithLastGood($path, $normalized);
            commitConfigMetadataWrite($type, 'folder', $path, $metadata);
        });
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
        $sortKeysByComparator = function(array $sourceKeys, callable $comparator): array {
            $originalIndex = array_flip($sourceKeys);
            usort($sourceKeys, function($left, $right) use ($comparator, $originalIndex) {
                $compared = $comparator($left, $right);
                if ($compared !== 0) {
                    return $compared;
                }
                return ($originalIndex[$left] ?? 0) <=> ($originalIndex[$right] ?? 0);
            });
            return $sourceKeys;
        };
        $normalizeSortTimestamp = function($value): ?int {
            $raw = trim((string)$value);
            if ($raw === '') {
                return null;
            }
            $parsed = strtotime($raw);
            return $parsed === false ? null : (int)$parsed;
        };
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
            $keys = $sortKeysByComparator($keys, function($a, $b) use ($folders) {
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

        if ($sortMode === 'name_desc') {
            $keys = array_keys($folders);
            $keys = $sortKeysByComparator($keys, function($a, $b) use ($folders) {
                $nameA = strtolower(trim((string)($folders[$a]['name'] ?? $a)));
                $nameB = strtolower(trim((string)($folders[$b]['name'] ?? $b)));
                $cmp = strnatcmp($nameB, $nameA);
                return $cmp !== 0 ? $cmp : strnatcmp((string)$b, (string)$a);
            });
            $ordered = [];
            foreach ($keys as $key) {
                $ordered[$key] = $folders[$key];
            }
            return $applyPinnedOrder($ordered);
        }

        if (in_array($sortMode, ['created_newest', 'created_oldest', 'updated_newest'], true)) {
            $timestampField = $sortMode === 'updated_newest' ? 'updatedAt' : 'createdAt';
            $descending = $sortMode !== 'created_oldest';
            $keys = array_keys($folders);
            $keys = $sortKeysByComparator($keys, function($a, $b) use ($folders, $normalizeSortTimestamp, $timestampField, $descending) {
                $timeA = $normalizeSortTimestamp($folders[$a][$timestampField] ?? '');
                $timeB = $normalizeSortTimestamp($folders[$b][$timestampField] ?? '');
                if ($timeA === null || $timeB === null || $timeA === $timeB) {
                    return 0;
                }
                return $descending ? ($timeB <=> $timeA) : ($timeA <=> $timeB);
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

    function reconcileManualOrderPrefs(array $prefs, array $folders): array {
        if (($prefs['sortMode'] ?? 'created') !== 'manual') {
            return $prefs;
        }
        $order = [];
        foreach ((array)($prefs['manualOrder'] ?? []) as $id) {
            if (array_key_exists($id, $folders)) {
                $order[] = $id;
            }
        }
        foreach (array_keys($folders) as $id) {
            if (!in_array($id, $order, true)) {
                $order[] = $id;
            }
        }
        $prefs['manualOrder'] = $order;
        return $prefs;
    }

    function syncManualOrderWithFolders(string $type, array $folders): void {
        $prefs = readTypePrefs($type);
        $nextPrefs = reconcileManualOrderPrefs($prefs, $folders);
        if ($nextPrefs !== $prefs) {
            writeTypePrefs($type, $nextPrefs);
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
            $traceId = '';
            $transactionId = '';
            $dockerCount = null;
            $vmCount = null;
            if (is_array($decoded)) {
                $reason = (string)($decoded['reason'] ?? '');
                $pluginVersion = (string)($decoded['pluginVersion'] ?? '');
                $traceId = normalizeRequestTraceId((string)($decoded['traceId'] ?? ''));
                $transactionId = normalizeRequestTransactionId((string)($decoded['transactionId'] ?? ''));
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
                'traceId' => $traceId,
                'transactionId' => $transactionId,
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
            'traceId' => getRequestTraceId(),
            'transactionId' => getRequestTransactionId(),
            'types' => [
                'docker' => [
                    'folders' => readRawFolderMap('docker'),
                    'prefs' => readTypePrefs('docker')
                ],
                'vm' => [
                    'folders' => readRawFolderMap('vm'),
                    'prefs' => readTypePrefs('vm')
                ]
            ],
            'themeWorkspace' => readThemeWorkspace()
        ];
        writeJsonObjectAtomic("$rollbackDir/$filename", $payload);
        $pruned = pruneGlobalRollbackSnapshots(FVPLUS_GLOBAL_ROLLBACK_HISTORY_MAX);
        try {
            appendDiagnosticsHistoryEvent('rollback_create', null, [
                'name' => $filename,
                'reason' => $reason,
                'dockerCount' => count($payload['types']['docker']['folders']),
                'vmCount' => count($payload['types']['vm']['folders']),
                'managedThemeCount' => count((array)($payload['themeWorkspace']['themes'] ?? [])),
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
            'managedThemeCount' => count((array)($payload['themeWorkspace']['themes'] ?? [])),
            'traceId' => getRequestTraceId(),
            'transactionId' => getRequestTransactionId(),
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
        if (is_array($decoded['themeWorkspace'] ?? null)) {
            writeThemeWorkspace($decoded['themeWorkspace']);
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

    function backupReasonAllowsEmptySnapshot(string $reason): bool {
        $normalized = strtolower(trim($reason));
        if ($normalized === '') {
            return false;
        }
        return strpos($normalized, 'before-import') === 0
            || strpos($normalized, 'before-restore') === 0
            || strpos($normalized, 'before-template') === 0
            || strpos($normalized, 'transaction-') === 0
            || strpos($normalized, 'rollback') !== false;
    }

    function getBackupPayloadFolderCount($decoded): ?int {
        if (!is_array($decoded)) {
            return null;
        }
        if (isset($decoded['folders']) && is_array($decoded['folders'])) {
            return count($decoded['folders']);
        }
        if (!array_key_exists('schemaVersion', $decoded) && !array_key_exists('type', $decoded) && !array_key_exists('prefs', $decoded)) {
            return count($decoded);
        }
        return null;
    }

    function createBackupSnapshot(string $type, string $reason = 'manual'): array {
        $type = ensureType($type);
        $folders = readRawFolderMap($type);
        $folderCount = count($folders);
        if ($folderCount === 0 && !backupReasonAllowsEmptySnapshot($reason)) {
            try {
                appendDiagnosticsHistoryEvent('backup_skipped', $type, [
                    'reason' => $reason,
                    'folderCount' => 0,
                    'skipReason' => 'empty-folder-map'
                ], 'ok', 'server');
            } catch (Throwable $err) {
                // Keep backup skip reporting non-fatal.
            }
            return [
                'name' => '',
                'createdAt' => gmdate('c'),
                'count' => 0,
                'traceId' => getRequestTraceId(),
                'transactionId' => getRequestTransactionId(),
                'pruned' => [],
                'skipped' => true,
                'skipReason' => 'empty-folder-map'
            ];
        }
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
            'traceId' => getRequestTraceId(),
            'transactionId' => getRequestTransactionId(),
            'configurationMetadata' => readConfigMetadata($type, true),
            'folders' => $folders,
            'prefs' => $prefs
        ];
        writeJsonObjectAtomic("$backupDir/$filename", $payload);
        $pruned = pruneBackupSnapshots($type, getTypeBackupRetention($type));
        try {
            appendDiagnosticsHistoryEvent('backup_create', $type, [
                'reason' => $reason,
                'name' => $filename,
                'folderCount' => $folderCount,
                'prunedCount' => count($pruned)
            ], 'ok', 'server');
        } catch (Throwable $err) {
            // Keep backup creation non-fatal.
        }
        return [
            'name' => $filename,
            'createdAt' => gmdate('c'),
            'count' => $folderCount,
            'traceId' => getRequestTraceId(),
            'transactionId' => getRequestTransactionId(),
            'pruned' => $pruned,
            'skipped' => false
        ];
    }

    function findRecentPrefsBackupSnapshot(string $type, int $windowSeconds): ?array {
        $type = ensureType($type);
        $backupDir = getBackupsDirPath();
        if ($windowSeconds <= 0 || !is_dir($backupDir)) {
            return null;
        }
        $latestPath = '';
        $latestMtime = 0;
        foreach ((array)@scandir($backupDir) as $file) {
            if (!is_string($file) || !preg_match('/^' . preg_quote($type, '/') . '-.*-before-prefs-update\.json$/', $file)) {
                continue;
            }
            $path = "$backupDir/$file";
            $mtime = is_file($path) ? (int)@filemtime($path) : 0;
            if ($mtime > $latestMtime) {
                $latestMtime = $mtime;
                $latestPath = $path;
            }
        }
        if ($latestPath === '' || max(0, time() - $latestMtime) > $windowSeconds) {
            return null;
        }
        $decoded = @json_decode((string)@file_get_contents($latestPath), true);
        return [
            'name' => basename($latestPath),
            'createdAt' => gmdate('c', $latestMtime),
            'size' => (int)@filesize($latestPath),
            'reason' => 'before-prefs-update',
            'count' => getBackupPayloadFolderCount($decoded),
            'traceId' => is_array($decoded) ? normalizeRequestTraceId((string)($decoded['traceId'] ?? '')) : '',
            'transactionId' => is_array($decoded) ? normalizeRequestTransactionId((string)($decoded['transactionId'] ?? '')) : ''
        ];
    }

    function createCoalescedPrefsBackupSnapshot(string $type, int $windowSeconds = 30): array {
        $type = ensureType($type);
        $windowSeconds = max(0, min(120, $windowSeconds));
        $recent = findRecentPrefsBackupSnapshot($type, $windowSeconds);
        if (is_array($recent)) {
            return [
                ...$recent,
                'pruned' => [],
                'skipped' => false,
                'coalesced' => true
            ];
        }
        return [
            ...createBackupSnapshot($type, 'before-prefs-update'),
            'coalesced' => false
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
            $traceId = '';
            $transactionId = '';
            if (is_array($decoded)) {
                $reason = (string)($decoded['reason'] ?? '');
                $count = getBackupPayloadFolderCount($decoded);
                $traceId = normalizeRequestTraceId((string)($decoded['traceId'] ?? ''));
                $transactionId = normalizeRequestTransactionId((string)($decoded['transactionId'] ?? ''));
            }
            $entries[] = [
                'name' => $file,
                'createdAt' => gmdate('c', (int)@filemtime($path)),
                'size' => (int)@filesize($path),
                'reason' => $reason,
                'count' => $count,
                'traceId' => $traceId,
                'transactionId' => $transactionId
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
            'traceId' => normalizeRequestTraceId((string)($decoded['traceId'] ?? '')),
            'transactionId' => normalizeRequestTransactionId((string)($decoded['transactionId'] ?? '')),
            'count' => count($folders),
            'configurationMetadata' => is_array($decoded['configurationMetadata'] ?? null)
                ? normalizeConfigMetadata($decoded['configurationMetadata'], $type)
                : null,
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

    function deleteAllBackupSnapshots(string $type): array {
        $type = ensureType($type);
        $snapshots = listBackupSnapshots($type);
        $deleted = [];
        $failed = [];
        foreach ($snapshots as $snapshot) {
            $name = (string)($snapshot['name'] ?? '');
            if ($name === '') {
                continue;
            }
            try {
                $deleted[] = deleteBackupSnapshot($type, $name);
            } catch (Throwable $err) {
                $failed[] = [
                    'name' => $name,
                    'error' => $err->getMessage()
                ];
            }
        }
        try {
            appendDiagnosticsHistoryEvent('backup_delete_all', $type, [
                'deletedCount' => count($deleted),
                'failedCount' => count($failed)
            ], empty($failed) ? 'ok' : 'warning', 'server');
        } catch (Throwable $err) {
            // Non-fatal.
        }
        return [
            'deletedCount' => count($deleted),
            'failedCount' => count($failed),
            'deleted' => $deleted,
            'failed' => $failed,
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
        foreach ($snapshots as $snapshot) {
            $count = $snapshot['count'] ?? null;
            if ($count !== null && (int)$count <= 0) {
                continue;
            }
            return restoreBackupSnapshot($type, (string)$snapshot['name']);
        }
        throw new RuntimeException('No non-empty backups available.');
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
        writeJsonObjectWithLastGood($path, array_values($rows));
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
        $parsedIni = file_exists($prefsFilePath) ? @parse_ini_file($prefsFilePath) : false;
        $order = array_values($parsedIni ?: []);
        if ($type === 'docker') {
            $folders = readRawFolderMap('docker');
            $orderedFolders = reorderFolderMapByPrefs('docker', $folders);
            $folderIds = array_keys($folders);
            $folderPlaceholders = array_map(function($id) {
                return 'folder-' . (string)$id;
            }, array_keys($orderedFolders));
            $order = array_values(array_filter($order, function($entry) use ($folderIds) {
                $value = trim((string)$entry);
                if (strpos($value, 'folder-') !== 0) {
                    return true;
                }
                $folderId = substr($value, 7);
                return !in_array($folderId, $folderIds, true);
            }));
            foreach ($folderPlaceholders as $placeholder) {
                if (!in_array($placeholder, $order, true)) {
                    $order[] = $placeholder;
                }
            }
        }
        return json_encode($order);
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

    function normalizeDockerUpdatedStateValue($value): ?bool {
        if (is_bool($value)) {
            return $value;
        }
        if (is_int($value) || is_float($value)) {
            $numeric = (int)$value;
            if ($numeric === 1) {
                return true;
            }
            if ($numeric === 0) {
                return false;
            }
            return null;
        }
        if (!is_string($value)) {
            return null;
        }
        $normalized = strtolower(trim($value));
        if ($normalized === '') {
            return null;
        }
        if (in_array($normalized, ['true', '1', 'yes', 'on', 'up-to-date', 'uptodate', 'current'], true)) {
            return true;
        }
        if (in_array($normalized, ['false', '0', 'no', 'off', 'update-ready', 'update ready', 'apply-update', 'apply update', 'update available'], true)) {
            return false;
        }
        return null;
    }

    function readDockerWebuiInfoCache(): array {
        global $dockerManPaths, $documentRoot;
        $cachePath = trim((string)($dockerManPaths['webui-info'] ?? ''));
        if ($cachePath === '') {
            $safeDocroot = rtrim((string)($documentRoot ?? ($_SERVER['DOCUMENT_ROOT'] ?? '/usr/local/emhttp')), '/\\');
            $cachePath = $safeDocroot . '/state/plugins/dynamix.docker.manager/docker.json';
        }
        if ($cachePath === '' || !class_exists('DockerUtil')) {
            return [];
        }
        $cache = DockerUtil::loadJSON($cachePath);
        return is_array($cache) ? $cache : [];
    }

    // Keep FolderView Plus aligned with the native Docker page cache so first paint
    // and hydrated rows read the same update signal.
    function resolveDockerCachedUpdatedStateValue(string $containerName, array $dockerWebuiInfo = []): ?bool {
        $safeName = trim($containerName);
        if ($safeName === '') {
            return null;
        }
        $cachedUpdated = normalizeDockerUpdatedStateValue($dockerWebuiInfo[$safeName]['updated'] ?? null);
        return is_bool($cachedUpdated) ? $cachedUpdated : null;
    }

    function resolveDockerUpdatedStateValue(string $containerName, string $containerImage, array $dockerWebuiInfo = [], $dockerUpdate = null): ?bool {
        $cachedUpdated = resolveDockerCachedUpdatedStateValue($containerName, $dockerWebuiInfo);
        if (is_bool($cachedUpdated)) {
            return $cachedUpdated;
        }
        if ($containerImage === '' || !($dockerUpdate instanceof DockerUpdate)) {
            return null;
        }
        return normalizeDockerUpdatedStateValue($dockerUpdate->getUpdateStatus($containerImage));
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
            return [
                'assignedRule' => $rule,
                'blockedBy' => null
            ];
        }
        return [
            'assignedRule' => null,
            'blockedBy' => null
        ];
    }

    function legacyRegexMigrationLockPath(string $type): string {
        global $configDir;
        $type = ensureType($type);
        if (!is_dir($configDir)) {
            @mkdir($configDir, 0770, true);
        }
        return $configDir . '/' . $type . '-legacy-regex-migration.lock';
    }

    function migrateLegacyRegexToAutoRule(string $type, string $folderId, string $expectedPattern): array {
        $type = ensureType($type);
        $folderId = trim($folderId);
        $expectedPattern = (string)$expectedPattern;
        if ($folderId === '') {
            throw new RuntimeException('Folder ID is required.');
        }
        if ($expectedPattern === '') {
            throw new RuntimeException('Legacy regex pattern is required.');
        }

        $lockHandle = @fopen(legacyRegexMigrationLockPath($type), 'c+');
        if (!is_resource($lockHandle) || !@flock($lockHandle, LOCK_EX)) {
            if (is_resource($lockHandle)) {
                @fclose($lockHandle);
            }
            throw new RuntimeException('Legacy regex conversion is busy. Try again.');
        }

        $result = null;
        try {
            $folders = readRawFolderMap($type);
            if (!array_key_exists($folderId, $folders) || !is_array($folders[$folderId])) {
                throw new RuntimeException('Folder not found.');
            }
            $legacyPattern = (string)($folders[$folderId]['regex'] ?? '');
            if ($legacyPattern === '') {
                throw new RuntimeException('This folder no longer has a legacy regex to convert.');
            }
            if (!hash_equals($legacyPattern, $expectedPattern)) {
                throw new RuntimeException('The legacy regex changed after this editor loaded. Reload and review it before converting.');
            }
            $probe = '/' . str_replace('/', '\\/', $legacyPattern) . '/';
            if (@preg_match($probe, '') === false) {
                throw new RuntimeException('The legacy regex is invalid and cannot be converted.');
            }

            $prefs = readTypePrefs($type);
            $rules = is_array($prefs['autoRules'] ?? null) ? array_values($prefs['autoRules']) : [];
            $existingRule = null;
            foreach ($rules as $rule) {
                if (!is_array($rule)) {
                    continue;
                }
                if (
                    (string)($rule['folderId'] ?? '') === $folderId
                    && normalizeBool($rule['enabled'] ?? true, true) === true
                    && (string)($rule['effect'] ?? 'include') === 'include'
                    && (string)($rule['kind'] ?? 'name_regex') === 'name_regex'
                    && (string)($rule['pattern'] ?? '') === $legacyPattern
                ) {
                    $existingRule = $rule;
                    break;
                }
            }

            $created = false;
            if ($existingRule === null) {
                $existingRule = [
                    'id' => 'rule-' . gmdate('YmdHis') . '-' . generateId(8),
                    'enabled' => true,
                    'folderId' => $folderId,
                    'effect' => 'include',
                    'kind' => 'name_regex',
                    'pattern' => $legacyPattern,
                    'labelKey' => '',
                    'labelValue' => ''
                ];
                // Converted legacy matching is a fallback. Existing advanced policy keeps priority.
                $rules[] = $existingRule;
                $created = true;
            }

            $nextPrefs = normalizeTypePrefs(array_merge($prefs, ['autoRules' => $rules]));
            $nextFolders = $folders;
            $nextFolders[$folderId]['regex'] = '';
            $backup = createBackupSnapshot($type, 'before-legacy-regex-conversion');

            try {
                $savedPrefs = writeTypePrefs($type, $nextPrefs);
                writeRawFolderMap($type, $nextFolders);
            } catch (Throwable $writeError) {
                try {
                    writeTypePrefs($type, $prefs);
                    writeRawFolderMap($type, $folders);
                } catch (Throwable $rollbackError) {
                    throw new RuntimeException(
                        'Legacy regex conversion failed and rollback also failed: ' . $rollbackError->getMessage(),
                        0,
                        $writeError
                    );
                }
                throw new RuntimeException('Legacy regex conversion failed; original data was restored.', 0, $writeError);
            }

            $result = [
                'type' => $type,
                'folderId' => $folderId,
                'pattern' => $legacyPattern,
                'created' => $created,
                'rule' => $existingRule,
                'prefs' => $savedPrefs,
                'folder' => $nextFolders[$folderId],
                'backup' => $backup
            ];
        } finally {
            @flock($lockHandle, LOCK_UN);
            @fclose($lockHandle);
        }

        if (!is_array($result)) {
            throw new RuntimeException('Legacy regex conversion did not complete.');
        }
        try {
            syncManualOrderWithFolders($type, readRawFolderMap($type));
            if ($type === 'docker') {
                syncContainerOrder('docker');
            }
        } catch (Throwable $error) {
            // The conversion is already committed; a later refresh can safely reconcile order.
        }
        try {
            appendDiagnosticsHistoryEvent('legacy_regex_conversion', $type, [
                'traceId' => getRequestTraceId(),
                'folderId' => $folderId,
                'ruleId' => (string)($result['rule']['id'] ?? ''),
                'created' => (bool)($result['created'] ?? false),
                'backupCreated' => is_array($result['backup'] ?? null)
            ], 'ok', 'server');
        } catch (Throwable $error) {
            // Diagnostics are non-fatal after the transactional conversion succeeds.
        }
        return $result;
    }

    function bulkAssignItemsToFolders(string $type, array $assignments): array {
        $type = ensureType($type);
        if (count($assignments) <= 0) {
            throw new RuntimeException('At least one folder assignment is required.');
        }
        if (count($assignments) > FVPLUS_MAX_FOLDER_BATCH_OPERATIONS) {
            throw new RuntimeException('Bulk assignment exceeds the maximum target folder count.');
        }

        $validSet = array_fill_keys(array_keys(readInfo($type)), true);
        $normalizedByFolder = [];
        $skippedByFolder = [];
        $targetByItem = [];
        $requestedItemCount = 0;
        foreach ($assignments as $assignment) {
            if (!is_array($assignment)) {
                throw new RuntimeException('Bulk assignment entries must be objects.');
            }
            $folderId = trim((string)($assignment['folderId'] ?? ''));
            $items = $assignment['items'] ?? null;
            if ($folderId === '' || strlen($folderId) > 128) {
                throw new RuntimeException('Bulk assignment contains an invalid folder ID.');
            }
            if (!is_array($items)) {
                throw new RuntimeException('Bulk assignment items must be an array.');
            }
            if (!array_key_exists($folderId, $normalizedByFolder)) {
                $normalizedByFolder[$folderId] = [];
                $skippedByFolder[$folderId] = [];
            }
            foreach ($items as $item) {
                $name = trim((string)$item);
                if ($name === '' || isset($normalizedByFolder[$folderId][$name])) {
                    continue;
                }
                $requestedItemCount++;
                if ($requestedItemCount > FVPLUS_MAX_BULK_ASSIGN_BATCH_ITEMS) {
                    throw new RuntimeException('Bulk assignment exceeds the maximum item count.');
                }
                $invalid = preg_match('/[\x00-\x1F\x7F]/u', $name) === 1;
                if (!$invalid && !isset($validSet[$name])) {
                    $len = strlen($name);
                    $invalid = $len < 1 || $len > 255;
                }
                if ($invalid) {
                    $skippedByFolder[$folderId][] = $name;
                    continue;
                }
                $existingTarget = (string)($targetByItem[$name] ?? '');
                if ($existingTarget !== '' && $existingTarget !== $folderId) {
                    throw new RuntimeException("Bulk assignment item '$name' targets more than one folder.");
                }
                $targetByItem[$name] = $folderId;
                $normalizedByFolder[$folderId][$name] = true;
            }
        }

        return withConfigMutationLock(static function () use ($type, $normalizedByFolder, $skippedByFolder, $targetByItem): array {
            $startedAt = microtime(true);
            $originalFolders = readRawFolderMap($type);
            foreach (array_keys($normalizedByFolder) as $folderId) {
                if (!array_key_exists($folderId, $originalFolders)) {
                    throw new RuntimeException("Bulk assignment target folder '$folderId' was not found.");
                }
            }

            $nextFolders = $originalFolders;
            $removedFrom = [];
            $changedFolderIds = [];
            if (count($targetByItem) > 0) {
                foreach ($nextFolders as $id => &$folder) {
                    $members = normalizeFolderMembers($folder['containers'] ?? []);
                    $nextMembers = [];
                    foreach ($members as $member) {
                        if (isset($targetByItem[$member])) {
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

                foreach ($normalizedByFolder as $folderId => $requested) {
                    $targetMembers = normalizeFolderMembers($nextFolders[$folderId]['containers'] ?? []);
                    foreach (array_keys($requested) as $name) {
                        if (!in_array($name, $targetMembers, true)) {
                            $targetMembers[] = $name;
                        }
                    }
                    $nextFolders[$folderId]['containers'] = $targetMembers;
                }

                foreach ($nextFolders as $folderId => $folder) {
                    $beforeMembers = normalizeFolderMembers($originalFolders[$folderId]['containers'] ?? []);
                    $afterMembers = normalizeFolderMembers($folder['containers'] ?? []);
                    if ($beforeMembers !== $afterMembers) {
                        $changedFolderIds[] = $folderId;
                    }
                }
            }

            $folderWriteCommitted = false;
            if (count($changedFolderIds) > 0) {
                try {
                    writeRawFolderMap($type, $nextFolders);
                    $folderWriteCommitted = true;
                    if ($type === 'docker') {
                        syncContainerOrder('docker');
                    }
                } catch (Throwable $error) {
                    $rollbackErrors = [];
                    if ($folderWriteCommitted) {
                        try {
                            writeRawFolderMap($type, $originalFolders);
                        } catch (Throwable $rollbackError) {
                            $rollbackErrors[] = 'folders: ' . $rollbackError->getMessage();
                        }
                        if ($type === 'docker') {
                            try {
                                syncContainerOrder('docker');
                            } catch (Throwable $rollbackError) {
                                $rollbackErrors[] = 'Docker order: ' . $rollbackError->getMessage();
                            }
                        }
                    }
                    $rollbackDetail = count($rollbackErrors) > 0
                        ? ' Automatic rollback had errors (' . implode('; ', $rollbackErrors) . ').'
                        : ($folderWriteCommitted ? ' Automatic rollback restored the original configuration.' : ' No configuration write was committed.');
                    throw new RuntimeException('Bulk assignment transaction failed: ' . $error->getMessage() . $rollbackDetail, 0, $error);
                }
            }

            $results = [];
            $assignedCount = 0;
            $skippedInvalidCount = 0;
            foreach ($normalizedByFolder as $folderId => $requested) {
                $assigned = array_keys($requested);
                $skippedInvalid = array_values($skippedByFolder[$folderId] ?? []);
                $assignedCount += count($assigned);
                $skippedInvalidCount += count($skippedInvalid);
                $removedForTarget = [];
                foreach ($assigned as $name) {
                    if (isset($removedFrom[$name])) {
                        $removedForTarget[$name] = $removedFrom[$name];
                    }
                }
                $results[] = [
                    'folderId' => $folderId,
                    'assigned' => $assigned,
                    'removedFrom' => $removedForTarget,
                    'count' => count($assigned),
                    'skippedInvalid' => $skippedInvalid
                ];
            }

            $durationMs = (int)round((microtime(true) - $startedAt) * 1000);
            try {
                appendDiagnosticsHistoryEvent('folder_batch_assignment', $type, [
                    'targetFolderCount' => count($normalizedByFolder),
                    'assignedCount' => $assignedCount,
                    'skippedInvalidCount' => $skippedInvalidCount,
                    'changedFolderCount' => count($changedFolderIds),
                    'durationMs' => $durationMs,
                    'sourceScript' => basename((string)($_SERVER['SCRIPT_NAME'] ?? ''))
                ], 'ok', 'server');
            } catch (Throwable $error) {
                // Keep the committed assignment successful if diagnostics logging fails.
            }

            return [
                'type' => $type,
                'results' => $results,
                'assignedCount' => $assignedCount,
                'skippedInvalidCount' => $skippedInvalidCount,
                'changedFolderIds' => $changedFolderIds,
                'changedFolderCount' => count($changedFolderIds),
                'dockerOrderSynced' => $type === 'docker' && count($changedFolderIds) > 0,
                'durationMs' => $durationMs,
                'metadata' => readConfigMetadata($type, false)
            ];
        });
    }

    function bulkAssignItemsToFolder(string $type, string $folderId, array $items): array {
        $type = ensureType($type);
        $folderId = trim($folderId);
        $batch = bulkAssignItemsToFolders($type, [[
            'folderId' => $folderId,
            'items' => $items
        ]]);
        $result = is_array($batch['results'][0] ?? null) ? $batch['results'][0] : [];
        return [
            'type' => $type,
            'folderId' => $folderId,
            'assigned' => array_values((array)($result['assigned'] ?? [])),
            'removedFrom' => (array)($result['removedFrom'] ?? []),
            'count' => (int)($result['count'] ?? 0),
            'skippedInvalid' => array_values((array)($result['skippedInvalid'] ?? [])),
            'changedFolderIds' => array_values((array)($batch['changedFolderIds'] ?? [])),
            'durationMs' => (int)($batch['durationMs'] ?? 0),
            'metadata' => (array)($batch['metadata'] ?? [])
        ];
    }

    function dockerSyncOrderLockPath(): string {
        global $configDir;
        if (!is_dir($configDir)) {
            @mkdir($configDir, 0770, true);
        }
        return $configDir . '/docker-sync-order.lock';
    }

    function dockerSyncOrderPendingPath(): string {
        global $configDir;
        if (!is_dir($configDir)) {
            @mkdir($configDir, 0770, true);
        }
        return $configDir . '/docker-sync-order.pending';
    }

    function markDockerSyncOrderPending(): void {
        @file_put_contents(dockerSyncOrderPendingPath(), (string)microtime(true));
    }

    function clearDockerSyncOrderPending(): void {
        $pendingPath = dockerSyncOrderPendingPath();
        if (file_exists($pendingPath)) {
            @unlink($pendingPath);
        }
    }

    function hasDockerSyncOrderPending(): bool {
        return file_exists(dockerSyncOrderPendingPath());
    }

    function fvplus_append_unique_name(array &$list, array &$seen, string $name): void {
        $name = trim($name);
        if ($name === '' || isset($seen[$name])) {
            return;
        }
        $list[] = $name;
        $seen[$name] = true;
    }

    function fvplus_set_autostart_line_delay(string $line, int $delay): string {
        $parts = preg_split('/\s+/', trim($line), 2);
        $name = (string)($parts[0] ?? '');
        if ($name === '') {
            return trim($line);
        }
        return $delay > 0 ? $name . ' ' . $delay : $name;
    }

    function buildDockerStartOrderContext(): array {
        global $configDir;

        // userprefs.cfg is not written here; Unraid owns drag-order persistence.
        $prefsFile = "/boot/config/plugins/dockerMan/userprefs.cfg";
        $currentPrefs = file_exists($prefsFile) ? @parse_ini_file($prefsFile) : false;
        $currentOrder = $currentPrefs ? array_values($currentPrefs) : [];

        $foldersFile = "$configDir/docker.json";
        $folders = file_exists($foldersFile) ? (json_decode(file_get_contents($foldersFile), true) ?: []) : [];

        $dockerClient = new DockerClient();
        $allContainerNames = [];
        foreach ((array)$dockerClient->getDockerContainers() as $containerMeta) {
            $name = trim((string)($containerMeta['Name'] ?? ''));
            if ($name === '' || in_array($name, $allContainerNames, true)) {
                continue;
            }
            $allContainerNames[] = $name;
        }
        $prefs = readTypePrefs('docker');
        $rules = is_array($prefs['autoRules'] ?? null) ? $prefs['autoRules'] : [];
        $infoByName = readInfoState('docker');
        if (count($allContainerNames) <= 0) {
            $allContainerNames = array_keys($infoByName);
        }

        $ruleTargetByName = [];
        $labelTargetByName = [];
        foreach ($allContainerNames as $name) {
            $decision = autoRuleDecision($rules, $name, $infoByName, 'docker');
            $assignedRule = is_array($decision['assignedRule'] ?? null) ? $decision['assignedRule'] : null;
            $ruleTargetByName[$name] = $assignedRule ? (string)($assignedRule['folderId'] ?? '') : '';
            $labels = dockerInfoLabelsForName($infoByName, $name);
            $labelTargetByName[$name] = getFolderLabelValueFromLabels($labels);
        }

        $orderedFolders = reorderFolderMapByPrefs('docker', $folders);
        $folderContainers = [];
        $folderNames = [];
        $assignedContainers = [];
        foreach ($orderedFolders as $folderId => $folder) {
            $members = normalizeFolderMembers($folder['containers'] ?? []);
            if (!empty($folder['regex'])) {
                $regex = '/' . str_replace('/', '\/', $folder['regex']) . '/';
                foreach ($allContainerNames as $name) {
                    if (@preg_match($regex, $name) && !in_array($name, $members, true)) {
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
                return in_array($m, $allContainerNames, true) && !in_array($m, $assignedContainers, true);
            }));
            $placeholder = "folder-$folderId";
            $folderContainers[$placeholder] = $members;
            $folderNames[$placeholder] = $folderName !== '' ? $folderName : $placeholder;
            $assignedContainers = array_merge($assignedContainers, $members);
        }

        $dockerManPaths = @parse_ini_file('/boot/config/plugins/dockerMan/dockerMan.cfg') ?: [];
        $autoStartFile = $dockerManPaths['autostart-file'] ?? "/var/lib/docker/unraid-autostart";
        $autoStartLines = file_exists($autoStartFile)
            ? (@file($autoStartFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [])
            : [];
        $autoStartMap = [];
        $staleAutostart = [];
        foreach ($autoStartLines as $line) {
            $parts = preg_split('/\s+/', trim((string)$line), 2);
            $name = (string)($parts[0] ?? '');
            if ($name === '') {
                continue;
            }
            if (!in_array($name, $allContainerNames, true)) {
                $staleAutostart[] = $name;
                continue;
            }
            $autoStartMap[$name] = trim((string)$line);
        }

        return [
            'prefs' => $prefs,
            'currentPrefs' => $currentPrefs,
            'currentOrder' => $currentOrder,
            'folders' => $folders,
            'orderedFolders' => $orderedFolders,
            'folderContainers' => $folderContainers,
            'folderNames' => $folderNames,
            'assignedContainers' => array_values(array_unique($assignedContainers)),
            'allContainerNames' => array_values($allContainerNames),
            'autoStartFile' => $autoStartFile,
            'autoStartMap' => $autoStartMap,
            'staleAutostart' => $staleAutostart
        ];
    }

    function buildDockerPageStartOrder(array $context): array {
        $allContainerNames = (array)($context['allContainerNames'] ?? []);
        $folderContainers = (array)($context['folderContainers'] ?? []);
        $folderPlaceholders = array_keys($folderContainers);
        $assignedContainers = (array)($context['assignedContainers'] ?? []);
        $currentOrder = (array)($context['currentOrder'] ?? []);
        $currentPrefs = $context['currentPrefs'] ?? false;

        if (!$currentPrefs) {
            $currentOrder = array_values($allContainerNames);
            natcasesort($currentOrder);
            $currentOrder = array_values($currentOrder);
        }

        $newOrder = [];
        $seen = [];
        foreach ($currentOrder as $item) {
            $item = trim((string)$item);
            if ($item === '') {
                continue;
            }
            if (in_array($item, $folderPlaceholders, true)) {
                foreach ((array)($folderContainers[$item] ?? []) as $ct) {
                    fvplus_append_unique_name($newOrder, $seen, (string)$ct);
                }
                continue;
            }
            if (in_array($item, $assignedContainers, true)) {
                continue;
            }
            if (in_array($item, $allContainerNames, true)) {
                fvplus_append_unique_name($newOrder, $seen, $item);
            }
        }

        foreach ($allContainerNames as $name) {
            if (!in_array($name, $assignedContainers, true)) {
                fvplus_append_unique_name($newOrder, $seen, (string)$name);
            }
        }

        foreach ($folderPlaceholders as $placeholder) {
            foreach ((array)($folderContainers[$placeholder] ?? []) as $ct) {
                fvplus_append_unique_name($newOrder, $seen, (string)$ct);
            }
        }

        return $newOrder;
    }

    function buildDockerCustomStartOrder(array $context, array $plan): array {
        $allContainerNames = (array)($context['allContainerNames'] ?? []);
        $folderContainers = (array)($context['folderContainers'] ?? []);
        $autoStartMap = (array)($context['autoStartMap'] ?? []);
        $pageOrder = buildDockerPageStartOrder($context);
        $plannedOrder = [];
        $seen = [];
        $batchesOut = [];
        $warnings = [];

        foreach ((array)($plan['batches'] ?? []) as $batch) {
            if (!is_array($batch)) {
                continue;
            }
            $batchNames = [];
            foreach ((array)($batch['items'] ?? []) as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $type = (string)($item['type'] ?? 'container');
                if ($type === 'folder') {
                    $placeholder = 'folder-' . trim((string)($item['id'] ?? ''));
                    if (!array_key_exists($placeholder, $folderContainers)) {
                        $warnings[] = 'Folder in start plan no longer exists: ' . $placeholder;
                        continue;
                    }
                    foreach ((array)$folderContainers[$placeholder] as $ct) {
                        $batchNames[] = (string)$ct;
                    }
                    continue;
                }
                $name = trim((string)($item['name'] ?? ''));
                if ($name === '') {
                    continue;
                }
                if (!in_array($name, $allContainerNames, true)) {
                    $warnings[] = 'Container in start plan no longer exists: ' . $name;
                    continue;
                }
                $batchNames[] = $name;
            }

            $batchAutostartNames = [];
            $seenBatch = [];
            foreach ($batchNames as $name) {
                if (!isset($autoStartMap[$name])) {
                    $warnings[] = $name . ' is in the start plan but Docker autostart is off.';
                    continue;
                }
                fvplus_append_unique_name($plannedOrder, $seen, $name);
                fvplus_append_unique_name($batchAutostartNames, $seenBatch, $name);
            }
            $batchesOut[] = [
                'id' => (string)($batch['id'] ?? ''),
                'name' => (string)($batch['name'] ?? 'Start batch'),
                'delay' => (int)($batch['delay'] ?? 0),
                'parallel' => (bool)($batch['parallel'] ?? false),
                'containers' => $batchAutostartNames
            ];
        }

        $remaining = strtolower(trim((string)($plan['remaining'] ?? 'after')));
        $remainingOrder = [];
        $remainingSeen = [];
        if ($remaining === 'keep') {
            foreach (array_keys($autoStartMap) as $name) {
                if (!isset($seen[$name])) {
                    fvplus_append_unique_name($remainingOrder, $remainingSeen, (string)$name);
                }
            }
        } else {
            foreach ($pageOrder as $name) {
                if (isset($autoStartMap[$name]) && !isset($seen[$name])) {
                    fvplus_append_unique_name($remainingOrder, $remainingSeen, (string)$name);
                }
            }
        }

        $ordered = $remaining === 'before'
            ? array_values(array_merge($remainingOrder, $plannedOrder))
            : array_values(array_merge($plannedOrder, $remainingOrder));

        return [
            'order' => $ordered,
            'batches' => $batchesOut,
            'warnings' => array_values(array_unique($warnings)),
            'remaining' => $remainingOrder
        ];
    }

    function buildDockerStartOrderPlan(array $context = null): array {
        $context = $context ?? buildDockerStartOrderContext();
        $prefs = is_array($context['prefs'] ?? null) ? $context['prefs'] : readTypePrefs('docker');
        $plan = normalizeDockerStartOrderPrefs($prefs['dockerStartOrder'] ?? []);
        $autoStartMap = (array)($context['autoStartMap'] ?? []);
        $mode = (string)($plan['mode'] ?? 'docker-page');
        $warnings = [];
        $batches = [];
        $remaining = [];

        if ($mode === 'custom-batches') {
            $custom = buildDockerCustomStartOrder($context, $plan);
            $order = (array)($custom['order'] ?? []);
            $warnings = (array)($custom['warnings'] ?? []);
            $batches = (array)($custom['batches'] ?? []);
            $remaining = (array)($custom['remaining'] ?? []);
        } else {
            $order = buildDockerPageStartOrder($context);
        }

        $autoStartOrder = [];
        foreach ($order as $name) {
            if (isset($autoStartMap[$name])) {
                $autoStartOrder[] = $name;
            }
        }
        foreach (array_keys($autoStartMap) as $name) {
            if (!in_array($name, $autoStartOrder, true)) {
                $autoStartOrder[] = $name;
            }
        }

        return [
            'mode' => $mode,
            'remainingMode' => (string)($plan['remaining'] ?? 'after'),
            'order' => array_values($order),
            'autostartOrder' => $autoStartOrder,
            'batches' => $batches,
            'remaining' => $remaining,
            'warnings' => array_values(array_unique($warnings)),
            'autostartCount' => count($autoStartMap),
            'containerCount' => count((array)($context['allContainerNames'] ?? [])),
            'staleAutostart' => (array)($context['staleAutostart'] ?? [])
        ];
    }

    function dockerStartOrderPreview(): array {
        $context = buildDockerStartOrderContext();
        return buildDockerStartOrderPlan($context);
    }

    function syncContainerOrderUnlocked(): void {
        // Rewrites the autostart file to match the configured FolderView Plus start order.
        // Docker userprefs.cfg is owned by Unraid and is only read here.
        $context = buildDockerStartOrderContext();
        $plan = buildDockerStartOrderPlan($context);
        // userprefs.cfg is not written here; Unraid owns drag-order persistence.
        $autoStartFile = (string)($context['autoStartFile'] ?? "/var/lib/docker/unraid-autostart");
        if (file_exists($autoStartFile)) {
            $autoStartMap = (array)($context['autoStartMap'] ?? []);
            $newAutoStart = [];
            foreach ((array)($plan['autostartOrder'] ?? []) as $name) {
                if (isset($autoStartMap[$name])) {
                    $newAutoStart[] = $autoStartMap[$name];
                    unset($autoStartMap[$name]);
                }
            }
            foreach ($autoStartMap as $line) {
                $newAutoStart[] = $line;
            }
            if (($plan['mode'] ?? '') === 'custom-batches') {
                $lineIndexByName = [];
                foreach ($newAutoStart as $index => $line) {
                    $parts = preg_split('/\s+/', trim((string)$line), 2);
                    $lineIndexByName[(string)($parts[0] ?? '')] = $index;
                }
                foreach ((array)($plan['batches'] ?? []) as $batch) {
                    $containers = (array)($batch['containers'] ?? []);
                    $delay = (int)($batch['delay'] ?? 0);
                    if ($delay <= 0 || count($containers) <= 0) {
                        continue;
                    }
                    $last = (string)end($containers);
                    if (isset($lineIndexByName[$last])) {
                        $idx = $lineIndexByName[$last];
                        $newAutoStart[$idx] = fvplus_set_autostart_line_delay((string)$newAutoStart[$idx], $delay);
                    }
                }
            }
            $nextAutoStartContent = count($newAutoStart) > 0
                ? implode("\n", $newAutoStart) . "\n"
                : '';
            $currentAutoStartContent = @file_get_contents($autoStartFile);
            if ((string)$currentAutoStartContent !== $nextAutoStartContent) {
                writeDurableFileAtomic($autoStartFile, $nextAutoStartContent);
                fv3_debug_log("syncContainerOrder: wrote autostart file with " . count($newAutoStart) . " entries using " . (string)($plan['mode'] ?? 'docker-page') . " mode");
            } else {
                fv3_debug_log("syncContainerOrder: autostart file already up to date");
            }
        }
    }

    function syncContainerOrder(string $type): void {
        fv3_debug_log("syncContainerOrder called for type: $type");

        if ($type !== 'docker') { return; }

        $lockHandle = @fopen(dockerSyncOrderLockPath(), 'c+');
        if (!is_resource($lockHandle)) {
            fv3_debug_log('syncContainerOrder: unable to open lock file, falling back to unlocked run');
            syncContainerOrderUnlocked();
            return;
        }

        if (!@flock($lockHandle, LOCK_EX | LOCK_NB)) {
            markDockerSyncOrderPending();
            fv3_debug_log('syncContainerOrder: coalesced while another sync is already running');
            @fclose($lockHandle);
            return;
        }

        try {
            $attempt = 0;
            do {
                $attempt++;
                clearDockerSyncOrderPending();
                $startedAt = microtime(true);
                syncContainerOrderUnlocked();
                $durationMs = (int)round((microtime(true) - $startedAt) * 1000);
                $shouldRerun = hasDockerSyncOrderPending();
                fv3_debug_log("syncContainerOrder: pass $attempt completed in {$durationMs}ms" . ($shouldRerun ? ' (pending rerun requested)' : ''));
            } while ($shouldRerun && $attempt < 3);
        } finally {
            @flock($lockHandle, LOCK_UN);
            @fclose($lockHandle);
        }
    }

    function updateFolder(string $type, string $content, string $id = '', $expectedRevision = '') : array {
        $type = ensureType($type);
        if (strlen($content) > FVPLUS_MAX_FOLDER_CONTENT_RAW_BYTES) {
            throw new RuntimeException('Folder payload exceeds raw upload limit.');
        }
        $isCreate = empty($id);
        if (!$isCreate) {
            assertExpectedConfigRevision($type, 'folder', $expectedRevision);
        }
        if (empty($id)) {
            $id = generateId();
        }
        $fileData = readRawFolderMap($type);
        $decodedContent = json_decode($content, true);
        if (!is_array($decodedContent)) {
            throw new RuntimeException('Invalid folder payload.');
        }
        fvplus_assert_folder_payload_shape($decodedContent);
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
        return readConfigMetadata($type, false);
    }

    function applyFolderBatchOperations(string $type, array $operations, $expectedRevision = ''): array {
        $type = ensureType($type);
        $deletes = $operations['deletes'] ?? [];
        $upserts = $operations['upserts'] ?? [];
        $creates = $operations['creates'] ?? [];
        if (!is_array($deletes) || !is_array($upserts) || !is_array($creates)) {
            throw new RuntimeException('Batch operations must contain delete, update, and create arrays.');
        }
        $operationCount = count($deletes) + count($upserts) + count($creates);
        if ($operationCount <= 0) {
            throw new RuntimeException('No folder operations were provided.');
        }
        if ($operationCount > FVPLUS_MAX_FOLDER_BATCH_OPERATIONS) {
            throw new RuntimeException('Folder batch exceeds the maximum operation count.');
        }

        $normalizedDeletes = [];
        foreach ($deletes as $rawId) {
            $id = trim((string)$rawId);
            if ($id === '' || strlen($id) > 128) {
                throw new RuntimeException('Batch delete contains an invalid folder ID.');
            }
            $normalizedDeletes[] = $id;
        }

        $normalizeBatchFolder = static function ($rawEntry, bool $requiresId): array {
            if (!is_array($rawEntry)) {
                throw new RuntimeException('Batch folder operation must be an object.');
            }
            $id = $requiresId ? trim((string)($rawEntry['id'] ?? '')) : '';
            if ($requiresId && ($id === '' || strlen($id) > 128)) {
                throw new RuntimeException('Batch update contains an invalid folder ID.');
            }
            $folder = $rawEntry['folder'] ?? null;
            if (!is_array($folder)) {
                throw new RuntimeException('Batch folder operation is missing a valid folder payload.');
            }
            fvplus_assert_folder_payload_shape($folder);
            $rawPreview = json_encode($folder, JSON_UNESCAPED_SLASHES);
            if (!is_string($rawPreview) || strlen($rawPreview) > FVPLUS_MAX_FOLDER_CONTENT_RAW_BYTES) {
                throw new RuntimeException('Batch folder payload exceeds the raw upload limit.');
            }
            $normalized = normalizeFolderContentPayload($folder);
            $normalizedPreview = json_encode($normalized, JSON_UNESCAPED_SLASHES);
            if (!is_string($normalizedPreview) || strlen($normalizedPreview) > FVPLUS_MAX_FOLDER_CONTENT_BYTES) {
                throw new RuntimeException('Batch folder payload is too large after normalization.');
            }
            return [
                'id' => $id,
                'folder' => $normalized
            ];
        };

        $normalizedUpserts = [];
        foreach ($upserts as $entry) {
            $normalizedUpserts[] = $normalizeBatchFolder($entry, true);
        }
        $normalizedCreates = [];
        foreach ($creates as $entry) {
            $normalizedCreates[] = $normalizeBatchFolder($entry, false);
        }

        return withConfigMutationLock(static function () use (
            $type,
            $normalizedDeletes,
            $normalizedUpserts,
            $normalizedCreates,
            $operationCount,
            $expectedRevision
        ): array {
            $startedAt = microtime(true);
            assertExpectedConfigRevision($type, 'folder', $expectedRevision);
            $originalFolders = readRawFolderMap($type);
            $originalPrefs = readTypePrefs($type);
            $nextFolders = $originalFolders;
            $deletedIds = [];
            $updatedIds = [];
            $createdIds = [];
            $now = gmdate('c');

            foreach ($normalizedDeletes as $id) {
                if (!array_key_exists($id, $nextFolders)) {
                    continue;
                }
                $deletedParentId = normalizeFolderParentIdValue($nextFolders[$id]['parentId'] ?? '');
                unset($nextFolders[$id]);
                foreach ($nextFolders as &$folder) {
                    if (!is_array($folder)) {
                        continue;
                    }
                    $parentId = normalizeFolderParentIdValue($folder['parentId'] ?? ($folder['parent_id'] ?? ''));
                    if ($parentId === $id) {
                        $folder['parentId'] = $deletedParentId;
                    }
                }
                unset($folder);
                $deletedIds[] = $id;
            }

            foreach ($normalizedUpserts as $entry) {
                $id = (string)$entry['id'];
                $nextFolder = (array)$entry['folder'];
                $existingFolder = is_array($nextFolders[$id] ?? null)
                    ? normalizeFolderContentPayload((array)$nextFolders[$id])
                    : null;
                $createdAt = normalizeIsoTimestamp($nextFolder['createdAt'] ?? '');
                if (is_array($existingFolder)) {
                    $existingCreatedAt = normalizeIsoTimestamp($existingFolder['createdAt'] ?? '');
                    if ($existingCreatedAt !== '') {
                        $createdAt = $existingCreatedAt;
                    }
                }
                if ($createdAt === '') {
                    $createdAt = $now;
                }
                $nextFolder['createdAt'] = $createdAt;
                $nextFolder['updatedAt'] = $now;
                $nextFolders[$id] = $nextFolder;
                $updatedIds[] = $id;
            }

            foreach ($normalizedCreates as $entry) {
                do {
                    $id = generateId();
                } while (array_key_exists($id, $nextFolders));
                $nextFolder = (array)$entry['folder'];
                $createdAt = normalizeIsoTimestamp($nextFolder['createdAt'] ?? '');
                $nextFolder['createdAt'] = $createdAt !== '' ? $createdAt : $now;
                $nextFolder['updatedAt'] = $now;
                $nextFolders[$id] = $nextFolder;
                $createdIds[] = $id;
            }

            $nextFolders = normalizeFolderParentLinks($nextFolders);
            $nextPrefs = reconcileManualOrderPrefs($originalPrefs, $nextFolders);
            $folderWriteCommitted = false;
            $prefsWriteCommitted = false;
            try {
                writeRawFolderMap($type, $nextFolders);
                $folderWriteCommitted = true;
                if ($nextPrefs !== $originalPrefs) {
                    writeTypePrefs($type, $nextPrefs);
                    $prefsWriteCommitted = true;
                }
                if ($type === 'docker') {
                    syncContainerOrder($type);
                }
            } catch (Throwable $error) {
                $rollbackErrors = [];
                if ($folderWriteCommitted) {
                    try {
                        writeRawFolderMap($type, $originalFolders);
                    } catch (Throwable $rollbackError) {
                        $rollbackErrors[] = 'folders: ' . $rollbackError->getMessage();
                    }
                    if ($prefsWriteCommitted) {
                        try {
                            writeTypePrefs($type, $originalPrefs);
                        } catch (Throwable $rollbackError) {
                            $rollbackErrors[] = 'preferences: ' . $rollbackError->getMessage();
                        }
                    }
                    if ($type === 'docker') {
                        try {
                            syncContainerOrder($type);
                        } catch (Throwable $rollbackError) {
                            $rollbackErrors[] = 'Docker order: ' . $rollbackError->getMessage();
                        }
                    }
                }
                $rollbackDetail = count($rollbackErrors) > 0
                    ? ' Automatic rollback had errors (' . implode('; ', $rollbackErrors) . ').'
                    : ($folderWriteCommitted ? ' Automatic rollback restored the original configuration.' : ' No configuration write was committed.');
                throw new RuntimeException('Folder batch transaction failed: ' . $error->getMessage() . $rollbackDetail, 0, $error);
            }

            $durationMs = (int)round((microtime(true) - $startedAt) * 1000);
            try {
                appendDiagnosticsHistoryEvent('folder_batch_mutation', $type, [
                    'requestedCount' => $operationCount,
                    'deletedCount' => count($deletedIds),
                    'updatedCount' => count($updatedIds),
                    'createdCount' => count($createdIds),
                    'folderCount' => count($nextFolders),
                    'durationMs' => $durationMs,
                    'sourceScript' => basename((string)($_SERVER['SCRIPT_NAME'] ?? ''))
                ], 'ok', 'server');
            } catch (Throwable $err) {
                // Keep the committed transaction successful if diagnostics logging fails.
            }

            return [
                'requestedCount' => $operationCount,
                'deletedIds' => $deletedIds,
                'updatedIds' => $updatedIds,
                'createdIds' => $createdIds,
                'folderCount' => count($nextFolders),
                'dockerOrderSynced' => $type === 'docker',
                'durationMs' => $durationMs,
                'metadata' => readConfigMetadata($type, false)
            ];
        });
    }

    function applyFolderMemberIdentityPatches(string $type, array $patches): array {
        $type = ensureType($type);
        $fileData = readRawFolderMap($type);
        $changedFolderIds = [];
        $renameCount = 0;
        $identityCount = 0;
        foreach ($patches as $rawFolderId => $rawPatch) {
            $folderId = truncateUtf8String(trim((string)$rawFolderId), 64);
            if ($folderId === '' || !is_array($rawPatch) || !is_array($fileData[$folderId] ?? null)) {
                continue;
            }
            $folder = normalizeFolderContentPayload((array)$fileData[$folderId]);
            $renames = is_array($rawPatch['renames'] ?? null) ? $rawPatch['renames'] : [];
            foreach ($renames as $rawOldName => $rawNewName) {
                $oldName = truncateUtf8String(trim((string)$rawOldName), 512);
                $newName = truncateUtf8String(trim((string)$rawNewName), 512);
                if ($oldName === '' || $newName === '' || $oldName === $newName) {
                    continue;
                }
                $oldIndex = array_search($oldName, $folder['containers'], true);
                if ($oldIndex === false || in_array($newName, $folder['containers'], true)) {
                    continue;
                }
                $folder['containers'][$oldIndex] = $newName;
                $folder['hiddenPreviewMembers'] = array_map(static function ($name) use ($oldName, $newName) {
                    return $name === $oldName ? $newName : $name;
                }, normalizeFolderMembers($folder['hiddenPreviewMembers'] ?? []));
                foreach ($folder['actions'] as &$action) {
                    if (!is_array($action)) {
                        continue;
                    }
                    foreach (['containers', 'conatiners'] as $targetKey) {
                        if (!is_array($action[$targetKey] ?? null)) {
                            continue;
                        }
                        $action[$targetKey] = array_map(static function ($name) use ($oldName, $newName) {
                            return trim((string)$name) === $oldName ? $newName : trim((string)$name);
                        }, $action[$targetKey]);
                    }
                }
                unset($action);
                if (is_array($folder['memberIdentities'][$oldName] ?? null)) {
                    $folder['memberIdentities'][$newName] = $folder['memberIdentities'][$oldName];
                    unset($folder['memberIdentities'][$oldName]);
                }
                $renameCount++;
            }
            $incomingIdentities = is_array($rawPatch['memberIdentities'] ?? null) ? $rawPatch['memberIdentities'] : [];
            foreach ($folder['containers'] as $memberName) {
                if (!is_array($incomingIdentities[$memberName] ?? null)) {
                    continue;
                }
                $candidate = normalizeFolderContentPayload([
                    'containers' => [$memberName],
                    'memberIdentities' => [$memberName => $incomingIdentities[$memberName]]
                ]);
                $identity = $candidate['memberIdentities'][$memberName] ?? null;
                if (!is_array($identity)) {
                    continue;
                }
                if (($folder['memberIdentities'][$memberName] ?? null) !== $identity) {
                    $folder['memberIdentities'][$memberName] = $identity;
                    $identityCount++;
                }
            }
            $nextFolder = normalizeFolderContentPayload($folder);
            if (jsonObjectsDiffer($fileData[$folderId], $nextFolder)) {
                $nextFolder['updatedAt'] = gmdate('c');
                $fileData[$folderId] = $nextFolder;
                $changedFolderIds[] = $folderId;
            }
        }
        if (count($changedFolderIds) > 0) {
            writeRawFolderMap($type, $fileData);
            try {
                appendDiagnosticsHistoryEvent('member_identity_reconcile', $type, [
                    'folderIds' => $changedFolderIds,
                    'renameCount' => $renameCount,
                    'identityCount' => $identityCount
                ], 'ok', 'runtime');
            } catch (Throwable $err) {
                // Keep automatic reconciliation non-fatal.
            }
        }
        return [
            'changedFolderIds' => $changedFolderIds,
            'renameCount' => $renameCount,
            'identityCount' => $identityCount,
            'metadata' => readConfigMetadata($type, true)
        ];
    }

    function applyFolderSettingsPayload(string $type, array $targetIds, array $settingsPayload): array {
        $type = ensureType($type);
        $normalizedSettings = normalizeFolderSettingsTransferPayload($settingsPayload);
        $normalizedTargetIds = [];
        foreach ($targetIds as $targetId) {
            $safeTargetId = truncateUtf8String(trim((string)$targetId), 64);
            if ($safeTargetId === '' || in_array($safeTargetId, $normalizedTargetIds, true)) {
                continue;
            }
            $normalizedTargetIds[] = $safeTargetId;
        }
        if (count($normalizedTargetIds) <= 0) {
            throw new RuntimeException('Select at least one target folder.');
        }

        $fileData = readRawFolderMap($type);
        foreach ($normalizedTargetIds as $targetId) {
            if (!is_array($fileData[$targetId] ?? null)) {
                throw new RuntimeException('Target folder not found.');
            }
        }

        $backup = createBackupSnapshot($type, 'before-apply-folder-settings');
        $updatedAt = gmdate('c');
        foreach ($normalizedTargetIds as $targetId) {
            $existingFolder = normalizeFolderContentPayload((array)$fileData[$targetId]);
            $createdAt = normalizeIsoTimestamp($existingFolder['createdAt'] ?? '');
            if ($createdAt === '') {
                $createdAt = gmdate('c');
            }
            $existingFolder['icon'] = $normalizedSettings['icon'] ?? '';
            $existingFolder['settings'] = is_array($normalizedSettings['settings'] ?? null) ? $normalizedSettings['settings'] : [];
            $existingFolder['actions'] = is_array($normalizedSettings['actions'] ?? null) ? $normalizedSettings['actions'] : [];
            $existingFolder['createdAt'] = $createdAt;
            $existingFolder['updatedAt'] = $updatedAt;
            $fileData[$targetId] = normalizeFolderContentPayload($existingFolder);
            $fileData[$targetId]['createdAt'] = $createdAt;
            $fileData[$targetId]['updatedAt'] = $updatedAt;
        }

        $fileData = normalizeFolderParentLinks($fileData);
        writeRawFolderMap($type, $fileData);
        syncManualOrderWithFolders($type, $fileData);
        try {
            appendDiagnosticsHistoryEvent('folder_settings_apply', $type, [
                'folderIds' => $normalizedTargetIds,
                'targetCount' => count($normalizedTargetIds),
                'backupName' => (string)($backup['name'] ?? ''),
                'sourceScript' => basename((string)($_SERVER['SCRIPT_NAME'] ?? ''))
            ], 'ok', 'server');
        } catch (Throwable $err) {
            // Keep apply flow non-fatal.
        }

        return [
            'updatedIds' => $normalizedTargetIds,
            'updatedCount' => count($normalizedTargetIds),
            'backup' => $backup,
            'settings' => $normalizedSettings
        ];
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

    function fvplusAllowedCustomIconExtensions(): array {
        return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'];
    }

    function fvplusCustomIconDirPath(): string {
        global $configDir;
        return "$configDir/images/custom";
    }

    function fvplusCustomIconRuntimeDirPath(): string {
        global $sourceDir;
        return "$sourceDir/images/custom";
    }

    function fvplusCustomIconRepairHintCommand(): string {
        $dir = fvplusCustomIconDirPath();
        return "mkdir -p " . escapeshellarg($dir) . " && chmod -R 775 " . escapeshellarg($dir);
    }

    function fvplusShouldManageCustomIconStorageEntry(string $name, bool $includeMetadata = true): bool {
        $safeName = trim($name);
        if ($safeName === '' || $safeName !== basename($safeName) || $safeName === '.' || $safeName === '..') {
            return false;
        }
        if ($includeMetadata && $safeName === '.metadata.json') {
            return true;
        }
        if ($safeName === 'README.txt') {
            return true;
        }
        $extension = strtolower((string)pathinfo($safeName, PATHINFO_EXTENSION));
        return $extension !== '' && in_array($extension, fvplusAllowedCustomIconExtensions(), true);
    }

    function fvplusCopyCustomIconStorageFile(string $sourcePath, string $targetPath): bool {
        $contents = @file_get_contents($sourcePath);
        if (!is_string($contents)) {
            return false;
        }
        try {
            writeDurableFileAtomic($targetPath, $contents, ['mode' => 0644]);
        } catch (Throwable $error) {
            return false;
        }
        $mtime = (int)@filemtime($sourcePath);
        if ($mtime > 0) {
            @touch($targetPath, $mtime);
        }
        @chmod($targetPath, 0644);
        return true;
    }

    function fvplusListCustomIconStorageEntries(string $directory, bool $includeMetadata = true): array {
        $entries = [];
        if (!is_dir($directory)) {
            return $entries;
        }
        foreach ((array)@scandir($directory) as $name) {
            if (!fvplusShouldManageCustomIconStorageEntry((string)$name, $includeMetadata)) {
                continue;
            }
            $path = "$directory/$name";
            if (!is_file($path)) {
                continue;
            }
            $entries[(string)$name] = [
                'path' => $path,
                'mtime' => max(0, (int)@filemtime($path)),
                'size' => max(0, (int)@filesize($path))
            ];
        }
        return $entries;
    }

    function fvplusMigrateRuntimeCustomIconsToPersistent(): array {
        $runtimeDir = fvplusCustomIconRuntimeDirPath();
        $storageDir = fvplusCustomIconDirPath();
        $migratedFiles = [];
        $migratedMetadata = false;
        if (!is_dir($runtimeDir) || is_link($runtimeDir)) {
            return [
                'migratedFileCount' => 0,
                'migratedMetadata' => false,
                'migratedFiles' => []
            ];
        }
        if (!is_dir($storageDir)) {
            @mkdir($storageDir, 0770, true);
        }
        $runtimeEntries = fvplusListCustomIconStorageEntries($runtimeDir, true);
        foreach ($runtimeEntries as $name => $entry) {
            if ($name === 'README.txt') {
                continue;
            }
            $sourcePath = (string)($entry['path'] ?? '');
            if ($sourcePath === '') {
                continue;
            }
            $targetPath = "$storageDir/$name";
            $shouldCopy = !is_file($targetPath);
            if (!$shouldCopy) {
                $targetSize = max(0, (int)@filesize($targetPath));
                $targetMtime = max(0, (int)@filemtime($targetPath));
                $shouldCopy = $targetSize !== (int)($entry['size'] ?? 0) || $targetMtime < (int)($entry['mtime'] ?? 0);
            }
            if (!$shouldCopy) {
                continue;
            }
            if (!fvplusCopyCustomIconStorageFile($sourcePath, $targetPath)) {
                continue;
            }
            if ($name === '.metadata.json') {
                $migratedMetadata = true;
            } else {
                $migratedFiles[] = $name;
            }
        }
        return [
            'migratedFileCount' => count($migratedFiles),
            'migratedMetadata' => $migratedMetadata,
            'migratedFiles' => array_values($migratedFiles)
        ];
    }

    function fvplusRemoveRuntimeCustomIconDirForLink(): bool {
        $runtimeDir = fvplusCustomIconRuntimeDirPath();
        if (is_link($runtimeDir)) {
            return @unlink($runtimeDir);
        }
        if (!is_dir($runtimeDir)) {
            return !file_exists($runtimeDir);
        }
        foreach ((array)@scandir($runtimeDir) as $name) {
            if ($name === '.' || $name === '..') {
                continue;
            }
            if (!fvplusShouldManageCustomIconStorageEntry((string)$name, true)) {
                return false;
            }
            $path = "$runtimeDir/$name";
            if (!is_file($path) || !@unlink($path)) {
                return false;
            }
        }
        return @rmdir($runtimeDir);
    }

    function fvplusMirrorPersistentCustomIconsToRuntime(): array {
        $storageDir = fvplusCustomIconDirPath();
        $runtimeDir = fvplusCustomIconRuntimeDirPath();
        $copied = 0;
        $pruned = 0;
        $runtimeParent = dirname($runtimeDir);
        if (!is_dir($runtimeParent)) {
            @mkdir($runtimeParent, 0770, true);
        }
        if (!is_dir($runtimeDir)) {
            @mkdir($runtimeDir, 0770, true);
        }
        if (!is_dir($runtimeDir)) {
            return [
                'copiedCount' => 0,
                'prunedCount' => 0,
                'ready' => false
            ];
        }

        $storageEntries = fvplusListCustomIconStorageEntries($storageDir, false);
        $runtimeEntries = fvplusListCustomIconStorageEntries($runtimeDir, false);

        foreach ($storageEntries as $name => $entry) {
            $sourcePath = (string)($entry['path'] ?? '');
            $targetPath = "$runtimeDir/$name";
            $targetExists = is_file($targetPath);
            $targetSize = $targetExists ? max(0, (int)@filesize($targetPath)) : -1;
            $targetMtime = $targetExists ? max(0, (int)@filemtime($targetPath)) : -1;
            if ($targetExists && $targetSize === (int)($entry['size'] ?? 0) && $targetMtime >= (int)($entry['mtime'] ?? 0)) {
                continue;
            }
            if (fvplusCopyCustomIconStorageFile($sourcePath, $targetPath)) {
                $copied++;
            }
        }

        foreach ($runtimeEntries as $name => $_entry) {
            if (isset($storageEntries[$name])) {
                continue;
            }
            if (@unlink("$runtimeDir/$name")) {
                $pruned++;
            }
        }

        return [
            'copiedCount' => $copied,
            'prunedCount' => $pruned,
            'ready' => is_dir($runtimeDir) && is_readable($runtimeDir)
        ];
    }

    function fvplusEnsureCustomIconStorageReady(bool $requireWritable = false): array {
        $storageDir = fvplusCustomIconDirPath();
        $runtimeDir = fvplusCustomIconRuntimeDirPath();
        $storageParent = dirname($storageDir);
        $runtimeParent = dirname($runtimeDir);
        $repairAttempted = false;

        if (!is_dir($storageParent)) {
            $repairAttempted = true;
            @mkdir($storageParent, 0770, true);
        }
        if (!is_dir($storageDir)) {
            $repairAttempted = true;
            @mkdir($storageDir, 0770, true);
        }
        if (is_dir($storageDir) && !is_writable($storageDir)) {
            $repairAttempted = true;
            @chmod($storageDir, 0770);
        }

        $storageExists = is_dir($storageDir);
        $storageWritable = $storageExists && is_writable($storageDir);
        if (!$storageExists) {
            throw new RuntimeException('Custom icon directory does not exist. Run: ' . fvplusCustomIconRepairHintCommand());
        }
        if ($requireWritable && !$storageWritable) {
            throw new RuntimeException('Custom icon directory is not writable. Run: ' . fvplusCustomIconRepairHintCommand());
        }

        $migration = fvplusMigrateRuntimeCustomIconsToPersistent();
        $repairAttempted = $repairAttempted
            || ((int)($migration['migratedFileCount'] ?? 0) > 0)
            || (($migration['migratedMetadata'] ?? false) === true);

        $publicMode = 'missing';
        $publicReady = false;
        if (is_link($runtimeDir)) {
            $runtimeResolved = @realpath($runtimeDir);
            $storageResolved = @realpath($storageDir);
            if (is_string($runtimeResolved) && $runtimeResolved !== '' && $runtimeResolved === $storageResolved) {
                $publicMode = 'symlink';
                $publicReady = true;
            } else {
                $repairAttempted = true;
                @unlink($runtimeDir);
            }
        }

        $symlinkCreated = false;
        if (!$publicReady && function_exists('symlink')) {
            if (!is_dir($runtimeParent)) {
                $repairAttempted = true;
                @mkdir($runtimeParent, 0770, true);
            }
            if (!file_exists($runtimeDir) || fvplusRemoveRuntimeCustomIconDirForLink()) {
                $repairAttempted = true;
                $symlinkCreated = @symlink($storageDir, $runtimeDir);
            }
            if ($symlinkCreated) {
                $publicMode = 'symlink';
                $publicReady = true;
            }
        }

        $mirror = ['copiedCount' => 0, 'prunedCount' => 0, 'ready' => false];
        if (!$publicReady) {
            $repairAttempted = true;
            $mirror = fvplusMirrorPersistentCustomIconsToRuntime();
            $publicMode = 'mirror';
            $publicReady = ($mirror['ready'] ?? false) === true;
        }

        return [
            'storageDir' => $storageDir,
            'runtimeDir' => $runtimeDir,
            'storageExists' => $storageExists,
            'storageWritable' => $storageWritable,
            'publicMode' => $publicMode,
            'publicReady' => $publicReady,
            'repairAttempted' => $repairAttempted,
            'repairSucceeded' => $storageExists && (!$requireWritable || $storageWritable) && $publicReady,
            'repairHint' => fvplusCustomIconRepairHintCommand(),
            'migratedFileCount' => (int)($migration['migratedFileCount'] ?? 0),
            'migratedMetadata' => ($migration['migratedMetadata'] ?? false) === true,
            'mirrorCopiedCount' => (int)($mirror['copiedCount'] ?? 0),
            'mirrorPrunedCount' => (int)($mirror['prunedCount'] ?? 0)
        ];
    }

    function fvplusBootstrapCustomIconStorage(): void {
        static $bootstrapped = false;
        if ($bootstrapped) {
            return;
        }
        $bootstrapped = true;
        try {
            fvplusEnsureCustomIconStorageReady(false);
        } catch (Throwable $_error) {
            // Keep runtime bootstrap non-fatal; diagnostics will surface path issues.
        }
    }

    function fvplusRepairMissingCustomIconReferences(): array {
        $customIconDir = fvplusCustomIconDirPath();
        $existingIcons = [];
        if (is_dir($customIconDir)) {
            foreach ((array)@scandir($customIconDir) as $name) {
                if ($name === '.' || $name === '..' || $name !== basename($name)) {
                    continue;
                }
                $path = "$customIconDir/$name";
                if (!is_file($path)) {
                    continue;
                }
                $extension = strtolower((string)pathinfo($name, PATHINFO_EXTENSION));
                if ($extension === '' || !in_array($extension, diagnosticsCustomIconExtensions(), true)) {
                    continue;
                }
                $existingIcons[$name] = true;
            }
        }

        $repairedFolders = [];
        $missingIcons = [];
        $typeCounts = ['docker' => 0, 'vm' => 0];

        foreach (FVPLUS_ALLOWED_TYPES as $type) {
            $folders = readRawFolderMap($type);
            $updated = false;
            foreach ($folders as $folderId => &$folder) {
                if (!is_array($folder)) {
                    continue;
                }
                $iconName = diagnosticsCustomIconNameFromIconValue((string)($folder['icon'] ?? ''));
                if ($iconName === '' || isset($existingIcons[$iconName])) {
                    continue;
                }
                $missingIcons[$iconName] = true;
                $folder['icon'] = '';
                $repairedFolders[] = [
                    'type' => $type,
                    'folderId' => (string)$folderId,
                    'folderName' => trim((string)($folder['name'] ?? (string)$folderId)),
                    'missingIcon' => $iconName
                ];
                $typeCounts[$type] = (int)($typeCounts[$type] ?? 0) + 1;
                $updated = true;
            }
            unset($folder);

            if (!$updated) {
                continue;
            }

            createBackupSnapshot($type, 'before-repair-missing-custom-icons');
            writeRawFolderMap($type, $folders);
            appendDiagnosticsHistoryEvent(
                'repair_missing_custom_icons',
                $type,
                [
                    'repairedFolderCount' => (int)($typeCounts[$type] ?? 0),
                    'missingIconCount' => count($missingIcons)
                ],
                'ok',
                'server'
            );
        }

        return [
            'customIconDir' => $customIconDir,
            'repairedFolderCount' => count($repairedFolders),
            'missingIconCount' => count($missingIcons),
            'missingIcons' => array_values(array_keys($missingIcons)),
            'repairedFolders' => $repairedFolders,
            'typeCounts' => $typeCounts
        ];
    }

    function fvplusRepairOrphanedMemberReferences(): array {
        $repairedFolders = [];
        $repairedMembers = [];
        $typeCounts = ['docker' => 0, 'vm' => 0];

        foreach (FVPLUS_ALLOWED_TYPES as $type) {
            $folders = readRawFolderMap($type);
            $infoByName = readInfo($type);
            $validNames = array_fill_keys(array_keys(is_array($infoByName) ? $infoByName : []), true);
            $updated = false;
            $typeFolderCount = 0;

            foreach ($folders as $folderId => &$folder) {
                if (!is_array($folder)) {
                    continue;
                }
                $normalizedFolder = normalizeFolderContentPayload($folder);
                $members = normalizeFolderMembers($normalizedFolder['containers'] ?? []);
                if (count($members) <= 0) {
                    $folder = $normalizedFolder;
                    continue;
                }

                $orphanedMembers = array_values(array_filter($members, static function ($memberName) use ($validNames): bool {
                    return !isset($validNames[(string)$memberName]);
                }));
                if (count($orphanedMembers) <= 0) {
                    $folder = $normalizedFolder;
                    continue;
                }

                $normalizedFolder['containers'] = array_values(array_filter($members, static function ($memberName) use ($validNames): bool {
                    return isset($validNames[(string)$memberName]);
                }));
                $folder = $normalizedFolder;

                $repairedFolders[] = [
                    'type' => $type,
                    'folderId' => (string)$folderId,
                    'folderName' => trim((string)($normalizedFolder['name'] ?? (string)$folderId)),
                    'removedCount' => count($orphanedMembers),
                    'removedMembers' => $orphanedMembers
                ];
                foreach ($orphanedMembers as $memberName) {
                    $repairedMembers[(string)$memberName] = true;
                }
                $typeCounts[$type] = (int)($typeCounts[$type] ?? 0) + count($orphanedMembers);
                $typeFolderCount++;
                $updated = true;
            }
            unset($folder);

            if (!$updated) {
                continue;
            }

            createBackupSnapshot($type, 'before-repair-orphaned-members');
            writeRawFolderMap($type, $folders);
            if ($type === 'docker') {
                syncContainerOrder('docker');
            }
            appendDiagnosticsHistoryEvent(
                'repair_orphaned_members',
                $type,
                [
                    'repairedFolderCount' => $typeFolderCount,
                    'repairedMemberCount' => (int)($typeCounts[$type] ?? 0)
                ],
                'ok',
                'server'
            );
        }

        return [
            'repairedFolderCount' => count($repairedFolders),
            'repairedMemberCount' => count($repairedMembers),
            'repairedMembers' => array_values(array_keys($repairedMembers)),
            'repairedFolders' => $repairedFolders,
            'typeCounts' => $typeCounts
        ];
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
        $customIconHealth = fvplusEnsureCustomIconStorageReady(false);
        $customIconDir = (string)($customIconHealth['storageDir'] ?? fvplusCustomIconDirPath());
        $customIconRuntimeDir = (string)($customIconHealth['runtimeDir'] ?? fvplusCustomIconRuntimeDirPath());
        foreach ([$customIconDir, dirname($customIconDir)] as $path) {
            if (is_string($path) && $path !== '' && !in_array($path, $created, true) && file_exists($path)) {
                $created[] = $path;
            }
        }
        foreach (FVPLUS_ALLOWED_TYPES as $type) {
            createFile($type);
            readTypePrefs($type); // Normalize and ensure defaults.
        }
        ensureThemeWorkspaceManagedAssets();
        return [
            'createdPaths' => $created,
            'configDir' => $configDir,
            'customIconDir' => $customIconDir,
            'customIconRuntimeDir' => $customIconRuntimeDir
        ];
    }

    fvplusBootstrapCustomIconStorage();
    ensureThemeWorkspaceManagedAssets();

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
        try {
            $templateFiles = $dockerTemplates->getTemplates('all');
        } catch (Throwable $error) {
            fv3_debug_log("getDockerTemplateIndexCached: DockerTemplates->getTemplates('all') failed: " . $error->getMessage());
            return [];
        }
        if (!is_array($templateFiles) || empty($templateFiles)) {
            return [];
        }
        $signature = buildDockerTemplateSignature($templateFiles);
        $cached = readDockerTemplateCache($signature);
        if (is_array($cached)) {
            return $cached;
        }
        try {
            $templates = buildDockerTemplateIndex($templateFiles);
        } catch (Throwable $error) {
            fv3_debug_log("getDockerTemplateIndexCached: buildDockerTemplateIndex failed: " . $error->getMessage());
            return [];
        }
        writeDockerTemplateCache($signature, $templates);
        return $templates;
    }

    function readInfoState(string $type, bool $preferLiveUpdateStatus = false): array {
        $type = ensureType($type);
        $info = [];

        if ($type === 'docker') {
            global $dockerManPaths;
            $dockerClient = new DockerClient();
            $dockerUpdate = $preferLiveUpdateStatus ? new DockerUpdate() : null;
            $containers = $dockerClient->getDockerJSON("/containers/json?all=1");
            if (!is_array($containers)) {
                return [];
            }

            $autoStartFile = $dockerManPaths['autostart-file'] ?? "/var/lib/docker/unraid-autostart";
            $autoStartLines = @file($autoStartFile, FILE_IGNORE_NEW_LINES) ?: [];
            $dockerWebuiInfo = readDockerWebuiInfoCache();
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
                $containerImage = DockerUtil::ensureImageTag(trim((string)($container['Image'] ?? '')));

                $info[$name] = [
                    'name' => $name,
                    'id' => substr(str_replace('sha256:', '', (string)($container['Id'] ?? '')), 0, 12),
                    'shortImageId' => substr(str_replace('sha256:', '', (string)($container['ImageID'] ?? '')), 0, 12),
                    'Image' => trim((string)($container['Image'] ?? '')),
                    'Labels' => $labels,
                    'Mounts' => is_array($container['Mounts'] ?? null) ? $container['Mounts'] : [],
                    'state' => $stateKind,
                    'running' => $running,
                    'paused' => $paused,
                    'status' => $statusRaw,
                    'autostart' => isset($autoStartSet[$name]),
                    'Updated' => $manager === 'dockerman'
                        ? ($preferLiveUpdateStatus
                            ? resolveDockerUpdatedStateValue($name, $containerImage, $dockerWebuiInfo, $dockerUpdate)
                            : resolveDockerCachedUpdatedStateValue($name, $dockerWebuiInfo))
                        : null,
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
                if (!is_array($dom)) {
                    continue;
                }
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
            if (!is_array($cts)) {
                fv3_debug_log("readInfo: Docker container list unavailable.");
                return [];
            }
            $autoStartFile = $dockerManPaths['autostart-file'] ?? "/var/lib/docker/unraid-autostart";
            $autoStartLines = @file($autoStartFile, FILE_IGNORE_NEW_LINES) ?: [];
            $autoStart = array_map('var_split', $autoStartLines);
            $dockerWebuiInfo = readDockerWebuiInfoCache();

            // Remove stale entries from autostart file (containers that no longer exist)
            $allCtNames = array_map(function($c) { return ltrim($c['Names'][0] ?? '', '/'); }, $cts);
            $cleanedLines = array_filter($autoStartLines, function($line) use ($allCtNames) {
                $parts = explode(' ', $line, 2);
                return in_array($parts[0], $allCtNames);
            });
            if (count($cleanedLines) < count($autoStartLines)) {
                writeDurableFileAtomic($autoStartFile, implode("\n", $cleanedLines) . "\n");
                fv3_debug_log("readInfo: removed " . (count($autoStartLines) - count($cleanedLines)) . " stale autostart entries");
                $autoStart = array_map('var_split', $cleanedLines);
            }

            $allXmlTemplates = getDockerTemplateIndexCached($dockerTemplates);

            foreach ($cts as $key => &$ct) {
                $ct['info'] = $dockerClient->getContainerDetails($ct['Id'] ?? null);
                if (empty($ct['info'])) { fv3_debug_log("Skipped container due to empty details: ID " . ($ct['Id'] ?? 'N/A')); continue; }

                $containerLabels = is_array($ct['Labels'] ?? null) ? $ct['Labels'] : [];
                $configLabels = is_array($ct['info']['Config']['Labels'] ?? null) ? $ct['info']['Config']['Labels'] : [];
                if (empty($containerLabels) && !empty($configLabels)) {
                    $containerLabels = $configLabels;
                }
                $containerName = ltrim((string)($ct['info']['Name'] ?? ''), '/');
                if ($containerName === '') {
                    fv3_debug_log("Skipped container due to missing name: ID " . ($ct['Id'] ?? 'N/A'));
                    continue;
                }
                $ct['info']['Name'] = $containerName;
                fv3_debug_log("Processing Container: $containerName (ID: " . ($ct['Id'] ?? 'N/A') . ")");

                $ct['info']['State']['Autostart'] = in_array($containerName, $autoStart);
                $containerImage = DockerUtil::ensureImageTag((string)($ct['info']['Config']['Image'] ?? ''));
                $ct['info']['Config']['Image'] = $containerImage;
                $ct['info']['State']['manager'] = getNormalizedDockerManagerFromLabels($containerLabels);
                $ct['info']['State']['Updated'] = $ct['info']['State']['manager'] === 'dockerman'
                    ? resolveDockerUpdatedStateValue($containerName, $containerImage, $dockerWebuiInfo, $DockerUpdate)
                    : null;
                $ct['shortId'] = substr(str_replace('sha256:', '', (string)($ct['Id'] ?? '')), 0, 12);
                $ct['shortImageId'] = substr(str_replace('sha256:', '', (string)($ct['ImageID'] ?? '')), 0, 12);
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
                    $rawWebUiString = (string)($containerLabels['net.unraid.docker.webui'] ?? '');
                    $rawTsXmlUrl = (string)($containerLabels['net.unraid.docker.tailscale.webui'] ?? '');
                    $tailscaleFunnelEnabled = strtolower(trim((string)($containerLabels['net.unraid.docker.tailscale.funnel'] ?? 'false'))) === 'true';
                    $tsServeModeFromXml = (string)($containerLabels['net.unraid.docker.tailscale.servemode'] ?? ($tailscaleFunnelEnabled ? 'funnel' : 'no'));
                    $isTailscaleEnabledForContainer = strtolower((string)($containerLabels['net.unraid.docker.tailscale.enabled'] ?? 'false')) === 'true';
                    $ct['info']['Shell'] = (string)($containerLabels['net.unraid.docker.shell'] ?? 'sh');
                }
                fv3_debug_log("  $containerName: Using ".($templateData && $ct['info']['State']['manager'] == 'dockerman' ? "XML" : "Label")." data. TailscaleEnabled: " . ($isTailscaleEnabledForContainer ? 'true' : 'false'));
                fv3_debug_log("    $containerName: Raw WebUI: '$rawWebUiString', Raw TS XML URL: '$rawTsXmlUrl', TS Serve Mode: '$tsServeModeFromXml'");
                
                // --- Populate $ct['info']['Ports'] ---
                $ct['info']['Ports'] = [];
                $currentNetworkMode = $ct['info']['HostConfig']['NetworkMode'] ?? ($ct['HostConfig']['NetworkMode'] ?? 'unknown');
                $currentNetworkDriver = $driver[$currentNetworkMode] ?? null;
                
                $containerIpAddress = null; 
                if ($currentNetworkMode !== 'host' && $currentNetworkDriver !== 'bridge') {
                    $containerNetworks = is_array($ct['NetworkSettings']['Networks'] ?? null) ? $ct['NetworkSettings']['Networks'] : [];
                    $containerNetworkSettings = $containerNetworks[$currentNetworkMode] ?? null;
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
            $vmCount = is_array($vms) ? count($vms) : 0;
            fv3_debug_log("VM: Found " . $vmCount . " VMs.");
            if (!is_array($vms)) {
                fv3_debug_log("VM: Domain list unavailable.");
                return [];
            }
            if (!empty($vms)) {
                foreach ($vms as $vm) {
                    $res = $lv->get_domain_by_name($vm);
                    if (!$res) { fv3_debug_log("VM: Could not get domain by name for $vm."); continue; }
                    $dom = $lv->domain_get_info($res);
                    if (!is_array($dom)) {
                        fv3_debug_log("VM: Could not get domain info for $vm.");
                        continue;
                    }
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
                        'state' => $lv->domain_state_translate($dom['state'] ?? ''),
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
