import assert from 'node:assert/strict';
import fs from 'node:fs';

export const runtimeSource = (name) => fs.readFileSync(`src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/${name}`, 'utf8');
export const preparePreloadPage = async (page, baseUrl, name) => {
    const url = `${baseUrl}/script-preloads-${name}`;
    await page.route(url, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Script loading</title></head><body><main><h1>Script loading</h1></main></body></html>' }));
    await page.goto(url);
    await page.evaluate(() => { window.fixtureScriptExecution = []; });
};
const scriptResponse = (body) => ({ contentType: 'text/javascript', headers: { 'Cache-Control': 'public, max-age=3600' }, body });

export const verifySettingsPreloads = async ({ page, baseUrl }) => {
    await preparePreloadPage(page, baseUrl, 'settings');
    const requests = [];
    let releaseFirst, firstFinished = false, overlap = false;
    const secondRequested = new Promise(resolve => { releaseFirst = resolve; });
    await page.route('**/preload-assets/settings-*.js*', async route => {
        const name = new URL(route.request().url()).pathname.split('/').pop();
        requests.push(name);
        if (name === 'settings-b.js') { overlap ||= !firstFinished; releaseFirst(); }
        if (name === 'settings-a.js') { await secondRequested; firstFinished = true; }
        await route.fulfill(scriptResponse(`window.fixtureScriptExecution.push(${JSON.stringify(name)});`));
    });
    try {
        await page.evaluate(() => {
            window.FolderViewPlusSettingsLoaderManifest = {
                foundation: ['/preload-assets/settings-a.js?v=fixture', '/preload-assets/settings-b.js?v=fixture'],
                workspace: ['/preload-assets/settings-c.js?v=fixture', '/preload-assets/settings-d.js?v=fixture']
            };
            window.requestIdleCallback = callback => { window.fixtureReleaseIdle = callback; };
        });
        await page.addScriptTag({ content: runtimeSource('folderviewplus.settings-loader.js') });
        await page.waitForFunction(() => window.fixtureScriptExecution.length === 2 && typeof window.fixtureReleaseIdle === 'function');
        assert.equal(overlap, true, 'foundation downloads must overlap before ordered execution');
        assert.deepEqual(requests.filter(name => /settings-[cd]/.test(name)), [], 'workspace downloads wait for its idle opportunity');
        assert.equal(await page.locator('link[rel="preload"][as="script"]').count(), 0, 'finished foundation hints are released before idle');
        await page.evaluate(() => window.fixtureReleaseIdle());
        await page.evaluate(() => window.FolderViewPlusSettingsLoader.ready);
        assert.deepEqual(await page.evaluate(() => window.fixtureScriptExecution), ['settings-a.js', 'settings-b.js', 'settings-c.js', 'settings-d.js']);
        assert.equal(await page.locator('link[rel="preload"][as="script"]').count(), 0);
    } finally { releaseFirst(); }

    await preparePreloadPage(page, baseUrl, 'settings-retry');
    let failing = true;
    await page.route('**/preload-assets/retry-*.js*', async route => {
        const name = new URL(route.request().url()).pathname.split('/').pop();
        if (failing && name === 'retry-b.js') return route.fulfill({ status: 503, body: '' });
        await route.fulfill(scriptResponse(`window.fixtureScriptExecution.push(${JSON.stringify(name)});`));
    });
    await page.evaluate(() => {
        window.fixturePreloadHistory = [];
        new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
            if (node.tagName === 'LINK' && node.rel === 'preload') window.fixturePreloadHistory.push(node.href);
        }))).observe(document.head, { childList: true });
        window.FolderViewPlusSettingsLoaderManifest = {
            foundation: ['a', 'b', 'c'].map(name => `/preload-assets/retry-${name}.js?v=fixture`), workspace: []
        };
    });
    await page.addScriptTag({ content: runtimeSource('folderviewplus.settings-loader.js') });
    const failure = await page.evaluate(() => window.FolderViewPlusSettingsLoader.ready.then(() => '', error => error.message));
    assert.match(failure, /retry-b/);
    assert.deepEqual(await page.evaluate(() => window.fixtureScriptExecution), ['retry-a.js']);
    assert.equal(await page.locator('link[rel="preload"][as="script"]').count(), 0, 'failed-stage hints are released');
    failing = false;
    await page.evaluate(() => window.FolderViewPlusSettingsLoader.retry());
    const result = await page.evaluate(() => ({
        execution: window.fixtureScriptExecution, hints: window.fixturePreloadHistory,
        retry: document.querySelector('script[data-fvplus-settings-attempt="retry"]').src
    }));
    assert.deepEqual(result.execution, ['retry-a.js', 'retry-b.js', 'retry-c.js'], 'retry resumes at failure without repeating successful modules');
    assert.match(result.retry, /retry-b\.js\?v=fixture&fv_retry=1$/);
    assert.ok(result.hints.includes(result.retry), 'retry preload must use the authoritative retry URL');
    assert.equal(result.hints.some(url => /retry-[ac]\.js.*fv_retry/.test(url)), false);
    assert.equal(await page.locator('link[rel="preload"][as="script"]').count(), 0);
};

