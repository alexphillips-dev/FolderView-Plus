import assert from 'node:assert/strict';
import { assertQuickFinderSizing } from '../helpers/quick-finder-sizing.mjs';
import { registerQuickFinderSafetyCases } from './runtime-quick-finder-safety.mjs';

export const registerQuickFinderResultCases = ({ test, baseUrl }) => {
    test('Quick finder reference cards keep counted sections, status badges and actions responsive', async ({ page }) => {
        for (const type of ['docker', 'vm']) {
            await page.goto(`${baseUrl}/fixtures/runtime-quick-finder.html?type=${type}`);
            await page.locator('[data-finder-toggle]').click();
            await page.locator('.fv-quickfinder input').fill('home');
            await page.waitForFunction(() => document.querySelectorAll('.fv-quickfinder-result').length === 4);
            await assertQuickFinderSizing(page);
            await page.locator('.fv-quickfinder-popover').evaluate(n => Promise.all([...n.getAnimations(), ...document.querySelector('.fv-quickfinder-field').getAnimations()].map(a => a.finished)));
            assert.equal(await page.locator('[data-finder-filter] > svg').count(), 3);
            assert.deepEqual(await page.locator('.fv-quickfinder-group-count').allTextContents(), ['2 results', '2 results']);
            assert.equal(await page.locator('.fv-quickfinder-footer kbd').count(), 3);
            assert.equal(await page.locator('.fv-quickfinder-hint').textContent(), type === 'docker' ? 'Search Docker objects' : 'Search VM objects');
            const card = page.locator('.fv-quickfinder-result').first();
            const title = await card.locator('[data-finder-select]').boundingBox();
            const action = await card.locator('[data-finder-action="focus"]').boundingBox();
            if (page.viewportSize().width > 640) assert.ok(action.x >= title.x + title.width);
            else assert.ok(action.y >= title.y + title.height);
            const panel = await page.locator('.fv-quickfinder-popover').boundingBox();
            assert.ok(panel.x >= 0 && panel.x + panel.width <= page.viewportSize().width);
            assert.equal(await page.locator('.fv-quickfinder-results').evaluate(node => node.scrollWidth <= node.clientWidth), true);
            assert.equal(await page.locator('.fv-quickfinder-status[data-state="running"]').evaluate(node => getComputedStyle(node).borderTopWidth), '1px');
            assert.equal(await page.locator('.fv-quickfinder-status[data-state="stopped"]').evaluate(node => getComputedStyle(node, '::before').borderRadius), '50%');
            await page.locator('[data-finder-group="folder"]').click();
            assert.equal(await page.locator('[data-finder-group="folder"]').getAttribute('aria-expanded'), 'false');
            await page.evaluate(() => window.fixtureFinder.refresh());
            assert.equal(await page.evaluate(() => document.activeElement.dataset.finderGroup), 'folder');
            assert.equal(await page.locator('.fv-quickfinder-result:visible').count(), 2);
            await page.locator('.fv-quickfinder input').focus();
            await page.keyboard.press('ArrowDown');
            assert.equal(await page.evaluate(() => document.activeElement.closest('.fv-quickfinder-result').classList.contains('fv-quickfinder-item-result')), true);
            await page.locator('[data-finder-group="folder"]').click();
            assert.equal(await page.locator('.fv-quickfinder-result:visible').count(), 4);
            await page.locator('[data-finder-filter="item"]').click();
            assert.equal(await page.locator('[data-finder-group="folder"]').count(), 0);
            assert.equal(await page.locator('.fv-quickfinder-result').count(), 2);
            await page.locator('.fv-quickfinder input').fill('');
            assert.equal(await page.locator('.fv-quickfinder-popover').isVisible(), false);
        }
    });

    test('Quick finder three-dot controls open the existing folder and member menus', async ({ page }) => {
        for (const type of ['docker', 'vm']) {
            await page.goto(`${baseUrl}/fixtures/runtime-quick-finder.html?type=${type}`);
            for (const [query, event] of [['Home Automation', 'folder-native-menu'], ['Assistant', 'native-menu']]) {
                await page.locator('[data-finder-toggle]').click();
                await page.locator('.fv-quickfinder input').fill(query);
                await page.waitForFunction(expected => document.querySelector('.fv-quickfinder-name')?.textContent === expected, query);
                await page.locator('.fv-quickfinder-result').filter({ has: page.locator('.fv-quickfinder-name', { hasText: new RegExp(`^${query}$`) }) }).locator('.fv-quickfinder-more').click();
                await page.waitForFunction(expected => window.fixtureFinder.events.some(item => item.action === expected), event);
                assert.equal(await page.locator('.fv-quickfinder-popover').isVisible(), false);
            }
        }
    });
    registerQuickFinderSafetyCases({ test, baseUrl });
};
