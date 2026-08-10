import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const loaderPath = path.join(
    repoRoot,
    'src',
    'folderview.plus',
    'usr',
    'local',
    'emhttp',
    'plugins',
    'folderview.plus',
    'scripts',
    'folderviewplus.settings-loader.js'
);
const loaderSource = fs.readFileSync(loaderPath, 'utf8');

test('settings loader preserves dependency order across foundation and deferred workspace stages', async () => {
    const appended = [];
    const actions = [];
    const document = {
        createElement: () => {
            const listeners = {};
            return {
                dataset: {},
                addEventListener: (name, handler) => { listeners[name] = handler; },
                _listeners: listeners
            };
        },
        head: {
            append: (script) => {
                appended.push({ src: script.src, stage: script.dataset.fvplusSettingsStage });
                queueMicrotask(() => script._listeners.load());
            }
        }
    };
    const window = {
        document,
        FolderViewPlusSettingsLoaderManifest: {
            foundation: ['/one.js', '/two.js'],
            workspace: ['/three.js', '/main.js']
        },
        FolderViewPlusFatalBanner: {
            recordAction: (value) => actions.push(value),
            markStep: () => {},
            setPhase: () => {}
        },
        addEventListener: () => {},
        removeEventListener: () => {},
        requestIdleCallback: (callback) => callback(),
        setTimeout
    };
    window.window = window;
    vm.runInNewContext(loaderSource, {
        window,
        globalThis: window,
        Promise,
        Object,
        Date,
        Error,
        String,
        queueMicrotask
    }, { filename: loaderPath });

    const result = await window.FolderViewPlusSettingsLoader.ready;
    assert.deepEqual(
        appended.map(({ src, stage }) => [src, stage]),
        [
            ['/one.js', 'foundation'],
            ['/two.js', 'foundation'],
            ['/three.js', 'workspace'],
            ['/main.js', 'workspace']
        ]
    );
    assert.equal(result.loadedCount, 4);
    assert.deepEqual(actions, [
        'Load Settings foundation modules',
        'Load deferred Settings workspace modules',
        'Loaded staged Settings runtime'
    ]);
});

test('settings loader reports a fatal module-load failure and rejects readiness', async () => {
    const reported = [];
    const document = {
        createElement: () => {
            const listeners = {};
            return {
                dataset: {},
                addEventListener: (name, handler) => { listeners[name] = handler; },
                _listeners: listeners
            };
        },
        head: {
            append: (script) => queueMicrotask(() => script._listeners.error())
        }
    };
    const window = {
        document,
        FolderViewPlusSettingsLoaderManifest: {
            foundation: ['/missing.js'],
            workspace: []
        },
        FolderViewPlusFatalBanner: {
            recordAction: () => {},
            markStep: () => {},
            setPhase: () => {},
            reportFatalError: (error, options) => reported.push({ error, options })
        },
        addEventListener: () => {},
        removeEventListener: () => {},
        setTimeout
    };
    window.window = window;
    vm.runInNewContext(loaderSource, {
        window,
        globalThis: window,
        Promise,
        Object,
        Date,
        Error,
        String,
        queueMicrotask
    }, { filename: loaderPath });

    await assert.rejects(window.FolderViewPlusSettingsLoader.ready, /Failed to load Settings module/);
    assert.equal(reported.length, 1);
    assert.equal(reported[0].options.code, 'FVPLUS-SET-LOADER-001');
    assert.equal(window.FolderViewPlusSettingsLoader.snapshot().phase, 'failed');
});

test('settings loader retries only the failed module and resumes the remaining queue', async () => {
    const appended = [];
    const moduleEvents = [];
    let firstAttempt = true;
    let retryHandler = null;
    const document = {
        createElement: () => {
            const listeners = {};
            return {
                dataset: {},
                addEventListener: (name, handler) => { listeners[name] = handler; },
                remove() {},
                _listeners: listeners
            };
        },
        head: {
            append: (script) => {
                appended.push(script.src);
                queueMicrotask(() => {
                    if (firstAttempt) {
                        firstAttempt = false;
                        script._listeners.error();
                    } else {
                        script._listeners.load();
                    }
                });
            }
        }
    };
    const window = {
        document,
        location: { href: 'https://tower.local/Settings/FolderViewPlus', origin: 'https://tower.local' },
        FolderViewPlusSettingsLoaderManifest: {
            foundation: ['/one.js'],
            workspace: ['/two.js']
        },
        FolderViewPlusFatalBanner: {
            recordAction: () => {},
            markStep: () => {},
            setPhase: () => {},
            reportFatalError: () => {},
            classifyError: () => 'missing-asset',
            recordModuleEvent: (entry) => moduleEvents.push(entry),
            registerRecoveryHandler: (_name, handler) => { retryHandler = handler; }
        },
        addEventListener: () => {},
        removeEventListener: () => {},
        requestIdleCallback: (callback) => callback(),
        setTimeout,
        clearTimeout,
        performance: { getEntriesByName: () => [] }
    };
    window.window = window;
    vm.runInNewContext(loaderSource, {
        window,
        globalThis: window,
        Promise,
        Object,
        Date,
        Error,
        String,
        Number,
        URL,
        queueMicrotask
    }, { filename: loaderPath });

    await assert.rejects(window.FolderViewPlusSettingsLoader.ready, /Failed to load Settings module/);
    assert.equal(typeof retryHandler, 'function');
    const result = await retryHandler();
    assert.equal(result.loadedCount, 2);
    assert.equal(result.retryCount, 1);
    assert.equal(appended.length, 3);
    assert.match(appended[1], /one\.js\?fv_retry=1$/);
    assert.equal(appended[2], '/two.js');
    assert.equal(moduleEvents.some((entry) => entry.outcome === 'failed'), true);
    assert.equal(moduleEvents.some((entry) => entry.retry === true && entry.outcome === 'loaded'), true);
});

test('settings loader identifies a stalled module with a bounded timeout', async () => {
    const reported = [];
    const moduleEvents = [];
    const document = {
        createElement: () => ({
            dataset: {},
            addEventListener() {},
            remove() {}
        }),
        head: { append() {} }
    };
    const window = {
        document,
        FolderViewPlusSettingsLoaderManifest: {
            moduleTimeoutMs: 1000,
            foundation: ['/stalled.js'],
            workspace: []
        },
        FolderViewPlusFatalBanner: {
            recordAction: () => {},
            markStep: () => {},
            setPhase: () => {},
            reportFatalError: (error, options) => reported.push({ error, options }),
            classifyError: () => 'asset-timeout',
            recordModuleEvent: (entry) => moduleEvents.push(entry),
            registerRecoveryHandler: () => {}
        },
        addEventListener: () => {},
        removeEventListener: () => {},
        setTimeout: (handler) => { queueMicrotask(handler); return 1; },
        clearTimeout: () => {}
    };
    window.window = window;
    vm.runInNewContext(loaderSource, {
        window,
        globalThis: window,
        Promise,
        Object,
        Date,
        Error,
        String,
        Number,
        URL,
        queueMicrotask
    }, { filename: loaderPath });

    await assert.rejects(window.FolderViewPlusSettingsLoader.ready, /timed out after 1000 ms/);
    assert.equal(reported[0].options.category, 'asset-timeout');
    assert.equal(moduleEvents.some((entry) => entry.outcome === 'timed-out'), true);
    assert.equal(window.FolderViewPlusSettingsLoader.snapshot().currentModule, 'stalled.js');
});
