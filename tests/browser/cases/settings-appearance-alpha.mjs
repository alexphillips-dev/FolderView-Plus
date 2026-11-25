import assert from 'node:assert/strict';

export const registerSettingsAppearanceAlphaCase = ({ test, baseUrl, mount, chooseTab }) => {
    test('Appearance displays inherited alpha and retains it through a native color change', async ({ page }) => {
        await mount(page, baseUrl);
        await chooseTab(page, 'appearance');
        await page.evaluate(() => themeApi.setWorkspace({ variables: { '--fvplus-theme-accent': 'rgb(0, 102, 255, 0.35)' } }));
        await page.locator('#fv-theme-profile-scope').selectOption('docker');
        const token = page.locator('[data-fv-theme-token="--fvplus-theme-accent"]');
        const row = token.locator('xpath=..');
        assert.match(await row.locator('code').textContent(), /Inherited.*rgb\(0, 102, 255, 0\.35\)/);
        const updated = await token.evaluate(input => {
            input.focus();
            input.value = input.alpha === true ? 'color(srgb 0.13333333 0.26666667 0.4 / 0.35)' : '#224466';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            const preview = document.getElementById('fv-theme-preview-sample').style.getPropertyValue('--fvplus-theme-accent');
            return [document.activeElement === input, preview, themeApi.getWorkspace().variables['--fvplus-theme-accent']];
        });
        assert.deepEqual(updated, [true, 'rgba(34, 68, 102, 0.35)', 'rgba(34, 68, 102, 0.35)']);
        await page.evaluate(async () => {
            window.themePost = async payload => {
                if (payload.action === 'preview_profile') return { plan: { changed: true, changedScopes: [payload.scope] } };
                const { profiles, activeProfileId } = themeApi.getWorkspace();
                window.themeState = { activeProfileId, profiles: profiles.map(profile => ({ ...profile, layers: {
                    ...profile.layers, [payload.scope]: { variables: JSON.parse(payload.variables), customCss: payload.customCss }
                } })) };
                return { workspace: window.themeState };
            };
            await themeApi.saveCustomize();
            await themeApi.readWorkspace();
        });
        const saves = await page.evaluate(() => themeCalls.map(call => [call.action, call.scope, JSON.parse(call.variables)['--fvplus-theme-accent']]));
        assert.deepEqual(saves, [
            ['preview_profile', 'docker', 'rgba(34, 68, 102, 0.35)'], ['save_profile', 'docker', 'rgba(34, 68, 102, 0.35)']
        ]);
        assert.match(await row.locator('code').textContent(), /customized.*rgba\(34, 68, 102, 0\.35\)/);
        await row.locator('button').click();
        assert.match(await row.locator('code').textContent(), /Inherited.*rgb\(0, 102, 255, 0\.35\)/);
        if (await token.evaluate(input => input.alpha === true)) {
            assert.equal(await token.evaluate(input => {
                input.value = 'color(srgb 0.2 0.4 0.6 / 0.6)';
                input.dispatchEvent(new Event('input', { bubbles: true }));
                return themeApi.getWorkspace().variables['--fvplus-theme-accent'];
            }), 'rgba(51, 102, 153, 0.6)');
        }
    });
};
