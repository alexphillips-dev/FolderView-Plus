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

    // Keep this fold and numeric comparison in sync with PHP's folder name order.
    const latinFold = new Map(Object.entries({
        a: 'ÀÁÂÃÄÅàáâãäåĀāĂăĄą',
        c: 'ÇçĆćĈĉĊċČč',
        d: 'ĎďĐđ',
        e: 'ÈÉÊËèéêëĒēĔĕĖėĘęĚě',
        g: 'ĜĝĞğĠġĢģ',
        h: 'ĤĥĦħ',
        i: 'ÌÍÎÏìíîïĨĩĪīĬĭĮįİı',
        j: 'Ĵĵ',
        k: 'Ķķ',
        l: 'ĹĺĻļĽľĿŀŁł',
        n: 'ÑñŃńŅņŇň',
        o: 'ÒÓÔÕÖØòóôõöøŌōŎŏŐő',
        r: 'ŔŕŖŗŘř',
        s: 'ŚśŜŝŞşŠš',
        t: 'ŢţŤťŦŧ',
        u: 'ÙÚÛÜùúûüŨũŪūŬŭŮůŰűŲų',
        w: 'Ŵŵ',
        y: 'ÝýÿŶŷŸ',
        z: 'ŹźŻżŽž',
        ae: 'Ææ',
        oe: 'Œœ',
        ss: 'ẞß',
    }).flatMap(([replacement, group]) => Array.from(group, letter => [letter, replacement])));

    const nameSortKey = (value) => String(value).trim()
        .replace(/[A-Z]/g, letter => letter.toLowerCase())
        .replace(/[\u00c0-\u017f\u1e9e]/g, letter => latinFold.get(letter) ?? letter)
        .replace(/([a-z])[\u0300-\u036f]+/g, '$1')
        .split(/([0-9]+)/)
        .map((part, index) => index % 2 === 0 ? part : part.replace(/^0+(?=[0-9])/, ''));

    const compareNameSortKeys = (left, right) => {
        for (let index = 0; index < Math.min(left.length, right.length); index++) {
            const a = left[index], b = right[index];
            if (a === b) continue;
            if (index % 2) return a.length - b.length || (a < b ? -1 : 1);
            const bChars = b[Symbol.iterator]();
            for (const aChar of a) {
                const bChar = bChars.next().value;
                if (bChar === undefined) return 1;
                if (aChar !== bChar) return aChar.codePointAt(0) - bChar.codePointAt(0);
            }
            return -1;
        }
        return left.length - right.length;
    };

    const orderNormalizedFolderIds = (normalizedFolders, prefs) => {
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
        const applyNestedPinnedOrder = (orderedIds) => {
            // Nested children cannot visually float above their parent, so pinning a
            // child promotes the visible branch root to keep the move meaningful.
            const pinnedIds = Array.from(new Set(
                normalizeStringIdList(normalizedPrefs.pinnedFolderIds)
                    .map((id) => resolvePinnedBranchRootId(id))
                    .filter((id) => Object.hasOwn(normalizedFolders, id))
            ));
            const pinned = new Set(pinnedIds);
            return buildNestedFolderOrderIdsFromMap(normalizedFolders,
                pinned.size ? [...pinnedIds, ...orderedIds.filter(id => !pinned.has(id))] : orderedIds);
        };

        if (normalizedPrefs.sortMode === 'alpha' || normalizedPrefs.sortMode === 'name_desc') {
            const names = new Map(baseOrderIds.map(id => [id, nameSortKey(normalizedFolders[id]?.name ?? id)]));
            const ids = new Map(baseOrderIds.map(id => [id, nameSortKey(id)]));
            const direction = normalizedPrefs.sortMode === 'alpha' ? 1 : -1;
            const keys = sortKeysWithComparator((a, b) => direction * (
                compareNameSortKeys(names.get(a), names.get(b)) || compareNameSortKeys(ids.get(a), ids.get(b))
                || (a === b ? 0 : a < b ? -1 : 1)
            ));
            return applyNestedPinnedOrder(keys);
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
            return applyNestedPinnedOrder(keys);
        }

        if (normalizedPrefs.sortMode === 'manual') {
            return applyNestedPinnedOrder([...new Set([...normalizedPrefs.manualOrder.filter(id => baseOrderIndex.has(id)), ...baseOrderIds])]);
        }

        return applyNestedPinnedOrder(baseOrderIds);
    };

    const orderFolderIdsByPrefs = (folders, prefs) => orderNormalizedFolderIds(normalizeFolderMap(folders), prefs);
    const orderFolderEntriesByPrefs = (folders, prefs) => {
        const normalized = normalizeFolderMap(folders);
        return orderNormalizedFolderIds(normalized, prefs).map(id => [id, normalized[id]]);
    };
    const orderFoldersByPrefs = (folders, prefs) => Object.fromEntries(orderFolderEntriesByPrefs(folders, prefs));

    const orderChildFolderIds = (childIds, parent) => {
        const saved = parent?.settings?.child_folder_order || parent?.settings?.childFolderOrder;
        if (!Array.isArray(saved) || !saved.length) return childIds;
        const remaining = new Set(childIds);
        const preferred = saved.map(id => String(id ?? '').trim()).filter(id => remaining.delete(id));
        return [...preferred, ...remaining];
    };

    return Object.freeze({
        orderFoldersByPrefs, orderFolderIdsByPrefs, orderFolderEntriesByPrefs, orderChildFolderIds
    });
}));
