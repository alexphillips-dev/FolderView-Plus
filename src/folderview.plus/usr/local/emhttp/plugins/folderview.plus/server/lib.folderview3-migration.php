<?php
function fvplusFolderView3ConfigDir(): string {
    $override = trim((string)getenv('FVPLUS_TEST_FOLDER_VIEW3_CONFIG_DIR'));
    return $override !== '' ? rtrim($override, '/\\') : '/boot/config/plugins/folder.view3';
}

function fvplusFolderView3ReadJsonFile(string $path, int $maxBytes = 2097152): array {
    if (!is_file($path) || !is_readable($path)) {
        return [];
    }
    $size = @filesize($path);
    if (is_int($size) && $size > $maxBytes) {
        throw new RuntimeException('FolderView3 configuration file exceeds the supported migration size.');
    }
    $raw = @file_get_contents($path);
    if (!is_string($raw) || strlen($raw) > $maxBytes) {
        throw new RuntimeException('FolderView3 configuration file could not be read safely.');
    }
    $decoded = @json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('FolderView3 configuration contains invalid JSON.');
    }
    return $decoded;
}

function fvplusFolderView3ReadInstalledBundle(): array {
    $configDir = fvplusFolderView3ConfigDir();
    if (!is_dir($configDir)) {
        throw new RuntimeException('FolderView3 installation was not detected.');
    }
    $bundle = [
        'fv3_export_version' => 1,
        'plugin_version' => truncateUtf8String(trim((string)@file_get_contents($configDir . '/version')), 128),
        'unraid_version' => '',
        'exported' => gmdate('c'),
        'docker' => fvplusFolderView3ReadJsonFile($configDir . '/docker.json'),
        'vm' => fvplusFolderView3ReadJsonFile($configDir . '/vm.json'),
        'settings' => fvplusFolderView3ReadJsonFile($configDir . '/settings.json'),
        'autostart' => fvplusFolderView3ReadJsonFile($configDir . '/autostart.json'),
        'css_config' => fvplusFolderView3ReadJsonFile($configDir . '/css-config.json'),
        'organizer_registry' => fvplusFolderView3ReadJsonFile($configDir . '/organizer-registry.json'),
        'custom_styles' => [],
        '_source_kind' => 'installed'
    ];

    $stylesDir = $configDir . '/styles';
    $stylesReal = is_dir($stylesDir) ? realpath($stylesDir) : false;
    $styleBytes = 0;
    if (is_string($stylesReal) && $stylesReal !== '') {
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($stylesReal, RecursiveDirectoryIterator::SKIP_DOTS)
        );
        foreach ($iterator as $item) {
            if (!$item->isFile() || !preg_match('/\.css$/i', $item->getFilename()) || preg_match('/^_fv3-generated\./', $item->getFilename())) {
                continue;
            }
            $itemReal = $item->getRealPath();
            if (!is_string($itemReal) || strpos($itemReal, $stylesReal . DIRECTORY_SEPARATOR) !== 0) {
                continue;
            }
            $content = @file_get_contents($itemReal);
            if (!is_string($content)) {
                continue;
            }
            $styleBytes += strlen($content);
            if ($styleBytes > 2097152 || count($bundle['custom_styles']) >= 128) {
                $bundle['css_skipped'] = true;
                $bundle['css_skipped_reason'] = 'Installed FolderView3 custom styles exceeded the safe migration preview limit.';
                $bundle['custom_styles'] = [];
                break;
            }
            $relative = str_replace('\\', '/', substr($itemReal, strlen($stylesReal) + 1));
            $bundle['custom_styles'][$relative] = $content;
        }
    }

    $dockerMan = @parse_ini_file('/boot/config/plugins/dockerMan/dockerMan.cfg') ?: [];
    $autoStartFile = (string)($dockerMan['autostart-file'] ?? '/var/lib/docker/unraid-autostart');
    if (is_file($autoStartFile) && is_readable($autoStartFile) && (int)@filesize($autoStartFile) <= 524288) {
        $bundle['native_autostart'] = (array)@file($autoStartFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    }
    return fvplusFolderView3NormalizeBundle($bundle);
}

