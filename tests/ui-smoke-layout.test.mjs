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
    assert.match(settingsPage, /id="import-apply-progress-overlay"/);
    assert.match(settingsPage, /id="import-apply-progress-dialog"/);
    assert.match(settingsPage, /id="fv-settings-action-bar"/);
    assert.match(settingsPage, /folderviewplus\.request\.js/);
    assert.match(settingsPage, /folderviewplus\.chrome\.js/);
});

test('mobile action bar and import progress keep compact viewport guards', () => {
    assert.match(settingsCss, /@media \(max-width: 760px\)/);
    assert.match(settingsCss, /#fv-settings-action-bar\s*\{[\s\S]*max-width:\s*calc\(100vw\s*-\s*1rem\)/);
    assert.match(settingsCss, /\.fv-action-buttons\s*\{[\s\S]*overflow-x:\s*auto/);
    assert.match(settingsCss, /#import-apply-progress-dialog\s*\{[\s\S]*max-width:\s*min\([0-9]+px,\s*calc\(100vw\s*-\s*1\.5rem\)\)/);
    assert.match(settingsCss, /@media \(max-width: 760px\)\s*\{[\s\S]*#import-apply-progress-dialog/);
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
    assert.doesNotMatch(settingsJs, /await \$\.post\('\/plugins\/folderview\.plus\/server\//);
});
