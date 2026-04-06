import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const pagePath = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page');
const importScriptPath = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.import.js');
const backupPath = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/backup.php');
const libPath = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php');
const settingsCssPath = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.css');

const page = fs.readFileSync(pagePath, 'utf8');
const settingsScriptPaths = [
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.runtime-parity.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-metadata.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-sections.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-table.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.setup-assistant.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.smart-detect-config.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.starter-templates.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.support-bundle-preview.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.activity-diagnostics.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.folder-editor.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-health.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-workspaces.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.bulk-assignment.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.runtime-actions.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-tree.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.actions-support.js',
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js'
].map((relativePath) => path.join(repoRoot, relativePath));
const script = settingsScriptPaths.map((scriptPath) => fs.readFileSync(scriptPath, 'utf8')).join('\n');
const importScript = fs.readFileSync(importScriptPath, 'utf8');
const runtimeScript = `${script}\n${importScript}`;
const backupPhp = fs.readFileSync(backupPath, 'utf8');
const libPhp = fs.readFileSync(libPath, 'utf8');
const settingsCss = fs.readFileSync(settingsCssPath, 'utf8');

test('settings page onclick handlers are exported on window', () => {
    const handlers = [
        ...[...page.matchAll(/onclick="([A-Za-z0-9_]+)\(/g)].map((m) => m[1]),
        ...[...page.matchAll(/oninput="([A-Za-z0-9_]+)\(/g)].map((m) => m[1]),
        ...[...page.matchAll(/onchange="([A-Za-z0-9_]+)\(/g)].map((m) => m[1])
    ];
    const onclickUnique = [...new Set(handlers)];
    const exported = new Set([
        ...[...script.matchAll(/window\.([A-Za-z0-9_]+)\s*=/g)].map((m) => m[1]),
        ...[...script.matchAll(/Object\.assign\(window,\s*\{([\s\S]*?)\}\);/g)]
            .flatMap((match) => [...match[1].matchAll(/^\s*([A-Za-z0-9_]+)\s*(?::|,)/gm)].map((entry) => entry[1])),
        ...[...script.matchAll(/registerWindowActions\(window,\s*\{([\s\S]*?)\}\);/g)]
            .flatMap((match) => [...match[1].matchAll(/^\s*([A-Za-z0-9_]+)\s*(?::|,)/gm)].map((entry) => entry[1]))
    ]);
    const missing = onclickUnique.filter((name) => !exported.has(name));
    assert.deepEqual(missing, []);
});

test('settings page loads extracted settings metadata before the main runtime', () => {
    assert.match(page, /folderviewplus\.runtime-parity\.js/);
    assert.match(page, /folderviewplus\.settings-metadata\.js/);
    assert.match(page, /folderviewplus\.settings-sections\.js/);
    assert.match(page, /folderviewplus\.settings-table\.js/);
    assert.match(page, /folderviewplus\.settings-tree\.js[\s\S]*folderviewplus\.folder-editor\.js[\s\S]*folderviewplus\.row-details\.js[\s\S]*folderviewplus\.settings-health\.js[\s\S]*folderviewplus\.settings-workspaces\.js[\s\S]*folderviewplus\.bulk-assignment\.js[\s\S]*folderviewplus\.runtime-actions\.js[\s\S]*folderviewplus\.actions-support\.js[\s\S]*folderviewplus\.js/);
    assert.match(script, /FolderViewPlusSettingsMetadataModuleLoaded = true/);
    assert.match(script, /FolderViewPlusSettingsTableModuleLoaded = true/);
    assert.match(script, /FolderViewPlusSettingsHealthModuleLoaded = true/);
    assert.match(script, /FolderViewPlusSettingsWorkspacesModuleLoaded = true/);
    assert.match(script, /FolderViewPlusSettingsTreeModuleLoaded = true/);
    assert.match(script, /FolderViewPlusBulkAssignmentModuleLoaded = true/);
    assert.match(script, /FolderViewPlusSettingsRuntimeActionsModuleLoaded = true/);
    assert.match(script, /bootstrapMissingModules\.push\('folderviewplus\.settings-metadata\.js'\)/);
    assert.match(script, /bootstrapMissingModules\.push\('folderviewplus\.settings-table\.js'\)/);
    assert.match(script, /bootstrapMissingModules\.push\('folderviewplus\.settings-health\.js'\)/);
    assert.match(script, /bootstrapMissingModules\.push\('folderviewplus\.settings-workspaces\.js'\)/);
    assert.match(script, /bootstrapMissingModules\.push\('folderviewplus\.settings-tree\.js'\)/);
    assert.match(script, /bootstrapMissingModules\.push\('folderviewplus\.bulk-assignment\.js'\)/);
    assert.match(script, /bootstrapMissingModules\.push\('folderviewplus\.runtime-actions\.js'\)/);
    assert.match(script, /bootstrapMissingModules\.push\('folderviewplus\.actions-support\.js'\)/);
    assert.match(script, /const settingsTableModule = window\.FolderViewPlusSettingsTable \|\| null;/);
    assert.match(script, /const settingsHealthModule = window\.FolderViewPlusSettingsHealth \|\| null;/);
    assert.match(script, /const settingsWorkspacesModule = window\.FolderViewPlusSettingsWorkspaces \|\| null;/);
    assert.match(script, /const settingsTreeModule = window\.FolderViewPlusSettingsTree \|\| null;/);
    assert.match(script, /const bulkAssignmentModule = window\.FolderViewPlusBulkAssignment \|\| null;/);
    assert.match(script, /const settingsRuntimeActionsModule = window\.FolderViewPlusSettingsRuntimeActions \|\| null;/);
});

test('settings page exposes theme fallback controls and runtime self-heal action', () => {
    assert.match(page, /id="docker-view-mode"/);
    assert.match(page, /id="vm-view-mode"/);
    assert.match(page, /Runtime view/);
    assert.match(page, /changeVisibilityPref\('docker', 'viewMode', this\.value\)/);
    assert.match(page, /changeVisibilityPref\('vm', 'viewMode', this\.value\)/);
    assert.match(page, /id="docker-theme-compat-mode"/);
    assert.match(page, /id="vm-theme-compat-mode"/);
    assert.match(page, /Theme fallback mode/);
    assert.match(page, /folderviewplus\.theme-resolver\.js/);
    assert.match(page, /changeRuntimePref\('docker', 'themeCompatibilityMode', this\.value\)/);
    assert.match(page, /changeRuntimePref\('vm', 'themeCompatibilityMode', this\.value\)/);
    assert.doesNotMatch(page, /onclick="runThemeSelfHeal\(\)"/);
    assert.match(script, /const resolveThemeCompatibilityMode = \(value\) =>/);
    assert.match(script, /const applyDiagnosticsThemeTokens = \(reason = 'runtime', options = \{\}\) =>/);
    assert.match(script, /const getEffectiveThemeCompatibilityMode = \(\) =>/);
    assert.match(script, /const runThemeSelfHeal = async \(\) =>/);
    assert.match(script, /run_theme_self_heal/);
    assert.match(script, /registerWindowActions\(window,\s*\{[\s\S]*runThemeSelfHeal[\s\S]*\}\);/);
    assert.match(script, /else if \(key === 'viewMode'\) \{/);
    assert.match(script, /catch \(error\) \{\s*renderVisibilityControls\(type\);[\s\S]*showError\('Visibility preference save failed', error\);/);
    assert.match(script, /else if \(key === 'themeCompatibilityMode'\) \{/);
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
    assert.match(script, /changesettingstablecolumnwidthpreset\(/);
    assert.match(script, /togglerulekindfields\(/);
    assert.match(script, /toggleallruleselections\(/);
    assert.match(script, /togglealltemplateselections\(/);
    assert.match(script, /if \(!handler\) \{\s*\/\/ Inputs without an onchange handler[\s\S]*return true;\s*\}/);
    assert.match(script, /if \(String\(input\.dataset\.fvTrackSave \|\| ''\) === '1'\) \{\s*return false;\s*\}/);
    assert.doesNotMatch(script, /const cancelActionBarChanges = \(\) =>/);
    assert.doesNotMatch(script, /#fv-action-cancel/);
});

test('settings table width preset controls are wired as instant-persist inputs', () => {
    assert.match(page, /id="docker-table-name-width" onchange="changeSettingsTableColumnWidthPreset\('docker', 'name', this\.value\)"/);
    assert.match(page, /id="docker-table-actions-width" onchange="changeSettingsTableColumnWidthPreset\('docker', 'actions', this\.value\)"/);
    assert.match(page, /id="vm-table-name-width" onchange="changeSettingsTableColumnWidthPreset\('vm', 'name', this\.value\)"/);
    assert.match(page, /id="vm-table-actions-width" onchange="changeSettingsTableColumnWidthPreset\('vm', 'actions', this\.value\)"/);
});

test('settings sections only show section apply badges when save-required fields exist', () => {
    assert.match(script, /className = 'fv-section-mode is-instant'/);
    assert.match(script, /const getSectionApplyMode = \(section\) =>/);
    assert.match(script, /return \{ id: 'staged', label: 'Requires Save' \};/);
    assert.match(script, /return null;/);
    assert.match(script, /section\.modeBadge\.hidden = true;/);
    assert.match(script, /const refreshSectionApplyModeBadges = \(\) =>/);
});

test('recovery workspace remembers source and routes generic actions through the active type', () => {
    assert.match(script, /const RECOVERY_WORKSPACE_STORAGE_KEY = 'fv\.settings\.recoveryWorkspace\.v1';/);
    assert.match(script, /const getSettingsWorkspacesApi = \(\(\) => \{/);
    assert.match(script, /const getActiveRecoveryWorkspaceType = \(\.\.\.args\) => getSettingsWorkspacesApi\(\)\.getActiveRecoveryWorkspaceType\(\.\.\.args\);/);
    assert.match(script, /writeSettingsStorage\(RECOVERY_WORKSPACE_STORAGE_KEY, resolvedType, \{ delayMs: 60, idle: true \}\);/);
    assert.match(script, /const createActiveRecoveryBackup = \(\.\.\.args\) => getSettingsWorkspacesApi\(\)\.createActiveRecoveryBackup\(\.\.\.args\);/);
    assert.match(script, /const restoreLatestActiveRecoveryBackup = \(\.\.\.args\) => getSettingsWorkspacesApi\(\)\.restoreLatestActiveRecoveryBackup\(\.\.\.args\);/);
    assert.match(script, /const selectActiveRecoveryBackup = \(name = ''\) => \{/);
    assert.match(script, /const restoreSelectedActiveRecoveryBackup = \(\.\.\.args\) => getSettingsWorkspacesApi\(\)\.restoreSelectedActiveRecoveryBackup\(\.\.\.args\);/);
    assert.match(script, /const downloadSelectedActiveRecoveryBackup = \(\.\.\.args\) => getSettingsWorkspacesApi\(\)\.downloadSelectedActiveRecoveryBackup\(\.\.\.args\);/);
    assert.match(script, /const deleteSelectedActiveRecoveryBackup = \(\.\.\.args\) => getSettingsWorkspacesApi\(\)\.deleteSelectedActiveRecoveryBackup\(\.\.\.args\);/);
    assert.match(script, /const runActiveRecoveryScheduler = \(\.\.\.args\) => getSettingsWorkspacesApi\(\)\.runActiveRecoveryScheduler\(\.\.\.args\);/);
    assert.match(script, /const compareActiveRecoverySnapshots = \(\.\.\.args\) => getSettingsWorkspacesApi\(\)\.compareActiveRecoverySnapshots\(\.\.\.args\);/);
    assert.match(script, /const undoActiveRecoveryChange = \(\.\.\.args\) => getSettingsWorkspacesApi\(\)\.undoActiveRecoveryChange\(\.\.\.args\);/);
});

test('operations workspace remembers source and exposes the shared runtime-template actions', () => {
    assert.match(script, /const OPERATIONS_WORKSPACE_STORAGE_KEY = 'fv\.settings\.operationsWorkspace\.v1';/);
    assert.match(script, /const normalizeOperationsWorkspaceType = \(\.\.\.args\) => getSettingsWorkspacesApi\(\)\.normalizeOperationsWorkspaceType\(\.\.\.args\);/);
    assert.match(script, /writeSettingsStorage\(OPERATIONS_WORKSPACE_STORAGE_KEY, resolvedType, \{ delayMs: 60, idle: true \}\);/);
    assert.match(script, /activeOperationsWorkspaceType = normalizeOperationsWorkspaceType\(localStorage\.getItem\(OPERATIONS_WORKSPACE_STORAGE_KEY\) \|\| 'docker'\)/);
    assert.match(script, /const renderOperationsWorkspace = \(\.\.\.args\) => getSettingsWorkspacesApi\(\)\.renderOperationsWorkspace\(\.\.\.args\);/);
    assert.match(script, /const setOperationsWorkspaceType = \(\.\.\.args\) => getSettingsWorkspacesApi\(\)\.setOperationsWorkspaceType\(\.\.\.args\);/);
    assert.match(script, /const selectOperationsTemplate = \(\.\.\.args\) => getSettingsWorkspacesApi\(\)\.selectOperationsTemplate\(\.\.\.args\);/);
    assert.match(script, /const exportTemplateEntry = \(\.\.\.args\) => getSettingsWorkspacesApi\(\)\.exportTemplateEntry\(\.\.\.args\);/);
    assert.match(script, /const renderTemplateRows = \(\.\.\.args\) => getSettingsWorkspacesApi\(\)\.renderTemplateRows\(\.\.\.args\);/);
    assert.match(script, /setRuntimePreviewOutput\(type, buildRuntimePreviewHtml\(type, folderId, action, plan\)\);/);
    assert.match(script, /setRuntimePreviewOutput\(type, buildRuntimePreviewHtml\(type, folderId, action, plan, result\)\);/);
    assert.match(script, /registerWindowActions\(window,\s*\{[\s\S]*setOperationsWorkspaceType[\s\S]*selectOperationsTemplate[\s\S]*exportTemplateEntry[\s\S]*\}\);/);
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
    assert.match(script, /const promptStarterTemplateSelection = async \(type, blueprints\) =>/);
    assert.match(script, /STARTER_TEMPLATE_CATEGORY_META = Object\.freeze/);
    assert.match(script, /normalizeStarterTemplateCategory = \(value\) =>/);
    assert.match(script, /fv-starter-template-category-select/);
    assert.match(script, /getCategoryLabel\(categoryId\)\} \(\$\{getCategoryCount\(categoryId\)\}\)/);
    assert.match(script, /Smart<\/strong> uses detected .* names to pre-pick relevant folders\./);
    assert.match(script, /fv-starter-template-option:visible \.fv-starter-template-checkbox:checked/);
    assert.match(script, /type:\s*'input'/);
    assert.match(script, /fv-starter-template-checkbox/);
    assert.match(script, /data-fv-starter-template-index/);
    assert.match(script, /confirmButtonText:\s*'Create selected'/);
    assert.match(script, /swal\.showInputError\('Select at least one template\.'\)/);
    assert.match(script, /data-fv-empty-action="create"/);
    assert.match(script, /data-fv-empty-action="templates"/);
    assert.match(script, /data-fv-empty-action="import"/);
    assert.match(script, /data-fv-empty-action="wizard"/);
    assert.match(script, /off\('click\.fvemptyactions', '\[data-fv-empty-action\]'\)\.on\('click\.fvemptyactions', '\[data-fv-empty-action\]', async \(event\) =>/);
    assert.match(script, /const quickCreateStarterFolder = async \(type\) =>/);
    assert.match(script, /const quickCreateStarterTemplates = async \(type\) =>/);
    assert.match(script, /STARTER_TEMPLATE_BLUEPRINTS = Object\.freeze/);
    assert.match(script, /settings:\s*\{[\s\S]*preview:\s*1/);
    assert.match(script, /preview_border:\s*true/);
    assert.match(script, /status_color_started:\s*'#ffffff'/);
    assert.match(script, /dashboard_overflow:\s*'default'/);
    assert.doesNotMatch(script, /window\.prompt\('Folder name:'/);
});

test('nested tree settings expose collapse controls and inline undo hosts', () => {
    assert.match(page, /expandAllFolderTrees\('docker'\)/);
    assert.match(page, /collapseAllFolderTrees\('docker'\)/);
    assert.match(page, /expandAllFolderTrees\('vm'\)/);
    assert.match(page, /collapseAllFolderTrees\('vm'\)/);
    assert.match(page, /id="docker-tree-undo-banner"/);
    assert.match(page, /id="vm-tree-undo-banner"/);
    assert.match(page, /id="docker-tree-history-undo"/);
    assert.match(page, /id="docker-tree-history-redo"/);
    assert.match(page, /id="vm-tree-history-undo"/);
    assert.match(page, /id="vm-tree-history-redo"/);
    assert.match(page, /id="docker-tree-reorder-toggle"/);
    assert.match(page, /id="vm-tree-reorder-toggle"/);
    assert.match(page, /id="docker-tree-path-hint"/);
    assert.match(page, /id="vm-tree-path-hint"/);
    assert.match(page, /runTreeIntegrityCheck\('docker'/);
    assert.match(page, /runTreeIntegrityCheck\('vm'/);
});

test('tree runtime persists collapse state and guards tree operations', () => {
    assert.match(script, /const SETTINGS_TABLE_COLUMN_COUNT = 10;/);
    assert.match(script, /treeCollapsed:\s*\{/);
    assert.match(script, /collapsedTreeParentsByType\[resolvedType\] = new Set/);
    assert.match(script, /const canFolderUseTreeMove = \(type, sourceFolderId, hierarchyMeta = null\) =>/);
    assert.match(script, /const createFolderReorderQueueState = \(\) => \(\{/);
    assert.match(script, /const queueFolderReorderPersist = \(type, \{/);
    assert.match(script, /const flushQueuedFolderReorderPersist = async \(type\) => \{/);
    assert.match(script, /registerWindowActions\(window,\s*\{[\s\S]*applyTreeMoveUndo[\s\S]*applyTreeMoveRedo[\s\S]*toggleFolderTreeCollapse[\s\S]*expandAllFolderTrees[\s\S]*collapseAllFolderTrees[\s\S]*toggleMobileTreeReorderMode[\s\S]*\}\);/);
    assert.match(script, /const recordTreeMoveHistoryFromBackup = async \(type, beforeBackupName, actionLabel, focusFolderId = ''\) =>/);
    assert.match(script, /pushTreeMoveHistoryEntry\(resolvedType,/);
    assert.match(script, /History: \$\{historyDepth\.undo\} undo \/ \$\{historyDepth\.redo\} redo\./);
    assert.doesNotMatch(script, /<td class="parent-cell">/);
    assert.match(script, /recordTreeMoveHistoryFromBackup\(resolvedType, backup\.name, 'Tree move', sourceId\)/);
    assert.match(script, /recordTreeMoveHistoryFromBackup\(resolvedType, backup\.name, 'Move to root', sourceId\)/);
    assert.match(script, /queueFolderReorderPersist\(resolvedType, \{/);
    assert.match(script, /await recordTreeMoveHistoryFromBackup\([\s\S]*'Reorder folders'[\s\S]*focusFolderId/);
});

test('nested folder rendering keeps highlighted display HTML isolated from aria/title text', () => {
    assert.match(script, /const safeNameText = escapeHtml\(folderNameRaw\);/);
    assert.match(script, /const safeNameDisplayHtml = filter \? highlightSearchText\(folderNameRaw, filter\) : safeNameText;/);
    assert.match(script, /aria-label="Open status breakdown for \$\{safeNameText\}"/);
    assert.match(script, /<span class="name-cell-text">\$\{safeNameDisplayHtml\}<\/span>/);
    assert.match(script, /const showBreadcrumb = folderDepth > 0 \|\| Boolean\(filter\);/);
});

test('nested folder branch and integrity actions are reachable from quick actions and exported', () => {
    assert.match(script, /data-action="branchCollapse"/);
    assert.match(script, /data-action="branchExpand"/);
    assert.match(script, /data-action="branchExport"/);
    assert.match(script, /data-action="branchImport"/);
    assert.match(script, /const setFolderBranchPinned = async \(type, folderId, pinned = true\) =>/);
    assert.match(script, /const exportFolderBranch = async \(type, folderId\) =>/);
    assert.match(script, /const importFolderBranch = async \(type, targetFolderId\) =>/);
    assert.match(script, /const runTreeIntegrityCheck = async \(type, options = \{\}\) =>/);
    assert.match(script, /registerWindowActions\(window,\s*\{[\s\S]*setFolderBranchCollapse[\s\S]*setFolderBranchPinned[\s\S]*exportFolderBranch[\s\S]*importFolderBranch[\s\S]*runTreeIntegrityCheck[\s\S]*\}\);/);
});

test('settings table layout uses preset-driven widths instead of drag-resize controls', () => {
    assert.match(script, /const captureCurrentColumnWidths = \(type\) =>/);
    assert.match(script, /const syncResizableTableLayout = \(type\) =>/);
    assert.match(script, /const hasCustomWidths = Object\.keys\(customWidths\)\.length > 0;/);
    assert.match(script, /const SETTINGS_TABLE_WIDTH_PRESET_VALUES = Object\.freeze\(\{/);
    assert.match(script, /const buildEffectiveSettingsTableWidths = \(type\) => \{/);
    assert.match(script, /changeSettingsTableColumnWidthPreset = async \(type, key, value\) => \{/);
    assert.match(script, /settingsTableWidthPresetByType\[resolvedType\]\[targetKey\] = normalizeSettingsTableColumnWidthPreset\(value\);/);
    assert.match(script, /table\.querySelectorAll\('th\.fv-col-resizable'\)\.forEach\(\(header\) => header\.classList\.remove\('fv-col-resizable'\)\);/);
    assert.doesNotMatch(script, /const stopActiveTableColumnResize = \(persist = true\) =>/);
    assert.doesNotMatch(script, /const SETTINGS_TABLE_RESIZE_GUIDE_ID = 'fv-settings-col-resize-guide';/);
    assert.match(script, /table\.style\.setProperty\('table-layout', 'fixed'(,\s*'important')?\);/);
    assert.match(script, /columnWidthsByType\[resolvedType\] = \{\};/);
    assert.match(script, /columnWidthModeByType\[resolvedType\] = 'auto';/);
    assert.match(script, /\$\(`\[data-fv-table-preset\^="\$\{resolvedType\}:"\]`\)\.removeClass\('is-active'\);/);
    assert.match(page, /id="docker-table-name-width"/);
    assert.match(page, /id="docker-table-actions-width"/);
    assert.match(page, /id="vm-table-name-width"/);
    assert.match(page, /id="vm-table-actions-width"/);
    assert.match(settingsCss, /Desktop widths are JS-driven/);
    assert.match(settingsCss, /\.folder-table table th\.col-name \{\s*text-align:\s*center;/);
    assert.match(settingsCss, /\.folder-table table th\.col-signals \{\s*text-align:\s*center;/);
    assert.doesNotMatch(settingsCss, /\.folder-table table th:nth-child\(1\),[\s\S]*\.folder-table table td:nth-child\(10\) \{ width: 5%; \}/);
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

test('settings mode switches persist the user basic or advanced view choice', () => {
    assert.match(script, /const setSettingsMode = \(mode, \{ persistServer = false \} = \{\}\) => \{/);
    assert.match(script, /const previousMode = settingsUiState\.mode === 'advanced' \? 'advanced' : 'basic';/);
    assert.match(script, /writeSettingsStorage\(UI_MODE_STORAGE_KEY, settingsUiState\.mode, \{ delayMs: 60, idle: true \}\);/);
    assert.match(script, /if \(persistServer === true && previousMode !== settingsUiState\.mode\) \{\s*void persistSetupPrefsToServer\(\{ mode: settingsUiState\.mode \}\);\s*\}/);
    assert.match(script, /const storedMode = String\(localStorage\.getItem\(UI_MODE_STORAGE_KEY\) \|\| ''\)\.trim\(\);/);
    assert.match(script, /const hasLocalModePreference = storedMode === 'advanced' \|\| storedMode === 'basic';/);
    assert.match(script, /if \(!hasLocalModePreference && serverMode\) \{\s*settingsUiState\.mode = serverMode;\s*\}/);
    assert.match(script, /if \(hasLocalModePreference && serverMode && serverMode !== settingsUiState\.mode\) \{\s*void persistSetupPrefsToServer\(\{ mode: settingsUiState\.mode \}\);\s*\}/);
    assert.match(script, /setSettingsMode\(mode, \{ persistServer: true \}\);/);
    assert.match(script, /setSettingsMode\('basic', \{ persistServer: true \}\);/);
    assert.match(script, /setSettingsMode\('advanced', \{ persistServer: true \}\);/);
});

test('folder health actions can jump into a filtered basic table view', () => {
    assert.match(script, /const mode = String\(\$\(event\.currentTarget\)\.attr\('data-fv-health-mode'\) \|\| 'all'\);/);
    assert.match(script, /setHealthFolderFilter\(type, mode\);/);
});

test('bulk assignment advanced UX includes filtering, selection helpers, and compatibility-safe fallback', () => {
    assert.match(page, /class="rules-panel bulk-module" data-fv-bulk-type="docker"/);
    assert.match(page, /class="rules-panel bulk-module" data-fv-bulk-type="vm"/);
    assert.match(page, /class="bulk-step-strip"/);
    assert.match(page, /id="docker-bulk-target-summary"/);
    assert.match(page, /id="vm-bulk-target-summary"/);
    assert.match(page, /id="docker-bulk-available-summary"/);
    assert.match(page, /id="vm-bulk-available-summary"/);
    assert.match(page, /id="docker-bulk-selected-summary"/);
    assert.match(page, /id="vm-bulk-selected-summary"/);
    assert.match(page, /id="docker-bulk-action-summary"/);
    assert.match(page, /id="vm-bulk-action-summary"/);
    assert.match(page, /id="docker-bulk-filter"/);
    assert.match(page, /id="vm-bulk-filter"/);
    assert.match(page, /id="docker-bulk-folder" data-fv-track-save="0"/);
    assert.match(page, /id="vm-bulk-folder" data-fv-track-save="0"/);
    assert.match(page, /id="docker-bulk-filter" type="text" placeholder="Search containers" data-fv-track-save="0"/);
    assert.match(page, /id="vm-bulk-filter" type="text" placeholder="Search VMs" data-fv-track-save="0"/);
    assert.match(page, /id="docker-bulk-selected-count"/);
    assert.match(page, /id="vm-bulk-selected-count"/);
    assert.match(page, /id="docker-bulk-items-list"/);
    assert.match(page, /id="vm-bulk-items-list"/);
    assert.match(page, /id="docker-bulk-items" class="bulk-items-legacy" data-fv-track-save="0"/);
    assert.match(page, /id="vm-bulk-items" class="bulk-items-legacy" data-fv-track-save="0"/);
    assert.match(page, /id="docker-bulk-preview"/);
    assert.match(page, /id="vm-bulk-preview"/);
    assert.match(page, /id="docker-bulk-result"/);
    assert.match(page, /id="vm-bulk-result"/);
    assert.match(page, /id="docker-bulk-retry-failed"/);
    assert.match(page, /id="vm-bulk-retry-failed"/);
    assert.match(page, /id="docker-bulk-help"/);
    assert.match(page, /id="vm-bulk-help"/);
    assert.match(page, /id="docker-bulk-assign-btn"/);
    assert.match(page, /id="vm-bulk-assign-btn"/);
    assert.match(script, /const getBulkAssignableNames = \(type\) =>/);
    assert.match(script, /const buildBulkAssignmentPlan = \(type, folderId, namesInput = null\) =>/);
    assert.match(script, /const clearBulkExecutionState = \(type\) =>/);
    assert.match(script, /const syncBulkWorkflowUi = \(type, planInput = null\) =>/);
    assert.match(script, /const updateBulkPrimaryAction = \(type, plan\) =>/);
    assert.match(script, /const updateBulkPreviewPanel = \(type\) =>/);
    assert.match(script, /const renderBulkChecklist = \(type, visibleNames\) =>/);
    assert.match(script, /const retryFailedBulkItems = async \(type\) =>/);
    assert.match(script, /const BULK_ASSIGN_CHUNK_SIZE = 40;/);
    assert.match(script, /const BULK_LIST_RENDER_CHUNK_SIZE = 120;/);
    assert.match(script, /const filterBulkItems = \(type, value = ''\) =>/);
    assert.match(script, /const bulkItemSelectionAction = \(type, action = 'all'\) =>/);
    assert.match(script, /const updateBulkSelectedCount = \(type\) =>/);
    assert.match(script, /const getBulkAssignmentApi = \(\(\) => \{/);
    assert.match(script, /registerWindowActions\(window,\s*\{[\s\S]*retryFailedBulkItems[\s\S]*filterBulkItems[\s\S]*bulkItemSelectionAction[\s\S]*updateBulkSelectedCount[\s\S]*\}\);/);
    assert.match(script, /utils && typeof utils\.normalizeFolderMembers === 'function'/);
    assert.match(script, /utils\.normalizeFolderMembers\(folder\?\.containers \|\| \[\]\)/);
    assert.match(libPhp, /foreach \(\$folders as \$folder\) \{[\s\S]*normalizeFolderMembers\(\$folder\['containers'\] \?\? \[\]\)/);
    assert.match(libPhp, /'skippedInvalid' => \$skippedInvalid/);
});
