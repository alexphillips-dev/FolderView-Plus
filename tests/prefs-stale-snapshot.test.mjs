import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const root = '../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/';
const store = createRequire(import.meta.url)(`${root}folderviewplus.prefs-store.js`);
const read = name => fs.readFileSync(new URL(`${root}${name}`, import.meta.url), 'utf8');
const extract = (source, name) => {
    const start = source.indexOf(`const ${name} =`);
    assert.ok(start >= 0, name);
    return source.slice(start, source.indexOf('\n};', start) + 3);
};
const diagnostics = read('folderviewplus.activity-diagnostics.js');
const settings = read('folderviewplus.js');
const plain = value => JSON.parse(JSON.stringify(value));

for (const type of ['docker', 'vm']) {
    for (const newerCoordinator of [false, true]) {
        test(`${type} stale full save preserves other-page edits ${newerCoordinator ? 'after broadcast' : 'after conflict'}`, async () => {
            const original = { backupSchedule: { retention: 25, enabled: false }, pinnedFolderIds: ['first'],
                dashboard: { layout: 'classic', privacyMode: false }, autoRules: [{ id: 'old' }], _metadata: { prefsRevision: 1 } };
            let server = store.mergePatch(original, { backupSchedule: { enabled: true }, pinnedFolderIds: ['second'],
                dashboard: { layout: 'compactmatrix', privacyMode: true }, autoRules: [{ id: 'new' }] });
            server._metadata = { prefsRevision: 2 };
            const writes = [];
            const coordinator = store.createPreferenceSaveCoordinator({
                window: {}, normalizePrefs: value => value, debounceMs: 0,
                fetchPrefs: async () => server,
                writePrefs: async (_type, patch, context) => {
                    writes.push(plain(patch));
                    if (context.expectedRevision !== server._metadata.prefsRevision) throw Object.assign(new Error('Conflict'), { status: 409 });
                    server = { ...store.mergePatch(server, patch), _metadata: { prefsRevision: 3 } };
                    return server;
                }
            });
            coordinator.reconcile(type, newerCoordinator ? server : original);
            const context = vm.createContext({
                diagnosticsPrefsStoreModule: store, diagnosticsPrefsCoordinator: coordinator,
                prefsByType: { [type]: original }, latestPrefsBackupByType: {}, utils: { normalizePrefs: value => value }
            });
            vm.runInContext(`${extract(diagnostics, 'protectDashboardLayoutFromBroadPrefsWrite')}\n${extract(diagnostics, 'postPrefs')}\nthis.save = postPrefs;`, context);
            const next = { ...original, backupSchedule: { ...original.backupSchedule, retention: 12 } };
            const saved = await context.save(type, next);
            assert.equal(writes.length, newerCoordinator ? 1 : 2);
            for (const patch of writes) assert.deepEqual(patch, { backupSchedule: { retention: 12 } });
            assert.equal(saved.backupSchedule.enabled, true);
            assert.equal(saved.backupSchedule.retention, 12);
            assert.deepEqual(saved.pinnedFolderIds, ['second']);
            assert.deepEqual(saved.autoRules, [{ id: 'new' }]);
            assert.equal(saved.dashboard.privacyMode, true);
            assert.equal(saved.dashboard.layout, 'compactmatrix');
        });
    }
}

test('snapshot diff handles list clears, nested siblings, nulls, and unchanged snapshots without mutating input', () => {
    const baseline = { pinnedFolderIds: ['a'], nested: { keep: 1, clear: 'x' }, _metadata: { prefsRevision: 4 } };
    const next = { ...baseline, pinnedFolderIds: [], nested: { keep: 1, clear: null } };
    assert.deepEqual(store.cleanPatch(next, baseline), { pinnedFolderIds: [], nested: { clear: null } });
    assert.deepEqual(store.cleanPatch(baseline, baseline), {});
    assert.equal(baseline.nested.clear, 'x');
    assert.deepEqual(store.cleanPatch({ nested: { clear: null } }), { nested: { clear: null } });
});

