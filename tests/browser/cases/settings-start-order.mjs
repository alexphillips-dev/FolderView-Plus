import assert from 'node:assert/strict';

export const registerSettingsStartOrderFixtureCases = ({ test, baseUrl }) => {
test('Docker start order matches the responsive workspace mockup without page overflow', async ({ page }) => {
    const readLayout = async () => page.evaluate(() => {
        const fixture = document.getElementById('start-order-fixture');
        const summary = fixture.querySelector('.fv-start-order-summary-card');
        const top = fixture.querySelector('.fv-docker-start-order-top');
        const controls = fixture.querySelector('.fv-docker-start-order-controls'); const help = fixture.querySelector('.fv-docker-start-order-help');
        const table = fixture.querySelector('.fv-start-order-table');
        const tableWrap = fixture.querySelector('.fv-start-order-table-wrap');
        return {
            summaryMetrics: summary.querySelectorAll('.fv-start-order-summary-metric').length, summaryValues: [...summary.querySelectorAll('.fv-start-order-summary-metric strong')].map((node) => node.textContent.trim()),
            topColumns: getComputedStyle(top).gridTemplateColumns.split(' ').filter(Boolean).length,
            controlColumns: getComputedStyle(controls).gridTemplateColumns.split(' ').filter(Boolean).length, helpCompact: help.offsetHeight < top.offsetHeight && Math.abs(help.getBoundingClientRect().top - top.getBoundingClientRect().top) <= 1,
            tableColumns: getComputedStyle(table.querySelector('.fv-start-order-table-head')).gridTemplateColumns.split(' ').filter(Boolean).length,
            sequenceRows: table.querySelectorAll('.fv-docker-start-order-sequence > li').length,
            appIcons: table.querySelectorAll('.fv-start-order-container > img').length,
            enabledSwitches: table.querySelectorAll('.fv-start-order-switch input:checked').length,
            disabledChips: fixture.querySelectorAll('.fv-docker-start-order-disabled button').length, disabledOpen: fixture.querySelector('.fv-docker-start-order-disabled').open,
            minimumTextPx: Math.min(...[...fixture.querySelectorAll('h2, p, summary, button, label, input, select, small, strong, span')].map((node) => parseFloat(getComputedStyle(node).fontSize))),
            tableScrollContained: tableWrap.scrollWidth >= tableWrap.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth
        };
    });
    await page.setViewportSize({ width: 1500, height: 980 });
    await page.goto(`${baseUrl}/settings`, { waitUntil: 'load' });
    let layout = await readLayout();
    assert.equal(layout.summaryMetrics, 2); assert.deepEqual(layout.summaryValues, ['7', '5']);
    assert.equal(layout.topColumns, 2);
    assert.equal(layout.controlColumns, 2); assert.equal(layout.helpCompact, true);
    assert.equal(layout.tableColumns, 5);
    assert.equal(layout.sequenceRows, 5);
    assert.equal(layout.appIcons, 5);
    assert.equal(layout.enabledSwitches, 5);
    assert.equal(layout.disabledChips, 2); assert.equal(layout.disabledOpen, false); assert.ok(layout.minimumTextPx >= 19.2, 'all start-order text must be at least 1.2rem');
    assert.ok(layout.scrollWidth <= layout.clientWidth + 1, 'desktop start-order workspace must not overflow the page');
    await page.locator('.fv-docker-start-order-disabled > summary').click(); layout = await readLayout(); assert.equal(layout.disabledOpen, true); assert.ok(layout.minimumTextPx >= 19.2);

    await page.setViewportSize({ width: 700, height: 900 });
    layout = await readLayout();
    assert.equal(layout.topColumns, 1);
    assert.equal(layout.controlColumns, 1);
    assert.equal(layout.tableScrollContained, true);
    assert.ok(layout.scrollWidth <= layout.clientWidth + 1, 'mobile table scrolling must remain inside the start-order card');
});
};
