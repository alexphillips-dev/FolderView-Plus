import assert from 'node:assert/strict';

const member = '[data-fv-unassigned-item]';
const header = '[data-fv-unassigned-group]';

export const registerUnassignedGroupCases = ({ test, baseUrl }) => {
    test('Unassigned group projects native rows and restores their original order', async ({ page }) => {
        await page.route('**/unassigned-test.html', route => route.fulfill({
            contentType: 'text/html',
            body: `
                <!doctype html><html lang="en"><head><title>Unassigned group fixture</title></head><body><main>
                <table><tbody id="native">
                  <tr id="loose-a"><td><button id="native-action">Native control</button></td></tr>
                  <tr id="assigned-a"><td>Assigned A</td></tr>
                  <tr id="loose-b"><td>Loose B</td></tr>
                  <tr id="detail-b"><td>VM detail</td></tr>
                  <tr id="assigned-b"><td>Assigned B</td></tr>
                </tbody></table>
                <table><tbody><tr><td id="dashboard">
                  <span id="app-a" class="outer">App A</span><span id="app-b" class="outer">App B</span>
                </td></tr></tbody></table>
                </main></body></html>`
        }));
        await page.goto(`${baseUrl}/unassigned-test.html`);
        await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/runtime.unassigned-group.js` });
        await page.addStyleTag({ url: `${baseUrl}/plugin/styles/runtime.shared.css` });
        const names = ['loose-a', 'assigned-a', 'loose-b', 'detail-b', 'assigned-b'];
        const layout = await page.evaluate(() => {
            const byId = id => document.getElementById(id);
            const { createApi } = FolderViewPlusFoundationModules.unassignedGroup;
            const group = createApi({ window });
            const dashboard = createApi({ window });
            const tbody = byId('native');
            const td = byId('dashboard');
            const render = (nameList) => group.render(tbody, nameList.map(byId), {
                columnCount: 3, getRelatedRows: row => row.id === 'loose-b' ? [byId('detail-b')] : []
            });
            window.fixture = { group, tbody, dashboard, td, render };
            byId('native-action').addEventListener('click', () => { byId('native-action').dataset.clicked = 'yes'; });
            byId('loose-b').style.display = 'table-row';
            render(['loose-a', 'loose-b']);
            dashboard.render(td, [byId('app-a')]);
            return {
                rendered: [...tbody.children].map(row => row.id || 'group'),
                original: group.getUngroupedRows(tbody).map(row => row.id),
                colspan: tbody.querySelector('[data-fv-unassigned-group] td').colSpan
            };
        });
        assert.deepEqual(layout.original, names);
        assert.deepEqual(layout.rendered, ['assigned-a', 'assigned-b', 'group', 'loose-a', 'loose-b', 'detail-b']);
        assert.equal(layout.colspan, 3);
        assert.equal(await page.locator(`#native > ${member}`).count(), 3);
        const toggle = page.locator(`#native ${header} button`);
        assert.equal((await toggle.textContent()).replace(/\s+/g, ' '), 'Unassigned items 2');
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
        assert.equal(await page.locator('#loose-b').isVisible(), false);
        await toggle.focus();
        await page.keyboard.press('Enter');
        await page.locator('#native-action').click();
        assert.equal(await page.locator('#native-action').getAttribute('data-clicked'), 'yes');
        assert.equal(await page.locator('#detail-b').isVisible(), true);
        assert.equal(await page.locator(`#dashboard > ${member}.outer`).count(), 1);
        assert.equal(await page.locator('#app-a').isVisible(), false);

        await toggle.focus();
        await page.evaluate(() => fixture.render(['loose-b']));
        assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
        assert.equal(await toggle.evaluate(button => button === document.activeElement), true);
        assert.equal(await page.locator('#loose-a').isVisible(), true);
        const restored = await page.evaluate(() => {
            const { group, tbody, dashboard, td } = fixture;
            group.clear({ resetExpansion: true });
            dashboard.clear();
            return { rows: [...tbody.children].map(row => row.id), apps: [...td.children].map(span => span.id) };
        });
        assert.deepEqual(restored, { rows: names, apps: ['app-a', 'app-b'] });
        assert.equal(await page.locator(`${member},${header}`).count(), 0);
        await page.evaluate(() => fixture.render(['loose-b']));
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
        await page.evaluate(() => fixture.group.reveal(document.getElementById('detail-b')));
        assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    });
};
