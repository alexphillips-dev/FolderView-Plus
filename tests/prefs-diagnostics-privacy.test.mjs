import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const scripts = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts');
const loadModule = (name, root) => {
    const filename = path.join(scripts, `folderviewplus.${name}.js`);
    const context = {
        globalThis: root, module: { exports: {} }, exports: {}, URL, console,
        setTimeout, clearTimeout, require: createRequire(filename)
    };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
    return context.module.exports;
};

for (const [description, message] of [
    ['plain identifiers', 'SyntheticPrivateVm rejected SyntheticSecretToken'],
    ['paths and URLs', 'SyntheticPrivateVm /mnt/user/SyntheticPrivatePath/settings.json https://synthetic.invalid/?token=SyntheticSecretToken 192.168.24.31']
]) {
    test(`sanitized preference diagnostics redact ${description} and preserve synchronization state`, async () => {
        const root = {};
        const prefs = loadModule('prefs-store', root);
        const error = Object.assign(new Error(message), { status: 400 });
        const coordinator = prefs.createPreferenceSaveCoordinator({
            storage: null,
            normalizePrefs: (value = {}) => value,
            writePrefs: async () => { throw error; }
        });
        await assert.rejects(coordinator.save('vm', { dashboard: { names: false } }, {
            immediate: true, currentPrefs: { _metadata: { prefsRevision: 3 } }
        }), { message });
        root.FolderViewPlusPrefsStore = { getDefaultCoordinator: () => coordinator };
        root.FolderViewPlusSupportBundleBrowser = loadModule('support-bundle-browser', root);
        const api = loadModule('support-bundle-telemetry', root).createApi();
        const before = coordinator.getDiagnostics().types.vm;
        assert.equal(before.lastError, message, 'UI error feedback remains available');
        assert.equal(before.failures, 1);
        const sanitized = api.collectSupportBundleUiTelemetry({ bundleMeta: { privacyMode: 'sanitized' } });
        const serialized = JSON.stringify(sanitized);
        for (const secret of message.split(' ')) assert.equal(serialized.includes(secret), false, secret);
        const safe = sanitized.uiTelemetry.clientStorage.preferenceSaves.types.vm;
        assert.notEqual(safe.lastError, message);
        for (const key of ['status', 'pending', 'pendingFieldCount', 'revision', 'requests', 'failures', 'commits']) {
            assert.equal(safe[key], before[key], key);
        }
        assert.equal(sanitized.redactionManifest.privacySelfCheck.status, 'passed');
        const failedCheck = api.collectSupportBundleUiTelemetry({
            bundleMeta: { privacyMode: 'sanitized' },
            uiTelemetry: { negativeControl: { name: 'unredacted-negative-control' } }
        });
        assert.equal(failedCheck.redactionManifest.privacySelfCheck.status, 'failed');
        for (const secret of message.split(' ')) assert.equal(JSON.stringify(failedCheck).includes(secret), false);
        assert.equal(coordinator.getDiagnostics().types.vm.lastError, message);
        const full = api.collectSupportBundleUiTelemetry({ bundleMeta: { privacyMode: 'full' } });
        assert.equal(full.uiTelemetry.clientStorage.preferenceSaves.types.vm.lastError, message);
    });
}
