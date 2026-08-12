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
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.layout-geometry.js'
));

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
