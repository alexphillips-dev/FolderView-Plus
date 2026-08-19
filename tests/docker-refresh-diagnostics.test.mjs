import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const diagnostics = require(path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.refresh-diagnostics.js'
));

const createHarness = () => {
    let clock = Date.parse('2026-08-19T12:00:00.000Z');
    const records = new Map();
    const listeners = new Map();
    const storage = {
        getItem: (key) => records.get(key) || null,
        setItem: (key, value) => records.set(key, String(value))
    };
    const window = {
        localStorage: storage,
        addEventListener: (type, handler) => listeners.set(type, handler),
        removeEventListener: (type, handler) => {
            if (listeners.get(type) === handler) listeners.delete(type);
        }
    };
    return {
        storage,
        window,
        now: () => clock,
        advance: (ms) => { clock += ms; },
        pagehide: () => listeners.get('pagehide')?.(),
        persisted: () => JSON.parse(records.get(diagnostics.STORAGE_KEY) || '{}')
    };
};

test('refresh diagnostics classifies recurring full reloads without persisting runtime identities', () => {
    const harness = createHarness();
    const tracker = diagnostics.createTracker({ window: harness.window, storage: harness.storage, now: harness.now });

    tracker.record('loadlist');
    tracker.record('listview');
    tracker.record('buildDockerFolderReq');
    tracker.recordPageSnapshot({
        reason: 'runtime-sync',
        correlation: { renderGeneration: 1 },
        folderRows: { count: 12 },
        privateContainerName: 'vaultwarden'
    });
    tracker.recordPageSnapshot({
        reason: 'render-complete',
        correlation: { renderGeneration: 1 },
        folderRows: { count: 99 }
    });
    for (let index = 0; index < 5; index += 1) {
        harness.advance(10000);
        tracker.record('loadlist');
    }
    tracker.recordApiMismatch({ providerOnlyCount: 2, runtimeOnlyCount: 1, privateName: 'radarr' });

    const snapshot = tracker.snapshot();
    assert.equal(snapshot.verdict.status, 'confirmed');
    assert.equal(snapshot.verdict.reference, 'FVPLUS-DKR-REFRESH-001');
    assert.equal(snapshot.currentSession.counts.loadlist, 6);
    assert.equal(snapshot.currentSession.counts.renders, 1);
    assert.equal(snapshot.currentSession.lastFolderCount, 12);
    assert.equal(snapshot.currentSession.counts.requests, 1);
    assert.equal(snapshot.currentSession.reloadSources['initial-bootstrap'], 1);
    assert.equal(snapshot.currentSession.reloadSources['unknown-host-caller'], 5);
    assert.equal(snapshot.apiMismatch.observedCount, 1);
    assert.equal(snapshot.apiMismatch.providerOnlyCount, 2);
    assert.equal(snapshot.apiMismatch.runtimeOnlyCount, 1);
    assert.equal(snapshot.apiMismatch.policy, 'native-structure-authoritative');
    assert.equal(snapshot.apiMismatch.hostReloadRequested, false);
    assert.doesNotMatch(JSON.stringify(snapshot), /vaultwarden|radarr/);

    harness.pagehide();
    const persisted = harness.persisted();
    assert.equal(persisted.currentSession, null);
    assert.equal(persisted.completedSessionCount, 1);
    assert.equal(persisted.completedSessions[0].exitReason, 'pagehide');
});

test('refresh diagnostics records explicit reload sources and native busy recovery', () => {
    const harness = createHarness();
    const tracker = diagnostics.createTracker({ window: harness.window, storage: harness.storage, now: harness.now });

    tracker.record('loadlist');
    harness.advance(5000);
    tracker.markReloadSource('plugin-config-revision');
    tracker.record('loadlist');
    harness.advance(5000);
    tracker.record('loadlist', { nativeBusyActive: true });
    tracker.record('listview', { nativeBusyActive: true });
    harness.advance(5000);
    tracker.record('loadlist');
    tracker.recordPageSnapshot({ reason: 'render-complete', correlation: { renderGeneration: 2 }, folderRows: { count: 7 } });

    const snapshot = tracker.snapshot();
    assert.equal(snapshot.reloadSources['plugin-config-revision'], 1);
    assert.equal(snapshot.reloadSources['unraid-native-busy-poll'], 1);
    assert.equal(snapshot.nativeBusy.cycleCount, 1);
    assert.equal(snapshot.nativeBusy.passCount, 1);
    assert.equal(snapshot.nativeBusy.cleared, true);
    assert.equal(snapshot.nativeBusy.foldersRestored, true);
    assert.equal(snapshot.currentSession.counts.foldersRestored, 1);
    assert.equal(snapshot.currentSession.lastFolderCount, 7);
});

test('refresh-loop thresholds exclude reloads attributed to direct user actions', () => {
    const start = Date.parse('2026-08-19T12:00:00.000Z');
    const manualEvents = Array.from({ length: 8 }, (_, index) => ({ atMs: start + (index * 5000), source: 'manual-host-refresh' }));
    const suspectedEvents = Array.from({ length: 3 }, (_, index) => ({ atMs: start + (index * 10000), source: 'unknown-host-caller' }));

    assert.equal(diagnostics.buildVerdict(manualEvents, start + 40000).status, 'healthy');
    assert.equal(diagnostics.buildVerdict(suspectedEvents, start + 30000).status, 'suspected');
});
