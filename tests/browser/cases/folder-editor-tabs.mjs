import assert from 'node:assert/strict';
export const registerFolderEditorTabCases = ({ test, baseUrl }) => {
    test('editor tabs use 1.3rem text and a border-only selected state', async ({ page }) => {
        await page.goto(`${baseUrl}/folder-editor`);
        await page.addStyleTag({ url: `${baseUrl}/plugin/styles/ui.primitives.css` });
        await page.addStyleTag({ url: `${baseUrl}/plugin/styles/ui.host-buttons.css` });
        await page.locator('#fvFolderEditorForm').evaluate(form => {
            document.getElementById('open-folder-actions').remove();
            form.innerHTML = '<nav class="fv-section-nav" aria-label="Editor sections"><button type="button" data-target="general" class="is-active" aria-current="page">General</button><button type="button" data-target="members">Members</button><button type="button" data-target="preview">Preview</button></nav>';
        });
        for (const theme of ['black', 'white']) for (const width of [1180, 390]) {
            await page.setViewportSize({ width, height: 800 });
            await page.evaluate(theme => document.documentElement.setAttribute('data-fvplus-host-theme', theme), theme);
            const result = await page.locator('.fv-section-nav').evaluate(nav => {
                const active = getComputedStyle(nav.children[0]), normal = getComputedStyle(nav.children[1]);
                return { font: parseFloat(active.fontSize), rem: parseFloat(getComputedStyle(document.documentElement).fontSize),
                    activeBackground: active.backgroundColor, normalBackground: normal.backgroundColor,
                    activeBorder: active.borderTopColor, normalBorder: normal.borderTopColor, shadow: active.boxShadow,
                    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
            });
            assert.ok(Math.abs(result.font - result.rem * 1.3) < 0.1);
            assert.equal(result.activeBackground, result.normalBackground);
            assert.notEqual(result.activeBorder, result.normalBorder);
            assert.equal(result.shadow, 'none');
            assert.equal(result.overflow, false);
        }
        await page.locator('.fv-section-nav button').first().focus();
        assert.notEqual(await page.locator('.fv-section-nav button').first().evaluate(button => getComputedStyle(button).outlineStyle), 'none');
    });
};
