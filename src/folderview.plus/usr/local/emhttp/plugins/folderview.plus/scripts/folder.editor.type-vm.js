// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusFolderEditorTypeVm = factory();
    root.FolderViewPlusFolderEditorTypeVmModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const EMPTY_SECTION_ROWS = Object.freeze({});

    const createApi = (deps = {}) => {
        const jq = deps.$ || (typeof globalThis !== 'undefined' ? globalThis.jQuery || globalThis.$ : null);

        const mapRuntimeMember = (entry = {}) => {
            const memberName = String(entry?.name || entry?.Name || '').trim();
            if (!memberName) {
                return null;
            }
            return {
                Name: memberName,
                Icon: entry?.icon || entry?.Icon || '',
                Label: undefined
            };
        };

        return Object.freeze({
            shouldSyncAfterSave: () => false,
            flushPostSaveSync: async () => {},
            mapRuntimeMember,
            collectSectionRows: () => EMPTY_SECTION_ROWS,
            applySectionTags: () => {},
            getPreviewSignals: () => null,
            applyPreviewConstraints: ({ $, form } = {}) => {
                const activeJq = $ || jq;
                if (!activeJq || !form) {
                    return;
                }
                activeJq('[constraint*="docker"]').hide();
            }
        });
    };

    return Object.freeze({
        createApi
    });
}));
