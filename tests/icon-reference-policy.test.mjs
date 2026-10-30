import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const server = process.env.FVPLUS_ICON_POLICY_SERVER || path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server');
const fixture = process.env.FVPLUS_ICON_POLICY_FIXTURE || path.resolve('tests/fixtures/icon-reference-policy.php');
const run = request => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-icon-policy-'));
    for (const directory of ['config', 'source', 'host', 'temp']) fs.mkdirSync(path.join(root, directory));
    fs.writeFileSync(path.join(root, 'request.json'), JSON.stringify({ kind: 'unused', ...request }));
    try {
        return JSON.parse(execFileSync('php', [fixture, server, root], { encoding: 'utf8', timeout: 30000,
            env: { ...process.env, FVPLUS_TEST_CONFIG_DIR: path.join(root, 'config'), FVPLUS_TEST_SOURCE_DIR: path.join(root, 'source'),
                FVPLUS_TEST_STORAGE_DIR: root, FVPLUS_TEST_SECURITY_STATE_PATH: path.join(root, 'security/state.json'), FVPLUS_TEST_DOCKER_AUTOSTART_FILE: path.join(root, 'config/autostart'),
                TMP: path.join(root, 'temp'), TEMP: path.join(root, 'temp'), TMPDIR: path.join(root, 'temp') } }));
    } finally { assert.ok(path.basename(root).startsWith('fvplus-icon-policy-')); fs.rmSync(root, { recursive: true, force: true }); }
};
const aliases = ['/plugins/folderview.plus/images/custom/before.png?v=7#icon',
    '/usr/local/emhttp/plugins/folderview.plus/images/custom/before.png',
    'plugins/folderview.plus/images/custom/before.png',
    'https://fixture.invalid/plugins/folderview.plus/images/custom/%62efore.png'];
for (const type of ['docker', 'vm']) for (const kind of ['folder', 'defaults', 'group']) {
    test(`delete refuses ${type}/${kind} references through all persisted path aliases`, () => {
        for (const reference of aliases) {
            const result = run({ type, kind, reference, action: 'delete' });
            assert.match(result.error, /in use/);
            assert.deepEqual(result.after, result.before);
        }
    });
    test(`usage, diagnostics and repair agree for ${type}/${kind} icon references`, () => {
        const request = { type, kind, reference: aliases[2] };
        const usage = run({ ...request, policyAction: 'usage' });
        assert.equal(usage.usage.length, 1);
        assert.deepEqual(usage.usage, usage.diagnostics);
        const repaired = run({ ...request, policyAction: 'repair' });
        assert.equal(repaired.beforeCount, 1);
        assert.equal(repaired.result.repairedFolderCount, 1);
        assert.equal(repaired.afterCount, 0);
    });
}

test('raw diagnostics ignore symlinked lastgood owners and guarded delete refuses them', t => {
    for (const kind of ['folder', 'defaults']) {
        const result = run({ type: 'docker', kind, reference: aliases[2], policyAction: 'recoverable', mirrorState: 'symlink' });
        if (result.unsupportedSymlink) { t.skip('File symlinks are unavailable to this process.'); return; }
        assert.equal(result.response.ok, false);
        assert.match(result.response.error, /references could not be verified/);
        assert.equal(result.usageCount, 0);
        assert.equal(result.diagnosticsCount, 0);
        assert.equal(result.observational, true);
        assert.equal(result.exactUnchanged, true);
        assert.equal(result.iconRetained, true);
    }
});

test('unreadable raw lastgood owners remain untouched and cannot authorize deletion', {
    skip: process.platform === 'win32' || (typeof process.getuid === 'function' && process.getuid() === 0)
        ? 'Real unreadable-file checks require an unprivileged POSIX process.' : false
}, t => {
    const result = run({ type: 'docker', kind: 'defaults', reference: aliases[2], policyAction: 'recoverable', mirrorState: 'unreadable' });
    if (result.unsupportedPermissions) { t.skip('The process can still read files without read permission.'); return; }
    assert.equal(result.response.ok, false);
    assert.equal(result.usageCount, 0);
    assert.equal(result.diagnosticsCount, 0);
    assert.equal(result.observational, true);
    assert.equal(result.exactUnchanged, true);
    assert.equal(result.mirrorProtected, true);
    assert.equal(result.iconRetained, true);
});
test('delete refuses corrupt current reference state without repairing it', () => {
    const result = run({ corrupt: true, action: 'delete' });
    assert.match(result.error, /references could not be verified/);
    assert.deepEqual(result.after, result.before);
});

test('repair rejects an unavailable icon inventory and compensates folder or preference failures exactly', () => {
    for (const type of ['docker', 'vm']) for (const [kind, policyFault] of [['folder', 'inventory'], ['folder', 'folders'], ['defaults', 'prefs'], ['group', 'prefs']]) {
        const result = run({ type, kind, reference: aliases[2], policyAction: 'repair', policyFault });
        assert.match(result.error, /references could not be verified|Injected icon/);
        assert.equal(result.exactRestored, true, `${type}/${kind}/${policyFault}`);
    }
});

for (const type of ['docker', 'vm']) for (const kind of ['folder', 'defaults', 'group']) {
    test(`guarded delete protects ${type}/${kind} references recoverable only from raw lastgood`, () => {
        for (const unavailable of ['missing', 'malformed']) {
            const result = run({ type, kind, reference: aliases[2], policyAction: 'recoverable', unavailable });
            assert.equal(result.response.ok, false, unavailable);
            assert.match(result.response.error, /references could not be verified/);
            assert.equal(result.status, 400);
            assert.equal(result.usageCount, 1, unavailable);
            assert.equal(result.diagnosticsCount, 1, unavailable);
            assert.equal(result.sameProjection, true);
            assert.equal(result.observational, true);
            assert.equal(result.exactUnchanged, true);
            assert.equal(result.iconRetained, true);
            assert.equal(result.mirrorExists, true);
            assert.equal(result.missingPrimaryRemainsMissing, unavailable === 'missing');
        }
    });
}
