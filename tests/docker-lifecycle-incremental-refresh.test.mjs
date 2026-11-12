import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(process.cwd());
const reconcileModule = require(path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.reconcile.js'
));
const hostAdaptersModule = require(path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/runtime.host-adapter.js'
));
const coordinatorModule = require(path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.api-coordinator.js'
));
const dockerRuntimeSource = fs.readFileSync(path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js'
), 'utf8');

const flushPromises = async () => {
    await Promise.resolve();
    await Promise.resolve();
};

const createHarness = () => {
    const hostCalls = [];
    const scheduled = [];
    const refreshCalls = [];
    const trace = [];
    const contextCalls = [];
    const runtimeByName = {
        audiobookshelf: {
            info: {
                State: {
                    Running: true,
                    Paused: false,
                    Updated: true,
                    Autostart: true
                }
            }
        }
    };
    const originalEventControl = (...args) => {
        hostCalls.push(args);
        return 'host-result';
    };
    const window = {
        eventControl: originalEventControl,
        addDockerContainerContext: (...args) => {
            contextCalls.push(args);
            return 'context-result';
        },
        setTimeout(handler, delayMs) {
            scheduled.push({ handler, delayMs });
            return scheduled.length;
        }
    };
    const hostAdapter = hostAdaptersModule.createHostAdapter('docker', {
        window,
        document: {}
    });
    const hostGuards = {
        wrapHostHook: (name, handler, options = {}) => hostAdapter.wrapHook(name, handler, options)
    };
    const api = reconcileModule.createApi({
        window,
        document: null,
        refreshDockerRuntimeStateInPlace: async (options = {}) => {
            refreshCalls.push(options);
            return true;
        },
        appendDockerBulkUpdateTrace: (eventType, details = {}) => {
            trace.push({ eventType, details });
        },
        getDockerHostGuardsApi: () => hostGuards,
        getDockerRuntimeContainerInfo: (name) => runtimeByName[name] || null
    });
    return { api, window, originalEventControl, hostCalls, scheduled, refreshCalls, trace, contextCalls, runtimeByName };
};

test('Docker lifecycle actions replace the destructive host loadlist callback', async () => {
    const harness = createHarness();
    assert.equal(harness.api.bindLifecycleEventControlPatch(), true);

    const result = harness.window.eventControl({ action: 'stop', container: 'abc123' }, 'loadlist');
    assert.equal(result, 'host-result');
    assert.equal(harness.hostCalls.length, 1);
    const callbackName = harness.hostCalls[0][1];
    assert.ok(callbackName.startsWith(reconcileModule.DOCKER_LIFECYCLE_REFRESH_CALLBACK_NAME));
    assert.notEqual(harness.hostCalls[0][1], 'loadlist');
    assert.equal(typeof harness.window[callbackName], 'function');

    harness.window[callbackName]();
    assert.equal(harness.window[callbackName], undefined);
    assert.deepEqual(
        harness.scheduled.filter((entry) => entry.delayMs !== 120000).map((entry) => entry.delayMs),
        [...reconcileModule.DOCKER_LIFECYCLE_REFRESH_DELAYS_MS]
    );
    for (const scheduled of harness.scheduled.filter((entry) => entry.delayMs !== 120000)) {
        scheduled.handler();
        await flushPromises();
    }
    assert.equal(harness.refreshCalls.length, reconcileModule.DOCKER_LIFECYCLE_REFRESH_DELAYS_MS.length);
    harness.refreshCalls.forEach((options) => {
        assert.equal(options.liveUpdateStatus, true);
        assert.equal(options.preserveGroupedDom, true);
        assert.equal(options.containerId, 'abc123');
        assert.equal(typeof options.isCurrent, 'function');
    });
    assert.ok(harness.trace.some((entry) => entry.eventType === 'lifecycleLoadlistIntercepted'));
});

test('two host callbacks refresh their own containers even when they finish in reverse order', async () => {
    const harness = createHarness();
    harness.api.bindLifecycleEventControlPatch();
    harness.window.eventControl({ action: 'start', container: 'first' }, 'loadlist');
    harness.window.eventControl({ action: 'stop', container: 'second' }, 'loadlist');
    const [first, second] = harness.hostCalls.map((call) => call[1]);
    assert.notEqual(first, second);
    harness.window[second]();
    harness.window[first]();
    for (const scheduled of harness.scheduled.filter((entry) => entry.delayMs !== 120000)) {
        scheduled.handler();
        await flushPromises();
    }
    assert.deepEqual([...new Set(harness.refreshCalls.map((entry) => entry.containerId))].sort(), ['first', 'second']);
    assert.equal(harness.trace.filter((entry) => entry.eventType === 'lifecycleSurfaceFinalized').length, 2);
});

