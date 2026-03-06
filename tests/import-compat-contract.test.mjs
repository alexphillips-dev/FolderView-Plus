import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const utils = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils.js');

const repoRoot = path.resolve(process.cwd());
const fixturesDir = path.join(repoRoot, 'tests/fixtures/imports');

const loadFixture = (filename) => {
    const raw = fs.readFileSync(path.join(fixturesDir, filename), 'utf8');
    return JSON.parse(raw);
};

test('compat: parses legacy folder.view3 full export payload', () => {
    const payload = loadFixture('folder-view3-full-export.json');
    const parsed = utils.parseImportPayload(payload, 'docker');

    assert.equal(parsed.ok, true);
    assert.equal(parsed.legacy, true);
    assert.equal(parsed.mode, 'full');
    assert.deepEqual(Object.keys(parsed.folders), ['S9deYJyJjG5Ou7cxF1XIr', 'R9eTAjGfUJyUPIV6b7H5']);
});

test('compat: parses legacy folder.view2 single export payload', () => {
    const payload = loadFixture('folder-view2-single-export.json');
    const parsed = utils.parseImportPayload(payload, 'docker');

    assert.equal(parsed.ok, true);
    assert.equal(parsed.legacy, true);
    assert.equal(parsed.mode, 'single');
    assert.equal(parsed.folder?.name, 'Legacy Cloud');
    assert.equal(parsed.folderId, null);
});

test('compat: parses current schema full export payload', () => {
    const payload = loadFixture('folderview-plus-schema1-full.json');
    const parsed = utils.parseImportPayload(payload, 'docker');

    assert.equal(parsed.ok, true);
    assert.equal(parsed.legacy, false);
    assert.equal(parsed.mode, 'full');
    assert.equal(parsed.schemaVersion, 1);
    assert.deepEqual(Object.keys(parsed.folders), ['CloudFolderId']);
});

test('compat: merge/replace operation contracts remain stable for legacy full payload', () => {
    const payload = loadFixture('folder-view3-full-export.json');
    const parsed = utils.parseImportPayload(payload, 'docker');
    const existing = {
        S9deYJyJjG5Ou7cxF1XIr: {
            name: 'Audiobooks',
            icon: '/old.png',
            regex: '',
            containers: ['audiobookshelf'],
            settings: { preview: 0 },
            actions: []
        },
        LegacyOnly: {
            name: 'LegacyOnly',
            icon: '/legacy.png',
            regex: '',
            containers: [],
            settings: { preview: 0 },
            actions: []
        }
    };

    const mergeSummary = utils.summarizeImport(existing, parsed, 'merge');
    assert.equal(mergeSummary.creates.length, 1);
    assert.equal(mergeSummary.updates.length, 1);
    assert.equal(mergeSummary.deletes.length, 0);

    const replaceSummary = utils.summarizeImport(existing, parsed, 'replace');
    assert.equal(replaceSummary.creates.length, 1);
    assert.equal(replaceSummary.updates.length, 1);
    assert.equal(replaceSummary.deletes.length, 1);
});

test('compat: docker label fallback still supports folder.view3 and folder.view2 keys', () => {
    assert.equal(
        utils.getFolderLabelValue({
            'folder.view3': 'Media'
        }),
        'Media'
    );
    assert.equal(
        utils.getFolderLabelValue({
            'folder.view2': 'Utilities'
        }),
        'Utilities'
    );
    assert.equal(
        utils.getFolderLabelValue({
            'folder.view': 'Legacy'
        }),
        'Legacy'
    );
});
