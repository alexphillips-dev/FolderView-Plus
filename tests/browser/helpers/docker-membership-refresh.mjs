import assert from 'node:assert/strict';
import path from 'node:path';
import { createProductionPerfFixture } from '../../../scripts/lib/production-perf-fixture.mjs';
import { installHost } from './host-theme.mjs';

export const exerciseDockerMembershipRefresh = async ({ page }) => {
    for (const themed of [false, true]) {
        const host = createProductionPerfFixture(path.resolve(process.cwd()), { folders: 4, members: 12 });
        await new Promise(resolve => host.server.listen(0, '127.0.0.1', resolve));
        const origin = `http://127.0.0.1:${host.server.address().port}`;
        const hostPattern = `${origin}/fixture-host.js*`;
        const snapshotPattern = `${origin}/plugins/folderview.plus/server/runtime_snapshot.php*`;
        let detailResponses = 0;
        try {
            await page.route(hostPattern, async route => {
                const response = await route.fetch();
                const body = (await response.text()).replace('window.loadlist = () => window.listview();',
                    `const nativeRows = document.getElementById('docker_list').innerHTML;
window.loadlist = () => {
    window.fixtureNativeRefreshCount = (window.fixtureNativeRefreshCount || 0) + 1;
    jQuery('#docker_list').html(nativeRows);
    window.listview();
};`);
                await route.fulfill({ response, body });
            });
            await page.route(snapshotPattern, async route => {
                const response = await route.fetch(), data = await response.json();
                if (new URL(route.request().url()).searchParams.get('mode') === 'full') {
                    detailResponses++;
                    data.runtime = Object.fromEntries(Object.entries(data.runtime).reverse());
                    await new Promise(resolve => setTimeout(resolve, 350));
                }
                await route.fulfill({ response, json: data });
            });
            await page.goto(`${origin}/docker`, { waitUntil: 'load' });
            await page.waitForFunction(() => document.querySelectorAll('#docker_list tr.folder').length === 4);
            if (themed) await installHost(page, origin);
            await page.waitForTimeout(1500);
            const before = await page.evaluate(() => {
                window.fixtureMembershipFolder = document.querySelector('#docker_list tr.folder');
                return [...document.querySelectorAll('#docker_containers th')].map(node => node.getBoundingClientRect().width);
            });
            await page.waitForTimeout(6500);
            const after = await page.evaluate(() => {
                const trace = JSON.parse(localStorage.getItem('fv.support.bundle.docker.refreshDiagnostics.v1'));
                return { reloads: window.fixtureNativeRefreshCount,
                    configReloads: trace.currentSession.reloadSources['plugin-config-revision'],
                    folderPreserved: window.fixtureMembershipFolder === document.querySelector('#docker_list tr.folder'),
                    widths: [...document.querySelectorAll('#docker_containers th')].map(node => node.getBoundingClientRect().width) };
            });
            assert.equal(detailResponses, 1, 'equivalent reordered details must not start another request cycle');
            assert.equal(after.reloads, 1, 'only the initial native bootstrap may reload the list');
            assert.equal(after.configReloads, 0);
            assert.equal(after.folderPreserved, true);
            assert.ok(after.widths.every((width, index) => Math.abs(width - before[index]) < 0.5), 'idle column widths must remain stable');
        } finally {
            await page.goto('about:blank');
            await page.unroute(hostPattern); await page.unroute(snapshotPattern);
            host.server.closeAllConnections();
            await new Promise(resolve => host.server.close(resolve));
        }
    }
};
