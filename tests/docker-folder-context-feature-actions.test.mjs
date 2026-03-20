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
    assert.match(dockerScript, /const collectFolderWebuiTargets = \(id, includeDescendants = true, runningOnly = true\) =>/);
    assert.match(dockerScript, /const openFolderWebuisFromMenu = \(id, runningOnly = true, includeDescendants = false\) =>/);
    assert.match(dockerScript, /Open all WebUIs/);
    assert.match(dockerScript, /collectFolderWebuiTargets\(id, false, true\)/);
    assert.match(dockerScript, /entry\?\.state === true && entry\?\.pause !== true/);
    assert.match(dockerScript, /window\.open\('about:blank', `fvw-\$\{stamp\}-\$\{index\}`\)/);
    assert.match(dockerScript, /showFolderWebuiPopupWarning/);
    assert.match(dockerScript, /Browser Quick Guide/);
    assert.match(dockerScript, /Blocked WebUIs \(manual open\)/);
    assert.match(dockerScript, /dockerRuntimeInfoByName/);
    assert.match(dockerScript, /openFolderWebuisFromMenu\(id, true, false\)/);
});

test('docker folder context supports clone-folder action flow', () => {
    assert.match(dockerScript, /const cloneDockerFolderFromMenu = async \(id\) =>/);
    assert.match(dockerScript, /window\.prompt\('Clone folder name'/);
    assert.match(dockerScript, /\/server\/create\.php/);
    assert.match(dockerScript, /text:\s*getDockerMenuLabel\('clone-folder',\s*'Clone folder'\)/);
});
