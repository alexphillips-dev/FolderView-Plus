(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./runtime.folder-ordering.js'));
        return;
    }
    root.FolderViewPlusDashboardFolderMatchCache = factory(root.FolderViewPlusRuntimeFolderOrdering);
    root.FolderViewPlusDashboardFolderMatchCacheModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function(runtimeFolderOrdering) {
    const createApi = (deps = {}) => {
        const utils = deps.utils || {};
        const folderRegex = deps.folderRegex || /^folder-/;
        const getFolderLabelValue = typeof deps.getFolderLabelValue === 'function' ? deps.getFolderLabelValue : (() => '');
        const normalizeFolderParentId = (value) => String(value || '').trim();

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
            if (!Object.keys(rootOnly).length && Object.keys(source).length) {
                return source;
            }
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
            if (!Array.isArray(source)) {
                return;
            }
            for (const rawName of source) {
                const name = String(rawName || '').trim();
                if (!name || seen.has(name)) {
                    continue;
                }
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
            if (!runtimeFolderOrdering || typeof runtimeFolderOrdering.reorderFolderSlotsInBaseOrder !== 'function') {
                throw new Error('FolderView Plus runtime folder ordering is unavailable.');
            }
            return runtimeFolderOrdering.reorderFolderSlotsInBaseOrder(baseOrder, folders, prefs, {
                orderFolders: getPrefsOrderedFolderMap,
                folderTokenPrefix: 'folder-',
                isFolderToken: (entry) => folderRegex.test(String(entry || ''))
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
            return names.map((name) => `${name}:${normalizeDockerStateToken(map[name], fromStateMode)}`).join('|');
        };

        const normalizeVmStateToken = (entry) => {
            if (!entry || typeof entry !== 'object') {
                return 'stopped:0';
            }
            const state = String(entry.state || '').toLowerCase() || 'stopped';
            const autostart = entry.autostart ? '1' : '0';
            return `${state}:${autostart}`;
        };

        const buildVmStateSignature = (source) => {
            const map = source && typeof source === 'object' ? source : {};
            const names = Object.keys(map).sort((a, b) => a.localeCompare(b));
            if (!names.length) {
                return '';
            }
            return names.map((name) => `${name}:${normalizeVmStateToken(map[name])}`).join('|');
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
                cache[folderId] = { explicit, regex: regexMatches, label: labelMatches, rules: ruleMatches };
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
                cache[folderId] = { explicit, regex: regexMatches, rules: ruleMatches };
            }
            return cache;
        };

        return Object.freeze({
            getPrefsOrderedFolderMap,
            sortFolderIdsByPrefs,
            normalizeFolderParentId,
            filterDashboardToRootFolders,
            buildFolderChildrenIndex,
            buildFolderDescendantsByRoot,
            mergeUniqueNames,
            aggregateRootMatchCache,
            reorderFolderSlotsInBaseOrder,
            parseJsonPayloadSafe,
            normalizeDockerStateToken,
            buildDockerStateSignature,
            normalizeVmStateToken,
            buildVmStateSignature,
            buildDashboardDockerFolderMatchCache,
            buildDashboardVmFolderMatchCache
        });
    };

    return Object.freeze({
        createApi
    });
}));
