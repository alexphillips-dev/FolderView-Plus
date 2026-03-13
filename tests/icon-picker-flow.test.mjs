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
const folderScript = fs.readFileSync(folderScriptPath, 'utf8');

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

test('folder.js icon upload parsing is resilient to empty and noisy endpoint responses', () => {
    assert.match(folderScript, /const parseJsonPayload = \(value, context = 'response'\) =>/);
    assert.match(folderScript, /returned an empty response/);
    assert.match(folderScript, /const start = normalized\.indexOf\('\{'\)/);
    assert.match(folderScript, /const end = normalized\.lastIndexOf\('\}'\)/);
    assert.match(folderScript, /const extractAjaxErrorMessage = \(error, context = 'request'\) =>/);
    assert.match(folderScript, /dataType:\s*'text'/);
    assert.match(folderScript, /parseJsonPayload\(response, 'icon upload endpoint'\)/);
    assert.match(folderScript, /extractAjaxErrorMessage\(error, 'icon upload endpoint'\)/);
    assert.match(folderScript, /const readFileAsDataUrl = \(file\) => new Promise/);
    assert.match(folderScript, /const shouldUseInlineUploadFallback = \(error\) =>/);
    assert.match(folderScript, /const uploadCustomIconFileInline = async \(file, token\) =>/);
    assert.match(folderScript, /icon_inline_name/);
    assert.match(folderScript, /icon_inline_data/);
    assert.match(folderScript, /contentType:\s*'application\/x-www-form-urlencoded; charset=UTF-8'/);
    assert.match(folderScript, /shouldUseInlineUploadFallback\(primaryError\)/);
});
