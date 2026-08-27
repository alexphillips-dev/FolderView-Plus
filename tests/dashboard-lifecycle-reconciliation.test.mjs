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
const dashboardSource = fs.readFileSync(path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/dashboard.js'
), 'utf8');
const dashboardRuntimeSurfaceSource = fs.readFileSync(path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/dashboard.runtime-surface.js'
), 'utf8');
const dashboardPage = fs.readFileSync(path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/folderview.plus.Dashboard.page'
), 'utf8');

const flushPromises = async () => {
    await Promise.resolve();
    await Promise.resolve();
};

test('Dashboard lifecycle reconciliation follows a stale stopped snapshot until Start settles', async () => {
    const scheduled = [];
    const hostCalls = [];
    const preparedRequests = [];
    const finalizedRequests = [];
    const refreshStates = [false, false, false, false, true];
    let running = false;
    const window = {
        eventControl: (...args) => {
            hostCalls.push(args);
            window[args[1]]();
            return 'host-result';
        },
        setTimeout(handler, delayMs) {
            scheduled.push({ handler, delayMs });
            return scheduled.length;
        }
    };
    const api = reconcileModule.createApi({
        window,
        refreshDockerRuntimeStateInPlace: async () => {
            running = refreshStates.shift() ?? running;
            return true;
        },
        isDockerLifecycleStateSettled: () => running,
        prepareDockerLifecycleSurface: (request) => preparedRequests.push({ ...request }),
        getDockerLifecycleStateSnapshot: () => ({ state: running ? 'running' : 'stopped', active: running, paused: false }),
        finalizeDockerLifecycleSurface: (request, outcome) => finalizedRequests.push({ request: { ...request }, outcome }),
        lifecycleRefreshCallbackName: '__fvplusDashboardDockerLifecycleRefresh',
        lifecycleRefreshDelaysMs: [0, 300, 750, 1500, 2500],
        getDockerHostGuardsApi: () => ({
            wrapHostHook(name, handler) {
                const original = window[name];
                window[name] = (...args) => handler({
                    args,
                    invokeOriginal: (...overrideArgs) => original(...overrideArgs)
                });
            }
        })
    });

    api.bindLifecycleEventControlPatch();
    window.eventControl({ action: 'start', container: 'abc123' }, 'loadlist');

    assert.equal(hostCalls[0][1], '__fvplusDashboardDockerLifecycleRefresh');
    assert.deepEqual(preparedRequests, [{ action: 'start', container: 'abc123' }]);
    assert.deepEqual(scheduled.map(({ delayMs }) => delayMs), [0, 300, 750, 1500, 2500]);

    for (const item of scheduled) {
        item.handler();
        await flushPromises();
    }

    assert.equal(running, true);
    assert.equal(refreshStates.length, 0);
    assert.equal(finalizedRequests.length, 1);
    assert.equal(finalizedRequests[0].outcome.reason, 'settled');
    assert.equal(finalizedRequests[0].outcome.observedState.state, 'running');
});

test('Dashboard lifecycle reconciliation invokes one canonical fallback after Start attempts are exhausted', async () => {
    const scheduled = [];
    const finalizedRequests = [];
    const window = {
        setTimeout(handler, delayMs) {
            scheduled.push({ handler, delayMs });
            return scheduled.length;
        }
    };
    const api = reconcileModule.createApi({
        window,
        refreshDockerRuntimeStateInPlace: async () => true,
        isDockerLifecycleStateSettled: () => false,
        getDockerLifecycleStateSnapshot: () => ({ state: 'stopped', active: false, paused: false }),
        finalizeDockerLifecycleSurface: (request, outcome) => finalizedRequests.push({ request: { ...request }, outcome }),
        lifecycleRefreshDelaysMs: [0, 500, 1250]
    });

    api.runDockerLifecycleRefresh({ action: 'start', container: 'abc123' });
    for (const item of scheduled) {
        item.handler();
        await flushPromises();
    }

    assert.equal(finalizedRequests.length, 1);
    assert.equal(finalizedRequests[0].request.action, 'start');
    assert.equal(finalizedRequests[0].outcome.reason, 'attempts-exhausted');
    assert.equal(finalizedRequests[0].outcome.settled, false);
    assert.equal(finalizedRequests[0].outcome.observedState.state, 'stopped');
});

