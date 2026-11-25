import assert from 'node:assert/strict';
import { createHideEmptySettingsHost, waitForSettingsRuntimeHydration } from './settings-hide-empty-host.mjs';

export const checkSettingsFolderLabels = async (page) => {
    const host = await createHideEmptySettingsHost(page, 'docker', {
        locale: 'de', prefs: { hideEmptyFolders: false },
        folders: { parent: { name: 'Media' }, child: { name: 'Media & Photos', parentId: 'parent' } }
    });
    const parentName = page.locator('tbody#docker [data-folder-id="parent"] .name-cell-text');
    const child = page.locator('tbody#docker [data-folder-id="child"]');
    try {
        await page.goto(host.url, { waitUntil: 'domcontentloaded' });
        host.releaseRuntime();
        await waitForSettingsRuntimeHydration(page);
        await page.evaluate(async () => {
            await window.FolderViewPlusI18n.ready;
            const control = document.createElement('span');
            control.id = 'fixture-localized-media';
            control.textContent = 'Media';
            document.body.append(control);
            window.FolderViewPlusI18n.translate();
        });
        assert.equal(await page.locator('#fixture-localized-media').textContent(), 'Medien');
        assert.equal(await parentName.textContent(), 'Media');
        for (const query of ['&', '& Photos']) {
            await page.evaluate(value => setFilterQuery('folders', 'docker', value), query);
            const hit = child.locator('.name-cell-text mark');
            await hit.and(page.getByText(query, { exact: true })).waitFor();
            assert.equal(await hit.textContent(), query);
            assert.equal(await child.locator('.name-cell-text').textContent(), 'Media & Photos');
            assert.equal(await child.locator('.name-cell-breadcrumb mark').textContent(), query);
        }
    } finally { await host.close(); }
};
