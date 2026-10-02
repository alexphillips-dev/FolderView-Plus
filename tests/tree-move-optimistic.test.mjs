import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const treePath = path.join(process.cwd(), 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.folder-editor.js');
const source = fs.readFileSync(treePath, 'utf8');
const moveSource = source.slice(source.indexOf('const pendingTreeMoveTypes ='), source.indexOf('const applyFolderTreeMove ='));

const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};

const createHarness = ({ positionalMove = false } = {}) => {
    let folders = { first: { name: 'First', parentId: '' }, second: { name: 'Second', parentId: '' } };
    const prefsByType = { docker: { sortMode: 'created', manualOrder: ['first', 'second'], _metadata: { folderRevision: 4, prefsRevision: 7 } } };
    const mutation = deferred();
    const renders = [];
    const requests = [];
    const errors = [];
    const activities = [];
    const history = [];
    const focus = [];
    const refresh = [];
    const context = {
        prefsByType,
        utils: { normalizePrefs: (value) => ({ ...value }) },
        normalizeManagedType: (value) => value,
        readFolderConfigurationRevision: () => prefsByType.docker._metadata.folderRevision,
        typeFolders: () => folders,
        getFolderMap: () => folders,
        getOrderedFolderIdsForTreeOps: () => ['first', 'second'],
        setTypeFolders: (_type, value) => { folders = value; },
        setFolderTreeMoveError: (_type, _id, message) => errors.push(message),
        clearFolderTreeMoveError: () => {},
        applyOptimisticManualOrder: (_type, order) => {
            prefsByType.docker = { ...prefsByType.docker, sortMode: 'manual', manualOrder: order };
            context.renderTable();
        },
        renderTable: () => renders.push({ parentId: folders.first.parentId, sortMode: prefsByType.docker.sortMode }),
        focusFolderRow: (_type, _id, options) => focus.push(options),
        requestFolderBatchMutation: (...args) => { requests.push(args); return mutation.promise; },
        refreshType: async (...args) => { refresh.push(args); },
        pushTreeMoveHistoryEntry: (...args) => { history.push(args); },
        addActivityEntry: (message) => activities.push(message),
        showError: (_title, error) => errors.push(error.message),
        surfaceT: (_key, fallback) => fallback
    };
    vm.runInNewContext(`${moveSource}\nglobalThis.runMove = persistOptimisticTreeMove;`, context);
    const run = () => context.runMove('docker', {
        sourceId: 'first', sourceFolder: folders.first, nextParentId: 'second',
        nextOrder: ['second', 'first'], positionalMove, activityMessage: 'Moved first folder.'
    });
    return { run, mutation, renders, requests, errors, activities, history, focus, refresh,
        getFolders: () => folders, getPrefs: () => prefsByType.docker };
};

test('folder drop saves immediately without backups, redraws, or delayed scrolling', async () => {
    const harness = createHarness({ positionalMove: true });
    const move = harness.run();
    assert.equal(harness.getFolders().first.parentId, 'second');
    assert.equal(harness.getPrefs().sortMode, 'manual');
    assert.equal(harness.renders.length, 1);
    assert.equal(harness.requests.length, 1);
    assert.equal(harness.focus[0].scroll, false);
    await harness.run();
    assert.match(harness.errors[0], /Wait for the current folder move/);
    assert.deepEqual(Array.from(harness.requests[0][1].manualOrder), ['second', 'first']);
    assert.equal(harness.requests[0][1].expectedPrefsRevision, 7);
    harness.mutation.resolve({ metadata: { folderRevision: 5, prefsRevision: 8 } });
    await move;
    assert.equal(harness.getPrefs()._metadata.folderRevision, 5);
    assert.equal(harness.history.length, 1);
    assert.equal(harness.history[0][1].kind, 'parent');
    assert.equal(harness.history[0][1].beforeParentId, '');
    assert.equal(harness.history[0][1].afterParentId, 'second');
    assert.equal(harness.renders.length, 1);
    assert.equal(harness.refresh.length, 0);
    assert.equal(harness.focus.length, 1);
    assert.deepEqual(harness.activities, ['Moved first folder.']);
});

test('failed folder save restores the prior row and sort state', async () => {
    const harness = createHarness();
    const move = harness.run();
    assert.equal(harness.getFolders().first.parentId, 'second');
    assert.equal('manualOrder' in harness.requests[0][1], false);
    harness.mutation.reject(new Error('Revision conflict'));
    await move;
    assert.equal(harness.getFolders().first.parentId, '');
    assert.equal(harness.getPrefs().sortMode, 'created');
    assert.equal(harness.renders.at(-1).parentId, '');
    assert.equal(harness.activities.length, 0);
    assert.ok(harness.errors.some((message) => /Revision conflict/.test(message)));
});
