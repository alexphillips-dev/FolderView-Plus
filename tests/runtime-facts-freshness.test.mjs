import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = process.env.FVPLUS_DRAFT_SCRIPTS_DIR || path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts');
const model = require(path.join(root, 'docker.runtime.container-model.js'));
const healthModule = require(path.join(root, 'docker.runtime.provider-health.js'));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const flush = () => new Promise(resolve => setImmediate(resolve));

test('canonical container facts distinguish update availability from host Updated and preserve normalized decisions', () => {
    const fixtures = [
        [{ info: { State: { Updated: true } } }, false], [{ info: { State: { Updated: false } } }, true],
        [{ State: { Updated: true } }, false], [{ State: { Updated: false } }, true],
        [{ Updated: true }, false], [{ Updated: false }, true],
        [{ isUpdateAvailable: true, info: { State: { Updated: true } } }, true],
        [{ isUpdateAvailable: false, info: { State: { Updated: false } } }, false],
        [{ update: false, info: { State: { Updated: false } } }, false],
        [{ update: true, info: { State: { Updated: true } } }, true],
        [{ update: false, isUpdateAvailable: true }, false], [{}, false],
        [{ info: { State: { Updated: null } }, Updated: false }, true], [{ Updated: 'false' }, false]
    ];
    const commandSource = fs.readFileSync(path.join(root, 'docker.runtime.command-view.js'), 'utf8');
    const start = commandSource.indexOf('const containerHasUpdate ='), end = commandSource.indexOf('const getContainerStateMeta =', start);
    const commandHasUpdate = new Function('containerModel', commandSource.slice(start, end) + '\nreturn containerHasUpdate;')(model);
    for (const [entry, expected] of fixtures) {
        const original = structuredClone(entry);
        assert.equal(model.normalizeContainer(entry).isUpdateAvailable, expected, JSON.stringify(entry));
        assert.equal(commandHasUpdate(entry), expected, 'Command overview/cards must use the same meaning');
        assert.deepEqual(entry, original, 'normalizing facts cannot change source state');
    }
});

test('provider health refreshes an existing valid summary at TTL and cannot rehydrate after disposal', async () => {
    let clock = 0, calls = 0, reads = 0, updates = 0;
    let summary = { detailsAvailable: true, updateAvailableCount: 1 };
    const controller = healthModule.createController({ now: () => clock, refreshMs: 10000,
        providerRegistry: { getDefault: () => ({ health: {
            getLastSummary: () => { reads++; return summary; },
            getSummary: async () => { calls++; summary = { detailsAvailable: true, updateAvailableCount: calls + 1 }; return summary; }
        } }) }
    });
    assert.equal(controller.getModel({ onUpdate: () => { updates++; } }).updates, 1);
    await flush(); assert.equal(calls, 1); assert.equal(updates, 1);
    clock = 9999; assert.equal(controller.getModel().updates, 2);
    await flush(); assert.equal(calls, 1);
    clock = 10000; assert.equal(controller.getModel({ onUpdate: () => { updates++; } }).updates, 2);
    await flush(); assert.equal(calls, 2); assert.equal(updates, 2); assert.equal(controller.getModel().updates, 3);
    controller.dispose(); const previousReads = reads;
    clock = 50000; assert.equal(controller.getModel(), null);
    await flush(); assert.equal(reads, previousReads); assert.equal(calls, 2);
});

test('provider health coalesces pending refresh and retains retry cadence after failure', async () => {
    let clock = 100000, calls = 0; const pending = deferred();
    const controller = healthModule.createController({ now: () => clock, refreshMs: 10000,
        providerRegistry: { getDefault: () => ({ health: {
            getLastSummary: () => ({ detailsAvailable: true, updateAvailableCount: 1 }),
            getSummary: () => { calls++; return calls === 1 ? pending.promise : Promise.reject(Error('fixture')); }
        } }) }
    });
    controller.getModel(); controller.getModel(); await flush(); assert.equal(calls, 1);
    pending.resolve({ detailsAvailable: true, updateAvailableCount: 0 }); await flush();
    clock += 10000; controller.getModel(); await flush(); assert.equal(calls, 2);
    controller.getModel(); await flush(); assert.equal(calls, 2);
    clock += 10000; controller.getModel(); await flush(); assert.equal(calls, 3);
    controller.dispose();
});

const response = data => ({ ok: true, status: 200, json: async () => ({ data }) });
const schema = labels => ({ queryType: { fields: [{ name: 'docker' }] }, dockerType: { fields: [{ name: 'containers' }] },
    mutationType: { fields: [] }, dockerContainerType: { fields: labels ? [{ name: 'labels' }] : [] } });
