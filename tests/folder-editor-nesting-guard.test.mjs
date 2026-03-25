import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const folderEditorScript = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js'),
    'utf8'
);
const folderEditorSharedScript = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.shared.js'),
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
    assert.match(folderEditorScript, /cachedApi = createFolderHierarchyApi\(/);
    assert.match(folderEditorScript, /const createFallbackFolderHierarchyApi = \(deps = \{\}\) =>/);
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
    assert.match(folderEditorScript, /window\.FolderViewPlusFolderEditorResolvedId/);
    assert.match(folderEditorScript, /const folderEditorBootstrapContext = window\.FolderViewPlusFolderEditorBootstrapContext/);
    assert.match(folderEditorScript, /const folderEditorShared = window\.FolderViewPlusFolderEditorShared \|\| null;/);
    assert.match(folderEditorScript, /const folderEditorSharedApi = typeof folderEditorShared\?\.createApi === 'function'/);
    assert.match(folderEditorScript, /const normalizeFolderRecordForEditor = typeof folderEditorSharedApi\?\.normalizeFolderRecordForEditor === 'function'/);
    assert.match(folderEditorSharedScript, /preview:\s*Number\.isFinite\(Number\(settings\.preview\)\)/);
    assert.match(folderEditorSharedScript, /context_graph_time:\s*Number\.isFinite\(Number\(settings\.context_graph_time\)\)/);
    assert.match(folderEditorScript, /const hydrateCurrentEditFolder = \(folderRecord, folderRecordId, foldersMap = \{\}, options = \{\}\) =>/);
    assert.match(folderEditorScript, /const resolveCurrentEditFolder = \(folderMap,\s*requestedId\) =>/);
    assert.match(folderEditorScript, /const EDITOR_PREFILL_STORAGE_KEY = 'fv\.folder\.editor\.prefill\.v1';/);
    assert.match(folderEditorScript, /const EDITOR_PREFILL_LOCAL_STORAGE_KEY = 'fv\.folder\.editor\.prefill\.persist\.v1';/);
    assert.match(folderEditorScript, /const readEditorNavigationPrefill = \(expectedType,\s*expectedId = ''\) =>/);
    assert.match(folderEditorScript, /const clearEditorNavigationPrefill = \(\) =>/);
    assert.match(folderEditorScript, /folders\[safeId\] = normalizeFolderRecordForEditor\(folder\);/);
    assert.match(folderEditorScript, /let currentEditFolder = null;/);
    assert.match(folderEditorScript, /const navigationPrefill = readEditorNavigationPrefill\(type,\s*folderId\);/);
    assert.match(folderEditorScript, /const requestedFolderRef = String\(folderId \|\| folderEditorResolvedId \|\| navigationPrefill\?\.id \|\| ''\)\.trim\(\);/);
    assert.match(folderEditorScript, /const resolvedEditFolder = resolveCurrentEditFolder\(folders,\s*requestedFolderRef\);/);
    assert.match(folderEditorScript, /currentEditFolder = resolvedEditFolder\?\.folder \|\| bootstrapFolderRecord \|\| navigationPrefill\?\.folder \|\| null;/);
    assert.match(folderEditorScript, /folders\[safeId\] = normalizeFolderRecordForEditor\(folder\);/);
    assert.match(folderEditorScript, /setValidationBannerState\(\s*'Warning: requested folder could not be loaded\.'/);
    assert.match(folderEditorScript, /Recovered requested folder from navigation context\./);
    assert.match(folderEditorScript, /hydrateCurrentEditFolder\(currentEditFolder,\s*currentEditFolderId,\s*folders,\s*\{\s*clearPrefill:\s*true\s*\}\);/);
    assert.match(folderEditorScript, /clearEditorNavigationPrefill\(\);/);
    assert.doesNotMatch(folderEditorScript, /preview_member_display/);
});

test('runtime folder editor redirects include a cache-busting query marker', () => {
    assert.match(folderEditorScript, /window\.FolderViewPlusFolderEditorRequestedId/);
    assert.match(settingsScript, /changeVisibilityPref/);
    const dockerScript = fs.readFileSync(
        path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js'),
        'utf8'
    );
    const vmScript = fs.readFileSync(
        path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js'),
        'utf8'
    );
    const dashboardScript = fs.readFileSync(
        path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/dashboard.js'),
        'utf8'
    );
    assert.match(dockerScript, /const buildDockerFolderEditorUrl = \(id = ''\) =>/);
    assert.match(vmScript, /const buildVmFolderEditorUrl = \(id = ''\) =>/);
    assert.match(dashboardScript, /const buildDashboardFolderEditorUrl = \(folderType,\s*id = ''\) =>/);
    assert.match(dockerScript, /const EDITOR_PREFILL_LOCAL_STORAGE_KEY = 'fv\.folder\.editor\.prefill\.persist\.v1';/);
    assert.match(vmScript, /const EDITOR_PREFILL_LOCAL_STORAGE_KEY = 'fv\.folder\.editor\.prefill\.persist\.v1';/);
    assert.match(dashboardScript, /const EDITOR_PREFILL_LOCAL_STORAGE_KEY = 'fv\.folder\.editor\.prefill\.persist\.v1';/);
    assert.match(dockerScript, /params\.set\('_', String\(Date\.now\(\)\)\);/);
    assert.match(vmScript, /params\.set\('_', String\(Date\.now\(\)\)\);/);
    assert.match(dashboardScript, /params\.set\('_', String\(Date\.now\(\)\)\);/);
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