test('Docker page lifecycle defaults resolve container ids and clear expanded preview action spinners', async () => {
    const scheduled = [];
    const traces = [];
    const entry = {
        shortId: 'abc123def456',
        info: { Name: 'example-container', State: { Running: false, Paused: false } }
    };
    let busyIconCount = 3;
    let syncedNames = null;
    const api = reconcileModule.createApi({
        window: {
            setTimeout(handler, delayMs) {
                scheduled.push({ handler, delayMs });
                return scheduled.length;
            }
        },
        document: { querySelectorAll: () => ({ length: busyIconCount }) },
        refreshDockerRuntimeStateInPlace: async () => {
            entry.info.State.Running = true;
            return true;
        },
        getDockerRuntimeInfoEntries: () => [entry],
        syncDockerVisibleFoldersFromRuntimeCache: (names) => {
            syncedNames = names;
            busyIconCount = 0;
        },
        appendDockerBulkUpdateTrace: (eventType, details) => traces.push({ eventType, details }),
        lifecycleRefreshDelaysMs: [0]
    });

    api.runDockerLifecycleRefresh({ action: 'start', container: 'abc123def456' });
    scheduled[0].handler();
    await flushPromises();

    assert.deepEqual(Array.from(syncedNames), ['example-container']);
    const finalized = traces.find((trace) => trace.eventType === 'lifecycleSurfaceFinalized');
    assert.equal(finalized.details.settled, true);
    assert.equal(finalized.details.observedState.state, 'running');
    assert.equal(finalized.details.remainingBusyPreviewActionIconCount, 0);
});

test('Docker restart lifecycle keeps its pending surface through the initial running snapshot', async () => {
    const scheduled = [];
    const finalized = [];
    const api = reconcileModule.createApi({
        window: {
            setTimeout(handler, delayMs) {
                scheduled.push({ handler, delayMs });
                return scheduled.length;
            }
        },
        refreshDockerRuntimeStateInPlace: async () => true,
        isDockerLifecycleStateSettled: () => true,
        getDockerLifecycleStateSnapshot: () => ({ state: 'running', active: true, paused: false }),
        finalizeDockerLifecycleSurface: (request, outcome) => finalized.push({ request, outcome }),
        lifecycleRefreshDelaysMs: [0, 750]
    });

    api.runDockerLifecycleRefresh({ action: 'restart', container: 'abc123def456' });
    scheduled[0].handler();
    await flushPromises();
    assert.equal(finalized.length, 0);

    scheduled[1].handler();
    await flushPromises();
    assert.equal(finalized.length, 1);
    assert.equal(finalized[0].outcome.settled, true);
    assert.equal(finalized[0].outcome.attempt, 2);
});

test('Docker native lifecycle hook marks and restores a matching compact preview status icon', async () => {
    const scheduled = [];
    const iconAttributes = new Map([['class', 'fa fa-play fv-preview-status-started']]);
    const surfaceAttributes = new Map([
        ['data-fv-container-id', 'abc123def456'],
        ['data-fv-container-name', 'example-container']
    ]);
    const icon = {
        getAttribute: (name) => iconAttributes.get(name) || '',
        setAttribute: (name, value) => iconAttributes.set(name, String(value)),
        hasAttribute: (name) => iconAttributes.has(name),
        removeAttribute: (name) => iconAttributes.delete(name)
    };
    const surface = {
        getAttribute: (name) => surfaceAttributes.get(name) || '',
        setAttribute: (name, value) => surfaceAttributes.set(name, String(value)),
        removeAttribute: (name) => surfaceAttributes.delete(name),
        querySelectorAll: () => [icon]
    };
    const document = {
        querySelectorAll(selector) {
            if (selector.includes('data-fv-container-id')) return [surface];
            if (selector.includes('data-fv-lifecycle-pending')) {
                return surfaceAttributes.get('data-fv-lifecycle-pending') === 'true' ? [surface] : [];
            }
            if (selector.includes('data-fv-lifecycle-icon-class')) {
                return iconAttributes.has('data-fv-lifecycle-icon-class') ? [icon] : [];
            }
            return [];
        }
    };
    const entry = {
        shortId: 'abc123def456',
        name: 'example-container',
        info: { Id: 'abc123def4567890', Name: 'example-container', State: { Running: true, Paused: false } }
    };
    const window = {
        eventControl: (...args) => {
            window[args[1]]();
            return true;
        },
        setTimeout(handler, delayMs) {
            scheduled.push({ handler, delayMs });
            return scheduled.length;
        }
    };
    const api = reconcileModule.createApi({
        window,
        document,
        getDockerRuntimeInfoEntries: () => [entry],
        refreshDockerRuntimeStateInPlace: async () => true,
        syncDockerVisibleFoldersFromRuntimeCache: () => true,
        lifecycleRefreshDelaysMs: [0],
        getDockerHostGuardsApi: () => ({
            wrapHostHook(name, handler) {
                const original = window[name];
                window[name] = (...args) => handler({
                    args,
                    invokeOriginal: (...overrideArgs) => original(...overrideArgs)
                });
            }
        })
    });

    api.bindLifecycleEventControlPatch();
    window.eventControl({ action: 'restart', container: 'abc123def456' }, 'loadlist');
    assert.match(iconAttributes.get('class'), /fa-refresh/);
    assert.match(iconAttributes.get('class'), /fa-spin/);
    assert.equal(surfaceAttributes.get('aria-busy'), 'true');
    assert.equal(surfaceAttributes.get('data-fv-lifecycle-action'), 'restart');

    scheduled[0].handler();
    await flushPromises();
    assert.equal(iconAttributes.get('class'), 'fa fa-play fv-preview-status-started');
    assert.equal(surfaceAttributes.has('aria-busy'), false);
    assert.equal(surfaceAttributes.has('data-fv-lifecycle-action'), false);
    assert.equal(iconAttributes.has('data-fv-lifecycle-icon-class'), false);
});

