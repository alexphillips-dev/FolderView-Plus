import assert from 'node:assert/strict';
import { createHideEmptySettingsHost, waitForSettingsRuntimeHydration } from './settings-hide-empty-host.mjs';

export const checkNumericSettingsOrder = async page => {
    const host = await createHideEmptySettingsHost(page, 'docker', {
        folders: { '0': { name: 'Zulu' }, '1': { name: 'Alpha' }, '2': { name: 'Bravo' } },
        prefs: { hideEmptyFolders: false, sortMode: 'manual', manualOrder: ['2', '1', '0'] }
    });
    const rows = () => page.locator('tbody#docker > tr[data-folder-id]').evaluateAll(nodes => nodes.map(node => node.dataset.folderId));
    try {
        await page.goto(host.url, { waitUntil: 'domcontentloaded' });
        host.releaseRuntime();
        await waitForSettingsRuntimeHydration(page);
        assert.deepEqual(await rows(), ['2', '1', '0']);
        await page.evaluate(() => changeSortMode('docker', 'alpha'));
        await page.waitForFunction(() => document.querySelector('tbody#docker > tr[data-folder-id]')?.dataset.folderId === '1');
        assert.deepEqual(await rows(), ['1', '2', '0']);
        await page.evaluate(() => toggleFolderPin('docker', '0'));
        await page.waitForFunction(() => document.querySelector('tbody#docker > tr[data-folder-id]')?.dataset.folderId === '0');
        assert.deepEqual(await rows(), ['0', '1', '2']);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await waitForSettingsRuntimeHydration(page);
        assert.deepEqual(await rows(), ['0', '1', '2']);
    } finally { await host.close(); }
};
