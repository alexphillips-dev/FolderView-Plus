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
    const originalEventControl = (...args) => {
        hostCalls.push(args);
        return 'host-result';
    };
    const window = {
        eventControl: originalEventControl,
        setTimeout(handler, delayMs) {
            scheduled.push({ handler, delayMs });
            return scheduled.length;
        }
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
        }
    });
    return { api, window, originalEventControl, hostCalls, scheduled, refreshCalls, trace };
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
