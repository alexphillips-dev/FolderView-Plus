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

    function fv3_get_tailscale_ip_from_container(string $containerName): ?string {
        if (empty($containerName) || !preg_match('/^[a-zA-Z0-9_.-]+$/', $containerName)) {
            fv3_debug_log("    fv3_get_tailscale_ip_from_container: Invalid container name for exec: $containerName");
            return null;
        }
        $command = "docker exec " . escapeshellarg($containerName) . " tailscale ip -4 2>/dev/null";
        fv3_debug_log("    fv3_get_tailscale_ip_from_container: Executing: $command for $containerName");
        $output = [];
        $return_var = -1;
        @exec($command, $output, $return_var);
        
        if ($return_var === 0 && !empty($output) && filter_var(trim($output[0]), FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            $ip = trim($output[0]);
            fv3_debug_log("    fv3_get_tailscale_ip_from_container: Found IP for $containerName: $ip");
            return $ip;
        }
        fv3_debug_log("    fv3_get_tailscale_ip_from_container: No valid IP found for $containerName. Output: " . json_encode($output) . ", Return: $return_var");
        return null;
    }

    function fv3_get_tailscale_fqdn_from_container(string $containerName): ?string {
        if (empty($containerName) || !preg_match('/^[a-zA-Z0-9_.-]+$/', $containerName)) {
            fv3_debug_log("    fv3_get_tailscale_fqdn_from_container: Invalid container name for exec: $containerName");
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
                $dnsName = rtrim($status_data['Self']['DNSName'], '.'); 
                fv3_debug_log("    fv3_get_tailscale_fqdn_from_container: Found DNSName for $containerName: " . $dnsName);
                return $dnsName;
            }
        }
        fv3_debug_log("    fv3_get_tailscale_fqdn_from_container: No DNSName found for $containerName. Output: " . $json_output . ", Return: $return_var");
        return null;
    }

    const FVPLUS_EXPORT_SCHEMA_VERSION = 1;
    const FVPLUS_REMOTE_MANIFEST_URL = "https://raw.githubusercontent.com/alexphillips-dev/FolderView-Plus/main/folderview.plus.plg";
    const FVPLUS_ALLOWED_TYPES = ['docker', 'vm'];
    const FVPLUS_DIAGNOSTICS_SCHEMA_VERSION = 2;
    const FVPLUS_DIAGNOSTICS_HISTORY_MAX = 250;
    const FVPLUS_DIAGNOSTICS_DEFAULT_PRIVACY = 'sanitized';
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

    function ensureType(string $type): string {
        if (!in_array($type, FVPLUS_ALLOWED_TYPES, true)) {
            throw new InvalidArgumentException("Invalid type: $type");
        }
        return $type;
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
            } elseif (count($legacyData) === 0) {
                continue;
            }

            $parent = dirname($targetPath);
            if (!is_dir($parent)) {
                @mkdir($parent, 0770, true);
            }
            @file_put_contents($targetPath, json_encode($legacyData, JSON_UNESCAPED_SLASHES));
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
        $decoded = @json_decode((string)@file_get_contents($path), true);
        return is_array($decoded) ? $decoded : [];
    }

    function writeRawFolderMap(string $type, array $folders): void {
        $type = ensureType($type);
        $path = getFolderFilePath($type);
        $parent = dirname($path);
        if (!is_dir($parent)) {
            @mkdir($parent, 0770, true);
        }
        $result = @file_put_contents($path, json_encode($folders, JSON_UNESCAPED_SLASHES));
        if ($result === false) {
            throw new RuntimeException("Failed to write folder map for type '$type'.");
        }
    }

    function getTypePrefsPath(string $type): string {
        global $configDir;
        return "$configDir/$type.prefs.json";
    }

    function defaultTypePrefs(): array {
        return [
            'sortMode' => 'created',
            'manualOrder' => [],
            'autoRules' => [],
            'badges' => [
                'running' => true,
                'stopped' => false,
                'updates' => true
            ]
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
        $normalized['manualOrder'] = array_values(array_unique(array_filter(array_map('strval', $manualOrder), function($id) {
            return $id !== '';
        })));

        $autoRules = $prefs['autoRules'] ?? [];
        if (!is_array($autoRules)) {
            $autoRules = [];
        }
        $normalizedRules = [];
        foreach ($autoRules as $rule) {
            if (!is_array($rule)) {
                continue;
            }
            $kind = $rule['kind'] ?? 'name_regex';
            if (!in_array($kind, ['name_regex', 'label'], true)) {
                $kind = 'name_regex';
            }
            $normalizedRules[] = [
                'id' => (string)($rule['id'] ?? generateId(12)),
                'enabled' => (bool)($rule['enabled'] ?? true),
                'folderId' => (string)($rule['folderId'] ?? ''),
                'kind' => $kind,
                'pattern' => (string)($rule['pattern'] ?? ''),
                'labelKey' => (string)($rule['labelKey'] ?? ''),
                'labelValue' => (string)($rule['labelValue'] ?? '')
            ];
        }
        $normalized['autoRules'] = $normalizedRules;
        $normalized['badges'] = normalizeBadgePrefs($prefs['badges'] ?? []);
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
            $defaults = defaultTypePrefs();
            @file_put_contents($path, json_encode($defaults, JSON_UNESCAPED_SLASHES));
            return $defaults;
        }
        $decoded = @json_decode((string)@file_get_contents($path), true);
        $normalized = normalizeTypePrefs(is_array($decoded) ? $decoded : []);
        return $normalized;
    }

    function writeTypePrefs(string $type, array $prefs): array {
        $type = ensureType($type);
        $path = getTypePrefsPath($type);
        $parent = dirname($path);
        if (!is_dir($parent)) {
            @mkdir($parent, 0770, true);
        }
        $normalized = normalizeTypePrefs($prefs);
        $result = @file_put_contents($path, json_encode($normalized, JSON_UNESCAPED_SLASHES));
        if ($result === false) {
            throw new RuntimeException("Failed to write preferences for type '$type'.");
        }
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
            return $ordered;
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
            return $ordered;
        }

        return $folders;
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

    function getBackupsDirPath(): string {
        global $configDir;
        return "$configDir/backups";
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
            'folders' => $folders
        ];
        @file_put_contents("$backupDir/$filename", json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
        $pruned = pruneBackupSnapshots($type, 25);
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

    function restoreBackupSnapshot(string $type, string $name): array {
        $type = ensureType($type);
        $path = getBackupSnapshotPath($type, $name);
        $safeName = basename($path);
        if (!file_exists($path)) {
            throw new RuntimeException('Backup file not found.');
        }
        $decoded = @json_decode((string)@file_get_contents($path), true);
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

    function checkRemotePluginUpdate(): array {
        $manifestUrl = FVPLUS_REMOTE_MANIFEST_URL;
        $checkedAt = gmdate('c');
        $currentVersion = readInstalledVersion();
        $context = stream_context_create([
            'http' => [
                'timeout' => 8,
                'ignore_errors' => true,
                'header' => "Cache-Control: no-cache\r\nPragma: no-cache\r\nUser-Agent: FolderViewPlus/1.0\r\n"
            ]
        ]);
        $content = @file_get_contents($manifestUrl . '?_=' . time(), false, $context);
        if ($content === false) {
            return [
                'ok' => false,
                'checkedAt' => $checkedAt,
                'currentVersion' => $currentVersion,
                'remoteVersion' => null,
                'updateAvailable' => false,
                'manifestUrl' => $manifestUrl,
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
            'error' => null
        ];
    }

    function readFolder(string $type) : string {
        $type = ensureType($type);
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
        $kind = (string)($rule['kind'] ?? 'name_regex');
        if ($kind === 'name_regex') {
            $pattern = (string)($rule['pattern'] ?? '');
            return $pattern !== '' && diagnosticsRegexMatches($pattern, $name);
        }
        if ($kind === 'label' && $type === 'docker') {
            $labelKey = (string)($rule['labelKey'] ?? '');
            if ($labelKey === '') {
                return false;
            }
            $labels = diagnosticsDockerLabelsForItem($infoByName[$name] ?? null);
            if (!array_key_exists($labelKey, $labels)) {
                return false;
            }
            $expected = (string)($rule['labelValue'] ?? '');
            return $expected === '' || (string)$labels[$labelKey] === $expected;
        }
        return false;
    }

    function diagnosticsFirstMatchingRule(array $rules, string $name, array $infoByName, string $type): ?array {
        foreach ($rules as $rule) {
            if (!is_array($rule) || ($rule['enabled'] ?? true) === false) {
                continue;
            }
            if (diagnosticsAutoRuleMatches($rule, $name, $infoByName, $type)) {
                return $rule;
            }
        }
        return null;
    }

    function diagnosticsFormatNames(array $names, string $privacyMode): array {
        $names = array_values(array_unique(array_map('strval', $names)));
        if (normalizeDiagnosticsPrivacyMode($privacyMode) === 'full') {
            return array_slice($names, 0, 30);
        }
        return array_slice(array_map('diagnosticsHashShort', $names), 0, 30);
    }

    function diagnosticsBuildIntegrityChecks(string $type, array $folders, array $prefs, array $infoByName, string $privacyMode): array {
        $validNames = array_keys($infoByName);
        $validSet = array_fill_keys($validNames, true);
        $nameBuckets = [];
        $invalidRegexFolders = [];
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
            if ($folderId === '' || !array_key_exists($folderId, $folders)) {
                $invalidRules[] = ['index' => $idx, 'id' => (string)($rule['id'] ?? ''), 'reason' => 'Rule folder target is missing or invalid.'];
            }
            if (!in_array($kind, ['name_regex', 'label'], true)) {
                $invalidRules[] = ['index' => $idx, 'id' => (string)($rule['id'] ?? ''), 'reason' => 'Rule kind is invalid.'];
                continue;
            }
            if ($kind === 'name_regex') {
                $pattern = (string)($rule['pattern'] ?? '');
                if ($pattern === '') {
                    $invalidRules[] = ['index' => $idx, 'id' => (string)($rule['id'] ?? ''), 'reason' => 'Regex rule pattern is empty.'];
                } elseif (!diagnosticsRegexIsValid($pattern)) {
                    $invalidRules[] = ['index' => $idx, 'id' => (string)($rule['id'] ?? ''), 'reason' => 'Regex rule pattern is invalid.'];
                }
            }
            if ($kind === 'label') {
                if ($type !== 'docker') {
                    $invalidRules[] = ['index' => $idx, 'id' => (string)($rule['id'] ?? ''), 'reason' => 'Label rules are only valid for docker.'];
                }
                $labelKey = (string)($rule['labelKey'] ?? '');
                if ($labelKey === '') {
                    $invalidRules[] = ['index' => $idx, 'id' => (string)($rule['id'] ?? ''), 'reason' => 'Label rule key is empty.'];
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
            + count($invalidRules)
            + count($missingManualOrderIds)
            + $orphanedCount
            + $buildConflicts($effectiveAssignments)['count'];

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
            'invalidAutoRules' => [
                'count' => count($invalidRules),
                'rules' => array_slice($invalidRules, 0, 40)
            ],
            'missingManualOrderIds' => [
                'count' => count($missingManualOrderIds),
                'ids' => array_values(array_unique($missingManualOrderIds))
            ],
            'duplicateAssignments' => [
                'explicit' => $buildConflicts($explicitAssignments),
                'regex' => $buildConflicts($regexAssignments),
                'effective' => $buildConflicts($effectiveAssignments)
            ]
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
                'lastBackup' => $backups[0] ?? null,
                'backupCount' => count($backups),
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
            'importExportHistory' => [
                'retained' => count(readDiagnosticsHistoryEvents(FVPLUS_DIAGNOSTICS_HISTORY_MAX)),
                'returned' => count($historyEvents),
                'events' => $historyEvents
            ],
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
        $isCreate = empty($id);
        if (empty($id)) {
            $id = generateId();
        }
        $fileData = readRawFolderMap($type);
        $decodedContent = json_decode($content, true);
        if (!is_array($decodedContent)) {
            $decodedContent = [];
        }
        $fileData[$id] = $decodedContent;
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
        unset($fileData[$id]);
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
        $default = ['docker' => '{}', 'vm' => '{}'];
        $filePath = "$configDir/$type.json";
        if (!file_exists($filePath)) {
            @file_put_contents($filePath, $default[$type] ?? '{}');
        }
        $prefsPath = getTypePrefsPath($type);
        if (!file_exists($prefsPath)) {
            @file_put_contents($prefsPath, json_encode(defaultTypePrefs(), JSON_UNESCAPED_SLASHES));
        }
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

            $allXmlTemplates = [];
            foreach ($dockerTemplates->getTemplates('all') as $templateFile) {
                $doc = new DOMDocument();
                if (@$doc->load($templateFile['path'])) { 
                    $templateName = trim($doc->getElementsByTagName('Name')->item(0)->nodeValue ?? '');
                    $templateImage = DockerUtil::ensureImageTag($doc->getElementsByTagName('Repository')->item(0)->nodeValue ?? '');
                    if ($templateName && $templateImage) {
                        $allXmlTemplates[$templateName . '|' . $templateImage] = [
                            'WebUi'             => trim($doc->getElementsByTagName('WebUI')->item(0)->nodeValue ?? ''),
                            'TSUrlRaw'          => trim($doc->getElementsByTagName('TailscaleWebUI')->item(0)->nodeValue ?? ''),
                            'TSServeMode'       => trim($doc->getElementsByTagName('TailscaleServe')->item(0)->nodeValue ?? 'no'),
                            'TSTailscaleEnabled'=> strtolower(trim($doc->getElementsByTagName('TailscaleEnabled')->item(0)->nodeValue ?? 'false')) === 'true',
                            'registry'          => trim($doc->getElementsByTagName('Registry')->item(0)->nodeValue ?? ''),
                            'Support'           => trim($doc->getElementsByTagName('Support')->item(0)->nodeValue ?? ''),
                            'Project'           => trim($doc->getElementsByTagName('Project')->item(0)->nodeValue ?? ''),
                            'DonateLink'        => trim($doc->getElementsByTagName('DonateLink')->item(0)->nodeValue ?? ''),
                            'ReadMe'            => trim($doc->getElementsByTagName('ReadMe')->item(0)->nodeValue ?? ''),
                            'Shell'             => trim($doc->getElementsByTagName('Shell')->item(0)->nodeValue ?? 'sh'),
                            'path'              => $templateFile['path']
                        ];
                    }
                }
            }
            unset($doc);

            foreach ($cts as $key => &$ct) {
                $ct['info'] = $dockerClient->getContainerDetails($ct['Id']);
                if (empty($ct['info'])) { fv3_debug_log("Skipped container due to empty details: ID " . ($ct['Id'] ?? 'N/A')); continue; }

                $containerName = substr($ct['info']['Name'], 1);
                $ct['info']['Name'] = $containerName;
                fv3_debug_log("Processing Container: $containerName (ID: " . ($ct['Id'] ?? 'N/A') . ")");

                $ct['info']['State']['Autostart'] = in_array($containerName, $autoStart);
                $ct['info']['Config']['Image'] = DockerUtil::ensureImageTag($ct['info']['Config']['Image']);
                $ct['info']['State']['Updated'] = $DockerUpdate->getUpdateStatus($ct['info']['Config']['Image']);
                $ct['info']['State']['manager'] = $ct['Labels']['net.unraid.docker.managed'] ?? false;
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
                            $tsFqdn = fv3_get_tailscale_fqdn_from_container($containerName); 
                            if ($tsFqdn) {
                                $finalTsWebUi = str_replace(["[hostname][magicdns]", "[HOSTNAME][MAGICDNS]"], $tsFqdn, $baseTsTemplateFromHelper);
                                if (strpos($baseTsTemplateFromHelper, 'http://[hostname]') === 0) {
                                    $finalTsWebUi = str_replace('http://', 'https://', $finalTsWebUi);
                                }
                            } else { fv3_debug_log("    $containerName: TS WebUI: Could not resolve [hostname] via exec."); $finalTsWebUi = ''; }
                        } elseif (strpos($baseTsTemplateFromHelper, '[noserve]') !== false || strpos($baseTsTemplateFromHelper, '[NOSERVE]') !== false) {
                            $tsIP = fv3_get_tailscale_ip_from_container($containerName); 
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
                    $info[$vm] = [
                        'uuid' => $lv->domain_get_uuid($res), 'name' => $vm,
                        'description' => $lv->domain_get_description($res),
                        'autostart' => $lv->domain_get_autostart($res),
                        'state' => $lv->domain_state_translate($dom['state']),
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
