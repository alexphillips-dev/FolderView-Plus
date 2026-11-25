import assert from 'node:assert/strict';
import { installDashboardLoadingFixture } from './dashboard-tile-loading.mjs';
import { dashboardFixtureRows as rows, membershipSnapshot, nativeMarkupFor, runtimeSnapshotPayload as payload } from '../helpers/dashboard-membership-host.mjs';
import { closeFilterViewHost, createFilterViewSettingsHost, mountFilterViewVmHost } from '../helpers/filter-view-settings-host.mjs';

const livePrefs = { runtimePrefsSchema: 10, liveRefreshEnabled: true, liveRefreshSeconds: 10 };
const both = ['docker', 'vm'];
const isSnapshot = (url, type, mode) => url.pathname.endsWith('/runtime_snapshot.php')
    && url.searchParams.get('type') === type && url.searchParams.get('mode') === mode;
const tick = async (page, pending) => {
    await page.clock.fastForward(11000);
    await pending;
    await page.clock.runFor(600);
};
const ready = fixture => Promise.all(both.map(type => fixture.waitForState(type, 'ready')));
const dashboardIds = (fixture, type) => fixture.widget(type).locator('.folder-showcase-outer').evaluateAll(nodes =>
    nodes.map(node => Array.from(node.classList).find(cls => cls.startsWith('folder-showcase-outer-')).slice('folder-showcase-outer-'.length)));
const vmIds = page => page.locator('#kvm_list > tr.folder').evaluateAll(rows => rows.map(row => row.getAttribute('parent-id')));
const folder = (name, containers = [], parentId = '') =>
    ({ name, containers, parentId, settings: { expand_dashboard: true, expand_tab: true }, actions: [] });
const folderNames = (root, names) => ({ [root]: folder('First', [names[0]]), second: folder('Second', [names[1]]) });
const childFolders = (root, names) => {
    const folders = {
        [root]: folder('Root'), alpha: folder('Alpha', [], root),
        grandchild: folder('Grandchild', [names[0]], 'alpha'), beta: folder('Beta', [names[1]], root)
    };
    folders[root].settings.child_folder_order = ['beta', 'alpha'];
    return folders;
};
const manualPrefs = root => ({ sortMode: 'manual', manualOrder: [root, 'alpha', 'grandchild', 'beta'] });
const widgetFixture = (page, baseUrl) =>
    installDashboardLoadingFixture(page, baseUrl, { nativeMarkup: type => nativeMarkupFor(type, rows[type]) });
const withSnapshotPolling = async (page, type, current) => {
    const checks = [];
    await page.route(url => isSnapshot(url, type, 'check'), route => {
        const since = new URL(route.request().url()).searchParams.get('since');
        const snapshot = current();
        checks.push(since);
        return route.fulfill({ json: { ...payload(type, snapshot.snapshotToken[0]), notModified: since === snapshot.snapshotToken } });
    });
    await page.route(url => isSnapshot(url, type, 'state'), route => route.fulfill({ json: current() }));
    return checks;
};

