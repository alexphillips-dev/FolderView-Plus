import assert from 'node:assert/strict';
import { createDockerBadgeHost } from '../helpers/folder-badges-host.mjs';

export const registerEngineIdentityCases = ({ test }) => {
    test('Docker incremental preview buttons retain visible member identity when an earlier preview is hidden', async ({ page }) => {
        const host = await createDockerBadgeHost(page, { running: true, stopped: true, updates: true });
        const names = Object.keys(host.runtime);
        for (const key of Object.keys(host.folders)) delete host.folders[key];
        host.folders.identity = {
            name: 'Identity fixture', containers: names, hiddenPreviewMembers: [names[0]],
            icon: '/plugins/folderview.plus/images/folder-icon.png',
            settings: { preview: 1, preview_rows: 1, preview_console: true, preview_logs: true, preview_hover: false, context: 0 },
            actions: []
        };
        host.runtime[names[0]].info.Shell = '/bin/sh';
        host.runtime[names[1]].info.Shell = '/bin/bash';
        // This small host omits the native icon trigger; restore its normal markup
        // so the single-row icon preview exercises the same owner as Unraid.
        await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
            if (!window.jQuery) return;
            window.jQuery.fn.tooltipster = function (action) { return action === 'instance' ? null : this; };
            window.jQuery.tooltipster = { instances: () => [] };
            const nativeLoadlist = window.loadlist;
            window.loadlist = (...args) => {
                const result = nativeLoadlist(...args);
                document.querySelectorAll('#docker_list > tr > td.ct-name > span.outer > img').forEach(img => {
                    const hand = document.createElement('span');
                    hand.className = 'hand';
                    img.before(hand); hand.append(img);
                });
                return result;
            };
        }));
        try {
            for (const preview of [1, 2, 3, 4]) for (const rows of [1, 2]) {
                Object.assign(host.folders.identity.settings, { preview, preview_rows: rows });
                await page.goto(host.url, { waitUntil: 'load' });
                await page.waitForFunction(() => document.querySelectorAll('tr.folder-id-identity [data-fv-preview-action="console"]').length === 1);
                await page.evaluate(() => {
                    window.fixtureTerminalCalls = [];
                    window.openTerminal = (type, name, shell) => window.fixtureTerminalCalls.push({ type, name, shell });
                    window.fixtureDockerBadges.refresh();
                });
                const visible = page.locator('tr.folder-id-identity div.folder-preview');
                for (const action of ['console', 'logs']) {
                    const button = visible.locator(`[data-fv-preview-action="${action}"]`);
                    assert.equal(await button.count(), 1);
                    assert.equal(await button.getAttribute('data-container-name'), names[1], `preview ${preview}, rows ${rows}, ${action}`);
                    assert.equal(await button.evaluate(node => node.closest('[data-fv-container-name]').getAttribute('data-fv-container-name')), names[1]);
                    await button.click();
                }
                assert.deepEqual(await page.evaluate(() => window.fixtureTerminalCalls), [
                    { type: 'docker', name: names[1], shell: '/bin/bash' },
                    { type: 'docker', name: names[1], shell: '.log' }
                ]);
                assert.equal(await page.locator('tr.folder-id-identity div.folder-storage > tr').count(), 2, 'preview omission retains both original native members');
                assert.equal(await visible.locator(`[data-fv-container-name="${names[0]}"]`).count(), 0);
            }
        } finally {
            await page.goto('about:blank');
            await page.unrouteAll({ behavior: 'wait' });
            await host.close();
        }
    }, { skipAccessibility: true });
};
