(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./folderviewplus.utils-foundation.js'), require('./folderviewplus.utils-normalization.js'));
        return;
    }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.utilityPrefs = factory(modules.utilityFoundation, modules.utilityNormalization);
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function(utilityFoundation, utilityNormalization) {
    'use strict';
    const utilityDependencies = Object.assign({}, utilityFoundation, utilityNormalization);
    const {
        isPlainObject,
        RULE_KINDS,
        RULE_EFFECTS,
        RUNTIME_PREFS_SCHEMA,
        RUNTIME_TOGGLE_PREFS_SCHEMA,
        PRIVACY_MODE_PREFS_SCHEMA,
        DEFAULT_HEALTH_PREFS,
        DEFAULT_STATUS_PREFS,
        DEFAULT_DASHBOARD_PREFS,
        DEFAULT_DOCKER_START_ORDER,
        clampNumber,
        normalizeStringIdList,
        normalizeExpandedFolderStateMap,
        normalizeHealthProfile,
        normalizeHealthUpdatesMode,
        normalizeHealthAllStoppedMode,
        normalizeAppColumnWidth,
        normalizeDashboardLayout,
        normalizeDashboardPreviewContext,
        normalizeDashboardPreviewTrigger,
        normalizeThemeCompatibilityMode,
        normalizePerformanceProfile,
        normalizeRuntimePageViewMode,
        FOLDER_SORT_MODES
    } = utilityDependencies;

    const normalizePrefs = (prefs) => {
        const incoming = isPlainObject(prefs) ? prefs : {};
        const incomingMetadata = isPlainObject(incoming._metadata) ? incoming._metadata : {};
        const metadata = {
            schemaVersion: Math.max(0, Number.parseInt(String(incomingMetadata.schemaVersion ?? '0'), 10) || 0),
            type: String(incomingMetadata.type || '').trim(),
            folderRevision: Math.max(0, Number.parseInt(String(incomingMetadata.folderRevision ?? '0'), 10) || 0),
            prefsRevision: Math.max(0, Number.parseInt(String(incomingMetadata.prefsRevision ?? '0'), 10) || 0),
            updatedAt: String(incomingMetadata.updatedAt || '').trim()
        };
        const sortMode = FOLDER_SORT_MODES.includes(incoming.sortMode) ? incoming.sortMode : 'created';
        const manualOrder = Array.isArray(incoming.manualOrder) ? incoming.manualOrder.filter((id) => typeof id === 'string' && id !== '') : [];
        const autoRulesRaw = Array.isArray(incoming.autoRules) ? incoming.autoRules : [];
        const defaultSchedule = {
            enabled: false,
            intervalHours: 24,
            retention: 25,
            lastRunAt: ''
        };
        const autoRules = autoRulesRaw
            .filter((rule) => isPlainObject(rule))
            .map((rule) => ({
                id: typeof rule.id === 'string' && rule.id ? rule.id : '',
                enabled: rule.enabled !== false,
                folderId: typeof rule.folderId === 'string' ? rule.folderId : '',
                kind: RULE_KINDS.includes(rule.kind) ? rule.kind : 'name_regex',
                effect: RULE_EFFECTS.includes(rule.effect) ? rule.effect : 'include',
                pattern: typeof rule.pattern === 'string' ? rule.pattern : '',
                labelKey: typeof rule.labelKey === 'string' ? rule.labelKey : '',
                labelValue: typeof rule.labelValue === 'string' ? rule.labelValue : ''
            }))
            .filter((rule) => rule.folderId !== '');
        const incomingBadges = isPlainObject(incoming.badges) ? incoming.badges : {};
        const badges = {
            running: !Object.prototype.hasOwnProperty.call(incomingBadges, 'running') ? true : incomingBadges.running !== false,
            stopped: incomingBadges.stopped === true,
            updates: !Object.prototype.hasOwnProperty.call(incomingBadges, 'updates') ? true : incomingBadges.updates !== false
        };
        const backupScheduleRaw = isPlainObject(incoming.backupSchedule) ? incoming.backupSchedule : {};
        const backupSchedule = {
            enabled: backupScheduleRaw.enabled === true,
            intervalHours: clampNumber(backupScheduleRaw.intervalHours, 1, 168, defaultSchedule.intervalHours),
            retention: clampNumber(backupScheduleRaw.retention, 1, 200, defaultSchedule.retention),
            lastRunAt: typeof backupScheduleRaw.lastRunAt === 'string' ? backupScheduleRaw.lastRunAt : ''
        };
        const folderDefaultsRaw = isPlainObject(incoming.folderDefaults) ? incoming.folderDefaults : {};
        const folderDefaultsProfileRaw = isPlainObject(folderDefaultsRaw.profile) ? folderDefaultsRaw.profile : {};
        const folderDefaultsSettings = isPlainObject(folderDefaultsProfileRaw.settings)
            ? JSON.parse(JSON.stringify(folderDefaultsProfileRaw.settings))
            : {};
        const folderDefaultsActionsRaw = Array.isArray(folderDefaultsProfileRaw.actions) ? folderDefaultsProfileRaw.actions : [];
        const folderDefaultsActions = [];
        folderDefaultsActionsRaw.forEach((entry) => {
            if (!isPlainObject(entry)) {
                return;
            }
            const actionType = Number.parseInt(entry.type, 10);
            if (actionType !== 1) {
                return;
            }
            const cloned = JSON.parse(JSON.stringify(entry));
            delete cloned.containers;
            delete cloned.conatiners;
            folderDefaultsActions.push(cloned);
        });
        if (folderDefaultsSettings.override_default_actions === true && folderDefaultsActions.length <= 0) {
            folderDefaultsSettings.override_default_actions = false;
        }
        const folderDefaults = {
            sourceId: typeof folderDefaultsRaw.sourceId === 'string' ? folderDefaultsRaw.sourceId.trim().slice(0, 64) : '',
            sourceName: typeof folderDefaultsRaw.sourceName === 'string' ? folderDefaultsRaw.sourceName.trim().slice(0, 160) : '',
            profile: {
                icon: typeof folderDefaultsProfileRaw.icon === 'string' ? folderDefaultsProfileRaw.icon.trim().slice(0, 2048) : '',
                settings: folderDefaultsSettings,
                actions: folderDefaultsActions
            }
        };
        const importPresetsRaw = isPlainObject(incoming.importPresets) ? incoming.importPresets : {};
        const importPresetCustomRaw = Array.isArray(importPresetsRaw.custom) ? importPresetsRaw.custom : [];
        const importPresetCustom = [];
        const importPresetIds = new Set();
        for (const row of importPresetCustomRaw) {
            if (!isPlainObject(row)) {
                continue;
            }
            const id = typeof row.id === 'string' ? row.id.trim() : '';
            const name = typeof row.name === 'string' ? row.name.trim() : '';
            if (!id || !name || id.startsWith('builtin:') || importPresetIds.has(id)) {
                continue;
            }
            importPresetIds.add(id);
            importPresetCustom.push({
                id: id.slice(0, 96),
                name: name.slice(0, 64),
                mode: ['replace', 'skip'].includes(String(row.mode || '').trim().toLowerCase()) ? String(row.mode || '').trim().toLowerCase() : 'merge',
                dryRunOnly: row.dryRunOnly === true
            });
            if (importPresetCustom.length >= 30) {
                break;
            }
        }
        const defaultImportPresetIdRaw = typeof importPresetsRaw.defaultId === 'string' ? importPresetsRaw.defaultId.trim() : 'builtin:merge';
        const importPresetBuiltinIds = new Set(['builtin:merge', 'builtin:replace', 'builtin:skip', 'builtin:dryrun']);
        const importPresetCustomIds = new Set(importPresetCustom.map((row) => row.id));
        const defaultImportPresetId = (
            importPresetBuiltinIds.has(defaultImportPresetIdRaw) || importPresetCustomIds.has(defaultImportPresetIdRaw)
        )
            ? defaultImportPresetIdRaw
            : 'builtin:merge';
        const importPresets = {
            defaultId: defaultImportPresetId,
            custom: importPresetCustom
        };
        const startOrderRaw = isPlainObject(incoming.dockerStartOrder) ? incoming.dockerStartOrder : {};
        const startOrderMode = String(startOrderRaw.mode || '').trim().toLowerCase();
        const startOrderRemaining = String(startOrderRaw.remaining || '').trim().toLowerCase();
        const startOrderBatches = [];
        const startOrderBatchRaw = Array.isArray(startOrderRaw.batches) ? startOrderRaw.batches : [];
        startOrderBatchRaw.forEach((batch, index) => {
            if (!isPlainObject(batch) || startOrderBatches.length >= 100) {
                return;
            }
            const items = [];
            const rawItems = Array.isArray(batch.items) ? batch.items : [];
            rawItems.forEach((item) => {
                if (!isPlainObject(item) || items.length >= 2000) {
                    return;
                }
                const itemType = String(item.type || '').trim().toLowerCase();
                if (itemType === 'folder') {
                    const id = typeof item.id === 'string' ? item.id.trim() : '';
                    if (id) {
                        items.push({ type: 'folder', id: id.slice(0, 64) });
                    }
                    return;
                }
                const name = typeof item.name === 'string' ? item.name.trim() : '';
                if (name) {
                    items.push({ type: 'container', name: name.slice(0, 255) });
                }
            });
            const name = typeof batch.name === 'string' && batch.name.trim()
                ? batch.name.trim().slice(0, 64)
                : `Start batch ${index + 1}`;
            startOrderBatches.push({
                id: typeof batch.id === 'string' && batch.id.trim() ? batch.id.trim().slice(0, 64) : `batch-${index + 1}`,
                name,
                delay: clampNumber(batch.delay, 0, 3600, 0),
                parallel: batch.parallel === true,
                useFolderOrder: !Object.prototype.hasOwnProperty.call(batch, 'useFolderOrder') ? true : batch.useFolderOrder !== false,
                items
            });
        });
        const startOrderWaitsSource = isPlainObject(incoming.dockerStartOrder?.containerWaits) ? incoming.dockerStartOrder.containerWaits : {}, containerWaits = {};
        Object.entries(startOrderWaitsSource).slice(0, 2000).forEach(([name, delay]) => { const normalizedName = String(name || '').trim().slice(0, 255); if (normalizedName) containerWaits[normalizedName] = clampNumber(delay, 0, 3600, 0); });
        const dockerStartOrder = { mode: ['unmanaged', 'docker-page', 'custom-batches'].includes(startOrderMode) ? startOrderMode : DEFAULT_DOCKER_START_ORDER.mode, remaining: ['after', 'before', 'keep'].includes(startOrderRemaining) ? startOrderRemaining : DEFAULT_DOCKER_START_ORDER.remaining, batches: startOrderBatches, containerWaits };
        const runtimePrefsSchema = clampNumber(incoming.runtimePrefsSchema, 0, RUNTIME_PREFS_SCHEMA, 0);
        const runtimePrefsReady = runtimePrefsSchema >= RUNTIME_TOGGLE_PREFS_SCHEMA;
        const privacyModePrefsReady = runtimePrefsSchema >= PRIVACY_MODE_PREFS_SCHEMA;
        const liveRefreshEnabled = runtimePrefsReady ? incoming.liveRefreshEnabled === true : false;
        const liveRefreshSeconds = clampNumber(incoming.liveRefreshSeconds, 10, 300, 20);
        const performanceProfile = runtimePrefsReady
            ? normalizePerformanceProfile(incoming.performanceProfile, incoming.performanceMode === true)
            : 'standard';
        const performanceMode = performanceProfile !== 'standard';
        const lazyPreviewEnabled = runtimePrefsReady ? incoming.lazyPreviewEnabled === true : false;
        const lazyPreviewThreshold = clampNumber(incoming.lazyPreviewThreshold, 10, 200, 30);
        const pageViewMode = normalizeRuntimePageViewMode(incoming.pageViewMode);
        const themeCompatibilityMode = normalizeThemeCompatibilityMode(incoming.themeCompatibilityMode);
        const incomingDashboard = isPlainObject(incoming.dashboard) ? incoming.dashboard : {};
        const dashboard = {
            layout: normalizeDashboardLayout(incomingDashboard.layout),
            expandToggle: !Object.prototype.hasOwnProperty.call(incomingDashboard, 'expandToggle')
                ? DEFAULT_DASHBOARD_PREFS.expandToggle
                : incomingDashboard.expandToggle !== false,
            greyscale: incomingDashboard.greyscale === true,
            folderLabel: !Object.prototype.hasOwnProperty.call(incomingDashboard, 'folderLabel')
                ? DEFAULT_DASHBOARD_PREFS.folderLabel
                : incomingDashboard.folderLabel !== false,
            privacyMode: !Object.prototype.hasOwnProperty.call(incomingDashboard, 'privacyMode')
                ? DEFAULT_DASHBOARD_PREFS.privacyMode
                : privacyModePrefsReady && incomingDashboard.privacyMode === true,
            privacyMaskNames: !Object.prototype.hasOwnProperty.call(incomingDashboard, 'privacyMaskNames')
                ? DEFAULT_DASHBOARD_PREFS.privacyMaskNames
                : incomingDashboard.privacyMaskNames !== false,
            privacyMaskContainerIps: !Object.prototype.hasOwnProperty.call(incomingDashboard, 'privacyMaskContainerIps')
                ? DEFAULT_DASHBOARD_PREFS.privacyMaskContainerIps
                : incomingDashboard.privacyMaskContainerIps !== false,
            privacyMaskLocalIps: !Object.prototype.hasOwnProperty.call(incomingDashboard, 'privacyMaskLocalIps')
                ? DEFAULT_DASHBOARD_PREFS.privacyMaskLocalIps
                : incomingDashboard.privacyMaskLocalIps !== false,
            privacyMaskPorts: !Object.prototype.hasOwnProperty.call(incomingDashboard, 'privacyMaskPorts')
                ? DEFAULT_DASHBOARD_PREFS.privacyMaskPorts
                : incomingDashboard.privacyMaskPorts !== false,
            privacyMaskVolumePaths: incomingDashboard.privacyMaskVolumePaths !== false,
            privacyMaskImageRegistry: incomingDashboard.privacyMaskImageRegistry !== false,
            privacyMaskVmDiskPaths: incomingDashboard.privacyMaskVmDiskPaths !== false,
            privacyMaskMacAddresses: incomingDashboard.privacyMaskMacAddresses !== false,
            privacyMaskPublicIps: incomingDashboard.privacyMaskPublicIps !== false,
            privacyMaskInterfaces: incomingDashboard.privacyMaskInterfaces !== false,
            privacyMaskExternalUrls: incomingDashboard.privacyMaskExternalUrls !== false,
            previewContext: normalizeDashboardPreviewContext(incomingDashboard.previewContext),
            previewTrigger: normalizeDashboardPreviewTrigger(incomingDashboard.previewTrigger),
            previewGraph: clampNumber(incomingDashboard.previewGraph, 0, 4, DEFAULT_DASHBOARD_PREFS.previewGraph),
            previewGraphTime: clampNumber(incomingDashboard.previewGraphTime, 5, 600, DEFAULT_DASHBOARD_PREFS.previewGraphTime)
        };
        const incomingHealth = isPlainObject(incoming.health) ? incoming.health : {};
        const health = {
            cardsEnabled: !Object.prototype.hasOwnProperty.call(incomingHealth, 'cardsEnabled')
                ? DEFAULT_HEALTH_PREFS.cardsEnabled
                : incomingHealth.cardsEnabled !== false,
            runtimeBadgeEnabled: incomingHealth.runtimeBadgeEnabled === true,
            warnStoppedPercent: clampNumber(
                incomingHealth.warnStoppedPercent,
                0,
                100,
                DEFAULT_HEALTH_PREFS.warnStoppedPercent
            ),
            criticalStoppedPercent: clampNumber(
                incomingHealth.criticalStoppedPercent,
                0,
                100,
                DEFAULT_HEALTH_PREFS.criticalStoppedPercent
            ),
            profile: normalizeHealthProfile(incomingHealth.profile),
            updatesMode: normalizeHealthUpdatesMode(incomingHealth.updatesMode),
            allStoppedMode: normalizeHealthAllStoppedMode(incomingHealth.allStoppedMode),
            vmResourceWarnVcpus: clampNumber(
                incomingHealth.vmResourceWarnVcpus,
                1,
                512,
                DEFAULT_HEALTH_PREFS.vmResourceWarnVcpus
            ),
            vmResourceCriticalVcpus: clampNumber(
                incomingHealth.vmResourceCriticalVcpus,
                1,
                512,
                DEFAULT_HEALTH_PREFS.vmResourceCriticalVcpus
            ),
            vmResourceWarnGiB: clampNumber(
                incomingHealth.vmResourceWarnGiB,
                1,
                1024,
                DEFAULT_HEALTH_PREFS.vmResourceWarnGiB
            ),
            vmResourceCriticalGiB: clampNumber(
                incomingHealth.vmResourceCriticalGiB,
                1,
                1024,
                DEFAULT_HEALTH_PREFS.vmResourceCriticalGiB
            )
        };
        if (health.vmResourceCriticalVcpus <= health.vmResourceWarnVcpus) {
            health.vmResourceWarnVcpus = Math.min(511, health.vmResourceWarnVcpus);
            health.vmResourceCriticalVcpus = Math.min(512, health.vmResourceWarnVcpus + 1);
        }
        if (health.vmResourceCriticalGiB <= health.vmResourceWarnGiB) {
            health.vmResourceWarnGiB = Math.min(1023, health.vmResourceWarnGiB);
            health.vmResourceCriticalGiB = Math.min(1024, health.vmResourceWarnGiB + 1);
        }
        const incomingStatus = isPlainObject(incoming.status) ? incoming.status : {};
        const normalizedStatusDisplayMode = String(incomingStatus.displayMode || '').trim().toLowerCase();
        const status = {
            mode: String(incomingStatus.mode || '').trim().toLowerCase() === 'dominant'
                ? 'dominant'
                : DEFAULT_STATUS_PREFS.mode,
            displayMode: ['simple', 'balanced', 'detailed'].includes(normalizedStatusDisplayMode)
                ? normalizedStatusDisplayMode
                : DEFAULT_STATUS_PREFS.displayMode,
            trendEnabled: !Object.prototype.hasOwnProperty.call(incomingStatus, 'trendEnabled')
                ? DEFAULT_STATUS_PREFS.trendEnabled
                : incomingStatus.trendEnabled !== false,
            attentionAccent: !Object.prototype.hasOwnProperty.call(incomingStatus, 'attentionAccent')
                ? DEFAULT_STATUS_PREFS.attentionAccent
                : incomingStatus.attentionAccent !== false,
            warnStoppedPercent: clampNumber(
                incomingStatus.warnStoppedPercent,
                0,
                100,
                DEFAULT_STATUS_PREFS.warnStoppedPercent
            )
        };
        const pinnedFolderIds = normalizeStringIdList(incoming.pinnedFolderIds);
        const hiddenFolderIds = normalizeStringIdList(incoming.hiddenFolderIds);
        const expandedFolderState = normalizeExpandedFolderStateMap(incoming.expandedFolderState);
        const hideEmptyFolders = incoming.hideEmptyFolders === true;
        const appColumnWidth = normalizeAppColumnWidth(incoming.appColumnWidth);
        const setupWizardCompleted = incoming.setupWizardCompleted === true;
        const settingsMode = incoming.settingsMode === 'advanced' ? 'advanced' : 'basic';
        const incomingSettingsTable = isPlainObject(incoming.settingsTable) ? incoming.settingsTable : {};
        const normalizedSettingsTablePreset = String(incomingSettingsTable.preset || '').trim().toLowerCase();
        const settingsTableColumns = isPlainObject(incomingSettingsTable.columns) ? { ...incomingSettingsTable.columns } : {};
        const normalizedSettingsTableNameWidth = String(incomingSettingsTable.nameWidth || '').trim().toLowerCase();
        const normalizedSettingsTableActionsWidth = String(incomingSettingsTable.actionsWidth || '').trim().toLowerCase();
        const settingsTable = {
            preset: ['compact', 'balanced', 'detailed', 'custom'].includes(normalizedSettingsTablePreset)
                ? normalizedSettingsTablePreset
                : 'balanced',
            columns: settingsTableColumns,
            nameWidth: ['compact', 'standard', 'wide'].includes(normalizedSettingsTableNameWidth)
                ? normalizedSettingsTableNameWidth
                : 'standard',
            actionsWidth: ['compact', 'standard', 'wide'].includes(normalizedSettingsTableActionsWidth)
                ? normalizedSettingsTableActionsWidth
                : 'standard'
        };

        return {
            _metadata: metadata,
            sortMode,
            manualOrder,
            pinnedFolderIds,
            hiddenFolderIds,
            expandedFolderState,
            hideEmptyFolders,
            appColumnWidth,
            setupWizardCompleted,
            settingsMode,
            autoRules,
            badges,
            runtimePrefsSchema: RUNTIME_PREFS_SCHEMA,
            liveRefreshEnabled,
            liveRefreshSeconds,
            performanceProfile,
            performanceMode,
            lazyPreviewEnabled,
            lazyPreviewThreshold,
            pageViewMode,
            themeCompatibilityMode,
            dashboard,
            health,
            status,
            settingsTable,
            backupSchedule,
            dockerStartOrder,
            folderDefaults,
            importPresets
        };
    };


    return Object.freeze({
        normalizePrefs
    });
}));
