import assert from 'node:assert/strict';

export const registerDockerHiddenFolderFixtureCases = ({ test, baseUrl }) => {
test('Docker hidden folders remain recoverable through reveal, restore all, and undo', async ({ page }) => {
    await page.goto(`${baseUrl}/runtime`, { waitUntil: 'load' });
    await page.evaluate(() => window.fixtureRuntime.hiddenFolders.hideFolder('media'));
    assert.equal(await page.locator('#docker_list > tr.fv-folder-user-hidden').count(), 3);
    assert.equal(await page.locator('#docker_list > tr.folder-id-media').isVisible(), false);

    await page.click('[data-fvplus-docker-menu="view"]');
    const revealControl = page.locator('#fvplus-docker-action-bar .fvplus-docker-action-menu.is-open [data-fvplus-docker-hidden="toggle-reveal"]');
    assert.match(await revealControl.textContent(), /Hidden folders \(1\)/);
    await revealControl.click();
    assert.equal(await page.locator('#docker_list > tr.folder-id-media').isVisible(), true);
    assert.equal(await page.locator('#docker_list > tr.folder-id-media .fv-folder-hidden-indicator').count(), 1);

    await page.click('[data-fvplus-docker-menu="view"]');
    await page.click('[data-fvplus-docker-hidden="restore-all"]');
    await page.waitForFunction(() => window.fixtureRuntime.hiddenFolders.getSummary().explicitCount === 0);
    assert.equal(await page.locator('#docker_list > tr.fv-folder-user-hidden').count(), 0);

    await page.evaluate(() => window.fixtureRuntime.hiddenFolders.hideFolder('updates'));
    await page.click('[data-fvplus-docker-hidden="undo"]');
    await page.waitForFunction(() => window.fixtureRuntime.hiddenFolders.getSummary().explicitCount === 0);
    assert.equal(await page.locator('#docker_list > tr.folder-id-updates').isVisible(), true);
});
};
