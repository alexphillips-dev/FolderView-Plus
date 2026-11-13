import assert from 'node:assert/strict';
import path from 'node:path';
import { createProductionPerfFixture } from '../../../scripts/lib/production-perf-fixture.mjs';

export const registerSettingsInitialHydrationCases = ({ test }) => {
    test('Settings paints config while localization is held and hydrates runtime after both are ready', async ({ page }) => {
        const host = createProductionPerfFixture(path.resolve('.'), { folders: 1, members: 2 }, 'de');
        let releaseLocale;
        const localeGate = new Promise(resolve => { releaseLocale = resolve; });
        const runtimeRequests = [];
        await page.route('**/langs/namespaces/de/settings.json*', async route => {
            await localeGate;
            await route.continue();
        });
        await page.route('**/server/runtime_snapshot.php?**', async route => {
            const url = new URL(route.request().url());
            const response = await route.fetch(), payload = await response.json();
            if (url.searchParams.get('mode') === 'config') {
                for (const snapshot of Object.values(payload.snapshots || { selected: payload })) {
                    snapshot.runtime = {}; snapshot.runtimeIncluded = false;
                }
            } else {
                runtimeRequests.push(url.searchParams.get('type'));
                payload.runtimeIncluded = true;
            }
            await route.fulfill({ json: payload });
        });
        await page.route('**/favicon.ico', route => route.fulfill({ status: 204 }));
        await new Promise(resolve => host.server.listen(0, '127.0.0.1', resolve));
        try {
            await page.goto(`http://127.0.0.1:${host.server.address().port}/settings`);
            await page.evaluate(() => { document.title = 'FolderView Plus Settings'; });
            await page.waitForFunction(() => window.FolderViewPlusSettingsBootstrapState?.ready === true
                && window.FolderViewPlusSettingsBootstrapState.failed !== true);
            assert.equal(await page.locator('tr[data-folder-id="fixture-folder-0"]').count(), 1);
            assert.equal(await page.locator('tr[data-folder-id="fixture-folder-0"] img.img').getAttribute('alt'), '');
            assert.equal(await page.locator('tr[data-folder-id="fixture-folder-0"] .folder-runtime-status.is-runtime-pending').count(), 1);
            assert.deepEqual(runtimeRequests, [], 'runtime discovery cannot overtake held localization');
            assert.equal(await page.evaluate(() => window.FolderViewPlusI18n.snapshot().initialized), false);
            await page.evaluate(() => {
                window.fixtureHydrationSettled = false;
                window.FolderViewPlusSettingsRuntimeHydrationPromise.then(() => { window.fixtureHydrationSettled = true; });
            });
            assert.equal(await page.evaluate(() => window.fixtureHydrationSettled), false);
            releaseLocale();
            const result = await page.evaluate(async () => {
                await window.FolderViewPlusI18n.ready;
                return window.FolderViewPlusSettingsRuntimeHydrationPromise;
            });
            assert.deepEqual(runtimeRequests.sort(), ['docker', 'vm']);
            assert.deepEqual(result.map(value => [value.status, value.value.hasErrors]), [['fulfilled', false], ['fulfilled', false]]);
            assert.equal(await page.locator('tr[data-folder-id="fixture-folder-0"] .folder-runtime-status.is-runtime-pending').count(), 0);
            assert.equal(await page.locator('tr[data-folder-id="fixture-folder-0"] button.folder-runtime-status').count(), 1);
        } finally {
            releaseLocale();
            await page.evaluate(async () => {
                await window.FolderViewPlusI18n?.ready;
                await window.FolderViewPlusSettingsRuntimeHydrationPromise;
            }).catch(() => {});
            await new Promise(resolve => host.server.close(resolve));
        }
    });
};