const freshTransport = () => {
    const filename = path.join(root, 'runtime.transport.js'); delete require.cache[require.resolve(filename)]; return require(filename);
};
const graphqlWindow = handler => ({ setTimeout, clearTimeout, AbortController,
    fetch: async (_url, options) => handler(JSON.parse(options.body).query) });

test('late forced capability probe cannot downgrade newer ready discovery or start fallback probes', async () => {
    const transport = freshTransport(), first = deferred(); let capabilityCalls = 0, fallbackCalls = 0;
    const win = graphqlWindow(query => {
        if (query.includes('FVPlusDockerCapabilities')) return ++capabilityCalls === 1 ? first.promise : response(schema(true));
        if (query.includes('FVPlusApiVersion')) return response({ info: { versions: { core: { api: 'new' } } } });
        fallbackCalls++; return response({ docker: { containers: [] } });
    });
    const older = transport.probeCapabilities({ window: win, force: true });
    const newer = await transport.probeCapabilities({ window: win, force: true });
    first.resolve(response(schema(false))); await older;
    assert.equal(newer.state, 'ready'); assert.equal(transport.getCapabilitySnapshot().state, 'ready');
    assert.equal(transport.getCapabilitySnapshot().containerFields.labels, true); assert.equal(fallbackCalls, 0);
});

test('an older finally cannot clear the in-flight current capability probe', async () => {
    const transport = freshTransport(), first = deferred(), second = deferred(); let capabilityCalls = 0;
    const win = graphqlWindow(query => {
        if (query.includes('FVPlusDockerCapabilities')) return ++capabilityCalls === 1 ? first.promise : capabilityCalls === 2 ? second.promise : response(schema(false));
        return response({ info: { versions: { core: { api: 'fixture' } } } });
    });
    const older = transport.probeCapabilities({ window: win, force: true });
    const newer = transport.probeCapabilities({ window: win, force: true });
    first.resolve(response(schema(false))); await older;
    const joined = transport.probeCapabilities({ window: win });
    await Promise.resolve(); assert.equal(capabilityCalls, 2);
    second.resolve(response(schema(true))); await Promise.all([newer, joined]);
    assert.equal(transport.getCapabilitySnapshot().containerFields.labels, true);
});

test('late optional version telemetry cannot publish an older capability snapshot', async () => {
    const transport = freshTransport(), version = deferred(); let capabilityCalls = 0, versionCalls = 0;
    const win = graphqlWindow(query => {
        if (query.includes('FVPlusDockerCapabilities')) return response(schema(++capabilityCalls === 2));
        if (query.includes('FVPlusApiVersion')) return ++versionCalls === 1 ? version.promise : response({ info: { versions: { core: { api: 'new' } } } });
        return response({});
    });
    const older = transport.probeCapabilities({ window: win, force: true });
    await flush(); assert.equal(versionCalls, 1);
    await transport.probeCapabilities({ window: win, force: true });
    version.resolve(response({ info: { versions: { core: { api: 'old' } } } })); await older;
    assert.equal(transport.getCapabilitySnapshot().apiVersion, 'new');
    assert.equal(transport.getCapabilitySnapshot().containerFields.labels, true);
});

test('new authoritative capability failure may downgrade discovery and starts from clean defaults', async () => {
    const transport = freshTransport();
    await transport.probeCapabilities({ force: true, window: graphqlWindow(query => query.includes('FVPlusDockerCapabilities') ? response(schema(true)) : response({})) });
    const unavailable = await transport.probeCapabilities({ force: true, window: {} });
    assert.equal(unavailable.state, 'unavailable'); assert.equal(unavailable.query.containers, false);
    assert.deepEqual(unavailable.containerFields, {}); assert.equal(unavailable.lastErrorCategory, 'fetch-unavailable');
});

test('current introspection failure still discovers the supported legacy read shape', async () => {
    const transport = freshTransport(); let shapes = 0;
    const win = graphqlWindow(query => {
        if (query.includes('FVPlusDockerCapabilities')) return { ok: false, status: 403, json: async () => ({}) };
        if (query.includes('FVPlusDockerShape')) { shapes++; return response({ docker: { containers: [] } }); }
        return response({ info: { versions: { core: { api: 'fixture' } } } });
    });
    const result = await transport.probeCapabilities({ window: win, force: true });
    assert.equal(result.state, 'limited'); assert.equal(result.query.containers, true);
    assert.equal(result.query.shape, 'docker.containers'); assert.equal(shapes, 1);
});
