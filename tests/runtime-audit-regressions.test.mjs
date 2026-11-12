import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const scripts = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts');
const liveRefresh = require(path.join(scripts, 'runtime.live-refresh.js'));
const subscription = require(path.join(scripts, 'runtime.transport.subscription.js'));
const expandedState = require(path.join(scripts, 'folder.runtime.state-observers.js'));

const createTimers = () => {
    let nextId = 0;
    const timeouts = new Map(), intervals = new Map();
    return {
        timeouts, intervals,
        setTimeout(callback) { const id = ++nextId; timeouts.set(id, callback); return id; },
        clearTimeout(id) { timeouts.delete(id); },
        setInterval(callback) { const id = ++nextId; intervals.set(id, callback); return id; },
        clearInterval(id) { intervals.delete(id); }
    };
};

test('a failed lazy asset is loaded again before retry resolves', async () => {
    const elements = [];
    let created = 0;
    const document = {
        readyState: 'complete', scripts: elements,
        head: { appendChild(element) { elements.push(element); } },
        createElement() {
            created++;
            return {
                dataset: {}, listeners: {},
                addEventListener(event, callback) { this.listeners[event] = callback; },
                remove() { elements.splice(elements.indexOf(this), 1); }
            };
        }
    };
    const window = { location: { href: 'https://fixture.test/Dashboard' } };
    vm.runInNewContext(fs.readFileSync(path.join(scripts, 'runtime.asset-loader.js'), 'utf8'), { window, document, URL });
    const loader = window.FolderViewPlusAssetLoader;
    const url = 'https://fixture.test/chart.js';
    const first = loader.loadScript(url);
    elements[0].listeners.error();
    await assert.rejects(first, /Failed to load/);
    let resolved = false;
    const retry = loader.loadScript(url).then(() => { resolved = true; });
    await Promise.resolve();
    assert.equal(resolved, false, 'retry must wait for a new load event');
    assert.equal(created, 2);
    elements.at(-1).listeners.load();
    await retry;
    await loader.loadScript(url);
    assert.equal(created, 2, 'successful assets remain deduplicated');
});

const createSubscriptionFixture = () => {
    const timers = createTimers(), sockets = [], streams = [];
    class Socket {
        constructor() { this.readyState = 0; this.listeners = {}; this.sent = []; sockets.push(this); }
        addEventListener(event, callback) { this.listeners[event] = callback; }
        send(data) { this.sent.push(JSON.parse(data)); }
        close() { this.readyState = 3; }
        emit(event, payload = {}) { this.listeners[event]?.(payload); }
    }
    class Stream {
        constructor() { streams.push(this); }
        close() { this.closed = true; }
    }
    const window = { ...timers, WebSocket: Socket, EventSource: Stream };
    const api = subscription.createRuntime({ RuntimeTransportError: Error, fallbackWindow: window });
    return { api, sockets, streams, timers };
};

for (const transport of ['websocket', 'sse', 'poll']) {
    test(`an already-aborted ${transport} subscription never starts`, () => {
        const { api, sockets, streams, timers } = createSubscriptionFixture();
        const controller = new AbortController();
        controller.abort();
        let polls = 0;
        const options = transport === 'websocket' ? { webSocketUrl: 'wss://fixture.test/graphql' }
            : transport === 'sse' ? { sseUrl: '/fixture-events' }
                : { poll: () => { polls++; } };
        const dispose = api.subscribe({ ...options, signal: controller.signal });
        assert.equal(sockets.length + streams.length + polls, 0);
        assert.equal(timers.timeouts.size + timers.intervals.size, 0);
        assert.equal(dispose.snapshot().disposed, true);
        assert.equal(dispose.snapshot().status, 'closed');
    });
}

test('disposed WebSocket subscriptions ignore queued events', () => {
    const { api, sockets, timers } = createSubscriptionFixture();
    let deliveries = 0, errors = 0;
    const dispose = api.subscribe({ webSocketUrl: 'wss://fixture.test/graphql', onData() { deliveries++; }, onError() { errors++; } });
    const socket = sockets[0];
    dispose();
    socket.emit('open');
    socket.emit('message', { data: JSON.stringify({ type: 'next', payload: { data: {} } }) });
    socket.emit('message', { data: JSON.stringify({ type: 'connection_ack' }) });
    socket.emit('error');
    socket.emit('close', { code: 1006 });
    assert.equal(deliveries + errors, 0);
    assert.equal(socket.sent.length, 0);
    assert.equal(timers.timeouts.size, 0);
    assert.equal(dispose.snapshot().status, 'closed');
});

test('disposed event streams ignore queued events', () => {
    const { api, streams } = createSubscriptionFixture();
    let deliveries = 0, errors = 0;
    const dispose = api.subscribe({ sseUrl: '/fixture-events', onData() { deliveries++; }, onError() { errors++; } });
    const stream = streams[0];
    dispose();
    stream.onopen();
    stream.onmessage({ data: '{}' });
    stream.onerror();
    assert.equal(deliveries + errors, 0);
    assert.equal(dispose.snapshot().status, 'closed');
});