export const verifyDashboardPreloads = async ({ page, baseUrl }) => {
    await preparePreloadPage(page, baseUrl, 'dashboard');
    const requests = [];
    let releaseFirst, releaseAdapter, firstFinished = false, overlap = false;
    const adapterRequested = new Promise(resolve => { releaseFirst = resolve; });
    const adapterGate = new Promise(resolve => { releaseAdapter = resolve; });
    await page.route('**/preload-assets/chart-*.js*', async route => {
        const name = new URL(route.request().url()).pathname.split('/').pop();
        requests.push(name);
        if (name === 'chart-adapter.js') { overlap ||= !firstFinished; releaseFirst(); await adapterGate; }
        if (name === 'chart-core.js') { await adapterRequested; firstFinished = true; }
        await route.fulfill(scriptResponse(`window.fixtureScriptExecution.push(${JSON.stringify(name)});${name === 'chart-core.js' ? 'window.Chart = function Chart() {};' : 'if(typeof window.Chart!=="function")throw new Error("Chart dependency missing");'}`));
    });
    try {
        await page.evaluate(() => {
            window.FolderViewPlusAssetUrls = { chartStack: ['core', 'adapter', 'stream'].map(name => `/preload-assets/chart-${name}.js?v=fixture`) };
        });
        await page.addScriptTag({ content: runtimeSource('runtime.asset-loader.js') });
        assert.deepEqual(requests, [], 'chart stack stays unloaded until a graph is requested');
        assert.equal(await page.locator('link[rel="preload"][as="script"], script[data-fvplus-lazy-asset]').count(), 0);
        await page.evaluate(() => { window.fixtureFirstChart = window.FolderViewPlusAssetLoader.ensureChartStack(); });
        await page.waitForFunction(() => typeof window.Chart === 'function');
        await page.evaluate(() => {
            window.fixtureSecondChartDone = false;
            window.fixtureSecondChart = window.FolderViewPlusAssetLoader.ensureChartStack().then(() => { window.fixtureSecondChartDone = true; });
        });
        assert.equal(overlap, true, 'adapter fetching begins before the held core response finishes');
        assert.equal(await page.evaluate(() => window.fixtureSecondChartDone), false, 'Chart availability cannot bypass unfinished adapters');
        releaseAdapter();
        await page.evaluate(() => Promise.all([window.fixtureFirstChart, window.fixtureSecondChart]));
        assert.deepEqual(await page.evaluate(() => window.fixtureScriptExecution), ['chart-core.js', 'chart-adapter.js', 'chart-stream.js']);
        assert.equal(await page.locator('link[rel="preload"][as="script"]').count(), 0);
    } finally { releaseFirst(); releaseAdapter(); }

    await preparePreloadPage(page, baseUrl, 'dashboard-retry');
    let failing = true;
    await page.route('**/preload-assets/retry-chart-*.js*', async route => {
        const name = new URL(route.request().url()).pathname.split('/').pop();
        if (failing && name === 'retry-chart-adapter.js') return route.fulfill({ status: 503, body: '' });
        await route.fulfill(scriptResponse(`window.fixtureScriptExecution.push(${JSON.stringify(name)});${name === 'retry-chart-core.js' ? 'window.Chart=function Chart(){};' : ''}`));
    });
    await page.evaluate(() => { window.FolderViewPlusAssetUrls = { chartStack: ['core', 'adapter'].map(name => `/preload-assets/retry-chart-${name}.js?v=fixture`) }; });
    await page.addScriptTag({ content: runtimeSource('runtime.asset-loader.js') });
    const failure = await page.evaluate(() => window.FolderViewPlusAssetLoader.ensureChartStack().then(() => '', error => error.message));
    assert.match(failure, /retry-chart-adapter/);
    assert.equal(await page.locator('link[rel="preload"][as="script"]').count(), 0);
    failing = false;
    await page.evaluate(() => window.FolderViewPlusAssetLoader.ensureChartStack());
    assert.deepEqual(await page.evaluate(() => window.fixtureScriptExecution), ['retry-chart-core.js', 'retry-chart-adapter.js']);
    assert.equal(await page.locator('link[rel="preload"][as="script"]').count(), 0);
};
