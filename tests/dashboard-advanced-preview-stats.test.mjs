import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { createApi } = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/dashboard.advanced-preview.js');
const container = { shortId: 'a1b2c3d4e5f6' };
const graphql = (cpuPercent, memPercent, id = container.shortId, memUsage = '2MiB / 4MiB') => ({
    dockerContainerStats: { id: `Container:${id}`, cpuPercent, memPercent, memUsage }
});
const nativeFrame = (cpu = 20) => `${container.shortId};${cpu}%;1MiB / 4MiB`;

class StatsEventSource extends EventTarget {
    listeners = new Set();
    closed = false;

    addEventListener(type, listener, options) {
        this.listeners.add(listener);
        super.addEventListener(type, listener, options);
    }

    removeEventListener(type, listener, options) {
        this.listeners.delete(listener);
        super.removeEventListener(type, listener, options);
    }

    close() {
        this.closed = true;
    }

    publish(data) {
        this.dispatchEvent(new MessageEvent('message', { data }));
    }
}

function createClock() {
    const timers = new Map();
    let now = 0;
    let id = 0;
    const schedule = (callback, delay, repeat = false) => {
        timers.set(++id, { callback, due: now + delay, interval: repeat ? delay : 0 });
        return id;
    };
    const cancel = (handle) => timers.delete(handle);
    return {
        timers,
        setTimeout: schedule,
        clearTimeout: cancel,
        setInterval: (callback, delay) => schedule(callback, delay, true),
        clearInterval: cancel,
        advance(ms) {
            const end = now + ms;
            while (true) {
                const pending = [...timers].sort((a, b) => a[1].due - b[1].due)[0];
                if (!pending || pending[1].due > end) break;
                const [handle, timer] = pending;
                now = timer.due;
                if (timer.interval) timer.due += timer.interval;
                else cancel(handle);
                timer.callback();
            }
            now = end;
        }
    };
}

function createHarness({ source = new StatsEventSource(), subscribe = true, chartStack } = {}) {
    const clock = createClock();
    const subscriptions = [];
    const observers = [];
    const charts = [];
    const origin = {};
    const triggerData = new Map();
    const $trigger = {
        length: 1,
        first: () => $trigger,
        data: (key, ...args) => args.length ? triggerData.set(key, args[0]) : triggerData.get(key),
        removeData: () => triggerData.clear(),
        hasClass: () => false,
        removeAttr() {},
        tooltipster(options) { $trigger.options = options; }
    };
    function $(element) {
        return element === origin ? $trigger : {};
    }
    $.fn = { tooltipster() {} };

    let cleanup;
    const win = {
        ...clock,
        getComputedStyle: () => ({ getPropertyValue: () => '' }),
        dockerload: source,
        FolderViewPlusFoundationModules: {
            folderRenderRecovery: { registerCleanup: (callback) => { cleanup = callback; } }
        },
        FolderViewPlusDockerProviders: {
            getDefault() {
                return {
                    supports: () => subscribe,
                    subscribeStats(callbacks) {
                        const subscription = { ...callbacks, disposals: 0 };
                        subscriptions.push(subscription);
                        return () => {
                            subscription.disposals++;
                            callbacks.onStatus({ status: 'closed' });
                        };
                    }
                };
            }
        },
        FolderViewPlusAssetLoader: chartStack && { ensureChartStack: () => chartStack },
        MutationObserver: class {
            constructor(callback) {
                this.callback = callback;
                this.disposals = 0;
                observers.push(this);
            }
            observe() {}
            disconnect() { this.disposals++; }
        },
        Chart: class {
            constructor(canvas, { data }) {
                this.canvas = canvas;
                this.data = data;
                this.disposals = 0;
                charts.push(this);
            }
            update() {}
            destroy() { this.disposals++; }
        }
    };
    const api = createApi({ window: win, $ });
    assert.equal(api.attachAdvancedPreview({
        triggerEl: origin,
        ct: container,
        settings: { previewGraph: chartStack ? 1 : 0 },
        cpus: 2
    }), true);

    function open() {
        const node = {};
        const cpu = { textContent: '0%' };
        const memory = { textContent: '0 / 0' };
        const width = { value: '0%' };
        const tooltip = {
            length: 1,
            0: node,
            get: () => node,
            closest: () => ({ length: 1 }),
            find(selector) {
                if (selector === `.cpu-${container.shortId}`) {
                    return { get: () => cpu, text: (value) => { cpu.textContent = value; } };
                }
                if (selector === `.mem-${container.shortId}`) {
                    return { text: (value) => { memory.textContent = value; } };
                }
                if (selector === `span#cpu-${container.shortId}`) {
                    return { css: (_name, value) => { width.value = value; } };
                }
                if (selector === `.comb-grapth-${container.shortId}`) {
                    return { find: () => ({ get: () => node }) };
                }
                assert.fail(`Unexpected tooltip selector ${selector}`);
            }
        };
        $trigger.options.functionReady(null, { tooltip });
        return {
            node,
            get text() { return [cpu.textContent, memory.textContent, width.value]; }
        };
    }
    const close = (preview) => $trigger.options.functionAfter(null, preview && { tooltip: preview.node });
    return { api, clock, source, win, open, close, cleanup: () => cleanup(), subscriptions, observers, charts };
}

