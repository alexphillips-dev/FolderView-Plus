import assert from 'node:assert/strict';
export const registerSettingsShortcutFixtureCases = ({ test, baseUrl }) => {
test('Settings chrome keeps search and mode controls aligned without clipping', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 720 });
    await page.goto(`${baseUrl}/settings`, { waitUntil: 'load' });
    await page.addStyleTag({ url: baseUrl + '/plugin/styles/theme-profiles.css' });
    const metrics = await page.evaluate(() => {
        const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
        const search = rect('.fv-settings-search-wrap');
        const basic = rect('[data-mode="basic"]');
        const advanced = rect('[data-mode="advanced"]');
        const wizard = rect('#fv-run-wizard');
        return {
            searchRight: search.right,
            basicLeft: basic.left,
            tops: [basic.top, advanced.top, wizard.top],
            heights: [basic.height, advanced.height, wizard.height],
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth
        };
    });
    assert.ok(metrics.searchRight <= metrics.basicLeft + 1, 'search must not overlap the Basic button');
    assert.ok(Math.max(...metrics.tops) - Math.min(...metrics.tops) <= 2, 'mode and Wizard buttons must share a row');
    assert.ok(Math.max(...metrics.heights) - Math.min(...metrics.heights) <= 4, 'mode and Wizard buttons should have compatible heights');
    assert.ok(metrics.scrollWidth <= metrics.clientWidth + 1, 'Settings chrome must not cause horizontal overflow');
    assert.equal(await page.locator('#fv-settings-clear-search').isHidden(), true);
    await page.locator('#fv-settings-clear-search').evaluate((button) => { button.hidden = false; });
    const clearBox = await page.locator('#fv-settings-clear-search').boundingBox();
    assert.ok(clearBox.width <= 40 && clearBox.height <= 40, 'clear search control must stay compact');
    await page.locator('#fv-settings-topbar').evaluate(node => { node.dataset.fvMode = 'basic'; });
    for (const width of [1180, 390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        const shortcutMetrics = await page.locator('.fv-basic-shortcuts').evaluate(node => {
            const parent = node.getBoundingClientRect();
            return [...node.querySelectorAll('button')].map(button => {
                const rect = button.getBoundingClientRect();
                return rect.width > 0 && rect.height >= 44 && rect.left >= parent.left && rect.right <= parent.right;
            });
        });
        assert.deepEqual(shortcutMetrics, [true, true, true, true], 'Basic shortcuts fit at ' + width);
    }
    await page.locator('[data-fv-settings-shortcut="docker"]').focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('data-fv-settings-shortcut')), 'vms');
    await page.locator('#fv-settings-topbar').evaluate(node => { node.dataset.fvMode = 'advanced'; });
    assert.equal(await page.locator('.fv-basic-shortcuts').isHidden(), true);
});
};