test('changing refresh cadence preserves exclusion until the active refresh settles', async () => {
    const timers = createTimers();
    let calls = 0, finish;
    const controller = liveRefresh.createController({
        window: timers,
        tick() { calls++; return new Promise(resolve => { finish = resolve; }); }
    });
    controller.schedule('default', { enabled: true, intervalMs: 1000 });
    const active = controller.run();
    await Promise.resolve();
    controller.schedule('default', { enabled: true, intervalMs: 2000 });
    const overlapping = controller.run();
    await Promise.resolve();
    assert.equal(calls, 1);
    assert.equal(await overlapping, false);
    finish();
    await active;
    for (const callback of [...timers.timeouts.values()]) callback();
    assert.equal(controller.snapshot().inFlightByKey.default, false);
    controller.dispose();
});

test('disposing before the queued refresh starts prevents its request', async () => {
    const timers = createTimers();
    let calls = 0;
    const controller = liveRefresh.createController({ window: timers, tick() { calls++; } });
    const active = controller.run();
    controller.dispose();
    assert.equal(await active, false);
    assert.equal(calls, 0);
    assert.equal(timers.timeouts.size + timers.intervals.size, 0);
});

test('refresh cadence changes release a completed cooldown without blocking future work', async () => {
    const timers = createTimers();
    let calls = 0;
    const controller = liveRefresh.createController({ window: timers, tick() { calls++; } });
    controller.schedule('default', { enabled: true, intervalMs: 1000 });
    await controller.run();
    assert.equal(timers.timeouts.size, 1);
    controller.schedule('default', { enabled: true, intervalMs: 2000 });
    assert.equal(timers.timeouts.size, 0);
    assert.equal(await controller.run(), true);
    assert.equal(calls, 2);
    controller.dispose();
});

test('a retired socket cannot deliver data or close its replacement', () => {
    const { api, sockets, timers } = createSubscriptionFixture();
    let deliveries = 0;
    const dispose = api.subscribe({ webSocketUrl: 'wss://fixture.test/graphql', onData() { deliveries++; } });
    const first = sockets[0];
    first.emit('close', { code: 1006 });
    const reconnect = [...timers.timeouts.values()][0];
    timers.timeouts.clear();
    reconnect();
    const second = sockets[1];
    second.readyState = 1;
    second.emit('open');
    second.emit('message', { data: JSON.stringify({ type: 'connection_ack' }) });
    first.emit('message', { data: JSON.stringify({ type: 'next', payload: { data: {} } }) });
    first.emit('close', { code: 1006 });
    assert.equal(dispose.snapshot().status, 'active');
    second.emit('message', { data: JSON.stringify({ type: 'next', payload: { data: {} } }) });
    assert.equal(deliveries, 1);
    assert.equal(sockets.length, 2);
    dispose();
    assert.equal(second.readyState, 3);
    assert.equal(timers.timeouts.size, 0);
});

test('Docker bootstrap does not load runtime after leaving during custom-script loading', async () => {
    let pagehide, finishCustom, appended = 0;
    const window = {
        document: {
            querySelector: () => null, querySelectorAll: () => [],
            createElement: () => ({ dataset: {} }),
            head: { appendChild(script) { appended++; script.onload(); } }
        },
        FolderViewPlusDockerRuntimeAssetUrl: '/fixture-runtime.js',
        FolderViewPlusDockerHostCompatibilityDecision: { hostGeneration: 'legacy-docker-table', runtimeActivationAllowed: true },
        FolderViewPlusDockerLoadCustomScripts: () => new Promise(resolve => { finishCustom = resolve; }),
        addEventListener(event, callback) { if (event === 'pagehide') pagehide = callback; }
    };
    vm.runInNewContext(fs.readFileSync(path.join(scripts, 'docker.bootstrap.js'), 'utf8'), { window });
    await Promise.resolve();
    pagehide();
    finishCustom();
    const result = await window.FolderViewPlusDockerBootstrapPromise;
    assert.equal(appended, 0);
    assert.equal(result.loaded, false);
    assert.equal(result.reason, 'page-exited');
});

test('concurrent chart requests wait for adapters even after Chart becomes available', async () => {
    const elements = [];
    const document = {
        readyState: 'complete', scripts: elements,
        head: { appendChild(element) { elements.push(element); } },
        createElement: () => ({ dataset: {}, handlers: {}, addEventListener(event, callback) { this.handlers[event] = callback; } })
    };
    const window = {
        location: { href: 'https://fixture.test/Dashboard' },
        FolderViewPlusAssetUrls: { chartStack: ['https://fixture.test/chart.js', 'https://fixture.test/adapter.js'] }
    };
    vm.runInNewContext(fs.readFileSync(path.join(scripts, 'runtime.asset-loader.js'), 'utf8'), { window, document, URL });
    const first = window.FolderViewPlusAssetLoader.ensureChartStack();
    await Promise.resolve();
    window.Chart = function Chart() {};
    elements[0].handlers.load();
    let secondCompleted = false;
    const second = window.FolderViewPlusAssetLoader.ensureChartStack().then(() => { secondCompleted = true; });
    for (let index = 0; index < 8; index++) await Promise.resolve();
    assert.equal(secondCompleted, false);
    assert.equal(elements.length, 2, 'concurrent calls share each asset request');
    elements[1].handlers.load();
    await Promise.all([first, second]);
    assert.equal(secondCompleted, true);
    await window.FolderViewPlusAssetLoader.ensureChartStack();
    assert.equal(elements.length, 2);
});

