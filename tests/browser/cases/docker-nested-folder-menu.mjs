import assert from 'node:assert/strict';
import { createDockerFolderMenuHost } from '../helpers/docker-folder-menu-host.mjs';

export const registerNestedFolderMenuCases = ({ test, checkMenuAccessibility }) => {
    test('Docker folder menu opens directly from nested previews without expanding the parent', async ({ page }) => {
        const host = await createDockerFolderMenuHost(page);
        host.folders.parent.settings.preview_hide_nested_items = true;
        host.folders.branch.settings.preview_hide_nested_items = true;
        const menu = page.locator('#synthetic-folder-menu');
        const chip = page.locator('[data-folder-preview-root="parent"][data-folder-preview-child="branch"]');
        const open = async action => {
            await action();
            await menu.locator('.fvplus-docker-quick-item').nth(3).waitFor();
            await page.waitForFunction(() => document.getElementById('fvplus-child-folder-menu-trigger') !== null);
        };
        try {
            await page.emulateMedia({ reducedMotion: 'reduce' });
            await page.goto(host.url, { waitUntil: 'load' });
            await page.waitForLoadState('networkidle');
            await page.locator('#direct').click();
            await menu.locator('.fvplus-docker-quick-item').nth(3).waitFor();
            const rootStyle = await menu.evaluate(node => ({ color: getComputedStyle(node).color, background: getComputedStyle(node).backgroundColor }));
            assert.equal(await menu.getByText('Expand to folder', { exact: true }).count(), 0);
            await open(() => chip.click());
            assert.deepEqual(await menu.evaluate(node => ({ color: getComputedStyle(node).color, background: getComputedStyle(node).backgroundColor })), rootStyle);
            assert.notEqual(await page.locator('.dropDown-parent').getAttribute('active'), 'true');
            assert.equal(await menu.getByText('Expand to folder', { exact: true }).count(), 1);
            assert.equal(await menu.getByText('Move to root', { exact: true }).count(), 1);
            assert.equal(await menu.getByText('Open folder actions', { exact: true }).count(), 0);
            await checkMenuAccessibility(page);
            await page.keyboard.press('Escape');
            await open(async () => { await chip.focus(); await chip.press('Enter'); });
            await menu.getByRole('button', { name: 'Focus folder', exact: true }).waitFor();
            await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Focus folder');
            await page.keyboard.press('Escape');
            assert.equal(await chip.evaluate(node => node === document.activeElement), true);
            assert.equal(await menu.isVisible(), false);
            await open(() => chip.click({ button: 'right' }));
            await menu.getByRole('button', { name: 'Pin folder', exact: true }).click();
            await page.waitForLoadState('networkidle');
            await open(() => chip.click());
            assert.equal(await menu.getByRole('button', { name: 'Unpin folder', exact: true }).getAttribute('aria-pressed'), 'true');
            await menu.getByRole('button', { name: 'Lock folder', exact: true }).click();
            await open(() => chip.click());
            assert.equal(await menu.getByRole('button', { name: 'Unlock folder', exact: true }).getAttribute('aria-pressed'), 'true');
            await menu.getByRole('button', { name: 'Unlock folder', exact: true }).click();
            await open(() => chip.click());
            await menu.getByText('Expand to folder', { exact: true }).click();
            assert.equal(await page.locator('.dropDown-parent').getAttribute('active'), 'true');
            await page.locator('.dropDown-parent').click();
            await open(() => chip.click());
            const saved = page.waitForResponse(response => {
                if (!response.url().includes('/server/update.php')) return false;
                const payload = new URLSearchParams(response.request().postData());
                return payload.get('id') === 'branch' && JSON.parse(payload.get('content') || '{}').parentId === '';
            });
            await menu.getByText('Move to root', { exact: true }).click();
            await saved;
            await page.waitForFunction(() => document.querySelector('tr.folder-id-branch')?.getAttribute('data-folder-parent') === '');
            await page.waitForLoadState('networkidle');
            assert.equal(host.folders.branch.parentId, '');
            assert.equal(await chip.count(), 0);
            assert.equal(await page.locator('tr.folder-id-branch').isVisible(), true);
            assert.equal(await page.locator('#fvplus-child-folder-menu-trigger').count(), 0);
        } finally { await host.close(); }
    }, { skipAccessibility: true }); // The real menu is audited above; the synthetic Unraid shell is intentionally minimal.
};
