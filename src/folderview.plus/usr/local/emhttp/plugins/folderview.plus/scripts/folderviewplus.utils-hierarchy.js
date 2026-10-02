(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.utilityHierarchy = factory();
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function() {
    'use strict';

    const buildFolderHierarchyModel = (foldersInput, options = {}) => {
        const source = foldersInput && typeof foldersInput === 'object' ? foldersInput : {};
        const ids = Object.keys(source).filter((id) => source[id] && typeof source[id] === 'object');
        const idSet = new Set(ids);
        const parentById = {};
        const childrenById = Object.fromEntries(ids.map((id) => [id, []]));
        const depthById = {};
        const descendantsById = {};
        for (const id of ids) {
            const rawParent = String(source[id]?.parentId || source[id]?.parent_id || '').trim();
            parentById[id] = rawParent !== id && idSet.has(rawParent) ? rawParent : '';
        }
        if (options.breakCycles !== false) {
            for (const id of ids) {
                const seen = new Set([id]);
                let cursor = parentById[id];
                while (cursor) {
                    if (seen.has(cursor)) {
                        parentById[id] = '';
                        break;
                    }
                    seen.add(cursor);
                    cursor = parentById[cursor];
                }
            }
        }
        for (const id of ids) {
            if (parentById[id]) {
                childrenById[parentById[id]].push(id);
            }
        }
        const rootIds = ids.filter((id) => !parentById[id]);
        const orderedIds = [];
        const visited = new Set();
        const visit = (rootId) => {
            const stack = [[rootId, 0]];
            while (stack.length > 0) {
                const [id, depth] = stack.pop();
                if (visited.has(id)) {
                    continue;
                }
                visited.add(id);
                orderedIds.push(id);
                depthById[id] = depth;
                const children = childrenById[id] || [];
                for (let index = children.length - 1; index >= 0; index -= 1) {
                    stack.push([children[index], depth + 1]);
                }
            }
        };
        for (const id of rootIds) {
            visit(id);
        }
        for (const id of ids) {
            visit(id);
        }
        if (options.includeDescendants !== false) {
            for (const id of ids) {
                const descendants = [];
                const stack = [...(childrenById[id] || [])].reverse();
                const seen = new Set([id]);
                while (stack.length > 0) {
                    const childId = stack.pop();
                    if (seen.has(childId)) {
                        continue;
                    }
                    seen.add(childId);
                    descendants.push(childId);
                    const children = childrenById[childId] || [];
                    for (let index = children.length - 1; index >= 0; index -= 1) {
                        stack.push(children[index]);
                    }
                }
                descendantsById[id] = descendants;
            }
        }
        return { ids, idSet, parentById, childrenById, rootIds, orderedIds, depthById, descendantsById };
    };

    const buildNestedFolderOrderIdsFromMap = (orderedMap) =>
        buildFolderHierarchyModel(orderedMap, { includeDescendants: false, breakCycles: false }).orderedIds;

    return Object.freeze({ buildFolderHierarchyModel, buildNestedFolderOrderIdsFromMap });
}));
