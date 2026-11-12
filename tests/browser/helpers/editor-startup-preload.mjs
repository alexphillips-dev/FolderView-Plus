import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.runtime-bootstrap.js', 'utf8');
const queue = [...source.match(/const scriptQueue = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+\.js)'/g)].map(match => match[1]);

export const verifyEditorStartupPreload = async (page, baseUrl) => {
    const url = `${baseUrl}/editor-startup-preload`;
    const assets = /\/plugins\/folderview\.plus\/scripts\/[^/?]+\.js\?v=preload-fixture$/;
    const requested = [];
    let releaseFirst, hierarchyRequested = false, firstFinished = false, overlapObserved = false;
    const secondRequest = new Promise(resolve => { releaseFirst = resolve; });
    await page.route(url, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Editor startup</title></head><body><main><h1>Editor startup</h1></main></body></html>' }));
    await page.route(assets, async route => {
        const path = new URL(route.request().url()).pathname;
        requested.push(path);
        if (path === queue[1]) { hierarchyRequested = true; overlapObserved = !firstFinished; releaseFirst(); }
        // Without overlapping downloads, the first script cannot finish and the
        // ordered loader never requests the second. No elapsed-time assertion is used.
        if (path === queue[0]) { await secondRequest; firstFinished = true; }
        await route.fulfill({ contentType: 'text/javascript', headers: { 'Cache-Control': 'public, max-age=3600' },
            body: `window.fixtureStartupExecution.push(${JSON.stringify(path)});${path === queue.at(-1) ? 'window.FolderViewPlusFolderEditorRuntimeLoaded=true;' : ''}` });
    });
    try {
        await page.goto(url);
        await page.evaluate(() => {
            window.fixtureStartupExecution = [];
            window.FolderViewPlusFolderEditorPageBuildVersion = 'preload-fixture';
        });
        await page.addScriptTag({ content: source });
        await page.waitForFunction(() => window.FolderViewPlusFolderEditorRuntimeLoaded === true
            && document.querySelectorAll('link[data-fv-folder-editor-boot-preload]').length === 0);
        const execution = await page.evaluate(() => window.fixtureStartupExecution);
        assert.equal(hierarchyRequested, true, 'the next script downloads while the first response is held');
        assert.equal(overlapObserved, true, 'the second request precedes completion of the first response');
        assert.deepEqual(execution, queue, 'preloaded scripts execute once in dependency order');
        assert.deepEqual([...new Set(requested)].sort(), [...queue].sort(), 'all runtime assets are requested');
        assert.equal(await page.locator('script[data-fv-folder-editor-boot-managed="1"]').count(), queue.length);
        assert.equal(await page.locator('link[data-fv-folder-editor-boot-preload]').count(), 0, 'preload hints are cleaned up');
    } finally {
        releaseFirst();
        await page.unroute(assets);
        await page.unroute(url);
    }
};
