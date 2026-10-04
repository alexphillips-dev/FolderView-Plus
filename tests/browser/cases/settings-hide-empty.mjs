import assert from 'node:assert/strict';
import { createHideEmptySettingsHost } from '../helpers/settings-hide-empty-host.mjs';

export const registerSettingsHideEmptyCases = ({ test }) => {
    for (const type of ['docker', 'vm']) {
        test(`${type} Manage Folders keeps populated ancestors when hiding empty folders`, async ({ page }) => {
            const host = await createHideEmptySettingsHost(page, type);
            const tbody = type === 'vm' ? 'vms' : 'docker';
            const rows = page.locator(`tbody#${tbody} > tr[data-folder-id]`);
            const row = id => page.locator(`tbody#${tbody} > tr[data-folder-id="${id}"]`);
            const expectRows = async expected => {
                await page.waitForFunction(({ tbody, expected }) => {
                    const ids = [...document.querySelectorAll(`tbody#${tbody} > tr[data-folder-id]`)].map(node => node.dataset.folderId).sort();
                    return JSON.stringify(ids) === JSON.stringify(expected.slice().sort());
                }, { tbody, expected });
                assert.deepEqual((await rows.evaluateAll(nodes => nodes.map(node => node.dataset.folderId))).sort(), expected.slice().sort());
            };
            const populated = ['parent', 'child', 'leaf', 'regex', 'direct'];
            const all = [...populated, 'empty', 'emptyChild'];
            const setHideEmpty = enabled => Promise.all([
                page.waitForResponse(response => response.url().includes('/server/prefs.php') && response.request().method() === 'POST'),
                page.locator(`#${type}-hide-empty-folders`).evaluate((input, enabled) => {
                    input.checked = enabled;
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }, enabled)
            ]);
            try {
                await page.goto(host.url, { waitUntil: 'domcontentloaded' });
                await expectRows(all);
                assert.equal(host.prefs().hideEmptyFolders, true, 'config-first rendering must preserve folders before runtime resolves regex members');
                host.releaseRuntime();
                await page.evaluate(async () => { await window.FolderViewPlusSettingsRuntimeHydrationPromise; });
                await expectRows(populated);
                assert.match(await row('parent').textContent(), /0\s*\/\s*2/, 'parent count includes manual and regex descendant membership');
                assert.equal(await row('child').getAttribute('data-folder-parent'), 'parent');
                assert.equal(await row('leaf').getAttribute('data-folder-parent'), 'child');
                await setHideEmpty(false);
                await expectRows(all);
                assert.equal(host.prefs().hideEmptyFolders, false, 'setting change reaches the preference write boundary');
                await setHideEmpty(true);
                await expectRows(populated);
                assert.equal(host.prefs().hideEmptyFolders, true);
                await page.reload({ waitUntil: 'domcontentloaded' });
                await page.evaluate(async () => { await window.FolderViewPlusSettingsRuntimeHydrationPromise; });
                await expectRows(populated);
                assert.equal(await row('parent').count(), 1, 'reload must not duplicate parent rows');
            } finally { await host.close(); }
        }, { skipAccessibility: true }); // The synthetic host omits Unraid's surrounding native accessibility markup.
    }
};
