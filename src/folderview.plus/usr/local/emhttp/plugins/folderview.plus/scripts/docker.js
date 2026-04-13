// @ts-check
(function fvplusDockerRuntimeScope(window, $) {
'use strict';

const FOLDER_VIEW_DEBUG_MODE = false;
const dockerRuntimeShared = window.FolderViewDockerRuntimeShared || {};
const runtimeStateObserverModule = window.FolderViewPlusRuntimeStateObservers || null;
const themeResolver = window.FolderViewPlusThemeResolver || null;
const dockerRuntimeInfoModule = window.FolderViewPlusDockerRuntimeInfo || null;
const dockerPreviewActionsModule = window.FolderViewPlusDockerPreviewActions || null;
const dockerRuntimeHierarchyModule = window.FolderViewPlusDockerRuntimeHierarchy || null;
const dockerRuntimeActionsModule = window.FolderViewPlusDockerRuntimeActions || null;
const applyDockerThemeResolverTokens = (reason = 'docker-runtime:initial', options = {}) => (
    themeResolver && typeof themeResolver.applyResolvedThemeTokens === 'function'
        ? themeResolver.applyResolvedThemeTokens(reason, options)
        : null
);
const localDefaultFolderStatusColors = dockerRuntimeShared.DEFAULT_FOLDER_STATUS_COLORS || {
    started: '#ffffff',
    paused: '#b8860b',
    stopped: '#ff4d4d'
};
const applyFolderStatusColorOverrides = typeof dockerRuntimeShared.applyFolderStatusColorOverrides === 'function'
    ? dockerRuntimeShared.applyFolderStatusColorOverrides
    : (() => {});
const applyFolderAccentStyle = typeof dockerRuntimeShared.applyFolderAccentStyle === 'function'
    ? dockerRuntimeShared.applyFolderAccentStyle
    : (() => {});
const applyPreviewBorderStyle = typeof dockerRuntimeShared.applyPreviewBorderStyle === 'function'
    ? dockerRuntimeShared.applyPreviewBorderStyle
    : (() => {});
const applyFolderDropdownStyle = typeof dockerRuntimeShared.applyFolderDropdownStyle === 'function'
    ? dockerRuntimeShared.applyFolderDropdownStyle
    : (() => {});
const getPreviewRowLimitValue = typeof dockerRuntimeShared.getPreviewRowLimitValue === 'function'
    ? dockerRuntimeShared.getPreviewRowLimitValue
    : ((settings = {}) => (settings?.preview_rows ?? settings?.previewRows ?? ''));
const normalizeFolderPreviewRowLimit = typeof dockerRuntimeShared.normalizeFolderPreviewRowLimit === 'function'
    ? dockerRuntimeShared.normalizeFolderPreviewRowLimit
    : ((settings = {}) => {
        const raw = String(getPreviewRowLimitValue(settings)).trim().toLowerCase();
        if (raw === '0' || raw === 'auto' || raw === 'unlimited') {
            return 0;
        }
        const parsed = Number.parseInt(raw, 10);
        if (!Number.isFinite(parsed)) {
            return 1;
        }
        return Math.max(1, Math.min(4, parsed));
    });
const isCompactMultiRowPreview = typeof dockerRuntimeShared.isCompactMultiRowPreview === 'function'
    ? dockerRuntimeShared.isCompactMultiRowPreview
    : ((settings = {}) => {
        const normalizedRows = normalizeFolderPreviewRowLimit(settings);
        return normalizedRows === 0 || normalizedRows > 1;
    });
const applyFolderPreviewLayout = typeof dockerRuntimeShared.applyFolderPreviewLayout === 'function'
    ? dockerRuntimeShared.applyFolderPreviewLayout
    : (($preview, settings = {}) => {
        if (!$preview || !$preview.length) {
            return;
        }
        const previewNode = $preview.get(0);
        if (!previewNode || !previewNode.style) {
            return;
        }
        previewNode.dataset.previewRows = String(normalizeFolderPreviewRowLimit(settings));
        previewNode.style.removeProperty('--fvplus-preview-row-limit');
        previewNode.style.removeProperty('--fvplus-preview-max-height');
        previewNode.classList.remove('fv-preview-unlimited-rows', 'fv-preview-multirow');
        const normalizedRows = normalizeFolderPreviewRowLimit(settings);
        if (normalizedRows === 0) {
            previewNode.classList.add('fv-preview-unlimited-rows', 'fv-preview-multirow');
        } else if (normalizedRows > 1) {
            previewNode.classList.add('fv-preview-multirow');
        }
    });
const flattenPreviewWrappers = typeof dockerRuntimeShared.flattenPreviewWrappers === 'function'
    ? dockerRuntimeShared.flattenPreviewWrappers
    : (($preview) => {
        if (!$preview || !$preview.length) {
            return [];
        }
        const $existingRows = $preview.children('.folder-preview-row');
        if ($existingRows.length) {
            $existingRows.children('.folder-preview-wrapper, .folder-preview-divider').appendTo($preview);
            $existingRows.remove();
        }
        const wrappers = $preview.children('.folder-preview-wrapper').get();
        $preview.children('.folder-preview-divider').remove();
        return wrappers;
    });
const restoreLinearPreviewLayout = typeof dockerRuntimeShared.restoreLinearPreviewLayout === 'function'
    ? dockerRuntimeShared.restoreLinearPreviewLayout
    : (($preview, settings = {}) => {
        const wrappers = flattenPreviewWrappers($preview);
        if (settings?.preview_vertical_bars !== true) {
            return wrappers;
        }
        const barsColor = settings?.preview_vertical_bars_color || settings?.preview_border_color || '';
        wrappers.forEach((wrapper, index) => {
            if (index < wrappers.length - 1) {
                $(wrapper).after(`<div class="folder-preview-divider" ${barsColor ? `style="border-color: ${barsColor};"` : ''}></div>`);
            }
        });
        return wrappers;
    });
const finalizePreviewRows = typeof dockerRuntimeShared.finalizePreviewRows === 'function'
    ? dockerRuntimeShared.finalizePreviewRows
    : (($preview, rowSlices = [], settings = {}) => {
        if (!$preview || !$preview.length) {
            return;
        }
        const addDividers = settings?.preview_vertical_bars === true;
        const barsColor = settings?.preview_vertical_bars_color || settings?.preview_border_color || '';
        $preview.empty();
        rowSlices.forEach((slice) => {
            const $row = $('<div class="folder-preview-row"></div>');
            slice.forEach((wrapper, index) => {
                $row.append(wrapper);
                if (addDividers && index < slice.length - 1) {
                    $row.append(`<div class="folder-preview-divider" ${barsColor ? `style="border-color: ${barsColor};"` : ''}></div>`);
                }
            });
            $preview.append($row);
        });
    });
const utils = window.FolderViewPlusUtils || {
    normalizePrefs: () => ({
        sortMode: 'created',
        manualOrder: [],
        hideEmptyFolders: false,
        appColumnWidth: 'standard',
        autoRules: [],
        badges: { running: true, stopped: false, updates: true },
        runtimePrefsSchema: 2,
        liveRefreshEnabled: false,
        liveRefreshSeconds: 20,
        performanceMode: false,
        lazyPreviewEnabled: false,
        lazyPreviewThreshold: 30,
        health: {
            cardsEnabled: true,
            runtimeBadgeEnabled: false,
            compact: false,
            warnStoppedPercent: 60,
            criticalStoppedPercent: 90,
            profile: 'balanced',
            updatesMode: 'maintenance',
            allStoppedMode: 'critical'
        }
    }),
    getAutoRuleMatches: () => [],
    DEFAULT_FOLDER_STATUS_COLORS: localDefaultFolderStatusColors,
    getFolderStatusColors: (settings) => {
        return typeof dockerRuntimeShared.getFolderStatusColors === 'function'
            ? dockerRuntimeShared.getFolderStatusColors(settings)
            : {
                started: localDefaultFolderStatusColors.started,
                paused: localDefaultFolderStatusColors.paused,
                stopped: localDefaultFolderStatusColors.stopped
            };
    },
    escapeHtml: (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;'),
    sanitizeImageSrc: (value, fallback = '/plugins/dynamix.docker.manager/images/question.png') => {
        const raw = String(value || '').trim();
        if (!raw || /^javascript:/i.test(raw)) {
            return fallback;
        }
        return String(raw)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
};
const fatalBanner = window.FolderViewPlusFatalBanner || null;
const dockerFatalBannerRuntimeConfig = (window.FolderViewPlusFatalRuntimeContext && typeof window.FolderViewPlusFatalRuntimeContext === 'object')
    ? window.FolderViewPlusFatalRuntimeContext
    : {};
const DOCKER_FATAL_BANNER_HOST_SELECTOR = String(dockerFatalBannerRuntimeConfig.hostSelector || '#fvplus-docker-runtime-banner-host, .canvas').trim() || '#fvplus-docker-runtime-banner-host, .canvas';
const createDockerRuntimeDiagnosticsBridge = typeof dockerRuntimeShared.createRuntimeDiagnosticsBridge === 'function'
    ? dockerRuntimeShared.createRuntimeDiagnosticsBridge
    : null;
const dockerRuntimeDiagnostics = createDockerRuntimeDiagnosticsBridge
    ? createDockerRuntimeDiagnosticsBridge({
        context: 'Docker',
        hostSelector: DOCKER_FATAL_BANNER_HOST_SELECTOR,
        runtimeContext: dockerFatalBannerRuntimeConfig,
        codePrefix: 'FVPLUS-DKR',
        fatalTitle: 'Docker runtime failed',
        fatalMessage: 'FolderView Plus could not finish rendering folders on the Docker page.',
        degradedTitle: 'Docker page loaded in degraded mode',
        degradedMessage: 'FolderView Plus kept the Docker page open, but part of the folder runtime did not load.'
    })
    : Object.freeze({
        setEnvironment: () => {},
        markStep: () => {},
        setPhase: () => {},
        recordAction: () => {},
        setModuleStatus: () => {},
        reportMissingModules: () => {},
        reportFatalError: () => {},
        reportDegradedState: () => {},
        inferCategory: (_error, fallbackCategory = 'runtime-failed') => fallbackCategory,
        createRequest: (url) => $.get(url).promise()
    });
const markDockerFatalBannerStep = (step) => dockerRuntimeDiagnostics.markStep(step);
const setDockerFatalBannerPhase = (phase) => dockerRuntimeDiagnostics.setPhase(phase);
const recordDockerFatalBannerAction = (action) => dockerRuntimeDiagnostics.recordAction(action);
const setDockerFatalBannerModuleStatus = (name, status, detail = '') => dockerRuntimeDiagnostics.setModuleStatus(name, status, detail);
const reportDockerBootstrapDependencyBanner = (missingModules) => dockerRuntimeDiagnostics.reportMissingModules(missingModules, {
    message: 'FolderView Plus could not start because required Docker runtime modules failed to load.'
});
const reportDockerFatalRuntimeError = (error, options = {}) => dockerRuntimeDiagnostics.reportFatalError(error, options);
const reportDockerDegradedRuntimeState = (error, options = {}) => dockerRuntimeDiagnostics.reportDegradedState(error, options);
const inferDockerFatalBannerCategory = (error, fallbackCategory = 'runtime-failed') => dockerRuntimeDiagnostics.inferCategory(error, fallbackCategory);
const createDockerRuntimeRequest = (url, options = {}) => dockerRuntimeDiagnostics.createRequest(url, options);
const dockerBootstrapMissingModules = [];
if (!window.FolderViewPlusUtils || typeof window.FolderViewPlusUtils.normalizePrefs !== 'function') {
    dockerBootstrapMissingModules.push('folderviewplus.utils.js');
    setDockerFatalBannerModuleStatus('folderviewplus.utils.js', 'missing', 'normalizePrefs unavailable');
} else {
    setDockerFatalBannerModuleStatus('folderviewplus.utils.js', 'ok', 'normalizePrefs available');
}
if (window.FolderViewPlusThemeResolverModuleLoaded !== true || !themeResolver) {
    dockerBootstrapMissingModules.push('folderviewplus.theme-resolver.js');
    setDockerFatalBannerModuleStatus('folderviewplus.theme-resolver.js', 'missing', 'theme resolver unavailable');
} else {
    setDockerFatalBannerModuleStatus('folderviewplus.theme-resolver.js', 'ok', 'theme resolver ready');
}
if (
    !window.FolderViewPlusRequest
    || typeof window.FolderViewPlusRequest.getJson !== 'function'
    || typeof window.FolderViewPlusRequest.postJson !== 'function'
) {
    dockerBootstrapMissingModules.push('folderviewplus.request.js');
    setDockerFatalBannerModuleStatus('folderviewplus.request.js', 'missing', 'request client unavailable');
} else {
    setDockerFatalBannerModuleStatus('folderviewplus.request.js', 'ok', 'request client ready');
}
if (
    !window.FolderViewDockerRuntimeShared
    || typeof window.FolderViewDockerRuntimeShared.createAsyncActionBoundary !== 'function'
    || typeof window.FolderViewDockerRuntimeShared.applyFolderDropdownStyle !== 'function'
    || typeof createDockerRuntimeDiagnosticsBridge !== 'function'
) {
    dockerBootstrapMissingModules.push('docker.runtime.shared.js');
    setDockerFatalBannerModuleStatus('docker.runtime.shared.js', 'missing', 'shared Docker runtime helpers unavailable');
} else {
    setDockerFatalBannerModuleStatus('docker.runtime.shared.js', 'ok', 'shared Docker runtime helpers ready');
}
if (
    window.FolderViewPlusDockerRuntimeInfoModuleLoaded !== true
    || !dockerRuntimeInfoModule
    || typeof dockerRuntimeInfoModule.createApi !== 'function'
) {
    dockerBootstrapMissingModules.push('docker.runtime.info.js');
    setDockerFatalBannerModuleStatus('docker.runtime.info.js', 'missing', 'Docker runtime info helpers unavailable');
} else {
    setDockerFatalBannerModuleStatus('docker.runtime.info.js', 'ok', 'Docker runtime info helpers ready');
}
if (
    window.FolderViewPlusDockerPreviewActionsModuleLoaded !== true
    || !dockerPreviewActionsModule
    || typeof dockerPreviewActionsModule.createApi !== 'function'
) {
    dockerBootstrapMissingModules.push('docker.runtime.preview-actions.js');
    setDockerFatalBannerModuleStatus('docker.runtime.preview-actions.js', 'missing', 'Docker preview action helpers unavailable');
} else {
    setDockerFatalBannerModuleStatus('docker.runtime.preview-actions.js', 'ok', 'Docker preview action helpers ready');
}
if (
    window.FolderViewPlusDockerRuntimeHierarchyModuleLoaded !== true
    || !dockerRuntimeHierarchyModule
    || typeof dockerRuntimeHierarchyModule.createApi !== 'function'
) {
    dockerBootstrapMissingModules.push('docker.runtime.hierarchy.js');
    setDockerFatalBannerModuleStatus('docker.runtime.hierarchy.js', 'missing', 'Docker hierarchy helpers unavailable');
} else {
    setDockerFatalBannerModuleStatus('docker.runtime.hierarchy.js', 'ok', 'Docker hierarchy helpers ready');
}
if (
    window.FolderViewPlusDockerRuntimeActionsModuleLoaded !== true
    || !dockerRuntimeActionsModule
    || typeof dockerRuntimeActionsModule.createApi !== 'function'
) {
    dockerBootstrapMissingModules.push('docker.runtime.actions.js');
    setDockerFatalBannerModuleStatus('docker.runtime.actions.js', 'missing', 'Docker action helpers unavailable');
} else {
    setDockerFatalBannerModuleStatus('docker.runtime.actions.js', 'ok', 'Docker action helpers ready');
}
if (dockerBootstrapMissingModules.length > 0) {
    reportDockerBootstrapDependencyBanner(dockerBootstrapMissingModules);
    const error = new Error(`FolderView Plus Docker runtime bootstrap failed. Missing modules: ${dockerBootstrapMissingModules.join(', ')}`);
    error.fvplusPhase = 'module-load';
    error.fvplusCategory = 'missing-module';
    if (fatalBanner) {
        error.fvplusBannerShown = true;
    }
    throw error;
}
const DOCKER_HOST_PAGE_REQUIRED_SELECTORS = Object.freeze([
    { label: 'Docker table shell', selector: 'table#docker_containers' },
    { label: 'Docker table body', selector: 'tbody#docker_list' },
    { label: 'Docker header row', selector: '#docker_containers > thead > tr' }
]);
const collectDockerHostPageStructureIssues = () => {
    const missing = [];
    DOCKER_HOST_PAGE_REQUIRED_SELECTORS.forEach((entry) => {
        if (!entry || !entry.selector) {
            return;
        }
        if (!document.querySelector(entry.selector)) {
            missing.push(`${entry.label}: ${entry.selector}`);
        }
    });
    return missing;
};
const ensureDockerHostPageStructure = () => {
    const missing = collectDockerHostPageStructureIssues();
    if (missing.length <= 0) {
        setDockerFatalBannerModuleStatus('host-page-structure', 'ok', 'expected Docker host selectors detected');
        return;
    }
    setDockerFatalBannerModuleStatus('host-page-structure', 'missing', missing.join(' | '));
    const error = new Error(`Expected Docker host page selectors were not found: ${missing.join(', ')}`);
    error.fvplusPhase = 'host-dom';
    error.fvplusCategory = 'host-page-structure';
    reportDockerFatalRuntimeError(error, {
        title: 'Docker page structure changed',
        message: 'FolderView Plus expected the standard Unraid Docker table markup, but required host page elements were missing.',
        code: 'FVPLUS-DKR-DOM-001',
        phase: 'host-dom',
        category: 'host-page-structure',
        detailLabel: 'Missing selectors',
        details: missing
    });
    if (fatalBanner) {
        error.fvplusBannerShown = true;
    }
    throw error;
};
markDockerFatalBannerStep('Docker runtime modules resolved');
ensureDockerHostPageStructure();
markDockerFatalBannerStep('Docker host page signature verified');
const dockerStorageWriter = typeof utils.createBatchedStorageWriter === 'function'
    ? utils.createBatchedStorageWriter(window.localStorage, {
        defaultDelayMs: 72,
        idleTimeoutMs: 900
    })
    : null;
const createDockerRuntimeStateStore = typeof dockerRuntimeShared.createRuntimeStateStore === 'function'
    ? dockerRuntimeShared.createRuntimeStateStore
    : (initialState = {}) => {
        let state = { ...(initialState && typeof initialState === 'object' ? initialState : {}) };
        return {
            getState: () => ({ ...state }),
            get: (key, fallback = undefined) => (Object.prototype.hasOwnProperty.call(state, key) ? state[key] : fallback),
            set: (patch = {}) => {
                if (patch && typeof patch === 'object') {
                    state = { ...state, ...patch };
                }
                return { ...state };
            },
            subscribe: () => () => {}
        };
    };
const createDockerAsyncActionBoundary = typeof dockerRuntimeShared.createAsyncActionBoundary === 'function'
    ? dockerRuntimeShared.createAsyncActionBoundary
    : ({ onError } = {}) => ({
        run: async (_name, action, context = {}) => {
            try {
                return { ok: true, value: await action() };
            } catch (rawError) {
                const error = rawError instanceof Error ? rawError : new Error(String(rawError || 'Unknown error'));
                if (typeof onError === 'function') {
                    onError(_name, error, context);
                }
                return { ok: false, error };
            }
        }
    });
const createDockerContextMenuQuickStripAdapter = typeof dockerRuntimeShared.createContextMenuQuickStripAdapter === 'function'
    ? dockerRuntimeShared.createContextMenuQuickStripAdapter
    : () => ({ enhance: () => false, queueEnhance: () => {} });
const createDockerRuntimePerfTelemetry = typeof dockerRuntimeShared.createRuntimePerfTelemetry === 'function'
    ? dockerRuntimeShared.createRuntimePerfTelemetry
    : () => ({ enabled: false, begin: () => {}, end: () => 0, snapshot: () => ({}) });
const createDockerSafeUiActionRunner = typeof dockerRuntimeShared.createSafeUiActionRunner === 'function'
    ? dockerRuntimeShared.createSafeUiActionRunner
    : () => ({ run: async (_actionKey, action) => ({ ok: true, value: await action() }) });
const resolveDockerRuntimePerformanceProfile = typeof dockerRuntimeShared.resolveRuntimePerformanceProfile === 'function'
    ? dockerRuntimeShared.resolveRuntimePerformanceProfile
    : (prefs = {}, _counts = {}) => ({
        performanceMode: prefs?.performanceMode === true,
        strict: false,
        expandRestoreLimit: null,
        minLiveRefreshSeconds: null
    });
const runtimeContracts = dockerRuntimeShared.runtimeContracts && typeof dockerRuntimeShared.runtimeContracts === 'object'
    ? dockerRuntimeShared.runtimeContracts
    : {};
const dockerRuntimeStateStore = createDockerRuntimeStateStore({
    focusedFolderId: '',
    lockedFolderIds: [],
    pinnedFolderIds: []
});
const dockerSafeUiActionRunner = createDockerSafeUiActionRunner();
const getDockerMenuLabel = (key, fallback) => {
    const safeFallback = String(fallback || key || '').trim();
    try {
        if (typeof $ !== 'function' || !$.i18n) {
            return safeFallback;
        }
        const localized = $.i18n(key);
        const normalized = String(localized || '').trim();
        return (!normalized || normalized === key) ? safeFallback : normalized;
    } catch (_error) {
        return safeFallback;
    }
};
const FOLDER_LABEL_KEYS = Array.isArray(runtimeContracts.folderLabelKeys) && runtimeContracts.folderLabelKeys.length
    ? runtimeContracts.folderLabelKeys.map((entry) => String(entry || '').trim()).filter((entry) => entry !== '')
    : ['folderview.plus', 'folder.view3', 'folder.view2', 'folder.view'];
const DOCKER_RUNTIME_APP_WIDTH_MIN = 118;
const DOCKER_RUNTIME_APP_WIDTH_MAX = 1280;
const DOCKER_RUNTIME_APP_CHROME_WIDTH = 132;
const DOCKER_RUNTIME_APP_TEXT_BUFFER = 12;
const DOCKER_RUNTIME_APP_OVERFLOW_CLIENT_WIDTH_MIN = 36;
const DOCKER_RUNTIME_APP_OVERFLOW_NUDGE_MAX = 56;
const DOCKER_RUNTIME_APP_WIDTH_FLOOR_HEADROOM = 56;
const DOCKER_RUNTIME_APP_WIDTH_MOBILE_SCALE = 1;
const DOCKER_RUNTIME_APP_WIDTH_MOBILE_MIN = 136;
const DOCKER_RUNTIME_VERSION_GAP_MIN = 8;
const DOCKER_RUNTIME_VERSION_GAP_MAX = 26;
const DOCKER_RUNTIME_VERSION_GAP_ADJUST_MAX_STEP = 64;
const DOCKER_RUNTIME_WIDTH_REFLOW_DEBOUNCE_MS = 72;
const DOCKER_RUNTIME_WIDTH_DEBUG_STORAGE_KEY = 'fvplus.runtime.docker.widthDebug.v1';
const DOCKER_RUNTIME_COLUMN_WIDTH_MIN = 88;
const DOCKER_RUNTIME_COLUMN_WIDTH_MAX = 920;
const DOCKER_RUNTIME_APP_PRESET_WIDTHS = Object.freeze({
    compact: 128,
    standard: 142,
    wide: 188
});
const runtimeColumnLayout = window.FolderViewPlusRuntimeColumnLayout || null;
const dockerRuntimeColumnLayoutEngine = runtimeColumnLayout && typeof runtimeColumnLayout.createColumnLayoutEngine === 'function'
    ? runtimeColumnLayout.createColumnLayoutEngine({
        minWidth: DOCKER_RUNTIME_APP_WIDTH_MIN,
        maxWidth: DOCKER_RUNTIME_APP_WIDTH_MAX,
        presetWidths: DOCKER_RUNTIME_APP_PRESET_WIDTHS,
        desktopVarName: '--fvplus-docker-app-column-width',
        mobileVarName: '--fvplus-docker-app-column-width-mobile',
        mobileScale: DOCKER_RUNTIME_APP_WIDTH_MOBILE_SCALE,
        mobileMin: DOCKER_RUNTIME_APP_WIDTH_MOBILE_MIN
    })
    : null;
let lastAppliedRuntimePrefs = null;
let dockerRuntimeResizerBindTimer = null;
let dockerRuntimeResizerRetryTimer = null;
let dockerRuntimeResizerRetryCount = 0;
let dockerRuntimeResizerObserver = null;
let dockerRuntimeAutoAppWidthFloor = null;
let dockerRuntimeAutoAppWidthFloorMode = null;
let dockerRuntimeInfoByName = {};
let dockerRuntimeInfoApi = null;
let dockerPreviewActionsApi = null;
let dockerRuntimeHierarchyApi = null;
let dockerRuntimeActionsApi = null;
const DOCKER_RUNTIME_WIDTH_PHASES = Object.freeze({
    idle: 'idle',
    debounce: 'debounce',
    measure: 'measure',
    apply: 'apply'
});
const dockerRuntimeWidthState = {
    phase: DOCKER_RUNTIME_WIDTH_PHASES.idle,
    debounceTimer: null,
    pendingReason: '',
    lastReason: 'init',
    fontReadyBound: false,
    debugPanel: null,
    lastDecision: null
};
const getFolderLabelValue = (labels) => {
    const source = labels && typeof labels === 'object' ? labels : {};
    for (const key of FOLDER_LABEL_KEYS) {
        if (typeof source[key] === 'string' && source[key].trim() !== '') {
            return source[key].trim();
        }
    }
    return '';
};
const getDockerRuntimeInfoApi = () => {
    if (!dockerRuntimeInfoApi && dockerRuntimeInfoModule && typeof dockerRuntimeInfoModule.createApi === 'function') {
        dockerRuntimeInfoApi = dockerRuntimeInfoModule.createApi({
            window,
            document,
            $,
            getDockerRuntimeInfoMap: () => dockerRuntimeInfoByName,
            setDockerRuntimeInfoMap: (next) => {
                dockerRuntimeInfoByName = next && typeof next === 'object' ? next : {};
                return dockerRuntimeInfoByName;
            },
            syncDockerVisibleFoldersFromRuntimeCache: () => syncDockerVisibleFoldersFromRuntimeCache(),
            resolvePreferredWebuiValue: (...candidates) => resolvePreferredWebuiValue(...candidates),
            getFolderLabelValue,
            folderLabelKeys: FOLDER_LABEL_KEYS,
            getGlobalFolders: () => globalFolders,
            getFolderDescendants: (id) => getFolderDescendants(id),
            folderHasChildren: (id) => folderHasChildren(id),
            isHostUpdateSyncSuspended: () => isDockerHostUpdateSyncSuspended()
        });
    }
    return dockerRuntimeInfoApi;
};
const getDockerPreviewActionsApi = () => {
    if (!dockerPreviewActionsApi && dockerPreviewActionsModule && typeof dockerPreviewActionsModule.createApi === 'function') {
        dockerPreviewActionsApi = dockerPreviewActionsModule.createApi({
            window,
            $,
            escapeHtml: (value) => escapeHtml(value),
            getSafeWebuiUrl: (value) => getSafeWebuiUrl(value),
            openWebuiInNewTab: (url) => openWebuiInNewTab(url),
            openTerminal: (type, containerName, shellValue) => openTerminal(type, containerName, shellValue),
            getDirectMemberRowsForFolder: (id) => getDirectMemberRowsForFolder(id),
            shouldRenderPreviewWebuiPlaceholder: (settings, allowWebui) => shouldRenderPreviewWebuiPlaceholder(settings, allowWebui),
            appendPreviewWebuiPlaceholder: ($target) => appendPreviewWebuiPlaceholder($target),
            isCompactMultiRowPreview: (settings) => isCompactMultiRowPreview(settings),
            applyFolderPreviewLayout: ($preview, settings) => applyFolderPreviewLayout($preview, settings),
            layoutFolderPreviewRows: ($preview, settings) => layoutFolderPreviewRows($preview, settings),
            webuiLinkRel: WEBUI_LINK_REL
        });
    }
    return dockerPreviewActionsApi;
};
const getDockerRuntimeHierarchyApi = () => {
    if (
        !dockerRuntimeHierarchyApi
        && dockerRuntimeHierarchyModule
        && typeof dockerRuntimeHierarchyModule.createApi === 'function'
    ) {
        dockerRuntimeHierarchyApi = dockerRuntimeHierarchyModule.createApi({
            window,
            $,
            getGlobalFolders: () => globalFolders,
            getDockerFolderHierarchy: () => dockerFolderHierarchy,
            setDockerFolderHierarchy: (next) => {
                dockerFolderHierarchy = next && typeof next === 'object'
                    ? next
                    : { ids: [], parentById: {}, childrenById: {} };
                return dockerFolderHierarchy;
            },
            normalizeFolderParentId: (value) => normalizeFolderParentId(value),
            folderEvents,
            getDirectMemberRowsForFolder: (id) => getDirectMemberRowsForFolder(id),
            forceCollapseFolderRow: (id, syncStatus = true) => forceCollapseFolderRow(id, syncStatus),
            persistExpandedStateFromGlobal: () => persistDockerExpandedStateFromGlobal(),
            applyFocusedFolderState: () => applyDockerFocusedFolderState(),
            queueRuntimeResizerBind: () => queueDockerRuntimeResizerBind(),
            scheduleRuntimeWidthReflow: (reason, delayMs) => scheduleDockerRuntimeWidthReflow(reason, delayMs),
            buildRuntimeContainerMapForFolder: (folderId, includeDescendants = false) =>
                buildRuntimeContainerMapForFolder(folderId, includeDescendants),
            syncDockerFolderMemberRows: (id, runtimeContainers) => syncDockerFolderMemberRows(id, runtimeContainers),
            applyFolderStatusColorOverrides: ($row, settings) => applyFolderStatusColorOverrides($row, settings),
            applyFolderAccentStyle: ($row, settings) => applyFolderAccentStyle($row, settings),
            applyFolderDropdownStyle: ($row, settings) => applyFolderDropdownStyle($row, settings),
            applyPreviewBorderStyle: (previewNode, settings) => applyPreviewBorderStyle(previewNode, settings),
            applyFolderPreviewLayout: ($preview, settings) => applyFolderPreviewLayout($preview, settings),
            layoutFolderPreviewRows: ($preview, settings) => layoutFolderPreviewRows($preview, settings),
            buildDockerPreviewItem: (options) => buildDockerPreviewItem(options),
            appendDockerPreviewActionButtons: ($target, settings, containerName, shellValue, webuiUrl) =>
                appendDockerPreviewActionButtons($target, settings, containerName, shellValue, webuiUrl),
            decorateDockerPreviewMemberTriggers: ($targets, folderId, containerName) =>
                decorateDockerPreviewMemberTriggers($targets, folderId, containerName),
            getSafeWebuiUrl: (value) => getSafeWebuiUrl(value),
            isCompactMultiRowPreview: (settings) => isCompactMultiRowPreview(settings),
            debugEnabled: FOLDER_VIEW_DEBUG_MODE,
            console: window.console
        });
    }
    return dockerRuntimeHierarchyApi;
};
const getDockerRuntimeActionsApi = () => {
    if (
        !dockerRuntimeActionsApi
        && dockerRuntimeActionsModule
        && typeof dockerRuntimeActionsModule.createApi === 'function'
    ) {
        dockerRuntimeActionsApi = dockerRuntimeActionsModule.createApi({
            window,
            document,
            $,
            swal,
            openDocker,
            hideAllTips,
            getGlobalFolders: () => globalFolders,
            getFolderChildren: (id) => getFolderChildren(id),
            getFolderDescendants: (id) => getFolderDescendants(id),
            isDockerFolderLocked: (id) => isDockerFolderLocked(id),
            ensureDockerFolderUnlocked: (id, actionLabel = 'This action') => ensureDockerFolderUnlocked(id, actionLabel),
            normalizeFolderParentId: (value) => normalizeFolderParentId(value),
            escapeHtml: (value) => escapeHtml(value),
            getSafeWebuiUrl: (value) => getSafeWebuiUrl(value),
            openWebuiPopupWindow: (url, targetName = '_blank') => openWebuiPopupWindow(url, targetName),
            getScopedRuntimeContainersForFolder: (folderId, includeDescendants = true) =>
                getScopedRuntimeContainersForFolder(folderId, includeDescendants),
            runDockerGuardedAction: (actionName, action, context = {}) =>
                runDockerGuardedAction(actionName, action, context),
            getDockerMenuLabel: (key, fallback) => getDockerMenuLabel(key, fallback),
            folderEvents,
            refreshDockerRuntimeState: (options = {}) => refreshDockerRuntimeStateInPlace(options),
            queueLoadlistRefresh: (options = {}) => queueLoadlistRefresh(options),
            armDockerPostUpdateRuntimeReconcileWindow: (durationMs = 0, options = {}) =>
                armDockerPostUpdateRuntimeReconcileWindow(durationMs, options),
            suspendDockerHostUpdateSync: (durationMs = 0) => suspendDockerHostUpdateSync(durationMs),
            loadlist: () => loadlist(),
            eventURL,
            debugEnabled: FOLDER_VIEW_DEBUG_MODE,
            console: window.console
        });
    }
    return dockerRuntimeActionsApi;
};
const syncDockerHostRowUpdateStatesFromDom = (names = []) => {
    const runtimeInfoApi = getDockerRuntimeInfoApi();
    return runtimeInfoApi && typeof runtimeInfoApi.syncDockerHostRowUpdateStatesFromDom === 'function'
        ? runtimeInfoApi.syncDockerHostRowUpdateStatesFromDom(names)
        : false;
};
const ensureDockerHostRowUpdateObserver = () => {
    const runtimeInfoApi = getDockerRuntimeInfoApi();
    if (runtimeInfoApi && typeof runtimeInfoApi.ensureDockerHostRowUpdateObserver === 'function') {
        runtimeInfoApi.ensureDockerHostRowUpdateObserver();
    }
};
const buildDockerRuntimeInfoRenderEntry = (name, entry = {}, previousEntry = null) => {
    const runtimeInfoApi = getDockerRuntimeInfoApi();
    return runtimeInfoApi && typeof runtimeInfoApi.buildDockerRuntimeInfoRenderEntry === 'function'
        ? runtimeInfoApi.buildDockerRuntimeInfoRenderEntry(name, entry, previousEntry)
        : (entry && typeof entry === 'object' ? entry : {});
};
const normalizeDockerRuntimeInfoMap = (source, previousMap = null) => {
    const runtimeInfoApi = getDockerRuntimeInfoApi();
    return runtimeInfoApi && typeof runtimeInfoApi.normalizeDockerRuntimeInfoMap === 'function'
        ? runtimeInfoApi.normalizeDockerRuntimeInfoMap(source, previousMap)
        : {};
};
const escapeHtml = typeof utils.escapeHtml === 'function'
    ? utils.escapeHtml
    : ((value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;'));
const sanitizeImageSrc = typeof utils.sanitizeImageSrc === 'function'
    ? utils.sanitizeImageSrc
    : ((value, fallback = '/plugins/dynamix.docker.manager/images/question.png') => {
        const raw = String(value || '').trim();
        if (!raw || /^javascript:/i.test(raw)) {
            return fallback;
        }
        return escapeHtml(raw);
    });
const WEBUI_LINK_REL = 'noopener noreferrer';
const WEBUI_OPEN_REL = 'noopener';
const WEBUI_TEMPLATE_TOKEN_REGEX = /\[(?:IP|PORT:[^\]]+|HOSTNAME|MAGICDNS|NOSERVE)\]/i;
const DOCKER_HOST_UPDATE_SYNC_SUSPENDED_UNTIL_KEY = '__fvplusDockerHostUpdateSyncSuspendedUntil';
const DOCKER_BULK_UPDATE_TRACE_STORAGE_KEY = 'fv.support.bundle.docker.bulkUpdateTrace.v1';
const DOCKER_BULK_UPDATE_TRACE_LIMIT = 30;
const hasUnresolvedWebuiTemplateTokens = (value) => WEBUI_TEMPLATE_TOKEN_REGEX.test(String(value || '').trim());
const resolvePreferredWebuiValue = (...candidates) => {
    for (const candidate of candidates) {
        const raw = String(candidate || '').trim();
        if (!raw || /^javascript:/i.test(raw) || hasUnresolvedWebuiTemplateTokens(raw)) {
            continue;
        }
        return raw;
    }
    return '';
};
const readDockerHostUpdateSyncSuspendedUntil = () => {
    const rawValue = Number(window?.[DOCKER_HOST_UPDATE_SYNC_SUSPENDED_UNTIL_KEY] || 0);
    return Number.isFinite(rawValue) && rawValue > 0 ? rawValue : 0;
};
const isDockerHostUpdateSyncSuspended = () => readDockerHostUpdateSyncSuspendedUntil() > Date.now();
const suspendDockerHostUpdateSync = (durationMs = 0) => {
    const safeDurationMs = Math.max(0, Number(durationMs) || 0);
    if (safeDurationMs <= 0 || !window) {
        return readDockerHostUpdateSyncSuspendedUntil();
    }
    const nextUntil = Date.now() + safeDurationMs;
    const resolvedUntil = Math.max(readDockerHostUpdateSyncSuspendedUntil(), nextUntil);
    window[DOCKER_HOST_UPDATE_SYNC_SUSPENDED_UNTIL_KEY] = resolvedUntil;
    return resolvedUntil;
};
const appendDockerBulkUpdateTrace = (eventType, details = {}) => {
    try {
        if (typeof localStorage === 'undefined') {
            return false;
        }
        const existingRaw = String(localStorage.getItem(DOCKER_BULK_UPDATE_TRACE_STORAGE_KEY) || '').trim();
        const existing = existingRaw ? JSON.parse(existingRaw) : {};
        const entries = Array.isArray(existing?.entries) ? existing.entries.slice(-DOCKER_BULK_UPDATE_TRACE_LIMIT) : [];
        entries.push({
            at: new Date().toISOString(),
            eventType: String(eventType || '').trim() || 'unknown',
            details: details && typeof details === 'object' && !Array.isArray(details) ? details : {}
        });
        while (entries.length > DOCKER_BULK_UPDATE_TRACE_LIMIT) {
            entries.shift();
        }
        localStorage.setItem(DOCKER_BULK_UPDATE_TRACE_STORAGE_KEY, JSON.stringify({
            updatedAt: new Date().toISOString(),
            count: entries.length,
            entries
        }));
        return true;
    } catch (_error) {
        return false;
    }
};
const getSafeWebuiUrl = (value) => {
    const raw = String(value || '').trim();
    return raw && !/^javascript:/i.test(raw) && !hasUnresolvedWebuiTemplateTokens(raw) ? raw : '';
};
const openWebuiInNewTab = (url) => {
    const safeUrl = getSafeWebuiUrl(url);
    if (!safeUrl) {
        return false;
    }
    const anchor = document.createElement('a');
    anchor.href = safeUrl;
    anchor.target = '_blank';
    anchor.rel = WEBUI_OPEN_REL;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return true;
};
const openWebuiPopupWindow = (url, targetName = '_blank') => {
    const safeUrl = getSafeWebuiUrl(url);
    if (!safeUrl) {
        return false;
    }
    const popup = window.open(safeUrl, targetName);
    if (!popup) {
        return false;
    }
    try {
        popup.opener = null;
    } catch (_error) {
        // Cross-origin popup guards can throw after the tab is opened; the launch already succeeded.
    }
    return true;
};
const getPreviewContainerStatusMeta = (entry = {}) => {
    const running = entry?.state === true;
    const paused = running && entry?.pause === true;
    if (running && paused) {
        return { key: 'paused', icon: 'fa-pause', className: 'fv-preview-status-paused' };
    }
    if (running) {
        return { key: 'started', icon: 'fa-play', className: 'fv-preview-status-started' };
    }
    return { key: 'stopped', icon: 'fa-square', className: 'fv-preview-status-stopped' };
};
const getFolderPreviewItemsPerRow = (settings = {}) => {
    const compactMultiRow = isCompactMultiRowPreview(settings);
    switch (Number(settings?.preview || 0)) {
        case 2:
            return 10;
        case 3:
            return compactMultiRow ? 5 : 5;
        case 4:
            return 4;
        case 1:
        default:
            return compactMultiRow ? 5 : 4;
    }
};
const shouldRenderPreviewWebuiPlaceholder = (settings = {}, webuiQuickActionEnabled = false) =>
    settings?.preview_vertical_bars === true
    && webuiQuickActionEnabled === true;

const appendPreviewWebuiPlaceholder = ($target) => {
    if (!$target || !$target.length) {
        return;
    }
    $target.append(
        $('<span class="folder-element-custom-btn folder-element-webui fv-preview-webui-placeholder" aria-hidden="true"></span>')
            .append('<span class="fv-preview-webui-placeholder-icon"><i class="fa fa-globe" aria-hidden="true"></i></span>')
    );
};

const buildDockerPreviewItem = ({ entry = {}, settings = {}, autostart = false }) => {
    const previewMode = Number(settings?.preview || 0);
    const compactMultiRow = isCompactMultiRowPreview(settings);
    const safeName = escapeHtml(entry?.name || '');
    const safeIcon = sanitizeImageSrc(entry?.icon || '/plugins/dynamix.docker.manager/images/question.png');
    const previewStateMeta = getPreviewContainerStatusMeta(entry);
    const stateLabel = escapeHtml($.i18n(previewStateMeta.key));
    const previewStatusTitle = stateLabel;
    const imageStyle = settings?.preview_grayscale ? ' style="filter: grayscale(100%);"' : '';
    const updateClass = settings?.preview_update && entry?.update === true ? ' orange-text' : '';
    const textWidth = String(settings?.preview_text_width || '').trim();
    const textWidthStyle = textWidth ? ` style="width:${escapeHtml(textWidth)};"` : '';
    const autostartClass = autostart ? ' autostart' : '';
    let itemMarkup = '';
    let triggerSelector = '.fv-preview-trigger';

    if (compactMultiRow) {
        switch (previewMode) {
            case 2:
                itemMarkup = `
                    <span class="outer fv-docker-preview-card fv-docker-preview-card-compact fv-docker-preview-mode-2 fv-preview-trigger fv-preview-tooltip-proxy${autostartClass}">
                        <span class="hand fv-preview-trigger fv-preview-tooltip-proxy"><img src="${safeIcon}" class="img folder-img" onerror='this.src="/plugins/dynamix.docker.manager/images/question.png"'${imageStyle}></span>
                    </span>
                `;
                triggerSelector = '.fv-docker-preview-card';
                break;
            case 3:
            case 4:
                itemMarkup = `
                    <span class="outer fv-docker-preview-card fv-docker-preview-card-compact fv-docker-preview-mode-${previewMode} fv-preview-trigger fv-preview-tooltip-proxy${autostartClass}">
                        <span class="inner fv-preview-trigger fv-preview-tooltip-proxy">
                            <span class="appname${updateClass}"${textWidthStyle}><a class="exec${updateClass}">${safeName}</a></span>
                            <span class="fv-preview-meta-compact">
                            <span class="fv-preview-status-compact" title="${previewStatusTitle}">
                                <i class="fa ${previewStateMeta.icon} ${previewStateMeta.className}" aria-hidden="true"></i><span class="state"> ${stateLabel}</span>
                            </span>
                            <span class="fv-preview-actions-compact"></span>
                            </span>
                        </span>
                    </span>
                `;
                triggerSelector = '.fv-docker-preview-card';
                break;
            case 1:
            default:
                itemMarkup = `
                    <span class="outer fv-docker-preview-card fv-docker-preview-card-compact fv-docker-preview-mode-1 fv-preview-trigger fv-preview-tooltip-proxy${autostartClass}">
                        <span class="hand fv-preview-trigger fv-preview-tooltip-proxy"><img src="${safeIcon}" class="img folder-img" onerror='this.src="/plugins/dynamix.docker.manager/images/question.png"'${imageStyle}></span>
                        <span class="inner fv-preview-trigger fv-preview-tooltip-proxy">
                            <span class="appname${updateClass}"${textWidthStyle}><a class="exec${updateClass}">${safeName}</a></span>
                            <span class="fv-preview-meta-compact">
                            <span class="fv-preview-status-compact" title="${previewStatusTitle}">
                                <i class="fa ${previewStateMeta.icon} ${previewStateMeta.className}" aria-hidden="true"></i><span class="state"> ${stateLabel}</span>
                            </span>
                            <span class="fv-preview-actions-compact"></span>
                            </span>
                        </span>
                    </span>
                `;
                triggerSelector = '.fv-docker-preview-card';
                break;
        }
        const $compactItem = $(itemMarkup);
        return {
            $item: $compactItem,
            $tooltipTrigger: triggerSelector === '.fv-docker-preview-card'
                ? $compactItem
                : $compactItem.find(triggerSelector).first()
        };
    }

    switch (previewMode) {
        case 2:
            itemMarkup = `
                <span class="outer fv-docker-preview-card fv-docker-preview-mode-2${autostartClass}">
                    <span class="hand fv-preview-trigger"><img src="${safeIcon}" class="img folder-img" onerror='this.src="/plugins/dynamix.docker.manager/images/question.png"'${imageStyle}></span>
                </span>
            `;
            triggerSelector = '.hand';
            break;
        case 3:
            itemMarkup = `
                <span class="outer fv-docker-preview-card fv-docker-preview-mode-3${autostartClass}">
                    <span class="inner fv-preview-trigger">
                        <span class="appname${updateClass}"${textWidthStyle}><a class="exec${updateClass}">${safeName}</a></span><br>
                        <i class="fa ${previewStateMeta.icon} ${previewStateMeta.className}"></i><span class="state ${previewStateMeta.className}"> ${stateLabel}</span>
                    </span>
                </span>
            `;
            triggerSelector = '.appname, .state, i.fa';
            break;
        case 4:
            itemMarkup = `
                <span class="outer fv-docker-preview-card fv-docker-preview-mode-4${autostartClass}">
                    <span class="inner fv-preview-trigger">
                        <span class="appname${updateClass}"${textWidthStyle}><a class="exec${updateClass}">${safeName}</a></span><br>
                        <i class="fa ${previewStateMeta.icon} ${previewStateMeta.className}" title="${previewStatusTitle}" aria-hidden="true"></i><span class="state ${previewStateMeta.className}"> ${stateLabel}</span>
                    </span>
                </span>
            `;
            triggerSelector = '.appname, .state, i.fa';
            break;
        case 1:
        default:
            itemMarkup = `
                <span class="outer fv-docker-preview-card fv-docker-preview-mode-1${autostartClass}">
                    <span class="hand fv-preview-trigger"><img src="${safeIcon}" class="img folder-img" onerror='this.src="/plugins/dynamix.docker.manager/images/question.png"'${imageStyle}></span>
                    <span class="inner fv-preview-trigger">
                        <span class="appname${updateClass}"${textWidthStyle}><a class="exec${updateClass}">${safeName}</a></span><br>
                        <i class="fa ${previewStateMeta.icon} ${previewStateMeta.className}" title="${previewStatusTitle}" aria-hidden="true"></i><span class="state ${previewStateMeta.className}"> ${stateLabel}</span>
                    </span>
                </span>
            `;
            triggerSelector = '.hand, .appname, .state, i.fa';
            break;
    }

    const $item = $(itemMarkup);
    return {
        $item,
        $tooltipTrigger: $item.find(triggerSelector).first()
    };
};
const layoutFolderPreviewRows = ($preview, settings = {}) => {
    if (!$preview || !$preview.length) {
        return;
    }
    if (!isCompactMultiRowPreview(settings)) {
        restoreLinearPreviewLayout($preview, settings);
        return;
    }
    const wrappers = flattenPreviewWrappers($preview);
    if (!wrappers.length) {
        return;
    }
    const rowLimit = normalizeFolderPreviewRowLimit(settings);
    const maxItemsPerRow = Math.max(1, getFolderPreviewItemsPerRow(settings));
    const addDividers = settings?.preview_vertical_bars === true;
    const barsColor = settings?.preview_vertical_bars_color || settings?.preview_border_color || '';
    const previewElement = $preview.get(0);
    const availableWidth = Math.max(0, Math.floor($preview.innerWidth() || previewElement?.clientWidth || 0));
    const rows = [];
    let currentRow = [];
    const $measurement = availableWidth > 0
        ? $('<div class="folder-preview fv-preview-multirow fv-preview-row-measure"></div>')
            .css({
                position: 'absolute',
                left: '-99999px',
                top: '0',
                visibility: 'hidden',
                pointerEvents: 'none',
                width: `${availableWidth}px`,
                height: 'auto',
                maxHeight: 'none',
                overflow: 'visible',
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                alignContent: 'flex-start',
                padding: '0',
                border: '0',
                background: 'transparent'
            })
            .appendTo(document.body)
        : null;
    if ($measurement) {
        const measurementWrappers = wrappers.map((wrapper, index) => {
            const $clone = $(wrapper).clone();
            $measurement.append($clone);
            if (addDividers && index < wrappers.length - 1) {
                $measurement.append(`<div class="folder-preview-divider" ${barsColor ? `style="border-color: ${barsColor};"` : ''}></div>`);
            }
            return $clone.get(0);
        });
        let currentTop = null;
        measurementWrappers.forEach((measurementWrapper, index) => {
            const wrapperTop = Number(measurementWrapper?.offsetTop ?? 0);
            const startsNewRow = currentRow.length > 0
                && wrapperTop > (currentTop ?? wrapperTop)
                && (rowLimit === 0 || rows.length + 1 < rowLimit);
            if (startsNewRow) {
                rows.push(currentRow);
                currentRow = [];
            }
            currentTop = wrapperTop;
            currentRow.push(wrappers[index]);
        });
        if (currentRow.length) {
            rows.push(currentRow);
        }
    } else {
        wrappers.forEach((wrapper) => {
            const exceedsItemCap = currentRow.length >= maxItemsPerRow;
            if (exceedsItemCap && (rowLimit === 0 || rows.length + 1 < rowLimit)) {
                rows.push(currentRow);
                currentRow = [wrapper];
                return;
            }
            currentRow.push(wrapper);
        });
        if (currentRow.length) {
            rows.push(currentRow);
        }
    }
    if ($measurement) {
        $measurement.remove();
    }
    const visibleRows = rowLimit === 0 ? rows : rows.slice(0, rowLimit);
    finalizePreviewRows($preview, visibleRows, settings);
};
const decorateDockerPreviewMemberTriggers = ($elements, folderId, containerName) => {
    if (!$elements || !$elements.length) {
        return;
    }
    $elements
        .removeClass('fv-docker-member-menu-trigger')
        .removeAttr('data-folder-id')
        .removeAttr('data-container-name')
        .removeAttr('title');
};
const bindCompactPreviewDefaultContext = ($item, $sourceRow) => {
    if (!$item || !$item.length || !$sourceRow || !$sourceRow.length) {
        return;
    }
    const $sourceTrigger = $sourceRow.find('td.ct-name > span.outer > span.hand').first();
    const $fallbackTrigger = $sourceRow.find('td.ct-name > span.outer > span.inner > span.appname > a.exec').first();
    const $nativeTrigger = $sourceTrigger.length ? $sourceTrigger : $fallbackTrigger;
    if (!$nativeTrigger.length) {
        return;
    }
    const inlineClick = String($nativeTrigger.attr('onclick') || '').trim();
    const inlineContextMenu = String($nativeTrigger.attr('oncontextmenu') || '').trim();
    const title = String($nativeTrigger.attr('title') || '').trim();
    const targets = [
        $item,
        $item.find('.hand').first(),
        $item.find('.inner').first(),
        $item.find('span.appname').first(),
        $item.find('span.appname > a.exec').first()
    ].filter(($target) => $target && $target.length);
    targets.forEach(($target) => {
        $target.addClass('hand');
        if (inlineClick) {
            $target.attr('onclick', inlineClick);
        }
        if (inlineContextMenu) {
            $target.attr('oncontextmenu', inlineContextMenu);
        }
        if (title) {
            $target.attr('title', title);
        }
    });
    const $appLink = $item.find('span.appname > a.exec').first();
    if ($appLink.length && !$appLink.attr('href')) {
        $appLink.attr('href', '#');
    }
};
const buildCompactPreviewDefaultContextItem = ($sourceRow, settings = {}, autostart = false) => {
    if (!$sourceRow || !$sourceRow.length) {
        return null;
    }
    const previewMode = Number(settings?.preview || 0);
    const autostartClass = autostart ? ' autostart' : '';
    const $sourceOuter = $sourceRow.find('td.ct-name > span.outer').first();
    if (!$sourceOuter.length) {
        return null;
    }
    const $item = $sourceOuter.clone();
    const compactMode = previewMode >= 1 && previewMode <= 4 ? previewMode : 1;
    $item.addClass(`fv-docker-preview-card fv-docker-preview-card-compact fv-docker-preview-mode-${compactMode}${autostartClass}`);
    $item.removeAttr('id');
    $item.find('br').remove();
    $item.find('i[id^="load-"]').each((_, node) => {
        const $node = $(node);
        const currentId = String($node.attr('id') || '').trim();
        if (currentId) {
            $node.attr('id', `folder-${currentId}`);
        }
    });
    const $hand = $item.children('span.hand').first();
    const $inner = $item.children('span.inner').first();
    if (!$inner.length) {
        return $item;
    }
    const $appName = $inner.children('span.appname').first();
    const $meta = $('<span class="fv-preview-meta-compact"></span>');
    const $status = $('<span class="fv-preview-status-compact"></span>');
    const $trailingNodes = $appName.length ? $appName.nextAll().detach() : $inner.contents().detach();
    $trailingNodes.each((_, node) => {
        const $node = $(node);
        if ($node.is('.folder-element-custom-btn, .fv-preview-webui-placeholder')) {
            return;
        }
        $status.append($node);
    });
    if ($status.children().length) {
        $meta.append($status);
    }
    if (compactMode !== 2) {
        $meta.append('<span class="fv-preview-actions-compact"></span>');
    }
    if (compactMode === 2) {
        $inner.remove();
    } else {
        if (compactMode === 3 || compactMode === 4) {
            $hand.remove();
        }
        $inner.append($meta);
    }
    return $item;
};
const bindCompactPreviewDefaultContextProxy = ($item) => {
    if (!$item || !$item.length) {
        return;
    }
    const $menuTrigger = $item.find('span.hand, span.appname > a.exec').filter(function() {
        return String($(this).attr('onclick') || '').trim().length > 0
            || String($(this).attr('oncontextmenu') || '').trim().length > 0
            || $(this).hasClass('hand')
            || $(this).hasClass('exec');
    }).first();
    if (!$menuTrigger.length) {
        return;
    }
    const usingAppNameTrigger = $menuTrigger.is('span.appname > a.exec');
    const interactiveSelector = usingAppNameTrigger
        ? 'span.appname, span.appname > a.exec, span.folder-element-custom-btn, span.folder-element-custom-btn > a, .fv-preview-actions-compact, .fv-preview-actions-compact *'
        : '.hand, span.folder-element-custom-btn, span.folder-element-custom-btn > a, .fv-preview-actions-compact, .fv-preview-actions-compact *';
    $item
        .off('.fvCompactDefaultContextProxy')
        .on('click.fvCompactDefaultContextProxy', function(event) {
            const $target = $(event.target);
            if ($target.closest(interactiveSelector).length) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            $menuTrigger.trigger('click');
        })
        .on('contextmenu.fvCompactDefaultContextProxy', function(event) {
            const $target = $(event.target);
            if ($target.closest(interactiveSelector).length) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            $menuTrigger.trigger('contextmenu');
        });
};
const decorateDockerFolderMemberRow = ($row, folderId, containerName) => {
    if (!$row || !$row.length) {
        return;
    }
    decorateDockerPreviewMemberTriggers(
        $row.find('td.ct-name span.outer > span.hand, td.ct-name span.outer > span.inner > span.appname, td.ct-name span.outer > span.inner > span.appname > a.exec, td.ct-name span.outer > span.inner > i.folder-load-status, td.ct-name span.outer > span.inner > span.state'),
        folderId,
        containerName
    );
};
$(document)
    .off('click.fvDockerMemberMenuTrigger')
    .off('click.fvDockerMemberMenuAction')
    .off('click.fvDockerPreviewTooltipProxy')
    .off('click.fvDockerPreviewActionFallback')
    .on('click.fvDockerPreviewTooltipProxy', '.fv-preview-tooltip-proxy', function(event) {
        const $proxy = $(event.target).closest('.fv-preview-tooltip-proxy');
        if (!$proxy.length) {
            return;
        }
        const $trigger = $proxy.closest('[id^="folder-preview-"]');
        if (!$trigger.length) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        const ensureInitialized = $trigger.data('fvTooltipEnsureInitialized');
        const tooltipInitialized = $trigger.data('fvTooltipsterInitialized') === true;
        if (typeof ensureInitialized === 'function' && tooltipInitialized !== true) {
            ensureInitialized('click');
            return;
        }
        if (tooltipInitialized === true) {
            try {
                $trigger.tooltipster('open');
            } catch (_error) {
                // Ignore open failures and let the next interaction retry.
            }
        }
    })
    .on('click.fvDockerPreviewActionFallback', '.folder-preview .folder-element-webui > a, .folder-preview .folder-element-console > a, .folder-preview .folder-element-logs > a', function(event) {
        const $link = $(event.target).closest('a');
        if (!$link.length) {
            return;
        }
        const action = String($link.attr('data-fv-preview-action') || '').trim().toLowerCase();
        if (!action) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (action === 'webui') {
            const webuiUrl = String($link.attr('data-webui-url') || $link.attr('href') || '').trim();
            if (webuiUrl) {
                openWebuiInNewTab(webuiUrl);
            }
            return;
        }
        const containerName = String($link.attr('data-container-name') || '').trim();
        if (!containerName) {
            return;
        }
        const shellValue = String($link.attr('data-shell-value') || '').trim() || '/bin/sh';
        openTerminal('docker', containerName, shellValue);
    });
const clampDockerRuntimeColumnWidth = (value, columnIndex = 0) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return null;
    }
    const rounded = Math.round(parsed);
    if (columnIndex === 1) {
        if (dockerRuntimeColumnLayoutEngine && typeof dockerRuntimeColumnLayoutEngine.clampWidth === 'function') {
            return dockerRuntimeColumnLayoutEngine.clampWidth(rounded);
        }
        return Math.max(DOCKER_RUNTIME_APP_WIDTH_MIN, Math.min(DOCKER_RUNTIME_APP_WIDTH_MAX, rounded));
    }
    return Math.max(DOCKER_RUNTIME_COLUMN_WIDTH_MIN, Math.min(DOCKER_RUNTIME_COLUMN_WIDTH_MAX, rounded));
};

const normalizeDockerRuntimeAppColumnMode = (value) => {
    const fallbackNormalize = () => {
        const mode = String(value || '').trim().toLowerCase();
        return mode === 'compact' || mode === 'wide' ? mode : 'standard';
    };
    if (!utils || typeof utils.normalizeAppColumnWidth !== 'function') {
        return fallbackNormalize();
    }
    return utils.normalizeAppColumnWidth(value);
};

const getDockerRuntimeAppColumnMode = () => {
    if (lastAppliedRuntimePrefs && typeof lastAppliedRuntimePrefs === 'object') {
        return normalizeDockerRuntimeAppColumnMode(lastAppliedRuntimePrefs.appColumnWidth);
    }
    if (document.body && typeof document.body.getAttribute === 'function') {
        return normalizeDockerRuntimeAppColumnMode(document.body.getAttribute('data-fvplus-docker-app-width'));
    }
    return 'standard';
};

const isDockerRuntimeWidthDebugEnabled = () => {
    try {
        const params = new URLSearchParams(window.location.search || '');
        if (params.get('fvplusWidthDebug') === '1') {
            return true;
        }
    } catch (_error) {
        // Ignore URL parsing issues in older environments.
    }
    try {
        return localStorage.getItem(DOCKER_RUNTIME_WIDTH_DEBUG_STORAGE_KEY) === '1';
    } catch (_error) {
        return false;
    }
};

const setDockerRuntimeWidthDebugEnabled = (enabled) => {
    const next = enabled === true;
    try {
        if (dockerStorageWriter && typeof dockerStorageWriter.setItem === 'function') {
            dockerStorageWriter.setItem(
                DOCKER_RUNTIME_WIDTH_DEBUG_STORAGE_KEY,
                next ? '1' : '0',
                { delayMs: 0, idle: false }
            );
        } else {
            localStorage.setItem(DOCKER_RUNTIME_WIDTH_DEBUG_STORAGE_KEY, next ? '1' : '0');
        }
    } catch (_error) {
        // Ignore localStorage limitations.
    }
    if (dockerRuntimeWidthState.debugPanel) {
        dockerRuntimeWidthState.debugPanel.style.display = next ? 'block' : 'none';
    }
    if (next) {
        scheduleDockerRuntimeWidthReflow('debug-toggle', 0);
    }
    return next;
};

const ensureDockerRuntimeWidthDebugPanel = () => {
    if (!document.body || dockerRuntimeWidthState.debugPanel) {
        return dockerRuntimeWidthState.debugPanel;
    }
    const panel = document.createElement('div');
    panel.id = 'fvplus-docker-width-debug-panel';
    panel.style.position = 'fixed';
    panel.style.right = '14px';
    panel.style.bottom = '14px';
    panel.style.maxWidth = '340px';
    panel.style.maxHeight = '45vh';
    panel.style.overflow = 'auto';
    panel.style.padding = '8px 10px';
    panel.style.border = '1px solid var(--fvplus-runtime-menu-border, var(--fvplus-theme-border-subtle, currentColor))';
    panel.style.background = 'var(--fvplus-runtime-menu-bg, var(--fvplus-theme-surface-panel, transparent))';
    panel.style.color = 'var(--fvplus-runtime-menu-fg, var(--fvplus-theme-foreground, currentColor))';
    panel.style.fontFamily = 'Consolas, Menlo, monospace';
    panel.style.fontSize = '11px';
    panel.style.lineHeight = '1.42';
    panel.style.zIndex = '1200';
    panel.style.borderRadius = '6px';
    panel.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.4)';
    panel.style.pointerEvents = 'none';
    panel.style.whiteSpace = 'pre-wrap';
    panel.style.display = isDockerRuntimeWidthDebugEnabled() ? 'block' : 'none';
    panel.textContent = 'Docker width debug panel ready.';
    document.body.appendChild(panel);
    dockerRuntimeWidthState.debugPanel = panel;
    return panel;
};

const readDockerRuntimeGapMetrics = () => {
    const rows = Array.from(document.querySelectorAll('tbody#docker_list tr.folder, tbody#docker_view tr.folder'));
    const samples = [];
    rows.forEach((row) => {
        if (!row || row.offsetParent === null || row.classList.contains('fv-nested-hidden')) {
            return;
        }
        const appCell = row.querySelector('td.ct-name.folder-name, td.folder-name');
        const dropdown = row.querySelector('button.folder-dropdown');
        const versionCell = row.querySelector('td.updatecolumn.folder-update');
        if (!appCell || !dropdown || !versionCell) {
            return;
        }
        const appRect = appCell.getBoundingClientRect();
        const dropdownRect = dropdown.getBoundingClientRect();
        const versionRect = versionCell.getBoundingClientRect();
        const appBoundaryGap = appRect.right - dropdownRect.right;
        const versionGap = versionRect.left - dropdownRect.right;
        if (!Number.isFinite(versionGap) || !Number.isFinite(appBoundaryGap)) {
            return;
        }
        samples.push({ versionGap, appBoundaryGap });
    });
    if (!samples.length) {
        return {
            sampleCount: 0,
            minVersionGap: null,
            maxVersionGap: null,
            minAppBoundaryGap: null,
            maxAppBoundaryGap: null
        };
    }
    let minVersionGap = Number.POSITIVE_INFINITY;
    let maxVersionGap = Number.NEGATIVE_INFINITY;
    let minAppBoundaryGap = Number.POSITIVE_INFINITY;
    let maxAppBoundaryGap = Number.NEGATIVE_INFINITY;
    samples.forEach((sample) => {
        minVersionGap = Math.min(minVersionGap, sample.versionGap);
        maxVersionGap = Math.max(maxVersionGap, sample.versionGap);
        minAppBoundaryGap = Math.min(minAppBoundaryGap, sample.appBoundaryGap);
        maxAppBoundaryGap = Math.max(maxAppBoundaryGap, sample.appBoundaryGap);
    });
    return {
        sampleCount: samples.length,
        minVersionGap,
        maxVersionGap,
        minAppBoundaryGap,
        maxAppBoundaryGap
    };
};

const applyDockerRuntimeGapContract = (widthPx, metrics = null) => {
    const current = clampDockerRuntimeColumnWidth(widthPx, 1);
    if (!current) {
        return widthPx;
    }
    const gapMetrics = metrics && typeof metrics === 'object' ? metrics : readDockerRuntimeGapMetrics();
    let adjusted = current;
    if (Number.isFinite(gapMetrics.maxVersionGap) && gapMetrics.maxVersionGap > DOCKER_RUNTIME_VERSION_GAP_MAX) {
        const reduceBy = Math.min(
            DOCKER_RUNTIME_VERSION_GAP_ADJUST_MAX_STEP,
            gapMetrics.maxVersionGap - DOCKER_RUNTIME_VERSION_GAP_MAX
        );
        adjusted -= reduceBy;
    }
    if (Number.isFinite(gapMetrics.minVersionGap) && gapMetrics.minVersionGap < DOCKER_RUNTIME_VERSION_GAP_MIN) {
        const increaseBy = Math.min(
            DOCKER_RUNTIME_VERSION_GAP_ADJUST_MAX_STEP,
            DOCKER_RUNTIME_VERSION_GAP_MIN - gapMetrics.minVersionGap
        );
        adjusted += increaseBy;
    }
    return clampDockerRuntimeColumnWidth(adjusted, 1) || current;
};

const renderDockerRuntimeWidthDebugPanel = (decision) => {
    const panel = ensureDockerRuntimeWidthDebugPanel();
    if (!panel || !isDockerRuntimeWidthDebugEnabled()) {
        return;
    }
    const summary = decision && typeof decision === 'object' ? decision : {};
    const line = (label, value) => `${label}: ${value === null || value === undefined ? 'n/a' : value}`;
    panel.style.display = 'block';
    panel.textContent = [
        '[FolderView Plus] Docker Width',
        line('phase', dockerRuntimeWidthState.phase),
        line('reason', dockerRuntimeWidthState.lastReason),
        line('mode', summary.mode),
        line('estimated', summary.estimatedAppWidth),
        line('overflowAdjusted', summary.overflowAdjustedWidth),
        line('gapAdjusted', summary.gapAdjustedWidth),
        line('floorLimit', summary.floorLimit),
        line('boundedFloor', summary.boundedFloor),
        line('applied', summary.appliedWidth),
        line('gap.sampleCount', summary.gapMetricsAfter?.sampleCount),
        line('gap.minVersion', summary.gapMetricsAfter?.minVersionGap),
        line('gap.maxVersion', summary.gapMetricsAfter?.maxVersionGap),
        line('gap.minBoundary', summary.gapMetricsAfter?.minAppBoundaryGap),
        line('gap.maxBoundary', summary.gapMetricsAfter?.maxAppBoundaryGap),
        line('timestamp', new Date().toISOString()),
        '',
        'toggle: window.toggleDockerRuntimeWidthDebug(true|false)'
    ].join('\n');
};

const getDockerRuntimePresetAppWidth = () => {
    const mode = getDockerRuntimeAppColumnMode();
    if (dockerRuntimeColumnLayoutEngine && typeof dockerRuntimeColumnLayoutEngine.resolvePresetWidth === 'function') {
        return dockerRuntimeColumnLayoutEngine.resolvePresetWidth(mode);
    }
    const preset = DOCKER_RUNTIME_APP_PRESET_WIDTHS[mode] || DOCKER_RUNTIME_APP_PRESET_WIDTHS.standard;
    return clampDockerRuntimeColumnWidth(preset, 1);
};

const getDockerRuntimeTableTargets = () => {
    const tbody = document.querySelector('tbody#docker_list') || document.querySelector('tbody#docker_view');
    if (!tbody) {
        return null;
    }
    const table = tbody.closest('table');
    if (!table) {
        return null;
    }
    const headers = Array.from(table.querySelectorAll('thead th'));
    if (headers.length === 0) {
        return null;
    }
    return { table, headers };
};

const applyDockerRuntimeAppWidthVariables = (desktopWidthPx = null) => {
    if (dockerRuntimeColumnLayoutEngine && typeof dockerRuntimeColumnLayoutEngine.applyCssWidthVars === 'function') {
        dockerRuntimeColumnLayoutEngine.applyCssWidthVars(desktopWidthPx);
        return;
    }
    const safeDesktopWidth = clampDockerRuntimeColumnWidth(desktopWidthPx, 1);
    if (!document.body || !document.body.style) {
        return;
    }
    if (!safeDesktopWidth) {
        document.body.style.removeProperty('--fvplus-docker-app-column-width');
        document.body.style.removeProperty('--fvplus-docker-app-column-width-mobile');
        return;
    }
    const mobileWidth = Math.max(
        DOCKER_RUNTIME_APP_WIDTH_MOBILE_MIN,
        Math.round(safeDesktopWidth * DOCKER_RUNTIME_APP_WIDTH_MOBILE_SCALE)
    );
    document.body.style.setProperty('--fvplus-docker-app-column-width', `${safeDesktopWidth}px`);
    document.body.style.setProperty('--fvplus-docker-app-column-width-mobile', `${mobileWidth}px`);
};

const estimateDockerRuntimeAutoAppWidth = () => {
    const baseline = getDockerRuntimePresetAppWidth() || DOCKER_RUNTIME_APP_PRESET_WIDTHS.standard;
    const rows = Array.from(document.querySelectorAll('tbody#docker_list tr.folder, tbody#docker_view tr.folder'));
    if (dockerRuntimeColumnLayoutEngine && typeof dockerRuntimeColumnLayoutEngine.estimateFromRows === 'function') {
        const estimated = dockerRuntimeColumnLayoutEngine.estimateFromRows({
            rows,
            baseline,
            nameSelector: '.folder-appname',
            auxSelectors: ['.folder-state'],
            indentSelector: '.folder-name-sub',
            hiddenClass: 'fv-nested-hidden',
            chromeWidth: DOCKER_RUNTIME_APP_CHROME_WIDTH,
            textBuffer: DOCKER_RUNTIME_APP_TEXT_BUFFER
        });
        return estimated || baseline;
    }
    return baseline;
};

const adjustDockerRuntimeAppWidthForRenderedOverflow = (baseWidth = null) => {
    const fallback = getDockerRuntimePresetAppWidth() || DOCKER_RUNTIME_APP_PRESET_WIDTHS.standard;
    const startingWidth = clampDockerRuntimeColumnWidth(baseWidth, 1) || fallback;
    const rows = Array.from(document.querySelectorAll('tbody#docker_list tr.folder, tbody#docker_view tr.folder'));
    if (!rows.length) {
        return startingWidth;
    }
    let maxOverflow = 0;
    rows.forEach((row) => {
        if (!row || row.offsetParent === null || row.classList.contains('fv-nested-hidden')) {
            return;
        }
        const widthNodes = [
            row.querySelector('.folder-appname'),
            row.querySelector('.folder-state')
        ].filter(Boolean);
        if (!widthNodes.length) {
            return;
        }
        widthNodes.forEach((node) => {
            const clientWidth = Math.max(0, Math.ceil(node.clientWidth || 0));
            if (clientWidth <= 0) {
                return;
            }
            const rawOverflow = Math.ceil((node.scrollWidth || 0) - clientWidth);
            if (clientWidth < DOCKER_RUNTIME_APP_OVERFLOW_CLIENT_WIDTH_MIN && rawOverflow <= 0) {
                return;
            }
            if (rawOverflow <= 0) {
                return;
            }
            const overflow = Math.min(rawOverflow, DOCKER_RUNTIME_APP_OVERFLOW_NUDGE_MAX);
            if (overflow > maxOverflow) {
                maxOverflow = overflow;
            }
        });
    });
    if (maxOverflow <= 0) {
        return startingWidth;
    }
    // Only nudge width when real rendered clipping exists; avoid global widening.
    const padded = startingWidth + maxOverflow + DOCKER_RUNTIME_APP_TEXT_BUFFER;
    return clampDockerRuntimeColumnWidth(padded, 1) || startingWidth;
};

const buildDockerRuntimeWidthDecision = () => {
    const mode = getDockerRuntimeAppColumnMode();
    if (dockerRuntimeAutoAppWidthFloorMode !== mode) {
        dockerRuntimeAutoAppWidthFloorMode = mode;
        dockerRuntimeAutoAppWidthFloor = null;
    }
    const estimatedAppWidth = estimateDockerRuntimeAutoAppWidth();
    const overflowAdjustedWidth = adjustDockerRuntimeAppWidthForRenderedOverflow(estimatedAppWidth);
    const gapMetricsBefore = readDockerRuntimeGapMetrics();
    const gapAdjustedWidth = applyDockerRuntimeGapContract(overflowAdjustedWidth, gapMetricsBefore);
    const floorLimit = clampDockerRuntimeColumnWidth(
        estimatedAppWidth + DOCKER_RUNTIME_APP_WIDTH_FLOOR_HEADROOM,
        1
    ) || estimatedAppWidth;
    let boundedFloor = null;
    let appliedWidth = gapAdjustedWidth;
    if (Number.isFinite(dockerRuntimeAutoAppWidthFloor)) {
        boundedFloor = Math.min(dockerRuntimeAutoAppWidthFloor, floorLimit);
        appliedWidth = Math.max(appliedWidth, boundedFloor);
    }
    appliedWidth = clampDockerRuntimeColumnWidth(appliedWidth, 1) || estimatedAppWidth;
    const nextFloor = Math.min(appliedWidth, floorLimit);
    return {
        mode,
        estimatedAppWidth,
        overflowAdjustedWidth,
        gapAdjustedWidth,
        floorLimit,
        boundedFloor,
        appliedWidth,
        nextFloor,
        gapMetricsBefore
    };
};

const applyDockerRuntimeColumnWidths = (_widthMap = null) => {
    const targets = getDockerRuntimeTableTargets();
    if (!targets) {
        return;
    }
    const decision = buildDockerRuntimeWidthDecision();
    dockerRuntimeAutoAppWidthFloor = decision.nextFloor;
    const isMobile = window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
    targets.headers.forEach((header, idx) => {
        const index = idx + 1;
        const effectiveWidth = index === 1
            ? (
                isMobile
                    ? Math.max(
                        DOCKER_RUNTIME_APP_WIDTH_MOBILE_MIN,
                        Math.round(decision.appliedWidth * DOCKER_RUNTIME_APP_WIDTH_MOBILE_SCALE)
                    )
                    : decision.appliedWidth
            )
            : null;
        const applyWidth = (element) => {
            if (!element || !element.style) {
                return;
            }
            if (!effectiveWidth) {
                element.style.removeProperty('width');
                element.style.removeProperty('min-width');
                element.style.removeProperty('max-width');
                return;
            }
            element.style.setProperty('width', `${effectiveWidth}px`);
            element.style.setProperty('min-width', `${effectiveWidth}px`);
            element.style.setProperty('max-width', `${effectiveWidth}px`);
        };
        applyWidth(header);
        const cells = document.querySelectorAll(`tbody#docker_list > tr > td:nth-child(${index}), tbody#docker_view > tr > td:nth-child(${index})`);
        cells.forEach((cell) => applyWidth(cell));
    });
    applyDockerRuntimeAppWidthVariables(decision.appliedWidth || null);
    const gapMetricsAfter = readDockerRuntimeGapMetrics();
    dockerRuntimeWidthState.lastDecision = {
        ...decision,
        gapMetricsAfter,
        reason: dockerRuntimeWidthState.lastReason,
        phase: dockerRuntimeWidthState.phase
    };
    renderDockerRuntimeWidthDebugPanel(dockerRuntimeWidthState.lastDecision);
    return decision.appliedWidth;
};

const runDockerRuntimeWidthReflow = (reason = 'direct') => {
    if (dockerRuntimeWidthState.debounceTimer !== null) {
        clearTimeout(dockerRuntimeWidthState.debounceTimer);
        dockerRuntimeWidthState.debounceTimer = null;
    }
    dockerRuntimeWidthState.pendingReason = '';
    dockerRuntimeWidthState.lastReason = String(reason || 'direct');
    dockerRuntimeWidthState.phase = DOCKER_RUNTIME_WIDTH_PHASES.measure;
    const appliedWidth = applyDockerRuntimeColumnWidths(null);
    dockerRuntimeWidthState.phase = DOCKER_RUNTIME_WIDTH_PHASES.apply;
    dockerRuntimeWidthState.phase = DOCKER_RUNTIME_WIDTH_PHASES.idle;
    return appliedWidth;
};

const scheduleDockerRuntimeWidthReflow = (reason = 'event', delayMs = DOCKER_RUNTIME_WIDTH_REFLOW_DEBOUNCE_MS) => {
    dockerRuntimeWidthState.pendingReason = String(reason || 'event');
    dockerRuntimeWidthState.phase = DOCKER_RUNTIME_WIDTH_PHASES.debounce;
    if (dockerRuntimeWidthState.debounceTimer !== null) {
        clearTimeout(dockerRuntimeWidthState.debounceTimer);
    }
    const safeDelay = Number.isFinite(Number(delayMs)) ? Math.max(0, Number(delayMs)) : DOCKER_RUNTIME_WIDTH_REFLOW_DEBOUNCE_MS;
    dockerRuntimeWidthState.debounceTimer = window.setTimeout(() => {
        dockerRuntimeWidthState.debounceTimer = null;
        const pendingReason = dockerRuntimeWidthState.pendingReason || reason;
        dockerRuntimeWidthState.pendingReason = '';
        runDockerRuntimeWidthReflow(`debounced:${pendingReason}`);
    }, safeDelay);
};

const bindDockerRuntimeFontReadyReflow = () => {
    if (dockerRuntimeWidthState.fontReadyBound) {
        return;
    }
    dockerRuntimeWidthState.fontReadyBound = true;
    if (!document.fonts) {
        return;
    }
    const onFontReady = () => scheduleDockerRuntimeWidthReflow('font-ready', 20);
    if (document.fonts.ready && typeof document.fonts.ready.then === 'function') {
        document.fonts.ready.then(onFontReady).catch(() => {});
    }
    if (typeof document.fonts.addEventListener === 'function') {
        document.fonts.addEventListener('loadingdone', onFontReady);
    }
};

const dockerRuntimeThemeReflowController = runtimeStateObserverModule && typeof runtimeStateObserverModule.createThemeReflowController === 'function'
    ? runtimeStateObserverModule.createThemeReflowController({
        window,
        document,
        viewportReason: 'viewport-change',
        viewportDelayMs: DOCKER_RUNTIME_WIDTH_REFLOW_DEBOUNCE_MS,
        themeReasonPrefix: 'theme',
        themeDelayMs: 40,
        scheduleReflow: (reason, delayMs) => scheduleDockerRuntimeWidthReflow(reason, delayMs),
        onQueueReason: (reason) => {
            applyDockerThemeResolverTokens(`docker-runtime:${reason}`, {
                root: document.body,
                modeInput: 'auto'
            });
        }
    })
    : null;

const applyDockerRuntimeResolvedThemeTokens = (reason = 'docker-runtime:initial') => applyDockerThemeResolverTokens(reason, {
    root: document.body,
    modeInput: 'auto'
});

const bindDockerRuntimeViewportWidthSync = () => {
    dockerRuntimeThemeReflowController?.bindViewportWidthSync();
};

const bindDockerRuntimeThemeReflow = () => {
    applyDockerRuntimeResolvedThemeTokens('docker-runtime:bind');
    dockerRuntimeThemeReflowController?.bindThemeReflow();
};

const scheduleDockerRuntimeResizerRetry = () => {
    if (dockerRuntimeResizerRetryTimer !== null) {
        return;
    }
    dockerRuntimeResizerRetryTimer = window.setTimeout(() => {
        dockerRuntimeResizerRetryTimer = null;
        bindDockerRuntimeColumnResizers();
    }, 180);
};

const ensureDockerRuntimeResizerObserver = () => {
    if (dockerRuntimeResizerObserver || typeof MutationObserver !== 'function') {
        return;
    }
    const target = document.querySelector('#docker_list')
        || document.querySelector('tbody#docker_view')
        || document.body;
    if (!target) {
        return;
    }
    dockerRuntimeResizerObserver = new MutationObserver(() => {
        queueDockerRuntimeResizerBind();
    });
    dockerRuntimeResizerObserver.observe(target, {
        childList: true,
        subtree: true
    });
};

const queueDockerRuntimeResizerBind = () => {
    if (dockerRuntimeResizerBindTimer !== null) {
        return;
    }
    dockerRuntimeResizerBindTimer = window.setTimeout(() => {
        dockerRuntimeResizerBindTimer = null;
        bindDockerRuntimeColumnResizers();
    }, 0);
};

const bindDockerRuntimeColumnResizers = () => {
    const targets = getDockerRuntimeTableTargets();
    if (!targets) {
        if (dockerRuntimeResizerRetryCount < 20) {
            dockerRuntimeResizerRetryCount += 1;
            scheduleDockerRuntimeResizerRetry();
        }
        return;
    }
    dockerRuntimeResizerRetryCount = 0;
    ensureDockerRuntimeResizerObserver();
    bindDockerRuntimeViewportWidthSync();
    bindDockerRuntimeFontReadyReflow();
    bindDockerRuntimeThemeReflow();
    ensureDockerRuntimeWidthDebugPanel();
    targets.headers.forEach((header, idx) => {
        const columnIndex = idx + 1;
        header.classList.remove('fvplus-runtime-resizable');
        header.classList.toggle('fvplus-runtime-app-col', columnIndex === 1);
        const existingHandle = header.querySelector('.fvplus-runtime-col-resizer');
        if (existingHandle) {
            existingHandle.remove();
        }
    });
    scheduleDockerRuntimeWidthReflow('table-bind', 0);
};

const bindDockerRuntimeAppColumnResizer = () => bindDockerRuntimeColumnResizers();

const resolveDockerTooltipRuntimeEntry = (entry) => {
    const name = String(entry?.info?.Name || entry?.name || '').trim();
    if (!name) {
        return entry;
    }
    const latest = getDockerRuntimeContainerInfo(name);
    return latest && typeof latest === 'object' ? buildDockerRuntimeInfoRenderEntry(name, latest, entry) : entry;
};

const buildDockerTooltipContent = (ct) => {
    const runtimeEntry = resolveDockerTooltipRuntimeEntry(ct);
    const labels = runtimeEntry?.Labels && typeof runtimeEntry.Labels === 'object' ? runtimeEntry.Labels : {};
    const tooltipWebUiUrl = getSafeWebuiUrl(runtimeEntry?.info?.State?.WebUi);
    const tooltipTsWebUiUrl = getSafeWebuiUrl(runtimeEntry?.info?.State?.TSWebUi);
    const tooltipShowAdvanced = $.cookie('docker_listview_mode') == 'advanced';
    const tooltipForceUpdateHtml = tooltipShowAdvanced
        ? `<br><a class="exec" onclick="hideAllTips(); updateContainer('${runtimeEntry.info.Name}');"><span style="white-space:nowrap;"><i class="fa fa-cloud-download fa-fw"></i>${$.i18n('force-update')}</span></a>`
        : '';
    const $content = $(`
    <div class="preview-outbox preview-outbox-${ct.shortId}">
        <div class="first-row">
            <div class="preview-name">
                <div class="preview-img"><img src="${labels['net.unraid.docker.icon'] || ''}" class="img folder-img" onerror='this.src="/plugins/dynamix.docker.manager/images/question.png"'></div>
                <div class="preview-actual-name">
                    <span class="blue-text appname">${runtimeEntry.info.Name}</span><br>
                    <i class="fa fa-${runtimeEntry.info.State.Running ? (runtimeEntry.info.State.Paused ? 'pause' : 'play') : 'square'} ${runtimeEntry.info.State.Running ? (runtimeEntry.info.State.Paused ? 'paused' : 'started') : 'stopped'} ${runtimeEntry.info.State.Running ? (runtimeEntry.info.State.Paused ? 'orange-text' : 'green-text') : 'red-text'}"></i>
                    <span class="state"> ${runtimeEntry.info.State.Running ? (runtimeEntry.info.State.Paused ? $.i18n('paused') : $.i18n('started')) : $.i18n('stopped')}</span>
                </div>
            </div>
            <table class="preview-status">
                <thead class="status-header"><tr><th class="status-header-version">${$.i18n('version')}</th><th class="status-header-stats">CPU/MEM</th><th class="status-header-autostart">${$.i18n('autostart')}</th></tr></thead>
                <tbody><tr>
                    <td><div class="status-version">${runtimeEntry.info.State.manager === 'composeman' ? `<span class="folder-update-text"><i class="fa fa-docker fa-fw"></i> ${$.i18n('compose')}</span>` : runtimeEntry.info.State.manager !== 'dockerman' ? `<span class="folder-update-text"><i class="fa fa-docker fa-fw"></i> ${$.i18n('third-party')}</span>` : runtimeEntry.info.State.Updated !== false ? `<span class="green-text folder-update-text"><i class="fa fa-check fa-fw"></i>${$.i18n('up-to-date')}</span>${tooltipForceUpdateHtml}` : `<span class="orange-text folder-update-text" style="white-space:nowrap;"><i class="fa fa-flash fa-fw"></i>${$.i18n('update-ready')}</span><br><a class="exec" onclick="hideAllTips(); updateContainer('${runtimeEntry.info.Name}');"><span style="white-space:nowrap;"><i class="fa fa-cloud-download fa-fw"></i>${$.i18n('apply-update')}</span></a>`}<br><i class="fa fa-info-circle fa-fw"></i> ${runtimeEntry.info.Config.Image.split(':').pop()}</div></td>
                    <td><div class="status-stats"><span class="cpu-${ct.shortId}">0%</span><div class="usage-disk mm"><span id="cpu-${ct.shortId}" style="width: 0%;"></span><span></span></div><br><span class="mem-${ct.shortId}">0 / 0</span></div></td>
                    <td><div class="status-autostart"><input type="checkbox" style="display:none" class="staus-autostart-checkbox"></div></td>
                </tr></tbody>
            </table>
        </div>
        <div class="second-row">
            <div class="action-info">
                <div class="action">
                    <div class="action-left">
                        <ul class="fa-ul">
                            ${(runtimeEntry.info.State.Running && !runtimeEntry.info.State.Paused) ? 
                                `${tooltipWebUiUrl ? `<li><a class="fv-runtime-webui-link" href="${tooltipWebUiUrl}" target="_blank" rel="noopener noreferrer"><i class="fa fa-globe" aria-hidden="true"></i> ${$.i18n('webui')}</a></li>` : ''}
                                 ${tooltipTsWebUiUrl ? `<li><a class="fv-runtime-webui-link" href="${tooltipTsWebUiUrl}" target="_blank" rel="noopener noreferrer"><i class="fa fa-shield" aria-hidden="true"></i> ${$.i18n('tailscale-webui')}</a></li>` : ''}
                                 <li><a onclick="event.preventDefault(); openTerminal('docker', '${runtimeEntry.info.Name}', '${runtimeEntry.info.Shell}');"><i class="fa fa-terminal" aria-hidden="true"></i> ${$.i18n('console')}</a></li>`
                            : ''}
                            ${!runtimeEntry.info.State.Running ? `<li><a onclick="event.preventDefault(); eventControl({action:'start', container:'${ct.shortId}'}, 'loadlist');"><i class="fa fa-play" aria-hidden="true"></i> ${$.i18n('start')}</a></li>` : 
                                `${runtimeEntry.info.State.Paused ? `<li><a onclick="event.preventDefault(); eventControl({action:'resume', container:'${ct.shortId}'}, 'loadlist');"><i class="fa fa-play" aria-hidden="true"></i> ${$.i18n('resume')}</a></li>` : 
                                    `<li><a onclick="event.preventDefault(); eventControl({action:'stop', container:'${ct.shortId}'}, 'loadlist');"><i class="fa fa-stop" aria-hidden="true"></i> ${$.i18n('stop')}</a></li>
                                     <li><a onclick="event.preventDefault(); eventControl({action:'pause', container:'${ct.shortId}'}, 'loadlist');"><i class="fa fa-pause" aria-hidden="true"></i> ${$.i18n('pause')}</a></li>`}
                            <li><a onclick="event.preventDefault(); eventControl({action:'restart', container:'${ct.shortId}'}, 'loadlist');"><i class="fa fa-refresh" aria-hidden="true"></i> ${$.i18n('restart')}</a></li>`}
                            <li><a onclick="event.preventDefault(); openTerminal('docker', '${runtimeEntry.info.Name}', '.log');"><i class="fa fa-navicon" aria-hidden="true"></i> ${$.i18n('logs')}</a></li>
                            ${runtimeEntry.info.template ? `<li><a onclick="event.preventDefault(); editContainer('${runtimeEntry.info.Name}', '${runtimeEntry.info.template.path}');"><i class="fa fa-wrench" aria-hidden="true"></i> ${$.i18n('edit')}</a></li>` : ''}
                            <li><a onclick="event.preventDefault(); rmContainer('${runtimeEntry.info.Name}', '${runtimeEntry.shortImageId}', '${runtimeEntry.shortId}');"><i class="fa fa-trash" aria-hidden="true"></i> ${$.i18n('remove')}</a></li>
                        </ul>
                    </div>
                    <div class="action-right">
                        <ul class="fa-ul">
                            ${runtimeEntry.info.ReadMe ? `<li><a href="${runtimeEntry.info.ReadMe}" target="_blank" rel="noopener noreferrer"><i class="fa fa-book" aria-hidden="true"></i> ${$.i18n('read-me-first')}</a></li>` : ''}
                            ${runtimeEntry.info.Project ? `<li><a href="${runtimeEntry.info.Project}" target="_blank" rel="noopener noreferrer"><i class="fa fa-life-ring" aria-hidden="true"></i> ${$.i18n('project-page')}</a></li>` : ''}
                            ${runtimeEntry.info.Support ? `<li><a href="${runtimeEntry.info.Support}" target="_blank" rel="noopener noreferrer"><i class="fa fa-question" aria-hidden="true"></i> ${$.i18n('support')}</a></li>` : ''}
                            ${runtimeEntry.info.registry ? `<li><a href="${runtimeEntry.info.registry}" target="_blank" rel="noopener noreferrer"><i class="fa fa-info-circle" aria-hidden="true"></i> ${$.i18n('more-info')}</a></li>` : ''}
                            ${runtimeEntry.info.DonateLink ? `<li><a href="${runtimeEntry.info.DonateLink}" target="_blank" rel="noopener noreferrer"><i class="fa fa-usd" aria-hidden="true"></i> ${$.i18n('donate')}</a></li>` : ''}
                        </ul>
                    </div>
                </div>
                <div class="info-ct">
                    <span class="container-id">${$.i18n('container-id')}: ${runtimeEntry.shortId}</span><br>
                    <span class="repo">${$.i18n('by')}: <a target="_blank" rel="noopener noreferrer" ${runtimeEntry.info.registry ? `href="${runtimeEntry.info.registry}"` : ''} >${runtimeEntry.info.Config.Image.split(':').shift()}</a></span>
                </div>
            </div>
            <div class="info-section">
                <ul class="info-tabs">
                    <li><a class="tabs-graph localURL" href="#comb-grapth-${ct.shortId}">${$.i18n('graph')}</a></li>
                    <li><a class="tabs-cpu-graph localURL" href="#cpu-grapth-${ct.shortId}">${$.i18n('cpu-graph')}</a></li>
                    <li><a class="tabs-mem-graph localURL" href="#mem-grapth-${ct.shortId}">${$.i18n('mem-graph')}</a></li>
                    <li><a class="tabs-ports localURL" href="#info-ports-${ct.shortId}">${$.i18n('port-mappings')}</a></li>
                    <li><a class="tabs-volumes localURL" href="#info-volumes-${ct.shortId}">${$.i18n('volume-mappings')}</a></li>
                </ul>
                <div class="comb-grapth-${ct.shortId} comb-stat-grapth" id="comb-grapth-${ct.shortId}" style="display: none;"><canvas></canvas></div>
                <div class="cpu-grapth-${ct.shortId} cpu-stat-grapth" id="cpu-grapth-${ct.shortId}" style="display: none;"><canvas></canvas></div>
                <div class="mem-grapth-${ct.shortId} mem-stat-grapth" id="mem-grapth-${ct.shortId}" style="display: none;"><canvas></canvas></div>
                <div class="info-ports" id="info-ports-${ct.shortId}" style="display: none;">${runtimeEntry.info.Ports?.length > 10 ? (`<span class="info-ports-more" style="display: none;">${runtimeEntry.info.Ports?.map(e=>`${e.PrivateIP ? e.PrivateIP + ':' : ''}${e.PrivatePort}/${e.Type.toUpperCase()} <i class="fa fa-arrows-h"></i> ${e.PublicIP ? e.PublicIP + ':' : ''}${e.PublicPort}`).join('<br>') || ''}<br><a onclick="event.preventDefault(); $(this).parent().css('display', 'none').siblings('.info-ports-less').css('display', 'inline')">${$.i18n('compress')}</a></span><span class="info-ports-less">${runtimeEntry.info.Ports?.slice(0,10).map(e=>`${e.PrivateIP ? e.PrivateIP + ':' : ''}${e.PrivatePort}/${e.Type.toUpperCase()} <i class="fa fa-arrows-h"></i> ${e.PublicIP ? e.PublicIP + ':' : ''}${e.PublicPort}`).join('<br>') || ''}<br><a onclick="event.preventDefault(); $(this).parent().css('display', 'none').siblings('.info-ports-more').css('display', 'inline')">${$.i18n('expand')}</a></span>`) : (`<span class="info-ports-mono">${runtimeEntry.info.Ports?.map(e=>`${e.PrivateIP ? e.PrivateIP + ':' : ''}${e.PrivatePort}/${e.Type.toUpperCase()} <i class="fa fa-arrows-h"></i> ${e.PublicIP ? e.PublicIP + ':' : ''}${e.PublicPort}`).join('<br>') || ''}</span>`)}</div>
                <div class="info-volumes" id="info-volumes-${ct.shortId}" style="display: none;">${runtimeEntry.Mounts?.filter(e => e.Type==='bind').length > 10 ? (`<span class="info-volumes-more" style="display: none;">${runtimeEntry.Mounts?.filter(e => e.Type==='bind').map(e=>`${e.Destination} <i class="fa fa-arrows-h"></i> ${e.Source}`).join('<br>') || ''}<br><a onclick="event.preventDefault(); $(this).parent().css('display', 'none').siblings('.info-volumes-less').css('display', 'inline')">${$.i18n('compress')}</a></span><span class="info-volumes-less">${runtimeEntry.Mounts?.filter(e => e.Type==='bind').slice(0,10).map(e=>`${e.Destination} <i class="fa fa-arrows-h"></i> ${e.Source}`).join('<br>') || ''}<br><a onclick="event.preventDefault(); $(this).parent().css('display', 'none').siblings('.info-volumes-more').css('display', 'inline')">${$.i18n('expand')}</a></span>`) : (`<span class="info-volumes-mono">${runtimeEntry.Mounts?.filter(e => e.Type==='bind').map(e=>`${e.Destination} <i class="fa fa-arrows-h"></i> ${e.Source}`).join('<br>') || ''}</span>`)}</div>
            </div>
            </div>
        </div>
    `);
    $content.find('a.fv-runtime-webui-link').on('click', (event) => {
        event.preventDefault();
        openWebuiInNewTab(event.currentTarget?.href || '');
    });
    return $content;
};

const initializeDockerTooltipOnDemand = ($target, init, hoverOpen = true) => {
    if (DOCKER_PREVIEW_POPUP_ENABLED !== true) {
        return;
    }
    if (!$target || !$target.length || typeof init !== 'function') {
        return;
    }
    if ($target.data('fvTooltipsterDeferred') === true) {
        return;
    }
    $target.data('fvTooltipsterDeferred', true);
    const ensureInitialized = (eventType = '') => {
        if ($target.data('fvTooltipsterInitialized') === true) {
            return;
        }
        $target.data('fvTooltipsterInitialized', true);
        init();
        if (eventType !== 'mouseenter' || hoverOpen) {
            setTimeout(() => {
                try {
                    $target.tooltipster('open');
                } catch (_error) {
                    // Ignore eager-open failures and let the next interaction open naturally.
                }
            }, 0);
        }
    };
    $target.data('fvTooltipEnsureInitialized', ensureInitialized);
    $target.one('mouseenter.fvLazyTooltip click.fvLazyTooltip touchstart.fvLazyTooltip', (event) => {
        ensureInitialized(event?.type || '');
    });
};
// Advanced preview popups are opt-in per folder; keep the runtime lazy so
// default preview rendering stays lightweight until the user interacts.
const DOCKER_PREVIEW_POPUP_ENABLED = true;

const getPrefsOrderedFolderMap = (folders, prefs) => {
    const source = folders && typeof folders === 'object' ? folders : {};
    if (typeof utils.orderFoldersByPrefs === 'function') {
        return utils.orderFoldersByPrefs(source, prefs || {});
    }
    return source;
};

const normalizeFolderParentId = (value) => String(value || '').trim();

const buildFolderDepthById = (folders) => {
    const source = folders && typeof folders === 'object' ? folders : {};
    const ids = Object.keys(source);
    if (!ids.length) {
        return {};
    }
    const validIds = new Set(ids);
    const depthById = {};
    const resolveDepth = (id, chain = new Set()) => {
        if (!validIds.has(id)) {
            return 0;
        }
        if (Object.prototype.hasOwnProperty.call(depthById, id)) {
            return depthById[id];
        }
        if (chain.has(id)) {
            depthById[id] = 0;
            return 0;
        }
        chain.add(id);
        const parentId = normalizeFolderParentId(source[id]?.parentId || source[id]?.parent_id || '');
        let depth = 0;
        if (parentId && parentId !== id && validIds.has(parentId)) {
            depth = Math.min(8, resolveDepth(parentId, chain) + 1);
        }
        chain.delete(id);
        depthById[id] = depth;
        return depth;
    };
    for (const id of ids) {
        resolveDepth(id, new Set());
    }
    return depthById;
};

const reorderFolderSlotsInBaseOrder = (baseOrder, folders, prefs) => {
    const order = Array.isArray(baseOrder)
        ? baseOrder.map((item) => String(item || ''))
        : Object.values(baseOrder || {}).map((item) => String(item || ''));
    const folderMap = folders && typeof folders === 'object' ? folders : {};
    const sortMode = ['manual', 'alpha', 'name_desc', 'created_newest', 'created_oldest', 'updated_newest'].includes(String(prefs?.sortMode || '').trim().toLowerCase())
        ? String(prefs.sortMode).trim().toLowerCase()
        : 'created';
    const hasPinnedFolders = Array.isArray(prefs?.pinnedFolderIds) && prefs.pinnedFolderIds.length > 0;
    const desiredFolderTokens = Object.keys(getPrefsOrderedFolderMap(folderMap, prefs))
        .map((id) => `folder-${id}`);
    if (!desiredFolderTokens.length) {
        return order;
    }
    if (sortMode !== 'created' || hasPinnedFolders) {
        let desiredIndex = 0;
        return order.map((entry) => {
            if (!folderRegex.test(entry)) {
                return entry;
            }
            while (desiredIndex < desiredFolderTokens.length) {
                const candidate = desiredFolderTokens[desiredIndex++];
                const candidateId = candidate.replace(folderRegex, '');
                if (Object.prototype.hasOwnProperty.call(folderMap, candidateId)) {
                    return candidate;
                }
            }
            return entry;
        });
    }
    const liveFolderTokens = new Set();
    order.forEach((entry) => {
        if (!folderRegex.test(entry)) {
            return;
        }
        const folderId = entry.replace(folderRegex, '');
        if (Object.prototype.hasOwnProperty.call(folderMap, folderId)) {
            liveFolderTokens.add(entry);
        }
    });
    const missingDesiredTokens = desiredFolderTokens.filter((token) => !liveFolderTokens.has(token));
    const usedFolderTokens = new Set();
    let missingIndex = 0;
    return order.map((entry) => {
        if (!folderRegex.test(entry)) {
            return entry;
        }
        const folderId = entry.replace(folderRegex, '');
        if (Object.prototype.hasOwnProperty.call(folderMap, folderId) && !usedFolderTokens.has(entry)) {
            usedFolderTokens.add(entry);
            return entry;
        }
        while (missingIndex < missingDesiredTokens.length) {
            const candidate = missingDesiredTokens[missingIndex++];
            if (!usedFolderTokens.has(candidate)) {
                usedFolderTokens.add(candidate);
                return candidate;
            }
        }
        return entry;
    });
};

const buildFolderHierarchy = (folders) => {
    const hierarchyApi = getDockerRuntimeHierarchyApi();
    return hierarchyApi && typeof hierarchyApi.buildFolderHierarchy === 'function'
        ? hierarchyApi.buildFolderHierarchy(folders)
        : { ids: [], parentById: {}, childrenById: {} };
};

const getFolderChildren = (folderId) => {
    const hierarchyApi = getDockerRuntimeHierarchyApi();
    return hierarchyApi && typeof hierarchyApi.getFolderChildren === 'function'
        ? hierarchyApi.getFolderChildren(folderId)
        : [];
};

const getFolderDescendants = (folderId) => {
    const hierarchyApi = getDockerRuntimeHierarchyApi();
    return hierarchyApi && typeof hierarchyApi.getFolderDescendants === 'function'
        ? hierarchyApi.getFolderDescendants(folderId)
        : [];
};

const getFolderAncestors = (folderId) => {
    const hierarchyApi = getDockerRuntimeHierarchyApi();
    return hierarchyApi && typeof hierarchyApi.getFolderAncestors === 'function'
        ? hierarchyApi.getFolderAncestors(folderId)
        : [];
};

const folderHasChildren = (folderId) => {
    const hierarchyApi = getDockerRuntimeHierarchyApi();
    return hierarchyApi && typeof hierarchyApi.folderHasChildren === 'function'
        ? hierarchyApi.folderHasChildren(folderId)
        : false;
};

const DOCKER_LOCKED_STATE_KEY = 'fvplus.runtime.locked.docker.v1';
let dockerFocusedFolderId = String(dockerRuntimeStateStore.get('focusedFolderId', '') || '').trim();
const normalizeLockedFolderIdList = (value) => {
    if (!Array.isArray(value)) {
        return [];
    }
    return Array.from(new Set(value.map((entry) => String(entry || '').trim()).filter((entry) => entry !== '')));
};
const readDockerLockedFolderIds = () => {
    try {
        const raw = window.localStorage && window.localStorage.getItem(DOCKER_LOCKED_STATE_KEY);
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw);
        return normalizeLockedFolderIdList(parsed);
    } catch (_error) {
        return [];
    }
};
const writeDockerLockedFolderIds = (ids) => {
    try {
        if (window.localStorage) {
            const payload = JSON.stringify(normalizeLockedFolderIdList(ids));
            if (dockerStorageWriter && typeof dockerStorageWriter.setItem === 'function') {
                dockerStorageWriter.setItem(DOCKER_LOCKED_STATE_KEY, payload, { delayMs: 70, idle: true });
            } else {
                window.localStorage.setItem(DOCKER_LOCKED_STATE_KEY, payload);
            }
        }
    } catch (_error) {
        // Best effort only.
    }
};
let dockerLockedFolderIdSet = new Set(readDockerLockedFolderIds());
dockerRuntimeStateStore.set({ lockedFolderIds: Array.from(dockerLockedFolderIdSet) });
dockerRuntimeStateStore.subscribe((nextState, _prevState, patch) => {
    if (patch && Object.prototype.hasOwnProperty.call(patch, 'focusedFolderId')) {
        dockerFocusedFolderId = String(nextState.focusedFolderId || '').trim();
    }
});
const isDockerFolderLocked = (folderId) => dockerLockedFolderIdSet.has(String(folderId || '').trim());
const isDockerFolderPinned = (folderId) => {
    const id = String(folderId || '').trim();
    const pinned = Array.isArray(folderTypePrefs?.pinnedFolderIds) ? folderTypePrefs.pinnedFolderIds : [];
    return pinned.includes(id);
};
const readFolderIdFromRow = (row) => {
    if (!row || !row.className) {
        return '';
    }
    const match = String(row.className).match(/\bfolder-id-([A-Za-z0-9_-]+)\b/);
    return match && match[1] ? String(match[1] || '').trim() : '';
};
const readFolderOwnerFromRow = (row) => {
    if (!row || !row.className) {
        return '';
    }
    const entries = String(row.className).split(/\s+/);
    for (const className of entries) {
        const match = className.match(/^folder-(.+)-element$/);
        if (match && match[1]) {
            return String(match[1] || '').trim();
        }
    }
    return '';
};
const getFocusedFolderVisibleSet = (folderId) => {
    const id = String(folderId || '').trim();
    if (!id || !globalFolders[id]) {
        return new Set();
    }
    return new Set([id, ...getFolderDescendants(id), ...getFolderAncestors(id)]);
};
const applyDockerFolderQuickActionState = (folderId) => {
    const id = String(folderId || '').trim();
    if (!id) {
        return;
    }
    const $row = $(`tr.folder-id-${id}`);
    if (!$row.length) {
        return;
    }
    const pinned = isDockerFolderPinned(id);
    const locked = isDockerFolderLocked(id);
    const focused = dockerFocusedFolderId === id;
    $row.toggleClass('fv-folder-pinned', pinned);
    $row.toggleClass('fv-folder-locked', locked);
    $row.toggleClass('fv-folder-focused', focused);
};
const refreshDockerFolderQuickActionStates = () => {
    for (const id of Object.keys(globalFolders || {})) {
        applyDockerFolderQuickActionState(id);
    }
};
const refreshDockerRuntimeSortableRows = () => {
    const $dockerList = $('#docker_list');
    if ($dockerList.length && typeof $dockerList.sortable === 'function') {
        const sortableInstance = $dockerList.data('ui-sortable') || $dockerList.data('sortable');
        if (sortableInstance) {
            $dockerList.sortable('refresh');
        }
    }
};
const reorderVisibleDockerRootFolderBlocks = () => {
    const tbody = document.querySelector('tbody#docker_list') || document.querySelector('tbody#docker_view');
    if (!(tbody instanceof HTMLElement)) {
        return false;
    }
    const folders = globalFolders && typeof globalFolders === 'object' ? globalFolders : {};
    const folderIds = Object.keys(folders);
    if (folderIds.length < 2) {
        return false;
    }
    const hierarchy = buildFolderHierarchy(folders);
    const parentById = hierarchy?.parentById || {};
    const childrenById = hierarchy?.childrenById || {};
    const collectDescendants = (rootId) => {
        const descendants = [];
        const queue = Array.isArray(childrenById[rootId]) ? [...childrenById[rootId]] : [];
        const seen = new Set();
        while (queue.length) {
            const current = queue.shift();
            if (!current || seen.has(current)) {
                continue;
            }
            seen.add(current);
            descendants.push(current);
            const children = Array.isArray(childrenById[current]) ? childrenById[current] : [];
            queue.push(...children);
        }
        return descendants;
    };
    const desiredRootIds = Object.keys(getPrefsOrderedFolderMap(folders, folderTypePrefs))
        .filter((id) => !String(parentById[id] || '').trim());
    if (desiredRootIds.length < 2) {
        return false;
    }
    const rows = Array.from(tbody.children).filter((row) => row instanceof HTMLElement && row.tagName === 'TR');
    if (!rows.length) {
        return false;
    }
    const segments = [];
    for (let index = 0; index < rows.length;) {
        const row = rows[index];
        const folderId = readFolderIdFromRow(row);
        const parentId = folderId ? String(parentById[folderId] || '').trim() : '';
        if (folderId && !parentId) {
            const branchSet = new Set([folderId, ...collectDescendants(folderId)]);
            const blockRows = [row];
            index++;
            while (index < rows.length) {
                const nextRow = rows[index];
                const nextFolderId = readFolderIdFromRow(nextRow);
                if (nextFolderId) {
                    const nextParentId = String(parentById[nextFolderId] || '').trim();
                    if (!nextParentId || !branchSet.has(nextFolderId)) {
                        break;
                    }
                    blockRows.push(nextRow);
                    index++;
                    continue;
                }
                const ownerId = readFolderOwnerFromRow(nextRow);
                if (!ownerId || !branchSet.has(ownerId)) {
                    break;
                }
                blockRows.push(nextRow);
                index++;
            }
            segments.push({
                kind: 'root-folder-block',
                rootId: folderId,
                rows: blockRows
            });
            continue;
        }
        segments.push({
            kind: 'passthrough',
            rows: [row]
        });
        index++;
    }
    const currentRootIds = segments
        .filter((segment) => segment.kind === 'root-folder-block')
        .map((segment) => segment.rootId);
    if (currentRootIds.length < 2) {
        return false;
    }
    const rootBlocksById = new Map(
        segments
            .filter((segment) => segment.kind === 'root-folder-block')
            .map((segment) => [segment.rootId, segment])
    );
    const orderedRootBlocks = desiredRootIds
        .map((id) => rootBlocksById.get(id))
        .filter(Boolean);
    if (orderedRootBlocks.length !== currentRootIds.length) {
        return false;
    }
    const currentSignature = currentRootIds.join('|');
    const desiredSignature = orderedRootBlocks.map((segment) => segment.rootId).join('|');
    if (currentSignature === desiredSignature) {
        return false;
    }
    const fragment = document.createDocumentFragment();
    let orderedRootIndex = 0;
    segments.forEach((segment) => {
        const rowsToAppend = segment.kind === 'root-folder-block'
            ? (orderedRootBlocks[orderedRootIndex++] || segment).rows
            : segment.rows;
        rowsToAppend.forEach((rowNode) => fragment.appendChild(rowNode));
    });
    tbody.appendChild(fragment);
    refreshDockerRuntimeSortableRows();
    queueDockerRuntimeResizerBind();
    scheduleDockerRuntimeWidthReflow('pin-toggle', 24);
    return true;
};
const syncDockerPinnedFolderUi = () => {
    const reordered = reorderVisibleDockerRootFolderBlocks();
    refreshDockerFolderQuickActionStates();
    applyDockerFocusedFolderState();
    if (!reordered) {
        refreshDockerRuntimeSortableRows();
        queueDockerRuntimeResizerBind();
        scheduleDockerRuntimeWidthReflow('pin-toggle', 24);
    }
};
const applyDockerFocusedFolderState = () => {
    const focusId = String(dockerFocusedFolderId || '').trim();
    if (!focusId || !globalFolders[focusId]) {
        dockerRuntimeStateStore.set({ focusedFolderId: '' });
        dockerFocusedFolderId = '';
        $('body').removeClass('fv-folder-focus-active');
        $('#docker_list > tr').removeClass('fv-folder-focus-hidden');
        refreshDockerFolderQuickActionStates();
        return;
    }
    const visibleSet = getFocusedFolderVisibleSet(focusId);
    $('body').addClass('fv-folder-focus-active');
    $('#docker_list > tr').each((_, row) => {
        if (!row) {
            return;
        }
        const $row = $(row);
        const className = String(row.className || '');
        const folderMatch = className.match(/\bfolder-id-([A-Za-z0-9_-]+)\b/);
        if (folderMatch && folderMatch[1]) {
            $row.toggleClass('fv-folder-focus-hidden', !visibleSet.has(folderMatch[1]));
            return;
        }
        const ownerId = readFolderOwnerFromRow(row);
        if (ownerId) {
            $row.toggleClass('fv-folder-focus-hidden', !visibleSet.has(ownerId));
            return;
        }
        $row.toggleClass('fv-folder-focus-hidden', true);
    });
    refreshDockerFolderQuickActionStates();
};
const toggleDockerFolderFocus = (folderId) => {
    const id = String(folderId || '').trim();
    if (!id || !globalFolders[id]) {
        return;
    }
    const nextFocus = (dockerFocusedFolderId === id) ? '' : id;
    dockerRuntimeStateStore.set({ focusedFolderId: nextFocus });
    dockerFocusedFolderId = nextFocus;
    applyDockerFocusedFolderState();
    queueDockerRuntimeResizerBind();
    scheduleDockerRuntimeWidthReflow('focus-toggle', 24);
};
const toggleDockerFolderLock = (folderId) => {
    const id = String(folderId || '').trim();
    if (!id || !globalFolders[id]) {
        return;
    }
    if (isDockerFolderLocked(id)) {
        dockerLockedFolderIdSet.delete(id);
    } else {
        dockerLockedFolderIdSet.add(id);
    }
    writeDockerLockedFolderIds(Array.from(dockerLockedFolderIdSet));
    dockerRuntimeStateStore.set({ lockedFolderIds: Array.from(dockerLockedFolderIdSet) });
    refreshDockerFolderQuickActionStates();
};
const applyDockerPinnedFolderIds = (nextPinnedIds) => {
    folderTypePrefs = utils.normalizePrefs({
        ...(folderTypePrefs || {}),
        pinnedFolderIds: Array.isArray(nextPinnedIds) ? [...nextPinnedIds] : []
    });
    dockerRuntimeStateStore.set({ pinnedFolderIds: Array.isArray(nextPinnedIds) ? [...nextPinnedIds] : [] });
};
const persistDockerPinnedFolderIds = async (nextPinnedIds) => {
    const payload = {
        type: 'docker',
        prefs: JSON.stringify({ pinnedFolderIds: nextPinnedIds })
    };
    const request = window.FolderViewPlusRequest;
    if (request && typeof request.postJson === 'function') {
        try {
            return await request.postJson('/plugins/folderview.plus/server/prefs.php', payload, {
                retries: 1,
                retryDelayMs: 260
            });
        } catch (_error) {
            // Fall through to the legacy POST path so pinning still works if the
            // runtime request wrapper is late, degraded, or temporarily broken.
        }
    }
    const response = await $.post('/plugins/folderview.plus/server/prefs.php', payload).promise();
    return parseJsonPayloadSafe(response);
};
const toggleDockerFolderPin = async (folderId) => {
    const id = String(folderId || '').trim();
    if (!id || !globalFolders[id]) {
        return;
    }
    return dockerSafeUiActionRunner.run(`docker-pin:${id}`, async () => {
        const current = Array.isArray(folderTypePrefs?.pinnedFolderIds) ? [...folderTypePrefs.pinnedFolderIds] : [];
        const nextPinned = current.includes(id)
            ? current.filter((entry) => entry !== id)
            : [...current, id];
        applyDockerPinnedFolderIds(nextPinned);
        syncDockerPinnedFolderUi();
        const result = await runDockerGuardedAction('toggle-folder-pin', async () => {
            const response = await persistDockerPinnedFolderIds(nextPinned);
            applyDockerPinnedFolderIds(Array.isArray(response?.prefs?.pinnedFolderIds) ? response.prefs.pinnedFolderIds : nextPinned);
            syncDockerPinnedFolderUi();
        }, {
            userMessage: getDockerMenuLabel('folder-pin-failed', 'Failed to update pinned folders.'),
            userVisible: false
        });
        if (!result.ok) {
            applyDockerPinnedFolderIds(current);
            syncDockerPinnedFolderUi();
        }
    });
};
const ensureDockerFolderUnlocked = (id, actionLabel = 'This action') => {
    if (!isDockerFolderLocked(id)) {
        return true;
    }
    swal({
        title: 'Folder locked',
        text: `${escapeHtml(actionLabel)} is blocked while this folder is locked.<br>Click the lock icon on the folder row to unlock it.`,
        type: 'info',
        html: true,
        confirmButtonText: 'OK'
    });
    return false;
};

const getDockerRuntimeContainerInfo = (name) => {
    const key = String(name || '').trim();
    if (!key) {
        return null;
    }
    const cached = dockerRuntimeInfoByName[key];
    if (cached && typeof cached === 'object') {
        return cached;
    }
    if (Array.isArray(window.docker)) {
        const match = window.docker.find((entry) => String(entry?.info?.Name || '').trim() === key);
        if (match && typeof match === 'object') {
            dockerRuntimeInfoByName[key] = buildDockerRuntimeInfoRenderEntry(key, match, dockerRuntimeInfoByName[key] || null);
            return dockerRuntimeInfoByName[key];
        }
    }
    return null;
};

const getFolderRuntimeContainers = (folder) => {
    const runtimeInfoApi = getDockerRuntimeInfoApi();
    return runtimeInfoApi && typeof runtimeInfoApi.getFolderRuntimeContainers === 'function'
        ? runtimeInfoApi.getFolderRuntimeContainers(folder)
        : {};
};

const getScopedRuntimeContainersForFolder = (folderId, includeDescendants = true) => {
    const runtimeInfoApi = getDockerRuntimeInfoApi();
    return runtimeInfoApi && typeof runtimeInfoApi.getScopedRuntimeContainersForFolder === 'function'
        ? runtimeInfoApi.getScopedRuntimeContainersForFolder(folderId, includeDescendants)
        : {};
};

const summarizeFolderActionCounts = (containersMap) => {
    const actionsApi = getDockerRuntimeActionsApi();
    return actionsApi && typeof actionsApi.summarizeFolderActionCounts === 'function'
        ? actionsApi.summarizeFolderActionCounts(containersMap)
        : {
            total: 0,
            startable: 0,
            stoppable: 0,
            pausable: 0,
            resumable: 0,
            restartable: 0,
            managed: 0,
            updateReady: 0
        };
};

const expandFolderBranch = (folderId) => {
    const hierarchyApi = getDockerRuntimeHierarchyApi();
    if (hierarchyApi && typeof hierarchyApi.expandFolderBranch === 'function') {
        hierarchyApi.expandFolderBranch(folderId);
    }
};

const collapseFolderBranch = (folderId) => {
    const hierarchyApi = getDockerRuntimeHierarchyApi();
    if (hierarchyApi && typeof hierarchyApi.collapseFolderBranch === 'function') {
        hierarchyApi.collapseFolderBranch(folderId);
    }
};

const parseJsonPayloadSafe = (payload) => {
    if (payload && typeof payload === 'object') {
        return payload;
    }
    if (typeof payload === 'string') {
        const trimmed = payload.trim();
        if (!trimmed) {
            return {};
        }
        try {
            return JSON.parse(trimmed);
        } catch (_error) {
            return {};
        }
    }
    return {};
};

const normalizeDockerStateToken = (entry, fromStateMode = false) => {
    if (!entry || typeof entry !== 'object') {
        return 's:0::';
    }
    const normalizeUpdatedToken = (value) => (value === false ? 'u0' : (value === true ? 'u1' : 'ux'));
    if (fromStateMode) {
        const running = entry.running === true;
        const paused = entry.paused === true;
        const status = running ? (paused ? 'p' : 'r') : 's';
        const autostart = entry.autostart === true ? '1' : '0';
        const manager = String(entry.manager || '').trim();
        const updated = normalizeUpdatedToken(entry.Updated);
        const label = String(entry.folderLabel || '').trim();
        return `${status}:${autostart}:${manager}:${updated}:${label}`;
    }
    const info = entry.info && typeof entry.info === 'object' ? entry.info : {};
    const state = info.State && typeof info.State === 'object' ? info.State : {};
    const labels = entry.Labels && typeof entry.Labels === 'object' ? entry.Labels : {};
    const running = state.Running === true;
    const paused = state.Paused === true;
    const status = running ? (paused ? 'p' : 'r') : 's';
    const manager = String(state.manager || '').trim();
    const autostart = !(state.Autostart === false) ? '1' : '0';
    const updated = normalizeUpdatedToken(state.Updated);
    const label = getFolderLabelValue(labels);
    return `${status}:${autostart}:${manager}:${updated}:${label}`;
};

const buildDockerStateSignature = (source, fromStateMode = false) => {
    const map = source && typeof source === 'object' ? source : {};
    const names = Object.keys(map).sort((a, b) => a.localeCompare(b));
    if (!names.length) {
        return '';
    }
    const tokens = names.map((name) => `${name}:${normalizeDockerStateToken(map[name], fromStateMode)}`);
    return tokens.join('|');
};

const buildDockerFolderMatchCache = (orderSnapshot, containersInfo, folders, prefs) => {
    const folderMap = folders && typeof folders === 'object' ? folders : {};
    const infoByName = containersInfo && typeof containersInfo === 'object' ? containersInfo : {};
    const names = (Array.isArray(orderSnapshot) ? orderSnapshot : [])
        .filter((entry) => entry && !folderRegex.test(entry) && Object.prototype.hasOwnProperty.call(infoByName, entry));
    const labelBuckets = new Map();
    for (const name of names) {
        const labels = infoByName[name]?.Labels || {};
        const labelValue = getFolderLabelValue(labels);
        if (!labelValue) {
            continue;
        }
        if (!labelBuckets.has(labelValue)) {
            labelBuckets.set(labelValue, []);
        }
        labelBuckets.get(labelValue).push(name);
    }

    const rules = Array.isArray(prefs?.autoRules) ? prefs.autoRules : [];
    const cache = {};
    for (const [folderId, folder] of Object.entries(folderMap)) {
        const explicit = Array.isArray(folder?.containers)
            ? folder.containers.filter((name) => infoByName[name])
            : [];
        let regexMatches = [];
        const regexRaw = String(folder?.regex || '').trim();
        if (regexRaw) {
            try {
                const regex = new RegExp(regexRaw);
                regexMatches = names.filter((name) => regex.test(name));
            } catch (_error) {
                regexMatches = [];
            }
        }
        const labelMatches = [...(labelBuckets.get(String(folder?.name || '')) || [])];
        const ruleMatches = utils.getAutoRuleMatches({
            rules,
            folderId,
            names,
            infoByName,
            type: 'docker'
        });
        cache[folderId] = {
            explicit,
            regex: regexMatches,
            label: labelMatches,
            rules: ruleMatches
        };
    }
    return cache;
};

const removeRuntimeHealthBadge = () => {
    const existing = document.getElementById('fv-runtime-health-badge-docker');
    if (existing && existing.parentNode) {
        existing.parentNode.removeChild(existing);
    }
};

const renderRuntimeHealthBadge = (folders, prefs) => {
    const normalizedPrefs = utils.normalizePrefs(prefs || {});
    const healthPrefs = normalizedPrefs?.health && typeof normalizedPrefs.health === 'object'
        ? normalizedPrefs.health
        : {};
    if (healthPrefs.runtimeBadgeEnabled !== true) {
        removeRuntimeHealthBadge();
        return;
    }

    const folderMap = folders && typeof folders === 'object' ? folders : {};
    let startedFolders = 0;
    let pausedFolders = 0;
    let stoppedFolders = 0;
    for (const folder of Object.values(folderMap)) {
        const status = folder?.status || {};
        const started = Number(status.started || 0);
        const paused = Number(status.paused || 0);
        const stopped = Number(status.stopped || 0);
        if (started > 0) {
            startedFolders += 1;
        } else if (paused > 0) {
            pausedFolders += 1;
        } else if (stopped > 0) {
            stoppedFolders += 1;
        } else {
            stoppedFolders += 1;
        }
    }

    const table = document.querySelector('#docker_list')?.closest('table');
    const host = table?.parentElement || document.querySelector('#docker_list')?.parentElement;
    if (!host) {
        return;
    }
    let badge = document.getElementById('fv-runtime-health-badge-docker');
    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'fv-runtime-health-badge-docker';
        badge.className = 'fv-runtime-health-badge';
        host.insertBefore(badge, host.firstChild);
    }
    badge.classList.remove('is-warning', 'is-danger');
    if (stoppedFolders > 0) {
        badge.classList.add('is-danger');
    } else if (pausedFolders > 0) {
        badge.classList.add('is-warning');
    }
    badge.textContent = `Folder health: ${startedFolders} started | ${pausedFolders} paused | ${stoppedFolders} stopped`;
};

