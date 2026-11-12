import assert from 'node:assert/strict';
import fs from 'node:fs';
const editor = fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js', 'utf8');
const binding = editor.slice(editor.indexOf('const folderThemeSurfaceBinding ='), editor.indexOf('const utils = window.FolderViewPlusUtils'));

export const verifyAuroraEditorHeading = async (page, baseUrl) => {
    await page.route('**/plugins/Aurora-Theme/styles/theme.css', route => route.fulfill({ contentType: 'text/css', body: '.tp-heading{display:block}' }));
    await page.route('**/plugins/neoraid/sheets/Neoraid.css', route => route.fulfill({ contentType: 'text/css', body: 'body{--fixture-neoraid:1}' }));
    const url = `${baseUrl}/editor-aurora-heading`;
    for (const [colorScheme, viewport] of [['dark', { width: 1180, height: 720 }], ['light', { width: 390, height: 844 }]]) {
        await page.emulateMedia({ colorScheme }); await page.setViewportSize(viewport);
        for (const theme of ['aurora', 'native', 'neoraid']) {
            const link = theme === 'aurora' ? '/plugins/Aurora-Theme/styles/theme.css' : theme === 'neoraid' ? '/plugins/neoraid/sheets/Neoraid.css' : '';
            await page.route(url, route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Folder editor header</title><meta name="fvplus-runtime-context" content='{"page":"Folder Editor"}'>${link ? `<link id="fixture-host-theme" rel="stylesheet" href="${link}">` : ''}<link rel="stylesheet" href="/plugin/styles/folder.header.css"><script src="/plugin/scripts/folderviewplus.theme-integration.js"></script><script src="/plugin/scripts/folderviewplus.page-bootstrap.js"></script></head><body><main id="displaybox"><div class="tp-heading"><p>Docker</p><h1>Folder</h1></div><div class="canvas"><h2 id="native-editor-title">Folder editor</h2><form class="folder-editor-form"><button>Save</button></form></div></main></body></html>` }));
            await page.goto(url);
            const heading = page.locator('#displaybox > .tp-heading');
            assert.equal(await heading.isHidden(), theme === 'aurora', `${theme}: early editor heading visibility`);
            assert.equal(await page.locator('#native-editor-title').isVisible(), true, 'native editor title is retained');
            const displays = await page.evaluate(async () => {
                const current = document.querySelector('#displaybox > .tp-heading'); current.replaceWith(current.cloneNode(true));
                const values = []; for (let i = 0; i < 3; i++) { await new Promise(requestAnimationFrame); values.push(getComputedStyle(document.querySelector('.tp-heading')).display); }
                return values;
            });
            assert.equal(displays.every(display => (display === 'none') === (theme === 'aurora')), true, 'late heading stays scoped before sampled paints');
            await page.evaluate(binding => {
                window.fixtureEditorThemeBinding = new Function('bindFolderThemeAwareSurface', `${binding}; return folderThemeSurfaceBinding;`)(options =>
                    FolderViewPlusFoundationModules.themeIntegration.createBinding({ ...options, document, window, applyResolvedThemeTokens: () => null }));
                window.fixtureEditorThemeBinding.bind();
                document.getElementById('fixture-host-theme')?.remove();
            }, binding);
            if (theme === 'aurora') await heading.waitFor({ state: 'visible' });
            assert.equal(await heading.isVisible(), true, 'heading restores without Aurora');
            await page.evaluate(() => {
                const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '/plugins/Aurora-Theme/styles/theme.css'; document.head.append(link);
            });
            await heading.waitFor({ state: 'hidden' });
            assert.equal(await page.locator('#native-editor-title').isVisible(), true, 'native title survives live Aurora change');
            await page.evaluate(() => window.fixtureEditorThemeBinding.disconnect());
            await page.unroute(url);
        }
    }
};
