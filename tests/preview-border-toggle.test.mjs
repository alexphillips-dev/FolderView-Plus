import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const folderJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js');
const folderLegacyJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.legacy.js');
const folderPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/Folder.page');
const folderCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folder.css');
const dockerJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js');
const vmJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.js');
const sharedRuntimeJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.shared.js');
const dockerCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/docker.css');
const vmCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/vm.css');
const serverLibPhp = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php');

test('folder editor persists preview border directly from checkbox state', () => {
    assert.match(folderJs, /preview_border:\s*e\.preview_border\.checked/);
    assert.doesNotMatch(folderJs, /preview_border:\s*e\.preview_border\.checked\s*\|\|/);
});

test('folder editor keeps border and chevron reset controls grouped with their fields', () => {
    assert.match(folderPage, /<div class="fv-inline-control-row">[\s\S]*name="preview_border_color"[\s\S]*name="preview_border_width"[\s\S]*resetPreviewBorderDefaults\(\)/);
    assert.match(folderPage, /<div class="fv-inline-control-row">[\s\S]*name="dropdown_color"[\s\S]*name="dropdown_hover_color"[\s\S]*resetDropdownColorDefaults\(\)/);
    assert.match(folderCss, /\.fv-inline-control-row\s*\{[\s\S]*display:\s*inline-flex !important;[\s\S]*align-items:\s*center !important;[\s\S]*max-width:\s*max-content;/);
    assert.match(folderCss, /\.fv-inline-control-row > input,[\s\S]*margin-right:\s*0 !important;[\s\S]*flex:\s*0 0 auto;/);
    assert.match(folderCss, /\.fv-inline-reset-btn\s*\{[\s\S]*width:\s*28px !important;[\s\S]*height:\s*28px !important;[\s\S]*display:\s*inline-flex !important;/);
    assert.match(folderJs, /const resetPreviewBorderDefaults = \(\) =>/);
    assert.match(folderJs, /form\.preview_border_color\.value = DEFAULT_BORDER_COLOR;/);
    assert.match(folderJs, /form\.preview_border_width\.value = String\(DEFAULT_PREVIEW_BORDER_WIDTH\);/);
    assert.match(folderJs, /scheduleEditorRecalculation\(0\);/);
    assert.match(folderJs, /const resetDropdownColorDefaults = \(\) =>/);
    assert.match(folderJs, /form\.dropdown_color\.value = DEFAULT_DROPDOWN_COLOR;/);
    assert.match(folderJs, /form\.dropdown_hover_color\.value = DEFAULT_DROPDOWN_HOVER_COLOR;/);
});

test('legacy folder editor exposes grouped reset helpers and boxed chevron compatibility', () => {
    assert.match(folderLegacyJs, /const resetPreviewBorderDefaults = \(\) =>/);
    assert.match(folderLegacyJs, /window\.resetPreviewBorderDefaults = resetPreviewBorderDefaults;/);
    assert.match(folderLegacyJs, /form\.preview_border_color\.value = DEFAULT_BORDER_COLOR;/);
    assert.match(folderLegacyJs, /form\.preview_border_width\.value = String\(DEFAULT_PREVIEW_BORDER_WIDTH\);/);
    assert.match(folderLegacyJs, /const resetDropdownColorDefaults = \(\) =>/);
    assert.match(folderLegacyJs, /window\.resetDropdownColorDefaults = resetDropdownColorDefaults;/);
    assert.match(folderLegacyJs, /form\.dropdown_color\.value = DEFAULT_DROPDOWN_COLOR;/);
    assert.match(folderLegacyJs, /form\.dropdown_hover_color\.value = DEFAULT_DROPDOWN_HOVER_COLOR;/);
    assert.match(folderLegacyJs, /const extractDropdownStyleValue = \(value,\s*fallbackSource = null\) =>/);
    assert.match(folderLegacyJs, /source\.dropdown_style\s*\?\?\s*source\.dropdownStyle\s*\?\?\s*source\.chevron_style\s*\?\?\s*source\.chevronStyle/);
    assert.match(folderLegacyJs, /if \(normalized === 'boxed' \|\| normalized === 'minimal'\)/);
    assert.match(folderLegacyJs, /form\.dropdown_style\.value = normalizeDropdownStyle\(currFolder\.settings,\s*currFolder\);/);
    assert.match(folderLegacyJs, /dropdownStyle:\s*normalizeDropdownStyle\(e\.dropdown_style\.value\.toString\(\)\),/);
    assert.match(folderLegacyJs, /chevron_style:\s*normalizeDropdownStyle\(e\.dropdown_style\.value\.toString\(\)\),/);
});

test('folder editor normalizes legacy preview border values when loading existing folders', () => {
    assert.match(folderJs, /const extractDropdownStyleValue = \(value,\s*fallbackSource = null\) =>/);
    assert.match(folderJs, /source\.dropdown_style\s*\?\?\s*source\.dropdownStyle\s*\?\?\s*source\.chevron_style\s*\?\?\s*source\.chevronStyle/);
    assert.match(folderJs, /const extractPreviewRowLimitValue = \(value,\s*fallbackSource = null\) =>/);
    assert.match(folderJs, /source\.preview_rows\s*\?\?\s*source\.previewRows/);
    assert.match(folderJs, /const isLegacyPreviewBorderEnabled = \(settings\) =>/);
    assert.match(folderJs, /return normalized === 'boxed' \|\| normalized === 'minimal'/);
    assert.match(folderJs, /setFieldChecked\('preview_border',\s*isLegacyPreviewBorderEnabled\(currentEditFolder\.settings \|\| \{\}\)\);/);
    assert.match(folderJs, /preview_border_width:\s*normalizePositiveInt\(settings\.preview_border_width,\s*DEFAULT_PREVIEW_BORDER_WIDTH,\s*1,\s*4\)/);
    assert.match(folderJs, /preview_vertical_bars_width:\s*normalizePositiveInt\(settings\.preview_vertical_bars_width,\s*DEFAULT_PREVIEW_VERTICAL_BARS_WIDTH,\s*1,\s*4\)/);
    assert.match(folderJs, /preview_rows:\s*normalizePreviewRowLimit\(settings,\s*source\)/);
    assert.match(folderJs, /dropdown_style:\s*normalizeDropdownStyle\(settings,\s*source\)/);
    assert.match(folderJs, /dropdown_color:\s*normalizeHexColor\(settings\.dropdown_color,\s*DEFAULT_DROPDOWN_COLOR\)/);
    assert.match(folderJs, /dropdown_hover_color:\s*normalizeHexColor\(settings\.dropdown_hover_color,\s*DEFAULT_DROPDOWN_HOVER_COLOR\)/);
    assert.match(folderJs, /setFieldValue\('preview_rows',\s*String\(normalizePreviewRowLimit\(currentEditFolder\.settings,\s*currentEditFolder\)\)\);/);
    assert.match(folderJs, /setFieldValue\('dropdown_style',\s*normalizeDropdownStyle\(currentEditFolder\.settings,\s*currentEditFolder\)\);/);
    assert.match(folderJs, /preview_rows:\s*normalizedPreviewRows,/);
    assert.match(folderJs, /previewRows:\s*normalizedPreviewRows,/);
    assert.match(folderJs, /dropdown_style:\s*normalizedDropdownStyle,/);
    assert.match(folderJs, /dropdownStyle:\s*normalizedDropdownStyle,/);
    assert.match(folderJs, /chevron_style:\s*normalizedDropdownStyle,/);
    assert.match(folderJs, /chevronStyle:\s*normalizedDropdownStyle,/);
});

test('docker preview renderer respects preview border toggle', () => {
    assert.match(sharedRuntimeJs, /const explicitOff = raw === '0' \|\| raw === 'false' \|\| raw === 'off' \|\| raw === 'no';/);
    assert.match(sharedRuntimeJs, /const extractDropdownStyleValue = \(value\) =>/);
    assert.match(sharedRuntimeJs, /value\.dropdown_style\s*\?\?\s*value\.dropdownStyle\s*\?\?\s*value\.chevron_style\s*\?\?\s*value\.chevronStyle/);
    assert.match(sharedRuntimeJs, /return normalized === 'boxed' \|\| normalized === 'minimal'/);
    assert.match(sharedRuntimeJs, /const applyPreviewBorderStyle = \(previewNode, settings\) =>/);
    assert.match(sharedRuntimeJs, /previewNode\.style\.setProperty\('--fvplus-preview-border-width', `\$\{previewBorderWidth\}px`\)/);
    assert.match(sharedRuntimeJs, /previewNode\.style\.setProperty\('--fvplus-preview-divider-width', `\$\{previewBarsWidth\}px`\)/);
    assert.match(sharedRuntimeJs, /previewNode\.style\.setProperty\('border', enabled \? `\$\{previewBorderWidth\}px solid \$\{previewColor\}` : 'none', 'important'\)/);
    assert.match(sharedRuntimeJs, /const dropdownStyle = normalizeDropdownStyle\(source\);/);
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

test('server normalizes legacy chevron aliases into dropdown_style', () => {
    assert.match(serverLibPhp, /\$rawPreviewRows = \$normalized\['settings'\]\['preview_rows'\]/);
    assert.match(serverLibPhp, /\$normalized\['settings'\]\['previewRows'\]/);
    assert.match(serverLibPhp, /\$normalized\['preview_rows'\]/);
    assert.match(serverLibPhp, /\$normalized\['previewRows'\]/);
    assert.match(serverLibPhp, /\$normalized\['settings'\]\['preview_rows'\] = is_numeric\(\$rawPreviewRows\)/);
    assert.match(serverLibPhp, /\$normalized\['settings'\]\['previewRows'\] = \$normalized\['settings'\]\['preview_rows'\];/);
    assert.match(serverLibPhp, /\$rawDropdownStyle = \$normalized\['settings'\]\['dropdown_style'\]/);
    assert.match(serverLibPhp, /\$normalized\['settings'\]\['dropdownStyle'\]/);
    assert.match(serverLibPhp, /\$normalized\['settings'\]\['chevron_style'\]/);
    assert.match(serverLibPhp, /\$normalized\['settings'\]\['chevronStyle'\]/);
    assert.match(serverLibPhp, /\$normalized\['dropdown_style'\]/);
    assert.match(serverLibPhp, /\$normalized\['dropdownStyle'\]/);
    assert.match(serverLibPhp, /\$normalized\['chevron_style'\]/);
    assert.match(serverLibPhp, /\$normalized\['chevronStyle'\]/);
    assert.match(serverLibPhp, /\$normalized\['settings'\]\['dropdown_style'\] = truncateUtf8String\(trim\(\(string\)\$rawDropdownStyle\), 32\);/);
    assert.match(serverLibPhp, /\$normalized\['settings'\]\['dropdownStyle'\] = \$normalized\['settings'\]\['dropdown_style'\];/);
    assert.match(serverLibPhp, /\$normalized\['settings'\]\['chevron_style'\] = \$normalized\['settings'\]\['dropdown_style'\];/);
    assert.match(serverLibPhp, /\$normalized\['settings'\]\['chevronStyle'\] = \$normalized\['settings'\]\['dropdown_style'\];/);
});

test('single-row Docker and VM previews stay vertically centered', () => {
    assert.match(dockerCss, /\.folder-preview-wrapper\s*\{[\s\S]*margin-top:\s*7px;[\s\S]*align-items:\s*center;/);
    assert.match(dockerCss, /\.folder-preview-wrapper > span\.outer\s*\{[\s\S]*display:\s*inline-flex;[\s\S]*align-items:\s*center;/);
    assert.match(vmCss, /\.folder-preview-wrapper\s*\{[\s\S]*float:\s*left;[\s\S]*margin-top:\s*7px;/);
});
