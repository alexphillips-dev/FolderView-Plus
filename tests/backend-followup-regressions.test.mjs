import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const server = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server');
const run = (...args) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-backend-followup-'));
    try {
        return JSON.parse(execFileSync('php', [path.resolve('tests/fixtures/backend-followup-regressions.php'), server, root, ...args], {
            encoding: 'utf8', timeout: 30000
        }));
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
};

test('same-second backups remain distinct, ordered newest first and safely pruned', () => {
    const result = run('backup');
    assert.equal(result.unique, 12);
    assert.deepEqual(result.firstFolders, ['fixture-0']);
    assert.equal(result.latest, result.expectedLatest);
    assert.deepEqual(result.remaining, result.expectedRemaining);
    assert.equal(result.pruned, 10);
    assert.equal(result.locked, true);
    assert.equal(result.recentBeforeDelete, result.expectedRecent);
    assert.equal(result.recentAfterDelete, result.expectedRecent);
    assert.equal(result.coalesced.name, result.expectedRecent);
    assert.equal(result.coalesced.coalesced, true);
});

for (const mode of ['symlink', 'mirror']) for (const fault of ['', 'metadata', ...(mode === 'mirror' ? ['mirror'] : [])]) {
    test(`${mode} replacement upload ${fault ? `restores ${fault} failure and retries` : 'updates equal-size public bytes'}`, () => {
        const result = run('upload', mode, fault);
        if (fault) {
            assert.notEqual(result.error, '');
            assert.equal(result.restored, true);
        } else assert.equal(result.error, '');
        assert.equal(result.replaced, true);
        assert.equal(result.persistentNew, true);
        assert.equal(result.publicNew, true);
        assert.equal(result.metadataHash, result.expectedHash);
    });
}

test('multilingual profile names, collision suffixes and members survive byte limits and reload', () => {
    const result = run('profiles');
    assert.equal(result.profiles.length, 12);
    assert.equal(new Set(result.profiles.map(row => row.name)).size, 12);
    for (const row of result.profiles) {
        assert.ok(Buffer.byteLength(row.name) <= 80);
        assert.ok(Buffer.byteLength(row.containers[0]) <= 160);
        assert.doesNotMatch(row.name, /\uFFFD/);
        assert.doesNotMatch(row.containers[0], /\uFFFD/);
    }
    assert.deepEqual(result.reloaded, result.profiles);
    assert.equal(result.stable, true);
});
