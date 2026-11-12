import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const server = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server');
const fixture = path.resolve('tests/fixtures/config-only-bootstrap.php');
const token = 'fixture-request-token-123456';

function withHostFixture(callback) {
    const base = fs.realpathSync(os.tmpdir());
    const root = fs.mkdtempSync(path.join(base, 'fvplus-config-bootstrap-'));
    const host = path.join(root, 'host');
    for (const directory of ['config', 'source', 'host']) fs.mkdirSync(path.join(root, directory));
    fs.writeFileSync(path.join(root, 'config/request.token'), token);
    const helpers = path.join(host, 'webGui/include/Helpers.php');
    fs.mkdirSync(path.dirname(helpers), { recursive: true });
    fs.writeFileSync(helpers, '<?php // Host helpers remain available to configuration endpoints.');
    for (const [name, relative] of [
        ['docker', 'plugins/dynamix.docker.manager/include/DockerClient.php'],
        ['libvirt', 'plugins/dynamix.vm.manager/include/libvirt_helpers.php']
    ]) {
        const sdk = path.join(host, relative);
        fs.mkdirSync(path.dirname(sdk), { recursive: true });
        fs.writeFileSync(sdk, `<?php
file_put_contents(getenv('FVPLUS_BOOTSTRAP_PROBE'), "${name}\\n", FILE_APPEND);
throw new RuntimeException('Host SDK bootstrap is unavailable in this fixture.');`);
    }
    const run = request => {
        fs.writeFileSync(path.join(root, 'request.json'), JSON.stringify(request));
        return JSON.parse(execFileSync('php', [fixture, server, root], { encoding: 'utf8', timeout: 30000,
            env: { ...process.env, FVPLUS_TEST_CONFIG_DIR: path.join(root, 'config'),
                FVPLUS_TEST_SOURCE_DIR: path.join(root, 'source'), FVPLUS_TEST_STORAGE_DIR: root,
                FVPLUS_TEST_SECURITY_STATE_PATH: path.join(root, 'security/state.json'),
                FVPLUS_BOOTSTRAP_PROBE: path.join(root, 'sdk-attempts.jsonl') }
        }));
    };
    try {
        callback({ root, run });
    } finally {
        assert.equal(path.dirname(fs.realpathSync(root)), base);
        fs.rmSync(root, { recursive: true, force: true });
    }
}

test('only the explicit boolean configuration mode skips host SDK bootstrap', () => {
    for (const configOnly of [undefined, false, 1, 'true', true]) {
        withHostFixture(({ run }) => {
            const result = run({ operation: 'bootstrap', ...(configOnly === undefined ? {} : { configOnly }) });
            assert.deepEqual(result.sdkAttempts, configOnly === true ? [] : ['docker', 'libvirt']);
            assert.equal(result.dependencies.helpers.loaded, true);
            if (configOnly !== true) {
                assert.equal(result.dependencies.docker.loaded, false);
                assert.equal(result.dependencies.libvirt.loaded, false);
            }
        });
    }
});

test('the runtime read_info endpoint retains host SDK bootstrap and reports unavailable SDKs', () => {
    withHostFixture(({ run }) => {
        const result = run({ endpoint: 'read_info.php', get: { type: 'docker', mode: 'state', liveupdate: '1' } });
        assert.deepEqual(result.sdkAttempts, ['docker', 'libvirt']);
        assert.equal(result.dependencies.docker.loaded, false);
        assert.equal(result.dependencies.libvirt.loaded, false);
        assert.equal(result.status, 400);
        assert.equal(result.response.ok, false);
    });
});

