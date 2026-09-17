import assert from 'node:assert/strict';

export const registerForumReportFixtureCases = ({ test, baseUrl }) => {
test('Dashboard card layouts fill the widget despite fixed-width host tiles', async ({ page }) => {
    await page.goto(`${baseUrl}/dashboard-layout`, { waitUntil: 'load' });
    await page.addStyleTag({ content: '.folder-showcase-outer { display: inline-block; width: 180px; } span.outer { width: 180px; display: inline-block; }' });
    for (const width of [1180, 390]) {
        await page.setViewportSize({ width, height: 900 });
        for (const layout of ['fullwidth', 'accordion', 'inset', 'embossed', 'compactmatrix']) {
            const geometry = await page.evaluate(({ layout, width }) => {
                const fixture = window.fixtureDashboardLayout;
                fixture.resize(width);
                fixture.state.layout = layout;
                fixture.controller.applyDashboardLayoutStateForType('docker');
                const host = document.querySelector('#fixture-dashboard-host');
                const cards = [...host.querySelectorAll(':scope > .folder-showcase-outer')];
                return { host: host.clientWidth, cards: cards.map((card) => ({ width: card.clientWidth, tile: card.querySelector(':scope > span.outer').clientWidth })), overflow: document.documentElement.scrollWidth > innerWidth };
            }, { layout, width });
            assert.equal(geometry.overflow, false, `${layout} at ${width}`);
            for (const card of geometry.cards) {
                assert.ok(card.tile >= card.width - 14, `${layout} card tile should fill its slot including inset padding`);
                if (layout !== 'compactmatrix') assert.ok(card.width >= geometry.host - 40, `${layout} should fill the widget`);
            }
        }
    }
});

test('Defaults editor hides folder identity and membership while retaining a keyboard-accessible save', async ({ page }) => {
    await page.goto(`${baseUrl}/folder-editor`, { waitUntil: 'load' });
    await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/folder.editor.defaults.js` });
    await page.evaluate(() => {
        const form = document.querySelector('#fvFolderEditorForm');
        form.innerHTML = '<div class="fv-modern-field-row"><label>Name<input name="name" required></label></div><div class="fv-editor-panel" data-editor-panel="parent"><label>Parent<select name="parent_folder_id"><option value="">None</option></select></label></div><nav class="fv-section-nav"><button type="button" data-target="members">Members</button></nav><section class="fv-section-shell" data-section-shell="members">Member choices</section><label>Icon<input name="icon" value="/icon.png"></label><input class="folder-btn-submit" type="submit" value="Submit" data-i18n="submit"><button class="folder-btn-copy" type="button">Save as copy</button>';
        window.FolderViewPlusFoundationModules.folderDefaults.configure({ $: window.jQuery, document, form,
            translate: (_key, fallback) => fallback, setValidationBannerState: () => {} });
    });
    assert.equal(await page.locator('[name="name"]').isVisible(), false);
    assert.equal(await page.locator('[name="name"]').getAttribute('required'), null);
    assert.equal(await page.getByRole('button', { name: 'Members', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Save as copy', exact: true }).count(), 0);
    const save = page.getByRole('button', { name: 'Save as defaults', exact: true });
    await save.focus();
    assert.equal(await save.evaluate((element) => element === document.activeElement), true);
    assert.equal(await page.locator('[name="icon"]').inputValue(), '/icon.png');
});
};
