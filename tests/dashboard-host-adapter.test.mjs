import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(process.cwd());
const scriptsRoot = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts'
);
const dashboardHostAdapterModule = require(path.join(scriptsRoot, 'dashboard.host-adapter.js'));
const runtimeHostAdapterModule = require(path.join(scriptsRoot, 'runtime.host-adapter.js'));
const dashboardStateStoreModule = require(path.join(scriptsRoot, 'dashboard.state-store.js'));
const dashboardScript = fs.readFileSync(path.join(scriptsRoot, 'dashboard.js'), 'utf8');
const dashboardPage = fs.readFileSync(
    path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.Dashboard.page'),
    'utf8'
);

test('Dashboard loads shared ordering after the host adapter and before its runtime', () => {
    const hostAdapterIndex = dashboardPage.indexOf('/plugins/folderview.plus/scripts/runtime.host-adapter.js');
    const orderingIndex = dashboardPage.indexOf('/plugins/folderview.plus/scripts/runtime.folder-ordering.js');
    const runtimeIndex = dashboardPage.indexOf('/plugins/folderview.plus/scripts/dashboard.js');
    assert.ok(hostAdapterIndex >= 0 && orderingIndex >= 0 && runtimeIndex >= 0);
    assert.ok(hostAdapterIndex < orderingIndex && orderingIndex < runtimeIndex);
});

const nextTurn = () => new Promise((resolve) => setTimeout(resolve, 0));
const createHarness = ({ renderFolders = async () => true } = {}) => {
    const prefilters = [];
    const nativeCalls = [];
    const preparedTypes = [];
    const emittedEvents = [];
    let spinnerHideCount = 0;
    const document = { querySelector: () => null };
    const window = {
        document,
        location: { href: 'http://unraid.local/Dashboard' },
        loadlist: (...args) => {
            nativeCalls.push(args);
            return 'native-result';
        },
        CustomEvent: class CustomEvent {
            constructor(type, options = {}) {
                this.type = type;
                this.detail = options.detail;
            }
        },
        dispatchEvent: (event) => emittedEvents.push(event)
    };
    const $ = () => ({ hide: () => { spinnerHideCount += 1; } });
    $.ajaxPrefilter = (callback) => prefilters.push(callback);
    const runtimeHostAdapter = runtimeHostAdapterModule.createHostAdapter('docker', { window, document });
    const adapter = dashboardHostAdapterModule.createAdapter({
        window,
        document,
        $,
        runtimeHostAdapter,
        prepareFolderRequests: (type) => preparedTypes.push(type),
        renderFolders,
        hideSpinner: () => { spinnerHideCount += 1; }
    });
    return {
        window,
        adapter,
        prefilters,
        nativeCalls,
        preparedTypes,
        emittedEvents,
        getSpinnerHideCount: () => spinnerHideCount
    };
};

test('Dashboard host adapter owns one idempotent loadlist wrapper and one DashboardApps prefilter', async () => {
    let renderCount = 0;
    const harness = createHarness({
        renderFolders: async () => {
            renderCount += 1;
            return true;
        }
    });
    harness.adapter.bind();
    harness.adapter.bind();
    assert.equal(harness.prefilters.length, 1);
    assert.equal(harness.window.loadlist('dashboard'), 'native-result');
    assert.deepEqual(harness.nativeCalls, [['dashboard']]);
    assert.deepEqual(harness.preparedTypes, ['docker', 'vm']);

    const jqXHR = { promise: () => Promise.resolve() };
    harness.prefilters[0]({ url: '/webGui/include/DashboardApps.php?source=fixture' }, {}, jqXHR);
    harness.prefilters[0]({ url: 'http://unraid.local/webGui/include/DashboardApps.php' }, {}, jqXHR);
    await nextTurn();
    await nextTurn();

    const snapshot = harness.adapter.getSnapshot();
    assert.equal(renderCount, 1, 'one native generation must produce one grouped render');
    assert.equal(snapshot.generation, 1);
    assert.equal(snapshot.nativeRequestCount, 2);
    assert.equal(snapshot.nativeRowsLoadedCount, 2);
    assert.equal(snapshot.foldersGroupedCount, 1);
    assert.equal(snapshot.foldersGrouped, true);
    assert.equal(snapshot.runtimeHost.hooks.loadlist.callCount, 1);
    assert.equal(harness.getSpinnerHideCount(), 1);
    assert.ok(harness.emittedEvents.some((event) => event.type === 'fvplus:dashboard:nativeRowsLoaded'));
    assert.ok(harness.emittedEvents.some((event) => event.type === 'fvplus:dashboard:foldersGrouped'));
});

