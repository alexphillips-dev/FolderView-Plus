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
            'folderEditorMode' => 'modern',
            'folderEditorModeExplicit' => false,
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
            'pageViewMode' => 'folderview',
            'themeCompatibilityMode' => 'auto',
            'dashboard' => [
                'layout' => 'classic',
                'expandToggle' => true,
                'greyscale' => false,
                'folderLabel' => true
            ],
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
            'settingsTable' => [
                'widthMode' => 'auto',
                'preset' => 'balanced',
                'columns' => [],
                'columnWidths' => [],
                'nameWidth' => 'standard',
                'actionsWidth' => 'standard'
            ],
            'backupSchedule' => [
                'enabled' => false,
                'intervalHours' => 24,
                'retention' => 25,
                'lastRunAt' => ''
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

    function normalizeFolderEditorMode($value): string {
        return 'modern';
    }

    function resolveFolderEditorModePreference(array $prefs): array {
        return [
            'mode' => normalizeFolderEditorMode('modern'),
            'source' => 'modern-only'
        ];
    }

    function resolveTypeFolderEditorModePreference(string $type): array {
        return resolveFolderEditorModePreference(readTypePrefs($type));
    }

    function normalizeDashboardLayout($value): string {
        $normalized = strtolower(trim((string)$value));
        if (in_array($normalized, ['classic', 'legacy', 'fullwidth', 'accordion', 'inset', 'compactmatrix'], true)) {
            return $normalized;
        }
        return 'classic';
    }

    function normalizeThemeCompatibilityMode($value): string {
        $normalized = strtolower(trim((string)$value));
        if (in_array($normalized, ['auto', 'host', 'safe', 'highcontrast'], true)) {
            return $normalized;
        }
        return 'auto';
    }

    function normalizeRuntimePageViewMode($value): string {
        $normalized = strtolower(trim((string)$value));
        if (in_array($normalized, ['folderview', 'host', 'command', 'service-map', 'tree-explorer'], true)) {
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
        $resolvedFolderEditorMode = resolveFolderEditorModePreference($prefs);
        $normalized['folderEditorModeExplicit'] = false;
        $normalized['folderEditorMode'] = (string)($resolvedFolderEditorMode['mode'] ?? 'modern');
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
                : normalizeBool($dashboardIncoming['folderLabel'], true)
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
        $settingsTableIncoming = is_array($prefs['settingsTable'] ?? null) ? $prefs['settingsTable'] : [];
        $settingsTableWidthMode = strtolower(trim((string)($settingsTableIncoming['widthMode'] ?? 'auto')));
        if (!in_array($settingsTableWidthMode, ['auto', 'custom'], true)) {
            $settingsTableWidthMode = 'auto';
        }
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
            'widthMode' => 'auto',
            'preset' => $settingsTablePreset,
            'columns' => $settingsTableColumns,
            'columnWidths' => [],
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
        $path = getTypePrefsPath($type);
        $normalized = normalizeTypePrefs($prefs);
        writeJsonObjectWithLastGood($path, $normalized);
        return $normalized;
    }
