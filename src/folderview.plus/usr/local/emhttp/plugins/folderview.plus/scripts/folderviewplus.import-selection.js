(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./folderviewplus.utils.js'));
        return;
    }
    const modules = root.FolderViewPlusFoundationModules ||= {};
    modules.importSelection = factory(root.FolderViewPlusUtils);
}(typeof window !== 'undefined' ? window : globalThis, function(utils) {
    'use strict';

    const readSelectedParentConflicts = (current, fullOperations, operations) => {
        const hierarchyConflicts = [];
        const selectedDeletes = new Set(operations.deletes);
        const incomingNames = new Map(fullOperations.upserts.map(({ id, folder }) => [id, folder.name || id]));
        const projected = new Map(Object.entries(current).filter(([id]) => !selectedDeletes.has(id)));
        for (const { id, folder } of operations.upserts) projected.set(id, folder);
        const addConflict = (folder, parentId) => hierarchyConflicts.push({
            folderName: folder.name || '',
            parentName: current[parentId]?.name || incomingNames.get(parentId) || parentId
        });

        for (const [id, folder] of projected) {
            const parentId = folder.parentId;
            if (!parentId || projected.has(parentId)) continue;
            if (selectedDeletes.has(parentId) || parentId !== current[id]?.parentId) addConflict(folder, parentId);
        }
        for (const { folder } of operations.creates) {
            const parentId = folder.parentId;
            if (parentId && !projected.has(parentId)) addConflict(folder, parentId);
        }

        const visited = new Set();
        for (const start of projected.keys()) {
            const path = new Set();
            let id = start;
            while (projected.has(id) && !visited.has(id)) {
                visited.add(id);
                path.add(id);
                id = projected.get(id).parentId;
            }
            if (!path.has(id)) continue;
            const cycleStart = id;
            do {
                const folder = projected.get(id);
                if (folder.parentId !== current[id]?.parentId) addConflict(folder, folder.parentId);
                id = folder.parentId;
            } while (id !== cycleStart);
        }
        return hierarchyConflicts;
    };

    const reviewImportSelection = (existingFolders, fullOperations, operations) => {
        const current = utils.normalizeFolderMap(existingFolders);
        return {
            diffRows: utils.buildImportDiffRows(current, null, operations.mode, { current, operations }),
            hierarchyConflicts: readSelectedParentConflicts(current, fullOperations, operations)
        };
    };

    const filterOperationsBySelection = (operations, selection, existingFolders = {}) => {
        if (!selection) return operations;
        const selected = { mode: operations.mode,
            pathMappings: Array.isArray(operations.pathMappings) ? operations.pathMappings.slice() : [],
            pathConflicts: Array.isArray(operations.pathConflicts) ? operations.pathConflicts.slice() : [] };
        for (const kind of ['creates', 'upserts', 'deletes']) {
            const indexes = new Set(selection[kind].filter(item => item.checked).map(item => item.index));
            selected[kind] = operations[kind].filter((_, index) => indexes.has(index));
        }
        const current = utils.normalizeFolderMap(existingFolders);
        const deleted = new Set(selected.deletes);
        const incoming = new Map(selected.upserts.map(({ id, folder }) => [id, folder]));
        const projectedParent = childId => deleted.has(childId) ? undefined : (incoming.get(childId) ?? current[childId])?.parentId;
        selected.upserts = selected.upserts.map(operation => {
            const { id, folder } = operation;
            const retainedOrder = utils.readImportedChildOrder(current[id])
                .filter(childId => !incoming.has(childId) && projectedParent(childId) === id);
            return { ...operation, folder: utils.remapImportedChildOrder(folder,
                childId => projectedParent(childId) === id ? childId : '', retainedOrder) };
        });
        return selected;
    };

    const requireFolderRevision = (revision, translate) => {
        if (!Number.isSafeInteger(revision) || revision < 0) {
            throw new Error(translate('legacy.surface.332e7fb224979d90', 'The current folder configuration revision is unavailable.'));
        }
        return revision;
    };

    const importReviewChanged = translate => new Error(translate('common.server.rules-preview-changed', 'The preview changed. Run the preview again before applying.'));

    const formatParentConflicts = (conflicts, translate) => translate('import.selection.parent-conflict',
        'Review the selection to keep these parent links intact: $1',
        conflicts.map(({ folderName, parentName }) => `${folderName} → ${parentName}`).join(', '));

    const readReviewedSetupImports = async ({ getPlans, fetchFolders, updatePlan, translate }) => {
        const reviewed = {};
        let needsReview = false;
        const plans = ['docker', 'vm'].map(type => [type, { ...getPlans()[type] }]);
        for (const [type, plan] of plans) {
            if (!(plan.include && plan.parsed && plan.operations)) continue;
            const { operations, parsed, folderRevision, hierarchyConflicts } = plan;
            const snapshot = await fetchFolders(type);
            const expectedRevision = requireFolderRevision(snapshot.folderRevision, translate);
            if (expectedRevision !== folderRevision) {
                updatePlan(type, snapshot);
                needsReview = true;
                continue;
            }
            if (hierarchyConflicts?.length) throw new Error(formatParentConflicts(hierarchyConflicts, translate));
            reviewed[type] = { operations, parsed, expectedRevision };
        }
        if (needsReview || plans.some(([type, plan]) => {
            const current = getPlans()[type];
            return current?.include !== plan.include || current?.operations !== plan.operations;
        })) throw importReviewChanged(translate);
        return reviewed;
    };

    return Object.freeze({ reviewImportSelection, readSelectedParentConflicts, filterOperationsBySelection,
        requireFolderRevision, importReviewChanged, formatParentConflicts, readReviewedSetupImports });
}));
