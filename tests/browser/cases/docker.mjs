import assert from 'node:assert/strict';
import {
    exerciseChildFolderPreviewContext,
    exerciseDockerPreviewContextDiagnostics
} from '../helpers/docker-preview-context.mjs';

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

test('Docker late wizard folders claim canonical host rows before hide-empty filtering', async ({ page }) => {
    await page.goto(`${baseUrl}/docker-folder-grouping`, { waitUntil: 'load' });
    const result = await page.evaluate(() => window.fixtureDockerFolderGrouping.result);
    assert.equal(result.hidden.order.length, 18);
    assert.equal(result.hidden.folderBoxes, 6);
    assert.deepEqual(result.hidden.folderOrder, ['folder-3', 'folder-8', 'folder-21', 'folder-22', 'folder-23', 'folder-24']);
    assert.equal(result.hidden.groupedMembers, 17);
    assert.equal(result.hidden.standaloneMembers, 1);
    assert.equal(result.hidden.snapshot.hostRows.resolved, 18);
    assert.equal(result.hidden.snapshot.folders.total, 25);
    assert.equal(result.hidden.snapshot.folders.claimedRowCount, 17);
    assert.equal(result.hidden.snapshot.folders.missingRowCount, 0);
    assert.equal(result.hidden.snapshot.folders.insertedShellCount, 25);
    assert.equal(result.hidden.snapshot.folders.failedShellCount, 0);
    assert.equal(result.hidden.snapshot.folders.removedByHideEmptyCount, 19);
    assert.equal(result.shown.folderBoxes, 25);
    assert.equal(result.shown.groupedMembers, 17);
    assert.deepEqual(result.repeatedHidden.folderOrder, result.hidden.folderOrder);
    assert.equal(result.repeatedHidden.snapshot.folders.failedShellCount, 0);
});

test('Docker single-row preview cloning falls back without stopping later members', async ({ page }) => {
    await page.goto(`${baseUrl}/docker-layout-stability`, { waitUntil: 'load' });
    const result = await page.evaluate(() => window.fixtureDockerPreviewCloneResilience.run());
    assert.equal(result.modeOneOk, true);
    assert.equal(result.modeThreeOk, true);
    assert.equal(result.modeOneState, 'started');
    assert.equal(result.modeThreeState, 'started');
    assert.match(result.originalState, /Compose Stack: fixture-stack/);
    assert.deepEqual(result.missingState, { ok: false, reason: 'state-markup-missing' });
    assert.deepEqual(result.missingWrapper, { ok: false, reason: 'preview-markup-missing' });
    assert.deepEqual(result.invalidSelector, { ok: false, reason: 'preview-clone-failed' });
    assert.equal(result.renderedCount, 3, 'a malformed member must not stop subsequent preview rendering');
    assert.equal(result.renderedContainerId, 'fixture-0');
    assert.equal(result.renderedContainerName, 'fixture-container-0');
    assert.equal(result.fallbackCount, 2);
});

test('Docker lifecycle pending colors follow each action destination state', async ({ page }) => {
    await page.goto(`${baseUrl}/docker-layout-stability`, { waitUntil: 'load' });
    const colors = await page.evaluate(() => window.fixtureDockerLifecyclePendingColors.run());
    assert.equal(colors.start, 'rgb(17, 170, 34)');
    assert.equal(colors.resume, 'rgb(17, 170, 34)');
    assert.equal(colors.restart, 'rgb(17, 170, 34)');
    assert.equal(colors.pause, 'rgb(204, 153, 0)');
    assert.equal(colors.stop, 'rgb(221, 34, 51)');
});

test('Docker multi-row previews bridge native context without cloned handlers or duplicate ids', async ({ page }) => {
    await exerciseDockerPreviewContextDiagnostics({ page, baseUrl });
});

test('Docker child-folder preview chip opens its action menu after multi-row reflow', async ({ page }) => {
    await exerciseChildFolderPreviewContext({ page, baseUrl });
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

test('legacy Docker uses API-first reads while host eventControl retains action ownership', async ({ page }) => {
    await page.goto(`${baseUrl}/docker-api-legacy?profile=current-full-api`, { waitUntil: 'load' });
    const result = await page.evaluate(() => window.fixtureDockerApiLegacy.result);
    assert.equal(result.provider, 'hybrid-legacy-graphql');
    assert.equal(result.providerDiagnostics.actionTransport, 'legacy-webgui');
    assert.equal(result.coordinator.state, 'ready');
    assert.equal(result.coordinator.source, 'unraid-graphql-targeted');
    assert.equal(result.runtime.info.State.Running, true);
    assert.equal(result.runtime.info.State.Paused, true);
    assert.equal(result.runtime.info.State.Updated, true);
    assert.equal(result.runtime.Labels['fixture.php'], 'preserved');
    assert.equal(result.hostActions.length, 1);
    assert.equal(result.hostActions[0].request.action, 'start');
    assert.equal(result.apiCalls.some((entry) => entry.list), true);
    assert.equal(result.apiCalls.some((entry) => entry.targeted), true);
    assert.equal(result.apiCalls.some((entry) => entry.mutation), false);
    assert.equal(result.apiCalls.every((entry) => entry.csrf === 'api-first-fixture-token'), true);
    assert.equal(result.structuralRefreshes, 0);
    await page.evaluate(() => window.fixtureDockerApiLegacy.dispose());
});

test('legacy Docker remains functional when the API is absent', async ({ page }) => {
    await page.goto(`${baseUrl}/docker-api-legacy?profile=legacy-no-api`, { waitUntil: 'load' });
    const result = await page.evaluate(() => window.fixtureDockerApiLegacy.result);
    assert.equal(result.provider, 'hybrid-legacy-graphql');
    assert.equal(result.providerDiagnostics.state, 'degraded');
    assert.equal(result.runtime.info.State.Running, false);
    assert.equal(result.hostActions.length, 1);
    assert.equal(result.hostActions[0].request.action, 'start');
    assert.equal(result.apiCalls.some((entry) => entry.mutation), false);
    await page.evaluate(() => window.fixtureDockerApiLegacy.dispose());
}, { allowedConsoleErrors: [/Failed to load resource:.*404 \(Not Found\)/] });
};
