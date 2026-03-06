import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const settingsPagePath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/FolderViewPlus.page'
);
const settingsCssPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folderviewplus.css'
);
const settingsJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js'
);
const folderCssPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folder.css'
);
const folderJsPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js'
);

const settingsPage = fs.readFileSync(settingsPagePath, 'utf8');
const settingsCss = fs.readFileSync(settingsCssPath, 'utf8');
const settingsJs = fs.readFileSync(settingsJsPath, 'utf8');
const folderCss = fs.readFileSync(folderCssPath, 'utf8');
const folderJs = fs.readFileSync(folderJsPath, 'utf8');

test('settings page includes smoke-test-critical containers and scripts', () => {
    assert.match(settingsPage, /id="import-preview-dialog"/);
    assert.match(settingsPage, /id="backup-compare-dialog"/);
    assert.match(settingsPage, /id="docker-backup-compare-left"/);
    assert.match(settingsPage, /id="vm-backup-compare-left"/);
    assert.match(settingsPage, /id="import-apply-progress-overlay"/);
    assert.match(settingsPage, /id="import-apply-progress-dialog"/);
    assert.match(settingsPage, /id="fv-settings-action-bar"/);
    assert.match(settingsPage, /folderviewplus\.request\.js/);
    assert.match(settingsPage, /folderviewplus\.chrome\.js/);
});

test('mobile action bar and import progress keep compact viewport guards', () => {
    assert.match(settingsCss, /@media \(max-width: 760px\)/);
    assert.match(settingsCss, /#fv-settings-action-bar\s*\{[\s\S]*max-width:\s*calc\(100%\s*-\s*1rem\)/);
    assert.doesNotMatch(settingsCss, /#fv-settings-action-bar[\s\S]*max-width:\s*calc\(100vw/);
    assert.match(settingsCss, /\.fv-action-buttons\s*\{[\s\S]*overflow-x:\s*auto/);
    assert.match(settingsCss, /#import-apply-progress-dialog\s*\{[\s\S]*max-width:\s*min\([0-9]+px,\s*calc\(100vw\s*-\s*1\.5rem\)\)/);
    assert.match(settingsCss, /@media \(max-width: 760px\)\s*\{[\s\S]*#import-apply-progress-dialog/);
});

test('sort toggle note has anti-clipping layout guards', () => {
    assert.match(settingsCss, /\.toolbar-sort-toggle\s*\{[\s\S]*display:\s*grid/);
    assert.match(settingsCss, /\.toolbar-sort-toggle\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto/);
    assert.match(settingsCss, /\.toolbar-sort-toggle\s*\{[\s\S]*padding:\s*0 0\.7rem 0 0/);
    assert.match(settingsCss, /\.toolbar-sort-toggle\s*\{[\s\S]*overflow:\s*visible/);
    assert.match(settingsCss, /\.toolbar-sort-toggle-main\s*\{[\s\S]*flex:\s*1 1 auto/);
    assert.match(settingsCss, /\.toolbar-sort-toggle-note\s*\{[\s\S]*justify-self:\s*end/);
    assert.match(settingsCss, /\.toolbar-sort-toggle-note\s*\{[\s\S]*padding-right:\s*0\.2rem/);
});

test('folder tables avoid unnecessary horizontal scrollbar in basic view', () => {
    assert.match(settingsCss, /\.folder-table\s*\{[\s\S]*overflow-x:\s*hidden !important/);
    assert.match(settingsCss, /\.folder-table > \*\s*\{[\s\S]*min-width:\s*0/);
    assert.match(settingsCss, /\.table-wrap\s*\{[\s\S]*box-sizing:\s*border-box/);
    assert.match(settingsCss, /\.table-wrap\s*\{[\s\S]*overflow-x:\s*hidden/);
    assert.match(settingsCss, /\.folder-table \.table-wrap\s*\{[\s\S]*overflow-x:\s*hidden !important/);
    assert.match(settingsCss, /\.folder-table \.table-wrap::-webkit-scrollbar\s*\{[\s\S]*display:\s*none/);
    assert.match(settingsCss, /\.folder-table table\s*\{[\s\S]*max-width:\s*100%/);
    assert.match(settingsCss, /\.folder-table table\s*\{[\s\S]*min-width:\s*0/);
    assert.match(settingsCss, /\.folder-table table th,\s*[\s\S]*\.folder-table table td\s*\{[\s\S]*min-width:\s*0/);
    assert.match(settingsCss, /\.folder-table table\s*\{[\s\S]*border-collapse:\s*collapse/);
    assert.match(settingsCss, /\.folder-table table\s*\{[\s\S]*border-spacing:\s*0/);
});

test('folder editor keeps left-alignment runtime and stylesheet guards', () => {
    assert.match(folderJs, /const enforceLeftAlignedSettingsLayout = \(\) =>/);
    assert.match(folderJs, /fv-force-left-v2 marker/);
    assert.match(folderJs, /fv-force-left-v3 marker/);
    assert.match(folderCss, /\.canvas form\.folder-editor-form\.fv-force-left-v3/);
    assert.match(folderCss, /Runtime-enforced left alignment guard/);
});

test('settings runtime uses extracted chrome module and shared request wrapper', () => {
    assert.match(settingsJs, /const requestClient = window\.FolderViewPlusRequest \|\| null;/);
    assert.match(settingsJs, /const settingsChrome = window\.FolderViewPlusSettingsChrome \|\| null;/);
    assert.match(settingsJs, /const apiPostJson = async \(url, data = \{\}, options = \{\}\) =>/);
    assert.match(settingsJs, /const topbarHtml = settingsChrome && typeof settingsChrome\.getTopbarHtml === 'function'/);
    assert.match(settingsJs, /const enforceNoHorizontalOverflow = \(\) =>/);
    assert.match(settingsJs, /const initOverflowGuard = \(\) =>/);
    assert.match(settingsJs, /window\.addEventListener\('resize', enforceNoHorizontalOverflow\)/);
    assert.match(settingsJs, /initOverflowGuard\(\);/);
    assert.match(settingsJs, /window\.compareBackupSnapshots = compareBackupSnapshots;/);
    assert.match(settingsJs, /const IMPORT_PRESET_STORAGE_KEY = 'fv\.import\.presets\.v1';/);
    assert.match(settingsCss, /\.backup-compare-row\s*\{/);
    assert.match(settingsCss, /\.ui-dialog\.fv-backup-compare-modal #backup-compare-dialog/);
    assert.doesNotMatch(settingsJs, /await \$\.post\('\/plugins\/folderview\.plus\/server\//);
});
