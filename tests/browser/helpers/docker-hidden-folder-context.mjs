import assert from 'node:assert/strict';

export const assertImmediateThemedUndo = async (page, folderId) => {
    await page.evaluate(() => window.fixtureRuntime.hiddenFolderPersistence.defer());
    await page.evaluate((id) => { void window.fixtureRuntime.hiddenFolders.hideFolder(id); }, folderId);
    assert.equal(await page.locator('#docker_list > tr.fv-folder-user-hidden').count(), 3);
    assert.equal(await page.locator(`#docker_list > tr.folder-id-${folderId}`).isVisible(), false);
    assert.equal(await page.evaluate(() => window.fixtureRuntime.hiddenFolderPersistence.isPending()), true);
    const undoButton = page.locator('[data-fvplus-docker-hidden="undo"]');
    assert.equal(await undoButton.isVisible(), true, 'Undo must render before the deferred preference save resolves');
    const themedButton = await undoButton.evaluate((button) => {
        const probe = document.createElement('div');
        probe.style.cssText = 'position:absolute;left:-9999px;border:1px solid var(--fvplus-ui-border-subtle);background:var(--fvplus-ui-control);color:var(--fvplus-ui-text-primary)';
        document.body.appendChild(probe);
        const buttonStyle = getComputedStyle(button);
        const probeStyle = getComputedStyle(probe);
        const result = {
            classApplied: button.classList.contains('fvplus-docker-visibility-button'),
            borderColor: buttonStyle.borderTopColor, expectedBorderColor: probeStyle.borderTopColor,
            backgroundColor: buttonStyle.backgroundColor, expectedBackgroundColor: probeStyle.backgroundColor,
            color: buttonStyle.color, expectedColor: probeStyle.color
        };
        probe.remove();
        return result;
    });
    assert.equal(themedButton.classApplied, true);
    assert.equal(themedButton.borderColor, themedButton.expectedBorderColor);
    assert.equal(themedButton.backgroundColor, themedButton.expectedBackgroundColor);
    assert.equal(themedButton.color, themedButton.expectedColor);
    await page.evaluate(() => window.fixtureRuntime.hiddenFolderPersistence.resolve());
};
