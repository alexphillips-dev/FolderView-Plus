import assert from 'node:assert/strict';
import { mountSettingsEditor } from './folder-editor-settings-host.mjs';

export const verifyNestedFolderMembers = async (page, baseUrl) => {
    for (const [colorScheme, viewport] of [['dark', { width: 1180, height: 720 }], ['light', { width: 390, height: 844 }]]) {
        await page.emulateMedia({ colorScheme }); await page.setViewportSize(viewport);
        for (const type of ['docker', 'vm']) {
            await mountSettingsEditor(page, baseUrl, type);
            await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/folder.editor.member-list.js` });
            await page.evaluate(() => {
                const icon = '/plugin/images/folder-icon.png';
                const folders = { root: { name: 'Root' },
                    first: { parentId: 'root', name: 'Alpha', icon, containers: [] },
                    second: { parentId: 'root', name: 'Long nested folder '.repeat(18), icon, containers: [] },
                    third: { parentId: 'root', name: 'Gamma', icon, containers: [] },
                    grandchild: { parentId: 'first', name: 'Grandchild', icon, containers: [] },
                    leafWithApps: { name: 'Leaf with apps', containers: ['fixture-app'] } };
                window.nestedMembersFixture = { active: 'root', dirty: 0, folders };
                nestedMembersFixture.api = FolderViewPlusFoundationModules.folderEditorMemberList.createApi({
                    window, $: window.$, getAllFolders: () => folders,
                    getActiveFolderId: () => nestedMembersFixture.active,
                    escapeHtml: value => { const span = document.createElement('span'); span.textContent = String(value); return span.innerHTML; },
                    iconFallbackPath: icon, defaultFolderIconPath: icon, isFormInitialized: () => true,
                    updateUnsavedIndicator: () => { nestedMembersFixture.dirty++; }
                });
                nestedMembersFixture.api.renderFolderMembersSection();
                FolderViewPlusRefreshModernEditorChromeLayout();
                settingsFixture.switchSection('members');
            });
            const panel = page.locator('.fv-editor-panel[data-editor-panel="folder-members"]');
            const rows = page.locator('#fvFolderMembersBody > tr');
            assert.equal(await panel.isVisible(), true, `${type}: direct children show the whole panel`);
            assert.equal(await rows.count(), 3, 'only direct children appear, even when each has zero apps');
            assert.equal(await rows.locator('small').allTextContents().then(values => values.every(value => value === 'Items: 0')), true);
            for (const theme of ['native', 'aurora']) {
                const style = await page.addStyleTag({ content: theme === 'aurora'
                    ? 'body table tbody td{vertical-align:top} body table td img{vertical-align:middle}' : 'table td{vertical-align:middle}' });
                const geometry = await rows.evaluateAll(elements => elements.map(row => {
                    const center = node => { const rect = node.getBoundingClientRect(); return rect.top + rect.height / 2; };
                    const cell = row.querySelector('.fv-folder-member-name');
                    return { row: center(row), controls: center(row.querySelector('.order-buttons')),
                        icon: center(cell.querySelector('img')), name: center(cell.querySelector('span')),
                        count: center(cell.querySelector('small')), display: getComputedStyle(cell).display };
                }));
                for (const value of geometry) {
                    assert.equal(value.display, 'table-cell', `${theme}: folder cell retains table layout`);
                    for (const key of ['controls', 'icon', 'name', 'count']) assert.ok(Math.abs(value[key] - value.row) <= 1.5, `${type}/${theme}/${viewport.width}: ${key} centered (${JSON.stringify(value)})`);
                }
                await style.evaluate(node => node.remove());
            }
            const longName = await rows.nth(1).locator('.fv-folder-member-name > div > span').evaluate(node => ({ overflow: getComputedStyle(node).textOverflow, truncated: node.scrollWidth > node.clientWidth }));
            assert.equal(longName.overflow, 'ellipsis'); assert.equal(longName.truncated, true);
            const grip = rows.first().locator('.folder-member-drag-handle'); await grip.focus();
            assert.equal(await grip.evaluate(node => node === document.activeElement), true);
            await rows.first().locator('.folder-member-move[data-direction="down"]').click();
            assert.deepEqual(await page.evaluate(() => nestedMembersFixture.api.getChildFolderOrderIds()), ['second', 'first', 'third']);
            assert.equal(await page.evaluate(() => nestedMembersFixture.dirty), 1);
            for (const active of ['second', 'leafWithApps', 'first', 'root', '']) {
                await page.evaluate(active => {
                    nestedMembersFixture.active = active; nestedMembersFixture.api.renderFolderMembersSection();
                    FolderViewPlusRefreshModernEditorChromeLayout(); FolderViewPlusRefreshModernEditorChromeLayout();
                    settingsFixture.switchSection('members');
                }, active);
                const expected = active === 'first' ? 1 : active === 'root' ? 3 : 0;
                assert.equal(await rows.count(), expected, active);
                assert.equal(await panel.isHidden(), expected === 0, `${active || 'create'}: entire nested panel follows child count`);
                assert.equal(await page.locator('.basic.order-section').isVisible(), true, 'normal app/VM member section remains visible');
            }
            await page.evaluate(() => nestedMembersFixture.api.dispose());
        }
    }
};
