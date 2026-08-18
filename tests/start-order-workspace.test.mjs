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

test('autostart mutation entries preserve every current state and only send explicit waits', () => {
    const entries = api.buildAutostartMutationEntries({
        alpha: { id: 'sha-alpha', autostart: true },
        beta: { shortId: 'beta-id', autostart: false }
    }, { containerWaits: { alpha: 12 } }, 'beta', true);
    assert.deepEqual(entries, [
        { id: 'sha-alpha', autoStart: true, wait: 12 },
        { id: 'beta-id', autoStart: true }
    ]);
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
        getInfo: () => info, getPlan: () => ({}), runDockerMutation: async (payload) => { mutation = payload; },
        refreshPreview: async () => {}, setStatus: () => {}, showError: (message, error) => { throw error || new Error(message); }
    });
    await controller.toggleAutostart('beta', true);
    assert.deepEqual(mutation.entries, [{ id: 'alpha-id', autoStart: true }, { id: 'beta-id', autoStart: true }]);
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
    assert.match(view.buildPreviewHtml({ managed: false, sequence: [] }), /Unmanaged mode: this sequence is read-only/);
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
