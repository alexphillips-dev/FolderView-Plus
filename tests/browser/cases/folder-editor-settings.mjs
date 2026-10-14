import assert from 'node:assert/strict';
import { mountSettingsEditor } from '../helpers/folder-editor-settings-host.mjs';
import { mountActionSettings } from '../helpers/folder-action-settings-host.mjs';
export const registerFolderEditorSettingsCases = ({ test, baseUrl }) => {
    test('Folder editor dependencies remain visible and preserve inactive values across tabs', async ({ page }) => {
        for (const type of ['docker', 'vm']) {
            await mountSettingsEditor(page, baseUrl, type);
            if (type === 'docker') assert.deepEqual(await page.evaluate(() => Object.values(settingsFixture.schema.SECTION_FIELD_NAMES).flat().filter(name => !settingsFixture.form.elements.namedItem(name)?.closest('.fv-section-shell'))), []);
            await page.locator('.fv-section-nav > button[data-target="preview"]').click();
            for (const name of ['preview_overflow', 'preview_row_separator', 'preview_row_separator_color']) {
                assert.equal(await page.locator(`[name="${name}"]`).evaluate(field => Boolean(field.closest('.fv-editor-panel[data-editor-panel-section="preview"]'))), true);
            }
            await page.evaluate(() => {
                const { form, refresh } = settingsFixture;
                form.preview.value = '0'; form.preview_border.checked = true; form.preview_vertical_bars.checked = true;
                form.preview_row_separator.checked = true; form.context.value = '2'; form.context_graph.value = '1';
                form.preview_border_color.value = '#123456'; refresh();
            });
            for (const name of ['preview_hover', 'preview_overflow', 'preview_border_color', 'preview_border_width', 'preview_vertical_bars_color', 'preview_row_separator_color', 'dropdown_style']) {
                const state = await page.locator(`[name="${name}"]`).evaluate(field => ({ disabled: field.disabled, gray: Boolean(field.closest('.fv-dependent-disabled')), hidden: Boolean(field.closest('.fv-orphan-editor-row')), value: field.value }));
                assert.equal(state.disabled, true, name); assert.equal(state.gray, true, name); assert.equal(state.hidden, false, name);
            }
            assert.equal(await page.locator('[name="preview_border_color"]').isVisible(), true);
            const inactive = await page.evaluate(() => settingsFixture.serialize().settings);
            assert.equal(inactive.preview, 0);
            assert.equal(inactive.preview_border, true);
            assert.equal(inactive.preview_border_color, '#123456');
            assert.equal(inactive.preview_row_separator, true);
            await page.locator('.fv-section-nav > button[data-target="general"]').click();
            assert.equal(await page.locator('[name="folder_webui_url"]').isVisible(), true);
            assert.equal(await page.locator('[name="folder_webui_url"]').isDisabled(), true);
            await page.locator('.fv-section-nav > button[data-target="preview"]').click();
            assert.equal(await page.locator('[name="preview_border_color"]').isDisabled(), true);
            await page.locator('[name="preview"]').selectOption('1');
            assert.equal(await page.locator('[name="preview_border_color"]').isEnabled(), true);
            assert.equal(await page.locator('[name="preview_border_color"]').inputValue(), '#123456');
            if (type === 'docker') {
                assert.equal(await page.locator('[name="folder_update_highlight"]').evaluate(field => Boolean(field.closest('[data-editor-panel="appearance"]'))), true);
                assert.equal(await page.locator('[name="context_graph_time"]').isEnabled(), true);
                await page.locator('[name="context_graph"]').selectOption('0');
                assert.equal(await page.locator('[name="context_graph_time"]').isVisible(), true);
                assert.equal(await page.locator('[name="context_graph_time"]').isDisabled(), true);
            } else {
                assert.equal(await page.locator('[name="context"]').isVisible(), false);
                assert.equal(await page.locator('[name="preview_hide_nested_items"]').evaluate(field => field.closest('.basic').getBoundingClientRect().height), 0);
            }
            await page.locator('.fv-section-nav > button[data-target="status"]').click();
            assert.equal(await page.locator('[name="status_color_lock"]').evaluate(field => Boolean(field.closest('[data-editor-panel="status-colors"]'))), true);
            assert.equal(await page.locator('[name="folder_accent_color"]').isVisible(), true);
            assert.equal(await page.locator('[name="folder_accent_color"]').isDisabled(), true);
            assert.equal(await page.locator('[name="folder_accent_enabled"]').isEnabled(), true);
            await page.evaluate(() => {
                const { form, refresh } = settingsFixture;
                form.folder_accent_enabled.checked = true; refresh();
            });
            assert.equal(await page.locator('[name="folder_accent_color"]').isEnabled(), true);
        }
        await mountActionSettings(page);
        const dialog = page.locator('.dialogCustomAction');
        assert.equal(await dialog.locator('[name="action_script"]').isVisible(), true);
        assert.equal(await dialog.locator('[name="action_script"]').isDisabled(), true);
        await dialog.locator('.switch-button').evaluate(button => button.click());
        assert.equal(await dialog.locator('[name="action_script_sync"]').isChecked(), false);
        await dialog.locator('[name="action_standard"]').selectOption('2');
        assert.equal(await dialog.locator('[name="action_cycle"]').isDisabled(), true);
        assert.equal(await dialog.locator('[name="action_set"]').isDisabled(), true);
        await dialog.locator('[data-action-type="1"]').focus(); await page.keyboard.press('Space');
        assert.equal(await dialog.locator('[name="action_script"]').isEnabled(), true);
        assert.equal(await dialog.locator('[name="action_elements"]').isDisabled(), true);
        assert.equal(await dialog.locator('[data-action-target-command="all"]').isDisabled(), true);
        assert.equal(await page.evaluate(() => actionWidgetOperations.includes('close') && actionWidgetOperations.at(-1) === 'disable'), true);
        await dialog.locator('[name="action_script"]').fill('Saved script');
        await dialog.locator('[data-action-type="0"]').click();
        assert.equal(await dialog.locator('[name="action_script"]').inputValue(), 'Saved script');
        assert.equal(await dialog.locator('[name="action_script"]').isDisabled(), true);
        await page.evaluate(() => { document.querySelector('.ui-dialog').remove(); document.querySelector('.templateDialogCustomAction').remove(); });
    });
};
