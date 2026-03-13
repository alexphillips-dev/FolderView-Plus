const FOLDER_VIEW_DEBUG_MODE = false;
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

const buildDockerTooltipContent = (ct) => $(`
    <div class="preview-outbox preview-outbox-${ct.shortId}">
        <div class="first-row">
            <div class="preview-name">
                <div class="preview-img"><img src="${ct.Labels['net.unraid.docker.icon'] || ''}" class="img folder-img" onerror='this.src="/plugins/dynamix.docker.manager/images/question.png"'></div>
                <div class="preview-actual-name">
                    <span class="blue-text appname">${ct.info.Name}</span><br>
                    <i class="fa fa-${ct.info.State.Running ? (ct.info.State.Paused ? 'pause' : 'play') : 'square'} ${ct.info.State.Running ? (ct.info.State.Paused ? 'paused' : 'started') : 'stopped'} ${ct.info.State.Running ? (ct.info.State.Paused ? 'orange-text' : 'green-text') : 'red-text'}"></i>
                    <span class="state"> ${ct.info.State.Running ? (ct.info.State.Paused ? $.i18n('paused') : $.i18n('started')) : $.i18n('stopped')}</span>
                </div>
            </div>
            <table class="preview-status">
                <thead class="status-header"><tr><th class="status-header-version">${$.i18n('version')}</th><th class="status-header-stats">CPU/MEM</th><th class="status-header-autostart">${$.i18n('autostart')}</th></tr></thead>
                <tbody><tr>
                    <td><div class="status-version">${ct.info.State.manager === 'composeman' ? `<span class="folder-update-text"><i class="fa fa-docker fa-fw"></i> ${$.i18n('compose')}</span>` : ct.info.State.manager !== 'dockerman' ? `<span class="folder-update-text"><i class="fa fa-docker fa-fw"></i> ${$.i18n('third-party')}</span>` : ct.info.State.Updated !== false ? `<span class="green-text folder-update-text"><i class="fa fa-check fa-fw"></i>${$.i18n('up-to-date')}</span><br><a class="exec" onclick="hideAllTips(); updateContainer('${ct.info.Name}');"><span style="white-space:nowrap;"><i class="fa fa-cloud-download fa-fw"></i>${$.i18n('force-update')}</span></a>` : `<span class="orange-text folder-update-text" style="white-space:nowrap;"><i class="fa fa-flash fa-fw"></i>${$.i18n('update-ready')}</span><br><a class="exec" onclick="hideAllTips(); updateContainer('${ct.info.Name}');"><span style="white-space:nowrap;"><i class="fa fa-cloud-download fa-fw"></i>${$.i18n('apply-update')}</span></a>`}<br><i class="fa fa-info-circle fa-fw"></i> ${ct.info.Config.Image.split(':').pop()}</div></td>
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
                            ${(ct.info.State.Running && !ct.info.State.Paused) ? 
                                `${ct.info.State.WebUi ? `<li><a href="${ct.info.State.WebUi}" target="_blank" rel="noopener noreferrer"><i class="fa fa-globe" aria-hidden="true"></i> ${$.i18n('webui')}</a></li>` : ''}
                                 ${ct.info.State.TSWebUi ? `<li><a href="${ct.info.State.TSWebUi}" target="_blank" rel="noopener noreferrer"><i class="fa fa-shield" aria-hidden="true"></i> ${$.i18n('tailscale-webui')}</a></li>` : ''}
                                 <li><a onclick="event.preventDefault(); openTerminal('docker', '${ct.info.Name}', '${ct.info.Shell}');"><i class="fa fa-terminal" aria-hidden="true"></i> ${$.i18n('console')}</a></li>`
                            : ''}
                            ${!ct.info.State.Running ? `<li><a onclick="event.preventDefault(); eventControl({action:'start', container:'${ct.shortId}'}, 'loadlist');"><i class="fa fa-play" aria-hidden="true"></i> ${$.i18n('start')}</a></li>` : 
                                `${ct.info.State.Paused ? `<li><a onclick="event.preventDefault(); eventControl({action:'resume', container:'${ct.shortId}'}, 'loadlist');"><i class="fa fa-play" aria-hidden="true"></i> ${$.i18n('resume')}</a></li>` : 
                                    `<li><a onclick="event.preventDefault(); eventControl({action:'stop', container:'${ct.shortId}'}, 'loadlist');"><i class="fa fa-stop" aria-hidden="true"></i> ${$.i18n('stop')}</a></li>
                                     <li><a onclick="event.preventDefault(); eventControl({action:'pause', container:'${ct.shortId}'}, 'loadlist');"><i class="fa fa-pause" aria-hidden="true"></i> ${$.i18n('pause')}</a></li>`}
                            <li><a onclick="event.preventDefault(); eventControl({action:'restart', container:'${ct.shortId}'}, 'loadlist');"><i class="fa fa-refresh" aria-hidden="true"></i> ${$.i18n('restart')}</a></li>`}
                            <li><a onclick="event.preventDefault(); openTerminal('docker', '${ct.info.Name}', '.log');"><i class="fa fa-navicon" aria-hidden="true"></i> ${$.i18n('logs')}</a></li>
                            ${ct.info.template ? `<li><a onclick="event.preventDefault(); editContainer('${ct.info.Name}', '${ct.info.template.path}');"><i class="fa fa-wrench" aria-hidden="true"></i> ${$.i18n('edit')}</a></li>` : ''}
                            <li><a onclick="event.preventDefault(); rmContainer('${ct.info.Name}', '${ct.shortImageId}', '${ct.shortId}');"><i class="fa fa-trash" aria-hidden="true"></i> ${$.i18n('remove')}</a></li>
                        </ul>
                    </div>
                    <div class="action-right">
                        <ul class="fa-ul">
                            ${ct.info.ReadMe ? `<li><a href="${ct.info.ReadMe}" target="_blank" rel="noopener noreferrer"><i class="fa fa-book" aria-hidden="true"></i> ${$.i18n('read-me-first')}</a></li>` : ''}
                            ${ct.info.Project ? `<li><a href="${ct.info.Project}" target="_blank" rel="noopener noreferrer"><i class="fa fa-life-ring" aria-hidden="true"></i> ${$.i18n('project-page')}</a></li>` : ''}
                            ${ct.info.Support ? `<li><a href="${ct.info.Support}" target="_blank" rel="noopener noreferrer"><i class="fa fa-question" aria-hidden="true"></i> ${$.i18n('support')}</a></li>` : ''}
                            ${ct.info.registry ? `<li><a href="${ct.info.registry}" target="_blank" rel="noopener noreferrer"><i class="fa fa-info-circle" aria-hidden="true"></i> ${$.i18n('more-info')}</a></li>` : ''}
                            ${ct.info.DonateLink ? `<li><a href="${ct.info.DonateLink}" target="_blank" rel="noopener noreferrer"><i class="fa fa-usd" aria-hidden="true"></i> ${$.i18n('donate')}</a></li>` : ''}
                        </ul>
                    </div>
                </div>
                <div class="info-ct">
                    <span class="container-id">${$.i18n('container-id')}: ${ct.shortId}</span><br>
                    <span class="repo">${$.i18n('by')}: <a target="_blank" rel="noopener noreferrer" ${ct.info.registry ? `href="${ct.info.registry}"` : ''} >${ct.info.Config.Image.split(':').shift()}</a></span>
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
                <div class="info-ports" id="info-ports-${ct.shortId}" style="display: none;">${ct.info.Ports?.length > 10 ? (`<span class="info-ports-more" style="display: none;">${ct.info.Ports?.map(e=>`${e.PrivateIP ? e.PrivateIP + ':' : ''}${e.PrivatePort}/${e.Type.toUpperCase()} <i class="fa fa-arrows-h"></i> ${e.PublicIP ? e.PublicIP + ':' : ''}${e.PublicPort}`).join('<br>') || ''}<br><a onclick="event.preventDefault(); $(this).parent().css('display', 'none').siblings('.info-ports-less').css('display', 'inline')">${$.i18n('compress')}</a></span><span class="info-ports-less">${ct.info.Ports?.slice(0,10).map(e=>`${e.PrivateIP ? e.PrivateIP + ':' : ''}${e.PrivatePort}/${e.Type.toUpperCase()} <i class="fa fa-arrows-h"></i> ${e.PublicIP ? e.PublicIP + ':' : ''}${e.PublicPort}`).join('<br>') || ''}<br><a onclick="event.preventDefault(); $(this).parent().css('display', 'none').siblings('.info-ports-more').css('display', 'inline')">${$.i18n('expand')}</a></span>`) : (`<span class="info-ports-mono">${ct.info.Ports?.map(e=>`${e.PrivateIP ? e.PrivateIP + ':' : ''}${e.PrivatePort}/${e.Type.toUpperCase()} <i class="fa fa-arrows-h"></i> ${e.PublicIP ? e.PublicIP + ':' : ''}${e.PublicPort}`).join('<br>') || ''}</span>`)}</div>
                <div class="info-volumes" id="info-volumes-${ct.shortId}" style="display: none;">${ct.Mounts?.filter(e => e.Type==='bind').length > 10 ? (`<span class="info-volumes-more" style="display: none;">${ct.Mounts?.filter(e => e.Type==='bind').map(e=>`${e.Destination} <i class="fa fa-arrows-h"></i> ${e.Source}`).join('<br>') || ''}<br><a onclick="event.preventDefault(); $(this).parent().css('display', 'none').siblings('.info-volumes-less').css('display', 'inline')">${$.i18n('compress')}</a></span><span class="info-volumes-less">${ct.Mounts?.filter(e => e.Type==='bind').slice(0,10).map(e=>`${e.Destination} <i class="fa fa-arrows-h"></i> ${e.Source}`).join('<br>') || ''}<br><a onclick="event.preventDefault(); $(this).parent().css('display', 'none').siblings('.info-volumes-more').css('display', 'inline')">${$.i18n('expand')}</a></span>`) : (`<span class="info-volumes-mono">${ct.Mounts?.filter(e => e.Type==='bind').map(e=>`${e.Destination} <i class="fa fa-arrows-h"></i> ${e.Source}`).join('<br>') || ''}</span>`)}</div>
            </div>
        </div>
    </div>
`);

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

