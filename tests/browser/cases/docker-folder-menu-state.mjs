import assert from 'node:assert/strict';
import { createDockerFolderMenuHost } from '../helpers/docker-folder-menu-host.mjs';
import { registerNestedFolderMenuCases } from './docker-nested-folder-menu.mjs';
import { registerDockerFolderFeedbackCases } from './docker-folder-feedback.mjs';

const checkMenuAccessibility = async page => {
    await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
    const violations = await page.evaluate(async () => (await window.axe.run(document.getElementById('synthetic-folder-menu'))).violations);
    assert.deepEqual(violations, [], 'the folder menu must pass its scoped accessibility check');
};

export const registerDockerFolderMenuStateCases = ({ test }) => {
    registerNestedFolderMenuCases({ test, checkMenuAccessibility });
    registerDockerFolderFeedbackCases({ test });
    test('Docker folder menu shows shortcut states and separates removal', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const host = await createDockerFolderMenuHost(page);
        const menu = page.locator('#synthetic-folder-menu');
        const open = async () => {
            await page.locator('#direct').click();
            await menu.locator('.fvplus-docker-quick-item').nth(3).waitFor();
        };
        const state = async () => menu.locator('.fvplus-docker-quick-item > a').evaluateAll(links => links.map(link => ({
            active: link.getAttribute('aria-pressed') === 'true',
            label: link.getAttribute('aria-label'), title: link.title,
            marked: link.parentElement.classList.contains('fvplus-docker-quick-active'),
            color: getComputedStyle(link.querySelector('i, svg')).color,
            background: getComputedStyle(link).backgroundColor
        })));
        try {
            await page.goto(host.url, { waitUntil: 'load' });
            await page.waitForLoadState('networkidle');
            await open();
            assert.deepEqual((await state()).map(item => item.active), [false, false, false, false]);
            for (const label of ['Focus folder', 'Pin folder', 'Lock folder']) {
                await menu.getByRole('button', { name: label, exact: true }).click();
                await page.waitForLoadState('networkidle');
                await open();
            }
            const active = await state();
            assert.deepEqual(active.map(item => item.active), [true, true, true, false]);
            assert.deepEqual(active.map(item => item.marked), [true, true, true, false]);
            assert.deepEqual(active.map(item => item.label), ['Clear focus', 'Unpin folder', 'Unlock folder', 'Hide folder']);
            assert.ok(active.every(item => item.title === item.label));
            const visuals = await menu.evaluate(element => {
                const activeLink = element.querySelector('.fvplus-docker-quick-active > a');
                const inactiveLink = element.querySelector('.fvplus-docker-quick-item:not(.fvplus-docker-quick-active) > a');
                const removeRow = element.querySelector('.fvplus-docker-remove-item');
                return {
                    activeColor: getComputedStyle(activeLink).color, inactiveColor: getComputedStyle(inactiveLink).color,
                    activeBackground: getComputedStyle(activeLink).backgroundColor,
                    activeHeight: activeLink.getBoundingClientRect().height,
                    inactiveHeight: inactiveLink.getBoundingClientRect().height,
                    separated: removeRow.previousElementSibling.classList.contains('divider'),
                    last: removeRow === element.lastElementChild,
                    removeColor: getComputedStyle(removeRow.querySelector('a')).color,
                    ordinaryColor: getComputedStyle(element.querySelector('li:not(.fvplus-docker-quick-item):not(.divider) > a')).color
                };
            });
            assert.equal(visuals.activeColor, visuals.inactiveColor, 'only the icon changes color');
            assert.ok(active.every(item => item.background === 'rgba(0, 0, 0, 0)'));
            assert.equal(new Set(active.slice(0, 3).map(item => item.color)).size, 3);
            assert.ok(active.slice(0, 3).every(item => item.color !== active[3].color));
            assert.equal(active[1].color, 'rgb(255, 202, 99)', 'Pin retains its yellow status color');
            assert.equal(visuals.activeHeight, visuals.inactiveHeight);
            assert.equal(visuals.separated, true);
            assert.equal(visuals.last, true);
            assert.notEqual(visuals.removeColor, visuals.ordinaryColor);
            await menu.getByRole('button', { name: 'Unlock folder', exact: true }).click();
            await open();
            await menu.getByRole('button', { name: 'Clear focus', exact: true }).click();
            await open();
            assert.equal((await state())[0].active, false);
            await menu.getByRole('button', { name: 'Hide folder', exact: true }).click();
            await page.waitForLoadState('networkidle');
            await page.locator('[data-fvplus-docker-menu="view"]').click();
            await page.locator('.fvplus-docker-action-menu.is-open [data-fvplus-docker-hidden="toggle-reveal"]').click();
            await open();
            await menu.locator('svg[data-fv-icon="eye"]').waitFor();
            assert.equal((await state())[3].active, true);
            assert.equal(new Set([...active.slice(0, 3).map(item => item.color), (await state())[3].color]).size, 4);
            assert.equal((await state())[3].background, 'rgba(0, 0, 0, 0)');
            const restore = menu.getByRole('button', { name: 'Restore folder', exact: true });
            await page.keyboard.press('Tab');
            await restore.focus();
            assert.notEqual(await restore.evaluate(link => getComputedStyle(link).outlineStyle), 'none');
            await restore.press('Enter');
            await page.waitForLoadState('networkidle');
            await open();
            assert.equal((await state())[3].active, false);
            assert.equal((await state())[2].active, false);
            await menu.getByRole('button', { name: 'Unpin folder', exact: true }).click();
            await page.waitForLoadState('networkidle');
            await open();
            assert.deepEqual((await state()).map(item => item.active), [false, false, false, false]);
            await checkMenuAccessibility(page);
        } finally { await host.close(); }
    }, { skipAccessibility: true }); // Check the menu directly; the synthetic host omits native accessibility markup.

    test('Docker folder menu reflects hiding inherited from a parent', async ({ page }) => {
        const host = await createDockerFolderMenuHost(page);
        host.prefs().hiddenFolderIds = ['parent'];
        try {
            await page.goto(host.url, { waitUntil: 'load' });
            await page.waitForLoadState('networkidle');
            await page.locator('[data-fvplus-docker-menu="view"]').click();
            await page.locator('.fvplus-docker-action-menu.is-open [data-fvplus-docker-hidden="toggle-reveal"]').click();
            await page.locator('.dropDown-parent').click();
            await page.locator('#branch').click();
            const restore = page.locator('#synthetic-folder-menu').getByRole('button', { name: 'Restore hidden branch', exact: true });
            await restore.waitFor();
            assert.equal(await restore.getAttribute('aria-pressed'), 'true');
            assert.equal(await restore.evaluate(link => link.parentElement.classList.contains('fvplus-docker-quick-active')), true);
            await checkMenuAccessibility(page);
        } finally { await host.close(); }
    }, { skipAccessibility: true });
};
