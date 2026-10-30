import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const scripts = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts');
const utils = require(path.join(scripts, 'folderviewplus.utils.js'));
const store = require(path.join(scripts, 'folderviewplus.prefs-store.js'));
const source = fs.readFileSync(path.join(scripts, 'docker.js'), 'utf8');
const extract = (name, next) => {
    const start = source.indexOf(`const ${name} =`), end = source.indexOf(`const ${next} =`, start);
    assert.ok(start >= 0 && end > start); return source.slice(start, end);
};
const plain = value => JSON.parse(JSON.stringify(value));
const rawFolder = () => ({ name: 'Branch', parentId: 'parent', containers: [], regex: '^automatic', settings: {}, actions: [] });
const createPersistFixture = ({ snapshotRevision = 7, prefsRevision = 4, response, failure } = {}) => {
    const initialPrefs = utils.normalizePrefs({ sortMode: 'alpha', dashboard: { layout: 'accordion' }, _metadata: { prefsRevision: 4 } });
    const coordinator = store.createPreferenceSaveCoordinator({ normalizePrefs: utils.normalizePrefs, window: {} });
    coordinator.reconcile('docker', initialPrefs);
    const snapshot = { folders: { branch: rawFolder() }, prefs: initialPrefs, revisions: { folder: snapshotRevision, prefs: prefsRevision } };
    const posts = [], remembered = [];
    const sandbox = { utils, folderTypePrefs: initialPrefs, dockerPrefsCoordinator: coordinator,
        lastDockerRuntimeSnapshotRevisions: { folder: 7, prefs: 4 }, dockerT: (_key, fallback) => fallback,
        runtimeSnapshotApi: { buildUrl: (_type, mode) => '/fixture?mode=' + mode, parsePayload: value => value },
        pluginRequestClient: { getJson: async (url, options) => { assert.match(url, /mode=config/); assert.equal(options.cache, false); return snapshot; },
            postJson: async (url, payload, options) => { posts.push({ url, payload, options }); if (failure) throw failure;
                return response || { ok: true, result: { metadata: { folderRevision: 8, prefsRevision: 5 } } }; } },
        rememberDockerRuntimeSnapshot: value => remembered.push(value) };
    const persist = vm.runInNewContext(extract('persistDockerFolderHierarchyMove', 'applyDockerFolderMenuOrderToDom') + '\npersistDockerFolderHierarchyMove', sandbox);
    return { persist, posts, remembered, coordinator, snapshot };
};

test('Docker hierarchy persistence submits raw saved membership and parent/order in one revision-checked batch', async () => {
    const fixture = createPersistFixture();
    const order = ['parent', 'branch', 'leaf'];
    const result = await fixture.persist('branch', '', order);
    assert.equal(fixture.posts.length, 1);
    const request = fixture.posts[0], operations = JSON.parse(request.payload.operations);
    assert.match(request.url, /\/server\/batch\.php$/); assert.equal(request.options.retries, 0);
    assert.equal(request.payload.expectedRevision, 7); assert.equal(operations.expectedPrefsRevision, 4);
    assert.deepEqual(operations.manualOrder, order);
    assert.deepEqual(operations.upserts, [{ id: 'branch', folder: { ...rawFolder(), parentId: '' } }]);
    assert.deepEqual(operations.upserts[0].folder.containers, [], 'live automatic members must never become manual assignments');
    assert.equal(fixture.snapshot.folders.branch.parentId, 'parent', 'the read snapshot remains owned by its caller');
    assert.equal(result.prefs.sortMode, 'manual'); assert.equal(result.prefs.dashboard.layout, 'accordion');
    assert.equal(fixture.coordinator.getSnapshot('docker').revision, 5);
    assert.deepEqual(plain(fixture.remembered[0].revisions), { folder: 8, prefs: 5 });
});

test('Docker hierarchy persistence rejects preexisting folder or preference drift without posting or publication', async () => {
    for (const settings of [{ snapshotRevision: 8 }, { prefsRevision: 5 }]) {
        const fixture = createPersistFixture(settings);
        await assert.rejects(fixture.persist('branch', '', ['branch']), error => error.status === 409);
        assert.equal(fixture.posts.length, 0); assert.equal(fixture.remembered.length, 0);
        assert.equal(fixture.coordinator.getSnapshot('docker').revision, 4);
    }
});

test('Docker hierarchy persistence retains confirmed preferences after a rejected atomic batch', async () => {
    const failure = Object.assign(new Error('Synthetic revision conflict'), { status: 409 });
    const fixture = createPersistFixture({ failure });
    const before = plain(fixture.coordinator.getOptimisticPrefs('docker'));
    await assert.rejects(fixture.persist('branch', '', ['branch']), error => error === failure);
    assert.equal(fixture.posts.length, 1); assert.equal(fixture.remembered.length, 0);
    assert.deepEqual(plain(fixture.coordinator.getOptimisticPrefs('docker')), before);
    assert.equal(fixture.snapshot.folders.branch.parentId, 'parent');
});