test('delayed saves use the original baseline while explicit partial saves preserve their intent', async () => {
    const writes = [];
    const original = { hiddenFolderIds: [], pinnedFolderIds: [], _metadata: { prefsRevision: 1 } };
    const context = vm.createContext({
        diagnosticsPrefsStoreModule: store,
        diagnosticsPrefsCoordinator: { save: async (_type, patch) => { writes.push(plain(patch)); return patch; }, getSnapshot: () => ({}) },
        prefsByType: { docker: { ...original, hiddenFolderIds: ['new'] } }, latestPrefsBackupByType: {}, utils: { normalizePrefs: value => value }
    });
    vm.runInContext(`${extract(diagnostics, 'protectDashboardLayoutFromBroadPrefsWrite')}\n${extract(diagnostics, 'postPrefs')}\nthis.save = postPrefs;`, context);
    await context.save('docker', { ...original, pinnedFolderIds: ['pinned'] }, { baselinePrefs: original });
    await context.save('docker', { hiddenFolderIds: [] }, { currentPrefs: original });
    assert.deepEqual(writes, [{ pinnedFolderIds: ['pinned'] }, { hiddenFolderIds: [] }]);
});

test('rapid Docker start-order changes queue only edited fields and retain both edits', async () => {
    const writes = [], timers = new Map();
    let timer = 0;
    const context = vm.createContext({
        prefsStoreModule: store, utils: { normalizePrefs: value => value },
        prefsByType: { docker: { pinnedFolderIds: ['keep'], dockerStartOrder: { mode: 'docker-page', remaining: 'after', batches: [] } } },
        normalizeDockerStartOrderPrefsForUi: prefs => prefs.dockerStartOrder,
        renderDockerStartOrderWorkspace() {}, showError: (_title, error) => { throw error; },
        postPrefs: async (_type, patch, options) => { writes.push(plain(patch)); assert.ok(options.currentPrefs); return patch; },
        window: { setTimeout: fn => { timers.set(++timer, fn); return timer; }, clearTimeout: id => timers.delete(id) }
    });
    vm.runInContext(`let dockerStartOrderQueuedPrefs = null, dockerStartOrderSaveTimer = null, dockerStartOrderSaveChain = Promise.resolve();\n${
        ['persistQueuedDockerStartOrderPrefs', 'queueDockerStartOrderPrefsSave', 'saveDockerStartOrderPlan'].map(name => extract(settings, name)).join('\n')
    }\nthis.save = saveDockerStartOrderPlan; this.flush = () => dockerStartOrderSaveChain;`, context);
    await context.save({ mode: 'manual' });
    await context.save({ remaining: 'before' });
    for (const fn of timers.values()) fn();
    await context.flush();
    assert.deepEqual(writes, [{ dockerStartOrder: { mode: 'manual', remaining: 'before' } }]);
});

test('folder editor rule saves discard unrelated cached preferences before reaching the coordinator', async () => {
    const writes = [];
    const original = { autoRules: [{ id: 'old' }], pinnedFolderIds: ['stale'], dashboard: { privacyMode: false } };
    const context = vm.createContext({
        rootWindow: { FolderViewPlusPrefsStore: store }, type: 'vm', folderEditorPrefs: original,
        folderEditorPrefsLoaded: true, normalizePrefs: value => value,
        preferenceCoordinator: { save: async (_type, patch) => { writes.push(plain(patch)); return patch; } }
    });
    const source = read('folder.editor.rules.js');
    const start = source.indexOf('const saveFolderEditorPrefs =');
    const end = source.indexOf('const ruleTemplateWorkspace =', start);
    vm.runInContext(`${source.slice(start, end)}\nthis.save = saveFolderEditorPrefs;`, context);
    await context.save({ ...original, autoRules: [] });
    assert.deepEqual(writes, [{ autoRules: [] }]);
});
