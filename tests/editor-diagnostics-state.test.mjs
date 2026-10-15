import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const base = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/';
const ui = require('../' + base + 'folderviewplus.ui-state-diagnostics.js');
const telemetrySource = fs.readFileSync(base + 'folderviewplus.support-bundle-telemetry.js', 'utf8');
test('a missing or stale editor schema cannot break other diagnostic collectors', () => {
    for (const editorDiagnosticsModel of [undefined, {}]) {
        const window = { FolderViewPlusFoundationModules: { editorDiagnosticsModel } };
        vm.runInNewContext(fs.readFileSync(base + 'folderviewplus.ui-state-diagnostics.js', 'utf8'), { globalThis: window });
        const api = window.FolderViewPlusUiStateDiagnostics;
        assert.doesNotThrow(() => api.record('editor', 'docker', { phase: 'applied' }));
        api.record('settings', 'docker', { totalFolders: 3 });
        assert.equal(api.collect().channels.settings.docker.latest.data.totalFolders, 3);
        assert.equal(api.collect().channels.editor.docker.available, false);
    }
});
const host = () => {
    let time = Date.parse('2026-10-15T12:00:00Z');
    const storage = new Map();
    const window = { FolderViewPlusFolderEditorPageBuildVersion: '2026.10.15.01', localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) } };
    return { window, storage, now: () => time, advance: ms => { time += ms; }, api: ui.createApi({ window, now: () => time }) };
};

test('editor records allowlist fields, clamp measurements and retain eight recent states per type', () => {
    const h = host();
    for (let i = 0; i < 12; i++) {
        h.advance(1);
        h.api.record('editor', 'docker', { phase: i === 11 ? 'cancelled' : 'applied', source: 'uploads', applyCount: i,
            cancelRestored: true, uploadPending: false, cardCount: Infinity, viewportWidthPx: -1, theme: 'light', section: 'preview',
            fileName: 'PrivateIcon.png', url: 'http://192.168.1.1/private', search: 'secret-query',
            picker: { available: true, widthPx: 300, horizontalOverflowPx: 12, innerHTML: 'private-name' } });
    }
    const result = h.api.collect();
    assert.equal(result.editorHistoryLimit, 8);
    assert.equal(result.channels.editor.docker.snapshots.length, 8);
    assert.equal(result.channels.editor.vm.available, false);
    assert.equal(result.channels.editor.docker.latest.pluginVersion, '2026.10.15.01');
    const data = result.channels.editor.docker.latest.data;
    assert.deepEqual([data.phase, data.source, data.applyCount, data.cancelRestored, data.picker.horizontalOverflowPx], ['cancelled', 'uploads', 11, true, 12]);
    assert.equal(data.cardCount, 0); assert.equal(data.viewportWidthPx, 0);
    assert.doesNotMatch(JSON.stringify(result), /PrivateIcon|192\.168|private-name|secret-query|innerHTML/);
    assert.ok(h.storage.get(ui.STORAGE_KEY).length < 50000);
});

test('editor records survive Settings navigation, remain sanitized on export, expire and report version mismatch', () => {
    const h = host();
    h.api.record('editor', 'vm', { phase: 'cancelled', source: 'collections', cancelRestorationAttempted: true, cancelRestored: true, rollbackAvailable: false });
    const settings = { FolderViewPlusFatalRuntimeContext: { pluginVersion: '2026.10.15.01' }, localStorage: h.window.localStorage };
    settings.FolderViewPlusUiStateDiagnostics = ui.createApi({ window: settings, now: h.now });
    const context = { globalThis: settings, module: { exports: {} }, URL, console };
    vm.runInNewContext(telemetrySource, context);
    const exporter = context.module.exports.createApi({ normalizeSupportBundleV2Payload: value => ({ ...value }) });
    for (const privacyMode of ['sanitized', 'full']) {
        const bundle = exporter.collectSupportBundleUiTelemetry({ bundleMeta: { privacyMode }, uiTelemetry: {}, healthAndHistory: {}, redactionManifest: {} });
        assert.equal(bundle.uiTelemetry.uiState.channels.editor.vm.latest.data.cancelRestored, true);
        assert.equal(bundle.uiTelemetry.uiState.channels.editor.vm.versionMismatch, false);
    }
    settings.FolderViewPlusFatalRuntimeContext.pluginVersion = '2026.10.15.02';
    assert.equal(settings.FolderViewPlusUiStateDiagnostics.collect().channels.editor.vm.versionMismatch, true);
    h.advance(ui.STALE_AFTER_MS + 1);
    assert.equal(settings.FolderViewPlusUiStateDiagnostics.collect().channels.editor.vm.available, false);
});

test('stored editor diagnostics are revalidated and blocked storage retains a fresh memory fallback', () => {
    const h = host();
    h.api.record('editor', 'docker', { phase: 'staged', applyCount: 1 });
    const raw = JSON.parse(h.storage.get(ui.STORAGE_KEY));
    Object.assign(raw['editor.docker'][0].data, { phase: 'private-phase', source: 'private-pack', theme: 'private-theme', section: 'private-folder', picker: { widthPx: 10, path: '/private/path' }, icon: 'private-icon' });
    h.storage.set(ui.STORAGE_KEY, JSON.stringify(raw));
    assert.doesNotMatch(JSON.stringify(h.api.collect()), /private/);
    h.window.localStorage.setItem = () => { throw new Error('quota'); };
    h.api.record('editor', 'docker', { phase: 'cancelled', cancelRestored: true });
    assert.equal(h.api.collect().channels.editor.docker.latest.data.phase, 'cancelled');
    assert.equal(h.api.collect().channels.editor.docker.latest.data.cancelRestored, true);
});
