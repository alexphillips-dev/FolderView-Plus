import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const utils = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils.js');

const cloneJson = (value) => JSON.parse(JSON.stringify(value));

const applyImportOperations = (folders, operations) => {
    const next = cloneJson(utils.normalizeFolderMap(folders));
    const creates = Array.isArray(operations?.creates) ? operations.creates : [];
    const upserts = Array.isArray(operations?.upserts) ? operations.upserts : [];
    const deletes = Array.isArray(operations?.deletes) ? operations.deletes : [];

    for (const id of deletes) {
        delete next[String(id || '')];
    }

    let createdIndex = 0;
    for (const row of creates) {
        const folder = row?.folder || {};
        const generatedId = `created-${String(++createdIndex).padStart(2, '0')}`;
        next[generatedId] = cloneJson(folder);
    }

    for (const row of upserts) {
        const id = String(row?.id || '').trim();
        if (!id) {
            continue;
        }
        next[id] = cloneJson(row?.folder || {});
    }

    return next;
};

const createStateSnapshot = (state, reason = 'manual') => ({
    reason,
    folders: cloneJson(state.folders),
    prefs: cloneJson(state.prefs)
});

const restoreStateSnapshot = (state, snapshot) => {
    state.folders = cloneJson(snapshot.folders || {});
    state.prefs = utils.normalizePrefs(snapshot.prefs || {});
};

for (const type of ['docker', 'vm']) {
    test(`${type} e2e workflow: create/edit/delete, import, backup/restore, and ordering`, () => {
        const state = {
            type,
            folders: {},
            prefs: utils.normalizePrefs({})
        };

        // create
        state.folders.alpha = {
            name: 'Alpha',
            icon: '/alpha.png',
            regex: '^a-',
            containers: ['a-one'],
            settings: { preview: 1 },
            actions: []
        };
        state.folders.beta = {
            name: 'Beta',
            icon: '/beta.png',
            regex: '^b-',
            containers: ['b-one'],
            settings: { preview: 0 },
            actions: []
        };
        assert.deepEqual(Object.keys(state.folders), ['alpha', 'beta']);

        // edit
        state.folders.alpha = {
            ...state.folders.alpha,
            icon: '/alpha-new.png',
            regex: '^alpha-',
            settings: { preview: 2 }
        };
        assert.equal(state.folders.alpha.regex, '^alpha-');
        assert.equal(state.folders.alpha.settings.preview, 2);

        // backup snapshot + delete
        state.prefs = utils.normalizePrefs({
            sortMode: 'manual',
            manualOrder: ['beta', 'alpha'],
            hideEmptyFolders: true
        });
        const backupA = createStateSnapshot(state, 'before-delete');
        delete state.folders.beta;
        assert.deepEqual(Object.keys(state.folders), ['alpha']);

        // restore snapshot
        restoreStateSnapshot(state, backupA);
        assert.deepEqual(Object.keys(state.folders), ['alpha', 'beta']);
        assert.deepEqual(state.prefs.manualOrder, ['beta', 'alpha']);
        assert.equal(state.prefs.hideEmptyFolders, true);

        // import merge
        const mergePayload = utils.buildFullExportPayload({
            type,
            pluginVersion: 'test',
            folders: {
                alpha: {
                    ...state.folders.alpha,
                    icon: '/alpha-merge.png'
                },
                gamma: {
                    name: 'Gamma',
                    icon: '/gamma.png',
                    regex: '^g-',
                    containers: ['g-one'],
                    settings: { preview: 0 },
                    actions: []
                }
            }
        });
        const mergeParsed = utils.parseImportPayload(mergePayload, type);
        assert.equal(mergeParsed.ok, true);
        const mergeOps = utils.buildImportOperations(state.folders, mergeParsed, 'merge');
        state.folders = applyImportOperations(state.folders, mergeOps);
        assert.deepEqual(Object.keys(state.folders), ['alpha', 'beta', 'gamma']);
        assert.equal(state.folders.alpha.icon, '/alpha-merge.png');

        // import skip (existing alpha should not be replaced)
        const skipPayload = utils.buildFullExportPayload({
            type,
            pluginVersion: 'test',
            folders: {
                alpha: {
                    ...state.folders.alpha,
                    icon: '/alpha-skip-should-not-apply.png'
                },
                delta: {
                    name: 'Delta',
                    icon: '/delta.png',
                    regex: '^d-',
                    containers: ['d-one'],
                    settings: { preview: 1 },
                    actions: []
                }
            }
        });
        const skipParsed = utils.parseImportPayload(skipPayload, type);
        const skipOps = utils.buildImportOperations(state.folders, skipParsed, 'skip');
        state.folders = applyImportOperations(state.folders, skipOps);
        assert.equal(state.folders.alpha.icon, '/alpha-merge.png');
        assert.ok(state.folders.delta);

        // import replace
        const replacePayload = utils.buildFullExportPayload({
            type,
            pluginVersion: 'test',
            folders: {
                omega: {
                    name: 'Omega',
                    icon: '/omega.png',
                    regex: '^o-',
                    containers: ['o-one'],
                    settings: { preview: 0 },
                    actions: []
                }
            }
        });
        const replaceParsed = utils.parseImportPayload(replacePayload, type);
        const replaceOps = utils.buildImportOperations(state.folders, replaceParsed, 'replace');
        state.folders = applyImportOperations(state.folders, replaceOps);
        assert.deepEqual(Object.keys(state.folders), ['omega']);

        // order persistence (manual + pinned)
        state.folders = {
            one: { name: 'One' },
            two: { name: 'Two' },
            three: { name: 'Three' }
        };
        state.prefs = utils.normalizePrefs({
            sortMode: 'manual',
            manualOrder: ['three', 'one'],
            pinnedFolderIds: ['two']
        });
        const ordered = utils.orderFoldersByPrefs(state.folders, state.prefs);
        assert.deepEqual(Object.keys(ordered), ['two', 'three', 'one']);
    });
}
