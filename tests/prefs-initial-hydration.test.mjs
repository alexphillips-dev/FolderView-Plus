import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const source = process.env.FVPLUS_DRAFT_PREFS || path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.prefs-store.js');
const api = require(source);
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('saves queued during initial hydration cannot start concurrent preference writes', async () => {
    let timerId = 0, active = 0, maximum = 0;
    const timers = new Map(), reads = [], writes = [];
    const normalizePrefs = prefs => ({ ...prefs, _metadata: { prefsRevision: 0, ...prefs?._metadata } });
    const coordinator = api.createPreferenceSaveCoordinator({ window: {}, storage: null, normalizePrefs, debounceMs: 0,
        setTimeout: callback => { timers.set(++timerId, callback); return timerId; }, clearTimeout: id => timers.delete(id),
        fetchPrefs: () => { const read = deferred(); reads.push(read); return read.promise; },
        writePrefs: (_type, patch) => {
            const gate = deferred(); active++; maximum = Math.max(maximum, active);
            writes.push({ patch, gate }); return gate.promise.finally(() => { active--; });
        }
    });
    const fire = () => { const [id, callback] = timers.entries().next().value; timers.delete(id); callback(); };
    const first = coordinator.save('docker', { dashboard: { names: false } }, { immediate: true });
    fire();
    const second = coordinator.save('docker', { dashboard: { ports: false } }, { immediate: true });
    fire();
    assert.equal(reads.length, 2);
    reads.forEach(read => read.resolve({ prefs: { dashboard: { names: true, ports: true } }, metadata: { prefsRevision: 1 } }));
    await new Promise(resolve => setImmediate(resolve));
    writes.forEach(({ gate }, index) => gate.resolve({ prefs: { dashboard: { names: false, ports: false } }, metadata: { prefsRevision: index + 2 } }));
    await Promise.all([first, second]);
    assert.equal(writes.length, 1, 'the second hydration continuation must recheck active work');
    assert.equal(maximum, 1);
    assert.deepEqual(writes[0].patch, { dashboard: { names: false, ports: false } });
    assert.equal(coordinator.getOptimisticPrefs('docker').dashboard.names, false);
    assert.equal(coordinator.getOptimisticPrefs('docker').dashboard.ports, false);
});

test('a legacy write acknowledgement remains authoritative when an equal-revision read returns before it', async () => {
    const timers = [], read = deferred(), write = deferred();
    const coordinator = api.createPreferenceSaveCoordinator({ window: {}, storage: null, debounceMs: 0,
        normalizePrefs: prefs => ({ ...prefs, _metadata: { prefsRevision: 0, ...prefs?._metadata } }),
        setTimeout: callback => { timers.push(callback); return timers.length; }, clearTimeout() {},
        fetchPrefs: () => read.promise, writePrefs: () => write.promise
    });
    coordinator.reconcile('docker', { dashboard: { names: true }, _metadata: { prefsRevision: 0 } });
    const saved = coordinator.save('docker', { dashboard: { names: false } }, { immediate: true });
    timers.shift()();
    const hydration = coordinator.hydrateFromServer('docker', { replay: false });
    read.resolve({ prefs: { dashboard: { names: true } }, metadata: { prefsRevision: 0 } });
    await hydration;
    assert.equal(coordinator.getOptimisticPrefs('docker').dashboard.names, false);
    write.resolve({ prefs: { dashboard: { names: false } }, metadata: { prefsRevision: 0 } });
    await saved;
    assert.equal(coordinator.getOptimisticPrefs('docker').dashboard.names, false, 'a read-only publication must not invalidate the received write acknowledgement');
});


