import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const repoRoot = path.resolve(process.cwd());
const require = createRequire(import.meta.url);
const scriptsRoot = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts'
);
const regexSelectionModule = require(path.join(scriptsRoot, 'folder.editor.regex-selection.js'));
const memberListModule = require(path.join(scriptsRoot, 'folder.editor.member-list.js'));

test('regex selection controller owns matching state and preserves manual selections', () => {
    let collections = {
        selected: [{ Name: 'manual-app', Label: '' }],
        choose: [
            { Name: 'alpha', Label: '' },
            { Name: 'database', Label: '' }
        ],
        selectedRegex: [{ Name: 'archive', Label: '' }]
    };
    let listUpdates = 0;
    let simulatorUpdates = 0;
    const api = regexSelectionModule.createApi({
        getRegexField: () => ({ value: '^a' }),
        getFolderName: () => '',
        getMemberCollections: () => collections,
        setMemberCollections: (next) => {
            collections = next;
        },
        updateList: () => {
            listUpdates += 1;
        },
        updateRegexSimulator: () => {
            simulatorUpdates += 1;
        },
        workerMinItems: 50
    });

    assert.equal(api.updateRegex({ value: '^a' }, { immediate: true }), true);
    assert.deepEqual(collections.selected.map((member) => member.Name), ['manual-app']);
    assert.deepEqual(collections.selectedRegex.map((member) => member.Name), ['alpha', 'archive']);
    assert.deepEqual(collections.choose.map((member) => member.Name), ['database']);
    assert.equal(listUpdates, 1);
    assert.equal(simulatorUpdates, 1);
    assert.deepEqual(api.snapshot(), {
        workerActive: false,
        pendingWorkerJobs: 0,
        evaluationRevision: 2,
        debouncePending: false
    });
});

test('regex selection controller cancels its debounce during disposal', () => {
    const runtimeWindow = {
        setTimeout,
        clearTimeout
    };
    const api = regexSelectionModule.createApi({
        window: runtimeWindow,
        getRegexField: () => ({ value: 'app' }),
        getMemberCollections: () => ({ selected: [], choose: [], selectedRegex: [] }),
        isFormInitialized: () => true,
        debounceMs: 1000
    });

    api.updateRegex({ value: 'app' });
    assert.equal(api.snapshot().debouncePending, true);
    api.dispose();
    assert.equal(api.snapshot().debouncePending, false);
});

test('member-list controller normalizes and reconciles direct child-folder order', () => {
    const folders = {
        parent: { name: 'Parent', parentId: '', containers: [] },
        first: { name: 'First', parentId: 'parent', containers: ['one'] },
        second: { name: 'Second', parent_id: 'parent', containers: ['one', 'two'] },
        nested: { name: 'Nested', parentId: 'first', containers: [] },
        third: { name: 'Third', parentId: 'parent', containers: [] }
    };
    const api = memberListModule.createApi({
        getAllFolders: () => folders,
        getActiveFolderId: () => 'parent',
        normalizeFolderRecord: (folder) => folder
    });

    assert.deepEqual(memberListModule.normalizeChildFolderOrder([' second ', '', 'first', 'second']), ['second', 'first']);
    api.setChildFolderOrder(['second', 'first']);
    assert.deepEqual(api.getChildFolderOrderIds(), ['second', 'first', 'third']);
    assert.deepEqual(api.getDirectChildFolderEntries().map((entry) => [entry.id, entry.memberCount]), [
        ['first', 1],
        ['second', 2],
        ['third', 0]
    ]);
});
