import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = process.env.FVPLUS_DRAFT_SCRIPTS_DIR || path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts');
const { createIntegration, createCoordinator } = require(path.join(root, 'docker.runtime.api-coordinator.js'));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const fixture = (extra = {}) => {
    let reads = 0, applications = 0, generation = 1;
    const entry = { schemaVersion: 1, id: 'a'.repeat(64), name: 'app', names: ['app'], state: 'running', autoStart: false };
    const provider = { supports: () => true, listContainers: async () => { reads++; return [entry]; } };
    const deps = { providerRegistry: { getDefault: () => provider, prepare: async () => provider },
        getRuntimeMap: () => ({ app: { id: entry.id, info: { State: { Running: false } } } }),
        applyRuntimeMap: () => { applications++; }, getRuntimeGeneration: () => generation, ...extra };
    return { provider, deps, reads: () => reads, applications: () => applications, advance: () => { generation++; } };
};

test('disposed API integration does not recreate a coordinator for later refresh', async () => {
    const item = fixture(), integration = createIntegration(item.deps);
    integration.dispose();
    assert.equal(await integration.refresh(), false);
    assert.equal(item.reads(), 0); assert.equal(item.applications(), 0);
});

test('disposing during prepare prevents the pending continuation from creating a fresh coordinator', async () => {
    const pending = deferred(), item = fixture();
    item.deps.providerRegistry.prepare = () => pending.promise;
    const integration = createIntegration(item.deps), refreshing = integration.refresh();
    integration.dispose(); pending.resolve(item.provider);
    assert.equal(await refreshing, false);
    assert.equal(item.reads(), 0); assert.equal(item.applications(), 0);
});

test('late configuration checks cannot request native refresh after integration disposal', async () => {
    const pending = deferred(); let refreshes = 0;
    const item = fixture({ readConfigSnapshot: () => pending.promise, isConfigCurrent: () => false,
        requestStructuralRefresh: () => { refreshes++; } });
    const integration = createIntegration(item.deps), ticking = integration.tick();
    integration.dispose(); pending.resolve({ revisions: { folder: 2, prefs: 2 } });
    assert.equal(await ticking, false);
    assert.equal(refreshes, 0); assert.equal(item.reads(), 0);
});

test('scheduled API follow-up cannot fetch or publish after disposal', async () => {
    let followup;
    const item = fixture({ setTimeout: callback => { followup = callback; } });
    const integration = createIntegration(item.deps);
    assert.equal(await integration.refresh({ followupDelayMs: 1 }), true);
    integration.dispose();
    await followup();
    assert.equal(item.reads(), 1); assert.equal(item.applications(), 1);
});

test('provider results from an earlier accepted runtime generation do not overwrite the current render', async () => {
    const pending = deferred(), item = fixture();
    item.provider.listContainers = () => pending.promise;
    const coordinator = createCoordinator(item.deps), refreshing = coordinator.refreshAll({ fallback: false });
    await Promise.resolve(); item.advance();
    pending.resolve([{ schemaVersion: 1, id: 'a'.repeat(64), name: 'app', names: ['app'], state: 'running', autoStart: false }]);
    assert.equal((await refreshing).applied, false);
    assert.equal(item.applications(), 0);
});

const mainSource = fs.readFileSync(path.join(root, 'docker.js'), 'utf8');
const loadMain = (from, until, scope, result = from) => {
    const start = mainSource.indexOf('const ' + from + ' ='), end = mainSource.indexOf(until, start);
    assert.ok(start >= 0 && end > start);
    return new Function('scope', 'with (scope) {\n' + mainSource.slice(start, end) + '\nreturn ' + result + ';\n}')(scope);
};
const mainScope = (extra = {}) => ({
    dockerRuntimePageDisposed: false, dockerRuntimeRefreshGeneration: 0, dockerBootstrapGeneration: 1,
    ...extra
});

