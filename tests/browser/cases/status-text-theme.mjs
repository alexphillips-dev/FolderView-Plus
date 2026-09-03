import assert from 'node:assert/strict';

export const registerStatusTextThemeFixtureCase = ({ test, baseUrl }) => {
test('Dashboard folder status text follows a light theme unless a custom color is explicit', async ({ page }) => {
    await page.goto(`${baseUrl}/dashboard-lifecycle`, { waitUntil: 'load' });
    const status = page.locator('#fixture-audiobooks-folder .folder-state-docker');
    await status.evaluate((element) => {
        document.body.style.background = '#f8f9fb'; document.body.style.color = '#27313d';
        document.documentElement.style.setProperty('--text', '#27313d');
        document.documentElement.style.setProperty('--fvplus-runtime-theme-foreground', '#27313d');
        element.style.removeProperty('color');
    });
    assert.equal(await status.evaluate((element) => getComputedStyle(element).color), 'rgb(39, 49, 61)');
    await status.evaluate((element) => element.style.setProperty('color', '#ffffff'));
    assert.equal(await status.evaluate((element) => getComputedStyle(element).color), 'rgb(255, 255, 255)');
});
};
