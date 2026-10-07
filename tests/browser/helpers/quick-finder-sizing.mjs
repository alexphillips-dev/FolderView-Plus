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
            icon: document.querySelector('.fv-quickfinder-icon').getBoundingClientRect().width,
            width: document.querySelector('.fv-quickfinder-popover').getBoundingClientRect().width
        };
    });
    assert.ok(sizes.panel >= sizes.host * 0.9 && sizes.panel <= sizes.host, 'Results must follow the host text size despite a small root font');
    assert.ok(sizes.name <= sizes.host && sizes.action >= sizes.host * 0.85);
    assert.ok(sizes.footer >= sizes.host * 0.85);
    assert.ok(sizes.icon <= sizes.host * 2.5, 'Result icons must stay close to compact folder preview icons');
    assert.ok(sizes.width <= Math.min(560, page.viewportSize().width - 24), 'Compact results must fit desktop and mobile');
};
