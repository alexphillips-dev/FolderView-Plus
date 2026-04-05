// @ts-check
const runtimeShared = window.FolderViewDockerRuntimeShared || {};
const runtimeStateObserverModule = window.FolderViewPlusRuntimeStateObservers || null;
const themeResolver = window.FolderViewPlusThemeResolver || null;
const applyVmThemeResolverTokens = (reason = 'vm-runtime:initial', options = {}) => (
    themeResolver && typeof themeResolver.applyResolvedThemeTokens === 'function'
        ? themeResolver.applyResolvedThemeTokens(reason, options)
        : null
);
const localDefaultFolderStatusColors = runtimeShared.DEFAULT_FOLDER_STATUS_COLORS || {
    started: '#ffffff',
    paused: '#b8860b',
    stopped: '#ff4d4d'
};
const normalizeStatusHexColor = typeof runtimeShared.normalizeStatusHexColor === 'function'
    ? runtimeShared.normalizeStatusHexColor
    : ((value, fallback) => fallback);
const getFolderStatusColorOverrides = typeof runtimeShared.getFolderStatusColorOverrides === 'function'
    ? runtimeShared.getFolderStatusColorOverrides
    : (() => ({ started: '', paused: '', stopped: '' }));
const applyFolderStatusColorOverrides = typeof runtimeShared.applyFolderStatusColorOverrides === 'function'
    ? runtimeShared.applyFolderStatusColorOverrides
    : (() => {});
const applyFolderAccentStyle = typeof runtimeShared.applyFolderAccentStyle === 'function'
    ? runtimeShared.applyFolderAccentStyle
    : (() => {});
const applyPreviewBorderStyle = typeof runtimeShared.applyPreviewBorderStyle === 'function'
    ? runtimeShared.applyPreviewBorderStyle
    : (() => {});
const applyFolderDropdownStyle = typeof runtimeShared.applyFolderDropdownStyle === 'function'
    ? runtimeShared.applyFolderDropdownStyle
    : (() => {});
const getPreviewRowLimitValue = typeof runtimeShared.getPreviewRowLimitValue === 'function'
    ? runtimeShared.getPreviewRowLimitValue
    : ((settings = {}) => (settings?.preview_rows ?? settings?.previewRows ?? ''));
const normalizeFolderPreviewRowLimit = typeof runtimeShared.normalizeFolderPreviewRowLimit === 'function'
    ? runtimeShared.normalizeFolderPreviewRowLimit
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
const isCompactMultiRowPreview = typeof runtimeShared.isCompactMultiRowPreview === 'function'
    ? runtimeShared.isCompactMultiRowPreview
    : ((settings = {}) => {
        const normalizedRows = normalizeFolderPreviewRowLimit(settings);
        return normalizedRows === 0 || normalizedRows > 1;
    });
const applyFolderPreviewLayout = typeof runtimeShared.applyFolderPreviewLayout === 'function'
    ? runtimeShared.applyFolderPreviewLayout
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
const flattenPreviewWrappers = typeof runtimeShared.flattenPreviewWrappers === 'function'
    ? runtimeShared.flattenPreviewWrappers
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
const restoreLinearPreviewLayout = typeof runtimeShared.restoreLinearPreviewLayout === 'function'
    ? runtimeShared.restoreLinearPreviewLayout
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
const finalizePreviewRows = typeof runtimeShared.finalizePreviewRows === 'function'
    ? runtimeShared.finalizePreviewRows
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
const createRuntimeDebugLogger = typeof runtimeShared.createDebugLogger === 'function'
    ? runtimeShared.createDebugLogger
    : ((enabled = false) => ({
        log: (...args) => { if (enabled) console.log(...args); },
        warn: (...args) => { if (enabled) console.warn(...args); },
        error: (...args) => { if (enabled) console.error(...args); }
    }));
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
        return typeof runtimeShared.getFolderStatusColors === 'function'
            ? runtimeShared.getFolderStatusColors(settings)
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
const vmFatalBannerRuntimeConfig = (window.FolderViewPlusFatalRuntimeContext && typeof window.FolderViewPlusFatalRuntimeContext === 'object')
    ? window.FolderViewPlusFatalRuntimeContext
    : {};
const VM_FATAL_BANNER_HOST_SELECTOR = String(vmFatalBannerRuntimeConfig.hostSelector || '#fvplus-vm-runtime-banner-host').trim() || '#fvplus-vm-runtime-banner-host';
const createVmRuntimeDiagnosticsBridge = typeof runtimeShared.createRuntimeDiagnosticsBridge === 'function'
    ? runtimeShared.createRuntimeDiagnosticsBridge
    : null;
