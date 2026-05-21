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
const dockerCss = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/docker.css'),
    'utf8'
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
    assert.doesNotMatch(dockerScript, /fv-folder-row-actions/);
});

test('docker pin quick action updates visible folder order immediately', () => {
    assert.match(dockerScript, /const reorderVisibleDockerRootFolderBlocks = \(\) =>/);
    assert.match(dockerScript, /const syncDockerPinnedFolderUi = \(\) =>/);
    assert.match(dockerScript, /applyDockerPinnedFolderIds\(nextPinned\);\s*syncDockerPinnedFolderUi\(\);/s);
    assert.match(dockerScript, /applyDockerPinnedFolderIds\(Array\.isArray\(response\?\.prefs\?\.pinnedFolderIds\) \? response\.prefs\.pinnedFolderIds : nextPinned\);\s*syncDockerPinnedFolderUi\(\);/s);
    assert.doesNotMatch(dockerScript, /applyDockerPinnedFolderIds\(Array\.isArray\(response\?\.prefs\?\.pinnedFolderIds\) \? response\.prefs\.pinnedFolderIds : nextPinned\);\s*syncDockerPinnedFolderUi\(\);\s*queueLoadlistRefresh\(/s);
    assert.match(dockerScript, /applyDockerPinnedFolderIds\(current\);\s*syncDockerPinnedFolderUi\(\);/s);
});

test('docker hydration refreshes existing preview actions in place instead of reloading the list', () => {
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
