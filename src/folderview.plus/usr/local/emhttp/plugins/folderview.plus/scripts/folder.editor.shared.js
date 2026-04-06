// @ts-check
(function fvplusFolderEditorSharedScope(window) {
    'use strict';

    const createApi = (deps = {}) => {
        const normalizeDashboardOverflowMode = typeof deps.normalizeDashboardOverflowMode === 'function'
            ? deps.normalizeDashboardOverflowMode
            : ((value) => {
                const normalized = String(value || '').trim().toLowerCase();
                return ['default', 'expand_row', 'scroll'].includes(normalized)
                    ? normalized
                    : 'default';
            });

        const normalizeOptionalHealthSelect = (value, allowedValues) => {
            const normalized = String(value || '').trim().toLowerCase();
            if (!normalized) {
                return '';
            }
            return Array.isArray(allowedValues) && allowedValues.includes(normalized)
                ? normalized
                : '';
        };

        const parseOptionalThresholdInput = (value) => {
            const raw = String(value || '').trim();
            if (!raw) {
                return '';
            }
            const parsed = Number(raw);
            if (!Number.isFinite(parsed)) {
                return '';
            }
            return Math.min(100, Math.max(0, Math.round(parsed)));
        };

        const extractPreviewRowLimitValue = typeof deps.extractPreviewRowLimitValue === 'function'
            ? deps.extractPreviewRowLimitValue
            : ((value, fallbackSource = null) => {
                const sources = [value, fallbackSource];
                for (const source of sources) {
                    if (source && typeof source === 'object') {
                        const candidate = source.preview_rows
                            ?? source.previewRows;
                        if (candidate !== undefined && candidate !== null && String(candidate).trim() !== '') {
                            return candidate;
                        }
                    } else if (source !== undefined && source !== null && String(source).trim() !== '') {
                        return source;
                    }
                }
                return '';
            });

        const normalizePreviewRowLimit = typeof deps.normalizePreviewRowLimit === 'function'
            ? deps.normalizePreviewRowLimit
            : ((value, fallbackSource = null) => {
                const normalized = String(extractPreviewRowLimitValue(value, fallbackSource) ?? '').trim().toLowerCase();
                if (normalized === '0' || normalized === 'auto' || normalized === 'unlimited') {
                    return 0;
                }
                const parsed = Number.parseInt(normalized, 10);
                if (!Number.isFinite(parsed)) {
                    return 1;
                }
                return Math.max(1, Math.min(4, parsed));
            });

        const normalizeFolderRecordForEditor = (folder) => {
            const source = folder && typeof folder === 'object' ? folder : {};
            const settings = source.settings && typeof source.settings === 'object' ? source.settings : {};

            const toSafeInt = (value, fallback) => {
                const parsed = Number.parseInt(String(value ?? ''), 10);
                return Number.isFinite(parsed) ? parsed : fallback;
            };

            return {
                ...source,
                name: String(source.name || '').trim() || deps.defaultFolderName || 'Folder',
                icon: String(source.icon || '').trim() || deps.defaultFolderIconPath || '',
                regex: String(source.regex || ''),
                parentId: typeof deps.normalizeParentFolderId === 'function'
                    ? deps.normalizeParentFolderId(source.parentId || source.parent_id || '')
                    : String(source.parentId || source.parent_id || ''),
                containers: Array.from(
                    new Set(
                        (typeof deps.asArray === 'function' ? deps.asArray(source.containers) : [])
                            .map((entry) => String(entry || '').trim())
                            .filter(Boolean)
                    )
                ),
                actions: typeof deps.asArray === 'function' ? deps.asArray(source.actions) : [],
                settings: {
                    ...settings,
                    folder_webui: settings.folder_webui === true,
                    folder_webui_url: String(settings.folder_webui_url || ''),
                    preview: Number.isFinite(Number(settings.preview)) ? toSafeInt(settings.preview, 1) : 1,
                    preview_rows: normalizePreviewRowLimit(settings, source),
                    previewRows: normalizePreviewRowLimit(settings, source),
                    preview_hover: settings.preview_hover === true,
                    preview_update: settings.preview_update === true,
                    preview_text_width: String(settings.preview_text_width || ''),
                    preview_grayscale: settings.preview_grayscale === true,
                    preview_webui: settings.preview_webui === true,
                    preview_logs: settings.preview_logs === true,
                    preview_console: settings.preview_console === true,
                    preview_vertical_bars: settings.preview_vertical_bars === true,
                    context: Number.isFinite(Number(settings.context)) ? toSafeInt(settings.context, 1) : 1,
                    context_trigger: Number.isFinite(Number(settings.context_trigger)) ? toSafeInt(settings.context_trigger, 0) : 0,
                    context_graph: Number.isFinite(Number(settings.context_graph)) ? toSafeInt(settings.context_graph, 1) : 1,
                    context_graph_time: Number.isFinite(Number(settings.context_graph_time)) ? toSafeInt(settings.context_graph_time, 60) : 60,
                    preview_border: typeof deps.isPreviewBorderEnabled === 'function'
                        ? deps.isPreviewBorderEnabled(settings)
                        : true,
                    preview_border_color: typeof deps.normalizeHexColor === 'function'
                        ? deps.normalizeHexColor(settings.preview_border_color, deps.defaultBorderColor || '#afa89e')
                        : String(settings.preview_border_color || deps.defaultBorderColor || '#afa89e'),
                    preview_border_width: typeof deps.normalizePositiveInt === 'function'
                        ? deps.normalizePositiveInt(settings.preview_border_width, deps.defaultPreviewBorderWidth || 1, 1, 4)
                        : (deps.defaultPreviewBorderWidth || 1),
                    preview_vertical_bars_color: typeof deps.normalizeHexColor === 'function'
                        ? deps.normalizeHexColor(
                            settings.preview_vertical_bars_color || settings.preview_border_color,
                            deps.defaultBorderColor || '#afa89e'
                        )
                        : String(settings.preview_vertical_bars_color || settings.preview_border_color || deps.defaultBorderColor || '#afa89e'),
                    preview_vertical_bars_width: typeof deps.normalizePositiveInt === 'function'
                        ? deps.normalizePositiveInt(settings.preview_vertical_bars_width, deps.defaultPreviewVerticalBarsWidth || 1, 1, 4)
                        : (deps.defaultPreviewVerticalBarsWidth || 1),
                    dropdown_style: typeof deps.normalizeDropdownStyle === 'function'
                        ? deps.normalizeDropdownStyle(settings, source)
                        : (deps.defaultDropdownStyle || 'minimal'),
                    dropdown_color: typeof deps.normalizeHexColor === 'function'
                        ? deps.normalizeHexColor(settings.dropdown_color, deps.defaultDropdownColor || '#ff9a3c')
                        : String(settings.dropdown_color || deps.defaultDropdownColor || '#ff9a3c'),
                    dropdown_hover_color: typeof deps.normalizeHexColor === 'function'
                        ? deps.normalizeHexColor(settings.dropdown_hover_color, deps.defaultDropdownHoverColor || '#111111')
                        : String(settings.dropdown_hover_color || deps.defaultDropdownHoverColor || '#111111'),
                    folder_accent_enabled: typeof deps.isFolderAccentEnabled === 'function'
                        ? deps.isFolderAccentEnabled(settings)
                        : settings.folder_accent_enabled === true,
                    folder_accent_color: typeof deps.normalizeHexColor === 'function'
                        ? deps.normalizeHexColor(settings.folder_accent_color, deps.defaultFolderAccentColor || '#ffca63')
                        : String(settings.folder_accent_color || deps.defaultFolderAccentColor || '#ffca63'),
                    status_color_started: typeof deps.normalizeHexColor === 'function'
                        ? deps.normalizeHexColor(settings.status_color_started, deps.defaultFolderStatusColors?.started || '#ffffff')
                        : String(settings.status_color_started || deps.defaultFolderStatusColors?.started || '#ffffff'),
                    status_color_paused: typeof deps.normalizeHexColor === 'function'
                        ? deps.normalizeHexColor(settings.status_color_paused, deps.defaultFolderStatusColors?.paused || '#b8860b')
                        : String(settings.status_color_paused || deps.defaultFolderStatusColors?.paused || '#b8860b'),
                    status_color_stopped: typeof deps.normalizeHexColor === 'function'
                        ? deps.normalizeHexColor(settings.status_color_stopped, deps.defaultFolderStatusColors?.stopped || '#ff4d4d')
                        : String(settings.status_color_stopped || deps.defaultFolderStatusColors?.stopped || '#ff4d4d'),
                    health_warn_stopped_percent: parseOptionalThresholdInput(settings.health_warn_stopped_percent),
                    health_critical_stopped_percent: parseOptionalThresholdInput(settings.health_critical_stopped_percent),
                    health_profile: normalizeOptionalHealthSelect(settings.health_profile, deps.healthProfileValues || []),
                    health_updates_mode: normalizeOptionalHealthSelect(settings.health_updates_mode, deps.healthUpdatesModeValues || []),
                    health_all_stopped_mode: normalizeOptionalHealthSelect(settings.health_all_stopped_mode, deps.healthAllStoppedModeValues || []),
                    status_warn_stopped_percent: parseOptionalThresholdInput(settings.status_warn_stopped_percent),
                    update_column: settings.update_column === true,
                    default_action: settings.default_action === true,
                    expand_tab: settings.expand_tab === true,
                    override_default_actions: settings.override_default_actions === true,
                    expand_dashboard: settings.expand_dashboard === true,
                    dashboard_overflow: normalizeDashboardOverflowMode(settings.dashboard_overflow)
                }
            };
        };

        return Object.freeze({
            normalizeOptionalHealthSelect,
            parseOptionalThresholdInput,
            normalizeDashboardOverflowMode,
            extractPreviewRowLimitValue,
            normalizePreviewRowLimit,
            normalizeFolderRecordForEditor
        });
    };

    const createResetHelpers = (deps = {}) => {
        const getForm = typeof deps.getForm === 'function' ? deps.getForm : () => null;
        const afterVisualChange = typeof deps.afterVisualChange === 'function' ? deps.afterVisualChange : () => {};
        const updateLiveSummary = typeof deps.updateLiveSummary === 'function' ? deps.updateLiveSummary : () => {};

        const resetPreviewBorderDefaults = () => {
            const form = getForm();
            if (!form) {
                return;
            }
            form.preview_border_color.value = deps.defaultBorderColor || '#afa89e';
            form.preview_border_width.value = String(deps.defaultPreviewBorderWidth || 1);
            afterVisualChange();
            updateLiveSummary();
        };

        const resetDropdownColorDefaults = () => {
            const form = getForm();
            if (!form) {
                return;
            }
            form.dropdown_color.value = deps.defaultDropdownColor || '#ff9a3c';
            form.dropdown_hover_color.value = deps.defaultDropdownHoverColor || '#111111';
            afterVisualChange();
            updateLiveSummary();
        };

        const resetFolderAccentDefaults = () => {
            const form = getForm();
            if (!form) {
                return;
            }
            form.folder_accent_enabled.checked = false;
            form.folder_accent_color.value = deps.defaultFolderAccentColor || '#ffca63';
            afterVisualChange();
            updateLiveSummary();
        };

        return Object.freeze({
            resetPreviewBorderDefaults,
            resetDropdownColorDefaults,
            resetFolderAccentDefaults
        });
    };

    window.FolderViewPlusFolderEditorShared = Object.freeze({
        createApi,
        createResetHelpers
    });
})(window);
