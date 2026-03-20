import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const dockerScript = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js'),
    'utf8'
);

test('docker context menu keeps focus/pin/lock quick actions at the top', () => {
    assert.match(dockerScript, /text:\s*focused \? 'Clear focus' : 'Focus folder'/);
    assert.match(dockerScript, /text:\s*pinned \? 'Unpin folder' : 'Pin folder'/);
    assert.match(dockerScript, /text:\s*locked \? 'Unlock folder' : 'Lock folder'/);
    assert.match(dockerScript, /toggleDockerFolderFocus\(id\)/);
    assert.match(dockerScript, /toggleDockerFolderPin\(id\)/);
    assert.match(dockerScript, /toggleDockerFolderLock\(id\)/);
    assert.doesNotMatch(dockerScript, /fv-folder-row-actions/);
});

test('docker runtime exposes and applies focus\/lock state guards', () => {
    assert.match(dockerScript, /DOCKER_LOCKED_STATE_KEY/);
    assert.match(dockerScript, /applyDockerFocusedFolderState/);
    assert.match(dockerScript, /ensureDockerFolderUnlocked/);
    assert.match(dockerScript, /Folder locked/);
});
