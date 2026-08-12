import assert from 'node:assert/strict';

export const registerSettingsStartOrderFixtureCases = ({ test, baseUrl }) => {
test('Docker start order matches the responsive workspace mockup without page overflow', async ({ page }) => {
    const readLayout = async () => page.evaluate(() => {
        const fixture = document.getElementById('start-order-fixture');
        const summary = fixture.querySelector('.fv-start-order-summary-card');
        const top = fixture.querySelector('.fv-docker-start-order-top');
        const controls = fixture.querySelector('.fv-docker-start-order-controls');
        const table = fixture.querySelector('.fv-start-order-table');
        const tableWrap = fixture.querySelector('.fv-start-order-table-wrap');
        return {
            summaryMetrics: summary.querySelectorAll('.fv-start-order-summary-metric').length,
            topColumns: getComputedStyle(top).gridTemplateColumns.split(' ').filter(Boolean).length,
            controlColumns: getComputedStyle(controls).gridTemplateColumns.split(' ').filter(Boolean).length,
            tableColumns: getComputedStyle(table.querySelector('.fv-start-order-table-head')).gridTemplateColumns.split(' ').filter(Boolean).length,
            sequenceRows: table.querySelectorAll('.fv-docker-start-order-sequence > li').length,
            appIcons: table.querySelectorAll('.fv-start-order-container > img').length,
            enabledSwitches: table.querySelectorAll('.fv-start-order-switch input:checked').length,
            disabledChips: fixture.querySelectorAll('.fv-docker-start-order-disabled button').length,
            tableScrollContained: tableWrap.scrollWidth >= tableWrap.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth
        };
    });

    await page.setViewportSize({ width: 1500, height: 980 });
    await page.goto(`${baseUrl}/settings`, { waitUntil: 'load' });
    let layout = await readLayout();
    assert.equal(layout.summaryMetrics, 2);
    assert.equal(layout.topColumns, 2);
    assert.equal(layout.controlColumns, 2);
    assert.equal(layout.tableColumns, 5);
    assert.equal(layout.sequenceRows, 5);
    assert.equal(layout.appIcons, 5);
    assert.equal(layout.enabledSwitches, 5);
    assert.equal(layout.disabledChips, 2);
    assert.ok(layout.scrollWidth <= layout.clientWidth + 1, 'desktop start-order workspace must not overflow the page');

    await page.setViewportSize({ width: 700, height: 900 });
    layout = await readLayout();
    assert.equal(layout.topColumns, 1);
    assert.equal(layout.controlColumns, 1);
    assert.equal(layout.tableScrollContained, true);
    assert.ok(layout.scrollWidth <= layout.clientWidth + 1, 'mobile table scrolling must remain inside the start-order card');
});
};
