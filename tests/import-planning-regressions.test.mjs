import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { runInventoryRepair } from './helpers/runtime-inventory-fixture.mjs';
const require = createRequire(import.meta.url);
const scripts = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts');
const utils = require(path.join(scripts, 'folderviewplus.utils.js'));
const { reviewImportSelection, filterOperationsBySelection } = require(path.join(scripts, 'folderviewplus.import-selection.js'));
const folder = (name, parentId = '') => ({ name, parentId, icon: '', containers: [], settings: {}, actions: [] });
const loadFunction = (file, name, nextName, sandbox) => {
    const source = fs.readFileSync(path.join(scripts, file), 'utf8');
    const start = source.indexOf('const ' + name + ' ='), end = source.indexOf('const ' + nextName + ' =', start);
    assert.ok(start >= 0 && end > start);
    return vm.runInNewContext(source.slice(start, end) + '\n' + name, sandbox);
};

test('partial import reviews only selected changes and blocks implicit reparenting', () => {
    const current = { parent: folder('Original parent'), child: folder('Keep child', 'parent'), other: folder('Keep elsewhere') };
    const replace = utils.buildImportPlan(current, { mode: 'full', folders: { other: folder('Keep elsewhere') } }, 'replace').operations;
    const selectedDelete = { ...replace, deletes: ['parent'] };
    const reviewReplace = reviewImportSelection(current, replace, selectedDelete);
    assert.deepEqual(reviewReplace.diffRows.map(row => row.id), ['parent', 'other']);
    assert.deepEqual(reviewReplace.hierarchyConflicts, [{ folderName: 'Keep child', parentName: 'Original parent' }]);
    assert.deepEqual(reviewImportSelection(current, replace, { ...replace, upserts: [] }).hierarchyConflicts, []);

    const merge = utils.buildImportPlan({}, { mode: 'full', folders: {
        nested: folder('Nested child', 'incoming'), incoming: folder('Import parent')
    } }, 'merge').operations;
    const selectedChild = { ...merge, upserts: merge.upserts.filter(row => row.id === 'nested') };
    const reviewMerge = reviewImportSelection({}, merge, selectedChild);
    assert.deepEqual(reviewMerge.diffRows.map(row => row.id), ['nested']);
    assert.deepEqual(reviewMerge.hierarchyConflicts, [{ folderName: 'Nested child', parentName: 'Import parent' }]);
    assert.deepEqual(reviewImportSelection({}, merge, merge).hierarchyConflicts, []);
});

test('import review detects a cycle formed across selected and retained parent links', () => {
    const current = { a: folder('A'), b: folder('B', 'a') };
    const incoming = { mode: 'full', folders: { a: folder('A', 'b'), b: folder('B') } };
    const { operations } = utils.buildImportPlan(current, incoming, 'merge');
    const partial = { ...operations, upserts: operations.upserts.filter(row => row.id === 'a') };
    assert.deepEqual(reviewImportSelection(current, operations, partial).hierarchyConflicts, [{ folderName: 'A', parentName: 'B' }]);
    assert.deepEqual(reviewImportSelection(current, operations, operations).hierarchyConflicts, []);

    const bad = { ...operations, upserts: [{ id: 'another', folder: folder('Another', 'another') }] };
    assert.deepEqual(reviewImportSelection(current, bad, bad).hierarchyConflicts, [{ folderName: 'Another', parentName: 'Another' }]);
});

test('replacing from one folder keeps a matching target and discards unavailable source ancestry', () => {
    const current = { root: folder('Parent'), child: { ...folder('Child', 'root'), createdAt: '2020-01-01T00:00:00+00:00' } };
    const payload = { mode: 'single', folderId: 'child', folder: { ...folder('New title', 'root'), createdAt: '2022-01-01T00:00:00+00:00' } };
    const { operations, diffRows, summary } = utils.buildImportPlan(current, payload, 'replace');
    assert.deepEqual(operations.deletes, ['root']);
    assert.deepEqual(summary.deletes.map(row => row.id), ['root']);
    assert.deepEqual(diffRows.map(row => [row.id, row.action]), [['root', 'delete'], ['child', 'update']]);
    assert.equal(operations.upserts[0].folder.parentId, '');
    assert.deepEqual(reviewImportSelection(current, operations, operations).hierarchyConflicts, []);
    assert.equal(utils.buildImportPlan(current, payload, 'merge').operations.upserts[0].folder.parentId, 'root');
    assert.equal(utils.buildImportPlan({}, payload, 'merge').operations.upserts[0].folder.parentId, '');
    assert.equal(payload.folder.parentId, 'root');
});

