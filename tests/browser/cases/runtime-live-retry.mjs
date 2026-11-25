import assert from 'node:assert/strict';
import { dashboardFixtureRows as rows, membershipSnapshot, runtimeSnapshotPayload as payload } from '../helpers/dashboard-membership-host.mjs';
import { createDockerHideEmptyHost } from '../helpers/docker-hide-empty-host.mjs';

const dockerIds = page => page.locator('#docker_list > tr.folder').evaluateAll(rows => rows.map(row => row.dataset.fvFolderId));

export const registerRuntimeLiveRetryCases = ({
    test, baseUrl, both, dashboardIds, folderNames, isSnapshot, livePrefs, ready, tick, widgetFixture
}) => {
    for (const type of both) {
        test(`Dashboard recovers ${type} after the rapid widget retry budget`, async ({ page }) => {
            await page.clock.install();
            const fixture = await widgetFixture(page, baseUrl);
            const sibling = type === 'docker' ? 'vm' : 'docker';
            const snapshot = { ...membershipSnapshot(type, rows[type]), ...payload(type, 'a') };
            Object.assign(snapshot.prefs, livePrefs);
            const peer = membershipSnapshot(sibling, rows[sibling]);
            await fixture.load();
            fixture.settle(type, 0, 1, false, snapshot);
            fixture.settle(sibling, 0, 1, false, peer);
            await ready(fixture);
            await fixture.load();
            fixture.settle(type, 1, 1, true);
            fixture.settle(sibling, 1, 1, false, peer);
            await fixture.waitForState(type, 'failed');
            await fixture.waitForState(sibling, 'ready');
            const original = await fixture.widget(sibling).locator('.folder-showcase-outer').first().elementHandle();
            const fullRequests = [];
            page.on('request', request => {
                if (isSnapshot(new URL(request.url()), type, 'full')) fullRequests.push(request.url());
            });
            const nextFull = () => page.waitForRequest(request => isSnapshot(new URL(request.url()), type, 'full'));
            for (const index of [2, 3, 4]) {
                await tick(page, nextFull());
                fixture.settle(type, index, 1, true);
                await fixture.waitForState(type, 'failed');
            }
            await page.clock.runFor(20_000);
            assert.equal(fullRequests.length, 3, 'retry sleeps through the early cooldown ticks');
            await page.route(url => isSnapshot(url, type, 'full'), route => route.fulfill({ json: snapshot }));
            const next = page.waitForResponse(response => isSnapshot(new URL(response.url()), type, 'full'));
            await page.clock.fastForward(61_000);
            await next;
            await page.clock.runFor(600);
            await fixture.waitForState(type, 'ready');
            assert.deepEqual(await dashboardIds(fixture, type), [`${type}-group`]);
            assert.equal(await original.evaluate(node => node.isConnected), true);
            assert.equal(await page.evaluate(() => window.getFolderViewPlusDashboardHostSnapshot().nativeRequestCount), 2);
        });
    }

    for (const orderMode of ['config', 'state']) {
        test(`Docker live refresh applies a ${orderMode} order-only change without rebuilding on status changes`, async ({ page }) => {
            await page.clock.install();
            const host = await createDockerHideEmptyHost(page, true);
            try {
                const names = Object.keys(host.runtime);
                for (const key of Object.keys(host.folders)) delete host.folders[key];
                Object.assign(host.folders, folderNames('first', names));
                Object.assign(host.prefs(), livePrefs, { dockerRowPlacement: 'saved-order', sortMode: 'created' });
                let order = ['folder-first', 'folder-second', ...names];
                let token = 'a';
                await page.route('**/graphql', route => route.fulfill({ json: { data: {} } }));
                await page.route('**/server/runtime_snapshot.php?**', route => {
                    const mode = new URL(route.request().url()).searchParams.get('mode');
                    const hasRuntime = mode !== 'config';
                    return route.fulfill({ json: {
                        ...payload('docker', token, host.revisions()), mode, folders: host.folders, prefs: host.prefs(),
                        order: hasRuntime ? order : ['folder-config-only', ...order],
                        unraidOrder: hasRuntime ? names : [], runtimeIncluded: hasRuntime,
                        ...(hasRuntime ? { runtime: host.runtime } : {}), metadata: host.prefs()._metadata,
                        ...(orderMode === 'config' ? { nativeSavedOrder: order } : {})
                    } });
                });
                await page.goto(host.url);
                await page.waitForFunction(() => document.querySelectorAll('#docker_list > tr.folder').length === 2);
                assert.deepEqual(await dockerIds(page), ['first', 'second']);
                const nativeRefreshCount = () => page.evaluate(() => window.fixtureNativeRefreshCount || 0);
                const before = await nativeRefreshCount();
                token = 'b';
                Object.assign(host.runtime[names[0]], { state: 'stopped', running: false });
                await tick(page, page.waitForResponse(response => isSnapshot(new URL(response.url()), 'docker', 'state')));
                assert.equal(await nativeRefreshCount(), before);
                assert.deepEqual(await dockerIds(page), ['first', 'second']);

                token = 'c';
                order = ['folder-second', 'folder-first', ...names];
                await tick(page, page.waitForResponse(response => isSnapshot(new URL(response.url()), 'docker', orderMode)));
                await page.waitForFunction(() => document.querySelector('#docker_list > tr.folder')?.dataset.fvFolderId === 'second');
                assert.deepEqual(await dockerIds(page), ['second', 'first']);
                assert.equal(await nativeRefreshCount(), before + 1);
                await tick(page, page.waitForResponse(response => isSnapshot(new URL(response.url()), 'docker', 'state')));
                assert.equal(await nativeRefreshCount(), before + 1, 'a steady snapshot does not rebuild again');
            } finally {
                await page.unrouteAll({ behavior: 'wait' });
                await host.close();
            }
        }, { skipAccessibility: true });
    }
};
