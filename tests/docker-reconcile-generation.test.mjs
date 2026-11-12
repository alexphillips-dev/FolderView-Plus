import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createApi } = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.reconcile.js');
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

for (const rejected of [false, true]) {
    test(`superseded same-container Docker lifecycle ${rejected ? 'failure' : 'success'} cannot publish or restart a settled action`, async () => {
        const timers = [], events = [], finalized = [];
        let finishOld, requests = 0, observations = 0;
        const api = createApi({
            window: { setTimeout: callback => timers.push(callback) },
            lifecycleRefreshDelaysMs: [0, 1],
            refreshDockerRuntimeStateInPlace: () => ++requests === 1
                ? new Promise((resolve, reject) => { finishOld = () => rejected ? reject(new Error('Fixture failure')) : resolve(true); })
                : Promise.resolve(true),
            isDockerLifecycleStateSettled: () => true,
            getDockerLifecycleStateSnapshot: () => { observations++; return { state: 'running' }; },
            appendDockerBulkUpdateTrace: (event, details) => events.push({ event, details }),
            finalizeDockerLifecycleSurface: (request, outcome) => finalized.push({ request, outcome })
        });
        api.runDockerLifecycleRefresh({ action: 'stop', container: 'current' });
        timers[0]();
        api.runDockerLifecycleRefresh({ action: 'start', container: 'current' });
        timers[2]();
        await flush();
        assert.equal(finalized.length, 1);
        assert.equal(finalized[0].request.container, 'current');
        assert.equal(finalized[0].request.action, 'start');
        const priorEventCount = events.length, priorObservations = observations;
        finishOld();
        await flush();
        assert.equal(events.length, priorEventCount, 'stale completion must not publish lifecycle diagnostics');
        assert.equal(observations, priorObservations, 'stale completion must not inspect the current runtime state');
        timers[1]();
        timers[3]();
        await flush();
        assert.equal(requests, 2, 'stale success must not reopen the newer settled generation');
        assert.equal(finalized.length, 1, 'stale completion must not invoke cleanup or fallback');
    });
}

test('current Docker lifecycle failure still exhausts attempts and finalizes once', async () => {
    const timers = [], finalized = [];
    const api = createApi({
        window: { setTimeout: callback => timers.push(callback) },
        lifecycleRefreshDelaysMs: [0, 1],
        refreshDockerRuntimeStateInPlace: async () => { throw new Error('Fixture failure'); },
        finalizeDockerLifecycleSurface: (request, outcome) => finalized.push(outcome)
    });
    api.runDockerLifecycleRefresh({ action: 'start', container: 'current' });
    timers[0](); await flush();
    assert.equal(finalized.length, 0);
    timers[1](); await flush();
    assert.equal(finalized.length, 1);
    assert.equal(finalized[0].reason, 'attempts-exhausted');
    assert.equal(finalized[0].success, false);
});
