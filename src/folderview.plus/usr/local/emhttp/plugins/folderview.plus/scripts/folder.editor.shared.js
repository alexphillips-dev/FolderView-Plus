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
        const normalizePreviewOverflowMode = (value) => {
            const normalized = String(value || '').trim().toLowerCase();
            return ['default', 'expand_row', 'scroll'].includes(normalized) ? normalized : 'default';
        };

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

        const normalizeChildFolderPreviewDepth = typeof deps.normalizeChildFolderPreviewDepth === 'function'
            ? deps.normalizeChildFolderPreviewDepth
            : ((value, fallbackSource = null) => {
                const sources = [value, fallbackSource];
                for (const source of sources) {
                    const candidate = source && typeof source === 'object'
                        ? (source.preview_child_folder_depth ?? source.previewChildFolderDepth)
                        : source;
                    const normalized = String(candidate ?? '').trim().toLowerCase();
                    if (!normalized) {
                        continue;
                    }
                    if (normalized === '0' || normalized === 'all' || normalized === 'unlimited') {
                        return 0;
                    }
                    const parsed = Number.parseInt(normalized, 10);
                    if (Number.isFinite(parsed)) {
                        return Math.max(1, Math.min(3, parsed));
                    }
                }
                return 0;
            });

        const normalizeChildFolderOrder = (value) => {
            const source = Array.isArray(value) ? value : [];
            const seen = new Set();
            const result = [];
            source.forEach((entry) => {
                const id = String(entry || '').trim();
                if (!id || seen.has(id)) {
                    return;
                }
                seen.add(id);
                result.push(id);
            });
            return result;
        };

        const normalizePreviewHoverAnimation = (value) => {
            const normalized = String(value || '').trim().toLowerCase();
            const aliases = { grow: 'pop', pulse: 'glow', spin: 'flip' };
            const token = aliases[normalized] || normalized;
            return ['none', 'lift', 'bounce', 'pop', 'glow', 'flip', 'wiggle'].includes(token)
                ? token
                : 'none';
        };

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
                hiddenPreviewMembers: Array.from(new Set(
                    (typeof deps.asArray === 'function'
                        ? deps.asArray(source.hiddenPreviewMembers || source.hidden_preview)
                        : (Array.isArray(source.hiddenPreviewMembers) ? source.hiddenPreviewMembers : []))
                        .map((entry) => String(entry || '').trim())
                        .filter((entry) => entry && (Array.isArray(source.containers) ? source.containers : []).includes(entry))
                )),
                memberIdentities: source.memberIdentities && typeof source.memberIdentities === 'object'
                    ? { ...source.memberIdentities }
                    : {},
                actions: typeof deps.asArray === 'function' ? deps.asArray(source.actions) : [],
                settings: {
                    ...settings,
                    folder_webui: settings.folder_webui === true,
                    folder_webui_url: String(settings.folder_webui_url || ''),
                    preview: Number.isFinite(Number(settings.preview)) ? toSafeInt(settings.preview, 1) : 1,
                    preview_rows: normalizePreviewRowLimit(settings, source),
                    previewRows: normalizePreviewRowLimit(settings, source),
                    preview_overflow: normalizePreviewOverflowMode(settings.preview_overflow || settings.previewOverflow),
                    previewOverflow: normalizePreviewOverflowMode(settings.preview_overflow || settings.previewOverflow),
                    preview_hover: settings.preview_hover === true,
                    preview_hover_animation: normalizePreviewHoverAnimation(settings.preview_hover_animation || settings.previewHoverAnimation),
                    previewHoverAnimation: normalizePreviewHoverAnimation(settings.preview_hover_animation || settings.previewHoverAnimation),
                    preview_update: settings.preview_update === true,
                    folder_update_highlight: settings.folder_update_highlight === true || settings.folderUpdateHighlight === true,
                    preview_text_width: String(settings.preview_text_width || ''),
                    preview_grayscale: settings.preview_grayscale === true,
                    preview_status: (() => {
                        const normalized = String(settings.preview_status || '').trim().toLowerCase();
                        if (['none', 'hide', 'hidden', 'off', 'false', '0', 'no'].includes(normalized)) {
                            return 'none';
                        }
                        return ['symbol', 'grayscale'].includes(normalized) ? normalized : 'symbol';
                    })(),
                    preview_hide_nested_items: settings.preview_hide_nested_items === true || settings.previewHideNestedItems === true,
                    previewHideNestedItems: settings.preview_hide_nested_items === true || settings.previewHideNestedItems === true,
                    child_folder_order: normalizeChildFolderOrder(settings.child_folder_order || settings.childFolderOrder),
                    childFolderOrder: normalizeChildFolderOrder(settings.child_folder_order || settings.childFolderOrder),
                    preview_child_folder_depth: normalizeChildFolderPreviewDepth(settings, source),
                    previewChildFolderDepth: normalizeChildFolderPreviewDepth(settings, source),
                    preview_webui: settings.preview_webui === true,
                    preview_logs: settings.preview_logs === true,
                    preview_console: settings.preview_console === true,
                    preview_vertical_bars: settings.preview_vertical_bars === true,
                    preview_row_separator: settings.preview_row_separator === true || settings.previewRowSeparator === true,
                    preview_row_separator_color: typeof deps.normalizeHexColor === 'function'
                        ? deps.normalizeHexColor(settings.preview_row_separator_color, deps.defaultBorderColor || '#afa89e')
                        : String(settings.preview_row_separator_color || deps.defaultBorderColor || '#afa89e'),
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
                    preview_border_glow: settings.preview_border_glow === true || settings.previewBorderGlow === true,
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
                    status_color_started: (() => {
                        const defaultStarted = deps.defaultFolderStatusColors?.started || '#55b72d';
                        const normalizedStarted = typeof deps.normalizeHexColor === 'function'
                            ? deps.normalizeHexColor(settings.status_color_started, defaultStarted)
                            : String(settings.status_color_started || defaultStarted).toLowerCase();
                        const startedExplicit = settings.status_color_started_explicit === true
                            || settings.statusColorStartedExplicit === true;
                        return !startedExplicit && normalizedStarted === '#ffffff'
                            ? defaultStarted
                            : normalizedStarted;
                    })(),
                    status_color_started_explicit: settings.status_color_started_explicit === true
                        || settings.statusColorStartedExplicit === true,
                    status_color_paused: typeof deps.normalizeHexColor === 'function'
                        ? deps.normalizeHexColor(settings.status_color_paused, deps.defaultFolderStatusColors?.paused || '#b8860b')
                        : String(settings.status_color_paused || deps.defaultFolderStatusColors?.paused || '#b8860b'),
                    status_color_stopped: typeof deps.normalizeHexColor === 'function'
                        ? deps.normalizeHexColor(settings.status_color_stopped, deps.defaultFolderStatusColors?.stopped || '#ff4d4d')
                        : String(settings.status_color_stopped || deps.defaultFolderStatusColors?.stopped || '#ff4d4d'),
                    status_color_text: typeof deps.normalizeHexColor === 'function'
                        ? deps.normalizeHexColor(settings.status_color_text, deps.defaultFolderStatusColors?.text || '#ffffff')
                        : String(settings.status_color_text || deps.defaultFolderStatusColors?.text || '#ffffff'),
                    status_color_text_explicit: (() => {
                        const hasExplicitMarker = Object.prototype.hasOwnProperty.call(settings, 'status_color_text_explicit')
                            || Object.prototype.hasOwnProperty.call(settings, 'statusColorTextExplicit');
                        if (hasExplicitMarker) {
                            return settings.status_color_text_explicit === true || settings.statusColorTextExplicit === true;
                        }
                        const normalizedText = typeof deps.normalizeHexColor === 'function'
                            ? deps.normalizeHexColor(settings.status_color_text, deps.defaultFolderStatusColors?.text || '#ffffff')
                            : String(settings.status_color_text || deps.defaultFolderStatusColors?.text || '#ffffff').toLowerCase();
                        return normalizedText !== (deps.defaultFolderStatusColors?.text || '#ffffff');
                    })(),
                    status_color_lock: settings.status_color_lock === true || settings.statusColorLock === true,
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
            normalizePreviewOverflowMode,
            extractPreviewRowLimitValue,
            normalizePreviewRowLimit,
            normalizeChildFolderPreviewDepth,
            normalizePreviewHoverAnimation,
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
