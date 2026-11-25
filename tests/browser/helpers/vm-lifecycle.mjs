import assert from 'node:assert/strict';
import { checkVmLateAndFailedDispatch } from './vm-lifecycle-dispatch.mjs';

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
    await checkVmLateAndFailedDispatch(page);
};
