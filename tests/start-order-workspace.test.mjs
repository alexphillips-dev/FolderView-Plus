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
    assert.match(html, /src="\/icons\/alpha\.png"/);
    assert.match(html, /class="fv-start-order-switch"/);
});

test('autostart mutation entries preserve every current state and only send explicit waits', () => {
    const entries = api.buildAutostartMutationEntries({
        alpha: { Id: 'sha-alpha', info: { State: { Autostart: true } } },
        beta: { shortId: 'beta-id', info: { State: { Autostart: false } } }
    }, { containerWaits: { alpha: 12 } }, 'beta', true);
    assert.deepEqual(entries, [
        { id: 'sha-alpha', autoStart: true, wait: 12 },
        { id: 'beta-id', autoStart: true }
    ]);
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
