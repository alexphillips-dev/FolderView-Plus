import assert from 'node:assert/strict';
import { preparePreloadPage, runtimeSource } from './script-preloads.mjs';

export const verifyDockerPreload = async ({ page, baseUrl }) => {
    for (const scenario of ['normal', 'safe-mode', 'page-exit', 'override']) {
        await preparePreloadPage(page, baseUrl, `docker-${scenario}`);
        const requested = [];
        const initialPath = `/preload-assets/docker-${scenario}-initial.js`;
        const overridePath = `/preload-assets/docker-${scenario}-override.js`;
        const preloadRequested = scenario === 'safe-mode' ? null : page.waitForRequest(request => new URL(request.url()).pathname === initialPath);
        preloadRequested?.catch(() => {});
        await page.route('**/preload-assets/docker-*.js*', async route => {
            const name = new URL(route.request().url()).pathname.split('/').pop();
            requested.push(name);
            await route.fulfill({ contentType: 'text/javascript', headers: { 'Cache-Control': 'public, max-age=3600' },
                body: `window.fixtureScriptExecution.push(${JSON.stringify(name)});` });
        });
        await page.evaluate(({ scenario, initialPath, overridePath }) => {
            window.fixtureProviderStarted = false;
            window.fixtureCustomStarted = false;
            window.fixtureProviderDisposed = false;
            const providerGate = new Promise(resolve => { window.fixtureReleaseProvider = resolve; });
            const customGate = new Promise(resolve => { window.fixtureReleaseCustom = resolve; });
            window.FolderViewPlusDockerRuntimeAssetUrl = `${initialPath}?v=fixture`;
            window.FolderViewPlusDockerHostCompatibilityDecision = {
                hostGeneration: scenario === 'safe-mode' ? 'native-docker-vue' : 'legacy-docker-table',
                runtimeActivationAllowed: scenario !== 'safe-mode'
            };
            window.FolderViewPlusDockerProviders = { getDefaultRegistry: () => ({
                prepare: () => { window.fixtureProviderStarted = true; return providerGate; },
                dispose: () => { window.fixtureProviderDisposed = true; }
            }) };
            window.FolderViewPlusDockerLoadCustomScripts = () => {
                window.fixtureCustomStarted = true;
                return customGate.then(() => {
                    if (scenario === 'override') window.FolderViewPlusDockerRuntimeAssetUrl = `${overridePath}?v=fixture`;
                });
            };
        }, { scenario, initialPath, overridePath });
        try {
            await page.addScriptTag({ content: runtimeSource('docker.bootstrap.js') });
            assert.equal(await page.evaluate(() => window.fixtureProviderStarted), true);
            if (scenario === 'safe-mode') {
                assert.deepEqual(requested, [], 'unsupported hosts must not fetch the legacy runtime');
                assert.equal(await page.locator('link[rel="preload"][as="script"]').count(), 0);
                await page.evaluate(() => window.fixtureReleaseProvider());
                const result = await page.evaluate(() => window.FolderViewPlusDockerBootstrapPromise);
                assert.equal(result.reason, 'compatibility-safe-mode');
                assert.equal(await page.evaluate(() => window.fixtureCustomStarted), false);
            } else {
                await preloadRequested;
                assert.deepEqual(await page.evaluate(() => window.fixtureScriptExecution), [], 'preload cannot execute while provider preparation is held');
                assert.equal(await page.locator('link[rel="preload"][as="script"]').count(), 1);
                if (scenario === 'page-exit') {
                    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
                    assert.equal(await page.locator('link[rel="preload"][as="script"]').count(), 0);
                    await page.evaluate(() => window.fixtureReleaseProvider());
                    const result = await page.evaluate(() => window.FolderViewPlusDockerBootstrapPromise);
                    assert.equal(result.reason, 'page-exited');
                    assert.equal(await page.evaluate(() => window.fixtureProviderDisposed), true);
                } else {
                    await page.evaluate(() => window.fixtureReleaseProvider());
                    await page.waitForFunction(() => window.fixtureCustomStarted);
                    assert.deepEqual(await page.evaluate(() => window.fixtureScriptExecution), [], 'runtime execution waits for optional custom overrides');
                    await page.evaluate(() => window.fixtureReleaseCustom());
                    const result = await page.evaluate(() => window.FolderViewPlusDockerBootstrapPromise);
                    assert.equal(result.loaded, true);
                    assert.deepEqual(await page.evaluate(() => window.fixtureScriptExecution), [(scenario === 'override' ? overridePath : initialPath).split('/').pop()]);
                }
            }
            assert.equal(await page.locator('link[rel="preload"][as="script"]').count(), 0);
            if (scenario === 'safe-mode' || scenario === 'page-exit') assert.deepEqual(await page.evaluate(() => window.fixtureScriptExecution), []);
        } finally {
            await page.evaluate(() => { window.fixtureReleaseProvider(); window.fixtureReleaseCustom(); });
        }
    }
};