test('preview keeps native stats after acknowledgement and accepts only finite stats for its container', () => {
    const { open, close, source, subscriptions, clock, api } = createHarness();
    const preview = open();
    const subscription = subscriptions[0];
    subscription.onStatus({ status: 'active' });
    subscription.onData(graphql(40, 12, 'other'));
    for (const value of [undefined, null, '', '  ', 'not a number', Infinity, NaN, false, [], -1]) {
        subscription.onData(graphql(value, 12));
        subscription.onData(graphql(40, value));
    }
    source.publish(`other;${container.shortId};1MiB / 2MiB\n${nativeFrame()}`);
    assert.deepEqual(preview.text, ['10.0%', '1MiB / 4MiB', '10.0%']);
    assert.equal(source.listeners.size, 1);
    assert.deepEqual(api.parseStatsMessage(`${container.shortId} 40%   2MiB / 8MiB`, container, 2),
        { cpu: 20, mem: 25, memUsage: '2MiB / 8MiB' });
    assert.equal(api.parseStatsMessage(`${container.shortId};broken;4MiB / 4MiB`, container), null);
    const fullContainer = { ...container, id: `sha256:${container.shortId}1234` };
    assert.equal(api.parseGraphqlStats(graphql(40, 12, `${container.shortId}4321`), fullContainer), null);
    assert.equal(api.parseGraphqlStats(graphql(40, 12, `${container.shortId}1234`), fullContainer).cpu, 40);
    assert.equal(api.parseStatsMessage(nativeFrame(), fullContainer).cpu, 20);

    subscription.onData({ data: graphql(0, '0', `${container.shortId}0000`, '0B / 4MiB') });
    assert.equal(source.listeners.size, 0);
    source.publish(nativeFrame(86));
    assert.deepEqual(preview.text, ['0.0%', '0B / 4MiB', '0.0%']);
    close();
    assert.equal(clock.timers.size, 0);
});

test('only valid GraphQL samples postpone the five-second fallback', () => {
    const { open, close, clock, source, subscriptions } = createHarness();
    const preview = open();
    const subscription = subscriptions[0];
    subscription.onData(graphql(24, 50));
    assert.equal(source.listeners.size, 0);
    clock.advance(4000);
    subscription.onData(graphql(50, 50));
    clock.advance(4000);
    subscription.onStatus({ status: 'active' });
    subscription.onData(graphql(90, 90, 'other'));
    subscription.onData(graphql(90, undefined));
    clock.advance(999);
    assert.deepEqual(preview.text, ['25.0%', '2MiB / 4MiB', '25.0%']);
    assert.equal(source.listeners.size, 0);
    clock.advance(1);
    assert.equal(source.listeners.size, 1);
    source.publish(nativeFrame(40));
    assert.equal(preview.text[0], '20.0%');
    close();
    assert.equal(clock.timers.size, 0);
});

