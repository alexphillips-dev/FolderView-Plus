import assert from 'node:assert/strict';

// Exercise the shipped expansion handlers and state store with synthetic host markup.
// Unrelated styling, filtering, and layout scheduling are isolated from this fixture.
const installFixture = async (page, baseUrl) => {
    await page.route(`${baseUrl}/dashboard-accordion`, (route) => route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Dashboard Accordion fixture</title><style>body{font:16px Arial;background:white;color:black}.folder-storage{display:none}[role="button"]{display:block;padding:8px;cursor:pointer}.folder-showcase{padding-left:12px}</style></head><body><main><h1>Dashboard Accordion</h1><table><tbody id="docker_view"><tr class="updated"><td></td></tr></tbody></table><table><tbody id="vm_view"><tr class="updated"><td></td></tr></tbody></table></main></body></html>'
    }));
    await page.goto(`${baseUrl}/dashboard-accordion`);
    await hydrateFixture(page, baseUrl);
};

const hydrateFixture = async (page, baseUrl) => {
    const response = await page.request.get(`${baseUrl}/plugin/scripts/dashboard.js`);
    assert.equal(response.ok(), true);
    const source = (await response.text()).replaceAll('\r\n', '\n');
    const extract = (start, end) => {
        const begin = source.indexOf(start);
        const finish = source.indexOf(end, begin + start.length);
        assert.ok(begin >= 0 && finish > begin, `Dashboard source boundaries: ${start}`);
        return source.slice(begin, finish);
    };
    const handlers = [
        extract('const dashboardTypeMeta =', 'let dashboardQuickRailController'),
        extract('const getDashboardCard =', 'const applyFolderDashboardCardSettings'),
        extract('const getGlobalFoldersForType =', 'const scheduleDashboardLayoutApplyForType'),
        extract('const toggleFolderExpansion =', '// Global variables')
    ].join('\n');
    await page.addScriptTag({ url: `${baseUrl}/vendor/jquery.js` });
    await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/dashboard.state-store.js` });
    await page.addScriptTag({ content: `(() => {
        const $ = window.jQuery;
        const folderEvents = new EventTarget();
        const dashboardExpandedStateStore = window.FolderViewPlusDashboardStateStore.createStore({ window });
        const globalFolders = { docker: {}, vms: {} };
        let layout = 'accordion';
        const normalizeDashboardPrefsForType = () => ({ layout });
        const applyFolderDashboardCardSettings = (type, id) => {
            const card = getDashboardCard(type, id);
            updateExpandToggleIcon(card, card.attr('expanded') === 'true');
        };
        const applyDashboardStartedOnlyFilterForType = () => {};
        const scheduleDashboardLayoutApplyForType = () => {};
        ${handlers}
        const render = (type) => {
            const saved = dashboardExpandedStateStore.read(type);
            const map = getGlobalFoldersForType(type);
            const outerClass = type === 'vm' ? 'vms folder-vm' : 'apps folder-docker';
            const card = (id, contents) => {
                const expanded = saved[id] === true;
                map[id] = { status: { expanded } };
                return '<div class="folder-showcase-outer folder-showcase-outer-' + id + '" data-fv-folder-id="' + id + '" expanded="' + expanded + '">' +
                    '<span id="' + type + '-' + id + '" class="outer ' + outerClass + '" expanded="' + expanded + '" data-fv-dashboard-folder-toggle data-fv-dashboard-type="' + type + '" role="button" tabindex="0" aria-expanded="' + expanded + '">' + type + ' ' + id +
                    '<div class="folder-storage">' + (expanded ? '' : contents) + '</div></span>' +
                    '<div class="folder-showcase folder-showcase-' + id + '">' + (expanded ? contents : '') + '</div></div>';
            };
            const nested = card('child', card('grandchild', '<span data-member="' + type + '">Member</span>'));
            $(dashboardTypeMeta(type).tbodySelector).find('td').html(card('parent', nested + card('sibling', '<span>Sibling member</span>')) + card('other', '<span>Other member</span>'));
        };
        render('docker');
        render('vm');
        window.fixtureDashboardAccordion = {
            toggle: toggleFolderExpansion,
            reset(nextLayout) {
                layout = nextLayout;
                for (const type of ['docker', 'vm']) {
                    dashboardExpandedStateStore.clear(type);
                    render(type);
                }
            },
            snapshot(type) {
                return {
                    saved: dashboardExpandedStateStore.read(type),
                    folders: Object.fromEntries(Object.entries(getGlobalFoldersForType(type)).map(([id, folder]) => {
                        const card = getDashboardCard(type, id);
                        return [id, {
                            expanded: card.attr('expanded') === 'true',
                            visible: card.is(':visible'),
                            modelExpanded: folder.status.expanded,
                            ariaExpanded: card.children('[role="button"]').attr('aria-expanded') === 'true'
                        }];
                    }))
                };
            }
        };
    })();` });
};

export const registerDashboardAccordionFixtureCases = ({ test, baseUrl }) => {
    for (const type of ['docker', 'vm']) {
        test(`Dashboard ${type} Accordion preserves ancestors, sibling behavior, and saved expansion`, async ({ page }) => {
            await installFixture(page, baseUrl);
            const otherType = type === 'docker' ? 'vm' : 'docker';
            const snapshot = () => page.evaluate((type) => window.fixtureDashboardAccordion.snapshot(type), type);
            const expectExpanded = (state, ids) => {
                for (const id of ids) {
                    assert.deepEqual(state.folders[id], { expanded: true, visible: true, modelExpanded: true, ariaExpanded: true }, id);
                    assert.equal(state.saved[id], true, `saved ${id}`);
                }
            };
            await page.locator(`#${otherType}-parent`).click();
            await page.locator(`#${type}-parent`).click();
            await page.locator(`#${type}-child`).press('Enter');
            // Assert before attempting the grandchild so regressions fail without a click timeout.
            expectExpanded(await snapshot(), ['parent', 'child']);
            await page.locator(`#${type}-grandchild`).press(' ');
            expectExpanded(await snapshot(), ['parent', 'child', 'grandchild']);
            assert.equal(await page.locator(`[data-member="${type}"]`).isVisible(), true);
            assert.equal(await page.locator(`#${type}-grandchild`).evaluate((node) => node === document.activeElement), true);

            await page.locator(`#${type}-sibling`).click();
            let state = await snapshot();
            expectExpanded(state, ['parent', 'sibling']);
            for (const id of ['child', 'grandchild']) {
                assert.equal(state.folders[id].expanded, false);
                assert.equal(state.saved[id], false);
            }
            await page.locator(`#${type}-other`).click();
            state = await snapshot();
            expectExpanded(state, ['other']);
            assert.equal(state.saved.parent, false);
            assert.equal(state.folders.sibling.visible, false);
            const untouched = await page.evaluate((type) => window.fixtureDashboardAccordion.snapshot(type), otherType);
            expectExpanded(untouched, ['parent']);

            for (const id of ['parent', 'child', 'grandchild']) await page.locator(`#${type}-${id}`).click();
            const beforeReload = await snapshot();
            await page.reload();
            await hydrateFixture(page, baseUrl);
            assert.deepEqual(await snapshot(), beforeReload, 'stored ancestors and children survive a fresh document');

            // Bulk expansion deliberately bypasses Accordion exclusivity.
            await page.evaluate((type) => window.fixtureDashboardAccordion.toggle(type, 'sibling', { forceExpanded: true, suppressAccordion: true }), type);
            expectExpanded(await snapshot(), ['parent', 'child', 'grandchild', 'sibling']);
            for (const layout of ['classic', 'legacy', 'fullwidth', 'inset', 'compactmatrix', 'embossed']) {
                await page.evaluate((layout) => window.fixtureDashboardAccordion.reset(layout), layout);
                for (const id of ['parent', 'child', 'grandchild', 'sibling']) await page.locator(`#${type}-${id}`).click();
                expectExpanded(await snapshot(), ['parent', 'child', 'grandchild', 'sibling']);
            }
        });
    }
};