function detectFolderView3Installation(): array {
    $configDir = fvplusFolderView3ConfigDir();
    $files = ['docker.json', 'vm.json', 'settings.json', 'autostart.json', 'css-config.json', 'organizer-registry.json'];
    $present = [];
    foreach ($files as $file) {
        if (is_file($configDir . '/' . $file) && is_readable($configDir . '/' . $file)) {
            $present[] = $file;
        }
    }
    $available = is_dir($configDir) && count($present) > 0;
    $result = [
        'available' => $available,
        'pluginVersion' => $available ? truncateUtf8String(trim((string)@file_get_contents($configDir . '/version')), 128) : '',
        'componentCount' => count($present),
        'components' => $present,
        'canPreview' => $available && (in_array('docker.json', $present, true) || in_array('vm.json', $present, true))
    ];
    if ($available) {
        $bundle = fvplusFolderView3ReadInstalledBundle();
        $result['dockerFolderCount'] = count((array)($bundle['docker'] ?? []));
        $result['vmFolderCount'] = count((array)($bundle['vm'] ?? []));
        $result['customStyleCount'] = count((array)($bundle['custom_styles'] ?? []));
        $result['nativeAutostartCount'] = count((array)($bundle['native_autostart'] ?? []));
    }
    return $result;
}

function fvplusFolderView3NormalizeBundle(array $bundle): array {
    $normalized = [
        'fv3_export_version' => (int)($bundle['fv3_export_version'] ?? 0),
        'plugin_version' => truncateUtf8String(trim((string)($bundle['plugin_version'] ?? '')), 128),
        'unraid_version' => truncateUtf8String(trim((string)($bundle['unraid_version'] ?? '')), 128),
        'exported' => normalizeIsoTimestamp((string)($bundle['exported'] ?? '')),
        'docker' => is_array($bundle['docker'] ?? null) ? $bundle['docker'] : [],
        'vm' => is_array($bundle['vm'] ?? null) ? $bundle['vm'] : [],
        'settings' => is_array($bundle['settings'] ?? null) ? $bundle['settings'] : [],
        'autostart' => is_array($bundle['autostart'] ?? null) ? $bundle['autostart'] : [],
        'css_config' => is_array($bundle['css_config'] ?? null) ? $bundle['css_config'] : [],
        'custom_styles' => is_array($bundle['custom_styles'] ?? null) ? $bundle['custom_styles'] : [],
        'organizer_registry' => is_array($bundle['organizer_registry'] ?? null) ? $bundle['organizer_registry'] : [],
        'native_autostart' => is_array($bundle['native_autostart'] ?? null) ? $bundle['native_autostart'] : [],
        'css_skipped' => !empty($bundle['css_skipped']),
        'css_skipped_reason' => truncateUtf8String(trim((string)($bundle['css_skipped_reason'] ?? '')), 280),
        '_source_kind' => (string)($bundle['_source_kind'] ?? 'export') === 'installed' ? 'installed' : 'export'
    ];
    if ($normalized['fv3_export_version'] !== 1) {
        throw new RuntimeException('Unsupported FolderView3 export version.');
    }
    $styles = [];
    $styleBytes = 0;
    foreach ($normalized['custom_styles'] as $path => $content) {
        $safePath = str_replace('\\', '/', trim((string)$path));
        if ($safePath === '' || strpos($safePath, '..') !== false || !preg_match('/\.css$/i', $safePath) || !is_string($content)) {
            continue;
        }
        $styleBytes += strlen($content);
        if ($styleBytes > 2097152 || count($styles) >= 128) {
            $styles = [];
            $normalized['css_skipped'] = true;
            $normalized['css_skipped_reason'] = 'FolderView3 custom styles exceeded the safe migration preview limit.';
            break;
        }
        $styles[$safePath] = $content;
    }
    $normalized['custom_styles'] = $styles;
    return $normalized;
}

function decodeFolderView3BundlePayloadString(string $rawPayload): array {
    if (strlen($rawPayload) > 5242880) {
        throw new RuntimeException('FolderView3 export exceeds the 5 MB migration limit.');
    }
    $trimmed = trim($rawPayload);
    if ($trimmed === '') {
        throw new RuntimeException('FolderView3 export payload is empty.');
    }
    $decoded = @json_decode($trimmed, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('FolderView3 export is not valid JSON.');
    }
    return fvplusFolderView3NormalizeBundle($decoded);
}

