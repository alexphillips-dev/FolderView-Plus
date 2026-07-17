(function fvplusDashboardScope(window, $) {
if (!window || !$) {
    return;
}

const folderContract = window.FolderViewPlusFolderContract || null;
const requestClient = window.FolderViewPlusRequest || null;
const runtimeSnapshotApi = window.FolderViewPlusRuntimeSnapshot || null;
const memberIdentityModule = window.FolderViewPlusMemberIdentity || null;
const localDefaultFolderStatusColors = {
    started: '#ffffff',
    paused: '#b8860b',
    stopped: '#ff4d4d'
};
const localResolvedFolderStatusColors = {
    started: 'var(--fvplus-folder-status-started, var(--fvplus-status-started, var(--fvplus-theme-foreground, currentColor)))',
    paused: 'var(--fvplus-folder-status-paused, var(--fvplus-status-paused, #b8860b))',
    stopped: 'var(--fvplus-folder-status-stopped, var(--fvplus-status-stopped, #ff4d4d))'
};
const DEFAULT_FOLDER_ACCENT_COLOR = folderContract?.DEFAULT_FOLDER_ACCENT_COLOR || '#ffca63';
const getPreviewHoverAnimationClass = (settings = {}) => {
    const normalized = String(settings?.preview_hover_animation || settings?.previewHoverAnimation || '').trim().toLowerCase();
    const aliases = { grow: 'pop', pulse: 'glow', spin: 'flip' };
    const token = aliases[normalized] || normalized;
    return ['lift', 'bounce', 'pop', 'glow', 'flip', 'wiggle'].includes(token) ? `fv-hover-animation-${token}` : '';
};
const themeResolver = window.FolderViewPlusThemeResolver || null;
const applyDashboardResolvedThemeTokens = (reason = 'dashboard:initial') => {
    if (window.FolderViewPlusThemeResolverModuleLoaded !== true || !themeResolver) {
        return null;
    }
    return themeResolver.applyResolvedThemeTokens(reason, {
        root: document.body,
        modeInput: 'auto'
    });
};
const normalizeStatusHexColor = (value, fallback) => {
    if (typeof value !== 'string') {
        return fallback;
    }
    const trimmed = value.trim();
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) {
        return fallback;
    }
    if (trimmed.length === 4) {
        return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase();
    }
    return trimmed.toLowerCase();
};
const resolveDashboardFolderStatusColors = (settings) => {
    const colors = typeof utils.getFolderStatusColors === 'function'
        ? utils.getFolderStatusColors(settings)
        : localDefaultFolderStatusColors;
    if (settings?.status_color_lock === true || settings?.statusColorLock === true) {
        return colors;
    }
    return {
        started: colors.started === localDefaultFolderStatusColors.started
            ? localResolvedFolderStatusColors.started
            : colors.started,
        paused: colors.paused === localDefaultFolderStatusColors.paused
            ? localResolvedFolderStatusColors.paused
            : colors.paused,
        stopped: colors.stopped === localDefaultFolderStatusColors.stopped
            ? localResolvedFolderStatusColors.stopped
            : colors.stopped
    };
};
const isFolderAccentEnabled = typeof folderContract?.isFolderAccentEnabled === 'function'
    ? folderContract.isFolderAccentEnabled
    : ((settings) => {
        const source = settings && typeof settings === 'object' ? settings : {};
        if (!Object.prototype.hasOwnProperty.call(source, 'folder_accent_enabled')) {
            return false;
        }
        const raw = source.folder_accent_enabled;
        if (typeof raw === 'string') {
            const normalized = raw.trim().toLowerCase();
            return normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes';
        }
        return raw === true || raw === 1;
    });
const utils = window.FolderViewPlusUtils || {
    normalizePrefs: () => ({
        sortMode: 'created',
        manualOrder: [],
        autoRules: [],
        runtimePrefsSchema: 3,
        liveRefreshEnabled: false,
        liveRefreshSeconds: 20,
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
            privacyMaskExternalUrls: true,
            previewContext: 'native',
            previewTrigger: 'click',
            previewGraph: 1,
            previewGraphTime: 60
        },
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
        const incoming = settings && typeof settings === 'object' ? settings : {};
        return {
            started: normalizeStatusHexColor(incoming.status_color_started, localDefaultFolderStatusColors.started),
            paused: normalizeStatusHexColor(incoming.status_color_paused, localDefaultFolderStatusColors.paused),
            stopped: normalizeStatusHexColor(incoming.status_color_stopped, localDefaultFolderStatusColors.stopped)
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
    },
    DASHBOARD_LAYOUT_OPTIONS: Object.freeze(['classic', 'legacy', 'fullwidth', 'accordion', 'inset', 'compactmatrix', 'embossed']),
    DASHBOARD_LAYOUT_LABELS: Object.freeze({
        classic: 'Classic',
        legacy: 'Legacy',
        fullwidth: 'Full Width',
        accordion: 'Accordion',
        inset: 'Inset',
        compactmatrix: 'Compact Matrix',
        embossed: 'Embossed'
    }),
    normalizeDashboardLayout: (value) => {
        const normalized = String(value || '').trim().toLowerCase();
        return ['classic', 'legacy', 'fullwidth', 'accordion', 'inset', 'compactmatrix', 'embossed'].includes(normalized)
            ? normalized
            : 'classic';
    },
    normalizeDashboardOverflowMode: (value) => {
        const normalized = String(value || '').trim().toLowerCase();
        return ['default', 'expand_row', 'scroll'].includes(normalized) ? normalized : 'default';
    }
};
const reconcileDashboardMemberIdentities = (type, folders, runtimeInfo) => {
    if (!memberIdentityModule || typeof memberIdentityModule.reconcileFolders !== 'function') {
        return folders;
    }
    const result = memberIdentityModule.reconcileFolders(type, folders, runtimeInfo);
    const patches = result?.patches && typeof result.patches === 'object' ? result.patches : {};
    if (Object.keys(patches).length > 0 && typeof window.FolderViewPlusRequest?.postJson === 'function') {
        window.FolderViewPlusRequest.postJson('/plugins/folderview.plus/server/reconcile_member_identities.php', {
            type,
            patches: JSON.stringify(patches)
        }, { retries: 0 }).catch((error) => {
            console.warn(`folderview.plus: ${type} member identity reconciliation could not be persisted from Dashboard.`, error);
        });
    }
    window.FolderViewPlusMemberIdentityDiagnostics = {
        ...(window.FolderViewPlusMemberIdentityDiagnostics || {}),
        [type]: result?.diagnostics || {}
    };
    return result?.folders || folders;
};
const dashboardPrefsCoordinator = window.FolderViewPlusPrefsStore?.getDefaultCoordinator({
    normalizePrefs: utils.normalizePrefs,
    request: window.FolderViewPlusRequest
}) || null;
const normalizeDashboardPrefsResponse = (type, response = {}) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const normalized = utils.normalizePrefs({
        ...(response?.prefs || {}),
        _metadata: response?.metadata || response?.prefs?._metadata || {}
    });
    return dashboardPrefsCoordinator
        ? dashboardPrefsCoordinator.reconcile(resolvedType, normalized)
        : normalized;
};
const dashboardStorageWriter = typeof utils.createBatchedStorageWriter === 'function'
    ? utils.createBatchedStorageWriter(window.localStorage, {
        defaultDelayMs: 84,
        idleTimeoutMs: 900
    })
    : null;
const FOLDER_LABEL_KEYS = ['folderview.plus', 'folder.view3', 'folder.view2', 'folder.view'];
const getFolderLabelValue = (labels) => {
    const source = labels && typeof labels === 'object' ? labels : {};
    for (const key of FOLDER_LABEL_KEYS) {
        if (typeof source[key] === 'string' && source[key].trim() !== '') {
            return source[key].trim();
        }
    }
    return '';
};
const dashboardFolderMatchCacheModule = window.FolderViewPlusDashboardFolderMatchCache || null;
const dashboardBootstrapMissingModules = [];
if (!window.FolderViewPlusUtils || typeof window.FolderViewPlusUtils.normalizePrefs !== 'function') {
    dashboardBootstrapMissingModules.push('folderviewplus.utils.js');
}
if (
    !window.FolderViewPlusRequest
    || typeof window.FolderViewPlusRequest.getJson !== 'function'
    || typeof window.FolderViewPlusRequest.postJson !== 'function'
) {
    dashboardBootstrapMissingModules.push('folderviewplus.request.js');
}
if (!window.FolderViewPlusDashboardFolderMatchCache || typeof window.FolderViewPlusDashboardFolderMatchCache.createApi !== 'function') {
    dashboardBootstrapMissingModules.push('dashboard.folder-match-cache.js');
}
if (dashboardBootstrapMissingModules.length > 0) {
    const error = new Error(`FolderView Plus Dashboard bootstrap failed. Missing modules: ${dashboardBootstrapMissingModules.join(', ')}`);
    error.fvplusBannerShown = true;
    throw error;
}
if (!dashboardFolderMatchCacheModule || typeof dashboardFolderMatchCacheModule.createApi !== 'function') {
    console.error('folderview.plus dashboard: missing dashboard.folder-match-cache.js');
    return;
}
const dashboardFolderMatchCacheApi = dashboardFolderMatchCacheModule.createApi({
    utils,
    folderRegex: /^folder-/,
    getFolderLabelValue
});
const {
    getPrefsOrderedFolderMap,
    sortFolderIdsByPrefs,
    filterDashboardToRootFolders,
    buildFolderChildrenIndex,
    aggregateRootMatchCache,
    reorderFolderSlotsInBaseOrder,
    parseJsonPayloadSafe,
    buildDockerStateSignature,
    buildVmStateSignature,
    buildDashboardDockerFolderMatchCache,
    buildDashboardVmFolderMatchCache
} = dashboardFolderMatchCacheApi;
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
const DEFAULT_FOLDER_ICON_PATH = '/plugins/folderview.plus/images/folder-icon.png';
const WEBUI_OPEN_REL = 'noopener';
const getSafeWebUiUrl = (value) => {
    const raw = String(value || '').trim();
    return raw && !/^javascript:/i.test(raw) ? raw : '';
};
const openWebUiInNewTab = (url) => {
    const safeUrl = getSafeWebUiUrl(url);
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
const dashboardAdvancedPreviewModule = window.FolderViewPlusDashboardAdvancedPreview || null;
const dashboardAdvancedPreviewApi = dashboardAdvancedPreviewModule && typeof dashboardAdvancedPreviewModule.createApi === 'function'
    ? dashboardAdvancedPreviewModule.createApi({
        window,
        document,
        $,
        escapeHtml,
        sanitizeImageSrc,
        getSafeWebUiUrl,
        openWebUiInNewTab
    })
    : null;
const getDashboardAdvancedPreviewSettings = () => {
    const dashboard = utils.normalizePrefs(folderTypePrefs?.docker || {}).dashboard || {};
    const graph = Number(dashboard.previewGraph);
    const graphTime = Number(dashboard.previewGraphTime);
    return {
        previewContext: dashboard.previewContext === 'advanced' ? 'advanced' : 'native',
        previewTrigger: dashboard.previewTrigger === 'hover' ? 'hover' : 'click',
        previewGraph: Number.isFinite(graph) ? Math.max(0, Math.min(4, Math.round(graph))) : 1,
        previewGraphTime: Number.isFinite(graphTime) ? Math.max(5, Math.min(600, Math.round(graphTime))) : 60
    };
};
const resolveDashboardPreviewActionPrefs = (settings = {}) => (
    typeof utils.resolvePreviewActionPrefs === 'function'
        ? utils.resolvePreviewActionPrefs(settings)
        : {
            preview_webui: settings?.preview_webui === true,
            preview_console: settings?.preview_console === true,
            preview_logs: settings?.preview_logs === true
        }
);
const attachDashboardAdvancedPreviewIfEnabled = ($containerEl, ct, folder, id) => {
    if (!dashboardAdvancedPreviewApi || typeof dashboardAdvancedPreviewApi.attachAdvancedPreview !== 'function') {
        return false;
    }
    const settings = getDashboardAdvancedPreviewSettings();
    if (settings.previewContext !== 'advanced') {
        return false;
    }
    if (!$containerEl || !$containerEl.length || !ct || typeof ct !== 'object') {
        return false;
    }
    const $target = $containerEl.children('span.hand').first().length
        ? $containerEl.children('span.hand').first()
        : $containerEl;
    const folderSettings = folder && typeof folder === 'object' ? (folder.settings || {}) : {};
    const actionPrefs = resolveDashboardPreviewActionPrefs(folderSettings);
    return dashboardAdvancedPreviewApi.attachAdvancedPreview({
        triggerEl: $target,
        ct,
        folder,
        id,
        cpus: dashboardDockerCpuCores || window.fvplusCpuCores || window.fv3CpuCores || 1,
        settings: {
            previewTrigger: settings.previewTrigger,
            previewGraph: settings.previewGraph,
            previewGraphTime: settings.previewGraphTime,
            ...actionPrefs
        }
    });
};
const appendDashboardDockerMemberQuickActions = ($containerEl, ct, settings = {}) => {
    if (!$containerEl || !$containerEl.length || !ct || typeof ct !== 'object') {
        return;
    }
    const actionPrefs = resolveDashboardPreviewActionPrefs(settings);
    const allowWebUiAction = actionPrefs.preview_webui === true;
    const allowConsoleAction = actionPrefs.preview_console === true;
    const allowLogsAction = actionPrefs.preview_logs === true;
    let $targetForAppend = $containerEl.children('span.inner').last();
    if (!$targetForAppend.length) {
        $targetForAppend = $containerEl;
    }
    if (!$targetForAppend.length) {
        return;
    }

    let $actionBar = $targetForAppend.children('span.fv-dashboard-member-actions');
    if (!$actionBar.length) {
        $actionBar = $('<span class="fv-dashboard-member-actions"></span>');
        $targetForAppend.append($actionBar);
    } else {
        $actionBar.empty();
    }

    const webUiUrl = getSafeWebUiUrl(ct?.info?.State?.WebUi);
    if (allowWebUiAction && webUiUrl) {
        const $web = $(
            '<a class="fv-dashboard-member-action fv-dashboard-member-webui" target="_blank" rel="noopener noreferrer" title="WebUI" aria-label="WebUI">' +
                '<i class="fa fa-globe" aria-hidden="true"></i>' +
            '</a>'
        );
        $web.attr('href', webUiUrl);
        $web.on('click', (event) => {
            event.preventDefault();
            openWebUiInNewTab(webUiUrl);
        });
        $actionBar.append($web);
    }

    const containerName = String(ct?.info?.Name || '').trim();
    const containerShell = String(ct?.info?.Shell || 'sh').trim() || 'sh';
    if (containerName && typeof window.openTerminal === 'function') {
        if (allowConsoleAction) {
            const $console = $(
                '<a href="#" class="fv-dashboard-member-action fv-dashboard-member-console" title="Console" aria-label="Console">' +
                    '<i class="fa fa-terminal" aria-hidden="true"></i>' +
                '</a>'
            );
            $console.on('click', (event) => {
                event.preventDefault();
                window.openTerminal('docker', containerName, containerShell);
            });
            $actionBar.append($console);
        }

        if (allowLogsAction) {
            const $logs = $(
                '<a href="#" class="fv-dashboard-member-action fv-dashboard-member-logs" title="Logs" aria-label="Logs">' +
                    '<i class="fa fa-bars" aria-hidden="true"></i>' +
                '</a>'
            );
            $logs.on('click', (event) => {
                event.preventDefault();
                window.openTerminal('docker', containerName, '.log');
            });
            $actionBar.append($logs);
        }
    }

    if (!$actionBar.children().length) {
        $actionBar.remove();
    }
};
const DASHBOARD_DEBUG_MODE = false;
const dashboardDebugLog = (...args) => {
    if (DASHBOARD_DEBUG_MODE) {
        console.log(...args);
    }
};
const DASHBOARD_LAYOUT_MODES = Array.isArray(utils.DASHBOARD_LAYOUT_OPTIONS)
    ? utils.DASHBOARD_LAYOUT_OPTIONS
    : ['classic', 'legacy', 'fullwidth', 'accordion', 'inset', 'compactmatrix', 'embossed'];
const DASHBOARD_LAYOUT_LABELS = utils.DASHBOARD_LAYOUT_LABELS || Object.freeze({
    classic: 'Classic',
    legacy: 'Legacy',
    fullwidth: 'Full Width',
    accordion: 'Accordion',
    inset: 'Inset',
    compactmatrix: 'Compact Matrix',
    embossed: 'Embossed'
});
const normalizeDashboardLayoutMode = typeof utils.normalizeDashboardLayout === 'function'
    ? utils.normalizeDashboardLayout
    : ((value) => {
        const normalized = String(value || '').trim().toLowerCase();
        return DASHBOARD_LAYOUT_MODES.includes(normalized) ? normalized : 'classic';
    });
const normalizeDashboardOverflowMode = typeof utils.normalizeDashboardOverflowMode === 'function'
    ? utils.normalizeDashboardOverflowMode
    : ((value) => {
        const normalized = String(value || '').trim().toLowerCase();
        return ['default', 'expand_row', 'scroll'].includes(normalized) ? normalized : 'default';
    });
const dashboardLayoutQuickRailModule = window.FolderViewPlusDashboardLayoutQuickRail || null;
const normalizeDashboardPrefsForType = (type) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const prefs = utils.normalizePrefs(folderTypePrefs?.[resolvedType] || {});
    const dashboard = prefs?.dashboard && typeof prefs.dashboard === 'object'
        ? prefs.dashboard
        : {};
    return {
        layout: typeof utils.normalizeDashboardLayout === 'function'
            ? utils.normalizeDashboardLayout(dashboard.layout)
            : normalizeDashboardLayoutMode(dashboard.layout),
        expandToggle: dashboard.expandToggle !== false,
        greyscale: dashboard.greyscale === true,
        folderLabel: dashboard.folderLabel !== false,
        privacyMode: dashboard.privacyMode === true,
        privacyMaskNames: dashboard.privacyMaskNames !== false,
        privacyMaskContainerIps: dashboard.privacyMaskContainerIps !== false,
        privacyMaskLocalIps: dashboard.privacyMaskLocalIps !== false,
        privacyMaskPorts: dashboard.privacyMaskPorts !== false,
        privacyMaskVolumePaths: dashboard.privacyMaskVolumePaths !== false,
        privacyMaskImageRegistry: dashboard.privacyMaskImageRegistry !== false,
        privacyMaskVmDiskPaths: dashboard.privacyMaskVmDiskPaths !== false,
        privacyMaskMacAddresses: dashboard.privacyMaskMacAddresses !== false,
        privacyMaskPublicIps: dashboard.privacyMaskPublicIps !== false,
        privacyMaskInterfaces: dashboard.privacyMaskInterfaces !== false,
        privacyMaskExternalUrls: dashboard.privacyMaskExternalUrls !== false
    };
};
const dashboardTypeMeta = (type) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    return {
        type: resolvedType,
        tbodySelector: resolvedType === 'vm' ? 'tbody#vm_view' : 'tbody#docker_view',
        outerSelector: resolvedType === 'vm' ? 'span.outer.vms.folder-vm' : 'span.outer.apps.folder-docker'
    };
};
let dashboardQuickRailController = null;
const getDashboardQuickRailController = () => {
    if (dashboardQuickRailController) {
        return dashboardQuickRailController;
    }
    if (!dashboardLayoutQuickRailModule || typeof dashboardLayoutQuickRailModule.createController !== 'function') {
        return null;
    }
    dashboardQuickRailController = dashboardLayoutQuickRailModule.createController({
        window,
        $,
        dashboardTypeMeta,
        dashboardLayoutModes: DASHBOARD_LAYOUT_MODES,
        dashboardLayoutLabels: DASHBOARD_LAYOUT_LABELS,
        normalizeDashboardPrefsForType,
        getDashboardStartedOnlySelectorForType,
        isDashboardStartedOnlyEnabledForType: (type) => isDashboardStartedOnlyEnabledForType(type),
        readDashboardHealthEmphasisStateForType: (type) => readDashboardHealthEmphasisStateForType(type),
        readDashboardCompactDensityStateForType: (type) => readDashboardCompactDensityStateForType(type),
        isDashboardLegacyLayoutForType: (type) => isDashboardLegacyLayoutForType(type),
        isDashboardLayoutTransitionInFlightForType: (type) => isDashboardLayoutTransitionInFlightForType(type),
        resolveFolderIdFromCard: ($card) => resolveFolderIdFromCard($card),
        updateExpandToggleIcon: ($card, expanded) => updateExpandToggleIcon($card, expanded),
        onLayoutCycle: (type, nextLayout) => handleDashboardWidgetLayoutQuickSwitch(type, nextLayout),
        onToggleExpandAll: (type) => toggleDashboardExpandAllForType(type),
        onSetStartedOnlyEnabled: (type, enabled) => setDashboardStartedOnlyEnabledForType(type, enabled),
        onToggleHealthEmphasis: (type, enabled) => {
            writeDashboardHealthEmphasisStateForType(type, enabled);
            scheduleDashboardLayoutApplyForType(type);
        },
        onToggleDensity: (type, enabled) => {
            writeDashboardCompactDensityStateForType(type, enabled);
            scheduleDashboardLayoutApplyForType(type);
        },
        onResetView: (type) => resetDashboardWidgetViewStateForType(type),
        onOpenSettings: () => openFolderViewPlusSettings()
    });
    return dashboardQuickRailController;
};
const resolveDashboardWidgetInlineHostForType = (type) => {
    const controller = getDashboardQuickRailController();
    return controller ? controller.resolveDashboardWidgetInlineHostForType(type) : $();
};
const DASHBOARD_HEALTH_EMPHASIS_STORAGE_KEYS = Object.freeze({
    docker: 'fvplus.runtime.dashboard.health-emphasis.docker.v1',
    vm: 'fvplus.runtime.dashboard.health-emphasis.vm.v1'
});
const DASHBOARD_COMPACT_DENSITY_STORAGE_KEYS = Object.freeze({
    docker: 'fvplus.runtime.dashboard.compact-density.docker.v1',
    vm: 'fvplus.runtime.dashboard.compact-density.vm.v1'
});
const readDashboardHealthEmphasisStateForType = (type) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const storageKey = DASHBOARD_HEALTH_EMPHASIS_STORAGE_KEYS[resolvedType];
    if (!storageKey) {
        return false;
    }
    try {
        const raw = window.localStorage && window.localStorage.getItem(storageKey);
        return raw === '1';
    } catch (_error) {
        return false;
    }
};
const writeDashboardHealthEmphasisStateForType = (type, enabled) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const storageKey = DASHBOARD_HEALTH_EMPHASIS_STORAGE_KEYS[resolvedType];
    if (!storageKey) {
        return;
    }
    try {
        if (!window.localStorage) {
            return;
        }
        if (dashboardStorageWriter && typeof dashboardStorageWriter.setItem === 'function') {
            dashboardStorageWriter.setItem(storageKey, enabled === true ? '1' : '0', { delayMs: 70, idle: true });
        } else {
            window.localStorage.setItem(storageKey, enabled === true ? '1' : '0');
        }
    } catch (_error) {
        // Ignore localStorage failures so dashboard rendering remains stable.
    }
};
const readDashboardCompactDensityStateForType = (type) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const storageKey = DASHBOARD_COMPACT_DENSITY_STORAGE_KEYS[resolvedType];
    if (!storageKey) {
        return false;
    }
    try {
        const raw = window.localStorage && window.localStorage.getItem(storageKey);
        return raw === '1';
    } catch (_error) {
        return false;
    }
};
const writeDashboardCompactDensityStateForType = (type, enabled) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const storageKey = DASHBOARD_COMPACT_DENSITY_STORAGE_KEYS[resolvedType];
    if (!storageKey) {
        return;
    }
    try {
        if (!window.localStorage) {
            return;
        }
        if (dashboardStorageWriter && typeof dashboardStorageWriter.setItem === 'function') {
            dashboardStorageWriter.setItem(storageKey, enabled === true ? '1' : '0', { delayMs: 70, idle: true });
        } else {
            window.localStorage.setItem(storageKey, enabled === true ? '1' : '0');
        }
    } catch (_error) {
        // Ignore localStorage failures so dashboard rendering remains stable.
    }
};
const getDashboardStartedOnlySelectorForType = (type) => (type === 'vm' ? 'input#vms' : 'input#apps');
const isDashboardLegacyLayoutForType = (type) => normalizeDashboardPrefsForType(type).layout === 'legacy';
const isDashboardLayoutTransitionInFlightForType = (type) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    return dashboardLayoutTransitionInFlightByType?.[resolvedType] === true;
};
const getDashboardNativeRowSelectorForType = (type) => (
    type === 'vm'
        ? 'span.outer.vms:not(.folder-vm)'
        : 'span.outer.apps:not(.folder-docker)'
);
const getDashboardNativeRowName = ($row) => String(
    $row?.find('span.inner').contents().first().text() || ''
).trim();
const stripDashboardFolderizedStateFromRow = ($row) => {
    if (!$row || !$row.length) {
        return;
    }
    $row.find('span.fv-dashboard-member-actions').remove();
    $row.removeClass((_, className = '') => className
        .split(/\s+/)
        .filter((token) => {
            if (!token) {
                return false;
            }
            if (token === 'folder-element-docker' || token === 'folder-element-vm' || token === 'autostart') {
                return true;
            }
            return /^folder-[A-Za-z0-9._-]+-element$/.test(token);
        })
        .join(' '));
};
const readDashboardNativeOrderSnapshotForType = async (type) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const existingReq = Array.isArray(folderReq?.[resolvedType]) ? folderReq[resolvedType][3] : null;
    if (existingReq && typeof existingReq.then === 'function') {
        try {
            return Object.values(JSON.parse(await existingReq));
        } catch (_error) {
            // Fall through to a fresh fetch.
        }
    }
    try {
        const payload = await requestClient.getJson('/plugins/folderview.plus/server/read_unraid_order.php', {
            data: { type: resolvedType }
        });
        return Object.values(payload);
    } catch (_error) {
        return [];
    }
};
const restoreDashboardNativeRowsForType = async (type) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const $container = resolveDashboardWidgetInlineHostForType(resolvedType).first();
    if (!$container.length) {
        return;
    }
    const selector = getDashboardNativeRowSelectorForType(resolvedType);
    const rowEntries = [];
    $container.find(selector).each((_, node) => {
        const $row = $(node);
        if ($row.closest('.fv-dashboard-layout-inline-host').length) {
            return;
        }
        rowEntries.push({
            $row,
            name: getDashboardNativeRowName($row)
        });
    });
    rowEntries.forEach((entry) => {
        stripDashboardFolderizedStateFromRow(entry.$row);
        entry.$row.detach();
    });
    $container.children('.folder-showcase-outer').remove();
    const orderSnapshot = await readDashboardNativeOrderSnapshotForType(resolvedType);
    const rowMap = new Map();
    const appended = new Set();
    for (const entry of rowEntries) {
        if (entry.name && !rowMap.has(entry.name)) {
            rowMap.set(entry.name, entry);
        }
    }
    for (const name of orderSnapshot) {
        const key = String(name || '').trim();
        if (!key || !rowMap.has(key) || appended.has(key)) {
            continue;
        }
        appended.add(key);
        $container.append(rowMap.get(key).$row);
    }
    for (const entry of rowEntries) {
        const key = String(entry.name || '').trim();
        if (key && appended.has(key)) {
            continue;
        }
        $container.append(entry.$row);
    }
    if (resolvedType === 'vm') {
        globalFolders.vms = {};
    } else {
        globalFolders.docker = {};
    }
};
const isDashboardStartedOnlyEnabledForType = (type) => {
    const selector = getDashboardStartedOnlySelectorForType(type);
    const $toggle = $(selector).first();
    return $toggle.length ? $toggle.is(':checked') : false;
};
const setDashboardStartedOnlyEnabledForType = (type, enabled) => {
    const selector = getDashboardStartedOnlySelectorForType(type);
    const $toggle = $(selector).first();
    if (!$toggle.length) {
        return false;
    }
    const nextValue = enabled === true;
    if ($toggle.is(':checked') === nextValue) {
        return true;
    }
    $toggle.prop('checked', nextValue);
    $toggle.trigger('change');
    queueLoadlistRefresh();
    return true;
};
const getDashboardFolderIdsForType = (type) => {
    const controller = getDashboardQuickRailController();
    return controller ? controller.getDashboardFolderIdsForType(type) : [];
};
const areAllDashboardFoldersExpandedForType = (type) => {
    const controller = getDashboardQuickRailController();
    return controller ? controller.areAllDashboardFoldersExpandedForType(type) : false;
};
const toggleDashboardExpandAllForType = (type) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const ids = getDashboardFolderIdsForType(resolvedType);
    if (!ids.length) {
        return;
    }
    const targetExpanded = !areAllDashboardFoldersExpandedForType(resolvedType);
    for (const id of ids) {
        toggleFolderExpansion(resolvedType, id, {
            forceExpanded: targetExpanded,
            persistExpandedState: true,
            suppressAccordion: true
        });
    }
};
const openFolderViewPlusSettings = () => {
    window.location.href = '/Settings/FolderViewPlus';
};
const resetDashboardWidgetViewStateForType = (type) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    setDashboardStartedOnlyEnabledForType(resolvedType, false);
    writeDashboardHealthEmphasisStateForType(resolvedType, false);
    writeDashboardCompactDensityStateForType(resolvedType, false);

    const ids = getDashboardFolderIdsForType(resolvedType);
    for (const id of ids) {
        toggleFolderExpansion(resolvedType, id, {
            forceExpanded: false,
            persistExpandedState: false,
            suppressAccordion: true
        });
    }
    writeDashboardExpandedStateMap(resolvedType, {});
    scheduleDashboardLayoutApplyForType(resolvedType);
    syncDashboardWidgetLayoutQuickControlForType(resolvedType);
};
const syncDashboardWidgetLayoutQuickControlForType = (type) => {
    const controller = getDashboardQuickRailController();
    if (controller) {
        controller.syncDashboardWidgetLayoutQuickControlForType(type);
    }
};
const saveDashboardLayoutPrefForType = async (type, prefsPayload) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    if (dashboardPrefsCoordinator) {
        const prefs = await dashboardPrefsCoordinator.save(resolvedType, prefsPayload || {}, {
            currentPrefs: folderTypePrefs?.[resolvedType] || {},
            immediate: true
        });
        return { ok: true, prefs };
    }
    return requestClient.postJson('/plugins/folderview.plus/server/prefs.php', {
        type: resolvedType,
        prefs: JSON.stringify(prefsPayload || {})
    }, {
        retries: 0,
        timeoutMs: 10000
    });
};
const rerenderDashboardWidgetStructureForType = async (type) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    dashboardLayoutTransitionInFlightByType[resolvedType] = true;
    scheduleDashboardWidgetVisibilitySyncForType(resolvedType, 0);
    try {
        await restoreDashboardNativeRowsForType(resolvedType);
        if (isDashboardLegacyLayoutForType(resolvedType)) {
            scheduleDashboardLayoutApplyForType(resolvedType);
            syncDashboardWidgetLayoutQuickControlForType(resolvedType);
            scheduleDashboardWidgetVisibilitySyncForType(resolvedType, 0);
            return;
        }
        prepareDashboardFolderRequestsForType(resolvedType);
        await createFolders([resolvedType]);
        scheduleDashboardWidgetVisibilitySyncForType(resolvedType, 0);
    } finally {
        dashboardLayoutTransitionInFlightByType[resolvedType] = false;
        scheduleDashboardWidgetVisibilitySyncForType(resolvedType, 0);
    }
};
const handleDashboardWidgetLayoutQuickSwitch = async (type, value) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const nextLayout = normalizeDashboardLayoutMode(value);
    const previousPrefs = utils.normalizePrefs(folderTypePrefs?.[resolvedType] || {});
    const previousDashboard = normalizeDashboardPrefsForType(resolvedType);
    const requiresStructureReload = previousDashboard.layout === 'legacy' || nextLayout === 'legacy';
    if (previousDashboard.layout === nextLayout) {
        syncDashboardWidgetLayoutQuickControlForType(resolvedType);
        return;
    }

    const nextPrefs = {
        ...previousPrefs,
        dashboard: {
            ...previousDashboard,
            layout: nextLayout
        }
    };
    const saveToken = (dashboardLayoutPersistTokenByType[resolvedType] || 0) + 1;
    dashboardLayoutPersistTokenByType[resolvedType] = saveToken;
    if (requiresStructureReload) {
        dashboardLayoutTransitionInFlightByType[resolvedType] = true;
        scheduleDashboardWidgetVisibilitySyncForType(resolvedType, 0);
    }
    folderTypePrefs[resolvedType] = utils.normalizePrefs(nextPrefs);
    scheduleDashboardLayoutApplyForType(resolvedType);
    syncDashboardWidgetLayoutQuickControlForType(resolvedType);

    try {
        const response = await saveDashboardLayoutPrefForType(resolvedType, nextPrefs);
        if (dashboardLayoutPersistTokenByType[resolvedType] !== saveToken) {
            return;
        }
        if (!response || response.ok !== true) {
            throw new Error(response?.error || 'Failed to save dashboard preferences.');
        }
        folderTypePrefs[resolvedType] = utils.normalizePrefs(response.prefs || nextPrefs);
        if (requiresStructureReload) {
            await rerenderDashboardWidgetStructureForType(resolvedType);
            return;
        }
        scheduleDashboardLayoutApplyForType(resolvedType);
        syncDashboardWidgetLayoutQuickControlForType(resolvedType);
    } catch (_error) {
        if (dashboardLayoutPersistTokenByType[resolvedType] !== saveToken) {
            if (requiresStructureReload) {
                dashboardLayoutTransitionInFlightByType[resolvedType] = false;
                scheduleDashboardWidgetVisibilitySyncForType(resolvedType, 0);
            }
            return;
        }
        if (requiresStructureReload) {
            dashboardLayoutTransitionInFlightByType[resolvedType] = false;
            scheduleDashboardWidgetVisibilitySyncForType(resolvedType, 0);
        }
        folderTypePrefs[resolvedType] = previousPrefs;
        scheduleDashboardLayoutApplyForType(resolvedType);
        syncDashboardWidgetLayoutQuickControlForType(resolvedType);
        if (typeof window.swal === 'function') {
            window.swal({
                title: 'Error',
                text: 'Unable to save dashboard view preference.',
                type: 'error'
            });
        }
    }
};
const getDashboardCard = (type, id) => {
    const meta = dashboardTypeMeta(type);
    return $(`${meta.tbodySelector} .folder-showcase-outer-${id}`).first();
};
const updateExpandToggleIcon = ($card, expanded) => {
    if (!$card || !$card.length) {
        return;
    }
    const icon = $card.find('.fv-dashboard-expand-toggle-btn i.fa').first();
    if (!icon.length) {
        return;
    }
    icon.toggleClass('fa-chevron-down', expanded !== true);
    icon.toggleClass('fa-chevron-up', expanded === true);
};
const applyFolderDashboardCardSettings = (type, id, folder) => {
    const $card = getDashboardCard(type, id);
    if (!$card.length) {
        return;
    }
    const overflowMode = normalizeDashboardOverflowMode(folder?.settings?.dashboard_overflow);
    const isExpanded = $card.attr('expanded') === 'true';
    $card.attr('data-fv-folder-id', String(id || '').trim());
    $card.attr('data-fv-dashboard-overflow', overflowMode);
    $card.toggleClass('fv-dashboard-overflow-scroll', overflowMode === 'scroll');
    $card.toggleClass('fv-dashboard-overflow-expand-row', overflowMode === 'expand_row');
    $card.toggleClass('fv-dashboard-card-expanded', isExpanded);
    $card.toggleClass('fv-dashboard-card-collapsed', !isExpanded);
    $card.toggleClass('fv-folder-has-accent', isFolderAccentEnabled(folder?.settings || {}));
    if ($card[0]?.style) {
        $card[0].style.removeProperty('--fv-folder-accent-color');
        if (isFolderAccentEnabled(folder?.settings || {})) {
            $card[0].style.setProperty(
                '--fv-folder-accent-color',
                normalizeStatusHexColor(folder?.settings?.folder_accent_color, DEFAULT_FOLDER_ACCENT_COLOR)
            );
        }
    }
    updateExpandToggleIcon($card, isExpanded);
};
const getGlobalFoldersForType = (type) => (type === 'vm' ? globalFolders?.vms : globalFolders?.docker);
const setFolderExpandedState = (type, id, expanded) => {
    const map = getGlobalFoldersForType(type);
    if (map && map[id] && map[id].status) {
        map[id].status.expanded = expanded === true;
    }
};
const DASHBOARD_EXPANDED_STATE_STORAGE_KEYS = Object.freeze({
    docker: 'fvplus.runtime.expand.dashboard.docker.v1',
    vm: 'fvplus.runtime.expand.dashboard.vm.v1'
});
const normalizeExpandedStateMap = (value) => {
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
};
const readDashboardExpandedStateMap = (type) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const storageKey = DASHBOARD_EXPANDED_STATE_STORAGE_KEYS[resolvedType];
    if (!storageKey) {
        return {};
    }
    try {
        const raw = window.localStorage && window.localStorage.getItem(storageKey);
        if (!raw) {
            return {};
        }
        return normalizeExpandedStateMap(JSON.parse(raw));
    } catch (_error) {
        return {};
    }
};
const writeDashboardExpandedStateMap = (type, map) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const storageKey = DASHBOARD_EXPANDED_STATE_STORAGE_KEYS[resolvedType];
    if (!storageKey) {
        return;
    }
    try {
        if (window.localStorage) {
            const payload = JSON.stringify(normalizeExpandedStateMap(map));
            if (dashboardStorageWriter && typeof dashboardStorageWriter.setItem === 'function') {
                dashboardStorageWriter.setItem(storageKey, payload, { delayMs: 80, idle: true });
            } else {
                window.localStorage.setItem(storageKey, payload);
            }
        }
    } catch (_error) {
        // Ignore localStorage failures so dashboard rendering remains stable.
    }
};
const applyDashboardExpandedStateChanges = (type, changes) => {
    if (!changes || typeof changes !== 'object') {
        return;
    }
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const current = readDashboardExpandedStateMap(resolvedType);
    let dirty = false;
    for (const [rawId, expanded] of Object.entries(changes)) {
        const id = String(rawId || '').trim();
        if (!id) {
            continue;
        }
        const nextValue = expanded === true;
        if (current[id] !== nextValue) {
            current[id] = nextValue;
            dirty = true;
        }
    }
    if (dirty) {
        writeDashboardExpandedStateMap(resolvedType, current);
    }
};
const resolveFolderIdFromCard = ($card) => {
    if (!$card || !$card.length) {
        return '';
    }
    const fromAttr = String($card.attr('data-fv-folder-id') || '').trim();
    if (fromAttr) {
        return fromAttr;
    }
    const className = String($card.attr('class') || '');
    const match = className.match(/folder-showcase-outer-([A-Za-z0-9._-]+)/);
    return match ? String(match[1] || '').trim() : '';
};
const scheduleDashboardLayoutApplyForType = (type) => {
    const controller = getDashboardQuickRailController();
    if (controller) {
        controller.scheduleDashboardLayoutApplyForType(type);
    }
};
const scheduleDashboardWidgetVisibilitySyncForType = (type, delayMs = 40) => {
    const controller = getDashboardQuickRailController();
    if (controller) {
        controller.scheduleDashboardWidgetVisibilitySyncForType(type, delayMs);
    }
};
const bindDashboardQuickActionSyncHandlers = () => {
    const controller = getDashboardQuickRailController();
    if (controller) {
        controller.bindDashboardQuickActionSyncHandlers();
    }
};

