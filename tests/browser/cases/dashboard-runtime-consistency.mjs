import assert from 'node:assert/strict';
import { installDashboardLoadingFixture } from './dashboard-tile-loading.mjs';
import { membershipSnapshot, nativeMarkupFor } from '../helpers/dashboard-membership-host.mjs';

const rows = {
    docker: { 'fixture-docker': 'abcdabcd0001', 'leftover-docker': 'abcdabcd0002' },
    vm: { 'fixture-vm': 'fixture-uuid', 'leftover-vm': 'leftover-uuid' }
};
const snapshot = (type, token = 'a', prefs = {}) => {
    const initial = membershipSnapshot(type, rows[type]);
    return { ...initial, snapshotToken: token.repeat(64), prefs: { ...initial.prefs, ...prefs } };
};
const routeRuntime = (url, mode, type) => url.pathname.endsWith('/runtime_snapshot.php')
    && url.searchParams.get('mode') === mode && (!type || url.searchParams.get('type') === type);

const nativeMarkup = type => nativeMarkupFor(type, rows[type]);
const ready = (fixture) => Promise.all(['docker', 'vm'].map(type => fixture.waitForState(type, 'ready')));
const settle = (fixture, index, dockerSnapshot = snapshot('docker'), vmSnapshot = snapshot('vm')) => {
    fixture.settle('docker', index, 1, false, dockerSnapshot);
    fixture.settle('vm', index, 1, false, vmSnapshot);
};

const livePrefs = { runtimePrefsSchema: 10, liveRefreshEnabled: true, liveRefreshSeconds: 10 };
const installRuntimeResponses = async (page, runtimeForType) => {
    const payload = type => ({ ok: true, kind: 'runtime_snapshot', schemaVersion: 1, type,
        snapshotToken: 'b'.repeat(64), revisions: { folder: 1, prefs: 1 } });
    await page.route(url => routeRuntime(url, 'check'), route => {
        const type = new URL(route.request().url()).searchParams.get('type');
        return route.fulfill({ json: { ...payload(type), notModified: false } });
    });
    await page.route(url => routeRuntime(url, 'state'), route => {
        const type = new URL(route.request().url()).searchParams.get('type');
        return route.fulfill({ json: { ...payload(type), runtime: runtimeForType[type] } });
    });
};

