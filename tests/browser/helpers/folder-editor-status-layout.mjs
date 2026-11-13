import assert from 'node:assert/strict';
import { mountSettingsEditor } from './folder-editor-settings-host.mjs';
import { nativeSwitchSource, nativeSwitchCss } from './docker-native-switch.mjs';

const readStatusLayout = () => {
    const form = settingsFixture.form;
    const rect = node => { const { x, y, width, height } = node.getBoundingClientRect(); return { x, y, width, height }; };
    const widget = name => {
        const input = form.elements.namedItem(name), instance = $(input).data('fixture-native-switch');
        const label = [instance.off_label[0], instance.on_label[0]].find(node => getComputedStyle(node).display !== 'none');
        return { track: rect(instance.button_bg[0]), label: rect(label) };
    };
    return {
        accent: widget('folder_accent_enabled'), lock: widget('status_color_lock'),
        accentPanel: rect(form.folder_accent_enabled.closest('.fv-editor-panel')),
        colorsPanel: rect(form.status_color_lock.closest('.fv-editor-panel')),
        colorsRow: rect(form.status_color_started.closest('.basic')), lockRow: rect(form.status_color_lock.closest('.basic')),
        controlRow: rect(form.querySelector('.fv-accent-control-row')), pickerGroup: rect(form.querySelector('.fv-accent-inline-controls')),
        picker: rect(form.folder_accent_color), overflow: document.documentElement.scrollWidth > innerWidth
    };
};
const assertStatusLayout = (layout, width, context, allowPickerWrap = false) => {
    for (const key of ['accent', 'lock']) {
        const { track, label } = layout[key];
        assert.ok(label.x >= track.x + track.width, `${context}: ${key} text stays beside its track`);
        assert.ok(Math.abs(label.y + label.height / 2 - track.y - track.height / 2) <= 1.5, `${context}: ${key} text is vertically centered`);
    }
    const { controlRow, pickerGroup, colorsRow, lockRow, accentPanel, colorsPanel } = layout;
    assert.ok(Math.abs(layout.accent.track.x - controlRow.x) <= 1.5, `${context}: accent track starts at the left edge`);
    assert.ok(Math.abs(pickerGroup.x + pickerGroup.width - controlRow.x - controlRow.width) <= 1.5, `${context}: Bar color group reaches the right edge`);
    const accentLabelRight = layout.accent.label.x + layout.accent.label.width;
    if (width > 1180) {
        assert.ok(Math.abs(colorsRow.y - lockRow.y) <= 1.5 && lockRow.x >= colorsRow.x + colorsRow.width, `${context}: Lock is beside the status colors`);
        assert.ok(Math.abs(accentPanel.y - colorsPanel.y) <= 1.5 && colorsPanel.width > accentPanel.width, `${context}: Accent leaves more room for status colors`);
        if (!allowPickerWrap || pickerGroup.y < layout.accent.track.y + layout.accent.track.height) {
            assert.ok(pickerGroup.x - accentLabelRight >= 8, `${context}: Bar color has room to the right of the toggle`);
            assert.ok(Math.abs(layout.picker.y + layout.picker.height / 2 - layout.accent.track.y - layout.accent.track.height / 2) <= 1.5, `${context}: accent controls share a centered row`);
        }
    } else {
        assert.ok(lockRow.y >= colorsRow.y + colorsRow.height, `${context}: narrow status controls stack`);
        assert.ok(accentPanel.y >= colorsPanel.y + colorsPanel.height, `${context}: narrow panels stack`);
        assert.ok(pickerGroup.x >= accentLabelRight + 8 || pickerGroup.y >= layout.accent.track.y + layout.accent.track.height, `${context}: narrow picker stays clear of toggle text`);
    }
    assert.equal(layout.overflow, false, `${context}: no horizontal page overflow`);
    assert.ok(pickerGroup.x + pickerGroup.width <= accentPanel.x + accentPanel.width, `${context}: picker stays inside Accent panel`);
};
export const verifyFolderEditorStatusLayout = async (page, baseUrl) => {
    const writes = [], watch = request => { if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.url()); };
    page.on('request', watch);
    try {
        for (const colorScheme of ['dark', 'light']) {
            await page.emulateMedia({ colorScheme });
            for (const width of [1920, 1440, 390]) {
                await page.setViewportSize({ width, height: 844 });
                for (const type of ['docker', 'vm']) {
                    await mountSettingsEditor(page, baseUrl, type);
                    for (const style of ['ui.primitives', 'ui.host-buttons']) await page.addStyleTag({ url: `${baseUrl}/plugin/styles/${style}.css` });
                    // The responsive dd column declarations match Unraid's native base contract.
                    await page.addStyleTag({ content: nativeSwitchCss + '@media(min-width:769px){dd{display:flex;flex-direction:column;gap:.5rem}}' });
                    await page.addScriptTag({ content: nativeSwitchSource });
                    await page.evaluate(() => {
                        $('input.basic-switch').switchButton({ labels_placement: 'right', off_label: 'Off', on_label: 'On' });
                        FolderViewPlusEnsureAccentControlPlacement(settingsFixture.form);
                        settingsFixture.form.querySelector('.fv-section-nav > button[data-target="status"]').click();
                        const form = settingsFixture.form;
                        window.statusLayoutFixture = { input: form.folder_accent_enabled, color: form.folder_accent_color,
                            track: $(form.folder_accent_enabled).data('fixture-native-switch').button_bg[0],
                            lock: $(form.status_color_lock).data('fixture-native-switch').button_bg[0] };
                    });
                    for (const name of ['folderviewplus.ui', 'folder.editor.help']) await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/${name}.js` });
                    const context = `${type}/${colorScheme}/${width}`;
                    assertStatusLayout(await page.evaluate(readStatusLayout), width, `${context}/native/off`);
                    assert.equal(await page.locator('[name="folder_accent_color"]').isDisabled(), true);
                    // A larger synthetic host track and longer labels exercise theme sizing without claiming an Aurora stylesheet.
                    await page.addStyleTag({ content: '.switch-button-background{width:44px!important;height:24px!important}.switch-button-label{line-height:26px}' });
                    const active = await page.evaluate(() => {
                        const form = settingsFixture.form;
                        for (const name of ['folder_accent_enabled', 'status_color_lock']) {
                            const widget = $(form.elements.namedItem(name)).data('fixture-native-switch');
                            widget.off_label.text('Deaktiviert'); widget.on_label.text('Eingeschaltet'); widget.button_bg[0].click();
                        }
                        form.folder_accent_color.focus();
                        return { enabled: !form.folder_accent_color.disabled, dimmed: !!form.folder_accent_color.closest('.fv-dependent-disabled'),
                            aria: !!form.folder_accent_color.closest('[aria-disabled="true"]'), focused: document.activeElement === form.folder_accent_color };
                    });
                    assert.deepEqual(active, { enabled: true, dimmed: false, aria: false, focused: true }, 'accent color enables in the same native-widget event task');
                    assertStatusLayout(await page.evaluate(readStatusLayout), width, `${context}/large-host/on`, true);
                    const beforeRefresh = await page.evaluate(() => {
                        const form = settingsFixture.form;
                        for (const [name, value] of Object.entries({ folder_accent_color: '#123456', status_color_started: '#12ab34', status_color_paused: '#567890', status_color_stopped: '#ab1234', status_color_text: '#1f2e3d' })) {
                            form.elements.namedItem(name).value = value; form.elements.namedItem(name).dispatchEvent(new Event('change', { bubbles: true }));
                        }
                        return settingsFixture.serialize().settings;
                    });
                    assert.equal(beforeRefresh.folder_accent_enabled, true); assert.equal(beforeRefresh.folder_accent_color, '#123456');
                    assert.equal(beforeRefresh.status_color_lock, true); assert.equal(beforeRefresh.status_color_text_explicit, true);
                    await page.evaluate(() => {
                        for (let index = 0; index < 2; index++) { FolderViewPlusEnsureAccentControlPlacement(settingsFixture.form); FolderViewPlusRefreshModernEditorChromeLayout(); }
                    });
                    assert.deepEqual(await page.evaluate(() => {
                        const form = settingsFixture.form, fixture = statusLayoutFixture;
                        return { input: fixture.input === form.folder_accent_enabled, color: fixture.color === form.folder_accent_color,
                            track: fixture.track === $(form.folder_accent_enabled).data('fixture-native-switch').button_bg[0],
                            lock: fixture.lock === $(form.status_color_lock).data('fixture-native-switch').button_bg[0],
                            backgrounds: form.querySelectorAll('.fv-accent-enable-control .switch-button-background').length };
                    }), { input: true, color: true, track: true, lock: true, backgrounds: 1 }, 'chrome refresh retains native nodes and handlers');
                    assert.deepEqual(await page.evaluate(() => settingsFixture.serialize().settings), beforeRefresh);
                    const accentInfo = page.locator('[data-editor-panel="accent"] dt [data-fv-setting-info]');
                    assert.equal(await accentInfo.count(), 1);
                    if (width > 1180) await accentInfo.hover(); else await accentInfo.focus();
                    await page.getByRole('tooltip').waitFor(); assert.match(await page.getByRole('tooltip').innerText(), /optional accent bar/i);
                    await page.keyboard.press('Escape');
                    const disabled = await page.evaluate(() => {
                        statusLayoutFixture.track.click(); const form = settingsFixture.form;
                        return { disabled: form.folder_accent_color.disabled, gray: !!form.folder_accent_color.closest('.fv-dependent-disabled'),
                            aria: !!form.folder_accent_color.closest('[aria-disabled="true"]'), value: form.folder_accent_color.value };
                    });
                    assert.deepEqual(disabled, { disabled: true, gray: true, aria: true, value: '#123456' });
                    assertStatusLayout(await page.evaluate(readStatusLayout), width, `${context}/large-host/off`, true);
                    assert.equal(await page.evaluate(() => settingsFixture.serialize().settings.folder_accent_color), '#123456');
                }
            }
        }
        assert.deepEqual(writes, [], 'Status layout and live color edits do not persist before Submit');
    } finally { page.off('request', watch); }
};