const showDashboardRuntimeLoadingRow = (type) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const tbodyId = resolvedType === 'docker' ? 'docker_view' : 'vm_view';
    const label = resolvedType === 'docker' ? 'Docker' : 'VM';
    const tbody = $(`tbody#${tbodyId}`);
    if (!tbody.length || tbody.find('tr.fv-runtime-loading-row').length) {
        return;
    }
    tbody.prepend(`<tr class="fv-runtime-loading-row"><td colspan="18"><i class="fa fa-circle-o-notch fa-spin"></i> Loading ${label} folders...</td></tr>`);
};

const hideDashboardRuntimeLoadingRow = (type) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const tbodyId = resolvedType === 'docker' ? 'docker_view' : 'vm_view';
    $(`tbody#${tbodyId} tr.fv-runtime-loading-row`).remove();
};

let createFoldersInFlight = false;
let createFoldersQueued = false;
let createFoldersPromise = null;
const dashboardRequestDiagnostics = {
    docker: [],
    vm: []
};
const parseDashboardPayloadOr = (payload, fallback) => {
    try {
        const parsed = parseJsonPayloadSafe(payload);
        return parsed === undefined || parsed === null ? fallback : parsed;
    } catch (_error) {
        return fallback;
    }
};
const recordDashboardRequestFallback = (type, label, error) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const list = dashboardRequestDiagnostics[resolvedType] || [];
    const entry = {
        at: new Date().toISOString(),
        label: String(label || 'request'),
        status: Number(error?.status || 0),
        statusText: String(error?.statusText || error?.message || 'request failed').slice(0, 160)
    };
    list.push(entry);
    if (list.length > 12) {
        list.shift();
    }
    dashboardRequestDiagnostics[resolvedType] = list;
    if (window.console && typeof window.console.warn === 'function') {
        console.warn(`[FolderView Plus] Dashboard ${resolvedType} ${entry.label} failed; using fallback.`, error);
    }
};
const getDashboardRequestWithFallback = (type, label, url, fallback) => requestClient.getText(url)
    .then((data) => data, (error) => {
        recordDashboardRequestFallback(type, label, error);
        return JSON.stringify(fallback);
    });
