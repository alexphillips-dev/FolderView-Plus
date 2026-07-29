import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const repoRoot = path.resolve(process.cwd());
const pluginRoot = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus'
);
const browserModulePath = path.join(pluginRoot, 'scripts/folderviewplus.support-bundle-browser.js');
const telemetryModulePath = path.join(pluginRoot, 'scripts/folderviewplus.support-bundle-telemetry.js');
const browserModuleSource = fs.readFileSync(browserModulePath, 'utf8');
const telemetryModuleSource = fs.readFileSync(telemetryModulePath, 'utf8');

const loadModule = (source, filename, root = {}) => {
    const context = {
        globalThis: root,
        module: { exports: {} },
        exports: {},
        URL,
        console
    };
    vm.runInNewContext(source, context, { filename });
    return context.module.exports;
};

const createStorage = () => {
    const values = new Map();
    return {
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            values.set(key, String(value));
        },
        removeItem(key) {
            values.delete(key);
        }
    };
};

const createDownloadRoot = () => {
    const storage = createStorage();
    const clicks = [];
    const revoked = [];
    const body = {
        appendChild(element) {
            element.parentNode = body;
        },
        removeChild(element) {
            element.parentNode = null;
        }
    };
    const root = {
        Blob,
        URL: {
            createObjectURL() {
                return 'blob:folderview-plus-test';
            },
            revokeObjectURL(value) {
                revoked.push(value);
            }
        },
        crypto: {
            randomUUID() {
                return `00000000-0000-4000-8000-${String(clicks.length + 1).padStart(12, '0')}`;
            }
        },
        localStorage: storage,
        navigator: {
            userActivation: {
                isActive: false,
                hasBeenActive: true
            }
        },
        document: {
            body,
            visibilityState: 'visible',
            hasFocus() {
                return true;
            },
            createElement(tagName) {
                assert.equal(tagName, 'a');
                return {
                    download: '',
                    href: '',
                    style: {},
                    parentNode: null,
                    click() {
                        clicks.push(this.download);
                    }
                };
            }
        },
        isSecureContext: true,
        setTimeout(callback) {
            callback();
        }
    };
    return { root, storage, clicks, revoked };
};

test('download diagnostics persist only bounded metadata and never export names or content', () => {
    const { root, storage, clicks, revoked } = createDownloadRoot();
    const browserModule = loadModule(browserModuleSource, browserModulePath, root);
    const api = browserModule.createDownloadDiagnostics();
    const attempt = api.dispatch({
        name: 'Private Docker Folder.json',
        content: '{"folderName":"private-container","path":"/mnt/user/private"}',
        context: {
            type: 'docker',
            mode: 'full',
            surface: 'settings',
            folderCount: 4,
            schemaVersion: 3
        }
    });

    assert.equal(attempt.lifecycle, 'download-dispatch-attempted');
    assert.equal(attempt.verdict.status, 'indeterminate');
    assert.equal(attempt.verdict.code, 'browser-save-unconfirmed');
    assert.equal(attempt.browser.userActivationActive, false);
    assert.equal(attempt.browser.downloadAttributeAvailable, true);
    assert.equal(attempt.payloadSizeBucket, 'under-100-kib');
    assert.deepEqual(clicks, ['Private Docker Folder.json']);
    assert.deepEqual(revoked, ['blob:folderview-plus-test']);

    const stored = storage.getItem(browserModule.DOWNLOAD_ATTEMPTS_STORAGE_KEY);
    assert.ok(stored);
    assert.equal(stored.includes('Private Docker Folder'), false);
    assert.equal(stored.includes('private-container'), false);
    assert.equal(stored.includes('/mnt/user/private'), false);
    assert.equal(stored.includes('"folderCount":4'), true);
});

test('missing-download reports and retries produce explicit diagnostic verdicts', () => {
    const { root } = createDownloadRoot();
    const browserModule = loadModule(browserModuleSource, browserModulePath, root);
    const api = browserModule.createDownloadDiagnostics();
    const first = api.dispatch({
        name: 'folders.json',
        content: '{}',
        context: { type: 'docker', mode: 'full', folderCount: 2, schemaVersion: 3 }
    });
    const missing = api.reportMissing(first.attemptId);

    assert.equal(missing.lifecycle, 'user-reported-missing');
    assert.equal(missing.verdict.status, 'probable-browser-restriction');
    assert.equal(missing.verdict.code, 'missing-without-active-user-gesture');

    root.navigator.userActivation.isActive = true;
    const retried = api.retry(first.attemptId);
    assert.equal(retried.ok, true);
    assert.equal(retried.attempt.fallback.used, true);
    assert.equal(retried.attempt.fallback.retryOf, first.attemptId);
    assert.equal(retried.attempt.browser.userActivationActive, true);

    const record = api.readRecord();
    assert.equal(record.attempts.length, 2);
    assert.equal(record.attempts[0].fallback.used, true);
    assert.equal(record.attempts[1].verdict.status, 'indeterminate');
});

