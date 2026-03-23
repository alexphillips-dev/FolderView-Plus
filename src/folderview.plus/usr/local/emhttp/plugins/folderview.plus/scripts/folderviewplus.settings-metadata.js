(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusSettingsMetadata = factory();
    root.FolderViewPlusSettingsMetadataModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const SETTINGS_TABLE_COLUMN_SCHEMA_BY_TYPE = Object.freeze({
        docker: Object.freeze([
            Object.freeze({ key: 'order', label: 'Order', fieldId: null, header: '.col-order', cell: '.order-cell', hideable: false, resizable: true, defaultWidth: 92, min: 64, max: 220 }),
            Object.freeze({ key: 'name', label: 'Name', fieldId: null, header: '.col-name', cell: '.name-cell', hideable: false, resizable: true, defaultWidth: 320, min: 220, max: 820 }),
            Object.freeze({ key: 'members', label: 'Members', fieldId: 'docker-col-members', header: '.col-members', cell: '.members-cell', hideable: true, resizable: true, defaultWidth: 112, min: 90, max: 260, presets: Object.freeze({ compact: false, balanced: false, detailed: true }) }),
            Object.freeze({ key: 'status', label: 'Status', fieldId: 'docker-col-status', header: '.col-status', cell: '.status-cell', hideable: true, resizable: true, defaultWidth: 220, min: 170, max: 620, presets: Object.freeze({ compact: true, balanced: true, detailed: true }) }),
            Object.freeze({ key: 'rules', label: 'Rules', fieldId: 'docker-col-rules', header: '.col-rules', cell: '.rules-cell', hideable: true, resizable: true, defaultWidth: 110, min: 80, max: 240, presets: Object.freeze({ compact: true, balanced: true, detailed: true }) }),
            Object.freeze({ key: 'lastChanged', label: 'Last changed', fieldId: 'docker-col-last-changed', header: '.col-last-changed', cell: '.last-changed-cell', hideable: true, resizable: true, defaultWidth: 180, min: 150, max: 360, presets: Object.freeze({ compact: false, balanced: true, detailed: true }) }),
            Object.freeze({ key: 'pinned', label: 'Pinned', fieldId: 'docker-col-pinned', header: '.col-pinned', cell: '.pinned-cell', hideable: true, resizable: true, defaultWidth: 96, min: 80, max: 200, presets: Object.freeze({ compact: false, balanced: true, detailed: true }) }),
            Object.freeze({ key: 'signals', label: 'Alerts', fieldId: 'docker-col-signals', header: '.col-signals', cell: '.signals-cell', hideable: true, resizable: true, defaultWidth: 180, min: 120, max: 360, presets: Object.freeze({ compact: true, balanced: true, detailed: true }) }),
            Object.freeze({ key: 'actions', label: 'Actions', fieldId: null, header: '.col-actions', cell: '.actions-cell', hideable: false, resizable: true, defaultWidth: 180, min: 160, max: 320 })
        ]),
        vm: Object.freeze([
            Object.freeze({ key: 'order', label: 'Order', fieldId: null, header: '.col-order', cell: '.order-cell', hideable: false, resizable: true, defaultWidth: 92, min: 64, max: 220 }),
            Object.freeze({ key: 'name', label: 'Name', fieldId: null, header: '.col-name', cell: '.name-cell', hideable: false, resizable: true, defaultWidth: 320, min: 220, max: 820 }),
            Object.freeze({ key: 'members', label: 'Members', fieldId: 'vm-col-members', header: '.col-members', cell: '.members-cell', hideable: true, resizable: true, defaultWidth: 112, min: 90, max: 260, presets: Object.freeze({ compact: false, balanced: false, detailed: true }) }),
            Object.freeze({ key: 'status', label: 'Status', fieldId: 'vm-col-status', header: '.col-status', cell: '.status-cell', hideable: true, resizable: true, defaultWidth: 220, min: 170, max: 620, presets: Object.freeze({ compact: false, balanced: false, detailed: true }) }),
            Object.freeze({ key: 'rules', label: 'Rules', fieldId: 'vm-col-rules', header: '.col-rules', cell: '.rules-cell', hideable: true, resizable: true, defaultWidth: 110, min: 80, max: 240, presets: Object.freeze({ compact: false, balanced: false, detailed: true }) }),
            Object.freeze({ key: 'lastChanged', label: 'Last changed', fieldId: 'vm-col-last-changed', header: '.col-last-changed', cell: '.last-changed-cell', hideable: true, resizable: true, defaultWidth: 180, min: 150, max: 360, presets: Object.freeze({ compact: false, balanced: false, detailed: true }) }),
            Object.freeze({ key: 'pinned', label: 'Pinned', fieldId: 'vm-col-pinned', header: '.col-pinned', cell: '.pinned-cell', hideable: true, resizable: true, defaultWidth: 96, min: 80, max: 200, presets: Object.freeze({ compact: false, balanced: false, detailed: true }) }),
            Object.freeze({ key: 'autostart', label: 'Autostart', fieldId: 'vm-col-autostart', header: '.col-autostart', cell: '.autostart-cell', hideable: true, resizable: true, defaultWidth: 160, min: 130, max: 300, presets: Object.freeze({ compact: true, balanced: true, detailed: true }) }),
            Object.freeze({ key: 'resources', label: 'Resources', fieldId: 'vm-col-resources', header: '.col-resources', cell: '.resources-cell', hideable: true, resizable: true, defaultWidth: 210, min: 170, max: 420, presets: Object.freeze({ compact: true, balanced: true, detailed: true }) }),
            Object.freeze({ key: 'actions', label: 'Actions', fieldId: null, header: '.col-actions', cell: '.actions-cell', hideable: false, resizable: true, defaultWidth: 180, min: 160, max: 320 })
        ])
    });

    const SETTINGS_TABLE_COLUMN_SCHEMA_MAP_BY_TYPE = Object.freeze({
        docker: Object.freeze(Object.fromEntries((SETTINGS_TABLE_COLUMN_SCHEMA_BY_TYPE.docker || []).map((entry) => [entry.key, entry]))),
        vm: Object.freeze(Object.fromEntries((SETTINGS_TABLE_COLUMN_SCHEMA_BY_TYPE.vm || []).map((entry) => [entry.key, entry])))
    });

    const DEFAULT_COLUMN_VISIBILITY_BY_TYPE = Object.freeze({
        docker: Object.freeze(Object.fromEntries(
            (SETTINGS_TABLE_COLUMN_SCHEMA_BY_TYPE.docker || [])
                .filter((entry) => entry.hideable === true)
                .map((entry) => [entry.key, entry.presets?.balanced !== false])
        )),
        vm: Object.freeze(Object.fromEntries(
            (SETTINGS_TABLE_COLUMN_SCHEMA_BY_TYPE.vm || [])
                .filter((entry) => entry.hideable === true)
                .map((entry) => [entry.key, entry.presets?.balanced !== false])
        ))
    });

    const SETTINGS_TABLE_WIDTH_PRESET_VALUES = Object.freeze({
        name: Object.freeze({ compact: 260, standard: 320, wide: 420 }),
        actions: Object.freeze({ compact: 160, standard: 180, wide: 240 })
    });

    const SETTINGS_TABLE_COLUMN_COUNT = 10;

    return Object.freeze({
        SETTINGS_TABLE_COLUMN_SCHEMA_BY_TYPE,
        SETTINGS_TABLE_COLUMN_SCHEMA_MAP_BY_TYPE,
        DEFAULT_COLUMN_VISIBILITY_BY_TYPE,
        SETTINGS_TABLE_WIDTH_PRESET_VALUES,
        SETTINGS_TABLE_COLUMN_COUNT
    });
}));
