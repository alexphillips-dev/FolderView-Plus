import assert from 'node:assert/strict';

export const registerSettingsOperationsCase = ({ test, baseUrl }) => {
    test('Operations keeps the action flow readable across desktop, phone, and RTL layouts', async ({ page }) => {
        await page.goto(`${baseUrl}/settings`, { waitUntil: 'load' });
        await page.evaluate(async () => {
            const markup = await fetch('/plugin/FolderViewPlus.page').then((response) => response.text());
            const parsed = new DOMParser().parseFromString(markup, 'text/html');
            const title = parsed.querySelector('[data-fv-section="runtime-actions"]');
            const root = document.getElementById('fv-settings-root');
            root.innerHTML = title.outerHTML + title.nextElementSibling.outerHTML;
            root.querySelector('[data-fv-operations-panel="vm"]').hidden = true;
        });
        const inspect = async () => page.evaluate(() => {
            const root = document.getElementById('fv-settings-root');
            const stage = root.querySelector('.fv-operations-stage');
            const secondStage = root.querySelectorAll('.fv-operations-stage')[1];
            const folder = document.getElementById('docker-runtime-folder');
            const action = document.getElementById('docker-runtime-action');
            const inside = (element) => {
                const box = element.getBoundingClientRect();
                return box.left >= -1 && box.right <= innerWidth + 1;
            };
            return {
                title: root.querySelector('h2').textContent.trim(),
                stageColumns: getComputedStyle(root.querySelector('.fv-operations-stage-grid')).gridTemplateColumns.split(' ').length,
                stacked: secondStage.getBoundingClientRect().top >= stage.getBoundingClientRect().bottom - 1,
                labels: [folder.labels[0]?.firstChild.textContent.trim(), action.labels[0]?.firstChild.textContent.trim()],
                applyHidden: document.getElementById('docker-runtime-apply').hidden,
                previewHidden: document.getElementById('docker-runtime-preview-output').hidden,
                detailsClosed: !document.getElementById('docker-operations-template-create').open,
                fits: [stage, secondStage, folder, action].every(inside),
                overflow: document.documentElement.scrollWidth > innerWidth + 1,
                widths: [root, stage, secondStage, folder, action].map((element) => {
                    const box = element.getBoundingClientRect();
                    return [element.id || element.className, Math.round(box.left), Math.round(box.right)];
                })
            };
        });
        for (const viewport of [{ width: 1440, dir: 'ltr' }, { width: 390, dir: 'ltr' }, { width: 390, dir: 'rtl' }]) {
            await page.setViewportSize({ width: viewport.width, height: 900 });
            await page.locator('#fv-settings-root').evaluate((root, dir) => { root.dir = dir; }, viewport.dir);
            const state = await inspect();
            assert.equal(state.title, 'Operations');
            assert.equal(state.stageColumns, 1);
            assert.equal(state.stacked, true);
            assert.deepEqual(state.labels, ['Folder', 'Action']);
            assert.equal(state.applyHidden && state.previewHidden && state.detailsClosed, true);
            assert.equal(state.fits && !state.overflow, true, JSON.stringify({ viewport, state }));
        }
        await page.locator('#docker-operations-template-create > summary').click();
        assert.equal(await page.locator('#docker-operations-template-create').evaluate((details) => details.open), true);
        assert.equal(await page.locator('#docker-template-name').isVisible(), true);
    });
};
