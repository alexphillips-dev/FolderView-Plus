import assert from 'node:assert/strict';

export const registerDashboardRowSpacingCases = ({ test, baseUrl }) => {
    for (const type of ['docker', 'vm']) {
        test(`${type} Dashboard mixed rows keep native spacing through density and expansion changes`, async ({ page }) => {
            const prepare = async () => {
                await page.addStyleTag({ content: `
                    span.outer { margin-bottom: 20px; }
                    #fixture-dashboard-host { font-size: 13px; line-height: normal; }
                    #fixture-dashboard-host > span.outer, .folder-showcase-outer > span.outer {
                        min-height: 50px; padding: 6px; box-sizing: border-box;
                    }
                ` });
                await page.evaluate((type) => {
                    const vmToggle = document.querySelector('#vms');
                    vmToggle.hidden = true;
                    document.body.append(vmToggle);
                    document.querySelector('#fixture-vm-widget').remove();
                    const host = document.querySelector('#fixture-dashboard-host');
                    const folder = host.querySelector('.folder-showcase-outer');
                    folder.id = 'spacing-folder';
                    folder.setAttribute('expanded', 'false');
                    folder.querySelector(':scope > span.outer > span.inner').innerHTML = '<span class="folder-appname-docker">Synthetic folder</span><br><span class="state folder-state-docker">Started</span>';
                    host.querySelectorAll(':scope > .folder-showcase-outer').forEach((card) => card.remove());
                    const native = (index) => {
                        const tile = document.createElement('span');
                        tile.className = `outer ${type === 'vm' ? 'vms' : 'apps'} started`;
                        tile.id = `spacing-native-${index}`;
                        tile.innerHTML = '<span class="inner"><span class="appname">Synthetic member</span><br><span class="state">Started</span></span>';
                        return tile;
                    };
                    for (let index = 0; index < 6; index += 1) host.append(native(index));
                    host.append(folder);
                    for (let index = 6; index < 11; index += 1) host.append(native(index));
                    if (type === 'vm') {
                        document.querySelector('#docker_view').id = 'vm_view';
                        host.innerHTML = host.innerHTML.replaceAll('folder-docker', 'folder-vm').replaceAll('folder-inner-docker', 'folder-inner-vm').replaceAll('folder-appname-docker', 'folder-appname-vm').replaceAll(' apps', ' vms');
                    }
                    window.fixtureDashboardLayout.resize(Math.min(600, innerWidth - 24));
                }, type);
            };
            const apply = async (layout, density, expanded = false) => page.evaluate(({ type, layout, density, expanded }) => {
                const fixture = window.fixtureDashboardLayout;
                fixture.state.layout = layout;
                fixture.state.density = density;
                document.querySelector('#spacing-folder').setAttribute('expanded', String(expanded));
                fixture.controller.applyDashboardLayoutStateForType(type);
                fixture.controller.applyDashboardLayoutStateForType(type);
            }, { type, layout, density, expanded });
            const assertSpacing = async () => {
                const geometry = await page.evaluate(() => {
                    const folder = document.querySelector('#spacing-folder');
                    const header = folder.querySelector(':scope > span.outer');
                    const tiles = [...document.querySelectorAll('#fixture-dashboard-host > span.outer, #spacing-folder')];
                    const nativeTop = tiles[0].getBoundingClientRect().y;
                    const folderTop = folder.getBoundingClientRect().y;
                    const nextNative = tiles.find((tile) => tile.getBoundingClientRect().y > nativeTop + 1);
                    const nextFolder = tiles.find((tile) => tile.getBoundingClientRect().y > folderTop + 1);
                    return {
                        headerMargin: getComputedStyle(header).marginBottom,
                        folderHeight: folder.getBoundingClientRect().height,
                        nativeHeight: tiles[0].getBoundingClientRect().height,
                        ordinaryStep: nextNative.getBoundingClientRect().y - nativeTop,
                        folderStep: nextFolder.getBoundingClientRect().y - folderTop
                    };
                });
                assert.equal(geometry.headerMargin, '0px', 'folder header must not retain the host bottom margin');
                assert.ok(Math.abs(geometry.folderHeight - geometry.nativeHeight) <= 1, 'collapsed folder height must match native tiles');
                assert.ok(Math.abs(geometry.folderStep - geometry.ordinaryStep) <= 1, 'a folder must not increase mixed row spacing');
            };
            await page.goto(`${baseUrl}/dashboard-layout`, { waitUntil: 'load' });
            await page.emulateMedia({ reducedMotion: 'reduce' });
            await prepare();
            for (const layout of ['classic', 'fullwidth', 'inset']) {
                for (const density of [false, true]) {
                    await apply(layout, density);
                    await assertSpacing();
                    await apply(layout, density, true);
                    assert.equal(await page.locator('#spacing-folder > .folder-showcase').isVisible(), true);
                    await apply(layout, density);
                    await assertSpacing();
                }
            }
            await apply('embossed', false);
            assert.equal(await page.locator('#spacing-folder > span.outer').evaluate((node) => getComputedStyle(node).marginBottom), '7px', 'Embossed keeps its intentional header spacing');
            await page.reload({ waitUntil: 'load' });
            await prepare();
            await apply('classic', false);
            await assertSpacing();
        });
    }
};