function fvplusFolderView3BuildType(array $sourceFolders, array $settings, string $type, array &$warnings): array {
    $candidateFolders = [];
    $rules = [];
    foreach ($sourceFolders as $id => $folder) {
        if (!is_array($folder)) {
            continue;
        }
        $safeId = normalizeFolderIdValue($id);
        if ($safeId === '') {
            $warnings[] = ucfirst($type) . ' contained a folder with an unsupported identifier; that folder was skipped.';
            continue;
        }
        $candidate = $folder;
        $containers = is_array($candidate['containers'] ?? null) ? array_values($candidate['containers']) : [];
        $ids = is_array($candidate['containerIds'] ?? null) ? $candidate['containerIds'] : [];
        $images = is_array($candidate['containerImages'] ?? null) ? $candidate['containerImages'] : [];
        $identities = [];
        foreach ($containers as $index => $name) {
            $memberName = trim((string)$name);
            if ($memberName === '') {
                continue;
            }
            $containerId = trim((string)($ids[$memberName] ?? ($ids[$index] ?? '')));
            $image = trim((string)($images[$memberName] ?? ($images[$index] ?? '')));
            if ($containerId !== '' || $image !== '') {
                $identities[$memberName] = ['kind' => $type === 'vm' ? 'vm' : 'docker', 'containerId' => $containerId, 'image' => $image];
            }
        }
        if (count($identities) > 0 && $type === 'docker') {
            $candidate['memberIdentities'] = $identities;
        }
        $regex = trim((string)($candidate['regex'] ?? ''));
        if ($regex !== '') {
            $rules[] = [
                'id' => 'fv3-regex-' . $type . '-' . substr(hash('sha256', $safeId . "\n" . $regex), 0, 16),
                'enabled' => true,
                'folderId' => $safeId,
                'effect' => 'include',
                'kind' => 'name_regex',
                'pattern' => truncateUtf8String($regex, 1024),
                'labelKey' => '',
                'labelValue' => ''
            ];
        }
        $candidate['regex'] = '';
        unset($candidate['containerIds'], $candidate['containerImages']);
        $candidateFolders[$safeId] = $candidate;
    }
    $folders = normalizeFolderMapPayload($candidateFolders);
    $prefs = defaultTypePrefs();
    $prefs['sortMode'] = 'manual';
    $prefs['manualOrder'] = array_keys($folders);
    $prefs['autoRules'] = $rules;
    $layoutKey = $type === 'vm' ? 'dashboard_vm_layout' : 'dashboard_docker_layout';
    $prefix = $type === 'vm' ? 'dashboard_vm_' : 'dashboard_docker_';
    $prefs['dashboard'] = array_merge($prefs['dashboard'], [
        'layout' => normalizeDashboardLayout($settings[$layoutKey] ?? 'classic'),
        'expandToggle' => ($settings[$prefix . 'expand_toggle'] ?? 'yes') !== 'no',
        'greyscale' => ($settings[$prefix . 'greyscale'] ?? 'no') === 'yes',
        'folderLabel' => ($settings[$prefix . 'folder_label'] ?? 'yes') !== 'no',
        'previewContext' => normalizeDashboardPreviewContext($settings['dashboard_context'] ?? '0'),
        'previewTrigger' => normalizeDashboardPreviewTrigger($settings['dashboard_context_trigger'] ?? '0'),
        'previewGraph' => normalizeIntInRange($settings['dashboard_context_graph'] ?? 1, 0, 4, 1),
        'previewGraphTime' => normalizeIntInRange($settings['dashboard_context_graph_time'] ?? 60, 5, 600, 60)
    ]);
    $defaultSettings = [
        'preview' => normalizeIntInRange($settings['default_preview'] ?? 1, 0, 4, 1),
        'preview_hover' => ($settings['default_preview_hover'] ?? 'no') === 'yes',
        'preview_status' => (string)($settings['default_preview_status'] ?? 'none'),
        'preview_grayscale' => ($settings['default_preview_grayscale'] ?? 'no') === 'yes',
        'preview_webui' => ($settings['default_preview_webui'] ?? 'no') === 'yes',
        'preview_logs' => ($settings['default_preview_logs'] ?? 'no') === 'yes',
        'preview_console' => ($settings['default_preview_console'] ?? 'no') === 'yes',
        'preview_update' => ($settings['default_preview_update'] ?? 'no') === 'yes',
        'preview_vertical_bars' => ($settings['default_preview_vertical_bars'] ?? 'no') === 'yes',
        'preview_vertical_bars_color' => (string)($settings['default_vertical_bars_color'] ?? ''),
        'preview_border' => ($settings['default_preview_border'] ?? 'no') === 'yes',
        'preview_border_color' => (string)($settings['default_border_color'] ?? ''),
        'preview_row_separator' => ($settings['default_row_separator'] ?? 'no') === 'yes',
        'preview_row_separator_color' => (string)($settings['default_separator_color'] ?? ''),
        'preview_text_width' => (string)($settings['default_preview_text_width'] ?? ''),
        'preview_overflow' => (string)($settings['default_overflow'] ?? 'default'),
        'context' => normalizeIntInRange($settings['default_context'] ?? 1, 0, 3, 1),
        'update_column' => ($settings['default_update_column'] ?? 'no') === 'yes'
    ];
    $prefs['folderDefaults'] = [
        'sourceId' => 'folderview3-global-defaults',
        'sourceName' => 'FolderView3 global defaults',
        'profile' => ['icon' => '', 'settings' => $defaultSettings, 'actions' => []]
    ];
    return ['folders' => $folders, 'prefs' => normalizeTypePrefs($prefs), 'ruleCount' => count($rules)];
}

