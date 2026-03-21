import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const folderEditorScript = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js'),
    'utf8'
);
const folderEditorStyles = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folder.css'),
    'utf8'
);
const settingsScript = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js'),
    'utf8'
);

test('folder editor validates duplicate names within the selected parent path', () => {
    assert.match(folderEditorScript, /const getSiblingNameCollision = \(nameValue, parentId, excludeFolderId = ''\) =>/);
    assert.match(folderEditorScript, /const suggestSiblingName = \(baseName, parentId, excludeFolderId = ''\) =>/);
    assert.match(folderEditorScript, /form\.parent_folder_id\?\.value/);
    assert.match(folderEditorScript, /A sibling with this name already exists under/);
});

test('folder editor supports parent smart-default inheritance on new child folders', () => {
    assert.match(folderEditorScript, /const SMART_DEFAULT_FIELD_NAMES = new Set\(\[/);
    assert.match(folderEditorScript, /const applySmartDefaultsFromParent = \(parentId, \{ force = false \} = \{\}\) =>/);
    assert.match(folderEditorScript, /Inherited \$\{applied\} default/);
    assert.match(folderEditorScript, /fieldName === 'parent_folder_id' && event\.type === 'change'/);
});

test('folder editor normalizes sparse folder payloads before binding controls', () => {
    assert.match(folderEditorScript, /const normalizeFolderRecordForEditor = \(folder\) =>/);
    assert.match(folderEditorScript, /preview:\s*Number\.isFinite\(Number\(settings\.preview\)\)/);
    assert.match(folderEditorScript, /context_graph_time:\s*Number\.isFinite\(Number\(settings\.context_graph_time\)\)/);
    assert.match(folderEditorScript, /folders\[safeId\] = normalizeFolderRecordForEditor\(folder\);/);
    assert.match(folderEditorScript, /form\.preview\.value = String\(currFolder\.settings\.preview\);/);
});

test('folder editor includes parent default hint styles', () => {
    assert.match(folderEditorStyles, /\.fv-parent-defaults-note/);
    assert.match(folderEditorStyles, /\.fv-parent-defaults-note\.is-success/);
    assert.match(folderEditorStyles, /\.fv-parent-defaults-note\.is-info/);
});

test('tree integrity scan includes depth and empty-branch signals', () => {
    assert.match(settingsScript, /const TREE_INTEGRITY_DEPTH_WARN_LEVEL = \d+;/);
    assert.match(settingsScript, /depthWarnings/);
    assert.match(settingsScript, /emptyBranches/);
    assert.match(settingsScript, /No repairable link issues/);
});