test('import review reports hidden members, identity changes, and legacy child order', () => {
    const children = { 'child-a': folder('A', 'original'), 'child-b': folder('B', 'original') };
    const current = { original: { ...folder('Media'), containers: ['app'], hiddenPreviewMembers: [], memberIdentities: [] }, ...children };
    const existing = current.original;
    for (const [incoming, expectedField] of [
        [{ ...existing, hiddenPreviewMembers: ['app'] }, 'members'],
        [{ ...existing, member_identities: { app: { kind: 'vm', uuid: 'synthetic' } }, memberIdentities: undefined }, 'members'],
        [{ ...existing, membershipPolicy: 'folderview3' }, 'members'],
        [{ ...existing, child_folder_order: ['child-b', 'child-a'] }, 'settings']
    ]) {
        const { summary, operations } = utils.buildImportPlan(current, { mode: 'full', folders: { original: incoming, ...children } }, 'merge');
        assert.equal(summary.updates.length, 1);
        assert.deepEqual(reviewImportSelection(current, operations, operations).diffRows[0].fields, [expectedField]);
    }
    const unchanged = { ...existing, memberIdentities: {}, hiddenPreviewMembers: undefined, hidden_preview: [] };
    const plan = utils.buildImportPlan(current, { mode: 'full', folders: { original: unchanged } }, 'merge');
    assert.equal(plan.diffRows[0].action, 'unchanged');
    assert.equal(plan.summary.unchanged.length, 1);
});

test('full and partial imports preserve remapped child order and retained destination children', () => {
    const current = {
        target: { ...folder('Parent'), settings: { child_folder_order: ['target-b', 'target-a', 'local'] } },
        'target-a': folder('A', 'target'), 'target-b': folder('B', 'target'), local: folder('Local', 'target')
    };
    const parsed = { mode: 'full', folders: {
        root: { ...folder('Parent'), childFolderOrder: ['b', 'a', 'new', 'invalid'] },
        a: folder('A', 'root'), b: folder('B', 'root'), new: folder('New', 'root')
    } };
    const { operations } = utils.buildImportPlan(current, parsed, 'merge');
    assert.deepEqual(operations.upserts.find(row => row.id === 'target').folder.settings.child_folder_order, ['target-b', 'target-a', 'new', 'local']);
    const replacement = utils.buildImportPlan(current, parsed, 'replace').operations;
    const selection = { creates: [], upserts: replacement.upserts.map((entry, index) => ({ index, checked: entry.id !== 'new' })),
        deletes: replacement.deletes.map((_, index) => ({ index, checked: false })) };
    const selected = filterOperationsBySelection(replacement, selection, current);
    assert.deepEqual(selected.upserts.find(row => row.id === 'target').folder.settings.child_folder_order, ['target-b', 'target-a', 'local']);
    const { new: _new, ...sameSource } = parsed.folders;
    const equivalent = utils.buildImportPlan(current, { ...parsed, folders: sameSource }, 'merge');
    assert.equal(equivalent.diffRows.find(row => row.id === 'target').action, 'unchanged');
    assert.equal(parsed.folders.root.childFolderOrder.at(0), 'b');
    const numeric = utils.buildImportPlan(current, { mode: 'full', folders: {
        root: { ...folder('Parent'), childFolderOrder: [2, 1] }, 1: folder('A', 'root'), 2: folder('B', 'root')
    } }, 'merge');
    assert.deepEqual(numeric.operations.upserts.find(row => row.id === 'target').folder.settings.child_folder_order, ['target-b', 'target-a', 'local']);
});

