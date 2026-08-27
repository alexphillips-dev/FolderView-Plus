(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./folderviewplus.utils-foundation.js'));
        return;
    }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.utilityNormalization = factory(modules.utilityFoundation);
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function(utilityFoundation) {
    'use strict';
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
    const RUNTIME_PREFS_SCHEMA = 4;
    const RUNTIME_TOGGLE_PREFS_SCHEMA = 2;
    const PRIVACY_MODE_PREFS_SCHEMA = 3;
    const APP_COLUMN_WIDTH_OPTIONS = ['compact', 'standard', 'wide'];
    const THEME_COMPATIBILITY_MODE_OPTIONS = ['auto', 'host', 'safe', 'highcontrast'];
    const PERFORMANCE_PROFILE_OPTIONS = ['standard', 'adaptive', 'maximum'];
    const RUNTIME_PAGE_VIEW_MODE_OPTIONS = ['folderview', 'host', 'command'];
    const DEFAULT_FOLDER_STATUS_COLORS = {
        started: '#55b72d',
        paused: '#b8860b',
        stopped: '#ff4d4d',
        text: '#ffffff'
    };
    const DEFAULT_HEALTH_PREFS = {
        cardsEnabled: true,
        runtimeBadgeEnabled: false,
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
        folderLabel: true,
        privacyMode: false,
        privacyMaskNames: true,
        privacyMaskContainerIps: true,
        privacyMaskLocalIps: true,
        privacyMaskPorts: true,
        privacyMaskVolumePaths: true,
        privacyMaskImageRegistry: true,
        privacyMaskVmDiskPaths: true,
        privacyMaskMacAddresses: true,
        privacyMaskPublicIps: true,
        privacyMaskInterfaces: true,
        privacyMaskExternalUrls: true,
        previewContext: 'native',
        previewTrigger: 'click',
        previewGraph: 1,
        previewGraphTime: 60
    };
    const DEFAULT_DOCKER_START_ORDER = {
        mode: 'docker-page',
        remaining: 'after',
        batches: [], containerWaits: {}
    };
    const DASHBOARD_LAYOUT_OPTIONS = Object.freeze(['classic', 'legacy', 'fullwidth', 'accordion', 'inset', 'compactmatrix', 'embossed']);
    const DASHBOARD_LAYOUT_LABELS = Object.freeze({
        classic: 'Classic',
        legacy: 'Legacy',
        fullwidth: 'Full Width',
        accordion: 'Accordion',
        inset: 'Inset',
        compactmatrix: 'Compact Matrix',
        embossed: 'Embossed'
    });
    const DASHBOARD_OVERFLOW_OPTIONS = Object.freeze(['default', 'expand_row', 'scroll']);
    const RUNTIME_ACTIONS_BY_TYPE = {
        docker: ['start', 'stop', 'pause', 'resume'],
        vm: ['start', 'stop', 'pause', 'resume']
    };

    if (!utilityFoundation || typeof utilityFoundation.normalizeFolderId !== 'function') {
        throw new Error('FolderView Plus utility foundation is unavailable.');
    }
    const {
        isPlainObject,
        normalizeFolderId,
        normalizeHexColor
    } = utilityFoundation;

    const getFolderStatusColors = (settings) => {
        const source = isPlainObject(settings) ? settings : {}; const normalizedStarted = normalizeHexColor(source.status_color_started, DEFAULT_FOLDER_STATUS_COLORS.started); const startedExplicit = source.status_color_started_explicit === true || source.statusColorStartedExplicit === true;
        return { started: !startedExplicit && normalizedStarted === '#ffffff' ? DEFAULT_FOLDER_STATUS_COLORS.started : normalizedStarted,
            paused: normalizeHexColor(source.status_color_paused, DEFAULT_FOLDER_STATUS_COLORS.paused),
            stopped: normalizeHexColor(source.status_color_stopped, DEFAULT_FOLDER_STATUS_COLORS.stopped), text: normalizeHexColor(source.status_color_text, DEFAULT_FOLDER_STATUS_COLORS.text)
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
            const id = normalizeFolderId(rawId);
            if (!id) {
                continue;
            }
            Object.defineProperty(output, id, {
                value: expanded === true,
                enumerable: true,
                configurable: true,
                writable: true
            });
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
        return DASHBOARD_LAYOUT_OPTIONS.includes(normalized)
            ? normalized
            : DEFAULT_DASHBOARD_PREFS.layout;
    };

    const normalizeDashboardPreviewContext = (value) => {
        const normalized = String(value || '').trim().toLowerCase();
        if (['advanced', '2'].includes(normalized)) {
            return 'advanced';
        }
        return DEFAULT_DASHBOARD_PREFS.previewContext;
    };

    const normalizeDashboardPreviewTrigger = (value) => {
        const normalized = String(value || '').trim().toLowerCase();
        return ['hover', '1'].includes(normalized) ? 'hover' : DEFAULT_DASHBOARD_PREFS.previewTrigger;
    };

    const normalizeDashboardOverflowMode = (value) => {
        const normalized = String(value || '').trim().toLowerCase();
        return DASHBOARD_OVERFLOW_OPTIONS.includes(normalized) ? normalized : 'default';
    };

    const normalizeThemeCompatibilityMode = (value) => {
        const normalized = String(value || '').trim().toLowerCase();
        return THEME_COMPATIBILITY_MODE_OPTIONS.includes(normalized) ? normalized : 'auto';
    };

    const normalizePerformanceProfile = (value, legacyPerformanceMode = false) => {
        const normalized = String(value || '').trim().toLowerCase();
        if (PERFORMANCE_PROFILE_OPTIONS.includes(normalized)) {
            return normalized;
        }
        return legacyPerformanceMode === true ? 'adaptive' : 'standard';
    };

    const normalizeRuntimePageViewMode = (value) => {
        const normalized = String(value || '').trim().toLowerCase();
        return RUNTIME_PAGE_VIEW_MODE_OPTIONS.includes(normalized) ? normalized : 'folderview';
    };

    const resolvePreviewActionPrefs = (settings = {}) => {
        const source = isPlainObject(settings) ? settings : {};
        return {
            preview_webui: source.preview_webui === true,
            preview_console: source.preview_console === true,
            preview_logs: source.preview_logs === true
        };
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
        normalized.parentId = normalizeFolderId(rawParentId);
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
            const normalizedId = normalizeFolderId(id);
            if (normalizedId === '' || Object.prototype.hasOwnProperty.call(output, normalizedId)) {
                continue;
            }
            const normalizedFolder = normalizeFolderRecord(folder);
            if (!normalizedFolder) {
                continue;
            }
            Object.defineProperty(output, normalizedId, {
                value: normalizedFolder,
                enumerable: true,
                configurable: true,
                writable: true
            });
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

    const FOLDER_SORT_MODES = Object.freeze([
        'created',
        'created_newest',
        'created_oldest',
        'updated_newest',
        'manual',
        'alpha',
        'name_desc'
    ]);


    return Object.freeze({
        ...utilityFoundation,
        EXPORT_SCHEMA_VERSION,
        RULE_KINDS,
        RULE_EFFECTS,
        LEGACY_FOLDER_LABEL_KEYS,
        DEFAULT_FOLDER_ICON_PATH,
        IMPORT_ICON_MAX_LENGTH,
        RUNTIME_PREFS_SCHEMA,
        RUNTIME_TOGGLE_PREFS_SCHEMA,
        PRIVACY_MODE_PREFS_SCHEMA,
        APP_COLUMN_WIDTH_OPTIONS,
        THEME_COMPATIBILITY_MODE_OPTIONS,
        PERFORMANCE_PROFILE_OPTIONS,
        RUNTIME_PAGE_VIEW_MODE_OPTIONS,
        DEFAULT_FOLDER_STATUS_COLORS,
        DEFAULT_HEALTH_PREFS,
        DEFAULT_STATUS_PREFS,
        DEFAULT_DASHBOARD_PREFS,
        DEFAULT_DOCKER_START_ORDER,
        DASHBOARD_LAYOUT_OPTIONS,
        DASHBOARD_LAYOUT_LABELS,
        DASHBOARD_OVERFLOW_OPTIONS,
        RUNTIME_ACTIONS_BY_TYPE,
        getFolderStatusColors,
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
        normalizeDashboardOverflowMode,
        normalizeThemeCompatibilityMode,
        normalizePerformanceProfile,
        normalizeRuntimePageViewMode,
        resolvePreviewActionPrefs,
        normalizeFolderMembers,
        normalizeFolderIcon,
        normalizeFolderRecord,
        normalizeFolderMap,
        buildNestedFolderOrderIdsFromMap,
        FOLDER_SORT_MODES
    });
}));
