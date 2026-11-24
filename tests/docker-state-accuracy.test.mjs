import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInventoryRepair } from './helpers/runtime-inventory-fixture.mjs';

const require = createRequire(import.meta.url);
const runtime = '../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts';
const infoModule = require(`${runtime}/docker.runtime.info.js`);
const previewModule = require(`${runtime}/docker.runtime.preview-actions.js`);
const coordinator = require(`${runtime}/docker.runtime.api-coordinator.js`);
const actionsModule = require(`${runtime}/docker.runtime.actions.js`);

const imageId = `sha256:${'b'.repeat(64)}`;
const missingTarget = `container:${'c'.repeat(64)}`;
const healthyTarget = `container:${'0'.repeat(64)}`;
const fixture = [
    ['ordinary', 'running', 'Up 1 minute', 'fixture/current:latest', 'bridge', true],
    ['paused', 'paused', 'Up 1 minute (Paused)', 'fixture/pause:latest', 'bridge', true],
    ['legacy-paused', '', 'Up 1 minute (Paused)', 'fixture/pause:latest', 'bridge', true],
    ['stopped', 'exited', 'Exited (1) (Paused)', 'fixture/pause:latest', 'bridge', false],
    ['missing-namespace', 'exited', 'Exited (1)', 'fixture/net:latest', missingTarget, false],
    ['healthy-namespace', 'running', 'Up 1 minute', 'fixture/net:latest', healthyTarget, true],
    ['moved-tag', 'running', 'Up 1 minute', 'fixture/moved:latest', 'bridge', true, imageId],
    ['unknown-tag', 'running', 'Up 1 minute', 'fixture/unresolved:latest', 'bridge', true, imageId],
    ['pinned-image', 'running', 'Up 1 minute', imageId, 'bridge', true, imageId],
    ['pinned-repo-digest', 'running', 'Up 1 minute', `fixture/pinned@${imageId}`, 'bridge', true],
    ['unknown', 'running', 'Up 1 minute', 'fixture/unknown:latest', 'bridge', true]
];

const loadState = (mode, options = {}) => runInventoryRepair({
    type: 'docker', operation: 'read', scenario: 'healthy', mode,
    docker: fixture.map(([name, state, status, image, network, _running, listImage], index) => ({
        Id: index.toString(16).repeat(64), Names: [`/${name}`], State: state, Status: status, Image: listImage || image,
        ImageID: imageId, HostConfig: { NetworkMode: network }, Labels: { 'net.unraid.docker.managed': 'dockerman' }
    })),
    details: Object.fromEntries(fixture.map(([name, _state, _status, image, network, running]) => [ name, {
        Config: { Image: image }, State: { Running: running, Paused: name === 'paused' || name === 'legacy-paused' },
        HostConfig: { NetworkMode: network }
    }])),
    uiCache: Object.fromEntries(fixture.filter(([name]) => name !== 'unknown').map(([name]) => [name, { updated: 'true' }])),
    imageCache: { 'fixture/current:latest': false, 'fixture/moved:latest': false },
    ...options
});

test('complete Docker runtime data distinguishes paused, missing namespace, known moved tag and unknown image', () => {
    const api = infoModule.createApi({ window: {} });
    for (const mode of ['state', 'full']) {
        const result = loadState(mode);
        assert.equal(result.error, '');
        assert.equal(result.native, result.nativeBefore);
        const entries = api.normalizeDockerRuntimeInfoMap(result.response);
        assert.equal(entries.paused.info.State.Running, true);
        assert.equal(entries.paused.info.State.Paused, true);
        assert.equal(entries['legacy-paused'].info.State.Running, true);
        assert.equal(entries['legacy-paused'].info.State.Paused, true);
        assert.equal(entries.stopped.info.State.Running, false);
        assert.equal(entries.stopped.info.State.Paused, false);
        assert.equal(entries.ordinary.info.State.Paused, false);
        assert.equal(entries['missing-namespace'].isRebuildReady, true);
        assert.equal(entries['missing-namespace'].info.State.Updated, null);
        assert.equal(entries['healthy-namespace'].isRebuildReady, false);
        assert.equal(entries['healthy-namespace'].info.State.Updated, true);
        assert.equal(entries['moved-tag'].info.State.Updated, false);
        assert.equal(entries['unknown-tag'].info.State.Updated, null);
        assert.equal(entries['pinned-image'].info.State.Updated, true);
        assert.equal(entries['pinned-repo-digest'].info.State.Updated, true);
        assert.equal(entries.ordinary.info.State.Updated, true);
        assert.equal(entries.unknown.info.State.Updated, null);
        assert.equal(result.calls.filter(call => call[0] === 'docker-list').length, 2);
        assert.equal(result.calls.filter(call => call[0] === 'docker-detail').length, mode === 'state' ? 3 : fixture.length);
    }
});

test('explicit state refresh prefers the observed image cache and a failed inventory cannot confirm a missing namespace', () => {
    const result = loadState('state', { liveupdate: true, rejectVerifiedInventory: true });
    assert.equal(result.error, '');
    assert.equal(result.response.ordinary.Updated, false);
    assert.equal(result.response.unknown.Updated, null);
    assert.equal(result.response['unknown-tag'].Updated, null);
    assert.equal(result.response['missing-namespace'].isRebuildReady, null);
    assert.equal(result.response['healthy-namespace'].isRebuildReady, false);
});

