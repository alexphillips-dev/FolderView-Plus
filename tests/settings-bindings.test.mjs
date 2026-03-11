import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const pagePath = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page');
const scriptPath = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js');
const backupPath = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/backup.php');

const page = fs.readFileSync(pagePath, 'utf8');
const script = fs.readFileSync(scriptPath, 'utf8');
const backupPhp = fs.readFileSync(backupPath, 'utf8');

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
    assert.match(script, /\$\('#import-dry-run-only'\)\.prop\('checked', false\)/);
    assert.match(script, /const isImportDryRunOnly = \(\) =>/);
    assert.match(script, /return checkbox\.length \? checkbox\.prop\('checked'\) === true : false;/);
    assert.doesNotMatch(script, /\$\('#import-dry-run-only'\)\.prop\('checked', true\)/);
});

test('import preview dialog stays outside section-collapse visibility controls', () => {
    assert.match(script, /if \(cursor\.id === 'import-preview-dialog'\) \{/);
    assert.match(script, /dialog\.removeClass\('fv-section-hidden fv-section-content-hidden'\);/);
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
    assert.match(script, /const counts = \$\('#import-preview-counts'\);/);
    assert.match(script, /result\.text\(`\$\{selectedCount\} operation/);
    assert.match(script, /saveCustomImportPresetForType/);
    assert.match(script, /setDefaultImportPresetIdForType/);
});

test('import apply flow includes a dedicated progress dialog', () => {
    assert.match(page, /id="import-apply-progress-overlay"/);
    assert.match(page, /id="import-apply-progress-dialog"/);
    assert.match(page, /id="import-apply-progress-bar"/);
    assert.match(script, /const openImportApplyProgressDialog = \(type, totalSteps\) =>/);
    assert.match(script, /const updateImportApplyProgressDialog = \(\{ completed = 0, total = 1, label = '' \}\) =>/);
    assert.match(script, /overlay\.show\(\);/);
    assert.match(script, /overlay\.hide\(\);/);
    assert.match(script, /await applyImportOperations\(resolvedType, operations, \(\{ completed, label \}\) =>/);
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

test('basic toolbar actions reuse compact progress overlay for docker and vm flows', () => {
    assert.match(script, /const downloadType = async \(type, id\) =>/);
    assert.match(script, /const clearType = \(type, id\) =>/);
    assert.match(script, /const restoreLatestBackup = \(type\) =>/);
    assert.match(script, /openImportApplyProgressDialog\(resolvedType, progressTotal\);/);
    assert.match(script, /setProgress\(0, 'Creating safety backup\.\.\.'\);/);
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
