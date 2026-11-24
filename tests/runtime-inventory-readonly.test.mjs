import test from 'node:test';
import assert from 'node:assert/strict';
import { runInventoryRepair } from './helpers/runtime-inventory-fixture.mjs';

test('read-only inventory endpoints preserve exact native autostart bytes through empty, failed and partial reads', () => {
    for (const operation of ['read', 'snapshot', 'diagnostics']) {
        for (const scenario of ['healthy', 'empty', 'failed-list', 'failed-detail', 'malformed-list']) {
            const result = runInventoryRepair({ type: 'docker', operation, scenario });
            assert.equal(result.error, '', `${operation}/${scenario}: ${result.error}`);
            assert.equal(result.native, result.nativeBefore, `${operation}/${scenario} must be observational`);
            assert.equal(result.nativeMode, result.nativeModeBefore);
            assert.ok(result.response);
            assert.notEqual(result.response.ok, false, `${operation}/${scenario} must execute a successful read`);
        }
    }
});

test('state reads, VM reads and start-order previews leave native autostart unchanged', () => {
    for (const request of [{ type: 'docker', operation: 'read', mode: 'state', scenario: 'healthy' },
        { type: 'docker', operation: 'snapshot', mode: 'state', scenario: 'healthy' },
        { type: 'vm', operation: 'read', scenario: 'disabled' },
        { type: 'docker', operation: 'preview', scenario: 'healthy' }]) {
        const result = runInventoryRepair(request);
        assert.equal(result.error, '');
        assert.equal(result.native, result.nativeBefore);
        assert.notEqual(result.response.ok, false);
    }
});

test('cached full and state reads preserve native bytes without runtime discovery', () => {
    for (const operation of ['read', 'snapshot']) for (const mode of ['full', 'state']) {
        const result = runInventoryRepair({ type: 'docker', operation, scenario: 'stale-cache', mode, force: false });
        assert.equal(result.error, '');
        assert.notEqual(result.response.ok, false);
        assert.equal(result.native, result.nativeBefore);
        assert.deepEqual(result.calls, []);
    }
});

test('fresh and previously cached Docker details omit environment values from runtime reads', () => {
    const name = 'docker-present';
    const config = { Image: 'fixture/image:latest', Env: ['FVPLUS_FIXTURE_TOKEN=fixture-value-that-must-stay-server-side'] };
    for (const operation of ['read', 'snapshot']) {
        for (const cached of [false, true]) {
            const result = runInventoryRepair({
                type: 'docker', operation, scenario: 'healthy', mode: 'full', force: !cached,
                details: { [name]: { Config: config, State: { Running: false }, HostConfig: { NetworkMode: 'host' } } },
                cachedRuntimeDetails: cached ? { [name]: { info: { Name: name, Config: config } } } : undefined
            });
            assert.equal(result.error, '');
            assert.ok(result.response);
            const runtime = operation === 'snapshot' ? result.response.runtime : result.response;
            assert.equal(runtime[name].info.Config.Image, config.Image);
            assert.equal(Object.hasOwn(runtime[name].info.Config, 'Env'), false);
            assert.equal(JSON.stringify(result.response).includes('fixture-value-that-must-stay-server-side'), false);
            assert.equal(result.native, result.nativeBefore);
            if (cached) assert.deepEqual(result.calls, []);
        }
    }
});

test('explicit managed sync uses fresh authority to remove stale records in Docker page order with native waits', () => {
    for (const scenario of ['healthy', 'stale-cache', 'failed-detail']) {
        const result = runInventoryRepair({ type: 'docker', operation: 'sync', scenario });
        assert.equal(result.error, '');
        assert.equal(result.response.ok, true);
        assert.equal(result.native, 'docker-present 7\ndocker-extra 19\n');
        assert.ok(result.calls.some(([call, count]) => call === 'docker-list' && count === 5));
        assert.ok(result.calls.every(([call]) => call !== 'docker-cached-list'));
    }
});

const explicitOrderRequests = ['sync', 'start-sync'];
const explicitOrderFixture = (operation, options) => runInventoryRepair({
    type: 'docker', operation, scenario: 'healthy', ...options
});

const assertOrderSyncRefused = (result, code, label) => {
    assert.equal(result.error, '', label);
    assert.equal(result.native, result.nativeBefore, label);
    assert.equal(result.nativeMode, result.nativeModeBefore, label);
    assert.equal(result.response?.ok, false, label);
    assert.equal(result.response?.errorCode, code, label);
    assert.equal(result.responseStatus, code === 'docker_order_lock_unavailable' ? 503 : 409, label);
    assert.doesNotMatch(JSON.stringify(result.response), /fvplus-inventory-|docker-sync-order\.lock/);
};

