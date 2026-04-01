import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const folderJs = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js'),
    'utf8'
);
const folderLegacyJs = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.legacy.js'),
    'utf8'
);
const settingsJs = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js'),
    'utf8'
);

test('modern folder editor update summary accepts normalized update flags from member inventory', () => {
    assert.match(folderJs, /const isDockerUpdateAvailableInEditor = \(member\) => \{/);
    assert.match(folderJs, /if \(source\.UpdateAvailable === true \|\| source\.update === true\) \{\s*return true;\s*\}/);
    assert.match(folderJs, /const state = source\?\.State \|\| source\?\.RawState \|\| source\?\.info\?\.State \|\| \{\};/);
});

test('legacy folder editor update summary accepts normalized update flags from member inventory', () => {
    assert.match(folderLegacyJs, /function isDockerUpdateAvailableInEditor\(member\) \{/);
    assert.match(folderLegacyJs, /if \(source\.UpdateAvailable === true \|\| source\.update === true\) \{\s*return true;\s*\}/);
    assert.match(folderLegacyJs, /const state = source\?\.State \|\| source\?\.RawState \|\| source\?\.info\?\.State \|\| \{\};/);
});

test('shared docker update helper accepts normalized update flags outside the Docker page runtime', () => {
    assert.match(settingsJs, /const isDockerUpdateAvailable = \(itemInfo\) => \{/);
    assert.match(settingsJs, /if \(source\.UpdateAvailable === true \|\| source\.update === true\) \{\s*return true;\s*\}/);
});
