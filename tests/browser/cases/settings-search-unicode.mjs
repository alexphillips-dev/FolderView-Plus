import { verifyMultilingualSettingsSearch } from './settings-search-layout.mjs';

export const registerSettingsSearchUnicodeCases = ({ test, baseUrl }) => {
    test('Settings search matches localized labels while excluding private content', async ({ page }) => {
        await page.goto(`${baseUrl}/settings`, { waitUntil: 'load' });
        await verifyMultilingualSettingsSearch(page);
    });
};
