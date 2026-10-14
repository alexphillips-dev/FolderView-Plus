import fs from 'node:fs';
import assert from 'node:assert/strict';
import { mountSettingsEditor } from '../helpers/folder-editor-settings-host.mjs';
import { checkFolderHelpTouch } from '../helpers/folder-editor-help-touch.mjs';
const plugin = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus';
export const registerFolderEditorHelpCases = ({ test, baseUrl }) => {
    test('Folder editor info icons replace expanding help across settings and remain accessible while disabled', async ({ page }) => {
        for (const type of ['docker', 'vm']) {
            await mountSettingsEditor(page, baseUrl, type);
            for (const style of ['ui.primitives', 'ui.host-buttons']) await page.addStyleTag({ url: `${baseUrl}/plugin/styles/${style}.css` });
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