const ensureDashboardFolderDefaults = (folder) => {
    const target = folder && typeof folder === 'object' ? folder : {};
    target.name = String(target.name || 'Folder');
    target.icon = String(target.icon || DEFAULT_FOLDER_ICON_PATH).trim() || DEFAULT_FOLDER_ICON_PATH;
    target.containers = Array.isArray(target.containers) ? target.containers : [];
    target.settings = target.settings && typeof target.settings === 'object' ? target.settings : {};
    target.actions = Array.isArray(target.actions) ? target.actions : [];
    target.status = target.status && typeof target.status === 'object' ? target.status : {};
    return target;
};
const normalizeDashboardFolderMap = (folders) => {
    const source = folders && typeof folders === 'object' ? folders : {};
    Object.keys(source).forEach((id) => {
        source[id] = ensureDashboardFolderDefaults(source[id]);
    });
    return source;
};
const sanitizeDashboardInfoForDebug = (type, info) => {
    const source = info && typeof info === 'object' ? info : {};
    const sanitized = {};
    Object.entries(source).forEach(([name, value]) => {
        if (type === 'vm') {
            sanitized[name] = {
                uuid: String(value?.uuid || '').slice(0, 12),
                state: String(value?.state || ''),
                autostart: value?.autostart === true
            };
            return;
        }
        const state = value?.info?.State || {};
        sanitized[name] = {
            shortId: String(value?.shortId || '').slice(0, 12),
            manager: String(state.manager || ''),
            running: state.Running === true,
            paused: state.Paused === true,
            updated: state.Updated !== false,
            autostart: state.Autostart !== false
        };
    });
    return sanitized;
};
const collectDashboardRenderDiagnosticsForType = (type) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const tbodyId = resolvedType === 'docker' ? 'docker_view' : 'vm_view';
    const nameSelector = resolvedType === 'docker' ? '.folder-appname-docker' : '.folder-appname-vm';
    return Array.from(document.querySelectorAll(`tbody#${tbodyId} .folder-showcase-outer`)).map((node) => {
        const img = node.querySelector('img.folder-img-docker, img.folder-img-vm');
        const rect = node.getBoundingClientRect ? node.getBoundingClientRect() : { width: 0, height: 0 };
        return {
            id: String(node.getAttribute('data-fv-folder-id') || ''),
            name: String(node.querySelector(nameSelector)?.textContent || '').trim(),
            expanded: node.getAttribute('expanded') === 'true',
            className: String(node.className || ''),
            childCount: node.querySelectorAll('.folder-showcase > .folder-showcase-outer, .folder-storage > span.outer').length,
            rect: {
                width: Math.round(Number(rect.width) || 0),
                height: Math.round(Number(rect.height) || 0)
            },
            icon: img ? {
                src: String(img.getAttribute('src') || ''),
                currentSrc: String(img.currentSrc || ''),
                complete: img.complete === true,
                naturalWidth: Number(img.naturalWidth || 0),
                naturalHeight: Number(img.naturalHeight || 0)
            } : null
        };
    });
};
const collectDashboardActivePluginAssets = () => Array.from(document.querySelectorAll('script[src], link[href]'))
    .map((node) => String(node.getAttribute('src') || node.getAttribute('href') || ''))
    .filter((url) => url.includes('/plugins/folderview.plus/'))
    .slice(0, 80);