const buildFolderHierarchy = (folders) => {
    const source = folders && typeof folders === 'object' ? folders : {};
    const ids = Object.keys(source);
    const idSet = new Set(ids);
    const parentById = {};
    const childrenById = {};
    ids.forEach((id) => {
        childrenById[id] = [];
    });
    for (const id of ids) {
        const rawParent = normalizeFolderParentId(source[id]?.parentId || source[id]?.parent_id || '');
        const parentId = (rawParent && rawParent !== id && idSet.has(rawParent)) ? rawParent : '';
        parentById[id] = parentId;
        if (parentId) {
            childrenById[parentId].push(id);
        }
    }
    return { ids, parentById, childrenById };
};

const getFolderChildren = (folderId) => {
    const map = dockerFolderHierarchy?.childrenById || {};
    return Array.isArray(map[folderId]) ? map[folderId] : [];
};

const getFolderDescendants = (folderId) => {
    const result = [];
    const queue = [...getFolderChildren(folderId)];
    const seen = new Set();
    while (queue.length) {
        const current = queue.shift();
        if (!current || seen.has(current)) {
            continue;
        }
        seen.add(current);
        result.push(current);
        queue.push(...getFolderChildren(current));
    }
    return result;
};

const folderHasChildren = (folderId) => getFolderChildren(folderId).length > 0;

const getFolderRuntimeContainers = (folder) => {
    if (!folder || typeof folder !== 'object') {
        return {};
    }
    const runtime = folder.runtimeContainers;
    if (runtime && typeof runtime === 'object' && Object.keys(runtime).length > 0) {
        return runtime;
    }
    const containers = folder.containers;
    return (containers && typeof containers === 'object') ? containers : {};
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
const dockerDebug = typeof dockerModules.createDebugLogger === 'function'
    ? dockerModules.createDebugLogger(FOLDER_VIEW_DEBUG_MODE)
    : {
        log: (...args) => { if (FOLDER_VIEW_DEBUG_MODE) console.log(...args); },
        warn: (...args) => { if (FOLDER_VIEW_DEBUG_MODE) console.warn(...args); },
        error: (...args) => { if (FOLDER_VIEW_DEBUG_MODE) console.error(...args); }
    };
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
const readDockerExpandedStateMap = () => {
    try {
        const raw = window.localStorage && window.localStorage.getItem(DOCKER_EXPANDED_STATE_KEY);
        if (!raw) {
            return {};
        }
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return {};
        }
        const next = {};
        for (const [id, expanded] of Object.entries(parsed)) {
            next[String(id || '')] = expanded === true;
        }
        return next;
    } catch (_error) {
        return {};
    }
};
const writeDockerExpandedStateMap = (map) => {
    try {
        const payload = map && typeof map === 'object' ? map : {};
        if (window.localStorage) {
            window.localStorage.setItem(DOCKER_EXPANDED_STATE_KEY, JSON.stringify(payload));
        }
    } catch (_error) {
        // Ignore storage failures so runtime rendering never breaks.
    }
};
const buildDockerExpandedStateMap = (folders, previousFolders = {}) => {
    const source = folders && typeof folders === 'object' ? folders : {};
    const previous = previousFolders && typeof previousFolders === 'object' ? previousFolders : {};
    const persisted = readDockerExpandedStateMap();
    const resolved = {};
    for (const [id, folder] of Object.entries(source)) {
        if (Object.prototype.hasOwnProperty.call(persisted, id)) {
            resolved[id] = persisted[id] === true;
            continue;
        }
        resolved[id] = (previous[id]?.status?.expanded === true) || folder?.settings?.expand_tab === true;
    }
    writeDockerExpandedStateMap(resolved);
    return resolved;
};
const persistDockerExpandedStateFromGlobal = () => {
    const map = {};
    for (const [id, folder] of Object.entries(globalFolders || {})) {
        map[id] = folder?.status?.expanded === true;
    }
    writeDockerExpandedStateMap(map);
};
const readDockerExpandedStateFromDom = () => {
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
const persistDockerExpandedStateFromDom = () => {
    const domState = readDockerExpandedStateFromDom();
    if (!Object.keys(domState).length) {
        return;
    }
    const current = readDockerExpandedStateMap();
    writeDockerExpandedStateMap({ ...current, ...domState });
};
const ensureDockerExpandedStateLifecycleHooks = () => {
    if (window.__fvDockerExpandedStateHooksBound) {
        return;
    }
    window.__fvDockerExpandedStateHooksBound = true;
    window.addEventListener('pagehide', persistDockerExpandedStateFromDom, { passive: true });
    window.addEventListener('beforeunload', persistDockerExpandedStateFromDom, { passive: true });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            persistDockerExpandedStateFromDom();
        }
    });
};
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
    const tbody = $('tbody#docker_view');
    if (!tbody.length || tbody.find('tr.fv-runtime-loading-row').length) {
        return;
    }
    tbody.prepend('<tr class="fv-runtime-loading-row"><td colspan="18"><i class="fa fa-circle-o-notch fa-spin"></i> Loading Docker folders...</td></tr>');
};