export const registerRuntimeOrderedRecoveryCases = ({ test, baseUrl }) => {
    for (const type of both) {
        test(`Dashboard lifecycle recovers ${type} grouping after failed snapshot data without replacing the sibling widget`, async ({ page }) => {
            await page.clock.install();
            const fixture = await widgetFixture(page, baseUrl);
            const sibling = type === 'docker' ? 'vm' : 'docker';
            const snapshot = { ...membershipSnapshot(type, rows[type]), ...payload(type, 'a') };
            Object.assign(snapshot.prefs, livePrefs);
            const siblingSnapshot = membershipSnapshot(sibling, rows[sibling]);
            await fixture.load();
            fixture.settle(type, 0, 1, false, snapshot);
            fixture.settle(sibling, 0, 1, false, siblingSnapshot);
            await ready(fixture);
            await fixture.load();
            fixture.settle(type, 1, 1, true);
            fixture.settle(sibling, 1, 1, false, siblingSnapshot);
            await Promise.all([fixture.waitForState(type, 'failed'), fixture.waitForState(sibling, 'ready')]);
            const original = await fixture.widget(sibling).locator('.folder-showcase-outer').first().elementHandle();

            for (const index of [2, 3]) {
                const next = page.waitForRequest(request => isSnapshot(new URL(request.url()), type, 'full'));
                await tick(page, next);
                await fixture.waitForState(type, 'pending');
                fixture.settle(type, index, 1, index === 2, snapshot);
                await fixture.waitForState(type, index === 2 ? 'failed' : 'ready');
            }
            assert.equal(await original.evaluate(node => node.isConnected), true);
            assert.equal(await page.evaluate(() => window.getFolderViewPlusDashboardHostSnapshot().nativeRequestCount), 2);
            assert.equal(await fixture.widget(type).locator('.fv-dashboard-load-failed').count(), 0);
            assert.deepEqual(await dashboardIds(fixture, type), [`${type}-group`]);
            const checks = await withSnapshotPolling(page, type, () => snapshot);
            await tick(page, page.waitForResponse(response => isSnapshot(new URL(response.url()), type, 'check')));
            assert.deepEqual(checks, ['a'.repeat(64)]);
        });

        test(`Dashboard lifecycle applies native ${type} order changes with unchanged revisions`, async ({ page }) => {
            await page.clock.install();
            const fixture = await widgetFixture(page, baseUrl);
            const root = `${type}-group`;
            const snapshot = { ...membershipSnapshot(type, rows[type]), ...payload(type, 'a'), folders: folderNames(root, Object.keys(rows[type])) };
            const sibling = type === 'docker' ? 'vm' : 'docker';
            const siblingSnapshot = membershipSnapshot(sibling, rows[sibling]);
            Object.assign(snapshot.prefs, livePrefs);
            snapshot.order = [`folder-${root}`, 'folder-second', ...snapshot.unraidOrder];
            let current = snapshot;
            const checks = await withSnapshotPolling(page, type, () => current);
            await fixture.load();
            fixture.settle(type, 0, 1, false, current);
            fixture.settle(sibling, 0, 1, false, siblingSnapshot);
            await ready(fixture);
            assert.deepEqual(await dashboardIds(fixture, type), [root, 'second']);
            const state = type === 'docker' ? 'stopped' : 'shutoff';
            current = { ...current, ...payload(type, 'b'), runtime: structuredClone(current.runtime) };
            Object.assign(current.runtime[`fixture-${type}`], { state, running: false });
            await tick(page, page.waitForResponse(response => isSnapshot(new URL(response.url()), type, 'state')));
            await fixture.widget(type).locator(`[data-fv-runtime-name="fixture-${type}"][data-fv-runtime-state="${state}"]`).first().waitFor();
            assert.equal(await page.evaluate(() => window.getFolderViewPlusDashboardHostSnapshot().nativeRequestCount), 1);
            current = { ...current, ...payload(type, 'c'), order: ['folder-second', `folder-${root}`, ...current.unraidOrder] };
            await tick(page, page.waitForResponse(response => isSnapshot(new URL(response.url()), type, 'state')));
            await fixture.waitForState(type, 'pending');
            fixture.settle(type, 1, 1, false, current);
            fixture.settle(sibling, 1, 1, false, siblingSnapshot);
            await ready(fixture);
            assert.deepEqual(await dashboardIds(fixture, type), ['second', root]);
            await tick(page, page.waitForResponse(response => isSnapshot(new URL(response.url()), type, 'check')));
            assert.deepEqual(checks, ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)]);
        });
    }

    test('Dashboard and VM render saved child order across nested branches', async ({ page, context }) => {
        const fixture = await widgetFixture(page, baseUrl);
        const expected = root => [root, 'beta', 'alpha', 'grandchild'];
        await fixture.load();
        for (const type of both) {
            const root = `${type}-group`;
            const snapshot = membershipSnapshot(type, rows[type], { enabled: false });
            snapshot.folders = childFolders(root, snapshot.unraidOrder);
            Object.assign(snapshot.prefs, manualPrefs(root));
            fixture.settle(type, 0, 1, false, snapshot);
        }
        await ready(fixture);
        for (const type of both) assert.deepEqual(await dashboardIds(fixture, type), expected(`${type}-group`));
        const vmPage = await context.newPage();
        const host = await createFilterViewSettingsHost(vmPage);
        try {
            const root = 'fixture-folder-0';
            delete host.folders.empty;
            Object.assign(host.folders, childFolders(root, host.names));
            Object.assign(host.prefs('vm'), manualPrefs(root));
            await mountFilterViewVmHost(vmPage, host, { nativeDetails: true });
            assert.deepEqual(await vmIds(vmPage), expected(root));
            for (const id of expected(root)) {
                assert.equal(await vmPage.locator(`#kvm_list > tr[data-fv-vm-folder-detail][child-id="${id}"]`).count(), 1);
            }
        } finally {
            await closeFilterViewHost(vmPage, host);
            await vmPage.close();
        }
    });

    test('VM view preferences apply native order changes with unchanged revisions', async ({ page }) => {
        await page.clock.install();
        const host = await createFilterViewSettingsHost(page);
        try {
            const root = 'fixture-folder-0';
            delete host.folders.empty;
            Object.assign(host.folders, folderNames(root, host.names));
            Object.assign(host.prefs('vm'), livePrefs);
            let order = [`folder-${root}`, 'folder-second', ...host.names];
            let token = 'a';
            const current = () => ({ ...host.snapshot('vm'), ...payload('vm', token), order });
            const checks = await withSnapshotPolling(page, 'vm', current);
            await page.route(url => isSnapshot(url, 'vm', 'full'), route => route.fulfill({ json: current() }));
            await mountFilterViewVmHost(page, host);
            assert.deepEqual(await vmIds(page), [root, 'second']);
            token = 'b';
            order = ['folder-second', `folder-${root}`, ...host.names];
            await tick(page, page.waitForResponse(response => isSnapshot(new URL(response.url()), 'vm', 'state')));
            await page.waitForFunction(() => document.querySelector('#kvm_list > tr.folder')?.getAttribute('parent-id') === 'second');
            assert.deepEqual(await vmIds(page), ['second', root]);
            assert.equal(await page.evaluate(() => window.fixtureNativeRefreshCount), 2);
            await tick(page, page.waitForResponse(response => isSnapshot(new URL(response.url()), 'vm', 'check')));
            assert.deepEqual(checks, ['a'.repeat(64), 'b'.repeat(64)]);
        } finally {
            await closeFilterViewHost(page, host);
        }
    }, { skipAccessibility: true });
};
