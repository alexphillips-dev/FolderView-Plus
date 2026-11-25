import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { phpOrder } from './helpers/docker-order-fixture.mjs';

const repoRoot = path.resolve(process.cwd());
const dockerJs = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js'),
    'utf8'
);
const serverRoot = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server');
const libPhp = ['lib.php', 'lib.docker-order.php', 'lib.docker-page-order.php']
    .map((name) => fs.readFileSync(path.join(serverRoot, name), 'utf8'))
    .join('\n');
const require = createRequire(import.meta.url);
const runtimeFolderOrdering = require(path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/runtime.folder-ordering.js'
));
const utils = require(path.join(serverRoot, '../scripts/folderviewplus.utils-ordering.js'));

test('browser and native startup share accent, digit, ID tie, and pin ordering in both name modes', () => {
    const labels = {
        '08': 'Équipe 2', '8': 'E\u0301quipe 02', ten: 'Équipe 10',
        zebra: 'Zebra', unicode: '日本', icon: '🎬'
    };
    const folders = Object.fromEntries(Object.entries(labels).map(([id, name]) => [id, { name, containers: ['member-' + id] }]));
    const names = Object.keys(folders).map(id => 'member-' + id);
    const native = Object.keys(folders).map(id => 'folder-' + id);
    for (const [sortMode, order] of [
        ['alpha', ['08', '8', 'ten', 'zebra', 'unicode', 'icon']],
        ['name_desc', ['icon', 'unicode', 'zebra', 'ten', '8', '08']]
    ]) {
        for (const pinnedFolderIds of [[], ['ten']]) {
            const prefs = { sortMode, pinnedFolderIds };
            const expected = pinnedFolderIds.length ? ['ten', ...order.filter(id => id !== 'ten')] : order;
            assert.deepEqual(utils.orderFolderIdsByPrefs(folders, prefs), expected);
            assert.deepEqual(phpOrder({ folders, prefs, native, names }).order, expected.map(id => 'member-' + id));
        }
    }
});

const reconcileDockerOrderWithFolderSlots = (liveOrder, savedOrder, folders, folderRegex = /^folder-/) => (
    runtimeFolderOrdering.reconcileOrderWithFolderSlots(liveOrder, savedOrder, folders, {
        folderTokenPrefix: 'folder-',
        isFolderToken: (entry) => folderRegex.test(String(entry || ''))
    })
);
const reorderFolderSlotsInBaseOrder = (
    baseOrder,
    folders,
    prefs,
    folderRegex = /^folder-/,
    getPrefsOrderedFolderMap = (source) => source
) => runtimeFolderOrdering.reorderFolderSlotsInBaseOrder(baseOrder, folders, prefs, {
    orderFolders: getPrefsOrderedFolderMap,
    folderTokenPrefix: 'folder-',
    isFolderToken: (entry) => folderRegex.test(String(entry || ''))
});

test('docker runtime appends new containers without changing saved mixed slots', () => {
    const result = reconcileDockerOrderWithFolderSlots(
        ['new-container', 'existing-one', 'existing-two'],
        ['existing-one', 'existing-two', 'folder-a', 'folder-b'],
        {
            a: { name: 'Apps' },
            b: { name: 'Services' }
        },
        /^folder-/
    );

    assert.deepEqual(result.newOnes, ['new-container']);
    assert.deepEqual(result.order, [
        'existing-one',
        'existing-two',
        'folder-a',
        'folder-b',
        'new-container'
    ]);
});

test('docker runtime preserves a new container already saved first by Unraid', () => {
    const result = reconcileDockerOrderWithFolderSlots(
        ['new-container', 'existing-one', 'existing-two'],
        ['new-container', 'existing-one', 'existing-two', 'folder-a', 'folder-b'],
        {
            a: { name: 'Apps' },
            b: { name: 'Services' }
        },
        /^folder-/
    );

    assert.deepEqual(result.newOnes, []);
    assert.deepEqual(result.order, [
        'new-container',
        'existing-one',
        'existing-two',
        'folder-a',
        'folder-b'
    ]);
});

