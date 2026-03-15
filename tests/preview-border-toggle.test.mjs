import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const folderJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js');
const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
const vmJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js');

test('folder editor persists preview border directly from checkbox state', () => {
    assert.match(folderJs, /preview_border:\s*e\.preview_border\.checked/);
    assert.doesNotMatch(folderJs, /preview_border:\s*e\.preview_border\.checked\s*\|\|/);
});

test('folder editor normalizes legacy preview border values when loading existing folders', () => {
    assert.match(folderJs, /const normalizeBooleanSetting = \(value, fallback = false\) =>/);
    assert.match(folderJs, /normalizeBooleanSetting\(currFolder\.settings\.preview_border,\s*true\)/);
});

test('docker preview renderer respects preview border toggle', () => {
    assert.match(dockerJs, /const normalizePreviewBorderEnabled = \(settings, fallback = true\) =>/);
    assert.match(dockerJs, /previewNode\.style\.setProperty\('border', 'none', 'important'\)/);
    assert.match(dockerJs, /applyPreviewBorderStyle\(previewNode,\s*folder\.settings\)/);
});

test('vm preview renderer respects preview border toggle', () => {
    assert.match(vmJs, /const normalizePreviewBorderEnabled = \(settings, fallback = true\) =>/);
    assert.match(vmJs, /previewNode\.style\.setProperty\('border', 'none', 'important'\)/);
    assert.match(vmJs, /applyPreviewBorderStyle\(previewNode,\s*folder\.settings\)/);
});

