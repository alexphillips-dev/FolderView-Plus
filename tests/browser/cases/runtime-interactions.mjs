import assert from 'node:assert/strict';

export const registerRuntimeInteractionsFixtureCases = ({ test, baseUrl }) => {
test('Docker folder filters and Reset view reconcile immediately', async ({ page }) => {
    await page.goto(`${baseUrl}/runtime`, { waitUntil: 'load' });
    await page.click('[data-fvplus-docker-action="filter-empty"]');
    const visibleFolderIds = await page.locator('#docker_list > tr.folder:not(.fv-toolbar-filter-hidden)').evaluateAll((rows) => rows.map((row) => row.dataset.folderId));
    assert.deepEqual(visibleFolderIds, ['empty']);
    await page.click('[data-fvplus-docker-menu="tools"]');
    await page.click('[data-fvplus-docker-tool="reset"]');
    assert.equal(await page.locator('#docker_list > tr.folder.fv-toolbar-filter-hidden').count(), 0);
    assert.equal(await page.evaluate(() => window.fixtureRuntime.api.getFilterMode()), 'all');
});

test('Docker View menu switches Host list and FolderView without duplicating rows', async ({ page }) => {
    await page.goto(`${baseUrl}/runtime`, { waitUntil: 'load' });
    const initialRows = await page.locator('#docker_list > tr').count();
    for (const mode of ['host', 'folderview', 'host', 'folderview']) {
        await page.click('[data-fvplus-docker-menu="view"]');
        await page.click(`[data-fvplus-docker-view="${mode}"]`);
        await page.waitForFunction((expected) => document.body.dataset.fixtureView === expected, mode);
    }
    assert.equal(await page.locator('#docker_list > tr').count(), initialRows);
    assert.equal(await page.locator('#fvplus-docker-action-bar').count(), 1);
    assert.equal(await page.evaluate(() => window.fixtureRuntime.getRefreshCount()), 4);
});

test('Docker action menus support keyboard open and Escape close', async ({ page }) => {
    await page.goto(`${baseUrl}/runtime`, { waitUntil: 'load' });
    const trigger = page.locator('[data-fvplus-docker-menu="view"]');
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('Escape');
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-fvplus-docker-menu')), 'view');
});

test('Privacy classifier honors each secondary masking preference independently', async ({ page }) => {
    await page.goto(`${baseUrl}/runtime`, { waitUntil: 'load' });
    await page.evaluate(() => window.FolderViewPlusRuntimePrivacy.apply('docker', true, {
        privacyMaskVolumePaths: false,
        privacyMaskImageRegistry: true,
        privacyMaskPublicIps: true,
        privacyMaskInterfaces: true,
        privacyMaskExternalUrls: true
    }));
    await page.waitForFunction(() => document.querySelector('#fixture-public-ip')?.classList.contains('fvplus-sensitive-public-ip'));
    assert.equal(await page.locator('body.fvplus-privacy-docker-sensitive-publicIps').count(), 1);
    assert.equal(await page.locator('body.fvplus-privacy-docker-sensitive-volumePaths').count(), 0);
    assert.equal(await page.locator('#fixture-volume.fvplus-sensitive-volume-path').count(), 1);
    assert.equal(await page.locator('#fixture-public-ip.fvplus-sensitive-public-ip').count(), 1);
    assert.equal(await page.locator('#fixture-private-ip.fvplus-sensitive-public-ip').count(), 0);
    assert.equal(await page.locator('#fixture-interface.fvplus-sensitive-interface').count(), 1);
    assert.equal(await page.locator('#fixture-external-url.fvplus-sensitive-external-url').count(), 1);
    const maskedFilter = await page.locator('#fixture-public-ip').evaluate((node) => getComputedStyle(node).filter);
    const unmaskedFilter = await page.locator('#fixture-volume').evaluate((node) => getComputedStyle(node).filter);
    assert.notEqual(maskedFilter, 'none');
    assert.equal(unmaskedFilter, 'none');
    await page.evaluate(() => window.FolderViewPlusRuntimePrivacy.apply('docker', false, {}));
    assert.equal(await page.locator('body.fvplus-privacy-docker-sensitive').count(), 0);
});

test('Docker Privacy toggle preserves its widget through optimistic, confirmed, external, and failed saves', async ({ page }) => {
    await page.goto(`${baseUrl}/runtime`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.fixtureRuntime?.privacyToggle);
    await page.evaluate(() => {
        window.fixtureRuntime.privacyToggle.rememberIdentity();
        window.fixtureRuntime.privacyToggle.syncRepeatedly(8);
    });

    const initial = await page.evaluate(() => window.fixtureRuntime.privacyToggle.snapshot());
    assert.equal(initial.mounted, true);
    assert.equal(initial.enabled, false);
    assert.equal(initial.pending, false);
    assert.equal(initial.mountCount, 1);
    assert.equal(initial.switchInitializeCount, 1);
    assert.equal(initial.privacySwitchInitializeCount, 1);
    assert.equal(initial.identityStable, true);

    await page.click('#fixture-privacy-shell .switch-button-background');
    const optimistic = await page.evaluate(() => window.fixtureRuntime.privacyToggle.snapshot());
    assert.equal(optimistic.enabled, true);
    assert.equal(optimistic.state.enabled, true);
    assert.equal(optimistic.pending, true);
    assert.equal(optimistic.widgetChecked, 'true');
    assert.equal(optimistic.identityStable, true);
    assert.equal(optimistic.mountCount, 1);
    assert.equal(optimistic.switchInitializeCount, 1);
    assert.deepEqual(
        optimistic.events.filter((entry) => entry.type === 'toggle'),
        [{ type: 'toggle', enabled: true }]
    );

    await page.evaluate(() => {
        window.fixtureRuntime.privacyToggle.syncRepeatedly(8);
        window.fixtureRuntime.privacyToggle.resolveSave();
    });
    const confirmed = await page.evaluate(() => window.fixtureRuntime.privacyToggle.snapshot());
    assert.equal(confirmed.enabled, true);
    assert.equal(confirmed.pending, false);
    assert.equal(confirmed.widgetChecked, 'true');
    assert.equal(confirmed.identityStable, true);
    assert.equal(confirmed.mountCount, 1);
    assert.equal(confirmed.switchInitializeCount, 1);

    await page.evaluate(() => window.fixtureRuntime.privacyToggle.applyExternalState(false));
    const external = await page.evaluate(() => window.fixtureRuntime.privacyToggle.snapshot());
    assert.equal(external.enabled, false);
    assert.equal(external.widgetChecked, 'false');
    assert.equal(external.identityStable, true);
    assert.equal(external.events.filter((entry) => entry.type === 'toggle').length, 1, 'programmatic synchronization must not queue another save');

    await page.click('#fixture-privacy-shell .switch-button-background');
    await page.evaluate(() => window.fixtureRuntime.privacyToggle.rejectSave());
    await page.waitForFunction(() => (
        window.fixtureRuntime.privacyToggle.snapshot().events.some((entry) => entry.type === 'error')
    ));
    const failed = await page.evaluate(() => window.fixtureRuntime.privacyToggle.snapshot());
    assert.equal(failed.enabled, true);
    assert.equal(failed.state.enabled, true);
    assert.equal(failed.pending, false);
    assert.equal(failed.widgetChecked, 'true');
    assert.equal(failed.identityStable, true);
    assert.equal(failed.mountCount, 1);
    assert.equal(failed.switchInitializeCount, 1);
    assert.equal(failed.privacySwitchInitializeCount, 1);
    assert.equal(failed.events.filter((entry) => entry.type === 'toggle').length, 2, 'repeated synchronization must not duplicate the change handler');
    assert.deepEqual(
        failed.events.filter((entry) => entry.type === 'error').map((entry) => entry.message),
        ['fixture save failed']
    );
});

test('Standard request client sends mutation markers, token, and trace ID', async ({ page }) => {
    await page.goto(`${baseUrl}/runtime`, { waitUntil: 'load' });
    const response = await page.evaluate(() => window.FolderViewPlusRequest.postJson('/api/echo.php', { hello: 'world' }));
    assert.equal(response.ok, true);
    assert.equal(response.body.hello, 'world');
    assert.equal(response.body._fv_request, '1');
    assert.equal(response.body._fv_nonce, 'a'.repeat(64));
    assert.equal(response.headers.request, '1');
    assert.equal(response.headers.token, 'fixture-request-token-1234567890');
    assert.equal(response.headers.nonce, 'a'.repeat(64));
    assert.match(response.headers.trace, /^fv-/);
});

test('Lifecycle reconciliation replaces host loadlist with incremental refreshes', async ({ page }) => {
    await page.goto(`${baseUrl}/runtime`, { waitUntil: 'load' });
    const result = await page.evaluate(() => window.fixtureRuntime.exerciseLifecyclePatch());
    assert.equal(result.callbackName, '__fvplusDockerLifecycleRefresh');
    assert.equal(result.calls, 1);
    assert.equal(result.lifecycleRefreshes, 3);
});
};