const dockerModules = window.FolderViewDockerModules || {};
const dockerDebug = typeof dockerRuntimeShared.createDebugLogger === 'function'
    ? dockerRuntimeShared.createDebugLogger(FOLDER_VIEW_DEBUG_MODE, 'folderview.plus docker')
    : (typeof dockerModules.createDebugLogger === 'function'
        ? dockerModules.createDebugLogger(FOLDER_VIEW_DEBUG_MODE)
    : {
        log: (...args) => { if (FOLDER_VIEW_DEBUG_MODE) console.log(...args); },
        warn: (...args) => { if (FOLDER_VIEW_DEBUG_MODE) console.warn(...args); },
        error: (...args) => { if (FOLDER_VIEW_DEBUG_MODE) console.error(...args); }
    });
const folderViewPerfFromQuery = (() => {
    try {
        if (!window.location || typeof window.location.search !== 'string' || typeof URLSearchParams !== 'function') {
            return false;
        }
        return new URLSearchParams(window.location.search).get('fvperf') === '1';
    } catch (error) {
        return false;
    }
})();
const folderViewPerfFromStorage = (() => {
    try {
        return window.localStorage && window.localStorage.getItem('fvplus_perf') === '1';
    } catch (error) {
        return false;
    }
})();
const DOCKER_EXPANDED_STATE_KEY = 'fvplus.runtime.expand.docker.v1';
const DOCKER_EXPANDED_STATE_SYNC_DELAY_MS = 220;
const normalizeExpandedStateMap = runtimeStateObserverModule && typeof runtimeStateObserverModule.createExpandedStateController === 'function'
    ? runtimeStateObserverModule.createExpandedStateController({}).normalizeExpandedStateMap
    : ((value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return {};
        }
        const next = {};
        for (const [rawId, expanded] of Object.entries(value)) {
            const id = String(rawId || '').trim();
            if (!id) {
                continue;
            }
            next[id] = expanded === true;
        }
        return next;
    });
