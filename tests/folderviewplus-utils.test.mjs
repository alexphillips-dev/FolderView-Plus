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
    assert.equal(parsed.trust?.level, 'legacy');
    assert.deepEqual(Object.keys(parsed.folders), ['one', 'two']);
});

test('parseImportPayload marks schema exports as trusted when metadata is complete', () => {
    const parsed = utils.parseImportPayload({
        schemaVersion: utils.EXPORT_SCHEMA_VERSION,
        pluginVersion: '2026.03.10.10',
        exportedAt: '2026-03-10T15:42:00.000Z',
        type: 'docker',
        mode: 'full',
        folders: {}
    }, 'docker');

    assert.equal(parsed.ok, true);
    assert.equal(parsed.legacy, false);
    assert.equal(parsed.trust?.level, 'trusted');
    assert.match(String(parsed.trust?.label || ''), /validated schema/i);
});

test('parseImportPayload marks schema exports as untrusted when metadata is incomplete', () => {
    const parsed = utils.parseImportPayload({
        schemaVersion: utils.EXPORT_SCHEMA_VERSION,
        type: 'docker',
        mode: 'full',
        folders: {}
    }, 'docker');

    assert.equal(parsed.ok, true);
    assert.equal(parsed.legacy, false);
    assert.equal(parsed.trust?.level, 'untrusted');
    assert.match(String(parsed.trust?.reason || ''), /missing plugin version/i);
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

test('parseImportPayload requires explicit type metadata for schema exports', () => {
    const parsed = utils.parseImportPayload({
        schemaVersion: utils.EXPORT_SCHEMA_VERSION,
        mode: 'full',
        folders: {}
    }, 'docker');

    assert.equal(parsed.ok, false);
    assert.match(parsed.error, /missing required type metadata/i);
});

test('normalizeFolderMap trims ids and heals member lists', () => {
    const normalized = utils.normalizeFolderMap({
        '  alpha  ': {
            name: ' Alpha ',
            parent_id: '  parent-1  ',
            containers: {
                plex: true,
                sonarr: true
            },
            settings: null,
            actions: 'bad-value'
        },
        '': {
            name: 'Discard',
            containers: []
        },
        beta: {
            name: '',
            containers: []
        }
    });

    assert.deepEqual(Object.keys(normalized), ['alpha']);
    assert.equal(normalized.alpha.name, 'Alpha');
    assert.equal(normalized.alpha.parentId, 'parent-1');
    assert.deepEqual(normalized.alpha.containers.sort(), ['plex', 'sonarr']);
    assert.deepEqual(normalized.alpha.settings, {});
    assert.deepEqual(normalized.alpha.actions, []);
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

test('buildImportOperations remaps incoming nested ids by matching parent/name path', () => {
    const existing = {
        rootA: { name: 'Apps', parentId: '', containers: [] },
        childA: { name: 'Media', parentId: 'rootA', containers: [] }
    };
    const parsed = {
        mode: 'full',
        folders: {
            incomingRoot: { name: 'Apps', parentId: '', containers: [] },
            incomingChild: { name: 'Media', parentId: 'incomingRoot', containers: [] }
        }
    };
    const ops = utils.buildImportOperations(existing, parsed, 'merge');
    assert.equal(ops.upserts.length, 2);
    assert.equal(ops.pathMappings.length, 2);
    const byId = Object.fromEntries(ops.upserts.map((row) => [row.id, row]));
    assert.equal(byId.rootA.pathMapped, true);
    assert.equal(byId.childA.pathMapped, true);
    assert.equal(byId.childA.folder.parentId, 'rootA');
});

test('buildImportOperations records path conflicts when collisions are ambiguous', () => {
    const existing = {
        one: { name: 'Apps', parentId: '', containers: [] },
        two: { name: 'Apps', parentId: '', containers: [] }
    };
    const parsed = {
        mode: 'full',
        folders: {
            incoming: { name: 'Apps', parentId: '', containers: [] }
        }
    };
    const ops = utils.buildImportOperations(existing, parsed, 'merge');
    assert.equal(ops.pathConflicts.length, 1);
    assert.equal(ops.upserts.length, 1);
    assert.equal(ops.upserts[0].id, 'incoming');
});

test('buildImportDiffRows reports parent field changes', () => {
    const existing = {
        child: { name: 'Child', parentId: '', containers: [] },
        root: { name: 'Root', parentId: '', containers: [] }
    };
    const parsed = {
        mode: 'full',
        folders: {
            child: { name: 'Child', parentId: 'root', containers: [] },
            root: { name: 'Root', parentId: '', containers: [] }
        }
    };
    const rows = utils.buildImportDiffRows(existing, parsed, 'merge');
    const childRow = rows.find((row) => row.id === 'child');
    assert.ok(childRow);
    assert.equal(childRow.action, 'update');
    assert.ok(childRow.fields.includes('parent'));
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

test('normalizePrefs provides dashboard defaults', () => {
    const prefs = utils.normalizePrefs({});
    assert.deepEqual(prefs.dashboard, {
        layout: 'classic',
        expandToggle: true,
        greyscale: false,
        folderLabel: true
    });
});

test('normalizePrefs sanitizes dashboard layout preferences', () => {
    const prefs = utils.normalizePrefs({
        dashboard: {
            layout: 'accordion',
            expandToggle: false,
            greyscale: true,
            folderLabel: false
        }
    });
    assert.deepEqual(prefs.dashboard, {
        layout: 'accordion',
        expandToggle: false,
        greyscale: true,
        folderLabel: false
    });
    const matrix = utils.normalizePrefs({
        dashboard: {
            layout: 'compactmatrix'
        }
    });
    assert.equal(matrix.dashboard.layout, 'compactmatrix');
    const fallback = utils.normalizePrefs({
        dashboard: {
            layout: 'invalid-value'
        }
    });
    assert.equal(fallback.dashboard.layout, 'classic');
});

test('orderFoldersByPrefs keeps child folders nested after parent in sorted output', () => {
    const folders = {
        rootA: { name: 'Zulu Root' },
        childA: { name: 'Alpha Child', parentId: 'rootA' },
        grandA: { name: 'Nested Child', parentId: 'childA' },
        rootB: { name: 'Beta Root' },
        orphan: { name: 'Orphan Child', parentId: 'missing' },
        cycleA: { name: 'Cycle A', parentId: 'cycleB' },
        cycleB: { name: 'Cycle B', parentId: 'cycleA' }
    };

    const alpha = utils.orderFoldersByPrefs(folders, { sortMode: 'alpha' });
    assert.deepEqual(Object.keys(alpha), [
        'rootB',
        'orphan',
        'rootA',
        'childA',
        'grandA',
        'cycleA',
        'cycleB'
    ]);
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

test('compose project helpers normalize compose labels and manager fallback', () => {
    assert.equal(
        utils.getComposeProjectFromLabels({ 'com.docker.compose.project': 'media' }),
        'media'
    );
    assert.equal(
        utils.getComposeProjectFromLabels({ 'com.docker.compose.project.working_dir': '/mnt/user/appdata/networking' }),
        'networking'
    );
    assert.equal(
        utils.getComposeProjectFromLabels({ 'com.docker.compose.project.config_files': '/mnt/user/appdata/media/docker-compose.yml' }),
        'media'
    );
    assert.equal(utils.getComposeProjectFromLabels({}), '');

    assert.equal(utils.isComposeManagedFromLabels({ 'net.unraid.docker.managed': 'composeman' }), true);
    assert.equal(
        utils.isComposeManagedFromLabels({ 'com.docker.compose.project.working_dir': '/mnt/user/appdata/media' }),
        true
    );
    assert.equal(utils.isComposeManagedFromLabels({ 'net.unraid.docker.managed': 'dockerman' }), false);
});

test('getAutoRuleMatches supports compose project regex with compose label fallbacks', () => {
    const rules = [
        {
            id: 'compose-rule',
            enabled: true,
            folderId: 'compose-folder',
            kind: 'compose_project_regex',
            pattern: '^media$'
        }
    ];
    const names = ['sonarr', 'nginx'];
    const info = {
        sonarr: {
            Labels: {
                'com.docker.compose.project.config_files': '/mnt/user/appdata/media/docker-compose.yml'
            }
        },
        nginx: {
            Labels: {
                'com.docker.compose.project.working_dir': '/mnt/user/appdata/networking'
            }
        }
    };

    const matches = utils.getAutoRuleMatches({
        rules,
        folderId: 'compose-folder',
        names,
        infoByName: info,
        type: 'docker'
    });

    assert.deepEqual(matches, ['sonarr']);
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
    assert.equal(prefs.runtimePrefsSchema, 2);
    assert.equal(prefs.liveRefreshEnabled, false);
    assert.equal(prefs.liveRefreshSeconds, 20);
    assert.equal(prefs.performanceMode, false);
    assert.equal(prefs.lazyPreviewEnabled, false);
    assert.equal(prefs.lazyPreviewThreshold, 30);
    assert.deepEqual(prefs.backupSchedule, {
        enabled: false,
        intervalHours: 24,
        retention: 25,
        lastRunAt: ''
    });
    assert.deepEqual(prefs.health, {
        cardsEnabled: true,
        runtimeBadgeEnabled: false,
        compact: false,
        warnStoppedPercent: 60,
        criticalStoppedPercent: 90,
        profile: 'balanced',
        updatesMode: 'maintenance',
        allStoppedMode: 'critical',
        vmResourceWarnVcpus: 16,
        vmResourceCriticalVcpus: 32,
        vmResourceWarnGiB: 32,
        vmResourceCriticalGiB: 64
    });
    assert.deepEqual(prefs.status, {
        mode: 'summary',
        displayMode: 'balanced',
        trendEnabled: true,
        attentionAccent: true,
        warnStoppedPercent: 60
    });
    assert.equal(prefs.setupWizardCompleted, false);
    assert.equal(prefs.settingsMode, 'basic');
    assert.deepEqual(prefs.expandedFolderState, {});
    assert.equal(prefs.appColumnWidth, 'standard');
});

test('normalizePrefs clamps application width mode', () => {
    const compact = utils.normalizePrefs({
        appColumnWidth: 'compact'
    });
    assert.equal(compact.appColumnWidth, 'compact');

    const wide = utils.normalizePrefs({
        appColumnWidth: 'WIDE'
    });
    assert.equal(wide.appColumnWidth, 'wide');

    const fallback = utils.normalizePrefs({
        appColumnWidth: 'extra-wide'
    });
    assert.equal(fallback.appColumnWidth, 'standard');
});

test('normalizePrefs disables legacy runtime toggles until schema is upgraded', () => {
    const legacy = utils.normalizePrefs({
        liveRefreshEnabled: true,
        liveRefreshSeconds: 45,
        performanceMode: true,
        lazyPreviewEnabled: true,
        lazyPreviewThreshold: 77
    });
    assert.equal(legacy.runtimePrefsSchema, 2);
    assert.equal(legacy.liveRefreshEnabled, false);
    assert.equal(legacy.performanceMode, false);
    assert.equal(legacy.lazyPreviewEnabled, false);
    assert.equal(legacy.liveRefreshSeconds, 45);
    assert.equal(legacy.lazyPreviewThreshold, 77);

    const upgraded = utils.normalizePrefs({
        runtimePrefsSchema: 2,
        liveRefreshEnabled: true,
        liveRefreshSeconds: 45,
        performanceMode: true,
        lazyPreviewEnabled: true,
        lazyPreviewThreshold: 77
    });
    assert.equal(upgraded.liveRefreshEnabled, true);
    assert.equal(upgraded.performanceMode, true);
    assert.equal(upgraded.lazyPreviewEnabled, true);

    const onboarding = utils.normalizePrefs({
        setupWizardCompleted: true,
        settingsMode: 'advanced'
    });
    assert.equal(onboarding.setupWizardCompleted, true);
    assert.equal(onboarding.settingsMode, 'advanced');
});

test('normalizePrefs supports health card preferences and guards ranges', () => {
    const prefs = utils.normalizePrefs({
        health: {
            cardsEnabled: false,
            runtimeBadgeEnabled: true,
            compact: true,
            warnStoppedPercent: 133,
            criticalStoppedPercent: 144,
            profile: 'strict',
            updatesMode: 'warn',
            allStoppedMode: 'warn',
            vmResourceWarnVcpus: 12,
            vmResourceCriticalVcpus: 12,
            vmResourceWarnGiB: 40,
            vmResourceCriticalGiB: 40
        }
    });
    assert.equal(prefs.health.cardsEnabled, false);
    assert.equal(prefs.health.runtimeBadgeEnabled, true);
    assert.equal(prefs.health.compact, true);
    assert.equal(prefs.health.warnStoppedPercent, 100);
    assert.equal(prefs.health.criticalStoppedPercent, 100);
    assert.equal(prefs.health.profile, 'strict');
    assert.equal(prefs.health.updatesMode, 'warn');
    assert.equal(prefs.health.allStoppedMode, 'warn');
    assert.equal(prefs.health.vmResourceWarnVcpus, 12);
    assert.equal(prefs.health.vmResourceCriticalVcpus, 13);
    assert.equal(prefs.health.vmResourceWarnGiB, 40);
    assert.equal(prefs.health.vmResourceCriticalGiB, 41);
});

test('normalizePrefs heals unknown health policy values to defaults', () => {
    const prefs = utils.normalizePrefs({
        health: {
            profile: 'invalid',
            updatesMode: 'bad',
            allStoppedMode: 'nope'
        }
    });
    assert.equal(prefs.health.profile, 'balanced');
    assert.equal(prefs.health.updatesMode, 'maintenance');
    assert.equal(prefs.health.allStoppedMode, 'critical');
});

test('normalizePrefs supports status column preferences and guards ranges', () => {
    const prefs = utils.normalizePrefs({
        status: {
            mode: 'dominant',
            trendEnabled: false,
            attentionAccent: false,
            warnStoppedPercent: 222
        }
    });
    assert.equal(prefs.status.mode, 'dominant');
    assert.equal(prefs.status.trendEnabled, false);
    assert.equal(prefs.status.attentionAccent, false);
    assert.equal(prefs.status.warnStoppedPercent, 100);
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
    assert.deepEqual(Object.keys(parsed.folders), ['abc', 'def']);
    assert.equal(parsed.folders.abc.name, 'One');
    assert.deepEqual(parsed.folders.abc.containers, ['x']);
    assert.equal(parsed.folders.def.name, 'Two');
    assert.deepEqual(parsed.folders.def.containers, []);

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

test('normalizePrefs keeps pinned folders and hide-empty toggle', () => {
    const prefs = utils.normalizePrefs({
        pinnedFolderIds: ['a', 'b', 'a', '', 'c'],
        hideEmptyFolders: true
    });
    assert.deepEqual(prefs.pinnedFolderIds, ['a', 'b', 'c']);
    assert.equal(prefs.hideEmptyFolders, true);
});

test('normalizePrefs keeps expanded folder state as a boolean map', () => {
    const prefs = utils.normalizePrefs({
        expandedFolderState: {
            alpha: true,
            beta: false,
            gamma: '1',
            '': true
        }
    });
    assert.deepEqual(prefs.expandedFolderState, {
        alpha: true,
        beta: false,
        gamma: false
    });
});

test('orderFoldersByPrefs keeps pinned folders at top', () => {
    const folders = {
        one: { name: 'One' },
        two: { name: 'Two' },
        three: { name: 'Three' }
    };
    const ordered = utils.orderFoldersByPrefs(folders, {
        sortMode: 'created',
        pinnedFolderIds: ['three', 'one']
    });
    assert.deepEqual(Object.keys(ordered), ['three', 'one', 'two']);
});

test('getEffectiveFolderMembers combines manual regex rule and legacy label matches', () => {
    const members = utils.getEffectiveFolderMembers({
        type: 'docker',
        folderId: 'media',
        folder: {
            name: 'Media',
            containers: ['manual-one'],
            regex: '^rx-'
        },
        names: ['manual-one', 'rx-app', 'rule-app', 'label-app'],
        infoByName: {
            'manual-one': { Labels: {} },
            'rx-app': { Labels: {} },
            'rule-app': { Labels: {} },
            'label-app': { Labels: { 'folderview.plus': 'Media' } }
        },
        rules: [
            {
                id: 'r1',
                enabled: true,
                folderId: 'media',
                kind: 'name_regex',
                effect: 'include',
                pattern: '^rule-'
            }
        ]
    });
    assert.deepEqual(members.members.sort(), ['label-app', 'manual-one', 'rule-app', 'rx-app']);
    assert.deepEqual(members.reasonsByName['manual-one'], ['manual']);
    assert.deepEqual(members.reasonsByName['rx-app'], ['regex']);
    assert.deepEqual(members.reasonsByName['rule-app'], ['rule']);
    assert.deepEqual(members.reasonsByName['label-app'], ['label']);
});

test('planFolderRuntimeAction filters eligible docker items by current state', () => {
    const plan = utils.planFolderRuntimeAction({
        type: 'docker',
        folderId: 'apps',
        folder: {
            name: 'Apps',
            containers: ['running', 'paused', 'stopped']
        },
        infoByName: {
            running: { info: { State: { Running: true, Paused: false } } },
            paused: { info: { State: { Running: true, Paused: true } } },
            stopped: { info: { State: { Running: false, Paused: false } } }
        },
        rules: [],
        action: 'resume'
    });

    assert.equal(plan.requestedCount, 3);
    assert.deepEqual(plan.eligible.map((row) => row.name), ['paused']);
    assert.equal(plan.skipped.length, 2);
    assert.deepEqual(plan.countsByState, {
        started: 1,
        paused: 1,
        stopped: 1
    });
});
