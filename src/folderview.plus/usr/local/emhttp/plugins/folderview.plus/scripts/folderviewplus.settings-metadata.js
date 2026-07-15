// Generated from schemas/settings-table.schema.json. Run scripts/generate_settings_metadata.mjs after editing the schema.
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusSettingsMetadata = factory();
    root.FolderViewPlusSettingsMetadataModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const CANONICAL_SETTINGS_TABLE_SCHEMA = {"schemaVersion":1,"columnCount":10,"types":{"docker":[{"key":"order","label":"Order","fieldId":null,"header":".col-order","cell":".order-cell","hideable":false,"resizable":true,"defaultWidth":92,"min":64,"max":220},{"key":"name","label":"Name","fieldId":null,"header":".col-name","cell":".name-cell","hideable":false,"resizable":true,"defaultWidth":320,"min":220,"max":820},{"key":"members","label":"Members","fieldId":"docker-col-members","header":".col-members","cell":".members-cell","hideable":true,"resizable":true,"defaultWidth":112,"min":90,"max":260,"presets":{"compact":false,"balanced":false,"detailed":true}},{"key":"status","label":"Status","fieldId":"docker-col-status","header":".col-status","cell":".status-cell","hideable":true,"resizable":true,"defaultWidth":220,"min":170,"max":620,"presets":{"compact":true,"balanced":true,"detailed":true}},{"key":"rules","label":"Rules","fieldId":"docker-col-rules","header":".col-rules","cell":".rules-cell","hideable":true,"resizable":true,"defaultWidth":110,"min":80,"max":240,"presets":{"compact":true,"balanced":true,"detailed":true}},{"key":"lastChanged","label":"Last changed","fieldId":"docker-col-last-changed","header":".col-last-changed","cell":".last-changed-cell","hideable":true,"resizable":true,"defaultWidth":180,"min":150,"max":360,"presets":{"compact":false,"balanced":true,"detailed":true}},{"key":"pinned","label":"Pinned","fieldId":"docker-col-pinned","header":".col-pinned","cell":".pinned-cell","hideable":true,"resizable":true,"defaultWidth":96,"min":80,"max":200,"presets":{"compact":false,"balanced":true,"detailed":true}},{"key":"signals","label":"Alerts","fieldId":"docker-col-signals","header":".col-signals","cell":".signals-cell","hideable":true,"resizable":true,"defaultWidth":180,"min":120,"max":360,"presets":{"compact":true,"balanced":true,"detailed":true}},{"key":"actions","label":"Actions","fieldId":null,"header":".col-actions","cell":".actions-cell","hideable":false,"resizable":true,"defaultWidth":180,"min":160,"max":320}],"vm":[{"key":"order","label":"Order","fieldId":null,"header":".col-order","cell":".order-cell","hideable":false,"resizable":true,"defaultWidth":92,"min":64,"max":220},{"key":"name","label":"Name","fieldId":null,"header":".col-name","cell":".name-cell","hideable":false,"resizable":true,"defaultWidth":320,"min":220,"max":820},{"key":"members","label":"Members","fieldId":"vm-col-members","header":".col-members","cell":".members-cell","hideable":true,"resizable":true,"defaultWidth":112,"min":90,"max":260,"presets":{"compact":false,"balanced":false,"detailed":true}},{"key":"status","label":"Status","fieldId":"vm-col-status","header":".col-status","cell":".status-cell","hideable":true,"resizable":true,"defaultWidth":220,"min":170,"max":620,"presets":{"compact":false,"balanced":false,"detailed":true}},{"key":"rules","label":"Rules","fieldId":"vm-col-rules","header":".col-rules","cell":".rules-cell","hideable":true,"resizable":true,"defaultWidth":110,"min":80,"max":240,"presets":{"compact":false,"balanced":false,"detailed":true}},{"key":"lastChanged","label":"Last changed","fieldId":"vm-col-last-changed","header":".col-last-changed","cell":".last-changed-cell","hideable":true,"resizable":true,"defaultWidth":180,"min":150,"max":360,"presets":{"compact":false,"balanced":false,"detailed":true}},{"key":"pinned","label":"Pinned","fieldId":"vm-col-pinned","header":".col-pinned","cell":".pinned-cell","hideable":true,"resizable":true,"defaultWidth":96,"min":80,"max":200,"presets":{"compact":false,"balanced":true,"detailed":true}},{"key":"autostart","label":"Autostart","fieldId":"vm-col-autostart","header":".col-autostart","cell":".autostart-cell","hideable":true,"resizable":true,"defaultWidth":160,"min":130,"max":300,"presets":{"compact":true,"balanced":true,"detailed":true}},{"key":"resources","label":"Resources","fieldId":"vm-col-resources","header":".col-resources","cell":".resources-cell","hideable":true,"resizable":true,"defaultWidth":210,"min":170,"max":420,"presets":{"compact":true,"balanced":true,"detailed":true}},{"key":"actions","label":"Actions","fieldId":null,"header":".col-actions","cell":".actions-cell","hideable":false,"resizable":true,"defaultWidth":180,"min":160,"max":320}]},"widthPresets":{"name":{"compact":260,"standard":320,"wide":420},"actions":{"compact":160,"standard":180,"wide":240}}};
    const freezeEntry = (entry) => Object.freeze({
        ...entry,
        ...(entry.presets ? { presets: Object.freeze({ ...entry.presets }) } : {})
    });
    const SETTINGS_TABLE_COLUMN_SCHEMA_BY_TYPE = Object.freeze(Object.fromEntries(
        Object.entries(CANONICAL_SETTINGS_TABLE_SCHEMA.types || {}).map(([type, entries]) => [
            type,
            Object.freeze((entries || []).map(freezeEntry))
        ])
    ));
    const SETTINGS_TABLE_COLUMN_SCHEMA_MAP_BY_TYPE = Object.freeze(Object.fromEntries(
        Object.entries(SETTINGS_TABLE_COLUMN_SCHEMA_BY_TYPE).map(([type, entries]) => [
            type,
            Object.freeze(Object.fromEntries(entries.map((entry) => [entry.key, entry])))
        ])
    ));
    const DEFAULT_COLUMN_VISIBILITY_BY_TYPE = Object.freeze(Object.fromEntries(
        Object.entries(SETTINGS_TABLE_COLUMN_SCHEMA_BY_TYPE).map(([type, entries]) => [
            type,
            Object.freeze(Object.fromEntries(
                entries.filter((entry) => entry.hideable === true).map((entry) => [entry.key, entry.presets?.balanced !== false])
            ))
        ])
    ));
    const SETTINGS_TABLE_WIDTH_PRESET_VALUES = Object.freeze({
        "name": Object.freeze({"compact":260,"standard":320,"wide":420}),
        "actions": Object.freeze({"compact":160,"standard":180,"wide":240})
    });
    const SETTINGS_TABLE_COLUMN_COUNT = 10;

    return Object.freeze({
        SETTINGS_METADATA_SCHEMA_VERSION: Number(CANONICAL_SETTINGS_TABLE_SCHEMA.schemaVersion || 0),
        SETTINGS_TABLE_COLUMN_SCHEMA_BY_TYPE,
        SETTINGS_TABLE_COLUMN_SCHEMA_MAP_BY_TYPE,
        DEFAULT_COLUMN_VISIBILITY_BY_TYPE,
        SETTINGS_TABLE_WIDTH_PRESET_VALUES,
        SETTINGS_TABLE_COLUMN_COUNT
    });
}));
