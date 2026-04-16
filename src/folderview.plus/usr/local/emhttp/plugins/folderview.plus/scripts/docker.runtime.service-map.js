// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusDockerServiceMap = factory();
    root.FolderViewPlusDockerServiceMapModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const fallbackWindow = typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : null);
    const ROOT_ID = 'fvplus-docker-service-map-root';
    const BODY_ATTR = 'data-fvplus-docker-service-map-mounted';
    const DOCKER_ICON_FALLBACK = '/plugins/dynamix.docker.manager/images/question.png';
    const DEFAULT_FOLDER_ICON = '/plugins/folderview.plus/images/folder-icon.png';

    const createApi = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        const doc = deps.document || win?.document || (typeof document !== 'undefined' ? document : null);
        const jq = deps.$ || win?.jQuery || win?.$;
        const utils = deps.utils && typeof deps.utils === 'object' ? deps.utils : {};
        const escapeHtml = typeof deps.escapeHtml === 'function'
            ? deps.escapeHtml
            : ((value) => String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;'));
        const parseJsonPayloadSafe = typeof deps.parseJsonPayloadSafe === 'function'
            ? deps.parseJsonPayloadSafe
            : ((payload) => {
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
            });
        const normalizePrefs = typeof utils.normalizePrefs === 'function'
            ? utils.normalizePrefs
            : ((prefs = {}) => (prefs && typeof prefs === 'object' ? prefs : {}));
        const sanitizeImageSrc = typeof utils.sanitizeImageSrc === 'function'
            ? utils.sanitizeImageSrc
            : ((value, fallback = DOCKER_ICON_FALLBACK) => {
                const raw = String(value || '').trim();
                if (!raw || /^javascript:/i.test(raw)) {
                    return fallback;
                }
                return escapeHtml(raw);
            });
        const normalizeRuntimeInfoMap = typeof deps.normalizeDockerRuntimeInfoMap === 'function'
            ? deps.normalizeDockerRuntimeInfoMap
            : ((value) => (value && typeof value === 'object' ? value : {}));
        const getSafeWebuiUrl = typeof deps.getSafeWebuiUrl === 'function'
            ? deps.getSafeWebuiUrl
            : ((value) => {
                const raw = String(value || '').trim();
                return raw && !/^javascript:/i.test(raw) ? raw : '';
            });
        const getPrefsOrderedFolderMap = typeof deps.getPrefsOrderedFolderMap === 'function'
            ? deps.getPrefsOrderedFolderMap
            : ((folders, prefs) => (
                typeof utils.orderFoldersByPrefs === 'function'
                    ? utils.orderFoldersByPrefs(folders, prefs || {})
                    : (folders && typeof folders === 'object' ? folders : {})
            ));
        const reorderFolderSlotsInBaseOrder = typeof deps.reorderFolderSlotsInBaseOrder === 'function'
            ? deps.reorderFolderSlotsInBaseOrder
            : ((baseOrder) => Array.isArray(baseOrder) ? baseOrder.slice() : []);
        const buildFolderDepthById = typeof deps.buildFolderDepthById === 'function'
            ? deps.buildFolderDepthById
            : (() => ({}));
        const buildFolderHierarchy = typeof deps.buildFolderHierarchy === 'function'
            ? deps.buildFolderHierarchy
            : (() => ({ ids: [], parentById: {}, childrenById: {} }));
        const buildFolderMatchCache = typeof deps.buildFolderMatchCache === 'function'
            ? deps.buildFolderMatchCache
            : (() => ({}));
        const readDockerHostOrderFromDom = typeof deps.readDockerHostOrderFromDom === 'function'
            ? deps.readDockerHostOrderFromDom
            : (() => []);
        const resolveRequestBundle = typeof deps.resolveRequestBundle === 'function'
            ? deps.resolveRequestBundle
            : (() => ({ render: [], fullInfo: null, generation: 0 }));
        const setRuntimeState = typeof deps.setRuntimeState === 'function'
            ? deps.setRuntimeState
            : (() => {});
        const getScopedRuntimeContainersForFolder = typeof deps.getScopedRuntimeContainersForFolder === 'function'
            ? deps.getScopedRuntimeContainersForFolder
            : (() => ({}));
        const summarizeFolderActionCounts = typeof deps.summarizeFolderActionCounts === 'function'
            ? deps.summarizeFolderActionCounts
            : (() => ({
                total: 0,
                startable: 0,
                stoppable: 0,
                pausable: 0,
                resumable: 0,
                restartable: 0,
                managed: 0,
                updateReady: 0
            }));
        const buildStateSignature = typeof deps.buildStateSignature === 'function'
            ? deps.buildStateSignature
            : (() => '');
        const readPinnedFolderIds = typeof deps.readPinnedFolderIds === 'function'
            ? deps.readPinnedFolderIds
            : ((prefs = {}) => Array.isArray(prefs?.pinnedFolderIds) ? prefs.pinnedFolderIds : []);
        const isFolderLocked = typeof deps.isFolderLocked === 'function' ? deps.isFolderLocked : (() => false);
        const createFolderBtn = typeof deps.createFolderBtn === 'function' ? deps.createFolderBtn : (() => {});
        const editFolder = typeof deps.editFolder === 'function' ? deps.editFolder : (() => {});
        const actionFolder = typeof deps.actionFolder === 'function' ? deps.actionFolder : (() => {});
        const updateFolder = typeof deps.updateFolder === 'function' ? deps.updateFolder : (() => {});
        const forceUpdateFolder = typeof deps.forceUpdateFolder === 'function' ? deps.forceUpdateFolder : (() => {});
        const openFolderWebuisFromMenu = typeof deps.openFolderWebuisFromMenu === 'function'
            ? deps.openFolderWebuisFromMenu
            : (() => {});
        const openWebuiInNewTab = typeof deps.openWebuiInNewTab === 'function' ? deps.openWebuiInNewTab : (() => false);
        const openWebuiPopupWindow = typeof deps.openWebuiPopupWindow === 'function' ? deps.openWebuiPopupWindow : (() => false);
        const openTerminal = typeof deps.openTerminal === 'function' ? deps.openTerminal : (() => {});
        const toggleFolderPin = typeof deps.toggleFolderPin === 'function' ? deps.toggleFolderPin : (() => Promise.resolve());
        const toggleFolderLock = typeof deps.toggleFolderLock === 'function' ? deps.toggleFolderLock : (() => {});
        const queueLoadlistRefresh = typeof deps.queueLoadlistRefresh === 'function'
            ? deps.queueLoadlistRefresh
            : (() => {});
        const appendDockerPreviewActionButtons = typeof deps.appendDockerPreviewActionButtons === 'function'
            ? deps.appendDockerPreviewActionButtons
            : (() => {});

        let rootNode = null;
        let clickHandler = null;
        let renderToken = 0;
        let latestSnapshot = null;

        const getHostTable = () => doc?.querySelector('table#docker_containers') || null;
        const isFolderToken = (value) => String(value || '').trim().startsWith('folder-');
        const folderIdFromToken = (value) => String(value || '').trim().replace(/^folder-/, '');

        const setHostTableHidden = (hidden) => {
            const table = getHostTable();
            if (!(table instanceof HTMLElement)) {
                return;
            }
            if (hidden) {
                table.dataset.fvplusCommandPrevDisplay = table.style.display || '';
                table.style.display = 'none';
                return;
            }
            table.style.display = String(table.dataset.fvplusCommandPrevDisplay || '');
            delete table.dataset.fvplusCommandPrevDisplay;
        };

        const setMounted = (mounted) => {
            if (!(doc?.body instanceof HTMLElement)) {
                return;
            }
            if (mounted) {
                doc.body.setAttribute(BODY_ATTR, 'true');
            } else {
                doc.body.removeAttribute(BODY_ATTR);
            }
        };

        const ensureRoot = () => {
            if (!doc) {
                return null;
            }
            let root = doc.getElementById(ROOT_ID);
            if (root instanceof HTMLElement) {
                rootNode = root;
                return root;
            }
            const table = getHostTable();
            if (!(table instanceof HTMLElement) || !(table.parentNode instanceof HTMLElement)) {
                return null;
            }
            root = doc.createElement('section');
            root.id = ROOT_ID;
            root.className = 'fv-docker-service-map';
            table.parentNode.insertBefore(root, table);
            rootNode = root;
            return root;
        };

        const clearRoot = () => {
            if (clickHandler && rootNode) {
                rootNode.removeEventListener('click', clickHandler);
            }
            clickHandler = null;
            if (rootNode && rootNode.parentNode) {
                rootNode.parentNode.removeChild(rootNode);
            }
            rootNode = null;
        };

        const resolveContainerState = (entry = {}) => {
            const running = entry?.state === true || entry?.info?.State?.Running === true;
            const paused = entry?.pause === true || entry?.info?.State?.Paused === true;
            if (running && paused) {
                return 'paused';
            }
            if (running) {
                return 'running';
            }
            return 'stopped';
        };

        const containerHasUpdate = (entry = {}) => (
            entry?.update === true
            || entry?.Updated === true
            || entry?.info?.State?.Updated === true
        );

        const getContainerStateMeta = (entry = {}) => {
            const state = resolveContainerState(entry);
            if (state === 'paused') {
                return { state, label: 'paused', icon: 'fa-pause' };
            }
            if (state === 'running') {
                return { state, label: 'running', icon: 'fa-play' };
            }
            return { state, label: 'stopped', icon: 'fa-stop' };
        };

        const openFolderCardWebuis = (folderCard) => {
            if (!(folderCard instanceof HTMLElement)) {
                return false;
            }
            const urls = Array.from(new Set(
                Array.from(folderCard.querySelectorAll('[data-member-webui-url]'))
                    .map((node) => getSafeWebuiUrl(node.getAttribute('data-member-webui-url') || ''))
                    .filter(Boolean)
            ));
            if (!urls.length) {
                return false;
            }
            const stamp = Date.now();
            urls.forEach((url, index) => {
                if (index === 0) {
                    openWebuiInNewTab(url);
                    return;
                }
                openWebuiPopupWindow(url, `fvw-${stamp}-${index}`);
            });
            return true;
        };

        const getNativeMemberRow = (containerName) => {
            const safeName = String(containerName || '').trim();
            if (!safeName || !doc) {
                return null;
            }
            const sourceRow = doc.getElementById(`ct-${safeName}`);
            if (sourceRow instanceof HTMLElement && sourceRow.classList.contains('sortable')) {
                return sourceRow;
            }
            const rows = doc.querySelectorAll('#docker_list > tr.sortable');
            for (const row of rows) {
                if (!(row instanceof HTMLElement) || row.classList.contains('folder')) {
                    continue;
                }
                const textName = String(row.querySelector('td.ct-name .appname')?.textContent || '').trim();
                if (textName === safeName) {
                    return row;
                }
            }
            return null;
        };

        const getNativeMemberTrigger = (containerName) => {
            const sourceRow = getNativeMemberRow(containerName);
            if (!(sourceRow instanceof HTMLElement)) {
                return null;
            }
            return sourceRow.querySelector('td.ct-name > span.outer > span.hand')
                || sourceRow.querySelector('td.ct-name > span.outer > span.inner > span.appname > a.exec');
        };

        const proxyNativeMemberTrigger = (containerName, eventType = 'click', sourceEvent = null) => {
            const trigger = getNativeMemberTrigger(containerName);
            if (!(trigger instanceof HTMLElement)) {
                return false;
            }
            const safeType = eventType === 'contextmenu' ? 'contextmenu' : 'click';
            const clientX = Number(sourceEvent?.clientX || 0);
            const clientY = Number(sourceEvent?.clientY || 0);
            const screenX = Number(sourceEvent?.screenX || clientX || 0);
            const screenY = Number(sourceEvent?.screenY || clientY || 0);
            const pageX = Number(sourceEvent?.pageX || clientX || 0);
            const pageY = Number(sourceEvent?.pageY || clientY || 0);
            if (typeof jq === 'function') {
                try {
                    const jqEvent = jq.Event(safeType, {
                        bubbles: true,
                        cancelable: true,
                        clientX,
                        clientY,
                        screenX,
                        screenY,
                        pageX,
                        pageY,
                        button: safeType === 'contextmenu' ? 2 : 0,
                        which: safeType === 'contextmenu' ? 3 : 1
                    });
                    jq(trigger).trigger(jqEvent);
                    return true;
                } catch (_error) {
                    // Fall through to native DOM dispatch.
                }
            }
            if (safeType === 'click' && typeof trigger.click === 'function') {
                try {
                    trigger.click();
                    return true;
                } catch (_error) {
                    // Fall through to synthetic DOM dispatch.
                }
            }
            const event = new MouseEvent(safeType, {
                bubbles: true,
                cancelable: true,
                view: win || undefined,
                button: safeType === 'contextmenu' ? 2 : 0,
                buttons: safeType === 'contextmenu' ? 2 : 1,
                clientX,
                clientY,
                screenX,
                screenY
            });
            try {
                return trigger.dispatchEvent(event);
            } catch (_error) {
                return false;
            }
        };

        const hydrateNativeMemberSurface = (surface, containerName) => {
            if (!(surface instanceof HTMLElement)) {
                return;
            }
            const safeName = String(containerName || '').trim();
            if (!safeName) {
                return;
            }
            const trigger = getNativeMemberTrigger(safeName);
            surface.classList.add('hand');
            surface.setAttribute('role', 'button');
            surface.setAttribute('tabindex', '0');
            const title = trigger instanceof HTMLElement ? String(trigger.getAttribute('title') || '').trim() : '';
            if (title) {
                surface.setAttribute('title', title);
            }
            surface.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                proxyNativeMemberTrigger(safeName, 'click', event);
            });
            surface.addEventListener('contextmenu', (event) => {
                event.preventDefault();
                event.stopPropagation();
                proxyNativeMemberTrigger(safeName, 'contextmenu', event);
            });
            surface.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') {
                    return;
                }
                event.preventDefault();
                event.stopPropagation();
                proxyNativeMemberTrigger(safeName, 'click', event);
            });
        };

        const computeOrderedFolderIds = (folders, prefs, hostOrder, unraidOrder) => {
            const folderMap = folders && typeof folders === 'object' ? folders : {};
            const baseOrder = reorderFolderSlotsInBaseOrder(unraidOrder, folderMap, prefs);
            const order = Array.isArray(hostOrder) && hostOrder.length ? hostOrder.slice() : baseOrder.slice();
            const newOnes = order.filter((entry) => !baseOrder.includes(entry));
            for (let index = 0; index < baseOrder.length; index += 1) {
                const entry = baseOrder[index];
                if (!isFolderToken(entry)) {
                    continue;
                }
                const folderId = folderIdFromToken(entry);
                if (!Object.prototype.hasOwnProperty.call(folderMap, folderId)) {
                    continue;
                }
                order.splice(index + newOnes.length, 0, entry);
            }
            const ids = [];
            const seen = new Set();
            order.forEach((entry) => {
                if (!isFolderToken(entry)) {
                    return;
                }
                const folderId = folderIdFromToken(entry);
                if (!Object.prototype.hasOwnProperty.call(folderMap, folderId) || seen.has(folderId)) {
                    return;
                }
                seen.add(folderId);
                ids.push(folderId);
            });
            Object.keys(getPrefsOrderedFolderMap(folderMap, prefs)).forEach((folderId) => {
                if (!seen.has(folderId)) {
                    seen.add(folderId);
                    ids.push(folderId);
                }
            });
            return ids;
        };

        const buildFolderCards = (snapshot) => snapshot.orderedFolderIds.map((folderId) => {
            const folder = snapshot.folders[folderId] || {};
            const branchContainers = getScopedRuntimeContainersForFolder(folderId, true) || {};
            const members = Object.entries(branchContainers).map(([name, entry]) => ({
                name,
                id: String(entry?.id || entry?.shortId || '').trim(),
                icon: sanitizeImageSrc(entry?.icon || DOCKER_ICON_FALLBACK, DOCKER_ICON_FALLBACK),
                webuiUrl: getSafeWebuiUrl(entry?.webui || entry?.info?.State?.WebUi || entry?.info?.State?.TSWebUi || ''),
                shell: String(entry?.shell || entry?.info?.Shell || '/bin/sh').trim() || '/bin/sh',
                project: String(
                    entry?.project
                    || entry?.info?.Labels?.['com.docker.compose.project']
                    || entry?.info?.Config?.Labels?.['com.docker.compose.project']
                    || entry?.info?.ComposeProject
                    || ''
                ).trim(),
                network: String(
                    entry?.network
                    || entry?.info?.NetworkMode
                    || entry?.info?.HostConfig?.NetworkMode
                    || entry?.info?.State?.Network
                    || ''
                ).trim(),
                stateMeta: getContainerStateMeta(entry),
                updateReady: containerHasUpdate(entry),
                managed: entry?.managed === true || entry?.manager === 'dockerman'
            })).sort((left, right) => left.name.localeCompare(right.name));
            const actionCounts = summarizeFolderActionCounts(branchContainers);
            const directMatches = snapshot.matchCache[folderId] || {};
            const directMemberNames = Array.from(
                new Set(['explicit', 'regex', 'label', 'rules'].flatMap((key) => Array.isArray(directMatches[key]) ? directMatches[key] : []))
            );
            let running = 0;
            let paused = 0;
            let stopped = 0;
            let updates = 0;
            members.forEach((member) => {
                if (member.stateMeta.state === 'running') {
                    running += 1;
                } else if (member.stateMeta.state === 'paused') {
                    paused += 1;
                } else {
                    stopped += 1;
                }
                if (member.updateReady) {
                    updates += 1;
                }
            });
            return {
                folderId,
                folder,
                depth: Number(snapshot.depthById[folderId] || 0),
                childCount: Array.isArray(snapshot.hierarchy.childrenById?.[folderId]) ? snapshot.hierarchy.childrenById[folderId].length : 0,
                directMemberCount: directMemberNames.length,
                branchMemberCount: members.length,
                members,
                running,
                paused,
                stopped,
                updates,
                actionCounts,
                pinned: readPinnedFolderIds(snapshot.prefs).includes(folderId),
                locked: isFolderLocked(folderId) === true
            };
        });

        const renderLoading = () => {
            const root = ensureRoot();
            if (!(root instanceof HTMLElement)) {
                return;
            }
            root.innerHTML = '<div class="fv-docker-service-map-shell is-loading"><div class="fv-docker-service-map-loading"><i class="fa fa-circle-o-notch fa-spin" aria-hidden="true"></i><span>Loading Docker service map...</span></div></div>';
        };

        const renderError = (message) => {
            const root = ensureRoot();
            if (!(root instanceof HTMLElement)) {
                return;
            }
            root.innerHTML = `<div class="fv-docker-service-map-shell"><div class="fv-docker-service-map-empty"><h3>Service map failed to load</h3><p>${escapeHtml(message || 'Unknown error.')}</p><button type="button" class="fv-docker-service-map-button is-primary" data-fv-service-action="refresh">Retry</button></div></div>`;
        };

        const renderSnapshot = (snapshot) => {
            const root = ensureRoot();
            if (!(root instanceof HTMLElement)) {
                return false;
            }
            latestSnapshot = snapshot;
            const cards = buildFolderCards(snapshot);
            const runtimeEntries = Object.values(snapshot.runtimeInfoByName || {});
            const activeFolders = cards.filter((card) => card.running > 0).length;
            const cardsWithUpdates = cards.filter((card) => card.updates > 0).length;
            const pinnedFolders = cards.filter((card) => card.pinned).length;
            const lockedFolders = cards.filter((card) => card.locked).length;
            const containerCount = runtimeEntries.length;
            const runningContainers = runtimeEntries.filter((entry) => resolveContainerState(entry) === 'running').length;
            const pausedContainers = runtimeEntries.filter((entry) => resolveContainerState(entry) === 'paused').length;
            const stoppedContainers = runtimeEntries.filter((entry) => resolveContainerState(entry) === 'stopped').length;
            const updatedContainers = runtimeEntries.filter((entry) => containerHasUpdate(entry)).length;
            root.innerHTML = `
                <div class="fv-docker-service-map-shell">
                    <div class="fv-docker-service-map-header">
                        <div class="fv-docker-service-map-header-copy">
                            <h2>Docker Service Map</h2>
                            <p>Relationship view using folder membership, compose projects, and Docker network hints from the live runtime payload.</p>
                        </div>
                        <div class="fv-docker-service-map-toolbar">
                            <button type="button" class="fv-docker-service-map-button is-primary" data-fv-service-action="refresh">Refresh</button>
                            <button type="button" class="fv-docker-service-map-button is-primary" data-fv-service-action="create-folder">Add Folder</button>
                        </div>
                    </div>
                    <div class="fv-docker-service-map-overview">
                        <div class="fv-docker-service-map-overview-card"><span class="fv-docker-service-map-overview-value">${cards.length}</span><span class="fv-docker-service-map-overview-label">folders</span></div>
                        <div class="fv-docker-service-map-overview-card"><span class="fv-docker-service-map-overview-value">${activeFolders}</span><span class="fv-docker-service-map-overview-label">active folders</span></div>
                        <div class="fv-docker-service-map-overview-card"><span class="fv-docker-service-map-overview-value">${containerCount}</span><span class="fv-docker-service-map-overview-label">containers</span></div>
                        <div class="fv-docker-service-map-overview-card"><span class="fv-docker-service-map-overview-value">${runningContainers}</span><span class="fv-docker-service-map-overview-label">running</span></div>
                        <div class="fv-docker-service-map-overview-card"><span class="fv-docker-service-map-overview-value">${pausedContainers}</span><span class="fv-docker-service-map-overview-label">paused</span></div>
                        <div class="fv-docker-service-map-overview-card"><span class="fv-docker-service-map-overview-value">${stoppedContainers}</span><span class="fv-docker-service-map-overview-label">stopped</span></div>
                        <div class="fv-docker-service-map-overview-card"><span class="fv-docker-service-map-overview-value">${cardsWithUpdates}</span><span class="fv-docker-service-map-overview-label">with updates</span></div>
                        <div class="fv-docker-service-map-overview-card"><span class="fv-docker-service-map-overview-value">${updatedContainers}</span><span class="fv-docker-service-map-overview-label">update ready</span></div>
                        <div class="fv-docker-service-map-overview-card"><span class="fv-docker-service-map-overview-value">${pinnedFolders}</span><span class="fv-docker-service-map-overview-label">pinned</span></div>
                        <div class="fv-docker-service-map-overview-card"><span class="fv-docker-service-map-overview-value">${lockedFolders}</span><span class="fv-docker-service-map-overview-label">locked</span></div>
                    </div>
                    <div class="fv-docker-service-map-stack">
                        ${cards.length ? cards.map((card) => {
                            const subtitle = [
                                `${card.directMemberCount} direct`,
                                `${card.branchMemberCount} in branch`,
                                card.childCount > 0 ? `${card.childCount} child folders` : ''
                            ].filter(Boolean).join(' • ');
                            const folderIcon = sanitizeImageSrc(card.folder?.icon, DEFAULT_FOLDER_ICON);
                            const relatedProjects = Array.from(new Set(card.members.map((member) => member.project).filter(Boolean))).slice(0, 3);
                            const relatedNetworks = Array.from(new Set(card.members.map((member) => member.network).filter(Boolean))).slice(0, 3);
                            const relationChips = [
                                `${card.directMemberCount} direct`,
                                `${card.branchMemberCount} in branch`,
                                ...relatedProjects.map((project) => `Project: ${project}`),
                                ...relatedNetworks.map((network) => `Network: ${network}`)
                            ];
                            const memberTiles = card.members.map((member) => `
                                <div class="fv-docker-service-map-member fv-docker-service-map-member-tile ${escapeHtml(member.stateMeta.state)}${member.updateReady ? ' has-update' : ''}" data-member-name="${escapeHtml(member.name)}" data-member-id="${escapeHtml(member.id)}" data-member-webui-url="${escapeHtml(member.webuiUrl)}" data-member-shell="${escapeHtml(member.shell)}">
                                    <span class="fv-docker-service-map-member-line" aria-hidden="true"></span>
                                    <div class="fv-docker-service-map-member-surface hand" data-fv-service-member-surface="true" data-member-name="${escapeHtml(member.name)}">
                                        <span class="fv-docker-service-map-member-icon-wrap">
                                            <img src="${member.icon}" class="fv-docker-service-map-member-icon" alt="" loading="lazy" onerror='this.src="${DOCKER_ICON_FALLBACK}"'>
                                        </span>
                                        <span class="fv-docker-service-map-member-content">
                                            <span class="fv-docker-service-map-member-pill">${escapeHtml(member.name)}</span>
                                            <span class="fv-docker-service-map-member-meta">
                                                <span class="fv-docker-service-map-member-state ${escapeHtml(member.stateMeta.state)}">
                                                    <i class="fa ${escapeHtml(member.stateMeta.icon)}" aria-hidden="true"></i>
                                                    <span>${escapeHtml(member.stateMeta.label)}</span>
                                                </span>
                                                ${member.updateReady ? '<span class="fv-docker-service-map-member-update">update ready</span>' : ''}
                                            </span>
                                            <span class="fv-docker-service-map-member-tags">
                                                ${member.project ? `<span class="fv-docker-service-map-member-tag"><i class="fa fa-cubes" aria-hidden="true"></i> ${escapeHtml(member.project)}</span>` : ''}
                                                ${member.network ? `<span class="fv-docker-service-map-member-tag"><i class="fa fa-random" aria-hidden="true"></i> ${escapeHtml(member.network)}</span>` : ''}
                                            </span>
                                        </span>
                                    </div>
                                    <span class="fv-docker-service-map-member-actions fv-preview-actions-compact" data-fv-service-member-actions-host="true" data-member-name="${escapeHtml(member.name)}" data-member-webui-url="${escapeHtml(member.webuiUrl)}" data-member-shell="${escapeHtml(member.shell)}"></span>
                                </div>
                            `).join('');
                            return `
                                <article class="fv-docker-service-map-card" data-folder-id="${escapeHtml(card.folderId)}" style="--fv-docker-service-map-depth:${card.depth};">
                                    <div class="fv-docker-service-map-card-head">
                                        <div>
                                            <div class="fv-docker-service-map-card-title"><img src="${folderIcon}" class="fv-docker-service-map-card-title-icon" alt="" loading="lazy" onerror='this.src="${DEFAULT_FOLDER_ICON}"'> ${escapeHtml(card.folder?.name || `Folder ${card.folderId}`)}</div>
                                            <div class="fv-docker-service-map-card-subtitle">${escapeHtml(subtitle)}</div>
                                        </div>
                                        <div class="fv-docker-service-map-card-flags">
                                            ${card.pinned ? '<span class="fv-docker-service-map-flag pinned"><i class="fa fa-star"></i> pinned</span>' : ''}
                                            ${card.locked ? '<span class="fv-docker-service-map-flag locked"><i class="fa fa-lock"></i> locked</span>' : ''}
                                            ${card.childCount > 0 ? '<span class="fv-docker-service-map-flag branch"><i class="fa fa-sitemap"></i> branch</span>' : ''}
                                        </div>
                                    </div>
                                    <div class="fv-docker-service-map-stats">
                                        <span class="fv-docker-service-map-stat running"><i class="fa fa-play"></i> ${card.running} running</span>
                                        <span class="fv-docker-service-map-stat paused"><i class="fa fa-pause"></i> ${card.paused} paused</span>
                                        <span class="fv-docker-service-map-stat stopped"><i class="fa fa-stop"></i> ${card.stopped} stopped</span>
                                        <span class="fv-docker-service-map-stat update"><i class="fa fa-cloud-download"></i> ${card.updates} updates</span>
                                    </div>
                                    <div class="fv-docker-service-map-graph">
                                        <div class="fv-docker-service-map-hub">
                                            <div class="fv-docker-service-map-hub-node">
                                                <img src="${folderIcon}" class="fv-docker-service-map-hub-icon" alt="" loading="lazy" onerror='this.src="${DEFAULT_FOLDER_ICON}"'>
                                                <span class="fv-docker-service-map-hub-label">${escapeHtml(card.folder?.name || `Folder ${card.folderId}`)}</span>
                                                <span class="fv-docker-service-map-card-subtitle">${escapeHtml(subtitle)}</span>
                                                <div class="fv-docker-service-map-relations">
                                                    ${relationChips.map((label) => `<span class="fv-docker-service-map-relation">${escapeHtml(label)}</span>`).join('')}
                                                </div>
                                            </div>
                                        </div>
                                        <div class="fv-docker-service-map-members">
                                            ${memberTiles || '<span class="fv-docker-service-map-member-empty">No containers matched this folder yet.</span>'}
                                        </div>
                                    </div>
                                    <div class="fv-docker-service-map-actions">
                                        <button type="button" class="fv-docker-service-map-button" data-fv-service-action="start-branch">Start branch</button>
                                        <button type="button" class="fv-docker-service-map-button" data-fv-service-action="stop-branch">Stop branch</button>
                                        <button type="button" class="fv-docker-service-map-button" data-fv-service-action="${card.actionCounts.updateReady > 0 ? 'update-branch' : 'force-update-branch'}">${card.actionCounts.updateReady > 0 ? 'Update branch' : 'Force update'}</button>
                                        <button type="button" class="fv-docker-service-map-button" data-fv-service-action="open-webui">Open WebUIs</button>
                                        <button type="button" class="fv-docker-service-map-button" data-fv-service-action="edit-folder">Edit</button>
                                        <button type="button" class="fv-docker-service-map-button" data-fv-service-action="toggle-pin">${card.pinned ? 'Unpin' : 'Pin'}</button>
                                        <button type="button" class="fv-docker-service-map-button" data-fv-service-action="toggle-lock">${card.locked ? 'Unlock' : 'Lock'}</button>
                                    </div>
                                </article>
                            `;
                        }).join('') : `
                            <div class="fv-docker-service-map-empty">
                                <h3>No Docker folders yet</h3>
                                <p>Create a folder to start testing the command view.</p>
                                <button type="button" class="fv-docker-service-map-button is-primary" data-fv-service-action="create-folder">Add Folder</button>
                            </div>
                        `}
                    </div>
                </div>
            `;
            root.querySelectorAll('[data-fv-service-member-surface="true"]').forEach((surface) => {
                if (!(surface instanceof HTMLElement)) {
                    return;
                }
                hydrateNativeMemberSurface(surface, String(surface.getAttribute('data-member-name') || '').trim());
            });
            if (typeof jq === 'function') {
                root.querySelectorAll('[data-fv-service-member-actions-host="true"]').forEach((host) => {
                    if (!(host instanceof HTMLElement)) {
                        return;
                    }
                    const memberName = String(host.getAttribute('data-member-name') || '').trim();
                    const memberWebuiUrl = String(host.getAttribute('data-member-webui-url') || '').trim();
                    const memberShell = String(host.getAttribute('data-member-shell') || '').trim() || '/bin/sh';
                    if (!memberName) {
                        return;
                    }
                    appendDockerPreviewActionButtons(
                        jq(host),
                        {
                            preview_webui: Boolean(memberWebuiUrl),
                            preview_console: true,
                            preview_logs: true
                        },
                        memberName,
                        memberShell,
                        memberWebuiUrl
                    );
                });
            }
            return true;
        };

        const bindEvents = () => {
            if (!(rootNode instanceof HTMLElement)) {
                return;
            }
            if (clickHandler) {
                rootNode.removeEventListener('click', clickHandler);
            }
            clickHandler = (event) => {
                const button = event.target instanceof Element
                    ? event.target.closest('[data-fv-service-action]')
                    : null;
                if (!(button instanceof HTMLElement)) {
                    return;
                }
                event.preventDefault();
                const action = String(button.getAttribute('data-fv-service-action') || '').trim();
                const folderCard = button.closest('[data-folder-id]');
                const folderId = folderCard instanceof HTMLElement ? String(folderCard.getAttribute('data-folder-id') || '').trim() : '';
                const rerender = () => Promise.resolve().then(() => mount({ suppressLoadingUi: true, forceRefresh: true, reason: action }));
                if (action === 'refresh') {
                    void rerender();
                    return;
                }
                if (action === 'create-folder') {
                    createFolderBtn();
                    return;
                }
                if (!folderId) {
                    return;
                }
                if (action === 'start-branch') {
                    actionFolder(folderId, 'start', { includeDescendants: true });
                    return;
                }
                if (action === 'stop-branch') {
                    actionFolder(folderId, 'stop', { includeDescendants: true });
                    return;
                }
                if (action === 'update-branch') {
                    updateFolder(folderId, { includeDescendants: true });
                    return;
                }
                if (action === 'force-update-branch') {
                    forceUpdateFolder(folderId, { includeDescendants: true });
                    return;
                }
                if (action === 'open-webui') {
                    if (!openFolderCardWebuis(folderCard)) {
                        openFolderWebuisFromMenu(folderId, true, true);
                    }
                    return;
                }
                if (action === 'edit-folder') {
                    editFolder(folderId);
                    return;
                }
                if (action === 'toggle-pin') {
                    Promise.resolve(toggleFolderPin(folderId)).finally(() => {
                        void rerender();
                    });
                    return;
                }
                if (action === 'toggle-lock') {
                    toggleFolderLock(folderId);
                    void rerender();
                    return;
                }
                if (action === 'use-host-list') {
                    queueLoadlistRefresh({ suppressLoadingUi: true });
                }
            };
            rootNode.addEventListener('click', clickHandler);
        };

        const resolveSnapshot = async (options = {}) => {
            const requestBundle = resolveRequestBundle(options);
            if (!requestBundle || !Array.isArray(requestBundle.render) || requestBundle.render.length < 4) {
                throw new Error('Docker service-map request bundle is unavailable.');
            }
            const [foldersPayload, orderPayload, statePayload, prefsPayload] = await Promise.all(requestBundle.render);
            const folders = parseJsonPayloadSafe(foldersPayload);
            const unraidOrder = Object.values(parseJsonPayloadSafe(orderPayload));
            const runtimeState = parseJsonPayloadSafe(statePayload);
            let runtimeInfoByName = normalizeRuntimeInfoMap(runtimeState);
            if (requestBundle.fullInfo) {
                try {
                    const runtimeFull = parseJsonPayloadSafe(await requestBundle.fullInfo);
                    runtimeInfoByName = normalizeRuntimeInfoMap(runtimeFull, runtimeInfoByName);
                } catch (_error) {
                    // The staged full-info hydration is optional for the experimental surface.
                }
            }
            const prefsResponse = parseJsonPayloadSafe(prefsPayload);
            const prefs = normalizePrefs(prefsResponse?.prefs || {});
            const hierarchy = buildFolderHierarchy(folders);
            const depthById = buildFolderDepthById(folders);
            const hostOrder = readDockerHostOrderFromDom();
            const matchOrder = hostOrder.length ? hostOrder.slice() : unraidOrder.slice();
            const matchCache = buildFolderMatchCache(matchOrder, runtimeInfoByName, folders, prefs);
            const snapshot = {
                generation: Number(requestBundle.generation || 0),
                folders,
                hierarchy,
                depthById,
                prefs,
                matchCache,
                orderedFolderIds: computeOrderedFolderIds(folders, prefs, hostOrder, unraidOrder),
                runtimeInfoByName,
                stateSignature: buildStateSignature(runtimeState, true)
            };
            setRuntimeState(snapshot);
            return snapshot;
        };

        const mount = async (options = {}) => {
            const token = ++renderToken;
            setHostTableHidden(true);
            setMounted(true);
            renderLoading();
            try {
                const snapshot = await resolveSnapshot(options);
                if (token !== renderToken) {
                    return { ok: false, stale: true };
                }
                const rendered = renderSnapshot(snapshot);
                bindEvents();
                return { ok: rendered, snapshot };
            } catch (error) {
                if (token !== renderToken) {
                    return { ok: false, stale: true };
                }
                renderError(error instanceof Error ? error.message : 'Unknown service-map error.');
                bindEvents();
                return { ok: false, error };
            }
        };

        const unmount = () => {
            renderToken += 1;
            clearRoot();
            setHostTableHidden(false);
            setMounted(false);
        };

        return Object.freeze({
            mount,
            unmount
        });
    };

    return Object.freeze({
        createApi
    });
}));
