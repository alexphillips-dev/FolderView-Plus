import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const scriptsRoot = path.resolve(
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts'
);
const coordinatorModule = require(path.join(scriptsRoot, 'docker.runtime.api-coordinator.js'));

const runtimeEntry = (name, options = {}) => ({
    name,
    id: options.id || `sha256:${name.padEnd(64, '0')}`,
    Labels: {
        'net.unraid.docker.managed': 'dockerman',
        'fixture.preserved': 'yes'
    },
    info: {
        Id: options.id || `sha256:${name.padEnd(64, '0')}`,
        State: {
            Running: options.running === true,
            Paused: options.paused === true,
            Status: options.status || 'stopped',
            Autostart: options.autostart === true,
            Updated: options.updated ?? true,
            manager: 'dockerman',
            WebUi: '/legacy'
        }
    }
});

const apiContainer = (name, options = {}) => ({
    schemaVersion: 1,
    source: 'unraid-graphql',
    id: options.id || `server:${name.padEnd(64, '0')}`,
    shortId: (options.id || name.padEnd(64, '0')).split(':').pop().slice(0, 12),
    names: [name],
    name,
    state: options.state || 'running',
    status: options.status || 'Up 10 seconds',
    autoStart: options.autostart !== false,
    labels: options.labels || { 'fixture.api': 'yes' },
    image: options.image || 'fixture/image:latest',
    iconUrl: options.iconUrl || '/api-icon.png',
    webUiUrl: options.webUiUrl || '/api-webui',
    isUpdateAvailable: options.isUpdateAvailable === true,
    isOrphaned: options.isOrphaned === true,
    isRebuildReady: options.isRebuildReady === true
});

const capabilities = {
    containerFields: {
        labels: true,
        image: true,
        iconUrl: true,
        webUiUrl: true,
        isUpdateAvailable: true,
        isOrphaned: true,
        isRebuildReady: true
    }
};

test('API merge updates schema-confirmed runtime state without erasing PHP metadata', () => {
    const current = { app: runtimeEntry('app', { running: false, updated: true }) };
    const result = coordinatorModule.mergeProviderContainers(current, [
        apiContainer('app', { isUpdateAvailable: true, isOrphaned: true })
    ], capabilities);

    assert.equal(result.structuralChanged, false);
    assert.deepEqual(result.changed, ['app']);
    assert.equal(result.runtimeMap.app.info.State.Running, true);
    assert.equal(result.runtimeMap.app.info.State.Paused, false);
    assert.equal(result.runtimeMap.app.info.State.Updated, false);
    assert.equal(result.runtimeMap.app.info.State.manager, 'dockerman');
    assert.equal(result.runtimeMap.app.info.State.WebUi, '/api-webui');
    assert.equal(result.runtimeMap.app.Labels['fixture.preserved'], 'yes');
    assert.equal(result.runtimeMap.app.Labels['fixture.api'], 'yes');
    assert.equal(result.runtimeMap.app.isOrphaned, true);
});

test('API merge preserves optional fallback values when fields are not in the schema', () => {
    const current = { app: runtimeEntry('app', { updated: false }) };
    const result = coordinatorModule.mergeProviderContainers(current, [
        apiContainer('app', { isUpdateAvailable: false })
    ], { containerFields: {} });

    assert.equal(result.runtimeMap.app.info.State.Updated, false);
    assert.equal(result.runtimeMap.app.info.State.WebUi, '/legacy');
    assert.equal(result.runtimeMap.app.Labels['fixture.api'], undefined);
});

test('API merge treats identity-set changes as structural and does not invent host rows', () => {
    const current = { app: runtimeEntry('app') };
    const result = coordinatorModule.mergeProviderContainers(current, [
        apiContainer('app'),
        apiContainer('new-app')
    ], capabilities);

    assert.equal(result.structuralChanged, true);
    assert.equal(result.providerOnlyCount, 1);
    assert.equal(result.runtimeOnlyCount, 0);
    assert.equal(Object.hasOwn(result.runtimeMap, 'new-app'), false);
});

test('coordinator keeps the native host authoritative for API identity-set differences', async () => {
    let runtimeMap = { app: runtimeEntry('app') };
    let structuralRefreshes = 0;
    const provider = {
        supports: () => true,
        getCapabilities: () => capabilities,
        listContainers: async () => [apiContainer('app'), apiContainer('new-app')]
    };
    const coordinator = coordinatorModule.createCoordinator({
        providerRegistry: {
            getDefault: () => provider,
            prepare: async () => provider
        },
        getRuntimeMap: () => runtimeMap,
        applyRuntimeMap: (next) => { runtimeMap = next; },
        requestStructuralRefresh: () => { structuralRefreshes += 1; }
    });

    const result = await coordinator.refreshAll({ fallback: false });
    const repeated = await coordinator.refreshAll({ fallback: false });
    await Promise.resolve();
    assert.equal(result.structuralChanged, true);
    assert.equal(repeated.structuralChanged, true);
    assert.equal(structuralRefreshes, 0);
    assert.equal(Object.hasOwn(runtimeMap, 'new-app'), false);
    coordinator.dispose();
});