function fvplusFolderView3BuildStartOrder(array $autostart): array {
    $mode = strtolower(trim((string)($autostart['mode'] ?? 'folder')));
    $sequence = [];
    foreach ((array)($autostart['sequence'] ?? []) as $name) {
        $safeName = truncateUtf8String(trim((string)$name), 255);
        if ($safeName !== '' && preg_match('/^[A-Za-z0-9][A-Za-z0-9_.-]*$/', $safeName) && !in_array($safeName, $sequence, true)) {
            $sequence[] = $safeName;
        }
    }
    if ($mode === 'off') {
        return normalizeDockerStartOrderPrefs(['mode' => 'unmanaged']);
    }
    if ($mode !== 'custom') {
        return normalizeDockerStartOrderPrefs(['mode' => 'docker-page']);
    }
    return normalizeDockerStartOrderPrefs([
        'mode' => 'custom-batches',
        'remaining' => 'keep',
        'batches' => [[
            'id' => 'folderview3-custom-sequence',
            'name' => 'FolderView3 custom sequence',
            'delay' => 0,
            'parallel' => false,
            'useFolderOrder' => false,
            'items' => array_map(static fn(string $name): array => ['type' => 'container', 'name' => $name], $sequence)
        ]]
    ]);
}

function fvplusFolderView3SafeCssValue($value): string {
    $safe = truncateUtf8String(trim((string)$value), 200);
    if ($safe === '' || preg_match('/(?:expression\s*\(|javascript\s*:|@import\b|url\s*\()/i', $safe)) {
        return '';
    }
    return trim(str_replace([';', '{', '}', '<', '>', "\0"], '', $safe));
}