const buildDashboardDebugPayload = async (type, details) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const originalOrderUrl = `/plugins/folderview.plus/server/read_unraid_order.php?type=${resolvedType}`;
    const originalOrder = parseDashboardPayloadOr(
        await getDashboardRequestWithFallback(resolvedType, 'debug original order', originalOrderUrl, {}),
        {}
    );
    return {
        version: String((await requestClient.getText('/plugins/folderview.plus/server/version.php')) || '').trim(),
        type: resolvedType,
        requestFallbacks: dashboardRequestDiagnostics[resolvedType] || [],
        pluginAssets: collectDashboardActivePluginAssets(),
        render: collectDashboardRenderDiagnosticsForType(resolvedType),
        originalOrder,
        ...details
    };
};

/**
 * Handles the creation of all folders
 */
const createFolders = async (types = ['docker', 'vm']) => {
    const renderTypes = new Set(
        (Array.isArray(types) ? types : [types])
            .map((type) => (type === 'vm' ? 'vm' : 'docker'))
    );
    // ########################################
    // ##########       DOCKER       ##########
    // ########################################

    // if docker is enabled
    if (renderTypes.has('docker') && $('tbody#docker_view').length > 0) {
        showDashboardRuntimeLoadingRow('docker');
        try {
        let prom = await Promise.all(folderReq.docker);
        // Parse the results
        let folders = parseDashboardPayloadOr(prom[0], {});
        let allDockerFolders = normalizeDashboardFolderMap(folders);
        const containersInfo = parseDashboardPayloadOr(prom[2], {});
        dashboardRuntimeInfoByType.docker = containersInfo;
        allDockerFolders = reconcileDashboardMemberIdentities('docker', allDockerFolders, containersInfo);
        const dockerTreeIndex = buildFolderChildrenIndex(allDockerFolders);
        const dockerChildrenByParent = dockerTreeIndex.childrenByParent || {};
        let unraidOrder = Object.values(parseDashboardPayloadOr(prom[1], {}));
        let order = Object.values(parseDashboardPayloadOr(prom[3], {}));
        let prefsResponse = parseDashboardPayloadOr(prom[4], {});
        folderTypePrefs.docker = normalizeDashboardPrefsResponse('docker', prefsResponse);
        const dockerRootFolders = filterDashboardToRootFolders(allDockerFolders);
        folders = dockerRootFolders;
        unraidOrder = reorderFolderSlotsInBaseOrder(unraidOrder, folders, folderTypePrefs.docker);
        applyDashboardRuntimePrefs();
        lastDashboardStateSignatures.docker = buildDockerStateSignature(containersInfo, false);
        if (isDashboardLegacyLayoutForType('docker')) {
            globalFolders.docker = {};
            scheduleDashboardLayoutApplyForType('docker');
            syncDashboardWidgetLayoutQuickControlForType('docker');
        } else {
        // Filter the order to get the container that aren't in the order, this happen when a new container is created
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
            const debugData = JSON.stringify(await buildDashboardDebugPayload('docker', {
                folders,
                unraidOrder,
                newOnes,
                order,
                containersInfo: sanitizeDashboardInfoForDebug('docker', containersInfo)
            }));
            const blob = new Blob([debugData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const element = document.createElement('a');
            element.href = url;
            element.download = 'debug-DASHBOARD-DOCKER.json';
            element.style.display = 'none';
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);
            URL.revokeObjectURL(url);
            dashboardDebugLog('Docker Order:', [...order]);
        }
    
        let foldersDone = {};

        folderEvents.dispatchEvent(new CustomEvent('docker-pre-folders-creation', {detail: {
            folders: folders,
            order: order,
            containersInfo: containersInfo
        }}));
        const dockerFullMatchCache = buildDashboardDockerFolderMatchCache(order, containersInfo, allDockerFolders, folderTypePrefs.docker);
        const dockerMatchCache = aggregateRootMatchCache(allDockerFolders, folders, dockerFullMatchCache);
        const createdRootIds = [];
        const createdNestedIds = new Set();
        const renderDockerChildren = (parentId) => {
            const parentKey = String(parentId || '').trim();
            if (!parentKey) {
                return;
            }
            const childIds = sortFolderIdsByPrefs(dockerChildrenByParent[parentKey] || [], allDockerFolders, folderTypePrefs.docker);
            for (const childId of childIds) {
                if (!allDockerFolders[childId] || createdNestedIds.has(childId)) {
                    continue;
                }
                createdNestedIds.add(childId);
                const childHasChildren = Array.isArray(dockerChildrenByParent[childId]) && dockerChildrenByParent[childId].length > 0;
                createFolderDocker(
                    allDockerFolders[childId],
                    childId,
                    0,
                    order,
                    containersInfo,
                    Object.keys(foldersDone),
                    dockerFullMatchCache[childId] || null,
                    {
                        appendTo: `.folder-showcase-outer-${parentKey} > .folder-showcase-${parentKey}`,
                        preserveWhenEmpty: childHasChildren
                    }
                );
                foldersDone[childId] = allDockerFolders[childId];
                renderDockerChildren(childId);
            }
        };

        // Draw the folders in the order
        for (let key = 0; key < order.length; key++) {
            const container = order[key];
            if (container && folderRegex.test(container)) {
                let id = container.replace(folderRegex, '');
                if (folders[id]) {
                    const hasChildren = Array.isArray(dockerChildrenByParent[id]) && dockerChildrenByParent[id].length > 0;
                    const rootCacheEntry = hasChildren
                        ? (dockerFullMatchCache[id] || null)
                        : (dockerMatchCache[id] || dockerFullMatchCache[id] || null);
                    key -= createFolderDocker(
                        folders[id],
                        id,
                        key,
                        order,
                        containersInfo,
                        Object.keys(foldersDone),
                        rootCacheEntry,
                        { preserveWhenEmpty: hasChildren }
                    );
                    key -= newOnes.length;
                    // Move the folder to the done object and delete it from the undone one
                    foldersDone[id] = folders[id];
                    createdRootIds.push(id);
                    delete folders[id];
                }
            }
        }
    
        // Draw the foldes outside of the order
        // Preserve original folder order when inserting at the top with unshift.
        const remainingDockerFolders = Object.entries(getPrefsOrderedFolderMap(folders, folderTypePrefs.docker)).reverse();
        for (const [id, value] of remainingDockerFolders) {
            // Add the folder on top of the array
            order.unshift(`folder-${id}`);
            const hasChildren = Array.isArray(dockerChildrenByParent[id]) && dockerChildrenByParent[id].length > 0;
            const rootCacheEntry = hasChildren
                ? (dockerFullMatchCache[id] || null)
                : (dockerMatchCache[id] || dockerFullMatchCache[id] || null);
            createFolderDocker(
                value,
                id,
                0,
                order,
                containersInfo,
                Object.keys(foldersDone),
                rootCacheEntry,
                { preserveWhenEmpty: hasChildren }
            );
            // Move the folder to the done object and delete it from the undone one
            foldersDone[id] = folders[id];
            createdRootIds.push(id);
            delete folders[id];
        }

        for (const rootId of createdRootIds) {
            renderDockerChildren(rootId);
        }
    
        // if started only is active hide all stopped folder
        if ($('input#apps').is(':checked')) {
            $('tbody#docker_view > tr.updated > td > div > span.outer.stopped').css('display', 'none');
        }

        // Keep global map in sync before restoring expansion state.
        globalFolders.docker = foldersDone;
    
        const dockerExpandedStateMap = readDashboardExpandedStateMap('docker');
        // Restore dashboard expansion memory (falls back to per-folder expand default).
        for (const [id, value] of Object.entries(foldersDone)) {
            const shouldExpand = Object.prototype.hasOwnProperty.call(dockerExpandedStateMap, id)
                ? dockerExpandedStateMap[id] === true
                : value.settings.expand_dashboard === true;
            value.status.expanded = shouldExpand === true;
            if (shouldExpand) {
                expandFolderDocker(id, { persistExpandedState: false });
            }
        }

        folderEvents.dispatchEvent(new CustomEvent('docker-post-folders-creation', {detail: {
            folders: folders,
            order: order,
            containersInfo: containersInfo
        }}));
    
        // Assing the folder done to the global object
        globalFolders.docker = foldersDone;
        if (window.FolderViewPlusNativeOrganizer && typeof window.FolderViewPlusNativeOrganizer.syncDockerOrganizer === 'function') {
            window.FolderViewPlusNativeOrganizer.syncDockerOrganizer(globalFolders.docker, { source: 'dashboard-page' }).catch(() => {});
        }
        scheduleDashboardLayoutApplyForType('docker');
        }
        } finally {
            hideDashboardRuntimeLoadingRow('docker');
        }
    }


    // ########################################
    // ##########         VMS        ##########
    // ########################################

    // if vm is enabled
    if (renderTypes.has('vm') && $('tbody#vm_view').length > 0) {
        showDashboardRuntimeLoadingRow('vm');
        try {
        const prom = await Promise.all(folderReq.vm);
        // Parse the results
        let folders = parseDashboardPayloadOr(prom[0], {});
        let allVmFolders = normalizeDashboardFolderMap(folders);
        const vmInfo = parseDashboardPayloadOr(prom[2], {});
        dashboardRuntimeInfoByType.vm = vmInfo;
        allVmFolders = reconcileDashboardMemberIdentities('vm', allVmFolders, vmInfo);
        const vmTreeIndex = buildFolderChildrenIndex(allVmFolders);
        const vmChildrenByParent = vmTreeIndex.childrenByParent || {};
        let unraidOrder = Object.values(parseDashboardPayloadOr(prom[1], {}));
        let order = Object.values(parseDashboardPayloadOr(prom[3], {}));
        let prefsResponse = parseDashboardPayloadOr(prom[4], {});
        folderTypePrefs.vm = normalizeDashboardPrefsResponse('vm', prefsResponse);
        const vmRootFolders = filterDashboardToRootFolders(allVmFolders);
        folders = vmRootFolders;
        unraidOrder = reorderFolderSlotsInBaseOrder(unraidOrder, folders, folderTypePrefs.vm);
        applyDashboardRuntimePrefs();
        lastDashboardStateSignatures.vm = buildVmStateSignature(vmInfo, false);
        if (isDashboardLegacyLayoutForType('vm')) {
            globalFolders.vms = {};
            scheduleDashboardLayoutApplyForType('vm');
            syncDashboardWidgetLayoutQuickControlForType('vm');
        } else {
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
            const debugData = JSON.stringify(await buildDashboardDebugPayload('vm', {
                folders,
                unraidOrder,
                newOnes,
                order,
                vmInfo: sanitizeDashboardInfoForDebug('vm', vmInfo)
            }));
            const blob = new Blob([debugData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const element = document.createElement('a');
            element.href = url;
            element.download = 'debug-DASHBOARD-VM.json';
            element.style.display = 'none';
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);
            URL.revokeObjectURL(url);
            dashboardDebugLog('VM Order:', [...order]);
        }
    
        let foldersDone = {};

        folderEvents.dispatchEvent(new CustomEvent('vm-pre-folders-creation', {detail: {
            folders: folders,
            order: order,
            vmInfo: vmInfo
        }}));
        const vmFullMatchCache = buildDashboardVmFolderMatchCache(order, vmInfo, allVmFolders, folderTypePrefs.vm);
        const vmMatchCache = aggregateRootMatchCache(allVmFolders, folders, vmFullMatchCache);
        const createdRootVmIds = [];
        const createdNestedVmIds = new Set();
        const renderVmChildren = (parentId) => {
            const parentKey = String(parentId || '').trim();
            if (!parentKey) {
                return;
            }
            const childIds = sortFolderIdsByPrefs(vmChildrenByParent[parentKey] || [], allVmFolders, folderTypePrefs.vm);
            for (const childId of childIds) {
                if (!allVmFolders[childId] || createdNestedVmIds.has(childId)) {
                    continue;
                }
                createdNestedVmIds.add(childId);
                const childHasChildren = Array.isArray(vmChildrenByParent[childId]) && vmChildrenByParent[childId].length > 0;
                createFolderVM(
                    allVmFolders[childId],
                    childId,
                    0,
                    order,
                    vmInfo,
                    Object.keys(foldersDone),
                    vmFullMatchCache[childId] || null,
                    {
                        appendTo: `.folder-showcase-outer-${parentKey} > .folder-showcase-${parentKey}`,
                        preserveWhenEmpty: childHasChildren
                    }
                );
                foldersDone[childId] = allVmFolders[childId];
                renderVmChildren(childId);
            }
        };

        // Draw the folders in the order
        for (let key = 0; key < order.length; key++) {
            const container = order[key];
            if (container && folderRegex.test(container)) {
                let id = container.replace(folderRegex, '');
                if (folders[id]) {
                    const hasChildren = Array.isArray(vmChildrenByParent[id]) && vmChildrenByParent[id].length > 0;
                    const rootCacheEntry = hasChildren
                        ? (vmFullMatchCache[id] || null)
                        : (vmMatchCache[id] || vmFullMatchCache[id] || null);
                    key -= createFolderVM(
                        folders[id],
                        id,
                        key,
                        order,
                        vmInfo,
                        Object.keys(foldersDone),
                        rootCacheEntry,
                        { preserveWhenEmpty: hasChildren }
                    );
                    key -= newOnes.length;
                    // Move the folder to the done object and delete it from the undone one
                    foldersDone[id] = folders[id];
                    createdRootVmIds.push(id);
                    delete folders[id];
                }
            }
        }
    
        // Draw the foldes outside of the order
        // Preserve original folder order when inserting at the top with unshift.
        const remainingVmFolders = Object.entries(getPrefsOrderedFolderMap(folders, folderTypePrefs.vm)).reverse();
        for (const [id, value] of remainingVmFolders) {
            // Add the folder on top of the array
            order.unshift(`folder-${id}`);
            const hasChildren = Array.isArray(vmChildrenByParent[id]) && vmChildrenByParent[id].length > 0;
            const rootCacheEntry = hasChildren
                ? (vmFullMatchCache[id] || null)
                : (vmMatchCache[id] || vmFullMatchCache[id] || null);
            createFolderVM(
                value,
                id,
                0,
                order,
                vmInfo,
                Object.keys(foldersDone),
                rootCacheEntry,
                { preserveWhenEmpty: hasChildren }
            );
            // Move the folder to the done object and delete it from the undone one
            foldersDone[id] = folders[id];
            createdRootVmIds.push(id);
            delete folders[id];
        }

        for (const rootId of createdRootVmIds) {
            renderVmChildren(rootId);
        }

        // if started only is active hide all stopped folder
        if ($('input#vms').is(':checked')) {
            $('tbody#vm_view > tr.updated > td > div > span.outer.stopped').css('display', 'none');
        }

        // Keep global map in sync before restoring expansion state.
        globalFolders.vms = foldersDone;

        const vmExpandedStateMap = readDashboardExpandedStateMap('vm');
        // Restore dashboard expansion memory (falls back to per-folder expand default).
        for (const [id, value] of Object.entries(foldersDone)) {
            const shouldExpand = Object.prototype.hasOwnProperty.call(vmExpandedStateMap, id)
                ? vmExpandedStateMap[id] === true
                : value.settings.expand_dashboard === true;
            value.status.expanded = shouldExpand === true;
            if (shouldExpand) {
                expandFolderVM(id, { persistExpandedState: false });
            }
        }

        folderEvents.dispatchEvent(new CustomEvent('vm-post-folders-creation', {detail: {
            folders: folders,
            order: order,
            vmInfo: vmInfo
        }}));

        globalFolders.vms = foldersDone;
        scheduleDashboardLayoutApplyForType('vm');
        }
        } finally {
            hideDashboardRuntimeLoadingRow('vm');
        }
    }

    folderDebugMode  = false;
    applyDashboardRuntimePrefs();
    scheduleDashboardLayoutApplyForType('docker');
    scheduleDashboardLayoutApplyForType('vm');
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
 * @param {{appendTo?: string, preserveWhenEmpty?: boolean}} options render options
 * @returns the number of element removed before the folder
 */
const createFolderDocker = (folder, id, position, order, containersInfo, foldersDone, matchCacheEntry = null, options = {}) => {
    if (folderTypePrefs?.docker?.performanceMode === true && folder && typeof folder === 'object') {
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

    folderEvents.dispatchEvent(new CustomEvent('docker-pre-folder-creation', {detail: {
        folder: folder,
        id: id,
        position: position,
        order: order,
        containersInfo: containersInfo,
        foldersDone: foldersDone
    }}));

    // default varibles
    let upToDate = true;
    let started = 0;
    let paused = 0;
    let autostart = 0;
    let autostartStarted = 0;
    let managed = 0;
    let managerTypes = new Set();
    let remBefore = 0;

    const precomputed = matchCacheEntry && typeof matchCacheEntry === 'object' ? matchCacheEntry : null;
    const appendToSelector = typeof options?.appendTo === 'string' ? options.appendTo.trim() : '';
    const preserveWhenEmpty = options?.preserveWhenEmpty === true;
    const combinedMembers = [];
    const combinedSet = new Set();
    const pushCombined = (name) => {
        const key = String(name || '').trim();
        if (!key || combinedSet.has(key) || !containersInfo[key]) {
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
    } else {
        const regexRaw = String(folder.regex || '').trim();
        if (regexRaw) {
            try {
                const regex = new RegExp(regexRaw);
                regexMatches = order.filter((entry) => containersInfo[entry] && regex.test(entry));
            } catch (_error) {
                regexMatches = [];
            }
        }
    }
    regexMatches.forEach(pushCombined);

    const labelMatches = precomputed && Array.isArray(precomputed.label)
        ? precomputed.label
        : order.filter((entry) => {
            const labels = containersInfo[entry]?.Labels || {};
            return getFolderLabelValue(labels) === folder.name;
        });
    labelMatches.forEach(pushCombined);

    const ruleMatches = precomputed && Array.isArray(precomputed.rules)
        ? precomputed.rules
        : utils.getAutoRuleMatches({
            rules: folderTypePrefs.docker.autoRules || [],
            folderId: id,
            names: order,
            infoByName: containersInfo,
            type: 'docker'
        });
    ruleMatches.forEach(pushCombined);

    const lazyPreviewEnabled = folderTypePrefs?.docker?.lazyPreviewEnabled === true;
    const lazyPreviewThreshold = Number(folderTypePrefs?.docker?.lazyPreviewThreshold || 30);
    const isExpandedByDefault = folder?.settings?.expand_dashboard === true;
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
    const safeFolderIcon = sanitizeImageSrc(folder.icon, DEFAULT_FOLDER_ICON_PATH);
    const safeFolderName = escapeHtml(folder.name);
    const overflowMode = normalizeDashboardOverflowMode(folder?.settings?.dashboard_overflow);
    const hoverAnimationClass = getPreviewHoverAnimationClass(folder.settings);
    const fld = `<div class="folder-showcase-outer-${id} folder-showcase-outer ${hoverAnimationClass}" data-fv-folder-id="${id}" data-fv-dashboard-overflow="${overflowMode}"><span class="outer solid apps stopped folder-docker" onclick='expandFolderDocker("${id}")'><span id="folder-id-${id}" class="hand docker folder-hand-docker"><img src="${safeFolderIcon}" class="img folder-img-docker" onerror='this.src="${DEFAULT_FOLDER_ICON_PATH}"'></span><span class="inner folder-inner-docker"><span class="folder-appname-docker">${safeFolderName}</span><br><i class="fa fa-square stopped folder-load-status-docker"></i><span class="state folder-state-docker">${$.i18n('stopped')}</span></span><button type="button" class="fv-dashboard-expand-toggle-btn" onclick='event.stopPropagation(); expandFolderDocker("${id}"); return false;' aria-label="Toggle folder members"><i class="fa fa-chevron-down" aria-hidden="true"></i></button><div class="folder-storage"></div></span><div class="folder-showcase-${id} folder-showcase"></div></div>`;

    // insertion at position of the folder
    if (appendToSelector) {
        const $appendTarget = $(appendToSelector).first();
        if ($appendTarget.length > 0) {
            $appendTarget.append($(fld));
        } else if (position === 0) {
            $('tbody#docker_view > tr.updated > td').children().eq(position).before($(fld));
        } else {
            $('tbody#docker_view > tr.updated > td').children().eq(position - 1).after($(fld));
        }
    } else if (position === 0) {
        $('tbody#docker_view > tr.updated > td').children().eq(position).before($(fld));
    } else {
        $('tbody#docker_view > tr.updated > td').children().eq(position - 1).after($(fld));
    }
    applyFolderDashboardCardSettings('docker', id, folder);

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

        folderEvents.dispatchEvent(new CustomEvent('docker-pre-folder-preview', {detail: {
            folder: folder,
            id: id,
            position: position,
            order: order,
            containersInfo: containersInfo,
            foldersDone: foldersDone,
            container: container,
            ct: containersInfo[container],
            index: index,
            offsetIndex: offsetIndex
        }}));

        if (index > -1) {

            // Keep track of removed elements before the folder to set back the for loop for creating folders, otherwise folder will be skipped
            if(offsetIndex < position) {
                remBefore += 1;
            }

            // remove the containers from the order
            cutomOrder.splice(index, 1);
            order.splice(offsetIndex, 1);
            const ct = containersInfo[container];

            // grab the storage folder
            const element = $(`tbody#docker_view span#folder-id-${id}`).siblings('div.folder-storage');
            // grab the container by name match (not positional index, which drifts as folders remove elements)
            const $containerEl = $('tbody#docker_view > tr.updated > td').children('span.outer').not('.folder-docker').filter(function() {
                const innerText = $(this).find('span.inner').contents().first().text().trim();
                return innerText === container;
            }).first();
            element.append($containerEl.attr('data-fv-runtime-name', container).addClass(`folder-${id}-element`).addClass(`folder-element-docker`).addClass(`${!(ct.info.State.Autostart === false) ? 'autostart' : ''}`));
            appendDashboardDockerMemberQuickActions($containerEl, ct, folder.settings || {});
            attachDashboardAdvancedPreviewIfEnabled($containerEl, ct, folder, id);
            

            newFolder[container] = {};
            newFolder[container].id = ct.shortId;
            newFolder[container].pause = ct.info.State.Paused;
            newFolder[container].state = ct.info.State.Running;
            newFolder[container].update = ct.info.State.Updated === false && ct.info.State.manager === 'dockerman';
            newFolder[container].managed = ct.info.State.manager === 'dockerman';
            newFolder[container].manager = ct.info.State.manager;

            if (folder.settings?.preview_update && newFolder[container].update) {
                $containerEl.find('.blue-text').addClass('orange-text');
            }

            if(folderDebugMode) {
                dashboardDebugLog(`Docker ${newFolder[container].id}(${offsetIndex}, ${index}) => ${id}`);
            }

            // set the status of the folder
            upToDate = upToDate && !newFolder[container].update;
            started += newFolder[container].state ? 1 : 0;
            paused += newFolder[container].state && newFolder[container].pause ? 1 : 0;
            const isDockerMan = ct.info.State.manager === 'dockerman';
            autostart += (isDockerMan && !(ct.info.State.Autostart === false)) ? 1 : 0;
            autostartStarted += (isDockerMan && !(ct.info.State.Autostart === false) && newFolder[container].state) ? 1 : 0;
            managerTypes.add(ct.info.State.manager);
            managed += newFolder[container].managed ? 1 : 0;

            folderEvents.dispatchEvent(new CustomEvent('docker-post-folder-preview', {detail: {
                folder: folder,
                id: id,
                position: position,
                order: order,
                containersInfo: containersInfo,
                foldersDone: foldersDone,
                container: container,
                ct: containersInfo[container],
                index: index,
                offsetIndex: offsetIndex,
                states: {
                    upToDate,
                    started,
                    paused,
                    autostart,
                    autostartStarted,
                    managed
                }
            }}));
        }
    }

    // replace the old containers array with the newFolder object
    folder.containers = newFolder;
    if (folderTypePrefs?.docker?.hideEmptyFolders === true && Object.keys(folder.containers).length === 0 && !preserveWhenEmpty) {
        $(`.folder-showcase-outer-${id}`).remove();
        return remBefore;
    }

    //temp var
    const sel = $(`tbody#docker_view span#folder-id-${id}`);
    const statusColors = resolveDashboardFolderStatusColors(folder.settings);
    const $statusIcon = sel.next('span.inner').children('i');
    const $statusText = sel.next('span.inner').children('span.state');
    $statusIcon.css('color', statusColors.stopped);
    $statusText.css('color', statusColors.stopped);
    
    //set the status of a folder

    if (!upToDate && managerTypes.has('dockerman')) {
        sel.next('span.inner').children().first().addClass(folder.settings?.preview_update ? 'orange-text' : 'blue-text');
    }

    if (started) {
        const allStartedArePaused = paused > 0 && paused === started;
        const statusClass = allStartedArePaused ? 'paused' : 'started';
        const statusIconClass = allStartedArePaused ? 'fa-pause' : 'fa-play';
        const statusColor = allStartedArePaused ? statusColors.paused : statusColors.started;
        const statusLabel = allStartedArePaused ? $.i18n('paused') : $.i18n('started');
        sel.parent().removeClass('stopped paused started').addClass(statusClass);
        $statusIcon.replaceWith($(`<i class="fa ${statusIconClass} ${statusClass} folder-load-status-docker" style="color:${statusColor}"></i>`));
        $statusText.text(`${started}/${Object.entries(folder.containers).length} ${statusLabel}`).css('color', statusColor);
    }

    if(autostart === 0) {
        $(`.folder-showcase-outer-${id}, .folder-showcase-outer-${id} > span.outer`).addClass('no-autostart');
    } else if (autostart > 0 && autostartStarted === 0) {
        $(`.folder-showcase-outer-${id}, .folder-showcase-outer-${id} > span.outer`).addClass('autostart-off');
    } else if (autostart > 0 && autostartStarted > 0 && autostart !== autostartStarted) {
        $(`.folder-showcase-outer-${id}, .folder-showcase-outer-${id} > span.outer`).addClass('autostart-partial');
    } else if (autostart > 0 && autostartStarted > 0 && autostart === autostartStarted) {
        $(`.folder-showcase-outer-${id}, .folder-showcase-outer-${id} > span.outer`).addClass('autostart-full');
    }

    if(managed === 0) {
        $(`.folder-showcase-outer-${id}, .folder-showcase-outer-${id} > span.outer`).addClass('no-managed');
    } else if (managed > 0 && managed < Object.values(folder.containers).length) {
        $(`.folder-showcase-outer-${id}, .folder-showcase-outer-${id} > span.outer`).addClass('managed-partial');
    } else if (managed > 0 && managed === Object.values(folder.containers).length) {
        $(`.folder-showcase-outer-${id}, .folder-showcase-outer-${id} > span.outer`).addClass('managed-full');
    }

    // set the status
    folder.status = {};
    folder.status.upToDate = upToDate;
    folder.status.started = started;
    folder.status.paused = paused;
    folder.status.autostart = autostart;
    folder.status.autostartStarted = autostartStarted;
    folder.status.managed = managed;
    folder.status.managerTypes = Array.from(managerTypes);
    folder.status.expanded = false;

    folderEvents.dispatchEvent(new CustomEvent('docker-post-folder-creation', {detail: {
        folder: folder,
        id: id,
        position: position,
        order: order,
        containersInfo: containersInfo,
        foldersDone: foldersDone
    }}));

    return remBefore;
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
 * @param {{appendTo?: string, preserveWhenEmpty?: boolean}} options render options
 * @returns the number of element removed before the folder
 */
const createFolderVM = (folder, id, position, order, vmInfo, foldersDone, matchCacheEntry = null, options = {}) => {
    if (folderTypePrefs?.vm?.performanceMode === true && folder && typeof folder === 'object') {
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
    let autostart = 0;
    let autostartStarted = 0;
    let remBefore = 0;

    const precomputed = matchCacheEntry && typeof matchCacheEntry === 'object' ? matchCacheEntry : null;
    const appendToSelector = typeof options?.appendTo === 'string' ? options.appendTo.trim() : '';
    const preserveWhenEmpty = options?.preserveWhenEmpty === true;
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
    } else {
        const regexRaw = String(folder.regex || '').trim();
        if (regexRaw) {
            try {
                const regex = new RegExp(regexRaw);
                regexMatches = order.filter((entry) => vmInfo[entry] && regex.test(entry));
            } catch (_error) {
                regexMatches = [];
            }
        }
    }
    regexMatches.forEach(pushCombined);

    const ruleMatches = precomputed && Array.isArray(precomputed.rules)
        ? precomputed.rules
        : utils.getAutoRuleMatches({
            rules: folderTypePrefs.vm.autoRules || [],
            folderId: id,
            names: order,
            infoByName: vmInfo,
            type: 'vm'
        });
    ruleMatches.forEach(pushCombined);

    const lazyPreviewEnabled = folderTypePrefs?.vm?.lazyPreviewEnabled === true;
    const lazyPreviewThreshold = Number(folderTypePrefs?.vm?.lazyPreviewThreshold || 30);
    const isExpandedByDefault = folder?.settings?.expand_dashboard === true;
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
    const safeFolderIcon = sanitizeImageSrc(folder.icon);
    const safeFolderName = escapeHtml(folder.name);
    const overflowMode = normalizeDashboardOverflowMode(folder?.settings?.dashboard_overflow);
    const hoverAnimationClass = getPreviewHoverAnimationClass(folder.settings);
    const fld = `<div class="folder-showcase-outer-${id} folder-showcase-outer ${hoverAnimationClass}" data-fv-folder-id="${id}" data-fv-dashboard-overflow="${overflowMode}"><span class="outer solid vms stopped folder-vm" onclick='expandFolderVM("${id}")'><span id="folder-id-${id}" class="hand vm folder-hand-vm"><img src="${safeFolderIcon}" class="img folder-img-vm" onerror='this.src="${DEFAULT_FOLDER_ICON_PATH}"'></span><span class="inner folder-inner-vm"><span class="folder-appname-vm">${safeFolderName}</span><br><i class="fa fa-square stopped folder-load-status-vm"></i><span class="state folder-state-vm">${$.i18n('stopped')}</span></span><button type="button" class="fv-dashboard-expand-toggle-btn" onclick='event.stopPropagation(); expandFolderVM("${id}"); return false;' aria-label="Toggle folder members"><i class="fa fa-chevron-down" aria-hidden="true"></i></button><div class="folder-storage" style="display:none"></div></span><div class="folder-showcase-${id} folder-showcase"></div></div>`;

    // insertion at position of the folder
    if (appendToSelector) {
        const $appendTarget = $(appendToSelector).first();
        if ($appendTarget.length > 0) {
            $appendTarget.append($(fld));
        } else if (position === 0) {
            $('tbody#vm_view > tr.updated > td').children().eq(position).before($(fld));
        } else {
            $('tbody#vm_view > tr.updated > td').children().eq(position - 1).after($(fld));
        }
    } else if (position === 0) {
        $('tbody#vm_view > tr.updated > td').children().eq(position).before($(fld));
    } else {
        $('tbody#vm_view > tr.updated > td').children().eq(position - 1).after($(fld));
    }
    applyFolderDashboardCardSettings('vm', id, folder);

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
            vm: container,
            ct: vmInfo[container],
            index: index,
            offsetIndex: offsetIndex
        }}));

        if (index > -1) {

            // Keep track of removed elements before the folder to set back the for loop for creating folders, otherwise folder will be skipped
            if(offsetIndex < position) {
                remBefore += 1;
            }

            // remove the containers from the order
            cutomOrder.splice(index, 1);
            order.splice(offsetIndex, 1);

            // add the id to the container name 
            const ct = vmInfo[container];
            newFolder[container] = {};
            newFolder[container].id = ct.uuid;
            newFolder[container].state = ct.state;

            // grab the container by name match (not positional index, which drifts as folders remove elements)
            const $vmEl = $('tbody#vm_view > tr.updated > td').children('span.outer').not('.folder-vm').filter(function() {
                const innerText = $(this).find('span.inner').contents().first().text().trim();
                return innerText === container;
            }).first();
            $(`tbody#vm_view span#folder-id-${id}`).siblings('div.folder-storage').append($vmEl.attr('data-fv-runtime-name', container).addClass(`folder-${id}-element`).addClass(`folder-element-vm`).addClass(`${ct.autostart ? 'autostart' : ''}`));

            if(folderDebugMode) {
                dashboardDebugLog(`VM ${newFolder[container].id}(${offsetIndex}, ${index}) => ${id}`);
            }
            
            // set the status of the folder
            const vmState = String(ct.state || '');
            const isVmPaused = vmState === 'paused' || vmState === 'pmsuspended';
            started += vmState !== "shutoff" ? 1 : 0;
            paused += isVmPaused ? 1 : 0;
            autostart += ct.autostart ? 1 : 0;
            autostartStarted += (ct.autostart && vmState !== "shutoff") ? 1 : 0;

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
                    paused,
                    autostart,
                    autostartStarted
                }
            }}));
        }
    }

    // replace the old containers array with the newFolder object
    folder.containers = newFolder;
    if (folderTypePrefs?.vm?.hideEmptyFolders === true && Object.keys(folder.containers).length === 0 && !preserveWhenEmpty) {
        $(`.folder-showcase-outer-${id}`).remove();
        return remBefore;
    }

    
    //set tehe status of a folder
    const sel = $(`tbody#vm_view span#folder-id-${id}`);
    const statusColors = resolveDashboardFolderStatusColors(folder.settings);
    const $statusIcon = sel.next('span.inner').children('i');
    const $statusText = sel.next('span.inner').children('span.state');
    $statusIcon.css('color', statusColors.stopped);
    $statusText.css('color', statusColors.stopped);
    if (started) {
        const allStartedArePaused = paused > 0 && paused === started;
        const statusClass = allStartedArePaused ? 'paused' : 'started';
        const statusIconClass = allStartedArePaused ? 'fa-pause' : 'fa-play';
        const statusColor = allStartedArePaused ? statusColors.paused : statusColors.started;
        const statusLabel = allStartedArePaused ? $.i18n('paused') : $.i18n('started');
        sel.parent().removeClass('stopped paused started').addClass(statusClass);
        $statusIcon.replaceWith($(`<i class="fa ${statusIconClass} ${statusClass} folder-load-status-vm" style="color:${statusColor}"></i>`));
        $statusText.text(`${started}/${Object.entries(folder.containers).length} ${statusLabel}`).css('color', statusColor);
    }

    if(autostart === 0) {
        $(`.folder-showcase-outer-${id}, .folder-showcase-outer-${id} > span.outer`).addClass('no-autostart');
    } else if (autostart > 0 && autostartStarted === 0) {
        $(`.folder-showcase-outer-${id}, .folder-showcase-outer-${id} > span.outer`).addClass('autostart-off');
    } else if (autostart > 0 && autostartStarted > 0 && autostart !== autostartStarted) {
        $(`.folder-showcase-outer-${id}, .folder-showcase-outer-${id} > span.outer`).addClass('autostart-partial');
    } else if (autostart > 0 && autostartStarted > 0 && autostart === autostartStarted) {
        $(`.folder-showcase-outer-${id}, .folder-showcase-outer-${id} > span.outer`).addClass('autostart-full');
    }

    // set the status
    folder.status = {};
    folder.status.started = started;
    folder.status.paused = paused;
    folder.status.autostart = autostart;
    folder.status.autostartStarted = autostartStarted;
    folder.status.expanded = false;

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
 * Handle the dropdown expand button of folders
 * @param {string} id the id of the folder
 */
