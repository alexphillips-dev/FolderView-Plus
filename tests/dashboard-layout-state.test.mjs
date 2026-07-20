import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const modulePath = path.resolve(
    process.cwd(),
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.prefs-store.js'
);
const api = require(modulePath);

const createStorage = () => {
    const records = new Map();
    return {
        getItem: (key) => records.get(key) ?? null,
        setItem: (key, value) => records.set(key, String(value)),
        removeItem: (key) => records.delete(key)
    };
};

test('dashboard layout diagnostics wait for a committed preference and nonzero rendered width', () => {
    const store = api.createDashboardLayoutStateStore({
        storage: createStorage(),
        now: () => Date.parse('2026-07-20T20:00:00.000Z')
    });

    store.recordMeasurement('docker', {
        measuredLayout: 'compactmatrix',
        widgetWidthPx: 0,
        renderComplete: false,
        folderCount: 12,
        folderColumns: 3,
        memberColumns: 2
    });
    assert.equal(store.read('docker').measurementStatus, 'unmeasured');
    assert.equal(store.read('docker').measuredLayout, null);

    store.recordTransition('docker', {
        committedLayout: 'compactmatrix',
        previousLayout: 'classic',
        requestedLayout: 'compactmatrix',
        source: 'settings',
        preferenceRevision: 8,
        outcome: 'committed'
    });
    store.recordMeasurement('docker', {
        measuredLayout: 'compactmatrix',
        widgetWidthPx: 0,
        renderComplete: true,
        folderCount: 12,
        folderColumns: 3,
        memberColumns: 2
    });
    assert.equal(store.read('docker').measurementStatus, 'unmeasured');

    store.recordMeasurement('docker', {
        measuredLayout: 'compactmatrix',
        widgetWidthPx: 1180,
        renderComplete: true,
        folderCount: 12,
        folderColumns: 3,
        folderRows: 4,
        memberColumns: 2
    });
    const measured = store.read('docker');
    assert.equal(measured.measurementStatus, 'measured');
    assert.equal(measured.currentPreference, 'compactmatrix');
    assert.equal(measured.measuredLayout, 'compactmatrix');
    assert.equal(measured.widgetWidthPx, 1180);
});

test('classic hydration marks compact telemetry stale without erasing the last valid measurement', () => {
    const store = api.createDashboardLayoutStateStore({ storage: createStorage() });
    store.recordTransition('docker', {
        committedLayout: 'compactmatrix',
        source: 'settings',
        preferenceRevision: 10,
        outcome: 'committed'
    });
    store.recordMeasurement('docker', {
        measuredLayout: 'compactmatrix',
        widgetWidthPx: 960,
        renderComplete: true,
        folderCount: 9,
        folderColumns: 2,
        memberColumns: 2
    });
    store.recordTransition('docker', {
        committedLayout: 'classic',
        previousLayout: 'compactmatrix',
        source: 'hydration',
        preferenceRevision: 11,
        outcome: 'hydrated'
    });
    store.recordMeasurement('docker', {
        measuredLayout: 'classic',
        widgetWidthPx: 0,
        renderComplete: true,
        folderCount: 0,
        folderColumns: 1,
        memberColumns: 1
    });

    const record = store.read('docker');
    assert.equal(record.currentPreference, 'classic');
    assert.equal(record.measurementStatus, 'stale');
    assert.equal(record.measuredLayout, 'compactmatrix');
    assert.equal(record.widgetWidthPx, 960);
    assert.equal(record.folderColumns, 2);
});

test('resize updates measured geometry without changing the committed preference', () => {
    const store = api.createDashboardLayoutStateStore({ storage: createStorage() });
    store.recordTransition('docker', {
        committedLayout: 'compactmatrix',
        source: 'dashboard-quick-switch',
        preferenceRevision: 21,
        outcome: 'committed'
    });
    store.recordMeasurement('docker', {
        measuredLayout: 'compactmatrix',
        widgetWidthPx: 1200,
        renderComplete: true,
        folderCount: 15,
        folderColumns: 3,
        memberColumns: 2
    });
    store.recordMeasurement('docker', {
        measuredLayout: 'compactmatrix',
        widgetWidthPx: 720,
        renderComplete: true,
        folderCount: 15,
        folderColumns: 1,
        memberColumns: 1
    });

    const record = store.read('docker');
    assert.equal(record.currentPreference, 'compactmatrix');
    assert.equal(record.preferenceRevision, 21);
    assert.equal(record.widgetWidthPx, 720);
    assert.equal(record.folderColumns, 1);
});

test('older hydration cannot replace a newer committed layout and transition trace stays bounded', () => {
    const store = api.createDashboardLayoutStateStore({ storage: createStorage(), transitionLimit: 4 });
    store.recordTransition('docker', {
        committedLayout: 'compactmatrix',
        source: 'settings',
        preferenceRevision: 30,
        outcome: 'committed'
    });
    store.recordTransition('docker', {
        committedLayout: 'classic',
        source: 'hydration',
        preferenceRevision: 29,
        outcome: 'hydrated'
    });
    for (let index = 0; index < 7; index += 1) {
        store.recordTransition('docker', {
            requestedLayout: 'compactmatrix',
            previousLayout: 'compactmatrix',
            source: 'settings',
            preferenceRevision: 30,
            outcome: 'requested'
        });
    }

    const record = store.read('docker');
    assert.equal(record.currentPreference, 'compactmatrix');
    assert.equal(record.preferenceRevision, 30);
    assert.equal(record.transitions.length, 4);
});

test('compact matrix remains authoritative across settings and dashboard hydration cycles', () => {
    const store = api.createDashboardLayoutStateStore({ storage: createStorage() });
    store.recordTransition('docker', {
        requestedLayout: 'compactmatrix',
        previousLayout: 'classic',
        committedLayout: 'compactmatrix',
        source: 'settings',
        preferenceRevision: 42,
        outcome: 'committed'
    });
    store.recordTransition('docker', {
        previousLayout: 'compactmatrix',
        committedLayout: 'compactmatrix',
        source: 'hydration',
        preferenceRevision: 42,
        outcome: 'reconciled'
    });
    store.recordTransition('docker', {
        previousLayout: 'compactmatrix',
        committedLayout: 'compactmatrix',
        source: 'hydration',
        preferenceRevision: 42,
        outcome: 'reconciled'
    });

    const record = store.read('docker');
    assert.equal(record.currentPreference, 'compactmatrix');
    assert.equal(record.preferenceRevision, 42);
    assert.deepEqual(record.transitions.map((entry) => entry.source), ['settings', 'hydration', 'hydration']);
});

test('broad preference writes cannot restore a stale dashboard layout', () => {
    const broad = api.protectDashboardLayoutFromBroadPrefsWrite({
        sortMode: 'manual',
        dashboard: { layout: 'classic', greyscale: true }
    });
    assert.deepEqual(broad, {
        sortMode: 'manual',
        dashboard: { greyscale: true }
    });

    const explicitLayoutPatch = api.protectDashboardLayoutFromBroadPrefsWrite({
        dashboard: { layout: 'compactmatrix' }
    });
    assert.deepEqual(explicitLayoutPatch, {
        dashboard: { layout: 'compactmatrix' }
    });
});
