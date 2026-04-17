// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusFolderEditorTypeVm = factory();
    root.FolderViewPlusFolderEditorTypeVmModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const createApi = () => Object.freeze({
        shouldSyncAfterSave: () => false,
        flushPostSaveSync: async () => {}
    });

    return Object.freeze({
        createApi
    });
}));
