import assert from 'node:assert/strict';

export const assertQuickFinderNativeScale = async page => {
    const hostSpacing = await page.addStyleTag({ content: 'span.outer,span.inner,span.hand{min-height:5em;margin-bottom:1em;padding-bottom:1em;}' });
    const scale = await page.evaluate(() => {
        const native = document.querySelector('#docker_list .folder-preview .appname');
        const nativeIcon = document.querySelector('#docker_list .folder-preview img.img');
        const result = document.querySelector('.fv-quickfinder-container-result .fv-quickfinder-name');
        const resultIcon = document.querySelector('.fv-quickfinder-container-result .fv-quickfinder-icon');
        const card = result.closest('.fv-quickfinder-container-result');
        const visible = [...card.querySelectorAll('.fv-quickfinder-icon,.fv-quickfinder-name,.fv-quickfinder-status,.fv-quickfinder-actions,.fv-quickfinder-path,.fv-quickfinder-more')].map(node => node.getBoundingClientRect()).filter(rect => rect.height);
        return {
            bottomGap: (card.getBoundingClientRect().bottom - Math.max(...visible.map(rect => rect.bottom))) / parseFloat(getComputedStyle(card).fontSize),
            name: parseFloat(getComputedStyle(result).fontSize) / parseFloat(getComputedStyle(native).fontSize),
            icon: resultIcon.getBoundingClientRect().width / nativeIcon.getBoundingClientRect().width
        };
    });
    assert.ok(scale.name >= 0.85 && scale.name <= 1.1, 'Search names must match the native Docker preview text scale');
    assert.ok(scale.icon >= 0.8 && scale.icon <= 1.15, 'Search icons must match the native Docker preview icon scale');
    assert.ok(scale.bottomGap <= 0.8, 'Native wrapper height and spacing must not leave an empty band below search content');
    await hostSpacing.evaluate(node => node.remove());
};
