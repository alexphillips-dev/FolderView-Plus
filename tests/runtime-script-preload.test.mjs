import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const scripts = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/';
const source = (file) => fs.readFileSync(scripts + file, 'utf8');
const turn = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };
const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};
const createDocument = ({ supported = true, throwHint = false } = {}) => {
    const nodes = [];
    const document = {
        nodes, readyState: 'complete',
        get scripts() { return nodes.filter((node) => node.tagName === 'SCRIPT'); },
        querySelector: () => document.scripts.find((node) => node.dataset.fvplusDockerRuntime === 'true') || null,
        querySelectorAll: () => [],
        createElement: (tag) => ({
            tagName: tag.toUpperCase(), dataset: {}, events: {}, relList: { supports: () => supported },
            addEventListener(event, callback) { this.events[event] = callback; },
            remove() { const index = nodes.indexOf(this); if (index >= 0) nodes.splice(index, 1); }
        }),
        head: { appendChild(node) {
            if (node.tagName === 'LINK' && throwHint) throw new Error('Synthetic hint rejection');
            nodes.push(node);
        } }
    };
    return document;
};
const hints = (document) => document.nodes.filter((node) => node.tagName === 'LINK');
const loaded = (node) => { node.onload?.(); node.events.load?.(); };
const bootstrap = (document, overrides = {}) => {
    const listeners = {};
    const window = {
        document,
        FolderViewPlusDockerRuntimeAssetUrl: 'https://fixture.test/docker.js?v=version',
        FolderViewPlusDockerHostCompatibilityDecision: { runtimeActivationAllowed: true },
        addEventListener: (event, callback) => { listeners[event] = callback; },
        ...overrides
    };
    vm.runInNewContext(source('docker.bootstrap.js'), { window });
    return { window, listeners, ready: window.FolderViewPlusDockerBootstrapPromise };
};

test('Docker preloads during preparation but executes only after providers and custom scripts', async () => {
    const document = createDocument(), provider = deferred(), custom = deferred();
    let customStarted = false;
    const { ready } = bootstrap(document, {
        FolderViewPlusDockerProviders: { getDefaultRegistry: () => ({ prepare: () => provider.promise }) },
        FolderViewPlusDockerLoadCustomScripts: () => { customStarted = true; return custom.promise; }
    });
    assert.equal(hints(document).length, 1);
    assert.equal(hints(document)[0].href, 'https://fixture.test/docker.js?v=version');
    assert.equal(hints(document)[0].as, 'script');
    assert.equal(document.scripts.length, 0);
    provider.resolve(); await turn();
    assert.equal(customStarted, true);
    assert.equal(document.scripts.length, 0);
    custom.resolve(); await turn();
    assert.equal(document.scripts.length, 1);
    loaded(document.scripts[0]);
    assert.equal((await ready).loaded, true);
    assert.equal(hints(document).length, 0);
});

test('Docker pagehide removes hints and prevents execution while preparation is pending', async () => {
    const document = createDocument(), provider = deferred();
    const { ready, listeners } = bootstrap(document, {
        FolderViewPlusDockerProviders: { getDefaultRegistry: () => ({ prepare: () => provider.promise }) }
    });
    assert.equal(hints(document).length, 1);
    listeners.pagehide();
    assert.equal(hints(document).length, 0);
    provider.resolve();
    assert.equal((await ready).reason, 'page-exited');
    assert.equal(document.scripts.length, 0);
});

test('Docker safe mode does not fetch hints and preparation failures clean them', async () => {
    const safe = createDocument();
    const safeRun = bootstrap(safe, { FolderViewPlusDockerHostCompatibilityDecision: { runtimeActivationAllowed: false } });
    assert.equal((await safeRun.ready).reason, 'compatibility-safe-mode');
    assert.equal(safe.nodes.length, 0);
    const document = createDocument(), provider = deferred();
    const run = bootstrap(document, {
        FolderViewPlusDockerProviders: { getDefaultRegistry: () => ({ prepare: () => provider.promise }) }
    });
    const rejected = assert.rejects(run.ready, /Synthetic preparation failure/);
    provider.reject(new Error('Synthetic preparation failure')); await rejected;
    assert.equal(hints(document).length, 0);
    assert.equal(document.scripts.length, 0);
});

test('Docker keeps the post-custom-script runtime URL authoritative and cleans failed loads', async () => {
    const document = createDocument();
    const run = bootstrap(document, {
        FolderViewPlusDockerLoadCustomScripts: () => {
            run.window.FolderViewPlusDockerRuntimeAssetUrl = 'https://fixture.test/custom-runtime.js?v=version';
        }
    });
    await turn();
    assert.equal(document.scripts[0].src, 'https://fixture.test/custom-runtime.js?v=version');
    const rejected = assert.rejects(run.ready, /Docker runtime could not be loaded/);
    document.scripts[0].onerror(); await rejected;
    assert.equal(hints(document).length, 0);
});

