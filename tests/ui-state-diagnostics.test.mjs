import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const rootPath = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/';
const diagnostics = require('../' + rootPath + 'folderviewplus.ui-state-diagnostics.js');
const createHost = () => {
    let timestamp = Date.parse('2026-10-05T12:00:00Z');
    const storage = new Map();
    const window = { navigator: { userAgent: 'Firefox/158.0 private-host-name' }, FolderViewPlusFatalRuntimeContext: { pluginVersion: '2026.10.05.01' },
        localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) } };
    return { window, storage, advance: ms => { timestamp += ms; }, api: diagnostics.createApi({ window, now: () => timestamp }) };
};

test('browser identification reports only a normalized family and numeric reported version', () => {
    for (const [userAgent, family, reportedVersion] of [
        ['Firefox/158.0 secret.local', 'firefox', '158.0'], ['Chrome/140.0.1.2 Edg/140.0.1.3', 'edge', '140.0.1.3'],
        ['Chrome/140.0 Chromium/140.0.2', 'chromium', '140.0.2'], ['CriOS/140.0.1', 'chrome', '140.0.1'],
        ['Version/26.0 Mobile/example Safari/605.1.15', 'safari', '26.0'], ['private-browser-name', 'unknown', null]
    ]) assert.deepEqual(diagnostics.browserInfo({ userAgent }), { family, reportedVersion });
});

test('UI records allowlist aggregate values even when persistent storage is forged', () => {
    const host = createHost();
    host.storage.set(diagnostics.STORAGE_KEY, JSON.stringify({
        'settings.docker': [{ capturedAt: '2026-10-05T12:00:00Z', pluginVersion: 'private-version', secret: 'private-name',
            data: { phase: 'private-phase', totalFolders: -3, displayedFolders: 2, searchActive: true, query: 'private-query', names: ['private-name'], surface: { mode: 'private-mode', workspace: 'private-workspace', geometry: { fontSizePx: 14, text: 'private-text' } } } }],
        'compare.vm': [{ capturedAt: '2026-10-05T12:00:00Z', data: { phase: 'complete', fromKind: 'private-snapshot.json', added: Infinity,
            dialog: { geometry: { widthPx: 320, text: 'private-dialog' }, buttons: Array(30).fill({ widthPx: 100, label: 'private-button' }) } } }],
        'private.channel': [{ data: { secret: 'private-value' } }]
    }));
    const result = host.api.collect();
    assert.doesNotMatch(JSON.stringify(result), /private-/);
    assert.equal(result.channels.settings.docker.latest.data.totalFolders, 0);
    assert.equal(result.channels.settings.docker.latest.data.displayedFolders, 2);
    assert.equal(result.channels.compare.vm.latest.data.dialog.buttons.length, 6);
    assert.equal(result.channels.compare.vm.latest.data.fromKind, 'none');
});

test('recent UI history is bounded, deduplicated, version marked, and expires', () => {
    const host = createHost();
    for (let index = 0; index < 9; index++) { host.api.record('settings', 'docker', { displayedFolders: index }); host.advance(10); }
    host.api.record('settings', 'docker', { displayedFolders: 8 });
    assert.equal(host.api.collect().channels.settings.docker.snapshots.length, diagnostics.HISTORY_LIMIT);
    host.window.FolderViewPlusFatalRuntimeContext.pluginVersion = '2026.10.05.02';
    assert.equal(host.api.collect().channels.settings.docker.versionMismatch, true);
    host.advance(diagnostics.STALE_AFTER_MS + 1);
    assert.equal(host.api.collect().channels.settings.docker.available, false);
});

test('comparison cancellation and late responses preserve a newer operation and result', () => {
    const host = createHost();
    const oldToken = host.api.begin('compare', 'docker', { phase: 'loading', fromKind: 'snapshot', toKind: 'current' });
    host.advance(50); host.api.cancel('compare', 'docker');
    assert.equal(host.api.finish('compare', 'docker', oldToken, { phase: 'complete', added: 90 }), false);
    assert.equal(host.api.collect().channels.compare.docker.latest.data.phase, 'cancelled');
    const token = host.api.begin('compare', 'docker', { phase: 'loading', includePrefs: true });
    host.advance(75); host.api.finish('compare', 'docker', token, { phase: 'complete', added: 2 });
    host.api.finish('compare', 'docker', oldToken, { phase: 'error' });
    const result = host.api.collect().channels.compare.docker.latest.data;
    assert.equal(result.phase, 'complete'); assert.equal(result.added, 2); assert.equal(result.durationMs, 75);
    assert.equal(result.discardedResponses, 1);
    host.api.cancel('compare', 'docker');
    assert.equal(host.api.collect().channels.compare.docker.latest.data.phase, 'complete');
    const replaced = host.api.begin('compare', 'vm', { phase: 'loading' });
    host.api.finish('compare', 'vm', replaced, { discarded: true });
    assert.equal(host.api.collect().channels.compare.vm.latest.data.phase, 'cancelled');
    assert.equal(host.api.collect().channels.compare.vm.latest.data.discardedResponses, 1);
});

