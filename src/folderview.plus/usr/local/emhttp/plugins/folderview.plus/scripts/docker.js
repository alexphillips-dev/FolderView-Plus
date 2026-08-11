// @ts-check
(function fvplusDockerRuntimeScope(window, $) {
'use strict';

const dockerHostCompatibilityModule = window.FolderViewPlusHostCompatibility || null;
const dockerHostCompatibilityController = window.FolderViewPlusDockerHostCompatibilityController
    || dockerHostCompatibilityModule?.getDefaultController?.({
        window,
        document: window.document
    })
    || null;
const dockerHostCompatibilityDecision = window.FolderViewPlusDockerHostCompatibilityDecision
    || dockerHostCompatibilityController?.evaluateDockerRuntime?.()
    || {
    hostGeneration: (
        window.document?.querySelector?.('table#docker_containers')
        && window.document?.querySelector?.('tbody#docker_list')
        && window.document?.querySelector?.('#docker_containers > thead > tr')
    ) ? 'legacy-docker-table' : 'unknown-docker-host',
    runtimeActivationAllowed: Boolean(
        window.document?.querySelector?.('table#docker_containers')
        && window.document?.querySelector?.('tbody#docker_list')
        && window.document?.querySelector?.('#docker_containers > thead > tr')
    )
    };
const dockerProviderRegistry = window.FolderViewPlusDockerProviders?.getDefaultRegistry?.({
    window,
    document: window.document,
    compatibilityModule: dockerHostCompatibilityModule,
    compatibilityController: dockerHostCompatibilityController,
    transport: window.FolderViewPlusRuntimeTransport || null
}) || null;
const dockerProviderHealthController = window.FolderViewPlusDockerProviderHealth?.createController?.({
    window,
    providerRegistry: dockerProviderRegistry
}) || null;
if (window.FolderViewPlusDockerBootstrapModuleLoaded !== true) {
    void dockerProviderRegistry?.prepare?.({
        hostGeneration: dockerHostCompatibilityDecision.hostGeneration
    });
}
if (dockerHostCompatibilityDecision.runtimeActivationAllowed !== true) {
    if (window.FolderViewPlusDockerBootstrapModuleLoaded !== true) {
        window.addEventListener?.('pagehide', () => {
            dockerProviderRegistry?.dispose?.();
        }, { once: true });
    }
    return;
}
const FOLDER_VIEW_DEBUG_MODE = false;
const dockerRuntimeShared = window.FolderViewDockerRuntimeShared || {};
const pluginRequestClient = window.FolderViewPlusRequest || null;
const runtimeSnapshotApi = window.FolderViewPlusRuntimeSnapshot || null;
const runtimeStateObserverModule = window.FolderViewPlusRuntimeStateObservers || null;
const themeResolver = window.FolderViewPlusThemeResolver || null;
const runtimeHostAdapters = window.FolderViewPlusRuntimeHostAdapters || null;
const runtimeFolderOrdering = window.FolderViewPlusRuntimeFolderOrdering || null;
const runtimeLiveRefreshModule = window.FolderViewPlusFoundationModules?.runtimeLiveRefresh || null;
const runtimePerformanceTelemetryModule = window.FolderViewPlusRuntimePerformanceTelemetry || null;
const dockerRuntimePerformanceTelemetry = runtimePerformanceTelemetryModule?.getOrCreate?.('docker', {
    window,
    document,
    debug: FOLDER_VIEW_DEBUG_MODE
}) || null;
const dockerRuntimeInfoModule = window.FolderViewPlusDockerRuntimeInfo || null;
const dockerPreviewActionsModule = window.FolderViewPlusDockerPreviewActions || null;
const dockerRuntimeHierarchyModule = window.FolderViewPlusDockerRuntimeHierarchy || null;
const folderPreviewModelModule = window.FolderViewPlusFolderPreviewModel || null;
const memberIdentityModule = window.FolderViewPlusMemberIdentity || null;
const dockerRuntimeActionsModule = window.FolderViewPlusDockerRuntimeActions || null;
const dockerHostGuardsModule = window.FolderViewPlusDockerHostGuards || null;
const dockerRuntimeDiagnosticsModule = window.FolderViewPlusDockerRuntimeDiagnostics || null;
const dockerRuntimeReconcileModule = window.FolderViewPlusDockerRuntimeReconcile || null;
const dockerCommandViewModule = window.FolderViewPlusDockerCommandView || null;
const dockerRuntimeColumnControllerModule = window.FolderViewPlusFoundationModules?.dockerColumnController || null;
const dockerT = (key, fallback = '', ...params) => (
    window.FolderViewPlusI18n?.t(key, fallback, ...params) || fallback || key
);
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
const normalizeFolderPreviewOverflow = typeof dockerRuntimeShared.normalizeFolderPreviewOverflow === 'function'
    ? dockerRuntimeShared.normalizeFolderPreviewOverflow
    : ((settings = {}) => ['expand_row', 'scroll'].includes(settings?.preview_overflow) ? settings.preview_overflow : 'default');
const isCompactMultiRowPreview = typeof dockerRuntimeShared.isCompactMultiRowPreview === 'function'
    ? dockerRuntimeShared.isCompactMultiRowPreview
    : ((settings = {}) => {
        const normalizedRows = normalizeFolderPreviewRowLimit(settings);
        return normalizedRows === 0 || normalizedRows > 1;
    });
const getPreviewHoverAnimationClass = typeof dockerRuntimeShared.getPreviewHoverAnimationClass === 'function'
    ? dockerRuntimeShared.getPreviewHoverAnimationClass
    : ((settings = {}) => {
        const normalized = String(settings?.preview_hover_animation || settings?.previewHoverAnimation || '').trim().toLowerCase();
        const aliases = { grow: 'pop', pulse: 'glow', spin: 'flip' };
        const token = aliases[normalized] || normalized;
        return ['lift', 'bounce', 'pop', 'glow', 'flip', 'wiggle'].includes(token) ? `fv-hover-animation-${token}` : '';
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
const reconcileDockerMemberIdentities = (folders, runtimeInfo) => {
    if (!memberIdentityModule || typeof memberIdentityModule.reconcileFolders !== 'function') {
        return folders;
    }
    const result = memberIdentityModule.reconcileFolders('docker', folders, runtimeInfo);
    const patches = result?.patches && typeof result.patches === 'object' ? result.patches : {};
    if (Object.keys(patches).length > 0 && typeof window.FolderViewPlusRequest?.postJson === 'function') {
        window.FolderViewPlusRequest.postJson('/plugins/folderview.plus/server/reconcile_member_identities.php', {
            type: 'docker',
            patches: JSON.stringify(patches)
        }, { retries: 0 }).catch((error) => {
            console.warn('folderview.plus: Docker member identity reconciliation could not be persisted.', error);
        });
    }
    window.FolderViewPlusMemberIdentityDiagnostics = {
        ...(window.FolderViewPlusMemberIdentityDiagnostics || {}),
        docker: result?.diagnostics || {}
    };
    return result?.folders || folders;
};
const dockerPrefsCoordinator = window.FolderViewPlusPrefsStore?.getDefaultCoordinator({
    normalizePrefs: utils.normalizePrefs,
    request: window.FolderViewPlusRequest
}) || null;
const normalizeDockerPrefsResponse = (response = {}) => {
    const normalized = utils.normalizePrefs({
        ...(response?.prefs || {}),
        _metadata: response?.metadata || response?.prefs?._metadata || {}
    });
    return dockerPrefsCoordinator
        ? dockerPrefsCoordinator.reconcile('docker', normalized)
        : normalized;
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
        createRequest: (url) => window.FolderViewPlusRequest.getText(url)
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
    window.FolderViewPlusRuntimeHostAdaptersModuleLoaded !== true
    || !runtimeHostAdapters
    || typeof runtimeHostAdapters.getOrCreate !== 'function'
) {
    dockerBootstrapMissingModules.push('runtime.host-adapter.js');
    setDockerFatalBannerModuleStatus('runtime.host-adapter.js', 'missing', 'shared host adapter unavailable');
} else {
    setDockerFatalBannerModuleStatus('runtime.host-adapter.js', 'ok', 'Docker host adapter ready');
}
if (!runtimeFolderOrdering || typeof runtimeFolderOrdering.createOrderCursor !== 'function') {
    dockerBootstrapMissingModules.push('runtime.folder-ordering.js');
    setDockerFatalBannerModuleStatus('runtime.folder-ordering.js', 'missing', 'folder ordering contract unavailable');
} else {
    setDockerFatalBannerModuleStatus('runtime.folder-ordering.js', 'ok', 'folder ordering contract ready');
}
if (!runtimeLiveRefreshModule || typeof runtimeLiveRefreshModule.createController !== 'function') {
    dockerBootstrapMissingModules.push('runtime.live-refresh.js');
    setDockerFatalBannerModuleStatus('runtime.live-refresh.js', 'missing', 'live refresh controller unavailable');
} else {
    setDockerFatalBannerModuleStatus('runtime.live-refresh.js', 'ok', 'live refresh controller ready');
}
if (!dockerRuntimeColumnControllerModule || typeof dockerRuntimeColumnControllerModule.createController !== 'function') {
    dockerBootstrapMissingModules.push('docker.runtime.column-controller.js');
    setDockerFatalBannerModuleStatus('docker.runtime.column-controller.js', 'missing', 'Docker column controller unavailable');
} else {
    setDockerFatalBannerModuleStatus('docker.runtime.column-controller.js', 'ok', 'Docker column controller ready');
}
if (typeof dockerRuntimeShared.createFolderRowActionsController !== 'function') {
    dockerBootstrapMissingModules.push('folder.runtime.row-actions.js');
    setDockerFatalBannerModuleStatus('folder.runtime.row-actions.js', 'missing', 'folder row action lifecycle unavailable');
} else {
    setDockerFatalBannerModuleStatus('folder.runtime.row-actions.js', 'ok', 'folder row actions ready');
}
if (
    !window.FolderViewDockerRuntimeShared
    || typeof window.FolderViewDockerRuntimeShared.createAsyncActionBoundary !== 'function'
    || typeof window.FolderViewDockerRuntimeShared.applyFolderDropdownStyle !== 'function'
    || typeof window.FolderViewDockerRuntimeShared.createStableToggleController !== 'function'
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
    window.FolderViewPlusFolderPreviewModelModuleLoaded !== true
    || !folderPreviewModelModule
    || typeof folderPreviewModelModule.createChildFolderPreviewModel !== 'function'
) {
    dockerBootstrapMissingModules.push('folder.preview-model.js');
    setDockerFatalBannerModuleStatus('folder.preview-model.js', 'missing', 'shared folder preview model unavailable');
} else {
    setDockerFatalBannerModuleStatus('folder.preview-model.js', 'ok', 'shared folder preview model ready');
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
if (
    window.FolderViewPlusDockerHostGuardsModuleLoaded !== true
    || !dockerHostGuardsModule
    || typeof dockerHostGuardsModule.createApi !== 'function'
) {
    dockerBootstrapMissingModules.push('docker.runtime.host-guards.js');
    setDockerFatalBannerModuleStatus('docker.runtime.host-guards.js', 'missing', 'Docker host guard helpers unavailable');
} else {
    setDockerFatalBannerModuleStatus('docker.runtime.host-guards.js', 'ok', 'Docker host guard helpers ready');
}
if (
    window.FolderViewPlusDockerRuntimeDiagnosticsModuleLoaded !== true
    || !dockerRuntimeDiagnosticsModule
    || typeof dockerRuntimeDiagnosticsModule.createApi !== 'function'
    || typeof dockerRuntimeDiagnosticsModule.buildOrderFingerprint !== 'function'
) {
    dockerBootstrapMissingModules.push('docker.runtime.diagnostics.js');
    setDockerFatalBannerModuleStatus('docker.runtime.diagnostics.js', 'missing', 'Docker diagnostics helpers unavailable');
} else {
    setDockerFatalBannerModuleStatus('docker.runtime.diagnostics.js', 'ok', 'Docker diagnostics helpers ready');
}
if (
    window.FolderViewPlusDockerRuntimeReconcileModuleLoaded !== true
    || !dockerRuntimeReconcileModule
    || typeof dockerRuntimeReconcileModule.createApi !== 'function'
) {
    dockerBootstrapMissingModules.push('docker.runtime.reconcile.js');
    setDockerFatalBannerModuleStatus('docker.runtime.reconcile.js', 'missing', 'Docker reconcile helpers unavailable');
} else {
    setDockerFatalBannerModuleStatus('docker.runtime.reconcile.js', 'ok', 'Docker reconcile helpers ready');
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
const DOCKER_HOST_PAGE_REQUIRED_SELECTORS = Object.freeze(
    dockerHostGuardsModule?.DEFAULT_REQUIRED_SELECTORS || [
        { label: 'Docker table shell', selector: 'table#docker_containers' },
        { label: 'Docker table body', selector: 'tbody#docker_list' },
        { label: 'Docker header row', selector: '#docker_containers > thead > tr' }
    ]
);
markDockerFatalBannerStep('Docker runtime modules resolved');
let dockerHostGuardsApi = null;
let dockerRuntimeDiagnosticsApi = null;
let dockerRuntimeReconcileApi = null;
const dockerHostAdapter = runtimeHostAdapters?.getOrCreate?.('docker', { window, document }) || null;
const getDockerHostGuardsApi = () => {
    if (!dockerHostGuardsApi && dockerHostGuardsModule && typeof dockerHostGuardsModule.createApi === 'function') {
        dockerHostGuardsApi = dockerHostGuardsModule.createApi({
            window,
            document,
            adapter: dockerHostAdapter,
            requiredSelectors: DOCKER_HOST_PAGE_REQUIRED_SELECTORS,
            setModuleStatus: (name, status, detail = '') => setDockerFatalBannerModuleStatus(name, status, detail),
            markStep: (step) => markDockerFatalBannerStep(step),
            reportFatalRuntimeError: (error, options = {}) => reportDockerFatalRuntimeError(error, options),
            reportDegradedRuntimeState: (error, options = {}) => reportDockerDegradedRuntimeState(error, options)
        });
    }
    return dockerHostGuardsApi;
};
const ensureDockerHostPageStructure = () => {
    const hostGuardsApi = getDockerHostGuardsApi();
    if (hostGuardsApi && typeof hostGuardsApi.ensureHostPageStructure === 'function') {
        hostGuardsApi.ensureHostPageStructure();
        return;
    }
    setDockerFatalBannerModuleStatus('host-page-structure', 'missing', 'Docker host guard helpers unavailable');
    throw new Error('Docker host guard helpers unavailable');
};
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
        if (typeof onerror === 'function') {
                    onError(_name, error, context);
                }
                return { ok: false, error };
            }
        }
    });
const createDockerContextMenuQuickStripAdapter = typeof dockerRuntimeShared.createContextMenuQuickStripAdapter === 'function'
    ? dockerRuntimeShared.createContextMenuQuickStripAdapter
    : () => ({ queueEnhance: () => {} });
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
const createDockerDeferredPreviewController = typeof dockerRuntimeShared.createDeferredPreviewController === 'function'
    ? dockerRuntimeShared.createDeferredPreviewController
    : () => ({ start: () => {}, defer: () => false, refresh: () => {}, flush: () => {}, destroy: () => {}, snapshot: () => ({ active: false, pending: 0 }) });
const dockerDeferredPreviewController = createDockerDeferredPreviewController();
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
const DOCKER_RUNTIME_WIDTH_BOOTSTRAP_SETTLE_MS = 280;
const DOCKER_RUNTIME_WIDTH_BOOTSTRAP_FONT_TIMEOUT_MS = 600;
const DOCKER_RUNTIME_WIDTH_MIN_APPLY_DELTA_PX = 3;
const DOCKER_RUNTIME_WIDTH_DEBUG_STORAGE_KEY = 'fvplus.runtime.docker.widthDebug.v1';
const DOCKER_RUNTIME_APP_WIDTH_CACHE_KEY = 'fvplus.runtime.docker.appWidth.v2';
const DOCKER_RUNTIME_APP_WIDTH_CACHE_SCHEMA_VERSION = 2;
const DOCKER_RUNTIME_APP_WIDTH_ALGORITHM_VERSION = 'content-aware-v2';
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
        mobileMin: DOCKER_RUNTIME_APP_WIDTH_MOBILE_MIN,
        cacheKey: DOCKER_RUNTIME_APP_WIDTH_CACHE_KEY,
        cacheSchemaVersion: DOCKER_RUNTIME_APP_WIDTH_CACHE_SCHEMA_VERSION,
        algorithmVersion: DOCKER_RUNTIME_APP_WIDTH_ALGORITHM_VERSION
    })
    : null;
let lastAppliedRuntimePrefs = null;
const dockerRuntimeColumnControllerState = {
    resizerBindTimer: null,
    resizerRetryTimer: null,
    resizerRetryCount: 0,
    resizerObserver: null,
    autoAppWidthFloor: null,
    autoAppWidthFloorMode: null,
    widthContentSignature: ''
};
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
    bootstrapLocked: false,
    stabilizationPending: false,
    stabilizationGeneration: 0,
    pendingRenderGeneration: 0,
    stabilizationTimer: null,
    deferredReason: '',
    resizerBindPending: false,
    debugPanel: null,
    lastDecision: null
};
const dockerRuntimeLayoutStabilityTracker = dockerRuntimeDiagnosticsModule?.createLayoutStabilityTracker?.({
    window,
    document,
    cacheSchemaVersion: DOCKER_RUNTIME_APP_WIDTH_CACHE_SCHEMA_VERSION,
    algorithmVersion: DOCKER_RUNTIME_APP_WIDTH_ALGORITHM_VERSION
}) || null;
const markDockerRuntimeLayoutPhase = (phase, details = {}) => dockerRuntimeLayoutStabilityTracker?.markPhase?.(phase, details);
const recordDockerRuntimeWidthTelemetry = (stage, details = {}) => dockerRuntimeLayoutStabilityTracker?.recordWidth?.(stage, details);
const dockerRuntimeColumnControllerApi = dockerRuntimeColumnControllerModule.createController({
    window,
    document,
    $,
    utils,
    localStorage: window.localStorage,
    storageWriter: dockerStorageWriter,
    columnLayoutEngine: dockerRuntimeColumnLayoutEngine,
    widthState: dockerRuntimeWidthState,
    controllerState: dockerRuntimeColumnControllerState,
    hostAdapter: dockerHostAdapter,
    stateObserverModule: runtimeStateObserverModule,
    getLastAppliedRuntimePrefs: () => lastAppliedRuntimePrefs,
    recordWidthTelemetry: recordDockerRuntimeWidthTelemetry,
    applyThemeResolverTokens: applyDockerThemeResolverTokens,
    decorateLanEndpointValues: () => decorateDockerRuntimeLanEndpointValues(),
    constants: {
        DOCKER_RUNTIME_APP_WIDTH_MIN,
        DOCKER_RUNTIME_APP_WIDTH_MAX,
        DOCKER_RUNTIME_APP_CHROME_WIDTH,
        DOCKER_RUNTIME_APP_TEXT_BUFFER,
        DOCKER_RUNTIME_APP_OVERFLOW_CLIENT_WIDTH_MIN,
        DOCKER_RUNTIME_APP_OVERFLOW_NUDGE_MAX,
        DOCKER_RUNTIME_APP_WIDTH_FLOOR_HEADROOM,
        DOCKER_RUNTIME_APP_WIDTH_MOBILE_SCALE,
        DOCKER_RUNTIME_APP_WIDTH_MOBILE_MIN,
        DOCKER_RUNTIME_VERSION_GAP_MIN,
        DOCKER_RUNTIME_VERSION_GAP_MAX,
        DOCKER_RUNTIME_VERSION_GAP_ADJUST_MAX_STEP,
        DOCKER_RUNTIME_WIDTH_PHASES,
        DOCKER_RUNTIME_WIDTH_REFLOW_DEBOUNCE_MS,
        DOCKER_RUNTIME_WIDTH_BOOTSTRAP_SETTLE_MS,
        DOCKER_RUNTIME_WIDTH_BOOTSTRAP_FONT_TIMEOUT_MS,
        DOCKER_RUNTIME_WIDTH_MIN_APPLY_DELTA_PX,
        DOCKER_RUNTIME_WIDTH_DEBUG_STORAGE_KEY,
        DOCKER_RUNTIME_COLUMN_WIDTH_MIN,
        DOCKER_RUNTIME_COLUMN_WIDTH_MAX,
        DOCKER_RUNTIME_APP_PRESET_WIDTHS
    }
});
const {
    applyDockerRuntimeAppWidthVariables,
    beginDockerRuntimeWidthBootstrap,
    bindDockerRuntimeAppColumnResizer,
    completeDockerRuntimeWidthBootstrap,
    primeDockerRuntimeAppWidthBeforeRender,
    queueDockerRuntimeResizerBind,
    runDockerRuntimeWidthReflow,
    scheduleDockerRuntimeWidthReflow,
    setDockerRuntimeWidthDebugEnabled
} = dockerRuntimeColumnControllerApi;
const summarizeDockerPreviewActionSlots = () =>
    dockerRuntimeLayoutStabilityTracker?.summarizeActionSlots?.()
    || { targetCount: 0, pendingWebuiSlotCount: 0, readyWebuiSlotCount: 0 };
const captureDockerPreviewActionGeometry = () => dockerRuntimeLayoutStabilityTracker?.captureActionGeometry?.() || new Map();
const compareDockerPreviewActionGeometry = (geometry) =>
    dockerRuntimeLayoutStabilityTracker?.compareActionGeometry?.(geometry);
