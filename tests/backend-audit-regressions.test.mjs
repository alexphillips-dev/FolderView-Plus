import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runConfigWriteFixture } from './helpers/config-write-fixture.mjs';

const server = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server');
const run = (...args) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-backend-audit-'));
    try {
        return JSON.parse(execFileSync('php', [path.resolve('tests/fixtures/backend-audit-regressions.php'), server, root, ...args], {
            encoding: 'utf8', timeout: 30000
        }));
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
};

for (const kind of ['folder', 'prefs']) test(`${kind} GET holds its lock between payload and revision`, () => {
    const result = run(kind);
    assert.equal(result.blocked, true);
    assert.equal(result.response.metadata[`${kind}Revision`], result.before[`${kind}Revision`]);
    assert.deepEqual(result.response.metadata, result.persisted);
    if (kind === 'folder') assert.deepEqual(Object.keys(result.response.folders), ['old']);
    else assert.equal(result.response.prefs.sortMode, 'created');
});

for (const type of ['docker', 'vm']) test(`${type} bulk move retains canonical identity and removes source identity`, () => {
    const result = run('bulk', type);
    assert.equal(result.result.assignedCount, 1);
    assert.deepEqual(result.after.source.containers, []);
    assert.deepEqual(result.after.source.memberIdentities, []);
    assert.deepEqual(result.after.target.containers, ['fixture-member']);
    assert.deepEqual(result.after.target.memberIdentities['fixture-member'], result.before.source.memberIdentities['fixture-member']);
});

for (const type of ['docker', 'vm']) test(`${type} bulk identity collision preserves target and failed commit restores identities`, () => {
    const collision = run('bulk', type, 'collision');
    assert.deepEqual(collision.after.target.memberIdentities, collision.before.target.memberIdentities);
    assert.deepEqual(collision.after.source.memberIdentities, []);
    const rollback = run('bulk', type, 'rollback');
    assert.match(rollback.error, /Automatic rollback restored the original configuration/);
    assert.equal(rollback.restored, true);
    assert.deepEqual(rollback.after, rollback.before);
});

test('bulk move compensates failed writes and reports incomplete rollback honestly', () => {
    for (const type of ['docker', 'vm']) {
        const result = runConfigWriteFixture({ type, operation: 'bulk' });
        assert.deepEqual(result.after, result.before);
        assert.match(result.error, /Automatic rollback restored the original configuration/);
        const failedRollback = runConfigWriteFixture({ type, operation: 'bulk', rollback: true });
        assert.match(failedRollback.error, /rollback was incomplete/);
    }
});

for (const mode of ['symlink', 'mirror']) test(`failed legacy icon migration preserves originals for ${mode} retry`, () => {
    const result = run('migration', mode);
    assert.match(result.error, /Custom icon directory is not writable/);
    assert.equal(result.preserved, true);
    assert.equal(result.ready, true);
    assert.equal(result.persistent, 'synthetic-icon-bytes');
    assert.equal(result.public, result.persistent);
});

for (const mode of ['symlink', 'mirror']) for (const fault of ['', 'metadata', ...(mode === 'mirror' ? ['mirror'] : [])]) {
    test(`${mode} icon deletion ${fault ? `rolls back ${fault} failure then retries` : 'removes persistent and public copies'}`, () => {
        const result = run('delete', mode, fault);
        if (fault) {
            assert.notEqual(result.error, '');
            assert.equal(result.restored, true);
        } else assert.equal(result.error, '');
        assert.equal(result.deleted, 'fixture.png');
        assert.equal(result.persistentExists, false);
        assert.equal(result.publicExists, false);
        assert.equal(result.metadataContainsIcon, false);
    });
}

test('process output stays bounded for stdout, stderr, combined output and final drain', {
    skip: process.platform === 'win32' ? 'Executable shell fixtures run on Linux.' : false
}, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-output-limits-'));
    try {
        const result = JSON.parse(execFileSync('php', [path.resolve('tests/fixtures/process-output-limits.php'), server, root], {
            encoding: 'utf8', timeout: 30000
        }));
        assert.deepEqual(Object.keys(result), ['normal', 'exact-limit', 'stdout', 'stderr', 'combined']);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
