(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./folderviewplus.utils-normalization.js'));
        return;
    }
    const modules = root.FolderViewPlusFoundationModules;
    modules.utilityChildOrder = factory(modules.utilityNormalization);
}(typeof window !== 'undefined' ? window : globalThis, function(utilityNormalization) {
    'use strict';
    const { isPlainObject, normalizeFolderMembers } = utilityNormalization;

    const readImportedChildOrder = (folder) => {
        const order = folder?.settings?.child_folder_order ?? folder?.settings?.childFolderOrder
            ?? folder?.child_folder_order ?? folder?.childFolderOrder;
        const ids = Array.isArray(order) || isPlainObject(order) ? Object.values(order) : [];
        return normalizeFolderMembers(ids.map(id => Number.isSafeInteger(id) ? String(id) : id));
    };

    const remapImportedChildOrder = (folder, resolveChildId, retainedOrder = []) => {
        const { settings = {}, child_folder_order, childFolderOrder, ...record } = folder;
        const { child_folder_order: savedOrder, childFolderOrder: legacyOrder, ...nextSettings } = settings || {};
        const order = normalizeFolderMembers([...readImportedChildOrder(folder).map(resolveChildId), ...retainedOrder]);
        if (order.length || [child_folder_order, childFolderOrder, savedOrder, legacyOrder].some(value => value != null)) {
            nextSettings.child_folder_order = order;
        }
        return { ...record, settings: nextSettings };
    };

    return Object.freeze({ readImportedChildOrder, remapImportedChildOrder });
}));
