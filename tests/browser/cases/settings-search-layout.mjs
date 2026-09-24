import assert from 'node:assert/strict';

export const verifySettingsSearchAlignment = async (page) => {
    const desktop = await page.evaluate(() => {
        const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
        const search = rect('.fv-settings-search-wrap');
        const icon = rect('.fv-settings-search-icon');
        const input = rect('#fv-settings-search');
        const buttons = ['[data-mode="basic"]', '[data-mode="advanced"]', '#fv-run-wizard'].map(rect);
        return {
            searchCenter: (search.top + search.bottom) / 2,
            buttonCenters: buttons.map((box) => (box.top + box.bottom) / 2),
            iconInputGap: input.left - icon.right
        };
    });
    assert.ok(Math.max(...desktop.buttonCenters.map((center) => Math.abs(desktop.searchCenter - center))) <= 1.5,
        `search must be vertically centered with the buttons: ${JSON.stringify(desktop)}`);
    assert.ok(desktop.iconInputGap >= 6, 'search icon needs breathing room before the text');

    await page.setViewportSize({ width: 390, height: 720 });
    const mobile = await page.evaluate(() => {
        const icon = document.querySelector('.fv-settings-search-icon').getBoundingClientRect();
        const input = document.querySelector('#fv-settings-search').getBoundingClientRect();
        const search = document.querySelector('.fv-settings-search-wrap').getBoundingClientRect();
        return {
            iconInputGap: input.left - icon.right,
            searchWidth: search.width,
            searchLeft: search.left,
            searchRight: search.right,
            viewportWidth: window.innerWidth
        };
    });
    assert.ok(mobile.iconInputGap >= 6, 'mobile search icon needs breathing room before the text');
    assert.ok(mobile.searchWidth > 0 && mobile.searchLeft >= -1 && mobile.searchRight <= mobile.viewportWidth + 1,
        `mobile search field must fit within the viewport: ${JSON.stringify(mobile)}`);
};
