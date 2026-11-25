import assert from 'node:assert/strict';
import { installDashboardLoadingFixture } from './dashboard-tile-loading.mjs';
import { membershipSnapshot, nativeMarkupFor } from '../helpers/dashboard-membership-host.mjs';

const rows = {
    docker: { 'fixture-docker': 'abcdabcd0001', 'leftover-docker': 'abcdabcd0002' },
    vm: { 'fixture-vm': 'fixture-uuid', 'leftover-vm': 'leftover-uuid' }
};

const mountDashboard = async (page, baseUrl, type, nativeMarkup, prepareRuntime) => {
    await page.clock.install();
    const fixture = await installDashboardLoadingFixture(page, baseUrl, {
        nativeMarkup: surface => nativeMarkup(surface, nativeMarkupFor(surface, rows[surface]))
    });
    const snapshots = Object.fromEntries(['docker', 'vm'].map(surface => [surface, membershipSnapshot(surface, rows[surface])]));
    const runtime = snapshots[type].runtime;
    prepareRuntime(runtime);
    Object.assign(snapshots[type].prefs, { runtimePrefsSchema: 10, liveRefreshEnabled: true, liveRefreshSeconds: 10 });
    snapshots[type].snapshotToken = 'a'.repeat(64);
    const select = (url, mode) => url.pathname.endsWith('/runtime_snapshot.php')
        && url.searchParams.get('type') === type && url.searchParams.get('mode') === mode;
    const payload = { ok: true, kind: 'runtime_snapshot', schemaVersion: 1, type,
        revisions: { folder: 1, prefs: 1 }, snapshotToken: 'b'.repeat(64) };
    await page.route(url => select(url, 'check'), route => route.fulfill({ json: { ...payload, notModified: false } }));
    await page.route(url => select(url, 'state'), route => route.fulfill({ json: { ...payload, runtime } }));
    await fixture.load();
    for (const surface of ['docker', 'vm']) fixture.settle(surface, 0, 1, false, snapshots[surface]);
    await Promise.all(['docker', 'vm'].map(surface => fixture.waitForState(surface, 'ready')));
    const refresh = async () => {
        const read = page.waitForResponse(response => select(new URL(response.url()), 'state'));
        await page.clock.runFor(11000);
        await read;
    };
    return { widget: fixture.widget(type), runtime, refresh };
};

export const registerDashboardNativeControlCases = ({ test, baseUrl }) => {
    test('Dashboard VM native menu receives current state after a live snapshot', async ({ page }) => {
        await page.addInitScript(() => {
            window.fixtureVmContexts = [];
            window.addVMContext = (...args) => window.fixtureVmContexts.push(args);
        });
        const call = "addVMContext('fixture-vm','fixture-uuid','Custom','shutoff','','VNC','')";
        const host = await mountDashboard(page, baseUrl, 'vm', (type, markup) => type === 'vm'
            ? markup.replace('id="vm-fixture-uuid"', `id="vm-fixture-uuid" onclick="${call}"`)
                .replaceAll('vms started', 'vms stopped')
            : markup, runtime => { runtime['fixture-vm'].state = 'shutoff'; });
        const native = host.widget.locator('#vm-fixture-uuid button');
        const readContext = () => page.evaluate(() => window.fixtureVmContexts.at(-1).slice(0, 4));
        await native.click();
        assert.deepEqual(await readContext(), ['fixture-vm', 'fixture-uuid', 'Custom', 'shutoff']);
        for (const state of ['running', 'paused', 'shutoff']) {
            host.runtime['fixture-vm'].state = state;
            await host.refresh();
            await host.widget.locator(`[data-fv-runtime-name="fixture-vm"][data-fv-runtime-state="${state}"]`).waitFor();
            await native.click();
            assert.deepEqual(await readContext(), ['fixture-vm', 'fixture-uuid', 'Custom', state]);
        }
        assert.equal(await page.evaluate(() => window.getFolderViewPlusDashboardHostSnapshot().nativeRowsLoadedCount), 1);
    });

    test('Dashboard Docker native update indicators follow accepted runtime facts', async ({ page }) => {
        const host = await mountDashboard(page, baseUrl, 'docker', (type, markup) => type === 'docker'
            ? markup.replace('<span>fixture-docker</span>', '<span class="blue-text">fixture-docker</span>')
                .replace('<span>leftover-docker</span>', '<span class="blue-text">leftover-docker</span>')
            : markup, runtime => {
            for (const entry of Object.values(runtime)) entry.Updated = false;
        });
        const indicators = '#docker_view span.outer:not(.folder-docker) > span.inner > span.blue-text';
        assert.equal(await page.locator(indicators).count(), 2);
        for (const [Updated, isRebuildReady, count] of [[true, false, 0], [false, false, 2], [null, true, 0]]) {
            for (const entry of Object.values(host.runtime)) Object.assign(entry, { Updated, isRebuildReady });
            await host.refresh();
            await page.waitForFunction(({ indicators, count }) => document.querySelectorAll(indicators).length === count,
                { indicators, count });
        }
        assert.equal(await page.evaluate(() => window.getFolderViewPlusDashboardHostSnapshot().nativeRowsLoadedCount), 1);
    });
};