for (const options of [{ supported: false }, { throwHint: true }]) {
    test(`Docker optional preload fallback preserves runtime loading: ${JSON.stringify(options)}`, async () => {
        const document = createDocument(options), { ready } = bootstrap(document);
        await turn();
        loaded(document.scripts[0]);
        assert.equal((await ready).loaded, true);
        assert.equal(hints(document).length, 0);
    });
}

test('Dashboard hints stay demand-only and concurrent requests share ordered execution and retry', async () => {
    const document = createDocument();
    const window = {
        location: { href: 'https://fixture.test/Dashboard' },
        FolderViewPlusAssetUrls: { chartStack: ['https://fixture.test/chart.js?v=version', 'https://fixture.test/adapter.js?v=version'] }
    };
    vm.runInNewContext(source('runtime.asset-loader.js'), { window, document, URL });
    const api = window.FolderViewPlusAssetLoader;
    assert.equal(document.nodes.length, 0);
    const first = api.ensureChartStack(), second = api.ensureChartStack();
    const failures = [assert.rejects(first, /Failed to load/), assert.rejects(second, /Failed to load/)];
    assert.ok(hints(document).some((node) => node.href.endsWith('/adapter.js?v=version')));
    assert.equal(api.pendingCount(), 0, 'hint downloads are not script executions');
    await turn();
    assert.equal(document.scripts.length, 1);
    window.Chart = function Chart() {};
    loaded(document.scripts[0]); await turn();
    assert.equal(document.scripts.length, 2);
    document.scripts[1].events.error(); await Promise.all(failures);
    assert.equal(hints(document).length, 0);
    assert.equal(api.pendingCount(), 1, 'the successful Chart asset stays reusable');
    const retry = api.ensureChartStack(), concurrentRetry = api.ensureChartStack();
    const retryHint = hints(document)[0].href;
    assert.equal(retryHint, 'https://fixture.test/adapter.js?v=version&fv_retry=1');
    await turn();
    assert.equal(document.scripts.length, 2, 'only the failed adapter is inserted again');
    assert.equal(document.scripts[1].src, retryHint, 'the authoritative retry must reuse its preload cache key');
    loaded(document.scripts[1]);
    assert.equal(await retry, window.Chart);
    assert.equal(await concurrentRetry, window.Chart);
    assert.equal(hints(document).length, 0);
});

test('lazy asset retries advance the failed URL while preserving version, fragment and successful deduplication', async () => {
    const document = createDocument(), window = { location: { href: 'https://fixture.test/Dashboard' } };
    vm.runInNewContext(source('runtime.asset-loader.js'), { window, document, URL });
    const api = window.FolderViewPlusAssetLoader;
    const original = 'https://fixture.test/adapter.js?v=version#module';
    for (let attempt = 0; attempt < 3; attempt++) {
        const ready = api.loadSequential([original]);
        const expected = attempt ? `https://fixture.test/adapter.js?v=version&fv_retry=${attempt}#module` : original;
        assert.equal(hints(document)[0].href, expected);
        await turn();
        assert.equal(document.scripts.length, 1);
        assert.equal(document.scripts[0].src, expected);
        assert.equal(api.loadScript(original), api.loadScript(original), 'concurrent callers share the original URL key');
        if (attempt < 2) {
            const rejected = assert.rejects(ready, /Failed to load/);
            document.scripts[0].events.error();
            await rejected;
            assert.equal(api.pendingCount(), 0);
        } else {
            loaded(document.scripts[0]);
            await ready;
            await api.loadScript(original);
            assert.equal(document.scripts.length, 1, 'a successful retry stays reusable through the original URL');
        }
        assert.equal(hints(document).length, 0);
    }
});

for (const options of [{ supported: false }, { throwHint: true }]) {
    test(`Dashboard optional preload fallback preserves dependency order: ${JSON.stringify(options)}`, async () => {
        const document = createDocument(options), window = { location: { href: 'https://fixture.test/Dashboard' } };
        vm.runInNewContext(source('runtime.asset-loader.js'), { window, document, URL });
        const ready = window.FolderViewPlusAssetLoader.loadSequential(['https://fixture.test/first.js', 'https://fixture.test/second.js']);
        await turn(); assert.equal(document.scripts.length, 1);
        loaded(document.scripts[0]); await turn();
        assert.equal(document.scripts[1].src, 'https://fixture.test/second.js');
        loaded(document.scripts[1]); await ready;
        assert.equal(hints(document).length, 0);
    });
}
