import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const repoRoot = path.resolve(process.cwd());
const pluginRoot = path.join(repoRoot, 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const read = (relativePath) => fs.readFileSync(path.join(pluginRoot, relativePath), 'utf8');
const require = createRequire(import.meta.url);
const ordering = require(path.join(pluginRoot, 'scripts/runtime.folder-ordering.js'));
const liveRefresh = require(path.join(pluginRoot, 'scripts/runtime.live-refresh.js'));
const columnController = require(path.join(pluginRoot, 'scripts/docker.runtime.column-controller.js'));

test('shared folder ordering preserves hierarchy depth, host-created order, and reconciliation', () => {
    assert.deepEqual(ordering.buildFolderDepthById({
        root: {},
        child: { parentId: 'root' },
        grandchild: { parentId: 'child' }
    }), { root: 0, child: 1, grandchild: 2 });

    const folders = { a: {}, b: {}, c: {} };
    const ordered = ordering.reorderFolderSlotsInBaseOrder(
        ['folder-a', 'folder-c', 'folder-stale'],
        folders,
        { sortMode: 'created' },
        { orderFolders: () => ({ a: {}, b: {}, c: {} }) }
    );
    assert.deepEqual(ordered, ['folder-a', 'folder-c', 'folder-b']);

    const reconciled = ordering.reconcileOrderWithFolderSlots(
        ['new', 'existing'],
        ['existing', 'folder-a'],
        folders
    );
    assert.deepEqual(reconciled, {
        order: ['folder-a', 'existing', 'new'],
        newOnes: ['new']
    });
});

test('shared live refresh owns cadence, in-flight exclusion, visibility, and teardown', async () => {
    let nextId = 1;
    const intervals = new Map();
    const timeouts = new Map();
    const document = { hidden: false };
    const window = {
        document,
        setInterval(callback) {
            const id = nextId++;
            intervals.set(id, callback);
            return id;
        },
        clearInterval(id) { intervals.delete(id); },
        setTimeout(callback) {
            const id = nextId++;
            timeouts.set(id, callback);
            return id;
        },
        clearTimeout(id) { timeouts.delete(id); }
    };
    let ticks = 0;
    const controller = liveRefresh.createController({
        window,
        document,
        keys: ['docker', 'vm'],
        tick: () => { ticks += 1; }
    });

    assert.equal(controller.schedule('docker', { enabled: true, intervalMs: 1000 }), true);
    assert.deepEqual(controller.snapshot().activeKeys, ['docker']);
    const intervalCallback = [...intervals.values()][0];
    intervalCallback();
    intervalCallback();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(ticks, 1, 'overlapping ticks must be suppressed');
    [...timeouts.values()].forEach((callback) => callback());
    document.hidden = true;
    assert.equal(await controller.run('docker'), false);
    assert.equal(ticks, 1, 'hidden pages must not refresh');
    controller.dispose();
    assert.deepEqual(controller.snapshot().activeKeys, []);
    assert.equal(intervals.size, 0);
    assert.equal(timeouts.size, 0);
});

test('Docker owns the extracted column controller while all surfaces reuse shared seams', () => {
    assert.equal(typeof columnController.createController, 'function');
    const docker = read('scripts/docker.js');
    const vm = read('scripts/vm.js');
    const dashboard = read('scripts/dashboard.js');
    const dashboardMatchCache = read('scripts/dashboard.folder-match-cache.js');
    const dockerPage = read('folderview.plus.Docker.page');
    const vmPage = read('folderview.plus.VMs.page');
    const dashboardPage = read('folderview.plus.Dashboard.page');

    assert.match(docker, /dockerRuntimeColumnControllerModule\.createController\(\{/);
    assert.doesNotMatch(docker, /const estimateDockerRuntimeAutoAppWidth = \(\) =>/);
    for (const source of [docker, vm, dashboard]) {
        assert.match(source, /runtimeLiveRefreshModule\.createController\(\{/);
        assert.doesNotMatch(source, /let liveRefreshTimer\b|let liveRefreshInFlight\b/);
    }
    assert.match(docker, /runtimeFolderOrdering\.reorderFolderSlotsInBaseOrder/);
    assert.match(vm, /runtimeFolderOrdering\.reorderFolderSlotsInBaseOrder/);
    assert.match(dashboardMatchCache, /runtimeFolderOrdering\.reorderFolderSlotsInBaseOrder/);
    assert.match(dockerPage, /docker\.runtime\.column-controller\.js/);
    for (const page of [dockerPage, vmPage, dashboardPage]) {
        assert.match(page, /runtime\.live-refresh\.js/);
    }
});