const toggleFolderExpansion = (type, id, options = {}) => {
    const meta = dashboardTypeMeta(type);
    const safeId = String(id || '').trim();
    if (!safeId) {
        return;
    }
    const persistExpandedState = options?.persistExpandedState !== false;
    const expandedStateChanges = {};
    const forceExpanded = Object.prototype.hasOwnProperty.call(options || {}, 'forceExpanded')
        ? options.forceExpanded === true
        : null;
    const suppressAccordion = options?.suppressAccordion === true;
    const eventPrefix = meta.type === 'vm' ? 'vm' : 'docker';
    folderEvents.dispatchEvent(new CustomEvent(`${eventPrefix}-pre-folder-expansion`, {detail: { id: safeId }}));
    const card = getDashboardCard(meta.type, safeId);
    const el = card.children(meta.outerSelector).first();
    if (!card.length || !el.length) {
        return;
    }
    const state = el.attr('expanded') === 'true';
    const nextState = forceExpanded === null ? !state : forceExpanded;
    const storage = el.children('div.folder-storage').first();
    const showcase = card.children(`div.folder-showcase-${safeId}`).first();
    if (!storage.length || !showcase.length) {
        return;
    }
    const setExpandedAttrs = (expanded) => {
        const nextExpanded = expanded === true;
        el.attr('expanded', nextExpanded ? 'true' : 'false');
        card.attr('expanded', nextExpanded ? 'true' : 'false');
        if (nextExpanded) {
            card.attr('data-fv-expanded-at', String(Date.now()));
        } else {
            card.removeAttr('data-fv-expanded-at');
        }
        setFolderExpandedState(meta.type, safeId, nextExpanded);
        applyFolderDashboardCardSettings(meta.type, safeId, getGlobalFoldersForType(meta.type)?.[safeId]);
    };

    if (nextState && !state && !suppressAccordion) {
        const layout = normalizeDashboardPrefsForType(meta.type).layout;
        if (layout === 'accordion') {
            $(`${meta.tbodySelector} .folder-showcase-outer[expanded="true"]`).each((_, node) => {
                const $node = $(node);
                const nodeId = resolveFolderIdFromCard($node);
                if (!nodeId || nodeId === safeId) {
                    return;
                }
                const nodeOuter = $node.children(meta.outerSelector).first();
                const nodeStorage = nodeOuter.children('div.folder-storage').first();
                const nodeShowcase = $node.children(`div.folder-showcase-${nodeId}`).first();
                if (!nodeOuter.length || !nodeStorage.length || !nodeShowcase.length) {
                    return;
                }
                nodeStorage.append(nodeShowcase.children());
                nodeOuter.attr('expanded', 'false');
                $node.attr('expanded', 'false').removeAttr('data-fv-expanded-at');
                setFolderExpandedState(meta.type, nodeId, false);
                if (persistExpandedState) {
                    expandedStateChanges[nodeId] = false;
                }
                applyFolderDashboardCardSettings(meta.type, nodeId, getGlobalFoldersForType(meta.type)?.[nodeId]);
            });
        }
    }

    if (nextState === state) {
        setExpandedAttrs(nextState);
        if (persistExpandedState) {
            expandedStateChanges[safeId] = nextState;
            applyDashboardExpandedStateChanges(meta.type, expandedStateChanges);
        }
        scheduleDashboardLayoutApplyForType(meta.type);
        folderEvents.dispatchEvent(new CustomEvent(`${eventPrefix}-post-folder-expansion`, {detail: { id: safeId }}));
        return;
    }

    if (nextState) {
        showcase.append(storage.children());
    } else {
        storage.append(showcase.children());
    }
    setExpandedAttrs(nextState);
    if (persistExpandedState) {
        expandedStateChanges[safeId] = nextState;
        applyDashboardExpandedStateChanges(meta.type, expandedStateChanges);
    }
    scheduleDashboardLayoutApplyForType(meta.type);
    folderEvents.dispatchEvent(new CustomEvent(`${eventPrefix}-post-folder-expansion`, {detail: { id: safeId }}));
};

