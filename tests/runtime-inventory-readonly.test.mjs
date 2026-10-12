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

test('explicit managed sync uses fresh authority to clean stale records while retaining order and native waits', () => {
    for (const scenario of ['healthy', 'stale-cache', 'failed-detail']) {
        const result = runInventoryRepair({ type: 'docker', operation: 'sync', scenario });
        assert.equal(result.error, '');
        assert.equal(result.response.ok, true);
        assert.equal(result.native, 'docker-extra 19\ndocker-present 7\n');
        assert.ok(result.calls.some(([call, count]) => call === 'docker-list' && count === 5));
        assert.ok(result.calls.every(([call]) => call !== 'docker-cached-list'));
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