const hideDockerRuntimeLoadingRow = () => {
    $('tbody#docker_view tr.fv-runtime-loading-row').remove();
};

/**
 * Handles the creation of all folders
 */
const createFolders = async () => {
    dockerPerf.begin('createFolders.total');
    try {
    ensureDockerExpandedStateLifecycleHooks();
    persistDockerExpandedStateFromDom();
    showDockerRuntimeLoadingRow();
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] createFolders: Entry');
    const previousFolders = (globalFolders && typeof globalFolders === 'object') ? globalFolders : {};
    dockerPerf.begin('createFolders.requests');
    const prom = await Promise.all(folderReq);
    dockerPerf.end('createFolders.requests', { requestCount: Array.isArray(folderReq) ? folderReq.length : 0 });
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] createFolders: Promises resolved', prom);

    // Parse the results
    let folders = JSON.parse(prom[0]);
    let unraidOrder = Object.values(JSON.parse(prom[1]));
    const containersInfo = JSON.parse(prom[2]);
    let order = Object.values(JSON.parse(prom[3]));
    let prefsResponse = {};
    try {
        prefsResponse = prom[4] ? JSON.parse(prom[4]) : {};
    } catch (error) {
        prefsResponse = {};
    }
    folderTypePrefs = utils.normalizePrefs(prefsResponse?.prefs || {});
    const folderDepthById = buildFolderDepthById(folders);
    unraidOrder = reorderFolderSlotsInBaseOrder(unraidOrder, folders, folderTypePrefs);
    applyRuntimePrefs(folderTypePrefs);
    lastLiveRefreshStateSignature = buildDockerStateSignature(containersInfo, false);

    if (FOLDER_VIEW_DEBUG_MODE) {
        console.log('[FV3_DEBUG] createFolders: --- INITIAL ORDERS ---');
        console.log('[FV3_DEBUG] createFolders: Raw `unraidOrder` (from read_order.php):', JSON.parse(JSON.stringify(unraidOrder)));
        console.log('[FV3_DEBUG] createFolders: Raw `order` (from read_unraid_order.php - UI order):', JSON.parse(JSON.stringify(order)));
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
            originalOrder: JSON.parse(await $.get('/plugins/folderview.plus/server/read_unraid_order.php?type=docker').promise()),
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

    try { $('#docker_list').sortable('refresh'); } catch(e) {}

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
    const expandedStateById = buildDockerExpandedStateMap(foldersDone, previousFolders);
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
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolders: Restoring expanded folder ${id}.`);
        dropDownButton(id, false);
    }
    persistDockerExpandedStateFromGlobal();

    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] createFolders: Assigned foldersDone to globalFolders:', {...globalFolders});
    renderRuntimeHealthBadge(globalFolders, folderTypePrefs);

    startFolderRowCenterObserver();
    Object.keys(globalFolders).forEach((folderId) => forceFolderRowVerticalCenter(folderId));
    queueForceAllFolderRowsVerticalCenter();
    setTimeout(() => {
        Object.keys(globalFolders).forEach((folderId) => forceFolderRowVerticalCenter(folderId));
        queueForceAllFolderRowsVerticalCenter();
    }, 50);

    folderDebugMode = false; // Existing flag
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] createFolders: Set folderDebugMode (existing) to false.');

    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] createFolders: Exit');
    } finally {
    hideDockerRuntimeLoadingRow();
    dockerPerf.end('createFolders.total', {
        folderCount: Object.keys(globalFolders || {}).length,
        perfMode: FOLDER_VIEW_PERF_MODE
    });
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
    const fld = `<tr class="sortable folder-id-${id} ${hoverClass} folder"><td class="ct-name folder-name"><div class="folder-name-sub"><i class="fa fa-arrows-v mover orange-text"></i><span class="outer folder-outer"><span id="${id}" onclick="addDockerFolderContext('${id}')" class="hand folder-hand"><img src="${safeFolderIcon}" class="img folder-img" onerror='this.src="/plugins/dynamix.docker.manager/images/question.png"'></span><span class="inner folder-inner"><span class="appname" style="display: none;"><a>folder-${id}</a></span><a class="exec folder-appname" onclick='editFolder("${id}")'>${safeFolderName}</a><br><i id="load-folder-${id}" class="fa fa-square stopped red-text folder-load-status"></i><span class="state folder-state"> ${$.i18n('stopped')}</span></span></span><button class="dropDown-${id} folder-dropdown" onclick="dropDownButton('${id}')" ><i class="fa fa-chevron-down" aria-hidden="true"></i></button></div></td><td class="updatecolumn folder-update"><span class="green-text folder-update-text"><i class="fa fa-check fa-fw"></i> ${$.i18n('up-to-date')}</span><div class="advanced" style="display: ${advanced ? 'block' : 'none'};"><a class="exec" onclick="forceUpdateFolder('${id}');"><span style="white-space:nowrap;"><i class="fa fa-cloud-download fa-fw"></i> ${$.i18n('force-update')}</span></a></div></td><td colspan="${colspan}"><div class="folder-storage"></div><div class="folder-preview"></div></td><td class="advanced folder-advanced" ${advanced ? 'style="display: table-cell;"' : ''}><span class="cpu-folder-${id} folder-cpu">0%</span><div class="usage-disk mm folder-load"><span id="cpu-folder-${id}" class="folder-cpu-bar" style="width:0%"></span><span></span></div><br><span class="mem-folder-${id} folder-mem">0 / 0</span></td><td class="folder-autostart"><input type="checkbox" id="folder-${id}-auto" class="autostart" style="display:none"><div style="clear:left"></div></td><td></td></tr>`;
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

    const previewColor = normalizeStatusHexColor(folder.settings.preview_border_color, '#afa89e');
    const previewNode = $(`tr.folder-id-${id} div.folder-preview`).get(0);
    if (previewNode) {
        previewNode.style.setProperty('border', `1px solid ${previewColor}`, 'important');
    }
    $(`tr.folder-id-${id} div.folder-preview`).addClass(`folder-preview-${folder.settings.preview}`);
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Added class folder-preview-${folder.settings.preview} to preview div.`);

    let addPreview;
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Selecting addPreview function based on folder.settings.preview = ${folder.settings.preview}. Context setting: ${folder.settings.context}`);
    switch (folder.settings.preview) {
        case 1:
            addPreview = (folderTrId, ctid, autostart) => {
                if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] addPreview (case 1 for ${folderTrId}): ctid=${ctid}, autostart=${autostart}`);
                let clone = $(`tr.folder-id-${folderTrId} div.folder-storage > tr > td.ct-name > span.outer:last`).clone();
                clone.find(`span.state`)[0].innerHTML = clone.find(`span.state`)[0].innerHTML.split("<br>")[0];
                $(`tr.folder-id-${folderTrId} div.folder-preview`).append(clone.addClass(`${autostart ? 'autostart' : ''}`));
                let tmpId = $(`tr.folder-id-${folderTrId} div.folder-preview > span.outer:last`).find('i[id^="load-"]');
                tmpId.attr("id", "folder-" + tmpId.attr("id"));
                if(folder.settings.context === 2 || folder.settings.context === 0) {
                    tmpId = $(`tr.folder-id-${folderTrId} div.folder-preview > span.outer:last > span.hand`);
                    tmpId.attr("id", "folder-preview-" + ctid);
                    tmpId.removeAttr("onclick");
                    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] addPreview (case 1 for ${folderTrId}): Context is ${folder.settings.context}. Modified preview element for tooltipster:`, tmpId);
                    if(folder.settings.context === 2) { return tmpId; }
                }
            }; break;
        case 2:
            addPreview = (folderTrId, ctid, autostart) => {
                if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] addPreview (case 2 for ${folderTrId}): ctid=${ctid}, autostart=${autostart}`);
                $(`tr.folder-id-${folderTrId} div.folder-preview`).append($(`tr.folder-id-${folderTrId} div.folder-storage > tr > td.ct-name > span.outer > span.hand:last`).clone().addClass(`${autostart ? 'autostart' : ''}`));
                if(folder.settings.context === 2 || folder.settings.context === 0) {
                    let tmpId = $(`tr.folder-id-${folderTrId} div.folder-preview > span.hand:last`);
                    tmpId.attr("id", "folder-preview-" + ctid);
                    tmpId.removeAttr("onclick");
                    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] addPreview (case 2 for ${folderTrId}): Context is ${folder.settings.context}. Modified preview element for tooltipster:`, tmpId);
                    if(folder.settings.context === 2) { return tmpId; }
                }
            }; break;
        case 3:
            addPreview = (folderTrId, ctid, autostart) => {
                if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] addPreview (case 3 for ${folderTrId}): ctid=${ctid}, autostart=${autostart}`);
                let clone = $(`tr.folder-id-${folderTrId} div.folder-storage > tr > td.ct-name > span.outer > span.inner:last`).clone();
                clone.find(`span.state`)[0].innerHTML = clone.find(`span.state`)[0].innerHTML.split("<br>")[0];
                $(`tr.folder-id-${folderTrId} div.folder-preview`).append(clone.addClass(`${autostart ? 'autostart' : ''}`));
                let tmpId = $(`tr.folder-id-${folderTrId} div.folder-preview > span.inner:last`).find('i[id^="load-"]');
                tmpId.attr("id", "folder-" + tmpId.attr("id"));
                if(folder.settings.context === 2 || folder.settings.context === 0) {
                    tmpId = $(`tr.folder-id-${folderTrId} div.folder-preview > span.inner:last > span.appname > a.exec`);
                    tmpId.attr("id", "folder-preview-" + ctid);
                    tmpId.removeAttr("onclick");
                    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] addPreview (case 3 for ${folderTrId}): Context is ${folder.settings.context}. Modified preview element for tooltipster:`, tmpId);
                    if(folder.settings.context === 2) { return tmpId; }
                }
            }; break;
        case 4:
            addPreview = (folderTrId, ctid, autostart) => {
                if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] addPreview (case 4 for ${folderTrId}): ctid=${ctid}, autostart=${autostart}`);
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
                    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] addPreview (case 4 for ${folderTrId}): Context is ${folder.settings.context}. Modified preview element for tooltipster:`, tmpId);
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
            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}), container ${container_name_in_folder}: Moved TR to folder storage.`);

            const currentIndexInLiveList = liveOrderArray.indexOf(container_name_in_folder);
            if (currentIndexInLiveList !== -1) {
                liveOrderArray.splice(currentIndexInLiveList, 1);
                if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}), container ${container_name_in_folder}: Spliced from liveOrderArray. New liveOrderArray length: ${liveOrderArray.length}`);
            } else {
                if (FOLDER_VIEW_DEBUG_MODE) console.warn(`[FV3_DEBUG] createFolder (id: ${id}): Container ${container_name_in_folder} was MOVED FROM DOM but NOT FOUND IN liveOrderArray for splicing. This might indicate it was already spliced by a previous folder or logic error.`);
            }

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

            const tooltip_trigger_element = addPreview(id, ct.shortId, !(ct.info.State.Autostart === false));
            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}), container ${ct.shortId}: Called addPreview. Returned tooltip_trigger_element:`, tooltip_trigger_element ? tooltip_trigger_element[0] : 'null/undefined');
        
            $(`tr.folder-id-${id} div.folder-preview span.inner > span.appname`).css("width", folder.settings.preview_text_width || '');
            if (FOLDER_VIEW_DEBUG_MODE && folder.settings.preview_text_width) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Set preview text width to ${folder.settings.preview_text_width}.`);

            if(tooltip_trigger_element && tooltip_trigger_element.length > 0) {
                if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}), container ${ct.shortId}: tooltip_trigger_element is valid. Initializing tooltipster.`);
                const triggerMode = folder.settings.context_trigger === 1 && !FOLDER_VIEW_TOUCH_MODE ? 'hover' : 'click';
                $(tooltip_trigger_element).tooltipster({
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
                });
            } else {
                 if (FOLDER_VIEW_DEBUG_MODE) console.warn(`[FV3_DEBUG] createFolder (id: ${id}), container ${ct.shortId}: tooltip_trigger_element is NOT valid. Tooltipster NOT initialized. This is likely the problem if folder.settings.context === 2.`);
            }

            newFolder[container_name_in_folder] = {
                id: ct.shortId,
                name: ct.info.Name || container_name_in_folder,
                icon: ct.Labels?.['net.unraid.docker.icon'] || '/plugins/dynamix.docker.manager/images/question.png',
                pause: ct.info.State.Paused,
                state: ct.info.State.Running,
                autostart: !(ct.info.State.Autostart === false),
                update: ct.info.State.Updated === false && ct.info.State.manager === 'dockerman',
                managed: ct.info.State.manager === 'dockerman',
                manager: ct.info.State.manager
            };
            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}), container ${container_name_in_folder}: Stored in newFolder:`, JSON.parse(JSON.stringify(newFolder[container_name_in_folder])));

            const elementForPreviewOpts = $(`tr.folder-id-${id} div.folder-preview > span:last`); // Re-check if this is always correct
            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}), container ${container_name_in_folder}: Preview element for options:`, elementForPreviewOpts[0]);
            let sel_preview_opt;
            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}), container ${container_name_in_folder}: Applying preview options based on folder.settings:`, JSON.parse(JSON.stringify(folder.settings)));
         
            const $previewElementTarget = $(`tr.folder-id-${id} div.folder-preview > span:last`); // Or elementForPreviewOpts if you prefer
            let $targetForAppend; // Used for WebUI, Console, Logs icons

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
            $targetForAppend = $previewElementTarget.children('span.inner').last();
            if (!$targetForAppend.length) {
                $targetForAppend = $previewElementTarget; // Fallback to the main span if no inner span
            }

            if (folder.settings.preview_webui && ct.info.State.WebUi) {
                if ($targetForAppend.length) {
                    $targetForAppend.append($(`<span class="folder-element-custom-btn folder-element-webui"><a href="${ct.info.State.WebUi}" target="_blank" rel="noopener noreferrer"><i class="fa fa-globe" aria-hidden="true"></i></a></span>`));
                    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}), container ${container_name_in_folder}: Appended WebUI icon to preview.`);
                } else {
                     if (FOLDER_VIEW_DEBUG_MODE) console.warn(`[FV3_DEBUG] createFolder (id: ${id}), container ${container_name_in_folder}: WebUI icon: Could not find target for append in preview element.`);
                }
            }

            if (folder.settings.preview_console) {
                if ($targetForAppend.length) {
                    $targetForAppend.append($(`<span class="folder-element-custom-btn folder-element-console"><a href="#" onclick="event.preventDefault(); openTerminal('docker', '${ct.info.Name}', '${ct.info.Shell}');"><i class="fa fa-terminal" aria-hidden="true"></i></a></span>`));
                    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}), container ${container_name_in_folder}: Appended Console icon to preview.`);
                } else {
                     if (FOLDER_VIEW_DEBUG_MODE) console.warn(`[FV3_DEBUG] createFolder (id: ${id}), container ${container_name_in_folder}: Console icon: Could not find target for append in preview element.`);
                }
            }

            if (folder.settings.preview_logs) {
                if ($targetForAppend.length) {
                    // Use ct.info.Name for consistency, as 'container_name_in_folder' is the same.
                    $targetForAppend.append($(`<span class="folder-element-custom-btn folder-element-logs"><a href="#" onclick="event.preventDefault(); openTerminal('docker', '${ct.info.Name}', '.log');"><i class="fa fa-bars" aria-hidden="true"></i></a></span>`));
                    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}), container ${container_name_in_folder}: Appended Logs icon to preview.`);
                } else {
                    if (FOLDER_VIEW_DEBUG_MODE) console.warn(`[FV3_DEBUG] createFolder (id: ${id}), container ${container_name_in_folder}: Logs icon: Could not find target for append in preview element.`);
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

    $(`tr.folder-id-${id} div.folder-storage i[id^="load-"]`).get().forEach((e) => {
        folderobserver.observe(e, folderobserverConfig);
    });
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Attached folderobserver to .folder-storage load icons.`);
    $(`tr.folder-id-${id} div.folder-preview > span`).wrap('<div class="folder-preview-wrapper"></div>');
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Wrapped preview spans with .folder-preview-wrapper.`);
    if(folder.settings.preview_vertical_bars) {
        const barsColor = folder.settings.preview_vertical_bars_color || folder.settings.preview_border_color;
        $(`tr.folder-id-${id} div.folder-preview > div`).after(`<div class="folder-preview-divider" style="border-color: ${barsColor};"></div>`);
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Added preview_vertical_bars.`);
    }
    if(folder.settings.update_column) {
        $(`tr.folder-id-${id} > td.updatecolumn`).next().attr('colspan',6).end().remove();
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Handled update_column setting (removed column).`);
    }
    if(managed === 0) {
        $(`tr.folder-id-${id} > td.updatecolumn > div.advanced`).remove();
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): No managed containers, removed advanced update div.`);
    }

    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Setting folder status indicators based on aggregate states. managerTypes:`, Array.from(managerTypes));
    const hasDockerMan = managerTypes.has('dockerman');
    const hasCompose = managerTypes.has('composeman');
    const has3rdParty = [...managerTypes].some(t => t !== 'dockerman' && t !== 'composeman');

    if (!hasDockerMan && hasCompose && has3rdParty) {
        $(`tr.folder-id-${id} > td.updatecolumn > span`).replaceWith(
            $(`<span class="folder-update-text" style="white-space:nowrap;"><i class="fa fa-docker fa-fw"></i> ${$.i18n('compose')}</span><br><span class="folder-update-text" style="white-space:nowrap;"><i class="fa fa-docker fa-fw"></i> ${$.i18n('third-party')}</span>`)
        );
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Set stacked 'compose + 3rd party' labels in update column.`);
    } else if (!hasDockerMan && hasCompose) {
        $(`tr.folder-id-${id} > td.updatecolumn > span`).replaceWith(
            $(`<span class="folder-update-text" style="white-space:nowrap;"><i class="fa fa-docker fa-fw"></i> ${$.i18n('compose')}</span>`)
        );
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Set 'compose' label in update column.`);
    } else if (!hasDockerMan) {
        $(`tr.folder-id-${id} > td.updatecolumn > span`).replaceWith(
            $(`<span class="folder-update-text" style="white-space:nowrap;"><i class="fa fa-docker fa-fw"></i> ${$.i18n('third-party')}</span>`)
        );
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Set '3rd party' label in update column.`);
    } else if (!upToDate) {
        $(`tr.folder-id-${id} > td.updatecolumn > span`).replaceWith($(`<div class="advanced" style="display: ${advanced ? 'block' : 'none'};"><span class="orange-text folder-update-text" style="white-space:nowrap;"><i class="fa fa-flash fa-fw"></i> ${$.i18n('update-ready')}</span></div>`));
        $(`tr.folder-id-${id} > td.updatecolumn > div.advanced:has(a)`).remove();
        $(`tr.folder-id-${id} > td.updatecolumn`).append($(`<a class="exec" onclick="updateFolder('${id}');"><span style="white-space:nowrap;"><i class="fa fa-cloud-download fa-fw"></i> ${$.i18n('apply-update')}</span></a>`));
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): Set 'update ready' status in update column.`);
    }
    const total = Object.entries(folder.containers).length;
    if (folderTypePrefs?.hideEmptyFolders === true && total === 0) {
        $(`tr.folder-id-${id}`).remove();
        $(`tr#name-${id}`).remove();
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] createFolder (id: ${id}): hideEmptyFolders enabled, removed empty folder row.`);
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
    $folderRow.find('.folder-storage').append($(`.folder-${id}-element`));
    $(`.folder-${id}-element`).addClass('fv-nested-hidden').hide();
    if (syncStatus && globalFolders[id] && globalFolders[id].status) {
        globalFolders[id].status.expanded = false;
    }
};

const buildRuntimeContainerMapForFolder = (folderId, includeDescendants = false) => {
    const collected = {};
    const targetIds = includeDescendants ? [folderId, ...getFolderDescendants(folderId)] : [folderId];
    for (const targetId of targetIds) {
        const folder = globalFolders[targetId];
        if (!folder || !folder.containers || typeof folder.containers !== 'object') {
            continue;
        }
        for (const [name, meta] of Object.entries(folder.containers)) {
            const key = String(name || '').trim();
            if (!key || Object.prototype.hasOwnProperty.call(collected, key)) {
                continue;
            }
            const source = meta && typeof meta === 'object' ? meta : {};
            collected[key] = {
                ...source,
                name: source.name || key,
                icon: source.icon || '/plugins/dynamix.docker.manager/images/question.png',
                autostart: source.autostart === true
            };
        }
    }
    return collected;
};

const updateFolderRowStatusFromContainers = (id, folder, runtimeContainers) => {
    if (!folder || typeof folder !== 'object') {
        return;
    }
    const containerEntries = Object.values(runtimeContainers || {});
    let upToDate = true;
    let started = 0;
    let paused = 0;
    let stopped = 0;
    let autostart = 0;
    let autostartStarted = 0;
    let managed = 0;
    const managerTypes = new Set();

    for (const entry of containerEntries) {
        const state = entry?.state === true;
        const isPaused = entry?.pause === true;
        const isManaged = entry?.managed === true;
        const hasUpdate = entry?.update === true;
        const manager = String(entry?.manager || '').trim();
        const isAutostart = entry?.autostart === true;

        upToDate = upToDate && !hasUpdate;
        if (state) {
            if (isPaused) {
                paused += 1;
            } else {
                started += 1;
            }
        } else {
            stopped += 1;
        }
        if (isAutostart) {
            autostart += 1;
            if (state) {
                autostartStarted += 1;
            }
        }
        if (isManaged) {
            managed += 1;
        }
        if (manager) {
            managerTypes.add(manager);
        }
    }

    const total = containerEntries.length;
    const statusColors = typeof utils.getFolderStatusColors === 'function'
        ? utils.getFolderStatusColors(folder.settings)
        : localDefaultFolderStatusColors;
    const $folderIcon = $(`tr.folder-id-${id} i#load-folder-${id}`);
    const $folderState = $(`tr.folder-id-${id} span.folder-state`);
    $folderState.removeClass('fv-folder-state-started fv-folder-state-paused fv-folder-state-stopped');
    $folderState.css('color', '');
    $folderIcon.show().css('color', '');
    if (started > 0) {
        $folderIcon.attr('class', 'fa fa-play started folder-load-status').css('color', statusColors.started);
        $folderState.text(`${started}/${total} ${$.i18n('started')}`).addClass('fv-folder-state-started').css('color', statusColors.started);
    } else if (paused > 0) {
        $folderIcon.attr('class', 'fa fa-pause paused folder-load-status').css('color', statusColors.paused);
        $folderState.text(`${paused}/${total} ${$.i18n('paused')}`).addClass('fv-folder-state-paused').css('color', statusColors.paused);
    } else {
        $folderIcon.attr('class', 'fa fa-square stopped folder-load-status').css('color', statusColors.stopped);
        $folderState.text(`${stopped}/${total} ${$.i18n('stopped')}`).addClass('fv-folder-state-stopped').css('color', statusColors.stopped);
    }

    const expanded = folder?.status?.expanded === true;
    folder.status = { upToDate, started, paused, stopped, autostart, autostartStarted, managed, managerTypes: Array.from(managerTypes), expanded };
};

