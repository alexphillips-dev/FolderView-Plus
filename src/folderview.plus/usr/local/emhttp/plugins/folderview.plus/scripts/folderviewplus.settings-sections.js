/* Advanced settings section registry extracted from folderviewplus.js. */
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
    'auto-assignment',
    'bulk-assignment',
    'runtime-actions',
    'backups',
    'folder-templates',
    'change-history',
    'folder-health',
    'diagnostics',
    'conflict-inspector'
]);
const ADVANCED_GROUPS = ['automation', 'recovery', 'operations', 'diagnostics'];
const ADVANCED_GROUP_LABELS = {
    automation: 'Automation',
    recovery: 'Recovery',
    operations: 'Operations',
    diagnostics: 'Diagnostics'
};
const SECTION_APPLY_BEHAVIOR = Object.freeze({
    docker: 'instant',
    vms: 'instant'
});
const ADVANCED_GROUP_BY_SECTION = {
    'auto-assignment': 'automation',
    'bulk-assignment': 'automation',
    'conflict-inspector': 'automation',
    'backups': 'recovery',
    'change-history': 'recovery',
    'runtime-actions': 'operations',
    'folder-templates': 'operations',
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
    recovery: Object.freeze(['docker_backups', 'vm_backups', 'change_history']),
    operations: Object.freeze(['docker_templates', 'vm_templates']),
    diagnostics: Object.freeze(['change_history'])
});
const BASIC_WORKSPACE_SECTION_KEYS = new Set(['docker', 'vms']);

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
    BASIC_WORKSPACE_SECTION_KEYS
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
    BASIC_WORKSPACE_SECTION_KEYS
});
window.FolderViewPlusSettingsSectionsModuleLoaded = true;
