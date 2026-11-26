import assert from 'node:assert/strict';
import { closeFilterViewHost as closeHost, createFilterViewSettingsHost, mountFilterViewVmHost } from '../helpers/filter-view-settings-host.mjs';
import { closeVmInfoFolder, mountAndOpenVmInfoFolder, registerVmRuntimeRowRecoveryCases } from './vm-runtime-row-recovery.mjs';
import { registerVmRuntimeRemediationCases } from './vm-runtime-remediation.mjs';

export const registerVmRuntimeRecoveryCases = ({ test }) => {
    test('VM view preferences keep populated ancestors when empty folders are hidden', async ({ page }) => {
        const host = await createFilterViewSettingsHost(page);
        host.folders['fixture-folder-0'].parentId = 'empty';
        host.folders['empty-control'] = { name: 'Unrelated empty folder', parentId: 'empty', containers: [], settings: {}, actions: [] };
        host.prefs('vm').hideEmptyFolders = true;
        try {
            await mountFilterViewVmHost(page, host);
            assert.equal(await page.locator('tr.folder-id-empty').count(), 1);
            assert.equal(await page.locator('tr.folder-id-fixture-folder-0').count(), 1);
            assert.equal(await page.locator('tr.folder-id-empty-control').count(), 0);
        } finally { await closeHost(page, host); }
    }, { skipAccessibility: true });

    test('VM view preferences keep stock info rows with members and settle dynamic detail adoption', async ({ page }) => {
        const host = await createFilterViewSettingsHost(page);
        try {
            const { info, toggle } = await mountAndOpenVmInfoFolder(page, host);
            await page.locator('#fixture-vm-0').getByText('Info').click();
            assert.equal(await info.isVisible(), true);
            assert.equal(await info.evaluate(row => row.previousElementSibling.id), 'fixture-vm-0');
            await closeVmInfoFolder(toggle);
            assert.equal(await info.evaluate(row => row.parentElement.classList.contains('folder-storage')), true);

            await page.evaluate(() => {
                const prototype = Element.prototype;
                const after = prototype.after;
                window.fixtureDetailMoves = 0;
                prototype.after = function (...nodes) {
                    if (nodes.some(node => node?.id === 'name-1')) {
                        window.fixtureDetailMoves++;
                        if (window.fixtureDetailMoves > 6) return;
                    }
                    return after.apply(this, nodes);
                };
                const owner = document.getElementById('fixture-vm-1');
                const detail = document.createElement('tr');
                detail.id = 'name-1';
                after.call(owner, detail);
            });
            await page.waitForFunction(() => document.getElementById('name-1')?.dataset.fvplusVmDetailAdopted === '1');
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            assert.equal(await page.evaluate(() => window.fixtureDetailMoves), 0);
            assert.equal(await page.locator('#name-1').evaluate(row => row.previousElementSibling.id), 'fixture-vm-1');
        } finally { await closeHost(page, host); }
    }, { skipAccessibility: true });

    registerVmRuntimeRowRecoveryCases({ test });

    test('VM view preferences keep the mounted group and native hooks through persisted navigation', async ({ page }) => {
        const host = await createFilterViewSettingsHost(page);
        host.prefs('vm').groupUnassignedItems = true;
        host.folders['fixture-folder-0'].containers = [host.names[0]];
        const group = page.locator('#kvm_list > [data-fv-unassigned-group]');
        try {
            await mountFilterViewVmHost(page, host);
            await group.waitFor({ state: 'attached' });
            assert.deepEqual(await page.evaluate(() => {
                const wrapper = window.loadlist;
                window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
                window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
                return {
                    wrapperRetained: window.loadlist === wrapper,
                    groupRetained: !!document.querySelector('#kvm_list > [data-fv-unassigned-group]')
                };
            }), { wrapperRetained: true, groupRetained: true });
            await group.getByRole('button').click();
            assert.equal(await group.getByRole('button').getAttribute('aria-expanded'), 'true');
            await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
            await group.waitFor({ state: 'detached' });
            assert.equal(await page.evaluate(() => window.loadlist === window.loadlist_original), true);
        } finally { await closeHost(page, host); }
    }, { skipAccessibility: true });

    test('VM view preferences keep the latest runtime and token when responses arrive out of order', async ({ page }) => {
        const host = await createFilterViewSettingsHost(page);
        const name = host.names[0];
        const waiting = [];
        const held = [];
        const hold = (mode, state, tag) => {
            const slot = { mode, state, tag, arrived: Promise.withResolvers(), release: Promise.withResolvers() };
            waiting.push(slot);
            held.push(slot);
            return slot;
        };
        await page.route(url => url.pathname.endsWith('/server/runtime_snapshot.php') && url.searchParams.get('type') === 'vm', async route => {
            const mode = new URL(route.request().url()).searchParams.get('mode');
            const index = waiting.findIndex(slot => slot.mode === mode);
            const slot = index < 0 ? null : waiting.splice(index, 1)[0];
            const payload = { ...host.snapshot('vm'), revisions: { folder: 0, prefs: 1 },
                runtime: structuredClone(host.runtime.vm), snapshotToken: (slot?.tag || 'a').repeat(64) };
            if (slot) {
                payload.runtime[name].state = slot.state;
                slot.arrived.resolve();
                await slot.release.promise;
            }
            await route.fulfill({ json: payload });
        });
        const read = () => page.evaluate(name => ({
            state: vmRuntimeInfoByName[name]?.state, token: lastVmRuntimeSnapshotToken,
            nativeState: document.querySelector('#fixture-vm-0')?.getAttribute('data-fv-runtime-state')
        }), name);
        const refresh = () => page.evaluate(() => refreshVmRuntimeStateInPlace({ preserveGroupedDom: true }));
        const arrive = async slot => {
            let timeout;
            const deadline = new Promise((_resolve, reject) => {
                timeout = setTimeout(() => reject(new Error(`Timed out waiting for VM ${slot.mode} snapshot`)), 10000);
            });
            try { await Promise.race([slot.arrived.promise, deadline]); }
            finally { clearTimeout(timeout); }
        };
        try {
            await mountFilterViewVmHost(page, host);
            const oldState = hold('state', 'running', 'b');
            const oldResult = refresh();
            await arrive(oldState);
            const newState = hold('state', 'shutoff', 'c');
            const newResult = refresh();
            await arrive(newState);
            newState.release.resolve();
            assert.equal(await newResult, true);
            oldState.release.resolve();
            assert.equal(await oldResult, false);
            assert.deepEqual(await read(), { state: 'shutoff', token: 'c'.repeat(64), nativeState: 'shutoff' });

            const staleState = hold('state', 'running', 'd');
            const staleResult = refresh();
            await arrive(staleState);
            const staleFull = hold('full', 'running', 'e');
            await page.evaluate(() => {
                window.loadlist();
                window.fixtureOldVmBundle = Promise.all(folderReq.requests);
            });
            await arrive(staleFull);
            const currentFull = hold('full', 'paused', 'f');
            await page.evaluate(() => { window.loadlist(); });
            await arrive(currentFull);
            currentFull.release.resolve();
            await page.waitForFunction(() => lastVmRuntimeSnapshotToken === 'f'.repeat(64)
                && document.querySelector('tr.folder-id-fixture-folder-0 .folder-state')?.textContent.includes('paused'));
            staleFull.release.resolve();
            await page.evaluate(() => window.fixtureOldVmBundle);
            staleState.release.resolve();
            assert.equal(await staleResult, false);
            assert.equal((await read()).token, 'f'.repeat(64));
            assert.equal((await read()).state, 'paused');
            assert.match(await page.locator('tr.folder-id-fixture-folder-0 .folder-state').textContent(), /paused/);
        } finally {
            for (const slot of held) slot.release.resolve();
            await closeHost(page, host);
        }
    }, { skipAccessibility: true });

    registerVmRuntimeRemediationCases({ test });

    test('VM view preferences show the same unknown state in Quick Finder and native rows', async ({ page }) => {
        const host = await createFilterViewSettingsHost(page);
        const name = host.names[0];
        try {
            await mountFilterViewVmHost(page, host);
            host.runtime.vm[name].state = 'unknown';
            assert.equal(await page.evaluate(() => refreshVmRuntimeStateInPlace({ preserveGroupedDom: true })), true);
            assert.equal(await page.locator('#fixture-vm-0').getAttribute('data-fv-runtime-state'), 'unknown');
            assert.match(await page.locator('#fixture-vm-0 .state').innerText(), /paused/i);
            await page.locator('[data-finder-toggle]').click();
            await page.locator('.fv-quickfinder input').fill(name);
            assert.match(await page.locator('.fv-quickfinder-result .fv-quickfinder-status').innerText(), /paused/i);
        } finally { await closeHost(page, host); }
    }, { skipAccessibility: true });
};
