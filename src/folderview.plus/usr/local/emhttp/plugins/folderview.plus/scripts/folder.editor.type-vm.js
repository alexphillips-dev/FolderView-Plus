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
        const VM_RULES_CONFIG = Object.freeze({
            regexKinds: Object.freeze(['name_regex']),
            subjectLabel: 'VM',
            nameRegexExample: '^Windows-',
            patternPlaceholders: Object.freeze({})
        });

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

        const getRulesConfig = () => VM_RULES_CONFIG;

        return Object.freeze({
            shouldSyncAfterSave: () => false,
            flushPostSaveSync: async () => {},
            mapRuntimeMember,
            collectSectionRows: () => EMPTY_SECTION_ROWS,
            applySectionTags: () => {},
            getPreviewSignals: () => null,
            getRulesConfig,
            buildSmartDefaultSuggestions: () => [],
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
