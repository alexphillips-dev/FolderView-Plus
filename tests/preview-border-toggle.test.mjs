import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const folderJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js');
const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');

test('folder editor persists preview border directly from checkbox state', () => {
    assert.match(folderJs, /preview_border:\s*e\.preview_border\.checked/);
    assert.doesNotMatch(folderJs, /preview_border:\s*e\.preview_border\.checked\s*\|\|/);
});

test('folder editor normalizes legacy preview border values when loading existing folders', () => {
    assert.match(folderJs, /!\/\^\(0\|false\)\$\/i\.test\(String\(currFolder\.settings\.preview_border\)\.trim\(\)\)/);
});

test('docker preview renderer respects preview border toggle', () => {
    assert.match(dockerJs, /const raw = String\(source\.preview_border \?\? ''\)\.trim\(\)\.toLowerCase\(\)/);
    assert.match(dockerJs, /const enabled = !Object\.prototype\.hasOwnProperty\.call\(source, 'preview_border'\) \|\| \(raw !== '0' && raw !== 'false'\)/);
    assert.match(dockerJs, /previewNode\.style\.setProperty\('border', enabled \? `1px solid \$\{normalizeStatusHexColor\(source\.preview_border_color, '#afa89e'\)\}` : 'none', 'important'\)/);
    assert.match(dockerJs, /applyPreviewBorderStyle\(previewNode,\s*folder\.settings\)/);
});
