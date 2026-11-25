import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const fixture = fileURLToPath(new URL('./fixtures/backend-audit-integrity.php', import.meta.url));
const server = fileURLToPath(new URL('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server', import.meta.url));

const withFixture = (callback) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-backend-integrity-'));
    try {
        for (const directory of ['config', 'host', 'source']) fs.mkdirSync(path.join(root, directory));
        const env = { ...process.env, FVPLUS_TEST_CONFIG_DIR: path.join(root, 'config'),
            FVPLUS_TEST_SOURCE_DIR: path.join(root, 'source'), FVPLUS_TEST_STORAGE_DIR: root,
            FVPLUS_TEST_DOCKER_AUTOSTART_FILE: path.join(root, 'autostart-fixture') };
        const run = scenario => JSON.parse(execFileSync('php', [fixture, server, root, scenario],
            { env, encoding: 'utf8', timeout: 30000 }));
        return callback({ root, run });
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
};

test('editor and rule assignment reject overflowing targets before any write and allow a capacity-neutral swap', () => {
    const result = withFixture(({ run }) => run('capacity'));
    assert.match(result.errors.editor, /maximum item count/);
    assert.match(result.errors.rule, /maximum item count/);
    assert.equal(result.unchanged, true);
    assert.deepEqual(result.rejectedArchives, []);
    assert.equal(result.fullCount, 5000);
    assert.equal(result.fullTail, 'incoming');
    assert.deepEqual(result.source, ['member-1']);
    assert.deepEqual(result.assigned, [['incoming'], ['member-1']]);
    assert.equal(result.backupCreated, true);
});

test('compensated environment writes leave genuine Undo history available through legacy no-op checkpoints', () => {
    const result = withFixture(({ run }) => run('undo'));
    assert.match(result.failure, /Fixture failure.*restored/);
    assert.equal(result.unchanged, true);
    assert.deepEqual(result.otherArchives, []);
    assert.deepEqual(result.remaining, [result.meaningful]);
    assert.notEqual(result.legacy, result.meaningful);
    assert.equal(result.restored, result.meaningful);
    assert.deepEqual(result.current, ['earlier']);
});

test('environment import preserves full parent IDs alongside prefix siblings and rejects overlong aliases', () => {
    const result = withFixture(({ run }) => run('hierarchy'));
    assert.equal(result.verified, true);
    assert.equal(result.parent.length, 128);
    assert.equal(result.child, result.parent);
    assert.equal(result.exportedParent, result.parent);
    assert.equal(result.overlong, '');
    assert.equal(result.self, '');
    assert.equal(result.numericChild, '0');
});

test('Operations template listing and creation preserve existing rows through last-good recovery', () => {
    const result = withFixture(({ run }) => run('templates'));
    assert.deepEqual(result.onCorrupt, ['Saved template']);
    assert.deepEqual(result.onMissing, ['Saved template']);
    assert.deepEqual(result.afterCreate, ['Saved template', 'New template']);
    assert.equal(result.mirrored, true);
    assert.match(result.error, /Unable to load saved templates/);
    assert.deepEqual(result.unavailable, ['invalid primary', 'invalid mirror']);
});

for (const obstacle of [false, true]) {
    test(`Rule Preview GET stays read-only with ${obstacle ? 'an obstructed' : 'no'} Theme Workspace`, () => {
        withFixture(({ root, run }) => {
            assert.deepEqual(run('seed-rule-get'), { seeded: true });
            const theme = path.join(root, 'config', 'theme-workspace.json');
            if (obstacle) fs.mkdirSync(theme);
            const config = path.join(root, 'config');
            const before = Object.fromEntries(fs.readdirSync(config, { withFileTypes: true })
                .filter(entry => entry.isFile()).map(entry => [entry.name, fs.readFileSync(path.join(config, entry.name))]));
            const result = run('rule-get');
            assert.equal(result.ok, true);
            assert.equal(result.preview.ready, true);
            assert.deepEqual(result.preview.rows, []);
            assert.deepEqual(fs.readdirSync(config).sort(), [...Object.keys(before), ...(obstacle ? [path.basename(theme)] : [])].sort());
            for (const [name, bytes] of Object.entries(before)) assert.deepEqual(fs.readFileSync(path.join(config, name)), bytes);
            assert.equal(fs.existsSync(path.join(root, 'source', 'images')), false);
            if (obstacle) assert.deepEqual(fs.readdirSync(theme), []);
        });
    });
}
