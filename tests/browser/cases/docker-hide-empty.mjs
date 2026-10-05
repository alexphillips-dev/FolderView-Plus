import assert from 'node:assert/strict';
import { createDockerHideEmptyHost } from '../helpers/docker-hide-empty-host.mjs';

export const registerDockerHideEmptyCases = ({ test }) => {
    test('Docker hide-empty keeps populated ancestors through expansion, toggles and refresh', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        for (const deep of [false, true]) {
            const host = await createDockerHideEmptyHost(page, deep);
            const row = id => page.locator(`tr.folder-id-${id}`);
            const expectFolders = async expected => {
                await page.waitForFunction(expected => {
                    const ids = [...document.querySelectorAll('#docker_list > tr.folder')].map(node => node.dataset.fvFolderId).sort();
                    return JSON.stringify(ids) === JSON.stringify(expected.slice().sort())
                        && window.FolderViewPlusRuntimePerformanceTelemetry?.getSnapshot('docker')?.milestones?.foldersGrouped?.count > 0;
                }, expected);
                await page.waitForLoadState('networkidle');
                assert.deepEqual((await page.locator('#docker_list > tr.folder').evaluateAll(nodes => nodes.map(node => node.dataset.fvFolderId))).sort(), expected.slice().sort());
                assert.equal(await page.locator('#docker_containers tr[id^="ct-"]').count(), host.memberCount, 'native members are neither lost nor duplicated');
            };
            const tool = async name => {
                await page.waitForFunction(() => document.querySelector('#fvplus-docker-action-bar')?.getAttribute('aria-busy') === 'false'
                    && document.querySelector('[data-fvplus-docker-menu="tools"]')?.disabled === false);
                await page.locator('[data-fvplus-docker-menu="tools"]').press('ArrowDown');
                await page.locator(`[data-fvplus-docker-tool="${name}"]`).click();
            };
            const toggle = async expected => {
                await Promise.all([
                    page.waitForResponse(response => response.url().includes('/server/prefs.php') && response.request().method() === 'POST'),
                    tool('toggle-empty')
                ]);
                await expectFolders(expected);
            };
            try {
                await page.goto(host.url, { waitUntil: 'load' });
                await expectFolders(host.populated);
                assert.equal(await row('parent').isVisible(), true);
                assert.match(await row('parent').locator('.folder-state').textContent(), deep ? /1\/1/ : /29\/29/);
                const child = deep ? 'branch' : 'childA';
                assert.equal(await row(child).isVisible(), false, 'children initially stay collapsed under their retained parent');
                await page.locator('.dropDown-parent').focus();
                assert.equal(await page.locator('.dropDown-parent').evaluate(node => node === document.activeElement), true);
                await page.keyboard.press('Enter');
                await row(child).waitFor({ state: 'visible' });
                assert.equal(await row(child).isVisible(), true);
                if (deep) {
                    await page.locator('.dropDown-branch').click();
                    await row('leaf').waitFor({ state: 'visible' });
                    assert.equal(await row('leaf').isVisible(), true, 'a regex-only grandchild keeps both ancestors');
                }
                await page.locator('.dropDown-parent').click();
                await row(child).waitFor({ state: 'hidden' });
                assert.equal(await row(child).isVisible(), false);
                await toggle(host.all);
                assert.equal(host.prefs().hideEmptyFolders, false);
                await toggle(host.populated);
                assert.equal(host.prefs().hideEmptyFolders, true);
                const before = await row('parent').elementHandle();
                await page.evaluate(() => window.loadlist());
                await page.waitForFunction(node => !node.isConnected, before);
                await expectFolders(host.populated);
                await page.waitForLoadState('networkidle');
                await page.reload({ waitUntil: 'load' });
                await expectFolders(host.populated);
                await page.locator('.dropDown-parent').click();
                await row(child).waitFor({ state: 'visible' });
                assert.equal(await row(child).isVisible(), true, 'expansion still works after reload');
                assert.equal(await row('empty').count(), 0, 'an entirely empty branch stays hidden');
                assert.equal(await row('emptyChild').count(), 0);
            } finally {
                await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
                await page.waitForLoadState('networkidle');
                await page.goto('about:blank');
                await page.unrouteAll({ behavior: 'wait' });
                await host.close();
            }
        }
    }, { skipAccessibility: true }); // Synthetic host omits Unraid's surrounding accessibility markup.
};
