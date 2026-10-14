import assert from 'node:assert/strict';
import { createHideEmptySettingsHost } from '../helpers/settings-hide-empty-host.mjs';

export const registerSettingsNestedDisplayCases = ({ test }) => {
    for (const type of ['docker', 'vm']) {
        test(`Basic nested ${type} Name column matches curved branch display`, async ({ page }) => {
            const host = await createHideEmptySettingsHost(page, type);
            const tbody = type === 'vm' ? 'vms' : 'docker';
            const row = id => page.locator(`tbody#${tbody} > tr[data-folder-id="${id}"]`);
            try {
                await page.setViewportSize({ width: 1440, height: 1000 });
                await page.goto(host.url, { waitUntil: 'domcontentloaded' });
                host.releaseRuntime();
                await page.evaluate(async () => { await window.FolderViewPlusSettingsRuntimeHydrationPromise; });
                await row('leaf').waitFor();
                // Unraid default-base.css applies this native button margin outside the plugin.
                await page.addStyleTag({ content: '.row-order-actions button, .row-order-actions button[type="button"] { margin: 10px 12px 10px 0; }' });
                const geometry = await row('child').evaluate(node => {
                    const guide = node.querySelector('.name-cell-tree-guide.is-branch');
                    const curve = getComputedStyle(guide, '::before');
                    const dot = getComputedStyle(guide, '::after');
                    const divider = node.querySelector('.folder-drag-divider');
                    const handle = node.querySelector('.folder-drag-handle');
                    const dividerCentered = [...node.closest('tbody').querySelectorAll('.folder-drag-divider')].every(divider => {
                        const grip = divider.previousElementSibling.children[1].getBoundingClientRect();
                        const line = divider.getBoundingClientRect();
                        const icon = divider.nextElementSibling.querySelector('svg path').getBoundingClientRect();
                        return Math.abs((line.left - grip.right) - (icon.left - line.right)) <= 1;
                    });
                    return { radius: curve.borderEndStartRadius, dotRadius: dot.borderRadius,
                        dividerCentered,
                        dividerWidth: divider.getBoundingClientRect().width,
                        dividerAfterHandle: divider.previousElementSibling === handle,
                        actionIcons: node.querySelectorAll('.folder-tree-action > svg').length,
                        railWidth: guide.getBoundingClientRect().width,
                        firstColumn: getComputedStyle(node.querySelector('.name-cell-content')).gridTemplateColumns.split(' ')[0] };
                });
                assert.equal(geometry.radius, '12px');
                assert.equal(geometry.dotRadius, '50%');
                assert.equal(geometry.dividerWidth, 1);
                assert.equal(geometry.dividerAfterHandle, true);
                assert.equal(geometry.dividerCentered, true, 'divider must sit midway between the visible grip dots and action icons');
                assert.equal(geometry.actionIcons, 2);
                assert.equal(geometry.railWidth, 24);
                assert.equal(geometry.firstColumn, '22px');
                assert.equal(await row('child').locator('.name-cell-tree-guide').count(), 1);
                assert.equal(await row('leaf').locator('.name-cell-tree-guide').count(), 2);
                assert.equal(await row('regex').locator('.name-cell-tree-guide.is-continuing').count(), 0);
                await row('parent').locator('.folder-tree-toggle').focus();
                assert.equal(await row('parent').locator('.folder-tree-toggle').evaluate(node => getComputedStyle(node).outlineStyle), 'solid');
                const otherCells = await row('parent').locator('td:not(.name-cell):not(.order-cell)').allTextContents();
                await row('parent').locator('.folder-tree-toggle').click();
                await row('child').waitFor({ state: 'detached' });
                assert.equal(await row('parent').locator('.folder-tree-toggle').getAttribute('aria-expanded'), 'false');
                await row('parent').locator('.folder-tree-toggle').click();
                await row('child').waitFor();
                assert.deepEqual(await row('parent').locator('td:not(.name-cell):not(.order-cell)').allTextContents(), otherCells);
                await page.emulateMedia({ reducedMotion: 'reduce' });
                await page.evaluate(() => document.documentElement.dir = 'rtl');
                assert.equal(await row('child').locator('.name-cell-tree-guide').evaluate(node => getComputedStyle(node).borderRightWidth), '2px');
                await page.evaluate(() => document.documentElement.dir = 'ltr');
                await page.screenshot({ path: `tmp/fixture-browser-artifacts/nested-${type}-${await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')}.png`, fullPage: true });
                await page.setViewportSize({ width: 390, height: 844 });
                await page.reload({ waitUntil: 'domcontentloaded' });
                await page.evaluate(async () => { await window.FolderViewPlusSettingsRuntimeHydrationPromise; });
                await row('leaf').waitFor();
                const layout = await row('leaf').evaluate(node => {
                    const cell = node.querySelector('.name-cell').getBoundingClientRect();
                    const icon = node.querySelector('.name-cell-content > img').getBoundingClientRect();
                    return { cellRight: cell.right, iconRight: icon.right,
                        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
                });
                assert.equal(layout.overflow, false);
                assert.ok(layout.iconRight <= layout.cellRight, 'nested artwork must fit inside the Name column');
            } finally { await host.close(); }
        }, { skipAccessibility: true });
    }
};
