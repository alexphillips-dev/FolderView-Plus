// @ts-check
(function fvplusFolderEditorSchemaScope(window) {
    'use strict';

    const PREVIEW_MODE_LABELS = Object.freeze({
        0: 'None',
        1: 'Icon and label',
        2: 'Only icon',
        3: 'Only label',
        4: 'List'
    });

    const CONTEXT_MODE_LABELS = Object.freeze({
        0: 'None',
        1: 'Default',
        2: 'Advanced'
    });

    const FOLDER_HEALTH_PROFILE_VALUES = Object.freeze(['strict', 'balanced', 'lenient']);
    const FOLDER_HEALTH_UPDATES_MODE_VALUES = Object.freeze(['maintenance', 'warn', 'ignore']);
    const FOLDER_HEALTH_ALL_STOPPED_MODE_VALUES = Object.freeze(['critical', 'warn']);
    const INVALID_FOLDER_NAME_CHAR_REGEX = /[\u0000-\u001f\u007f]/;

    const createModernSchema = (deps = {}) => {
        const sectionMeta = Object.freeze({
            general: Object.freeze({ title: 'General', description: 'Name, hierarchy, icon, and the folder identity shown across the plugin.', icon: 'fa-folder-open-o', advanced: false, supportsDefaults: false, supportsRevert: true }),
            members: Object.freeze({ title: 'Members', description: 'Search, assign, and order containers or VMs in this folder.', icon: 'fa-th-large', advanced: false, supportsDefaults: false, supportsRevert: false }),
            preview: Object.freeze({ title: 'Preview', description: 'How the folder row, preview layout, borders, and context surface render.', icon: 'fa-eye', advanced: false, supportsDefaults: true, supportsRevert: true }),
            chevron: Object.freeze({ title: 'Chevron', description: 'Chevron style, normal color, hover color, and interaction styling.', icon: 'fa-chevron-down', advanced: false, supportsDefaults: true, supportsRevert: true }),
            status: Object.freeze({ title: 'Status', description: 'Status palette, accent styling, and optional folder health or status thresholds.', icon: 'fa-heartbeat', advanced: false, supportsDefaults: true, supportsRevert: true }),
            rules: Object.freeze({ title: 'Rules', description: 'Regex auto-assignment and matching rules that keep the folder populated.', icon: 'fa-code', advanced: true, supportsDefaults: true, supportsRevert: true }),
            actions: Object.freeze({ title: 'Actions', description: 'Quick actions and custom folder actions available from the folder menu.', icon: 'fa-bolt', advanced: true, supportsDefaults: false, supportsRevert: false }),
            advanced: Object.freeze({ title: 'Advanced', description: 'Override behavior, expansion defaults, dashboard behavior, and niche controls.', icon: 'fa-sliders', advanced: true, supportsDefaults: true, supportsRevert: true })
        });

        const sectionFieldNames = Object.freeze({
            general: Object.freeze(['name', 'parent_folder_id', 'icon', 'folder_webui', 'folder_webui_url']),
            preview: Object.freeze([
                'preview',
                'preview_hover',
                'preview_update',
                'preview_text_width',
                'preview_rows',
                'preview_grayscale',
                'preview_status',
                'preview_webui',
                'preview_logs',
                'preview_console',
                'preview_vertical_bars',
                'preview_vertical_bars_color',
                'preview_vertical_bars_width',
                'preview_border',
                'preview_border_color',
                'preview_border_width',
                'context',
                'context_trigger',
                'context_graph',
                'context_graph_time'
            ]),
            chevron: Object.freeze(['dropdown_style', 'dropdown_color', 'dropdown_hover_color']),
            status: Object.freeze([
                'folder_accent_enabled',
                'folder_accent_color',
                'status_color_started',
                'status_color_paused',
                'status_color_stopped',
                'health_warn_stopped_percent',
                'health_critical_stopped_percent',
                'health_profile',
                'health_updates_mode',
                'health_all_stopped_mode',
                'status_warn_stopped_percent'
            ]),
            rules: Object.freeze(['regex']),
            advanced: Object.freeze(['update_column', 'override_default_actions', 'default_action', 'expand_tab', 'expand_dashboard', 'dashboard_overflow'])
        });

        const sectionDefaultValues = Object.freeze({
            preview: Object.freeze({
                preview: '1',
                preview_hover: false,
                preview_update: false,
                preview_text_width: '',
                preview_rows: '1',
                preview_grayscale: false,
                preview_status: 'symbol',
                preview_webui: false,
                preview_logs: false,
                preview_console: false,
                preview_vertical_bars: false,
                preview_vertical_bars_color: '',
                preview_vertical_bars_width: String(deps.defaultPreviewVerticalBarsWidth || 1),
                preview_border: true,
                preview_border_color: deps.defaultBorderColor || '#afa89e',
                preview_border_width: String(deps.defaultPreviewBorderWidth || 1),
                context: '1',
                context_trigger: '0',
                context_graph: '1',
                context_graph_time: '60'
            }),
            chevron: Object.freeze({
                dropdown_style: deps.defaultDropdownStyle || 'minimal',
                dropdown_color: deps.defaultDropdownColor || '#ff9a3c',
                dropdown_hover_color: deps.defaultDropdownHoverColor || '#111111'
            }),
            status: Object.freeze({
                folder_accent_enabled: false,
                folder_accent_color: deps.defaultFolderAccentColor || '#ffca63',
                status_color_started: deps.defaultFolderStatusColors?.started || '#ffffff',
                status_color_paused: deps.defaultFolderStatusColors?.paused || '#b8860b',
                status_color_stopped: deps.defaultFolderStatusColors?.stopped || '#ff4d4d',
                health_warn_stopped_percent: '',
                health_critical_stopped_percent: '',
                health_profile: '',
                health_updates_mode: '',
                health_all_stopped_mode: '',
                status_warn_stopped_percent: ''
            }),
            rules: Object.freeze({
                regex: ''
            }),
            advanced: Object.freeze({
                update_column: false,
                override_default_actions: false,
                default_action: false,
                expand_tab: false,
                expand_dashboard: false,
                dashboard_overflow: 'default'
            })
        });

        const inheritedFieldHints = Object.freeze({
            folder_webui_url: 'Using the folder default WebUI behavior until you set a custom URL here.',
            preview_text_width: 'Using automatic text width until you set a folder override here.',
            health_warn_stopped_percent: 'Using the global health warning threshold.',
            health_critical_stopped_percent: 'Using the global or profile-based critical threshold.',
            health_profile: 'Using the global health profile.',
            health_updates_mode: 'Using the global update-health policy.',
            health_all_stopped_mode: 'Using the global all-stopped health policy.',
            status_warn_stopped_percent: 'Using the global status warning threshold.'
        });

        const advancedSectionKeys = Object.freeze(
            Object.entries(sectionMeta)
                .filter(([, section]) => section?.advanced === true)
                .map(([key]) => key)
        );

        const sectionChangeLabels = Object.freeze({
            name: 'Folder name',
            parent_folder_id: 'Parent folder',
            icon: 'Folder icon',
            folder_webui: 'Folder WebUI',
            folder_webui_url: 'Folder WebUI URL',
            preview: 'Preview mode',
            preview_hover: 'Hover-only preview',
            preview_update: 'Update highlighting',
            preview_text_width: 'Preview text width',
            preview_rows: 'Preview rows',
            preview_grayscale: 'Preview grayscale',
            preview_status: 'Only-icon status',
            preview_webui: 'Preview WebUI action',
            preview_logs: 'Preview logs action',
            preview_console: 'Preview console action',
            preview_vertical_bars: 'Preview dividers',
            preview_vertical_bars_color: 'Divider color',
            preview_vertical_bars_width: 'Divider thickness',
            preview_border: 'Preview border',
            preview_border_color: 'Preview border color',
            preview_border_width: 'Preview border thickness',
            context: 'Context mode',
            context_trigger: 'Context trigger',
            context_graph: 'Graph display',
            context_graph_time: 'Graph time range',
            dropdown_style: 'Chevron style',
            dropdown_color: 'Chevron color',
            dropdown_hover_color: 'Chevron hover color',
            folder_accent_enabled: 'Accent color',
            folder_accent_color: 'Accent color value',
            status_color_started: 'Started status color',
            status_color_paused: 'Paused status color',
            status_color_stopped: 'Stopped status color',
            health_warn_stopped_percent: 'Health warn threshold',
            health_critical_stopped_percent: 'Health critical threshold',
            health_profile: 'Health profile',
            health_updates_mode: 'Health updates policy',
            health_all_stopped_mode: 'Health all-stopped policy',
            status_warn_stopped_percent: 'Status warn threshold',
            regex: 'Regex rule',
            update_column: 'Update column',
            override_default_actions: 'Override default actions',
            default_action: 'Default action',
            expand_tab: 'Expand on tab load',
            expand_dashboard: 'Expand on dashboard load',
            dashboard_overflow: 'Dashboard overflow mode'
        });

        return Object.freeze({
            SECTION_META: sectionMeta,
            SECTION_FIELD_NAMES: sectionFieldNames,
            SECTION_DEFAULT_VALUES: sectionDefaultValues,
            INHERITED_FIELD_HINTS: inheritedFieldHints,
            ADVANCED_SECTION_KEYS: advancedSectionKeys,
            SECTION_CHANGE_LABELS: sectionChangeLabels
        });
    };

    window.FolderViewPlusFolderEditorSchema = Object.freeze({
        PREVIEW_MODE_LABELS,
        CONTEXT_MODE_LABELS,
        FOLDER_HEALTH_PROFILE_VALUES,
        FOLDER_HEALTH_UPDATES_MODE_VALUES,
        FOLDER_HEALTH_ALL_STOPPED_MODE_VALUES,
        INVALID_FOLDER_NAME_CHAR_REGEX,
        createModernSchema
    });
    window.FolderViewPlusFolderEditorSchemaModuleLoaded = true;
})(window);
