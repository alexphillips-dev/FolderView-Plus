import assert from 'node:assert/strict';

export const registerCustomIconDeleteCase = ({ test, baseUrl }) => {
    test('Deleting an uploaded custom icon resets all editor previews while preserving failed, cancelled and changed selections', async ({ page }) => {
        await page.route('**/plugins/folderview.plus/images/custom/**', async route => {
            await route.fulfill({ path: 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/images/folder-icon.png' });
        });
        for (const type of ['docker', 'vm']) {
            await page.goto(`${baseUrl}/folder-editor`, { waitUntil: 'load' });
            for (const script of ['folderviewplus.utils-foundation', 'folder.editor.icon-api', 'folder.editor.icons', 'folder.editor.preview']) {
                await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/${script}.js` });
            }
            await page.evaluate(async type => {
                document.body.insertAdjacentHTML('beforeend', `<form id="fixture-delete-form">
                    <img id="fixture-field-preview" width="32" alt="Icon field"><input id="fixture-delete-icon" name="icon">
                    <img id="fvHeroIcon" width="32" alt="Folder heading"><img id="fvIconPanelPreview" width="32" alt="Selected icon">
                    <div id="fvLivePreviewCanvas"></div><button type="button" id="fv-icon-upload">Upload</button>
                    <input type="file" id="fv-icon-upload-file"><div id="fv-icon-upload-status"></div>
                    <div id="fv-icon-picker-panel"></div><button type="button" id="fv-icon-custom-manager-toggle">Custom icons</button>
                    <div id="fv-custom-icon-panel"><div id="fv-custom-icon-list"></div>
                    <div id="fv-custom-icon-status"></div></div></form>`);
                const state = { exists: false, confirm: true, mode: 'success', requests: 0, listFail: false, saved: false };
                const custom = '/plugins/folderview.plus/images/custom/uploaded.png';
                const input = document.getElementById('fixture-delete-icon');
                const form = { icon: input, name: { value: 'Example' }, preview: { value: '1' } };
                const defaultIcon = '/plugins/folderview.plus/images/folder-icon.png';
                const escapeHtml = window.FolderViewPlusFoundationModules.utilityFoundation.escapeHtml;
                const sanitizeImageUrl = window.FolderViewPlusFoundationModules.utilityFoundation.sanitizeImageUrl;
                const preview = window.FolderViewPlusFolderEditorPreview.createApi({ $: window.jQuery, type,
                    getForm: () => form, defaultFolderIconPath: defaultIcon, escapeHtml });
                const setIconInputValue = value => {
                    const image = document.getElementById('fixture-field-preview');
                    if (image instanceof HTMLImageElement) image.src = sanitizeImageUrl(value, defaultIcon);
                    window.jQuery(input).val(value).trigger('input').trigger('change');
                };
                window.jQuery(input).on('input change', () => {
                    preview.updateLiveSummary();
                });
                const requestClient = {
                    getJson: async () => {
                        if (state.listFail) throw new Error('List unavailable');
                        return { ok: true, icons: state.exists ? [{ name: 'uploaded.png', url: custom + '?v=2', usageCount: state.saved ? 1 : 0 }] : [] };
                    },
                    postJson: async () => {
                        state.requests++;
                        if (state.mode === 'refuse') throw new Error('Delete refused');
                        if (state.mode === 'pending') await new Promise(resolve => { state.finish = resolve; });
                        state.exists = false;
                        return { ok: true, deleted: 'uploaded.png' };
                    }
                };
                const folderIconApi = { ...window.FolderViewPlusFolderIconApi.createApi({ window, requestClient,
                    iconUploadApiPath: '/synthetic-icons', allowedExtensions: ['png'] }), uploadCustomIconFile: async () => {
                        state.exists = true;
                        return { name: 'uploaded.png', url: custom + '?v=1' };
                    } };
                const api = window.FolderViewPlusFolderEditorIcons.createApi({ window, document, $: window.jQuery,
                    folderIconApi, escapeHtml, sanitizeImageUrl, getForm: () => form, getIconInput: () => window.jQuery(input),
                    getCurrentIconValue: () => input.value, setIconInputValue, defaultFolderIconPath: defaultIcon,
                    swal: (_options, callback) => callback(state.confirm), fetchJson: async () => [] });
                window.fixtureIconDelete = Object.assign(state, { setIconInputValue, custom, defaultIcon });
                await api.bindIconPickerEvents();
                setIconInputValue(defaultIcon);
            }, type);
            const custom = '/plugins/folderview.plus/images/custom/uploaded.png?v=1';
            const defaultIcon = '/plugins/folderview.plus/images/folder-icon.png';
            const selection = page.locator('#fixture-delete-icon');
            const deleteButton = page.locator('[data-custom-icon="uploaded.png"] [data-action="delete"]');
            const upload = async () => {
                await page.locator('#fv-icon-upload-file').setInputFiles({ name: 'uploaded.png', mimeType: 'image/png', buffer: Buffer.from('fixture') });
                await page.waitForFunction(() => document.getElementById('fixture-delete-icon').value.endsWith('uploaded.png?v=1'));
                await page.locator('#fv-icon-custom-manager-toggle').click();
                await deleteButton.waitFor();
            };
            const expectPreviews = async expected => {
                assert.equal(await selection.inputValue(), expected);
                for (const selector of ['#fixture-field-preview', '#fvHeroIcon', '#fvIconPanelPreview', '#fvLivePreviewCanvas .fv-live-folder-icon']) {
                    assert.equal(await page.locator(selector).getAttribute('src'), expected, `${type}: ${selector}`);
                }
            };
            await upload();
            await expectPreviews(custom);
            await deleteButton.click();
            await page.waitForFunction(() => !window.fixtureIconDelete.exists);
            await expectPreviews(defaultIcon);
            assert.equal(await deleteButton.count(), 0);

            await upload();
            await page.evaluate(() => { window.fixtureIconDelete.confirm = false; });
            await deleteButton.click();
            await expectPreviews(custom);
            assert.equal(await page.evaluate(() => window.fixtureIconDelete.requests), 1, 'cancel must not send deletion');
            await page.evaluate(() => { Object.assign(window.fixtureIconDelete, { confirm: true, mode: 'refuse' }); });
            await deleteButton.click();
            await page.waitForFunction(() => document.getElementById('fv-custom-icon-status').textContent === 'Delete refused');
            await expectPreviews(custom);
            assert.equal(await deleteButton.count(), 1);

            await page.evaluate(() => { const state = window.fixtureIconDelete; state.mode = 'success'; state.setIconInputValue(state.defaultIcon + '?different=1'); });
            await deleteButton.click();
            await page.waitForFunction(() => !window.fixtureIconDelete.exists);
            await expectPreviews(defaultIcon + '?different=1');

            await upload();
            await page.evaluate(() => { window.fixtureIconDelete.mode = 'pending'; });
            await deleteButton.click();
            await page.waitForFunction(() => typeof window.fixtureIconDelete.finish === 'function');
            await page.evaluate(() => { const state = window.fixtureIconDelete; state.setIconInputValue(state.defaultIcon + '?new=1'); state.finish(); });
            await page.waitForFunction(() => !window.fixtureIconDelete.exists);
            await expectPreviews(defaultIcon + '?new=1');

            await upload();
            await page.evaluate(() => { Object.assign(window.fixtureIconDelete, { mode: 'success', saved: true }); });
            await page.locator('#fv-icon-custom-manager-toggle').click();
            const requests = await page.evaluate(() => window.fixtureIconDelete.requests);
            await deleteButton.click();
            await expectPreviews(custom);
            assert.equal(await page.evaluate(() => window.fixtureIconDelete.requests), requests, 'saved references still block deletion');
            await page.evaluate(() => { window.fixtureIconDelete.saved = false; });
            await page.locator('#fv-icon-custom-manager-toggle').click();
            await page.evaluate(() => { window.fixtureIconDelete.listFail = true; });
            await deleteButton.click();
            await page.waitForFunction(() => !window.fixtureIconDelete.exists);
            await expectPreviews(defaultIcon);
        }
    }, { skipAccessibility: true });
};
