import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const source = fs.readFileSync(path.join(process.cwd(),
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js'), 'utf8');
const applySource = source.slice(source.indexOf('const applyTreeMoveHistoryEntry ='), source.indexOf('const applyTreeMoveUndo ='));

const createHarness = () => {
    let folders = { first: { name: 'First', parentId: 'second' }, second: { name: 'Second', parentId: '' } };
    const prefsByType = { docker: { sortMode: 'manual', manualOrder: ['second', 'first'], _metadata: { folderRevision: 5, prefsRevision: 8 } } };
    const calls = [];
    const context = {
        normalizeManagedType: value => value,
        prefsByType,
        utils: { normalizePrefs: value => ({ ...value }) },
        getFolderMap: () => folders,
        setTypeFolders: (_type, value) => { folders = value; },
        readFolderConfigurationRevision: () => prefsByType.docker._metadata.folderRevision,
        applyOptimisticManualOrder: (_type, order) => { prefsByType.docker.manualOrder = order; calls.push('optimistic-order'); },
        renderTable: () => calls.push('render'),
        requestFolderBatchMutation: async (_type, operations, options) => {
            calls.push({ operations, options, parentAtRequest: folders.first.parentId });
            return { metadata: { folderRevision: 6, prefsRevision: 9 } };
        },
        persistManualOrder: async (_type, order) => calls.push({ order: Array.from(order) }),
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
    assert.equal(harness.prefs()._metadata.folderRevision, 6);
    assert.equal(harness.calls.at(-1).refresh.configOnly, true);
    assert.equal(harness.calls.at(-1).refresh.render, false);
});

test('reorder Undo persists the previous order without restoring a backup', async () => {
    const harness = createHarness();
    await harness.apply('docker', {
        kind: 'order', beforeOrder: ['first', 'second'], afterOrder: ['second', 'first']
    }, 'undo');
    assert.deepEqual(harness.calls.find(call => call.order), { order: ['first', 'second'] });
    assert.equal(harness.calls.some(call => call.operations), false);
    assert.equal(harness.calls.at(-1).refresh.configOnly, true);
    assert.equal(harness.calls.at(-1).refresh.render, false);
});
