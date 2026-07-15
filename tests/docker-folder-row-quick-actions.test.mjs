import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const dockerScript = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js'),
    'utf8'
);
const dockerPreviewActionsScript = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.preview-actions.js'),
    'utf8'
);
const dockerRuntimeHierarchyScript = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.hierarchy.js'),
    'utf8'
);
const dockerCommandViewScript = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.command-view.js'),
    'utf8'
);
const dockerOrbitViewScript = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.orbit-view.js'),
    'utf8'
);
const dockerTreeExplorerScript = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.tree-explorer.js'),
    'utf8'
);
const dockerCss = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/docker.css'),
    'utf8'
);
const extractConstFunctionBlock = (source, functionName, nextFunctionName) => {
    const start = source.indexOf(`const ${functionName} =`);
    assert.notEqual(start, -1, `${functionName} should be defined`);
    const end = source.indexOf(`const ${nextFunctionName} =`, start + 1);
    assert.notEqual(end, -1, `${nextFunctionName} should follow ${functionName}`);
    return source.slice(start, end);
};
const dockerFolderHierarchyMoveBlock = extractConstFunctionBlock(
    dockerScript,
    'applyDockerFolderHierarchyMoveFromMenu',
    'moveDockerFolderUnderFromMenu'
);
const dockerFolderSameLevelMoveBlock = extractConstFunctionBlock(
    dockerScript,
    'moveDockerFolderFromMenu',
    'ensureDockerFolderUnlocked'
);

