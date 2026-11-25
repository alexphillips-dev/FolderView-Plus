import assert from 'node:assert/strict';

export const registerFolderWebuiProfileLimitCases = ({ test, baseUrl }) => {
    test('Custom WebUI profile names validate the persisted UTF-8 limit', async ({ page }) => {
        await page.goto(`${baseUrl}/folder-editor`, { waitUntil: 'load' });
        const names = page.locator('.fv-webui-profile-name');
        await page.evaluate(() => fixtureFolderEditor.webuiProfiles.hydrate([
            { id: 'a', name: 'Profile A', containers: ['Plex'] }, { id: 'b', name: 'Profile B', containers: ['Plex'] }
        ]));
        for (const [index, suffix] of [' A', ' B'].entries()) {
            await names.nth(index).fill('界'.repeat(27) + suffix);
            assert.equal(await names.nth(index).getAttribute('aria-invalid'), 'true');
        }
        assert.equal(await page.evaluate(() => fixtureFolderEditor.webuiProfiles.validate()), false);
        assert.match(await page.locator('.fv-webui-profiles-status').innerText(), /80 UTF-8 bytes/);
        for (const [index, suffix] of [' A', ' B'].entries()) {
            await names.nth(index).fill('界'.repeat(26) + suffix);
        }
        assert.equal(await page.evaluate(() => fixtureFolderEditor.webuiProfiles.validate()), true);
        const saved = JSON.parse(await page.locator('input[name="webui_profiles"]').inputValue());
        assert.deepEqual(saved.map(profile => profile.name), ['界'.repeat(26) + ' A', '界'.repeat(26) + ' B']);
    });

    test('Custom WebUI profile checkboxes and select all respect the same saved member limit', async ({ page }) => {
        await page.goto(`${baseUrl}/folder-editor`, { waitUntil: 'load' });
        await page.evaluate(() => {
            const form = document.getElementById('fvFolderEditorForm');
            fixtureFolderEditor.webuiProfiles.dispose();
            form.querySelectorAll('input[name="containers[]"]').forEach(input => input.parentNode.remove());
            const names = Array.from({ length: 251 }, (_, index) => `container-${index + 1}`);
            for (const name of names) {
                const node = document.createElement('input');
                Object.assign(node, { name: 'containers[]', type: 'checkbox', value: name, checked: true, hidden: true });
                form.appendChild(node);
            }
            fixtureFolderEditor.webuiProfiles = FolderViewPlusFoundationModules.folderWebuiProfiles.createEditorApi({
                window, document, form, type: 'docker', getMembers: () => names.map(Name => ({ Name, webuiCapability: true })),
                translate: (_key, fallback, cap) => fallback.replace('$1', cap)
            });
            fixtureFolderEditor.webuiProfiles.hydrate([{ id: 'a', name: 'Profile', containers: names.slice(0, 250) }]);
        });
        const members = page.locator('.fv-webui-profile-members');
        const state = async () => JSON.parse(await page.locator('input[name="webui_profiles"]').inputValue())[0].containers;
        const overflow = members.locator('input[value="container-251"]');
        const initial = await state();
        await overflow.click();
        assert.equal(await overflow.isChecked(), false);
        assert.deepEqual(await state(), initial);
        await page.getByRole('button', { name: 'Select all with WebUI' }).click();
        assert.match(await page.locator('.fv-webui-profiles-status').innerText(), /250 members/);
        assert.equal(await members.locator('input:checked').count(), 250);
        assert.deepEqual(await state(), initial);
        await members.locator('input[value="container-1"]').uncheck();
        await overflow.check();
        assert.deepEqual(await state(), [...initial.slice(1), 'container-251']);
    });
};
