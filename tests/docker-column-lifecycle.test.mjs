import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createController } = require('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.column-controller.js');

function fixture() {
    const timers = new Map(), fontListeners = new Set();
    let resolveFonts, nextTimer = 0;
    const fonts = { ready: new Promise(resolve => { resolveFonts = resolve; }),
        addEventListener: (_event, handler) => fontListeners.add(handler),
        removeEventListener: (_event, handler) => fontListeners.delete(handler) };
    const window = { setTimeout: (callback, delay) => { timers.set(++nextTimer, { callback, delay }); return nextTimer; },
        clearTimeout: id => timers.delete(id) };
    const body = { getAttribute: () => 'standard', appendChild() {} };
    const header = { classList: { remove() {}, toggle() {} }, querySelector: () => null };
    const table = { querySelectorAll: () => [header] };
    const document = { fonts, body, querySelector: () => ({ closest: () => table }),
        createElement: () => ({ style: {} }) };
    const widthState = { stabilizationGeneration: 0, debounceTimer: null, stabilizationTimer: null };
    const controllerState = { resizerBindTimer: null, resizerRetryTimer: null };
    const api = createController({ window, document, widthState, controllerState,
        constants: { DOCKER_RUNTIME_WIDTH_PHASES: { idle: 'idle', debounce: 'debounce' },
            DOCKER_RUNTIME_WIDTH_BOOTSTRAP_FONT_TIMEOUT_MS: 1000, DOCKER_RUNTIME_WIDTH_BOOTSTRAP_SETTLE_MS: 280 } });
    return { api, timers, fontListeners, resolveFonts, widthState };
}

test('disposed Docker column bootstrap cannot schedule work when pending fonts resolve', async () => {
    const f = fixture();
    f.api.completeDockerRuntimeWidthBootstrap(f.api.beginDockerRuntimeWidthBootstrap());
    f.api.dispose();
    f.timers.clear(); // The already scheduled font timeout is allowed to settle without DOM work.
    f.resolveFonts();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.timers.size, 0);
});

test('disposed Docker column controller removes font listener and rejects queued callbacks', async () => {
    const f = fixture();
    f.api.bindDockerRuntimeColumnResizers({ scheduleReflow: false });
    assert.equal(f.fontListeners.size, 1);
    const lateFontCallback = [...f.fontListeners][0];
    f.api.dispose();
    f.resolveFonts();
    lateFontCallback();
    f.api.queueDockerRuntimeResizerBind();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.fontListeners.size, 0);
    assert.equal(f.timers.size, 0);
});

test('active Docker column bootstrap still schedules its settling pass after fonts resolve', async () => {
    const f = fixture();
    f.api.completeDockerRuntimeWidthBootstrap(f.api.beginDockerRuntimeWidthBootstrap());
    f.timers.clear();
    f.resolveFonts();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.timers.size, 1);
    assert.equal(f.widthState.stabilizationPending, true);
    f.api.dispose();
    assert.equal(f.timers.size, 0);
});
