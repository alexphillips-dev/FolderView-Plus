import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils-foundation.js', import.meta.url), 'utf8');
const fixture = () => {
    const callbacks = [];
    const context = { module: { exports: {} }, console, setTimeout, clearTimeout,
        window: { requestIdleCallback: callback => callbacks.push(callback) } };
    vm.runInNewContext(source, context);
    return { api: context.module.exports, callbacks,
        run: (didTimeout, timeRemaining = 0) => callbacks.shift()({ didTimeout, timeRemaining: () => timeRemaining }) };
};

test('expired idle deadlines make progress while preserving the exhausted frame budget', () => {
    const f = fixture(), queue = f.api.createIdleTaskQueue(), completed = [];
    queue.enqueue(() => completed.push('first'));
    queue.enqueue(() => completed.push('second'));
    f.run(false);
    assert.deepEqual(completed, [], 'an unexpired callback must yield when idle time is exhausted');
    f.run(true);
    assert.deepEqual(completed, ['first'], 'timeout guarantees progress without draining an exhausted frame');
    assert.equal(queue.size(), 1);
    f.run(true);
    assert.deepEqual(completed, ['first', 'second']);
    assert.equal(queue.size(), 0);
    assert.equal(f.callbacks.length, 0);
});

test('idle storage writes and removals settle after timeout with no remaining idle time', () => {
    const f = fixture(), values = new Map([['removed', 'old']]);
    const writer = f.api.createBatchedStorageWriter({
        getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key)
    });
    writer.setItem('saved', 'new', { delayMs: 0, idle: true });
    writer.removeItem('removed', { delayMs: 0, idle: true });
    f.run(true);
    assert.equal(values.get('saved'), 'new');
    f.run(true);
    assert.equal(values.has('removed'), false);
    assert.equal(f.callbacks.length, 0);
});

test('available idle time still drains ordinary queued tasks and clear cancels pending work', () => {
    const f = fixture(), queue = f.api.createIdleTaskQueue(), completed = [];
    queue.enqueue(() => completed.push('first'));
    queue.enqueue(() => completed.push('second'));
    f.run(false, 10);
    assert.deepEqual(completed, ['first', 'second']);
    queue.enqueue(() => completed.push('cleared'));
    queue.clear();
    f.run(true);
    assert.deepEqual(completed, ['first', 'second']);
    assert.equal(f.callbacks.length, 0);
});