const renderNestedAggregatePreview = (id, folder, runtimeContainers) => {
    const $preview = $(`tr.folder-id-${id} div.folder-preview`);
    if (!$preview.length) {
        return;
    }
    const previewMode = Number(folder?.settings?.preview || 0);
    if (previewMode <= 0) {
        $preview.empty();
        return;
    }
    const entries = Object.values(runtimeContainers || {});
    $preview.empty();
    for (const entry of entries) {
        const safeName = escapeHtml(entry?.name || '');
        const safeIcon = sanitizeImageSrc(entry?.icon || '/plugins/dynamix.docker.manager/images/question.png');
        const isRunning = entry?.state === true;
        const isPaused = entry?.pause === true;
        const iconClass = isRunning ? (isPaused ? 'fa-pause paused orange-text' : 'fa-play started green-text') : 'fa-square stopped red-text';
        const stateLabel = isRunning ? (isPaused ? $.i18n('paused') : $.i18n('started')) : $.i18n('stopped');
        const item = $(`
            <span class="outer fv-nested-preview-item ${entry?.autostart === true ? 'autostart' : ''}">
                <span class="hand"><img src="${safeIcon}" class="img folder-img" onerror='this.src="/plugins/dynamix.docker.manager/images/question.png"'></span>
                <span class="inner">
                    <span class="appname"><a>${safeName}</a></span><br>
                    <i class="fa ${iconClass}"></i><span class="state"> ${stateLabel}</span>
                </span>
            </span>
        `);
        $preview.append(item);
    }
    $preview.children('span').wrap('<div class="folder-preview-wrapper"></div>');
    if (folder?.settings?.preview_vertical_bars) {
        const barsColor = folder.settings.preview_vertical_bars_color || folder.settings.preview_border_color || '';
        $preview.find('div.folder-preview-wrapper').after(`<div class="folder-preview-divider" ${barsColor ? `style="border-color: ${barsColor};"` : ''}></div>`);
    }
    $preview.find('span.inner > span.appname').css('width', folder?.settings?.preview_text_width || '');
};

