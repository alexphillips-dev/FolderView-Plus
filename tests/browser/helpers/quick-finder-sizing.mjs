import assert from 'node:assert/strict';

export const assertQuickFinderSizing = async (page) => {
    await page.evaluate(() => {
        document.documentElement.style.fontSize = '10px';
        document.body.style.fontSize = '13px';
    });
    const sizes = await page.evaluate(() => {
        const font = selector => parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
        return {
            host: font('body'), panel: font('.fv-quickfinder-popover'),
            name: font('.fv-quickfinder-name'), action: font('[data-finder-action="focus"]'),
            footer: font('.fv-quickfinder-footer'),
            width: document.querySelector('.fv-quickfinder-popover').getBoundingClientRect().width
        };
    });
    assert.ok(sizes.panel >= 14 && sizes.panel >= sizes.host, 'Small host root fonts must keep results readable');
    assert.ok(sizes.name >= sizes.panel && sizes.action >= sizes.host - 1);
    assert.ok(sizes.footer >= sizes.host - 2);
    assert.ok(sizes.width <= Math.min(640, page.viewportSize().width - 24), 'Results must use the narrower panel and fit mobile');
};
