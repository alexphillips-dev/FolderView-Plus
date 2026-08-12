import assert from 'node:assert/strict';

export const registerDockerFixtureCases = ({ test, baseUrl }) => {
test('Docker action bar is idempotent and reports fixture counts', async ({ page }) => {
    await page.goto(`${baseUrl}/runtime`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.fixtureRuntime?.api);
    await page.evaluate(() => window.fixtureRuntime.syncRepeatedly(8));
    assert.equal(await page.locator('#fvplus-docker-action-bar').count(), 1);
    assert.equal(await page.locator('[data-fvplus-docker-action="filter-unassigned"] .fvplus-docker-action-count').textContent(), '1');
    assert.equal(await page.locator('[data-fvplus-docker-action="filter-updates"] .fvplus-docker-action-count').textContent(), '1');
    assert.equal(await page.locator('[data-fvplus-docker-action="filter-empty"] .fvplus-docker-action-count').textContent(), '1');
});

test('Docker preview hydration and cached-width bootstrap preserve first-frame geometry', async ({ page }) => {
    await page.goto(`${baseUrl}/docker-layout-stability`, { waitUntil: 'load' });
    const result = await page.evaluate(() => window.fixturePreviewActionStability.run());
    assert.equal(result.consoleNodePreserved, true, 'console action node must be reconciled in place');
    assert.equal(result.logsNodePreserved, true, 'logs action node must be reconciled in place');
    assert.ok(result.consoleShiftPx <= 0.1, `console action shifted ${result.consoleShiftPx}px`);
    assert.ok(result.logsShiftPx <= 0.1, `logs action shifted ${result.logsShiftPx}px`);
    assert.equal(result.webuiReady, true);
    assert.equal(result.pendingWebui, 0);
    assert.equal(result.slotWidths.length, 3);
    assert.equal(result.slotWidths.every((width) => Math.abs(width - 13) <= 0.1), true);
    assert.equal(result.bootstrapWidth, 286);
    assert.equal(result.firstVisibleWidth, 286);
    assert.equal(result.settledWidth, result.firstVisibleWidth);
});

test('Docker folder context menu opens from the first folder-icon click', async ({ page }) => {
    await page.goto(`${baseUrl}/docker-layout-stability`, { waitUntil: 'load' });
    const result = await page.evaluate(() => window.fixtureFolderContextFirstClick.run());
    assert.equal(result.attachCount, 1, 'the first click must prepare the folder context menu once');
    assert.equal(result.openCount, 1, 'the first click must reach the newly attached context-menu opener');
    assert.equal(result.defaultPrevented, false, 'menu preparation must not cancel the opening click');
});

test('Docker folder Unpin intent is retained while the preceding Pin save settles', async ({ page }) => {
    await page.goto(`${baseUrl}/docker-layout-stability`, { waitUntil: 'load' });
    const result = await page.evaluate(() => window.fixtureQueuedFolderPinIntent.run());
    assert.equal(result.queuedBeforeSave, true, 'Unpin must queue while Pin is saving');
    assert.equal(result.pinnedBeforeSave, false, 'Unpin must update the visible state before Pin finishes saving');
    assert.equal(result.pinned, false, 'one queued Unpin action must produce the requested final state');
    assert.deepEqual(result.transitions, ['pinned', 'unpinned', 'pin-saved', 'unpin-saved']);
    assert.equal(result.runningAfterSave, false);
    assert.equal(result.queuedAfterSave, false);
});

test('Docker and VM host adapters share row, structure, and idempotent hook contracts', async ({ page }) => {
    await page.goto(`${baseUrl}/runtime`, { waitUntil: 'load' });
    const result = await page.evaluate(() => window.fixtureRuntime.exerciseHostAdapters());
    assert.equal(result.dockerSnapshot.structure.valid, true);
    assert.equal(result.dockerSnapshot.structure.rowCounts.folders, 3);
    assert.deepEqual(result.dockerNames, ['plex', 'sonarr', 'toolbox', 'orphan']);
    assert.equal(result.vmStructure.ok, true);
    assert.equal(result.vmSnapshot.structure.rowCounts.items, 1);
    assert.equal(result.wrapperReused, true);
    assert.equal(result.hookSnapshot.hooks.loadlist.callCount, 1);
    assert.equal(result.restored, true);
    assert.deepEqual(result.calls, [
        ['second-handler', 'refresh'],
        ['original', 'refresh']
    ]);
});

test('future native Docker host stays authoritative while compatibility diagnostics initialize', async ({ page }) => {
    await page.goto(`${baseUrl}/future-docker-host`, { waitUntil: 'load' });
    await page.waitForFunction(() => (
        window.fixtureFutureDocker?.snapshot().compatibility?.provider?.state === 'ready'
    ));
    const snapshot = await page.evaluate(() => window.fixtureFutureDocker.snapshot());
    assert.equal(snapshot.compatibility.hostGeneration, 'native-docker-vue');
    assert.equal(snapshot.compatibility.runtimeActivationAllowed, false);
    assert.equal(snapshot.compatibility.ownership.dockerPage, 'unraid-native');
    assert.equal(snapshot.compatibility.ownership.folderOverlayAllowed, false);
    assert.equal(snapshot.compatibility.ownership.nativeOrganizerMutationAllowed, false);
    assert.equal(snapshot.compatibility.graphql.endpointAvailable, true);
    assert.equal(snapshot.compatibility.graphql.apiVersion, '4.40.0-fixture');
    assert.equal(snapshot.compatibility.graphql.queryShape, 'docker.containers');
    assert.equal(snapshot.compatibility.graphql.mutations.restart, true);
    assert.equal(snapshot.compatibility.graphql.organizer.policy, 'detect-only');
    assert.equal(snapshot.providers.selected, 'unraid-graphql');
    assert.deepEqual(snapshot.providers.availableProviders, ['unraid-graphql']);
    assert.equal(snapshot.nativeMarkupAfter, snapshot.nativeMarkupBefore);
    assert.equal(snapshot.loadlistUnchanged, true);
    assert.equal(snapshot.classicTableCount, 0);
    assert.equal(snapshot.folderRowCount, 0);
    assert.equal(snapshot.pluginActionBarCount, 0);
    assert.equal(snapshot.enabledLegacyStyleCount, 0);
    assert.equal(snapshot.fatalBannerCount, 0);
    assert.deepEqual(snapshot.legacyRuntimeExports, {
        createFolderBtn: 'undefined',
        hostAdapterSnapshot: 'undefined'
    });
    assert.deepEqual(
        await page.evaluate(() => window.FolderViewPlusDockerBootstrapPromise),
        {
            loaded: false,
            hostGeneration: 'native-docker-vue',
            reason: 'compatibility-safe-mode'
        }
    );
    assert.equal(await page.evaluate(() => window.fixtureFutureDocker.fatalErrors.length), 0);
    assert.equal(
        await page.evaluate(() => window.fixtureFutureDocker.calls.every((entry) => entry.csrf === 'future-host-fixture-token')),
        true
    );

    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    assert.deepEqual(
        await page.evaluate(() => window.FolderViewPlusDockerProviders.getDefaultRegistry().snapshot().availableProviders),
        []
    );
});
};
