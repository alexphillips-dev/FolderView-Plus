// @ts-check
const localDefaultFolderStatusColors = {
    started: '#ffffff',
    paused: '#b8860b',
    stopped: '#ff4d4d'
};
const DEFAULT_PREVIEW_BORDER_COLOR = '#afa89e';
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
const FOLDER_STATUS_COLOR_STYLE_PROPS = Object.freeze({
    started: '--fvplus-folder-status-started',
    paused: '--fvplus-folder-status-paused',
    stopped: '--fvplus-folder-status-stopped'
});
const getFolderStatusColorOverrides = (settings) => {
    const source = settings && typeof settings === 'object' ? settings : {};
    const parsedStarted = normalizeStatusHexColor(source.status_color_started, '');
    const parsedPaused = normalizeStatusHexColor(source.status_color_paused, '');
    const parsedStopped = normalizeStatusHexColor(source.status_color_stopped, '');
    return {
        started: parsedStarted && parsedStarted !== localDefaultFolderStatusColors.started ? parsedStarted : '',
        paused: parsedPaused && parsedPaused !== localDefaultFolderStatusColors.paused ? parsedPaused : '',
        stopped: parsedStopped && parsedStopped !== localDefaultFolderStatusColors.stopped ? parsedStopped : ''
    };
};
const applyFolderStatusColorOverrides = ($folderRow, settings) => {
    if (!$folderRow || !$folderRow.length || !$folderRow[0] || !$folderRow[0].style) {
        return;
    }
    const style = $folderRow[0].style;
    const overrides = getFolderStatusColorOverrides(settings);
    style.removeProperty(FOLDER_STATUS_COLOR_STYLE_PROPS.started);
    style.removeProperty(FOLDER_STATUS_COLOR_STYLE_PROPS.paused);
    style.removeProperty(FOLDER_STATUS_COLOR_STYLE_PROPS.stopped);
    if (overrides.started) {
        style.setProperty(FOLDER_STATUS_COLOR_STYLE_PROPS.started, overrides.started);
    }
    if (overrides.paused) {
        style.setProperty(FOLDER_STATUS_COLOR_STYLE_PROPS.paused, overrides.paused);
    }
    if (overrides.stopped) {
        style.setProperty(FOLDER_STATUS_COLOR_STYLE_PROPS.stopped, overrides.stopped);
    }
};
const isPreviewBorderEnabled = (settings) => {
    const source = settings && typeof settings === 'object' ? settings : {};
    if (Object.prototype.hasOwnProperty.call(source, 'preview_border')) {
        const raw = String(source.preview_border ?? '').trim().toLowerCase();
        const explicitOff = raw === '0' || raw === 'false' || raw === 'off' || raw === 'no';
        return !explicitOff;
    }
    return true;
};
const applyPreviewBorderStyle = (previewNode, settings) => {
    if (!previewNode) {
        return;
    }
    const source = settings && typeof settings === 'object' ? settings : {};
    if (previewNode.classList && typeof previewNode.classList.toggle === 'function') {
        previewNode.classList.toggle('fv-preview-border-off', !isPreviewBorderEnabled(source));
    }
    const previewColor = normalizeStatusHexColor(source.preview_border_color, DEFAULT_PREVIEW_BORDER_COLOR);
    previewNode.style.setProperty('border', isPreviewBorderEnabled(source) ? `1px solid ${previewColor}` : 'none', 'important');
};
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
        const incoming = settings && typeof settings === 'object' ? settings : {};
        return {
            started: normalizeStatusHexColor(incoming.status_color_started, localDefaultFolderStatusColors.started),
            paused: normalizeStatusHexColor(incoming.status_color_paused, localDefaultFolderStatusColors.paused),
            stopped: normalizeStatusHexColor(incoming.status_color_stopped, localDefaultFolderStatusColors.stopped)
        };
    }
};
const runtimeShared = window.FolderViewDockerRuntimeShared || {};
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
let vmRuntimeViewportBound = false;
let vmRuntimeThemeReflowBound = false;
let vmRuntimeThemeReflowObserver = null;
let vmRuntimeThemeReflowTimer = null;
let vmRuntimeWidthReflowTimer = null;
let vmRuntimeLastWidthReflowReason = 'init';
const VM_DEBUG_MODE = false;
const vmDebugLog = (...args) => {
    if (VM_DEBUG_MODE) {
        console.log(...args);
    }
};
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
let vmExpandedStateSyncTimer = null;
let vmExpandedStateSyncInFlight = false;
let vmExpandedStateSyncQueued = false;
let vmExpandedStateLastSyncedPayload = '';
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
const readVmServerExpandedStateMap = () => normalizeExpandedStateMap(folderTypePrefs?.expandedFolderState || {});
const writeVmServerExpandedStateMap = (map) => {
    const normalized = normalizeExpandedStateMap(map);
    folderTypePrefs = utils.normalizePrefs({
        ...(folderTypePrefs || {}),
        expandedFolderState: normalized
    });
};
const readVmExpandedStateMap = () => {
    try {
        const raw = window.localStorage && window.localStorage.getItem(VM_EXPANDED_STATE_KEY);
        if (!raw) {
            return {};
        }
        return normalizeExpandedStateMap(JSON.parse(raw));
    } catch (_error) {
        return {};
    }
};
const writeVmExpandedStateMap = (map) => {
    try {
        const payload = map && typeof map === 'object' ? map : {};
        if (window.localStorage) {
            window.localStorage.setItem(VM_EXPANDED_STATE_KEY, JSON.stringify(payload));
        }
    } catch (_error) {
        // Ignore storage failures so runtime rendering never breaks.
    }
};
const syncVmExpandedStateToServer = async () => {
    const request = window.FolderViewPlusRequest;
    if (!request || typeof request.postJson !== 'function') {
        return;
    }
    if (vmExpandedStateSyncInFlight) {
        vmExpandedStateSyncQueued = true;
        return;
    }

    const payloadMap = readVmServerExpandedStateMap();
    const payloadString = JSON.stringify(payloadMap);
    if (payloadString === vmExpandedStateLastSyncedPayload) {
        return;
    }

    vmExpandedStateSyncInFlight = true;
    try {
        const response = await request.postJson('/plugins/folderview.plus/server/prefs.php', {
            type: 'vm',
            prefs: JSON.stringify({
                expandedFolderState: payloadMap
            })
        }, {
            retries: 1,
            retryDelayMs: 260
        });
        const nextPrefs = utils.normalizePrefs(response?.prefs || {});
        writeVmServerExpandedStateMap(nextPrefs.expandedFolderState || payloadMap);
        vmExpandedStateLastSyncedPayload = JSON.stringify(readVmServerExpandedStateMap());
    } catch (_error) {
        // Best effort only. LocalStorage fallback still retains behavior.
    } finally {
        vmExpandedStateSyncInFlight = false;
        if (vmExpandedStateSyncQueued) {
            vmExpandedStateSyncQueued = false;
            scheduleVmExpandedStateSync();
        }
    }
};
const scheduleVmExpandedStateSync = () => {
    if (vmExpandedStateSyncTimer) {
        clearTimeout(vmExpandedStateSyncTimer);
    }
    vmExpandedStateSyncTimer = setTimeout(() => {
        vmExpandedStateSyncTimer = null;
        syncVmExpandedStateToServer();
    }, VM_EXPANDED_STATE_SYNC_DELAY_MS);
};
const buildVmExpandedStateMap = (folders, previousFolders = {}, serverMap = {}) => {
    const source = folders && typeof folders === 'object' ? folders : {};
    const previous = previousFolders && typeof previousFolders === 'object' ? previousFolders : {};
    const persistedServer = normalizeExpandedStateMap(serverMap);
    const persisted = readVmExpandedStateMap();
    const resolved = {};
    for (const [id, folder] of Object.entries(source)) {
        if (Object.prototype.hasOwnProperty.call(persistedServer, id)) {
            resolved[id] = persistedServer[id] === true;
            continue;
        }
        if (Object.prototype.hasOwnProperty.call(persisted, id)) {
            resolved[id] = persisted[id] === true;
            continue;
        }
        resolved[id] = (previous[id]?.status?.expanded === true) || folder?.settings?.expand_tab === true;
    }
    writeVmExpandedStateMap(resolved);
    writeVmServerExpandedStateMap(resolved);
    return resolved;
};
const persistVmExpandedStateMap = (map, syncServer = true) => {
    const normalized = normalizeExpandedStateMap(map);
    writeVmExpandedStateMap(normalized);
    writeVmServerExpandedStateMap(normalized);
    if (syncServer) {
        scheduleVmExpandedStateSync();
    }
};
const persistVmExpandedStateFromGlobal = (syncServer = true) => {
    const map = {};
    for (const [id, folder] of Object.entries(globalFolders || {})) {
        map[id] = folder?.status?.expanded === true;
    }
    vmRuntimeStateStore.set({
        expandedFolderIds: Object.entries(map).filter(([, expanded]) => expanded === true).map(([id]) => String(id || ''))
    });
    persistVmExpandedStateMap(map, syncServer);
};
const readVmExpandedStateFromDom = () => {
    const map = {};
    const seen = new Set();
    $('button.folder-dropdown').each((_, node) => {
        const className = String(node.className || '');
        const match = className.match(/\bdropDown-([A-Za-z0-9_-]+)\b/);
        if (!match || !match[1]) {
            return;
        }
        const id = String(match[1]);
        if (seen.has(id)) {
            return;
        }
        seen.add(id);
        map[id] = String($(node).attr('active') || '').toLowerCase() === 'true';
    });
    return map;
};
const persistVmExpandedStateFromDom = () => {
    const domState = readVmExpandedStateFromDom();
    if (!Object.keys(domState).length) {
        return;
    }
    const current = readVmExpandedStateMap();
    persistVmExpandedStateMap({ ...current, ...domState }, true);
};
const ensureVmExpandedStateLifecycleHooks = () => {
    if (window.__fvVmExpandedStateHooksBound) {
        return;
    }
    window.__fvVmExpandedStateHooksBound = true;
    window.addEventListener('pagehide', persistVmExpandedStateFromDom, { passive: true });
    window.addEventListener('beforeunload', persistVmExpandedStateFromDom, { passive: true });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            persistVmExpandedStateFromDom();
        }
    });
};
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
            window.localStorage.setItem(VM_LOCKED_STATE_KEY, JSON.stringify(normalizeLockedFolderIdList(ids)));
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
        const request = window.FolderViewPlusRequest;
        if (!request || typeof request.postJson !== 'function') {
            queueLoadlistRefresh();
            return;
        }
        const result = await runVmGuardedAction('toggle-folder-pin', async () => {
            const response = await request.postJson('/plugins/folderview.plus/server/prefs.php', {
                type: 'vm',
                prefs: JSON.stringify({ pinnedFolderIds: nextPinned })
            }, {
                retries: 1,
                retryDelayMs: 260
            });
            applyVmPinnedFolderIds(Array.isArray(response?.prefs?.pinnedFolderIds) ? response.prefs.pinnedFolderIds : nextPinned);
            queueLoadlistRefresh();
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
    try {
    ensureVmExpandedStateLifecycleHooks();
    persistVmExpandedStateFromDom();
    const previousFolders = (globalFolders && typeof globalFolders === 'object') ? globalFolders : {};
    const prom = await Promise.all(folderReq);
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
    vmExpandedStateLastSyncedPayload = JSON.stringify(readVmServerExpandedStateMap());
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
    const fld = `<tr parent-id="${id}" class="sortable folder-id-${id} ${hoverClass} ${lockedClass} ${pinnedClass} ${focusedClass} folder"><td class="vm-name folder-name"><div class="folder-name-sub"><i class="fa fa-arrows-v mover orange-text"></i><span class="outer folder-outer"><span id="${id}" onclick='addVMFolderContext("${id}")' class="hand folder-hand"><img src="${safeFolderIcon}" class="img folder-img" onerror='this.src="/plugins/dynamix.docker.manager/images/question.png"'></span><span class="inner folder-inner"><a class="folder-appname" href="#" onclick='editFolder("${id}")'>${safeFolderName}</a><a class="folder-appname-id">folder-${id}</a><br><i id="load-folder-${id}" class="fa fa-square stopped folder-load-status"></i><span class="state folder-state fv-folder-state-stopped"> ${$.i18n('stopped')}</span></span></span><button class="dropDown-${id} folder-dropdown" onclick='dropDownButton("${id}")'><i class="fa fa-chevron-down" aria-hidden="true"></i></button></div></td><td colspan="${colspan}"><div class="folder-storage"></div><div class="folder-preview"></div></td><td class="folder-autostart"><input class="autostart" type="checkbox" id="folder-${id}-auto" style="display:none"></td></tr><tr child-id="${id}" id="name-${id}" style="display:none"><td colspan="${totalCols}" style="margin:0;padding:0"></td></tr>`;

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

    const previewNode = $(`tr.folder-id-${id} div.folder-preview`).get(0);
    applyPreviewBorderStyle(previewNode, folder.settings);

    $(`tr.folder-id-${id} div.folder-preview`).addClass(`folder-preview-${folder.settings.preview}`);

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
    $(`tr.folder-id-${id} div.folder-preview > span`).wrap('<div class="folder-preview-wrapper"></div>');

    if(folder.settings.preview_vertical_bars) {
        const barsColor = folder.settings.preview_vertical_bars_color || folder.settings.preview_border_color;
        $(`tr.folder-id-${id} div.folder-preview > div`).not(':last').after(`<div class="folder-preview-divider" style="border-color: ${barsColor};"></div>`);
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
const editFolder = (id) => {
    if (!ensureVmFolderUnlocked(id, 'Edit folder')) {
        return;
    }
    location.href = "/VMs/Folder?type=vm&id=" + id;
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
                }

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
        text: 'Clone folder',
        icon: 'fa-clone',
        action: (evt) => {
            evt.preventDefault();
            cloneVmFolderFromMenu(id);
        }
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
        const label = row.querySelector('.folder-appname');
        if (!label) {
            return;
        }
        const clientWidth = Math.max(0, Math.ceil(label.clientWidth || 0));
        if (clientWidth < VM_RUNTIME_APP_OVERFLOW_CLIENT_WIDTH_MIN) {
            return;
        }
        const rawOverflow = Math.ceil((label.scrollWidth || 0) - clientWidth);
        const overflow = Math.min(rawOverflow, VM_RUNTIME_APP_OVERFLOW_NUDGE_MAX);
        if (overflow > maxOverflow) {
            maxOverflow = overflow;
        }
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

const bindVmRuntimeViewportWidthSync = () => {
    if (vmRuntimeViewportBound) {
        return;
    }
    vmRuntimeViewportBound = true;
    const reapply = () => {
        scheduleVmRuntimeWidthReflow('viewport-resize', 48);
    };
    window.addEventListener('resize', reapply, { passive: true });
    window.addEventListener('orientationchange', reapply, { passive: true });
};

const queueVmRuntimeThemeReflow = (reason = 'theme-change') => {
    const nextReason = String(reason || 'theme-change');
    if (vmRuntimeThemeReflowTimer !== null) {
        window.clearTimeout(vmRuntimeThemeReflowTimer);
    }
    vmRuntimeThemeReflowTimer = window.setTimeout(() => {
        vmRuntimeThemeReflowTimer = null;
        vmDebugLog(`theme-reflow:${nextReason}`);
        scheduleVmRuntimeWidthReflow(`theme-change:${nextReason}`, 40);
    }, 40);
};

const bindVmRuntimeThemeReflow = () => {
    if (vmRuntimeThemeReflowBound) {
        return;
    }
    vmRuntimeThemeReflowBound = true;
    const onThemeChange = () => queueVmRuntimeThemeReflow('observer');
    if (typeof MutationObserver === 'function') {
        vmRuntimeThemeReflowObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations || []) {
                if (mutation.type !== 'attributes') {
                    continue;
                }
                const attr = String(mutation.attributeName || '').toLowerCase();
                if (!attr || attr === 'class' || attr === 'style' || attr.includes('theme')) {
                    onThemeChange();
                    return;
                }
            }
        });
        if (document.documentElement) {
            vmRuntimeThemeReflowObserver.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['class', 'style', 'data-theme', 'theme', 'data-color-scheme', 'data-bs-theme']
            });
        }
        if (document.body) {
            vmRuntimeThemeReflowObserver.observe(document.body, {
                attributes: true,
                attributeFilter: ['class', 'style', 'data-theme', 'theme', 'data-color-scheme', 'data-bs-theme']
            });
        }
    }
    if (typeof window.matchMedia === 'function') {
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        if (media && typeof media.addEventListener === 'function') {
            media.addEventListener('change', () => queueVmRuntimeThemeReflow('prefers-color-scheme'));
        } else if (media && typeof media.addListener === 'function') {
            media.addListener(() => queueVmRuntimeThemeReflow('prefers-color-scheme'));
        }
    }
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
    const safePrefsReq = $.get('/plugins/folderview.plus/server/prefs.php?type=vm')
        .then((data) => data, () => JSON.stringify({ ok: false, prefs: {} }));
    return [
        // Get the folders
        $.get('/plugins/folderview.plus/server/read.php?type=vm').promise(),
        // Get the order as unraid sees it
        $.get('/plugins/folderview.plus/server/read_order.php?type=vm').promise(),
        // Get the info on VMs, needed for autostart and started
        $.get('/plugins/folderview.plus/server/read_info.php?type=vm').promise(),
        // Get the order that is shown in the webui
        $.get('/plugins/folderview.plus/server/read_unraid_order.php?type=vm').promise(),
        // Get sort and auto-assignment preferences
        safePrefsReq
    ];
}

// Prime requests for environments where loadlist isn't called first.
folderReq = buildVmFolderReq();

// Patching the original function to make sure the containers are rendered before insering the folder
window.loadlist_original = loadlist;
window.loadlist = (x) => {
    loadedFolder = false;
    folderReq = buildVmFolderReq();
    loadlist_original(x);
};

// Add the button for creating a folder
const createFolderBtn = () => { location.href = "/VMs/Folder?type=vm" };


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
