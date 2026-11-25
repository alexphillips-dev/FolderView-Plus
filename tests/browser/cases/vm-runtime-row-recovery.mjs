import assert from 'node:assert/strict';
import { closeFilterViewHost as closeHost, createFilterViewSettingsHost, mountFilterViewVmHost } from '../helpers/filter-view-settings-host.mjs';

export const mountAndOpenVmInfoFolder = async (page, host) => {
    const folder = host.folders['fixture-folder-0'];
    folder.containers = [host.names[0]];
    host.folders['0'] = { name: 'Numeric ID', containers: [], settings: {}, actions: [] };
    await mountFilterViewVmHost(page, host, { nativeDetails: true });
    const info = page.locator('#name-0');
    assert.equal(await info.count(), 1, 'the native Info detail keeps exclusive use of its global ID');
    assert.equal(await info.evaluate(row => row.previousElementSibling.id), 'fixture-vm-0');
    const toggle = page.getByRole('button', { name: folder.name, exact: true });
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    await toggle.focus();
    await page.keyboard.press('Enter');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    return { info, toggle };
};

export const closeVmInfoFolder = async (toggle) => {
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
};

export const registerVmRuntimeRowRecoveryCases = ({ test }) => {
    test('VM view preferences render empty folders without native sortable rows and restore the stock placeholder when hidden', async ({ page }) => {
        const host = await createFilterViewSettingsHost(page);
        const names = host.names.splice(0);
        const entries = names.map(name => [name, host.runtime.vm[name]]);
        names.forEach(name => { delete host.runtime.vm[name]; });
        try {
            await mountFilterViewVmHost(page, host);
            const placeholder = page.getByText('No Virtual Machines installed');
            assert.equal(await page.locator('#kvm_list > tr.folder').count(), 2);
            assert.equal(await placeholder.isVisible(), false);
            host.prefs('vm').hideEmptyFolders = true;
            await page.evaluate(() => { window.loadlist(); });
            await placeholder.waitFor({ state: 'visible' });
            assert.equal(await page.locator('#kvm_list > tr.folder').count(), 0);

            const [name, entry] = entries[0];
            host.names.push(name);
            host.runtime.vm[name] = entry;
            host.folders['fixture-folder-0'].containers = [name];
            await page.evaluate(() => { window.loadlist(); });
            await page.locator('tr.folder-id-fixture-folder-0 .folder-storage #fixture-vm-0').waitFor({ state: 'attached' });
            assert.equal(await placeholder.count(), 0);
            assert.equal(await page.locator('#kvm_list > tr.folder').count(), 1);
        } finally { await closeHost(page, host); }
    }, { skipAccessibility: true });

    test('VM view preferences preserve a real folder-prefixed VM when a colliding folder fails rendering', async ({ page }) => {
        const host = await createFilterViewSettingsHost(page);
        const oldName = host.names[0];
        const name = 'folder-colliding';
        host.names[0] = name;
        host.runtime.vm[name] = { ...host.runtime.vm[oldName], name, Name: name };
        delete host.runtime.vm[oldName];
        host.folders['fixture-folder-0'].name = 'Alpha';
        host.folders['fixture-folder-0'].containers = [name];
        host.folders.colliding = { name: 'Zulu', containers: [], settings: {}, actions: [] };
        host.prefs('vm').sortMode = 'alpha';
        const healthyMember = page.locator('tr.folder-id-fixture-folder-0 .folder-storage #fixture-vm-0');
        try {
            await mountFilterViewVmHost(page, host);
            assert.equal(await healthyMember.count(), 1);
            await page.evaluate(() => {
                folderEvents.addEventListener('vm-pre-folder-creation', event => {
                    if (event.detail.id === 'colliding') {
                        Object.defineProperty(event.detail.folder, 'icon', {
                            configurable: true,
                            get() { throw new Error('Synthetic folder render failure'); }
                        });
                    }
                });
                window.loadlist();
            });
            await page.locator('#kvm_list[data-fv-folder-render-failures="1"]').waitFor();
            assert.equal(await healthyMember.count(), 1);
            assert.equal(await page.locator('#kvm_list > #fixture-vm-0').count(), 0);
        } finally { await closeHost(page, host); }
    }, { skipAccessibility: true });
};
