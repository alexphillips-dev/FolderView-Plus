import assert from 'node:assert/strict';
import { createDockerHideEmptyHost } from '../helpers/docker-hide-empty-host.mjs';

const waitForLocalization = page => page.evaluate(async () => {
    await window.FolderViewPlusI18n.ready;
});

export const exerciseRejectedDockerOrderWrites = async (page, endpoint) => {
    await page.clock.install();
    await page.evaluate(url => {
        const complete = (status, type, address) => window.jQuery(document).trigger('ajaxComplete', [
            { status }, { url: address, type, data: 'reset=true' }
        ]);
        complete(403, 'POST', url);
        complete(200, 'GET', url);
        complete(200, 'POST', 'https://foreign.invalid' + url);
    }, endpoint);
    await page.clock.runFor(350);
};

export const registerDockerRowPlacementLifecycleCases = ({ test }) => {
    test('Docker row placement synchronizes an acknowledged native reset even when navigating immediately', async ({ page }) => {
        const endpoint = '/plugins/dynamix.docker.manager/include/UserPrefs.php';
        let sequence = ['first', 'second'];
        const payloads = [];
        const submitted = Promise.withResolvers();
        const host = await createDockerHideEmptyHost(page, true, { syncOrder: payload => {
            payloads.push(payload);
            sequence = ['first', 'second'];
            submitted.resolve();
            return { ok: true, syncOutcome: 'synced' };
        } });
        await page.route('**' + endpoint, async route => {
            sequence = ['second', 'first'];
            await route.fulfill({ status: 200, body: '' });
        });
        try {
            const nonce = page.waitForResponse(response => response.url().endsWith('/server/security.php')
                && response.request().postData()?.includes('endpoint=sync_order.php'));
            await page.goto(host.url, { waitUntil: 'load' });
            await Promise.all([nonce, page.locator('tr.folder-id-parent').waitFor(), waitForLocalization(page)]);
            const navigation = page.waitForURL('about:blank');
            await page.evaluate(url => {
                window.jQuery(document).ajaxComplete((_event, xhr, settings) => {
                    if (settings.url === url && xhr.status === 200) window.location.assign('about:blank');
                });
                window.jQuery.post(url, { reset: true });
            }, endpoint);
            await navigation;
            await Promise.race([
                submitted.promise,
                page.waitForTimeout(2000).then(() => { throw new Error('No startup synchronization reached the fixture server'); })
            ]);
            assert.deepEqual(sequence, ['first', 'second']);
            assert.equal(payloads.length, 1);
            assert.equal(payloads[0].get('type'), 'docker');
            assert.match(payloads[0].get('_fv_nonce'), /^[a-f0-9]{64}$/);
            assert.ok(payloads[0].has('csrf_token'));
        } finally {
            await page.close();
            await host.close();
        }
    }, { skipAccessibility: true });

    test('Docker row placement retains an unsuccessful native-order sync across reload and clears it after confirmation', async ({ page }) => {
        const host = await createDockerHideEmptyHost(page, true);
        const endpoint = '/plugins/dynamix.docker.manager/include/UpdateConfig.php';
        const storageKey = 'fvplus.docker-order-sync.pending';
        let syncs = 0;
        await page.route('**' + endpoint, route => route.fulfill({ status: 200, body: '' }));
        await page.route('**/server/sync_order.php', route => route.fulfill({
            json: { ok: true, syncOutcome: ++syncs === 1 ? 'failed' : 'synced' }
        }));
        try {
            await page.goto(host.url, { waitUntil: 'load' });
            await page.locator('tr.folder-id-parent').waitFor();
            const initial = page.waitForResponse('**/server/sync_order.php');
            await page.evaluate(url => { window.jQuery.post(url, { action: 'autostart' }); }, endpoint);
            await initial;
            assert.equal(await page.evaluate(key => Boolean(localStorage.getItem(key)), storageKey), true);
            await waitForLocalization(page);
            await page.reload({ waitUntil: 'load' });
            await page.waitForFunction(key => !localStorage.getItem(key), storageKey);
            await waitForLocalization(page);
            assert.ok(syncs >= 2);
        } finally {
            await page.close();
            await host.close();
        }
    }, { skipAccessibility: true });

    test('Docker row placement retries after navigation before an expired keepalive can be renewed', async ({ page }) => {
        const endpoint = '/plugins/dynamix.docker.manager/include/UserPrefs.php';
        const storageKey = 'fvplus.docker-order-sync.pending';
        const heldNonce = Promise.withResolvers();
        const requestedRenewal = Promise.withResolvers();
        let blockNonce = false;
        let syncs = 0;
        const host = await createDockerHideEmptyHost(page, true, { syncOrder: () => {
            syncs++;
            return { ok: true, syncOutcome: 'synced' };
        } });
        await page.route('**/server/security.php', async route => {
            if (!blockNonce || !route.request().postData()?.includes('endpoint=sync_order.php')) return route.fallback();
            requestedRenewal.resolve();
            await heldNonce.promise;
            await route.abort().catch(() => {});
        });
        await page.route('**/fixture-return', route => route.fulfill({ contentType: 'text/html', body: 'Native destination' }));
        await page.route('**' + endpoint, async route => {
            await requestedRenewal.promise;
            await route.fulfill({ status: 200, body: '' });
        });
        try {
            const initialNonce = page.waitForResponse(response => response.url().endsWith('/server/security.php')
                && response.request().postData()?.includes('endpoint=sync_order.php'));
            await page.goto(host.url, { waitUntil: 'load' });
            await Promise.all([initialNonce, page.locator('tr.folder-id-parent').waitFor(), waitForLocalization(page)]);
            blockNonce = true;
            const navigation = page.waitForURL('**/fixture-return');
            await page.evaluate(url => {
                const now = Date.now.bind(Date);
                Date.now = () => now() + 120000;
                window.jQuery(document).ajaxComplete((_event, xhr, settings) => {
                    if (settings.url === url && xhr.status === 200) window.location.assign('/fixture-return');
                });
                window.jQuery.post(url, { reset: true });
            }, endpoint);
            await navigation;
            assert.equal(syncs, 0);
            assert.equal(await page.evaluate(key => Boolean(localStorage.getItem(key)), storageKey), true);
            blockNonce = false;
            heldNonce.resolve();
            await page.goto(host.url, { waitUntil: 'load' });
            await page.waitForFunction(key => !localStorage.getItem(key), storageKey);
            await waitForLocalization(page);
            assert.equal(syncs, 1);
        } finally {
            requestedRenewal.resolve();
            heldNonce.resolve();
            await page.close();
            await host.close();
        }
    }, { skipAccessibility: true });

    test('Docker row placement names the keyboard expansion button and keeps its state current', async ({ page }) => {
        const host = await createDockerHideEmptyHost(page, true);
        try {
            await page.goto(host.url, { waitUntil: 'load' });
            const toggle = page.getByRole('button', { name: 'A populated branch' });
            await toggle.waitFor();
            assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
            await toggle.focus();
            await page.keyboard.press('Enter');
            assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
            await toggle.click();
            assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
        } finally {
            await page.close();
            await host.close();
        }
    }, { skipAccessibility: true });
};
