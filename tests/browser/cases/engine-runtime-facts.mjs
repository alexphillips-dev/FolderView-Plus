import assert from 'node:assert/strict';
import { createDockerBadgeHost } from '../helpers/folder-badges-host.mjs';

export const registerEngineRuntimeFactCases = ({ test }) => {
    for (const [updated, expected, label] of [[true, 0, 'up-to-date'], [false, 2, 'update-ready']]) {
        test(`Docker Command overview and member cards agree on canonical host update availability (${label})`, async ({ page }) => {
            await page.addInitScript(() => { window.eventURL = '/fixture-actions'; });
            const host = await createDockerBadgeHost(page, { running: true, stopped: true, updates: true });
            await page.addInitScript(updated => document.addEventListener('DOMContentLoaded', () => {
                if (!window.jQuery) return;
                const nativeLoadlist = window.loadlist;
                window.loadlist = (...args) => {
                    const result = nativeLoadlist(...args);
                    document.querySelectorAll('#docker_list > tr > td.updatecolumn').forEach(cell => {
                        cell.innerHTML = updated ? 'up-to-date' : '<i class="fa fa-flash"></i> update ready';
                    });
                    return result;
                };
            }), updated);
            Object.assign(host.prefs(), { pageViewMode: 'command' });
            for (const entry of Object.values(host.runtime)) Object.assign(entry.info.State, { Updated: updated, manager: 'dockerman' });
            try {
                await page.goto(host.url, { waitUntil: 'load' });
                await page.waitForFunction(() => document.querySelector('.fv-docker-command-overview-card'));
                const value = await page.locator('.fv-docker-command-overview-card').evaluateAll(cards => {
                    const card = cards.find(node => node.querySelector('.fv-docker-command-overview-label')?.textContent === 'update ready');
                    return Number(card?.querySelector('.fv-docker-command-overview-value')?.textContent);
                });
                assert.equal(value, expected, `host Updated=${updated}`);
                const tiles = await page.locator('.fv-docker-command-member-tile').evaluateAll(nodes => nodes.map(node => ({
                    name: node.getAttribute('data-member-name'), update: node.classList.contains('has-update')
                })));
                assert.ok(tiles.length > 0);
                assert.ok(tiles.every(tile => tile.update === (expected > 0)), 'all cards use the same normalized update meaning as the overview');
            } finally {
                await page.goto('about:blank');
                await page.unrouteAll({ behavior: 'wait' });
                await host.close();
            }
        }, { skipAccessibility: true });
    }
};
