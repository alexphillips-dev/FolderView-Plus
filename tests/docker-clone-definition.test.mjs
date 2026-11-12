import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createApi } = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.actions.js');
const transferModule = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.settings-transfer.js');
const transferSchema = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/schemas/folder-settings-transfer.schema.json');
const hierarchyModule = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.hierarchy.js');

function fixture({ failRead = false, lockedChild = false, collision = false } = {}) {
    const saved = {
        root: { name: 'Saved root', parentId: '', containers: ['explicit', 'offline'], regex: '^rule-',
            memberIdentities: { offline: { kind: 'docker', containerId: 'fixture-offline' } },
            hiddenPreviewMembers: ['offline'], rules: [{ field: 'image', value: 'fixture' }],
            settings: { preview: 2 }, actions: [{ name: 'Fixture action' }], createdAt: 'old', updatedAt: 'old' },
        child: { name: 'Saved child', parentId: 'root', containers: ['child-offline'], settings: {} },
        unrelated: { name: 'Other', parentId: '', containers: [] }
    };
    const live = {
        root: { ...saved.root, name: 'Stale runtime root', containers: { explicit: {}, 'rule-derived': {} },
            status: { started: 2 }, runtimeContainers: { 'rule-derived': {} } },
        child: { ...saved.child, parentId: '', containers: {} },
        unrelated: { ...saved.unrelated, parentId: 'root' }
    };
    const writes = [], errors = [], reads = [];
    let nextId = 0;
    const api = createApi({
        window: { prompt: () => 'Copied root' },
        $: () => ({ show() {}, hide() {} }),
        swal() {}, getGlobalFolders: () => live,
        folderSettingsTransfer: transferModule.createApi({ schema: transferSchema }),
        getFolderChildren: id => Object.keys(live).filter(key => live[key].parentId === id),
        getFolderDescendants: () => ['unrelated'],
        isDockerFolderLocked: id => lockedChild && id === 'child',
        ensureDockerFolderUnlocked: () => true,
        requestClient: {
            getJson: async url => { reads.push(url); if (failRead) throw new Error('Fixture read failed'); return structuredClone(saved); },
            postJson: async (url, payload) => { writes.push({ url, payload }); return { ok: true }; }
        },
        generateDockerFolderCloneId: () => collision ? 'unrelated' : `copy${++nextId}`,
        persistDockerFolderClonePayload: async (payload, id = '') => writes.push({ id, payload }),
        runDockerGuardedAction: async (_name, action) => {
            try { await action(); return { ok: true }; } catch (error) { errors.push(error.message); return { ok: false }; }
        }
    });
    return { api, saved, live, writes, errors, reads };
}

test('Docker clone uses persisted explicit and offline members, identity and rule configuration', async () => {
    const f = fixture();
    await f.api.cloneDockerFolderFromMenu('root');
    const clone = f.writes.find(write => write.id === '').payload;
    assert.deepEqual(clone.containers, ['explicit', 'offline']);
    assert.deepEqual(clone.memberIdentities, f.saved.root.memberIdentities);
    assert.deepEqual(clone.hiddenPreviewMembers, ['offline']);
    assert.deepEqual(clone.rules, f.saved.root.rules);
    assert.deepEqual(clone.actions, f.saved.root.actions);
    assert.equal(clone.name, 'Copied root');
    assert.equal(clone.regex, '^rule-');
    assert.equal(clone.createdAt, undefined);
    assert.equal(clone.status, undefined);
    assert.equal(clone.runtimeContainers, undefined);
    assert.equal(f.reads.length, 1);
    assert.deepEqual(f.live.root.containers, { explicit: {}, 'rule-derived': {} });
});

test('Docker branch cloning derives all descendants from one persisted snapshot despite runtime hierarchy drift', async () => {
    const f = fixture();
    await f.api.cloneDockerFolderBranchFromMenu('root');
    const clones = f.writes.filter(write => write.id);
    assert.equal(clones.length, 2);
    assert.deepEqual(clones[0].payload.containers, ['explicit', 'offline']);
    assert.deepEqual(clones[1].payload.containers, ['child-offline']);
    assert.equal(clones[1].payload.parentId, clones[0].id);
    assert.equal(clones[1].payload.name, 'Saved child');
    assert.equal(f.reads.length, 1);
});

test('Docker branch cloning remaps saved child order to the cloned sibling identifiers', async () => {
    const f = fixture();
    f.saved.second = { name: 'Second child', parentId: 'root', containers: [], settings: {} };
    f.saved.root.settings.child_folder_order = ['second', 'child'];
    f.saved.root.settings.childFolderOrder = ['second', 'child'];
    await f.api.cloneDockerFolderBranchFromMenu('root');
    const clones = f.writes.filter(write => write.id);
    const folders = Object.fromEntries(clones.map(write => [write.id, write.payload]));
    const rootId = clones[0].id;
    const childIds = clones.slice(1).map(write => write.id);
    const hierarchy = hierarchyModule.createApi({
        getGlobalFolders: () => folders,
        getDockerFolderHierarchy: () => ({ childrenById: { [rootId]: childIds } })
    });
    assert.deepEqual(hierarchy.getFolderChildren(rootId), [...childIds].reverse());
    assert.deepEqual(folders[rootId].settings.child_folder_order, [...childIds].reverse());
    assert.deepEqual(folders[rootId].settings.childFolderOrder, [...childIds].reverse());
    assert.deepEqual(f.saved.root.settings.child_folder_order, ['second', 'child']);
});

for (const method of ['cloneDockerFolderFromMenu', 'cloneDockerFolderBranchFromMenu']) {
    test(`${method} read failure creates nothing`, async () => {
        const f = fixture({ failRead: true });
        await f.api[method]('root');
        assert.deepEqual(f.writes, []);
        assert.equal(f.errors.length, 1);
    });
}

test('Docker branch clone preflight rejects known ID collisions before any mutation', async () => {
    const f = fixture({ collision: true });
    await f.api.cloneDockerFolderBranchFromMenu('root');
    assert.deepEqual(f.writes, []);
    assert.equal(f.errors.length, 1);
});

test('Docker branch clone respects a locked persisted descendant absent from runtime ancestry', async () => {
    const f = fixture({ lockedChild: true });
    await f.api.cloneDockerFolderBranchFromMenu('root');
    assert.deepEqual(f.writes, []);
});

test('settings-only cloning still excludes members, identity, rules, and actions', async () => {
    const f = fixture();
    await f.api.cloneDockerFolderSettingsOnlyFromMenu('root');
    const clone = f.writes.find(write => write.id === '').payload;
    assert.deepEqual(clone.containers, []);
    assert.deepEqual(clone.actions, []);
    assert.equal(clone.regex, '');
    assert.equal(clone.memberIdentities, undefined);
    assert.equal(clone.hiddenPreviewMembers, undefined);
    assert.equal(clone.rules, undefined);
    assert.deepEqual(clone.settings, { preview: 2 });
});