const getDockerRuntimeLayoutStabilitySnapshot = () =>
    dockerRuntimeLayoutStabilityTracker?.getSnapshot?.() || { schemaVersion: 1, available: false };
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
            syncDockerVisibleFoldersFromRuntimeCache: (changedNames = null) => syncDockerVisibleFoldersFromRuntimeCache(changedNames),
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
            utils,
            escapeHtml: (value) => escapeHtml(value),
            getSafeWebuiUrl: (value) => getSafeWebuiUrl(value),
            openWebuiInNewTab: (url) => openWebuiInNewTab(url),
            openTerminal: (type, containerName, shellValue) => openTerminal(type, containerName, shellValue),
            getDirectMemberRowsForFolder: (id) => getDirectMemberRowsForFolder(id),
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
            previewModelModule: folderPreviewModelModule,
            buildDockerPreviewItem: (options) => buildDockerPreviewItem(options),
            appendDockerPreviewActionButtons: ($target, settings, containerName, shellValue, webuiUrl, options = {}) =>
                appendDockerPreviewActionButtons($target, settings, containerName, shellValue, webuiUrl, options),
            decorateDockerPreviewMemberTriggers: ($targets, folderId, containerName) =>
                decorateDockerPreviewMemberTriggers($targets, folderId, containerName),
            getSafeWebuiUrl: (value) => getSafeWebuiUrl(value),
            isCompactMultiRowPreview: (settings) => isCompactMultiRowPreview(settings),
            editFolder: (id) => editFolder(id),
            openFolderActions: (id) => {
                const trigger = document.getElementById(String(id || '').trim());
                if (trigger && typeof trigger.dispatchEvent === 'function') {
                    const rect = typeof trigger.getBoundingClientRect === 'function'
                        ? trigger.getBoundingClientRect()
                        : null;
                    const clientX = rect ? rect.left + Math.max(1, rect.width / 2) : 0;
                    const clientY = rect ? rect.top + Math.max(1, rect.height / 2) : 0;
                    trigger.dispatchEvent(new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        clientX,
                        clientY
                    }));
                    return;
                }
                addDockerFolderContext(id);
            },
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
            openDocker: (...args) => {
                if (typeof window?.openDocker === 'function') {
                    return window.openDocker(...args);
                }
                return typeof openDocker === 'function' ? openDocker(...args) : undefined;
            },
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
const buildDockerIsolatedViewDeps = () => ({
    window,
    document,
    $,
    utils,
    escapeHtml: (value) => escapeHtml(value),
    parseJsonPayloadSafe: (payload) => parseJsonPayloadSafe(payload),
    normalizeDockerRuntimeInfoMap: (source, previousMap = null) => normalizeDockerRuntimeInfoMap(source, previousMap),
    getPrefsOrderedFolderMap: (folders, prefs) => getPrefsOrderedFolderMap(folders, prefs),
    reorderFolderSlotsInBaseOrder: (baseOrder, folders, prefs) => reorderFolderSlotsInBaseOrder(baseOrder, folders, prefs),
    buildFolderDepthById: (folders) => buildFolderDepthById(folders),
    buildFolderHierarchy: (folders) => buildFolderHierarchy(folders),
    buildFolderMatchCache: (orderSnapshot, containersInfo, folders, prefs) =>
        buildDockerFolderMatchCache(orderSnapshot, containersInfo, folders, prefs),
    readDockerHostOrderFromDom: () => readDockerHostOrderFromDom(),
    resolveRequestBundle: (options = {}) => {
        if (
            options?.forceRefresh !== true
            && folderReq
            && folderReq.consumed !== true
            && Array.isArray(folderReq.render)
            && folderReq.render.length > 0
        ) {
            folderReq.consumed = true;
            return folderReq;
        }
        folderReq = buildDockerFolderReq({
            liveUpdateStatus: isDockerHostUpdateSyncSuspended()
        });
        folderReq.consumed = true;
        return folderReq;
    },
    setRuntimeState: (snapshot = {}) => {
        const folders = snapshot?.folders && typeof snapshot.folders === 'object' ? snapshot.folders : {};
        globalFolders = folders;
        dockerFolderHierarchy = snapshot?.hierarchy && typeof snapshot.hierarchy === 'object'
            ? snapshot.hierarchy
            : buildFolderHierarchy(folders);
        dockerRuntimeInfoByName = snapshot?.runtimeInfoByName && typeof snapshot.runtimeInfoByName === 'object'
            ? snapshot.runtimeInfoByName
            : {};
        folderTypePrefs = applyDockerPinnedFolderPrefsOverride(
            dockerPrefsCoordinator
                ? dockerPrefsCoordinator.reconcile('docker', snapshot?.prefs || {})
                : (snapshot?.prefs || {})
        );
        lastAppliedRuntimePrefs = folderTypePrefs;
        dockerRuntimeLastRenderGeneration = Number(snapshot?.generation || dockerRuntimeLastRenderGeneration || 0);
        lastLiveRefreshStateSignature = String(snapshot?.stateSignature || lastLiveRefreshStateSignature || '');
        lastLiveRefreshStateEntityCount = Object.keys(dockerRuntimeInfoByName || {}).length;
        resolveDockerStrictPerformanceProfile(folderTypePrefs, globalFolders, dockerRuntimeInfoByName);
        dockerRuntimeStateStore.set({
            pinnedFolderIds: Array.isArray(folderTypePrefs?.pinnedFolderIds) ? [...folderTypePrefs.pinnedFolderIds] : []
        });
        applyRuntimePrefs(folderTypePrefs);
        queueDockerRuntimePrivacyServerReconcile(folderTypePrefs);
    },
    getScopedRuntimeContainersForFolder: (folderId, includeDescendants = true) =>
        getScopedRuntimeContainersForFolder(folderId, includeDescendants),
    summarizeFolderActionCounts: (containersMap) => summarizeFolderActionCounts(containersMap),
    buildStateSignature: (source, fromStateMode = false) => buildDockerStateSignature(source, fromStateMode),
    readPinnedFolderIds: (prefs = {}) => Array.isArray(prefs?.pinnedFolderIds) ? prefs.pinnedFolderIds : [],
    isFolderLocked: (folderId) => isDockerFolderLocked(folderId),
    createFolderBtn: () => createFolderBtn(),
    editFolder: (id) => editFolder(id),
    actionFolder: (id, action, options = {}) => actionFolder(id, action, options),
    updateFolder: (id, options = {}) => updateFolder(id, options),
    forceUpdateFolder: (id, options = {}) => forceUpdateFolder(id, options),
    getSafeWebuiUrl: (value) => getSafeWebuiUrl(value),
    openFolderWebuisFromMenu: (id, runningOnly = true, includeDescendants = false) =>
        openFolderWebuisFromMenu(id, runningOnly, includeDescendants),
    openWebuiInNewTab: (url) => openWebuiInNewTab(url),
    openWebuiPopupWindow: (url, targetName = '_blank') => openWebuiPopupWindow(url, targetName),
    openTerminal: (type, containerName, shellValue) => openTerminal(type, containerName, shellValue),
    appendDockerPreviewActionButtons: ($target, settings = {}, containerName = '', shellValue = '/bin/sh', webuiUrl = '', options = {}) =>
        appendDockerPreviewActionButtons($target, settings, containerName, shellValue, webuiUrl, options),
    toggleFolderPin: (folderId) => toggleDockerFolderPin(folderId),
    toggleFolderLock: (folderId) => toggleDockerFolderLock(folderId),
    queueLoadlistRefresh: (options = {}) => queueLoadlistRefresh(options),
    debugEnabled: FOLDER_VIEW_DEBUG_MODE
});
const getDockerCommandViewApi = () => {
    if (
        !dockerCommandViewApi
        && dockerCommandViewModule
        && window.FolderViewPlusDockerCommandViewModuleLoaded === true
        && typeof dockerCommandViewModule.createApi === 'function'
    ) {
        dockerCommandViewApi = dockerCommandViewModule.createApi(buildDockerIsolatedViewDeps());
    }
    return dockerCommandViewApi;
};
const buildDockerDiagnosticsCorrelationContext = () => ({
    currentPage: String(location?.pathname || ''),
    listViewMode: readDockerListViewMode(),
    pageViewMode: resolveDockerPageViewMode(),
    renderGeneration: dockerRuntimeLastRenderGeneration,
    requestGeneration: Number(folderReq?.generation || 0),
    traceSessionId: dockerDiagnosticsTraceSessionId,
    stateSignature: String(lastLiveRefreshStateSignature || ''),
    stateEntityCount: lastLiveRefreshStateEntityCount,
    orderReconciliation: lastDockerOrderReconciliation,
    liveUpdateStatus: isDockerHostUpdateSyncSuspended(),
    hostSyncSuspended: isDockerHostUpdateSyncSuspended(),
    hookStates: getDockerHostGuardsApi()?.getHookStates?.() || {},
    hostAdapter: dockerHostAdapter?.getSnapshot?.() || null
});
const getDockerRuntimeDiagnosticsApi = () => {
    if (
        !dockerRuntimeDiagnosticsApi
        && dockerRuntimeDiagnosticsModule
        && typeof dockerRuntimeDiagnosticsModule.createApi === 'function'
    ) {
        dockerRuntimeDiagnosticsApi = dockerRuntimeDiagnosticsModule.createApi({
            window,
            document,
            localStorage,
            $,
            readDockerListViewMode: () => readDockerListViewMode(),
            resolveExpectedFolderActionToken: (folderId) => resolveDockerSupportBundleExpectedFolderActionToken(folderId),
            resolveExpectedMemberActionToken: (entry = {}) => resolveDockerSupportBundleExpectedMemberActionToken(entry),
            getRuntimeInfoEntry: (containerName) => dockerRuntimeInfoByName?.[containerName] || {},
            getCorrelationContext: () => buildDockerDiagnosticsCorrelationContext(),
            getLayoutStabilityDiagnostics: () => getDockerRuntimeLayoutStabilitySnapshot()
        });
    }
    return dockerRuntimeDiagnosticsApi;
};
const getDockerRuntimeReconcileApi = () => {
    if (
        !dockerRuntimeReconcileApi
        && dockerRuntimeReconcileModule
        && typeof dockerRuntimeReconcileModule.createApi === 'function'
    ) {
        dockerRuntimeReconcileApi = dockerRuntimeReconcileModule.createApi({
            window,
            document,
            folderEvents,
            readDockerListViewMode: () => readDockerListViewMode(),
            isDockerHostUpdateCommand: (command) => isDockerHostUpdateCommand(command),
            suspendDockerHostUpdateSync: (durationMs = 0) => suspendDockerHostUpdateSync(durationMs),
            isDockerHostUpdateSyncSuspended: () => isDockerHostUpdateSyncSuspended(),
            refreshDockerRuntimeStateInPlace: (options = {}) => refreshDockerRuntimeStateInPlace(options),
            waitForDockerRenderFrame: () => waitForDockerRenderFrame(),
            appendDockerBulkUpdateTrace: (eventType, details = {}) => appendDockerBulkUpdateTrace(eventType, details),
            queueDockerSupportBundlePageSnapshot: (reason = 'runtime-sync', delayMs = 180) =>
                queueDockerSupportBundlePageSnapshot(reason, delayMs),
            getDockerHostGuardsApi: () => getDockerHostGuardsApi(),
            getDockerRuntimeContainerInfo: (containerName) => getDockerRuntimeContainerInfo(containerName),
            initialDelayMs: DOCKER_POST_UPDATE_RECONCILE_INITIAL_DELAY_MS,
            pollDelayMs: DOCKER_POST_UPDATE_RECONCILE_POLL_INTERVAL_MS
        });
    }
    return dockerRuntimeReconcileApi;
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
const normalizeFolderId = utils.normalizeFolderId;
const WEBUI_LINK_REL = 'noopener noreferrer';
const WEBUI_OPEN_REL = 'noopener';
const WEBUI_TEMPLATE_TOKEN_REGEX = /\[(?:IP|PORT:[^\]]+|HOSTNAME|MAGICDNS|NOSERVE)\]/i;
const DOCKER_HOST_UPDATE_COMMAND_REGEX = /^\s*update_container(?:\s|$)/i;
const DOCKER_HOST_UPDATE_SYNC_SUSPENDED_UNTIL_KEY = '__fvplusDockerHostUpdateSyncSuspendedUntil';
const DOCKER_SUPPORT_BUNDLE_PAGE_STORAGE_KEY = dockerRuntimeDiagnosticsModule?.DOCKER_SUPPORT_BUNDLE_PAGE_STORAGE_KEY || 'fv.support.bundle.docker.page.v1';
const getDockerRuntimePrivacyOptions = (prefs = null) => {
    const normalized = utils.normalizePrefs(prefs || folderTypePrefs || {});
    const dashboard = normalized?.dashboard && typeof normalized.dashboard === 'object' ? normalized.dashboard : {};
    const enabled = resolveDockerRuntimePrivacyMode(normalized);
    return {
        enabled,
        maskNames: enabled && dashboard.privacyMaskNames !== false,
        maskContainerIps: enabled && dashboard.privacyMaskContainerIps !== false,
        maskLocalIps: enabled && dashboard.privacyMaskLocalIps !== false,
        maskPorts: enabled && dashboard.privacyMaskPorts !== false
    };
};
const buildDockerPortEndpoint = (ip, port, protocol = '', { maskIp = false, maskPort = false } = {}) => {
    const rawIp = String(ip ?? '').trim();
    const rawPort = String(port ?? '').trim();
    const safeIp = rawIp && !maskIp ? escapeHtml(rawIp) : '';
    const safePort = rawPort ? (maskPort ? 'port' : escapeHtml(rawPort)) : '';
    let endpoint = '';
    if (safeIp && safePort) {
        endpoint = `${safeIp}:${safePort}`;
    } else if (safePort) {
        endpoint = safePort;
    } else if (safeIp) {
        endpoint = safeIp;
    } else if ((rawIp && maskIp) || (rawPort && maskPort)) {
        endpoint = 'hidden';
    }
    const safeProtocol = String(protocol || '').trim().toUpperCase();
    return endpoint && safeProtocol ? `${endpoint}/${escapeHtml(safeProtocol)}` : endpoint;
};
const buildDockerPortMappingLine = (entry = {}, privacyOptions = getDockerRuntimePrivacyOptions()) => {
    const protocol = String(entry?.Type || '').trim().toUpperCase();
    const privateEndpoint = buildDockerPortEndpoint(entry?.PrivateIP, entry?.PrivatePort, protocol, {
        maskIp: privacyOptions.maskContainerIps === true,
        maskPort: privacyOptions.maskPorts === true
    });
    const publicEndpoint = buildDockerPortEndpoint(entry?.PublicIP, entry?.PublicPort, '', {
        maskIp: privacyOptions.maskLocalIps === true,
        maskPort: privacyOptions.maskPorts === true
    });
    const left = privateEndpoint || 'hidden';
    const right = publicEndpoint || 'unmapped';
    return `${left} <i class="fa fa-arrows-h"></i> ${right}`;
};
const buildDockerPortMappingsHtml = (ports = []) => {
    const entries = Array.isArray(ports) ? ports : [];
    const privacyOptions = getDockerRuntimePrivacyOptions();
    const lines = entries.map((entry) => buildDockerPortMappingLine(entry, privacyOptions));
    if (entries.length > 10) {
        const allLines = lines.join('<br>');
        const previewLines = lines.slice(0, 10).join('<br>');
        return `<span class="info-ports-more" data-fvplus-style="fv-u-569beu">${allLines}<br><a href="#" class="fv-runtime-toggle-info-list" data-show=".info-ports-less">${$.i18n('compress')}</a></span><span class="info-ports-less">${previewLines}<br><a href="#" class="fv-runtime-toggle-info-list" data-show=".info-ports-more">${$.i18n('expand')}</a></span>`;
    }
    return `<span class="info-ports-mono">${lines.join('<br>')}</span>`;
};
const splitDockerLanEndpoint = (value) => {
    const raw = String(value || '').trim();
    if (!raw) {
        return { ip: '', port: '' };
    }
    if (raw.startsWith('[')) {
        const bracketEnd = raw.indexOf(']');
        if (bracketEnd > 0) {
            return {
                ip: raw.slice(0, bracketEnd + 1),
                port: raw.slice(bracketEnd + 1).replace(/^:/, '')
            };
        }
    }
    const separatorIndex = raw.lastIndexOf(':');
    if (separatorIndex > 0 && /^\d+(?:\/\w+)?$/.test(raw.slice(separatorIndex + 1))) {
        return {
            ip: raw.slice(0, separatorIndex),
            port: raw.slice(separatorIndex + 1)
        };
    }
    return { ip: raw, port: '' };
};
const decorateDockerRuntimeLanEndpointValues = () => {
    document.querySelectorAll('#docker_list tr.folder-element > td:nth-child(6) .docker_readmore, #docker_view tr.folder-element > td:nth-child(6) .docker_readmore').forEach((node) => {
        const rawLines = String(node.innerHTML || '').split(/<br\s*\/?\s*>/i).map((line) => {
            const decoder = document.createElement('span');
            decoder.innerHTML = line;
            return String(decoder.textContent || '').trim();
        });
        const signature = rawLines.join('\n');
        if (
            node.dataset.fvplusPrivacyLanSignature === signature
            && node.querySelector('.fvplus-privacy-lan-ip-value, .fvplus-privacy-lan-port-value')
        ) {
            return;
        }
        node.dataset.fvplusPrivacyLanSignature = signature;
        node.innerHTML = rawLines.map((line) => {
            const endpoint = splitDockerLanEndpoint(line);
            const ip = `<span class="fvplus-privacy-lan-ip-value">${escapeHtml(endpoint.ip)}</span>`;
            const port = endpoint.port
                ? `:<span class="fvplus-privacy-lan-port-value">${escapeHtml(endpoint.port)}</span>`
                : '';
            return `${ip}${port}`;
        }).join('<br>');
    });
};
const buildDockerBindMountMappingLine = (entry = {}) => {
    const destination = escapeHtml(String(entry?.Destination || '').trim() || 'unknown');
    const source = escapeHtml(String(entry?.Source || '').trim() || 'unknown');
    return `${destination} <i class="fa fa-arrows-h"></i> ${source}`;
};
const buildDockerBindMountMappingsHtml = (mounts = []) => {
    const entries = Array.isArray(mounts) ? mounts.filter((entry) => entry?.Type === 'bind') : [];
    const lines = entries.map((entry) => buildDockerBindMountMappingLine(entry));
    if (entries.length > 10) {
        const allLines = lines.join('<br>');
        const previewLines = lines.slice(0, 10).join('<br>');
        return `<span class="info-volumes-more" data-fvplus-style="fv-u-569beu">${allLines}<br><a href="#" class="fv-runtime-toggle-info-list" data-show=".info-volumes-less">${$.i18n('compress')}</a></span><span class="info-volumes-less">${previewLines}<br><a href="#" class="fv-runtime-toggle-info-list" data-show=".info-volumes-more">${$.i18n('expand')}</a></span>`;
    }
    return `<span class="info-volumes-mono">${lines.join('<br>')}</span>`;
};
const findDockerRuntimeInfoByShortId = (shortId) => {
    const target = String(shortId || '').trim();
    if (!target) {
        return null;
    }
    return Object.values(dockerRuntimeInfoByName || {}).find((entry) => {
        const entryShortId = String(entry?.shortId || '').trim();
        const entryId = String(entry?.info?.Id || entry?.id || '').trim();
        return entryShortId === target || (entryId && entryId.startsWith(target));
    }) || null;
};
const refreshDockerRuntimePrivacyPortMappings = () => {
    decorateDockerRuntimeLanEndpointValues();
    document.querySelectorAll('.info-ports[id^="info-ports-"]').forEach((node) => {
        const shortId = String(node.id || '').replace(/^info-ports-/, '').trim();
        const runtimeEntry = findDockerRuntimeInfoByShortId(shortId);
        const ports = runtimeEntry?.info?.Ports;
        if (!Array.isArray(ports)) {
            return;
        }
        node.innerHTML = buildDockerPortMappingsHtml(ports);
    });
};
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
const isDockerHostUpdateCommand = (command) => DOCKER_HOST_UPDATE_COMMAND_REGEX.test(String(command || '').trim());
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
const updateDockerTraceHealth = (traceName, success, details = {}) => {
    const diagnosticsApi = getDockerRuntimeDiagnosticsApi();
    return diagnosticsApi && typeof diagnosticsApi.updateTraceHealth === 'function'
        ? diagnosticsApi.updateTraceHealth(traceName, success, details)
        : false;
};
const appendDockerBulkUpdateTrace = (eventType, details = {}) => {
    const diagnosticsApi = getDockerRuntimeDiagnosticsApi();
    return diagnosticsApi && typeof diagnosticsApi.appendBulkUpdateTrace === 'function'
        ? diagnosticsApi.appendBulkUpdateTrace(eventType, details)
        : false;
};
const appendDockerRequestBundleTrace = (eventType, details = {}) => {
    const diagnosticsApi = getDockerRuntimeDiagnosticsApi();
    return diagnosticsApi && typeof diagnosticsApi.appendRequestBundleTrace === 'function'
        ? diagnosticsApi.appendRequestBundleTrace(eventType, details)
        : false;
};
const dockerRuntimeSecurityApi = dockerRuntimeShared.createSecureNavigationApi({
    window,
    document,
    hasUnresolvedWebuiTemplateTokens,
    openRel: WEBUI_OPEN_REL
});
const {
    getSafeExternalUrl,
    getSafeWebuiUrl,
    openWebuiInNewTab,
    openWebuiPopupWindow
} = dockerRuntimeSecurityApi;
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
const normalizePreviewStatusMode = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (['none', 'hide', 'hidden', 'off', 'false', '0', 'no'].includes(normalized)) {
        return 'none';
    }
    return ['none', 'symbol', 'grayscale'].includes(normalized) ? normalized : 'symbol';
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
const buildDockerPreviewItem = ({ entry = {}, settings = {}, autostart = false }) => {
    const previewMode = Number(settings?.preview || 0);
    const compactMultiRow = isCompactMultiRowPreview(settings);
    const safeName = escapeHtml(entry?.name || '');
    const safeIcon = sanitizeImageSrc(entry?.icon || '/plugins/dynamix.docker.manager/images/question.png');
    const previewStateMeta = getPreviewContainerStatusMeta(entry);
    const stateLabel = escapeHtml($.i18n(previewStateMeta.key));
    const previewStatusTitle = stateLabel;
    const previewStatusMode = normalizePreviewStatusMode(settings?.preview_status);
    const shouldHidePreviewStatus = previewStatusMode === 'none';
    const shouldShowOnlyIconStatus = previewMode === 2 && previewStatusMode === 'symbol';
    const shouldGrayscaleByStatus = previewMode === 2 && previewStatusMode === 'grayscale' && entry?.state !== true;
    const imageStyle = settings?.preview_grayscale || shouldGrayscaleByStatus ? ' data-fvplus-style="fv-u-1opeemm"' : '';
    const onlyIconStatusMarkup = shouldShowOnlyIconStatus
        ? `<span class="fv-preview-status-compact fv-preview-icon-status ${previewStateMeta.className}" title="${previewStatusTitle}" aria-hidden="true"><i class="fa ${previewStateMeta.icon}"></i><span class="state"> ${stateLabel}</span></span>`
        : '';
    const compactStatusMarkup = shouldHidePreviewStatus
        ? ''
        : `<span class="fv-preview-status-compact" title="${previewStatusTitle}">
                                <i class="fa ${previewStateMeta.icon} ${previewStateMeta.className}" aria-hidden="true"></i><span class="state"> ${stateLabel}</span>
                            </span>`;
    const inlineStatusMarkup = shouldHidePreviewStatus
        ? ''
        : `<br>
                        <i class="fa ${previewStateMeta.icon} ${previewStateMeta.className}" title="${previewStatusTitle}" aria-hidden="true"></i><span class="state ${previewStateMeta.className}"> ${stateLabel}</span>`;
    const updateClass = settings?.preview_update && entry?.update === true ? ' orange-text fv-preview-update-ready' : '';
    const textWidth = String(settings?.preview_text_width || '').trim();
    const textWidthData = textWidth ? ` data-fv-preview-text-width="${escapeHtml(textWidth)}"` : '';
    const autostartClass = autostart ? ' autostart' : '';
    let itemMarkup = '';
    let triggerSelector;

    if (compactMultiRow) {
        switch (previewMode) {
            case 2:
                itemMarkup = `
                    <span class="outer fv-docker-preview-card fv-docker-preview-card-compact fv-docker-preview-mode-2 fv-preview-trigger fv-preview-tooltip-proxy${autostartClass}">
                        <span class="hand fv-preview-trigger fv-preview-tooltip-proxy"><img src="${safeIcon}" class="img folder-img" data-fv-onerror='this.src="/plugins/dynamix.docker.manager/images/question.png"'${imageStyle}></span>
                        ${onlyIconStatusMarkup}
                    </span>
                `;
                triggerSelector = '.fv-docker-preview-card';
                break;
            case 3:
            case 4:
                itemMarkup = `
                    <span class="outer fv-docker-preview-card fv-docker-preview-card-compact fv-docker-preview-mode-${previewMode} fv-preview-trigger fv-preview-tooltip-proxy${autostartClass}">
                        <span class="inner fv-preview-trigger fv-preview-tooltip-proxy">
                            <span class="appname${updateClass}"${textWidthData}><a class="exec${updateClass}">${safeName}</a></span>
                            <span class="fv-preview-meta-compact">
                            ${compactStatusMarkup}
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
                        <span class="hand fv-preview-trigger fv-preview-tooltip-proxy"><img src="${safeIcon}" class="img folder-img" data-fv-onerror='this.src="/plugins/dynamix.docker.manager/images/question.png"'${imageStyle}></span>
                        <span class="inner fv-preview-trigger fv-preview-tooltip-proxy">
                            <span class="appname${updateClass}"${textWidthData}><a class="exec${updateClass}">${safeName}</a></span>
                            <span class="fv-preview-meta-compact">
                            ${compactStatusMarkup}
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
                    <span class="hand fv-preview-trigger"><img src="${safeIcon}" class="img folder-img" data-fv-onerror='this.src="/plugins/dynamix.docker.manager/images/question.png"'${imageStyle}></span>
                    ${onlyIconStatusMarkup}
                </span>
            `;
            triggerSelector = '.hand';
            break;
        case 3:
            itemMarkup = `
                <span class="outer fv-docker-preview-card fv-docker-preview-mode-3${autostartClass}">
                    <span class="inner fv-preview-trigger">
                        <span class="appname${updateClass}"${textWidthData}><a class="exec${updateClass}">${safeName}</a></span>${inlineStatusMarkup}
                    </span>
                </span>
            `;
            triggerSelector = '.appname, .state, i.fa';
            break;
        case 4:
            itemMarkup = `
                <span class="outer fv-docker-preview-card fv-docker-preview-mode-4${autostartClass}">
                    <span class="inner fv-preview-trigger">
                        <span class="appname${updateClass}"${textWidthData}><a class="exec${updateClass}">${safeName}</a></span>${inlineStatusMarkup}
                    </span>
                </span>
            `;
            triggerSelector = '.appname, .state, i.fa';
            break;
        case 1:
        default:
            itemMarkup = `
                <span class="outer fv-docker-preview-card fv-docker-preview-mode-1${autostartClass}">
                    <span class="hand fv-preview-trigger"><img src="${safeIcon}" class="img folder-img" data-fv-onerror='this.src="/plugins/dynamix.docker.manager/images/question.png"'${imageStyle}></span>
                    <span class="inner fv-preview-trigger">
                        <span class="appname${updateClass}"${textWidthData}><a class="exec${updateClass}">${safeName}</a></span>${inlineStatusMarkup}
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
    const overflowMode = normalizeFolderPreviewOverflow(settings);
    if (overflowMode === 'scroll') {
        finalizePreviewRows($preview, [wrappers], settings);
        return;
    }
    const rowLimit = overflowMode === 'expand_row' ? 0 : normalizeFolderPreviewRowLimit(settings);
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
    const previewStatusMode = normalizePreviewStatusMode(settings?.preview_status);
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
        if (previewStatusMode === 'none' && ($node.is('i.fa, span.state') || $node.find('span.state').length)) {
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
    const previewActionsApi = getDockerPreviewActionsApi();
    const labels = runtimeEntry?.Labels && typeof runtimeEntry.Labels === 'object' ? runtimeEntry.Labels : {};
    const tooltipWebUiUrl = getSafeWebuiUrl(runtimeEntry?.info?.State?.WebUi);
    const tooltipTsWebUiUrl = getSafeWebuiUrl(runtimeEntry?.info?.State?.TSWebUi);
    const tooltipShowAdvanced = $.cookie('docker_listview_mode') == 'advanced';
    const safeShortId = escapeHtml(ct?.shortId || runtimeEntry?.shortId || '');
    const safeImageShortId = escapeHtml(runtimeEntry?.shortImageId || '');
    const safeIcon = sanitizeImageSrc(labels['net.unraid.docker.icon'] || '');
    const containerName = String(runtimeEntry?.info?.Name || '').trim();
    const safeContainerName = escapeHtml(containerName);
    const shellValue = String(runtimeEntry?.info?.Shell || '/bin/sh').trim() || '/bin/sh';
    const templatePath = String(runtimeEntry?.info?.template?.path || '').trim();
    const safeImage = escapeHtml(runtimeEntry?.info?.Config?.Image || '');
    const safeImageVersion = escapeHtml(String(runtimeEntry?.info?.Config?.Image || '').split(':').pop() || '');
    const safeRepositoryName = escapeHtml(String(runtimeEntry?.info?.Config?.Image || '').split(':').shift() || '');
    const registryUrl = getSafeExternalUrl(runtimeEntry?.info?.registry);
    const readMeUrl = getSafeExternalUrl(runtimeEntry?.info?.ReadMe);
    const projectUrl = getSafeExternalUrl(runtimeEntry?.info?.Project);
    const supportUrl = getSafeExternalUrl(runtimeEntry?.info?.Support);
    const donateUrl = getSafeExternalUrl(runtimeEntry?.info?.DonateLink);
    const safeRegistryUrl = registryUrl ? escapeHtml(registryUrl) : '';
    const safeReadMeUrl = readMeUrl ? escapeHtml(readMeUrl) : '';
    const safeProjectUrl = projectUrl ? escapeHtml(projectUrl) : '';
    const safeSupportUrl = supportUrl ? escapeHtml(supportUrl) : '';
    const safeDonateUrl = donateUrl ? escapeHtml(donateUrl) : '';
    const safeTooltipWebUiUrl = tooltipWebUiUrl ? escapeHtml(tooltipWebUiUrl) : '';
    const safeTooltipTsWebUiUrl = tooltipTsWebUiUrl ? escapeHtml(tooltipTsWebUiUrl) : '';
    const tooltipUpdateHtml = previewActionsApi && typeof previewActionsApi.buildDockerMemberUpdateColumnHtml === 'function'
        ? previewActionsApi.buildDockerMemberUpdateColumnHtml({
            name: containerName,
            manager: runtimeEntry?.info?.State?.manager,
            update: runtimeEntry?.info?.State?.Updated === false
        }, {
            advanced: tooltipShowAdvanced
        })
        : '';
    const $content = $(`
    <div class="preview-outbox preview-outbox-${safeShortId}">
        <div class="first-row">
            <div class="preview-name">
                <div class="preview-img"><img src="${safeIcon}" class="img folder-img" data-fv-onerror='this.src="/plugins/dynamix.docker.manager/images/question.png"'></div>
                <div class="preview-actual-name">
                    <span class="blue-text appname">${safeContainerName}</span><br>
                    <i class="fa fa-${runtimeEntry.info.State.Running ? (runtimeEntry.info.State.Paused ? 'pause' : 'play') : 'square'} ${runtimeEntry.info.State.Running ? (runtimeEntry.info.State.Paused ? 'paused' : 'started') : 'stopped'} ${runtimeEntry.info.State.Running ? (runtimeEntry.info.State.Paused ? 'orange-text' : 'green-text') : 'red-text'}"></i>
                    <span class="state"> ${runtimeEntry.info.State.Running ? (runtimeEntry.info.State.Paused ? $.i18n('paused') : $.i18n('started')) : $.i18n('stopped')}</span>
                </div>
            </div>
            <table class="preview-status">
                <thead class="status-header"><tr><th class="status-header-version">${$.i18n('version')}</th><th class="status-header-stats">CPU/MEM</th><th class="status-header-autostart">${$.i18n('autostart')}</th></tr></thead>
                <tbody><tr>
                    <td><div class="status-version">${tooltipUpdateHtml}<br><i class="fa fa-info-circle fa-fw"></i> ${safeImageVersion}</div></td>
                    <td><div class="status-stats"><span class="cpu-${safeShortId}">0%</span><div class="usage-disk mm"><span id="cpu-${safeShortId}" data-fvplus-style="fv-u-u73jk7"></span><span></span></div><br><span class="mem-${safeShortId}">0 / 0</span></div></td>
                    <td><div class="status-autostart"><input type="checkbox" data-fvplus-style="fv-u-uydnfn" class="staus-autostart-checkbox"></div></td>
                </tr></tbody>
            </table>
        </div>
        <div class="second-row">
            <div class="action-info">
                <div class="action">
                    <div class="action-left">
                        <ul class="fa-ul">
                            ${(runtimeEntry.info.State.Running && !runtimeEntry.info.State.Paused) ? 
                                `${safeTooltipWebUiUrl ? `<li><a class="fv-runtime-webui-link" href="${safeTooltipWebUiUrl}" target="_blank" rel="noopener noreferrer"><i class="fa fa-globe" aria-hidden="true"></i> ${$.i18n('webui')}</a></li>` : ''}
                                 ${safeTooltipTsWebUiUrl ? `<li><a class="fv-runtime-webui-link" href="${safeTooltipTsWebUiUrl}" target="_blank" rel="noopener noreferrer"><i class="fa fa-shield" aria-hidden="true"></i> ${$.i18n('tailscale-webui')}</a></li>` : ''}
                                 <li><a href="#" class="fv-runtime-action" data-action="console" data-container-name="${safeContainerName}" data-shell-value="${escapeHtml(shellValue)}"><i class="fa fa-terminal" aria-hidden="true"></i> ${$.i18n('console')}</a></li>`
                            : ''}
                            ${!runtimeEntry.info.State.Running ? `<li><a href="#" class="fv-runtime-action" data-action="start" data-container-id="${safeShortId}"><i class="fa fa-play" aria-hidden="true"></i> ${$.i18n('start')}</a></li>` : 
                                `${runtimeEntry.info.State.Paused ? `<li><a href="#" class="fv-runtime-action" data-action="resume" data-container-id="${safeShortId}"><i class="fa fa-play" aria-hidden="true"></i> ${$.i18n('resume')}</a></li>` : 
                                    `<li><a href="#" class="fv-runtime-action" data-action="stop" data-container-id="${safeShortId}"><i class="fa fa-stop" aria-hidden="true"></i> ${$.i18n('stop')}</a></li>
                                     <li><a href="#" class="fv-runtime-action" data-action="pause" data-container-id="${safeShortId}"><i class="fa fa-pause" aria-hidden="true"></i> ${$.i18n('pause')}</a></li>`}
                            <li><a href="#" class="fv-runtime-action" data-action="restart" data-container-id="${safeShortId}"><i class="fa fa-refresh" aria-hidden="true"></i> ${$.i18n('restart')}</a></li>`}
                            <li><a href="#" class="fv-runtime-action" data-action="logs" data-container-name="${safeContainerName}"><i class="fa fa-navicon" aria-hidden="true"></i> ${$.i18n('logs')}</a></li>
                            ${runtimeEntry.info.template ? `<li><a href="#" class="fv-runtime-action" data-action="edit" data-container-name="${safeContainerName}" data-template-path="${escapeHtml(templatePath)}"><i class="fa fa-wrench" aria-hidden="true"></i> ${$.i18n('edit')}</a></li>` : ''}
                            <li><a href="#" class="fv-runtime-action" data-action="remove" data-container-name="${safeContainerName}" data-image-id="${safeImageShortId}" data-container-id="${safeShortId}"><i class="fa fa-trash" aria-hidden="true"></i> ${$.i18n('remove')}</a></li>
                        </ul>
                    </div>
                    <div class="action-right">
                        <ul class="fa-ul">
                            ${safeReadMeUrl ? `<li><a href="${safeReadMeUrl}" target="_blank" rel="noopener noreferrer"><i class="fa fa-book" aria-hidden="true"></i> ${$.i18n('read-me-first')}</a></li>` : ''}
                            ${safeProjectUrl ? `<li><a href="${safeProjectUrl}" target="_blank" rel="noopener noreferrer"><i class="fa fa-life-ring" aria-hidden="true"></i> ${$.i18n('project-page')}</a></li>` : ''}
                            ${safeSupportUrl ? `<li><a href="${safeSupportUrl}" target="_blank" rel="noopener noreferrer"><i class="fa fa-question" aria-hidden="true"></i> ${$.i18n('support')}</a></li>` : ''}
                            ${safeRegistryUrl ? `<li><a href="${safeRegistryUrl}" target="_blank" rel="noopener noreferrer"><i class="fa fa-info-circle" aria-hidden="true"></i> ${$.i18n('more-info')}</a></li>` : ''}
                            ${safeDonateUrl ? `<li><a href="${safeDonateUrl}" target="_blank" rel="noopener noreferrer"><i class="fa fa-usd" aria-hidden="true"></i> ${$.i18n('donate')}</a></li>` : ''}
                        </ul>
                    </div>
                </div>
                <div class="info-ct">
                    <span class="container-id">${$.i18n('container-id')}: ${safeShortId}</span><br>
                    <span class="repo">${$.i18n('by')}: <a target="_blank" rel="noopener noreferrer" ${safeRegistryUrl ? `href="${safeRegistryUrl}"` : ''} title="${safeImage}">${safeRepositoryName}</a></span>
                </div>
            </div>
            <div class="info-section">
                <ul class="info-tabs">
                    <li><a class="tabs-graph localURL" href="#comb-grapth-${safeShortId}">${$.i18n('graph')}</a></li>
                    <li><a class="tabs-cpu-graph localURL" href="#cpu-grapth-${safeShortId}">${$.i18n('cpu-graph')}</a></li>
                    <li><a class="tabs-mem-graph localURL" href="#mem-grapth-${safeShortId}">${$.i18n('mem-graph')}</a></li>
                    <li><a class="tabs-ports localURL" href="#info-ports-${safeShortId}">${$.i18n('port-mappings')}</a></li>
                    <li><a class="tabs-volumes localURL" href="#info-volumes-${safeShortId}">${$.i18n('volume-mappings')}</a></li>
                </ul>
                <div class="comb-grapth-${safeShortId} comb-stat-grapth" id="comb-grapth-${safeShortId}" data-fvplus-style="fv-u-569beu"><canvas></canvas></div>
                <div class="cpu-grapth-${safeShortId} cpu-stat-grapth" id="cpu-grapth-${safeShortId}" data-fvplus-style="fv-u-569beu"><canvas></canvas></div>
                <div class="mem-grapth-${safeShortId} mem-stat-grapth" id="mem-grapth-${safeShortId}" data-fvplus-style="fv-u-569beu"><canvas></canvas></div>
                <div class="info-ports" id="info-ports-${safeShortId}" data-fvplus-style="fv-u-569beu">${buildDockerPortMappingsHtml(runtimeEntry.info.Ports)}</div>
                <div class="info-volumes" id="info-volumes-${safeShortId}" data-fvplus-style="fv-u-569beu">${buildDockerBindMountMappingsHtml(runtimeEntry.Mounts)}</div>
            </div>
            </div>
        </div>
    `);
    $content.find('a.fv-runtime-webui-link').on('click', (event) => {
        event.preventDefault();
        openWebuiInNewTab(event.currentTarget?.href || '');
    });
    $content.on('click', '.fv-runtime-toggle-info-list', function(event) {
        event.preventDefault();
        const $link = $(event.currentTarget);
        const showSelector = String($link.attr('data-show') || '').trim();
        if (!showSelector) {
            return;
        }
        $link.parent().css('display', 'none').siblings(showSelector).css('display', 'inline');
    });
    $content.on('click', '.fv-runtime-action', function(event) {
        event.preventDefault();
        const $link = $(event.currentTarget);
        const action = String($link.attr('data-action') || '').trim();
        const containerId = String($link.attr('data-container-id') || '').trim();
        const actionMap = new Set(['start', 'resume', 'stop', 'pause', 'restart']);
        if (actionMap.has(action) && containerId) {
            const refreshTarget = getDockerRuntimeReconcileApi()?.getLifecycleRefreshCallbackName?.() || 'loadlist';
            eventControl({ action, container: containerId }, refreshTarget);
            return;
        }
        const actionContainerName = String($link.attr('data-container-name') || '').trim();
        if (!actionContainerName) {
            return;
        }
        if (action === 'console') {
            openTerminal('docker', actionContainerName, String($link.attr('data-shell-value') || '').trim() || '/bin/sh');
        } else if (action === 'logs') {
            openTerminal('docker', actionContainerName, '.log');
        } else if (action === 'edit') {
            editContainer(actionContainerName, String($link.attr('data-template-path') || '').trim());
        } else if (action === 'remove') {
            rmContainer(actionContainerName, String($link.attr('data-image-id') || '').trim(), containerId);
        }
    });
    return $content;
};

const refreshDockerPreviewTooltipContent = (changedNames = null) => {
    const names = changedNames instanceof Set
        ? Array.from(changedNames)
        : (Array.isArray(changedNames) ? changedNames : Object.keys(dockerRuntimeInfoByName || {}));
    names.forEach((name) => {
        const runtimeEntry = getDockerRuntimeContainerInfo(name);
        const shortId = String(runtimeEntry?.shortId || '').trim();
        if (!runtimeEntry || !shortId) {
            return;
        }
        const triggerId = `folder-preview-${shortId}`;
        $('[id^="folder-preview-"]').filter((_, node) => String(node?.id || '') === triggerId).each((_, node) => {
            const $trigger = $(node);
            $trigger.data('fvTooltipLazyBuilt', false);
            if ($trigger.data('fvTooltipsterInitialized') !== true || typeof $trigger.tooltipster !== 'function') {
                return;
            }
            try {
                const instance = $trigger.tooltipster('instance');
                if (instance && typeof instance.content === 'function') {
                    instance.content(buildDockerTooltipContent(runtimeEntry));
                    $trigger.data('fvTooltipLazyBuilt', true);
                }
            } catch (_error) {
                // Leave the tooltip invalidated so functionBefore rebuilds it on the next open.
            }
        });
    });
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

const buildFolderDepthById = (folders) => runtimeFolderOrdering.buildFolderDepthById(folders, {
    normalizeParentId: normalizeFolderParentId,
    maxDepth: 8
});

const reorderFolderSlotsInBaseOrder = (baseOrder, folders, prefs) => (
    runtimeFolderOrdering.reorderFolderSlotsInBaseOrder(baseOrder, folders, prefs, {
        orderFolders: getPrefsOrderedFolderMap,
        folderTokenPrefix: 'folder-',
        isFolderToken: (entry) => folderRegex.test(String(entry || ''))
    })
);

const reconcileDockerOrderWithFolderSlots = (liveOrder, savedOrder, folders) => (
    runtimeFolderOrdering.reconcileOrderWithFolderSlots(liveOrder, savedOrder, folders, {
        folderTokenPrefix: 'folder-',
        isFolderToken: (entry) => folderRegex.test(String(entry || ''))
    })
);

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
const normalizeDockerPinnedFolderIdList = (value) => {
    if (!Array.isArray(value)) {
        return [];
    }
    return Array.from(new Set(value.map((item) => String(item || '').trim()).filter((item) => item !== '')));
};
const isDockerFolderPinned = (folderId) => {
    const id = String(folderId || '').trim();
    if (!id) {
        return false;
    }
    const prefsPinned = normalizeDockerPinnedFolderIdList(folderTypePrefs?.pinnedFolderIds);
    if (prefsPinned.includes(id)) {
        return true;
    }
    const runtimePinned = normalizeDockerPinnedFolderIdList(dockerRuntimeStateStore.get('pinnedFolderIds', []));
    return runtimePinned.includes(id);
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
const buildDockerFolderPinnedIndicatorHtml = () => {
    const label = escapeHtml(getDockerMenuLabel('pinned-folder', 'Pinned folder'));
    return `<span class="fv-folder-pin-indicator" title="${label}" aria-label="${label}"><i class="fa fa-thumb-tack" aria-hidden="true"></i></span>`;
};
const syncDockerFolderPinnedIndicator = ($row, pinned) => {
    if (!$row || !$row.length) {
        return;
    }
    const $indicator = $row.find('.fv-folder-pin-indicator').first();
    if (!pinned) {
        $indicator.remove();
        return;
    }
    if ($indicator.length) {
        return;
    }
    const $name = $row.find('.folder-appname').first();
    if ($name.length) {
        $name.after(buildDockerFolderPinnedIndicatorHtml());
    }
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
    syncDockerFolderPinnedIndicator($row, pinned);
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
    const normalizedPinnedIds = normalizeDockerPinnedFolderIdList(nextPinnedIds);
    folderTypePrefs = utils.normalizePrefs({
        ...(folderTypePrefs || {}),
        pinnedFolderIds: normalizedPinnedIds
    });
    dockerRuntimeStateStore.set({ pinnedFolderIds: normalizedPinnedIds });
};
let dockerPinnedFolderIdsOverride = null;
const dockerPinnedFolderIdListsMatch = (left, right) => {
    const normalizedLeft = normalizeDockerPinnedFolderIdList(left);
    const normalizedRight = normalizeDockerPinnedFolderIdList(right);
    return normalizedLeft.length === normalizedRight.length
        && normalizedLeft.every((entry, index) => entry === normalizedRight[index]);
};
const rememberDockerPinnedFolderIdsOverride = (nextPinnedIds) => {
    dockerPinnedFolderIdsOverride = {
        pinnedFolderIds: normalizeDockerPinnedFolderIdList(nextPinnedIds),
        expiresAt: Date.now() + 10000
    };
};
const clearDockerPinnedFolderIdsOverride = () => {
    dockerPinnedFolderIdsOverride = null;
};
const applyDockerPinnedFolderPrefsOverride = (prefs = {}) => {
    const normalized = utils.normalizePrefs(prefs || {});
    if (!dockerPinnedFolderIdsOverride || Date.now() > Number(dockerPinnedFolderIdsOverride.expiresAt || 0)) {
        clearDockerPinnedFolderIdsOverride();
        return normalized;
    }
    const overridePinnedIds = normalizeDockerPinnedFolderIdList(dockerPinnedFolderIdsOverride.pinnedFolderIds);
    if (dockerPinnedFolderIdListsMatch(normalized.pinnedFolderIds, overridePinnedIds)) {
        return normalized;
    }
    return utils.normalizePrefs({
        ...normalized,
        pinnedFolderIds: overridePinnedIds
    });
};
const assertDockerPrefsSaveResponse = (response, fallbackMessage = 'Failed to save Docker preferences.') => {
    if (!response || response.ok === false) {
        throw new Error(String(response?.error || fallbackMessage));
    }
    return response;
};
const fetchDockerPinnedFolderPrefs = async () => {
    const url = `/plugins/folderview.plus/server/prefs.php?type=docker&_=${Date.now()}`;
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
    assertDockerPrefsSaveResponse(response, 'Failed to confirm Docker pinned folders.');
    return normalizeDockerPrefsResponse(response);
};
let dockerPinnedFolderServerReconcileTimer = null;
let dockerPinnedFolderServerReconcileGeneration = 0;
const queueDockerPinnedFolderServerReconcile = (reason = 'post-render', delayMs = 120) => {
    if (dockerPinnedFolderServerReconcileTimer) {
        clearTimeout(dockerPinnedFolderServerReconcileTimer);
    }
    const safeDelay = Math.max(0, Math.min(1000, Number(delayMs) || 0));
    dockerPinnedFolderServerReconcileTimer = setTimeout(() => {
        dockerPinnedFolderServerReconcileTimer = null;
        const generation = ++dockerPinnedFolderServerReconcileGeneration;
        fetchDockerPinnedFolderPrefs()
            .then((prefs) => {
                if (generation !== dockerPinnedFolderServerReconcileGeneration) {
                    return;
                }
                const reconciledPrefs = applyDockerPinnedFolderPrefsOverride(prefs || {});
                applyDockerPinnedFolderIds(reconciledPrefs.pinnedFolderIds);
                syncDockerPinnedFolderUi();
                appendDockerRequestBundleTrace('pinned-folder-reconcile', {
                    reason,
                    pinnedFolderCount: normalizeDockerPinnedFolderIdList(reconciledPrefs.pinnedFolderIds).length
                });
            })
            .catch(() => {
                // The initial render state remains usable; the next Docker render or settings sync will retry.
            });
    }, safeDelay);
};
const persistDockerPinnedFolderIds = async (nextPinnedIds) => {
    if (dockerPrefsCoordinator) {
        const prefs = await dockerPrefsCoordinator.save('docker', {
            pinnedFolderIds: nextPinnedIds
        }, {
            currentPrefs: folderTypePrefs,
            immediate: true
        });
        return { ok: true, prefs };
    }
    const payload = {
        type: 'docker',
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
    assertDockerPrefsSaveResponse(response, 'Failed to save Docker pinned folders.');
    const confirmedPrefs = await fetchDockerPinnedFolderPrefs();
    if (!dockerPinnedFolderIdListsMatch(confirmedPrefs.pinnedFolderIds, nextPinnedIds)) {
        throw new Error('Docker pinned folders did not persist.');
    }
    return {
        ...response,
        prefs: confirmedPrefs
    };
};
const broadcastDockerPinnedFolderChange = (payload = {}) => {
    const eventPayload = {
        type: 'docker',
        pinnedFolderIds: normalizeDockerPinnedFolderIdList(payload.pinnedFolderIds),
        changedFolderId: String(payload.changedFolderId || ''),
        pinned: payload.pinned === true,
        timestamp: Number(payload.timestamp || Date.now())
    };
    try {
        localStorage.setItem(PINNED_FOLDER_CHANGE_STORAGE_KEY, JSON.stringify(eventPayload));
    } catch (_error) {
        // Cross-page refresh hints are best-effort; persistence already succeeded.
    }
    try {
        window.dispatchEvent(new CustomEvent(PINNED_FOLDER_CHANGE_EVENT, { detail: eventPayload }));
    } catch (_error) {
        // Same-window refresh hints are best-effort for older browsers.
    }
};
const toggleDockerFolderPin = async (folderId, requestedPinned = !isDockerFolderPinned(folderId)) => {
    const id = String(folderId || '').trim();
    if (!id || !globalFolders[id]) { return; }
    const previousPinned = normalizeDockerPinnedFolderIdList(folderTypePrefs?.pinnedFolderIds);
    const optimisticPinned = requestedPinned === true ? (previousPinned.includes(id) ? previousPinned : [...previousPinned, id]) : previousPinned.filter((entry) => entry !== id);
    return dockerSafeUiActionRunner.run(`docker-pin:${id}`, async (intent) => {
        const result = await runDockerGuardedAction('toggle-folder-pin', async () => {
            const currentPrefs = await fetchDockerPinnedFolderPrefs();
            const current = normalizeDockerPinnedFolderIdList(currentPrefs.pinnedFolderIds);
            const nextPinned = requestedPinned === true ? (current.includes(id) ? current : [...current, id]) : current.filter((entry) => entry !== id);
            const response = await persistDockerPinnedFolderIds(nextPinned);
            if (!intent.isLatest()) { return; }
            const confirmedPinned = normalizeDockerPinnedFolderIdList(response?.prefs?.pinnedFolderIds || nextPinned);
            applyDockerPinnedFolderIds(confirmedPinned);
            syncDockerPinnedFolderUi();
            broadcastDockerPinnedFolderChange({
                pinnedFolderIds: confirmedPinned,
                changedFolderId: id,
                pinned: confirmedPinned.includes(id)
            });
        }, {
            userMessage: getDockerMenuLabel('folder-pin-failed', 'Failed to update pinned folders.'),
            userVisible: true
        });
        if (!result.ok && intent.isLatest()) {
            clearDockerPinnedFolderIdsOverride();
            applyDockerPinnedFolderIds(previousPinned);
            syncDockerPinnedFolderUi();
        }
    }, { queueIfBusy: true, onIntent: () => {
        rememberDockerPinnedFolderIdsOverride(optimisticPinned);
        applyDockerPinnedFolderIds(optimisticPinned);
        syncDockerPinnedFolderUi();
    } });
};
const buildDockerFolderRuntimeOrderState = () => {
    const folders = globalFolders && typeof globalFolders === 'object' ? globalFolders : {};
    const orderedMap = getPrefsOrderedFolderMap(folders, folderTypePrefs || {});
    const fullOrder = Object.keys(orderedMap || {});
    for (const id of Object.keys(folders)) {
        if (!fullOrder.includes(id)) {
            fullOrder.push(id);
        }
    }
    const validIds = new Set(Object.keys(folders));
    const parentById = {};
    const childrenById = {};
    for (const id of Object.keys(folders)) {
        childrenById[id] = [];
    }
    for (const id of Object.keys(folders)) {
        const rawParentId = normalizeFolderParentId(folders[id]?.parentId || folders[id]?.parent_id || '');
        const parentId = rawParentId && rawParentId !== id && validIds.has(rawParentId) ? rawParentId : '';
        parentById[id] = parentId;
        if (parentId) {
            childrenById[parentId].push(id);
        }
    }
    const indexById = new Map(fullOrder.map((id, index) => [id, index]));
    for (const children of Object.values(childrenById)) {
        children.sort((left, right) => (indexById.get(left) ?? 0) - (indexById.get(right) ?? 0));
    }
    const collectDescendants = (folderId, seen = new Set()) => {
        const id = String(folderId || '').trim();
        if (!id || seen.has(id)) {
            return [];
        }
        seen.add(id);
        const output = [];
        for (const childId of (childrenById[id] || [])) {
            output.push(childId);
            output.push(...collectDescendants(childId, seen));
        }
        return output;
    };
    return {
        folders,
        fullOrder,
        parentById,
        childrenById,
        collectDescendants
    };
};
const normalizeDockerManualFolderOrder = (nextOrder, folders = globalFolders, prefs = folderTypePrefs) => {
    const folderMap = folders && typeof folders === 'object' ? folders : {};
    const requestedOrder = Array.isArray(nextOrder) ? nextOrder.map((id) => String(id || '').trim()).filter((id) => id !== '') : [];
    const ordered = getPrefsOrderedFolderMap(folderMap, {
        ...(prefs || {}),
        sortMode: 'manual',
        manualOrder: requestedOrder
    });
    return Object.keys(ordered || {});
};
const persistDockerFolderManualOrder = async (nextOrder) => {
    const normalizedOrder = normalizeDockerManualFolderOrder(nextOrder);
    if (dockerPrefsCoordinator) {
        const prefs = await dockerPrefsCoordinator.save('docker', {
            sortMode: 'manual',
            manualOrder: normalizedOrder
        }, {
            currentPrefs: folderTypePrefs,
            immediate: true
        });
        return { ok: true, prefs };
    }
    const payload = {
        type: 'docker',
        prefs: JSON.stringify({
            sortMode: 'manual',
            manualOrder: normalizedOrder
        })
    };
    const request = window.FolderViewPlusRequest;
    if (request && typeof request.postJson === 'function') {
        try {
            return await request.postJson('/plugins/folderview.plus/server/prefs.php', payload, {
                retries: 0,
                retryDelayMs: 260
            });
        } catch (_error) {
            // Fall through to the legacy POST path so Docker menu ordering still
            // works if the runtime request wrapper is temporarily unavailable.
        }
    }
    return pluginRequestClient.postJson('/plugins/folderview.plus/server/prefs.php', payload);
};
const persistDockerFolderRecord = async (folderId, folderPayload) => {
    const id = String(folderId || '').trim();
    if (!id) {
        throw new Error('Missing folder ID.');
    }
    const payload = {
        type: 'docker',
        id,
        content: JSON.stringify(folderPayload && typeof folderPayload === 'object' ? folderPayload : {})
    };
    const request = window.FolderViewPlusRequest;
    if (request && typeof request.postJson === 'function') {
        try {
            return await request.postJson('/plugins/folderview.plus/server/update.php', payload, {
                retries: 0,
                retryDelayMs: 260
            });
        } catch (_error) {
            // Fall through to the legacy POST path so hierarchy moves still work
            // if the runtime request wrapper is temporarily unavailable.
        }
    }
    return pluginRequestClient.postJson('/plugins/folderview.plus/server/update.php', payload);
};
const applyDockerFolderMenuOrderToDom = (orderedIds) => {
    if (!Array.isArray(orderedIds) || orderedIds.length <= 0) {
        return false;
    }
    const $folderRows = $('#docker_list > tr.folder');
    if (!$folderRows.length) {
        return false;
    }
    const rowById = new Map();
    $folderRows.each((_index, row) => {
        const id = readFolderIdFromRow(row);
        if (id) {
            rowById.set(id, row);
        }
    });
    const orderedRows = [];
    orderedIds.forEach((id) => {
        const row = rowById.get(String(id || '').trim());
        if (row) {
            orderedRows.push(row);
            rowById.delete(String(id || '').trim());
        }
    });
    rowById.forEach((row) => orderedRows.push(row));
    if (orderedRows.length <= 1) {
        return false;
    }
    const currentRows = $folderRows.get();
    const changed = orderedRows.some((row, index) => row !== currentRows[index]);
    if (!changed) {
        return false;
    }
    const $firstFolderRow = $folderRows.first();
    const $previous = $firstFolderRow.prev();
    const fragment = document.createDocumentFragment();
    orderedRows.forEach((row) => {
        fragment.appendChild(row);
    });
    if ($previous.length) {
        $previous.after(fragment);
    } else {
        $('#docker_list').prepend(fragment);
    }
    orderedRows.forEach((row) => {
        const id = readFolderIdFromRow(row);
        if (id) {
            forceFolderRowVerticalCenter(id);
        }
    });
    const $dockerList = $('#docker_list');
    if ($dockerList.length && typeof $dockerList.sortable === 'function') {
        try {
            $dockerList.sortable('refresh');
        } catch (_error) {}
    }
    return true;
};
const buildDockerFolderMoveTargetOptions = (sourceId, state) => {
    const safeSourceId = String(sourceId || '').trim();
    const folders = state?.folders && typeof state.folders === 'object' ? state.folders : {};
    const descendants = state?.collectDescendants ? state.collectDescendants(safeSourceId) : [];
    const blocked = new Set([safeSourceId, ...descendants]);
    return (state?.fullOrder || [])
        .filter((id) => Object.prototype.hasOwnProperty.call(folders, id) && !blocked.has(id))
        .map((id) => {
            const folder = folders[id] || {};
            const depth = Math.max(0, Number(buildFolderDepthById(folders)[id]) || 0);
            const prefix = depth > 0 ? `${'-- '.repeat(Math.min(depth, 6))}` : '';
            return `<option value="${escapeHtml(id)}">${escapeHtml(prefix + String(folder.name || id))}</option>`;
        })
        .join('');
};
const applyDockerFolderHierarchyMoveFromMenu = async (folderId, nextParentId) => {
    const id = String(folderId || '').trim();
    const parentId = normalizeFolderParentId(nextParentId);
    if (!id || !globalFolders[id]) {
        return;
    }
    if (!ensureDockerFolderUnlocked(id, parentId ? 'Move folder under another folder' : 'Move folder to root')) {
        return;
    }
    return dockerSafeUiActionRunner.run(`docker-folder-menu-hierarchy:${id}:${parentId || 'root'}`, async () => {
        const state = buildDockerFolderRuntimeOrderState();
        const { folders, fullOrder, parentById, collectDescendants } = state;
        const sourceFolder = folders[id];
        if (!sourceFolder) {
            return;
        }
        const descendants = collectDescendants(id);
        if (parentId && (!Object.prototype.hasOwnProperty.call(folders, parentId) || parentId === id || descendants.includes(parentId))) {
            swal({
                title: 'Folder move blocked',
                text: 'Choose a different target folder. A folder cannot be moved under itself or one of its children.',
                type: 'info',
                confirmButtonText: 'OK'
            });
            return;
        }
        const currentParentId = String(parentById[id] || '').trim();
        if (currentParentId === parentId) {
            swal({
                title: 'Folder already there',
                text: parentId ? 'This folder is already under the selected folder.' : 'This folder is already at the top level.',
                type: 'info',
                confirmButtonText: 'OK'
            });
            return;
        }
        const sourceSubtreeIds = [id, ...descendants];
        const sourceSet = new Set(sourceSubtreeIds);
        const orderWithoutSource = fullOrder.filter((candidateId) => !sourceSet.has(candidateId));
        let insertIndex = orderWithoutSource.length;
        if (parentId) {
            const parentSubtreeIds = [parentId, ...collectDescendants(parentId)].filter((candidateId) => !sourceSet.has(candidateId));
            let lastParentSubtreeIndex = -1;
            orderWithoutSource.forEach((candidateId, index) => {
                if (parentSubtreeIds.includes(candidateId)) {
                    lastParentSubtreeIndex = index;
                }
            });
            insertIndex = lastParentSubtreeIndex >= 0 ? lastParentSubtreeIndex + 1 : orderWithoutSource.length;
        }
        const requestedOrder = orderWithoutSource.slice();
        requestedOrder.splice(Math.max(0, Math.min(insertIndex, requestedOrder.length)), 0, ...sourceSubtreeIds);
        const previousFolders = { ...globalFolders };
        const previousPrefs = utils.normalizePrefs(folderTypePrefs || {});
        const previousOrder = fullOrder.slice();
        const nextFolder = {
            ...sourceFolder,
            parentId
        };
        const nextFolders = {
            ...globalFolders,
            [id]: nextFolder
        };
        const nextOrder = normalizeDockerManualFolderOrder(requestedOrder, nextFolders, folderTypePrefs);
        globalFolders = nextFolders;
        folderTypePrefs = utils.normalizePrefs({
            ...(folderTypePrefs || {}),
            sortMode: 'manual',
            manualOrder: nextOrder
        });
        applyRuntimePrefs(folderTypePrefs);
        applyDockerFolderMenuOrderToDom(nextOrder);
        const depthById = buildFolderDepthById(globalFolders);
        sourceSubtreeIds.forEach((movedId) => {
            const safeDepth = Math.max(0, Math.min(8, Number(depthById[movedId]) || 0));
            $(`tr.folder-id-${movedId}`)
                .attr('data-folder-depth', String(safeDepth))
                .find('.folder-name-sub')
                .css('padding-left', `${safeDepth * 20}px`);
            forceFolderRowVerticalCenter(movedId);
        });
        try {
            await persistDockerFolderRecord(id, nextFolder);
            const response = await persistDockerFolderManualOrder(nextOrder);
            folderTypePrefs = utils.normalizePrefs(response?.prefs || folderTypePrefs);
            applyRuntimePrefs(folderTypePrefs);
        } catch (error) {
            globalFolders = previousFolders;
            folderTypePrefs = previousPrefs;
            applyRuntimePrefs(folderTypePrefs);
            applyDockerFolderMenuOrderToDom(previousOrder);
            const previousDepthById = buildFolderDepthById(previousFolders);
            sourceSubtreeIds.forEach((movedId) => {
                const safeDepth = Math.max(0, Math.min(8, Number(previousDepthById[movedId]) || 0));
                $(`tr.folder-id-${movedId}`)
                    .attr('data-folder-depth', String(safeDepth))
                    .find('.folder-name-sub')
                    .css('padding-left', `${safeDepth * 20}px`);
                forceFolderRowVerticalCenter(movedId);
            });
            throw error;
        }
    });
};
const moveDockerFolderUnderFromMenu = (folderId) => {
    const id = String(folderId || '').trim();
    if (!id || !globalFolders[id]) {
        return;
    }
    const state = buildDockerFolderRuntimeOrderState();
    const targetOptions = buildDockerFolderMoveTargetOptions(id, state);
    if (!targetOptions) {
        swal({
            title: 'No target folders',
            text: 'There are no valid folders to move this folder under.',
            type: 'info',
            confirmButtonText: 'OK'
        });
        return;
    }
    const folderName = escapeHtml(String(globalFolders[id]?.name || id));
    swal({
        title: 'Move under...',
        text: `
            <div class="fv-tree-move-dialog">
                <div class="fv-tree-move-source">Source: <strong>${folderName}</strong></div>
                <label class="fv-tree-move-field-label" for="fv-docker-menu-move-target">Move under folder</label>
                <select id="fv-docker-menu-move-target">${targetOptions}</select>
            </div>
        `,
        html: true,
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Move under folder',
        cancelButtonText: 'Cancel',
        closeOnConfirm: true
    }, (confirmed) => {
        if (!confirmed) {
            return;
        }
        const targetId = String($('#fv-docker-menu-move-target').val() || '').trim();
        void applyDockerFolderHierarchyMoveFromMenu(id, targetId);
    });
};
const moveDockerFolderFromMenu = async (folderId, direction) => {
    const id = String(folderId || '').trim();
    const moveDirection = direction < 0 ? -1 : 1;
    if (!id || !globalFolders[id]) {
        return;
    }
    if (!ensureDockerFolderUnlocked(id, moveDirection < 0 ? 'Move folder up' : 'Move folder down')) {
        return;
    }
    return dockerSafeUiActionRunner.run(`docker-folder-menu-move:${id}:${moveDirection}`, async () => {
        const {
            folders,
            fullOrder,
            parentById,
            childrenById,
            collectDescendants
        } = buildDockerFolderRuntimeOrderState();
        if (!Object.prototype.hasOwnProperty.call(folders, id)) {
            return;
        }
        const parentId = String(parentById[id] || '').trim();
        const siblingIds = parentId
            ? [...(childrenById[parentId] || [])]
            : fullOrder.filter((candidateId) => !String(parentById[candidateId] || '').trim());
        const sourceIndex = siblingIds.indexOf(id);
        const targetIndex = sourceIndex + moveDirection;
        if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= siblingIds.length) {
            swal({
                title: 'Folder order unchanged',
                text: moveDirection < 0
                    ? 'This folder is already first in this level.'
                    : 'This folder is already last in this level.',
                type: 'info',
                confirmButtonText: 'OK'
            });
            return;
        }
        const targetSiblingId = siblingIds[targetIndex];
        const sourceSubtreeIds = [id, ...collectDescendants(id)];
        const targetSubtreeIds = [targetSiblingId, ...collectDescendants(targetSiblingId)];
        const sourceSet = new Set(sourceSubtreeIds);
        const orderWithoutSource = fullOrder.filter((candidateId) => !sourceSet.has(candidateId));
        const insertIndex = moveDirection < 0
            ? orderWithoutSource.findIndex((candidateId) => targetSubtreeIds.includes(candidateId))
            : (() => {
                let lastIndex = -1;
                orderWithoutSource.forEach((candidateId, index) => {
                    if (targetSubtreeIds.includes(candidateId)) {
                        lastIndex = index;
                    }
                });
                return lastIndex >= 0 ? lastIndex + 1 : orderWithoutSource.length;
            })();
        const requestedOrder = orderWithoutSource.slice();
        requestedOrder.splice(Math.max(0, Math.min(insertIndex, requestedOrder.length)), 0, ...sourceSubtreeIds);
        const nextOrder = normalizeDockerManualFolderOrder(requestedOrder, folders, folderTypePrefs);
        const changed = nextOrder.length === fullOrder.length
            && nextOrder.some((candidateId, index) => String(candidateId || '') !== String(fullOrder[index] || ''));
        if (!changed) {
            return;
        }
        const previousPrefs = utils.normalizePrefs(folderTypePrefs || {});
        const previousOrder = fullOrder.slice();
        folderTypePrefs = utils.normalizePrefs({
            ...(folderTypePrefs || {}),
            sortMode: 'manual',
            manualOrder: nextOrder
        });
        applyRuntimePrefs(folderTypePrefs);
        applyDockerFolderMenuOrderToDom(nextOrder);
        try {
            const response = await persistDockerFolderManualOrder(nextOrder);
            folderTypePrefs = utils.normalizePrefs(response?.prefs || folderTypePrefs);
            applyRuntimePrefs(folderTypePrefs);
        } catch (error) {
            folderTypePrefs = previousPrefs;
            applyRuntimePrefs(folderTypePrefs);
            applyDockerFolderMenuOrderToDom(previousOrder);
            throw error;
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
    const providerHealth = dockerProviderHealthController?.getModel?.({
        onUpdate: () => renderRuntimeHealthBadge(folders, prefs)
    }) || null;

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
    if (stoppedFolders > 0 || providerHealth?.severity === 'danger') {
        badge.classList.add('is-danger');
    } else if (pausedFolders > 0 || providerHealth?.severity === 'warning') {
        badge.classList.add('is-warning');
    }
    const providerDetail = providerHealth
        ? ` | ${providerHealth.text}`
        : '';
    badge.textContent = `Folder health: ${startedFolders} started | ${pausedFolders} paused | ${stoppedFolders} stopped${providerDetail}`;
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
        preferenceCoordinator: dockerPrefsCoordinator,
        readPrefs: () => folderTypePrefs || {},
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
    dockerRuntimePerformanceTelemetry?.begin?.(`action.${actionName}`);
    const result = await dockerActionBoundary.run(actionName, action, context);
    dockerPerfTelemetry.end(actionName, { ok: result.ok });
    dockerRuntimePerformanceTelemetry?.end?.(`action.${actionName}`, { ok: result.ok });
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

const readDockerPostRenderPolishSignature = () => Array.from(document.querySelectorAll('#docker_list > tr.folder, #docker_view > tr.folder'))
    .map((row) => {
        const id = readFolderIdFromRow(row) || String(row.querySelector?.('.folder-appname')?.textContent || '').trim();
        const rect = row.getBoundingClientRect ? row.getBoundingClientRect() : null;
        const preview = row.querySelector ? row.querySelector('.folder-preview') : null;
        const rowHeight = Math.round(Math.max(Number(rect?.height) || 0, Number(row.offsetHeight) || 0));
        const previewWidth = Math.round(Math.max(Number(preview?.scrollWidth) || 0, Number(preview?.clientWidth) || 0));
        const previewHeight = Math.round(Math.max(Number(preview?.scrollHeight) || 0, Number(preview?.clientHeight) || 0));
        return `${id}:${rowHeight}:${previewWidth}:${previewHeight}`;
    })
    .join('|');

const hasUnsettledDockerPostRenderAssets = () => Array.from(document.querySelectorAll('#docker_list > tr.folder img, #docker_view > tr.folder img'))
    .some((img) => img && img.complete === false);

const queueConditionalDockerPostRenderPolish = ({ delayMs, reason, folderIds = [], signatureRef = null }) => {
    window.setTimeout(() => {
        const currentSignature = readDockerPostRenderPolishSignature();
        const previousSignature = signatureRef && typeof signatureRef === 'object'
            ? String(signatureRef.value || '')
            : '';
        if (currentSignature === previousSignature && !hasUnsettledDockerPostRenderAssets()) {
            return;
        }
        if (signatureRef && typeof signatureRef === 'object') {
            signatureRef.value = currentSignature;
        }
        queueForceAllFolderRowsVerticalCenter();
        scheduleDockerRuntimeWidthReflow(reason, 18);
    }, Math.max(0, Number(delayMs) || 0));
};

dockerDebug.log('[FV3_DEBUG] docker.js loaded. FOLDER_VIEW_DEBUG_MODE is ON.');
if (FOLDER_VIEW_TOUCH_MODE) {
    document.body.classList.add('fv-touch-device');
}

const showDockerRuntimeLoadingRow = () => {
    if (shouldSuppressDockerRuntimeLoadingUi()) {
        return;
    }
    const tbody = $(dockerHostAdapter?.getPrimaryBody?.() || []);
    if (!tbody.length || tbody.find('tr.fv-runtime-loading-row').length) {
        return;
    }
    tbody.prepend('<tr class="fv-runtime-loading-row"><td colspan="18"><i class="fa fa-circle-o-notch fa-spin"></i> Loading Docker folders...</td></tr>');
};

const hideDockerRuntimeLoadingRow = () => {
    dockerHostAdapter?.getBodies?.().forEach((body) => $(body).find('tr.fv-runtime-loading-row').remove());
};

const ensureDockerRuntimeLoadingOverlay = () => {
    let overlay = document.getElementById('fvplus-docker-runtime-loading-overlay');
    if (overlay) {
        return overlay;
    }
    const table = dockerHostAdapter?.getTable?.();
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
        const signatureRef = { value: readDockerPostRenderPolishSignature() };
        startFolderRowCenterObserver();
        queueForceAllFolderRowsVerticalCenter();
        bindDockerRuntimeAppColumnResizer();
        scheduleDockerRuntimeWidthReflow('render-complete', 12);
        queueConditionalDockerPostRenderPolish({
            delayMs: 48,
            reason: 'render-post-48ms',
            folderIds: safeFolderIds,
            signatureRef
        });
        queueConditionalDockerPostRenderPolish({
            delayMs: 80,
            reason: 'render-post-80ms',
            folderIds: safeFolderIds,
            signatureRef
        });
        queueConditionalDockerPostRenderPolish({
            delayMs: 260,
            reason: 'render-post-260ms',
            folderIds: safeFolderIds,
            signatureRef
        });
    };
    if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => run());
        return;
    }
    window.setTimeout(run, 0);
};

const normalizeDockerPageViewMode = (value) => (
    typeof utils.normalizeRuntimePageViewMode === 'function'
        ? utils.normalizeRuntimePageViewMode(value)
        : (['host', 'command'].includes(String(value || '').trim().toLowerCase()) ? String(value || '').trim().toLowerCase() : 'folderview')
);

const resolveDockerPageViewMode = (prefs = folderTypePrefs) => normalizeDockerPageViewMode(
    utils.normalizePrefs(prefs || {}).pageViewMode
);

let dockerRuntimeActionBarApi = null;
const applyDockerRuntimeToolbarFilterState = () => dockerRuntimeActionBarApi?.applyFilterState();
const renderDockerRuntimeActionBar = (mode = resolveDockerPageViewMode()) => dockerRuntimeActionBarApi?.sync(mode);

const syncDockerAddFolderButtonVisibility = (mode = 'folderview') => {
    dockerRuntimeActionBarApi?.sync(normalizeDockerPageViewMode(mode));
};

const fetchDockerBootstrapPrefs = async () => {
    const parsed = await pluginRequestClient.getJson('/plugins/folderview.plus/server/prefs.php', {
        data: { type: 'docker', _: Date.now() },
        cache: false
    });
    const nextPrefs = applyDockerPinnedFolderPrefsOverride(normalizeDockerPrefsResponse(parsed));
    folderTypePrefs = nextPrefs;
    applyRuntimePrefs(nextPrefs);
    queueDockerRuntimePrivacyServerReconcile(nextPrefs);
    return nextPrefs;
};

const ensureDockerBootstrapPrefs = (options = {}) => {
    const forceRefresh = options?.forceRefresh === true;
    if (!forceRefresh && lastAppliedRuntimePrefs && typeof lastAppliedRuntimePrefs === 'object' && Object.keys(lastAppliedRuntimePrefs).length > 0) {
        return Promise.resolve(lastAppliedRuntimePrefs);
    }
    if (!forceRefresh && dockerBootstrapPrefsPromise) {
        return dockerBootstrapPrefsPromise;
    }
    dockerBootstrapPrefsPromise = Promise.resolve()
        .then(() => fetchDockerBootstrapPrefs())
        .catch(() => utils.normalizePrefs(folderTypePrefs || {}))
        .finally(() => {
            dockerBootstrapPrefsPromise = null;
        });
    return dockerBootstrapPrefsPromise;
};

const ensureDockerFolderReqForHostRender = (options = {}) => {
    const hasReusableBundle = folderReq
        && folderReq.consumed !== true
        && Array.isArray(folderReq.render)
        && folderReq.render.length >= 4;
    if (options?.forceRefresh === true || !hasReusableBundle) {
        folderReq = buildDockerFolderReq({
            liveUpdateStatus: isDockerHostUpdateSyncSuspended()
        });
    }
    return folderReq;
};

const resolveDockerBootstrapPrefsFromRequestBundle = async (requestBundle) => {
    const prefsRequest = requestBundle?.render?.[3];
    if (!prefsRequest) {
        return ensureDockerBootstrapPrefs();
    }
    try {
        const payload = await Promise.resolve(prefsRequest);
        const parsed = typeof payload === 'string' ? parseJsonPayloadSafe(payload) : payload;
        const nextPrefs = applyDockerPinnedFolderPrefsOverride(normalizeDockerPrefsResponse(parsed || {}));
        folderTypePrefs = nextPrefs;
        applyRuntimePrefs(nextPrefs);
        queueDockerRuntimePrivacyServerReconcile(nextPrefs);
        return nextPrefs;
    } catch (_error) {
        return ensureDockerBootstrapPrefs();
    }
};

const unmountDockerCommandView = () => {
    const commandViewApi = getDockerCommandViewApi();
    if (commandViewApi && typeof commandViewApi.unmount === 'function') {
        commandViewApi.unmount();
    }
};

const readDockerContainerNameFromHostRow = (row) => {
    if (!(row instanceof HTMLElement)) {
        return '';
    }
    const rawId = String(row.id || '').trim();
    if (rawId.startsWith('ct-')) {
        const nameFromId = rawId.slice(3).trim();
        if (nameFromId) {
            return nameFromId;
        }
    }
    return String($(row).find('td.ct-name .appname').first().text() || '').trim();
};

const normalizeDockerNativeHostOrder = (payload) => {
    const parsed = typeof payload === 'string' ? parseJsonPayloadSafe(payload) : payload;
    const values = parsed && typeof parsed === 'object' ? Object.values(parsed) : [];
    const seen = new Set();
    return values
        .map((entry) => String(entry || '').trim())
        .filter((entry) => {
            if (!entry || folderRegex.test(entry) || seen.has(entry)) {
                return false;
            }
            seen.add(entry);
            return true;
        });
};

const restoreDockerNativeHostList = async (requestBundle = null) => {
    const tbody = document.querySelector('tbody#docker_list') || document.querySelector('tbody#docker_view');
    if (!(tbody instanceof HTMLElement)) {
        return { restoredRows: 0, removedFolders: 0 };
    }

    const allRows = Array.from(tbody.querySelectorAll('tr'));
    const folderRows = allRows.filter((row) => row instanceof HTMLElement && row.classList.contains('folder'));
    const containerRows = allRows.filter((row) => (
        row instanceof HTMLElement
        && !row.classList.contains('folder')
        && (row.id.startsWith('ct-') || row.classList.contains('folder-element') || !!row.querySelector('td.ct-name .appname'))
    ));
    const rowsByName = new Map();
    const duplicateRows = [];
    const unnamedRows = [];
    containerRows.forEach((row) => {
        const name = readDockerContainerNameFromHostRow(row);
        if (!name) {
            unnamedRows.push(row);
            return;
        }
        if (rowsByName.has(name)) {
            const existingRow = rowsByName.get(name);
            const existingIsNativeDirectRow = existingRow?.parentElement === tbody;
            const currentIsNativeDirectRow = row.parentElement === tbody;
            if (currentIsNativeDirectRow && !existingIsNativeDirectRow) {
                duplicateRows.push(existingRow);
                rowsByName.set(name, row);
            } else {
                duplicateRows.push(row);
            }
            return;
        }
        rowsByName.set(name, row);
    });

    let nativeOrder = [];
    try {
        const orderPayload = requestBundle?.render?.[1]
            ? await Promise.resolve(requestBundle.render[1])
            : null;
        nativeOrder = normalizeDockerNativeHostOrder(orderPayload);
    } catch (_error) {
        nativeOrder = [];
    }

    const orderedRows = [];
    nativeOrder.forEach((name) => {
        const row = rowsByName.get(name);
        if (!row) {
            return;
        }
        orderedRows.push(row);
        rowsByName.delete(name);
    });
    containerRows.forEach((row) => {
        const name = readDockerContainerNameFromHostRow(row);
        if (name && rowsByName.get(name) === row) {
            orderedRows.push(row);
            rowsByName.delete(name);
        }
    });
    unnamedRows.forEach((row) => orderedRows.push(row));

    orderedRows.forEach((row) => {
        Array.from(row.classList).forEach((className) => {
            if (/^folder-.+-element$/.test(className)) {
                row.classList.remove(className);
            }
        });
        row.classList.remove(
            'folder-element',
            'fv-nested-hidden',
            'fv-folder-focus-hidden',
            'fv-toolbar-filter-hidden'
        );
        row.classList.add('sortable');
        row.style.removeProperty('display');
        $(row).children('td').children('i.fa-arrows-v').remove();
    });

    const fragment = document.createDocumentFragment();
    orderedRows.forEach((row) => fragment.appendChild(row));
    duplicateRows.forEach((row) => row.remove());
    folderRows.forEach((row) => row.remove());
    tbody.appendChild(fragment);
    document.body.classList.remove('fv-folder-focus-active');
    if (folderobserver) {
        folderobserver.disconnect();
        folderobserver = undefined;
    }
    refreshDockerRuntimeSortableRows();
    queueDockerRuntimeResizerBind();
    scheduleDockerRuntimeWidthReflow('host-list-restore', 0);
    appendDockerRequestBundleTrace('host-list-restored', {
        restoredRows: orderedRows.length,
        removedFolders: folderRows.length,
        removedDuplicateRows: duplicateRows.length,
        nativeOrderCount: nativeOrder.length
    });
    return {
        restoredRows: orderedRows.length,
        removedFolders: folderRows.length,
        removedDuplicateRows: duplicateRows.length
    };
};

const unmountDockerIsolatedViews = (exceptMode = '') => {
    if (exceptMode !== 'command') {
        unmountDockerCommandView();
    }
};

const queueDockerRuntimeRenderForPageViewMode = (options = {}) => {
    const widthBootstrapGeneration = beginDockerRuntimeWidthBootstrap();
    dockerRuntimeWidthState.pendingRenderGeneration = widthBootstrapGeneration;
    const releaseWidthBootstrap = () => {
        if (dockerRuntimeWidthState.pendingRenderGeneration === widthBootstrapGeneration) {
            dockerRuntimeWidthState.pendingRenderGeneration = 0;
        }
        completeDockerRuntimeWidthBootstrap(widthBootstrapGeneration, {
            stabilize: false,
            reflow: false
        });
    };
    const requestBundle = ensureDockerFolderReqForHostRender({
        forceRefresh: options?.forceRefresh === true
    });
    const appliedPrefs = options?.preferAppliedPrefs === true
        && lastAppliedRuntimePrefs
        && typeof lastAppliedRuntimePrefs === 'object'
        ? Promise.resolve(lastAppliedRuntimePrefs)
        : resolveDockerBootstrapPrefsFromRequestBundle(requestBundle);
    return Promise.resolve()
        .then(() => appliedPrefs)
        .then((prefs) => {
            const mode = resolveDockerPageViewMode(prefs);
            if (mode === 'host') {
                unmountDockerIsolatedViews();
                requestBundle.consumed = true;
                releaseWidthBootstrap();
                markDockerFatalBannerStep('Docker host list mode active');
                recordDockerFatalBannerAction('Docker host list mode active');
                return Promise.resolve(restoreDockerNativeHostList(requestBundle))
                    .catch((error) => {
                        appendDockerRequestBundleTrace('host-list-restore-failed', {
                            message: String(error?.message || error || 'Unknown Host list restoration error')
                        });
                    })
                    .finally(() => {
                        dockerHostLoadOwnsLoadingUi = false;
                        activeDockerRenderSuppressLoadingUi = false;
                        nextDockerRenderSuppressLoadingUi = false;
                        hideDockerRuntimeLoadingOverlay();
                        hideDockerRuntimeLoadingRow();
                    });
            } else if (mode === 'command') {
                unmountDockerIsolatedViews('command');
                releaseWidthBootstrap();
                markDockerFatalBannerStep('Docker command view active');
                recordDockerFatalBannerAction('Docker command view active');
                const commandViewApi = getDockerCommandViewApi();
                if (commandViewApi && typeof commandViewApi.mount === 'function') {
                    return commandViewApi.mount({
                        suppressLoadingUi: isDockerHostUpdateSyncSuspended()
                    });
                }
                markDockerFatalBannerStep('Docker command view unavailable, falling back to host list');
                recordDockerFatalBannerAction('Docker command view unavailable');
                return;
            }
            unmountDockerIsolatedViews();
            dockerHostLoadOwnsLoadingUi = true;
            queueCreateFoldersRender();
        })
        .catch(() => {
            unmountDockerIsolatedViews();
            ensureDockerFolderReqForHostRender();
            dockerHostLoadOwnsLoadingUi = true;
            queueCreateFoldersRender();
        })
        .finally(() => renderDockerRuntimeActionBar(resolveDockerPageViewMode()));
};

const saveDockerRuntimeToolbarPrefs = async (patch, currentPrefs) => {
    if (dockerPrefsCoordinator) {
        return dockerPrefsCoordinator.save('docker', patch, {
            currentPrefs,
            immediate: true
        });
    }
    const response = await pluginRequestClient.postJson('/plugins/folderview.plus/server/prefs.php', {
        type: 'docker',
        prefs: JSON.stringify(patch || {})
    });
    assertDockerPrefsSaveResponse(response, 'Failed to save Docker view preferences.');
    return utils.normalizePrefs(response?.prefs || currentPrefs || {});
};
const dockerRuntimeActionBarModule = window.FolderViewPlusDockerRuntimeActionBar;
if (dockerRuntimeActionBarModule && typeof dockerRuntimeActionBarModule.createApi === 'function') {
    dockerRuntimeActionBarApi = dockerRuntimeActionBarModule.createApi({
        window,
        document,
        hostAdapter: dockerHostAdapter,
        utils,
        escapeHtml,
        normalizePageViewMode: normalizeDockerPageViewMode,
        resolvePageViewMode: resolveDockerPageViewMode,
        getPrefs: () => folderTypePrefs || {},
        setPrefs: (prefs) => { folderTypePrefs = utils.normalizePrefs(prefs || {}); },
        applyPrefs: (prefs) => applyRuntimePrefs(prefs),
        savePrefs: saveDockerRuntimeToolbarPrefs,
        refreshRuntimeView: () => {
            queueLoadlistRefresh({ suppressLoadingUi: true });
            return Promise.resolve();
        },
        getFolders: () => globalFolders || {},
        getScopedContainers: (id) => getScopedRuntimeContainersForFolder(id, true),
        readFolderIdFromRow,
        readFolderOwnerFromRow,
        getFolderAncestors,
        getFolderDescendants,
        applyFocusedFolderState: () => applyDockerFocusedFolderState(),
        getFocusedFolderId: () => dockerFocusedFolderId,
        clearFocusedFolder: () => {
            dockerRuntimeStateStore.set({ focusedFolderId: '' });
            dockerFocusedFolderId = '';
        },
        scheduleWidthReflow: (reason, delayMs) => scheduleDockerRuntimeWidthReflow(reason, delayMs),
        buildFolderHierarchy,
        expandFolderBranch,
        collapseFolderBranch,
        createFolder: () => createFolderBtn(),
        showError: (message) => swal({
            title: 'FolderView action failed',
            text: escapeHtml(String(message || 'The action could not be completed.')),
            type: 'error',
            html: true,
            confirmButtonText: 'OK'
        })
    });
}
window.FolderViewPlusDockerRuntimeInternals = Object.assign(window.FolderViewPlusDockerRuntimeInternals || {}, {
    buildDockerIsolatedViewDeps,
    getDockerCommandViewApi,
    restoreDockerNativeHostList,
    fetchDockerBootstrapPrefs,
    ensureDockerBootstrapPrefs,
    unmountDockerIsolatedViews,
    queueDockerRuntimeRenderForPageViewMode,
    summarizeDockerRuntimeToolbarState: () => dockerRuntimeActionBarApi?.summarize() || {},
    applyDockerRuntimeToolbarFilterState,
    renderDockerRuntimeActionBar,
    setDockerRuntimePageViewMode: (mode) => dockerRuntimeActionBarApi?.setPageViewMode(mode)
});
const syncDockerVisibleFoldersFromRuntimeCache = (changedNames = null) => {
    dockerDeferredPreviewController.flush();
    const changedSet = changedNames instanceof Set
        ? changedNames
        : (Array.isArray(changedNames) ? new Set(changedNames.map((name) => String(name || '').trim()).filter(Boolean)) : null);
    const runtimeInfoApi = getDockerRuntimeInfoApi();
    const previewActionsApi = getDockerPreviewActionsApi();
    if (runtimeInfoApi && previewActionsApi && typeof runtimeInfoApi.buildRuntimeContainerEntry === 'function' && typeof previewActionsApi.syncDockerRuntimeRows === 'function') {
        const runtimeRows = {};
        const names = changedSet ? Array.from(changedSet) : Object.keys(dockerRuntimeInfoByName || {});
        names.forEach((name) => {
            runtimeRows[name] = runtimeInfoApi.buildRuntimeContainerEntry(name);
        });
        previewActionsApi.syncDockerRuntimeRows(runtimeRows, changedSet);
    }
    let patchedFolderCount = 0;
    Object.entries(globalFolders || {}).forEach(([id, folder]) => {
        if (!folder || typeof folder !== 'object') {
            return;
        }
        const runtimeContainers = folderHasChildren(id)
            ? buildRuntimeContainerMapForFolder(id, true)
            : getFolderRuntimeContainers(folder);
        if (changedSet && !Object.keys(runtimeContainers).some((name) => changedSet.has(name))) {
            return;
        }
        folder.runtimeContainers = runtimeContainers;
        syncDockerFolderMemberRows(id, runtimeContainers, changedSet);
        if (folderHasChildren(id)) {
            syncParentFolderVisualState(id, folder?.status?.expanded === true);
        } else {
            syncDockerLeafFolderPreviewActions(id, folder, runtimeContainers, changedSet);
        }
        updateFolderRowStatusFromContainers(id, folder, runtimeContainers);
        patchedFolderCount += 1;
    });
    renderRuntimeHealthBadge(globalFolders, folderTypePrefs);
    refreshDockerFolderQuickActionStates();
    applyDockerFocusedFolderState();
    applyDockerRuntimeToolbarFilterState();
    renderDockerRuntimeActionBar(resolveDockerPageViewMode());
    refreshDockerPreviewTooltipContent(changedSet);
    dockerRuntimeStateStore.set({
        rowReconciliation: {
            mode: changedSet ? 'incremental' : 'full-cache-sync',
            changedRows: changedSet ? changedSet.size : Object.keys(dockerRuntimeInfoByName || {}).length,
            patchedFolders: patchedFolderCount,
            capturedAt: new Date().toISOString()
        }
    });
    queueDockerSupportBundlePageSnapshot('runtime-sync');
};

const readDockerListViewMode = () => ($.cookie('docker_listview_mode') == 'advanced' ? 'advanced' : 'basic');
const DOCKER_RUNTIME_PRIVACY_TOGGLE_ID = 'fvplus-docker-runtime-privacy-toggle';
const DOCKER_RUNTIME_PRIVACY_TOGGLE_SHELL_ID = 'fvplus-docker-runtime-privacy-shell';
const DOCKER_RUNTIME_PRIVACY_TOGGLE_FALLBACK_HOST_ID = 'fvplus-docker-runtime-toolbar-controls';
const DOCKER_RUNTIME_PRIVACY_MENU_BUTTON_ID = 'fvplus-docker-runtime-privacy-menu-button';
const DOCKER_RUNTIME_PRIVACY_MENU_ID = 'fvplus-docker-runtime-privacy-menu';
const DOCKER_RUNTIME_PRIVACY_MODE_STORAGE_KEY = 'fvplus.runtime.privacy.docker.v1';
const DOCKER_RUNTIME_PRIVACY_OPTION_DEFINITIONS = Object.freeze([
    Object.freeze({ key: 'privacyMaskNames', label: 'Mask names and icons', i18nKey: 'docker.privacy.mask-names' }),
    Object.freeze({ key: 'privacyMaskLocalIps', label: 'Mask LAN IPs', i18nKey: 'docker.privacy.mask-lan-ips' }),
    Object.freeze({ key: 'privacyMaskPorts', label: 'Mask ports', i18nKey: 'docker.privacy.mask-ports' }),
    Object.freeze({ key: 'privacyMaskVolumePaths', label: 'Mask volume paths', i18nKey: 'docker.privacy.mask-volume-paths' }),
    Object.freeze({ key: 'privacyMaskImageRegistry', label: 'Mask image registries', i18nKey: 'docker.privacy.mask-image-registries' }),
    Object.freeze({ key: 'privacyMaskPublicIps', label: 'Mask public IPs', i18nKey: 'docker.privacy.mask-public-ips' }),
    Object.freeze({ key: 'privacyMaskInterfaces', label: 'Mask network interfaces', i18nKey: 'docker.privacy.mask-network-interfaces' }),
    Object.freeze({ key: 'privacyMaskExternalUrls', label: 'Mask external URLs', i18nKey: 'docker.privacy.mask-external-urls' })
]);
const DOCKER_RUNTIME_PRIVACY_OPTION_KEYS = new Set(DOCKER_RUNTIME_PRIVACY_OPTION_DEFINITIONS.map((option) => option.key));
const DOCKER_LEGACY_HOST_BOOTSTRAP_RENDER_COMPAT = false;
let dockerRuntimePrivacyToggleMountQueued = false;
let dockerRuntimePrivacyPersistPromise = null;
let dockerRuntimePrivacyPendingEnabled = null;
let dockerRuntimePrivacyPersistedPrefs = null;
let dockerRuntimePrivacyServerReconcileTimer = null;
let dockerRuntimePrivacyStorageSyncBound = false;
let dockerRuntimePrivacyMenuOpen = false;
let dockerRuntimePrivacyMenuEventsBound = false;
let dockerRuntimePrivacyToggleApi = null;

const readStoredDockerRuntimePrivacyMode = () => {
    try {
        const raw = String(window.localStorage?.getItem(DOCKER_RUNTIME_PRIVACY_MODE_STORAGE_KEY) ?? '').trim().toLowerCase();
        if (['1', 'true', 'on'].includes(raw)) {
            return true;
        }
        if (['0', 'false', 'off'].includes(raw)) {
            return false;
        }
    } catch (_error) {
    }
    return null;
};

const writeStoredDockerRuntimePrivacyMode = (enabled) => {
    try {
        window.localStorage?.setItem(DOCKER_RUNTIME_PRIVACY_MODE_STORAGE_KEY, enabled === true ? '1' : '0');
    } catch (_error) {
    }
};

const resolveDockerRuntimePrivacyMode = (prefs = null) => {
    const stored = readStoredDockerRuntimePrivacyMode();
    if (stored !== null) {
        return stored;
    }
    return utils.normalizePrefs(prefs || folderTypePrefs || {}).dashboard?.privacyMode === true;
};

const readDockerRuntimePrivacyMode = () => resolveDockerRuntimePrivacyMode(folderTypePrefs);

const buildDockerRuntimePrivacyPrefsPayload = (enabled, prefsOverride = null) => {
    const current = utils.normalizePrefs(prefsOverride || folderTypePrefs || {});
    return utils.normalizePrefs({
        ...current,
        dashboard: {
            ...(current.dashboard || {}),
            privacyMode: enabled === true
        }
    });
};

const persistDockerRuntimePrivacyMode = async (enabled, prefsOverride = null) => {
    const nextPrefs = buildDockerRuntimePrivacyPrefsPayload(enabled, prefsOverride);
    if (dockerPrefsCoordinator) {
        const prefs = await dockerPrefsCoordinator.save('docker', {
            dashboard: {
                privacyMode: enabled === true
            }
        }, {
            currentPrefs: nextPrefs,
            immediate: true
        });
        if (prefs.dashboard?.privacyMode !== (enabled === true)) {
            throw new Error('Docker privacy mode did not persist.');
        }
        return { ok: true, prefs };
    }
    const payload = {
        type: 'docker',
        prefs: JSON.stringify({
            dashboard: nextPrefs.dashboard
        })
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
        }
    }
    if (!response) {
        response = await pluginRequestClient.postJson('/plugins/folderview.plus/server/prefs.php', payload);
    }
    assertDockerPrefsSaveResponse(response, 'Failed to save Docker privacy mode.');
    if (!response?.prefs || typeof response.prefs !== 'object' || Array.isArray(response.prefs)) {
        throw new Error('Docker privacy mode save returned no preferences.');
    }
    const savedPrefs = utils.normalizePrefs(response.prefs);
    if (savedPrefs.dashboard?.privacyMode !== (enabled === true)) {
        throw new Error('Docker privacy mode did not persist.');
    }
    return {
        ...response,
        prefs: savedPrefs
    };
};

const queueDockerRuntimePrivacyServerReconcile = (prefsOverride = null, delayMs = 420) => {
    const stored = readStoredDockerRuntimePrivacyMode();
    if (stored === null) {
        return;
    }
    const current = utils.normalizePrefs(prefsOverride || folderTypePrefs || {});
    if (current.dashboard?.privacyMode === stored) {
        return;
    }
    if (dockerRuntimePrivacyServerReconcileTimer) {
        clearTimeout(dockerRuntimePrivacyServerReconcileTimer);
    }
    dockerRuntimePrivacyServerReconcileTimer = setTimeout(async () => {
        dockerRuntimePrivacyServerReconcileTimer = null;
        const targetStored = readStoredDockerRuntimePrivacyMode();
        if (targetStored === null || current.dashboard?.privacyMode === targetStored) {
            return;
        }
        if (dockerRuntimePrivacyPersistPromise || dockerRuntimePrivacyPendingEnabled !== null) {
            queueDockerRuntimePrivacyServerReconcile(folderTypePrefs, 700);
            return;
        }
        try {
            const response = await persistDockerRuntimePrivacyMode(targetStored, current);
            folderTypePrefs = utils.normalizePrefs(response.prefs);
            dockerRuntimePrivacyPersistedPrefs = folderTypePrefs;
            applyRuntimePrefs(folderTypePrefs);
        } catch (_error) {
            // Browser state remains authoritative. The next hydrated Docker
            // bootstrap retries server reconciliation.
        }
    }, Math.max(0, Number(delayMs) || 0));
};

const bindDockerRuntimePrivacyStorageSync = () => {
    if (dockerRuntimePrivacyStorageSyncBound || typeof window?.addEventListener !== 'function') {
        return;
    }
    dockerRuntimePrivacyStorageSyncBound = true;
    window.addEventListener('storage', (event) => {
        if (String(event?.key || '') !== DOCKER_RUNTIME_PRIVACY_MODE_STORAGE_KEY) {
            return;
        }
        applyRuntimePrefs(folderTypePrefs);
        queueDockerRuntimePrivacyServerReconcile(folderTypePrefs, 120);
    });
};

const findDockerRuntimeListViewToggleAnchor = () => {
    const table = dockerHostAdapter?.getTable?.();
    if (!table) {
        return null;
    }
    const scopes = [
        table.parentElement,
        table.parentElement?.parentElement,
        document.body
    ].filter(Boolean);
    const switchSelector = 'input[type="checkbox"], .switch-button, .switch-button-background';
    for (const scope of scopes) {
        const switches = Array.from(scope.querySelectorAll(switchSelector));
        for (const toggleNode of switches) {
            const candidates = [
                toggleNode.closest('label'),
                toggleNode.closest('span'),
                toggleNode.closest('div'),
                toggleNode.parentElement,
                toggleNode.parentElement?.parentElement
            ].filter(Boolean);
            for (const candidate of candidates) {
                const text = String(candidate.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
                if (!text.includes('basic view')) {
                    continue;
                }
                return candidate;
            }
        }
    }
    return null;
};

const ensureDockerRuntimePrivacyFallbackHost = () => {
    const table = dockerHostAdapter?.getTable?.();
    const mountRoot = table?.parentElement;
    if (!mountRoot) {
        return null;
    }
    let host = document.getElementById(DOCKER_RUNTIME_PRIVACY_TOGGLE_FALLBACK_HOST_ID);
    if (!host) {
        host = document.createElement('div');
        host.id = DOCKER_RUNTIME_PRIVACY_TOGGLE_FALLBACK_HOST_ID;
        host.className = 'fvplus-docker-runtime-toolbar-controls';
    }
    if (host.parentElement !== mountRoot) {
        mountRoot.insertBefore(host, table);
    } else if (host.nextElementSibling !== table) {
        mountRoot.insertBefore(host, table);
    }
    return host;
};

const resolveDockerRuntimePrivacyToggleMount = () => {
    const anchor = findDockerRuntimeListViewToggleAnchor();
    if (anchor && anchor.parentElement) {
        return {
            anchor,
            host: anchor.parentElement,
            fallback: false
        };
    }
    const fallbackHost = ensureDockerRuntimePrivacyFallbackHost();
    if (!fallbackHost) {
        return null;
    }
    return {
        anchor: null,
        host: fallbackHost,
        fallback: true
    };
};

const setDockerRuntimePrivacyMenuOpen = (open, options = {}) => {
    dockerRuntimePrivacyMenuOpen = open === true;
    const button = document.getElementById(DOCKER_RUNTIME_PRIVACY_MENU_BUTTON_ID);
    const menu = document.getElementById(DOCKER_RUNTIME_PRIVACY_MENU_ID);
    button?.setAttribute('aria-expanded', dockerRuntimePrivacyMenuOpen ? 'true' : 'false');
    button?.classList.toggle('is-open', dockerRuntimePrivacyMenuOpen);
    if (menu) {
        menu.hidden = !dockerRuntimePrivacyMenuOpen;
    }
    if (dockerRuntimePrivacyMenuOpen && options.focusFirst === true) {
        menu?.querySelector('input[type="checkbox"]')?.focus();
    }
};

const bindDockerRuntimePrivacyMenuEvents = () => {
    if (dockerRuntimePrivacyMenuEventsBound || typeof document?.addEventListener !== 'function') {
        return;
    }
    dockerRuntimePrivacyMenuEventsBound = true;
    document.addEventListener('click', (event) => {
        if (!dockerRuntimePrivacyMenuOpen) {
            return;
        }
        const shell = document.getElementById(DOCKER_RUNTIME_PRIVACY_TOGGLE_SHELL_ID);
        if (!shell?.contains(event.target)) {
            setDockerRuntimePrivacyMenuOpen(false);
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || !dockerRuntimePrivacyMenuOpen) {
            return;
        }
        setDockerRuntimePrivacyMenuOpen(false);
        document.getElementById(DOCKER_RUNTIME_PRIVACY_MENU_BUTTON_ID)?.focus();
    });
};

const buildDockerRuntimePrivacyMenuOptionsHtml = (prefs = null) => {
    const dashboard = utils.normalizePrefs(prefs || folderTypePrefs || {}).dashboard || {};
    return DOCKER_RUNTIME_PRIVACY_OPTION_DEFINITIONS.map((option) => `
        <label class="fvplus-docker-runtime-privacy-option">
            <input
                type="checkbox"
                data-fvplus-privacy-option="${escapeHtml(option.key)}"
                ${dashboard[option.key] !== false ? 'checked' : ''}
            >
            <span>${escapeHtml(dockerT(option.i18nKey, option.label))}</span>
        </label>
    `).join('');
};

const persistDockerRuntimePrivacyMaskPreference = async (key, enabled, prefsOverride = null) => {
    if (!DOCKER_RUNTIME_PRIVACY_OPTION_KEYS.has(key)) {
        throw new Error('Unknown Docker privacy option.');
    }
    const current = utils.normalizePrefs(prefsOverride || folderTypePrefs || {});
    const nextPrefs = utils.normalizePrefs({
        ...current,
        dashboard: {
            ...(current.dashboard || {}),
            [key]: enabled === true
        }
    });
    if (dockerPrefsCoordinator) {
        const savedPrefs = await dockerPrefsCoordinator.save('docker', {
            dashboard: {
                [key]: enabled === true
            }
        }, {
            currentPrefs: nextPrefs,
            immediate: true
        });
        return utils.normalizePrefs(savedPrefs || nextPrefs);
    }
    const payload = {
        type: 'docker',
        prefs: JSON.stringify({
            dashboard: {
                [key]: enabled === true
            }
        })
    };
    const request = window.FolderViewPlusRequest;
    let response = null;
    if (request && typeof request.postJson === 'function') {
        response = await request.postJson('/plugins/folderview.plus/server/prefs.php', payload, {
            retries: 0,
            retryDelayMs: 260
        });
    } else {
        response = await pluginRequestClient.postJson('/plugins/folderview.plus/server/prefs.php', payload);
    }
    assertDockerPrefsSaveResponse(response, 'Failed to save Docker privacy option.');
    const savedPrefs = utils.normalizePrefs(response?.prefs || nextPrefs);
    if (savedPrefs.dashboard?.[key] !== (enabled === true)) {
        throw new Error('Docker privacy option did not persist.');
    }
    return savedPrefs;
};

const setDockerRuntimePrivacyMaskPreference = async (key, enabled) => {
    if (!DOCKER_RUNTIME_PRIVACY_OPTION_KEYS.has(key)) {
        return;
    }
    const current = utils.normalizePrefs(folderTypePrefs || {});
    folderTypePrefs = utils.normalizePrefs({
        ...current,
        dashboard: {
            ...(current.dashboard || {}),
            [key]: enabled === true
        }
    });
    applyRuntimePrefs(folderTypePrefs);
    try {
        folderTypePrefs = await persistDockerRuntimePrivacyMaskPreference(key, enabled, folderTypePrefs);
        dockerRuntimePrivacyPersistedPrefs = folderTypePrefs;
        applyRuntimePrefs(folderTypePrefs);
    } catch (error) {
        applyRuntimePrefs(folderTypePrefs);
        swal({
            title: 'Privacy option sync pending',
            text: `${escapeHtml(String(error?.message || 'FolderView Plus could not sync this privacy option.'))}<br>The change remains active and will retry through the preference outbox.`,
            type: 'warning',
            html: true,
            confirmButtonText: 'OK'
        });
    }
};

const buildDockerRuntimePrivacyToggleMarkup = (state = {}) => {
    const enabled = state.enabled === true;
    const savePending = state.pending === true;
    const menuOpen = state.menuOpen === true;
    const menuOptionsHtml = buildDockerRuntimePrivacyMenuOptionsHtml({
        dashboard: state.options || {}
    });
    return `
        <span class="fvplus-docker-runtime-toggle-label">${escapeHtml(dockerT('docker.privacy.label', 'Privacy'))}</span>
        <input id="${DOCKER_RUNTIME_PRIVACY_TOGGLE_ID}" class="basic-switch fvplus-docker-runtime-privacy-switch" type="checkbox" aria-label="${escapeHtml(dockerT('docker.privacy.label', 'Privacy'))}" ${enabled ? 'checked' : ''} ${savePending ? 'disabled' : ''}>
        <button
            id="${DOCKER_RUNTIME_PRIVACY_MENU_BUTTON_ID}"
            class="fvplus-docker-runtime-privacy-menu-button${menuOpen ? ' is-open' : ''}"
            type="button"
            aria-label="${escapeHtml(dockerT('docker.privacy.options', 'Privacy options'))}"
            aria-haspopup="dialog"
            aria-expanded="${menuOpen ? 'true' : 'false'}"
            aria-controls="${DOCKER_RUNTIME_PRIVACY_MENU_ID}"
            title="${escapeHtml(dockerT('docker.privacy.options', 'Privacy options'))}"
        ><i class="fa fa-sliders" aria-hidden="true"></i><i class="fa fa-chevron-down" aria-hidden="true"></i></button>
        <div
            id="${DOCKER_RUNTIME_PRIVACY_MENU_ID}"
            class="fvplus-docker-runtime-privacy-menu"
            role="dialog"
            aria-label="${escapeHtml(dockerT('docker.privacy.dialog-label', 'Docker privacy options'))}"
            ${menuOpen ? '' : 'hidden'}
        >
            <div class="fvplus-docker-runtime-privacy-menu-heading">${escapeHtml(dockerT('docker.privacy.title', 'Privacy mode'))}</div>
            <div class="fvplus-docker-runtime-privacy-menu-help">${escapeHtml(dockerT('docker.privacy.description', 'Choose what is hidden while Privacy is enabled.'))}</div>
            <div class="fvplus-docker-runtime-privacy-menu-options">${menuOptionsHtml}</div>
        </div>
    `;
};

const getDockerRuntimePrivacyToggleApi = () => {
    if (dockerRuntimePrivacyToggleApi) {
        return dockerRuntimePrivacyToggleApi;
    }
    dockerRuntimePrivacyToggleApi = dockerRuntimeShared.createStableToggleController({
        window,
        document,
        jquery: $,
        shellId: DOCKER_RUNTIME_PRIVACY_TOGGLE_SHELL_ID,
        inputId: DOCKER_RUNTIME_PRIVACY_TOGGLE_ID,
        menuButtonId: DOCKER_RUNTIME_PRIVACY_MENU_BUTTON_ID,
        menuId: DOCKER_RUNTIME_PRIVACY_MENU_ID,
        optionAttribute: 'data-fvplus-privacy-option',
        resolveMount: () => resolveDockerRuntimePrivacyToggleMount(),
        prepareMount: (mount) => {
            document.querySelectorAll('.fvplus-docker-runtime-toggle-cluster').forEach((host) => {
                if (host !== mount.host) {
                    host.classList.remove('fvplus-docker-runtime-toggle-cluster');
                }
            });
            mount.host.classList.toggle('fvplus-docker-runtime-toggle-cluster', Boolean(mount.anchor));
        },
        getState: () => {
            const dashboard = utils.normalizePrefs(folderTypePrefs || {}).dashboard || {};
            return {
                enabled: readDockerRuntimePrivacyMode(),
                pending: dockerRuntimePrivacyPersistPromise !== null,
                menuOpen: dockerRuntimePrivacyMenuOpen,
                options: dashboard
            };
        },
        getShellClass: (mount) => `fvplus-docker-runtime-toggle-shell${mount.anchor ? ' is-inline-cluster' : ''}${mount.fallback ? ' is-fallback' : ''}`,
        buildMarkup: (state) => buildDockerRuntimePrivacyToggleMarkup(state),
        initializePrimary: (input, state) => {
            const $input = $(input);
            if (typeof $input.switchButton !== 'function') {
                return;
            }
            $input.switchButton({
                labels_placement: 'right',
                off_label: '',
                on_label: '',
                checked: state.enabled === true
            });
        },
        onToggle: (enabled) => setDockerRuntimePrivacyMode(enabled),
        onMenuToggle: () => setDockerRuntimePrivacyMenuOpen(!dockerRuntimePrivacyMenuOpen),
        onOptionToggle: (key, enabled) => setDockerRuntimePrivacyMaskPreference(key, enabled),
        onMount: () => bindDockerRuntimePrivacyMenuEvents(),
        onError: (error) => {
            if (FOLDER_VIEW_DEBUG_MODE) {
                console.warn('[FV3_DEBUG] Docker privacy toggle interaction failed.', error);
            }
        }
    });
    return dockerRuntimePrivacyToggleApi;
};

const renderDockerRuntimePrivacyToggle = () => {
    try {
        getDockerRuntimePrivacyToggleApi()?.sync();
    } catch (error) {
        reportDockerDegradedRuntimeState(error, {
            code: 'FVPLUS-DKR-PRIVACY-001',
            phase: 'runtime-render',
            category: 'degraded-mode'
        });
    }
};

const queueDockerRuntimePrivacyToggleMount = () => {
    if (dockerRuntimePrivacyToggleMountQueued) {
        return;
    }
    dockerRuntimePrivacyToggleMountQueued = true;
    const flush = () => {
        dockerRuntimePrivacyToggleMountQueued = false;
        renderDockerRuntimePrivacyToggle();
    };
    if (typeof window?.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(flush);
        return;
    }
    setTimeout(flush, 0);
};

const getDockerRuntimePersistedPrefs = () => utils.normalizePrefs(dockerRuntimePrivacyPersistedPrefs || folderTypePrefs || {});

const flushDockerRuntimePrivacyModePersistence = async () => {
    if (dockerRuntimePrivacyPersistPromise) {
        return dockerRuntimePrivacyPersistPromise;
    }
    dockerRuntimePrivacyPersistPromise = (async () => {
        try {
            while (dockerRuntimePrivacyPendingEnabled !== null) {
                const targetEnabled = dockerRuntimePrivacyPendingEnabled === true;
                dockerRuntimePrivacyPendingEnabled = null;
                const response = await persistDockerRuntimePrivacyMode(targetEnabled, folderTypePrefs);
                folderTypePrefs = utils.normalizePrefs(response?.prefs || buildDockerRuntimePrivacyPrefsPayload(targetEnabled));
                dockerRuntimePrivacyPersistedPrefs = folderTypePrefs;
                writeStoredDockerRuntimePrivacyMode(targetEnabled);
                applyRuntimePrefs(folderTypePrefs);
                queueDockerRuntimePrivacyToggleMount();
            }
        } finally {
            dockerRuntimePrivacyPersistPromise = null;
            queueDockerRuntimePrivacyToggleMount();
        }
    })();
    return dockerRuntimePrivacyPersistPromise;
};

const setDockerRuntimePrivacyMode = async (enabled, options = {}) => {
    const nextEnabled = enabled === true;
    const previousPrefs = getDockerRuntimePersistedPrefs();
    const basePrefs = previousPrefs;
    if (dockerRuntimePrivacyServerReconcileTimer) {
        clearTimeout(dockerRuntimePrivacyServerReconcileTimer);
        dockerRuntimePrivacyServerReconcileTimer = null;
    }
    writeStoredDockerRuntimePrivacyMode(nextEnabled);
    const basePrivacyMode = utils.normalizePrefs(basePrefs || {}).dashboard?.privacyMode === true;
    if (basePrivacyMode === nextEnabled && dockerRuntimePrivacyPendingEnabled === null && !dockerRuntimePrivacyPersistPromise) {
        folderTypePrefs = basePrefs;
        applyRuntimePrefs(folderTypePrefs);
        queueDockerRuntimePrivacyToggleMount();
        return;
    }
    dockerRuntimePrivacyPendingEnabled = nextEnabled;
    folderTypePrefs = buildDockerRuntimePrivacyPrefsPayload(nextEnabled, basePrefs);
    applyRuntimePrefs(folderTypePrefs);
    queueDockerRuntimePrivacyToggleMount();
    if (options.persist === false) {
        return;
    }
    try {
        await flushDockerRuntimePrivacyModePersistence();
    } catch (error) {
        dockerRuntimePrivacyPendingEnabled = null;
        folderTypePrefs = buildDockerRuntimePrivacyPrefsPayload(nextEnabled, previousPrefs);
        applyRuntimePrefs(folderTypePrefs);
        queueDockerRuntimePrivacyToggleMount();
        queueDockerRuntimePrivacyServerReconcile(previousPrefs, 1200);
        swal({
            title: 'Privacy sync pending',
            text: `${escapeHtml(String(error?.message || 'FolderView Plus could not sync the Docker privacy toggle.'))}<br>The setting is saved in this browser and server synchronization will retry.`,
            type: 'warning',
            html: true,
            confirmButtonText: 'OK'
        });
    }
};
const emitDockerListViewModeChange = (mode, source = 'cookie-write') => {
    if (typeof window?.dispatchEvent !== 'function' || typeof window?.CustomEvent !== 'function') {
        return;
    }
    window.dispatchEvent(new CustomEvent(DOCKER_LIST_VIEW_MODE_CHANGE_EVENT, {
        detail: {
            mode,
            source: String(source || 'cookie-write').trim() || 'cookie-write'
        }
    }));
};

const bindDockerListViewModeCookieHook = () => {
    if (dockerListViewModeCookieHookBound || typeof $.cookie !== 'function') {
        return;
    }
    const currentCookie = $.cookie;
    if (currentCookie?.__fvplusDockerListViewModePatched === true) {
        dockerListViewModeCookieHookBound = true;
        return;
    }
    const wrappedCookie = function(...args) {
        const result = currentCookie.apply(this, args);
        if (args.length >= 2 && String(args[0] || '').trim() === 'docker_listview_mode') {
            emitDockerListViewModeChange(readDockerListViewMode(), 'cookie-write');
        }
        return result;
    };
    try {
        wrappedCookie.__fvplusDockerListViewModePatched = true;
        wrappedCookie.__fvplusOriginal = currentCookie;
    } catch (_error) {}
    $.cookie = wrappedCookie;
    if (window?.jQuery && window.jQuery.cookie === currentCookie) {
        window.jQuery.cookie = wrappedCookie;
    }
    if (window?.$ && window.$.cookie === currentCookie) {
        window.$.cookie = wrappedCookie;
    }
    dockerListViewModeCookieHookBound = true;
};

const syncDockerListViewModeFromCookie = (source = 'passive') => {
    const nextMode = readDockerListViewMode();
    if (nextMode === lastDockerListViewMode) {
        return;
    }
    lastDockerListViewMode = nextMode;
    appendDockerRequestBundleTrace('listViewModeSync', {
        currentPage: String(location?.pathname || ''),
        mode: nextMode,
        source: String(source || 'passive').trim() || 'passive'
    });
    if (!loadedFolder || !globalFolders || Object.keys(globalFolders).length <= 0) {
        queueDockerRuntimePrivacyToggleMount();
        return;
    }
    syncDockerVisibleFoldersFromRuntimeCache();
    scheduleDockerRuntimeWidthReflow('listview-mode-change', 12);
    queueDockerRuntimePrivacyToggleMount();
};

const startDockerListViewModeObserver = () => {
    bindDockerListViewModeCookieHook();
    if (dockerListViewModeObserverBound) {
        return;
    }
    if (typeof window?.addEventListener === 'function') {
        window.addEventListener(DOCKER_LIST_VIEW_MODE_CHANGE_EVENT, (event) => {
            syncDockerListViewModeFromCookie(event?.detail?.source || 'event');
        });
        window.addEventListener('focus', () => syncDockerListViewModeFromCookie('focus'));
        window.addEventListener('pageshow', () => syncDockerListViewModeFromCookie('pageshow'));
    }
    if (typeof document.addEventListener === 'function') {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden === true) {
                return;
            }
            syncDockerListViewModeFromCookie('visibilitychange');
        });
    }
    dockerListViewModeObserverBound = true;
};

const queueDockerDeferredRuntimeInfoHydration = (generation, stateSignature, fullInfoSource = null) => {
    const hydrationStartedAt = (
        typeof performance !== 'undefined' && typeof performance.now === 'function'
            ? performance.now()
            : Date.now()
    );
    const actionGeometryBeforeHydration = captureDockerPreviewActionGeometry();
    markDockerRuntimeLayoutPhase('full-info-requested', {
        generation,
        trackedActionCount: actionGeometryBeforeHydration.size
    });
    const suppliedRequest = typeof fullInfoSource === 'function'
        ? fullInfoSource()
        : fullInfoSource;
    const requestPromise = suppliedRequest && typeof suppliedRequest.then === 'function'
        ? suppliedRequest
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
                lastLiveRefreshStateEntityCount = Object.keys(parsed).length;
            }
            markDockerFatalBannerStep('Docker runtime details hydrated');
            recordDockerFatalBannerAction('Docker runtime details hydrated');
            const hydrationFinishedAt = (
                typeof performance !== 'undefined' && typeof performance.now === 'function'
                    ? performance.now()
                    : Date.now()
            );
            markDockerRuntimeLayoutPhase('full-info-ready', {
                generation: hydrationGeneration,
                durationMs: Math.max(0, hydrationFinishedAt - hydrationStartedAt),
                entityCount: Object.keys(parsed).length
            });
            syncDockerVisibleFoldersFromRuntimeCache();
            const compareGeometry = () => compareDockerPreviewActionGeometry(actionGeometryBeforeHydration);
            if (typeof window.requestAnimationFrame === 'function') {
                window.requestAnimationFrame(compareGeometry);
            } else {
                window.setTimeout(compareGeometry, 0);
            }
        })
        .catch(() => {
            markDockerRuntimeLayoutPhase('full-info-failed', {
                generation: hydrationGeneration
            });
        });
};
const bindDockerPostUpdateRenderReconcile = () => {
    getDockerRuntimeReconcileApi()?.bindPostUpdateRenderReconcile?.();
};
function bindDockerHostOpenDockerPatch() {
    getDockerRuntimeReconcileApi()?.bindHostOpenDockerPatch?.();
}
const bindDockerLifecycleEventControlPatch = () => {
    getDockerRuntimeReconcileApi()?.bindLifecycleEventControlPatch?.();
};
const bindDockerContainerContextStatePatch = () => {
    getDockerRuntimeReconcileApi()?.bindDockerContainerContextStatePatch?.();
};
const armDockerPostUpdateRuntimeReconcileWindow = (durationMs = 0, options = {}) => {
    return getDockerRuntimeReconcileApi()?.armPostUpdateRuntimeReconcileWindow?.(durationMs, options) || 0;
};

let createFoldersInFlight = false;
let createFoldersQueued = false;

/**
 * Handles the creation of all folders
 */
const createFolders = async () => {
    dockerDeferredPreviewController.flush();
    const dockerRuntimeRoot = document.querySelector('#docker_list, #docker_view');
    dockerRuntimePerformanceTelemetry?.observe?.(dockerRuntimeRoot);
    dockerRuntimePerformanceTelemetry?.mark?.('nativeRowsVisible', {
        nativeRowCount: dockerRuntimeRoot?.querySelectorAll?.('tr.sortable:not(.folder)')?.length || 0
    });
    dockerRuntimePerformanceTelemetry?.begin?.('folderGrouping');
    const performanceRenderStartedAt = typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
    dockerPerf.begin('createFolders.total');
    const widthBootstrapGeneration = dockerRuntimeWidthState.pendingRenderGeneration
        || beginDockerRuntimeWidthBootstrap();
    dockerRuntimeWidthState.pendingRenderGeneration = 0;
    let foldersRenderedSuccessfully = false;
    setDockerFatalBannerPhase('bootstrap-data');
    try {
    ensureDockerExpandedStateLifecycleHooks();
    markDockerFatalBannerStep('Docker runtime lifecycle hooks ready');
    persistDockerExpandedStateFromDom();
    activeDockerRenderSuppressLoadingUi = nextDockerRenderSuppressLoadingUi;
    nextDockerRenderSuppressLoadingUi = false;
    showDockerRuntimeLoadingOverlay();
    showDockerRuntimeLoadingRow();
    const previousFolders = (globalFolders && typeof globalFolders === 'object') ? globalFolders : {};
    const requestBundle = (folderReq && typeof folderReq === 'object') ? folderReq : { render: [], fullInfo: null, generation: dockerBootstrapGeneration };
    requestBundle.consumed = true;
    const renderRequests = Array.isArray(requestBundle.render) ? requestBundle.render : [];
    const renderGeneration = Number(requestBundle.generation || dockerBootstrapGeneration || 0);
    dockerRuntimeLastRenderGeneration = renderGeneration;
    dockerPerf.begin('createFolders.requests');
    const prom = await Promise.all(renderRequests);
    dockerPerf.end('createFolders.requests', { requestCount: renderRequests.length });
    markDockerFatalBannerStep('Docker runtime request bundle resolved');

    // Parse the results
    let folders = JSON.parse(prom[0]);
    let unraidOrder = Object.values(JSON.parse(prom[1]));
    const containersStateInfo = parseJsonPayloadSafe(prom[2]);
    let containersInfo = normalizeDockerRuntimeInfoMap(containersStateInfo, dockerRuntimeInfoByName);
    dockerRuntimeInfoByName = (containersInfo && typeof containersInfo === 'object' && !Array.isArray(containersInfo))
        ? { ...containersInfo }
        : {};
    ensureDockerHostRowUpdateObserver();
    if (!isDockerHostUpdateSyncSuspended() && syncDockerHostRowUpdateStatesFromDom()) {
        containersInfo = { ...dockerRuntimeInfoByName };
    }
    folders = reconcileDockerMemberIdentities(folders, containersInfo);
    let order = readDockerHostOrderFromDom();
    let prefsResponse = {};
    try {
        prefsResponse = prom[3] ? JSON.parse(prom[3]) : {};
    } catch (error) {
        prefsResponse = {};
    }
    folderTypePrefs = applyDockerPinnedFolderPrefsOverride(normalizeDockerPrefsResponse(prefsResponse));
    resolveDockerStrictPerformanceProfile(folderTypePrefs, folders, containersInfo);
    dockerRuntimeStateStore.set({
        pinnedFolderIds: Array.isArray(folderTypePrefs?.pinnedFolderIds) ? [...folderTypePrefs.pinnedFolderIds] : []
    });
    const folderDepthById = buildFolderDepthById(folders);
    unraidOrder = reorderFolderSlotsInBaseOrder(unraidOrder, folders, folderTypePrefs);
    applyRuntimePrefs(folderTypePrefs);
    queueDockerRuntimePrivacyServerReconcile(folderTypePrefs);
    primeDockerRuntimeAppWidthBeforeRender(folders);
    lastLiveRefreshStateSignature = buildDockerStateSignature(containersStateInfo, true);
    lastLiveRefreshStateEntityCount = Object.keys(containersStateInfo || {}).length;
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


    // Keep FolderView rows above standalone containers even when Unraid has already
    // saved a newly installed container at the beginning of userprefs.cfg.
    const liveOrderBeforeReconciliation = [...order];
    const reconciledOrder = reconcileDockerOrderWithFolderSlots(order, unraidOrder, folders);
    order = reconciledOrder.order;
    const newOnes = reconciledOrder.newOnes;
    lastDockerOrderReconciliation = {
        available: true,
        capturedAt: new Date().toISOString(),
        liveOrderCount: liveOrderBeforeReconciliation.length,
        savedOrderCount: unraidOrder.length,
        reconciledOrderCount: reconciledOrder.order.length,
        folderCount: Object.keys(folders || {}).length,
        missingContainerCount: newOnes.length,
        appendedContainerCount: newOnes.length,
        appendPosition: newOnes.length > 0 ? 'after-folders' : 'not-needed',
        orderingInvariantSatisfied: reconciledOrder.order.every((entry, index, entries) => (
            !folderRegex.test(entry) || entries.slice(0, index).every((previous) => folderRegex.test(previous))
        )),
        liveOrderFingerprint: dockerRuntimeDiagnosticsModule.buildOrderFingerprint(liveOrderBeforeReconciliation),
        savedOrderFingerprint: dockerRuntimeDiagnosticsModule.buildOrderFingerprint(unraidOrder),
        reconciledOrderFingerprint: dockerRuntimeDiagnosticsModule.buildOrderFingerprint(reconciledOrder.order)
    };

    // debug mode, download the debug json file
    if(folderDebugMode) { // This is the existing folderDebugMode, not FOLDER_VIEW_DEBUG_MODE
        const debugData = JSON.stringify({
            version: String(await pluginRequestClient.getText('/plugins/folderview.plus/server/version.php')).trim(),
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
    }
    let foldersDone = {};


    if(folderobserver) {
        folderobserver.disconnect();
        folderobserver = undefined;
    }

    folderobserver = new MutationObserver((mutationList, observer) => {
        for (const mutation of mutationList) {
            if(/^load-/.test(mutation.target.id)) {
                $('i#folder-' + mutation.target.id).attr('class', mutation.target.className)
            }
        }
    });
    folderEvents.dispatchEvent(new CustomEvent('docker-pre-folders-creation', {detail: {
        folders: folders,
        order: order,
        containersInfo: containersInfo
    }}));
    const folderMatchCache = buildDockerFolderMatchCache(order, containersInfo, folders, folderTypePrefs);
    // Draw the folders in the order
    dockerPerf.begin('createFolders.renderOrdered');
    for (let key = 0; key < order.length; key++) {
        const container = order[key];
        if (container && folderRegex.test(container)) {
            let id = container.replace(folderRegex, '');
            if (folders[id]) {
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
                foldersDone[id] = folders[id];
                delete folders[id];
            }
        }
    }
    dockerPerf.end('createFolders.renderOrdered', { orderedEntries: order.length });

    // Draw the foldes outside of the order
    dockerPerf.begin('createFolders.renderRemaining');
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] createFolders: Starting loop to draw folders outside of order (remaining).');
    // Preserve original folder order when inserting at the top with unshift.
    const remainingFolders = Object.entries(getPrefsOrderedFolderMap(folders, folderTypePrefs)).reverse();
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
    syncDockerPinnedFolderUi();
    queueDockerPinnedFolderServerReconcile('post-render', 160);

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
    const maxRestoredExpansions = dockerRuntimePerformanceProfile?.performanceMode === true
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
            folder.status = (folder.status && typeof folder.status === 'object') ? folder.status : {};
            folder.status.expanded = false;
            continue;
        }
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolders: Restoring expanded folder ${id}.`);
        dropDownButton(id, false);
        restoredExpansionCount++;
    }
    // The restore budget is session-only. Do not overwrite the user's remembered expansion map.

    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] createFolders: Assigned foldersDone to globalFolders:', {...globalFolders});
    renderRuntimeHealthBadge(globalFolders, folderTypePrefs);
    refreshDockerFolderQuickActionStates();
    applyDockerFocusedFolderState();
    applyDockerRuntimeToolbarFilterState();
    renderDockerRuntimeActionBar(resolveDockerPageViewMode());
    runDockerRuntimeWidthReflow('pre-visible-folder-commit', {
        force: true,
        minimumDelta: 0
    });
    const initialActionSummary = summarizeDockerPreviewActionSlots();
    dockerRuntimeLayoutStabilityTracker?.updateInitialActionSummary?.({
        initialTargetCount: initialActionSummary.targetCount,
        pendingWebuiSlotCount: initialActionSummary.pendingWebuiSlotCount,
        readyWebuiSlotCount: initialActionSummary.readyWebuiSlotCount
    });
    markDockerRuntimeLayoutPhase('folder-preview-actions-ready', initialActionSummary);
    scheduleDockerPostRenderPolish(Object.keys(globalFolders));
    queueDockerDeferredRuntimeInfoHydration(renderGeneration, lastLiveRefreshStateSignature, requestBundle.fullInfo);
    queueDockerSupportBundlePageSnapshot('render-complete', 260);

    folderDebugMode = false; // Existing flag
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] createFolders: Set folderDebugMode (existing) to false.');

    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] createFolders: Exit');
    markDockerFatalBannerStep('Docker folders rendered');
    setDockerFatalBannerPhase('ready');
    recordDockerFatalBannerAction('Docker folders rendered successfully');
    foldersRenderedSuccessfully = true;
    dockerRuntimePerformanceTelemetry?.mark?.('foldersGrouped', {
        folderCount: Object.keys(globalFolders || {}).length
    });
    dockerRuntimePerformanceTelemetry?.sampleDom?.('folders-grouped');
    } catch (error) {
    reportDockerFatalRuntimeError(error, {
        phase: error?.fvplusPhase || 'bootstrap-data',
        category: error?.fvplusCategory || inferDockerFatalBannerCategory(error, 'runtime-failed')
    });
    throw error;
    } finally {
    dockerLastRenderMs = Math.max(0, (typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()) - performanceRenderStartedAt);
    dockerHostLoadOwnsLoadingUi = false;
    activeDockerRenderSuppressLoadingUi = false;
    completeDockerRuntimeWidthBootstrap(widthBootstrapGeneration, {
        stabilize: foldersRenderedSuccessfully
    });
    hideDockerRuntimeLoadingOverlay();
    hideDockerRuntimeLoadingRow();
    dockerPerf.end('createFolders.total', {
        folderCount: Object.keys(globalFolders || {}).length,
        perfMode: FOLDER_VIEW_PERF_MODE
    });
    dockerRuntimePerformanceTelemetry?.end?.('folderGrouping', {
        success: foldersRenderedSuccessfully,
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
    id = normalizeFolderId(id);
    if (!id) {
        throw new Error('FolderView Plus refused to render a folder with an invalid identifier.');
    }
    const perfKey = `createFolder.${id}`;
    dockerPerf.begin(perfKey);
    try {
    // --- Store a snapshot of the live order array AT THE START of this folder's processing ---
    // This snapshot is crucial for correctly calculating `remBefore` based on original positions.
    const orderSnapshotAtFolderStart = [...liveOrderArray];
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

    const advanced = $.cookie('docker_listview_mode') == 'advanced';

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

    let regexMatches = [];
    if (precomputed && Array.isArray(precomputed.regex)) {
        regexMatches = precomputed.regex;
    } else if (folder.regex && typeof folder.regex === 'string' && folder.regex.trim() !== "") {
        try {
            const re = new RegExp(folder.regex);
            regexMatches = orderSnapshotAtFolderStart.filter((el) => containersInfo[el] && re.test(el));
        } catch (e) {
            regexMatches = [];
        }
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
    const lazyPreviewEnabled = dockerRuntimePerformanceProfile?.deferredPreviews === true
        || folderTypePrefs?.lazyPreviewEnabled === true;
    const lazyPreviewThreshold = Number(folderTypePrefs?.lazyPreviewThreshold || 30);
    const isExpandedByDefault = folder?.settings?.expand_tab === true;
    const lazyPreviewActive = lazyPreviewEnabled
        && Number.isFinite(lazyPreviewThreshold)
        && combinedContainers.length >= Math.max(10, Math.min(200, Math.round(lazyPreviewThreshold)))
        && !isExpandedByDefault;
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
    const hoverAnimationClass = getPreviewHoverAnimationClass(folder.settings);
    const pinnedIndicator = pinned ? buildDockerFolderPinnedIndicatorHtml() : '';
    const advancedVisibleClass = advanced ? ' fv-advanced-visible' : '';
    const fld = `<tr class="sortable folder-id-${id} ${hoverClass} ${lockedClass} ${pinnedClass} ${focusedClass} ${hoverAnimationClass} folder" data-fv-folder-id="${id}"><td class="ct-name folder-name"><div class="folder-name-sub"><i class="fa fa-arrows-v mover orange-text"></i><span class="outer folder-outer"><span id="${id}" data-fv-onclick="addDockerFolderContext('${id}')" class="hand folder-hand"><img src="${safeFolderIcon}" class="img folder-img" data-fv-onerror='this.src="/plugins/dynamix.docker.manager/images/question.png"'></span><span class="inner folder-inner"><span class="appname" data-fvplus-style="fv-u-569beu"><a>folder-${id}</a></span><span class="fv-folder-title-line"><a class="exec folder-appname" data-fv-onclick='editFolder("${id}")'>${safeFolderName}</a>${pinnedIndicator}</span><br><i id="load-folder-${id}" class="fa fa-square stopped folder-load-status"></i><span class="state folder-state fv-folder-state-stopped"> ${$.i18n('stopped')}</span></span></span><button class="dropDown-${id} folder-dropdown" data-fv-onclick="dropDownButton('${id}')" ><i class="fa fa-chevron-down" aria-hidden="true"></i></button></div></td><td class="updatecolumn folder-update"><span class="green-text folder-update-text"><i class="fa fa-check fa-fw"></i> ${$.i18n('up-to-date')}</span><div class="advanced${advancedVisibleClass}"><a class="exec" data-fv-onclick="forceUpdateFolder('${id}');"><span data-fvplus-style="fv-u-6oi7h7"><i class="fa fa-cloud-download fa-fw"></i> ${$.i18n('force-update')}</span></a></div></td><td colspan="${colspan}" class="folder-preview-cell"><div class="folder-storage"></div><div class="folder-preview"></div></td><td class="advanced folder-advanced${advancedVisibleClass}"><span class="cpu-folder-${id} folder-cpu">0%</span><div class="usage-disk mm folder-load"><span id="cpu-folder-${id}" class="folder-cpu-bar" data-fvplus-style="fv-u-sfjn3c"></span><span></span></div><br><span class="mem-folder-${id} folder-mem">0 / 0</span></td><td class="folder-autostart"><input type="checkbox" id="folder-${id}-auto" class="autostart" data-fvplus-style="fv-u-uydnfn"><div data-fvplus-style="fv-u-1gl0zeh"></div></td><td></td></tr>`;
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
    const $createdFolderRow = $('#docker_list > tr.folder[data-fv-folder-id]')
        .filter((_, element) => String(element.getAttribute('data-fv-folder-id') || '') === id)
        .first();
    dockerFolderRowActionsController.decorate($createdFolderRow, id);
    $createdFolderRow
        .attr('data-folder-depth', String(safeDepth))
        .find('.folder-name-sub')
        .css('padding-left', `${depthIndentPx}px`);
    forceFolderRowVerticalCenter(id);

    const $createdFolderPreview = $createdFolderRow.find('div.folder-preview').first();
    const previewNode = $createdFolderPreview.get(0);
    applyPreviewBorderStyle(previewNode, folder.settings);
    applyFolderDropdownStyle($createdFolderRow, folder.settings);
    applyFolderPreviewLayout($createdFolderPreview, folder.settings);
    $createdFolderPreview.addClass(`folder-preview-${folder.settings.preview}`);
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
        $createdFolderPreview.append($item);
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

    // Preserve the saved folder order index in lifecycle event details for host integrations.
    const customOrderCursor = runtimeFolderOrdering.createOrderCursor({
        order: orderSnapshotAtFolderStart,
        completedFolderIds: foldersDone,
        currentFolderId: id
    });
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Filtered customOrder based on orderSnapshotAtFolderStart:`, [...customOrderCursor.snapshot()]);


    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Starting loop to process ${combinedContainers.length} combinedContainers.`);
    const hiddenPreviewSet = new Set(Array.isArray(folder?.hiddenPreviewMembers) ? folder.hiddenPreviewMembers : []);
    for (const container_name_in_folder of combinedContainers) {

        const ct = containersInfo[container_name_in_folder];
        if (!ct) {
            if (FOLDER_VIEW_DEBUG_MODE) console.error(`[FV3_DEBUG] createFolder (id: ${id}): CRITICAL - Container info for '${container_name_in_folder}' not found in containersInfo! Skipping further processing for this container.`);
            continue; // Skip this container if info is missing
        }
        const indexInCustomOrder = customOrderCursor.indexOf(container_name_in_folder);
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
                webuiCapability: typeof ct.info.State.WebUiCapability === 'boolean'
                    ? ct.info.State.WebUiCapability
                    : null,
                webuiHydrating: ct.info.State.WebUiHydrationPending === true,
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


            let CPU = []; let MEM = []; let charts = []; let tootltipObserver; let attachedTooltipStatsListener = null;
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
                    };
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
                    if (!chart || !chart.canvas || !document.body.contains(chart.canvas)) {
                        continue;
                    }
                    try {
                        chart.update('quiet');
                    } catch (error) {
                        if (FOLDER_VIEW_DEBUG_MODE) console.warn(`[FV3_DEBUG] graphListener (for ct: ${ct.shortId}): Chart update skipped.`, error);
                    }
                }
                 if (FOLDER_VIEW_DEBUG_MODE && charts.length > 0) console.log(`[FV3_DEBUG] graphListener (for ct: ${ct.shortId}): Updated ${charts.length} charts.`);
            };

            if (!hiddenPreviewSet.has(container_name_in_folder)) {
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

                        if (!attachedTooltipStatsListener && window.dockerload && typeof window.dockerload.addEventListener === 'function') {
                            window.dockerload.addEventListener('message', graphListener);
                            attachedTooltipStatsListener = 'sse';
                            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): Added graphListener to dockerload SSE.`);
                        }

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
                        if (attachedTooltipStatsListener === 'sse' && window.dockerload && typeof window.dockerload.removeEventListener === 'function') {
                            window.dockerload.removeEventListener('message', graphListener);
                            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): Removed graphListener from dockerload SSE.`);
                        }
                        attachedTooltipStatsListener = null;
                        for (const chart of charts) {
                            try {
                                chart.destroy();
                            } catch (error) {
                                if (FOLDER_VIEW_DEBUG_MODE) console.warn(`[FV3_DEBUG] Tooltipster (ct: ${ct.shortId}): Chart destroy skipped.`, error);
                            }
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
            const previewStatusMode = normalizePreviewStatusMode(folder.settings.preview_status);

            if (!compactMultiRowPreview && previewStatusMode !== 'none' && (previewMode === 3 || previewMode === 4) && $previewElementTarget.length) {
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
            if (!compactMultiRowPreview && previewMode === 2 && $previewElementTarget.length) {
                const $existingIconStatus = $previewElementTarget.children('.fv-preview-icon-status');
                if (previewStatusMode === 'symbol' && !$previewElementTarget.children('.fv-preview-icon-status').length) {
                    $previewElementTarget.append(
                        $(`<span class="fv-preview-status-compact fv-preview-icon-status ${previewStateMeta.className}" title="${previewStatusTitle}" aria-hidden="true"><i class="fa ${previewStateMeta.icon}"></i><span class="state"> ${previewStatusTitle}</span></span>`)
                    );
                } else if (previewStatusMode !== 'symbol' && $existingIconStatus.length) {
                    $existingIconStatus.remove();
                }
                if (previewStatusMode === 'grayscale' && newFolder[container_name_in_folder].state !== true) {
                    const $img = $previewElementTarget.children('img.img').first();
                    if ($img.length) {
                        $img.css('filter', 'grayscale(100%)');
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
                    $appNameSpan.addClass('orange-text fv-preview-update-ready');
                    $appNameSpan.children('a.exec').addClass('orange-text fv-preview-update-ready');
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
                appendDockerPreviewActionButtons(
                    $targetForAppend,
                    folder.settings,
                    ct.info.Name,
                    ct.info.Shell,
                    previewWebuiUrl,
                    {
                        webuiCapability: newFolder[container_name_in_folder]?.webuiCapability,
                        webuiHydrating: newFolder[container_name_in_folder]?.webuiHydrating === true
                    }
                );
            }
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
    if (lazyPreviewActive) {
        const previewElement = $(`tr.folder-id-${id} div.folder-preview`).get(0);
        const rowElement = $(`tr.folder-id-${id}`).get(0);
        dockerDeferredPreviewController.defer(previewElement, {
            interactionTarget: rowElement,
            placeholder: `${combinedContainers.length} members · preview deferred`,
            onHydrated: () => layoutFolderPreviewRows($(previewElement), folder.settings)
        });
    }
    if (FOLDER_VIEW_DEBUG_MODE && folder.settings.preview_vertical_bars) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Added preview_vertical_bars.`);
    if(folder.settings.update_column) {
        $(`tr.folder-id-${id} > td.updatecolumn`).next().attr('colspan',6).end().remove();
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Handled update_column setting (removed column).`);
    }
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Setting folder status indicators based on aggregate states. managerTypes:`, Array.from(managerTypes));
    renderFolderUpdateColumn(id, $(`tr.folder-id-${id} > td.updatecolumn`), managerTypes, upToDate, managed);
    $(`tr.folder-id-${id} .folder-appname`).toggleClass(
        'orange-text fv-folder-update-ready',
        folder.settings?.folder_update_highlight === true && upToDate === false
    );
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
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): No dockerman containers - removed autostart toggle.`);
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

const appendDockerPreviewActionButtons = ($target, settings = {}, containerName = '', shellValue = '/bin/sh', webuiUrl = '', options = {}) => {
    const previewActionsApi = getDockerPreviewActionsApi();
    if (previewActionsApi && typeof previewActionsApi.appendDockerPreviewActionButtons === 'function') {
        previewActionsApi.appendDockerPreviewActionButtons($target, settings, containerName, shellValue, webuiUrl, options);
    }
};

const syncDockerLeafFolderPreviewActions = (id, folder, runtimeContainers, changedNames = null) => {
    const previewActionsApi = getDockerPreviewActionsApi();
    if (previewActionsApi && typeof previewActionsApi.syncDockerLeafFolderPreviewActions === 'function') {
        previewActionsApi.syncDockerLeafFolderPreviewActions(id, folder, runtimeContainers, changedNames);
    }
};

const syncDockerFolderMemberRows = (id, runtimeContainers, changedNames = null) => {
    const previewActionsApi = getDockerPreviewActionsApi();
    if (previewActionsApi && typeof previewActionsApi.syncDockerFolderMemberRows === 'function') {
        previewActionsApi.syncDockerFolderMemberRows(id, runtimeContainers, changedNames);
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
const dockerFolderRowActionsController = dockerRuntimeShared.createFolderRowActionsController({
    document,
    $,
    namespace: 'fvDockerFolderRowAction',
    actionAttribute: 'data-fv-docker-folder-action',
    handlers: {
        toggle: (id) => dropDownButton(id),
        edit: (id) => editFolder(id),
        context: (id) => addDockerFolderContext(id)
    }
});
const bindDockerFolderRowActions = () => dockerFolderRowActionsController.bind();
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
const buildDockerFolderEditorUrl = (id = '', options = {}) => {
    const actionsApi = getDockerRuntimeActionsApi();
    return actionsApi && typeof actionsApi.buildDockerFolderEditorUrl === 'function'
        ? actionsApi.buildDockerFolderEditorUrl(id, options)
        : `/Docker/Folder?type=docker&_=${String(Date.now())}#type=docker`;
};
const editFolder = (id) => {
    const actionsApi = getDockerRuntimeActionsApi();
    if (actionsApi && typeof actionsApi.editFolder === 'function') {
        actionsApi.editFolder(id);
    }
};
const createChildFolder = (id) => {
    const actionsApi = getDockerRuntimeActionsApi();
    if (actionsApi && typeof actionsApi.createChildFolder === 'function') {
        actionsApi.createChildFolder(id);
    }
};

/**
 * Force update all the containers inside a folder
 * @param {string} id the id of the folder
 */
const forceUpdateFolder = (id, { includeDescendants = true } = {}) => {
    appendDockerBulkUpdateTrace('forceUpdateFolderDispatch', {
        folderId: String(id || '').trim(),
        includeDescendants: includeDescendants === true,
        currentPage: String(location?.pathname || ''),
        listViewMode: readDockerListViewMode()
    });
    armDockerPostUpdateRuntimeReconcileWindow(120000, {
        initialDelayMs: DOCKER_POST_UPDATE_RECONCILE_INITIAL_DELAY_MS,
        pollDelayMs: DOCKER_POST_UPDATE_RECONCILE_POLL_INTERVAL_MS
    });
    queueDockerSupportBundlePageSnapshot('force-update-dispatch', 80);
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
    appendDockerBulkUpdateTrace('updateFolderDispatch', {
        folderId: String(id || '').trim(),
        includeDescendants: includeDescendants === true,
        currentPage: String(location?.pathname || ''),
        listViewMode: readDockerListViewMode()
    });
    armDockerPostUpdateRuntimeReconcileWindow(120000, {
        initialDelayMs: DOCKER_POST_UPDATE_RECONCILE_INITIAL_DELAY_MS,
        pollDelayMs: DOCKER_POST_UPDATE_RECONCILE_POLL_INTERVAL_MS
    });
    queueDockerSupportBundlePageSnapshot('update-dispatch', 80);
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
        'fa-thumb-tack',
        'fa-lock',
        'fa-unlock-alt'
    ]
});
const DOCKER_CONTEXT_MENU_SELECTORS = [
    'ul.context-menu-list',
    'ul.contextMenuPlugin',
    'ul.context-menu',
    'ul.dropdown-menu'
];
const DOCKER_CONTEXT_VIEWPORT_MARGIN = 10;
const queueDockerFolderContextQuickIcons = (attempt = 0) => {
    if (!dockerContextQuickStripAdapter || typeof dockerContextQuickStripAdapter.queueEnhance !== 'function') {
        return;
    }
    dockerContextQuickStripAdapter.queueEnhance(attempt);
};
const getVisibleDockerContextMenus = () => {
    const jq = window.jQuery || window.$;
    if (jq) {
        const menus = [];
        for (const selector of DOCKER_CONTEXT_MENU_SELECTORS) {
            jq(`${selector}:visible`).each((_, menu) => {
                if (!menus.includes(menu)) {
                    menus.push(menu);
                }
            });
        }
        return menus;
    }
    return DOCKER_CONTEXT_MENU_SELECTORS
        .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
        .filter((menu, index, all) => all.indexOf(menu) === index)
        .filter((menu) => {
            const rect = menu.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        });
};
const positionDockerContextElementInsideViewport = (element) => {
    if (!element || typeof element.getBoundingClientRect !== 'function') {
        return false;
    }
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) {
        return false;
    }
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    if (!viewportWidth || !viewportHeight) {
        return false;
    }
    const margin = DOCKER_CONTEXT_VIEWPORT_MARGIN;
    const style = window.getComputedStyle(element);
    const fixed = style.position === 'fixed';
    const scrollX = fixed ? 0 : (window.pageXOffset || document.documentElement.scrollLeft || 0);
    const scrollY = fixed ? 0 : (window.pageYOffset || document.documentElement.scrollTop || 0);
    let nextTop = rect.top + scrollY;
    let nextLeft = rect.left + scrollX;
    let changed = false;

    element.classList.add('fvplus-docker-context-menu');
    element.style.maxHeight = `calc(100vh - ${margin * 2}px)`;

    if (rect.bottom > viewportHeight - margin) {
        nextTop -= rect.bottom - (viewportHeight - margin);
        changed = true;
    }
    if (rect.top < margin) {
        nextTop += margin - rect.top;
        changed = true;
    }
    if (rect.right > viewportWidth - margin) {
        nextLeft -= rect.right - (viewportWidth - margin);
        changed = true;
    }
    if (rect.left < margin) {
        nextLeft += margin - rect.left;
        changed = true;
    }

    if (changed) {
        element.style.top = `${Math.max(margin + scrollY, nextTop)}px`;
        element.style.left = `${Math.max(margin + scrollX, nextLeft)}px`;
    }
    return true;
};
const adjustDockerContextSubmenuViewportPlacement = (listItem) => {
    if (!listItem || !listItem.closest) {
        return false;
    }
    const rootMenu = listItem.closest('.fvplus-docker-context-menu');
    const submenu = Array.from(listItem.children || []).find((child) => child && child.tagName === 'UL');
    if (!rootMenu || !submenu || typeof submenu.getBoundingClientRect !== 'function') {
        return false;
    }
    listItem.classList.remove('fvplus-context-submenu-open-up', 'fvplus-context-submenu-open-left');
    submenu.style.maxHeight = '';
    const rect = submenu.getBoundingClientRect();
    if (!rect.width || !rect.height) {
        return false;
    }
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const margin = DOCKER_CONTEXT_VIEWPORT_MARGIN;
    if (rect.bottom > viewportHeight - margin) {
        listItem.classList.add('fvplus-context-submenu-open-up');
    }
    if (rect.right > viewportWidth - margin) {
        listItem.classList.add('fvplus-context-submenu-open-left');
    }
    submenu.style.maxHeight = `calc(100vh - ${margin * 2}px)`;
    return true;
};
const adjustVisibleDockerContextMenusInsideViewport = () => {
    const menus = getVisibleDockerContextMenus();
    if (!menus.length) {
        return false;
    }
    menus.forEach((menu) => positionDockerContextElementInsideViewport(menu));
    return true;
};
let dockerContextViewportGuardsBound = false;
const bindDockerContextMenuViewportGuards = () => {
    if (dockerContextViewportGuardsBound) {
        return;
    }
    dockerContextViewportGuardsBound = true;
    const handlePotentialSubmenu = (event) => {
        const item = event.target && event.target.closest
            ? event.target.closest('.fvplus-docker-context-menu li')
            : null;
        if (!item) {
            return;
        }
        window.requestAnimationFrame(() => {
            adjustDockerContextSubmenuViewportPlacement(item);
            adjustVisibleDockerContextMenusInsideViewport();
        });
    };
    document.addEventListener('mouseover', handlePotentialSubmenu, true);
    document.addEventListener('focusin', handlePotentialSubmenu, true);
    window.addEventListener('resize', () => {
        window.requestAnimationFrame(adjustVisibleDockerContextMenusInsideViewport);
    });
};
const queueDockerContextViewportGuard = (attempt = 0) => {
    bindDockerContextMenuViewportGuards();
    window.requestAnimationFrame(() => {
        if (adjustVisibleDockerContextMenusInsideViewport()) {
            return;
        }
        const safeAttempt = Number.isFinite(Number(attempt)) ? Number(attempt) : 0;
        if (safeAttempt >= 8) {
            return;
        }
        window.setTimeout(() => queueDockerContextViewportGuard(safeAttempt + 1), 18 * (safeAttempt + 1));
    });
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
    const currentParentId = normalizeFolderParentId(folderData?.parentId || folderData?.parent_id || '');
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
        icon: 'fa-thumb-tack',
        action: (evt) => {
            evt.preventDefault();
            toggleDockerFolderPin(id, !pinned);
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
    opts.push({
        text: 'Add child folder',
        icon: 'fa-folder-open-o',
        action: (evt) => { evt.preventDefault(); createChildFolder(id); }
    });
    opts.push({
        text: 'Move up',
        icon: 'fa-chevron-up',
        action: (evt) => { evt.preventDefault(); moveDockerFolderFromMenu(id, -1); }
    });
    opts.push({
        text: 'Move down',
        icon: 'fa-chevron-down',
        action: (evt) => { evt.preventDefault(); moveDockerFolderFromMenu(id, 1); }
    });
    opts.push({
        text: 'Move under...',
        icon: 'fa-level-down',
        action: (evt) => { evt.preventDefault(); moveDockerFolderUnderFromMenu(id); }
    });
    if (currentParentId) {
        opts.push({
            text: 'Move to root',
            icon: 'fa-level-up',
            action: (evt) => { evt.preventDefault(); applyDockerFolderHierarchyMoveFromMenu(id, ''); }
        });
    }

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
    queueDockerContextViewportGuard();
    dockerPerfTelemetry.end('context-menu-build', { id, optsCount: opts.length });
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] addDockerFolderContext (id: ${id}): Context menu attached to #${id}. Exit.`);
};

// Route Unraid host lifecycle hooks through the shared adapter while retaining legacy aliases.
getDockerHostGuardsApi()?.wrapHostHook?.('listview', ({ invokeOriginal }) => {
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Patched listview: Entry.');
    appendDockerRequestBundleTrace('listview', {
        currentPage: String(location?.pathname || ''),
        loadedFolder: loadedFolder === true,
        hostSyncSuspended: isDockerHostUpdateSyncSuspended(),
        hasPrimedRequestBundle: !!(folderReq && Array.isArray(folderReq.render) && folderReq.render.length > 0)
    });
    if (typeof window.listview_original === 'function') {
        invokeOriginal();
        if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Patched listview: Called original listview.');
    } else {
        if (FOLDER_VIEW_DEBUG_MODE) console.error('[FV3_DEBUG] Patched listview: window.listview_original is not a function!');
    }

    if (!loadedFolder) {
        dockerHostLoadOwnsLoadingUi = true;
        if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Patched listview: loadedFolder is false. Queueing createFolders render.');
        if (DOCKER_LEGACY_HOST_BOOTSTRAP_RENDER_COMPAT) {
            queueCreateFoldersRender();
        }
        loadedFolder = true;
        if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Patched listview: loadedFolder is false. Resolving Docker page view render path.');
        queueDockerRuntimeRenderForPageViewMode();
        if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Patched listview: Set loadedFolder to true.');
    } else {
        if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Patched listview: loadedFolder is true. Skipped createFolders.');
    }
    queueDockerRuntimeResizerBind();
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Patched listview: Exit.');
}, {
    legacyAlias: 'listview_original',
    captureStep: 'Docker listview hook captured',
    missingMessage: 'Docker host listview hook was unavailable during bootstrap.',
    missingDetails: ['window.listview was not a function when FolderView Plus initialized.']
});

getDockerHostGuardsApi()?.wrapHostHook?.('loadlist', ({ invokeOriginal }) => {
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Patched loadlist: Entry.');
    bindDockerHostOpenDockerPatch();
    bindDockerLifecycleEventControlPatch();
    bindDockerContainerContextStatePatch();
    bindDockerListViewModeCookieHook();
    loadedFolder = false;
    dockerHostLoadOwnsLoadingUi = true;
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Patched loadlist: Set loadedFolder to false.');
    appendDockerRequestBundleTrace('loadlist', {
        currentPage: String(location?.pathname || ''),
        hostSyncSuspended: isDockerHostUpdateSyncSuspended(),
        liveUpdateStatus: isDockerHostUpdateSyncSuspended()
    });
    folderReq = ensureDockerFolderReqForHostRender();
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Patched loadlist: folderReq initialized with a staged Docker runtime request bundle.');

    if (typeof window.loadlist_original === 'function') {
        invokeOriginal();
        if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Patched loadlist: Called original loadlist.');
    } else {
        if (FOLDER_VIEW_DEBUG_MODE) console.error('[FV3_DEBUG] Patched loadlist: window.loadlist_original is not a function!');
    }
    queueDockerRuntimeResizerBind();
     if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Patched loadlist: Exit.');
}, {
    legacyAlias: 'loadlist_original',
    captureStep: 'Docker loadlist hook captured',
    missingMessage: 'Docker host loadlist hook was unavailable during bootstrap.',
    missingDetails: ['window.loadlist was not a function when FolderView Plus initialized.']
});

const PINNED_FOLDER_CHANGE_STORAGE_KEY = 'fv.folderviewplus.pinnedFolders.changed.v1';
const PINNED_FOLDER_CHANGE_EVENT = 'fvplus:pinned-folders-changed';
const applyDockerSettingsPinSyncPayload = (payload) => {
    if (!payload || payload.type !== 'docker') {
        return;
    }
    if (Array.isArray(payload.pinnedFolderIds)) {
        clearDockerPinnedFolderIdsOverride();
        applyDockerPinnedFolderIds(payload.pinnedFolderIds);
        syncDockerPinnedFolderUi();
        return;
    }
    queueLoadlistRefresh({ suppressLoadingUi: true });
};
const bindDockerSettingsPinSyncListener = () => {
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
        applyDockerSettingsPinSyncPayload(payload);
    });
    window.addEventListener(PINNED_FOLDER_CHANGE_EVENT, (event) => {
        applyDockerSettingsPinSyncPayload(event.detail || null);
    });
};
bindDockerSettingsPinSyncListener();

