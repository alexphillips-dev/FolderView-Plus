import assert from 'node:assert/strict';

export const assertQuickFinderNativeScale = async page => {
    const scale = await page.evaluate(() => {
        const native = document.querySelector('#docker_list .folder-preview .appname');
        const nativeIcon = document.querySelector('#docker_list .folder-preview img.img');
        const result = document.querySelector('.fv-quickfinder-container-result .fv-quickfinder-name');
        const resultIcon = document.querySelector('.fv-quickfinder-container-result .fv-quickfinder-icon');
        return {
            name: parseFloat(getComputedStyle(result).fontSize) / parseFloat(getComputedStyle(native).fontSize),
            icon: resultIcon.getBoundingClientRect().width / nativeIcon.getBoundingClientRect().width
        };
    });
    assert.ok(scale.name >= 0.85 && scale.name <= 1.1, 'Search names must match the native Docker preview text scale');
    assert.ok(scale.icon >= 0.8 && scale.icon <= 1.15, 'Search icons must match the native Docker preview icon scale');
};
