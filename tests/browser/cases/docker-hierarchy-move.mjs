import assert from 'node:assert/strict';
import { createDockerHierarchyMoveHost } from '../helpers/docker-hierarchy-move-host.mjs';

export const registerDockerHierarchyMoveCases = ({ test }) => {
    test('Docker Move to root updates hierarchy immediately and restores it on save failure', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const host = await createDockerHierarchyMoveHost(page);
        const row = id => page.locator(`tr.folder-id-${id}`);
        const { settle, expand, move } = host;
        try {
            await page.goto(host.url, { waitUntil: 'load' });
            await settle();
            await expand('parent');
            await row('branch').waitFor({ state: 'visible' });
            await expand('branch');
            await row('leaf').waitFor({ state: 'visible' });
            const beforeFailure = structuredClone({ parent: host.folders.branch.parentId,
                sortMode: host.prefs().sortMode, manualOrder: host.prefs().manualOrder || [] });
            host.failUpdates(true);
            await move(false);
            await page.waitForFunction(() => document.querySelector('tr.folder-id-branch')?.getAttribute('data-folder-parent') === '');
            assert.equal(await row('branch').getAttribute('data-folder-depth'), '0');
            assert.equal(await row('branch').evaluate(node => node.classList.contains('fv-folder-is-child')), false);
            assert.equal(await row('leaf').isVisible(), true, 'moving an expanded subtree preserves its expansion');
            host.releaseFailure();
            await settle();
            await page.waitForFunction(() => document.querySelector('tr.folder-id-branch')?.getAttribute('data-folder-parent') === 'parent');
            assert.deepEqual({ parent: host.folders.branch.parentId, sortMode: host.prefs().sortMode,
                manualOrder: host.prefs().manualOrder || [] }, beforeFailure, 'a rejected batch changes neither parent nor order');
            await page.reload({ waitUntil: 'load' }); await settle();
            assert.equal(await row('branch').getAttribute('data-folder-parent'), 'parent', 'reloading reads the original parent');
            assert.equal(await row('branch').getAttribute('data-folder-depth'), '1');
            assert.equal(await row('leaf').isVisible(), true, 'rollback restores the expanded subtree');
            await expand('parent');
            assert.equal(await row('branch').isVisible(), false, 'rollback restores parent collapse behavior');
            await expand('parent');
            host.failUpdates(false);
            await move();
            await page.waitForFunction(() => document.querySelector('tr.folder-id-branch')?.getAttribute('data-folder-parent') === '');
            await settle();
            assert.equal(host.folders.branch.parentId, '');
            assert.equal(host.prefs().sortMode, 'manual');
            assert.equal(host.prefs().manualOrder.length, host.all.length);
            assert.deepEqual(host.folders.branch.containers, [], 'automatic descendants are not materialized into manual membership');
            assert.equal(await row('branch').getAttribute('data-folder-depth'), '0');
            assert.equal(await row('branch').isVisible(), true);
            assert.equal(await row('parent').locator('.folder-preview .outer').count(), 0, 'the old parent no longer previews moved descendants');
            assert.match(await row('parent').locator('.folder-state').textContent(), /0\/0/);
            await expand('parent');
            assert.equal(await row('branch').isVisible(), true, 'collapsing the old parent cannot hide the moved root');
            await expand('branch');
            await row('leaf').waitFor({ state: 'visible' });
            assert.equal(await row('leaf').getAttribute('data-folder-depth'), '1');
            assert.equal(await page.locator('#docker_containers tr[id^="ct-"]').count(), host.memberCount);
            await page.reload({ waitUntil: 'load' });
            await settle();
            assert.equal(await row('branch').getAttribute('data-folder-parent'), '');
            assert.equal(await row('branch').isVisible(), true);
            host.folders.branch.parentId = 'parent';
            host.prefs().hideEmptyFolders = true;
            await page.reload({ waitUntil: 'load' });
            await settle();
            if (await page.locator('.dropDown-parent').getAttribute('active') !== 'true') await expand('parent');
            await row('branch').waitFor({ state: 'visible' });
            await move();
            await settle();
            assert.equal(await row('branch').isVisible(), true, 'Hide Empty Folders preserves the moved populated root');
            assert.equal(await row('parent').isVisible(), false, 'the former parent becomes hidden when its last populated child leaves');
            assert.ok(host.updateCount() >= 2);
        } finally {
            host.releaseFailure();
            await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
            await page.waitForLoadState('networkidle');
            await page.goto('about:blank');
            await page.unrouteAll({ behavior: 'wait' });
            await host.close();
        }
    }, { skipAccessibility: true, allowedConsoleErrors: [ // Synthetic menu and an explicitly injected revision conflict.
        /^console: Failed to load resource:.*409 \(Conflict\)$/,
        /^console: folderview\.plus: safe ui action failed \(docker-folder-menu-hierarchy:branch:root\).*\/server\/batch\.php.*Synthetic revision conflict/s
    ] });
};