test('Dashboard host adapter ignores stale native responses from an older load generation', async () => {
    const pending = [];
    let renderCount = 0;
    const harness = createHarness({
        renderFolders: async () => {
            renderCount += 1;
            return true;
        }
    });
    harness.adapter.bind();
    harness.window.loadlist('first');
    const firstPromise = new Promise((resolve) => pending.push(resolve));
    harness.prefilters[0]({ url: '/webGui/include/DashboardApps.php' }, {}, { promise: () => firstPromise });
    harness.window.loadlist('second');
    const secondPromise = new Promise((resolve) => pending.push(resolve));
    harness.prefilters[0]({ url: '/webGui/include/DashboardApps.php' }, {}, { promise: () => secondPromise });

    pending[0]();
    await nextTurn();
    pending[1]();
    await nextTurn();
    await nextTurn();

    const snapshot = harness.adapter.getSnapshot();
    assert.equal(snapshot.generation, 2);
    assert.equal(snapshot.staleCompletionCount, 1);
    assert.equal(snapshot.foldersGroupedCount, 1);
    assert.equal(renderCount, 1);
});

test('Dashboard host adapter publishes runtime action completion telemetry', () => {
    const harness = createHarness();
    harness.adapter.bind();
    harness.adapter.notifyRuntimeActionCompleted({ action: 'start', containerId: 'abc123', settled: true });
    const snapshot = harness.adapter.getSnapshot();
    assert.equal(snapshot.runtimeActionCompletedCount, 1);
    assert.equal(snapshot.events.at(-1).name, 'runtimeActionCompleted');
    assert.equal(snapshot.events.at(-1).action, 'start');
    assert.ok(harness.emittedEvents.some((event) => event.type === 'fvplus:dashboard:runtimeActionCompleted'));
});

test('Dashboard expanded-state store normalizes, batches, patches, and survives corrupt state', () => {
    const values = new Map();
    const writes = [];
    const storage = {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: (key) => values.delete(key)
    };
    const writer = {
        setItem: (key, value, options) => {
            writes.push({ key, value, options });
            values.set(key, value);
        }
    };
    const store = dashboardStateStoreModule.createStore({ storage, writer });
    assert.equal(store.write('docker', { media: true, '': true, tools: 1 }), true);
    assert.deepEqual(JSON.parse(writes[0].value), { media: true, tools: false });
    assert.deepEqual(writes[0].options, { delayMs: 80, idle: true });
    assert.equal(store.patch('docker', { media: true }), false, 'unchanged state should not schedule a write');
    assert.equal(store.patch('docker', { media: false, cloud: true }), true);
    assert.deepEqual(store.read('docker'), { media: false, tools: false, cloud: true });
    values.set(dashboardStateStoreModule.EXPANDED_STATE_STORAGE_KEYS.vm, '{bad json');
    assert.deepEqual(store.read('vm'), {});
});

test('Dashboard page loads extracted modules before the monolith and no longer patches host globals directly', () => {
    assert.match(dashboardPage, /runtime\.host-adapter\.js[\s\S]*dashboard\.host-adapter\.js[\s\S]*dashboard\.runtime-surface\.js[\s\S]*dashboard\.state-store\.js[\s\S]*dashboard\.js/);
    assert.match(dashboardScript, /dashboardHostAdapterModule\.getOrCreate\(/);
    assert.match(dashboardScript, /dashboardHostAdapter\.bind\(\)/);
    assert.match(dashboardScript, /dashboardRuntimeSurfaceModule\.createApi\(/);
    assert.match(dashboardScript, /dashboardStateStoreModule\?\.createStore\?\./);
    assert.doesNotMatch(dashboardScript, /window\.loadlist\s*=(?!=)/);
    assert.doesNotMatch(dashboardScript, /\$\.ajaxPrefilter\(/);
});
