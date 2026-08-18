<?php
    require_once __DIR__ . '/lib.remote.php';
    require_once __DIR__ . '/lib.process.php';
    require_once __DIR__ . '/lib.filesystem-security.php';
    require_once __DIR__ . '/lib.security.php';

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

        try {
            $processResult = fvplusRunProcessProfile('docker-tailscale-ip', ['name' => $containerName]);
        } catch (Throwable $error) {
            fv3_debug_log("    fv3_get_tailscale_ip_from_container: Process failed: " . $error->getMessage());
            return null;
        }
        $output = (array)($processResult['output'] ?? []);
        $return_var = (int)($processResult['exitCode'] ?? -1);

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

        try {
            $processResult = fvplusRunProcessProfile('docker-tailscale-status', ['name' => $containerName]);
        } catch (Throwable $error) {
            fv3_debug_log("    fv3_get_tailscale_fqdn_from_container: Process failed: " . $error->getMessage());
            return null;
        }
        $return_var = (int)($processResult['exitCode'] ?? -1);
        $json_output = trim((string)($processResult['stdout'] ?? ''));

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
    const FVPLUS_MUTATION_NONCE_TTL_SECONDS = 120;
    const FVPLUS_MUTATION_NONCE_MAX_ACTIVE = 256;
    const FVPLUS_MUTATION_TRANSACTION_TTL_SECONDS = 600;
    const FVPLUS_MUTATION_TRANSACTION_MAX = 1000;
    const FVPLUS_SECURITY_AUDIT_HISTORY_MAX = 200;
    const FVPLUS_CUSTOM_ICON_METADATA_SCHEMA_VERSION = 1;
    const FVPLUS_THEME_WORKSPACE_SCHEMA_VERSION = 2;
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
    require_once(__DIR__ . '/lib.docker-runtime.php');
    require_once(__DIR__ . '/lib.input-security.php');

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
        echo '<link rel="stylesheet" href="'
            . htmlspecialchars(fvplus_asset_url('/plugins/folderview.plus/styles/runtime.shared.css'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
            . '">';
        echo '<div class="fv-runtime-conflict-banner" data-conflict-key="' . $conflictKey . '" data-conflict-plugins="' . $pluginData . '">';
        echo '<div class="fv-runtime-conflict-heading">';
        echo '<i class="fa fa-exclamation-triangle fv-runtime-conflict-icon" aria-hidden="true"></i>';
        echo '<div class="fv-runtime-conflict-title">Safe mode active</div>';
        echo '</div>';
        if ($isSettingsSurface) {
            echo '<div class="fv-runtime-conflict-copy">Runtime injection is paused because another Folder View plugin is installed. ';
            echo 'You can still review settings here, but Docker/VM/Dashboard folder rendering is disabled until the conflict is removed.</div>';
        } else {
            echo '<div class="fv-runtime-conflict-copy">Folder rendering is paused on <strong>' . $scope . '</strong> to prevent runtime conflicts.</div>';
        }
        echo '<div class="fv-runtime-conflict-copy">Detected conflicting runtime plugin(s): <strong>' . $pluginText . '</strong>.</div>';
        echo '<div class="fv-runtime-conflict-copy">Keep <strong>FolderView Plus</strong> installed. Remove only the conflicting plugin listed above.</div>';
        echo '<div class="fv-runtime-conflict-subtitle">How to fix</div>';
        echo '<ol class="fv-runtime-conflict-steps">';
        echo '<li>Open <strong>Plugins</strong>.</li>';
        echo '<li>Remove: <strong>' . $pluginText . '</strong>.</li>';
        echo '<li>Refresh this page to re-enable FolderView Plus.</li>';
        echo '</ol>';
        echo '<div class="fv-runtime-conflict-actions">';
        echo '<button type="button" class="btn fv-runtime-conflict-button" data-fv-onclick="window.location.href=\'/Plugins\'">Open Plugins</button>';
        echo '<a class="fv-runtime-conflict-support" href="https://forums.unraid.net/topic/197631-plugin-folderview-plus/" target="_blank" rel="noopener noreferrer">Support Thread</a>';
        echo '</div>';
        echo '</div>';
        $conflictStorageKey = trim((string)$conflictKeyRaw);
        if ($conflictStorageKey === '') {
            $conflictStorageKey = 'runtime-conflict';
        }
        echo '<meta name="fvplus-runtime-conflict" content="'
            . htmlspecialchars($conflictStorageKey, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
            . '">';
        echo '<script src="'
            . htmlspecialchars(fvplus_asset_url('/plugins/folderview.plus/scripts/runtime.conflict-bootstrap.js'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
            . '"></script>';
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

    function getRequestTokenEnforcementMode(): string {
        return normalizeRequestTokenEnforcementMode(FVPLUS_REQUEST_TOKEN_ENFORCEMENT);
    }

    function ensureConfiguredRequestTokenFile(): void {
        $path = getOptionalRequestTokenPath();
        if (file_exists($path)) {
            @chmod($path, 0600);
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
            // Read-only surfaces remain available; strict mutations fail closed below.
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

    function emitJsonBootstrapMeta(string $name, $value, array $attributes = []): void {
        $safeName = preg_replace('/[^A-Za-z0-9._:-]/', '', trim($name));
        if (!is_string($safeName) || $safeName === '') {
            return;
        }
        $encoded = json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
        if (!is_string($encoded)) {
            return;
        }
        echo '<meta name="' . htmlspecialchars($safeName, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '"';
        foreach ($attributes as $attribute => $attributeValue) {
            $safeAttribute = preg_replace('/[^A-Za-z0-9._:-]/', '', trim((string)$attribute));
            if (!is_string($safeAttribute) || $safeAttribute === '') {
                continue;
            }
            echo ' ' . $safeAttribute . '="' . htmlspecialchars((string)$attributeValue, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '"';
        }
        echo ' content="' . htmlspecialchars($encoded, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '">' . "\n";
    }

    function emitPluginPageVersionSentinelScript(string $pageKey): void {
        $safePageKey = trim($pageKey);
        if ($safePageKey === '') {
            $safePageKey = 'page';
        }
        emitJsonBootstrapMeta('fvplus-page-version', [
            'pageKey' => $safePageKey,
            'version' => readInstalledVersion()
        ]);
    }

    function emitRuntimePreflightBannerBootstrap(array $preflight, string $contextLabel = 'Runtime'): void {
        $issues = is_array($preflight['issues'] ?? null) ? array_values($preflight['issues']) : [];
        if (count($issues) === 0) {
            return;
        }
        emitJsonBootstrapMeta('fvplus-runtime-preflight', [
            'issues' => $issues,
            'context' => trim($contextLabel) !== '' ? trim($contextLabel) : 'Runtime'
        ]);
        echo '<script src="'
            . htmlspecialchars(fvplus_asset_url('/plugins/folderview.plus/scripts/runtime.preflight-bootstrap.js'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
            . '"></script>' . "\n";
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
        if ($error instanceof FVPlusSecurityRequestException) {
            return max(400, min(599, (int)$error->getCode()));
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

    require_once(__DIR__ . '/lib.release-notes.php'); require_once(__DIR__ . '/lib.update-channel.php');

    require_once(__DIR__ . '/lib.storage.php');

    require_once(__DIR__ . '/lib.theme-profiles.php'); require_once(__DIR__ . '/lib.theme-update-plan.php'); require_once(__DIR__ . '/lib.theme-workspace.php');

    require_once(__DIR__ . '/lib.environment-snapshot.php'); require_once(__DIR__ . '/lib.environment-transaction.php'); require_once(__DIR__ . '/lib.folderview3-migration.php'); require_once(__DIR__ . '/lib.folderview3-apply.php');

    require_once(__DIR__ . '/lib.theme-github.php'); require_once(__DIR__ . '/lib.theme-profile-actions.php'); require_once(__DIR__ . '/lib.theme-bulk-update.php');

    function normalizeFolderMapPayload($value): array {
        if (!is_array($value)) {
            return [];
        }
        $normalized = [];
        foreach ($value as $id => $folder) {
            $safeId = normalizeFolderIdValue($id);
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

    require_once(__DIR__ . '/lib.backup-schedule.php');

    require_once(__DIR__ . '/lib.backup-snapshots.php');

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

            $processProfile = $type === 'docker' ? 'docker-runtime' : 'virsh-runtime';
            try {
                $commandResult = fvplusRunRuntimeItemAction($type, $normalizedAction, $name);
            } catch (Throwable $error) {
                $commandResult = [
                    'ok' => false,
                    'exitCode' => 126,
                    'output' => ['Allowlisted process could not start.']
                ];
            }

            $executed++;
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
                'profile' => $processProfile,
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
        $manifestUrl = resolveInstalledPluginUpdateManifestUrl();
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

    require_once(__DIR__ . '/lib.folder-rules.php'); require_once(__DIR__ . '/lib.docker-start-order-sequence.php');

    require_once(__DIR__ . '/lib.docker-order.php');

    require_once(__DIR__ . '/lib.folder-mutations.php');

    require_once(__DIR__ . '/lib.custom-icon-storage.php');

    require_once(__DIR__ . '/lib.runtime-info.php');
