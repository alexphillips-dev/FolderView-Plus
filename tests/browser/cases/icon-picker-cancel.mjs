import assert from 'node:assert/strict';
import { mountIconBrowser } from '../helpers/icon-browser-host.mjs';

export const registerIconPickerCancelCase = ({ test, baseUrl }) => {
    test('Icon browser Cancel restores the icon before Use Icon without saving the folder', async ({ page }) => {
        await page.route('**/plugins/folderview.plus/images/custom/**', route => route.fulfill({ path: 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/images/folder-icon.png' }));
        for (const type of ['docker', 'vm']) {
            await mountIconBrowser(page, baseUrl, type);
            if (type === 'vm') await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
            const input = page.locator('[name="icon"]');
            const original = `${await input.inputValue()}?original`;
            const picker = page.getByRole('region', { name: 'Choose icon', exact: true });
            const use = picker.getByRole('button', { name: 'Use icon', exact: true });
            const cancel = picker.locator('.fv-icon-browser-footer').getByRole('button', { name: 'Cancel', exact: true });
            const expectIcon = async value => {
                const displayed = value || original.split('?')[0];
                assert.equal(await input.inputValue(), value);
                assert.equal(await page.locator('#fvIconPanelPreview').getAttribute('src'), displayed);
                assert.equal(await picker.locator('.fv-icon-draft img').getAttribute('src'), displayed);
            };
            for (const [source, selector] of [
                ['Built-in icons', '[data-icon-value$="?tools"]'],
                ['Icon Packs', '[data-icon-url$="collection=beta.png"] [data-icon-select]'],
                ['My uploads', '[data-custom-icon="uploaded.png"] [data-action="use"]']
            ]) {
                await input.fill(original);
                await page.evaluate(() => { window.iconBrowserFixture.uploads = [{ name: 'uploaded.png', url: '/plugins/folderview.plus/images/custom/uploaded.png', usageCount: 0 }]; });
                await page.getByRole('tab', { name: source, exact: true }).click();
                await page.locator(selector).click();
                await use.click();
                assert.notEqual(await input.inputValue(), original);
                await use.click(); // Reapplying the same selection must retain its undo value.
                await cancel.click();
                await expectIcon(original);
                await cancel.click();
                await expectIcon(original);
            }
            await page.getByRole('tab', { name: 'Built-in icons', exact: true }).click();
            await page.locator('[data-icon-value$="?tools"]').click(); await use.click();
            const previous = await input.inputValue();
            await page.locator('[data-icon-value$="?automation"]').click(); await use.click();
            await cancel.click(); await expectIcon(previous);
            await page.locator('[data-icon-value$="?automation"]').click(); await use.click();
            await input.fill(`${original}&manual=1`);
            await cancel.click(); await expectIcon(`${original}&manual=1`);
            await page.locator('[data-icon-value$="?automation"]').click(); await use.click();
            await page.getByRole('button', { name: 'Use default icon', exact: true }).click();
            await cancel.click(); await expectIcon(original.split('?')[0]);
            await input.fill('/plugins/folderview.plus/images/custom/uploaded.png?v=1');
            await page.locator('[data-icon-value$="?tools"]').click(); await use.click();
            await page.getByRole('tab', { name: 'My uploads', exact: true }).click();
            await page.locator('[data-custom-icon="uploaded.png"] [data-action="delete"]').click();
            await page.getByRole('dialog', { name: 'Delete custom icon?' }).getByRole('button', { name: 'Delete', exact: true }).click();
            await page.waitForFunction(() => !window.iconBrowserFixture.uploads.length);
            await cancel.click(); await expectIcon(original.split('?')[0]);
            await page.getByRole('tab', { name: 'Built-in icons', exact: true }).click();
            await input.fill('');
            await page.locator('[data-icon-value$="?tools"]').click(); await use.click();
            await cancel.click(); await expectIcon('');
        }
    });
};
