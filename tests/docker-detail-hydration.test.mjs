import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const runtime = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.info.js');
const utils = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils.js');
const api = runtime.createApi({ window: {}, utils });
const id = 'a'.repeat(64), otherId = 'b'.repeat(64);
const light = (identity = id) => api.normalizeDockerRuntimeInfoMap({ fixture: {
    id: identity.slice(0, 12), Image: 'fixture/image:latest', Labels: { scope: 'fixture' },
    running: true, state: 'running', autostart: true, Updated: true, manager: 'dockerman',
    webuiHydrationPending: true
} }, {});
const full = (identity = id) => ({ fixture: { Id: identity, shortId: identity.slice(0, 12),
    Image: 'fixture/image:latest', Labels: { scope: 'fixture' },
    info: { Id: identity, Name: 'fixture', Config: { Image: 'fixture/image:latest', Labels: { scope: 'fixture' } },
        Ports: [{ PrivatePort: 8080 }], Shell: 'bash', template: { path: '/fixture/template.xml' },
        State: { Running: true, Paused: false, Autostart: true, Updated: true, manager: 'dockerman',
            WebUi: 'https://fixture.invalid/', WebUiCapability: true, WebUiHydrationPending: false } } } });
const snapshot = infoByName => utils.buildMembershipSnapshot({ type: 'docker',
    folders: { group: { name: 'Group', containers: ['fixture'] } }, infoByName, names: ['fixture'] });

test('partial and empty details retain accepted inventory, membership and unreturned entries', () => {
    const accepted = { ...light(), missing: { ...light().fixture, shortId: otherId.slice(0, 12) } };
    const before = snapshot(accepted);
    const { runtimeMap, diagnostics } = api.mergeDockerRuntimeDetailInfoMap(full(), accepted);
    assert.equal(runtimeMap.missing, accepted.missing);
    assert.equal(snapshot(runtimeMap).signature, before.signature);
    assert.deepEqual(runtimeMap.fixture.info.Ports, [{ PrivatePort: 8080 }]);
    assert.equal(runtimeMap.fixture.info.Shell, 'bash');
    assert.equal(runtimeMap.fixture.info.State.WebUi, 'https://fixture.invalid/');
    assert.equal(runtimeMap.fixture.info.State.WebUiHydrationPending, false);
    assert.equal(diagnostics.enrichedCount, 1);
    assert.equal(diagnostics.missingCount, 1);
    const empty = api.mergeDockerRuntimeDetailInfoMap({}, accepted);
    assert.deepEqual(empty.runtimeMap, accepted);
    assert.equal(empty.diagnostics.missingCount, 2);
});

test('detail image and label conflicts cannot change accepted rule facts or mutate inputs', () => {
    const accepted = light(), details = full();
    details.fixture.Image = details.fixture.info.Config.Image = 'fixture/other:latest';
    details.fixture.Labels = details.fixture.info.Config.Labels = { scope: 'changed' };
    const before = JSON.stringify([accepted, details]);
    const result = api.mergeDockerRuntimeDetailInfoMap(details, accepted);
    assert.equal(snapshot(result.runtimeMap).signature, snapshot(accepted).signature);
    assert.equal(result.diagnostics.imageConflictCount, 1);
    assert.equal(result.diagnostics.labelConflictCount, 1);
    assert.equal(result.runtimeMap.fixture.info.Config.Image, 'fixture/image:latest');
    assert.deepEqual(result.runtimeMap.fixture.info.Config.Labels, { scope: 'fixture' });
    assert.equal(JSON.stringify([accepted, details]), before);
    assert.ok(Object.values(result.diagnostics).every(value => typeof value === 'number'));
});

test('deleted and newly discovered detail entries cannot recreate or add accepted containers', () => {
    const result = api.mergeDockerRuntimeDetailInfoMap(full(), {});
    assert.deepEqual(result.runtimeMap, {});
    assert.equal(result.diagnostics.unexpectedCount, 1);
});

test('reused names, missing IDs and conflicting full IDs reject stale metadata', () => {
    const accepted = light(otherId);
    for (const details of [full(id), { fixture: { info: { State: {} } } }]) {
        const result = api.mergeDockerRuntimeDetailInfoMap(details, accepted);
        assert.equal(result.runtimeMap.fixture, accepted.fixture);
        assert.equal(result.diagnostics.identityMismatchCount, 1);
    }
    const current = full().fixture;
    const colliding = id.slice(0, 12) + 'c'.repeat(52);
    const result = api.mergeDockerRuntimeDetailInfoMap(full(colliding), { fixture: current });
    assert.equal(result.runtimeMap.fixture, current);
    assert.equal(result.diagnostics.identityMismatchCount, 1);
});

