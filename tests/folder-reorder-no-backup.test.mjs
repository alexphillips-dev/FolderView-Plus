import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const source = fs.readFileSync(path.join(process.cwd(),
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.settings-tree.js'), 'utf8');
const stateSource = source.slice(source.indexOf('const FOLDER_REORDER_PERSIST_IDLE_MS ='), source.indexOf('const normalizeTreeMovePlacement ='));
const queueSource = source.slice(source.indexOf('const clearFolderReorderFlushTimer ='), source.indexOf('const findLastMatchingOrderIndex ='));

test('rapid folder reorders coalesce into one save and one in-memory undo entry', async () => {
    const prefsByType = { docker: { sortMode: 'manual', manualOrder: ['first', 'second', 'third'] } };
    const persisted = [];
    const history = [];
    const context = {
        window: { setTimeout: () => 1, clearTimeout: () => {} },
        normalizeManagedType: value => value,
        prefsByType,
        utils: { normalizePrefs: value => ({ ...value }) },
        sanitizeManualOrderList: (_type, order) => Array.from(order),
        persistManualOrder: async (_type, order) => persisted.push(Array.from(order)),
        pushTreeMoveHistoryEntry: (_type, entry) => history.push(entry),
        addActivityEntry: () => {},
        renderTable: () => {},
        refreshType: async () => {},
        setFolderTreeMoveError: () => {},
        showError: () => {}
    };
    vm.runInNewContext(`${stateSource}\n${queueSource}\nglobalThis.queue = queueFolderReorderPersist; globalThis.flush = flushQueuedFolderReorderPersist;`, context);
    context.queue('docker', { order: ['second', 'first', 'third'], previousPrefs: prefsByType.docker,
        previousOrder: ['first', 'second', 'third'], focusFolderId: 'first', changedFolderId: 'first' });
    context.queue('docker', { order: ['second', 'third', 'first'], previousPrefs: prefsByType.docker,
        previousOrder: ['second', 'first', 'third'], focusFolderId: 'first', changedFolderId: 'first' });
    await context.flush('docker');
    assert.deepEqual(persisted, [['second', 'third', 'first']]);
    assert.equal(history.length, 1);
    assert.equal(history[0].kind, 'order');
    assert.deepEqual(Array.from(history[0].beforeOrder), ['first', 'second', 'third']);
    assert.deepEqual(Array.from(history[0].afterOrder), ['second', 'third', 'first']);
});
