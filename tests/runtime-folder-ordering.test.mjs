import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

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
