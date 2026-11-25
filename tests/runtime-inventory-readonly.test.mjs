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
        assert.equal(result.response.syncOutcome, 'synced');
        assert.equal(result.native, 'docker-present 7\ndocker-extra 19\n');
        assert.ok(result.calls.some(([call, count]) => call === 'docker-list' && count === 5));
        assert.ok(result.calls.every(([call]) => call !== 'docker-cached-list'));
    }
});

test('start-order sync preserves a numeric container and uses it once in the native file', () => {
    const result = runInventoryRepair({ type: 'docker', operation: 'start-sync', scenario: 'healthy',
        docker: ['12', 'docker-extra'].map((name, index) => ({ Names: ['/' + name], Id: String(index + 1).repeat(64), State: 'exited' })),
        nativeAutostart: 'docker-extra 19\n12 7\nstale-host-entry 31\n' });
    assert.equal(result.response.syncOutcome, 'synced');
    assert.deepEqual(result.response.preview.autostartOrder, ['12', 'docker-extra']);
    assert.deepEqual(result.response.preview.staleAutostart, ['stale-host-entry']);
    assert.equal(result.native, '12 7\ndocker-extra 19\n');
});

test('custom batch waits follow unique scheduled containers and the folder order toggle uses native order', () => {
    const fixture = { type: 'docker', operation: 'start-sync', scenario: 'healthy',
        dockerFolder: { name: 'Fixture', containers: ['docker-present', 'docker-extra'] } };
    const folderItem = { type: 'folder', id: 'fixture' };
    const overlapping = runInventoryRepair({ ...fixture, plan: { mode: 'custom-batches', batches: [
        { id: 'first', delay: 10, items: [{ type: 'container', name: 'docker-extra' }] },
        { id: 'second', delay: 40, items: [folderItem] }
    ] } });
    assert.equal(overlapping.response.syncOutcome, 'synced');
    assert.deepEqual(overlapping.response.preview.batches.map(batch => batch.containers), [['docker-extra'], ['docker-present']]);
    assert.equal(overlapping.native, 'docker-extra 10\ndocker-present 40\n');
    for (const useFolderOrder of [true, false]) {
        const result = runInventoryRepair({ ...fixture, plan: { mode: 'custom-batches',
            batches: [{ id: 'single', useFolderOrder, items: [folderItem] }] } });
        assert.equal(result.response.syncOutcome, 'synced');
        assert.deepEqual(result.response.preview.autostartOrder, useFolderOrder
            ? ['docker-present', 'docker-extra'] : ['docker-extra', 'docker-present']);
    }
});

