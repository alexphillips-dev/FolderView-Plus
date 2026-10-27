import assert from 'node:assert/strict';

export const exerciseDockerColumnDiagnostics = async ({ page, baseUrl }) => {
    await page.goto(`${baseUrl}/docker-layout-stability`, { waitUntil: 'load' });
    await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/folderviewplus.theme-integration.js` });
    await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/docker.runtime.layout-diagnostics.js` });
    await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/docker.runtime.diagnostics.js` });
    await page.evaluate(() => {
        const table = document.createElement('table');
        table.id = 'docker_containers';
        table.style.cssText = 'table-layout:fixed;width:600px;border-collapse:collapse';
        table.innerHTML = '<thead class="fixed"><tr><th style="width:200px">Application</th><th>Status</th><th>Version</th></tr></thead><tbody><tr><td>Fixture</td><td>Started</td><td>Current</td></tr></tbody>';
        document.body.appendChild(table);
        window.columnFixtureTracker = window.FolderViewPlusDockerRuntimeDiagnostics.createLayoutStabilityTracker({
            window, document, getViewMode: () => 'basic',
            onColumnSnapshot: () => localStorage.setItem('fixture.columnMovement', JSON.stringify(window.columnFixtureTracker.getSnapshot()))
        });
        window.dispatchEvent(new Event('pageshow'));
    });
    await page.waitForTimeout(1200);
    assert.equal(await page.evaluate(() => window.columnFixtureTracker.getSnapshot().columnMovement.sampleCount), 0);
    await page.waitForFunction(() => window.columnFixtureTracker.getSnapshot().columnMovement.sampleCount > 0);
    await page.evaluate(() => {
        window.columnFixtureTracker.recordColumnTrigger('host-loadlist');
        document.querySelector('#docker_containers th').style.width = '240px';
    });
    await page.waitForFunction(() => window.columnFixtureTracker.getSnapshot().columnMovement.maximumWidthChangePx >= 30);
    const state = await page.evaluate(() => {
        window.dispatchEvent(new Event('pagehide'));
        const saved = JSON.parse(localStorage.getItem('fixture.columnMovement'));
        window.columnFixtureTracker.destroy();
        return saved.columnMovement;
    });
    assert.equal(state.available, true);
    assert.equal(state.latest.fixedListing, true);
    assert.equal(state.events.at(-1).nearbyTrigger.kind, 'host-loadlist');
    assert.ok(state.maximumColumnShiftPx >= 30);
};
