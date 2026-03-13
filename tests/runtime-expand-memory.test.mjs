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
    assert.match(dockerJs, /readDockerServerExpandedStateMap/);
    assert.match(dockerJs, /syncDockerExpandedStateToServer/);
    assert.match(dockerJs, /const readDockerExpandedStateMap = \(\) =>/);
    assert.match(dockerJs, /const buildDockerExpandedStateMap = \(folders, previousFolders = \{\}, serverMap = \{\}\) =>/);
    assert.match(dockerJs, /const persistDockerExpandedStateFromGlobal = \([^)]*\) =>/);
    assert.match(dockerJs, /const persistDockerExpandedStateFromDom = \(\) =>/);
    assert.match(dockerJs, /const ensureDockerExpandedStateLifecycleHooks = \(\) =>/);
    assert.match(dockerJs, /window\.addEventListener\('pagehide', persistDockerExpandedStateFromDom/);
    assert.match(dockerJs, /const expandedStateById = buildDockerExpandedStateMap\(\s*foldersDone,\s*previousFolders,\s*readDockerServerExpandedStateMap\(\)\s*\);/);
    assert.match(dockerJs, /const hasKnownParent = !!\(parentId && Object\.prototype\.hasOwnProperty\.call\(foldersDone, parentId\)\);/);
    assert.match(dockerJs, /dropDownButton\(id, false\);/);
    assert.match(dockerJs, /const dropDownButton = \(id, persistState = true\) =>/);
    assert.match(dockerJs, /if \(persistState\) \{\s*persistDockerExpandedStateFromGlobal\(\);\s*\}/);
});

test('vm runtime persists expanded/collapsed folder state and restores it during render', () => {
    assert.match(vmJs, /VM_EXPANDED_STATE_KEY/);
    assert.match(vmJs, /readVmServerExpandedStateMap/);
    assert.match(vmJs, /syncVmExpandedStateToServer/);
    assert.match(vmJs, /const readVmExpandedStateMap = \(\) =>/);
    assert.match(vmJs, /const buildVmExpandedStateMap = \(folders, previousFolders = \{\}, serverMap = \{\}\) =>/);
    assert.match(vmJs, /const persistVmExpandedStateFromGlobal = \([^)]*\) =>/);
    assert.match(vmJs, /const persistVmExpandedStateFromDom = \(\) =>/);
    assert.match(vmJs, /const ensureVmExpandedStateLifecycleHooks = \(\) =>/);
    assert.match(vmJs, /window\.addEventListener\('pagehide', persistVmExpandedStateFromDom/);
    assert.match(vmJs, /const expandedStateById = buildVmExpandedStateMap\(\s*foldersDone,\s*previousFolders,\s*readVmServerExpandedStateMap\(\)\s*\);/);
    assert.match(vmJs, /const hasKnownParent = !!\(parentId && Object\.prototype\.hasOwnProperty\.call\(foldersDone, parentId\)\);/);
    assert.match(vmJs, /dropDownButton\(id, false\);/);
    assert.match(vmJs, /const dropDownButton = \(id, persistState = true\) =>/);
    assert.match(vmJs, /if \(persistState\) \{\s*persistVmExpandedStateFromGlobal\(\);\s*\}/);
});
