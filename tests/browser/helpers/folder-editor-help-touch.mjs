import assert from 'node:assert/strict';
import { mountSettingsEditor } from './folder-editor-settings-host.mjs';
export const checkFolderHelpTouch = async (original, baseUrl) => {
    const context = await original.context().browser().newContext({ hasTouch: true, viewport: original.viewportSize(), colorScheme: await original.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'), reducedMotion: 'reduce' });
    try {
        const page = await context.newPage(); await mountSettingsEditor(page, baseUrl, 'docker');
        for (const style of ['ui.primitives', 'ui.host-buttons']) await page.addStyleTag({ url: `${baseUrl}/plugin/styles/${style}.css` });
        for (const name of ['folderviewplus.ui', 'folder.editor.help']) await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/${name}.js` });
        await page.locator('.fv-section-nav > button[data-target="preview"]').click();
        const row = page.locator('.basic').filter({ has: page.locator('[name="preview_text_width"]') }).last();
        const info = row.locator('[data-fv-setting-info]'), tooltip = page.getByRole('tooltip');
        const box = await info.boundingBox(); assert.ok(box.width >= 44 && box.height >= 44);
        const binding = await row.locator('.fv-setting-label').getAttribute('data-i18n');
        assert.equal(binding, 'preview-text-width');
        await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
        await row.evaluate(node => { node.querySelector('.fv-setting-label').textContent = 'Textbreite'; node.querySelector('.fv-setting-help').textContent = 'Begrenzt die Breite des Namens in der Vorschau.'; });
        await info.tap(); await tooltip.waitFor();
        assert.match(await info.getAttribute('aria-label'), /Textbreite/);
        assert.match(await tooltip.innerText(), /Begrenzt die Breite/);
        const bounds = await tooltip.boundingBox(), viewport = page.viewportSize();
        assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height + 1);
        await info.tap(); assert.equal(await tooltip.count(), 0);
        await info.tap(); await tooltip.waitFor(); await page.touchscreen.tap(2, 2);
        assert.equal(await tooltip.count(), 0);
    } finally { await context.close(); }
};
