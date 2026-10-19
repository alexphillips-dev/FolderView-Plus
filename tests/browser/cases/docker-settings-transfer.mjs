import assert from 'node:assert/strict';
import { createDockerFolderMenuHost } from '../helpers/docker-folder-menu-host.mjs';

export const registerDockerSettingsTransferCases = ({ test, checkMenuAccessibility }) => {
    test('Docker folder menu transfers selected categories and explains disabled paste choices', async ({ page }) => {
        const host = await createDockerFolderMenuHost(page);
        host.folders.direct.settings.preview_border_color = '#123456';
        const requests = [];
        let unchanged = false;
        await page.route('**/server/apply_folder_settings.php', async route => {
            const payload = Object.fromEntries(new URLSearchParams(route.request().postData()));
            requests.push(payload);
            await route.fulfill({ json: { ok: true, result: { updatedCount: unchanged ? 0 : 1,
                folderRevision: 7, changes: { direct: ['appearance'] }, backup: payload.preview ? null : { file: 'fixture.json' } } } });
        });
        const menu = page.locator('#synthetic-folder-menu');
        const item = name => menu.getByRole('button', { name, exact: true });
        const open = async () => {
            await page.locator('#direct').click();
            await menu.locator('.fv-transfer-copy-all').waitFor({ state: 'attached' });
            await item('Clone').click();
        };
        try {
            await page.emulateMedia({ reducedMotion: 'reduce' });
            await page.goto(host.url, { waitUntil: 'load' });
            await page.waitForLoadState('networkidle');
            await open();
            await item('Copy Folder Settings').click();
            await item('Appearance only').click();
            await page.locator('.fv-settings-transfer-toast').getByText('Appearance copied.', { exact: true }).waitFor();
            await open();
            await item('Paste settings from Direct members').click();
            const disabled = item('Behavior only…');
            assert.equal(await disabled.getAttribute('aria-disabled'), 'true');
            assert.match(await disabled.getAttribute('title'), /not included/);
            await disabled.dispatchEvent('click');
            assert.equal(requests.length, 0);
            await checkMenuAccessibility(page);
            await item('Appearance only…').click();
            await page.getByRole('button', { name: 'Paste', exact: true }).click();
            await page.waitForFunction(() => document.querySelector('.fv-settings-transfer-toast')?.textContent.includes('safety backup'));
            assert.equal(requests.length, 2);
            assert.equal(requests[0].preview, '1');
            assert.equal(requests[1].expectedRevision, '7');
            assert.deepEqual(JSON.parse(requests[1].categories), ['appearance']);
            assert.deepEqual(JSON.parse(requests[1].settings).settings, { preview_border_color: '#123456' });
            unchanged = true;
            await page.waitForLoadState('networkidle');
            await open();
            await item('Paste settings from Direct members').click();
            await item('All copied settings…').click();
            await page.locator('.fv-settings-transfer-toast').getByText('Appearance already matches. No changes needed.', { exact: true }).waitFor();
            assert.equal(requests.length, 3);
            assert.equal(await page.getByRole('button', { name: 'Paste', exact: true }).count(), 0);
            await open();
            await item('View copied settings…').click();
            await page.getByText(/Source: Direct members \(Docker\).*Copied:.*Categories: Appearance/).waitFor();
            await page.getByRole('button', { name: 'Close', exact: true }).last().click();
            await open();
            await item('Clear copied settings').click();
            await open();
            await item('Paste Folder Settings').click();
            assert.match(await item('All copied settings…').getAttribute('title'), /Copy settings from a Docker folder first/);
        } finally { await host.close(); }
    }, { skipAccessibility: true }); // The real menu is audited above; the host shell is deliberately minimal.

    test('Docker folder menu nested copy choices support keyboard and narrow viewport placement', async ({ page }) => {
        const host = await createDockerFolderMenuHost(page);
        const menu = page.locator('#synthetic-folder-menu');
        try {
            await page.addInitScript(() => localStorage.setItem('fv.folder.settings.clipboard.persist.v1', JSON.stringify({
                schemaVersion: 2, categories: ['appearance'], type: 'docker', copiedAt: new Date().toISOString(),
                sourceName: 'A long copied source with a detailed display name <fixture>', payload: { icon: '', settings: {}, actions: [] }
            })));
            await page.goto(host.url, { waitUntil: 'load' });
            await page.waitForLoadState('networkidle');
            await page.locator('#direct').click();
            await menu.locator('.fv-transfer-copy-all').waitFor({ state: 'attached' });
            const clone = menu.getByRole('button', { name: 'Clone', exact: true });
            await clone.focus();
            await clone.press('ArrowRight');
            await page.keyboard.press('End');
            await page.keyboard.press('Home');
            await menu.getByRole('button', { name: 'Copy Folder Settings', exact: true }).focus();
            await page.keyboard.press('ArrowRight');
            assert.equal(await menu.getByRole('button', { name: 'All settings', exact: true }).evaluate(node => node === document.activeElement), true);
            await checkMenuAccessibility(page);
            const bounds = await menu.evaluate(node => [...node.querySelectorAll('ul')].filter(list => list.getBoundingClientRect().width && getComputedStyle(list).display !== 'none').map(list => {
                const r = list.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: innerWidth, height: innerHeight };
            }));
            assert.ok(bounds.length >= 2);
            for (const r of bounds) assert.ok(r.left >= 0 && r.right <= r.width + 1 && r.top >= 0 && r.bottom <= r.height + 1, JSON.stringify(r));
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('Enter');
            await page.locator('.fv-settings-transfer-toast').getByText('Appearance copied.', { exact: true }).waitFor();
        } finally { await host.close(); }
    }, { skipAccessibility: true });
    test('Docker folder menu supports touch copying and creates an empty settings-only clone', async ({ page }) => {
        const context = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
        const touch = await context.newPage(), host = await createDockerFolderMenuHost(touch);
        let created = null;
        host.folders.direct.actions = [{ type: 1, name: 'Fixture action', script: 'echo fixture' }];
        host.folders.direct.settings.webui_profiles = [{ id: 'source', containers: ['fixture-app-1'] }];
        await touch.route('**/server/create.php', async route => {
            created = JSON.parse(new URLSearchParams(route.request().postData()).get('content'));
            await route.fulfill({ json: { ok: true, result: { id: 'cloned' } } });
        });
        const menu = touch.locator('#synthetic-folder-menu');
        const button = name => menu.getByRole('button', { name, exact: true });
        try {
            await touch.goto(host.url, { waitUntil: 'load' });
            await touch.waitForLoadState('networkidle');
            await touch.locator('#direct').click();
            await button('Clone').tap();
            await button('Copy Folder Settings').tap();
            // Firefox's desktop touch emulation keeps a fine primary pointer.
            if (await touch.evaluate(() => matchMedia('(pointer: coarse)').matches)) assert.ok((await button('Layout and previews only').boundingBox()).height >= 44);
            await button('Layout and previews only').tap();
            await touch.locator('.fv-settings-transfer-toast').waitFor();
            await touch.locator('#direct').click();
            await button('Clone').tap();
            touch.once('dialog', dialog => dialog.accept(dialog.defaultValue()));
            const saved = touch.waitForResponse(response => response.url().includes('/server/create.php'));
            await button('Clone settings only…').tap();
            await saved;
            assert.equal(created.name, 'Direct members (Copy)');
            assert.deepEqual(created.containers, []);
            assert.equal(created.regex, '');
            assert.deepEqual(created.actions, []);
            assert.equal(created.settings.webui_profiles, undefined);
        } finally { await host.close(); await context.close(); }
    }, { skipAccessibility: true });
};
