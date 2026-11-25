import assert from 'node:assert/strict';
import { createDockerHideEmptyHost } from '../helpers/docker-hide-empty-host.mjs';

export const registerDockerRowPlacementCases = ({ test }) => {
    test('Docker row placement preserves a native name that collides with a folder slot', async ({ page }) => {
        const name = 'folder-parent';
        const savedOrder = ['folder-direct', 'fixture-app-3', name, 'fixture-app-2', 'fixture-app-0', 'fixture-app-1'];
        const host = await createDockerHideEmptyHost(page, true, { members: 5, order: savedOrder });
        host.runtime[name] = { ...host.runtime['fixture-app-4'], name, Name: name,
            info: { ...host.runtime['fixture-app-4'].info, Name: '/' + name } };
        delete host.runtime['fixture-app-4'];
        for (const id of ['collision', 'stale', 'empty', 'emptyChild']) delete host.folders[id];
        Object.assign(host.prefs(), { sortMode: 'alpha', dockerRowPlacement: 'saved-order' });
        await page.route('**/docker', async route => {
            const response = await route.fetch();
            await route.fulfill({ response, body: (await response.text()).replaceAll('fixture-app-4', name) });
        });
        try {
            const expectOrder = () => page.waitForFunction(() => {
                const rows = [...document.querySelectorAll('#docker_list > tr')]
                    .filter(row => !row.dataset.folderParent && !row.classList.contains('folder-element'));
                const names = rows.map(row => row.dataset.fvFolderId ? 'folder:' + row.dataset.fvFolderId : row.dataset.name).filter(Boolean);
                return names.join(',') === 'folder:parent,folder:direct,fixture-app-3,folder-parent,fixture-app-2';
            });
            await page.goto(host.url, { waitUntil: 'load' });
            await expectOrder();
            const refresh = page.waitForResponse(url => url.url().includes('/server/runtime_snapshot.php'));
            await page.evaluate(() => window.loadlist());
            await refresh;
            await expectOrder();
        } finally {
            await page.close();
            await host.close();
        }
    }, { skipAccessibility: true });

    test('Docker row placement reconciles managed startup after native sorting is reset', async ({ page }) => {
        const host = await createDockerHideEmptyHost(page, true);
        const endpoint = '/plugins/dynamix.docker.manager/include/UserPrefs.php';
        let syncs = 0;
        await page.route('**' + endpoint, route => route.fulfill({ status: 200, body: '' }));
        await page.route('**/server/sync_order.php', route => {
            syncs++;
            return route.fulfill({ json: { ok: true, syncOutcome: 'synced' } });
        });
        try {
            await page.goto(host.url, { waitUntil: 'load' });
            await page.locator('tr.folder-id-parent').waitFor();
            const reset = () => page.evaluate(endpoint => new Promise(resolve => {
                window.jQuery.post(endpoint, { reset: true }).always(() => resolve());
            }), endpoint);
            await Promise.all([page.waitForResponse('**/server/sync_order.php'), reset()]);
            assert.equal(syncs, 1);
            await page.clock.install();
            await page.evaluate(url => window.jQuery(document).trigger('ajaxComplete', [
                { status: 403 }, { url, data: 'reset=true' }
            ]), endpoint);
            await page.clock.runFor(350);
            assert.equal(syncs, 1, 'a rejected Unraid write must not sync startup order');
        } finally {
            await page.close();
            await host.close();
        }
    }, { skipAccessibility: true });

    test('Docker row placement restores saved mixed slots after refresh without saving native order', async ({ page }) => {
        const savedOrder = ['fixture-app-4', 'folder-parent', 'fixture-app-0', 'folder-branch', 'folder-leaf',
            'fixture-app-3', 'folder-empty', 'folder-emptyChild', 'folder-direct', 'fixture-app-1', 'fixture-app-2'];
        const host = await createDockerHideEmptyHost(page, true, { members: 6, order: savedOrder });
        delete host.folders.collision;
        delete host.folders.stale;
        host.prefs().sortMode = 'created';
        const nativeWrites = [];
        page.on('request', request => {
            if (request.method() === 'POST' && /\/(UserPrefs|sync_order|docker_start_order)\.php\b/.test(request.url())) nativeWrites.push(request.url());
        });
        const expectOrder = expected => page.waitForFunction(expected => {
            const rows = [...document.querySelectorAll('#docker_list > tr')];
            const actual = rows.flatMap(row => {
                if (row.dataset.fvFolderId) return row.dataset.folderParent ? [] : ['folder-' + row.dataset.fvFolderId];
                return row.classList.contains('folder-element') || !row.dataset.name ? [] : [row.dataset.name];
            });
            return JSON.stringify(actual) === JSON.stringify(expected);
        }, expected);
        const setPlacement = value => page.evaluate(value => window.FolderViewPlusPrefsStore.getDefaultCoordinator()
            .save('docker', { dockerRowPlacement: value }, { immediate: true }), value);
        let releasePlacement;
        const allowPlacementSave = new Promise(resolve => { releasePlacement = resolve; });
        const savesPlacement = request => request.method() === 'POST' && request.url().includes('/server/prefs.php')
            && JSON.parse(new URLSearchParams(request.postData()).get('prefs') || '{}').dockerRowPlacement === 'saved-order';
        await page.route('**/server/prefs.php**', async route => {
            if (savesPlacement(route.request())) await allowPlacementSave;
            await route.fallback();
        });
        const mixed = ['fixture-app-4', 'folder-parent', 'fixture-app-3', 'folder-direct', 'fixture-app-2', 'fixture-app-5'];
        const foldersFirst = ['folder-parent', 'folder-direct', 'fixture-app-4', 'fixture-app-3', 'fixture-app-2', 'fixture-app-5'];
        try {
            await page.goto(host.url, { waitUntil: 'load' });
            await expectOrder(foldersFirst);
            const requested = page.waitForRequest(savesPlacement);
            const saving = setPlacement('saved-order');
            try {
                await requested;
                await page.evaluate(() => window.loadlist());
                await expectOrder(foldersFirst);
            } finally {
                releasePlacement();
            }
            await saving;
            await expectOrder(mixed);
            assert.equal(host.prefs().dockerRowPlacement, 'saved-order');
            await page.reload({ waitUntil: 'load' });
            await expectOrder(mixed);
            await page.locator('.dropDown-parent').click();
            await page.locator('tr.folder-id-branch').waitFor({ state: 'visible' });
            await expectOrder(mixed);
            await setPlacement('folders-first');
            await expectOrder(foldersFirst);
            assert.equal(await page.locator('#docker_list > tr[data-fv-folder-id="empty"]').count(), 0);
            assert.deepEqual(nativeWrites, []);
        } finally {
            releasePlacement();
            if (await page.locator('#docker_list').count()) {
                await page.waitForFunction(() => sessionStorage.getItem('fvplus.runtime.expand.docker.v1.pending') === null);
                await page.evaluate(() => window.FolderViewPlusPrefsStore.getDefaultCoordinator().flush('docker'));
            }
            await page.close();
            await host.close();
        }
    }, { skipAccessibility: true });
};
