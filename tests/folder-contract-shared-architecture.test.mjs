import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const folderContractJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.folder-contract.js');
const folderEditorSharedJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.shared.js');
const folderEditorSchemaJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.schema.js');
const folderEditorPreviewJs = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.preview.js');
const dockerPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.Docker.page');
const vmPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.VMs.page');
const folderPage = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/Folder.page');
const runtimeSharedCss = read('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/runtime.shared.css');

test('shared folder contract exports the canonical row, dropdown, and preview normalization helpers', () => {
    assert.match(folderContractJs, /^\/\/ @ts-check/m);
    assert.match(folderContractJs, /const DEFAULT_PREVIEW_BORDER_COLOR = '#afa89e';/);
    assert.match(folderContractJs, /const DEFAULT_PREVIEW_BORDER_WIDTH = 1;/);
    assert.match(folderContractJs, /const DEFAULT_PREVIEW_VERTICAL_BARS_WIDTH = 1;/);
    assert.match(folderContractJs, /const DEFAULT_DROPDOWN_STYLE = 'minimal';/);
    assert.match(folderContractJs, /const DEFAULT_DROPDOWN_COLOR = '#ff9a3c';/);
    assert.match(folderContractJs, /const DEFAULT_DROPDOWN_HOVER_COLOR = '#111111';/);
    assert.match(folderContractJs, /const SUPPORTED_DROPDOWN_STYLES = Object\.freeze\(\['minimal', 'boxed', 'ghost', 'pill', 'filled'\]\);/);
    assert.match(folderContractJs, /const normalizeHexColor = \(value,\s*fallback\) =>/);
    assert.match(folderContractJs, /const normalizePositiveInt = \(value,\s*fallback,\s*min = 1,\s*max = 4\) =>/);
    assert.match(folderContractJs, /const extractDropdownStyleValue = \(value,\s*fallbackSource = null\) =>/);
    assert.match(folderContractJs, /const normalizeDropdownStyle = \(value,\s*fallbackSource = null\) =>/);
    assert.match(folderContractJs, /const hexColorToRgba = \(hex,\s*alpha\) =>/);
    assert.match(folderContractJs, /const getDropdownStyleTokens = \(style,\s*normalColor,\s*hoverColor\) =>/);
    assert.match(folderContractJs, /const isPreviewBorderEnabled = \(settings\) =>/);
    assert.match(folderContractJs, /const extractPreviewRowLimitValue = \(value,\s*fallbackSource = null\) =>/);
    assert.match(folderContractJs, /const normalizePreviewRowLimit = \(value,\s*fallbackSource = null\) =>/);
    assert.match(folderContractJs, /window\.FolderViewPlusFolderContract = \{/);
});

test('shared folder editor module owns normalization and reset helper primitives', () => {
    assert.match(folderEditorSharedJs, /^\/\/ @ts-check/m);
    assert.match(folderEditorSharedJs, /\(function fvplusFolderEditorSharedScope\(window\) \{/);
    assert.match(folderEditorSharedJs, /const createApi = \(deps = \{\}\) =>/);
    assert.match(folderEditorSharedJs, /const normalizeOptionalHealthSelect = \(value,\s*allowedValues\) =>/);
    assert.match(folderEditorSharedJs, /const parseOptionalThresholdInput = \(value\) =>/);
    assert.match(folderEditorSharedJs, /const extractPreviewRowLimitValue = typeof deps\.extractPreviewRowLimitValue === 'function'/);
    assert.match(folderEditorSharedJs, /const normalizePreviewRowLimit = typeof deps\.normalizePreviewRowLimit === 'function'/);
    assert.match(folderEditorSharedJs, /const normalizeFolderRecordForEditor = \(folder\) =>/);
    assert.match(folderEditorSharedJs, /const createResetHelpers = \(deps = \{\}\) =>/);
    assert.match(folderEditorSharedJs, /const resetPreviewBorderDefaults = \(\) =>/);
    assert.match(folderEditorSharedJs, /const resetDropdownColorDefaults = \(\) =>/);
    assert.match(folderEditorSharedJs, /window\.FolderViewPlusFolderEditorShared = Object\.freeze\(\{/);
});

test('shared folder editor schema and preview modules publish the editor-facing contracts', () => {
    assert.match(folderEditorSchemaJs, /^\/\/ @ts-check/m);
    assert.match(folderEditorSchemaJs, /\(function fvplusFolderEditorSchemaScope\(window\) \{/);
    assert.match(folderEditorSchemaJs, /const createModernSchema = \(deps = \{\}\) =>/);
    assert.match(folderEditorSchemaJs, /window\.FolderViewPlusFolderEditorSchema = Object\.freeze\(\{/);
    assert.match(folderEditorSchemaJs, /window\.FolderViewPlusFolderEditorSchemaModuleLoaded = true/);
    assert.match(folderEditorPreviewJs, /^\/\/ @ts-check/m);
    assert.match(folderEditorPreviewJs, /\(function fvplusFolderEditorPreviewScope\(window\) \{/);
    assert.match(folderEditorPreviewJs, /const createApi = \(deps = \{\}\) =>/);
    assert.match(folderEditorPreviewJs, /const renderLivePreviewCanvas = \(\) =>/);
    assert.match(folderEditorPreviewJs, /const updateLiveSummary = \(\) =>/);
    assert.match(folderEditorPreviewJs, /window\.FolderViewPlusFolderEditorPreview = Object\.freeze\(\{/);
    assert.match(folderEditorPreviewJs, /window\.FolderViewPlusFolderEditorPreviewModuleLoaded = true/);
});

test('runtime pages and folder editor load the shared contract before their consumers', () => {
    const dockerThemeResolverIndex = dockerPage.indexOf('/plugins/folderview.plus/scripts/folderviewplus.theme-resolver.js');
    const dockerContractIndex = dockerPage.indexOf('/plugins/folderview.plus/scripts/folderviewplus.folder-contract.js');
    const dockerSharedRuntimeIndex = dockerPage.indexOf('/plugins/folderview.plus/scripts/docker.runtime.shared.js');
    const dockerRuntimeIndex = dockerPage.indexOf('/plugins/folderview.plus/scripts/docker.js');
    const dockerSharedCssIndex = dockerPage.indexOf('/plugins/folderview.plus/styles/runtime.shared.css');
    const dockerTypeCssIndex = dockerPage.indexOf('/plugins/folderview.plus/styles/docker.css');
    const vmThemeResolverIndex = vmPage.indexOf('/plugins/folderview.plus/scripts/folderviewplus.theme-resolver.js');
    const vmContractIndex = vmPage.indexOf('/plugins/folderview.plus/scripts/folderviewplus.folder-contract.js');
    const vmSharedRuntimeIndex = vmPage.indexOf('/plugins/folderview.plus/scripts/docker.runtime.shared.js');
    const vmRuntimeIndex = vmPage.indexOf('/plugins/folderview.plus/scripts/vm.js');
    const vmSharedCssIndex = vmPage.indexOf('/plugins/folderview.plus/styles/runtime.shared.css');
    const vmTypeCssIndex = vmPage.indexOf('/plugins/folderview.plus/styles/vm.css');
    const folderThemeResolverIndex = folderPage.indexOf('/plugins/folderview.plus/scripts/folderviewplus.theme-resolver.js');
    const folderContractIndex = folderPage.indexOf('/plugins/folderview.plus/scripts/folderviewplus.folder-contract.js');
    const folderSharedEditorIndex = folderPage.indexOf('/plugins/folderview.plus/scripts/folder.editor.shared.js');
    const folderSchemaIndex = folderPage.indexOf('/plugins/folderview.plus/scripts/folder.editor.schema.js');
    const folderPreviewIndex = folderPage.indexOf('/plugins/folderview.plus/scripts/folder.editor.preview.js');
    const folderHierarchyIndex = folderPage.indexOf('/plugins/folderview.plus/scripts/folder.editor.hierarchy.js');
    const folderParentPickerIndex = folderPage.indexOf('/plugins/folderview.plus/scripts/folder.editor.parent-picker.js');
    const folderModernIndex = folderPage.indexOf('/plugins/folderview.plus/scripts/folder.js');
    const folderChromeIndex = folderPage.indexOf('/plugins/folderview.plus/scripts/folder.editor.chrome.js');
    const folderBootLoaderIndex = folderPage.indexOf('const scriptQueue = [');

    assert.ok(dockerThemeResolverIndex >= 0, 'docker page missing shared theme resolver include');
    assert.ok(dockerContractIndex >= 0, 'docker page missing shared folder contract include');
    assert.ok(dockerSharedRuntimeIndex >= 0, 'docker page missing shared runtime include');
    assert.ok(dockerRuntimeIndex >= 0, 'docker page missing docker runtime include');
    assert.ok(dockerThemeResolverIndex < dockerSharedRuntimeIndex, 'theme resolver must load before docker.runtime.shared.js');
    assert.ok(dockerThemeResolverIndex < dockerRuntimeIndex, 'theme resolver must load before docker.js');
    assert.ok(dockerContractIndex < dockerSharedRuntimeIndex, 'shared contract must load before docker.runtime.shared.js');
    assert.ok(dockerContractIndex < dockerRuntimeIndex, 'shared contract must load before docker.js');
    assert.ok(dockerSharedCssIndex >= 0, 'docker page missing shared runtime stylesheet');
    assert.ok(dockerTypeCssIndex >= 0, 'docker page missing docker stylesheet');
    assert.ok(dockerSharedCssIndex < dockerTypeCssIndex, 'shared runtime stylesheet must load before docker.css');

    assert.ok(vmThemeResolverIndex >= 0, 'vm page missing shared theme resolver include');
    assert.ok(vmContractIndex >= 0, 'vm page missing shared folder contract include');
    assert.ok(vmSharedRuntimeIndex >= 0, 'vm page missing shared runtime include');
    assert.ok(vmRuntimeIndex >= 0, 'vm page missing vm runtime include');
    assert.ok(vmThemeResolverIndex < vmSharedRuntimeIndex, 'theme resolver must load before shared runtime on VMs page');
    assert.ok(vmThemeResolverIndex < vmRuntimeIndex, 'theme resolver must load before vm.js');
    assert.ok(vmContractIndex < vmSharedRuntimeIndex, 'shared contract must load before shared runtime on VMs page');
    assert.ok(vmContractIndex < vmRuntimeIndex, 'shared contract must load before vm.js');
    assert.ok(vmSharedCssIndex >= 0, 'vm page missing shared runtime stylesheet');
    assert.ok(vmTypeCssIndex >= 0, 'vm page missing vm stylesheet');
    assert.ok(vmSharedCssIndex < vmTypeCssIndex, 'shared runtime stylesheet must load before vm.css');

    assert.ok(folderThemeResolverIndex >= 0, 'folder editor page missing shared theme resolver include');
    assert.ok(folderContractIndex >= 0, 'folder editor page missing shared folder contract include');
    assert.ok(folderSharedEditorIndex >= 0, 'folder editor page missing shared editor include');
    assert.ok(folderSchemaIndex >= 0, 'folder editor page missing shared schema include');
    assert.ok(folderPreviewIndex >= 0, 'folder editor page missing shared preview include');
    assert.ok(folderBootLoaderIndex >= 0, 'folder editor page missing runtime boot loader');
    assert.ok(folderHierarchyIndex >= 0, 'folder editor page missing hierarchy module include');
    assert.ok(folderParentPickerIndex >= 0, 'folder editor page missing parent picker module include');
    assert.ok(folderModernIndex >= 0, 'folder editor page missing modern runtime include');
    assert.ok(folderChromeIndex >= 0, 'folder editor page missing chrome runtime include');
    assert.ok(folderThemeResolverIndex < folderSharedEditorIndex, 'theme resolver must load before folder.editor.shared.js');
    assert.ok(folderContractIndex < folderSharedEditorIndex, 'shared contract must load before folder.editor.shared.js');
    assert.ok(folderSharedEditorIndex < folderSchemaIndex, 'shared editor module must load before folder.editor.schema.js');
    assert.ok(folderSchemaIndex < folderPreviewIndex, 'shared schema must load before folder.editor.preview.js');
    assert.ok(folderHierarchyIndex < folderParentPickerIndex, 'hierarchy module must load before folder.editor.parent-picker.js');
    assert.ok(folderParentPickerIndex < folderModernIndex, 'parent picker module must load before folder.js');
    assert.ok(folderPage.includes("'/plugins/folderview.plus/scripts/icon-picker.runtime.js'"), 'folder editor page missing boot-loaded icon picker runtime');
    assert.ok(folderPage.includes("'/plugins/folderview.plus/scripts/folder.editor.hierarchy.js'"), 'folder editor page missing boot-loaded hierarchy runtime');
    assert.ok(folderPage.includes("'/plugins/folderview.plus/scripts/folder.editor.parent-picker.js'"), 'folder editor page missing boot-loaded parent picker runtime');
    assert.ok(folderPage.includes("'/plugins/folderview.plus/scripts/folder.editor.chrome.js'"), 'folder editor page missing boot-loaded chrome runtime');
    assert.ok(folderPage.includes("'/plugins/folderview.plus/scripts/folder.js'"), 'folder editor page missing boot-loaded modern runtime');
    assert.ok(!folderPage.includes("'/plugins/folderview.plus/scripts/folder.legacy.js'"), 'folder editor page should not boot-load the retired legacy runtime');
});

test('shared runtime stylesheet owns the common dropdown and preview geometry contract', () => {
    assert.match(runtimeSharedCss, /\.folder-dropdown\s*\{[\s\S]*margin:\s*0 var\(--fvplus-folder-dropdown-right-margin,\s*16px\) 0 auto/);
    assert.match(runtimeSharedCss, /\.folder-dropdown > i\s*\{[\s\S]*font-size:\s*var\(--fvplus-folder-dropdown-icon-size,\s*12px\) !important/);
    assert.match(runtimeSharedCss, /\.folder-dropdown:hover,\s*[\s\S]*visibility:\s*visible !important/);
    assert.match(runtimeSharedCss, /\.folder-dropdown:hover > i,\s*[\s\S]*opacity:\s*1 !important/);
    assert.match(runtimeSharedCss, /\.folder-preview\s*\{[\s\S]*align-items:\s*center;[\s\S]*align-content:\s*flex-start;/);
    assert.match(runtimeSharedCss, /\.folder-preview-wrapper\s*\{[\s\S]*margin-top:\s*var\(--fvplus-preview-wrapper-margin-top,\s*6px\)/);
    assert.match(runtimeSharedCss, /\.folder-preview-wrapper > span\.outer\s*\{[\s\S]*display:\s*inline-flex;[\s\S]*align-items:\s*center;/);
});
