import assert from 'node:assert/strict';
import fs from 'node:fs';

const headingSource = fs.readFileSync(new URL('../fixtures/vendor/aurora-heading.js', import.meta.url), 'utf8');
export const verifySettingsHostHeading = async page => {
    const viewport = page.viewportSize();
    await page.evaluate(() => {
        const root = document.getElementById('fv-settings-root');
        root.before(Object.assign(document.createElement('span'), { id: 'fixture-heading-return' }));
        const box = document.createElement('div'); box.id = 'displaybox';
        // Unraid7.3 MainContentTabless.php and tab_title(): title, panels/assets, page content.
        box.innerHTML = '<div class="content"><div class="title" id="fixture-previous-title"><span class="left">Other section</span></div><p>Other section content</p><div class="title" id="fixture-settings-native-title"><span class="left"><i class="fa fa-th title"></i>FolderView Plus</span><span class="right"></span></div><link rel="stylesheet" href="data:text/css,"></div>';
        document.body.append(box); box.firstElementChild.append(root);
    });
    await page.addScriptTag({ content: headingSource });
    try {
        for (const width of [1180, 390]) {
            await page.setViewportSize({ width, height: 720 });
            assert.equal(await page.locator('.fv-settings-title').isVisible(), true);
            assert.equal(await page.locator('#fixture-settings-native-title').isHidden(), true);
            assert.equal(await page.locator('#fixture-previous-title').isVisible(), true);
            await page.evaluate(() => {
                const info = { tab: 'Settings', subPage: 'FolderView Plus' };
                window.fixtureAuroraPageHeading(info); window.fixtureAuroraPageHeading(info);
            });
            assert.equal(await page.locator('#displaybox > .tp-heading').count(), 1);
            assert.equal(await page.locator('#displaybox > .tp-heading').isHidden(), true);
            assert.equal(await page.locator('.fv-settings-title:visible, #displaybox > .tp-heading h1:visible, #fixture-settings-native-title > .left:visible').count(), 1);
            await page.evaluate(() => {
                const button = document.createElement('button'); button.id = 'fixture-native-header-action'; button.textContent = 'Native help';
                button.onclick = () => { window.fixtureNativeHelpClicks = (window.fixtureNativeHelpClicks || 0) + 1; };
                document.querySelector('#fixture-settings-native-title > .right').append(button);
                const tabs = document.createElement('nav'); tabs.className = 'tabs'; tabs.id = 'fixture-native-tabs';
                tabs.innerHTML = '<div class="tabs-container"><button role="tab">Settings</button><button role="tab">Other panel</button></div>';
                document.getElementById('displaybox').append(tabs);
            });
            assert.equal(await page.locator('#fixture-settings-native-title > .left').isHidden(), true);
            await page.locator('#fixture-native-header-action').click();
            assert.ok(await page.evaluate(() => window.fixtureNativeHelpClicks > 0));
            assert.equal(await page.locator('#fixture-native-tabs').getByRole('tab').count(), 2);
            assert.equal(await page.locator('#fixture-native-tabs').getByRole('tab').last().isVisible(), true);
            await page.evaluate(() => {
                const button = document.createElement('button'); button.id = 'fixture-theme-header-action'; button.textContent = 'Theme action';
                document.querySelector('#displaybox > .tp-heading').append(button);
            });
            assert.equal(await page.locator('#fixture-theme-header-action').isVisible(), true);
            assert.equal(await page.locator('#displaybox > .tp-heading > .tp-heading-text').isHidden(), true);
            await page.evaluate(() => {
                const root = document.getElementById('fv-settings-root'); document.getElementById('fixture-heading-return').after(root);
            });
            assert.equal(await page.locator('#fixture-settings-native-title > .left').isVisible(), true);
            assert.equal(await page.locator('#displaybox > .tp-heading h1').isVisible(), true);
            await page.evaluate(() => {
                const box = document.getElementById('displaybox'); box.querySelector('.content').append(document.getElementById('fv-settings-root'));
                box.querySelector('.tp-heading').remove(); box.querySelector('#fixture-native-tabs').remove(); box.querySelector('#fixture-native-header-action').remove();
            });
            assert.equal(await page.locator('.fv-settings-title').isVisible(), true);
            assert.equal(await page.locator('#fixture-settings-native-title').isHidden(), true);
        }
    } finally {
        await page.evaluate(() => {
            document.getElementById('fixture-heading-return').replaceWith(document.getElementById('fv-settings-root'));
            document.getElementById('displaybox').remove();
        });
        await page.setViewportSize(viewport);
    }
};
