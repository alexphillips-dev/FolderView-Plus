import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createApi } = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.folderview3-migration.js');
const source = name => ({ name, text: '{"fv3_export_version":1}' });
const report = name => ({ source: { sourceName: name, digest: 'a'.repeat(64) }, summary: {}, operations: [], warnings: [] });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

test('M38: a stale failed preview cannot erase or report errors over a newer reviewed plan', async () => {
    const old = deferred(), recent = deferred(), errors = [];
    const api = createApi({ document: null, apiPostJson: (_url, data) => data.fileName === 'old' ? old.promise : recent.promise,
        showError: (...args) => errors.push(args) });
    const pendingOld = api.previewSelection(source('old')), pendingRecent = api.previewSelection(source('recent'));
    recent.resolve({ report: report('recent') }); await pendingRecent;
    old.reject(new Error('Old request failed')); assert.equal(await pendingOld, null);
    assert.equal(api.getReport().source.sourceName, 'recent'); assert.equal(errors.length, 0);
    api.disconnect();
});

test('M27/M38: apply blocks competing detection and duplicate applies and refresh follows verified persistence', async () => {
    const commit = deferred(); let getCalls = 0, applyCalls = 0, refreshed = 0;
    const api = createApi({ document: null, window: { confirm: () => true }, apiGetJson: async () => { getCalls++; return {}; },
        apiPostJson: async (_url, data) => { if (data.action === 'preview_folderview3') return { report: report('current') }; applyCalls++; return commit.promise; },
        afterApply: async () => { refreshed++; } });
    await api.previewSelection(source('current'));
    const applying = api.applyMigration();
    assert.equal(await api.detectInstalled(), null); assert.equal(await api.applyMigration(), null); assert.equal(getCalls, 0);
    assert.equal(refreshed, 0); commit.resolve({ migration: { transaction: { verified: true }, report: report('current') } });
    await applying; assert.equal(applyCalls, 1); assert.equal(refreshed, 1); assert.equal(api.getMigrationResult().transaction.verified, true);
    api.disconnect();
});

test('M06/M20/M27: invalid JSON or regex clears an older plan and reports a visible owned error', async () => {
    const errors = [];
    const api = createApi({ document: null, apiPostJson: async () => ({ report: report('valid') }), showError: (_title, error) => errors.push(error.message) });
    for (const text of ['{', 'null', '{"fv3_export_version":1,"docker":{"x":{"regex":"["}}}']) {
        await api.previewSelection(source('valid'));
        await assert.rejects(api.previewSelection({ name: 'invalid', text }));
        assert.equal(api.getReport(), null); assert.equal(api.getSelectedSource(), null);
    }
    assert.equal(errors.length, 3); assert.match(errors[0], /not valid JSON/); assert.match(errors[2], /regex is invalid/);
    api.disconnect();
});

test('M38: disconnected apply finishes persistence without refreshing or announcing in a replacement controller', async () => {
    const commit = deferred(); let refreshed = 0;
    const api = createApi({ document: null, window: { confirm: () => true },
        apiPostJson: async (_url, data) => data.action === 'preview_folderview3' ? { report: report('valid') } : commit.promise,
        afterApply: async () => { refreshed++; } });
    await api.previewSelection(source('valid')); const applying = api.applyMigration(); api.disconnect();
    commit.resolve({ migration: { transaction: { verified: true }, report: report('valid') } });
    assert.equal((await applying).transaction.verified, true); assert.equal(api.getMigrationResult(), null); assert.equal(refreshed, 0);
});
