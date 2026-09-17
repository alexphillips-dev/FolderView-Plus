import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const langs = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/langs');
const review = JSON.parse(fs.readFileSync('scripts/lib/i18n_reviewed_runtime.json', 'utf8'));

export const registerLocalizedEditorStateCases = ({ test, baseUrl, loadI18n }) => {
    for (const locale of ['en', ...Object.keys(review.locales).sort()]) {
        test(`editor actions and dirty-state messages update in ${locale} without translating user data`, async ({ page }) => {
            const catalog = JSON.parse(fs.readFileSync(path.join(langs, 'namespaces', locale, 'common.json'), 'utf8'));
            await page.goto(baseUrl + '/localization');
            await loadI18n(page, baseUrl);
            await page.addScriptTag({ url: baseUrl + '/plugin/scripts/folder.editor.state.js' });
            await page.evaluate(() => {
                document.getElementById('dynamic-root').innerHTML = '<label for="editor-name">Folder name</label><input id="editor-name" value="Order">'
                    + '<input id="save-copy" type="button" value="Save as copy" data-i18n="[value]common.runtime.save-as-copy">'
                    + '<span id="unsavedIndicator"></span><span id="fvActionBarDirty"></span><span id="fvActionBarHint"></span>'
                    + '<span data-fvplus-user-content id="literal-folder">Manual</span>';
                window.localizedEditor = window.FolderViewPlusFolderEditorState.createApi({
                    window, $: window.jQuery, getInitialSnapshot: () => 'Order',
                    computeFormSnapshot: () => document.getElementById('editor-name').value,
                    getAllChangedItems: () => ['name']
                });
                window.localizedEditor.updateUnsavedIndicator();
                document.getElementById('editor-name').addEventListener('input', () => window.localizedEditor.updateUnsavedIndicator());
            });
            await page.evaluate(async locale => {
                await window.FolderViewPlusI18n.configure({ requestedLocale: locale, resolvedLocale: locale,
                    fallbackChain: locale === 'en' ? ['en'] : [locale, 'en'], namespaces: ['common', 'legacy-surface'],
                    assets: [...new Set(['en', locale])].flatMap(language => [
                        { locale: language, namespace: 'legacy', url: '/plugin/langs/' + language + '.json' },
                        ...['common', 'legacy-surface'].map(namespace => ({ locale: language, namespace,
                            url: '/plugin/langs/namespaces/' + language + '/' + namespace + '.json' }))
                    ]) });
            }, locale);
            await page.waitForFunction(expected => document.getElementById('fvActionBarDirty').textContent === expected, catalog['common.runtime.all-changes-saved']);
            assert.equal(await page.locator('#save-copy').inputValue(), catalog['common.runtime.save-as-copy']);
            assert.equal(await page.locator('#editor-name').inputValue(), 'Order');
            assert.equal(await page.locator('#literal-folder').textContent(), 'Manual');
            assert.equal(await page.locator('html').getAttribute('dir'), locale === 'ar' ? 'rtl' : 'ltr');
            for (const width of [375, 1280]) {
                await page.setViewportSize({ width, height: 900 });
                await page.locator('#editor-name').fill('Order changed');
                assert.equal(await page.locator('#fvActionBarDirty').textContent(), catalog['common.runtime.unsaved-changes-1'].replace('$1', '1'));
                assert.equal(await page.locator('#fvActionBarHint').textContent(), catalog['common.runtime.save-or-copy-this-folder-when-you-are-ready']);
                assert.equal(await page.locator('#editor-name').evaluate(node => node === document.activeElement), true);
                await page.locator('#editor-name').fill('Order');
                assert.equal(await page.locator('#fvActionBarDirty').textContent(), catalog['common.runtime.all-changes-saved']);
            }
            await page.addScriptTag({ url: baseUrl + '/plugin/scripts/folder.editor.icons.js' });
            await page.evaluate(() => {
                document.getElementById('dynamic-root').insertAdjacentHTML('beforeend', '<div id="fv-icon-picker-panel"><div id="fv-icon-picker-grid"></div><div id="fv-icon-picker-status"></div></div>');
                window.localizedIcons = window.FolderViewPlusFolderEditorIcons.createApi({ window, document, $: window.jQuery,
                    builtInIconFallback: [{ id: 'default', name: 'Default Folder', path: '/plugin/images/icons/folder-default.svg' }],
                    escapeHtml: value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]) });
                window.localizedIcons.renderBuiltInIconPicker();
            });
            assert.equal(await page.locator('.fv-icon-picker-item-name').textContent(), catalog['common.icons.default-folder']);
            assert.equal(await page.locator('.fv-icon-picker-item').getAttribute('data-icon-value'), '/plugin/images/icons/folder-default.svg');
            await page.waitForTimeout(60);
            const count = await page.evaluate(() => window.FolderViewPlusI18n.snapshot().autoTranslatedNodeCount);
            await page.waitForTimeout(60);
            assert.equal(await page.evaluate(() => window.FolderViewPlusI18n.snapshot().autoTranslatedNodeCount), count, 'translation must settle');
        });
    }
};
