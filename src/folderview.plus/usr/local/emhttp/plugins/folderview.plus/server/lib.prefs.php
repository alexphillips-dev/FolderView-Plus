<?php
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
            'performanceProfile' => 'standard',
            'performanceMode' => false,
            'lazyPreviewEnabled' => false,
            'lazyPreviewThreshold' => 30,
            'pageViewMode' => 'folderview',
            'themeCompatibilityMode' => 'auto',
            'dashboard' => [
                'layout' => 'classic',
                'expandToggle' => true,
                'greyscale' => false,
                'folderLabel' => true,
                'privacyMode' => false,
                'privacyMaskNames' => true,
                'privacyMaskContainerIps' => true,
                'privacyMaskLocalIps' => true,
                'privacyMaskPorts' => true,
                'privacyMaskVolumePaths' => true,
                'privacyMaskImageRegistry' => true,
                'privacyMaskVmDiskPaths' => true,
                'privacyMaskMacAddresses' => true,
                'privacyMaskPublicIps' => true,
                'privacyMaskInterfaces' => true,
                'privacyMaskExternalUrls' => true,
                'previewContext' => 'native',
                'previewTrigger' => 'click',
                'previewGraph' => 1,
                'previewGraphTime' => 60
            ],
            'health' => [
                'cardsEnabled' => true,
                'runtimeBadgeEnabled' => false,
                'warnStoppedPercent' => 60,
                'criticalStoppedPercent' => 90,
                'profile' => 'balanced',
                'updatesMode' => 'maintenance',
                'allStoppedMode' => 'critical',
                'vmResourceWarnVcpus' => 16,
                'vmResourceCriticalVcpus' => 32,
                'vmResourceWarnGiB' => 32,
                'vmResourceCriticalGiB' => 64
            ],
            'status' => [
                'mode' => 'summary',
                'displayMode' => 'balanced',
                'trendEnabled' => true,
                'attentionAccent' => true,
                'warnStoppedPercent' => 60
            ],
            'settingsTable' => [
                'preset' => 'balanced',
                'columns' => [],
                'nameWidth' => 'standard',
                'actionsWidth' => 'standard'
            ],
            'backupSchedule' => [
                'enabled' => false,
                'intervalHours' => 24,
                'retention' => 25,
                'lastRunAt' => ''
            ],
            'dockerStartOrder' => [
                'mode' => 'docker-page',
                'remaining' => 'after',
                'batches' => []
            ],
            'folderDefaults' => [
                'sourceId' => '',
                'sourceName' => '',
                'profile' => [
                    'icon' => '',
                    'settings' => [],
                    'actions' => []
                ]
            ],
            'importPresets' => [
                'defaultId' => 'builtin:merge',
                'custom' => []
            ]
        ];
    }

    function normalizeTypeFolderDefaultsProfile($value): array {
        $incoming = is_array($value) ? $value : [];
        $profileIncoming = is_array($incoming['profile'] ?? null) ? $incoming['profile'] : [];
        $settingsIncoming = is_array($profileIncoming['settings'] ?? null) ? $profileIncoming['settings'] : [];
        $actionsIncoming = is_array($profileIncoming['actions'] ?? null) ? $profileIncoming['actions'] : [];
        $normalizedActions = [];

        foreach ($actionsIncoming as $action) {
            if (!is_array($action)) {
                continue;
            }
            $actionType = (int)($action['type'] ?? 0);
            if ($actionType !== 1) {
                continue;
            }
            $normalizedAction = $action;
            unset($normalizedAction['containers'], $normalizedAction['conatiners']);
            $normalizedActions[] = normalizeFolderNestedValue($normalizedAction);
        }

        if (($settingsIncoming['override_default_actions'] ?? false) === true && count($normalizedActions) <= 0) {
            $settingsIncoming['override_default_actions'] = false;
        }

        return [
            'sourceId' => truncateUtf8String(trim((string)($incoming['sourceId'] ?? '')), 64),
            'sourceName' => truncateUtf8String(trim((string)($incoming['sourceName'] ?? '')), 160),
            'profile' => [
                'icon' => truncateUtf8String(trim((string)($profileIncoming['icon'] ?? '')), 2048),
                'settings' => normalizeFolderNestedValue($settingsIncoming),
                'actions' => array_values($normalizedActions)
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

    function normalizeDockerStartOrderPrefs($value): array {
        $incoming = is_array($value) ? $value : [];
        $mode = strtolower(trim((string)($incoming['mode'] ?? 'docker-page')));
        if (!in_array($mode, ['docker-page', 'custom-batches'], true)) {
            $mode = 'docker-page';
        }
        $remaining = strtolower(trim((string)($incoming['remaining'] ?? 'after')));
        if (!in_array($remaining, ['after', 'before', 'keep'], true)) {
            $remaining = 'after';
        }

        $batches = [];
        $rawBatches = is_array($incoming['batches'] ?? null) ? $incoming['batches'] : [];
        foreach ($rawBatches as $batch) {
            if (!is_array($batch)) {
                continue;
            }
            $id = trim((string)($batch['id'] ?? ''));
            if ($id === '') {
                $id = generateId(12);
            }
            $name = truncateUtf8String(trim((string)($batch['name'] ?? '')), 64);
            if ($name === '') {
                $name = 'Start batch ' . (count($batches) + 1);
            }
            $items = [];
            $rawItems = is_array($batch['items'] ?? null) ? $batch['items'] : [];
            foreach ($rawItems as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $type = strtolower(trim((string)($item['type'] ?? 'container')));
                if ($type === 'folder') {
                    $folderId = trim((string)($item['id'] ?? $item['folderId'] ?? ''));
                    if ($folderId !== '') {
                        $items[] = [
                            'type' => 'folder',
                            'id' => truncateUtf8String($folderId, 64)
                        ];
                    }
                    continue;
                }
                $nameValue = trim((string)($item['name'] ?? ''));
                if ($nameValue !== '') {
                    $items[] = [
                        'type' => 'container',
                        'name' => truncateUtf8String($nameValue, 255)
                    ];
                }
                if (count($items) >= 2000) {
                    break;
                }
            }
            $batches[] = [
                'id' => truncateUtf8String($id, 64),
                'name' => $name,
                'delay' => normalizeIntInRange($batch['delay'] ?? 0, 0, 3600, 0),
                'parallel' => normalizeBool($batch['parallel'] ?? false, false),
                'useFolderOrder' => !array_key_exists('useFolderOrder', $batch)
                    ? true
                    : normalizeBool($batch['useFolderOrder'], true),
                'items' => $items
            ];
            if (count($batches) >= 100) {
                break;
            }
        }

        return [
            'mode' => $mode,
            'remaining' => $remaining,
            'batches' => $batches
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

    function normalizeDashboardLayout($value): string {
        $normalized = strtolower(trim((string)$value));
        if (in_array($normalized, ['classic', 'legacy', 'fullwidth', 'accordion', 'inset', 'compactmatrix', 'embossed'], true)) {
            return $normalized;
        }
        return 'classic';
    }

    function normalizeDashboardPreviewContext($value): string {
        $normalized = strtolower(trim((string)$value));
        if (in_array($normalized, ['advanced', '2'], true)) {
            return 'advanced';
        }
        return 'native';
    }

    function normalizeDashboardPreviewTrigger($value): string {
        $normalized = strtolower(trim((string)$value));
        if (in_array($normalized, ['hover', '1'], true)) {
            return 'hover';
        }
        return 'click';
    }

    function normalizeThemeCompatibilityMode($value): string {
        $normalized = strtolower(trim((string)$value));
        if (in_array($normalized, ['auto', 'host', 'safe', 'highcontrast'], true)) {
            return $normalized;
        }
        return 'auto';
    }

    function normalizePerformanceProfile($value, bool $legacyPerformanceMode = false): string {
        $normalized = strtolower(trim((string)$value));
        if (in_array($normalized, ['standard', 'adaptive', 'maximum'], true)) {
            return $normalized;
        }
        return $legacyPerformanceMode ? 'adaptive' : 'standard';
    }

    function fvplusPrefsArrayIsList(array $value): bool {
        if (count($value) === 0) {
            return true;
        }
        return array_keys($value) === range(0, count($value) - 1);
    }

    function mergeTypePrefsPatch(array $current, array $patch): array {
        $merged = $current;
        foreach ($patch as $key => $value) {
            $safeKey = (string)$key;
            if ($safeKey === '_metadata') {
                continue;
            }
            $currentValue = $merged[$safeKey] ?? null;
            $valueRepresentsObject = is_array($value) && (
                !fvplusPrefsArrayIsList($value)
                || (count($value) === 0 && is_array($currentValue) && !fvplusPrefsArrayIsList($currentValue))
            );
            $shouldMergeObject = $valueRepresentsObject
                && is_array($currentValue)
                && !fvplusPrefsArrayIsList($currentValue);
            $merged[$safeKey] = $shouldMergeObject
                ? mergeTypePrefsPatch($currentValue, $value)
                : $value;
        }
        return $merged;
    }

    function prefsPatchRequiresSafetyBackup(array $patch, ?array $current = null, ?array $next = null): bool {
        // Atomic last-good writes protect ordinary display toggles. Keep full
        // recovery checkpoints for preference changes that can reshape folder
        // assignment, ordering, automation, imports, or scheduled recovery.
        $recoveryCriticalKeys = [
            'sortMode',
            'manualOrder',
            'pinnedFolderIds',
            'autoRules',
            'backupSchedule',
            'dockerStartOrder',
            'folderDefaults',
            'importPresets'
        ];
        foreach ($recoveryCriticalKeys as $key) {
            if (!array_key_exists($key, $patch)) {
                continue;
            }
            if (is_array($current) && is_array($next)) {
                $before = json_encode($current[$key] ?? null, JSON_UNESCAPED_SLASHES);
                $after = json_encode($next[$key] ?? null, JSON_UNESCAPED_SLASHES);
                if ($before === $after) {
                    continue;
                }
            }
            return true;
        }
        return false;
    }

    function normalizeRuntimePageViewMode($value): string {
        $normalized = strtolower(trim((string)$value));
        if (in_array($normalized, ['folderview', 'host', 'command'], true)) {
            return $normalized;
        }
        return 'folderview';
    }

    function normalizeTypePrefs(array $prefs): array {
        $normalized = defaultTypePrefs();
        $sortMode = $prefs['sortMode'] ?? $normalized['sortMode'];
        if (!in_array($sortMode, ['created', 'created_newest', 'created_oldest', 'updated_newest', 'manual', 'alpha', 'name_desc'], true)) {
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
        $runtimePrefsReady = $runtimePrefsSchema >= FVPLUS_RUNTIME_TOGGLE_PREFS_SCHEMA;
        $privacyModePrefsReady = $runtimePrefsSchema >= FVPLUS_PRIVACY_MODE_PREFS_SCHEMA;
        $normalized['runtimePrefsSchema'] = FVPLUS_RUNTIME_PREFS_SCHEMA;
        $normalized['liveRefreshEnabled'] = $runtimePrefsReady
            ? normalizeBool($prefs['liveRefreshEnabled'] ?? false, false)
            : false;
        $normalized['liveRefreshSeconds'] = normalizeIntInRange($prefs['liveRefreshSeconds'] ?? 20, 10, 300, 20);
        $legacyPerformanceMode = $runtimePrefsReady
            ? normalizeBool($prefs['performanceMode'] ?? false, false)
            : false;
        $normalized['performanceProfile'] = $runtimePrefsReady
            ? normalizePerformanceProfile($prefs['performanceProfile'] ?? '', $legacyPerformanceMode)
            : 'standard';
        $normalized['performanceMode'] = $normalized['performanceProfile'] !== 'standard';
        $normalized['lazyPreviewEnabled'] = $runtimePrefsReady
            ? normalizeBool($prefs['lazyPreviewEnabled'] ?? false, false)
            : false;
        $normalized['lazyPreviewThreshold'] = normalizeIntInRange($prefs['lazyPreviewThreshold'] ?? 30, 10, 200, 30);
        $normalized['pageViewMode'] = normalizeRuntimePageViewMode($prefs['pageViewMode'] ?? 'folderview');
        $normalized['themeCompatibilityMode'] = normalizeThemeCompatibilityMode($prefs['themeCompatibilityMode'] ?? 'auto');
        $dashboardIncoming = is_array($prefs['dashboard'] ?? null) ? $prefs['dashboard'] : [];
        $normalized['dashboard'] = [
            'layout' => normalizeDashboardLayout($dashboardIncoming['layout'] ?? 'classic'),
            'expandToggle' => !array_key_exists('expandToggle', $dashboardIncoming)
                ? true
                : normalizeBool($dashboardIncoming['expandToggle'], true),
            'greyscale' => normalizeBool($dashboardIncoming['greyscale'] ?? false, false),
            'folderLabel' => !array_key_exists('folderLabel', $dashboardIncoming)
                ? true
                : normalizeBool($dashboardIncoming['folderLabel'], true),
            'privacyMode' => $privacyModePrefsReady
                ? normalizeBool($dashboardIncoming['privacyMode'] ?? false, false)
                : false,
            'privacyMaskNames' => !array_key_exists('privacyMaskNames', $dashboardIncoming)
                ? true
                : normalizeBool($dashboardIncoming['privacyMaskNames'], true),
            'privacyMaskContainerIps' => !array_key_exists('privacyMaskContainerIps', $dashboardIncoming)
                ? true
                : normalizeBool($dashboardIncoming['privacyMaskContainerIps'], true),
            'privacyMaskLocalIps' => !array_key_exists('privacyMaskLocalIps', $dashboardIncoming)
                ? true
                : normalizeBool($dashboardIncoming['privacyMaskLocalIps'], true),
            'privacyMaskPorts' => !array_key_exists('privacyMaskPorts', $dashboardIncoming)
                ? true
                : normalizeBool($dashboardIncoming['privacyMaskPorts'], true),
            'privacyMaskVolumePaths' => !array_key_exists('privacyMaskVolumePaths', $dashboardIncoming) ? true : normalizeBool($dashboardIncoming['privacyMaskVolumePaths'], true),
            'privacyMaskImageRegistry' => !array_key_exists('privacyMaskImageRegistry', $dashboardIncoming) ? true : normalizeBool($dashboardIncoming['privacyMaskImageRegistry'], true),
            'privacyMaskVmDiskPaths' => !array_key_exists('privacyMaskVmDiskPaths', $dashboardIncoming) ? true : normalizeBool($dashboardIncoming['privacyMaskVmDiskPaths'], true),
            'privacyMaskMacAddresses' => !array_key_exists('privacyMaskMacAddresses', $dashboardIncoming) ? true : normalizeBool($dashboardIncoming['privacyMaskMacAddresses'], true),
            'privacyMaskPublicIps' => !array_key_exists('privacyMaskPublicIps', $dashboardIncoming) ? true : normalizeBool($dashboardIncoming['privacyMaskPublicIps'], true),
            'privacyMaskInterfaces' => !array_key_exists('privacyMaskInterfaces', $dashboardIncoming) ? true : normalizeBool($dashboardIncoming['privacyMaskInterfaces'], true),
            'privacyMaskExternalUrls' => !array_key_exists('privacyMaskExternalUrls', $dashboardIncoming) ? true : normalizeBool($dashboardIncoming['privacyMaskExternalUrls'], true),
            'previewContext' => normalizeDashboardPreviewContext($dashboardIncoming['previewContext'] ?? 'native'),
            'previewTrigger' => normalizeDashboardPreviewTrigger($dashboardIncoming['previewTrigger'] ?? 'click'),
            'previewGraph' => normalizeIntInRange($dashboardIncoming['previewGraph'] ?? 1, 0, 4, 1),
            'previewGraphTime' => normalizeIntInRange($dashboardIncoming['previewGraphTime'] ?? 60, 5, 600, 60)
        ];
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
        $healthVmResourceWarnVcpus = normalizeIntInRange($healthIncoming['vmResourceWarnVcpus'] ?? 16, 1, 512, 16);
        $healthVmResourceCriticalVcpus = normalizeIntInRange($healthIncoming['vmResourceCriticalVcpus'] ?? 32, 1, 512, 32);
        if ($healthVmResourceCriticalVcpus <= $healthVmResourceWarnVcpus) {
            $healthVmResourceWarnVcpus = min(511, $healthVmResourceWarnVcpus);
            $healthVmResourceCriticalVcpus = min(512, $healthVmResourceWarnVcpus + 1);
        }
        $healthVmResourceWarnGiB = normalizeIntInRange($healthIncoming['vmResourceWarnGiB'] ?? 32, 1, 1024, 32);
        $healthVmResourceCriticalGiB = normalizeIntInRange($healthIncoming['vmResourceCriticalGiB'] ?? 64, 1, 1024, 64);
        if ($healthVmResourceCriticalGiB <= $healthVmResourceWarnGiB) {
            $healthVmResourceWarnGiB = min(1023, $healthVmResourceWarnGiB);
            $healthVmResourceCriticalGiB = min(1024, $healthVmResourceWarnGiB + 1);
        }
        $normalized['health'] = [
            'cardsEnabled' => !array_key_exists('cardsEnabled', $healthIncoming)
                ? true
                : normalizeBool($healthIncoming['cardsEnabled'], true),
            'runtimeBadgeEnabled' => normalizeBool($healthIncoming['runtimeBadgeEnabled'] ?? false, false),
            'warnStoppedPercent' => normalizeIntInRange($healthIncoming['warnStoppedPercent'] ?? 60, 0, 100, 60),
            'criticalStoppedPercent' => normalizeIntInRange($healthIncoming['criticalStoppedPercent'] ?? 90, 0, 100, 90),
            'profile' => $healthProfile,
            'updatesMode' => $healthUpdatesMode,
            'allStoppedMode' => $healthAllStoppedMode,
            'vmResourceWarnVcpus' => $healthVmResourceWarnVcpus,
            'vmResourceCriticalVcpus' => $healthVmResourceCriticalVcpus,
            'vmResourceWarnGiB' => $healthVmResourceWarnGiB,
            'vmResourceCriticalGiB' => $healthVmResourceCriticalGiB
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
        $settingsTableIncoming = is_array($prefs['settingsTable'] ?? null) ? $prefs['settingsTable'] : [];
        $settingsTablePreset = strtolower(trim((string)($settingsTableIncoming['preset'] ?? 'balanced')));
        if (!in_array($settingsTablePreset, ['compact', 'balanced', 'detailed', 'custom'], true)) {
            $settingsTablePreset = 'balanced';
        }
        $settingsTableColumns = is_array($settingsTableIncoming['columns'] ?? null) ? $settingsTableIncoming['columns'] : [];
        $settingsTableNameWidth = strtolower(trim((string)($settingsTableIncoming['nameWidth'] ?? 'standard')));
        if (!in_array($settingsTableNameWidth, ['compact', 'standard', 'wide'], true)) {
            $settingsTableNameWidth = 'standard';
        }
        $settingsTableActionsWidth = strtolower(trim((string)($settingsTableIncoming['actionsWidth'] ?? 'standard')));
        if (!in_array($settingsTableActionsWidth, ['compact', 'standard', 'wide'], true)) {
            $settingsTableActionsWidth = 'standard';
        }
        $normalized['settingsTable'] = [
            'preset' => $settingsTablePreset,
            'columns' => $settingsTableColumns,
            'nameWidth' => $settingsTableNameWidth,
            'actionsWidth' => $settingsTableActionsWidth
        ];

        $scheduleIncoming = is_array($prefs['backupSchedule'] ?? null) ? $prefs['backupSchedule'] : [];
        $normalized['backupSchedule'] = [
            'enabled' => normalizeBool($scheduleIncoming['enabled'] ?? false, false),
            'intervalHours' => normalizeIntInRange($scheduleIncoming['intervalHours'] ?? 24, 1, 168, 24),
            'retention' => normalizeIntInRange($scheduleIncoming['retention'] ?? 25, 1, 200, 25),
            'lastRunAt' => is_string($scheduleIncoming['lastRunAt'] ?? null) ? (string)$scheduleIncoming['lastRunAt'] : ''
        ];
        $normalized['dockerStartOrder'] = normalizeDockerStartOrderPrefs($prefs['dockerStartOrder'] ?? []);
        $normalized['folderDefaults'] = normalizeTypeFolderDefaultsProfile($prefs['folderDefaults'] ?? []);
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
        $normalized = normalizeTypePrefs($prefs);
        withConfigMutationLock(static function () use ($type, $normalized): void {
            $path = getTypePrefsPath($type);
            $metadata = readConfigMetadata($type, true);
            writeJsonObjectWithLastGood($path, $normalized);
            commitConfigMetadataWrite($type, 'prefs', $path, $metadata);
        });
        return $normalized;
    }