test('comparison tracing records only target kinds and aggregate diff results', () => {
    const host = createHost();
    const trace = host.api.traceComparison('docker', false, true, true);
    host.advance(80); trace.complete({ create: 1, update: 2, delete: 3, unchanged: 4, name: 'private-folder' }, 9, 7, 2, 8, true);
    const result = host.api.collect().channels.compare.docker.latest.data;
    assert.deepEqual([result.fromKind, result.toKind, result.added, result.changed, result.removed, result.unchanged, result.prefsChanged, result.durationMs], ['snapshot', 'current', 1, 2, 3, 4, 2, 80]);
    assert.doesNotMatch(JSON.stringify(result), /private-folder/);
});

test('unavailable storage does not break operations and retains a bounded in-memory fallback', () => {
    const window = {};
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
    const api = diagnostics.createApi({ window });
    assert.doesNotThrow(() => api.record('bulk', 'vm', { phase: 'applying', selected: 4 }));
    assert.equal(api.collect().channels.bulk.vm.latest.data.selected, 4);
    assert.doesNotThrow(() => api.record('unknown', 'vm', { names: ['private-name'] }));
});

test('blocked writes cannot replace a fresh memory capture with older readable storage', () => {
    const host = createHost();
    host.api.record('bulk', 'docker', { selected: 1 });
    host.window.localStorage.setItem = () => { throw new Error('quota exceeded'); };
    host.api.record('bulk', 'docker', { selected: 4 });
    assert.equal(host.api.collect().channels.bulk.docker.latest.data.selected, 4);
});

test('geometry reports clipping and small fonts without collecting node contents', () => {
    const parent = { parentElement: null, getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100 }) };
    const node = { parentElement: parent, textContent: 'private-folder', scrollWidth: 180, clientWidth: 160,
        getBoundingClientRect: () => ({ left: 0, top: 0, right: 160, bottom: 80, width: 160, height: 80 }) };
    const result = diagnostics.measure(node, { innerWidth: 120, innerHeight: 100, getComputedStyle: node => node === parent
        ? { overflowX: 'hidden', overflowY: 'visible' } : { display: 'block', fontSize: '10px' } });
    assert.equal(result.clippedByAncestors, 1); assert.equal(result.fontSizePx, 10);
    assert.equal(result.horizontalOverflowPx, 20); assert.equal(result.outsideViewport, true); assert.equal(result.visible, true);
    assert.doesNotMatch(JSON.stringify(result), /private-folder/);
});

test('Dashboard geometry allowlists samples and movement reasons on export', () => {
    const result = diagnostics.normalizeDashboardGeometry({ observedTileCount: 9, truncated: false,
        folderHeaderHeights: { count: 4, minimumPx: 42, medianPx: 43, maximumPx: 44, name: 'private-name' },
        expansion: { available: true, reason: 'private-reason', movedHeaderCount: 2, maximumVerticalShiftPx: 50, ids: ['private-id'] } });
    assert.equal(result.folderHeaderHeights.medianPx, 43); assert.equal(result.expansion.movedHeaderCount, 2);
    assert.equal(result.expansion.reason, 'not-observed'); assert.doesNotMatch(JSON.stringify(result), /private-/);
});

test('support-bundle telemetry exports the safe UI snapshot in sanitized and full modes', () => {
    const host = createHost();
    host.api.record('bulk', 'docker', { selected: 3, hiddenSelected: 1, targetFolderName: 'private-folder' });
    host.window.FolderViewPlusUiStateDiagnostics = host.api;
    const context = { globalThis: host.window, module: { exports: {} }, URL, console };
    vm.runInNewContext(fs.readFileSync(rootPath + 'folderviewplus.support-bundle-telemetry.js', 'utf8'), context);
    const api = context.module.exports.createApi({ normalizeSupportBundleV2Payload: bundle => ({ ...bundle }) });
    for (const privacyMode of ['sanitized', 'full']) {
        const bundle = api.collectSupportBundleUiTelemetry({ bundleMeta: { privacyMode }, uiTelemetry: {}, healthAndHistory: {}, redactionManifest: {} });
        assert.equal(bundle.uiTelemetry.uiState.channels.bulk.docker.latest.data.selected, 3);
        assert.equal(bundle.uiTelemetry.uiState.browser.family, 'firefox');
        assert.doesNotMatch(JSON.stringify(bundle.uiTelemetry.uiState), /private-/);
    }
});

test('Dashboard geometry is re-allowlisted in the browser bundle collector', () => {
    const host = createHost(); host.window.FolderViewPlusUiStateDiagnostics = host.api;
    const context = { globalThis: host.window, module: { exports: {} }, URL, console };
    vm.runInNewContext(fs.readFileSync(rootPath + 'folderviewplus.support-bundle-browser.js', 'utf8'), context);
    const snapshot = { capturedAt: '2026-10-05T12:00:00Z', geometry: { observedTileCount: 2, names: ['private-folder'], expansion: { reason: 'measured', movedHeaderCount: 1, path: '/private-path' } } };
    const collector = context.module.exports.createCollectors({ storageKeys: { dashboardVisualDocker: 'docker' }, readClientDiagnosticsStorageRecord: key => key === 'docker' ? { latest: snapshot, snapshots: [snapshot] } : null });
    const result = collector.collectDashboardVisualDiagnostics(null);
    assert.equal(result.docker.latest.geometry.expansion.movedHeaderCount, 1);
    assert.doesNotMatch(JSON.stringify(result), /private-/);
});
