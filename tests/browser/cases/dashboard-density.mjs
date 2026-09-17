import assert from 'node:assert/strict';

export const registerDashboardDensityFixtureCases = ({ test, baseUrl }) => {
    for (const type of ['docker', 'vm']) {
        test(`${type} Dashboard packs folders and members using the available widget width`, async ({ page }) => {
            await page.goto(`${baseUrl}/dashboard-layout`, { waitUntil: 'load' });
            await page.emulateMedia({ reducedMotion: 'reduce' });
            await page.addStyleTag({ content: 'span.outer { width:180px; }' });
            await page.evaluate((type) => {
                document.body.dataset.fvThemeClass = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                document.querySelector('#fixture-vm-widget').remove();
                const host = document.querySelector('#fixture-dashboard-host');
                const first = host.querySelector(':scope > .folder-showcase-outer');
                const member = first.querySelector('.folder-showcase > span.outer');
                const panel = first.querySelector('.folder-showcase');
                panel.replaceChildren(...Array.from({ length: 8 }, () => member.cloneNode(true)));
                host.append(first.cloneNode(true));
                [...host.querySelectorAll(':scope > .folder-showcase-outer')].forEach((card, index) => {
                    card.dataset.fvFolderId = `density-${index}`;
                    card.setAttribute('expanded', 'false');
                    card.querySelector('.folder-appname-docker').textContent = `VeryLongFolderNameWithoutSpacesForOverflowTesting-${index}`;
                });
                const native = member.cloneNode(true);
                native.id = 'density-native';
                host.insertBefore(native, host.children[2]);
                host.querySelectorAll('[id]:not(#density-native)').forEach((node) => node.removeAttribute('id'));
                if (type === 'vm') {
                    document.querySelector('#docker_view').id = 'vm_view';
                    host.innerHTML = host.innerHTML.replaceAll('folder-docker', 'folder-vm').replaceAll('folder-inner-docker', 'folder-inner-vm').replaceAll('folder-appname-docker', 'folder-appname-vm').replaceAll(' apps', ' vms');
                }
            }, type);
            for (const width of [390, 570, 900, 1180]) {
                await page.setViewportSize({ width: width === 390 ? 414 : 1400, height: 900 });
                for (const layout of ['classic', 'fullwidth', 'inset', 'embossed', 'accordion', 'compactmatrix']) {
                    const geometry = await page.evaluate(({ type, layout, width }) => {
                        const fixture = window.fixtureDashboardLayout;
                        fixture.resize(width);
                        fixture.state.layout = layout;
                        const host = document.querySelector('#fixture-dashboard-host');
                        const cards = [...host.children].filter((node) => node.classList.contains('folder-showcase-outer'));
                        cards.forEach((card) => card.setAttribute('expanded', 'false'));
                        fixture.controller.applyDashboardLayoutStateForType(type);
                        const rect = (node) => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, bottom: r.bottom }; };
                        const collapsed = cards.map(rect);
                        const order = [...host.children].map((node) => node.dataset.fvFolderId || node.id);
                        cards[0].setAttribute('expanded', 'true');
                        fixture.controller.applyDashboardLayoutStateForType(type);
                        const panel = cards[0].querySelector(':scope > .folder-showcase');
                        const members = [...panel.children].map(rect);
                        const expanded = cards.map(rect);
                        const nested = cards[4].querySelector('.folder-showcase-outer');
                        cards[4].setAttribute('expanded', 'true');
                        const nestedClosed = nested ? getComputedStyle(nested.querySelector('.folder-showcase')).display === 'none' : true;
                        fixture.controller.applyDashboardLayoutStateForType(type);
                        const tbody = host.closest('tbody');
                        tbody.classList.add('fv-dashboard-hide-folder-label');
                        const labelsHidden = [...host.querySelectorAll('.folder-appname-docker, .folder-appname-vm')].every((node) => getComputedStyle(node).display === 'none');
                        tbody.classList.remove('fv-dashboard-hide-folder-label');
                        return { collapsed, expanded, members, panel: rect(panel), host: rect(host), nestedClosed, labelsHidden,
                            order, afterOrder: [...host.children].map((node) => node.dataset.fvFolderId || node.id),
                            overflow: document.documentElement.scrollWidth > innerWidth,
                            memberOverflow: [...panel.children].some((node) => node.scrollWidth > node.clientWidth + 1),
                            headerOverflow: cards.some((card) => { const header = card.querySelector(':scope > span.outer'); return header.scrollWidth > header.clientWidth + 1; }) };
                    }, { type, layout, width });
                    const label = `${type} ${layout} ${width}`;
                    const columns = new Set(geometry.collapsed.map((r) => Math.round(r.x))).size;
                    assert.equal(geometry.overflow, false, `${label}: page overflow`);
                    assert.equal(geometry.memberOverflow, false, `${label}: member overflow`);
                    assert.equal(geometry.headerOverflow, false, `${label}: folder name overflow`);
                    assert.equal(geometry.nestedClosed, true, `${label}: closed nested panel stays hidden`);
                    assert.equal(geometry.labelsHidden, true, `${label}: hide folder labels setting`);
                    assert.deepEqual(geometry.afterOrder, geometry.order, `${label}: saved order stays intact`);
                    if (['classic', 'fullwidth', 'inset', 'embossed'].includes(layout)) {
                        assert.ok(columns >= ({ 390: 2, 570: 3, 900: 4, 1180: 6 })[width], `${label}: ${columns} collapsed columns`);
                        assert.ok(geometry.expanded[0].width >= geometry.host.width - 40, `${label}: expanded card spans widget`);
                    }
                    if (layout === 'accordion') assert.equal(columns, 1, label);
                    if (layout !== 'compactmatrix') {
                        const memberColumns = new Set(geometry.members.map((r) => Math.round(r.x))).size;
                        assert.ok(memberColumns >= ({ 390: 1, 570: 2, 900: 4, 1180: 5 })[width], `${label}: ${memberColumns} member columns`);
                        const right = Math.max(...geometry.members.map((r) => r.x + r.width));
                        assert.ok(geometry.panel.x + geometry.panel.width - right <= 12, `${label}: members fill panel`);
                    } else if (width >= 900) {
                        const byColumn = Map.groupBy(geometry.expanded, (r) => Math.round(r.x));
                        for (const cards of byColumn.values()) {
                            for (let i = 1; i < cards.length; i += 1) {
                                // The ungrouped tile can occur between cards in the first column.
                                const gap = cards[i].y - cards[i - 1].bottom;
                                assert.ok(gap >= -1 && gap < 110, `${label}: unnecessary vertical gap ${gap}`);
                            }
                        }
                    }
                }
            }
        });
    }
};
