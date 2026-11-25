import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const moduleApi = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.start-order-workspace.js');
const api = moduleApi.createApi();
const viewModule = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.start-order-view.js');
const view = viewModule.createApi();

test('start-order sequence preview exposes app rows, waits, switches, and safe encoded actions', () => {
    const html = view.buildPreviewHtml({
        managed: true,
        autostartCount: 1,
        containerCount: 2,
        sequence: [{ name: "alpha'box", wait: 15, waitSource: 'container', batchId: 'core' }]
    }, { disabledNames: ['beta'], infoByName: { "alpha'box": { Labels: { 'net.unraid.docker.icon': '/icons/alpha.png' } } } });
    assert.match(html, /Preview autostart sequence/);
    assert.match(html, /value="15"/);
    assert.match(html, /title="container"/);
    assert.match(html, /alpha%27box/);
    assert.doesNotMatch(html, /decodeURIComponent/);
    assert.match(html, /Autostart disabled \(1\)/);
    assert.match(html, /<details class="fv-docker-start-order-disabled"><summary>/);
    assert.doesNotMatch(html, /<details class="fv-docker-start-order-disabled"[^>]*\sopen/);
    assert.match(html, /src="\/icons\/alpha\.png"/);
    assert.match(html, /class="fv-start-order-switch"/);
});

test('authoritative autostart reconciliation updates both lightweight and full Docker metadata', () => {
    const row = { autostart: true, info: { State: { Autostart: true } }, State: { Autostart: true } };
    api.setRowAutostart(row, false);
    assert.equal(api.rowAutostart(row), false);
    assert.equal(row.info.State.Autostart, false);
    assert.equal(row.State.Autostart, false);
});

test('lightweight and full Docker rows report the same autostart state', () => {
    assert.equal(api.rowAutostart({ autostart: true }), true);
    assert.equal(api.rowAutostart({ autostart: false }), false);
    assert.equal(api.rowAutostart({ info: { State: { Autostart: true } } }), true);
    assert.equal(api.rowAutostart({ State: { Autostart: false } }), false);
    const summary = view.buildHeaderSummaryHtml({ alpha: { autostart: true }, beta: { autostart: false } });
    assert.match(summary, /<strong>1<\/strong><small>Autostart containers<\/small>/);
});

test('autostart toggle preserves peer lightweight states and updates the local row', async () => {
    const info = { alpha: { id: 'alpha-id', autostart: true }, beta: { id: 'beta-id', autostart: false } };
    let mutation = null;
    const controller = moduleApi.createApi({
        getInfo: () => info, getPlan: () => ({}), writeAutostart: async (name, enabled) => { mutation = { name, enabled }; },
        refreshPreview: async () => {}, setStatus: () => {}, showError: (message, error) => { throw error || new Error(message); }
    });
    await controller.toggleAutostart('beta', true);
    assert.deepEqual(mutation, { name: 'beta', enabled: true });
    assert.equal(info.alpha.autostart, true);
    assert.equal(info.beta.autostart, true);
});

test('preview activation hydrates once per visit and permits a fresh load after re-entry', () => {
    let refreshCount = 0;
    const activation = moduleApi.createPreviewActivation(() => { refreshCount += 1; });
    assert.equal(activation.hydrate(), false);
    activation.setActive(true);
    assert.equal(activation.hydrate(), true);
    assert.equal(activation.hydrate(), false);
    assert.equal(refreshCount, 1);
    activation.setActive(false);
    activation.setActive(true);
    assert.equal(activation.hydrate(), true);
    assert.equal(refreshCount, 2);
});

test('unmanaged sequence previews are visibly read-only', () => {
    const html = view.buildPreviewHtml({
        managed: false,
        sequence: [{ name: 'alpha', wait: 19, waitSource: 'native' }],
        staleAutostart: ['removed-app']
    }, { disabledNames: ['beta'] });
    assert.match(html, /FolderView Plus will preview the native order but will not rewrite the Docker autostart file/);
    assert.match(html, /value="19" readonly/);
    assert.match(html, /aria-label="Autostart enabled for alpha" disabled/);
    assert.doesNotMatch(html, /will be removed|updateDockerStartOrderWait|toggleDockerStartOrderAutostart/);
});

test('unmanaged order blocks wait edits and native autostart mutations', async () => {
    const plan = { mode: 'unmanaged', containerWaits: { alpha: 73 } };
    const info = { alpha: { id: 'alpha-id', autostart: true }, beta: { id: 'beta-id', autostart: false } };
    const writes = [];
    const controller = moduleApi.createApi({
        getInfo: () => info, getPlan: () => plan,
        savePlan: async (patch) => writes.push(patch),
        writeAutostart: async (...payload) => writes.push(payload),
        refreshPreview: async () => {}, setStatus: () => {}, showError: (_message, error) => { throw error; }
    });
    await controller.updateWait('alpha', 23);
    await controller.toggleAutostart('beta', true);
    assert.deepEqual(writes, []);
    assert.equal(info.beta.autostart, false);
    assert.equal(plan.containerWaits.alpha, 73);

    plan.mode = 'docker-page';
    await controller.toggleAutostart('beta', true);
    assert.deepEqual(writes, [['beta', true]]);
    assert.equal(plan.containerWaits.alpha, 73);
    assert.equal(info.beta.autostart, true);
});

test('container wait edits submit only the intended entry, including a numeric name and explicit zero', async () => {
    const old = { mode: 'docker-page', containerWaits: { alpha: 12, '0': 17 } };
    const writes = [];
    const controller = moduleApi.createApi({
        getPlan: () => old, savePlan: async patch => writes.push(patch),
        showError: (_label, error) => { throw error; }
    });
    await controller.updateWait('0', 0);
    await controller.updateWait('alpha', 24);
    await controller.updateWait('', 9);
    assert.deepEqual(writes, [{ containerWaits: { '0': 0 } }, { containerWaits: { alpha: 24 } }]);
    assert.deepEqual(old.containerWaits, { alpha: 12, '0': 17 });
});

test('start-order view escapes names and rejects executable icon URLs', () => {
    const html = view.buildPreviewHtml({
        sequence: [{ name: '<img src=x onerror=alert(1)>', wait: 0 }]
    }, {
        infoByName: {
            '<img src=x onerror=alert(1)>': { Labels: { 'net.unraid.docker.icon': 'javascript:alert(1)' } }
        }
    });
    assert.doesNotMatch(html, /src="javascript:/);
    assert.doesNotMatch(html, /<img src=x onerror=alert\(1\)>/);
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.match(html, /dynamix\.docker\.manager\/images\/question\.png/);
});
