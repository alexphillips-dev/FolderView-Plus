import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
const server = process.env.FVPLUS_FOLDER_BOUNDARY_SERVER || path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server');
const fixture = process.env.FVPLUS_FOLDER_BOUNDARY_FIXTURE || path.resolve('tests/fixtures/folder-transaction-boundaries.php');
const run = request => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-folder-boundaries-'));
    for (const directory of ['config', 'source', 'host']) fs.mkdirSync(path.join(root, directory));
    fs.writeFileSync(path.join(root, 'request.json'), JSON.stringify(request));
    try {
        return JSON.parse(execFileSync('php', [fixture, server, root], { encoding: 'utf8', timeout: 30000, env: {
            ...process.env, FVPLUS_TEST_CONFIG_DIR: path.join(root, 'config'), FVPLUS_TEST_SOURCE_DIR: path.join(root, 'source'),
            FVPLUS_TEST_STORAGE_DIR: root, FVPLUS_TEST_DOCKER_AUTOSTART_FILE: path.join(root, 'config/autostart')
        }}));
    } finally { assert.ok(path.basename(root).startsWith('fvplus-folder-boundaries-')); fs.rmSync(root, { recursive: true, force: true }); }
};
for (const type of ['docker', 'vm']) for (const operation of ['batch', 'bulk']) {
    test(`${type}/${operation} restores exact primary, mirror, revision, permissions and native bytes after faults`, () => {
        for (const stage of ['folders', ...(operation === 'batch' ? ['prefs'] : []), ...(type === 'docker' ? ['native'] : []), 'readback']) {
            const result = run({ type, operation, stage });
            assert.match(result.error, /failure|verification failed/, stage);
            assert.equal(result.exactRestored, true, stage);
            assert.equal(result.otherUnchanged, true, stage);
        }
    });
    test(`${type}/${operation} commits the intended membership or parent/order change`, () => {
        const result = run({ type, operation, stage: 'none' });
        assert.equal(result.error, '');
        if (operation === 'batch') {
            assert.equal(result.folders.child.parentId, 'target');
            assert.deepEqual(result.prefs.manualOrder, ['target', 'child', 'parent']);
        } else {
            assert.deepEqual(result.folders.child.containers, []);
            assert.deepEqual(result.folders.target.containers, ['resource']);
        }
    });
}
