import assert from 'node:assert/strict';
import { installDashboardLoadingFixture } from './dashboard-tile-loading.mjs';
import { dashboardFixtureRows as rows, loadReadyDashboardWidgets as loadReady, membershipSnapshot, nativeMarkupFor, runtimeSnapshotPayload as payload } from '../helpers/dashboard-membership-host.mjs';

const verifyNativeRefreshRetry = async ({ page }, type, baseUrl) => {
    await page.clock.install();
    const currentRows = structuredClone(rows);
    const fixture = await installDashboardLoadingFixture(page, baseUrl, {
        nativeMarkup: widget => nativeMarkupFor(widget, currentRows[widget])
    });
    const initial = membershipSnapshot(type, currentRows[type]);
    const sibling = type === 'docker' ? 'vm' : 'docker';
    Object.assign(initial.prefs, { runtimePrefsSchema: 10, liveRefreshEnabled: true, liveRefreshSeconds: 10 });
    await fixture.load();
    fixture.settle(type, 0, 1, false, { ...initial, ...payload(type, 'a') });
    fixture.settle(sibling, 0, 1, false, membershipSnapshot(sibling, currentRows[sibling]));
    await Promise.all([type, sibling].map(widget => fixture.waitForState(widget, 'ready')));

    const newName = `new-${type}`;
    currentRows[type][newName] = type === 'docker' ? 'abcdabcd0003' : 'new-vm-uuid';
    const changed = { ...membershipSnapshot(type, currentRows[type]), ...payload(type, 'b'), prefs: initial.prefs };
    const checks = [];
    const matches = (url, mode) => url.pathname.endsWith('/runtime_snapshot.php')
        && url.searchParams.get('type') === type && url.searchParams.get('mode') === mode;
    await page.route(url => matches(url, 'check'), route => {
        const since = new URL(route.request().url()).searchParams.get('since');
        checks.push(since);
        return route.fulfill({ json: { ...payload(type, 'b'), notModified: since === changed.snapshotToken } });
    });
    await page.route(url => matches(url, 'state'), route => route.fulfill({ json: changed }));
    await page.route('**/webGui/include/DashboardApps.php', route => route.fulfill({ status: 503 }), { times: 1 });

    const state = page.waitForResponse(response => matches(new URL(response.url()), 'state'));
    await page.clock.fastForward(11000);
    await state;
    const failed = page.waitForResponse(response => response.url().endsWith('/DashboardApps.php') && response.status() === 503);
    await page.clock.runFor(600);
    await failed;
    await page.waitForFunction(() => window.getFolderViewPlusDashboardHostSnapshot()?.events.some(event => event.name === 'nativeRowsFailed'));
    fixture.settle(type, 1, 1, false, changed);
    fixture.settle(sibling, 1, 1, false, membershipSnapshot(sibling, currentRows[sibling]));
    assert.equal(await fixture.widget(type).getByRole('button', { name: `Native ${newName} control`, includeHidden: true }).count(), 0);

    const retryState = page.waitForResponse(response => matches(new URL(response.url()), 'state'));
    await page.clock.fastForward(11000);
    await retryState;
    const recovered = page.waitForResponse(response => response.url().endsWith('/DashboardApps.php') && response.ok());
    await page.clock.runFor(600);
    await recovered;
    await fixture.waitForState(type, 'pending');
    fixture.settle(type, 2, 1, false, changed);
    fixture.settle(sibling, 2, 1, false, membershipSnapshot(sibling, currentRows[sibling]));
    await Promise.all([type, sibling].map(widget => fixture.waitForState(widget, 'ready')));
    assert.equal(await fixture.widget(type).getByRole('button', { name: `Native ${newName} control`, includeHidden: true }).count(), 1);
    const nextCheck = page.waitForResponse(response => matches(new URL(response.url()), 'check'));
    await page.clock.fastForward(11000);
    await nextCheck;
    assert.deepEqual(checks, ['a'.repeat(64), 'a'.repeat(64), 'b'.repeat(64)]);
};