test('Branch Import persists child order using the IDs reserved by its guarded batch', async () => {
    const { createApi } = require(path.join(scripts, 'folderviewplus.runtime-actions.js'));
    const longId = 'x'.repeat(128), longPrefix = 'x'.repeat(126), longMappedId = longPrefix + '-2';
    const current = { target: folder('Destination'), a: folder('Existing A'), b: folder('Existing B'),
        [longId]: folder('Existing long ID'), [longPrefix + '-1']: folder('Existing reserved suffix') };
    const incoming = {
        root: { ...folder('Imported branch'), settings: { childFolderOrder: ['b', longId, 'a'] } },
        a: folder('A', 'root'), b: folder('B', 'root'), [longId]: folder('Long ID', 'root')
    };
    let persisted;
    const errors = [];
    const api = createApi({
        utils, getFolderMap: () => current, fetchFolders: async () => ({ folders: current, folderRevision: 1 }),
        selectJsonFile: async () => ({ text: JSON.stringify(utils.buildFullExportPayload({ type: 'docker', folders: incoming })) }),
        applyImportOperations: async (type, batchOperations, _progress, { expectedRevision }) => {
            persisted = runInventoryRepair({ operation: 'batch', scenario: 'healthy', type, dockerFolders: current,
                batchOperations: { ...batchOperations, preserveParentLinks: true }, expectedRevision });
        },
        showError: (...args) => errors.push(args)
    });
    await api.importFolderBranch('docker', 'target');
    assert.deepEqual(errors, []);
    assert.equal(persisted?.responseStatus, 200);
    assert.equal(persisted.folders.root.parentId, 'target');
    for (const child of ['a-1', 'b-1', longMappedId]) assert.equal(persisted.folders[child].parentId, 'root');
    assert.deepEqual(persisted.folders.root.settings.child_folder_order, ['b-1', longMappedId, 'a-1']);
});

test('starter application replans from authoritative folder names and fences competing creates', async () => {
    const folderGroupApi = require(path.join(scripts, 'folderviewplus.folder-groups.js'));
    let folders = { first: folder('Media') }, revision = 8;
    const requests = [];
    const apply = loadFunction('folderviewplus.starter-templates.js', 'createSelectedStarterTemplates', 'quickCreateStarterTemplates', {
        window: { FolderViewPlusFoundationModules: { folderGroups: folderGroupApi } },
        DEFAULT_STARTER_FOLDER_ICON: 'fixture.png',
        starterTemplateT: (_key, fallback) => fallback,
        buildStarterFolderPayload: (name, icon) => ({ name, icon }),
        fetchFolders: async () => ({ folders: { ...folders }, folderRevision: revision }),
        requestFolderBatchMutation: async (type, operations, { expectedRevision }) => {
            requests.push({ type, expectedRevision });
            if (expectedRevision !== revision) throw new Error('Revision conflict');
            for (const { folder: input } of operations.creates) folders[input.name] = input;
            revision++;
        }
    });
    const blueprint = [{ name: 'Media' }, { name: 'Books' }];
    const competing = await Promise.allSettled([apply('docker', blueprint), apply('docker', blueprint)]);
    assert.equal(competing[0].status, 'fulfilled');
    assert.deepEqual(Array.from(competing[0].value.createdNames), ['Books']);
    assert.equal(competing[0].value.skipped, 1);
    assert.match(competing[1].reason.message, /Revision conflict/);
    assert.equal((await apply('docker', blueprint)).createdNames.length, 0);
    assert.deepEqual(Object.values(folders).map(entry => entry.name), ['Media', 'Books']);
    assert.deepEqual(requests, [{ type: 'docker', expectedRevision: 8 }, { type: 'docker', expectedRevision: 8 }]);
});

