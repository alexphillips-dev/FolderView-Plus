import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const telemetryModule = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/runtime.performance-telemetry.js');

const createHarness = () => {
    let time = 0;
    const records = new Map();
    class FakeMutationObserver {
        constructor(callback) { this.callback = callback; }
        observe() {}
        disconnect() {}
    }
    class FakePerformanceObserver {
        constructor(callback) { this.callback = callback; }
        observe() {}
        disconnect() {}
    }
    const storage = {
        setItem: (key, value) => records.set(key, value),
        getItem: (key) => records.get(key) || null
    };
    const window = {
        performance: {
            now: () => time,
            getEntriesByType: () => [],
            memory: { usedJSHeapSize: 4096 }
        },
        MutationObserver: FakeMutationObserver,
        PerformanceObserver: FakePerformanceObserver,
        localStorage: storage,
        setTimeout: (callback) => { callback(); return 1; },
        clearTimeout: () => {},
        addEventListener: () => {},
        console: { debug: () => {} }
    };
    const root = {
        querySelectorAll: (selector) => {
            if (selector === '*') return Array.from({ length: 12 }, () => ({}));
            if (selector.includes('tr.folder')) return [{}, {}];
            if (selector.includes('tr.sortable')) return [{}, {}, {}];
            if (selector.includes('.folder-preview-wrapper')) return [{}];
            return [];
        }
    };
    return { window, storage, records, root, advance: (amount) => { time += amount; } };
};

test('runtime performance telemetry records bounded privacy-safe milestones and operations', () => {
    const harness = createHarness();
    const collector = telemetryModule.createCollector('docker', {
        window: harness.window,
        document: { body: harness.root },
        storage: harness.storage
    });

    collector.observe(harness.root);
    collector.begin('folderGrouping');
    harness.advance(42.25);
    assert.equal(collector.end('folderGrouping', { folderCount: 3, source: 'bootstrap', containerName: 'secret' }), 42.25);
    collector.mark('foldersGrouped', { folderCount: 3, route: 'docker' });
    const dom = collector.sampleDom('ready');
    collector.persist();

    const snapshot = collector.getSnapshot();
    assert.equal(snapshot.surface, 'docker');
    assert.equal(snapshot.operations.folderGrouping.count, 1);
    assert.equal(snapshot.operations.folderGrouping.lastMs, 42.25);
    assert.equal(snapshot.milestones.foldersGrouped.count, 1);
    assert.equal(snapshot.workload.dom.totalNodes, 12);
    assert.equal(dom.heapBytes, 4096);
    assert.equal(snapshot.events.some((event) => Object.hasOwn(event.details, 'containerName')), false);
    assert.ok(harness.records.has('fv.support.bundle.runtime.performance.docker.v1'));
});

test('runtime performance telemetry bounds histories and reuses one collector per surface', () => {
    const harness = createHarness();
    const first = telemetryModule.getOrCreate('vm', { window: harness.window, document: { body: harness.root }, storage: harness.storage });
    const second = telemetryModule.getOrCreate('vm', { window: harness.window, document: { body: harness.root }, storage: harness.storage });
    assert.equal(first, second);

    for (let index = 0; index < telemetryModule.MAX_EVENTS + 20; index += 1) {
        first.record('incrementalReconciliation', index + 1, { attempt: index + 1 });
    }
    const snapshot = first.getSnapshot();
    assert.equal(snapshot.events.length, telemetryModule.MAX_EVENTS);
    assert.equal(snapshot.operations.incrementalReconciliation.count, telemetryModule.MAX_OPERATION_SAMPLES);
    assert.equal(snapshot.operations.incrementalReconciliation.lastMs, telemetryModule.MAX_EVENTS + 20);
});

test('runtime performance telemetry storage keys and metadata sanitizer remain deterministic', () => {
    assert.equal(telemetryModule.storageKeyForSurface('folder-editor'), 'fv.support.bundle.runtime.performance.folder-editor.v1');
    assert.deepEqual(telemetryModule.sanitizeDetails({
        folderCount: 9,
        requestCount: 2,
        folderId: 'sensitive',
        url: 'https://example.invalid',
        success: true,
        source: 'bootstrap'
    }), {
        folderCount: 9,
        requestCount: 2,
        success: true,
        source: 'bootstrap'
    });
});

test('every interactive surface loads the shared collector and support exports discover all surface keys', () => {
    const pluginRoot = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
    const pages = ['folderview.plus.Docker.page', 'folderview.plus.VMs.page', 'folderview.plus.Dashboard.page', 'FolderViewPlus.page', 'Folder.page'];
    pages.forEach((page) => {
        const source = fs.readFileSync(path.join(pluginRoot, page), 'utf8');
        assert.match(source, /scripts\/runtime\.performance-telemetry\.js/);
    });
    const diagnostics = fs.readFileSync(path.join(pluginRoot, 'scripts/folderviewplus.activity-diagnostics.js'), 'utf8');
    ['docker', 'vm', 'dashboard', 'settings', 'folder-editor'].forEach((surface) => {
        assert.match(diagnostics, new RegExp(`runtime\\.performance\\.${surface.replace('-', '\\-')}\\.v1`));
    });
});