test('errors and interrupted subscription statuses restore one native listener and a new sample restores GraphQL', () => {
    const { open, close, clock, source, subscriptions } = createHarness();
    let hostMessages = 0;
    source.addEventListener('message', () => { hostMessages++; });
    const preview = open();
    const subscription = subscriptions[0];
    for (const status of ['subscription-error', 'subscription-offline', 'complete', 'reconnecting', 'unavailable', 'failed', 'closed']) {
        subscription.onStatus({ status: 'active' });
        subscription.onData(graphql(30, 50));
        assert.equal(source.listeners.size, 1, status);
        const report = () => status.startsWith('subscription-')
            ? subscription.onError({ category: status })
            : subscription.onStatus({ status });
        report();
        report();
        assert.equal(source.listeners.size, 2, status);
        clock.advance(5000);
        assert.equal(source.listeners.size, 2, status);
        source.publish(nativeFrame());
        subscription.onData(graphql(100, 50));
        assert.equal(preview.text[0], '10.0%', status);
    }
    close();
    assert.equal(hostMessages, 7);
    assert.equal(source.listeners.size, 1);
    assert.equal(source.closed, false);
    assert.equal(clock.timers.size, 0);
});

test('preview detaches from a replaced native source and accepts detachable Nchan-style messages', () => {
    const { open, close, clock, source, win, subscriptions } = createHarness({ subscribe: false });
    const preview = open();
    const nchan = new EventEmitter();
    win.dockerload = nchan;
    source.publish(nativeFrame(86));
    assert.equal(source.listeners.size, 0);
    assert.equal(preview.text[0], '0%');
    assert.equal(nchan.listenerCount('message'), 1);
    nchan.emit('message', nativeFrame(32));
    assert.deepEqual(preview.text, ['16.0%', '1MiB / 4MiB', '16.0%']);
    const replacement = new StatsEventSource();
    win.dockerload = replacement;
    clock.advance(1000);
    assert.equal(nchan.listenerCount('message'), 0);
    assert.equal(replacement.listeners.size, 1);
    close();
    assert.equal(subscriptions.length, 0);
    assert.equal(replacement.listeners.size, 0);
    assert.equal(source.closed || replacement.closed, false);
    assert.equal(clock.timers.size, 0);
});

test('old open callbacks cannot render, create charts, or reclaim fallback after close and reopen', async () => {
    let resolve;
    const chartStack = new Promise((resolveStack) => { resolve = resolveStack; });
    const { open, close, cleanup, clock, source, subscriptions, observers, charts } = createHarness({ chartStack });
    const first = open();
    subscriptions[0].onData(graphql(30, 50));
    close(first);
    const second = open();
    subscriptions[1].onData(graphql(48, 50));
    close(first);
    subscriptions[0].onData(graphql(90, 80));
    subscriptions[0].onError(new Error('late error'));
    subscriptions[0].onStatus({ status: 'reconnecting' });
    observers[0].callback([{ target: { textContent: '95%' } }]);
    assert.deepEqual(second.text, ['24.0%', '2MiB / 4MiB', '24.0%']);
    assert.equal(source.listeners.size, 0);
    assert.equal(subscriptions[0].disposals, 1);
    assert.equal(observers[0].disposals, 1);
    resolve();
    await chartStack;
    assert.deepEqual(charts.map((chart) => chart.canvas), [second.node]);
    assert.deepEqual(charts[0].data.datasets.map((dataset) => dataset.data.map((point) => point.y)), [[24], [50]]);
    cleanup();
    assert.equal(charts[0].disposals, 1);
    assert.equal(observers[1].disposals, 1);
    assert.equal(subscriptions[1].disposals, 1);
    assert.equal(clock.timers.size, 0);
    assert.equal(source.listeners.size, 0);
});
