import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(process.cwd());
const reconcileModule = require(path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.runtime.reconcile.js'
));
const hostAdaptersModule = require(path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/runtime.host-adapter.js'
));
const dockerRuntimeSource = fs.readFileSync(path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js'
), 'utf8');

const flushPromises = async () => {
    await Promise.resolve();
    await Promise.resolve();
};

const createHarness = () => {
    const hostCalls = [];
    const scheduled = [];
    const refreshCalls = [];
    const trace = [];
    const contextCalls = [];
    const runtimeByName = {
        audiobookshelf: {
            info: {
                State: {
                    Running: true,
                    Paused: false,
                    Updated: true,
                    Autostart: true
                }
            }
        }
    };
    const originalEventControl = (...args) => {
        hostCalls.push(args);
        return 'host-result';
    };
    const window = {
        eventControl: originalEventControl,
        addDockerContainerContext: (...args) => {
            contextCalls.push(args);
            return 'context-result';
        },
        setTimeout(handler, delayMs) {
            scheduled.push({ handler, delayMs });
            return scheduled.length;
        }
    };
    const hostAdapter = hostAdaptersModule.createHostAdapter('docker', {
        window,
        document: {}
    });
    const hostGuards = {
        wrapHostHook: (name, handler, options = {}) => hostAdapter.wrapHook(name, handler, options)
    };
    const api = reconcileModule.createApi({
        window,
        document: null,
        refreshDockerRuntimeStateInPlace: async (options = {}) => {
            refreshCalls.push(options);
            return true;
        },
        appendDockerBulkUpdateTrace: (eventType, details = {}) => {
            trace.push({ eventType, details });
        },
        getDockerHostGuardsApi: () => hostGuards,
        getDockerRuntimeContainerInfo: (name) => runtimeByName[name] || null
    });
    return { api, window, originalEventControl, hostCalls, scheduled, refreshCalls, trace, contextCalls, runtimeByName };
};

test('Docker lifecycle actions replace the destructive host loadlist callback', async () => {
    const harness = createHarness();
    assert.equal(harness.api.bindLifecycleEventControlPatch(), true);

    const result = harness.window.eventControl({ action: 'stop', container: 'abc123' }, 'loadlist');
    assert.equal(result, 'host-result');
    assert.equal(harness.hostCalls.length, 1);
    assert.equal(
        harness.hostCalls[0][1],
        reconcileModule.DOCKER_LIFECYCLE_REFRESH_CALLBACK_NAME
    );
    assert.notEqual(harness.hostCalls[0][1], 'loadlist');
    assert.equal(typeof harness.window[reconcileModule.DOCKER_LIFECYCLE_REFRESH_CALLBACK_NAME], 'function');

    harness.window[reconcileModule.DOCKER_LIFECYCLE_REFRESH_CALLBACK_NAME]();
    assert.deepEqual(
        harness.scheduled.map((entry) => entry.delayMs),
        [...reconcileModule.DOCKER_LIFECYCLE_REFRESH_DELAYS_MS]
    );
    for (const scheduled of harness.scheduled) {
        scheduled.handler();
        await flushPromises();
    }
    assert.equal(harness.refreshCalls.length, reconcileModule.DOCKER_LIFECYCLE_REFRESH_DELAYS_MS.length);
    harness.refreshCalls.forEach((options) => {
        assert.deepEqual(options, {
            liveUpdateStatus: true,
            preserveGroupedDom: true
        });
    });
    assert.ok(harness.trace.some((entry) => entry.eventType === 'lifecycleLoadlistIntercepted'));
});

test('Docker lifecycle patch leaves structural and unrelated host callbacks unchanged', () => {
    const harness = createHarness();
    harness.api.bindLifecycleEventControlPatch();
    const wrappedEventControl = harness.window.eventControl;

    harness.window.eventControl({ action: 'remove', container: 'abc123' }, 'loadlist');
    harness.window.eventControl({ action: 'start', container: 'abc123' }, 'customRefresh');
    harness.api.bindLifecycleEventControlPatch();

    assert.equal(harness.hostCalls[0][1], 'loadlist');
    assert.equal(harness.hostCalls[1][1], 'customRefresh');
    assert.equal(harness.window.eventControl, wrappedEventControl);
    assert.equal(harness.scheduled.length, 0);
});

test('Docker container context menus resolve lifecycle actions from the latest runtime cache', () => {
    const harness = createHarness();
    assert.equal(harness.api.bindDockerContainerContextStatePatch(), true);

    const staleStoppedArgs = ['audiobookshelf', 'image', 'template', false, false, 1, false];
    assert.equal(harness.window.addDockerContainerContext(...staleStoppedArgs), 'context-result');
    assert.equal(harness.contextCalls[0][3], true);
    assert.equal(harness.contextCalls[0][4], false);
    assert.equal(harness.contextCalls[0][5], 0);
    assert.equal(harness.contextCalls[0][6], true);

    harness.runtimeByName.audiobookshelf.info.State.Running = false;
    harness.runtimeByName.audiobookshelf.info.State.Autostart = false;
    const staleStartedArgs = ['audiobookshelf', 'image', 'template', true, false, 0, true];
    harness.window.addDockerContainerContext(...staleStartedArgs);
    assert.equal(harness.contextCalls[1][3], false);
    assert.equal(harness.contextCalls[1][4], false);
    assert.equal(harness.contextCalls[1][6], false);

    const wrappedContextBuilder = harness.window.addDockerContainerContext;
    assert.equal(harness.api.bindDockerContainerContextStatePatch(), true);
    assert.equal(harness.window.addDockerContainerContext, wrappedContextBuilder);
});

test('Docker lifecycle reconciliation never promotes revision churn into a grouped-table rebuild', () => {
    assert.match(
        dockerRuntimeSource,
        /const configurationChanged = snapshot && !dockerRuntimeSnapshotConfigMatches\(snapshot\);/
    );
    assert.match(
        dockerRuntimeSource,
        /if \(configurationChanged && !preserveGroupedDom\) \{\s*fallbackReason = 'configuration-changed';\s*return false;\s*\}/
    );
    assert.match(
        dockerRuntimeSource,
        /if \(preserveGroupedDom\) \{[\s\S]*mode: 'incremental-retry'[\s\S]*return;\s*\}/
    );
    assert.doesNotMatch(
        dockerRuntimeSource,
        /preserveGroupedDom && fallbackReason !== 'configuration-changed'/
    );
});
