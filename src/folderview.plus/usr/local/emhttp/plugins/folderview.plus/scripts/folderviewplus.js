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
const settingsHealthModule = window.FolderViewPlusSettingsHealth || null;
const settingsWorkspacesModule = window.FolderViewPlusSettingsWorkspaces || null;
const folderSettingsTransferModule = window.FolderViewPlusFolderSettingsTransfer || null;
const themeWorkspaceModule = window.FolderViewPlusThemeWorkspace || null;
const settingsTreeModule = window.FolderViewPlusSettingsTree || null;
const bulkAssignmentSharedModule = window.FolderViewPlusBulkAssignmentShared || null;
const bulkAssignmentModule = window.FolderViewPlusBulkAssignment || null;
const settingsRuntimeActionsModule = window.FolderViewPlusSettingsRuntimeActions || null;
const nativeOrganizerModule = window.FolderViewPlusNativeOrganizer || null;
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
const markSettingsBootstrapState = (patch = {}) => {
    const cleanPatch = {};
    if (patch && typeof patch === 'object') {
        for (const [key, value] of Object.entries(patch)) {
            if (value !== undefined) {
                cleanPatch[key] = value;
            }
        }
    }
    if (typeof window.FolderViewPlusMarkSettingsBootstrapState === 'function') {
        window.FolderViewPlusMarkSettingsBootstrapState(cleanPatch);
    } else {
        window.FolderViewPlusSettingsBootstrapState = {
            ...(window.FolderViewPlusSettingsBootstrapState || {}),
            ...cleanPatch,
            lastUpdatedAt: new Date().toISOString()
        };
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
    markSettingsBootstrapState({
        lastPhase: phase || undefined,
        lastStep: step || undefined,
        lastAction: action || undefined
    });
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
markSettingsBootstrapState({
    runtimeLoaded: true,
    ready: false,
    failed: false,
    lastPhase: 'module-load',
    lastAction: 'Load Settings runtime',
    lastStep: 'Loaded settings runtime'
});
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
if (!settingsHealthModule || window.FolderViewPlusSettingsHealthModuleLoaded !== true || typeof settingsHealthModule.createApi !== 'function') {
    bootstrapMissingModules.push('folderviewplus.settings-health.js');
    setFatalBannerModuleStatus('folderviewplus.settings-health.js', 'missing', 'settings health api unavailable');
} else {
    setFatalBannerModuleStatus('folderviewplus.settings-health.js', 'ok', 'settings health api ready');
}
if (!settingsWorkspacesModule || window.FolderViewPlusSettingsWorkspacesModuleLoaded !== true || typeof settingsWorkspacesModule.createApi !== 'function') {
    bootstrapMissingModules.push('folderviewplus.settings-workspaces.js');
    setFatalBannerModuleStatus('folderviewplus.settings-workspaces.js', 'missing', 'settings workspace api unavailable');
} else {
    setFatalBannerModuleStatus('folderviewplus.settings-workspaces.js', 'ok', 'settings workspace api ready');
}
if (!folderSettingsTransferModule || window.FolderViewPlusFolderSettingsTransferModuleLoaded !== true || typeof folderSettingsTransferModule.createApi !== 'function') {
    bootstrapMissingModules.push('folder.settings-transfer.js');
    setFatalBannerModuleStatus('folder.settings-transfer.js', 'missing', 'folder settings transfer api unavailable');
} else {
    setFatalBannerModuleStatus('folder.settings-transfer.js', 'ok', 'folder settings transfer api ready');
}
if (!themeWorkspaceModule || window.FolderViewPlusThemeWorkspaceModuleLoaded !== true || typeof themeWorkspaceModule.createApi !== 'function') {
    bootstrapMissingModules.push('folderviewplus.theme-workspace.js');
    setFatalBannerModuleStatus('folderviewplus.theme-workspace.js', 'missing', 'theme workspace api unavailable');
} else {
    setFatalBannerModuleStatus('folderviewplus.theme-workspace.js', 'ok', 'theme workspace api ready');
}
if (!settingsTreeModule || window.FolderViewPlusSettingsTreeModuleLoaded !== true) {
    bootstrapMissingModules.push('folderviewplus.settings-tree.js');
    setFatalBannerModuleStatus('folderviewplus.settings-tree.js', 'missing', 'settings tree helpers unavailable');
} else {
    setFatalBannerModuleStatus('folderviewplus.settings-tree.js', 'ok', 'settings tree helpers ready');
}
if (!bulkAssignmentSharedModule || window.FolderViewPlusBulkAssignmentSharedModuleLoaded !== true || typeof bulkAssignmentSharedModule.createApi !== 'function') {
    bootstrapMissingModules.push('folderviewplus.bulk-assignment.shared.js');
    setFatalBannerModuleStatus('folderviewplus.bulk-assignment.shared.js', 'missing', 'bulk assignment shared api unavailable');
} else {
    setFatalBannerModuleStatus('folderviewplus.bulk-assignment.shared.js', 'ok', 'bulk assignment shared api ready');
}
if (!bulkAssignmentModule || window.FolderViewPlusBulkAssignmentModuleLoaded !== true || typeof bulkAssignmentModule.createApi !== 'function') {
    bootstrapMissingModules.push('folderviewplus.bulk-assignment.js');
    setFatalBannerModuleStatus('folderviewplus.bulk-assignment.js', 'missing', 'bulk assignment api unavailable');
} else {
    setFatalBannerModuleStatus('folderviewplus.bulk-assignment.js', 'ok', 'bulk assignment api ready');
}
if (!settingsRuntimeActionsModule || window.FolderViewPlusSettingsRuntimeActionsModuleLoaded !== true || typeof settingsRuntimeActionsModule.createApi !== 'function') {
    bootstrapMissingModules.push('folderviewplus.runtime-actions.js');
    setFatalBannerModuleStatus('folderviewplus.runtime-actions.js', 'missing', 'settings runtime action api unavailable');
} else {
    setFatalBannerModuleStatus('folderviewplus.runtime-actions.js', 'ok', 'settings runtime action api ready');
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
const runtimePrefsSaveStateByType = {
    docker: {
        revision: 0,
        lastCommittedPrefs: utils.normalizePrefs({})
    },
    vm: {
        revision: 0,
        lastCommittedPrefs: utils.normalizePrefs({})
    }
};
let infoByType = {
    docker: {},
    vm: {}
};
let backupsByType = {
    docker: [],
    vm: []
};
let recoverySelectedBackupByType = {
    docker: '',
    vm: ''
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
let selectedOperationsTemplateIdByType = {
    docker: '',
    vm: ''
};
let activeOperationsWorkspaceType = 'docker';
let activeRulesWorkspaceType = 'docker';
let activeRecoveryWorkspaceType = 'docker';

const UI_MODE_STORAGE_KEY = 'fv.settings.mode.v1';
const OPERATIONS_WORKSPACE_STORAGE_KEY = 'fv.settings.operationsWorkspace.v1';
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
const SETTINGS_SEARCH_ALIASES_BY_SECTION = window.FolderViewPlusSettingsSections?.SETTINGS_SEARCH_ALIASES_BY_SECTION
    || window.SETTINGS_SEARCH_ALIASES_BY_SECTION
    || {};
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
    try {
        applyColumnWidths('docker');
        applyColumnWidths('vm');
        bindTableColumnResizers('docker');
        bindTableColumnResizers('vm');
    } catch (_error) {
        console.warn('[FolderView Plus] Settings compact layout sync failed.', _error);
    }
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

const readSettingsLaunchOverrides = () => {
    if (typeof URLSearchParams === 'undefined' || !window?.location) {
        return null;
    }
    const params = new URLSearchParams(window.location.search || '');
    const modeRaw = String(params.get('fvMode') || '').trim().toLowerCase();
    const advancedTabRaw = String(params.get('fvAdvancedTab') || '').trim().toLowerCase();
    const sectionKey = String(params.get('fvSection') || '').trim().toLowerCase();
    const rulesTypeRaw = String(params.get('fvRulesType') || '').trim().toLowerCase();
    const overrides = {};
    if (modeRaw === 'advanced' || modeRaw === 'basic') {
        overrides.mode = modeRaw;
    }
    if (ADVANCED_GROUPS.includes(advancedTabRaw)) {
        overrides.advancedTab = advancedTabRaw;
    }
    if (sectionKey) {
        overrides.sectionKey = sectionKey;
    }
    if (rulesTypeRaw === 'docker' || rulesTypeRaw === 'vm') {
        overrides.rulesType = rulesTypeRaw;
    }
    return Object.keys(overrides).length > 0 ? overrides : null;
};

const settingsLaunchOverrides = readSettingsLaunchOverrides();

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

const applySettingsLaunchOverrides = ({ persist = false } = {}) => {
    if (!settingsLaunchOverrides) {
        return false;
    }
    if (settingsLaunchOverrides.mode === 'advanced' || settingsLaunchOverrides.mode === 'basic') {
        settingsUiState.mode = settingsLaunchOverrides.mode;
    }
    if (settingsLaunchOverrides.advancedTab) {
        setAdvancedTab(settingsLaunchOverrides.advancedTab, persist);
    }
    if (settingsLaunchOverrides.sectionKey) {
        settingsUiState.activeSectionKey = settingsLaunchOverrides.sectionKey;
    }
    if (settingsLaunchOverrides.rulesType) {
        activeRulesWorkspaceType = normalizeRulesWorkspaceType(settingsLaunchOverrides.rulesType);
        if (persist) {
            writeSettingsStorage(RULES_WORKSPACE_STORAGE_KEY, activeRulesWorkspaceType, { delayMs: 60, idle: true });
        }
    }
    return true;
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
            if (!isInstantPersistInput(input)) {
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

const getSectionSearchAliases = (section) => {
    const key = String(section?.key || '').trim();
    const aliases = SETTINGS_SEARCH_ALIASES_BY_SECTION[key];
    return Array.isArray(aliases) ? aliases.join(' ') : '';
};

const getSectionSearchHaystack = (section) => [
    section?.key || '',
    section?.title || '',
    getSectionSearchAliases(section),
    ...(Array.isArray(section?.nodes) ? section.nodes.map((node) => node.textContent || '') : [])
]
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

const runQuickSetupWizard = (force = false, options = {}) => {
    const source = String(options?.source || (force === true ? 'manual' : 'auto')).trim() || 'auto';
    try {
        markSettingsBootstrapState({
            lastPhase: 'setup-assistant',
            lastAction: source === 'auto-first-run' ? 'Open first-run setup assistant' : 'Open setup assistant',
            lastStep: 'Starting setup assistant'
        });
        openSetupAssistant(force === true);
        markSettingsBootstrapState({
            lastPhase: 'setup-assistant',
            lastAction: source === 'auto-first-run' ? 'Opened first-run setup assistant' : 'Opened setup assistant',
            lastStep: 'Setup assistant opened'
        });
        return true;
    } catch (error) {
        annotateFatalBannerError(error, {
            phase: 'setup-assistant',
            category: 'setup-assistant-failed',
            action: source === 'auto-first-run' ? 'Open first-run setup assistant' : 'Open setup assistant'
        });
        markSettingsBootstrapState({
            degraded: true,
            lastPhase: 'setup-assistant',
            lastAction: 'Setup assistant failed to open',
            lastStep: 'Settings stayed visible after setup assistant failure'
        });
        try {
            refreshSettingsUx();
        } catch (_ignored) {
            // Best effort only; keep reporting the setup assistant failure.
        }
        reportFatalBannerDegradedState(error, {
            context: 'Settings',
            hostSelector: '#fv-settings-root',
            title: 'Setup assistant could not open',
            message: 'FolderView Plus kept the Settings page visible, but the setup assistant failed to render.',
            code: 'FVPLUS-SET-WIZARD-001',
            phase: 'setup-assistant',
            category: 'setup-assistant-failed',
            detailLabel: 'Setup assistant error'
        });
        if (source !== 'auto-first-run') {
            showError('Setup assistant failed', error);
        }
        return false;
    }
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
    renderOperationsWorkspace();
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
    renderOperationsWorkspace();
    syncRecoveryWorkspaceUi();
    syncRulesWorkspaceUi();
    ADVANCED_MODULE_KEYS.forEach((moduleKey) => {
        renderAdvancedModuleStatus(moduleKey);
    });
};

const isVisibleSettingsElement = (node) => {
    if (!(node instanceof HTMLElement)) {
        return false;
    }
    const style = typeof window.getComputedStyle === 'function' ? window.getComputedStyle(node) : null;
    if (style && (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0)) {
        return false;
    }
    const rect = typeof node.getBoundingClientRect === 'function' ? node.getBoundingClientRect() : null;
    return Boolean((rect && rect.width > 0 && rect.height > 0) || node.offsetWidth > 0 || node.offsetHeight > 0);
};

const hasVisibleSettingsSurface = () => {
    const root = document.getElementById('fv-settings-root');
    if (!isVisibleSettingsElement(root)) {
        return false;
    }
    const selectors = [
        '#fvplus-fatal-banner',
        '#fv-settings-topbar > *',
        'h2[data-fv-section]:not(.fv-section-hidden)',
        '.folder-table:not(.fv-section-hidden)',
        'tbody#docker tr:not(.fv-section-hidden)',
        'tbody#vms tr:not(.fv-section-hidden)',
        '#fv-setup-assistant-overlay',
        '#fv-setup-assistant-dialog',
        '#fv-first-run-panel:not([style*="display:none"])'
    ];
    for (const selector of selectors) {
        for (const node of root.querySelectorAll(selector)) {
            if (isVisibleSettingsElement(node)) {
                return true;
            }
        }
    }
    return false;
};

const recoverBlankSettingsSurface = (reason = 'post-bootstrap') => {
    if (hasVisibleSettingsSurface()) {
        return true;
    }
    const root = document.getElementById('fv-settings-root');
    if (!(root instanceof HTMLElement)) {
        return false;
    }

    settingsUiState.mode = 'basic';
    settingsUiState.query = '';
    settingsUiState.searchAllAdvanced = false;
    settingsUiState.activeSectionKey = 'docker';
    try {
        root.hidden = false;
        root.removeAttribute('aria-hidden');
        root.style.display = 'block';
        root.style.visibility = 'visible';
        root.style.opacity = '1';
        $('#fv-settings-topbar').show();
        $('#fv-settings-search').val('');
        $('#fv-search-all-advanced').prop('checked', false);
        removeSettingsStorage(SEARCH_ALL_ADVANCED_STORAGE_KEY, { idle: true });
        writeSettingsStorage(UI_MODE_STORAGE_KEY, 'basic', { delayMs: 20, idle: true });
        buildSettingsSections();
        normalizeExpandedAdvancedSections();
        applySettingsSectionVisibility();
        syncSectionJumpOptions();
        refreshInputInvalidStyles();
        refreshSectionHealthBadges();
    } catch (error) {
        annotateFatalBannerError(error, {
            phase: 'blank-recovery',
            category: 'blank-page',
            action: 'Recover blank Settings surface'
        });
        throw error;
    }

    const recovered = hasVisibleSettingsSurface();
    markSettingsBootstrapState({
        degraded: true,
        failed: recovered ? false : true,
        lastPhase: 'blank-recovery',
        lastAction: recovered ? 'Recovered blank Settings surface' : 'Blank Settings surface recovery failed',
        lastStep: String(reason || 'post-bootstrap')
    });
    const details = [
        `reason=${String(reason || 'post-bootstrap')}`,
        `mode=${settingsUiState.mode}`,
        `sections=${settingsUiState.sections.length}`,
        `basicSections=${getBasicWorkspaceSections().map((section) => section.key).join(',') || '(none)'}`,
        `rootChildren=${root.children.length}`,
        `topbarChildren=${document.getElementById('fv-settings-topbar')?.children.length || 0}`
    ];
    const error = new Error(
        recovered
            ? 'Settings page became blank after bootstrap and was recovered to basic mode.'
            : 'Settings page became blank after bootstrap and could not be recovered.'
    );
    if (recovered) {
        reportFatalBannerDegradedState(error, {
            context: 'Settings',
            hostSelector: '#fv-settings-root',
            title: 'Settings page recovered from blank state',
            message: 'FolderView Plus detected an empty Settings surface and restored the basic Settings view.',
            code: 'FVPLUS-SET-BLANK-RECOVERED',
            phase: 'blank-recovery',
            category: 'blank-page',
            detailLabel: 'Blank recovery diagnostics',
            details
        });
        return true;
    }
    if (fatalBanner && typeof fatalBanner.reportFatalError === 'function') {
        fatalBanner.reportFatalError(error, {
            context: 'Settings',
            hostSelector: '#fv-settings-root',
            title: 'Settings page is blank',
            message: 'FolderView Plus could not find visible Settings content after bootstrap.',
            code: 'FVPLUS-SET-BLANK-002',
            phase: 'blank-recovery',
            category: 'blank-page',
            detailLabel: 'Blank recovery diagnostics',
            details
        });
    }
    return false;
};

const scheduleBlankSettingsRecoveryChecks = () => {
    window.setTimeout(() => recoverBlankSettingsSurface('post-ready-early'), 1200);
    window.setTimeout(() => recoverBlankSettingsSurface('post-ready-late'), 5000);
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

const createEmptyFolderDefaultsRecord = () => ({
    sourceId: '',
    sourceName: '',
    profile: {
        icon: '',
        settings: {},
        actions: []
    }
});

const cloneFolderDefaultsRecord = (value) => {
    const source = value && typeof value === 'object' ? value : createEmptyFolderDefaultsRecord();
    const profile = source.profile && typeof source.profile === 'object' ? source.profile : {};
    return {
        sourceId: String(source.sourceId || '').trim(),
        sourceName: String(source.sourceName || '').trim(),
        profile: {
            icon: String(profile.icon || '').trim(),
            settings: profile.settings && typeof profile.settings === 'object'
                ? JSON.parse(JSON.stringify(profile.settings))
                : {},
            actions: Array.isArray(profile.actions)
                ? JSON.parse(JSON.stringify(profile.actions))
                : []
        }
    };
};

const folderDefaultsProfileHasContent = (folderDefaults) => {
    const profile = folderDefaults?.profile && typeof folderDefaults.profile === 'object' ? folderDefaults.profile : {};
    const settings = profile.settings && typeof profile.settings === 'object' ? profile.settings : {};
    const actions = Array.isArray(profile.actions) ? profile.actions : [];
    return Boolean(String(profile.icon || '').trim())
        || Object.keys(settings).length > 0
        || actions.length > 0;
};

const getFolderDefaultsForType = (type) => {
    const resolvedType = normalizeManagedType(type);
    const prefs = utils.normalizePrefs(prefsByType[resolvedType] || {});
    return cloneFolderDefaultsRecord(prefs.folderDefaults || {});
};

const buildFolderDefaultsSummary = (type) => {
    const resolvedType = normalizeManagedType(type);
    const defaults = getFolderDefaultsForType(resolvedType);
    if (!folderDefaultsProfileHasContent(defaults)) {
        return `No ${resolvedType === 'docker' ? 'Docker' : 'VM'} folder defaults saved yet.`;
    }
    const parts = [];
    if (String(defaults.profile.icon || '').trim()) {
        parts.push('icon');
    }
    if (Object.keys(defaults.profile.settings || {}).length > 0) {
        parts.push('folder settings');
    }
    const actionCount = Array.isArray(defaults.profile.actions) ? defaults.profile.actions.length : 0;
    if (actionCount > 0) {
        parts.push(`${actionCount} script action${actionCount === 1 ? '' : 's'}`);
    }
    const sourceLabel = defaults.sourceName || defaults.sourceId || 'saved profile';
    return `Saved from "${sourceLabel}". Applies ${parts.join(', ')}.`;
};

const renderFolderDefaultsPanel = (type) => {
    const resolvedType = normalizeManagedType(type);
    const select = $(`#${resolvedType}-folder-defaults-source`);
    const summary = $(`#${resolvedType}-folder-defaults-summary`);
    if (!select.length || !summary.length) {
        return;
    }

    const folders = getFolderMap(resolvedType);
    const entries = Object.entries(folders).sort((left, right) => (
        String(left?.[1]?.name || left?.[0] || '').localeCompare(String(right?.[1]?.name || right?.[0] || ''))
    ));
    const defaults = getFolderDefaultsForType(resolvedType);
    const previousValue = String(select.val() || '').trim();
    const optionValues = new Set();
    const options = ['<option value="">Select a source folder</option>'];

    entries.forEach(([id, folder]) => {
        const safeId = String(id || '').trim();
        optionValues.add(safeId);
        options.push(`<option value="${escapeHtml(safeId)}">${escapeHtml(folder?.name || safeId)}</option>`);
    });

    if (defaults.sourceId && !optionValues.has(defaults.sourceId) && folderDefaultsProfileHasContent(defaults)) {
        optionValues.add(defaults.sourceId);
        options.push(`<option value="${escapeHtml(defaults.sourceId)}">${escapeHtml(`${defaults.sourceName || defaults.sourceId} (saved profile)`)}</option>`);
    }

    select.html(options.join(''));
    select.prop('disabled', entries.length <= 0);

    const nextValue = previousValue && optionValues.has(previousValue)
        ? previousValue
        : (defaults.sourceId && optionValues.has(defaults.sourceId) ? defaults.sourceId : '');
    select.val(nextValue);
    summary.text(buildFolderDefaultsSummary(resolvedType));
};

const saveFolderDefaultsFromSelection = async (type) => {
    const resolvedType = normalizeManagedType(type);
    const transferApi = getFolderSettingsTransferApi();
    const sourceId = String($(`#${resolvedType}-folder-defaults-source`).val() || '').trim();
    const folder = getFolderMap(resolvedType)[sourceId];
    if (!folder || !sourceId) {
        showToastMessage({
            title: 'Select a source folder',
            message: `Choose a ${resolvedType === 'docker' ? 'Docker' : 'VM'} folder first, then save its icon/settings profile as the default.`,
            level: 'info'
        });
        return false;
    }

    try {
        const current = utils.normalizePrefs(prefsByType[resolvedType] || {});
        const normalizedPayload = transferApi.normalizeFolderSettingsPayload(folder);
        const next = utils.normalizePrefs({
            ...current,
            folderDefaults: {
                sourceId,
                sourceName: String(folder?.name || sourceId).trim(),
                profile: normalizedPayload.payload
            }
        });
        prefsByType[resolvedType] = await postPrefs(resolvedType, next);
        renderFolderDefaultsPanel(resolvedType);
        refreshSectionHealthBadges();
        showToastMessage({
            title: 'Folder defaults saved',
            message: `New ${resolvedType === 'docker' ? 'Docker' : 'VM'} folders will inherit the saved profile.`,
            level: 'success'
        });
        return true;
    } catch (error) {
        showError('Folder defaults save failed', error);
        return false;
    }
};

const clearFolderDefaults = async (type) => {
    const resolvedType = normalizeManagedType(type);
    try {
        const current = utils.normalizePrefs(prefsByType[resolvedType] || {});
        prefsByType[resolvedType] = await postPrefs(resolvedType, utils.normalizePrefs({
            ...current,
            folderDefaults: createEmptyFolderDefaultsRecord()
        }));
        renderFolderDefaultsPanel(resolvedType);
        refreshSectionHealthBadges();
        showToastMessage({
            title: 'Folder defaults cleared',
            message: `Saved ${resolvedType === 'docker' ? 'Docker' : 'VM'} folder defaults were removed.`,
            level: 'success'
        });
        return true;
    } catch (error) {
        showError('Folder defaults reset failed', error);
        return false;
    }
};

const applySavedFolderDefaultsToAll = async (type) => {
    const resolvedType = normalizeManagedType(type);
    const defaults = getFolderDefaultsForType(resolvedType);
    if (!folderDefaultsProfileHasContent(defaults)) {
        showToastMessage({
            title: 'No saved defaults',
            message: `Save a ${resolvedType === 'docker' ? 'Docker' : 'VM'} folder profile first.`,
            level: 'info'
        });
        return false;
    }

    const targetIds = Object.keys(getFolderMap(resolvedType));
    if (targetIds.length <= 0) {
        showToastMessage({
            title: 'No folders available',
            message: `Create at least one ${resolvedType === 'docker' ? 'Docker' : 'VM'} folder first.`,
            level: 'info'
        });
        return false;
    }

    try {
        const response = await apiPostJson('/plugins/folderview.plus/server/apply_folder_settings.php', {
            type: resolvedType,
            targetIds: JSON.stringify(targetIds),
            settings: JSON.stringify(defaults.profile)
        });
        const result = response?.result || {};
        await Promise.allSettled([
            refreshType(resolvedType),
            refreshBackups(resolvedType, { quiet: true })
        ]);
        showToastMessage({
            title: 'Defaults applied',
            message: `Applied the saved profile to ${Number(result.updatedCount) || targetIds.length} folder${targetIds.length === 1 ? '' : 's'}.`,
            level: 'success'
        });
        return true;
    } catch (error) {
        showError('Apply defaults to all failed', error);
        return false;
    }
};

const importThemeWorkspaceGithub = async () => {
    const source = String($('#fv-theme-github-source').val() || '').trim();
    if (!source) {
        showToastMessage({
            title: 'Enter a GitHub source',
            message: 'Use owner/repo, owner/repo/tree/branch, or a direct GitHub CSS URL.',
            level: 'info'
        });
        return false;
    }
    await getThemeWorkspaceApi().importGithub(source);
    $('#fv-theme-github-source').val('');
    return true;
};

const activateThemeWorkspaceTheme = async (themeId) => getThemeWorkspaceApi().activateTheme(themeId);
const deactivateThemeWorkspaceTheme = async () => getThemeWorkspaceApi().deactivateTheme();
const deleteThemeWorkspaceTheme = async (themeId) => getThemeWorkspaceApi().deleteTheme(themeId);
const saveThemeWorkspaceCustomize = async () => getThemeWorkspaceApi().saveCustomize();
const checkThemeWorkspaceUpdates = async () => getThemeWorkspaceApi().checkUpdates();

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

const getSettingsHealthApi = (() => {
    let cachedApi = null;
    return () => {
        if (cachedApi) {
            return cachedApi;
        }
        cachedApi = settingsHealthModule.createApi({
            $,
            utils,
            escapeHtml,
            formatBytesShort,
            getPrefsByType: (type) => prefsByType[type === 'vm' ? 'vm' : 'docker'] || {},
            getInfoByType: (type) => infoByType[type === 'vm' ? 'vm' : 'docker'] || {},
            normalizeHealthPrefs,
            getItemRuntimeStateKind,
            deriveFolderStatusKey,
            evaluateDockerFolderHealth,
            valueIsTruthy,
            getHealthFilterMode: (type) => healthFilterByType[type === 'vm' ? 'vm' : 'docker'] || 'all',
            getHealthMetrics: (type) => healthMetricsByType[type === 'vm' ? 'vm' : 'docker'] || null,
            getFolderMap: (type) => getFolderMap(type),
            getEffectiveMemberSnapshot: (type, folders) => getEffectiveMemberSnapshot(type, folders)
        });
        return cachedApi;
    };
})();

const getFolderSettingsTransferApi = (() => {
    let cachedApi = null;
    return () => {
        if (cachedApi) {
            return cachedApi;
        }
        cachedApi = folderSettingsTransferModule.createApi({ window });
        return cachedApi;
    };
})();

const getThemeWorkspaceApi = (() => {
    let cachedApi = null;
    return () => {
        if (cachedApi) {
            return cachedApi;
        }
        cachedApi = themeWorkspaceModule.createApi({
            window,
            document,
            $,
            escapeHtml,
            apiGetJson,
            apiPostJson,
            showError
        });
        return cachedApi;
    };
})();

const getSettingsWorkspacesApi = (() => {
    let cachedApi = null;
    return () => {
        if (cachedApi) {
            return cachedApi;
        }
        cachedApi = settingsWorkspacesModule.createApi({
            window,
            document,
            $,
            utils,
            escapeHtml,
            getFolderMap: (type) => getFolderMap(type),
            getFolderNameForId: (type, id) => folderNameForId(type, id),
            getSortedBackupsForType: (type) => getSortedBackupsForType(type),
            prefsByType,
            formatTimestamp,
            writeSettingsStorage,
            RECOVERY_WORKSPACE_STORAGE_KEY,
            RULES_WORKSPACE_STORAGE_KEY,
            OPERATIONS_WORKSPACE_STORAGE_KEY,
            getActiveRecoveryWorkspaceTypeValue: () => activeRecoveryWorkspaceType,
            setActiveRecoveryWorkspaceTypeValue: (value) => {
                activeRecoveryWorkspaceType = value;
            },
            recoverySelectedBackupByType,
            filtersByType,
            persistTableUiState,
            renderBackupRows,
            createManualBackup,
            restoreLatestBackup,
            restoreBackupEntry,
            downloadBackupEntry,
            deleteBackupEntry,
            runScheduledBackupNow,
            compareBackupSnapshots,
            changeBackupSchedulePref,
            undoLatestChange,
            getActiveRulesWorkspaceTypeValue: () => activeRulesWorkspaceType,
            setActiveRulesWorkspaceTypeValue: (value) => {
                activeRulesWorkspaceType = value;
            },
            renderRulesTable,
            updateRuleLiveMatch,
            updateRuleValidationHint,
            getActiveOperationsWorkspaceTypeValue: () => activeOperationsWorkspaceType,
            setActiveOperationsWorkspaceTypeValue: (value) => {
                activeOperationsWorkspaceType = value;
            },
            templatesByType,
            selectedOperationsTemplateIdByType,
            downloadFile,
            toPrettyJson,
            showError
        });
        return cachedApi;
    };
})();

const getBulkAssignmentApi = (() => {
    let cachedApi = null;
    return () => {
        if (cachedApi) {
            return cachedApi;
        }
        cachedApi = bulkAssignmentModule.createApi({
            window,
            document,
            $,
            utils,
            sharedModule: bulkAssignmentSharedModule,
            swal,
            escapeHtml,
            normalizeManagedType,
            normalizedFilter,
            getFolderMap: (type) => getFolderMap(type),
            getFolderNameForId: (type, id) => folderNameForId(type, id),
            getInfoByType: (type) => infoByType[type === 'vm' ? 'vm' : 'docker'] || {},
            filtersByType,
            persistTableUiState,
            apiPostJson,
            assertRuntimeConflictActionAllowed,
            createBackup,
            refreshType,
            refreshBackups,
            claimAdvancedOperationLock,
            releaseAdvancedOperationLock,
            showActionSummaryToast,
            trackDiagnosticsEvent,
            offerUndoAction,
            showError,
            requestAnimationFrameRef: window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : null,
            setTimeoutRef: window.setTimeout ? window.setTimeout.bind(window) : null
        });
        return cachedApi;
    };
})();

const getSettingsRuntimeActionsApi = (() => {
    let cachedApi = null;
    return () => {
        if (cachedApi) {
            return cachedApi;
        }
        cachedApi = settingsRuntimeActionsModule.createApi({
            window,
            $,
            swal,
            utils,
            escapeHtml,
            normalizeManagedType,
            getFolderMap: (type) => getFolderMap(type),
            getFolderNameForId: (type, id) => folderNameForId(type, id),
            buildFolderHierarchyMeta,
            getFolderBranchIds,
            prefsByType,
            postPrefs,
            createBackup,
            refreshType,
            refreshBackups,
            offerUndoAction,
            showToastMessage,
            showError,
            downloadFile,
            toPrettyJson,
            trackDiagnosticsEvent,
            getPluginVersion: () => pluginVersion,
            selectJsonFile,
            applyImportOperations,
            saveFolderRecord,
            ensureRuntimeConflictActionAllowed,
            TREE_INTEGRITY_DEPTH_WARN_LEVEL,
            setRuntimePreviewOutput: (...args) => getSettingsWorkspacesApi().setRuntimePreviewOutput(...args),
            buildRuntimePreviewHtml: (...args) => getSettingsWorkspacesApi().buildRuntimePreviewHtml(...args),
            getRuntimePlanForFolder,
            executeFolderRuntimeAction
        });
        return cachedApi;
    };
})();

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

const buildStatusSnapshot = (...args) => getSettingsHealthApi().buildStatusSnapshot(...args);
const isDockerUpdateAvailable = (...args) => getSettingsHealthApi().isDockerUpdateAvailable(...args);
const formatGiBFromKiB = (...args) => getSettingsHealthApi().formatGiBFromKiB(...args);
const formatVmMemoryLabel = (...args) => getSettingsHealthApi().formatVmMemoryLabel(...args);
const collectVmFolderResources = (...args) => getSettingsHealthApi().collectVmFolderResources(...args);
const evaluateVmResourceBadge = (...args) => getSettingsHealthApi().evaluateVmResourceBadge(...args);
const hasInvalidFolderRegex = (...args) => getSettingsHealthApi().hasInvalidFolderRegex(...args);
const buildTypeHealthMetrics = (...args) => getSettingsHealthApi().buildTypeHealthMetrics(...args);
const folderMatchesHealthFilter = (...args) => getSettingsHealthApi().folderMatchesHealthFilter(...args);
const getHealthFilterLabel = (...args) => getSettingsHealthApi().getHealthFilterLabel(...args);

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

const normalizeRecoveryWorkspaceType = (...args) => getSettingsWorkspacesApi().normalizeRecoveryWorkspaceType(...args);

const normalizeRulesWorkspaceType = (...args) => getSettingsWorkspacesApi().normalizeRulesWorkspaceType(...args);

const getActiveRecoveryWorkspaceType = (...args) => getSettingsWorkspacesApi().getActiveRecoveryWorkspaceType(...args);

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

const buildRecoveryOverviewHtml = (...args) => getSettingsWorkspacesApi().buildRecoveryOverviewHtml(...args);
const buildRecoveryBackupHistoryHtml = (...args) => getSettingsWorkspacesApi().buildRecoveryBackupHistoryHtml(...args);
const syncVisibleRecoveryCompareControls = (...args) => getSettingsWorkspacesApi().syncVisibleRecoveryCompareControls(...args);
const syncHiddenRecoveryCompareControls = (...args) => getSettingsWorkspacesApi().syncHiddenRecoveryCompareControls(...args);
const renderRecoveryWorkspace = (...args) => getSettingsWorkspacesApi().renderRecoveryWorkspace(...args);
const syncRecoveryWorkspaceUi = (...args) => getSettingsWorkspacesApi().syncRecoveryWorkspaceUi(...args);
const setRecoveryWorkspaceType = (...args) => getSettingsWorkspacesApi().setRecoveryWorkspaceType(...args);
const selectActiveRecoveryBackup = (...args) => getSettingsWorkspacesApi().selectActiveRecoveryBackup(...args);
const filterActiveRecoveryBackups = (...args) => getSettingsWorkspacesApi().filterActiveRecoveryBackups(...args);
const createActiveRecoveryBackup = (...args) => getSettingsWorkspacesApi().createActiveRecoveryBackup(...args);
const restoreLatestActiveRecoveryBackup = (...args) => getSettingsWorkspacesApi().restoreLatestActiveRecoveryBackup(...args);
const restoreSelectedActiveRecoveryBackup = (...args) => getSettingsWorkspacesApi().restoreSelectedActiveRecoveryBackup(...args);
const downloadSelectedActiveRecoveryBackup = (...args) => getSettingsWorkspacesApi().downloadSelectedActiveRecoveryBackup(...args);
const deleteSelectedActiveRecoveryBackup = (...args) => getSettingsWorkspacesApi().deleteSelectedActiveRecoveryBackup(...args);
const runActiveRecoveryScheduler = (...args) => getSettingsWorkspacesApi().runActiveRecoveryScheduler(...args);
const compareActiveRecoverySnapshots = (...args) => getSettingsWorkspacesApi().compareActiveRecoverySnapshots(...args);
const setRulesWorkspaceType = (...args) => getSettingsWorkspacesApi().setRulesWorkspaceType(...args);
const changeActiveBackupSchedulePref = (...args) => getSettingsWorkspacesApi().changeActiveBackupSchedulePref(...args);
const undoActiveRecoveryChange = (...args) => getSettingsWorkspacesApi().undoActiveRecoveryChange(...args);
const syncRulesWorkspaceUi = (...args) => getSettingsWorkspacesApi().syncRulesWorkspaceUi(...args);
const exportEnvironmentSnapshot = (...args) => getSettingsWorkspacesApi().exportEnvironmentSnapshot(...args);
const importEnvironmentSnapshot = (...args) => getSettingsWorkspacesApi().importEnvironmentSnapshot(...args);

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

const showToastMessage = ({
    title = '',
    message = '',
    level = 'info',
    durationMs = 4200,
    actionLabel = '',
    onAction = null
} = {}) => {
    void title;
    void message;
    void level;
    void durationMs;
    void actionLabel;
    void onAction;
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

const setFolderBranchPinned = (...args) => getSettingsRuntimeActionsApi().setFolderBranchPinned(...args);
const exportFolderBranch = (...args) => getSettingsRuntimeActionsApi().exportFolderBranch(...args);
const importFolderBranch = (...args) => getSettingsRuntimeActionsApi().importFolderBranch(...args);
const runTreeIntegrityCheck = (...args) => getSettingsRuntimeActionsApi().runTreeIntegrityCheck(...args);

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

    const persistedOrder = sanitizeManualOrderList(
        resolvedType,
        Array.isArray(reorderResponse.order) ? reorderResponse.order : safeOrder
    );
    const nextPrefs = utils.normalizePrefs({
        ...prefsByType[resolvedType],
        sortMode: 'manual',
        manualOrder: persistedOrder
    });
    prefsByType[resolvedType] = nextPrefs;

    if (refresh) {
        await refreshType(resolvedType);
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
        folderLabel: dashboard.folderLabel !== false,
        privacyMode: dashboard.privacyMode === true,
        privacyMaskNames: dashboard.privacyMaskNames !== false,
        privacyMaskContainerIps: dashboard.privacyMaskContainerIps !== false,
        privacyMaskLocalIps: dashboard.privacyMaskLocalIps !== false,
        privacyMaskPorts: dashboard.privacyMaskPorts !== false,
        previewContext: dashboard.previewContext === 'advanced' ? 'advanced' : 'native',
        previewTrigger: dashboard.previewTrigger === 'hover' ? 'hover' : 'click',
        previewGraph: Math.max(0, Math.min(4, Number(dashboard.previewGraph) || 1)),
        previewGraphTime: Math.max(5, Math.min(600, Number(dashboard.previewGraphTime) || 60))
    };
};

const syncDashboardDependentFields = (type) => {
    const prefs = normalizeDashboardPrefsForType(type);
    const showNonClassicControls = !['classic', 'legacy'].includes(prefs.layout);
    $(`#${type}-dashboard-expand-toggle-row`).toggleClass('is-hidden', !showNonClassicControls);
    $(`#${type}-dashboard-greyscale-row`).toggleClass('is-hidden', !showNonClassicControls);
    $(`#${type}-dashboard-folder-label-row`).toggleClass('is-hidden', !showNonClassicControls);
    if (type === 'docker') {
        const dashboardPreviewAdvanced = $(`#${type}-dashboard-preview-context`).val() === 'advanced';
        $(`#${type}-dashboard-preview-trigger-row`).toggleClass('is-hidden', !dashboardPreviewAdvanced);
        $(`#${type}-dashboard-preview-graph-row`).toggleClass('is-hidden', !dashboardPreviewAdvanced);
        $(`#${type}-dashboard-preview-graph-time-row`).toggleClass('is-hidden', !dashboardPreviewAdvanced);
    }
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
    $(`#${type}-dashboard-privacy-mask-names`).prop('checked', dashboard.privacyMaskNames !== false);
    if (type === 'docker') {
        $('#docker-dashboard-privacy-mask-container-ips').prop('checked', dashboard.privacyMaskContainerIps !== false);
        $('#docker-dashboard-privacy-mask-local-ips').prop('checked', dashboard.privacyMaskLocalIps !== false);
        $('#docker-dashboard-privacy-mask-ports').prop('checked', dashboard.privacyMaskPorts !== false);
        $('#docker-dashboard-preview-context').val(dashboard.previewContext);
        $('#docker-dashboard-preview-trigger').val(dashboard.previewTrigger);
        $('#docker-dashboard-preview-graph').val(String(dashboard.previewGraph));
        $('#docker-dashboard-preview-graph-time').val(String(dashboard.previewGraphTime));
    }
    syncDashboardDependentFields(type);
};

const renderRuntimeControls = (type) => {
    const prefs = utils.normalizePrefs(prefsByType[type]);
    $(`#${type}-live-refresh-enabled`).prop('checked', prefs.liveRefreshEnabled === true);
    $(`#${type}-live-refresh-seconds`).val(String(prefs.liveRefreshSeconds || 20));
    $(`#${type}-performance-mode`).prop('checked', prefs.performanceMode === true);
    $(`#${type}-lazy-preview-enabled`).prop('checked', prefs.lazyPreviewEnabled === true);
    $(`#${type}-lazy-preview-threshold`).val(String(prefs.lazyPreviewThreshold || 30));
    $(`#${type}-page-view-mode`).val(
        typeof utils.normalizeRuntimePageViewMode === 'function'
            ? utils.normalizeRuntimePageViewMode(prefs.pageViewMode)
            : (['host', 'command', 'tree-explorer'].includes(String(prefs.pageViewMode || '').trim().toLowerCase()) ? String(prefs.pageViewMode || '').trim().toLowerCase() : 'folderview')
    );
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

const buildHealthCardHtml = (...args) => getSettingsHealthApi().buildHealthCardHtml(...args);
const buildCleanHealthCardHtml = (...args) => getSettingsHealthApi().buildCleanHealthCardHtml(...args);
const renderFolderHealthCards = (...args) => getSettingsHealthApi().renderFolderHealthCards(...args);

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

const getBulkAssignableNames = (...args) => getBulkAssignmentApi().getBulkAssignableNames(...args);
const clearBulkExecutionState = (...args) => getBulkAssignmentApi().clearBulkExecutionState(...args);

const renderBulkResultPanel = (...args) => getBulkAssignmentApi().renderBulkResultPanel(...args);
const updateBulkResultActions = (...args) => getBulkAssignmentApi().updateBulkResultActions(...args);

const updateBulkPreviewPanel = (...args) => getBulkAssignmentApi().updateBulkPreviewPanel(...args);
const updateBulkSelectedCount = (...args) => getBulkAssignmentApi().updateBulkSelectedCount(...args);
const renderBulkItemOptions = (...args) => getBulkAssignmentApi().renderBulkItemOptions(...args);

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

const normalizeOperationsWorkspaceType = (...args) => getSettingsWorkspacesApi().normalizeOperationsWorkspaceType(...args);
const buildOperationsOverviewHtml = (...args) => getSettingsWorkspacesApi().buildOperationsOverviewHtml(...args);
const renderOperationsOverview = (...args) => getSettingsWorkspacesApi().renderOperationsOverview(...args);
const buildRuntimePreviewHtml = (...args) => getSettingsWorkspacesApi().buildRuntimePreviewHtml(...args);
const setRuntimePreviewOutput = (...args) => getSettingsWorkspacesApi().setRuntimePreviewOutput(...args);
const renderOperationsWorkspace = (...args) => {
    const result = getSettingsWorkspacesApi().renderOperationsWorkspace(...args);
    renderNativeDockerOrganizerStatus();
    return result;
};
const setOperationsWorkspaceType = (...args) => getSettingsWorkspacesApi().setOperationsWorkspaceType(...args);
const selectOperationsTemplate = (...args) => getSettingsWorkspacesApi().selectOperationsTemplate(...args);
const exportTemplateEntry = (...args) => getSettingsWorkspacesApi().exportTemplateEntry(...args);
const renderTemplateRows = (...args) => getSettingsWorkspacesApi().renderTemplateRows(...args);

const readNativeDockerOrganizerStoredStatus = () => {
    const storageKey = nativeOrganizerModule?.NATIVE_ORGANIZER_STATUS_STORAGE_KEY || 'fv.native.organizer.status.v1';
    try {
        const raw = String(localStorage.getItem(storageKey) || '').trim();
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_error) {
        return null;
    }
};

const buildNativeDockerOrganizerStatusHtml = (status = null) => {
    if (!nativeOrganizerModule || typeof nativeOrganizerModule.syncDockerOrganizer !== 'function') {
        return `
            <div class="fv-recovery-empty-state">
                <strong>Native organizer helper is not loaded.</strong>
                <span>The Docker and Dashboard pages still work without native organizer sync.</span>
            </div>
        `;
    }
    const source = status && typeof status === 'object' ? status : readNativeDockerOrganizerStoredStatus();
    if (!source) {
        return `
            <div class="fv-recovery-empty-state">
                <strong>Native organizer status has not been captured yet.</strong>
                <span>Run Sync now to check whether Unraid's GraphQL organizer API is available.</span>
            </div>
        `;
    }
    const checkedAt = source.checkedAt ? formatTimestamp(source.checkedAt) : 'recently';
    const created = Math.max(0, Number(source.created) || 0);
    const updated = Math.max(0, Number(source.updated) || 0);
    const synced = created + updated;
    const reason = String(source.reason || '').trim();
    const headline = source.ok === true
        ? (source.skipped === true
            ? 'Native organizer sync was skipped safely.'
            : `Native organizer synced ${synced} folder change${synced === 1 ? '' : 's'}.`)
        : 'Native organizer sync is unavailable right now.';
    const detail = source.ok === true
        ? `${synced} changed, checked ${checkedAt}${reason ? ` (${reason})` : ''}.`
        : `${reason || 'GraphQL organizer API unavailable'}, checked ${checkedAt}.`;
    return `
        <div class="fv-recovery-empty-state ${source.ok === true ? 'is-ok' : 'is-warning'}">
            <strong>${escapeHtml(headline)}</strong>
            <span>${escapeHtml(detail)}</span>
        </div>
    `;
};

const renderNativeDockerOrganizerStatus = (status = null) => {
    const host = $('#docker-native-organizer-status');
    if (!host.length) {
        return null;
    }
    host.html(buildNativeDockerOrganizerStatusHtml(status));
    return status;
};

const refreshNativeDockerOrganizerStatus = () => {
    const moduleStatus = nativeOrganizerModule && typeof nativeOrganizerModule.getStatus === 'function'
        ? nativeOrganizerModule.getStatus()
        : null;
    renderNativeDockerOrganizerStatus(moduleStatus?.last || readNativeDockerOrganizerStoredStatus());
};

const syncNativeDockerOrganizerFromSettings = async () => {
    if (!ensureRuntimeConflictActionAllowed('Sync native Docker organizer')) {
        return false;
    }
    if (!nativeOrganizerModule || typeof nativeOrganizerModule.syncDockerOrganizer !== 'function') {
        renderNativeDockerOrganizerStatus(null);
        showToastMessage({
            title: 'Native organizer unavailable',
            message: 'The native organizer helper did not load in Settings.',
            level: 'warning'
        });
        return false;
    }
    try {
        const result = await nativeOrganizerModule.syncDockerOrganizer(dockers, {
            force: true,
            source: 'settings'
        });
        renderNativeDockerOrganizerStatus(result);
        showToastMessage({
            title: result.ok ? 'Native organizer checked' : 'Native organizer skipped',
            message: result.ok
                ? `Created ${Number(result.created) || 0}, updated ${Number(result.updated) || 0}.`
                : String(result.reason || 'GraphQL organizer API unavailable.'),
            level: result.ok ? 'success' : 'warning'
        });
        return result.ok === true;
    } catch (error) {
        renderNativeDockerOrganizerStatus({
            ok: false,
            skipped: true,
            reason: String(error?.message || error || 'native organizer sync failed'),
            checkedAt: new Date().toISOString()
        });
        showError('Native organizer sync failed', error);
        return false;
    }
};

const renderTable = (type) => {
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
    renderFolderDefaultsPanel(type);
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
    renderOperationsOverview(type);
    renderTemplateRows(type);
    renderOperationsWorkspace();
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
        renderOperationsOverview(resolvedType);
        renderTemplateRows(resolvedType);
        renderOperationsWorkspace();
        refreshSettingsUx();
        return false;
    }
    renderOperationsOverview(resolvedType);
    renderTemplateRows(resolvedType);
    renderOperationsWorkspace();
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
    const refreshResults = await Promise.allSettled([
        refreshType('docker'),
        refreshType('vm'),
        getThemeWorkspaceApi().readWorkspace()
    ]);
    ensureRegexPresetUi('docker');
    ensureRegexPresetUi('vm');
    toggleRuleKindFields('docker');
    updateRuleLiveMatch('docker');
    updateRuleLiveMatch('vm');
    refreshSettingsUx();
    const degradedReasons = [];
    const dockerResult = refreshResults[0];
    const vmResult = refreshResults[1];
    const themeResult = refreshResults[2];
    if (dockerResult.status === 'fulfilled') {
        degradedReasons.push(...(Array.isArray(dockerResult.value?.degradedReasons) ? dockerResult.value.degradedReasons : []));
    } else {
        degradedReasons.push(buildSettingsBootstrapDegradedReason('docker', 'settings data', dockerResult.reason));
    }
    if (vmResult.status === 'fulfilled') {
        degradedReasons.push(...(Array.isArray(vmResult.value?.degradedReasons) ? vmResult.value.degradedReasons : []));
    } else {
        degradedReasons.push(buildSettingsBootstrapDegradedReason('vm', 'settings data', vmResult.reason));
    }
    if (themeResult.status !== 'fulfilled') {
        degradedReasons.push(buildSettingsBootstrapDegradedReason('shared', 'theme workspace', themeResult.reason));
    }
    recordPerformanceDiagnosticsSample('settings', 'bootstrap', perfNowMs() - startedAt, {
        dockerFolders: Object.keys(getFolderMap('docker')).length,
        vmFolders: Object.keys(getFolderMap('vm')).length
    });
    return {
        degradedReasons
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
        const operationTitle = id
            ? `Deleting ${resolvedType === 'docker' ? 'Docker' : 'VM'} folder`
            : `Clearing ${resolvedType === 'docker' ? 'Docker' : 'VM'} folders`;
        const setProgress = (completed, label, detail = {}) => {
            const safeCompleted = Math.max(0, Math.min(progressTotal, completed));
            const deletedCount = Number.isFinite(Number(detail.deletedCount))
                ? Math.max(0, Number(detail.deletedCount))
                : Math.max(0, Math.min(deleteIds.length, safeCompleted - 1));
            const remainingFolders = Math.max(0, deleteIds.length - deletedCount);
            updateImportApplyProgressDialog({
                completed: safeCompleted,
                total: progressTotal,
                label,
                title: operationTitle,
                kicker: resolvedType === 'docker' ? 'Docker cleanup' : 'VM cleanup',
                current: detail.current || label,
                state: detail.state || 'running',
                completedLabel: detail.completedLabel ?? deletedCount,
                remainingLabel: detail.remainingLabel ?? remainingFolders,
                note: detail.note || (id
                    ? 'Do not close this page until the folder delete finishes.'
                    : 'Do not close this page until all folders are cleared.')
            });
        };
        try {
            openImportApplyProgressDialog(resolvedType, progressTotal, {
                title: operationTitle,
                kicker: resolvedType === 'docker' ? 'Docker cleanup' : 'VM cleanup',
                current: 'Preparing cleanup...',
                note: id
                    ? 'Do not close this page until the folder delete finishes.'
                    : 'Do not close this page until all folders are cleared.'
            });
            progressOpen = true;
            setProgress(0, 'Creating safety backup...', {
                current: 'Creating a rollback point before deleting anything.',
                deletedCount: 0
            });

            const backup = await createBackup(resolvedType, id ? `before-delete-${id}` : 'before-clear-all');
            setProgress(1, `Safety backup created: ${backup?.name || 'ready'}`, {
                current: `Backup ready: ${backup?.name || 'rollback point created'}`,
                deletedCount: 0
            });

            let completed = 1;
            const foldersBeforeDelete = getFolderMap(resolvedType);
            let deletedCount = 0;
            for (const currentId of deleteIds) {
                const currentName = foldersBeforeDelete[currentId]?.name || currentId;
                setProgress(completed, `Deleting ${currentName}`, {
                    current: `Removing folder: ${currentName}`,
                    deletedCount
                });
                await apiPostText('/plugins/folderview.plus/server/delete.php', { type: resolvedType, id: currentId });
                completed += 1;
                deletedCount += 1;
                setProgress(completed, `Deleted ${currentName}`, {
                    current: `Removed folder: ${currentName}`,
                    deletedCount
                });
            }

            if (resolvedType === 'docker') {
                setProgress(completed, 'Syncing Docker folder order...', {
                    current: 'Removing deleted folders from Docker order.',
                    deletedCount
                });
                await syncDockerOrder();
                completed += 1;
                setProgress(completed, 'Synced Docker folder order', {
                    current: 'Docker folder order synced.',
                    deletedCount
                });
            }

            setProgress(progressTotal - 1, `Refreshing ${resolvedType === 'docker' ? 'Docker' : 'VM'} folders...`, {
                current: 'Refreshing settings table and backups.',
                deletedCount
            });
            await Promise.all([refreshType(resolvedType), refreshBackups(resolvedType)]);
            setProgress(progressTotal, id ? 'Folder deleted.' : 'All folders cleared.', {
                current: id ? 'Cleanup complete.' : `${deletedCount} folders removed. Settings table refreshed.`,
                state: 'success',
                deletedCount,
                completedLabel: deletedCount,
                remainingLabel: 0,
                note: 'Cleanup complete. The settings view has been refreshed.'
            });
            await new Promise((resolve) => setTimeout(resolve, 650));
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
                updateImportApplyProgressDialog({
                    completed: progressTotal,
                    total: progressTotal,
                    label: 'Cleanup stopped.',
                    title: operationTitle,
                    kicker: resolvedType === 'docker' ? 'Docker cleanup' : 'VM cleanup',
                    current: String(error?.message || 'Folder cleanup failed.'),
                    state: 'error',
                    note: 'Review the error message and try again.'
                });
                await new Promise((resolve) => setTimeout(resolve, 900));
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
    } else {
        return;
    }
    try {
        prefsByType[type] = await postPrefs(type, next);
        renderVisibilityControls(type);
        renderTable(type);
    } catch (error) {
        renderVisibilityControls(type);
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

const getRuntimePrefsSaveState = (type) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    if (!runtimePrefsSaveStateByType[resolvedType] || typeof runtimePrefsSaveStateByType[resolvedType] !== 'object') {
        runtimePrefsSaveStateByType[resolvedType] = {
            revision: 0,
            lastCommittedPrefs: utils.normalizePrefs(prefsByType[resolvedType] || {})
        };
    }
    if (!runtimePrefsSaveStateByType[resolvedType].lastCommittedPrefs) {
        runtimePrefsSaveStateByType[resolvedType].lastCommittedPrefs = utils.normalizePrefs(prefsByType[resolvedType] || {});
    }
    return runtimePrefsSaveStateByType[resolvedType];
};

const changeRuntimePref = async (type, key, value) => {
    const current = utils.normalizePrefs(prefsByType[type]);
    const runtimeSaveState = getRuntimePrefsSaveState(type);
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
    } else if (key === 'pageViewMode') {
        next.pageViewMode = typeof utils.normalizeRuntimePageViewMode === 'function'
            ? utils.normalizeRuntimePageViewMode(value)
            : (['host', 'command', 'tree-explorer'].includes(String(value || '').trim().toLowerCase()) ? String(value || '').trim().toLowerCase() : 'folderview');
    } else if (key === 'themeCompatibilityMode') {
        next.themeCompatibilityMode = resolveThemeCompatibilityMode(value);
    } else {
        return;
    }

    if (key === 'liveRefreshEnabled' || key === 'lazyPreviewEnabled') {
        syncRuntimeDependentFields(type);
    }
    prefsByType[type] = utils.normalizePrefs(next);
    renderRuntimeControls(type);
    const requestRevision = runtimeSaveState.revision + 1;
    runtimeSaveState.revision = requestRevision;

    try {
        const savedPrefs = await postPrefs(type, next);
        runtimeSaveState.lastCommittedPrefs = utils.normalizePrefs(savedPrefs);
        if (requestRevision !== runtimeSaveState.revision) {
            return;
        }
        prefsByType[type] = runtimeSaveState.lastCommittedPrefs;
        renderRuntimeControls(type);
        if (key === 'themeCompatibilityMode') {
            applySettingsResolvedThemeTokens(`pref-${type}`);
            queueSettingsThemeAwareReflow(`theme-compat-${type}`);
        }
    } catch (error) {
        if (requestRevision !== runtimeSaveState.revision) {
            return;
        }
        prefsByType[type] = utils.normalizePrefs(runtimeSaveState.lastCommittedPrefs || current);
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
    } else if (key === 'privacyMode') {
        nextDashboard.privacyMode = value === true;
    } else if (key === 'privacyMaskNames') {
        nextDashboard.privacyMaskNames = value === true;
    } else if (key === 'privacyMaskContainerIps' && type === 'docker') {
        nextDashboard.privacyMaskContainerIps = value === true;
    } else if (key === 'privacyMaskLocalIps' && type === 'docker') {
        nextDashboard.privacyMaskLocalIps = value === true;
    } else if (key === 'privacyMaskPorts' && type === 'docker') {
        nextDashboard.privacyMaskPorts = value === true;
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

const filterBulkItems = (...args) => getBulkAssignmentApi().filterBulkItems(...args);
const bulkItemSelectionAction = (...args) => getBulkAssignmentApi().bulkItemSelectionAction(...args);
const setBulkItemChecked = (...args) => getBulkAssignmentApi().setBulkItemChecked(...args);
const retryFailedBulkItems = (...args) => getBulkAssignmentApi().retryFailedBulkItems(...args);
const assignSelectedItems = (...args) => getBulkAssignmentApi().assignSelectedItems(...args);

const previewFolderRuntimeAction = (...args) => getSettingsRuntimeActionsApi().previewFolderRuntimeAction(...args);
const applyFolderRuntimeAction = (...args) => getSettingsRuntimeActionsApi().applyFolderRuntimeAction(...args);

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
            renderOperationsOverview(type);
            renderTemplateRows(type);
            renderOperationsWorkspace();
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
                renderOperationsOverview(type);
                renderTemplateRows(type);
                renderOperationsWorkspace();
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
    setOperationsWorkspaceType,
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
    selectActiveRecoveryBackup,
    restoreSelectedActiveRecoveryBackup,
    downloadSelectedActiveRecoveryBackup,
    deleteSelectedActiveRecoveryBackup,
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
    selectOperationsTemplate,
    exportTemplateEntry,
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
    importThemeWorkspaceGithub,
    activateThemeWorkspaceTheme,
    deactivateThemeWorkspaceTheme,
    deleteThemeWorkspaceTheme,
    saveThemeWorkspaceCustomize,
    checkThemeWorkspaceUpdates,
    saveFolderDefaultsFromSelection,
    applySavedFolderDefaultsToAll,
    clearFolderDefaults,
    refreshNativeDockerOrganizerStatus,
    syncNativeDockerOrganizerFromSettings,
    runQuickSetupWizard,
    setSettingsMode,
    exportEnvironmentSnapshot,
    importEnvironmentSnapshot,
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
            activeOperationsWorkspaceType = normalizeOperationsWorkspaceType(localStorage.getItem(OPERATIONS_WORKSPACE_STORAGE_KEY) || 'docker');
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
            applySettingsLaunchOverrides({ persist: false });
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
            getThemeWorkspaceApi().bindEvents();
            renderFolderDefaultsPanel('docker');
            renderFolderDefaultsPanel('vm');
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
                markSettingsBootstrapState({
                    degraded: true,
                    lastPhase: settingsUiState.mode === 'advanced' ? 'advanced-data' : 'bootstrap-data',
                    lastAction: 'Settings bootstrap loaded with degraded data',
                    lastStep: 'Settings bootstrap degraded'
                });
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
            markSettingsBootstrapState({
                degraded: true,
                lastPhase: settingsUiState.mode === 'advanced' ? 'advanced-data' : 'bootstrap-data',
                lastAction: 'Initial Settings data load failed',
                lastStep: 'Settings page kept visible after data load failure'
            });
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
            if (!hasLocalModePreference && serverMode && !settingsLaunchOverrides?.mode) {
                settingsUiState.mode = serverMode;
            }
            refreshSettingsUx();
            captureSettingsBaseline();
            if (settingsUiState.mode) {
                setSettingsMode(settingsUiState.mode);
            }
            if (settingsLaunchOverrides?.sectionKey) {
                window.requestAnimationFrame(() => {
                    scrollToSectionKey(settingsLaunchOverrides.sectionKey);
                });
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
                runQuickSetupWizard(false, { source: 'auto-first-run' });
            } else {
                await maybeShowUpdateNotesPanel();
            }
            syncRuntimeConflictResolutionBanner();
        });
        settingsUiState.initialized = true;
        const currentBootstrapState = window.FolderViewPlusSettingsBootstrapState || {};
        if (bootstrapDegradedReasons.length <= 0 && currentBootstrapState.degraded !== true) {
            clearFatalBannerResolvedState();
        }
        setFatalBannerPhase('ready');
        recordFatalBannerAction('Settings bootstrap completed');
        markFatalBannerStep('Settings bootstrap completed');
        const settingsSurfaceVisible = recoverBlankSettingsSurface('ready');
        if (settingsSurfaceVisible) {
            scheduleBlankSettingsRecoveryChecks();
        }
        markSettingsBootstrapState({
            ready: settingsSurfaceVisible,
            failed: !settingsSurfaceVisible,
            lastPhase: settingsSurfaceVisible ? 'ready' : 'blank-recovery',
            lastAction: settingsSurfaceVisible ? 'Settings bootstrap completed' : 'Settings bootstrap completed without visible content',
            lastStep: settingsSurfaceVisible ? 'Settings bootstrap completed' : 'Settings surface stayed blank'
        });
    } catch (error) {
        try {
            refreshSettingsUx();
        } catch (_ignored) {
            // Best effort only; do not shadow the original initialization error.
        }
        markSettingsBootstrapState({
            failed: true,
            lastPhase: error?.fvplusPhase || 'bootstrap',
            lastAction: error?.fvplusAction || 'Settings bootstrap failed',
            lastStep: 'Settings bootstrap failed'
        });
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
