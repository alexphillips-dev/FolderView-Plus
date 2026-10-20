import assert from 'node:assert/strict';
import { createDockerBadgeHost } from '../helpers/folder-badges-host.mjs';
import { createHideEmptySettingsHost } from '../helpers/settings-hide-empty-host.mjs';

export const registerFolderBadgeDefaultCases = ({ test }) => {
    for (const type of ['docker', 'vm']) {
        test(`Folder badges default on in ${type} Settings and preserve saved opt-outs after reload`, async ({ page }) => {
            const host = await createHideEmptySettingsHost(page, type);
            host.prefs().runtimePrefsSchema = 5; // The server persists the upgrade before returning preferences.
            const keys = type === 'docker' ? ['running', 'stopped', 'updates'] : ['running', 'stopped'];
            const load = async () => {
                await page.goto(host.url, { waitUntil: 'load' });
                await page.waitForFunction(() => !document.getElementById('fv-settings-root').classList.contains('fv-settings-bootstrap-pending'));
                await page.locator(`#${type}-view-settings`).evaluate(node => { node.open = true; });
            };
            const set = async (key, checked) => {
                const saved = page.waitForResponse(response => response.url().includes('/server/prefs.php')
                    && response.request().method() === 'POST'
                    && new URLSearchParams(response.request().postData()).get('type') === type);
                await page.locator(`#${type}-badge-${key}`).setChecked(checked);
                await saved;
            };
            host.releaseRuntime();
            try {
                await load();
                for (const key of keys) assert.equal(await page.locator(`#${type}-badge-${key}`).isChecked(), true, key);
                for (const key of keys) await set(key, false);
                await load();
                for (const key of keys) assert.equal(await page.locator(`#${type}-badge-${key}`).isChecked(), false, key);
                await set('stopped', true);
                await load();
                for (const key of keys) assert.equal(await page.locator(`#${type}-badge-${key}`).isChecked(), key === 'stopped', key);
                await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
                const violations = await page.evaluate(async ({ type, keys }) => (await window.axe.run({ include: keys.map(key => [`label:has(#${type}-badge-${key})`]) },
                    { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations, { type, keys });
                assert.deepEqual(violations, [], 'badge controls accessibility');
            } finally {
                await page.unrouteAll({ behavior: 'wait' }); await host.close();
            }
        }, { skipAccessibility: true }); // Check badge controls above; the synthetic host omits native page accessibility markup.
    }

    test('Folder badges show running, stopped and updates with no saved Docker badge preferences', async ({ page }) => {
        const host = await createDockerBadgeHost(page, null);
        const verify = async () => {
            for (const id of ['parent', 'direct']) {
                assert.equal(await page.locator(`tr.folder-id-${id} i.folder-load-status`).evaluate(node => getComputedStyle(node).display !== 'none'), true);
            }
            assert.equal(await page.locator('tr.folder-id-parent > td.updatecolumn').count(), 1);
            assert.equal(await page.locator('tr.folder-id-direct > td.updatecolumn').count(), 0, 'explicit per-folder override remains authoritative');
        };
        try {
            await page.goto(host.url, { waitUntil: 'load' });
            await page.waitForFunction(() => window.fixtureDockerBadges && document.querySelector('tr.folder-id-direct'));
            await page.waitForLoadState('networkidle');
            await verify();
            await page.evaluate(() => window.fixtureDockerBadges.state('stopped'));
            await verify();
        } finally {
            await page.goto('about:blank'); await page.unrouteAll({ behavior: 'wait' }); await host.close();
        }
    }, { skipAccessibility: true });
};
