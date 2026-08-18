import assert from 'node:assert/strict';

export const registerDashboardLifecycleFixtureCases = ({ test, baseUrl }) => {
test('Compact Matrix responds to the Dashboard widget width without clipping long names', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${baseUrl}/dashboard-layout`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.fixtureDashboardLayout?.snapshot().folderColumns === 3);

    const wide = await page.evaluate(() => window.fixtureDashboardLayout.snapshot());
    assert.equal(wide.folderColumns, 3);
    assert.equal(wide.horizontalOverflow, false);
    assert.equal(wide.telemetry.folderColumns, 3);
    assert.ok(wide.telemetry.widgetWidthPx > 1000);
    const wideVisual = await page.evaluate(() => window.fixtureDashboardLayout.captureVisual('wide-fixture'));
    assert.equal(wideVisual.layout.folderGrid.expectedColumns, 3);
    assert.equal(wideVisual.layout.folderGrid.appliedColumns, 3);
    assert.equal(wideVisual.layout.folderGrid.renderedColumns, 3);
    assert.equal(wideVisual.environment.viewportClass, 'desktop-size');
    assert.equal(wideVisual.verdict.noUnexpectedClipping, true);

    await page.evaluate(() => window.fixtureDashboardLayout.resize(900));
    await page.waitForFunction(() => window.fixtureDashboardLayout.snapshot().folderColumns === 2);
    const narrowDesktopWidget = await page.evaluate(() => window.fixtureDashboardLayout.snapshot());
    assert.equal(narrowDesktopWidget.folderColumns, 2, 'a narrow widget in a wide browser must not retain three columns');
    assert.equal(narrowDesktopWidget.horizontalOverflow, false);

    await page.evaluate(() => window.fixtureDashboardLayout.resize(390));
    await page.waitForFunction(() => window.fixtureDashboardLayout.snapshot().folderColumns === 1);
    const mobile = await page.evaluate(() => window.fixtureDashboardLayout.snapshot());
    assert.equal(mobile.folderColumns, 1);
    assert.equal(mobile.memberColumns, 1);
    assert.equal(mobile.horizontalOverflow, false);
    assert.ok(mobile.tileWidths.every((width) => width > 300), 'mobile member tiles should use the full folder width');
    const narrowVisual = await page.evaluate(() => window.fixtureDashboardLayout.captureVisual('narrow-widget-fixture'));
    assert.equal(narrowVisual.layout.folderGrid.expectedColumns, 1);
    assert.equal(narrowVisual.layout.folderGrid.renderedColumns, 1);
    assert.equal(narrowVisual.layout.memberGrid.renderedColumns, 1);
    assert.equal(narrowVisual.verdict.noUnexpectedClipping, true);

    await page.evaluate(() => window.fixtureDashboardLayout.resize(1000));
    await page.waitForFunction(() => window.fixtureDashboardLayout.snapshot().folderColumns === 2);
    const restored = await page.evaluate(() => window.fixtureDashboardLayout.snapshot());
    assert.equal(restored.folderColumns, 2);
    assert.equal(restored.memberColumns, 2);
    assert.ok(restored.tileWidths.slice(0, 3).every((width) => width >= 220));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.fixtureDashboardLayout.resize(1180));
    await page.waitForFunction(() => window.fixtureDashboardLayout.snapshot().folderColumns === 1);
    const portraitVisual = await page.evaluate(() => window.fixtureDashboardLayout.captureVisual('phone-portrait-fixture'));
    assert.equal(portraitVisual.environment.viewportClass, 'phone-size');
    assert.equal(portraitVisual.environment.viewport.width, 390);
    assert.equal(portraitVisual.layout.folderGrid.renderedColumns, 1);
    assert.equal(portraitVisual.layout.memberGrid.renderedColumns, 1);
    assert.equal(portraitVisual.verdict.noUnexpectedClipping, true);

    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForFunction(() => window.fixtureDashboardLayout.snapshot().folderColumns === 2);
    const landscapeVisual = await page.evaluate(() => window.fixtureDashboardLayout.captureVisual('phone-landscape-fixture'));
    assert.equal(landscapeVisual.environment.viewportClass, 'tablet-size');
    assert.equal(landscapeVisual.environment.viewport.width, 844);
    assert.equal(landscapeVisual.layout.folderGrid.renderedColumns, 2);
    assert.equal(landscapeVisual.verdict.noUnexpectedClipping, true);
});

test('Dashboard action rail exposes accessible primary controls and a keyboard-safe view popover', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 760 });
    await page.goto(`${baseUrl}/dashboard-layout`, { waitUntil: 'load' });
    const rail = page.locator('.fv-dashboard-layout-quick-rail');
    await rail.waitFor();
    assert.deepEqual(await rail.locator('.fv-dashboard-quick-action').evaluateAll((buttons) => buttons.map((button) => button.dataset.fvQuickAction)), [
        'layout-menu', 'expand-toggle', 'running-only', 'view-options'
    ]);
    const buttonBox = await rail.locator('[data-fv-quick-action="layout-menu"]').boundingBox();
    assert.ok(buttonBox.width >= 24 && buttonBox.height >= 24, 'desktop action buttons must remain usable mouse targets');

    const layoutTrigger = rail.locator('[data-fv-quick-action="layout-menu"]');
    await layoutTrigger.click();
    const popover = page.locator('.fv-dashboard-view-popover-shell');
    await popover.waitFor();
    const layoutSelect = popover.locator('[data-fv-layout-select]');
    assert.equal(await layoutSelect.locator('option').count(), 7);
    assert.equal(await layoutSelect.inputValue(), 'compactmatrix');
    const compactButtonStyles = await popover.evaluate((root) => {
        const displayGrid = root.querySelector('.fv-dashboard-view-options');
        const layoutControl = root.querySelector('[data-fv-layout-select]');
        const displayButton = root.querySelector('[data-fv-view-action="running-only"]');
        const colorProbe = document.createElement('span');
        colorProbe.style.color = 'var(--fvplus-ui-text-primary)';
        colorProbe.style.border = '1px solid var(--fvplus-ui-border-subtle)';
        root.append(colorProbe);
        const layoutStyle = getComputedStyle(layoutControl);
        const buttonStyle = getComputedStyle(displayButton);
        const probeStyle = getComputedStyle(colorProbe);
        const snapshot = {
            gap: Number.parseFloat(getComputedStyle(displayGrid).gap || '0'),
            layoutMarginTop: Number.parseFloat(layoutStyle.marginTop || '0'),
            layoutColor: layoutStyle.color,
            marginTop: Number.parseFloat(buttonStyle.marginTop || '0'),
            marginRight: Number.parseFloat(buttonStyle.marginRight || '0'),
            color: buttonStyle.color,
            expectedColor: probeStyle.color,
            borderColor: buttonStyle.borderTopColor,
            expectedBorderColor: probeStyle.borderTopColor
        };
        colorProbe.remove();
        return snapshot;
    });
    assert.ok(compactButtonStyles.gap <= 2, 'display choices should be tightly grouped');
    assert.equal(compactButtonStyles.layoutMarginTop, 0);
    assert.equal(compactButtonStyles.layoutColor, compactButtonStyles.expectedColor, 'the layout dropdown should use neutral theme text');
    assert.equal(compactButtonStyles.marginTop, 0);
    assert.equal(compactButtonStyles.marginRight, 0);
    assert.equal(compactButtonStyles.color, compactButtonStyles.expectedColor, 'global Unraid button colors must not override the neutral popover text');
    assert.equal(compactButtonStyles.borderColor, compactButtonStyles.expectedBorderColor, 'global Unraid button borders must not override the neutral popover border');
    await layoutSelect.focus();
    await page.keyboard.press('Escape');
    await popover.waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-fv-quick-action')), 'layout-menu');

    await rail.locator('[data-fv-quick-action="view-options"]').click();
    await popover.locator('[data-fv-view-action="health-emphasis"]').click();
    assert.equal(await popover.locator('[data-fv-view-action="health-emphasis"]').getAttribute('aria-pressed'), 'true');
    await popover.locator('[data-fv-view-action="running-only"]').click();
    assert.equal(await rail.locator('[data-fv-quick-action="running-only"]').getAttribute('aria-pressed'), 'true');
    await popover.locator('[data-fv-layout-select]').selectOption('classic');
    await page.waitForFunction(() => window.fixtureDashboardLayout.state.layout === 'classic');
    assert.equal(await layoutTrigger.getAttribute('data-fv-layout'), 'classic');

    await rail.locator('[data-fv-quick-action="view-options"]').click();
    const capture = popover.locator('[data-fv-view-action="capture-diagnostics"]');
    assert.equal(await capture.count(), 1);
    await capture.click();
    assert.equal(await page.evaluate(() => window.fixtureDashboardLayout.state.captureCount), 1);
    assert.equal(
        await page.evaluate(() => window.fixtureDashboardLayout.visualRecord().latest.trigger),
        'manual'
    );
    const reset = popover.locator('[data-fv-view-action="reset-view"]');
    assert.equal(await reset.isDisabled(), false);
    await reset.click();
    await rail.locator('[data-fv-quick-action="view-options"]').click();
    assert.equal(await popover.locator('[data-fv-view-action="reset-view"]').isDisabled(), true);
    await page.locator('body').click({ position: { x: 4, y: 4 } });
    await popover.waitFor({ state: 'detached' });

    await page.evaluate(() => window.fixtureDashboardLayout.resize(390));
    await page.waitForFunction(() => document.querySelector('.fv-dashboard-layout-inline-host')?.classList.contains('is-narrow'));
    assert.deepEqual((await page.evaluate(() => window.fixtureDashboardLayout.snapshot())).visibleQuickActions, ['expand-toggle', 'view-options']);
    const mobileButtonBox = await rail.locator('[data-fv-quick-action="view-options"]').boundingBox();
    assert.ok(mobileButtonBox.width >= 30 && mobileButtonBox.height >= 30, 'narrow action buttons must retain larger touch targets');
});

test('Dashboard Started only filters expanded and collapsed members and reconciles live state', async ({ page }) => {
    await page.goto(`${baseUrl}/dashboard-layout`, { waitUntil: 'load' });
    assert.equal(await page.locator('#fixture-stopped-member.fv-dashboard-started-only-hidden').count(), 0);
    assert.equal(await page.locator('#fixture-stopped-folder.fv-dashboard-started-only-hidden').count(), 0);
    if (!await page.locator('[data-fv-quick-action="running-only"]').isVisible()) await page.locator('[data-fv-quick-action="view-options"]').click();
    await page.locator('[data-fv-quick-action="running-only"]:visible, .fv-dashboard-view-popover [data-fv-view-action="running-only"]').click();
    assert.equal(await page.locator('#fixture-running-member.fv-dashboard-started-only-hidden').count(), 0);
    assert.equal(await page.locator('#fixture-paused-member.fv-dashboard-started-only-hidden').count(), 0);
    assert.equal(await page.locator('#fixture-stopped-member.fv-dashboard-started-only-hidden').count(), 1);
    assert.equal(await page.locator('#fixture-collapsed-stopped-member.fv-dashboard-started-only-hidden').count(), 1);
    assert.equal(await page.locator('#fixture-stopped-folder.fv-dashboard-started-only-hidden').count(), 1);
    assert.equal(await page.locator('#fixture-nested-running-folder.fv-dashboard-started-only-hidden').count(), 0);
    assert.equal(await page.locator('#fixture-nested-parent.fv-dashboard-started-only-hidden').count(), 0, 'a running descendant keeps its parent folder visible');
    assert.equal(await page.locator('#fixture-running-member').isVisible(), true);
    assert.equal(await page.locator('#fixture-stopped-member').isVisible(), false);

    const reconciliation = await page.evaluate(() => window.fixtureDashboardLayout.setRuntimeState('#fixture-running-member', 'stopped'));
    assert.equal(reconciliation.enabled, true);
    assert.equal(await page.locator('[data-fv-folder-id="system"].fv-dashboard-started-only-hidden').count(), 0, 'paused members keep a mixed folder visible');
    await page.evaluate(() => window.fixtureDashboardLayout.setRuntimeState('#fixture-paused-member', 'stopped'));
    assert.equal(await page.locator('[data-fv-folder-id="system"].fv-dashboard-started-only-hidden').count(), 1);

    await page.evaluate(() => {
        const toggle = document.querySelector('#apps');
        toggle.checked = false;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForFunction(() => document.querySelectorAll('.fv-dashboard-started-only-hidden').length === 0);
    assert.equal(await page.locator('.fv-dashboard-started-only-hidden').count(), 0);
    assert.equal(await page.locator('#fixture-stopped-member').isVisible(), true);
    assert.equal(await page.locator('#fixture-stopped-folder').isVisible(), true);
});

test('Dashboard Started only applies the same runtime-state policy to VM folders', async ({ page }) => {
    await page.goto(`${baseUrl}/dashboard-layout`, { waitUntil: 'load' });
    await page.evaluate(() => {
        const toggle = document.querySelector('#vms');
        toggle.checked = true;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));
        window.fixtureDashboardLayout.controller.applyDashboardStartedOnlyFilterForType('vm');
    });
    await page.waitForFunction(() => document.querySelector('#fixture-vm-stopped')?.classList.contains('fv-dashboard-started-only-hidden'));
    assert.equal(await page.locator('#fixture-vm-running.fv-dashboard-started-only-hidden').count(), 0);
    assert.equal(await page.locator('#fixture-vm-paused.fv-dashboard-started-only-hidden').count(), 0);
    assert.equal(await page.locator('#fixture-vm-stopped.fv-dashboard-started-only-hidden').count(), 1);
    assert.equal(await page.locator('#fixture-vm-folder.fv-dashboard-started-only-hidden').count(), 0);
});

test('Dashboard lifecycle keeps native cards, folder totals, icons, and context actions synchronized', async ({ page }) => {
    await page.goto(`${baseUrl}/dashboard-lifecycle`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.fixtureDashboardLifecycle?.getSnapshot().memberState === 'running');

    await page.click('#fixture-audiobookshelf-card');
    assert.deepEqual(await page.locator('#fixture-context-menu [data-action]').evaluateAll((buttons) => buttons.map((button) => button.dataset.action)), [
        'stop', 'pause', 'restart'
    ]);
    await page.click('#fixture-context-menu [data-action="stop"]');
    await page.waitForFunction(() => {
        const snapshot = window.fixtureDashboardLifecycle.getSnapshot();
        return snapshot.memberState === 'stopped' && snapshot.busyIconCount === 0;
    });
    let snapshot = await page.evaluate(() => window.fixtureDashboardLifecycle.getSnapshot());
    assert.equal(snapshot.folderState, 'stopped');
    assert.equal(snapshot.folderText, '2/2 stopped');
    assert.match(snapshot.memberIconClasses, /fa-square/);
    assert.match(snapshot.memberIconClasses, /red-text/);
    assert.doesNotMatch(snapshot.memberIconClasses, /fa-spin|fa-refresh/);

    await page.click('#fixture-audiobookshelf-card');
    assert.deepEqual(await page.locator('#fixture-context-menu [data-action]').evaluateAll((buttons) => buttons.map((button) => button.dataset.action)), ['start']);
    await page.click('#fixture-context-menu [data-action="start"]');
    await page.waitForFunction(() => {
        const current = window.fixtureDashboardLifecycle.getSnapshot();
        return current.memberState === 'running' && current.busyIconCount === 0;
    });
    snapshot = await page.evaluate(() => window.fixtureDashboardLifecycle.getSnapshot());
    assert.equal(snapshot.folderState, 'running');
    assert.equal(snapshot.folderText, '1/2 started');
    assert.match(snapshot.memberIconClasses, /fa-play/);
    assert.match(snapshot.memberIconClasses, /green-text/);
    assert.doesNotMatch(snapshot.memberIconClasses, /fa-spin|fa-refresh/);

    await page.click('#fixture-audiobookshelf-card');
    assert.deepEqual(await page.locator('#fixture-context-menu [data-action]').evaluateAll((buttons) => buttons.map((button) => button.dataset.action)), [
        'stop', 'pause', 'restart'
    ]);
    snapshot = await page.evaluate(() => window.fixtureDashboardLifecycle.getSnapshot());
    assert.equal(snapshot.hostContextCallCount, 3, 'idempotent context wrapping must invoke the native builder once per open');
});

test('Dashboard Started only follows rapid Stop then Start reconciliation without stale tails', async ({ page }) => {
    await page.goto(`${baseUrl}/dashboard-lifecycle`, { waitUntil: 'load' });
    await page.check('#apps');
    await page.waitForFunction(() => document.querySelector('#fixture-paperless-card')?.classList.contains('fv-dashboard-started-only-hidden'));
    assert.equal(await page.locator('#fixture-audiobookshelf-card').isVisible(), true);

    await page.click('#fixture-audiobookshelf-card');
    await page.click('#fixture-context-menu [data-action="stop"]');
    await page.waitForFunction(() => window.fixtureDashboardLifecycle.getSnapshot().folderHidden === true);
    let snapshot = await page.evaluate(() => window.fixtureDashboardLifecycle.getSnapshot());
    assert.equal(snapshot.memberHidden, true);
    assert.equal(snapshot.busyIconCount, 0);

    await page.uncheck('#apps');
    await page.click('#fixture-audiobookshelf-card');
    await page.click('#fixture-context-menu [data-action="start"]');
    await page.waitForFunction(() => window.fixtureDashboardLifecycle.getSnapshot().memberState === 'running');
    await page.check('#apps');
    await page.waitForFunction(() => window.fixtureDashboardLifecycle.getSnapshot().folderHidden === false);
    snapshot = await page.evaluate(() => window.fixtureDashboardLifecycle.getSnapshot());
    assert.equal(snapshot.memberHidden, false);
    assert.equal(snapshot.folderText, '1/2 started');
    assert.equal(snapshot.busyIconCount, 0);
    const finalizedActions = await page.evaluate(() => window.fixtureDashboardLifecycle.events
        .filter((event) => event.type === 'finalize')
        .map((event) => ({ action: event.action, settled: event.settled })));
    assert.deepEqual(finalizedActions, [
        { action: 'stop', settled: true },
        { action: 'start', settled: true }
    ]);
});

test('VM lifecycle keeps native rows, folder totals, icons, and context actions synchronized', async ({ page }) => {
    await page.goto(`${baseUrl}/vm-lifecycle`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.fixtureVmLifecycle?.getSnapshot().runtimeState === 'running');

    await page.click('#fixture-vm-row');
    assert.deepEqual(await page.locator('#fixture-context-menu [data-action]').evaluateAll((buttons) => buttons.map((button) => button.dataset.action)), [
        'domain-stop', 'domain-pause', 'domain-restart'
    ]);
    await page.click('#fixture-context-menu [data-action="domain-stop"]');
    await page.waitForFunction(() => {
        const snapshot = window.fixtureVmLifecycle.getSnapshot();
        return snapshot.runtimeState === 'shutoff' && snapshot.busyIconCount === 0;
    });
    let snapshot = await page.evaluate(() => window.fixtureVmLifecycle.getSnapshot());
    assert.equal(snapshot.folderText, '1/1 stopped');
    assert.match(snapshot.memberIconClasses, /fa-square/);
    assert.match(snapshot.memberIconClasses, /red-text/);
    assert.equal(snapshot.consoleIconClasses, 'fa fa-desktop');
    assert.equal(snapshot.menuIconClasses, 'fa fa-bars');
    assert.equal(snapshot.nativeLoadlistCount, 0);

    await page.click('#fixture-vm-row');
    assert.deepEqual(await page.locator('#fixture-context-menu [data-action]').evaluateAll((buttons) => buttons.map((button) => button.dataset.action)), ['domain-start']);
    await page.click('#fixture-context-menu [data-action="domain-start"]');
    await page.waitForFunction(() => {
        const current = window.fixtureVmLifecycle.getSnapshot();
        return current.runtimeState === 'running' && current.busyIconCount === 0;
    });
    snapshot = await page.evaluate(() => window.fixtureVmLifecycle.getSnapshot());
    assert.equal(snapshot.folderText, '1/1 started');
    assert.match(snapshot.memberIconClasses, /fa-play/);
    assert.match(snapshot.memberIconClasses, /green-text/);
    assert.equal(snapshot.lifecycle.fallbackCount, 0);
    assert.equal(snapshot.lifecycle.eventGroups.lifecycleSurfaceFinalized, 2);
    assert.equal(snapshot.contextCallCount, 2);
});

test('VM lifecycle reconciles Pause and Resume without stale native menus or spinner tails', async ({ page }) => {
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
});

test('Dashboard lifecycle performs one native fallback when Start snapshots remain stale', async ({ page }) => {
    await page.goto(`${baseUrl}/dashboard-lifecycle`, { waitUntil: 'load' });
    await page.click('#fixture-audiobookshelf-card');
    await page.click('#fixture-context-menu [data-action="stop"]');
    await page.waitForFunction(() => window.fixtureDashboardLifecycle.getSnapshot().memberState === 'stopped');

    await page.click('#fixture-audiobookshelf-card');
    await page.evaluate(() => window.fixtureDashboardLifecycle.setStaleRefreshBudget(3));
    await page.click('#fixture-context-menu [data-action="start"]');
    await page.waitForFunction(() => {
        const snapshot = window.fixtureDashboardLifecycle.getSnapshot();
        return snapshot.memberState === 'running' && snapshot.nativeLoadlistCount === 1 && snapshot.busyIconCount === 0;
    });
    const snapshot = await page.evaluate(() => window.fixtureDashboardLifecycle.getSnapshot());
    assert.equal(snapshot.nativeLoadlistCount, 1);
    assert.match(snapshot.memberIconClasses, /fa-play/);
    assert.match(snapshot.memberIconClasses, /green-text/);
    assert.doesNotMatch(snapshot.memberIconClasses, /fa-spin|fa-refresh/);
    const fallbackFinalizers = await page.evaluate(() => window.fixtureDashboardLifecycle.events
        .filter((event) => event.type === 'finalize' && event.action === 'start')
        .map((event) => ({ reason: event.reason, settled: event.settled })));
    assert.deepEqual(fallbackFinalizers, [{ reason: 'attempts-exhausted', settled: false }]);
});
};
