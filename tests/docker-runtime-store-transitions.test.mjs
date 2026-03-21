import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const dockerJs = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js'),
    'utf8'
);

test('docker runtime store seeds focused/locked/pinned state contract', () => {
    assert.match(dockerJs, /const dockerRuntimeStateStore = createDockerRuntimeStateStore\(\{\s*focusedFolderId:\s*''\s*,\s*lockedFolderIds:\s*\[\]\s*,\s*pinnedFolderIds:\s*\[\]/s);
    assert.match(dockerJs, /let dockerFocusedFolderId = String\(dockerRuntimeStateStore\.get\('focusedFolderId', ''\) \|\| ''\)\.trim\(\);/);
    assert.match(dockerJs, /dockerRuntimeStateStore\.set\(\{\s*lockedFolderIds:\s*Array\.from\(dockerLockedFolderIdSet\)\s*\}\)/);
});

test('docker runtime store transition handlers keep focus/pin/lock paths synchronized', () => {
    assert.match(dockerJs, /const toggleDockerFolderFocus = \(folderId\) =>/);
    assert.match(dockerJs, /dockerRuntimeStateStore\.set\(\{\s*focusedFolderId:\s*nextFocus\s*\}\)/);
    assert.match(dockerJs, /const toggleDockerFolderLock = \(folderId\) =>/);
    assert.match(dockerJs, /writeDockerLockedFolderIds\(Array\.from\(dockerLockedFolderIdSet\)\)/);
    assert.match(dockerJs, /dockerRuntimeStateStore\.set\(\{\s*lockedFolderIds:\s*Array\.from\(dockerLockedFolderIdSet\)\s*\}\)/);
    assert.match(dockerJs, /const applyDockerPinnedFolderIds = \(nextPinnedIds\) =>/);
    assert.match(dockerJs, /dockerRuntimeStateStore\.set\(\{\s*pinnedFolderIds:\s*Array\.isArray\(nextPinnedIds\)\s*\?\s*\[\.\.\.nextPinnedIds\]\s*:\s*\[\]\s*\}\)/);
});