// Get the number of CPU, nneded for a right display of the load
if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Requesting CPU count.');
pluginRequestClient.getText('/plugins/folderview.plus/server/cpu.php').then((data) => {
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

    let multiplier;
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
let dockerCommandViewApi = null;
let dockerBootstrapPrefsPromise = null;
let queuedLoadlistTimer = null;
let queuedLoadlistOptions = null;
let queuedLoadlistRequestedAt = 0;
let lastLiveRefreshStateSignature = '';
let lastLiveRefreshStateEntityCount = 0;
let lastDockerRuntimeSnapshotToken = '';
let lastDockerRuntimeSnapshotRevisions = { folder: 0, prefs: 0 };
let lastDockerOrderReconciliation = { available: false };
let dockerBootstrapGeneration = 0;
let dockerHostLoadOwnsLoadingUi = false;
let nextDockerRenderSuppressLoadingUi = false;
let activeDockerRenderSuppressLoadingUi = false;
let dockerListViewModeObserverBound = false;
let dockerListViewModeCookieHookBound = false;
const DOCKER_LIST_VIEW_MODE_CHANGE_EVENT = 'fvplus:docker-listview-mode-change';
let lastDockerListViewMode = $.cookie('docker_listview_mode') == 'advanced' ? 'advanced' : 'basic';
let dockerRuntimeLastRenderGeneration = 0;
const dockerDiagnosticsTraceSessionId = typeof utils.createSecureRuntimeId === 'function'
    ? utils.createSecureRuntimeId('fvplus-docker')
    : `fvplus-docker-${Date.now().toString(36)}`;
const LOADLIST_REFRESH_DEBOUNCE_MS = 90;
const LOADLIST_REFRESH_MIN_GAP_MS = 420;
const PERFORMANCE_MODE_EXPAND_RESTORE_LIMIT = 12;
let dockerLastRenderMs = 0;
const DOCKER_POST_UPDATE_RECONCILE_INITIAL_DELAY_MS = 220;
const DOCKER_POST_UPDATE_RECONCILE_POLL_INTERVAL_MS = 4000;
let dockerRuntimePerformanceProfile = resolveDockerRuntimePerformanceProfile(folderTypePrefs, {
    folderCount: 0,
    itemCount: 0
});

const writeDockerSupportBundleStorageRecord = (storageKey, value) => {
    const diagnosticsApi = getDockerRuntimeDiagnosticsApi();
    const writeOk = diagnosticsApi && typeof diagnosticsApi.writeSupportBundleStorageRecord === 'function'
        ? diagnosticsApi.writeSupportBundleStorageRecord(storageKey, value)
        : false;
    if (storageKey === DOCKER_SUPPORT_BUNDLE_PAGE_STORAGE_KEY) {
        updateDockerTraceHealth('pageSnapshot', writeOk, {
            reason: String(value?.reason || '').trim() || 'runtime-sync'
        });
    }
    return writeOk;
};
const resolveDockerSupportBundleExpectedMemberActionToken = (entry = {}) => {
    const previewActionsApi = getDockerPreviewActionsApi();
    if (previewActionsApi && typeof previewActionsApi.resolveDockerMemberUpdateState === 'function') {
        return previewActionsApi.resolveDockerMemberUpdateState(entry, {
            advanced: readDockerListViewMode() === 'advanced'
        }).actionToken;
    }
    return 'unknown';
};
const resolveDockerSupportBundleExpectedFolderActionToken = (folderId) => {
    const folder = globalFolders?.[folderId];
    const status = folder?.status && typeof folder.status === 'object' && !Array.isArray(folder.status)
        ? folder.status
        : null;
    if (!status) {
        return 'unknown';
    }
    const hierarchyApi = getDockerRuntimeHierarchyApi();
    if (hierarchyApi && typeof hierarchyApi.resolveFolderUpdateColumnState === 'function') {
        return hierarchyApi.resolveFolderUpdateColumnState(
            new Set(Array.isArray(status.managerTypes) ? status.managerTypes : []),
            status.upToDate === true,
            Number(status.managed || 0),
            { advanced: readDockerListViewMode() === 'advanced' }
        ).actionToken;
    }
    return 'unknown';
};

const collectDockerSupportBundlePageSnapshot = (reason = 'runtime-sync') => {
    const diagnosticsApi = getDockerRuntimeDiagnosticsApi();
    return diagnosticsApi && typeof diagnosticsApi.collectPageSnapshot === 'function'
        ? diagnosticsApi.collectPageSnapshot(reason)
        : null;
};

let dockerSupportBundlePageSnapshotWriteTimer = null;
let dockerSupportBundlePageSnapshotPendingReason = '';
const queueDockerSupportBundlePageSnapshot = (reason = 'runtime-sync', delayMs = 180) => {
    const diagnosticsApi = getDockerRuntimeDiagnosticsApi();
    if (!(diagnosticsApi && typeof diagnosticsApi.queuePageSnapshot === 'function')) {
        return;
    }
    const safeReason = String(reason || 'runtime-sync');
    const safeDelay = Math.max(0, Number(delayMs) || 0);
    const offCriticalPathDelay = /^(render-complete|runtime-sync)$/.test(safeReason)
        ? Math.max(safeDelay, 1200)
        : safeDelay;
    diagnosticsApi.queuePageSnapshot(safeReason, offCriticalPathDelay);
    dockerSupportBundlePageSnapshotPendingReason = safeReason;
    if (dockerSupportBundlePageSnapshotWriteTimer) {
        clearTimeout(dockerSupportBundlePageSnapshotWriteTimer);
    }
    dockerSupportBundlePageSnapshotWriteTimer = window.setTimeout(() => {
        dockerSupportBundlePageSnapshotWriteTimer = null;
        const snapshotReason = dockerSupportBundlePageSnapshotPendingReason || safeReason;
        dockerSupportBundlePageSnapshotPendingReason = '';
        const snapshot = collectDockerSupportBundlePageSnapshot(snapshotReason);
        if (snapshot) {
            writeDockerSupportBundleStorageRecord(DOCKER_SUPPORT_BUNDLE_PAGE_STORAGE_KEY, snapshot);
        }
    }, offCriticalPathDelay);
};
const bindDockerUpdateActionClickCapture = () => {
    getDockerRuntimeReconcileApi()?.bindUpdateActionClickCapture?.();
};

const resolveDockerStrictPerformanceProfile = (prefs, folders, containersInfo) => {
    const folderCount = Object.keys(folders && typeof folders === 'object' ? folders : {}).length;
    const itemCount = Object.keys(containersInfo && typeof containersInfo === 'object' ? containersInfo : {}).length;
    dockerRuntimePerformanceProfile = resolveDockerRuntimePerformanceProfile(prefs || {}, {
        folderCount,
        itemCount,
        renderMs: dockerLastRenderMs,
        previousStrict: dockerRuntimePerformanceProfile?.strict === true
    });
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

const buildDockerRuntimeInfoUrl = (mode = 'full', cacheBust = Date.now(), options = {}) => {
    const liveUpdateQuery = mode === 'state' && options?.liveUpdateStatus === true
        ? '&liveupdate=1'
        : '';
    return `/plugins/folderview.plus/server/read_info.php?type=docker${mode === 'state' ? '&mode=state' : ''}${liveUpdateQuery}&nocache=1&_=${cacheBust || Date.now()}`;
};

const rememberDockerRuntimeSnapshot = (snapshot) => {
    if (snapshot?.snapshotToken) {
        lastDockerRuntimeSnapshotToken = String(snapshot.snapshotToken);
    }
    if (snapshot?.revisions && typeof snapshot.revisions === 'object') {
        lastDockerRuntimeSnapshotRevisions = {
            folder: Math.max(0, Number(snapshot.revisions.folder) || 0),
            prefs: Math.max(0, Number(snapshot.revisions.prefs) || 0)
        };
    }
};

const dockerRuntimeSnapshotConfigMatches = (snapshot) => {
    if (!lastDockerRuntimeSnapshotToken || !snapshot?.revisions) {
        return true;
    }
    return Math.max(0, Number(snapshot.revisions.folder) || 0) === lastDockerRuntimeSnapshotRevisions.folder
        && Math.max(0, Number(snapshot.revisions.prefs) || 0) === lastDockerRuntimeSnapshotRevisions.prefs;
};

const fetchDockerRuntimeSnapshotCheck = async (options = {}) => {
    const liveUpdateStatus = options?.liveUpdateStatus === true;
    if (!runtimeSnapshotApi || typeof runtimeSnapshotApi.buildUrl !== 'function') {
        const parsed = await pluginRequestClient.getJson(buildDockerRuntimeInfoUrl('state', Date.now(), {
            liveUpdateStatus
        }), { cache: false });
        return {
            notModified: buildDockerStateSignature(parsed, true) === lastLiveRefreshStateSignature,
            snapshotToken: '',
            runtimeSignature: buildDockerStateSignature(parsed, true)
        };
    }
    const payload = await pluginRequestClient.getJson(runtimeSnapshotApi.buildUrl('docker', 'check', {
        since: lastDockerRuntimeSnapshotToken,
        liveUpdateStatus,
        forceRefresh: true
    }), { cache: false });
    return runtimeSnapshotApi.parsePayload(payload);
};

const refreshDockerRuntimeStateInPlace = async (options = {}) => {
    dockerRuntimePerformanceTelemetry?.begin?.('incrementalReconciliation');
    const followupDelayMs = Math.max(0, Number(options?.followupDelayMs) || 0);
    const liveUpdateStatus = options?.liveUpdateStatus === true;
    const preserveGroupedDom = options?.preserveGroupedDom === true;
    let fallbackReason = 'request-error';
    const fallbackToLoadlist = () => {
        if (preserveGroupedDom) {
            dockerRuntimeStateStore.set({
                rowReconciliation: {
                    mode: 'incremental-retry',
                    reason: fallbackReason,
                    preservedGroupedDom: true,
                    capturedAt: new Date().toISOString()
                }
            });
            return;
        }
        queueLoadlistRefresh({ suppressLoadingUi: true });
    };
    const applyStatePayload = async () => {
        const useSnapshot = runtimeSnapshotApi && typeof runtimeSnapshotApi.buildUrl === 'function';
        const payload = await pluginRequestClient.getJson(useSnapshot
            ? runtimeSnapshotApi.buildUrl('docker', 'state', {
                liveUpdateStatus,
                forceRefresh: true
            })
            : buildDockerRuntimeInfoUrl('state', Date.now(), { liveUpdateStatus }), { cache: false });
        const snapshot = useSnapshot ? runtimeSnapshotApi.parsePayload(payload) : null;
        const parsed = snapshot ? snapshot.runtime : parseJsonPayloadSafe(payload);
        if (!parsed || Object.keys(parsed).length <= 0) {
            fallbackReason = 'empty-runtime-payload';
            throw new Error('Docker runtime state payload was empty.');
        }
        const configurationChanged = snapshot && !dockerRuntimeSnapshotConfigMatches(snapshot);
        if (configurationChanged && !preserveGroupedDom) {
            fallbackReason = 'configuration-changed';
            return false;
        }
        if (configurationChanged) {
            dockerRuntimeStateStore.set({
                deferredConfigurationRebuild: {
                    reason: 'lifecycle-runtime-refresh',
                    folderRevision: Math.max(0, Number(snapshot?.revisions?.folder) || 0),
                    prefsRevision: Math.max(0, Number(snapshot?.revisions?.prefs) || 0),
                    capturedAt: new Date().toISOString()
                }
            });
        }
        const previousRuntimeInfo = dockerRuntimeInfoByName;
        const nextRuntimeInfo = normalizeDockerRuntimeInfoMap(parsed, previousRuntimeInfo);
        const rowDiff = runtimeSnapshotApi && typeof runtimeSnapshotApi.diffRuntimeRows === 'function'
            ? runtimeSnapshotApi.diffRuntimeRows('docker', previousRuntimeInfo, nextRuntimeInfo)
            : {
                changed: Object.keys(nextRuntimeInfo),
                structuralChanged: Object.keys(previousRuntimeInfo || {}).length !== Object.keys(nextRuntimeInfo).length,
                hasChanges: true
            };
        dockerRuntimeInfoByName = nextRuntimeInfo;
        const nextSignature = buildDockerStateSignature(parsed, true);
        if (nextSignature) {
            lastLiveRefreshStateSignature = nextSignature;
            lastLiveRefreshStateEntityCount = Object.keys(parsed).length;
        }
        if (snapshot) {
            rememberDockerRuntimeSnapshot(snapshot);
        }
        if (rowDiff.structuralChanged) {
            fallbackReason = 'transient-runtime-structure';
            dockerRuntimeStateStore.set({
                rowReconciliation: {
                    mode: 'structural-fallback',
                    changedRows: Number(rowDiff.changed?.length || 0),
                    addedRows: Number(rowDiff.added?.length || 0),
                    removedRows: Number(rowDiff.removed?.length || 0),
                    capturedAt: new Date().toISOString()
                }
            });
            return false;
        }
        if (rowDiff.hasChanges) {
            syncDockerVisibleFoldersFromRuntimeCache(rowDiff.changed);
        }
        return true;
    };
    try {
        const applied = await applyStatePayload();
        if (applied !== true) {
            fallbackToLoadlist();
            return false;
        }
        if (followupDelayMs > 0) {
            window.setTimeout(() => {
                Promise.resolve(applyStatePayload())
                    .then((followupApplied) => {
                        if (followupApplied !== true) {
                            fallbackToLoadlist();
                        }
                    })
                    .catch(() => fallbackToLoadlist());
            }, followupDelayMs);
        }
        return true;
    } catch (_error) {
        fallbackToLoadlist();
        return false;
    } finally {
        dockerRuntimePerformanceTelemetry?.end?.('incrementalReconciliation', {
            preserveGroupedDom,
            liveUpdateStatus
        });
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

const dockerLiveRefreshController = runtimeLiveRefreshModule.createController({
    window,
    document,
    keys: ['docker'],
    isEnabled: () => folderTypePrefs?.liveRefreshEnabled === true && $('#docker_list').length > 0,
    tick: async () => {
        let check = null;
        try {
            check = await fetchDockerRuntimeSnapshotCheck({
                liveUpdateStatus: isDockerHostUpdateSyncSuspended()
            });
        } catch (_error) {
            check = null;
        }
        if (!check || (!check.snapshotToken && !check.runtimeSignature)) {
            queueLoadlistRefresh();
            return false;
        }
        if (check.notModified !== true) {
            await refreshDockerRuntimeStateInPlace({
                liveUpdateStatus: isDockerHostUpdateSyncSuspended()
            });
        }
        return true;
    }
});
const scheduleLiveRefresh = (prefs) => {
    const normalized = utils.normalizePrefs(prefs || {});
    const requestedSeconds = Math.max(10, Math.min(300, Number(normalized.liveRefreshSeconds) || 20));
    const policyMinSeconds = Number(dockerRuntimePerformanceProfile?.minLiveRefreshSeconds || 0);
    const seconds = Math.max(requestedSeconds, policyMinSeconds);
    const ms = seconds * 1000;
    dockerLiveRefreshController.schedule('docker', {
        enabled: normalized.liveRefreshEnabled === true,
        intervalMs: ms
    });
};

const applyRuntimePrefs = (prefs) => {
    const normalized = utils.normalizePrefs(prefs || {});
    lastAppliedRuntimePrefs = normalized;
    resolveDockerStrictPerformanceProfile(normalized, globalFolders, dockerRuntimeInfoByName);
    if (!dockerRuntimePrivacyPersistPromise && dockerRuntimePrivacyPendingEnabled === null) {
        dockerRuntimePrivacyPersistedPrefs = normalized;
    }
    if (normalized.lazyPreviewEnabled !== true) {
        dockerDeferredPreviewController.flush();
    }
    if (document.body && typeof document.body.setAttribute === 'function') {
        document.body.setAttribute('data-fvplus-docker-page-view', resolveDockerPageViewMode(normalized));
    }
    syncDockerAddFolderButtonVisibility(resolveDockerPageViewMode(normalized));
    const appColumnWidth = typeof utils.normalizeAppColumnWidth === 'function'
        ? utils.normalizeAppColumnWidth(normalized.appColumnWidth)
        : (['compact', 'wide'].includes(String(normalized.appColumnWidth || '').toLowerCase()) ? String(normalized.appColumnWidth || '').toLowerCase() : 'standard');
    if (dockerRuntimeColumnControllerState.autoAppWidthFloorMode !== appColumnWidth) {
        dockerRuntimeColumnControllerState.autoAppWidthFloorMode = appColumnWidth;
        dockerRuntimeColumnControllerState.autoAppWidthFloor = dockerRuntimeColumnControllerApi.readCachedAppWidth(appColumnWidth);
    }
    const cachedAppWidth = dockerRuntimeColumnLayoutEngine?.readCachedWidth?.(appColumnWidth) || null;
    if (cachedAppWidth) {
        dockerRuntimeColumnControllerState.autoAppWidthFloor = Math.max(
            Number(dockerRuntimeColumnControllerState.autoAppWidthFloor) || 0,
            cachedAppWidth
        );
        applyDockerRuntimeAppWidthVariables(cachedAppWidth);
    }
    if (document.body && typeof document.body.setAttribute === 'function') {
        document.body.setAttribute('data-fvplus-docker-app-width', appColumnWidth);
    }
    queueDockerRuntimeResizerBind();
    scheduleDockerRuntimeWidthReflow('prefs-change', 0);
    $('body').toggleClass('fvplus-performance-mode', dockerRuntimePerformanceProfile?.reduceMotion === true);
    $('body').toggleClass('fvplus-performance-mode-strict', dockerRuntimePerformanceProfile?.strict === true);
    if (document.body) {
        document.body.setAttribute('data-fvplus-performance-profile', String(dockerRuntimePerformanceProfile?.mode || 'standard'));
        document.body.setAttribute('data-fvplus-performance-reason', String(dockerRuntimePerformanceProfile?.reason || 'standard-profile'));
    }
    try {
        window.localStorage?.setItem('fv.performancePolicy.docker.v1', JSON.stringify({
            ...(dockerRuntimePerformanceProfile || {}),
            capturedAt: new Date().toISOString()
        }));
    } catch (_error) {
        // Runtime policy visibility is best effort and never blocks rendering.
    }
    const dockerPrivacyMode = resolveDockerRuntimePrivacyMode(normalized);
    $('body').toggleClass('fvplus-privacy-docker-runtime', dockerPrivacyMode);
    $('body').toggleClass('fvplus-privacy-docker-runtime-mask-names', dockerPrivacyMode && normalized?.dashboard?.privacyMaskNames !== false);
    $('body').toggleClass('fvplus-privacy-docker-runtime-mask-container-ips', dockerPrivacyMode && normalized?.dashboard?.privacyMaskContainerIps !== false);
    $('body').toggleClass('fvplus-privacy-docker-runtime-mask-local-ips', dockerPrivacyMode && normalized?.dashboard?.privacyMaskLocalIps !== false);
    $('body').toggleClass('fvplus-privacy-docker-runtime-mask-ports', dockerPrivacyMode && normalized?.dashboard?.privacyMaskPorts !== false);
    window.FolderViewPlusRuntimePrivacy?.apply('docker', dockerPrivacyMode, normalized?.dashboard || {});
    refreshDockerRuntimePrivacyPortMappings();
    queueDockerRuntimePrivacyToggleMount();
    renderRuntimeHealthBadge(globalFolders, normalized);
    scheduleLiveRefresh(normalized);
};

const bindDockerRuntimePreferenceSync = () => {
    if (!dockerPrefsCoordinator || typeof dockerPrefsCoordinator.subscribe !== 'function') {
        return;
    }
    dockerPrefsCoordinator.subscribe((snapshot) => {
        if (snapshot?.type !== 'docker' || !snapshot?.prefs) {
            return;
        }
        const nextPrefs = applyDockerPinnedFolderPrefsOverride(utils.normalizePrefs(snapshot.prefs));
        folderTypePrefs = nextPrefs;
        applyRuntimePrefs(nextPrefs);
    });
};
bindDockerRuntimePreferenceSync();

window.toggleDockerRuntimeWidthDebug = (enabled = true) => setDockerRuntimeWidthDebugEnabled(enabled);
window.getDockerRuntimePerfTelemetrySnapshot = () => {
    if (!dockerPerfTelemetry || typeof dockerPerfTelemetry.snapshot !== 'function') {
        return {};
    }
    return dockerPerfTelemetry.snapshot();
};
window.getDockerHostAdapterSnapshot = () => dockerHostAdapter?.getSnapshot?.() || null;
window.getDockerRuntimePerformancePolicySnapshot = () => ({
    ...(dockerRuntimePerformanceProfile || {}),
    deferredPreviewQueue: dockerDeferredPreviewController.snapshot()
});
window.toggleDockerFolderFocus = (id) => toggleDockerFolderFocus(id);
window.toggleDockerFolderPin = (id) => toggleDockerFolderPin(id);
window.toggleDockerFolderLock = (id) => toggleDockerFolderLock(id);

function buildDockerFolderReq(options = {}) {
    const cacheBust = Date.now();
    const liveUpdateStatus = options?.liveUpdateStatus === true || isDockerHostUpdateSyncSuspended();
    const generation = ++dockerBootstrapGeneration;
    appendDockerRequestBundleTrace('buildDockerFolderReq', {
        currentPage: String(location?.pathname || ''),
        generation,
        cacheBust,
        liveUpdateStatus,
        hostSyncSuspended: isDockerHostUpdateSyncSuspended()
    });
    const legacyRenderFactories = [
        () => createDockerRuntimeRequest('/plugins/folderview.plus/server/read.php?type=docker', {
            source: 'folders',
            label: 'Docker folder definitions'
        }),
        () => createDockerRuntimeRequest('/plugins/folderview.plus/server/read_order.php?type=docker', {
            source: 'folder-order',
            label: 'Docker folder order'
        }),
        () => createDockerRuntimeRequest(buildDockerRuntimeInfoUrl('state', cacheBust, { liveUpdateStatus }), {
            source: 'runtime-info-state',
            label: 'Docker runtime state'
        }),
        () => createDockerRuntimeRequest(`/plugins/folderview.plus/server/prefs.php?type=docker&_=${cacheBust}`, {
            source: 'prefs',
            label: 'Docker preferences',
            allowFallback: true,
            fallbackValue: JSON.stringify({ ok: false, prefs: {} })
        })
    ];
    const legacyFullInfoFactory = () => createDockerRuntimeRequest(buildDockerRuntimeInfoUrl('full', cacheBust), {
        source: 'runtime-info-full',
        label: 'Docker runtime details',
        allowFallback: true,
        fallbackValue: JSON.stringify({}),
        fallbackTitle: 'Docker runtime details were partially unavailable',
        fallbackMessage: 'FolderView Plus rendered the Docker page, but advanced Docker runtime details had to fall back after the initial folder view loaded.',
        fallbackLead: 'Docker runtime detail hydration fell back to the lightweight state payload.'
    });
    if (!runtimeSnapshotApi || typeof runtimeSnapshotApi.createProjectedBundle !== 'function') {
        return {
            generation,
            consumed: false,
            render: legacyRenderFactories.map((factory) => factory()),
            fullInfo: legacyFullInfoFactory
        };
    }
    const stateSnapshotRequest = createDockerRuntimeRequest(runtimeSnapshotApi.buildUrl('docker', 'state', {
        cacheBust,
        liveUpdateStatus,
        forceRefresh: true
    }), {
        source: 'runtime-snapshot-state',
        label: 'Docker runtime snapshot'
    });
    const rememberSnapshot = (snapshot) => {
        rememberDockerRuntimeSnapshot(snapshot);
    };
    return {
        generation,
        consumed: false,
        render: runtimeSnapshotApi.createProjectedBundle(
            stateSnapshotRequest,
            ['folders', 'order', 'runtime', 'prefsResponse'],
            { onSnapshot: rememberSnapshot, fallbackFactories: legacyRenderFactories }
        ),
        fullInfo: () => runtimeSnapshotApi.projectRequest(
            createDockerRuntimeRequest(runtimeSnapshotApi.buildUrl('docker', 'full', {
                cacheBust: Date.now(),
                forceRefresh: true
            }), {
                source: 'runtime-snapshot-full',
                label: 'Docker runtime detail snapshot'
            }),
            'runtime',
            legacyFullInfoFactory
        )
    };
}

// Prime requests for environments where loadlist isn't called first.
folderReq = ensureDockerFolderReqForHostRender();
markDockerFatalBannerStep('Docker request bundle primed');
bindDockerHostOpenDockerPatch();
bindDockerLifecycleEventControlPatch();
bindDockerContainerContextStatePatch();
bindDockerUpdateActionClickCapture();
bindDockerPostUpdateRenderReconcile();
startDockerListViewModeObserver();
bindDockerRuntimePrivacyStorageSync();
queueDockerRuntimePrivacyToggleMount();

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
bindDockerFolderRowActions();
// This is needed because unraid don't like the folder and the number are set incorrectly, this intercept the request and change the numbers to make the order appear right, this is important for the autostart and to draw the folders
$.ajaxPrefilter((options, originalOptions, jqXHR) => {
    if (options.url === "/plugins/dynamix.docker.manager/include/UserPrefs.php") {
        if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] ajaxPrefilter (UserPrefs.php): Intercepted.', {...options});
        const data = new URLSearchParams(options.data);
        if (!data.has('names')) {
            if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] ajaxPrefilter (UserPrefs.php): No names payload, leaving request unchanged.');
            return;
        }
        const containers = data.get('names').split(';');
        let num = "";
        for (let index = 0; index < containers.length - 1; index++) {
            num += index + ';';
        }
        data.set('index', num);
        options.data = data.toString();
        if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] ajaxPrefilter (UserPrefs.php): Modified options.data:', options.data);
    }
});

let folderViewPlusDockerStartOrderSyncTimer = null;
const scheduleFolderViewPlusDockerStartOrderSync = () => {
    clearTimeout(folderViewPlusDockerStartOrderSyncTimer);
    folderViewPlusDockerStartOrderSyncTimer = setTimeout(() => {
        const payload = { type: 'docker' };
        const request = window.FolderViewPlusRequest;
        if (request && typeof request.postJson === 'function') {
            request.postJson('/plugins/folderview.plus/server/sync_order.php', payload, {
                retries: 0,
                timeoutMs: 8000
            }).catch(() => {});
            return;
        }
        pluginRequestClient.postJson('/plugins/folderview.plus/server/sync_order.php', payload, {
            retries: 0,
            timeoutMs: 8000
        }).catch(() => {});
    }, 250);
};

$(document).ajaxComplete((event, xhr, settings = {}) => {
    const url = String(settings.url || '');
    const data = String(settings.data || '');
    const isOrderSave = url.endsWith('/plugins/dynamix.docker.manager/include/UserPrefs.php') && data.includes('names=');
    const isAutostartSave = url.includes('/plugins/dynamix.docker.manager/include/UpdateConfig.php') && /action=(autostart|wait)/.test(data);
    if (isOrderSave || isAutostartSave) {
        scheduleFolderViewPlusDockerStartOrderSync();
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

window.addEventListener('pagehide', () => {
    dockerLiveRefreshController.dispose();
    clearTimeout(queuedLoadlistTimer);
    clearTimeout(dockerPinnedFolderServerReconcileTimer);
    clearTimeout(dockerRuntimePrivacyServerReconcileTimer);
    clearTimeout(dockerSupportBundlePageSnapshotWriteTimer);
    clearTimeout(folderViewPlusDockerStartOrderSyncTimer);
    dockerFolderRowActionsController.destroy();
    dockerRuntimeColumnControllerApi.dispose();
    dockerDeferredPreviewController.destroy();
    dockerProviderHealthController?.dispose?.();
    runtimeHostAdapters?.release?.('docker', { window, restoreHooks: true });
}, { once: true });

if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] docker.js: End of script execution.');
})(window, window.jQuery || window.$);
