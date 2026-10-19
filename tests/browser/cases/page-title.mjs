import assert from 'node:assert/strict';
import { createPageTitleHost } from '../helpers/page-title-host.mjs';

export const registerPageTitleCases = ({ test }) => {
    test('Docker page title safely renders in all page views with native and fallback toolbars', async ({ page }) => {
        for (const nativeToolbar of [true, false]) {
            const host = await createPageTitleHost(page, nativeToolbar);
            const text = '<img src=x onerror=alert(1)> ' + 'Long title '.repeat(12);
            host.prefs().pageTitle = { enabled: true, text, size: 48, font: 'serif', bold: false, italic: false, color: 'theme' };
            try {
                for (const mode of ['folderview', 'host', 'command']) {
                    host.prefs().pageViewMode = mode;
                    await page.goto(`${host.baseUrl}/docker`);
                    await page.waitForFunction(mode => document.body.getAttribute('data-fvplus-docker-page-view') === mode && document.getElementById('fvplus-docker-page-title'), mode);
                    await page.waitForLoadState('networkidle');
                    const title = page.locator('#fvplus-docker-page-title');
                    assert.equal(await title.count(), 1);
                    assert.equal(await title.textContent(), text.slice(0, 100).trim());
                    assert.equal(await title.locator('*').count(), 0, 'saved title is plain text');
                    const theme = await title.evaluate(node => ({ title: getComputedStyle(node).color,
                        control: getComputedStyle(document.querySelector('.fvplus-docker-runtime-toggle-label')).color,
                        name: window.display.theme, dark: matchMedia('(prefers-color-scheme: dark)').matches }));
                    assert.equal(theme.title, theme.control, 'theme-default title color follows the neighboring native-theme controls');
                    assert.equal(theme.name, theme.dark ? 'black' : 'white');
                    const geometry = await title.evaluate(node => {
                        const a = node.getBoundingClientRect(), table = (document.getElementById('fvplus-docker-command-view-root') || document.getElementById('docker_containers')).getBoundingClientRect();
                        return { left: a.left, right: a.right, bottom: a.bottom, tableTop: table.top, viewport: innerWidth };
                    });
                    assert.ok(geometry.left >= 0 && geometry.right <= geometry.viewport + 1);
                    assert.ok(geometry.bottom <= geometry.tableTop + 1, `title clears table in ${mode}: ${JSON.stringify(geometry)}`);
                }
            } finally { await page.goto('about:blank'); await page.unrouteAll({ behavior: 'wait' }); await host.close(); }
        }
    }, { skipAccessibility: true });
    test('Docker page title saves from the reorganized cards and keeps header controls at the right', async ({ page }) => {
        const host = await createPageTitleHost(page);
        const saved = action => Promise.all([
            page.waitForResponse(response => response.url().includes('/server/prefs.php') && response.request().method() === 'POST'), action()
        ]);
        const waitDocker = async () => {
            await page.waitForFunction(() => document.body.getAttribute('data-fvplus-docker-page-view') && document.querySelector('#fvplus-docker-runtime-privacy-shell'));
            await page.waitForLoadState('networkidle');
        };
        const positions = () => page.locator('#fixture-basic, #fixture-menu, #fvplus-docker-runtime-privacy-shell, .fv-quickfinder-trigger').evaluateAll(nodes => nodes.map(node => ({ id: node.id || node.className, left: node.getBoundingClientRect().left, width: node.getBoundingClientRect().width })));
        try {
            await page.goto(`${host.baseUrl}/docker`); await waitDocker();
            assert.equal(await page.locator('#fvplus-docker-page-title').count(), 0, 'default must leave Docker unchanged');
            const before = await positions();
            await page.goto(`${host.baseUrl}/settings`);
            await page.waitForFunction(() => document.getElementById('docker-page-title-enabled') && !document.getElementById('fv-settings-root').classList.contains('fv-settings-bootstrap-pending'));
            await page.locator('#docker-view-settings').evaluate(node => { node.open = true; });
            const grid = page.locator('#docker-view-settings .fv-view-settings-grid');
            assert.equal(await grid.locator(':scope > .settings-mini-card').count(), 8);
            assert.equal(await grid.locator('.fv-settings-card-layout #docker-status-mode').count(), 0);
            assert.equal(await grid.locator('.fv-settings-card-badges #docker-status-mode').count(), 1);
            assert.match(await grid.locator('.fv-settings-card-badges .fv-view-settings-card-title').textContent(), /Status & badges/);
            assert.equal(await page.locator('#docker-page-title-fields').isHidden(), true);
            assert.equal(await page.locator('#docker-page-title-text').count(), 0, 'disabled title formatting is not mounted');
            await saved(() => page.locator('label').filter({ has: page.locator('#docker-page-title-enabled') }).click());
            assert.equal(host.prefs().pageTitle.enabled, true);
            assert.equal(await page.locator('#docker-page-title-text').count(), 1, 'enabling mounts the formatting controls once');
            assert.equal(host.prefs().pageTitle.text, 'Change Me!');
            await page.locator('#docker-page-title-text').fill('Fixture containers');
            assert.equal(await page.locator('#docker-page-title-preview').textContent(), 'Fixture containers', 'typing updates the preview');
            await saved(() => page.locator('#docker-page-title-text').press('Tab'));
            await saved(() => page.locator('#docker-page-title-font').selectOption('monospace'));
            await page.locator('#docker-page-title-size').fill('48');
            await saved(() => page.locator('#docker-page-title-size').press('Tab'));
            await saved(() => page.locator('#docker-page-title-italic').check());
            await saved(() => page.locator('#docker-page-title-color').evaluate(node => { node.value = '#ff9900'; node.dispatchEvent(new Event('change', { bubbles: true })); }));
            assert.equal(host.prefs().pageTitle.color, '#ff9900');
            const overflow = await grid.evaluate(node => [...node.querySelectorAll('input,select,button')].filter(el => el.getClientRects().length).every(el => { const a = el.getBoundingClientRect(), b = el.closest('.settings-mini-card').getBoundingClientRect(); return a.left >= b.left && a.right <= b.right + 1; }));
            assert.ok(overflow, 'expanded title fields must fit within their card');
            await page.screenshot({ path: `tmp/page-title-settings-${Math.round((await page.viewportSize()).width)}.png`, fullPage: true });
            await page.reload();
            await page.waitForFunction(() => document.querySelector('#docker-page-title-text')?.value === 'Fixture containers');
            assert.equal(await page.locator('#docker-page-title-size').inputValue(), '48');
            await page.goto(`${host.baseUrl}/docker`); await waitDocker();
            const title = page.locator('#fvplus-docker-page-title');
            assert.equal(await title.textContent(), 'Fixture containers');
            const appearance = await title.evaluate(node => { const s = getComputedStyle(node); return { font: s.fontFamily, size: s.fontSize, weight: s.fontWeight, italic: s.fontStyle, color: s.color }; });
            assert.deepEqual(appearance, { font: 'monospace', size: '48px', weight: '700', italic: 'italic', color: 'rgb(255, 153, 0)' });
            const after = await positions();
            assert.equal(after.length, before.length);
            after.forEach((item, index) => assert.ok(Math.abs(item.left - before[index].left) < 1 && Math.abs(item.width - before[index].width) < 1, 'title must preserve right-side control geometry'));
            const bounds = await title.evaluate(node => { const a = node.getBoundingClientRect(), b = node.parentElement.getBoundingClientRect(); return { left: a.left, hostLeft: b.left, right: a.right, bottom: a.bottom, controlsTop: document.getElementById('fixture-basic').getBoundingClientRect().top }; });
            assert.ok(Math.abs(bounds.left - bounds.hostLeft) < 1);
            assert.ok(bounds.bottom <= bounds.controlsTop || after.every(item => bounds.right <= item.left), 'title must not overlap controls');
            await page.evaluate(() => { document.body.classList.add('fvplus-privacy-docker-runtime-mask-names'); });
            assert.equal(await title.isHidden(), true, 'name masking also hides custom titles');
            await page.evaluate(() => { document.body.classList.remove('fvplus-privacy-docker-runtime-mask-names'); });
            await page.screenshot({ path: `tmp/page-title-docker-${Math.round((await page.viewportSize()).width)}.png`, fullPage: true });
            await page.goto(`${host.baseUrl}/settings`);
            await page.waitForFunction(() => document.querySelector('#docker-page-title-text')?.value === 'Fixture containers');
            await page.locator('#docker-view-settings').evaluate(node => { node.open = true; });
            await saved(() => page.locator('.fv-page-title-reset').click());
            assert.equal(host.prefs().pageTitle.text, 'Fixture containers');
            assert.equal(host.prefs().pageTitle.size, 28); assert.equal(host.prefs().pageTitle.color, 'theme');
            await saved(() => page.locator('label').filter({ has: page.locator('#docker-page-title-enabled') }).click());
            assert.equal(host.prefs().pageTitle.text, 'Fixture containers');
            await page.goto(`${host.baseUrl}/docker`); await waitDocker();
            assert.equal(await title.count(), 0);
            assert.deepEqual(await positions(), before, 'disabling restores the original toolbar');
        } finally { await page.goto('about:blank'); await page.unrouteAll({ behavior: 'wait' }); await host.close(); }
    }, { skipAccessibility: true });
};