for (const operation of explicitOrderRequests) {
    test(`${operation} refuses synchronization when the Docker order lock cannot be opened`, () => {
        const result = explicitOrderFixture(operation, { syncLock: 'blocked' });
        assertOrderSyncRefused(result, 'docker_order_lock_unavailable', operation);
    });

    test(`${operation} coalesces an occupied lock without touching native records`, () => {
        const result = explicitOrderFixture(operation, { syncLock: 'held' });
        assert.equal(result.error, '');
        assert.equal(result.response?.ok, true);
        assert.equal(result.responseStatus, 200);
        assert.equal(result.native, result.nativeBefore);
        assert.equal(result.nativeMode, result.nativeModeBefore);
        assert.equal(result.syncPending, true);
    });

    for (const folderPrimary of ['corrupt', 'missing', 'scalar', 'invalid-folder', 'invalid-members']) {
        test(`${operation} uses verified last-good membership and waits when the primary is ${folderPrimary}`, () => {
            const result = explicitOrderFixture(operation, { folderPrimary });
            assert.equal(result.error, '');
            assert.equal(result.response?.ok, true);
            assert.equal(result.responseStatus, 200);
            assert.equal(result.native, 'docker-present 7\ndocker-extra 19\n');
        });

    }

    for (const [folderPrimary, folderLastGood] of [
        ['corrupt', 'corrupt'], ['corrupt', 'missing'], ['missing', 'corrupt'], ['missing', 'missing'],
        ['scalar', 'invalid-folder'], ['invalid-folder', 'scalar'], ['invalid-members', 'invalid-members']
    ]) {
        test(`${operation} refuses folder maps when the primary is ${folderPrimary} and last-good is ${folderLastGood}`, () => {
            const result = explicitOrderFixture(operation, { folderPrimary, folderLastGood });
            assertOrderSyncRefused(result, 'docker_order_folders_unavailable', `${folderPrimary}/${folderLastGood}`);
        });
    }
}

test('managed sync accepts the canonical empty folder map without reviving old memberships', () => {
    const result = explicitOrderFixture('sync', { folderPrimary: 'empty' });
    assert.equal(result.error, '');
    assert.equal(result.response?.ok, true);
    assert.equal(result.native, 'docker-extra 19\ndocker-present 7\n');
});

test('post-save synchronization declines unsafe order writes without throwing', () => {
    for (const options of [
        { syncLock: 'blocked' },
        { folderPrimary: 'missing', folderLastGood: 'corrupt' }
    ]) {
        const result = explicitOrderFixture('sync-hook', options);
        assert.equal(result.error, '');
        assert.equal(result.native, result.nativeBefore);
        assert.equal(result.nativeMode, result.nativeModeBefore);
    }
});

test('a skipped synchronization preserves native records and refuses an unavailable preview', () => {
    for (const options of [
        { plan: { mode: 'unmanaged' } },
        { scenario: 'failed-list' },
        { syncLock: 'held' }
    ]) {
        const request = { ...options, folderPrimary: 'missing', folderLastGood: 'corrupt' };
        const sync = explicitOrderFixture('sync', request);
        const startSync = explicitOrderFixture('start-sync', request);
        assert.equal(sync.response?.ok, true);
        assert.equal(sync.responseStatus, 200);
        assert.equal(startSync.response?.ok, false);
        assert.equal(startSync.response?.errorCode, undefined);
        assert.equal(startSync.response?.preview, undefined);
        for (const result of [sync, startSync]) {
            assert.equal(result.error, '');
            assert.equal(result.native, result.nativeBefore);
            assert.equal(result.nativeMode, result.nativeModeBefore);
        }
    }
});

test('explicit sync preserves native records when inventory cannot be verified or ownership is unmanaged', () => {
    for (const scenario of ['failed-list', 'disabled', 'http-error', 'malformed-body', 'missing-body', 'malformed-list', 'duplicate']) {
        const result = runInventoryRepair({ type: 'docker', operation: 'sync', scenario });
        assert.equal(result.error, '');
        assert.equal(result.response.ok, true);
        assert.equal(result.native, result.nativeBefore, scenario);
    }
    const result = runInventoryRepair({ type: 'docker', operation: 'sync', scenario: 'healthy', plan: { mode: 'unmanaged' } });
    assert.equal(result.error, '');
    assert.equal(result.native, result.nativeBefore);
    assert.deepEqual(result.calls, [], 'unmanaged sync must skip before runtime discovery');
});

test('explicit sync may clean a confirmed empty service without treating failed reads as empty', () => {
    const result = runInventoryRepair({ type: 'docker', operation: 'sync', scenario: 'empty' });
    assert.equal(result.error, '');
    assert.equal(result.native, '');
});

test('explicit custom batches retain configured sequencing and batch/container wait precedence', () => {
    const result = runInventoryRepair({ type: 'docker', operation: 'sync', scenario: 'healthy',
        plan: { mode: 'custom-batches', remaining: 'after', containerWaits: { 'docker-extra': 23 },
            batches: [{ id: 'fixture-batch', name: 'Batch', items: [{ type: 'container', name: 'docker-present' }], delay: 11 }] } });
    assert.equal(result.error, '');
    assert.equal(result.response.ok, true);
    assert.equal(result.native, 'docker-present 11\ndocker-extra 23\n');
});

test('an independent native writer changing waits during sync planning is not overwritten', () => {
    const result = runInventoryRepair({ type: 'docker', operation: 'sync-race', scenario: 'healthy', hostChange: true });
    assert.equal(result.error, '');
    assert.equal(result.hostWritten, 'docker-extra 88\ndocker-present 99\n');
    assert.equal(result.native, result.hostWritten);
});
