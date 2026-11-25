import assert from 'node:assert/strict';

export const registerSettingsGlobalExclusionCase = ({test, withRulesFixture}) => {
    test('Rules Settings saves and edits a global exclusion without assigning the first folder', async ({page}) => {
        await withRulesFixture(page, async state => {
            const panel = page.locator('.fv-rules-workspace[data-fv-rules-type="docker"]');
            const submit = panel.locator('.rules-add-btn');
            const folder = page.locator('#docker-rule-folder');
            const pattern = page.locator('#docker-rule-pattern');
            await folder.selectOption('');
            await pattern.fill('global-fixture');
            assert.equal(await submit.isDisabled(), true, 'an include still requires a folder');
            await panel.locator('[data-rule-choice="effect"][data-rule-value="exclude"]').click();
            await submit.click();
            await page.waitForFunction(() => document.getElementById('docker-rule-pattern').value === '');
            const saved = state.saved.docker.autoRules.find(rule => rule.pattern === 'global-fixture');
            assert.equal(saved.folderId, '');
            assert.equal(saved.effect, 'exclude');
            const row = panel.locator(`[data-fv-rule-id="${saved.id}"]`);
            assert.match(await row.innerText(), /All folders/);
            assert.equal(await row.locator('.fv-rule-problems').count(), 0);
            await row.locator('[data-rule-menu]').click();
            await page.locator('[data-rule-menu-action="edit"]').click();
            await page.evaluate(() => renderFolderSelectOptions('docker'));
            assert.equal(await folder.inputValue(), '');
            await pattern.fill('updated-global-fixture');
            await submit.click();
            await page.waitForFunction(() => document.getElementById('docker-rule-editing').value === '');
            const edited = state.saved.docker.autoRules.find(rule => rule.id === saved.id);
            assert.equal(edited.folderId, '');
            assert.equal(edited.pattern, 'updated-global-fixture');
        });
    });
};