/**
 * Handle the dropdown expand button of folders
 * @param {string} id the id of the folder
 */
const expandFolderDocker = (id, options = {}) => toggleFolderExpansion('docker', id, options);
const expandFolderVM = (id, options = {}) => toggleFolderExpansion('vm', id, options);

// Keep expand handlers on window for inline onclick contracts in dashboard cards.
window.expandFolderDocker = expandFolderDocker;
window.expandFolderVM = expandFolderVM;

// Global variables
let loadedFolder = false;
let globalFolders = {};
const folderRegex = /^folder-/;
let folderDebugMode = false;
let folderDebugModeWindow = [];
let folderTypePrefs = {
    docker: utils.normalizePrefs({}),
    vm: utils.normalizePrefs({})
};
let folderReq = {
    docker: [],
    vm: []
};
let liveRefreshTimer = null;
let liveRefreshMs = 0;
let liveRefreshInFlight = false;
let queuedLoadlistTimer = null;
let queuedLoadlistRequestedAt = 0;
let dashboardDockerCpuCores = 1;
let lastDashboardStateSignatures = {
    docker: '',
    vm: ''
};
let lastDashboardSnapshotTokens = {
    docker: '',
    vm: ''
};
let lastDashboardSnapshotRevisions = {
    docker: { folder: 0, prefs: 0 },
    vm: { folder: 0, prefs: 0 }
};
let dashboardRuntimeInfoByType = {
    docker: {},
    vm: {}
};
const LOADLIST_REFRESH_DEBOUNCE_MS = 90;
const LOADLIST_REFRESH_MIN_GAP_MS = 420;
const PERFORMANCE_MODE_MIN_REFRESH_SECONDS = 20;
let dashboardLayoutPersistTokenByType = {
    docker: 0,
    vm: 0
};
let dashboardLayoutTransitionInFlightByType = {
    docker: false,
    vm: false
};
let dashboardThemeReflowBound = false;
let dashboardThemeReflowObserver = null;
let dashboardThemeReflowTimer = 0;
bindDashboardQuickActionSyncHandlers();