test('Docker and VM editor pages and folder reads bootstrap without host SDK initialization', () => {
    withHostFixture(({ root, run }) => {
        for (const type of ['docker', 'vm']) {
            fs.writeFileSync(path.join(root, `config/${type}.json`), JSON.stringify({ fixture: {
                name: 'Fixture', containers: ['fixture-member'], settings: { preview_rows: 2 }
            } }));
            const get = { type, id: 'fixture' };
            const page = run({ operation: 'editor-page', get });
            assert.deepEqual(page.sdkAttempts, []);
            assert.equal(page.dependencies.helpers.loaded, true);
            assert.equal(page.response.form, true);
            assert.equal(page.response.submitModule, true);
            assert.equal(page.response.context.pageType, type);
            assert.equal(page.response.context.resolvedId, 'fixture');
            assert.equal(page.response.context.bootstrapContext.folder.name, 'Fixture');
            const legacy = run({ endpoint: 'read.php', get });
            assert.deepEqual(legacy.sdkAttempts, []);
            assert.equal(legacy.response.fixture.name, 'Fixture');
            const read = run({ endpoint: 'read.php', get: { ...get, includeMetadata: '1' } });
            assert.deepEqual(read.sdkAttempts, []);
            assert.equal(read.response.ok, true);
            assert.equal(read.response.folders.fixture.settings.preview_rows, 2);
            assert.ok(Number.isInteger(read.response.metadata.folderRevision));
        }
    });
});

test('nonce, create, and appearance update persist with revision and replay guards without host SDKs', () => {
    withHostFixture(({ root, run }) => {
        let transaction = 0;
        const endpoint = (name, post) => {
            const result = run({ endpoint: name, post: { token, ...post } });
            assert.deepEqual(result.sdkAttempts, []);
            assert.equal(result.dependencies.helpers.loaded, true);
            return result;
        };
        const nonce = target => {
            const result = endpoint('security.php', { action: 'issue_nonce', endpoint: target });
            assert.equal(result.response.ok, true);
            return result.response.nonce;
        };
        const mutate = (name, post, issuedNonce = nonce(name)) => endpoint(name, {
            ...post, _fv_nonce: issuedNonce, _fv_transaction: `tx-config-bootstrap-${++transaction}`
        });
        for (const type of ['docker', 'vm']) {
            const initial = { name: 'Fixture', containers: ['fixture-member'], settings: { preview_rows: 2 } };
            const created = mutate('create.php', { type, content: JSON.stringify(initial) });
            assert.equal(created.status, 200);
            assert.equal(created.response.ok, true);
            const config = path.join(root, 'config', `${type}.json`);
            const saved = JSON.parse(fs.readFileSync(config, 'utf8'));
            const [id] = Object.keys(saved);
            const changed = { ...initial, settings: { preview_rows: 4 } };
            const revision = created.response.metadata.folderRevision;
            const once = nonce('update.php');
            const updated = mutate('update.php', { type, id, expectedRevision: revision,
                content: JSON.stringify(changed) }, once);
            assert.equal(updated.status, 200);
            assert.equal(updated.response.metadata.folderRevision, revision + 1);
            for (const key of ['bootstrapMs', 'guardMs', 'saveMs']) {
                assert.ok(Number.isInteger(updated.response.timings[key]) && updated.response.timings[key] >= 0
                    && updated.response.timings[key] <= 600000);
            }
            const persisted = JSON.parse(fs.readFileSync(config, 'utf8'))[id];
            assert.equal(persisted.settings.preview_rows, 4);
            assert.deepEqual(persisted.containers, initial.containers);
            assert.equal(persisted.createdAt, saved[id].createdAt);
            assert.deepEqual(JSON.parse(fs.readFileSync(`${config}.lastgood`, 'utf8'))[id], persisted);
            const committed = fs.readFileSync(config, 'utf8');
            const stale = mutate('update.php', { type, id, expectedRevision: revision,
                content: JSON.stringify(initial) });
            assert.equal(stale.status, 409);
            assert.equal(stale.response.ok, false);
            const replay = mutate('update.php', { type, id,
                expectedRevision: updated.response.metadata.folderRevision, content: JSON.stringify(initial) }, once);
            assert.equal(replay.status, 409);
            assert.equal(replay.response.requestFailure.reasonCode, 'nonce-stale');
            const invalid = mutate('update.php', { type, id,
                expectedRevision: updated.response.metadata.folderRevision, content: JSON.stringify(initial) }, 'invalid');
            assert.equal(invalid.status, 409);
            assert.equal(invalid.response.requestFailure.reasonCode, 'nonce-invalid');
            assert.equal(fs.readFileSync(config, 'utf8'), committed);
        }
    });
});