test('docker runtime records privacy-safe reconciliation counts and fingerprints for support bundles', () => {
    const telemetryMatch = dockerJs.match(/lastDockerOrderReconciliation = \{\n([\s\S]*?)\n    \};/);
    assert.ok(telemetryMatch, 'order reconciliation telemetry assignment should exist');
    assert.match(dockerJs, /const liveOrderBeforeReconciliation = \[\.\.\.order\];/);
    assert.match(dockerJs, /lastDockerOrderReconciliation = \{/);
    assert.match(dockerJs, /liveOrderCount: liveOrderBeforeReconciliation\.length/);
    assert.match(dockerJs, /missingContainerCount: newOnes\.length/);
    assert.match(dockerJs, /appendedContainerCount: newOnes\.length/);
    assert.match(dockerJs, /appendPosition: newOnes\.length > 0 \? 'after-saved-order' : 'not-needed'/);
    assert.match(dockerJs, /orderingInvariantSatisfied: new Set\(reconciledOrder\.order\)\.size === reconciledOrder\.order\.length/);
    assert.match(dockerJs, /liveOrderFingerprint: dockerRuntimeDiagnosticsModule\.buildOrderFingerprint\(liveOrderBeforeReconciliation\)/);
    assert.match(dockerJs, /savedOrderFingerprint: dockerRuntimeDiagnosticsModule\.buildOrderFingerprint\(unraidOrder\)/);
    assert.match(dockerJs, /reconciledOrderFingerprint: dockerRuntimeDiagnosticsModule\.buildOrderFingerprint\(reconciledOrder\.order\)/);
    assert.doesNotMatch(dockerJs, /\bbuildDockerOrderFingerprint\b/);
    assert.doesNotMatch(telemetryMatch[1], /newOnes\s*[:,]/);
});

test('docker runtime preserves live folder placeholder order from host order on refresh', () => {
    const folderRegex = /^folder-/;
    const folders = {
        a: { name: '07' },
        b: { name: '08' },
        c: { name: '09' }
    };
    const prefs = {
        sortMode: 'created',
        manualOrder: []
    };
    const getPrefsOrderedFolderMap = () => ({
        a: folders.a,
        b: folders.b,
        c: folders.c
    });

    const baseOrder = ['folder-a', 'folder-c', 'folder-b'];
    const nextOrder = reorderFolderSlotsInBaseOrder(baseOrder, folders, prefs, folderRegex, getPrefsOrderedFolderMap);

    assert.deepEqual(nextOrder, ['folder-a', 'folder-c', 'folder-b']);
});

test('docker runtime reapplies saved alpha folder order even when host placeholders are stale', () => {
    const folderRegex = /^folder-/;
    const folders = {
        a: { name: '07' },
        b: { name: '08' },
        c: { name: '09' }
    };
    const getPrefsOrderedFolderMap = () => ({
        a: folders.a,
        b: folders.b,
        c: folders.c
    });

    const baseOrder = ['folder-c', 'folder-a', 'folder-b'];
    const nextOrder = reorderFolderSlotsInBaseOrder(baseOrder, folders, { sortMode: 'alpha' }, folderRegex, getPrefsOrderedFolderMap);

    assert.deepEqual(nextOrder, ['folder-a', 'folder-b', 'folder-c']);
});

test('docker runtime reapplies saved created-newest folder order even when host placeholders are stale', () => {
    const folderRegex = /^folder-/;
    const folders = {
        a: { name: '07' },
        b: { name: '08' },
        c: { name: '09' }
    };
    const getPrefsOrderedFolderMap = () => ({
        b: folders.b,
        a: folders.a,
        c: folders.c
    });

    const baseOrder = ['folder-c', 'folder-a', 'folder-b'];
    const nextOrder = reorderFolderSlotsInBaseOrder(baseOrder, folders, { sortMode: 'created_newest' }, folderRegex, getPrefsOrderedFolderMap);

    assert.deepEqual(nextOrder, ['folder-b', 'folder-a', 'folder-c']);
});

test('docker runtime promotes pinned folders before stale manual host placeholders', () => {
    const folderRegex = /^folder-/;
    const folders = {
        a: { name: '07' },
        b: { name: '08' },
        c: { name: '09' }
    };
    const prefs = {
        sortMode: 'manual',
        manualOrder: ['a', 'b', 'c'],
        pinnedFolderIds: ['c']
    };
    const getPrefsOrderedFolderMap = () => ({
        c: folders.c,
        a: folders.a,
        b: folders.b
    });

    const baseOrder = ['folder-a', 'folder-b', 'folder-c'];
    const nextOrder = reorderFolderSlotsInBaseOrder(baseOrder, folders, prefs, folderRegex, getPrefsOrderedFolderMap);

    assert.deepEqual(nextOrder, ['folder-c', 'folder-a', 'folder-b']);
});

test('docker runtime only backfills missing folder placeholders when sort mode remains created', () => {
    const folderRegex = /^folder-/;
    const folders = {
        a: { name: '07' },
        b: { name: '08' },
        c: { name: '09' }
    };
    const getPrefsOrderedFolderMap = () => ({
        a: folders.a,
        b: folders.b,
        c: folders.c
    });

    const baseOrder = ['folder-stale', 'folder-c', 'folder-a'];
    const nextOrder = reorderFolderSlotsInBaseOrder(baseOrder, folders, { sortMode: 'created' }, folderRegex, getPrefsOrderedFolderMap);

    assert.deepEqual(nextOrder, ['folder-b', 'folder-c', 'folder-a']);
});

test('startup preview places an unslotted folder before standalone native rows', () => {
    const actual = phpOrder({
        folders: { apps: { name: 'Apps', containers: ['z-member'] } },
        prefs: { sortMode: 'created' }, native: [], names: ['new-10', 'm-loose', 'z-member', 'new-2']
    });
    assert.deepEqual(actual.order, ['z-member', 'm-loose', 'new-2', 'new-10']);
    assert.deepEqual(actual.sequence.map(({ name }) => name), actual.order);
});

test('startup preview preserves saved order of a real folder-prefixed container', () => {
    const actual = phpOrder({
        folders: { apps: { name: 'Apps', containers: ['z-member'] } },
        prefs: { sortMode: 'created' },
        native: ['folder-app', 'folder-obsolete', 'z-loose'],
        names: ['new-2', 'folder-app', 'z-loose', 'z-member']
    });
    assert.deepEqual(actual.order, ['z-member', 'folder-app', 'z-loose', 'new-2']);
});

test('startup preview follows native folder slots, child order and promoted pins', () => {
    const folders = {
        solo: { name: 'Solo', containers: ['solo-member', 'overlap'] },
        parent: { name: 'Parent', containers: ['parent-member'], settings: { child_folder_order: ['childB', 'childA'] } },
        childA: { name: 'Child A', parentId: 'parent', containers: ['a-member', 'overlap'] },
        childB: { name: 'Child B', parentId: 'parent', containers: ['b-member'] },
        new: { name: 'Unslotted', containers: ['new-member'], membershipPolicy: 'folderview3' }
    };
    const native = ['loose-saved', 'folder-solo', 'folder-childA', 'folder-parent', 'folder-childB', 'folder-obsolete'];
    const names = ['overlap', 'a-member', 'b-member', 'solo-member', 'parent-member', 'new-member', 'loose-saved', 'aaa-new-loose'];
    const created = phpOrder({ folders, native, names, prefs: { sortMode: 'created' } });
    assert.deepEqual(created.order, [
        'new-member', 'solo-member', 'overlap', 'parent-member', 'b-member', 'a-member', 'loose-saved', 'aaa-new-loose'
    ]);
    const pinned = phpOrder({ folders, native, names, prefs: { sortMode: 'created', pinnedFolderIds: ['childA'] } });
    assert.deepEqual(pinned.order, [
        'parent-member', 'b-member', 'a-member', 'overlap', 'solo-member', 'new-member', 'loose-saved', 'aaa-new-loose'
    ]);
});

test('browser and PHP timestamp sorts keep undated entries last with stable ties', () => {
    const folders = {
        older: { name: 'Older', createdAt: '2026-04-01', updatedAt: '2026-05-01 12:00:00.020' },
        missing: { name: 'Missing' },
        newer: { name: 'Newer', createdAt: '2026-04-02T12:00:00.020Z', updatedAt: '2026-05-01T12:00:00.012+00:00' },
        invalid: { name: 'Invalid', createdAt: 'tomorrow', updatedAt: '2026-02-30T00:00:00Z' },
        same: { name: 'Same', createdAt: '2026-04-02T13:00:00.020+01:00', updatedAt: '2026-05-01T12:00:00.012000Z' },
        earlierMs: { name: 'Earlier ms', createdAt: '2026-04-02T12:00:00.003Z' }
    };
    for (const [sortMode, expected] of [
        ['created_newest', ['newer', 'same', 'earlierMs', 'older', 'missing', 'invalid']],
        ['created_oldest', ['older', 'earlierMs', 'newer', 'same', 'missing', 'invalid']],
        ['updated_newest', ['older', 'newer', 'same', 'missing', 'invalid', 'earlierMs']]
    ]) {
        const prefs = { sortMode };
        assert.deepEqual(Object.keys(utils.orderFoldersByPrefs(folders, prefs)), expected);
        assert.deepEqual(phpOrder({ folders, prefs }), expected);
    }
});

test('docker read order response preserves mixed slots while applying folder sort order', () => {
    const readUserPrefsMatch = libPhp.match(/function readUserPrefs\(string \$type\) : string \{([\s\S]*?)\n    \}\n\n    function normalizeFolderMembers/);
    assert.ok(readUserPrefsMatch, 'readUserPrefs body should be present');
    const body = readUserPrefsMatch[1];
    assert.match(body, /\$orderedFolders = reorderFolderMapByPrefs\('docker', \$folders, \$prefs\);/);
    assert.match(body, /\$order = composeDockerSavedOrder\(\$order, \$orderedFolders, \$prefs\);/);
    assert.match(libPhp, /\$savedOrder = composeDockerSavedOrder\(\$currentOrder, \$orderedFolders, \$prefs, \$allContainerNames\);/);
});

test('docker order sync reads but does not write Docker userprefs', () => {
    const contextMatch = libPhp.match(/function buildDockerStartOrderContext\(\?array \$verifiedInventory = null\): array \{([\s\S]*?)\n    \}\n\n    function buildDockerPageStartOrder/);
    assert.ok(contextMatch, 'buildDockerStartOrderContext body should be present');
    const body = contextMatch[1];
    assert.match(body, /userprefs\.cfg is not written here; Unraid owns drag-order persistence\./);
    assert.match(body, /\$currentOrder = readDockerNativePageOrder\(\);/);
    assert.match(libPhp, /function readDockerNativePageOrder\(\): array \{[\s\S]*?is_file\(\$path\) \? @parse_ini_file\(\$path\) : false;/);
    assert.doesNotMatch(body, /file_put_contents\(\$prefsFile/);
    assert.doesNotMatch(body, /wrote userprefs\.cfg/);
});

test('Docker page startup expands saved mixed slots and leaves explicit custom and unmanaged modes alone', () => {
    const folders = {
        alpha: { name: 'Alpha', containers: ['alpha-member'] },
        child: { name: 'Child', parentId: 'alpha', containers: ['child-member'] },
        beta: { name: 'Beta', containers: ['beta-member'] }
    };
    const native = ['folder-alpha', 'loose', 'folder-child', 'folder-beta'];
    const names = ['beta-member', 'loose', 'alpha-member', 'child-member', 'new'];
    const prefs = { sortMode: 'created', dockerRowPlacement: 'saved-order' };
    const input = { folders, native, names, prefs };
    const mixed = phpOrder(input);
    assert.deepEqual(mixed.order, ['alpha-member', 'child-member', 'loose', 'beta-member', 'new']);
    assert.deepEqual(mixed.autostartOrder, mixed.order);
    assert.deepEqual(mixed.sequence.map(({ name }) => name), mixed.order);
    assert.deepEqual(phpOrder({ ...input, prefs: { ...prefs, groupUnassignedItems: true } }).order,
        ['alpha-member', 'child-member', 'beta-member', 'loose', 'new']);
    assert.deepEqual(phpOrder({ ...input, startOrder: { mode: 'unmanaged' } }).order, names);
    const custom = { mode: 'custom-batches', remaining: 'after', batches: [] };
    assert.deepEqual(phpOrder({ ...input, startOrder: custom }).order,
        phpOrder({ ...input, prefs: { ...prefs, dockerRowPlacement: 'folders-first' }, startOrder: custom }).order);
});

test('PHP saved order preserves a native container name colliding with a sorted folder slot', () => {
    const folders = { alpha: { name: 'Alpha', containers: ['one'] }, beta: { name: 'Beta', containers: ['two'] } };
    const names = ['one', 'two', 'loose', 'folder-alpha'];
    const native = ['loose', 'folder-alpha', 'folder-beta'];
    const plan = phpOrder({ folders, names, native, prefs: { sortMode: 'alpha', dockerRowPlacement: 'saved-order' } });
    assert.deepEqual(plan.savedOrder, native);
    assert.deepEqual(plan.order, ['one', 'loose', 'folder-alpha', 'two']);
});

test('Docker startup places unsaved containers last in the same relative order as native host rows', () => {
    const input = {
        folders: { apps: { name: 'Apps', containers: ['member'] } },
        prefs: { dockerRowPlacement: 'saved-order' },
        native: ['folder-apps', 'standalone'],
        names: ['aaa', 'zzz', 'member', 'standalone'],
        nativeRows: [
            { Image: 'z-image', Name: 'aaa' },
            { Image: 'a-image', Name: 'zzz' },
            { Image: 'app', Name: 'member' },
            { Image: 'front', Name: 'standalone' }
        ]
    };
    const existingNativeFile = phpOrder({ ...input, hasNativeOrderFile: true });
    assert.deepEqual(existingNativeFile.order, ['member', 'standalone', 'zzz', 'aaa']);
    assert.deepEqual(existingNativeFile.autostartOrder, existingNativeFile.order);
    const nativeFallback = phpOrder({ ...input, native: [] });
    assert.deepEqual(nativeFallback.order, ['member', 'aaa', 'zzz', 'standalone']);
});