test('Dashboard stop followed by start cancels the stale stop tail and converges to running', async () => {
    const scheduled = [];
    const refreshStates = [false, false, true];
    let running = true;
    let refreshCount = 0;
    const window = {
        eventControl: (...args) => {
            window[args[1]]();
        },
        setTimeout(handler, delayMs) {
            scheduled.push({ handler, delayMs });
            return scheduled.length;
        }
    };
    const api = reconcileModule.createApi({
        window,
        refreshDockerRuntimeStateInPlace: async () => {
            refreshCount += 1;
            running = refreshStates.shift() ?? running;
            return true;
        },
        isDockerLifecycleStateSettled: (request) => (
            request.action === 'stop' ? running === false : running === true
        ),
        lifecycleRefreshCallbackName: '__fvplusDashboardDockerLifecycleRefresh',
        lifecycleRefreshDelaysMs: [0, 500, 1250],
        getDockerHostGuardsApi: () => ({
            wrapHostHook(name, handler) {
                const original = window[name];
                window[name] = (...args) => handler({
                    args,
                    invokeOriginal: (...overrideArgs) => original(...overrideArgs)
                });
            }
        })
    });

    api.bindLifecycleEventControlPatch();
    window.eventControl({ action: 'stop', container: 'abc123' }, 'loadlist');
    scheduled[0].handler();
    await flushPromises();
    assert.equal(running, false);

    window.eventControl({ action: 'start', container: 'abc123' }, 'loadlist');
    const startTimers = scheduled.slice(3);
    scheduled.slice(1, 3).forEach(({ handler }) => handler());
    for (const { handler } of startTimers) {
        handler();
        await flushPromises();
    }

    assert.equal(running, true);
    assert.equal(refreshCount, 3);
});

test('Dashboard integration keeps grouped rows mounted and uses state-aware follow-up timings', () => {
    assert.match(dashboardSource, /isDashboardDockerLifecycleStateSettled/);
    assert.match(dashboardSource, /lifecycleRefreshDelaysMs: \[0, 300, 750, 1500, 2500\]/);
    assert.match(dashboardSource, /bindLifecycleEventControlPatch/);
    assert.match(dashboardSource, /getDockerRuntimeContainerInfo: \(containerName\) =>/);
    assert.match(dashboardSource, /dashboardDockerLifecycleApi\?\.bindDockerContainerContextStatePatch\?\.\(\)/);
    assert.match(
        dashboardSource,
        /refreshDockerRuntimeStateInPlace: \(\) => refreshDashboardTypeRuntimeStateInPlace\('docker'\)/
    );
    assert.ok(
        dashboardPage.indexOf('/scripts/runtime.host-adapter.js')
        < dashboardPage.indexOf('/scripts/docker.runtime.reconcile.js')
    );
    assert.ok(
        dashboardPage.indexOf('/scripts/docker.runtime.reconcile.js')
        < dashboardPage.indexOf('/scripts/dashboard.js')
    );
});

test('Dashboard runtime reconciliation clears host lifecycle spinner classes', () => {
    assert.match(
        dashboardRuntimeSurfaceSource,
        /const RUNTIME_STATE_CLASSES = 'started paused stopped running shutoff pmsuspended unknown green-text orange-text red-text';/
    );
    assert.match(dashboardRuntimeSurfaceSource, /\.removeClass\(RUNTIME_ICON_CLASSES\)/);
    assert.match(dashboardRuntimeSurfaceSource, /\.removeAttr\('aria-busy'\)/);
    assert.match(dashboardRuntimeSurfaceSource, /\$statusIcons\.filter\('i\[id\^="load-"\]'\)\.first\(\)/);
    assert.match(dashboardSource, /prepareDockerLifecycleSurface: captureDashboardRuntimeSurface/);
    assert.match(dashboardSource, /finalizeDockerLifecycleSurface: finalizeDashboardDockerLifecycleSurface/);
    assert.match(dashboardSource, /lifecycleNativeRefreshFallback/);
    assert.match(dashboardSource, /if \(typeof window\.loadlist === 'function'\) window\.loadlist\(\)/);
    assert.match(dashboardRuntimeSurfaceSource, /LIFECYCLE_DIAGNOSTICS_STORAGE_KEY = 'fv\.support\.bundle\.dashboard\.lifecycle\.v1'/);
    assert.match(dashboardRuntimeSurfaceSource, /\$surface\.find\('i'\)\.each/);
    assert.match(dashboardRuntimeSurfaceSource, /node\.setAttribute\('class', String\(node\.getAttribute\(HOST_ICON_CLASSES_ATTRIBUTE\)/);
    assert.match(dashboardRuntimeSurfaceSource, /\.addClass\(`fa \$\{meta\.icon\} \$\{meta\.className\} \$\{meta\.colorClass\}`\)/);
    assert.match(dashboardRuntimeSurfaceSource, /\['color', 'animation', 'animation-name', 'transform', 'opacity'\]/);
});
