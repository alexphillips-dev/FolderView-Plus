import assert from 'node:assert/strict';
import { createDockerBadgeHost, mountVmBadgeHost } from '../helpers/folder-badges-host.mjs';
const profiles = [{ running: false, stopped: false }, { running: true, stopped: false }, { running: false, stopped: true }, { running: true, stopped: true }];

export const registerFolderBadgeCases = ({ test, baseUrl }) => {
    test('Folder badges honor Docker preferences through nested aggregation, transitions and reload', async ({ page }) => {
        const host = await createDockerBadgeHost(page);
        const foldersBefore = JSON.stringify(host.folders);
        const wait = async () => {
            await page.waitForFunction(() => window.fixtureDockerBadges && document.querySelector('tr.folder-id-direct'));
            await page.waitForLoadState('networkidle');
        };
        const read = () => page.locator('tr.folder').evaluateAll(rows => rows.map(row => {
            const icon = row.querySelector('i.folder-load-status');
            // WebKit can retain computed styles inside a collapsed display:none subtree.
            return { id: row.dataset.fvFolderId, kind: icon.classList.contains('started') ? 'running' : icon.classList.contains('stopped') ? 'stopped' : 'paused',
                display: row.getClientRects().length ? getComputedStyle(icon).display : icon.style.display,
                text: row.querySelector('.folder-state').textContent,
                update: !!row.querySelector(':scope > td.updatecolumn'),
                previewSpan: row.querySelector(':scope > td.folder-preview-cell').getAttribute('colspan') };
        }));
        try {
            await page.goto(host.url, { waitUntil: 'load' }); await wait();
            assert.ok((await read()).every(row => row.display === 'none' && !row.update));
            for (const [index, profile] of profiles.entries()) {
                const badges = { ...profile, updates: index % 2 === 0 };
                await page.evaluate(badges => window.fixtureDockerBadges.save(badges), badges);
                assert.deepEqual(host.prefs().badges, badges);
                await page.evaluate(() => window.fixtureDockerBadges.refresh());
                assert.ok((await read()).every(row => (row.display !== 'none') === (row.kind === 'paused' || badges[row.kind])), 'refresh reads newly saved preferences before a page reload');
                await page.reload({ waitUntil: 'load' }); await wait();
                const initial = await read();
                for (const state of ['stopped', 'started', 'paused', 'started', 'stopped']) {
                    await page.evaluate(state => window.fixtureDockerBadges.state(state), state);
                    const rows = await read();
                    const visible = state === 'started' ? badges.running : state === 'stopped' ? badges.stopped : true;
                    assert.ok(rows.every(row => (row.display !== 'none') === visible), `${state}: ${JSON.stringify({ badges, rows })}`);
                    assert.ok(rows.every(row => /1\/1/.test(row.text)), 'counts remain visible when icons are hidden');
                    assert.deepEqual(rows.map(row => [row.update, row.previewSpan]), initial.map(row => [row.update, row.previewSpan]));
                }
                assert.equal(await page.locator('tr.folder-id-direct > td.updatecolumn').count(), 0, 'per-folder update-column override remains authoritative');
                assert.equal(await page.locator('tr.folder-id-parent > td.updatecolumn').count(), badges.updates ? 1 : 0);
                if (await page.locator('.dropDown-parent').getAttribute('active') !== 'true') await page.locator('.dropDown-parent').click();
                await page.locator('tr.folder-id-branch').waitFor({ state: 'visible' });
                assert.ok((await read()).every(row => (row.display !== 'none') === badges.stopped));
                assert.equal(await page.locator('tr.folder-id-branch i.folder-load-status').evaluate(node => getComputedStyle(node).display !== 'none'), badges.stopped);
            }
            assert.equal(JSON.stringify(host.folders), foldersBefore);
        } finally {
            await page.goto('about:blank'); await page.unrouteAll({ behavior: 'wait' }); await host.close();
        }
    }, { skipAccessibility: true });

    test('Folder badges restore VM icon visibility after each runtime state and preference change', async ({ page }) => {
        await mountVmBadgeHost(page, baseUrl);
        const icon = page.locator('#load-folder-media');
        for (const badges of profiles) {
            await icon.evaluate(node => { node.style.display = 'none'; });
            for (const state of ['running', 'shutoff', 'paused', 'pmsuspended', 'running']) {
                await page.evaluate(({ badges, state }) => window.fixtureVmBadges(badges, state), { badges, state });
                const visible = state === 'running' ? badges.running : state === 'shutoff' ? badges.stopped : true;
                assert.equal(await icon.evaluate(node => getComputedStyle(node).display !== 'none'), visible, `${state}: ${JSON.stringify(badges)}`);
                assert.match(await page.locator('.folder-state').textContent(), /1\/1/);
                assert.doesNotMatch(await icon.getAttribute('class'), /fa-spin|fa-refresh/);
            }
        }
    }, { skipAccessibility: true });
};