test('a newer action replaces only the same container refresh', async () => {
    const harness = createHarness();
    harness.api.bindLifecycleEventControlPatch();
    harness.window.eventControl({ action: 'stop', container: 'first' }, 'loadlist');
    harness.window[harness.hostCalls[0][1]]();
    harness.window.eventControl({ action: 'start', container: 'first' }, 'loadlist');
    harness.window[harness.hostCalls[1][1]]();
    for (const scheduled of harness.scheduled.filter((entry) => entry.delayMs !== 120000)) {
        scheduled.handler();
        await flushPromises();
    }
    assert.equal(harness.refreshCalls.length, reconcileModule.DOCKER_LIFECYCLE_REFRESH_DELAYS_MS.length);
    assert.equal(harness.trace.filter((entry) => entry.eventType === 'lifecycleSurfaceFinalized').length, 1);
});

test('an earlier same-container host action completing last reconciles its final state', async () => {
    const harness = createHarness();
    harness.api.bindLifecycleEventControlPatch();
    harness.window.eventControl({ action: 'stop', container: 'first' }, 'loadlist');
    harness.window.eventControl({ action: 'start', container: 'first' }, 'loadlist');
    const [stopCallback, startCallback] = harness.hostCalls.map((call) => call[1]);
    harness.window[startCallback]();
    harness.window[stopCallback]();
    for (const scheduled of harness.scheduled.filter((entry) => entry.delayMs !== 120000)) {
        scheduled.handler();
        await flushPromises();
    }
    assert.equal(harness.refreshCalls.length, reconcileModule.DOCKER_LIFECYCLE_REFRESH_DELAYS_MS.length);
    assert.equal(harness.trace.filter((entry) => entry.eventType === 'lifecycleSurfaceFinalized').length, 1);
    assert.equal(harness.trace.find((entry) => entry.eventType === 'lifecycleSurfaceFinalized').details.action, 'stop');
});

test('an earlier completion does not finalize while a same-container host action is pending', async () => {
    const harness = createHarness();
    harness.api.bindLifecycleEventControlPatch();
    harness.window.eventControl({ action: 'stop', container: 'first' }, 'loadlist');
    harness.window.eventControl({ action: 'start', container: 'first' }, 'loadlist');
    const [stopCallback, startCallback] = harness.hostCalls.map((call) => call[1]);
    harness.window[stopCallback]();
    for (const scheduled of harness.scheduled.filter((entry) => entry.delayMs !== 120000)) {
        scheduled.handler();
        await flushPromises();
    }
    assert.equal(harness.trace.filter((entry) => entry.eventType === 'lifecycleSurfaceFinalized').length, 0);
    harness.window[startCallback]();
    for (const scheduled of harness.scheduled.filter((entry) => entry.delayMs !== 120000)) {
        scheduled.handler();
        await flushPromises();
    }
    assert.equal(harness.trace.filter((entry) => entry.eventType === 'lifecycleSurfaceFinalized').length, 1);
});

test('finishing one container keeps another container preview pending', async () => {
    const element = (initial = {}) => {
        const attrs = new Map(Object.entries(initial));
        return {
            getAttribute: (name) => attrs.get(name) || null,
            hasAttribute: (name) => attrs.has(name),
            setAttribute: (name, value) => attrs.set(name, value),
            removeAttribute: (name) => attrs.delete(name)
        };
    };
    const surfaces = ['aaaaaaaaaaaa', 'bbbbbbbbbbbb'].map((id) => {
        const surface = element({ 'data-fv-container-id': id });
        surface.icon = element({ class: 'fa fa-play started' });
        surface.querySelectorAll = () => [surface.icon];
        return surface;
    });
    const scheduled = [];
    const window = {
        eventControl: () => {},
        setTimeout: (handler, delayMs) => { scheduled.push({ handler, delayMs }); return scheduled.length; }
    };
    const document = { querySelectorAll: (selector) => selector.startsWith('.folder-preview [data-fv-container-id]')
        ? surfaces : surfaces.filter((surface) => surface.icon.hasAttribute('data-fv-lifecycle-icon-class')).map((surface) => surface.icon) };
    const hostAdapter = hostAdaptersModule.createHostAdapter('docker', { window, document });
    const api = reconcileModule.createApi({ window, document,
        getDockerHostGuardsApi: () => ({ wrapHostHook: (...args) => hostAdapter.wrapHook(...args) }),
        refreshDockerRuntimeStateInPlace: async () => true,
        isDockerLifecycleStateSettled: () => true,
        lifecycleRefreshDelaysMs: [0] });
    api.bindLifecycleEventControlPatch();
    window.eventControl({ action: 'start', container: 'aaaaaaaaaaaa' }, 'loadlist');
    const firstCallback = Object.keys(window).find((key) => key.startsWith('__fvplusDockerLifecycleRefresh_'));
    window.eventControl({ action: 'start', container: 'bbbbbbbbbbbb' }, 'loadlist');
    assert.equal(surfaces.every((surface) => surface.hasAttribute('data-fv-lifecycle-pending')), true);
    window[firstCallback]();
    scheduled.find((entry) => entry.delayMs === 0).handler();
    await flushPromises();
    assert.equal(surfaces[0].hasAttribute('data-fv-lifecycle-pending'), false);
    assert.equal(surfaces[1].hasAttribute('data-fv-lifecycle-pending'), true);
    api.disposeLifecycleRefreshes();
});