test('old lightweight paused answers normalize without overriding explicit full running state', () => {
    const api = infoModule.createApi({ window: {} });
    const result = api.normalizeDockerRuntimeInfoMap({
        cached: { running: false, paused: true, state: 'stopped' },
        explicit: { info: { Name: 'explicit', State: { Running: false, Paused: true } } }
    });
    assert.equal(result.cached.info.State.Running, true);
    assert.equal(result.explicit.info.State.Running, false);
});

test('schema-confirmed rebuild supersedes update and previews omit stale update actions', () => {
    const source = { app: { name: 'app', info: { Name: 'app', State: { Updated: false } } } };
    const container = { schemaVersion: 1, name: 'app', state: 'paused', isUpdateAvailable: true, isRebuildReady: true };
    const containerFields = { isUpdateAvailable: true, isRebuildReady: true };
    const merged = coordinator.mergeProviderContainers(source, [container], { containerFields }).runtimeMap;
    assert.equal(merged.app.info.State.Running, true);
    assert.equal(merged.app.info.State.Paused, true);
    assert.equal(merged.app.isRebuildReady, true);
    assert.equal(merged.app.info.State.Updated, null);
    const cleared = coordinator.mergeProviderContainers(merged, [{ ...container, isRebuildReady: false }], { containerFields }).runtimeMap;
    assert.equal(cleared.app.isRebuildReady, false);
    assert.equal(cleared.app.info.State.Updated, false);
    const unknown = { name: 'app', state: 'running', isUpdateAvailable: null };
    assert.equal(coordinator.mergeProviderContainers(source, [unknown], { containerFields }).runtimeMap.app.info.State.Updated, false);
    const unknownSource = { app: { name: 'app', info: { Name: 'app', State: { Updated: null } } } };
    assert.equal(coordinator.mergeProviderContainers(unknownSource, [unknown], { containerFields }).runtimeMap.app.info.State.Updated, null);
    const preview = previewModule.createApi({ window: {} });
    const markup = preview.buildDockerMemberUpdateColumnHtml({
        name: 'app', manager: 'dockerman', update: true, isRebuildReady: true
    }, { advanced: true });
    assert.match(markup, /Rebuild ready/);
    assert.doesNotMatch(markup, /updateContainer\(/);
    assert.match(preview.buildDockerMemberUpdateColumnHtml({ manager: 'dockerman', updated: null }), /Update status unavailable/);
    const advancedUnknown = preview.buildDockerMemberUpdateColumnHtml({ name: 'app', manager: 'dockerman', updated: null }, { advanced: true });
    assert.doesNotMatch(advancedUnknown, /apply-update/);
    assert.match(advancedUnknown, /force-update/);
});

test('native rebuild evidence beats the flash icon, clears on recovery and is excluded from bulk updates', () => {
    const priorConstructor = globalThis.HTMLElement;
    let rebuilding = true;
    class HostCell {
        textContent = '';
        querySelector(selector) {
            if (selector === '.fa-recycle' || selector === '.fa-flash') return rebuilding ? {} : null;
            return selector === '.fa-check' ? {} : null;
        }
    }
    class HostRow {
        querySelector(selector) { return selector === 'td.updatecolumn' ? new HostCell() : null; }
    }
    globalThis.HTMLElement = class {};
    Object.setPrototypeOf(HostRow.prototype, globalThis.HTMLElement.prototype);
    Object.setPrototypeOf(HostCell.prototype, globalThis.HTMLElement.prototype);
    try {
        let current = { app: { name: 'app', info: { Name: 'app', State: { manager: 'dockerman', Updated: true } } } };
        const api = infoModule.createApi({
            window: {}, document: { getElementById: id => id === 'ct-app' ? new HostRow() : null },
            getDockerRuntimeInfoMap: () => current, setDockerRuntimeInfoMap: next => { current = next; }
        });
        assert.equal(api.syncDockerHostRowUpdateStatesFromDom(['app']), true);
        assert.equal(current.app.isRebuildReady, true);
        assert.equal(current.app.info.State.Updated, null);
        rebuilding = false;
        assert.equal(api.syncDockerHostRowUpdateStatesFromDom(['app']), true);
        assert.equal(current.app.isRebuildReady, false);
        assert.equal(current.app.info.State.Updated, true);
    } finally {
        globalThis.HTMLElement = priorConstructor;
    }

    const commands = [];
    const actions = actionsModule.createApi({
        window: { setTimeout: () => 0, clearTimeout: () => {} },
        getGlobalFolders: () => ({ fixture: { name: 'Fixture' } }),
        getScopedRuntimeContainersForFolder: () => ({
            rebuild: { managed: true, update: true, isRebuildReady: true },
            update: { managed: true, update: true },
            unknown: { managed: true, update: false }
        }),
        openDocker: command => commands.push(command)
    });
    actions.updateFolder('fixture');
    actions.forceUpdateFolder('fixture');
    assert.deepEqual(commands, ['update_container update', 'update_container update*unknown']);
});
