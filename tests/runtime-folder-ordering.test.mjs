import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const scripts = path.join(process.cwd(), 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts');
const ordering = require(path.join(scripts, 'runtime.folder-ordering.js'));
const utils = require(path.join(scripts, 'folderviewplus.utils.js'));

test('shared folder ordering retains completed/current folders and non-folder members', () => {
    const result = ordering.buildCustomOrder({
        order: ['alpha', 'folder-one', 'beta', 'folder-two', 'folder-three'],
        completedFolderIds: ['one'],
        currentFolderId: 'three'
    });
    assert.deepEqual(result, ['alpha', 'folder-one', 'beta', 'folder-three']);
});

test('order cursor removal is stable and never removes the last item for an unknown member', () => {
    const cursor = ordering.createOrderCursor({ order: ['alpha', 'beta', 'gamma'] });
    assert.equal(cursor.indexOf('beta'), 1);
    assert.equal(cursor.remove('missing'), -1);
    assert.deepEqual(cursor.snapshot(), ['alpha', 'beta', 'gamma']);
    assert.equal(cursor.remove('beta'), 1);
    assert.deepEqual(cursor.snapshot(), ['alpha', 'gamma']);
    cursor.destroy();
    assert.equal(cursor.indexOf('alpha'), -1);
    assert.deepEqual(cursor.snapshot(), []);
});

test('numeric folder IDs preserve manual, alphabetical and pinned branch order through runtime slots', () => {
    const folders = { '0': { name: 'Zulu' }, '1': { name: 'Alpha' }, '2': { name: 'Bravo' } };
    const mixed = ['host-first', 'folder-0', 'host-second', 'folder-1', 'folder-2'];
    for (const [prefs, expected] of [
        [{ sortMode: 'manual', manualOrder: ['2', '1', '0'] }, ['2', '1', '0']],
        [{ sortMode: 'alpha' }, ['1', '2', '0']],
        [{ pinnedFolderIds: ['2'] }, ['2', '0', '1']]
    ]) {
        assert.deepEqual(utils.orderFolderIdsByPrefs(folders, prefs), expected);
        assert.deepEqual(utils.orderFolderEntriesByPrefs(folders, prefs).map(([id]) => id), expected);
        const slots = ordering.reorderFolderSlotsInBaseOrder(mixed, folders, prefs, { orderFolders: utils.orderFolderIdsByPrefs });
        assert.deepEqual(slots, ['host-first', `folder-${expected[0]}`, 'host-second', `folder-${expected[1]}`, `folder-${expected[2]}`]);
    }
    const nested = { ...folders, '2': { name: 'Bravo', parentId: '1' } };
    const pinnedBranch = utils.orderFolderIdsByPrefs(nested, { pinnedFolderIds: ['2'] });
    assert.deepEqual(pinnedBranch, ['1', '2', '0']);
    assert.deepEqual(utils.buildFolderHierarchyModel(nested, { orderedIds: pinnedBranch }).orderedIds, pinnedBranch);
});

test('explicit child order moves whole nested branches across existing slots', () => {
    const folders = {
        parent: { settings: { child_folder_order: ['beta', 'missing', 'beta'] } },
        alpha: { parentId: 'parent' }, grand: { parentId: 'alpha' },
        beta: { parentId: 'parent', settings: { childFolderOrder: [0] } },
        gamma: { parentId: 'beta' }, '0': { parentId: 'beta' }, another: {}
    };
    const order = ['parent', 'alpha', 'grand', 'another', 'beta', 'gamma', '0'];
    const { orderChildFolderIds } = require(path.join(scripts, 'folderviewplus.utils-ordering.js'));
    const source = fs.readFileSync(path.join(scripts, 'vm.js'), 'utf8');
    const slotOrderSource = source.match(/^const orderVmNestedFolderSlots = [\s\S]*?^};/m)?.[0];
    assert.ok(slotOrderSource);
    const orderVmNestedFolderSlots = vm.runInNewContext(slotOrderSource + '\norderVmNestedFolderSlots;', { utils, orderChildFolderIds });
    assert.deepEqual(Array.from(orderVmNestedFolderSlots(order, folders)),
        ['parent', 'beta', '0', 'another', 'gamma', 'alpha', 'grand']);
    assert.deepEqual(orderChildFolderIds(['gamma', '0'], folders.beta), ['0', 'gamma']);
    const unchanged = Object.fromEntries(Object.entries(folders).map(([id, folder]) => [id, { ...folder, settings: {} }]));
    assert.equal(orderVmNestedFolderSlots(order, unchanged), order);
});
