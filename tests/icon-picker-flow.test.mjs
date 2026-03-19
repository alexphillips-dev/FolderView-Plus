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
const folderPagePath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/Folder.page'
);
const folderScript = fs.readFileSync(folderScriptPath, 'utf8');
const folderPage = fs.readFileSync(folderPagePath, 'utf8');

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

test('folder.js integration keeps using shared icon picker runtime helpers', () => {
    assert.match(folderScript, /window\.FolderViewIconPickerRuntime/);
    assert.match(folderScript, /iconPickerRuntime\.paginateItems/);
    assert.match(folderScript, /iconPickerRuntime\.filterIconsByQuery/);
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
    assert.match(folderPage, /id="fv-third-party-view"/);
    assert.match(folderPage, /id="fv-third-party-sort"/);
    assert.match(folderPage, /id="fv-third-party-pack-search"/);
    assert.match(folderPage, /id="fv-third-party-pack-kind"/);
    assert.match(folderPage, /id="fv-third-party-pack-select"/);
    assert.match(folderPage, /id="fv-third-party-pack-menu-toggle"/);
    assert.match(folderPage, /id="fv-third-party-filter-toggle"/);
    assert.match(folderPage, /id="fv-third-party-filter-sheet"/);
    assert.match(folderPage, /id="fv-third-party-tag-search"/);
    assert.match(folderPage, /id="fv-third-party-tag-filters"/);
    assert.match(folderPage, /id="fv-third-party-show-hidden"/);
    assert.match(folderPage, /id="fv-third-party-duplicates-cleanup"/);
    assert.match(folderPage, /id="fv-third-party-context-line"/);
    assert.match(folderPage, /id="fv-third-party-preview"/);
});

test('folder.js third-party icon picker supports advanced filtering and duplicate workflows', () => {
    assert.match(folderScript, /const THIRD_PARTY_GRID_CHUNK_SIZE = \d+;/);
    assert.match(folderScript, /const THIRD_PARTY_MIN_TAG_COUNT = \d+;/);
    assert.match(folderScript, /const loadThirdPartyIconIndex = async \(\) =>/);
    assert.match(folderScript, /const buildThirdPartyDuplicateCleanupScript = \(\) =>/);
    assert.match(folderScript, /const renderThirdPartyTagFilters = \(icons\) =>/);
    assert.match(folderScript, /const renderThirdPartyPreview = \(icon = null\) =>/);
    assert.match(folderScript, /const getThirdPartyFolderKind = \(folderName\) =>/);
    assert.match(folderScript, /THIRD_PARTY_ICON_SEARCH_DEBOUNCE_MS/);
    assert.match(folderPage, /value="duplicates"/);
    assert.match(folderScript, /#fv-third-party-duplicates-cleanup/);
    assert.match(folderScript, /#fv-third-party-pack-select/);
    assert.match(folderScript, /#fv-third-party-pack-menu-toggle/);
    assert.match(folderScript, /#fv-third-party-filter-toggle/);
    assert.match(folderScript, /list_index/);
    assert.match(folderScript, /pointerdown\.fvthirdparty/);
});

test('folder.js icon upload parsing is resilient to empty and noisy endpoint responses', () => {
    assert.match(folderScript, /const parseJsonPayload = \(value, context = 'response'\) =>/);
    assert.match(folderScript, /returned an empty response/);
    assert.match(folderScript, /const ICON_UPLOAD_ENDPOINT_CONTEXT = 'icon upload endpoint';/);
    assert.match(folderScript, /const CUSTOM_ICON_MANAGER_CONTEXT = 'custom icon manager';/);
    assert.match(folderScript, /const start = normalized\.indexOf\('\{'\)/);
    assert.match(folderScript, /const end = normalized\.lastIndexOf\('\}'\)/);
    assert.match(folderScript, /const extractAjaxErrorMessage = \(error, context = 'request'\) =>/);
    assert.match(folderScript, /dataType:\s*'text'/);
    assert.match(folderScript, /parseJsonPayload\(response, ICON_UPLOAD_ENDPOINT_CONTEXT\)/);
    assert.match(folderScript, /extractAjaxErrorMessage\(error, ICON_UPLOAD_ENDPOINT_CONTEXT\)/);
    assert.match(folderScript, /const readFileAsDataUrl = \(file\) => new Promise/);
    assert.match(folderScript, /const shouldUseInlineUploadFallback = \(error\) =>/);
    assert.match(folderScript, /const uploadCustomIconFileInline = async \(file, token, options = \{\}\) =>/);
    assert.match(folderScript, /icon_inline_name/);
    assert.match(folderScript, /icon_inline_data/);
    assert.match(folderScript, /contentType:\s*'application\/x-www-form-urlencoded; charset=UTF-8'/);
    assert.match(folderScript, /shouldUseInlineUploadFallback\(primaryError\)/);
    assert.match(folderScript, /replace:\s*options\?\.replace \? '1' : '0'/);
    assert.match(folderScript, /dedupe:\s*options\?\.dedupe === false \? '0' : '1'/);
    assert.match(folderScript, /const validateCustomIconFileBeforeUpload = \(file\) =>/);
    assert.match(folderScript, /customIconUploadRequest\.abort\(/);
    assert.match(folderScript, /const setCustomIconPickerOpen = \(open\) =>/);
    assert.match(folderScript, /const refreshCustomIconManager = async \(\) =>/);
    assert.match(folderScript, /CUSTOM_ICON_PAGE_SIZE/);
    assert.match(folderScript, /data-action=\"refs\"/);
    assert.match(folderScript, /requestCustomIconApi\('usage'/);
    assert.match(folderScript, /requestCustomIconApi\('rename'/);
    assert.match(folderScript, /requestCustomIconApi\('delete'/);
});
