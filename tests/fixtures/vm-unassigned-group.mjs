import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const vmNameSelector = 'td.vm-name span.outer span.inner a';
const groupSelector = '#kvm_list > [data-fv-unassigned-group]';
const fileIfPresent = file => fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;

export const verifyVmUnassignedGroup = async ({ page, open, config, root }) => {
    const prefs = path.join(config, 'vm.prefs.json');
    const folders = path.join(config, 'vm.json');
    const order = path.join(root, 'boot/config/plugins/dynamix.vm.manager/userprefs.cfg');
    const savedPrefs = fs.readFileSync(prefs, 'utf8');
    const savedFolders = fs.readFileSync(folders, 'utf8');
    const savedOrder = fileIfPresent(order);
    const table = page.locator('#kvm_list');
    const group = page.locator(groupSelector);
    const toggle = group.getByRole('button');
    const groupedNames = () => table.locator(`tr.sortable[data-fv-unassigned-item] ${vmNameSelector}`).allTextContents();
    const nativeNames = () => table.locator(`tr.sortable:not(.folder) ${vmNameSelector}`).allTextContents();
    const vm = name => table.locator('tr.sortable:not(.folder)').filter({ has: page.locator(vmNameSelector).filter({ hasText: name }) });
    const updateMembers = names => {
        const definitions = JSON.parse(savedFolders);
        definitions['fixture-lab'].containers = names;
        fs.writeFileSync(folders, JSON.stringify(definitions));
    };

    assert.equal(await group.count(), 0);
    const originalNames = await nativeNames();
    assert.deepEqual([...originalNames].sort(), ['Home Assistant', 'Windows 11']);
    try {
        fs.writeFileSync(prefs, JSON.stringify({ ...JSON.parse(savedPrefs), groupUnassignedItems: true }));
        await open('VMs');
        await group.waitFor();
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
        assert.deepEqual(await groupedNames(), originalNames);
        assert.equal(await vm('Home Assistant').isVisible(), false);

        const finder = page.locator('.fv-quickfinder');
        await finder.locator('[data-finder-toggle]').click();
        await finder.locator('input').fill('Home Assistant');
        await finder.locator('[data-finder-select]').filter({ hasText: 'Home Assistant' }).click();
        await vm('Home Assistant').waitFor();
        assert.equal(await toggle.getAttribute('aria-expanded'), 'true');

        const item = vm('Home Assistant');
        const details = item.locator('xpath=following-sibling::tr[1]');
        assert.match(await details.getAttribute('id'), /^name-/);
        assert.equal(await details.getAttribute('data-fv-unassigned-item') !== null, true);
        await item.locator(vmNameSelector).click();
        await details.waitFor();
        await toggle.click();
        await details.waitFor({ state: 'hidden' });
        await toggle.focus();
        await toggle.press('Enter');
        await details.waitFor();

        await page.evaluate(() => window.LockButton());
        await page.locator('#kvm_list.ui-sortable').waitFor();
        assert.equal(await group.count(), 0);
        assert.deepEqual(await nativeNames(), originalNames);
        await page.evaluate(() => window.LockButton());
        await group.waitFor();
        assert.deepEqual(await groupedNames(), originalNames);
        assert.equal(fileIfPresent(order), savedOrder);

        updateMembers(['Debian 12', 'Home Assistant']);
        await page.evaluate(() => window.loadlist());
        await group.waitFor();
        assert.deepEqual(await groupedNames(), ['Windows 11']);
        updateMembers(['Debian 12', 'Home Assistant', 'Windows 11']);
        await open('VMs');
        await table.locator('tr.folder').filter({ hasText: 'Fixture Lab' }).waitFor();
        assert.equal(await group.count(), 0);
        assert.equal(fileIfPresent(order), savedOrder);
        console.log('PASS VM catch-all respects native detail rows, Quick Finder, native sorting, and membership changes');
    } finally {
        fs.writeFileSync(folders, savedFolders);
        fs.writeFileSync(prefs, savedPrefs);
    }
};
