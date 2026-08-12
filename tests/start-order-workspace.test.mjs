import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const moduleApi = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.start-order-workspace.js');
const api = moduleApi.createApi();

test('start-order sequence preview exposes waits, sources, batches, and safe encoded actions', () => {
    const html = api.buildPreviewHtml({
        managed: true,
        autostartCount: 1,
        containerCount: 2,
        sequence: [{ name: "alpha'box", wait: 15, waitSource: 'container', batchId: 'core' }],
        batches: [{ name: 'Core', delay: 10, containers: ["alpha'box"] }]
    }, { disabledNames: ['beta'] });
    assert.match(html, /Preview autostart sequence/);
    assert.match(html, /value="15"/);
    assert.match(html, />explicit</);
    assert.match(html, /alpha%27box/);
    assert.doesNotMatch(html, /decodeURIComponent/);
    assert.match(html, /Autostart disabled \(1\)/);
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
    assert.match(api.buildPreviewHtml({ managed: false, sequence: [] }), /Unmanaged mode: this sequence is read-only/);
});
