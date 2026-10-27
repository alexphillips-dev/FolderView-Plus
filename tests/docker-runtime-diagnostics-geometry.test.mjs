import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const diagnostics = require(path.resolve(
    process.cwd(),
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.diagnostics.js'
));
const layoutGeometry = require(path.resolve(
    process.cwd(),
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.layout-diagnostics.js'
));
const layoutDiagnostics = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.layout-diagnostics.js');

const createClassList = (...tokens) => {
    const values = new Set(tokens);
    return {
        contains: (token) => values.has(token)
    };
};

test('order diagnostics build stable privacy-safe fingerprints', () => {
    assert.equal(diagnostics.buildOrderFingerprint(['folder-a', 'container-b']), 'bf4644c023531be6');
    assert.equal(diagnostics.buildOrderFingerprint(['folder-a', 'container-b']), diagnostics.buildOrderFingerprint(['folder-a', 'container-b']));
    assert.notEqual(diagnostics.buildOrderFingerprint(['folder-a']), diagnostics.buildOrderFingerprint(['folder-b']));
    assert.match(diagnostics.buildOrderFingerprint([]), /^[0-9a-f]{16}$/);
});

const createFixture = () => {
    const ownerRect = { left: 100, top: 40 };
    const consoleRect = { left: 120, top: 50 };
    const logsRect = { left: 140, top: 50 };
    const owner = {
        getBoundingClientRect: () => ({ ...ownerRect })
    };
    const createAction = (rect, token) => ({
        isConnected: true,
        parentElement: owner,
        classList: createClassList(token, 'fv-preview-action-slot', 'is-ready'),
        getBoundingClientRect: () => ({ ...rect })
    });
    const consoleAction = createAction(consoleRect, 'folder-element-console');
    const logsAction = createAction(logsRect, 'folder-element-logs');
    const webuiReady = {
        classList: createClassList('folder-element-webui', 'fv-preview-action-slot', 'is-ready')
    };
    const webuiUnavailable = {
        classList: createClassList('folder-element-webui', 'fv-preview-action-slot', 'is-unavailable')
    };
    const actionNodes = [consoleAction, logsAction];
    const slotNodes = [...actionNodes, webuiReady, webuiUnavailable];
    const document = {
        querySelectorAll: (selector) => (
            selector === '.folder-preview .fv-preview-action-slot' ? slotNodes : actionNodes
        )
    };
    const window = {
        document,
        performance: { now: () => 100 }
    };
    return {
        ownerRect,
        consoleRect,
        logsRect,
        consoleAction,
        document,
        window
    };
};

test('layout diagnostics separate whole-row motion from relative action movement', () => {
    const fixture = createFixture();
    const tracker = diagnostics.createLayoutStabilityTracker({
        window: fixture.window,
        document: fixture.document,
        cacheSchemaVersion: 2,
        algorithmVersion: 'test'
    });
    const before = tracker.captureActionGeometry();

    fixture.ownerRect.left += 20;
    fixture.consoleRect.left += 20;
    fixture.logsRect.left += 20;
    tracker.compareActionGeometry(before);

    const snapshot = tracker.getSnapshot();
    assert.equal(snapshot.schemaVersion, 2);
    assert.equal(snapshot.previewActions.shiftedTargetCount, 2);
    assert.equal(snapshot.previewActions.shiftedXTargetCount, 2);
    assert.equal(snapshot.previewActions.shiftedYTargetCount, 0);
    assert.equal(snapshot.previewActions.relativeShiftedTargetCount, 0);
    assert.equal(snapshot.previewActions.maximumShiftPx, 20);
    assert.equal(snapshot.previewActions.maximumRelativeShiftPx, 0);
    assert.equal(snapshot.previewActions.maximumRowShiftPx, 20);
    assert.equal(snapshot.previewActions.readyWebuiSlotCount, 1);
    assert.equal(snapshot.previewActions.unavailableWebuiSlotCount, 1);
    tracker.destroy();
});

test('layout geometry returns null for non-rendered nodes and incomplete comparisons', () => {
    assert.equal(layoutGeometry.readNodeGeometry({}), null);
    assert.equal(layoutGeometry.compareGeometry(null, {}), null);
    assert.equal(layoutGeometry.compareGeometry({}, null), null);
});

test('layout diagnostics report within-row action movement and disconnected targets', () => {
    const fixture = createFixture();
    const tracker = diagnostics.createLayoutStabilityTracker({
        window: fixture.window,
        document: fixture.document
    });
    const before = tracker.captureActionGeometry();

    fixture.consoleRect.left += 6;
    fixture.consoleAction.isConnected = false;
    fixture.logsRect.top += 4;
    tracker.compareActionGeometry(before);

    const snapshot = tracker.getSnapshot();
    assert.equal(snapshot.previewActions.hydratedTargetCount, 1);
    assert.equal(snapshot.previewActions.disconnectedTargetCount, 1);
    assert.equal(snapshot.previewActions.shiftedYTargetCount, 1);
    assert.equal(snapshot.previewActions.relativeShiftedTargetCount, 1);
    assert.equal(snapshot.previewActions.maximumRelativeShiftPx, 4);
    tracker.destroy();
});

