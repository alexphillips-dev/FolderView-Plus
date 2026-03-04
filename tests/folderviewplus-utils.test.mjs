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

test('getFolderStatusColors normalizes and defaults values', () => {
    const defaults = utils.getFolderStatusColors({});
    assert.deepEqual(defaults, {
        started: '#ffffff',
        paused: '#b8860b',
        stopped: '#ff4d4d'
    });

    const custom = utils.getFolderStatusColors({
        status_color_started: '#AbC',
        status_color_paused: '#123456',
        status_color_stopped: 'bad-value'
    });
    assert.deepEqual(custom, {
        started: '#aabbcc',
        paused: '#123456',
        stopped: '#ff4d4d'
    });
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

test('getAutoRuleDecision supports exclude precedence and advanced docker kinds', () => {
    const rules = [
        {
            id: 'inc1',
            enabled: true,
            folderId: 'apps',
            kind: 'image_regex',
            effect: 'include',
            pattern: 'linuxserver/'
        },
        {
            id: 'exc1',
            enabled: true,
            folderId: 'apps',
            kind: 'label_contains',
            effect: 'exclude',
            labelKey: 'com.example.stack',
            labelValue: 'private'
        }
    ];
    const info = {
        sonarr: {
            info: {
                Config: {
                    Image: 'linuxserver/sonarr',
                    Labels: {
                        'com.example.stack': 'media-private'
                    }
                }
            }
        }
    };

    const decision = utils.getAutoRuleDecision({
        rules,
        name: 'sonarr',
        infoByName: info,
        type: 'docker'
    });

    assert.equal(decision.assignedRule, null);
    assert.equal(decision.blockedBy?.id, 'exc1');
});

test('normalizePrefs includes live refresh, performance mode, and backup schedule defaults', () => {
    const prefs = utils.normalizePrefs({});
    assert.equal(prefs.liveRefreshEnabled, true);
    assert.equal(prefs.liveRefreshSeconds, 20);
    assert.equal(prefs.performanceMode, false);
    assert.equal(prefs.lazyPreviewEnabled, true);
    assert.equal(prefs.lazyPreviewThreshold, 30);
    assert.deepEqual(prefs.backupSchedule, {
        enabled: false,
        intervalHours: 24,
        retention: 25,
        lastRunAt: ''
    });
});

test('buildImportDiffRows reports row-level changed fields', () => {
    const existing = {
        apps: {
            name: 'Apps',
            icon: '/old.png',
            regex: '^a',
            settings: { preview: 1 },
            actions: [{ name: 'Start' }],
            containers: ['a', 'b']
        }
    };
    const parsed = {
        mode: 'full',
        folders: {
            apps: {
                name: 'Apps',
                icon: '/new.png',
                regex: '^a',
                settings: { preview: 2 },
                actions: [{ name: 'Start all' }],
                containers: ['a']
            }
        }
    };

    const rows = utils.buildImportDiffRows(existing, parsed, 'merge');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].action, 'update');
    assert.deepEqual(rows[0].fields.sort(), ['actions', 'icon', 'members', 'settings']);
});

test('export/import roundtrip smoke works for full payload', () => {
    const original = {
        abc: { name: 'One', containers: ['x'] },
        def: { name: 'Two', containers: [] }
    };
    const exported = utils.buildFullExportPayload({
        type: 'docker',
        folders: original,
        pluginVersion: '9.9.9'
    });
    const parsed = utils.parseImportPayload(exported, 'docker');
    assert.equal(parsed.ok, true);
    assert.equal(parsed.mode, 'full');
    assert.deepEqual(parsed.folders, original);

    const ops = utils.buildImportOperations({}, parsed, 'merge');
    assert.equal(ops.upserts.length, 2);
    assert.equal(ops.creates.length, 0);
    assert.equal(ops.deletes.length, 0);
});

test('getConflictReport detects multi-folder assignment conflicts', () => {
    const report = utils.getConflictReport({
        type: 'docker',
        folders: {
            a: { name: 'Media', containers: ['plex'], regex: '^son' },
            b: { name: 'Other', containers: ['plex'], regex: '' }
        },
        prefs: {
            autoRules: [
                {
                    id: 'r1',
                    enabled: true,
                    folderId: 'a',
                    kind: 'name_regex',
                    effect: 'include',
                    pattern: '^plex$'
                }
            ]
        },
        infoByName: {
            plex: { Labels: {} },
            sonarr: { Labels: {} }
        }
    });

    assert.equal(report.totalItems, 2);
    assert.equal(report.conflictingItems, 1);
    const plex = report.rows.find((row) => row.item === 'plex');
    assert.equal(plex.hasConflict, true);
    assert.equal(plex.matchedFolderCount, 2);
});
