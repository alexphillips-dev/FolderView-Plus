import assert from 'node:assert/strict';
import { installDashboardLoadingFixture } from './dashboard-tile-loading.mjs';
import { dashboardFixtureRows as rows, loadReadyDashboardWidgets as loadReady, membershipSnapshot, nativeMarkupFor, runtimeSnapshotPayload as payload } from '../helpers/dashboard-membership-host.mjs';

export const registerDashboardNativeReconciliationCases = ({ test, baseUrl }) => {
    test('Dashboard Started only updates the localized native summary and empty message', async ({ page }) => {
        await page.clock.install();
        const selector = url => url.pathname.endsWith('/runtime_snapshot.php') && url.searchParams.get('type') === 'docker';
        const fixture = await installDashboardLoadingFixture(page, baseUrl, {
            nativeMarkup: type => {
                const native = nativeMarkupFor(type, rows[type]);
                if (type !== 'docker') return native;
                return native.replaceAll('apps started', 'apps stopped').replace('</td>',
                    '<span class="apps switch">Contenedores -- Activos: 0, Detenidos: 2, En pausa: 0</span>'
                    + '<span id="no_apps" style="display:none">No running Docker containers</span></td>');
            }
        });
        const docker = membershipSnapshot('docker', rows.docker, { enabled: false });
        Object.assign(docker.prefs, { runtimePrefsSchema: 10, liveRefreshEnabled: true, liveRefreshSeconds: 10 });
        for (const row of Object.values(docker.runtime)) Object.assign(row, { running: false, state: 'stopped' });
        docker.snapshotToken = 'a'.repeat(64);
        const runtime = structuredClone(docker.runtime);
        await page.route(url => selector(url) && url.searchParams.get('mode') === 'check',
            route => route.fulfill({ json: { ...payload('docker', 'b'), notModified: false } }));
        await page.route(url => selector(url) && url.searchParams.get('mode') === 'state',
            route => route.fulfill({ json: { ...payload('docker', 'b'), runtime } }));
        await loadReady(fixture, docker);
        await page.evaluate(() => {
            const toggle = document.createElement('input');
            Object.assign(toggle, { id: 'apps', type: 'checkbox', checked: true });
            toggle.setAttribute('aria-label', 'Started only');
            document.body.append(toggle);
            window.jQuery(toggle).trigger('change');
        });
        const widget = fixture.widget('docker');
        const member = widget.getByRole('button', { name: 'Native leftover-docker control', includeHidden: true });
        const empty = widget.locator('#no_apps');
        const summary = widget.locator('.apps.switch');
        await empty.waitFor();
        for (const running of [true, false]) {
            Object.assign(runtime['leftover-docker'], { running, state: running ? 'running' : 'stopped' });
            const refreshed = page.waitForResponse(response => new URL(response.url()).searchParams.get('mode') === 'state');
            await page.clock.fastForward(11000);
            await refreshed;
            await member.waitFor({ state: running ? 'visible' : 'hidden' });
            assert.equal(await empty.isVisible(), !running);
            assert.equal(await summary.textContent(), running
                ? 'Contenedores -- Activos: 1, Detenidos: 1, En pausa: 0'
                : 'Contenedores -- Activos: 0, Detenidos: 2, En pausa: 0');
            await page.clock.runFor(600);
        }
    });

    test('Dashboard lifecycle applies a committed peer rule to folder and Unassigned views', async ({ page }) => {
        const fixture = await installDashboardLoadingFixture(page, baseUrl, {
            nativeMarkup: type => nativeMarkupFor(type, rows[type])
        });
        const initial = membershipSnapshot('docker', rows.docker);
        await loadReady(fixture, initial);
        const widget = fixture.widget('docker');
        const assigned = widget.locator('[data-fv-folder-id="docker-group"] [data-fv-runtime-name="leftover-docker"]');
        assert.equal(await widget.locator('[data-fv-unassigned-item]').count(), 1);
        const rule = { id: 'peer-rule', enabled: true, folderId: 'docker-group', effect: 'include', kind: 'name_regex', pattern: '^leftover-docker$' };
        const updated = membershipSnapshot('docker', rows.docker, { rules: [rule] });
        await page.route(url => url.pathname.endsWith('/runtime_snapshot.php')
            && url.searchParams.get('type') === 'docker' && url.searchParams.get('mode') === 'full',
        route => route.fulfill({ json: { ...updated, ...payload('docker', 'b', { folder: 1, prefs: 2 }), metadata: { prefsRevision: 2 } } }));
        const peer = await page.context().newPage();
        try {
            await peer.route('**/fixture-rule-peer', route => route.fulfill({ body: '<title>Rules peer</title>', contentType: 'text/html' }));
            await peer.goto(baseUrl + '/fixture-rule-peer');
            await peer.evaluate(prefs => {
                window.fixtureRules = new BroadcastChannel('fvplus-prefs-sync-v1');
                window.fixtureRules.postMessage({ sourceId: 'fixture-rule-peer', action: 'committed', type: 'docker',
                    prefs: { ...prefs, _metadata: { prefsRevision: 2 } } });
            }, updated.prefs);
            await assigned.waitFor();
            assert.equal(await widget.locator('[data-fv-unassigned-group]').count(), 0);
            assert.equal(await fixture.widget('vm').locator('[data-fv-unassigned-group]').count(), 1);
            assert.equal(await page.evaluate(() => window.getFolderViewPlusDashboardHostSnapshot().nativeRowsLoadedCount), 1);
        } finally { await peer.close(); }
    });
};
