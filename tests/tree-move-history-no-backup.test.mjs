import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const source = fs.readFileSync(path.join(process.cwd(),
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js'), 'utf8');
const applySource = source.slice(source.indexOf('const applyTreeMoveHistoryEntry ='), source.indexOf('const applyTreeMoveUndo ='));

const createHarness = () => {
    const folders = { first: { name: 'First', parentId: 'second' }, second: { name: 'Second', parentId: '' } };
    const optimisticFoldersByType = { docker: null };
    const prefsByType = { docker: { sortMode: 'manual', manualOrder: ['second', 'first'], _metadata: { folderRevision: 5, prefsRevision: 8 } } };
    const calls = [];
    const context = {
        normalizeManagedType: value => value,
        prefsByType,
        utils: { normalizePrefs: value => ({ ...value }) },
        fetchSettingsCoreSnapshot: async () => ({ folders, folderRevision: 5, prefs: prefsByType.docker }),
        optimisticFoldersByType,
        buildFolderHierarchyMeta: () => ({ descendantsById: {} }),
        surfaceT: (_key, fallback) => fallback,
        applyOptimisticManualOrder: (_type, order) => { prefsByType.docker.manualOrder = order; calls.push('optimistic-order'); },
        renderTable: () => calls.push('render'),
        requestFolderBatchMutation: async (_type, operations, options) => {
            calls.push({ operations, options, parentAtRequest: optimisticFoldersByType.docker.first.parentId });
            return { metadata: { folderRevision: 6, prefsRevision: 9 } };
        },
        persistManualOrder: async (_type, order, options) => calls.push({ order: Array.from(order), options }),
        refreshType: async (_type, options) => calls.push({ refresh: options })
    };
    vm.runInNewContext(`${applySource}\nglobalThis.applyChange = applyTreeMoveHistoryEntry;`, context);
    return { apply: context.applyChange, calls, folders: () => folders, prefs: () => prefsByType.docker };
};

test('tree move Undo changes only the moved parent and order in a guarded batch', async () => {
    const harness = createHarness();
    await harness.apply('docker', {
        kind: 'parent', folderId: 'first', beforeParentId: '', afterParentId: 'second',
        beforeOrder: ['first', 'second'], afterOrder: ['second', 'first']
    }, 'undo');
    const mutation = harness.calls.find(call => call.operations);
    assert.equal(mutation.parentAtRequest, '');
    assert.equal(mutation.operations.upserts[0].folder.parentId, '');
    assert.deepEqual(Array.from(mutation.operations.manualOrder), ['first', 'second']);
    assert.equal(mutation.options.expectedRevision, 5);
    assert.equal(mutation.operations.expectedPrefsRevision, 8);
    assert.equal(harness.calls.at(-1).refresh.configOnly, true);
    assert.equal(harness.calls.at(-1).refresh.render, false);
});

test('reorder Undo persists the previous order without restoring a backup', async () => {
    const harness = createHarness();
    await harness.apply('docker', {
        kind: 'order', beforeOrder: ['first', 'second'], afterOrder: ['second', 'first']
    }, 'undo');
    const persisted = harness.calls.find(call => call.order);
    assert.deepEqual(persisted.order, ['first', 'second']);
    assert.equal(persisted.options.expectedRevision, 5);
    assert.equal(persisted.options.expectedPrefsRevision, 8);
    assert.equal(harness.calls.some(call => call.operations), false);
    assert.equal(harness.calls.at(-1).refresh.configOnly, true);
    assert.equal(harness.calls.at(-1).refresh.render, false);
});

test('tree Undo and Redo fail before a write when the committed parent no longer matches history', async () => {
    for (const direction of ['undo', 'redo']) {
        const harness = createHarness();
        harness.folders().first.parentId = 'peer-parent';
        await assert.rejects(harness.apply('docker', {
            kind: 'parent', folderId: 'first', beforeParentId: '', afterParentId: 'second'
        }, direction), /Folder configuration changed/);
        assert.deepEqual(harness.calls, []);
    }
});

test('history replay preserves a peer change to order and accepts unrelated folder edits', async () => {
    const harness = createHarness();
    const entry = { kind: 'order', beforeOrder: ['first', 'second'], afterOrder: ['second', 'first'] };
    harness.prefs().manualOrder = ['first', 'second'];
    await assert.rejects(harness.apply('docker', entry, 'undo'), /Folder configuration changed/);
    assert.deepEqual(harness.calls, []);
    harness.folders().first.name = 'Renamed by another tab';
    harness.prefs().manualOrder = ['second', 'first'];
    await harness.apply('docker', { ...entry, kind: 'parent', folderId: 'first', beforeParentId: '', afterParentId: 'second' }, 'undo');
    assert.equal(harness.calls.find(call => call.operations).operations.upserts[0].folder.name, 'Renamed by another tab');
});
