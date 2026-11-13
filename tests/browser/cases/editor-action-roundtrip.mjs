import assert from 'node:assert/strict';
import path from 'node:path';
import { mountActionSettings } from '../helpers/folder-action-settings-host.mjs';

export const registerEditorActionRoundtripCases = ({ test }) => {
    const mount = async page => {
        await page.setContent('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Folder action fixture</title></head><body><div class="custom-action-wrapper"></div></body></html>');
        for (const style of ['theme.tokens.css', 'ui.primitives.css', 'ui.host-buttons.css', 'csp.utilities.css', 'folder.css']) {
            await page.addStyleTag({ path: path.resolve(`src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/styles/${style}`) });
        }
        await page.evaluate(() => {
            document.documentElement.dataset.fvplusHostTheme = matchMedia('(prefers-color-scheme: light)').matches ? 'white' : 'black';
            document.documentElement.style.fontSize = '10px';
            document.body.style.cssText = 'background:var(--fvplus-ui-page);color:var(--fvplus-ui-text-primary);font:14px Arial,sans-serif;margin:16px';
        });
        await page.addScriptTag({ path: path.resolve('node_modules/jquery/dist/jquery.js') });
        await page.addScriptTag({ path: path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.editor.shared.js') });
        await mountActionSettings(page);
        await page.evaluate(() => {
            window.saveFixtureAction = (name, index) => {
                actionSettingsFixture.open(index);
                const dialog = $('.dialogCustomAction');
                dialog.find('[data-action-type="1"]').trigger('click');
                dialog.find('[name="action_name"]').val(name).trigger('input');
                dialog.find('[name="action_script"]').val('Fixture script').trigger('input');
                dialog.closest('.ui-dialog').find('.fv-action-dialog-primary').trigger('click');
            };
        });
    };

    test('Folder custom actions preserve Unicode when added, loaded and edited', async ({ page }) => {
        await mount(page);
        const result = await page.evaluate(() => {
            const name = '备份 🚀 <fixture>';
            try {
                saveFixtureAction(name);
                const saved = JSON.parse(atob($('input[name="custom_action[]"]').val()));
                actionSettingsFixture.hydrate([saved]);
                actionSettingsFixture.open(0);
                return { name: saved.name, loaded: $('.dialogCustomAction [name="action_name"]').val(), injected: document.querySelectorAll('fixture').length };
            } catch (error) { return { error: error.message }; }
        });
        assert.equal(result.error, undefined);
        assert.equal(result.name, '备份 🚀 <fixture>');
        assert.equal(result.loaded, result.name);
        assert.equal(result.injected, 0);
    });

    test('Folder custom action identities survive deleting and adding neighboring rows', async ({ page }) => {
        await mount(page);
        const result = await page.evaluate(() => {
            try {
                saveFixtureAction('First'); saveFixtureAction('Second'); saveFixtureAction('Third');
                actionSettingsFixture.remove(0);
                saveFixtureAction('Second edited', 1);
                saveFixtureAction('Fourth');
                const rows = $('.custom-action-wrapper > div').get();
                return { names: rows.map(row => JSON.parse(atob($(row).find('input').val())).name), ids: rows.map(row => row.className) };
            } catch (error) { return { error: error.message }; }
        });
        assert.equal(result.error, undefined);
        assert.deepEqual(result.names, ['Second edited', 'Third', 'Fourth']);
        assert.equal(new Set(result.ids).size, 3);
    });

    test('Editing a loaded custom action updates its displayed name', async ({ page }) => {
        await mount(page);
        const result = await page.evaluate(() => {
            actionSettingsFixture.hydrate([{ name: 'Old name', type: 1, script: 'Fixture script' }]);
            saveFixtureAction('New name', 0);
            return $('.custom-action-n-0').text().trim();
        });
        assert.equal(result, 'New name');
    });
};
