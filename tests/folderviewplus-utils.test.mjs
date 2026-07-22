import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const utils = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils.js');

test('normalizePrefs preserves transient configuration revision metadata for stale-save protection', () => {
    const prefs = utils.normalizePrefs({
        sortMode: 'manual',
        _metadata: {
            schemaVersion: 1,
            type: 'docker',
            folderRevision: 4,
            prefsRevision: 7,
            updatedAt: '2026-07-15T12:00:00+00:00'
        }
    });

    assert.deepEqual(prefs._metadata, {
        schemaVersion: 1,
        type: 'docker',
        folderRevision: 4,
        prefsRevision: 7,
        updatedAt: '2026-07-15T12:00:00+00:00'
    });
});

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

test('parseImportPayload tolerates unresolved icon paths and nested parent references', () => {
    const parsed = utils.parseImportPayload({
        schemaVersion: utils.EXPORT_SCHEMA_VERSION,
        pluginVersion: '2026.03.22.25',
        exportedAt: '2026-03-22T16:10:00.000Z',
        type: 'docker',
        mode: 'full',
        folders: {
            media: {
                name: 'Media',
                icon: '/plugins/folderview.plus/images/third-party-icons/missing-pack/media.svg',
                containers: ['plex']
            },
            books: {
                name: 'Books',
                icon: 'custom://missing-icons/books.svg',
                parentId: 'media',
                containers: ['audiobookshelf']
            }
        }
    }, 'docker');

    assert.equal(parsed.ok, true);
    assert.equal(parsed.mode, 'full');
    assert.equal(parsed.folders.media.icon, '/plugins/folderview.plus/images/third-party-icons/missing-pack/media.svg');
    assert.equal(parsed.folders.books.icon, 'custom://missing-icons/books.svg');
    assert.equal(parsed.folders.books.parentId, 'media');
});