export const registerDashboardRuntimeRecoveryCases = ({ test, baseUrl }) => {
    test('Dashboard lifecycle reconciles an ID even when another container has that name', async ({ page }) => {
        await page.addInitScript(() => {
            window.eventControl = (_request, callback) => window[callback]();
        });
        await page.clock.install();
        const target = rows.docker['fixture-docker'];
        const containers = { ...rows.docker, [target]: 'abcdabcd0099' };
        const fixture = await installDashboardLoadingFixture(page, baseUrl, {
            nativeMarkup: type => nativeMarkupFor(type, type === 'docker' ? containers : rows[type])
        });
        const initial = { ...membershipSnapshot('docker', containers), ...payload('docker', 'a') };
        Object.assign(initial.runtime[target], { state: 'stopped', running: false });
        const runtime = structuredClone(initial.runtime);
        await page.route(url => url.pathname.endsWith('/runtime_snapshot.php') && url.searchParams.get('mode') === 'state',
            route => route.fulfill({ json: { ...payload('docker', 'b'), runtime } }));
        await loadReady(fixture, initial);

        await page.evaluate(id => { window.eventControl({ action: 'stop', container: id }, 'loadlist'); }, target);
        await page.waitForFunction(() => window.FolderViewPlusDashboardLifecycleReconciliation?.events
            .some(event => event.eventType === 'lifecycleRefreshResult'));
        const firstAttempt = await page.evaluate(() => window.FolderViewPlusDashboardLifecycleReconciliation.events
            .find(event => event.eventType === 'lifecycleRefreshResult'));
        assert.equal(firstAttempt.observedState.state, 'running');
        assert.equal(firstAttempt.settled, false);

        Object.assign(runtime['fixture-docker'], { state: 'stopped', running: false });
        await page.clock.runFor(300);
        await page.waitForFunction(() => window.FolderViewPlusDashboardLifecycleReconciliation?.events
            .some(event => event.eventType === 'lifecycleSurfaceFinalized' && event.settled));
        assert.equal(await fixture.widget('docker').locator('[data-fv-runtime-name="fixture-docker"]').getAttribute('data-fv-runtime-state'), 'stopped');
        assert.equal(await page.evaluate(() => window.getFolderViewPlusDashboardHostSnapshot().nativeRowsLoadedCount), 1);
    });

    const failingNativeRequest = { allowedConsoleErrors: [/503 \(Service Unavailable\)/] };
    test('Dashboard lifecycle retries a failed native docker refresh before advancing its token',
        (args) => verifyNativeRefreshRetry(args, 'docker', baseUrl), failingNativeRequest);
    test('Dashboard lifecycle retries a failed native vm refresh before advancing its token',
        (args) => verifyNativeRefreshRetry(args, 'vm', baseUrl), failingNativeRequest);

    test('Dashboard lifecycle keeps the saved layout when rebuilding the widget fails', async ({ page }) => {
        const fixture = await installDashboardLoadingFixture(page, baseUrl, {
            nativeMarkup: type => nativeMarkupFor(type, rows[type])
        });
        await page.evaluate(() => {
            window.csrf_token = 'fixture-unraid-token';
            document.head.insertAdjacentHTML('beforeend', '<meta name="fv-request-token" content="fixture-plugin-token">');
        });
        await page.route('**/server/security.php', route => route.fulfill({ json: { nonce: 'a'.repeat(64) } }));
        const initial = membershipSnapshot('docker', rows.docker);
        initial.prefs.dashboard.layout = 'legacy';
        let persisted = 'legacy';
        const committed = { ...initial, prefs: { ...initial.prefs, dashboard: { layout: 'classic' } } };
        const isPreferences = url => url.pathname.endsWith('/server/prefs.php');
        await page.route(isPreferences, route => {
            if (route.request().method() === 'POST') {
                const body = new URLSearchParams(route.request().postData());
                persisted = JSON.parse(body.get('prefs')).dashboard.layout;
                return route.fulfill({ json: { ok: true, prefs: committed.prefs, metadata: { prefsRevision: 2 } } });
            }
            return route.fulfill({ json: { ok: true, prefs: initial.prefs, metadata: { prefsRevision: 1 } } });
        });
        await loadReady(fixture, initial);
        const docker = fixture.widget('docker');
        const layout = docker.locator('[data-fv-quick-action="layout-menu"]');
        const isDockerFull = url => url.pathname.endsWith('/runtime_snapshot.php') && url.searchParams.get('type') === 'docker'
            && url.searchParams.get('mode') === 'full';
        await page.route(isDockerFull, route => route.fulfill({ json: { ok: false } }), { times: 1 });
        await layout.click();
        const saved = page.waitForResponse(response => isPreferences(new URL(response.url()))
            && response.request().method() === 'POST' && response.ok());
        const rebuild = page.waitForResponse(response => isDockerFull(new URL(response.url())));
        await page.locator('.fv-dashboard-view-popover-shell [data-fv-layout-select]').selectOption('classic');
        await Promise.all([saved, rebuild]);
        assert.equal(persisted, 'classic');
        await docker.getByText('Some folders could not be displayed.').waitFor();
        await docker.locator('[data-fv-quick-action="layout-menu"][data-fv-layout="classic"]:enabled').waitFor({ state: 'attached' });
        assert.equal(await page.getByText('Dashboard view not saved', { exact: true }).count(), 0);

        await fixture.waitForState('docker', 'pending');
        fixture.settle('docker', 1, 2, false, committed);
        fixture.settle('vm', 1, 1, false, membershipSnapshot('vm', rows.vm));
        await Promise.all(['docker', 'vm'].map(type => fixture.waitForState(type, 'ready')));
        await docker.getByText('docker configured folder', { exact: true }).waitFor();
        assert.equal(await layout.getAttribute('data-fv-layout'), 'classic');
        assert.equal(await docker.locator('.fv-dashboard-load-failed').count(), 0);
    });
};
