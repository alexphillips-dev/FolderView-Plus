(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusUtils = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const EXPORT_SCHEMA_VERSION = 1;
    const RULE_KINDS = [
        'name_regex',
        'label',
        'label_contains',
        'label_starts_with',
        'image_regex',
        'compose_project_regex'
    ];
    const RULE_EFFECTS = ['include', 'exclude'];
    const LEGACY_FOLDER_LABEL_KEYS = ['folderview.plus', 'folder.view3', 'folder.view2', 'folder.view'];
    const DEFAULT_FOLDER_ICON_PATH = '/plugins/folderview.plus/images/folder-icon.png';
    const IMPORT_ICON_MAX_LENGTH = 8192;
    const RUNTIME_PREFS_SCHEMA = 2;
    const APP_COLUMN_WIDTH_OPTIONS = ['compact', 'standard', 'wide'];
    const DEFAULT_FOLDER_STATUS_COLORS = {
        started: '#ffffff',
        paused: '#b8860b',
        stopped: '#ff4d4d'
    };
    const DEFAULT_HEALTH_PREFS = {
        cardsEnabled: true,
        runtimeBadgeEnabled: false,
        compact: false,
        warnStoppedPercent: 60,
        criticalStoppedPercent: 90,
        profile: 'balanced',
        updatesMode: 'maintenance',
        allStoppedMode: 'critical',
        vmResourceWarnVcpus: 16,
        vmResourceCriticalVcpus: 32,
        vmResourceWarnGiB: 32,
        vmResourceCriticalGiB: 64
    };
    const DEFAULT_STATUS_PREFS = {
        mode: 'summary',
        displayMode: 'balanced',
        trendEnabled: true,
        attentionAccent: true,
        warnStoppedPercent: 60
    };
    const DEFAULT_DASHBOARD_PREFS = {
        layout: 'classic',
        expandToggle: true,
        greyscale: false,
        folderLabel: true
    };
    const RUNTIME_ACTIONS_BY_TYPE = {
        docker: ['start', 'stop', 'pause', 'resume'],
        vm: ['start', 'stop', 'pause', 'resume']
    };

    const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

    const cloneJson = (value) => JSON.parse(JSON.stringify(value));

    const bindEventOnce = (target, eventName, selectorOrHandler, maybeHandler) => {
        if (!target || typeof target.off !== 'function' || typeof target.on !== 'function') {
            return target;
        }
        const eventToken = String(eventName || '').trim();
        if (!eventToken) {
            return target;
        }
        const hasSelector = typeof selectorOrHandler === 'string';
        const selector = hasSelector ? selectorOrHandler : null;
        const handler = hasSelector ? maybeHandler : selectorOrHandler;
        if (typeof handler !== 'function') {
            return target;
        }
        if (selector !== null) {
            target.off(eventToken, selector).on(eventToken, selector, handler);
            return target;
        }
        target.off(eventToken).on(eventToken, handler);
        return target;
    };

    const normalizeHexColor = (value, fallback) => {
        if (typeof value !== 'string') {
            return fallback;
        }
        const trimmed = value.trim();
        const hexMatch = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
        if (!hexMatch.test(trimmed)) {
            return fallback;
        }
        if (trimmed.length === 4) {
            return (
                '#' +
                trimmed
                    .slice(1)
                    .split('')
                    .map((ch) => ch + ch)
                    .join('')
                    .toLowerCase()
            );
        }
        return trimmed.toLowerCase();
    };

    const getFolderStatusColors = (settings) => {
        const source = isPlainObject(settings) ? settings : {};
        return {
            started: normalizeHexColor(source.status_color_started, DEFAULT_FOLDER_STATUS_COLORS.started),
            paused: normalizeHexColor(source.status_color_paused, DEFAULT_FOLDER_STATUS_COLORS.paused),
            stopped: normalizeHexColor(source.status_color_stopped, DEFAULT_FOLDER_STATUS_COLORS.stopped)
        };
    };

    const clampNumber = (value, min, max, fallback) => {
        const number = Number(value);
        if (!Number.isFinite(number)) {
            return fallback;
        }
        if (number < min) {
            return min;
        }
        if (number > max) {
            return max;
        }
        return number;
    };

    const normalizeStringIdList = (value) => {
        if (!Array.isArray(value)) {
            return [];
        }
        return Array.from(
            new Set(
                value
                    .map((item) => String(item || '').trim())
                .filter((item) => item !== '')
            )
        );
    };

    const normalizeExpandedFolderStateMap = (value) => {
        if (!isPlainObject(value)) {
            return {};
        }
        const output = {};
        for (const [rawId, expanded] of Object.entries(value)) {
            const id = String(rawId || '').trim();
            if (!id) {
                continue;
            }
            output[id] = expanded === true;
        }
        return output;
    };

    const normalizeHealthProfile = (value) => {
        const normalized = String(value || '').trim().toLowerCase();
        return ['strict', 'balanced', 'lenient'].includes(normalized)
            ? normalized
            : DEFAULT_HEALTH_PREFS.profile;
    };

    const normalizeHealthUpdatesMode = (value) => {
        const normalized = String(value || '').trim().toLowerCase();
        return ['maintenance', 'warn', 'ignore'].includes(normalized)
            ? normalized
            : DEFAULT_HEALTH_PREFS.updatesMode;
    };

    const normalizeHealthAllStoppedMode = (value) => {
        const normalized = String(value || '').trim().toLowerCase();
        return ['critical', 'warn'].includes(normalized)
            ? normalized
            : DEFAULT_HEALTH_PREFS.allStoppedMode;
    };

    const normalizeAppColumnWidth = (value) => {
        const normalized = String(value || '').trim().toLowerCase();
        return APP_COLUMN_WIDTH_OPTIONS.includes(normalized) ? normalized : 'standard';
    };

    const normalizeDashboardLayout = (value) => {
        const normalized = String(value || '').trim().toLowerCase();
        return ['classic', 'fullwidth', 'accordion', 'inset'].includes(normalized)
            ? normalized
            : DEFAULT_DASHBOARD_PREFS.layout;
    };

    const normalizeFolderMembers = (value) => {
        if (Array.isArray(value)) {
            return Array.from(
                new Set(
                    value
                        .map((item) => String(item || '').trim())
                        .filter((item) => item !== '')
                )
            );
        }
        if (isPlainObject(value)) {
            return Array.from(
                new Set(
                    Object.keys(value)
                        .map((item) => String(item || '').trim())
                        .filter((item) => item !== '')
                )
            );
        }
        return [];
    };

    const normalizeFolderIcon = (value) => {
        if (typeof value !== 'string') {
            return '';
        }
        const icon = String(value || '').trim();
        if (icon === '') {
            return '';
        }
        if (icon.length <= IMPORT_ICON_MAX_LENGTH) {
            return icon;
        }
        return DEFAULT_FOLDER_ICON_PATH;
    };

    const normalizeFolderRecord = (value) => {
        if (!isPlainObject(value)) {
            return null;
        }

        const name = String(value.name || '').trim();
        if (name === '') {
            return null;
        }

        const normalized = { ...value };
        normalized.name = name;
        normalized.icon = normalizeFolderIcon(value.icon);
        normalized.regex = typeof value.regex === 'string' ? value.regex : '';
        const rawParentId = typeof value.parentId === 'string'
            ? value.parentId
            : (typeof value.parent_id === 'string' ? value.parent_id : '');
        normalized.parentId = String(rawParentId || '').trim();
        normalized.containers = normalizeFolderMembers(value.containers);
        normalized.settings = isPlainObject(value.settings) ? { ...value.settings } : {};
        normalized.actions = Array.isArray(value.actions) ? value.actions.slice(0, 200) : [];
        if (typeof value.createdAt === 'string') {
            normalized.createdAt = value.createdAt;
        }
        if (typeof value.updatedAt === 'string') {
            normalized.updatedAt = value.updatedAt;
        }
        return normalized;
    };

    const normalizeFolderMap = (value) => {
        if (!isPlainObject(value)) {
            return {};
        }
        const output = {};
        for (const [id, folder] of Object.entries(value)) {
            const normalizedId = String(id || '').trim();
            if (normalizedId === '' || Object.prototype.hasOwnProperty.call(output, normalizedId)) {
                continue;
            }
            const normalizedFolder = normalizeFolderRecord(folder);
            if (!normalizedFolder) {
                continue;
            }
            output[normalizedId] = normalizedFolder;
        }
        return output;
    };

    const buildNestedFolderOrderIdsFromMap = (orderedMap) => {
        const ids = Object.keys(orderedMap || {});
        if (ids.length <= 0) {
            return [];
        }
        const indexById = new Map(ids.map((id, idx) => [id, idx]));
        const parentById = {};
        for (const id of ids) {
            const rawParentId = String(orderedMap[id]?.parentId || '').trim();
            parentById[id] = rawParentId && rawParentId !== id && indexById.has(rawParentId) ? rawParentId : '';
        }

        const childrenByParent = new Map();
        for (const id of ids) {
            const parentId = parentById[id];
            const key = parentId || '__root__';
            if (!childrenByParent.has(key)) {
                childrenByParent.set(key, []);
            }
            childrenByParent.get(key).push(id);
        }

        const sortByOriginalIndex = (a, b) => (indexById.get(a) || 0) - (indexById.get(b) || 0);
        for (const list of childrenByParent.values()) {
            list.sort(sortByOriginalIndex);
        }

        const orderedIds = [];
        const visiting = new Set();
        const visited = new Set();
        const visit = (id) => {
            if (!id || visited.has(id) || visiting.has(id)) {
                return;
            }
            visiting.add(id);
            orderedIds.push(id);
            const children = childrenByParent.get(id) || [];
            for (const childId of children) {
                visit(childId);
            }
            visiting.delete(id);
            visited.add(id);
        };

        for (const rootId of (childrenByParent.get('__root__') || [])) {
            visit(rootId);
        }
        for (const id of ids) {
            visit(id);
        }
        return orderedIds;
    };

    const normalizePrefs = (prefs) => {
        const incoming = isPlainObject(prefs) ? prefs : {};
        const sortMode = ['created', 'manual', 'alpha'].includes(incoming.sortMode) ? incoming.sortMode : 'created';
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
        const runtimePrefsSchema = clampNumber(incoming.runtimePrefsSchema, 0, RUNTIME_PREFS_SCHEMA, 0);
        const runtimePrefsReady = runtimePrefsSchema >= RUNTIME_PREFS_SCHEMA;
        const liveRefreshEnabled = runtimePrefsReady ? incoming.liveRefreshEnabled === true : false;
        const liveRefreshSeconds = clampNumber(incoming.liveRefreshSeconds, 10, 300, 20);
        const performanceMode = runtimePrefsReady ? incoming.performanceMode === true : false;
        const lazyPreviewEnabled = runtimePrefsReady ? incoming.lazyPreviewEnabled === true : false;
        const lazyPreviewThreshold = clampNumber(incoming.lazyPreviewThreshold, 10, 200, 30);
        const incomingDashboard = isPlainObject(incoming.dashboard) ? incoming.dashboard : {};
        const dashboard = {
            layout: normalizeDashboardLayout(incomingDashboard.layout),
            expandToggle: !Object.prototype.hasOwnProperty.call(incomingDashboard, 'expandToggle')
                ? DEFAULT_DASHBOARD_PREFS.expandToggle
                : incomingDashboard.expandToggle !== false,
            greyscale: incomingDashboard.greyscale === true,
            folderLabel: !Object.prototype.hasOwnProperty.call(incomingDashboard, 'folderLabel')
                ? DEFAULT_DASHBOARD_PREFS.folderLabel
                : incomingDashboard.folderLabel !== false
        };
        const incomingHealth = isPlainObject(incoming.health) ? incoming.health : {};
        const health = {
            cardsEnabled: !Object.prototype.hasOwnProperty.call(incomingHealth, 'cardsEnabled')
                ? DEFAULT_HEALTH_PREFS.cardsEnabled
                : incomingHealth.cardsEnabled !== false,
            runtimeBadgeEnabled: incomingHealth.runtimeBadgeEnabled === true,
            compact: incomingHealth.compact === true,
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
            health.vmResourceCriticalVcpus = Math.min(512, health.vmResourceWarnVcpus + 1);
        }
        if (health.vmResourceCriticalGiB <= health.vmResourceWarnGiB) {
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
        const expandedFolderState = normalizeExpandedFolderStateMap(incoming.expandedFolderState);
        const hideEmptyFolders = incoming.hideEmptyFolders === true;
        const appColumnWidth = normalizeAppColumnWidth(incoming.appColumnWidth);
        const setupWizardCompleted = incoming.setupWizardCompleted === true;
        const settingsMode = incoming.settingsMode === 'advanced' ? 'advanced' : 'basic';

        return {
            sortMode,
            manualOrder,
            pinnedFolderIds,
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
            performanceMode,
            lazyPreviewEnabled,
            lazyPreviewThreshold,
            dashboard,
            health,
            status,
            backupSchedule,
            importPresets
        };
    };

    const orderFoldersByPrefs = (folders, prefs) => {
        const normalizedFolders = normalizeFolderMap(folders);
        const normalizedPrefs = normalizePrefs(prefs);
        const applyPinnedOrder = (orderedMap) => {
            const pinnedIds = normalizeStringIdList(normalizedPrefs.pinnedFolderIds);
            if (!pinnedIds.length) {
                return orderedMap;
            }

            const next = {};
            const remaining = { ...orderedMap };

            for (const id of pinnedIds) {
                if (Object.prototype.hasOwnProperty.call(remaining, id)) {
                    next[id] = remaining[id];
                    delete remaining[id];
                }
            }

            for (const [id, folder] of Object.entries(remaining)) {
                next[id] = folder;
            }
            return next;
        };

        if (normalizedPrefs.sortMode === 'alpha') {
            const keys = Object.keys(normalizedFolders).sort((a, b) => {
                const nameA = String(normalizedFolders[a]?.name ?? a).toLowerCase();
                const nameB = String(normalizedFolders[b]?.name ?? b).toLowerCase();
                const cmp = nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
                return cmp !== 0 ? cmp : a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
            });
            const ordered = {};
            for (const key of keys) {
                ordered[key] = normalizedFolders[key];
            }
            const pinnedApplied = applyPinnedOrder(ordered);
            const nestedIds = buildNestedFolderOrderIdsFromMap(pinnedApplied);
            const nestedOrdered = {};
            for (const key of nestedIds) {
                nestedOrdered[key] = pinnedApplied[key];
            }
            return nestedOrdered;
        }

        if (normalizedPrefs.sortMode === 'manual') {
            const ordered = {};
            for (const id of normalizedPrefs.manualOrder) {
                if (Object.prototype.hasOwnProperty.call(normalizedFolders, id)) {
                    ordered[id] = normalizedFolders[id];
                    delete normalizedFolders[id];
                }
            }
            for (const [id, folder] of Object.entries(normalizedFolders)) {
                ordered[id] = folder;
            }
            const pinnedApplied = applyPinnedOrder(ordered);
            const nestedIds = buildNestedFolderOrderIdsFromMap(pinnedApplied);
            const nestedOrdered = {};
            for (const key of nestedIds) {
                nestedOrdered[key] = pinnedApplied[key];
            }
            return nestedOrdered;
        }

        const pinnedApplied = applyPinnedOrder(normalizedFolders);
        const nestedIds = buildNestedFolderOrderIdsFromMap(pinnedApplied);
        const nestedOrdered = {};
        for (const key of nestedIds) {
            nestedOrdered[key] = pinnedApplied[key];
        }
        return nestedOrdered;
    };

    const buildFullExportPayload = ({ type, folders, pluginVersion }) => ({
        schemaVersion: EXPORT_SCHEMA_VERSION,
        pluginVersion: pluginVersion || '0.0.0',
        exportedAt: new Date().toISOString(),
        type,
        mode: 'full',
        folders: normalizeFolderMap(folders)
    });

    const buildSingleExportPayload = ({ type, folderId, folder, pluginVersion }) => ({
        schemaVersion: EXPORT_SCHEMA_VERSION,
        pluginVersion: pluginVersion || '0.0.0',
        exportedAt: new Date().toISOString(),
        type,
        mode: 'single',
        folderId: folderId || null,
        folder: isPlainObject(folder) ? folder : {}
    });

    const buildImportTrustMeta = ({
        legacy = false,
        schemaVersion = null,
        pluginVersion = null,
        exportedAt = null,
        declaredType = '',
        expectedType = ''
    } = {}) => {
        if (legacy === true) {
            return {
                level: 'legacy',
                label: 'Legacy compatibility',
                reason: 'Legacy folder.view2/folder.view3 format detected. Review changes before apply.'
            };
        }

        const normalizedDeclaredType = String(declaredType || '').trim().toLowerCase();
        const normalizedExpectedType = String(expectedType || '').trim().toLowerCase();
        const typeMatches = (
            normalizedExpectedType === ''
            || normalizedDeclaredType === ''
            || normalizedDeclaredType === normalizedExpectedType
        );

        const pluginVersionText = String(pluginVersion || '').trim();
        const exportedAtText = String(exportedAt || '').trim();
        const hasPluginVersion = pluginVersionText !== '';
        const hasValidExportedAt = exportedAtText !== '' && Number.isFinite(Date.parse(exportedAtText));
        const hasKnownSchema = Number.isFinite(Number(schemaVersion));

        if (hasKnownSchema && hasPluginVersion && hasValidExportedAt && typeMatches) {
            return {
                level: 'trusted',
                label: `Validated schema v${Math.round(Number(schemaVersion))}`,
                reason: 'Schema metadata and source details validated.'
            };
        }

        const reasons = [];
        if (!hasPluginVersion) {
            reasons.push('missing plugin version');
        }
        if (!hasValidExportedAt) {
            reasons.push('invalid export timestamp');
        }
        if (!typeMatches) {
            reasons.push('type mismatch');
        }
        if (!hasKnownSchema) {
            reasons.push('missing schema metadata');
        }

        const reasonText = reasons.length
            ? `Validation warning: ${reasons.join(', ')}.`
            : 'Validation warning: metadata could not be fully validated.';
        return {
            level: 'untrusted',
            label: 'Validation warning',
            reason: reasonText
        };
    };

    const parseImportPayload = (payload, expectedType) => {
        if (!isPlainObject(payload)) {
            return { ok: false, error: 'Import file must contain a JSON object.' };
        }

        const normalizedExpectedType = typeof expectedType === 'string' ? expectedType.trim().toLowerCase() : '';
        const hasSchema = Object.prototype.hasOwnProperty.call(payload, 'schemaVersion');
        if (hasSchema) {
            const schemaVersion = Number(payload.schemaVersion);
            if (!Number.isFinite(schemaVersion)) {
                return { ok: false, error: 'Invalid schema version in import file.' };
            }
            if (schemaVersion > EXPORT_SCHEMA_VERSION) {
                return { ok: false, error: `Unsupported schema version ${schemaVersion}.` };
            }
            const declaredType = typeof payload.type === 'string' ? payload.type.trim().toLowerCase() : '';
            if (declaredType !== '' && !['docker', 'vm'].includes(declaredType)) {
                return { ok: false, error: `Import file type "${payload.type}" is invalid.` };
            }
            if (normalizedExpectedType && declaredType === '') {
                return { ok: false, error: 'Import file is missing required type metadata.' };
            }
            if (declaredType !== '' && normalizedExpectedType && declaredType !== normalizedExpectedType) {
                return { ok: false, error: `Import type "${declaredType}" does not match "${normalizedExpectedType}".` };
            }

            const mode = payload.mode === 'single' ? 'single' : 'full';
            const pluginVersion = payload.pluginVersion || null;
            const exportedAt = payload.exportedAt || null;
            const resolvedType = declaredType || normalizedExpectedType || null;
            const trust = buildImportTrustMeta({
                legacy: false,
                schemaVersion,
                pluginVersion,
                exportedAt,
                declaredType,
                expectedType: normalizedExpectedType
            });
            if (mode === 'single') {
                const normalizedFolder = normalizeFolderRecord(payload.folder);
                if (!normalizedFolder) {
                    return { ok: false, error: 'Single-folder export is missing a valid folder object.' };
                }
                return {
                    ok: true,
                    schemaVersion,
                    pluginVersion,
                    exportedAt,
                    type: resolvedType,
                    declaredType: declaredType || null,
                    mode,
                    legacy: false,
                    trust,
                    folder: normalizedFolder,
                    folderId: typeof payload.folderId === 'string' && payload.folderId !== '' ? payload.folderId : null,
                    folders: {}
                };
            }

            const folders = normalizeFolderMap(payload.folders);
            return {
                ok: true,
                schemaVersion,
                pluginVersion,
                exportedAt,
                type: resolvedType,
                declaredType: declaredType || null,
                mode,
                legacy: false,
                trust,
                folder: null,
                folderId: null,
                folders
            };
        }

        // Legacy format support
        if (isPlainObject(payload.folder) && typeof payload.folder.name === 'string' && payload.folder.name.trim() !== '') {
            const normalizedFolder = normalizeFolderRecord(payload.folder);
            if (!normalizedFolder) {
                return { ok: false, error: 'Single-folder export is missing a valid folder object.' };
            }
            return {
                ok: true,
                schemaVersion: null,
                pluginVersion: null,
                exportedAt: null,
                type: normalizedExpectedType || null,
                declaredType: null,
                mode: 'single',
                legacy: true,
                trust: buildImportTrustMeta({ legacy: true }),
                folder: normalizedFolder,
                folderId: typeof payload.folderId === 'string' && payload.folderId.trim() !== '' ? payload.folderId.trim() : null,
                folders: {}
            };
        }

        if (typeof payload.name === 'string' && payload.name.trim() !== '') {
            const normalizedFolder = normalizeFolderRecord(payload);
            if (!normalizedFolder) {
                return { ok: false, error: 'Single-folder export is missing a valid folder object.' };
            }
            return {
                ok: true,
                schemaVersion: null,
                pluginVersion: null,
                exportedAt: null,
                type: normalizedExpectedType || null,
                declaredType: null,
                mode: 'single',
                legacy: true,
                trust: buildImportTrustMeta({ legacy: true }),
                folder: normalizedFolder,
                folderId: null,
                folders: {}
            };
        }

        const wrappedByType = normalizedExpectedType && isPlainObject(payload[normalizedExpectedType]) ? payload[normalizedExpectedType] : null;
        const wrappedByFolders = isPlainObject(payload.folders) ? payload.folders : null;
        const wrappedSource = wrappedByType || wrappedByFolders;
        if (wrappedSource) {
            return {
                ok: true,
                schemaVersion: null,
                pluginVersion: null,
                exportedAt: null,
                type: normalizedExpectedType || null,
                declaredType: null,
                mode: 'full',
                legacy: true,
                trust: buildImportTrustMeta({ legacy: true }),
                folder: null,
                folderId: null,
                folders: normalizeFolderMap(wrappedSource)
            };
        }

        return {
            ok: true,
            schemaVersion: null,
            pluginVersion: null,
            exportedAt: null,
            type: normalizedExpectedType || null,
            declaredType: null,
            mode: 'full',
            legacy: true,
            trust: buildImportTrustMeta({ legacy: true }),
            folder: null,
            folderId: null,
            folders: normalizeFolderMap(payload)
        };
    };

    const normalizeImportPathSegment = (value) => String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[\\/]+/g, '/');

    const buildImportPathData = (foldersMap) => {
        const folders = normalizeFolderMap(foldersMap);
        const ids = Object.keys(folders);
        const idSet = new Set(ids);
        const parentById = {};
        for (const id of ids) {
            const rawParent = String(folders[id]?.parentId || '').trim();
            parentById[id] = rawParent && rawParent !== id && idSet.has(rawParent) ? rawParent : '';
        }
        const pathById = {};
        const building = new Set();
        const buildPath = (id) => {
            const safeId = String(id || '').trim();
            if (!safeId || !Object.prototype.hasOwnProperty.call(folders, safeId)) {
                return '';
            }
            if (Object.prototype.hasOwnProperty.call(pathById, safeId)) {
                return pathById[safeId];
            }
            if (building.has(safeId)) {
                pathById[safeId] = `__cycle__/${normalizeImportPathSegment(folders[safeId]?.name || safeId)}`;
                return pathById[safeId];
            }
            building.add(safeId);
            const parentId = parentById[safeId];
            const parentPath = parentId ? buildPath(parentId) : '';
            const namePart = normalizeImportPathSegment(folders[safeId]?.name || safeId) || safeId.toLowerCase();
            const ownPath = parentPath ? `${parentPath}/${namePart}` : namePart;
            pathById[safeId] = ownPath;
            building.delete(safeId);
            return ownPath;
        };
        for (const id of ids) {
            buildPath(id);
        }
        const indexByPath = {};
        for (const [id, path] of Object.entries(pathById)) {
            const key = String(path || '').trim();
            if (!key) {
                continue;
            }
            if (!Array.isArray(indexByPath[key])) {
                indexByPath[key] = [];
            }
            indexByPath[key].push(id);
        }
        return { folders, parentById, pathById, indexByPath };
    };

    const resolveImportPathCollisions = (currentFolders, incomingFolders) => {
        const current = buildImportPathData(currentFolders);
        const incoming = buildImportPathData(incomingFolders);
        const currentIds = new Set(Object.keys(current.folders));
        const incomingIds = Object.keys(incoming.folders);
        const resolvedIdByIncomingId = {};
        const usedTargetIds = new Set();
        const mappings = [];
        const conflicts = [];

        for (const incomingId of incomingIds) {
            let targetId = incomingId;
            const incomingPath = String(incoming.pathById[incomingId] || '').trim();
            if (currentIds.has(incomingId)) {
                targetId = incomingId;
            } else if (incomingPath && Array.isArray(current.indexByPath[incomingPath]) && current.indexByPath[incomingPath].length === 1) {
                targetId = current.indexByPath[incomingPath][0];
                mappings.push({
                    sourceId: incomingId,
                    targetId,
                    path: incomingPath
                });
            } else if (incomingPath && Array.isArray(current.indexByPath[incomingPath]) && current.indexByPath[incomingPath].length > 1) {
                conflicts.push({
                    sourceId: incomingId,
                    path: incomingPath,
                    reason: `Ambiguous path matches ${current.indexByPath[incomingPath].length} existing folders`
                });
            }

            if (targetId !== incomingId && usedTargetIds.has(targetId)) {
                conflicts.push({
                    sourceId: incomingId,
                    path: incomingPath,
                    reason: `Multiple incoming folders resolved to target "${targetId}"`
                });
                targetId = incomingId;
            }
            resolvedIdByIncomingId[incomingId] = targetId;
            usedTargetIds.add(targetId);
        }

        return {
            resolvedIdByIncomingId,
            mappings,
            conflicts
        };
    };

    const remapImportedFolderParent = (folder, incomingMap, resolvedIdByIncomingId) => {
        const source = isPlainObject(folder) ? cloneJson(folder) : {};
        const rawParent = String(source.parentId || '').trim();
        if (!rawParent) {
            source.parentId = '';
            return source;
        }
        if (Object.prototype.hasOwnProperty.call(incomingMap, rawParent)) {
            source.parentId = String(resolvedIdByIncomingId[rawParent] || '').trim();
            return source;
        }
        source.parentId = rawParent;
        return source;
    };

    const summarizeImport = (existingFolders, parsed, importMode) => {
        const current = normalizeFolderMap(existingFolders);
        const mode = ['replace', 'merge', 'skip'].includes(importMode) ? importMode : 'merge';
        const existingIds = Object.keys(current);
        const result = {
            mode,
            creates: [],
            updates: [],
            unchanged: [],
            skipped: [],
            deletes: [],
            notes: []
        };

        if (parsed.mode === 'single') {
            const singleName = parsed.folder?.name || 'Unnamed folder';
            if (parsed.folderId) {
                const exists = Object.prototype.hasOwnProperty.call(current, parsed.folderId);
                if (exists) {
                    const same = JSON.stringify(current[parsed.folderId]) === JSON.stringify(parsed.folder);
                    if (mode === 'skip') {
                        result.skipped.push({ id: parsed.folderId, name: singleName });
                    } else if (same) {
                        result.unchanged.push({ id: parsed.folderId, name: singleName });
                    } else {
                        result.updates.push({ id: parsed.folderId, name: singleName });
                    }
                } else {
                    result.creates.push({ id: parsed.folderId, name: singleName });
                }
                if (mode === 'replace') {
                    result.deletes = existingIds
                        .filter((id) => id !== parsed.folderId)
                        .map((id) => ({ id, name: current[id]?.name || id }));
                }
                return result;
            }

            const sameName = existingIds.find((id) => String(current[id]?.name || '') === String(singleName));
            if (mode === 'skip' && sameName) {
                result.skipped.push({ id: sameName, name: singleName });
            } else {
                result.creates.push({ id: null, name: singleName });
            }
            if (mode === 'replace') {
                result.deletes = existingIds.map((id) => ({ id, name: current[id]?.name || id }));
                result.notes.push('Replace mode with single-folder import will delete all current folders first.');
            }
            return result;
        }

        const incoming = normalizeFolderMap(parsed.folders);
        const incomingIds = Object.keys(incoming);
        const pathResolution = resolveImportPathCollisions(current, incoming);
        const resolvedTargets = new Set();
        for (const incomingId of incomingIds) {
            const targetId = String(pathResolution.resolvedIdByIncomingId[incomingId] || incomingId).trim();
            if (!targetId || resolvedTargets.has(targetId)) {
                continue;
            }
            resolvedTargets.add(targetId);
            const importedFolder = remapImportedFolderParent(
                incoming[incomingId],
                incoming,
                pathResolution.resolvedIdByIncomingId
            );
            const existing = current[targetId];
            if (!existing) {
                result.creates.push({ id: targetId, name: importedFolder?.name || targetId });
                continue;
            }
            const same = JSON.stringify(existing) === JSON.stringify(importedFolder);
            if (mode === 'skip') {
                result.skipped.push({ id: targetId, name: importedFolder?.name || targetId });
            } else if (same) {
                result.unchanged.push({ id: targetId, name: importedFolder?.name || targetId });
            } else {
                result.updates.push({ id: targetId, name: importedFolder?.name || targetId });
            }
        }

        if (mode === 'replace') {
            for (const id of existingIds) {
                if (!resolvedTargets.has(id)) {
                    result.deletes.push({ id, name: current[id]?.name || id });
                }
            }
        }

        if (pathResolution.mappings.length > 0) {
            result.notes.push(`Path resolver: mapped ${pathResolution.mappings.length} incoming folder id(s) to existing parent/name path matches.`);
        }
        if (pathResolution.conflicts.length > 0) {
            result.notes.push(`Path conflicts: ${pathResolution.conflicts.length} incoming folder(s) had ambiguous path collisions and kept original ids.`);
        }

        return result;
    };

    const buildImportOperations = (existingFolders, parsed, importMode) => {
        const current = normalizeFolderMap(existingFolders);
        const mode = ['replace', 'merge', 'skip'].includes(importMode) ? importMode : 'merge';
        const operations = {
            mode,
            upserts: [],
            creates: [],
            deletes: []
        };

        if (parsed.mode === 'single') {
            if (mode === 'replace') {
                operations.deletes = Object.keys(current);
            }

            if (parsed.folderId) {
                if (!(mode === 'skip' && Object.prototype.hasOwnProperty.call(current, parsed.folderId))) {
                    operations.upserts.push({ id: parsed.folderId, folder: cloneJson(parsed.folder) });
                }
                return operations;
            }

            const singleName = String(parsed.folder?.name || '');
            const sameNameId = Object.keys(current).find((id) => String(current[id]?.name || '') === singleName);
            if (!(mode === 'skip' && sameNameId)) {
                operations.creates.push({ folder: cloneJson(parsed.folder) });
            }
            return operations;
        }

        const incoming = normalizeFolderMap(parsed.folders);
        const pathResolution = resolveImportPathCollisions(current, incoming);
        const queuedTargets = new Set();
        for (const [incomingId, folder] of Object.entries(incoming)) {
            const targetId = String(pathResolution.resolvedIdByIncomingId[incomingId] || incomingId).trim();
            if (!targetId || queuedTargets.has(targetId)) {
                continue;
            }
            queuedTargets.add(targetId);
            if (mode === 'skip' && Object.prototype.hasOwnProperty.call(current, targetId)) {
                continue;
            }
            const remappedFolder = remapImportedFolderParent(folder, incoming, pathResolution.resolvedIdByIncomingId);
            operations.upserts.push({
                id: targetId,
                sourceId: incomingId,
                pathMapped: targetId !== incomingId,
                folder: remappedFolder
            });
        }

        if (mode === 'replace') {
            operations.deletes = Object.keys(current).filter((id) => !queuedTargets.has(id));
        }

        operations.pathMappings = pathResolution.mappings.slice();
        operations.pathConflicts = pathResolution.conflicts.slice();

        return operations;
    };

    const normalizeMemberList = (value) => {
        if (Array.isArray(value)) {
            return value.map((item) => String(item)).filter((item) => item !== '');
        }
        if (isPlainObject(value)) {
            return Object.keys(value).map((item) => String(item)).filter((item) => item !== '');
        }
        return [];
    };

    const diffFolderFields = (existingFolder, incomingFolder) => {
        const current = isPlainObject(existingFolder) ? existingFolder : {};
        const next = isPlainObject(incomingFolder) ? incomingFolder : {};
        const fields = [];

        if (String(current.name || '') !== String(next.name || '')) {
            fields.push('name');
        }
        if (String(current.icon || '') !== String(next.icon || '')) {
            fields.push('icon');
        }
        if (String(current.regex || '') !== String(next.regex || '')) {
            fields.push('regex');
        }
        if (String(current.parentId || '') !== String(next.parentId || '')) {
            fields.push('parent');
        }
        if (JSON.stringify(current.settings || {}) !== JSON.stringify(next.settings || {})) {
            fields.push('settings');
        }
        if (JSON.stringify(current.actions || []) !== JSON.stringify(next.actions || [])) {
            fields.push('actions');
        }

        const currentMembers = normalizeMemberList(current.containers);
        const nextMembers = normalizeMemberList(next.containers);
        if (JSON.stringify(currentMembers) !== JSON.stringify(nextMembers)) {
            fields.push('members');
        }

        return fields;
    };

    const buildImportDiffRows = (existingFolders, parsed, importMode) => {
        const current = normalizeFolderMap(existingFolders);
        const mode = ['replace', 'merge', 'skip'].includes(importMode) ? importMode : 'merge';
        const operations = buildImportOperations(current, parsed, mode);
        const rows = [];

        for (const id of operations.deletes) {
            rows.push({
                action: 'delete',
                id,
                name: current[id]?.name || id,
                fields: ['folder']
            });
        }

        for (const item of operations.upserts) {
            const id = String(item.id || '');
            const incoming = isPlainObject(item.folder) ? item.folder : {};
            const existing = current[id];
            if (!existing) {
                rows.push({
                    action: 'create',
                    id,
                    name: incoming.name || id || 'New folder',
                    fields: ['folder']
                });
                continue;
            }

            const fields = diffFolderFields(existing, incoming);
            rows.push({
                action: fields.length ? 'update' : 'unchanged',
                id,
                name: incoming.name || existing.name || id,
                fields: fields.length ? fields : ['none']
            });
        }

        for (const item of operations.creates) {
            const incoming = isPlainObject(item.folder) ? item.folder : {};
            rows.push({
                action: 'create',
                id: null,
                name: incoming.name || 'New folder',
                fields: ['folder']
            });
        }

        return rows;
    };

    const regexMatches = (pattern, input) => {
        if (!pattern) {
            return false;
        }
        try {
            return new RegExp(pattern).test(input);
        } catch (err) {
            return false;
        }
    };

    const getDockerLabels = (infos, name) => {
        const item = infos[name] || {};
        return item.Labels || item.info?.Config?.Labels || {};
    };

    const getDockerImage = (infos, name) => {
        const item = infos[name] || {};
        return String(item.info?.Config?.Image || item.Image || '');
    };

    const basenameFromPathish = (value) => {
        const trimmed = String(value || '').trim();
        if (!trimmed) {
            return '';
        }
        const firstEntry = trimmed.split(',')[0].trim();
        if (!firstEntry) {
            return '';
        }
        const normalized = firstEntry.replace(/\\/g, '/').replace(/\/+$/, '');
        if (!normalized) {
            return '';
        }
        const parts = normalized.split('/');
        return String(parts[parts.length - 1] || '').trim();
    };

    const getComposeProjectFromLabels = (labels) => {
        const source = isPlainObject(labels) ? labels : {};

        const explicit = String(source['com.docker.compose.project'] || '').trim();
        if (explicit) {
            return explicit;
        }

        const fromWorkingDir = basenameFromPathish(source['com.docker.compose.project.working_dir']);
        if (fromWorkingDir) {
            return fromWorkingDir;
        }

        const configFiles = String(source['com.docker.compose.project.config_files'] || '').trim();
        if (configFiles) {
            const firstConfig = configFiles.split(',')[0].trim();
            if (firstConfig) {
                const normalized = firstConfig.replace(/\\/g, '/');
                const dir = normalized.split('/').slice(0, -1).join('/');
                const fromConfigDir = basenameFromPathish(dir);
                if (fromConfigDir) {
                    return fromConfigDir;
                }
            }
        }

        return '';
    };

    const isComposeManagedFromLabels = (labels) => {
        const source = isPlainObject(labels) ? labels : {};
        const manager = String(source['net.unraid.docker.managed'] || '').trim().toLowerCase();
        return manager === 'composeman' || getComposeProjectFromLabels(source) !== '';
    };

    const getComposeProject = (infos, name) => {
        const labels = getDockerLabels(infos, name);
        return getComposeProjectFromLabels(labels);
    };

    const getFolderLabelValue = (labels) => {
        const source = isPlainObject(labels) ? labels : {};
        for (const key of LEGACY_FOLDER_LABEL_KEYS) {
            if (typeof source[key] === 'string' && source[key].trim() !== '') {
                return source[key].trim();
            }
        }
        return '';
    };

    const ruleMatchesItem = (rule, name, infos, type) => {
        if (!isPlainObject(rule)) {
            return false;
        }
        if (rule.kind === 'name_regex') {
            return regexMatches(String(rule.pattern || ''), name);
        }

        if (type !== 'docker') {
            return false;
        }

        if (rule.kind === 'label') {
            if (type !== 'docker') {
                return false;
            }
            const key = String(rule.labelKey || '');
            if (!key) {
                return false;
            }
            const labels = getDockerLabels(infos, name);
            const labelValue = labels[key];
            if (typeof labelValue === 'undefined') {
                return false;
            }
            return rule.labelValue === '' || String(labelValue) === String(rule.labelValue);
        }

        if (rule.kind === 'label_contains') {
            const key = String(rule.labelKey || '');
            const expected = String(rule.labelValue || '');
            if (!key || expected === '') {
                return false;
            }
            const labels = getDockerLabels(infos, name);
            const labelValue = labels[key];
            if (typeof labelValue === 'undefined') {
                return false;
            }
            return String(labelValue).toLowerCase().includes(expected.toLowerCase());
        }

        if (rule.kind === 'label_starts_with') {
            const key = String(rule.labelKey || '');
            const expected = String(rule.labelValue || '');
            if (!key || expected === '') {
                return false;
            }
            const labels = getDockerLabels(infos, name);
            const labelValue = labels[key];
            if (typeof labelValue === 'undefined') {
                return false;
            }
            return String(labelValue).toLowerCase().startsWith(expected.toLowerCase());
        }

        if (rule.kind === 'image_regex') {
            return regexMatches(String(rule.pattern || ''), getDockerImage(infos, name));
        }

        if (rule.kind === 'compose_project_regex') {
            return regexMatches(String(rule.pattern || ''), getComposeProject(infos, name));
        }

        return false;
    };

    const getAutoRuleDecision = ({ rules, name, infoByName, type }) => {
        const infos = isPlainObject(infoByName) ? infoByName : {};
        let firstIncludeRule = null;
        for (const rule of (Array.isArray(rules) ? rules : [])) {
            if (!isPlainObject(rule) || rule.enabled === false) {
                continue;
            }
            if (ruleMatchesItem(rule, name, infos, type)) {
                if (rule.effect === 'exclude') {
                    return {
                        assignedRule: null,
                        blockedBy: rule,
                        matchedRule: rule
                    };
                }
                if (!firstIncludeRule) {
                    firstIncludeRule = rule;
                }
            }
        }
        if (firstIncludeRule) {
            return {
                assignedRule: firstIncludeRule,
                blockedBy: null,
                matchedRule: firstIncludeRule
            };
        }
        return {
            assignedRule: null,
            blockedBy: null,
            matchedRule: null
        };
    };

    const getAutoRuleFirstMatch = ({ rules, name, infoByName, type }) => {
        const decision = getAutoRuleDecision({ rules, name, infoByName, type });
        return decision.assignedRule;
    };

    const getAutoRuleMatches = ({ rules, folderId, names, infoByName, type }) => {
        const allNames = Array.isArray(names) ? names : [];
        const targetFolderId = String(folderId || '');

        const matches = [];
        for (const name of allNames) {
            const firstMatch = getAutoRuleFirstMatch({
                rules,
                name,
                infoByName,
                type
            });
            if (firstMatch && String(firstMatch.folderId || '') === targetFolderId) {
                matches.push(name);
            }
        }
        return Array.from(new Set(matches));
    };

    const getEffectiveFolderMembers = ({ type, folderId, folder, names, infoByName, rules }) => {
        const normalizedType = type === 'vm' ? 'vm' : 'docker';
        const targetFolderId = String(folderId || '');
        const targetFolder = isPlainObject(folder) ? folder : {};
        const infos = isPlainObject(infoByName) ? infoByName : {};
        const allNames = Array.isArray(names) && names.length
            ? Array.from(new Set(names.map((name) => String(name || '')).filter((name) => name !== '')))
            : Object.keys(infos);
        const reasonsByName = {};
        const addReason = (name, reason) => {
            if (!name || !reason) {
                return;
            }
            if (!reasonsByName[name]) {
                reasonsByName[name] = [];
            }
            if (!reasonsByName[name].includes(reason)) {
                reasonsByName[name].push(reason);
            }
        };

        for (const member of normalizeMemberList(targetFolder.containers)) {
            addReason(member, 'manual');
        }

        const regex = String(targetFolder.regex || '');
        if (regex) {
            for (const name of allNames) {
                if (regexMatches(regex, name)) {
                    addReason(name, 'regex');
                }
            }
        }

        if (normalizedType === 'docker') {
            const folderName = String(targetFolder.name || '').trim();
            if (folderName) {
                for (const name of allNames) {
                    const labels = getDockerLabels(infos, name);
                    if (getFolderLabelValue(labels) === folderName) {
                        addReason(name, 'label');
                    }
                }
            }
        }

        if (targetFolderId !== '') {
            for (const name of allNames) {
                const decision = getAutoRuleDecision({
                    rules,
                    name,
                    infoByName: infos,
                    type: normalizedType
                });
                const assignedFolderId = String(decision?.assignedRule?.folderId || '');
                if (assignedFolderId !== '' && assignedFolderId === targetFolderId) {
                    addReason(name, 'rule');
                }
            }
        }

        const members = Object.keys(reasonsByName).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
        return {
            members,
            reasonsByName
        };
    };

    const dockerRuntimeStateKind = (item) => {
        const source = isPlainObject(item) ? item : {};
        const nestedState = isPlainObject(source.info?.State) ? source.info.State : {};
        const running = Boolean(
            nestedState.Running
            ?? source.state
            ?? source.running
        );
        const paused = Boolean(
            nestedState.Paused
            ?? source.pause
            ?? source.paused
        );
        if (running && paused) {
            return 'paused';
        }
        if (running) {
            return 'started';
        }
        return 'stopped';
    };

    const vmRuntimeStateKind = (item) => {
        const source = isPlainObject(item) ? item : {};
        const raw = String(source.state || source.State || '').toLowerCase();
        if (raw === 'running') {
            return 'started';
        }
        if (raw === 'paused' || raw === 'unknown' || raw === 'pmsuspended') {
            return 'paused';
        }
        return 'stopped';
    };

    const isRuntimeActionAllowed = (type, action, state) => {
        const normalizedType = type === 'vm' ? 'vm' : 'docker';
        const normalizedState = ['started', 'paused', 'stopped'].includes(state) ? state : 'stopped';
        const normalizedAction = String(action || '').toLowerCase();

        if (!RUNTIME_ACTIONS_BY_TYPE[normalizedType].includes(normalizedAction)) {
            return false;
        }

        if (normalizedAction === 'start') {
            return normalizedState === 'stopped';
        }
        if (normalizedAction === 'stop') {
            return normalizedState === 'started' || normalizedState === 'paused';
        }
        if (normalizedAction === 'pause') {
            return normalizedType === 'docker'
                ? normalizedState === 'started'
                : normalizedState === 'started';
        }
        if (normalizedAction === 'resume') {
            return normalizedState === 'paused';
        }
        return false;
    };

    const skipReasonForAction = (action, state) => {
        const normalizedAction = String(action || '').toLowerCase();
        if (normalizedAction === 'start') {
            return state === 'paused' ? 'Item is paused, resume instead.' : 'Item already started.';
        }
        if (normalizedAction === 'stop') {
            return 'Item already stopped.';
        }
        if (normalizedAction === 'pause') {
            return state === 'paused' ? 'Item already paused.' : 'Item must be started before pause.';
        }
        if (normalizedAction === 'resume') {
            return state === 'started' ? 'Item already started.' : 'Item is stopped.';
        }
        return 'Action is not supported for this item.';
    };

    const planFolderRuntimeAction = ({ type, folderId, folder, names, infoByName, rules, action }) => {
        const normalizedType = type === 'vm' ? 'vm' : 'docker';
        const normalizedAction = String(action || '').toLowerCase();
        const validActions = RUNTIME_ACTIONS_BY_TYPE[normalizedType] || [];
        if (!validActions.includes(normalizedAction)) {
            return {
                type: normalizedType,
                action: normalizedAction,
                folderId: String(folderId || ''),
                requestedCount: 0,
                eligible: [],
                skipped: [],
                countsByState: { started: 0, paused: 0, stopped: 0 },
                error: 'Unsupported action.'
            };
        }

        const effectiveMembers = getEffectiveFolderMembers({
            type: normalizedType,
            folderId,
            folder,
            names,
            infoByName,
            rules
        });
        const infos = isPlainObject(infoByName) ? infoByName : {};
        const countsByState = {
            started: 0,
            paused: 0,
            stopped: 0
        };
        const eligible = [];
        const skipped = [];

        for (const name of effectiveMembers.members) {
            const item = infos[name] || {};
            const state = normalizedType === 'docker'
                ? dockerRuntimeStateKind(item)
                : vmRuntimeStateKind(item);
            countsByState[state] = (countsByState[state] || 0) + 1;
            const canRun = isRuntimeActionAllowed(normalizedType, normalizedAction, state);
            if (canRun) {
                eligible.push({
                    name,
                    state,
                    reasons: effectiveMembers.reasonsByName[name] || []
                });
            } else {
                skipped.push({
                    name,
                    state,
                    reason: skipReasonForAction(normalizedAction, state)
                });
            }
        }

        return {
            type: normalizedType,
            action: normalizedAction,
            folderId: String(folderId || ''),
            requestedCount: effectiveMembers.members.length,
            eligible,
            skipped,
            countsByState
        };
    };

    const getConflictReport = ({ type, folders, prefs, infoByName }) => {
        const normalizedType = type === 'vm' ? 'vm' : 'docker';
        const folderMap = normalizeFolderMap(folders);
        const normalizedPrefs = normalizePrefs(prefs);
        const infos = isPlainObject(infoByName) ? infoByName : {};
        const names = Object.keys(infos).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));

        const rows = [];
        let conflictCount = 0;

        for (const name of names) {
            const matchedFolders = [];
            const labels = getDockerLabels(infos, name);
            const legacyLabelTarget = normalizedType === 'docker' ? getFolderLabelValue(labels) : '';
            const ruleDecision = getAutoRuleDecision({
                rules: normalizedPrefs.autoRules,
                name,
                infoByName: infos,
                type: normalizedType
            });

            for (const [folderId, folder] of Object.entries(folderMap)) {
                const reasons = [];
                const members = Array.isArray(folder.containers) ? folder.containers.map((item) => String(item)) : [];
                if (members.includes(name)) {
                    reasons.push('manual');
                }
                if (regexMatches(String(folder.regex || ''), name)) {
                    reasons.push('regex');
                }
                if (normalizedType === 'docker' && legacyLabelTarget && legacyLabelTarget === String(folder.name || '')) {
                    reasons.push('label');
                }
                if (ruleDecision.assignedRule && String(ruleDecision.assignedRule.folderId || '') === String(folderId)) {
                    reasons.push('rule');
                }
                if (reasons.length) {
                    matchedFolders.push({
                        folderId,
                        folderName: String(folder.name || folderId),
                        reasons
                    });
                }
            }

            const hasConflict = matchedFolders.length > 1;
            if (hasConflict) {
                conflictCount += 1;
            }

            rows.push({
                item: name,
                type: normalizedType,
                hasConflict,
                matchedFolderCount: matchedFolders.length,
                matchedFolders,
                blockedByRule: ruleDecision.blockedBy ? {
                    id: String(ruleDecision.blockedBy.id || ''),
                    folderId: String(ruleDecision.blockedBy.folderId || ''),
                    kind: String(ruleDecision.blockedBy.kind || 'name_regex')
                } : null
            });
        }

        return {
            totalItems: names.length,
            conflictingItems: conflictCount,
            rows
        };
    };

    return {
        EXPORT_SCHEMA_VERSION,
        RULE_KINDS,
        RULE_EFFECTS,
        LEGACY_FOLDER_LABEL_KEYS,
        RUNTIME_PREFS_SCHEMA,
        DEFAULT_FOLDER_STATUS_COLORS,
        DEFAULT_HEALTH_PREFS,
        DEFAULT_DASHBOARD_PREFS,
        bindEventOnce,
        normalizeFolderMap,
        normalizeAppColumnWidth,
        normalizeDashboardLayout,
        normalizePrefs,
        orderFoldersByPrefs,
        getFolderStatusColors,
        buildFullExportPayload,
        buildSingleExportPayload,
        parseImportPayload,
        summarizeImport,
        buildImportOperations,
        buildImportDiffRows,
        diffFolderFields,
        ruleMatchesItem,
        getAutoRuleDecision,
        getAutoRuleMatches,
        getAutoRuleFirstMatch,
        getEffectiveFolderMembers,
        planFolderRuntimeAction,
        getFolderLabelValue,
        getComposeProjectFromLabels,
        isComposeManagedFromLabels,
        getConflictReport
    };
}));