test('docker context menu keeps focus/pin/lock quick actions at the top', () => {
    assert.match(dockerScript, /text:\s*focused[\s\S]*getDockerMenuLabel\('clear-focus-folder',\s*'Clear focus'\)/);
    assert.match(dockerScript, /text:\s*pinned[\s\S]*getDockerMenuLabel\('unpin-folder',\s*'Unpin folder'\)/);
    assert.match(dockerScript, /text:\s*locked[\s\S]*getDockerMenuLabel\('unlock-folder',\s*'Unlock folder'\)/);
    assert.match(dockerScript, /toggleDockerFolderFocus\(id\)/);
    assert.match(dockerScript, /toggleDockerFolderPin\(id\)/);
    assert.match(dockerScript, /toggleDockerFolderLock\(id\)/);
    assert.match(dockerScript, /queueDockerFolderContextQuickIcons\(/);
    assert.match(dockerScript, /createDockerContextMenuQuickStripAdapter/);
    assert.match(dockerScript, /dockerContextQuickStripAdapter/);
    assert.match(dockerScript, /iconClassCandidates:\s*\[[\s\S]*'fa-thumb-tack'[\s\S]*\]/);
    assert.match(dockerScript, /icon:\s*'fa-thumb-tack'/);
    assert.doesNotMatch(dockerScript, /icon:\s*pinned \? 'fa-star' : 'fa-star-o'/);
    assert.doesNotMatch(dockerScript, /fv-folder-row-actions/);
});

test('docker pin quick action updates visible folder order immediately', () => {
    assert.match(dockerScript, /const reorderVisibleDockerRootFolderBlocks = \(\) =>/);
    assert.match(dockerScript, /const syncDockerPinnedFolderUi = \(\) =>/);
    assert.match(dockerScript, /const currentPrefs = await fetchDockerPinnedFolderPrefs\(\);[\s\S]*const current = normalizeDockerPinnedFolderIdList\(currentPrefs\.pinnedFolderIds\);[\s\S]*const nextPinned = current\.includes\(id\)/);
    assert.match(dockerScript, /applyDockerPinnedFolderIds\(nextPinned\);\s*syncDockerPinnedFolderUi\(\);/s);
    assert.match(dockerScript, /const confirmedPinned = normalizeDockerPinnedFolderIdList\(response\?\.prefs\?\.pinnedFolderIds \|\| nextPinned\);[\s\S]*applyDockerPinnedFolderIds\(confirmedPinned\);\s*syncDockerPinnedFolderUi\(\);/s);
    assert.doesNotMatch(dockerScript, /applyDockerPinnedFolderIds\(confirmedPinned\);\s*syncDockerPinnedFolderUi\(\);\s*queueLoadlistRefresh\(/s);
    assert.match(dockerScript, /applyDockerPinnedFolderIds\(previousPinned\);\s*syncDockerPinnedFolderUi\(\);/s);
});

test('docker pin quick action verifies server persistence before keeping optimistic state', () => {
    assert.match(dockerScript, /const assertDockerPrefsSaveResponse = \(response, fallbackMessage = 'Failed to save Docker preferences\.'\) => \{/);
    assert.match(dockerScript, /if \(!response \|\| response\.ok === false\) \{/);
    assert.match(dockerScript, /const fetchDockerPinnedFolderPrefs = async \(\) => \{/);
    assert.match(dockerScript, /\/plugins\/folderview\.plus\/server\/prefs\.php\?type=docker&_=\$\{Date\.now\(\)\}/);
    assert.match(dockerScript, /const queueDockerPinnedFolderServerReconcile = \(reason = 'post-render', delayMs = 120\) => \{/);
    assert.match(dockerScript, /const reconciledPrefs = applyDockerPinnedFolderPrefsOverride\(prefs \|\| \{\}\);[\s\S]*applyDockerPinnedFolderIds\(reconciledPrefs\.pinnedFolderIds\);[\s\S]*syncDockerPinnedFolderUi\(\);/);
    assert.match(dockerScript, /queueDockerPinnedFolderServerReconcile\('post-render', 160\);/);
    assert.match(dockerScript, /const confirmedPrefs = await fetchDockerPinnedFolderPrefs\(\);/);
    assert.match(dockerScript, /if \(!dockerPinnedFolderIdListsMatch\(confirmedPrefs\.pinnedFolderIds, nextPinnedIds\)\) \{/);
    assert.match(dockerScript, /throw new Error\('Docker pinned folders did not persist\.'\);/);
    assert.match(dockerScript, /rememberDockerPinnedFolderIdsOverride\(nextPinned\);/);
    assert.match(dockerScript, /const currentPrefs = await fetchDockerPinnedFolderPrefs\(\);/);
    assert.match(dockerScript, /broadcastDockerPinnedFolderChange\(\{[\s\S]*pinnedFolderIds:\s*confirmedPinned,[\s\S]*changedFolderId:\s*id,[\s\S]*pinned:\s*confirmedPinned\.includes\(id\)[\s\S]*\}\);/);
    assert.match(dockerScript, /folderTypePrefs = applyDockerPinnedFolderPrefsOverride\(normalizeDockerPrefsResponse\(prefsResponse\)\);/);
});

test('docker page listens for settings pin changes without a full reload', () => {
    assert.match(dockerScript, /const PINNED_FOLDER_CHANGE_STORAGE_KEY = 'fv\.folderviewplus\.pinnedFolders\.changed\.v1';/);
    assert.match(dockerScript, /const PINNED_FOLDER_CHANGE_EVENT = 'fvplus:pinned-folders-changed';/);
    assert.match(dockerScript, /const broadcastDockerPinnedFolderChange = \(payload = \{\}\) => \{/);
    assert.match(dockerScript, /localStorage\.setItem\(PINNED_FOLDER_CHANGE_STORAGE_KEY, JSON\.stringify\(eventPayload\)\);/);
    assert.match(dockerScript, /window\.dispatchEvent\(new CustomEvent\(PINNED_FOLDER_CHANGE_EVENT, \{ detail: eventPayload \}\)\);/);
    assert.match(dockerScript, /const applyDockerSettingsPinSyncPayload = \(payload\) => \{/);
    assert.match(dockerScript, /const bindDockerSettingsPinSyncListener = \(\) => \{/);
    assert.match(dockerScript, /window\.addEventListener\('storage', \(event\) => \{/);
    assert.match(dockerScript, /window\.addEventListener\(PINNED_FOLDER_CHANGE_EVENT, \(event\) => \{/);
    assert.match(dockerScript, /payload\.type !== 'docker'/);
    assert.match(dockerScript, /clearDockerPinnedFolderIdsOverride\(\);\s*applyDockerPinnedFolderIds\(payload\.pinnedFolderIds\);/s);
    assert.match(dockerScript, /applyDockerPinnedFolderIds\(payload\.pinnedFolderIds\);\s*syncDockerPinnedFolderUi\(\);/s);
});

test('docker pin state resolves from normalized prefs and runtime store', () => {
    assert.match(dockerScript, /const normalizeDockerPinnedFolderIdList = \(value\) => \{/);
    assert.match(dockerScript, /const isDockerFolderPinned = \(folderId\) => \{[\s\S]*const prefsPinned = normalizeDockerPinnedFolderIdList\(folderTypePrefs\?\.pinnedFolderIds\);[\s\S]*const runtimePinned = normalizeDockerPinnedFolderIdList\(dockerRuntimeStateStore\.get\('pinnedFolderIds', \[\]\)\);[\s\S]*return runtimePinned\.includes\(id\);[\s\S]*\};/);
    assert.match(dockerScript, /const normalizedPinnedIds = normalizeDockerPinnedFolderIdList\(nextPinnedIds\);[\s\S]*pinnedFolderIds:\s*normalizedPinnedIds[\s\S]*dockerRuntimeStateStore\.set\(\{\s*pinnedFolderIds:\s*normalizedPinnedIds\s*\}\);/);
});

test('docker pinned folder affordances use a pin icon instead of a star', () => {
    assert.match(dockerScript, /iconClassCandidates:\s*\[[\s\S]*'fa-thumb-tack'[\s\S]*\]/);
    assert.match(dockerScript, /text:\s*pinned[\s\S]*icon:\s*'fa-thumb-tack'/);
    assert.doesNotMatch(dockerScript, /fa-star-o/);
    assert.match(dockerScript, /const buildDockerFolderPinnedIndicatorHtml = \(\) => \{/);
    assert.match(dockerScript, /class="fv-folder-pin-indicator"[\s\S]*fa fa-thumb-tack/);
    assert.match(dockerScript, /const syncDockerFolderPinnedIndicator = \(\$row,\s*pinned\) => \{/);
    assert.match(dockerScript, /\$row\.toggleClass\('fv-folder-pinned', pinned\);\s*syncDockerFolderPinnedIndicator\(\$row,\s*pinned\);/);
    assert.match(dockerScript, /const pinnedIndicator = pinned \? buildDockerFolderPinnedIndicatorHtml\(\) : '';/);
    assert.match(dockerScript, /class="fv-folder-title-line"[\s\S]*\$\{pinnedIndicator\}/);
    assert.match(dockerCss, /\.fv-folder-title-line\s*\{/);
    assert.match(dockerCss, /\.fv-folder-pin-indicator\s*\{[\s\S]*rgba\(255,\s*202,\s*99,\s*0\.16\)/);
    assert.match(dockerCommandViewScript, /<i class="fa fa-thumb-tack"><\/i> pinned/);
    assert.match(dockerOrbitViewScript, /<i class="fa fa-thumb-tack"><\/i> pinned/);
    assert.match(dockerTreeExplorerScript, /<i class="fa fa-thumb-tack"><\/i> pinned/);
});

test('docker folder menu can move folders within the current level', () => {
    assert.match(dockerScript, /const buildDockerFolderRuntimeOrderState = \(\) =>/);
    assert.match(dockerScript, /const persistDockerFolderManualOrder = async \(nextOrder\) =>/);
    assert.match(dockerScript, /const normalizeDockerManualFolderOrder = \(nextOrder,\s*folders = globalFolders,\s*prefs = folderTypePrefs\) =>/);
    assert.match(dockerScript, /const applyDockerFolderMenuOrderToDom = \(orderedIds\) =>/);
    assert.match(dockerScript, /const \$folderRows = \$\('#docker_list > tr\.folder'\);/);
    assert.match(dockerScript, /fragment\.appendChild\(row\);/);
    assert.match(dockerScript, /\$dockerList\.sortable\('refresh'\);/);
    assert.match(dockerScript, /const normalizedOrder = normalizeDockerManualFolderOrder\(nextOrder\);[\s\S]*manualOrder:\s*normalizedOrder/);
    assert.match(dockerScript, /const moveDockerFolderFromMenu = async \(folderId,\s*direction\) =>/);
    assert.match(dockerScript, /ensureDockerFolderUnlocked\(id,\s*moveDirection < 0 \? 'Move folder up' : 'Move folder down'\)/);
    assert.match(dockerScript, /const siblingIds = parentId[\s\S]*childrenById\[parentId\][\s\S]*fullOrder\.filter/);
    assert.match(dockerScript, /const sourceSubtreeIds = \[id,\s*\.\.\.collectDescendants\(id\)\];/);
    assert.match(dockerScript, /const nextOrder = normalizeDockerManualFolderOrder\(requestedOrder,\s*folders,\s*folderTypePrefs\);/);
    assert.match(dockerScript, /folderTypePrefs = utils\.normalizePrefs\(\{[\s\S]*sortMode:\s*'manual',[\s\S]*manualOrder:\s*nextOrder/);
    assert.match(dockerScript, /const previousPrefs = utils\.normalizePrefs\(folderTypePrefs \|\| \{\}\);/);
    assert.match(dockerScript, /const previousOrder = fullOrder\.slice\(\);/);
    assert.match(dockerScript, /applyDockerFolderMenuOrderToDom\(nextOrder\);[\s\S]*const response = await persistDockerFolderManualOrder\(nextOrder\);/);
    assert.match(dockerScript, /catch \(error\) \{[\s\S]*folderTypePrefs = previousPrefs;[\s\S]*applyDockerFolderMenuOrderToDom\(previousOrder\);[\s\S]*throw error;/);
    assert.doesNotMatch(dockerFolderSameLevelMoveBlock, /queueCreateFoldersRender\(\);/);
    assert.doesNotMatch(dockerFolderSameLevelMoveBlock, /folderReq = buildDockerFolderReq/);
    assert.match(dockerScript, /text:\s*'Move up'[\s\S]*moveDockerFolderFromMenu\(id,\s*-1\)/);
    assert.match(dockerScript, /text:\s*'Move down'[\s\S]*moveDockerFolderFromMenu\(id,\s*1\)/);
});

test('docker folder menu can move folders under another folder or back to root', () => {
    assert.match(dockerScript, /const persistDockerFolderRecord = async \(folderId,\s*folderPayload\) =>/);
    assert.match(dockerScript, /\/plugins\/folderview\.plus\/server\/update\.php/);
    assert.match(dockerScript, /const buildDockerFolderMoveTargetOptions = \(sourceId,\s*state\) =>/);
    assert.match(dockerScript, /const blocked = new Set\(\[safeSourceId,\s*\.\.\.descendants\]\);/);
    assert.match(dockerScript, /const applyDockerFolderHierarchyMoveFromMenu = async \(folderId,\s*nextParentId\) =>/);
    assert.match(dockerScript, /descendants\.includes\(parentId\)/);
    assert.match(dockerScript, /const nextFolder = \{[\s\S]*\.\.\.sourceFolder,[\s\S]*parentId[\s\S]*\};/);
    assert.match(dockerScript, /const nextOrder = normalizeDockerManualFolderOrder\(requestedOrder,\s*nextFolders,\s*folderTypePrefs\);/);
    assert.match(dockerScript, /await persistDockerFolderRecord\(id,\s*nextFolder\);[\s\S]*await persistDockerFolderManualOrder\(nextOrder\);/);
    assert.doesNotMatch(dockerFolderHierarchyMoveBlock, /queueCreateFoldersRender\(\);/);
    assert.doesNotMatch(dockerFolderHierarchyMoveBlock, /folderReq = buildDockerFolderReq/);
    assert.match(dockerScript, /globalFolders = previousFolders;[\s\S]*applyDockerFolderMenuOrderToDom\(previousOrder\);/);
    assert.match(dockerScript, /const moveDockerFolderUnderFromMenu = \(folderId\) =>/);
    assert.match(dockerScript, /id="fv-docker-menu-move-target"/);
    assert.match(dockerScript, /text:\s*'Move under\.\.\.'[\s\S]*moveDockerFolderUnderFromMenu\(id\)/);
    assert.match(dockerScript, /text:\s*'Move to root'[\s\S]*applyDockerFolderHierarchyMoveFromMenu\(id,\s*''\)/);
});

test('docker hydration refreshes existing preview actions in place instead of reloading the list', () => {
    assert.match(dockerPreviewActionsScript, /const utils = deps\.utils && typeof deps\.utils === 'object' \? deps\.utils : \{\};/);
    assert.match(dockerScript, /dockerPreviewActionsModule\.createApi\(\{[\s\S]*utils,[\s\S]*escapeHtml:/);
    assert.match(dockerPreviewActionsScript, /const getDockerPreviewStatusMeta = \(entry = \{\}\) =>/);
    assert.match(dockerPreviewActionsScript, /const clearDockerRuntimeStateClasses = \(\$elements\) =>/);
    assert.match(dockerPreviewActionsScript, /const syncDockerPreviewStateSurface = \(\$target,\s*statusMeta,\s*localizedLabel\) =>/);
    assert.match(dockerPreviewActionsScript, /const normalizePreviewStatusMode = \(value\) =>/);
    assert.match(dockerPreviewActionsScript, /\$outer\.attr\('data-fv-runtime-state', statusMeta\.key\);/);
    assert.match(dockerPreviewActionsScript, /\$appLink\.hasClass\('fv-preview-status-name'\)/);
    assert.match(dockerPreviewActionsScript, /const findDockerFolderMemberRow = \(id,\s*containerName\) =>/);
    assert.match(dockerPreviewActionsScript, /const syncDockerStorageRowStatus = \(\$row,\s*entry = \{\}\) =>/);
    assert.match(dockerPreviewActionsScript, /\$row\.attr\('data-fv-runtime-state', statusMeta\.key\);/);
    assert.match(dockerPreviewActionsScript, /const resolveDockerPreviewStateTargets = \(\$target\) =>/);
    assert.match(dockerPreviewActionsScript, /const syncDockerPreviewStatus = \(\$target,\s*entry = \{\}\) =>/);
    assert.match(dockerPreviewActionsScript, /syncDockerPreviewStateSurface\(\$target,\s*statusMeta,\s*localizedLabel\);/);
    assert.match(dockerPreviewActionsScript, /\$compactStatus\.attr\('title', localizedLabel\);/);
    assert.match(dockerPreviewActionsScript, /removeClass\('fa-play fa-pause fa-square started paused stopped green-text orange-text red-text fv-preview-status-started fv-preview-status-paused fv-preview-status-stopped'\)/);
    assert.match(dockerPreviewActionsScript, /\$stateLabel\.text\(` \$\{localizedLabel\}`\);/);
    assert.match(dockerPreviewActionsScript, /if \(previewStatusMode === 'symbol'\) \{[\s\S]*\$outer\.find\('\.fv-preview-icon-status'\)\.removeClass\('fv-preview-status-hidden'\);[\s\S]*\} else \{[\s\S]*\$outer\.find\('\.fv-preview-icon-status'\)\.remove\(\);/);
    assert.match(dockerPreviewActionsScript, /const resolveDockerMemberUpdateState = \(entry = \{\},\s*options = \{\}\) =>/);
    assert.match(dockerPreviewActionsScript, /const buildDockerMemberUpdateColumnHtml = \(entry = \{\},\s*options = \{\}\) =>/);
    assert.match(dockerPreviewActionsScript, /const syncDockerStorageRowUpdateColumn = \(\$row,\s*entry = \{\}\) =>/);
    assert.match(dockerPreviewActionsScript, /const syncDockerFolderMemberRows = \(id,\s*runtimeContainers\) => \{[\s\S]*syncDockerStorageRowStatus\(\$row,\s*entry\);[\s\S]*syncDockerStorageRowUpdateColumn\(\$row,\s*entry\);/s);
    assert.match(dockerPreviewActionsScript, /const syncDockerLeafFolderPreviewActions = \(id,\s*folder,\s*runtimeContainers\) =>/);
    assert.match(dockerPreviewActionsScript, /syncDockerFolderMemberRows\(id,\s*runtimeContainers\);/);
    assert.match(dockerPreviewActionsScript, /syncDockerPreviewStatus\(\$target,\s*entry\);/);
    assert.match(dockerPreviewActionsScript, /\$preview\.find\('\[id\^="folder-preview-"\]'\)\.each\(\(_,\s*node\) => \{\s*jq\(node\)\.data\('fvTooltipLazyBuilt', false\);/s);
    assert.match(dockerScript, /const syncDockerFolderMemberRows = \(id,\s*runtimeContainers\) => \{[\s\S]*previewActionsApi\.syncDockerFolderMemberRows\(id,\s*runtimeContainers\);/s);
    assert.match(dockerScript, /const syncDockerLeafFolderPreviewActions = \(id,\s*folder,\s*runtimeContainers\) => \{[\s\S]*previewActionsApi\.syncDockerLeafFolderPreviewActions\(id,\s*folder,\s*runtimeContainers\);/s);
    assert.match(dockerScript, /syncDockerLeafFolderPreviewActions\(id,\s*folder,\s*runtimeContainers\);/);
    assert.match(dockerScript, /const normalizePreviewStatusMode = \(value\) =>/);
    assert.match(dockerScript, /const shouldShowOnlyIconStatus = previewMode === 2 && previewStatusMode === 'symbol';/);
    assert.match(dockerScript, /fv-preview-icon-status/);
    assert.match(dockerScript, /const \$existingIconStatus = \$previewElementTarget\.children\('\.fv-preview-icon-status'\);/);
    assert.match(dockerScript, /previewStatusMode !== 'symbol' && \$existingIconStatus\.length/);
    assert.match(dockerCss, /\.folder-preview \.fv-preview-icon-status\s*\{/);
    assert.match(dockerScript, /const queueDockerDeferredRuntimeInfoHydration = \(generation,\s*stateSignature,\s*fullInfoPromise = null\) => \{[\s\S]*?syncDockerVisibleFoldersFromRuntimeCache\(\);[\s\S]*?\}\)\s*\.catch\(\(\) => \{\}\);/);
    assert.doesNotMatch(dockerScript, /const queueDockerDeferredRuntimeInfoHydration = \(generation,\s*stateSignature,\s*fullInfoPromise = null\) => \{[\s\S]*?const previousWebuiSignature/);
});

test('docker hydration refresh updates collapsed folder update columns from runtime cache', () => {
    assert.match(dockerScript, /const renderFolderUpdateColumn = \(id,\s*\$updateColumn,\s*managerTypes,\s*upToDate,\s*managed\) => \{/);
    assert.match(dockerScript, /renderFolderUpdateColumn\(id,\s*\$updateColumn,\s*managerTypes,\s*upToDate,\s*managed\);/);
    assert.match(dockerRuntimeHierarchyScript, /const renderFolderUpdateColumn = \(id,\s*\$updateColumn,\s*managerTypes,\s*upToDate,\s*managed\) => \{/);
    assert.match(dockerRuntimeHierarchyScript, /const resolveFolderUpdateColumnState = \(managerTypes,\s*upToDate,\s*managed,\s*options = \{\}\) => \{/);
    assert.match(dockerRuntimeHierarchyScript, /const renderFolderUpdateColumn = \(id,\s*\$updateColumn,\s*managerTypes,\s*upToDate,\s*managed\) => \{[\s\S]*const state = resolveFolderUpdateColumnState\(managerTypes,\s*upToDate,\s*managed\);/);
    assert.match(dockerRuntimeHierarchyScript, /const renderFolderUpdateColumn = \(id,\s*\$updateColumn,\s*managerTypes,\s*upToDate,\s*managed\) => \{[\s\S]*updateFolder\('\$\{id\}'\);/);
    assert.match(dockerRuntimeHierarchyScript, /const renderFolderUpdateColumn = \(id,\s*\$updateColumn,\s*managerTypes,\s*upToDate,\s*managed\) => \{[\s\S]*forceUpdateFolder\('\$\{id\}'\);/);
    assert.match(dockerRuntimeHierarchyScript, /const renderFolderUpdateColumn = \(id,\s*\$updateColumn,\s*managerTypes,\s*upToDate,\s*managed\) => \{[\s\S]*jq\.i18n\('update-ready'\)/);
    assert.match(dockerRuntimeHierarchyScript, /const renderFolderUpdateColumn = \(id,\s*\$updateColumn,\s*managerTypes,\s*upToDate,\s*managed\) => \{[\s\S]*jq\.i18n\('up-to-date'\)/);
    assert.match(dockerRuntimeHierarchyScript, /const renderFolderUpdateColumn = \(id,\s*\$updateColumn,\s*managerTypes,\s*upToDate,\s*managed\) => \{[\s\S]*display: \$\{state\.showAdvanced \? 'block' : 'none'\}/);
    assert.match(dockerScript, /const createFolder = \(folder,\s*id,\s*positionInMainOrder,\s*liveOrderArray,\s*containersInfo,\s*foldersDone,\s*matchCacheEntry = null,\s*depthLevel = 0\) => \{[\s\S]*renderFolderUpdateColumn\(id,\s*\$\(`tr\.folder-id-\$\{id\} > td\.updatecolumn`\),\s*managerTypes,\s*upToDate,\s*managed\);/);
    assert.match(dockerScript, /const updateFolderRowStatusFromContainers = \(id,\s*folder,\s*runtimeContainers\) => \{[\s\S]*hierarchyApi\.updateFolderRowStatusFromContainers\(id,\s*folder,\s*runtimeContainers\);/);
    assert.match(dockerRuntimeHierarchyScript, /const updateFolderRowStatusFromContainers = \(id,\s*folder,\s*runtimeContainers\) => \{[\s\S]*const \$updateColumn = \$folderRow\.find\('td\.updatecolumn'\);/);
    assert.match(dockerRuntimeHierarchyScript, /const updateFolderRowStatusFromContainers = \(id,\s*folder,\s*runtimeContainers\) => \{[\s\S]*if \(\$updateColumn\.length && folder\?\.settings\?\.update_column !== true\) \{/);
    assert.match(dockerRuntimeHierarchyScript, /const updateFolderRowStatusFromContainers = \(id,\s*folder,\s*runtimeContainers\) => \{[\s\S]*renderFolderUpdateColumn\(id,\s*\$updateColumn,\s*managerTypes,\s*upToDate,\s*managed\);/);
});

test('docker runtime exposes and applies focus\/lock state guards', () => {
    assert.match(dockerScript, /DOCKER_LOCKED_STATE_KEY/);
    assert.match(dockerScript, /applyDockerFocusedFolderState/);
    assert.match(dockerScript, /ensureDockerFolderUnlocked/);
    assert.match(dockerScript, /Folder locked/);
});

test('docker context menu quick-action strip styles remain defined', () => {
    assert.match(dockerCss, /\.fvplus-docker-context-menu > li\.fvplus-docker-quick-item/);
    assert.match(dockerCss, /\.fvplus-docker-context-menu > li\.fvplus-docker-quick-item > a/);
});

test('docker context menus clamp main and nested menus inside the viewport', () => {
    assert.match(dockerScript, /const DOCKER_CONTEXT_MENU_SELECTORS = \[/);
    assert.match(dockerScript, /const DOCKER_CONTEXT_VIEWPORT_MARGIN = 10;/);
    assert.match(dockerScript, /const positionDockerContextElementInsideViewport = \(element\) =>/);
    assert.match(dockerScript, /rect\.bottom > viewportHeight - margin/);
    assert.match(dockerScript, /rect\.right > viewportWidth - margin/);
    assert.match(dockerScript, /element\.style\.top = `\$\{Math\.max\(margin \+ scrollY,\s*nextTop\)\}px`;/);
    assert.match(dockerScript, /element\.style\.left = `\$\{Math\.max\(margin \+ scrollX,\s*nextLeft\)\}px`;/);
    assert.match(dockerScript, /const adjustDockerContextSubmenuViewportPlacement = \(listItem\) =>/);
    assert.match(dockerScript, /listItem\.classList\.add\('fvplus-context-submenu-open-up'\);/);
    assert.match(dockerScript, /listItem\.classList\.add\('fvplus-context-submenu-open-left'\);/);
    assert.match(dockerScript, /document\.addEventListener\('mouseover',\s*handlePotentialSubmenu,\s*true\);/);
    assert.match(dockerScript, /queueDockerContextViewportGuard\(\);/);
    assert.match(dockerCss, /\.fvplus-docker-context-menu li\.fvplus-context-submenu-open-up > ul/);
    assert.match(dockerCss, /\.fvplus-docker-context-menu li\.fvplus-context-submenu-open-left > ul/);
});
