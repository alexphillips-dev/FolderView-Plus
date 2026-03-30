import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const dockerJs = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js'),
    'utf8'
);

test('docker runtime preserves hydrated update flags when normalizing partial runtime entries', () => {
    assert.match(dockerJs, /Updated:\s*sourceState\.Updated \?\? previousState\.Updated \?\? null/);
});

test('deferred docker runtime hydration rerenders when update availability changes', () => {
    assert.match(dockerJs, /const buildDockerUpdateSignature = \(source\) =>/);
    assert.match(dockerJs, /const previousUpdateSignature = buildDockerUpdateSignature\(dockerRuntimeInfoByName\);/);
    assert.match(dockerJs, /const nextUpdateSignature = buildDockerUpdateSignature\(dockerRuntimeInfoByName\);/);
    assert.match(dockerJs, /previousWebuiSignature !== nextWebuiSignature \|\| previousUpdateSignature !== nextUpdateSignature/);
    assert.match(dockerJs, /queueLoadlistRefresh\(\);\s*return;/);
});

test('folder update-column renderer is reused across initial and synced folder state', () => {
    assert.match(dockerJs, /const renderFolderUpdateColumn = \(id,\s*\$updateColumn,\s*managerTypes,\s*upToDate,\s*managed\) =>/);
    const helperUsages = dockerJs.match(/renderFolderUpdateColumn\(id,\s*(?:\$\(`tr\.folder-id-\$\{id\} > td\.updatecolumn`\)|\$updateColumn),\s*managerTypes,\s*upToDate,\s*managed\);/g) || [];
    assert.ok(helperUsages.length >= 2, 'expected shared folder update-column rendering in both initial and sync paths');
});
