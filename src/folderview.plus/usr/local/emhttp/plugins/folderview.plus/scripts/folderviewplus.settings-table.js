(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusSettingsTable = factory();
    root.FolderViewPlusSettingsTableModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const settingsMetadata = (typeof globalThis !== 'undefined' ? globalThis.FolderViewPlusSettingsMetadata : null) || null;

    const SETTINGS_TABLE_COLUMN_SCHEMA_BY_TYPE = settingsMetadata?.SETTINGS_TABLE_COLUMN_SCHEMA_BY_TYPE || Object.freeze({
        docker: Object.freeze([]),
        vm: Object.freeze([])
    });
    const DEFAULT_COLUMN_VISIBILITY_BY_TYPE = settingsMetadata?.DEFAULT_COLUMN_VISIBILITY_BY_TYPE || Object.freeze({
        docker: Object.freeze({}),
        vm: Object.freeze({})
    });
    const SETTINGS_TABLE_WIDTH_PRESET_VALUES = settingsMetadata?.SETTINGS_TABLE_WIDTH_PRESET_VALUES || Object.freeze({
        name: Object.freeze({ compact: 260, standard: 320, wide: 420 }),
        actions: Object.freeze({ compact: 160, standard: 180, wide: 240 })
    });

    const TABLE_COLUMN_SELECTOR_MAP = Object.freeze({
        docker: Object.freeze(Object.fromEntries(
            (SETTINGS_TABLE_COLUMN_SCHEMA_BY_TYPE.docker || [])
                .filter((entry) => entry.hideable === true)
                .map((entry) => [entry.key, Object.freeze({ header: entry.header, cell: entry.cell })])
        )),
        vm: Object.freeze(Object.fromEntries(
            (SETTINGS_TABLE_COLUMN_SCHEMA_BY_TYPE.vm || [])
                .filter((entry) => entry.hideable === true)
                .map((entry) => [entry.key, Object.freeze({ header: entry.header, cell: entry.cell })])
        ))
    });

    const normalizeSettingsTableColumnWidthPreset = (value) => {
        const normalized = String(value || '').trim().toLowerCase();
        return ['compact', 'standard', 'wide'].includes(normalized) ? normalized : 'standard';
    };

    const normalizeSettingsTablePreset = (value) => {
        const normalized = String(value || '').trim().toLowerCase();
        return ['compact', 'balanced', 'detailed', 'custom'].includes(normalized) ? normalized : 'balanced';
    };

    const buildPresetColumnVisibilityForType = (type, preset = 'balanced') => {
        const resolvedType = type === 'vm' ? 'vm' : 'docker';
        const normalizedPreset = normalizeSettingsTablePreset(preset);
        const schema = SETTINGS_TABLE_COLUMN_SCHEMA_BY_TYPE[resolvedType] || [];
        const defaults = {};
        schema.forEach((entry) => {
            if (entry.hideable !== true) {
                return;
            }
            defaults[entry.key] = entry.presets?.[normalizedPreset] !== false;
        });
        return defaults;
    };

    const normalizeColumnVisibilityForType = (type, value = null) => {
        const resolvedType = type === 'vm' ? 'vm' : 'docker';
        const defaults = DEFAULT_COLUMN_VISIBILITY_BY_TYPE[resolvedType] || {};
        const source = value && typeof value === 'object' ? value : {};
        const normalized = {};
        Object.keys(defaults).forEach((key) => {
            normalized[key] = Object.prototype.hasOwnProperty.call(source, key)
                ? source[key] !== false
                : defaults[key] === true;
        });
        if (resolvedType === 'docker' && !Object.prototype.hasOwnProperty.call(source, 'signals')) {
            const updatesHidden = source.updates === false;
            const healthHidden = source.health === false;
            if (updatesHidden && healthHidden) {
                normalized.signals = false;
            }
        }
        return normalized;
    };

    const TABLE_COLUMN_RESIZE_CONFIG_BY_TYPE = Object.freeze({
        docker: Object.freeze(Object.fromEntries(
            (SETTINGS_TABLE_COLUMN_SCHEMA_BY_TYPE.docker || [])
                .filter((entry) => entry.resizable !== false)
                .map((entry) => [entry.key, Object.freeze({
                    header: entry.header,
                    cell: entry.cell,
                    min: entry.min,
                    max: entry.max,
                    defaultWidth: entry.defaultWidth
                })])
        )),
        vm: Object.freeze(Object.fromEntries(
            (SETTINGS_TABLE_COLUMN_SCHEMA_BY_TYPE.vm || [])
                .filter((entry) => entry.resizable !== false)
                .map((entry) => [entry.key, Object.freeze({
                    header: entry.header,
                    cell: entry.cell,
                    min: entry.min,
                    max: entry.max,
                    defaultWidth: entry.defaultWidth
                })])
        ))
    });

    const TABLE_COLUMN_RESIZE_KEYS_BY_TYPE = Object.freeze({
        docker: Object.freeze(Object.keys(TABLE_COLUMN_RESIZE_CONFIG_BY_TYPE.docker)),
        vm: Object.freeze(Object.keys(TABLE_COLUMN_RESIZE_CONFIG_BY_TYPE.vm))
    });

    const normalizeSingleColumnWidth = (type, key, value) => {
        const resolvedType = type === 'vm' ? 'vm' : 'docker';
        const config = TABLE_COLUMN_RESIZE_CONFIG_BY_TYPE[resolvedType]?.[key];
        if (!config) {
            return null;
        }
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
            return null;
        }
        const min = Number(config.min) || 60;
        const max = Number(config.max) || 900;
        return Math.round(Math.min(max, Math.max(min, parsed)));
    };

    const buildDefaultColumnWidthsForType = (type) => {
        const resolvedType = type === 'vm' ? 'vm' : 'docker';
        const configByKey = TABLE_COLUMN_RESIZE_CONFIG_BY_TYPE[resolvedType] || {};
        const widths = {};
        Object.entries(configByKey).forEach(([key, config]) => {
            const defaultWidth = normalizeSingleColumnWidth(resolvedType, key, config.defaultWidth);
            if (defaultWidth !== null) {
                widths[key] = defaultWidth;
            }
        });
        return widths;
    };

    const buildEffectiveSettingsTableWidths = (type, widthPresets = {}) => {
        const resolvedType = type === 'vm' ? 'vm' : 'docker';
        const next = buildDefaultColumnWidthsForType(resolvedType);
        const nameWidthPreset = normalizeSettingsTableColumnWidthPreset(widthPresets.name);
        const actionsWidthPreset = normalizeSettingsTableColumnWidthPreset(widthPresets.actions);
        next.name = normalizeSingleColumnWidth(resolvedType, 'name', SETTINGS_TABLE_WIDTH_PRESET_VALUES.name[nameWidthPreset]) || next.name;
        next.actions = normalizeSingleColumnWidth(resolvedType, 'actions', SETTINGS_TABLE_WIDTH_PRESET_VALUES.actions[actionsWidthPreset]) || next.actions;
        return next;
    };

    return Object.freeze({
        SETTINGS_TABLE_COLUMN_SCHEMA_BY_TYPE,
        DEFAULT_COLUMN_VISIBILITY_BY_TYPE,
        SETTINGS_TABLE_WIDTH_PRESET_VALUES,
        TABLE_COLUMN_SELECTOR_MAP,
        TABLE_COLUMN_RESIZE_CONFIG_BY_TYPE,
        TABLE_COLUMN_RESIZE_KEYS_BY_TYPE,
        normalizeSettingsTableColumnWidthPreset,
        normalizeSettingsTablePreset,
        buildPresetColumnVisibilityForType,
        normalizeColumnVisibilityForType,
        normalizeSingleColumnWidth,
        buildDefaultColumnWidthsForType,
        buildEffectiveSettingsTableWidths
    });
}));
