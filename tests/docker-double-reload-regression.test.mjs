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
    assert.match(dockerJs, /\/\/ Prime requests for environments where loadlist isn't called first\.\s*folderReq = buildDockerFolderReq\(\);/);
    assert.match(dockerJs, /window\.loadlist = \(\) => \{[\s\S]*?loadedFolder = false;[\s\S]*?folderReq = buildDockerFolderReq\(\);/);
    assert.match(dockerJs, /window\.listview = \(\) => \{[\s\S]*?if \(!loadedFolder\) \{[\s\S]*?queueCreateFoldersRender\(\);[\s\S]*?loadedFolder = true;/);
    assert.match(dockerJs, /const queueCreateFoldersRender = \(\) => \{[\s\S]*?if \(createFoldersQueued\) \{\s*createFoldersQueued = false;[\s\S]*?nextDockerRenderSuppressLoadingUi = true;\s*queueCreateFoldersRender\(\);\s*\}[\s\S]*?\};/);
    assert.doesNotMatch(dockerJs, /const queueCreateFoldersRender = \(\) => \{[\s\S]*?if \(createFoldersQueued\) \{\s*createFoldersQueued = false;\s*queueLoadlistRefresh\(\);\s*\}[\s\S]*?\};/);
});
