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
const folderEditorSchemaScript = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.schema.js'),
    'utf8'
);
const folderEditorPreviewScript = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.preview.js'),
    'utf8'
);
const folderEditorChromeScript = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.chrome.js'),
    'utf8'
);
const folderEditorTypeDockerScript = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.type-docker.js'),
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
const settingsRuntimeActionsScript = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.runtime-actions.js'),
    'utf8'
);
const dockerRuntimeActionsScript = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.actions.js'),
    'utf8'
);

test('folder editor validates duplicate names within the selected parent path', () => {
    assert.match(folderHierarchyScript, /const buildParentFolderEntries = \(foldersMap,\s*blockedIds = new Set\(\)\) =>/);
    assert.match(folderHierarchyScript, /const getSiblingNameCollision = \(nameValue, parentId, excludeFolderId = ''\) =>/);
    assert.match(folderHierarchyScript, /const suggestSiblingName = \(baseName, parentId, excludeFolderId = ''\) =>/);
    assert.match(folderEditorScript, /const getFolderHierarchyApi = \(\(\) =>/);
    assert.match(folderEditorScript, /cachedApi = createFolderHierarchyApi\(/);
    assert.match(folderEditorScript, /const createFallbackFolderHierarchyApi = \(deps = \{\}\) =>/);
    assert.match(folderEditorScript, /const buildParentFolderEntries = \(\.\.\.args\) => getFolderHierarchyApi\(\)\.buildParentFolderEntries\(\.\.\.args\);/);
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
    assert.match(folderEditorScript, /const folderEditorSchema = window\.FolderViewPlusFolderEditorSchema \|\| null;/);
    assert.match(folderEditorScript, /const folderEditorPreview = window\.FolderViewPlusFolderEditorPreview \|\| null;/);
    assert.match(folderEditorScript, /const folderEditorPreviewRuntimeModule = window\.FolderViewPlusFolderEditorPreviewRuntime \|\| null;/);
    assert.match(folderEditorScript, /const folderEditorStateModule = window\.FolderViewPlusFolderEditorState \|\| null;/);
    assert.match(folderEditorScript, /const folderEditorMembersModule = window\.FolderViewPlusFolderEditorMembers \|\| null;/);
    assert.match(folderEditorScript, /const folderEditorIconsModule = window\.FolderViewPlusFolderEditorIcons \|\| null;/);
    assert.match(folderEditorScript, /let folderEditorSharedApi = null;/);
    assert.match(folderEditorScript, /const getFolderEditorSharedApi = \(\) =>/);
    assert.match(folderEditorScript, /folderEditorSharedApi = folderEditorShared\.createApi\(/);
    assert.match(folderEditorScript, /const normalizeParentFolderId = \(value\) => String\(value \|\| ''\)\.trim\(\);/);
    assert.match(folderEditorScript, /const modernEditorSchema = typeof folderEditorSchema\?\.createModernSchema === 'function'/);
    assert.match(folderEditorScript, /let folderEditorPreviewRuntimeApi = null;/);
    assert.match(folderEditorScript, /const getFolderEditorPreviewRuntimeApi = \(\) =>/);
    assert.match(folderEditorScript, /folderEditorPreviewRuntimeApi = folderEditorPreviewRuntimeModule\.createApi\(/);
    assert.match(folderEditorScript, /let folderEditorStateApi = null;/);
    assert.match(folderEditorScript, /let folderEditorMembersApi = null;/);
    assert.match(folderEditorScript, /let folderEditorIconsApi = null;/);
    assert.match(folderEditorScript, /const getFolderEditorStateApi = \(\) =>/);
    assert.match(folderEditorScript, /folderEditorStateApi = folderEditorStateModule\.createApi\(/);
    assert.match(folderEditorScript, /const getFolderEditorMembersApi = \(\) =>/);
    assert.match(folderEditorScript, /folderEditorMembersApi = folderEditorMembersModule\.createApi\(/);
    assert.match(folderEditorScript, /const getFolderEditorIconsApi = \(\) =>/);
    assert.match(folderEditorScript, /folderEditorIconsApi = folderEditorIconsModule\.createApi\(/);
    assert.match(folderEditorScript, /function updateForm\(\) \{/);
    assert.match(folderEditorScript, /const startFolderEditorRuntime = async \(\) => \{/);
    assert.match(folderEditorScript, /void startFolderEditorRuntime\(\)\.catch\(\(error\) => \{/);
    assert.match(folderEditorScript, /if \(modernFolderEditorEnabled\) \{[\s\S]*FolderViewPlusRefreshModernEditorChromeLayout[\s\S]*\} else \{[\s\S]*\$\('\.fv-section-heading'\)\.remove\(\);/);
    assert.match(folderEditorScript, /const normalizeFolderRecordForEditor = \(folder\) =>/);
    assert.match(folderEditorScript, /const modernFieldRow = dl\.closest\('\.fv-modern-field-row'\);/);
    assert.match(folderEditorScript, /if \(modernFieldRow\) \{[\s\S]*setImportant\(dl, 'display', 'flex'\);[\s\S]*setImportant\(dl, 'flex-direction', 'column'\);[\s\S]*setImportant\(dl, 'gap', '0\.52em'\);/);
    assert.match(folderEditorScript, /if \(modernFieldRow\) \{[\s\S]*setImportant\(dd, 'padding-top', '0\.08em'\);/);
    assert.match(folderEditorScript, /const modernToggleRow = Boolean\(modernFieldRow && modernFieldRow\.classList\.contains\('is-toggle-row'\)\);/);
    assert.match(folderEditorSharedScript, /preview:\s*Number\.isFinite\(Number\(settings\.preview\)\)/);
    assert.match(folderEditorSharedScript, /\['none', 'hide', 'hidden', 'off', 'false', '0', 'no'\]\.includes\(normalized\)/);
    assert.match(folderEditorSharedScript, /context_graph_time:\s*Number\.isFinite\(Number\(settings\.context_graph_time\)\)/);
    assert.match(folderEditorSchemaScript, /'preview_status'/);
    assert.match(folderEditorSchemaScript, /'preview_hide_nested_items'/);
    assert.match(folderEditorSchemaScript, /preview_hide_nested_items:\s*false/);
    assert.match(folderEditorSchemaScript, /preview_hide_nested_items:\s*'Hide nested preview items'/);
    assert.match(folderEditorChromeScript, /findBasicByFieldName\(form,\s*'preview_hide_nested_items'\)/);
    assert.match(folderEditorTypeDockerScript, /findBasicByFieldName\(form,\s*'preview_hide_nested_items'\)/);
    assert.match(folderEditorTypeDockerScript, /markSection\('div\.basic:has\(\[name="preview_hide_nested_items"\]\)', 'preview'\);/);
    assert.match(folderEditorScript, /const normalizePreviewStatusMode = \(value\) =>/);
    assert.match(folderEditorScript, /\['none', 'hide', 'hidden', 'off', 'false', '0', 'no'\]\.includes\(normalized\)/);
    assert.match(folderEditorScript, /setFieldValue\('preview_status', normalizePreviewStatusMode\(normalizedFolder\.settings\.preview_status\)\);/);
    assert.match(folderEditorPreviewScript, /\['none', 'hide', 'hidden', 'off', 'false', '0', 'no'\]\.includes\(rawPreviewStatusMode\)/);
    assert.match(folderEditorPreviewScript, /previewStatusMode === 'symbol'/);
    assert.match(folderEditorStyles, /\.fv-live-member-status\.is-symbol/);
    assert.match(folderEditorSchemaScript, /window\.FolderViewPlusFolderEditorSchema = Object\.freeze\(\{/);
    assert.match(folderEditorSchemaScript, /window\.FolderViewPlusFolderEditorSchemaModuleLoaded = true/);
    assert.match(folderEditorPreviewScript, /window\.FolderViewPlusFolderEditorPreview = Object\.freeze\(\{/);
    assert.match(folderEditorPreviewScript, /window\.FolderViewPlusFolderEditorPreviewModuleLoaded = true/);
    assert.match(folderEditorScript, /const hydrateCurrentEditFolder = \(folderRecord, folderRecordId, foldersMap = \{\}, options = \{\}\) =>/);
    assert.match(folderEditorScript, /const getActiveFolderIdsForNestedPreview = \(\) => \{/);
    assert.match(folderEditorScript, /const currentName = String\(form\?\.name\?\.value \|\| ''\)\.trim\(\);/);
    assert.match(folderEditorScript, /addCandidateId\(candidateId\);/);
    assert.match(folderEditorScript, /const getNestedPreviewSample = \(\) => \{/);
    assert.match(folderEditorScript, /const sourceIds = getActiveFolderIdsForNestedPreview\(\);/);
    assert.match(folderEditorScript, /for \(const sourceId of sourceIds\) \{/);
    assert.match(folderEditorScript, /for \(const \[candidateId, candidateFolder\] of Object\.entries\(allFoldersById \|\| \{\}\)\) \{/);
    assert.match(folderEditorScript, /normalizeParentFolderId\(candidateFolder\.parentId \|\| candidateFolder\.parent_id \|\| ''\) !== sourceId/);
    assert.match(folderEditorScript, /getNestedPreviewSample,/);
    assert.match(folderEditorScript, /const resolveCurrentEditFolder = \(folderMap,\s*requestedId\) =>/);
    assert.match(folderEditorScript, /const EDITOR_PREFILL_STORAGE_KEY = 'fv\.folder\.editor\.prefill\.v1';/);
    assert.match(folderEditorScript, /const EDITOR_PREFILL_LOCAL_STORAGE_KEY = 'fv\.folder\.editor\.prefill\.persist\.v1';/);
    assert.match(folderEditorScript, /const readEditorNavigationPrefill = \(expectedType,\s*expectedId = ''\) =>/);
    assert.match(folderEditorScript, /const clearEditorNavigationPrefill = \(\) =>/);
    assert.match(folderEditorScript, /folders\[safeId\] = normalizeFolderRecordForEditor\(folder\);/);
    assert.match(folderEditorScript, /let currentEditFolder = null;/);
    assert.match(folderEditorScript, /const buildFolderEditorRefCandidates = \(\.\.\.values\) => Array\.from\(new Set/);
    assert.match(folderEditorScript, /const preferredNavigationRef = buildFolderEditorRefCandidates\(/);
    assert.match(folderEditorScript, /const navigationPrefill = readEditorNavigationPrefill\(type,\s*preferredNavigationRef\);/);
    assert.match(folderEditorScript, /const requestedFolderRefs = buildFolderEditorRefCandidates\(/);
    assert.match(folderEditorScript, /for \(const candidateRef of requestedFolderRefs\) \{/);
    assert.match(folderEditorScript, /currentEditFolder = resolvedEditFolder\?\.folder \|\| bootstrapFolderRecord \|\| navigationPrefill\?\.folder \|\| null;/);
    assert.match(folderEditorScript, /currentEditFolderId = String\(\s*resolvedEditFolder\?\.id[\s\S]*\|\| bootstrapFolderId/);
    assert.match(folderEditorScript, /folders\[safeId\] = normalizeFolderRecordForEditor\(folder\);/);
    assert.match(folderEditorScript, /hydrateCurrentEditFolder\(currentEditFolder,\s*currentEditFolderId,\s*folders,\s*\{\s*clearPrefill:\s*true\s*\}\);\s*updateLiveSummary\(\);/);
    assert.match(folderEditorScript, /setValidationBannerState\(\s*'Warning: requested folder could not be loaded\.'/);
    assert.match(folderEditorScript, /Recovered requested folder from navigation context\./);
    assert.match(folderEditorScript, /hydrateCurrentEditFolder\(currentEditFolder,\s*currentEditFolderId,\s*folders,\s*\{\s*clearPrefill:\s*true\s*\}\);/);
    assert.match(folderEditorScript, /clearEditorNavigationPrefill\(\);/);
    const hierarchyStateIndex = folderEditorScript.indexOf('const folderHierarchyState = {');
    const startupInvokeIndex = folderEditorScript.lastIndexOf('void startFolderEditorRuntime().catch((error) => {');
    assert.ok(hierarchyStateIndex !== -1 && startupInvokeIndex > hierarchyStateIndex, 'modern editor startup must run after folder hierarchy state is declared');
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
    assert.match(dockerScript, /const buildDockerFolderEditorUrl = \(id = ''\) => \{/);
    assert.match(dockerRuntimeActionsScript, /const buildDockerFolderEditorUrl = \(id = ''\) =>/);
    assert.match(vmScript, /const buildVmFolderEditorUrl = \(id = ''\) =>/);
    assert.match(dockerRuntimeActionsScript, /const EDITOR_PREFILL_LOCAL_STORAGE_KEY = 'fv\.folder\.editor\.prefill\.persist\.v1';/);
    assert.match(vmScript, /const EDITOR_PREFILL_LOCAL_STORAGE_KEY = 'fv\.folder\.editor\.prefill\.persist\.v1';/);
    assert.match(dockerRuntimeActionsScript, /params\.set\('_', String\(Date\.now\(\)\)\);/);
    assert.match(vmScript, /params\.set\('_', String\(Date\.now\(\)\)\);/);
    assert.doesNotMatch(dashboardScript, /const buildDashboardFolderEditorUrl = \(folderType,\s*id = ''\) =>/);
    assert.doesNotMatch(dashboardScript, /const EDITOR_PREFILL_LOCAL_STORAGE_KEY = 'fv\.folder\.editor\.prefill\.persist\.v1';/);
    assert.doesNotMatch(dashboardScript, /params\.set\('_', String\(Date\.now\(\)\)\);/);
});

test('folder editor includes parent default hint styles', () => {
    assert.match(folderEditorStyles, /\.fv-parent-defaults-note/);
    assert.match(folderEditorStyles, /\.fv-parent-defaults-note\.is-success/);
    assert.match(folderEditorStyles, /\.fv-parent-defaults-note\.is-info/);
});

test('tree integrity scan includes depth and empty-branch signals', () => {
    assert.match(settingsScript, /const TREE_INTEGRITY_DEPTH_WARN_LEVEL = \d+;/);
    assert.match(settingsRuntimeActionsScript, /depthWarnings/);
    assert.match(settingsRuntimeActionsScript, /emptyBranches/);
    assert.match(settingsRuntimeActionsScript, /No repairable link issues/);
});
