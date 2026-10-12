import assert from 'node:assert/strict';

export const registerCustomIconRenameCase = ({ test, baseUrl }) => {
    test('Custom icon rename keeps editor selection and reports a localized refusal before allowing an unused rename', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto(`${baseUrl}/folder-editor`, { waitUntil: 'load' });
        for (const script of ['CLDRPluralRuleParser', 'jquery.i18n', 'jquery.i18n.messagestore', 'jquery.i18n.fallbacks',
            'jquery.i18n.language', 'jquery.i18n.parser', 'jquery.i18n.emitter', 'jquery.i18n.emitter.bidi']) {
            await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/include/${script}.js` });
        }
        for (const script of ['folderviewplus.i18n', 'folder.editor.icon-api', 'folder.editor.icons']) {
            await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/${script}.js` });
        }
        await page.evaluate(async () => {
            await window.FolderViewPlusI18n.configure({ requestedLocale: 'de', resolvedLocale: 'de', fallbackChain: ['de', 'en'],
                namespaces: ['common'], assets: ['en', 'de'].map(locale => ({ locale, namespace: 'common', url: `/plugin/langs/namespaces/${locale}/common.json` })) });
            document.body.insertAdjacentHTML('beforeend', '<form id="fixture-icons-form"><label>Selected icon<input id="fixture-icon-value"></label><img id="fixture-icon-preview" alt="Selected folder icon"><button type="button" id="fv-icon-custom-manager-toggle">Custom icons</button><div id="fv-icon-picker-panel"></div><div id="fv-custom-icon-panel"><div id="fv-custom-icon-stats"></div><div id="fv-custom-icon-list"></div><button type="button" id="fv-custom-icon-prev">Previous</button><button type="button" id="fv-custom-icon-next">Next</button><span id="fv-custom-icon-page-label"></span><div id="fv-custom-icon-status" role="status"></div></div></form>');
            const state = { name: 'before.png', savedReference: true, requests: [] };
            const url = () => '/plugin/images/folder-icon.png?fixture=' + state.name;
            const selected = '/plugins/folderview.plus/images/custom/before.png?v=7';
            document.getElementById('fixture-icon-value').value = selected;
            document.getElementById('fixture-icon-preview').src = url();
            const requestClient = {
                getJson: async () => ({ ok: true, icons: [{ name: state.name, url: url(), usageCount: state.savedReference ? 1 : 0 }], stats: {}, health: {} }),
                postJson: async (_path, body) => {
                    state.requests.push(body);
                    if (state.savedReference || body.selectedIcon === selected) return { ok: false,
                        error: 'Remove or replace saved icon references and choose a different editor icon before renaming.', errorKey: 'common.server.icon-rename-referenced' };
                    state.name = body.to; return { ok: true };
                }
            };
            const folderIconApi = window.FolderViewPlusFolderIconApi.createApi({ window, requestClient, iconUploadApiPath: '/synthetic-icons' });
            window.prompt = () => 'after.png';
            state.api = window.FolderViewPlusFolderEditorIcons.createApi({ window, document, $: window.jQuery, folderIconApi,
                getForm: () => window.jQuery('#fixture-icons-form'), getIconInput: () => window.jQuery('#fixture-icon-value'),
                getCurrentIconValue: () => document.getElementById('fixture-icon-value').value, fetchJson: async () => [] });
            window.fixtureIconRename = state;
            await state.api.bindIconPickerEvents();
        });
        await page.locator('#fv-icon-custom-manager-toggle').click();
        await page.locator('[data-custom-icon="before.png"] [data-action="rename"]').waitFor();
        const selected = await page.locator('#fixture-icon-value').inputValue();
        const preview = await page.locator('#fixture-icon-preview').getAttribute('src');
        await page.locator('[data-action="rename"]').click();
        const expected = await page.evaluate(() => window.FolderViewPlusI18n.t('common.server.icon-rename-referenced'));
        await page.waitForFunction(expected => document.getElementById('fv-custom-icon-status').textContent === expected, expected);
        assert.equal(await page.locator('#fv-custom-icon-status').getAttribute('class'), 'is-error');
        assert.equal(await page.locator('#fixture-icon-value').inputValue(), selected);
        assert.equal(await page.locator('#fixture-icon-preview').getAttribute('src'), preview);
        assert.equal(await page.locator('[data-custom-icon="before.png"]').count(), 1);
        assert.equal(await page.evaluate(() => window.fixtureIconRename.requests[0].selectedIcon), selected);
        await page.locator('#fixture-icon-value').fill('/plugins/folderview.plus/images/folder-icon.png');
        await page.locator('[data-action="rename"]').focus(); await page.keyboard.press('Enter');
        await page.waitForFunction(() => window.fixtureIconRename.requests.length === 2);
        assert.equal(await page.evaluate(() => window.fixtureIconRename.name), 'before.png', 'saved references must still refuse after changing the draft selection');
        await page.evaluate(() => { window.fixtureIconRename.savedReference = false; });
        await page.locator('[data-action="rename"]').click();
        await page.locator('[data-custom-icon="after.png"]').waitFor();
        assert.equal(await page.locator('#fixture-icon-value').inputValue(), '/plugins/folderview.plus/images/folder-icon.png');
        assert.equal(await page.evaluate(() => window.fixtureIconRename.requests.length), 3);
    }, { skipAccessibility: true });
};
