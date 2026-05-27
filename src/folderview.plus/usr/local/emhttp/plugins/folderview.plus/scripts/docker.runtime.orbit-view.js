// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusDockerOrbitView = factory();
    root.FolderViewPlusDockerOrbitViewModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const fallbackWindow = typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : null);
    const ROOT_ID = 'fvplus-docker-orbit-view-root';
    const BODY_ATTR = 'data-fvplus-docker-orbit-view-mounted';
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
        const toggleFolderPin = typeof deps.toggleFolderPin === 'function' ? deps.toggleFolderPin : (() => Promise.resolve());
        const toggleFolderLock = typeof deps.toggleFolderLock === 'function' ? deps.toggleFolderLock : (() => {});
        const appendDockerPreviewActionButtons = typeof deps.appendDockerPreviewActionButtons === 'function'
            ? deps.appendDockerPreviewActionButtons
            : (() => {});

        let rootNode = null;
        let clickHandler = null;
        let contextMenuHandler = null;
        let renderToken = 0;
        let latestSnapshot = null;
        let selectedFolderId = '';
        let selectedMemberName = '';

        const getHostTable = () => doc?.querySelector('table#docker_containers') || null;
        const isFolderToken = (value) => String(value || '').trim().startsWith('folder-');
        const folderIdFromToken = (value) => String(value || '').trim().replace(/^folder-/, '');

        const setHostTableHidden = (hidden) => {
            const table = getHostTable();
            if (!(table instanceof HTMLElement)) {
                return;
            }
            if (hidden) {
                table.dataset.fvplusOrbitPrevDisplay = table.style.display || '';
                table.style.display = 'none';
                return;
            }
            table.style.display = String(table.dataset.fvplusOrbitPrevDisplay || '');
            delete table.dataset.fvplusOrbitPrevDisplay;
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
            root.className = 'fv-docker-orbit-view';
            table.parentNode.insertBefore(root, table);
            rootNode = root;
            return root;
        };

        const clearRoot = () => {
            if (clickHandler && rootNode) {
                rootNode.removeEventListener('click', clickHandler);
            }
            if (contextMenuHandler && rootNode) {
                rootNode.removeEventListener('contextmenu', contextMenuHandler);
            }
            clickHandler = null;
            contextMenuHandler = null;
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

        const getDirectMemberNames = (matchCache, folderId) => Array.from(
            new Set(['explicit', 'regex', 'label', 'rules']
                .flatMap((key) => Array.isArray(matchCache?.[folderId]?.[key]) ? matchCache[folderId][key] : [])
                .map((name) => String(name || '').trim())
                .filter(Boolean))
        );

        const buildMemberModel = (name, entry = {}) => ({
            name,
            id: String(entry?.id || entry?.shortId || '').trim(),
            icon: sanitizeImageSrc(entry?.icon || DOCKER_ICON_FALLBACK, DOCKER_ICON_FALLBACK),
            webuiUrl: getSafeWebuiUrl(entry?.webui || entry?.info?.State?.WebUi || entry?.info?.State?.TSWebUi || ''),
            shell: String(entry?.shell || entry?.info?.Shell || '/bin/sh').trim() || '/bin/sh',
            stateMeta: getContainerStateMeta(entry),
            updateReady: containerHasUpdate(entry),
            managed: entry?.managed === true || entry?.manager === 'dockerman'
        });

        const buildFolderModels = (snapshot) => {
            const models = {};
            snapshot.orderedFolderIds.forEach((folderId) => {
                const folder = snapshot.folders[folderId] || {};
                const directMemberNames = getDirectMemberNames(snapshot.matchCache, folderId);
                const branchContainers = getScopedRuntimeContainersForFolder(folderId, true) || {};
                const directMembers = directMemberNames
                    .map((name) => buildMemberModel(name, snapshot.runtimeInfoByName?.[name] || branchContainers[name] || {}))
                    .sort((left, right) => left.name.localeCompare(right.name));
                const branchMembers = Object.entries(branchContainers)
                    .map(([name, entry]) => buildMemberModel(name, entry))
                    .sort((left, right) => left.name.localeCompare(right.name));
                const childIds = Array.isArray(snapshot.hierarchy.childrenById?.[folderId])
                    ? snapshot.hierarchy.childrenById[folderId].filter((value) => Object.prototype.hasOwnProperty.call(snapshot.folders, value))
                    : [];
                const childFolders = childIds.map((childId) => {
                    const childFolder = snapshot.folders[childId] || {};
                    const branch = getScopedRuntimeContainersForFolder(childId, true) || {};
                    const members = Object.values(branch);
                    const running = members.filter((entry) => resolveContainerState(entry) === 'running').length;
                    const updates = members.filter((entry) => containerHasUpdate(entry)).length;
                    return {
                        folderId: childId,
                        name: String(childFolder?.name || `Folder ${childId}`),
                        icon: sanitizeImageSrc(childFolder?.icon, DEFAULT_FOLDER_ICON),
                        count: Object.keys(branch).length,
                        running,
                        updates,
                        depth: Number(snapshot.depthById[childId] || 0)
                    };
                });
                let running = 0;
                let paused = 0;
                let stopped = 0;
                let updates = 0;
                branchMembers.forEach((member) => {
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
                models[folderId] = {
                    folderId,
                    folder,
                    name: String(folder?.name || `Folder ${folderId}`),
                    icon: sanitizeImageSrc(folder?.icon, DEFAULT_FOLDER_ICON),
                    depth: Number(snapshot.depthById[folderId] || 0),
                    parentId: String(snapshot.hierarchy.parentById?.[folderId] || ''),
                    childIds,
                    childFolders,
                    directMembers,
                    branchMembers,
                    branchMemberCount: branchMembers.length,
                    directMemberCount: directMembers.length,
                    running,
                    paused,
                    stopped,
                    updates,
                    actionCounts: summarizeFolderActionCounts(branchContainers),
                    pinned: readPinnedFolderIds(snapshot.prefs).includes(folderId),
                    locked: isFolderLocked(folderId) === true
                };
            });
            return models;
        };

        const buildBreadcrumbs = (folderId, snapshot, folderModels) => {
            const crumbs = [];
            let cursor = String(folderId || '').trim();
            const guard = new Set();
            while (cursor && !guard.has(cursor)) {
                guard.add(cursor);
                const model = folderModels[cursor];
                const folder = snapshot.folders[cursor] || {};
                crumbs.unshift({
                    folderId: cursor,
                    name: String(model?.name || folder?.name || `Folder ${cursor}`)
                });
                cursor = String(snapshot.hierarchy.parentById?.[cursor] || '');
            }
            return crumbs;
        };

        const layoutOrbitNodes = (items, options = {}) => {
            const safeItems = Array.isArray(items) ? items : [];
            const startRadius = Math.max(110, Number(options.startRadius || 180));
            const ringStep = Math.max(64, Number(options.ringStep || 96));
            const baseCapacity = Math.max(4, Number(options.baseCapacity || 6));
            const capacityStep = Math.max(0, Number(options.capacityStep || 2));
            const angleOffset = Number(options.angleOffset || -90);
            const nodeDiameter = Math.max(80, Number(options.nodeDiameter || 120));
            const nodes = [];
            const rings = [];
            let index = 0;
            let ringIndex = 0;
            while (index < safeItems.length) {
                const capacity = baseCapacity + (ringIndex * capacityStep);
                const count = Math.min(capacity, safeItems.length - index);
                const radius = startRadius + (ringIndex * ringStep);
                rings.push({ radius, count });
                for (let offset = 0; offset < count; offset += 1) {
                    const angle = angleOffset + ((360 / count) * offset) + (ringIndex % 2 === 1 ? (180 / count) : 0);
                    const radians = (angle * Math.PI) / 180;
                    nodes.push(Object.assign({}, safeItems[index + offset], {
                        orbitX: Math.round(Math.cos(radians) * radius),
                        orbitY: Math.round(Math.sin(radians) * radius),
                        orbitRadius: radius,
                        orbitAngle: angle
                    }));
                }
                index += count;
                ringIndex += 1;
            }
            return {
                nodes,
                rings,
                lastRadius: rings.length ? rings[rings.length - 1].radius : Math.max(0, startRadius - ringStep),
                nodeDiameter
            };
        };

        const renderLoading = () => {
            const root = ensureRoot();
            if (!(root instanceof HTMLElement)) {
                return;
            }
            root.innerHTML = '<div class="fv-docker-orbit-shell is-loading"><div class="fv-docker-orbit-loading"><i class="fa fa-circle-o-notch fa-spin" aria-hidden="true"></i><span>Loading Docker orbit view...</span></div></div>';
        };

        const renderError = (message) => {
            const root = ensureRoot();
            if (!(root instanceof HTMLElement)) {
                return;
            }
            root.innerHTML = `<div class="fv-docker-orbit-shell"><div class="fv-docker-orbit-empty"><h3>Orbit view failed to load</h3><p>${escapeHtml(message || 'Unknown error.')}</p><button type="button" class="fv-docker-orbit-button is-primary" data-fv-orbit-action="refresh">Retry</button></div></div>`;
        };

        const renderSnapshot = (snapshot) => {
            const root = ensureRoot();
            if (!(root instanceof HTMLElement)) {
                return false;
            }
            latestSnapshot = snapshot;
            const folderModels = buildFolderModels(snapshot);
            const orderedIds = snapshot.orderedFolderIds.filter((folderId) => Object.prototype.hasOwnProperty.call(folderModels, folderId));
            if (!orderedIds.length) {
                root.innerHTML = `
                    <div class="fv-docker-orbit-shell">
                        <div class="fv-docker-orbit-header">
                            <div class="fv-docker-orbit-header-copy">
                                <h2>Docker Orbit View</h2>
                                <p>A folder hub with orbiting containers and child folders.</p>
                            </div>
                            <div class="fv-docker-orbit-toolbar">
                                <button type="button" class="fv-docker-orbit-button is-primary" data-fv-orbit-action="create-folder">Add Folder</button>
                            </div>
                        </div>
                        <div class="fv-docker-orbit-empty">
                            <h3>No Docker folders yet</h3>
                            <p>Create a folder to start using Orbit view.</p>
                            <button type="button" class="fv-docker-orbit-button is-primary" data-fv-orbit-action="create-folder">Add Folder</button>
                        </div>
                    </div>
                `;
                return true;
            }
            const hasSelectedFolder = Boolean(selectedFolderId && folderModels[selectedFolderId]);
            const selectedFolder = hasSelectedFolder ? folderModels[selectedFolderId] : null;
            const selectedMembers = Array.isArray(selectedFolder?.directMembers) ? selectedFolder.directMembers : [];
            if (!selectedMembers.some((member) => member.name === selectedMemberName)) {
                selectedMemberName = '';
            }
            const selectedMember = selectedMembers.find((member) => member.name === selectedMemberName) || null;
            const breadcrumbs = hasSelectedFolder ? buildBreadcrumbs(selectedFolderId, snapshot, folderModels) : [];
            const relatedFolderIds = (() => {
                if (!selectedFolder) {
                    return orderedIds.filter((folderId) => !folderModels[folderId]?.parentId);
                }
                if (selectedFolder.childIds.length) {
                    return selectedFolder.childIds.slice();
                }
                if (selectedFolder.parentId) {
                    return (snapshot.hierarchy.childrenById?.[selectedFolder.parentId] || [])
                        .filter((folderId) => folderId !== selectedFolderId && Object.prototype.hasOwnProperty.call(folderModels, folderId));
                }
                return orderedIds
                    .filter((folderId) => folderId !== selectedFolderId && !folderModels[folderId]?.parentId);
            })();
            const relatedFolders = relatedFolderIds
                .map((folderId) => folderModels[folderId])
                .filter(Boolean)
                .map((model) => ({
                    folderId: model.folderId,
                    name: model.name,
                    icon: model.icon,
                    count: model.branchMemberCount,
                    running: model.running,
                    updates: model.updates
                }));
            const memberOrbit = layoutOrbitNodes(selectedFolder?.directMembers || [], {
                startRadius: 256,
                ringStep: 132,
                baseCapacity: 8,
                capacityStep: 2
            });
            const relatedFolderOrbit = layoutOrbitNodes(relatedFolders, {
                startRadius: Math.max(memberOrbit.lastRadius + 176, 420),
                ringStep: 148,
                baseCapacity: 10,
                capacityStep: 2
            });
            const stageRadius = Math.max(
                260,
                memberOrbit.lastRadius + (memberOrbit.nodeDiameter / 2),
                relatedFolderOrbit.lastRadius + (relatedFolderOrbit.nodeDiameter / 2)
            );
            const stageSize = Math.max(920, (stageRadius * 2) + 260);
            const ringMarkup = [...memberOrbit.rings, ...relatedFolderOrbit.rings]
                .map((ring) => ring.radius)
                .filter((radius, index, values) => values.indexOf(radius) === index)
                .sort((left, right) => left - right)
                .map((radius) => `<div class="fv-docker-orbit-ring" style="width:${radius * 2}px;height:${radius * 2}px;"></div>`)
                .join('');
            const inspectorBody = selectedMember ? `
                <div class="fv-docker-orbit-inspector-card is-member ${escapeHtml(selectedMember.stateMeta.state)}">
                    <div class="fv-docker-orbit-inspector-head">
                        <img src="${selectedMember.icon}" class="fv-docker-orbit-member-icon" alt="" loading="lazy" onerror='this.src="${DOCKER_ICON_FALLBACK}"'>
                        <div class="fv-docker-orbit-inspector-copy">
                            <div class="fv-docker-orbit-inspector-title fv-docker-orbit-member-name">${escapeHtml(selectedMember.name)}</div>
                            <div class="fv-docker-orbit-inspector-meta">
                                <span class="fv-docker-orbit-pill ${escapeHtml(selectedMember.stateMeta.state)}"><i class="fa ${escapeHtml(selectedMember.stateMeta.icon)}"></i> ${escapeHtml(selectedMember.stateMeta.label)}</span>
                                ${selectedMember.updateReady ? '<span class="fv-docker-orbit-pill update"><i class="fa fa-cloud-download"></i> update ready</span>' : ''}
                            </div>
                        </div>
                    </div>
                    <div class="fv-docker-orbit-inspector-actions" data-fv-orbit-member-actions-host="true" data-member-name="${escapeHtml(selectedMember.name)}" data-member-webui-url="${escapeHtml(selectedMember.webuiUrl)}" data-member-shell="${escapeHtml(selectedMember.shell)}"></div>
                    <div class="fv-docker-orbit-inspector-footer">
                        <button type="button" class="fv-docker-orbit-button" data-fv-orbit-action="native-member-click" data-member-name="${escapeHtml(selectedMember.name)}">Open native controls</button>
                        <button type="button" class="fv-docker-orbit-button" data-fv-orbit-action="clear-member-selection">Back to folder summary</button>
                    </div>
                </div>
            ` : hasSelectedFolder ? `
                <div class="fv-docker-orbit-inspector-card">
                    <div class="fv-docker-orbit-inspector-title">Folder summary</div>
                    <div class="fv-docker-orbit-inspector-list">
                        <div><span>Direct members</span><strong>${selectedFolder?.directMemberCount || 0}</strong></div>
                        <div><span>Branch members</span><strong>${selectedFolder?.branchMemberCount || 0}</strong></div>
                        <div><span>Child folders</span><strong>${selectedFolder?.childIds.length || 0}</strong></div>
                        <div><span>Updates</span><strong>${selectedFolder?.updates || 0}</strong></div>
                    </div>
                    <p class="fv-docker-orbit-inspector-note">Click a container orbit to inspect it, or select a child folder orbit to move deeper into the branch.</p>
                </div>
            ` : `
                <div class="fv-docker-orbit-inspector-card">
                    <div class="fv-docker-orbit-inspector-title">Folder summary</div>
                    <p class="fv-docker-orbit-inspector-note">Select a folder orbit to focus it here. Containers will appear only after a folder is selected.</p>
                </div>
            `;
            root.innerHTML = `
                <div class="fv-docker-orbit-shell">
                    <div class="fv-docker-orbit-header">
                        <div class="fv-docker-orbit-header-copy">
                            <h2>Docker Orbit View</h2>
                            <p>Centered folder control with orbiting containers and related folders for faster branch navigation.</p>
                        </div>
                        <div class="fv-docker-orbit-toolbar">
                            <button type="button" class="fv-docker-orbit-button" data-fv-orbit-action="refresh">Refresh</button>
                            <button type="button" class="fv-docker-orbit-button" data-fv-orbit-action="create-folder">Add Folder</button>
                        </div>
                    </div>
                    <div class="fv-docker-orbit-layout">
                        <section class="fv-docker-orbit-main">
                            ${breadcrumbs.length ? `<div class="fv-docker-orbit-breadcrumbs">
                                ${breadcrumbs.map((crumb, index) => `
                                    <button type="button" class="fv-docker-orbit-crumb${crumb.folderId === selectedFolderId ? ' is-current' : ''}" data-fv-orbit-action="select-folder" data-folder-id="${escapeHtml(crumb.folderId)}">${escapeHtml(crumb.name)}</button>
                                    ${index < breadcrumbs.length - 1 ? '<span class="fv-docker-orbit-crumb-sep">/</span>' : ''}
                                `).join('')}
                            </div>` : ''}
                            <div class="fv-docker-orbit-stage-wrap">
                                <div class="fv-docker-orbit-stage" style="--fv-docker-orbit-stage-size:${stageSize}px;">
                                    <div class="fv-docker-orbit-rings">${ringMarkup}</div>
                                    <article class="fv-docker-orbit-hub${hasSelectedFolder ? '' : ' is-placeholder'}" ${hasSelectedFolder ? `data-folder-id="${escapeHtml(selectedFolderId)}"` : ''}>
                                        <div class="fv-docker-orbit-hub-head">
                                            <img src="${hasSelectedFolder ? selectedFolder.icon : DEFAULT_FOLDER_ICON}" class="fv-docker-orbit-folder-icon" alt="" loading="lazy" onerror='this.src="${DEFAULT_FOLDER_ICON}"'>
                                            <div>
                                                <div class="fv-docker-orbit-folder-title">${escapeHtml(hasSelectedFolder ? selectedFolder.name : 'Select a folder')}</div>
                                                <div class="fv-docker-orbit-folder-meta">${escapeHtml(hasSelectedFolder ? `${selectedFolder.directMemberCount} direct • ${selectedFolder.branchMemberCount} in branch • ${selectedFolder.childIds.length} child folders` : 'Choose a folder from orbit to focus it in the center.')}</div>
                                            </div>
                                        </div>
                                        ${hasSelectedFolder ? `
                                            <div class="fv-docker-orbit-hub-stats">
                                                <span class="fv-docker-orbit-pill running"><i class="fa fa-play"></i> ${selectedFolder.running}</span>
                                                <span class="fv-docker-orbit-pill paused"><i class="fa fa-pause"></i> ${selectedFolder.paused}</span>
                                                <span class="fv-docker-orbit-pill stopped"><i class="fa fa-stop"></i> ${selectedFolder.stopped}</span>
                                                <span class="fv-docker-orbit-pill update"><i class="fa fa-cloud-download"></i> ${selectedFolder.updates}</span>
                                                ${selectedFolder.pinned ? '<span class="fv-docker-orbit-pill pin"><i class="fa fa-star"></i> pinned</span>' : ''}
                                                ${selectedFolder.locked ? '<span class="fv-docker-orbit-pill lock"><i class="fa fa-lock"></i> locked</span>' : ''}
                                            </div>
                                            <div class="fv-docker-orbit-hub-actions">
                                                <button type="button" class="fv-docker-orbit-button" data-fv-orbit-action="start-branch" data-folder-id="${escapeHtml(selectedFolderId)}">Start branch</button>
                                                <button type="button" class="fv-docker-orbit-button" data-fv-orbit-action="stop-branch" data-folder-id="${escapeHtml(selectedFolderId)}">Stop branch</button>
                                                <button type="button" class="fv-docker-orbit-button" data-fv-orbit-action="${selectedFolder.actionCounts.updateReady > 0 ? 'update-branch' : 'force-update-branch'}" data-folder-id="${escapeHtml(selectedFolderId)}">${selectedFolder.actionCounts.updateReady > 0 ? 'Update branch' : 'Force update'}</button>
                                                <button type="button" class="fv-docker-orbit-button" data-fv-orbit-action="open-webui" data-folder-id="${escapeHtml(selectedFolderId)}">Open WebUIs</button>
                                                <button type="button" class="fv-docker-orbit-button" data-fv-orbit-action="edit-folder" data-folder-id="${escapeHtml(selectedFolderId)}">Edit</button>
                                                <button type="button" class="fv-docker-orbit-button" data-fv-orbit-action="toggle-pin" data-folder-id="${escapeHtml(selectedFolderId)}">${selectedFolder.pinned ? 'Unpin' : 'Pin'}</button>
                                                <button type="button" class="fv-docker-orbit-button" data-fv-orbit-action="toggle-lock" data-folder-id="${escapeHtml(selectedFolderId)}">${selectedFolder.locked ? 'Unlock' : 'Lock'}</button>
                                            </div>
                                        ` : ''}
                                    </article>
                                    ${memberOrbit.nodes.map((member) => `
                                        <button
                                            type="button"
                                            class="fv-docker-orbit-node is-member ${escapeHtml(member.stateMeta.state)}${member.updateReady ? ' has-update' : ''}${member.name === selectedMemberName ? ' is-selected' : ''}"
                                            data-fv-orbit-action="select-member"
                                            data-fv-orbit-native-member="true"
                                            data-member-name="${escapeHtml(member.name)}"
                                            style="--fv-docker-orbit-x:${member.orbitX}px;--fv-docker-orbit-y:${member.orbitY}px;"
                                            title="${escapeHtml(member.name)}"
                                        >
                                            <img src="${member.icon}" class="fv-docker-orbit-member-icon" alt="" loading="lazy" onerror='this.src="${DOCKER_ICON_FALLBACK}"'>
                                            <span class="fv-docker-orbit-member-name">${escapeHtml(member.name)}</span>
                                            <span class="fv-docker-orbit-node-meta">
                                                <i class="fa ${escapeHtml(member.stateMeta.icon)}" aria-hidden="true"></i>
                                                <span>${escapeHtml(member.stateMeta.label)}</span>
                                            </span>
                                            ${member.updateReady ? '<span class="fv-docker-orbit-node-update">update</span>' : ''}
                                        </button>
                                    `).join('')}
                                    ${relatedFolderOrbit.nodes.map((child) => `
                                        <button
                                            type="button"
                                            class="fv-docker-orbit-node is-folder"
                                            data-fv-orbit-action="select-folder"
                                            data-folder-id="${escapeHtml(child.folderId)}"
                                            style="--fv-docker-orbit-x:${child.orbitX}px;--fv-docker-orbit-y:${child.orbitY}px;"
                                            title="${escapeHtml(child.name)}"
                                        >
                                            <img src="${child.icon}" class="fv-docker-orbit-folder-icon" alt="" loading="lazy" onerror='this.src="${DEFAULT_FOLDER_ICON}"'>
                                            <span class="fv-docker-orbit-folder-title">${escapeHtml(child.name)}</span>
                                            <span class="fv-docker-orbit-node-meta">${child.count} in branch${child.updates > 0 ? ` • ${child.updates} updates` : ''}</span>
                                        </button>
                                    `).join('')}
                                </div>
                            </div>
                        </section>
                        <aside class="fv-docker-orbit-inspector">
                            <div class="fv-docker-orbit-panel-title">Inspector</div>
                            ${inspectorBody}
                        </aside>
                    </div>
                </div>
            `;
            if (typeof jq === 'function' && selectedMember) {
                const host = root.querySelector('[data-fv-orbit-member-actions-host="true"]');
                if (host instanceof HTMLElement) {
                    appendDockerPreviewActionButtons(
                        jq(host),
                        {
                            preview_webui: Boolean(selectedMember.webuiUrl),
                            preview_console: true,
                            preview_logs: true
                        },
                        selectedMember.name,
                        selectedMember.shell,
                        selectedMember.webuiUrl
                    );
                }
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
                    ? event.target.closest('[data-fv-orbit-action]')
                    : null;
                if (!(button instanceof HTMLElement)) {
                    return;
                }
                event.preventDefault();
                const action = String(button.getAttribute('data-fv-orbit-action') || '').trim();
                const folderId = String(button.getAttribute('data-folder-id') || selectedFolderId || '').trim();
                const memberName = String(button.getAttribute('data-member-name') || '').trim();
                const rerender = () => Promise.resolve().then(() => mount({ suppressLoadingUi: true, forceRefresh: true, reason: action }));
                if (action === 'refresh') {
                    void rerender();
                    return;
                }
                if (action === 'create-folder') {
                    createFolderBtn();
                    return;
                }
                if (action === 'select-folder') {
                    if (!folderId || !latestSnapshot) {
                        return;
                    }
                    selectedFolderId = folderId;
                    selectedMemberName = '';
                    renderSnapshot(latestSnapshot);
                    return;
                }
                if (action === 'select-member') {
                    if (!latestSnapshot || !memberName) {
                        return;
                    }
                    selectedMemberName = memberName;
                    renderSnapshot(latestSnapshot);
                    return;
                }
                if (action === 'clear-member-selection') {
                    if (!latestSnapshot) {
                        return;
                    }
                    selectedMemberName = '';
                    renderSnapshot(latestSnapshot);
                    return;
                }
                if (action === 'native-member-click') {
                    if (memberName) {
                        proxyNativeMemberTrigger(memberName, 'click', event);
                    }
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
                }
            };
            rootNode.addEventListener('click', clickHandler);
            if (contextMenuHandler) {
                rootNode.removeEventListener('contextmenu', contextMenuHandler);
            }
            contextMenuHandler = (event) => {
                const surface = event.target instanceof Element
                    ? event.target.closest('[data-fv-orbit-native-member="true"]')
                    : null;
                if (!(surface instanceof HTMLElement)) {
                    return;
                }
                const memberName = String(surface.getAttribute('data-member-name') || '').trim();
                if (!memberName) {
                    return;
                }
                event.preventDefault();
                event.stopPropagation();
                proxyNativeMemberTrigger(memberName, 'contextmenu', event);
            };
            rootNode.addEventListener('contextmenu', contextMenuHandler);
        };

        const resolveSnapshot = async (options = {}) => {
            const requestBundle = resolveRequestBundle(options);
            if (!requestBundle || !Array.isArray(requestBundle.render) || requestBundle.render.length < 4) {
                throw new Error('Docker orbit-view request bundle is unavailable.');
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
                    // Optional staged full-info hydration.
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
            if (options?.suppressLoadingUi !== true) {
                renderLoading();
            }
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
                renderError(error instanceof Error ? error.message : 'Unknown orbit-view error.');
                bindEvents();
                return { ok: false, error };
            }
        };

        const unmount = () => {
            renderToken += 1;
            latestSnapshot = null;
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
