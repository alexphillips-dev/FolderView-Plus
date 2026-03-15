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

/**
 * Handles the creation of all folders
 */
const createFolders = async () => {
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
        dropDownButton(id, false);
    }

    folderEvents.dispatchEvent(new CustomEvent('vm-post-folders-creation', {detail: {
        folders: folders,
        order: order,
        vmInfo: vmInfo
    }}));

    // Assing the folder done to the global object
    globalFolders = foldersDone;
    persistVmExpandedStateFromGlobal();
    renderRuntimeHealthBadge(globalFolders, folderTypePrefs);

    folderDebugMode  = false;
    } finally {
        hideVmRuntimeLoadingRow();
    }
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
    if (folderTypePrefs?.performanceMode === true && folder && typeof folder === 'object') {
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
    const fld = `<tr parent-id="${id}" class="sortable folder-id-${id} ${hoverClass} folder"><td class="vm-name folder-name"><div class="folder-name-sub"><i class="fa fa-arrows-v mover orange-text"></i><span class="outer folder-outer"><span id="${id}" onclick='addVMFolderContext("${id}")' class="hand folder-hand"><img src="${safeFolderIcon}" class="img folder-img" onerror='this.src="/plugins/dynamix.docker.manager/images/question.png"'></span><span class="inner folder-inner"><a class="folder-appname" href="#" onclick='editFolder("${id}")'>${safeFolderName}</a><a class="folder-appname-id">folder-${id}</a><br><i id="load-folder-${id}" class="fa fa-square stopped red-text folder-load-status"></i><span class="state folder-state"> ${$.i18n('stopped')}</span></span></span><button class="dropDown-${id} folder-dropdown" onclick='dropDownButton("${id}")'><i class="fa fa-chevron-down" aria-hidden="true"></i></button></div></td><td colspan="${colspan}"><div class="folder-storage"></div><div class="folder-preview"></div></td><td class="folder-autostart"><input class="autostart" type="checkbox" id="folder-${id}-auto" style="display:none"></td></tr><tr child-id="${id}" id="name-${id}" style="display:none"><td colspan="${totalCols}" style="margin:0;padding:0"></td></tr>`;

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

    const previewColor = normalizeStatusHexColor(folder.settings.preview_border_color, '#afa89e');
    const previewNode = $(`tr.folder-id-${id} div.folder-preview`).get(0);
    if (previewNode) {
        previewNode.style.setProperty('border', `1px solid ${previewColor}`, 'important');
    }

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
    const statusColors = typeof utils.getFolderStatusColors === 'function'
        ? utils.getFolderStatusColors(folder.settings)
        : localDefaultFolderStatusColors;
    const $folderIcon = $(`tr.folder-id-${id} i#load-folder-${id}`);
    const $folderState = $(`tr.folder-id-${id} span.folder-state`);
    $folderState.removeClass('fv-folder-state-started fv-folder-state-paused fv-folder-state-stopped');
    $folderState.css('color', '');
    $folderIcon.show().css('color', '');
    let folderStatusKind = 'stopped';
    if (started > 0) {
        folderStatusKind = 'running';
        $folderIcon.attr('class', 'fa fa-play started folder-load-status').css('color', statusColors.started);
        $folderState.text(`${started}/${total} ${$.i18n('started')}`).addClass('fv-folder-state-started').css('color', statusColors.started);
    } else if (paused > 0) {
        folderStatusKind = 'paused';
        $folderIcon.attr('class', 'fa fa-pause paused folder-load-status').css('color', statusColors.paused);
        $folderState.text(`${paused}/${total} ${$.i18n('paused')}`).addClass('fv-folder-state-paused').css('color', statusColors.paused);
    } else {
        folderStatusKind = 'stopped';
        $folderIcon.attr('class', 'fa fa-square stopped folder-load-status').css('color', statusColors.stopped);
        $folderState.text(`${stopped}/${total} ${$.i18n('stopped')}`).addClass('fv-folder-state-stopped').css('color', statusColors.stopped);
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
    if (persistState) {
        persistVmExpandedStateFromGlobal();
    }
    folderEvents.dispatchEvent(new CustomEvent('vm-post-folder-expansion', {detail: { id }}));
};

/**
 * Removie the folder
 * @param {string} id the id of the folder
 */
const rmFolder = (id) => {
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
    location.href = "/VMs/Folder?type=vm&id=" + id;
};

/**
 * 
 * @param {string} id The id of the folder
 * @param {string} action the desired action
 */
const actionFolder = async (id, action) => {
    const folder = globalFolders[id];
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
    const errorMessages = errors.map(e => e.text || JSON.stringify(e));

    if(errors.length > 0) {
        swal({
            title: $.i18n('exec-error'),
            text:errorMessages.join('<br>'),
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
const folderCustomAction = async (id, action) => {
    $('div.spinner.fixed').show('slow');
    const eventURL = '/plugins/dynamix.vm.manager/include/VMajax.php';
    const folder = globalFolders[id];
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
    $('div.spinner.fixed').hide('slow');
};

/**
 * Atach the menu when clicking the folder icon
 * @param {string} id the id of the folder
 */
const addVMFolderContext = (id) => {
    if (!globalFolders[id]) {
        return;
    }
    let opts = [];
    context.settings({
        right: false,
        above: false
    });

    if(globalFolders[id].settings.override_default_actions && globalFolders[id].actions && globalFolders[id].actions.length) {
        opts.push(
            ...globalFolders[id].actions.map((e, i) => {
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

    } else if(!globalFolders[id].settings.default_action) {
        opts.push({
            text:$.i18n('start'),
            icon:"fa-play",
            action:(e) => { e.preventDefault(); actionFolder(id, 'domain-start'); }
        });
    
        opts.push({
            text:$.i18n('stop'),
            icon:"fa-stop",
            action:(e) => { e.preventDefault(); actionFolder(id, 'domain-stop'); }
        });
    
        opts.push({
            text:$.i18n('pause'),
            icon:"fa-pause",
            action:(e) => { e.preventDefault(); actionFolder(id, 'domain-pause'); }
        });
    
        opts.push({
            text:$.i18n('resume'),
            icon:"fa-play-circle",
            action:(e) => { e.preventDefault(); actionFolder(id, 'domain-resume'); }
        });
    
        opts.push({
            text:$.i18n('restart'),
            icon:"fa-refresh",
            action:(e) => { e.preventDefault(); actionFolder(id, 'domain-restart'); }
        });
    
        opts.push({
            text:$.i18n('hibernate'),
            icon:"fa-bed",
            action:(e) => { e.preventDefault(); actionFolder(id, 'domain-pmsuspend'); }
        });
    
        opts.push({
            text:$.i18n('force-stop'),
            icon:"fa-bomb",
            action:(e) => { e.preventDefault(); actionFolder(id, 'domain-destroy'); }
        });
    
        opts.push({
            divider: true
        });
    }


    opts.push({
        text: $.i18n('edit'),
        icon: 'fa-wrench',
        action: (e) => { e.preventDefault(); editFolder(id); }
    });

    opts.push({
        text: $.i18n('remove'),
        icon: 'fa-trash',
        action: (e) => { e.preventDefault(); rmFolder(id); }
    });

    if(!globalFolders[id].settings.override_default_actions && globalFolders[id].actions && globalFolders[id].actions.length) {
        opts.push({
            divider: true
        });

        opts.push({
            text: $.i18n('custom-actions'),
            icon: 'fa-bars',
            subMenu: globalFolders[id].actions.map((e, i) => {
                return {
                    text: e.name,
                    icon: e.script_icon || "fa-bolt",
                    action: (e) => { e.preventDefault(); folderCustomAction(id, i); }
                }
            })
        });
    }

    folderEvents.dispatchEvent(new CustomEvent('vm-folder-context', {detail: { id, opts }}));

    context.attach('#' + id, opts);
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
let lastLiveRefreshStateSignature = '';

const queueLoadlistRefresh = () => {
    if (queuedLoadlistTimer) {
        return;
    }
    queuedLoadlistTimer = setTimeout(() => {
        queuedLoadlistTimer = null;
        loadlist();
    }, 90);
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
    const seconds = Math.max(10, Math.min(300, Number(normalized.liveRefreshSeconds) || 20));
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
    const appColumnWidth = typeof utils.normalizeAppColumnWidth === 'function'
        ? utils.normalizeAppColumnWidth(normalized.appColumnWidth)
        : (['compact', 'wide'].includes(String(normalized.appColumnWidth || '').toLowerCase()) ? String(normalized.appColumnWidth || '').toLowerCase() : 'standard');
    if (document.body && typeof document.body.setAttribute === 'function') {
        document.body.setAttribute('data-fvplus-vm-app-width', appColumnWidth);
    }
    $('body').toggleClass('fvplus-performance-mode', normalized.performanceMode === true);
    scheduleLiveRefresh(normalized);
};

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
            createFolders();
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
