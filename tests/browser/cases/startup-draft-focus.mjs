import assert from 'node:assert/strict';
import { closeFilterViewHost as closeHost, createFilterViewSettingsHost } from '../helpers/filter-view-settings-host.mjs';

export const registerStartupDraftFocusCase = ({ test, openSettings, waitFor }) => {
    test('Docker start order keeps a focused name draft through an unrelated preference response', async ({ page }) => {
        const host = await createFilterViewSettingsHost(page);
        host.prefs('docker').dockerStartOrder = { mode: 'custom-batches', remaining: 'after', containerWaits: {},
            batches: [{ id: 'fixture', name: 'Original name', items: [], delay: 0 }] };
        await page.route('**/server/templates.php**', route => route.fulfill({ json: { ok: true, templates: [] } }));
        await page.route('**/server/docker_start_order.php**', route => route.fulfill({
            json: { ok: true, preview: { mode: 'custom-batches', managed: true, sequence: [], autostartOrder: [] } }
        }));
        let releaseWrite;
        let recordWrite;
        const heldWrite = new Promise(resolve => { releaseWrite = resolve; });
        const startedWrite = new Promise(resolve => { recordWrite = resolve; });
        await page.route('**/server/prefs.php**', async route => {
            const fields = new URLSearchParams(route.request().postData() || '');
            if (fields.get('type') === 'docker' && JSON.parse(fields.get('prefs') || '{}').settingsMode === 'advanced') {
                recordWrite();
                await heldWrite;
            }
            await route.fallback();
        });
        try {
            await openSettings(page, host);
            await page.locator('[data-mode="advanced"]').click();
            await page.locator('[data-fv-advanced-tab="startup"]').click();
            await startedWrite;
            const input = page.getByLabel('Batch name');
            await input.click();
            await input.press('End');
            await input.pressSequentially(' draft');
            releaseWrite();
            await page.waitForFunction(() => !window.FolderViewPlusPrefsStore.getDefaultCoordinator().getSnapshot('docker').pending);
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            assert.equal(await input.inputValue(), 'Original name draft');
            assert.equal(await input.evaluate(element => document.activeElement === element), true);
            assert.equal(host.prefs('docker').dockerStartOrder.batches[0].name, 'Original name');
            await input.pressSequentially(' finished');
            await input.press('Tab');
            await waitFor(page, () => host.prefs('docker').dockerStartOrder.batches[0].name === 'Original name draft finished', 'the completed edit persisted');
            const delay = page.getByLabel('Delay after batch');
            await delay.focus();
            await delay.press('ArrowUp');
            await delay.press('ArrowUp');
            await waitFor(page, () => host.prefs('docker').dockerStartOrder.batches[0].delay === 2, 'successive spinner edits persisted');
        } finally {
            releaseWrite();
            await closeHost(page, host);
        }
    }, { skipAccessibility: true });
};
