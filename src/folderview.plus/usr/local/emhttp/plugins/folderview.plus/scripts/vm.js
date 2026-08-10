// @ts-check
const runtimeShared = window.FolderViewDockerRuntimeShared || {};
const pluginRequestClient = window.FolderViewPlusRequest || null;
const runtimeSnapshotApi = window.FolderViewPlusRuntimeSnapshot || null;
const runtimeStateObserverModule = window.FolderViewPlusRuntimeStateObservers || null;
const memberIdentityModule = window.FolderViewPlusMemberIdentity || null;
const themeResolver = window.FolderViewPlusThemeResolver || null;
const runtimeHostAdapters = window.FolderViewPlusRuntimeHostAdapters || null;
const runtimeFolderOrdering = window.FolderViewPlusRuntimeFolderOrdering || null;
const runtimePerformanceTelemetryModule = window.FolderViewPlusRuntimePerformanceTelemetry || null;
const vmRuntimePerformanceTelemetry = runtimePerformanceTelemetryModule?.getOrCreate?.('vm', {
    window,
    document
}) || null;
const vmLifecycleModule = window.FolderViewPlusVmRuntimeLifecycle || null;
let vmLifecycleApi = null;
const applyVmThemeResolverTokens = (reason = 'vm-runtime:initial', options = {}) => (
    themeResolver && typeof themeResolver.applyResolvedThemeTokens === 'function'
        ? themeResolver.applyResolvedThemeTokens(reason, options)
        : null
);
const DEFAULT_FOLDER_ICON_PATH = '/plugins/folderview.plus/images/folder-icon.png';
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
const normalizeFolderPreviewOverflow = typeof runtimeShared.normalizeFolderPreviewOverflow === 'function'
    ? runtimeShared.normalizeFolderPreviewOverflow
    : ((settings = {}) => ['expand_row', 'scroll'].includes(settings?.preview_overflow) ? settings.preview_overflow : 'default');
const isCompactMultiRowPreview = typeof runtimeShared.isCompactMultiRowPreview === 'function'
    ? runtimeShared.isCompactMultiRowPreview
    : ((settings = {}) => {
        const normalizedRows = normalizeFolderPreviewRowLimit(settings);
        return normalizedRows === 0 || normalizedRows > 1;
    });
