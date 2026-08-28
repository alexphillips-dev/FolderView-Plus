import assert from 'node:assert/strict';
export const registerFolderWebuiProfileThemeFixtureCase = ({ test, baseUrl }) => {
test('Custom WebUI profile buttons resist Unraid defaults and follow editor theme tokens', async ({ page }) => {
    await page.goto(`${baseUrl}/folder-editor`, { waitUntil: 'load' });
    await page.getByRole('button', { name: 'Add profile' }).click();
    const readTheme = () => page.evaluate(() => {
        const form = document.querySelector('.folder-editor-form');
        const neutral = document.querySelector('.fv-webui-profile-actions .fv-webui-profile-button:not(.is-danger)');
        const neutralProbe = document.createElement('span');
        neutralProbe.style.cssText = 'position:absolute;left:-9999px;background:var(--fv-editor-button-bg-top);color:var(--fv-editor-button-fg)';
        form.append(neutralProbe);
        const neutralStyle = getComputedStyle(neutral);
        const neutralProbeStyle = getComputedStyle(neutralProbe);
        const result = {
            background: neutralStyle.backgroundColor, expectedBackground: neutralProbeStyle.backgroundColor,
            color: neutralStyle.color, expectedColor: neutralProbeStyle.color,
            borderWidth: neutralStyle.borderTopWidth
        };
        neutralProbe.remove();
        return result;
    });
    const dark = await readTheme();
    assert.equal(dark.background, dark.expectedBackground);
    assert.equal(dark.color, dark.expectedColor);
    assert.equal(dark.borderWidth, '0px');
    assert.notEqual(dark.color, 'rgb(255, 128, 0)');
    await page.evaluate(() => { document.documentElement.dataset.fvplusHostTheme = 'white'; });
    await page.waitForTimeout(200);
    const light = await readTheme();
    assert.equal(light.background, light.expectedBackground);
    assert.equal(light.color, light.expectedColor);
    assert.equal(light.borderWidth, '0px');
    assert.notEqual(light.background, dark.background);
    await page.evaluate(() => { delete document.documentElement.dataset.fvplusHostTheme; });
    await page.waitForTimeout(200);
});
};
