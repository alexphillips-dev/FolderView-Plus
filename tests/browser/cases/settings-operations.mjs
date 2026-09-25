import assert from 'node:assert/strict';

export const registerSettingsOperationsCase = ({ test, baseUrl }) => {
    test('Operations matches the two-card workflow across desktop, phone, and RTL layouts', async ({ page }) => {
        await page.goto(`${baseUrl}/settings`, { waitUntil: 'load' });
        await page.evaluate(async () => {
            const markup = await fetch('/plugin/FolderViewPlus.page').then((response) => response.text());
            const parsed = new DOMParser().parseFromString(markup, 'text/html');
            const hero = parsed.querySelector('.fv-operations-hero');
            const root = document.getElementById('fv-settings-root');
            root.innerHTML = hero.outerHTML + hero.nextElementSibling.outerHTML;
            root.querySelector('[data-fv-operations-source-toggle="docker"]').classList.add('is-active');
            root.querySelector('[data-fv-operations-panel="vm"]').hidden = true;
            document.getElementById('docker-runtime-folder').innerHTML = '<option>Audiobooks</option>';
            document.getElementById('docker-template-source-folder').innerHTML = '<option>Audiobooks</option>';
        });
        for (const viewport of [
            { width: 1912, dir: 'ltr', theme: 'dark', sideBySide: true },
            { width: 1440, dir: 'ltr', theme: 'light', sideBySide: true },
            { width: 390, dir: 'ltr', theme: 'dark', sideBySide: false },
            { width: 390, dir: 'rtl', theme: 'light', sideBySide: false }
        ]) {
            await page.setViewportSize({ width: viewport.width, height: 900 });
            await page.locator('#fv-settings-root').evaluate((root, state) => {
                root.dir = state.dir;
                root.dataset.fvThemeClass = state.theme;
                document.body.dataset.fvThemeClass = state.theme;
            }, viewport);
            const state = await page.evaluate(() => {
                const root = document.getElementById('fv-settings-root');
                const [actionCard, templateCard] = root.querySelectorAll('[data-fv-operations-panel="docker"] .fv-operations-stage');
                const actionBox = actionCard.getBoundingClientRect();
                const templateBox = templateCard.getBoundingClientRect();
                const controls = [
                    document.getElementById('docker-runtime-folder'),
                    document.getElementById('docker-runtime-action'),
                    document.getElementById('docker-template-source-folder'),
                    document.getElementById('docker-template-name'),
                    document.getElementById('docker-operations-template-search'),
                    document.getElementById('docker-runtime-apply'),
                    document.getElementById('docker-runtime-preview-output')
                ];
                return {
                    title: root.querySelector('h2').textContent.trim(),
                    sideBySide: Math.abs(actionBox.top - templateBox.top) <= 2,
                    applyVisible: !document.getElementById('docker-runtime-apply').hidden,
                    previewVisible: !document.getElementById('docker-runtime-preview-output').hidden,
                    templateNameVisible: document.getElementById('docker-template-name').getBoundingClientRect().height > 0,
                    fits: [actionCard, templateCard, ...controls].every((element) => {
                        const box = element.getBoundingClientRect();
                        return box.left >= -1 && box.right <= innerWidth + 1;
                    }),
                    overflow: document.documentElement.scrollWidth > innerWidth + 1
                };
            });
            assert.equal(state.title, 'Operations workspace');
            assert.equal(state.sideBySide, viewport.sideBySide, JSON.stringify({ viewport, state }));
            assert.equal(state.applyVisible && state.previewVisible && state.templateNameVisible, true);
            assert.equal(state.fits && !state.overflow, true, JSON.stringify({ viewport, state }));
        }
    });
};
