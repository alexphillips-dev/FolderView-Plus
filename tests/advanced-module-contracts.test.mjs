import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const scriptPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js'
);
const script = fs.readFileSync(scriptPath, 'utf8');

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
    assert.match(script, /const runScheduledBackupNow = async \(type\) => \{[\s\S]*withAdvancedOperationLock\(type, 'backups'/);
    assert.match(script, /const createTemplateFromFolder = async \(type\) => \{[\s\S]*withAdvancedOperationLock\(type, 'templates'/);
    assert.match(script, /const bulkTemplateAction = \(type, action\) => \{[\s\S]*withAdvancedOperationLock\(type, 'templates'/);
    assert.match(script, /const assignSelectedItems = async \(type, namesOverride = null\) => \{[\s\S]*claimAdvancedOperationLock\(resolvedType, 'bulk'/);
});