const syncParentFolderVisualState = (id, expanded) => {
    if (!folderHasChildren(id)) {
        return;
    }
    const $row = $(`tr.folder-id-${id}`);
    $row.toggleClass('fv-parent-collapsed', !expanded);
    $row.toggleClass('fv-parent-expanded', !!expanded);

    if (expanded) {
        $row.find('div.folder-preview').empty();
    } else {
        const folder = globalFolders[id];
        const runtimeContainers = folder?.runtimeContainers || {};
        renderNestedAggregatePreview(id, folder, runtimeContainers);
    }
    if (!expanded) {
        const folder = globalFolders[id];
        const previewColor = normalizeStatusHexColor(folder?.settings?.preview_border_color, '#afa89e');
        const previewNode = $row.find('div.folder-preview').get(0);
        if (previewNode) previewNode.style.setProperty('border', `1px solid ${previewColor}`, 'important');
    }
};

const hideNestedDescendants = (id) => {
    for (const descendantId of getFolderDescendants(id)) {
        forceCollapseFolderRow(descendantId, true);
        $(`tr.folder-id-${descendantId}`).addClass('fv-nested-hidden').hide();
    }
};

const showDirectNestedChildren = (id) => {
    for (const childId of getFolderChildren(id)) {
        forceCollapseFolderRow(childId, false);
        $(`tr.folder-id-${childId}`).removeClass('fv-nested-hidden').show();
    }
};

