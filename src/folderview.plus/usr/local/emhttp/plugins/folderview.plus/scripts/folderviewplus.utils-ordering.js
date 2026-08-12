(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./folderviewplus.utils-foundation.js'), require('./folderviewplus.utils-normalization.js'), require('./folderviewplus.utils-prefs.js'));
        return;
    }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.utilityOrdering = factory(modules.utilityFoundation, modules.utilityNormalization, modules.utilityPrefs);
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function(utilityFoundation, utilityNormalization, utilityPrefs) {
    'use strict';
    const utilityDependencies = Object.assign({}, utilityFoundation, utilityNormalization, utilityPrefs);
    const {
        normalizeStringIdList,
        normalizeFolderMap,
        buildNestedFolderOrderIdsFromMap,
        normalizePrefs
    } = utilityDependencies;

    const orderFoldersByPrefs = (folders, prefs) => {
        const normalizedFolders = normalizeFolderMap(folders);
        const normalizedPrefs = normalizePrefs(prefs);
        const baseOrderIds = Object.keys(normalizedFolders);
        const baseOrderIndex = new Map(baseOrderIds.map((id, index) => [id, index]));
        const normalizeSortTimestamp = (value) => {
            const raw = typeof value === 'string' ? value.trim() : '';
            if (!raw) {
                return null;
            }
            const parsed = Date.parse(raw);
            return Number.isFinite(parsed) ? parsed : null;
        };
        const buildSortedMapFromKeys = (keys) => {
            const ordered = {};
            for (const key of keys) {
                ordered[key] = normalizedFolders[key];
            }
            return ordered;
        };
        const sortKeysWithComparator = (comparator) => (
            baseOrderIds.slice().sort((leftId, rightId) => {
                const compared = comparator(leftId, rightId);
                if (compared !== 0) {
                    return compared;
                }
                return (baseOrderIndex.get(leftId) ?? 0) - (baseOrderIndex.get(rightId) ?? 0);
            })
        );
        const resolvePinnedBranchRootId = (id) => {
            const safeId = String(id || '').trim();
            if (!safeId || !Object.prototype.hasOwnProperty.call(normalizedFolders, safeId)) {
                return safeId;
            }
            const seen = new Set([safeId]);
            let current = safeId;
            while (true) {
                const rawParentId = String(normalizedFolders[current]?.parentId || normalizedFolders[current]?.parent_id || '').trim();
                if (!rawParentId || rawParentId === current || !Object.prototype.hasOwnProperty.call(normalizedFolders, rawParentId) || seen.has(rawParentId)) {
                    break;
                }
                seen.add(rawParentId);
                current = rawParentId;
            }
            return current;
        };
        const applyPinnedOrder = (orderedMap) => {
            // Nested children cannot visually float above their parent, so pinning a
            // child promotes the visible branch root to keep the move meaningful.
            const pinnedIds = Array.from(new Set(
                normalizeStringIdList(normalizedPrefs.pinnedFolderIds)
                    .map((id) => resolvePinnedBranchRootId(id))
                    .filter((id) => id !== '')
            ));
            if (!pinnedIds.length) {
                return orderedMap;
            }

            const next = {};
            const remaining = { ...orderedMap };

            for (const id of pinnedIds) {
                if (Object.prototype.hasOwnProperty.call(remaining, id)) {
                    next[id] = remaining[id];
                    delete remaining[id];
                }
            }

            for (const [id, folder] of Object.entries(remaining)) {
                next[id] = folder;
            }
            return next;
        };

        if (normalizedPrefs.sortMode === 'alpha') {
            const keys = sortKeysWithComparator((a, b) => {
                const nameA = String(normalizedFolders[a]?.name ?? a).toLowerCase();
                const nameB = String(normalizedFolders[b]?.name ?? b).toLowerCase();
                const cmp = nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
                return cmp !== 0 ? cmp : a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
            });
            const ordered = buildSortedMapFromKeys(keys);
            const pinnedApplied = applyPinnedOrder(ordered);
            const nestedIds = buildNestedFolderOrderIdsFromMap(pinnedApplied);
            const nestedOrdered = {};
            for (const key of nestedIds) {
                nestedOrdered[key] = pinnedApplied[key];
            }
            return nestedOrdered;
        }

        if (normalizedPrefs.sortMode === 'name_desc') {
            const keys = sortKeysWithComparator((a, b) => {
                const nameA = String(normalizedFolders[a]?.name ?? a).toLowerCase();
                const nameB = String(normalizedFolders[b]?.name ?? b).toLowerCase();
                const cmp = nameB.localeCompare(nameA, undefined, { numeric: true, sensitivity: 'base' });
                return cmp !== 0 ? cmp : b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' });
            });
            const ordered = buildSortedMapFromKeys(keys);
            const pinnedApplied = applyPinnedOrder(ordered);
            const nestedIds = buildNestedFolderOrderIdsFromMap(pinnedApplied);
            const nestedOrdered = {};
            for (const key of nestedIds) {
                nestedOrdered[key] = pinnedApplied[key];
            }
            return nestedOrdered;
        }

        if (
            normalizedPrefs.sortMode === 'created_newest'
            || normalizedPrefs.sortMode === 'created_oldest'
            || normalizedPrefs.sortMode === 'updated_newest'
        ) {
            const timestampField = normalizedPrefs.sortMode === 'updated_newest' ? 'updatedAt' : 'createdAt';
            const descending = normalizedPrefs.sortMode !== 'created_oldest';
            const keys = sortKeysWithComparator((a, b) => {
                const timeA = normalizeSortTimestamp(normalizedFolders[a]?.[timestampField]);
                const timeB = normalizeSortTimestamp(normalizedFolders[b]?.[timestampField]);
                if (timeA === null || timeB === null || timeA === timeB) {
                    return 0;
                }
                return descending ? timeB - timeA : timeA - timeB;
            });
            const ordered = buildSortedMapFromKeys(keys);
            const pinnedApplied = applyPinnedOrder(ordered);
            const nestedIds = buildNestedFolderOrderIdsFromMap(pinnedApplied);
            const nestedOrdered = {};
            for (const key of nestedIds) {
                nestedOrdered[key] = pinnedApplied[key];
            }
            return nestedOrdered;
        }

        if (normalizedPrefs.sortMode === 'manual') {
            const ordered = {};
            for (const id of normalizedPrefs.manualOrder) {
                if (Object.prototype.hasOwnProperty.call(normalizedFolders, id)) {
                    ordered[id] = normalizedFolders[id];
                    delete normalizedFolders[id];
                }
            }
            for (const [id, folder] of Object.entries(normalizedFolders)) {
                ordered[id] = folder;
            }
            const pinnedApplied = applyPinnedOrder(ordered);
            const nestedIds = buildNestedFolderOrderIdsFromMap(pinnedApplied);
            const nestedOrdered = {};
            for (const key of nestedIds) {
                nestedOrdered[key] = pinnedApplied[key];
            }
            return nestedOrdered;
        }

        const pinnedApplied = applyPinnedOrder(normalizedFolders);
        const nestedIds = buildNestedFolderOrderIdsFromMap(pinnedApplied);
        const nestedOrdered = {};
        for (const key of nestedIds) {
            nestedOrdered[key] = pinnedApplied[key];
        }
        return nestedOrdered;
    };


    return Object.freeze({
        orderFoldersByPrefs
    });
}));
