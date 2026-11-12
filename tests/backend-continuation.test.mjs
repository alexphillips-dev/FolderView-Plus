import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const server = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server');
const run = (...args) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-backend-continuation-'));
    try {
        return JSON.parse(execFileSync('php', [path.resolve('tests/fixtures/backend-continuation.php'), server, root, ...args], {
            encoding: 'utf8', timeout: 30000
        }));
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
};

for (const type of ['docker', 'vm']) for (const format of ['positional', 'keyed']) {
    test(`${type} migration preserves ${format} identities when duplicate ownership removes an earlier member`, () => {
        const result = run('migration', type, format);
        assert.deepEqual(result.planned.containers, ['retained']);
        assert.deepEqual(result.stored, result.planned);
        const identity = result.stored.memberIdentities.retained;
        assert.equal(type === 'vm' ? identity.uuid : identity.containerId, result.expectedId);
        if (type === 'docker') assert.equal(identity.image, result.expectedImage);
    });
}

test('diagnostics recommends both repairs when prefs and metadata problems affect different types', () => {
    const result = run('actions');
    for (const actions of Object.values(result)) {
        assert.deepEqual(actions, ['normalize_prefs', 'repair_config_metadata']);
    }
});
