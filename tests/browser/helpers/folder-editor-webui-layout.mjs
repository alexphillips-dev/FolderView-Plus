import assert from 'node:assert/strict';
import { mountSettingsEditor } from './folder-editor-settings-host.mjs';
import { nativeSwitchSource, nativeSwitchCss } from './docker-native-switch.mjs';

const readLayout = () => {
    const form = settingsFixture.form;
    const rect = node => { const { x, y, width, height } = node.getBoundingClientRect(); return { x, y, width, height }; };
    const row = form.folder_webui.closest('.basic');
    return {
        cards: ['name', 'folder_webui', 'folder_webui_url'].map(name => rect(form.elements.namedItem(name).closest('.basic'))),
        toggle: rect(row.querySelector('.switch-button-background')),
        label: rect([...row.querySelectorAll('.switch-button-label')].find(node => getComputedStyle(node).display !== 'none')),
        overflow: document.documentElement.scrollWidth > innerWidth,
        disabled: form.folder_webui_url.disabled,
        checked: form.folder_webui.checked
    };
};
const assertLayout = (layout, width, context) => {
    const { cards, toggle, label } = layout;
    if (width > 1180) {
        for (const card of cards.slice(1)) {
            assert.ok(Math.abs(card.y - cards[0].y) <= 1.5, `${context}: identity cards share a row`);
            assert.ok(Math.abs(card.y + card.height - cards[0].y - cards[0].height) <= 1.5, `${context}: card bottoms align`);
        }
        assert.ok(cards[0].x + cards[0].width < cards[1].x && cards[1].x + cards[1].width < cards[2].x, `${context}: ordered desktop cards`);
    } else {
        assert.ok(cards[0].y + cards[0].height < cards[1].y && cards[1].y + cards[1].height < cards[2].y, `${context}: narrow cards stack`);
    }
    assert.ok(label.x >= toggle.x + toggle.width, `${context}: visible On/Off text is to the right`);
    assert.ok(Math.abs(label.y + label.height / 2 - toggle.y - toggle.height / 2) <= 1.5, `${context}: On/Off text is vertically centered`);
    assert.equal(layout.overflow, false, `${context}: no horizontal page overflow`);
};
export const verifyFolderEditorWebuiLayout = async (page, baseUrl) => {
    for (const colorScheme of ['dark', 'light']) {
        await page.emulateMedia({ colorScheme });
        for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: 844 });
            for (const type of ['docker', 'vm']) {
                await mountSettingsEditor(page, baseUrl, type);
                await page.addStyleTag({ content: nativeSwitchCss });
                await page.addScriptTag({ content: nativeSwitchSource });
                await page.evaluate(() => $('[name="folder_webui"]').switchButton({ labels_placement: 'right', off_label: 'Off', on_label: 'On' }));
                const context = `${type}/${colorScheme}/${width}`;
                const off = await page.evaluate(readLayout);
                assert.equal(off.disabled, true); assert.equal(off.checked, false);
                assertLayout(off, width, `${context}/native/off`);
                const toggle = page.locator('.is-webui-row .switch-button-background');
                await toggle.click();
                assert.equal(await page.locator('[name="folder_webui_url"]').isEnabled(), true);
                await page.locator('[name="folder_webui_url"]').fill('https://example.invalid/folder');
                assertLayout(await page.evaluate(readLayout), width, `${context}/native/on`);
                // Synthetic host conflicts, not an Aurora stylesheet: full-width labels and floated switch margins.
                await page.addStyleTag({ content: 'body .switch-button-label{display:block;width:100%;line-height:26px;margin:8px 0 4px}body .switch-button-background{float:left;width:44px!important;height:24px!important;margin:9px 12px 5px 0}' });
                await page.evaluate(() => {
                    const labels = document.querySelector('.is-webui-row').querySelectorAll('.switch-button-label');
                    labels[0].textContent = 'Deaktiviert'; labels[1].textContent = 'Eingeschaltet';
                    FolderViewPlusRefreshModernEditorChromeLayout(); FolderViewPlusRefreshModernEditorChromeLayout();
                });
                await toggle.click();
                const disabled = await page.evaluate(readLayout);
                assert.equal(disabled.disabled, true); assert.equal(disabled.checked, false);
                assertLayout(disabled, width, `${context}/synthetic-host/off`);
                await toggle.click();
                const enabled = await page.evaluate(readLayout);
                assert.equal(enabled.disabled, false); assert.equal(enabled.checked, true);
                assertLayout(enabled, width, `${context}/synthetic-host/on`);
                assert.deepEqual(await page.evaluate(() => {
                    const settings = settingsFixture.serialize().settings;
                    return { enabled: settings.folder_webui, url: settings.folder_webui_url, creates: fixtureSwitchCreates,
                        fields: document.querySelectorAll('[name="folder_webui"]').length,
                        backgrounds: document.querySelectorAll('.is-webui-row .switch-button-background').length };
                }), { enabled: true, url: 'https://example.invalid/folder', creates: 1, fields: 1, backgrounds: 1 });
            }
        }
    }
};
