import assert from 'node:assert/strict';
import { installDashboardRowExpansion } from '../helpers/dashboard-row-expansion.mjs';

export const registerDashboardRowExpansionCases = ({test, baseUrl}) => {
    for (const type of ['docker', 'vm']) {
        test(`${type} Dashboard expansion keeps second and third folder headers in their row`, async ({page}) => {
            await installDashboardRowExpansion(page, baseUrl, type);
            const headers = page.locator('#fixture-dashboard-host > .folder-showcase-outer > [data-fv-dashboard-folder-toggle]');
            const positions = () => headers.evaluateAll(nodes => nodes.map(node => {
                const rect = node.getBoundingClientRect(); return {left: rect.left, top: rect.top, width: rect.width};
            }));
            for (const [layout, direction] of ['classic', 'fullwidth', 'inset', 'embossed'].flatMap(layout => ['ltr', 'rtl'].map(direction => [layout, direction]))) {
                await page.evaluate(({type, layout, direction}) => {
                    document.documentElement.dir = direction;
                    const fixture = window.fixtureDashboardLayout; fixture.state.layout = layout;
                    fixture.resize(Math.min(600, innerWidth - 24));
                    fixture.controller.applyDashboardLayoutStateForType(type);
                    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                }, {type, layout, direction});
                const before = await positions();
                for (const index of [1, 2]) {
                    const header = page.locator(`#header-row-${index}`);
                    await header.click();
                    const after = await positions();
                    assert.ok(Math.abs(after[index].left - before[index].left) <= 1, `${layout}: expanded header stays in its column`);
                    assert.ok(Math.abs(after[index].top - before[index].top) <= 1, `${layout}: expanded header stays in its row`);
                    assert.ok(Math.abs(after[0].top - after[2].top) <= 1 || before[0].top !== before[2].top, `${layout}: peers retain their row`);
                    assert.equal(await header.getAttribute('aria-expanded'), 'true');
                    const geometry = await page.evaluate(type => window.fixtureDashboardLayout.visualController.capture(type).geometry, type);
                    assert.equal(geometry.expansion.available, true);
                    assert.equal(geometry.expansion.movedHeaderCount, 0, 'diagnostics measure only the expanded header row');
                    assert.equal(geometry.folderHeaderHeights.count, 6);
                    assert.equal(await page.evaluate(({type, index}) => window.fixtureDashboardRowExpansion.saved(type)[`row-${index}`], {type, index}), true);
                    const panel = page.locator(`.folder-showcase-row-${index}`);
                    assert.equal(await panel.isVisible(), true);
                    const bounds = await panel.boundingBox();
                    const host = await page.locator('#fixture-dashboard-host').boundingBox();
                    assert.ok(bounds.width >= host.width - 40, `${layout}: members use the widget width`);
                    await header.press('Enter');
                    assert.equal(await header.getAttribute('aria-expanded'), 'false');
                    assert.equal(await panel.isVisible(), false);
                }
                await page.locator('#header-row-0').click();
                await page.locator('#header-row-1').press('Space');
                const both = await positions();
                assert.ok(Math.abs(both[1].left - before[1].left) <= 1 && Math.abs(both[1].top - before[1].top) <= 1, `${layout}: two open folders retain header slots`);
                const first = await page.locator('.folder-showcase-row-0').boundingBox();
                const second = await page.locator('.folder-showcase-row-1').boundingBox();
                assert.ok(second.y >= first.y + first.height, 'expanded previews do not overlap');
                const visibility = await page.evaluate(type => {
                    const fixture = window.fixtureDashboardLayout, card = document.querySelector('[data-fv-folder-id="row-0"]');
                    return {visible: fixture.controller.isDashboardNodeVisible(card), count: fixture.visualController.capture(type).content.directFolderCount};
                }, type);
                assert.equal(visibility.visible, true, 'quick controls recognize an expanded first folder');
                assert.equal(visibility.count, 6, 'diagnostics retain expanded root folders');
                await page.evaluate(() => window.fixtureDashboardLayout.resize(320));
                await page.waitForFunction(() => document.querySelector('#fixture-dashboard-host').style.getPropertyValue('--fv-dashboard-grid-columns') === '1');
                const narrow = await positions();
                assert.ok(narrow.every(position => Math.abs(position.left - narrow[0].left) <= 1), 'resizing an expanded widget recomputes one column');
                await page.locator('#header-row-0').click();
                await page.locator('#header-row-1').click();
            }
            await page.evaluate(type => {
                const fixture = window.fixtureDashboardLayout;
                fixture.state.layout = 'classic'; fixture.resize(Math.min(600, innerWidth - 24));
                document.querySelectorAll('#fixture-dashboard-host > .folder-showcase-outer').forEach((card, index) => { card.hidden = index > 1; });
                fixture.controller.applyDashboardLayoutStateForType(type);
            }, type);
            const fewBefore = (await positions()).slice(0, 2);
            await page.locator('#header-row-1').click();
            const fewAfter = (await positions()).slice(0, 2);
            assert.ok(fewAfter.every((position, index) => Math.abs(position.width - fewBefore[index].width) <= 1 && Math.abs(position.left - fewBefore[index].left) <= 1), 'a full-width preview does not create unused header columns');
            const movement = await page.evaluate(type => {
                const fixture = window.fixtureDashboardLayout, card = document.querySelector('[data-fv-folder-id="row-1"]'), header = card.querySelector(':scope > span.outer');
                fixture.visualController.beginExpansion(type, card); header.style.transform = 'translateX(24px)';
                const expansion = fixture.visualController.capture(type).geometry.expansion; header.style.removeProperty('transform'); return expansion;
            }, type);
            assert.equal(movement.movedHeaderCount, 1); assert.equal(movement.maximumHorizontalShiftPx, 24);
            await page.evaluate(() => {
                const child = document.querySelector('[data-fv-folder-id="row-5"]'); child.hidden = false;
                document.querySelector('.folder-showcase-row-1').append(child);
            });
            await page.locator('#header-row-5').click();
            const nested = await page.locator('.folder-showcase-row-5').boundingBox();
            const parent = await page.locator('.folder-showcase-row-1').boundingBox();
            assert.ok(nested.x >= parent.x && nested.x + nested.width <= parent.x + parent.width + 1, 'nested contents stay within their parent preview');
            await page.locator('#header-row-1').click();
            assert.equal(await page.locator('#header-row-5').isVisible(), false);
            await page.locator('#header-row-1').click();
            assert.equal(await page.locator('.folder-showcase-row-5').isVisible(), true, 'reopening a parent preserves the child expansion');
        }, {skipAccessibility: true}); // The synthetic host omits native Unraid accessibility landmarks.
    }
};
