import assert from 'node:assert/strict';
import fs from 'node:fs';

const settingsJs = fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js', 'utf8');
const overflowGuardSource = settingsJs.match(/const enforceNoHorizontalOverflow = \(\) => \{[\s\S]*?\n\};/)?.[0];

export const registerSettingsOverflowGuardCase = ({ test }) => {
    test('Settings overflow guard leaves positioned host content visible', async ({ page }) => {
        assert.ok(overflowGuardSource, 'Settings overflow guard source must be available');
        await page.setContent(`
            <style>
                html, body { margin: 0; }
                .canvas { position: relative; height: 150px; }
                .content.shift { position: absolute; top: 150px; left: 0; width: 700px; height: 400px; }
                #fv-settings-root { height: 400px; background: orange; }
            </style>
            <div class="canvas"><div id="content" class="content shift">
                <main id="fv-settings-root">Settings content<div class="folder-table"><div class="table-wrap">Folders</div></div></main>
            </div></div>`);
        const getVisibleContent = () => page.evaluate(() => document.elementFromPoint(20, 200)?.closest('#fv-settings-root')?.id || '');
        assert.equal(await getVisibleContent(), 'fv-settings-root');
        await page.evaluate(() => {
            for (const target of [document.documentElement, document.body, document.querySelector('.canvas'), document.querySelector('#content')]) {
                target.style.setProperty('overflow-x', 'hidden', 'important');
            }
        });
        assert.equal(await getVisibleContent(), '', 'host overflow writes must reproduce the clipped page');
        await page.evaluate(() => {
            for (const target of [document.documentElement, document.body, document.querySelector('.canvas'), document.querySelector('#content')]) {
                target.style.removeProperty('overflow-x');
            }
        });
        await page.evaluate((source) => {
            const setImportantStyle = (element, property, value) => element.style.setProperty(property, value, 'important');
            const shouldUseCompactMobileLayout = () => false;
            const guard = new Function('setImportantStyle', 'shouldUseCompactMobileLayout', `${source}; return enforceNoHorizontalOverflow;`)(setImportantStyle, shouldUseCompactMobileLayout);
            guard();
        }, overflowGuardSource);
        assert.equal(await getVisibleContent(), 'fv-settings-root', 'Settings content must remain reachable after the guard runs');
        const styles = await page.evaluate(() => ({
            hostOverflow: [document.documentElement, document.body, document.querySelector('.canvas'), document.querySelector('#content')]
                .map((target) => target.style.getPropertyValue('overflow-x')),
            tableOverflow: document.querySelector('.folder-table .table-wrap').style.getPropertyValue('overflow-x')
        }));
        assert.deepEqual(styles.hostOverflow, ['', '', '', '']);
        assert.equal(styles.tableOverflow, 'auto');
    }, { skipAccessibility: true });
};
