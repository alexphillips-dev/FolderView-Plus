import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const runtime = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/icon-picker.runtime.js');

const repoRoot = path.resolve(process.cwd());
const folderScriptPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js'
);
const folderIconApiScriptPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.icon-api.js'
);
const folderEditorIconsScriptPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.icons.js'
);
const folderPagePath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/Folder.page'
);
const folderCssPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/folder.css'
);
const folderScript = fs.readFileSync(folderScriptPath, 'utf8');
const folderIconApiScript = fs.readFileSync(folderIconApiScriptPath, 'utf8');
const folderEditorIconsScript = fs.readFileSync(folderEditorIconsScriptPath, 'utf8');
const folderPage = fs.readFileSync(folderPagePath, 'utf8');
const folderCss = fs.readFileSync(folderCssPath, 'utf8');

function getCssRuleBlock(css, selector) {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
    assert.ok(match, `Expected CSS block for ${selector}`);
    return match[1];
}

test('icon picker runtime: paginateItems clamps page and returns ranges', () => {
    const rows = Array.from({ length: 13 }, (_v, i) => ({ id: i + 1 }));
    const page = runtime.paginateItems(rows, 99, 5);
    assert.equal(page.page, 3);
    assert.equal(page.totalPages, 3);
    assert.equal(page.startIndex, 10);
    assert.equal(page.endIndex, 13);
    assert.deepEqual(page.items.map((row) => row.id), [11, 12, 13]);
});

test('icon picker runtime: createPickerFlow resets page on search and item replacement', () => {
    const flow = runtime.createPickerFlow(
        [
            { name: 'Plex', tags: ['media'] },
            { name: 'Sonarr', tags: ['media'] },
            { name: 'Gaming', tags: ['fun'] },
            { name: 'Database', tags: ['data'] }
        ],
        2
    );

    let view = flow.setPage(2);
    assert.equal(view.page, 2);

    view = flow.setQuery('media');
    assert.equal(view.page, 1);
    assert.equal(view.totalItems, 2);
    assert.deepEqual(view.items.map((icon) => icon.name), ['Plex', 'Sonarr']);

    view = flow.nextPage();
    assert.equal(view.page, 1); // single-page filtered result

    view = flow.replaceItems([{ name: 'Cloud', tags: ['backup'] }]);
    assert.equal(view.page, 1);
    assert.equal(view.totalItems, 0);

    view = flow.setQuery('');
    assert.equal(view.totalItems, 1);
    assert.deepEqual(view.items.map((icon) => icon.name), ['Cloud']);
});

test('icon picker runtime: filterIconsByQuery matches names and tags case-insensitively', () => {
    const icons = [
        { name: 'Home Automation', tags: ['smart-home'] },
        { name: 'Torrents', tags: ['Downloads'] },
        { name: 'Dash', tags: ['Monitor'] }
    ];
    const byName = runtime.filterIconsByQuery(icons, 'torrent');
    assert.deepEqual(byName.map((icon) => icon.name), ['Torrents']);

    const byTag = runtime.filterIconsByQuery(icons, 'SMART');
    assert.deepEqual(byTag.map((icon) => icon.name), ['Home Automation']);
});