const applyNestedFolderHierarchy = () => {
    dockerFolderHierarchy = buildFolderHierarchy(globalFolders);
    const allIds = dockerFolderHierarchy?.ids || [];
    const parentById = dockerFolderHierarchy?.parentById || {};

    for (const id of allIds) {
        const parentId = parentById[id] || '';
        const $row = $(`tr.folder-id-${id}`);
        $row.attr('data-folder-parent', parentId);
        $row.toggleClass('fv-folder-is-child', !!parentId);
        $row.toggleClass('fv-folder-has-children', folderHasChildren(id));
        if (parentId) {
            forceCollapseFolderRow(id, false);
            $row.addClass('fv-nested-hidden').hide();
        } else {
            $row.removeClass('fv-nested-hidden').show();
        }
    }

    for (const id of allIds) {
        if (!folderHasChildren(id)) {
            if (globalFolders[id]) {
                delete globalFolders[id].runtimeContainers;
            }
            continue;
        }
        const runtimeContainers = buildRuntimeContainerMapForFolder(id, true);
        if (globalFolders[id]) {
            globalFolders[id].runtimeContainers = runtimeContainers;
            updateFolderRowStatusFromContainers(id, globalFolders[id], runtimeContainers);
            syncParentFolderVisualState(id, globalFolders[id]?.status?.expanded === true);
        }
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
    const containers = $(`.folder-${id}-element`);
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
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] dropDownButton (id: ${id}): Entry.`);
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] dropDownButton (id: ${id}): Dispatching docker-pre-folder-expansion event.`);
    folderEvents.dispatchEvent(new CustomEvent('docker-pre-folder-expansion', {detail: { id }}));
    const element = $(`.dropDown-${id}`);
    const state = element.attr('active') === "true";
    const hasChildren = folderHasChildren(id);
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] dropDownButton (id: ${id}): Current state (active attribute): ${state}.`);
    if (state) { // Is expanded, so collapse
        element.children().removeClass('fa-chevron-up').addClass('fa-chevron-down');
        if (hasChildren) {
            hideNestedDescendants(id);
        }
        $(`tr.folder-id-${id}`).addClass('sortable');
        $(`tr.folder-id-${id} .folder-storage`).append($(`.folder-${id}-element`));
        $(`.folder-${id}-element`).addClass('fv-nested-hidden').hide();
        if (hasChildren) {
            syncParentFolderVisualState(id, false);
        }
        element.attr('active', 'false');
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] dropDownButton (id: ${id}): Collapsed folder. Moved elements to storage.`);
    } else { // Is collapsed, so expand
        element.children().removeClass('fa-chevron-down').addClass('fa-chevron-up');
        $(`tr.folder-id-${id}`).removeClass('sortable').removeClass('ui-sortable-handle').off().css('cursor', '');
        if (hasChildren) {
            $(`tr.folder-id-${id} .folder-storage`).append($(`.folder-${id}-element`));
            $(`.folder-${id}-element`).addClass('fv-nested-hidden').hide();
            showDirectNestedChildren(id);
            syncParentFolderVisualState(id, true);
            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] dropDownButton (id: ${id}): Expanded parent folder. Showing nested children only.`);
        } else {
            $(`tr.folder-id-${id}`).after($(`.folder-${id}-element`));
            $(`.folder-${id}-element`).removeClass('fv-nested-hidden').show();
            $(`.folder-${id}-element > td > i.fa-arrows-v`).remove(); // Remove mover icon from children when expanded
            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] dropDownButton (id: ${id}): Expanded leaf folder. Moved elements after folder row.`);
        }
        element.attr('active', 'true');
    }
    if(globalFolders[id]) {
        globalFolders[id].status.expanded = !state;
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] dropDownButton (id: ${id}): Updated globalFolders[${id}].status.expanded to ${!state}.`);
    } else {
        if (FOLDER_VIEW_DEBUG_MODE) console.warn(`[FV3_DEBUG] dropDownButton (id: ${id}): globalFolders[${id}] not found to update expanded status.`);
    }
    if (persistState) {
        persistDockerExpandedStateFromGlobal();
    }
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] dropDownButton (id: ${id}): Dispatching docker-post-folder-expansion event.`);
    folderEvents.dispatchEvent(new CustomEvent('docker-post-folder-expansion', {detail: { id }}));
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] dropDownButton (id: ${id}): Exit.`);
};

/**
 * Removie the folder
 * @param {string} id the id of the folder
 */
const rmFolder = (id) => {
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] rmFolder (id: ${id}): Entry.`);
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
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] rmFolder (id: ${id}): Swal callback. Confirmed: ${c}`);
        if (!c) { setTimeout(loadlist, 0); return; } // Use timeout 0 for consistency
        $('div.spinner.fixed').show('slow');
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] rmFolder (id: ${id}): Calling delete API.`);
        await $.post('/plugins/folderview.plus/server/delete.php', { type: 'docker', id: id }).promise();
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] rmFolder (id: ${id}): Delete API call finished. Reloading list.`);
        setTimeout(loadlist, 500);
    });
};

/**
 * Redirect to the page to edit the folder
 * @param {string} id the id of the folder
 */
const editFolder = (id) => {
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] editFolder (id: ${id}): Redirecting to edit page.`);
    location.href = "/Docker/Folder?type=docker&id=" + id;
};

