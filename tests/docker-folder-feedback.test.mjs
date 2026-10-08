import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const feedback = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.folder-feedback.js');

test('folder breakdown uses mutually exclusive runtime states and independent update counts', () => {
    assert.deepEqual(feedback.summarize({ running: { state: true, pause: false, update: true },
        paused: { state: true, pause: true }, stopped: { state: false, pause: false, update: true } }),
    { running: 1, stopped: 1, paused: 1, updates: 2, total: 3 });
    assert.deepEqual(feedback.summarize({ missing: null }), { running: 0, stopped: 0, paused: 0, updates: 0, total: 0 });
});

test('folder action eligibility retains start stop pause resume and restart semantics', () => {
    const running = { state: true, pause: false }, paused = { state: true, pause: true }, stopped = { state: false, pause: false };
    assert.equal(feedback.eligible(stopped, 'start'), true);
    assert.equal(feedback.eligible(running, 'start'), false);
    assert.equal(feedback.eligible(paused, 'stop'), true);
    assert.equal(feedback.eligible(running, 'pause'), true);
    assert.equal(feedback.eligible(paused, 'pause'), false);
    assert.equal(feedback.eligible(paused, 'resume'), true);
    assert.equal(feedback.eligible(stopped, 'restart'), true);
    assert.equal(feedback.eligible(stopped, 'unknown'), false);
});

test('confirmation needs actual state and cannot infer restart completion', () => {
    assert.equal(feedback.matchesState({ state: false }, 'start'), false);
    assert.equal(feedback.matchesState({ state: true, pause: false }, 'start'), true);
    assert.equal(feedback.matchesState({ state: true, pause: true }, 'pause'), true);
    assert.equal(feedback.matchesState({ state: true, pause: true }, 'resume'), false);
    assert.equal(feedback.matchesState({ state: true, pause: false }, 'restart'), false);
    assert.equal(feedback.matchesState(null, 'stop'), false);
});

test('missing identities never dispatch and a failed request does not reject the entire operation', async () => {
    let requests = 0, refreshes = 0;
    const win = { document: { getElementById: () => null, addEventListener() {}, removeEventListener() {} },
        addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout };
    const api = feedback.getApi(win);
    try {
        assert.equal(await api.run({ id: 'test', name: 'Synthetic', action: 'start',
            entries: { missing: { state: false }, network: { id: 'synthetic-id', state: false } },
            request: async () => { requests++; throw new Error('synthetic transport failure'); },
            refresh: async () => { refreshes++; }, read: () => ({}) }), true);
        assert.equal(requests, 1);
        assert.equal(refreshes, 1);
    } finally { api.destroy(); }
});

test('overlapping branches cannot submit duplicate requests and teardown cancels pending feedback', async () => {
    const timers = new Map(); let counter = 0;
    const listeners = new Set(), docListeners = new Set();
    const win = { document: { body: { classList: { contains: () => false } },
        getElementById: () => null, addEventListener: name => docListeners.add(name), removeEventListener: name => docListeners.delete(name) },
    addEventListener: name => listeners.add(name), removeEventListener: name => listeners.delete(name),
    setTimeout: fn => { timers.set(++counter, fn); return counter; }, clearTimeout: id => timers.delete(id) };
    const api = feedback.getApi(win);
    assert.equal(feedback.getApi(win), api);
    let release; const gate = new Promise(resolve => { release = resolve; }); let requests = 0;
    const options = { id: 'parent', name: 'Synthetic', action: 'start', entries: { app: { id: 'test-id', state: false } },
        request: () => { requests++; return gate; }, refresh: async () => {}, read: () => ({ app: { state: false } }) };
    const pending = api.run(options);
    assert.equal(await api.run(options), false);
    assert.equal(await api.run({ ...options, id: 'child' }), false);
    assert.equal(requests, 1);
    api.destroy(); release({ success: true });
    assert.equal(await pending, false);
    assert.equal(timers.size, 0);
    assert.equal(docListeners.size, 0);
    assert.equal(listeners.size, 0);
});
