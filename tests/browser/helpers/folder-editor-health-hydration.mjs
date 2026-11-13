import assert from 'node:assert/strict';
import fs from 'node:fs';

const plugin = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus';
const markup = fs.readFileSync(`${plugin}/Folder.page`, 'utf8').match(/<form\b[\s\S]*?<\/form>/)[0].replace(/<\?php[\s\S]*?\?>/g, '');
const fields = ['health_warn_stopped_percent', 'health_critical_stopped_percent', 'health_profile', 'health_updates_mode', 'health_all_stopped_mode'];

export const verifyFolderEditorHealthHydration = async (page, baseUrl) => {
    await page.route('**/plugins/dynamix.docker.manager/images/question.png', route => route.fulfill({ path: `${plugin}/images/folder-icon.png` }));
    for (const [colorScheme, width] of [['dark', 1440], ['light', 390]]) {
        await page.emulateMedia({ colorScheme }); await page.setViewportSize({ width, height: 844 });
        for (const type of ['docker', 'vm']) {
            const url = `${baseUrl}/editor-health-hydration`;
            await page.route(url, route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Folder health editor</title>${['theme.tokens', 'csp.utilities', 'folder', 'ui.primitives', 'ui.host-buttons'].map(name => `<link rel="stylesheet" href="/plugin/styles/${name}.css">`).join('')}</head><body><main><h1>Folder editor</h1><div class="canvas">${markup}</div></main><script src="/vendor/jquery.js"></script></body></html>` }));
            await page.goto(url);
            await page.evaluate(type => {
                window.FolderViewPlusFolderEditorPageType = type;
                document.documentElement.style.fontSize = '10px';
                document.documentElement.dataset.fvplusHostTheme = matchMedia('(prefers-color-scheme: light)').matches ? 'white' : 'black';
                document.body.style.cssText = 'background:var(--fvplus-ui-page);color:var(--fvplus-ui-text-primary);font:14px Arial,sans-serif;margin:16px';
                // An intentional hide on a row collected immediately must not be cleared globally.
                document.querySelector('[name="name"]').closest('.basic').style.display = 'none';
            }, type);
            // Production starts chrome/help before the type-specific row collector is available.
            for (const name of ['folderviewplus.folder-contract', 'folder.editor.shared', 'folder.editor.schema', 'folder.editor.chrome', 'folderviewplus.ui', 'folder.editor.help']) await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/${name}.js` });
            assert.equal(await page.locator('.fv-editor-panel[data-editor-panel="health"]').count(), 0, 'early chrome has no type-specific Health panel');
            for (const name of fields) {
                assert.deepEqual(await page.locator(`[name="${name}"]`).evaluate(field => {
                    const row = field.closest('.basic');
                    return { orphan: row.classList.contains('fv-orphan-editor-row'), display: row.style.display };
                }), { orphan: true, display: 'none' }, `${type}: early Health row is an owned orphan`);
            }
            await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/folder.editor.type-${type}.js` });
            await page.evaluate(() => {
                FolderViewPlusRefreshModernEditorChromeLayout();
                document.querySelector('.fv-section-nav > button[data-target="status"]').click();
                FolderViewPlusRevealModernEditorStage({ force: true });
                document.querySelector('form').classList.remove('fv-modern-editor-booting');
            });
            const panel = page.locator('.fv-editor-panel[data-editor-panel="health"]');
            assert.equal(await page.locator('[name="name"]').evaluate(field => field.closest('.basic').style.display), 'none', 'intentional non-orphan hides survive decoration');
            if (type === 'vm') {
                assert.equal(await panel.count(), 0, 'VM has no empty Docker Health panel');
                for (const name of fields) assert.equal(await page.locator(`[name="${name}"]`).isHidden(), true, 'Docker-only Health remains hidden on VM');
            } else {
                assert.equal(await panel.isVisible(), true, 'late Docker collector shows the Health panel');
                for (const name of fields) {
                    const field = page.locator(`[name="${name}"]`);
                    assert.equal(await field.isVisible(), true, `${name}: recovered Docker Health field is visible`);
                    assert.equal(await field.evaluate(node => node.closest('.basic').classList.contains('fv-orphan-editor-row')), false);
                    const info = panel.locator('.basic').filter({ has: field }).locator('[data-fv-setting-info]');
                    assert.equal(await info.count(), 1, `${name}: existing help is retained exactly once`);
                    await info.hover(); await page.getByRole('tooltip').waitFor();
                    assert.ok((await page.getByRole('tooltip').textContent()).trim().length > 30, `${name}: hover exposes explanatory help`);
                    await page.keyboard.press('Escape'); await page.getByRole('tooltip').waitFor({ state: 'detached' });
                }
                await page.locator('[name="health_warn_stopped_percent"]').fill('25');
                await page.locator('[name="health_critical_stopped_percent"]').fill('70');
                await page.locator('[name="health_profile"]').selectOption('balanced');
                await page.locator('[name="health_updates_mode"]').selectOption('ignore');
                await page.locator('[name="health_all_stopped_mode"]').selectOption('warn');
            }
            for (let iteration = 0; iteration < 3; iteration++) {
                await page.evaluate(() => FolderViewPlusRefreshModernEditorChromeLayout());
                assert.equal(await panel.count(), type === 'docker' ? 1 : 0, 'repeated refresh preserves panel ownership');
                for (const name of fields) assert.equal(await page.locator(`[name="${name}"]`).count(), 1, 'refresh never duplicates fields');
                if (type === 'docker') {
                    assert.deepEqual(await page.evaluate(names => names.map(name => document.querySelector(`[name="${name}"]`).value), fields), ['25', '70', 'balanced', 'ignore', 'warn']);
                    assert.equal(await panel.locator('[data-fv-setting-info]').count(), 5);
                    for (const name of fields) assert.equal(await page.locator(`[name="${name}"]`).isVisible(), true, 'recovered fields remain visible');
                }
            }
            await page.unroute(url);
        }
    }
};
