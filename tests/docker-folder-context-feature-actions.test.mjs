import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const dockerScript = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js'),
    'utf8'
);

test('docker folder context supports open-all-webui actions with scoped options', () => {
    assert.match(dockerScript, /const getFolderWebuiTargets = \(id, \{ includeDescendants = true, runningOnly = true \} = \{\}\) =>/);
    assert.match(dockerScript, /const openAllFolderWebUIs = \(id, \{ includeDescendants = true, runningOnly = true \} = \{\}\) =>/);
    assert.match(dockerScript, /Open all WebUIs/);
    assert.match(dockerScript, /Folder \+ descendants \(running\)/);
});

test('docker folder context supports clone-folder action flow', () => {
    assert.match(dockerScript, /const suggestCloneFolderName = \(baseName, parentId, excludeId = ''\) =>/);
    assert.match(dockerScript, /const cloneDockerFolder = async \(id, cloneName\) =>/);
    assert.match(dockerScript, /const cloneDockerFolderWithPrompt = async \(id\) =>/);
    assert.match(dockerScript, /text: 'Clone folder'/);
});