test('coordinator uses targeted reconciliation and rejects stale work after disposal', async () => {
    let runtimeMap = { app: runtimeEntry('app') };
    const provider = {
        supports: () => true,
        getCapabilities: () => capabilities,
        listContainers: async () => [apiContainer('app')],
        reconcileContainer: async () => apiContainer('app', { state: 'paused' })
    };
    const coordinator = coordinatorModule.createCoordinator({
        providerRegistry: { getDefault: () => provider },
        getRuntimeMap: () => runtimeMap,
        applyRuntimeMap: (next) => { runtimeMap = next; }
    });

    const result = await coordinator.reconcileContainer('app', { fallback: false });
    assert.equal(result.applied, true);
    assert.equal(runtimeMap.app.info.State.Paused, true);
    assert.equal(coordinator.status().source, 'unraid-graphql-targeted');
    coordinator.dispose();
    assert.equal(coordinator.status().state, 'disposed');
});

test('permission failures disable API retries for the page lifecycle', async () => {
    let calls = 0;
    const provider = {
        supports: () => true,
        listContainers: async () => {
            calls += 1;
            throw Object.assign(new Error('denied'), { category: 'permission-denied' });
        }
    };
    const coordinator = coordinatorModule.createCoordinator({
        providerRegistry: { getDefault: () => provider },
        getRuntimeMap: () => ({ app: runtimeEntry('app') })
    });

    const first = await coordinator.refreshAll({ fallback: false });
    const second = await coordinator.refreshAll({ fallback: false });
    assert.equal(first.errorCategory, 'permission-denied');
    assert.equal(second.unavailable, true);
    assert.equal(calls, 1);
    assert.equal(coordinator.status().state, 'unavailable');
});

test('transient failures use bounded cooldown and recover after the clock advances', async () => {
    let clock = 1000;
    let calls = 0;
    const provider = {
        supports: () => true,
        getCapabilities: () => capabilities,
        listContainers: async () => {
            calls += 1;
            if (calls === 1) throw Object.assign(new Error('busy'), { category: 'rate-limited' });
            return [apiContainer('app')];
        }
    };
    let runtimeMap = { app: runtimeEntry('app') };
    const coordinator = coordinatorModule.createCoordinator({
        providerRegistry: { getDefault: () => provider },
        now: () => clock,
        getRuntimeMap: () => runtimeMap,
        applyRuntimeMap: (next) => { runtimeMap = next; }
    });

    await coordinator.refreshAll({ fallback: false });
    assert.equal(coordinator.status().state, 'cooldown');
    await coordinator.refreshAll({ fallback: false });
    assert.equal(calls, 1);
    clock += coordinatorModule.TRANSIENT_COOLDOWNS_MS[0] + 1;
    const recovered = await coordinator.refreshAll({ fallback: false });
    assert.equal(recovered.applied, true);
    assert.equal(calls, 2);
    assert.equal(coordinator.status().state, 'ready');
});

test('integration guards configuration revisions and schedules targeted lifecycle follow-up', async () => {
    let runtimeMap = { app: runtimeEntry('app') };
    let configurationCurrent = false;
    let structuralRefreshes = 0;
    let targetedReads = 0;
    let followup = null;
    const provider = {
        supports: () => true,
        getCapabilities: () => capabilities,
        listContainers: async () => [apiContainer('app')],
        reconcileContainer: async () => {
            targetedReads += 1;
            return apiContainer('app', { state: 'paused' });
        }
    };
    const integration = coordinatorModule.createIntegration({
        providerRegistry: { getDefault: () => provider, prepare: async () => provider },
        getRuntimeMap: () => runtimeMap,
        applyRuntimeMap: (next) => { runtimeMap = next; },
        readConfigSnapshot: async () => ({ revisions: { folder: 2, prefs: 3 } }),
        isConfigCurrent: () => configurationCurrent,
        requestStructuralRefresh: () => { structuralRefreshes += 1; },
        setTimeout: (handler) => { followup = handler; }
    });

    assert.equal(await integration.tick(), true);
    assert.equal(structuralRefreshes, 1);
    assert.equal(targetedReads, 0);
    configurationCurrent = true;
    assert.equal(await integration.refresh({ containerId: 'app', followupDelayMs: 100 }), true);
    assert.equal(targetedReads, 1);
    assert.equal(runtimeMap.app.info.State.Paused, true);
    assert.equal(typeof followup, 'function');
    await followup();
    assert.equal(targetedReads, 2);
    integration.dispose();
    assert.equal(integration.status(), null);
});
