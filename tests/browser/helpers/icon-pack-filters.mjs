import assert from 'node:assert/strict';

export const checkIconPackFilters = async (page, checkAccessibility) => {
    const toggle = page.locator('#fv-third-party-filter-toggle');
    const menu = page.getByRole('dialog', { name: 'Filters', exact: true });
    const grid = page.locator('#fv-third-party-icon-grid');
    assert.equal(await page.locator('#fv-third-party-search-clear,#fv-third-party-preset-folder-icons,.fv-third-party-presets').count(), 0);
    const row = await toggle.evaluate(button => {
        const box = button.getBoundingClientRect(), search = document.getElementById('fv-third-party-search').getBoundingClientRect();
        return { aligned: Math.abs(box.top - search.top) < 2, adjacent: document.dir === 'rtl' ? box.right <= search.left : box.left >= search.right };
    });
    assert.ok(row.aligned && row.adjacent);
    const before = await grid.boundingBox();
    await toggle.click();
    await menu.waitFor();
    await page.waitForFunction(() => document.querySelector('.fv-icon-filter-popover')?.style.left);
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    const bounds = await menu.evaluate(node => {
        const box = node.getBoundingClientRect();
        return { fixed: getComputedStyle(node).position === 'fixed', inside: box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight };
    });
    assert.ok(bounds.fixed && bounds.inside);
    assert.ok(Math.abs((await grid.boundingBox()).y - before.y) < 1);
    await checkAccessibility(page);
    const checkbox = menu.locator('[data-third-party-tag="alpha"]');
    await checkbox.check();
    await checkbox.focus();
    await page.keyboard.press('Space');
    assert.equal(await page.locator('.fv-third-party-icon-item').count(), 3);
    assert.equal(await checkbox.evaluate(input => document.activeElement === input), true);
    await page.keyboard.press('Space');
    assert.equal(await page.locator('.fv-third-party-icon-item').count(), 2);
    await page.keyboard.press('Escape');
    assert.equal(await menu.count(), 0);
    assert.equal(await toggle.evaluate(button => document.activeElement === button), true);
    await toggle.click();
    assert.equal(await menu.locator('[data-third-party-tag="alpha"]').isChecked(), true);
    await menu.locator('#fv-third-party-filter-clear-all').click();
    await page.waitForFunction(() => document.querySelectorAll('.fv-third-party-icon-item').length === 3);
    await page.locator('#fv-third-party-search').click();
    assert.equal(await menu.count(), 0);
    await toggle.click();
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('fvplus:editor-section-change', { detail: { section: 'members' } })));
    assert.equal(await menu.count(), 0);
    await toggle.click();
    await page.evaluate(() => document.getElementById('fv-icon-picker-toggle').click());
    assert.equal(await menu.count(), 0);
    await page.getByRole('tab', { name: 'Icon Packs' }).click();
};
