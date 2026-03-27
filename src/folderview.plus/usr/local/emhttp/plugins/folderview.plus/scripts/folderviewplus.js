const utils = window.FolderViewPlusUtils || null;
const EXPORT_BASENAME = 'FolderView Plus Export';
const REQUEST_TOKEN_STORAGE_KEY = 'fv.request.token';
const requestClient = window.FolderViewPlusRequest || null;
const themeResolver = window.FolderViewPlusThemeResolver || null;
const resolveThemeCompatibilityMode = (value) => {
    if (themeResolver && typeof themeResolver.normalizeThemeCompatibilityMode === 'function') {
        return themeResolver.normalizeThemeCompatibilityMode(value);
    }
    if (utils && typeof utils.normalizeThemeCompatibilityMode === 'function') {
        return utils.normalizeThemeCompatibilityMode(value);
    }
    const normalized = String(value || '').trim().toLowerCase();
    return ['auto', 'host', 'safe', 'highcontrast'].includes(normalized) ? normalized : 'auto';
};
const resolveThemeModeWeight = (value) => {
    if (themeResolver && typeof themeResolver.getThemeCompatibilityModeWeight === 'function') {
        return themeResolver.getThemeCompatibilityModeWeight(value);
    }
    const normalized = resolveThemeCompatibilityMode(value);
    return Number({
        host: 0,
        auto: 1,
        safe: 2,
        highcontrast: 3
    }[normalized] ?? 1);
};
const buildThemeResolverSnapshot = (modeInput = null, options = {}) => (
    themeResolver && typeof themeResolver.buildResolvedThemeSnapshot === 'function'
        ? themeResolver.buildResolvedThemeSnapshot(modeInput, options)
        : { requestedMode: 'auto', appliedMode: 'auto', classification: 'mixed', autoHealed: false, contrastChecks: [], statusChecks: {}, tokens: {}, warnings: [] }
);
const applyThemeResolverTokens = (reason = 'runtime', options = {}) => (
    themeResolver && typeof themeResolver.applyResolvedThemeTokens === 'function'
        ? themeResolver.applyResolvedThemeTokens(reason, options)
        : buildThemeResolverSnapshot(options.modeInput ?? null, options)
);
const configureThemeResolverRuntimeApi = (options = {}) => {
    if (themeResolver && typeof themeResolver.configureRuntime === 'function') {
        themeResolver.configureRuntime(options);
    }
};
const settingsChrome = window.FolderViewPlusSettingsChrome || null;
const dirtyTracker = window.FolderViewPlusDirtyTracker || null;
const settingsMetadata = window.FolderViewPlusSettingsMetadata || null;
const settingsTableModule = window.FolderViewPlusSettingsTable || null;
const settingsActionSupportModule = window.FolderViewPlusSettingsActionSupport || null;
const rowDetailsModule = window.FolderViewPlusRowDetails || null;
const fatalBanner = window.FolderViewPlusFatalBanner || null;
const markFatalBannerStep = (step) => {
    if (fatalBanner && typeof fatalBanner.markStep === 'function') {
        fatalBanner.markStep(step);
    }
};
const setFatalBannerModuleStatus = (name, status, detail = '') => {
    if (fatalBanner && typeof fatalBanner.setModuleStatus === 'function') {
        fatalBanner.setModuleStatus(name, status, detail);
    }
};
const recordFatalBannerRequest = (entry = {}) => {
    if (fatalBanner && typeof fatalBanner.recordRequest === 'function') {
        fatalBanner.recordRequest(entry);
    }
};
const setFatalBannerPrefsStatus = (patch = {}) => {
    if (fatalBanner && typeof fatalBanner.setPrefsStatus === 'function') {
        fatalBanner.setPrefsStatus(patch);
    }
};
const setFatalBannerEnvironment = (patch = {}) => {
    if (fatalBanner && typeof fatalBanner.setEnvironment === 'function') {
        fatalBanner.setEnvironment(patch);
    }
};
const setFatalBannerPhase = (phase) => {
    if (fatalBanner && typeof fatalBanner.setPhase === 'function') {
        fatalBanner.setPhase(phase);
    }
};
const recordFatalBannerAction = (action) => {
    if (fatalBanner && typeof fatalBanner.recordAction === 'function') {
        fatalBanner.recordAction(action);
    }
};
const reportFatalBannerDegradedState = (error, options = {}) => {
    if (fatalBanner && typeof fatalBanner.reportDegradedState === 'function') {
        fatalBanner.reportDegradedState(error, options);
    }
};
const clearFatalBannerResolvedState = () => {
    if (fatalBanner && typeof fatalBanner.clearResolvedIssue === 'function') {
        fatalBanner.clearResolvedIssue();
    }
};
const trimFatalBannerDiagnosticString = (value) => String(value ?? '').trim();
const extractFatalBannerTraceId = (error) => {
    const direct = trimFatalBannerDiagnosticString(error?.traceId);
    if (direct) {
        return direct;
    }
    const message = trimFatalBannerDiagnosticString(error?.message || error);
    const match = message.match(/\(trace:\s*([^)]+)\)/i);
    return match ? trimFatalBannerDiagnosticString(match[1]) : '';
};
const extractFatalBannerStatus = (error) => {
    const direct = Number(error?.jqXHR?.status || error?.status || 0);
    if (Number.isFinite(direct) && direct > 0) {
        return String(direct);
    }
    const message = trimFatalBannerDiagnosticString(error?.message || error);
    const match = message.match(/\bHTTP\s+(\d{3})\b/i);
    return match ? trimFatalBannerDiagnosticString(match[1]) : '';
};
const extractFatalBannerResponseSnippet = (error) => {
    const responseText = trimFatalBannerDiagnosticString(error?.jqXHR?.responseText || error?.responseText || '');
    if (!responseText) {
        return '';
    }
    const normalized = responseText.replace(/\s+/g, ' ').trim();
    if (!normalized) {
        return '';
    }
    return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
};
const inferFatalBannerCategory = (error, fallbackCategory = 'runtime-failed') => {
    const message = trimFatalBannerDiagnosticString(error?.message || error).toLowerCase();
    if (!message) {
        return fallbackCategory;
    }
    if (message.includes('missing modules') || message.includes('module did not load')) {
        return 'missing-module';
    }
    if (message.includes('invalid json response') || message.includes('unexpected json response type')) {
        return 'invalid-response';
    }
    if (message.includes('json response') && message.includes('empty')) {
        return 'invalid-response';
    }
    if (message.includes('request failed for ')) {
        return 'request-failed';
    }
    if (message.includes('prefs')) {
        return 'prefs-corrupt';
    }
    if (message.includes('render')) {
        return 'render-failed';
    }
    return fallbackCategory;
};
const annotateFatalBannerError = (error, {
    phase = '',
    category = '',
    action = ''
} = {}) => {
    if (!error || typeof error !== 'object') {
        return error;
    }
    if (phase && !error.fvplusPhase) {
        error.fvplusPhase = phase;
    }
    if (category && !error.fvplusCategory) {
        error.fvplusCategory = category;
    }
    if (action && !error.fvplusAction) {
        error.fvplusAction = action;
    }
    return error;
};
const withFatalBannerPhase = async ({
    phase = '',
    step = '',
    action = '',
    category = 'runtime-failed'
} = {}, callback) => {
    if (phase) {
        setFatalBannerPhase(phase);
    }
    if (step) {
        markFatalBannerStep(step);
    }
    if (action) {
        recordFatalBannerAction(action);
    }
    try {
        return await callback();
    } catch (error) {
        throw annotateFatalBannerError(error, { phase, category, action });
    }
};
setFatalBannerEnvironment({
    page: 'Settings',
    url: window.location?.href || '',
    userAgent: window.navigator?.userAgent || ''
});
setFatalBannerPhase('module-load');
recordFatalBannerAction('Load Settings runtime');
markFatalBannerStep('Loaded settings runtime');
const settingsStorageWriter = utils && typeof utils.createBatchedStorageWriter === 'function'
    ? utils.createBatchedStorageWriter(window.localStorage, {
        defaultDelayMs: 80,
        idleTimeoutMs: 900
    })
    : null;
const writeSettingsStorage = (key, value, options = {}) => {
    const safeKey = String(key || '').trim();
    if (!safeKey) {
        return;
    }
    try {
        if (settingsStorageWriter && typeof settingsStorageWriter.setItem === 'function') {
            settingsStorageWriter.setItem(safeKey, String(value ?? ''), options);
            return;
        }
        localStorage.setItem(safeKey, String(value ?? ''));
    } catch (_error) {
        // Best effort only.
    }
};
const removeSettingsStorage = (key, options = {}) => {
    const safeKey = String(key || '').trim();
    if (!safeKey) {
        return;
    }
    try {
        if (settingsStorageWriter && typeof settingsStorageWriter.removeItem === 'function') {
            settingsStorageWriter.removeItem(safeKey, options);
            return;
        }
        localStorage.removeItem(safeKey);
    } catch (_error) {
        // Best effort only.
    }
};
const renderBootstrapDependencyBanner = (missingModules) => {
    if (fatalBanner && typeof fatalBanner.reportMissingModules === 'function') {
        fatalBanner.reportMissingModules(missingModules, {
            context: 'Settings',
            hostSelector: '#fv-settings-root',
            message: 'FolderView Plus could not start because required settings modules failed to load.',
            code: 'FVPLUS-SET-BOOT-001',
            phase: 'module-load'
        });
        return;
    }
};

const bootstrapMissingModules = [];
if (!utils || typeof utils.normalizePrefs !== 'function') {
    bootstrapMissingModules.push('folderviewplus.utils.js');
    setFatalBannerModuleStatus('folderviewplus.utils.js', 'missing', 'normalizePrefs unavailable');
} else {
    setFatalBannerModuleStatus('folderviewplus.utils.js', 'ok', 'normalizePrefs available');
}
if (!requestClient || typeof requestClient.getJson !== 'function' || typeof requestClient.postJson !== 'function') {
    bootstrapMissingModules.push('folderviewplus.request.js');
    setFatalBannerModuleStatus('folderviewplus.request.js', 'missing', 'request client unavailable');
} else {
    setFatalBannerModuleStatus('folderviewplus.request.js', 'ok', 'request client ready');
}
if (window.FolderViewPlusThemeResolverModuleLoaded !== true || !themeResolver) {
    bootstrapMissingModules.push('folderviewplus.theme-resolver.js');
    setFatalBannerModuleStatus('folderviewplus.theme-resolver.js', 'missing', 'theme resolver unavailable');
} else {
    setFatalBannerModuleStatus('folderviewplus.theme-resolver.js', 'ok', 'theme resolver ready');
}
if (!settingsChrome || typeof settingsChrome.getTopbarHtml !== 'function') {
    bootstrapMissingModules.push('folderviewplus.chrome.js');
    setFatalBannerModuleStatus('folderviewplus.chrome.js', 'missing', 'settings chrome exports unavailable');
} else {
    setFatalBannerModuleStatus('folderviewplus.chrome.js', 'ok', 'settings chrome ready');
}
if (
    !dirtyTracker
    || typeof dirtyTracker.getTrackedInputs !== 'function'
    || typeof dirtyTracker.captureBaseline !== 'function'
) {
    bootstrapMissingModules.push('folderviewplus.dirty.js');
    setFatalBannerModuleStatus('folderviewplus.dirty.js', 'missing', 'dirty tracking exports unavailable');
} else {
    setFatalBannerModuleStatus('folderviewplus.dirty.js', 'ok', 'dirty tracking ready');
}
if (window.FolderViewPlusRuntimeParityModuleLoaded !== true) {
    bootstrapMissingModules.push('folderviewplus.runtime-parity.js');
    setFatalBannerModuleStatus('folderviewplus.runtime-parity.js', 'missing');
} else {
    setFatalBannerModuleStatus('folderviewplus.runtime-parity.js', 'ok');
}
if (!settingsMetadata || !settingsMetadata.SETTINGS_TABLE_COLUMN_SCHEMA_BY_TYPE) {
    bootstrapMissingModules.push('folderviewplus.settings-metadata.js');
    setFatalBannerModuleStatus('folderviewplus.settings-metadata.js', 'missing', 'column schema unavailable');
} else {
    setFatalBannerModuleStatus('folderviewplus.settings-metadata.js', 'ok', 'column schema loaded');
}
if (window.FolderViewPlusSettingsSectionsModuleLoaded !== true) {
    bootstrapMissingModules.push('folderviewplus.settings-sections.js');
    setFatalBannerModuleStatus('folderviewplus.settings-sections.js', 'missing');
} else {
    setFatalBannerModuleStatus('folderviewplus.settings-sections.js', 'ok');
}
if (!settingsTableModule || typeof settingsTableModule.normalizeSettingsTablePreset !== 'function') {
    bootstrapMissingModules.push('folderviewplus.settings-table.js');
    setFatalBannerModuleStatus('folderviewplus.settings-table.js', 'missing', 'settings table helpers unavailable');
} else {
    setFatalBannerModuleStatus('folderviewplus.settings-table.js', 'ok', 'settings table helpers loaded');
}
if (window.FolderViewPlusSetupAssistantSupportModuleLoaded !== true) {
    bootstrapMissingModules.push('folderviewplus.setup-assistant.js');
    setFatalBannerModuleStatus('folderviewplus.setup-assistant.js', 'missing');
} else {
    setFatalBannerModuleStatus('folderviewplus.setup-assistant.js', 'ok');
}
if (window.FolderViewPlusSmartDetectConfigModuleLoaded !== true) {
    bootstrapMissingModules.push('folderviewplus.smart-detect-config.js');
    setFatalBannerModuleStatus('folderviewplus.smart-detect-config.js', 'missing');
} else {
    setFatalBannerModuleStatus('folderviewplus.smart-detect-config.js', 'ok');
}
if (window.FolderViewPlusStarterTemplatesModuleLoaded !== true) {
    bootstrapMissingModules.push('folderviewplus.starter-templates.js');
    setFatalBannerModuleStatus('folderviewplus.starter-templates.js', 'missing');
} else {
    setFatalBannerModuleStatus('folderviewplus.starter-templates.js', 'ok');
}
if (window.FolderViewPlusDiagnosticsModuleLoaded !== true) {
    bootstrapMissingModules.push('folderviewplus.activity-diagnostics.js');
    setFatalBannerModuleStatus('folderviewplus.activity-diagnostics.js', 'missing');
} else {
    setFatalBannerModuleStatus('folderviewplus.activity-diagnostics.js', 'ok');
}
if (window.FolderViewPlusFolderEditorModuleLoaded !== true) {
    bootstrapMissingModules.push('folderviewplus.folder-editor.js');
    setFatalBannerModuleStatus('folderviewplus.folder-editor.js', 'missing');
} else {
    setFatalBannerModuleStatus('folderviewplus.folder-editor.js', 'ok');
}
if (!rowDetailsModule || window.FolderViewPlusRowDetailsModuleLoaded !== true || typeof rowDetailsModule.createApi !== 'function') {
    bootstrapMissingModules.push('folderviewplus.row-details.js');
    setFatalBannerModuleStatus('folderviewplus.row-details.js', 'missing', 'row detail api unavailable');
} else {
    setFatalBannerModuleStatus('folderviewplus.row-details.js', 'ok', 'row detail api ready');
}
if (window.FolderViewPlusWizardSmartDetectModuleLoaded !== true) {
    bootstrapMissingModules.push('folderviewplus.wizard-smart-detect.js');
    setFatalBannerModuleStatus('folderviewplus.wizard-smart-detect.js', 'missing');
} else {
    setFatalBannerModuleStatus('folderviewplus.wizard-smart-detect.js', 'ok');
}
if (window.FolderViewPlusWizardModuleLoaded !== true) {
    bootstrapMissingModules.push('folderviewplus.wizard.js');
    setFatalBannerModuleStatus('folderviewplus.wizard.js', 'missing');
} else {
    setFatalBannerModuleStatus('folderviewplus.wizard.js', 'ok');
}
if (window.FolderViewPlusImportModuleLoaded !== true) {
    bootstrapMissingModules.push('folderviewplus.import.js');
    setFatalBannerModuleStatus('folderviewplus.import.js', 'missing');
} else {
    setFatalBannerModuleStatus('folderviewplus.import.js', 'ok');
}
if (
    !settingsActionSupportModule
    || window.FolderViewPlusSettingsActionSupportModuleLoaded !== true
    || typeof settingsActionSupportModule.createSupportActions !== 'function'
) {
    bootstrapMissingModules.push('folderviewplus.actions-support.js');
    setFatalBannerModuleStatus('folderviewplus.actions-support.js', 'missing', 'support action exports unavailable');
} else {
    setFatalBannerModuleStatus('folderviewplus.actions-support.js', 'ok', 'support actions ready');
}
if (bootstrapMissingModules.length > 0) {
    renderBootstrapDependencyBanner(bootstrapMissingModules);
    const error = new Error(`FolderView Plus bootstrap failed. Missing modules: ${bootstrapMissingModules.join(', ')}`);
    error.fvplusBannerShown = true;
    error.fvplusPhase = 'module-load';
    error.fvplusCategory = 'missing-module';
    throw error;
}
setFatalBannerPhase('bootstrap-state');
recordFatalBannerAction('Validated required Settings modules');
markFatalBannerStep('Validated required settings modules');

let dockers = {};
let vms = {};
let pluginVersion = '0.0.0';
let prefsByType = {
    docker: utils.normalizePrefs({}),
    vm: utils.normalizePrefs({})
};
let infoByType = {
    docker: {},
    vm: {}
};
let backupsByType = {
    docker: [],
    vm: []
};
let templatesByType = {
    docker: [],
    vm: []
};
let selectedRuleIdsByType = {
    docker: new Set(),
    vm: new Set()
};
let selectedTemplateIdsByType = {
    docker: new Set(),
    vm: new Set()
};
let filtersByType = {
    docker: {
        folders: '',
        rules: '',
        backups: '',
        templates: '',
        bulk: ''
    },
    vm: {
        folders: '',
        rules: '',
        backups: '',
        templates: '',
        bulk: ''
    }
};
let healthMetricsByType = {
    docker: null,
    vm: null
};
let healthFilterByType = {
    docker: 'all',
    vm: 'all'
};
let healthSeverityFilterByType = {
    docker: 'all',
    vm: 'all'
};
let statusFilterByType = {
    docker: 'all',
    vm: 'all'
};
let quickFolderFilterByType = {
    docker: 'all',
    vm: 'all'
};
const SETTINGS_TABLE_COLUMN_SCHEMA_BY_TYPE = settingsMetadata?.SETTINGS_TABLE_COLUMN_SCHEMA_BY_TYPE || Object.freeze({
    docker: Object.freeze([]),
    vm: Object.freeze([])
});
const SETTINGS_TABLE_COLUMN_SCHEMA_MAP_BY_TYPE = settingsMetadata?.SETTINGS_TABLE_COLUMN_SCHEMA_MAP_BY_TYPE || Object.freeze({
    docker: Object.freeze({}),
    vm: Object.freeze({})
});
const DEFAULT_COLUMN_VISIBILITY_BY_TYPE = settingsMetadata?.DEFAULT_COLUMN_VISIBILITY_BY_TYPE || Object.freeze({
    docker: Object.freeze({}),
    vm: Object.freeze({})
});
let columnVisibilityByType = {
    docker: { ...DEFAULT_COLUMN_VISIBILITY_BY_TYPE.docker },
    vm: { ...DEFAULT_COLUMN_VISIBILITY_BY_TYPE.vm }
};
let columnWidthModeByType = {
    docker: 'auto',
    vm: 'auto'
};
let columnPresetByType = {
    docker: 'balanced',
    vm: 'balanced'
};
let settingsTableWidthPresetByType = {
    docker: { name: 'standard', actions: 'standard' },
    vm: { name: 'standard', actions: 'standard' }
};
let columnWidthsByType = {
    docker: {},
    vm: {}
};
let collapsedTreeParentsByType = {
    docker: new Set(),
    vm: new Set()
};
let statusSnapshotByType = {
    docker: {},
    vm: {}
};
let dockerUpdatesOnlyFilter = false;
let activityFeedEntries = [];
let toastSerial = 0;
const pendingUndoTimers = new Map();
const treeMoveUndoTimersByType = {
    docker: null,
    vm: null
};
let treeMoveUndoNoticeByType = {
    docker: null,
    vm: null
};
const treeMoveHistoryByType = {
    docker: {
        undoStack: [],
        redoStack: []
    },
    vm: {
        undoStack: [],
        redoStack: []
    }
};
const TREE_MOVE_HISTORY_LIMIT = 20;
const TREE_INTEGRITY_DEPTH_WARN_LEVEL = 4;
let mobileTreeReorderModeByType = {
    docker: false,
    vm: false
};
let pendingTableRenderFrameByType = {
    docker: null,
    vm: null
};
let rowLongPressByType = {
    docker: null,
    vm: null
};
let rowFocusTimersByType = {
    docker: null,
    vm: null
};
let rowDetailsDrawerByType = {
    docker: null,
    vm: null
};
let folderTreeMoveErrorsByType = {
    docker: {},
    vm: {}
};
let folderTreeMoveErrorTimersByType = {
    docker: {},
    vm: {}
};
let importSelectionState = null;
let importDiffPagingState = {
    rows: [],
    page: 1,
    pageSize: 80
};
let backupCompareDiffPagingState = {
    rows: [],
    page: 1,
    pageSize: 120
};
const IMPORT_APPLY_CHUNK_SIZE = 20;
const IMPORT_APPLY_CHUNK_PAUSE_MS = 16;
let latestPrefsBackupByType = {
    docker: null,
    vm: null
};
let backupCompareSelectionByType = {
    docker: {
        left: '',
        right: '__current__',
        includePrefs: true
    },
    vm: {
        left: '',
        right: '__current__',
        includePrefs: true
    }
};
const createBulkAssignUiState = () => ({
    selected: new Set(),
    allNames: [],
    visibleNames: [],
    failedNames: [],
    lastTargetFolderId: '',
    lastResult: null,
    applying: false,
    renderToken: 0
});
let bulkAssignStateByType = {
    docker: createBulkAssignUiState(),
    vm: createBulkAssignUiState()
};
let activeRulesWorkspaceType = 'docker';
let activeRecoveryWorkspaceType = 'docker';

const UI_MODE_STORAGE_KEY = 'fv.settings.mode.v1';
const RULES_WORKSPACE_STORAGE_KEY = 'fv.settings.rulesWorkspace.v1';
const RECOVERY_WORKSPACE_STORAGE_KEY = 'fv.settings.recoveryWorkspace.v1';
const UPDATE_NOTES_SEEN_VERSION_STORAGE_KEY = 'fv.settings.updateNotesSeenVersion.v1';
const RUNTIME_CONFLICT_ACTIVE_STORAGE_KEY = 'fv.runtimeConflict.active.v1';
const RUNTIME_CONFLICT_RESOLVED_PENDING_STORAGE_KEY = 'fv.runtimeConflict.resolvedPending.v1';
const IMPORT_PREVIEW_FIRST_STORAGE_KEY = 'fv.import.previewFirst.v1';
const TABLE_UI_STATE_STORAGE_KEY = 'fv.settings.tableUiState.v1';
const LONG_PRESS_DELAY_MS = 560;
const IMPORT_PRESET_DEFAULT_ID = 'builtin:merge';
const UNDO_WINDOW_MS = 10000;
const ROW_FOCUS_HIGHLIGHT_MS = 2200;
const SETTINGS_TABLE_COLUMN_COUNT = Number.isFinite(Number(settingsMetadata?.SETTINGS_TABLE_COLUMN_COUNT))
    ? Number(settingsMetadata.SETTINGS_TABLE_COLUMN_COUNT)
    : 10;
const BULK_ASSIGN_CHUNK_SIZE = 40;
const BULK_ASSIGN_CHUNK_PAUSE_MS = 20;
const BULK_LIST_RENDER_CHUNK_SIZE = 120;
const IMPORT_PRESET_BUILTINS = [
    {
        id: 'builtin:merge',
        name: 'Merge safely',
        mode: 'merge',
        dryRunOnly: false
    },
    {
        id: 'builtin:replace',
        name: 'Replace fully',
        mode: 'replace',
        dryRunOnly: false
    },
    {
        id: 'builtin:skip',
        name: 'Add new only',
        mode: 'skip',
        dryRunOnly: false
    },
    {
        id: 'builtin:dryrun',
        name: 'Dry-run merge',
        mode: 'merge',
        dryRunOnly: true
    }
];
const UPDATE_NOTES_CHANGELOG_URL = 'https://github.com/alexphillips-dev/FolderView-Plus/blob/main/folderview.plus.plg';
const SUPPORT_THREAD_URL = 'https://forums.unraid.net/topic/197631-plugin-folderview-plus/';
const settingsUiState = {
    initialized: false,
    controlsInitialized: false,
    mode: 'basic',
    query: '',
    sections: [],
    baselineByInputId: new Map(),
    activeSectionKey: '',
    advancedTab: 'automation',
    advancedSearchByTab: {
        automation: '',
        rules: '',
        recovery: '',
        operations: '',
        diagnostics: ''
    },
    searchAllAdvanced: false,
    expandedAdvancedSections: new Set(),
    knownAdvancedSections: new Set(),
    hasExpandedAdvancedPreference: false,
    wizardShown: false
};
const createAdvancedModuleLoadEntry = () => ({
    loaded: false,
    pending: null,
    lastLoadedAt: 0,
    lastErrorAt: 0,
    lastErrorMessage: ''
});
const advancedDataLoadState = {
    loaded: false,
    pending: null,
    modules: {
        docker_backups: createAdvancedModuleLoadEntry(),
        vm_backups: createAdvancedModuleLoadEntry(),
        docker_templates: createAdvancedModuleLoadEntry(),
        vm_templates: createAdvancedModuleLoadEntry(),
        change_history: createAdvancedModuleLoadEntry()
    }
};
const advancedModuleStatusByKey = {
    docker_backups: { state: 'idle', message: '' },
    vm_backups: { state: 'idle', message: '' },
    docker_templates: { state: 'idle', message: '' },
    vm_templates: { state: 'idle', message: '' },
    change_history: { state: 'idle', message: '' }
};
const advancedOperationLockByType = {
    docker: {
        backups: false,
        templates: false,
        bulk: false
    },
    vm: {
        backups: false,
        templates: false,
        bulk: false
    }
};
const setupAssistantState = {
    version: SETUP_ASSISTANT_VERSION,
    open: false,
    force: false,
    step: 0,
    busy: false,
    applying: false,
    progressLabel: '',
    progressPercent: 0,
    route: 'new',
    mode: 'basic',
    experienceMode: 'guided',
    applySafetyMode: 'auto',
    quickPreset: 'balanced',
    profile: 'balanced',
    applyProfileDefaults: true,
    environmentPreset: 'home_lab',
    applyEnvironmentDefaults: true,
    dryRunOnly: false,
    focusModeEnabled: true,
    contrastPreference: 'auto',
    contrastTierApplied: 'normal',
    lastContrastReport: null,
    collapsedChipRows: {},
    context: null,
    importPlans: {
        docker: null,
        vm: null
    },
    templateBootstrap: {
        docker: {
            enabled: true,
            category: 'smart',
            selectedTemplateNames: [],
            autoAssignExisting: true
        },
        vm: {
            enabled: true,
            category: 'smart',
            selectedTemplateNames: [],
            autoAssignExisting: true
        }
    },
    ruleBootstrap: {
        docker: {
            enabled: false,
            suggestions: []
        },
        vm: {
            enabled: false,
            suggestions: []
        }
    },
    behavior: {
        docker: null,
        vm: null
    },
    reviewNotes: [],
    impactBaseline: null,
    suggestedRoute: 'new',
    suggestedMode: 'basic',
    suggestedQuickPreset: 'balanced',
    suggestedReason: '',
    selectedPresetId: '',
    presetDraftName: '',
    lastApplyReport: null,
    rollbackCheckpointName: '',
    draftRestored: false,
    restoredDraftSavedAt: '',
    mobileSidebarSummaryOpen: false
};
let setupAssistantLastFocusedElement = null;
let overflowGuardBound = false;
let mobileLayoutGuardBound = false;
let settingsThemeReflowBound = false;
let settingsThemeReflowObserver = null;
let settingsThemeReflowTimer = null;
let lastThemeResolverSnapshot = null;
const MOBILE_SETTINGS_BREAKPOINT_PX = 760;
const MOBILE_LAYOUT_BREAKPOINT_PX = 1100;
const MOBILE_LAYOUT_COARSE_BREAKPOINT_PX = 1600;

const getEffectiveThemeCompatibilityMode = () => {
    const dockerPrefs = utils.normalizePrefs(prefsByType?.docker || {});
    const vmPrefs = utils.normalizePrefs(prefsByType?.vm || {});
    const dockerMode = resolveThemeCompatibilityMode(dockerPrefs.themeCompatibilityMode);
    const vmMode = resolveThemeCompatibilityMode(vmPrefs.themeCompatibilityMode);
    return resolveThemeModeWeight(dockerMode) >= resolveThemeModeWeight(vmMode)
        ? dockerMode
        : vmMode;
};

const supportsTouchInput = () => (
    ('ontouchstart' in window)
    || (navigator.maxTouchPoints > 0)
    || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
);

const isMobileSettingsViewport = () => (
    window.matchMedia
    && window.matchMedia(`(max-width: ${MOBILE_SETTINGS_BREAKPOINT_PX}px)`).matches
);

const shouldUseMobileSectionToggle = () => supportsTouchInput() && isMobileSettingsViewport();

const getViewportWidth = () => {
    const visualWidth = Number(window?.visualViewport?.width || 0);
    const innerWidth = Number(window.innerWidth || 0);
    const docWidth = Number(document?.documentElement?.clientWidth || 0);
    return [visualWidth, innerWidth, docWidth]
        .filter((value) => Number.isFinite(value) && value > 0)
        .reduce((min, value) => Math.min(min, value), Number.POSITIVE_INFINITY);
};

const isLikelyMobileUserAgent = () => (
    /android|iphone|ipod|ipad|mobile|windows phone/i.test(String(navigator?.userAgent || ''))
);

const shouldUseCompactMobileLayout = () => {
    const width = getViewportWidth();
    const coarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (Number.isFinite(width) && width > 0) {
        if (width <= MOBILE_LAYOUT_BREAKPOINT_PX) {
            return true;
        }
        if (coarsePointer && width <= MOBILE_LAYOUT_COARSE_BREAKPOINT_PX) {
            return true;
        }
    }
    return coarsePointer || isLikelyMobileUserAgent();
};

const syncCompactMobileLayoutClass = () => {
    const enabled = shouldUseCompactMobileLayout();
    const root = document.getElementById('fv-settings-root');
    if (root) {
        root.classList.toggle('fv-mobile-compact', enabled);
    }
    if (document.body) {
        document.body.classList.toggle('fv-mobile-compact', enabled);
    }
    if (activeTableColumnResize) {
        stopActiveTableColumnResize(false);
    }
    try {
        applyColumnWidths('docker');
        applyColumnWidths('vm');
        bindTableColumnResizers('docker');
        bindTableColumnResizers('vm');
    } catch (_error) {}
};

const initCompactMobileLayoutGuard = () => {
    syncCompactMobileLayoutClass();
    if (mobileLayoutGuardBound) {
        return;
    }
    mobileLayoutGuardBound = true;
    window.addEventListener('resize', syncCompactMobileLayoutClass);
    window.addEventListener('orientationchange', syncCompactMobileLayoutClass);
    if (window.visualViewport && typeof window.visualViewport.addEventListener === 'function') {
        window.visualViewport.addEventListener('resize', syncCompactMobileLayoutClass);
    }
};

const applySettingsThemeAwareReflow = () => {
    applySettingsResolvedThemeTokens('settings-reflow');
    syncCompactMobileLayoutClass();
    enforceNoHorizontalOverflow();
    try {
        syncResizableTableLayout('docker');
        syncResizableTableLayout('vm');
        bindTableColumnResizers('docker');
        bindTableColumnResizers('vm');
    } catch (_error) {
        // Best effort only; do not break settings runtime for one reflow failure.
    }
    refreshSettingsUx();
};

const queueSettingsThemeAwareReflow = (reason = 'theme-change') => {
    const nextReason = String(reason || 'theme-change');
    if (settingsThemeReflowTimer !== null) {
        window.clearTimeout(settingsThemeReflowTimer);
    }
    settingsThemeReflowTimer = window.setTimeout(() => {
        settingsThemeReflowTimer = null;
        trackDiagnosticsEvent({
            eventType: 'theme_reflow',
            details: { source: nextReason }
        });
        applySettingsThemeAwareReflow();
    }, 60);
};

const initThemeAwareSettingsReflow = () => {
    applySettingsThemeAwareReflow();
    if (settingsThemeReflowBound) {
        return;
    }
    settingsThemeReflowBound = true;
    if (typeof MutationObserver === 'function') {
        settingsThemeReflowObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations || []) {
                if (mutation.type !== 'attributes') {
                    continue;
                }
                const attr = String(mutation.attributeName || '').toLowerCase();
                if (!attr || attr === 'class' || attr === 'style' || attr.includes('theme')) {
                    queueSettingsThemeAwareReflow('observer');
                    return;
                }
            }
        });
        if (document.documentElement) {
            settingsThemeReflowObserver.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['class', 'style', 'data-theme', 'theme', 'data-color-scheme', 'data-bs-theme']
            });
        }
        if (document.body) {
            settingsThemeReflowObserver.observe(document.body, {
                attributes: true,
                attributeFilter: ['class', 'style', 'data-theme', 'theme', 'data-color-scheme', 'data-bs-theme']
            });
        }
    }
    if (typeof window.matchMedia === 'function') {
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        if (media && typeof media.addEventListener === 'function') {
            media.addEventListener('change', () => queueSettingsThemeAwareReflow('prefers-color-scheme'));
        } else if (media && typeof media.addListener === 'function') {
            media.addListener(() => queueSettingsThemeAwareReflow('prefers-color-scheme'));
        }
    }
};
configureThemeResolverRuntimeApi({
    getMode: getEffectiveThemeCompatibilityMode,
    trackEvent: (payload) => trackDiagnosticsEvent(payload)
});

const applySettingsResolvedThemeTokens = (reason = 'runtime') => {
    lastThemeResolverSnapshot = applyThemeResolverTokens(reason, {
        root: document.getElementById('fv-settings-root') || document.body
    });
    return lastThemeResolverSnapshot;
};
if (requestClient && typeof requestClient.configureSecurityHeaders === 'function') {
    requestClient.configureSecurityHeaders({
        tokenStorageKey: REQUEST_TOKEN_STORAGE_KEY
    });
}

const getOptionalRequestToken = () => {
    const metaToken = document.querySelector('meta[name="fv-request-token"]');
    if (metaToken && typeof metaToken.content === 'string') {
        const fromMeta = String(metaToken.content || '').trim();
        if (fromMeta) {
            return fromMeta;
        }
    }
    try {
        return String(localStorage.getItem(REQUEST_TOKEN_STORAGE_KEY) || '').trim();
    } catch (_error) {
        return '';
    }
};

const slugifySectionKey = (text) => String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const getInputSerializedValue = (input) => {
    if (dirtyTracker && typeof dirtyTracker.getInputSerializedValue === 'function') {
        return dirtyTracker.getInputSerializedValue(input);
    }
    if (!input) {
        return '';
    }
    if (input.type === 'checkbox') {
        return input.checked ? '1' : '0';
    }
    return String(input.value ?? '');
};

const INSTANT_PERSIST_ONCHANGE_TOKENS = Object.freeze(
    dirtyTracker && Array.isArray(dirtyTracker.DEFAULT_INSTANT_PERSIST_ONCHANGE_TOKENS)
        ? dirtyTracker.DEFAULT_INSTANT_PERSIST_ONCHANGE_TOKENS
        : [
            'changesortmode(',
            'changebadgepref(',
            'changevisibilitypref(',
            'changestatuspref(',
            'changeruntimepref(',
            'changedashboardpref(',
            'changehealthpref(',
            'changebackupschedulepref(',
            'changecolumnvisibility(',
            'changesettingstablecolumnwidthpreset(',
            'togglerulekindfields(',
            'toggleallruleselections(',
            'togglealltemplateselections('
        ]
);

const isInstantPersistInput = (input) => {
    if (dirtyTracker && typeof dirtyTracker.isInstantPersistInput === 'function') {
        return dirtyTracker.isInstantPersistInput(input, {
            tokens: INSTANT_PERSIST_ONCHANGE_TOKENS
        });
    }
    if (!(input instanceof HTMLElement)) {
        return false;
    }
    if (String(input.dataset.fvTrackSave || '') === '0') {
        return true;
    }
    if (String(input.dataset.fvTrackSave || '') === '1') {
        return false;
    }
    const handler = String(input.getAttribute('onchange') || '').trim().toLowerCase();
    if (!handler) {
        // Inputs without an onchange handler are typically transient filters/test fields
        // and should not trigger the global save/cancel action dock.
        return true;
    }
    return INSTANT_PERSIST_ONCHANGE_TOKENS.some((token) => handler.includes(token));
};

const getSectionBehaviorHint = (sectionOrKey = null) => {
    const sectionKey = typeof sectionOrKey === 'string'
        ? sectionOrKey
        : String(sectionOrKey?.key || '').trim().toLowerCase();
    if (!sectionKey) {
        return '';
    }
    return String(SECTION_APPLY_BEHAVIOR?.[sectionKey] || '').trim().toLowerCase();
};

const getInputOwningSection = (input) => {
    if (!(input instanceof HTMLElement) || !Array.isArray(settingsUiState.sections)) {
        return null;
    }
    for (const section of settingsUiState.sections) {
        const nodes = Array.isArray(section?.nodes) ? section.nodes : [];
        for (const node of nodes) {
            if (!(node instanceof Element)) {
                continue;
            }
            if (node === input || node.contains(input)) {
                return section;
            }
        }
    }
    return null;
};

const shouldTrackSettingsInput = (input, section = null) => {
    if (!(input instanceof HTMLElement)) {
        return false;
    }
    if (String(input.dataset.fvTrackSave || '') === '0') {
        return false;
    }
    if (isInstantPersistInput(input)) {
        return false;
    }
    const ownerSection = section || getInputOwningSection(input);
    if (getSectionBehaviorHint(ownerSection) === 'instant') {
        return false;
    }
    return true;
};

const getTrackedInputs = () => {
    if (dirtyTracker && typeof dirtyTracker.getTrackedInputs === 'function') {
        return dirtyTracker.getTrackedInputs(document, {
            tokens: INSTANT_PERSIST_ONCHANGE_TOKENS,
            shouldTrackInput: shouldTrackSettingsInput
        });
    }
    return Array
        .from(document.querySelectorAll('input[id], select[id], textarea[id]'))
        .filter((input) => shouldTrackSettingsInput(input));
};

const getChangedTrackedInputs = () => {
    if (dirtyTracker && typeof dirtyTracker.getChangedInputs === 'function') {
        return dirtyTracker.getChangedInputs(
            getTrackedInputs(),
            settingsUiState.baselineByInputId,
            getInputSerializedValue
        );
    }
    return getTrackedInputs().filter((input) => (
        settingsUiState.baselineByInputId.has(input.id)
        && settingsUiState.baselineByInputId.get(input.id) !== getInputSerializedValue(input)
    ));
};

const normalizeAdvancedGroup = (value) => (
    ADVANCED_GROUPS.includes(String(value || ''))
        ? String(value || '')
        : 'operations'
);

const normalizeAdvancedSearchMap = (value) => {
    const source = value && typeof value === 'object' ? value : {};
    const next = {};
    for (const group of ADVANCED_GROUPS) {
        next[group] = normalizedFilter(source[group]);
    }
    return next;
};

const readActiveAdvancedSearchQuery = () => {
    const tab = normalizeAdvancedGroup(settingsUiState.advancedTab);
    const map = normalizeAdvancedSearchMap(settingsUiState.advancedSearchByTab);
    settingsUiState.advancedSearchByTab = map;
    return normalizedFilter(map[tab]);
};

const writeActiveAdvancedSearchQuery = (query) => {
    const tab = normalizeAdvancedGroup(settingsUiState.advancedTab);
    const map = normalizeAdvancedSearchMap(settingsUiState.advancedSearchByTab);
    map[tab] = normalizedFilter(query);
    settingsUiState.advancedSearchByTab = map;
};

const normalizeAdvancedModuleKeys = (modulesInput = null) => {
    if (!Array.isArray(modulesInput)) {
        return [];
    }
    const deduped = new Set();
    for (const key of modulesInput) {
        const normalized = String(key || '').trim().toLowerCase();
        if (!normalized || !ADVANCED_MODULE_KEYS.includes(normalized)) {
            continue;
        }
        deduped.add(normalized);
    }
    return Array.from(deduped);
};

const getAdvancedModulesForTab = (tab, includeSearchAll = false) => {
    if (includeSearchAll) {
        return [...ADVANCED_MODULE_KEYS];
    }
    const group = normalizeAdvancedGroup(tab);
    return [...(ADVANCED_MODULE_KEYS_BY_TAB[group] || [])];
};

const getRequestedAdvancedModuleKeys = ({
    force = false,
    explicitModules = null,
    tab = null,
    includeSearchAll = false
} = {}) => {
    const normalizedExplicit = normalizeAdvancedModuleKeys(explicitModules);
    if (normalizedExplicit.length > 0) {
        return normalizedExplicit;
    }
    if (force === true) {
        return [...ADVANCED_MODULE_KEYS];
    }
    if (settingsUiState.mode !== 'advanced') {
        return [];
    }
    const targetTab = tab === null ? settingsUiState.advancedTab : tab;
    return getAdvancedModulesForTab(targetTab, includeSearchAll);
};

const persistExpandedAdvancedSections = () => {
    const payload = JSON.stringify(Array.from(settingsUiState.expandedAdvancedSections || []));
    settingsUiState.hasExpandedAdvancedPreference = true;
    writeSettingsStorage(ADVANCED_EXPANDED_STORAGE_KEY, payload, { delayMs: 70, idle: true });
};

const persistKnownAdvancedSections = () => {
    const payload = JSON.stringify(Array.from(settingsUiState.knownAdvancedSections || []));
    writeSettingsStorage(ADVANCED_KNOWN_STORAGE_KEY, payload, { delayMs: 70, idle: true });
};

const setsEqual = (a, b) => {
    if (a.size !== b.size) {
        return false;
    }
    for (const item of a) {
        if (!b.has(item)) {
            return false;
        }
    }
    return true;
};

const normalizeExpandedAdvancedSections = () => {
    const advancedKeys = settingsUiState.sections
        .filter((section) => section.advanced)
        .map((section) => section.key);
    const knownKeys = new Set(advancedKeys);
    const priorExpanded = new Set(settingsUiState.expandedAdvancedSections || []);
    let knownAdvanced = new Set(
        Array.from(settingsUiState.knownAdvancedSections || [])
            .map((key) => String(key || '').trim())
            .filter((key) => key !== '' && knownKeys.has(key))
    );

    // Guard for old installs: if we had expansion prefs but no known-section list,
    // treat legacy sections as known so newly added sections auto-expand once.
    if (settingsUiState.hasExpandedAdvancedPreference && knownAdvanced.size === 0) {
        knownAdvanced = new Set(
            LEGACY_ADVANCED_SECTION_KEYS.filter((key) => knownKeys.has(key))
        );
    }

    const normalized = new Set(
        Array.from(settingsUiState.expandedAdvancedSections || [])
            .map((key) => String(key || '').trim())
            .filter((key) => key !== '' && knownKeys.has(key))
    );
    if (!settingsUiState.hasExpandedAdvancedPreference) {
        // New defaults: start less cluttered by expanding only the first section
        // in each advanced tab. Users can still expand all via the tab compact toggle.
        for (const group of ADVANCED_GROUPS) {
            const firstInGroup = settingsUiState.sections.find((section) => (
                section.advanced === true && section.advancedGroup === group
            ));
            if (firstInGroup?.key) {
                normalized.add(firstInGroup.key);
            }
        }
        if (normalized.size === 0 && advancedKeys.length > 0) {
            normalized.add(advancedKeys[0]);
        }
        settingsUiState.expandedAdvancedSections = normalized;
        if (advancedKeys.length > 0) {
            persistExpandedAdvancedSections();
        }
        settingsUiState.knownAdvancedSections = new Set(advancedKeys);
        persistKnownAdvancedSections();
        return;
    }

    for (const key of advancedKeys) {
        if (!knownAdvanced.has(key)) {
            normalized.add(key);
        }
    }

    const changedByCleanup = !setsEqual(normalized, priorExpanded);
    settingsUiState.expandedAdvancedSections = normalized;
    if (changedByCleanup) {
        persistExpandedAdvancedSections();
    }

    const nextKnown = new Set(advancedKeys);
    const knownChanged = !setsEqual(nextKnown, settingsUiState.knownAdvancedSections);
    settingsUiState.knownAdvancedSections = nextKnown;
    if (knownChanged) {
        persistKnownAdvancedSections();
    }
};

const persistActiveAdvancedSection = (sectionKey) => {
    const key = String(sectionKey || '').trim();
    if (!key) {
        removeSettingsStorage(ADVANCED_SECTION_STORAGE_KEY, { delayMs: 40, idle: true });
        return;
    }
    writeSettingsStorage(ADVANCED_SECTION_STORAGE_KEY, key, { delayMs: 70, idle: true });
};

const setAdvancedTab = (tab, persist = true) => {
    settingsUiState.advancedTab = normalizeAdvancedGroup(tab);
    if (settingsUiState.mode === 'advanced') {
        const nextQuery = readActiveAdvancedSearchQuery();
        settingsUiState.query = nextQuery;
        const searchInput = $('#fv-settings-search');
        if (searchInput.length) {
            searchInput.val(nextQuery);
        }
    }
    if (persist) {
        writeSettingsStorage(ADVANCED_TAB_STORAGE_KEY, settingsUiState.advancedTab, { delayMs: 70, idle: true });
        persistTableUiState();
    }
    if (settingsUiState.mode === 'advanced') {
        void ensureAdvancedDataLoaded();
    }
};

const captureSettingsBaseline = () => {
    if (dirtyTracker && typeof dirtyTracker.captureBaseline === 'function') {
        dirtyTracker.captureBaseline(
            getTrackedInputs(),
            settingsUiState.baselineByInputId,
            getInputSerializedValue
        );
    } else {
        settingsUiState.baselineByInputId.clear();
        for (const input of getTrackedInputs()) {
            settingsUiState.baselineByInputId.set(input.id, getInputSerializedValue(input));
        }
    }
};

const isInputInvalidForUi = (input) => {
    if (!input) {
        return false;
    }
    if (input.type === 'number' && input.value !== '') {
        const parsed = Number(input.value);
        if (!Number.isFinite(parsed)) {
            return true;
        }
        if (input.min !== '' && parsed < Number(input.min)) {
            return true;
        }
        if (input.max !== '' && parsed > Number(input.max)) {
            return true;
        }
    }
    if ((input.id === 'docker-rule-pattern' || input.id === 'vm-rule-pattern') && String(input.value || '').trim()) {
        try {
            // eslint-disable-next-line no-new
            new RegExp(String(input.value || '').trim());
        } catch (_error) {
            return true;
        }
    }
    return false;
};

const refreshInputInvalidStyles = () => {
    for (const input of getTrackedInputs()) {
        input.classList.toggle('fv-input-invalid', isInputInvalidForUi(input));
    }
};

const buildSettingsSections = () => {
    const headings = Array.from(document.querySelectorAll('h2[data-fv-section]'));
    const sections = [];

    for (const heading of headings) {
        const key = String(heading.dataset.fvSection || slugifySectionKey(heading.textContent));
        const title = Array.from(heading.childNodes)
            .filter((node) => !(
                node instanceof HTMLElement
                && (
                    node.classList.contains('fv-section-badge')
                    || node.classList.contains('fv-section-mode')
                    || node.classList.contains('fv-section-toggle')
                )
            ))
            .map((node) => node.textContent || '')
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
        const advanced = heading.dataset.fvAdvanced === '1' || ADVANCED_SECTION_KEYS.has(key);
        const advancedGroup = advanced
            ? normalizeAdvancedGroup(heading.dataset.fvAdvancedGroup || ADVANCED_GROUP_BY_SECTION[key] || 'operations')
            : 'main';
        const sectionRow = heading.closest('[data-fv-section-row="1"]');
        const sectionStartNode = sectionRow instanceof HTMLElement ? sectionRow : heading;
        const nodes = [sectionStartNode];

        let cursor = sectionStartNode.nextElementSibling;
        while (cursor && cursor.tagName !== 'H2' && cursor.tagName !== 'SCRIPT') {
            if (cursor.querySelector?.('h2[data-fv-section]')) {
                break;
            }
            // Keep shared modals outside section visibility toggles so dialogs never render blank.
            if (cursor.id === 'import-preview-dialog') {
                break;
            }
            nodes.push(cursor);
            cursor = cursor.nextElementSibling;
        }

        heading.id = heading.id || `fv-section-${key}`;
        heading.dataset.fvSection = key;
        heading.dataset.fvAdvancedGroup = advancedGroup;
        heading.dataset.fvAdvanced = advanced ? '1' : '0';

        let badge = heading.querySelector('.fv-section-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'fv-section-badge is-ok';
            heading.appendChild(badge);
        }

        let modeBadge = heading.querySelector('.fv-section-mode');
        if (!modeBadge) {
            modeBadge = document.createElement('span');
            modeBadge.className = 'fv-section-mode is-instant';
            modeBadge.textContent = 'Applies instantly';
            heading.appendChild(modeBadge);
        }

        let toggle = heading.querySelector('.fv-section-toggle');
        if (advanced && !toggle) {
            toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'fv-section-toggle';
            toggle.dataset.sectionToggle = key;
            toggle.setAttribute('aria-label', `Toggle ${title || key}`);
            heading.appendChild(toggle);
        }

        const contentNodes = nodes.filter((node) => node !== sectionStartNode);

        sections.push({
            key,
            title,
            advanced,
            advancedGroup,
            heading,
            badge,
            modeBadge,
            toggle,
            nodes,
            contentNodes
        });
    }

    settingsUiState.sections = sections;
};

const getSectionApplyMode = (section) => {
    if (!section || !Array.isArray(section.nodes)) {
        return null;
    }
    const behaviorHint = getSectionBehaviorHint(section);
    if (behaviorHint === 'instant') {
        return null;
    }
    if (behaviorHint === 'staged') {
        return { id: 'staged', label: 'Requires Save' };
    }
    const seen = new Set();
    let hasInstantApply = false;
    let hasStagedApply = false;
    for (const node of section.nodes) {
        if (!(node instanceof HTMLElement)) {
            continue;
        }
        const inputs = node.querySelectorAll('input[id], select[id], textarea[id]');
        for (const input of inputs) {
            const inputId = String(input.id || '').trim();
            if (!inputId || seen.has(inputId)) {
                continue;
            }
            seen.add(inputId);
            if (String(input.dataset.fvTrackSave || '') === '1') {
                hasStagedApply = true;
                continue;
            }
            const handler = String(input.getAttribute('onchange') || '').trim().toLowerCase();
            if (!handler) {
                continue;
            }
            if (isInstantPersistInput(input)) {
                hasInstantApply = true;
            } else {
                hasStagedApply = true;
            }
        }
    }
    if (hasStagedApply) {
        return { id: 'staged', label: 'Requires Save' };
    }
    return null;
};

const refreshSectionApplyModeBadges = () => {
    for (const section of settingsUiState.sections) {
        if (!section?.modeBadge) {
            continue;
        }
        const mode = getSectionApplyMode(section);
        section.modeBadge.classList.remove('is-instant', 'is-staged', 'is-mixed');
        if (!mode) {
            section.modeBadge.textContent = '';
            section.modeBadge.hidden = true;
            section.modeBadge.removeAttribute('title');
            continue;
        }
        section.modeBadge.hidden = false;
        section.modeBadge.textContent = mode.label;
        section.modeBadge.classList.add(`is-${mode.id}`);
        section.modeBadge.setAttribute('title', mode.label);
    }
};

const getSectionSearchHaystack = (section) => section.nodes
    .map((node) => node.textContent || '')
    .join(' ')
    .toLowerCase();

const sectionContainsSelector = (section, selector) => {
    const nodes = Array.isArray(section?.nodes) ? section.nodes : [];
    for (const node of nodes) {
        if (!(node instanceof Element)) {
            continue;
        }
        if (typeof node.matches === 'function' && node.matches(selector)) {
            return true;
        }
        if (typeof node.querySelector === 'function' && node.querySelector(selector)) {
            return true;
        }
    }
    return false;
};

const isBasicWorkspaceSection = (section) => {
    const key = String(section?.key || '').trim().toLowerCase();
    if (BASIC_WORKSPACE_SECTION_KEYS.has(key)) {
        return true;
    }
    return sectionContainsSelector(section, 'tbody#docker, tbody#vms');
};

const getBasicWorkspaceSections = () => settingsUiState.sections.filter((section) => isBasicWorkspaceSection(section));

const getVisibleSections = () => settingsUiState.sections.filter((section) => {
    const modeVisible = settingsUiState.mode === 'advanced'
        ? !isBasicWorkspaceSection(section)
        : isBasicWorkspaceSection(section);
    if (!modeVisible) {
        return false;
    }
    const query = settingsUiState.query;
    const searchAcrossAllAdvanced = settingsUiState.searchAllAdvanced && Boolean(query);
    if (
        settingsUiState.mode === 'advanced'
        && section.advanced
        && !searchAcrossAllAdvanced
        && section.advancedGroup !== settingsUiState.advancedTab
    ) {
        return false;
    }
    if (!query) {
        return true;
    }
    return getSectionSearchHaystack(section).includes(query);
});

const renderAdvancedNav = () => {
    const container = $('#fv-advanced-nav');
    if (!container.length) {
        return;
    }
    if (settingsUiState.mode !== 'advanced') {
        container.hide().empty();
        return;
    }

    const advancedSections = settingsUiState.sections.filter((section) => section.advanced);
    if (!advancedSections.length) {
        container.hide().empty();
        return;
    }

    const groups = ADVANCED_GROUPS
        .map((group) => ({
            group,
            count: advancedSections.filter((section) => section.advancedGroup === group).length
        }))
        .filter((entry) => entry.count > 0);
    const tabsHtml = groups
        .map((entry, index) => {
            const active = settingsUiState.advancedTab === entry.group ? 'is-active' : '';
            const label = ADVANCED_GROUP_LABELS[entry.group] || entry.group;
            const countTitle = `${entry.count} section${entry.count === 1 ? '' : 's'} in ${label}`;
            const displayStep = index + 1;
            return `<button type="button" class="fv-advanced-tab ${active}" data-fv-advanced-tab="${entry.group}" data-fv-advanced-step="${displayStep}" title="${escapeHtml(countTitle)}">${escapeHtml(label)} <span class="fv-advanced-count">${displayStep}</span></button>`;
        })
        .join('');
    const activeTabSections = advancedSections.filter((section) => section.advancedGroup === settingsUiState.advancedTab);
    const allExpandedInTab = activeTabSections.length > 0
        && activeTabSections.every((section) => settingsUiState.expandedAdvancedSections.has(section.key));
    const compactLabel = allExpandedInTab ? 'Compact tab' : 'Expand tab';
    const compactIcon = allExpandedInTab ? 'fa-compress' : 'fa-expand';

    container.html(`
        <div class="fv-advanced-nav-inner">
            <div class="fv-advanced-controls">
                <div class="fv-advanced-tabs">${tabsHtml}</div>
                <button type="button" id="fv-advanced-compact" class="fv-advanced-compact" title="${escapeHtml(compactLabel)}" aria-label="${escapeHtml(compactLabel)}"><i class="fa ${compactIcon}" aria-hidden="true"></i></button>
            </div>
        </div>
    `).show();
};

const toggleAdvancedTabCompactState = () => {
    const tabSections = settingsUiState.sections.filter((section) => (
        section.advanced && section.advancedGroup === settingsUiState.advancedTab
    ));
    if (!tabSections.length) {
        return;
    }
    const shouldCompact = tabSections.every((section) => settingsUiState.expandedAdvancedSections.has(section.key));
    for (const section of tabSections) {
        if (shouldCompact) {
            settingsUiState.expandedAdvancedSections.delete(section.key);
        } else {
            settingsUiState.expandedAdvancedSections.add(section.key);
        }
    }
    persistExpandedAdvancedSections();
    applySettingsSectionVisibility();
    syncSectionJumpOptions();
    refreshSectionHealthBadges();
};

const toggleAdvancedSectionByKey = (sectionKey) => {
    const key = String(sectionKey || '').trim();
    if (!key) {
        return false;
    }
    const section = settingsUiState.sections.find((entry) => entry.key === key);
    if (!section || !section.advanced) {
        return false;
    }

    if (settingsUiState.expandedAdvancedSections.has(key)) {
        settingsUiState.expandedAdvancedSections.delete(key);
    } else {
        settingsUiState.expandedAdvancedSections.add(key);
        settingsUiState.activeSectionKey = key;
        persistActiveAdvancedSection(key);
        setAdvancedTab(section.advancedGroup);
    }
    persistExpandedAdvancedSections();
    applySettingsSectionVisibility();
    syncSectionJumpOptions();
    refreshSectionHealthBadges();
    return true;
};

const applySettingsSectionVisibility = () => {
    const visibleKeys = new Set(getVisibleSections().map((section) => section.key));
    if (!visibleKeys.size && settingsUiState.mode === 'basic' && !settingsUiState.query) {
        for (const section of getBasicWorkspaceSections()) {
            visibleKeys.add(section.key);
        }
    }
    const forceExpandForQuery = Boolean(settingsUiState.query);

    for (const section of settingsUiState.sections) {
        const visible = visibleKeys.has(section.key);
        const expanded = !section.advanced
            || settingsUiState.expandedAdvancedSections.has(section.key)
            || forceExpandForQuery;
        for (const node of section.nodes) {
            node.classList.toggle('fv-section-hidden', !visible);
        }
        for (const node of section.contentNodes || []) {
            node.classList.toggle('fv-section-content-hidden', visible && !expanded);
        }
        if (section.toggle) {
            const toggleLabel = expanded ? 'Compact section' : 'Expand section';
            section.toggle.title = toggleLabel;
            section.toggle.setAttribute('aria-label', `${toggleLabel}: ${section.title || section.key}`);
            section.toggle.classList.toggle('is-expanded', expanded);
            section.toggle.classList.toggle('is-collapsed', !expanded);
        }
        section.heading.classList.toggle('fv-search-match', visible && Boolean(settingsUiState.query));
        section.heading.classList.toggle('fv-section-collapsed', visible && section.advanced && !expanded);
    }

    renderAdvancedNav();
    const searchScopeToggle = $('#fv-search-all-advanced');
    if (searchScopeToggle.length) {
        const enabled = settingsUiState.mode === 'advanced';
        searchScopeToggle.prop('disabled', !enabled);
        searchScopeToggle.prop('checked', settingsUiState.searchAllAdvanced === true);
        searchScopeToggle.closest('.fv-search-scope').toggleClass('is-disabled', !enabled);
    }
    const modeButtons = $('.fv-mode-btn');
    modeButtons.removeClass('is-active');
    modeButtons.filter(`[data-mode="${settingsUiState.mode}"]`).addClass('is-active');
    $('#fv-settings-topbar').attr('data-fv-mode', settingsUiState.mode);
    refreshSectionApplyModeBadges();
};

const syncSectionJumpOptions = () => {
    const visibleSections = getVisibleSections();
    if (!visibleSections.length) {
        settingsUiState.activeSectionKey = '';
        persistActiveAdvancedSection('');
        return;
    }
    const keep = settingsUiState.activeSectionKey && visibleSections.some((section) => section.key === settingsUiState.activeSectionKey);
    if (!keep) {
        settingsUiState.activeSectionKey = visibleSections[0]?.key || '';
    }
    const activeSection = settingsUiState.sections.find((section) => section.key === settingsUiState.activeSectionKey);
    if (activeSection?.advanced) {
        setAdvancedTab(activeSection.advancedGroup);
    }
    persistActiveAdvancedSection(settingsUiState.activeSectionKey);

    const select = $('#fv-section-jump');
    if (!select.length) {
        return;
    }
    const options = visibleSections.map((section) => (
        `<option value="${escapeHtml(section.key)}">${escapeHtml(section.title)}</option>`
    ));
    select.html(options.join(''));
    if (settingsUiState.activeSectionKey) {
        select.val(settingsUiState.activeSectionKey);
    }
};

const scrollToSectionKey = (key) => {
    const section = settingsUiState.sections.find((entry) => entry.key === key);
    if (!section) {
        return;
    }
    settingsUiState.activeSectionKey = key;
    syncSectionJumpOptions();
    section.heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const setSettingsMode = (mode, { persistServer = false } = {}) => {
    const previousMode = settingsUiState.mode === 'advanced' ? 'advanced' : 'basic';
    settingsUiState.mode = mode === 'advanced' ? 'advanced' : 'basic';
    recordFatalBannerAction(`Switch Settings mode to ${settingsUiState.mode}`);
    writeSettingsStorage(UI_MODE_STORAGE_KEY, settingsUiState.mode, { delayMs: 60, idle: true });
    if (settingsUiState.mode === 'advanced') {
        const activeSection = settingsUiState.sections.find((section) => section.key === settingsUiState.activeSectionKey);
        if (activeSection?.advanced) {
            setAdvancedTab(activeSection.advancedGroup);
        }
        settingsUiState.query = readActiveAdvancedSearchQuery();
        const searchInput = $('#fv-settings-search');
        if (searchInput.length) {
            searchInput.val(settingsUiState.query);
        }
        void ensureAdvancedDataLoaded();
    }
    persistTableUiState();
    applySettingsSectionVisibility();
    syncSectionJumpOptions();
    refreshSectionHealthBadges();
    if (persistServer === true && previousMode !== settingsUiState.mode) {
        void persistSetupPrefsToServer({ mode: settingsUiState.mode });
    }
};

const getServerSettingsMode = () => {
    const dockerMode = prefsByType?.docker?.settingsMode;
    const vmMode = prefsByType?.vm?.settingsMode;
    if (dockerMode === 'advanced' || dockerMode === 'basic') {
        return dockerMode;
    }
    if (vmMode === 'advanced' || vmMode === 'basic') {
        return vmMode;
    }
    return null;
};

const isWizardCompletedServerSide = () => (
    prefsByType?.docker?.setupWizardCompleted === true
    || prefsByType?.vm?.setupWizardCompleted === true
);

const hasExistingPluginData = () => {
    const dockerFolders = Object.keys(dockers || {}).length;
    const vmFolders = Object.keys(vms || {}).length;
    if (dockerFolders > 0 || vmFolders > 0) {
        return true;
    }
    const hasRules = ((prefsByType?.docker?.autoRules || []).length + (prefsByType?.vm?.autoRules || []).length) > 0;
    const hasPinned = ((prefsByType?.docker?.pinnedFolderIds || []).length + (prefsByType?.vm?.pinnedFolderIds || []).length) > 0;
    return hasRules || hasPinned;
};

const persistSetupPrefsToServer = async ({ mode = null, completed = null } = {}) => {
    const nextMode = mode === 'advanced' ? 'advanced' : 'basic';
    const completedValue = completed === true;
    for (const type of ['docker', 'vm']) {
        const current = utils.normalizePrefs(prefsByType[type] || {});
        const next = {
            ...current,
            settingsMode: mode === null ? current.settingsMode : nextMode,
            setupWizardCompleted: completed === null ? current.setupWizardCompleted : completedValue
        };
        const unchanged = (
            current.settingsMode === next.settingsMode
            && current.setupWizardCompleted === next.setupWizardCompleted
        );
        if (unchanged) {
            continue;
        }
        try {
            prefsByType[type] = await postPrefs(type, next);
        } catch (_error) {
            // Keep UX responsive even if this persistence call fails.
        }
    }
};

const setSettingsSearchQuery = (query) => {
    settingsUiState.query = normalizedFilter(query);
    if (settingsUiState.mode === 'advanced') {
        writeActiveAdvancedSearchQuery(settingsUiState.query);
    }
    persistTableUiState();
    applySettingsSectionVisibility();
    syncSectionJumpOptions();
    refreshSectionHealthBadges();
};

const setSearchAllAdvanced = (enabled) => {
    settingsUiState.searchAllAdvanced = enabled === true;
    writeSettingsStorage(SEARCH_ALL_ADVANCED_STORAGE_KEY, settingsUiState.searchAllAdvanced ? '1' : '0', { delayMs: 60, idle: true });
    persistTableUiState();
    if (settingsUiState.mode === 'advanced') {
        void ensureAdvancedDataLoaded();
    }
    applySettingsSectionVisibility();
    syncSectionJumpOptions();
    refreshSectionHealthBadges();
};

const refreshSectionHealthBadges = () => {
    for (const section of settingsUiState.sections) {
        const inputs = [];
        for (const node of section.nodes) {
            if (!(node instanceof HTMLElement)) {
                continue;
            }
            inputs.push(...Array.from(node.querySelectorAll('input[id], select[id], textarea[id]')));
        }

        const uniqueInputs = Array
            .from(new Map(inputs.map((input) => [input.id, input])).values())
            .filter((input) => shouldTrackSettingsInput(input, section));
        let changedCount = 0;
        let invalidCount = 0;

        for (const input of uniqueInputs) {
            if (settingsUiState.baselineByInputId.has(input.id)) {
                if (settingsUiState.baselineByInputId.get(input.id) !== getInputSerializedValue(input)) {
                    changedCount += 1;
                }
            }
            if (isInputInvalidForUi(input)) {
                invalidCount += 1;
            }
        }

        const badge = section.badge;
        badge.classList.remove('is-ok', 'is-changed', 'is-invalid');
        if (invalidCount > 0) {
            badge.classList.add('is-invalid');
            badge.textContent = `${invalidCount} invalid`;
        } else if (changedCount > 0) {
            badge.classList.add('is-changed');
            badge.textContent = `${changedCount} changed`;
        } else {
            badge.classList.add('is-ok');
            badge.textContent = 'all good';
        }
    }
};

const ensureRegexPresetUi = (type) => {
    const patternInput = $(`#${type}-rule-pattern`);
    if (!patternInput.length) {
        return;
    }
    const presetId = `${type}-rule-presets`;
    const hintId = `${type}-rule-live-match`;
    if (!$(`#${presetId}`).length) {
        patternInput.after(`
            <div id="${presetId}" class="rule-presets">
                <span>Regex presets:</span>
                <button type="button" data-type="${type}" data-preset="starts_with">Starts with</button>
                <button type="button" data-type="${type}" data-preset="contains">Contains</button>
                <button type="button" data-type="${type}" data-preset="ends_with">Ends with</button>
                <button type="button" data-type="${type}" data-preset="exact">Exact</button>
            </div>
        `);
    }
    if (!$(`#${hintId}`).length) {
        $(`#${presetId}`).after(`<div id="${hintId}" class="rule-live-match">Live matches: 0</div>`);
    }
};

const escapeRegexLiteral = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const applyRegexPreset = (type, preset) => {
    const input = $(`#${type}-rule-pattern`);
    if (!input.length) {
        return;
    }
    const plainText = window.prompt('Enter plain text for this preset:');
    if (plainText === null) {
        return;
    }
    const escaped = escapeRegexLiteral(plainText);
    let pattern = escaped;
    if (preset === 'starts_with') {
        pattern = `^${escaped}`;
    } else if (preset === 'contains') {
        pattern = escaped;
    } else if (preset === 'ends_with') {
        pattern = `${escaped}$`;
    } else if (preset === 'exact') {
        pattern = `^${escaped}$`;
    }

    if (type === 'docker' && String($('#docker-rule-kind').val() || '') !== 'name_regex') {
        $('#docker-rule-kind').val('name_regex');
        toggleRuleKindFields('docker');
    }
    input.val(pattern);
    input.trigger('input');
    input.trigger('change');
};

const getDockerItemLabels = (itemInfo) => itemInfo?.Labels || itemInfo?.info?.Config?.Labels || {};

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

const getComposeProjectLabelValue = (labels) => {
    if (utils && typeof utils.getComposeProjectFromLabels === 'function') {
        return String(utils.getComposeProjectFromLabels(labels) || '');
    }
    const source = labels && typeof labels === 'object' ? labels : {};
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

const updateRuleLiveMatch = (type) => {
    const output = $(`#${type}-rule-live-match`);
    if (!output.length) {
        return;
    }
    const names = Object.keys(infoByType[type] || {});
    if (!names.length) {
        output.removeClass('is-invalid is-ok').text('Live matches: no items available.');
        return;
    }

    if (type === 'vm') {
        const pattern = String($('#vm-rule-pattern').val() || '').trim();
        if (!pattern) {
            output.removeClass('is-invalid is-ok').text('Live matches: enter a regex pattern.');
            return;
        }
        try {
            const regex = new RegExp(pattern);
            const count = names.filter((name) => regex.test(name)).length;
            output.removeClass('is-invalid').addClass('is-ok').text(`Live matches: ${count}/${names.length} VMs`);
        } catch (error) {
            output.removeClass('is-ok').addClass('is-invalid').text(`Invalid regex: ${error.message}`);
        }
        return;
    }

    const kind = String($('#docker-rule-kind').val() || 'name_regex');
    const pattern = String($('#docker-rule-pattern').val() || '').trim();
    const labelKey = String($('#docker-rule-label-key').val() || '').trim();
    const labelValue = String($('#docker-rule-label-value').val() || '').trim();
    const info = infoByType.docker || {};

    let count = 0;
    try {
        if (kind === 'name_regex' || kind === 'image_regex' || kind === 'compose_project_regex') {
            if (!pattern) {
                output.removeClass('is-invalid is-ok').text('Live matches: enter a regex pattern.');
                return;
            }
            const regex = new RegExp(pattern);
            for (const name of names) {
                const row = info[name] || {};
                const labels = getDockerItemLabels(row);
                const image = row?.info?.Config?.Image || '';
                const composeProject = getComposeProjectLabelValue(labels);
                const value = kind === 'image_regex' ? image : (kind === 'compose_project_regex' ? composeProject : name);
                regex.lastIndex = 0;
                if (regex.test(String(value || ''))) {
                    count += 1;
                }
            }
        } else if (kind === 'label' || kind === 'label_contains' || kind === 'label_starts_with') {
            if (!labelKey) {
                output.removeClass('is-invalid is-ok').text('Live matches: enter a label key.');
                return;
            }
            for (const name of names) {
                const row = info[name] || {};
                const labels = getDockerItemLabels(row);
                const value = String(labels[labelKey] || '');
                if (kind === 'label' && (labelValue ? value === labelValue : Boolean(value))) {
                    count += 1;
                }
                if (kind === 'label_contains' && labelValue && value.includes(labelValue)) {
                    count += 1;
                }
                if (kind === 'label_starts_with' && labelValue && value.startsWith(labelValue)) {
                    count += 1;
                }
            }
        }
        output.removeClass('is-invalid').addClass('is-ok').text(`Live matches: ${count}/${names.length} containers`);
    } catch (error) {
        output.removeClass('is-ok').addClass('is-invalid').text(`Invalid regex: ${error.message}`);
    }
};

const runQuickSetupWizard = (force = false) => {
    openSetupAssistant(force === true);
};

const initSettingsControls = () => {
    if (settingsUiState.controlsInitialized) {
        return;
    }
    const controls = $('#fv-settings-topbar');
    if (!controls.length) {
        return;
    }

    const topbarHtml = settingsChrome && typeof settingsChrome.getTopbarHtml === 'function'
        ? settingsChrome.getTopbarHtml()
        : `
            <div class="fv-settings-inline">
                <div class="fv-settings-left" aria-label="Plugin settings title">
                    <h2 class="fv-settings-title">FolderView Plus</h2>
                    <span class="fv-settings-subtitle">Plugin settings</span>
                </div>
                <div class="fv-settings-right">
                    <div class="fv-settings-search-block">
                        <div class="fv-settings-search-wrap">
                            <input type="text" id="fv-settings-search" placeholder="Search settings" aria-label="Search settings">
                        </div>
                        <label class="fv-search-scope" title="Limit search to currently selected advanced tab">
                            <input type="checkbox" id="fv-search-all-advanced">
                            Search all advanced
                        </label>
                    </div>
                    <span class="fv-mode-toggle" title="Settings mode">
                        <button type="button" class="fv-mode-btn" data-mode="basic" aria-label="Use basic settings mode">Basic</button>
                        <button type="button" class="fv-mode-btn" data-mode="advanced" aria-label="Use advanced settings mode">Advanced</button>
                    </span>
                    <button type="button" id="fv-run-wizard" title="Run setup assistant"><i class="fa fa-magic"></i> Wizard</button>
                </div>
            </div>
        `;
    controls.html(topbarHtml);

    if (!$('#fv-advanced-nav').length) {
        $('.fv-customizations-header').after('<div id="fv-advanced-nav" class="fv-advanced-nav" style="display:none"></div>');
    }

    $('.fv-mode-btn').off('click.fvui').on('click.fvui', (event) => {
        const mode = String($(event.currentTarget).attr('data-mode') || 'basic');
        setSettingsMode(mode, { persistServer: true });
    });
    $('#fv-settings-search').off('input.fvui').on('input.fvui', (event) => {
        setSettingsSearchQuery($(event.currentTarget).val());
    });
    $('#fv-search-all-advanced').off('change.fvui').on('change.fvui', (event) => {
        setSearchAllAdvanced($(event.currentTarget).prop('checked') === true);
    });
    $('#fv-run-wizard').off('click.fvui').on('click.fvui', () => {
        runQuickSetupWizard(true);
    });
    $(document).off('click.fvemptyactions', '[data-fv-empty-action]').on('click.fvemptyactions', '[data-fv-empty-action]', async (event) => {
        event.preventDefault();
        const action = String($(event.currentTarget).attr('data-fv-empty-action') || '').trim().toLowerCase();
        const type = String($(event.currentTarget).attr('data-fv-type') || '').trim().toLowerCase();
        if (action === 'create') {
            await quickCreateStarterFolder(type === 'vm' ? 'vm' : 'docker');
            return;
        }
        if (action === 'templates') {
            await quickCreateStarterTemplates(type === 'vm' ? 'vm' : 'docker');
            return;
        }
        if (action === 'import') {
            if (type === 'vm') {
                importVm();
                return;
            }
            importDocker();
            return;
        }
        if (action === 'wizard') {
            runQuickSetupWizard(true);
        }
    });

    $(document).off('input.fvhealth change.fvhealth', 'input,select,textarea').on('input.fvhealth change.fvhealth', 'input,select,textarea', () => {
        refreshInputInvalidStyles();
        refreshSectionHealthBadges();
    });

    $(document).off('click.fvpreset', '.rule-presets button').on('click.fvpreset', '.rule-presets button', (event) => {
        const type = String($(event.currentTarget).attr('data-type') || '');
        const preset = String($(event.currentTarget).attr('data-preset') || '');
        applyRegexPreset(type, preset);
    });

    $(document).off('click.fvhealthfilter', '[data-fv-health-filter]').on('click.fvhealthfilter', '[data-fv-health-filter]', (event) => {
        const type = String($(event.currentTarget).attr('data-fv-health-type') || 'docker');
        const mode = String($(event.currentTarget).attr('data-fv-health-filter') || 'all');
        setHealthFolderFilter(type, mode);
    });

    $(document).off('click.fvhealthaction', '[data-fv-health-action]').on('click.fvhealthaction', '[data-fv-health-action]', (event) => {
        const type = String($(event.currentTarget).attr('data-fv-health-type') || 'docker');
        const action = String($(event.currentTarget).attr('data-fv-health-action') || '');
        if (action === 'jump-table') {
            const mode = String($(event.currentTarget).attr('data-fv-health-mode') || 'all');
            setHealthFolderFilter(type, mode);
            setSettingsMode('basic', { persistServer: true });
            scrollToSectionKey(type === 'vm' ? 'vms' : 'docker');
            return;
        }
        if (action === 'scan-conflicts') {
            setSettingsMode('advanced', { persistServer: true });
            setAdvancedTab('automation');
            scrollToSectionKey('conflict-inspector');
            void runConflictInspector(type);
            return;
        }
    });

    $(document).off('click.fvtab', '.fv-advanced-tab').on('click.fvtab', '.fv-advanced-tab', (event) => {
        const tab = String($(event.currentTarget).attr('data-fv-advanced-tab') || '');
        setAdvancedTab(tab);
        applySettingsSectionVisibility();
        syncSectionJumpOptions();
        refreshSectionHealthBadges();
    });
    $(document).off('click.fvadvretry', '[data-fv-advanced-module-retry]').on('click.fvadvretry', '[data-fv-advanced-module-retry]', (event) => {
        event.preventDefault();
        const moduleKey = String($(event.currentTarget).attr('data-fv-advanced-module-retry') || '').trim().toLowerCase();
        if (!ADVANCED_MODULE_KEYS.includes(moduleKey)) {
            return;
        }
        void ensureAdvancedDataLoaded({
            force: true,
            modules: [moduleKey],
            quiet: false
        });
    });
    $(document).off('click.fvcompact', '#fv-advanced-compact').on('click.fvcompact', '#fv-advanced-compact', (event) => {
        event.preventDefault();
        toggleAdvancedTabCompactState();
    });

    $(document).off('click.fvsectiontoggle', '.fv-section-toggle').on('click.fvsectiontoggle', '.fv-section-toggle', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const key = String($(event.currentTarget).attr('data-section-toggle') || '').trim();
        toggleAdvancedSectionByKey(key);
    });

    $(document).off('click.fvsectionheader', 'h2[data-fv-section][data-fv-advanced="1"]').on('click.fvsectionheader', 'h2[data-fv-section][data-fv-advanced="1"]', (event) => {
        if (!shouldUseMobileSectionToggle()) {
            return;
        }
        const target = event.target instanceof Element ? event.target : null;
        if (target && target.closest('.fv-section-toggle, button, a, input, select, textarea, label')) {
            return;
        }
        const key = String($(event.currentTarget).attr('data-fv-section') || '').trim();
        toggleAdvancedSectionByKey(key);
    });

    $('#docker-rule-kind, #docker-rule-pattern, #docker-rule-label-key, #docker-rule-label-value')
        .off('input.fvlivematch change.fvlivematch')
        .on('input.fvlivematch change.fvlivematch', () => updateRuleLiveMatch('docker'));
    $('#vm-rule-pattern')
        .off('input.fvlivematch change.fvlivematch')
        .on('input.fvlivematch change.fvlivematch', () => updateRuleLiveMatch('vm'));
    $('#docker-rule-test-name, #docker-rule-test-label-key, #docker-rule-test-label-value, #docker-rule-test-image, #docker-rule-test-compose')
        .off('input.fvrulehint change.fvrulehint')
        .on('input.fvrulehint change.fvrulehint', () => updateRuleValidationHint('docker'));
    $('#vm-rule-test-name')
        .off('input.fvrulehint change.fvrulehint')
        .on('input.fvrulehint change.fvrulehint', () => updateRuleValidationHint('vm'));
    $('#docker-template-name')
        .off('input.fvtemplatehint change.fvtemplatehint')
        .on('input.fvtemplatehint change.fvtemplatehint', () => {
            validateTemplateNameInput('docker', false);
        });
    $('#vm-template-name')
        .off('input.fvtemplatehint change.fvtemplatehint')
        .on('input.fvtemplatehint change.fvtemplatehint', () => {
            validateTemplateNameInput('vm', false);
        });
    $(document)
        .off('change.fvbulkitems', '.bulk-item-checkbox[data-fv-bulk-type]')
        .on('change.fvbulkitems', '.bulk-item-checkbox[data-fv-bulk-type]', (event) => {
            const target = event.currentTarget;
            const type = String(target?.getAttribute('data-fv-bulk-type') || '').trim().toLowerCase();
            const safeType = type === 'vm' ? 'vm' : 'docker';
            const checked = target instanceof HTMLInputElement ? target.checked : false;
            setBulkItemChecked(safeType, target?.value || '', checked);
        });
    $(document)
        .off('change.fvbulktarget', '#docker-bulk-folder, #vm-bulk-folder')
        .on('change.fvbulktarget', '#docker-bulk-folder, #vm-bulk-folder', (event) => {
            const target = event.currentTarget;
            const id = String(target?.id || '').trim().toLowerCase();
            const type = id.startsWith('vm-') ? 'vm' : 'docker';
            clearBulkExecutionState(type);
            renderBulkResultPanel(type, null);
            updateBulkResultActions(type);
            updateBulkPreviewPanel(type);
        });
    $(document)
        .off('change.fvrecoverycompare', '#recovery-backup-compare-left, #recovery-backup-compare-right, #recovery-backup-compare-include-prefs')
        .on('change.fvrecoverycompare', '#recovery-backup-compare-left, #recovery-backup-compare-right, #recovery-backup-compare-include-prefs', () => {
            syncHiddenRecoveryCompareControls(getActiveRecoveryWorkspaceType());
        });

    $('#fv-settings-search').val(settingsUiState.query || '');
    $('#fv-search-all-advanced').prop('checked', settingsUiState.searchAllAdvanced === true);
    syncRecoveryWorkspaceUi();
    syncRulesWorkspaceUi();
    updateRuleValidationHint('docker');
    updateRuleValidationHint('vm');
    validateTemplateNameInput('docker', false);
    validateTemplateNameInput('vm', false);
    ADVANCED_MODULE_KEYS.forEach((moduleKey) => {
        renderAdvancedModuleStatus(moduleKey);
    });

    settingsUiState.controlsInitialized = true;
};

const refreshSettingsUx = () => {
    syncCompactMobileLayoutClass();
    refreshMobileTreeReorderModeClasses();
    buildSettingsSections();
    normalizeExpandedAdvancedSections();
    const advancedSections = settingsUiState.sections.filter((section) => section.advanced);
    if (advancedSections.length) {
        const hasCurrentTab = advancedSections.some((section) => section.advancedGroup === settingsUiState.advancedTab);
        if (!hasCurrentTab) {
            setAdvancedTab(advancedSections[0].advancedGroup);
        }
        if (settingsUiState.activeSectionKey) {
            const activeSection = settingsUiState.sections.find((section) => section.key === settingsUiState.activeSectionKey);
            if (activeSection?.advanced) {
                setAdvancedTab(activeSection.advancedGroup);
            }
        }
    }
    applySettingsSectionVisibility();
    syncSectionJumpOptions();
    refreshInputInvalidStyles();
    refreshSectionHealthBadges();
    syncRecoveryWorkspaceUi();
    syncRulesWorkspaceUi();
    ADVANCED_MODULE_KEYS.forEach((moduleKey) => {
        renderAdvancedModuleStatus(moduleKey);
    });
};

const toPrettyJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
const normalizeImportMode = (value) => {
    const mode = String(value || '').trim().toLowerCase();
    if (mode === 'replace' || mode === 'skip') {
        return mode;
    }
    return 'merge';
};

const getImportPreviewFirstPreference = () => {
    try {
        const value = String(localStorage.getItem(IMPORT_PREVIEW_FIRST_STORAGE_KEY) || '').trim();
        if (value === '') {
            return true;
        }
        return value !== '0';
    } catch (_error) {
        return true;
    }
};

const setImportPreviewFirstPreference = (enabled) => {
    try {
        writeSettingsStorage(IMPORT_PREVIEW_FIRST_STORAGE_KEY, enabled === true ? '1' : '0', { delayMs: 60, idle: true });
    } catch (_error) {
        // Non-fatal in restricted browser contexts.
    }
};

const normalizeImportPresetDefinition = (value, fallbackId = '') => {
    const source = value && typeof value === 'object' ? value : {};
    const id = String(source.id || fallbackId || '').trim();
    if (!id) {
        return null;
    }
    const name = String(source.name || '').trim().slice(0, 64);
    if (!name) {
        return null;
    }
    return {
        id,
        name,
        mode: normalizeImportMode(source.mode),
        dryRunOnly: source.dryRunOnly === true
    };
};

const normalizeImportPresetStoreType = (entry) => {
    const normalizedPrefs = utils.normalizePrefs({
        importPresets: entry && typeof entry === 'object' ? entry : {}
    });
    const source = normalizedPrefs.importPresets && typeof normalizedPrefs.importPresets === 'object'
        ? normalizedPrefs.importPresets
        : { defaultId: IMPORT_PRESET_DEFAULT_ID, custom: [] };
    return {
        defaultId: String(source.defaultId || IMPORT_PRESET_DEFAULT_ID),
        custom: Array.isArray(source.custom) ? source.custom.map((row) => ({ ...row })) : []
    };
};

const getImportPresetStoreTypeFromPrefs = (type, prefsOverride = null) => {
    const resolvedType = normalizeManagedType(type);
    const sourcePrefs = prefsOverride ? utils.normalizePrefs(prefsOverride) : utils.normalizePrefs(prefsByType[resolvedType]);
    return normalizeImportPresetStoreType(sourcePrefs.importPresets || {});
};

const persistImportPresetStoreTypeToServer = async (type, nextStore) => {
    const resolvedType = normalizeManagedType(type);
    const currentPrefs = utils.normalizePrefs(prefsByType[resolvedType]);
    const nextPrefs = utils.normalizePrefs({
        ...currentPrefs,
        importPresets: normalizeImportPresetStoreType(nextStore)
    });
    prefsByType[resolvedType] = await postPrefs(resolvedType, nextPrefs);
    return getImportPresetStoreTypeFromPrefs(resolvedType, prefsByType[resolvedType]);
};

const getImportPresetsForType = (type) => {
    const resolvedType = normalizeManagedType(type);
    const store = getImportPresetStoreTypeFromPrefs(resolvedType);
    const custom = Array.isArray(store?.custom) ? store.custom : [];
    return [
        ...IMPORT_PRESET_BUILTINS.map((preset) => ({ ...preset })),
        ...custom.map((preset) => ({ ...preset }))
    ];
};

const findImportPresetById = (type, presetId) => {
    const id = String(presetId || '').trim();
    if (!id) {
        return null;
    }
    return getImportPresetsForType(type).find((preset) => preset.id === id) || null;
};

const findImportPresetByModeAndDryRun = (type, mode, dryRunOnly) => {
    const normalizedMode = normalizeImportMode(mode);
    const normalizedDryRun = dryRunOnly === true;
    return getImportPresetsForType(type).find((preset) => (
        normalizeImportMode(preset.mode) === normalizedMode
        && (preset.dryRunOnly === true) === normalizedDryRun
    )) || null;
};

const getDefaultImportPresetIdForType = (type) => {
    const resolvedType = normalizeManagedType(type);
    const store = getImportPresetStoreTypeFromPrefs(resolvedType);
    const defaultId = String(store?.defaultId || IMPORT_PRESET_DEFAULT_ID).trim();
    return defaultId || IMPORT_PRESET_DEFAULT_ID;
};

const getDefaultImportPresetForType = (type) => {
    const preferredId = getDefaultImportPresetIdForType(type);
    return (
        findImportPresetById(type, preferredId)
        || findImportPresetById(type, IMPORT_PRESET_DEFAULT_ID)
        || getImportPresetsForType(type)[0]
        || null
    );
};

const saveCustomImportPresetForType = async (type, preset) => {
    const resolvedType = normalizeManagedType(type);
    const source = preset && typeof preset === 'object' ? preset : {};
    const generatedId = `custom:${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const normalized = normalizeImportPresetDefinition(source, generatedId);
    if (!normalized) {
        throw new Error('Invalid preset.');
    }
    if (normalized.id.startsWith('builtin:')) {
        throw new Error('Built-in preset IDs are reserved.');
    }

    const store = getImportPresetStoreTypeFromPrefs(resolvedType);
    const current = Array.isArray(store?.custom) ? store.custom : [];
    const next = [normalized, ...current.filter((row) => row.id !== normalized.id)].slice(0, 30);
    await persistImportPresetStoreTypeToServer(resolvedType, {
        custom: next,
        defaultId: store?.defaultId || IMPORT_PRESET_DEFAULT_ID
    });
    return normalized;
};

const deleteCustomImportPresetForType = async (type, presetId) => {
    const resolvedType = normalizeManagedType(type);
    const id = String(presetId || '').trim();
    if (!id || id.startsWith('builtin:')) {
        return false;
    }
    const store = getImportPresetStoreTypeFromPrefs(resolvedType);
    const current = Array.isArray(store?.custom) ? store.custom : [];
    const next = current.filter((row) => row.id !== id);
    if (next.length === current.length) {
        return false;
    }
    const defaultId = String(store?.defaultId || IMPORT_PRESET_DEFAULT_ID).trim();
    await persistImportPresetStoreTypeToServer(resolvedType, {
        custom: next,
        defaultId: defaultId === id ? IMPORT_PRESET_DEFAULT_ID : defaultId
    });
    return true;
};

const setDefaultImportPresetIdForType = async (type, presetId) => {
    const resolvedType = normalizeManagedType(type);
    const id = String(presetId || '').trim();
    if (!id || !findImportPresetById(resolvedType, id)) {
        throw new Error('Preset not found.');
    }
    const store = getImportPresetStoreTypeFromPrefs(resolvedType);
    await persistImportPresetStoreTypeToServer(resolvedType, {
        custom: store.custom,
        defaultId: id
    });
};

const formatImportPresetLabel = (preset) => {
    const mode = normalizeImportMode(preset?.mode);
    const modeLabel = mode === 'replace' ? 'Replace' : mode === 'skip' ? 'Skip existing' : 'Merge';
    const dryRunSuffix = preset?.dryRunOnly === true ? ', dry run' : '';
    return `${String(preset?.name || 'Preset')} (${modeLabel}${dryRunSuffix})`;
};

const setTypeFolders = (type, value) => {
    if (type === 'docker') {
        dockers = value;
        return;
    }
    vms = value;
};

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getFolderMap = (type) => utils.normalizeFolderMap(typeFolders(type));

const folderNameForId = (type, id) => {
    const folders = getFolderMap(type);
    return folders[id]?.name || id;
};

const getBulkState = (type) => {
    const resolvedType = normalizeManagedType(type);
    if (!bulkAssignStateByType[resolvedType] || typeof bulkAssignStateByType[resolvedType] !== 'object') {
        bulkAssignStateByType[resolvedType] = createBulkAssignUiState();
    }
    return bulkAssignStateByType[resolvedType];
};

const sanitizeBulkItemName = (value) => String(value || '').trim();

const isValidBulkItemName = (name) => {
    if (!name) {
        return false;
    }
    if (name.length > 255) {
        return false;
    }
    return !/[\x00-\x1F\x7F]/u.test(name);
};

const buildFolderPathLabel = (type, folderId, foldersInput = null, hierarchyMeta = null) => {
    const resolvedType = normalizeManagedType(type);
    const folders = utils.normalizeFolderMap(foldersInput || getFolderMap(resolvedType));
    const safeId = String(folderId || '').trim();
    if (!safeId || !Object.prototype.hasOwnProperty.call(folders, safeId)) {
        return safeId;
    }
    const meta = hierarchyMeta || buildFolderHierarchyMeta(folders);
    const parts = [];
    const seen = new Set();
    let cursor = safeId;
    while (cursor && !seen.has(cursor)) {
        seen.add(cursor);
        parts.unshift(String(folders[cursor]?.name || cursor));
        cursor = String(meta.parentById?.[cursor] || '').trim();
    }
    return parts.join(' / ');
};

const isFolderPinned = (type, folderId) => {
    const pinned = Array.isArray(prefsByType[type]?.pinnedFolderIds) ? prefsByType[type].pinnedFolderIds : [];
    return pinned.includes(String(folderId || ''));
};

const normalizeHealthFilterMode = (value) => {
    const mode = String(value || 'all').trim().toLowerCase();
    return ['all', 'attention', 'empty', 'stopped', 'conflict'].includes(mode) ? mode : 'all';
};

const normalizeHealthPrefs = (type, prefsOverride = null) => {
    const source = prefsOverride ? utils.normalizePrefs(prefsOverride) : utils.normalizePrefs(prefsByType[type]);
    const incoming = source?.health && typeof source.health === 'object' ? source.health : {};
    const warnRaw = Number(incoming.warnStoppedPercent);
    const warnStoppedPercent = Number.isFinite(warnRaw) ? Math.min(100, Math.max(0, Math.round(warnRaw))) : 60;
    const criticalRaw = Number(incoming.criticalStoppedPercent);
    const criticalStoppedPercent = Number.isFinite(criticalRaw) ? Math.min(100, Math.max(0, Math.round(criticalRaw))) : 90;
    const profileRaw = String(incoming.profile || '').trim().toLowerCase();
    const profile = ['strict', 'balanced', 'lenient'].includes(profileRaw) ? profileRaw : 'balanced';
    const updatesModeRaw = String(incoming.updatesMode || '').trim().toLowerCase();
    const updatesMode = ['maintenance', 'warn', 'ignore'].includes(updatesModeRaw) ? updatesModeRaw : 'maintenance';
    const allStoppedModeRaw = String(incoming.allStoppedMode || '').trim().toLowerCase();
    const allStoppedMode = ['critical', 'warn'].includes(allStoppedModeRaw) ? allStoppedModeRaw : 'critical';
    const warnVcpusRaw = Number(incoming.vmResourceWarnVcpus);
    const warnVcpus = Number.isFinite(warnVcpusRaw) ? Math.min(512, Math.max(1, Math.round(warnVcpusRaw))) : 16;
    const criticalVcpusRaw = Number(incoming.vmResourceCriticalVcpus);
    let criticalVcpus = Number.isFinite(criticalVcpusRaw) ? Math.min(512, Math.max(1, Math.round(criticalVcpusRaw))) : 32;
    if (criticalVcpus <= warnVcpus) {
        criticalVcpus = Math.min(512, warnVcpus + 1);
    }
    const warnGiBRaw = Number(incoming.vmResourceWarnGiB);
    const warnGiB = Number.isFinite(warnGiBRaw) ? Math.min(1024, Math.max(1, Math.round(warnGiBRaw))) : 32;
    const criticalGiBRaw = Number(incoming.vmResourceCriticalGiB);
    let criticalGiB = Number.isFinite(criticalGiBRaw) ? Math.min(1024, Math.max(1, Math.round(criticalGiBRaw))) : 64;
    if (criticalGiB <= warnGiB) {
        criticalGiB = Math.min(1024, warnGiB + 1);
    }
    return {
        cardsEnabled: incoming.cardsEnabled !== false,
        runtimeBadgeEnabled: incoming.runtimeBadgeEnabled === true,
        compact: incoming.compact === true,
        warnStoppedPercent,
        criticalStoppedPercent,
        profile,
        updatesMode,
        allStoppedMode,
        vmResourceWarnVcpus: warnVcpus,
        vmResourceCriticalVcpus: criticalVcpus,
        vmResourceWarnGiB: warnGiB,
        vmResourceCriticalGiB: criticalGiB
    };
};

const normalizeStatusMode = (value) => (
    String(value || '').trim().toLowerCase() === 'dominant' ? 'dominant' : 'summary'
);

const normalizeStatusDisplayMode = (value) => {
    const mode = String(value || '').trim().toLowerCase();
    return ['simple', 'balanced', 'detailed'].includes(mode) ? mode : 'balanced';
};

const normalizeStatusPrefs = (type, prefsOverride = null) => {
    const source = prefsOverride ? utils.normalizePrefs(prefsOverride) : utils.normalizePrefs(prefsByType[type]);
    const incoming = source?.status && typeof source.status === 'object' ? source.status : {};
    const warnRaw = Number(incoming.warnStoppedPercent);
    const warnStoppedPercent = Number.isFinite(warnRaw) ? Math.min(100, Math.max(0, Math.round(warnRaw))) : 60;
    return {
        mode: normalizeStatusMode(incoming.mode),
        displayMode: normalizeStatusDisplayMode(incoming.displayMode),
        trendEnabled: incoming.trendEnabled !== false,
        attentionAccent: incoming.attentionAccent !== false,
        warnStoppedPercent
    };
};

// Setup assistant logic is loaded from folderviewplus.wizard.js.

const normalizeStatusFilterMode = (value) => {
    const mode = String(value || 'all').trim().toLowerCase();
    return ['all', 'started', 'paused', 'stopped', 'mixed', 'empty'].includes(mode) ? mode : 'all';
};

const normalizeQuickFolderFilterMode = (value, type = 'docker') => {
    const mode = String(value || 'all').trim().toLowerCase();
    const allowed = type === 'docker'
        ? ['all', 'pinned', 'stopped', 'empty', 'no-rules', 'has-updates']
        : ['all', 'pinned', 'stopped', 'empty', 'no-rules'];
    return allowed.includes(mode) ? mode : 'all';
};

const setQuickFolderFilter = (type = 'docker', mode = 'all') => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const normalizedMode = normalizeQuickFolderFilterMode(mode, resolvedType);
    const current = normalizeQuickFolderFilterMode(quickFolderFilterByType[resolvedType], resolvedType);
    quickFolderFilterByType[resolvedType] = current === normalizedMode ? 'all' : normalizedMode;
    persistTableUiState();
    renderQuickFolderFilters(resolvedType);
    renderTable(resolvedType);
};

const getStatusFilterLabel = (mode) => {
    if (mode === 'started') {
        return 'started folders';
    }
    if (mode === 'paused') {
        return 'paused folders';
    }
    if (mode === 'stopped') {
        return 'stopped folders';
    }
    if (mode === 'mixed') {
        return 'mixed folders';
    }
    if (mode === 'empty') {
        return 'empty folders';
    }
    return 'all folders';
};

const getItemRuntimeStateKind = (type, itemInfo) => {
    const source = itemInfo && typeof itemInfo === 'object' ? itemInfo : {};
    if (type === 'vm') {
        const raw = String(source.state || source.State || '').toLowerCase();
        if (raw === 'running') {
            return 'started';
        }
        if (raw === 'paused' || raw === 'unknown' || raw === 'pmsuspended') {
            return 'paused';
        }
        return 'stopped';
    }
    const nested = source?.info?.State || source?.State || {};
    const running = Boolean(nested?.Running ?? source?.state ?? source?.running);
    const paused = Boolean(nested?.Paused ?? source?.pause ?? source?.paused);
    if (running && paused) {
        return 'paused';
    }
    if (running) {
        return 'started';
    }
    return 'stopped';
};

const valueIsTruthy = (value) => {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) && value !== 0;
    }
    const text = String(value || '').trim().toLowerCase();
    return text === 'true' || text === '1' || text === 'yes' || text === 'on' || text === 'enabled';
};

const deriveFolderStatusKey = (countsByState, totalMembers) => {
    const total = Number(totalMembers) || 0;
    if (total <= 0) {
        return 'empty';
    }
    const started = Number(countsByState?.started || 0);
    const paused = Number(countsByState?.paused || 0);
    const stopped = Number(countsByState?.stopped || 0);
    const nonZeroKinds = [started, paused, stopped].filter((value) => value > 0).length;
    if (nonZeroKinds > 1) {
        return 'mixed';
    }
    if (started > 0) {
        return 'started';
    }
    if (paused > 0) {
        return 'paused';
    }
    return 'stopped';
};

const statusClassForKey = (statusKey) => {
    if (statusKey === 'started') {
        return 'is-started';
    }
    if (statusKey === 'paused') {
        return 'is-paused';
    }
    if (statusKey === 'stopped') {
        return 'is-stopped';
    }
    if (statusKey === 'mixed') {
        return 'is-mixed';
    }
    return 'is-empty';
};

const statusLabelForKey = (statusKey) => {
    if (statusKey === 'started') {
        return 'Started';
    }
    if (statusKey === 'paused') {
        return 'Paused';
    }
    if (statusKey === 'stopped') {
        return 'Stopped';
    }
    if (statusKey === 'mixed') {
        return 'Mixed';
    }
    return 'Empty';
};

const formatStatusSummaryText = (countsByState, totalMembers) => {
    const total = Number(totalMembers) || 0;
    if (total <= 0) {
        return 'Empty';
    }
    const parts = [];
    if ((countsByState?.started || 0) > 0) {
        parts.push(`${countsByState.started} started`);
    }
    if ((countsByState?.paused || 0) > 0) {
        parts.push(`${countsByState.paused} paused`);
    }
    if ((countsByState?.stopped || 0) > 0) {
        parts.push(`${countsByState.stopped} stopped`);
    }
    return parts.join(' | ');
};

const formatStatusDominantText = (statusKey, countsByState, totalMembers) => {
    const total = Number(totalMembers) || 0;
    if (total <= 0) {
        return 'Empty';
    }
    const label = statusLabelForKey(statusKey);
    if (statusKey === 'mixed') {
        return 'Mixed';
    }
    const count = statusKey === 'started'
        ? Number(countsByState?.started || 0)
        : (statusKey === 'paused' ? Number(countsByState?.paused || 0) : Number(countsByState?.stopped || 0));
    return `${label} ${count}/${total}`;
};

const folderMatchesStatusFilter = (statusFilterMode, countsByState, totalMembers) => {
    const mode = normalizeStatusFilterMode(statusFilterMode);
    if (mode === 'all') {
        return true;
    }
    const total = Number(totalMembers) || 0;
    if (mode === 'empty') {
        return total <= 0;
    }
    if (total <= 0) {
        return false;
    }
    const started = Number(countsByState?.started || 0);
    const paused = Number(countsByState?.paused || 0);
    const stopped = Number(countsByState?.stopped || 0);
    if (mode === 'started') {
        return started > 0;
    }
    if (mode === 'paused') {
        return paused > 0;
    }
    if (mode === 'stopped') {
        return stopped > 0;
    }
    if (mode === 'mixed') {
        return [started, paused, stopped].filter((value) => value > 0).length > 1;
    }
    return true;
};

const folderMatchesQuickFilter = ({
    type,
    mode,
    pinned = false,
    ruleCount = 0,
    members = 0,
    countsByState = {},
    updateCount = 0
}) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const normalizedMode = normalizeQuickFolderFilterMode(mode, resolvedType);
    if (normalizedMode === 'all') {
        return true;
    }
    if (normalizedMode === 'pinned') {
        return pinned === true;
    }
    if (normalizedMode === 'no-rules') {
        return Number(ruleCount) <= 0;
    }
    if (normalizedMode === 'empty') {
        return Number(members) <= 0;
    }
    if (normalizedMode === 'stopped') {
        const total = Number(members) || 0;
        return total > 0
            && Number(countsByState?.started || 0) <= 0
            && Number(countsByState?.paused || 0) <= 0
            && Number(countsByState?.stopped || 0) > 0;
    }
    if (normalizedMode === 'has-updates') {
        return resolvedType === 'docker' && Number(updateCount) > 0;
    }
    return true;
};

const summarizeStatusMembers = (label, names, maxItems = 6) => {
    const list = Array.isArray(names) ? names : [];
    if (!list.length) {
        return `${label}: none`;
    }
    const preview = list.slice(0, maxItems).join(', ');
    const extra = list.length > maxItems ? ` (+${list.length - maxItems} more)` : '';
    return `${label}: ${preview}${extra}`;
};
const getRowDetailsApi = (() => {
    let cachedApi = null;
    return () => {
        if (cachedApi) {
            return cachedApi;
        }
        cachedApi = rowDetailsModule.createApi({
            swal,
            getFolderMap: (type) => getFolderMap(type),
            getEffectiveMemberSnapshot: (type, folders) => getEffectiveMemberSnapshot(type, folders),
            getInfoByType: (type) => infoByType[type === 'vm' ? 'vm' : 'docker'] || {},
            getItemRuntimeStateKind,
            deriveFolderStatusKey,
            isDockerUpdateAvailable,
            statusLabelForKey,
            normalizeStatusPrefs,
            normalizeHealthPrefs,
            evaluateDockerFolderHealth,
            toggleStatusFilter,
            toggleHealthSeverityFilter
        });
        return cachedApi;
    };
})();
const getFolderStatusBreakdown = (...args) => getRowDetailsApi().getFolderStatusBreakdown(...args);
const showFolderStatusBreakdown = (...args) => getRowDetailsApi().showFolderStatusBreakdown(...args);
const showFolderHealthBreakdown = (...args) => getRowDetailsApi().showFolderHealthBreakdown(...args);

const setInlineValidationHint = (targetId, text = '', level = 'info') => {
    const hint = $(`#${targetId}`);
    if (!hint.length) {
        return;
    }
    const normalized = String(text || '').trim();
    const levelClass = String(level || 'info').trim().toLowerCase();
    hint.removeClass('is-info is-success is-warning is-error');
    if (!normalized) {
        hint.text('');
        return;
    }
    hint.text(normalized).addClass(`is-${['success', 'warning', 'error'].includes(levelClass) ? levelClass : 'info'}`);
};

const promptStarterFolderName = async (type, suggestedName) => {
    const resolvedType = normalizeManagedType(type);
    const folderTypeLabel = resolvedType === 'docker' ? 'Docker' : 'VM';
    const initialValue = String(suggestedName || '').trim() || `New ${folderTypeLabel} Folder`;
    if (typeof window.swal !== 'function') {
        const fallback = window.prompt(`Create ${folderTypeLabel} folder`, initialValue);
        return String(fallback || '').trim();
    }
    return new Promise((resolve) => {
        swal({
            title: `Create ${folderTypeLabel} folder`,
            text: 'Enter a folder name. You can change icon/settings after create.',
            type: 'input',
            inputValue: initialValue,
            showCancelButton: true,
            confirmButtonText: 'Create',
            cancelButtonText: 'Cancel',
            closeOnConfirm: false
        }, (value) => {
            if (value === false) {
                resolve('');
                return;
            }
            const name = String(value || '').trim();
            if (!name) {
                if (typeof swal.showInputError === 'function') {
                    swal.showInputError('Folder name is required.');
                }
                return false;
            }
            swal.close();
            resolve(name);
            return true;
        });
    });
};

const renderFirstRunQuickPathPanel = () => {
    const panel = $('#fv-first-run-panel');
    if (!panel.length) {
        return;
    }
    const dockerCount = Object.keys(getFolderMap('docker') || {}).length;
    const vmCount = Object.keys(getFolderMap('vm') || {}).length;
    if (dockerCount > 0 && vmCount > 0) {
        panel.hide().empty();
        return;
    }

    const needsDocker = dockerCount <= 0;
    const needsVm = vmCount <= 0;
    const parts = [];
    if (needsDocker) {
        parts.push('Docker folders not set up yet');
    }
    if (needsVm) {
        parts.push('VM folders not set up yet');
    }
    const title = parts.length ? `Quick start: ${parts.join(' and ')}` : 'Quick start';
    const help = 'Use one of these shortcuts to get organized quickly. You can still adjust everything manually afterward.';
    const buttons = [];
    if (needsDocker) {
        buttons.push('<button type="button" data-fv-empty-action="create" data-fv-type="docker"><i class="fa fa-plus-circle"></i> Create Docker folder</button>');
        buttons.push('<button type="button" data-fv-empty-action="templates" data-fv-type="docker"><i class="fa fa-th-large"></i> Docker templates</button>');
        buttons.push('<button type="button" data-fv-empty-action="import" data-fv-type="docker"><i class="fa fa-upload"></i> Import Docker config</button>');
    }
    if (needsVm) {
        buttons.push('<button type="button" data-fv-empty-action="create" data-fv-type="vm"><i class="fa fa-plus-circle"></i> Create VM folder</button>');
        buttons.push('<button type="button" data-fv-empty-action="templates" data-fv-type="vm"><i class="fa fa-th-large"></i> VM templates</button>');
        buttons.push('<button type="button" data-fv-empty-action="import" data-fv-type="vm"><i class="fa fa-upload"></i> Import VM config</button>');
    }
    buttons.push('<button type="button" data-fv-empty-action="wizard"><i class="fa fa-magic"></i> Open setup wizard</button>');

    panel.html(`
        <div class="fv-first-run-title">${escapeHtml(title)}</div>
        <div class="fv-first-run-help">${escapeHtml(help)}</div>
        <div class="fv-first-run-actions">${buttons.join('')}</div>
    `).show();
};

const resolveFolderStatusWarnThreshold = (folder, fallbackThreshold) => {
    const safeFallback = Number.isFinite(Number(fallbackThreshold))
        ? Math.min(100, Math.max(0, Math.round(Number(fallbackThreshold))))
        : 60;
    const settings = (folder && typeof folder.settings === 'object' && folder.settings !== null)
        ? folder.settings
        : {};
    const raw = settings.status_warn_stopped_percent;
    if (raw === '' || raw === null || raw === undefined) {
        return { value: safeFallback, source: 'global' };
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
        return { value: safeFallback, source: 'global' };
    }
    return {
        value: Math.min(100, Math.max(0, Math.round(parsed))),
        source: 'folder'
    };
};

const buildStatusSnapshot = (type, folders, memberSnapshot, infoByName) => {
    const snapshot = {};
    for (const [id] of Object.entries(folders || {})) {
        const members = Array.isArray(memberSnapshot?.[id]?.members) ? memberSnapshot[id].members : [];
        const countsByState = { started: 0, paused: 0, stopped: 0 };
        for (const member of members) {
            const runtimeState = getItemRuntimeStateKind(type, infoByName[member] || {});
            if (runtimeState === 'started') {
                countsByState.started += 1;
            } else if (runtimeState === 'paused') {
                countsByState.paused += 1;
            } else {
                countsByState.stopped += 1;
            }
        }
        snapshot[String(id)] = {
            total: members.length,
            started: countsByState.started,
            paused: countsByState.paused,
            stopped: countsByState.stopped,
            statusKey: deriveFolderStatusKey(countsByState, members.length)
        };
    }
    return snapshot;
};

const isDockerUpdateAvailable = (itemInfo) => {
    const source = itemInfo && typeof itemInfo === 'object' ? itemInfo : {};
    const state = source?.info?.State || source?.State || {};
    // Mirror Docker tab behavior exactly:
    // update-ready means manager is dockerman and Updated is strict boolean false.
    return state?.manager === 'dockerman' && state?.Updated === false;
};

const formatGiBFromKiB = (kibValue) => {
    const kib = Number(kibValue) || 0;
    if (kib <= 0) {
        return '0 GiB';
    }
    const gib = kib / (1024 * 1024);
    const fixed = gib >= 100 ? gib.toFixed(0) : gib.toFixed(1);
    return `${fixed} GiB`;
};

const formatVmMemoryLabel = (kibValue) => {
    const kib = Number(kibValue) || 0;
    if (kib <= 0) {
        return '0 GB';
    }
    const gib = kib / (1024 * 1024);
    const rounded = gib >= 100 ? gib.toFixed(0) : gib.toFixed(1);
    const compact = rounded.endsWith('.0') ? rounded.slice(0, -2) : rounded;
    return `${compact} GB`;
};

const collectVmFolderResources = (members, infoByName) => {
    const list = Array.isArray(members) ? members : [];
    const info = infoByName && typeof infoByName === 'object' ? infoByName : {};
    let autostartCount = 0;
    let vcpusTotal = 0;
    let memoryKiBTotal = 0;
    let storageBytesTotal = 0;
    const autostartMembers = [];
    for (const member of list) {
        const vmInfo = info[member] || {};
        if (valueIsTruthy(vmInfo.autostart)) {
            autostartCount += 1;
            autostartMembers.push(String(member));
        }
        vcpusTotal += Number(vmInfo.vcpus ?? vmInfo.nrVirtCpu ?? 0) || 0;
        memoryKiBTotal += Number(vmInfo.memoryKiB ?? vmInfo.memory ?? vmInfo.maxMem ?? 0) || 0;
        storageBytesTotal += Number(vmInfo.storageBytes ?? vmInfo.storage ?? 0) || 0;
    }
    return {
        membersCount: list.length,
        autostartCount,
        autostartMembers,
        vcpusTotal,
        memoryKiBTotal,
        storageBytesTotal
    };
};

const evaluateVmResourceBadge = (resourceTotals, healthPrefs) => {
    const totals = resourceTotals && typeof resourceTotals === 'object' ? resourceTotals : {};
    const prefs = healthPrefs && typeof healthPrefs === 'object' ? healthPrefs : {};
    const vcpusTotal = Number(totals.vcpusTotal || 0);
    const memoryKiBTotal = Number(totals.memoryKiBTotal || 0);
    const storageBytesTotal = Number(totals.storageBytesTotal || 0);
    const membersCount = Number(totals.membersCount || 0);
    const memoryGiBTotal = memoryKiBTotal > 0 ? (memoryKiBTotal / (1024 * 1024)) : 0;
    const storageText = formatBytesShort(storageBytesTotal) || '0 B';
    const warnVcpus = Number.isFinite(Number(prefs.vmResourceWarnVcpus)) ? Number(prefs.vmResourceWarnVcpus) : 16;
    const criticalVcpus = Number.isFinite(Number(prefs.vmResourceCriticalVcpus)) ? Number(prefs.vmResourceCriticalVcpus) : 32;
    const warnGiB = Number.isFinite(Number(prefs.vmResourceWarnGiB)) ? Number(prefs.vmResourceWarnGiB) : 32;
    const criticalGiB = Number.isFinite(Number(prefs.vmResourceCriticalGiB)) ? Number(prefs.vmResourceCriticalGiB) : 64;
    const criticalCpuExceeded = vcpusTotal >= criticalVcpus;
    const criticalMemoryExceeded = memoryGiBTotal >= criticalGiB;
    const warnCpuExceeded = vcpusTotal >= warnVcpus;
    const warnMemoryExceeded = memoryGiBTotal >= warnGiB;

    let severity = 'good';
    if (membersCount <= 0) {
        severity = 'empty';
    } else if (criticalCpuExceeded || criticalMemoryExceeded) {
        severity = 'critical';
    } else if (warnCpuExceeded || warnMemoryExceeded) {
        severity = 'warn';
    }

    const cpuClass = membersCount <= 0
        ? 'is-empty'
        : (criticalCpuExceeded ? 'is-critical' : (warnCpuExceeded ? 'is-warn' : 'is-good'));
    const memoryClass = membersCount <= 0
        ? 'is-empty'
        : (criticalMemoryExceeded ? 'is-critical' : (warnMemoryExceeded ? 'is-warn' : 'is-good'));
    const storageClass = membersCount <= 0
        ? 'is-empty'
        : (storageBytesTotal > 0 ? 'is-good' : 'is-empty');
    const text = `${vcpusTotal} vCPU | ${formatVmMemoryLabel(memoryKiBTotal)} RAM | ${storageText} storage`;
    const detailLines = [
        `Total resources: ${text}`,
        `Thresholds: warn ${warnVcpus} vCPU / ${warnGiB} GB, critical ${criticalVcpus} vCPU / ${criticalGiB} GB.`
    ];
    if (warnCpuExceeded || warnMemoryExceeded) {
        const reasons = [];
        if (warnCpuExceeded) {
            reasons.push(`${vcpusTotal} vCPU >= warn ${warnVcpus}`);
        }
        if (warnMemoryExceeded) {
            reasons.push(`${formatVmMemoryLabel(memoryKiBTotal)} >= warn ${warnGiB} GB`);
        }
        detailLines.push(`Warning: ${reasons.join(' | ')}`);
    }
    if (criticalCpuExceeded || criticalMemoryExceeded) {
        const reasons = [];
        if (criticalCpuExceeded) {
            reasons.push(`${vcpusTotal} vCPU >= critical ${criticalVcpus}`);
        }
        if (criticalMemoryExceeded) {
            reasons.push(`${formatVmMemoryLabel(memoryKiBTotal)} >= critical ${criticalGiB} GB`);
        }
        detailLines.push(`Critical: ${reasons.join(' | ')}`);
    }

    return {
        severity,
        text,
        title: detailLines.join('\n'),
        className: severity === 'critical'
            ? 'is-critical'
            : (severity === 'warn' ? 'is-warn' : (severity === 'empty' ? 'is-empty' : 'is-good')),
        chips: {
            cpu: {
                text: `${vcpusTotal} vCPU`,
                className: cpuClass,
                title: `CPU total: ${vcpusTotal} vCPU\nWarn: ${warnVcpus} vCPU\nCritical: ${criticalVcpus} vCPU`
            },
            memory: {
                text: `${formatVmMemoryLabel(memoryKiBTotal)} RAM`,
                className: memoryClass,
                title: `Memory total: ${formatVmMemoryLabel(memoryKiBTotal)}\nWarn: ${warnGiB} GB\nCritical: ${criticalGiB} GB`
            },
            storage: {
                text: `${storageText} Storage`,
                className: storageClass,
                title: `Storage total (file-backed disks): ${storageText}`
            }
        }
    };
};

const hasInvalidFolderRegex = (folder) => {
    const pattern = String(folder?.regex || '').trim();
    if (!pattern) {
        return false;
    }
    try {
        // eslint-disable-next-line no-new
        new RegExp(pattern);
        return false;
    } catch (_error) {
        return true;
    }
};

const buildTypeHealthMetrics = (type, folders, memberSnapshot = {}, prefsOverride = null) => {
    const normalizedType = type === 'vm' ? 'vm' : 'docker';
    const folderMap = utils.normalizeFolderMap(folders);
    const prefs = prefsOverride ? utils.normalizePrefs(prefsOverride) : utils.normalizePrefs(prefsByType[normalizedType]);
    const healthPrefs = normalizeHealthPrefs(normalizedType, prefs);
    const info = infoByType[normalizedType] || {};
    const pinnedSet = new Set(Array.isArray(prefs.pinnedFolderIds) ? prefs.pinnedFolderIds : []);
    const regexRuleKinds = new Set(['name_regex', 'image_regex', 'compose_project_regex']);
    const invalidRuleRegexCount = (prefs.autoRules || []).reduce((count, rule) => {
        if (!regexRuleKinds.has(String(rule?.kind || ''))) {
            return count;
        }
        const pattern = String(rule?.pattern || '').trim();
        if (!pattern) {
            return count;
        }
        try {
            // eslint-disable-next-line no-new
            new RegExp(pattern);
            return count;
        } catch (_error) {
            return count + 1;
        }
    }, 0);
    const conflictReport = utils.getConflictReport({
        type: normalizedType,
        folders: folderMap,
        prefs,
        infoByName: info
    });
    const conflictFolderIds = new Set();
    for (const row of conflictReport.rows || []) {
        if (!row?.hasConflict) {
            continue;
        }
        for (const matched of row.matchedFolders || []) {
            const folderId = String(matched?.folderId || '').trim();
            if (folderId) {
                conflictFolderIds.add(folderId);
            }
        }
    }

    const memberTotals = { total: 0, started: 0, paused: 0, stopped: 0 };
    const folderStatusTotals = { started: 0, paused: 0, stopped: 0, empty: 0 };
    const folderIssues = {};
    const healthScoreTotals = {
        sum: 0,
        count: 0
    };
    const healthSeverityTotals = {
        good: 0,
        maintenance: 0,
        warn: 0,
        critical: 0,
        empty: 0
    };
    let invalidFolderRegexCount = 0;

    for (const [folderId, folder] of Object.entries(folderMap)) {
        const members = Array.isArray(memberSnapshot?.[folderId]?.members) ? memberSnapshot[folderId].members : [];
        let started = 0;
        let paused = 0;
        let stopped = 0;
        for (const name of members) {
            const state = getItemRuntimeStateKind(normalizedType, info[name] || {});
            if (state === 'started') {
                started += 1;
            } else if (state === 'paused') {
                paused += 1;
            } else {
                stopped += 1;
            }
        }
        memberTotals.total += members.length;
        memberTotals.started += started;
        memberTotals.paused += paused;
        memberTotals.stopped += stopped;

        const isEmpty = members.length === 0;
        const isStoppedOnly = members.length > 0 && started === 0 && paused === 0;
        const hasConflict = conflictFolderIds.has(String(folderId));
        const invalidRegex = hasInvalidFolderRegex(folder);
        let needsAttention = isEmpty || isStoppedOnly || hasConflict || invalidRegex;
        let dockerHealth = null;
        if (normalizedType === 'docker') {
            let updateCount = 0;
            for (const member of members) {
                if (isDockerUpdateAvailable(info[member] || {})) {
                    updateCount += 1;
                }
            }
            dockerHealth = evaluateDockerFolderHealth(
                folder,
                members.length,
                { started, paused, stopped },
                updateCount,
                Number(healthPrefs.warnStoppedPercent) || 60
            );
            if (dockerHealth && typeof dockerHealth === 'object') {
                const score = Number(dockerHealth.score);
                if (Number.isFinite(score)) {
                    healthScoreTotals.sum += score;
                    healthScoreTotals.count += 1;
                }
                const severityKey = String(dockerHealth.filterSeverity || dockerHealth.severity || '').trim().toLowerCase();
                if (Object.prototype.hasOwnProperty.call(healthSeverityTotals, severityKey)) {
                    healthSeverityTotals[severityKey] += 1;
                } else if (severityKey === 'warn') {
                    healthSeverityTotals.warn += 1;
                }
                needsAttention = (dockerHealth.severity === 'warn' || dockerHealth.severity === 'critical')
                    || hasConflict
                    || invalidRegex;
            }
        }

        if (isEmpty) {
            folderStatusTotals.empty += 1;
        } else if (started > 0) {
            folderStatusTotals.started += 1;
        } else if (paused > 0) {
            folderStatusTotals.paused += 1;
        } else {
            folderStatusTotals.stopped += 1;
        }
        if (invalidRegex) {
            invalidFolderRegexCount += 1;
        }

        folderIssues[String(folderId)] = {
            empty: isEmpty,
            stoppedOnly: isStoppedOnly,
            conflict: hasConflict,
            invalidRegex,
            attention: needsAttention,
            memberCount: members.length,
            healthSeverity: dockerHealth?.severity || '',
            healthFilterSeverity: dockerHealth?.filterSeverity || dockerHealth?.severity || '',
            healthScore: Number.isFinite(Number(dockerHealth?.score)) ? Number(dockerHealth.score) : null,
            healthMaintenance: dockerHealth?.isMaintenance === true
        };
    }

    const stoppedPercent = memberTotals.total > 0
        ? Math.round((memberTotals.stopped / memberTotals.total) * 100)
        : 0;
    const attentionCount = Object.values(folderIssues).filter((issue) => issue.attention).length;
    let severity = 'ok';
    if (invalidFolderRegexCount > 0 || invalidRuleRegexCount > 0 || conflictReport.conflictingItems > 0) {
        severity = 'danger';
    } else if (healthSeverityTotals.critical > 0 || healthSeverityTotals.warn > 0 || stoppedPercent >= healthPrefs.warnStoppedPercent || attentionCount > 0) {
        severity = 'warning';
    }
    const averageHealthScore = healthScoreTotals.count > 0
        ? Math.round(healthScoreTotals.sum / healthScoreTotals.count)
        : 0;

    return {
        type: normalizedType,
        severity,
        folderCount: Object.keys(folderMap).length,
        pinnedCount: Array.from(pinnedSet).filter((id) => Object.prototype.hasOwnProperty.call(folderMap, id)).length,
        ruleCount: (prefs.autoRules || []).length,
        invalidFolderRegexCount,
        invalidRuleRegexCount,
        conflictItemCount: Number(conflictReport.conflictingItems || 0),
        stoppedPercent,
        averageHealthScore,
        memberTotals,
        folderStatusTotals,
        attentionCount,
        healthSeverityTotals,
        folderIssues
    };
};

const folderMatchesHealthFilter = (type, folderId, healthMetrics) => {
    const mode = normalizeHealthFilterMode(healthFilterByType[type]);
    if (mode === 'all') {
        return true;
    }
    const issue = healthMetrics?.folderIssues?.[String(folderId)] || {};
    if (mode === 'attention') {
        return issue.attention === true;
    }
    if (mode === 'empty') {
        return issue.empty === true;
    }
    if (mode === 'stopped') {
        return issue.stoppedOnly === true;
    }
    if (mode === 'conflict') {
        return issue.conflict === true;
    }
    return true;
};

const getHealthFilterLabel = (mode) => {
    if (mode === 'attention') {
        return 'needs attention';
    }
    if (mode === 'empty') {
        return 'empty';
    }
    if (mode === 'stopped') {
        return 'stopped';
    }
    if (mode === 'conflict') {
        return 'conflicts';
    }
    return 'all';
};

const getEffectiveMemberSnapshot = (type, folders) => {
    const info = infoByType[type] || {};
    const names = Object.keys(info);
    const rules = prefsByType[type]?.autoRules || [];
    const snapshot = {};
    for (const [folderId, folder] of Object.entries(folders || {})) {
        const members = utils.getEffectiveFolderMembers({
            type,
            folderId,
            folder,
            names,
            infoByName: info,
            rules
        });
        snapshot[String(folderId)] = members;
    }
    return snapshot;
};

const getRuntimePlanForFolder = (type, folderId, action) => {
    const folders = getFolderMap(type);
    const folder = folders[folderId];
    if (!folder) {
        return null;
    }
    return utils.planFolderRuntimeAction({
        type,
        folderId,
        folder,
        names: Object.keys(infoByType[type] || {}),
        infoByName: infoByType[type] || {},
        rules: prefsByType[type]?.autoRules || [],
        action
    });
};

const runtimePreviewText = (type, folderId, action, plan) => {
    if (!plan) {
        return 'No plan available.';
    }
    const folderName = folderNameForId(type, folderId);
    const lines = [];
    lines.push(`Type: ${type}`);
    lines.push(`Folder: ${folderName} (${folderId})`);
    lines.push(`Action: ${action}`);
    lines.push(`Requested: ${plan.requestedCount}`);
    lines.push(`Eligible: ${plan.eligible.length}`);
    lines.push(`Skipped: ${plan.skipped.length}`);
    lines.push(`State counts: started=${plan.countsByState?.started || 0}, paused=${plan.countsByState?.paused || 0}, stopped=${plan.countsByState?.stopped || 0}`);
    lines.push('');
    if (plan.eligible.length) {
        lines.push(`Eligible items (${plan.eligible.length}):`);
        for (const row of plan.eligible) {
            lines.push(`- ${row.name} [${row.state}]${row.reasons?.length ? ` via ${row.reasons.join(', ')}` : ''}`);
        }
        lines.push('');
    }
    if (plan.skipped.length) {
        lines.push(`Skipped items (${plan.skipped.length}):`);
        for (const row of plan.skipped) {
            lines.push(`- ${row.name} [${row.state}] - ${row.reason}`);
        }
    }
    return `${lines.join('\n')}\n`;
};

const normalizedFilter = (value) => String(value || '').trim().toLowerCase();
const TABLE_COLUMN_SELECTOR_MAP = settingsTableModule?.TABLE_COLUMN_SELECTOR_MAP || Object.freeze({ docker: Object.freeze({}), vm: Object.freeze({}) });
const normalizeSettingsTableColumnWidthPreset = typeof settingsTableModule?.normalizeSettingsTableColumnWidthPreset === 'function'
    ? settingsTableModule.normalizeSettingsTableColumnWidthPreset
    : ((value) => {
        const normalized = String(value || '').trim().toLowerCase();
        return ['compact', 'standard', 'wide'].includes(normalized) ? normalized : 'standard';
    });
const SETTINGS_TABLE_WIDTH_PRESET_VALUES = settingsTableModule?.SETTINGS_TABLE_WIDTH_PRESET_VALUES || settingsMetadata?.SETTINGS_TABLE_WIDTH_PRESET_VALUES || Object.freeze({
    name: Object.freeze({ compact: 260, standard: 320, wide: 420 }),
    actions: Object.freeze({ compact: 160, standard: 180, wide: 240 })
});
const normalizeSettingsTableWidthMode = typeof settingsTableModule?.normalizeSettingsTableWidthMode === 'function'
    ? settingsTableModule.normalizeSettingsTableWidthMode
    : ((value) => (String(value || '').trim().toLowerCase() === 'custom' ? 'custom' : 'auto'));
const normalizeSettingsTablePreset = typeof settingsTableModule?.normalizeSettingsTablePreset === 'function'
    ? settingsTableModule.normalizeSettingsTablePreset
    : ((value) => {
        const normalized = String(value || '').trim().toLowerCase();
        return ['compact', 'balanced', 'detailed', 'custom'].includes(normalized) ? normalized : 'balanced';
    });
const buildPresetColumnVisibilityForType = typeof settingsTableModule?.buildPresetColumnVisibilityForType === 'function'
    ? settingsTableModule.buildPresetColumnVisibilityForType
    : ((type, preset = 'balanced') => {
        const resolvedType = type === 'vm' ? 'vm' : 'docker';
        const normalizedPreset = normalizeSettingsTablePreset(preset);
        const schema = SETTINGS_TABLE_COLUMN_SCHEMA_BY_TYPE[resolvedType] || [];
        const defaults = {};
        schema.forEach((entry) => {
            if (entry.hideable !== true) {
                return;
            }
            defaults[entry.key] = entry.presets?.[normalizedPreset] !== false;
        });
        return defaults;
    });
const buildDefaultColumnWidthsForType = typeof settingsTableModule?.buildDefaultColumnWidthsForType === 'function'
    ? settingsTableModule.buildDefaultColumnWidthsForType
    : ((type) => {
        const resolvedType = type === 'vm' ? 'vm' : 'docker';
        const configByKey = TABLE_COLUMN_RESIZE_CONFIG_BY_TYPE[resolvedType] || {};
        const widths = {};
        Object.entries(configByKey).forEach(([key, config]) => {
            const defaultWidth = normalizeSingleColumnWidth(resolvedType, key, config.defaultWidth);
            if (defaultWidth !== null) {
                widths[key] = defaultWidth;
            }
        });
        return widths;
    });
const getSettingsTablePrefs = (type, prefsOverride = null) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const sourcePrefs = prefsOverride ? utils.normalizePrefs(prefsOverride) : utils.normalizePrefs(prefsByType[resolvedType]);
    const incoming = sourcePrefs && typeof sourcePrefs.settingsTable === 'object' ? sourcePrefs.settingsTable : {};
    const preset = normalizeSettingsTablePreset(incoming.preset);
    const columns = normalizeColumnVisibilityForType(
        resolvedType,
        incoming.columns && typeof incoming.columns === 'object'
            ? incoming.columns
            : buildPresetColumnVisibilityForType(resolvedType, preset)
    );
    const widths = normalizeColumnWidthsForType(
        resolvedType,
        incoming.columnWidths && typeof incoming.columnWidths === 'object' ? incoming.columnWidths : {}
    );
    return {
        widthMode: normalizeSettingsTableWidthMode(incoming.widthMode),
        preset,
        columns,
        columnWidths: widths,
        nameWidth: normalizeSettingsTableColumnWidthPreset(incoming.nameWidth),
        actionsWidth: normalizeSettingsTableColumnWidthPreset(incoming.actionsWidth)
    };
};
const syncSettingsTableStateFromPrefs = (type, prefsOverride = null) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const settingsTable = getSettingsTablePrefs(resolvedType, prefsOverride);
    columnWidthModeByType[resolvedType] = settingsTable.widthMode;
    columnPresetByType[resolvedType] = settingsTable.preset;
    columnVisibilityByType[resolvedType] = settingsTable.columns;
    columnWidthsByType[resolvedType] = settingsTable.columnWidths;
    settingsTableWidthPresetByType[resolvedType] = {
        name: settingsTable.nameWidth,
        actions: settingsTable.actionsWidth
    };
    return settingsTable;
};
const buildNextSettingsTablePrefs = (type, patch = {}) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const current = utils.normalizePrefs(prefsByType[resolvedType] || {});
    const currentSettingsTable = getSettingsTablePrefs(resolvedType, current);
    const nextWidthMode = normalizeSettingsTableWidthMode(
        Object.prototype.hasOwnProperty.call(patch, 'widthMode') ? patch.widthMode : currentSettingsTable.widthMode
    );
    const nextPreset = normalizeSettingsTablePreset(
        Object.prototype.hasOwnProperty.call(patch, 'preset') ? patch.preset : currentSettingsTable.preset
    );
    const nextColumns = normalizeColumnVisibilityForType(
        resolvedType,
        Object.prototype.hasOwnProperty.call(patch, 'columns') ? patch.columns : currentSettingsTable.columns
    );
    const nextColumnWidths = normalizeColumnWidthsForType(
        resolvedType,
        Object.prototype.hasOwnProperty.call(patch, 'columnWidths') ? patch.columnWidths : currentSettingsTable.columnWidths
    );
    return utils.normalizePrefs({
        ...current,
        settingsTable: {
            widthMode: nextWidthMode,
            preset: nextPreset,
            columns: nextColumns,
            columnWidths: nextColumnWidths,
            nameWidth: normalizeSettingsTableColumnWidthPreset(
                Object.prototype.hasOwnProperty.call(patch, 'nameWidth') ? patch.nameWidth : currentSettingsTable.nameWidth
            ),
            actionsWidth: normalizeSettingsTableColumnWidthPreset(
                Object.prototype.hasOwnProperty.call(patch, 'actionsWidth') ? patch.actionsWidth : currentSettingsTable.actionsWidth
            )
        }
    });
};
const normalizeColumnVisibilityForType = typeof settingsTableModule?.normalizeColumnVisibilityForType === 'function'
    ? settingsTableModule.normalizeColumnVisibilityForType
    : ((type, value = null) => {
        const resolvedType = type === 'vm' ? 'vm' : 'docker';
        const defaults = DEFAULT_COLUMN_VISIBILITY_BY_TYPE[resolvedType] || {};
        const source = value && typeof value === 'object' ? value : {};
        const normalized = {};
        Object.keys(defaults).forEach((key) => {
            normalized[key] = Object.prototype.hasOwnProperty.call(source, key)
                ? source[key] !== false
                : defaults[key] === true;
        });
        if (resolvedType === 'docker' && !Object.prototype.hasOwnProperty.call(source, 'signals')) {
            const updatesHidden = source.updates === false;
            const healthHidden = source.health === false;
            if (updatesHidden && healthHidden) {
                normalized.signals = false;
            }
        }
        return normalized;
    });

const TABLE_COLUMN_RESIZE_CONFIG_BY_TYPE = settingsTableModule?.TABLE_COLUMN_RESIZE_CONFIG_BY_TYPE || Object.freeze({
    docker: Object.freeze({}),
    vm: Object.freeze({})
});

const TABLE_COLUMN_RESIZE_KEYS_BY_TYPE = settingsTableModule?.TABLE_COLUMN_RESIZE_KEYS_BY_TYPE || Object.freeze({
    docker: Object.freeze([]),
    vm: Object.freeze([])
});

let activeTableColumnResize = null;
const SETTINGS_TABLE_RESIZE_GUIDE_ID = 'fv-settings-col-resize-guide';

const getSettingsTableElement = (type) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const tbodyId = tableIdByType[resolvedType];
    const tbody = document.querySelector(`tbody#${tbodyId}`);
    if (!tbody) {
        return null;
    }
    return tbody.closest('table');
};

const normalizeSingleColumnWidth = typeof settingsTableModule?.normalizeSingleColumnWidth === 'function'
    ? settingsTableModule.normalizeSingleColumnWidth
    : ((type, key, value) => {
        const resolvedType = type === 'vm' ? 'vm' : 'docker';
        const config = TABLE_COLUMN_RESIZE_CONFIG_BY_TYPE[resolvedType]?.[key];
        if (!config) {
            return null;
        }
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
            return null;
        }
        const min = Number(config.min) || 60;
        const max = Number(config.max) || 900;
        return Math.round(Math.min(max, Math.max(min, parsed)));
    });

const normalizeColumnWidthsForType = typeof settingsTableModule?.normalizeColumnWidthsForType === 'function'
    ? settingsTableModule.normalizeColumnWidthsForType
    : ((type, value = null) => {
        const resolvedType = type === 'vm' ? 'vm' : 'docker';
        const keys = TABLE_COLUMN_RESIZE_KEYS_BY_TYPE[resolvedType] || [];
        const source = value && typeof value === 'object' ? value : {};
        const normalized = {};
        keys.forEach((key) => {
            const width = normalizeSingleColumnWidth(resolvedType, key, source[key]);
            if (width !== null) {
                normalized[key] = width;
            }
        });
        return normalized;
    });

const captureCurrentColumnWidths = (type) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const table = getSettingsTableElement(resolvedType);
    if (!table) {
        return {};
    }
    const configByKey = TABLE_COLUMN_RESIZE_CONFIG_BY_TYPE[resolvedType] || {};
    const keys = TABLE_COLUMN_RESIZE_KEYS_BY_TYPE[resolvedType] || [];
    const widths = {};
    keys.forEach((key) => {
        const header = configByKey[key] ? table.querySelector(configByKey[key].header) : null;
        if (!header || header.classList.contains('fv-col-hidden')) {
            return;
        }
        const measured = normalizeSingleColumnWidth(resolvedType, key, header.getBoundingClientRect().width);
        if (measured !== null) {
            widths[key] = measured;
        }
    });
    return widths;
};

const syncResizableTableLayout = (type) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const table = getSettingsTableElement(resolvedType);
    if (!table) {
        return;
    }
    const tableWrap = table.closest('.table-wrap');
    const customWidths = columnWidthsByType[resolvedType] && typeof columnWidthsByType[resolvedType] === 'object'
        ? columnWidthsByType[resolvedType]
        : {};
    const hasCustomWidths = Object.keys(customWidths).length > 0;
    if (shouldUseCompactMobileLayout()) {
        table.style.removeProperty('width');
        table.style.removeProperty('max-width');
        table.style.removeProperty('table-layout');
        if (tableWrap && tableWrap.style) {
            tableWrap.style.removeProperty('overflow-x');
            tableWrap.style.removeProperty('overflow-y');
        }
        return;
    }
    const widthMode = normalizeSettingsTableWidthMode(columnWidthModeByType[resolvedType]);
    if (widthMode !== 'custom') {
        table.style.removeProperty('width');
        table.style.removeProperty('max-width');
        table.style.removeProperty('table-layout');
        if (tableWrap && tableWrap.style) {
            tableWrap.style.removeProperty('overflow-x');
            tableWrap.style.removeProperty('overflow-y');
        }
        return;
    }
    if (!hasCustomWidths) {
        table.style.removeProperty('width');
        table.style.removeProperty('max-width');
        table.style.removeProperty('table-layout');
        if (tableWrap && tableWrap.style) {
            tableWrap.style.removeProperty('overflow-x');
            tableWrap.style.removeProperty('overflow-y');
        }
        return;
    }
    const configByKey = TABLE_COLUMN_RESIZE_CONFIG_BY_TYPE[resolvedType] || {};
    const keys = TABLE_COLUMN_RESIZE_KEYS_BY_TYPE[resolvedType] || [];
    let totalWidth = 0;
    let visibleColumns = 0;
    keys.forEach((key) => {
        const header = configByKey[key] ? table.querySelector(configByKey[key].header) : null;
        if (!header || header.classList.contains('fv-col-hidden')) {
            return;
        }
        const configuredWidth = normalizeSingleColumnWidth(resolvedType, key, customWidths[key]);
        totalWidth += Math.ceil(configuredWidth || header.getBoundingClientRect().width || 0);
        visibleColumns += 1;
    });
    if (visibleColumns <= 0 || totalWidth <= 0) {
        table.style.removeProperty('width');
        table.style.removeProperty('max-width');
        table.style.removeProperty('table-layout');
        return;
    }
    // Keep each resized column independent by sizing the table to the
    // explicit sum of visible column widths (instead of stretching to wrapper).
    // This avoids the browser redistributing width across sibling columns.
    const targetWidth = Math.max(0, totalWidth);
    table.style.setProperty('width', `${targetWidth}px`, 'important');
    table.style.setProperty('max-width', 'none', 'important');
    table.style.setProperty('table-layout', 'fixed', 'important');
    if (tableWrap && tableWrap.style) {
        tableWrap.style.setProperty('overflow-x', 'auto', 'important');
        tableWrap.style.setProperty('overflow-y', 'visible', 'important');
    }
};

const buildTableUiStatePayload = () => ({
    filters: {
        docker: { ...(filtersByType.docker || {}) },
        vm: { ...(filtersByType.vm || {}) }
    },
    quick: {
        docker: normalizeQuickFolderFilterMode(quickFolderFilterByType.docker, 'docker'),
        vm: normalizeQuickFolderFilterMode(quickFolderFilterByType.vm, 'vm')
    },
    health: {
        docker: normalizeHealthFilterMode(healthFilterByType.docker),
        vm: normalizeHealthFilterMode(healthFilterByType.vm)
    },
    healthSeverity: {
        docker: normalizeHealthSeverityFilterMode(healthSeverityFilterByType.docker),
        vm: normalizeHealthSeverityFilterMode(healthSeverityFilterByType.vm)
    },
    status: {
        docker: normalizeStatusFilterMode(statusFilterByType.docker),
        vm: normalizeStatusFilterMode(statusFilterByType.vm)
    },
    dockerUpdatesOnlyFilter: dockerUpdatesOnlyFilter === true,
    treeCollapsed: {
        docker: Array.from(collapsedTreeParentsByType.docker || []),
        vm: Array.from(collapsedTreeParentsByType.vm || [])
    },
    treeReorderMode: {
        docker: mobileTreeReorderModeByType.docker === true,
        vm: mobileTreeReorderModeByType.vm === true
    },
    advancedSearch: {
        byTab: normalizeAdvancedSearchMap(settingsUiState.advancedSearchByTab),
        query: normalizedFilter(settingsUiState.query),
        searchAll: settingsUiState.searchAllAdvanced === true
    }
});

const persistTableUiState = () => {
    try {
        writeSettingsStorage(TABLE_UI_STATE_STORAGE_KEY, JSON.stringify(buildTableUiStatePayload()), { delayMs: 90, idle: true });
    } catch (_error) {
        // Ignore storage failures; UI continues with runtime state only.
    }
};

const restoreTableUiState = () => {
    try {
        const raw = localStorage.getItem(TABLE_UI_STATE_STORAGE_KEY);
        if (!raw) {
            return;
        }
        const parsed = JSON.parse(raw);
        const source = parsed && typeof parsed === 'object' ? parsed : {};
        const sourceFilters = source.filters && typeof source.filters === 'object' ? source.filters : {};
        const sourceQuick = source.quick && typeof source.quick === 'object' ? source.quick : {};
        const sourceHealth = source.health && typeof source.health === 'object' ? source.health : {};
        const sourceHealthSeverity = source.healthSeverity && typeof source.healthSeverity === 'object' ? source.healthSeverity : {};
        const sourceStatus = source.status && typeof source.status === 'object' ? source.status : {};
        const sourceTreeCollapsed = source.treeCollapsed && typeof source.treeCollapsed === 'object' ? source.treeCollapsed : {};
        const sourceTreeReorderMode = source.treeReorderMode && typeof source.treeReorderMode === 'object' ? source.treeReorderMode : {};
        const sourceAdvancedSearch = source.advancedSearch && typeof source.advancedSearch === 'object' ? source.advancedSearch : {};
        ['docker', 'vm'].forEach((resolvedType) => {
            const perTypeFilters = sourceFilters[resolvedType] && typeof sourceFilters[resolvedType] === 'object'
                ? sourceFilters[resolvedType]
                : {};
            filtersByType[resolvedType] = {
                folders: normalizedFilter(perTypeFilters.folders),
                rules: normalizedFilter(perTypeFilters.rules),
                backups: normalizedFilter(perTypeFilters.backups),
                templates: normalizedFilter(perTypeFilters.templates),
                bulk: normalizedFilter(perTypeFilters.bulk)
            };
            quickFolderFilterByType[resolvedType] = normalizeQuickFolderFilterMode(sourceQuick[resolvedType], resolvedType);
            healthFilterByType[resolvedType] = normalizeHealthFilterMode(sourceHealth[resolvedType]);
            healthSeverityFilterByType[resolvedType] = normalizeHealthSeverityFilterMode(sourceHealthSeverity[resolvedType]);
            statusFilterByType[resolvedType] = normalizeStatusFilterMode(sourceStatus[resolvedType]);
            collapsedTreeParentsByType[resolvedType] = new Set(
                Array.isArray(sourceTreeCollapsed[resolvedType])
                    ? sourceTreeCollapsed[resolvedType].map((id) => String(id || '').trim()).filter(Boolean)
                    : []
            );
            mobileTreeReorderModeByType[resolvedType] = sourceTreeReorderMode[resolvedType] === true;
        });
        settingsUiState.advancedSearchByTab = normalizeAdvancedSearchMap(
            sourceAdvancedSearch.byTab || sourceAdvancedSearch.queryByTab || {}
        );
        if (typeof sourceAdvancedSearch.query === 'string') {
            settingsUiState.query = normalizedFilter(sourceAdvancedSearch.query);
        } else if (settingsUiState.mode === 'advanced') {
            settingsUiState.query = readActiveAdvancedSearchQuery();
        }
        if (sourceAdvancedSearch.searchAll === true || sourceAdvancedSearch.searchAll === false) {
            settingsUiState.searchAllAdvanced = sourceAdvancedSearch.searchAll === true;
        }
        dockerUpdatesOnlyFilter = source.dockerUpdatesOnlyFilter === true;
    } catch (_error) {
        // Ignore parse/storage failures; fall back to defaults.
    }
};

const applyColumnVisibility = (type) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const tbodyId = tableIdByType[resolvedType];
    const tbody = $(`tbody#${tbodyId}`);
    if (!tbody.length) {
        return;
    }
    const table = tbody.closest('table');
    const selectors = TABLE_COLUMN_SELECTOR_MAP[resolvedType] || {};
    const state = normalizeColumnVisibilityForType(resolvedType, columnVisibilityByType[resolvedType]);
    Object.entries(selectors).forEach(([key, target]) => {
        const visible = state[key] !== false;
        table.find(String(target.header || '')).toggleClass('fv-col-hidden', !visible);
        table.find(String(target.cell || '')).toggleClass('fv-col-hidden', !visible);
    });
};

const applySingleColumnWidth = (type, key, widthPx) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const table = getSettingsTableElement(resolvedType);
    if (!table) {
        return;
    }
    const config = TABLE_COLUMN_RESIZE_CONFIG_BY_TYPE[resolvedType]?.[key];
    if (!config) {
        return;
    }
    const targets = table.querySelectorAll(`${config.header}, ${config.cell}`);
    const width = normalizeSingleColumnWidth(resolvedType, key, widthPx);
    targets.forEach((element) => {
        if (!width || shouldUseCompactMobileLayout()) {
            element.style.removeProperty('width');
            element.style.removeProperty('min-width');
            element.style.removeProperty('max-width');
            return;
        }
        element.style.setProperty('width', `${width}px`, 'important');
        element.style.setProperty('min-width', `${width}px`, 'important');
        element.style.setProperty('max-width', `${width}px`, 'important');
    });
};

const buildEffectiveSettingsTableWidths = (type) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    if (typeof settingsTableModule?.buildEffectiveSettingsTableWidths === 'function') {
        return settingsTableModule.buildEffectiveSettingsTableWidths(resolvedType, settingsTableWidthPresetByType[resolvedType] || {});
    }
    const next = buildDefaultColumnWidthsForType(resolvedType);
    const widthPresets = settingsTableWidthPresetByType[resolvedType] || {};
    const nameWidthPreset = normalizeSettingsTableColumnWidthPreset(widthPresets.name);
    const actionsWidthPreset = normalizeSettingsTableColumnWidthPreset(widthPresets.actions);
    next.name = normalizeSingleColumnWidth(resolvedType, 'name', SETTINGS_TABLE_WIDTH_PRESET_VALUES.name[nameWidthPreset]) || next.name;
    next.actions = normalizeSingleColumnWidth(resolvedType, 'actions', SETTINGS_TABLE_WIDTH_PRESET_VALUES.actions[actionsWidthPreset]) || next.actions;
    return next;
};

const applyColumnWidths = (type) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    columnWidthModeByType[resolvedType] = 'auto';
    columnWidthsByType[resolvedType] = {};
    const keys = TABLE_COLUMN_RESIZE_KEYS_BY_TYPE[resolvedType] || [];
    const widths = buildEffectiveSettingsTableWidths(resolvedType);
    keys.forEach((key) => {
        applySingleColumnWidth(resolvedType, key, widths[key]);
    });
    syncResizableTableLayout(resolvedType);
};

const persistSettingsTableState = async (type, patch = {}, options = {}) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const rerender = options.rerender === true;
    const currentPrefs = prefsByType[resolvedType] || utils.normalizePrefs({});
    const previousState = {
        widthMode: columnWidthModeByType[resolvedType],
        preset: columnPresetByType[resolvedType],
        columns: { ...(columnVisibilityByType[resolvedType] || {}) },
        columnWidths: { ...(columnWidthsByType[resolvedType] || {}) }
    };
    try {
        const nextPrefs = buildNextSettingsTablePrefs(resolvedType, patch);
        prefsByType[resolvedType] = await postPrefs(resolvedType, nextPrefs);
        syncSettingsTableStateFromPrefs(resolvedType, prefsByType[resolvedType]);
        renderSettingsTableLayoutControls(resolvedType);
        renderColumnVisibilityControls(resolvedType);
        if (rerender) {
            renderTable(resolvedType);
        } else {
            applyColumnVisibility(resolvedType);
            applyColumnWidths(resolvedType);
            bindTableColumnResizers(resolvedType);
        }
    } catch (error) {
        prefsByType[resolvedType] = currentPrefs;
        columnWidthModeByType[resolvedType] = previousState.widthMode;
        columnPresetByType[resolvedType] = previousState.preset;
        columnVisibilityByType[resolvedType] = previousState.columns;
        columnWidthsByType[resolvedType] = previousState.columnWidths;
        renderSettingsTableLayoutControls(resolvedType);
        renderColumnVisibilityControls(resolvedType);
        applyColumnVisibility(resolvedType);
        applyColumnWidths(resolvedType);
        bindTableColumnResizers(resolvedType);
        showError('Settings table preferences save failed', error);
    }
};

const stopActiveTableColumnResize = (persist = true) => {
    const active = activeTableColumnResize;
    if (!active) {
        return;
    }
    document.getElementById(SETTINGS_TABLE_RESIZE_GUIDE_ID)?.remove();
    document.body.classList.remove('fv-column-resize-active');
    window.removeEventListener('mousemove', active.onMove, true);
    window.removeEventListener('mouseup', active.onUp, true);
    activeTableColumnResize = null;
    if (persist && active.dragStarted === true) {
        persistSettingsTableState(active.type, {
            widthMode: 'custom',
            preset: 'custom',
            columnWidths: columnWidthsByType[active.type] || {}
        });
    }
};

const ensureSettingsTableResizeGuide = () => {
    let guide = document.getElementById(SETTINGS_TABLE_RESIZE_GUIDE_ID);
    if (!guide) {
        guide = document.createElement('div');
        guide.id = SETTINGS_TABLE_RESIZE_GUIDE_ID;
        guide.className = 'fv-col-resize-guide';
        document.body.appendChild(guide);
    }
    return guide;
};

const positionSettingsTableResizeGuide = (left, top, height) => {
    const guide = ensureSettingsTableResizeGuide();
    guide.style.left = `${Math.round(left)}px`;
    guide.style.top = `${Math.round(top)}px`;
    guide.style.height = `${Math.max(0, Math.round(height))}px`;
};

const beginTableColumnResize = (type, key, event) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    if (shouldUseCompactMobileLayout()) {
        return;
    }
    if (event.button !== 0) {
        return;
    }
    const table = getSettingsTableElement(resolvedType);
    if (!table) {
        return;
    }
    const config = TABLE_COLUMN_RESIZE_CONFIG_BY_TYPE[resolvedType]?.[key];
    if (!config) {
        return;
    }
    const startClientX = Number(event.clientX || 0);
    const header = table.querySelector(config.header);
    if (!header) {
        return;
    }
    const startWidth = header.getBoundingClientRect().width;
    const normalizedStart = normalizeSingleColumnWidth(resolvedType, key, startWidth) || startWidth;
    const tableRect = table.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    const startBoundaryX = headerRect.right;
    let dragStarted = false;
    let nextWidth = normalizedStart;
    const startResize = () => {
        if (dragStarted) {
            return;
        }
        dragStarted = true;
        const frozenWidths = captureCurrentColumnWidths(resolvedType);
        if (Object.keys(frozenWidths).length > 0) {
            columnWidthsByType[resolvedType] = normalizeColumnWidthsForType(resolvedType, {
                ...(columnWidthsByType[resolvedType] || {}),
                ...frozenWidths
            });
        }
        columnWidthModeByType[resolvedType] = 'custom';
        columnPresetByType[resolvedType] = 'custom';
        columnWidthsByType[resolvedType] = normalizeColumnWidthsForType(resolvedType, {
            ...(columnWidthsByType[resolvedType] || {}),
            [key]: normalizedStart
        });
        document.body.classList.add('fv-column-resize-active');
        positionSettingsTableResizeGuide(startBoundaryX, tableRect.top, tableRect.height);
    };
    const applyResolvedWidth = () => {
        columnWidthsByType[resolvedType] = normalizeColumnWidthsForType(resolvedType, {
            ...(columnWidthsByType[resolvedType] || {}),
            [key]: nextWidth
        });
        applyColumnWidths(resolvedType);
    };
    const onMove = (moveEvent) => {
        if (Number(moveEvent.buttons) === 0) {
            if (dragStarted) {
                applyResolvedWidth();
            }
            stopActiveTableColumnResize(true);
            return;
        }
        const delta = Number(moveEvent.clientX || 0) - startClientX;
        if (!dragStarted && Math.abs(delta) < 4) {
            return;
        }
        startResize();
        const candidateWidth = normalizeSingleColumnWidth(resolvedType, key, normalizedStart + delta);
        if (candidateWidth === null) {
            return;
        }
        nextWidth = candidateWidth;
        positionSettingsTableResizeGuide(startBoundaryX + (nextWidth - normalizedStart), tableRect.top, tableRect.height);
    };
    const onUp = () => {
        if (dragStarted) {
            applyResolvedWidth();
        }
        stopActiveTableColumnResize(true);
    };
    activeTableColumnResize = {
        type: resolvedType,
        dragStarted: false,
        onMove,
        onUp
    };
    Object.defineProperty(activeTableColumnResize, 'dragStarted', {
        get: () => dragStarted,
        set: (value) => {
            dragStarted = value === true;
        }
    });
    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('mouseup', onUp, true);
    event.preventDefault();
    event.stopPropagation();
};

const bindTableColumnResizers = (type) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const table = getSettingsTableElement(resolvedType);
    if (!table) {
        return;
    }
    table.querySelectorAll('.fv-col-resizer').forEach((handle) => handle.remove());
    table.querySelectorAll('th.fv-col-resizable').forEach((header) => header.classList.remove('fv-col-resizable'));
};

const renderColumnVisibilityControls = (type) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const state = normalizeColumnVisibilityForType(resolvedType, columnVisibilityByType[resolvedType]);
    const schema = SETTINGS_TABLE_COLUMN_SCHEMA_BY_TYPE[resolvedType] || [];
    schema.forEach((entry) => {
        if (!entry.fieldId) {
            return;
        }
        $(`#${entry.fieldId}`).prop('checked', state[entry.key] === true);
    });
};

const renderSettingsTableLayoutControls = (type) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const preset = normalizeSettingsTablePreset(columnPresetByType[resolvedType]);
    const widthPresets = settingsTableWidthPresetByType[resolvedType] || {};
    $(`[data-fv-table-preset^="${resolvedType}:"]`).removeClass('is-active');
    $(`[data-fv-table-preset="${resolvedType}:${preset}"]`).addClass('is-active');
    $(`#${resolvedType}-table-name-width`).val(normalizeSettingsTableColumnWidthPreset(widthPresets.name));
    $(`#${resolvedType}-table-actions-width`).val(normalizeSettingsTableColumnWidthPreset(widthPresets.actions));
};

const setFilterQuery = (section, type, value) => {
    if (!filtersByType[type] || !Object.prototype.hasOwnProperty.call(filtersByType[type], section)) {
        return;
    }
    filtersByType[type][section] = normalizedFilter(value);
    persistTableUiState();
    if (section === 'folders') {
        renderTable(type);
        return;
    }
    if (section === 'rules') {
        renderRulesTable(type);
        return;
    }
    if (section === 'backups') {
        renderBackupRows(type);
        return;
    }
    if (section === 'templates') {
        renderTemplateRows(type);
    }
};

const normalizeRecoveryWorkspaceType = (value) => (
    String(value || '').trim().toLowerCase() === 'vm' ? 'vm' : 'docker'
);

const normalizeRulesWorkspaceType = (value) => (
    String(value || '').trim().toLowerCase() === 'vm' ? 'vm' : 'docker'
);

const getActiveRecoveryWorkspaceType = () => normalizeRecoveryWorkspaceType(activeRecoveryWorkspaceType);

const getSortedBackupsForType = (type) => {
    const resolvedType = normalizeRecoveryWorkspaceType(type);
    return [...(Array.isArray(backupsByType[resolvedType]) ? backupsByType[resolvedType] : [])].sort((left, right) => {
        const leftTime = new Date(String(left?.createdAt || '')).getTime() || 0;
        const rightTime = new Date(String(right?.createdAt || '')).getTime() || 0;
        if (leftTime !== rightTime) {
            return rightTime - leftTime;
        }
        return String(right?.name || '').localeCompare(String(left?.name || ''));
    });
};

const formatRecoveryReasonLabel = (value) => {
    const raw = String(value || '').trim();
    if (!raw) {
        return 'Manual';
    }
    return raw
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b([a-z])/g, (match) => match.toUpperCase());
};

const buildRecoveryOverviewHtml = (type) => {
    const resolvedType = normalizeRecoveryWorkspaceType(type);
    const title = resolvedType === 'docker' ? 'Docker' : 'VMs';
    const folders = getFolderMap(resolvedType);
    const backups = getSortedBackupsForType(resolvedType);
    const prefs = utils.normalizePrefs(prefsByType[resolvedType]);
    const schedule = prefs.backupSchedule || {};
    const latest = backups[0] || null;
    const backupCount = backups.length;
    const scheduleEnabled = schedule.enabled === true;
    const retention = Number.isFinite(Number(schedule.retention)) ? Number(schedule.retention) : 25;
    const interval = Number.isFinite(Number(schedule.intervalHours)) ? Number(schedule.intervalHours) : 24;
    const latestCreated = latest?.createdAt ? formatTimestamp(latest.createdAt) : 'Not created yet';
    const latestReason = latest ? formatRecoveryReasonLabel(latest.reason) : 'Create a manual checkpoint first';
    const folderCount = Object.keys(folders || {}).length;
    const statusClass = latest
        ? (scheduleEnabled ? 'is-healthy' : 'is-warning')
        : 'is-warning';
    const statusLabel = latest
        ? (scheduleEnabled ? 'Ready' : 'Watch')
        : 'No backup yet';
    const headline = latest
        ? `Latest ${title} backup is ready to restore.`
        : `No ${title} backup snapshot is available yet.`;
    const copy = latest
        ? `Latest snapshot: ${escapeHtml(latestCreated)}. Restore latest will create a fresh safety backup first.`
        : `Create a manual backup before making larger changes so you have a safe rollback point.`;

    return `
        <div class="fv-recovery-overview-head">
            <div>
                <span class="fv-recovery-source-label">${escapeHtml(title)}</span>
                <div class="fv-recovery-headline">${escapeHtml(headline)}</div>
                <div class="fv-recovery-copy">${copy}</div>
            </div>
            <span class="fv-rules-status-chip ${statusClass}">${escapeHtml(statusLabel)}</span>
        </div>
        <div class="fv-recovery-stat-grid">
            <div class="fv-recovery-stat-card">
                <span class="fv-recovery-stat-label">Latest backup</span>
                <strong>${escapeHtml(latestCreated)}</strong>
                <span>${escapeHtml(latestReason)}</span>
            </div>
            <div class="fv-recovery-stat-card">
                <span class="fv-recovery-stat-label">Snapshots kept</span>
                <strong>${escapeHtml(String(backupCount))}</strong>
                <span>${escapeHtml(`${folderCount} folder${folderCount === 1 ? '' : 's'} tracked`)}</span>
            </div>
            <div class="fv-recovery-stat-card">
                <span class="fv-recovery-stat-label">Auto backup</span>
                <strong>${escapeHtml(scheduleEnabled ? `Every ${interval}h` : 'Manual only')}</strong>
                <span>${escapeHtml(schedule.lastRunAt ? `Last run ${formatTimestamp(schedule.lastRunAt)}` : 'Scheduler has not run yet')}</span>
            </div>
            <div class="fv-recovery-stat-card">
                <span class="fv-recovery-stat-label">Retention</span>
                <strong>${escapeHtml(`${retention} snapshot${retention === 1 ? '' : 's'}`)}</strong>
                <span>${escapeHtml(scheduleEnabled ? 'Old backups rotate automatically.' : 'Retention applies after scheduler runs.')}</span>
            </div>
        </div>
    `;
};

const buildRecoveryBackupHistoryHtml = (type) => {
    const resolvedType = normalizeRecoveryWorkspaceType(type);
    const filter = normalizedFilter(filtersByType[resolvedType]?.backups);
    const backups = getSortedBackupsForType(resolvedType).filter((backup) => {
        if (!filter) {
            return true;
        }
        const haystack = `${String(backup?.name || '')} ${String(backup?.reason || '')}`.toLowerCase();
        return haystack.includes(filter);
    });
    const summaryEl = $('#fv-recovery-history-summary');
    const title = resolvedType === 'docker' ? 'Docker' : 'VM';
    if (!backups.length) {
        const emptyTitle = filter ? 'No backups match your search.' : `No ${title} backups yet.`;
        const emptyCopy = filter
            ? 'Try a different search term or clear the filter.'
            : 'Create a manual backup or run the scheduler to build recovery history.';
        summaryEl.text(filter ? 'No backups match the current filter.' : 'No backup snapshots are available yet.');
        return `
            <div class="fv-recovery-empty-state">
                <strong>${escapeHtml(emptyTitle)}</strong>
                <span>${escapeHtml(emptyCopy)}</span>
            </div>
        `;
    }

    summaryEl.text(`${backups.length} snapshot${backups.length === 1 ? '' : 's'} ready for restore, download, or cleanup.`);
    return backups.map((backup, index) => {
        const name = String(backup?.name || '').trim();
        const created = formatTimestamp(backup?.createdAt || '');
        const reason = formatRecoveryReasonLabel(backup?.reason);
        const count = Number.isFinite(Number(backup?.count)) ? Number(backup.count) : 0;
        const latestBadge = index === 0 ? '<span class="fv-recovery-history-badge">Latest</span>' : '';
        return `
            <article class="fv-recovery-history-card">
                <div class="fv-recovery-history-head">
                    <div>
                        <div class="fv-recovery-history-title">${escapeHtml(created)}</div>
                        <div class="fv-recovery-history-copy">${escapeHtml(reason)}</div>
                    </div>
                    ${latestBadge}
                </div>
                <div class="fv-recovery-history-meta">
                    <span>${escapeHtml(`${count} folder${count === 1 ? '' : 's'}`)}</span>
                    <span>${escapeHtml(name)}</span>
                </div>
                <div class="backup-actions fv-recovery-history-actions-row">
                    <button type="button" onclick="restoreBackupEntry('${resolvedType}','${escapeHtml(name)}')"><i class="fa fa-history"></i> Restore</button>
                    <button type="button" onclick="downloadBackupEntry('${resolvedType}','${escapeHtml(name)}')"><i class="fa fa-download"></i> Download</button>
                    <button type="button" onclick="deleteBackupEntry('${resolvedType}','${escapeHtml(name)}')"><i class="fa fa-trash"></i> Delete</button>
                </div>
            </article>
        `;
    }).join('');
};

const syncVisibleRecoveryCompareControls = (type) => {
    const resolvedType = normalizeRecoveryWorkspaceType(type);
    const visibleLeft = $('#recovery-backup-compare-left');
    const visibleRight = $('#recovery-backup-compare-right');
    const visiblePrefs = $('#recovery-backup-compare-include-prefs');
    const sourceLeft = $(`#${resolvedType}-backup-compare-left`);
    const sourceRight = $(`#${resolvedType}-backup-compare-right`);
    const sourcePrefs = $(`#${resolvedType}-backup-compare-include-prefs`);
    if (!visibleLeft.length || !visibleRight.length || !visiblePrefs.length || !sourceLeft.length || !sourceRight.length || !sourcePrefs.length) {
        return;
    }

    visibleLeft.html(sourceLeft.html()).prop('disabled', sourceLeft.prop('disabled'));
    visibleRight.html(sourceRight.html()).prop('disabled', sourceRight.prop('disabled'));
    visiblePrefs.prop('checked', sourcePrefs.prop('checked') === true).prop('disabled', sourcePrefs.prop('disabled'));
    visibleLeft.val(String(sourceLeft.val() || ''));
    visibleRight.val(String(sourceRight.val() || '__current__'));
};

const syncHiddenRecoveryCompareControls = (type) => {
    const resolvedType = normalizeRecoveryWorkspaceType(type);
    const visibleLeft = $('#recovery-backup-compare-left');
    const visibleRight = $('#recovery-backup-compare-right');
    const visiblePrefs = $('#recovery-backup-compare-include-prefs');
    const sourceLeft = $(`#${resolvedType}-backup-compare-left`);
    const sourceRight = $(`#${resolvedType}-backup-compare-right`);
    const sourcePrefs = $(`#${resolvedType}-backup-compare-include-prefs`);
    if (!visibleLeft.length || !visibleRight.length || !visiblePrefs.length || !sourceLeft.length || !sourceRight.length || !sourcePrefs.length) {
        return;
    }
    sourceLeft.val(String(visibleLeft.val() || ''));
    sourceRight.val(String(visibleRight.val() || '__current__'));
    sourcePrefs.prop('checked', visiblePrefs.prop('checked') === true);
    sourceLeft.triggerHandler('change');
    sourceRight.triggerHandler('change');
    sourcePrefs.triggerHandler('change');
};

const renderRecoveryWorkspace = (type = activeRecoveryWorkspaceType) => {
    const resolvedType = normalizeRecoveryWorkspaceType(type);
    const overviewHost = $('#fv-recovery-overview');
    const listHost = $('#fv-recovery-backup-list');
    const filterInput = $('#recovery-backups-filter');
    const policySummary = $('#fv-recovery-policy-summary');
    const safetyNote = $('#fv-recovery-safety-note');
    if (!overviewHost.length || !listHost.length) {
        return;
    }

    activeRecoveryWorkspaceType = resolvedType;
    const backups = getSortedBackupsForType(resolvedType);
    const prefs = utils.normalizePrefs(prefsByType[resolvedType]);
    const schedule = prefs.backupSchedule || {};
    const filter = filtersByType[resolvedType]?.backups || '';
    const latest = backups[0] || null;
    const title = resolvedType === 'docker' ? 'Docker' : 'VM';

    overviewHost.html(buildRecoveryOverviewHtml(resolvedType));
    listHost.html(buildRecoveryBackupHistoryHtml(resolvedType));
    filterInput.val(filter);
    safetyNote.text(latest
        ? `Latest ${title} snapshot: ${formatTimestamp(latest.createdAt || '')}. A safety backup is created automatically before restore.`
        : `No ${title} backup exists yet. Create one now so you have a rollback point before bigger changes.`);
    policySummary.text(schedule.enabled === true
        ? `Every ${schedule.intervalHours || 24}h, keep ${schedule.retention || 25}, ${schedule.lastRunAt ? `last run ${formatTimestamp(schedule.lastRunAt)}` : 'waiting for first run'}.`
        : 'Manual backups only. Enable the scheduler to keep automatic recovery points.');
    syncVisibleRecoveryCompareControls(resolvedType);
    window.FolderViewPlusDiagnostics?.renderRecoveryChangeHistoryFromDiagnostics?.();
};

const syncRecoveryWorkspaceUi = () => {
    const activeType = normalizeRecoveryWorkspaceType(activeRecoveryWorkspaceType);
    document.querySelectorAll('[data-fv-recovery-source-toggle]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        const buttonType = normalizeRecoveryWorkspaceType(button.getAttribute('data-fv-recovery-source-toggle'));
        const isActive = buttonType === activeType;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    renderRecoveryWorkspace(activeType);
};

const setRecoveryWorkspaceType = (type, persist = true) => {
    activeRecoveryWorkspaceType = normalizeRecoveryWorkspaceType(type);
    if (persist) {
        writeSettingsStorage(RECOVERY_WORKSPACE_STORAGE_KEY, activeRecoveryWorkspaceType, { delayMs: 60, idle: true });
    }
    syncRecoveryWorkspaceUi();
};

const filterActiveRecoveryBackups = (value = '') => {
    const resolvedType = getActiveRecoveryWorkspaceType();
    const displayValue = String(value || '');
    if (!filtersByType[resolvedType]) {
        filtersByType[resolvedType] = {
            folders: '',
            rules: '',
            backups: '',
            templates: '',
            bulk: ''
        };
    }
    filtersByType[resolvedType].backups = normalizedFilter(displayValue);
    persistTableUiState();
    renderBackupRows(resolvedType);
};

const createActiveRecoveryBackup = () => createManualBackup(getActiveRecoveryWorkspaceType());

const restoreLatestActiveRecoveryBackup = () => restoreLatestBackup(getActiveRecoveryWorkspaceType());

const runActiveRecoveryScheduler = () => runScheduledBackupNow(getActiveRecoveryWorkspaceType());

const compareActiveRecoverySnapshots = () => {
    const resolvedType = getActiveRecoveryWorkspaceType();
    syncHiddenRecoveryCompareControls(resolvedType);
    compareBackupSnapshots(resolvedType);
};

const changeActiveBackupSchedulePref = (key, value) => (
    changeBackupSchedulePref(getActiveRecoveryWorkspaceType(), key, value)
);

const undoActiveRecoveryChange = () => undoLatestChange(getActiveRecoveryWorkspaceType());

const syncRulesWorkspaceUi = () => {
    const activeType = normalizeRulesWorkspaceType(activeRulesWorkspaceType);
    document.querySelectorAll('[data-fv-rules-source-toggle]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        const buttonType = normalizeRulesWorkspaceType(button.getAttribute('data-fv-rules-source-toggle'));
        const isActive = buttonType === activeType;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    document.querySelectorAll('.fv-rules-workspace[data-fv-rules-type], .fv-rule-troubleshoot-panel[data-fv-rules-type]').forEach((panel) => {
        if (!(panel instanceof HTMLElement)) {
            return;
        }
        const panelType = normalizeRulesWorkspaceType(panel.getAttribute('data-fv-rules-type'));
        const isActive = panelType === activeType;
        panel.hidden = !isActive;
        panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    });
};

const setRulesWorkspaceType = (type, persist = true) => {
    activeRulesWorkspaceType = normalizeRulesWorkspaceType(type);
    if (persist) {
        writeSettingsStorage(RULES_WORKSPACE_STORAGE_KEY, activeRulesWorkspaceType, { delayMs: 60, idle: true });
    }
    syncRulesWorkspaceUi();
    renderRulesTable(activeRulesWorkspaceType);
    updateRuleLiveMatch(activeRulesWorkspaceType);
    updateRuleValidationHint(activeRulesWorkspaceType);
};

const normalizeHealthSeverityFilterMode = (mode) => {
    const normalized = String(mode || '').trim().toLowerCase();
    if (normalized === 'good' || normalized === 'maintenance' || normalized === 'warn' || normalized === 'critical' || normalized === 'empty') {
        return normalized;
    }
    return 'all';
};

const getHealthSeverityFilterLabel = (mode) => {
    if (mode === 'good') {
        return 'good health';
    }
    if (mode === 'maintenance') {
        return 'maintenance health';
    }
    if (mode === 'warn') {
        return 'warn health';
    }
    if (mode === 'critical') {
        return 'critical health';
    }
    if (mode === 'empty') {
        return 'empty health';
    }
    return 'all health';
};

const HEALTH_PROFILE_DEFAULTS = Object.freeze({
    strict: Object.freeze({
        warnStoppedPercent: 45,
        criticalStoppedPercent: 75,
        updatesMode: 'warn',
        allStoppedMode: 'critical'
    }),
    balanced: Object.freeze({
        warnStoppedPercent: 60,
        criticalStoppedPercent: 90,
        updatesMode: 'maintenance',
        allStoppedMode: 'critical'
    }),
    lenient: Object.freeze({
        warnStoppedPercent: 75,
        criticalStoppedPercent: 95,
        updatesMode: 'maintenance',
        allStoppedMode: 'warn'
    })
});

const HEALTH_REASON_META = Object.freeze({
    EMPTY_FOLDER: Object.freeze({ label: 'Empty folder' }),
    HEALTHY: Object.freeze({ label: 'Healthy runtime' }),
    ALL_STOPPED: Object.freeze({ label: 'All members stopped' }),
    STOPPED_PERCENT_WARN: Object.freeze({ label: 'Stopped ratio over warn threshold' }),
    STOPPED_PERCENT_CRITICAL: Object.freeze({ label: 'Stopped ratio over critical threshold' }),
    PAUSED_MEMBERS: Object.freeze({ label: 'Paused members detected' }),
    UPDATES_PENDING: Object.freeze({ label: 'Updates pending' }),
    UPDATE_SURGE: Object.freeze({ label: 'Large update backlog' })
});

const normalizeHealthProfile = (value, fallback = 'balanced') => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'strict' || normalized === 'balanced' || normalized === 'lenient') {
        return normalized;
    }
    return fallback;
};

const normalizeHealthUpdatesMode = (value, fallback = 'maintenance') => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'maintenance' || normalized === 'warn' || normalized === 'ignore') {
        return normalized;
    }
    return fallback;
};

const normalizeHealthAllStoppedMode = (value, fallback = 'critical') => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'critical' || normalized === 'warn') {
        return normalized;
    }
    return fallback;
};

const resolveFolderHealthPolicy = (folder, fallbackThreshold) => {
    const globalHealthPrefs = normalizeHealthPrefs('docker');
    const globalProfile = normalizeHealthProfile(globalHealthPrefs.profile, 'balanced');
    const globalDefaults = HEALTH_PROFILE_DEFAULTS[globalProfile] || HEALTH_PROFILE_DEFAULTS.balanced;
    const settings = (folder && typeof folder.settings === 'object' && folder.settings !== null)
        ? folder.settings
        : {};

    const folderProfileRaw = String(settings.health_profile || '').trim();
    const hasFolderProfile = folderProfileRaw !== '';
    const folderProfile = hasFolderProfile
        ? normalizeHealthProfile(folderProfileRaw, globalProfile)
        : globalProfile;
    const profileDefaults = hasFolderProfile
        ? (HEALTH_PROFILE_DEFAULTS[folderProfile] || globalDefaults)
        : globalDefaults;

    const fallbackWarn = Number.isFinite(Number(fallbackThreshold))
        ? Math.min(100, Math.max(0, Math.round(Number(fallbackThreshold))))
        : Number(globalHealthPrefs.warnStoppedPercent || profileDefaults.warnStoppedPercent || 60);
    let warnThreshold = fallbackWarn;
    let warnSource = Number.isFinite(Number(fallbackThreshold)) ? 'global-warn' : 'profile';

    const warnRaw = settings.health_warn_stopped_percent;
    if (!(warnRaw === '' || warnRaw === null || warnRaw === undefined)) {
        const parsedWarn = Number(warnRaw);
        if (Number.isFinite(parsedWarn)) {
            warnThreshold = Math.min(100, Math.max(0, Math.round(parsedWarn)));
            warnSource = 'folder-warn';
        }
    }

    let criticalThreshold = Number(globalHealthPrefs.criticalStoppedPercent || profileDefaults.criticalStoppedPercent || 90);
    let criticalSource = Number(globalHealthPrefs.criticalStoppedPercent) ? 'global-critical' : 'profile';
    const criticalRaw = settings.health_critical_stopped_percent;
    if (!(criticalRaw === '' || criticalRaw === null || criticalRaw === undefined)) {
        const parsedCritical = Number(criticalRaw);
        if (Number.isFinite(parsedCritical)) {
            criticalThreshold = Math.min(100, Math.max(0, Math.round(parsedCritical)));
            criticalSource = 'folder-critical';
        }
    } else {
        criticalThreshold = Math.min(100, Math.max(0, Math.round(criticalThreshold)));
    }

    let updatesMode = normalizeHealthUpdatesMode(globalHealthPrefs.updatesMode, profileDefaults.updatesMode);
    let updatesModeSource = (globalHealthPrefs.updatesMode && String(globalHealthPrefs.updatesMode).trim() !== '')
        ? 'global-updates'
        : 'profile';
    const updatesModeRaw = String(settings.health_updates_mode || '').trim();
    if (updatesModeRaw !== '') {
        updatesMode = normalizeHealthUpdatesMode(updatesModeRaw, updatesMode);
        updatesModeSource = 'folder-updates';
    }

    let allStoppedMode = normalizeHealthAllStoppedMode(globalHealthPrefs.allStoppedMode, profileDefaults.allStoppedMode);
    let allStoppedModeSource = (globalHealthPrefs.allStoppedMode && String(globalHealthPrefs.allStoppedMode).trim() !== '')
        ? 'global-all-stopped'
        : 'profile';
    const allStoppedModeRaw = String(settings.health_all_stopped_mode || '').trim();
    if (allStoppedModeRaw !== '') {
        allStoppedMode = normalizeHealthAllStoppedMode(allStoppedModeRaw, allStoppedMode);
        allStoppedModeSource = 'folder-all-stopped';
    }

    criticalThreshold = Math.min(100, Math.max(0, Math.round(criticalThreshold)));
    if (criticalThreshold < warnThreshold + 5) {
        criticalThreshold = Math.min(100, warnThreshold + 5);
        criticalSource = 'auto-adjust';
    }

    return {
        profile: folderProfile,
        warnThreshold,
        warnSource,
        criticalThreshold,
        criticalSource,
        updatesMode,
        updatesModeSource,
        allStoppedMode,
        allStoppedModeSource
    };
};

const makeHealthReason = (code, message, severity = 'info') => ({
    code,
    label: String(HEALTH_REASON_META?.[code]?.label || code),
    message,
    severity
});

const evaluateDockerFolderHealth = (folder, members, countsByState, updateCount, fallbackWarnThreshold) => {
    const totalMembers = Number(members) || 0;
    const started = Number(countsByState?.started || 0);
    const paused = Number(countsByState?.paused || 0);
    const stopped = Number(countsByState?.stopped || 0);
    const policy = resolveFolderHealthPolicy(folder, fallbackWarnThreshold);
    const warnThreshold = policy.warnThreshold;
    const criticalThreshold = policy.criticalThreshold;
    if (totalMembers === 0) {
        return {
            severity: 'empty',
            filterSeverity: 'empty',
            text: 'Empty',
            className: 'is-empty',
            isAlert: false,
            score: 100,
            isMaintenance: false,
            reasons: [
                makeHealthReason('EMPTY_FOLDER', 'No members in this folder.', 'info')
            ],
            policy,
            details: [
                'Score: 100/100.',
                'No members in this folder.',
                `Policy: ${policy.profile} profile (${warnThreshold}% warn, ${criticalThreshold}% critical).`
            ]
        };
    }

    const stoppedPercent = Math.round((stopped / totalMembers) * 100);
    const allStopped = started === 0 && paused === 0 && stopped > 0;
    const hasUpdates = updateCount > 0;
    const allStoppedCritical = allStopped && policy.allStoppedMode === 'critical';
    const allStoppedWarn = allStopped && policy.allStoppedMode === 'warn';
    const stoppedCritical = stoppedPercent >= criticalThreshold;
    const stoppedWarn = stoppedPercent >= warnThreshold;
    const updateWarn = hasUpdates && policy.updatesMode === 'warn';
    const updateMaintenance = hasUpdates && policy.updatesMode === 'maintenance';
    const updateCritical = updateWarn && updateCount >= 10;

    let severity = 'good';
    if (allStoppedCritical || stoppedCritical || updateCritical) {
        severity = 'critical';
    } else if (allStoppedWarn || stoppedWarn || paused > 0 || updateWarn || updateMaintenance) {
        severity = 'warn';
    }
    const maintenanceOnly = severity === 'warn' && updateMaintenance && !allStoppedWarn && !allStoppedCritical && !stoppedWarn && !stoppedCritical && paused <= 0;
    const filterSeverity = maintenanceOnly ? 'maintenance' : severity;

    const reasons = [];
    if (allStopped) {
        reasons.push(makeHealthReason(
            'ALL_STOPPED',
            `All ${stopped}/${totalMembers} members are stopped.`,
            allStoppedCritical ? 'critical' : 'warning'
        ));
    }
    if (stoppedCritical) {
        reasons.push(makeHealthReason(
            'STOPPED_PERCENT_CRITICAL',
            `Stopped percentage ${stoppedPercent}% is above critical threshold ${criticalThreshold}%.`,
            'critical'
        ));
    } else if (stoppedWarn) {
        reasons.push(makeHealthReason(
            'STOPPED_PERCENT_WARN',
            `Stopped percentage ${stoppedPercent}% is above warn threshold ${warnThreshold}%.`,
            'warning'
        ));
    }
    if (paused > 0) {
        reasons.push(makeHealthReason(
            'PAUSED_MEMBERS',
            `${paused} member${paused === 1 ? '' : 's'} paused.`,
            'warning'
        ));
    }
    if (hasUpdates && policy.updatesMode !== 'ignore') {
        reasons.push(makeHealthReason(
            updateCount >= 10 ? 'UPDATE_SURGE' : 'UPDATES_PENDING',
            `${updateCount} update${updateCount === 1 ? '' : 's'} available.`,
            updateMaintenance ? 'maintenance' : (updateCritical ? 'critical' : 'warning')
        ));
    }
    if (!reasons.length) {
        reasons.push(makeHealthReason(
            'HEALTHY',
            'No health issues detected.',
            'success'
        ));
    }

    let scorePenalty = 0;
    if (stoppedPercent > 0) {
        if (stoppedPercent >= warnThreshold) {
            const range = Math.max(1, 100 - warnThreshold);
            scorePenalty += 18 + Math.round(((stoppedPercent - warnThreshold) / range) * 42);
        } else {
            scorePenalty += Math.round((stoppedPercent / Math.max(1, warnThreshold)) * 18);
        }
    }
    if (paused > 0) {
        scorePenalty += Math.min(20, 2 + Math.round((paused / totalMembers) * 30));
    }
    if (hasUpdates && policy.updatesMode !== 'ignore') {
        const updatePenaltyBase = policy.updatesMode === 'warn' ? 4 : 2;
        const updatePenaltyCap = policy.updatesMode === 'warn' ? 34 : 18;
        scorePenalty += Math.min(updatePenaltyCap, updateCount * updatePenaltyBase);
    }
    if (allStopped) {
        scorePenalty += policy.allStoppedMode === 'critical' ? 40 : 24;
    }
    if (stoppedCritical) {
        scorePenalty += 18;
    }
    if (updateCritical) {
        scorePenalty += 16;
    }
    const score = Math.max(0, Math.min(100, 100 - scorePenalty));

    const details = [
        `Score: ${score}/100.`,
        `${started} started, ${paused} paused, ${stopped} stopped (${stoppedPercent}% stopped).`,
        hasUpdates ? `${updateCount} update${updateCount === 1 ? '' : 's'} available.` : 'No updates available.',
        `Policy: ${policy.profile} | updates ${policy.updatesMode} | all-stopped ${policy.allStoppedMode}.`,
        `Thresholds: warn ${warnThreshold}% (${policy.warnSource}), critical ${criticalThreshold}% (${policy.criticalSource}).`,
        ...reasons.map((reason) => `${reason.label}: ${reason.message}`)
    ];

    let text = 'Healthy';
    let className = 'is-ok';
    if (severity === 'critical') {
        text = 'Critical';
        className = 'is-danger';
    } else if (maintenanceOnly) {
        text = 'Maintenance';
        className = 'is-maintenance';
    } else if (severity === 'warn') {
        text = 'Degraded';
        className = 'is-warning';
    }
    return {
        severity,
        filterSeverity,
        text,
        className,
        isAlert: severity === 'critical' || (severity === 'warn' && !maintenanceOnly),
        score,
        isMaintenance: maintenanceOnly,
        reasons,
        policy,
        details
    };
};

const toggleDockerUpdatesFilter = (hasUpdatesInRow = false) => {
    if (dockerUpdatesOnlyFilter) {
        dockerUpdatesOnlyFilter = false;
        persistTableUiState();
        renderTable('docker');
        return;
    }
    if (hasUpdatesInRow) {
        dockerUpdatesOnlyFilter = true;
        persistTableUiState();
        renderTable('docker');
        return;
    }
    swal({
        title: 'No updates in this folder',
        text: 'Choose a folder with updates to enable the updates-only filter.',
        type: 'info'
    });
};

const toggleHealthSeverityFilter = (type = 'docker', severity = 'all') => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const target = normalizeHealthSeverityFilterMode(severity);
    const current = normalizeHealthSeverityFilterMode(healthSeverityFilterByType[resolvedType]);
    healthSeverityFilterByType[resolvedType] = current === target ? 'all' : target;
    persistTableUiState();
    renderTable(resolvedType);
};

const toggleStatusFilter = (type = 'docker', statusKey = 'all') => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const target = normalizeStatusFilterMode(statusKey);
    const current = normalizeStatusFilterMode(statusFilterByType[resolvedType]);
    statusFilterByType[resolvedType] = current === target ? 'all' : target;
    persistTableUiState();
    renderTable(resolvedType);
};

const clearFolderTableFilters = (type = 'docker') => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    if (filtersByType[resolvedType]) {
        filtersByType[resolvedType].folders = '';
        $(`#${resolvedType}-folder-filter`).val('');
    }
    healthFilterByType[resolvedType] = 'all';
    healthSeverityFilterByType[resolvedType] = 'all';
    statusFilterByType[resolvedType] = 'all';
    quickFolderFilterByType[resolvedType] = 'all';
    if (resolvedType === 'docker') {
        dockerUpdatesOnlyFilter = false;
    }
    persistTableUiState();
    renderQuickFolderFilters(resolvedType);
    renderTable(resolvedType);
};

const recordFatalBannerRequestResult = (method, url, source, outcome, error = null) => {
    const message = trimFatalBannerDiagnosticString(error?.message || error);
    recordFatalBannerRequest({
        method,
        url,
        outcome,
        source,
        status: extractFatalBannerStatus(error),
        traceId: extractFatalBannerTraceId(error),
        category: error ? inferFatalBannerCategory(error, 'request-failed') : 'ok',
        detail: message,
        responseSnippet: extractFatalBannerResponseSnippet(error)
    });
};

const apiGetText = async (url, options = {}) => {
    try {
        if (requestClient && typeof requestClient.getText === 'function') {
            const response = await requestClient.getText(url, options);
            recordFatalBannerRequestResult('GET', url, 'apiGetText', 'ok');
            return response;
        }
        const response = await $.get(url, options?.data).promise();
        recordFatalBannerRequestResult('GET', url, 'apiGetText', 'ok');
        return response;
    } catch (error) {
        annotateFatalBannerError(error, {
            phase: 'request',
            category: inferFatalBannerCategory(error, 'request-failed'),
            action: `GET ${url}`
        });
        recordFatalBannerRequestResult('GET', url, 'apiGetText', 'error', error);
        recordRequestErrorTelemetry('GET', url, error, {
            source: 'apiGetText',
            retries: options?.retries,
            timeoutMs: options?.timeoutMs
        });
        throw error;
    }
};

const buildMutationRequestPayload = (data = {}) => {
    const token = getOptionalRequestToken();
    if (typeof FormData !== 'undefined' && data instanceof FormData) {
        if (!data.has('_fv_request')) {
            data.append('_fv_request', '1');
        }
        if (token && !data.has('token')) {
            data.append('token', token);
        }
        return data;
    }
    if (typeof URLSearchParams !== 'undefined' && data instanceof URLSearchParams) {
        if (!data.has('_fv_request')) {
            data.set('_fv_request', '1');
        }
        if (token && !data.has('token')) {
            data.set('token', token);
        }
        return data;
    }
    const payload = data && typeof data === 'object' ? { ...data } : {};
    if (!Object.prototype.hasOwnProperty.call(payload, '_fv_request')) {
        payload._fv_request = '1';
    }
    if (token && !Object.prototype.hasOwnProperty.call(payload, 'token')) {
        payload.token = token;
    }
    return payload;
};

const apiPostText = async (url, data = {}, options = {}) => {
    try {
        if (requestClient && typeof requestClient.postText === 'function') {
            const response = await requestClient.postText(url, data, options);
            recordFatalBannerRequestResult('POST', url, 'apiPostText', 'ok');
            return response;
        }
        const response = await $.post(url, buildMutationRequestPayload(data)).promise();
        recordFatalBannerRequestResult('POST', url, 'apiPostText', 'ok');
        return response;
    } catch (error) {
        annotateFatalBannerError(error, {
            phase: 'request',
            category: inferFatalBannerCategory(error, 'request-failed'),
            action: `POST ${url}`
        });
        recordFatalBannerRequestResult('POST', url, 'apiPostText', 'error', error);
        recordRequestErrorTelemetry('POST', url, error, {
            source: 'apiPostText',
            retries: options?.retries,
            timeoutMs: options?.timeoutMs
        });
        throw error;
    }
};

const apiGetJson = async (url, options = {}) => {
    try {
        if (requestClient && typeof requestClient.getJson === 'function') {
            const response = await requestClient.getJson(url, options);
            recordFatalBannerRequestResult('GET', url, 'apiGetJson', 'ok');
            return response;
        }
        const response = parseJsonResponse(await $.get(url, options?.data).promise());
        recordFatalBannerRequestResult('GET', url, 'apiGetJson', 'ok');
        return response;
    } catch (error) {
        annotateFatalBannerError(error, {
            phase: 'request',
            category: inferFatalBannerCategory(error, 'request-failed'),
            action: `GET ${url}`
        });
        recordFatalBannerRequestResult('GET', url, 'apiGetJson', 'error', error);
        recordRequestErrorTelemetry('GET', url, error, {
            source: 'apiGetJson',
            retries: options?.retries,
            timeoutMs: options?.timeoutMs
        });
        throw error;
    }
};

const apiPostJson = async (url, data = {}, options = {}) => {
    try {
        if (requestClient && typeof requestClient.postJson === 'function') {
            const response = await requestClient.postJson(url, data, options);
            recordFatalBannerRequestResult('POST', url, 'apiPostJson', 'ok');
            return response;
        }
        const response = parseJsonResponse(await $.post(url, buildMutationRequestPayload(data)).promise());
        recordFatalBannerRequestResult('POST', url, 'apiPostJson', 'ok');
        return response;
    } catch (error) {
        annotateFatalBannerError(error, {
            phase: 'request',
            category: inferFatalBannerCategory(error, 'request-failed'),
            action: `POST ${url}`
        });
        recordFatalBannerRequestResult('POST', url, 'apiPostJson', 'error', error);
        recordRequestErrorTelemetry('POST', url, error, {
            source: 'apiPostJson',
            retries: options?.retries,
            timeoutMs: options?.timeoutMs
        });
        throw error;
    }
};

const fetchPluginVersion = async () => {
    try {
        setFatalBannerPhase('version-fetch');
        recordFatalBannerAction('Fetch plugin version');
        pluginVersion = String(await apiGetText('/plugins/folderview.plus/server/version.php')).trim() || '0.0.0';
        setFatalBannerEnvironment({
            pluginVersion
        });
        markFatalBannerStep('Loaded plugin version');
    } catch (error) {
        annotateFatalBannerError(error, {
            phase: 'version-fetch',
            category: inferFatalBannerCategory(error, 'request-failed'),
            action: 'Fetch plugin version'
        });
        pluginVersion = '0.0.0';
        setFatalBannerEnvironment({
            pluginVersion
        });
    }
};

const fetchCurrentUpdateNotes = async () => apiGetJson('/plugins/folderview.plus/server/update_notes.php');
const UPDATE_NOTES_CATEGORY_META = {
    feature: {
        label: 'Feature Update',
        headline: 'This update includes new features and enhancements.',
        className: 'is-feature'
    },
    bugfix: {
        label: 'Bug Fix Update',
        headline: 'This update includes bug fixes and quality improvements.',
        className: 'is-bugfix'
    },
    security: {
        label: 'Security Update',
        headline: 'This update includes security hardening and safety improvements.',
        className: 'is-security'
    },
    performance: {
        label: 'Performance Update',
        headline: 'This update includes performance and reliability improvements.',
        className: 'is-performance'
    },
    ui: {
        label: 'UI/UX Update',
        headline: 'This update includes UI and usability improvements.',
        className: 'is-ui'
    },
    maintenance: {
        label: 'Maintenance Update',
        headline: 'This update includes maintenance and quality improvements.',
        className: 'is-maintenance'
    },
    mixed: {
        label: 'Mixed Update',
        headline: 'This update includes features, fixes, and quality improvements.',
        className: 'is-mixed'
    }
};

const normalizeUpdateNotesCategoryId = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(UPDATE_NOTES_CATEGORY_META, normalized)
        ? normalized
        : 'bugfix';
};

const getUpdateNotesSeenVersion = () => {
    try {
        return String(localStorage.getItem(UPDATE_NOTES_SEEN_VERSION_STORAGE_KEY) || '').trim();
    } catch (_error) {
        return '';
    }
};

const setUpdateNotesSeenVersion = (version) => {
    try {
        writeSettingsStorage(UPDATE_NOTES_SEEN_VERSION_STORAGE_KEY, String(version || '').trim(), { delayMs: 50, idle: true });
    } catch (_error) {
        // Best effort only.
    }
};

const readConflictStorageValue = (key) => {
    try {
        return String(localStorage.getItem(key) || '').trim();
    } catch (_error) {
        return '';
    }
};

const writeConflictStorageValue = (key, value) => {
    const normalized = String(value || '').trim();
    try {
        if (normalized) {
            writeSettingsStorage(key, normalized, { delayMs: 50, idle: true });
        } else {
            removeSettingsStorage(key, { delayMs: 40, idle: true });
        }
    } catch (_error) {
        // Best effort only.
    }
};

const parseRuntimeConflictPluginList = (value) => String(value || '')
    .split('|')
    .map((item) => item.trim())
    .filter((item) => item !== '');

const getRuntimeConflictContext = () => {
    const activeBanner = document.querySelector('#fv-settings-root .fv-runtime-conflict-banner');
    if (activeBanner instanceof HTMLElement) {
        const key = String(activeBanner.getAttribute('data-conflict-key') || 'runtime-conflict').trim() || 'runtime-conflict';
        const plugins = parseRuntimeConflictPluginList(activeBanner.getAttribute('data-conflict-plugins') || '');
        return {
            active: true,
            key,
            plugins
        };
    }
    const key = readConflictStorageValue(RUNTIME_CONFLICT_ACTIVE_STORAGE_KEY);
    return {
        active: key !== '',
        key,
        plugins: parseRuntimeConflictPluginList(key)
    };
};

const showRuntimeConflictBlockedDialog = (actionLabel = 'This action') => {
    const conflict = getRuntimeConflictContext();
    const pluginText = conflict.plugins.length
        ? conflict.plugins.join(', ')
        : 'another Folder View runtime plugin';
    const label = String(actionLabel || 'This action').trim() || 'This action';
    swal({
        title: 'Safe mode active',
        text: `${label} is blocked while a conflicting Folder View plugin is installed.\n\nConflicting plugin(s): ${pluginText}\n\nKeep FolderView Plus installed, remove only the conflicting plugin, then refresh.`,
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Open Plugins',
        cancelButtonText: 'Close'
    }, (confirmed) => {
        if (confirmed) {
            window.location.href = '/Plugins';
        }
    });
};

const ensureRuntimeConflictActionAllowed = (actionLabel = 'This action') => {
    if (!getRuntimeConflictContext().active) {
        return true;
    }
    showRuntimeConflictBlockedDialog(actionLabel);
    return false;
};

const RUNTIME_CONFLICT_BLOCK_ERROR = 'Safe mode active: remove the conflicting plugin and refresh before applying changes.';
const assertRuntimeConflictActionAllowed = (actionLabel = 'This action') => {
    if (!ensureRuntimeConflictActionAllowed(actionLabel)) {
        throw new Error(RUNTIME_CONFLICT_BLOCK_ERROR);
    }
};

const hideConflictResolvedPanel = () => {
    const panel = $('#fv-runtime-resolved-panel');
    if (!panel.length) {
        return;
    }
    panel.hide().empty();
};

const showConflictResolvedPanel = (conflictKey = '') => {
    const panel = $('#fv-runtime-resolved-panel');
    if (!panel.length) {
        return;
    }

    panel.html(`
        <div class="fv-runtime-resolved-head">
            <i class="fa fa-check-circle" aria-hidden="true"></i>
            <h3 class="fv-runtime-resolved-title">Conflict removed. FolderView Plus is active again.</h3>
        </div>
        <p class="fv-runtime-resolved-copy">
            Docker, VMs, and Dashboard folder rendering are now re-enabled.
            Refresh those tabs if they were already open.
        </p>
        <div class="fv-runtime-resolved-actions">
            <button type="button" id="fv-runtime-resolved-dismiss"><i class="fa fa-check"></i> Dismiss</button>
            <a href="${escapeHtml(SUPPORT_THREAD_URL)}" target="_blank" rel="noopener noreferrer">Support Thread</a>
        </div>
    `).show();

    $('#fv-runtime-resolved-dismiss').off('click').on('click', () => {
        if (readConflictStorageValue(RUNTIME_CONFLICT_RESOLVED_PENDING_STORAGE_KEY) === String(conflictKey || '').trim()) {
            writeConflictStorageValue(RUNTIME_CONFLICT_RESOLVED_PENDING_STORAGE_KEY, '');
        } else if (!String(conflictKey || '').trim()) {
            writeConflictStorageValue(RUNTIME_CONFLICT_RESOLVED_PENDING_STORAGE_KEY, '');
        }
        hideConflictResolvedPanel();
    });
};

const syncRuntimeConflictResolutionBanner = () => {
    const activeBanner = document.querySelector('#fv-settings-root .fv-runtime-conflict-banner');
    if (activeBanner) {
        const activeKey = String(activeBanner.getAttribute('data-conflict-key') || 'runtime-conflict').trim() || 'runtime-conflict';
        writeConflictStorageValue(RUNTIME_CONFLICT_ACTIVE_STORAGE_KEY, activeKey);
        writeConflictStorageValue(RUNTIME_CONFLICT_RESOLVED_PENDING_STORAGE_KEY, '');
        hideConflictResolvedPanel();
        return;
    }

    const previousActiveKey = readConflictStorageValue(RUNTIME_CONFLICT_ACTIVE_STORAGE_KEY);
    if (previousActiveKey) {
        writeConflictStorageValue(RUNTIME_CONFLICT_RESOLVED_PENDING_STORAGE_KEY, previousActiveKey);
        writeConflictStorageValue(RUNTIME_CONFLICT_ACTIVE_STORAGE_KEY, '');
    }

    const pendingResolvedKey = readConflictStorageValue(RUNTIME_CONFLICT_RESOLVED_PENDING_STORAGE_KEY);
    if (!pendingResolvedKey) {
        hideConflictResolvedPanel();
        return;
    }
    showConflictResolvedPanel(pendingResolvedKey);
};

const showUpdateNotesPanel = ({
    version,
    sourceVersion = '',
    usedFallback = false,
    category = 'bugfix',
    categoryLabel = '',
    headline = '',
    lines
}) => {
    const panel = $('#fv-update-notes-panel');
    if (!panel.length) {
        return;
    }

    const categoryId = normalizeUpdateNotesCategoryId(category);
    const categoryMeta = UPDATE_NOTES_CATEGORY_META[categoryId] || UPDATE_NOTES_CATEGORY_META.bugfix;
    const resolvedCategoryLabel = String(categoryLabel || '').trim() || categoryMeta.label;
    const resolvedHeadline = String(headline || '').trim() || categoryMeta.headline;
    const normalizedSourceVersion = String(sourceVersion || '').trim();
    const fallbackNote = (
        usedFallback === true
        && normalizedSourceVersion !== ''
        && normalizedSourceVersion !== String(version || '').trim()
    )
        ? `Showing latest available changelog entry (${normalizedSourceVersion}) because notes for ${version} were not found on this install.`
        : '';

    const normalizedLines = Array.isArray(lines)
        ? lines
            .map((line) => String(line || '').trim())
            .filter((line) => line !== '' && line !== '...')
            .map((line) => line.replace(/^[-*]\s*/, ''))
        : [];
    const listHtml = normalizedLines.length
        ? normalizedLines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')
        : `<li>${escapeHtml(resolvedHeadline)}</li>`;
    const fallbackHtml = fallbackNote
        ? `<div class="fv-update-notes-source">${escapeHtml(fallbackNote)}</div>`
        : '';

    panel.html(`
        <div class="fv-update-notes-head">
            <div class="fv-update-notes-title-wrap">
                <span class="fv-update-notes-kicker">What changed</span>
                <h3>FolderView Plus ${escapeHtml(version)}</h3>
            </div>
            <div class="fv-update-notes-actions">
                <button type="button" id="fv-update-notes-open-changelog"><i class="fa fa-external-link"></i> Changelog</button>
                <button type="button" id="fv-update-notes-hide"><i class="fa fa-times"></i> Hide for now</button>
                <button type="button" id="fv-update-notes-dismiss"><i class="fa fa-check"></i> Dismiss</button>
            </div>
        </div>
        <div class="fv-update-notes-summary">
            <span class="fv-update-notes-category ${categoryMeta.className}">${escapeHtml(resolvedCategoryLabel)}</span>
            <div class="fv-update-notes-headline">${escapeHtml(resolvedHeadline)}</div>
            ${fallbackHtml}
        </div>
        <ul class="fv-update-notes-list">${listHtml}</ul>
        <div class="fv-update-notes-foot">This panel remains visible after updates until you click Dismiss.</div>
    `).show();

    $('#fv-update-notes-open-changelog').off('click').on('click', () => {
        const popup = window.open(UPDATE_NOTES_CHANGELOG_URL, '_blank', 'noopener,noreferrer');
        if (popup) {
            popup.opener = null;
        }
    });
    $('#fv-update-notes-hide').off('click').on('click', () => {
        panel.slideUp(120);
    });
    $('#fv-update-notes-dismiss').off('click').on('click', () => {
        setUpdateNotesSeenVersion(version);
        panel.slideUp(120);
    });
};

const maybeShowUpdateNotesPanel = async () => {
    const currentVersion = String(pluginVersion || '').trim();
    if (!currentVersion || currentVersion === '0.0.0') {
        $('#fv-update-notes-panel').hide().empty();
        return;
    }

    const seenVersion = getUpdateNotesSeenVersion();
    if (seenVersion === currentVersion) {
        $('#fv-update-notes-panel').hide().empty();
        return;
    }

    let notes = [];
    let category = 'bugfix';
    let categoryLabel = '';
    let headline = '';
    let sourceVersion = '';
    let usedFallback = false;
    try {
        const response = await fetchCurrentUpdateNotes();
        const lines = Array.isArray(response?.lines)
            ? response.lines.map((line) => String(line || '').trim()).filter((line) => line !== '')
            : [];
        if (lines.length) {
            notes = lines;
        }
        category = normalizeUpdateNotesCategoryId(response?.category);
        categoryLabel = String(response?.categoryLabel || '').trim();
        headline = String(response?.headline || '').trim();
        sourceVersion = String(response?.sourceVersion || '').trim();
        usedFallback = response?.usedFallback === true;
    } catch (_error) {
        // Non-fatal: keep fallback message.
    }
    showUpdateNotesPanel({
        version: currentVersion,
        sourceVersion,
        usedFallback,
        category,
        categoryLabel,
        headline,
        lines: notes
    });
};

const sanitizeTypeMapResponse = (response) => {
    if (!response || typeof response !== 'object' || Array.isArray(response)) {
        return {};
    }
    if (response.ok === false && typeof response.error === 'string') {
        return {};
    }
    return response;
};

const sanitizeTypeInfoMap = (value) => {
    const source = sanitizeTypeMapResponse(value);
    const output = {};
    for (const [name, item] of Object.entries(source)) {
        if (typeof name !== 'string' || !name.trim()) {
            continue;
        }
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            continue;
        }
        output[name] = item;
    }
    return output;
};

const fetchFolders = async (type) => (
    utils.normalizeFolderMap(sanitizeTypeMapResponse(await apiGetJson(`/plugins/folderview.plus/server/read.php?type=${type}`)))
);
const fetchTypeInfo = async (type) => sanitizeTypeInfoMap(await apiGetJson(`/plugins/folderview.plus/server/read_info.php?type=${type}`));

const fetchBackups = async (type) => {
    const resolvedType = normalizeManagedType(type);
    const response = await apiGetJson('/plugins/folderview.plus/server/backup.php', {
        data: {
            type: resolvedType,
            action: 'list'
        }
    });
    if (!response.ok) {
        throw new Error(response.error || 'Failed to fetch backups.');
    }
    return Array.isArray(response.backups) ? response.backups : [];
};

const fetchBackupSnapshot = async (type, name) => {
    const resolvedType = normalizeManagedType(type);
    const response = await apiGetJson('/plugins/folderview.plus/server/backup.php', {
        data: {
            type: resolvedType,
            action: 'read',
            name
        }
    });
    if (!response.ok) {
        throw new Error(response.error || 'Failed to read backup snapshot.');
    }
    return response.snapshot || {};
};

const restoreBackupByName = async (type, name) => {
    const resolvedType = normalizeManagedType(type);
    assertRuntimeConflictActionAllowed(`Restore ${resolvedType === 'docker' ? 'Docker' : 'VM'} backup`);
    const response = await apiPostJson('/plugins/folderview.plus/server/backup.php', {
        type: resolvedType,
        action: 'restore',
        name
    });
    if (!response.ok) {
        throw new Error(response.error || 'Restore failed.');
    }
    return response.restore;
};

const deleteBackupByName = async (type, name) => {
    const resolvedType = normalizeManagedType(type);
    assertRuntimeConflictActionAllowed(`Delete ${resolvedType === 'docker' ? 'Docker' : 'VM'} backup`);
    const response = await apiPostJson('/plugins/folderview.plus/server/backup.php', {
        type: resolvedType,
        action: 'delete',
        name
    });
    if (!response.ok) {
        throw new Error(response.error || 'Delete failed.');
    }
    return Array.isArray(response.backups) ? response.backups : [];
};

const fetchTemplates = async (type) => {
    const response = await apiGetJson('/plugins/folderview.plus/server/templates.php', {
        data: {
            type,
            action: 'list'
        }
    });
    if (!response.ok) {
        throw new Error(response.error || 'Failed to fetch templates.');
    }
    return Array.isArray(response.templates) ? response.templates : [];
};

const createTemplate = async (type, folderId, name) => {
    assertRuntimeConflictActionAllowed(`Create ${type === 'docker' ? 'Docker' : 'VM'} template`);
    const response = await apiPostJson('/plugins/folderview.plus/server/templates.php', {
        type,
        action: 'create',
        folderId,
        name
    });
    if (!response.ok) {
        throw new Error(response.error || 'Template create failed.');
    }
    return Array.isArray(response.templates) ? response.templates : [];
};

const deleteTemplate = async (type, templateId) => {
    assertRuntimeConflictActionAllowed(`Delete ${type === 'docker' ? 'Docker' : 'VM'} template`);
    const response = await apiPostJson('/plugins/folderview.plus/server/templates.php', {
        type,
        action: 'delete',
        templateId
    });
    if (!response.ok) {
        throw new Error(response.error || 'Template delete failed.');
    }
    return Array.isArray(response.templates) ? response.templates : [];
};

const applyTemplate = async (type, templateId, folderId) => {
    assertRuntimeConflictActionAllowed(`Apply ${type === 'docker' ? 'Docker' : 'VM'} template`);
    const response = await apiPostJson('/plugins/folderview.plus/server/templates.php', {
        type,
        action: 'apply',
        templateId,
        folderId
    });
    if (!response.ok) {
        throw new Error(response.error || 'Template apply failed.');
    }
    return response.apply || {};
};

const bulkAssign = async (type, folderId, items) => {
    assertRuntimeConflictActionAllowed(`Bulk assign ${type === 'docker' ? 'Docker' : 'VM'} items`);
    const response = await apiPostJson('/plugins/folderview.plus/server/bulk_assign.php', {
        type,
        folderId,
        items: JSON.stringify(items || [])
    });
    if (!response.ok) {
        throw new Error(response.error || 'Bulk assignment failed.');
    }
    return response.result;
};

const showToastMessage = ({
    title = '',
    message = '',
    level = 'info',
    durationMs = 4200,
    actionLabel = '',
    onAction = null
} = {}) => {
    const host = $('#fv-toast-host');
    if (!host.length) {
        return;
    }
    const toastId = `fv-toast-${Date.now()}-${++toastSerial}`;
    const safeTitle = String(title || '').trim();
    const safeMessage = String(message || '').trim();
    const safeActionLabel = String(actionLabel || '').trim();
    host.append(`
        <div id="${toastId}" class="fv-toast is-${escapeHtml(level)}" role="status">
            <div class="fv-toast-main">
                ${safeTitle ? `<div class="fv-toast-title">${escapeHtml(safeTitle)}</div>` : ''}
                ${safeMessage ? `<div class="fv-toast-message">${escapeHtml(safeMessage)}</div>` : ''}
            </div>
            <div class="fv-toast-actions">
                ${safeActionLabel ? `<button type="button" class="fv-toast-action">${escapeHtml(safeActionLabel)}</button>` : ''}
                <button type="button" class="fv-toast-close" aria-label="Dismiss notification"><i class="fa fa-times"></i></button>
            </div>
        </div>
    `);
    const toast = host.find(`#${toastId}`);
    const removeToast = () => {
        toast.fadeOut(120, () => {
            toast.remove();
        });
    };

    toast.find('.fv-toast-close').off('click.fvtoast').on('click.fvtoast', () => {
        removeToast();
    });
    toast.find('.fv-toast-action').off('click.fvtoast').on('click.fvtoast', async () => {
        if (typeof onAction === 'function') {
            await onAction();
        }
        removeToast();
    });

    if (Number.isFinite(Number(durationMs)) && Number(durationMs) > 0) {
        window.setTimeout(() => {
            removeToast();
        }, Number(durationMs));
    }
};

const formatTimestamp = (isoString) => {
    if (!isoString) {
        return 'Unknown';
    }
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
        return String(isoString);
    }
    return date.toLocaleString();
};

const buildModuleEmptyTableRow = (title, help, colspan = 1) => (
    `<tr><td colspan="${Number(colspan) || 1}" class="module-empty-note"><div class="module-empty-title">${escapeHtml(title || 'No data available.')}</div>${help ? `<div class="module-empty-help">${escapeHtml(help)}</div>` : ''}</td></tr>`
);

const normalizeFocusableFolderId = (type, folderId) => {
    try {
        const resolvedType = normalizeManagedType(type);
        const resolvedId = String(folderId || '').trim();
        if (!resolvedId) {
            return null;
        }
        return {
            type: resolvedType,
            id: resolvedId
        };
    } catch (_error) {
        return null;
    }
};

const expandAncestorChainForFolder = (type, folderId) => {
    const target = normalizeFocusableFolderId(type, folderId);
    if (!target) {
        return false;
    }
    const folders = getFolderMap(target.type);
    if (!Object.prototype.hasOwnProperty.call(folders, target.id)) {
        return false;
    }
    const hierarchyMeta = buildFolderHierarchyMeta(folders);
    const collapsed = syncCollapsedTreeParentsForType(target.type, folders, hierarchyMeta);
    if (collapsed.size <= 0) {
        return false;
    }
    let changed = false;
    const visited = new Set([target.id]);
    let cursor = String(hierarchyMeta.parentById?.[target.id] || '').trim();
    while (cursor) {
        if (collapsed.has(cursor)) {
            collapsed.delete(cursor);
            changed = true;
        }
        if (visited.has(cursor)) {
            break;
        }
        visited.add(cursor);
        cursor = String(hierarchyMeta.parentById?.[cursor] || '').trim();
    }
    if (changed) {
        collapsedTreeParentsByType[target.type] = collapsed;
        persistTableUiState();
        renderTable(target.type);
    }
    return changed;
};

const focusFolderRow = (type, folderId) => {
    const target = normalizeFocusableFolderId(type, folderId);
    if (!target) {
        return false;
    }
    expandAncestorChainForFolder(target.type, target.id);
    const tbodyId = tableIdByType[target.type];
    const row = $(`tbody#${tbodyId} tr[data-folder-id]`).filter((_, element) => (
        String($(element).attr('data-folder-id') || '') === target.id
    )).first();
    if (!row.length) {
        return false;
    }
    updateMobileTreePathHint(target.type, target.id);

    const tbody = row.closest('tbody');
    tbody.find('tr.fv-row-focus').removeClass('fv-row-focus');
    row.addClass('fv-row-focus');
    if (rowFocusTimersByType[target.type]) {
        window.clearTimeout(rowFocusTimersByType[target.type]);
    }
    rowFocusTimersByType[target.type] = window.setTimeout(() => {
        row.removeClass('fv-row-focus');
        rowFocusTimersByType[target.type] = null;
    }, ROW_FOCUS_HIGHLIGHT_MS);

    const element = row.get(0);
    if (element && typeof element.scrollIntoView === 'function') {
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }
    return true;
};

const showActionSummaryToast = ({
    title = 'Action complete',
    message = '',
    level = 'success',
    type = null,
    focusFolderId = '',
    durationMs = 4200
} = {}) => {
    const target = normalizeFocusableFolderId(type, focusFolderId);
    showToastMessage({
        title,
        message,
        level,
        durationMs,
        actionLabel: target ? 'Focus folder' : '',
        onAction: () => {
            if (!target) {
                return;
            }
            if (!focusFolderRow(target.type, target.id)) {
                showToastMessage({
                    title: 'Folder not visible',
                    message: 'Clear filters or refresh to locate this folder row.',
                    level: 'warning',
                    durationMs: 2600
                });
            }
        }
    });
};

const resolveFolderIdsByNames = (type, names = []) => {
    let resolvedType;
    try {
        resolvedType = normalizeManagedType(type);
    } catch (_error) {
        return [];
    }
    const folderMap = getFolderMap(resolvedType);
    const entries = Object.entries(folderMap || {});
    if (!entries.length || !Array.isArray(names) || names.length === 0) {
        return [];
    }
    const usedIds = new Set();
    const results = [];
    names.forEach((rawName) => {
        const expected = String(rawName || '').trim().toLowerCase();
        if (!expected) {
            return;
        }
        const match = entries.find(([id, folder]) => {
            if (usedIds.has(id)) {
                return false;
            }
            return String(folder?.name || '').trim().toLowerCase() === expected;
        });
        if (!match) {
            return;
        }
        usedIds.add(match[0]);
        results.push(String(match[0]));
    });
    return results;
};

const resolveAffectedFolderIdsFromOperations = (type, operations = null) => {
    let resolvedType;
    try {
        resolvedType = normalizeManagedType(type);
    } catch (_error) {
        return [];
    }
    const op = operations && typeof operations === 'object' ? operations : {};
    const seen = new Set();
    const ids = [];
    const addId = (value) => {
        const id = String(value || '').trim();
        if (!id || seen.has(id)) {
            return;
        }
        seen.add(id);
        ids.push(id);
    };
    const upserts = Array.isArray(op.upserts) ? op.upserts : [];
    upserts.forEach((item) => addId(item?.id));

    const creates = Array.isArray(op.creates) ? op.creates : [];
    const createdNames = creates.map((item) => String(item?.folder?.name || '').trim()).filter(Boolean);
    resolveFolderIdsByNames(resolvedType, createdNames).forEach((id) => addId(id));
    return ids;
};

const describeTrackedEvent = (eventType, type, details = {}) => {
    const kind = String(eventType || '').trim();
    const scope = type === 'vm' ? 'VM' : (type === 'docker' ? 'Docker' : 'Plugin');
    if (kind === 'export') {
        return `${scope} export generated`;
    }
    if (kind === 'import') {
        return `${scope} import applied (${details.creates || 0} create, ${details.updates || 0} update, ${details.deletes || 0} delete)`;
    }
    if (kind === 'import_dry_run') {
        return `${scope} import dry run completed`;
    }
    if (kind === 'delete_folder') {
        return `${scope} folder deleted`;
    }
    if (kind === 'clear_folders') {
        return `${scope} folders cleared`;
    }
    if (kind === 'runtime_bulk_action') {
        return `${scope} runtime action "${details.action || 'apply'}" completed`;
    }
    if (kind === 'bulk_assign') {
        return `${scope} bulk assignment completed`;
    }
    if (kind === 'rule_simulator') {
        return `${scope} rule simulator completed`;
    }
    if (kind === 'diagnostics_export') {
        return 'Diagnostics export generated';
    }
    if (kind === 'support_bundle_export') {
        return 'Support bundle exported';
    }
    if (kind === 'conflict_scan') {
        return `${scope} conflict scan completed`;
    }
    return '';
};

const showError = (title, error) => {
    const message = error?.message || String(error);
    const safeTitle = String(title || 'Error');
    recordFatalBannerAction(`Error: ${safeTitle}`);
    annotateFatalBannerError(error, {
        phase: error?.fvplusPhase || 'runtime',
        category: error?.fvplusCategory || inferFatalBannerCategory(error, 'runtime-failed'),
        action: error?.fvplusAction || safeTitle
    });
    addActivityEntry(`${String(title || 'Error')}: ${message}`, 'error');
    showToastMessage({
        title: safeTitle,
        message,
        level: 'error',
        durationMs: 7000
    });
    swal({
        title,
        text: message,
        type: 'error'
    });
};

const setImportantStyle = (element, property, value) => {
    if (!element || !element.style || typeof element.style.setProperty !== 'function') {
        return;
    }
    element.style.setProperty(property, value, 'important');
};

const enforceNoHorizontalOverflow = () => {
    const rootTargets = [
        document.documentElement,
        document.body,
        document.querySelector('.canvas'),
        document.querySelector('#content'),
        document.querySelector('#canvas')
    ].filter(Boolean);

    for (const target of rootTargets) {
        setImportantStyle(target, 'overflow-x', 'hidden');
    }

    const compact = shouldUseCompactMobileLayout();
    const tableTargets = document.querySelectorAll('.folder-table .table-wrap');
    tableTargets.forEach((target) => {
        setImportantStyle(target, 'max-width', '100%');
        setImportantStyle(target, 'min-width', '0');
        setImportantStyle(target, 'overflow-x', compact ? 'hidden' : 'auto');
        setImportantStyle(target, 'overflow-y', 'visible');
    });
};

const initOverflowGuard = () => {
    if (overflowGuardBound) {
        enforceNoHorizontalOverflow();
        return;
    }
    overflowGuardBound = true;
    enforceNoHorizontalOverflow();
    window.addEventListener('resize', enforceNoHorizontalOverflow);
    const observer = new MutationObserver(() => {
        enforceNoHorizontalOverflow();
    });
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
};

// folderviewplus.import.js provides import/backup workflow helpers.

const treeUndoBannerSelectorByType = Object.freeze({
    docker: '#docker-tree-undo-banner',
    vm: '#vm-tree-undo-banner'
});

const getTreeMoveHistoryState = (type) => {
    const resolvedType = normalizeManagedType(type);
    const state = treeMoveHistoryByType[resolvedType];
    if (!state || typeof state !== 'object') {
        treeMoveHistoryByType[resolvedType] = {
            undoStack: [],
            redoStack: []
        };
    }
    return treeMoveHistoryByType[resolvedType];
};

const pushTreeMoveHistoryEntry = (type, entry) => {
    const resolvedType = normalizeManagedType(type);
    const state = getTreeMoveHistoryState(resolvedType);
    const beforeBackupName = String(entry?.beforeBackupName || '').trim();
    const afterBackupName = String(entry?.afterBackupName || '').trim();
    if (!beforeBackupName || !afterBackupName) {
        return;
    }
    const nextEntry = {
        beforeBackupName,
        afterBackupName,
        actionLabel: String(entry?.actionLabel || 'Tree move').trim(),
        focusFolderId: String(entry?.focusFolderId || '').trim(),
        createdAt: Date.now()
    };
    state.undoStack.push(nextEntry);
    while (state.undoStack.length > TREE_MOVE_HISTORY_LIMIT) {
        state.undoStack.shift();
    }
    state.redoStack = [];
};

const getTreeMoveHistoryDepth = (type) => {
    const resolvedType = normalizeManagedType(type);
    const state = getTreeMoveHistoryState(resolvedType);
    return {
        undo: Array.isArray(state.undoStack) ? state.undoStack.length : 0,
        redo: Array.isArray(state.redoStack) ? state.redoStack.length : 0
    };
};

const updateTreeMoveHistoryButtons = (type) => {
    const resolvedType = normalizeManagedType(type);
    const depth = getTreeMoveHistoryDepth(resolvedType);
    const undoBtn = $(`#${resolvedType}-tree-history-undo`);
    const redoBtn = $(`#${resolvedType}-tree-history-redo`);
    if (undoBtn.length) {
        undoBtn.prop('disabled', depth.undo <= 0);
        undoBtn.attr('title', depth.undo > 0 ? `Undo last ${depth.undo} tree change(s)` : 'No tree changes to undo');
    }
    if (redoBtn.length) {
        redoBtn.prop('disabled', depth.redo <= 0);
        redoBtn.attr('title', depth.redo > 0 ? `Redo ${depth.redo} tree change(s)` : 'No tree changes to redo');
    }
};

const clearTreeMoveUndoTimer = (type) => {
    const resolvedType = normalizeManagedType(type);
    if (treeMoveUndoTimersByType[resolvedType]) {
        window.clearTimeout(treeMoveUndoTimersByType[resolvedType]);
        treeMoveUndoTimersByType[resolvedType] = null;
    }
};

const dismissTreeMoveUndoBanner = (type) => {
    const resolvedType = normalizeManagedType(type);
    clearTreeMoveUndoTimer(resolvedType);
    treeMoveUndoNoticeByType[resolvedType] = null;
    renderTreeMoveUndoBanner(resolvedType);
};

const renderTreeMoveUndoBanner = (type) => {
    const resolvedType = normalizeManagedType(type);
    const selector = treeUndoBannerSelectorByType[resolvedType];
    const host = selector ? $(selector) : $();
    if (!host.length) {
        updateTreeMoveHistoryButtons(resolvedType);
        return;
    }
    const notice = treeMoveUndoNoticeByType[resolvedType];
    const historyDepth = getTreeMoveHistoryDepth(resolvedType);
    if (!notice || !notice.backupName) {
        host.addClass('is-hidden').empty();
        updateTreeMoveHistoryButtons(resolvedType);
        return;
    }
    const actionLabel = String(notice.actionLabel || 'Tree change').trim();
    const backupName = String(notice.backupName || '').trim();
    const expiresAt = Number(notice.expiresAt || 0);
    const remainingMs = Number.isFinite(expiresAt) ? Math.max(0, expiresAt - Date.now()) : 0;
    if (remainingMs <= 0) {
        dismissTreeMoveUndoBanner(resolvedType);
        return;
    }
    const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
    host
        .removeClass('is-hidden')
        .html(`
            <div class="fv-tree-undo-message">
                <strong>${escapeHtml(actionLabel)} applied.</strong>
                <span>Undo available for ${remainingSeconds}s. History: ${historyDepth.undo} undo / ${historyDepth.redo} redo.</span>
            </div>
            <div class="fv-tree-undo-actions">
                <button type="button" class="fv-tree-undo-btn" data-fv-tree-undo-type="${escapeHtml(resolvedType)}"><i class="fa fa-undo"></i> Undo</button>
                <button type="button" class="fv-tree-redo-btn" data-fv-tree-redo-type="${escapeHtml(resolvedType)}" ${historyDepth.redo > 0 ? '' : 'disabled'}><i class="fa fa-repeat"></i> Redo</button>
                <button type="button" class="fv-tree-undo-dismiss" data-fv-tree-dismiss-type="${escapeHtml(resolvedType)}"><i class="fa fa-times"></i> Dismiss</button>
            </div>
        `);

    host.find('[data-fv-tree-undo-type]')
        .off('click.fvtreeundo')
        .on('click.fvtreeundo', async (event) => {
            event.preventDefault();
            const targetType = String($(event.currentTarget).attr('data-fv-tree-undo-type') || '').trim();
            if (!targetType) {
                return;
            }
            await applyTreeMoveUndo(targetType);
        });
    host.find('[data-fv-tree-redo-type]')
        .off('click.fvtreeundo')
        .on('click.fvtreeundo', async (event) => {
            event.preventDefault();
            const targetType = String($(event.currentTarget).attr('data-fv-tree-redo-type') || '').trim();
            if (!targetType) {
                return;
            }
            await applyTreeMoveRedo(targetType);
        });
    host.find('[data-fv-tree-dismiss-type]')
        .off('click.fvtreeundo')
        .on('click.fvtreeundo', (event) => {
            event.preventDefault();
            const targetType = String($(event.currentTarget).attr('data-fv-tree-dismiss-type') || '').trim();
            if (!targetType) {
                return;
            }
            dismissTreeMoveUndoBanner(targetType);
        });
    host.attr('title', backupName);
    updateTreeMoveHistoryButtons(resolvedType);
};

const queueTreeMoveUndoBanner = (type, backupName, actionLabel, focusFolderId = '') => {
    const resolvedType = normalizeManagedType(type);
    const safeBackupName = String(backupName || '').trim();
    if (!safeBackupName) {
        return;
    }
    clearTreeMoveUndoTimer(resolvedType);
    treeMoveUndoNoticeByType[resolvedType] = {
        backupName: safeBackupName,
        actionLabel: String(actionLabel || 'Tree change').trim(),
        focusFolderId: String(focusFolderId || '').trim(),
        expiresAt: Date.now() + UNDO_WINDOW_MS
    };
    treeMoveUndoTimersByType[resolvedType] = window.setTimeout(() => {
        dismissTreeMoveUndoBanner(resolvedType);
    }, UNDO_WINDOW_MS);
    renderTreeMoveUndoBanner(resolvedType);
};

const recordTreeMoveHistoryFromBackup = async (type, beforeBackupName, actionLabel, focusFolderId = '') => {
    const resolvedType = normalizeManagedType(type);
    const safeBeforeBackupName = String(beforeBackupName || '').trim();
    if (!safeBeforeBackupName) {
        updateTreeMoveHistoryButtons(resolvedType);
        return;
    }
    let afterBackupName = '';
    try {
        const slug = String(actionLabel || 'tree-change')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 32) || 'tree-change';
        const postBackup = await createBackup(resolvedType, `after-${slug}-${Date.now()}`);
        afterBackupName = String(postBackup?.name || '').trim();
    } catch (_error) {
        // Keep undo banner even if post-action snapshot cannot be captured.
    }
    if (afterBackupName) {
        pushTreeMoveHistoryEntry(resolvedType, {
            beforeBackupName: safeBeforeBackupName,
            afterBackupName,
            actionLabel: String(actionLabel || 'Tree change').trim() || 'Tree change',
            focusFolderId
        });
    }
    queueTreeMoveUndoBanner(resolvedType, safeBeforeBackupName, actionLabel, focusFolderId);
    updateTreeMoveHistoryButtons(resolvedType);
};

const applyTreeMoveUndo = async (type) => {
    const resolvedType = normalizeManagedType(type);
    const state = getTreeMoveHistoryState(resolvedType);
    if (!Array.isArray(state.undoStack) || state.undoStack.length <= 0) {
        dismissTreeMoveUndoBanner(resolvedType);
        updateTreeMoveHistoryButtons(resolvedType);
        return;
    }
    const entry = state.undoStack.pop();
    const backupName = String(entry?.beforeBackupName || '').trim();
    const focusFolderId = String(entry?.focusFolderId || '').trim();
    if (!backupName) {
        updateTreeMoveHistoryButtons(resolvedType);
        return;
    }
    try {
        await restoreBackupByName(resolvedType, backupName);
        await Promise.all([refreshType(resolvedType), refreshBackups(resolvedType)]);
        if (focusFolderId) {
            focusFolderRow(resolvedType, focusFolderId);
        }
        if (entry?.afterBackupName) {
            state.redoStack.push(entry);
            while (state.redoStack.length > TREE_MOVE_HISTORY_LIMIT) {
                state.redoStack.shift();
            }
        }
        addActivityEntry(`Undo complete: restored ${backupName}.`, 'success');
        showToastMessage({
            title: 'Undo complete',
            message: `Restored ${backupName}`,
            level: 'success',
            durationMs: 3200
        });
    } catch (error) {
        state.undoStack.push(entry);
        showError('Undo failed', error);
    } finally {
        const latestUndo = state.undoStack[state.undoStack.length - 1];
        if (latestUndo?.beforeBackupName) {
            queueTreeMoveUndoBanner(
                resolvedType,
                latestUndo.beforeBackupName,
                latestUndo.actionLabel || 'Tree change',
                latestUndo.focusFolderId || ''
            );
        } else {
            dismissTreeMoveUndoBanner(resolvedType);
        }
        updateTreeMoveHistoryButtons(resolvedType);
    }
};

const applyTreeMoveRedo = async (type) => {
    const resolvedType = normalizeManagedType(type);
    const state = getTreeMoveHistoryState(resolvedType);
    if (!Array.isArray(state.redoStack) || state.redoStack.length <= 0) {
        updateTreeMoveHistoryButtons(resolvedType);
        return;
    }
    const entry = state.redoStack.pop();
    const backupName = String(entry?.afterBackupName || '').trim();
    const focusFolderId = String(entry?.focusFolderId || '').trim();
    if (!backupName) {
        updateTreeMoveHistoryButtons(resolvedType);
        return;
    }
    try {
        await restoreBackupByName(resolvedType, backupName);
        await Promise.all([refreshType(resolvedType), refreshBackups(resolvedType)]);
        if (focusFolderId) {
            focusFolderRow(resolvedType, focusFolderId);
        }
        state.undoStack.push(entry);
        while (state.undoStack.length > TREE_MOVE_HISTORY_LIMIT) {
            state.undoStack.shift();
        }
        addActivityEntry(`Redo complete: restored ${backupName}.`, 'success');
        showToastMessage({
            title: 'Redo complete',
            message: `Restored ${backupName}`,
            level: 'success',
            durationMs: 3200
        });
    } catch (error) {
        state.redoStack.push(entry);
        showError('Redo failed', error);
    } finally {
        const latestUndo = state.undoStack[state.undoStack.length - 1];
        if (latestUndo?.beforeBackupName) {
            queueTreeMoveUndoBanner(
                resolvedType,
                latestUndo.beforeBackupName,
                latestUndo.actionLabel || 'Tree change',
                latestUndo.focusFolderId || ''
            );
        } else {
            dismissTreeMoveUndoBanner(resolvedType);
        }
        updateTreeMoveHistoryButtons(resolvedType);
    }
};

const TREE_MOVE_PLACEMENTS = new Set(['before', 'after', 'inside']);

const normalizeTreeMovePlacement = (value) => (
    TREE_MOVE_PLACEMENTS.has(String(value || '').trim().toLowerCase())
        ? String(value || '').trim().toLowerCase()
        : 'inside'
);

const buildFolderHierarchyMeta = (foldersInput) => {
    const folders = utils.normalizeFolderMap(foldersInput || {});
    const ids = Object.keys(folders);
    const idSet = new Set(ids);
    const parentById = {};
    const childrenById = {};
    const depthById = {};
    const descendantsById = {};
    const indexById = new Map(ids.map((id, index) => [id, index]));

    for (const id of ids) {
        childrenById[id] = [];
    }

    for (const id of ids) {
        const rawParent = String(folders[id]?.parentId || '').trim();
        const safeParent = (rawParent && rawParent !== id && idSet.has(rawParent)) ? rawParent : '';
        parentById[id] = safeParent;
        if (safeParent) {
            childrenById[safeParent].push(id);
        }
    }

    const sortBySourceOrder = (left, right) => (
        (indexById.get(left) || 0) - (indexById.get(right) || 0)
    );
    for (const children of Object.values(childrenById)) {
        children.sort(sortBySourceOrder);
    }

    const visitedDepth = new Set();
    const assignDepth = (id, depth, path = new Set()) => {
        if (!idSet.has(id) || path.has(id)) {
            return;
        }
        const nextPath = new Set(path);
        nextPath.add(id);
        if (!Object.prototype.hasOwnProperty.call(depthById, id)) {
            depthById[id] = depth;
        } else {
            depthById[id] = Math.min(depthById[id], depth);
        }
        for (const childId of (childrenById[id] || [])) {
            assignDepth(childId, depth + 1, nextPath);
        }
        visitedDepth.add(id);
    };

    const rootIds = ids.filter((id) => !parentById[id]);
    rootIds.sort(sortBySourceOrder);
    for (const rootId of rootIds) {
        assignDepth(rootId, 0);
    }
    for (const id of ids) {
        if (!visitedDepth.has(id)) {
            assignDepth(id, 0);
        }
    }

    const collectDescendants = (id, path = new Set()) => {
        if (!idSet.has(id) || path.has(id)) {
            return [];
        }
        const nextPath = new Set(path);
        nextPath.add(id);
        const output = [];
        for (const childId of (childrenById[id] || [])) {
            if (!output.includes(childId)) {
                output.push(childId);
            }
            const childDescendants = collectDescendants(childId, nextPath);
            for (const descendantId of childDescendants) {
                if (!output.includes(descendantId)) {
                    output.push(descendantId);
                }
            }
        }
        return output;
    };

    for (const id of ids) {
        descendantsById[id] = collectDescendants(id);
    }

    return {
        ids,
        idSet,
        parentById,
        childrenById,
        depthById,
        descendantsById
    };
};

const areStringSetsEqual = (left, right) => {
    if (!(left instanceof Set) || !(right instanceof Set)) {
        return false;
    }
    if (left.size !== right.size) {
        return false;
    }
    for (const value of left) {
        if (!right.has(value)) {
            return false;
        }
    }
    return true;
};

const normalizeCollapsedTreeParentsForType = (type, foldersInput = null, hierarchyMeta = null) => {
    const resolvedType = normalizeManagedType(type);
    const folders = foldersInput && typeof foldersInput === 'object'
        ? utils.normalizeFolderMap(foldersInput)
        : getFolderMap(resolvedType);
    const meta = hierarchyMeta || buildFolderHierarchyMeta(folders);
    const source = collapsedTreeParentsByType[resolvedType] instanceof Set
        ? collapsedTreeParentsByType[resolvedType]
        : new Set();
    const normalized = new Set();
    for (const rawId of source) {
        const id = String(rawId || '').trim();
        if (!id || !meta.idSet.has(id)) {
            continue;
        }
        if (Array.isArray(meta.childrenById[id]) && meta.childrenById[id].length > 0) {
            normalized.add(id);
        }
    }
    return normalized;
};

const syncCollapsedTreeParentsForType = (type, foldersInput = null, hierarchyMeta = null, { persist = false } = {}) => {
    const resolvedType = normalizeManagedType(type);
    const normalized = normalizeCollapsedTreeParentsForType(resolvedType, foldersInput, hierarchyMeta);
    const previous = collapsedTreeParentsByType[resolvedType] instanceof Set
        ? collapsedTreeParentsByType[resolvedType]
        : new Set();
    const changed = !areStringSetsEqual(previous, normalized);
    collapsedTreeParentsByType[resolvedType] = normalized;
    if (persist || changed) {
        persistTableUiState();
    }
    return normalized;
};

const isFolderHiddenByCollapsedAncestor = (folderId, parentById, collapsedSet) => {
    const safeFolderId = String(folderId || '').trim();
    if (!safeFolderId || !(collapsedSet instanceof Set) || collapsedSet.size <= 0) {
        return false;
    }
    const visited = new Set([safeFolderId]);
    let cursor = String(parentById?.[safeFolderId] || '').trim();
    while (cursor) {
        if (collapsedSet.has(cursor)) {
            return true;
        }
        if (visited.has(cursor)) {
            break;
        }
        visited.add(cursor);
        cursor = String(parentById?.[cursor] || '').trim();
    }
    return false;
};

const canFolderUseTreeMove = (type, sourceFolderId, hierarchyMeta = null) => {
    const resolvedType = normalizeManagedType(type);
    const safeFolderId = String(sourceFolderId || '').trim();
    if (!safeFolderId) {
        return false;
    }
    const folders = getFolderMap(resolvedType);
    if (!Object.prototype.hasOwnProperty.call(folders, safeFolderId)) {
        return false;
    }
    const meta = hierarchyMeta || buildFolderHierarchyMeta(folders);
    const blocked = new Set([safeFolderId, ...(meta.descendantsById[safeFolderId] || [])]);
    for (const candidateId of Object.keys(folders)) {
        if (!blocked.has(candidateId)) {
            return true;
        }
    }
    return false;
};

const scheduleTableRender = (type, { immediate = false } = {}) => {
    const resolvedType = normalizeManagedType(type);
    if (immediate) {
        if (pendingTableRenderFrameByType[resolvedType] !== null) {
            window.cancelAnimationFrame(pendingTableRenderFrameByType[resolvedType]);
            pendingTableRenderFrameByType[resolvedType] = null;
        }
        renderTable(resolvedType);
        return;
    }
    if (pendingTableRenderFrameByType[resolvedType] !== null) {
        return;
    }
    pendingTableRenderFrameByType[resolvedType] = window.requestAnimationFrame(() => {
        pendingTableRenderFrameByType[resolvedType] = null;
        renderTable(resolvedType);
    });
};

const applyMobileTreeReorderModeClass = (type) => {
    const resolvedType = normalizeManagedType(type);
    const enabled = mobileTreeReorderModeByType[resolvedType] === true;
    const className = `fv-mobile-tree-reorder-${resolvedType}`;
    const root = document.getElementById('fv-settings-root');
    if (root) {
        root.classList.toggle(className, enabled);
    }
    if (document.body) {
        document.body.classList.toggle(className, enabled);
    }
    $(`#${resolvedType}-tree-reorder-toggle`)
        .toggleClass('is-active', enabled)
        .attr('aria-pressed', enabled ? 'true' : 'false');
};

const refreshMobileTreeReorderModeClasses = () => {
    applyMobileTreeReorderModeClass('docker');
    applyMobileTreeReorderModeClass('vm');
};

const setMobileTreeReorderMode = (type, enabled) => {
    const resolvedType = normalizeManagedType(type);
    mobileTreeReorderModeByType[resolvedType] = enabled === true;
    persistTableUiState();
    applyMobileTreeReorderModeClass(resolvedType);
    scheduleTableRender(resolvedType);
};

const toggleMobileTreeReorderMode = (type) => {
    const resolvedType = normalizeManagedType(type);
    setMobileTreeReorderMode(resolvedType, !(mobileTreeReorderModeByType[resolvedType] === true));
};

const treePathHintSelectorByType = Object.freeze({
    docker: '#docker-tree-path-hint',
    vm: '#vm-tree-path-hint'
});

const updateMobileTreePathHint = (type, folderId = '') => {
    const resolvedType = normalizeManagedType(type);
    const selector = treePathHintSelectorByType[resolvedType];
    const host = selector ? $(selector) : $();
    if (!host.length) {
        return;
    }
    const id = String(folderId || '').trim();
    if (!id) {
        host.text('Path: select a folder');
        return;
    }
    const folders = getFolderMap(resolvedType);
    if (!Object.prototype.hasOwnProperty.call(folders, id)) {
        host.text('Path: folder unavailable');
        return;
    }
    const hierarchyMeta = buildFolderHierarchyMeta(folders);
    const path = buildFolderPathLabel(resolvedType, id, folders, hierarchyMeta);
    host.text(`Path: ${path}`);
};

const getFolderBranchIds = (type, folderId, hierarchyMeta = null) => {
    const resolvedType = normalizeManagedType(type);
    const sourceId = String(folderId || '').trim();
    if (!sourceId) {
        return [];
    }
    const folders = getFolderMap(resolvedType);
    if (!Object.prototype.hasOwnProperty.call(folders, sourceId)) {
        return [];
    }
    const meta = hierarchyMeta || buildFolderHierarchyMeta(folders);
    return [sourceId, ...(meta.descendantsById[sourceId] || [])];
};

const setFolderBranchCollapse = (type, folderId, collapse = true) => {
    const resolvedType = normalizeManagedType(type);
    const folders = getFolderMap(resolvedType);
    const hierarchyMeta = buildFolderHierarchyMeta(folders);
    const branchIds = getFolderBranchIds(resolvedType, folderId, hierarchyMeta);
    if (!branchIds.length) {
        return;
    }
    const collapsed = syncCollapsedTreeParentsForType(resolvedType, folders, hierarchyMeta);
    if (collapse) {
        for (const id of branchIds) {
            const children = Array.isArray(hierarchyMeta.childrenById[id]) ? hierarchyMeta.childrenById[id] : [];
            if (children.length > 0) {
                collapsed.add(id);
            }
        }
    } else {
        for (const id of branchIds) {
            collapsed.delete(id);
        }
    }
    collapsedTreeParentsByType[resolvedType] = collapsed;
    persistTableUiState();
    scheduleTableRender(resolvedType);
};

const setFolderBranchPinned = async (type, folderId, pinned = true) => {
    const resolvedType = normalizeManagedType(type);
    if (!ensureRuntimeConflictActionAllowed('Pin/unpin folder branch')) {
        return;
    }
    const folders = getFolderMap(resolvedType);
    const hierarchyMeta = buildFolderHierarchyMeta(folders);
    const branchIds = getFolderBranchIds(resolvedType, folderId, hierarchyMeta);
    if (!branchIds.length) {
        return;
    }
    const current = utils.normalizePrefs(prefsByType[resolvedType]);
    const pinnedSet = new Set(Array.isArray(current.pinnedFolderIds) ? current.pinnedFolderIds : []);
    if (pinned) {
        branchIds.forEach((id) => pinnedSet.add(String(id)));
    } else {
        branchIds.forEach((id) => pinnedSet.delete(String(id)));
    }
    const next = {
        ...current,
        pinnedFolderIds: Array.from(pinnedSet)
    };
    const branchLabel = `${branchIds.length} folder${branchIds.length === 1 ? '' : 's'}`;
    let backup = null;
    try {
        backup = await createBackup(resolvedType, pinned ? `before-pin-branch-${folderId}` : `before-unpin-branch-${folderId}`);
        prefsByType[resolvedType] = await postPrefs(resolvedType, next);
        await refreshType(resolvedType);
        if (backup?.name) {
            await offerUndoAction(resolvedType, backup, pinned ? 'Pin branch' : 'Unpin branch');
        }
        showToastMessage({
            title: pinned ? 'Branch pinned' : 'Branch unpinned',
            message: `${branchLabel} updated.`,
            level: 'success',
            durationMs: 3200
        });
    } catch (error) {
        showError('Branch pin update failed', error);
    }
};

const exportFolderBranch = async (type, folderId) => {
    const resolvedType = normalizeManagedType(type);
    const folders = getFolderMap(resolvedType);
    const hierarchyMeta = buildFolderHierarchyMeta(folders);
    const branchIds = getFolderBranchIds(resolvedType, folderId, hierarchyMeta);
    if (!branchIds.length) {
        swal({ title: 'Export failed', text: 'Folder branch no longer exists.', type: 'error' });
        return;
    }
    const branchFolders = {};
    branchIds.forEach((id) => {
        if (Object.prototype.hasOwnProperty.call(folders, id)) {
            branchFolders[id] = folders[id];
        }
    });
    const sourceFolder = folders[String(folderId || '').trim()] || {};
    const payload = utils.buildFullExportPayload({
        type: resolvedType,
        folders: branchFolders,
        pluginVersion
    });
    payload.mode = 'branch';
    payload.branchRootId = String(folderId || '').trim();
    payload.branchSize = branchIds.length;
    const baseName = String(sourceFolder.name || folderId || 'folder-branch').trim() || 'folder-branch';
    downloadFile(`${baseName}-branch.json`, toPrettyJson(payload));
    await trackDiagnosticsEvent({
        eventType: 'export',
        type: resolvedType,
        details: {
            mode: 'branch',
            folderCount: branchIds.length,
            schemaVersion: utils.EXPORT_SCHEMA_VERSION
        }
    });
};

const buildRawParentMap = (foldersInput = null) => {
    const folders = utils.normalizeFolderMap(foldersInput || {});
    const parentMap = {};
    for (const [id, folder] of Object.entries(folders)) {
        const rawParent = typeof folder?.parentId === 'string'
            ? folder.parentId
            : (typeof folder?.parent_id === 'string' ? folder.parent_id : '');
        parentMap[id] = String(rawParent || '').trim();
    }
    return { folders, parentMap };
};

const scanFolderTreeIntegrity = (type, foldersInput = null) => {
    const resolvedType = normalizeManagedType(type);
    const { folders, parentMap } = buildRawParentMap(foldersInput || getFolderMap(resolvedType));
    const ids = Object.keys(folders);
    const idSet = new Set(ids);
    const selfParents = [];
    const orphans = [];
    const cycles = [];

    ids.forEach((id) => {
        const parentId = String(parentMap[id] || '').trim();
        if (!parentId) {
            return;
        }
        if (parentId === id) {
            selfParents.push(id);
            return;
        }
        if (!idSet.has(parentId)) {
            orphans.push(id);
        }
    });

    const visited = new Set();
    const inPath = new Set();
    const traverse = (id, chain = []) => {
        if (inPath.has(id)) {
            const startIndex = chain.indexOf(id);
            if (startIndex >= 0) {
                cycles.push(chain.slice(startIndex).concat(id));
            }
            return;
        }
        if (visited.has(id)) {
            return;
        }
        visited.add(id);
        inPath.add(id);
        const parentId = String(parentMap[id] || '').trim();
        if (parentId && idSet.has(parentId)) {
            traverse(parentId, chain.concat(id));
        }
        inPath.delete(id);
    };
    ids.forEach((id) => traverse(id, []));

    const hierarchyMeta = buildFolderHierarchyMeta(folders);
    const childrenById = hierarchyMeta?.childrenById && typeof hierarchyMeta.childrenById === 'object'
        ? hierarchyMeta.childrenById
        : {};
    const depthById = hierarchyMeta?.depthById && typeof hierarchyMeta.depthById === 'object'
        ? hierarchyMeta.depthById
        : {};
    const branchMemberCache = {};
    const getBranchMemberCount = (id, seen = new Set()) => {
        const safeId = String(id || '').trim();
        if (!safeId) {
            return 0;
        }
        if (Object.prototype.hasOwnProperty.call(branchMemberCache, safeId)) {
            return Number(branchMemberCache[safeId] || 0);
        }
        if (seen.has(safeId)) {
            return 0;
        }
        seen.add(safeId);
        const folder = folders[safeId] || {};
        const directMembers = (utils && typeof utils.normalizeFolderMembers === 'function')
            ? utils.normalizeFolderMembers(folder?.containers || []).length
            : (Array.isArray(folder?.containers) ? folder.containers.length : 0);
        let total = directMembers;
        const children = Array.isArray(childrenById[safeId]) ? childrenById[safeId] : [];
        for (const childId of children) {
            total += getBranchMemberCount(childId, seen);
        }
        seen.delete(safeId);
        branchMemberCache[safeId] = total;
        return total;
    };
    const depthWarnings = [];
    const emptyBranches = [];
    let maxDepth = 0;
    for (const id of ids) {
        const depth = Math.max(0, Number(depthById[id] || 0));
        if (depth > maxDepth) {
            maxDepth = depth;
        }
        if (depth > TREE_INTEGRITY_DEPTH_WARN_LEVEL) {
            depthWarnings.push({
                id,
                name: String(folders[id]?.name || id),
                depth
            });
        }
        const children = Array.isArray(childrenById[id]) ? childrenById[id] : [];
        if (children.length <= 0) {
            continue;
        }
        const branchMembers = getBranchMemberCount(id);
        if (branchMembers <= 0) {
            emptyBranches.push({
                id,
                name: String(folders[id]?.name || id),
                depth
            });
        }
    }

    return {
        type: resolvedType,
        totalFolders: ids.length,
        selfParents,
        orphans,
        cycles,
        maxDepth,
        depthWarnings,
        emptyBranches
    };
};

const importFolderBranch = async (type, targetFolderId) => {
    const resolvedType = normalizeManagedType(type);
    const targetId = String(targetFolderId || '').trim();
    const folders = getFolderMap(resolvedType);
    if (!targetId || !Object.prototype.hasOwnProperty.call(folders, targetId)) {
        swal({ title: 'Import failed', text: 'Target folder is required.', type: 'error' });
        return;
    }
    if (!ensureRuntimeConflictActionAllowed(`Import ${resolvedType === 'docker' ? 'Docker' : 'VM'} branch`)) {
        return;
    }
    let selected;
    try {
        selected = await selectJsonFile();
    } catch (error) {
        showError('Import failed', error);
        return;
    }
    if (!selected) {
        return;
    }
    let parsedFile;
    try {
        parsedFile = JSON.parse(selected.text);
    } catch (_error) {
        swal({ title: 'Import failed', text: 'Invalid JSON file.', type: 'error' });
        return;
    }
    const parsed = utils.parseImportPayload(parsedFile, resolvedType);
    if (!parsed.ok) {
        swal({ title: 'Import failed', text: parsed.error || 'Invalid branch payload.', type: 'error' });
        return;
    }

    const sourceFolders = parsed.mode === 'single'
        ? { [String(parsed.folderId || `branch-${Date.now()}`)]: parsed.folder }
        : utils.normalizeFolderMap(parsed.folders || {});
    const sourceIds = Object.keys(sourceFolders);
    if (!sourceIds.length) {
        swal({ title: 'Import failed', text: 'No folders found in selected file.', type: 'error' });
        return;
    }
    const existingIds = new Set(Object.keys(folders || {}));
    const remapId = {};
    const uniqueIdFor = (base, index) => {
        let candidate = String(base || `branch-${index + 1}`).trim() || `branch-${index + 1}`;
        candidate = candidate.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || `branch-${index + 1}`;
        if (!existingIds.has(candidate) && !Object.values(remapId).includes(candidate)) {
            return candidate;
        }
        let counter = 1;
        while (existingIds.has(`${candidate}-${counter}`) || Object.values(remapId).includes(`${candidate}-${counter}`)) {
            counter += 1;
        }
        return `${candidate}-${counter}`;
    };
    sourceIds.forEach((sourceId, index) => {
        remapId[sourceId] = uniqueIdFor(sourceId, index);
    });
    const sourceSet = new Set(sourceIds);
    const upserts = sourceIds.map((sourceId) => {
        const folder = utils.normalizeFolderMap({ [sourceId]: sourceFolders[sourceId] })[sourceId];
        const mappedId = remapId[sourceId];
        const sourceParentId = String(folder?.parentId || '').trim();
        const remappedParentId = sourceSet.has(sourceParentId)
            ? remapId[sourceParentId]
            : targetId;
        return {
            id: mappedId,
            folder: {
                ...(folder || {}),
                parentId: remappedParentId
            }
        };
    });
    const operations = {
        deletes: [],
        upserts,
        creates: []
    };
    let backup = null;
    try {
        backup = await createBackup(resolvedType, `before-branch-import-${targetId}`);
        await applyImportOperations(resolvedType, operations);
        await Promise.all([refreshType(resolvedType), refreshBackups(resolvedType)]);
        await offerUndoAction(resolvedType, backup, 'Branch import');
        showToastMessage({
            title: 'Branch imported',
            message: `Imported ${upserts.length} folder${upserts.length === 1 ? '' : 's'} under ${folders[targetId]?.name || targetId}.`,
            level: 'success',
            durationMs: 4200
        });
    } catch (error) {
        showError('Branch import failed', error);
    }
};

const normalizeTreeIntegrityOptions = (options) => {
    if (typeof options === 'boolean') {
        return { repair: options };
    }
    if (!options || typeof options !== 'object') {
        return { repair: false };
    }
    return { repair: options.repair === true };
};

const runTreeIntegrityCheck = async (type, options = {}) => {
    const normalizedOptions = normalizeTreeIntegrityOptions(options);
    const repair = normalizedOptions.repair === true;
    const resolvedType = normalizeManagedType(type);
    const report = scanFolderTreeIntegrity(resolvedType);
    const linkIssueCount = report.selfParents.length + report.orphans.length + report.cycles.length;
    const advisoryIssueCount = report.depthWarnings.length + report.emptyBranches.length;
    const totalIssues = linkIssueCount + advisoryIssueCount;
    if (totalIssues <= 0) {
        swal({
            title: 'Tree integrity healthy',
            text: `${resolvedType.toUpperCase()} nested folder structure has no cycle/orphan/depth/empty-branch issues.`,
            type: 'success'
        });
        return;
    }
    if (!repair) {
        const cyclePreview = report.cycles.slice(0, 3).map((cycle) => cycle.join(' -> ')).join('\n');
        const depthPreview = report.depthWarnings
            .slice(0, 4)
            .map((row) => `${row.name} (depth ${row.depth})`)
            .join('\n');
        const emptyBranchPreview = report.emptyBranches
            .slice(0, 4)
            .map((row) => `${row.name} (depth ${row.depth})`)
            .join('\n');
        const details = [
            `Self-parent links: ${report.selfParents.length}`,
            `Orphans: ${report.orphans.length}`,
            `Cycles: ${report.cycles.length}`,
            `Depth warnings (> ${TREE_INTEGRITY_DEPTH_WARN_LEVEL}): ${report.depthWarnings.length}`,
            `Empty branches (no members in subtree): ${report.emptyBranches.length}`,
            `Max depth: ${report.maxDepth}`,
            cyclePreview ? `\nCycle preview:\n${cyclePreview}` : ''
            , depthPreview ? `\nDeep branch preview:\n${depthPreview}` : ''
            , emptyBranchPreview ? `\nEmpty branch preview:\n${emptyBranchPreview}` : ''
        ].join('\n');
        swal({
            title: 'Tree integrity issues found',
            text: details,
            type: 'warning'
        });
        return;
    }
    if (linkIssueCount <= 0) {
        swal({
            title: 'No repairable link issues',
            text: `Detected ${advisoryIssueCount} advisory issue(s) (depth/empty branch), but no orphan/cycle link errors to auto-repair.`,
            type: 'info'
        });
        return;
    }
    const folders = getFolderMap(resolvedType);
    const toRepairSet = new Set([...report.selfParents, ...report.orphans]);
    report.cycles.forEach((cycle) => {
        const first = Array.isArray(cycle) ? String(cycle[0] || '').trim() : '';
        if (first) {
            toRepairSet.add(first);
        }
    });
    const toRepair = Array.from(toRepairSet).filter((id) => Object.prototype.hasOwnProperty.call(folders, id));
    if (!toRepair.length) {
        return;
    }
    if (!ensureRuntimeConflictActionAllowed(`Repair ${resolvedType.toUpperCase()} nested tree integrity`)) {
        return;
    }
    const confirmed = await new Promise((resolve) => {
        swal({
            title: 'Repair tree integrity?',
            text: `This will reset parent links to root for ${toRepair.length} folder(s). Advisory depth/empty-branch warnings are reported but not auto-changed.`,
            type: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Repair',
            cancelButtonText: 'Cancel'
        }, (ok) => resolve(ok === true));
    });
    if (!confirmed) {
        return;
    }
    let backup = null;
    try {
        backup = await createBackup(resolvedType, `before-tree-integrity-repair-${Date.now()}`);
        for (const id of toRepair) {
            const folder = folders[id];
            await saveFolderRecord(resolvedType, id, {
                ...folder,
                parentId: ''
            });
        }
        await refreshType(resolvedType);
        if (backup?.name) {
            await offerUndoAction(resolvedType, backup, 'Tree integrity repair');
        }
        swal({
            title: 'Repair complete',
            text: `Fixed ${toRepair.length} folder link${toRepair.length === 1 ? '' : 's'}. Remaining advisory warnings: ${advisoryIssueCount}.`,
            type: 'success'
        });
    } catch (error) {
        showError('Tree integrity repair failed', error);
    }
};

const toggleFolderTreeCollapse = (type, folderId) => {
    const resolvedType = normalizeManagedType(type);
    const safeFolderId = String(folderId || '').trim();
    if (!safeFolderId) {
        return;
    }
    const folders = getFolderMap(resolvedType);
    if (!Object.prototype.hasOwnProperty.call(folders, safeFolderId)) {
        return;
    }
    const hierarchyMeta = buildFolderHierarchyMeta(folders);
    const children = Array.isArray(hierarchyMeta.childrenById[safeFolderId])
        ? hierarchyMeta.childrenById[safeFolderId]
        : [];
    if (children.length <= 0) {
        return;
    }
    const collapsed = syncCollapsedTreeParentsForType(resolvedType, folders, hierarchyMeta);
    if (collapsed.has(safeFolderId)) {
        collapsed.delete(safeFolderId);
    } else {
        collapsed.add(safeFolderId);
    }
    collapsedTreeParentsByType[resolvedType] = collapsed;
    persistTableUiState();
    scheduleTableRender(resolvedType);
};

const expandAllFolderTrees = (type) => {
    const resolvedType = normalizeManagedType(type);
    collapsedTreeParentsByType[resolvedType] = new Set();
    persistTableUiState();
    scheduleTableRender(resolvedType);
};

const collapseAllFolderTrees = (type) => {
    const resolvedType = normalizeManagedType(type);
    const folders = getFolderMap(resolvedType);
    const hierarchyMeta = buildFolderHierarchyMeta(folders);
    const collapsed = new Set();
    Object.entries(hierarchyMeta.childrenById || {}).forEach(([folderId, children]) => {
        if (Array.isArray(children) && children.length > 0) {
            collapsed.add(String(folderId || ''));
        }
    });
    collapsedTreeParentsByType[resolvedType] = collapsed;
    persistTableUiState();
    scheduleTableRender(resolvedType);
};

const getOrderedFolderIdsForTreeOps = (type) => {
    const resolvedType = normalizeManagedType(type);
    const orderedMap = utils.orderFoldersByPrefs(getFolderMap(resolvedType), prefsByType[resolvedType] || {});
    return Object.keys(orderedMap);
};

const findLastMatchingOrderIndex = (orderIds, candidateIds) => {
    const list = Array.isArray(orderIds) ? orderIds : [];
    const candidates = new Set(Array.isArray(candidateIds) ? candidateIds : []);
    for (let index = list.length - 1; index >= 0; index -= 1) {
        if (candidates.has(String(list[index] || ''))) {
            return index;
        }
    }
    return -1;
};

const clearFolderTreeMoveError = (type, folderId, { rerender = true } = {}) => {
    const resolvedType = normalizeManagedType(type);
    const safeFolderId = String(folderId || '').trim();
    if (!safeFolderId) {
        return;
    }
    if (folderTreeMoveErrorTimersByType[resolvedType]?.[safeFolderId]) {
        window.clearTimeout(folderTreeMoveErrorTimersByType[resolvedType][safeFolderId]);
        delete folderTreeMoveErrorTimersByType[resolvedType][safeFolderId];
    }
    if (folderTreeMoveErrorsByType[resolvedType]?.[safeFolderId]) {
        delete folderTreeMoveErrorsByType[resolvedType][safeFolderId];
        if (rerender) {
            scheduleTableRender(resolvedType);
        }
    }
};

const setFolderTreeMoveError = (type, folderId, message) => {
    const resolvedType = normalizeManagedType(type);
    const safeFolderId = String(folderId || '').trim();
    const safeMessage = String(message || '').trim();
    if (!safeFolderId || !safeMessage) {
        return;
    }
    folderTreeMoveErrorsByType[resolvedType][safeFolderId] = safeMessage;
    if (folderTreeMoveErrorTimersByType[resolvedType]?.[safeFolderId]) {
        window.clearTimeout(folderTreeMoveErrorTimersByType[resolvedType][safeFolderId]);
    }
    folderTreeMoveErrorTimersByType[resolvedType][safeFolderId] = window.setTimeout(() => {
        clearFolderTreeMoveError(resolvedType, safeFolderId);
    }, 7000);
    scheduleTableRender(resolvedType);
};

const getFolderInheritanceFlags = (folder) => {
    const settings = (folder && typeof folder.settings === 'object' && folder.settings !== null)
        ? folder.settings
        : {};
    return {
        icon: settings.inherit_parent_icon === true,
        status: settings.inherit_parent_status === true,
        runtime: settings.inherit_parent_runtime === true
    };
};

const resolveInheritedFolderIcon = (type, folderId, foldersInput = null, hierarchyMeta = null) => {
    const resolvedType = normalizeManagedType(type);
    const folders = utils.normalizeFolderMap(foldersInput || getFolderMap(resolvedType));
    const sourceId = String(folderId || '').trim();
    if (!sourceId || !Object.prototype.hasOwnProperty.call(folders, sourceId)) {
        return '/plugins/folderview.plus/images/folder-icon.png';
    }
    const meta = hierarchyMeta || buildFolderHierarchyMeta(folders);
    const sourceFolder = folders[sourceId];
    const sourceFlags = getFolderInheritanceFlags(sourceFolder);
    const ownIcon = String(sourceFolder?.icon || '').trim();
    if (!sourceFlags.icon) {
        return ownIcon || '/plugins/folderview.plus/images/folder-icon.png';
    }
    const visited = new Set([sourceId]);
    let cursor = String(meta.parentById?.[sourceId] || '').trim();
    while (cursor && !visited.has(cursor) && Object.prototype.hasOwnProperty.call(folders, cursor)) {
        visited.add(cursor);
        const folder = folders[cursor];
        const icon = String(folder?.icon || '').trim();
        if (icon) {
            return icon;
        }
        const flags = getFolderInheritanceFlags(folder);
        if (!flags.icon) {
            break;
        }
        cursor = String(meta.parentById?.[cursor] || '').trim();
    }
    return ownIcon || '/plugins/folderview.plus/images/folder-icon.png';
};

const resolveFolderStatusWarnThresholdForId = ({
    type,
    folderId,
    folders,
    hierarchyMeta,
    fallbackThreshold
}) => {
    const resolvedType = normalizeManagedType(type);
    const folderMap = utils.normalizeFolderMap(folders || getFolderMap(resolvedType));
    const sourceId = String(folderId || '').trim();
    if (!sourceId || !Object.prototype.hasOwnProperty.call(folderMap, sourceId)) {
        return { value: Math.min(100, Math.max(0, Math.round(Number(fallbackThreshold) || 60))), source: 'global' };
    }
    const meta = hierarchyMeta || buildFolderHierarchyMeta(folderMap);
    const safeFallback = Number.isFinite(Number(fallbackThreshold))
        ? Math.min(100, Math.max(0, Math.round(Number(fallbackThreshold))))
        : 60;
    const resolveRawThreshold = (id, visited = new Set()) => {
        const safeId = String(id || '').trim();
        if (!safeId || visited.has(safeId) || !Object.prototype.hasOwnProperty.call(folderMap, safeId)) {
            return null;
        }
        const nextVisited = new Set(visited);
        nextVisited.add(safeId);
        const folder = folderMap[safeId];
        const settings = (folder && typeof folder.settings === 'object' && folder.settings !== null)
            ? folder.settings
            : {};
        const raw = settings.status_warn_stopped_percent;
        if (!(raw === '' || raw === null || raw === undefined)) {
            const parsed = Number(raw);
            if (Number.isFinite(parsed)) {
                return {
                    parsed: Math.min(100, Math.max(0, Math.round(parsed))),
                    sourceId: safeId
                };
            }
        }
        const flags = getFolderInheritanceFlags(folder);
        if (!flags.status) {
            return null;
        }
        const parentId = String(meta.parentById?.[safeId] || '').trim();
        if (!parentId) {
            return null;
        }
        return resolveRawThreshold(parentId, nextVisited);
    };

    const resolved = resolveRawThreshold(sourceId, new Set());
    if (!resolved) {
        return { value: safeFallback, source: 'global' };
    }
    if (resolved.sourceId === sourceId) {
        return { value: resolved.parsed, source: 'folder' };
    }
    return { value: resolved.parsed, source: 'inherited' };
};

const escapeRegexForSearch = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const highlightSearchText = (text, query) => {
    const rawText = String(text || '');
    const rawQuery = String(query || '').trim();
    if (!rawQuery) {
        return escapeHtml(rawText);
    }
    const pattern = new RegExp(`(${escapeRegexForSearch(rawQuery)})`, 'ig');
    return escapeHtml(rawText).replace(pattern, '<mark class="fv-filter-hit">$1</mark>');
};

const buildRowsHtml = (type, folders, memberSnapshot = {}, hideEmptyFolders = false, healthMetrics = null, statusContext = null) => {
    const isDockerType = type === 'docker';
    const TABLE_COLUMN_COUNT = SETTINGS_TABLE_COLUMN_COUNT;
    const folderCount = Object.keys(folders || {}).length;
    const dockerHealthPrefs = isDockerType ? normalizeHealthPrefs('docker') : null;
    const statusPrefs = normalizeStatusPrefs(type);
    const rows = [];
    const filter = normalizedFilter(filtersByType[type]?.folders);
    const healthFilterMode = normalizeHealthFilterMode(healthFilterByType[type]);
    const healthSeverityFilterMode = normalizeHealthSeverityFilterMode(healthSeverityFilterByType[type]);
    const statusFilterMode = normalizeStatusFilterMode(statusFilterByType[type]);
    const quickFilterMode = normalizeQuickFolderFilterMode(quickFolderFilterByType[type], type);
    const previousStatusSnapshot = statusContext?.previous && typeof statusContext.previous === 'object'
        ? statusContext.previous
        : {};
    const hierarchyMeta = statusContext?.hierarchyMeta && typeof statusContext.hierarchyMeta === 'object'
        ? statusContext.hierarchyMeta
        : buildFolderHierarchyMeta(folders);
    const collapsedParents = statusContext?.collapsedParents instanceof Set
        ? statusContext.collapsedParents
        : syncCollapsedTreeParentsForType(type, folders, hierarchyMeta);
    const treeErrors = folderTreeMoveErrorsByType[type] && typeof folderTreeMoveErrorsByType[type] === 'object'
        ? folderTreeMoveErrorsByType[type]
        : {};
    const pathLabelById = {};
    Object.keys(folders || {}).forEach((id) => {
        pathLabelById[id] = buildFolderPathLabel(type, id, folders, hierarchyMeta);
    });
    const filterVisibleIds = new Set();
    if (filter) {
        Object.keys(folders || {}).forEach((id) => {
            const nameText = String(folders[id]?.name || '');
            const pathLabel = String(pathLabelById[id] || nameText || id);
            const haystack = `${String(id)} ${nameText} ${pathLabel}`.toLowerCase();
            if (!haystack.includes(filter)) {
                return;
            }
            filterVisibleIds.add(id);
            let cursor = String(hierarchyMeta.parentById?.[id] || '').trim();
            const visited = new Set([id]);
            while (cursor && !visited.has(cursor)) {
                visited.add(cursor);
                if (!Object.prototype.hasOwnProperty.call(folders, cursor)) {
                    break;
                }
                filterVisibleIds.add(cursor);
                cursor = String(hierarchyMeta.parentById?.[cursor] || '').trim();
            }
        });
    }
    const activeCollapsedParents = filter ? new Set() : collapsedParents;
    for (const [id, folder] of Object.entries(folders)) {
        const nameText = String(folder.name || '');
        const pathLabel = String(pathLabelById[id] || nameText || id);
        if (filter && !filterVisibleIds.has(id)) {
            continue;
        }
        if (!filter && isFolderHiddenByCollapsedAncestor(id, hierarchyMeta.parentById, activeCollapsedParents)) {
            continue;
        }
        const members = Array.isArray(memberSnapshot[id]?.members) ? memberSnapshot[id].members : [];
        const directMemberCount = members.length;
        const descendantIds = Array.isArray(hierarchyMeta?.descendantsById?.[id]) ? hierarchyMeta.descendantsById[id] : [];
        const totalMembersSet = new Set(members);
        for (const descendantId of descendantIds) {
            const descendantMembers = Array.isArray(memberSnapshot[descendantId]?.members)
                ? memberSnapshot[descendantId].members
                : [];
            for (const member of descendantMembers) {
                totalMembersSet.add(String(member || ''));
            }
        }
        const totalMemberCount = totalMembersSet.size;
        if (hideEmptyFolders && members.length === 0) {
            continue;
        }
        if (!folderMatchesHealthFilter(type, id, healthMetrics)) {
            continue;
        }
        const pinned = isFolderPinned(type, id);
        const pinTitle = pinned ? 'Unpin folder' : 'Pin folder to top';
        const infoByName = infoByType[type] || {};
        const countsByState = { started: 0, paused: 0, stopped: 0 };
        const namesByState = { started: [], paused: [], stopped: [] };
        for (const member of members) {
            const runtimeState = getItemRuntimeStateKind(type, infoByName[member] || {});
            if (runtimeState === 'started') {
                countsByState.started += 1;
                namesByState.started.push(String(member));
            } else if (runtimeState === 'paused') {
                countsByState.paused += 1;
                namesByState.paused.push(String(member));
            } else {
                countsByState.stopped += 1;
                namesByState.stopped.push(String(member));
            }
        }
        const folderRules = (prefsByType[type]?.autoRules || []).filter((rule) => String(rule?.folderId || '') === String(id));
        const activeRuleCount = folderRules.reduce((count, rule) => (rule?.enabled === false ? count : count + 1), 0);
        const ruleText = folderRules.length === 0 ? '0' : (activeRuleCount === folderRules.length ? String(folderRules.length) : `${activeRuleCount}/${folderRules.length}`);
        const ruleTitle = folderRules.length === 0
            ? 'No rules for this folder'
            : `${activeRuleCount} active of ${folderRules.length} total rules`;
        let dockerUpdateNames = [];
        if (isDockerType) {
            for (const member of members) {
                if (isDockerUpdateAvailable(infoByName[member] || {})) {
                    dockerUpdateNames.push(String(member));
                }
            }
        }
        if (!folderMatchesQuickFilter({
            type,
            mode: quickFilterMode,
            pinned,
            ruleCount: folderRules.length,
            members: members.length,
            countsByState,
            updateCount: dockerUpdateNames.length
        })) {
            continue;
        }
        const folderNameRaw = String(folder.name || id);
        const safeNameText = escapeHtml(folderNameRaw);
        const safeNameDisplayHtml = filter ? highlightSearchText(folderNameRaw, filter) : safeNameText;
        const safeIcon = escapeHtml(resolveInheritedFolderIcon(type, id, folders, hierarchyMeta));
        const folderDepth = Math.max(0, Math.min(6, Number(hierarchyMeta?.depthById?.[id] || 0)));
        const childFolderIds = Array.isArray(hierarchyMeta?.childrenById?.[id]) ? hierarchyMeta.childrenById[id] : [];
        const hasChildren = childFolderIds.length > 0;
        const isCollapsed = hasChildren && collapsedParents.has(id);
        const treeToggleTitle = isCollapsed
            ? `Expand nested folders in ${folderNameRaw}`
            : `Collapse nested folders in ${folderNameRaw}`;
        const treeToggleHtml = hasChildren
            ? `<button type="button" class="folder-tree-toggle ${isCollapsed ? 'is-collapsed' : 'is-expanded'}" title="${escapeHtml(treeToggleTitle)}" aria-label="${escapeHtml(treeToggleTitle)}" onclick="toggleFolderTreeCollapse('${type}','${escapeHtml(id)}')"><i class="fa ${isCollapsed ? 'fa-caret-right' : 'fa-caret-down'}" aria-hidden="true"></i></button>`
            : '<span class="folder-tree-toggle-spacer" aria-hidden="true"></span>';
        const parentFolderId = String(hierarchyMeta?.parentById?.[id] || '').trim();
        const parentFolderNameRaw = parentFolderId && Object.prototype.hasOwnProperty.call(folders, parentFolderId)
            ? String(folders[parentFolderId]?.name || parentFolderId)
            : '';
        const nestedMetaTitleRaw = folderDepth > 0
            ? `Nested level ${folderDepth}${parentFolderNameRaw ? ` under ${parentFolderNameRaw}` : ''}`
            : 'Root folder';
        const nestedMetaTextRaw = parentFolderNameRaw
            ? `Nested under ${parentFolderNameRaw}`
            : `Nested level ${folderDepth}`;
        const nestedMetaHtml = folderDepth > 0
            ? `<span class="name-cell-nested-meta" title="${escapeHtml(nestedMetaTitleRaw)}"><i class="fa fa-level-up fa-rotate-90" aria-hidden="true"></i><span>${escapeHtml(nestedMetaTextRaw)}</span></span>`
            : '';
        const showBreadcrumb = folderDepth > 0 || Boolean(filter);
        const breadcrumbTitle = `Path: ${pathLabel}`;
        const breadcrumbHtml = showBreadcrumb
            ? `<span class="name-cell-breadcrumb" title="${escapeHtml(breadcrumbTitle)}">${highlightSearchText(pathLabel, filter)}</span>`
            : '';
        const nameCellClass = folderDepth > 0 ? 'name-cell-content is-nested' : 'name-cell-content is-root';
        if (!folderMatchesStatusFilter(statusFilterMode, countsByState, members.length)) {
            continue;
        }
        const statusWarnThresholdInfo = resolveFolderStatusWarnThresholdForId({
            type,
            folderId: id,
            folders,
            hierarchyMeta,
            fallbackThreshold: statusPrefs.warnStoppedPercent
        });
        const statusWarnThreshold = statusWarnThresholdInfo.value;
        const statusDisplayMode = normalizeStatusDisplayMode(statusPrefs.displayMode);
        const stoppedPercent = members.length > 0 ? Math.round((countsByState.stopped / members.length) * 100) : 0;
        const allStopped = members.length > 0
            && countsByState.started === 0
            && countsByState.paused === 0
            && countsByState.stopped > 0;
        const pausedOnly = members.length > 0
            && countsByState.started === 0
            && countsByState.paused > 0
            && countsByState.stopped === 0;
        const stoppedAttention = statusPrefs.attentionAccent === true
            && countsByState.stopped > 0
            && (allStopped || stoppedPercent >= statusWarnThreshold);
        const pausedAttention = statusPrefs.attentionAccent === true
            && !stoppedAttention
            && pausedOnly;
        const statusThresholdLabel = statusWarnThresholdInfo.source === 'folder'
            ? `Status warn threshold: ${statusWarnThreshold}% stopped (folder override).`
            : (statusWarnThresholdInfo.source === 'inherited'
                ? `Status warn threshold: ${statusWarnThreshold}% stopped (inherited from parent).`
                : `Status warn threshold: ${statusWarnThreshold}% stopped (global default).`);
        const dominantStatusKey = deriveFolderStatusKey(countsByState, members.length);
        const statusPrimaryKey = dominantStatusKey === 'mixed' && countsByState.stopped > 0
            ? 'stopped'
            : dominantStatusKey;
        const fullStatusSummaryText = statusPrefs.mode === 'dominant'
            ? formatStatusDominantText(dominantStatusKey, countsByState, members.length)
            : formatStatusSummaryText(countsByState, members.length);
        const balancedPrimaryText = statusPrefs.mode === 'dominant'
            ? formatStatusDominantText(dominantStatusKey, countsByState, members.length)
            : statusLabelForKey(dominantStatusKey);
        const statusPrimaryText = statusDisplayMode === 'balanced'
            ? balancedPrimaryText
            : fullStatusSummaryText;
        const statusChipAttention = stoppedAttention || pausedAttention;
        const statusChipClass = statusClassForKey(statusPrimaryKey);
        const statusChipFilterActive = statusFilterMode === statusPrimaryKey;
        const statusChipHint = statusChipFilterActive
            ? 'Click to show all statuses.'
            : `Click to show folders with ${statusLabelForKey(statusPrimaryKey).toLowerCase()} members.`;
        const statusChipTitle = [
            `Status summary: ${fullStatusSummaryText}`,
            `Dominant status: ${statusLabelForKey(dominantStatusKey)}`,
            `Members: ${members.length} total`,
            `${countsByState.started} started, ${countsByState.paused} paused, ${countsByState.stopped} stopped`,
            summarizeStatusMembers('Started items', namesByState.started),
            summarizeStatusMembers('Paused items', namesByState.paused),
            summarizeStatusMembers('Stopped items', namesByState.stopped),
            `Stopped percentage: ${stoppedPercent}%`,
            statusThresholdLabel,
            'Open status breakdown from the info button for full details.',
            statusChipHint
        ].filter(Boolean).join('\n');
        const statusSummaryChipHtml = `<span class="status-chip-list"><button type="button" class="folder-runtime-status status-chip ${statusChipClass} ${statusChipAttention ? 'is-attention' : ''} ${statusChipFilterActive ? 'is-filter-active' : ''}" title="${escapeHtml(statusChipTitle)}" aria-label="${escapeHtml(statusChipTitle)}" onclick="toggleStatusFilter('${type}','${escapeHtml(statusPrimaryKey)}')"><span>${escapeHtml(statusPrimaryText)}</span></button></span>`;
        const includeZeroBreakdown = statusDisplayMode === 'detailed';
        const breakdownEntries = [
            {
                key: 'started',
                count: Number(countsByState.started || 0),
                icon: 'fa-play',
                label: 'Started'
            },
            {
                key: 'paused',
                count: Number(countsByState.paused || 0),
                icon: 'fa-pause',
                label: 'Paused'
            },
            {
                key: 'stopped',
                count: Number(countsByState.stopped || 0),
                icon: 'fa-stop',
                label: 'Stopped'
            }
        ].filter((entry) => includeZeroBreakdown ? true : entry.count > 0);
        if (!breakdownEntries.length && members.length <= 0) {
            breakdownEntries.push({
                key: 'empty',
                count: 0,
                icon: 'fa-ban',
                label: 'Empty'
            });
        }
        const statusBreakdownHtml = statusDisplayMode === 'simple'
            ? ''
            : `<span class="status-breakdown-list">${breakdownEntries.map((entry) => {
                const title = `${entry.label}: ${entry.count} item${entry.count === 1 ? '' : 's'}`;
                return `<span class="status-breakdown-chip ${statusClassForKey(entry.key)}" title="${escapeHtml(title)}"><i class="fa ${entry.icon}" aria-hidden="true"></i><span class="count">${entry.count}</span></span>`;
            }).join('')}</span>`;
        const statusDisplayClass = `is-${statusDisplayMode}`;

        let statusTrendHtml = '';
        if (statusDisplayMode === 'detailed' && statusPrefs.trendEnabled === true) {
            const previousStatus = previousStatusSnapshot[String(id)] || null;
            if (previousStatus) {
                const deltaStarted = countsByState.started - Number(previousStatus.started || 0);
                const deltaPaused = countsByState.paused - Number(previousStatus.paused || 0);
                const deltaStopped = countsByState.stopped - Number(previousStatus.stopped || 0);
                let trendClass = '';
                let trendIcon = '';
                let trendText = '';
                if (deltaStarted > 0 && deltaStopped <= 0) {
                    trendClass = 'is-up';
                    trendIcon = 'fa-arrow-up';
                    trendText = `+${deltaStarted} started`;
                } else if (deltaStopped > 0 && deltaStarted <= 0) {
                    trendClass = 'is-down';
                    trendIcon = 'fa-arrow-down';
                    trendText = `+${deltaStopped} stopped`;
                } else if (deltaPaused !== 0 || deltaStarted !== 0 || deltaStopped !== 0) {
                    trendClass = deltaStopped > deltaStarted ? 'is-down' : 'is-up';
                    trendIcon = trendClass === 'is-down' ? 'fa-exchange' : 'fa-random';
                    trendText = `S:${deltaStarted >= 0 ? '+' : ''}${deltaStarted} P:${deltaPaused >= 0 ? '+' : ''}${deltaPaused} X:${deltaStopped >= 0 ? '+' : ''}${deltaStopped}`;
                }
                if (trendText) {
                    statusTrendHtml = `<span class="status-trend ${trendClass}" aria-label="${escapeHtml(`Status trend ${trendText}`)}"><i class="fa ${trendIcon}" aria-hidden="true"></i><span>${escapeHtml(trendText)}</span></span>`;
                }
            }
        }
        const lastChangedRaw = String(folder.updatedAt || folder.createdAt || '').trim();
        const lastChangedText = lastChangedRaw ? formatTimestamp(lastChangedRaw) : 'Unknown';
        const pinnedText = pinned ? 'Pinned' : 'No';
        const pinnedClass = pinned ? 'is-pinned' : '';

        let typeSpecificColumns = '';
        if (isDockerType) {
            const updateNames = dockerUpdateNames;
            const updateCount = updateNames.length;
            if (dockerUpdatesOnlyFilter && updateCount === 0) {
                continue;
            }
            let updateClass = 'is-ok';
            let updateIcon = 'fa-check-circle';
            if (updateCount > 0 && updateCount <= 9) {
                updateClass = 'is-warning';
                updateIcon = 'fa-exclamation-circle';
            } else if (updateCount > 9) {
                updateClass = 'is-danger';
                updateIcon = 'fa-exclamation-triangle';
            }
            const updatePreview = updateNames.slice(0, 5).join(', ');
            const updateExtra = updateNames.length > 5 ? ` (+${updateNames.length - 5} more)` : '';
            const updateTitle = updateNames.length
                ? `Containers with updates: ${updatePreview}${updateExtra}\nClick to ${dockerUpdatesOnlyFilter ? 'show all folders' : 'show folders with updates only'}`
                : `${members.length > 0 ? 'No updates in this folder' : 'Folder has no members'}\nClick to ${dockerUpdatesOnlyFilter ? 'show all folders' : 'show folders with updates only'}`;
            const healthStatus = evaluateDockerFolderHealth(
                folder,
                members.length,
                countsByState,
                updateCount,
                Number(dockerHealthPrefs?.warnStoppedPercent) || 60
            );
            if (healthSeverityFilterMode !== 'all' && healthStatus.filterSeverity !== healthSeverityFilterMode) {
                continue;
            }
            const healthFilterActive = healthSeverityFilterMode === healthStatus.filterSeverity;
            const healthToggleHint = healthFilterActive
                ? 'Click to show all folders.'
                : `Click to show ${healthStatus.text} folders only.`;
            const healthTitle = [...healthStatus.details, healthToggleHint].join('\n');
            typeSpecificColumns = ''
                + `<td class="updates-cell signals-cell"><span class="signals-cell-content"><button type="button" class="folder-metric-chip updates-chip ${updateClass} ${dockerUpdatesOnlyFilter ? 'is-filter-active' : ''}" title="${escapeHtml(updateTitle)}" aria-label="${escapeHtml(updateTitle)}" onclick="toggleDockerUpdatesFilter(${updateCount > 0 ? 'true' : 'false'})"><i class="fa ${updateIcon}" aria-hidden="true"></i></button><button type="button" class="health-breakdown-btn" title="Open health details" aria-label="Open health details for ${safeNameText}" onclick="showFolderHealthBreakdown('${type}','${escapeHtml(id)}')"><i class="fa fa-heartbeat"></i></button><button type="button" class="folder-metric-chip health-chip ${healthStatus.className} ${healthFilterActive ? 'is-filter-active' : ''}" title="${escapeHtml(healthTitle)}" aria-label="${escapeHtml(healthTitle)}" onclick="toggleHealthSeverityFilter('${type}','${escapeHtml(healthStatus.filterSeverity)}')"><span>${escapeHtml(healthStatus.text)}</span></button></span></td>`
                + '<td class="health-cell fv-col-hidden"></td>';
        } else {
            const vmResources = collectVmFolderResources(members, infoByName);
            const membersCount = vmResources.membersCount;
            const autostartCount = vmResources.autostartCount;
            const autostartMembers = vmResources.autostartMembers;
            const vcpusTotal = vmResources.vcpusTotal;
            const memoryKiBTotal = vmResources.memoryKiBTotal;
            const storageBytesTotal = vmResources.storageBytesTotal;
            const autostartRatio = `${autostartCount}/${membersCount}`;
            let autostartClass = 'is-empty';
            let autostartIcon = 'fa-circle-o';
            let autostartText = 'Empty';
            if (membersCount > 0 && autostartCount === membersCount) {
                autostartClass = 'is-ok';
                autostartIcon = 'fa-check-circle';
                autostartText = `All auto ${autostartRatio}`;
            } else if (membersCount > 0 && autostartCount > 0) {
                autostartClass = 'is-paused';
                autostartIcon = 'fa-adjust';
                autostartText = `Mixed ${autostartRatio}`;
            } else if (membersCount > 0) {
                autostartClass = 'is-warning';
                autostartIcon = 'fa-pause-circle';
                autostartText = `Manual ${autostartRatio}`;
            }
            const autostartMembersPreview = autostartMembers.slice(0, 5).join(', ');
            const autostartMembersExtra = autostartMembers.length > 5 ? ` (+${autostartMembers.length - 5} more)` : '';
            const autostartTitle = membersCount <= 0
                ? 'No VMs in this folder.'
                : [
                    `Autostart enabled: ${autostartCount}/${membersCount}`,
                    autostartMembers.length > 0
                        ? `Autostart VMs: ${autostartMembersPreview}${autostartMembersExtra}`
                        : 'Autostart VMs: none'
                ].join('\n');
            const vmHealthPrefs = normalizeHealthPrefs('vm');
            const resourcesBadge = evaluateVmResourceBadge(vmResources, vmHealthPrefs);
            const resourceChips = resourcesBadge.chips || {};
            const cpuChip = resourceChips.cpu || { text: '0 vCPU', className: 'is-empty', title: 'CPU total: 0 vCPU' };
            const memoryChip = resourceChips.memory || { text: '0 GB RAM', className: 'is-empty', title: 'Memory total: 0 GB' };
            const storageChip = resourceChips.storage || { text: '0 B Storage', className: 'is-empty', title: 'Storage total: 0 B' };
            const avgVcpus = membersCount > 0 ? (vcpusTotal / membersCount) : 0;
            const avgMemoryKiB = membersCount > 0 ? Math.round(memoryKiBTotal / membersCount) : 0;
            const avgStorageBytes = membersCount > 0 ? Math.round(storageBytesTotal / membersCount) : 0;
            const avgVcpusText = Number.isInteger(avgVcpus) ? String(avgVcpus) : avgVcpus.toFixed(1);
            const avgMemoryText = formatGiBFromKiB(avgMemoryKiB);
            const avgStorageText = formatBytesShort(avgStorageBytes) || '0 B';
            const resourcesTitle = membersCount <= 0
                ? 'No VMs in this folder.'
                : [
                    `Total: ${resourcesBadge.text}`,
                    `Average per VM: ${avgVcpusText} vCPU | ${avgMemoryText} | ${avgStorageText} storage`
                ].join('\n') + `\n${resourcesBadge.title}`;
            typeSpecificColumns = ''
                + `<td class="autostart-cell"><span class="folder-metric-chip autostart-chip ${autostartClass}" title="${escapeHtml(autostartTitle)}"><i class="fa ${autostartIcon}" aria-hidden="true"></i><span>${escapeHtml(autostartText)}</span></span></td>`
                + `<td class="resources-cell"><span class="vm-resource-stack" title="${escapeHtml(resourcesTitle)}"><span class="folder-metric-chip vm-resource-chip is-cpu ${escapeHtml(String(cpuChip.className || 'is-empty'))}" title="${escapeHtml(String(cpuChip.title || ''))}"><i class="fa fa-microchip" aria-hidden="true"></i><span class="vm-resource-value">${escapeHtml(String(cpuChip.text || '0 vCPU'))}</span></span><span class="folder-metric-chip vm-resource-chip is-ram ${escapeHtml(String(memoryChip.className || 'is-empty'))}" title="${escapeHtml(String(memoryChip.title || ''))}"><i class="fa fa-hdd-o" aria-hidden="true"></i><span class="vm-resource-value">${escapeHtml(String(memoryChip.text || '0 GB RAM'))}</span></span><span class="folder-metric-chip vm-resource-chip is-storage ${escapeHtml(String(storageChip.className || 'is-empty'))}" title="${escapeHtml(String(storageChip.title || ''))}"><i class="fa fa-database" aria-hidden="true"></i><span class="vm-resource-value">${escapeHtml(String(storageChip.text || '0 B Storage'))}</span></span></span></td>`;
        }
        const treeErrorText = String(treeErrors[id] || '').trim();
        const membersTitle = totalMemberCount > directMemberCount
            ? `${directMemberCount} direct members | ${totalMemberCount} including nested folders`
            : `${directMemberCount} direct members`;
        const membersCellHtml = totalMemberCount > directMemberCount
            ? `<span class="folder-member-split" title="${escapeHtml(membersTitle)}"><strong>${directMemberCount}</strong><span class="folder-member-divider">/</span><span>${totalMemberCount}</span></span>`
            : `<span class="folder-member-split" title="${escapeHtml(membersTitle)}"><strong>${directMemberCount}</strong></span>`;
        const memberLabelText = `${totalMemberCount} item${totalMemberCount === 1 ? '' : 's'}`;
        const membersMetaHtml = `<span class="name-cell-members-meta" title="${escapeHtml(membersTitle)}"><i class="fa fa-users" aria-hidden="true"></i><span>${escapeHtml(memberLabelText)}</span></span>`;
        const compactMobileLayout = shouldUseCompactMobileLayout();
        const mobileTreeReorderMode = compactMobileLayout && mobileTreeReorderModeByType[type] === true;
        const hideOrderControls = compactMobileLayout && !mobileTreeReorderMode;
        const rowReorderButtonsHtml = (hideOrderControls || folderDepth > 0)
            ? ''
            : (`<button type="button" title="Move up" aria-label="Move ${safeNameText} up" onclick="moveFolderRow('${type}','${escapeHtml(id)}',-1)"><i class="fa fa-chevron-up"></i></button>`
                + `<button type="button" title="Move down" aria-label="Move ${safeNameText} down" onclick="moveFolderRow('${type}','${escapeHtml(id)}',1)"><i class="fa fa-chevron-down"></i></button>`);
        const moveToRootButtonHtml = (!hideOrderControls && folderDepth > 0)
            ? `<button type="button" class="folder-tree-action" title="Move to root" aria-label="Move ${safeNameText} to root" onclick="moveFolderToRootQuick('${type}','${escapeHtml(id)}')"><i class="fa fa-level-up"></i></button>`
            : '';
        const treeMoveAvailable = (folderCount - (descendantIds.length + 1)) > 0;
        const treeMoveTitle = treeMoveAvailable
            ? `Tree move ${folderNameRaw} (before/inside/after)`
            : 'Tree move unavailable: no valid target folders.';
        const treeMoveButtonHtml = hideOrderControls
            ? ''
            : `<button type="button" class="folder-tree-action" title="${escapeHtml(treeMoveTitle)}" aria-label="${escapeHtml(treeMoveTitle)}" onclick="${treeMoveAvailable ? `openFolderTreeMoveDialog('${type}','${escapeHtml(id)}')` : ''}" ${treeMoveAvailable ? '' : 'disabled'}><i class="fa fa-sitemap"></i></button>`;
        const orderCellHtml = hideOrderControls
            ? ''
            : (''
                + `<div class="row-order-stack">`
                + `<span class="row-order-actions">`
                + rowReorderButtonsHtml
                + moveToRootButtonHtml
                + treeMoveButtonHtml
                + `</span>`
                + (treeErrorText ? `<span class="row-order-error">${escapeHtml(treeErrorText)}</span>` : '')
                + `</div>`);
        rows.push(
            `<tr class="${folderDepth > 0 ? 'is-nested-row' : 'is-root-row'}" data-folder-depth="${folderDepth}" data-folder-id="${escapeHtml(id)}" tabindex="0" onkeydown="handleFolderRowKeydown('${type}','${escapeHtml(id)}',event)">`
            + `<td class="order-cell">${orderCellHtml}</td>`
            + `<td class="name-cell" title="${escapeHtml(id)}"><span class="${nameCellClass}" style="--fv-folder-depth:${folderDepth};">${treeToggleHtml}<img src="${safeIcon}" class="img" onerror="this.src='/plugins/dynamix.docker.manager/images/question.png';"><span class="name-cell-text-wrap"><span class="name-cell-text">${safeNameDisplayHtml}</span>${breadcrumbHtml}${membersMetaHtml}${nestedMetaHtml}</span></span></td>`
            + `<td class="members-cell fv-col-hidden">${membersCellHtml}</td>`
            + `<td class="status-cell"><span class="status-cell-content ${statusDisplayClass}"><button type="button" class="status-breakdown-btn" title="Open status breakdown" aria-label="Open status breakdown for ${safeNameText}" onclick="showFolderStatusBreakdown('${type}','${escapeHtml(id)}')"><i class="fa fa-info-circle"></i></button>${statusSummaryChipHtml}${statusBreakdownHtml}${statusTrendHtml}</span></td>`
            + `<td class="rules-cell" title="${escapeHtml(ruleTitle)}">${escapeHtml(ruleText)}</td>`
            + `<td class="last-changed-cell" title="${escapeHtml(lastChangedRaw || '')}">${escapeHtml(lastChangedText)}</td>`
            + `<td class="pinned-cell"><span class="folder-pin-state ${pinnedClass}">${escapeHtml(pinnedText)}</span></td>`
            + typeSpecificColumns
            + `<td class="actions-cell"><button type="button" class="folder-action-btn folder-pin-btn ${pinned ? 'is-pinned' : ''}" title="${pinTitle}" aria-label="${pinTitle}" onclick="toggleFolderPin('${type}','${escapeHtml(id)}')"><i class="fa ${pinned ? 'fa-star' : 'fa-star-o'}"></i></button><button type="button" class="folder-action-btn" title="Export" aria-label="Export ${safeNameText}" onclick="${type === 'docker' ? 'downloadDocker' : 'downloadVm'}('${escapeHtml(id)}')"><i class="fa fa-download"></i></button><button type="button" class="folder-action-btn" title="Delete" aria-label="Delete ${safeNameText}" onclick="${type === 'docker' ? 'clearDocker' : 'clearVm'}('${escapeHtml(id)}')"><i class="fa fa-trash"></i></button><button type="button" class="folder-action-btn" title="Copy ID" aria-label="Copy ID for ${safeNameText}" onclick="copyFolderId('${type}','${escapeHtml(id)}')"><i class="fa fa-clipboard"></i></button><button type="button" class="folder-action-btn folder-overflow-btn" title="More" aria-label="More actions for ${safeNameText}" data-fv-overflow-type="${escapeHtml(type)}" data-fv-overflow-id="${escapeHtml(id)}"><i class="fa fa-ellipsis-h"></i></button></td>`
            + '</tr>'
        );
    }
    if (rows.length === 0) {
        const suffixes = [];
        if (healthFilterMode !== 'all') {
            suffixes.push(`${getHealthFilterLabel(healthFilterMode)} filter`);
        }
        if (isDockerType && dockerUpdatesOnlyFilter) {
            suffixes.push('updates only');
        }
        if (isDockerType && healthSeverityFilterMode !== 'all') {
            suffixes.push(getHealthSeverityFilterLabel(healthSeverityFilterMode));
        }
        if (statusFilterMode !== 'all') {
            suffixes.push(getStatusFilterLabel(statusFilterMode));
        }
        if (quickFilterMode !== 'all') {
            suffixes.push(`quick ${quickFilterMode} filter`);
        }
        const filterSuffix = suffixes.length ? ` (${suffixes.join(', ')})` : '';
        const showClearFilters = Boolean(
            filter
            || healthFilterMode !== 'all'
            || statusFilterMode !== 'all'
            || quickFilterMode !== 'all'
            || (isDockerType && (dockerUpdatesOnlyFilter || healthSeverityFilterMode !== 'all'))
        );
        const clearButton = showClearFilters
            ? `<button type="button" class="folder-empty-clear-filter" onclick="clearFolderTableFilters('${type}')">Clear filters</button>`
            : '';
        if (folderCount <= 0 && !showClearFilters) {
            const title = isDockerType ? 'No Docker folders yet.' : 'No VM folders yet.';
            const help = isDockerType
                ? 'Start by creating your first folder, importing a JSON export, or running the setup wizard.'
                : 'Start by creating your first VM folder, importing a VM export, or running the setup wizard.';
            const typeValue = isDockerType ? 'docker' : 'vm';
            const createLabel = isDockerType ? 'Create folder' : 'Create VM folder';
            const templatesLabel = isDockerType ? 'Starter templates' : 'VM templates';
            const importLabel = isDockerType ? 'Import config' : 'Import VM config';
            const wizardLabel = isDockerType ? 'Open wizard' : 'Run wizard';
            return `<tr><td colspan="${TABLE_COLUMN_COUNT}" class="folder-empty-cell"><div class="fv-starter-empty"><div class="fv-starter-empty-title">${escapeHtml(title)}</div><div class="fv-starter-empty-help">${escapeHtml(help)}</div><div class="fv-starter-empty-actions"><button type="button" data-fv-empty-action="create" data-fv-type="${escapeHtml(typeValue)}"><i class="fa fa-plus-circle"></i> ${escapeHtml(createLabel)}</button><button type="button" data-fv-empty-action="templates" data-fv-type="${escapeHtml(typeValue)}"><i class="fa fa-th-large"></i> ${escapeHtml(templatesLabel)}</button><button type="button" data-fv-empty-action="import" data-fv-type="${escapeHtml(typeValue)}"><i class="fa fa-upload"></i> ${escapeHtml(importLabel)}</button><button type="button" data-fv-empty-action="wizard"><i class="fa fa-magic"></i> ${escapeHtml(wizardLabel)}</button></div></div></td></tr>`;
        }
        if (folderCount > 0 && hideEmptyFolders && !showClearFilters) {
            return `<tr><td colspan="${TABLE_COLUMN_COUNT}" class="folder-empty-cell">All folders are currently hidden by "Hide empty folders".</td></tr>`;
        }
        return `<tr><td colspan="${TABLE_COLUMN_COUNT}" class="folder-empty-cell">No folders match current filters${filterSuffix}. ${clearButton}</td></tr>`;
    }
    return rows.join('');
};

const currentOrderedIdsFromTable = (type) => {
    const tbodyId = tableIdByType[type];
    return $(`tbody#${tbodyId} tr[data-folder-id]`).map((_, row) => $(row).attr('data-folder-id')).get();
};

const sanitizeManualOrderList = (type, order) => {
    const resolvedType = normalizeManagedType(type);
    const folders = getFolderMap(resolvedType);
    const validIds = new Set(Object.keys(folders || {}));
    const out = [];
    const seen = new Set();
    for (const rawId of (Array.isArray(order) ? order : [])) {
        const id = String(rawId || '').trim();
        if (!id || seen.has(id) || !validIds.has(id)) {
            continue;
        }
        seen.add(id);
        out.push(id);
    }
    for (const id of validIds) {
        if (!seen.has(id)) {
            out.push(id);
        }
    }
    return out;
};

const persistManualOrder = async (type, order, { refresh = true } = {}) => {
    const resolvedType = normalizeManagedType(type);
    const safeOrder = sanitizeManualOrderList(resolvedType, order);
    const reorderResponse = await apiPostJson('/plugins/folderview.plus/server/reorder.php', {
        type: resolvedType,
        order: JSON.stringify(safeOrder)
    });

    if (!reorderResponse.ok) {
        throw new Error(reorderResponse.error || 'Failed to persist folder order.');
    }

    const nextPrefs = utils.normalizePrefs({
        ...prefsByType[resolvedType],
        sortMode: 'manual',
        manualOrder: safeOrder
    });

    try {
        prefsByType[resolvedType] = await postPrefs(resolvedType, nextPrefs);
    } catch (error) {
        prefsByType[resolvedType] = nextPrefs;
    }

    if (refresh) {
        await refreshType(resolvedType);
    }
};

const persistManualOrderFromDom = async (type) => {
    const order = currentOrderedIdsFromTable(type);
    await persistManualOrder(type, order, { refresh: true });
};

const moveFolderRow = async (type, folderId, direction) => {
    const resolvedType = normalizeManagedType(type);
    if (!ensureRuntimeConflictActionAllowed(`Reorder ${resolvedType === 'docker' ? 'Docker' : 'VM'} folders`)) {
        return;
    }

    const safeFolderId = String(folderId || '').trim();
    if (!safeFolderId) {
        return;
    }

    let sortMode = prefsByType[resolvedType]?.sortMode || 'created';
    if (sortMode !== 'manual') {
        await changeSortMode(resolvedType, 'manual');
        sortMode = 'manual';
    }

    if (sortMode !== 'manual') {
        return;
    }

    if (direction !== -1 && direction !== 1) {
        return;
    }

    const folders = getFolderMap(resolvedType);
    if (!Object.prototype.hasOwnProperty.call(folders, safeFolderId)) {
        setFolderTreeMoveError(resolvedType, safeFolderId, 'Folder no longer exists.');
        return;
    }

    const hierarchyMeta = buildFolderHierarchyMeta(folders);
    const parentById = hierarchyMeta.parentById || {};
    const currentParentId = String(parentById[safeFolderId] || '').trim();
    const fullOrder = getOrderedFolderIdsForTreeOps(resolvedType);
    const siblingIds = fullOrder.filter((id) => String(parentById[id] || '').trim() === currentParentId);
    const sourceSiblingIndex = siblingIds.indexOf(safeFolderId);
    if (sourceSiblingIndex < 0) {
        setFolderTreeMoveError(resolvedType, safeFolderId, 'Folder order could not be resolved.');
        return;
    }

    const targetSiblingIndex = sourceSiblingIndex + direction;
    if (targetSiblingIndex < 0 || targetSiblingIndex >= siblingIds.length) {
        setFolderTreeMoveError(
            resolvedType,
            safeFolderId,
            direction < 0
                ? 'Already first in this level. Use Tree move to change level.'
                : 'Already last in this level. Use Tree move to change level.'
        );
        return;
    }

    const targetSiblingId = String(siblingIds[targetSiblingIndex] || '').trim();
    if (!targetSiblingId) {
        setFolderTreeMoveError(resolvedType, safeFolderId, 'No sibling found for this move.');
        return;
    }

    const sourceSubtreeIds = [safeFolderId, ...(hierarchyMeta.descendantsById[safeFolderId] || [])];
    const targetSubtreeIds = [targetSiblingId, ...(hierarchyMeta.descendantsById[targetSiblingId] || [])];
    const sourceSubtreeSet = new Set(sourceSubtreeIds);
    const orderWithoutSource = fullOrder.filter((id) => !sourceSubtreeSet.has(String(id || '')));
    let insertIndex = orderWithoutSource.length;
    if (direction < 0) {
        const firstTargetIndex = orderWithoutSource.findIndex((id) => targetSubtreeIds.includes(String(id || '')));
        insertIndex = firstTargetIndex >= 0 ? firstTargetIndex : orderWithoutSource.length;
    } else {
        const lastTargetIndex = findLastMatchingOrderIndex(orderWithoutSource, targetSubtreeIds);
        insertIndex = lastTargetIndex >= 0 ? (lastTargetIndex + 1) : orderWithoutSource.length;
    }
    const nextOrder = orderWithoutSource.slice();
    nextOrder.splice(Math.max(0, Math.min(insertIndex, nextOrder.length)), 0, ...sourceSubtreeIds);
    const orderChanged = nextOrder.length === fullOrder.length
        && nextOrder.some((id, index) => String(id || '') !== String(fullOrder[index] || ''));
    if (!orderChanged) {
        setFolderTreeMoveError(resolvedType, safeFolderId, 'Folder is already in that position.');
        return;
    }

    let backup = null;

    try {
        clearFolderTreeMoveError(resolvedType, safeFolderId, { rerender: false });
        backup = await createBackup(resolvedType, `before-reorder-${safeFolderId}`);
        await persistManualOrder(resolvedType, nextOrder, { refresh: false });
        await refreshType(resolvedType);
        if (backup?.name) {
            await recordTreeMoveHistoryFromBackup(resolvedType, backup.name, 'Reorder folders', safeFolderId);
        }
        const sourceName = String(folders[safeFolderId]?.name || safeFolderId);
        const targetName = String(folders[targetSiblingId]?.name || targetSiblingId);
        addActivityEntry(`Reordered folder: ${sourceName} ${direction < 0 ? 'before' : 'after'} ${targetName}.`, 'success');
        focusFolderRow(resolvedType, safeFolderId);
    } catch (error) {
        await refreshType(resolvedType);
        setFolderTreeMoveError(resolvedType, safeFolderId, error?.message || 'Order save failed.');
        showError('Order save failed', error);
    }
};

const handleFolderRowKeydown = (type, folderId, event) => {
    if (!event) {
        return;
    }
    if (!event.altKey) {
        return;
    }
    if (event.key === 'ArrowUp') {
        event.preventDefault();
        void moveFolderRow(type, folderId, -1);
        return;
    }
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        void moveFolderRow(type, folderId, 1);
    }
};

const renderFolderSelectOptions = (type) => {
    const folders = getFolderMap(type);
    const entries = Object.entries(folders);
    const hasFolders = entries.length > 0;
    const setOptionsPreserveValue = (selector, html, disabled) => {
        const select = $(selector);
        if (!select.length) {
            return;
        }
        const previous = String(select.val() || '').trim();
        select.html(html).prop('disabled', disabled === true);
        if (!previous) {
            return;
        }
        const hasPrevious = select.find('option').toArray().some((option) => String(option.value || '') === previous);
        if (hasPrevious) {
            select.val(previous);
        }
    };

    const simpleOptions = hasFolders
        ? entries.map(([id, folder]) => `<option value="${escapeHtml(id)}">${escapeHtml(folder.name || id)}</option>`).join('')
        : '<option value="">(Create a folder first)</option>';
    let bulkOptions = '<option value="">(Create a folder first)</option>';
    if (hasFolders) {
        const hierarchyMeta = buildFolderHierarchyMeta(folders);
        const orderedIds = getOrderedFolderIdsForTreeOps(type);
        bulkOptions = orderedIds.map((id) => {
            if (!Object.prototype.hasOwnProperty.call(folders, id)) {
                return '';
            }
            const depth = Math.max(0, Number(hierarchyMeta.depthById?.[id] || 0));
            const indent = depth > 0 ? '&nbsp;'.repeat(Math.min(12, depth) * 2) : '';
            const label = buildFolderPathLabel(type, id, folders, hierarchyMeta);
            return `<option value="${escapeHtml(id)}">${indent}${escapeHtml(label)}</option>`;
        }).join('');
    }

    setOptionsPreserveValue(`#${type}-rule-folder`, simpleOptions, !hasFolders);
    setOptionsPreserveValue(`#${type}-bulk-folder`, bulkOptions, !hasFolders);
    setOptionsPreserveValue(`#${type}-template-source-folder`, simpleOptions, !hasFolders);
    setOptionsPreserveValue(`#${type}-runtime-folder`, simpleOptions, !hasFolders);
    $(`#${type}-bulk-assign-btn`).prop('disabled', !hasFolders);
    if (!hasFolders) {
        $(`#${type}-bulk-help`).text('Create at least one folder first, then assign items here.');
    }
};

const renderBadgeToggles = (type) => {
    const badges = prefsByType[type]?.badges || {};
    $(`#${type}-badge-running`).prop('checked', badges.running !== false);
    $(`#${type}-badge-stopped`).prop('checked', badges.stopped === true);
    if (type === 'docker') {
        $('#docker-badge-updates').prop('checked', badges.updates !== false);
    }
};

const normalizeDashboardPrefsForType = (type, prefsOverride = null) => {
    const sourcePrefs = prefsOverride ? utils.normalizePrefs(prefsOverride) : utils.normalizePrefs(prefsByType[type]);
    const dashboard = sourcePrefs?.dashboard && typeof sourcePrefs.dashboard === 'object'
        ? sourcePrefs.dashboard
        : {};
    const normalizeLayout = typeof utils.normalizeDashboardLayout === 'function'
        ? utils.normalizeDashboardLayout
        : ((value) => {
            const normalized = String(value || '').trim().toLowerCase();
            return ['classic', 'legacy', 'fullwidth', 'accordion', 'inset', 'compactmatrix'].includes(normalized) ? normalized : 'classic';
        });
    return {
        layout: normalizeLayout(dashboard.layout),
        expandToggle: dashboard.expandToggle !== false,
        greyscale: dashboard.greyscale === true,
        folderLabel: dashboard.folderLabel !== false
    };
};

const syncDashboardDependentFields = (type) => {
    const prefs = normalizeDashboardPrefsForType(type);
    const showNonClassicControls = !['classic', 'legacy'].includes(prefs.layout);
    $(`#${type}-dashboard-expand-toggle-row`).toggleClass('is-hidden', !showNonClassicControls);
    $(`#${type}-dashboard-greyscale-row`).toggleClass('is-hidden', !showNonClassicControls);
    $(`#${type}-dashboard-folder-label-row`).toggleClass('is-hidden', !showNonClassicControls);
};

const syncRuntimeDependentFields = (type) => {
    const liveEnabled = $(`#${type}-live-refresh-enabled`).is(':checked');
    const lazyEnabled = $(`#${type}-lazy-preview-enabled`).is(':checked');
    $(`#${type}-live-refresh-seconds-row`).toggleClass('is-hidden', !liveEnabled);
    $(`#${type}-lazy-preview-threshold-row`).toggleClass('is-hidden', !lazyEnabled);
};

const renderDashboardControls = (type) => {
    const dashboard = normalizeDashboardPrefsForType(type);
    $(`#${type}-dashboard-layout`).val(dashboard.layout);
    $(`#${type}-dashboard-expand-toggle`).prop('checked', dashboard.expandToggle === true);
    $(`#${type}-dashboard-greyscale`).prop('checked', dashboard.greyscale === true);
    $(`#${type}-dashboard-folder-label`).prop('checked', dashboard.folderLabel !== false);
    syncDashboardDependentFields(type);
};

const renderRuntimeControls = (type) => {
    const prefs = utils.normalizePrefs(prefsByType[type]);
    $(`#${type}-live-refresh-enabled`).prop('checked', prefs.liveRefreshEnabled === true);
    $(`#${type}-live-refresh-seconds`).val(String(prefs.liveRefreshSeconds || 20));
    $(`#${type}-performance-mode`).prop('checked', prefs.performanceMode === true);
    $(`#${type}-lazy-preview-enabled`).prop('checked', prefs.lazyPreviewEnabled === true);
    $(`#${type}-lazy-preview-threshold`).val(String(prefs.lazyPreviewThreshold || 30));
    $(`#${type}-theme-compat-mode`).val(resolveThemeCompatibilityMode(prefs.themeCompatibilityMode));
    syncRuntimeDependentFields(type);
    applySettingsResolvedThemeTokens(`render-runtime-${type}`);
};

const renderStatusControls = (type) => {
    const status = normalizeStatusPrefs(type);
    $(`#${type}-status-mode`).val(status.mode);
    $(`#${type}-status-display-mode`).val(status.displayMode);
    $(`#${type}-status-trend-enabled`).prop('checked', status.trendEnabled === true);
    $(`#${type}-status-attention-accent`).prop('checked', status.attentionAccent === true);
    $(`#${type}-status-warn-threshold`).val(String(status.warnStoppedPercent));
    const showTrendControl = status.displayMode === 'detailed';
    $(`#${type}-status-trend-row`).toggleClass('is-hidden', !showTrendControl);
};

const renderHealthControls = (type) => {
    const health = normalizeHealthPrefs(type);
    $(`#${type}-health-cards-enabled`).prop('checked', health.cardsEnabled === true);
    $(`#${type}-health-runtime-badge-enabled`).prop('checked', health.runtimeBadgeEnabled === true);
    $(`#${type}-health-compact`).prop('checked', health.compact === true);
    $(`#${type}-health-warn-threshold`).val(String(health.warnStoppedPercent));
    $(`#${type}-health-critical-threshold`).val(String(health.criticalStoppedPercent));
    $(`#${type}-health-profile`).val(health.profile);
    $(`#${type}-health-updates-mode`).val(health.updatesMode);
    $(`#${type}-health-all-stopped-mode`).val(health.allStoppedMode);
    $(`#${type}-resource-warn-vcpu`).val(String(health.vmResourceWarnVcpus));
    $(`#${type}-resource-critical-vcpu`).val(String(health.vmResourceCriticalVcpus));
    $(`#${type}-resource-warn-gib`).val(String(health.vmResourceWarnGiB));
    $(`#${type}-resource-critical-gib`).val(String(health.vmResourceCriticalGiB));
    const showHealthSettings = health.cardsEnabled === true;
    $(`#${type}-health-warn-threshold-row`).toggleClass('is-hidden', !showHealthSettings);
    $(`#${type}-health-critical-threshold-row`).toggleClass('is-hidden', !showHealthSettings);
    $(`#${type}-health-policy-profile-row`).toggleClass('is-hidden', !showHealthSettings);
    $(`#${type}-health-updates-mode-row`).toggleClass('is-hidden', !showHealthSettings);
    $(`#${type}-health-all-stopped-mode-row`).toggleClass('is-hidden', !showHealthSettings);
    const showVmResourceThresholds = showHealthSettings && type === 'vm';
    $(`#${type}-resource-warn-vcpu-row`).toggleClass('is-hidden', !showVmResourceThresholds);
    $(`#${type}-resource-critical-vcpu-row`).toggleClass('is-hidden', !showVmResourceThresholds);
    $(`#${type}-resource-warn-gib-row`).toggleClass('is-hidden', !showVmResourceThresholds);
    $(`#${type}-resource-critical-gib-row`).toggleClass('is-hidden', !showVmResourceThresholds);
    if (health.cardsEnabled !== true) {
        healthFilterByType[type] = 'all';
    }
};

const renderVisibilityControls = (type) => {
    const prefs = utils.normalizePrefs(prefsByType[type]);
    $(`#${type}-hide-empty-folders`).prop('checked', prefs.hideEmptyFolders === true);
    const appColumnWidth = typeof utils.normalizeAppColumnWidth === 'function'
        ? utils.normalizeAppColumnWidth(prefs.appColumnWidth)
        : (['compact', 'wide'].includes(String(prefs.appColumnWidth || '').toLowerCase()) ? String(prefs.appColumnWidth || '').toLowerCase() : 'standard');
    $(`#${type}-app-column-width`).val(appColumnWidth);
    const folderEditorMode = typeof utils.normalizeFolderEditorMode === 'function'
        ? utils.normalizeFolderEditorMode(prefs.folderEditorMode)
        : (String(prefs.folderEditorMode || '').trim().toLowerCase() === 'modern' ? 'modern' : 'legacy');
    $(`#${type}-folder-editor-modern`).prop('checked', folderEditorMode === 'modern');
};

const renderBackupScheduleControls = (type) => {
    const prefs = utils.normalizePrefs(prefsByType[type]);
    const schedule = prefs.backupSchedule || {};
    $(`#${type}-backup-schedule-enabled`).prop('checked', schedule.enabled === true);
    $(`#${type}-backup-interval-hours`).val(String(schedule.intervalHours || 24));
    $(`#${type}-backup-retention`).val(String(schedule.retention || 25));
    const lastRunText = schedule.lastRunAt ? `Last scheduled run: ${formatTimestamp(schedule.lastRunAt)}` : 'Last scheduled run: never';
    $(`#${type}-backup-last-run`).text(lastRunText);
    if (normalizeRecoveryWorkspaceType(activeRecoveryWorkspaceType) === normalizeRecoveryWorkspaceType(type)) {
        $('#recovery-backup-schedule-enabled').prop('checked', schedule.enabled === true);
        $('#recovery-backup-interval-hours').val(String(schedule.intervalHours || 24));
        $('#recovery-backup-retention').val(String(schedule.retention || 25));
        $('#recovery-backup-last-run').text(lastRunText);
    }
};

const renderFilterInputs = (type) => {
    const filterState = filtersByType[type] || {};
    $(`#${type}-folder-filter`).val(filterState.folders || '');
    $(`#${type}-rules-filter`).val(filterState.rules || '');
    $(`#${type}-backups-filter`).val(filterState.backups || '');
    $(`#${type}-templates-filter`).val(filterState.templates || '');
    $(`#${type}-bulk-filter`).val(filterState.bulk || '');
};

const renderQuickFolderFilters = (type) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const active = normalizeQuickFolderFilterMode(quickFolderFilterByType[resolvedType], resolvedType);
    const root = $(`#${resolvedType}-quick-filters`);
    if (!root.length) {
        return;
    }
    root.find('button[data-filter]').each((_, button) => {
        const candidate = normalizeQuickFolderFilterMode($(button).attr('data-filter'), resolvedType);
        $(button).toggleClass('is-active', candidate === active);
    });
};

const buildHealthCardHtml = (type, metrics, healthPrefs) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const title = resolvedType === 'docker' ? 'Docker' : 'VMs';
    const severityClass = metrics.severity === 'danger'
        ? 'is-danger'
        : (metrics.severity === 'warning' ? 'is-warning' : 'is-healthy');
    const statusText = metrics.severity === 'danger'
        ? 'Action needed'
        : (metrics.severity === 'warning' ? 'Watch list' : 'Healthy');
    const statusIcon = metrics.severity === 'danger'
        ? 'fa-exclamation-triangle'
        : (metrics.severity === 'warning' ? 'fa-eye' : 'fa-check-circle');
    const compactClass = healthPrefs.compact ? 'is-compact' : '';
    const activeFilter = normalizeHealthFilterMode(healthFilterByType[resolvedType]);
    const totalRegexIssues = metrics.invalidFolderRegexCount + metrics.invalidRuleRegexCount;
    const folderCount = Number(metrics.folderCount) || 0;
    const attentionCount = Number(metrics.attentionCount) || 0;
    const emptyCount = Number(metrics.folderStatusTotals?.empty) || 0;
    const stoppedFolderCount = Number(metrics.folderStatusTotals?.stopped) || 0;
    const conflictCount = Number(metrics.conflictItemCount) || 0;
    const stoppedMembers = Number(metrics.memberTotals?.stopped) || 0;
    const totalMembers = Number(metrics.memberTotals?.total) || 0;
    const maintenanceCount = Number(metrics.healthSeverityTotals?.maintenance) || 0;
    const summaryHeadline = folderCount <= 0
        ? `No ${title.toLowerCase()} folders are configured yet.`
        : (attentionCount > 0
            ? `${attentionCount} ${title.toLowerCase()} folder${attentionCount === 1 ? '' : 's'} need review.`
            : `${folderCount} ${title.toLowerCase()} folder${folderCount === 1 ? '' : 's'} look healthy.`);
    const detailParts = [];
    if (folderCount > 0) {
        detailParts.push(`${folderCount} folder${folderCount === 1 ? '' : 's'} tracked`);
        if (totalMembers > 0) {
            detailParts.push(`${stoppedMembers}/${totalMembers} members stopped`);
        }
        if (emptyCount > 0) {
            detailParts.push(`${emptyCount} empty`);
        }
        if (stoppedFolderCount > 0) {
            detailParts.push(`${stoppedFolderCount} fully stopped`);
        }
        if (conflictCount > 0) {
            detailParts.push(`${conflictCount} conflict${conflictCount === 1 ? '' : 's'}`);
        }
        if (totalRegexIssues > 0) {
            detailParts.push(`${totalRegexIssues} invalid regex`);
        } else if (maintenanceCount > 0) {
            detailParts.push(`${maintenanceCount} maintenance folder${maintenanceCount === 1 ? '' : 's'}`);
        }
    }
    const summaryDetail = folderCount <= 0
        ? 'Create folders in the Docker or VM table before health tracking can surface issues here.'
        : `${detailParts.join(' • ')}.`;
    const filterLabelMap = {
        all: `All (${folderCount})`,
        attention: `Attention (${attentionCount})`,
        empty: `Empty (${emptyCount})`,
        stopped: `Stopped (${stoppedFolderCount})`,
        conflict: `Conflict (${conflictCount})`
    };
    const pillItems = [
        ['Folders', folderCount],
        ['Attention', attentionCount],
        ['Stopped %', `${escapeHtml(String(metrics.stoppedPercent ?? 0))}%`],
        ['Conflicts', conflictCount],
        ['Regex', totalRegexIssues]
    ].filter(([, value]) => value !== 0 && value !== '0%' && value !== '0');
    const filterButton = (mode, label) => {
        const active = activeFilter === mode ? 'is-active' : '';
        return `<button type="button" class="folder-health-filter ${active}" data-fv-health-filter="${escapeHtml(mode)}" data-fv-health-type="${escapeHtml(resolvedType)}">${escapeHtml(label)}</button>`;
    };

    return `
        <section class="folder-health-card ${severityClass} ${compactClass}">
            <div class="folder-health-card-top">
                <span class="folder-health-card-label">${escapeHtml(title)}</span>
                <span class="folder-health-card-badge"><i class="fa ${statusIcon}" aria-hidden="true"></i>${escapeHtml(statusText)}</span>
            </div>
            <div class="folder-health-card-headline">${escapeHtml(summaryHeadline)}</div>
            <div class="folder-health-card-detail">${escapeHtml(summaryDetail)}</div>
            <div class="folder-health-pill-row">
                ${pillItems.map(([label, value]) => `<span class="folder-health-pill"><span>${escapeHtml(label)}</span><strong>${value}</strong></span>`).join('')}
            </div>
            <div class="folder-health-filter-row">
                ${filterButton('all', filterLabelMap.all)}
                ${filterButton('attention', filterLabelMap.attention)}
                ${filterButton('empty', filterLabelMap.empty)}
                ${filterButton('stopped', filterLabelMap.stopped)}
                ${filterButton('conflict', filterLabelMap.conflict)}
            </div>
            <div class="backup-actions folder-health-actions">
                <button type="button" data-fv-health-action="jump-table" data-fv-health-type="${escapeHtml(resolvedType)}"><i class="fa fa-table"></i> Open ${escapeHtml(title)} table</button>
                <button type="button" data-fv-health-action="scan-conflicts" data-fv-health-type="${escapeHtml(resolvedType)}"><i class="fa fa-search"></i> Scan conflicts</button>
            </div>
        </section>
    `;
};

const buildCleanHealthCardHtml = (type, metrics, healthPrefs) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const title = resolvedType === 'docker' ? 'Docker' : 'VMs';
    const severityClass = metrics.severity === 'danger'
        ? 'is-danger'
        : (metrics.severity === 'warning' ? 'is-warning' : 'is-healthy');
    const statusText = metrics.severity === 'danger'
        ? 'Action needed'
        : (metrics.severity === 'warning' ? 'Watch list' : 'Healthy');
    const statusIcon = metrics.severity === 'danger'
        ? 'fa-exclamation-triangle'
        : (metrics.severity === 'warning' ? 'fa-eye' : 'fa-check-circle');
    const compactClass = healthPrefs.compact ? 'is-compact' : '';
    const activeFilter = normalizeHealthFilterMode(healthFilterByType[resolvedType]);
    const totalRegexIssues = Number(metrics.invalidFolderRegexCount || 0) + Number(metrics.invalidRuleRegexCount || 0);
    const folderCount = Number(metrics.folderCount) || 0;
    const attentionCount = Number(metrics.attentionCount) || 0;
    const emptyCount = Number(metrics.folderStatusTotals?.empty) || 0;
    const stoppedFolderCount = Number(metrics.folderStatusTotals?.stopped) || 0;
    const conflictCount = Number(metrics.conflictItemCount) || 0;
    const stoppedMembers = Number(metrics.memberTotals?.stopped) || 0;
    const totalMembers = Number(metrics.memberTotals?.total) || 0;
    const maintenanceCount = Number(metrics.healthSeverityTotals?.maintenance) || 0;
    const stoppedPercent = `${String(metrics.stoppedPercent ?? 0)}%`;
    const summaryHeadline = folderCount <= 0
        ? `No ${title.toLowerCase()} folders are configured yet.`
        : (attentionCount > 0
            ? `${attentionCount} ${title.toLowerCase()} folder${attentionCount === 1 ? '' : 's'} need review.`
            : `${folderCount} ${title.toLowerCase()} folder${folderCount === 1 ? '' : 's'} look healthy.`);
    const summaryDetail = folderCount <= 0
        ? 'Create folders in the Docker or VM table to start tracking health here.'
        : (attentionCount > 0
            ? 'Use the issue chips or quick filters below to jump straight to the folders that need attention.'
            : 'No empty, conflicting, or fully stopped folders need action right now.');
    const coreStats = [
        ['Folders', String(folderCount)],
        ['Attention', String(attentionCount)],
        ['Stopped %', stoppedPercent]
    ];
    const issueChips = [
        emptyCount > 0 ? `${emptyCount} empty` : '',
        stoppedFolderCount > 0 ? `${stoppedFolderCount} stopped` : '',
        conflictCount > 0 ? `${conflictCount} conflict${conflictCount === 1 ? '' : 's'}` : '',
        totalRegexIssues > 0 ? `${totalRegexIssues} invalid regex` : '',
        totalRegexIssues <= 0 && maintenanceCount > 0 ? `${maintenanceCount} maintenance` : '',
        totalMembers > 0 && stoppedMembers > 0 ? `${stoppedMembers}/${totalMembers} members stopped` : ''
    ].filter((value) => value !== '');
    const filterLabelMap = {
        all: 'All',
        attention: 'Attention',
        empty: 'Empty',
        stopped: 'Stopped',
        conflict: 'Conflict'
    };
    const filterButton = (mode, label) => {
        const active = activeFilter === mode ? 'is-active' : '';
        return `<button type="button" class="folder-health-filter ${active}" data-fv-health-filter="${escapeHtml(mode)}" data-fv-health-type="${escapeHtml(resolvedType)}">${escapeHtml(label)}</button>`;
    };
    const secondaryActionHtml = conflictCount > 0
        ? `<button type="button" data-fv-health-action="scan-conflicts" data-fv-health-type="${escapeHtml(resolvedType)}"><i class="fa fa-search"></i> Review conflicts</button>`
        : (attentionCount > 0
            ? `<button type="button" data-fv-health-action="jump-table" data-fv-health-mode="attention" data-fv-health-type="${escapeHtml(resolvedType)}"><i class="fa fa-filter"></i> Show attention</button>`
            : '');

    return `
        <section class="folder-health-card ${severityClass} ${compactClass}">
            <div class="folder-health-card-top">
                <span class="folder-health-card-label">${escapeHtml(title)}</span>
                <span class="folder-health-card-badge"><i class="fa ${statusIcon}" aria-hidden="true"></i>${escapeHtml(statusText)}</span>
            </div>
            <div class="folder-health-card-headline">${escapeHtml(summaryHeadline)}</div>
            <div class="folder-health-card-detail">${escapeHtml(summaryDetail)}</div>
            <div class="folder-health-stat-grid">
                ${coreStats.map(([label, value]) => `
                    <div class="folder-health-stat-card">
                        <span class="folder-health-stat-label">${escapeHtml(label)}</span>
                        <strong class="folder-health-stat-value">${escapeHtml(value)}</strong>
                    </div>
                `).join('')}
            </div>
            ${issueChips.length > 0 ? `
                <div class="folder-health-issue-row">
                    ${issueChips.map((label) => `<span class="folder-health-issue-chip">${escapeHtml(label)}</span>`).join('')}
                </div>
            ` : ''}
            <div class="folder-health-filter-row">
                ${filterButton('all', filterLabelMap.all)}
                ${filterButton('attention', filterLabelMap.attention)}
                ${filterButton('empty', filterLabelMap.empty)}
                ${filterButton('stopped', filterLabelMap.stopped)}
                ${filterButton('conflict', filterLabelMap.conflict)}
            </div>
            <div class="backup-actions folder-health-actions">
                <button type="button" data-fv-health-action="jump-table" data-fv-health-type="${escapeHtml(resolvedType)}"><i class="fa fa-table"></i> Open ${escapeHtml(title)} table</button>
                ${secondaryActionHtml}
            </div>
        </section>
    `;
};

const renderFolderHealthCards = () => {
    const container = $('#folder-health-content');
    if (!container.length) {
        return;
    }
    const cards = [];
    for (const type of ['docker', 'vm']) {
        const healthPrefs = normalizeHealthPrefs(type);
        if (healthPrefs.cardsEnabled !== true) {
            continue;
        }
        const metrics = healthMetricsByType[type] || buildTypeHealthMetrics(type, getFolderMap(type), getEffectiveMemberSnapshot(type, getFolderMap(type)));
        cards.push(buildCleanHealthCardHtml(type, metrics, healthPrefs));
    }
    if (!cards.length) {
        container.html('<div class="folder-health-empty">Health cards are disabled. Enable them in Docker or VM settings cards.</div>');
        return;
    }
    container.html(cards.join(''));
};

const RULE_REGEX_KINDS = Object.freeze(['name_regex', 'image_regex', 'compose_project_regex']);
const RULE_LABEL_KINDS = Object.freeze(['label', 'label_contains', 'label_starts_with']);

const getRuleKindLabel = (rule) => {
    const kind = String(rule?.kind || 'name_regex').trim().toLowerCase();
    if (kind === 'label') {
        return 'Label equals';
    }
    if (kind === 'label_contains') {
        return 'Label contains';
    }
    if (kind === 'label_starts_with') {
        return 'Label starts with';
    }
    if (kind === 'image_regex') {
        return 'Image regex';
    }
    if (kind === 'compose_project_regex') {
        return 'Compose project regex';
    }
    return 'Name regex';
};

const getAutoRuleProblems = (type, rule) => {
    const issues = [];
    const folderId = String(rule?.folderId || '').trim();
    const folders = getFolderMap(type);
    const kind = String(rule?.kind || 'name_regex').trim().toLowerCase();
    const pattern = String(rule?.pattern || '').trim();
    const labelKey = String(rule?.labelKey || '').trim();
    const labelValue = String(rule?.labelValue || '').trim();

    if (!folderId || !Object.prototype.hasOwnProperty.call(folders || {}, folderId)) {
        issues.push('Missing folder');
    }
    if (RULE_REGEX_KINDS.includes(kind)) {
        if (!pattern) {
            issues.push('Empty regex');
        } else {
            try {
                // eslint-disable-next-line no-new
                new RegExp(pattern);
            } catch (_error) {
                issues.push('Invalid regex');
            }
        }
    }
    if (RULE_LABEL_KINDS.includes(kind) && !labelKey) {
        issues.push('Missing label key');
    }
    if ((kind === 'label_contains' || kind === 'label_starts_with') && !labelValue) {
        issues.push('Missing label value');
    }
    return issues;
};

const ruleDescription = (rule) => {
    const effect = rule?.effect === 'exclude' ? 'Exclude' : 'Include';
    const kind = String(rule?.kind || 'name_regex').trim().toLowerCase();
    if (kind === 'label') {
        return `${effect} when label ${rule?.labelKey || '(missing key)'} ${rule?.labelValue ? `equals "${rule.labelValue}"` : 'exists'}`;
    }
    if (kind === 'label_contains') {
        return `${effect} when label ${rule?.labelKey || '(missing key)'} contains "${rule?.labelValue || ''}"`;
    }
    if (kind === 'label_starts_with') {
        return `${effect} when label ${rule?.labelKey || '(missing key)'} starts with "${rule?.labelValue || ''}"`;
    }
    if (kind === 'image_regex') {
        return `${effect} when image matches ${rule?.pattern || '(empty)'}`;
    }
    if (kind === 'compose_project_regex') {
        return `${effect} when compose project matches ${rule?.pattern || '(empty)'}`;
    }
    return `${effect} when name matches ${rule?.pattern || '(empty)'}`;
};

const buildRuleSummaryCopy = (type, rule, folderName) => {
    const targetLabel = type === 'docker' ? 'containers' : 'VMs';
    const effect = rule?.effect === 'exclude' ? 'Exclude' : 'Include';
    const kind = String(rule?.kind || 'name_regex').trim().toLowerCase();
    if (kind === 'label') {
        const labelKey = String(rule?.labelKey || '').trim() || '(missing key)';
        const qualifier = rule?.labelValue ? `equals "${rule.labelValue}"` : 'exists';
        return {
            summary: `${effect} ${targetLabel} when label ${labelKey} ${qualifier}`,
            detail: `Target folder: ${folderName}`
        };
    }
    if (kind === 'label_contains') {
        const labelKey = String(rule?.labelKey || '').trim() || '(missing key)';
        return {
            summary: `${effect} ${targetLabel} when label ${labelKey} contains "${String(rule?.labelValue || '').trim()}"`,
            detail: `Target folder: ${folderName}`
        };
    }
    if (kind === 'label_starts_with') {
        const labelKey = String(rule?.labelKey || '').trim() || '(missing key)';
        return {
            summary: `${effect} ${targetLabel} when label ${labelKey} starts with "${String(rule?.labelValue || '').trim()}"`,
            detail: `Target folder: ${folderName}`
        };
    }
    if (kind === 'image_regex') {
        return {
            summary: `${effect} ${targetLabel} when image matches ${String(rule?.pattern || '(empty)').trim() || '(empty)'}`,
            detail: `Target folder: ${folderName}`
        };
    }
    if (kind === 'compose_project_regex') {
        return {
            summary: `${effect} ${targetLabel} when compose project matches ${String(rule?.pattern || '(empty)').trim() || '(empty)'}`,
            detail: `Target folder: ${folderName}`
        };
    }
    return {
        summary: `${effect} ${targetLabel} when name matches ${String(rule?.pattern || '(empty)').trim() || '(empty)'}`,
        detail: `Target folder: ${folderName}`
    };
};

const renderRulesOverview = (type, rules, filteredRules) => {
    const totalCount = Array.isArray(rules) ? rules.length : 0;
    const activeCount = rules.filter((rule) => rule?.enabled !== false).length;
    const excludeCount = rules.filter((rule) => rule?.effect === 'exclude').length;
    const foldersCovered = new Set(rules.map((rule) => String(rule?.folderId || '').trim()).filter(Boolean)).size;
    const invalidCount = rules.filter((rule) => getAutoRuleProblems(type, rule).length > 0).length;
    const disabledCount = totalCount - activeCount;
    const statusEl = document.getElementById(`${type}-rules-status`);
    const headlineEl = document.getElementById(`${type}-rules-headline`);
    const detailEl = document.getElementById(`${type}-rules-detail`);
    const issueRow = document.getElementById(`${type}-rules-issues`);
    const statMap = {
        [`${type}-rules-total`]: totalCount,
        [`${type}-rules-active`]: activeCount,
        [`${type}-rules-exclude`]: excludeCount,
        [`${type}-rules-folders`]: foldersCovered
    };

    Object.entries(statMap).forEach(([id, value]) => {
        const node = document.getElementById(id);
        if (node instanceof HTMLElement) {
            node.textContent = String(value);
        }
    });

    let statusText = 'No rules yet';
    let headlineText = `No ${type === 'docker' ? 'Docker' : 'VM'} rules yet.`;
    let detailText = `Create your first ${type === 'docker' ? 'Docker container' : 'VM'} rule to automatically sort new items into the right folder.`;

    if (totalCount > 0 && invalidCount > 0) {
        statusText = 'Needs review';
        headlineText = `${invalidCount} ${invalidCount === 1 ? 'rule needs' : 'rules need'} review.`;
        detailText = 'Fix invalid or incomplete rules first so the priority order behaves predictably.';
    } else if (totalCount > 0 && activeCount <= 0) {
        statusText = 'Paused';
        headlineText = `All ${totalCount} ${totalCount === 1 ? 'rule is' : 'rules are'} currently disabled.`;
        detailText = 'Enable at least one rule if you want new items to be assigned automatically.';
    } else if (totalCount > 0) {
        statusText = excludeCount > 0 ? 'Watch excludes' : 'Ready';
        headlineText = `${activeCount} active ${activeCount === 1 ? 'rule is' : 'rules are'} evaluating in priority order.`;
        detailText = 'Rules run from top to bottom. The first matching include or exclude rule decides what happens.';
    }

    if (statusEl instanceof HTMLElement) {
        statusEl.textContent = statusText;
        statusEl.classList.toggle('is-attention', invalidCount > 0 || (totalCount > 0 && activeCount <= 0));
        statusEl.classList.toggle('is-watch', invalidCount <= 0 && excludeCount > 0 && activeCount > 0);
        statusEl.classList.toggle('is-ready', invalidCount <= 0 && activeCount > 0 && excludeCount <= 0);
    }
    if (headlineEl instanceof HTMLElement) {
        headlineEl.textContent = headlineText;
    }
    if (detailEl instanceof HTMLElement) {
        const filteredCount = Array.isArray(filteredRules) ? filteredRules.length : 0;
        detailEl.textContent = filteredCount !== totalCount && totalCount > 0
            ? `${detailText} Showing ${filteredCount} of ${totalCount} rule${totalCount === 1 ? '' : 's'} from the current filter.`
            : detailText;
    }

    if (issueRow instanceof HTMLElement) {
        const issues = [];
        if (invalidCount > 0) {
            issues.push(`<span class="fv-rules-issue-chip is-invalid">${escapeHtml(`${invalidCount} need review`)}</span>`);
        }
        if (disabledCount > 0) {
            issues.push(`<span class="fv-rules-issue-chip">${escapeHtml(`${disabledCount} disabled`)}</span>`);
        }
        if (excludeCount > 0) {
            issues.push(`<span class="fv-rules-issue-chip">${escapeHtml(`${excludeCount} exclude rules`)}</span>`);
        }
        issueRow.innerHTML = issues.join('');
        issueRow.hidden = issues.length <= 0;
    }
};

const buildRuleCardHtml = (type, rule, globalIndex, isSelected) => {
    const folderName = folderNameForId(type, rule.folderId);
    const stateLabel = rule.enabled ? 'Disable' : 'Enable';
    const stateIcon = rule.enabled ? 'fa-eye-slash' : 'fa-eye';
    const upDisabled = globalIndex === 0 ? 'disabled' : '';
    const downDisabled = globalIndex === (prefsByType[type]?.autoRules || []).length - 1 ? 'disabled' : '';
    const checked = isSelected ? 'checked' : '';
    const issues = getAutoRuleProblems(type, rule);
    const summaryCopy = buildRuleSummaryCopy(type, rule, folderName);
    const chips = [
        `<span class="fv-rule-chip ${rule.enabled ? 'is-active' : 'is-muted'}">${escapeHtml(rule.enabled ? 'Active' : 'Disabled')}</span>`,
        `<span class="fv-rule-chip ${rule.effect === 'exclude' ? 'is-warning' : 'is-info'}">${escapeHtml(rule.effect === 'exclude' ? 'Exclude rule' : 'Include rule')}</span>`,
        `<span class="fv-rule-chip">${escapeHtml(getRuleKindLabel(rule))}</span>`,
        ...issues.map((issue) => `<span class="fv-rule-chip is-invalid">${escapeHtml(issue)}</span>`)
    ];

    return `<div class="fv-rule-card${rule.enabled ? '' : ' is-disabled'}${issues.length > 0 ? ' is-invalid' : ''}" data-fv-rule-id="${escapeHtml(rule.id)}">
        <div class="fv-rule-card-select">
            <input type="checkbox" ${checked} onchange="toggleRuleSelection('${type}','${escapeHtml(rule.id)}', this.checked)" aria-label="Select ${escapeHtml(type === 'docker' ? 'Docker' : 'VM')} rule ${globalIndex + 1}">
        </div>
        <div class="fv-rule-card-main">
            <div class="fv-rule-card-top">
                <span class="fv-rule-order-pill">Priority ${globalIndex + 1}</span>
                <span class="rule-priority-actions">
                    <button type="button" ${upDisabled} title="Move up" onclick="moveAutoRule('${type}','${escapeHtml(rule.id)}',-1)"><i class="fa fa-chevron-up"></i></button>
                    <button type="button" ${downDisabled} title="Move down" onclick="moveAutoRule('${type}','${escapeHtml(rule.id)}',1)"><i class="fa fa-chevron-down"></i></button>
                </span>
            </div>
            <div class="fv-rule-card-summary">${escapeHtml(summaryCopy.summary)}</div>
            <div class="fv-rule-card-detail">${escapeHtml(summaryCopy.detail)}</div>
            <div class="fv-rule-card-meta">${chips.join('')}</div>
        </div>
        <div class="fv-rule-card-actions">
            <button type="button" onclick="toggleAutoRule('${type}','${escapeHtml(rule.id)}')"><i class="fa ${stateIcon}"></i> ${escapeHtml(stateLabel)}</button>
            <button type="button" onclick="deleteAutoRule('${type}','${escapeHtml(rule.id)}')"><i class="fa fa-trash"></i> Delete</button>
        </div>
    </div>`;
};

const renderRulesTable = (type) => {
    const rulesBody = $(`#${type}-rules`);
    const rules = prefsByType[type]?.autoRules || [];
    const selected = selectedRuleIdsByType[type] || new Set();
    const validSelected = new Set(Array.from(selected).filter((id) => rules.some((rule) => String(rule.id) === id)));
    selectedRuleIdsByType[type] = validSelected;
    const filter = normalizedFilter(filtersByType[type]?.rules);

    const filteredRules = rules.filter((rule) => {
        const folderName = folderNameForId(type, rule.folderId);
        const haystack = `${folderName} ${ruleDescription(rule)} ${rule.id || ''} ${getRuleKindLabel(rule)}`.toLowerCase();
        return !filter || haystack.includes(filter);
    });

    renderRulesOverview(type, rules, filteredRules);

    const selectionSummary = document.getElementById(`${type}-rules-selection-summary`);
    if (selectionSummary instanceof HTMLElement) {
        const selectedShownCount = filteredRules.filter((rule) => validSelected.has(String(rule.id || ''))).length;
        if (rules.length <= 0) {
            selectionSummary.textContent = `No ${type === 'docker' ? 'Docker' : 'VM'} rules selected.`;
        } else if (selectedShownCount > 0) {
            selectionSummary.textContent = `${selectedShownCount} selected of ${filteredRules.length} shown. Use the bulk actions above to update them together.`;
        } else if (filter) {
            selectionSummary.textContent = `Showing ${filteredRules.length} matching rule${filteredRules.length === 1 ? '' : 's'}.`;
        } else {
            selectionSummary.textContent = `Review the priority order below. The first matching rule wins.`;
        }
    }

    if (!filteredRules.length) {
        const hasFilter = filter.length > 0;
        const title = hasFilter ? 'No rules match your search.' : 'No rules defined yet.';
        const help = hasFilter
            ? 'Try a different search term or clear the rule filter.'
            : `Create your first ${type === 'docker' ? 'Docker container' : 'VM'} rule above.`;
        rulesBody.html(`<div class="fv-rule-list-empty"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(help)}</span></div>`);
        return;
    }

    const cards = filteredRules.map((rule) => {
        const globalIndex = rules.findIndex((item) => item.id === rule.id);
        return buildRuleCardHtml(type, rule, globalIndex, validSelected.has(String(rule.id || '')));
    });
    rulesBody.html(cards.join(''));
};

const getBulkAssignableNames = (type) => {
    const names = new Set();
    const infoByName = infoByType[type] || {};
    for (const name of Object.keys(infoByName || {})) {
        const safeName = String(name || '').trim();
        if (safeName) {
            names.add(safeName);
        }
    }
    const folders = getFolderMap(type);
    for (const folder of Object.values(folders || {})) {
        const members = (utils && typeof utils.normalizeFolderMembers === 'function')
            ? utils.normalizeFolderMembers(folder?.containers || [])
            : (Array.isArray(folder?.containers) ? folder.containers.map((value) => String(value || '').trim()).filter(Boolean) : []);
        for (const member of members) {
            const safeName = String(member || '').trim();
            if (safeName) {
                names.add(safeName);
            }
        }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
};

const getBulkItemsFilterQuery = (type) => {
    const resolvedType = normalizeManagedType(type);
    const fromState = normalizedFilter(filtersByType[resolvedType]?.bulk);
    if (fromState) {
        return fromState;
    }
    return normalizedFilter($(`#${resolvedType}-bulk-filter`).val());
};

const getBulkMemberFolderLookup = (type, foldersInput = null) => {
    const resolvedType = normalizeManagedType(type);
    const folders = utils.normalizeFolderMap(foldersInput || getFolderMap(resolvedType));
    const byName = {};
    const conflicts = {};
    for (const [folderId, folder] of Object.entries(folders || {})) {
        const members = (utils && typeof utils.normalizeFolderMembers === 'function')
            ? utils.normalizeFolderMembers(folder?.containers || [])
            : (Array.isArray(folder?.containers) ? folder.containers.map((value) => String(value || '').trim()).filter(Boolean) : []);
        for (const member of members) {
            const safeName = sanitizeBulkItemName(member);
            if (!safeName) {
                continue;
            }
            const previousFolderId = String(byName[safeName] || '').trim();
            if (!previousFolderId) {
                byName[safeName] = folderId;
                continue;
            }
            if (previousFolderId === folderId) {
                continue;
            }
            if (!Array.isArray(conflicts[safeName])) {
                conflicts[safeName] = [previousFolderId];
            }
            if (!conflicts[safeName].includes(folderId)) {
                conflicts[safeName].push(folderId);
            }
        }
    }
    return { byName, conflicts };
};

const normalizeBulkSelectionForType = (type) => {
    const state = getBulkState(type);
    const validNames = new Set((state.allNames || []).map((name) => sanitizeBulkItemName(name)).filter(Boolean));
    const normalized = new Set();
    for (const value of Array.from(state.selected || [])) {
        const safeName = sanitizeBulkItemName(value);
        if (!safeName || !validNames.has(safeName)) {
            continue;
        }
        normalized.add(safeName);
    }
    state.selected = normalized;
};

const syncBulkLegacySelect = (type, names, { disabled = false } = {}) => {
    const selectEl = document.getElementById(`${type}-bulk-items`);
    if (!(selectEl instanceof HTMLSelectElement)) {
        return;
    }
    const state = getBulkState(type);
    const safeNames = Array.isArray(names)
        ? names.map((name) => sanitizeBulkItemName(name)).filter(Boolean)
        : [];
    if (!safeNames.length) {
        selectEl.innerHTML = '<option value="" disabled>(No items detected yet)</option>';
        selectEl.disabled = true;
        return;
    }
    const selected = state.selected || new Set();
    const options = safeNames
        .map((name) => {
            const isSelected = selected.has(name) ? ' selected' : '';
            return `<option value="${escapeHtml(name)}"${isSelected}>${escapeHtml(name)}</option>`;
        })
        .join('');
    selectEl.innerHTML = options;
    selectEl.disabled = disabled === true;
};

const clearBulkExecutionState = (type) => {
    const state = getBulkState(type);
    state.failedNames = [];
    state.lastResult = null;
};

const updateBulkStepState = (type, plan) => {
    const root = document.querySelector(`.bulk-module[data-fv-bulk-type="${normalizeManagedType(type)}"]`);
    if (!(root instanceof HTMLElement)) {
        return;
    }
    const state = getBulkState(type);
    const hasTarget = Boolean(plan?.targetFolderId);
    const hasSelection = Array.isArray(plan?.selectedNames) && plan.selectedNames.length > 0;
    const hasResult = !!(state.lastResult && typeof state.lastResult === 'object');
    const activeStep = !hasTarget ? 'target' : (!hasSelection ? 'select' : 'review');
    root.setAttribute('data-fv-bulk-active-step', activeStep);
    root.querySelectorAll('.bulk-step-pill[data-fv-bulk-step]').forEach((pill) => {
        if (!(pill instanceof HTMLElement)) {
            return;
        }
        const step = String(pill.getAttribute('data-fv-bulk-step') || '').trim().toLowerCase();
        const isComplete = (step === 'target' && hasTarget)
            || (step === 'select' && hasSelection)
            || (step === 'review' && hasResult && state.applying !== true);
        pill.classList.toggle('is-active', step === activeStep);
        pill.classList.toggle('is-complete', isComplete);
    });
};

const updateBulkSummaryCards = (type, plan) => {
    const state = getBulkState(type);
    const availableCount = Array.isArray(state.allNames) ? state.allNames.length : 0;
    const visibleNames = Array.isArray(state.visibleNames) ? state.visibleNames : [];
    const visibleSelectedCount = visibleNames.filter((name) => state.selected.has(name)).length;
    const hiddenSelectedCount = Math.max(0, (plan?.selectedNames || []).length - visibleSelectedCount);
    const summaryValues = [
        {
            id: `${type}-bulk-target-summary`,
            value: plan?.targetFolderName || 'Choose a folder',
            title: plan?.targetFolderName || 'Pick a target folder before selecting items.',
            ready: Boolean(plan?.targetFolderId)
        },
        {
            id: `${type}-bulk-available-summary`,
            value: String(availableCount),
            title: `${availableCount} item${availableCount === 1 ? '' : 's'} available for assignment.`,
            ready: availableCount > 0
        },
        {
            id: `${type}-bulk-selected-summary`,
            value: String((plan?.selectedNames || []).length),
            title: hiddenSelectedCount > 0
                ? `${hiddenSelectedCount} selected item${hiddenSelectedCount === 1 ? '' : 's'} hidden by the current filter.`
                : `${(plan?.selectedNames || []).length} item${(plan?.selectedNames || []).length === 1 ? '' : 's'} selected.`,
            ready: (plan?.selectedNames || []).length > 0
        },
        {
            id: `${type}-bulk-action-summary`,
            value: String((plan?.actionableNames || []).length),
            title: plan?.targetFolderId
                ? `${(plan?.actionableNames || []).length} item${(plan?.actionableNames || []).length === 1 ? '' : 's'} will change folders.`
                : 'Select a target folder to see how many items will change.',
            ready: (plan?.actionableNames || []).length > 0
        }
    ];
    for (const entry of summaryValues) {
        const node = document.getElementById(entry.id);
        if (!(node instanceof HTMLElement)) {
            continue;
        }
        node.textContent = entry.value;
        node.title = entry.title;
        const card = node.closest('.bulk-summary-card');
        if (card instanceof HTMLElement) {
            card.classList.toggle('is-ready', entry.ready === true);
            card.classList.toggle('is-empty', entry.ready !== true);
        }
    }
};

const updateBulkPrimaryAction = (type, plan) => {
    const button = document.getElementById(`${type}-bulk-assign-btn`);
    if (!(button instanceof HTMLButtonElement)) {
        return;
    }
    const state = getBulkState(type);
    const folderSelect = document.getElementById(`${type}-bulk-folder`);
    const folderSelectDisabled = folderSelect instanceof HTMLSelectElement && folderSelect.disabled === true;
    let icon = 'fa-list-alt';
    let label = 'Preview changes';
    let disabled = false;
    if (state.applying === true) {
        icon = 'fa-spinner fa-spin';
        label = 'Applying changes';
        disabled = true;
    } else if (folderSelectDisabled) {
        icon = 'fa-folder-open-o';
        label = 'Create a folder first';
        disabled = true;
    } else if (!plan?.targetFolderId) {
        icon = 'fa-crosshairs';
        label = 'Choose target first';
        disabled = true;
    } else if (!Array.isArray(plan?.selectedNames) || plan.selectedNames.length <= 0) {
        icon = 'fa-check-square-o';
        label = 'Select items first';
        disabled = true;
    } else if (!Array.isArray(plan?.actionableNames) || plan.actionableNames.length <= 0) {
        icon = 'fa-check';
        label = 'No changes needed';
        disabled = true;
    } else {
        const changeCount = plan.actionableNames.length;
        icon = 'fa-check';
        label = `Apply ${changeCount} change${changeCount === 1 ? '' : 's'}`;
        disabled = false;
    }
    button.innerHTML = `<i class="fa ${icon}"></i> ${escapeHtml(label)}`;
    button.disabled = disabled;
    button.setAttribute('data-fv-bulk-state', state.applying === true ? 'applying' : (disabled ? 'idle' : 'ready'));
};

const syncBulkWorkflowUi = (type, planInput = null) => {
    const resolvedType = normalizeManagedType(type);
    const folderId = String($(`#${resolvedType}-bulk-folder`).val() || '').trim();
    const state = getBulkState(resolvedType);
    const plan = planInput && typeof planInput === 'object'
        ? planInput
        : buildBulkAssignmentPlan(resolvedType, folderId, Array.from(state.selected || []));
    updateBulkSummaryCards(resolvedType, plan);
    updateBulkStepState(resolvedType, plan);
    updateBulkPrimaryAction(resolvedType, plan);
    return plan;
};

const renderBulkResultPanel = (type, result = null) => {
    const panel = $(`#${type}-bulk-result`);
    if (!panel.length) {
        return;
    }
    panel.removeClass('is-success is-warning is-error is-progress');
    if (!result || typeof result !== 'object') {
        panel.prop('hidden', true);
        panel.empty();
        syncBulkWorkflowUi(type);
        return;
    }
    panel.prop('hidden', false);
    const level = String(result.level || 'info').toLowerCase();
    if (level === 'success') {
        panel.addClass('is-success');
    } else if (level === 'warning') {
        panel.addClass('is-warning');
    } else if (level === 'error') {
        panel.addClass('is-error');
    } else if (level === 'progress') {
        panel.addClass('is-progress');
    }
    const lines = Array.isArray(result.lines) ? result.lines.slice(0, 220) : [];
    if (!lines.length) {
        panel.html(`<div class="bulk-result-summary">${escapeHtml(String(result.summary || 'No updates.'))}</div>`);
        syncBulkWorkflowUi(type);
        return;
    }
    const rowHtml = lines.map((line) => {
        const status = String(line.status || 'info').trim().toLowerCase();
        const label = status === 'success'
            ? 'Assigned'
            : (status === 'skip' ? 'Skipped' : (status === 'invalid' ? 'Invalid' : (status === 'failed' ? 'Failed' : 'Info')));
        return `<li class="bulk-result-line is-${escapeHtml(status)}">
            <span class="bulk-result-badge">${escapeHtml(label)}</span>
            <span class="bulk-result-name">${escapeHtml(String(line.name || ''))}</span>
            <span class="bulk-result-detail">${escapeHtml(String(line.detail || ''))}</span>
        </li>`;
    }).join('');
    panel.html(`
        <div class="bulk-result-summary">${escapeHtml(String(result.summary || 'Bulk assignment update'))}</div>
        <ul class="bulk-result-list">${rowHtml}</ul>
    `);
    syncBulkWorkflowUi(type);
};

const updateBulkResultActions = (type) => {
    const state = getBulkState(type);
    const retryButton = $(`#${type}-bulk-retry-failed`);
    if (!retryButton.length) {
        return;
    }
    const failedCount = Array.isArray(state.failedNames) ? state.failedNames.length : 0;
    const actionRow = retryButton.closest('.bulk-result-actions');
    retryButton.toggleClass('is-hidden', failedCount <= 0);
    actionRow.toggleClass('is-hidden', failedCount <= 0 || !(state.lastResult && typeof state.lastResult === 'object'));
    retryButton.prop('disabled', state.applying === true);
    if (failedCount > 0) {
        retryButton.html(`<i class="fa fa-repeat"></i> Retry failed (${failedCount})`);
    }
};

const buildBulkAssignmentPlan = (type, folderId, namesInput = null) => {
    const resolvedType = normalizeManagedType(type);
    const folders = getFolderMap(resolvedType);
    const targetFolderId = String(folderId || '').trim();
    const targetFolderName = targetFolderId ? String(folderNameForId(resolvedType, targetFolderId) || targetFolderId) : '';
    const sourceNames = Array.isArray(namesInput) ? namesInput : Array.from(getBulkState(resolvedType).selected || []);
    const deduped = [];
    const duplicateNames = [];
    const seen = new Set();
    for (const value of sourceNames) {
        const safeName = sanitizeBulkItemName(value);
        if (!safeName) {
            continue;
        }
        if (seen.has(safeName)) {
            duplicateNames.push(safeName);
            continue;
        }
        seen.add(safeName);
        deduped.push(safeName);
    }
    const invalidNames = deduped.filter((name) => !isValidBulkItemName(name));
    const validNames = deduped.filter((name) => isValidBulkItemName(name));
    const lookup = getBulkMemberFolderLookup(resolvedType, folders);
    const creates = [];
    const moves = [];
    const unchanged = [];
    const conflicts = [];
    for (const name of validNames) {
        const currentFolderId = String(lookup.byName?.[name] || '').trim();
        if (Array.isArray(lookup.conflicts?.[name]) && lookup.conflicts[name].length > 1) {
            conflicts.push(name);
        }
        if (currentFolderId && currentFolderId === targetFolderId) {
            unchanged.push({
                name,
                currentFolderId,
                currentFolderName: folderNameForId(resolvedType, currentFolderId)
            });
            continue;
        }
        if (currentFolderId) {
            moves.push({
                name,
                currentFolderId,
                currentFolderName: folderNameForId(resolvedType, currentFolderId)
            });
            continue;
        }
        creates.push({ name });
    }
    return {
        type: resolvedType,
        targetFolderId,
        targetFolderName,
        selectedNames: deduped,
        duplicateNames,
        invalidNames,
        validNames,
        creates,
        moves,
        unchanged,
        conflicts,
        actionableNames: [...creates.map((entry) => entry.name), ...moves.map((entry) => entry.name)]
    };
};

const confirmBulkAssignmentPlan = (typeLabel, plan) => new Promise((resolve) => {
    const summary = [
        `Target: ${plan.targetFolderName || plan.targetFolderId}`,
        `Create: ${plan.creates.length}`,
        `Move: ${plan.moves.length}`,
        `Unchanged: ${plan.unchanged.length}`,
        `Invalid: ${plan.invalidNames.length}`,
        `Duplicates dropped: ${plan.duplicateNames.length}`
    ].join('\n');
    swal({
        title: `Apply ${typeLabel} bulk assignment?`,
        text: summary,
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Apply',
        cancelButtonText: 'Cancel',
        closeOnConfirm: true
    }, (confirmed) => {
        resolve(confirmed === true);
    });
});

const updateBulkPreviewPanel = (type) => {
    const panel = $(`#${type}-bulk-preview`);
    if (!panel.length) {
        return;
    }
    const folderId = String($(`#${type}-bulk-folder`).val() || '').trim();
    const plan = syncBulkWorkflowUi(type);
    if (!folderId) {
        panel.html('<div class="bulk-preview-empty">Select a target folder to preview planned changes.</div>');
        return;
    }
    if (!plan.selectedNames.length) {
        panel.html('<div class="bulk-preview-empty">Select one or more items to preview folder moves.</div>');
        return;
    }
    const listLimit = 8;
    const movePreview = plan.moves.slice(0, listLimit)
        .map((entry) => `${entry.name} (${entry.currentFolderName} -> ${plan.targetFolderName})`)
        .join(', ');
    const createPreview = plan.creates.slice(0, listLimit).map((entry) => entry.name).join(', ');
    const unchangedPreview = plan.unchanged.slice(0, listLimit).map((entry) => entry.name).join(', ');
    const previewCounts = [
        ['Create', plan.creates.length, 'create'],
        ['Move', plan.moves.length, 'move'],
        ['Unchanged', plan.unchanged.length, 'skip'],
        ['Invalid', plan.invalidNames.length, 'invalid']
    ];
    if (plan.conflicts.length) {
        previewCounts.push(['Conflicts', plan.conflicts.length, 'conflict']);
    }
    const previewLines = [];
    previewLines.push(`<div class="bulk-preview-line"><strong>Create</strong><span>${createPreview ? escapeHtml(createPreview) : '<span class="bulk-preview-none">none</span>'}${plan.creates.length > listLimit ? `<span class="bulk-preview-more"> (+${plan.creates.length - listLimit} more)</span>` : ''}</span></div>`);
    previewLines.push(`<div class="bulk-preview-line"><strong>Move</strong><span>${movePreview ? escapeHtml(movePreview) : '<span class="bulk-preview-none">none</span>'}${plan.moves.length > listLimit ? `<span class="bulk-preview-more"> (+${plan.moves.length - listLimit} more)</span>` : ''}</span></div>`);
    previewLines.push(`<div class="bulk-preview-line"><strong>Unchanged</strong><span>${unchangedPreview ? escapeHtml(unchangedPreview) : '<span class="bulk-preview-none">none</span>'}${plan.unchanged.length > listLimit ? `<span class="bulk-preview-more"> (+${plan.unchanged.length - listLimit} more)</span>` : ''}</span></div>`);
    if (plan.duplicateNames.length) {
        previewLines.push(`<div class="bulk-preview-line"><strong>Duplicates</strong><span>${escapeHtml(`${plan.duplicateNames.length} duplicate selection${plan.duplicateNames.length === 1 ? '' : 's'} dropped automatically.`)}</span></div>`);
    }
    if (plan.conflicts.length) {
        previewLines.push(`<div class="bulk-preview-line"><strong>Conflicts</strong><span>${escapeHtml(`${plan.conflicts.length} selected item${plan.conflicts.length === 1 ? '' : 's'} already match multiple folders.`)}</span></div>`);
    }
    panel.html(`
        <div class="bulk-preview-summary">${escapeHtml(`Target folder: ${plan.targetFolderName || plan.targetFolderId}`)}</div>
        <div class="bulk-preview-counts">
            ${previewCounts.map(([label, value, stateClass]) => `<span class="bulk-preview-count is-${escapeHtml(String(stateClass))}"><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(String(label))}</span></span>`).join('')}
        </div>
        <div class="bulk-preview-lists">
            ${previewLines.join('')}
        </div>
    `);
};

const updateBulkSelectedCount = (type) => {
    normalizeBulkSelectionForType(type);
    const state = getBulkState(type);
    const selectedCount = state.selected.size;
    const visibleCount = (state.visibleNames || []).length;
    const hiddenSelectedCount = Math.max(0, selectedCount - (state.visibleNames || []).filter((name) => state.selected.has(name)).length);
    let label = `${selectedCount} selected`;
    if (hiddenSelectedCount > 0) {
        label += ` (${hiddenSelectedCount} hidden by filter)`;
    } else if (visibleCount && visibleCount !== (state.allNames || []).length) {
        label += ` (${visibleCount} shown)`;
    }
    $(`#${type}-bulk-selected-count`).text(label);
    syncBulkWorkflowUi(type);
    updateBulkPreviewPanel(type);
    return selectedCount;
};

const updateBulkHelpText = (type, {
    allCount = 0,
    visibleCount = 0,
    filter = ''
} = {}) => {
    const help = $(`#${type}-bulk-help`);
    if (!help.length) {
        return;
    }
    if (!allCount) {
        help.text('No items detected yet. Refresh the page after Docker/VM inventory loads.');
        return;
    }
    if (filter) {
        if (!visibleCount) {
            help.text(`No items match "${filter}". Try a broader filter.`);
            return;
        }
        help.text(`Showing ${visibleCount} of ${allCount} item${allCount === 1 ? '' : 's'} (${BULK_LIST_RENDER_CHUNK_SIZE}/frame render chunks).`);
        return;
    }
    const perfHint = allCount > BULK_LIST_RENDER_CHUNK_SIZE ? ' Rendering is chunked for large inventories.' : '';
    help.text(`${allCount} item${allCount === 1 ? '' : 's'} available for assignment.${perfHint}`);
};

const renderBulkChecklist = (type, visibleNames) => {
    const list = document.getElementById(`${type}-bulk-items-list`);
    if (!(list instanceof HTMLElement)) {
        return;
    }
    const state = getBulkState(type);
    state.renderToken += 1;
    const renderToken = state.renderToken;
    list.innerHTML = '';
    if (!Array.isArray(visibleNames) || !visibleNames.length) {
        list.innerHTML = '<div class="bulk-items-empty">No items match this filter.</div>';
        return;
    }
    const selected = state.selected || new Set();
    let cursor = 0;
    const appendChunk = () => {
        if (renderToken !== state.renderToken) {
            return;
        }
        const end = Math.min(cursor + BULK_LIST_RENDER_CHUNK_SIZE, visibleNames.length);
        const fragment = document.createDocumentFragment();
        while (cursor < end) {
            const name = visibleNames[cursor];
            cursor += 1;
            const row = document.createElement('label');
            row.className = 'bulk-item-row';
            row.title = name;
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'bulk-item-checkbox';
            checkbox.value = name;
            checkbox.checked = selected.has(name);
            checkbox.setAttribute('data-fv-bulk-type', type);
            checkbox.setAttribute('aria-label', `Select ${name}`);
            const nameNode = document.createElement('span');
            nameNode.className = 'bulk-item-name';
            nameNode.textContent = name;
            row.appendChild(checkbox);
            row.appendChild(nameNode);
            fragment.appendChild(row);
        }
        list.appendChild(fragment);
        if (cursor < visibleNames.length) {
            window.requestAnimationFrame(appendChunk);
        }
    };
    appendChunk();
};

const renderBulkItemOptions = (type) => {
    const items = $(`#${type}-bulk-items`);
    if (!items.length) {
        return;
    }
    const state = getBulkState(type);
    const hasTargetFolders = $(`#${type}-bulk-folder`).prop('disabled') !== true;
    const allNames = getBulkAssignableNames(type);
    const filter = getBulkItemsFilterQuery(type);
    const visibleNames = filter
        ? allNames.filter((name) => name.toLowerCase().includes(filter))
        : allNames;
    state.allNames = allNames;
    state.visibleNames = visibleNames;
    normalizeBulkSelectionForType(type);
    syncBulkLegacySelect(type, allNames, { disabled: !hasTargetFolders || !allNames.length });
    if (!allNames.length) {
        renderBulkChecklist(type, []);
        renderBulkResultPanel(type, state.lastResult);
        updateBulkResultActions(type);
        updateBulkSelectedCount(type);
        updateBulkHelpText(type, { allCount: 0, visibleCount: 0, filter });
        return;
    }
    renderBulkChecklist(type, visibleNames);
    updateBulkSelectedCount(type);
    if (!hasTargetFolders) {
        updateBulkHelpText(type, { allCount: 0, visibleCount: 0, filter: '' });
        $(`#${type}-bulk-help`).text('Create a folder first, then assign selected items.');
    } else {
        updateBulkHelpText(type, { allCount: allNames.length, visibleCount: visibleNames.length, filter });
    }
    renderBulkResultPanel(type, state.lastResult);
    updateBulkResultActions(type);
};

const renderBackupRows = (type) => {
    const rowsEl = $(`#${type}-backups`);
    const filter = normalizedFilter(filtersByType[type]?.backups);
    const backups = (backupsByType[type] || []).filter((backup) => {
        if (!filter) {
            return true;
        }
        const haystack = `${String(backup.name || '')} ${String(backup.reason || '')}`.toLowerCase();
        return haystack.includes(filter);
    });
    if (!backups.length) {
        const hasFilter = filter.length > 0;
        const title = hasFilter ? 'No backups match your search.' : 'No backups yet.';
        const help = hasFilter
            ? 'Try another backup search term.'
            : 'Create a manual backup or run an import/change to generate snapshots.';
        rowsEl.html(buildModuleEmptyTableRow(title, help, 4));
        renderBackupCompareControls(type);
        if (normalizeRecoveryWorkspaceType(activeRecoveryWorkspaceType) === normalizeRecoveryWorkspaceType(type)) {
            renderRecoveryWorkspace(type);
        }
        return;
    }

    const rows = backups.map((backup) => {
        const name = String(backup.name || '');
        const count = Number.isFinite(Number(backup.count)) ? Number(backup.count) : '-';
        const reason = backup.reason ? escapeHtml(backup.reason) : '-';
        return `<tr>
            <td>${escapeHtml(formatTimestamp(backup.createdAt))}</td>
            <td>${reason}</td>
            <td>${count}</td>
            <td>
                <button type="button" onclick="restoreBackupEntry('${type}','${escapeHtml(name)}')"><i class="fa fa-history"></i> Restore</button>
                <button type="button" onclick="downloadBackupEntry('${type}','${escapeHtml(name)}')"><i class="fa fa-download"></i> Download</button>
                <button type="button" onclick="deleteBackupEntry('${type}','${escapeHtml(name)}')"><i class="fa fa-trash"></i> Delete</button>
            </td>
        </tr>`;
    });

    rowsEl.html(rows.join(''));
    renderBackupCompareControls(type);
    if (normalizeRecoveryWorkspaceType(activeRecoveryWorkspaceType) === normalizeRecoveryWorkspaceType(type)) {
        renderRecoveryWorkspace(type);
    }
};

// folderviewplus.import.js provides backup comparison helpers.

const renderTemplateRows = (type) => {
    const rowsEl = $(`#${type}-templates`);
    const allTemplates = templatesByType[type] || [];
    const selected = selectedTemplateIdsByType[type] || new Set();
    const validSelected = new Set(Array.from(selected).filter((id) => allTemplates.some((template) => String(template.id || '') === id)));
    selectedTemplateIdsByType[type] = validSelected;
    const filter = normalizedFilter(filtersByType[type]?.templates);
    const templates = allTemplates.filter((template) => {
        if (!filter) {
            return true;
        }
        const haystack = `${String(template.name || '')} ${String(template.id || '')}`.toLowerCase();
        return haystack.includes(filter);
    });
    const folders = getFolderMap(type);
    const folderOptions = Object.entries(folders).map(([id, folder]) => (
        `<option value="${escapeHtml(id)}">${escapeHtml(folder.name || id)}</option>`
    )).join('');

    if (!templates.length) {
        const hasFilter = filter.length > 0;
        const title = hasFilter ? 'No templates match your search.' : 'No templates saved yet.';
        const help = hasFilter
            ? 'Try another template search term.'
            : 'Create a template from an existing folder to reuse icon/settings/actions.';
        rowsEl.html(buildModuleEmptyTableRow(title, help, 4));
        $(`#${type}-templates-select-all`).prop('checked', false);
        return;
    }

    const rows = templates.map((template) => {
        const templateId = String(template.id || '');
        const templateName = String(template.name || templateId);
        const selectId = `${type}-template-target-${templateId}`;
        const checked = validSelected.has(templateId) ? 'checked' : '';
        return `<tr>
            <td><input type="checkbox" ${checked} onchange="toggleTemplateSelection('${type}','${escapeHtml(templateId)}', this.checked)"></td>
            <td>${escapeHtml(templateName)}</td>
            <td>${escapeHtml(formatTimestamp(template.updatedAt || template.createdAt))}</td>
            <td>
                <select id="${escapeHtml(selectId)}">${folderOptions}</select>
                <button type="button" onclick="applyTemplateToFolder('${type}','${escapeHtml(templateId)}','${escapeHtml(selectId)}')"><i class="fa fa-clone"></i> Apply</button>
                <button type="button" onclick="deleteTemplateEntry('${type}','${escapeHtml(templateId)}')"><i class="fa fa-trash"></i> Delete</button>
            </td>
        </tr>`;
    });
    rowsEl.html(rows.join(''));
    const allSelected = templates.every((template) => validSelected.has(String(template.id || '')));
    $(`#${type}-templates-select-all`).prop('checked', allSelected);
};

const renderTable = (type) => {
    if (activeTableColumnResize) {
        stopActiveTableColumnResize(false);
    }
    const folders = getFolderMap(type);
    const ordered = utils.orderFoldersByPrefs(folders, prefsByType[type]);
    const hierarchyMeta = buildFolderHierarchyMeta(ordered);
    const collapsedParents = syncCollapsedTreeParentsForType(type, ordered, hierarchyMeta);
    const memberSnapshot = getEffectiveMemberSnapshot(type, ordered);
    const previousStatusSnapshot = statusSnapshotByType[type] && typeof statusSnapshotByType[type] === 'object'
        ? statusSnapshotByType[type]
        : {};
    const nextStatusSnapshot = buildStatusSnapshot(type, ordered, memberSnapshot, infoByType[type] || {});
    const healthMetrics = buildTypeHealthMetrics(type, ordered, memberSnapshot, prefsByType[type]);
    healthMetricsByType[type] = healthMetrics;
    const hideEmptyFolders = utils.normalizePrefs(prefsByType[type]).hideEmptyFolders === true;

    const sortMode = prefsByType[type]?.sortMode || 'created';
    $(`#${type}-sort-mode`).val(sortMode);
    const tbodyId = tableIdByType[type];
    $(`tbody#${tbodyId}`).html(buildRowsHtml(type, ordered, memberSnapshot, hideEmptyFolders, healthMetrics, {
        previous: previousStatusSnapshot,
        current: nextStatusSnapshot,
        hierarchyMeta,
        collapsedParents
    }));
    if (type === 'vm') {
        rowDetailsDrawerByType.vm = null;
    }
    statusSnapshotByType[type] = nextStatusSnapshot;
    bindRowTouchQuickActions(type);
    syncSettingsTableStateFromPrefs(type);

    renderFolderSelectOptions(type);
    renderBadgeToggles(type);
    renderRuntimeControls(type);
    renderDashboardControls(type);
    renderStatusControls(type);
    renderHealthControls(type);
    renderVisibilityControls(type);
    renderBackupScheduleControls(type);
    renderFilterInputs(type);
    renderQuickFolderFilters(type);
    renderSettingsTableLayoutControls(type);
    renderColumnVisibilityControls(type);
    applyColumnVisibility(type);
    applyColumnWidths(type);
    bindTableColumnResizers(type);
    renderTreeMoveUndoBanner(type);
    applyMobileTreeReorderModeClass(type);
    updateMobileTreePathHint(type);
    renderRulesTable(type);
    syncRulesWorkspaceUi();
    renderBulkItemOptions(type);
    renderTemplateRows(type);
    renderFolderHealthCards();
    renderFirstRunQuickPathPanel();
    updateRuleLiveMatch(type);
    refreshSettingsUx();
    enforceNoHorizontalOverflow();
};

const buildSettingsBootstrapDegradedReason = (type, area, error) => {
    const prefix = `${String(type || '').toUpperCase()} ${String(area || '').trim()} failed to load`;
    const message = trimFatalBannerDiagnosticString(error?.message || error);
    return message ? `${prefix}: ${message}` : prefix;
};

const refreshType = async (type) => {
    const startedAt = perfNowMs();
    recordFatalBannerAction(`Refresh ${type.toUpperCase()} Settings data`);
    setFatalBannerPhase('prefs-fetch');
    markFatalBannerStep(`Fetching ${type} folders and preferences`);
    const results = await Promise.allSettled([
        fetchFolders(type),
        fetchPrefs(type),
        fetchTypeInfo(type)
    ]);
    const degradedReasons = [];
    const foldersResult = results[0];
    const prefsResult = results[1];
    const infoResult = results[2];
    const folders = foldersResult.status === 'fulfilled' ? foldersResult.value : {};
    const rawPrefs = prefsResult.status === 'fulfilled' ? (prefsResult.value || {}) : {};
    const info = infoResult.status === 'fulfilled' ? infoResult.value : {};
    if (foldersResult.status !== 'fulfilled') {
        degradedReasons.push(buildSettingsBootstrapDegradedReason(type, 'folders', foldersResult.reason));
    }
    if (prefsResult.status !== 'fulfilled') {
        degradedReasons.push(buildSettingsBootstrapDegradedReason(type, 'preferences', prefsResult.reason));
    }
    if (infoResult.status !== 'fulfilled') {
        degradedReasons.push(buildSettingsBootstrapDegradedReason(type, 'runtime info', infoResult.reason));
    }

    let normalizedPrefs = utils.normalizePrefs({});
    let normalizeErrorMessage = '';
    try {
        normalizedPrefs = utils.normalizePrefs(rawPrefs || {});
    } catch (error) {
        normalizeErrorMessage = error?.message || String(error);
        degradedReasons.push(buildSettingsBootstrapDegradedReason(type, 'preferences', error));
        recordFatalBannerAction(`Normalize ${type.toUpperCase()} preferences failed`);
        normalizedPrefs = utils.normalizePrefs({});
        annotateFatalBannerError(error, {
            phase: 'prefs-normalize',
            category: 'prefs-corrupt',
            action: `Normalize ${type.toUpperCase()} preferences`
        });
    }

    prefsByType[type] = normalizedPrefs;
    setFatalBannerPrefsStatus({
        fetched: prefsResult.status === 'fulfilled',
        normalized: true,
        sourceType: type,
        rawSchemaVersion: String(rawPrefs?.runtimePrefsSchema || 'unknown'),
        normalizedSchemaVersion: String(prefsByType[type]?.runtimePrefsSchema || 'unknown'),
        fallbackUsed: prefsResult.status !== 'fulfilled' || normalizeErrorMessage !== '',
        migrationApplied: String(rawPrefs?.runtimePrefsSchema || '') !== String(prefsByType[type]?.runtimePrefsSchema || ''),
        normalizeError: normalizeErrorMessage
    });
    setFatalBannerPhase('render');
    infoByType[type] = info && typeof info === 'object' ? info : {};
    setTypeFolders(type, utils.normalizeFolderMap(folders || {}));
    renderTable(type);
    markFatalBannerStep(`Rendered ${type} settings table`);
    recordPerformanceDiagnosticsSample('refresh', type, perfNowMs() - startedAt, {
        folderCount: Object.keys(utils.normalizeFolderMap(folders || {})).length,
        infoCount: Object.keys(info || {}).length
    });
    return {
        hasErrors: degradedReasons.length > 0,
        degradedReasons
    };
};

const getAdvancedModuleLoadEntry = (moduleKey) => {
    if (!Object.prototype.hasOwnProperty.call(advancedDataLoadState.modules, moduleKey)) {
        return null;
    }
    return advancedDataLoadState.modules[moduleKey];
};

const markAdvancedModuleLoadSuccess = (moduleKey) => {
    const state = getAdvancedModuleLoadEntry(moduleKey);
    if (!state) {
        return;
    }
    state.loaded = true;
    state.lastLoadedAt = Date.now();
    state.lastErrorAt = 0;
    state.lastErrorMessage = '';
    setAdvancedModuleStatus(moduleKey, 'idle', '');
};

const markAdvancedModuleLoadError = (moduleKey, error) => {
    const state = getAdvancedModuleLoadEntry(moduleKey);
    if (!state) {
        return;
    }
    const message = error?.message || String(error || 'Unknown error');
    state.loaded = false;
    state.lastErrorAt = Date.now();
    state.lastErrorMessage = message;
    setAdvancedModuleStatus(moduleKey, 'error', message);
};

const isAdvancedModuleStale = (moduleKey, force = false) => {
    if (force === true) {
        return true;
    }
    const state = getAdvancedModuleLoadEntry(moduleKey);
    if (!state || state.loaded !== true) {
        return true;
    }
    const age = Date.now() - Number(state.lastLoadedAt || 0);
    return !Number.isFinite(age) || age >= ADVANCED_MODULE_STALE_MS;
};

const refreshBackups = async (type, { quiet = false } = {}) => {
    const resolvedType = normalizeManagedType(type);
    const moduleKey = `${resolvedType}_backups`;
    setAdvancedModuleStatus(moduleKey, 'loading');
    try {
        backupsByType[resolvedType] = await fetchBackups(resolvedType);
        markAdvancedModuleLoadSuccess(moduleKey);
    } catch (error) {
        backupsByType[resolvedType] = [];
        markAdvancedModuleLoadError(moduleKey, error);
        if (!quiet) {
            showError(`Failed to load ${resolvedType.toUpperCase()} backups`, error);
        }
        renderBackupRows(resolvedType);
        renderBackupScheduleControls(resolvedType);
        refreshSettingsUx();
        return false;
    }
    renderBackupRows(resolvedType);
    renderBackupScheduleControls(resolvedType);
    refreshSettingsUx();
    return true;
};

const refreshTemplates = async (type, { quiet = false } = {}) => {
    const resolvedType = normalizeManagedType(type);
    const moduleKey = `${resolvedType}_templates`;
    setAdvancedModuleStatus(moduleKey, 'loading');
    try {
        templatesByType[resolvedType] = await fetchTemplates(resolvedType);
        markAdvancedModuleLoadSuccess(moduleKey);
    } catch (error) {
        templatesByType[resolvedType] = [];
        markAdvancedModuleLoadError(moduleKey, error);
        if (!quiet) {
            showError(`Failed to load ${resolvedType.toUpperCase()} templates`, error);
        }
        renderTemplateRows(resolvedType);
        refreshSettingsUx();
        return false;
    }
    renderTemplateRows(resolvedType);
    refreshSettingsUx();
    return true;
};

const ensureAdvancedDataLoaded = async (options = {}) => {
    const resolvedOptions = options && typeof options === 'object' ? options : {};
    const force = resolvedOptions.force === true;
    const requestedModules = getRequestedAdvancedModuleKeys({
        force,
        explicitModules: resolvedOptions.modules,
        tab: resolvedOptions.tab ?? null,
        includeSearchAll: resolvedOptions.includeSearchAll === true
            || (settingsUiState.searchAllAdvanced === true && Boolean(settingsUiState.query))
    });
    if (requestedModules.length <= 0) {
        advancedDataLoadState.loaded = ADVANCED_MODULE_KEYS.every((key) => advancedDataLoadState.modules[key]?.loaded === true);
        return;
    }
    const quiet = resolvedOptions.quiet !== false;

    const runModuleRefresh = async (moduleKey) => {
        const state = getAdvancedModuleLoadEntry(moduleKey);
        if (!state) {
            return;
        }
        if (!isAdvancedModuleStale(moduleKey, force === true)) {
            return;
        }
        if (state.pending) {
            await state.pending;
            return;
        }
        state.pending = (async () => {
            if (moduleKey === 'docker_backups') {
                await refreshBackups('docker', { quiet });
                return;
            }
            if (moduleKey === 'vm_backups') {
                await refreshBackups('vm', { quiet });
                return;
            }
            if (moduleKey === 'docker_templates') {
                await refreshTemplates('docker', { quiet });
                return;
            }
            if (moduleKey === 'vm_templates') {
                await refreshTemplates('vm', { quiet });
                return;
            }
            if (moduleKey === 'change_history') {
                await refreshChangeHistory({ quiet });
            }
        })();
        try {
            await state.pending;
        } finally {
            state.pending = null;
        }
    };

    const pending = Promise.allSettled(requestedModules.map((moduleKey) => runModuleRefresh(moduleKey)));
    advancedDataLoadState.pending = pending;
    let results = [];
    try {
        results = await pending;
    } finally {
        if (advancedDataLoadState.pending === pending) {
            advancedDataLoadState.pending = null;
        }
        advancedDataLoadState.loaded = ADVANCED_MODULE_KEYS.every((key) => advancedDataLoadState.modules[key]?.loaded === true);
    }
    renderFolderHealthCards();
    return results.flatMap((result, index) => {
        const moduleKey = requestedModules[index];
        if (result.status === 'rejected') {
            return [`${moduleKey} failed to load`];
        }
        if (result.value === false) {
            return [`${moduleKey} returned an incomplete result`];
        }
        return [];
    });
};

const refreshCoreData = async () => {
    const startedAt = perfNowMs();
    const refreshResults = await Promise.all([refreshType('docker'), refreshType('vm')]);
    ensureRegexPresetUi('docker');
    ensureRegexPresetUi('vm');
    toggleRuleKindFields('docker');
    updateRuleLiveMatch('docker');
    updateRuleLiveMatch('vm');
    refreshSettingsUx();
    recordPerformanceDiagnosticsSample('settings', 'bootstrap', perfNowMs() - startedAt, {
        dockerFolders: Object.keys(getFolderMap('docker')).length,
        vmFolders: Object.keys(getFolderMap('vm')).length
    });
    return {
        degradedReasons: refreshResults.flatMap((entry) => Array.isArray(entry?.degradedReasons) ? entry.degradedReasons : [])
    };
};

const refreshAll = async () => {
    const coreResult = await refreshCoreData();
    const advancedFailures = await ensureAdvancedDataLoaded({ force: true });
    refreshSettingsUx();
    return {
        degradedReasons: [
            ...(Array.isArray(coreResult?.degradedReasons) ? coreResult.degradedReasons : []),
            ...(Array.isArray(advancedFailures) ? advancedFailures : [])
        ]
    };
};

const downloadType = async (type, id) => {
    let resolvedType;
    try {
        resolvedType = normalizeManagedType(type);
    } catch (error) {
        showError('Export failed', error);
        return;
    }

    const folders = getFolderMap(resolvedType);
    const progressTotal = 2;
    let progressOpen = false;
    const setProgress = (completed, label) => {
        updateImportApplyProgressDialog({
            completed: Math.max(0, Math.min(progressTotal, completed)),
            total: progressTotal,
            label
        });
    };

    try {
        openImportApplyProgressDialog(resolvedType, progressTotal);
        progressOpen = true;
        setProgress(0, `Preparing ${resolvedType === 'docker' ? 'Docker' : 'VM'} export...`);

        if (id) {
            const folder = folders[id];
            if (!folder) {
                throw new Error('Folder not found for export.');
            }
            const payload = utils.buildSingleExportPayload({
                type: resolvedType,
                folderId: id,
                folder,
                pluginVersion
            });
            downloadFile(`${folder.name}.json`, toPrettyJson(payload));
            setProgress(progressTotal, 'Export download started.');
            await trackDiagnosticsEvent({
                eventType: 'export',
                type: resolvedType,
                details: {
                    mode: 'single',
                    folderCount: 1,
                    schemaVersion: utils.EXPORT_SCHEMA_VERSION
                }
            });
            await new Promise((resolve) => setTimeout(resolve, 140));
            return;
        }

        const payload = utils.buildFullExportPayload({
            type: resolvedType,
            folders,
            pluginVersion
        });

        const name = resolvedType === 'docker' ? `${EXPORT_BASENAME}.json` : `${EXPORT_BASENAME} VM.json`;
        downloadFile(name, toPrettyJson(payload));
        setProgress(progressTotal, 'Export download started.');
        await trackDiagnosticsEvent({
            eventType: 'export',
            type: resolvedType,
            details: {
                mode: 'full',
                folderCount: Object.keys(folders).length,
                schemaVersion: utils.EXPORT_SCHEMA_VERSION
            }
        });
        await new Promise((resolve) => setTimeout(resolve, 140));
    } catch (error) {
        showError('Export failed', error);
    } finally {
        if (progressOpen) {
            closeImportApplyProgressDialog();
        }
    }
};
const importType = async (type) => {
    let resolvedType;
    try {
        resolvedType = normalizeManagedType(type);
    } catch (error) {
        showError('Error', error);
        return;
    }
    if (!ensureRuntimeConflictActionAllowed(`Import ${resolvedType === 'docker' ? 'Docker' : 'VM'} folders`)) {
        return;
    }

    let selected;
    try {
        selected = await selectJsonFile();
    } catch (error) {
        showError('Error', error);
        return;
    }

    if (!selected) {
        return;
    }

    let parsedFile;
    try {
        parsedFile = JSON.parse(selected.text);
    } catch (error) {
        swal({
            title: 'Error',
            text: 'Error parsing the input file, please select a valid JSON file.',
            type: 'error'
        });
        return;
    }

    const parsed = utils.parseImportPayload(parsedFile, resolvedType);
    if (!parsed.ok) {
        swal({
            title: 'Error',
            text: parsed.error || 'Invalid import format.',
            type: 'error'
        });
        return;
    }

    const dialogResult = await showImportPreviewDialog(resolvedType, parsed);
    if (!dialogResult) {
        return;
    }

    const operations = dialogResult.operations;
    if (!operations || countImportOperations(operations) === 0) {
        swal({
            title: 'No changes selected',
            text: 'Nothing was selected to import.',
            type: 'info'
        });
        return;
    }

    if (dialogResult.dryRunOnly) {
        await trackDiagnosticsEvent({
            eventType: 'import_dry_run',
            type: resolvedType,
            details: {
                mode: dialogResult.mode,
                creates: operations.creates.length,
                updates: operations.upserts.length,
                deletes: operations.deletes.length
            }
        });
        swal({
            title: 'Dry run complete',
            text: `No changes were applied.\nCreates: ${operations.creates.length}, Updates: ${operations.upserts.length}, Deletes: ${operations.deletes.length}`,
            type: 'success'
        });
        return;
    }

    let transactionBackup = null;
    const operationCount = countImportOperations(operations);
    const syncStepCount = resolvedType === 'docker' ? 1 : 0;
    const progressTotal = Math.max(3, operationCount + syncStepCount + 2);
    let progressOpen = false;
    const setProgress = (completed, label) => {
        updateImportApplyProgressDialog({
            completed: Math.max(0, Math.min(progressTotal, completed)),
            total: progressTotal,
            label
        });
    };
    try {
        openImportApplyProgressDialog(resolvedType, progressTotal);
        progressOpen = true;
        setProgress(0, 'Creating safety backup...');

        transactionBackup = await createBackup(resolvedType, `before-import-transaction-${dialogResult.mode}`);
        setProgress(1, `Safety backup created: ${transactionBackup?.name || 'ready'}`);

        await applyImportOperations(resolvedType, operations, ({ completed, label }) => {
            setProgress(1 + completed, label || 'Applying import operations...');
        });

        setProgress(progressTotal - 1, `Refreshing ${resolvedType === 'docker' ? 'Docker' : 'VM'} folders...`);
        await Promise.all([refreshType(resolvedType), refreshBackups(resolvedType)]);
        setProgress(progressTotal, 'Import complete.');
        await new Promise((resolve) => setTimeout(resolve, 180));
        closeImportApplyProgressDialog();
        progressOpen = false;

        await trackDiagnosticsEvent({
            eventType: 'import',
            type: resolvedType,
            details: {
                mode: dialogResult.mode,
                creates: operations.creates.length,
                updates: operations.upserts.length,
                deletes: operations.deletes.length
            }
        });
        const affectedFolderIds = resolveAffectedFolderIdsFromOperations(resolvedType, operations);
        const summaryBits = [
            `${operations.creates.length} create${operations.creates.length === 1 ? '' : 's'}`,
            `${operations.upserts.length} update${operations.upserts.length === 1 ? '' : 's'}`,
            `${operations.deletes.length} delete${operations.deletes.length === 1 ? '' : 's'}`
        ];
        showActionSummaryToast({
            title: `${resolvedType === 'docker' ? 'Docker' : 'VM'} import applied`,
            message: summaryBits.join(' | '),
            level: 'success',
            type: resolvedType,
            focusFolderId: affectedFolderIds[0] || ''
        });
        await offerUndoAction(resolvedType, transactionBackup, 'Import');
    } catch (error) {
        if (progressOpen) {
            closeImportApplyProgressDialog();
            progressOpen = false;
        }
        let rollbackMessage = 'No rollback backup available.';
        if (transactionBackup && transactionBackup.name) {
            try {
                await restoreBackupByName(resolvedType, transactionBackup.name);
                await Promise.all([refreshType(resolvedType), refreshBackups(resolvedType)]);
                rollbackMessage = `Automatic rollback restored backup: ${transactionBackup.name}`;
            } catch (rollbackError) {
                rollbackMessage = `Rollback failed: ${rollbackError?.message || rollbackError}`;
            }
        }
        showError('Import failed', new Error(`${error?.message || error}\n${rollbackMessage}`));
    }
};

const clearType = (type, id) => {
    let resolvedType;
    try {
        resolvedType = normalizeManagedType(type);
    } catch (error) {
        showError('Delete failed', error);
        return;
    }
    if (!ensureRuntimeConflictActionAllowed(id ? 'Delete folder' : `Clear all ${resolvedType === 'docker' ? 'Docker' : 'VM'} folders`)) {
        return;
    }
    const folders = getFolderMap(resolvedType);
    const folderName = id ? folders[id]?.name : null;
    const text = id ? `Remove folder: ${folderName || id}` : 'Remove ALL folders';

    swal({
        title: 'Are you sure?',
        text,
        type: 'warning',
        html: true,
        showCancelButton: true,
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel',
        showLoaderOnConfirm: true
    }, async (confirmed) => {
        if (!confirmed) {
            return;
        }

        const deleteIds = id ? [id] : Object.keys(getFolderMap(resolvedType));
        const syncStepCount = resolvedType === 'docker' ? 1 : 0;
        const progressTotal = Math.max(3, deleteIds.length + syncStepCount + 2);
        let progressOpen = false;
        const setProgress = (completed, label) => {
            updateImportApplyProgressDialog({
                completed: Math.max(0, Math.min(progressTotal, completed)),
                total: progressTotal,
                label
            });
        };
        try {
            openImportApplyProgressDialog(resolvedType, progressTotal);
            progressOpen = true;
            setProgress(0, 'Creating safety backup...');

            const backup = await createBackup(resolvedType, id ? `before-delete-${id}` : 'before-clear-all');
            setProgress(1, `Safety backup created: ${backup?.name || 'ready'}`);

            let completed = 1;
            const foldersBeforeDelete = getFolderMap(resolvedType);
            for (const currentId of deleteIds) {
                const currentName = foldersBeforeDelete[currentId]?.name || currentId;
                await apiPostText('/plugins/folderview.plus/server/delete.php', { type: resolvedType, id: currentId });
                completed += 1;
                setProgress(completed, `Deleted ${currentName}`);
            }

            if (resolvedType === 'docker') {
                await syncDockerOrder();
                completed += 1;
                setProgress(completed, 'Synced Docker folder order');
            }

            setProgress(progressTotal - 1, `Refreshing ${resolvedType === 'docker' ? 'Docker' : 'VM'} folders...`);
            await Promise.all([refreshType(resolvedType), refreshBackups(resolvedType)]);
            setProgress(progressTotal, id ? 'Folder deleted.' : 'All folders cleared.');
            await new Promise((resolve) => setTimeout(resolve, 180));
            closeImportApplyProgressDialog();
            progressOpen = false;

            await trackDiagnosticsEvent({
                eventType: id ? 'delete_folder' : 'clear_folders',
                type: resolvedType,
                details: {
                    deletedCount: deleteIds.length,
                    singleFolder: Boolean(id)
                }
            });
            showActionSummaryToast({
                title: id ? 'Folder deleted' : 'Folders cleared',
                message: id
                    ? `Deleted ${folderName || id}.`
                    : `Deleted ${deleteIds.length} folder${deleteIds.length === 1 ? '' : 's'}.`,
                level: 'success'
            });
            await offerUndoAction(resolvedType, backup, id ? 'Delete folder' : 'Clear folders');
        } catch (error) {
            if (progressOpen) {
                closeImportApplyProgressDialog();
            }
            showError('Delete failed', error);
        }
    });
};

const changeSortMode = async (type, mode) => {
    const current = utils.normalizePrefs(prefsByType[type]);
    const next = {
        ...current,
        sortMode: mode
    };

    if (mode === 'manual' && (!Array.isArray(next.manualOrder) || next.manualOrder.length === 0)) {
        next.manualOrder = Object.keys(getFolderMap(type));
    }

    try {
        prefsByType[type] = await postPrefs(type, next);
        await refreshType(type);
    } catch (error) {
        showError('Sort mode save failed', error);
    }
};

const changeBadgePref = async (type, badgeKey, checked) => {
    const current = utils.normalizePrefs(prefsByType[type]);
    const next = {
        ...current,
        badges: {
            ...current.badges,
            [badgeKey]: Boolean(checked)
        }
    };

    try {
        prefsByType[type] = await postPrefs(type, next);
        renderBadgeToggles(type);
    } catch (error) {
        showError('Badge preferences save failed', error);
    }
};

const changeVisibilityPref = async (type, key, value) => {
    const current = utils.normalizePrefs(prefsByType[type]);
    const next = { ...current };
    if (key === 'hideEmptyFolders') {
        next.hideEmptyFolders = value === true;
    } else if (key === 'appColumnWidth') {
        next.appColumnWidth = typeof utils.normalizeAppColumnWidth === 'function'
            ? utils.normalizeAppColumnWidth(value)
            : (['compact', 'wide'].includes(String(value || '').toLowerCase()) ? String(value || '').toLowerCase() : 'standard');
    } else if (key === 'folderEditorMode') {
        next.folderEditorMode = typeof utils.normalizeFolderEditorMode === 'function'
            ? utils.normalizeFolderEditorMode(value)
            : (String(value || '').trim().toLowerCase() === 'modern' ? 'modern' : 'legacy');
        next.folderEditorModeExplicit = true;
    } else {
        return;
    }
    try {
        prefsByType[type] = await postPrefs(type, next);
        renderVisibilityControls(type);
        renderTable(type);
    } catch (error) {
        showError('Visibility preference save failed', error);
    }
};

const changeStatusPref = async (type, key, value) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const current = utils.normalizePrefs(prefsByType[resolvedType]);
    const currentStatus = normalizeStatusPrefs(resolvedType, current);
    const nextStatus = {
        ...currentStatus
    };

    if (key === 'mode') {
        nextStatus.mode = normalizeStatusMode(value);
    } else if (key === 'displayMode') {
        nextStatus.displayMode = normalizeStatusDisplayMode(value);
    } else if (key === 'trendEnabled') {
        nextStatus.trendEnabled = value === true;
    } else if (key === 'attentionAccent') {
        nextStatus.attentionAccent = value === true;
    } else if (key === 'warnStoppedPercent') {
        const parsed = Number(value);
        nextStatus.warnStoppedPercent = Number.isFinite(parsed)
            ? Math.min(100, Math.max(0, Math.round(parsed)))
            : currentStatus.warnStoppedPercent;
    } else {
        return;
    }

    const next = {
        ...current,
        status: nextStatus
    };

    try {
        prefsByType[resolvedType] = await postPrefs(resolvedType, next);
        renderStatusControls(resolvedType);
        renderTable(resolvedType);
    } catch (error) {
        renderStatusControls(resolvedType);
        showError('Status preferences save failed', error);
    }
};

const setHealthFolderFilter = (type, mode) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const nextMode = normalizeHealthFilterMode(mode);
    const healthPrefs = normalizeHealthPrefs(resolvedType);
    healthFilterByType[resolvedType] = healthPrefs.cardsEnabled ? nextMode : 'all';
    persistTableUiState();
    renderTable(resolvedType);
};

const changeColumnVisibility = async (type, key, checked) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const normalized = normalizeColumnVisibilityForType(resolvedType, columnVisibilityByType[resolvedType]);
    if (!Object.prototype.hasOwnProperty.call(normalized, key)) {
        return;
    }
    normalized[key] = checked === true;
    columnVisibilityByType[resolvedType] = normalized;
    columnPresetByType[resolvedType] = 'custom';
    renderColumnVisibilityControls(resolvedType);
    applyColumnVisibility(resolvedType);
    applyColumnWidths(resolvedType);
    bindTableColumnResizers(resolvedType);
    renderSettingsTableLayoutControls(resolvedType);
    await persistSettingsTableState(resolvedType, {
        preset: 'custom',
        columns: normalized
    });
};

const changeSettingsTableColumnWidthPreset = async (type, key, value) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const targetKey = String(key || '').trim().toLowerCase();
    if (targetKey !== 'name' && targetKey !== 'actions') {
        return;
    }
    if (!settingsTableWidthPresetByType[resolvedType] || typeof settingsTableWidthPresetByType[resolvedType] !== 'object') {
        settingsTableWidthPresetByType[resolvedType] = { name: 'standard', actions: 'standard' };
    }
    settingsTableWidthPresetByType[resolvedType][targetKey] = normalizeSettingsTableColumnWidthPreset(value);
    renderSettingsTableLayoutControls(resolvedType);
    applyColumnWidths(resolvedType);
    await persistSettingsTableState(resolvedType, {
        widthMode: 'auto',
        columnWidths: {},
        nameWidth: settingsTableWidthPresetByType[resolvedType].name,
        actionsWidth: settingsTableWidthPresetByType[resolvedType].actions
    });
};

const applySettingsTablePreset = async (type, preset) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const nextPreset = normalizeSettingsTablePreset(preset);
    const nextColumns = buildPresetColumnVisibilityForType(resolvedType, nextPreset);
    columnWidthModeByType[resolvedType] = 'auto';
    columnPresetByType[resolvedType] = nextPreset;
    columnVisibilityByType[resolvedType] = nextColumns;
    columnWidthsByType[resolvedType] = {};
    renderSettingsTableLayoutControls(resolvedType);
    renderColumnVisibilityControls(resolvedType);
    applyColumnVisibility(resolvedType);
    applyColumnWidths(resolvedType);
    bindTableColumnResizers(resolvedType);
    await persistSettingsTableState(resolvedType, {
        widthMode: 'auto',
        preset: nextPreset,
        columns: nextColumns,
        columnWidths: {},
        nameWidth: settingsTableWidthPresetByType[resolvedType]?.name || 'standard',
        actionsWidth: settingsTableWidthPresetByType[resolvedType]?.actions || 'standard'
    });
};

const resetSettingsTableColumns = async (type, mode = 'visibility') => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    if (String(mode) === 'widths') {
        columnWidthModeByType[resolvedType] = 'auto';
        columnWidthsByType[resolvedType] = {};
        settingsTableWidthPresetByType[resolvedType] = { name: 'standard', actions: 'standard' };
        renderSettingsTableLayoutControls(resolvedType);
        applyColumnWidths(resolvedType);
        bindTableColumnResizers(resolvedType);
        await persistSettingsTableState(resolvedType, {
            widthMode: 'auto',
            columnWidths: {},
            nameWidth: 'standard',
            actionsWidth: 'standard'
        });
        return;
    }
    const resetColumns = buildPresetColumnVisibilityForType(resolvedType, 'balanced');
    columnWidthModeByType[resolvedType] = 'auto';
    columnPresetByType[resolvedType] = 'balanced';
    columnVisibilityByType[resolvedType] = resetColumns;
    columnWidthsByType[resolvedType] = {};
    renderSettingsTableLayoutControls(resolvedType);
    renderColumnVisibilityControls(resolvedType);
    applyColumnVisibility(resolvedType);
    applyColumnWidths(resolvedType);
    bindTableColumnResizers(resolvedType);
    await persistSettingsTableState(resolvedType, {
        widthMode: 'auto',
        preset: 'balanced',
        columns: resetColumns,
        columnWidths: {},
        nameWidth: settingsTableWidthPresetByType[resolvedType]?.name || 'standard',
        actionsWidth: settingsTableWidthPresetByType[resolvedType]?.actions || 'standard'
    });
};

const changeHealthPref = async (type, key, value) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const current = utils.normalizePrefs(prefsByType[resolvedType]);
    const currentHealth = normalizeHealthPrefs(resolvedType, current);
    const nextHealth = {
        ...currentHealth
    };

    if (key === 'cardsEnabled') {
        nextHealth.cardsEnabled = value === true;
    } else if (key === 'runtimeBadgeEnabled') {
        nextHealth.runtimeBadgeEnabled = value === true;
    } else if (key === 'compact') {
        nextHealth.compact = value === true;
    } else if (key === 'warnStoppedPercent') {
        const parsed = Number(value);
        nextHealth.warnStoppedPercent = Number.isFinite(parsed)
            ? Math.min(100, Math.max(0, Math.round(parsed)))
            : currentHealth.warnStoppedPercent;
    } else if (key === 'criticalStoppedPercent') {
        const parsed = Number(value);
        nextHealth.criticalStoppedPercent = Number.isFinite(parsed)
            ? Math.min(100, Math.max(0, Math.round(parsed)))
            : currentHealth.criticalStoppedPercent;
    } else if (key === 'profile') {
        nextHealth.profile = normalizeHealthProfile(value, currentHealth.profile);
    } else if (key === 'updatesMode') {
        nextHealth.updatesMode = normalizeHealthUpdatesMode(value, currentHealth.updatesMode);
    } else if (key === 'allStoppedMode') {
        nextHealth.allStoppedMode = normalizeHealthAllStoppedMode(value, currentHealth.allStoppedMode);
    } else if (key === 'resourceWarnVcpu') {
        const parsed = Number(value);
        nextHealth.vmResourceWarnVcpus = Number.isFinite(parsed)
            ? Math.min(512, Math.max(1, Math.round(parsed)))
            : currentHealth.vmResourceWarnVcpus;
    } else if (key === 'resourceCriticalVcpu') {
        const parsed = Number(value);
        nextHealth.vmResourceCriticalVcpus = Number.isFinite(parsed)
            ? Math.min(512, Math.max(1, Math.round(parsed)))
            : currentHealth.vmResourceCriticalVcpus;
    } else if (key === 'resourceWarnGiB') {
        const parsed = Number(value);
        nextHealth.vmResourceWarnGiB = Number.isFinite(parsed)
            ? Math.min(1024, Math.max(1, Math.round(parsed)))
            : currentHealth.vmResourceWarnGiB;
    } else if (key === 'resourceCriticalGiB') {
        const parsed = Number(value);
        nextHealth.vmResourceCriticalGiB = Number.isFinite(parsed)
            ? Math.min(1024, Math.max(1, Math.round(parsed)))
            : currentHealth.vmResourceCriticalGiB;
    } else {
        return;
    }
    if (nextHealth.vmResourceCriticalVcpus <= nextHealth.vmResourceWarnVcpus) {
        nextHealth.vmResourceCriticalVcpus = Math.min(512, nextHealth.vmResourceWarnVcpus + 1);
    }
    if (nextHealth.vmResourceCriticalGiB <= nextHealth.vmResourceWarnGiB) {
        nextHealth.vmResourceCriticalGiB = Math.min(1024, nextHealth.vmResourceWarnGiB + 1);
    }

    const next = {
        ...current,
        health: nextHealth
    };
    if (!nextHealth.cardsEnabled) {
        healthFilterByType[resolvedType] = 'all';
    }

    try {
        prefsByType[resolvedType] = await postPrefs(resolvedType, next);
        renderHealthControls(resolvedType);
        renderTable(resolvedType);
    } catch (error) {
        renderHealthControls(resolvedType);
        showError('Health preferences save failed', error);
    }
};

const toggleFolderPin = async (type, folderId) => {
    const resolvedType = normalizeManagedType(type);
    if (!ensureRuntimeConflictActionAllowed('Pin/unpin folder')) {
        return;
    }
    const id = String(folderId || '');
    if (!id) {
        return;
    }
    const current = utils.normalizePrefs(prefsByType[resolvedType]);
    const pinned = Array.isArray(current.pinnedFolderIds) ? [...current.pinnedFolderIds] : [];
    const exists = pinned.includes(id);
    const nextPinned = exists
        ? pinned.filter((item) => item !== id)
        : [...pinned, id];
    const next = {
        ...current,
        pinnedFolderIds: nextPinned
    };
    let backup = null;
    try {
        backup = await createBackup(resolvedType, exists ? `before-unpin-${id}` : `before-pin-${id}`);
        prefsByType[resolvedType] = await postPrefs(resolvedType, next);
        await refreshType(resolvedType);
        if (backup?.name) {
            await offerUndoAction(resolvedType, backup, exists ? 'Unpin folder' : 'Pin folder');
        }
    } catch (error) {
        showError('Pin update failed', error);
    }
};

const changeRuntimePref = async (type, key, value) => {
    const current = utils.normalizePrefs(prefsByType[type]);
    const next = {
        ...current
    };
    if (key === 'liveRefreshEnabled') {
        next.liveRefreshEnabled = value === true;
    } else if (key === 'liveRefreshSeconds') {
        const parsed = Number(value);
        next.liveRefreshSeconds = Number.isFinite(parsed) ? Math.min(300, Math.max(10, Math.round(parsed))) : current.liveRefreshSeconds;
    } else if (key === 'performanceMode') {
        next.performanceMode = value === true;
    } else if (key === 'lazyPreviewEnabled') {
        next.lazyPreviewEnabled = value === true;
    } else if (key === 'lazyPreviewThreshold') {
        const parsed = Number(value);
        next.lazyPreviewThreshold = Number.isFinite(parsed) ? Math.min(200, Math.max(10, Math.round(parsed))) : current.lazyPreviewThreshold;
    } else if (key === 'themeCompatibilityMode') {
        next.themeCompatibilityMode = resolveThemeCompatibilityMode(value);
    } else {
        return;
    }

    if (key === 'liveRefreshEnabled' || key === 'lazyPreviewEnabled') {
        syncRuntimeDependentFields(type);
    }

    try {
        prefsByType[type] = await postPrefs(type, next);
        renderRuntimeControls(type);
        if (key === 'themeCompatibilityMode') {
            applySettingsResolvedThemeTokens(`pref-${type}`);
            queueSettingsThemeAwareReflow(`theme-compat-${type}`);
        }
    } catch (error) {
        renderRuntimeControls(type);
        showError('Runtime preference save failed', error);
    }
};

const changeDashboardPref = async (type, key, value) => {
    const current = utils.normalizePrefs(prefsByType[type]);
    const dashboard = normalizeDashboardPrefsForType(type, current);
    const nextDashboard = {
        ...dashboard
    };

    if (key === 'layout') {
        const normalizeLayout = typeof utils.normalizeDashboardLayout === 'function'
            ? utils.normalizeDashboardLayout
            : ((layoutValue) => {
                const normalized = String(layoutValue || '').trim().toLowerCase();
                return ['classic', 'legacy', 'fullwidth', 'accordion', 'inset', 'compactmatrix'].includes(normalized) ? normalized : 'classic';
            });
        nextDashboard.layout = normalizeLayout(value);
    } else if (key === 'expandToggle') {
        nextDashboard.expandToggle = value === true;
    } else if (key === 'greyscale') {
        nextDashboard.greyscale = value === true;
    } else if (key === 'folderLabel') {
        nextDashboard.folderLabel = value === true;
    } else {
        return;
    }

    const next = {
        ...current,
        dashboard: nextDashboard
    };

    try {
        prefsByType[type] = await postPrefs(type, next);
        renderDashboardControls(type);
    } catch (error) {
        renderDashboardControls(type);
        showError('Dashboard preference save failed', error);
    }
};

const changeBackupSchedulePref = async (type, key, value) => {
    const current = utils.normalizePrefs(prefsByType[type]);
    const schedule = {
        ...(current.backupSchedule || {})
    };

    if (key === 'enabled') {
        schedule.enabled = value === true;
    } else if (key === 'intervalHours') {
        const parsed = Number(value);
        schedule.intervalHours = Number.isFinite(parsed) ? Math.min(168, Math.max(1, Math.round(parsed))) : schedule.intervalHours || 24;
    } else if (key === 'retention') {
        const parsed = Number(value);
        schedule.retention = Number.isFinite(parsed) ? Math.min(200, Math.max(1, Math.round(parsed))) : schedule.retention || 25;
    } else {
        return;
    }

    try {
        prefsByType[type] = await postPrefs(type, {
            ...current,
            backupSchedule: schedule
        });
        renderBackupScheduleControls(type);
        if (normalizeRecoveryWorkspaceType(activeRecoveryWorkspaceType) === normalizeRecoveryWorkspaceType(type)) {
            renderRecoveryWorkspace(type);
        }
    } catch (error) {
        showError('Backup schedule save failed', error);
    }
};

const addAutoRule = async (type) => {
    const folderId = String($(`#${type}-rule-folder`).val() || '');
    const effect = String($(`#${type}-rule-effect`).val() || 'include');
    const kind = String($(`#${type}-rule-kind`).val() || 'name_regex');
    const pattern = String($(`#${type}-rule-pattern`).val() || '').trim();
    const labelKey = String($(`#${type}-rule-label-key`).val() || '').trim();
    const labelValue = String($(`#${type}-rule-label-value`).val() || '').trim();
    const regexKinds = ['name_regex', 'image_regex', 'compose_project_regex'];
    const labelKinds = ['label', 'label_contains', 'label_starts_with'];

    if (!folderId) {
        swal({ title: 'Error', text: 'Select a folder before adding a rule.', type: 'error' });
        return;
    }

    if (regexKinds.includes(kind)) {
        if (!pattern) {
            swal({ title: 'Error', text: 'Regex pattern cannot be empty.', type: 'error' });
            return;
        }
        try {
            new RegExp(pattern);
        } catch (error) {
            swal({ title: 'Error', text: `Invalid regex: ${error.message}`, type: 'error' });
            return;
        }
    }

    if (labelKinds.includes(kind) && !labelKey) {
        swal({ title: 'Error', text: 'Label key cannot be empty for label rules.', type: 'error' });
        return;
    }
    if ((kind === 'label_contains' || kind === 'label_starts_with') && !labelValue) {
        swal({ title: 'Error', text: 'Label value cannot be empty for contains/starts-with rules.', type: 'error' });
        return;
    }

    const nextRule = {
        id: `rule-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        enabled: true,
        folderId,
        effect: effect === 'exclude' ? 'exclude' : 'include',
        kind,
        pattern: regexKinds.includes(kind) ? pattern : '',
        labelKey: labelKinds.includes(kind) ? labelKey : '',
        labelValue: labelKinds.includes(kind) ? labelValue : ''
    };

    try {
        const nextPrefs = utils.normalizePrefs({
            ...prefsByType[type],
            autoRules: [...(prefsByType[type].autoRules || []), nextRule]
        });
        prefsByType[type] = await postPrefs(type, nextPrefs);

        $(`#${type}-rule-pattern`).val('');
        $(`#${type}-rule-label-key`).val('');
        $(`#${type}-rule-label-value`).val('');
        $(`#${type}-rule-effect`).val('include');
        renderRulesTable(type);
    } catch (error) {
        showError('Rule save failed', error);
    }
};

const toggleAutoRule = async (type, ruleId) => {
    const rules = [...(prefsByType[type].autoRules || [])];
    const index = rules.findIndex((rule) => rule.id === ruleId);
    if (index === -1) {
        return;
    }

    rules[index] = {
        ...rules[index],
        enabled: !rules[index].enabled
    };

    try {
        prefsByType[type] = await postPrefs(type, {
            ...prefsByType[type],
            autoRules: rules
        });
        renderRulesTable(type);
    } catch (error) {
        showError('Rule update failed', error);
    }
};

const deleteAutoRule = async (type, ruleId) => {
    const rules = (prefsByType[type].autoRules || []).filter((rule) => rule.id !== ruleId);
    try {
        prefsByType[type] = await postPrefs(type, {
            ...prefsByType[type],
            autoRules: rules
        });
        renderRulesTable(type);
    } catch (error) {
        showError('Rule delete failed', error);
    }
};

const moveAutoRule = async (type, ruleId, direction) => {
    const rules = [...(prefsByType[type].autoRules || [])];
    const index = rules.findIndex((rule) => rule.id === ruleId);
    if (index === -1) {
        return;
    }

    const newIndex = direction < 0 ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= rules.length) {
        return;
    }

    const [moved] = rules.splice(index, 1);
    rules.splice(newIndex, 0, moved);

    try {
        prefsByType[type] = await postPrefs(type, {
            ...prefsByType[type],
            autoRules: rules
        });
        renderRulesTable(type);
    } catch (error) {
        showError('Rule reorder failed', error);
    }
};

const toggleRuleKindFields = (type) => {
    if (type !== 'docker') {
        return;
    }

    const kind = String($('#docker-rule-kind').val() || 'name_regex');
    const regexKinds = ['name_regex', 'image_regex', 'compose_project_regex'];
    const labelKinds = ['label', 'label_contains', 'label_starts_with'];
    $('#docker-rule-pattern').attr('placeholder', kind === 'image_regex'
        ? 'Regex pattern (example: linuxserver/)'
        : kind === 'compose_project_regex'
            ? 'Regex pattern (example: ^media$)'
            : 'Regex pattern (example: ^media-)');
    $('#docker-rule-pattern').toggle(regexKinds.includes(kind));
    $('#docker-rule-label-key').toggle(labelKinds.includes(kind));
    $('#docker-rule-label-value').toggle(labelKinds.includes(kind));
    $('#docker-rule-presets').toggle(regexKinds.includes(kind));
    updateRuleLiveMatch('docker');
    updateRuleValidationHint('docker');
};

const updateRuleValidationHint = (type, strict = false) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const testName = String($(`#${resolvedType}-rule-test-name`).val() || '').trim();
    if (!testName) {
        setInlineValidationHint(
            `${resolvedType}-rule-validation`,
            'Enter a test item name to simulate rule matching.',
            strict ? 'error' : 'info'
        );
        return strict ? false : true;
    }
    if (resolvedType === 'docker') {
        const labelKey = String($('#docker-rule-test-label-key').val() || '').trim();
        const labelValue = String($('#docker-rule-test-label-value').val() || '').trim();
        if (!labelKey && labelValue) {
            setInlineValidationHint('docker-rule-validation', 'Label value is set, but label key is empty.', 'warning');
            return strict ? false : true;
        }
    }
    setInlineValidationHint(`${resolvedType}-rule-validation`, 'Ready to run rule test.', 'success');
    return true;
};

const applyRuleTestSample = (type, sampleId) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const samples = resolvedType === 'docker'
        ? {
            media: {
                name: 'sonarr',
                labelKey: 'com.docker.compose.project',
                labelValue: 'media',
                image: 'linuxserver/sonarr',
                compose: 'media'
            },
            network: {
                name: 'nginx-proxy-manager',
                labelKey: 'com.docker.compose.project',
                labelValue: 'network',
                image: 'jc21/nginx-proxy-manager:latest',
                compose: 'networking'
            },
            database: {
                name: 'postgresql',
                labelKey: 'com.example.stack',
                labelValue: 'database',
                image: 'postgres:16',
                compose: 'data'
            }
        }
        : {
            production: { name: 'prod-db-01' },
            desktop: { name: 'desktop-win11' }
        };
    const sample = samples[String(sampleId || '').trim().toLowerCase()];
    if (!sample) {
        return;
    }
    $(`#${resolvedType}-rule-test-name`).val(sample.name || '');
    if (resolvedType === 'docker') {
        $('#docker-rule-test-label-key').val(sample.labelKey || '');
        $('#docker-rule-test-label-value').val(sample.labelValue || '');
        $('#docker-rule-test-image').val(sample.image || '');
        $('#docker-rule-test-compose').val(sample.compose || '');
    }
    updateRuleValidationHint(resolvedType);
    $(`#${resolvedType}-rule-test-output`).text('Sample loaded. Click "Test rule priority".');
};

const testAutoRule = (type) => {
    const rules = prefsByType[type]?.autoRules || [];
    const output = $(`#${type}-rule-test-output`);

    const hasValidInputs = updateRuleValidationHint(type, true);
    const testName = String($(`#${type}-rule-test-name`).val() || '').trim();
    if (!hasValidInputs) {
        output.text('Fix the highlighted test inputs first.');
        return;
    }
    if (!testName) {
        output.text('Enter a test name first.');
        return;
    }

    const info = {
        ...(infoByType[type] || {})
    };

    if (type === 'docker') {
        const key = String($('#docker-rule-test-label-key').val() || '').trim();
        const value = String($('#docker-rule-test-label-value').val() || '').trim();
        const image = String($('#docker-rule-test-image').val() || '').trim();
        const compose = String($('#docker-rule-test-compose').val() || '').trim();
        if (key) {
            const existing = info[testName] || {};
            const existingLabels = existing.Labels || existing.info?.Config?.Labels || {};
            info[testName] = {
                ...existing,
                Labels: {
                    ...existingLabels,
                    [key]: value || '1'
                }
            };
        }
        if (image) {
            const existing = info[testName] || {};
            info[testName] = {
                ...existing,
                info: {
                    ...(existing.info || {}),
                    Config: {
                        ...((existing.info || {}).Config || {}),
                        Image: image,
                        Labels: {
                            ...(((existing.info || {}).Config || {}).Labels || existing.Labels || {}),
                            ...(compose ? { 'com.docker.compose.project': compose } : {})
                        }
                    }
                }
            };
        } else if (compose) {
            const existing = info[testName] || {};
            const existingLabels = existing.Labels || existing.info?.Config?.Labels || {};
            info[testName] = {
                ...existing,
                Labels: {
                    ...existingLabels,
                    'com.docker.compose.project': compose
                }
            };
        }
    }

    const decision = utils.getAutoRuleDecision({
        rules,
        name: testName,
        infoByName: info,
        type
    });
    const firstMatch = decision.assignedRule;

    if (decision.blockedBy) {
        const blockedPriority = rules.findIndex((rule) => rule.id === decision.blockedBy.id) + 1;
        output.text(`Final result: blocked by exclude rule #${blockedPriority}. ${ruleDescription(decision.blockedBy)}.`);
        return;
    }

    if (!firstMatch) {
        output.text('Final result: no rule matched. This item would stay unassigned.');
        return;
    }

    const priority = rules.findIndex((rule) => rule.id === firstMatch.id) + 1;
    output.text(`Final result: priority #${priority} sends this item to ${folderNameForId(type, firstMatch.folderId)}. ${ruleDescription(firstMatch)}.`);
};

const filterBulkItems = (type, value = '') => {
    const resolvedType = normalizeManagedType(type);
    const displayValue = String(value || '');
    const normalized = normalizedFilter(displayValue);
    if (!filtersByType[resolvedType]) {
        filtersByType[resolvedType] = {
            folders: '',
            rules: '',
            backups: '',
            templates: '',
            bulk: ''
        };
    }
    filtersByType[resolvedType].bulk = normalized;
    const input = $(`#${resolvedType}-bulk-filter`);
    if (input.length && input.val() !== displayValue) {
        input.val(displayValue);
    }
    persistTableUiState();
    renderBulkItemOptions(resolvedType);
};

const bulkItemSelectionAction = (type, action = 'all') => {
    const state = getBulkState(type);
    if (state.applying === true) {
        updateBulkSelectedCount(type);
        return;
    }
    const normalizedAction = String(action || '').trim().toLowerCase();
    const visible = Array.isArray(state.visibleNames) ? state.visibleNames : [];
    for (const name of visible) {
        if (!name) {
            continue;
        }
        if (normalizedAction === 'none') {
            state.selected.delete(name);
        } else if (normalizedAction === 'invert') {
            if (state.selected.has(name)) {
                state.selected.delete(name);
            } else {
                state.selected.add(name);
            }
        } else {
            state.selected.add(name);
        }
    }
    clearBulkExecutionState(type);
    renderBulkResultPanel(type, null);
    updateBulkResultActions(type);
    syncBulkLegacySelect(type, state.allNames || [], { disabled: $(`#${type}-bulk-folder`).prop('disabled') === true });
    renderBulkChecklist(type, state.visibleNames || []);
    updateBulkSelectedCount(type);
};

const setBulkItemChecked = (type, name, checked) => {
    const state = getBulkState(type);
    if (state.applying === true) {
        return;
    }
    const safeName = sanitizeBulkItemName(name);
    if (!safeName) {
        return;
    }
    if (checked === true) {
        state.selected.add(safeName);
    } else {
        state.selected.delete(safeName);
    }
    clearBulkExecutionState(type);
    renderBulkResultPanel(type, null);
    updateBulkResultActions(type);
    syncBulkLegacySelect(type, state.allNames || [], { disabled: $(`#${type}-bulk-folder`).prop('disabled') === true });
    updateBulkSelectedCount(type);
};

const retryFailedBulkItems = async (type) => {
    const state = getBulkState(type);
    const failed = Array.isArray(state.failedNames) ? state.failedNames.map((name) => sanitizeBulkItemName(name)).filter(Boolean) : [];
    if (!failed.length) {
        swal({
            title: 'No failed items',
            text: 'There are no failed items to retry.',
            type: 'info'
        });
        return;
    }
    const folderId = state.lastTargetFolderId || String($(`#${type}-bulk-folder`).val() || '').trim();
    if (!folderId) {
        swal({
            title: 'Missing target folder',
            text: 'Select a target folder before retrying failed items.',
            type: 'error'
        });
        return;
    }
    await assignSelectedItems(type, failed);
};

const assignSelectedItems = async (type, namesOverride = null) => {
    const resolvedType = normalizeManagedType(type);
    const state = getBulkState(resolvedType);
    if (state.applying === true) {
        return;
    }
    const folderId = String($(`#${resolvedType}-bulk-folder`).val() || '');
    const selectedSource = Array.isArray(namesOverride) ? namesOverride : Array.from(state.selected || []);
    const plan = buildBulkAssignmentPlan(resolvedType, folderId, selectedSource);
    const typeLabel = resolvedType === 'docker' ? 'Docker' : 'VM';
    updateBulkPreviewPanel(resolvedType);

    if (!plan.targetFolderId) {
        swal({ title: 'Error', text: 'Select a folder for bulk assignment.', type: 'error' });
        return;
    }
    const folders = getFolderMap(resolvedType);
    if (!Object.prototype.hasOwnProperty.call(folders, plan.targetFolderId)) {
        swal({ title: 'Error', text: 'Target folder no longer exists. Refresh and try again.', type: 'error' });
        return;
    }
    if (!plan.selectedNames.length) {
        swal({ title: 'Error', text: 'Select at least one item to assign.', type: 'error' });
        return;
    }
    const resultLines = [];
    for (const name of plan.invalidNames) {
        resultLines.push({ status: 'invalid', name, detail: 'Blocked by validation guard.' });
    }
    for (const name of plan.unchanged.map((entry) => entry.name)) {
        resultLines.push({ status: 'skip', name, detail: 'Already assigned to the selected folder.' });
    }
    if (plan.duplicateNames.length > 0) {
        const uniqueDuplicateNames = Array.from(new Set(plan.duplicateNames));
        for (const name of uniqueDuplicateNames) {
            resultLines.push({ status: 'skip', name, detail: 'Duplicate selection dropped.' });
        }
    }
    if (!plan.actionableNames.length) {
        const summary = `No-op: all selected ${typeLabel} items are already assigned or invalid.`;
        state.lastResult = {
            level: 'warning',
            summary,
            lines: resultLines
        };
        state.failedNames = [];
        renderBulkResultPanel(resolvedType, state.lastResult);
        updateBulkResultActions(resolvedType);
        swal({ title: 'Nothing to apply', text: summary, type: 'info' });
        return;
    }
    const confirmed = await confirmBulkAssignmentPlan(typeLabel, plan);
    if (!confirmed) {
        return;
    }
    if (!claimAdvancedOperationLock(resolvedType, 'bulk', `${typeLabel} bulk assignment`)) {
        return;
    }
    let backup = null;
    state.applying = true;
    updateBulkPrimaryAction(resolvedType, plan);
    updateBulkResultActions(resolvedType);
    renderBulkResultPanel(resolvedType, {
        level: 'progress',
        summary: `Applying ${plan.actionableNames.length} item${plan.actionableNames.length === 1 ? '' : 's'} in chunks...`,
        lines: []
    });
    const failedNames = [];
    try {
        backup = await createBackup(resolvedType, 'before-bulk-assign');
        const chunks = [];
        for (let index = 0; index < plan.actionableNames.length; index += BULK_ASSIGN_CHUNK_SIZE) {
            chunks.push(plan.actionableNames.slice(index, index + BULK_ASSIGN_CHUNK_SIZE));
        }
        for (let index = 0; index < chunks.length; index += 1) {
            const chunk = chunks[index];
            const chunkNumber = index + 1;
            renderBulkResultPanel(resolvedType, {
                level: 'progress',
                summary: `Applying chunk ${chunkNumber}/${chunks.length} (${chunk.length} item${chunk.length === 1 ? '' : 's'})...`,
                lines: resultLines
            });
            try {
                const result = await bulkAssign(resolvedType, plan.targetFolderId, chunk);
                const assignedSet = new Set(
                    (Array.isArray(result?.assigned) ? result.assigned : [])
                        .map((name) => sanitizeBulkItemName(name))
                        .filter(Boolean)
                );
                const invalidSet = new Set(
                    (Array.isArray(result?.skippedInvalid) ? result.skippedInvalid : [])
                        .map((name) => sanitizeBulkItemName(name))
                        .filter(Boolean)
                );
                for (const name of chunk) {
                    if (assignedSet.has(name)) {
                        resultLines.push({ status: 'success', name, detail: `Assigned to ${plan.targetFolderName}.` });
                    } else if (invalidSet.has(name)) {
                        resultLines.push({ status: 'invalid', name, detail: 'Blocked by request guard validation.' });
                    } else {
                        failedNames.push(name);
                        resultLines.push({ status: 'failed', name, detail: 'Not applied by server response.' });
                    }
                }
            } catch (error) {
                const message = error?.message || 'Chunk request failed.';
                for (const name of chunk) {
                    failedNames.push(name);
                    resultLines.push({ status: 'failed', name, detail: message });
                }
            }
            if (index < chunks.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, BULK_ASSIGN_CHUNK_PAUSE_MS));
            }
        }
        await Promise.all([refreshType(resolvedType), refreshBackups(resolvedType)]);
        const assignedCount = resultLines.filter((row) => row.status === 'success').length;
        const skippedCount = resultLines.filter((row) => row.status === 'skip').length;
        const invalidCount = resultLines.filter((row) => row.status === 'invalid').length;
        const summaryBits = [
            `${assignedCount} assigned`,
            `${failedNames.length} failed`,
            `${skippedCount} skipped`,
            `${invalidCount} invalid`
        ];
        const statusLevel = failedNames.length > 0 ? 'warning' : 'success';
        const statusMessage = summaryBits.join(' | ');
        state.failedNames = Array.from(new Set(failedNames));
        state.lastTargetFolderId = plan.targetFolderId;
        state.lastResult = {
            level: statusLevel,
            summary: statusMessage,
            lines: resultLines
        };
        renderBulkResultPanel(resolvedType, state.lastResult);
        updateBulkResultActions(resolvedType);
        state.selected = state.failedNames.length ? new Set(state.failedNames) : new Set();
        renderBulkItemOptions(resolvedType);
        showActionSummaryToast({
            title: `${typeLabel} bulk assignment complete`,
            message: statusMessage,
            level: statusLevel,
            type: resolvedType,
            focusFolderId: plan.targetFolderId
        });
        if (failedNames.length > 0) {
            swal({
                title: 'Some items failed',
                text: `Assigned: ${assignedCount}\nFailed: ${failedNames.length}\n\nUse "Retry failed" to try those items again.`,
                type: 'warning'
            });
        }
        await trackDiagnosticsEvent({
            eventType: 'bulk_assign',
            type: resolvedType,
            details: {
                folderId: plan.targetFolderId,
                itemCount: plan.selectedNames.length,
                assignedCount,
                skippedCount: skippedCount,
                skippedInvalidCount: invalidCount,
                failedCount: failedNames.length,
                chunkCount: Math.max(1, Math.ceil(plan.actionableNames.length / BULK_ASSIGN_CHUNK_SIZE))
            }
        });
        await offerUndoAction(resolvedType, backup, 'Bulk assignment');
    } catch (error) {
        state.lastResult = {
            level: 'error',
            summary: `Bulk assignment failed: ${error?.message || error}`,
            lines: resultLines
        };
        renderBulkResultPanel(resolvedType, state.lastResult);
        showError('Bulk assignment failed', error);
    } finally {
        state.applying = false;
        releaseAdvancedOperationLock(resolvedType, 'bulk');
        syncBulkWorkflowUi(resolvedType);
        updateBulkResultActions(resolvedType);
    }
};

const previewFolderRuntimeAction = (type) => {
    const folderId = String($(`#${type}-runtime-folder`).val() || '');
    const action = String($(`#${type}-runtime-action`).val() || '');
    const output = $(`#${type}-runtime-preview-output`);
    if (!folderId || !action) {
        output.text('Select a folder and action first.');
        return;
    }
    const plan = getRuntimePlanForFolder(type, folderId, action);
    output.text(runtimePreviewText(type, folderId, action, plan));
};

const applyFolderRuntimeAction = (type) => {
    const folderId = String($(`#${type}-runtime-folder`).val() || '');
    const action = String($(`#${type}-runtime-action`).val() || '');
    const output = $(`#${type}-runtime-preview-output`);
    if (!folderId || !action) {
        output.text('Select a folder and action first.');
        return;
    }
    const plan = getRuntimePlanForFolder(type, folderId, action);
    if (!plan) {
        output.text('No valid action plan was generated.');
        return;
    }
    if (!plan.eligible.length) {
        output.text(runtimePreviewText(type, folderId, action, plan));
        swal({
            title: 'Nothing to apply',
            text: 'No eligible items were found for this action.',
            type: 'info'
        });
        return;
    }

    const folderName = folderNameForId(type, folderId);
    swal({
        title: 'Apply folder action?',
        text: `${action.toUpperCase()} on "${folderName}"\nEligible: ${plan.eligible.length}\nSkipped: ${plan.skipped.length}`,
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Apply',
        cancelButtonText: 'Cancel',
        showLoaderOnConfirm: true
    }, async (confirmed) => {
        if (!confirmed) {
            return;
        }
        try {
            const result = await executeFolderRuntimeAction(type, action, plan.eligible.map((row) => row.name));
            await refreshType(type);
            output.text(toPrettyJson({
                preview: plan,
                result
            }));
            await trackDiagnosticsEvent({
                eventType: 'runtime_bulk_action',
                type,
                details: {
                    action,
                    folderId,
                    requested: plan.requestedCount,
                    eligible: plan.eligible.length,
                    executed: result.executed || 0,
                    failed: result.failed || 0
                }
            });
            swal({
                title: 'Action complete',
                text: `Executed: ${result.executed || 0}, succeeded: ${result.succeeded || 0}, failed: ${result.failed || 0}, skipped: ${(result.skipped || []).length}`,
                type: (result.failed || 0) > 0 ? 'warning' : 'success'
            });
        } catch (error) {
            showError('Folder runtime action failed', error);
        }
    });
};

const undoLatestChange = (type) => {
    let resolvedType;
    try {
        resolvedType = normalizeManagedType(type);
    } catch (error) {
        showError('Undo failed', error);
        return;
    }
    swal({
        title: 'Undo latest change?',
        text: `Restore the latest undo-capable ${resolvedType.toUpperCase()} backup snapshot.`,
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Undo',
        cancelButtonText: 'Cancel',
        showLoaderOnConfirm: true
    }, async (confirmed) => {
        if (!confirmed) {
            return;
        }
        await withAdvancedOperationLock(resolvedType, 'backups', `${resolvedType.toUpperCase()} undo restore`, async () => {
            try {
                const restore = await restoreLatestUndo(resolvedType);
                await Promise.all([refreshType(resolvedType), refreshBackups(resolvedType)]);
                await refreshChangeHistory();
                swal({
                    title: 'Undo complete',
                    text: `Restored ${restore.name || 'latest undo backup'}.`,
                    type: 'success'
                });
            } catch (error) {
                showError('Undo failed', error);
            }
        });
    });
};

const createManualBackup = async (type) => {
    let resolvedType;
    try {
        resolvedType = normalizeManagedType(type);
    } catch (error) {
        showError('Backup failed', error);
        return;
    }
    if (!ensureRuntimeConflictActionAllowed(`Create ${resolvedType === 'docker' ? 'Docker' : 'VM'} backup`)) {
        return;
    }
    await withAdvancedOperationLock(resolvedType, 'backups', `${resolvedType.toUpperCase()} backup action`, async () => {
        try {
            const backup = await createBackup(resolvedType, 'manual');
            await refreshBackups(resolvedType);
            swal({
                title: 'Backup created',
                text: backup.name,
                type: 'success'
            });
        } catch (error) {
            showError('Backup failed', error);
        }
    });
};

const restoreBackupEntry = (type, name) => {
    let resolvedType;
    try {
        resolvedType = normalizeManagedType(type);
    } catch (error) {
        showError('Restore failed', error);
        return;
    }
    if (!ensureRuntimeConflictActionAllowed(`Restore ${resolvedType === 'docker' ? 'Docker' : 'VM'} backup`)) {
        return;
    }
    swal({
        title: 'Restore this backup?',
        text: `This will overwrite current ${resolvedType} folders.`,
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Restore',
        cancelButtonText: 'Cancel',
        showLoaderOnConfirm: true
    }, async (confirmed) => {
        if (!confirmed) {
            return;
        }
        await withAdvancedOperationLock(resolvedType, 'backups', `${resolvedType.toUpperCase()} backup restore`, async () => {
            try {
                const undoBackup = await createBackup(resolvedType, `before-restore-${name}`);
                await restoreBackupByName(resolvedType, name);
                await Promise.all([refreshType(resolvedType), refreshBackups(resolvedType)]);
                await offerUndoAction(resolvedType, undoBackup, 'Backup restore');
            } catch (error) {
                showError('Restore failed', error);
            }
        });
    });
};

const restoreLatestBackup = (type) => {
    let resolvedType;
    try {
        resolvedType = normalizeManagedType(type);
    } catch (error) {
        showError('Restore failed', error);
        return;
    }
    if (!ensureRuntimeConflictActionAllowed(`Restore latest ${resolvedType === 'docker' ? 'Docker' : 'VM'} backup`)) {
        return;
    }
    swal({
        title: 'Restore latest backup?',
        text: `This will overwrite current ${resolvedType} folders with the latest backup snapshot.`,
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Restore',
        cancelButtonText: 'Cancel',
        showLoaderOnConfirm: true
    }, async (confirmed) => {
        if (!confirmed) {
            return;
        }
        await withAdvancedOperationLock(resolvedType, 'backups', `${resolvedType.toUpperCase()} latest-backup restore`, async () => {
            const progressTotal = 4;
            let progressOpen = false;
            const setProgress = (completed, label) => {
                updateImportApplyProgressDialog({
                    completed: Math.max(0, Math.min(progressTotal, completed)),
                    total: progressTotal,
                    label
                });
            };
            try {
                openImportApplyProgressDialog(resolvedType, progressTotal);
                progressOpen = true;
                setProgress(0, 'Creating safety backup...');

                const undoBackup = await createBackup(resolvedType, 'before-restore-latest');
                setProgress(1, `Safety backup created: ${undoBackup?.name || 'ready'}`);

                await restoreLatest(resolvedType);
                setProgress(2, 'Restored latest backup snapshot.');

                await Promise.all([refreshType(resolvedType), refreshBackups(resolvedType)]);
                setProgress(3, `Refreshed ${resolvedType === 'docker' ? 'Docker' : 'VM'} folders.`);
                setProgress(progressTotal, 'Restore complete.');
                await new Promise((resolve) => setTimeout(resolve, 180));
                closeImportApplyProgressDialog();
                progressOpen = false;

                await offerUndoAction(resolvedType, undoBackup, 'Restore latest backup');
            } catch (error) {
                if (progressOpen) {
                    closeImportApplyProgressDialog();
                }
                showError('Restore failed', error);
            }
        });
    });
};

const downloadBackupEntry = (type, name) => {
    let resolvedType;
    try {
        resolvedType = normalizeManagedType(type);
    } catch (error) {
        showError('Download failed', error);
        return;
    }
    const resolvedName = String(name || '').trim();
    if (!resolvedName) {
        showError('Download failed', new Error('Backup name is required.'));
        return;
    }

    const frameName = `fv-download-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const iframe = document.createElement('iframe');
    iframe.name = frameName;
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/plugins/folderview.plus/server/backup.php';
    form.target = frameName;
    form.style.display = 'none';

    const addField = (fieldName, value) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = fieldName;
        input.value = String(value ?? '');
        form.appendChild(input);
    };

    addField('action', 'download_post');
    addField('type', resolvedType);
    addField('name', resolvedName);
    const token = getOptionalRequestToken();
    if (token) {
        addField('token', token);
    }

    document.body.appendChild(form);
    form.submit();

    window.setTimeout(() => {
        if (form.parentNode) {
            form.parentNode.removeChild(form);
        }
    }, 1000);
    window.setTimeout(() => {
        if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
        }
    }, 20000);
};

const deleteBackupEntry = (type, name) => {
    let resolvedType;
    try {
        resolvedType = normalizeManagedType(type);
    } catch (error) {
        showError('Delete failed', error);
        return;
    }
    if (!ensureRuntimeConflictActionAllowed(`Delete ${resolvedType === 'docker' ? 'Docker' : 'VM'} backup`)) {
        return;
    }
    swal({
        title: 'Delete backup?',
        text: `Delete ${name}? This cannot be undone.`,
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel',
        showLoaderOnConfirm: true
    }, async (confirmed) => {
        if (!confirmed) {
            return;
        }
        await withAdvancedOperationLock(resolvedType, 'backups', `${resolvedType.toUpperCase()} backup delete`, async () => {
            try {
                backupsByType[resolvedType] = await deleteBackupByName(resolvedType, name);
                renderBackupRows(resolvedType);
            } catch (error) {
                showError('Delete failed', error);
            }
        });
    });
};

const validateTemplateNameInput = (type, strict = false) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const raw = String($(`#${resolvedType}-template-name`).val() || '').trim();
    if (!raw) {
        const message = strict ? 'Enter a template name (3-64 characters).' : '';
        setInlineValidationHint(`${resolvedType}-template-validation`, message, strict ? 'error' : 'info');
        return { ok: !strict, value: raw, message };
    }
    if (raw.length < 3 || raw.length > 64) {
        const message = 'Template name must be between 3 and 64 characters.';
        setInlineValidationHint(`${resolvedType}-template-validation`, message, 'error');
        return { ok: false, value: raw, message };
    }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9 _().-]*$/.test(raw)) {
        const message = 'Use letters, numbers, spaces, and _ . ( ) - only.';
        setInlineValidationHint(`${resolvedType}-template-validation`, message, 'error');
        return { ok: false, value: raw, message };
    }
    setInlineValidationHint(`${resolvedType}-template-validation`, 'Template name looks good.', 'success');
    return { ok: true, value: raw, message: '' };
};

const createTemplateFromFolder = async (type) => {
    if (!ensureRuntimeConflictActionAllowed(`Create ${type === 'docker' ? 'Docker' : 'VM'} template`)) {
        return;
    }
    const folderId = String($(`#${type}-template-source-folder`).val() || '');
    const templateValidation = validateTemplateNameInput(type, true);
    const templateName = templateValidation.value;
    if (!folderId) {
        swal({ title: 'Error', text: 'Select a source folder first.', type: 'error' });
        return;
    }
    if (!templateValidation.ok) {
        swal({ title: 'Error', text: templateValidation.message || 'Enter a valid template name.', type: 'error' });
        return;
    }
    await withAdvancedOperationLock(type, 'templates', `${type.toUpperCase()} template create`, async () => {
        try {
            templatesByType[type] = await createTemplate(type, folderId, templateName);
            markAdvancedModuleLoadSuccess(`${type}_templates`);
            $(`#${type}-template-name`).val('');
            setInlineValidationHint(`${type}-template-validation`, '', 'info');
            renderTemplateRows(type);
            swal({ title: 'Template saved', text: 'Template created successfully.', type: 'success' });
        } catch (error) {
            markAdvancedModuleLoadError(`${type}_templates`, error);
            showError('Template create failed', error);
        }
    });
};

const applyTemplateToFolder = (type, templateId, selectId) => {
    if (!ensureRuntimeConflictActionAllowed(`Apply ${type === 'docker' ? 'Docker' : 'VM'} template`)) {
        return;
    }
    const folderId = String($(`#${selectId}`).val() || '');
    if (!folderId) {
        swal({ title: 'Error', text: 'Select a target folder.', type: 'error' });
        return;
    }
    swal({
        title: 'Apply template?',
        text: 'This overwrites icon/settings/actions/regex on the target folder.',
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Apply',
        cancelButtonText: 'Cancel',
        showLoaderOnConfirm: true
    }, async (confirmed) => {
        if (!confirmed) {
            return;
        }
        await withAdvancedOperationLock(type, 'templates', `${type.toUpperCase()} template apply`, async () => {
            try {
                const backup = await createBackup(type, 'before-template-apply');
                await applyTemplate(type, templateId, folderId);
                await Promise.all([refreshType(type), refreshBackups(type)]);
                const targetFolderName = folderNameForId(type, folderId);
                showActionSummaryToast({
                    title: 'Template applied',
                    message: `Updated ${targetFolderName} from saved template.`,
                    level: 'success',
                    type,
                    focusFolderId: folderId
                });
                await offerUndoAction(type, backup, 'Template apply');
            } catch (error) {
                showError('Template apply failed', error);
            }
        });
    });
};

const deleteTemplateEntry = (type, templateId) => {
    if (!ensureRuntimeConflictActionAllowed(`Delete ${type === 'docker' ? 'Docker' : 'VM'} template`)) {
        return;
    }
    swal({
        title: 'Delete template?',
        text: 'This cannot be undone.',
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel',
        showLoaderOnConfirm: true
    }, async (confirmed) => {
        if (!confirmed) {
            return;
        }
        await withAdvancedOperationLock(type, 'templates', `${type.toUpperCase()} template delete`, async () => {
            try {
                templatesByType[type] = await deleteTemplate(type, templateId);
                markAdvancedModuleLoadSuccess(`${type}_templates`);
                renderTemplateRows(type);
            } catch (error) {
                markAdvancedModuleLoadError(`${type}_templates`, error);
                showError('Template delete failed', error);
            }
        });
    });
};

const toggleRuleSelection = (type, ruleId, checked) => {
    const selected = selectedRuleIdsByType[type] || new Set();
    if (checked) {
        selected.add(String(ruleId || ''));
    } else {
        selected.delete(String(ruleId || ''));
    }
    selectedRuleIdsByType[type] = selected;
    renderRulesTable(type);
};

const toggleAllRuleSelections = (type, checked) => {
    const rules = prefsByType[type]?.autoRules || [];
    const selected = selectedRuleIdsByType[type] || new Set();
    const filter = normalizedFilter(filtersByType[type]?.rules);
    for (const rule of rules) {
        const haystack = `${folderNameForId(type, rule.folderId)} ${ruleDescription(rule)} ${rule.id || ''}`.toLowerCase();
        if (filter && !haystack.includes(filter)) {
            continue;
        }
        if (checked) {
            selected.add(String(rule.id || ''));
        } else {
            selected.delete(String(rule.id || ''));
        }
    }
    selectedRuleIdsByType[type] = selected;
    renderRulesTable(type);
};

const bulkRuleAction = async (type, action) => {
    const rules = prefsByType[type]?.autoRules || [];
    const selected = selectedRuleIdsByType[type] || new Set();
    const selectedIds = Array.from(selected).filter((id) => rules.some((rule) => String(rule.id) === id));
    if (!selectedIds.length) {
        swal({ title: 'Nothing selected', text: 'Select at least one rule first.', type: 'warning' });
        return;
    }

    if (action === 'export') {
        const selectedRules = rules.filter((rule) => selectedIds.includes(String(rule.id)));
        const payload = {
            schemaVersion: 1,
            exportedAt: new Date().toISOString(),
            type,
            mode: 'rules',
            rules: selectedRules
        };
        downloadFile(`FolderView Plus ${type.toUpperCase()} Rules.json`, toPrettyJson(payload));
        return;
    }

    if (action === 'delete') {
        swal({
            title: 'Delete selected rules?',
            text: `Delete ${selectedIds.length} selected rule(s)?`,
            type: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Delete',
            cancelButtonText: 'Cancel',
            showLoaderOnConfirm: true
        }, async (confirmed) => {
            if (!confirmed) {
                return;
            }
            try {
                const nextRules = rules.filter((rule) => !selectedIds.includes(String(rule.id)));
                prefsByType[type] = await postPrefs(type, {
                    ...prefsByType[type],
                    autoRules: nextRules
                });
                selectedRuleIdsByType[type] = new Set();
                renderRulesTable(type);
            } catch (error) {
                showError('Rule delete failed', error);
            }
        });
        return;
    }

    const enabled = action === 'enable';
    try {
        const nextRules = rules.map((rule) => (
            selectedIds.includes(String(rule.id))
                ? { ...rule, enabled }
                : rule
        ));
        prefsByType[type] = await postPrefs(type, {
            ...prefsByType[type],
            autoRules: nextRules
        });
        renderRulesTable(type);
    } catch (error) {
        showError('Rule bulk update failed', error);
    }
};

const runRuleSimulator = async (type) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const rules = prefsByType[resolvedType]?.autoRules || [];
    const info = infoByType[resolvedType] || {};
    const names = Object.keys(info).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
    const rows = names.map((name) => {
        const decision = utils.getAutoRuleDecision({
            rules,
            name,
            infoByName: info,
            type: resolvedType
        });
        if (decision.blockedBy) {
            return {
                item: name,
                result: 'blocked',
                folder: folderNameForId(resolvedType, decision.blockedBy.folderId || ''),
                rule: ruleDescription(decision.blockedBy)
            };
        }
        if (decision.assignedRule) {
            return {
                item: name,
                result: 'assigned',
                folder: folderNameForId(resolvedType, decision.assignedRule.folderId || ''),
                rule: ruleDescription(decision.assignedRule)
            };
        }
        return {
            item: name,
            result: 'unassigned',
            folder: '-',
            rule: '-'
        };
    });
    const summary = {
        total: rows.length,
        assigned: rows.filter((row) => row.result === 'assigned').length,
        blocked: rows.filter((row) => row.result === 'blocked').length,
        unassigned: rows.filter((row) => row.result === 'unassigned').length
    };
    const lines = [
        `${resolvedType === 'docker' ? 'Docker' : 'VM'} assignment preview`,
        `Generated: ${new Date().toLocaleString()}`,
        `Assigned: ${summary.assigned} | Blocked: ${summary.blocked} | Unassigned: ${summary.unassigned} | Total: ${summary.total}`,
        ''
    ];
    if (!rows.length) {
        lines.push(`No ${resolvedType === 'docker' ? 'containers' : 'VMs'} are available to simulate right now.`);
    } else {
        rows.forEach((row) => {
            const resultLabel = row.result === 'assigned'
                ? 'ASSIGNED'
                : (row.result === 'blocked' ? 'BLOCKED' : 'UNASSIGNED');
            lines.push(`${resultLabel} | ${row.item} | ${row.folder} | ${row.rule}`);
        });
    }
    $(`#${resolvedType}-rule-sim-output`).text(lines.join('\n'));
    await trackDiagnosticsEvent({
        eventType: 'rule_simulator',
        type: resolvedType,
        details: summary
    });
};

const toggleTemplateSelection = (type, templateId, checked) => {
    const selected = selectedTemplateIdsByType[type] || new Set();
    if (checked) {
        selected.add(String(templateId || ''));
    } else {
        selected.delete(String(templateId || ''));
    }
    selectedTemplateIdsByType[type] = selected;
    renderTemplateRows(type);
};

const toggleAllTemplateSelections = (type, checked) => {
    const templates = templatesByType[type] || [];
    const selected = selectedTemplateIdsByType[type] || new Set();
    const filter = normalizedFilter(filtersByType[type]?.templates);
    for (const template of templates) {
        const templateId = String(template.id || '');
        const haystack = `${String(template.name || '')} ${templateId}`.toLowerCase();
        if (filter && !haystack.includes(filter)) {
            continue;
        }
        if (checked) {
            selected.add(templateId);
        } else {
            selected.delete(templateId);
        }
    }
    selectedTemplateIdsByType[type] = selected;
    renderTemplateRows(type);
};

const bulkTemplateAction = (type, action) => {
    const templates = templatesByType[type] || [];
    const selected = selectedTemplateIdsByType[type] || new Set();
    const selectedTemplates = templates.filter((template) => selected.has(String(template.id || '')));
    if (!selectedTemplates.length) {
        swal({ title: 'Nothing selected', text: 'Select at least one template first.', type: 'warning' });
        return;
    }

    if (action === 'export') {
        const payload = {
            schemaVersion: 1,
            exportedAt: new Date().toISOString(),
            type,
            mode: 'templates',
            templates: selectedTemplates
        };
        downloadFile(`FolderView Plus ${type.toUpperCase()} Templates.json`, toPrettyJson(payload));
        return;
    }

    swal({
        title: 'Delete selected templates?',
        text: `Delete ${selectedTemplates.length} selected template(s)?`,
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel',
        showLoaderOnConfirm: true
    }, async (confirmed) => {
        if (!confirmed) {
            return;
        }
        await withAdvancedOperationLock(type, 'templates', `${type.toUpperCase()} template bulk delete`, async () => {
            try {
                let nextTemplates = templates;
                for (const template of selectedTemplates) {
                    nextTemplates = await deleteTemplate(type, String(template.id || ''));
                }
                templatesByType[type] = nextTemplates;
                markAdvancedModuleLoadSuccess(`${type}_templates`);
                selectedTemplateIdsByType[type] = new Set();
                renderTemplateRows(type);
            } catch (error) {
                markAdvancedModuleLoadError(`${type}_templates`, error);
                showError('Template bulk delete failed', error);
            }
        });
    });
};

const updateTools = window.FolderViewPlusUpdateTools || null;
const settingsSupportActions = settingsActionSupportModule.createSupportActions({
    window,
    $,
    utils,
    swal,
    withAdvancedOperationLock,
    runScheduledBackup,
    refreshType,
    refreshBackups,
    getFolderMap,
    prefsByType,
    infoByType,
    toPrettyJson,
    trackDiagnosticsEvent,
    apiGetJson,
    apiGetText,
    setUpdateStatus,
    setRollbackStatus,
    showError,
    updateTools,
    createGlobalRollbackCheckpointApi,
    restorePreviousGlobalRollbackCheckpointApi,
    refreshAll,
    downloadType,
    importType,
    clearType
});
const {
    runScheduledBackupNow,
    runConflictInspector,
    checkForUpdatesNow,
    showDevForceRefreshHelper,
    createRollbackCheckpoint,
    rollbackLatestCheckpoint,
    fileManager,
    downloadDocker,
    downloadVm,
    importDocker,
    importVm,
    clearDocker,
    clearVm
} = settingsSupportActions;

settingsActionSupportModule.registerWindowActions(window, {
    downloadDocker,
    downloadVm,
    importDocker,
    importVm,
    clearDocker,
    clearVm,
    fileManager,
    createRollbackCheckpoint,
    rollbackLatestCheckpoint,
    changeSortMode,
    changeBadgePref,
    changeVisibilityPref,
    changeStatusPref,
    changeRuntimePref,
    changeDashboardPref,
    changeHealthPref,
    changeBackupSchedulePref,
    changeActiveBackupSchedulePref,
    setFilterQuery,
    filterActiveRecoveryBackups,
    setRecoveryWorkspaceType,
    getActiveRecoveryWorkspaceType,
    setRulesWorkspaceType,
    addAutoRule,
    toggleAutoRule,
    deleteAutoRule,
    moveAutoRule,
    toggleRuleSelection,
    toggleAllRuleSelections,
    bulkRuleAction,
    runRuleSimulator,
    toggleRuleKindFields,
    testAutoRule,
    assignSelectedItems,
    retryFailedBulkItems,
    filterBulkItems,
    bulkItemSelectionAction,
    updateBulkSelectedCount,
    createManualBackup,
    createActiveRecoveryBackup,
    refreshBackups,
    runScheduledBackupNow,
    runActiveRecoveryScheduler,
    restoreLatestBackup,
    restoreLatestActiveRecoveryBackup,
    compareBackupSnapshots,
    compareActiveRecoverySnapshots,
    restoreBackupEntry,
    downloadBackupEntry,
    deleteBackupEntry,
    previewFolderRuntimeAction,
    applyFolderRuntimeAction,
    refreshChangeHistory,
    undoLatestChange,
    undoActiveRecoveryChange,
    createTemplateFromFolder,
    applyTemplateToFolder,
    deleteTemplateEntry,
    toggleTemplateSelection,
    toggleAllTemplateSelections,
    bulkTemplateAction,
    runDiagnostics,
    runThemeDiagnostics,
    runThemeSelfHeal,
    repairDiagnostics,
    exportDiagnostics,
    exportSupportBundle,
    copyIssueReport,
    runConflictInspector,
    checkForUpdatesNow,
    showDevForceRefreshHelper,
    moveFolderRow,
    moveFolderToRootQuick,
    moveFolderUnderDialog,
    openFolderTreeMoveDialog,
    applyTreeMoveUndo,
    applyTreeMoveRedo,
    toggleFolderTreeCollapse,
    expandAllFolderTrees,
    collapseAllFolderTrees,
    toggleMobileTreeReorderMode,
    setFolderBranchCollapse,
    setFolderBranchPinned,
    exportFolderBranch,
    importFolderBranch,
    runTreeIntegrityCheck,
    handleFolderRowKeydown,
    toggleFolderPin,
    copyFolderId,
    toggleDockerUpdatesFilter,
    toggleHealthSeverityFilter,
    toggleStatusFilter,
    clearFolderTableFilters,
    setQuickFolderFilter,
    setHealthFolderFilter,
    changeColumnVisibility,
    changeSettingsTableColumnWidthPreset,
    applySettingsTablePreset,
    resetSettingsTableColumns,
    showFolderStatusBreakdown,
    showFolderHealthBreakdown,
    openFolderRowQuickActions,
    quickCreateStarterFolder,
    quickCreateStarterTemplates,
    applyRuleTestSample,
    clearActivityFeed,
    refreshPerformanceDiagnostics: renderPerformanceDiagnostics,
    runQuickSetupWizard,
    setSettingsMode
});

(async () => {
    try {
        await withFatalBannerPhase({
            phase: 'bootstrap-state',
            step: 'Restored local settings UI state',
            action: 'Restore local Settings UI state',
            category: 'bootstrap-state'
        }, async () => {
            settingsUiState.mode = localStorage.getItem(UI_MODE_STORAGE_KEY) === 'advanced' ? 'advanced' : 'basic';
            activeRulesWorkspaceType = normalizeRulesWorkspaceType(localStorage.getItem(RULES_WORKSPACE_STORAGE_KEY) || 'docker');
            activeRecoveryWorkspaceType = normalizeRecoveryWorkspaceType(localStorage.getItem(RECOVERY_WORKSPACE_STORAGE_KEY) || 'docker');
            setAdvancedTab(localStorage.getItem(ADVANCED_TAB_STORAGE_KEY) || 'automation', false);
            settingsUiState.searchAllAdvanced = localStorage.getItem(SEARCH_ALL_ADVANCED_STORAGE_KEY) === '1';
            settingsUiState.activeSectionKey = String(localStorage.getItem(ADVANCED_SECTION_STORAGE_KEY) || '').trim();
            const expandedRaw = localStorage.getItem(ADVANCED_EXPANDED_STORAGE_KEY);
            const knownRaw = localStorage.getItem(ADVANCED_KNOWN_STORAGE_KEY);
            settingsUiState.hasExpandedAdvancedPreference = expandedRaw !== null;
            if (expandedRaw !== null) {
                try {
                    const expanded = JSON.parse(expandedRaw);
                    settingsUiState.expandedAdvancedSections = new Set(
                        Array.isArray(expanded) ? expanded.map((key) => String(key || '').trim()).filter((key) => key !== '') : []
                    );
                } catch (_error) {
                    settingsUiState.hasExpandedAdvancedPreference = false;
                    settingsUiState.expandedAdvancedSections = new Set();
                }
            } else {
                settingsUiState.expandedAdvancedSections = new Set();
            }
            if (knownRaw !== null) {
                try {
                    const known = JSON.parse(knownRaw);
                    settingsUiState.knownAdvancedSections = new Set(
                        Array.isArray(known) ? known.map((key) => String(key || '').trim()).filter((key) => key !== '') : []
                    );
                } catch (_error) {
                    settingsUiState.knownAdvancedSections = new Set();
                }
            } else {
                settingsUiState.knownAdvancedSections = new Set();
            }
            restoreTableUiState();
        });
        await withFatalBannerPhase({
            phase: 'bootstrap-ui',
            step: 'Initialized settings controls',
            action: 'Initialize Settings controls',
            category: 'render-failed'
        }, async () => {
            initSettingsControls();
            initOverflowGuard();
            initCompactMobileLayoutGuard();
            initThemeAwareSettingsReflow();
            renderPerformanceDiagnostics();
        });
        await fetchPluginVersion();
        let bootstrapDegradedReasons = [];
        try {
            if (settingsUiState.mode === 'advanced') {
                setFatalBannerPhase('advanced-data');
                recordFatalBannerAction('Start advanced Settings bootstrap');
                markFatalBannerStep('Starting advanced settings bootstrap');
                const result = await refreshAll();
                bootstrapDegradedReasons = Array.isArray(result?.degradedReasons) ? result.degradedReasons : [];
            } else {
                setFatalBannerPhase('bootstrap-data');
                recordFatalBannerAction('Start basic Settings bootstrap');
                markFatalBannerStep('Starting basic settings bootstrap');
                const result = await refreshCoreData();
                bootstrapDegradedReasons = Array.isArray(result?.degradedReasons) ? result.degradedReasons : [];
            }
            if (bootstrapDegradedReasons.length > 0) {
                reportFatalBannerDegradedState(new Error('Some Settings data could not be loaded during bootstrap.'), {
                    context: 'Settings',
                    hostSelector: '#fv-settings-root',
                    title: 'Settings loaded in degraded mode',
                    message: 'FolderView Plus kept the Settings page open, but some data or advanced modules failed to load.',
                    code: settingsUiState.mode === 'advanced' ? 'FVPLUS-SET-BOOT-004' : 'FVPLUS-SET-BOOT-003',
                    phase: settingsUiState.mode === 'advanced' ? 'advanced-data' : 'bootstrap-data',
                    category: 'degraded-mode',
                    detailLabel: 'Affected areas',
                    details: bootstrapDegradedReasons
                });
            }
        } catch (error) {
            // Keep initial settings sections visible on first-load API hiccups.
            refreshSettingsUx();
            showError('Initial data load failed', error);
        }
        await withFatalBannerPhase({
            phase: 'finalize',
            action: 'Finalize Settings bootstrap',
            category: 'render-failed'
        }, async () => {
            const storedMode = String(localStorage.getItem(UI_MODE_STORAGE_KEY) || '').trim();
            const hasLocalModePreference = storedMode === 'advanced' || storedMode === 'basic';
            const serverMode = getServerSettingsMode();
            if (!hasLocalModePreference && serverMode) {
                settingsUiState.mode = serverMode;
            }
            refreshSettingsUx();
            captureSettingsBaseline();
            if (settingsUiState.mode) {
                setSettingsMode(settingsUiState.mode);
            }
            if (hasLocalModePreference && serverMode && serverMode !== settingsUiState.mode) {
                void persistSetupPrefsToServer({ mode: settingsUiState.mode });
            }
            if (isWizardCompletedServerSide()) {
                markSetupAssistantCompletedLocal();
            } else if (hasExistingPluginData()) {
                markSetupAssistantCompletedLocal();
                await persistSetupPrefsToServer({
                    mode: settingsUiState.mode,
                    completed: true
                });
            }
            const shouldRunWizard = !isWizardCompletedServerSide() && !isSetupAssistantCompletedLocal();
            if (shouldRunWizard) {
                runQuickSetupWizard(false);
            } else {
                await maybeShowUpdateNotesPanel();
            }
            syncRuntimeConflictResolutionBanner();
        });
        settingsUiState.initialized = true;
        if (bootstrapDegradedReasons.length <= 0) {
            clearFatalBannerResolvedState();
        }
        setFatalBannerPhase('ready');
        recordFatalBannerAction('Settings bootstrap completed');
        markFatalBannerStep('Settings bootstrap completed');
    } catch (error) {
        try {
            refreshSettingsUx();
        } catch (_ignored) {
            // Best effort only; do not shadow the original initialization error.
        }
        if (fatalBanner && typeof fatalBanner.reportFatalError === 'function') {
            fatalBanner.reportFatalError(error, {
                context: 'Settings',
                hostSelector: '#fv-settings-root',
                title: 'Settings bootstrap failed',
                message: 'FolderView Plus could not finish initializing the Settings page.',
                code: 'FVPLUS-SET-BOOT-002',
                phase: error?.fvplusPhase || 'bootstrap',
                category: error?.fvplusCategory || inferFatalBannerCategory(error, 'runtime-failed')
            });
        }
        showError('Initialization failed', error);
    }
})();
