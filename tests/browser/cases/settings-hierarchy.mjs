import assert from 'node:assert/strict';
import { createHideEmptySettingsHost } from '../helpers/settings-hide-empty-host.mjs';

export const registerSettingsHierarchyCases = ({ test }) => {
    for (const type of ['docker', 'vm']) test(`${type} Basic hierarchy cards connect visible branches at every depth`, async ({ page }) => {
        const folder = (name, parentId = '') => ({ name, parentId, containers: [], settings: {}, actions: [], icon: '/plugins/folderview.plus/images/folder-icon.png' });
        const folders = { parent: folder('Media'), child: folder('Library', 'parent'), leaf: folder('Books', 'child'), sibling: folder('Downloads', 'parent'), other: folder('Monitoring') };
        for (let depth = 3; depth <= 8; depth++) folders[`deep${depth}`] = folder(`Level ${depth}`, depth === 3 ? 'leaf' : `deep${depth - 1}`);
        const host = await createHideEmptySettingsHost(page, type, { folders, prefs: { hideEmptyFolders: false, sortMode: 'manual' } });
        const tbody = type === 'vm' ? 'vms' : 'docker';
        const row = id => page.locator(`tbody#${tbody} > tr[data-folder-id="${id}"]`);
        try {
            host.releaseRuntime();
            await page.goto(host.url, { waitUntil: 'domcontentloaded' });
            await page.evaluate(async () => { await window.FolderViewPlusSettingsRuntimeHydrationPromise; });
            await row('deep8').waitFor({ state: 'attached' });
            assert.equal(await row('deep8').locator('.fv-hierarchy-lane').count(), 8, 'guide depth is not capped by the legacy indentation classes');
            assert.equal(await row('leaf').locator('.fv-hierarchy-lane.is-connected:not(.is-branch)').count(), 1, 'ancestor trunk continues through an earlier child subtree');
            assert.equal(await row('sibling').locator('.fv-hierarchy-lane.is-last.is-branch').count(), 1);
            assert.equal(await row('other').locator('.fv-hierarchy-lane').count(), 0, 'separate roots do not share a trunk');
            await row('child').locator('.folder-tree-toggle').click();
            await row('leaf').waitFor({ state: 'detached' });
            assert.equal(await row('leaf').count(), 0);
            assert.equal(await row('child').locator('.folder-tree-toggle').getAttribute('aria-expanded'), 'false');
            await row('child').locator('.folder-tree-toggle').focus();
            await page.keyboard.press('Enter');
            await row('deep8').waitFor({ state: 'attached' });
            await page.locator(`#${type}-folder-filter`).fill('Downloads');
            await page.waitForFunction(tbody => document.querySelectorAll(`tbody#${tbody} > tr[data-folder-id]`).length === 2, tbody);
            assert.equal(await row('sibling').locator('.fv-hierarchy-lane.is-last').count(), 1, 'filtering terminates the visible branch');
            await page.locator(`#${type}-folder-filter`).fill('');
            await row('deep8').waitFor({ state: 'attached' });
            for (const width of [1600, 900, 390]) {
                await page.setViewportSize({ width, height: 900 });
                await page.emulateMedia({ reducedMotion: 'reduce' });
                await page.locator('#fv-settings-root').evaluate((root, width) => { root.dir = width === 900 ? 'rtl' : 'ltr'; }, width);
                const layout = await row('child').evaluate(row => {
                    const name = row.querySelector('.name-cell-content');
                    const box = name.getBoundingClientRect();
                    const control = row.querySelector('.folder-tree-toggle').getBoundingClientRect();
                    return { display: getComputedStyle(row).display, nameInside: [...name.children].filter(child => getComputedStyle(child).display !== 'none').every(child => child.getBoundingClientRect().right <= box.right + 1 && child.getBoundingClientRect().left >= box.left - 1),
                        controlWidth: control.width, pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
                        guideHeight: row.querySelector('.fv-hierarchy-guides').getBoundingClientRect().height, height: row.getBoundingClientRect().height };
                });
                assert.equal(layout.display, 'grid'); assert.equal(layout.nameInside, true, `${width}px: ${JSON.stringify(layout)}`);
                assert.ok(layout.controlWidth >= 44); assert.equal(layout.pageOverflow, false);
                assert.ok(layout.guideHeight >= layout.height, 'guide spans the row and preceding card gap');
            }
            await page.setViewportSize({ width: 1600, height: 900 });
            await row('parent').locator('.folder-tree-toggle').click();
            await row('child').waitFor({ state: 'detached' });
            await page.reload({ waitUntil: 'domcontentloaded' });
            await page.evaluate(async () => { await window.FolderViewPlusSettingsRuntimeHydrationPromise; });
            assert.equal(await row('child').count(), 0, 'collapse survives reload');
            await page.locator('[data-mode="advanced"]').click();
            assert.equal(await row('parent').evaluate(row => getComputedStyle(row).display), 'table-row', 'Advanced keeps its table layout');
        } finally { await host.close(); }
    }, { skipAccessibility: true }); // Synthetic Unraid host; controls and geometry are checked directly.
    for (const type of ['docker', 'vm']) test(`${type} Basic hierarchy preserves drag nesting and move to root`, async ({ page }) => {
        await page.setViewportSize({ width: 1600, height: 900 });
        const folder = name => ({ name, containers: ['fixture-direct'], settings: {}, actions: [], icon: '/plugins/folderview.plus/images/folder-icon.png' });
        const folders = { parent: folder('Media'), other: folder('Downloads') };
        const host = await createHideEmptySettingsHost(page, type, { folders, prefs: { hideEmptyFolders: false, sortMode: 'manual' } });
        let mutations = 0;
        await page.route('**/server/batch.php', async route => {
            const payload = new URLSearchParams(route.request().postData());
            assert.equal(Number(payload.get('expectedRevision')), host.prefs()._metadata.folderRevision);
            const operations = JSON.parse(payload.get('operations'));
            for (const entry of operations.upserts) folders[entry.id] = entry.folder;
            host.prefs()._metadata.folderRevision++;
            mutations++;
            await route.fulfill({ json: { ok: true, result: { metadata: host.prefs()._metadata } } });
        });
        const tbody = type === 'vm' ? 'vms' : 'docker';
        const row = id => page.locator(`tbody#${tbody} > tr[data-folder-id="${id}"]`);
        try {
            host.releaseRuntime(); await page.goto(host.url, { waitUntil: 'domcontentloaded' });
            await page.evaluate(async () => { await window.FolderViewPlusSettingsRuntimeHydrationPromise; });
            await Promise.all([page.waitForResponse(response => response.url().includes('/server/batch.php')), row('other').locator('.folder-drag-handle').dragTo(row('parent'))]);
            await page.waitForFunction(tbody => document.querySelector(`tbody#${tbody} tr[data-folder-id="other"]`)?.dataset.folderParent === 'parent', tbody);
            assert.equal(await row('other').locator('.fv-hierarchy-lane.is-branch').count(), 1);
            await Promise.all([page.waitForResponse(response => response.url().includes('/server/batch.php')), row('other').locator('[title="Move to root"]').click()]);
            await page.waitForFunction(tbody => document.querySelector(`tbody#${tbody} tr[data-folder-id="other"]`)?.dataset.folderParent === '', tbody);
            assert.equal(await row('other').locator('.fv-hierarchy-lane').count(), 0);
            assert.equal(mutations, 2); assert.equal(folders.other.parentId, '');
            assert.deepEqual(folders.other.containers, ['fixture-direct'], 'tree moves preserve member assignments');
            await page.setViewportSize({ width: 390, height: 900 });
            assert.equal(await row('other').locator('.folder-overflow-btn').isVisible(), true, 'touch actions remain available');
        } finally { await host.close(); }
    }, { skipAccessibility: true });
};
