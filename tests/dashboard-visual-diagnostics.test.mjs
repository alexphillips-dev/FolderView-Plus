import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const modulePath = path.resolve(
    process.cwd(),
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/dashboard.visual-diagnostics.js'
);
const diagnostics = require(modulePath);

test('Dashboard visual diagnostics parses rendered grid tracks and summarizes widths', () => {
    assert.equal(diagnostics.countGridTracks('442px'), 1);
    assert.equal(diagnostics.countGridTracks('442px 442px'), 2);
    assert.equal(diagnostics.countGridTracks('repeat(3, minmax(0, 1fr))'), 3);
    assert.equal(diagnostics.countGridTracks('none'), 0);
    assert.deepEqual(
        diagnostics.summarizeWidths([320, 220, 280, 240]),
        { count: 4, minimumPx: 220, medianPx: 260, maximumPx: 320 }
    );
});

test('Dashboard visual diagnostics records label lengths without exporting names', () => {
    assert.equal(diagnostics.labelLengthBucket(''), '0');
    assert.equal(diagnostics.labelLengthBucket('Short label'), '1-12');
    assert.equal(diagnostics.labelLengthBucket('A fairly long container name'), '25-40');
    assert.equal(diagnostics.labelLengthBucket('An exceptionally long container name used for diagnostics'), '41+');
    assert.equal(diagnostics.fingerprintValue('private-container-name', 'session-a').length, 16);
    assert.notEqual(
        diagnostics.fingerprintValue('private-container-name', 'session-a'),
        diagnostics.fingerprintValue('private-container-name', 'session-b')
    );
});

test('Dashboard visual verdict distinguishes intentional ellipsis from broken geometry', () => {
    const healthy = diagnostics.buildVisualVerdict({
        layout: 'compactmatrix',
        expectedFolderColumns: 2,
        appliedFolderColumns: 2,
        renderedFolderColumns: 2,
        expectedMemberColumns: 2,
        appliedMemberColumns: 2,
        renderedMemberColumns: 2,
        intentionalEllipsisCount: 3
    });
    assert.equal(healthy.status, 'healthy');
    assert.deepEqual(healthy.codes, ['intentional-ellipsis-only']);
    assert.equal(healthy.noUnexpectedClipping, true);

    const broken = diagnostics.buildVisualVerdict({
        layout: 'compactmatrix',
        expectedFolderColumns: 2,
        appliedFolderColumns: 3,
        renderedFolderColumns: 3,
        expectedMemberColumns: 2,
        appliedMemberColumns: 2,
        renderedMemberColumns: 2,
        unexpectedClipCount: 1
    });
    assert.equal(broken.status, 'error');
    assert.ok(broken.codes.includes('folder-column-mismatch'));
    assert.ok(broken.codes.includes('unexpected-label-clipping'));
    assert.equal(broken.columnsAgree, false);
    assert.equal(broken.noUnexpectedClipping, false);
});

test('Dashboard visual diagnostics detects a long inline label crossing its tile boundary', () => {
    const parent = {};
    const label = {
        parentElement: parent,
        clientWidth: 0,
        scrollWidth: 0,
        textContent: 'Very-Long-Container-Name',
        hidden: false,
        getClientRects: () => [{}],
        getBoundingClientRect: () => ({
            left: 20,
            top: 10,
            right: 310,
            bottom: 30,
            width: 290,
            height: 20
        })
    };
    const result = diagnostics.collectLabelDiagnostics({
        labels: [label],
        boundsForLabel: () => ({
            left: 10,
            top: 0,
            right: 250,
            bottom: 50,
            width: 240,
            height: 50
        }),
        win: {
            getComputedStyle(node) {
                return node === parent
                    ? { textOverflow: 'clip', overflowX: 'hidden' }
                    : { display: 'block', visibility: 'visible', textOverflow: 'clip', overflowX: 'visible' };
            }
        },
        sessionSalt: 'test-session'
    });
    assert.equal(result.overflowCount, 1);
    assert.equal(result.unexpectedClipCount, 1);
    assert.equal(result.maximumOverflowPx, 60);
    assert.equal(result.samples[0].exceedsTileBounds, true);
    assert.equal(Object.prototype.hasOwnProperty.call(result.samples[0], 'labelText'), false);
});

test('Dashboard visual history is bounded and replaces equivalent geometry samples', () => {
    const values = new Map();
    const storage = {
        getItem: (key) => values.get(key) || null,
        setItem: (key, value) => values.set(key, value)
    };
    let clock = Date.parse('2026-07-23T12:00:00.000Z');
    const controller = diagnostics.createController({
        storage,
        document: null,
        now: () => clock,
        historyLimit: 4
    });
    const base = {
        schemaVersion: 1,
        environment: { viewport: { width: 390 } },
        layout: { preference: 'compactmatrix' },
        content: { folderCount: 1 },
        overflow: { labels: { unexpectedClipCount: 0 } },
        verdict: { status: 'healthy', codes: ['layout-consistent'] }
    };
    controller.persist('docker', { ...base, capturedAt: new Date(clock).toISOString() });
    clock += 1000;
    controller.persist('docker', { ...base, capturedAt: new Date(clock).toISOString() });
    assert.equal(controller.read('docker').snapshots.length, 1);

    for (let index = 0; index < 6; index += 1) {
        clock += 1000;
        controller.persist('docker', {
            ...base,
            capturedAt: new Date(clock).toISOString(),
            environment: { viewport: { width: 400 + index } }
        });
    }
    const record = controller.read('docker');
    assert.equal(record.snapshots.length, 4);
    assert.equal(record.latest.environment.viewport.width, 405);
});
