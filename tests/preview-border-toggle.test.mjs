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
    assert.match(folderJs, /preview_border_width:\s*normalizePositiveInt\(settings\.preview_border_width,\s*DEFAULT_PREVIEW_BORDER_WIDTH,\s*1,\s*4\)/);
    assert.match(folderJs, /preview_vertical_bars_width:\s*normalizePositiveInt\(settings\.preview_vertical_bars_width,\s*DEFAULT_PREVIEW_VERTICAL_BARS_WIDTH,\s*1,\s*4\)/);
    assert.match(folderJs, /dropdown_style:\s*normalizeDropdownStyle\(settings\.dropdown_style\)/);
    assert.match(folderJs, /dropdown_color:\s*normalizeHexColor\(settings\.dropdown_color,\s*DEFAULT_DROPDOWN_COLOR\)/);
    assert.match(folderJs, /dropdown_hover_color:\s*normalizeHexColor\(settings\.dropdown_hover_color,\s*DEFAULT_DROPDOWN_HOVER_COLOR\)/);
});

test('docker preview renderer respects preview border toggle', () => {
    assert.match(sharedRuntimeJs, /const explicitOff = raw === '0' \|\| raw === 'false' \|\| raw === 'off' \|\| raw === 'no';/);
    assert.match(sharedRuntimeJs, /const applyPreviewBorderStyle = \(previewNode, settings\) =>/);
    assert.match(sharedRuntimeJs, /previewNode\.style\.setProperty\('--fvplus-preview-border-width', `\$\{previewBorderWidth\}px`\)/);
    assert.match(sharedRuntimeJs, /previewNode\.style\.setProperty\('--fvplus-preview-divider-width', `\$\{previewBarsWidth\}px`\)/);
    assert.match(sharedRuntimeJs, /previewNode\.style\.setProperty\('border', enabled \? `\$\{previewBorderWidth\}px solid \$\{previewColor\}` : 'none', 'important'\)/);
    assert.match(sharedRuntimeJs, /const applyFolderDropdownStyle = \(\$folderRow, settings\) =>/);
    assert.match(dockerJs, /const applyPreviewBorderStyle = typeof dockerRuntimeShared\.applyPreviewBorderStyle === 'function'/);
    assert.match(dockerJs, /const applyFolderDropdownStyle = typeof dockerRuntimeShared\.applyFolderDropdownStyle === 'function'/);
    assert.match(dockerJs, /applyPreviewBorderStyle\(previewNode,\s*folder\.settings\)/);
    assert.match(dockerJs, /applyFolderDropdownStyle\(\$folderRow,\s*folder\.settings\)/);
});

test('vm preview renderer honors explicit preview border OFF values', () => {
    assert.match(sharedRuntimeJs, /const isPreviewBorderEnabled = \(settings\) =>/);
    assert.match(sharedRuntimeJs, /const explicitOff = raw === '0' \|\| raw === 'false' \|\| raw === 'off' \|\| raw === 'no';/);
    assert.match(sharedRuntimeJs, /return !explicitOff;/);
    assert.match(sharedRuntimeJs, /const applyPreviewBorderStyle = \(previewNode, settings\) =>/);
    assert.match(vmJs, /const applyPreviewBorderStyle = typeof runtimeShared\.applyPreviewBorderStyle === 'function'/);
    assert.match(vmJs, /const applyFolderDropdownStyle = typeof runtimeShared\.applyFolderDropdownStyle === 'function'/);
    assert.match(vmJs, /applyPreviewBorderStyle\(previewNode,\s*folder\.settings\);/);
    assert.match(vmJs, /applyFolderDropdownStyle\(\$folderRow,\s*folder\.settings\);/);
});
