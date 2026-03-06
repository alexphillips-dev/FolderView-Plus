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
    assert.match(page, /id="import-summary-details"/);
    assert.match(script, /const counts = \$\('#import-preview-counts'\);/);
    assert.match(script, /result\.text\(`\$\{selectedCount\} operation/);
});