for (const revision of [0, 7]) {
    for (const source of ['broadcast', 'reconcile']) {
        test(`an equal-revision ${source} commit fences a late write acknowledgement (revision ${revision})`, async () => {
            const timers = [], write = deferred();
            let receive;
            class Channel {
                addEventListener(_kind, listener) { receive = listener; }
                postMessage() {}
            }
            const coordinator = api.createPreferenceSaveCoordinator({ window: {}, storage: null, debounceMs: 0,
                BroadcastChannel: Channel,
                normalizePrefs: prefs => ({ ...prefs, _metadata: { prefsRevision: 0, ...prefs?._metadata } }),
                setTimeout: callback => { timers.push(callback); return timers.length; }, clearTimeout() {},
                writePrefs: () => write.promise
            });
            coordinator.reconcile('docker', { dashboard: { names: true, ports: true }, _metadata: { prefsRevision: revision } });
            const saved = coordinator.save('docker', { dashboard: { names: false } }, { immediate: true });
            timers.shift()();
            const confirmed = { dashboard: { names: false, ports: false }, _metadata: { prefsRevision: revision } };
            if (source === 'broadcast') {
                receive({ data: { action: 'committed', type: 'docker', sourceId: 'fixture-other-page', prefs: confirmed } });
            } else {
                coordinator.reconcile('docker', confirmed);
            }
            write.resolve({ prefs: { dashboard: { names: false, ports: true } }, metadata: { prefsRevision: revision } });
            const result = await saved;
            assert.equal(result.dashboard.ports, false, 'an observed independent commit must not be overwritten by an earlier equal-revision response');
            assert.equal(coordinator.getOptimisticPrefs('docker').dashboard.ports, false);
            assert.equal(coordinator.getSnapshot('docker').pending, false);
            assert.equal(coordinator.getSnapshot('docker').revision, revision);
        });
    }
}

test('a numerically newer write acknowledgement wins after an intervening external commit', async () => {
    const timers = [], write = deferred();
    const coordinator = api.createPreferenceSaveCoordinator({ window: {}, storage: null, debounceMs: 0,
        normalizePrefs: prefs => prefs,
        setTimeout: callback => { timers.push(callback); return timers.length; }, clearTimeout() {},
        writePrefs: () => write.promise
    });
    coordinator.reconcile('docker', { dashboard: { names: true, ports: true }, _metadata: { prefsRevision: 1 } });
    const saved = coordinator.save('docker', { dashboard: { names: false } }, { immediate: true });
    timers.shift()();
    coordinator.reconcile('docker', { dashboard: { names: true, ports: false }, _metadata: { prefsRevision: 2 } });
    write.resolve({ prefs: { dashboard: { names: false, ports: false } }, metadata: { prefsRevision: 3 } });
    assert.equal((await saved).dashboard.names, false);
    assert.equal(coordinator.getSnapshot('docker').revision, 3);
});

test('an external legacy commit fences both an earlier read and an earlier write', async () => {
    const timers = [], read = deferred(), write = deferred();
    const coordinator = api.createPreferenceSaveCoordinator({ window: {}, storage: null, debounceMs: 0,
        normalizePrefs: prefs => prefs,
        setTimeout: callback => { timers.push(callback); return timers.length; }, clearTimeout() {},
        fetchPrefs: () => read.promise, writePrefs: () => write.promise
    });
    coordinator.reconcile('docker', { dashboard: { names: true, ports: true }, _metadata: { prefsRevision: 0 } });
    const hydration = coordinator.hydrateFromServer('docker', { replay: false });
    const saved = coordinator.save('docker', { dashboard: { names: false } }, { immediate: true });
    timers.shift()();
    coordinator.reconcile('docker', { dashboard: { names: false, ports: false }, _metadata: { prefsRevision: 0 } });
    read.resolve({ prefs: { dashboard: { names: true, ports: true } }, metadata: { prefsRevision: 0 } });
    await hydration;
    write.resolve({ prefs: { dashboard: { names: false, ports: true } }, metadata: { prefsRevision: 0 } });
    await saved;
    assert.equal(coordinator.getOptimisticPrefs('docker').dashboard.ports, false);
    assert.equal(coordinator.getOptimisticPrefs('docker').dashboard.names, false);
});