test('state replacement IDs take precedence over retained older full IDs', () => {
    const accepted = api.normalizeDockerRuntimeInfoMap({ fixture: {
        id: otherId.slice(0, 12), running: true, Image: 'fixture/new:latest'
    } }, full());
    const stale = api.mergeDockerRuntimeDetailInfoMap(full(), accepted);
    assert.equal(stale.diagnostics.identityMismatchCount, 1);
    assert.equal(stale.runtimeMap.fixture, accepted.fixture);
    const fresh = api.mergeDockerRuntimeDetailInfoMap(full(otherId), accepted);
    assert.equal(fresh.diagnostics.enrichedCount, 1);
    assert.equal(fresh.runtimeMap.fixture.Image, 'fixture/new:latest');
});

test('matching short and full IDs support host prefixes and incomplete metadata safely', () => {
    const details = full();
    delete details.fixture.shortId;
    details.fixture.Id = 'sha256:' + id;
    const accepted = light();
    assert.equal(api.mergeDockerRuntimeDetailInfoMap(details, accepted).diagnostics.enrichedCount, 1);
    const malformed = { fixture: { shortId: id.slice(0, 12) } };
    const result = api.mergeDockerRuntimeDetailInfoMap(malformed, accepted);
    assert.equal(result.diagnostics.invalidDetailCount, 1);
    assert.equal(result.runtimeMap.fixture, accepted.fixture);
});

test('delayed details preserve newer runtime flags and newer provider WebUI metadata', () => {
    const requested = light();
    const current = light();
    Object.assign(current.fixture.info.State, { Running: false, Paused: true, Autostart: false,
        Status: 'newer', Updated: false, WebUi: 'https://newer.invalid/', WebUiHydrationPending: false });
    const result = api.mergeDockerRuntimeDetailInfoMap(full(), current, requested);
    assert.deepEqual(result.runtimeMap.fixture.info.State, { ...full().fixture.info.State, ...current.fixture.info.State,
        WebUiCapability: true });
    assert.equal(result.diagnostics.preservedStateCount, 1);
    assert.deepEqual(result.runtimeMap.fixture.info.Ports, [{ PrivatePort: 8080 }]);
});

test('authoritative state changes still invalidate membership and remove deleted inventory', () => {
    const accepted = light();
    api.setMembershipSnapshot(snapshot(accepted));
    const changed = api.normalizeDockerRuntimeInfoMap({ fixture: { id: id.slice(0, 12), Image: 'fixture/new:latest', Labels: {} } }, accepted);
    assert.equal(api.membershipInputsChanged(changed), true);
    const result = api.mergeDockerRuntimeDetailInfoMap(full(), changed);
    assert.equal(result.runtimeMap.fixture.Image, 'fixture/new:latest');
    assert.equal(api.membershipInputsChanged(result.runtimeMap), true);
    assert.deepEqual(api.normalizeDockerRuntimeInfoMap({}, result.runtimeMap), {});
});

test('production hydration preserves a newer same-generation state and its live-refresh signature', async () => {
    const source = fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js', 'utf8');
    const start = source.indexOf('const queueDockerDeferredRuntimeInfoHydration =');
    const end = source.indexOf('const bindDockerPostUpdateRenderReconcile =', start);
    assert.ok(start > 0 && end > start);
    let finish;
    const response = new Promise(resolve => { finish = resolve; });
    const phases = [];
    const context = { dockerRuntimeInfoByName: light(), dockerBootstrapGeneration: 1,
        lastLiveRefreshStateSignature: 'initial', lastLiveRefreshStateEntityCount: 1,
        getDockerRuntimeInfoApi: () => api, performance: { now: () => 0 },
        dockerRuntimePerformanceTelemetry: null,
        window: { requestAnimationFrame: callback => callback() },
        captureDockerPreviewActionGeometry: () => new Map(), compareDockerPreviewActionGeometry() {},
        markDockerRuntimeLayoutPhase: (name, details) => phases.push({ name, details }),
        markDockerFatalBannerStep() {}, recordDockerFatalBannerAction() {},
        syncDockerVisibleFoldersFromRuntimeCache() {}, parseJsonPayloadSafe: JSON.parse };
    vm.runInNewContext(source.slice(start, end) + '\nglobalThis.hydrate = queueDockerDeferredRuntimeInfoHydration;', context);
    context.hydrate(1, () => response);
    context.dockerRuntimeInfoByName = light();
    context.dockerRuntimeInfoByName.fixture.info.State.Running = false;
    context.lastLiveRefreshStateSignature = 'newer-state';
    finish(JSON.stringify(full()));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(context.dockerRuntimeInfoByName.fixture.info.State.Running, false);
    assert.equal(context.lastLiveRefreshStateSignature, 'newer-state');
    assert.equal(context.lastLiveRefreshStateEntityCount, 1);
    assert.equal(phases.find(phase => phase.name === 'full-info-ready').details.preservedStateCount, 1);
});
