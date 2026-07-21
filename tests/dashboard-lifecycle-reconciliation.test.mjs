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
        dashboardSource,
        /const DASHBOARD_RUNTIME_STATE_CLASSES = 'started paused stopped running shutoff pmsuspended unknown green-text orange-text red-text';/
    );
    const cleanupUses = dashboardSource.match(/\.removeClass\(DASHBOARD_RUNTIME_ICON_CLASSES\)/g) || [];
    assert.equal(cleanupUses.length, 2);
    assert.match(dashboardSource, /\.removeAttr\('aria-busy'\)/);
    assert.match(dashboardSource, /\$statusIcons\.filter\('i\[id\^="load-"\]'\)\.first\(\)/);
    assert.match(dashboardSource, /prepareDockerLifecycleSurface: captureDashboardRuntimeSurface/);
    assert.match(dashboardSource, /finalizeDockerLifecycleSurface: finalizeDashboardDockerLifecycleSurface/);
    assert.match(dashboardSource, /lifecycleNativeRefreshFallback/);
    assert.match(dashboardSource, /if \(typeof window\.loadlist === 'function'\) window\.loadlist\(\)/);
    assert.match(dashboardSource, /DASHBOARD_LIFECYCLE_DIAGNOSTICS_STORAGE_KEY = 'fv\.support\.bundle\.dashboard\.lifecycle\.v1'/);
    assert.match(dashboardSource, /\$surface\.find\('i'\)\.each/);
    assert.match(dashboardSource, /node\.setAttribute\('class', String\(node\.getAttribute\(DASHBOARD_HOST_ICON_CLASSES_ATTRIBUTE\)/);
    assert.match(dashboardSource, /\.addClass\(`fa \$\{meta\.icon\} \$\{meta\.className\} \$\{meta\.colorClass\}`\)/);
    assert.match(dashboardSource, /\['color', 'animation', 'animation-name', 'transform', 'opacity'\]/);
});
