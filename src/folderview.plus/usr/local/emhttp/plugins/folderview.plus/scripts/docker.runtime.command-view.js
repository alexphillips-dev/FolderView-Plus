// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusDockerCommandView = factory();
    root.FolderViewPlusDockerCommandViewModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const fallbackWindow = typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : null);
    const ROOT_ID = 'fvplus-docker-command-view-root';
    const BODY_ATTR = 'data-fvplus-docker-command-view-mounted';

    const createApi = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        const doc = deps.document || win?.document || (typeof document !== 'undefined' ? document : null);
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
        const normalizeRuntimeInfoMap = typeof deps.normalizeDockerRuntimeInfoMap === 'function'
            ? deps.normalizeDockerRuntimeInfoMap
            : ((value) => (value && typeof value === 'object' ? value : {}));
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
        const toggleFolderPin = typeof deps.toggleFolderPin === 'function' ? deps.toggleFolderPin : (() => Promise.resolve());
        const toggleFolderLock = typeof deps.toggleFolderLock === 'function' ? deps.toggleFolderLock : (() => {});
        const queueLoadlistRefresh = typeof deps.queueLoadlistRefresh === 'function'
            ? deps.queueLoadlistRefresh
            : (() => {});

        let rootNode = null;
        let clickHandler = null;
        let renderToken = 0;

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
            root.className = 'fv-docker-command-view';
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
                state: resolveContainerState(entry),
                updateReady: containerHasUpdate(entry)
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
                if (member.state === 'running') {
                    running += 1;
                } else if (member.state === 'paused') {
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
            root.innerHTML = '<div class="fv-docker-command-shell is-loading"><div class="fv-docker-command-loading"><i class="fa fa-circle-o-notch fa-spin" aria-hidden="true"></i><span>Loading Docker command view...</span></div></div>';
        };

        const renderError = (message) => {
            const root = ensureRoot();
            if (!(root instanceof HTMLElement)) {
                return;
            }
            root.innerHTML = `<div class="fv-docker-command-shell"><div class="fv-docker-command-empty"><h3>Command view failed to load</h3><p>${escapeHtml(message || 'Unknown error.')}</p><button type="button" class="fv-docker-command-button is-primary" data-fv-command-action="refresh">Retry</button></div></div>`;
        };

        const renderSnapshot = (snapshot) => {
            const root = ensureRoot();
            if (!(root instanceof HTMLElement)) {
                return false;
            }
            const cards = buildFolderCards(snapshot);
            const activeFolders = cards.filter((card) => card.running > 0).length;
            const cardsWithUpdates = cards.filter((card) => card.updates > 0).length;
            const pinnedFolders = cards.filter((card) => card.pinned).length;
            root.innerHTML = `
                <div class="fv-docker-command-shell">
                    <div class="fv-docker-command-header">
                        <div class="fv-docker-command-header-copy">
                            <div class="fv-docker-command-kicker">Experimental</div>
                            <h2>Docker Command View</h2>
                            <p>Isolated test surface for folder actions. The existing FolderView and host-list modes stay untouched behind the page-view selector.</p>
                        </div>
                        <div class="fv-docker-command-toolbar">
                            <button type="button" class="fv-docker-command-button is-primary" data-fv-command-action="refresh">Refresh</button>
                            <button type="button" class="fv-docker-command-button is-primary" data-fv-command-action="create-folder">Add Folder</button>
                        </div>
                    </div>
                    <div class="fv-docker-command-overview">
                        <div class="fv-docker-command-overview-card"><span class="fv-docker-command-overview-value">${cards.length}</span><span class="fv-docker-command-overview-label">folders</span></div>
                        <div class="fv-docker-command-overview-card"><span class="fv-docker-command-overview-value">${activeFolders}</span><span class="fv-docker-command-overview-label">active folders</span></div>
                        <div class="fv-docker-command-overview-card"><span class="fv-docker-command-overview-value">${cardsWithUpdates}</span><span class="fv-docker-command-overview-label">with updates</span></div>
                        <div class="fv-docker-command-overview-card"><span class="fv-docker-command-overview-value">${pinnedFolders}</span><span class="fv-docker-command-overview-label">pinned</span></div>
                    </div>
                    <div class="fv-docker-command-stack">
                        ${cards.length ? cards.map((card) => {
                            const subtitle = [
                                `${card.directMemberCount} direct`,
                                `${card.branchMemberCount} in branch`,
                                card.childCount > 0 ? `${card.childCount} child folders` : ''
                            ].filter(Boolean).join(' • ');
                            const memberChips = card.members.slice(0, 6).map((member) => `
                                <span class="fv-docker-command-member ${escapeHtml(member.state)}">
                                    <span class="fv-docker-command-member-name">${escapeHtml(member.name)}</span>
                                    ${member.updateReady ? '<span class="fv-docker-command-member-update">update</span>' : ''}
                                </span>
                            `).join('');
                            const hiddenCount = Math.max(0, card.members.length - 6);
                            return `
                                <article class="fv-docker-command-card" data-folder-id="${escapeHtml(card.folderId)}" style="--fv-docker-command-depth:${card.depth};">
                                    <div class="fv-docker-command-card-head">
                                        <div>
                                            <div class="fv-docker-command-card-title"><i class="fa fa-folder-open" aria-hidden="true"></i> ${escapeHtml(card.folder?.name || `Folder ${card.folderId}`)}</div>
                                            <div class="fv-docker-command-card-subtitle">${escapeHtml(subtitle)}</div>
                                        </div>
                                        <div class="fv-docker-command-card-flags">
                                            ${card.pinned ? '<span class="fv-docker-command-flag pinned"><i class="fa fa-star"></i> pinned</span>' : ''}
                                            ${card.locked ? '<span class="fv-docker-command-flag locked"><i class="fa fa-lock"></i> locked</span>' : ''}
                                            ${card.childCount > 0 ? '<span class="fv-docker-command-flag branch"><i class="fa fa-sitemap"></i> branch</span>' : ''}
                                        </div>
                                    </div>
                                    <div class="fv-docker-command-stats">
                                        <span class="fv-docker-command-stat running"><i class="fa fa-play"></i> ${card.running} running</span>
                                        <span class="fv-docker-command-stat paused"><i class="fa fa-pause"></i> ${card.paused} paused</span>
                                        <span class="fv-docker-command-stat stopped"><i class="fa fa-stop"></i> ${card.stopped} stopped</span>
                                        <span class="fv-docker-command-stat update"><i class="fa fa-cloud-download"></i> ${card.updates} updates</span>
                                    </div>
                                    <div class="fv-docker-command-members">
                                        ${memberChips}${hiddenCount > 0 ? `<span class="fv-docker-command-member more">+${hiddenCount} more</span>` : ''}
                                    </div>
                                    <div class="fv-docker-command-actions">
                                        <button type="button" class="fv-docker-command-button" data-fv-command-action="start-branch">Start branch</button>
                                        <button type="button" class="fv-docker-command-button" data-fv-command-action="stop-branch">Stop branch</button>
                                        <button type="button" class="fv-docker-command-button" data-fv-command-action="${card.actionCounts.updateReady > 0 ? 'update-branch' : 'force-update-branch'}">${card.actionCounts.updateReady > 0 ? 'Update branch' : 'Force update'}</button>
                                        <button type="button" class="fv-docker-command-button" data-fv-command-action="open-webui">Open WebUIs</button>
                                        <button type="button" class="fv-docker-command-button" data-fv-command-action="edit-folder">Edit</button>
                                        <button type="button" class="fv-docker-command-button" data-fv-command-action="toggle-pin">${card.pinned ? 'Unpin' : 'Pin'}</button>
                                        <button type="button" class="fv-docker-command-button" data-fv-command-action="toggle-lock">${card.locked ? 'Unlock' : 'Lock'}</button>
                                    </div>
                                </article>
                            `;
                        }).join('') : `
                            <div class="fv-docker-command-empty">
                                <h3>No Docker folders yet</h3>
                                <p>Create a folder to start testing the command view.</p>
                                <button type="button" class="fv-docker-command-button is-primary" data-fv-command-action="create-folder">Add Folder</button>
                            </div>
                        `}
                    </div>
                </div>
            `;
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
                    ? event.target.closest('[data-fv-command-action]')
                    : null;
                if (!(button instanceof HTMLElement)) {
                    return;
                }
                event.preventDefault();
                const action = String(button.getAttribute('data-fv-command-action') || '').trim();
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
                    openFolderWebuisFromMenu(folderId, true, true);
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
                throw new Error('Docker command-view request bundle is unavailable.');
            }
            const [foldersPayload, orderPayload, statePayload, prefsPayload] = await Promise.all(requestBundle.render);
            const folders = parseJsonPayloadSafe(foldersPayload);
            const unraidOrder = Object.values(parseJsonPayloadSafe(orderPayload));
            const runtimeState = parseJsonPayloadSafe(statePayload);
            const runtimeInfoByName = normalizeRuntimeInfoMap(runtimeState);
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
                renderError(error instanceof Error ? error.message : 'Unknown command-view error.');
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