const queueDashboardThemeReflow = (reason = 'theme-change') => {
    const nextReason = String(reason || 'theme-change');
    if (dashboardThemeReflowTimer) {
        window.clearTimeout(dashboardThemeReflowTimer);
    }
    dashboardThemeReflowTimer = window.setTimeout(() => {
        dashboardThemeReflowTimer = 0;
        dashboardDebugLog(`theme-reflow:${nextReason}`);
        applyDashboardResolvedThemeTokens(`dashboard:${nextReason}`);
        scheduleDashboardLayoutApplyForType('docker');
        scheduleDashboardLayoutApplyForType('vm');
        syncDashboardWidgetLayoutQuickControlForType('docker');
        syncDashboardWidgetLayoutQuickControlForType('vm');
        scheduleDashboardWidgetVisibilitySyncForType('docker', 0);
        scheduleDashboardWidgetVisibilitySyncForType('vm', 0);
    }, 40);
};

const bindDashboardThemeReflowHandlers = () => {
    if (dashboardThemeReflowBound) {
        return;
    }
    dashboardThemeReflowBound = true;
    if (typeof MutationObserver === 'function') {
        dashboardThemeReflowObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations || []) {
                if (mutation.type !== 'attributes') {
                    continue;
                }
                const attr = String(mutation.attributeName || '').toLowerCase();
                if (!attr || attr === 'class' || attr === 'style' || attr.includes('theme')) {
                    queueDashboardThemeReflow('observer');
                    return;
                }
            }
        });
        if (document.documentElement) {
            dashboardThemeReflowObserver.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['class', 'style', 'data-theme', 'theme', 'data-color-scheme', 'data-bs-theme']
            });
        }
        if (document.body) {
            dashboardThemeReflowObserver.observe(document.body, {
                attributes: true,
                attributeFilter: ['class', 'style', 'data-theme', 'theme', 'data-color-scheme', 'data-bs-theme']
            });
        }
    }
    if (typeof window.matchMedia === 'function') {
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        if (media && typeof media.addEventListener === 'function') {
            media.addEventListener('change', () => queueDashboardThemeReflow('prefers-color-scheme'));
        } else if (media && typeof media.addListener === 'function') {
            media.addListener(() => queueDashboardThemeReflow('prefers-color-scheme'));
        }
    }
};
bindDashboardThemeReflowHandlers();
applyDashboardResolvedThemeTokens('dashboard:bind');

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

const fetchDashboardTypeSnapshotCheck = async (type) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    if (!runtimeSnapshotApi || typeof runtimeSnapshotApi.buildUrl !== 'function') {
        const parsed = await requestClient.getJson('/plugins/folderview.plus/server/read_info.php', {
            data: { type: resolvedType, mode: 'state' },
            cache: false
        });
        const signature = resolvedType === 'docker'
            ? buildDockerStateSignature(parsed, true)
            : buildVmStateSignature(parsed, true);
        return {
            notModified: signature === lastDashboardStateSignatures[resolvedType],
            snapshotToken: '',
            runtimeSignature: signature
        };
    }
    const payload = await requestClient.getJson(runtimeSnapshotApi.buildUrl(resolvedType, 'check', {
        since: lastDashboardSnapshotTokens[resolvedType],
        forceRefresh: true
    }), { cache: false });
    return runtimeSnapshotApi.parsePayload(payload);
};

const rememberDashboardRuntimeSnapshot = (type, snapshot) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    if (snapshot?.snapshotToken) {
        lastDashboardSnapshotTokens[resolvedType] = String(snapshot.snapshotToken);
    }
    if (snapshot?.revisions && typeof snapshot.revisions === 'object') {
        lastDashboardSnapshotRevisions[resolvedType] = {
            folder: Math.max(0, Number(snapshot.revisions.folder) || 0),
            prefs: Math.max(0, Number(snapshot.revisions.prefs) || 0)
        };
    }
};

const dashboardRuntimeSnapshotConfigMatches = (type, snapshot) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    if (!lastDashboardSnapshotTokens[resolvedType] || !snapshot?.revisions) {
        return true;
    }
    const previous = lastDashboardSnapshotRevisions[resolvedType] || {};
    return Math.max(0, Number(snapshot.revisions.folder) || 0) === Math.max(0, Number(previous.folder) || 0)
        && Math.max(0, Number(snapshot.revisions.prefs) || 0) === Math.max(0, Number(previous.prefs) || 0);
};

const normalizeDashboardRuntimeInfoMap = (type, source, previousMap = null) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const rawMap = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
    const previous = previousMap && typeof previousMap === 'object' && !Array.isArray(previousMap) ? previousMap : {};
    const normalized = {};
    Object.entries(rawMap).forEach(([name, entry]) => {
        const safeName = String(name || entry?.name || '').trim();
        if (!safeName || !entry || typeof entry !== 'object') return;
        if (resolvedType === 'vm') {
            normalized[safeName] = {
                ...(previous[safeName] || {}),
                ...entry,
                name: safeName,
                uuid: String(entry.uuid || previous[safeName]?.uuid || '').trim(),
                state: String(entry.state || previous[safeName]?.state || 'unknown').trim().toLowerCase(),
                autostart: entry.autostart === true
            };
            return;
        }
        const prior = previous[safeName] && typeof previous[safeName] === 'object' ? previous[safeName] : {};
        const priorInfo = prior.info && typeof prior.info === 'object' ? prior.info : {};
        const priorState = priorInfo.State && typeof priorInfo.State === 'object' ? priorInfo.State : {};
        const sourceInfo = entry.info && typeof entry.info === 'object' ? entry.info : {};
        const sourceState = sourceInfo.State && typeof sourceInfo.State === 'object' ? sourceInfo.State : {};
        const stateKind = String(entry.state || '').trim().toLowerCase();
        normalized[safeName] = {
            ...prior,
            ...entry,
            shortId: String(entry.id || entry.shortId || prior.shortId || '').replace(/^sha256:/i, '').slice(0, 12),
            Labels: { ...(prior.Labels || {}), ...(entry.Labels || {}) },
            info: {
                ...priorInfo,
                ...sourceInfo,
                Name: safeName,
                State: {
                    ...priorState,
                    ...sourceState,
                    Running: entry.running === true || stateKind === 'running' || sourceState.Running === true,
                    Paused: entry.paused === true || stateKind === 'paused' || sourceState.Paused === true,
                    Autostart: Object.prototype.hasOwnProperty.call(entry, 'autostart') ? entry.autostart === true : sourceState.Autostart === true,
                    Updated: Object.prototype.hasOwnProperty.call(entry, 'Updated') ? entry.Updated : sourceState.Updated,
                    manager: String(entry.manager || sourceState.manager || priorState.manager || '').trim()
                }
            }
        };
    });
    return normalized;
};

const getDashboardRuntimeStateMeta = (type, entry = {}) => {
    if (type === 'vm') {
        const state = String(entry?.state || 'unknown').trim().toLowerCase();
        if (state === 'running') return { state, key: 'started', icon: 'fa-play', className: 'started', active: true, paused: false };
        if (state === 'paused' || state === 'pmsuspended' || state === 'unknown') return { state, key: 'paused', icon: 'fa-pause', className: 'paused', active: true, paused: true };
        return { state, key: 'stopped', icon: 'fa-square', className: 'stopped', active: false, paused: false };
    }
    const stateNode = entry?.info?.State || {};
    const running = entry?.running === true || stateNode.Running === true;
    const paused = running && (entry?.paused === true || stateNode.Paused === true);
    if (paused) return { state: 'paused', key: 'paused', icon: 'fa-pause', className: 'paused', active: true, paused: true };
    if (running) return { state: 'running', key: 'started', icon: 'fa-play', className: 'started', active: true, paused: false };
    return { state: 'stopped', key: 'stopped', icon: 'fa-square', className: 'stopped', active: false, paused: false };
};

const syncDashboardRuntimeSurface = (type, $surface, entry = {}) => {
    if (!$surface || !$surface.length) return;
    const meta = getDashboardRuntimeStateMeta(type, entry);
    const $inner = $surface.find('span.inner').first();
    const $state = $inner.find('span.state').first();
    const $icon = $state.length ? $state.prevAll('i.fa').first() : $inner.find('i.fa').first();
    $surface.add($surface.find('span.hand, span.inner')).removeClass('started paused stopped running shutoff pmsuspended unknown').addClass(meta.className);
    $surface.attr('data-fv-runtime-state', meta.state);
    if ($icon.length) $icon.removeClass('fa-play fa-pause fa-square started paused stopped').addClass(`fa ${meta.icon} ${meta.className}`);
    if ($state.length) $state.text(` ${$.i18n(meta.key)}`).removeClass('started paused stopped').addClass(meta.className);
    const autostart = type === 'vm' ? entry?.autostart === true : entry?.info?.State?.Autostart === true;
    $surface.toggleClass('autostart', autostart);
};

const updateDashboardFolderRuntimeSummary = (type, id, folder) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const runtimeMap = dashboardRuntimeInfoByType[resolvedType] || {};
    const entries = Object.keys(folder?.containers || {}).map((name) => runtimeMap[name]).filter(Boolean);
    let started = 0;
    let paused = 0;
    let stopped = 0;
    let autostart = 0;
    let autostartStarted = 0;
    let managed = 0;
    let upToDate = true;
    const managerTypes = new Set();
    entries.forEach((entry) => {
        const meta = getDashboardRuntimeStateMeta(resolvedType, entry);
        if (meta.active) started += 1;
        else stopped += 1;
        if (meta.paused) paused += 1;
        const stateNode = entry?.info?.State || {};
        const isAutostart = resolvedType === 'vm' ? entry.autostart === true : stateNode.Autostart === true;
        if (isAutostart) {
            autostart += 1;
            if (meta.active) autostartStarted += 1;
        }
        if (resolvedType === 'docker') {
            const manager = String(stateNode.manager || entry.manager || '').trim();
            if (manager) managerTypes.add(manager);
            if (manager === 'dockerman') managed += 1;
            if (manager === 'dockerman' && stateNode.Updated === false) upToDate = false;
        }
    });
    const total = entries.length;
    const $outer = $(`${resolvedType === 'vm' ? 'tbody#vm_view' : 'tbody#docker_view'} .folder-showcase-outer-${id}`).first();
    const $folderSurface = $outer.children('span.outer').first();
    const $statusIcon = $folderSurface.find(`i.folder-load-status-${resolvedType}`).first();
    const $statusText = $folderSurface.find(`span.folder-state-${resolvedType}`).first();
    const allActivePaused = started > 0 && paused === started;
    const aggregate = started > 0
        ? (allActivePaused ? { count: started, key: 'paused', icon: 'fa-pause', className: 'paused' } : { count: started, key: 'started', icon: 'fa-play', className: 'started' })
        : { count: stopped, key: 'stopped', icon: 'fa-square', className: 'stopped' };
    const statusColors = resolveDashboardFolderStatusColors(folder?.settings || {});
    const statusColor = statusColors[aggregate.className] || '';
    $folderSurface.removeClass('started paused stopped').addClass(aggregate.className);
    $statusIcon.removeClass('fa-play fa-pause fa-square started paused stopped').addClass(`fa ${aggregate.icon} ${aggregate.className}`).css('color', statusColor);
    $statusText.text(`${aggregate.count}/${total} ${$.i18n(aggregate.key)}`).css('color', statusColor);
    $outer.add($folderSurface).removeClass('no-autostart autostart-off autostart-partial autostart-full no-managed managed-partial managed-full');
    if (autostart === 0) $outer.add($folderSurface).addClass('no-autostart');
    else if (autostartStarted === 0) $outer.add($folderSurface).addClass('autostart-off');
    else if (autostartStarted < autostart) $outer.add($folderSurface).addClass('autostart-partial');
    else $outer.add($folderSurface).addClass('autostart-full');
    if (resolvedType === 'docker') {
        if (managed === 0) $outer.add($folderSurface).addClass('no-managed');
        else if (managed < total) $outer.add($folderSurface).addClass('managed-partial');
        else $outer.add($folderSurface).addClass('managed-full');
        $folderSurface.find('.folder-appname-docker').toggleClass(folder?.settings?.preview_update ? 'orange-text' : 'blue-text', !upToDate);
    }
    const expanded = folder?.status?.expanded === true;
    folder.status = { started, paused, stopped, autostart, autostartStarted, managed, upToDate, managerTypes: Array.from(managerTypes), expanded };
};