test('parseImportPayload falls back to default icon when import icon payload is unreasonably large', () => {
    const parsed = utils.parseImportPayload({
        schemaVersion: utils.EXPORT_SCHEMA_VERSION,
        pluginVersion: '2026.03.22.25',
        exportedAt: '2026-03-22T16:10:00.000Z',
        type: 'docker',
        mode: 'full',
        folders: {
            huge: {
                name: 'Oversized Icon',
                icon: `data:image/svg+xml,${'x'.repeat(9000)}`,
                containers: []
            }
        }
    }, 'docker');

    assert.equal(parsed.ok, true);
    assert.equal(parsed.folders.huge.icon, '/plugins/folderview.plus/images/folder-icon.png');
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

test('normalizeFolderMembers is exported and normalizes arrays/objects', () => {
    assert.equal(typeof utils.normalizeFolderMembers, 'function');
    assert.deepEqual(
        utils.normalizeFolderMembers([' plex ', 'plex', '', 'sonarr']),
        ['plex', 'sonarr']
    );
    assert.deepEqual(
        utils.normalizeFolderMembers({ '  qbittorrent ': true, '': true, bazarr: true }),
        ['qbittorrent', 'bazarr']
    );
});

test('normalizePrefs preserves settings table layout preferences', () => {
    const prefs = utils.normalizePrefs({
        settingsTable: {
            widthMode: 'custom',
            preset: 'detailed',
            columns: { members: true, status: false },
            columnWidths: { name: 420, status: 260 },
            nameWidth: 'wide',
            actionsWidth: 'compact'
        }
    });

    assert.equal(prefs.settingsTable.preset, 'detailed');
    assert.deepEqual(prefs.settingsTable.columns, { members: true, status: false });
    assert.equal(prefs.settingsTable.nameWidth, 'wide');
    assert.equal(prefs.settingsTable.actionsWidth, 'compact');
    assert.equal(Object.hasOwn(prefs.settingsTable, 'widthMode'), false);
    assert.equal(Object.hasOwn(prefs.settingsTable, 'columnWidths'), false);
});

test('normalizePrefs drops retired folder editor mode fields', () => {
    const prefs = utils.normalizePrefs({ folderEditorMode: 'legacy', folderEditorModeExplicit: true });

    assert.equal(Object.hasOwn(prefs, 'folderEditorMode'), false);
    assert.equal(Object.hasOwn(prefs, 'folderEditorModeExplicit'), false);
    assert.equal(Object.hasOwn(utils, 'normalizeFolderEditorMode'), false);
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

test('orderFoldersByPrefs supports manual, name, and timestamp sort modes', () => {
    const folders = {
        z: { name: 'Zulu', createdAt: '2026-04-01T12:00:00Z', updatedAt: '2026-04-06T12:00:00Z' },
        a: { name: 'Alpha', createdAt: '2026-04-03T12:00:00Z', updatedAt: '2026-04-04T12:00:00Z' },
        b: { name: 'Beta', createdAt: '2026-04-02T12:00:00Z', updatedAt: '2026-04-05T12:00:00Z' }
    };

    const manual = utils.orderFoldersByPrefs(folders, {
        sortMode: 'manual',
        manualOrder: ['b', 'z']
    });
    assert.deepEqual(Object.keys(manual), ['b', 'z', 'a']);

    const alpha = utils.orderFoldersByPrefs(folders, { sortMode: 'alpha' });
    assert.deepEqual(Object.keys(alpha), ['a', 'b', 'z']);

    const nameDesc = utils.orderFoldersByPrefs(folders, { sortMode: 'name_desc' });
    assert.deepEqual(Object.keys(nameDesc), ['z', 'b', 'a']);

    const createdNewest = utils.orderFoldersByPrefs(folders, { sortMode: 'created_newest' });
    assert.deepEqual(Object.keys(createdNewest), ['a', 'b', 'z']);

    const createdOldest = utils.orderFoldersByPrefs(folders, { sortMode: 'created_oldest' });
    assert.deepEqual(Object.keys(createdOldest), ['z', 'b', 'a']);

    const updatedNewest = utils.orderFoldersByPrefs(folders, { sortMode: 'updated_newest' });
    assert.deepEqual(Object.keys(updatedNewest), ['z', 'b', 'a']);
});

test('normalizePrefs provides dashboard defaults', () => {
    const prefs = utils.normalizePrefs({});
    assert.deepEqual(prefs.dashboard, {
        layout: 'classic',
        expandToggle: true,
        greyscale: false,
        folderLabel: true,
        privacyMode: false,
        privacyMaskNames: true,
        privacyMaskContainerIps: true,
        privacyMaskLocalIps: true,
        privacyMaskPorts: true,
        privacyMaskVolumePaths: true,
        privacyMaskImageRegistry: true,
        privacyMaskVmDiskPaths: true,
        privacyMaskMacAddresses: true,
        privacyMaskPublicIps: true,
        privacyMaskInterfaces: true,
        privacyMaskExternalUrls: true,
        previewContext: 'native',
        previewTrigger: 'click',
        previewGraph: 1,
        previewGraphTime: 60
    });
});

test('normalizePrefs sanitizes dashboard layout preferences', () => {
    const prefs = utils.normalizePrefs({
        dashboard: {
            layout: 'accordion',
            expandToggle: false,
            greyscale: true,
        folderLabel: false,
        privacyMode: false
        }
    });
    assert.deepEqual(prefs.dashboard, {
        layout: 'accordion',
        expandToggle: false,
        greyscale: true,
        folderLabel: false,
        privacyMode: false,
        privacyMaskNames: true,
        privacyMaskContainerIps: true,
        privacyMaskLocalIps: true,
        privacyMaskPorts: true,
        privacyMaskVolumePaths: true,
        privacyMaskImageRegistry: true,
        privacyMaskVmDiskPaths: true,
        privacyMaskMacAddresses: true,
        privacyMaskPublicIps: true,
        privacyMaskInterfaces: true,
        privacyMaskExternalUrls: true,
        previewContext: 'native',
        previewTrigger: 'click',
        previewGraph: 1,
        previewGraphTime: 60
    });
    const matrix = utils.normalizePrefs({
        dashboard: {
            layout: 'compactmatrix'
        }
    });
    assert.equal(matrix.dashboard.layout, 'compactmatrix');
    const embossed = utils.normalizePrefs({ dashboard: { layout: 'embossed' } });
    assert.equal(embossed.dashboard.layout, 'embossed');
    const legacy = utils.normalizePrefs({
        dashboard: {
            layout: 'legacy'
        }
    });
    assert.equal(legacy.dashboard.layout, 'legacy');
    const fallback = utils.normalizePrefs({
        dashboard: {
            layout: 'invalid-value'
        }
    });
    assert.equal(fallback.dashboard.layout, 'classic');
});

test('utils exports shared dashboard metadata and runtime-safe escaping helpers', () => {
    assert.deepEqual(utils.DASHBOARD_LAYOUT_OPTIONS, ['classic', 'legacy', 'fullwidth', 'accordion', 'inset', 'compactmatrix', 'embossed']);
    assert.equal(utils.DASHBOARD_LAYOUT_LABELS.legacy, 'Legacy');
    assert.deepEqual(utils.DASHBOARD_OVERFLOW_OPTIONS, ['default', 'expand_row', 'scroll']);
    assert.equal(utils.normalizeDashboardOverflowMode('expand_row'), 'expand_row');
    assert.equal(utils.normalizeDashboardOverflowMode('bad-value'), 'default');
    assert.equal(utils.escapeHtml(`a<"b"&'c'`), 'a&lt;&quot;b&quot;&amp;&#39;c&#39;');
    assert.equal(utils.sanitizeImageSrc('javascript:alert(1)'), '/plugins/dynamix.docker.manager/images/question.png');
    assert.equal(utils.sanitizeImageSrc('/plugins/folderview.plus/images/folder-icon.png'), '/plugins/folderview.plus/images/folder-icon.png');
    assert.deepEqual(utils.resolvePreviewActionPrefs({ preview_webui: true, preview_console: false, preview_logs: true }), {
        preview_webui: true,
        preview_console: false,
        preview_logs: true
    });
    assert.deepEqual(utils.resolvePreviewActionPrefs(null), {
        preview_webui: false,
        preview_console: false,
        preview_logs: false
    });
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

test('getAutoRuleDecision uses documented first-match priority for advanced docker kinds', () => {
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

    assert.equal(decision.assignedRule?.id, 'inc1');
    assert.equal(decision.blockedBy, null);

    const excludeFirst = utils.getAutoRuleDecision({
        rules: [rules[1], rules[0]],
        name: 'sonarr',
        infoByName: info,
        type: 'docker'
    });
    assert.equal(excludeFirst.assignedRule, null);
    assert.equal(excludeFirst.blockedBy?.id, 'exc1');
});

test('normalizePrefs includes live refresh, performance profile, and backup schedule defaults', () => {
    const prefs = utils.normalizePrefs({});
    assert.equal(prefs.runtimePrefsSchema, 4);
    assert.equal(prefs.liveRefreshEnabled, false);
    assert.equal(prefs.liveRefreshSeconds, 20);
    assert.equal(prefs.performanceMode, false);
    assert.equal(prefs.performanceProfile, 'standard');
    assert.equal(prefs.lazyPreviewEnabled, false);
    assert.equal(prefs.lazyPreviewThreshold, 30);
    assert.equal(prefs.pageViewMode, 'folderview');
    assert.equal(prefs.themeCompatibilityMode, 'auto');
    assert.deepEqual(prefs.backupSchedule, {
        enabled: false,
        intervalHours: 24,
        retention: 25,
        lastRunAt: ''
    });
    assert.deepEqual(prefs.health, {
        cardsEnabled: true,
        runtimeBadgeEnabled: false,
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

test('normalizePrefs supports theme compatibility mode and sanitizes invalid values', () => {
    const hostListMode = utils.normalizePrefs({
        pageViewMode: 'HOST'
    });
    assert.equal(hostListMode.pageViewMode, 'host');

    const commandViewMode = utils.normalizePrefs({
        pageViewMode: 'COMMAND'
    });
    assert.equal(commandViewMode.pageViewMode, 'command');

    const removedTreeExplorerMode = utils.normalizePrefs({
        pageViewMode: 'TREE-EXPLORER'
    });
    assert.equal(removedTreeExplorerMode.pageViewMode, 'folderview');

    const removedOrbitMode = utils.normalizePrefs({
        pageViewMode: 'ORBIT'
    });
    assert.equal(removedOrbitMode.pageViewMode, 'folderview');

    const folderViewMode = utils.normalizePrefs({
        pageViewMode: 'folderview'
    });
    assert.equal(folderViewMode.pageViewMode, 'folderview');

    const fallbackPageViewMode = utils.normalizePrefs({
        pageViewMode: 'broken-mode'
    });
    assert.equal(fallbackPageViewMode.pageViewMode, 'folderview');

    const hostMode = utils.normalizePrefs({
        themeCompatibilityMode: 'host'
    });
    assert.equal(hostMode.themeCompatibilityMode, 'host');

    const safeMode = utils.normalizePrefs({
        themeCompatibilityMode: 'SAFE'
    });
    assert.equal(safeMode.themeCompatibilityMode, 'safe');

    const highContrastMode = utils.normalizePrefs({
        themeCompatibilityMode: 'highcontrast'
    });
    assert.equal(highContrastMode.themeCompatibilityMode, 'highcontrast');

    const fallbackMode = utils.normalizePrefs({
        themeCompatibilityMode: 'broken-mode'
    });
    assert.equal(fallbackMode.themeCompatibilityMode, 'auto');
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
    assert.equal(legacy.runtimePrefsSchema, 4);
    assert.equal(legacy.liveRefreshEnabled, false);
    assert.equal(legacy.performanceMode, false);
    assert.equal(legacy.performanceProfile, 'standard');
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
    assert.equal(upgraded.performanceProfile, 'adaptive');
    assert.equal(upgraded.lazyPreviewEnabled, true);

    const maximum = utils.normalizePrefs({
        runtimePrefsSchema: 4,
        performanceProfile: 'maximum',
        performanceMode: false
    });
    assert.equal(maximum.performanceProfile, 'maximum');
    assert.equal(maximum.performanceMode, true);

    const legacyPrivacy = utils.normalizePrefs({
        runtimePrefsSchema: 2,
        dashboard: {
            privacyMode: true
        }
    });
    assert.equal(legacyPrivacy.dashboard.privacyMode, false);

    const upgradedPrivacy = utils.normalizePrefs({
        runtimePrefsSchema: 3,
        dashboard: {
            privacyMode: true
        }
    });
    assert.equal(upgradedPrivacy.dashboard.privacyMode, true);

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
    assert.equal(Object.prototype.hasOwnProperty.call(prefs.health, 'compact'), false);
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

test('normalizePrefs preserves folder defaults profiles and removes member-bound actions', () => {
    const prefs = utils.normalizePrefs({
        folderDefaults: {
            sourceId: 'media',
            sourceName: 'Media',
            profile: {
                icon: 'https://example.com/icon.png',
                settings: {
                    preview: 4,
                    override_default_actions: true
                },
                actions: [
                    {
                        name: 'Script action',
                        type: 1,
                        command: 'echo ok'
                    },
                    {
                        name: 'Member action',
                        type: 0,
                        containers: ['plex']
                    }
                ]
            }
        }
    });

    assert.equal(prefs.folderDefaults.sourceId, 'media');
    assert.equal(prefs.folderDefaults.sourceName, 'Media');
    assert.equal(prefs.folderDefaults.profile.icon, 'https://example.com/icon.png');
    assert.equal(prefs.folderDefaults.profile.settings.preview, 4);
    assert.equal(prefs.folderDefaults.profile.settings.override_default_actions, true);
    assert.equal(prefs.folderDefaults.profile.actions.length, 1);
    assert.equal(prefs.folderDefaults.profile.actions[0].name, 'Script action');
    assert.equal(prefs.folderDefaults.profile.actions[0].type, 1);
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

test('orderFoldersByPrefs applies pinned folders before every supported sort mode', () => {
    const folders = {
        alpha: { name: 'Alpha', createdAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-04T00:00:00Z' },
        bravo: { name: 'Bravo', createdAt: '2026-01-03T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' },
        charlie: { name: 'Charlie', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-03T00:00:00Z' }
    };
    const modes = ['created', 'created_newest', 'created_oldest', 'updated_newest', 'manual', 'alpha', 'name_desc'];

    for (const sortMode of modes) {
        const ordered = utils.orderFoldersByPrefs(folders, {
            sortMode,
            manualOrder: ['charlie', 'alpha', 'bravo'],
            pinnedFolderIds: ['bravo']
        });
        assert.equal(Object.keys(ordered)[0], 'bravo', `${sortMode} should keep pinned folders first`);
    }
});

test('orderFoldersByPrefs keeps nested manual branches together after ordering', () => {
    const folders = {
        rootOne: { name: 'Root One' },
        childOne: { name: 'Child One', parentId: 'rootOne' },
        rootTwo: { name: 'Root Two' },
        childTwo: { name: 'Child Two', parentId: 'rootTwo' }
    };
    const ordered = utils.orderFoldersByPrefs(folders, {
        sortMode: 'manual',
        manualOrder: ['rootTwo', 'rootOne', 'childOne', 'childTwo']
    });
    assert.deepEqual(Object.keys(ordered), ['rootTwo', 'childTwo', 'rootOne', 'childOne']);
});

test('orderFoldersByPrefs promotes a pinned nested child by moving its root branch', () => {
    const folders = {
        rootB: { name: 'Beta Root' },
        rootA: { name: 'Alpha Root' },
        childA: { name: 'Alpha Child', parentId: 'rootA' }
    };
    const ordered = utils.orderFoldersByPrefs(folders, {
        sortMode: 'created',
        pinnedFolderIds: ['childA']
    });
    assert.deepEqual(Object.keys(ordered), ['rootA', 'childA', 'rootB']);
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

test('performance utility helpers are exported and writable in node runtime', async () => {
    assert.equal(typeof utils.createFrameScheduler, 'function');
    assert.equal(typeof utils.createIdleTaskQueue, 'function');
    assert.equal(typeof utils.createBatchedStorageWriter, 'function');

    const storage = new Map();
    const storageWriter = utils.createBatchedStorageWriter({
        getItem: (key) => (storage.has(key) ? storage.get(key) : null),
        setItem: (key, value) => storage.set(key, String(value)),
        removeItem: (key) => storage.delete(key)
    }, {
        defaultDelayMs: 0
    });

    storageWriter.setItem('alpha', '1');
    storageWriter.removeItem('alpha');
    storageWriter.setItem('beta', '2');
    storageWriter.flush();
    assert.equal(storage.get('beta'), '2');
    assert.equal(storage.has('alpha'), false);
});