const readDockerServerExpandedStateMap = () => normalizeExpandedStateMap(folderTypePrefs?.expandedFolderState || {});
const dockerExpandedStateController = runtimeStateObserverModule && typeof runtimeStateObserverModule.createExpandedStateController === 'function'
    ? runtimeStateObserverModule.createExpandedStateController({
        window,
        document,
        $,
        type: 'docker',
        storageKey: DOCKER_EXPANDED_STATE_KEY,
        storageWriter: dockerStorageWriter,
        syncDelayMs: DOCKER_EXPANDED_STATE_SYNC_DELAY_MS,
        normalizePrefs: (prefs) => utils.normalizePrefs(prefs || {}),
        readServerMap: () => folderTypePrefs?.expandedFolderState || {},
        writeServerMap: (map) => {
            folderTypePrefs = utils.normalizePrefs({
                ...(folderTypePrefs || {}),
                expandedFolderState: normalizeExpandedStateMap(map)
            });
        },
        readFolders: () => globalFolders || {}
    })
    : null;
const buildDockerExpandedStateMap = (folders, previousFolders = {}, serverMap = {}) => dockerExpandedStateController
    ? dockerExpandedStateController.buildStateMap(folders, previousFolders, serverMap)
    : {};
const persistDockerExpandedStateFromGlobal = (syncServer = true) => dockerExpandedStateController?.persistStateFromGlobal(syncServer);
const persistDockerExpandedStateFromDom = () => dockerExpandedStateController?.persistStateFromDom();
const ensureDockerExpandedStateLifecycleHooks = () => dockerExpandedStateController?.ensureLifecycleHooks();
const FOLDER_VIEW_PERF_MODE = folderViewPerfFromQuery || folderViewPerfFromStorage;
const FOLDER_VIEW_TOUCH_MODE = (() => {
    try {
        const hasMatchMedia = typeof window.matchMedia === 'function';
        const noHover = hasMatchMedia ? window.matchMedia('(hover: none)').matches : false;
        const coarsePointer = hasMatchMedia ? window.matchMedia('(pointer: coarse)').matches : false;
        const touchEventSupport = 'ontouchstart' in window;
        const maxTouchPoints = Number(navigator?.maxTouchPoints || 0);
        return noHover || coarsePointer || touchEventSupport || maxTouchPoints > 0;
    } catch (error) {
        return false;
    }
})();
const dockerPerf = typeof dockerModules.createPerfTracker === 'function'
    ? dockerModules.createPerfTracker('folderview-plus.docker', FOLDER_VIEW_PERF_MODE)
    : {
        enabled: false,
        stamp: () => {},
        begin: () => {},
        end: () => 0
    };
