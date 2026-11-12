import assert from 'node:assert/strict';
import fs from 'node:fs';

// Aurora enhance.css: the FolderView status rule subtracts an extra icon allowance.
const auroraStatusCss = '.tp-fvplus :is(#docker_list,#kvm_list) tr.folder .folder-inner > .folder-state{max-width:calc(100% - 1.8rem);overflow:hidden;text-overflow:ellipsis;vertical-align:bottom}';
const readStatusBoxes = page => page.evaluate(() => [...document.querySelectorAll('#docker_list > tr.folder')].map(row => {
    const status = row.querySelector('.folder-state'), outer = row.querySelector('.folder-outer');
    const bounds = status.getBoundingClientRect(), box = outer.getBoundingClientRect(), dropdown = row.querySelector('.folder-dropdown').getBoundingClientRect();
    return { text: status.textContent, width: status.clientWidth, content: status.scrollWidth,
        left: bounds.left, right: bounds.right, outerLeft: box.left, outerRight: box.right, dropdownLeft: dropdown.left };
}));

export const verifyDockerFolderStatusWidth = async (page, hostUrl) => {
    for (const [colorScheme, viewport] of [['dark', { width: 1180, height: 720 }], ['light', { width: 390, height: 844 }]]) {
        await page.emulateMedia({ colorScheme }); await page.setViewportSize(viewport);
        await page.goto(`${hostUrl}/docker`);
        await page.waitForFunction(() => document.querySelector('tr.folder .folder-state')?.textContent.includes('/'));
        await page.addStyleTag({ content: auroraStatusCss });
        await page.addStyleTag({ content: fs.readFileSync(new URL('../fixtures/vendor/neoraid.css', import.meta.url), 'utf8') });
        for (const theme of ['native', 'neoraid', 'aurora']) {
            await page.evaluate(theme => {
                document.documentElement.classList.toggle('tp-fvplus', theme === 'aurora');
                document.documentElement.classList.toggle('nr', theme === 'neoraid');
                for (const [index, row] of [...document.querySelectorAll('tr.folder')].entries()) {
                    row.querySelector('.folder-appname').textContent = index ? 'Apps' : 'Dependencies';
                }
            }, theme);
            await page.evaluate(() => document.fonts.ready);
            await page.waitForTimeout(400);
            for (const label of ['3/4 Running', '1/1 stopped', '2/4 paused']) {
                await page.locator('tr.folder .folder-state').evaluateAll((nodes, label) => nodes.forEach(node => { node.textContent = label; }), label);
                for (const status of await readStatusBoxes(page)) {
                    assert.equal(status.text, label);
                    assert.ok(status.width + 1 >= status.content, `${theme}/${viewport.width}: ${label} must be complete`);
                    assert.ok(status.left >= status.outerLeft - 1 && status.right <= status.outerRight + 1, `${theme}: status stays inside the folder block ${JSON.stringify(status)}`);
                    assert.ok(status.right < status.dropdownLeft, 'status does not cover the dropdown');
                }
            }
        }
        await page.locator('tr.folder .folder-state').evaluateAll(nodes => nodes.forEach(node => { node.textContent = '3/4 Running'; }));
        const negative = await page.evaluate(() => {
            const sheet = [...document.styleSheets].find(sheet => sheet.href?.includes('/styles/docker.css'));
            const rule = [...sheet.cssRules].find(rule => rule.selectorText?.includes('td.folder-name .folder-inner > span.folder-state'));
            const value = rule.style.getPropertyValue('max-width'); rule.style.removeProperty('max-width');
            const clipped = [...document.querySelectorAll('tr.folder .folder-state')].some(node => node.scrollWidth > node.clientWidth + 1);
            rule.style.setProperty('max-width', value); return clipped;
        });
        assert.equal(negative, true, 'removing the correction reproduces Aurora truncation');
        await page.evaluate(() => {
            for (const row of document.querySelectorAll('tr.folder')) {
                row.querySelector('.folder-appname').textContent = 'A very long folder title that must still truncate safely '.repeat(8);
                row.querySelector('.folder-state').textContent = '123/456 Sehr lange übersetzte Statusbeschreibung';
            }
        });
        for (const status of await readStatusBoxes(page)) {
            assert.ok(status.right <= status.outerRight + 1, 'long translated status stays bounded');
            assert.ok(status.right < status.dropdownLeft, 'long translated status leaves the dropdown clear');
        }
        assert.equal(await page.locator('tr.folder .folder-appname').evaluateAll(nodes => nodes.every(node => node.scrollWidth > node.clientWidth)), true, 'long folder names still truncate');
    }
};
