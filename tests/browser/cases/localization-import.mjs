import assert from 'node:assert/strict';

export const registerLocalizedImportReviewCase = ({ test, baseUrl, loadI18n, configureGerman }) => {
    test('German import review keeps user folder names and IDs literal', async ({ page }) => {
        await page.goto(`${baseUrl}/import`);
        await loadI18n(page, baseUrl);
        await page.evaluate(configureGerman);
        await page.evaluate(() => {
            const folder = { name: 'Backup' };
            window.fixtureImport.renderSelection({ creates: [], upserts: [{ id: 'Settings', folder }], deletes: [] }, {});
            window.fixtureImport.renderDiff([{ action: 'update', id: 'Settings', name: folder.name, fields: ['icon'] }]);
            document.body.insertAdjacentHTML('beforeend', '<span id="fixture-backup-label">Backup</span>');
        });
        await page.waitForFunction(() => document.querySelector('#fixture-backup-label').textContent === 'Sicherung');
        assert.deepEqual(await page.locator('#import-preview-diff tbody td[data-fvplus-user-content]').allTextContents(), ['Settings', 'Backup']);
        assert.equal(await page.locator('#import-preview-selection .import-selection-item span').textContent(), 'Backup');
        await page.evaluate(() => { window.FolderViewPlusI18n.usePseudoLocale(); window.FolderViewPlusI18n.restoreLocale(); });
        assert.deepEqual(await page.locator('#import-preview-diff tbody td[data-fvplus-user-content]').allTextContents(), ['Settings', 'Backup']);
    });
};
