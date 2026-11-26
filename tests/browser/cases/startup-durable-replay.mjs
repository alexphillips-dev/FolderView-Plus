import assert from 'node:assert/strict';
import { closeFilterViewHost as closeHost, createFilterViewSettingsHost } from '../helpers/filter-view-settings-host.mjs';

export const registerStartupDurableReplayCases = ({ test, openSettings, waitFor }) => {
    test('Docker start order persists a batch edit before hard reload and replays it on the reopened page', async ({ page }) => {
        const host = await createFilterViewSettingsHost(page);
        const prefs = host.prefs('docker');
        prefs.dockerStartOrder = { mode: 'custom-batches', remaining: 'after', containerWaits: {},
            batches: [{ id: 'fixture', name: 'Original name', items: [], delay: 0 }] };
        await page.route('**/server/templates.php**', route => route.fulfill({ json: { ok: true, templates: [] } }));
        await page.route('**/server/docker_start_order.php**', route => route.fulfill({
            json: { ok: true, preview: { mode: 'custom-batches', managed: true, sequence: [], autostartOrder: [] } }
        }));
        try {
            await openSettings(page, host);
            await page.locator('[data-mode="advanced"]').click();
            await page.locator('[data-fv-advanced-tab="startup"]').click();
            await page.waitForFunction(() => !window.FolderViewPlusPrefsStore.getDefaultCoordinator().getSnapshot('docker').pending);
            const [response, queued] = await Promise.all([
                page.waitForNavigation({ waitUntil: 'load' }),
                page.getByLabel('Batch name').evaluate(input => {
                    input.value = 'Saved across reload';
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    const record = Object.keys(localStorage).filter(key => key.startsWith('fvplus.prefs.outbox.v1.docker.'))
                        .map(key => JSON.parse(localStorage.getItem(key))).find(entry => entry.patch.dockerStartOrder?.batchChanges);
                    window.location.reload();
                    return record?.patch.dockerStartOrder.batchChanges;
                })
            ]);
            assert.equal(response.status(), 200);
            assert.deepEqual(queued, [{ action: 'set', id: 'fixture', field: 'name', previous: 'Original name', value: 'Saved across reload' }]);
            await waitFor(page, () => host.prefs('docker').dockerStartOrder.batches[0].name === 'Saved across reload', 'Startup edit replayed after reload');
            await page.locator('[data-mode="advanced"]').click();
            await page.locator('[data-fv-advanced-tab="startup"]').click();
            assert.equal(await page.getByLabel('Batch name').inputValue(), 'Saved across reload');
        } finally { await closeHost(page, host); }
    }, { skipAccessibility: true });
};
