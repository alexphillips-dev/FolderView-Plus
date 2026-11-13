import assert from 'node:assert/strict';
import { mountSettingsEditor } from './folder-editor-settings-host.mjs';
import { nativeSwitchSource, nativeSwitchCss } from './docker-native-switch.mjs';

const commonToggles = ['override_default_actions', 'default_action', 'expand_tab', 'expand_dashboard'];
const readAdvancedLayout = () => {
    const form = settingsFixture.form;
    const rect = node => { const { x, y, width, height } = node.getBoundingClientRect(); return { x, y, width, height }; };
    return {
        rows: advancedLayoutFixture.names.map(name => {
            const input = form.elements.namedItem(name), widget = $(input).data('fixture-native-switch'), dd = input.closest('dd');
            const label = [widget.off_label[0], widget.on_label[0]].find(node => getComputedStyle(node).display !== 'none');
            return { name, card: rect(input.closest('.basic')), track: rect(widget.button_bg[0]), label: rect(label), checked: input.checked,
                contentLeft: rect(dd).x + parseFloat(getComputedStyle(dd).paddingLeft) };
        }),
        overflow: document.documentElement.scrollWidth > innerWidth
    };
};
const assertAdvancedLayout = (layout, width, context) => {
    for (const { name, card, track, label, contentLeft } of layout.rows) {
        assert.ok(card.width > 0 && card.height > 0, `${context}/${name}: visible Advanced field`);
        assert.ok(label.x >= track.x + track.width, `${context}/${name}: label is to the right of the toggle`);
        assert.ok(Math.abs(label.y + label.height / 2 - track.y - track.height / 2) <= 1.5, `${context}/${name}: label is vertically centered`);
        assert.ok(Math.abs(track.x - contentLeft) <= 1.5, `${context}/${name}: toggle stays left aligned`);
        assert.ok(label.x + label.width <= card.x + card.width, `${context}/${name}: label stays inside its field card`);
    }
    for (const [first, second] of [['override_default_actions', 'default_action'], ['expand_tab', 'expand_dashboard']]) {
        const a = layout.rows.find(row => row.name === first).card, b = layout.rows.find(row => row.name === second).card;
        if (width > 920) {
            assert.ok(Math.abs(a.y - b.y) <= 1.5 && b.x >= a.x + a.width, `${context}/${first}: paired cards share a row`);
            assert.ok(Math.abs(a.y + a.height - b.y - b.height) <= 1.5, `${context}/${first}: paired card bottoms align`);
        } else assert.ok(b.y >= a.y + a.height && Math.abs(a.x - b.x) <= 1.5, `${context}/${first}: narrow cards stack`);
    }
    assert.equal(layout.overflow, false, `${context}: no horizontal page overflow`);
};
export const verifyFolderEditorAdvancedLayout = async (page, baseUrl) => {
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
                    // Unraid's responsive base lays out dd children as a column on desktop.
                    await page.addStyleTag({ content: nativeSwitchCss + '@media(min-width:769px){dd{display:flex;flex-direction:column;gap:.5rem}}' });
                    await page.addScriptTag({ content: nativeSwitchSource });
                    const names = type === 'docker' ? [...commonToggles, 'update_column'] : commonToggles;
                    await page.evaluate(names => {
                        $('input.basic-switch').switchButton({ labels_placement: 'right', off_label: 'Off', on_label: 'On' });
                        settingsFixture.form.querySelector('.fv-section-nav > button[data-target="advanced"]').click();
                        const form = settingsFixture.form;
                        window.advancedLayoutFixture = { names, refs: Object.fromEntries(names.map(name => {
                            const input = form.elements.namedItem(name), widget = $(input).data('fixture-native-switch');
                            return [name, { input, widget, track: widget.button_bg[0] }];
                        })) };
                    }, names);
                    for (const name of ['folderviewplus.ui', 'folder.editor.help']) await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/${name}.js` });
                    const context = `${type}/${colorScheme}/${width}`;
                    const initial = await page.evaluate(readAdvancedLayout);
                    assert.deepEqual(initial.rows.map(row => [row.name, row.checked]), names.map(name => [name, false]));
                    assertAdvancedLayout(initial, width, `${context}/native/off`);
                    assert.equal(await page.locator('[name="update_column"]').evaluate(input => input.closest('.basic').getBoundingClientRect().height > 0), type === 'docker');
                    // Synthetic larger host geometry and longer labels, independent of an Aurora skin.
                    await page.addStyleTag({ content: '.switch-button-background{width:44px!important;height:24px!important}.switch-button-label{line-height:26px}' });
                    await page.evaluate(() => {
                        for (const { widget } of Object.values(advancedLayoutFixture.refs)) {
                            widget.off_label.text('Deaktiviert'); widget.on_label.text('Eingeschaltet'); widget.button_bg[0].click();
                        }
                    });
                    const active = await page.evaluate(readAdvancedLayout);
                    assert.deepEqual(active.rows.map(row => row.checked), names.map(() => true), 'native widget clicks update every visible Advanced toggle');
                    assertAdvancedLayout(active, width, `${context}/large-host/on`);
                    await page.locator('[name="dashboard_overflow"]').selectOption('scroll');
                    const payload = await page.evaluate(() => settingsFixture.serialize());
                    for (const name of names) assert.equal(payload.settings[name], true, `${name}: serialized draft uses the toggled value`);
                    assert.equal(payload.settings.dashboard_overflow, 'scroll');
                    await page.evaluate(() => { FolderViewPlusRefreshModernEditorChromeLayout(); FolderViewPlusRefreshModernEditorChromeLayout(); });
                    assert.deepEqual(await page.evaluate(() => settingsFixture.serialize()), payload, 'layout refresh preserves every payload field');
                    assert.deepEqual(await page.evaluate(() => advancedLayoutFixture.names.map(name => {
                        const ref = advancedLayoutFixture.refs[name], input = settingsFixture.form.elements.namedItem(name), widget = $(input).data('fixture-native-switch');
                        return input === ref.input && widget === ref.widget && widget.button_bg[0] === ref.track
                            && input.closest('.basic').querySelectorAll('.switch-button-background').length === 1;
                    })), names.map(() => true), 'refresh retains original inputs, widget instances and handlers');
                    assertAdvancedLayout(await page.evaluate(readAdvancedLayout), width, `${context}/after-refresh`);
                    for (const name of names) {
                        const info = page.locator('.basic').filter({ has: page.locator(`[name="${name}"]`) }).locator('dt [data-fv-setting-info]');
                        assert.equal(await info.count(), 1); assert.equal(await info.isVisible(), true);
                    }
                    const info = page.locator('.basic').filter({ has: page.locator('[name="override_default_actions"]') }).locator('dt [data-fv-setting-info]');
                    if (width > 920) await info.hover(); else await info.focus();
                    await page.getByRole('tooltip').waitFor(); assert.match(await page.getByRole('tooltip').innerText(), /custom actions/i);
                    await page.keyboard.press('Escape');
                    await page.evaluate(() => { for (const { track } of Object.values(advancedLayoutFixture.refs)) track.click(); });
                    const inactive = await page.evaluate(readAdvancedLayout);
                    assert.deepEqual(inactive.rows.map(row => row.checked), names.map(() => false));
                    assertAdvancedLayout(inactive, width, `${context}/large-host/off`);
                    const inactivePayload = await page.evaluate(() => settingsFixture.serialize().settings);
                    for (const name of names) assert.equal(inactivePayload[name], false);
                    assert.equal(inactivePayload.dashboard_overflow, 'scroll', 'unrelated Dashboard selection remains intact');
                }
            }
        }
        assert.deepEqual(writes, [], 'Advanced toggles and layout changes send no persistence requests before Submit');
    } finally { page.off('request', watch); }
};