test('folder editor runtime keeps using shared icon picker helpers in the shipped editor path', () => {
    assert.match(folderPage, /folder\.editor\.icon-api\.js/);
    assert.match(folderPage, /folder\.editor\.icons\.js/);
    assert.match(folderScript, /window\.FolderViewPlusFolderIconApi/);
    assert.match(folderScript, /folderIconApiModule\.createApi/);
    assert.match(folderScript, /const folderEditorIconsModule = window\.FolderViewPlusFolderEditorIcons \|\| null;/);
    assert.match(folderScript, /folderEditorIconsApi = folderEditorIconsModule\.createApi\(/);
    assert.match(folderScript, /getFolderEditorIconsApi\(\)\?\.renderBuiltInIconPicker\(\);/);
    assert.match(folderScript, /getFolderEditorIconsApi\(\)\?\.bindIconPickerEvents\(\);/);
    assert.match(folderEditorIconsScript, /root\.FolderViewPlusFolderEditorIcons = factory\(\);/);
    assert.match(folderEditorIconsScript, /root\.FolderViewPlusFolderEditorIconsModuleLoaded = true;/);
    assert.match(folderPage, /folder\.editor\.chrome\.js[\s\S]*folder\.js/);
    assert.doesNotMatch(folderPage, /folder\.legacy\.js/);
});

test('folder editor markup exposes custom icon manager controls', () => {
    assert.match(folderPage, /id="fv-icon-custom-manager-toggle"/);
    assert.match(folderPage, /id="fv-custom-icon-panel"/);
    assert.match(folderPage, /id="fv-custom-icon-search"/);
    assert.match(folderPage, /id="fv-custom-icon-list"/);
    assert.match(folderPage, /id="fv-custom-icon-prev"/);
    assert.match(folderPage, /id="fv-custom-icon-next"/);
    assert.match(folderPage, /id="fv-custom-icon-page-label"/);
    assert.match(folderPage, /id="fv-icon-upload-replace"/);
    assert.match(folderPage, /id="fv-icon-upload-dedupe"/);
    assert.match(folderPage, /id="fv-icon-upload-progress"/);
    assert.match(folderPage, /id="fv-icon-upload-cancel"/);
});

test('folder editor markup exposes advanced third-party icon controls', () => {
    assert.match(folderPage, /id="fv-third-party-search"/);
    assert.match(folderPage, /id="fv-third-party-search-clear"/);
    assert.match(folderPage, /id="fv-third-party-mode-basic"/);
    assert.match(folderPage, /id="fv-third-party-mode-advanced"/);
    assert.match(folderPage, /id="fv-third-party-view"/);
    assert.match(folderPage, /id="fv-third-party-sort"/);
    assert.match(folderPage, /id="fv-third-party-preset-recent"/);
    assert.match(folderPage, /id="fv-third-party-preset-favorites"/);
    assert.match(folderPage, /id="fv-third-party-preset-most-used"/);
    assert.match(folderPage, /id="fv-third-party-preset-folder-icons"/);
    assert.match(folderPage, /id="fv-third-party-pack-search"/);
    assert.match(folderPage, /id="fv-third-party-pack-kind"/);
    assert.match(folderPage, /id="fv-third-party-pack-select"/);
    assert.match(folderPage, /id="fv-third-party-pack-actions-toggle"/);
    assert.match(folderPage, /id="fv-third-party-pack-actions-panel"/);
    assert.match(folderPage, /id="fv-third-party-pack-pin-toggle"/);
    assert.match(folderPage, /id="fv-third-party-pack-hide-toggle"/);
    assert.match(folderPage, /id="fv-third-party-filter-toggle"/);
    assert.match(folderPage, /id="fv-third-party-filter-sheet"/);
    assert.match(folderPage, /id="fv-third-party-filter-clear-all"/);
    assert.match(folderPage, /id="fv-third-party-tag-search"/);
    assert.match(folderPage, /id="fv-third-party-tag-filters"/);
    assert.match(folderPage, /id="fv-third-party-show-hidden"/);
    assert.match(folderPage, /id="fv-third-party-duplicates-cleanup"/);
    assert.match(folderPage, /id="fv-third-party-context-line"/);
    assert.match(folderPage, /id="fv-third-party-preview"/);
});

test('folder editor icon module supports advanced filtering and duplicate workflows', () => {
    assert.match(folderScript, /const THIRD_PARTY_GRID_CHUNK_SIZE = \d+;/);
    assert.match(folderScript, /const THIRD_PARTY_MIN_TAG_COUNT = \d+;/);
    assert.match(folderEditorIconsScript, /const loadThirdPartyIconIndex = async \(\) =>/);
    assert.match(folderEditorIconsScript, /const buildThirdPartyDuplicateCleanupScript = \(\) =>/);
    assert.match(folderEditorIconsScript, /const renderThirdPartyTagFilters = \(icons\) =>/);
    assert.match(folderEditorIconsScript, /const renderThirdPartyPreview = \(icon = null\) =>/);
    assert.match(folderEditorIconsScript, /const getThirdPartyFolderKind = \(folderName\) =>/);
    assert.match(folderEditorIconsScript, /const setThirdPartyAdvancedMode = \(open\) =>/);
    assert.match(folderEditorIconsScript, /const getThirdPartyActiveFilterCount = \(\) =>/);
    assert.match(folderEditorIconsScript, /thirdPartyIconSearchDebounceMs/);
    assert.match(folderPage, /value="duplicates"/);
    assert.match(folderEditorIconsScript, /#fv-third-party-duplicates-cleanup/);
    assert.match(folderEditorIconsScript, /#fv-third-party-pack-select/);
    assert.match(folderEditorIconsScript, /#fv-third-party-pack-pin-toggle/);
    assert.match(folderEditorIconsScript, /#fv-third-party-pack-hide-toggle/);
    assert.match(folderEditorIconsScript, /#fv-third-party-pack-actions-toggle/);
    assert.match(folderEditorIconsScript, /#fv-third-party-filter-toggle/);
    assert.match(folderEditorIconsScript, /#fv-third-party-filter-clear-all/);
    assert.match(folderEditorIconsScript, /list_index/);
    assert.match(folderEditorIconsScript, /pointerdown\.fvthirdparty/);
});

test('folder editor icon picker uses theme-aware surfaces and borderless favorite toggles', () => {
    const previewActionBlock = getCssRuleBlock(folderCss, '.fv-third-party-preview-action');
    const iconFavBlock = getCssRuleBlock(folderCss, '.fv-third-party-icon-fav');

    assert.match(folderCss, /\.fv-icon-picker-panel\s*\{[\s\S]*background:\s*var\(--fv-editor-inset-surface\);/);
    assert.match(folderCss, /\.fv-icon-picker-item\s*\{[\s\S]*background:\s*var\(--fv-editor-control-surface\);/);
    assert.match(folderCss, /\.fv-third-party-section\s*\{[\s\S]*background:\s*var\(--fv-editor-inset-surface\);/);
    assert.match(folderCss, /\.fv-third-party-preview\s*\{[\s\S]*background:\s*var\(--fv-editor-inset-surface\);/);
    assert.match(folderCss, /\.fv-third-party-icon-item\s*\{[\s\S]*background:\s*var\(--fv-editor-control-surface\);/);
    assert.match(folderCss, /\.fv-custom-icon-row\s*\{[\s\S]*background:\s*var\(--fv-editor-control-surface\);/);
    assert.match(previewActionBlock, /border:\s*0 !important;/);
    assert.match(previewActionBlock, /background:\s*transparent !important;/);
    assert.match(previewActionBlock, /color:\s*var\(--fv-editor-dim\) !important;/);
    assert.match(iconFavBlock, /border:\s*0 !important;/);
    assert.match(iconFavBlock, /background:\s*transparent !important;/);
    assert.match(iconFavBlock, /opacity:\s*0\.72;/);
    assert.match(iconFavBlock, /pointer-events:\s*auto;/);
    assert.doesNotMatch(iconFavBlock, /border:\s*1px solid var\(--fv-editor-block-border\)/);
    assert.match(folderCss, /\.fv-third-party-preview-action:hover,[\s\S]*\.fv-third-party-icon-fav\.is-active \{[\s\S]*color:\s*var\(--fv-editor-accent\) !important;[\s\S]*opacity:\s*1;/);
});

test('folder.js icon upload parsing is resilient to empty and noisy endpoint responses', () => {
    assert.match(folderIconApiScript, /const parseJsonPayload = \(value, context = 'response'\) =>/);
    assert.match(folderScript, /returned an empty response/);
    assert.match(folderScript, /const ICON_UPLOAD_ENDPOINT_CONTEXT = 'icon upload endpoint';/);
    assert.match(folderScript, /const CUSTOM_ICON_MANAGER_CONTEXT = 'custom icon manager';/);
    assert.match(folderIconApiScript, /const start = normalized\.indexOf\('\{'\)/);
    assert.match(folderIconApiScript, /const end = normalized\.lastIndexOf\('\}'\)/);
    assert.match(folderIconApiScript, /const extractAjaxErrorMessage = \(error, context = 'request'\) =>/);
    assert.match(folderIconApiScript, /dataType:\s*'text'/);
    assert.match(folderIconApiScript, /parseJsonPayload\(response, uploadContext\)/);
    assert.match(folderIconApiScript, /extractAjaxErrorMessage\(error, uploadContext\)/);
    assert.match(folderIconApiScript, /const readFileAsDataUrl = \(file\) => new Promise/);
    assert.match(folderIconApiScript, /const shouldUseInlineUploadFallback = \(error\) =>/);
    assert.match(folderIconApiScript, /const uploadCustomIconFileInline = async \(file, token, options = \{\}\) =>/);
    assert.match(folderIconApiScript, /icon_inline_name/);
    assert.match(folderIconApiScript, /icon_inline_data/);
    assert.match(folderIconApiScript, /contentType:\s*'application\/x-www-form-urlencoded; charset=UTF-8'/);
    assert.match(folderIconApiScript, /shouldUseInlineUploadFallback\(primaryError\)/);
    assert.match(folderIconApiScript, /replace:\s*options\?\.replace \? '1' : '0'/);
    assert.match(folderIconApiScript, /dedupe:\s*options\?\.dedupe === false \? '0' : '1'/);
    assert.match(folderIconApiScript, /const validateCustomIconFileBeforeUpload = \(file\) =>/);
    assert.match(folderEditorIconsScript, /customIconUploadRequest\.abort\(/);
    assert.match(folderEditorIconsScript, /const setCustomIconPickerOpen = \(open\) =>/);
    assert.match(folderEditorIconsScript, /const refreshCustomIconManager = async \(\) =>/);
    assert.match(folderScript, /CUSTOM_ICON_PAGE_SIZE/);
    assert.match(folderEditorIconsScript, /data-action=\"refs\"/);
    assert.match(folderEditorIconsScript, /requestCustomIconApi\('usage'/);
    assert.match(folderEditorIconsScript, /requestCustomIconApi\('rename'/);
    assert.match(folderEditorIconsScript, /requestCustomIconApi\('delete'/);
});