test('unreturned host callbacks expire and page exit removes outstanding callbacks', async () => {
    const harness = createHarness();
    harness.api.bindLifecycleEventControlPatch();
    harness.window.eventControl({ action: 'start', container: 'first' }, 'loadlist');
    const first = harness.hostCalls[0][1];
    harness.scheduled.find((entry) => entry.delayMs === 120000).handler();
    assert.equal(harness.window[first], undefined);
    for (const scheduled of harness.scheduled.filter((entry) => entry.delayMs !== 120000)) {
        scheduled.handler();
        await flushPromises();
    }
    assert.ok(harness.trace.some((entry) => entry.details.reason === 'callback-timeout'));
    harness.window.eventControl({ action: 'start', container: 'second' }, 'loadlist');
    const second = harness.hostCalls[1][1];
    harness.api.disposeLifecycleRefreshes();
    assert.equal(harness.window[second], undefined);
    assert.equal(harness.api.bindLifecycleEventControlPatch(), false);
});

test('failed host lifecycle actions remove their callbacks and finalize the pending surface', async () => {
    for (const failure of ['throw', 'reject']) {
        const harness = createHarness();
        const hostFailure = Error('fixture host action failed');
        harness.window.eventControl = (_request, callbackName) => {
            harness.hostCalls.push([_request, callbackName]);
            if (failure === 'throw') throw hostFailure;
            return Promise.reject(hostFailure);
        };
        harness.api.bindLifecycleEventControlPatch();
        if (failure === 'throw') {
            assert.throws(() => harness.window.eventControl({ action: 'start', container: 'first' }, 'loadlist'), hostFailure);
        } else {
            await assert.rejects(harness.window.eventControl({ action: 'start', container: 'first' }, 'loadlist'), hostFailure);
            await flushPromises();
        }
        assert.equal(harness.window[harness.hostCalls[0][1]], undefined);
        for (const scheduled of harness.scheduled.filter((entry) => entry.delayMs !== 120000)) {
            scheduled.handler();
            await flushPromises();
        }
        assert.ok(harness.trace.some((entry) => entry.eventType === 'lifecycleSurfaceFinalized'
            && entry.details.reason === 'host-action-failed'), failure);
    }
});

test('Docker lifecycle patch leaves structural and unrelated host callbacks unchanged', () => {
    const harness = createHarness();
    harness.api.bindLifecycleEventControlPatch();
    const wrappedEventControl = harness.window.eventControl;

    harness.window.eventControl({ action: 'remove', container: 'abc123' }, 'loadlist');
    harness.window.eventControl({ action: 'start', container: 'abc123' }, 'customRefresh');
    harness.api.bindLifecycleEventControlPatch();

    assert.equal(harness.hostCalls[0][1], 'loadlist');
    assert.equal(harness.hostCalls[1][1], 'customRefresh');
    assert.equal(harness.window.eventControl, wrappedEventControl);
    assert.equal(harness.scheduled.length, 0);
});

