import assert from 'node:assert/strict';

export const checkVmPauseResume = async (page, baseUrl) => {
    await page.goto(`${baseUrl}/vm-lifecycle`, { waitUntil: 'load' });
    await page.click('#fixture-vm-row');
    await page.click('#fixture-context-menu [data-action="domain-pause"]');
    await page.waitForFunction(() => {
        const snapshot = window.fixtureVmLifecycle.getSnapshot();
        return snapshot.runtimeState === 'paused' && snapshot.busyIconCount === 0;
    });
    let snapshot = await page.evaluate(() => window.fixtureVmLifecycle.getSnapshot());
    assert.equal(snapshot.folderText, '1/1 paused');
    assert.match(snapshot.memberIconClasses, /fa-pause/);
    assert.match(snapshot.memberIconClasses, /orange-text/);

    await page.click('#fixture-vm-row');
    assert.deepEqual(await page.locator('#fixture-context-menu [data-action]').evaluateAll((buttons) => buttons.map((button) => button.dataset.action)), [
        'domain-resume', 'domain-destroy'
    ]);
    await page.click('#fixture-context-menu [data-action="domain-resume"]');
    await page.waitForFunction(() => {
        const current = window.fixtureVmLifecycle.getSnapshot();
        return current.runtimeState === 'running' && current.busyIconCount === 0;
    });
    snapshot = await page.evaluate(() => window.fixtureVmLifecycle.getSnapshot());
    assert.equal(snapshot.nativeLoadlistCount, 0);
    assert.equal(snapshot.lifecycle.fallbackCount, 0);
    assert.equal(snapshot.consoleIconClasses, 'fa fa-desktop');
    assert.equal(snapshot.menuIconClasses, 'fa fa-bars');
    await page.evaluate(() => {
        window.fixtureVmLifecycle.setStaleRefreshBudget(2);
        window.ajaxVMDispatch({ action: 'domain-pause', uuid: 'vm-1' }, 'loadlist');
        window.ajaxVMDispatch({ action: 'domain-resume', uuid: 'vm-1' }, 'loadlist');
    });
    await page.waitForFunction(() => {
        const state = window.fixtureVmLifecycle.getSnapshot();
        return state.lifecycle.eventGroups.lifecycleStaleGenerationCancelled > 0
            && state.runtimeState === 'running' && state.busyIconCount === 0
            && document.querySelectorAll('#fixture-vm-row [aria-busy="true"]').length === 0;
    });
    snapshot = await page.evaluate(() => window.fixtureVmLifecycle.getSnapshot());
    assert.equal(snapshot.nativeLoadlistCount, 0);
    assert.equal(snapshot.consoleIconClasses, 'fa fa-desktop');
    assert.equal(snapshot.menuIconClasses, 'fa fa-bars');
};
