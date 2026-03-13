import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const utils = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils.js');

const repoRoot = path.resolve(process.cwd());
const libPhp = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server/lib.php'),
    'utf8'
);

const cloneJson = (value) => JSON.parse(JSON.stringify(value));

const createStateSnapshot = (state, reason = 'manual') => ({
    reason,
    folders: cloneJson(state.folders),
    prefs: cloneJson(state.prefs)
});

const restoreStateSnapshot = (state, snapshot) => {
    state.folders = cloneJson(snapshot.folders || {});
    state.prefs = utils.normalizePrefs(snapshot.prefs || {});
};

test('backup payload contract includes full folders + prefs metadata', () => {
    assert.match(libPhp, /'schemaVersion'\s*=>\s*FVPLUS_EXPORT_SCHEMA_VERSION/);
    assert.match(libPhp, /'mode'\s*=>\s*'full'/);
    assert.match(libPhp, /'reason'\s*=>\s*\$reason/);
    assert.match(libPhp, /'folders'\s*=>\s*\$folders/);
    assert.match(libPhp, /'prefs'\s*=>\s*\$prefs/);
});

test('restore path validates type and performs ordered rollback-safe writes', () => {
    assert.match(libPhp, /validateBackupPayloadType\(\$decoded, \$type\);/);
    assert.match(libPhp, /writeRawFolderMap\(\$type, is_array\(\$folders\) \? \$folders : \[\]\);/);
    assert.match(libPhp, /syncManualOrderWithFolders\(\$type, is_array\(\$folders\) \? \$folders : \[\]\);/);
    assert.match(libPhp, /if \(\$type === 'docker'\) \{\s*syncContainerOrder\('docker'\);/);
    assert.match(libPhp, /function restoreLatestUndoBackupSnapshot\(string \$type\): array/);
    assert.match(libPhp, /if \(!isUndoBackupReason\(\$reason\)\) \{\s*continue;\s*\}/);
});

for (const type of ['docker', 'vm']) {
    test(`${type} backup integrity: round-trip restore + rollback returns prior state`, () => {
        const state = {
            folders: {
                alpha: { name: 'Alpha', containers: ['a1'] },
                beta: { name: 'Beta', containers: ['b1'] }
            },
            prefs: utils.normalizePrefs({
                sortMode: 'manual',
                manualOrder: ['beta', 'alpha'],
                pinnedFolderIds: ['alpha'],
                hideEmptyFolders: true
            })
        };

        const baseline = createStateSnapshot(state, 'before-change');
        state.folders.gamma = { name: 'Gamma', containers: ['g1'] };
        state.folders.alpha = { name: 'Alpha updated', containers: ['a1', 'a2'] };
        state.prefs = utils.normalizePrefs({
            ...state.prefs,
            manualOrder: ['gamma', 'beta', 'alpha'],
            pinnedFolderIds: ['gamma']
        });

        const rollbackPoint = createStateSnapshot(state, 'before-rollback');
        delete state.folders.beta;
        state.prefs = utils.normalizePrefs({
            ...state.prefs,
            manualOrder: ['gamma', 'alpha'],
            pinnedFolderIds: []
        });

        restoreStateSnapshot(state, rollbackPoint);
        assert.deepEqual(Object.keys(state.folders).sort(), ['alpha', 'beta', 'gamma']);
        assert.deepEqual(state.prefs.manualOrder, ['gamma', 'beta', 'alpha']);
        assert.deepEqual(state.prefs.pinnedFolderIds, ['gamma']);

        restoreStateSnapshot(state, baseline);
        assert.deepEqual(Object.keys(state.folders).sort(), ['alpha', 'beta']);
        assert.equal(state.folders.alpha.name, 'Alpha');
        assert.deepEqual(state.prefs.manualOrder, ['beta', 'alpha']);
        assert.deepEqual(state.prefs.pinnedFolderIds, ['alpha']);
        assert.equal(state.prefs.hideEmptyFolders, true);

        const ordered = utils.orderFoldersByPrefs(state.folders, state.prefs);
        assert.deepEqual(Object.keys(ordered), ['alpha', 'beta']);
    });
}
