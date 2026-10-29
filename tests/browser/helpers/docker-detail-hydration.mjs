import assert from 'node:assert/strict';
import { createProductionPerfFixture } from '../../../scripts/lib/production-perf-fixture.mjs';
import { nativeSwitchHost, nativeSwitchCss } from './docker-native-switch.mjs';
import { installHost } from './host-theme.mjs';

export const exerciseDockerDetailHydration = async ({ page, themeInstaller = installHost }) => {
    for (const themed of [false, true]) {
        const host = createProductionPerfFixture(process.cwd(), { folders: 2, members: 6 });
        await new Promise(resolve => host.server.listen(0, '127.0.0.1', resolve));
        const origin = `http://127.0.0.1:${host.server.address().port}`;
        const hostPattern = `${origin}/fixture-host.js*`, snapshotPattern = `${origin}/plugins/folderview.plus/server/runtime_snapshot.php*`;
        let releaseDetails, detailsSeen = false;
        const detailGate = new Promise(resolve => { releaseDetails = resolve; });
        try {
            await page.route(hostPattern, async route => {
                const response = await route.fetch();
                await route.fulfill({ response, body: nativeSwitchHost(await response.text()) });
            });
            await page.route(snapshotPattern, async route => {
                const response = await route.fetch(), data = await response.json();
                const full = new URL(route.request().url()).searchParams.get('mode') === 'full';
                if (data.runtime) data.runtime = Object.fromEntries(Object.entries(data.runtime).map(([name, entry]) => {
                    const labels = { 'net.unraid.docker.managed': 'dockerman', scope: full ? 'detail' : 'state' };
                    return [name, full ? { Id: entry.id, shortId: entry.id.slice(0, 12), Image: 'fixture/detail:latest', Labels: labels,
                        info: { Id: entry.id, Name: name, Config: { Labels: labels, Image: 'fixture/detail:latest' },
                            State: { Running: true, Paused: false, Autostart: true, Updated: true, manager: 'dockerman', WebUiHydrationPending: false } } }
                        : { id: entry.id.slice(0, 12), Image: 'fixture/state:latest', Labels: labels,
                            state: 'running', running: true, paused: false, autostart: true, Updated: true, manager: 'dockerman' }];
                }));
                if (full) {
                    delete data.runtime[Object.keys(data.runtime).at(-1)];
                    detailsSeen = true;
                    await detailGate;
                }
                await route.fulfill({ response, json: data });
            });
            await page.goto(`${origin}/docker`, { waitUntil: 'load' });
            await page.addStyleTag({ content: nativeSwitchCss });
            await page.waitForFunction(() => document.querySelectorAll('#docker_list tr.folder').length === 2);
            if (themed) await themeInstaller(page, origin);
            await page.waitForFunction(() => [...document.querySelectorAll('.folder-autostart .switch-button-button')]
                .length === 2 && [...document.querySelectorAll('.folder-autostart .switch-button-button')]
                .every(node => !jQuery(node).is(':animated') && node.parentElement.classList.contains('checked')));
            const creates = await page.evaluate(() => {
                window.fixtureOriginalSwitch = document.querySelector('.folder-autostart .switch-button-button');
                return window.fixtureSwitchCreates;
            });
            assert.equal(detailsSeen, true);
            releaseDetails();
            await page.waitForFunction(() => JSON.parse(localStorage.getItem('fv.support.bundle.docker.page.v1') || '{}')
                ?.layoutStability?.phases?.['full-info-ready']?.count > 0);
            await page.waitForTimeout(1300);
            const result = await page.evaluate(() => ({ reloads: window.fixtureNativeRefreshCount, creates: window.fixtureSwitchCreates,
                sameSwitch: window.fixtureOriginalSwitch === document.querySelector('.folder-autostart .switch-button-button'),
                members: document.querySelectorAll('#docker_list .folder-storage > tr').length,
                details: JSON.parse(localStorage.getItem('fv.support.bundle.docker.page.v1')).layoutStability.phases['full-info-ready'].details }));
            assert.equal(result.reloads, 1);
            assert.equal(result.creates, creates);
            assert.equal(result.sameSwitch, true);
            assert.equal(result.members, 6);
            assert.equal(result.details.missingCount, 1);
            assert.equal(result.details.imageConflictCount, 5);
            assert.equal(result.details.labelConflictCount, 5);
        } finally {
            releaseDetails();
            await page.goto('about:blank');
            await page.unroute(hostPattern); await page.unroute(snapshotPattern);
            host.server.closeAllConnections(); await new Promise(resolve => host.server.close(resolve));
        }
    }
};