test('scheduled refresh awaits true, false, rejection and missing/disabled API outcomes before choosing PHP', async () => {
    for (const outcome of ['true', 'false', 'reject', 'missing', 'disabled', 'cooldown']) {
        const calls = [], scope = mainScope({
            getDockerApiIntegration: () => outcome === 'missing' ? null : {
                refresh: () => assert.fail('scheduled refresh must use API tick configuration guard'),
                tick: async options => {
                    calls.push(['api', options.liveUpdateStatus]);
                    if (outcome === 'reject') throw Error('fixture');
                    return outcome === 'true';
                }
            },
            refreshDockerRuntimeStateFromPhp: async options => { calls.push(['php', options.liveUpdateStatus]); return true; }
        });
        const refresh = loadMain('refreshDockerRuntimeStateInPlace', 'const readDockerHostOrderFromDom =', scope);
        assert.equal(await refresh({ apiMethod: 'tick', liveUpdateStatus: true }), true);
        assert.equal(calls.filter(([kind]) => kind === 'php').length, outcome === 'true' ? 0 : 1, outcome);
    }
});

test('configuration replacement handled by API tick does not also invoke PHP fallback', async () => {
    let structural = 0, php = 0;
    const item = fixture({ readConfigSnapshot: async () => ({ revisions: { folder: 2 } }),
        isConfigCurrent: () => false, requestStructuralRefresh: () => { structural++; } });
    const integration = createIntegration(item.deps);
    const refresh = loadMain('refreshDockerRuntimeStateInPlace', 'const readDockerHostOrderFromDom =', mainScope({
        getDockerApiIntegration: () => integration,
        refreshDockerRuntimeStateFromPhp: async () => { php++; return true; }
    }));
    assert.equal(await refresh({ apiMethod: 'tick' }), true);
    assert.equal(structural, 1); assert.equal(php, 0); assert.equal(item.reads(), 0);
});

test('late API outcome cannot start PHP fallback after disposal, a new render or a newer refresh', async () => {
    for (const invalidation of ['disposal', 'render', 'refresh']) {
        const pending = deferred(); let php = 0;
        const scope = mainScope({ getDockerApiIntegration: () => ({ refresh: () => pending.promise }),
            refreshDockerRuntimeStateFromPhp: async () => { php++; return true; } });
        const refresh = loadMain('refreshDockerRuntimeStateInPlace', 'const readDockerHostOrderFromDom =', scope);
        const running = refresh();
        if (invalidation === 'disposal') scope.dockerRuntimePageDisposed = true;
        if (invalidation === 'render') scope.dockerBootstrapGeneration++;
        if (invalidation === 'refresh') scope.dockerRuntimeRefreshGeneration++;
        pending.resolve(false);
        assert.equal(await running, false); assert.equal(php, 0, invalidation);
    }
});

const phpScope = extra => {
    const queued = [], stored = [], accepted = [], timers = [];
    let reads = 0;
    const scope = mainScope({
        dockerRuntimePerformanceTelemetry: null, dockerQuickFinderApi: null,
        dockerRuntimeInfoByName: { app: { state: 'original' } },
        lastLiveRefreshStateSignature: '', lastLiveRefreshStateEntityCount: 1,
        runtimeSnapshotApi: {
            buildUrl: () => '/fixture-state', parsePayload: payload => payload,
            diffRuntimeRows: () => ({ changed: ['app'], hasChanges: true, structuralChanged: false })
        },
        pluginRequestClient: { getJson: async () => { reads++; return { runtime: { app: { state: 'latest' } } }; } },
        dockerRuntimeSnapshotConfigMatches: () => true,
        normalizeDockerRuntimeInfoMap: value => value, parseJsonPayloadSafe: value => value,
        buildDockerStateSignature: value => JSON.stringify(value),
        rememberDockerRuntimeSnapshot: value => accepted.push(value),
        syncDockerVisibleFoldersFromRuntimeCache: () => {},
        getDockerRuntimeInfoApi: () => ({ membershipInputsChanged: () => false }),
        dockerRuntimeStateStore: { set: value => stored.push(value) },
        queueLoadlistRefresh: value => queued.push(value),
        getDockerApiIntegration: () => null,
        window: { setTimeout: callback => { timers.push(callback); } },
        ...extra
    });
    return { scope, queued, stored, accepted, timers, reads: () => reads };
};

