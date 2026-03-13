import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
const vmJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js');

test('docker runtime persists expanded/collapsed folder state and restores it during render', () => {
    assert.match(dockerJs, /DOCKER_EXPANDED_STATE_KEY/);
    assert.match(dockerJs, /const readDockerExpandedStateMap = \(\) =>/);
    assert.match(dockerJs, /const buildDockerExpandedStateMap = \(folders, previousFolders = \{\}\) =>/);
    assert.match(dockerJs, /const persistDockerExpandedStateFromGlobal = \(\) =>/);
    assert.match(dockerJs, /const expandedStateById = buildDockerExpandedStateMap\(foldersDone, previousFolders\);/);
    assert.match(dockerJs, /const hasKnownParent = !!\(parentId && Object\.prototype\.hasOwnProperty\.call\(foldersDone, parentId\)\);/);
    assert.match(dockerJs, /dropDownButton\(id, false\);/);
    assert.match(dockerJs, /const dropDownButton = \(id, persistState = true\) =>/);
    assert.match(dockerJs, /if \(persistState\) \{\s*persistDockerExpandedStateFromGlobal\(\);\s*\}/);
});

test('vm runtime persists expanded/collapsed folder state and restores it during render', () => {
    assert.match(vmJs, /VM_EXPANDED_STATE_KEY/);
    assert.match(vmJs, /const readVmExpandedStateMap = \(\) =>/);
    assert.match(vmJs, /const buildVmExpandedStateMap = \(folders, previousFolders = \{\}\) =>/);
    assert.match(vmJs, /const persistVmExpandedStateFromGlobal = \(\) =>/);
    assert.match(vmJs, /const expandedStateById = buildVmExpandedStateMap\(foldersDone, previousFolders\);/);
    assert.match(vmJs, /const hasKnownParent = !!\(parentId && Object\.prototype\.hasOwnProperty\.call\(foldersDone, parentId\)\);/);
    assert.match(vmJs, /dropDownButton\(id, false\);/);
    assert.match(vmJs, /const dropDownButton = \(id, persistState = true\) =>/);
    assert.match(vmJs, /if \(persistState\) \{\s*persistVmExpandedStateFromGlobal\(\);\s*\}/);
});