const dockerPerfTelemetry = createDockerRuntimePerfTelemetry('folderview-plus.docker.actions', FOLDER_VIEW_PERF_MODE);
const dockerActionBoundary = createDockerAsyncActionBoundary({
    prefix: 'folderview.plus docker',
    onError: (actionName, error, context = {}) => {
        console.error(`folderview.plus docker: ${actionName} failed`, error);
        if (context && context.userVisible === false) {
            return;
        }
        const safeMessage = escapeHtml(String(context?.userMessage || error?.message || 'Unexpected runtime error'));
        swal({
            title: $.i18n('exec-error'),
            text: safeMessage,
            type: 'error',
            html: true,
            confirmButtonText: 'Ok'
        });
    }
});
const runDockerGuardedAction = async (actionName, action, context = {}) => {
    dockerPerfTelemetry.begin(actionName);
    const result = await dockerActionBoundary.run(actionName, action, context);
    dockerPerfTelemetry.end(actionName, { ok: result.ok });
    return result;
};
const rowCenteringTools = typeof dockerModules.createRowCenteringTools === 'function'
    ? dockerModules.createRowCenteringTools()
    : {
        forceFolderRowVerticalCenter: () => {},
        queueForceAllFolderRowsVerticalCenter: () => {},
        startFolderRowCenterObserver: () => {}
    };
const forceFolderRowVerticalCenter = (id) => rowCenteringTools.forceFolderRowVerticalCenter(id);
const queueForceAllFolderRowsVerticalCenter = () => rowCenteringTools.queueForceAllFolderRowsVerticalCenter();
const startFolderRowCenterObserver = () => rowCenteringTools.startFolderRowCenterObserver();

dockerDebug.log('[FV3_DEBUG] docker.js loaded. FOLDER_VIEW_DEBUG_MODE is ON.');
if (FOLDER_VIEW_TOUCH_MODE) {
    document.body.classList.add('fv-touch-device');
}

const showDockerRuntimeLoadingRow = () => {
    if (shouldSuppressDockerRuntimeLoadingUi()) {
        return;
    }
    const tbody = $('tbody#docker_list');
    if (!tbody.length || tbody.find('tr.fv-runtime-loading-row').length) {
        return;
    }
    tbody.prepend('<tr class="fv-runtime-loading-row"><td colspan="18"><i class="fa fa-circle-o-notch fa-spin"></i> Loading Docker folders...</td></tr>');
};

const hideDockerRuntimeLoadingRow = () => {
    $('tbody#docker_list tr.fv-runtime-loading-row').remove();
};

const ensureDockerRuntimeLoadingOverlay = () => {
    let overlay = document.getElementById('fvplus-docker-runtime-loading-overlay');
    if (overlay) {
        return overlay;
    }
    const table = document.querySelector('table#docker_containers');
    if (!table || !table.parentNode) {
        return null;
    }
    overlay = document.createElement('div');
    overlay.id = 'fvplus-docker-runtime-loading-overlay';
    overlay.className = 'fvplus-docker-runtime-loading-overlay';
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = '<span class="fvplus-docker-runtime-loading-spinner"><i class="fa fa-circle-o-notch fa-spin" aria-hidden="true"></i></span><span class="fvplus-docker-runtime-loading-text">Loading Docker folders...</span>';
    table.parentNode.insertBefore(overlay, table);
    return overlay;
};

const showDockerRuntimeLoadingOverlay = () => {
    if (shouldSuppressDockerRuntimeLoadingUi()) {
        return;
    }
    const overlay = ensureDockerRuntimeLoadingOverlay();
    if (!overlay) {
        return;
    }
    overlay.classList.add('is-active');
};

const hideDockerRuntimeLoadingOverlay = () => {
    const overlay = document.getElementById('fvplus-docker-runtime-loading-overlay');
    if (!overlay) {
        return;
    }
    overlay.classList.remove('is-active');
};

const scheduleDockerPostRenderPolish = (folderIds = []) => {
    const safeFolderIds = Array.isArray(folderIds) ? folderIds.slice() : [];
    const run = () => {
        startFolderRowCenterObserver();
        safeFolderIds.forEach((folderId) => forceFolderRowVerticalCenter(folderId));
        queueForceAllFolderRowsVerticalCenter();
        bindDockerRuntimeAppColumnResizer();
        scheduleDockerRuntimeWidthReflow('render-complete', 12);
        setTimeout(() => {
            safeFolderIds.forEach((folderId) => forceFolderRowVerticalCenter(folderId));
            queueForceAllFolderRowsVerticalCenter();
        }, 48);
        setTimeout(() => scheduleDockerRuntimeWidthReflow('render-post-80ms', 18), 80);
        setTimeout(() => scheduleDockerRuntimeWidthReflow('render-post-260ms', 18), 260);
    };
    if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => run());
        return;
    }
    window.setTimeout(run, 0);
};

const syncDockerVisibleFoldersFromRuntimeCache = () => {
    Object.entries(globalFolders || {}).forEach(([id, folder]) => {
        if (!folder || typeof folder !== 'object') {
            return;
        }
        const runtimeContainers = folderHasChildren(id)
            ? buildRuntimeContainerMapForFolder(id, true)
            : getFolderRuntimeContainers(folder);
        folder.runtimeContainers = runtimeContainers;
        syncDockerFolderMemberRows(id, runtimeContainers);
        if (folderHasChildren(id)) {
            syncParentFolderVisualState(id, folder?.status?.expanded === true);
        } else {
            syncDockerLeafFolderPreviewActions(id, folder, runtimeContainers);
        }
        updateFolderRowStatusFromContainers(id, folder, runtimeContainers);
    });
    renderRuntimeHealthBadge(globalFolders, folderTypePrefs);
    refreshDockerFolderQuickActionStates();
    applyDockerFocusedFolderState();
    queueDockerSupportBundlePageSnapshot('runtime-sync');
};

const readDockerListViewMode = () => ($.cookie('docker_listview_mode') == 'advanced' ? 'advanced' : 'basic');

const syncDockerListViewModeFromCookie = () => {
    const nextMode = readDockerListViewMode();
    if (nextMode === lastDockerListViewMode) {
        return;
    }
    lastDockerListViewMode = nextMode;
    if (!loadedFolder || !globalFolders || Object.keys(globalFolders).length <= 0) {
        return;
    }
    syncDockerVisibleFoldersFromRuntimeCache();
    scheduleDockerRuntimeWidthReflow('listview-mode-change', 12);
};

const startDockerListViewModeObserver = () => {
    if (dockerListViewModeObserverTimer || typeof window.setInterval !== 'function') {
        return;
    }
    dockerListViewModeObserverTimer = window.setInterval(() => {
        if (document.hidden === true) {
            return;
        }
        syncDockerListViewModeFromCookie();
    }, 500);
    if (typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', syncDockerListViewModeFromCookie);
    }
    if (typeof window.addEventListener === 'function') {
        window.addEventListener('focus', syncDockerListViewModeFromCookie);
    }
};

