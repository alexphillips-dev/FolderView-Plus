import assert from 'node:assert/strict';

export const registerFolderWebuiProfileFixtureCases = ({ test, baseUrl }) => {
test('Custom WebUI profiles support create, select, duplicate, reorder, and delete', async ({ page }) => {
    await page.goto(`${baseUrl}/folder-editor`, { waitUntil: 'load' });
    await page.getByRole('button', { name: 'Add profile' }).click();
    const card = page.locator('.fv-webui-profile-card').first();
    await card.locator('.fv-webui-profile-name').fill('Media tools');
    await card.getByText('Plex', { exact: true }).click();
    await card.getByText('Tautulli', { exact: true }).click();
    let stored = JSON.parse(await page.locator('input[name="webui_profiles"]').inputValue());
    assert.deepEqual(stored[0].containers.sort(), ['Plex', 'Tautulli']);
    await card.getByRole('button', { name: 'Duplicate' }).click();
    assert.equal(await page.locator('.fv-webui-profile-card').count(), 2);
    await page.locator('.fv-webui-profile-card').nth(1).getByRole('button', { name: 'Move up' }).click();
    await page.locator('.fv-webui-profile-card').first().getByRole('button', { name: 'Delete' }).click();
    assert.equal(await page.locator('.fv-webui-profile-card').count(), 1);
    stored = JSON.parse(await page.locator('input[name="webui_profiles"]').inputValue());
    assert.equal(stored[0].name, 'Media tools');
});

test('Custom WebUI profile editor remains usable on mobile and keyboard focus is visible', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/folder-editor`, { waitUntil: 'load' });
    await page.getByRole('button', { name: 'Add profile' }).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `unexpected horizontal overflow: ${overflow}px`);
    await page.keyboard.press('Tab');
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName || '');
    assert.ok(['BUTTON', 'INPUT'].includes(focusedTag));
});
};
