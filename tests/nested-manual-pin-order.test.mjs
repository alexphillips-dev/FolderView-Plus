import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const utils = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils.js');

for (const manualOrder of [
    ['other', 'parent', 'child', 'grandchild'],
    ['other', 'child', 'grandchild'],
    ['other', 'parent'],
    ['other', 'parent', 'parent', 'missing', 'child']
]) {
    test(`manual order promotes a pinned descendant without losing its branch (${manualOrder.join(',')})`, () => {
        const folders = {
            other: { name: 'Other' }, parent: { name: 'Parent' },
            child: { name: 'Child', parentId: 'parent' }, grandchild: { name: 'Grandchild', parentId: 'child' }
        };
        const original = structuredClone(folders);
        for (const pinnedFolderIds of [['child'], ['grandchild'], ['missing', 'child', 'parent']]) {
            const prefs = { sortMode: 'manual', manualOrder, pinnedFolderIds };
            const originalPrefs = structuredClone(prefs);
            assert.deepEqual(Object.keys(utils.orderFoldersByPrefs(folders, prefs)), ['parent', 'child', 'grandchild', 'other']);
            assert.deepEqual(folders, original, 'ordering must not change the source folder map');
            assert.deepEqual(prefs, originalPrefs, 'ordering must not change saved preference inputs');
        }
        assert.deepEqual(Object.keys(utils.orderFoldersByPrefs(folders, { sortMode: 'manual', manualOrder })),
            ['other', 'parent', 'child', 'grandchild'], 'unpinned manual order remains unchanged');
    });
}
