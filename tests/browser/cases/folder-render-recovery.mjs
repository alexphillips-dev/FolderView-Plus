import assert from 'node:assert/strict';

export const registerFolderRenderRecoveryFixtureCases = ({ test, baseUrl }) => {
test('Folder render failure restores native controls and leaves healthy folders usable', async ({ page }) => {
    await page.goto(`${baseUrl}/fixtures/folder-render-recovery.html`, { waitUntil: 'load' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => { document.body.dataset.fvThemeClass = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; });
    const result = await page.evaluate(() => window.fixtureRecovery.run());
    assert.deepEqual(result, {
        sameRow: true, focus: true, value: 'unsaved value', nativeClass: 'host-row', display: '',
        nativeLabel: 'Native control ', originalSettings: true,
        snapshot: { failedFolderCount: 1, recoveredFolderCount: 1 }, cleaned: 1
    });
    assert.equal(await page.locator('.partial').count(), 0);
    assert.equal(await page.locator('.healthy').count(), 1);
    assert.equal(await page.locator('#native > #one').count(), 1);
    assert.equal(await page.locator('.fv-folder-render-warning script').count(), 0);
    const link = page.locator('.fv-folder-render-warning a');
    assert.equal(new URL(await link.getAttribute('href'), baseUrl).searchParams.get('id'), 'broken & special');
    await page.locator('#control').click();
    assert.equal(await page.evaluate(() => window.fixtureRecovery.state.clicks), 1);
    await link.focus();
    assert.equal(await link.evaluate((element) => element === document.activeElement), true);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.ok((await link.boundingBox()).height >= 44);
    await page.evaluate(() => document.body.classList.add('fvplus-privacy-docker-runtime-mask-names'));
    assert.equal(await page.locator('.fv-folder-render-warning-name').evaluate((element) => getComputedStyle(element).filter), 'blur(5px)');
    await page.evaluate(() => window.fixtureRecovery.retry());
    assert.equal(await page.locator('.fv-folder-render-warning').count(), 0);
    assert.equal(await page.locator('#native').getAttribute('data-fv-folder-render-failures'), '0');
    assert.equal(await page.locator('#native > #one').count(), 1);
});
};