const getPreviewHoverAnimationClass = typeof runtimeShared.getPreviewHoverAnimationClass === 'function'
    ? runtimeShared.getPreviewHoverAnimationClass
    : ((settings = {}) => {
        const normalized = String(settings?.preview_hover_animation || settings?.previewHoverAnimation || '').trim().toLowerCase();
        const aliases = { grow: 'pop', pulse: 'glow', spin: 'flip' };
        const token = aliases[normalized] || normalized;
        return ['lift', 'bounce', 'pop', 'glow', 'flip', 'wiggle'].includes(token) ? `fv-hover-animation-${token}` : '';
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
        runtimePrefsSchema: 4,
        liveRefreshEnabled: false,
        liveRefreshSeconds: 20,
        performanceProfile: 'standard',
        performanceMode: false,
        lazyPreviewEnabled: false,
        lazyPreviewThreshold: 30,
        dashboard: {
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
            privacyMaskExternalUrls: true
        },
        health: {
            cardsEnabled: true,
            runtimeBadgeEnabled: false,
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
const reconcileVmMemberIdentities = (folders, runtimeInfo) => {
    if (!memberIdentityModule || typeof memberIdentityModule.reconcileFolders !== 'function') {
        return folders;
    }
    const result = memberIdentityModule.reconcileFolders('vm', folders, runtimeInfo);
    const patches = result?.patches && typeof result.patches === 'object' ? result.patches : {};
    if (Object.keys(patches).length > 0 && typeof window.FolderViewPlusRequest?.postJson === 'function') {
        window.FolderViewPlusRequest.postJson('/plugins/folderview.plus/server/reconcile_member_identities.php', {
            type: 'vm',
            patches: JSON.stringify(patches)
        }, { retries: 0 }).catch((error) => {
            console.warn('folderview.plus: VM member identity reconciliation could not be persisted.', error);
        });
    }
    window.FolderViewPlusMemberIdentityDiagnostics = {
        ...(window.FolderViewPlusMemberIdentityDiagnostics || {}),
        vm: result?.diagnostics || {}
    };
    return result?.folders || folders;
};
const vmPrefsCoordinator = window.FolderViewPlusPrefsStore?.getDefaultCoordinator({
    normalizePrefs: utils.normalizePrefs,
    request: window.FolderViewPlusRequest
}) || null;
const normalizeVmPrefsResponse = (response = {}) => {
    const normalized = utils.normalizePrefs({
        ...(response?.prefs || {}),
        _metadata: response?.metadata || response?.prefs?._metadata || {}
    });
    return vmPrefsCoordinator
        ? vmPrefsCoordinator.reconcile('vm', normalized)
        : normalized;
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
        createRequest: (url) => window.FolderViewPlusRequest.getText(url)
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
    window.FolderViewPlusRuntimeHostAdaptersModuleLoaded !== true
    || !runtimeHostAdapters
    || typeof runtimeHostAdapters.getOrCreate !== 'function'
) {
    vmBootstrapMissingModules.push('runtime.host-adapter.js');
    setVmFatalBannerModuleStatus('runtime.host-adapter.js', 'missing', 'shared host adapter unavailable');
} else {
    setVmFatalBannerModuleStatus('runtime.host-adapter.js', 'ok', 'VM host adapter ready');
}
if (!runtimeFolderOrdering || typeof runtimeFolderOrdering.createOrderCursor !== 'function') {
    vmBootstrapMissingModules.push('runtime.folder-ordering.js');
    setVmFatalBannerModuleStatus('runtime.folder-ordering.js', 'missing', 'folder ordering contract unavailable');
} else {
    setVmFatalBannerModuleStatus('runtime.folder-ordering.js', 'ok', 'folder ordering contract ready');
}
if (typeof runtimeShared.createFolderRowActionsController !== 'function') {
    vmBootstrapMissingModules.push('folder.runtime.row-actions.js');
    setVmFatalBannerModuleStatus('folder.runtime.row-actions.js', 'missing', 'folder row action lifecycle unavailable');
} else {
    setVmFatalBannerModuleStatus('folder.runtime.row-actions.js', 'ok', 'folder row actions ready');
}
if (
    window.FolderViewPlusVmRuntimeLifecycleModuleLoaded !== true
    || !vmLifecycleModule
    || typeof vmLifecycleModule.createApi !== 'function'
) {
    vmBootstrapMissingModules.push('vm.runtime.lifecycle.js');
    setVmFatalBannerModuleStatus('vm.runtime.lifecycle.js', 'missing', 'VM lifecycle coordinator unavailable');
} else {
    setVmFatalBannerModuleStatus('vm.runtime.lifecycle.js', 'ok', 'VM lifecycle coordinator ready');
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
const vmHostAdapter = runtimeHostAdapters?.getOrCreate?.('vm', { window, document }) || null;
const ensureVmHostPageStructure = () => {
    if (!vmHostAdapter || typeof vmHostAdapter.ensureStructure !== 'function') {
        throw new Error('VM host adapter unavailable');
    }
    vmHostAdapter.ensureStructure({
        onValid: () => setVmFatalBannerModuleStatus('host-page-structure', 'ok', 'expected VM host selectors detected'),
        onInvalid: (error, missing) => {
            setVmFatalBannerModuleStatus('host-page-structure', 'missing', missing.join(' | '));
            reportVmFatalRuntimeError(error, {
                title: 'VM page structure changed',
                message: 'FolderView Plus expected the standard Unraid VM table markup, but required host page elements were missing.',
                code: 'FVPLUS-VM-DOM-001',
                phase: 'host-dom',
                category: 'host-page-structure',
                detailLabel: 'Missing selectors',
                details: missing
            });
            if (fatalBanner) error.fvplusBannerShown = true;
        }
    });
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
        if (typeof onerror === 'function') {
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
const createVmDeferredPreviewController = typeof runtimeShared.createDeferredPreviewController === 'function'
    ? runtimeShared.createDeferredPreviewController
    : () => ({ start: () => {}, defer: () => false, refresh: () => {}, flush: () => {}, destroy: () => {}, snapshot: () => ({ active: false, pending: 0 }) });
const vmDeferredPreviewController = createVmDeferredPreviewController();
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

    const overflowMode = normalizeFolderPreviewOverflow(settings);
    if (overflowMode === 'scroll') {
        finalizePreviewRows($preview, [wrappers], settings);
        return;
    }
    const rowLimit = overflowMode === 'expand_row' ? 0 : normalizeFolderPreviewRowLimit(settings);
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
    vmRuntimePerformanceTelemetry?.begin?.(`action.${actionName}`);
    const result = await vmActionBoundary.run(actionName, action, context);
    vmPerfTelemetry.end(actionName, { ok: result.ok });
    vmRuntimePerformanceTelemetry?.end?.(`action.${actionName}`, { ok: result.ok });
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
        preferenceCoordinator: vmPrefsCoordinator,
        readPrefs: () => folderTypePrefs || {},
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
const normalizeChildFolderOrder = (value) => {
    const source = Array.isArray(value) ? value : [];
    const seen = new Set();
    const result = [];
    source.forEach((entry) => {
        const id = String(entry || '').trim();
        if (!id || seen.has(id)) {
            return;
        }
        seen.add(id);
        result.push(id);
    });
    return result;
};
const sortFolderChildren = (parentId, childIds) => {
    const ids = Array.isArray(childIds) ? childIds.map((id) => String(id || '').trim()).filter(Boolean) : [];
    const sourceIndex = new Map(ids.map((id, index) => [id, index]));
    const parentSettings = globalFolders?.[parentId]?.settings || {};
    const orderIndex = new Map(normalizeChildFolderOrder(parentSettings.child_folder_order || parentSettings.childFolderOrder).map((id, index) => [id, index]));
    return ids.sort((left, right) => {
        const leftOrder = orderIndex.has(left) ? orderIndex.get(left) : Number.MAX_SAFE_INTEGER;
        const rightOrder = orderIndex.has(right) ? orderIndex.get(right) : Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) {
            return leftOrder - rightOrder;
        }
        return (sourceIndex.get(left) || 0) - (sourceIndex.get(right) || 0);
    });
};
const getFolderChildren = (folderId) => {
    const id = String(folderId || '').trim();
    if (!id) {
        return [];
    }
    const children = Object.entries(globalFolders || {})
        .filter(([childId, folder]) => {
            const parentId = normalizeFolderParentId(folder?.parentId || folder?.parent_id || '');
            return parentId === id && childId !== id;
        })
        .map(([childId]) => childId);
    return sortFolderChildren(id, children);
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
let vmPinnedFolderIdsOverride = null;
const normalizeVmPinnedFolderIdList = (value) => {
    if (!Array.isArray(value)) {
        return [];
    }
    return Array.from(new Set(value.map((item) => String(item || '').trim()).filter((item) => item !== '')));
};
const vmPinnedFolderIdListsMatch = (left, right) => {
    const normalizedLeft = normalizeVmPinnedFolderIdList(left);
    const normalizedRight = normalizeVmPinnedFolderIdList(right);
    return normalizedLeft.length === normalizedRight.length
        && normalizedLeft.every((entry, index) => entry === normalizedRight[index]);
};
const rememberVmPinnedFolderIdsOverride = (nextPinnedIds) => {
    vmPinnedFolderIdsOverride = {
        pinnedFolderIds: normalizeVmPinnedFolderIdList(nextPinnedIds),
        expiresAt: Date.now() + 10000
    };
};
const clearVmPinnedFolderIdsOverride = () => {
    vmPinnedFolderIdsOverride = null;
};
const applyVmPinnedFolderPrefsOverride = (prefs = {}) => {
    const normalized = utils.normalizePrefs(prefs || {});
    if (!vmPinnedFolderIdsOverride || Date.now() > Number(vmPinnedFolderIdsOverride.expiresAt || 0)) {
        clearVmPinnedFolderIdsOverride();
        return normalized;
    }
    const overridePinnedIds = normalizeVmPinnedFolderIdList(vmPinnedFolderIdsOverride.pinnedFolderIds);
    if (vmPinnedFolderIdListsMatch(normalized.pinnedFolderIds, overridePinnedIds)) {
        return normalized;
    }
    return utils.normalizePrefs({
        ...normalized,
        pinnedFolderIds: overridePinnedIds
    });
};
const assertVmPrefsSaveResponse = (response, fallbackMessage = 'Failed to save VM preferences.') => {
    if (!response || response.ok === false) {
        throw new Error(String(response?.error || fallbackMessage));
    }
    return response;
};
const fetchVmPinnedFolderPrefs = async () => {
    const url = `/plugins/folderview.plus/server/prefs.php?type=vm&_=${Date.now()}`;
    const request = window.FolderViewPlusRequest;
    let response = null;
    if (request && typeof request.getJson === 'function') {
        response = await request.getJson(url, {
            retries: 1,
            retryDelayMs: 220
        });
    } else {
        response = await pluginRequestClient.getJson(url);
    }
    assertVmPrefsSaveResponse(response, 'Failed to confirm VM pinned folders.');
    return normalizeVmPrefsResponse(response);
};
const persistVmPinnedFolderIds = async (nextPinnedIds) => {
    if (vmPrefsCoordinator) {
        const prefs = await vmPrefsCoordinator.save('vm', {
            pinnedFolderIds: nextPinnedIds
        }, {
            currentPrefs: folderTypePrefs,
            immediate: true
        });
        return { ok: true, prefs };
    }
    const payload = {
        type: 'vm',
        prefs: JSON.stringify({ pinnedFolderIds: nextPinnedIds })
    };
    const request = window.FolderViewPlusRequest;
    let response = null;
    if (request && typeof request.postJson === 'function') {
        try {
            response = await request.postJson('/plugins/folderview.plus/server/prefs.php', payload, {
                retries: 0,
                retryDelayMs: 260
            });
        } catch (_error) {
            // Fall through to the legacy POST path so pinning still works if the
            // runtime request wrapper is late, degraded, or temporarily broken.
        }
    }
    if (!response) {
        response = await pluginRequestClient.postJson('/plugins/folderview.plus/server/prefs.php', payload);
    }
    assertVmPrefsSaveResponse(response, 'Failed to save VM pinned folders.');
    const confirmedPrefs = await fetchVmPinnedFolderPrefs();
    if (!vmPinnedFolderIdListsMatch(confirmedPrefs.pinnedFolderIds, nextPinnedIds)) {
        throw new Error('VM pinned folders did not persist.');
    }
    return {
        ...response,
        prefs: confirmedPrefs
    };
};
const toggleVmFolderPin = async (folderId, requestedPinned = !isVmFolderPinned(folderId)) => {
    const id = String(folderId || '').trim();
    if (!id || !globalFolders[id]) {
        return;
    }
    const current = Array.isArray(folderTypePrefs?.pinnedFolderIds) ? [...folderTypePrefs.pinnedFolderIds] : [];
    const nextPinned = requestedPinned === true
        ? (current.includes(id) ? current : [...current, id])
        : current.filter((entry) => entry !== id);
    return vmSafeUiActionRunner.run(`vm-pin:${id}`, async (intent) => {
        const result = await runVmGuardedAction('toggle-folder-pin', async () => {
            const response = await persistVmPinnedFolderIds(nextPinned);
            if (!intent.isLatest()) {
                return;
            }
            applyVmPinnedFolderIds(Array.isArray(response?.prefs?.pinnedFolderIds) ? response.prefs.pinnedFolderIds : nextPinned);
            refreshVmFolderQuickActionStates();
        }, {
            userMessage: 'Failed to update pinned folders.',
            userVisible: false
        });
        if (!result.ok && intent.isLatest()) {
            clearVmPinnedFolderIdsOverride();
            applyVmPinnedFolderIds(current);
            refreshVmFolderQuickActionStates();
        }
    }, { queueIfBusy: true, onIntent: () => {
        rememberVmPinnedFolderIdsOverride(nextPinned);
        applyVmPinnedFolderIds(nextPinned);
        refreshVmFolderQuickActionStates();
    } });
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
    return pluginRequestClient.postJson(url, payload, options);
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

    const table = vmHostAdapter?.getTable?.();
    const host = table?.parentElement || vmHostAdapter?.getPrimaryBody?.()?.parentElement;
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
    const tbody = $(vmHostAdapter?.getPrimaryBody?.() || []);
    if (!tbody.length || tbody.find('tr.fv-runtime-loading-row').length) {
        return;
    }
    tbody.prepend('<tr class="fv-runtime-loading-row"><td colspan="12"><i class="fa fa-circle-o-notch fa-spin"></i> Loading VM folders...</td></tr>');
};

const hideVmRuntimeLoadingRow = () => {
    vmHostAdapter?.getBodies?.().forEach((body) => $(body).find('tr.fv-runtime-loading-row').remove());
};

const VM_NATIVE_DETAIL_ROW_SELECTOR = 'tr[id^="name-"]:not([child-id])';
const VM_NATIVE_TOGGLE_SELECTOR = 'a[onclick*="toggle_id("]';
const VM_NATIVE_DETAIL_REQUEST_WINDOW_MS = 1600;
let vmNativeDetailRowObserver = null;
let vmNativeDetailRowObserverHost = null;
let vmNativeToggleClickHost = null;
let vmNativeDetailAdoptionSuspendDepth = 0;
let vmZebraRefreshTimer = null;
let vmLastNativeDetailRequest = {
    detailId: '',
    row: null,
    requestedAt: 0
};

const applyVmZebra = () => {
    let visibleIndex = 0;
    $('#kvm_table tbody tr').each(function applyVmZebraRow() {
        const $row = $(this);
        if (!$row.is(':visible')) {
            return;
        }
        if ($row.hasClass('fv-runtime-loading-row')) {
            this.style.backgroundColor = '';
            return;
        }
        this.style.backgroundColor = (visibleIndex % 2 === 1)
            ? 'var(--fvplus-vm-row-alt-bg, var(--dynamix-tablesorter-tbody-row-alt-bg-color, transparent))'
            : 'var(--fvplus-vm-row-bg, transparent)';
        visibleIndex += 1;
    });
};

const scheduleVmZebraRefresh = (delayMs = 32) => {
    if (vmZebraRefreshTimer !== null) {
        window.clearTimeout(vmZebraRefreshTimer);
    }
    vmZebraRefreshTimer = window.setTimeout(() => {
        vmZebraRefreshTimer = null;
        applyVmZebra();
    }, Math.max(0, Number(delayMs) || 0));
};

const isVmNativeDetailRow = (row) => (
    row instanceof HTMLTableRowElement
    && String(row.id || '').startsWith('name-')
    && !row.hasAttribute('child-id')
);

const getVmNativeDetailRowId = (row) => (
    isVmNativeDetailRow(row)
        ? String(row.id || '').trim()
        : ''
);

const extractVmNativeToggleDetailId = (value) => {
    const match = String(value || '').match(/toggle_id\((['"])(name-[^'")]+)\1\)/);
    return match ? String(match[2] || '').trim() : '';
};

const clearVmFolderElementOwnership = (row) => {
    if (!(row instanceof Element)) {
        return;
    }
    Array.from(row.classList)
        .filter((token) => /^folder-.+-element$/.test(token))
        .forEach((token) => row.classList.remove(token));
    row.classList.remove('folder-element');
};

const applyVmFolderElementOwnership = (row, folderId) => {
    if (!(row instanceof Element)) {
        return;
    }
    clearVmFolderElementOwnership(row);
    const safeFolderId = String(folderId || '').trim();
    if (!safeFolderId) {
        return;
    }
    row.classList.add(`folder-${safeFolderId}-element`, 'folder-element');
};

const findVmFolderOwnerIdForRow = (row) => {
    if (!(row instanceof Element)) {
        return '';
    }
    const token = Array.from(row.classList).find((value) => /^folder-.+-element$/.test(value));
    if (!token) {
        return '';
    }
    const match = token.match(/^folder-(.+)-element$/);
    return match ? String(match[1] || '').trim() : '';
};

const isVmFolderExpanded = (folderId) => (
    $(`.dropDown-${String(folderId || '').trim()}`).attr('active') === 'true'
);

const findVmNativeToggleAnchorForDetailId = (detailId) => {
    const targetDetailId = String(detailId || '').trim();
    if (!targetDetailId) {
        return null;
    }
    const anchors = Array.from(document.querySelectorAll(VM_NATIVE_TOGGLE_SELECTOR));
    return anchors.find((anchor) => extractVmNativeToggleDetailId(anchor.getAttribute('onclick')) === targetDetailId) || null;
};

const findVmRuntimeRowForDetailId = (detailId) => {
    const targetDetailId = String(detailId || '').trim();
    if (!targetDetailId) {
        return null;
    }
    const directAnchor = findVmNativeToggleAnchorForDetailId(targetDetailId);
    const directRow = directAnchor instanceof Element ? directAnchor.closest('tr') : null;
    if (directRow instanceof HTMLTableRowElement) {
        return directRow;
    }
    const requestedAt = Number(vmLastNativeDetailRequest.requestedAt || 0);
    const requestedRecently = requestedAt > 0 && (Date.now() - requestedAt) <= VM_NATIVE_DETAIL_REQUEST_WINDOW_MS;
    if (
        requestedRecently
        && vmLastNativeDetailRequest.detailId === targetDetailId
        && vmLastNativeDetailRequest.row instanceof HTMLTableRowElement
        && vmLastNativeDetailRequest.row.isConnected
    ) {
        return vmLastNativeDetailRequest.row;
    }
    return null;
};

const collectExistingVmDetailRowsForVmRow = (vmRow) => {
    if (!(vmRow instanceof HTMLTableRowElement)) {
        return [];
    }
    const detailId = extractVmNativeToggleDetailId(vmRow.querySelector(VM_NATIVE_TOGGLE_SELECTOR)?.getAttribute('onclick'));
    if (!detailId) {
        return [];
    }
    const detailRows = [];
    let sibling = vmRow.nextElementSibling;
    while (sibling instanceof HTMLTableRowElement && isVmNativeDetailRow(sibling)) {
        const siblingDetailId = getVmNativeDetailRowId(sibling);
        if (siblingDetailId !== detailId) {
            break;
        }
        detailRows.push(sibling);
        sibling = sibling.nextElementSibling;
    }
    return detailRows;
};

const withVmNativeDetailAdoptionSuspended = (callback) => {
    vmNativeDetailAdoptionSuspendDepth += 1;
    try {
        return callback();
    } finally {
        vmNativeDetailAdoptionSuspendDepth = Math.max(0, vmNativeDetailAdoptionSuspendDepth - 1);
    }
};

const placeVmNativeDetailRowForOwner = (detailRow, vmRow) => {
    if (!isVmNativeDetailRow(detailRow) || !(vmRow instanceof HTMLTableRowElement)) {
        return false;
    }
    const folderId = findVmFolderOwnerIdForRow(vmRow);
    return withVmNativeDetailAdoptionSuspended(() => {
        if (folderId) {
            applyVmFolderElementOwnership(detailRow, folderId);
            detailRow.dataset.fvplusVmDetailAdopted = '1';
            if (isVmFolderExpanded(folderId)) {
                vmRow.after(detailRow);
            } else {
                const storage = document.querySelector(`tr.folder-id-${folderId} .folder-storage`);
                if (storage instanceof Element) {
                    storage.appendChild(detailRow);
                } else {
                    vmRow.after(detailRow);
                }
            }
            return true;
        }
        clearVmFolderElementOwnership(detailRow);
        detailRow.dataset.fvplusVmDetailAdopted = '1';
        vmRow.after(detailRow);
        return true;
    });
};

const adoptVmNativeDetailRows = (rows = []) => {
    let adoptedCount = 0;
    rows.forEach((row) => {
        if (!isVmNativeDetailRow(row)) {
            return;
        }
        const detailId = getVmNativeDetailRowId(row);
        const vmRow = findVmRuntimeRowForDetailId(detailId);
        if (!(vmRow instanceof HTMLTableRowElement)) {
            return;
        }
        if (placeVmNativeDetailRowForOwner(row, vmRow)) {
            adoptedCount += 1;
        }
    });
    if (adoptedCount > 0) {
        scheduleVmZebraRefresh();
    }
};

const ensureVmNativeDetailRowObserver = () => {
    const tbody = vmHostAdapter?.getPrimaryBody?.();
    if (!(tbody instanceof HTMLTableSectionElement)) {
        return;
    }
    if (vmNativeDetailRowObserver && vmNativeDetailRowObserverHost === tbody) {
        return;
    }
    if (vmNativeDetailRowObserver) {
        vmNativeDetailRowObserver.disconnect();
        vmNativeDetailRowObserver = null;
        vmNativeDetailRowObserverHost = null;
    }
    vmNativeDetailRowObserverHost = tbody;
    const disconnect = vmHostAdapter.observeRows(({ records: mutations }) => {
        if (vmNativeDetailAdoptionSuspendDepth > 0) {
            return;
        }
        const detailRows = [];
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (isVmNativeDetailRow(node)) {
                    detailRows.push(node);
                }
            });
        });
        if (detailRows.length > 0) {
            adoptVmNativeDetailRows(detailRows);
        }
    }, { subtree: false });
    vmNativeDetailRowObserver = { disconnect };
};

const ensureVmNativeDetailInteractionHooks = () => {
    const table = vmHostAdapter?.getTable?.();
    if (!(table instanceof HTMLTableElement) || vmNativeToggleClickHost === table) {
        return;
    }
    if (vmNativeToggleClickHost instanceof HTMLTableElement) {
        vmNativeToggleClickHost.removeEventListener('click', handleVmNativeToggleClick, true);
    }
    vmNativeToggleClickHost = table;
    table.addEventListener('click', handleVmNativeToggleClick, true);
};

function handleVmNativeToggleClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    const anchor = target ? target.closest(VM_NATIVE_TOGGLE_SELECTOR) : null;
    if (!(anchor instanceof Element)) {
        return;
    }
    const detailId = extractVmNativeToggleDetailId(anchor.getAttribute('onclick'));
    const vmRow = anchor.closest('tr');
    vmLastNativeDetailRequest = {
        detailId,
        row: vmRow instanceof HTMLTableRowElement ? vmRow : null,
        requestedAt: Date.now()
    };
    scheduleVmZebraRefresh(420);
}

let createFoldersInFlight = false;
let createFoldersQueued = false;

/**
 * Handles the creation of all folders
 */
const createFolders = async () => {
    vmDeferredPreviewController.flush();
    const vmRuntimeRoot = document.querySelector('#kvm_list, #vm_view');
    vmRuntimePerformanceTelemetry?.observe?.(vmRuntimeRoot);
    vmRuntimePerformanceTelemetry?.mark?.('nativeRowsVisible', {
        nativeRowCount: vmRuntimeRoot?.querySelectorAll?.('tr.sortable:not(.folder)')?.length || 0
    });
    vmRuntimePerformanceTelemetry?.begin?.('folderGrouping');
    const performanceRenderStartedAt = typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
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
    vmRuntimeInfoByName = normalizeVmRuntimeInfoMap(vmInfo, vmRuntimeInfoByName);
    folders = reconcileVmMemberIdentities(folders, vmInfo);
    let order = Object.values(JSON.parse(prom[3]));
    let prefsResponse = {};
    try {
        prefsResponse = prom[4] ? JSON.parse(prom[4]) : {};
    } catch (error) {
        prefsResponse = {};
    }
    folderTypePrefs = applyVmPinnedFolderPrefsOverride(normalizeVmPrefsResponse(prefsResponse));
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
            version: String(await pluginRequestClient.getText('/plugins/folderview.plus/server/version.php')).trim(),
            folders,
            unraidOrder,
            originalOrder: await pluginRequestClient.getJson('/plugins/folderview.plus/server/read_unraid_order.php', {
                data: { type: 'vm' }
            }),
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
    const maxRestoredExpansions = vmRuntimePerformanceProfile?.performanceMode === true
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
    ensureVmNativeDetailInteractionHooks();
    ensureVmNativeDetailRowObserver();
    adoptVmNativeDetailRows(Array.from(document.querySelectorAll(`tbody#kvm_list > ${VM_NATIVE_DETAIL_ROW_SELECTOR}`)));
    refreshVmFolderQuickActionStates();
    applyVmFocusedFolderState();
    syncVmRuntimeExpandedStore();
    // The restore budget is session-only. Do not overwrite the user's remembered expansion map.
    renderRuntimeHealthBadge(globalFolders, folderTypePrefs);
    scheduleVmRuntimeWidthReflow('create-folders', 0);
    applyVmZebra();

    folderDebugMode  = false;
    markVmFatalBannerStep('VM folders rendered');
    setVmFatalBannerPhase('ready');
    recordVmFatalBannerAction('VM folders rendered successfully');
    vmRuntimePerformanceTelemetry?.mark?.('foldersGrouped', {
        folderCount: Object.keys(globalFolders || {}).length
    });
    vmRuntimePerformanceTelemetry?.sampleDom?.('folders-grouped');
    } catch (error) {
        reportVmFatalRuntimeError(error, {
            phase: error?.fvplusPhase || 'bootstrap-data',
            category: error?.fvplusCategory || inferVmFatalBannerCategory(error, 'runtime-failed')
        });
        throw error;
    } finally {
        vmLastRenderMs = Math.max(0, (typeof performance !== 'undefined' && typeof performance.now === 'function'
            ? performance.now()
            : Date.now()) - performanceRenderStartedAt);
        hideVmRuntimeLoadingRow();
        vmPerfTelemetry.end('createFolders.total', {
            folderCount: Object.keys(globalFolders || {}).length,
            strictPerf: vmRuntimePerformanceProfile?.strict === true
        });
        vmRuntimePerformanceTelemetry?.end?.('folderGrouping', {
            folderCount: Object.keys(globalFolders || {}).length
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

    const lazyPreviewEnabled = vmRuntimePerformanceProfile?.deferredPreviews === true
        || folderTypePrefs?.lazyPreviewEnabled === true;
    const lazyPreviewThreshold = Number(folderTypePrefs?.lazyPreviewThreshold || 30);
    const isExpandedByDefault = folder?.settings?.expand_tab === true;
    const lazyPreviewActive = lazyPreviewEnabled
        && Number.isFinite(lazyPreviewThreshold)
        && combinedMembers.length >= Math.max(10, Math.min(200, Math.round(lazyPreviewThreshold)))
        && !isExpandedByDefault;

    // the HTML template for the folder
    const totalCols = document.querySelector("#kvm_table > thead > tr").childElementCount;
    const colspan = totalCols - 2; // minus name + autostart columns
    const hoverClass = folder.settings.preview_hover && !FV_VM_TOUCH_MODE ? 'hover' : '';
    const safeFolderIcon = sanitizeImageSrc(folder.icon, DEFAULT_FOLDER_ICON_PATH);
    const safeFolderName = escapeHtml(folder.name);
    const pinned = isVmFolderPinned(id);
    const locked = isVmFolderLocked(id);
    const focused = vmFocusedFolderId === id;
    const lockedClass = locked ? 'fv-folder-locked' : '';
    const pinnedClass = pinned ? 'fv-folder-pinned' : '';
    const focusedClass = focused ? 'fv-folder-focused' : '';
    const hoverAnimationClass = getPreviewHoverAnimationClass(folder.settings);
    const fld = `<tr parent-id="${id}" class="sortable folder-id-${id} ${hoverClass} ${lockedClass} ${pinnedClass} ${focusedClass} ${hoverAnimationClass} folder"><td class="vm-name folder-name"><div class="folder-name-sub"><i class="fa fa-arrows-v mover orange-text"></i><span class="outer folder-outer"><span id="${id}" data-fv-onclick='addVMFolderContext("${id}")' class="hand folder-hand"><img src="${safeFolderIcon}" class="img folder-img" data-fv-onerror='this.src="${DEFAULT_FOLDER_ICON_PATH}"'></span><span class="inner folder-inner"><a class="folder-appname" href="#" data-fv-onclick='editFolder("${id}")'>${safeFolderName}</a><a class="folder-appname-id">folder-${id}</a><br><i id="load-folder-${id}" class="fa fa-square stopped folder-load-status"></i><span class="state folder-state fv-folder-state-stopped"> ${$.i18n('stopped')}</span></span></span><button class="dropDown-${id} folder-dropdown" data-fv-onclick='dropDownButton("${id}")'><i class="fa fa-chevron-down" aria-hidden="true"></i></button></div></td><td colspan="${colspan}" class="folder-preview-cell"><div class="folder-storage"></div><div class="folder-preview"></div></td><td class="folder-autostart"><input class="autostart" type="checkbox" id="folder-${id}-auto" style="display:none"></td></tr><tr child-id="${id}" id="name-${id}" style="display:none"><td colspan="${totalCols}" style="margin:0;padding:0"></td></tr>`;

    // insertion at position of the folder
    if (position === 0) {
        $('#kvm_list > tr.sortable').eq(position).before($(fld));
    } else {
        $('#kvm_list > tr.sortable').eq(position - 1).next().after($(fld));
    }
    const $createdFolderRow = $(`tr.folder-id-${id}`).first();
    vmFolderRowActionsController.decorate($createdFolderRow, id);
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
                return $(`tr.folder-id-${id} div.folder-preview > span.outer:last`);
            };
            break;
        case 2:
            addPreview = (id, autostart) => {
                $(`tr.folder-id-${id} div.folder-preview`).append($(`tr.folder-id-${id} div.folder-storage > tr > td.vm-name > span.outer > span.hand:last`).clone().addClass(`${autostart ? 'autostart' : ''}`));
                return $(`tr.folder-id-${id} div.folder-preview > span.hand:last`);
            };
            break;
        case 3:
            addPreview = (id, autostart) => {
                $(`tr.folder-id-${id} div.folder-preview`).append($(`tr.folder-id-${id} div.folder-storage > tr > td.vm-name > span.outer > span.inner:last`).clone().addClass(`${autostart ? 'autostart' : ''}`));
                return $(`tr.folder-id-${id} div.folder-preview > span.inner:last`);
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
                const $inner = lstSpan.children('span.inner:last');
                $inner.append($(`tr.folder-id-${id} div.folder-storage > tr > td.vm-name > span.outer > span.inner > a:last`).clone().addClass(`${autostart ? 'autostart' : ''}`));
                return $inner;
            };
            break;
        default:
            addPreview = () => $();
            break;
    }

    // new folder is needed for not altering the old containers
    let newFolder = {};

    const customOrderCursor = runtimeFolderOrdering.createOrderCursor({
        order,
        completedFolderIds: foldersDone,
        currentFolderId: id
    });
    foldersDone = foldersDone.map(e => 'folder-'+e);

    const hiddenPreviewSet = new Set(Array.isArray(folder?.hiddenPreviewMembers) ? folder.hiddenPreviewMembers : []);
    // loop over the containers
    for (const container of combinedMembers) {

        // get both index, tis is needed for removing from the orders later
        const index = customOrderCursor.indexOf(container);
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
            customOrderCursor.remove(container);
            order.splice(offsetIndex, 1);

            // add the id to the container name
            newFolder[container] = {};
            newFolder[container].id = ct.uuid;
            newFolder[container].state = ct.state;

            // grab the container by name and put it onto the storage
            let $vmTR = $('#kvm_list > tr.sortable').filter(function() {
                return $(this).find('td.vm-name span.outer span.inner a').first().text().trim() === container;
            }).first();
            const vmRowNode = $vmTR.get(0);
            const detailRows = collectExistingVmDetailRowsForVmRow(vmRowNode);
            const storage = $(`tr.folder-id-${id} div.folder-storage`).get(0);
            if (vmRowNode && storage instanceof Element) {
                applyVmFolderElementOwnership(vmRowNode, id);
                vmRowNode.classList.remove('sortable');
                storage.appendChild(vmRowNode);
                detailRows.forEach((detailRow) => {
                    applyVmFolderElementOwnership(detailRow, id);
                    detailRow.dataset.fvplusVmDetailAdopted = '1';
                    storage.appendChild(detailRow);
                });
            }

            if(folderDebugMode) {
                vmDebugLog(`${newFolder[container].id}(${offsetIndex}, ${index}) => ${id}`);
            }
            
            if (!hiddenPreviewSet.has(container)) {
            const $previewMember = addPreview(id, ct.autostart);
            if ($previewMember && $previewMember.length) {
                $previewMember.attr('data-fv-runtime-name', container);
            }
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
                sel.append($(`<span class="folder-element-custom-btn folder-element-logs"><a href="#" data-fv-onclick="openTerminal('log', '${container}', '${ct.logs}')"><i class="fa fa-bars" aria-hidden="true"></i></a></span>`));
            }
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
    if (lazyPreviewActive) {
        const previewElement = $preview.get(0);
        const rowElement = $(`tr.folder-id-${id}`).get(0);
        vmDeferredPreviewController.defer(previewElement, {
            interactionTarget: rowElement,
            placeholder: `${combinedMembers.length} members · preview deferred`,
            onHydrated: () => layoutFolderPreviewRows($(previewElement), folder.settings)
        });
    }

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
    let folderStatusKind;
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
    scheduleVmZebraRefresh();
    folderEvents.dispatchEvent(new CustomEvent('vm-post-folder-expansion', {detail: { id }}));
};
const vmFolderRowActionsController = runtimeShared.createFolderRowActionsController({
    document,
    $,
    namespace: 'fvVmFolderRowAction',
    actionAttribute: 'data-fv-vm-folder-action',
    handlers: {
        toggle: (id) => dropDownButton(id),
        edit: (id) => editFolder(id),
        context: (id) => addVMFolderContext(id)
    }
});
const bindVmFolderRowActions = () => vmFolderRowActionsController.bind();

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
        await pluginRequestClient.postJson('/plugins/folderview.plus/server/delete.php', { type: 'vm', id });
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
            const lifecycleRequests = [];
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
                        lifecycleRequests.push({ action: requestAction, uuid: cid });
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
                    }, () => { void refreshVmRuntimeStateInPlace(); });
                } else if (vmLifecycleApi && typeof vmLifecycleApi.run === 'function') {
                    await vmLifecycleApi.run(lifecycleRequests, { source: 'folder-action' });
                } else {
                    await refreshVmRuntimeStateInPlace();
                    window.setTimeout(() => { void refreshVmRuntimeStateInPlace(); }, 650);
                }
            } finally {
                updateVmFolderRuntimeSummary(id, folder);
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
            const lifecycleRequests = [];
            const queueLifecyclePost = (requestAction, uuid) => {
                lifecycleRequests.push({ action: requestAction, uuid });
                prom.push($.post(eventURL, { action: requestAction, uuid }, null, 'json').promise());
            };
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
                                    queueLifecyclePost('domain-stop', e.id);
                                } else if(e.state !== "running" && e.state !== "pmsuspended" && e.state !== "paused" && e.state !== "unknown"){
                                    queueLifecyclePost('domain-start', e.id);
                                }
                            };
                        } else if(act.modes === 1) {
                            ctAction = (e) => {
                                if(e.state === "running") {
                                    queueLifecyclePost('domain-pause', e.id);
                                } else if(e.state === "paused" || e.state === "unknown") {
                                    queueLifecyclePost('domain-resume', e.id);
                                }
                            };
                        }

                    } else if(act.action === 1) {

                        if(act.modes === 0) {
                            ctAction = (e) => {
                                if(e.state !== "running" && e.state !== "pmsuspended" && e.state !== "paused" && e.state !== "unknown") {
                                    queueLifecyclePost('domain-start', e.id);
                                }
                            };
                        } else if(act.modes === 1) {
                            ctAction = (e) => {
                                if(e.state === "running") {
                                    queueLifecyclePost('domain-stop', e.id);
                                }
                            };
                        } else if(act.modes === 2) {
                            ctAction = (e) => {
                                if(e.state === "running") {
                                    queueLifecyclePost('domain-pause', e.id);
                                }
                            };
                        } else if(act.modes === 3) {
                            ctAction = (e) => {
                                if(e.state === "paused" || e.state === "unknown") {
                                    queueLifecyclePost('domain-restart', e.id);
                                }
                            };
                        }

                    } else if(act.action === 2) {

                        ctAction = (e) => {
                            if(e.state === "running") {
                                queueLifecyclePost('domain-pause', e.id);
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
                        const scriptVariables = {};
                        const rawVars = await $.post("/plugins/user.scripts/exec.php",{action:'getScriptVariables',script:`/boot/config/plugins/user.scripts/scripts/${act.script}/script`}).promise();
                        rawVars.trim().split('\n').forEach((e) => { const variable = e.split('='); scriptVariables[variable[0]] = variable[1]; });
                        if(scriptVariables['directPHP']) {
                            $.post("/plugins/user.scripts/exec.php",{action:'directRunScript',path:`/boot/config/plugins/user.scripts/scripts/${act.script}/script`},function(data) {if(data) { openBox(data,act.name,800,1200, 'loadlist');}});
                        } else {
                            $.post("/plugins/user.scripts/exec.php",{action:'convertScript',path:`/boot/config/plugins/user.scripts/scripts/${act.script}/script`},function(data) {if(data) {openBox('/plugins/user.scripts/startScript.sh&arg1='+data+'&arg2='+args,act.name,800,1200,true, 'loadlist');}});
                        }
                    } else {
                        const cmd = await $.post("/plugins/user.scripts/exec.php",{action:'convertScript', path:`/boot/config/plugins/user.scripts/scripts/${act.script}/script`}).promise();
                        prom.push($.get('/logging.htm?cmd=/plugins/user.scripts/backgroundScript.sh&arg1='+cmd+'&arg2='+args+'&csrf_token='+csrf_token+'&done=Done').promise());
                    }
                }

                await Promise.all(prom);
                if (lifecycleRequests.length > 0 && vmLifecycleApi && typeof vmLifecycleApi.run === 'function') {
                    await vmLifecycleApi.run(lifecycleRequests, { source: 'custom-folder-action' });
                } else {
                    queueLoadlistRefresh();
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
            await pluginRequestClient.postJson('/plugins/folderview.plus/server/create.php', {
                type: 'vm',
                content: JSON.stringify(clonePayload)
            });
            await pluginRequestClient.postJson('/plugins/folderview.plus/server/sync_order.php', { type: 'vm' });
            queueLoadlistRefresh();
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
                    retries: 0,
                    retryDelayMs: 260
                });
                swal.close();
                queueLoadlistRefresh();
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
            toggleVmFolderPin(id, !pinned);
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
let vmRuntimeInfoByName = {};
let liveRefreshTimer = null;
let liveRefreshMs = 0;
let liveRefreshInFlight = false;
let queuedLoadlistTimer = null;
let queuedLoadlistRequestedAt = 0;
let lastLiveRefreshStateSignature = '';
let lastVmRuntimeSnapshotToken = '';
let lastVmRuntimeSnapshotRevisions = { folder: 0, prefs: 0 };
const LOADLIST_REFRESH_DEBOUNCE_MS = 90;
const LOADLIST_REFRESH_MIN_GAP_MS = 420;
const PERFORMANCE_MODE_EXPAND_RESTORE_LIMIT = 12;
let vmLastRenderMs = 0;
let vmRuntimePerformanceProfile = resolveVmRuntimePerformanceProfile(folderTypePrefs, {
    folderCount: 0,
    itemCount: 0
});

