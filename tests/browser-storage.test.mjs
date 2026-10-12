import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const scripts = '../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/';
const foundation = require(scripts + 'folderviewplus.utils-foundation.js');
const dashboard = require(scripts + 'dashboard.state-store.js');
const prefs = require(scripts + 'folderviewplus.prefs-store.js');
const columnController = require(scripts + 'docker.runtime.column-controller.js');
const dockerDiagnostics = require(scripts + 'docker.runtime.diagnostics.js');
const refreshDiagnostics = require(scripts + 'docker.runtime.refresh-diagnostics.js');
const vmLifecycle = require(scripts + 'vm.runtime.lifecycle.js');
const blockedWindow = () => Object.defineProperty({}, 'localStorage', { get() { throw new Error('Storage denied'); } });
const memoryStorage = () => {
    const records = new Map();
    return { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value), removeItem: key => records.delete(key) };
};

test('batched writer contains acquisition failures on immediate, delayed, idle and flush paths', async () => {
    const window = blockedWindow();
    const context = { window, module: { exports: {} }, setTimeout, clearTimeout, console };
    vm.runInNewContext(fs.readFileSync(new URL(scripts + 'folderviewplus.utils-foundation.js', import.meta.url), 'utf8'), context);
    const writer = context.module.exports.createBatchedStorageWriter();
    assert.doesNotThrow(() => writer.setItem('immediate', '1', { delayMs: 0 }));
    writer.setItem('delayed', '2', { delayMs: 5 });
    writer.setItem('idle', '3', { delayMs: 0, idle: true });
    writer.removeItem('remove', { delayMs: 0 });
    writer.setItem('flush', '4');
    assert.doesNotThrow(() => writer.flush());
    await new Promise(resolve => setTimeout(resolve, 100));
});

test('Dashboard store survives denied acquisition and reports unavailable writes honestly', () => {
    const store = dashboard.createStore({ window: blockedWindow() });
    assert.deepEqual(store.read('docker'), {});
    assert.equal(store.write('docker', { one: true }), false);
    assert.equal(store.patch('vm', { two: true }), false);
    assert.equal(store.clear('docker'), false);
});

test('explicit unavailable storage never falls back; injected stores bypass denied browser storage', () => {
    const window = blockedWindow();
    const store = dashboard.createStore({ window, storage: null });
    assert.deepEqual(store.read('vm'), {});
    const storage = memoryStorage();
    const injected = dashboard.createStore({ window, storage });
    assert.equal(injected.write('docker', { one: true }), true);
    assert.deepEqual(injected.read('docker'), { one: true });
    assert.equal(injected.clear('docker'), true);
    assert.deepEqual(injected.read('docker'), {});
    const writer = foundation.createBatchedStorageWriter(storage);
    writer.setItem('keep', 'injected', { delayMs: 0 });
    assert.equal(storage.getItem('keep'), 'injected');
});

test('normal storage fallback works while explicit null and injected stores leave browser storage untouched', () => {
    const browserStorage = memoryStorage(), injected = memoryStorage();
    let acquired = 0;
    const window = Object.defineProperty({}, 'localStorage', { get() { acquired++; return browserStorage; } });
    const context = { window, module: { exports: {} }, setTimeout, clearTimeout, console };
    vm.runInNewContext(fs.readFileSync(new URL(scripts + 'folderviewplus.utils-foundation.js', import.meta.url), 'utf8'), context);
    const api = context.module.exports;
    assert.equal(api.resolveBrowserStorage(null, window), null);
    const disabled = api.createBatchedStorageWriter(null);
    disabled.setItem('disabled', 'no', { delayMs: 0 });
    const writer = api.createBatchedStorageWriter(injected);
    writer.setItem('injected', 'yes', { delayMs: 0 });
    assert.equal(acquired, 0);
    const automatic = api.createBatchedStorageWriter();
    automatic.setItem('automatic', 'yes', { delayMs: 0 });
    assert.equal(browserStorage.getItem('automatic'), 'yes');
    assert.equal(browserStorage.getItem('disabled'), null);
    assert.equal(injected.getItem('injected'), 'yes');
    automatic.removeItem('automatic', { delayMs: 0 });
    assert.equal(browserStorage.getItem('automatic'), null);
});

test('throwing storage methods and quota failures cannot escape either writer or Dashboard store', () => {
    for (const mode of ['methods', 'quota']) {
        const storage = { getItem: mode === 'methods' ? () => { throw new Error('Read denied'); } : () => '{"old":true}',
            setItem() { throw new Error('Write denied'); }, removeItem() { throw new Error('Remove denied'); } };
        const writer = foundation.createBatchedStorageWriter(storage);
        assert.doesNotThrow(() => writer.setItem('key', 'value', { delayMs: 0 }));
        assert.doesNotThrow(() => writer.removeItem('key', { delayMs: 0 }));
        const store = dashboard.createStore({ storage });
        assert.deepEqual(store.read('docker'), mode === 'methods' ? {} : { old: true });
        assert.equal(store.write('docker', { one: true }), false);
        assert.equal(store.clear('docker'), false);
    }
});

test('dependent runtime factories guard acquisition and preserve explicit null and injected storage', () => {
    for (const create of [columnController.createController, dockerDiagnostics.createApi, refreshDiagnostics.createTracker, vmLifecycle.createApi]) {
        const window = blockedWindow();
        Object.assign(window, { setTimeout, clearTimeout });
        for (const storage of [undefined, null, memoryStorage()]) {
            assert.doesNotThrow(() => {
                const api = create({ window, storage, localStorage: storage });
                api.dispose?.();
            });
        }
    }
});

for (const mode of ['getter', 'null', 'methods', 'quota']) {
    test(`server preference saves continue with ${mode} storage`, async () => {
        const storage = mode === 'methods' ? {
            getItem() { throw new Error('Read denied'); }, setItem() { throw new Error('Write denied'); }, removeItem() { throw new Error('Remove denied'); }
        } : mode === 'quota' ? { ...memoryStorage(), setItem() { throw new Error('Quota exceeded'); } } : null;
        const window = mode === 'getter' ? blockedWindow() : { localStorage: storage };
        let server = { dashboard: { names: true }, _metadata: { prefsRevision: 1 } };
        let writes = 0;
        const coordinator = prefs.createPreferenceSaveCoordinator({ window, debounceMs: 0,
            fetchPrefs: async () => server, writePrefs: async (_type, patch) => {
                writes++;
                server = { ...server, dashboard: { ...server.dashboard, ...patch.dashboard }, _metadata: { prefsRevision: 2 } };
                return { ok: true, prefs: server, metadata: server._metadata };
            } });
        try {
            await coordinator.hydrateFromServer('docker');
            await coordinator.save('docker', { dashboard: { names: false } }, { immediate: true });
            assert.equal(writes, 1);
            assert.equal(server.dashboard.names, false);
            assert.equal(coordinator.getDiagnostics().types.docker.status, 'saved');
        } finally { await coordinator.flush('docker'); }
    });
}
