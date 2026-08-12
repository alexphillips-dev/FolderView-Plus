import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const model = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.start-order-model.js');

test('start-order model normalizes unmanaged plans and bounded waits', () => {
    assert.deepEqual(model.normalizePlan({
        mode: 'unmanaged',
        remaining: 'invalid',
        containerWaits: { alpha: 12.6, beta: 9999, '': 10 }
    }), {
        mode: 'unmanaged',
        remaining: 'after',
        batches: [],
        containerWaits: { alpha: 13, beta: 3600 }
    });
});

test('start-order model normalizes batches without mutating the source', () => {
    const source = { mode: 'custom-batches', batches: [{ name: ' Core ', items: [{ name: ' app ' }] }] };
    const normalized = model.normalizePlan(source);
    assert.equal(normalized.batches[0].name, 'Core');
    assert.deepEqual(normalized.batches[0].items, [{ type: 'container', name: 'app' }]);
    assert.equal(source.batches[0].name, ' Core ');
});

test('start-order model applies patches through normalization', () => {
    const result = model.patchPlan({ mode: 'docker-page' }, { mode: 'unmanaged', containerWaits: { app: -1 } });
    assert.equal(result.mode, 'unmanaged');
    assert.equal(result.containerWaits.app, 0);
});
