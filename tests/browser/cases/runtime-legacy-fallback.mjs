import assert from 'node:assert/strict';
import { dashboardFixtureRows as rows, membershipSnapshot, runtimeSnapshotPayload as payload } from '../helpers/dashboard-membership-host.mjs';
import { createDockerHideEmptyHost } from '../helpers/docker-hide-empty-host.mjs';
import { closeFilterViewHost, createFilterViewSettingsHost, mountFilterViewVmHost } from '../helpers/filter-view-settings-host.mjs';

const textJson = value => ({ contentType: 'text/plain', body: JSON.stringify(value) });
const noSnapshot = { json: { ok: false, error: 'Fixture snapshot not available' } };
const dockerIds = page => page.locator('#docker_list > tr.folder').evaluateAll(nodes => nodes.map(node => node.dataset.fvFolderId));
const nativeDockerReloads = page => page.evaluate(() => window.fixtureNativeRefreshCount || 0);

export const registerRuntimeLegacyFallbackCases = ({
    test, baseUrl, both, dashboardIds, folderNames, isSnapshot, livePrefs, tick, widgetFixture
}) => {
    for (const [type, enabled] of [...both.map(type => [type, true]), ['docker', false]]) {
        const outcome = enabled ? 'with late preferences' : 'only when live refresh is enabled';
        test(`Dashboard lifecycle recovers ${type} grouping after its first failed render ${outcome}`, async ({ page }) => {
            await page.clock.install();
            const fixture = await widgetFixture(page, baseUrl);
            const sibling = type === 'docker' ? 'vm' : 'docker';
            let releasePrefs;
            const heldPrefs = new Promise(resolve => { releasePrefs = resolve; });
            await page.route(url => url.pathname.endsWith('/prefs.php') && url.searchParams.get('type') === type, async route => {
                await heldPrefs;
                await route.fulfill({ json: { ok: true, prefs: { ...livePrefs, liveRefreshEnabled: enabled }, metadata: { prefsRevision: 1 } } });
            });
            try {
                await fixture.load();
                fixture.settle(type, 0, 1, true);
                fixture.settle(sibling, 0, 1, false, membershipSnapshot(sibling, rows[sibling]));
                await Promise.all([fixture.waitForState(type, 'failed'), fixture.waitForState(sibling, 'ready')]);
                const interval = () => page.evaluate(type => window.getDashboardRuntimePerformancePolicySnapshot().refreshMsByType[type], type);
                assert.equal(await interval(), 0, 'no retry before preferences arrive');
                const original = await fixture.widget(sibling).locator('.folder-showcase-outer').first().elementHandle();
                const received = page.waitForResponse(response => response.url().includes(`prefs.php?type=${type}`));
                releasePrefs();
                await received;
                await page.waitForFunction(type => window.FolderViewPlusPrefsStore.getDefaultCoordinator().getConfirmedPrefs(type)?._metadata?.prefsRevision === 1, type);
                if (!enabled) {
                    await page.clock.fastForward(22_000);
                    assert.equal(await interval(), 0);
                    await fixture.waitForState(type, 'failed');
                    return;
                }
                await page.waitForFunction(type => window.getDashboardRuntimePerformancePolicySnapshot().refreshMsByType[type] > 0, type);
                const next = page.waitForRequest(request => isSnapshot(new URL(request.url()), type, 'full'));
                await tick(page, next);
                fixture.settle(type, 1, 1, false, { ...membershipSnapshot(type, rows[type]), ...payload(type, 'a'), prefs: livePrefs });
                await fixture.waitForState(type, 'ready');
                assert.deepEqual(await dashboardIds(fixture, type), [`${type}-group`]);
                assert.equal(await original.evaluate(node => node.isConnected), true);
                assert.equal(await page.evaluate(() => window.getFolderViewPlusDashboardHostSnapshot().nativeRequestCount), 1);
            } finally {
                releasePrefs();
            }
        });
    }

    for (const mode of ['config', 'state']) {
        test(`Docker live refresh applies a ${mode} order-only change after a legacy fallback render`, async ({ page }) => {
            await page.clock.install();
            const host = await createDockerHideEmptyHost(page, true);
            try {
                const names = Object.keys(host.runtime);
                for (const key of Object.keys(host.folders)) delete host.folders[key];
                Object.assign(host.folders, folderNames('first', names));
                Object.assign(host.prefs(), livePrefs, { dockerRowPlacement: 'saved-order', sortMode: 'created' });
                let snapshotAvailable = false;
                let order = ['folder-first', 'folder-second', ...names];
                await page.route('**/graphql', route => route.fulfill({ json: { data: {} } }));
                await page.route('**/server/read.php?**', route => route.fulfill(textJson(host.folders)));
                await page.route('**/server/read_order.php?**', route => {
                    assert.equal(new URL(route.request().url()).searchParams.get('native'), '1');
                    return route.fulfill(textJson(order));
                });
                await page.route('**/server/runtime_snapshot.php?**', route => {
                    const requestedMode = new URL(route.request().url()).searchParams.get('mode');
                    if (!snapshotAvailable || (mode === 'state' && requestedMode === 'config')) return route.fulfill(noSnapshot);
                    const hasRuntime = requestedMode !== 'config';
                    return route.fulfill({ json: {
                        ...payload('docker', 'b', host.revisions()), mode: requestedMode, folders: host.folders, prefs: host.prefs(),
                        order, nativeSavedOrder: order, unraidOrder: hasRuntime ? names : [], runtimeIncluded: hasRuntime,
                        ...(hasRuntime ? { runtime: host.runtime } : {}), metadata: host.prefs()._metadata
                    } });
                });
                await page.goto(host.url);
                await page.waitForFunction(() => document.querySelectorAll('#docker_list > tr.folder').length === 2);
                assert.deepEqual(await dockerIds(page), ['first', 'second']);
                const before = await nativeDockerReloads(page);
                order = ['folder-second', 'folder-first', ...names];
                snapshotAvailable = true;
                await tick(page, page.waitForResponse(response => isSnapshot(new URL(response.url()), 'docker', mode)));
                await page.waitForFunction(() => document.querySelector('#docker_list > tr.folder')?.dataset.fvFolderId === 'second');
                assert.deepEqual(await dockerIds(page), ['second', 'first']);
                assert.equal(await nativeDockerReloads(page), before + 1);
                await tick(page, page.waitForResponse(response => isSnapshot(new URL(response.url()), 'docker', 'state')));
                assert.equal(await nativeDockerReloads(page), before + 1, 'a steady snapshot does not rebuild again');
            } finally {
                await page.unrouteAll({ behavior: 'wait' });
                await host.close();
            }
        }, { skipAccessibility: true });
    }

    test('VM view preferences apply native order and saved preferences after a legacy fallback', async ({ page }) => {
        await page.clock.install();
        const host = await createFilterViewSettingsHost(page);
        try {
            const root = 'fixture-folder-0';
            delete host.folders.empty;
            Object.assign(host.folders, folderNames(root, host.names));
            Object.assign(host.prefs('vm'), livePrefs, { hiddenFolderIds: [root] });
            await page.route(url => isSnapshot(url, 'vm', 'full'), route => route.fulfill(noSnapshot));
            await page.route('**/server/read_order.php?**', route => route.fulfill(textJson([`folder-${root}`, 'folder-second', ...host.names])));
            await page.route('**/server/read_unraid_order.php?**', route => route.fulfill(textJson(host.names)));
            await mountFilterViewVmHost(page, host, { legacyText: true });
            const confirmed = await page.evaluate(() => window.FolderViewPlusPrefsStore.getDefaultCoordinator().getConfirmedPrefs('vm'));
            assert.deepEqual(confirmed.hiddenFolderIds, [root]);
            assert.equal(confirmed.liveRefreshEnabled, true);
            assert.deepEqual(await page.locator('#kvm_list > tr.folder').evaluateAll(nodes => nodes.map(node => node.getAttribute('parent-id'))), [root, 'second']);
            await tick(page, page.waitForRequest(request => isSnapshot(new URL(request.url()), 'vm', 'check')));
        } finally {
            await closeFilterViewHost(page, host);
        }
    }, { skipAccessibility: true });
};