const queueDockerDeferredRuntimeInfoHydration = (generation, stateSignature, fullInfoPromise = null) => {
    const requestPromise = fullInfoPromise && typeof fullInfoPromise.then === 'function'
        ? fullInfoPromise
        : createDockerRuntimeRequest('/plugins/folderview.plus/server/read_info.php?type=docker', {
            source: 'runtime-info-full',
            label: 'Docker runtime details',
            allowFallback: true,
            fallbackValue: JSON.stringify({}),
            fallbackTitle: 'Docker runtime details were partially unavailable',
            fallbackMessage: 'FolderView Plus rendered the Docker page, but advanced Docker runtime details had to fall back after the initial folder view loaded.',
            fallbackLead: 'Docker runtime detail hydration fell back to the lightweight state payload.'
        });
    const hydrationGeneration = generation;
    Promise.resolve(requestPromise)
        .then((payload) => {
            if (hydrationGeneration !== dockerBootstrapGeneration) {
                return;
            }
            const parsed = parseJsonPayloadSafe(payload);
            if (!parsed || Object.keys(parsed).length <= 0) {
                return;
            }
            dockerRuntimeInfoByName = normalizeDockerRuntimeInfoMap(parsed, dockerRuntimeInfoByName);
            if (stateSignature) {
                lastLiveRefreshStateSignature = stateSignature;
            }
            markDockerFatalBannerStep('Docker runtime details hydrated');
            recordDockerFatalBannerAction('Docker runtime details hydrated');
            syncDockerVisibleFoldersFromRuntimeCache();
        })
        .catch(() => {});
};
let dockerPostUpdateRuntimeReconcileTimer = null;
const queueDockerPostUpdateRuntimeReconcilePoll = (delayMs = DOCKER_POST_UPDATE_RECONCILE_POLL_INTERVAL_MS) => {
    if (!isDockerHostUpdateSyncSuspended() || dockerPostUpdateRuntimePollTimer !== null) {
        return;
    }
    const safeDelayMs = Math.max(0, Number(delayMs) || 0);
    dockerPostUpdateRuntimePollTimer = window.setTimeout(() => {
        dockerPostUpdateRuntimePollTimer = null;
        if (!isDockerHostUpdateSyncSuspended()) {
            return;
        }
        appendDockerBulkUpdateTrace('postUpdatePoll', {
            delayMs: safeDelayMs
        });
        Promise.resolve(refreshDockerRuntimeStateInPlace({
            followupDelayMs: 650
        }))
            .catch(() => {})
            .finally(() => {
                if (isDockerHostUpdateSyncSuspended()) {
                    queueDockerPostUpdateRuntimeReconcilePoll(DOCKER_POST_UPDATE_RECONCILE_POLL_INTERVAL_MS);
                }
            });
    }, safeDelayMs);
};
const queueDockerPostUpdateRuntimeReconcile = (delayMs = DOCKER_POST_UPDATE_RECONCILE_INITIAL_DELAY_MS) => {
    if (!isDockerHostUpdateSyncSuspended() || dockerPostUpdateRuntimeReconcileTimer !== null) {
        return;
    }
    const safeDelayMs = Math.max(0, Number(delayMs) || 0);
    dockerPostUpdateRuntimeReconcileTimer = window.setTimeout(() => {
        dockerPostUpdateRuntimeReconcileTimer = null;
        if (!isDockerHostUpdateSyncSuspended()) {
            return;
        }
        Promise.resolve(refreshDockerRuntimeStateInPlace({
            followupDelayMs: 650
        }))
            .catch(() => {})
            .finally(() => {
                if (isDockerHostUpdateSyncSuspended()) {
                    queueDockerPostUpdateRuntimeReconcilePoll(DOCKER_POST_UPDATE_RECONCILE_POLL_INTERVAL_MS);
                }
            });
    }, safeDelayMs);
};
const armDockerPostUpdateRuntimeReconcileWindow = (durationMs = 0, options = {}) => {
    const resolvedUntil = suspendDockerHostUpdateSync(durationMs);
    const initialDelayMs = Math.max(
        0,
        Number(options?.initialDelayMs ?? DOCKER_POST_UPDATE_RECONCILE_INITIAL_DELAY_MS) || 0
    );
    const pollDelayMs = Math.max(
        0,
        Number(options?.pollDelayMs ?? DOCKER_POST_UPDATE_RECONCILE_POLL_INTERVAL_MS) || 0
    );
    appendDockerBulkUpdateTrace('reconcileWindowArmed', {
        durationMs: Math.max(0, Number(durationMs) || 0),
        initialDelayMs,
        pollDelayMs
    });
    queueDockerPostUpdateRuntimeReconcile(initialDelayMs);
    queueDockerPostUpdateRuntimeReconcilePoll(pollDelayMs);
    return resolvedUntil;
};

let createFoldersInFlight = false;
let createFoldersQueued = false;

/**
 * Handles the creation of all folders
 */
const createFolders = async () => {
    dockerPerf.begin('createFolders.total');
    setDockerFatalBannerPhase('bootstrap-data');
    try {
    ensureDockerExpandedStateLifecycleHooks();
    markDockerFatalBannerStep('Docker runtime lifecycle hooks ready');
    persistDockerExpandedStateFromDom();
    activeDockerRenderSuppressLoadingUi = nextDockerRenderSuppressLoadingUi;
    nextDockerRenderSuppressLoadingUi = false;
    showDockerRuntimeLoadingOverlay();
    showDockerRuntimeLoadingRow();
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] createFolders: Entry');
    const previousFolders = (globalFolders && typeof globalFolders === 'object') ? globalFolders : {};
    const requestBundle = (folderReq && typeof folderReq === 'object') ? folderReq : { render: [], fullInfo: null, generation: dockerBootstrapGeneration };
    const renderRequests = Array.isArray(requestBundle.render) ? requestBundle.render : [];
    const renderGeneration = Number(requestBundle.generation || dockerBootstrapGeneration || 0);
    dockerPerf.begin('createFolders.requests');
    const prom = await Promise.all(renderRequests);
    dockerPerf.end('createFolders.requests', { requestCount: renderRequests.length });
    markDockerFatalBannerStep('Docker runtime request bundle resolved');
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] createFolders: Promises resolved', prom);

    // Parse the results
    let folders = JSON.parse(prom[0]);
    let unraidOrder = Object.values(JSON.parse(prom[1]));
    const containersStateInfo = parseJsonPayloadSafe(prom[2]);
    let containersInfo = normalizeDockerRuntimeInfoMap(containersStateInfo);
    dockerRuntimeInfoByName = (containersInfo && typeof containersInfo === 'object' && !Array.isArray(containersInfo))
        ? { ...containersInfo }
        : {};
    ensureDockerHostRowUpdateObserver();
    if (!isDockerHostUpdateSyncSuspended() && syncDockerHostRowUpdateStatesFromDom()) {
        containersInfo = { ...dockerRuntimeInfoByName };
    }
    let order = readDockerHostOrderFromDom();
    let prefsResponse = {};
    try {
        prefsResponse = prom[3] ? JSON.parse(prom[3]) : {};
    } catch (error) {
        prefsResponse = {};
    }
    folderTypePrefs = utils.normalizePrefs(prefsResponse?.prefs || {});
    resolveDockerStrictPerformanceProfile(folderTypePrefs, folders, containersInfo);
    dockerRuntimeStateStore.set({
        pinnedFolderIds: Array.isArray(folderTypePrefs?.pinnedFolderIds) ? [...folderTypePrefs.pinnedFolderIds] : []
    });
    const folderDepthById = buildFolderDepthById(folders);
    unraidOrder = reorderFolderSlotsInBaseOrder(unraidOrder, folders, folderTypePrefs);
    applyRuntimePrefs(folderTypePrefs);
    lastLiveRefreshStateSignature = buildDockerStateSignature(containersStateInfo, true);
    if (order.length <= 0) {
        order = [...unraidOrder];
    }

    if (FOLDER_VIEW_DEBUG_MODE) {
        console.log('[FV3_DEBUG] createFolders: --- INITIAL ORDERS ---');
        console.log('[FV3_DEBUG] createFolders: Raw `unraidOrder` (from read_order.php):', JSON.parse(JSON.stringify(unraidOrder)));
        console.log('[FV3_DEBUG] createFolders: Raw `order` (from host DOM order):', JSON.parse(JSON.stringify(order)));
        console.log('[FV3_DEBUG] createFolders: Loaded prefs:', JSON.parse(JSON.stringify(folderTypePrefs)));
        console.log('[FV3_DEBUG] createFolders: Initial `folders` data:', JSON.parse(JSON.stringify(folders)));
        console.log('[FV3_DEBUG] createFolders: Initial `containersInfo` keys:', Object.keys(containersInfo));
        console.log('[FV3_DEBUG] createFolders: --- END INITIAL ORDERS ---');
    }


    // Filter the order to get the container that aren't in the order, this happen when a new container is created
    const newOnes = order.filter(x => !unraidOrder.includes(x));
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] createFolders: newOnes (containers not in unraidOrder)', newOnes);


    // Insert the folder in the unraid folder into the order shifted by the unlisted containers
    for (let index = 0; index < unraidOrder.length; index++) {
        const element = unraidOrder[index];
        if((folderRegex.test(element) && folders[element.slice(7)])) {
            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolders: Splicing folder ${element} into order at index ${index + newOnes.length}`);
            order.splice(index+newOnes.length, 0, element);
        }
    }
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] createFolders: Order after inserting Unraid-ordered folders', [...order]);


    // debug mode, download the debug json file
    if(folderDebugMode) { // This is the existing folderDebugMode, not FOLDER_VIEW_DEBUG_MODE
        if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] createFolders: folderDebugMode (existing) is TRUE. Preparing debug JSON download.');
        const debugData = JSON.stringify({
            version: (await $.get('/plugins/folderview.plus/server/version.php').promise()).trim(),
            folders,
            unraidOrder,
            originalOrder: order,
            newOnes,
            order,
            containersInfo
        });
        const blob = new Blob([debugData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const element = document.createElement('a');
        element.href = url;
        element.download = 'debug-DOCKER.json';
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        URL.revokeObjectURL(url);
        if (FOLDER_VIEW_DEBUG_MODE) console.log('Order:', [...order]); // Existing log
        if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] createFolders: Debug JSON downloaded. Order logged (existing log):', [...order]);
    }

    let foldersDone = {};
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] createFolders: Initialized foldersDone', foldersDone);


    if(folderobserver) {
        if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] createFolders: Disconnecting existing folderobserver.');
        folderobserver.disconnect();
        folderobserver = undefined;
    }

    folderobserver = new MutationObserver((mutationList, observer) => {
        if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] folderobserver: Mutation observed', mutationList);
        for (const mutation of mutationList) {
            if(/^load-/.test(mutation.target.id)) {
                if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] folderobserver: Target ID matches /^load-/', mutation.target.id, mutation.target.className);
                $('i#folder-' + mutation.target.id).attr('class', mutation.target.className)
            }
        }
    });
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] createFolders: New folderobserver created.');

    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] createFolders: Dispatching docker-pre-folders-creation event.');
    folderEvents.dispatchEvent(new CustomEvent('docker-pre-folders-creation', {detail: {
        folders: folders,
        order: order,
        containersInfo: containersInfo
    }}));
    const folderMatchCache = buildDockerFolderMatchCache(order, containersInfo, folders, folderTypePrefs);

    // Draw the folders in the order
    dockerPerf.begin('createFolders.renderOrdered');
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] createFolders: Starting loop to draw folders in order.');
    let orderedFolderRenderCount = 0;
    for (let key = 0; key < order.length; key++) {
        const container = order[key];
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolders: Loop iteration: key=${key}, container=${container}`);
        if (container && folderRegex.test(container)) {
            let id = container.replace(folderRegex, '');
            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolders: Is a folder: id=${id}`);
            if (folders[id]) {
                if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolders: Folder ${id} exists in folders data. Calling createFolder. Position in order: ${key}`);
                // Pass 'order' (the live array) to createFolder.
                // 'position' is the current 'key' (index of the folder placeholder in the 'order' array).
                const removedCount = createFolder(
                    folders[id],
                    id,
                    key,
                    order,
                    containersInfo,
                    Object.keys(foldersDone),
                    folderMatchCache[id] || null,
                    folderDepthById[id] || 0
                );
                key -= removedCount; // Adjust key by the number of items that were before the folder and moved into it.
                if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolders: createFolder for ${id} returned remBefore=${removedCount}. Adjusted main loop key to ${key}.`);
                foldersDone[id] = folders[id];
                delete folders[id];
                if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolders: Folder ${id} moved to foldersDone. Updated foldersDone:`, {...foldersDone}, "Remaining folders:", {...folders});
                orderedFolderRenderCount += 1;
                await yieldDockerRenderLoop(orderedFolderRenderCount, order.length);
            } else {
                if (FOLDER_VIEW_DEBUG_MODE) console.warn(`[FV3_DEBUG] createFolders: Folder ${id} (from order) not found in folders data.`);
            }
        }
    }
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] createFolders: Finished loop for ordered folders.');
    dockerPerf.end('createFolders.renderOrdered', { orderedEntries: order.length });

    // Draw the foldes outside of the order
    dockerPerf.begin('createFolders.renderRemaining');
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] createFolders: Starting loop to draw folders outside of order (remaining).');
    // Preserve original folder order when inserting at the top with unshift.
    const remainingFolders = Object.entries(getPrefsOrderedFolderMap(folders, folderTypePrefs)).reverse();
    let remainingFolderRenderCount = 0;
    for (const [id, value] of remainingFolders) {
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolders: Processing remaining folder: id=${id}`);
        // Add the folder on top of the array
        order.unshift(`folder-${id}`);
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolders: Unshifted folder-${id} to order. New order:`, [...order]);
        createFolder(
            value,
            id,
            0,
            order,
            containersInfo,
            Object.keys(foldersDone),
            folderMatchCache[id] || null,
            folderDepthById[id] || 0
        );
        // Move the folder to the done object and delete it from the undone one
        foldersDone[id] = folders[id];
        delete folders[id];
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolders: Remaining folder ${id} moved to foldersDone. Updated foldersDone:`, {...foldersDone}, "Remaining folders:", {...folders});
        remainingFolderRenderCount += 1;
        await yieldDockerRenderLoop(remainingFolderRenderCount, remainingFolders.length);
    }
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] createFolders: Finished loop for remaining folders.');
    dockerPerf.end('createFolders.renderRemaining', { remainingCount: Object.keys(folders).length });

    const $dockerList = $('#docker_list');
    if ($dockerList.length && typeof $dockerList.sortable === 'function') {
        const sortableInstance = $dockerList.data('ui-sortable') || $dockerList.data('sortable');
        if (sortableInstance) {
            $dockerList.sortable('refresh');
        }
    }

    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] createFolders: Dispatching docker-post-folders-creation event.');
    folderEvents.dispatchEvent(new CustomEvent('docker-post-folders-creation', {detail: {
        folders: folders, // Note: this `folders` object will be empty here if all were processed
        order: order,
        containersInfo: containersInfo
    }}));

    // Assign the folder done to the global object
    globalFolders = foldersDone;
    dockerFolderHierarchy = buildFolderHierarchy(globalFolders);
    applyNestedFolderHierarchy();

    // Expand folders from remembered runtime state (fallback: previous in-memory state, then expand_tab).
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] createFolders: Restoring remembered expand state.');
    const expandedStateById = buildDockerExpandedStateMap(
        foldersDone,
        previousFolders,
        readDockerServerExpandedStateMap()
    );
    for (const [id, value] of Object.entries(foldersDone)) {
        if (!value || typeof value !== 'object') {
            continue;
        }
        value.status = (value.status && typeof value.status === 'object') ? value.status : {};
        value.status.expanded = expandedStateById[id] === true;
    }
    const expansionIds = Object.keys(foldersDone)
        .sort((a, b) => (folderDepthById[a] || 0) - (folderDepthById[b] || 0));
    const maxRestoredExpansions = folderTypePrefs?.performanceMode === true
        ? Number(dockerRuntimePerformanceProfile?.expandRestoreLimit || PERFORMANCE_MODE_EXPAND_RESTORE_LIMIT)
        : Number.POSITIVE_INFINITY;
    let restoredExpansionCount = 0;
    for (const id of expansionIds) {
        if (expandedStateById[id] !== true) {
            continue;
        }
        const folder = foldersDone[id] || {};
        const parentId = normalizeFolderParentId(folder?.parentId || folder?.parent_id || '');
        const hasKnownParent = !!(parentId && Object.prototype.hasOwnProperty.call(foldersDone, parentId));
        if (hasKnownParent && expandedStateById[parentId] !== true) {
            continue;
        }
        if (restoredExpansionCount >= maxRestoredExpansions) {
            expandedStateById[id] = false;
            folder.status = (folder.status && typeof folder.status === 'object') ? folder.status : {};
            folder.status.expanded = false;
            continue;
        }
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolders: Restoring expanded folder ${id}.`);
        dropDownButton(id, false);
        restoredExpansionCount++;
    }
    persistDockerExpandedStateFromGlobal();

    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] createFolders: Assigned foldersDone to globalFolders:', {...globalFolders});
    renderRuntimeHealthBadge(globalFolders, folderTypePrefs);
    refreshDockerFolderQuickActionStates();
    applyDockerFocusedFolderState();
    scheduleDockerPostRenderPolish(Object.keys(globalFolders));
    queueDockerDeferredRuntimeInfoHydration(renderGeneration, lastLiveRefreshStateSignature, requestBundle.fullInfo);
    queueDockerSupportBundlePageSnapshot('render-complete', 260);
    queueDockerPostUpdateRuntimeReconcile();

    folderDebugMode = false; // Existing flag
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] createFolders: Set folderDebugMode (existing) to false.');

    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] createFolders: Exit');
    markDockerFatalBannerStep('Docker folders rendered');
    setDockerFatalBannerPhase('ready');
    recordDockerFatalBannerAction('Docker folders rendered successfully');
    } catch (error) {
    reportDockerFatalRuntimeError(error, {
        phase: error?.fvplusPhase || 'bootstrap-data',
        category: error?.fvplusCategory || inferDockerFatalBannerCategory(error, 'runtime-failed')
    });
    throw error;
    } finally {
    dockerHostLoadOwnsLoadingUi = false;
    activeDockerRenderSuppressLoadingUi = false;
    hideDockerRuntimeLoadingOverlay();
    hideDockerRuntimeLoadingRow();
    dockerPerf.end('createFolders.total', {
        folderCount: Object.keys(globalFolders || {}).length,
        perfMode: FOLDER_VIEW_PERF_MODE
    });
    }
};

const queueCreateFoldersRender = () => {
    if (createFoldersInFlight) {
        createFoldersQueued = true;
        return;
    }
    createFoldersInFlight = true;
    Promise.resolve()
        .then(() => createFolders())
        .catch((error) => {
            if (!error?.fvplusBannerShown) {
                reportDockerFatalRuntimeError(error, {
                    phase: error?.fvplusPhase || 'runtime',
                    category: error?.fvplusCategory || inferDockerFatalBannerCategory(error, 'promise-rejection')
                });
            }
        })
        .finally(() => {
            createFoldersInFlight = false;
            if (createFoldersQueued) {
                createFoldersQueued = false;
                // If Unraid queued a newer request bundle mid-render, replay FolderView Plus
                // against the current DOM instead of forcing another host loadlist() cycle.
                nextDockerRenderSuppressLoadingUi = true;
                queueCreateFoldersRender();
            }
        });
};

const renderFolderUpdateColumn = (id, $updateColumn, managerTypes, upToDate, managed) => {
    const hierarchyApi = getDockerRuntimeHierarchyApi();
    if (hierarchyApi && typeof hierarchyApi.renderFolderUpdateColumn === 'function') {
        hierarchyApi.renderFolderUpdateColumn(id, $updateColumn, managerTypes, upToDate, managed);
    }
};

/**
 * Handles the creation of one folder
 * @param {object} folder the folder
 * @param {string} id if of the folder
 * @param {int} position position to inset the folder
 * @param {Array<string>} order order of containers
 * @param {object} containersInfo info of the containers
 * @param {Array<string>} foldersDone folders that are done
 * @param {object|null} matchCacheEntry precomputed membership candidates
 * @param {number} depthLevel visual nesting depth for parent/child folders
 * @returns {number} the number of element removed before the folder
 */
