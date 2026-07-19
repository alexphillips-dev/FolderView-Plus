import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const dockerJs = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js'),
    'utf8'
);

test('docker queued bootstrap renders replay in place instead of forcing a second host loadlist', () => {
    assert.match(dockerJs, /\/\/ Prime requests for environments where loadlist isn't called first\.\s*folderReq = ensureDockerFolderReqForHostRender\(\);/);
    assert.match(dockerJs, /wrapHostHook\?\.\('loadlist',[\s\S]*?loadedFolder = false;[\s\S]*?folderReq = ensureDockerFolderReqForHostRender\(\);/);
    assert.match(dockerJs, /const hasReusableBundle = folderReq[\s\S]*folderReq\.consumed !== true/);
    assert.match(dockerJs, /wrapHostHook\?\.\('listview',[\s\S]*?if \(!loadedFolder\) \{[\s\S]*?queueCreateFoldersRender\(\);[\s\S]*?loadedFolder = true;/);
    assert.match(dockerJs, /const queueCreateFoldersRender = \(\) => \{[\s\S]*?if \(createFoldersQueued\) \{\s*createFoldersQueued = false;[\s\S]*?nextDockerRenderSuppressLoadingUi = true;\s*queueCreateFoldersRender\(\);\s*\}[\s\S]*?\};/);
    assert.doesNotMatch(dockerJs, /const queueCreateFoldersRender = \(\) => \{[\s\S]*?if \(createFoldersQueued\) \{\s*createFoldersQueued = false;\s*queueLoadlistRefresh\(\);\s*\}[\s\S]*?\};/);
});
