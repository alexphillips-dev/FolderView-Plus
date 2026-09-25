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
                const dockerTab = root.querySelector('[data-fv-operations-source-toggle="docker"]');
                const vmTab = root.querySelector('[data-fv-operations-source-toggle="vm"]');
                const folderSelect = document.getElementById('docker-runtime-folder');
                const previewTitle = root.querySelector('.fv-operations-preview-button > strong');
                const previewDescription = root.querySelector('.fv-operations-preview-button > span');
                return {
                    title: root.querySelector('h2').textContent.trim(),
                    sideBySide: Math.abs(actionBox.top - templateBox.top) <= 2,
                    applyVisible: !document.getElementById('docker-runtime-apply').hidden,
                    previewVisible: !document.getElementById('docker-runtime-preview-output').hidden,
                    templateNameVisible: document.getElementById('docker-template-name').getBoundingClientRect().height > 0,
                    dockerActive: dockerTab.getAttribute('aria-pressed') === 'true' && vmTab.getAttribute('aria-pressed') === 'false',
                    activeTabOrange: getComputedStyle(dockerTab).backgroundColor !== getComputedStyle(vmTab).backgroundColor,
                    controlHeight: folderSelect.getBoundingClientRect().height,
                    searchHeight: document.getElementById('docker-operations-template-search').getBoundingClientRect().height,
                    saveHeight: root.querySelector('[data-fv-operations-panel="docker"] .fv-operations-save-button').getBoundingClientRect().height,
                    selectBorder: getComputedStyle(folderSelect).borderTopWidth,
                    selectAppearance: getComputedStyle(folderSelect).appearance,
                    selectChevron: getComputedStyle(folderSelect.parentElement, '::after').content,
                    gearSize: parseFloat(getComputedStyle(root.querySelector('.fv-operations-hero-icon > .fa')).fontSize),
                    playSize: parseFloat(getComputedStyle(root.querySelector('.fv-operations-stage-icon > .fa')).fontSize),
                    previewTitleSize: parseFloat(getComputedStyle(previewTitle).fontSize),
                    previewDescriptionSize: parseFloat(getComputedStyle(previewDescription).fontSize),
                    helpSize: parseFloat(getComputedStyle(root.querySelector('.fv-operations-hero-help')).fontSize),
                    rootSize: parseFloat(getComputedStyle(document.documentElement).fontSize),
                    fits: [actionCard, templateCard, ...controls].every((element) => {
                        const box = element.getBoundingClientRect();
                        return box.left >= -1 && box.right <= innerWidth + 1;
                    }),
                    overflow: document.documentElement.scrollWidth > innerWidth + 1
                };
            });
            assert.equal(state.title, 'Operations');
            assert.equal(state.sideBySide, viewport.sideBySide, JSON.stringify({ viewport, state }));
            assert.equal(state.applyVisible && state.previewVisible && state.templateNameVisible, true);
            assert.equal(state.dockerActive && state.activeTabOrange, true, JSON.stringify({ viewport, state }));
            assert.deepEqual([state.controlHeight, state.searchHeight, state.saveHeight], [42, 42, 42], JSON.stringify({ viewport, state }));
            assert.equal(state.selectBorder, '1px');
            assert.equal(state.selectAppearance, 'none');
            assert.equal(state.selectChevron, '""');
            assert.ok(state.previewTitleSize > state.previewDescriptionSize && state.previewDescriptionSize >= state.rootSize);
            assert.ok(state.gearSize >= state.rootSize * 2 && state.playSize >= state.rootSize * 2);
            assert.ok(Math.abs(state.helpSize - state.rootSize * 1.2) <= 0.1);
            assert.equal(state.fits && !state.overflow, true, JSON.stringify({ viewport, state }));
        }
        const vmSelection = await page.evaluate(() => {
            const root = document.getElementById('fv-settings-root');
            const dockerTab = root.querySelector('[data-fv-operations-source-toggle="docker"]');
            const vmTab = root.querySelector('[data-fv-operations-source-toggle="vm"]');
            dockerTab.classList.remove('is-active');
            dockerTab.setAttribute('aria-pressed', 'false');
            vmTab.classList.add('is-active');
            vmTab.setAttribute('aria-pressed', 'true');
            return getComputedStyle(vmTab).backgroundColor !== getComputedStyle(dockerTab).backgroundColor;
        });
        assert.equal(vmSelection, true);
    });
};