const createFolder = (folder, id, positionInMainOrder, liveOrderArray, containersInfo, foldersDone, matchCacheEntry = null, depthLevel = 0) => {
    const perfKey = `createFolder.${id}`;
    dockerPerf.begin(perfKey);
    try {
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Entry`, { folder: JSON.parse(JSON.stringify(folder)), id, positionInMainOrder, orderInitialSnapshot: [...liveOrderArray], containersInfoKeys: Object.keys(containersInfo).length, foldersDone: [...foldersDone] });
    if (dockerRuntimePerformanceProfile?.performanceMode === true && folder && typeof folder === 'object') {
        folder.settings = {
            ...(folder.settings || {}),
            preview: 0,
            preview_hover: false,
            preview_logs: false,
            preview_console: false,
            preview_webui: false,
            preview_vertical_bars: false,
            preview_update: false,
            preview_grayscale: false
        };
    }

    // --- Store a snapshot of the live order array AT THE START of this folder's processing ---
    // This snapshot is crucial for correctly calculating `remBefore` based on original positions.
    const orderSnapshotAtFolderStart = [...liveOrderArray];
    if (FOLDER_VIEW_DEBUG_MODE && id === "2l2rPNIkZHWN5WLqAuzPaCZHSqI") { // Specific log for Network folder
        console.log(`[FV3_DEBUG] createFolder (Network folder ENTRY): folder.containers from input arg =`, JSON.parse(JSON.stringify(folder.containers)));
        console.log(`[FV3_DEBUG] createFolder (Network folder ENTRY): folder.regex from input arg = "${folder.regex}"`);
        console.log(`[FV3_DEBUG] createFolder (Network folder ENTRY): orderSnapshotAtFolderStart (liveOrderArray copy) =`, [...orderSnapshotAtFolderStart]);
    }

    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Dispatching docker-pre-folder-creation event.`);
    folderEvents.dispatchEvent(new CustomEvent('docker-pre-folder-creation', {detail: {
        folder: folder, // Be aware: if 'folder' object is modified by listeners, it affects this function
        id: id,
        position: positionInMainOrder, // Use the more descriptive name
        order: liveOrderArray,         // Pass the live array
        containersInfo: containersInfo,
        foldersDone: foldersDone
    }}));

    // Default variables
    let upToDate = true;
    let started = 0;
    let paused = 0;
    let stopped = 0;
    let autostart = 0;
    let autostartStarted = 0;
    let managed = 0;
    let managerTypes = new Set();
    let remBefore = 0; // This will count items *from this folder* that were originally before its placeholder
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Initialized local state variables`, { upToDate, started, autostart, autostartStarted, managed, remBefore });

    const advanced = $.cookie('docker_listview_mode') == 'advanced';
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Advanced view enabled: ${advanced}`);

    // --- Correctly build combinedContainers ---
    const precomputed = matchCacheEntry && typeof matchCacheEntry === 'object' ? matchCacheEntry : null;
    const originalContainersFromDefinition = precomputed
        ? (Array.isArray(precomputed.explicit) ? [...precomputed.explicit] : [])
        : (Array.isArray(folder.containers) ? [...folder.containers] : []);
    const combinedContainers = [];
    const combinedSet = new Set();
    const pushCombined = (name) => {
        const key = String(name || '').trim();
        if (!key || combinedSet.has(key) || !containersInfo[key]) {
            return;
        }
        combinedSet.add(key);
        combinedContainers.push(key);
    };

    originalContainersFromDefinition.forEach(pushCombined);
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Initial containers from definition for combinedContainers:`, [...originalContainersFromDefinition]);

    let regexMatches = [];
    if (precomputed && Array.isArray(precomputed.regex)) {
        regexMatches = precomputed.regex;
    } else if (folder.regex && typeof folder.regex === 'string' && folder.regex.trim() !== "") {
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Regex defined: '${folder.regex}'. Filtering orderSnapshotAtFolderStart.`);
        try {
            const re = new RegExp(folder.regex);
            regexMatches = orderSnapshotAtFolderStart.filter((el) => containersInfo[el] && re.test(el));
        } catch (e) {
            regexMatches = [];
            if (FOLDER_VIEW_DEBUG_MODE) console.error(`[FV3_DEBUG] createFolder (id: ${id}): Invalid regex '${folder.regex}':`, e);
        }
    } else if (FOLDER_VIEW_DEBUG_MODE && folder.regex) {
        console.log(`[FV3_DEBUG] createFolder (id: ${id}): Regex is present but empty or invalid, skipping regex matching.`);
    }
    regexMatches.forEach(pushCombined);

    const labelMatches = precomputed && Array.isArray(precomputed.label)
        ? precomputed.label
        : orderSnapshotAtFolderStart.filter((el) => {
            const labels = containersInfo[el]?.Labels || {};
            return getFolderLabelValue(labels) === folder.name;
        });
    labelMatches.forEach(pushCombined);

    const ruleMatches = precomputed && Array.isArray(precomputed.rules)
        ? precomputed.rules
        : utils.getAutoRuleMatches({
            rules: folderTypePrefs.autoRules || [],
            folderId: id,
            names: orderSnapshotAtFolderStart,
            infoByName: containersInfo,
            type: 'docker'
        });
    ruleMatches.forEach(pushCombined);

    if (FOLDER_VIEW_DEBUG_MODE) {
        console.log(`[FV3_DEBUG] createFolder (id: ${id}): Containers matched by folder label ('${folder.name}'):`, labelMatches);
        console.log(`[FV3_DEBUG] createFolder (id: ${id}): Containers matched by auto rules:`, ruleMatches);
        console.log(`[FV3_DEBUG] createFolder (id: ${id}): Final combined list of containers for folder processing (combinedContainers):`, [...combinedContainers]);
    }
    const lazyPreviewEnabled = folderTypePrefs?.lazyPreviewEnabled === true;
    const lazyPreviewThreshold = Number(folderTypePrefs?.lazyPreviewThreshold || 30);
    const isExpandedByDefault = folder?.settings?.expand_tab === true;
    const lazyPreviewActive = lazyPreviewEnabled
        && Number.isFinite(lazyPreviewThreshold)
        && combinedContainers.length >= Math.max(10, Math.min(200, Math.round(lazyPreviewThreshold)))
        && !isExpandedByDefault;
    if (lazyPreviewActive && folder && typeof folder === 'object') {
        folder.settings = {
            ...(folder.settings || {}),
            preview: 0,
            preview_hover: false,
            preview_logs: false,
            preview_console: false,
            preview_webui: false,
            preview_vertical_bars: false,
            preview_update: false,
            preview_grayscale: false
        };
    }
    // --- End of combinedContainers build ---

    const colspan = document.querySelector("#docker_containers > thead > tr").childElementCount - 5;
    const hoverClass = folder.settings.preview_hover && !FOLDER_VIEW_TOUCH_MODE ? 'hover' : '';
    const safeFolderIcon = sanitizeImageSrc(folder.icon);
    const safeFolderName = escapeHtml(folder.name);
    const pinned = isDockerFolderPinned(id);
    const locked = isDockerFolderLocked(id);
    const focused = dockerFocusedFolderId === id;
    const lockedClass = locked ? 'fv-folder-locked' : '';
    const pinnedClass = pinned ? 'fv-folder-pinned' : '';
    const focusedClass = focused ? 'fv-folder-focused' : '';
    const fld = `<tr class="sortable folder-id-${id} ${hoverClass} ${lockedClass} ${pinnedClass} ${focusedClass} folder"><td class="ct-name folder-name"><div class="folder-name-sub"><i class="fa fa-arrows-v mover orange-text"></i><span class="outer folder-outer"><span id="${id}" onclick="addDockerFolderContext('${id}')" class="hand folder-hand"><img src="${safeFolderIcon}" class="img folder-img" onerror='this.src="/plugins/dynamix.docker.manager/images/question.png"'></span><span class="inner folder-inner"><span class="appname" style="display: none;"><a>folder-${id}</a></span><a class="exec folder-appname" onclick='editFolder("${id}")'>${safeFolderName}</a><br><i id="load-folder-${id}" class="fa fa-square stopped folder-load-status"></i><span class="state folder-state fv-folder-state-stopped"> ${$.i18n('stopped')}</span></span></span><button class="dropDown-${id} folder-dropdown" onclick="dropDownButton('${id}')" ><i class="fa fa-chevron-down" aria-hidden="true"></i></button></div></td><td class="updatecolumn folder-update"><span class="green-text folder-update-text"><i class="fa fa-check fa-fw"></i> ${$.i18n('up-to-date')}</span><div class="advanced" style="display: ${advanced ? 'block' : 'none'};"><a class="exec" onclick="forceUpdateFolder('${id}');"><span style="white-space:nowrap;"><i class="fa fa-cloud-download fa-fw"></i> ${$.i18n('force-update')}</span></a></div></td><td colspan="${colspan}" class="folder-preview-cell"><div class="folder-storage"></div><div class="folder-preview"></div></td><td class="advanced folder-advanced" ${advanced ? 'style="display: table-cell;"' : ''}><span class="cpu-folder-${id} folder-cpu">0%</span><div class="usage-disk mm folder-load"><span id="cpu-folder-${id}" class="folder-cpu-bar" style="width:0%"></span><span></span></div><br><span class="mem-folder-${id} folder-mem">0 / 0</span></td><td class="folder-autostart"><input type="checkbox" id="folder-${id}-auto" class="autostart" style="display:none"><div style="clear:left"></div></td><td></td></tr>`;
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): colspan=${colspan}. Generated folder HTML (fld).`);

    if (positionInMainOrder === 0) {
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Inserting folder HTML at position 0 (before).`);
        $('#docker_list > tr.sortable').eq(0).before($(fld)); // Always eq(0) for 'before' the first sortable
    } else {
        // Find the actual DOM element that is currently at positionInMainOrder - 1 in the *visible sortable list*
        // This needs to be robust to items already having been moved.
        // A safer bet is to find the *last processed item* or *first non-folder item* if the folder is inserted later.
        // For now, using the direct index, assuming other sortables are still in place.
        if ($('#docker_list > tr.sortable').length > 0 && positionInMainOrder > 0) {
             if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Inserting folder HTML at position ${positionInMainOrder} (after eq ${positionInMainOrder-1} of current sortables).`);
             $('#docker_list > tr.sortable').eq(positionInMainOrder - 1).after($(fld));
        } else if ($('#docker_list > tr.sortable').length === 0 && positionInMainOrder === 0) {
            // If no sortables exist yet (e.g., first folder, all others are new)
             if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): No sortables found, inserting folder at the beginning of #docker_list.`);
            $('#docker_list').prepend($(fld));
        } else {
             if (FOLDER_VIEW_DEBUG_MODE) console.warn(`[FV3_DEBUG] createFolder (id: ${id}): Could not determine insertion point for folder. Position: ${positionInMainOrder}, Sortables count: ${$('#docker_list > tr.sortable').length}`);
             // Fallback: append to the list if other logic fails
             $('#docker_list').append($(fld));
        }
    }
    const safeDepth = Math.max(0, Math.min(8, Number(depthLevel) || 0));
    const depthIndentPx = safeDepth * 20;
    $(`tr.folder-id-${id}`)
        .attr('data-folder-depth', String(safeDepth))
        .find('.folder-name-sub')
        .css('padding-left', `${depthIndentPx}px`);
    forceFolderRowVerticalCenter(id);

    const previewNode = $(`tr.folder-id-${id} div.folder-preview`).get(0);
    applyPreviewBorderStyle(previewNode, folder.settings);
    applyFolderDropdownStyle($(`tr.folder-id-${id}`), folder.settings);
    applyFolderPreviewLayout($(`tr.folder-id-${id} div.folder-preview`), folder.settings);
    $(`tr.folder-id-${id} div.folder-preview`).addClass(`folder-preview-${folder.settings.preview}`);
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Added class folder-preview-${folder.settings.preview} to preview div.`);

    let addPreview;
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Selecting addPreview function based on folder.settings.preview = ${folder.settings.preview}. Context setting: ${folder.settings.context}`);
    const compactMultiRowPreview = isCompactMultiRowPreview(folder.settings);
    const appendCompactPreview = (folderTrId, ctid, autostart, previewEntry, $sourceRow = null) => {
        let compactPreviewItem = null;
        if (folder.settings.context === 1) {
            compactPreviewItem = buildCompactPreviewDefaultContextItem($sourceRow, folder.settings, autostart);
        }
        const builtPreview = compactPreviewItem
            ? { $item: compactPreviewItem, $tooltipTrigger: null }
            : buildDockerPreviewItem({
                entry: previewEntry || {},
                settings: folder.settings,
                autostart
            });
        const { $item, $tooltipTrigger } = builtPreview;
        $(`tr.folder-id-${folderTrId} div.folder-preview`).append($item);
        if (folder.settings.context === 1) {
            if (compactPreviewItem) {
                bindCompactPreviewDefaultContextProxy($item);
            } else {
                bindCompactPreviewDefaultContext($item, $sourceRow);
            }
            return null;
        }
        if (folder.settings.context === 2 || folder.settings.context === 0) {
            const $triggerTarget = $tooltipTrigger && $tooltipTrigger.length ? $tooltipTrigger : $item.find('.fv-preview-trigger').first();
            if ($triggerTarget.length) {
                $triggerTarget.attr("id", "folder-preview-" + ctid);
                $triggerTarget.removeAttr("onclick");
                if (folder.settings.context === 2) {
                    return $triggerTarget;
                }
            }
        }
        return $tooltipTrigger;
    };
    switch (folder.settings.preview) {
        case 1:
            addPreview = (folderTrId, ctid, autostart, previewEntry, $sourceRow = null) => {
                if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] addPreview (case 1 for ${folderTrId}): ctid=${ctid}, autostart=${autostart}`);
                if (compactMultiRowPreview) {
                    return appendCompactPreview(folderTrId, ctid, autostart, previewEntry, $sourceRow);
                }
                let clone = $(`tr.folder-id-${folderTrId} div.folder-storage > tr > td.ct-name > span.outer:last`).clone();
                clone.find(`span.state`)[0].innerHTML = clone.find(`span.state`)[0].innerHTML.split("<br>")[0];
                $(`tr.folder-id-${folderTrId} div.folder-preview`).append(clone.addClass(`${autostart ? 'autostart' : ''}`));
                let tmpId = $(`tr.folder-id-${folderTrId} div.folder-preview > span.outer:last`).find('i[id^="load-"]');
                tmpId.attr("id", "folder-" + tmpId.attr("id"));
                if(folder.settings.context === 2 || folder.settings.context === 0) {
                    tmpId = $(`tr.folder-id-${folderTrId} div.folder-preview > span.outer:last > span.hand`);
                    tmpId.attr("id", "folder-preview-" + ctid);
                    tmpId.removeAttr("onclick");
                    if(folder.settings.context === 2) { return tmpId; }
                }
            }; break;
        case 2:
            addPreview = (folderTrId, ctid, autostart, previewEntry, $sourceRow = null) => {
                if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] addPreview (case 2 for ${folderTrId}): ctid=${ctid}, autostart=${autostart}`);
                if (compactMultiRowPreview) {
                    return appendCompactPreview(folderTrId, ctid, autostart, previewEntry, $sourceRow);
                }
                $(`tr.folder-id-${folderTrId} div.folder-preview`).append($(`tr.folder-id-${folderTrId} div.folder-storage > tr > td.ct-name > span.outer > span.hand:last`).clone().addClass(`${autostart ? 'autostart' : ''}`));
                if(folder.settings.context === 2 || folder.settings.context === 0) {
                    let tmpId = $(`tr.folder-id-${folderTrId} div.folder-preview > span.hand:last`);
                    tmpId.attr("id", "folder-preview-" + ctid);
                    tmpId.removeAttr("onclick");
                    if(folder.settings.context === 2) { return tmpId; }
                }
            }; break;
        case 3:
            addPreview = (folderTrId, ctid, autostart, previewEntry, $sourceRow = null) => {
                if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] addPreview (case 3 for ${folderTrId}): ctid=${ctid}, autostart=${autostart}`);
                if (compactMultiRowPreview) {
                    return appendCompactPreview(folderTrId, ctid, autostart, previewEntry, $sourceRow);
                }
                let clone = $(`tr.folder-id-${folderTrId} div.folder-storage > tr > td.ct-name > span.outer > span.inner:last`).clone();
                clone.find(`span.state`)[0].innerHTML = clone.find(`span.state`)[0].innerHTML.split("<br>")[0];
                $(`tr.folder-id-${folderTrId} div.folder-preview`).append(clone.addClass(`${autostart ? 'autostart' : ''}`));
                let tmpId = $(`tr.folder-id-${folderTrId} div.folder-preview > span.inner:last`).find('i[id^="load-"]');
                tmpId.attr("id", "folder-" + tmpId.attr("id"));
                if(folder.settings.context === 2 || folder.settings.context === 0) {
                    tmpId = $(`tr.folder-id-${folderTrId} div.folder-preview > span.inner:last > span.appname > a.exec`);
                    tmpId.attr("id", "folder-preview-" + ctid);
                    tmpId.removeAttr("onclick");
                    if(folder.settings.context === 2) { return tmpId; }
                }
            }; break;
        case 4:
            addPreview = (folderTrId, ctid, autostart, previewEntry, $sourceRow = null) => {
                if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] addPreview (case 4 for ${folderTrId}): ctid=${ctid}, autostart=${autostart}`);
                if (compactMultiRowPreview) {
                    return appendCompactPreview(folderTrId, ctid, autostart, previewEntry, $sourceRow);
                }
                let lstSpan = $(`tr.folder-id-${folderTrId} div.folder-preview > span.outer:last`);
                if(!lstSpan[0] || lstSpan.children().length >= 2) {
                    $(`tr.folder-id-${folderTrId} div.folder-preview`).append($('<span class="outer"></span>'));
                    lstSpan = $(`tr.folder-id-${folderTrId} div.folder-preview > span.outer:last`);
                }
                lstSpan.append($('<span class="inner"></span>'));
                lstSpan.children('span.inner:last').append($(`tr.folder-id-${folderTrId} div.folder-storage > tr > td.ct-name > span.outer > span.inner > span.appname:last`).clone().addClass(`${autostart ? 'autostart' : ''}`));
                if(folder.settings.context === 2 || folder.settings.context === 0) {
                    let tmpId = $(`tr.folder-id-${folderTrId} div.folder-preview span.inner:last > span.appname > a.exec`);
                    tmpId.attr("id", "folder-preview-" + ctid);
                    tmpId.removeAttr("onclick");
                    if(folder.settings.context === 2) {
                        return tmpId.length>0 ? tmpId : $(`tr.folder-id-${folderTrId} div.folder-preview span.inner:last > span.appname`).attr("id", "folder-preview-" + ctid);
                    }
                }
            }; break;
        default:
            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Default case for addPreview (no preview).`);
            addPreview = () => { };
            break;
    }

    let newFolder = {};
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Initialized newFolder for processed containers.`);

    // Note: `cutomOrder` is not used in the critical logic below, but kept for potential other uses or debugging.
    const mappedFoldersDone = foldersDone.map(e => 'folder-'+e);
    const cutomOrder = orderSnapshotAtFolderStart.filter((e) => { // Based on snapshot, as original code
        return e && (mappedFoldersDone.includes(e) || !(folderRegex.test(e) && e !== `folder-${id}`));
    });
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): (Informational) Filtered cutomOrder based on orderSnapshotAtFolderStart:`, [...cutomOrder]);


    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Starting loop to process ${combinedContainers.length} combinedContainers.`);
    for (const container_name_in_folder of combinedContainers) {

        const ct = containersInfo[container_name_in_folder];
        if (!ct) {
            if (FOLDER_VIEW_DEBUG_MODE) console.error(`[FV3_DEBUG] createFolder (id: ${id}): CRITICAL - Container info for '${container_name_in_folder}' not found in containersInfo! Skipping further processing for this container.`);
            continue; // Skip this container if info is missing
        }
        const indexInCustomOrder = cutomOrder.indexOf(container_name_in_folder);
        const indexInLiveOrderArray = liveOrderArray.indexOf(container_name_in_folder);

        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Processing container from combinedContainers: ${container_name_in_folder}`);

        const originalIndexOfContainerInSnapshot = orderSnapshotAtFolderStart.indexOf(container_name_in_folder);
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}), container ${container_name_in_folder}: originalIndexOfContainerInSnapshot=${originalIndexOfContainerInSnapshot}, folder's positionInMainOrder=${positionInMainOrder}`);

        if (originalIndexOfContainerInSnapshot !== -1 && originalIndexOfContainerInSnapshot < positionInMainOrder) {
            remBefore++;
            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}), container ${container_name_in_folder}: Original index ${originalIndexOfContainerInSnapshot} < folder position ${positionInMainOrder}. Incremented remBefore to ${remBefore}.`);
        }

        let $containerTR = $(document.getElementById(`ct-${container_name_in_folder}`));
        if (!$containerTR.length || !$containerTR.hasClass('sortable')) {
            if(FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}), container ${container_name_in_folder}: TR not found by ID or not sortable. Fallback search...`);
            $containerTR = $("#docker_list > tr.sortable").filter(function() {
                return $(this).find("td.ct-name .appname").text().trim() === container_name_in_folder;
            }).first();
        }

        if ($containerTR.length) {
            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}), container ${container_name_in_folder}: Found its TR element in the main list.`);

            folderEvents.dispatchEvent(new CustomEvent('docker-pre-folder-preview', {detail: {
                folder: folder,
                id: id,
                position: positionInMainOrder,
                order: liveOrderArray,
                containersInfo: containersInfo,
                foldersDone: foldersDone, // Original foldersDone
                container: container_name_in_folder,
                ct: ct,
                index: indexInCustomOrder,
                offsetIndex: indexInLiveOrderArray
            }}));

            $(`tr.folder-id-${id} div.folder-storage`).append(
                $containerTR.addClass(`folder-${id}-element folder-element`).removeClass('sortable ui-sortable-handle')
            );
            decorateDockerFolderMemberRow($containerTR, id, ct.info.Name || container_name_in_folder);
            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}), container ${container_name_in_folder}: Moved TR to folder storage.`);

            const currentIndexInLiveList = liveOrderArray.indexOf(container_name_in_folder);
            if (currentIndexInLiveList !== -1) {
                liveOrderArray.splice(currentIndexInLiveList, 1);
                if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}), container ${container_name_in_folder}: Spliced from liveOrderArray. New liveOrderArray length: ${liveOrderArray.length}`);
            } else {
                if (FOLDER_VIEW_DEBUG_MODE) console.warn(`[FV3_DEBUG] createFolder (id: ${id}): Container ${container_name_in_folder} was MOVED FROM DOM but NOT FOUND IN liveOrderArray for splicing. This might indicate it was already spliced by a previous folder or logic error.`);
            }

            newFolder[container_name_in_folder] = {
                id: ct.shortId,
                name: ct.info.Name || container_name_in_folder,
                icon: ct.Labels?.['net.unraid.docker.icon'] || '/plugins/dynamix.docker.manager/images/question.png',
                webui: ct.info.State.WebUi || ct.info.State.TSWebUi || '',
                shell: ct.info.Shell || '/bin/sh',
                pause: ct.info.State.Paused,
                state: ct.info.State.Running,
                autostart: !(ct.info.State.Autostart === false),
                update: ct.info.State.Updated === false && ct.info.State.manager === 'dockerman',
                managed: ct.info.State.manager === 'dockerman',
                manager: ct.info.State.manager
            };
            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}), container ${container_name_in_folder}: Stored in newFolder:`, JSON.parse(JSON.stringify(newFolder[container_name_in_folder])));

            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}), container ${container_name_in_folder}: Container info (ct):`, JSON.parse(JSON.stringify(ct)));


            let CPU = []; let MEM = []; let charts = []; let tootltipObserver;
            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}), container ${container_name_in_folder}: Initialized CPU, MEM, charts, tootltipObserver for tooltip.`);
            const graphListener = (e) => {
                if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] graphListener (for ct: ${ct.shortId}): Received message:`, e.data ? e.data : e); // SSE e.data
                let now = Date.now();
                try {
                    let dataToParse = e.data ? e.data : e; // Handle SSE vs direct string
                    let loadMatch = dataToParse.match(new RegExp(`^${ct.shortId}\;.*\;.*\ \/\ .*$`, 'm'));
                    if (!loadMatch) {
                        if (FOLDER_VIEW_DEBUG_MODE) console.warn(`[FV3_DEBUG] graphListener (for ct: ${ct.shortId}): No match for regex. Data: `, dataToParse);
                        CPU.push({ x: now, y: 0 });
                        MEM.push({ x: now, y: 0 });
                        return;
                    }
                    let load = loadMatch[0].split(';');
                    load = {
                        cpu: parseFloat(load[1].replace('%', ''))/cpus,
                        mem: load[2].split(' / ')
                    }
                    load.mem = memToB(load.mem[0]) / memToB(load.mem[1]) * 100;
                    CPU.push({
                        x: now,
                        y: load.cpu
                    });
                    MEM.push({
                        x: now,
                        y: load.mem
                    });
                    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] graphListener (for ct: ${ct.shortId}): Parsed load:`, {cpu: load.cpu, mem: load.mem}, "Pushed to CPU/MEM arrays.");
                } catch (error) {
                    if (FOLDER_VIEW_DEBUG_MODE) console.error(`[FV3_DEBUG] graphListener (for ct: ${ct.shortId}): Error parsing load data.`, error, "Original data:", e.data ? e.data : e);
                    CPU.push({
                        x: now,
                        y: 0
                    });
                    MEM.push({
                        x: now,
                        y: 0
                    });
                }

                for (const chart of charts) {
                    chart.update('quiet');
                }
                 if (FOLDER_VIEW_DEBUG_MODE && charts.length > 0) console.log(`[FV3_DEBUG] graphListener (for ct: ${ct.shortId}): Updated ${charts.length} charts.`);
            };

            const tooltip_trigger_element = addPreview(id, ct.shortId, !(ct.info.State.Autostart === false), newFolder[container_name_in_folder], $containerTR);
            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}), container ${ct.shortId}: Called addPreview. Returned tooltip_trigger_element:`, tooltip_trigger_element ? tooltip_trigger_element[0] : 'null/undefined');
        
            $(`tr.folder-id-${id} div.folder-preview span.inner > span.appname`).css("width", folder.settings.preview_text_width || '');
            if (FOLDER_VIEW_DEBUG_MODE && folder.settings.preview_text_width) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Set preview text width to ${folder.settings.preview_text_width}.`);

            if(DOCKER_PREVIEW_POPUP_ENABLED && tooltip_trigger_element && tooltip_trigger_element.length > 0) {
                if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}), container ${ct.shortId}: tooltip_trigger_element is valid. Deferring tooltipster initialization until first interaction.`);
                const triggerMode = folder.settings.context_trigger === 1 && !FOLDER_VIEW_TOUCH_MODE ? 'hover' : 'click';
                initializeDockerTooltipOnDemand($(tooltip_trigger_element), () => $(tooltip_trigger_element).tooltipster({
                    interactive: true,
                    theme: ['tooltipster-docker-folder'],
                    trigger: triggerMode,
                    zIndex: 99998,
                    // --- START OF MODIFIED functionBefore ---
                    functionBefore: function(instance, helper) {
                        // instance: The Tooltipster instance.
                        // helper: An object, helper.origin is the triggering element.
                        const origin = helper.origin; // Get the triggering element
                        const originElement = origin && origin.length ? origin : $(origin);
                        const lazyBuilt = originElement.data('fvTooltipLazyBuilt') === true;
                        if (!lazyBuilt) {
                            instance.content(buildDockerTooltipContent(ct));
                            originElement.data('fvTooltipLazyBuilt', true);
                        }

                        if (FOLDER_VIEW_DEBUG_MODE) {
                            console.log(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): functionBefore. Instance:`, instance, "Helper:", helper, "Origin:", origin);
                            console.log(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): Current folder settings for context:`, {...folder.settings});
                        }

                        // Dispatch your custom event
                        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): Dispatching docker-tooltip-before event.`);
                        folderEvents.dispatchEvent(new CustomEvent('docker-tooltip-before', {detail: {
                            folder: folder,
                            id: id, // Folder ID
                            containerInfo: ct, // Container info
                            origin: origin,
                            charts: charts, 
                            stats: {
                                CPU: CPU, 
                                MEM: MEM
                            }
                        }}));

                        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): functionBefore completed. Allowing tooltip to proceed by default.`);
                        // By not returning false, Tooltipster should proceed.
                    },
                    functionReady: function(instance, helper) {
                        // instance: The Tooltipster instance
                        // helper: An object with helper.origin (trigger element) and helper.tooltip (tooltip DOM element)

                        const triggerOriginEl = helper.origin;  // This is the jQuery object of the element that triggered the tooltip
                        const tooltipDomEl = helper.tooltip;  // This is the jQuery object of the tooltip's outermost DOM element

                        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): functionReady. Instance:`, instance, "Helper:", helper, "Trigger Origin Element:", triggerOriginEl[0], "Tooltip DOM Element:", tooltipDomEl[0]);
                        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): Dispatching docker-tooltip-ready-start event.`);
                        
                        folderEvents.dispatchEvent(new CustomEvent('docker-tooltip-ready-start', {detail: {
                            folder: folder,
                            id: id,
                            containerInfo: ct,
                            origin: triggerOriginEl,
                            tooltip: tooltipDomEl,
                            charts,
                            stats: {
                                CPU,
                                MEM
                            }
                        }}));
                        
                        let diabled = [];
                        let active = 0;
                        const options = {
                            scales: {
                                x: {
                                    type: 'realtime',
                                    realtime: {
                                        duration: 1000*(folder.settings.context_graph_time || 60),
                                        refresh: 1000, 
                                        delay: 1000 
                                    },
                                    time: {
                                        tooltipFormat: 'dd MMM, yyyy, HH:mm:ss',
                                        displayFormats: {
                                            millisecond: 'H:mm:ss.SSS',
                                            second: 'H:mm:ss',
                                            minute: 'H:mm',
                                            hour: 'H',
                                            day: 'MMM D',
                                            week: 'll',
                                            month: 'MMM YYYY',
                                            quarter: '[Q]Q - YYYY',
                                            year: 'YYYY'
                                        },
                                    },
                                },
                                y: {
                                    min: 0,
                                }
                            },
                            interaction: {
                                intersect: false,
                                mode: 'index',
                            },
                            plugins: {
                                tooltip: {
                                    position: 'nearest'
                                }
                            }
                        };
                        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): Chart.js options:`, options, "Graph mode setting:", folder.settings.context_graph);

                        charts = []; 
                        switch (folder.settings.context_graph) {
                            case 0: 
                                if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): Graph mode 0 (None).`);
                                diabled = [0, 1, 2]; 
                                active = 3; 
                                break;
                            case 2: 
                                if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): Graph mode 2 (Split). Creating CPU and MEM charts.`);
                                diabled = [0]; 
                                active = 1; 
                                try {
                                    charts.push(new Chart($(`.cpu-grapth-${ct.shortId} > canvas`, tooltipDomEl).get(0), { 
                                        type: 'line',
                                        data: { datasets: [ { label: 'CPU', data: CPU, borderColor: getComputedStyle(document.documentElement).getPropertyValue('--folder-view3-graph-cpu'), backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--folder-view3-graph-cpu'), tension: 0.4, pointRadius: 0, borderWidth: 1 } ] },
                                        options: options
                                    }));
                                    charts.push(new Chart($(`.mem-grapth-${ct.shortId} > canvas`, tooltipDomEl).get(0), { 
                                        type: 'line',
                                        data: { datasets: [ { label: 'MEM', data: MEM, borderColor: getComputedStyle(document.documentElement).getPropertyValue('--folder-view3-graph-mem'), backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--folder-view3-graph-mem'), tension: 0.4, pointRadius: 0, borderWidth: 1 } ] },
                                        options: options
                                    }));
                                     if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): Split charts created. CPU canvas:`, $(`.cpu-grapth-${ct.shortId} > canvas`, tooltipDomEl).get(0), "MEM canvas:", $(`.mem-grapth-${ct.shortId} > canvas`, tooltipDomEl).get(0));
                                } catch(e) {
                                    if (FOLDER_VIEW_DEBUG_MODE) console.error(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): Error creating split charts:`, e);
                                }
                                break;
                            case 3: 
                                 if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): Graph mode 3 (CPU only). Creating CPU chart.`);
                                diabled = [0, 2]; 
                                active = 1; 
                                try {
                                    charts.push(new Chart($(`.cpu-grapth-${ct.shortId} > canvas`, tooltipDomEl).get(0), { 
                                        type: 'line',
                                        data: { datasets: [ { label: 'CPU', data: CPU, borderColor: getComputedStyle(document.documentElement).getPropertyValue('--folder-view3-graph-cpu'), backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--folder-view3-graph-cpu'), tension: 0.4, pointRadius: 0, borderWidth: 1 } ] },
                                        options: options
                                    }));
                                     if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): CPU chart created. Canvas:`, $(`.cpu-grapth-${ct.shortId} > canvas`, tooltipDomEl).get(0));
                                } catch(e) {
                                     if (FOLDER_VIEW_DEBUG_MODE) console.error(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): Error creating CPU chart:`, e);
                                }
                                break;
                            case 4: 
                                if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): Graph mode 4 (MEM only). Creating MEM chart.`);
                                diabled = [0, 1]; 
                                active = 2; 
                                try {
                                    charts.push(new Chart($(`.mem-grapth-${ct.shortId} > canvas`, tooltipDomEl).get(0), { 
                                        type: 'line',
                                        data: { datasets: [ { label: 'MEM', data: MEM, borderColor: getComputedStyle(document.documentElement).getPropertyValue('--folder-view3-graph-mem'), backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--folder-view3-graph-mem'), tension: 0.4, pointRadius: 0, borderWidth: 1 } ] },
                                        options: options
                                    }));
                                    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): MEM chart created. Canvas:`, $(`.mem-grapth-${ct.shortId} > canvas`, tooltipDomEl).get(0));
                                } catch(e) {
                                    if (FOLDER_VIEW_DEBUG_MODE) console.error(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): Error creating MEM chart:`, e);
                                }
                                break;
                            case 1: 
                            default:
                                if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): Graph mode 1 (Combined) or default. Creating combined chart.`);
                                diabled = [1, 2]; 
                                active = 0; 
                                try {
                                    charts.push(new Chart($(`.comb-grapth-${ct.shortId} > canvas`, tooltipDomEl).get(0), { 
                                        type: 'line',
                                        data: {
                                            datasets: [
                                                { label: 'CPU', data: CPU, borderColor: getComputedStyle(document.documentElement).getPropertyValue('--folder-view3-graph-cpu'), backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--folder-view3-graph-cpu'), tension: 0.4, pointRadius: 0, borderWidth: 1 },
                                                { label: 'MEM', data: MEM, borderColor: getComputedStyle(document.documentElement).getPropertyValue('--folder-view3-graph-mem'), backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--folder-view3-graph-mem'), tension: 0.4, pointRadius: 0, borderWidth: 1 }
                                            ]
                                        },
                                        options: options
                                    }));
                                    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): Combined chart created. Canvas:`, $(`.comb-grapth-${ct.shortId} > canvas`, tooltipDomEl).get(0));
                                } catch(e) {
                                     if (FOLDER_VIEW_DEBUG_MODE) console.error(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): Error creating combined chart:`, e);
                                }
                                break;
                        };
                        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): Tab states: disabled=${diabled}, active=${active}. Charts array length: ${charts.length}`);

                        if (FOLDER_VIEW_DEBUG_MODE) {
                            console.log(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): Canvas check inside functionReady:`);
                            console.log(`  .comb-grapth-${ct.shortId} > canvas:`, $(`.comb-grapth-${ct.shortId} > canvas`, tooltipDomEl).length);
                            console.log(`  .cpu-grapth-${ct.shortId} > canvas:`, $(`.cpu-grapth-${ct.shortId} > canvas`, tooltipDomEl).length);
                            console.log(`  .mem-grapth-${ct.shortId} > canvas:`, $(`.mem-grapth-${ct.shortId} > canvas`, tooltipDomEl).length);
                        }

                        tootltipObserver = new MutationObserver((mutationList, observer) => {
                            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] tootltipObserver (for ct: ${ct.shortId}): Mutation observed for CPU text.`, mutationList);
                            for (const mutation of mutationList) {
                                $(`.preview-outbox-${ct.shortId} span#cpu-${ct.shortId}`, tooltipDomEl).css('width',  mutation.target.textContent) 
                            }
                        });

                        const cpuTextElement = $(`.preview-outbox-${ct.shortId} span.cpu-${ct.shortId}`, tooltipDomEl).get(0); 
                        if (cpuTextElement) {
                            tootltipObserver.observe(cpuTextElement, {childList: true});
                            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): tootltipObserver observing CPU text element.`, cpuTextElement);
                        } else {
                            if (FOLDER_VIEW_DEBUG_MODE) console.warn(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): CPU text element for tootltipObserver not found.`);
                        }

                        if($(`.preview-outbox-${ct.shortId} .status-autostart`, tooltipDomEl).children().length === 1) { 
                            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): Initializing switchButton and tabs for tooltip content.`);
                            $(`.preview-outbox-${ct.shortId} .status-autostart > input[type='checkbox']`, tooltipDomEl).switchButton({ labels_placement: 'right', off_label: $.i18n('off'), on_label: $.i18n('on'), checked: !(ct.info.State.Autostart === false) }); 
                            $(`.preview-outbox-${ct.shortId} .info-section`, tooltipDomEl).tabs({ 
                                heightStyle: 'auto',
                                disabled: diabled,
                                active: active
                            });
                            $(`.preview-outbox-${ct.shortId} table > tbody div.status-autostart > input[type="checkbox"]`, tooltipDomEl).on("change", advancedAutostart); 
                        } else {
                             if (FOLDER_VIEW_DEBUG_MODE) console.warn(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): Autostart switch placeholder not found as expected in tooltip.`);
                        }

                        dockerload.addEventListener('message', graphListener);
                        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): Added graphListener to dockerload SSE.`);

                        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): Dispatching docker-tooltip-ready-end event.`);
                        folderEvents.dispatchEvent(new CustomEvent('docker-tooltip-ready-end', {detail: {
                            folder: folder,
                            id: id,
                            containerInfo: ct,
                            origin: triggerOriginEl,
                            tooltip: tooltipDomEl,
                            charts,
                            tootltipObserver,
                            stats: {
                                CPU,
                                MEM
                            }
                        }}));
                    },
                    functionAfter: function(instance, helper) {
                        const origin = helper.origin;
                        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): functionAfter. Instance:`, instance, "Helper:", helper, "Origin:", origin);
                        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): Dispatching docker-tooltip-after event.`);
                        folderEvents.dispatchEvent(new CustomEvent('docker-tooltip-after', {detail: {
                            folder: folder,
                            id: id,
                            containerInfo: ct,
                            origin: origin,
                            charts, 
                            tootltipObserver,
                            stats: { 
                                CPU,
                                MEM
                            }
                        }}));
                        dockerload.removeEventListener('message', graphListener);
                        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): Removed graphListener from dockerload SSE.`);
                        for (const chart of charts) {
                            chart.destroy();
                        }
                        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): Destroyed ${charts.length} charts.`);
                        charts = []; 
                        if (tootltipObserver) {
                            tootltipObserver.disconnect();
                            tootltipObserver = undefined;
                            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): Disconnected and cleared tootltipObserver.`);
                        }
                    },
                    content: $('<div class="fv-tooltip-lazy-loading">Loading preview...</div>')
                }), triggerMode === 'hover');
            } else if (FOLDER_VIEW_DEBUG_MODE && tooltip_trigger_element && tooltip_trigger_element.length > 0) {
                console.log(`[FV3_DEBUG] createFolder (id: ${id}), container ${ct.shortId}: FolderView preview popup runtime is disabled; skipping tooltip initialization.`);
            } else {
                 if (FOLDER_VIEW_DEBUG_MODE) console.warn(`[FV3_DEBUG] createFolder (id: ${id}), container ${ct.shortId}: tooltip_trigger_element is NOT valid. Tooltipster NOT initialized. This is likely the problem if folder.settings.context === 2.`);
            }

            const elementForPreviewOpts = $(`tr.folder-id-${id} div.folder-preview > span:last`); // Re-check if this is always correct
            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}), container ${container_name_in_folder}: Preview element for options:`, elementForPreviewOpts[0]);
            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}), container ${container_name_in_folder}: Applying preview options based on folder.settings:`, JSON.parse(JSON.stringify(folder.settings)));
         
            const $previewElementTarget = $(`tr.folder-id-${id} div.folder-preview > span:last`); // Or elementForPreviewOpts if you prefer
            let $targetForAppend; // Used for WebUI, Console, Logs icons
            const previewMode = Number(folder?.settings?.preview || 0);
            const previewStateMeta = getPreviewContainerStatusMeta(newFolder[container_name_in_folder]);
            const previewStatusTitle = escapeHtml($.i18n(previewStateMeta.key));

            if (!compactMultiRowPreview && (previewMode === 3 || previewMode === 4) && $previewElementTarget.length) {
                const $previewAppName = $previewElementTarget.find('span.appname > a.exec').first();
                if ($previewAppName.length) {
                    $previewAppName.addClass('fv-preview-status-name').addClass(previewStateMeta.className);
                    if (!$previewAppName.children('.fv-preview-status-inline').length) {
                        $previewAppName.prepend(
                            $(`<span class="fv-preview-status-inline ${previewStateMeta.className}" title="${previewStatusTitle}" aria-hidden="true"><i class="fa ${previewStateMeta.icon}"></i></span>`)
                        );
                    }
                }
            }

            if (folder.settings.preview_grayscale) {
                let $imgToGrayscale = $previewElementTarget.children('span.hand').children('img.img');
                if (!$imgToGrayscale.length) {
                    $imgToGrayscale = $previewElementTarget.children('img.img');
                }
                if ($imgToGrayscale.length) {
                    $imgToGrayscale.css('filter', 'grayscale(100%)');
                    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}), container ${container_name_in_folder}: Applied grayscale to preview image.`);
                } else {
                    if (FOLDER_VIEW_DEBUG_MODE) console.warn(`[FV3_DEBUG] createFolder (id: ${id}), container ${container_name_in_folder}: Grayscale: Could not find image in preview element.`);
                }
            }

            if (folder.settings.preview_update && ct.info.State.Updated === false && ct.info.State.manager === "dockerman") {
                let $appNameSpan = $previewElementTarget.children('span.inner').children('span.appname');
                if (!$appNameSpan.length) {
                    $appNameSpan = $previewElementTarget.children('span.appname');
                }
                if ($appNameSpan.length) {
                    $appNameSpan.addClass('orange-text');
                    $appNameSpan.children('a.exec').addClass('orange-text');
                    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}), container ${container_name_in_folder}: Applied orange-text for update status to preview appname.`);
                } else {
                     if (FOLDER_VIEW_DEBUG_MODE) console.warn(`[FV3_DEBUG] createFolder (id: ${id}), container ${container_name_in_folder}: Update style: Could not find appname span in preview element.`);
                }
            }

            // Determine the element to append WebUI/Console/Logs icons to
            $targetForAppend = compactMultiRowPreview
                ? $previewElementTarget.find('.fv-preview-actions-compact').first()
                : $previewElementTarget.children('span.inner').last();
            if (!$targetForAppend.length) {
                $targetForAppend = $previewElementTarget;
            }

            const previewWebuiUrl = getSafeWebuiUrl(newFolder[container_name_in_folder]?.webui || ct.info.State.WebUi || ct.info.State.TSWebUi || '');
            if ($targetForAppend.length) {
                appendDockerPreviewActionButtons($targetForAppend, folder.settings, ct.info.Name, ct.info.Shell, previewWebuiUrl);
            }

            upToDate = upToDate && !newFolder[container_name_in_folder].update;
            if (newFolder[container_name_in_folder].state) {
                if (newFolder[container_name_in_folder].pause) {
                    paused += 1;
                } else {
                    started += 1;
                }
            } else {
                stopped += 1;
            }
            const isDockerMan = ct.info.State.manager === 'dockerman';
            autostart += (isDockerMan && !(ct.info.State.Autostart === false)) ? 1 : 0;
            autostartStarted += (isDockerMan && !(ct.info.State.Autostart === false) && newFolder[container_name_in_folder].state) ? 1 : 0;
            managed += newFolder[container_name_in_folder].managed ? 1 : 0;
            managerTypes.add(ct.info.State.manager);
            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}), container ${container_name_in_folder}: Updated folder aggregate states:`, { upToDate, started, autostart, autostartStarted, managed, managerTypes: Array.from(managerTypes) });
            folderEvents.dispatchEvent(new CustomEvent('docker-post-folder-preview', {detail: {
                folder: folder,
                id: id,
                position: positionInMainOrder,
                order: liveOrderArray,
                containersInfo: containersInfo,
                foldersDone: foldersDone, // Original foldersDone
                container: container_name_in_folder,
                ct: ct,
                index: indexInCustomOrder,
                offsetIndex: indexInLiveOrderArray,
                states: {
                    upToDate,
                    started,
                    autostart,
                    autostartStarted,
                    managed
                }
            }}));
        } else {
            if (FOLDER_VIEW_DEBUG_MODE) console.warn(`[FV3_DEBUG] createFolder (id: ${id}): Container TR for '${container_name_in_folder}' NOT FOUND in the sortable list. It might have been moved by another folder or an error occurred. Skipping.`);
        }
    }
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Finished loop over combinedContainers. Final remBefore for this folder = ${remBefore}`);

    $(`.folder-${id}-element:last`).css('border-bottom', '1px solid rgba(128, 128, 128, 0.3)');
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Set border-bottom on last .folder-${id}-element.`);
    folder.containers = newFolder;
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Replaced folder.containers with newFolder:`, JSON.parse(JSON.stringify(newFolder)));
    syncDockerFolderMemberRows(id, newFolder);

    $(`tr.folder-id-${id} div.folder-storage i[id^="load-"]`).get().forEach((e) => {
        folderobserver.observe(e, folderobserverConfig);
    });
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Attached folderobserver to .folder-storage load icons.`);
    $(`tr.folder-id-${id} div.folder-preview > span`).wrap('<div class="folder-preview-wrapper"></div>');
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Wrapped preview spans with .folder-preview-wrapper.`);
    applyFolderPreviewLayout($(`tr.folder-id-${id} div.folder-preview`), folder.settings);
    layoutFolderPreviewRows($(`tr.folder-id-${id} div.folder-preview`), folder.settings);
    if (FOLDER_VIEW_DEBUG_MODE && folder.settings.preview_vertical_bars) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Added preview_vertical_bars.`);
    if(folder.settings.update_column) {
        $(`tr.folder-id-${id} > td.updatecolumn`).next().attr('colspan',6).end().remove();
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Handled update_column setting (removed column).`);
    }
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Setting folder status indicators based on aggregate states. managerTypes:`, Array.from(managerTypes));
    renderFolderUpdateColumn(id, $(`tr.folder-id-${id} > td.updatecolumn`), managerTypes, upToDate, managed);
    const total = Object.entries(folder.containers).length;
    if (folderTypePrefs?.hideEmptyFolders === true && total === 0) {
        $(`tr.folder-id-${id}`).remove();
        $(`tr#name-${id}`).remove();
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): hideEmptyFolders enabled, removed empty folder row.`);
        return remBefore;
    }
    const $folderRow = $(`tr.folder-id-${id}`);
    applyFolderStatusColorOverrides($folderRow, folder.settings);
    applyFolderAccentStyle($folderRow, folder.settings);
    applyFolderDropdownStyle($folderRow, folder.settings);
    const $folderIcon = $folderRow.find(`i#load-folder-${id}`);
    const $folderState = $folderRow.find('span.folder-state');
    $folderState.removeClass('fv-folder-state-started fv-folder-state-paused fv-folder-state-stopped');
    $folderIcon.show();
    let folderStatusKind = 'stopped';
    if (started > 0) {
        folderStatusKind = 'running';
        $folderIcon.attr('class', 'fa fa-play started folder-load-status');
        $folderState.text(`${started}/${total} ${$.i18n('started')}`).addClass('fv-folder-state-started');
    } else if (paused > 0) {
        folderStatusKind = 'paused';
        $folderIcon.attr('class', 'fa fa-pause paused folder-load-status');
        $folderState.text(`${paused}/${total} ${$.i18n('paused')}`).addClass('fv-folder-state-paused');
    } else {
        folderStatusKind = 'stopped';
        $folderIcon.attr('class', 'fa fa-square stopped folder-load-status');
        $folderState.text(`${stopped}/${total} ${$.i18n('stopped')}`).addClass('fv-folder-state-stopped');
    }
    const badgePrefs = folderTypePrefs?.badges || {};
    const showRunningBadge = badgePrefs.running !== false;
    const showStoppedBadge = badgePrefs.stopped === true;
    const showUpdateBadge = badgePrefs.updates !== false;

    if (!showUpdateBadge && !folder.settings.update_column) {
        $(`tr.folder-id-${id} > td.updatecolumn`).next().attr('colspan', 6).end().remove();
    }

    if (folderStatusKind === 'running' && !showRunningBadge) {
        $(`tr.folder-id-${id} i#load-folder-${id}`).hide();
    }
    if (folderStatusKind === 'stopped' && !showStoppedBadge) {
        $(`tr.folder-id-${id} i#load-folder-${id}`).hide();
    }

    if (!managerTypes.has('dockerman')) {
        $(`tr.folder-id-${id} td.folder-autostart`).empty();
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): No dockerman containers — removed autostart toggle.`);
    } else {
        const folderHasAutostart = autostart > 0;
        $(`#folder-${id}-auto`).switchButton({ labels_placement: 'right', off_label: $.i18n('off'), on_label: $.i18n('on'), checked: folderHasAutostart });
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Initialized autostart switchButton with checked=${folderHasAutostart}. Autostart count: ${autostart}`);
        $(`#folder-${id}-auto`).off("change", folderAutostart).on("change", folderAutostart);
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Attached 'change' event to folder autostart switch.`);
    }

    if(autostart === 0) { $(`tr.folder-id-${id}`).addClass('no-autostart'); }
    else if (autostart > 0 && autostartStarted === 0) { $(`tr.folder-id-${id}`).addClass('autostart-off'); }
    else if (autostart > 0 && autostartStarted > 0 && autostart !== autostartStarted) { $(`tr.folder-id-${id}`).addClass('autostart-partial'); }
    else if (autostart > 0 && autostartStarted > 0 && autostart === autostartStarted) { $(`tr.folder-id-${id}`).addClass('autostart-full'); }
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Applied autostart status class. Autostart: ${autostart}, AutostartStarted: ${autostartStarted}.`);

    if(managed === 0) { $(`tr.folder-id-${id}`).addClass('no-managed'); }
    else if (managed > 0 && managed < Object.values(folder.containers).length) { $(`tr.folder-id-${id}`).addClass('managed-partial'); }
    else if (managed > 0 && managed === Object.values(folder.containers).length) { $(`tr.folder-id-${id}`).addClass('managed-full'); }
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Applied managed status class. Managed: ${managed}, Total: ${Object.values(folder.containers).length}.`);

    folder.status = { upToDate, started, paused, stopped, autostart, autostartStarted, managed, managerTypes: Array.from(managerTypes), expanded: false };
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Set final folder.status object:`, JSON.parse(JSON.stringify(folder.status)));
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Dispatching docker-post-folder-creation event.`);
    folderEvents.dispatchEvent(new CustomEvent('docker-post-folder-creation', {detail: {
        folder: folder,
        id: id,
        position: positionInMainOrder,
        order: liveOrderArray,
        containersInfo: containersInfo,
        foldersDone: foldersDone
    }}));

    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Exit. Returning remBefore = ${remBefore}`);
    return remBefore;
    } finally {
        dockerPerf.end(perfKey, { id });
    }
};

