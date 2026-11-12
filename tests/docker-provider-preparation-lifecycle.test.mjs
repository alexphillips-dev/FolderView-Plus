import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createRegistry, PROVIDER_IDS } = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.providers.js');

function fixture() {
    const probes = [], evidence = [];
    const registry = createRegistry({ window: {},
        compatibilityModule: { HOST_GENERATIONS: { NATIVE_DOCKER_VUE: 'native', LEGACY_DOCKER_TABLE: 'legacy' } },
        compatibilityController: { updateProviderEvidence: value => evidence.push(value) },
        transport: { probeCapabilities: () => new Promise(resolve => probes.push(resolve)) } });
    return { registry, probes, evidence };
}
const capabilities = { endpointAvailable: true, query: { containers: true } };

test('Docker provider preparation finishing after disposal produces no fatal rejection or evidence', async () => {
    const f = fixture();
    const pending = f.registry.prepare({ hostGeneration: 'native' });
    f.registry.dispose();
    f.probes[0](capabilities);
    assert.equal(await pending, null);
    assert.deepEqual(f.evidence, []);
    assert.equal(f.registry.snapshot().selected, null);
});

test('older Docker provider preparation cannot publish evidence for the new selection', async () => {
    const f = fixture();
    const pending = f.registry.prepare({ hostGeneration: 'native' });
    const current = await f.registry.prepare({ hostGeneration: 'unknown' });
    assert.equal(current.id, PROVIDER_IDS.UNSUPPORTED_UNKNOWN);
    f.probes[0](capabilities);
    assert.equal(await pending, null);
    assert.equal(f.evidence.length, 1);
    assert.equal(f.evidence[0].provider.selected, PROVIDER_IDS.UNSUPPORTED_UNKNOWN);
});

test('current Docker provider preparation still publishes readiness and returns its provider', async () => {
    const f = fixture();
    const pending = f.registry.prepare({ hostGeneration: 'native' });
    f.probes[0](capabilities);
    assert.equal((await pending).id, PROVIDER_IDS.UNRAID_GRAPHQL);
    assert.equal(f.evidence.length, 1);
    assert.equal(f.evidence[0].provider.state, 'ready');
});

test('repeated preparation of the same Docker provider suppresses the older completion', async () => {
    const f = fixture();
    const older = f.registry.prepare({ hostGeneration: 'native' });
    const newer = f.registry.prepare({ hostGeneration: 'native' });
    f.probes[1](capabilities);
    await newer;
    f.probes[0](capabilities);
    assert.equal(await older, null);
    assert.equal(f.evidence.length, 1);
});

test('late hybrid health evidence is ignored after Docker registry disposal', async () => {
    const evidence = [];
    let resolveQuery;
    const registry = createRegistry({ window: {},
        compatibilityModule: { HOST_GENERATIONS: { LEGACY_DOCKER_TABLE: 'legacy' } },
        compatibilityController: { updateProviderEvidence: value => evidence.push(value) },
        transport: { probeCapabilities: async () => capabilities,
            query: () => new Promise(resolve => { resolveQuery = resolve; }) } });
    await registry.prepare({ hostGeneration: 'legacy', __backgroundResolution: true, __capabilityEvidence: capabilities });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(typeof resolveQuery, 'function');
    registry.dispose();
    resolveQuery({ docker: { containers: [] } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(evidence.length, 1);
    assert.equal(evidence[0].provider.health, undefined);
});
