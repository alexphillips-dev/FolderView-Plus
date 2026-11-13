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

const createPreloadLoaderHarness = (manifest, { supportsPreload = true, failHint = false } = {}) => {
    const scripts = [], hints = [], activeHints = new Set(), timers = [];
    let workspaceOpportunity;
    const document = {
        createElement: (tagName) => {
            const listeners = {};
            const node = {
                tagName, dataset: {}, relList: { supports: () => supportsPreload },
                addEventListener: (name, handler) => { listeners[name] = handler; },
                remove: () => activeHints.delete(node), _listeners: listeners
            };
            return node;
        },
        head: { append: (node) => {
            if (node.tagName === 'link') {
                hints.push(node); activeHints.add(node);
                if (failHint) throw new Error('Optional preload hint could not be appended');
            } else scripts.push(node);
        } }
    };
    const window = {
        document,
        location: { href: 'https://example.test/Settings/FolderViewPlus', origin: 'https://example.test' },
        FolderViewPlusSettingsLoaderManifest: manifest,
        addEventListener() {}, removeEventListener() {},
        requestIdleCallback: (handler) => { workspaceOpportunity = handler; },
        setTimeout: (handler) => { timers.push(handler); return { unref() {} }; }, clearTimeout() {}
    };
    vm.runInNewContext(loaderSource, { window, globalThis: window, URL }, { filename: loaderPath });
    return {
        scripts, hints, activeHints, timers, loader: window.FolderViewPlusSettingsLoader,
        releaseWorkspace: () => workspaceOpportunity()
    };
};
const flushLoaderTasks = () => new Promise(resolve => setImmediate(resolve));

test('settings preloads each stage before its first script completes and keeps workspace deferred', async () => {
    const harness = createPreloadLoaderHarness({
        foundation: ['/one.js?v=42', '/two.js?v=42'],
        workspace: ['/three.js?v=42', '/main.js?v=42']
    });
    const { scripts, hints, activeHints, loader } = harness;
    assert.deepEqual(hints.map(node => [node.href, node.rel, node.as, node.dataset.fvplusSettingsPreload]), [
        ['/one.js?v=42', 'preload', 'script', 'foundation'],
        ['/two.js?v=42', 'preload', 'script', 'foundation']
    ]);
    assert.deepEqual(scripts.map(node => node.src), ['/one.js?v=42'], 'prefetching must not execute later modules');
    scripts[0]._listeners.load(); await flushLoaderTasks();
    assert.deepEqual(scripts.map(node => node.src), ['/one.js?v=42', '/two.js?v=42']);
    scripts[1]._listeners.load(); await flushLoaderTasks();
    assert.equal(activeHints.size, 0, 'foundation hints are removed before waiting for workspace opportunity');
    assert.equal(hints.length, 2, 'workspace requests must wait for the stage boundary');
    harness.releaseWorkspace(); await flushLoaderTasks();
    assert.deepEqual(hints.slice(2).map(node => node.href), ['/three.js?v=42', '/main.js?v=42']);
    assert.deepEqual(scripts.map(node => node.src), ['/one.js?v=42', '/two.js?v=42', '/three.js?v=42']);
    scripts[2]._listeners.load(); await flushLoaderTasks();
    scripts[3]._listeners.load();
    assert.equal((await loader.ready).loadedCount, 4);
    assert.equal(activeHints.size, 0, 'successful startup cleans every preload hint');
    assert.equal(scripts.every(node => node.async === false), true);
});

test('settings retry preloads only remaining modules with the exact failed-attempt cache URL', async () => {
    const { scripts, hints, activeHints, loader } = createPreloadLoaderHarness({
        foundation: ['/one.js?v=42', '/two.js?v=42#module', '/three.js?v=42'], workspace: []
    });
    scripts[0]._listeners.load(); await flushLoaderTasks();
    scripts[1]._listeners.error();
    await assert.rejects(loader.ready, /Failed to load Settings module/);
    assert.equal(activeHints.size, 0, 'failure removes hints before retry');
    const retry = loader.retry();
    assert.deepEqual(hints.slice(3).map(node => node.href), ['/two.js?v=42&fv_retry=1#module', '/three.js?v=42']);
    assert.equal(scripts[2].src, hints[3].href, 'script and preload must use the same retry URL');
    scripts[2]._listeners.load(); await flushLoaderTasks();
    assert.equal(scripts[3].src, '/three.js?v=42', 'later modules retain their original versioned URL');
    scripts[3]._listeners.load();
    const result = await retry;
    assert.equal(result.loadedCount, 3);
    assert.equal(result.retryCount, 1);
    assert.equal(scripts.filter(node => node.src === '/one.js?v=42').length, 1, 'successful modules must not execute again');
    assert.equal(activeHints.size, 0);
});

for (const options of [{ supportsPreload: false }, { failHint: true }]) {
    test(`settings ordered startup tolerates optional preload failure ${JSON.stringify(options)}`, async () => {
        const { scripts, activeHints, loader } = createPreloadLoaderHarness({
            foundation: ['/one.js', '/two.js'], workspace: []
        }, options);
        assert.equal(scripts.length, 1);
        scripts[0]._listeners.load(); await flushLoaderTasks();
        assert.equal(scripts[1].src, '/two.js');
        scripts[1]._listeners.load();
        assert.equal((await loader.ready).loadedCount, 2);
        assert.equal(activeHints.size, 0);
    });
}

test('settings timeout cleans stage preload hints and retains the failed module for recovery', async () => {
    const { activeHints, timers, loader } = createPreloadLoaderHarness({ foundation: ['/stalled.js', '/later.js'], workspace: [] });
    assert.equal(activeHints.size, 2);
    timers[0]();
    await assert.rejects(loader.ready, /timed out/);
    assert.equal(activeHints.size, 0);
    assert.equal(loader.snapshot().currentModule, 'stalled.js');
    assert.equal(loader.snapshot().nextModule, 'stalled.js');
});