const forceCollapseFolderRow = (id, syncStatus = true) => {
    const element = $(`.dropDown-${id}`);
    if (element.length) {
        element.children().removeClass('fa-chevron-up').addClass('fa-chevron-down');
        element.attr('active', 'false');
    }
    const $folderRow = $(`tr.folder-id-${id}`);
    $folderRow.addClass('sortable');
    const $directRows = getDirectMemberRowsForFolder(id);
    const $fallbackRows = $(`.folder-${id}-element`);
    const $rowsToMove = $directRows.length ? $directRows : $fallbackRows;
    $folderRow.find('.folder-storage').append($rowsToMove);
    $rowsToMove.addClass('fv-nested-hidden').hide();
    if (syncStatus && globalFolders[id] && globalFolders[id].status) {
        globalFolders[id].status.expanded = false;
    }
};

const getDirectMemberRowsForFolder = (folderId) => {
    const id = String(folderId || '').trim();
    if (!id) {
        return $();
    }
    const className = `folder-${id}-element`;
    const directContainerNames = new Set(Object.keys(buildRuntimeContainerMapForFolder(id, false)));
    if (!directContainerNames.size) {
        return $(`tr.${className}`);
    }
    const $folderRow = $(`tr.folder-id-${id}`);
    const $storage = $folderRow.find('.folder-storage').first();
    const getRowContainerName = (row) => {
        if (!row) return '';
        const idAttr = String(row.id || '').trim();
        if (idAttr.startsWith('ct-') && idAttr.length > 3) {
            return idAttr.slice(3).trim();
        }
        return String($(row).find('td.ct-name .appname').first().text() || '').trim();
    };

    // Recover missing class tags from this folder's storage using direct membership.
    if ($storage.length) {
        $storage.children('tr').each((_, row) => {
            const name = getRowContainerName(row);
            if (directContainerNames.has(name)) {
                row.classList.add(className, 'folder-element');
            }
        });
    }

    // Keep canonical rows recoverable by ID even if class tags drift.
    for (const name of directContainerNames) {
        const row = document.getElementById(`ct-${name}`);
        if (row && row.tagName === 'TR' && !row.classList.contains(className)) {
            const hasOtherFolderClass = String(row.className || '')
                .split(/\s+/)
                .some((entry) => entry.startsWith('folder-') && entry.endsWith('-element'));
            if (!hasOtherFolderClass) {
                row.classList.add(className, 'folder-element');
                if ($storage.length) {
                    $storage.append(row);
                }
            }
        }
    }
    return $(`tr.${className}`).filter((_, row) => directContainerNames.has(getRowContainerName(row)));
};

const buildRuntimeContainerMapForFolder = (folderId, includeDescendants = false) => {
    const runtimeInfoApi = getDockerRuntimeInfoApi();
    return runtimeInfoApi && typeof runtimeInfoApi.buildRuntimeContainerMapForFolder === 'function'
        ? runtimeInfoApi.buildRuntimeContainerMapForFolder(folderId, includeDescendants)
        : {};
};

const updateFolderRowStatusFromContainers = (id, folder, runtimeContainers) => {
    const hierarchyApi = getDockerRuntimeHierarchyApi();
    if (hierarchyApi && typeof hierarchyApi.updateFolderRowStatusFromContainers === 'function') {
        hierarchyApi.updateFolderRowStatusFromContainers(id, folder, runtimeContainers);
    }
};

const appendDockerPreviewActionButtons = ($target, settings = {}, containerName = '', shellValue = '/bin/sh', webuiUrl = '') => {
    const previewActionsApi = getDockerPreviewActionsApi();
    if (previewActionsApi && typeof previewActionsApi.appendDockerPreviewActionButtons === 'function') {
        previewActionsApi.appendDockerPreviewActionButtons($target, settings, containerName, shellValue, webuiUrl);
    }
};

const syncDockerLeafFolderPreviewActions = (id, folder, runtimeContainers) => {
    const previewActionsApi = getDockerPreviewActionsApi();
    if (previewActionsApi && typeof previewActionsApi.syncDockerLeafFolderPreviewActions === 'function') {
        previewActionsApi.syncDockerLeafFolderPreviewActions(id, folder, runtimeContainers);
    }
};

const syncDockerFolderMemberRows = (id, runtimeContainers) => {
    const previewActionsApi = getDockerPreviewActionsApi();
    if (previewActionsApi && typeof previewActionsApi.syncDockerFolderMemberRows === 'function') {
        previewActionsApi.syncDockerFolderMemberRows(id, runtimeContainers);
    }
};

const syncParentFolderVisualState = (id, expanded) => {
    const hierarchyApi = getDockerRuntimeHierarchyApi();
    if (hierarchyApi && typeof hierarchyApi.syncParentFolderVisualState === 'function') {
        hierarchyApi.syncParentFolderVisualState(id, expanded);
    }
};

const applyNestedFolderHierarchy = () => {
    const hierarchyApi = getDockerRuntimeHierarchyApi();
    if (hierarchyApi && typeof hierarchyApi.applyNestedFolderHierarchy === 'function') {
        hierarchyApi.applyNestedFolderHierarchy();
    }
};

/**
 * Function to hide all tooltips
 */
const hideAllTips = () => {
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] hideAllTips: Entry');
    let tips = $.tooltipster.instances();
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] hideAllTips: Found tooltipster instances:', tips.length);
    $.each(tips, function(i, instance){
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] hideAllTips: Closing instance ${i}`);
        instance.close();
    });
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] hideAllTips: Exit');
};

/**
 * Function to set the atuostart of a container in the advanced tooltip
 * @param {*} el element passed by the event caller
 */
const advancedAutostart = (el) => {
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] advancedAutostart: Entry. Event target:', el.target);
    const outbox = $(el.target).parents('.preview-outbox')[0];
    const ctid = outbox.className.match(/preview-outbox-([a-zA-Z0-9]+)/)[1]; // Ensure ctid is captured correctly
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] advancedAutostart: outbox:', outbox, `ctid: ${ctid}`);
    $(`#${ctid}`).parents('.folder-element').find('.switch-button-background').click();
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] advancedAutostart: Clicked main autostart switch for container ${ctid}. Exit.`);
};

/**
 * Hanled the click of the autostart button and changes the container to reflect the status of the folder
 * @param {*} el element passed by the event caller
 */
const folderAutostart = async (el) => {
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] folderAutostart: Entry. Event target:', el.target);
    const status = el.target.checked;
    const id = el.target.id.split('-')[1];
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderAutostart: Folder ID: ${id}, New Status: ${status}`);
    const containers = getDirectMemberRowsForFolder(id);
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderAutostart: Found ${containers.length} containers in folder ${id}.`);
    for (const container of containers) {
        const switchTd = $(container).children('td.advanced').next();
        const containerAutostartCheckbox = $(switchTd).find('input.autostart')[0];
        if (containerAutostartCheckbox) {
            const cstatus = containerAutostartCheckbox.checked;
            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderAutostart: Container ${$(container).find('.appname a').text().trim() || 'N/A'}: current autostart=${cstatus}. Folder target status=${status}`);
            if (status !== cstatus) {
                if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderAutostart: Clicking autostart switch for container.`);
                $(switchTd).children('.switch-button-background').click();
                await new Promise(resolve => {
                    const timeout = setTimeout(resolve, 3000);
                    $(document).one('ajaxComplete', () => { clearTimeout(timeout); resolve(); });
                });
            }
        } else {
            if (FOLDER_VIEW_DEBUG_MODE) console.warn(`[FV3_DEBUG] folderAutostart: Could not find autostart checkbox for a container in folder ${id}. TD element:`, switchTd[0]);
        }
    }
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderAutostart (id: ${id}): Exit.`);
};

/**
 * Handle the dropdown expand button of folders
 * @param {string} id the id of the folder
 */
const dropDownButton = (id, persistState = true) => {
    const hierarchyApi = getDockerRuntimeHierarchyApi();
    if (hierarchyApi && typeof hierarchyApi.dropDownButton === 'function') {
        hierarchyApi.dropDownButton(id, persistState);
    }
};

/**
 * Removie the folder
 * @param {string} id the id of the folder
 */
const rmFolder = (id) => {
    const actionsApi = getDockerRuntimeActionsApi();
    if (actionsApi && typeof actionsApi.rmFolder === 'function') {
        actionsApi.rmFolder(id);
    }
};

const rmFolderBranch = (id) => {
    const actionsApi = getDockerRuntimeActionsApi();
    if (actionsApi && typeof actionsApi.rmFolderBranch === 'function') {
        actionsApi.rmFolderBranch(id);
    }
};

/**
 * Redirect to the page to edit the folder
 * @param {string} id the id of the folder
 */
const clearFolderEditorPrefill = () => {
    const actionsApi = getDockerRuntimeActionsApi();
    if (actionsApi && typeof actionsApi.clearFolderEditorPrefill === 'function') {
        actionsApi.clearFolderEditorPrefill();
    }
};
const buildDockerFolderEditorUrl = (id = '') => {
    const actionsApi = getDockerRuntimeActionsApi();
    return actionsApi && typeof actionsApi.buildDockerFolderEditorUrl === 'function'
        ? actionsApi.buildDockerFolderEditorUrl(id)
        : `/Docker/Folder?type=docker&_=${String(Date.now())}#type=docker`;
};
const editFolder = (id) => {
    const actionsApi = getDockerRuntimeActionsApi();
    if (actionsApi && typeof actionsApi.editFolder === 'function') {
        actionsApi.editFolder(id);
    }
};

/**
 * Force update all the containers inside a folder
 * @param {string} id the id of the folder
 */
const forceUpdateFolder = (id, { includeDescendants = true } = {}) => {
    const actionsApi = getDockerRuntimeActionsApi();
    if (actionsApi && typeof actionsApi.forceUpdateFolder === 'function') {
        actionsApi.forceUpdateFolder(id, { includeDescendants });
    }
};

/**
 * Update all the updatable containers inside a folder
 * @param {string} id the id of the folder
 */
const updateFolder = (id, { includeDescendants = true } = {}) => {
    const actionsApi = getDockerRuntimeActionsApi();
    if (actionsApi && typeof actionsApi.updateFolder === 'function') {
        actionsApi.updateFolder(id, { includeDescendants });
    }
};

const collectFolderWebuiTargets = (id, includeDescendants = true, runningOnly = true) => {
    const actionsApi = getDockerRuntimeActionsApi();
    return actionsApi && typeof actionsApi.collectFolderWebuiTargets === 'function'
        ? actionsApi.collectFolderWebuiTargets(id, includeDescendants, runningOnly)
        : [];
};

const openFolderWebuisFromMenu = (id, runningOnly = true, includeDescendants = false) => {
    const actionsApi = getDockerRuntimeActionsApi();
    if (actionsApi && typeof actionsApi.openFolderWebuisFromMenu === 'function') {
        actionsApi.openFolderWebuisFromMenu(id, runningOnly, includeDescendants);
    }
};

const copyDockerFolderSettingsFromMenu = async (id) => {
    const actionsApi = getDockerRuntimeActionsApi();
    if (actionsApi && typeof actionsApi.copyDockerFolderSettingsFromMenu === 'function') {
        await actionsApi.copyDockerFolderSettingsFromMenu(id);
    }
};

const pasteDockerFolderSettingsFromMenu = async (id) => {
    const actionsApi = getDockerRuntimeActionsApi();
    if (actionsApi && typeof actionsApi.pasteDockerFolderSettingsFromMenu === 'function') {
        await actionsApi.pasteDockerFolderSettingsFromMenu(id);
    }
};

const cloneDockerFolderFromMenu = async (id) => {
    const actionsApi = getDockerRuntimeActionsApi();
    if (actionsApi && typeof actionsApi.cloneDockerFolderFromMenu === 'function') {
        await actionsApi.cloneDockerFolderFromMenu(id);
    }
};

const cloneDockerFolderBranchFromMenu = async (id) => {
    const actionsApi = getDockerRuntimeActionsApi();
    if (actionsApi && typeof actionsApi.cloneDockerFolderBranchFromMenu === 'function') {
        await actionsApi.cloneDockerFolderBranchFromMenu(id);
    }
};

/**
 * Perform an action for the entire folder
 * @param {string} id The id of the folder
 * @param {string} action the desired action
 */
const actionFolder = async (id, action, { includeDescendants = true } = {}) => {
    const actionsApi = getDockerRuntimeActionsApi();
    if (actionsApi && typeof actionsApi.actionFolder === 'function') {
        await actionsApi.actionFolder(id, action, { includeDescendants });
    }
};

/**
 * Execute the desired custom action
 * @param {string} id
 * @param {number} actionIndex
 */
const folderCustomAction = async (id, actionIndex) => {
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (id: ${id}, actionIndex: ${actionIndex}): Entry.`);
    $('div.spinner.fixed').show('slow');
    const folder = globalFolders[id];
    if (!folder || !folder.actions || !folder.actions[actionIndex]) {
        if (FOLDER_VIEW_DEBUG_MODE) console.error(`[FV3_DEBUG] folderCustomAction: Folder or action definition not found for id ${id}, actionIndex ${actionIndex}.`);
        $('div.spinner.fixed').hide('slow');
        return;
    }
    let act = folder.actions[actionIndex];
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (id: ${id}): Action details:`, {...act});
    let prom = [];

    if(act.type === 0) { // Standard Docker action
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (id: ${id}): Action type 0 (Standard Docker).`);
        const containersMap = getFolderRuntimeContainers(folder);
        // Keep legacy typo key (`conatiners`) but accept correctly-spelled `containers` too.
        const actionContainers = Array.isArray(act.conatiners)
            ? act.conatiners
            : (Array.isArray(act.containers) ? act.containers : []);
        const cts = actionContainers.map((name) => containersMap[name]).filter((e) => e);
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (id: ${id}): Targeted containers data:`, [...cts]);

        let ctAction = null;
        if(act.action === 0) { // Cycle
            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (id: ${id}): Standard action type 0 (Cycle). Mode: ${act.modes}.`);
            if(act.modes === 0) { // Start - Stop
                ctAction = (e_ct) => {
                    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (Cycle Start-Stop for ${e_ct.id}): State: ${e_ct.state}`);
                    if(e_ct.state) { // if running
                        prom.push($.post(eventURL, {action: 'stop', container:e_ct.id}, null,'json').promise());
                    } else { // if stopped
                        prom.push($.post(eventURL, {action: 'start', container:e_ct.id}, null,'json').promise());
                    }
                };
            } else if(act.modes === 1) { // Pause - Resume
                ctAction = (e_ct) => {
                    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (Cycle Pause-Resume for ${e_ct.id}): State: ${e_ct.state}, Paused: ${e_ct.pause}`);
                    if(e_ct.state) { // if running (can be paused or not)
                        if(e_ct.pause) { // if paused
                            prom.push($.post(eventURL, {action: 'resume', container:e_ct.id}, null,'json').promise());
                        } else { // if running but not paused
                            prom.push($.post(eventURL, {action: 'pause', container:e_ct.id}, null,'json').promise());
                        }
                    }
                };
            }
        } else if(act.action === 1) { // Set
            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (id: ${id}): Standard action type 1 (Set). Mode: ${act.modes}.`);
            if(act.modes === 0) { // Start
                ctAction = (e_ct) => {
                    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (Set Start for ${e_ct.id}): State: ${e_ct.state}`);
                    if(!e_ct.state) { prom.push($.post(eventURL, {action: 'start', container:e_ct.id}, null,'json').promise()); }
                };
            } else if(act.modes === 1) { // Stop
                ctAction = (e_ct) => {
                    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (Set Stop for ${e_ct.id}): State: ${e_ct.state}`);
                    if(e_ct.state) { prom.push($.post(eventURL, {action: 'stop', container:e_ct.id}, null,'json').promise()); }
                };
            } else if(act.modes === 2) { // Pause
                ctAction = (e_ct) => {
                    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (Set Pause for ${e_ct.id}): State: ${e_ct.state}, Paused: ${e_ct.pause}`);
                    if(e_ct.state && !e_ct.pause) { prom.push($.post(eventURL, {action: 'pause', container:e_ct.id}, null,'json').promise()); }
                };
            } else if(act.modes === 3) { // Resume
                ctAction = (e_ct) => {
                     if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (Set Resume for ${e_ct.id}): State: ${e_ct.state}, Paused: ${e_ct.pause}`);
                    if(e_ct.state && e_ct.pause) { prom.push($.post(eventURL, {action: 'resume', container:e_ct.id}, null,'json').promise()); }
                };
            }
        } else if(act.action === 2) { // Restart
            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (id: ${id}): Standard action type 2 (Restart).`);
            ctAction = (e_ct) => {
                if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (Restart for ${e_ct.id})`);
                prom.push($.post(eventURL, {action: 'restart', container:e_ct.id}, null,'json').promise());
            };
        }
        if (typeof ctAction === 'function') {
            cts.forEach((e_ct_data) => { // e_ct_data is like {id: "...", state: true, ...}
                if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (id: ${id}): Applying defined ctAction to container data:`, e_ct_data);
                ctAction(e_ct_data);
            });
            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (id: ${id}): Pushed ${prom.length} standard actions to promise array.`);
        } else {
            const unsupportedLabel = `action=${act.action}, mode=${act.modes}`;
            console.warn(`folderview.plus: Unsupported Docker custom action configuration (${unsupportedLabel}) for folder "${folder.name || id}".`);
        }

    } else if(act.type === 1) { // User Script
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (id: ${id}): Action type 1 (User Script). Script: ${act.script}, Sync: ${act.script_sync}, Args: ${act.script_args}`);
        const args = act.script_args || '';
        if(act.script_sync) { // Synchronous (foreground) script
            let scriptVariables = {};
            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (id: ${id}): Sync script. Getting script variables.`);
            let rawVars = await $.post("/plugins/user.scripts/exec.php",{action:'getScriptVariables',script:`/boot/config/plugins/user.scripts/scripts/${act.script}/script`}).promise();
            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (id: ${id}): Raw script variables:`, rawVars);
            rawVars.trim().split('\n').forEach((e) => { const variable = e.split('='); scriptVariables[variable[0]] = variable[1] });
            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (id: ${id}): Parsed script variables:`, scriptVariables);

            if(scriptVariables['directPHP']) {
                if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (id: ${id}): directPHP detected. Posting directRunScript.`);
                // This is a POST that then has a callback to openBox. It's not added to `prom`.
                $.post("/plugins/user.scripts/exec.php",{action:'directRunScript',path:`/boot/config/plugins/user.scripts/scripts/${act.script}/script`},function(data) {
                    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (id: ${id}): directRunScript callback. Data:`, data);
                    if(data) { openBox(data,act.name,800,1200, 'loadlist'); }
                });
            } else {
                if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (id: ${id}): Not directPHP. Posting convertScript then openBox.`);
                // This is also a POST with a callback. Not added to `prom`.
                $.post("/plugins/user.scripts/exec.php",{action:'convertScript',path:`/boot/config/plugins/user.scripts/scripts/${act.script}/script`},function(data) {
                     if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (id: ${id}): convertScript callback. Data:`, data);
                    if(data) {openBox('/plugins/user.scripts/startScript.sh&arg1='+data+'&arg2='+args,act.name,800,1200,true, 'loadlist');}
                });
            }
        } else { // Asynchronous (background) script
            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (id: ${id}): Async script. Posting convertScript then GET logging.htm.`);
            const cmd = await $.post("/plugins/user.scripts/exec.php",{action:'convertScript', path:`/boot/config/plugins/user.scripts/scripts/${act.script}/script`}).promise();
            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (id: ${id}): Converted script cmd:`, cmd);
            prom.push($.get('/logging.htm?cmd=/plugins/user.scripts/backgroundScript.sh&arg1='+cmd+'&arg2='+args+'&csrf_token='+csrf_token+'&done=Done').promise());
            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (id: ${id}): Pushed async script call to promise array.`);
        }
    }

    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (id: ${id}): Awaiting ${prom.length} promises for custom action.`);
    await Promise.all(prom);
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (id: ${id}): All promises resolved. Refreshing runtime state.`);
    if (act.type === 0) {
        await refreshDockerRuntimeStateInPlace({ followupDelayMs: 650 });
    } else {
        loadlist();
    }
    $('div.spinner.fixed').hide('slow');
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (id: ${id}): Exit.`);
};


const DOCKER_CONTEXT_QUICK_ACTION_LABELS = new Set([
    'focus folder',
    'clear focus',
    'pin folder',
    'unpin folder',
    'lock folder',
    'unlock folder'
]);
const dockerContextQuickStripAdapter = createDockerContextMenuQuickStripAdapter({
    menuClassName: 'fvplus-docker-context-menu',
    quickItemClassName: 'fvplus-docker-quick-item',
    clearClassName: 'fvplus-docker-quick-clear',
    labelSet: DOCKER_CONTEXT_QUICK_ACTION_LABELS,
    iconClassCandidates: [
        'fa-bullseye',
        'fa-dot-circle-o',
        'fa-star',
        'fa-star-o',
        'fa-lock',
        'fa-unlock-alt'
    ]
});
const queueDockerFolderContextQuickIcons = (attempt = 0) => {
    if (!dockerContextQuickStripAdapter || typeof dockerContextQuickStripAdapter.queueEnhance !== 'function') {
        return;
    }
    dockerContextQuickStripAdapter.queueEnhance(attempt);
};

/**
 * Atach the menu when clicking the folder icon
 * @param {string} id the id of the folder
 */
const addDockerFolderContext = (id) => {
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] addDockerFolderContext (id: ${id}): Entry.`);
    dockerPerfTelemetry.begin('context-menu-build');
    let opts = [];
    const appendDivider = () => {
        if (!opts.length || opts[opts.length - 1].divider) {
            return;
        }
        opts.push({ divider: true });
    };
    const appendCountedAction = ({ label, icon, count, run }) => {
        if (count <= 0 || typeof run !== 'function') {
            return;
        }
        opts.push({
            text: `${label} (${count})`,
            icon,
            action: (evt) => {
                evt.preventDefault();
                run();
            }
        });
    };
    const appendScopeAwareAction = ({ label, icon, directCount, branchCount, runScoped }) => {
        if (typeof runScoped !== 'function') {
            return;
        }
        if (hasChildren) {
            const subMenu = [];
            if (directCount > 0) {
                subMenu.push({
                    text: `This folder (${directCount})`,
                    icon: 'fa-folder-o',
                    action: (evt) => {
                        evt.preventDefault();
                        runScoped(false);
                    }
                });
            }
            if (branchCount > 0) {
                subMenu.push({
                    text: `Folder + descendants (${branchCount})`,
                    icon: 'fa-sitemap',
                    action: (evt) => {
                        evt.preventDefault();
                        runScoped(true);
                    }
                });
            }
            if (!subMenu.length) {
                return;
            }
            opts.push({
                text: `${label} (${branchCount})`,
                icon,
                subMenu
            });
            return;
        }
        appendCountedAction({
            label,
            icon,
            count: branchCount,
            run: () => runScoped(true)
        });
    };
    const normalizeDividers = (items) => {
        const normalized = [];
        for (const item of items) {
            if (item?.divider) {
                if (!normalized.length || normalized[normalized.length - 1].divider) {
                    continue;
                }
            }
            normalized.push(item);
        }
        while (normalized.length && normalized[normalized.length - 1]?.divider) {
            normalized.pop();
        }
        return normalized;
    };

    context.settings({
        right: false,
        above: false
    });
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] addDockerFolderContext (id: ${id}): Context menu settings configured.`);

    if (!globalFolders[id]) {
        if (FOLDER_VIEW_DEBUG_MODE) console.error(`[FV3_DEBUG] addDockerFolderContext (id: ${id}): Folder data not found in globalFolders. Aborting context menu.`);
        dockerPerfTelemetry.end('context-menu-build', { id, aborted: true });
        return;
    }
    const folderData = globalFolders[id];
    const hasChildren = folderHasChildren(id);
    const focused = dockerFocusedFolderId === id;
    const pinned = isDockerFolderPinned(id);
    const locked = isDockerFolderLocked(id);
    const directScopeContainers = getScopedRuntimeContainersForFolder(id, false);
    const branchScopeContainers = getScopedRuntimeContainersForFolder(id, true);
    const directCounts = summarizeFolderActionCounts(directScopeContainers);
    const branchCounts = summarizeFolderActionCounts(branchScopeContainers);
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] addDockerFolderContext (id: ${id}): Folder data:`, {...folderData});

    opts.push({
        text: focused
            ? getDockerMenuLabel('clear-focus-folder', 'Clear focus')
            : getDockerMenuLabel('focus-folder', 'Focus folder'),
        icon: focused ? 'fa-dot-circle-o' : 'fa-bullseye',
        action: (evt) => {
            evt.preventDefault();
            toggleDockerFolderFocus(id);
        }
    });
    opts.push({
        text: pinned
            ? getDockerMenuLabel('unpin-folder', 'Unpin folder')
            : getDockerMenuLabel('pin-folder', 'Pin folder'),
        icon: pinned ? 'fa-star' : 'fa-star-o',
        action: (evt) => {
            evt.preventDefault();
            toggleDockerFolderPin(id);
        }
    });
    opts.push({
        text: locked
            ? getDockerMenuLabel('unlock-folder', 'Unlock folder')
            : getDockerMenuLabel('lock-folder', 'Lock folder'),
        icon: locked ? 'fa-lock' : 'fa-unlock-alt',
        action: (evt) => {
            evt.preventDefault();
            toggleDockerFolderLock(id);
        }
    });
    appendDivider();


    if (folderData.settings.folder_webui && folderData.settings.folder_webui_url) {
        opts.push({
            text: $.i18n('webui'),
            icon: 'fa-globe',
            action: (evt) => {
                evt.preventDefault();
                openWebuiInNewTab(folderData.settings.folder_webui_url);
            }
        });
        appendDivider();
    }

    if(folderData.settings.override_default_actions && folderData.actions && folderData.actions.length) {
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] addDockerFolderContext (id: ${id}): Overriding default actions with ${folderData.actions.length} custom actions.`);
        opts.push(
            ...folderData.actions.map((e, i) => {
                return {
                    text: e.name,
                    icon: e.script_icon || "fa-bolt",
                    action: (evt) => { evt.preventDefault(); folderCustomAction(id, i); } // evt for event
                }
            })
        );
        appendDivider();
    } else if(!folderData.settings.default_action) { // if default actions are NOT hidden
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] addDockerFolderContext (id: ${id}): Adding default action menu items with scoped counts.`);
        appendScopeAwareAction({
            label: $.i18n('start'),
            icon: 'fa-play',
            directCount: directCounts.startable,
            branchCount: branchCounts.startable,
            runScoped: (includeDescendants) => actionFolder(id, 'start', { includeDescendants })
        });
        appendScopeAwareAction({
            label: $.i18n('stop'),
            icon: 'fa-stop',
            directCount: directCounts.stoppable,
            branchCount: branchCounts.stoppable,
            runScoped: (includeDescendants) => actionFolder(id, 'stop', { includeDescendants })
        });
        appendScopeAwareAction({
            label: $.i18n('pause'),
            icon: 'fa-pause',
            directCount: directCounts.pausable,
            branchCount: branchCounts.pausable,
            runScoped: (includeDescendants) => actionFolder(id, 'pause', { includeDescendants })
        });
        appendScopeAwareAction({
            label: $.i18n('resume'),
            icon: 'fa-play-circle',
            directCount: directCounts.resumable,
            branchCount: branchCounts.resumable,
            runScoped: (includeDescendants) => actionFolder(id, 'resume', { includeDescendants })
        });
        appendScopeAwareAction({
            label: $.i18n('restart'),
            icon: 'fa-refresh',
            directCount: directCounts.restartable,
            branchCount: branchCounts.restartable,
            runScoped: (includeDescendants) => actionFolder(id, 'restart', { includeDescendants })
        });
        appendDivider();
    }

    if(branchCounts.updateReady > 0 || branchCounts.managed > 0) {
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] addDockerFolderContext (id: ${id}): Adding update menu item with scoped counts.`);
        if (branchCounts.updateReady > 0) {
            appendScopeAwareAction({
                label: $.i18n('update'),
                icon: 'fa-cloud-download',
                directCount: directCounts.updateReady,
                branchCount: branchCounts.updateReady,
                runScoped: (includeDescendants) => updateFolder(id, { includeDescendants })
            });
        } else {
            appendScopeAwareAction({
                label: $.i18n('update-force'),
                icon: 'fa-cloud-download',
                directCount: directCounts.managed,
                branchCount: branchCounts.managed,
                runScoped: (includeDescendants) => forceUpdateFolder(id, { includeDescendants })
            });
        }
        appendDivider();
    }

    if (hasChildren) {
        const branchSubMenu = [
            {
                text: 'Expand branch',
                icon: 'fa-angle-double-down',
                action: (evt) => {
                    evt.preventDefault();
                    expandFolderBranch(id);
                }
            },
            {
                text: 'Collapse branch',
                icon: 'fa-angle-double-up',
                action: (evt) => {
                    evt.preventDefault();
                    collapseFolderBranch(id);
                }
            }
        ];
        if (branchCounts.startable > 0) {
            branchSubMenu.push({
                text: `Start branch (${branchCounts.startable})`,
                icon: 'fa-play',
                action: (evt) => {
                    evt.preventDefault();
                    actionFolder(id, 'start', { includeDescendants: true });
                }
            });
        }
        if (branchCounts.stoppable > 0) {
            branchSubMenu.push({
                text: `Stop branch (${branchCounts.stoppable})`,
                icon: 'fa-stop',
                action: (evt) => {
                    evt.preventDefault();
                    actionFolder(id, 'stop', { includeDescendants: true });
                }
            });
        }
        if (branchCounts.updateReady > 0) {
            branchSubMenu.push({
                text: `Update branch (${branchCounts.updateReady})`,
                icon: 'fa-cloud-download',
                action: (evt) => {
                    evt.preventDefault();
                    updateFolder(id, { includeDescendants: true });
                }
            });
        } else if (branchCounts.managed > 0) {
            branchSubMenu.push({
                text: `Force update branch (${branchCounts.managed})`,
                icon: 'fa-cloud-download',
                action: (evt) => {
                    evt.preventDefault();
                    forceUpdateFolder(id, { includeDescendants: true });
                }
            });
        }
        branchSubMenu.push({
            text: 'Delete branch folders',
            icon: 'fa-trash',
            action: (evt) => {
                evt.preventDefault();
                rmFolderBranch(id);
            }
        });
        if (branchSubMenu.length > 0) {
            opts.push({
                text: 'Branch actions',
                icon: 'fa-sitemap',
                subMenu: branchSubMenu
            });
            appendDivider();
        }
    }

    const folderWebuiCount = collectFolderWebuiTargets(id, false, true).length;
    if (folderWebuiCount > 0) {
        opts.push({
            text: getDockerMenuLabel('open-all-webui', 'Open all WebUIs'),
            icon: 'fa-external-link',
            action: (evt) => {
                evt.preventDefault();
                openFolderWebuisFromMenu(id, true, false);
            }
        });
        appendDivider();
    }

    opts.push({
        text: $.i18n('edit'),
        icon: 'fa-wrench',
        action: (evt) => { evt.preventDefault(); editFolder(id); }
    });

    const cloneSubMenu = [
        {
            text: getDockerMenuLabel('clone-folder', 'Clone folder'),
            icon: 'fa-clone',
            action: (evt) => {
                evt.preventDefault();
                cloneDockerFolderFromMenu(id);
            }
        }
    ];
    if (hasChildren) {
        cloneSubMenu.push({
            text: getDockerMenuLabel('clone-branch', 'Clone branch'),
            icon: 'fa-sitemap',
            action: (evt) => {
                evt.preventDefault();
                cloneDockerFolderBranchFromMenu(id);
            }
        });
    }
    cloneSubMenu.push({
        text: getDockerMenuLabel('copy-folder-settings', 'Copy Folder Settings'),
        icon: 'fa-files-o',
        action: (evt) => {
            evt.preventDefault();
            copyDockerFolderSettingsFromMenu(id);
        }
    });
    cloneSubMenu.push({
        text: getDockerMenuLabel('paste-folder-settings', 'Paste Folder Settings'),
        icon: 'fa-clipboard',
        action: (evt) => {
            evt.preventDefault();
            pasteDockerFolderSettingsFromMenu(id);
        }
    });
    opts.push({
        text: getDockerMenuLabel('clone-menu', 'Clone'),
        icon: 'fa-clone',
        subMenu: cloneSubMenu
    });

    opts.push({
        text: $.i18n('remove'),
        icon: 'fa-trash',
        action: (evt) => { evt.preventDefault(); rmFolder(id); }
    });

    // Add custom actions as submenu if not overriding and custom actions exist
    if(!folderData.settings.override_default_actions && folderData.actions && folderData.actions.length) {
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] addDockerFolderContext (id: ${id}): Adding custom actions as submenu.`);
        appendDivider();
        opts.push({
            text: $.i18n('custom-actions'),
            icon: 'fa-bars',
            subMenu: folderData.actions.map((e, i) => {
                return {
                    text: e.name,
                    icon: e.script_icon || "fa-bolt",
                    action: (evt) => { evt.preventDefault(); folderCustomAction(id, i); }
                }
            })
        });
    }

    opts = normalizeDividers(opts);
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] addDockerFolderContext (id: ${id}): Dispatching docker-folder-context event. Options:`, opts);
    folderEvents.dispatchEvent(new CustomEvent('docker-folder-context', {detail: { id, opts }}));

    context.attach('#' + id, opts);
    queueDockerFolderContextQuickIcons();
    dockerPerfTelemetry.end('context-menu-build', { id, optsCount: opts.length });
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] addDockerFolderContext (id: ${id}): Context menu attached to #${id}. Exit.`);
};

