import assert from 'node:assert/strict';
import { createDockerFolderMenuHost } from '../helpers/docker-folder-menu-host.mjs';

// Aurora's menu geometry at 2566339: flex links replace Unraid's block links.
// Keep this synthetic host isolated from upstream enhancers and network services.
const auroraMenuCss = '.dropdown-menu{min-width:19rem;margin:.6rem 0 3rem}.dropdown-menu a{display:flex;align-items:center;padding:.5rem 1.2rem .5rem .8rem;line-height:2.2rem}';
const bounds = node => {
    const r = node.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: innerHeight, width: innerWidth };
};
const contained = r => assert.ok(r.top >= 9.5 && r.bottom <= r.height - 9.5 && r.left >= 9.5 && r.right <= r.width - 9.5, JSON.stringify(r));

export const registerDockerFolderMenuViewportCases = ({ test }) => {
    for (const aurora of [false, true]) test(`Docker folder menu stays within bottom edges with ${aurora ? 'Aurora' : 'native'} menu geometry`, async ({ page }) => {
        const host = await createDockerFolderMenuHost(page, { nativeLayout: true });
        const menu = page.locator('#synthetic-folder-menu');
        try {
            await page.goto(host.url);
            await page.waitForLoadState('networkidle');
            if (aurora) await page.addStyleTag({ content: auroraMenuCss });
            await page.addStyleTag({ content: '#direct{position:fixed;bottom:8px;left:20px;z-index:100}' });
            await page.locator('#direct').click();
            await menu.locator('.fvplus-docker-quick-item').nth(3).waitFor();
            await page.waitForFunction(() => !!document.querySelector('#synthetic-folder-menu')?.style.maxHeight);
            contained(await menu.evaluate(bounds));
            const clone = menu.getByRole('button', { name: 'Clone', exact: true });
            const arrow = await clone.evaluate(node => {
                const after = getComputedStyle(node, '::after');
                return { left: after.marginLeft, right: after.marginRight, shrink: after.flexShrink };
            });
            assert.equal(arrow.right, '0px', JSON.stringify(arrow));
            assert.ok(arrow.left === 'auto' || Number.parseFloat(arrow.left) >= 0, JSON.stringify(arrow));
            assert.equal(arrow.shrink, '0', JSON.stringify(arrow));
            await clone.hover();
            await menu.getByRole('button', { name: 'Clone folder', exact: true }).waitFor();
            contained(await clone.locator('..').locator(':scope > ul').evaluate(bounds));
            await clone.focus();
            await clone.press('ArrowRight');
            assert.equal(await menu.getByRole('button', { name: 'Clone folder', exact: true }).evaluate(node => node === document.activeElement), true);
            await page.keyboard.press('Escape');

            await menu.evaluate(node => node.remove()); // The synthetic host omits ContextJS's outside-click dismissal.
            await page.addStyleTag({ content: 'body{min-height:1600px}' });
            await page.evaluate(() => window.scrollTo(0, 800));
            await page.locator('#direct').click();
            await menu.locator('.fvplus-docker-quick-item').nth(3).waitFor();
            await page.waitForFunction(() => !!document.querySelector('#synthetic-folder-menu')?.style.maxHeight);
            contained(await menu.evaluate(bounds));
            await page.evaluate(() => window.scrollTo(0, 0));

            // Short windows need scrolling, while fixed nested menus must escape the scrollport.
            await menu.evaluate(node => node.remove());
            await page.setViewportSize({ width: 390, height: 260 });
            await page.locator('#direct').click();
            await menu.locator('.fvplus-docker-quick-item').nth(3).waitFor();
            await page.waitForFunction(() => !!document.querySelector('#synthetic-folder-menu')?.style.maxHeight);
            contained(await menu.evaluate(bounds));
            const scrolling = await menu.evaluate(node => ({ overflow: getComputedStyle(node).overflowY, scroll: node.scrollHeight, client: node.clientHeight }));
            assert.equal(scrolling.overflow, 'auto');
            assert.ok(scrolling.scroll > scrolling.client, JSON.stringify(scrolling));
            await menu.evaluate(node => { node.scrollTop = node.scrollHeight; });
            const remove = menu.getByRole('button', { name: 'Remove', exact: true });
            assert.ok(await remove.isVisible());
            const last = await remove.evaluate(bounds);
            assert.ok(last.bottom <= last.height - 10 && last.top >= 10, JSON.stringify(last));
            assert.equal(await remove.evaluate(node => {
                const r = node.getBoundingClientRect();
                return node.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
            }), true, 'the final action is reachable by pointer');
            await clone.click();
            const submenu = clone.locator('..').locator(':scope > ul');
            await menu.getByRole('button', { name: 'Clone folder', exact: true }).waitFor();
            contained(await submenu.evaluate(bounds));
            await menu.getByRole('button', { name: 'Copy Folder Settings', exact: true }).click();
            const copy = menu.getByRole('button', { name: 'Appearance only', exact: true });
            await copy.click();
            await page.locator('.fv-settings-transfer-toast').getByText('Appearance copied.', { exact: true }).waitFor();
        } finally { await host.close(); }
    }, { skipAccessibility: true }); // Existing menu cases audit this synthetic menu with axe.
};
