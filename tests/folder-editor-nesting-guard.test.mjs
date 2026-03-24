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
const folderHierarchyScript = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.hierarchy.js'),
    'utf8'
);
const settingsScript = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js'),
    'utf8'
);

test('folder editor validates duplicate names within the selected parent path', () => {
    assert.match(folderHierarchyScript, /const getSiblingNameCollision = \(nameValue, parentId, excludeFolderId = ''\) =>/);
    assert.match(folderHierarchyScript, /const suggestSiblingName = \(baseName, parentId, excludeFolderId = ''\) =>/);
    assert.match(folderEditorScript, /const getFolderHierarchyApi = \(\(\) =>/);
    assert.match(folderEditorScript, /cachedApi = folderHierarchyModule\.createApi\(/);
    assert.match(folderEditorScript, /form\.parent_folder_id\?\.value/);
    assert.match(folderEditorScript, /A sibling with this name already exists under/);
});

test('folder editor supports parent smart-default inheritance on new child folders', () => {
    assert.match(folderEditorScript, /const SMART_DEFAULT_FIELD_NAMES = new Set\(\[/);
    assert.match(folderHierarchyScript, /const applySmartDefaultsFromParent = \(parentId, config = \{\}\) =>/);
    assert.match(folderHierarchyScript, /Inherited \$\{applied\} default/);
    assert.match(folderEditorScript, /getParentDefaults: \(parentFolder\) => buildParentSmartDefaults\(parentFolder\)/);
    assert.match(folderEditorScript, /fieldName === 'parent_folder_id' && event\.type === 'change'/);
});

test('folder editor normalizes sparse folder payloads before binding controls', () => {
    assert.match(folderEditorScript, /const folderEditorQueryParams = new URLSearchParams\(location\.search\);/);
    assert.match(folderEditorScript, /folderEditorQueryParams\.get\('folderId'\)/);
    assert.match(folderEditorScript, /folderEditorQueryParams\.get\('folder'\)/);
    assert.match(folderEditorScript, /window\.FolderViewPlusFolderEditorPageType/);
    assert.match(folderEditorScript, /window\.FolderViewPlusFolderEditorRequestedId/);
    assert.match(folderEditorScript, /const normalizeFolderRecordForEditor = \(folder\) =>/);
    assert.match(folderEditorScript, /const resolveCurrentEditFolder = \(folderMap,\s*requestedId\) =>/);
    assert.match(folderEditorScript, /const EDITOR_PREFILL_STORAGE_KEY = 'fv\.folder\.editor\.prefill\.v1';/);
    assert.match(folderEditorScript, /const readEditorNavigationPrefill = \(expectedType,\s*expectedId = ''\) =>/);
    assert.match(folderEditorScript, /const clearEditorNavigationPrefill = \(\) =>/);
    assert.match(folderEditorScript, /preview:\s*Number\.isFinite\(Number\(settings\.preview\)\)/);
    assert.match(folderEditorScript, /context_graph_time:\s*Number\.isFinite\(Number\(settings\.context_graph_time\)\)/);
    assert.match(folderEditorScript, /folders\[safeId\] = normalizeFolderRecordForEditor\(folder\);/);
    assert.match(folderEditorScript, /let currentEditFolder = null;/);
    assert.match(folderEditorScript, /const navigationPrefill = readEditorNavigationPrefill\(type,\s*folderId\);/);
    assert.match(folderEditorScript, /const requestedFolderRef = String\(folderId \|\| navigationPrefill\?\.id \|\| ''\)\.trim\(\);/);
    assert.match(folderEditorScript, /const resolvedEditFolder = resolveCurrentEditFolder\(folders,\s*requestedFolderRef\);/);
    assert.match(folderEditorScript, /currentEditFolder = resolvedEditFolder\?\.folder \|\| navigationPrefill\?\.folder \|\| null;/);
    assert.match(folderEditorScript, /setValidationBannerState\(\s*'Warning: requested folder could not be loaded\.'/);
    assert.match(folderEditorScript, /Recovered requested folder from navigation context\./);
    assert.match(folderEditorScript, /setFieldValue\('preview',\s*String\(currentEditFolder\.settings\.preview\)\);/);
    assert.match(folderEditorScript, /clearEditorNavigationPrefill\(\);/);
    assert.doesNotMatch(folderEditorScript, /preview_member_display/);
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
