import assert from 'node:assert/strict';
import fs from 'node:fs';

const settingsJs = fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js', 'utf8');
const visibilitySource = settingsJs.slice(settingsJs.indexOf('const isVisibleSettingsElement ='), settingsJs.indexOf('const recoverBlankSettingsSurface ='));

export const registerSettingsVisibilityCase = ({ test, baseUrl }) => {
    test('Settings visibility checks reject clipped content and a header-only page', async ({ page }) => {
        await page.clock.install();
        await page.setContent(`
            <style>
                html, body { margin: 0; }
                .canvas { position: relative; height: 150px; }
                .content.shift { position: absolute; top: 150px; left: 0; width: 700px; height: 400px; }
                #fv-settings-root { height: 400px; }
                .folder-table { height: 250px; background: orange; }
            </style>
            <div class="canvas"><div id="content" class="content shift">
                <main id="fv-settings-root"><div id="fv-settings-topbar"><button>Basic</button></div>
                    <div class="folder-table">Folders</div></main>
            </div></div>`);
        await page.evaluate(() => {
            window.FolderViewPlusFatalBanner = { reportFatalError: (_error, details) => {
                window.settingsBlankReport = details;
            } };
        });
        await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/folderviewplus.settings-watchdog.js` });
        await page.addScriptTag({ content: `${visibilitySource}\nwindow.hasVisibleSettingsSurfaceFixture = hasVisibleSettingsSurface;` });
        assert.equal(await page.evaluate(() => window.hasVisibleSettingsSurfaceFixture()), true);
        await page.evaluate(() => {
            for (const target of [document.documentElement, document.body, document.querySelector('.canvas'), document.querySelector('#content')]) {
                target.style.setProperty('overflow-x', 'hidden', 'important');
            }
        });
        assert.equal(await page.evaluate(() => window.hasVisibleSettingsSurfaceFixture()), false);
        await page.clock.fastForward(3600);
        assert.equal(await page.evaluate(() => window.settingsBlankReport?.code), 'FVPLUS-SET-BLANK-001');
        await page.evaluate(() => {
            for (const target of [document.documentElement, document.body, document.querySelector('.canvas'), document.querySelector('#content')]) {
                target.style.removeProperty('overflow-x');
            }
            document.querySelector('.folder-table').style.display = 'none';
        });
        assert.equal(await page.evaluate(() => window.hasVisibleSettingsSurfaceFixture()), false);
        await page.evaluate(() => {
            document.querySelector('.folder-table').style.display = '';
            document.querySelector('.content').style.position = 'static';
            document.querySelector('.canvas').style.height = 'auto';
        });
        assert.equal(await page.evaluate(() => window.hasVisibleSettingsSurfaceFixture()), true);
    }, { skipAccessibility: true });
};
