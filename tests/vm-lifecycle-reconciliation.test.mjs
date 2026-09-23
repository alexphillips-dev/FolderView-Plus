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

const makeSurface = () => {
    const attributes = new Map([['class', 'fa fa-play'], ['style', 'color:green']]);
    const icon = { hasAttribute: key => attributes.has(key), getAttribute: key => attributes.get(key),
        setAttribute: (key, value) => attributes.set(key, value), removeAttribute: key => attributes.delete(key),
        classList: { remove() {} } };
    return { icon, querySelectorAll: () => [icon] };
};

for (const sameVm of [false, true]) {
    for (const rejected of [false, true]) {
        test(`superseded ${sameVm ? 'same' : 'different'} VM request cleans owned surfaces after a delayed ${rejected ? 'failure' : 'success'}`, async () => {
            const scheduled = [], fallback = [];
            const surfaces = { first: makeSurface(), second: makeSurface() };
            let complete;
            let calls = 0;
            const api = lifecycleModule.createApi({
                window: { setTimeout: handler => scheduled.push({ handler }) }, delaysMs: [0],
                getSurfaces: request => [surfaces[request.uuid]],
                getRuntimeEntry: () => ({ state: 'running' }),
                refreshRuntimeStateInPlace: () => ++calls === 1 ? new Promise((resolve, reject) => {
                    complete = () => rejected ? reject(new Error('Delayed failure')) : resolve(true);
                }) : Promise.resolve(true),
                queueNativeRefresh: () => fallback.push(true)
            });
            const old = api.run({ action: 'domain-start', uuid: 'first' });
            scheduled.shift().handler();
            const currentId = sameVm ? 'first' : 'second';
            const current = api.run({ action: 'domain-start', uuid: currentId });
            assert.equal(surfaces.first.icon.hasAttribute('aria-busy'), sameVm);
            assert.equal(surfaces[currentId].icon.hasAttribute('aria-busy'), true);
            complete();
            await flushPromises();
            assert.equal((await old).canceled, true);
            assert.equal(surfaces[currentId].icon.hasAttribute('aria-busy'), true, 'old completion cleared newer busy indicator');
            await drainTimers(scheduled);
            assert.equal((await current).settled, true);
            for (const surface of Object.values(surfaces)) {
                assert.equal(surface.icon.hasAttribute('aria-busy'), false);
                assert.equal(surface.icon.getAttribute('class'), 'fa fa-play');
                assert.equal(surface.icon.getAttribute('style'), 'color:green');
            }
            assert.equal(fallback.length, 0);
        });
    }
}

test('queued native action retains its busy indicator until its own callback settles', async () => {
    const scheduled = [], surface = makeSurface();
    const api = lifecycleModule.createApi({
        window: { setTimeout: handler => scheduled.push({ handler }) }, delaysMs: [0],
        getSurfaces: () => [surface], getRuntimeEntry: () => ({ state: 'running' }),
        refreshRuntimeStateInPlace: async () => true, shouldTrackRequest: () => true
    });
    const first = api.run({ action: 'domain-start', uuid: 'first' });
    api.enqueueNativeRequest({ action: 'domain-start', uuid: 'first' });
    await drainTimers(scheduled);
    await first;
    assert.equal(surface.icon.hasAttribute('aria-busy'), true);
    const queued = api.handleNativeCallback();
    await drainTimers(scheduled);
    await queued;
    assert.equal(surface.icon.hasAttribute('aria-busy'), false);
});

test('a superseded deferred fallback cannot reload over a newer VM action', async () => {
    const scheduled = [], fallback = [];
    const runtime = { state: 'shutoff' };
    const api = lifecycleModule.createApi({
        window: { setTimeout: handler => scheduled.push({ handler }) }, delaysMs: [0],
        getRuntimeEntry: () => runtime, refreshRuntimeStateInPlace: async () => true,
        queueNativeRefresh: () => fallback.push(true)
    });
    const first = api.run({ action: 'domain-start', uuid: 'first' });
    scheduled.shift().handler();
    await flushPromises();
    assert.equal((await first).settled, false);
    runtime.state = 'running';
    const next = api.run({ action: 'domain-start', uuid: 'second' });
    await drainTimers(scheduled);
    assert.equal((await next).settled, true);
    assert.equal(fallback.length, 0);
});

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