test('explicit incoming IDs are reserved before path inference for every insertion order and import mode', () => {
    for (const mode of ['merge', 'replace', 'skip']) {
        for (const folders of [{ B: folder('Media'), A: folder('Other') }, { A: folder('Other'), B: folder('Media') }]) {
            const current = { A: folder('Media') }, parsed = { mode: 'full', folders };
            const before = JSON.stringify([current, parsed]);
            const plan = utils.buildImportPlan(current, parsed, mode);
            assert.deepEqual(plan.operations.upserts.map(row => row.id).sort(), mode === 'skip' ? ['B'] : ['A', 'B']);
            assert.equal(plan.operations.pathMappings.length, 0);
            assert.equal(plan.operations.pathConflicts.length, 1);
            assert.equal(plan.operations.pathConflicts[0].sourceId, 'B');
            assert.equal(plan.summary.creates.length, 1);
            assert.equal(plan.summary.creates[0].id, 'B');
            assert.equal(plan.summary.updates.length, mode === 'skip' ? 0 : 1);
            assert.equal(plan.summary.skipped.length, mode === 'skip' ? 1 : 0);
            assert.deepEqual(plan.operations, utils.buildImportOperations(current, parsed, mode));
            assert.deepEqual(plan.summary, utils.summarizeImport(current, parsed, mode));
            assert.deepEqual(plan.diffRows, utils.buildImportDiffRows(current, parsed, mode));
            assert.equal(JSON.stringify([current, parsed]), before);
        }
    }
});

test('ambiguous inferred targets retain all incoming records and report every conflict', () => {
    for (const folders of [{ B: folder('Media'), C: folder('Media') }, { C: folder('Media'), B: folder('Media') }]) {
        const plan = utils.buildImportPlan({ A: folder('Media') }, { mode: 'full', folders }, 'merge');
        assert.deepEqual(plan.operations.upserts.map(row => row.id).sort(), ['B', 'C']);
        assert.equal(plan.operations.pathMappings.length, 0);
        assert.equal(plan.operations.pathConflicts.length, 2);
        assert.equal(plan.summary.creates.length, 2);
        assert.equal(plan.summary.updates.length, 0);
    }
});

test('one import plan preserves single-folder, inferred-parent and numeric-name contracts', () => {
    const current = { root: folder('Parent'), child: folder('Child', 'root') };
    const parsed = { mode: 'full', folders: { otherRoot: folder('Parent'), otherChild: folder('Child', 'otherRoot'), numeric: folder('123', 'otherRoot') } };
    const plan = utils.buildImportPlan(current, parsed, 'merge');
    assert.deepEqual(plan.operations.upserts.map(row => [row.id, row.folder.parentId]), [['root', ''], ['child', 'root'], ['numeric', 'root']]);
    assert.equal(plan.operations.pathMappings.length, 2);
    assert.equal(plan.operations.pathConflicts.length, 0);
    for (const input of [{ mode: 'single', folderId: 'child', folder: folder('Replaced', 'root') }, { mode: 'single', folderId: null, folder: folder('123') }]) {
        for (const mode of ['merge', 'replace', 'skip']) {
            const single = utils.buildImportPlan(current, input, mode);
            assert.deepEqual(single.operations, utils.buildImportOperations(current, input, mode));
            assert.deepEqual(single.summary, utils.summarizeImport(current, input, mode));
            assert.deepEqual(single.diffRows, utils.buildImportDiffRows(current, input, mode));
        }
    }
});

test('backup comparison covers the entire normalized restored preference contract except revision bookkeeping', () => {
    const compare = loadFunction('folderviewplus.import.js', 'buildBackupPrefsDiff', 'getBackupCompareActionLabels', { utils, importT: (_key, fallback) => fallback });
    const baseline = utils.normalizePrefs({});
    const cases = [
        ['dashboard', { layout: 'accordion' }], ['pageTitle', { enabled: true }],
        ['dockerStartOrder', { mode: 'custom-batches' }], ['settingsTable', { nameWidth: 'wide' }],
        ['folderDefaults', { sourceName: 'Saved default', profile: { icon: '/fixture/icon.png', settings: {}, actions: [] } }],
        ['hiddenFolderIds', ['hidden']], ['expandedFolderState', { root: true }],
        ['setupWizardCompleted', true], ['settingsMode', 'advanced'], ['pageViewMode', 'command'], ['themeCompatibilityMode', 'safe']
    ];
    for (const [key, value] of cases) {
        const updated = utils.normalizePrefs({ ...baseline, [key]: value });
        assert.notEqual(JSON.stringify(updated[key]), JSON.stringify(baseline[key]), key + ' fixture must change normalized persisted data');
        assert.ok(compare(baseline, updated).rows.some(row => row.key === key), key);
    }
    assert.equal(compare(baseline, baseline).comparedCount, Object.keys(baseline).filter(key => key !== '_metadata').length);
    assert.equal(compare(baseline, { ...baseline, _metadata: { prefsRevision: 999, updatedAt: 'later' } }).rows.length, 0);
});