test('runtime responses stay valid JSON when the native Docker SDK writes a socket error', () => {
    for (const operation of ['read', 'snapshot']) for (const mode of ['state', 'full']) {
        const result = runInventoryRepair({ type: 'docker', operation, mode, scenario: 'socket-output' });
        assert.equal(result.error, '', `${operation}/${mode}`);
        assert.equal(result.responseStatus, 503);
        assert.equal(result.response.ok, false);
        assert.doesNotMatch(JSON.stringify(result.response), /synthetic-private-socket-detail/);
    }
    const details = runInventoryRepair({ type: 'docker', operation: 'snapshot', mode: 'full', scenario: 'detail-output' });
    assert.equal(details.error, '');
    assert.equal(details.responseStatus, 200);
    assert.doesNotMatch(JSON.stringify(details.response), /synthetic-private-socket-detail/);
    const diagnostics = runInventoryRepair({ type: 'docker', operation: 'diagnostics', scenario: 'late-socket-output' });
    assert.equal(diagnostics.error, '');
    assert.equal(diagnostics.responseStatus, 200);
    assert.equal(diagnostics.response.ok, true);
    assert.doesNotMatch(JSON.stringify(diagnostics.response), /synthetic-private-socket-detail/);
    const connectivity = diagnostics.response.diagnostics.summary.cards.find(card => card.key === 'runtime_connectivity');
    assert.notEqual(connectivity.states.docker, 'ready');
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
    assert.equal(result.response?.syncOutcome, 'failed', label);
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
        assert.equal(result.response?.syncOutcome, 'queued');
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
            assert.equal(result.response?.syncOutcome, 'synced');
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

test('skipped synchronization reports its outcome without returning a misleading preview', () => {
    for (const [options, outcome] of [
        [{ plan: { mode: 'unmanaged' } }, 'unmanaged'],
        [{ scenario: 'failed-list' }, 'failed'],
        [{ syncLock: 'held' }, 'queued']
    ]) {
        const request = { ...options, folderPrimary: 'missing', folderLastGood: 'corrupt' };
        const sync = explicitOrderFixture('sync', request);
        const startSync = explicitOrderFixture('start-sync', request);
        assert.equal(sync.response?.ok, true);
        assert.equal(sync.responseStatus, 200);
        assert.equal(sync.response?.syncOutcome, outcome);
        assert.equal(startSync.response?.ok, outcome !== 'failed');
        assert.equal(startSync.responseStatus, outcome === 'failed' ? 409 : 200);
        assert.equal(startSync.response?.syncOutcome, outcome);
        assert.equal(startSync.response?.preview, undefined);
        for (const result of [sync, startSync]) {
            assert.equal(result.error, '');
            assert.equal(result.native, result.nativeBefore);
            assert.equal(result.nativeMode, result.nativeModeBefore);
        }
    }
});

test('Settings sync refuses unverifiable inventory even when its read-only preview would succeed', () => {
    const options = { rejectVerifiedInventory: true };
    const preview = explicitOrderFixture('preview', options);
    assert.equal(preview.response?.ok, true);
    assert.ok(Array.isArray(preview.response.preview.order));
    const sync = explicitOrderFixture('start-sync', options);
    assertOrderSyncRefused(sync, 'docker_order_inventory_unavailable', 'verified source rejected');
    assert.equal(sync.response.preview, undefined);
});

test('Diagnostics distinguishes a queued order repair from a completed one', () => {
    const sync = explicitOrderFixture('diagnostics-sync', { syncLock: 'held' });
    assert.equal(sync.error, '');
    assert.equal(sync.response?.ok, true);
    assert.equal(sync.response?.syncOutcome, 'queued');
    assert.equal(sync.response?.messageKey, 'common.server.folderview-plus-configuration-is-busy-please-retry-the-action-260891');
    assert.equal(sync.native, sync.nativeBefore);
});

test('an autostart write failure preserves native order and reports a failed sync', () => {
    const options = { failNativeWrite: true };
    const explicit = explicitOrderFixture('start-sync', options);
    assertOrderSyncRefused(explicit, 'docker_order_native_write_failed', 'native write failure');
    const postSave = explicitOrderFixture('sync', options);
    assert.equal(postSave.error, '');
    assert.equal(postSave.responseStatus, 200);
    assert.equal(postSave.response.ok, true);
    assert.equal(postSave.response.syncOutcome, 'failed');
    assert.equal(postSave.response.errorCode, 'docker_order_native_write_failed');
    assert.equal(postSave.native, postSave.nativeBefore);
    assert.equal(postSave.nativeMode, postSave.nativeModeBefore);
});

test('a guarded folder batch stays saved and reports unsynced native order after a write failure', () => {
    const batch = explicitOrderFixture('batch', { failNativeWrite: true });
    assert.equal(batch.error, '');
    assert.equal(batch.responseStatus, 200);
    assert.equal(batch.response?.ok, true);
    const result = batch.response.result;
    assert.equal(result.dockerOrderSynced, false);
    assert.equal(result.createdIds.length, 1);
    assert.equal(batch.folders[result.createdIds[0]].name, 'Persisted while native unavailable');
    assert.equal(result.metadata.folderRevision, batch.metadata.folderRevision);
    assert.equal(batch.native, batch.nativeBefore);
});

test('post-save sync preserves native records and returns its outcome for unusable inventory', () => {
    for (const scenario of ['failed-list', 'disabled', 'http-error', 'malformed-body', 'missing-body', 'malformed-list', 'duplicate']) {
        const result = runInventoryRepair({ type: 'docker', operation: 'sync', scenario });
        assert.equal(result.error, '');
        assert.equal(result.response.ok, true);
        assert.equal(result.response.syncOutcome, 'failed', scenario);
        assert.equal(result.response.errorCode, 'docker_order_inventory_unavailable', scenario);
        assert.equal(result.native, result.nativeBefore, scenario);
    }
    const result = runInventoryRepair({ type: 'docker', operation: 'sync', scenario: 'healthy', plan: { mode: 'unmanaged' } });
    assert.equal(result.error, '');
    assert.equal(result.response.syncOutcome, 'unmanaged');
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
    assert.equal(result.response.syncOutcome, 'failed');
    assert.equal(result.response.errorCode, 'docker_order_native_changed');
});
