import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const dockerScript = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js'),
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
    assert.match(dockerScript, /applyDockerPinnedFolderIds\(Array\.isArray\(response\?\.prefs\?\.pinnedFolderIds\) \? response\.prefs\.pinnedFolderIds : nextPinned\);\s*syncDockerPinnedFolderUi\(\);\s*queueLoadlistRefresh\(\{\s*suppressLoadingUi:\s*true\s*\}\);/s);
    assert.match(dockerScript, /applyDockerPinnedFolderIds\(current\);\s*syncDockerPinnedFolderUi\(\);/s);
});

test('docker hydration refreshes existing preview actions in place instead of reloading the list', () => {
    assert.match(dockerScript, /const syncDockerLeafFolderPreviewActions = \(id,\s*folder,\s*runtimeContainers\) =>/);
    assert.match(dockerScript, /syncDockerLeafFolderPreviewActions\(id,\s*folder,\s*runtimeContainers\);/);
    assert.match(dockerScript, /\$preview\.find\('\[id\^="folder-preview-"\]'\)\.each\(\(_,\s*node\) => \{\s*\$\(node\)\.data\('fvTooltipLazyBuilt', false\);/s);
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
