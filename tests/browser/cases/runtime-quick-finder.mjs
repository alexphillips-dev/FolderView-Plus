import assert from 'node:assert/strict';
import { createDockerHideEmptyHost } from '../helpers/docker-hide-empty-host.mjs';

const openAndSearch = async (page, query) => {
    await page.locator('[data-finder-toggle]').click();
    await page.locator('.fv-quickfinder input').fill(query);
    await page.waitForFunction((expected) => {
        const names = [...document.querySelectorAll('.fv-quickfinder-name')].map(node => node.textContent);
        return ['Assistant', 'fixture-app-0'].includes(expected) ? names.length === 1 && names[0] === expected : names.some(name => name.toLowerCase().includes(expected.toLowerCase()));
    }, query);
};

export const registerRuntimeQuickFinderCases = ({ test, baseUrl }) => {
    test('Quick finder waits for typing and uses configured icons inside unified result cards', async ({ page }) => {
        for (const type of ['docker', 'vm']) {
            await page.goto(`${baseUrl}/fixtures/runtime-quick-finder.html?type=${type}`);
            await page.locator('[data-finder-toggle]').click();
            assert.equal(await page.locator('.fv-quickfinder-popover').isVisible(), false);
            assert.equal(await page.locator('.fv-quickfinder-result').count(), 0);
            await page.locator('.fv-quickfinder input').fill('   ');
            assert.equal(await page.locator('.fv-quickfinder-popover').isVisible(), false);
            await page.locator('.fv-quickfinder input').fill('Home Automation');
            await page.locator('.fv-quickfinder-icon img').first().waitFor();
            const folder = page.locator('.fv-quickfinder-result').filter({ has: page.locator('.fv-quickfinder-name', { hasText: /^Home Automation$/ }) });
            assert.equal(await folder.locator('img').getAttribute('src'), '/plugin/images/folder-icon.png');
            assert.equal(await folder.locator('[data-finder-action="edit"]').count(), 1);
            assert.equal(await folder.locator('.fv-quickfinder-result-title').evaluate(node => getComputedStyle(node).borderTopColor), 'rgba(0, 0, 0, 0)');
            assert.equal(await folder.locator('.fv-quickfinder-result-title').evaluate(node => getComputedStyle(node).backgroundColor), 'rgba(0, 0, 0, 0)');
            await page.locator('.fv-quickfinder input').fill('Assistant');
            await page.waitForFunction(() => document.querySelectorAll('.fv-quickfinder-result').length === 1);
            assert.equal(await page.locator('.fv-quickfinder-icon img').getAttribute('src'), '/plugin/images/folder-icon.png');
            await page.locator('.fv-quickfinder-icon img').evaluate(node => node.dispatchEvent(new Event('error')));
            assert.equal(await page.locator('.fv-quickfinder-icon img').count(), 0);
            assert.notEqual(await page.locator('.fv-quickfinder-icon > i').evaluate(node => getComputedStyle(node).display), 'none');
            await page.evaluate(() => { window.fixtureFinder.runtime.Assistant.icon = 'javascript:alert(1)'; window.fixtureFinder.refresh(); });
            assert.equal(await page.locator('.fv-quickfinder-icon img').count(), 0);
            await page.evaluate(() => {
                window.fixtureFinder.runtime.Assistant.icon = '';
                const native = document.createElement('img'); native.src = '/plugin/images/folder-icon.png?native=1&source=test';
                document.querySelector('#ct-Assistant td').prepend(native); window.fixtureFinder.refresh();
            });
            assert.equal(await page.locator('.fv-quickfinder-icon img').getAttribute('src'), '/plugin/images/folder-icon.png?native=1&source=test');
            await page.locator('.fv-quickfinder input').fill('');
            assert.equal(await page.locator('.fv-quickfinder-popover').isVisible(), false);
            assert.equal(await page.locator('.fv-quickfinder-result').count(), 0);
            await page.keyboard.press('ArrowDown');
            assert.equal(await page.evaluate(() => document.activeElement.tagName), 'INPUT');
            await page.keyboard.press('Escape');
            await page.locator('[data-finder-toggle]').click();
            assert.equal(await page.locator('.fv-quickfinder input').inputValue(), '');
            assert.equal(await page.locator('.fv-quickfinder-popover').isVisible(), false);
        }
    });

    test('Quick finder production Docker reveal waits for Host list to return to a grouped nested tree', async ({ page }) => {
        const host = await createDockerHideEmptyHost(page, true);
        try {
            await page.goto(host.url, { waitUntil: 'load' });
            await page.waitForFunction(() => document.querySelector('#docker_list tr.folder') && window.FolderViewPlusRuntimePerformanceTelemetry?.getSnapshot('docker')?.milestones?.foldersGrouped?.count > 0);
            await page.waitForLoadState('networkidle');
            await page.locator('[data-fvplus-docker-menu="view"]').press('ArrowDown');
            await page.locator('[data-fvplus-docker-view="host"]').click();
            await page.waitForFunction(() => !document.querySelector('#docker_list tr.folder'));
            await openAndSearch(page, 'fixture-app-0');
            await page.locator('[data-finder-action="reveal"]').click();
            await page.waitForFunction(() => document.querySelector('tr.fv-quickfinder-highlight')?.dataset.name === 'fixture-app-0');
            assert.equal(await page.locator('tr.fv-quickfinder-highlight').isVisible(), true);
            assert.equal(host.prefs().pageViewMode, 'folderview');
            assert.equal(await page.locator('tr.folder-id-parent').isVisible(), true);
            assert.equal(await page.locator('tr.folder-id-branch').isVisible(), true);
            assert.equal(await page.locator('tr.folder-id-leaf').isVisible(), true);
            assert.equal(await page.locator('.fv-quickfinder').count(), 1);
            assert.equal(await page.locator('.fv-quickfinder-popover').isVisible(), false);
        } finally { await host.close(); }
    }, { skipAccessibility: true }); // Synthetic native host omits surrounding Unraid accessibility markup; finder-only cases run axe.

    test('Quick finder Docker search sits left of Basic view and reveals collapsed nested members', async ({ page }) => {
        await page.goto(`${baseUrl}/fixtures/runtime-quick-finder.html`);
        const toggle = page.locator('.native-toggle');
        const before = await toggle.boundingBox();
        const collapsedWidth = (await page.locator('.fv-quickfinder-field').boundingBox()).width;
        await openAndSearch(page, 'Assistant');
        await page.waitForFunction((width) => document.querySelector('.fv-quickfinder-field').getBoundingClientRect().width > width * 2, collapsedWidth);
        const search = await page.locator('.fv-quickfinder').boundingBox();
        const after = await toggle.boundingBox();
        assert.ok(search.x + search.width <= after.x + 1);
        assert.ok(Math.abs(before.x - after.x) < 1, 'native toggle stays in place');
        assert.equal(await page.locator('[data-finder-action="webui"]').count(), 1);
        assert.equal(await page.locator('[data-finder-action="console"]').count(), 1);
        assert.equal(await page.locator('[data-finder-action="logs"]').count(), 1);
        await page.locator('[data-finder-action="reveal"]').click();
        await page.waitForSelector('tr.fv-quickfinder-highlight');
        assert.equal(await page.locator('.fv-quickfinder-popover').isVisible(), false);
        assert.equal(await page.locator('tr.fv-quickfinder-highlight').getAttribute('data-name'), 'Assistant');
        assert.deepEqual(await page.evaluate(() => window.fixtureFinder.events.filter(event => event.action === 'expand').map(event => event.id)), ['home', 'services']);
        assert.equal(await page.locator('tr.fv-quickfinder-highlight').isVisible(), true);
        await openAndSearch(page, 'Assistant');
        await page.locator('[data-finder-action="console"]').click();
        assert.deepEqual(await page.evaluate(() => window.fixtureFinder.events.find(event => event.action === 'terminal').args), ['docker', 'Assistant', '/bin/sh']);
    });

    test('Quick finder VM search uses VM logs and native actions without Docker shortcuts', async ({ page }) => {
        await page.goto(`${baseUrl}/fixtures/runtime-quick-finder.html?type=vm`);
        assert.equal(await page.locator('.fv-quickfinder input').getAttribute('placeholder'), 'Find folder or VM…');
        await openAndSearch(page, 'Assistant');
        assert.equal(await page.locator('[data-finder-action="webui"], [data-finder-action="console"]').count(), 0);
        assert.equal(await page.locator('[data-finder-action="actions"]').count(), 1);
        await page.locator('[data-finder-action="logs"]').click();
        assert.deepEqual(await page.evaluate(() => window.fixtureFinder.events.find(event => event.action === 'terminal').args), ['log', 'Assistant', '/sample/assistant.log']);
        await openAndSearch(page, 'Assistant');
        await page.locator('[data-finder-action="actions"]').click();
        await page.waitForFunction(() => window.fixtureFinder.events.some(event => event.action === 'native-menu'));
        assert.equal(await page.locator('[data-finder-toggle]').getAttribute('aria-expanded'), 'false');
        await page.locator('[data-finder-toggle]').click();
        await page.locator('.fv-quickfinder input').fill('Mosquitto');
        await page.waitForFunction(() => document.querySelector('.fv-quickfinder-name')?.textContent === 'Mosquitto');
        assert.equal(await page.locator('[data-finder-action="logs"]').count(), 0);
        await page.keyboard.press('Escape');
    });

    test('Quick finder layout supports mobile, keyboard, Privacy, RTL, and reduced motion', async ({ page }) => {
        await page.goto(`${baseUrl}/fixtures/runtime-quick-finder.html`);
        await openAndSearch(page, 'Assistant');
        const bounds = await page.locator('.fv-quickfinder-popover').boundingBox();
        const viewport = page.viewportSize();
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width + 1);
        assert.ok(bounds.y + bounds.height <= viewport.height + 1);
        await page.evaluate(() => document.body.classList.add('fvplus-privacy-docker-runtime-mask-names'));
        assert.notEqual(await page.locator('.fv-quickfinder-name').evaluate(node => getComputedStyle(node).filter), 'none');
        assert.notEqual(await page.locator('.fv-quickfinder input').evaluate(node => getComputedStyle(node).filter), 'none');
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => document.activeElement.hasAttribute('data-finder-toggle')), true);
        await page.keyboard.press('Control+k');
        await page.locator('.fv-quickfinder input').fill('Assistant');
        await page.locator('[data-finder-select]').waitFor();
        await page.keyboard.press('ArrowDown');
        assert.equal(await page.evaluate(() => document.activeElement.hasAttribute('data-finder-select')), true);
        await page.keyboard.press('Enter');
        await page.waitForSelector('tr.fv-quickfinder-highlight');
        await page.locator('[data-finder-toggle]').click();
        await page.locator('#outside').click();
        assert.equal(await page.locator('[data-finder-toggle]').getAttribute('aria-expanded'), 'false');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.evaluate(() => { document.body.classList.remove('fvplus-privacy-docker-runtime-mask-names'); document.documentElement.dir = 'rtl'; });
        await page.locator('[data-finder-toggle]').click();
        await page.locator('.fv-quickfinder input').fill('Assistant');
        await page.locator('[data-finder-select]').waitFor();
        assert.equal(await page.locator('.fv-quickfinder-field').evaluate(node => getComputedStyle(node).transitionDuration), '0s');
        assert.equal(await page.locator('.fv-quickfinder-popover').evaluate(node => getComputedStyle(node).animationName), 'none');
        const rtl = await page.locator('.fv-quickfinder-popover').boundingBox();
        assert.ok(rtl.x >= 0 && rtl.x + rtl.width <= viewport.width + 1);
    });

    test('Quick finder refresh, remount, stale actions, and teardown preserve lifecycle safety', async ({ page }) => {
        await page.goto(`${baseUrl}/fixtures/runtime-quick-finder.html`);
        await openAndSearch(page, 'Assistant');
        await page.evaluate(() => { for (let index = 0; index < 10; index++) window.fixtureFinder.refresh(); });
        assert.equal(await page.locator('.fv-quickfinder').count(), 1);
        assert.equal(await page.locator('.fv-quickfinder input').inputValue(), 'Assistant');
        await page.evaluate(() => { window.fixtureFinder.runtime.Assistant.state = false; });
        await page.locator('[data-finder-action="console"]').click();
        assert.equal(await page.evaluate(() => window.fixtureFinder.events.filter(event => event.action === 'terminal').length), 0);
        assert.equal(await page.locator('[data-finder-action="console"]').isDisabled(), true);
        await page.evaluate(() => window.fixtureFinder.removeItem('Assistant'));
        assert.equal(await page.locator('.fv-quickfinder-result').count(), 0);
        await page.evaluate(() => window.fixtureFinder.remount());
        assert.equal(await page.locator('.fv-quickfinder').count(), 1);
        await page.keyboard.press('Control+k');
        await page.locator('.fv-quickfinder input').fill('home');
        await page.waitForFunction(() => document.querySelector('.fv-quickfinder-name')?.textContent === 'Home Automation');
        await page.evaluate(() => window.fixtureFinder.deferPrepare());
        await page.locator('[data-finder-action="reveal"]').first().click();
        await page.evaluate(() => { window.fixtureFinder.replace(); window.fixtureFinder.releasePrepare(); });
        await page.waitForFunction(() => document.querySelector('.fv-quickfinder')?.getAttribute('aria-busy') !== 'true');
        assert.equal(await page.evaluate(() => window.fixtureFinder.events.filter(event => event.action === 'expand').length), 0);
        await page.evaluate(() => window.fixtureFinder.dispose());
        assert.equal(await page.locator('.fv-quickfinder').count(), 0);
        await page.keyboard.press('Control+k');
        assert.equal(await page.locator('.fv-quickfinder').count(), 0);
    });

    test('Quick finder renders special names as text and limits the dropdown for large lists', async ({ page }) => {
        await page.goto(`${baseUrl}/fixtures/runtime-quick-finder.html`);
        await page.evaluate(() => { window.fixtureFinder.runtime['<img src=x onerror=alert(1)>'] = {}; window.fixtureFinder.addItems(100); });
        await openAndSearch(page, 'home');
        await page.locator('.fv-quickfinder input').fill('onerror');
        await page.waitForFunction(() => document.querySelector('.fv-quickfinder-name')?.textContent.includes('onerror'));
        assert.equal(await page.locator('.fv-quickfinder-results img').count(), 0);
        await page.locator('.fv-quickfinder input').fill('Search item');
        await page.waitForFunction(() => document.querySelectorAll('.fv-quickfinder-result').length === 40);
        assert.ok((await page.locator('.fv-quickfinder-message').textContent()).includes('100'));
        assert.equal(await page.evaluate(() => localStorage.length), 0);
        await page.locator('[data-finder-filter="folder"]').click();
        assert.equal(await page.locator('[data-finder-action="webui"]').count(), 0);
        await page.keyboard.press('Escape');
    });
};
