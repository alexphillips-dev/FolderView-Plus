import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { installDashboardRowExpansion } from '../helpers/dashboard-row-expansion.mjs';
import { createDockerHideEmptyHost } from '../helpers/docker-hide-empty-host.mjs';
const require = createRequire(import.meta.url);
const { PNG } = require(path.join(path.dirname(require.resolve('playwright-core/package.json')), 'lib/utilsBundle.js'));
const animations = ['lift', 'bounce', 'pop', 'glow', 'flip', 'wiggle'];

export const registerFolderHoverEffectCases = ({ test, baseUrl }) => {
    for (const type of ['docker', 'vm']) {
        test(`${type} Dashboard folder effects preserve accents and animate only the hovered header`, async ({ page }) => {
            await installDashboardRowExpansion(page, baseUrl, type);
            await page.addStyleTag({ url: `${baseUrl}/plugin/styles/runtime.shared.css` });
            await page.addStyleTag({ content: '#header-row-1 { padding: 0; }' });
            await page.emulateMedia({ reducedMotion: 'no-preference' });
            await page.evaluate(() => {
                const card = document.querySelector('[data-fv-folder-id="row-1"]');
                card.style.setProperty('--fv-folder-accent-color', '#24b8d7');
                card.querySelector(':scope > span.outer').insertAdjacentHTML('afterbegin', '<span class="img" style="position:relative;display:block;width:32px;height:32px;background:#4779aa;flex:none"></span>');
            });
            const header = page.locator('#header-row-1');
            for (const layout of ['classic', 'legacy', 'fullwidth', 'accordion', 'inset', 'compactmatrix', 'embossed']) {
                await page.evaluate(({ type, layout }) => {
                    const fixture = window.fixtureDashboardLayout;
                    fixture.state.layout = layout; fixture.controller.applyDashboardLayoutStateForType(type);
                }, { type, layout });
                for (const expanded of [false, true]) {
                    if (expanded) await header.click();
                    const before = await header.boundingBox();
                    const color = async enabled => {
                        await header.evaluate((node, enabled) => node.parentNode.classList.toggle('fv-folder-has-accent', enabled), enabled);
                        const image = PNG.sync.read(await page.screenshot());
                        const offset = (Math.floor(before.y + before.height / 2) * image.width + Math.floor(before.x + 2)) * 4;
                        return [...image.data.subarray(offset, offset + 3)];
                    };
                    assert.deepEqual(await color(false), [71, 121, 170], `${layout}: the opaque icon covers the unaccented edge`);
                    assert.deepEqual(await color(true), [36, 184, 215], `${layout}: accent paints over the opaque icon`);
                    for (const animation of animations) {
                        await header.evaluate((node, animation) => {
                            node.parentNode.classList.remove(...[...node.parentNode.classList].filter(name => name.startsWith('fv-hover-animation-')));
                            node.parentNode.classList.add(`fv-hover-animation-${animation}`);
                        }, animation);
                        await header.hover();
                        assert.equal(await header.evaluate(node => getComputedStyle(node).animationName), `fv-folder-hover-${animation}`);
                        await page.mouse.move(0, 0);
                    }
                    if (expanded) {
                        await page.locator('.folder-showcase-row-1 > span.outer').hover();
                        assert.equal(await header.evaluate(node => getComputedStyle(node).animationName), 'none', 'member hover must not animate its folder header');
                    }
                    await page.emulateMedia({ reducedMotion: 'reduce' }); await header.hover();
                    assert.equal(await header.evaluate(node => getComputedStyle(node).animationName), 'none');
                    await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.mouse.move(0, 0);
                    const after = await header.boundingBox();
                    assert.ok(Math.abs(before.y - after.y) <= 1 && Math.abs(before.height - after.height) <= 1, 'effects preserve header layout');
                    await header.evaluate(node => node.parentNode.classList.remove(...[...node.parentNode.classList].filter(name => name.startsWith('fv-hover-animation-'))));
                    if (expanded) await header.click();
                }
            }
        }, { skipAccessibility: true }); // Synthetic headers omit native Unraid accessibility landmarks.
    }
    test('Docker folder hover animations remain visible within the native folder row', async ({ page }) => {
        const host = await createDockerHideEmptyHost(page, true);
        try {
            Object.assign(host.folders.direct.settings, { preview_hover_animation: 'bounce', folder_accent_enabled: true, folder_accent_color: '#24b8d7' });
            await page.emulateMedia({ reducedMotion: 'no-preference' });
            await page.goto(host.url); await page.waitForLoadState('networkidle');
            const row = page.locator('tr.folder-id-direct'), outer = row.locator('.folder-outer');
            await row.waitFor(); const before = await row.boundingBox();
            for (const animation of animations) {
                await row.evaluate((node, animation) => {
                    node.classList.remove(...[...node.classList].filter(name => name.startsWith('fv-hover-animation-')));
                    node.classList.add(window.FolderViewDockerRuntimeShared.getPreviewHoverAnimationClass({ preview_hover_animation: animation }));
                }, animation);
                await row.locator('.folder-img').hover();
                assert.equal(await outer.evaluate(node => getComputedStyle(node).animationName), `fv-folder-hover-${animation}`);
                await page.mouse.move(0, 0);
            }
            assert.equal(await row.locator('.folder-name-sub').evaluate(node => getComputedStyle(node).overflow), 'visible', 'header motion must not be cropped by its immediate container');
            assert.equal(await row.locator('td.folder-name').evaluate(node => getComputedStyle(node, '::before').backgroundColor), 'rgb(36, 184, 215)');
            await page.emulateMedia({ reducedMotion: 'reduce' }); await row.locator('.folder-img').hover();
            assert.equal(await outer.evaluate(node => getComputedStyle(node).animationName), 'none');
            const after = await row.boundingBox(); assert.equal(after.height, before.height);
            assert.equal(await outer.evaluate(node => getComputedStyle(node).overflow), 'hidden', 'text remains clipped inside its existing header');
        } finally { await host.close(); }
    }, { skipAccessibility: true });
};
