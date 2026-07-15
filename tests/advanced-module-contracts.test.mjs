import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const settingsScriptPaths = [
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.runtime-parity.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-metadata.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-sections.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-table.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.setup-assistant.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.smart-detect-config.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.starter-templates.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.support-bundle-preview.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.support-bundle-browser.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.support-bundle-telemetry.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.activity-diagnostics.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.folder-editor.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-health.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-workspaces.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.bulk-assignment.shared.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.bulk-assignment.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.runtime-actions.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-tree.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.actions-support.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js'
].map((relativePath) => path.join(repoRoot, relativePath));
const settingsSectionsScript = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-sections.js'),
    'utf8'
);
const script = settingsScriptPaths.map((scriptPath) => fs.readFileSync(scriptPath, 'utf8')).join('\n');

test('advanced module loader uses per-module stale state with scoped tab targeting', () => {
    assert.match(script, /const ADVANCED_MODULE_STALE_MS = 1000 \* 60 \* 2;/);
    assert.match(script, /const ADVANCED_MODULE_KEYS = Object\.freeze\(\[/);
    assert.match(script, /const ADVANCED_MODULE_KEYS_BY_TAB = Object\.freeze\(\{/);
    assert.match(script, /const createAdvancedModuleLoadEntry = \(\) => \(\{/);
    assert.match(script, /modules:\s*\{\s*docker_backups:/);
    assert.match(script, /const getRequestedAdvancedModuleKeys = \(\{/);
    assert.match(script, /const ensureAdvancedDataLoaded = async \(options = \{\}\) =>/);
    assert.match(script, /Promise\.allSettled\(requestedModules\.map\(\(moduleKey\) => runModuleRefresh\(moduleKey\)\)\)/);
    assert.match(script, /const isAdvancedModuleStale = \(moduleKey, force = false\) =>/);
});

test('advanced search and bulk filter state are persisted as part of table ui state', () => {
    assert.match(script, /advancedSearch:\s*\{\s*byTab:\s*normalizeAdvancedSearchMap\(settingsUiState\.advancedSearchByTab\)/);
    assert.match(script, /filtersByType\[resolvedType\] = \{\s*[\s\S]*bulk:\s*normalizedFilter\(perTypeFilters\.bulk\)/);
    assert.match(script, /const setSettingsSearchQuery = \(query\) => \{\s*settingsUiState\.query = normalizedFilter\(query\);/);
    assert.match(script, /writeActiveAdvancedSearchQuery\(settingsUiState\.query\);/);
    assert.match(script, /const setAdvancedTab = \(tab, persist = true\) => \{\s*settingsUiState\.advancedTab = normalizeAdvancedGroup\(tab\);[\s\S]*const nextQuery = readActiveAdvancedSearchQuery\(\);/);
    assert.match(script, /const filterBulkItems = \(type, value = ''\) => \{[\s\S]*filtersByType\[resolvedType\]\.bulk = normalized;/);
});

test('settings search includes user-facing aliases for recent support terms', () => {
    assert.match(settingsSectionsScript, /^\s*\/\* Advanced settings section registry extracted from folderviewplus\.js\. \*\/\s*\(\(\) => \{/);
    assert.match(script, /const SETTINGS_SEARCH_ALIASES_BY_SECTION = Object\.freeze\(\{/);
    assert.match(script, /docker:\s*Object\.freeze\(\[[\s\S]*'webui console logs'[\s\S]*'hide status'[\s\S]*'dashboard overlap'/);
    assert.match(script, /'bulk-assignment':\s*Object\.freeze\(\[[\s\S]*'apply update'[\s\S]*'updating folder containers'/);
    assert.match(script, /diagnostics:\s*Object\.freeze\(\[[\s\S]*'native organizer'[\s\S]*'support bundle'/);
    assert.match(script, /const getSectionSearchAliases = \(section\) => \{/);
    assert.match(script, /const buildSettingsSearchIndex = \(\) => \{/);
    assert.match(script, /getPrivacySafeSettingsSearchText\(target\)/);
    assert.match(script, /matchesSettingsSearchTokens\(entry\.text, tokens\)/);
    assert.doesNotMatch(script, /getSectionSearchHaystack/);
});

test('advanced backup and template mutations are lock-guarded', () => {
    assert.match(script, /const withAdvancedOperationLock = async \(type, scope, actionLabel, callback\) =>/);
    assert.match(script, /const createManualBackup = async \(type\) => \{[\s\S]*withAdvancedOperationLock\(resolvedType, 'backups'/);
    assert.match(script, /const restoreBackupEntry = \(type, name\) => \{[\s\S]*withAdvancedOperationLock\(resolvedType, 'backups'/);
    assert.match(script, /const runScheduledBackupNow = async \(type\) => \{[\s\S]*withAdvancedOperationLock\(resolvedType, 'backups'/);
    assert.match(script, /const createTemplateFromFolder = async \(type\) => \{[\s\S]*withAdvancedOperationLock\(type, 'templates'/);
    assert.match(script, /const bulkTemplateAction = \(type, action\) => \{[\s\S]*withAdvancedOperationLock\(type, 'templates'/);
    assert.match(script, /const assignSelectedItems = async \(type, namesOverride = null\) => \{[\s\S]*executeBulkAssignmentPlan\(resolvedType, plan/);
});

test('split settings modules publish globals for cross-script browser compatibility', () => {
    assert.match(script, /FolderViewPlusSettingsMetadataModuleLoaded = true/);
    assert.match(script, /FolderViewPlusSettingsMetadata = factory\(\)/);
    assert.match(script, /FolderViewPlusSettingsTableModuleLoaded = true/);
    assert.match(script, /FolderViewPlusSettingsTable = factory\(\)/);
    assert.match(script, /FolderViewPlusSettingsHealthModuleLoaded = true/);
    assert.match(script, /FolderViewPlusSettingsHealth = factory\(\)/);
    assert.match(script, /FolderViewPlusSettingsWorkspacesModuleLoaded = true/);
    assert.match(script, /FolderViewPlusSettingsWorkspaces = factory\(\)/);
    assert.match(script, /FolderViewPlusBulkAssignmentSharedModuleLoaded = true/);
    assert.match(script, /FolderViewPlusBulkAssignmentShared = factory\(\)/);
    assert.match(script, /FolderViewPlusBulkAssignmentModuleLoaded = true/);
    assert.match(script, /FolderViewPlusBulkAssignment = factory\(\)/);
    assert.match(script, /FolderViewPlusSettingsRuntimeActionsModuleLoaded = true/);
    assert.match(script, /FolderViewPlusSettingsRuntimeActions = factory\(\)/);
    assert.match(script, /FolderViewPlusSettingsTreeModuleLoaded = true/);
    assert.match(script, /FolderViewPlusSettingsTree = Object\.freeze\(\{/);
    assert.match(script, /FolderViewPlusSupportBundlePreviewModuleLoaded = true/);
    assert.match(script, /FolderViewPlusSupportBundlePreview = factory\(\)/);
    assert.match(script, /FolderViewPlusSupportBundleBrowserModuleLoaded = true/);
    assert.match(script, /FolderViewPlusSupportBundleBrowser = factory\(root\)/);
    assert.match(script, /FolderViewPlusSupportBundleTelemetryModuleLoaded = true/);
    assert.match(script, /FolderViewPlusSupportBundleTelemetry = factory\(root\)/);
    assert.match(script, /SETTINGS_TABLE_COLUMN_SCHEMA_BY_TYPE/);
    assert.match(script, /TABLE_COLUMN_SELECTOR_MAP/);
    assert.match(script, /buildEffectiveSettingsTableWidths/);
    assert.match(script, /Object\.assign\(window,\s*\{[\s\S]*tableIdByType/);
    assert.match(script, /Object\.assign\(window,\s*\{[\s\S]*ADVANCED_TAB_STORAGE_KEY/);
    assert.match(script, /Object\.assign\(window,\s*\{[\s\S]*SECTION_APPLY_BEHAVIOR/);
    assert.match(script, /Object\.assign\(window,\s*\{[\s\S]*SETUP_ASSISTANT_DONE_STORAGE_KEY/);
    assert.match(script, /Object\.assign\(window,\s*\{[\s\S]*FVPLUS_SMART_DETECT_MATCH_THRESHOLD/);
    assert.match(script, /Object\.assign\(window,\s*\{[\s\S]*STARTER_TEMPLATE_BLUEPRINTS/);
    assert.match(script, /Object\.assign\(window,\s*\{[\s\S]*postPrefs/);
    assert.match(script, /registerWindowActions\(window,\s*\{[\s\S]*openFolderRowQuickActions/);
    assert.match(script, /FolderViewPlusSettingsActionSupportModuleLoaded = true/);
    assert.match(script, /FolderViewPlusSettingsActionSupport = factory\(\)/);
    assert.match(script, /createSupportActions = \(deps = \{\}\) =>/);
    assert.match(script, /registerWindowActions = \(target, actions = \{\}\) =>/);
});