export const registerDashboardRuntimeConsistencyCases = ({ test, baseUrl }) => {
    test('Dashboard lifecycle defers live state until the current full render settles', async ({ page }) => {
        await page.clock.install();
        const fixture = await installDashboardLoadingFixture(page, baseUrl, { nativeMarkup });
        const initial = snapshot('docker', 'a', livePrefs);
        const runtime = structuredClone(initial.runtime);
        Object.assign(runtime['fixture-docker'], { state: 'stopped', running: false });
        await installRuntimeResponses(page, { docker: runtime });
        await fixture.load();
        settle(fixture, 0, initial);
        await ready(fixture);
        const requests = [];
        page.on('request', request => {
            const url = new URL(request.url());
            if (routeRuntime(url, 'check', 'docker') || routeRuntime(url, 'state', 'docker')) requests.push(url);
        });
        await fixture.load();
        await page.clock.fastForward(11000);
        await page.clock.runFor(100);
        assert.equal(requests.length, 0, 'The pending full bundle owns this widget');
        settle(fixture, 1, initial);
        await ready(fixture);

        const response = page.waitForResponse(result => routeRuntime(new URL(result.url()), 'state', 'docker'));
        await page.clock.fastForward(11000);
        await response;
        await page.waitForFunction(() => document.querySelector('[data-fv-runtime-name="fixture-docker"]')?.dataset.fvRuntimeState === 'stopped');
        assert.equal(requests[0].searchParams.get('since'), 'a'.repeat(64));
        assert.equal(requests.length, 2);
    });

    test('Dashboard Started only follows native Unassigned state changes for Docker and VMs', async ({ page }) => {
        await page.clock.install();
        const fixture = await installDashboardLoadingFixture(page, baseUrl, { nativeMarkup });
        const initial = Object.fromEntries(['docker', 'vm'].map(type => [type, snapshot(type, 'a', livePrefs)]));
        const runtime = Object.fromEntries(Object.entries(initial).map(([type, snap]) => [type, structuredClone(snap.runtime)]));
        await installRuntimeResponses(page, runtime);
        await fixture.load();
        settle(fixture, 0, initial.docker, initial.vm);
        await ready(fixture);
        await page.evaluate(() => {
            for (const id of ['apps', 'vms']) {
                const toggle = document.createElement('input');
                Object.assign(toggle, { type: 'checkbox', id, checked: true });
                toggle.setAttribute('aria-label', 'Started only ' + id);
                document.body.append(toggle);
            }
        });
        for (const type of ['docker', 'vm']) {
            await fixture.widget(type).locator('[data-fv-unassigned-group] button').click();
            assert.equal(await fixture.widget(type).locator('[data-fv-unassigned-item]').isVisible(), true);
            Object.assign(runtime[type]['leftover-' + type], { state: type === 'docker' ? 'stopped' : 'shutoff', running: false });
        }

        const waitForStatus = running => page.waitForFunction(active => ['docker', 'vm'].every(type => {
            const row = document.querySelector('#' + type + '_view [data-fv-unassigned-item]');
            const state = active ? 'running' : type === 'docker' ? 'stopped' : 'shutoff';
            return row?.dataset.fvRuntimeState === state && (getComputedStyle(row).display !== 'none') === active;
        }), running);
        await page.clock.fastForward(11000);
        await waitForStatus(false);
        for (const type of ['docker', 'vm']) Object.assign(runtime[type]['leftover-' + type], { state: 'running', running: true });
        await page.clock.fastForward(11000);
        await waitForStatus(true);
        for (const type of ['docker', 'vm']) {
            await fixture.widget(type).locator('[data-fv-unassigned-group] button').click();
            assert.equal(await fixture.widget(type).locator('[data-fv-unassigned-item]').isVisible(), false);
        }
    });

    test('Dashboard lifecycle applies peer Legacy layout transitions to native rows', async ({ page }) => {
        const fixture = await installDashboardLoadingFixture(page, baseUrl, { nativeMarkup });
        await fixture.load();
        settle(fixture, 0);
        await ready(fixture);
        const peer = await page.context().newPage();
        try {
            await peer.route('**/dashboard-layout-peer', route => route.fulfill({ body: '<title>Dashboard preferences peer</title>', contentType: 'text/html' }));
            await peer.goto(baseUrl + '/dashboard-layout-peer');
            const publish = async (layout, revision) => {
                const prefs = await page.evaluate(() => window.FolderViewPlusPrefsStore.getDefaultCoordinator().getOptimisticPrefs('docker'));
                await peer.evaluate(({ prefs, layout, revision }) => {
                    const channel = window.dashboardFixtureChannel ||= new BroadcastChannel('fvplus-prefs-sync-v1');
                    channel.postMessage({ sourceId: 'dashboard-layout-peer', action: 'committed', type: 'docker',
                        prefs: { ...prefs, dashboard: { ...prefs.dashboard, layout }, _metadata: { ...prefs._metadata, prefsRevision: revision } } });
                }, { prefs, layout, revision });
            };
            const docker = fixture.widget('docker');
            const vm = fixture.widget('vm');
            await publish('legacy', 2);
            await docker.locator('[data-fv-folder-id]').waitFor({ state: 'detached' });
            assert.equal(await docker.locator('[data-fv-unassigned-group]').count(), 0);
            assert.equal(await docker.getByRole('button', { name: 'Native fixture-docker control' }).isVisible(), true);
            assert.equal(await vm.locator('[data-fv-folder-id]').count(), 1);

            await page.route(url => routeRuntime(url, 'full', 'docker'), route => route.fulfill({
                json: { ...snapshot('docker'), ok: true, kind: 'runtime_snapshot', schemaVersion: 1, type: 'docker',
                    revisions: { folder: 1, prefs: 3 }, metadata: { prefsRevision: 3 } }
            }));
            await publish('fullwidth', 3);
            await docker.locator('[data-fv-folder-id]').waitFor();
            assert.equal(await docker.locator('[data-fv-unassigned-group]').count(), 1);
            assert.equal(await vm.locator('[data-fv-folder-id]').count(), 1);
        } finally { await peer.close(); }
    });

    test('Dashboard lifecycle preserves Unassigned keyboard focus across native replacement', async ({ page }) => {
        const fixture = await installDashboardLoadingFixture(page, baseUrl, { nativeMarkup });
        await fixture.load();
        settle(fixture, 0);
        await ready(fixture);
        const header = fixture.widget('docker').locator('[data-fv-unassigned-group] button');
        await header.focus();
        await header.press('Enter');
        await fixture.load();
        assert.equal(await header.evaluate(node => node === document.activeElement), true);
        settle(fixture, 1);
        await ready(fixture);
        assert.equal(await header.evaluate(node => node === document.activeElement), true);
        assert.equal(await header.getAttribute('aria-expanded'), 'true');

        await fixture.load();
        await page.evaluate(() => {
            const outside = document.createElement('button');
            Object.assign(outside, { id: 'dashboard-fixture-other-focus', textContent: 'Another control' });
            Object.assign(outside.style, { backgroundColor: '#181818', color: '#eee' });
            document.body.append(outside);
            outside.focus();
        });
        settle(fixture, 2);
        await ready(fixture);
        assert.equal(await page.evaluate(() => document.activeElement.id), 'dashboard-fixture-other-focus');
    });
};
