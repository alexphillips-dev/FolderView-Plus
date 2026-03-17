import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const pagePath = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page');
const scriptPath = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js');
const importScriptPath = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.import.js');
const backupPath = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/backup.php');
const libPath = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php');

const page = fs.readFileSync(pagePath, 'utf8');
const script = fs.readFileSync(scriptPath, 'utf8');
const importScript = fs.readFileSync(importScriptPath, 'utf8');
const runtimeScript = `${script}\n${importScript}`;
const backupPhp = fs.readFileSync(backupPath, 'utf8');
const libPhp = fs.readFileSync(libPath, 'utf8');

test('settings page onclick handlers are exported on window', () => {
    const handlers = [
        ...[...page.matchAll(/onclick="([A-Za-z0-9_]+)\(/g)].map((m) => m[1]),
        ...[...page.matchAll(/oninput="([A-Za-z0-9_]+)\(/g)].map((m) => m[1]),
        ...[...page.matchAll(/onchange="([A-Za-z0-9_]+)\(/g)].map((m) => m[1])
    ];
    const onclickUnique = [...new Set(handlers)];
    const exported = new Set([...script.matchAll(/window\.([A-Za-z0-9_]+)\s*=/g)].map((m) => m[1]));
    const missing = onclickUnique.filter((name) => !exported.has(name));
    assert.deepEqual(missing, []);
});

test('backup endpoint supports scheduler and rollback actions', () => {
    assert.match(backupPhp, /action\s*===\s*'run_schedule'/);
    assert.match(backupPhp, /runScheduledBackups/);
    assert.match(backupPhp, /action\s*===\s*'restore_latest_undo'/);
    assert.match(backupPhp, /action\s*===\s*'read'/);
    assert.match(backupPhp, /readBackupSnapshot/);
    assert.match(backupPhp, /action\s*===\s*'rollback_checkpoint'/);
    assert.match(backupPhp, /action\s*===\s*'rollback_restore_previous'/);
});

test('import preview defaults to apply mode (dry run OFF)', () => {
    assert.match(runtimeScript, /\$\('#import-dry-run-only'\)\.prop\('checked', false\)/);
    assert.match(runtimeScript, /const isImportDryRunOnly = \(\) =>/);
    assert.match(runtimeScript, /return checkbox\.length \? checkbox\.prop\('checked'\) === true : false;/);
    assert.doesNotMatch(runtimeScript, /\$\('#import-dry-run-only'\)\.prop\('checked', true\)/);
});

test('import preview dialog stays outside section-collapse visibility controls', () => {
    assert.match(script, /if \(cursor\.id === 'import-preview-dialog'\) \{/);
    assert.match(runtimeScript, /dialog\.removeClass\('fv-section-hidden fv-section-content-hidden'\);/);
});

test('import preview layout includes user-facing summary cards and collapsible raw details', () => {
    assert.match(page, /id="import-preview-counts"/);
    assert.match(page, /class="import-top-grid"/);
    assert.match(page, /class="import-preview-card import-selection-card"/);
    assert.match(page, /id="import-preset-select"/);
    assert.match(page, /id="import-preset-save"/);
    assert.match(page, /id="import-preset-default"/);
    assert.match(page, /id="import-preset-delete"/);
    assert.match(page, /id="import-summary-details"/);
    assert.match(runtimeScript, /const counts = \$\('#import-preview-counts'\);/);
    assert.match(runtimeScript, /result\.text\(`\$\{selectedCount\} operation/);
    assert.match(script, /saveCustomImportPresetForType/);
    assert.match(script, /setDefaultImportPresetIdForType/);
});

test('import apply flow includes a dedicated progress dialog', () => {
    assert.match(page, /id="import-apply-progress-overlay"/);
    assert.match(page, /id="import-apply-progress-dialog"/);
    assert.match(page, /id="import-apply-progress-bar"/);
    assert.match(runtimeScript, /const openImportApplyProgressDialog = \(type, totalSteps\) =>/);
    assert.match(runtimeScript, /const updateImportApplyProgressDialog = \(\{ completed = 0, total = 1, label = '' \}\) =>/);
    assert.match(runtimeScript, /overlay\.show\(\);/);
    assert.match(runtimeScript, /overlay\.hide\(\);/);
    assert.match(runtimeScript, /await applyImportOperations\(resolvedType, operations, \(\{ completed, label \}\) =>/);
});

test('settings action dock tracks only explicit/manual fields and excludes instant or transient controls', () => {
    assert.match(script, /changebackupschedulepref\(/);
    assert.match(script, /togglerulekindfields\(/);
    assert.match(script, /toggleallruleselections\(/);
    assert.match(script, /togglealltemplateselections\(/);
    assert.match(script, /if \(!handler\) \{\s*\/\/ Inputs without an onchange handler[\s\S]*return true;\s*\}/);
    assert.match(script, /if \(String\(input\.dataset\.fvTrackSave \|\| ''\) === '1'\) \{\s*return false;\s*\}/);
    assert.match(script, /const cancelActionBarChanges = \(\) =>/);
    assert.match(script, /\$\('#fv-action-cancel'\)\.off\('click\.fvui'\)\.on\('click\.fvui', \(\) => \{\s*cancelActionBarChanges\(\);/);
});

test('settings sections render apply-mode badges for instant/save/mixed behavior', () => {
    assert.match(script, /className = 'fv-section-mode is-instant'/);
    assert.match(script, /const getSectionApplyMode = \(section\) =>/);
    assert.match(script, /return \{ id: 'mixed', label: 'Mixed apply' \};/);
    assert.match(script, /return \{ id: 'staged', label: 'Requires Save' \};/);
    assert.match(script, /const refreshSectionApplyModeBadges = \(\) =>/);
});

test('runtime conflict safe mode blocks risky mutations with user-facing guard dialog', () => {
    assert.match(script, /const ensureRuntimeConflictActionAllowed = \(actionLabel = 'This action'\) =>/);
    assert.match(script, /if \(!ensureRuntimeConflictActionAllowed\(`Import \$\{resolvedType === 'docker' \? 'Docker' : 'VM'\} folders`\)\) \{/);
    assert.match(script, /if \(!ensureRuntimeConflictActionAllowed\('Pin\/unpin folder'\)\) \{/);
    assert.match(script, /if \(!ensureRuntimeConflictActionAllowed\(`Reorder \$\{resolvedType === 'docker' \? 'Docker' : 'VM'\} folders`\)\) \{/);
});

test('overflow row actions use delegated click/touch handlers for reliable mobile taps', () => {
    assert.match(script, /class=\"folder-action-btn folder-overflow-btn\"/);
    assert.match(script, /data-fv-overflow-type=/);
    assert.match(script, /const overflowSelector = `\$\{tbodySelector\} \.folder-overflow-btn`;/);
    assert.match(script, /on\(`click\$\{namespace\}`, overflowSelector/);
    assert.match(script, /on\(`touchend\$\{namespace\}`, overflowSelector/);
});

test('basic toolbar actions reuse compact progress overlay for docker and vm flows', () => {
    assert.match(script, /const downloadType = async \(type, id\) =>/);
    assert.match(script, /const clearType = \(type, id\) =>/);
    assert.match(script, /const restoreLatestBackup = \(type\) =>/);
    assert.match(script, /openImportApplyProgressDialog\(resolvedType, progressTotal\);/);
    assert.match(script, /setProgress\(0, 'Creating safety backup\.\.\.'\);/);
});

test('settings action buttons are explicitly non-submit buttons', () => {
    const buttonWithoutTypePattern = /<button(?![^>]*\btype=)/;
    assert.doesNotMatch(page, buttonWithoutTypePattern);
});

test('fresh install guard keeps basic Docker/VM sections visible on startup failures', () => {
    assert.match(script, /const sectionContainsSelector = \(section, selector\) =>/);
    assert.match(script, /return sectionContainsSelector\(section, 'tbody#docker, tbody#vms'\);/);
    assert.match(script, /if \(!visibleKeys\.size && settingsUiState\.mode === 'basic' && !settingsUiState\.query\) \{/);
    assert.match(script, /for \(const section of getBasicWorkspaceSections\(\)\) \{/);
    assert.match(script, /visibleKeys\.add\(section\.key\);/);
    assert.match(script, /showError\('Initial data load failed', error\);/);
});

test('fresh install fallback sanitizes error-shaped API payloads and shows empty-state guidance', () => {
    assert.match(script, /const sanitizeTypeMapResponse = \(response\) =>/);
    assert.match(script, /if \(response\.ok === false && typeof response\.error === 'string'\) \{/);
    assert.match(script, /const sanitizeTypeInfoMap = \(value\) =>/);
    assert.match(script, /const fetchFolders = async \(type\) =>/);
    assert.match(script, /const fetchTypeInfo = async \(type\) =>/);
    assert.match(script, /No Docker folders yet\./);
    assert.match(script, /No VM folders yet\./);
    assert.match(script, /All folders are currently hidden by "Hide empty folders"\./);
});

test('empty-state actions are delegated and create-folder uses modal input instead of plain prompt', () => {
    assert.match(script, /const promptStarterFolderName = async \(type, suggestedName\) =>/);
    assert.match(script, /type:\s*'input'/);
    assert.match(script, /data-fv-empty-action="create"/);
    assert.match(script, /data-fv-empty-action="import"/);
    assert.match(script, /data-fv-empty-action="wizard"/);
    assert.match(script, /off\('click\.fvemptyactions', '\[data-fv-empty-action\]'\)\.on\('click\.fvemptyactions', '\[data-fv-empty-action\]', async \(event\) =>/);
    assert.doesNotMatch(script, /window\.prompt\('Folder name:'/);
});

test('nested tree settings expose collapse controls and inline undo hosts', () => {
    assert.match(page, /expandAllFolderTrees\('docker'\)/);
    assert.match(page, /collapseAllFolderTrees\('docker'\)/);
    assert.match(page, /expandAllFolderTrees\('vm'\)/);
    assert.match(page, /collapseAllFolderTrees\('vm'\)/);
    assert.match(page, /id="docker-tree-undo-banner"/);
    assert.match(page, /id="vm-tree-undo-banner"/);
});

test('tree runtime persists collapse state and guards tree operations', () => {
    assert.match(script, /const SETTINGS_TABLE_COLUMN_COUNT = 10;/);
    assert.match(script, /treeCollapsed:\s*\{/);
    assert.match(script, /collapsedTreeParentsByType\[resolvedType\] = new Set/);
    assert.match(script, /const canFolderUseTreeMove = \(type, sourceFolderId, hierarchyMeta = null\) =>/);
    assert.match(script, /window\.toggleFolderTreeCollapse = toggleFolderTreeCollapse;/);
    assert.match(script, /window\.expandAllFolderTrees = expandAllFolderTrees;/);
    assert.match(script, /window\.collapseAllFolderTrees = collapseAllFolderTrees;/);
    assert.doesNotMatch(script, /<td class="parent-cell">/);
    assert.match(script, /queueTreeMoveUndoBanner\(resolvedType, backup\.name, 'Tree move', sourceId\)/);
    assert.match(script, /queueTreeMoveUndoBanner\(resolvedType, backup\.name, 'Move to root', sourceId\)/);
});

test('settings column resize keeps per-column widths stable without side-effects', () => {
    assert.match(script, /const captureCurrentColumnWidths = \(type\) =>/);
    assert.match(script, /const syncResizableTableLayout = \(type\) =>/);
    assert.match(script, /const hasCustomWidths = Object\.keys\(customWidths\)\.length > 0;/);
    assert.match(script, /const frozenWidths = captureCurrentColumnWidths\(resolvedType\);/);
    assert.match(script, /table\.style\.setProperty\('table-layout', 'fixed'(,\s*'important')?\);/);
    assert.match(script, /const delta = Number\(moveEvent\.clientX \|\| 0\) - startClientX;/);
});

test('status detail controls support simple balanced and detailed modes', () => {
    assert.match(page, /id="docker-status-display-mode"/);
    assert.match(page, /id="vm-status-display-mode"/);
    assert.match(page, /id="docker-status-trend-row"/);
    assert.match(page, /id="vm-status-trend-row"/);
    assert.match(script, /const normalizeStatusDisplayMode = \(value\) =>/);
    assert.match(script, /displayMode: normalizeStatusDisplayMode\(incoming\.displayMode\)/);
    assert.match(script, /if \(key === 'mode'\) \{[\s\S]*\} else if \(key === 'displayMode'\) \{/);
    assert.match(script, /status-display-mode/);
    assert.match(script, /const showTrendControl = status\.displayMode === 'detailed';/);
});

test('bulk assignment advanced UX includes filtering, selection helpers, and compatibility-safe fallback', () => {
    assert.match(page, /id="docker-bulk-filter"/);
    assert.match(page, /id="vm-bulk-filter"/);
    assert.match(page, /id="docker-bulk-selected-count"/);
    assert.match(page, /id="vm-bulk-selected-count"/);
    assert.match(page, /id="docker-bulk-help"/);
    assert.match(page, /id="vm-bulk-help"/);
    assert.match(page, /id="docker-bulk-assign-btn"/);
    assert.match(page, /id="vm-bulk-assign-btn"/);
    assert.match(script, /const getBulkAssignableNames = \(type\) =>/);
    assert.match(script, /const filterBulkItems = \(type, value = ''\) =>/);
    assert.match(script, /const bulkItemSelectionAction = \(type, action = 'all'\) =>/);
    assert.match(script, /const updateBulkSelectedCount = \(type\) =>/);
    assert.match(script, /window\.filterBulkItems = filterBulkItems;/);
    assert.match(script, /window\.bulkItemSelectionAction = bulkItemSelectionAction;/);
    assert.match(script, /window\.updateBulkSelectedCount = updateBulkSelectedCount;/);
    assert.match(script, /normalizeFolderMembers\(folder\?\.containers \|\| \[\]\)/);
    assert.match(libPhp, /foreach \(\$folders as \$folder\) \{[\s\S]*normalizeFolderMembers\(\$folder\['containers'\] \?\? \[\]\)/);
    assert.match(libPhp, /'skippedInvalid' => \$skippedInvalid/);
});
