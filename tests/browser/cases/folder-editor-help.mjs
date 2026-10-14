import fs from 'node:fs';
import assert from 'node:assert/strict';
import { mountSettingsEditor } from '../helpers/folder-editor-settings-host.mjs';
import { checkFolderHelpTouch } from '../helpers/folder-editor-help-touch.mjs';
const plugin = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus';
const tooltipAppearance = element => {
    const luminance = color => {
        const channels = color.match(/[\d.]+/g).slice(0, 3).map(value => {
            const c = Number(value) / 255;
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const style = getComputedStyle(element), foreground = getComputedStyle(element.querySelector('.fv-setting-help-copy p')).color;
    const levels = [luminance(foreground), luminance(style.backgroundColor)].sort((a, b) => a - b);
    return { foreground, background: style.backgroundColor, contrast: (levels[1] + 0.05) / (levels[0] + 0.05) };
};
export const registerFolderEditorHelpCases = ({ test, baseUrl }) => {
    test('Folder editor info icons replace expanding help across settings and remain accessible while disabled', async ({ page }) => {
        for (const type of ['docker', 'vm']) {
            await mountSettingsEditor(page, baseUrl, type);
            for (const style of ['ui.primitives', 'ui.host-buttons']) await page.addStyleTag({ url: `${baseUrl}/plugin/styles/${style}.css` });
            // Host blockquote styling must not override the help's theme colors, even when loaded last.
            await page.addStyleTag({ content: 'body blockquote, body blockquote p { color: #222; }' });
            const catalog = JSON.parse(fs.readFileSync(`${plugin}/langs/en.json`, 'utf8'));
            const mismatches = await page.locator('.fv-setting-help [data-i18n], dt[data-i18n]').evaluateAll((nodes, catalog) => nodes.filter(node => {
                const key = node.dataset.i18n.replace(/^\[html\]/, '');
                return key in catalog && node.innerHTML.trim().replace(/\s+/g, ' ') !== catalog[key].replace(/\s+/g, ' ');
            }).map(node => node.dataset.i18n), catalog);
            assert.deepEqual(mismatches, [], 'English tooltips and labels must agree with their source fallbacks');
            for (const name of ['folderviewplus.ui', 'folder.editor.help']) await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/${name}.js` });
            assert.equal(await page.locator('.inline_help').count(), 0);
            const missing = await page.evaluate(() => Object.values(settingsFixture.schema.SECTION_FIELD_NAMES).flat().filter(name => {
                const row = settingsFixture.form.elements.namedItem(name)?.closest('.basic');
                return row?.closest('.fv-section-shell') && !row.querySelector('[data-fv-setting-info]') && !row.closest('.fv-editor-panel')?.querySelector('.fv-editor-panel-head [data-fv-setting-info]');
            }));
            assert.deepEqual(missing, []);
            await page.locator('.fv-section-nav > button[data-target="preview"]').click();
            await page.locator('[name="preview"]').selectOption('0');
            const row = page.locator('.basic').filter({ has: page.locator('[name="preview_grayscale"]') }).last();
            const info = row.locator('[data-fv-setting-info]');
            assert.equal(await info.isEnabled(), true);
            const before = await row.boundingBox();
            const saved = await page.evaluate(() => settingsFixture.serialize());
            await row.locator('dt').hover({ position: { x: 2, y: 2 } });
            assert.equal(await page.getByRole('tooltip').count(), 0);
            assert.equal(await row.locator('dt').evaluate(node => getComputedStyle(node).cursor), 'default');
            await info.hover();
            const tooltip = page.getByRole('tooltip'); await tooltip.waitFor();
            const appearance = await tooltip.evaluate(tooltipAppearance);
            assert.ok(appearance.contrast >= 4.5, `Tooltip contrast must meet 4.5:1: ${JSON.stringify(appearance)}`);
            const theme = await page.locator('html').getAttribute('data-fvplus-host-theme');
            await page.locator('html').evaluate(node => { node.dataset.fvplusHostTheme = node.dataset.fvplusHostTheme === 'white' ? 'black' : 'white'; });
            const switched = await tooltip.evaluate(tooltipAppearance);
            assert.ok(switched.contrast >= 4.5, `Changed theme must remain readable: ${JSON.stringify(switched)}`);
            assert.notEqual(switched.foreground, appearance.foreground);
            assert.notEqual(switched.background, appearance.background);
            await page.locator('html').evaluate((node, theme) => { node.dataset.fvplusHostTheme = theme; }, theme);
            assert.match(await tooltip.innerText(), /grayscal/i);
            assert.equal(await tooltip.evaluate(node => node.contains(document.activeElement)), false);
            assert.ok(Math.abs(await row.evaluate(node => node.getBoundingClientRect().height) - before.height) < 0.5);
            assert.equal(await info.locator('svg[data-fv-icon="info-circle"]').count(), 1);
            const rect = await tooltip.boundingBox(), viewport = page.viewportSize();
            assert.ok(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= viewport.width + 1 && rect.y + rect.height <= viewport.height + 1);
            await tooltip.hover(); await page.waitForTimeout(200);
            assert.equal(await tooltip.isVisible(), true);
            await page.keyboard.press('Escape'); assert.equal(await tooltip.count(), 0);
            await page.mouse.move(0, 0); await info.focus(); await tooltip.waitFor();
            assert.equal(await info.evaluate(node => node === document.activeElement), true);
            assert.equal(await info.getAttribute('aria-describedby'), await tooltip.getAttribute('id'));
            await page.keyboard.press('Escape'); assert.equal(await tooltip.count(), 0);
            await info.click(); await tooltip.waitFor(); await info.click(); assert.equal(await tooltip.count(), 0);
            assert.deepEqual(await page.evaluate(() => settingsFixture.serialize()), saved);
            const count = await page.locator('[data-fv-setting-info]').count();
            await page.evaluate(() => { dispatchEvent(new Event('pagehide')); dispatchEvent(new Event('pageshow')); dispatchEvent(new Event('pageshow')); });
            assert.equal(await page.locator('[data-fv-setting-info]').count(), count);
            await page.locator('[name="preview"]').focus(); await info.focus(); await tooltip.waitFor();
            await page.locator('.fv-section-nav > button[data-target="general"]').click();
            assert.equal(await tooltip.count(), 0);
            if (type === 'docker') {
                const help = fs.readFileSync(`${plugin}/scripts/folder.editor.rules.js`, 'utf8').match(/<blockquote class="fv-setting-help">[\s\S]*?<\/blockquote>/)[0];
                await page.evaluate(help => document.querySelector('.fv-section-shell[data-section-shell="general"] .fv-section-shell-body').insertAdjacentHTML('beforeend', `<div class="basic" id="dynamic-rule-help"><dl><dt>Auto-rules:</dt><dd>Rules</dd></dl>${help}</div>`), help);
                await page.locator('#dynamic-rule-help [data-fv-setting-info]').waitFor();
                await page.locator('#dynamic-rule-help [data-fv-setting-info]').focus(); await tooltip.waitFor();
                assert.match(await tooltip.innerText(), /global priority/);
                await page.evaluate(() => document.querySelector('#dynamic-rule-help').remove());
                await tooltip.waitFor({ state: 'detached' });
            }
            await page.locator('.fv-section-nav > button[data-target="status"]').click();
            await page.locator('[name="folder_accent_enabled"]').evaluate(field => { field.checked = false; field.dispatchEvent(new Event('change', { bubbles: true })); });
        }
        await checkFolderHelpTouch(page, baseUrl);
    });
};