/**
 * Force update all the containers inside a folder
 * @param {string} id the id of the folder
 */
const forceUpdateFolder = (id) => {
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] forceUpdateFolder (id: ${id}): Entry.`);
    hideAllTips();
    const folder = globalFolders[id];
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] forceUpdateFolder (id: ${id}): Folder data:`, {...folder});
    const containersMap = getFolderRuntimeContainers(folder);
    const containersToUpdate = Object.entries(containersMap).filter(([, v]) => v.managed).map((e) => e[0]).join('*');
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] forceUpdateFolder (id: ${id}): Containers to force update: ${containersToUpdate}. Calling openDocker.`);
    openDocker('update_container ' + containersToUpdate, $.i18n('updating', folder.name),'','loadlist');
};

/**
 * Update all the updatable containers inside a folder
 * @param {string} id the id of the folder
 */
const updateFolder = (id) => {
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] updateFolder (id: ${id}): Entry.`);
    hideAllTips();
    const folder = globalFolders[id];
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] updateFolder (id: ${id}): Folder data:`, {...folder});
    const containersMap = getFolderRuntimeContainers(folder);
    const containersToUpdate = Object.entries(containersMap).filter(([, v]) => v.managed && v.update).map((e) => e[0]).join('*');
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] updateFolder (id: ${id}): Containers to update (ready): ${containersToUpdate}. Calling openDocker.`);
    openDocker('update_container ' + containersToUpdate, $.i18n('updating', folder.name),'','loadlist');
};

/**
 * Perform an action for the entire folder
 * @param {string} id The id of the folder
 * @param {string} action the desired action
 */
const actionFolder = async (id, action) => {
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] actionFolder (id: ${id}, action: ${action}): Entry.`);
    const folder = globalFolders[id];
    const containersMap = getFolderRuntimeContainers(folder);
    if (!folder || !containersMap || Object.keys(containersMap).length === 0) {
        if (FOLDER_VIEW_DEBUG_MODE) console.error(`[FV3_DEBUG] actionFolder (id: ${id}): Folder or folder.containers not found in globalFolders.`);
        $('div.spinner.fixed').hide('slow');
        return;
    }
    const cts = Object.keys(containersMap);
    let proms = [];
    let errors;

    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] actionFolder (id: ${id}): Folder data:`, {...folder}, "Containers to act on:", cts);

    $(`i#load-folder-${id}`).removeClass('fa-play fa-square fa-pause').addClass('fa-refresh fa-spin');
    $('div.spinner.fixed').show('slow');

    for (let index = 0; index < cts.length; index++) {
        const containerName = cts[index];
        const ct = containersMap[containerName];
        if (!ct) {
            if (FOLDER_VIEW_DEBUG_MODE) console.warn(`[FV3_DEBUG] actionFolder (id: ${id}): Container data for '${containerName}' not found in folder.containers.`);
            continue;
        }
        const cid = ct.id;
        let pass = false; // Default to false
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] actionFolder (id: ${id}): Processing container ${containerName} (cid: ${cid}). State: ${ct.state}, Paused: ${ct.pause}.`);
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
            case "restart":
                pass = true;
                break;
            default:
                pass = false; // Should not happen with predefined actions
                if (FOLDER_VIEW_DEBUG_MODE) console.warn(`[FV3_DEBUG] actionFolder (id: ${id}): Unknown action '${action}'.`);
                break;
        }
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] actionFolder (id: ${id}): Container ${containerName} - action '${action}', pass condition: ${pass}.`);
        if(pass) {
            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] actionFolder (id: ${id}): Pushing POST request for container ${cid}, action ${action}.`);
            proms.push($.post(eventURL, {action: action, container:cid}, null,'json').promise());
        }
    }

    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] actionFolder (id: ${id}): Awaiting ${proms.length} promises.`);
    const results = await Promise.all(proms);
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] actionFolder (id: ${id}): Promises resolved. Results:`, results);

    errors = results.filter(e => e.success !== true);
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] actionFolder (id: ${id}): Filtered errors:`, errors);
    // errors = errors.map(e => e.success); // This line seems to map to boolean, original used `e.text` or similar for swal

    if(errors.length > 0) {
        const errorMessages = errors.map(e => e.text || JSON.stringify(e)); // Get error text or stringify if not present
        if (FOLDER_VIEW_DEBUG_MODE) console.error(`[FV3_DEBUG] actionFolder (id: ${id}): Execution errors occurred:`, errorMessages);
        swal({
            title: $.i18n('exec-error'),
            text:errorMessages.join('<br>'),
            type:'error',
            html:true,
            confirmButtonText:'Ok'
        }, loadlist);
    } else {
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] actionFolder (id: ${id}): No errors. Reloading list.`);
        loadlist();
    }
    $('div.spinner.fixed').hide('slow');
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] actionFolder (id: ${id}): Exit.`);
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
        loadlist();
        return;
    }
    let act = folder.actions[actionIndex];
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (id: ${id}): Action details:`, {...act});
    let prom = [];

    if(act.type === 0) { // Standard Docker action
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (id: ${id}): Action type 0 (Standard Docker).`);
        const containersMap = getFolderRuntimeContainers(folder);
        // act.conatiners is an array of names. Need to map to folder containers by name.
        const cts = act.conatiners.map((name) => containersMap[name]).filter((e) => e);
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (id: ${id}): Targeted containers data:`, [...cts]);

        let ctAction = (e) => {}; // Placeholder
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
        cts.forEach((e_ct_data) => { // e_ct_data is like {id: "...", state: true, ...}
            if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (id: ${id}): Applying defined ctAction to container data:`, e_ct_data);
            ctAction(e_ct_data);
        });
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (id: ${id}): Pushed ${prom.length} standard actions to promise array.`);

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
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (id: ${id}): All promises resolved. Reloading list.`);

    loadlist();
    $('div.spinner.fixed').hide('slow');
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] folderCustomAction (id: ${id}): Exit.`);
};


/**
 * Atach the menu when clicking the folder icon
 * @param {string} id the id of the folder
 */
const addDockerFolderContext = (id) => {
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] addDockerFolderContext (id: ${id}): Entry.`);
    let opts = [];

    context.settings({
        right: false,
        above: false
    });
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] addDockerFolderContext (id: ${id}): Context menu settings configured.`);

    if (!globalFolders[id]) {
        if (FOLDER_VIEW_DEBUG_MODE) console.error(`[FV3_DEBUG] addDockerFolderContext (id: ${id}): Folder data not found in globalFolders. Aborting context menu.`);
        return;
    }
    const folderData = globalFolders[id];
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] addDockerFolderContext (id: ${id}): Folder data:`, {...folderData});


    if (folderData.settings.folder_webui && folderData.settings.folder_webui_url) {
        opts.push({
            text: $.i18n('webui'),
            icon: 'fa-globe',
            action: (evt) => {
                evt.preventDefault();
                const popup = window.open(folderData.settings.folder_webui_url, '_blank', 'noopener,noreferrer');
                if (popup) {
                    popup.opener = null;
                }
            }
        });
        opts.push({ divider: true });
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
        opts.push({ divider: true });
    } else if(!folderData.settings.default_action) { // if default actions are NOT hidden
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] addDockerFolderContext (id: ${id}): Adding default action menu items.`);
        opts.push({
            text: $.i18n('start'),
            icon: 'fa-play',
            action: (evt) => { evt.preventDefault(); actionFolder(id, "start"); }
        });
        opts.push({
            text: $.i18n('stop'),
            icon: 'fa-stop',
            action: (evt) => { evt.preventDefault(); actionFolder(id, "stop"); }
        });
        opts.push({
            text: $.i18n('pause'),
            icon: 'fa-pause',
            action: (evt) => { evt.preventDefault(); actionFolder(id, "pause"); }
        });
        opts.push({
            text: $.i18n('resume'),
            icon: 'fa-play-circle',
            action: (evt) => { evt.preventDefault(); actionFolder(id, "resume"); }
        });
        opts.push({
            text: $.i18n('restart'),
            icon: 'fa-refresh',
            action: (evt) => { evt.preventDefault(); actionFolder(id, "restart"); }
        });
        opts.push({ divider: true });
    }

    if(folderData.status.managed > 0) {
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] addDockerFolderContext (id: ${id}): Folder has managed containers. Adding update options.`);
        if(!folderData.status.upToDate) {
            opts.push({
                text: $.i18n('update'),
                icon: 'fa-cloud-download',
                action: (evt) => { evt.preventDefault();  updateFolder(id); }
            });
        } else {
            opts.push({
                text: $.i18n('update-force'),
                icon: 'fa-cloud-download',
                action: (evt) => { evt.preventDefault(); forceUpdateFolder(id); }
            });
        }
        opts.push({ divider: true });
    }

    opts.push({
        text: $.i18n('edit'),
        icon: 'fa-wrench',
        action: (evt) => { evt.preventDefault(); editFolder(id); }
    });

    opts.push({
        text: $.i18n('remove'),
        icon: 'fa-trash',
        action: (evt) => { evt.preventDefault(); rmFolder(id); }
    });

    // Add custom actions as submenu if not overriding and custom actions exist
    if(!folderData.settings.override_default_actions && folderData.actions && folderData.actions.length) {
        if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] addDockerFolderContext (id: ${id}): Adding custom actions as submenu.`);
        opts.push({ divider: true });
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

    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] addDockerFolderContext (id: ${id}): Dispatching docker-folder-context event. Options:`, opts);
    folderEvents.dispatchEvent(new CustomEvent('docker-folder-context', {detail: { id, opts }}));

    context.attach('#' + id, opts);
    if (FOLDER_VIEW_DEBUG_MODE) console.log(`[FV3_DEBUG] addDockerFolderContext (id: ${id}): Context menu attached to #${id}. Exit.`);
};