const resolveVmStrictPerformanceProfile = (prefs, folders, vmInfo) => {
    const folderCount = Object.keys(folders && typeof folders === 'object' ? folders : {}).length;
    const itemCount = Object.keys(vmInfo && typeof vmInfo === 'object' ? vmInfo : {}).length;
    vmRuntimePerformanceProfile = resolveVmRuntimePerformanceProfile(prefs || {}, {
        folderCount,
        itemCount,
        renderMs: vmLastRenderMs,
        previousStrict: vmRuntimePerformanceProfile?.strict === true
    });
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

const fetchVmRuntimeSnapshotCheck = async () => {
    if (!runtimeSnapshotApi || typeof runtimeSnapshotApi.buildUrl !== 'function') {
        const parsed = await pluginRequestClient.getJson('/plugins/folderview.plus/server/read_info.php', {
            data: { type: 'vm', mode: 'state' },
            cache: false
        });
        const signature = buildVmStateSignature(parsed, true);
        return {
            notModified: signature === lastLiveRefreshStateSignature,
            snapshotToken: '',
            runtimeSignature: signature
        };
    }
    const payload = await pluginRequestClient.getJson(runtimeSnapshotApi.buildUrl('vm', 'check', {
        since: lastVmRuntimeSnapshotToken,
        forceRefresh: true
    }), { cache: false });
    return runtimeSnapshotApi.parsePayload(payload);
};

const rememberVmRuntimeSnapshot = (snapshot) => {
    if (snapshot?.snapshotToken) {
        lastVmRuntimeSnapshotToken = String(snapshot.snapshotToken);
    }
    if (snapshot?.revisions && typeof snapshot.revisions === 'object') {
        lastVmRuntimeSnapshotRevisions = {
            folder: Math.max(0, Number(snapshot.revisions.folder) || 0),
            prefs: Math.max(0, Number(snapshot.revisions.prefs) || 0)
        };
    }
};

const vmRuntimeSnapshotConfigMatches = (snapshot) => {
    if (!lastVmRuntimeSnapshotToken || !snapshot?.revisions) {
        return true;
    }
    return Math.max(0, Number(snapshot.revisions.folder) || 0) === lastVmRuntimeSnapshotRevisions.folder
        && Math.max(0, Number(snapshot.revisions.prefs) || 0) === lastVmRuntimeSnapshotRevisions.prefs;
};

const normalizeVmRuntimeInfoMap = (source, previousMap = null) => {
    const rawMap = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
    const previous = previousMap && typeof previousMap === 'object' && !Array.isArray(previousMap) ? previousMap : {};
    const normalized = {};
    Object.entries(rawMap).forEach(([name, entry]) => {
        const safeName = String(name || entry?.name || '').trim();
        if (!safeName || !entry || typeof entry !== 'object') {
            return;
        }
        normalized[safeName] = {
            ...(previous[safeName] || {}),
            ...entry,
            name: safeName,
            uuid: String(entry.uuid || previous[safeName]?.uuid || '').trim(),
            state: String(entry.state || previous[safeName]?.state || 'unknown').trim().toLowerCase(),
            autostart: entry.autostart === true
        };
    });
    return normalized;
};

const getVmRuntimeStateMeta = (entry = {}) => {
    const state = String(entry?.state || 'unknown').trim().toLowerCase();
    if (state === 'running') {
        return { state, key: 'started', icon: 'fa-play', className: 'started', colorClass: 'green-text', active: true, paused: false };
    }
    if (state === 'paused' || state === 'pmsuspended' || state === 'unknown') {
        return { state, key: 'paused', icon: 'fa-pause', className: 'paused', colorClass: 'orange-text', active: true, paused: true };
    }
    return { state, key: 'stopped', icon: 'fa-square', className: 'stopped', colorClass: 'red-text', active: false, paused: false };
};

const syncVmRuntimeStateSurface = ($surface, entry = {}) => {
    if (!$surface || !$surface.length) {
        return;
    }
    const meta = getVmRuntimeStateMeta(entry);
    const label = typeof $.i18n === 'function' ? String($.i18n(meta.key) || meta.key) : meta.key;
    const $outer = $surface.hasClass('outer') ? $surface : $surface.find('span.outer').first();
    const $scope = $outer.length ? $outer : $surface;
    const $state = $scope.find('span.state').first();
    const $icon = $state.length ? $state.prevAll('i.fa').first() : $scope.find('i[id^="load-"], i.folder-load-status-vm').first();
    $scope.add($scope.find('span.hand, span.inner, a'))
        .removeClass('started paused stopped running shutoff pmsuspended unknown green-text orange-text red-text')
        .addClass(meta.className);
    $surface.attr('data-fv-runtime-state', meta.state);
    if ($icon.length) {
        $icon.removeClass('fa-play fa-pause fa-square fa-refresh fa-spin fa-spinner fa-circle-o-notch started paused stopped running shutoff pmsuspended unknown green-text orange-text red-text')
            .addClass(`fa ${meta.icon} ${meta.className} ${meta.colorClass}`)
            .removeAttr('aria-busy');
    }
    if ($state.length) {
        $state.text(` ${label}`).removeClass('started paused stopped').addClass(meta.className);
    }
    $scope.toggleClass('autostart', entry?.autostart === true);
};

const findVmRuntimeRowsByName = (name) => {
    const safeName = String(name || '').trim();
    if (!safeName) {
        return $();
    }
    return $('#kvm_list tr').not('.folder').filter(function matchVmRuntimeRow() {
        return String($(this).find('td.vm-name span.outer span.inner a').first().text() || '').trim() === safeName;
    });
};

const getVmRuntimeEntryByUuid = (uuid, fallbackName = '') => {
    const safeUuid = String(uuid || '').trim();
    const safeName = String(fallbackName || '').trim();
    if (safeName && vmRuntimeInfoByName[safeName]) {
        return vmRuntimeInfoByName[safeName];
    }
    return Object.values(vmRuntimeInfoByName || {}).find((entry) => (
        String(entry?.uuid || entry?.id || '').trim() === safeUuid
    )) || null;
};

const getVmLifecycleSurfaces = (request = {}) => {
    const entry = getVmRuntimeEntryByUuid(request?.uuid);
    const name = String(entry?.name || '').trim();
    if (!name) return [];
    const surfaces = [];
    findVmRuntimeRowsByName(name).each((_, row) => surfaces.push(row));
    $('[data-fv-runtime-name]').filter(function matchVmLifecyclePreview() {
        return String($(this).attr('data-fv-runtime-name') || '').trim() === name;
    }).each((_, node) => surfaces.push(node));
    return Array.from(new Set(surfaces));
};

const updateVmFolderRuntimeSummary = (id, folder) => {
    const names = Object.keys(folder?.containers || {});
    const entries = names.map((name) => vmRuntimeInfoByName[name]).filter(Boolean);
    let started = 0;
    let paused = 0;
    let stopped = 0;
    let autostart = 0;
    let autostartStarted = 0;
    entries.forEach((entry) => {
        const meta = getVmRuntimeStateMeta(entry);
        if (meta.className === 'started') started += 1;
        else if (meta.className === 'paused') paused += 1;
        else stopped += 1;
        if (entry.autostart === true) {
            autostart += 1;
            if (meta.className !== 'stopped') autostartStarted += 1;
        }
        const current = folder.containers[entry.name] && typeof folder.containers[entry.name] === 'object'
            ? folder.containers[entry.name]
            : {};
        folder.containers[entry.name] = { ...current, id: entry.uuid || current.id || '', state: entry.state, autostart: entry.autostart === true };
    });
    const total = entries.length;
    const $folderRow = $(`tr.folder-id-${id}`);
    const $folderIcon = $folderRow.find(`i#load-folder-${id}`);
    const $folderState = $folderRow.find('span.folder-state');
    const aggregate = started > 0
        ? { count: started, key: 'started', icon: 'fa-play', className: 'started' }
        : (paused > 0
            ? { count: paused, key: 'paused', icon: 'fa-pause', className: 'paused' }
            : { count: stopped, key: 'stopped', icon: 'fa-square', className: 'stopped' });
    const aggregateColorClass = aggregate.className === 'started'
        ? 'green-text'
        : (aggregate.className === 'paused' ? 'orange-text' : 'red-text');
    $folderIcon.removeClass('fa-play fa-pause fa-square fa-refresh fa-spin fa-spinner fa-circle-o-notch started paused stopped green-text orange-text red-text')
        .addClass(`fa ${aggregate.icon} ${aggregate.className} ${aggregateColorClass} folder-load-status`)
        .removeAttr('aria-busy');
    $folderState.removeClass('fv-folder-state-started fv-folder-state-paused fv-folder-state-stopped')
        .text(`${aggregate.count}/${total} ${$.i18n(aggregate.key)}`)
        .addClass(`fv-folder-state-${aggregate.className}`);
    $folderRow.removeClass('no-autostart autostart-off autostart-partial autostart-full');
    if (autostart === 0) $folderRow.addClass('no-autostart');
    else if (autostartStarted === 0) $folderRow.addClass('autostart-off');
    else if (autostartStarted < autostart) $folderRow.addClass('autostart-partial');
    else $folderRow.addClass('autostart-full');
    $(`#folder-${id}-auto`).prop('checked', autostart > 0);
    const expanded = folder?.status?.expanded === true;
    folder.status = { started, paused, stopped, autostart, autostartStarted, expanded };
};

const syncVmRuntimeRows = (changedNames) => {
    vmDeferredPreviewController.flush();
    const changedSet = changedNames instanceof Set ? changedNames : new Set(Array.isArray(changedNames) ? changedNames : []);
    changedSet.forEach((name) => {
        const entry = vmRuntimeInfoByName[name];
        if (!entry) return;
        findVmRuntimeRowsByName(name).each((_, row) => syncVmRuntimeStateSurface($(row), entry));
        $('[data-fv-runtime-name]').filter(function matchVmPreviewMember() {
            return String($(this).attr('data-fv-runtime-name') || '') === name;
        }).each((_, node) => syncVmRuntimeStateSurface($(node), entry));
    });
    let patchedFolders = 0;
    Object.entries(globalFolders || {}).forEach(([id, folder]) => {
        const names = Object.keys(folder?.containers || {});
        if (!names.some((name) => changedSet.has(name))) return;
        updateVmFolderRuntimeSummary(id, folder);
        patchedFolders += 1;
    });
    renderRuntimeHealthBadge(globalFolders, folderTypePrefs);
    refreshVmFolderQuickActionStates();
    applyVmFocusedFolderState();
    vmRuntimeStateStore.set({
        rowReconciliation: {
            mode: 'incremental',
            changedRows: changedSet.size,
            patchedFolders,
            capturedAt: new Date().toISOString()
        }
    });
    scheduleVmZebraRefresh(0);
};

const refreshVmRuntimeStateInPlace = async (options = {}) => {
    const preserveGroupedDom = options?.preserveGroupedDom === true;
    vmRuntimePerformanceTelemetry?.begin?.('incrementalReconciliation');
    try {
        const useSnapshot = runtimeSnapshotApi && typeof runtimeSnapshotApi.buildUrl === 'function';
        const payload = await pluginRequestClient.getJson(useSnapshot
            ? runtimeSnapshotApi.buildUrl('vm', 'state', { forceRefresh: true })
            : '/plugins/folderview.plus/server/read_info.php?type=vm&mode=state&nocache=1', { cache: false });
        const snapshot = useSnapshot ? runtimeSnapshotApi.parsePayload(payload) : null;
        const parsed = snapshot ? snapshot.runtime : parseJsonPayloadSafe(payload);
        if (!parsed || Object.keys(parsed).length <= 0 || (snapshot && !vmRuntimeSnapshotConfigMatches(snapshot))) {
            if (!preserveGroupedDom) queueLoadlistRefresh();
            return false;
        }
        const nextRuntimeInfo = normalizeVmRuntimeInfoMap(parsed, vmRuntimeInfoByName);
        const rowDiff = runtimeSnapshotApi && typeof runtimeSnapshotApi.diffRuntimeRows === 'function'
            ? runtimeSnapshotApi.diffRuntimeRows('vm', vmRuntimeInfoByName, nextRuntimeInfo)
            : { changed: Object.keys(nextRuntimeInfo), structuralChanged: true, hasChanges: true };
        vmRuntimeInfoByName = nextRuntimeInfo;
        lastLiveRefreshStateSignature = buildVmStateSignature(parsed, true);
        if (snapshot) rememberVmRuntimeSnapshot(snapshot);
        if (rowDiff.structuralChanged) {
            vmRuntimeStateStore.set({
                rowReconciliation: {
                    mode: 'structural-fallback',
                    changedRows: Number(rowDiff.changed?.length || 0),
                    addedRows: Number(rowDiff.added?.length || 0),
                    removedRows: Number(rowDiff.removed?.length || 0),
                    capturedAt: new Date().toISOString()
                }
            });
            if (!preserveGroupedDom) queueLoadlistRefresh();
            return false;
        }
        if (rowDiff.hasChanges) syncVmRuntimeRows(rowDiff.changed);
        return true;
    } catch (_error) {
        if (!preserveGroupedDom) queueLoadlistRefresh();
        return false;
    } finally {
        vmRuntimePerformanceTelemetry?.end?.('incrementalReconciliation', { preserveGroupedDom });
    }
};

vmLifecycleApi = vmLifecycleModule.createApi({
    window,
    document,
    $,
    hostAdapter: vmHostAdapter,
    refreshRuntimeStateInPlace: (options = {}) => refreshVmRuntimeStateInPlace(options),
    getRuntimeEntry: (uuid, name = '') => getVmRuntimeEntryByUuid(uuid, name),
    getSurfaces: (request) => getVmLifecycleSurfaces(request),
    syncRuntimeState: (request) => {
        const entry = getVmRuntimeEntryByUuid(request?.uuid);
        const name = String(entry?.name || '').trim();
        if (name) syncVmRuntimeRows(new Set([name]));
    },
    queueNativeRefresh: () => queueLoadlistRefresh(),
    shouldTrackRequest: () => !String(vmRuntimeStateStore.get('inFlightAction', '') || '').trim(),
    delaysMs: [0, 500, 1250, 2500]
});
window.getVmLifecycleDiagnosticsSnapshot = () => vmLifecycleApi?.getSnapshot?.() || null;

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
            let check = null;
            try {
                check = await fetchVmRuntimeSnapshotCheck();
            } catch (_error) {
                check = null;
            }
            if (!check || (!check.snapshotToken && !check.runtimeSignature)) {
                queueLoadlistRefresh();
                return;
            }
            if (check.notModified !== true) {
                await refreshVmRuntimeStateInPlace();
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
    const policyMinSeconds = Number(vmRuntimePerformanceProfile?.minLiveRefreshSeconds || 0);
    const seconds = Math.max(requestedSeconds, policyMinSeconds);
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
    if (normalized.lazyPreviewEnabled !== true) {
        vmDeferredPreviewController.flush();
    }
    resolveVmStrictPerformanceProfile(normalized, globalFolders, vmRuntimeInfoByName);
    const appColumnWidth = typeof utils.normalizeAppColumnWidth === 'function'
        ? utils.normalizeAppColumnWidth(normalized.appColumnWidth)
        : (['compact', 'wide'].includes(String(normalized.appColumnWidth || '').toLowerCase()) ? String(normalized.appColumnWidth || '').toLowerCase() : 'standard');
    if (document.body && typeof document.body.setAttribute === 'function') {
        document.body.setAttribute('data-fvplus-vm-app-width', appColumnWidth);
    }
    bindVmRuntimeViewportWidthSync();
    bindVmRuntimeThemeReflow();
    scheduleVmRuntimeWidthReflow('runtime-prefs', 0);
    $('body').toggleClass('fvplus-performance-mode', vmRuntimePerformanceProfile?.reduceMotion === true);
    $('body').toggleClass('fvplus-performance-mode-strict', vmRuntimePerformanceProfile?.strict === true);
    if (document.body) {
        document.body.setAttribute('data-fvplus-performance-profile', String(vmRuntimePerformanceProfile?.mode || 'standard'));
        document.body.setAttribute('data-fvplus-performance-reason', String(vmRuntimePerformanceProfile?.reason || 'standard-profile'));
    }
    try {
        window.localStorage?.setItem('fv.performancePolicy.vm.v1', JSON.stringify({
            ...(vmRuntimePerformanceProfile || {}),
            capturedAt: new Date().toISOString()
        }));
    } catch (_error) {
        // Runtime policy visibility is best effort and never blocks rendering.
    }
    const vmPrivacyMode = normalized?.dashboard?.privacyMode === true;
    $('body').toggleClass('fvplus-privacy-vm-runtime', vmPrivacyMode);
    $('body').toggleClass('fvplus-privacy-vm-runtime-mask-names', vmPrivacyMode && normalized?.dashboard?.privacyMaskNames !== false);
    window.FolderViewPlusRuntimePrivacy?.apply('vm', vmPrivacyMode, normalized?.dashboard || {});
    renderRuntimeHealthBadge(globalFolders, normalized);
    scheduleLiveRefresh(normalized);
};
const bindVmRuntimePreferenceSync = () => {
    if (!vmPrefsCoordinator || typeof vmPrefsCoordinator.subscribe !== 'function') {
        return;
    }
    vmPrefsCoordinator.subscribe((snapshot) => {
        if (snapshot?.type !== 'vm' || !snapshot?.prefs) {
            return;
        }
        folderTypePrefs = applyVmPinnedFolderPrefsOverride(utils.normalizePrefs(snapshot.prefs));
        applyRuntimePrefs(folderTypePrefs);
    });
};
bindVmRuntimePreferenceSync();
window.getVmRuntimePerfTelemetrySnapshot = () => {
    if (!vmPerfTelemetry || typeof vmPerfTelemetry.snapshot !== 'function') {
        return {};
    }
    return vmPerfTelemetry.snapshot();
};
window.getVmHostAdapterSnapshot = () => vmHostAdapter?.getSnapshot?.() || null;
window.getVmRuntimePerformancePolicySnapshot = () => ({
    ...(vmRuntimePerformanceProfile || {}),
    deferredPreviewQueue: vmDeferredPreviewController.snapshot()
});
window.getVmRuntimeStateSnapshot = () => vmRuntimeStateStore.getState();

function buildVmFolderReq() {
    const cacheBust = Date.now();
    const legacyFactories = [
        () => createVmRuntimeRequest('/plugins/folderview.plus/server/read.php?type=vm', {
            source: 'folders',
            label: 'VM folder definitions'
        }),
        () => createVmRuntimeRequest('/plugins/folderview.plus/server/read_order.php?type=vm', {
            source: 'folder-order',
            label: 'VM folder order'
        }),
        () => createVmRuntimeRequest('/plugins/folderview.plus/server/read_info.php?type=vm', {
            source: 'runtime-info',
            label: 'VM runtime info'
        }),
        () => createVmRuntimeRequest('/plugins/folderview.plus/server/read_unraid_order.php?type=vm', {
            source: 'host-order',
            label: 'VM host order'
        }),
        () => createVmRuntimeRequest(`/plugins/folderview.plus/server/prefs.php?type=vm&_=${cacheBust}`, {
            source: 'prefs',
            label: 'VM preferences',
            allowFallback: true,
            fallbackValue: JSON.stringify({ ok: false, prefs: {} })
        })
    ];
    if (!runtimeSnapshotApi || typeof runtimeSnapshotApi.createProjectedBundle !== 'function') {
        return legacyFactories.map((factory) => factory());
    }
    const snapshotRequest = createVmRuntimeRequest(runtimeSnapshotApi.buildUrl('vm', 'full', {
        cacheBust
    }), {
        source: 'runtime-snapshot-full',
        label: 'VM runtime snapshot'
    });
    return runtimeSnapshotApi.createProjectedBundle(
        snapshotRequest,
        ['folders', 'order', 'runtime', 'unraidOrder', 'prefsResponse'],
        {
            onSnapshot: (snapshot) => {
                rememberVmRuntimeSnapshot(snapshot);
            },
            fallbackFactories: legacyFactories
        }
    );
}

// Prime requests for environments where loadlist isn't called first.
folderReq = buildVmFolderReq();
markVmFatalBannerStep('VM request bundle primed');

// Route the Unraid host lifecycle through the same adapter contract as Docker.
vmHostAdapter.wrapHook('loadlist', ({ args, invokeOriginal }) => {
    loadedFolder = false;
    folderReq = buildVmFolderReq();
    if (typeof window.loadlist_original === 'function') {
        return invokeOriginal(...args);
    } else {
        reportVmDegradedRuntimeState('VM host loadlist hook was unavailable when the runtime tried to refresh.', {
            phase: 'loadlist',
            category: 'host-hook-missing',
            detailLabel: 'Missing host hooks',
            details: ['window.loadlist_original was not callable during a VM runtime refresh.']
        });
    }
    return undefined;
}, {
    legacyAlias: 'loadlist_original',
    onCapture: () => markVmFatalBannerStep('VM loadlist hook captured'),
    onMissing: () => reportVmDegradedRuntimeState('VM host loadlist hook was unavailable during bootstrap.', {
        phase: 'hook-install',
        category: 'host-hook-missing',
        detailLabel: 'Missing host hooks',
        details: ['window.loadlist was not a function when FolderView Plus initialized.']
    }),
    onWrapped: () => markVmFatalBannerStep('VM loadlist hook wrapped'),
    onInvoke: () => recordVmFatalBannerAction('VM host loadlist invoked')
});
vmLifecycleApi.bind();
markVmFatalBannerStep('VM lifecycle dispatch and context hooks ready');

const PINNED_FOLDER_CHANGE_STORAGE_KEY = 'fv.folderviewplus.pinnedFolders.changed.v1';
const PINNED_FOLDER_CHANGE_EVENT = 'fvplus:pinned-folders-changed';
const applyVmSettingsPinSyncPayload = (payload) => {
    if (!payload || payload.type !== 'vm') {
        return;
    }
    clearVmPinnedFolderIdsOverride();
    queueLoadlistRefresh();
};
const bindVmSettingsPinSyncListener = () => {
    window.addEventListener('storage', (event) => {
        if (event.key !== PINNED_FOLDER_CHANGE_STORAGE_KEY || !event.newValue) {
            return;
        }
        let payload = null;
        try {
            payload = JSON.parse(event.newValue);
        } catch (_error) {
            return;
        }
        applyVmSettingsPinSyncPayload(payload);
    });
    window.addEventListener(PINNED_FOLDER_CHANGE_EVENT, (event) => {
        applyVmSettingsPinSyncPayload(event.detail || null);
    });
};
bindVmSettingsPinSyncListener();

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
bindVmFolderRowActions();


$.ajaxPrefilter((options, originalOptions, jqXHR) => {
    // This is needed because unraid don't like the folder and the number are set incorrectly, this intercept the request and change the numbers to make the order appear right, this is important for the autostart and to draw the folders
    if (options.url === "/plugins/dynamix.vm.manager/include/UserPrefs.php") {
        const data = new URLSearchParams(options.data);
        const containers = data.get('names').split(';');
        const folderFixRegex = /^(.*?)(?=folder-)/g;
        let num = "";
        for (let index = 0; index < containers.length - 1; index++) {
            containers[index] = containers[index].replace(folderFixRegex, '');
            num += index + ';';
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
});

window.addEventListener('pagehide', () => {
    clearLiveRefreshTimer();
    clearTimeout(queuedLoadlistTimer);
    clearTimeout(vmRuntimeWidthReflowTimer);
    clearTimeout(vmZebraRefreshTimer);
    vmFolderRowActionsController.destroy();
    vmNativeDetailRowObserver?.disconnect?.();
    if (vmNativeToggleClickHost instanceof HTMLTableElement) {
        vmNativeToggleClickHost.removeEventListener('click', handleVmNativeToggleClick, true);
    }
    vmDeferredPreviewController.destroy();
    runtimeHostAdapters?.release?.('vm', { window, restoreHooks: true });
}, { once: true });
