import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const scripts = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts');
const utils = require(path.join(scripts, 'folderviewplus.utils.js'));
const folder = (name, parentId = '') => ({ name, parentId, icon: '', containers: [], settings: {}, actions: [] });
const loadFunction = (file, name, nextName, sandbox) => {
    const source = fs.readFileSync(path.join(scripts, file), 'utf8');
    const start = source.indexOf('const ' + name + ' ='), end = source.indexOf('const ' + nextName + ' =', start);
    assert.ok(start >= 0 && end > start);
    return vm.runInNewContext(source.slice(start, end) + '\n' + name, sandbox);
};

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
