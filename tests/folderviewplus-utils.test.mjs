import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const utils = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils.js');

test('buildFullExportPayload includes schema metadata and folders', () => {
    const payload = utils.buildFullExportPayload({
        type: 'docker',
        pluginVersion: '1.2.3',
        folders: {
            aaa: { name: 'Apps', containers: [] }
        }
    });

    assert.equal(payload.schemaVersion, utils.EXPORT_SCHEMA_VERSION);
    assert.equal(payload.pluginVersion, '1.2.3');
    assert.equal(payload.type, 'docker');
    assert.equal(payload.mode, 'full');
    assert.deepEqual(Object.keys(payload.folders), ['aaa']);
});

test('parseImportPayload accepts legacy full export', () => {
    const parsed = utils.parseImportPayload({
        one: { name: 'One', containers: [] },
        two: { name: 'Two', containers: [] }
    }, 'docker');

    assert.equal(parsed.ok, true);
    assert.equal(parsed.legacy, true);
    assert.equal(parsed.mode, 'full');
    assert.deepEqual(Object.keys(parsed.folders), ['one', 'two']);
});

test('parseImportPayload rejects higher schema version', () => {
    const parsed = utils.parseImportPayload({
        schemaVersion: utils.EXPORT_SCHEMA_VERSION + 1,
        type: 'docker',
        mode: 'full',
        folders: {}
    }, 'docker');

    assert.equal(parsed.ok, false);
    assert.match(parsed.error, /Unsupported schema version/i);
});

test('summarizeImport reports creates updates and deletes for replace mode', () => {
    const existing = {
        a: { name: 'A', containers: ['x'] },
        b: { name: 'B', containers: ['y'] }
    };
    const parsed = {
        mode: 'full',
        folders: {
            a: { name: 'A', containers: ['x', 'z'] },
            c: { name: 'C', containers: [] }
        }
    };

    const summary = utils.summarizeImport(existing, parsed, 'replace');
    assert.equal(summary.creates.length, 1);
    assert.equal(summary.updates.length, 1);
    assert.equal(summary.deletes.length, 1);
});

test('buildImportOperations respects skip mode', () => {
    const existing = {
        keep: { name: 'Keep', containers: [] }
    };
    const parsed = {
        mode: 'full',
        folders: {
            keep: { name: 'Keep', containers: ['x'] },
            newone: { name: 'New', containers: [] }
        }
    };
    const ops = utils.buildImportOperations(existing, parsed, 'skip');
    assert.equal(ops.upserts.length, 1);
    assert.equal(ops.upserts[0].id, 'newone');
    assert.equal(ops.deletes.length, 0);
});

test('orderFoldersByPrefs supports manual and alpha sort modes', () => {
    const folders = {
        z: { name: 'Zulu' },
        a: { name: 'Alpha' },
        b: { name: 'Beta' }
    };

    const manual = utils.orderFoldersByPrefs(folders, {
        sortMode: 'manual',
        manualOrder: ['b', 'z']
    });
    assert.deepEqual(Object.keys(manual), ['b', 'z', 'a']);

    const alpha = utils.orderFoldersByPrefs(folders, { sortMode: 'alpha' });
    assert.deepEqual(Object.keys(alpha), ['a', 'b', 'z']);
});

test('getAutoRuleMatches supports docker label and regex rules', () => {
    const names = ['plex', 'qbittorrent', 'homeassistant'];
    const rules = [
        {
            id: 'r1',
            enabled: true,
            folderId: 'folder1',
            kind: 'name_regex',
            pattern: '^home'
        },
        {
            id: 'r2',
            enabled: true,
            folderId: 'folder1',
            kind: 'label',
            labelKey: 'com.example.group',
            labelValue: 'media'
        }
    ];
    const info = {
        plex: { Labels: { 'com.example.group': 'media' } },
        qbittorrent: { Labels: {} },
        homeassistant: { Labels: {} }
    };

    const matches = utils.getAutoRuleMatches({
        rules,
        folderId: 'folder1',
        names,
        infoByName: info,
        type: 'docker'
    });

    assert.deepEqual(matches.sort(), ['homeassistant', 'plex']);
});