// Patching the original function to make sure the containers are rendered before insering the folder
window.listview_original = window.listview; // Ensure original is captured
window.listview = () => {
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Patched listview: Entry.');
    if (typeof window.listview_original === 'function') {
        window.listview_original();
        if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Patched listview: Called original listview.');
    } else {
        if (FOLDER_VIEW_DEBUG_MODE) console.error('[FV3_DEBUG] Patched listview: window.listview_original is not a function!');
    }

    if (!loadedFolder) {
        // Some Unraid builds can invoke listview before loadlist.
        // Ensure requests exist so createFolders has data to render imported folders.
        if (!Array.isArray(folderReq) || folderReq.length === 0) {
            folderReq = buildDockerFolderReq();
        }
        if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Patched listview: loadedFolder is false. Calling createFolders.');
        createFolders(); // This is async, but original listview isn't, so this runs after.
        loadedFolder = true;
         if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Patched listview: Set loadedFolder to true.');
    } else {
        if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Patched listview: loadedFolder is true. Skipped createFolders.');
    }
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Patched listview: Exit.');
};

window.loadlist_original = window.loadlist; // Ensure original is captured
window.loadlist = () => {
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Patched loadlist: Entry.');
    loadedFolder = false;
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Patched loadlist: Set loadedFolder to false.');
    folderReq = buildDockerFolderReq();
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Patched loadlist: folderReq initialized with 5 promises.');

    if (typeof window.loadlist_original === 'function') {
        window.loadlist_original();
        if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] Patched loadlist: Called original loadlist.');
    } else {
        if (FOLDER_VIEW_DEBUG_MODE) console.error('[FV3_DEBUG] Patched loadlist: window.loadlist_original is not a function!');
    }
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

            for (const [cid_name, cvalue] of Object.entries(value.containers)) { // cid_name is container name, cvalue is {id, state, ...}
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

const fetchDockerStateSignature = async () => {
    const payload = await $.get('/plugins/folderview.plus/server/read_info.php?type=docker&mode=state').promise();
    const parsed = parseJsonPayloadSafe(payload);
    return buildDockerStateSignature(parsed, true);
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
    $('body').toggleClass('fvplus-performance-mode', normalized.performanceMode === true);
    scheduleLiveRefresh(normalized);
};

function buildDockerFolderReq() {
    const safePrefsReq = $.get('/plugins/folderview.plus/server/prefs.php?type=docker')
        .then((data) => data, () => JSON.stringify({ ok: false, prefs: {} }));
    return [
        // Get the folders
        $.get('/plugins/folderview.plus/server/read.php?type=docker').promise(),
        // Get the order as unraid sees it
        $.get('/plugins/folderview.plus/server/read_order.php?type=docker').promise(),
        // Get the info on containers, needed for autostart, update and started
        $.get('/plugins/folderview.plus/server/read_info.php?type=docker').promise(),
        // Get the order that is shown in the webui
        $.get('/plugins/folderview.plus/server/read_unraid_order.php?type=docker').promise(),
        // Get sort and auto-assignment preferences
        safePrefsReq
    ];
}

// Prime requests for environments where loadlist isn't called first.
folderReq = buildDockerFolderReq();

if (FOLDER_VIEW_DEBUG_MODE) {
    console.log('[FV3_DEBUG] Global variables initialized:', {
        cpus, loadedFolder, globalFolders: {...globalFolders}, folderRegex: folderRegex.toString(),
        folderDebugMode, folderDebugModeWindow: [...folderDebugModeWindow],
        folderobserverConfig: {...folderobserverConfig}, folderReq: [...folderReq]
    });
}

// Add the button for creating a folder
const createFolderBtn = () => {
    if (FOLDER_VIEW_DEBUG_MODE) console.log('[FV3_DEBUG] createFolderBtn: Clicked. Redirecting.');
    location.href = "/Docker/Folder?type=docker"
};

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
