import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const diagnostics = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/runtime.page-diagnostics.js');

const createStorage = () => {
    const values = new Map();
    return {
        getItem: (key) => values.get(key) || null,
        setItem: (key, value) => values.set(key, String(value))
    };
};

const createFixture = () => {
    const storage = createStorage();
    const nodes = {
        'tr': [{}, {}],
        '.folder, .folder-showcase-outer': [{}],
        '.folder[expanded="true"], .folder-showcase-outer[expanded="true"]': [{}],
        '.folder-preview-wrapper, .folder-element-docker, .folder-element-vm': [{}, {}, {}],
        '.spinner, .fv-runtime-loading-row, [aria-busy="true"]': [],
        '.fa-spin, .fa-spinner, .fa-circle-o-notch': [{}],
        '.error, .invalid, [aria-invalid="true"]': []
    };
    const host = { clientWidth: 100, scrollWidth: 120, querySelectorAll: (selector) => nodes[selector] || [] };
    const document = {
        body: host,
        documentElement: { clientWidth: 1200, scrollWidth: 1200 },
        querySelector: () => host
    };
    const window = {
        localStorage: storage,
        innerWidth: 1200,
        innerHeight: 800,
        navigator: { maxTouchPoints: 0 },
        document,
        getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
        matchMedia: (query) => ({ matches: query.includes('color-scheme: dark') })
    };
    return { storage, host, document, window };
};

test('runtime page diagnostics captures allowlisted aggregate state only', () => {
    const fixture = createFixture();
    const snapshot = diagnostics.capture({
        window: fixture.window,
        document: fixture.document,
        root: fixture.host,
        surface: 'docker',
        variant: 'folderview',
        trigger: 'manual',
        now: () => Date.UTC(2026, 7, 12, 12, 0, 0)
    });
    assert.equal(snapshot.state.visibleRows, 2);
    assert.equal(snapshot.state.spinningControls, 1);
    assert.equal(snapshot.state.horizontalOverflow, true);
    assert.equal(snapshot.viewport.widthBucket, '1025-1440');
    const serialized = JSON.stringify(snapshot);
    for (const forbidden of ['containerName', 'folderId', 'url', 'path', 'selector', 'css', 'graphql', 'variables']) {
        assert.doesNotMatch(serialized, new RegExp(forbidden, 'i'));
    }
});

test('runtime page diagnostics retains three fresh captures per surface and expires old captures', () => {
    const fixture = createFixture();
    const base = Date.UTC(2026, 7, 12, 12, 0, 0);
    for (let index = 0; index < 5; index += 1) {
        diagnostics.capture({
            window: fixture.window,
            document: fixture.document,
            root: fixture.host,
            surface: 'vm',
            now: () => base + index * 1000
        });
    }
    assert.equal(diagnostics.readRecord({ window: fixture.window, now: () => base + 5000 }).surfaces.vm.length, 3);
    assert.equal(diagnostics.readRecord({ window: fixture.window, now: () => base + diagnostics.TTL_MS + 6000 }).surfaces.vm.length, 0);
});

test('normalization drops unknown fields and coerces untrusted counts', () => {
    const snapshot = diagnostics.normalizeSnapshot({
        surface: 'dashboard',
        capturedAt: '2026-08-12T12:00:00.000Z',
        url: 'http://private-host/',
        state: { visibleRows: 999999, rawDom: '<secret>' }
    });
    assert.equal(snapshot.state.visibleRows, 10000);
    assert.equal(Object.hasOwn(snapshot, 'url'), false);
    assert.equal(Object.hasOwn(snapshot.state, 'rawDom'), false);
});
