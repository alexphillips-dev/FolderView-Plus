import assert from 'node:assert/strict';

export const registerSettingsAppearanceValidationCases = ({ test, baseUrl, mount, chooseTab }) => {
    test('Appearance displays inherited colors and preserves draft CSS after byte-limit validation fails', async ({ page }) => {
        await mount(page, baseUrl);
        await chooseTab(page, 'appearance');
        await page.evaluate(() => themeApi.setWorkspace({ activeProfileId: 'default', profiles: [{
            id: 'default', name: 'Fixture', layers: { global: { variables: { '--fvplus-theme-accent': '#334455' } } }
        }] }));
        await page.locator('#fv-theme-profile-scope').selectOption('docker');
        const accent = page.locator('[data-fv-theme-token="--fvplus-theme-accent"]');
        assert.equal(await accent.evaluate(input => { const reference = input.cloneNode(); reference.value = '#334455'; return input.value === reference.value; }), true);
        assert.match(await accent.locator('xpath=..').locator('code').textContent(), /Inherited/);
        assert.deepEqual(await page.evaluate(() => themeApi.getWorkspace().variables), {});
        const css = `/*${'ä'.repeat(32767)}*/`;
        await page.locator('#fv-theme-custom-css').fill(css);
        await page.evaluate(() => themeApi.saveCustomize().catch(() => {}));
        await page.locator('#fv-theme-profile-name').fill('Copy');
        await page.locator('#fv-theme-save-as-profile').click();
        await page.waitForFunction(() => themeErrors.length === 2);
        assert.deepEqual(await page.evaluate(() => themeCalls), []);
        assert.equal(await page.locator('#fv-theme-custom-css').inputValue(), css);
    });
};
