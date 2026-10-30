import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const scripts = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts');
const utils = require(path.join(scripts, 'folderviewplus.utils.js'));
const source = fs.readFileSync(path.join(scripts, 'docker.js'), 'utf8');
const begin = source.indexOf('const buildDockerFolderRuntimeOrderState =');
const end = source.indexOf('const normalizeDockerManualFolderOrder =', begin);
const readState = (folders, order) => vm.runInNewContext(source.slice(begin, end) + '\nbuildDockerFolderRuntimeOrderState()', {
    utils, globalFolders: folders, folderTypePrefs: { sortMode: 'manual', manualOrder: order },
    normalizeFolderParentId: value => String(value || '').trim(), getPrefsOrderedFolderMap: () => Object.fromEntries(order.map(id => [id, folders[id]]))
});
const plain = value => JSON.parse(JSON.stringify(value));

test('Docker menu hierarchy keeps sibling order while using the shared parent graph', () => {
    const folders = { parent: { name: 'Parent' }, first: { name: 'First', parentId: 'parent' },
        second: { name: 'Second', parentId: 'parent' }, grandchild: { name: 'Grandchild', parentId: 'second' },
        legacy: { name: 'Legacy', parent_id: 'parent' }, orphan: { name: 'Orphan', parentId: 'gone' }, self: { name: 'Self', parentId: 'self' } };
    const order = ['parent', 'second', 'grandchild', 'legacy', 'first', 'orphan', 'self'];
    const state = readState(folders, order);
    assert.deepEqual(plain(state.fullOrder), order);
    assert.deepEqual(plain(state.childrenById.parent), ['second', 'legacy', 'first']);
    assert.deepEqual(plain(state.collectDescendants('parent')), ['second', 'grandchild', 'legacy', 'first']);
    assert.equal(state.parentById.orphan, ''); assert.equal(state.parentById.self, '');
    assert.deepEqual(plain(state.collectDescendants('parent', new Set(['second']))), ['second', 'legacy', 'first']);
});

test('Docker menu hierarchy retains its existing circular-parent and descendant traversal behavior', () => {
    const state = readState({ A: { name: 'A', parentId: 'B' }, B: { name: 'B', parentId: 'A' } }, ['B', 'A']);
    assert.equal(state.parentById.A, 'B'); assert.equal(state.parentById.B, 'A');
    assert.deepEqual(plain(state.collectDescendants('A')), ['B', 'A']);
    assert.deepEqual(plain(state.collectDescendants('B')), ['A', 'B']);
    assert.deepEqual(plain(state.collectDescendants('A', new Set(['A']))), []);
});

test('Docker menu hierarchy retains numeric identities and omitted ordered IDs', () => {
    const folders = { root: { name: 'Root' }, '1': { name: 'One', parentId: 'root' }, '2': { name: 'Two', parentId: 'root' }, last: { name: 'Last', parentId: 'root' } };
    const state = readState(folders, ['root', '2', '1']);
    assert.deepEqual(plain(state.fullOrder), ['1', '2', 'root', 'last']);
    assert.deepEqual(plain(state.childrenById.root), ['1', '2', 'last']);
    assert.deepEqual(plain(state.collectDescendants('root')), ['1', '2', 'last']);
});
