import assert from 'node:assert/strict';
export const registerFolderEditorFixtureCases = ({ test, baseUrl }) => {
test('Folder action sheet uses the compact retained action set and accessible dialog', async ({ page }) => {
    await page.goto(`${baseUrl}/folder-editor`, { waitUntil: 'load' });
    await page.click('#open-folder-actions');
    const dialog = page.getByRole('dialog', { name: 'Media' });
    await dialog.waitFor();
    assert.equal(await page.locator('#fv-folder-action-sheet-backdrop').count(), 1);
    assert.equal(await dialog.locator('[data-action="move"]').count(), 1);
    assert.equal(await dialog.locator('[data-action="export"]').count(), 1);
    assert.equal(await dialog.locator('[data-action="import"]').count(), 1);
    assert.equal(await dialog.locator('[data-action="delete"]').count(), 1);
    assert.equal(await dialog.getByText('Scan tree integrity').count(), 0);
    assert.equal(await dialog.getByText('Repair tree integrity').count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement?.matches('[data-close-folder-actions]')), true);
});

test('Folder action sheet traps focus, copies details, and restores trigger focus', async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {
                writeText: async (value) => {
                    window.__fixtureCopiedText = String(value);
                }
            }
        });
    });
    await page.goto(`${baseUrl}/folder-editor`, { waitUntil: 'load' });
    await page.click('#open-folder-actions');
    await page.locator('.fv-folder-action-sheet-details summary').click();
    await page.click('[data-copy-folder-id]');
    await page.waitForFunction(() => window.__fixtureCopiedText === 'media');
    assert.equal(await page.locator('[data-copy-folder-id] span').textContent(), 'Copied');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#fv-folder-action-sheet-backdrop').count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'open-folder-actions');
    await page.click('#open-folder-actions');
    await page.click('[data-action="delete"]');
    assert.equal(await page.evaluate(() => window.fixtureFolderEditor.calls.includes('delete')), true);
    assert.equal(await page.locator('#fv-folder-action-sheet-backdrop').count(), 0);
});

};
