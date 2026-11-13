import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js', 'utf8');
const start = source.indexOf('let releaseInitialSettingsHydration =');
const end = source.indexOf('const downloadType =', start);
const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};
const flush = () => new Promise(resolve => setImmediate(resolve));
const createHarness = () => {
    const locale = deferred(), docker = deferred(), vmRuntime = deferred(), tasks = [], events = [], localeTimers = new Map();
    let timerId = 0;
    locale.promise.catch(() => {});
    const window = { FolderViewPlusI18n: { ready: locale.promise },
        setTimeout: (callback, delay) => {
            const id = ++timerId;
            if (delay === 0) tasks.push(callback);
            else { assert.equal(delay, 5000); localeTimers.set(id, callback); }
            return id;
        }, clearTimeout: id => { localeTimers.delete(id); } };
    const context = vm.createContext({ window, runtimeHydrationStateByType: {}, settingsUiState: { initialized: false },
        perfNowMs: () => 0, getFolderMap: () => ({}), recordPerformanceDiagnosticsSample() {},
        fetchSettingsCombinedConfigSnapshots: async () => ({ snapshots: { docker: {}, vm: {} } }),
        refreshType: (type, options) => {
            events.push(`${options?.configOnly ? 'config' : 'runtime'}:${type}`);
            return options?.configOnly ? Promise.resolve({ degradedReasons: [] })
                : (type === 'docker' ? docker.promise : vmRuntime.promise);
        }, renderTable() {}, ensureRegexPresetUi() {}, toggleRuleKindFields() {}, updateRuleLiveMatch() {},
        refreshSettingsUx() {}, buildSettingsBootstrapDegradedReason: () => 'failed',
        ensureAdvancedDataLoaded: async () => { events.push('advanced'); return []; } });
    assert.ok(start >= 0 && end > start);
    vm.runInContext(source.slice(start, end) + `
        globalThis.harness = { core: refreshCoreData, all: refreshAll,
            complete: ready => releaseInitialSettingsHydration?.(ready) };
    `, context);
    return { api: context.harness, window, locale, docker, vmRuntime, tasks, events, localeTimers,
        finishRuntime: () => { docker.resolve({ hasErrors: false }); vmRuntime.resolve({ hasErrors: false }); } };
};

test('initial hydration is published immediately but waits for both bootstrap and localization, then a task', async () => {
    const h = createHarness();
    const result = await h.api.core({ initialBootstrap: true });
    assert.equal(h.window.FolderViewPlusSettingsRuntimeHydrationPromise, result.runtimeHydrationPromise);
    assert.deepEqual(h.events, ['config:docker', 'config:vm']);
    h.locale.resolve(); await flush();
    assert.equal(h.tasks.length, 0, 'localization alone cannot release the initial bootstrap gate');
    h.api.complete(true); await flush();
    assert.deepEqual(h.events, ['config:docker', 'config:vm']);
    assert.equal(h.tasks.length, 1);
    assert.equal(h.localeTimers.size, 0, 'resolved localization clears the fallback timer');
    h.tasks.shift()(); await flush();
    assert.deepEqual(h.events, ['config:docker', 'config:vm', 'runtime:docker', 'runtime:vm']);
    h.finishRuntime();
    assert.deepEqual(Array.from(await result.runtimeHydrationPromise, value => value.status), ['fulfilled', 'fulfilled']);
});

test('a completed core bootstrap does not let runtime discovery overtake held localization', async () => {
    const h = createHarness();
    const result = await h.api.core({ initialBootstrap: true });
    h.api.complete(true); await flush();
    assert.deepEqual(h.events, ['config:docker', 'config:vm']);
    assert.equal(h.tasks.length, 0);
    assert.equal(h.localeTimers.size, 1);
    h.locale.resolve(); await flush();
    assert.equal(h.localeTimers.size, 0);
    h.tasks.shift()(); await flush();
    h.finishRuntime();
    await result.runtimeHydrationPromise;
    assert.deepEqual(h.events.slice(-2), ['runtime:docker', 'runtime:vm']);
});

test('localization fallback still releases initial runtime hydration', async () => {
    const h = createHarness();
    const result = await h.api.core({ initialBootstrap: true });
    h.api.complete(true); await flush();
    assert.equal(h.localeTimers.size, 1);
    h.locale.reject(new Error('Synthetic catalog failure')); await flush();
    assert.equal(h.tasks.length, 1);
    assert.equal(h.localeTimers.size, 0, 'rejected localization clears the fallback timer');
    h.tasks.shift()(); await flush();
    h.finishRuntime();
    assert.equal((await result.runtimeHydrationPromise).every(value => value.status === 'fulfilled'), true);
});

test('never-configured localization cannot strand runtime discovery and late settlement does not restart it', async () => {
    const h = createHarness();
    const result = await h.api.core({ initialBootstrap: true });
    h.api.complete(true); await flush();
    assert.deepEqual(h.events, ['config:docker', 'config:vm']);
    assert.equal(h.tasks.length, 0);
    assert.equal(h.localeTimers.size, 1);
    [...h.localeTimers.values()][0](); await flush();
    assert.equal(h.localeTimers.size, 0);
    assert.equal(h.tasks.length, 1, 'timeout still yields one task before runtime discovery');
    h.locale.resolve(); await flush();
    assert.equal(h.tasks.length, 1, 'late localization settlement cannot schedule duplicate hydration');
    h.tasks.shift()(); await flush();
    assert.deepEqual(h.events, ['config:docker', 'config:vm', 'runtime:docker', 'runtime:vm']);
    h.finishRuntime();
    assert.deepEqual(Array.from(await result.runtimeHydrationPromise, value => value.status), ['fulfilled', 'fulfilled']);
});

test('failed bootstrap settles its hydration promise without rendering into failed UI', async () => {
    const h = createHarness();
    const result = await h.api.core({ initialBootstrap: true });
    h.api.complete(false);
    assert.deepEqual(Array.from(await result.runtimeHydrationPromise), []);
    assert.deepEqual(h.events, ['config:docker', 'config:vm']);
    assert.equal(h.tasks.length, 0, 'failure cannot wait forever on an unresolved localization promise');
    assert.equal(h.localeTimers.size, 0);
});

test('manual refreshes start runtime work immediately and await it independently of the initial gate', async () => {
    const h = createHarness();
    const initial = await h.api.core({ initialBootstrap: true });
    let settled = false;
    const manual = h.api.all().then(result => { settled = true; return result; });
    await flush();
    assert.deepEqual(h.events.slice(-2), ['runtime:docker', 'runtime:vm']);
    assert.equal(settled, false);
    assert.equal(h.tasks.length, 0);
    assert.equal(h.localeTimers.size, 0, 'manual refresh does not create a localization fallback timer');
    h.finishRuntime();
    await manual;
    assert.equal(h.events.at(-1), 'advanced');
    const diagnostics = await h.window.FolderViewPlusRefreshCoreData();
    assert.ok(diagnostics.runtimeHydrationPromise);
    h.api.complete(false); await initial.runtimeHydrationPromise;
});

test('the actual initializer owns the gate and releases it in finally on success or failure', () => {
    assert.match(source, /const result = await refreshCoreData\(\{ initialBootstrap: true \}\);/);
    assert.match(source, /finally \{\s*const release = releaseInitialSettingsHydration;\s*releaseInitialSettingsHydration = null;\s*const state = window\.FolderViewPlusSettingsBootstrapState;\s*release\?\.\(state\?\.ready === true && state\.failed !== true\);/);
});