function fvplusFolderView3BuildThemeProfile(array $bundle, array &$warnings): array {
    $config = (array)($bundle['css_config'] ?? []);
    $profile = fvplusThemeProfileDefault(
        'folderview3-import-' . substr(hash('sha256', json_encode($config, JSON_UNESCAPED_SLASHES)), 0, 12),
        'FolderView3 imported appearance'
    );
    $pageValues = is_array($config['page_values'] ?? null) ? $config['page_values'] : [];
    foreach (['global', 'docker', 'vm', 'dashboard'] as $scope) {
        $variableSource = is_array($config[$scope] ?? null) ? $config[$scope] : [];
        if ($scope !== 'global' && is_array($pageValues[$scope] ?? null)) {
            $variableSource = array_merge($variableSource, $pageValues[$scope]);
        }
        $declarations = [];
        foreach ($variableSource as $name => $value) {
            $safeName = preg_replace('/[^A-Za-z0-9_-]/', '', (string)$name);
            $safeValue = fvplusFolderView3SafeCssValue($value);
            if ($safeName !== '' && $safeValue !== '') {
                $declarations[] = '  --' . $safeName . ': ' . $safeValue . ';';
            }
        }
        $chunks = [];
        if (count($declarations) > 0) {
            $chunks[] = ":root {\n" . implode("\n", $declarations) . "\n}";
        }
        $customKey = $scope === 'global' ? 'custom_css' : 'custom_css_' . $scope;
        $customCss = trim((string)($config[$customKey] ?? ''));
        if ($customCss !== '') {
            $scan = fvplusThemeWorkspaceScanCss($customCss);
            if (count((array)($scan['severe'] ?? [])) > 0) {
                $warnings[] = 'Unsafe FolderView3 ' . $scope . ' custom CSS was excluded from the migration profile.';
            } else {
                $chunks[] = $customCss;
            }
        }
        if ($scope === 'global') {
            foreach ((array)($bundle['custom_styles'] ?? []) as $path => $content) {
                $scan = fvplusThemeWorkspaceScanCss((string)$content);
                if (count((array)($scan['severe'] ?? [])) > 0) {
                    $warnings[] = 'A FolderView3 custom style was excluded because it failed the CSS safety scan.';
                    continue;
                }
                $chunks[] = '/* FolderView3 custom style: ' . basename((string)$path) . " */\n" . (string)$content;
            }
        }
        $combined = trim(implode("\n\n", $chunks));
        if (strlen($combined) > FVPLUS_THEME_WORKSPACE_MAX_CUSTOM_CSS_BYTES) {
            $combined = truncateUtf8String($combined, FVPLUS_THEME_WORKSPACE_MAX_CUSTOM_CSS_BYTES);
            $warnings[] = 'FolderView3 ' . $scope . ' CSS was truncated to the FolderView Plus profile limit.';
        }
        $profile['layers'][$scope] = fvplusThemeProfileNormalizeLayer(['customCss' => $combined]);
    }
    return fvplusThemeProfileNormalize($profile);
}

function fvplusFolderView3NormalizeNativeAutostart(array $lines): array {
    $entries = [];
    foreach (array_slice($lines, 0, 2000) as $line) {
        $parts = preg_split('/\s+/', trim((string)$line), 2);
        $name = truncateUtf8String(trim((string)($parts[0] ?? '')), 255);
        if ($name === '' || !preg_match('/^[A-Za-z0-9][A-Za-z0-9_.-]*$/', $name)) {
            continue;
        }
        $entries[] = ['name' => $name, 'wait' => normalizeIntInRange($parts[1] ?? 0, 0, 3600, 0)];
    }
    return $entries;
}