const columnFixture = () => {
    let time = 0, nextTimer = 0;
    const timers = new Map(), listeners = new Map(), delays = [];
    const target = () => ({
        addEventListener(name, handler) { const key = [this, name, handler]; listeners.set(key, key); },
        removeEventListener(name, handler) { for (const [key, entry] of listeners) if (entry[0] === this && entry[1] === name && entry[2] === handler) listeners.delete(key); },
        emit(name) { for (const [owner, event, handler] of [...listeners.values()]) if (owner === this && event === name) handler(); }
    });
    const widths = [200, 100, 120];
    let left = 40;
    const headers = widths.map((_, index) => ({ getBoundingClientRect: () => ({
        left: left + widths.slice(0,index).reduce((sum, value) => sum + value, 0), width: widths[index] }) }));
    const table = { tHead: { rows: [{ cells: headers }], classList: createClassList('fixed') }, tBodies: [],
        getBoundingClientRect: () => ({ left, width: widths.reduce((sum, value) => sum + value, 0) }) };
    const document = Object.assign(target(), { hidden: false, querySelector: () => table, documentElement: { clientWidth: 1180 } });
    const window = Object.assign(target(), { innerWidth: 1200, scrollX: 0, performance: { now: () => time },
        setTimeout(callback, delay) { delays.push(delay); timers.set(++nextTimer, callback); return nextTimer; }, clearTimeout(id) { timers.delete(id); } });
    const snapshots = [];
    const tracker = layoutDiagnostics.createColumnMovementTracker({ window, document, getViewMode: () => 'basic',
        readEnvironment: () => ({ colors: true, detected: true }), onSnapshot: flush => snapshots.push(flush) });
    return { tracker, document, window, table, widths, timers, listeners, snapshots, delays,
        moveTable: delta => { left += delta; }, tick: () => { time += 1000; const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(callback => callback()); } };
};

test('column sampling distinguishes page motion, column resizing, reversal and nearby host refresh', () => {
    const f = columnFixture();
    assert.equal(f.delays[0], 5000, 'idle diagnostics must leave startup undisturbed');
    f.tick();
    assert.equal(f.delays.at(-1), 1000);
    f.moveTable(20); f.tick();
    assert.equal(f.tracker.getSnapshot().maximumTableShiftPx, 20);
    assert.equal(f.tracker.getSnapshot().maximumColumnShiftPx, 0);
    f.tracker.recordTrigger('host-loadlist');
    f.widths[0] += 12; f.tick();
    f.widths[0] -= 12; f.tick();
    const state = f.tracker.getSnapshot();
    assert.equal(state.maximumColumnShiftPx, 12);
    assert.equal(state.maximumWidthChangePx, 12);
    assert.equal(state.reversalCount, 1);
    assert.equal(state.events.at(-1).nearbyTrigger.kind, 'host-loadlist');
    assert.equal(state.latest.fixedListing, true);
    assert.equal(state.latest.scrollbarWidth, 20);
    assert.equal(state.latest.viewMode, 'basic');
    assert.equal(state.aurora.detected, true);
    f.tracker.destroy();
    assert.equal(f.timers.size, 0); assert.equal(f.listeners.size, 0);
});

test('column history is bounded and hidden or suspended pages retain captures without false movement', () => {
    const f = columnFixture(); f.tick();
    for (let index = 0; index < 50; index++) {
        f.tracker.recordTrigger('plugin-width', 'private-container-name');
        f.widths[0] += index % 2 ? 5 : -5; f.tick();
    }
    assert.equal(f.tracker.getSnapshot().events.length, 24);
    assert.equal(f.tracker.getSnapshot().triggers.length, 16);
    assert.equal(JSON.stringify(f.tracker.getSnapshot()).includes('private-container-name'), false);
    f.document.hidden = true; f.document.emit('visibilitychange');
    assert.equal(f.timers.size, 0); assert.equal(f.snapshots.at(-1), true);
    const count = f.tracker.getSnapshot().movementCount;
    f.widths[0] += 40; f.document.hidden = false; f.document.emit('visibilitychange'); f.tick();
    assert.equal(f.tracker.getSnapshot().movementCount, count);
    f.window.emit('pagehide'); assert.equal(f.timers.size, 0);
    f.window.emit('pageshow'); assert.equal(f.timers.size, 1);
    f.tracker.destroy(); f.tracker.destroy(); assert.equal(f.listeners.size, 0);
});

test('body columns moving under stationary headers are recorded as movement and alignment evidence', () => {
    const f = columnFixture();
    let offset = 0;
    f.table.tBodies = [{ rows: [{ getBoundingClientRect: () => ({ width: 420 }),
        cells: [0, 200, 300].map((left, index) => ({
            getBoundingClientRect: () => ({ left: 40 + left + offset, width: f.widths[index] })
        })) }] }];
    f.tick(); offset = 8; f.tick(); offset = 0; f.tick();
    const state = f.tracker.getSnapshot();
    assert.equal(state.maximumColumnShiftPx, 0);
    assert.equal(state.maximumBodyColumnShiftPx, 8);
    assert.equal(state.maximumHeaderBodyMismatchPx, 8);
    assert.equal(state.movementCount, 2); assert.equal(state.reversalCount, 1);
    assert.equal(state.latest.bodyAvailable, true);
    f.tracker.destroy();
});