test('Docker container context menus resolve lifecycle actions from the latest runtime cache', () => {
    const harness = createHarness();
    assert.equal(harness.api.bindDockerContainerContextStatePatch(), true);

    const staleStoppedArgs = ['audiobookshelf', 'image', 'template', false, false, 1, false];
    assert.equal(harness.window.addDockerContainerContext(...staleStoppedArgs), 'context-result');
    assert.equal(harness.contextCalls[0][3], true);
    assert.equal(harness.contextCalls[0][4], false);
    assert.equal(harness.contextCalls[0][5], 0);
    assert.equal(harness.contextCalls[0][6], true);

    harness.runtimeByName.audiobookshelf.info.State.Running = false;
    harness.runtimeByName.audiobookshelf.info.State.Autostart = false;
    const staleStartedArgs = ['audiobookshelf', 'image', 'template', true, false, 0, true];
    harness.window.addDockerContainerContext(...staleStartedArgs);
    assert.equal(harness.contextCalls[1][3], false);
    assert.equal(harness.contextCalls[1][4], false);
    assert.equal(harness.contextCalls[1][6], false);
    assert.ok(harness.trace.some((entry) => (
        entry.eventType === 'lifecycleContextStateResolved'
        && entry.details.running === false
    )));

    const wrappedContextBuilder = harness.window.addDockerContainerContext;
    assert.equal(harness.api.bindDockerContainerContextStatePatch(), true);
    assert.equal(harness.window.addDockerContainerContext, wrappedContextBuilder);
});

test('Docker lifecycle reconciliation never promotes revision churn into a grouped-table rebuild', () => {
    assert.match(
        dockerRuntimeSource,
        /const configurationChanged = snapshot && !dockerRuntimeSnapshotConfigMatches\(snapshot\);/
    );
    assert.match(
        dockerRuntimeSource,
        /if \(configurationChanged && !preserveGroupedDom\) \{\s*fallbackReason = 'configuration-changed';\s*return false;\s*\}/
    );
    assert.match(
        dockerRuntimeSource,
        /if \(preserveGroupedDom\) \{[\s\S]*mode: 'incremental-retry'[\s\S]*return;\s*\}/
    );
    assert.doesNotMatch(
        dockerRuntimeSource,
        /preserveGroupedDom && fallbackReason !== 'configuration-changed'/
    );
});

for (const action of ['start', 'stop', 'pause', 'resume', 'restart']) {
    test(`Docker ${action} settles after API enrichment replaces the native identity`, async () => {
        const id = 'abcdef123456' + '0'.repeat(52);
        const scheduled = [];
        const trace = [];
        let entry = {
            shortId: id.slice(0, 12),
            info: { Id: id, Name: 'example', State: { Running: action !== 'start', Paused: action === 'resume' } }
        };
        const api = reconcileModule.createApi({
            window: { setTimeout: (handler) => scheduled.push(handler) },
            document: { querySelectorAll: () => [] },
            getDockerRuntimeInfoEntries: () => [entry],
            refreshDockerRuntimeStateInPlace: async () => {
                entry = coordinatorModule.mergeContainerIntoRuntimeEntry(entry, {
                    id: `server:${id}`,
                    shortId: id.slice(0, 12),
                    name: 'example',
                    state: action === 'stop' ? 'exited' : (action === 'pause' ? 'paused' : 'running')
                });
                return true;
            },
            appendDockerBulkUpdateTrace: (eventType, details) => trace.push({ eventType, details }),
            lifecycleRefreshDelaysMs: [0, 750, 2000]
        });
        api.runDockerLifecycleRefresh({ action, container: id.slice(0, 12) });
        for (const handler of scheduled) {
            handler();
            await flushPromises();
        }
        const finalized = trace.find((event) => event.eventType === 'lifecycleSurfaceFinalized');
        assert.equal(finalized?.details.reason, 'settled');
        assert.equal(finalized?.details.matchedRuntimeEntry, true);
        assert.equal(finalized?.details.observedState.state, action === 'stop' ? 'stopped' : (action === 'pause' ? 'paused' : 'running'));
    });
}

test('Docker lifecycle does not guess between containers sharing a shortened identity', async () => {
    const scheduled = [];
    const trace = [];
    const api = reconcileModule.createApi({
        window: { setTimeout: (handler) => scheduled.push(handler) },
        document: { querySelectorAll: () => [] },
        getDockerRuntimeInfoEntries: () => ['a', 'b'].map((suffix) => ({
            shortId: 'abcdef123456',
            info: { Id: `abcdef123456${suffix.repeat(52)}`, Name: `example-${suffix}`, State: { Running: false, Paused: false } }
        })),
        refreshDockerRuntimeStateInPlace: async () => true,
        appendDockerBulkUpdateTrace: (eventType, details) => trace.push({ eventType, details }),
        lifecycleRefreshDelaysMs: [0]
    });
    api.runDockerLifecycleRefresh({ action: 'stop', container: 'abcdef123456' });
    scheduled[0]();
    await flushPromises();
    const finalized = trace.find((event) => event.eventType === 'lifecycleSurfaceFinalized');
    assert.equal(finalized?.details.matchedRuntimeEntry, false);
    assert.equal(finalized?.details.observedState, null);
    assert.equal(finalized?.details.settled, false);
});
