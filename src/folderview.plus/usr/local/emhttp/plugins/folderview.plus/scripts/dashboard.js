(function fvplusDashboardScope(window, $) {
if (!window || !$) {
    return;
}

const localDefaultFolderStatusColors = {
    started: '#ffffff',
    paused: '#b8860b',
    stopped: '#ff4d4d'
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
    }
};
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
const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const sanitizeImageSrc = (value, fallback = '/plugins/dynamix.docker.manager/images/question.png') => {
    const raw = String(value || '').trim();
    if (!raw || /^javascript:/i.test(raw)) {
        return fallback;
    }
    return escapeHtml(raw);
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

    const webUiUrl = String(ct?.info?.State?.WebUi || '').trim();
    if (webUiUrl) {
        const $web = $(
            '<a class="fv-dashboard-member-action fv-dashboard-member-webui" target="_blank" rel="noopener noreferrer" title="WebUI" aria-label="WebUI">' +
                '<i class="fa fa-globe" aria-hidden="true"></i>' +
            '</a>'
        );
        $web.attr('href', webUiUrl);
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
const DASHBOARD_LAYOUT_MODES = ['classic', 'fullwidth', 'accordion', 'inset'];
const DASHBOARD_LAYOUT_LABELS = Object.freeze({
    classic: 'Classic',
    fullwidth: 'Full Width',
    accordion: 'Accordion',
    inset: 'Inset'
});
const normalizeDashboardLayoutMode = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return DASHBOARD_LAYOUT_MODES.includes(normalized) ? normalized : 'classic';
};
const normalizeDashboardOverflowMode = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return ['default', 'expand_row', 'scroll'].includes(normalized) ? normalized : 'default';
};
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
const resolveDashboardQuickSwitchScopeKey = (type) => (type === 'vm' ? 'vm' : 'docker');
const resolveDashboardWidgetPanelForType = (type) => {
    const meta = dashboardTypeMeta(type);
    const $tbody = $(meta.tbodySelector).first();
    if (!$tbody.length) {
        return $();
    }
    let $panel = $tbody.closest('.panel');
    if ($panel.length) {
        return $panel.first();
    }
    $panel = $tbody.closest('.widget, .dashboard-panel, [class*="panel"], [class*="widget"]');
    if ($panel.length) {
        return $panel.first();
    }
    return $();
};
const resolveDashboardWidgetHeaderForType = (type) => {
    const $panel = resolveDashboardWidgetPanelForType(type);
    if ($panel.length) {
        let $header = $panel.children('.panel-heading, .widget-header, .heading, header').first();
        if (!$header.length) {
            $header = $panel.find('.panel-heading, .widget-header, .heading, header').first();
        }
        if ($header.length) {
            return $header;
        }
    }
    const meta = dashboardTypeMeta(type);
    const $tbody = $(meta.tbodySelector).first();
    if (!$tbody.length) {
        return $();
    }
    return $tbody.closest('table').prevAll('.panel-heading, .widget-header, .heading, header').first();
};
const resolveDashboardWidgetHeaderActionAnchorForType = (type) => {
    const resolvedType = resolveDashboardQuickSwitchScopeKey(type);
    const $header = resolveDashboardWidgetHeaderForType(resolvedType);
    const findAnchorInScope = ($scope) => {
        if (!$scope || !$scope.length) {
            return $();
        }
        const $gear = $scope.find('.fa-cog, .fa-gear, .icon-cog, .icon-gear, .icon-settings').first();
        if ($gear.length) {
            const $anchor = $gear.closest('a, button, span, i');
            return $anchor.length ? $anchor.first() : $gear.first();
        }
        const $candidates = $scope.find('a, button, [role="button"], span, i');
        for (let index = 0; index < $candidates.length; index++) {
            const $candidate = $candidates.eq(index);
            const attrs = [
                String($candidate.attr('title') || ''),
                String($candidate.attr('aria-label') || ''),
                String($candidate.attr('href') || ''),
                String($candidate.text() || '')
            ].join(' ').toLowerCase();
            if (attrs.includes('setting') || attrs.includes('config') || attrs.includes('gear')) {
                return $candidate;
            }
        }
        const $actionContainers = $scope.find('.panel-actions, .pull-right, .widget-actions, .actions, [class*="action"]').first();
        if ($actionContainers.length) {
            const $fallbackAnchor = $actionContainers.find('a, button, [role="button"], span, i').first();
            if ($fallbackAnchor.length) {
                return $fallbackAnchor;
            }
        }
        return $();
    };

    const $headerAnchor = findAnchorInScope($header);
    if ($headerAnchor.length) {
        return $headerAnchor;
    }

    let $globalAnchor = $();
    $('.fa-cog, .fa-gear, .icon-cog, .icon-gear, .icon-settings').each((_, node) => {
        const $node = $(node);
        const $scope = $node.closest('.panel-heading, .widget-header, .heading, header, .panel, .widget').first();
        const scopeText = String($scope.text() || '').toLowerCase();
        const matchesType = resolvedType === 'vm'
            ? (scopeText.includes('vm') || scopeText.includes('virtual'))
            : (scopeText.includes('docker') || scopeText.includes('container'));
        if (!matchesType) {
            return;
        }
        const $anchor = $node.closest('a, button, span, i');
        $globalAnchor = $anchor.length ? $anchor.first() : $node.first();
        return false;
    });
    if ($globalAnchor.length) {
        return $globalAnchor;
    }

    if ($header.length) {
        const $fallbackAnchor = $header.find('a, button, [role="button"], span').last();
        if ($fallbackAnchor.length) {
            return $fallbackAnchor.first();
        }
    }
    return $();
};
const resolveDashboardWidgetQuickSwitchFallbackMountForType = (type) => {
    const meta = dashboardTypeMeta(type);
    const $tbody = $(meta.tbodySelector).first();
    if (!$tbody.length) {
        return $();
    }
    const $table = $tbody.closest('table').first();
    if ($table.length) {
        return $table;
    }
    return $tbody;
};
const syncDashboardWidgetLayoutQuickSwitchValue = (type) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const currentLayout = normalizeDashboardPrefsForType(resolvedType).layout;
    const $switch = $(`.fv-dashboard-layout-quick[data-fv-dashboard-type="${resolvedType}"] .fv-dashboard-layout-quick-select`).first();
    if (!$switch.length) {
        return;
    }
    $switch.val(currentLayout);
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
const handleDashboardWidgetLayoutQuickSwitch = async (type, value) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const nextLayout = normalizeDashboardLayoutMode(value);
    const previousPrefs = utils.normalizePrefs(folderTypePrefs?.[resolvedType] || {});
    const previousDashboard = normalizeDashboardPrefsForType(resolvedType);
    if (previousDashboard.layout === nextLayout) {
        syncDashboardWidgetLayoutQuickSwitchValue(resolvedType);
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
    folderTypePrefs[resolvedType] = utils.normalizePrefs(nextPrefs);
    scheduleDashboardLayoutApplyForType(resolvedType);
    syncDashboardWidgetLayoutQuickSwitchValue(resolvedType);

    try {
        const response = await saveDashboardLayoutPrefForType(resolvedType, nextPrefs);
        if (dashboardLayoutPersistTokenByType[resolvedType] !== saveToken) {
            return;
        }
        if (!response || response.ok !== true) {
            throw new Error(response?.error || 'Failed to save dashboard preferences.');
        }
        folderTypePrefs[resolvedType] = utils.normalizePrefs(response.prefs || nextPrefs);
        scheduleDashboardLayoutApplyForType(resolvedType);
        syncDashboardWidgetLayoutQuickSwitchValue(resolvedType);
    } catch (_error) {
        if (dashboardLayoutPersistTokenByType[resolvedType] !== saveToken) {
            return;
        }
        folderTypePrefs[resolvedType] = previousPrefs;
        scheduleDashboardLayoutApplyForType(resolvedType);
        syncDashboardWidgetLayoutQuickSwitchValue(resolvedType);
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
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const $header = resolveDashboardWidgetHeaderForType(resolvedType);
    const $anchor = resolveDashboardWidgetHeaderActionAnchorForType(resolvedType);
    const $fallbackMount = resolveDashboardWidgetQuickSwitchFallbackMountForType(resolvedType);
    const widgetLabel = resolvedType === 'vm' ? 'VM' : 'Docker';
    const switchSelector = `.fv-dashboard-layout-quick[data-fv-dashboard-type="${resolvedType}"]`;
    let $switch = $(switchSelector).first();
    if (!$switch.length) {
        const optionsHtml = DASHBOARD_LAYOUT_MODES
            .map((mode) => `<option value="${mode}">${escapeHtml(DASHBOARD_LAYOUT_LABELS[mode] || mode)}</option>`)
            .join('');
        $switch = $(
            `<label class="fv-dashboard-layout-quick" data-fv-dashboard-type="${resolvedType}" title="${widgetLabel} folder layout view">` +
                '<span class="fv-dashboard-layout-quick-glyph" aria-hidden="true"><i class="fa fa-columns"></i></span>' +
                '<span class="fv-dashboard-layout-quick-label">View</span>' +
                `<select class="fv-dashboard-layout-quick-select" aria-label="${widgetLabel} folder layout view">${optionsHtml}</select>` +
            '</label>'
        );
        $switch.find('.fv-dashboard-layout-quick-select').on('change.fvplusdashboardquick', (event) => {
            void handleDashboardWidgetLayoutQuickSwitch(resolvedType, $(event.currentTarget).val());
        });
    }
    if ($anchor.length) {
        $anchor.before($switch);
    } else if ($header.length) {
        $header.append($switch);
    } else if ($fallbackMount.length) {
        const fallbackHostSelector = `.fv-dashboard-layout-quick-host[data-fv-dashboard-type="${resolvedType}"]`;
        let $host = $(fallbackHostSelector).first();
        if (!$host.length) {
            $host = $(`<div class="fv-dashboard-layout-quick-host" data-fv-dashboard-type="${resolvedType}"></div>`);
            $fallbackMount.before($host);
        }
        $host.empty().append($switch);
    } else {
        if (dashboardQuickSwitchRetryTimerByType[resolvedType]) {
            return;
        }
        dashboardQuickSwitchRetryTimerByType[resolvedType] = window.setTimeout(() => {
            dashboardQuickSwitchRetryTimerByType[resolvedType] = 0;
            ensureDashboardWidgetLayoutQuickSwitchForType(resolvedType);
        }, 320);
        return;
    }
    syncDashboardWidgetLayoutQuickSwitchValue(resolvedType);
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
            window.localStorage.setItem(storageKey, JSON.stringify(normalizeExpandedStateMap(map)));
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
    const meta = dashboardTypeMeta(type);
    const $tbody = $(meta.tbodySelector);
    if (!$tbody.length) {
        return;
    }
    const dashboardPrefs = normalizeDashboardPrefsForType(meta.type);
    const layout = normalizeDashboardLayoutMode(dashboardPrefs.layout);
    const nonClassicLayout = layout !== 'classic';
    $tbody.attr('data-fv-dashboard-layout', layout);
    $tbody.removeClass('fv-dashboard-layout-classic fv-dashboard-layout-fullwidth fv-dashboard-layout-accordion fv-dashboard-layout-inset');
    $tbody.addClass(`fv-dashboard-layout-${layout}`);
    $tbody.toggleClass('fv-dashboard-show-expand-toggle', nonClassicLayout && dashboardPrefs.expandToggle === true);
    $tbody.toggleClass('fv-dashboard-greyscale-enabled', nonClassicLayout && dashboardPrefs.greyscale === true);
    $tbody.toggleClass('fv-dashboard-hide-folder-label', nonClassicLayout && dashboardPrefs.folderLabel === false);
    ensureDashboardWidgetLayoutQuickSwitchForType(meta.type);
    $tbody.find('.folder-showcase-outer').each((_, node) => {
        const $card = $(node);
        const isExpanded = $card.attr('expanded') === 'true';
        $card.toggleClass('fv-dashboard-card-expanded', isExpanded);
        $card.toggleClass('fv-dashboard-card-collapsed', !isExpanded);
        updateExpandToggleIcon($card, isExpanded);
    });
};
const scheduleDashboardLayoutApplyForType = (type) => {
    const meta = dashboardTypeMeta(type);
    const resolvedType = meta.type;
    dashboardLayoutApplyTokenByType[resolvedType] = (dashboardLayoutApplyTokenByType[resolvedType] || 0) + 1;
    const token = dashboardLayoutApplyTokenByType[resolvedType];
    if (dashboardLayoutRafByType[resolvedType]) {
        return;
    }
    const runApply = () => {
        dashboardLayoutRafByType[resolvedType] = 0;
        if (token !== dashboardLayoutApplyTokenByType[resolvedType]) {
            scheduleDashboardLayoutApplyForType(resolvedType);
            return;
        }
        applyDashboardLayoutStateForType(resolvedType);
    };
    if (typeof window.requestAnimationFrame === 'function') {
        dashboardLayoutRafByType[resolvedType] = window.requestAnimationFrame(runApply);
        return;
    }
    dashboardLayoutRafByType[resolvedType] = window.setTimeout(runApply, 16);
};

const getPrefsOrderedFolderMap = (folders, prefs) => {
    const source = folders && typeof folders === 'object' ? folders : {};
    if (typeof utils.orderFoldersByPrefs === 'function') {
        return utils.orderFoldersByPrefs(source, prefs || {});
    }
    return source;
};

const sortFolderIdsByPrefs = (ids, folders, prefs) => {
    const list = Array.isArray(ids) ? ids.map((id) => String(id || '')) : [];
    if (!list.length) {
        return [];
    }
    const source = folders && typeof folders === 'object' ? folders : {};
    const scoped = {};
    for (const id of list) {
        if (Object.prototype.hasOwnProperty.call(source, id)) {
            scoped[id] = source[id];
        }
    }
    const ordered = Object.keys(getPrefsOrderedFolderMap(scoped, prefs));
    if (ordered.length) {
        return ordered;
    }
    return list.filter((id) => Object.prototype.hasOwnProperty.call(scoped, id));
};

const normalizeFolderParentId = (value) => String(value || '').trim();
const filterDashboardToRootFolders = (folders) => {
    const source = folders && typeof folders === 'object' ? folders : {};
    const ids = new Set(Object.keys(source));
    const rootOnly = {};
    for (const [id, folder] of Object.entries(source)) {
        const parentId = normalizeFolderParentId(folder?.parentId || folder?.parent_id || '');
        const isRoot = !parentId || parentId === id || !ids.has(parentId);
        if (isRoot) {
            rootOnly[id] = folder;
        }
    }
    if (!Object.keys(rootOnly).length && Object.keys(source).length) return source;
    return rootOnly;
};

const buildFolderChildrenIndex = (folders) => {
    const source = folders && typeof folders === 'object' ? folders : {};
    const ids = Object.keys(source);
    const idSet = new Set(ids);
    const childrenByParent = {};
    const rootIds = [];
    for (const id of ids) {
        childrenByParent[id] = [];
    }
    for (const id of ids) {
        const folder = source[id] || {};
        const rawParent = normalizeFolderParentId(folder?.parentId || folder?.parent_id || '');
        const parentId = rawParent && rawParent !== id && idSet.has(rawParent) ? rawParent : '';
        if (parentId) {
            childrenByParent[parentId].push(id);
        } else {
            rootIds.push(id);
        }
    }
    return { rootIds, childrenByParent };
};

const buildFolderDescendantsByRoot = (folders) => {
    const source = folders && typeof folders === 'object' ? folders : {};
    const { rootIds, childrenByParent } = buildFolderChildrenIndex(source);
    const descendantsByRoot = {};
    const visit = (id, bucket, trail) => {
        if (!id || trail.has(id)) {
            return;
        }
        trail.add(id);
        bucket.push(id);
        const children = childrenByParent[id] || [];
        for (const childId of children) {
            visit(childId, bucket, trail);
        }
        trail.delete(id);
    };
    for (const rootId of rootIds) {
        const bucket = [];
        visit(rootId, bucket, new Set());
        descendantsByRoot[rootId] = bucket;
    }
    return descendantsByRoot;
};

const mergeUniqueNames = (target, source, seen) => {
    if (!Array.isArray(source)) return;
    for (const rawName of source) {
        const name = String(rawName || '').trim();
        if (!name || seen.has(name)) continue;
        seen.add(name);
        target.push(name);
    }
};

const aggregateRootMatchCache = (fullFolders, rootFolders, fullCache) => {
    const descendantsByRoot = buildFolderDescendantsByRoot(fullFolders);
    const output = {};
    for (const rootId of Object.keys(rootFolders || {})) {
        const subtreeIds = descendantsByRoot[rootId]?.length ? descendantsByRoot[rootId] : [rootId];
        const explicit = [];
        const regex = [];
        const label = [];
        const rules = [];
        const explicitSeen = new Set();
        const regexSeen = new Set();
        const labelSeen = new Set();
        const rulesSeen = new Set();
        for (const folderId of subtreeIds) {
            const entry = fullCache?.[folderId] || {};
            mergeUniqueNames(explicit, entry.explicit, explicitSeen);
            mergeUniqueNames(regex, entry.regex, regexSeen);
            mergeUniqueNames(label, entry.label, labelSeen);
            mergeUniqueNames(rules, entry.rules, rulesSeen);
        }
        output[rootId] = { explicit, regex, label, rules };
    }
    return output;
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

const normalizeDockerStateToken = (entry, fromStateMode = false) => {
    if (!entry || typeof entry !== 'object') {
        return 's:0::';
    }
    if (fromStateMode) {
        const running = entry.running === true;
        const paused = entry.paused === true;
        const status = running ? (paused ? 'p' : 'r') : 's';
        const autostart = entry.autostart === true ? '1' : '0';
        const manager = String(entry.manager || '').trim();
        const label = String(entry.folderLabel || '').trim();
        return `${status}:${autostart}:${manager}:${label}`;
    }
    const info = entry.info && typeof entry.info === 'object' ? entry.info : {};
    const state = info.State && typeof info.State === 'object' ? info.State : {};
    const labels = entry.Labels && typeof entry.Labels === 'object' ? entry.Labels : {};
    const running = state.Running === true;
    const paused = state.Paused === true;
    const status = running ? (paused ? 'p' : 'r') : 's';
    const manager = String(state.manager || '').trim();
    const autostart = !(state.Autostart === false) ? '1' : '0';
    const label = getFolderLabelValue(labels);
    return `${status}:${autostart}:${manager}:${label}`;
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

const normalizeVmStateToken = (entry, fromStateMode = false) => {
    if (!entry || typeof entry !== 'object') {
        return 'stopped:0';
    }
    const state = String(entry.state || '').toLowerCase() || 'stopped';
    const autostart = entry.autostart ? '1' : '0';
    return `${state}:${autostart}`;
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

const buildDashboardDockerFolderMatchCache = (orderSnapshot, containersInfo, folders, prefs) => {
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

const buildDashboardVmFolderMatchCache = (orderSnapshot, vmInfo, folders, prefs) => {
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
const createFolders = async () => {
    // ########################################
    // ##########       DOCKER       ##########
    // ########################################

    // if docker is enabled
    if($('tbody#docker_view').length > 0) {
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
            prefsResponse = prom[4] ? JSON.parse(prom[4]) : {};
        } catch (error) {
            prefsResponse = {};
        }
        folderTypePrefs.docker = utils.normalizePrefs(prefsResponse?.prefs || {});
        const dockerRootFolders = filterDashboardToRootFolders(allDockerFolders);
        folders = dockerRootFolders;
        unraidOrder = reorderFolderSlotsInBaseOrder(unraidOrder, folders, folderTypePrefs.docker);
        applyDashboardRuntimePrefs();
        lastDashboardStateSignatures.docker = buildDockerStateSignature(containersInfo, false);
    
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
        } finally {
            hideDashboardRuntimeLoadingRow('docker');
        }
    }


    // ########################################
    // ##########         VMS        ##########
    // ########################################

    // if vm is enabled
    if($('tbody#vm_view').length > 0) {
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
            prefsResponse = prom[4] ? JSON.parse(prom[4]) : {};
        } catch (error) {
            prefsResponse = {};
        }
        folderTypePrefs.vm = utils.normalizePrefs(prefsResponse?.prefs || {});
        const vmRootFolders = filterDashboardToRootFolders(allVmFolders);
        folders = vmRootFolders;
        unraidOrder = reorderFolderSlotsInBaseOrder(unraidOrder, folders, folderTypePrefs.vm);
        applyDashboardRuntimePrefs();
        lastDashboardStateSignatures.vm = buildVmStateSignature(vmInfo, false);
    
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
const editDockerFolder = (id) => {
    location.href = location.pathname + "/Folder?type=docker&id=" + id;
};

/**
 * Redirect to the page to edit the folder
 * @param {string} id the id of the folder
 */
const editVMFolder = (id) => {
    location.href = location.pathname + "/Folder?type=vm&id=" + id;
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
                const popup = window.open(globalFolders.docker[id].settings.folder_webui_url, '_blank', 'noopener,noreferrer');
                if (popup) {
                    popup.opener = null;
                }
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
let dashboardLayoutRafByType = {
    docker: 0,
    vm: 0
};
let dashboardLayoutApplyTokenByType = {
    docker: 0,
    vm: 0
};
let dashboardLayoutPersistTokenByType = {
    docker: 0,
    vm: 0
};
let dashboardQuickSwitchRetryTimerByType = {
    docker: 0,
    vm: 0
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

// Patching the original function to make sure the containers are rendered before insering the folder
window.loadlist_original = loadlist;
window.loadlist = (x) => {
    loadedFolder = false;
    if($('tbody#docker_view').length > 0) { 
        const safeDockerPrefsReq = $.get('/plugins/folderview.plus/server/prefs.php?type=docker')
            .then((data) => data, () => JSON.stringify({ ok: false, prefs: {} }));
        folderReq.docker = [
            // Get the folders
            $.get('/plugins/folderview.plus/server/read.php?type=docker').promise(),
            // Get the order as unraid sees it
            $.get('/plugins/folderview.plus/server/read_order.php?type=docker').promise(),
            // Get the info on containers, needed for autostart, update and started
            $.get('/plugins/folderview.plus/server/read_info.php?type=docker').promise(),
            // Get the order that is shown in the webui
            $.get('/plugins/folderview.plus/server/read_unraid_order.php?type=docker').promise(),
            // Get sort and auto-assignment preferences
            safeDockerPrefsReq
        ];
    }

    if($('tbody#vm_view').length > 0) {
        const safeVmPrefsReq = $.get('/plugins/folderview.plus/server/prefs.php?type=vm')
            .then((data) => data, () => JSON.stringify({ ok: false, prefs: {} }));
        folderReq.vm = [
            // Get the folders
            $.get('/plugins/folderview.plus/server/read.php?type=vm').promise(),
            // Get the order as unraid sees it
            $.get('/plugins/folderview.plus/server/read_order.php?type=vm').promise(),
            // Get the info on VMs, needed for autostart and started
            $.get('/plugins/folderview.plus/server/read_info.php?type=vm').promise(),
            // Get the order that is shown in the webui
            $.get('/plugins/folderview.plus/server/read_unraid_order.php?type=vm').promise(),
            // Get sort and auto-assignment preferences
            safeVmPrefsReq
        ];
    }
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