// Patching the original function to make sure the containers are rendered before insering the folder
window.listview_original = window.listview; // Ensure original is captured
if (typeof window.listview_original !== 'function') {
    reportDockerDegradedRuntimeState('Docker host listview hook was unavailable during bootstrap.', {
        phase: 'hook-install',
        category: 'host-hook-missing',
        detailLabel: 'Missing host hooks',
        details: ['window.listview was not a function when FolderView Plus initialized.']
    });
} else {
    markDockerFatalBannerStep('Docker listview hook captured');
}
window.listview = () => {
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Patched listview: Entry.');
    if (typeof window.listview_original === 'function') {
        window.listview_original();
        if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Patched listview: Called original listview.');
    } else {
        if (FOLDER_VIEW_DEBUG_MODE) console.error('[FV3_DEBUG] Patched listview: window.listview_original is not a function!');
    }

    if (!loadedFolder) {
        if (!folderReq || !Array.isArray(folderReq.render) || folderReq.render.length === 0) {
            folderReq = buildDockerFolderReq();
        }
        dockerHostLoadOwnsLoadingUi = true;
        if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Patched listview: loadedFolder is false. Queueing createFolders render.');
        queueCreateFoldersRender();
        loadedFolder = true;
         if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Patched listview: Set loadedFolder to true.');
    } else {
        if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Patched listview: loadedFolder is true. Skipped createFolders.');
    }
    queueDockerRuntimeResizerBind();
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Patched listview: Exit.');
};

window.loadlist_original = window.loadlist; // Ensure original is captured
if (typeof window.loadlist_original !== 'function') {
    reportDockerDegradedRuntimeState('Docker host loadlist hook was unavailable during bootstrap.', {
        phase: 'hook-install',
        category: 'host-hook-missing',
        detailLabel: 'Missing host hooks',
        details: ['window.loadlist was not a function when FolderView Plus initialized.']
    });
} else {
    markDockerFatalBannerStep('Docker loadlist hook captured');
}
window.loadlist = () => {
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Patched loadlist: Entry.');
    loadedFolder = false;
    dockerHostLoadOwnsLoadingUi = true;
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Patched loadlist: Set loadedFolder to false.');
    folderReq = buildDockerFolderReq();
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Patched loadlist: folderReq initialized with a staged Docker runtime request bundle.');

    if (typeof window.loadlist_original === 'function') {
        window.loadlist_original();
        if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Patched loadlist: Called original loadlist.');
    } else {
        if (FOLDER_VIEW_DEBUG_MODE) console.error('[FV3_DEBUG] Patched loadlist: window.loadlist_original is not a function!');
    }
    queueDockerRuntimeResizerBind();
     if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Patched loadlist: Exit.');
};

// Get the number of CPU, nneded for a right display of the load
if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Requesting CPU count.');
$.get('/plugins/folderview.plus/server/cpu.php').promise().then((data) => {
    cpus = parseInt(data);
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] CPU count received: ${cpus}. Attaching SSE listener for dockerload.`);
    // Attach to the scoket and process the data
    dockerload.addEventListener('message', (e_sse) => {
        // Unraid's dockerload passes data directly as the event in some versions, not in e.data
        const sseData = (typeof e_sse.data === 'string') ? e_sse.data : (typeof e_sse === 'string' ? e_sse : null);

        if (!sseData || !sseData.trim()) {
            return; // Skip if no valid data
        }

        if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] dockerload SSE: Message received:', sseData.substring(0, 100) + '...');
        let load = {};
        const lines = sseData.split('\n');
        lines.forEach((line_str) => { // Renamed e to line_str
            if (!line_str.trim()) return; // Skip empty lines
            const exp = line_str.split(';');
            if (exp.length >= 3) { // Basic validation
                load[exp[0]] = {
                    cpu: exp[1],
                    mem: exp[2].split(' / ')
                };
            } else {
                if (FOLDER_VIEW_DEBUG_MODE) console.warn('[FV3_DEBUG] dockerload SSE: Malformed line:', line_str);
            }
        });
        if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] dockerload SSE: Parsed load data:', {...load});

        for (const [id, value] of Object.entries(globalFolders)) {
            let loadCpu = 0;
            let totalMemB = 0; // Use Bytes for sum then convert
            let loadMemB = 0;  // Use Bytes for sum then convert

            if (!value || !value.containers) {
                if (FOLDER_VIEW_DEBUG_MODE) console.warn(`[FV3_DEBUG] dockerload SSE: Folder ${id} or its containers not found in globalFolders.`);
                continue;
            }

            for (const cvalue of Object.values(value.containers)) {
                const containerShortId = cvalue.id;
                const curLoad = load[containerShortId] || { cpu: '0.00%', mem: ['0B', '0B'] };
                loadCpu += parseFloat(curLoad.cpu.replace('%', '')) / cpus; // Already per core from SSE
                loadMemB += memToB(curLoad.mem[0]);
                let tempTotalMem = memToB(curLoad.mem[1]);
                totalMemB = Math.max(totalMemB, tempTotalMem); // Max of individual limits, or sum if preferred
            }
            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] dockerload SSE (folder ${id}): Calculated totals - loadCpu: ${loadCpu.toFixed(2)}%, loadMemB: ${loadMemB}, totalMemB: ${totalMemB}`);

            $(`span.mem-folder-${id}`).text(`${bToMem(loadMemB)} / ${bToMem(totalMemB)}`);
            $(`span.cpu-folder-${id}`).text(`${loadCpu.toFixed(2)}%`);
            $(`span#cpu-folder-${id}`).css('width', `${Math.min(100, loadCpu).toFixed(2)}%`); // Cap at 100% for display
        }
    });
}).catch(err => {
    if (FOLDER_VIEW_DEBUG_MODE) console.error('[FV3_DEBUG] Error fetching CPU count:', err);
});

/**
 * Convert memory unit to Bytes
 * @param {string} mem the unraid memory notation
 * @returns {number} number of bytes
 */
const memToB = (mem) => {
    if (typeof mem !== 'string') {
        if (FOLDER_VIEW_DEBUG_MODE) console.warn(`[FV3_DEBUG] memToB: Input is not a string: ${mem}. Returning 0.`);
        return 0;
    }
    const unitMatch = mem.match(/[a-zA-Z]+/); // Get all letters for unit
    const unit = unitMatch ? unitMatch[0] : 'B'; // Default to B if no letters
    const numPart = parseFloat(mem.replace(unit, ''));

    if (isNaN(numPart)) {
         if (FOLDER_VIEW_DEBUG_MODE) console.warn(`[FV3_DEBUG] memToB: Could not parse number from ${mem}. Returning 0.`);
        return 0;
    }

    let multiplier = 1;
    switch (unit) {
        case 'Bytes': case 'B': multiplier = 1; break; // Added Bytes
        case 'KiB': multiplier = 2 ** 10; break;
        case 'MiB': multiplier = 2 ** 20; break;
        case 'GiB': multiplier = 2 ** 30; break;
        case 'TiB': multiplier = 2 ** 40; break;
        case 'PiB': multiplier = 2 ** 50; break;
        case 'EiB': multiplier = 2 ** 60; break;
        // ZiB and YiB are rare for container mem but kept for completeness
        case 'ZiB': multiplier = 2 ** 70; break;
        case 'YiB': multiplier = 2 ** 80; break;
        default:
            if (FOLDER_VIEW_DEBUG_MODE) console.warn(`[FV3_DEBUG] memToB: Unknown memory unit '${unit}' in '${mem}'. Assuming Bytes.`);
            multiplier = 1; // Default to Bytes if unit is unknown
            break;
    }
    const result = numPart * multiplier;
    return result;
};


/**
 * Convert Bytes to memory units
 * @param {number} b the number of bytes
 * @returns {string} a string with the right notation and right unit
 */
const bToMem = (b) => {
    if (typeof b !== 'number' || isNaN(b) || b < 0) {
        if (FOLDER_VIEW_DEBUG_MODE) console.warn(`[FV3_DEBUG] bToMem: Invalid input ${b}. Returning '0 B'.`);
        return '0 B';
    }
    if (b === 0) return '0 B';

    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    let i = 0;
    let value = b;
    while (value >= 1024 && i < units.length - 1) {
        value /= 1024;
        i++;
    }
    const result = `${value.toFixed(2)} ${units[i]}`;
    return result;
};


// Global variables
let cpus = 1;
let loadedFolder = false;
let globalFolders = {};
let dockerFolderHierarchy = buildFolderHierarchy({});
const folderRegex = /^folder-/;
let folderDebugMode = false; // Existing flag
let folderDebugModeWindow = [];
let folderobserver;
let folderobserverConfig = {
    attributes: true,
    attributeFilter: ['class']
};
let folderReq = { render: [], fullInfo: null, generation: 0 };
let folderTypePrefs = utils.normalizePrefs({});
let liveRefreshTimer = null;
let liveRefreshMs = 0;
let liveRefreshInFlight = false;
let queuedLoadlistTimer = null;
let queuedLoadlistOptions = null;
let queuedLoadlistRequestedAt = 0;
let lastLiveRefreshStateSignature = '';
let dockerBootstrapGeneration = 0;
let dockerHostLoadOwnsLoadingUi = false;
let nextDockerRenderSuppressLoadingUi = false;
let activeDockerRenderSuppressLoadingUi = false;
let dockerListViewModeObserverTimer = null;
let lastDockerListViewMode = $.cookie('docker_listview_mode') == 'advanced' ? 'advanced' : 'basic';
let dockerSupportBundleSnapshotTimer = null;
let dockerPostUpdateRuntimePollTimer = null;
let dockerUpdateActionClickCaptureBound = false;
const LOADLIST_REFRESH_DEBOUNCE_MS = 90;
const LOADLIST_REFRESH_MIN_GAP_MS = 420;
const PERFORMANCE_MODE_MIN_REFRESH_SECONDS = 20;
const PERFORMANCE_MODE_EXPAND_RESTORE_LIMIT = 12;
const DOCKER_RENDER_YIELD_BATCH_SIZE = 6;
const DOCKER_SUPPORT_BUNDLE_PAGE_STORAGE_KEY = 'fv.support.bundle.docker.page.v1';
const DOCKER_SUPPORT_BUNDLE_FOLDER_ROW_LIMIT = 32;
const DOCKER_SUPPORT_BUNDLE_MEMBER_ROW_LIMIT = 120;
const DOCKER_POST_UPDATE_RECONCILE_INITIAL_DELAY_MS = 220;
const DOCKER_POST_UPDATE_RECONCILE_POLL_INTERVAL_MS = 4000;
let dockerRuntimePerformanceProfile = resolveDockerRuntimePerformanceProfile(folderTypePrefs, {
    folderCount: 0,
    itemCount: 0
});

const writeDockerSupportBundleStorageRecord = (storageKey, value) => {
    try {
        if (typeof localStorage === 'undefined') {
            return false;
        }
        localStorage.setItem(storageKey, JSON.stringify(value));
        return true;
    } catch (_error) {
        return false;
    }
};

const normalizeDockerSupportBundleText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const resolveDockerSupportBundleActionToken = (text) => {
    const normalized = normalizeDockerSupportBundleText(text).toLowerCase();
    if (!normalized) {
        return 'none';
    }
    if (normalized.includes('apply update')) {
        return 'applyUpdate';
    }
    if (normalized.includes('force update')) {
        return 'forceUpdate';
    }
    if (normalized.includes('up-to-date')) {
        return 'upToDate';
    }
    if (normalized.includes('update ready')) {
        return 'updateReady';
    }
    return 'other';
};

const parseDockerSupportBundleFolderId = (row) => {
    const className = String(row?.className || '').trim();
    const match = className.match(/(?:^|\s)folder-id-([A-Za-z0-9_-]+)(?:\s|$)/);
    return match ? String(match[1] || '').trim() : '';
};

const parseDockerSupportBundleMemberFolderId = (row) => {
    const className = String(row?.className || '').trim();
    const match = className.match(/(?:^|\s)folder-([A-Za-z0-9_-]+)-element(?:\s|$)/);
    return match ? String(match[1] || '').trim() : '';
};

const collectDockerSupportBundlePageSnapshot = (reason = 'runtime-sync') => {
    const $tableRows = $('#docker_list > tr');
    if (!$tableRows.length) {
        return null;
    }
    const folderEntries = [];
    const memberEntries = [];
    const summary = {
        visibleFolderRows: 0,
        visibleMemberRows: 0,
        expandedFolderRows: 0,
        folderApplyUpdateCount: 0,
        folderForceUpdateCount: 0,
        memberApplyUpdateCount: 0,
        memberForceUpdateCount: 0,
        memberMissingFolderClassCount: 0
    };

    $tableRows.each((_, row) => {
        const $row = $(row);
        if (!$row.is(':visible')) {
            return;
        }
        const folderId = parseDockerSupportBundleFolderId(row);
        if (folderId) {
            const updateCellText = normalizeDockerSupportBundleText($row.find('td.updatecolumn').first().text());
            const actionToken = resolveDockerSupportBundleActionToken(updateCellText);
            const expanded = $(`.dropDown-${folderId}`).attr('active') === 'true';
            summary.visibleFolderRows += 1;
            if (expanded) {
                summary.expandedFolderRows += 1;
            }
            if (actionToken === 'applyUpdate') {
                summary.folderApplyUpdateCount += 1;
            } else if (actionToken === 'forceUpdate') {
                summary.folderForceUpdateCount += 1;
            }
            if (folderEntries.length < DOCKER_SUPPORT_BUNDLE_FOLDER_ROW_LIMIT) {
                folderEntries.push({
                    folderId,
                    folderName: normalizeDockerSupportBundleText($row.find('td.ct-name .appname').first().text()),
                    expanded,
                    updateCellText,
                    actionToken,
                    statusText: normalizeDockerSupportBundleText($row.find('td.ct-name .state').first().text())
                });
            }
            return;
        }
        const rawId = String(row?.id || '').trim();
        if (!rawId.startsWith('ct-')) {
            return;
        }
        const updateCellText = normalizeDockerSupportBundleText($row.find('td.updatecolumn').first().text());
        const actionToken = resolveDockerSupportBundleActionToken(updateCellText);
        const memberFolderId = parseDockerSupportBundleMemberFolderId(row);
        summary.visibleMemberRows += 1;
        if (!memberFolderId) {
            summary.memberMissingFolderClassCount += 1;
        }
        if (actionToken === 'applyUpdate') {
            summary.memberApplyUpdateCount += 1;
        } else if (actionToken === 'forceUpdate') {
            summary.memberForceUpdateCount += 1;
        }
        if (memberEntries.length < DOCKER_SUPPORT_BUNDLE_MEMBER_ROW_LIMIT) {
            memberEntries.push({
                containerName: normalizeDockerSupportBundleText($row.find('td.ct-name .appname').first().text()) || rawId.slice(3),
                folderId: memberFolderId || '',
                classTagged: memberFolderId !== '',
                updateCellText,
                actionToken,
                statusText: normalizeDockerSupportBundleText($row.find('td.ct-name .state').first().text())
            });
        }
    });

    return {
        capturedAt: new Date().toISOString(),
        reason: String(reason || 'runtime-sync').trim() || 'runtime-sync',
        currentPage: String(location?.pathname || ''),
        listViewMode: readDockerListViewMode(),
        folderRows: {
            count: summary.visibleFolderRows,
            truncated: summary.visibleFolderRows > folderEntries.length,
            entries: folderEntries
        },
        memberRows: {
            count: summary.visibleMemberRows,
            truncated: summary.visibleMemberRows > memberEntries.length,
            entries: memberEntries
        },
        summary
    };
};

const queueDockerSupportBundlePageSnapshot = (reason = 'runtime-sync', delayMs = 180) => {
    if (dockerSupportBundleSnapshotTimer) {
        clearTimeout(dockerSupportBundleSnapshotTimer);
    }
    dockerSupportBundleSnapshotTimer = setTimeout(() => {
        dockerSupportBundleSnapshotTimer = null;
        const snapshot = collectDockerSupportBundlePageSnapshot(reason);
        if (snapshot) {
            writeDockerSupportBundleStorageRecord(DOCKER_SUPPORT_BUNDLE_PAGE_STORAGE_KEY, snapshot);
        }
    }, Math.max(0, Number(delayMs) || 0));
};
const shouldArmDockerPostUpdateReconcileFromClick = (target) => {
    const actionNode = target instanceof Element
        ? target.closest('#docker_list td.updatecolumn a.exec, #docker_view td.updatecolumn a.exec')
        : null;
    if (!(actionNode instanceof HTMLAnchorElement)) {
        return false;
    }
    const row = actionNode.closest('tr');
    if (!(row instanceof HTMLTableRowElement)) {
        return false;
    }
    const rawOnClick = String(actionNode.getAttribute('onclick') || '').trim();
    const updateText = normalizeDockerSupportBundleText(actionNode.closest('td.updatecolumn')?.textContent || '');
    return /(?:^|[^A-Za-z0-9_])(?:updateFolder|forceUpdateFolder)\(/.test(rawOnClick)
        || /\b(?:apply update|force update)\b/i.test(updateText);
};
const handleDockerUpdateActionClickCapture = (event) => {
    if (!shouldArmDockerPostUpdateReconcileFromClick(event?.target)) {
        return;
    }
    appendDockerBulkUpdateTrace('updateActionClick', {
        currentPage: String(location?.pathname || ''),
        listViewMode: readDockerListViewMode()
    });
    armDockerPostUpdateRuntimeReconcileWindow(120000, {
        initialDelayMs: DOCKER_POST_UPDATE_RECONCILE_INITIAL_DELAY_MS,
        pollDelayMs: DOCKER_POST_UPDATE_RECONCILE_POLL_INTERVAL_MS
    });
    queueDockerSupportBundlePageSnapshot('update-action-click', 80);
};
const bindDockerUpdateActionClickCapture = () => {
    if (dockerUpdateActionClickCaptureBound || typeof document?.addEventListener !== 'function') {
        return;
    }
    document.addEventListener('click', handleDockerUpdateActionClickCapture, true);
    dockerUpdateActionClickCaptureBound = true;
};

const resolveDockerStrictPerformanceProfile = (prefs, folders, containersInfo) => {
    const folderCount = Object.keys(folders && typeof folders === 'object' ? folders : {}).length;
    const itemCount = Object.keys(containersInfo && typeof containersInfo === 'object' ? containersInfo : {}).length;
    dockerRuntimePerformanceProfile = resolveDockerRuntimePerformanceProfile(prefs || {}, { folderCount, itemCount });
    dockerRuntimeStateStore.set({ performanceProfile: dockerRuntimePerformanceProfile });
    return dockerRuntimePerformanceProfile;
};

const shouldSuppressDockerRuntimeLoadingUi = () => dockerHostLoadOwnsLoadingUi || nextDockerRenderSuppressLoadingUi || activeDockerRenderSuppressLoadingUi;
const queueLoadlistRefresh = (options = {}) => {
    const normalizedOptions = {
        suppressLoadingUi: options?.suppressLoadingUi === true
    };
    if (queuedLoadlistTimer) {
        queuedLoadlistOptions = queuedLoadlistOptions && typeof queuedLoadlistOptions === 'object'
            ? {
                suppressLoadingUi: queuedLoadlistOptions.suppressLoadingUi === true && normalizedOptions.suppressLoadingUi === true
            }
            : normalizedOptions;
        return;
    }
    queuedLoadlistOptions = normalizedOptions;
    const now = Date.now();
    const elapsed = now - queuedLoadlistRequestedAt;
    const minGapWait = elapsed >= LOADLIST_REFRESH_MIN_GAP_MS
        ? 0
        : (LOADLIST_REFRESH_MIN_GAP_MS - elapsed);
    const delayMs = Math.max(LOADLIST_REFRESH_DEBOUNCE_MS, minGapWait);
    queuedLoadlistTimer = setTimeout(() => {
        const refreshOptions = queuedLoadlistOptions && typeof queuedLoadlistOptions === 'object'
            ? queuedLoadlistOptions
            : { suppressLoadingUi: false };
        queuedLoadlistTimer = null;
        queuedLoadlistOptions = null;
        queuedLoadlistRequestedAt = Date.now();
        nextDockerRenderSuppressLoadingUi = refreshOptions.suppressLoadingUi === true;
        loadlist();
    }, delayMs);
};

const buildDockerRuntimeInfoUrl = (mode = 'full', cacheBust = Date.now()) => {
    return `/plugins/folderview.plus/server/read_info.php?type=docker${mode === 'state' ? '&mode=state' : ''}&nocache=1&_=${cacheBust || Date.now()}`;
};

const fetchDockerStateSignature = async () => {
    const payload = await $.get(buildDockerRuntimeInfoUrl('state')).promise();
    const parsed = parseJsonPayloadSafe(payload);
    return buildDockerStateSignature(parsed, true);
};

const refreshDockerRuntimeStateInPlace = async (options = {}) => {
    const followupDelayMs = Math.max(0, Number(options?.followupDelayMs) || 0);
    const fallbackToLoadlist = () => {
        queueLoadlistRefresh({ suppressLoadingUi: true });
    };
    const applyStatePayload = async () => {
        const payload = await $.get(buildDockerRuntimeInfoUrl('state')).promise();
        const parsed = parseJsonPayloadSafe(payload);
        if (!parsed || Object.keys(parsed).length <= 0) {
            throw new Error('Docker runtime state payload was empty.');
        }
        dockerRuntimeInfoByName = normalizeDockerRuntimeInfoMap(parsed, dockerRuntimeInfoByName);
        const nextSignature = buildDockerStateSignature(parsed, true);
        if (nextSignature) {
            lastLiveRefreshStateSignature = nextSignature;
        }
        syncDockerVisibleFoldersFromRuntimeCache();
        return true;
    };
    try {
        await applyStatePayload();
        if (followupDelayMs > 0) {
            window.setTimeout(() => {
                Promise.resolve(applyStatePayload()).catch(() => fallbackToLoadlist());
            }, followupDelayMs);
        }
        return true;
    } catch (_error) {
        fallbackToLoadlist();
        return false;
    }
};

const readDockerHostOrderFromDom = () => {
    const order = [];
    document.querySelectorAll('#docker_list > tr.sortable').forEach((row) => {
        const safeRow = row instanceof HTMLElement ? row : null;
        if (!safeRow || safeRow.classList.contains('folder')) {
            return;
        }
        const rawId = String(safeRow.id || '').trim();
        if (rawId.startsWith('ct-')) {
            const nameFromId = rawId.slice(3).trim();
            if (nameFromId) {
                order.push(nameFromId);
                return;
            }
        }
        const textName = String($(safeRow).find('td.ct-name .appname').first().text() || '').trim();
        if (textName) {
            order.push(textName);
        }
    });
    return order;
};

const waitForDockerRenderFrame = () => new Promise((resolve) => {
    if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => resolve());
        return;
    }
    window.setTimeout(resolve, 0);
});

const yieldDockerRenderLoop = async (processedCount, totalCount) => {
    if (
        processedCount <= 0
        || processedCount >= totalCount
        || processedCount % DOCKER_RENDER_YIELD_BATCH_SIZE !== 0
    ) {
        return;
    }
    await waitForDockerRenderFrame();
};

const clearLiveRefreshTimer = () => {
    if (liveRefreshTimer) {
        clearInterval(liveRefreshTimer);
        liveRefreshTimer = null;
    }
    liveRefreshMs = 0;
};

const runLiveRefreshTick = () => {
    if (liveRefreshInFlight || document.hidden) {
        return;
    }
    liveRefreshInFlight = true;
    Promise.resolve()
        .then(async () => {
            let nextSignature = '';
            try {
                nextSignature = await fetchDockerStateSignature();
            } catch (_error) {
                nextSignature = '';
            }
            if (!nextSignature) {
                queueLoadlistRefresh();
                return;
            }
            if (nextSignature !== lastLiveRefreshStateSignature) {
                lastLiveRefreshStateSignature = nextSignature;
                queueLoadlistRefresh();
            }
        })
        .finally(() => {
            setTimeout(() => {
                liveRefreshInFlight = false;
            }, 500);
        });
};

const scheduleLiveRefresh = (prefs) => {
    const normalized = utils.normalizePrefs(prefs || {});
    if (normalized.liveRefreshEnabled !== true) {
        clearLiveRefreshTimer();
        return;
    }
    const requestedSeconds = Math.max(10, Math.min(300, Number(normalized.liveRefreshSeconds) || 20));
    const strictMinSeconds = Number(dockerRuntimePerformanceProfile?.minLiveRefreshSeconds || 0);
    const perfMinSeconds = normalized.performanceMode === true
        ? Math.max(PERFORMANCE_MODE_MIN_REFRESH_SECONDS, strictMinSeconds || PERFORMANCE_MODE_MIN_REFRESH_SECONDS)
        : 0;
    const seconds = perfMinSeconds > 0
        ? Math.max(perfMinSeconds, requestedSeconds)
        : requestedSeconds;
    const ms = seconds * 1000;
    if (liveRefreshTimer && liveRefreshMs === ms) {
        return;
    }
    clearLiveRefreshTimer();
    liveRefreshMs = ms;
    liveRefreshTimer = setInterval(runLiveRefreshTick, ms);
};

const applyRuntimePrefs = (prefs) => {
    const normalized = utils.normalizePrefs(prefs || {});
    lastAppliedRuntimePrefs = normalized;
    const appColumnWidth = typeof utils.normalizeAppColumnWidth === 'function'
        ? utils.normalizeAppColumnWidth(normalized.appColumnWidth)
        : (['compact', 'wide'].includes(String(normalized.appColumnWidth || '').toLowerCase()) ? String(normalized.appColumnWidth || '').toLowerCase() : 'standard');
    if (dockerRuntimeAutoAppWidthFloorMode !== appColumnWidth) {
        dockerRuntimeAutoAppWidthFloorMode = appColumnWidth;
        dockerRuntimeAutoAppWidthFloor = null;
    }
    if (document.body && typeof document.body.setAttribute === 'function') {
        document.body.setAttribute('data-fvplus-docker-app-width', appColumnWidth);
    }
    queueDockerRuntimeResizerBind();
    scheduleDockerRuntimeWidthReflow('prefs-change', 0);
    $('body').toggleClass('fvplus-performance-mode', normalized.performanceMode === true);
    $('body').toggleClass('fvplus-performance-mode-strict', dockerRuntimePerformanceProfile?.strict === true);
    scheduleLiveRefresh(normalized);
};

window.toggleDockerRuntimeWidthDebug = (enabled = true) => setDockerRuntimeWidthDebugEnabled(enabled);
window.getDockerRuntimeWidthDebugSnapshot = () => {
    if (!dockerRuntimeWidthState.lastDecision) {
        return null;
    }
    return { ...dockerRuntimeWidthState.lastDecision };
};
window.getDockerRuntimePerfTelemetrySnapshot = () => {
    if (!dockerPerfTelemetry || typeof dockerPerfTelemetry.snapshot !== 'function') {
        return {};
    }
    return dockerPerfTelemetry.snapshot();
};
window.toggleDockerFolderFocus = (id) => toggleDockerFolderFocus(id);
window.toggleDockerFolderPin = (id) => toggleDockerFolderPin(id);
window.toggleDockerFolderLock = (id) => toggleDockerFolderLock(id);

function buildDockerFolderReq() {
    const cacheBust = Date.now();
    const safePrefsReq = createDockerRuntimeRequest(`/plugins/folderview.plus/server/prefs.php?type=docker&_=${cacheBust}`, {
        source: 'prefs',
        label: 'Docker preferences',
        allowFallback: true,
        fallbackValue: JSON.stringify({ ok: false, prefs: {} })
    });
    const generation = ++dockerBootstrapGeneration;
    return {
        generation,
        render: [
            createDockerRuntimeRequest('/plugins/folderview.plus/server/read.php?type=docker', {
                source: 'folders',
                label: 'Docker folder definitions'
            }),
            createDockerRuntimeRequest('/plugins/folderview.plus/server/read_order.php?type=docker', {
                source: 'folder-order',
                label: 'Docker folder order'
            }),
            createDockerRuntimeRequest(buildDockerRuntimeInfoUrl('state', cacheBust), {
                source: 'runtime-info-state',
                label: 'Docker runtime state'
            }),
            safePrefsReq
        ],
        fullInfo: createDockerRuntimeRequest(buildDockerRuntimeInfoUrl('full', cacheBust), {
            source: 'runtime-info-full',
            label: 'Docker runtime details',
            allowFallback: true,
            fallbackValue: JSON.stringify({}),
            fallbackTitle: 'Docker runtime details were partially unavailable',
            fallbackMessage: 'FolderView Plus rendered the Docker page, but advanced Docker runtime details had to fall back after the initial folder view loaded.',
            fallbackLead: 'Docker runtime detail hydration fell back to the lightweight state payload.'
        })
    };
}

// Prime requests for environments where loadlist isn't called first.
folderReq = buildDockerFolderReq();
markDockerFatalBannerStep('Docker request bundle primed');
bindDockerUpdateActionClickCapture();
startDockerListViewModeObserver();

if (FOLDER_VIEW_DEBUG_MODE) {
    console.log('[FV3_DEBUG] Global variables initialized:', {
        cpus, loadedFolder, globalFolders: {...globalFolders}, folderRegex: folderRegex.toString(),
        folderDebugMode, folderDebugModeWindow: [...folderDebugModeWindow],
        folderobserverConfig: {...folderobserverConfig},
        folderReq: {
            generation: folderReq?.generation || 0,
            renderCount: Array.isArray(folderReq?.render) ? folderReq.render.length : 0,
            hasFullInfo: !!folderReq?.fullInfo
        }
    });
}

// Add the button for creating a folder
const createFolderBtn = () => {
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] createFolderBtn: Clicked. Redirecting.');
    recordDockerFatalBannerAction('Docker Add Folder clicked');
    clearFolderEditorPrefill();
    location.href = buildDockerFolderEditorUrl();
};
window.hideAllTips = hideAllTips;
window.addDockerFolderContext = addDockerFolderContext;
window.dropDownButton = dropDownButton;
window.editFolder = editFolder;
window.forceUpdateFolder = forceUpdateFolder;
window.updateFolder = updateFolder;
window.createFolderBtn = createFolderBtn;

// This is needed because unraid don't like the folder and the number are set incorrectly, this intercept the request and change the numbers to make the order appear right, this is important for the autostart and to draw the folders
$.ajaxPrefilter((options, originalOptions, jqXHR) => {
    if (options.url === "/plugins/dynamix.docker.manager/include/UserPrefs.php") {
        if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] ajaxPrefilter (UserPrefs.php): Intercepted.', {...options});
        const data = new URLSearchParams(options.data);
        const containers = data.get('names').split(';');
        let num = "";
        for (let index = 0; index < containers.length - 1; index++) {
            num += index + ';'
        }
        data.set('index', num);
        options.data = data.toString();
        if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] ajaxPrefilter (UserPrefs.php): Modified options.data:', options.data);
    }
});

// activate debug mode
addEventListener("keydown", (e) => {
    if (e.isComposing || e.key.length !== 1) {
        return;
    }
    folderDebugModeWindow.push(e.key);
    if(folderDebugModeWindow.length > 5) {
        folderDebugModeWindow.shift();
    }
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] Keydown event: key='${e.key}'. Debug window: ${folderDebugModeWindow.join('')}`);
    if(folderDebugModeWindow.join('').toLowerCase() === "debug") {
        folderDebugMode = true; // Existing flag
        if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Debug sequence "debug" detected. Set folderDebugMode (existing) to true. Reloading list.');
        loadlist();
    }
});

if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] docker.js: End of script execution.');
})(window, window.jQuery || window.$);
