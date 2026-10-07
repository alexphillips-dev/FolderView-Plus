import assert from 'node:assert/strict';

export const checkPrivacyResultIcons = async (page, type) => {
    const icons = page.locator('.fv-quickfinder-icon');
    assert.ok(await icons.count() > 0);
    await page.evaluate(type => document.body.classList.add(`fvplus-privacy-${type}-runtime-mask-names`), type);
    assert.ok((await icons.evaluateAll(nodes => nodes.map(node => getComputedStyle(node).filter))).every(value => value === 'blur(5px)'));
    await page.locator('.fv-quickfinder input').focus();
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('.fv-quickfinder-result[aria-current="true"] .fv-quickfinder-icon').evaluate(node => getComputedStyle(node).filter), 'blur(5px)');
    assert.equal(await page.locator('.fv-quickfinder input').evaluate(node => getComputedStyle(node).filter), 'none');
    await page.evaluate(type => document.body.classList.remove(`fvplus-privacy-${type}-runtime-mask-names`), type);
    assert.ok((await icons.evaluateAll(nodes => nodes.map(node => getComputedStyle(node).filter))).every(value => value === 'none'));
    await page.locator('.fv-quickfinder input').focus();
};

export const checkReadablePrivacyQuery = async (page, type) => {
    await page.evaluate(type => document.body.classList.add(`fvplus-privacy-${type}-runtime-mask-names`), type);
    assert.equal(await page.locator('.fv-quickfinder input').evaluate(node => getComputedStyle(node).filter), 'none');
    assert.notEqual(await page.locator('.fv-quickfinder-name').evaluate(node => getComputedStyle(node).filter), 'none');
    assert.notEqual(await page.locator('.fv-quickfinder-path').evaluate(node => getComputedStyle(node).filter), 'none');
    assert.equal(await page.locator('.fv-quickfinder-icon').evaluate(node => getComputedStyle(node).filter), 'blur(5px)');
    await page.locator('.fv-quickfinder input').fill('');
    await page.waitForFunction(() => !document.querySelector('.fv-quickfinder-result'));
    assert.equal(await page.locator('.fv-quickfinder input').evaluate(node => getComputedStyle(node).filter), 'none');
    await page.locator('.fv-quickfinder input').fill('Mosquitto');
    await page.waitForFunction(() => document.querySelector('.fv-quickfinder-name')?.textContent === 'Mosquitto');
    assert.equal(await page.locator('.fv-quickfinder input').inputValue(), 'Mosquitto');
    assert.equal(await page.locator('.fv-quickfinder input').evaluate(node => getComputedStyle(node).filter), 'none');
    assert.equal(await page.locator('.fv-quickfinder-icon').evaluate(node => getComputedStyle(node).filter), 'blur(5px)');
};
