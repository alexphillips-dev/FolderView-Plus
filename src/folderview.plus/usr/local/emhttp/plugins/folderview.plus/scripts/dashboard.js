(function fvplusDashboardScope(window, $) {
if (!window || !$) {
    return;
}

const localDefaultFolderStatusColors = {
    started: '#ffffff',
    paused: '#b8860b',
    stopped: '#ff4d4d'
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
const utils = window.FolderViewPlusUtils || {
    normalizePrefs: () => ({
        sortMode: 'created',
        manualOrder: [],
        autoRules: [],
        runtimePrefsSchema: 2,
        liveRefreshEnabled: false,
        liveRefreshSeconds: 20,
        performanceMode: false,
        lazyPreviewEnabled: false,
        lazyPreviewThreshold: 30,
        dashboard: {
            layout: 'classic',
            expandToggle: true,
            greyscale: false,
            folderLabel: true
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
    DASHBOARD_LAYOUT_OPTIONS: Object.freeze(['classic', 'legacy', 'fullwidth', 'accordion', 'inset', 'compactmatrix']),
    DASHBOARD_LAYOUT_LABELS: Object.freeze({
        classic: 'Classic',
        legacy: 'Legacy',
        fullwidth: 'Full Width',
        accordion: 'Accordion',
        inset: 'Inset',
        compactmatrix: 'Compact Matrix'
    }),
    normalizeDashboardLayout: (value) => {
        const normalized = String(value || '').trim().toLowerCase();
        return ['classic', 'legacy', 'fullwidth', 'accordion', 'inset', 'compactmatrix'].includes(normalized)
            ? normalized
            : 'classic';
    },
    normalizeDashboardOverflowMode: (value) => {
        const normalized = String(value || '').trim().toLowerCase();
        return ['default', 'expand_row', 'scroll'].includes(normalized) ? normalized : 'default';
    }
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
const WEBUI_LINK_REL = 'noopener noreferrer';
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
const appendDashboardDockerMemberQuickActions = ($containerEl, ct) => {
    if (!$containerEl || !$containerEl.length || !ct || typeof ct !== 'object') {
        return;
    }
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
    if (webUiUrl) {
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
    : ['classic', 'legacy', 'fullwidth', 'accordion', 'inset', 'compactmatrix'];
const DASHBOARD_LAYOUT_LABELS = utils.DASHBOARD_LAYOUT_LABELS || Object.freeze({
    classic: 'Classic',
    legacy: 'Legacy',
    fullwidth: 'Full Width',
    accordion: 'Accordion',
    inset: 'Inset',
    compactmatrix: 'Compact Matrix'
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
        folderLabel: dashboard.folderLabel !== false
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
        const payload = await $.get(`/plugins/folderview.plus/server/read_unraid_order.php?type=${resolvedType}`).promise();
        return Object.values(JSON.parse(payload));
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
const getDashboardFolderCardsForType = (type) => {
    const controller = getDashboardQuickRailController();
    return controller ? controller.getDashboardFolderCardsForType(type) : $();
};
const getDashboardWidgetBodyForType = (type) => {
    const controller = getDashboardQuickRailController();
    return controller ? controller.getDashboardWidgetBodyForType(type) : $();
};
const getDashboardWidgetUpdatedRowForType = (type) => {
    const controller = getDashboardQuickRailController();
    return controller ? controller.getDashboardWidgetUpdatedRowForType(type) : $();
};
const isDashboardNodeVisible = (node) => {
    const controller = getDashboardQuickRailController();
    return controller ? controller.isDashboardNodeVisible(node) : false;
};
const isDashboardWidgetCollapsedForType = (type) => {
    const controller = getDashboardQuickRailController();
    return controller ? controller.isDashboardWidgetCollapsedForType(type) : true;
};
const getFirstVisibleDashboardFolderCardForType = (type) => {
    const controller = getDashboardQuickRailController();
    return controller ? controller.getFirstVisibleDashboardFolderCardForType(type) : null;
};
const ensureDashboardWidgetInlineHostMountForType = (type, hostOverride = null) => {
    const controller = getDashboardQuickRailController();
    return controller ? controller.ensureDashboardWidgetInlineHostMountForType(type, hostOverride) : $();
};
const syncDashboardWidgetQuickRailFitForType = (type, parentRect, offsetTop) => {
    const controller = getDashboardQuickRailController();
    if (controller) {
        controller.syncDashboardWidgetQuickRailFitForType(type, parentRect, offsetTop);
    }
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
    const requestApi = window.FolderViewPlusRequest;
    if (requestApi && typeof requestApi.postJson === 'function') {
        return requestApi.postJson('/plugins/folderview.plus/server/prefs.php', {
            type: resolvedType,
            prefs: JSON.stringify(prefsPayload || {})
        }, {
            retries: 0,
            timeoutMs: 10000
        });
    }
    const payload = await $.post('/plugins/folderview.plus/server/prefs.php', {
        type: resolvedType,
        prefs: JSON.stringify(prefsPayload || {})
    }).promise();
    return parseJsonPayloadSafe(payload);
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
const ensureDashboardWidgetLayoutQuickSwitchForType = (type) => {
    const controller = getDashboardQuickRailController();
    if (controller) {
        controller.ensureDashboardWidgetLayoutQuickSwitchForType(type);
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
const applyDashboardLayoutStateForType = (type) => {
    const controller = getDashboardQuickRailController();
    if (controller) {
        controller.applyDashboardLayoutStateForType(type);
    }
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
const bindDashboardWidgetVisibilityObserverForType = (type) => {
    const controller = getDashboardQuickRailController();
    if (controller) {
        controller.bindDashboardWidgetVisibilityObserverForType(type);
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
        let folders = JSON.parse(prom[0]);
        const allDockerFolders = folders && typeof folders === 'object' ? folders : {};
        const dockerTreeIndex = buildFolderChildrenIndex(allDockerFolders);
        const dockerChildrenByParent = dockerTreeIndex.childrenByParent || {};
        let unraidOrder = Object.values(JSON.parse(prom[1]));
        const containersInfo = JSON.parse(prom[2]);
        let order = Object.values(JSON.parse(prom[3]));
        let prefsResponse = {};
        try {
            prefsResponse = parseJsonPayloadSafe(prom[4]);
        } catch (_error) {
            prefsResponse = {};
        }
        folderTypePrefs.docker = utils.normalizePrefs(prefsResponse?.prefs || {});
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
            const debugData = JSON.stringify({
                version: (await $.get('/plugins/folderview.plus/server/version.php').promise()).trim(),
                folders,
                unraidOrder,
                originalOrder: JSON.parse(await $.get('/plugins/folderview.plus/server/read_unraid_order.php?type=docker').promise()),
                newOnes,
                order,
                containersInfo
            });
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
        let folders = JSON.parse(prom[0]);
        const allVmFolders = folders && typeof folders === 'object' ? folders : {};
        const vmTreeIndex = buildFolderChildrenIndex(allVmFolders);
        const vmChildrenByParent = vmTreeIndex.childrenByParent || {};
        let unraidOrder = Object.values(JSON.parse(prom[1]));
        const vmInfo = JSON.parse(prom[2]);
        let order = Object.values(JSON.parse(prom[3]));
        let prefsResponse = {};
        try {
            prefsResponse = parseJsonPayloadSafe(prom[4]);
        } catch (_error) {
            prefsResponse = {};
        }
        folderTypePrefs.vm = utils.normalizePrefs(prefsResponse?.prefs || {});
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
    const safeFolderIcon = sanitizeImageSrc(folder.icon);
    const safeFolderName = escapeHtml(folder.name);
    const overflowMode = normalizeDashboardOverflowMode(folder?.settings?.dashboard_overflow);
    const fld = `<div class="folder-showcase-outer-${id} folder-showcase-outer" data-fv-folder-id="${id}" data-fv-dashboard-overflow="${overflowMode}"><span class="outer solid apps stopped folder-docker" onclick='expandFolderDocker("${id}")'><span id="folder-id-${id}" class="hand docker folder-hand-docker"><img src="${safeFolderIcon}" class="img folder-img-docker" onerror="this.src='/plugins/dynamix.docker.manager/images/question.png';"></span><span class="inner folder-inner-docker"><span class="folder-appname-docker">${safeFolderName}</span><br><i class="fa fa-square stopped folder-load-status-docker"></i><span class="state folder-state-docker">${$.i18n('stopped')}</span></span><button type="button" class="fv-dashboard-expand-toggle-btn" onclick='event.stopPropagation(); expandFolderDocker("${id}"); return false;' aria-label="Toggle folder members"><i class="fa fa-chevron-down" aria-hidden="true"></i></button><div class="folder-storage"></div></span><div class="folder-showcase-${id} folder-showcase"></div></div>`;

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
            element.append($containerEl.addClass(`folder-${id}-element`).addClass(`folder-element-docker`).addClass(`${!(ct.info.State.Autostart === false) ? 'autostart' : ''}`));
            appendDashboardDockerMemberQuickActions($containerEl, ct);
            

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
    const statusColors = typeof utils.getFolderStatusColors === 'function'
        ? utils.getFolderStatusColors(folder.settings)
        : localDefaultFolderStatusColors;
    const $statusIcon = sel.next('span.inner').children('i');
    const $statusText = sel.next('span.inner').children('span.state');
    $statusIcon.css('color', statusColors.stopped);
    $statusText.css('color', statusColors.stopped);
    
    //set the status of a folder

    if (!upToDate && managerTypes.has('dockerman')) {
        sel.next('span.inner').children().first().addClass(folder.settings?.preview_update ? 'orange-text' : 'blue-text');
    }

    if (started) {
        sel.parent().removeClass('stopped').addClass('started');
        $statusIcon.replaceWith($(`<i class="fa fa-play started folder-load-status-docker" style="color:${statusColors.started}"></i>`));
        $statusText.text(`${started}/${Object.entries(folder.containers).length} ${$.i18n('started')}`).css('color', statusColors.started);
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
    const fld = `<div class="folder-showcase-outer-${id} folder-showcase-outer" data-fv-folder-id="${id}" data-fv-dashboard-overflow="${overflowMode}"><span class="outer solid vms stopped folder-vm" onclick='expandFolderVM("${id}")'><span id="folder-id-${id}" class="hand vm folder-hand-vm"><img src="${safeFolderIcon}" class="img folder-img-vm" onerror='this.src="/plugins/dynamix.docker.manager/images/question.png"'></span><span class="inner folder-inner-vm"><span class="folder-appname-vm">${safeFolderName}</span><br><i class="fa fa-square stopped folder-load-status-vm"></i><span class="state folder-state-vm">${$.i18n('stopped')}</span></span><button type="button" class="fv-dashboard-expand-toggle-btn" onclick='event.stopPropagation(); expandFolderVM("${id}"); return false;' aria-label="Toggle folder members"><i class="fa fa-chevron-down" aria-hidden="true"></i></button><div class="folder-storage" style="display:none"></div></span><div class="folder-showcase-${id} folder-showcase"></div></div>`;

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
            $(`tbody#vm_view span#folder-id-${id}`).siblings('div.folder-storage').append($vmEl.addClass(`folder-${id}-element`).addClass(`folder-element-vm`).addClass(`${ct.autostart ? 'autostart' : ''}`));

            if(folderDebugMode) {
                dashboardDebugLog(`VM ${newFolder[container].id}(${offsetIndex}, ${index}) => ${id}`);
            }
            
            // set the status of the folder
            started += ct.state!=="shutoff" ? 1 : 0;
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

    // replace the old containers array with the newFolder object
    folder.containers = newFolder;
    if (folderTypePrefs?.vm?.hideEmptyFolders === true && Object.keys(folder.containers).length === 0 && !preserveWhenEmpty) {
        $(`.folder-showcase-outer-${id}`).remove();
        return remBefore;
    }

    
    //set tehe status of a folder
    const sel = $(`tbody#vm_view span#folder-id-${id}`);
    const statusColors = typeof utils.getFolderStatusColors === 'function'
        ? utils.getFolderStatusColors(folder.settings)
        : localDefaultFolderStatusColors;
    const $statusIcon = sel.next('span.inner').children('i');
    const $statusText = sel.next('span.inner').children('span.state');
    $statusIcon.css('color', statusColors.stopped);
    $statusText.css('color', statusColors.stopped);
    if (started) {
        sel.parent().removeClass('stopped').addClass('started');
        $statusIcon.replaceWith($(`<i class="fa fa-play started folder-load-status-vm" style="color:${statusColors.started}"></i>`));
        $statusText.text(`${started}/${Object.entries(folder.containers).length} ${$.i18n('started')}`).css('color', statusColors.started);
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

/**
 * Removie the folder
 * @param {string} id the id of the folder
 */
const rmDockerFolder = (id) => {
    // Ask for a confirmation
    swal({
        title: $.i18n('are-you-sure'),
        text: `${$.i18n('remove-folder')}: ${globalFolders.docker[id].name}`,
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
        await $.post('/plugins/folderview.plus/server/delete.php', { type: 'docker', id: id }).promise();
        loadedFolder = false;
        setTimeout(loadlist, 500)
    });
};

/**
 * Removie the folder
 * @param {string} id the id of the folder
 */
const rmVMFolder = (id) => {
    // Ask for a confirmation
    swal({
        title: $.i18n('are-you-sure'),
        text: `${$.i18n('remove-folder')}: ${globalFolders.vms[id].name}`,
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
const seedDashboardFolderEditorPrefill = (folderType, id) => {
    try {
        const normalizedType = String(folderType || '').trim();
        const normalizedId = String(id || '').trim();
        const folderMap = normalizedType === 'vm' ? globalFolders?.vms : globalFolders?.docker;
        const folder = folderMap && typeof folderMap === 'object' ? folderMap[normalizedId] : null;
        if (!normalizedType || !normalizedId || !folder) {
            return;
        }
        const payload = JSON.stringify({
            type: normalizedType,
            id: normalizedId,
            folder,
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
            type: normalizedType,
            id: normalizedId,
            storedAt: Date.now()
        }))}; path=/; max-age=900; SameSite=Lax`;
    } catch (_error) {
        // Editor prefill is best-effort only.
    }
};
const recordDashboardFolderEditorLaunchDebug = (sourcePage, folderType, id, targetUrl) => {
    try {
        if (typeof localStorage === 'undefined') {
            return;
        }
        const resolvedType = String(folderType || '').trim() === 'vm' ? 'vm' : 'docker';
        const normalizedId = String(id || '').trim();
        const folderMap = resolvedType === 'vm' ? globalFolders?.vms : globalFolders?.docker;
        const folder = folderMap && typeof folderMap === 'object' ? folderMap[normalizedId] : null;
        localStorage.setItem(EDITOR_DEBUG_LAUNCH_STORAGE_KEY, JSON.stringify({
            storedAt: new Date().toISOString(),
            source: String(sourcePage || 'dashboard').trim() || 'dashboard',
            type: resolvedType,
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
const buildDashboardFolderEditorUrl = (folderType, id = '') => {
    const resolvedType = String(folderType || '').trim() === 'vm' ? 'vm' : 'docker';
    const params = new URLSearchParams();
    const hashParams = new URLSearchParams();
    params.set('type', resolvedType);
    hashParams.set('type', resolvedType);
    if (String(id || '').trim()) {
        params.set('id', String(id || '').trim());
        hashParams.set('id', String(id || '').trim());
    }
    params.set('_', String(Date.now()));
    return `${location.pathname}/Folder?${params.toString()}#${hashParams.toString()}`;
};
const editDockerFolder = (id) => {
    seedDashboardFolderEditorPrefill('docker', id);
    const targetUrl = buildDashboardFolderEditorUrl('docker', id);
    recordDashboardFolderEditorLaunchDebug('dashboard', 'docker', id, targetUrl);
    location.href = targetUrl;
};

/**
 * Redirect to the page to edit the folder
 * @param {string} id the id of the folder
 */
const editVMFolder = (id) => {
    seedDashboardFolderEditorPrefill('vm', id);
    const targetUrl = buildDashboardFolderEditorUrl('vm', id);
    recordDashboardFolderEditorLaunchDebug('dashboard', 'vm', id, targetUrl);
    location.href = targetUrl;
};

/**
 * Execute the desired custom action
 * @param {string} id 
 * @param {number} action 
 */
const folderDockerCustomAction = async (id, action) => {
    $('div.spinner.fixed').show('slow');
    const folder = globalFolders.docker[id];
    let act = folder.actions[action];
    let prom = [];
    if(act.type === 0) {
        const actionContainers = Array.isArray(act.conatiners)
            ? act.conatiners
            : (Array.isArray(act.containers) ? act.containers : []);
        const cts = actionContainers.map(e => folder.containers[e]).filter(e => e);
        let ctAction = null;
        if(act.action === 0) {

            if(act.modes === 0) {
                ctAction = (e) => {
                    if(e.state) {
                        prom.push($.post(eventURL, {action: 'stop', container:e.id}, null,'json').promise());
                    } else {
                        prom.push($.post(eventURL, {action: 'start', container:e.id}, null,'json').promise());
                    }
                };
            } else if(act.modes === 1) {
                ctAction = (e) => {
                    if(e.state) {
                        if(e.pause) {
                            prom.push($.post(eventURL, {action: 'resume', container:e.id}, null,'json').promise());
                        } else {
                            prom.push($.post(eventURL, {action: 'pause', container:e.id}, null,'json').promise());
                        }
                    }
                };
            }

        } else if(act.action === 1) {

            if(act.modes === 0) {
                ctAction = (e) => {
                    if(!e.state) {
                        prom.push($.post(eventURL, {action: 'start', container:e.id}, null,'json').promise());
                    }
                };
            } else if(act.modes === 1) {
                ctAction = (e) => {
                    if(e.state) {
                        prom.push($.post(eventURL, {action: 'stop', container:e.id}, null,'json').promise());
                    }
                };
            } else if(act.modes === 2) {
                ctAction = (e) => {
                    if(e.state && !e.pause) {
                        prom.push($.post(eventURL, {action: 'pause', container:e.id}, null,'json').promise());
                    }
                };
            } else if(act.modes === 3) {
                ctAction = (e) => {
                    if(e.state && e.pause) {
                        prom.push($.post(eventURL, {action: 'resume', container:e.id}, null,'json').promise());
                    }
                };
            }

        } else if(act.action === 2) {

            ctAction = (e) => {
                prom.push($.post(eventURL, {action: 'restart', container:e.id}, null,'json').promise());
            };

        }

        if (typeof ctAction === 'function') {
            cts.forEach((e) => {
                ctAction(e);
            });
        } else {
            const unsupportedLabel = `action=${act.action}, mode=${act.modes}`;
            console.warn(`folderview.plus: Unsupported Docker dashboard custom action configuration (${unsupportedLabel}) for folder "${folder.name || id}".`);
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
    $('div.spinner.fixed').hide('slow');
};

/**
 * Atach the menu when clicking the folder icon
 * @param {string} id the id of the folder
 */
const addDockerFolderContext = (id) => {
    // get the expanded status, needed to swap expand/ compress
    const exp = $(`tbody#docker_view .folder-showcase-outer-${id}`).attr('expanded') === "true";
    let opts = [];
    context.settings({
        right: false,
        above: false
    });

    opts.push({
        text: exp ? $.i18n('compress') : $.i18n('expand'),
        icon: exp ? 'fa-minus' : 'fa-plus',
        action: (e) => { e.preventDefault(); expandFolderDocker(id); }
    });

    opts.push({
        divider: true
    });

    if (globalFolders.docker[id].settings.folder_webui && globalFolders.docker[id].settings.folder_webui_url) {
        opts.push({
            text: $.i18n('webui'),
            icon: 'fa-globe',
            action: (e) => {
                e.preventDefault();
                openWebUiInNewTab(globalFolders.docker[id].settings.folder_webui_url);
            }
        });
        opts.push({ divider: true });
    }

    if(globalFolders.docker[id].settings.override_default_actions && globalFolders.docker[id].actions && globalFolders.docker[id].actions.length) {
        opts.push(
            ...globalFolders.docker[id].actions.map((e, i) => {
                return {
                    text: e.name,
                    icon: e.script_icon || "fa-bolt",
                    action: (e) => { e.preventDefault(); folderCustomAction(id, i); }
                }
            })
        );
    
        opts.push({
            divider: true
        });

    } else if(!globalFolders.docker[id].settings.default_action) {
        opts.push({
            text: $.i18n('start'),
            icon: 'fa-play',
            action: (e) => { e.preventDefault(); actionFolderDocker(id, "start"); }
        });
        opts.push({
            text: $.i18n('stop'),
            icon: 'fa-stop',
            action: (e) => { e.preventDefault(); actionFolderDocker(id, "stop"); }
        });
        
        opts.push({
            text: $.i18n('pause'),
            icon: 'fa-pause',
            action: (e) => { e.preventDefault(); actionFolderDocker(id, "pause"); }
        });
    
        opts.push({
            text: $.i18n('resume'),
            icon: 'fa-play-circle',
            action: (e) => { e.preventDefault(); actionFolderDocker(id, "resume"); }
        });
    
        opts.push({
            text: $.i18n('restart'),
            icon: 'fa-refresh',
            action: (e) => { e.preventDefault(); actionFolderDocker(id, "restart"); }
        });
    
        opts.push({
            divider: true
        });
    }

    if(globalFolders.docker[id].status.managed > 0) {
        if(!globalFolders.docker[id].status.upToDate) {
            opts.push({
                text: $.i18n('update'),
                icon: 'fa-cloud-download',
                action: (e) => { e.preventDefault();  updateFolderDocker(id); }
            });
        } else {
            opts.push({
                text: $.i18n('update-force'),
                icon: 'fa-cloud-download',
                action: (e) => { e.preventDefault(); forceUpdateFolderDocker(id); }
            });
        }
        
        opts.push({
            divider: true
        });
    }

    opts.push({
        text: $.i18n('edit'),
        icon: 'fa-wrench',
        action: (e) => { e.preventDefault(); editDockerFolder(id); }
    });

    opts.push({
        text: $.i18n('remove'),
        icon: 'fa-trash',
        action: (e) => { e.preventDefault(); rmDockerFolder(id); }
    });

    if(!globalFolders.docker[id].settings.override_default_actions && globalFolders.docker[id].actions && globalFolders.docker[id].actions.length) {
        opts.push({
            divider: true
        });

        opts.push({
            text: $.i18n('custom-actions'),
            icon: 'fa-bars',
            subMenu: globalFolders.docker[id].actions.map((e, i) => {
                return {
                    text: e.name,
                    icon: e.script_icon || "fa-bolt",
                    action: (e) => { e.preventDefault(); folderDockerCustomAction(id, i); }
                }
            })
        });
    }

    folderEvents.dispatchEvent(new CustomEvent('docker-folder-context', {detail: { id, opts }}));

    context.attach(`#folder-id-${id}`, opts);
};

/**
 * Force update all the containers inside a folder
 * @param {string} id the id of the folder
 */
const forceUpdateFolderDocker = (id) => {
    const folder = globalFolders.docker[id];
    openDocker('update_container ' + Object.entries(folder.containers).filter(([k, v]) => v.managed).map(e => e[0]).join('*'), $.i18n('updating', folder.name),'','loadlist');
};

/**
 * Update all the updatable containers inside a folder
 * @param {string} id the id of the folder
 */
const updateFolderDocker = (id) => {
    const folder = globalFolders.docker[id];
    openDocker('update_container ' + Object.entries(folder.containers).filter(([k, v]) => v.managed && v.update).map(e => e[0]).join('*'), $.i18n('updating', folder.name),'','loadlist');
};

/**
 * Perform an action for the entire folder
 * @param {string} id The id of the folder
 * @param {string} action the desired action
 */
const actionFolderDocker = async (id, action) => {
    const folder =  globalFolders.docker[id];
    const cts = Object.keys(folder.containers);
    let proms = [];
    let errors;

    $(`i#load-folder-${id}`).removeClass('fa-play fa-square fa-pause').addClass('fa-refresh fa-spin');
    $('div.spinner.fixed').show('slow');

    for (let index = 0; index < cts.length; index++) {
        const ct = folder.containers[cts[index]];
        const cid = ct.id;
        let pass;
        switch (action) {
            case "start":
                pass = !ct.state;
                break;
            case "stop":
                pass = ct.state;
                break;
            case "pause":
                pass = ct.state && !ct.pause;
                break;
            case "resume":
                pass = ct.state && ct.pause;
                break;
            case "resume":
                pass = true;
                break;
            default:
                pass = false;
                break;
        }
        if(pass) {
            proms.push($.post(eventURL, {action: action, container:cid}, null,'json').promise());
        }
    }

    proms = await Promise.all(proms);
    errors = proms.filter(e => e.success !== true);
    errors = errors.map(e => e.success);

    if(errors.length > 0) {
        swal({
            title: $.i18n('exec-error'),
            text:errors.join('<br>'),
            type:'error',
            html:true,
            confirmButtonText:'Ok'
        }, loadlist);
    }

    loadlist();
    $('div.spinner.fixed').hide('slow');
}

/**
 * Execute the desired custom action
 * @param {string} id 
 * @param {number} action 
 */
const folderVMCustomAction = async (id, action) => {
    $('div.spinner.fixed').show('slow');
    const eventURL = '/plugins/dynamix.vm.manager/include/VMajax.php';
    const folder = globalFolders.vms[id];
    let act = folder.actions[action];
    let prom = [];
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
            console.warn(`folderview.plus: Unsupported VM dashboard custom action configuration (${unsupportedLabel}) for folder "${folder.name || id}".`);
        }
    } else if(act.type === 1) {
        const args = act.script_args || '';
        if(act.script_sync) {
            let scriptVariables = {}
            let rawVars = await $.post("/plugins/user.scripts/exec.php",{action:'getScriptVariables',script:`/boot/config/plugins/user.scripts/scripts/${act.script}/script`}).promise();
            rawVars.trim().split('\n').forEach((e) => { const variable = e.split('='); scriptVariables[variable[0]] = variable[1] });
            if(scriptVariables['directPHP']) {
                $.post("/plugins/user.scripts/exec.php",{action:'convertScript',path:`/boot/config/plugins/user.scripts/scripts/${act.script}/script`},function(data) {if(data) {openBox('/plugins/user.scripts/startScript.sh&arg1='+data+'&arg2='+args,act.name,800,1200,true, 'loadlist');}});
            } else {
                $.post("/plugins/user.scripts/exec.php",{action:'convertScript',path:`/boot/config/plugins/user.scripts/scripts/${act.script}/script`},function(data) {if(data) {openBox('/plugins/user.scripts/startScript.sh&arg1='+data+'&arg2=',act.name,800,1200,true, 'loadlist');}});
            }
        } else {
            const cmd = await $.post("/plugins/user.scripts/exec.php",{action:'convertScript', path:`/boot/config/plugins/user.scripts/scripts/${act.script}/script`}).promise();
            prom.push($.get('/logging.htm?cmd=/plugins/user.scripts/backgroundScript.sh&arg1='+cmd+'&arg2='+args+'&csrf_token='+csrf_token+'&done=Done').promise());
        }
    }

    await Promise.all(prom);

    loadlist();
    $('div.spinner.fixed').hide('slow');
};

/**
 * Atach the menu when clicking the folder icon
 * @param {string} id the id of the folder
 */
const addVMFolderContext = (id) => {
    // get the expanded status, needed to swap expand/ compress
    const exp = $(`tbody#vm_view .folder-showcase-outer-${id}`).attr('expanded') === "true";
    let opts = [];
    context.settings({
        right: false,
        above: false
    });

    opts.push({
        text: exp ? $.i18n('compress') : $.i18n('expand'),
        icon: exp ? 'fa-minus' : 'fa-plus',
        action: (e) => { e.preventDefault(); expandFolderVM(id); }
    });
    
    opts.push({
        divider: true
    });

    if(globalFolders.vms[id].settings.override_default_actions && globalFolders.vms[id].actions && globalFolders.vms[id].actions.length) {
        opts.push(
            ...globalFolders.vms[id].actions.map((e, i) => {
                return {
                    text: e.name,
                    icon: e.script_icon || "fa-bolt",
                    action: (e) => { e.preventDefault(); folderCustomAction(id, i); }
                }
            })
        );
    
        opts.push({
            divider: true
        });

    } else if(!globalFolders.vms[id].settings.default_action) {
        opts.push({
            text: $.i18n('start'),
            icon: "fa-play",
            action: (e) => { e.preventDefault(); actionFolderVM(id, 'domain-start'); }
        });
    
        opts.push({
            text: $.i18n('stop'),
            icon: "fa-stop",
            action: (e) => { e.preventDefault(); actionFolderVM(id, 'domain-stop'); }
        });
    
        opts.push({
            text: $.i18n('pause'),
            icon: "fa-pause",
            action: (e) => { e.preventDefault(); actionFolderVM(id, 'domain-pause'); }
        });
    
        opts.push({
            text: $.i18n('resume'),
            icon: "fa-play-circle",
            action: (e) => { e.preventDefault(); actionFolderVM(id, 'domain-resume'); }
        });
    
        opts.push({
            text: $.i18n('restart'),
            icon: "fa-refresh",
            action: (e) => { e.preventDefault(); actionFolderVM(id, 'domain-restart'); }
        });
    
        opts.push({
            text: $.i18n('hibernate'),
            icon: "fa-bed",
            action: (e) => { e.preventDefault(); actionFolderVM(id, 'domain-pmsuspend'); }
        });
    
        opts.push({
            text: $.i18n('force-stop'),
            icon: "fa-bomb",
            action: (e) => { e.preventDefault(); actionFolderVM(id, 'domain-destroy'); }
        });
    
        opts.push({
            divider: true
        });
    }


    opts.push({
        text: $.i18n('edit'),
        icon: 'fa-wrench',
        action: (e) => { e.preventDefault(); editVMFolder(id); }
    });

    opts.push({
        text: $.i18n('remove'),
        icon: 'fa-trash',
        action: (e) => { e.preventDefault(); rmVMFolder(id); }
    });

    if(!globalFolders.vms[id].settings.override_default_actions && globalFolders.vms[id].actions && globalFolders.vms[id].actions.length) {
        opts.push({
            divider: true
        });

        opts.push({
            text: $.i18n('custom-actions'),
            icon: 'fa-bars',
            subMenu: globalFolders.vms[id].actions.map((e, i) => {
                return {
                    text: e.name,
                    icon: e.script_icon || "fa-bolt",
                    action: (e) => { e.preventDefault(); folderVMCustomAction(id, i); }
                }
            })
        });
    }

    folderEvents.dispatchEvent(new CustomEvent('vm-folder-context', {detail: { id, opts }}));

    context.attach(`#folder-id-${id}`, opts);
};

/**
 * Perform an action for the entire folder
 * @param {string} id The id of the folder
 * @param {string} action the desired action
 */
const actionFolderVM = async (id, action) => {
    const folder =  globalFolders.vms[id];
    const cts = Object.keys(folder.containers);
    let proms = [];
    let errors;
    const oldAction = action;

    $(`i#load-folder-${id}`).removeClass('fa-play fa-square fa-pause').addClass('fa-refresh fa-spin');
    $('div.spinner.fixed').show('slow');

    for (let index = 0; index < cts.length; index++) {
        const ct = folder.containers[cts[index]];
        const cid = ct.id;
        let pass;
        action = oldAction;
        switch (action) {
            case "domain-start":
                pass = ct.state !== "running" && ct.state !== "pmsuspended" && ct.state !== "paused" && ct.state !== "unknown";
                break;
            case "domain-stop":
            case "domain-pause":
            case "domain-restart":
            case "domain-pmsuspend":
                pass = ct.state === "running";
                break;
            case "domain-resume":
                pass = ct.state === "paused" || ct.state === "unknown";
                if(!pass) {
                    pass = ct.state === "pmsuspended";
                    action = "domain-pmwakeup";
                }
                break;
            case "domain-destroy":
                pass = ct.state === "running" || ct.state === "pmsuspended" || ct.state === "paused" || ct.state === "unknown";
                break;
            default:
                pass = false;
                break;
        }
        if(pass) {
            proms.push($.post('/plugins/dynamix.vm.manager/include/VMajax.php', {action: action, uuid: cid}, null,'json').promise());
        }
    }

    proms = await Promise.all(proms);
    errors = proms.filter(e => e.success !== true);
    errors = errors.map(e => e.success);

    if(errors.length > 0) {
        swal({
            title: $.i18n('exec-error'),
            text:errors.join('<br>'),
            type:'error',
            html:true,
            confirmButtonText:'Ok'
        }, loadlist);
    }

    loadlist();
    $('div.spinner.fixed').hide('slow');
}

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
let lastDashboardStateSignatures = {
    docker: '',
    vm: ''
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

const fetchDashboardTypeStateSignature = async (type) => {
    const payload = await $.get(`/plugins/folderview.plus/server/read_info.php?type=${type}&mode=state`).promise();
    const parsed = parseJsonPayloadSafe(payload);
    if (type === 'docker') {
        return buildDockerStateSignature(parsed, true);
    }
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

            let changed = false;
            for (const type of checks) {
                let signature = '';
                try {
                    signature = await fetchDashboardTypeStateSignature(type);
                } catch (_error) {
                    signature = '';
                }
                if (!signature) {
                    changed = true;
                    continue;
                }
                if (signature !== lastDashboardStateSignatures[type]) {
                    lastDashboardStateSignatures[type] = signature;
                    changed = true;
                }
            }
            if (changed) {
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

const queueCreateFoldersRender = () => {
    if (createFoldersInFlight) {
        createFoldersQueued = true;
        return;
    }
    createFoldersInFlight = true;
    Promise.resolve()
        .then(() => createFolders())
        .finally(() => {
            createFoldersInFlight = false;
            if (createFoldersQueued) {
                createFoldersQueued = false;
                queueLoadlistRefresh();
            }
        });
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
    if (resolvedType === 'docker') {
        const safeDockerPrefsReq = $.get('/plugins/folderview.plus/server/prefs.php?type=docker')
            .then((data) => data, () => JSON.stringify({ ok: false, prefs: {} }));
        folderReq.docker = [
            $.get('/plugins/folderview.plus/server/read.php?type=docker').promise(),
            $.get('/plugins/folderview.plus/server/read_order.php?type=docker').promise(),
            $.get('/plugins/folderview.plus/server/read_info.php?type=docker').promise(),
            $.get('/plugins/folderview.plus/server/read_unraid_order.php?type=docker').promise(),
            safeDockerPrefsReq
        ];
        return folderReq.docker;
    }
    const safeVmPrefsReq = $.get('/plugins/folderview.plus/server/prefs.php?type=vm')
        .then((data) => data, () => JSON.stringify({ ok: false, prefs: {} }));
    folderReq.vm = [
        $.get('/plugins/folderview.plus/server/read.php?type=vm').promise(),
        $.get('/plugins/folderview.plus/server/read_order.php?type=vm').promise(),
        $.get('/plugins/folderview.plus/server/read_info.php?type=vm').promise(),
        $.get('/plugins/folderview.plus/server/read_unraid_order.php?type=vm').promise(),
        safeVmPrefsReq
    ];
    return folderReq.vm;
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
            queueCreateFoldersRender();
            $('div.spinner.fixed').hide();
            loadedFolder = !loadedFolder
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
