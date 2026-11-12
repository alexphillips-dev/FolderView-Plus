import assert from 'node:assert/strict';
import { createHideEmptySettingsHost } from '../helpers/settings-hide-empty-host.mjs';

export const registerSettingsTreePersistenceCases = ({ test }) => {
    for (const type of ['docker', 'vm']) {
        test(`Basic nested ${type} expansion survives reload while storage is pending`, async ({ page }) => {
            const host = await createHideEmptySettingsHost(page, type);
            const tbody = type === 'vm' ? 'vms' : 'docker';
            const row = id => page.locator(`tbody#${tbody} > tr[data-folder-id="${id}"]`);
            try {
                await page.goto(host.url, { waitUntil: 'domcontentloaded' });
                host.releaseRuntime();
                await row('leaf').waitFor();
                await row('parent').locator('.folder-tree-toggle').click();
                await row('leaf').waitFor({ state: 'detached' });
                await page.evaluate(() => {
                    settingsStorageWriter.flush();
                    // Hold deferred work so navigation deterministically precedes an idle write.
                    window.requestIdleCallback = () => 1;
                });
                await row('parent').locator('.folder-tree-toggle').click();
                await row('leaf').waitFor();
                const pending = await page.evaluate(type => ({
                    current: [...collapsedTreeParentsByType[type]],
                    stored: JSON.parse(localStorage.getItem(TABLE_UI_STATE_STORAGE_KEY)).treeCollapsed[type]
                }), type);
                assert.deepEqual(pending.current, []);
                assert.deepEqual(pending.stored, ['parent']);
                await page.reload({ waitUntil: 'domcontentloaded' });
                await row('parent').waitFor();
                assert.equal(await row('parent').locator('.folder-tree-toggle').getAttribute('aria-expanded'), 'true');
                await row('leaf').waitFor();
            } finally { await host.close(); }
        }, { skipAccessibility: true });
    }
};
