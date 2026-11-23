(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./folderviewplus.utils-foundation.js'), require('./folderviewplus.utils-normalization.js'), require('./folderviewplus.utils-prefs.js'), require('./folderviewplus.utils-hierarchy.js'));
        return;
    }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.utilityOrdering = factory(modules.utilityFoundation, modules.utilityNormalization, modules.utilityPrefs, modules.utilityHierarchy);
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function(utilityFoundation, utilityNormalization, utilityPrefs, utilityHierarchy) {
    'use strict';
    const utilityDependencies = Object.assign({}, utilityFoundation, utilityNormalization, utilityPrefs, utilityHierarchy);
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
            const parts = /^(\d{4})-(\d{2})-(\d{2})(?:[T ]((?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?)(Z|[+-](?:[01]\d|2[0-3]):?[0-5]\d)?)?$/.exec(raw);
            if (!parts) {
                return null;
            }
            const [, year, month, day, time, zone] = parts;
            const date = `${year}-${month}-${day}`;
            const midnight = new Date(`${date}T00:00:00Z`);
            if (!Number.isFinite(midnight.getTime()) || midnight.toISOString().slice(0, 10) !== date) {
                return null;
            }
            const parsed = time ? Date.parse(`${date}T${time}${zone || 'Z'}`) : midnight.getTime();
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
        const applyNestedPinnedOrder = (orderedMap) => buildSortedMapFromKeys(
            buildNestedFolderOrderIdsFromMap(applyPinnedOrder(orderedMap))
        );

        if (normalizedPrefs.sortMode === 'alpha') {
            const keys = sortKeysWithComparator((a, b) => {
                const nameA = String(normalizedFolders[a]?.name ?? a).toLowerCase();
                const nameB = String(normalizedFolders[b]?.name ?? b).toLowerCase();
                const cmp = nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
                return cmp !== 0 ? cmp : a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
            });
            return applyNestedPinnedOrder(buildSortedMapFromKeys(keys));
        }

        if (normalizedPrefs.sortMode === 'name_desc') {
            const keys = sortKeysWithComparator((a, b) => {
                const nameA = String(normalizedFolders[a]?.name ?? a).toLowerCase();
                const nameB = String(normalizedFolders[b]?.name ?? b).toLowerCase();
                const cmp = nameB.localeCompare(nameA, undefined, { numeric: true, sensitivity: 'base' });
                return cmp !== 0 ? cmp : b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' });
            });
            return applyNestedPinnedOrder(buildSortedMapFromKeys(keys));
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
                if (timeA === timeB) {
                    return 0;
                }
                if (timeA === null) return 1;
                if (timeB === null) return -1;
                return descending ? timeB - timeA : timeA - timeB;
            });
            return applyNestedPinnedOrder(buildSortedMapFromKeys(keys));
        }

        if (normalizedPrefs.sortMode === 'manual') {
            const ordered = {};
            for (const id of normalizedPrefs.manualOrder) {
                if (Object.prototype.hasOwnProperty.call(normalizedFolders, id)) {
                    ordered[id] = normalizedFolders[id];
                }
            }
            for (const [id, folder] of Object.entries(normalizedFolders)) {
                if (!Object.prototype.hasOwnProperty.call(ordered, id)) ordered[id] = folder;
            }
            return applyNestedPinnedOrder(ordered);
        }

        return applyNestedPinnedOrder(normalizedFolders);
    };


    return Object.freeze({
        orderFoldersByPrefs
    });
}));
