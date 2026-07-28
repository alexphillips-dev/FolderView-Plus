import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const source = fs.readFileSync(
    path.resolve(
        process.cwd(),
        'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.shared.js'
    ),
    'utf8'
);

const loadRuntimeShared = () => {
    const window = { setTimeout, clearTimeout };
    vm.runInNewContext(source, {
        window,
        document: {},
        Element: class {},
        console,
        Map,
        Set,
        WeakMap,
        Object,
        Array,
        String,
        Number,
        Boolean,
        Date,
        Math,
        JSON,
        Promise,
        performance,
        setTimeout,
        clearTimeout
    });
    return window.FolderViewDockerRuntimeShared;
};

test('safe UI action runner queues one latest reversible intent while an action is busy', async () => {
    const runner = loadRuntimeShared().createSafeUiActionRunner();
    let releaseFirst;
    const firstGate = new Promise((resolve) => {
        releaseFirst = resolve;
    });
    const calls = [];

    const first = runner.run('docker-pin:folder-1', async () => {
        calls.push('pin-start');
        await firstGate;
        calls.push('pin-end');
        return 'pinned';
    });
    const queued = runner.run('docker-pin:folder-1', async () => {
        calls.push('stale-unpin');
        return 'stale';
    }, { queueIfBusy: true });
    const latestQueued = runner.run('docker-pin:folder-1', async () => {
        calls.push('unpin');
        return 'unpinned';
    }, { queueIfBusy: true });

    assert.equal(runner.isRunning('docker-pin:folder-1'), true);
    assert.equal(runner.isQueued('docker-pin:folder-1'), true);

    releaseFirst();
    assert.equal((await first).value, 'pinned');
    assert.equal((await queued).value, 'unpinned');
    assert.equal((await latestQueued).value, 'unpinned');
    assert.deepEqual(calls, ['pin-start', 'pin-end', 'unpin']);
    assert.equal(runner.isRunning('docker-pin:folder-1'), false);
    assert.equal(runner.isQueued('docker-pin:folder-1'), false);
});

test('safe UI action runner applies every intent immediately and marks stale work', async () => {
    const runner = loadRuntimeShared().createSafeUiActionRunner();
    const visibleStates = [];
    const completions = [];
    let releaseFirst;
    const firstGate = new Promise((resolve) => {
        releaseFirst = resolve;
    });
    const first = runner.run('docker-pin:folder-1', async (intent) => {
        await firstGate;
        completions.push(intent.isLatest() ? 'pin-current' : 'pin-stale');
    }, {
        onIntent: () => visibleStates.push('pinned')
    });
    const second = runner.run('docker-pin:folder-1', async (intent) => {
        completions.push(intent.isLatest() ? 'unpin-current' : 'unpin-stale');
    }, {
        queueIfBusy: true,
        onIntent: () => visibleStates.push('unpinned')
    });

    assert.deepEqual(visibleStates, ['pinned', 'unpinned']);
    releaseFirst();
    await Promise.all([first, second]);
    assert.deepEqual(completions, ['pin-stale', 'unpin-current']);
});

test('safe UI action runner keeps duplicate suppression as its default', async () => {
    const runner = loadRuntimeShared().createSafeUiActionRunner();
    let releaseFirst;
    const firstGate = new Promise((resolve) => {
        releaseFirst = resolve;
    });

    const first = runner.run('folder-move', async () => firstGate);
    const duplicate = await runner.run('folder-move', async () => 'unexpected');

    assert.equal(duplicate.ok, false);
    assert.equal(duplicate.skipped, true);
    assert.equal(duplicate.reason, 'in-flight');
    releaseFirst('done');
    assert.equal((await first).value, 'done');
});
