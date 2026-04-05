// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusDockerRuntimeInfo = factory();
    root.FolderViewPlusDockerRuntimeInfoModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const fallbackWindow = typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : null);

    const createApi = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        const doc = deps.document || win?.document || (typeof document !== 'undefined' ? document : null);
        const jq = deps.$ || win?.jQuery || win?.$;
        const getDockerRuntimeInfoMap = typeof deps.getDockerRuntimeInfoMap === 'function' ? deps.getDockerRuntimeInfoMap : (() => ({}));
        const setDockerRuntimeInfoMap = typeof deps.setDockerRuntimeInfoMap === 'function' ? deps.setDockerRuntimeInfoMap : (() => {});
        const syncDockerVisibleFoldersFromRuntimeCache = typeof deps.syncDockerVisibleFoldersFromRuntimeCache === 'function'
            ? deps.syncDockerVisibleFoldersFromRuntimeCache
            : (() => {});
        const resolvePreferredWebuiValue = typeof deps.resolvePreferredWebuiValue === 'function'
            ? deps.resolvePreferredWebuiValue
            : ((...candidates) => {
                for (const candidate of candidates) {
                    const raw = String(candidate || '').trim();
                    if (raw) {
                        return raw;
                    }
                }
                return '';
            });
        const getFolderLabelValue = typeof deps.getFolderLabelValue === 'function' ? deps.getFolderLabelValue : (() => '');
        const folderLabelKeys = Array.isArray(deps.folderLabelKeys) ? deps.folderLabelKeys : [];
        const getGlobalFolders = typeof deps.getGlobalFolders === 'function' ? deps.getGlobalFolders : (() => ({}));
        const getFolderDescendants = typeof deps.getFolderDescendants === 'function' ? deps.getFolderDescendants : (() => []);
        const folderHasChildren = typeof deps.folderHasChildren === 'function' ? deps.folderHasChildren : (() => false);
        const defer = typeof win?.setTimeout === 'function'
            ? win.setTimeout.bind(win)
            : ((handler, delay) => setTimeout(handler, delay));

        let dockerHostUpdateCellObserver = null;
        let dockerHostUpdateRowObserver = null;
        let dockerHostUpdateRowObserverRoot = null;
        let dockerHostUpdateSyncTimer = null;
        const dockerHostUpdateObservedCells = typeof WeakSet === 'function' ? new WeakSet() : null;
        const dockerHostUpdatePendingNames = new Set();

        const isDockerRuntimeInfoEntryFull = (entry) => !!(
            entry
            && typeof entry === 'object'
            && entry.info
            && typeof entry.info === 'object'
            && entry.info.State
            && typeof entry.info.State === 'object'
        );

        const buildDockerRuntimeInfoFallbackLabels = (entry = {}, previousEntry = null) => {
            const source = entry && typeof entry === 'object' ? entry : {};
            const previous = previousEntry && typeof previousEntry === 'object' ? previousEntry : null;
            const labels = {
                ...((previous?.Labels && typeof previous.Labels === 'object') ? previous.Labels : {}),
                ...((source.Labels && typeof source.Labels === 'object') ? source.Labels : {})
            };
            const folderLabel = String(source.folderLabel || '').trim();
            if (folderLabel && !getFolderLabelValue(labels) && folderLabelKeys.length > 0) {
                labels[folderLabelKeys[0]] = folderLabel;
            }
            return labels;
        };

        const readDockerHostRowUpdatedState = (name) => {
            const safeName = String(name || '').trim();
            if (!safeName || !doc) {
                return null;
            }
            const row = doc.getElementById(`ct-${safeName}`);
            if (!(row instanceof HTMLElement)) {
                return null;
            }
            const updateCell = row.querySelector('td.updatecolumn');
            if (!(updateCell instanceof HTMLElement)) {
                return null;
            }
            const normalizedText = String(updateCell.textContent || '').trim().toLowerCase();
            const i18nText = (key, fallback = '') => {
                if (typeof jq?.i18n === 'function') {
                    return String(jq.i18n(key) || '').trim().toLowerCase();
                }
                return String(fallback || '').trim().toLowerCase();
            };
            const hasToken = (...tokens) => tokens.some((token) => token && normalizedText.includes(String(token).trim().toLowerCase()));
            if (updateCell.querySelector('.fa-flash')) {
                return false;
            }
            if (updateCell.querySelector('.fa-check')) {
                return true;
            }
            if (hasToken(i18nText('update-ready', 'update ready'), i18nText('apply-update', 'apply update'), 'update ready', 'apply update')) {
                return false;
            }
            if (hasToken(i18nText('up-to-date', 'up-to-date'), i18nText('force-update', 'force update'), 'up-to-date', 'force update')) {
                return true;
            }
            return null;
        };

        const getDockerHostRowContainerName = (value) => {
            if (!value) {
                return '';
            }
            if (typeof value === 'string') {
                const raw = value.trim();
                return raw.startsWith('ct-') ? raw.slice(3).trim() : raw;
            }
            const node = value instanceof Node ? value : null;
            if (!node) {
                return '';
            }
            const parentElement = node instanceof Element ? node : node.parentElement;
            const row = parentElement && typeof parentElement.closest === 'function'
                ? parentElement.closest('tr[id^="ct-"]')
                : null;
            if (!(row instanceof HTMLElement)) {
                return '';
            }
            const rawId = String(row.id || '').trim();
            return rawId.startsWith('ct-') ? rawId.slice(3).trim() : '';
        };

        const getDockerWindowRuntimeEntry = (name) => {
            const safeName = String(name || '').trim();
            if (!safeName || !Array.isArray(win?.docker)) {
                return null;
            }
            return win.docker.find((entry) => String(entry?.info?.Name || '').trim() === safeName) || null;
        };

        const applyDockerRuntimeEntryUpdatedState = (name, updated) => {
            const safeName = String(name || '').trim();
            if (!safeName || typeof updated !== 'boolean') {
                return false;
            }
            const runtimeInfoMap = getDockerRuntimeInfoMap();
            const previousEntry = (
                runtimeInfoMap[safeName]
                && typeof runtimeInfoMap[safeName] === 'object'
                ? runtimeInfoMap[safeName]
                : null
            ) || getDockerWindowRuntimeEntry(safeName);
            const previousState = previousEntry?.info?.State && typeof previousEntry.info.State === 'object'
                ? previousEntry.info.State
                : {};
            const previousManager = String(previousState.manager || '').trim();
            if (previousManager && previousManager !== 'dockerman') {
                return false;
            }
            const nextManager = previousManager || 'dockerman';
            if (previousEntry && previousState.Updated === updated && previousManager === nextManager) {
                return false;
            }
            setDockerRuntimeInfoMap({
                ...runtimeInfoMap,
                [safeName]: {
                    ...(previousEntry && typeof previousEntry === 'object' ? previousEntry : {}),
                    info: {
                        ...((previousEntry?.info && typeof previousEntry.info === 'object') ? previousEntry.info : {}),
                        Name: safeName,
                        Config: {
                            ...((previousEntry?.info?.Config && typeof previousEntry.info.Config === 'object') ? previousEntry.info.Config : {})
                        },
                        State: {
                            ...previousState,
                            manager: nextManager,
                            Updated: updated
                        }
                    },
                    Labels: (previousEntry?.Labels && typeof previousEntry.Labels === 'object') ? previousEntry.Labels : {},
                    Mounts: Array.isArray(previousEntry?.Mounts) ? previousEntry.Mounts : []
                }
            });
            const windowEntry = getDockerWindowRuntimeEntry(safeName);
            if (windowEntry?.info?.State && typeof windowEntry.info.State === 'object') {
                windowEntry.info.State.manager = String(windowEntry.info.State.manager || nextManager).trim() || nextManager;
                windowEntry.info.State.Updated = updated;
            }
            return true;
        };

        const syncDockerHostRowUpdateStatesFromDom = (names = []) => {
            if (!doc) {
                return false;
            }
            const requestedNames = Array.isArray(names)
                ? names.map((entry) => String(entry || '').trim()).filter((entry) => entry !== '')
                : [];
            const targetNames = requestedNames.length > 0
                ? Array.from(new Set(requestedNames))
                : Array.from(doc.querySelectorAll('#docker_list tr[id^="ct-"], #docker_view tr[id^="ct-"]'))
                    .map((row) => getDockerHostRowContainerName(row))
                    .filter((entry) => entry !== '');
            let changed = false;
            targetNames.forEach((entry) => {
                const updated = readDockerHostRowUpdatedState(entry);
                if (typeof updated !== 'boolean') {
                    return;
                }
                changed = applyDockerRuntimeEntryUpdatedState(entry, updated) || changed;
            });
            return changed;
        };

        const queueDockerHostRowUpdateStateSync = (names = []) => {
            if (Array.isArray(names)) {
                names.forEach((entry) => {
                    const safeName = String(entry || '').trim();
                    if (safeName) {
                        dockerHostUpdatePendingNames.add(safeName);
                    }
                });
            }
            if (dockerHostUpdateSyncTimer !== null) {
                return;
            }
            dockerHostUpdateSyncTimer = defer(() => {
                dockerHostUpdateSyncTimer = null;
                const pendingNames = Array.from(dockerHostUpdatePendingNames);
                dockerHostUpdatePendingNames.clear();
                if (syncDockerHostRowUpdateStatesFromDom(pendingNames)) {
                    syncDockerVisibleFoldersFromRuntimeCache();
                }
            }, 36);
        };

        const bindDockerHostUpdateCellObserver = (cell) => {
            if (!(cell instanceof HTMLElement) || !(dockerHostUpdateCellObserver instanceof MutationObserver)) {
                return;
            }
            if (dockerHostUpdateObservedCells && dockerHostUpdateObservedCells.has(cell)) {
                return;
            }
            dockerHostUpdateCellObserver.observe(cell, {
                childList: true,
                subtree: true,
                characterData: true
            });
            if (dockerHostUpdateObservedCells) {
                dockerHostUpdateObservedCells.add(cell);
            }
        };

        const ensureDockerHostRowUpdateObserver = () => {
            if (typeof MutationObserver !== 'function' || !doc) {
                return;
            }
            if (!(dockerHostUpdateCellObserver instanceof MutationObserver)) {
                dockerHostUpdateCellObserver = new MutationObserver((mutations) => {
                    const changedNames = new Set();
                    (mutations || []).forEach((mutation) => {
                        const name = getDockerHostRowContainerName(mutation?.target || null);
                        if (name) {
                            changedNames.add(name);
                        }
                    });
                    queueDockerHostRowUpdateStateSync(Array.from(changedNames));
                });
            }
            doc.querySelectorAll('#docker_list tr[id^="ct-"] td.updatecolumn, #docker_view tr[id^="ct-"] td.updatecolumn').forEach((cell) => {
                bindDockerHostUpdateCellObserver(cell);
            });
            const nextRoot = doc.querySelector('tbody#docker_list') || doc.querySelector('tbody#docker_view');
            if (dockerHostUpdateRowObserverRoot !== nextRoot && dockerHostUpdateRowObserver instanceof MutationObserver) {
                dockerHostUpdateRowObserver.disconnect();
                dockerHostUpdateRowObserverRoot = null;
            }
            if (!(dockerHostUpdateRowObserver instanceof MutationObserver)) {
                dockerHostUpdateRowObserver = new MutationObserver((mutations) => {
                    const changedNames = new Set();
                    (mutations || []).forEach((mutation) => {
                        if (mutation?.type !== 'childList') {
                            return;
                        }
                        if (mutation.target instanceof Element && mutation.target.matches('td.updatecolumn')) {
                            const directName = getDockerHostRowContainerName(mutation.target);
                            if (directName) {
                                changedNames.add(directName);
                            }
                        }
                        Array.from(mutation.addedNodes || []).forEach((node) => {
                            const name = getDockerHostRowContainerName(node);
                            if (name) {
                                changedNames.add(name);
                            }
                            if (node instanceof Element) {
                                if (node.matches?.('td.updatecolumn') && getDockerHostRowContainerName(node)) {
                                    bindDockerHostUpdateCellObserver(node);
                                }
                                node.querySelectorAll?.('tr[id^="ct-"] td.updatecolumn').forEach((cell) => {
                                    bindDockerHostUpdateCellObserver(cell);
                                });
                            }
                        });
                    });
                    doc.querySelectorAll('#docker_list tr[id^="ct-"] td.updatecolumn, #docker_view tr[id^="ct-"] td.updatecolumn').forEach((cell) => {
                        bindDockerHostUpdateCellObserver(cell);
                    });
                    queueDockerHostRowUpdateStateSync(Array.from(changedNames));
                });
            }
            if (nextRoot && dockerHostUpdateRowObserverRoot !== nextRoot) {
                dockerHostUpdateRowObserver.observe(nextRoot, {
                    childList: true,
                    subtree: true
                });
                dockerHostUpdateRowObserverRoot = nextRoot;
            }
        };

        const buildDockerRuntimeInfoRenderEntry = (name, entry = {}, previousEntry = null) => {
            const safeName = String(name || '').trim();
            const source = entry && typeof entry === 'object' ? entry : {};
            const previous = previousEntry && typeof previousEntry === 'object' ? previousEntry : null;
            if (isDockerRuntimeInfoEntryFull(source)) {
                return source;
            }
            const labels = buildDockerRuntimeInfoFallbackLabels(source, previous);
            const previousInfo = previous?.info && typeof previous.info === 'object' ? previous.info : {};
            const previousState = previousInfo.State && typeof previousInfo.State === 'object' ? previousInfo.State : {};
            const previousConfig = previousInfo.Config && typeof previousInfo.Config === 'object' ? previousInfo.Config : {};
            const sourceInfo = source?.info && typeof source.info === 'object' ? source.info : {};
            const sourceState = sourceInfo.State && typeof sourceInfo.State === 'object' ? sourceInfo.State : {};
            const stateKind = String(source.state || '').trim().toLowerCase();
            const running = source.running === true || stateKind === 'running';
            const paused = source.paused === true || stateKind === 'paused';
            const manager = String(source.manager || previousState.manager || '').trim();
            const labelWebUi = String(labels['net.unraid.docker.webui'] || '').trim();
            const labelTsWebUi = String(labels['net.unraid.docker.tailscale.webui'] || '').trim();
            const resolvedWebUi = resolvePreferredWebuiValue(sourceState.WebUi, source.WebUi, source.webui, previousState.WebUi, labelWebUi);
            const resolvedTsWebUi = resolvePreferredWebuiValue(sourceState.TSWebUi, source.TSWebUi, previousState.TSWebUi, labelTsWebUi);
            const sourceUpdated = typeof sourceState.Updated === 'boolean'
                ? sourceState.Updated
                : (typeof source.Updated === 'boolean' ? source.Updated : null);
            const resolvedUpdated = typeof sourceUpdated === 'boolean'
                ? sourceUpdated
                : (typeof previousState.Updated === 'boolean'
                    ? previousState.Updated
                    : (manager === 'dockerman' ? readDockerHostRowUpdatedState(safeName) : null));
            const nextEntry = previous ? { ...previous } : {};
            nextEntry.shortId = String(source.id || previous?.shortId || '').trim();
            nextEntry.shortImageId = String(source.shortImageId || previous?.shortImageId || '').trim();
            nextEntry.Labels = labels;
            nextEntry.Mounts = Array.isArray(source.Mounts) ? source.Mounts : (Array.isArray(previous?.Mounts) ? previous.Mounts : []);
            nextEntry.info = {
                ...previousInfo,
                Name: safeName || String(previousInfo.Name || '').trim(),
                Shell: String(labels['net.unraid.docker.shell'] || previousInfo.Shell || 'sh').trim() || 'sh',
                Config: {
                    ...previousConfig,
                    Image: String(source.Image || previousConfig.Image || '').trim(),
                    Labels: labels
                },
                State: {
                    ...previousState,
                    Running: running,
                    Paused: paused,
                    Status: String(source.status || previousState.Status || '').trim(),
                    Autostart: source.autostart === true,
                    Updated: resolvedUpdated,
                    manager,
                    WebUi: resolvedWebUi,
                    TSWebUi: resolvedTsWebUi
                },
                Ports: Array.isArray(previousInfo.Ports) ? previousInfo.Ports : [],
                template: previousInfo.template || null
            };
            return nextEntry;
        };

        const normalizeDockerRuntimeInfoMap = (source, previousMap = null) => {
            const rawMap = source && typeof source === 'object' ? source : {};
            const fallbackMap = previousMap && typeof previousMap === 'object' ? previousMap : getDockerRuntimeInfoMap();
            const normalized = {};
            Object.entries(rawMap).forEach(([name, entry]) => {
                const safeName = String(name || '').trim();
                if (!safeName || !entry || typeof entry !== 'object') {
                    return;
                }
                normalized[safeName] = buildDockerRuntimeInfoRenderEntry(safeName, entry, fallbackMap?.[safeName] || null);
            });
            return normalized;
        };

        const readFolderContainerNames = (containers) => {
            if (Array.isArray(containers)) {
                return Array.from(new Set(containers.map((item) => String(item || '').trim()).filter((item) => item !== '')));
            }
            if (containers && typeof containers === 'object') {
                return Array.from(new Set(Object.keys(containers).map((item) => String(item || '').trim()).filter((item) => item !== '')));
            }
            return [];
        };

        const getDockerRuntimeContainerInfo = (name) => {
            const key = String(name || '').trim();
            if (!key) {
                return null;
            }
            const runtimeInfoMap = getDockerRuntimeInfoMap();
            const cached = runtimeInfoMap[key];
            if (cached && typeof cached === 'object') {
                return cached;
            }
            if (Array.isArray(win?.docker)) {
                const match = win.docker.find((entry) => String(entry?.info?.Name || '').trim() === key);
                if (match && typeof match === 'object') {
                    const nextEntry = buildDockerRuntimeInfoRenderEntry(key, match, runtimeInfoMap[key] || null);
                    setDockerRuntimeInfoMap({
                        ...runtimeInfoMap,
                        [key]: nextEntry
                    });
                    return nextEntry;
                }
            }
            return null;
        };

        const buildRuntimeContainerEntry = (name, sourceMeta = null) => {
            const key = String(name || '').trim();
            const source = (sourceMeta && typeof sourceMeta === 'object' && !Array.isArray(sourceMeta)) ? sourceMeta : {};
            const runtime = getDockerRuntimeContainerInfo(key);
            const runtimeState = runtime?.info?.State || {};
            const runtimeManager = String(runtimeState.manager || '').trim();
            const hasRuntimeState = typeof runtimeState.Running === 'boolean';
            const hasRuntimePause = typeof runtimeState.Paused === 'boolean';
            return {
                ...source,
                id: source.id || String(runtime?.shortId || '').trim(),
                name: String(runtime?.info?.Name || source.name || key).trim() || key,
                icon: source.icon || runtime?.Labels?.['net.unraid.docker.icon'] || '/plugins/dynamix.docker.manager/images/question.png',
                webui: resolvePreferredWebuiValue(runtimeState.WebUi, runtimeState.TSWebUi, source.webui),
                shell: source.shell || runtime?.info?.Shell || '/bin/sh',
                pause: hasRuntimePause ? (runtimeState.Paused === true) : (source.pause === true),
                state: hasRuntimeState ? (runtimeState.Running === true) : (source.state === true),
                autostart: typeof runtimeState.Autostart === 'boolean' ? runtimeState.Autostart === true : (source.autostart === true),
                update: typeof runtimeState.Updated === 'boolean'
                    ? (runtimeState.Updated === false && runtimeManager === 'dockerman')
                    : (source.update === true),
                managed: runtimeManager ? runtimeManager === 'dockerman' : (source.managed === true),
                manager: runtimeManager || String(source.manager || '').trim()
            };
        };

        const getFolderRuntimeContainers = (folder) => {
            if (!folder || typeof folder !== 'object') {
                return {};
            }
            const runtime = folder.runtimeContainers;
            const containers = folder.containers;
            const names = readFolderContainerNames(containers);
            if (!names.length) {
                return (runtime && typeof runtime === 'object' && !Array.isArray(runtime)) ? runtime : {};
            }
            const sourceMap = (containers && typeof containers === 'object' && !Array.isArray(containers)) ? containers : {};
            const collected = {};
            for (const name of names) {
                if (Object.prototype.hasOwnProperty.call(collected, name)) {
                    continue;
                }
                collected[name] = buildRuntimeContainerEntry(name, sourceMap[name]);
            }
            folder.runtimeContainers = collected;
            return collected;
        };

        const buildRuntimeContainerMapForFolder = (folderId, includeDescendants = false) => {
            const collected = {};
            const targetIds = includeDescendants ? [folderId, ...getFolderDescendants(folderId)] : [folderId];
            const globalFolders = getGlobalFolders();
            for (const targetId of targetIds) {
                const folder = globalFolders[targetId];
                if (!folder || !folder.containers || typeof folder.containers !== 'object') {
                    continue;
                }
                const names = readFolderContainerNames(folder.containers);
                const sourceMap = !Array.isArray(folder.containers) ? folder.containers : {};
                for (const name of names) {
                    const key = String(name || '').trim();
                    if (!key || Object.prototype.hasOwnProperty.call(collected, key)) {
                        continue;
                    }
                    collected[key] = buildRuntimeContainerEntry(key, sourceMap?.[key]);
                }
            }
            return collected;
        };

        const getScopedRuntimeContainersForFolder = (folderId, includeDescendants = true) => {
            const id = String(folderId || '').trim();
            const globalFolders = getGlobalFolders();
            if (!id || !globalFolders[id]) {
                return {};
            }
            if (folderHasChildren(id)) {
                return buildRuntimeContainerMapForFolder(id, includeDescendants === true);
            }
            return getFolderRuntimeContainers(globalFolders[id]);
        };

        return Object.freeze({
            readDockerHostRowUpdatedState,
            getDockerHostRowContainerName,
            getDockerWindowRuntimeEntry,
            applyDockerRuntimeEntryUpdatedState,
            syncDockerHostRowUpdateStatesFromDom,
            queueDockerHostRowUpdateStateSync,
            ensureDockerHostRowUpdateObserver,
            buildDockerRuntimeInfoRenderEntry,
            normalizeDockerRuntimeInfoMap,
            readFolderContainerNames,
            buildRuntimeContainerEntry,
            getFolderRuntimeContainers,
            getScopedRuntimeContainersForFolder,
            buildRuntimeContainerMapForFolder
        });
    };

    return Object.freeze({
        createApi
    });
}));
