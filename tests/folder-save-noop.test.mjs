import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const server = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server');
const fixture = path.resolve('tests/fixtures/folder-save-noop.php');
const run = request => {
    const base = fs.realpathSync(os.tmpdir());
    const root = fs.mkdtempSync(path.join(base, 'fvplus-folder-save-'));
    for (const directory of ['config', 'source', 'host']) fs.mkdirSync(path.join(root, directory));
    fs.writeFileSync(path.join(root, 'request.json'), JSON.stringify(request));
    try {
        return JSON.parse(execFileSync('php', [fixture, server, root], { encoding: 'utf8', timeout: 30000,
            env: { ...process.env, FVPLUS_TEST_CONFIG_DIR: path.join(root, 'config'),
                FVPLUS_TEST_SOURCE_DIR: path.join(root, 'source'), FVPLUS_TEST_STORAGE_DIR: root }
        }));
    } finally {
        assert.equal(path.dirname(fs.realpathSync(root)), base);
        fs.rmSync(root, { recursive: true, force: true });
    }
};

for (const type of ['docker', 'vm']) {
    test(`${type} unchanged updates keep folder, prefs, revisions, timestamps, mirrors and history bytes`, () => {
        for (const operation of ['noop', 'normalized-parent', 'migrated']) {
            const result = run({ type, operation });
            assert.equal(result.error, '', operation);
            assert.equal(result.unchanged, true, operation);
            assert.equal(result.result.folderRevision, result.beforeRevision, operation);
            assert.deepEqual(result.safeTimings, { validationReadMs: 12, folderPersistenceMs: 34, manualOrderSyncMs: 0 });
            assert.equal(result.folders.folder.updatedAt, '2026-02-01T00:00:00+00:00');
            assert.deepEqual(result.history.map(event => event.action), ['fixture_seed']);
            if (operation === 'migrated') {
                assert.equal(result.folders.folder.membershipPolicy, 'folderview3');
                assert.equal(result.folders.folder.memberIdentities.first.kind, type);
            }
        }
    });
    test(`${type} stale revisions reject even an unchanged update`, () => {
        const result = run({ type, operation: 'stale' });
        assert.equal(result.error, 'FVPlusConfigConflictException');
        assert.equal(result.unchanged, true);
    });
    test(`${type} changed settings, ordered members and normalized hierarchy still persist`, () => {
        for (const operation of ['appearance', 'members', 'parent', 'create']) {
            const result = run({ type, operation });
            assert.equal(result.error, '', operation);
            assert.equal(result.unchanged, false, operation);
            assert.equal(result.result.folderRevision, result.beforeRevision + 1, operation);
            assert.equal(result.folders.folder.createdAt, '2026-01-01T00:00:00+00:00');
            if (operation === 'appearance') assert.equal(result.folders.folder.settings.preview_rows, 4);
            if (operation === 'members') assert.deepEqual(result.folders.folder.containers, ['second', 'first', 'third']);
            if (operation === 'parent') {
                assert.equal(result.folders.folder.parentId, 'child');
                assert.equal(result.folders.child.parentId, '');
            }
            if (operation === 'create') assert.equal(Object.keys(result.folders).length, 4);
            const event = result.history.find(entry => entry.action === (operation === 'create' ? 'folder_create' : 'folder_update'));
            assert.ok(event, operation);
            for (const key of ['validationReadMs', 'folderPersistenceMs', 'manualOrderSyncMs', 'durationMs']) {
                assert.ok(Number.isInteger(event.details[key]) && event.details[key] >= 0 && event.details[key] <= 86400000, key);
            }
        }
    });
}