const syncDashboardRuntimeRows = (type, changedNames) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const changedSet = new Set(Array.isArray(changedNames) ? changedNames : []);
    const runtimeMap = dashboardRuntimeInfoByType[resolvedType] || {};
    const tbodySelector = resolvedType === 'vm' ? 'tbody#vm_view' : 'tbody#docker_view';
    changedSet.forEach((name) => {
        const entry = runtimeMap[name];
        if (!entry) return;
        $(`${tbodySelector} span.outer`).not(`.folder-${resolvedType}`).filter(function matchDashboardRuntimeMember() {
            const stampedName = String($(this).attr('data-fv-runtime-name') || '').trim();
            const renderedName = String($(this).find('span.inner').contents().first().text() || '').trim();
            return stampedName === name || renderedName === name;
        }).each((_, node) => syncDashboardRuntimeSurface(resolvedType, $(node), entry));
    });
    const folderMap = resolvedType === 'vm' ? (globalFolders.vms || {}) : (globalFolders.docker || {});
    let patchedFolders = 0;
    Object.entries(folderMap).forEach(([id, folder]) => {
        if (!Object.keys(folder?.containers || {}).some((name) => changedSet.has(name))) return;
        updateDashboardFolderRuntimeSummary(resolvedType, id, folder);
        patchedFolders += 1;
    });
    window.FolderViewPlusDashboardRowReconciliation = {
        ...(window.FolderViewPlusDashboardRowReconciliation || {}),
        [resolvedType]: {
            mode: 'incremental',
            changedRows: changedSet.size,
            patchedFolders,
            capturedAt: new Date().toISOString()
        }
    };
};

const refreshDashboardTypeRuntimeStateInPlace = async (type) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    try {
        const useSnapshot = runtimeSnapshotApi && typeof runtimeSnapshotApi.buildUrl === 'function';
        const payload = await requestClient.getJson(useSnapshot
            ? runtimeSnapshotApi.buildUrl(resolvedType, 'state', { forceRefresh: true })
            : '/plugins/folderview.plus/server/read_info.php', {
                data: useSnapshot ? undefined : { type: resolvedType, mode: 'state', nocache: 1 },
                cache: false
            });
        const snapshot = useSnapshot ? runtimeSnapshotApi.parsePayload(payload) : null;
        const parsed = snapshot ? snapshot.runtime : parseDashboardPayloadOr(payload, {});
        if (!parsed || Object.keys(parsed).length <= 0 || (snapshot && !dashboardRuntimeSnapshotConfigMatches(resolvedType, snapshot))) return false;
        const nextRuntimeInfo = normalizeDashboardRuntimeInfoMap(resolvedType, parsed, dashboardRuntimeInfoByType[resolvedType]);
        const rowDiff = runtimeSnapshotApi && typeof runtimeSnapshotApi.diffRuntimeRows === 'function'
            ? runtimeSnapshotApi.diffRuntimeRows(resolvedType, dashboardRuntimeInfoByType[resolvedType], nextRuntimeInfo)
            : { changed: Object.keys(nextRuntimeInfo), structuralChanged: true, hasChanges: true };
        dashboardRuntimeInfoByType[resolvedType] = nextRuntimeInfo;
        lastDashboardStateSignatures[resolvedType] = resolvedType === 'docker'
            ? buildDockerStateSignature(parsed, true)
            : buildVmStateSignature(parsed, true);
        if (snapshot) rememberDashboardRuntimeSnapshot(resolvedType, snapshot);
        if (rowDiff.structuralChanged) {
            window.FolderViewPlusDashboardRowReconciliation = {
                ...(window.FolderViewPlusDashboardRowReconciliation || {}),
                [resolvedType]: {
                    mode: 'structural-fallback',
                    changedRows: Number(rowDiff.changed?.length || 0),
                    addedRows: Number(rowDiff.added?.length || 0),
                    removedRows: Number(rowDiff.removed?.length || 0),
                    capturedAt: new Date().toISOString()
                }
            };
            return false;
        }
        if (rowDiff.hasChanges) syncDashboardRuntimeRows(resolvedType, rowDiff.changed);
        return true;
    } catch (_error) {
        return false;
    }
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
            const checks = [];
            if ($('tbody#docker_view').length > 0 && folderTypePrefs?.docker?.liveRefreshEnabled === true) {
                checks.push('docker');
            }
            if ($('tbody#vm_view').length > 0 && folderTypePrefs?.vm?.liveRefreshEnabled === true) {
                checks.push('vm');
            }
            if (!checks.length) {
                return;
            }

            let requiresFullRefresh = false;
            for (const type of checks) {
                let check = null;
                try {
                    check = await fetchDashboardTypeSnapshotCheck(type);
                } catch (_error) {
                    check = null;
                }
                if (!check || (!check.snapshotToken && !check.runtimeSignature)) {
                    requiresFullRefresh = true;
                    continue;
                }
                if (check.notModified !== true) {
                    const patched = await refreshDashboardTypeRuntimeStateInPlace(type);
                    if (patched !== true) requiresFullRefresh = true;
                }
            }
            if (requiresFullRefresh) {
                queueLoadlistRefresh();
            }
        })
        .finally(() => {
            setTimeout(() => {
                liveRefreshInFlight = false;
            }, 500);
        });
};

const applyDashboardRuntimePrefs = () => {
    const dockerPrefs = utils.normalizePrefs(folderTypePrefs?.docker || {});
    const vmPrefs = utils.normalizePrefs(folderTypePrefs?.vm || {});
    const candidates = [];
    const dockerRequestedSeconds = Math.max(10, Math.min(300, Number(dockerPrefs.liveRefreshSeconds) || 20));
    const vmRequestedSeconds = Math.max(10, Math.min(300, Number(vmPrefs.liveRefreshSeconds) || 20));
    const dockerSeconds = dockerPrefs.performanceMode === true
        ? Math.max(PERFORMANCE_MODE_MIN_REFRESH_SECONDS, dockerRequestedSeconds)
        : dockerRequestedSeconds;
    const vmSeconds = vmPrefs.performanceMode === true
        ? Math.max(PERFORMANCE_MODE_MIN_REFRESH_SECONDS, vmRequestedSeconds)
        : vmRequestedSeconds;
    if ($('tbody#docker_view').length > 0 && dockerPrefs.liveRefreshEnabled === true) {
        candidates.push(dockerSeconds);
    }
    if ($('tbody#vm_view').length > 0 && vmPrefs.liveRefreshEnabled === true) {
        candidates.push(vmSeconds);
    }
    const performanceMode = dockerPrefs.performanceMode === true || vmPrefs.performanceMode === true;
    $('body').toggleClass('fvplus-performance-mode', performanceMode);
    const dockerPrivacyMode = dockerPrefs?.dashboard?.privacyMode === true;
    const vmPrivacyMode = vmPrefs?.dashboard?.privacyMode === true;
    $('body').toggleClass('fvplus-privacy-docker-dashboard', dockerPrivacyMode);
    $('body').toggleClass('fvplus-privacy-docker-dashboard-mask-names', dockerPrivacyMode && dockerPrefs?.dashboard?.privacyMaskNames !== false);
    $('body').toggleClass('fvplus-privacy-vm-dashboard', vmPrivacyMode);
    $('body').toggleClass('fvplus-privacy-vm-dashboard-mask-names', vmPrivacyMode && vmPrefs?.dashboard?.privacyMaskNames !== false);
    window.FolderViewPlusRuntimePrivacy?.apply('docker', dockerPrivacyMode, dockerPrefs?.dashboard || {});
    window.FolderViewPlusRuntimePrivacy?.apply('vm', vmPrivacyMode, vmPrefs?.dashboard || {});

    if (!candidates.length) {
        clearLiveRefreshTimer();
        return;
    }
    const intervalMs = Math.min(...candidates) * 1000;
    if (liveRefreshTimer && liveRefreshMs === intervalMs) {
        return;
    }
    clearLiveRefreshTimer();
    liveRefreshMs = intervalMs;
    liveRefreshTimer = setInterval(runLiveRefreshTick, intervalMs);
};

const bindDashboardPreferenceSync = () => {
    if (!dashboardPrefsCoordinator || typeof dashboardPrefsCoordinator.subscribe !== 'function') {
        return;
    }
    dashboardPrefsCoordinator.subscribe((snapshot) => {
        const type = snapshot?.type === 'vm' ? 'vm' : 'docker';
        if (!snapshot?.prefs) {
            return;
        }
        folderTypePrefs[type] = utils.normalizePrefs(snapshot.prefs);
        applyDashboardRuntimePrefs();
    });
};
bindDashboardPreferenceSync();

const refreshDashboardDockerCpuCores = () => requestClient.getText('/plugins/folderview.plus/server/cpu.php')
    .then((value) => {
        const numeric = Number.parseInt(String(value || '').trim(), 10);
        dashboardDockerCpuCores = Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
        window.fvplusCpuCores = dashboardDockerCpuCores;
    }, () => {
        dashboardDockerCpuCores = Number.parseInt(String(window.fvplusCpuCores || window.fv3CpuCores || 1), 10) || 1;
        window.fvplusCpuCores = dashboardDockerCpuCores;
    });

refreshDashboardDockerCpuCores();

const queueCreateFoldersRender = () => {
    if (createFoldersInFlight) {
        createFoldersQueued = true;
        return createFoldersPromise || Promise.resolve(false);
    }
    createFoldersInFlight = true;
    createFoldersPromise = Promise.resolve()
        .then(() => createFolders())
        .then(() => true)
        .catch((error) => {
            loadedFolder = false;
            if (window.console && typeof window.console.warn === 'function') {
                console.warn('[FolderView Plus] Dashboard folder render failed.', error);
            }
            throw error;
        })
        .finally(() => {
            createFoldersInFlight = false;
            createFoldersPromise = null;
            if (createFoldersQueued) {
                createFoldersQueued = false;
                queueLoadlistRefresh();
            }
        });
    return createFoldersPromise;
};
const prepareDashboardFolderRequestsForType = (type) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const hasWidget = resolvedType === 'vm'
        ? $('tbody#vm_view').length > 0
        : $('tbody#docker_view').length > 0;
    if (!hasWidget) {
        folderReq[resolvedType] = [];
        return [];
    }
    const legacyFactories = [
        () => getDashboardRequestWithFallback(resolvedType, 'folders', `/plugins/folderview.plus/server/read.php?type=${resolvedType}`, {}),
        () => getDashboardRequestWithFallback(resolvedType, 'folder order', `/plugins/folderview.plus/server/read_order.php?type=${resolvedType}`, {}),
        () => getDashboardRequestWithFallback(resolvedType, 'runtime info', `/plugins/folderview.plus/server/read_info.php?type=${resolvedType}`, {}),
        () => getDashboardRequestWithFallback(resolvedType, 'unraid order', `/plugins/folderview.plus/server/read_unraid_order.php?type=${resolvedType}`, {}),
        () => getDashboardRequestWithFallback(resolvedType, 'preferences', `/plugins/folderview.plus/server/prefs.php?type=${resolvedType}`, { ok: false, prefs: {} })
    ];
    if (!runtimeSnapshotApi || typeof runtimeSnapshotApi.createProjectedBundle !== 'function') {
        folderReq[resolvedType] = legacyFactories.map((factory) => factory());
        return folderReq[resolvedType];
    }
    const snapshotRequest = requestClient.getJson(runtimeSnapshotApi.buildUrl(resolvedType, 'full', {
        cacheBust: Date.now()
    }), { cache: false }).then((data) => data, (error) => {
        recordDashboardRequestFallback(resolvedType, 'runtime snapshot', error);
        throw error;
    });
    folderReq[resolvedType] = runtimeSnapshotApi.createProjectedBundle(
        snapshotRequest,
        ['folders', 'order', 'runtime', 'unraidOrder', 'prefsResponse'],
        {
            onSnapshot: (snapshot) => {
                rememberDashboardRuntimeSnapshot(resolvedType, snapshot);
            },
            fallbackFactories: legacyFactories
        }
    );
    return folderReq[resolvedType];
};

// Patching the original function to make sure the containers are rendered before insering the folder
window.loadlist_original = loadlist;
window.loadlist = (x) => {
    loadedFolder = false;
    prepareDashboardFolderRequestsForType('docker');
    prepareDashboardFolderRequestsForType('vm');
    loadlist_original(x);
};

// this is needed to trigger the funtion to create the folders
$.ajaxPrefilter((options, originalOptions, jqXHR) => {
    if (options.url === "/webGui/include/DashboardApps.php" && !loadedFolder) {
        jqXHR.promise().then(() => {
            queueCreateFoldersRender()
                .then((rendered) => {
                    loadedFolder = rendered !== false;
                })
                .catch(() => {
                    loadedFolder = false;
                })
                .finally(() => {
                    $('div.spinner.fixed').hide();
                });
        });
    }
});

// activate debug mode
window.addEventListener("keydown", (e) => {
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
})(window, window.jQuery || window.$);
