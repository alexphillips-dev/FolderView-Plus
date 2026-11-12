import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const scripts = '../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/';
const source = fs.readFileSync(new URL(scripts + 'dashboard.js', import.meta.url), 'utf8');
const functions = source.slice(source.indexOf('const DASHBOARD_HEALTH_EMPHASIS_STORAGE_KEYS ='), source.indexOf('const getDashboardStartedOnlySelectorForType ='));
const foundation = fs.readFileSync(new URL(scripts + 'folderviewplus.utils-foundation.js', import.meta.url), 'utf8');

function fixture(useWriter = true) {
    const values = new Map(), timers = new Map();
    let nextId = 0;
    const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    const context = { window: { localStorage: storage }, module: { exports: {} },
        setTimeout: callback => { timers.set(++nextId, callback); return nextId; }, clearTimeout: id => timers.delete(id) };
    vm.runInNewContext(foundation, context);
    context.dashboardStorageWriter = useWriter ? context.module.exports.createBatchedStorageWriter(storage) : null;
    vm.runInNewContext(functions + `;globalThis.api = {
        health: { read: readDashboardHealthEmphasisStateForType, write: writeDashboardHealthEmphasisStateForType },
        density: { read: readDashboardCompactDensityStateForType, write: writeDashboardCompactDensityStateForType }
    };`, context);
    return { ...context.api, timers, storage };
}

for (const type of ['docker', 'vm']) for (const kind of ['health', 'density']) {
    test(`Dashboard ${type} ${kind} quick toggle is immediately readable before timer or idle work`, () => {
        const f = fixture(), state = f[kind];
        assert.equal(state.read(type), false);
        state.write(type, !state.read(type));
        assert.equal(state.read(type), true);
        state.write(type, !state.read(type));
        assert.equal(state.read(type), false);
        assert.equal(f.timers.size, 0);
    });
}

test('Dashboard quick state preserves direct storage fallback and contains storage errors', () => {
    const f = fixture(false);
    f.health.write('docker', true);
    assert.equal(f.health.read('docker'), true);
    f.storage.setItem = () => { throw new Error('Fixture quota error'); };
    assert.doesNotThrow(() => f.density.write('vm', true));
    assert.equal(f.density.read('vm'), false);
});
