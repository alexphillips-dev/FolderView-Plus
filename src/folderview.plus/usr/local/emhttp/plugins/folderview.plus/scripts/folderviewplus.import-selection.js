(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./folderviewplus.utils.js'));
        return;
    }
    const modules = root.FolderViewPlusFoundationModules ||= {};
    modules.importSelection = factory(root.FolderViewPlusUtils);
}(typeof window !== 'undefined' ? window : globalThis, function(utils) {
    'use strict';

    const reviewImportSelection = (existingFolders, fullOperations, operations) => {
        const current = utils.normalizeFolderMap(existingFolders);
        const diffRows = utils.buildImportDiffRows(current, null, operations.mode, { current, operations });
        const hasPartialSelection = ['creates', 'upserts', 'deletes']
            .some(kind => operations[kind].length < fullOperations[kind].length);
        const hierarchyConflicts = [];
        if (!hasPartialSelection) return { diffRows, hierarchyConflicts };

        const selectedDeletes = new Set(operations.deletes);
        const selectedUpdates = new Set(operations.upserts.map(entry => entry.id));
        const incomingNames = new Map(fullOperations.upserts.map(({ id, folder }) => [id, folder.name || id]));
        const addConflict = (folder, parentId) => hierarchyConflicts.push({
            folderName: folder.name || '',
            parentName: current[parentId]?.name || incomingNames.get(parentId) || parentId
        });

        for (const [id, folder] of Object.entries(current)) {
            // Deleting a parent promotes untouched children before any selected updates run.
            if (!selectedDeletes.has(id) && !selectedUpdates.has(id) && selectedDeletes.has(folder.parentId)) {
                addConflict(folder, folder.parentId);
            }
        }
        for (const { folder } of [...operations.upserts, ...operations.creates]) {
            const parentId = folder.parentId;
            if (!parentId || selectedUpdates.has(parentId)) continue;
            if (selectedDeletes.has(parentId) || (!Object.hasOwn(current, parentId) && incomingNames.has(parentId))) {
                addConflict(folder, parentId);
            }
        }
        return { diffRows, hierarchyConflicts };
    };

    return Object.freeze({ reviewImportSelection });
}));
