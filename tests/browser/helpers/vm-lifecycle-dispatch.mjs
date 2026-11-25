import assert from 'node:assert/strict';

export const checkVmLateAndFailedDispatch = async page => {
    await page.evaluate(() => {
        window.fixtureVmLifecycle.deferNextDispatch(100);
        window.ajaxVMDispatch({ action: 'domain-stop', uuid: 'vm-1' }, 'loadlist');
        window.ajaxVMDispatch({ action: 'domain-pause', uuid: 'vm-1' }, 'loadlist');
    });
    await page.waitForFunction(() => {
        const state = window.fixtureVmLifecycle.getSnapshot();
        return state.hostState === 'shutoff' && state.runtimeState === 'shutoff' && state.busyIconCount === 0
            && document.querySelectorAll('#fixture-vm-row [aria-busy="true"]').length === 0;
    });
    const snapshot = await page.evaluate(() => window.fixtureVmLifecycle.getSnapshot());
    assert.equal(snapshot.nativeLoadlistCount, 0);
    assert.equal(snapshot.consoleIconClasses, 'fa fa-desktop');
    assert.equal(snapshot.menuIconClasses, 'fa fa-bars');

    const url = '**/include/VMajax.php';
    const failNativeAction = route => route.fulfill({ status: 503, contentType: 'text/plain', body: 'Synthetic outage' });
    await page.route(url, failNativeAction);
    try {
        const response = page.waitForResponse(url);
        await page.evaluate(() => {
            window.fixtureVmLifecycle.useTransportForNextDispatch();
            window.ajaxVMDispatch({ action: 'domain-start', uuid: 'vm-1' }, 'loadlist');
        });
        assert.equal((await response).status(), 503);
        await page.waitForFunction(generation => {
            const { lifecycle, runtimeState, busyIconCount } = window.fixtureVmLifecycle.getSnapshot();
            return lifecycle.activeGeneration > generation && lifecycle.queuedRequestCount === 0
                && lifecycle.pending.length === 0 && runtimeState === 'shutoff' && busyIconCount === 0;
        }, snapshot.lifecycle.activeGeneration);
        const afterFailure = await page.evaluate(() => window.fixtureVmLifecycle.getSnapshot());
        assert.equal(afterFailure.nativeLoadlistCount, 0);
        assert.match(afterFailure.memberIconClasses, /fa-square/);
    } finally {
        await page.unroute(url, failNativeAction);
    }
};
