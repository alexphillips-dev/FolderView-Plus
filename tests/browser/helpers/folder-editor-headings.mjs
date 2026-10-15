import assert from 'node:assert/strict';
export const checkFolderHeadings = async (page, baseUrl, type) => {
    await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/folder.editor.rules.js` });
    await page.evaluate(async () => {
        settingsFixture.headingRules = FolderViewPlusFolderEditorRules.createApi({});
        await settingsFixture.headingRules.refresh();
        document.querySelector('#fvFolderMembersSection').hidden = false;
    });
    await page.locator('[data-editor-panel="auto-rules"] h4 [data-fv-setting-info]').waitFor({ state: 'attached' });
    const panels = page.locator('.fv-editor-panel[data-fv-heading-label]');
    const keys = await panels.evaluateAll(nodes => nodes.map(node => node.dataset.editorPanel).sort());
    assert.deepEqual(keys, ['auto-rules', 'color', 'folder-actions', 'folder-members', 'icon', 'parent', 'status-colors', 'style', ...(type === 'docker' ? ['webui-profiles'] : [])].sort());
    for (const panel of await panels.all()) {
        const section = await panel.getAttribute('data-editor-panel-section');
        await page.locator(`.fv-section-nav > button[data-target="${section}"]`).click();
        const heading = panel.locator('.fv-editor-panel-head h4'), info = heading.locator('[data-fv-setting-info]');
        const row = panel.locator('.fv-editor-panel-body > .basic').first();
        assert.equal(await row.locator(':scope > dl > dt').isHidden(), true, await panel.getAttribute('data-editor-panel'));
        assert.equal(await info.count(), 1);
        assert.equal(await row.locator('[data-fv-setting-info]').count(), 0);
        assert.equal(await info.getAttribute('data-fv-setting-info'), await row.locator('.fv-setting-help').getAttribute('id'));
        await info.hover(); const tooltip = page.getByRole('tooltip'); await tooltip.waitFor();
        const label = await heading.locator('.fv-setting-label').textContent();
        assert.equal(await info.getAttribute('aria-label'), `Information about ${label}`);
        const text = await row.locator('.fv-setting-help').textContent();
        assert.equal((await tooltip.innerText()).replace(/\s+/g, ' ').trim(), text.replace(/\s+/g, ' ').trim());
        const geometry = await heading.evaluate(node => {
            const label = node.querySelector('.fv-setting-label').getBoundingClientRect(), info = node.querySelector('button').getBoundingClientRect();
            return { gap: info.left - label.right, centered: Math.abs(info.y + info.height / 2 - label.y - label.height / 2) < 1 };
        });
        assert.ok(geometry.gap >= 0 && geometry.gap <= 8 && geometry.centered);
        await page.keyboard.press('Escape');
    }
    await page.locator('.fv-section-nav > button[data-target="general"]').click();
    assert.equal(await page.getByRole('combobox', { name: 'Parent Folder', exact: true }).count(), 1);
    await page.locator('.fv-section-nav > button[data-target="status"]').click();
    assert.equal(await page.locator('[name="status_color_lock"]').locator('xpath=ancestor::div[contains(@class,"basic")][1]').locator('dt [data-fv-setting-info]').isVisible(), true);
    await page.locator('.fv-section-nav > button[data-target="rules"]').click();
    const ruleInfo = page.locator('[data-editor-panel="auto-rules"] h4 [data-fv-setting-info]');
    await ruleInfo.focus(); await page.getByRole('tooltip').waitFor();
    const oldId = await ruleInfo.getAttribute('data-fv-setting-info');
    await page.evaluate(async () => { await settingsFixture.headingRules.refresh(); FolderViewPlusRefreshModernEditorChromeLayout(); });
    await page.waitForFunction(oldId => {
        const buttons = document.querySelectorAll('[data-editor-panel="auto-rules"] h4 [data-fv-setting-info]');
        return buttons.length === 1 && buttons[0].dataset.fvSettingInfo !== oldId;
    }, oldId);
    assert.equal(await page.getByRole('tooltip').count(), 0);
    await ruleInfo.focus(); await page.getByRole('tooltip').waitFor();
    assert.match(await page.getByRole('tooltip').innerText(), /global priority/);
    await page.keyboard.press('Escape');
    await page.locator('.fv-section-nav > button[data-target="general"]').click();
    const parentLabel = page.locator('[data-editor-panel="parent"] h4 .fv-setting-label');
    await parentLabel.evaluate(node => { node.textContent = 'Übergeordneter Ordner'; document.documentElement.dir = 'rtl'; });
    const parentInfo = page.locator('[data-editor-panel="parent"] h4 button');
    await parentInfo.focus(); await page.getByRole('tooltip').waitFor();
    assert.match(await parentInfo.getAttribute('aria-label'), /Übergeordneter Ordner/);
    await page.keyboard.press('Escape');
    await parentLabel.evaluate(node => { node.textContent = 'Parent Folder'; document.documentElement.dir = 'ltr'; });
};
