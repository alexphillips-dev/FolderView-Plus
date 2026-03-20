import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const dockerScript = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js'),
    'utf8'
);

test('docker runtime renders one-click focus/pin/lock row actions', () => {
    assert.match(dockerScript, /fv-folder-row-action-focus/);
    assert.match(dockerScript, /fv-folder-row-action-pin/);
    assert.match(dockerScript, /fv-folder-row-action-lock/);
    assert.match(dockerScript, /toggleDockerFolderFocus\('/);
    assert.match(dockerScript, /toggleDockerFolderPin\('/);
    assert.match(dockerScript, /toggleDockerFolderLock\('/);
});

test('docker runtime exposes and applies focus\/lock state guards', () => {
    assert.match(dockerScript, /DOCKER_LOCKED_STATE_KEY/);
    assert.match(dockerScript, /applyDockerFocusedFolderState/);
    assert.match(dockerScript, /ensureDockerFolderUnlocked/);
    assert.match(dockerScript, /Folder locked/);
});
