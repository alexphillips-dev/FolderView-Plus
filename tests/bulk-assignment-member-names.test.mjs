import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const shared = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.bulk-assignment.shared.js');
const settings = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.bulk-assignment.js');
const names = ['toString', 'constructor', '__proto__', 'hasOwnProperty', 'ordinary'];
const createLookup = (mode, folders) => {
    const deps = { getFolderMap: () => folders, utils: { normalizeFolderMap: value => value } };
    if (mode === 'shared') return shared.createApi(deps).getBulkMemberFolderLookup;
    let lookup;
    settings.createApi({ ...deps, window: { FolderViewPlusBulkAssignmentView: {
        createApi: dependencies => { lookup = dependencies.getBulkMemberFolderLookup; return null; }
    } } });
    return lookup;
};

for (const mode of ['shared', 'settings fallback']) {
    test(`${mode} membership dictionaries treat permitted prototype names as ordinary data`, () => {
        const folders = { source: { containers: [...names, 'ordinary'] } };
        const lookup = createLookup(mode, folders)('vm');
        for (const name of names) {
            assert.equal(lookup.byName[name], 'source', name);
            assert.equal(lookup.conflicts[name], undefined, name);
        }
        assert.deepEqual(JSON.parse(JSON.stringify(lookup)), {
            byName: Object.fromEntries(names.map(name => [name, 'source'])), conflicts: {}
        });
        folders.target = { containers: names };
        const conflicts = createLookup(mode, folders)('docker');
        for (const name of names) assert.deepEqual(conflicts.conflicts[name], ['source', 'target']);
        const empty = createLookup(mode, {})('vm');
        for (const name of names) assert.equal(empty.byName[name], undefined, name);
    });
}

test('bulk plans preserve source, target, unassigned and duplicate semantics for all permitted names', async () => {
    const folders = { source: { containers: names }, target: { containers: [] } };
    const requests = [];
    const api = shared.createApi({
        getFolderMap: () => folders,
        requestBulkAssign: async (type, folderId, items) => {
            requests.push({ type, folderId, items });
            return { assigned: items };
        }
    });
    const moved = api.buildBulkAssignmentPlan('vm', 'target', [...names, 'ordinary']);
    assert.deepEqual(moved.moves.map(row => row.currentFolderId), names.map(() => 'source'));
    assert.deepEqual(moved.conflicts, []);
    assert.deepEqual(moved.duplicateNames, ['ordinary']);
    assert.deepEqual(JSON.parse(JSON.stringify(moved)), moved);
    const result = await api.executeBulkAssignmentPlan('vm', moved);
    assert.equal(result.assignedCount, names.length);
    assert.deepEqual(requests, [{ type: 'vm', folderId: 'target', items: names }]);
    folders.target.containers = names;
    folders.source.containers = [];
    const unchanged = api.buildBulkAssignmentPlan('vm', 'target', names);
    assert.deepEqual(unchanged.unchanged.map(row => row.name), names);
    assert.deepEqual(unchanged.actionableNames, []);
    await api.executeBulkAssignmentPlan('vm', unchanged);
    assert.equal(requests.length, 1, 'unchanged entries never trigger a write');
    folders.target.containers = [];
    const created = api.buildBulkAssignmentPlan('docker', 'target', names);
    assert.deepEqual(created.creates.map(row => row.name), names);
    assert.deepEqual(created.moves, []);
});
