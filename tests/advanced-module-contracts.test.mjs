import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const settingsScriptPaths = [
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.runtime-parity.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-metadata.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-sections.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.setup-assistant.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.smart-detect-config.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.starter-templates.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.activity-diagnostics.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.folder-editor.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.actions-support.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js'
].map((relativePath) => path.join(repoRoot, relativePath));
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

test('advanced backup and template mutations are lock-guarded', () => {
    assert.match(script, /const withAdvancedOperationLock = async \(type, scope, actionLabel, callback\) =>/);
    assert.match(script, /const createManualBackup = async \(type\) => \{[\s\S]*withAdvancedOperationLock\(resolvedType, 'backups'/);
    assert.match(script, /const restoreBackupEntry = \(type, name\) => \{[\s\S]*withAdvancedOperationLock\(resolvedType, 'backups'/);
    assert.match(script, /const runScheduledBackupNow = async \(type\) => \{[\s\S]*withAdvancedOperationLock\(resolvedType, 'backups'/);
    assert.match(script, /const createTemplateFromFolder = async \(type\) => \{[\s\S]*withAdvancedOperationLock\(type, 'templates'/);
    assert.match(script, /const bulkTemplateAction = \(type, action\) => \{[\s\S]*withAdvancedOperationLock\(type, 'templates'/);
    assert.match(script, /const assignSelectedItems = async \(type, namesOverride = null\) => \{[\s\S]*claimAdvancedOperationLock\(resolvedType, 'bulk'/);
});

test('split settings modules publish globals for cross-script browser compatibility', () => {
    assert.match(script, /FolderViewPlusSettingsMetadataModuleLoaded = true/);
    assert.match(script, /FolderViewPlusSettingsMetadata = factory\(\)/);
    assert.match(script, /SETTINGS_TABLE_COLUMN_SCHEMA_BY_TYPE/);
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
