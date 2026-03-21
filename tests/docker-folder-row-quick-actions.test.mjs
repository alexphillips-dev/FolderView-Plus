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