test('Dashboard preview waits for its asset loader when Chart alone is already present', async () => {
    const preview = require(path.join(scripts, 'dashboard.advanced-preview.js'));
    let options, requested = 0;
    const trigger = {
        length: 1, first() { return this; }, data() { return this; }, removeAttr() { return this; },
        tooltipster(value) { options = value; return this; }
    };
    const tooltip = { length: 1, closest: () => ({ length: 0 }), find: () => ({ get: () => null }) };
    const jq = () => trigger;
    jq.fn = { tooltipster() {} };
    const api = preview.createApi({
        $: jq, document: {},
        window: {
            Chart() {},
            FolderViewPlusAssetLoader: { ensureChartStack() { requested++; return Promise.resolve(); } }
        }
    });
    assert.equal(api.attachAdvancedPreview({ triggerEl: {}, ct: { shortId: 'fixture' } }), true);
    options.functionReady(null, { tooltip });
    await Promise.resolve();
    assert.equal(requested, 1);
    options.functionAfter();
});

const createExpansionFixture = (type, useCoordinator) => {
    const timers = createTimers(), requests = [];
    let current = {};
    const save = (map) => new Promise((resolve, reject) => {
        requests.push({ map, reject, resolve(committed = map) {
            // The coordinator publishes its response synchronously to page subscribers.
            if (useCoordinator) current = committed;
            resolve({ prefs: { expandedFolderState: committed } });
        } });
    });
    const controller = expandedState.createExpandedStateController({
        type, window: timers,
        readServerMap: () => current,
        writeServerMap: value => { current = value; },
        ...(useCoordinator ? {
            preferenceCoordinator: { save: (_type, patch) => save(patch.expandedFolderState).then(response => response.prefs) }
        } : {
            requestClient: { postJson: (_url, payload) => save(JSON.parse(payload.prefs).expandedFolderState) }
        })
    });
    const flushTimer = () => {
        const callback = [...timers.timeouts.values()].at(-1);
        timers.timeouts.clear();
        callback?.();
    };
    return { controller, requests, flushTimer, current: () => current };
};

for (const type of ['docker', 'vm']) {
    for (const useCoordinator of [true, false]) {
        test(`${type} expansion changes survive an older ${useCoordinator ? 'coordinator' : 'direct'} response`, async () => {
            const fixture = createExpansionFixture(type, useCoordinator);
            fixture.controller.persistStateMap({ fixture: true }, false);
            const first = fixture.controller.syncExpandedStateToServer();
            fixture.controller.persistStateMap({ fixture: false }, false);
            await fixture.controller.syncExpandedStateToServer();
            fixture.requests[0].resolve();
            await first;
            assert.equal(fixture.current().fixture, false, 'old publication must not replace newer local intent');
            fixture.flushTimer();
            assert.equal(fixture.requests.length, 2);
            assert.deepEqual(fixture.requests[1].map, { fixture: false });
            fixture.requests[1].resolve();
            for (let index = 0; index < 5; index++) await Promise.resolve();
            assert.equal(fixture.current().fixture, false);
            await fixture.controller.syncExpandedStateToServer();
            assert.equal(fixture.requests.length, 2, 'settled state must not be written repeatedly');
        });
    }
}

test('expansion synchronization adopts a committed response when no newer edit exists', async () => {
    const fixture = createExpansionFixture('docker', true);
    fixture.controller.persistStateMap({ fixture: true, removed: false }, false);
    const active = fixture.controller.syncExpandedStateToServer();
    fixture.requests[0].resolve({ fixture: true });
    await active;
    assert.deepEqual(fixture.current(), { fixture: true });
    await fixture.controller.syncExpandedStateToServer();
    assert.equal(fixture.requests.length, 1);
});

test('failed expansion synchronization retains newer intent for its queued retry', async () => {
    const fixture = createExpansionFixture('vm', true);
    fixture.controller.persistStateMap({ fixture: true }, false);
    const first = fixture.controller.syncExpandedStateToServer();
    fixture.controller.persistStateMap({ fixture: false }, false);
    await fixture.controller.syncExpandedStateToServer();
    fixture.requests[0].reject(new Error('isolated fixture failure'));
    await first;
    fixture.flushTimer();
    assert.equal(fixture.requests.length, 2);
    assert.deepEqual(fixture.requests[1].map, { fixture: false });
    fixture.requests[1].resolve();
    for (let index = 0; index < 5; index++) await Promise.resolve();
    assert.equal(fixture.current().fixture, false);
});