test('PHP runtime responses do not publish or trigger native fallback after disposal or a new render', async () => {
    for (const invalidation of ['disposal', 'render']) {
        const pending = deferred(), item = phpScope({ pluginRequestClient: { getJson: () => pending.promise } });
        const refresh = loadMain('refreshDockerRuntimeStateFromPhp', 'const refreshDockerRuntimeStateInPlace =', item.scope);
        const running = refresh();
        if (invalidation === 'disposal') item.scope.dockerRuntimePageDisposed = true;
        else item.scope.dockerBootstrapGeneration++;
        pending.resolve({ runtime: { app: { state: 'late' } } });
        assert.equal(await running, false);
        assert.equal(item.scope.dockerRuntimeInfoByName.app.state, 'original');
        assert.deepEqual(item.accepted, []); assert.deepEqual(item.queued, []);
    }
});

test('older PHP refresh cannot overwrite a newer refresh and stale follow-up timers do not fetch', async () => {
    const first = deferred(), second = deferred(); let request = 0;
    const item = phpScope({ pluginRequestClient: { getJson: () => (++request === 1 ? first.promise : second.promise) } });
    const refresh = loadMain('refreshDockerRuntimeStateFromPhp', 'const readDockerHostOrderFromDom =', item.scope, 'refreshDockerRuntimeStateInPlace');
    const older = refresh({ apiFirst: false }), newer = refresh({ apiFirst: false, followupDelayMs: 10 });
    second.resolve({ runtime: { app: { state: 'newer' } } });
    assert.equal(await newer, true);
    first.resolve({ runtime: { app: { state: 'older' } } });
    assert.equal(await older, false);
    assert.equal(item.scope.dockerRuntimeInfoByName.app.state, 'newer');
    item.scope.dockerRuntimePageDisposed = true;
    item.timers[0]();
    assert.equal(request, 2, 'disposed follow-up cannot fetch another snapshot');
});

test('PHP scheduled configuration replacement queues once, while explicit lifecycle preservation defers rebuild', async () => {
    for (const preserveGroupedDom of [false, true]) {
        const item = phpScope({ dockerRuntimeSnapshotConfigMatches: () => false });
        const refresh = loadMain('refreshDockerRuntimeStateFromPhp', 'const refreshDockerRuntimeStateInPlace =', item.scope);
        assert.equal(await refresh({ preserveGroupedDom }), preserveGroupedDom);
        assert.equal(item.queued.length, preserveGroupedDom ? 0 : 1);
        assert.equal(item.accepted.length, preserveGroupedDom ? 1 : 0);
        assert.equal(item.stored.some(value => value.deferredConfigurationRebuild), preserveGroupedDom);
    }
});

test('initial API enrichment cannot publish across a newer runtime refresh generation', async () => {
    const pending = deferred(), item = fixture();
    item.provider.listContainers = () => pending.promise;
    const integration = createIntegration(item.deps), preparing = integration.prepare({ refresh: true });
    await new Promise(resolve => setImmediate(resolve));
    item.advance();
    pending.resolve([{ schemaVersion: 1, id: 'a'.repeat(64), name: 'app', names: ['app'], state: 'running', autoStart: false }]);
    assert.equal(await preparing, null); assert.equal(item.applications(), 0);
});

test('production API integration generation includes both native renders and runtime refreshes', () => {
    let supplied;
    const scope = mainScope({ dockerApiIntegration: null, dockerProviderRegistry: {},
        dockerApiCoordinatorModule: { createIntegration: deps => { supplied = deps; return {}; } },
        dockerRuntimeSnapshotConfigMatches: () => true,
        dockerHostCompatibilityDecision: { hostGeneration: 'fixture' }, window: { setTimeout() {} }
    });
    loadMain('getDockerApiIntegration', 'const refreshDockerRuntimeStateFromPhp =', scope)();
    const initial = supplied.getRuntimeGeneration();
    scope.dockerRuntimeRefreshGeneration++;
    assert.notEqual(supplied.getRuntimeGeneration(), initial, 'initial API enrichment must see a newer PHP refresh generation');
    const refreshed = supplied.getRuntimeGeneration(); scope.dockerBootstrapGeneration++;
    assert.notEqual(supplied.getRuntimeGeneration(), refreshed);
});