const createMoveFixture = ({ rejectFlush = false, rejectMove = false } = {}) => {
    const folders = { parent: { name: 'Parent', containers: [] }, branch: rawFolder(),
        leaf: { name: 'Leaf', parentId: 'branch', containers: [] }, other: { name: 'Other', containers: [] } };
    const prefs = utils.normalizePrefs({ sortMode: 'alpha', pageTitle: { enabled: false } });
    const currentPrefs = utils.normalizePrefs({ sortMode: 'alpha', pageTitle: { enabled: true }, _metadata: { prefsRevision: 10 } });
    let releaseFlush; const gate = new Promise(resolve => { releaseFlush = resolve; });
    const events = [], applied = [], orders = [], hierarchies = [], persisted = [], refreshes = [];
    const sandbox = { utils, normalizeFolderParentId: value => String(value || ''), ensureDockerFolderUnlocked: () => true,
        dockerSafeUiActionRunner: { run: (_name, action) => action() },
        dockerPrefsCoordinator: { flush: async () => { events.push('flush'); await gate; if (rejectFlush) throw new Error('Flush failed'); }, getOptimisticPrefs: () => currentPrefs },
        buildDockerFolderRuntimeOrderState: () => ({ folders, fullOrder: ['parent', 'branch', 'leaf', 'other'],
            parentById: { branch: 'parent', leaf: 'branch' }, collectDescendants: id => id === 'branch' ? ['leaf'] : [] }),
        normalizeDockerManualFolderOrder: order => order, $: () => ({ attr: () => 'true' }),
        applyRuntimePrefs: value => applied.push(plain(value)), applyDockerFolderMenuOrderToDom: order => orders.push(plain(order)),
        applyNestedFolderHierarchy: ids => hierarchies.push(plain(ids)), queueLoadlistRefresh: options => refreshes.push(options),
        persistDockerFolderHierarchyMove: async (...args) => { persisted.push(plain(args)); if (rejectMove) throw Object.assign(new Error('Batch failed'), { status: 409 });
            return { prefs: utils.normalizePrefs({ sortMode: 'manual', manualOrder: args[2], _metadata: { prefsRevision: 11 } }) }; },
        fixtureFolders: folders, fixturePrefs: prefs };
    const context = vm.createContext(sandbox);
    const api = vm.runInContext('let globalFolders = fixtureFolders, folderTypePrefs = fixturePrefs;\n'
        + extract('applyDockerFolderHierarchyMoveFromMenu', 'moveDockerFolderUnderFromMenu')
        + '\n({run:applyDockerFolderHierarchyMoveFromMenu,state:()=>({folders:globalFolders,prefs:folderTypePrefs})})', context);
    return { api, releaseFlush, events, applied, orders, hierarchies, persisted, refreshes };
};

test('Docker hierarchy moves await pending preferences before optimism and publish parent/order together', async () => {
    const fixture = createMoveFixture();
    const pending = fixture.api.run('branch', '');
    assert.deepEqual(fixture.events, ['flush']); assert.equal(fixture.applied.length, 0);
    assert.equal(fixture.api.state().folders.branch.parentId, 'parent');
    fixture.releaseFlush(); await pending;
    assert.deepEqual(fixture.persisted, [['branch', '', ['parent', 'other', 'branch', 'leaf']]]);
    assert.equal(fixture.api.state().folders.branch.parentId, '');
    assert.equal(fixture.api.state().prefs.sortMode, 'manual');
    assert.equal(fixture.hierarchies.length, 1); assert.equal(fixture.refreshes.length, 0);
});

test('a rejected hierarchy batch restores the tree and preserves newer coordinator preferences', async () => {
    const fixture = createMoveFixture({ rejectMove: true });
    const pending = fixture.api.run('branch', ''); fixture.releaseFlush();
    await assert.rejects(pending, /Batch failed/);
    assert.equal(fixture.api.state().folders.branch.parentId, 'parent');
    assert.equal(fixture.api.state().prefs.pageTitle.enabled, true, 'an unrelated newer confirmed preference is preserved');
    assert.equal(fixture.api.state().prefs._metadata.prefsRevision, 10);
    assert.deepEqual(fixture.orders.at(-1), ['parent', 'branch', 'leaf', 'other']);
    assert.equal(fixture.hierarchies.length, 2); assert.equal(fixture.refreshes.length, 1);
});

test('a failed preference flush stops the hierarchy move before any optimistic or persistent change', async () => {
    const fixture = createMoveFixture({ rejectFlush: true });
    const pending = fixture.api.run('branch', ''); fixture.releaseFlush();
    await assert.rejects(pending, /Flush failed/);
    assert.equal(fixture.api.state().folders.branch.parentId, 'parent');
    assert.equal(fixture.applied.length, 0); assert.equal(fixture.persisted.length, 0);
});
