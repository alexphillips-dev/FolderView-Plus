import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createDockerHideEmptyHost } from '../helpers/docker-hide-empty-host.mjs';

export const registerDockerUnassignedCases = ({ test }) => {
    test('Docker Unassigned group follows verified ownership, filters, and native order', async ({ page }) => {
        const host = await createDockerHideEmptyHost(page, true);
        const [assigned, loose] = Object.keys(host.runtime);
        delete host.folders.direct;
        const header = page.locator('#docker_list > [data-fv-unassigned-group]');
        const button = header.getByRole('button', { name: /Unassigned items/ });
        const member = name => page.locator(`#docker_list > tr[data-fv-unassigned-item] .appname`).filter({ hasText: name });
        const filter = page.locator('[data-fvplus-docker-action="filter-unassigned"]');
        const count = filter.locator('.fvplus-docker-action-count');
        const enabled = () => header.waitFor({ state: 'attached' });
        const clear = () => header.waitFor({ state: 'detached' });
        const source = fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js', 'utf8');
        const end = '})(window, window.jQuery || window.$);';
        assert.equal(source.split(end).length, 2);
        await page.route('**/scripts/docker.js*', route => route.fulfill({ contentType: 'text/javascript', body: source.replace(end, `
            window.fixtureDockerUnassigned = {
                collectOrder: () => dockerRuntimeActionBarApi.collectNativeOrder().map(entry => entry.name),
                setEnabled: enabled => dockerPrefsCoordinator.save('docker', { groupUnassignedItems: enabled }, { immediate: true }),
                setMode: mode => dockerPrefsCoordinator.save('docker', { pageViewMode: mode }, { immediate: true })
            };
            ${end}`) }));
        await page.addInitScript(() => {
            window.LockButton = () => {
                const $list = window.jQuery('#docker_list');
                if ($list.data('sortable')) {
                    $list.removeData('sortable');
                } else {
                    window.fixtureNativeSortHeaderCount = $list.children('[data-fv-unassigned-group]').length;
                    window.fixtureNativeSortOrderedNames = $list.find('td.ct-name .appname').toArray().map(node => node.textContent.trim());
                    $list.data('sortable', true);
                }
            };
        });
        const readOrder = () => page.evaluate(() => window.fixtureDockerUnassigned.collectOrder());
        try {
            await page.goto(host.url, { waitUntil: 'load' });
            await page.locator('#docker_list tr.folder-id-leaf').waitFor({ state: 'attached' });
            assert.equal(await header.count(), 0, 'older configurations default to standalone rows');
            const nativeOrder = await readOrder();
            assert.ok(nativeOrder.includes(loose) && nativeOrder.includes(assigned));
            await page.evaluate(() => window.fixtureDockerUnassigned.setEnabled(true));
            await enabled();
            assert.equal(await button.getAttribute('aria-expanded'), 'false');
            assert.equal(await member(loose).isVisible(), false);
            assert.equal(await member(assigned).count(), 0, 'the owner in a nested folder excludes the matching member');
            assert.equal(await count.textContent(), '1');
            assert.deepEqual(await readOrder(), nativeOrder);

            await filter.click();
            assert.equal(await member(loose).isVisible(), true);
            assert.equal(await page.locator('#docker_list tr.folder-id-parent').isVisible(), false);
            await filter.click();
            await page.locator('[data-fvplus-docker-action="collapse-all"]').click();
            assert.equal(await button.getAttribute('aria-expanded'), 'false');
            await page.locator('[data-finder-toggle]').click();
            await page.locator('.fv-quickfinder input').fill(loose);
            await page.locator('.fv-quickfinder-result [data-finder-icon]').click();
            await member(loose).waitFor();
            assert.equal(await button.getAttribute('aria-expanded'), 'true');
            await button.click();
            await button.focus();
            await page.keyboard.press('Space');
            assert.equal(await member(loose).isVisible(), true);
            await page.evaluate(() => window.LockButton());
            await clear();
            assert.equal(await page.evaluate(() => window.fixtureNativeSortHeaderCount), 0);
            assert.deepEqual(await page.evaluate(() => window.fixtureNativeSortOrderedNames), nativeOrder);
            await page.evaluate(() => window.LockButton());
            await enabled();
            assert.equal(await button.getAttribute('aria-expanded'), 'true');

            host.folders.leaf.regex = '^fixture-app-';
            await page.evaluate(() => window.loadlist());
            await clear();
            await page.waitForFunction(() => document.querySelector('[data-fvplus-docker-action="filter-unassigned"] .fvplus-docker-action-count')?.textContent === '0');
            host.folders.leaf.regex = '^fixture-app-0$';
            await page.evaluate(() => window.loadlist());
            await enabled();
            await page.evaluate(() => window.fixtureDockerUnassigned.setMode('host'));
            await clear();
            await page.evaluate(() => window.fixtureDockerUnassigned.setMode('folderview'));
            await enabled();
            await page.reload({ waitUntil: 'load' });
            await enabled();
            assert.deepEqual(await page.evaluate(() => {
                const wrapper = window.loadlist;
                window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
                window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
                return {
                    wrapperRetained: window.loadlist === wrapper,
                    groupRetained: !!document.querySelector('#docker_list > [data-fv-unassigned-group]')
                };
            }), { wrapperRetained: true, groupRetained: true });
            await page.evaluate(() => window.fixtureDockerUnassigned.setEnabled(false));
            await clear();
            assert.equal(await page.locator('#docker_list > tr[data-fv-unassigned-item]').count(), 0);
        } finally {
            await host.close();
        }
    }, { skipAccessibility: true });
};