test('synchronous download failures are captured and attached to the thrown error', () => {
    const { root } = createDownloadRoot();
    root.URL = {};
    const browserModule = loadModule(browserModuleSource, browserModulePath, root);
    const api = browserModule.createDownloadDiagnostics();

    assert.throws(() => api.dispatch({
        name: 'folders.json',
        content: '{}',
        context: { type: 'vm', mode: 'single', folderCount: 1, schemaVersion: 3 }
    }), (error) => {
        assert.equal(error.name, 'DownloadDispatchError');
        assert.equal(error.fvplusDownloadAttempt.lifecycle, 'synchronous-failure');
        assert.equal(error.fvplusDownloadAttempt.verdict.status, 'confirmed-failure');
        assert.equal(error.fvplusDownloadAttempt.verdict.code, 'object-url-unavailable');
        return true;
    });

    const record = api.readRecord();
    assert.equal(record.attempts.length, 1);
    assert.equal(record.attempts[0].exceptionName, 'DownloadDispatchError');
});

test('support bundle telemetry exports the normalized download-attempt summary', () => {
    const { root, storage } = createDownloadRoot();
    const browserModule = loadModule(browserModuleSource, browserModulePath, root);
    browserModule.createDownloadDiagnostics().dispatch({
        name: 'folders.json',
        content: '{}',
        context: { type: 'docker', mode: 'full', folderCount: 2, schemaVersion: 3 }
    });
    root.FolderViewPlusSupportBundleBrowser = browserModule;
    const telemetryModule = loadModule(telemetryModuleSource, telemetryModulePath, root);
    const api = telemetryModule.createApi({
        normalizeSupportBundleV2Payload: (bundle) => ({
            ...bundle,
            bundleMeta: { ...(bundle.bundleMeta || {}) },
            uiTelemetry: { ...(bundle.uiTelemetry || {}) },
            healthAndHistory: { ...(bundle.healthAndHistory || {}) },
            redactionManifest: { ...(bundle.redactionManifest || {}) }
        }),
        readClientDiagnosticsStorageRecord(key) {
            const raw = storage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        },
        storageKeys: {
            downloadAttempts: browserModule.DOWNLOAD_ATTEMPTS_STORAGE_KEY
        }
    });
    const payload = api.collectSupportBundleUiTelemetry({
        bundleMeta: {
            privacyMode: 'sanitized',
            pluginVersion: 'test'
        }
    });

    assert.equal(payload.uiTelemetry.downloadAttempts.available, true);
    assert.equal(payload.uiTelemetry.downloadAttempts.count, 1);
    assert.equal(payload.uiTelemetry.downloadAttempts.indeterminateCount, 1);
    assert.equal(payload.uiTelemetry.downloadAttempts.confirmedFailureCount, 0);
    assert.equal(payload.uiTelemetry.downloadAttempts.latestVerdict.code, 'browser-save-unconfirmed');
    assert.equal(JSON.stringify(payload.uiTelemetry.downloadAttempts).includes('folders.json'), false);
});

test('settings exports expose an inline missing-download recovery surface', () => {
    const page = fs.readFileSync(path.join(pluginRoot, 'FolderViewPlus.page'), 'utf8');
    const importScript = fs.readFileSync(path.join(pluginRoot, 'scripts/folderviewplus.import.js'), 'utf8');
    const runtime = fs.readFileSync(path.join(pluginRoot, 'scripts/folderviewplus.js'), 'utf8');
    const branchRuntime = fs.readFileSync(path.join(pluginRoot, 'scripts/folderviewplus.runtime-actions.js'), 'utf8');

    assert.match(page, /folderviewplus\.download-diagnostics\.css/);
    assert.match(importScript, /h2\[data-fv-section=/);
    assert.match(importScript, /role="status" aria-live="polite"/);
    assert.match(importScript, /Download didn’t start/);
    assert.match(importScript, /reportMissing\(attempt\.attemptId\)/);
    assert.match(importScript, /retry\(attempt\.attemptId\)/);
    assert.match(runtime, /Export download requested\./);
    assert.match(runtime, /buildDownloadDiagnosticsEventDetails\(downloadAttempt\)/);
    assert.match(branchRuntime, /mode:\s*'branch'[\s\S]*buildDownloadDiagnosticsEventDetails\(downloadAttempt\)/);
});