test('resolved entries keep unchanged writes and skip behavior while private plan facts stay internal', () => {
    const current = { A: folder('Media') }, parsed = { mode: 'full', folders: { A: folder('Media') } };
    for (const mode of ['merge', 'replace']) {
        const plan = utils.buildImportPlan(current, parsed, mode);
        assert.equal(plan.summary.unchanged.length, 1);
        assert.equal(plan.summary.unchanged[0].id, 'A');
        assert.equal(plan.operations.upserts.length, 1, 'unchanged full imports retain their historical upsert contract');
        assert.equal(plan.diffRows.length, 1);
        assert.equal(plan.diffRows[0].action, 'unchanged');
        assert.deepEqual(Object.keys(plan.operations.upserts[0]).sort(), ['folder', 'id', 'pathMapped', 'sourceId']);
    }
    const skipped = utils.buildImportPlan(current, parsed, 'skip');
    assert.equal(skipped.summary.skipped.length, 1);
    assert.equal(skipped.operations.upserts.length, 0);
    assert.equal(skipped.diffRows.length, 0);
});


test('backup preference labels reuse loaded translated UI labels and keep future fields visible', () => {
    const localeRoot = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/langs/namespaces');
    const labels = {
        groupUnassignedItems: ['settings.visibility.group-unassigned-items', true],
        hiddenFolderIds: ['legacy.surface.88ee90bc2e344724', ['hidden']],
        expandedFolderState: ['legacy.surface.0447fe78ffb9f4b1', { root: true }],
        setupWizardCompleted: ['wizard.title', true], settingsMode: ['settings.mode.title', 'advanced'],
        pageViewMode: ['legacy.surface.400a5dbb2cc39b2e', 'command'],
        pageTitle: ['settings.page-title.label', { enabled: true }],
        themeCompatibilityMode: ['legacy.surface.44d40c93c0197c7a', 'safe'],
        dashboard: ['legacy.surface.67b696468610b879', { layout: 'accordion' }],
        settingsTable: ['legacy.surface.53aade77cd69a77b', { nameWidth: 'wide' }],
        dockerStartOrder: ['settings.navigation.docker-start-order', { mode: 'custom-batches' }],
        folderDefaults: ['legacy.surface.49d13b9d958f69d0', { sourceName: 'Saved default', profile: { icon: '/fixture/icon.png', settings: {}, actions: [] } }]
    };
    for (const locale of ['en', 'de', 'es']) {
        const catalog = Object.assign({}, ...['settings', 'wizard', 'import', 'common', 'legacy-surface'].map(namespace =>
            JSON.parse(fs.readFileSync(path.join(localeRoot, locale, namespace + '.json'), 'utf8'))));
        const translated = (key, fallback) => { assert.ok(Object.hasOwn(catalog, key), locale + '/' + key); return catalog[key] || fallback; };
        const compare = loadFunction('folderviewplus.import.js', 'buildBackupPrefsDiff', 'getBackupCompareActionLabels', { utils, importT: translated });
        for (const [key, [translationKey, value]] of Object.entries(labels)) {
            const row = compare({}, { [key]: value }).rows.find(entry => entry.key === key);
            assert.ok(row, key);
            assert.equal(row.label, catalog[translationKey], locale + '/' + key);
            assert.notEqual(row.label, key, 'an implementation field must not become a UI label');
        }
        const futureUtils = { ...utils, normalizePrefs: value => ({ ...utils.normalizePrefs(value), futurePreference: value?.futurePreference === true }) };
        const futureCompare = loadFunction('folderviewplus.import.js', 'buildBackupPrefsDiff', 'getBackupCompareActionLabels', { utils: futureUtils, importT: translated });
        const future = futureCompare({}, { futurePreference: true }).rows.find(row => row.key === 'futurePreference');
        assert.ok(future);
        assert.equal(future.label, catalog['legacy.surface.66962f72a0888373']);
    }
});