const vmRuntimeDiagnostics = createVmRuntimeDiagnosticsBridge
    ? createVmRuntimeDiagnosticsBridge({
        context: 'VMs',
        hostSelector: VM_FATAL_BANNER_HOST_SELECTOR,
        runtimeContext: vmFatalBannerRuntimeConfig,
        codePrefix: 'FVPLUS-VM',
        fatalTitle: 'VM runtime failed',
        fatalMessage: 'FolderView Plus could not finish rendering folders on the VMs page.',
        degradedTitle: 'VMs page loaded in degraded mode',
        degradedMessage: 'FolderView Plus kept the VMs page open, but part of the folder runtime did not load.'
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
const markVmFatalBannerStep = (step) => vmRuntimeDiagnostics.markStep(step);
const setVmFatalBannerPhase = (phase) => vmRuntimeDiagnostics.setPhase(phase);
const recordVmFatalBannerAction = (action) => vmRuntimeDiagnostics.recordAction(action);
const setVmFatalBannerModuleStatus = (name, status, detail = '') => vmRuntimeDiagnostics.setModuleStatus(name, status, detail);
const reportVmBootstrapDependencyBanner = (missingModules) => vmRuntimeDiagnostics.reportMissingModules(missingModules, {
    message: 'FolderView Plus could not start because required VM runtime modules failed to load.'
});
const reportVmFatalRuntimeError = (error, options = {}) => vmRuntimeDiagnostics.reportFatalError(error, options);
const reportVmDegradedRuntimeState = (error, options = {}) => vmRuntimeDiagnostics.reportDegradedState(error, options);
const inferVmFatalBannerCategory = (error, fallbackCategory = 'runtime-failed') => vmRuntimeDiagnostics.inferCategory(error, fallbackCategory);
const createVmRuntimeRequest = (url, options = {}) => vmRuntimeDiagnostics.createRequest(url, options);
const vmBootstrapMissingModules = [];
if (!window.FolderViewPlusUtils || typeof window.FolderViewPlusUtils.normalizePrefs !== 'function') {
    vmBootstrapMissingModules.push('folderviewplus.utils.js');
    setVmFatalBannerModuleStatus('folderviewplus.utils.js', 'missing', 'normalizePrefs unavailable');
} else {
    setVmFatalBannerModuleStatus('folderviewplus.utils.js', 'ok', 'normalizePrefs available');
}
if (window.FolderViewPlusThemeResolverModuleLoaded !== true || !themeResolver) {
    vmBootstrapMissingModules.push('folderviewplus.theme-resolver.js');
    setVmFatalBannerModuleStatus('folderviewplus.theme-resolver.js', 'missing', 'theme resolver unavailable');
} else {
    setVmFatalBannerModuleStatus('folderviewplus.theme-resolver.js', 'ok', 'theme resolver ready');
}
if (
    !window.FolderViewPlusRequest
    || typeof window.FolderViewPlusRequest.getJson !== 'function'
    || typeof window.FolderViewPlusRequest.postJson !== 'function'
) {
    vmBootstrapMissingModules.push('folderviewplus.request.js');
    setVmFatalBannerModuleStatus('folderviewplus.request.js', 'missing', 'request client unavailable');
} else {
    setVmFatalBannerModuleStatus('folderviewplus.request.js', 'ok', 'request client ready');
}
if (
    !window.FolderViewDockerRuntimeShared
    || typeof window.FolderViewDockerRuntimeShared.createAsyncActionBoundary !== 'function'
    || typeof window.FolderViewDockerRuntimeShared.applyFolderDropdownStyle !== 'function'
    || typeof createVmRuntimeDiagnosticsBridge !== 'function'
) {
    vmBootstrapMissingModules.push('docker.runtime.shared.js');
    setVmFatalBannerModuleStatus('docker.runtime.shared.js', 'missing', 'shared runtime helpers unavailable');
} else {
    setVmFatalBannerModuleStatus('docker.runtime.shared.js', 'ok', 'shared runtime helpers ready');
}
if (vmBootstrapMissingModules.length > 0) {
    reportVmBootstrapDependencyBanner(vmBootstrapMissingModules);
    const error = new Error(`FolderView Plus VM runtime bootstrap failed. Missing modules: ${vmBootstrapMissingModules.join(', ')}`);
    error.fvplusPhase = 'module-load';
    error.fvplusCategory = 'missing-module';
    if (fatalBanner) {
        error.fvplusBannerShown = true;
    }
    throw error;
}
const VM_HOST_PAGE_REQUIRED_SELECTORS = Object.freeze([
    { label: 'VM table shell', selector: 'table#kvm_table' },
    { label: 'VM table body', selector: 'tbody#kvm_list' },
    { label: 'VM header row', selector: '#kvm_table > thead > tr' }
]);
const collectVmHostPageStructureIssues = () => {
    const missing = [];
    VM_HOST_PAGE_REQUIRED_SELECTORS.forEach((entry) => {
        if (!entry || !entry.selector) {
            return;
        }
        if (!document.querySelector(entry.selector)) {
            missing.push(`${entry.label}: ${entry.selector}`);
        }
    });
    return missing;
};
const ensureVmHostPageStructure = () => {
    const missing = collectVmHostPageStructureIssues();
    if (missing.length <= 0) {
        setVmFatalBannerModuleStatus('host-page-structure', 'ok', 'expected VM host selectors detected');
        return;
    }
    setVmFatalBannerModuleStatus('host-page-structure', 'missing', missing.join(' | '));
    const error = new Error(`Expected VM host page selectors were not found: ${missing.join(', ')}`);
    error.fvplusPhase = 'host-dom';
    error.fvplusCategory = 'host-page-structure';
    reportVmFatalRuntimeError(error, {
        title: 'VM page structure changed',
        message: 'FolderView Plus expected the standard Unraid VM table markup, but required host page elements were missing.',
        code: 'FVPLUS-VM-DOM-001',
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
markVmFatalBannerStep('VM runtime modules resolved');
ensureVmHostPageStructure();
markVmFatalBannerStep('VM host page signature verified');
const vmStorageWriter = typeof utils.createBatchedStorageWriter === 'function'
    ? utils.createBatchedStorageWriter(window.localStorage, {
        defaultDelayMs: 72,
        idleTimeoutMs: 900
    })
    : null;
const createVmRuntimeStateStore = typeof runtimeShared.createRuntimeStateStore === 'function'
    ? runtimeShared.createRuntimeStateStore
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
const createVmAsyncActionBoundary = typeof runtimeShared.createAsyncActionBoundary === 'function'
    ? runtimeShared.createAsyncActionBoundary
    : ({ onError } = {}) => ({
        run: async (actionName, action, context = {}) => {
            try {
                return { ok: true, value: await action() };
            } catch (rawError) {
                const error = rawError instanceof Error ? rawError : new Error(String(rawError || 'Unknown error'));
                if (typeof onError === 'function') {
                    onError(actionName, error, context);
                }
                return { ok: false, error };
            }
        }
    });
const createVmRuntimePerfTelemetry = typeof runtimeShared.createRuntimePerfTelemetry === 'function'
    ? runtimeShared.createRuntimePerfTelemetry
    : () => ({ enabled: false, begin: () => {}, end: () => 0, snapshot: () => ({}) });
const createVmSafeUiActionRunner = typeof runtimeShared.createSafeUiActionRunner === 'function'
    ? runtimeShared.createSafeUiActionRunner
    : () => ({ run: async (_actionKey, action) => ({ ok: true, value: await action() }) });
const createVmContextMenuQuickStripAdapter = typeof runtimeShared.createContextMenuQuickStripAdapter === 'function'
    ? runtimeShared.createContextMenuQuickStripAdapter
    : null;
const resolveVmRuntimePerformanceProfile = typeof runtimeShared.resolveRuntimePerformanceProfile === 'function'
    ? runtimeShared.resolveRuntimePerformanceProfile
    : (prefs = {}, _counts = {}) => ({
        performanceMode: prefs?.performanceMode === true,
        strict: false,
        expandRestoreLimit: null,
        minLiveRefreshSeconds: null
    });
const vmRuntimeStateStore = createVmRuntimeStateStore({
    expandedFolderIds: [],
    inFlightAction: '',
    focusedFolderId: '',
    lockedFolderIds: [],
    pinnedFolderIds: [],
    performanceProfile: null
});
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
    const addDividers = settings?.preview_vertical_bars === true;
    const previewElement = $preview.get(0);
    const availableWidth = Math.max(0, Math.floor($preview.innerWidth() || previewElement?.clientWidth || 0) - 12);
    const gapWidth = 8;
    const dividerWidth = addDividers ? 1 : 0;
    const rows = [];
    let currentRow = [];
    let currentWidth = 0;

    wrappers.forEach((wrapper) => {
        const measuredWidth = Math.max(1, Math.ceil(wrapper.getBoundingClientRect?.().width || $(wrapper).outerWidth() || 0));
        const extraWidth = currentRow.length ? gapWidth + dividerWidth : 0;
        const nextWidth = currentWidth + extraWidth + measuredWidth;
        const canWrap = availableWidth > 0 && currentRow.length > 0 && nextWidth > availableWidth;
        if (canWrap && (rowLimit === 0 || rows.length + 1 < rowLimit)) {
            rows.push(currentRow);
            currentRow = [wrapper];
            currentWidth = measuredWidth;
            return;
        }
        currentRow.push(wrapper);
        currentWidth = nextWidth;
    });
    if (currentRow.length) {
        rows.push(currentRow);
    }

    const visibleRows = rowLimit === 0 ? rows : rows.slice(0, rowLimit);
    finalizePreviewRows($preview, visibleRows, settings);
};
const folderViewPerfFromQuery = (() => {
    try {
        if (!window.location || typeof window.location.search !== 'string' || typeof URLSearchParams !== 'function') {
            return false;
        }
        return new URLSearchParams(window.location.search).get('fvperf') === '1';
    } catch (_error) {
        return false;
    }
})();
const folderViewPerfFromStorage = (() => {
    try {
        return window.localStorage && window.localStorage.getItem('fvplus_perf') === '1';
    } catch (_error) {
        return false;
    }
})();
const FOLDER_VIEW_PERF_MODE = folderViewPerfFromQuery || folderViewPerfFromStorage;
const vmPerfTelemetry = createVmRuntimePerfTelemetry('folderview-plus.vm.actions', FOLDER_VIEW_PERF_MODE);
const vmActionBoundary = createVmAsyncActionBoundary({
    prefix: 'folderview.plus vm',
    onError: (_actionName, error, context = {}) => {
        console.error('folderview.plus vm action failed', error);
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
const vmSafeUiActionRunner = createVmSafeUiActionRunner();
const runVmGuardedAction = async (actionName, action, context = {}) => {
    vmPerfTelemetry.begin(actionName);
    const result = await vmActionBoundary.run(actionName, action, context);
    vmPerfTelemetry.end(actionName, { ok: result.ok });
    return result;
};
const readVmExpandedFolderIdsFromGlobal = () => Object.entries(globalFolders || {})
    .filter(([, folder]) => folder?.status?.expanded === true)
    .map(([id]) => String(id || '').trim())
    .filter((id) => id !== '');
const syncVmRuntimeExpandedStore = () => {
    vmRuntimeStateStore.set({ expandedFolderIds: readVmExpandedFolderIdsFromGlobal() });
};
const runtimeColumnLayout = window.FolderViewPlusRuntimeColumnLayout || null;
const VM_RUNTIME_APP_WIDTH_MIN = 160;
const VM_RUNTIME_APP_WIDTH_MAX = 920;
const VM_RUNTIME_APP_CHROME_WIDTH = 122;
const VM_RUNTIME_APP_TEXT_BUFFER = 12;
const VM_RUNTIME_APP_OVERFLOW_CLIENT_WIDTH_MIN = 28;
const VM_RUNTIME_APP_OVERFLOW_NUDGE_MAX = 56;
const VM_RUNTIME_WIDTH_REFLOW_DEBOUNCE_MS = 72;
const VM_RUNTIME_APP_PRESET_WIDTHS = Object.freeze({
    compact: 190,
    standard: 220,
    wide: 280
});
const vmRuntimeColumnLayoutEngine = runtimeColumnLayout && typeof runtimeColumnLayout.createColumnLayoutEngine === 'function'
    ? runtimeColumnLayout.createColumnLayoutEngine({
        minWidth: VM_RUNTIME_APP_WIDTH_MIN,
        maxWidth: VM_RUNTIME_APP_WIDTH_MAX,
        presetWidths: VM_RUNTIME_APP_PRESET_WIDTHS,
        desktopVarName: '--fvplus-vm-app-column-width',
        mobileVarName: '--fvplus-vm-app-column-width-mobile',
        mobileScale: 0.82,
        mobileMin: 156
    })
    : null;
let vmRuntimeWidthReflowTimer = null;
let vmRuntimeLastWidthReflowReason = 'init';
const VM_DEBUG_MODE = false;
const vmDebug = createRuntimeDebugLogger(VM_DEBUG_MODE, 'folderview.plus vm');
const vmDebugLog = (...args) => vmDebug.log(...args);
const FV_VM_TOUCH_MODE = (() => {
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
const VM_EXPANDED_STATE_KEY = 'fvplus.runtime.expand.vm.v1';
const VM_EXPANDED_STATE_SYNC_DELAY_MS = 220;
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
const readVmServerExpandedStateMap = () => normalizeExpandedStateMap(folderTypePrefs?.expandedFolderState || {});
const writeVmServerExpandedStateMap = (map) => {
    const normalized = normalizeExpandedStateMap(map);
    folderTypePrefs = utils.normalizePrefs({
        ...(folderTypePrefs || {}),
        expandedFolderState: normalized
    });
};
const vmExpandedStateController = runtimeStateObserverModule && typeof runtimeStateObserverModule.createExpandedStateController === 'function'
    ? runtimeStateObserverModule.createExpandedStateController({
        window,
        document,
        $,
        type: 'vm',
        storageKey: VM_EXPANDED_STATE_KEY,
        storageWriter: vmStorageWriter,
        syncDelayMs: VM_EXPANDED_STATE_SYNC_DELAY_MS,
        normalizePrefs: (prefs) => utils.normalizePrefs(prefs || {}),
        readServerMap: () => folderTypePrefs?.expandedFolderState || {},
        writeServerMap: (map) => {
            folderTypePrefs = utils.normalizePrefs({
                ...(folderTypePrefs || {}),
                expandedFolderState: normalizeExpandedStateMap(map)
            });
        },
        readFolders: () => globalFolders || {},
        onPersistFromGlobal: (map) => {
            vmRuntimeStateStore.set({
                expandedFolderIds: Object.entries(map).filter(([, expanded]) => expanded === true).map(([id]) => String(id || ''))
            });
        }
    })
    : null;
const readVmExpandedStateMap = () => vmExpandedStateController ? vmExpandedStateController.readLocalMap() : {};
const writeVmExpandedStateMap = (map) => vmExpandedStateController?.persistStateMap(map, false);
const syncVmExpandedStateToServer = async () => vmExpandedStateController?.syncExpandedStateToServer();
const scheduleVmExpandedStateSync = () => vmExpandedStateController?.scheduleExpandedStateSync();
const buildVmExpandedStateMap = (folders, previousFolders = {}, serverMap = {}) => vmExpandedStateController
    ? vmExpandedStateController.buildStateMap(folders, previousFolders, serverMap)
    : {};
const persistVmExpandedStateMap = (map, syncServer = true) => vmExpandedStateController?.persistStateMap(map, syncServer);
const persistVmExpandedStateFromGlobal = (syncServer = true) => vmExpandedStateController?.persistStateFromGlobal(syncServer);
const readVmExpandedStateFromDom = () => vmExpandedStateController ? vmExpandedStateController.readStateFromDom() : {};
const persistVmExpandedStateFromDom = () => vmExpandedStateController?.persistStateFromDom();
const ensureVmExpandedStateLifecycleHooks = () => vmExpandedStateController?.ensureLifecycleHooks();
const VM_LOCKED_STATE_KEY = 'fvplus.runtime.locked.vm.v1';
let vmFocusedFolderId = String(vmRuntimeStateStore.get('focusedFolderId', '') || '').trim();
const normalizeLockedFolderIdList = (value) => {
    if (!Array.isArray(value)) {
        return [];
    }
    return Array.from(new Set(value.map((entry) => String(entry || '').trim()).filter((entry) => entry !== '')));
};
const readVmLockedFolderIds = () => {
    try {
        const raw = window.localStorage && window.localStorage.getItem(VM_LOCKED_STATE_KEY);
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw);
        return normalizeLockedFolderIdList(parsed);
    } catch (_error) {
        return [];
    }
};
const writeVmLockedFolderIds = (ids) => {
    try {
        if (window.localStorage) {
            const payload = JSON.stringify(normalizeLockedFolderIdList(ids));
            if (vmStorageWriter && typeof vmStorageWriter.setItem === 'function') {
                vmStorageWriter.setItem(VM_LOCKED_STATE_KEY, payload, { delayMs: 70, idle: true });
            } else {
                window.localStorage.setItem(VM_LOCKED_STATE_KEY, payload);
            }
        }
    } catch (_error) {
        // Best effort only.
    }
};
let vmLockedFolderIdSet = new Set(readVmLockedFolderIds());
vmRuntimeStateStore.set({ lockedFolderIds: Array.from(vmLockedFolderIdSet) });
vmRuntimeStateStore.subscribe((nextState, _prevState, patch) => {
    if (patch && Object.prototype.hasOwnProperty.call(patch, 'focusedFolderId')) {
        vmFocusedFolderId = String(nextState.focusedFolderId || '').trim();
    }
});
const isVmFolderLocked = (folderId) => vmLockedFolderIdSet.has(String(folderId || '').trim());
const isVmFolderPinned = (folderId) => {
    const id = String(folderId || '').trim();
    const pinned = Array.isArray(folderTypePrefs?.pinnedFolderIds) ? folderTypePrefs.pinnedFolderIds : [];
    return pinned.includes(id);
};
const getFolderParentId = (folderId) => {
    const id = String(folderId || '').trim();
    if (!id || !globalFolders[id]) {
        return '';
    }
    return normalizeFolderParentId(globalFolders[id]?.parentId || globalFolders[id]?.parent_id || '');
};
const getFolderChildren = (folderId) => {
    const id = String(folderId || '').trim();
    if (!id) {
        return [];
    }
    return Object.entries(globalFolders || {})
        .filter(([childId, folder]) => {
            const parentId = normalizeFolderParentId(folder?.parentId || folder?.parent_id || '');
            return parentId === id && childId !== id;
        })
        .map(([childId]) => childId);
};
const getFolderDescendants = (folderId) => {
    const id = String(folderId || '').trim();
    if (!id) {
        return [];
    }
    const descendants = [];
    const queue = [...getFolderChildren(id)];
    const visited = new Set();
    while (queue.length) {
        const current = String(queue.shift() || '').trim();
        if (!current || visited.has(current)) {
            continue;
        }
        visited.add(current);
        descendants.push(current);
        queue.push(...getFolderChildren(current));
    }
    return descendants;
};
const getFolderAncestors = (folderId) => {
    const ancestors = [];
    let current = getFolderParentId(folderId);
    const visited = new Set();
    while (current && !visited.has(current)) {
        visited.add(current);
        ancestors.push(current);
        current = getFolderParentId(current);
    }
    return ancestors;
};
const folderHasChildren = (folderId) => getFolderChildren(folderId).length > 0;
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
const applyVmFolderQuickActionState = (folderId) => {
    const id = String(folderId || '').trim();
    if (!id) {
        return;
    }
    const $row = $(`tr.folder-id-${id}`);
    if (!$row.length) {
        return;
    }
    const pinned = isVmFolderPinned(id);
    const locked = isVmFolderLocked(id);
    const focused = vmFocusedFolderId === id;
    $row.toggleClass('fv-folder-pinned', pinned);
    $row.toggleClass('fv-folder-locked', locked);
    $row.toggleClass('fv-folder-focused', focused);
};
const refreshVmFolderQuickActionStates = () => {
    for (const id of Object.keys(globalFolders || {})) {
        applyVmFolderQuickActionState(id);
    }
};
const applyVmFocusedFolderState = () => {
    const focusId = String(vmFocusedFolderId || '').trim();
    if (!focusId || !globalFolders[focusId]) {
        vmRuntimeStateStore.set({ focusedFolderId: '' });
        vmFocusedFolderId = '';
        $('body').removeClass('fv-folder-focus-active');
        $('#kvm_list > tr').removeClass('fv-folder-focus-hidden');
        refreshVmFolderQuickActionStates();
        return;
    }
    const visibleSet = getFocusedFolderVisibleSet(focusId);
    $('body').addClass('fv-folder-focus-active');
    $('#kvm_list > tr').each((_, row) => {
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
    refreshVmFolderQuickActionStates();
};
const toggleVmFolderFocus = (folderId) => {
    const id = String(folderId || '').trim();
    if (!id || !globalFolders[id]) {
        return;
    }
    const nextFocus = (vmFocusedFolderId === id) ? '' : id;
    vmRuntimeStateStore.set({ focusedFolderId: nextFocus });
    vmFocusedFolderId = nextFocus;
    applyVmFocusedFolderState();
    scheduleVmRuntimeWidthReflow('focus-toggle', 24);
};
const toggleVmFolderLock = (folderId) => {
    const id = String(folderId || '').trim();
    if (!id || !globalFolders[id]) {
        return;
    }
    if (isVmFolderLocked(id)) {
        vmLockedFolderIdSet.delete(id);
    } else {
        vmLockedFolderIdSet.add(id);
    }
    writeVmLockedFolderIds(Array.from(vmLockedFolderIdSet));
    vmRuntimeStateStore.set({ lockedFolderIds: Array.from(vmLockedFolderIdSet) });
    refreshVmFolderQuickActionStates();
};
const applyVmPinnedFolderIds = (nextPinnedIds) => {
    folderTypePrefs = utils.normalizePrefs({
        ...(folderTypePrefs || {}),
        pinnedFolderIds: Array.isArray(nextPinnedIds) ? [...nextPinnedIds] : []
    });
    vmRuntimeStateStore.set({ pinnedFolderIds: Array.isArray(nextPinnedIds) ? [...nextPinnedIds] : [] });
};
const persistVmPinnedFolderIds = async (nextPinnedIds) => {
    const payload = {
        type: 'vm',
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
const toggleVmFolderPin = async (folderId) => {
    const id = String(folderId || '').trim();
    if (!id || !globalFolders[id]) {
        return;
    }
    return vmSafeUiActionRunner.run(`vm-pin:${id}`, async () => {
        const current = Array.isArray(folderTypePrefs?.pinnedFolderIds) ? [...folderTypePrefs.pinnedFolderIds] : [];
        const nextPinned = current.includes(id)
            ? current.filter((entry) => entry !== id)
            : [...current, id];
        applyVmPinnedFolderIds(nextPinned);
        refreshVmFolderQuickActionStates();
        const result = await runVmGuardedAction('toggle-folder-pin', async () => {
            const response = await persistVmPinnedFolderIds(nextPinned);
            applyVmPinnedFolderIds(Array.isArray(response?.prefs?.pinnedFolderIds) ? response.prefs.pinnedFolderIds : nextPinned);
            refreshVmFolderQuickActionStates();
        }, {
            userMessage: 'Failed to update pinned folders.',
            userVisible: false
        });
        if (!result.ok) {
            applyVmPinnedFolderIds(current);
            refreshVmFolderQuickActionStates();
        }
    });
};
const ensureVmFolderUnlocked = (id, actionLabel = 'This action') => {
    if (!isVmFolderLocked(id)) {
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
const folderSettingsTransferModule = window.FolderViewPlusFolderSettingsTransfer || null;
const getFolderSettingsTransferApi = (() => {
    let cachedApi = null;
    return () => {
        if (cachedApi || !folderSettingsTransferModule || typeof folderSettingsTransferModule.createApi !== 'function') {
            return cachedApi;
        }
        cachedApi = folderSettingsTransferModule.createApi({ window });
        return cachedApi;
    };
})();
if (FV_VM_TOUCH_MODE) {
    document.body.classList.add('fv-touch-device');
}

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
    const desiredFolderTokens = Object.keys(getPrefsOrderedFolderMap(folderMap, prefs))
        .map((id) => `folder-${id}`);
    if (!desiredFolderTokens.length) {
        return order;
    }
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

const postVmJsonWithFallback = async (url, payload, options = {}) => {
    const request = window.FolderViewPlusRequest;
    if (request && typeof request.postJson === 'function') {
        try {
            return await request.postJson(url, payload, options);
        } catch (_error) {
            // Fall through to the legacy POST path if the request client is not ready.
        }
    }
    const response = await $.post(url, payload).promise();
    return parseJsonPayloadSafe(response);
};

const normalizeVmStateToken = (entry, fromStateMode = false) => {
    if (!entry || typeof entry !== 'object') {
        return 's:0';
    }
    if (fromStateMode) {
        const state = String(entry.state || '').toLowerCase();
        const autostart = entry.autostart === true ? '1' : '0';
        return `${state || 'stopped'}:${autostart}`;
    }
    const state = String(entry.state || '').toLowerCase();
    const autostart = entry.autostart ? '1' : '0';
    return `${state || 'stopped'}:${autostart}`;
};

const buildVmStateSignature = (source, fromStateMode = false) => {
    const map = source && typeof source === 'object' ? source : {};
    const names = Object.keys(map).sort((a, b) => a.localeCompare(b));
    if (!names.length) {
        return '';
    }
    const tokens = names.map((name) => `${name}:${normalizeVmStateToken(map[name], fromStateMode)}`);
    return tokens.join('|');
};

const buildVmFolderMatchCache = (orderSnapshot, vmInfo, folders, prefs) => {
    const folderMap = folders && typeof folders === 'object' ? folders : {};
    const infoByName = vmInfo && typeof vmInfo === 'object' ? vmInfo : {};
    const names = (Array.isArray(orderSnapshot) ? orderSnapshot : [])
        .filter((entry) => entry && !folderRegex.test(entry) && Object.prototype.hasOwnProperty.call(infoByName, entry));
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
        const ruleMatches = utils.getAutoRuleMatches({
            rules,
            folderId,
            names,
            infoByName,
            type: 'vm'
        });
        cache[folderId] = {
            explicit,
            regex: regexMatches,
            rules: ruleMatches
        };
    }
    return cache;
};

const removeRuntimeHealthBadge = () => {
    const existing = document.getElementById('fv-runtime-health-badge-vm');
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

    const table = document.querySelector('#kvm_list')?.closest('table');
    const host = table?.parentElement || document.querySelector('#kvm_list')?.parentElement;
    if (!host) {
        return;
    }
    let badge = document.getElementById('fv-runtime-health-badge-vm');
    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'fv-runtime-health-badge-vm';
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

const showVmRuntimeLoadingRow = () => {
    const tbody = $('tbody#kvm_list');
    if (!tbody.length || tbody.find('tr.fv-runtime-loading-row').length) {
        return;
    }
    tbody.prepend('<tr class="fv-runtime-loading-row"><td colspan="12"><i class="fa fa-circle-o-notch fa-spin"></i> Loading VM folders...</td></tr>');
};

const hideVmRuntimeLoadingRow = () => {
    $('tbody#kvm_list tr.fv-runtime-loading-row').remove();
};

let createFoldersInFlight = false;
let createFoldersQueued = false;

/**
 * Handles the creation of all folders
 */
const createFolders = async () => {
    vmPerfTelemetry.begin('createFolders.total');
    showVmRuntimeLoadingRow();
    setVmFatalBannerPhase('bootstrap-data');
    try {
    ensureVmExpandedStateLifecycleHooks();
    markVmFatalBannerStep('VM runtime lifecycle hooks ready');
    persistVmExpandedStateFromDom();
    const previousFolders = (globalFolders && typeof globalFolders === 'object') ? globalFolders : {};
    const prom = await Promise.all(folderReq);
    markVmFatalBannerStep('VM runtime request bundle resolved');
    // Parse the results
    let folders = JSON.parse(prom[0]);
    let unraidOrder = Object.values(JSON.parse(prom[1]));
    const vmInfo = JSON.parse(prom[2]);
    let order = Object.values(JSON.parse(prom[3]));
    let prefsResponse = {};
    try {
        prefsResponse = prom[4] ? JSON.parse(prom[4]) : {};
    } catch (error) {
        prefsResponse = {};
    }
    folderTypePrefs = utils.normalizePrefs(prefsResponse?.prefs || {});
    resolveVmStrictPerformanceProfile(folderTypePrefs, folders, vmInfo);
    applyVmPinnedFolderIds(Array.isArray(folderTypePrefs?.pinnedFolderIds) ? folderTypePrefs.pinnedFolderIds : []);
    const folderDepthById = buildFolderDepthById(folders);
    unraidOrder = reorderFolderSlotsInBaseOrder(unraidOrder, folders, folderTypePrefs);
    applyRuntimePrefs(folderTypePrefs);
    lastLiveRefreshStateSignature = buildVmStateSignature(vmInfo, false);
    

    
    // Filter the webui order to get the container that aren't in the order, this happen when a new container is created
    let newOnes = order.filter(x => !unraidOrder.includes(x));

    // Insert the folder in the unraid folder into the order shifted by the unlisted containers
    for (let index = 0; index < unraidOrder.length; index++) {
        const element = unraidOrder[index];
        if((folderRegex.test(element) && folders[element.slice(7)])) {
            order.splice(index+newOnes.length, 0, element);
        }
    }

    // debug mode, download the debug json file
    if(folderDebugMode) {
        const debugData = JSON.stringify({
            version: (await $.get('/plugins/folderview.plus/server/version.php').promise()).trim(),
            folders,
            unraidOrder,
            originalOrder: JSON.parse(await $.get('/plugins/folderview.plus/server/read_unraid_order.php?type=vm').promise()),
            newOnes,
            order,
            vmInfo
        });
        const blob = new Blob([debugData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const element = document.createElement('a');
        element.href = url;
        element.download = 'debug-VM.json';
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        URL.revokeObjectURL(url);
        vmDebugLog('Order:', [...order]);
    }

    let foldersDone = {};

    folderEvents.dispatchEvent(new CustomEvent('vm-pre-folders-creation', {detail: {
        folders: folders,
        order: order,
        vmInfo: vmInfo
    }}));
    const folderMatchCache = buildVmFolderMatchCache(order, vmInfo, folders, folderTypePrefs);

    // Draw the folders in the order
    for (let key = 0; key < order.length; key++) {
        const container = order[key];
        if (container && folderRegex.test(container)) {
            let id = container.replace(folderRegex, '');
            if (folders[id]) {
                key -= createFolder(
                    folders[id],
                    id,
                    key,
                    order,
                    vmInfo,
                    Object.keys(foldersDone),
                    folderMatchCache[id] || null,
                    folderDepthById[id] || 0
                );
                key -= newOnes.length;
                // Move the folder to the done object and delete it from the undone one
                foldersDone[id] = folders[id];
                delete folders[id];
            }
        }
    }

    // Draw the foldes outside of the order
    // Preserve original folder order when inserting at the top with unshift.
    const remainingFolders = Object.entries(getPrefsOrderedFolderMap(folders, folderTypePrefs)).reverse();
    for (const [id, value] of remainingFolders) {
        // Add the folder on top of the array
        order.unshift(`folder-${id}`);
        createFolder(
            value,
            id,
            0,
            order,
            vmInfo,
            Object.keys(foldersDone),
            folderMatchCache[id] || null,
            folderDepthById[id] || 0
        );
        // Move the folder to the done object and delete it from the undone one
        foldersDone[id] = folders[id];
        delete folders[id];
    }

    // Expand folders from remembered runtime state (fallback: previous in-memory state, then expand_tab).
    const expandedStateById = buildVmExpandedStateMap(
        foldersDone,
        previousFolders,
        readVmServerExpandedStateMap()
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
        ? Number(vmRuntimePerformanceProfile?.expandRestoreLimit || PERFORMANCE_MODE_EXPAND_RESTORE_LIMIT)
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
        dropDownButton(id, false);
        restoredExpansionCount++;
    }

    folderEvents.dispatchEvent(new CustomEvent('vm-post-folders-creation', {detail: {
        folders: folders,
        order: order,
        vmInfo: vmInfo
    }}));

    // Assing the folder done to the global object
    globalFolders = foldersDone;
    refreshVmFolderQuickActionStates();
    applyVmFocusedFolderState();
    syncVmRuntimeExpandedStore();
    persistVmExpandedStateFromGlobal();
    renderRuntimeHealthBadge(globalFolders, folderTypePrefs);
    scheduleVmRuntimeWidthReflow('create-folders', 0);

    folderDebugMode  = false;
    markVmFatalBannerStep('VM folders rendered');
    setVmFatalBannerPhase('ready');
    recordVmFatalBannerAction('VM folders rendered successfully');
    } catch (error) {
        reportVmFatalRuntimeError(error, {
            phase: error?.fvplusPhase || 'bootstrap-data',
            category: error?.fvplusCategory || inferVmFatalBannerCategory(error, 'runtime-failed')
        });
        throw error;
    } finally {
        hideVmRuntimeLoadingRow();
        vmPerfTelemetry.end('createFolders.total', {
            folderCount: Object.keys(globalFolders || {}).length,
            strictPerf: vmRuntimePerformanceProfile?.strict === true
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
                reportVmFatalRuntimeError(error, {
                    phase: error?.fvplusPhase || 'runtime',
                    category: error?.fvplusCategory || inferVmFatalBannerCategory(error, 'promise-rejection')
                });
            }
        })
        .finally(() => {
            createFoldersInFlight = false;
            if (createFoldersQueued) {
                createFoldersQueued = false;
                queueLoadlistRefresh();
            }
        });
};

/**
 * Handles the creation of one folder
 * @param {object} folder the folder
 * @param {string} id if of the folder
 * @param {int} position position to inset the folder
 * @param {Array<string>} order order of vms
 * @param {object} vmInfo info of the vms
 * @param {Array<string>} foldersDone folders that are done
 * @param {object|null} matchCacheEntry precomputed membership candidates
 * @param {number} depthLevel visual nesting depth for parent/child folders
 * @returns the number of element removed before the folder
 */
const createFolder = (folder, id, position, order, vmInfo, foldersDone, matchCacheEntry = null, depthLevel = 0) => {
    if (vmRuntimePerformanceProfile?.performanceMode === true && folder && typeof folder === 'object') {
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

    folderEvents.dispatchEvent(new CustomEvent('vm-pre-folder-creation', {detail: {
        folder: folder,
        id: id,
        position: position,
        order: order,
        vmInfo: vmInfo,
        foldersDone: foldersDone
    }}));

    // default varibles
    let started = 0;
    let paused = 0;
    let stopped = 0;
    let autostart = 0;
    let autostartStarted = 0;
    let remBefore = 0;

    const precomputed = matchCacheEntry && typeof matchCacheEntry === 'object' ? matchCacheEntry : null;
    const combinedMembers = [];
    const combinedSet = new Set();
    const pushCombined = (name) => {
        const key = String(name || '').trim();
        if (!key || combinedSet.has(key) || !vmInfo[key]) {
            return;
        }
        combinedSet.add(key);
        combinedMembers.push(key);
    };
    const explicit = precomputed
        ? (Array.isArray(precomputed.explicit) ? precomputed.explicit : [])
        : (Array.isArray(folder.containers) ? folder.containers : []);
    explicit.forEach(pushCombined);

    let regexMatches = [];
    if (precomputed && Array.isArray(precomputed.regex)) {
        regexMatches = precomputed.regex;
    } else if (folder.regex && typeof folder.regex === 'string' && folder.regex.trim() !== "") {
        try {
            const regex = new RegExp(folder.regex);
            regexMatches = order.filter((el) => vmInfo[el] && regex.test(el));
        } catch (e) {
            regexMatches = [];
            console.warn(`folderview.plus: Invalid regex "${folder.regex}" in VM folder "${folder.name}"`);
        }
    }
    regexMatches.forEach(pushCombined);

    const ruleMatches = precomputed && Array.isArray(precomputed.rules)
        ? precomputed.rules
        : utils.getAutoRuleMatches({
            rules: folderTypePrefs.autoRules || [],
            folderId: id,
            names: order,
            infoByName: vmInfo,
            type: 'vm'
        });
    ruleMatches.forEach(pushCombined);

    const lazyPreviewEnabled = folderTypePrefs?.lazyPreviewEnabled === true;
    const lazyPreviewThreshold = Number(folderTypePrefs?.lazyPreviewThreshold || 30);
    const isExpandedByDefault = folder?.settings?.expand_tab === true;
    const lazyPreviewActive = lazyPreviewEnabled
        && Number.isFinite(lazyPreviewThreshold)
        && combinedMembers.length >= Math.max(10, Math.min(200, Math.round(lazyPreviewThreshold)))
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

    // the HTML template for the folder
    const totalCols = document.querySelector("#kvm_table > thead > tr").childElementCount;
    const colspan = totalCols - 2; // minus name + autostart columns
    const hoverClass = folder.settings.preview_hover && !FV_VM_TOUCH_MODE ? 'hover' : '';
    const safeFolderIcon = sanitizeImageSrc(folder.icon);
    const safeFolderName = escapeHtml(folder.name);
    const pinned = isVmFolderPinned(id);
    const locked = isVmFolderLocked(id);
    const focused = vmFocusedFolderId === id;
    const lockedClass = locked ? 'fv-folder-locked' : '';
    const pinnedClass = pinned ? 'fv-folder-pinned' : '';
    const focusedClass = focused ? 'fv-folder-focused' : '';
    const fld = `<tr parent-id="${id}" class="sortable folder-id-${id} ${hoverClass} ${lockedClass} ${pinnedClass} ${focusedClass} folder"><td class="vm-name folder-name"><div class="folder-name-sub"><i class="fa fa-arrows-v mover orange-text"></i><span class="outer folder-outer"><span id="${id}" onclick='addVMFolderContext("${id}")' class="hand folder-hand"><img src="${safeFolderIcon}" class="img folder-img" onerror='this.src="/plugins/dynamix.docker.manager/images/question.png"'></span><span class="inner folder-inner"><a class="folder-appname" href="#" onclick='editFolder("${id}")'>${safeFolderName}</a><a class="folder-appname-id">folder-${id}</a><br><i id="load-folder-${id}" class="fa fa-square stopped folder-load-status"></i><span class="state folder-state fv-folder-state-stopped"> ${$.i18n('stopped')}</span></span></span><button class="dropDown-${id} folder-dropdown" onclick='dropDownButton("${id}")'><i class="fa fa-chevron-down" aria-hidden="true"></i></button></div></td><td colspan="${colspan}" class="folder-preview-cell"><div class="folder-storage"></div><div class="folder-preview"></div></td><td class="folder-autostart"><input class="autostart" type="checkbox" id="folder-${id}-auto" style="display:none"></td></tr><tr child-id="${id}" id="name-${id}" style="display:none"><td colspan="${totalCols}" style="margin:0;padding:0"></td></tr>`;

    // insertion at position of the folder
    if (position === 0) {
        $('#kvm_list > tr.sortable').eq(position).before($(fld));
    } else {
        $('#kvm_list > tr.sortable').eq(position - 1).next().after($(fld));
    }
    const safeDepth = Math.max(0, Math.min(8, Number(depthLevel) || 0));
    const depthIndentPx = safeDepth * 20;
    $(`tr.folder-id-${id}`)
        .attr('data-folder-depth', String(safeDepth))
        .find('.folder-name-sub')
        .css('padding-left', `${depthIndentPx}px`);
    applyVmFolderQuickActionState(id);

    const $preview = $(`tr.folder-id-${id} div.folder-preview`);
    const previewNode = $preview.get(0);
    applyPreviewBorderStyle(previewNode, folder.settings);
    applyFolderDropdownStyle($(`tr.folder-id-${id}`), folder.settings);
    $preview.addClass(`folder-preview-${folder.settings.preview}`);
    applyFolderPreviewLayout($preview, folder.settings);

    // select the preview function to use
    let addPreview;
    switch (folder.settings.preview) {
        case 1:
            addPreview = (id, autostart) => {
                $(`tr.folder-id-${id} div.folder-preview`).append($(`tr.folder-id-${id} div.folder-storage > tr > td.vm-name > span.outer:last`).clone().addClass(`${autostart ? 'autostart' : ''}`));
            };
            break;
        case 2:
            addPreview = (id, autostart) => {
                $(`tr.folder-id-${id} div.folder-preview`).append($(`tr.folder-id-${id} div.folder-storage > tr > td.vm-name > span.outer > span.hand:last`).clone().addClass(`${autostart ? 'autostart' : ''}`));
            };
            break;
        case 3:
            addPreview = (id, autostart) => {
                $(`tr.folder-id-${id} div.folder-preview`).append($(`tr.folder-id-${id} div.folder-storage > tr > td.vm-name > span.outer > span.inner:last`).clone().addClass(`${autostart ? 'autostart' : ''}`));
            };
            break;
        case 4:
            addPreview = (id, autostart) => {
                let lstSpan = $(`tr.folder-id-${id} div.folder-preview > span.outer:last`);
                if(!lstSpan[0] || lstSpan.children().length >= 2) {
                    $(`tr.folder-id-${id} div.folder-preview`).append($('<span class="outer"></span>'));
                    lstSpan = $(`tr.folder-id-${id} div.folder-preview > span.outer:last`);
                }
                lstSpan.append($('<span class="inner"></span>'));
                lstSpan.children('span.inner:last').append($(`tr.folder-id-${id} div.folder-storage > tr > td.vm-name > span.outer > span.inner > a:last`).clone().addClass(`${autostart ? 'autostart' : ''}`))
            };
            break;
        default:
            addPreview = (id) => { };
            break;
    }

    // new folder is needed for not altering the old containers
    let newFolder = {};

    // foldersDone is and array of only ids there is the need to add the 'folder-' in front
    foldersDone = foldersDone.map(e => 'folder-'+e);

    // remove the undone folders from the order, needed because they can cause an offset when grabbing the containers
    const cutomOrder = order.filter((e) => {
        return e && (foldersDone.includes(e) || !(folderRegex.test(e) && e !== `folder-${id}`));
    });

    // loop over the containers
    for (const container of combinedMembers) {

        // get both index, tis is needed for removing from the orders later
        const index = cutomOrder.indexOf(container);
        const offsetIndex = order.indexOf(container);

        folderEvents.dispatchEvent(new CustomEvent('vm-pre-folder-preview', {detail: {
            folder: folder,
            id: id,
            position: position,
            order: order,
            vmInfo: vmInfo,
            foldersDone: foldersDone,
            container: container,
            vm: vmInfo[container],
            index: index,
            offsetIndex: offsetIndex
        }}));

        if (index > -1) {

            const ct = vmInfo[container];
            if (!ct) {
                continue;
            }

            // Keep track of removed elements before the folder to set back the for loop for creating folders, otherwise folder will be skipped
            if(offsetIndex < position) {
                remBefore += 1;
            }

            // remove the containers from the order
            cutomOrder.splice(index, 1);
            order.splice(offsetIndex, 1);

            // add the id to the container name
            newFolder[container] = {};
            newFolder[container].id = ct.uuid;
            newFolder[container].state = ct.state;

            // grab the container by name and put it onto the storage
            let $vmTR = $('#kvm_list > tr.sortable').filter(function() {
                return $(this).find('td.vm-name span.outer span.inner a').first().text().trim() === container;
            }).first();
            $(`tr.folder-id-${id} div.folder-storage`).append($vmTR.addClass(`folder-${id}-element`).addClass(`folder-element`).removeClass('sortable'));

            if(folderDebugMode) {
                vmDebugLog(`${newFolder[container].id}(${offsetIndex}, ${index}) => ${id}`);
            }
            
            addPreview(id, ct.autostart);
            $(`tr.folder-id-${id} div.folder-preview span.inner > a`).css("width", folder.settings.preview_text_width || '');

            // element to set the preview options
            const element = $(`tr.folder-id-${id} div.folder-preview > span:last`);

            //temp var
            let sel;

            //set the preview option

            if (folder.settings.preview_grayscale) {
                sel = element.children('span.hand').children('img.img');
                if (!sel.length) {
                    sel = element.children('img.img');
                }
                sel.css('filter', 'grayscale(100%)');
            }

            if (folder.settings.preview_logs && ct.logs) {
                sel = element.children('span.inner').last();
                if (!sel.length) {
                    sel = element;
                }
                sel.append($(`<span class="folder-element-custom-btn folder-element-logs"><a href="#" onclick="openTerminal('log', '${container}', '${ct.logs}')"><i class="fa fa-bars" aria-hidden="true"></i></a></span>`));
            }

            // set the status of the folder
            if (ct.state === "running") {
                started += 1;
            } else if (ct.state === "paused" || ct.state === "pmsuspended" || ct.state === "unknown") {
                paused += 1;
            } else {
                stopped += 1;
            }
            autostart += ct.autostart ? 1 : 0;
            autostartStarted += (ct.autostart && ct.state!=="shutoff") ? 1 : 0;

            folderEvents.dispatchEvent(new CustomEvent('vm-post-folder-preview', {detail: {
                folder: folder,
                id: id,
                position: position,
                order: order,
                vmInfo: vmInfo,
                foldersDone: foldersDone,
                vm: container,
                ct: vmInfo[container],
                index: index,
                offsetIndex: offsetIndex,
                states: {
                    started,
                    autostart,
                    autostartStarted
                }
            }}));
        }
    }

    // set the border on the last element
    $(`.folder-${id}-element:last`).css('border-bottom', '1px solid rgba(128, 128, 128, 0.3)');

    // replace the old containers array with the newFolder object
    folder.containers = newFolder;

    // wrap the preview with a div
    $preview.children('span').wrap('<div class="folder-preview-wrapper"></div>');
    applyFolderPreviewLayout($preview, folder.settings);
    layoutFolderPreviewRows($preview, folder.settings);

    //set tehe status of a folder

    const total = Object.entries(folder.containers).length;
    if (folderTypePrefs?.hideEmptyFolders === true && total === 0) {
        $(`tr.folder-id-${id}`).remove();
        $(`tr#name-${id}`).remove();
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
    if (folderStatusKind === 'running' && !showRunningBadge) {
        $(`tr.folder-id-${id} i#load-folder-${id}`).hide();
    }
    if (folderStatusKind === 'stopped' && !showStoppedBadge) {
        $(`tr.folder-id-${id} i#load-folder-${id}`).hide();
    }


    // Initialize switchButton with the correct checked state directly â€” no click() needed.
    // This prevents the bug where checked:false + click() could fire a change event
    // that propagates to folderAutostart and resets VM autostart settings.
    const folderHasAutostart = autostart > 0;
    $(`#folder-${id}-auto`).switchButton({ labels_placement: 'right', off_label: $.i18n('off'), on_label: $.i18n('on'), checked: folderHasAutostart });

    if(autostart === 0) {
        $(`tr.folder-id-${id}`).addClass('no-autostart');
    } else if (autostart > 0 && autostartStarted === 0) {
        $(`tr.folder-id-${id}`).addClass('autostart-off');
    } else if (autostart > 0 && autostartStarted > 0 && autostart !== autostartStarted) {
        $(`tr.folder-id-${id}`).addClass('autostart-partial');
    } else if (autostart > 0 && autostartStarted > 0 && autostart === autostartStarted) {
        $(`tr.folder-id-${id}`).addClass('autostart-full');
    }

    // set the status
    folder.status = {};
    folder.status.started = started;
    folder.status.paused = paused;
    folder.status.stopped = stopped;
    folder.status.autostart = autostart;
    folder.status.autostartStarted = autostartStarted;
    folder.status.expanded = false;

    // Attach handler AFTER switchButton is fully initialized with correct state
    $(`#folder-${id}-auto`).off("change", folderAutostart).on("change", folderAutostart);

    folderEvents.dispatchEvent(new CustomEvent('vm-post-folder-creation', {detail: {
        folder: folder,
        id: id,
        position: position,
        order: order,
        vmInfo: vmInfo,
        foldersDone: foldersDone
    }}));

    return remBefore;
};

/**
 * Hanled the click of the autostart button and changes the container to reflect the status of the folder
 * @param {*} el element passed by the event caller
 */
const folderAutostart = (el) => {
    const status = el.target.checked;
    // The id is needded to get the containers, the checkbox has a id folder-${id}-auto, so split and take the second element
    const id = el.target.id.split('-')[1];
    const containers = $(`tr.folder-${id}-element`);
    for (const container of containers) {
        // Select the td with the switch inside
        const el = $(container).children().last();

        // Get the status of the container
        const cstatus = el.children('.autostart')[0].checked;
        if ((status && !cstatus) || (!status && cstatus)) {
            el.children('.switch-button-background').click();
        }
    }
};

/**
 * Handle the dropdown expand button of folders
 * @param {string} id the id of the folder
 */
const dropDownButton = (id, persistState = true) => {
    folderEvents.dispatchEvent(new CustomEvent('vm-pre-folder-expansion', {detail: { id }}));
    const element = $(`.dropDown-${id}`);
    const state = element.attr('active') === "true";
    if (state) {
        element.children().removeClass('fa-chevron-up').addClass('fa-chevron-down');
        $(`tr.folder-id-${id}`).addClass('sortable');
        $(`tr.folder-id-${id} .folder-storage`).append($(`.folder-${id}-element`));
        element.attr('active', 'false');
    } else {
        element.children().removeClass('fa-chevron-down').addClass('fa-chevron-up');
        $(`tr.folder-id-${id}`).removeClass('sortable').removeClass('ui-sortable-handle').off().css('cursor', '');
        $(`tr.folder-id-${id}`).after($(`.folder-${id}-element`));
        $(`.folder-${id}-element > td > i.fa-arrows-v`).remove();
        element.attr('active', 'true');
    }
    if(globalFolders[id]) {
        globalFolders[id].status.expanded = !state;
    }
    syncVmRuntimeExpandedStore();
    if (persistState) {
        persistVmExpandedStateFromGlobal();
    }
    scheduleVmRuntimeWidthReflow('folder-expand-toggle', 32);
    folderEvents.dispatchEvent(new CustomEvent('vm-post-folder-expansion', {detail: { id }}));
};

const readVmFolderContainerNames = (containers) => {
    if (Array.isArray(containers)) {
        return Array.from(new Set(containers.map((item) => String(item || '').trim()).filter((item) => item !== '')));
    }
    if (containers && typeof containers === 'object') {
        return Array.from(new Set(Object.keys(containers).map((item) => String(item || '').trim()).filter((item) => item !== '')));
    }
    return [];
};

const getScopedVmRuntimeContainersForFolder = (folderId, includeDescendants = true) => {
    const id = String(folderId || '').trim();
    if (!id || !globalFolders[id]) {
        return {};
    }
    const targetIds = includeDescendants ? [id, ...getFolderDescendants(id)] : [id];
    const collected = {};
    for (const targetId of targetIds) {
        const folder = globalFolders[targetId];
        if (!folder || !folder.containers) {
            continue;
        }
        const containerNames = readVmFolderContainerNames(folder.containers);
        const sourceMap = !Array.isArray(folder.containers) ? folder.containers : {};
        for (const name of containerNames) {
            const key = String(name || '').trim();
            if (!key || Object.prototype.hasOwnProperty.call(collected, key)) {
                continue;
            }
            const source = sourceMap?.[key] && typeof sourceMap[key] === 'object' ? sourceMap[key] : {};
            collected[key] = {
                name: key,
                id: String(source?.id || '').trim(),
                state: String(source?.state || '').trim().toLowerCase()
            };
        }
    }
    return collected;
};

const summarizeVmFolderActionCounts = (containersMap) => {
    const summary = {
        total: 0,
        startable: 0,
        stoppable: 0,
        pausable: 0,
        resumable: 0,
        restartable: 0,
        hibernateable: 0,
        destroyable: 0
    };
    for (const entry of Object.values(containersMap || {})) {
        const state = String(entry?.state || '').toLowerCase();
        summary.total += 1;
        const canStart = state !== 'running' && state !== 'pmsuspended' && state !== 'paused' && state !== 'unknown';
        const canRunningOnly = state === 'running';
        const canResume = state === 'paused' || state === 'unknown' || state === 'pmsuspended';
        const canForceStop = state === 'running' || state === 'pmsuspended' || state === 'paused' || state === 'unknown';
        if (canStart) summary.startable += 1;
        if (canRunningOnly) {
            summary.stoppable += 1;
            summary.pausable += 1;
            summary.restartable += 1;
            summary.hibernateable += 1;
        }
        if (canResume) summary.resumable += 1;
        if (canForceStop) summary.destroyable += 1;
    }
    return summary;
};

const expandVmFolderBranch = (id) => {
    const branchIds = [String(id || '').trim(), ...getFolderDescendants(id)];
    for (const folderId of branchIds) {
        if (!folderId || !globalFolders[folderId]) {
            continue;
        }
        if (globalFolders[folderId]?.status?.expanded !== true) {
            dropDownButton(folderId, false);
        }
    }
    persistVmExpandedStateFromGlobal();
};

const collapseVmFolderBranch = (id) => {
    const branchIds = [String(id || '').trim(), ...getFolderDescendants(id)].reverse();
    for (const folderId of branchIds) {
        if (!folderId || !globalFolders[folderId]) {
            continue;
        }
        if (globalFolders[folderId]?.status?.expanded === true) {
            dropDownButton(folderId, false);
        }
    }
    persistVmExpandedStateFromGlobal();
};

/**
 * Removie the folder
 * @param {string} id the id of the folder
 */
const rmFolder = (id) => {
    if (!ensureVmFolderUnlocked(id, 'Delete folder')) {
        return;
    }
    // Ask for a confirmation
    swal({
        title: $.i18n('are-you-sure'),
        text: `${$.i18n('remove-folder')}: ${globalFolders[id].name}`,
        type: 'warning',
        html: true,
        showCancelButton: true,
        confirmButtonText: $.i18n('yes-delete'),
        cancelButtonText: $.i18n('cancel'),
        showLoaderOnConfirm: true
    },
    async (c) => {
        if (!c) { setTimeout(loadlist); return; }
        $('div.spinner.fixed').show('slow');
        await $.post('/plugins/folderview.plus/server/delete.php', { type: 'vm', id: id }).promise();
        loadedFolder = false;
        setTimeout(loadlist, 500)
    });
};

/**
 * Redirect to the page to edit the folder
 * @param {string} id the id of the folder
 */
const EDITOR_PREFILL_STORAGE_KEY = 'fv.folder.editor.prefill.v1';
const EDITOR_PREFILL_LOCAL_STORAGE_KEY = 'fv.folder.editor.prefill.persist.v1';
const EDITOR_WINDOW_NAME_PREFIX = 'fv.folder.editor.v1:';
const EDITOR_BOOTSTRAP_COOKIE_NAME = 'fv_folder_editor_bootstrap';
const EDITOR_DEBUG_LAUNCH_STORAGE_KEY = 'fv.folder.editor.debug.launch.v1';
const clearFolderEditorPrefill = () => {
    try {
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem(EDITOR_PREFILL_STORAGE_KEY);
        }
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(EDITOR_PREFILL_LOCAL_STORAGE_KEY);
        }
        if (String(window.name || '').startsWith(EDITOR_WINDOW_NAME_PREFIX)) {
            window.name = '';
        }
        document.cookie = `${EDITOR_BOOTSTRAP_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
    } catch (_error) {
        // Editor prefill cleanup is best-effort only.
    }
};
const recordFolderEditorLaunchDebug = (sourcePage, folderType, id, targetUrl) => {
    try {
        if (typeof localStorage === 'undefined') {
            return;
        }
        const normalizedId = String(id || '').trim();
        const folder = globalFolders && typeof globalFolders === 'object' ? globalFolders[normalizedId] : null;
        localStorage.setItem(EDITOR_DEBUG_LAUNCH_STORAGE_KEY, JSON.stringify({
            storedAt: new Date().toISOString(),
            source: String(sourcePage || 'vm').trim() || 'vm',
            type: String(folderType || '').trim() === 'docker' ? 'docker' : 'vm',
            id: normalizedId,
            folderName: String(folder?.name || normalizedId || '').trim(),
            currentUrl: String(window.location?.href || ''),
            targetUrl: String(targetUrl || '').trim(),
            hasFolderRecord: Boolean(folder && typeof folder === 'object'),
            sessionStorageAvailable: typeof sessionStorage !== 'undefined',
            localStorageAvailable: typeof localStorage !== 'undefined',
            cookiePresent: String(document.cookie || '').includes(`${EDITOR_BOOTSTRAP_COOKIE_NAME}=`)
        }));
    } catch (_error) {
        // Folder editor launch diagnostics are best-effort only.
    }
};
const seedFolderEditorPrefill = (folderType, id) => {
    try {
        const normalizedId = String(id || '').trim();
        if (!normalizedId || !globalFolders[normalizedId]) {
            return;
        }
        const payload = JSON.stringify({
            type: folderType,
            id: normalizedId,
            folder: globalFolders[normalizedId],
            storedAt: Date.now()
        });
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(EDITOR_PREFILL_STORAGE_KEY, payload);
        }
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(EDITOR_PREFILL_LOCAL_STORAGE_KEY, payload);
        }
        window.name = `${EDITOR_WINDOW_NAME_PREFIX}${payload}`;
        document.cookie = `${EDITOR_BOOTSTRAP_COOKIE_NAME}=${encodeURIComponent(JSON.stringify({
            type: folderType,
            id: normalizedId,
            storedAt: Date.now()
        }))}; path=/; max-age=900; SameSite=Lax`;
    } catch (_error) {
        // Editor prefill is best-effort only.
    }
};
const buildVmFolderEditorUrl = (id = '') => {
    const params = new URLSearchParams();
    const hashParams = new URLSearchParams();
    params.set('type', 'vm');
    hashParams.set('type', 'vm');
    if (String(id || '').trim()) {
        params.set('id', String(id || '').trim());
        hashParams.set('id', String(id || '').trim());
    }
    params.set('_', String(Date.now()));
    return `/VMs/Folder?${params.toString()}#${hashParams.toString()}`;
};
const editFolder = (id) => {
    if (!ensureVmFolderUnlocked(id, 'Edit folder')) {
        return;
    }
    seedFolderEditorPrefill('vm', id);
    const targetUrl = buildVmFolderEditorUrl(id);
    recordFolderEditorLaunchDebug('vm', 'vm', id, targetUrl);
    location.href = targetUrl;
};

/**
 * 
 * @param {string} id The id of the folder
 * @param {string} action the desired action
 */
const actionFolder = async (id, action, { includeDescendants = true } = {}) => {
    return vmSafeUiActionRunner.run(`vm-folder-action:${id}:${action}:${includeDescendants ? 'branch' : 'direct'}`, async () => {
        await runVmGuardedAction('vm-folder-action', async () => {
            if (!ensureVmFolderUnlocked(id, 'Folder action')) {
                return;
            }
            const folder = globalFolders[id];
            if (!folder) {
                return;
            }
            const containersMap = getScopedVmRuntimeContainersForFolder(id, includeDescendants);
            const entries = Object.values(containersMap);
            if (!entries.length) {
                return;
            }
            let proms = [];
            const originalAction = String(action || '').trim();

            vmRuntimeStateStore.set({ inFlightAction: `action:${id}:${originalAction}` });
            $(`i#load-folder-${id}`).removeClass('fa-play fa-square fa-pause').addClass('fa-refresh fa-spin');
            $('div.spinner.fixed').show('slow');

            try {
                for (const entry of entries) {
                    const cid = String(entry?.id || '').trim();
                    if (!cid) {
                        continue;
                    }
                    const state = String(entry?.state || '').toLowerCase();
                    let requestAction = originalAction;
                    let pass = false;
                    switch (originalAction) {
                        case 'domain-start':
                            pass = state !== 'running' && state !== 'pmsuspended' && state !== 'paused' && state !== 'unknown';
                            break;
                        case 'domain-stop':
                        case 'domain-pause':
                        case 'domain-restart':
                        case 'domain-pmsuspend':
                            pass = state === 'running';
                            break;
                        case 'domain-resume':
                            pass = state === 'paused' || state === 'unknown';
                            if (!pass && state === 'pmsuspended') {
                                pass = true;
                                requestAction = 'domain-pmwakeup';
                            }
                            break;
                        case 'domain-destroy':
                            pass = state === 'running' || state === 'pmsuspended' || state === 'paused' || state === 'unknown';
                            break;
                        default:
                            pass = false;
                            break;
                    }
                    if (pass) {
                        proms.push($.post('/plugins/dynamix.vm.manager/include/VMajax.php', { action: requestAction, uuid: cid }, null, 'json').promise());
                    }
                }

                if (!proms.length) {
                    return;
                }

                const results = await Promise.all(proms);
                const errors = results.filter((result) => result.success !== true);
                const errorMessages = errors.map((result) => result.text || JSON.stringify(result));

                if (errors.length > 0) {
                    swal({
                        title: $.i18n('exec-error'),
                        text: errorMessages.join('<br>'),
                        type: 'error',
                        html: true,
                        confirmButtonText: 'Ok'
                    }, loadlist);
                } else {
                    loadlist();
                }
            } finally {
                vmRuntimeStateStore.set({ inFlightAction: '' });
                $('div.spinner.fixed').hide('slow');
            }
        }, {
            userMessage: $.i18n('exec-error')
        });
    });
};

/**
 * Execute the desired custom action
 * @param {string} id 
 * @param {number} action 
 */
const folderCustomAction = async (id, action) => {
    return vmSafeUiActionRunner.run(`vm-custom-action:${id}:${action}`, async () => {
        await runVmGuardedAction('vm-custom-action', async () => {
            if (!ensureVmFolderUnlocked(id, 'Custom action')) {
                return;
            }
            $('div.spinner.fixed').show('slow');
            vmRuntimeStateStore.set({ inFlightAction: `custom:${id}:${action}` });
            const eventURL = '/plugins/dynamix.vm.manager/include/VMajax.php';
            const folder = globalFolders[id];
            let act = folder.actions[action];
            let prom = [];
            try {
                if(act.type === 0) {
                    const actionContainers = Array.isArray(act.conatiners)
                        ? act.conatiners
                        : (Array.isArray(act.containers) ? act.containers : []);
                    const cts = actionContainers.map(e => folder.containers[e]).filter(e => e);
                    let ctAction = null;
                    if(act.action === 0) {

                        if(act.modes === 0) {
                            ctAction = (e) => {
                                if(e.state === "running") {
                                    prom.push($.post(eventURL, {action: 'stop', uuid:e.id}, null,'json').promise());
                                } else if(e.state !== "running" && e.state !== "pmsuspended" && e.state !== "paused" && e.state !== "unknown"){
                                    prom.push($.post(eventURL, {action: 'domain-start', uuid:e.id}, null,'json').promise());
                                }
                            };
                        } else if(act.modes === 1) {
                            ctAction = (e) => {
                                if(e.state === "running") {
                                    prom.push($.post(eventURL, {action: 'domain-pause', uuid:e.id}, null,'json').promise());
                                } else if(e.state === "paused" || e.state === "unknown") {
                                    prom.push($.post(eventURL, {action: 'domain-resume', uuid:e.id}, null,'json').promise());
                                }
                            };
                        }

                    } else if(act.action === 1) {

                        if(act.modes === 0) {
                            ctAction = (e) => {
                                if(e.state !== "running" && e.state !== "pmsuspended" && e.state !== "paused" && e.state !== "unknown") {
                                    prom.push($.post(eventURL, {action: 'domain-start', uuid:e.id}, null,'json').promise());
                                }
                            };
                        } else if(act.modes === 1) {
                            ctAction = (e) => {
                                if(e.state === "running") {
                                    prom.push($.post(eventURL, {action: 'domain-stop', uuid:e.id}, null,'json').promise());
                                }
                            };
                        } else if(act.modes === 2) {
                            ctAction = (e) => {
                                if(e.state === "running") {
                                    prom.push($.post(eventURL, {action: 'domain-pause', uuid:e.id}, null,'json').promise());
                                }
                            };
                        } else if(act.modes === 3) {
                            ctAction = (e) => {
                                if(e.state === "paused" || e.state === "unknown") {
                                    prom.push($.post(eventURL, {action: 'domain-restart', uuid:e.id}, null,'json').promise());
                                }
                            };
                        }

                    } else if(act.action === 2) {

                        ctAction = (e) => {
                            if(e.state === "running") {
                                prom.push($.post(eventURL, {action: 'domain-pause', uuid:e.id}, null,'json').promise());
                            }
                        };

                    }

                    if (typeof ctAction === 'function') {
                        cts.forEach((e) => {
                            ctAction(e);
                        });
                    } else {
                        const unsupportedLabel = `action=${act.action}, mode=${act.modes}`;
                        console.warn(`folderview.plus: Unsupported VM custom action configuration (${unsupportedLabel}) for folder "${folder.name || id}".`);
                    }
                } else if(act.type === 1) {
                    const args = act.script_args || '';
                    if(act.script_sync) {
                        let scriptVariables = {}
                        let rawVars = await $.post("/plugins/user.scripts/exec.php",{action:'getScriptVariables',script:`/boot/config/plugins/user.scripts/scripts/${act.script}/script`}).promise();
                        rawVars.trim().split('\n').forEach((e) => { const variable = e.split('='); scriptVariables[variable[0]] = variable[1] });
                        if(scriptVariables['directPHP']) {
                            $.post("/plugins/user.scripts/exec.php",{action:'directRunScript',path:`/boot/config/plugins/user.scripts/scripts/${act.script}/script`},function(data) {if(data) { openBox(data,act.name,800,1200, 'loadlist');}})
                        } else {
                            $.post("/plugins/user.scripts/exec.php",{action:'convertScript',path:`/boot/config/plugins/user.scripts/scripts/${act.script}/script`},function(data) {if(data) {openBox('/plugins/user.scripts/startScript.sh&arg1='+data+'&arg2='+args,act.name,800,1200,true, 'loadlist');}});
                        }
                    } else {
                        const cmd = await $.post("/plugins/user.scripts/exec.php",{action:'convertScript', path:`/boot/config/plugins/user.scripts/scripts/${act.script}/script`}).promise();
                        prom.push($.get('/logging.htm?cmd=/plugins/user.scripts/backgroundScript.sh&arg1='+cmd+'&arg2='+args+'&csrf_token='+csrf_token+'&done=Done').promise());
                    }
                }

                await Promise.all(prom);
                loadlist();
            } finally {
                vmRuntimeStateStore.set({ inFlightAction: '' });
                $('div.spinner.fixed').hide('slow');
            }
        }, {
            userMessage: $.i18n('exec-error')
        });
    });
};

const cloneVmFolderFromMenu = async (id) => {
    await runVmGuardedAction('clone-folder', async () => {
        if (!ensureVmFolderUnlocked(id, 'Clone folder')) {
            return;
        }
        const source = globalFolders[id];
        if (!source || typeof source !== 'object') {
            return;
        }
        const defaultName = `${String(source?.name || 'Folder').trim() || 'Folder'} (Copy)`;
        const nextName = String(window.prompt('Clone folder name', defaultName) || '').trim();
        if (!nextName) {
            return;
        }
        const clonePayload = {
            name: nextName,
            icon: String(source?.icon || ''),
            parentId: normalizeFolderParentId(source?.parentId || source?.parent_id || ''),
            settings: JSON.parse(JSON.stringify((source?.settings && typeof source.settings === 'object') ? source.settings : {})),
            regex: String(source?.regex || ''),
            containers: readVmFolderContainerNames(source?.containers),
            actions: Array.isArray(source?.actions) ? JSON.parse(JSON.stringify(source.actions)) : []
        };
        $('div.spinner.fixed').show('slow');
        try {
            await $.post('/plugins/folderview.plus/server/create.php', {
                type: 'vm',
                content: JSON.stringify(clonePayload)
            }).promise();
            await $.post('/plugins/folderview.plus/server/sync_order.php', { type: 'vm' }).promise();
            loadlist();
        } finally {
            $('div.spinner.fixed').hide('slow');
        }
    }, {
        userMessage: 'Failed to clone folder.',
        userVisible: true
    });
};

const buildVmFolderSettingsSummaryHtml = (entry) => {
    const transferApi = getFolderSettingsTransferApi();
    const summary = transferApi?.summarizeClipboardEntry(entry) || {
        sourceName: 'Copied folder settings',
        copiedActionCount: 0,
        droppedMemberBoundActionCount: 0,
        labels: ['Folder settings']
    };
    const labelHtml = summary.labels.map((label) => `<span class="fv-folder-settings-pill">${escapeHtml(label)}</span>`).join(' ');
    const skippedHint = summary.droppedMemberBoundActionCount > 0
        ? `<div style="margin-top:8px;">Skipped ${summary.droppedMemberBoundActionCount} member-bound custom action${summary.droppedMemberBoundActionCount === 1 ? '' : 's'} to avoid copying source-specific targets.</div>`
        : '';
    return [
        `<div><strong>Source:</strong> ${escapeHtml(summary.sourceName)}</div>`,
        `<div style="margin-top:8px;"><strong>Will apply:</strong> ${labelHtml || '<span class="fv-folder-settings-pill">Folder settings</span>'}</div>`,
        skippedHint
    ].join('');
};

const copyVmFolderSettingsFromMenu = async (id) => {
    await runVmGuardedAction('copy-folder-settings', async () => {
        if (!ensureVmFolderUnlocked(id, 'Copy folder settings')) {
            return;
        }
        const transferApi = getFolderSettingsTransferApi();
        if (!transferApi) {
            throw new Error('Folder settings transfer module is unavailable.');
        }
        const source = globalFolders[id];
        if (!source || typeof source !== 'object') {
            return;
        }
        const clipboardEntry = transferApi.buildClipboardEntry('vm', source, {
            sourceId: id,
            sourceName: String(source?.name || id).trim(),
            sourceContext: 'vm-runtime'
        });
        if (!clipboardEntry || transferApi.writeClipboardEntry(clipboardEntry) !== true) {
            throw new Error('Unable to copy folder settings into the clipboard.');
        }
        swal({
            title: 'Folder settings copied',
            text: buildVmFolderSettingsSummaryHtml(clipboardEntry),
            type: 'success',
            html: true,
            confirmButtonText: 'OK'
        });
    }, {
        userMessage: 'Failed to copy folder settings.',
        userVisible: true
    });
};

const pasteVmFolderSettingsFromMenu = async (id) => {
    await runVmGuardedAction('paste-folder-settings', async () => {
        if (!ensureVmFolderUnlocked(id, 'Paste folder settings')) {
            return;
        }
        const transferApi = getFolderSettingsTransferApi();
        if (!transferApi) {
            throw new Error('Folder settings transfer module is unavailable.');
        }
        const targetFolder = globalFolders[id];
        if (!targetFolder || typeof targetFolder !== 'object') {
            return;
        }
        const clipboardEntry = transferApi.readClipboardEntry('vm');
        if (!clipboardEntry) {
            swal({
                title: 'No folder settings copied',
                text: 'Copy folder settings from another VM folder first.',
                type: 'info',
                confirmButtonText: 'OK'
            });
            return;
        }
        const summaryHtml = [
            `<div><strong>Target:</strong> ${escapeHtml(String(targetFolder?.name || id).trim() || id)}</div>`,
            `<div style="margin-top:10px;">${buildVmFolderSettingsSummaryHtml(clipboardEntry)}</div>`
        ].join('');
        swal({
            title: 'Paste folder settings',
            text: summaryHtml,
            type: 'warning',
            html: true,
            showCancelButton: true,
            confirmButtonText: 'Paste',
            cancelButtonText: 'Cancel',
            closeOnConfirm: false,
            showLoaderOnConfirm: true
        }, async (confirmed) => {
            if (!confirmed) {
                return;
            }
            try {
                $('div.spinner.fixed').show('slow');
                await postVmJsonWithFallback('/plugins/folderview.plus/server/apply_folder_settings.php', {
                    type: 'vm',
                    targetIds: JSON.stringify([id]),
                    settings: JSON.stringify(clipboardEntry.payload)
                }, {
                    retries: 1,
                    retryDelayMs: 260
                });
                swal.close();
                loadlist();
            } finally {
                $('div.spinner.fixed').hide('slow');
            }
        });
    }, {
        userMessage: 'Failed to paste folder settings.',
        userVisible: true
    });
};

const VM_CONTEXT_QUICK_ACTION_LABELS = new Set([
    'focus folder',
    'clear focus',
    'pin folder',
    'unpin folder',
    'lock folder',
    'unlock folder'
]);
const vmContextQuickStripAdapter = createVmContextMenuQuickStripAdapter
    ? createVmContextMenuQuickStripAdapter({
        menuClassName: 'fvplus-vm-context-menu',
        quickItemClassName: 'fvplus-vm-quick-item',
        clearClassName: 'fvplus-vm-quick-clear',
        labelSet: VM_CONTEXT_QUICK_ACTION_LABELS,
        iconClassCandidates: [
            'fa-bullseye',
            'fa-dot-circle-o',
            'fa-star',
            'fa-star-o',
            'fa-lock',
            'fa-unlock-alt'
        ]
    })
    : null;
const queueVmFolderContextQuickIcons = (attempt = 0) => {
    if (!vmContextQuickStripAdapter || typeof vmContextQuickStripAdapter.queueEnhance !== 'function') {
        return;
    }
    vmContextQuickStripAdapter.queueEnhance(attempt);
};

/**
 * Atach the menu when clicking the folder icon
 * @param {string} id the id of the folder
 */
const addVMFolderContext = (id) => {
    vmPerfTelemetry.begin('context-menu-build');
    if (!globalFolders[id]) {
        vmPerfTelemetry.end('context-menu-build', { id, aborted: true });
        return;
    }
    let opts = [];
    const appendDivider = () => {
        if (!opts.length || opts[opts.length - 1]?.divider) {
            return;
        }
        opts.push({ divider: true });
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
    const appendScopeAwareAction = ({ label, icon, directCount, branchCount, runScoped }) => {
        if (branchCount <= 0 || typeof runScoped !== 'function') {
            return;
        }
        if (branchCount > directCount) {
            opts.push({
                text: `${label} (${branchCount})`,
                icon,
                subMenu: [
                    {
                        text: `Folder only (${directCount})`,
                        icon,
                        action: (evt) => {
                            evt.preventDefault();
                            runScoped(false);
                        }
                    },
                    {
                        text: `Folder + children (${branchCount})`,
                        icon,
                        action: (evt) => {
                            evt.preventDefault();
                            runScoped(true);
                        }
                    }
                ]
            });
            return;
        }
        opts.push({
            text: `${label} (${branchCount})`,
            icon,
            action: (evt) => {
                evt.preventDefault();
                runScoped(true);
            }
        });
    };

    context.settings({
        right: false,
        above: false
    });

    const folderData = globalFolders[id];
    const hasChildren = folderHasChildren(id);
    const focused = vmFocusedFolderId === id;
    const pinned = isVmFolderPinned(id);
    const locked = isVmFolderLocked(id);
    const directScopeContainers = getScopedVmRuntimeContainersForFolder(id, false);
    const branchScopeContainers = getScopedVmRuntimeContainersForFolder(id, true);
    const directCounts = summarizeVmFolderActionCounts(directScopeContainers);
    const branchCounts = summarizeVmFolderActionCounts(branchScopeContainers);

    opts.push({
        text: focused ? 'Clear focus' : 'Focus folder',
        icon: focused ? 'fa-dot-circle-o' : 'fa-bullseye',
        action: (evt) => {
            evt.preventDefault();
            toggleVmFolderFocus(id);
        }
    });
    opts.push({
        text: pinned ? 'Unpin folder' : 'Pin folder',
        icon: pinned ? 'fa-star' : 'fa-star-o',
        action: (evt) => {
            evt.preventDefault();
            toggleVmFolderPin(id);
        }
    });
    opts.push({
        text: locked ? 'Unlock folder' : 'Lock folder',
        icon: locked ? 'fa-lock' : 'fa-unlock-alt',
        action: (evt) => {
            evt.preventDefault();
            toggleVmFolderLock(id);
        }
    });
    appendDivider();

    if (folderData.settings.override_default_actions && folderData.actions && folderData.actions.length) {
        opts.push(
            ...folderData.actions.map((entry, index) => ({
                text: entry.name,
                icon: entry.script_icon || 'fa-bolt',
                action: (evt) => {
                    evt.preventDefault();
                    folderCustomAction(id, index);
                }
            }))
        );
        appendDivider();
    } else if (!folderData.settings.default_action) {
        appendScopeAwareAction({
            label: $.i18n('start'),
            icon: 'fa-play',
            directCount: directCounts.startable,
            branchCount: branchCounts.startable,
            runScoped: (includeDescendants) => actionFolder(id, 'domain-start', { includeDescendants })
        });
        appendScopeAwareAction({
            label: $.i18n('stop'),
            icon: 'fa-stop',
            directCount: directCounts.stoppable,
            branchCount: branchCounts.stoppable,
            runScoped: (includeDescendants) => actionFolder(id, 'domain-stop', { includeDescendants })
        });
        appendScopeAwareAction({
            label: $.i18n('pause'),
            icon: 'fa-pause',
            directCount: directCounts.pausable,
            branchCount: branchCounts.pausable,
            runScoped: (includeDescendants) => actionFolder(id, 'domain-pause', { includeDescendants })
        });
        appendScopeAwareAction({
            label: $.i18n('resume'),
            icon: 'fa-play-circle',
            directCount: directCounts.resumable,
            branchCount: branchCounts.resumable,
            runScoped: (includeDescendants) => actionFolder(id, 'domain-resume', { includeDescendants })
        });
        appendScopeAwareAction({
            label: $.i18n('restart'),
            icon: 'fa-refresh',
            directCount: directCounts.restartable,
            branchCount: branchCounts.restartable,
            runScoped: (includeDescendants) => actionFolder(id, 'domain-restart', { includeDescendants })
        });
        appendScopeAwareAction({
            label: $.i18n('hibernate'),
            icon: 'fa-bed',
            directCount: directCounts.hibernateable,
            branchCount: branchCounts.hibernateable,
            runScoped: (includeDescendants) => actionFolder(id, 'domain-pmsuspend', { includeDescendants })
        });
        appendScopeAwareAction({
            label: $.i18n('force-stop'),
            icon: 'fa-bomb',
            directCount: directCounts.destroyable,
            branchCount: branchCounts.destroyable,
            runScoped: (includeDescendants) => actionFolder(id, 'domain-destroy', { includeDescendants })
        });
        appendDivider();
    }

    if (hasChildren) {
        const branchSubMenu = [
            {
                text: 'Expand branch',
                icon: 'fa-angle-double-down',
                action: (evt) => {
                    evt.preventDefault();
                    expandVmFolderBranch(id);
                }
            },
            {
                text: 'Collapse branch',
                icon: 'fa-angle-double-up',
                action: (evt) => {
                    evt.preventDefault();
                    collapseVmFolderBranch(id);
                }
            }
        ];
        if (branchCounts.startable > 0) {
            branchSubMenu.push({
                text: `Start branch (${branchCounts.startable})`,
                icon: 'fa-play',
                action: (evt) => {
                    evt.preventDefault();
                    actionFolder(id, 'domain-start', { includeDescendants: true });
                }
            });
        }
        if (branchCounts.stoppable > 0) {
            branchSubMenu.push({
                text: `Stop branch (${branchCounts.stoppable})`,
                icon: 'fa-stop',
                action: (evt) => {
                    evt.preventDefault();
                    actionFolder(id, 'domain-stop', { includeDescendants: true });
                }
            });
        }
        if (branchSubMenu.length > 0) {
            opts.push({
                text: 'Branch actions',
                icon: 'fa-sitemap',
                subMenu: branchSubMenu
            });
            appendDivider();
        }
    }

    opts.push({
        text: $.i18n('edit'),
        icon: 'fa-wrench',
        action: (evt) => { evt.preventDefault(); editFolder(id); }
    });

    opts.push({
        text: 'Clone',
        icon: 'fa-clone',
        subMenu: [
            {
                text: 'Clone folder',
                icon: 'fa-clone',
                action: (evt) => {
                    evt.preventDefault();
                    cloneVmFolderFromMenu(id);
                }
            },
            {
                text: 'Copy Folder Settings',
                icon: 'fa-files-o',
                action: (evt) => {
                    evt.preventDefault();
                    copyVmFolderSettingsFromMenu(id);
                }
            },
            {
                text: 'Paste Folder Settings',
                icon: 'fa-clipboard',
                action: (evt) => {
                    evt.preventDefault();
                    pasteVmFolderSettingsFromMenu(id);
                }
            }
        ]
    });

    opts.push({
        text: $.i18n('remove'),
        icon: 'fa-trash',
        action: (evt) => { evt.preventDefault(); rmFolder(id); }
    });

    if (!folderData.settings.override_default_actions && folderData.actions && folderData.actions.length) {
        appendDivider();
        opts.push({
            text: $.i18n('custom-actions'),
            icon: 'fa-bars',
            subMenu: folderData.actions.map((entry, index) => ({
                text: entry.name,
                icon: entry.script_icon || 'fa-bolt',
                action: (evt) => {
                    evt.preventDefault();
                    folderCustomAction(id, index);
                }
            }))
        });
    }

    opts = normalizeDividers(opts);
    folderEvents.dispatchEvent(new CustomEvent('vm-folder-context', { detail: { id, opts } }));
    context.attach('#' + id, opts);
    queueVmFolderContextQuickIcons();
    vmPerfTelemetry.end('context-menu-build', { id, optsCount: opts.length });
};

// Global variables
let loadedFolder = false;
let globalFolders = {};
const folderRegex = /^folder-/;
let folderDebugMode  = false;
let folderDebugModeWindow = [];
let folderReq = [];
let folderTypePrefs = utils.normalizePrefs({});
let liveRefreshTimer = null;
let liveRefreshMs = 0;
let liveRefreshInFlight = false;
let queuedLoadlistTimer = null;
let queuedLoadlistRequestedAt = 0;
let lastLiveRefreshStateSignature = '';
const LOADLIST_REFRESH_DEBOUNCE_MS = 90;
const LOADLIST_REFRESH_MIN_GAP_MS = 420;
const PERFORMANCE_MODE_MIN_REFRESH_SECONDS = 20;
const PERFORMANCE_MODE_EXPAND_RESTORE_LIMIT = 12;
let vmRuntimePerformanceProfile = resolveVmRuntimePerformanceProfile(folderTypePrefs, {
    folderCount: 0,
    itemCount: 0
});

const resolveVmStrictPerformanceProfile = (prefs, folders, vmInfo) => {
    const folderCount = Object.keys(folders && typeof folders === 'object' ? folders : {}).length;
    const itemCount = Object.keys(vmInfo && typeof vmInfo === 'object' ? vmInfo : {}).length;
    vmRuntimePerformanceProfile = resolveVmRuntimePerformanceProfile(prefs || {}, { folderCount, itemCount });
    vmRuntimeStateStore.set({ performanceProfile: vmRuntimePerformanceProfile });
    return vmRuntimePerformanceProfile;
};

const queueLoadlistRefresh = () => {
    if (queuedLoadlistTimer) {
        return;
    }
    const now = Date.now();
    const elapsed = now - queuedLoadlistRequestedAt;
    const minGapWait = elapsed >= LOADLIST_REFRESH_MIN_GAP_MS
        ? 0
        : (LOADLIST_REFRESH_MIN_GAP_MS - elapsed);
    const delayMs = Math.max(LOADLIST_REFRESH_DEBOUNCE_MS, minGapWait);
    queuedLoadlistTimer = setTimeout(() => {
        queuedLoadlistTimer = null;
        queuedLoadlistRequestedAt = Date.now();
        loadlist();
    }, delayMs);
};

const fetchVmStateSignature = async () => {
    const payload = await $.get('/plugins/folderview.plus/server/read_info.php?type=vm&mode=state').promise();
    const parsed = parseJsonPayloadSafe(payload);
    return buildVmStateSignature(parsed, true);
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
                nextSignature = await fetchVmStateSignature();
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
    const strictMinSeconds = Number(vmRuntimePerformanceProfile?.minLiveRefreshSeconds || 0);
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

const normalizeVmRuntimeAppColumnMode = (value) => {
    const fallbackNormalize = () => {
        const mode = String(value || '').trim().toLowerCase();
        return mode === 'compact' || mode === 'wide' ? mode : 'standard';
    };
    if (!utils || typeof utils.normalizeAppColumnWidth !== 'function') {
        return fallbackNormalize();
    }
    return utils.normalizeAppColumnWidth(value);
};

const getVmRuntimePresetAppWidth = () => {
    let mode = 'standard';
    if (folderTypePrefs && typeof folderTypePrefs === 'object') {
        mode = normalizeVmRuntimeAppColumnMode(folderTypePrefs.appColumnWidth);
    } else if (document.body && typeof document.body.getAttribute === 'function') {
        mode = normalizeVmRuntimeAppColumnMode(document.body.getAttribute('data-fvplus-vm-app-width'));
    }
    if (vmRuntimeColumnLayoutEngine && typeof vmRuntimeColumnLayoutEngine.resolvePresetWidth === 'function') {
        return vmRuntimeColumnLayoutEngine.resolvePresetWidth(mode);
    }
    const preset = VM_RUNTIME_APP_PRESET_WIDTHS[mode] || VM_RUNTIME_APP_PRESET_WIDTHS.standard;
    return Math.max(VM_RUNTIME_APP_WIDTH_MIN, Math.min(VM_RUNTIME_APP_WIDTH_MAX, Math.round(Number(preset) || VM_RUNTIME_APP_PRESET_WIDTHS.standard)));
};

const estimateVmRuntimeAutoAppWidth = () => {
    const baseline = getVmRuntimePresetAppWidth() || VM_RUNTIME_APP_PRESET_WIDTHS.standard;
    const rows = Array.from(document.querySelectorAll('#kvm_table tr.folder, tbody#kvm_list tr.folder, tbody#kvm_view tr.folder'));
    if (vmRuntimeColumnLayoutEngine && typeof vmRuntimeColumnLayoutEngine.estimateFromRows === 'function') {
        const estimated = vmRuntimeColumnLayoutEngine.estimateFromRows({
            rows,
            baseline,
            nameSelector: '.folder-appname',
            auxSelectors: ['.folder-state'],
            indentSelector: '.folder-name-sub',
            hiddenClass: 'fv-nested-hidden',
            chromeWidth: VM_RUNTIME_APP_CHROME_WIDTH,
            textBuffer: VM_RUNTIME_APP_TEXT_BUFFER
        });
        return estimated || baseline;
    }
    return baseline;
};

const adjustVmRuntimeAppWidthForRenderedOverflow = (baseWidth = null) => {
    const fallback = getVmRuntimePresetAppWidth() || VM_RUNTIME_APP_PRESET_WIDTHS.standard;
    const startingWidth = Number.isFinite(Number(baseWidth))
        ? Math.max(VM_RUNTIME_APP_WIDTH_MIN, Math.min(VM_RUNTIME_APP_WIDTH_MAX, Math.round(Number(baseWidth))))
        : fallback;
    const rows = Array.from(document.querySelectorAll('tbody#kvm_list tr.folder, tbody#kvm_view tr.folder'));
    if (!rows.length) {
        return startingWidth;
    }
    let maxOverflow = 0;
    rows.forEach((row) => {
        if (!row || row.offsetParent === null || row.classList.contains('fv-nested-hidden') || row.classList.contains('fv-folder-focus-hidden')) {
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
            if (clientWidth < VM_RUNTIME_APP_OVERFLOW_CLIENT_WIDTH_MIN && rawOverflow <= 0) {
                return;
            }
            if (rawOverflow <= 0) {
                return;
            }
            const overflow = Math.min(rawOverflow, VM_RUNTIME_APP_OVERFLOW_NUDGE_MAX);
            if (overflow > maxOverflow) {
                maxOverflow = overflow;
            }
        });
    });
    if (maxOverflow <= 0) {
        return startingWidth;
    }
    return Math.max(
        VM_RUNTIME_APP_WIDTH_MIN,
        Math.min(VM_RUNTIME_APP_WIDTH_MAX, startingWidth + maxOverflow + VM_RUNTIME_APP_TEXT_BUFFER)
    );
};

const runVmRuntimeWidthReflow = (reason = 'direct') => {
    vmRuntimeLastWidthReflowReason = String(reason || 'direct');
    const estimatedWidth = estimateVmRuntimeAutoAppWidth();
    const overflowAdjustedWidth = adjustVmRuntimeAppWidthForRenderedOverflow(estimatedWidth);
    applyVmRuntimeAppWidthVariables(overflowAdjustedWidth || estimatedWidth);
    return overflowAdjustedWidth || estimatedWidth;
};

const scheduleVmRuntimeWidthReflow = (reason = 'event', delayMs = VM_RUNTIME_WIDTH_REFLOW_DEBOUNCE_MS) => {
    const safeReason = String(reason || 'event');
    const safeDelay = Number.isFinite(Number(delayMs)) ? Math.max(0, Number(delayMs)) : VM_RUNTIME_WIDTH_REFLOW_DEBOUNCE_MS;
    if (vmRuntimeWidthReflowTimer !== null) {
        window.clearTimeout(vmRuntimeWidthReflowTimer);
    }
    vmRuntimeWidthReflowTimer = window.setTimeout(() => {
        vmRuntimeWidthReflowTimer = null;
        runVmRuntimeWidthReflow(safeReason);
    }, safeDelay);
};

const applyVmRuntimeAppWidthVariables = (desktopWidthPx = null) => {
    if (vmRuntimeColumnLayoutEngine && typeof vmRuntimeColumnLayoutEngine.applyCssWidthVars === 'function') {
        vmRuntimeColumnLayoutEngine.applyCssWidthVars(desktopWidthPx);
        return;
    }
    const safeDesktopWidth = Number.isFinite(Number(desktopWidthPx)) ? Math.round(Number(desktopWidthPx)) : null;
    if (!document.body || !document.body.style) {
        return;
    }
    if (!safeDesktopWidth) {
        document.body.style.removeProperty('--fvplus-vm-app-column-width');
        document.body.style.removeProperty('--fvplus-vm-app-column-width-mobile');
        return;
    }
    const mobileWidth = Math.max(156, Math.round(safeDesktopWidth * 0.82));
    document.body.style.setProperty('--fvplus-vm-app-column-width', `${safeDesktopWidth}px`);
    document.body.style.setProperty('--fvplus-vm-app-column-width-mobile', `${mobileWidth}px`);
};

const vmRuntimeThemeReflowController = runtimeStateObserverModule && typeof runtimeStateObserverModule.createThemeReflowController === 'function'
    ? runtimeStateObserverModule.createThemeReflowController({
        window,
        document,
        viewportReason: 'viewport-resize',
        viewportDelayMs: 48,
        themeReasonPrefix: 'theme-change',
        themeDelayMs: 40,
        scheduleReflow: (reason, delayMs) => scheduleVmRuntimeWidthReflow(reason, delayMs),
        onQueueReason: (reason) => {
            vmDebugLog(`theme-reflow:${reason}`);
            applyVmThemeResolverTokens(`vm-runtime:${reason}`, {
                root: document.body,
                modeInput: 'auto'
            });
        }
    })
    : null;

const applyVmRuntimeResolvedThemeTokens = (reason = 'vm-runtime:initial') => applyVmThemeResolverTokens(reason, {
    root: document.body,
    modeInput: 'auto'
});

const bindVmRuntimeViewportWidthSync = () => {
    vmRuntimeThemeReflowController?.bindViewportWidthSync();
};

const queueVmRuntimeThemeReflow = (reason = 'theme-change') => {
    vmRuntimeThemeReflowController?.queueThemeReflow(reason);
};

const bindVmRuntimeThemeReflow = () => {
    applyVmRuntimeResolvedThemeTokens('vm-runtime:bind');
    vmRuntimeThemeReflowController?.bindThemeReflow();
};

const applyRuntimePrefs = (prefs) => {
    const normalized = utils.normalizePrefs(prefs || {});
    const appColumnWidth = typeof utils.normalizeAppColumnWidth === 'function'
        ? utils.normalizeAppColumnWidth(normalized.appColumnWidth)
        : (['compact', 'wide'].includes(String(normalized.appColumnWidth || '').toLowerCase()) ? String(normalized.appColumnWidth || '').toLowerCase() : 'standard');
    if (document.body && typeof document.body.setAttribute === 'function') {
        document.body.setAttribute('data-fvplus-vm-app-width', appColumnWidth);
    }
    bindVmRuntimeViewportWidthSync();
    bindVmRuntimeThemeReflow();
    scheduleVmRuntimeWidthReflow('runtime-prefs', 0);
    $('body').toggleClass('fvplus-performance-mode', normalized.performanceMode === true);
    $('body').toggleClass('fvplus-performance-mode-strict', vmRuntimePerformanceProfile?.strict === true);
    scheduleLiveRefresh(normalized);
};
window.getVmRuntimePerfTelemetrySnapshot = () => {
    if (!vmPerfTelemetry || typeof vmPerfTelemetry.snapshot !== 'function') {
        return {};
    }
    return vmPerfTelemetry.snapshot();
};
window.getVmRuntimeStateSnapshot = () => vmRuntimeStateStore.getState();

function buildVmFolderReq() {
    const cacheBust = Date.now();
    const safePrefsReq = createVmRuntimeRequest(`/plugins/folderview.plus/server/prefs.php?type=vm&_=${cacheBust}`, {
        source: 'prefs',
        label: 'VM preferences',
        allowFallback: true,
        fallbackValue: JSON.stringify({ ok: false, prefs: {} })
    });
    return [
        // Get the folders
        createVmRuntimeRequest('/plugins/folderview.plus/server/read.php?type=vm', {
            source: 'folders',
            label: 'VM folder definitions'
        }),
        // Get the order as unraid sees it
        createVmRuntimeRequest('/plugins/folderview.plus/server/read_order.php?type=vm', {
            source: 'folder-order',
            label: 'VM folder order'
        }),
        // Get the info on VMs, needed for autostart and started
        createVmRuntimeRequest('/plugins/folderview.plus/server/read_info.php?type=vm', {
            source: 'runtime-info',
            label: 'VM runtime info'
        }),
        // Get the order that is shown in the webui
        createVmRuntimeRequest('/plugins/folderview.plus/server/read_unraid_order.php?type=vm', {
            source: 'host-order',
            label: 'VM host order'
        }),
        // Get sort and auto-assignment preferences
        safePrefsReq
    ];
}

// Prime requests for environments where loadlist isn't called first.
folderReq = buildVmFolderReq();
markVmFatalBannerStep('VM request bundle primed');

// Patching the original function to make sure the containers are rendered before insering the folder
window.loadlist_original = loadlist;
if (typeof window.loadlist_original !== 'function') {
    reportVmDegradedRuntimeState('VM host loadlist hook was unavailable during bootstrap.', {
        phase: 'hook-install',
        category: 'host-hook-missing',
        detailLabel: 'Missing host hooks',
        details: ['window.loadlist was not a function when FolderView Plus initialized.']
    });
} else {
    markVmFatalBannerStep('VM loadlist hook captured');
}
window.loadlist = (x) => {
    loadedFolder = false;
    folderReq = buildVmFolderReq();
    if (typeof loadlist_original === 'function') {
        loadlist_original(x);
    } else {
        reportVmDegradedRuntimeState('VM host loadlist hook was unavailable when the runtime tried to refresh.', {
            phase: 'loadlist',
            category: 'host-hook-missing',
            detailLabel: 'Missing host hooks',
            details: ['window.loadlist_original was not callable during a VM runtime refresh.']
        });
    }
};

// Add the button for creating a folder
const createFolderBtn = () => {
    recordVmFatalBannerAction('VM Add Folder clicked');
    clearFolderEditorPrefill();
    location.href = buildVmFolderEditorUrl();
};
window.addVMFolderContext = addVMFolderContext;
window.dropDownButton = dropDownButton;
window.editFolder = editFolder;
window.createFolderBtn = createFolderBtn;


$.ajaxPrefilter((options, originalOptions, jqXHR) => {
    // This is needed because unraid don't like the folder and the number are set incorrectly, this intercept the request and change the numbers to make the order appear right, this is important for the autostart and to draw the folders
    if (options.url === "/plugins/dynamix.vm.manager/include/UserPrefs.php") {
        const data = new URLSearchParams(options.data);
        const containers = data.get('names').split(';');
        const folderFixRegex = /^(.*?)(?=folder-)/g;
        let num = "";
        for (let index = 0; index < containers.length - 1; index++) {
            containers[index] = containers[index].replace(folderFixRegex, '');
            num += index + ';'
        }
        data.set('names', containers.join(';'));
        data.set('index', num);
        options.data = data.toString();
        $('.unhide').show();
    // this is needed to trigger the funtion to create the folders
    } else if (options.url === "/plugins/dynamix.vm.manager/include/VMMachines.php" && !loadedFolder) {
        jqXHR.promise().then(() => {
            queueCreateFoldersRender();
            $('div.spinner.fixed').hide();
            loadedFolder = !loadedFolder
        });
    }
});

// activate debug mode
addEventListener("keydown", (e) => {
    if (e.isComposing || e.key.length !== 1) { // letter X FOR TESTING
        return;
    }
    folderDebugModeWindow.push(e.key);
    if(folderDebugModeWindow.length > 5) {
        folderDebugModeWindow.shift();
    }
    if(folderDebugModeWindow.join('').toLowerCase() === "debug") {
        folderDebugMode = true;
        loadlist();
    }
})
