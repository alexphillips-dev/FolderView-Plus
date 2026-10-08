import assert from 'node:assert/strict';
import { createDockerFolderMenuHost } from '../helpers/docker-folder-menu-host.mjs';

export const registerDockerFolderFeedbackCases = ({ test }) => {
    test('Docker folder feedback shows live status details with keyboard touch privacy and viewport safety', async ({ page }) => {
        const host = await createDockerFolderMenuHost(page);
        const counts = page.locator('tr.folder-id-direct span.folder-state');
        const tip = page.locator('#fvplus-docker-folder-status-details');
        try {
            await page.goto(host.url); await page.waitForLoadState('networkidle');
            await counts.focus(); await tip.waitFor();
            assert.match(await tip.innerText(), /Direct members only/i);
            assert.match(await tip.innerText(), /Total: 1 containers/i);
            assert.equal(await tip.locator('.fv-docker-status-detail').count(), 4);
            await page.keyboard.press('Escape'); assert.equal(await tip.count(), 0);
            await counts.press('Enter'); await tip.waitFor();
            assert.equal(await counts.getAttribute('aria-expanded'), 'true');
            assert.notEqual(await page.locator('.dropDown-direct').getAttribute('active'), 'true');
            const bounds = await tip.boundingBox(), size = page.viewportSize();
            assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= size.width);
            assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= size.height);
            await page.keyboard.press('Escape');
            await counts.dispatchEvent('pointerover', { pointerType: 'touch' });
            await counts.click(); await tip.waitFor();
            await counts.click(); assert.equal(await tip.count(), 0);
            await page.locator('tr.folder-id-parent span.folder-state').focus(); await tip.waitFor();
            assert.match(await tip.innerText(), /Includes child folders/i);
            await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
            assert.deepEqual(await page.evaluate(async () => (await window.axe.run(document.getElementById('fvplus-docker-folder-status-details'))).violations), []);
            await page.keyboard.press('Escape');
            await page.evaluate(() => document.body.classList.add('fvplus-privacy-docker-runtime-mask-names'));
            await counts.focus(); await tip.waitFor();
            assert.equal((await tip.innerText()).includes('Direct members\n'), false);
            await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
            assert.equal(await tip.count(), 0);
        } finally { await host.close(); }
    }, { skipAccessibility: true });

    test('Docker folder feedback reports partial failures and guards duplicate actions without blocking the page', async ({ page }) => {
        const host = await createDockerFolderMenuHost(page);
        host.folders.direct.containers = Object.keys(host.runtime);
        host.folders.collision.containers = [];
        host.folders.leaf.regex = '';
        for (const entry of Object.values(host.runtime)) { entry.shortId = entry.id; entry.info.Id = entry.id; }
        let release, requests = 0; const gate = new Promise(resolve => { release = resolve; });
        await page.route('**/include/DockerEvents.php', async route => {
            requests++;
            const data = new URLSearchParams(route.request().postData());
            const entry = Object.values(host.runtime).find(entry => entry.id.startsWith(data.get('container')));
            if (requests === 2) { await gate; return route.fulfill({ json: { success: false, text: '<img src=x onerror=alert(1)>' } }); }
            Object.assign(entry, { running: false, state: 'stopped', State: { Running: false, Paused: false }, info: { ...entry.info, State: { Running: false, Paused: false } } });
            await route.fulfill({ json: { success: true } });
        });
        const notice = page.locator('.fv-docker-operation');
        const indicator = page.locator('tr.folder-id-direct > td.folder-name > .fv-docker-operation-icon');
        const openStop = async () => { await page.locator('#direct').click(); await page.locator('#synthetic-folder-menu').getByText(/^Stop \(/).click(); };
        try {
            await page.emulateMedia({ reducedMotion: 'reduce' });
            await page.goto(host.url); await page.waitForLoadState('networkidle');
            const rowHeight = (await page.locator('tr.folder-id-direct').boundingBox()).height;
            await openStop(); await indicator.waitFor();
            await page.waitForFunction(() => document.querySelector('.fv-docker-operation-icon')?.getAttribute('aria-label').includes('1 of 2 requests completed'));
            assert.equal(await page.locator('#fvplus-docker-folder-feedback').count(), 0); assert.equal(await notice.count(), 0);
            assert.equal((await page.locator('tr.folder-id-direct').boundingBox()).height, rowHeight);
            assert.deepEqual(await indicator.locator('.fv-ui-spinner').evaluate(node => [getComputedStyle(node).borderTopColor, getComputedStyle(node).animationName]), ['rgb(74, 179, 255)', 'none']);
            await page.evaluate(() => { const row = document.querySelector('tr.folder-id-direct'), copy = row.cloneNode(true); copy.querySelector('#direct').replaceWith(row.querySelector('#direct')); row.replaceWith(copy); window.FolderViewPlusDockerFolderFeedback.getApi(window).decorateStatus('direct', {}, {}, false); });
            assert.equal(await indicator.count(), 1); await indicator.press('Enter');
            assert.equal(await notice.locator('progress').getAttribute('value'), '1');
            await notice.getByRole('button', { name: 'Close', exact: true }).click();
            assert.equal(await indicator.evaluate(node => node.isConnected && node === document.activeElement), true); assert.equal(await notice.count(), 0);
            await openStop(); assert.equal(requests, 2);
            await page.evaluate(() => document.body.classList.add('fvplus-privacy-docker-runtime-mask-names'));
            release();
            await page.waitForFunction(() => document.querySelector('.fv-docker-operation-icon')?.dataset.state === 'warning');
            await indicator.click();
            assert.match(await notice.innerText(), /1 confirmed · 1 failed/);
            await notice.locator('summary').click();
            assert.match(await notice.innerText(), /The container action was rejected/);
            await page.evaluate(() => window.FolderViewPlusDockerFolderFeedback.getApi(window).decorateStatus('direct', {}, {}, false)); assert.equal(await notice.locator('details').getAttribute('open'), '');
            assert.equal(await notice.locator('img').count(), 0);
            assert.equal(await notice.locator('.fv-docker-feedback-name').last().evaluate(node => getComputedStyle(node).filter), 'blur(5px)');
            await page.evaluate(() => document.body.classList.remove('fvplus-privacy-docker-runtime-mask-names'));
            assert.equal(await notice.locator('.fv-docker-feedback-name').last().evaluate(node => getComputedStyle(node).filter), 'none');
            await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
            assert.deepEqual(await page.evaluate(async () => (await window.axe.run(document.getElementById('fvplus-docker-folder-operation-details'))).violations), []);
            await notice.getByRole('button', { name: 'Dismiss', exact: true }).click(); assert.equal(await notice.count(), 0);
            await openStop(); await page.waitForFunction(() => !document.querySelector('.fv-docker-operation-icon'));
            assert.equal(requests, 3);
            await page.evaluate(async () => {
                await window.FolderViewPlusDockerFolderFeedback.getApi(window).run({ id: 'direct', name: 'Synthetic waiting state', action: 'start',
                    entries: { synthetic: { id: 'synthetic-waiting', state: false } }, request: async () => ({ success: true }),
                    refresh: async () => {}, read: () => ({ synthetic: { state: false } }) });
            });
            assert.match(await indicator.getAttribute('aria-label'), /waiting for runtime status/);
            assert.equal(await indicator.getAttribute('data-state'), 'pending'); await indicator.click();
            await page.evaluate(() => window.FolderViewPlusDockerFolderFeedback.getApi(window).decorateStatus('direct', {}, { synthetic: { state: true, pause: false } }, false));
            assert.equal(await indicator.count(), 0); assert.equal(await notice.count(), 0);
        } finally { release(); await host.close(); }
    }, { skipAccessibility: true });
};
