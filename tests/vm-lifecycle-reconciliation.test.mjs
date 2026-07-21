import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const lifecycleModule = require(path.resolve(
    process.cwd(),
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/vm.runtime.lifecycle.js'
));

const flushPromises = async () => {
    await Promise.resolve();
    await Promise.resolve();
};

const createHookAdapter = (window) => ({
    wrapHook(name, handler) {
        const original = window[name];
        window[name] = (...args) => handler({
            args,
            invokeOriginal: (...overrideArgs) => original(...(overrideArgs.length ? overrideArgs : args))
        });
        return window[name];
    },
    getSnapshot: () => ({ structure: { valid: true } })
});

const drainTimers = async (scheduled) => {
    while (scheduled.length > 0) {
        const timer = scheduled.shift();
        timer.handler();
        await flushPromises();
    }
};

test('VM lifecycle replaces native loadlist with incremental stop and patches context state', async () => {
    const scheduled = [];
    const hostCalls = [];
    const contextStates = [];
    const runtime = { uuid: 'vm-1', name: 'Test VM', state: 'running' };
    const window = {
        setTimeout(handler, delayMs) {
            scheduled.push({ handler, delayMs });
            return scheduled.length;
        },
        ajaxVMDispatch(params, callbackName) {
            hostCalls.push({ params: { ...params }, callbackName });
            runtime.state = 'shutoff';
            window[callbackName]();
            return 'native-result';
        },
        addVMContext(_name, _uuid, _template, state) {
            contextStates.push(state);
            return state;
        }
    };
    const api = lifecycleModule.createApi({
        window,
        hostAdapter: createHookAdapter(window),
        delaysMs: [0],
        getRuntimeEntry: () => runtime,
        refreshRuntimeStateInPlace: async () => true
    });
    api.bind();

    assert.equal(window.ajaxVMDispatch({ action: 'domain-stop', uuid: 'vm-1' }, 'loadlist'), 'native-result');
    await drainTimers(scheduled);
    assert.equal(hostCalls[0].callbackName, lifecycleModule.VM_LIFECYCLE_CALLBACK_NAME);
    assert.equal(api.getSnapshot().latest.eventType, 'lifecycleSurfaceFinalized');
    assert.equal(api.getSnapshot().latest.settled, true);

    window.addVMContext('Test VM', 'vm-1', 'Custom', 'running');
    assert.deepEqual(contextStates, ['shutoff']);
    assert.equal(api.getSnapshot().eventGroups.lifecycleContextStateResolved, 1);
});

test('VM lifecycle supports start, pause, resume, hibernate, wake, destroy, and console starts', () => {
    const cases = [
        ['domain-start', 'start'],
        ['domain-start-console', 'start'],
        ['domain-start-consoleRV', 'start'],
        ['domain-stop', 'stop'],
        ['domain-destroy', 'stop'],
        ['domain-pause', 'pause'],
        ['domain-pmsuspend', 'pause'],
        ['domain-resume', 'resume'],
        ['domain-pmwakeup', 'resume'],
        ['domain-restart', 'restart']
    ];
    cases.forEach(([action, intent]) => {
        assert.deepEqual(lifecycleModule.normalizeRequest({ action, uuid: 'vm-1' }), {
            action: action.toLowerCase(),
            intent,
            uuid: 'vm-1'
        });
    });
    assert.equal(lifecycleModule.normalizeRequest({ action: 'domain-autostart', uuid: 'vm-1' }), null);
});

test('VM lifecycle performs one native fallback after bounded attempts are exhausted', async () => {
    const scheduled = [];
    const fallback = [];
    const runtime = { uuid: 'vm-1', state: 'shutoff' };
    const window = {
        setTimeout(handler, delayMs) {
            scheduled.push({ handler, delayMs });
            return scheduled.length;
        }
    };
    const api = lifecycleModule.createApi({
        window,
        delaysMs: [0, 5, 10],
        getRuntimeEntry: () => runtime,
        refreshRuntimeStateInPlace: async () => true,
        queueNativeRefresh: (details) => fallback.push(details)
    });
    const resultPromise = api.run({ action: 'domain-start', uuid: 'vm-1' });
    await drainTimers(scheduled);
    const result = await resultPromise;

    assert.equal(result.settled, false);
    assert.equal(result.attempt, 3);
    assert.equal(fallback.length, 1);
    assert.equal(api.getSnapshot().fallbackCount, 1);
    assert.equal(api.getSnapshot().eventGroups.lifecycleRefreshResult, 3);
});

test('new VM lifecycle generations cancel stale reconciliation tails', async () => {
    const scheduled = [];
    const runtime = { uuid: 'vm-1', state: 'running' };
    const window = {
        setTimeout(handler, delayMs) {
            scheduled.push({ handler, delayMs });
            return scheduled.length;
        }
    };
    const api = lifecycleModule.createApi({
        window,
        delaysMs: [0, 5],
        getRuntimeEntry: () => runtime,
        refreshRuntimeStateInPlace: async () => true
    });
    const stopPromise = api.run({ action: 'domain-stop', uuid: 'vm-1' });
    const startPromise = api.run({ action: 'domain-start', uuid: 'vm-1' });
    await drainTimers(scheduled);

    assert.equal((await stopPromise).canceled, true);
    assert.equal((await startPromise).settled, true);
    assert.equal(api.getSnapshot().staleGenerationCount, 1);
});
