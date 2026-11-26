import assert from 'node:assert/strict';
import { closeFilterViewHost as closeHost, createFilterViewSettingsHost, mountFilterViewVmHost } from '../helpers/filter-view-settings-host.mjs';

export const registerVmRuntimeRemediationCases = ({ test }) => {
    test('VM view preferences preserve native names and reset when writing native sort order with semicolon labels', async ({ page }) => {
        const host = await createFilterViewSettingsHost(page);
        const names = ['folder-native-machine', 'media-folder-backup'];
        host.names.forEach((previous, index) => {
            host.runtime.vm[names[index]] = { ...host.runtime.vm[previous], name: names[index] };
            delete host.runtime.vm[previous];
        });
        host.names.splice(0, host.names.length, ...names);
        host.folders['fixture-folder-0'].containers = [names[0]];
        host.folders['fixture-folder-0'].name = 'VM; lab';
        host.prefs('vm').sortMode = 'alpha';
        const writes = [];
        const endpoint = '/plugins/dynamix.vm.manager/include/UserPrefs.php';
        await page.route('**' + endpoint, async route => {
            writes.push(new URLSearchParams(route.request().postData() || ''));
            await route.fulfill({ status: 200, body: '' });
        });
        try {
            await mountFilterViewVmHost(page, host);
            assert.equal(await page.locator('tr.folder-id-fixture-folder-0 .folder-storage #fixture-vm-0').count(), 1);
            await page.evaluate(async endpoint => {
                const $ = window.jQuery;
                let names = '', index = '';
                const row = $('#kvm_list tr:first');
                row.parent().children().find('td.vm-name').each(function () {
                    names += $(this).find('a').text() + ';';
                    index += $(this).parent().parent().children().index($(this).parent()) + ';';
                });
                await $.post(endpoint, { names, index });
                await $.post(endpoint, { names: 'Unrelated request;', index: '7;' });
                await $.post(endpoint, { reset: true });
            }, endpoint);
            const savedNames = writes[0].get('names').split(';').filter(Boolean);
            assert.ok(savedNames.includes('folder-fixture-folder-0'));
            assert.ok(savedNames.includes('folder-empty'));
            assert.ok(!savedNames.some(name => name.includes('lab')));
            assert.deepEqual(savedNames.filter(name => names.includes(name)).sort(), [...names].sort());
            assert.equal(savedNames.includes('folder-backup'), false);
            assert.deepEqual(writes[0].get('index').split(';').filter(Boolean).map(Number), savedNames.map((_, index) => index));
            assert.deepEqual(Object.fromEntries(writes[1]), { names: 'Unrelated request;', index: '7;' });
            assert.equal(writes[2].get('reset'), 'true');
            assert.equal(writes[2].has('names'), false);
        } finally { await closeHost(page, host); }
    }, { skipAccessibility: true });

    test('VM view preferences preserve user names in Spanish and resolve native rows by UUID', async ({ page }) => {
        const host = await createFilterViewSettingsHost(page, { locale: 'es' });
        const [assigned, original] = host.names;
        host.runtime.vm.Media = { ...host.runtime.vm[original], name: 'Media' };
        delete host.runtime.vm[original];
        host.names[1] = 'Media';
        host.folders['fixture-folder-0'].containers = [assigned];
        host.prefs('vm').groupUnassignedItems = true;
        try {
            await mountFilterViewVmHost(page, host, { nativeName: name => name === assigned ? 'Different display text' : name });
            await page.evaluate(() => window.FolderViewPlusI18n.ready);
            assert.equal(await page.evaluate(() => window.FolderViewPlusI18n.message('Media')), 'Medios');
            assert.equal(await page.locator('.folder-id-fixture-folder-0 .folder-storage #fixture-vm-0').count(), 1);
            const row = page.locator('#fixture-vm-1');
            assert.equal(await row.locator('td.vm-name .inner a').textContent(), 'Media');
            const group = page.locator('[data-fv-unassigned-group]');
            await group.waitFor({ state: 'attached' });
            await page.evaluate(() => {
                document.querySelector('#fixture-vm-1 td.vm-name .inner a').textContent = 'Medios';
                renderVmUnassignedGroup();
            });
            assert.equal(await group.count(), 1);
            assert.deepEqual(await page.evaluate(name => [
                getVmRuntimeEntryByUuid('fixture-vm-1', name)?.name,
                getVmRuntimeEntryByUuid('stale-vm-uuid', name),
                getVmRuntimeEntryByUuid('', name)?.name
            ], assigned), ['Media', null, assigned]);
            await page.locator('[data-finder-toggle]').click();
            await page.locator('.fv-quickfinder input').fill('Media');
            await page.locator('.fv-quickfinder-name', { hasText: /^Media$/ }).waitFor();
            await page.locator('.fv-quickfinder-item-result [data-finder-select]').click();
            await row.and(page.locator('.fv-quickfinder-highlight')).waitFor();
        } finally { await closeHost(page, host); }
    }, { skipAccessibility: true });

    test('VM view preferences classify stopped autostart members consistently on full and live renders', async ({ page }) => {
        const host = await createFilterViewSettingsHost(page);
        const [name] = host.names;
        host.folders['fixture-folder-0'].containers = [name];
        const member = host.runtime.vm[name];
        Object.assign(member, { state: 'crashed', autostart: true });
        try {
            await mountFilterViewVmHost(page, host);
            const folder = page.locator('tr.folder-id-fixture-folder-0');
            const check = async (status, badge) => {
                assert.match(await folder.locator('.folder-state').textContent(), status);
                assert.ok((await folder.getAttribute('class')).split(/\s+/).includes(badge));
            };
            await check(/stopped/, 'autostart-off');
            member.state = 'shutdown';
            assert.equal(await page.evaluate(() => refreshVmRuntimeStateInPlace()), true);
            await check(/stopped/, 'autostart-off');
            member.state = 'paused';
            assert.equal(await page.evaluate(() => refreshVmRuntimeStateInPlace()), true);
            await check(/paused/, 'autostart-full');
            assert.equal(await page.evaluate(() => window.fixtureNativeRefreshCount), 1);
        } finally { await closeHost(page, host); }
    }, { skipAccessibility: true });
};

export const registerLocalizedSettingsPickerCase = ({ test, openSettings }) => {
    test('Filters and view settings keep configured folder names untranslated in Spanish pickers', async ({ page }) => {
        const host = await createFilterViewSettingsHost(page, { locale: 'es' });
        host.folders['fixture-folder-0'].name = 'Media';
        host.prefs('vm').folderDefaults = { sourceId: 'removed', sourceName: 'Media', profile: { settings: { preview: 1 } } };
        try {
            await openSettings(page, host);
            await page.evaluate(() => window.FolderViewPlusI18n.ready);
            assert.equal(await page.evaluate(() => window.FolderViewPlusI18n.message('Media')), 'Medios');
            for (const type of ['docker', 'vm']) {
                for (const picker of ['rule-folder', 'folder-defaults-source']) {
                    assert.equal(await page.locator(`#${type}-${picker} option[value="fixture-folder-0"]`).textContent(), 'Media');
                }
                assert.equal(await page.locator(`#${type}-rule-folder option[value=""]`).textContent(), 'Todas las carpetas');
            }
            assert.equal(await page.locator('#vm-folder-defaults-source option[value="removed"]').textContent(), 'Media (perfil guardado)');
        } finally { await closeHost(page, host); }
    }, { skipAccessibility: true });
};
