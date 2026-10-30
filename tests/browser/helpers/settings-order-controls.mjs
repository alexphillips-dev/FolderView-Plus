import assert from 'node:assert/strict';
import fs from 'node:fs';
import { installHost } from './host-theme.mjs';
import { installNeoraid } from './neoraid.mjs';

const aurora = fs.readFileSync(new URL('../fixtures/vendor/aurora-controls.css', import.meta.url), 'utf8');
export const verifySettingsOrderControls = async (page, url, type) => {
    const tbody = type === 'vm' ? 'vms' : 'docker';
    const measure = mobile => page.locator(`tbody#${tbody} .row-order-actions`).evaluateAll((rows, mobile) => rows.flatMap(row => {
        const grip = row.querySelector('.folder-drag-handle')?.getBoundingClientRect();
        return [...row.querySelectorAll('.folder-tree-action:has(svg)')].filter(button => button.offsetWidth).map(button => {
            const svg = button.querySelector('svg'), glyph = svg.getBBox(), box = button.getBoundingClientRect();
            const center = new DOMPoint(glyph.x + glyph.width / 2, glyph.y + glyph.height / 2).matrixTransform(svg.getScreenCTM());
            return { label: button.title, padding: getComputedStyle(button).padding, height: box.height,
                xError: center.x - box.left - box.width / 2, yError: center.y - box.top - box.height / 2,
                gripError: mobile ? 0 : center.y - grip.top - grip.height / 2 };
        });
    }), mobile);
    const verify = async mobile => {
        const controls = await measure(mobile);
        assert.ok(controls.length >= 5, 'root and nested tree controls must be present');
        for (const control of controls) {
            assert.equal(control.padding, '0px', control.label);
            assert.ok(Math.max(Math.abs(control.xError), Math.abs(control.yError), Math.abs(control.gripError)) <= 1.5,
                `tree glyph must center beside its grip: ${JSON.stringify(control)}`);
            if (mobile) assert.ok(control.height >= 32, 'mobile reorder target must retain its minimum height');
        }
    };
    for (const theme of ['native', 'aurora', 'neoraid']) {
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.reload({ waitUntil: 'load' });
        await page.evaluate(async () => { await window.FolderViewPlusSettingsRuntimeHydrationPromise; });
        await page.locator(`tbody#${tbody} tr[data-folder-id="leaf"]`).waitFor();
        await page.addStyleTag({ content: 'html{font-size:10px}.row-order-actions button{margin:10px 12px 10px 0}' });
        if (theme !== 'native') {
            await page.evaluate(() => {
                const button = document.createElement('button'); button.textContent = 'Native action'; document.body.prepend(button);
                document.documentElement.classList.add('Theme--black');
            });
            if (theme === 'aurora') {
                await page.addStyleTag({ content: aurora });
                await installHost(page, new URL(url).origin, '#fv-settings-root');
            } else {
                await installNeoraid(page, new URL(url).origin);
                await page.evaluate(() => {
                    window.nrTheme.preview({ mode: matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark' });
                    window.fixtureOrderBinding = window.FolderViewPlusThemeResolver.bindThemeAwareSurface({ root: '#fv-settings-root', sampleRoot: 'body', getMode: () => 'auto' });
                    window.fixtureOrderBinding.bind();
                });
            }
        }
        await verify(false);
        assert.equal(await page.locator(`tbody#${tbody} .folder-drag-handle`).first().getAttribute('draggable'), 'true');
        await page.evaluate(() => { window.fixtureTreeDialogs = []; window.swal = options => { window.fixtureTreeDialogs.push(options.title); return Promise.resolve(false); }; window.swal.close = () => {}; });
        const tree = page.locator(`tbody#${tbody} tr[data-folder-id="parent"] button[title^="Tree move"]`);
        await tree.click(); await tree.focus(); await tree.press('Enter');
        assert.deepEqual(await page.evaluate(() => window.fixtureTreeDialogs), ['Move folder', 'Move folder']);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator(`#${type}-tree-reorder-toggle`).evaluate(button => { if (button.getAttribute('aria-pressed') !== 'true') button.click(); });
        assert.equal(await page.locator(`#${type}-tree-reorder-toggle`).getAttribute('aria-pressed'), 'true');
        await page.locator(`tbody#${tbody} .fv-mobile-reorder-step`).first().waitFor({ state: 'visible' });
        await verify(true);
        await page.locator(`#${type}-tree-reorder-toggle`).evaluate(button => button.click());
        await page.evaluate(() => { window.fixtureOrderBinding?.disconnect(); window.fixtureHostBinding?.disconnect(); });
    }
};
