import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const folderJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js');
const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
const vmJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js');
const sharedRuntimeJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.shared.js');

test('folder editor persists preview border directly from checkbox state', () => {
    assert.match(folderJs, /preview_border:\s*e\.preview_border\.checked/);
    assert.doesNotMatch(folderJs, /preview_border:\s*e\.preview_border\.checked\s*\|\|/);
});

test('folder editor normalizes legacy preview border values when loading existing folders', () => {
    assert.match(folderJs, /const isLegacyPreviewBorderEnabled = \(settings\) =>/);
    assert.match(folderJs, /form\.preview_border\.checked = isLegacyPreviewBorderEnabled\(currFolder\.settings \|\| \{\}\);/);
});

test('docker preview renderer respects preview border toggle', () => {
    assert.match(sharedRuntimeJs, /const explicitOff = raw === '0' \|\| raw === 'false' \|\| raw === 'off' \|\| raw === 'no';/);
    assert.match(sharedRuntimeJs, /const applyPreviewBorderStyle = \(previewNode, settings\) =>/);
    assert.match(sharedRuntimeJs, /previewNode\.style\.setProperty\('border', enabled \? `1px solid \$\{previewColor\}` : 'none', 'important'\)/);
    assert.match(dockerJs, /const applyPreviewBorderStyle = typeof dockerRuntimeShared\.applyPreviewBorderStyle === 'function'/);
    assert.match(dockerJs, /applyPreviewBorderStyle\(previewNode,\s*folder\.settings\)/);
});

test('vm preview renderer honors explicit preview border OFF values', () => {
    assert.match(sharedRuntimeJs, /const isPreviewBorderEnabled = \(settings\) =>/);
    assert.match(sharedRuntimeJs, /const explicitOff = raw === '0' \|\| raw === 'false' \|\| raw === 'off' \|\| raw === 'no';/);
    assert.match(sharedRuntimeJs, /return !explicitOff;/);
    assert.match(sharedRuntimeJs, /const applyPreviewBorderStyle = \(previewNode, settings\) =>/);
    assert.match(vmJs, /const applyPreviewBorderStyle = typeof runtimeShared\.applyPreviewBorderStyle === 'function'/);
    assert.match(vmJs, /applyPreviewBorderStyle\(previewNode,\s*folder\.settings\);/);
});
