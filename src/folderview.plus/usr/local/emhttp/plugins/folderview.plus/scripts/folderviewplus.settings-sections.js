/* Advanced settings section registry extracted from folderviewplus.js. */
(() => {
const ADVANCED_TAB_STORAGE_KEY = 'fv.settings.advancedTab.v1';
const ADVANCED_SECTION_STORAGE_KEY = 'fv.settings.advancedSection.v1';
const ADVANCED_EXPANDED_STORAGE_KEY = 'fv.settings.advancedExpanded.v2';
const ADVANCED_KNOWN_STORAGE_KEY = 'fv.settings.advancedKnown.v1';
const SEARCH_ALL_ADVANCED_STORAGE_KEY = 'fv.settings.searchAllAdvanced.v1';

const LEGACY_ADVANCED_SECTION_KEYS = [
    'auto-assignment',
    'bulk-assignment',
    'runtime-actions',
    'backups',
    'folder-templates',
    'change-history',
    'diagnostics',
    'conflict-inspector'
];
const ADVANCED_SECTION_KEYS = new Set([
    'theme-workspace',
    'auto-assignment',
    'bulk-assignment',
    'runtime-actions',
    'docker-start-order',
    'backups',
    'change-history',
    'folder-health',
    'diagnostics',
    'conflict-inspector'
]);
const ADVANCED_GROUPS = ['automation', 'rules', 'recovery', 'operations', 'startup', 'appearance', 'diagnostics'];
const ADVANCED_GROUP_LABELS = {
    automation: 'Automation',
    rules: 'Rules',
    recovery: 'Recovery',
    operations: 'Operations',
    startup: 'Start Order',
    appearance: 'Appearance',
    diagnostics: 'Diagnostics'
};
const SECTION_APPLY_BEHAVIOR = Object.freeze({
    customizations: 'instant',
    docker: 'instant',
    vms: 'instant',
    'theme-workspace': 'instant',
    'auto-assignment': 'instant',
    'conflict-inspector': 'instant',
    'bulk-assignment': 'instant',
    'runtime-actions': 'instant',
    'docker-start-order': 'instant',
    backups: 'instant',
    'change-history': 'instant',
    'folder-health': 'instant',
    diagnostics: 'instant'
});
const ADVANCED_GROUP_BY_SECTION = {
    'theme-workspace': 'appearance',
    'auto-assignment': 'rules',
    'bulk-assignment': 'automation',
    'conflict-inspector': 'rules',
    'backups': 'recovery',
    'change-history': 'recovery',
    'runtime-actions': 'operations',
    'docker-start-order': 'startup',
    'folder-health': 'diagnostics',
    'diagnostics': 'diagnostics'
};
const ADVANCED_MODULE_STALE_MS = 1000 * 60 * 2;
const ADVANCED_MODULE_KEYS = Object.freeze([
    'docker_backups',
    'vm_backups',
    'docker_templates',
    'vm_templates',
    'change_history'
]);
const ADVANCED_MODULE_KEYS_BY_TAB = Object.freeze({
    automation: Object.freeze([]),
    rules: Object.freeze([]),
    recovery: Object.freeze(['docker_backups', 'vm_backups', 'change_history']),
    operations: Object.freeze(['docker_templates', 'vm_templates']),
    startup: Object.freeze([]),
    appearance: Object.freeze([]),
    diagnostics: Object.freeze(['change_history'])
});
const BASIC_WORKSPACE_SECTION_KEYS = new Set(['docker', 'vms']);
const SETTINGS_SEARCH_ALIASES_BY_SECTION = Object.freeze({
    docker: Object.freeze([
        'docker dashboard preview',
        'advanced popup',
        'webui console logs',
        'hide status',
        'preview status',
        'only icon status',
        'folder field size',
        'name overflow',
        'dashboard overlap',
        'folder defaults',
        'lazy preview'
    ]),
    vms: Object.freeze([
        'vm dashboard preview',
        'hide status',
        'preview status',
        'only icon status',
        'folder field size',
        'name overflow',
        'folder defaults',
        'lazy preview'
    ]),
    'bulk-assignment': Object.freeze([
        'batch update',
        'apply update',
        'bulk update containers',
        'updating folder containers',
        'preview changes'
    ]),
    'runtime-actions': Object.freeze([
        'native organizer',
        'docker organizer',
        'sync dashboard folders',
        'runtime actions',
        'bulk start stop restart pause resume'
    ]),
    'docker-start-order': Object.freeze([
        'docker start order',
        'docker startup order',
        'boot order',
        'autostart order',
        'startup batches',
        'container start sequence'
    ]),
    diagnostics: Object.freeze([
        'native organizer',
        'docker organizer',
        'support bundle',
        'issue report',
        'health check',
        'copy diagnostics'
    ]),
    'folder-health': Object.freeze([
        'health cards',
        'stopped folders',
        'empty folders',
        'updates status',
        'conflict status'
    ]),
    'theme-workspace': Object.freeze([
        'theme fallback',
        'custom css',
        'high contrast',
        'safe palette'
    ])
});

Object.assign(window, {
    ADVANCED_TAB_STORAGE_KEY,
    ADVANCED_SECTION_STORAGE_KEY,
    ADVANCED_EXPANDED_STORAGE_KEY,
    ADVANCED_KNOWN_STORAGE_KEY,
    SEARCH_ALL_ADVANCED_STORAGE_KEY,
    LEGACY_ADVANCED_SECTION_KEYS,
    ADVANCED_SECTION_KEYS,
    ADVANCED_GROUPS,
    ADVANCED_GROUP_LABELS,
    SECTION_APPLY_BEHAVIOR,
    ADVANCED_GROUP_BY_SECTION,
    ADVANCED_MODULE_STALE_MS,
    ADVANCED_MODULE_KEYS,
    ADVANCED_MODULE_KEYS_BY_TAB,
    BASIC_WORKSPACE_SECTION_KEYS,
    SETTINGS_SEARCH_ALIASES_BY_SECTION
});

window.FolderViewPlusSettingsSections = Object.freeze({
    ADVANCED_TAB_STORAGE_KEY,
    ADVANCED_SECTION_STORAGE_KEY,
    ADVANCED_EXPANDED_STORAGE_KEY,
    ADVANCED_KNOWN_STORAGE_KEY,
    SEARCH_ALL_ADVANCED_STORAGE_KEY,
    LEGACY_ADVANCED_SECTION_KEYS,
    ADVANCED_SECTION_KEYS,
    ADVANCED_GROUPS,
    ADVANCED_GROUP_LABELS,
    SECTION_APPLY_BEHAVIOR,
    ADVANCED_GROUP_BY_SECTION,
    ADVANCED_MODULE_STALE_MS,
    ADVANCED_MODULE_KEYS,
    ADVANCED_MODULE_KEYS_BY_TAB,
    BASIC_WORKSPACE_SECTION_KEYS,
    SETTINGS_SEARCH_ALIASES_BY_SECTION
});
window.FolderViewPlusSettingsSectionsModuleLoaded = true;
})();