function buildFolderView3MigrationPlan(array $bundle, string $sourceName = ''): array {
    $source = fvplusFolderView3NormalizeBundle($bundle);
    $warnings = [];
    $docker = fvplusFolderView3BuildType((array)$source['docker'], (array)$source['settings'], 'docker', $warnings);
    $vm = fvplusFolderView3BuildType((array)$source['vm'], (array)$source['settings'], 'vm', $warnings);
    $docker['prefs']['dockerStartOrder'] = fvplusFolderView3BuildStartOrder((array)$source['autostart']);
    $docker['prefs'] = normalizeTypePrefs($docker['prefs']);

    $workspace = readThemeWorkspace();
    $profile = fvplusFolderView3BuildThemeProfile($source, $warnings);
    $profiles = array_values(array_filter((array)($workspace['profiles'] ?? []), static function($existing) use ($profile): bool {
        return (string)($existing['id'] ?? '') !== (string)$profile['id'];
    }));
    $profiles[] = $profile;
    $workspace['profiles'] = $profiles;
    $workspace = normalizeThemeWorkspacePayload($workspace);
    $nativeAutostart = fvplusFolderView3NormalizeNativeAutostart((array)$source['native_autostart']);
    $organizerFolders = array_values(array_filter((array)($source['organizer_registry']['folders'] ?? []), 'is_string'));
    if (count($organizerFolders) > 0) {
        $warnings[] = 'FolderView3 organizer registry entries are reported but are not converted into FolderView Plus folders.';
    }
    if (!empty($source['css_skipped'])) {
        $warnings[] = $source['css_skipped_reason'] !== '' ? $source['css_skipped_reason'] : 'Some FolderView3 CSS was unavailable for migration.';
    }
    if ($docker['ruleCount'] + $vm['ruleCount'] > 0) {
        $warnings[] = 'FolderView3 regex rules are converted in folder order; manual members remain explicit assignments.';
    }
    $warnings[] = 'The imported FolderView3 appearance profile remains inactive until it is reviewed and activated manually.';

    $target = normalizeEnvironmentSnapshotPayload([
        'kind' => FVPLUS_ENVIRONMENT_SNAPSHOT_KIND,
        'schemaVersion' => FVPLUS_ENVIRONMENT_SNAPSHOT_SCHEMA_VERSION,
        'pluginVersion' => readInstalledVersion(),
        'exportedAt' => gmdate('c'),
        'types' => [
            'docker' => ['folders' => $docker['folders'], 'prefs' => $docker['prefs']],
            'vm' => ['folders' => $vm['folders'], 'prefs' => $vm['prefs']]
        ],
        'themeWorkspace' => $workspace
    ]);
    $sourceDigest = hash('sha256', json_encode($source, JSON_UNESCAPED_SLASHES));
    $operations = [
        ['id' => 'docker-folders', 'category' => 'folders', 'label' => 'Replace Docker folders', 'selected' => true, 'count' => count($docker['folders'])],
        ['id' => 'vm-folders', 'category' => 'folders', 'label' => 'Replace VM folders', 'selected' => true, 'count' => count($vm['folders'])],
        ['id' => 'docker-rules', 'category' => 'rules', 'label' => 'Convert Docker regex rules', 'selected' => true, 'count' => $docker['ruleCount']],
        ['id' => 'vm-rules', 'category' => 'rules', 'label' => 'Convert VM regex rules', 'selected' => true, 'count' => $vm['ruleCount']],
        ['id' => 'settings-defaults', 'category' => 'settings', 'label' => 'Convert compatible settings and defaults', 'selected' => true, 'count' => count((array)$source['settings'])],
        ['id' => 'docker-start-order', 'category' => 'autostart', 'label' => 'Convert FolderView3 start-order ownership', 'selected' => true, 'count' => count((array)($source['autostart']['sequence'] ?? []))],
        ['id' => 'appearance-profile', 'category' => 'appearance', 'label' => 'Add inactive FolderView3 appearance profile', 'selected' => true, 'count' => count((array)$source['custom_styles'])],
        ['id' => 'native-autostart', 'category' => 'host', 'label' => 'Reapply native Docker autostart enablement and waits', 'selected' => false, 'count' => count($nativeAutostart)],
        ['id' => 'organizer-registry', 'category' => 'unmapped', 'label' => 'FolderView3 native organizer registry', 'selected' => false, 'count' => count($organizerFolders)]
    ];
    return [
        'kind' => 'folderview3_migration_plan',
        'schemaVersion' => 1,
        'createdAt' => gmdate('c'),
        'source' => [
            'kind' => $source['_source_kind'],
            'sourceName' => truncateUtf8String(trim($sourceName), 255),
            'pluginVersion' => $source['plugin_version'],
            'unraidVersion' => $source['unraid_version'],
            'exportedAt' => $source['exported'],
            'digest' => $sourceDigest
        ],
        'target' => $target,
        'nativeAutostart' => $nativeAutostart,
        'operations' => $operations,
        'warnings' => array_values(array_unique($warnings)),
        'summary' => [
            'dockerFolderCount' => count($docker['folders']),
            'vmFolderCount' => count($vm['folders']),
            'dockerRuleCount' => $docker['ruleCount'],
            'vmRuleCount' => $vm['ruleCount'],
            'appearanceProfileId' => (string)$profile['id'],
            'appearanceProfileActive' => (string)($workspace['activeProfileId'] ?? '') === (string)$profile['id'],
            'startOrderMode' => (string)($docker['prefs']['dockerStartOrder']['mode'] ?? 'docker-page'),
            'nativeAutostartCount' => count($nativeAutostart),
            'organizerRegistryCount' => count($organizerFolders)
        ]
    ];
}

function folderView3MigrationReport(array $plan): array {
    return [
        'kind' => (string)($plan['kind'] ?? 'folderview3_migration_plan'),
        'schemaVersion' => (int)($plan['schemaVersion'] ?? 1),
        'createdAt' => (string)($plan['createdAt'] ?? gmdate('c')),
        'source' => (array)($plan['source'] ?? []),
        'summary' => (array)($plan['summary'] ?? []),
        'operations' => array_values((array)($plan['operations'] ?? [])),
        'warnings' => array_values((array)($plan['warnings'] ?? []))
    ];
}

function previewFolderView3Migration(array $bundle, string $sourceName = ''): array {
    return folderView3MigrationReport(buildFolderView3MigrationPlan($bundle, $sourceName));
}
