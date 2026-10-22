import assert from 'node:assert/strict';
import fs from 'node:fs';

const settingsSource = fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.js', 'utf8');
const functions = ['getSettingsSectionRegistrySignature', 'buildSettingsSections', 'getVisibleSections', 'renderAdvancedNav', 'readSettingsLaunchOverrides']
    .map(name => {
        const start = settingsSource.indexOf(`const ${name} = `);
        const end = settingsSource.indexOf('\nconst ', start + 1);
        assert.ok(start >= 0 && end > start, name);
        return settingsSource.slice(start, end);
    }).join('\n');

const mount = async (page, baseUrl) => {
    await page.goto(`${baseUrl}/settings?fvMode=advanced&fvAdvancedTab=themes`);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const script of ['folderviewplus.settings-sections', 'folderviewplus.settings-search', 'folderviewplus.theme-host', 'folderviewplus.theme-surface', 'folderviewplus.theme-resolver', 'folderviewplus.theme-profiles', 'folderviewplus.theme-workspace']) {
        await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/${script}.js` });
    }
    await page.addScriptTag({ url: `${baseUrl}/vendor/jquery.js` });
    await page.addStyleTag({ url: `${baseUrl}/plugin/styles/theme-profiles.css` });
    await page.evaluate(async () => {
        const source = await fetch('/plugin/FolderViewPlus.page').then(response => response.text());
        const parsed = new DOMParser().parseFromString(source, 'text/html');
        const parts = ['[data-fv-section="themes"]', '#fv-theme-workspace-panel', '[data-fv-section="theme-workspace"]', '#fv-theme-appearance-panel'];
        document.getElementById('fv-settings-root').innerHTML = '<nav id="fv-advanced-nav" aria-label="Advanced sections"></nav><div id="fv-advanced-content">'
            + parts.map(selector => parsed.querySelector(selector).outerHTML).join('') + '</div>';
        document.documentElement.setAttribute('data-fvplus-host-theme', 'black');
        window.FolderViewPlusThemeResolver.applyResolvedThemeTokens('fixture', { root: '#fv-settings-root', sampleRoot: 'body' });
        window.themeCalls = [];
        window.themeErrors = [];
        window.themeState = { themes: [], activeThemeId: '' };
        window.themePost = async payload => {
            if (payload.action === 'preview_profile') return { plan: { changed: true, changedScopes: [payload.scope] } };
            return { workspace: window.themeState };
        };
        const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
        window.themeApi = window.FolderViewPlusThemeWorkspace.createApi({ window, document, $: window.jQuery, escapeHtml,
            apiGetJson: async () => ({ workspace: window.themeState }),
            apiPostJson: async (_url, payload) => { window.themeCalls.push(payload); return window.themePost(payload); },
            showError: (message, error) => window.themeErrors.push({ message, error: error.message })
        });
        const actions = { scanThemeWorkspaceGithub: () => themeApi.scanGithub(document.getElementById('fv-theme-github-source').value),
            importThemeWorkspaceGithub: () => themeApi.importGithub(document.getElementById('fv-theme-github-source').value),
            activateThemeWorkspaceTheme: id => themeApi.activateTheme(id), deactivateThemeWorkspaceTheme: () => themeApi.deactivateTheme(),
            deleteThemeWorkspaceTheme: id => themeApi.deleteTheme(id), updateThemeWorkspaceTheme: id => themeApi.updateTheme(id),
            checkThemeWorkspaceUpdates: () => themeApi.checkUpdates(), saveThemeWorkspaceCustomize: () => themeApi.saveCustomize(),
            resetThemeWorkspaceTokens: () => themeApi.resetTokens() };
        window.FolderViewPlusCspEvents.registerActions(actions, { owner: 'settings-theme-fixture' });
        themeApi.bindEvents();
        themeApi.bindEvents();
        themeApi.setWorkspace(window.themeState);
    });
    await page.addScriptTag({ content: `(() => {
        const $ = window.jQuery;
        const { ADVANCED_GROUPS, ADVANCED_GROUP_LABELS, ADVANCED_GROUP_BY_SECTION, ADVANCED_SECTION_KEYS, SETTINGS_SEARCH_ALIASES_BY_SECTION } = window.FolderViewPlusSettingsSections;
        const normalizeAdvancedGroup = value => ADVANCED_GROUPS.includes(value) ? value : 'operations';
        const settingsUiState = { mode: 'advanced', advancedTab: 'themes', query: '', sections: [], searchAllAdvanced: false };
        let settingsSectionRegistrySignature = '';
        const invalidateTrackedSettingsInputs = () => {};
        const invalidateSettingsSearchIndex = () => window.themeSearch?.invalidateIndex();
        const slugifySectionKey = value => value;
        const isBasicWorkspaceSection = section => ['docker', 'vms'].includes(section.key);
        const surfaceT = (_key, fallback) => fallback;
        const escapeHtml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
        const getSettingsSearchEvaluation = () => window.themeSearch.evaluate();
        ${functions}
        buildSettingsSections();
        settingsUiState.advancedTab = readSettingsLaunchOverrides().advancedTab;
        window.themeSearch = window.FolderViewPlusFoundationModules.settingsSearch.createApi({ window, document, getUiState: () => settingsUiState,
            isBasicWorkspaceSection, getSectionAliases: section => (SETTINGS_SEARCH_ALIASES_BY_SECTION[section.key] || []).join(' ') });
        const render = () => {
            const visible = new Set(getVisibleSections().map(section => section.key));
            for (const section of settingsUiState.sections) for (const node of section.nodes) node.classList.toggle('fv-section-hidden', !visible.has(section.key));
            renderAdvancedNav();
        };
        const activate = tab => { settingsUiState.advancedTab = normalizeAdvancedGroup(tab); render(); };
        $(document).on('click.themeFixture', '[data-fv-advanced-tab]', event => activate(event.currentTarget.dataset.fvAdvancedTab));
        $(document).on('change.themeFixture', '#fv-advanced-section-picker', event => activate(event.target.value));
        window.themeNavigation = { state: settingsUiState, render };
        render();
    })();` });
};

const chooseTab = async (page, tab) => {
    const button = page.locator(`[data-fv-advanced-tab="${tab}"]`);
    if (await button.isVisible()) await button.click();
    else await page.locator('#fv-advanced-section-picker').selectOption(tab);
};

export const registerSettingsThemeCases = ({ test, baseUrl }) => {
    test('Themes and Appearance route production sections, search and preserve customization drafts', async ({ page }) => {
        await mount(page, baseUrl);
        assert.equal(await page.locator('#fv-theme-workspace-panel').isVisible(), true);
        assert.equal(await page.locator('#fv-theme-profile-toolbar').isVisible(), false);
        assert.deepEqual(await page.locator('.fv-advanced-tab').evaluateAll(nodes => nodes.map(node => node.dataset.fvAdvancedTab)), ['themes', 'appearance']);
        await chooseTab(page, 'appearance');
        assert.equal(await page.locator('#fv-theme-github-source').isVisible(), false);
        await page.locator('#fv-theme-custom-css').fill('.draft { opacity: .92; }');
        await page.locator('[data-fv-theme-preset="blue"]').click();
        await chooseTab(page, 'themes');
        await chooseTab(page, 'appearance');
        assert.equal(await page.locator('#fv-theme-custom-css').inputValue(), '.draft { opacity: .92; }');
        assert.equal(await page.locator('[data-fv-theme-preset="blue"]').getAttribute('aria-pressed'), 'true');
        assert.equal(await page.evaluate(() => themeCalls.length), 0);
        const search = await page.evaluate(() => {
            themeNavigation.state.query = 'import theme';
            const current = themeSearch.evaluate().total;
            themeNavigation.state.searchAllAdvanced = true;
            return { current, across: [...themeSearch.evaluate().sectionKeys] };
        });
        assert.deepEqual(search, { current: 0, across: ['themes'] });
        await page.evaluate(() => { themeNavigation.state.query = ''; themeNavigation.state.searchAllAdvanced = false; themeNavigation.render(); });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    });

    test('Themes detects active Aurora independently from managed layers and disabled enhancements', async ({ page }) => {
        await mount(page, baseUrl);
        await page.route('**/plugins/Aurora-Theme/styles/*.css*', route => route.fulfill({ contentType: 'text/css', body: '/* isolated host stylesheet marker */' }));
        const activeLabel = () => page.locator('.fv-theme-summary-card strong').first().innerText();
        assert.equal(await activeLabel(), 'Unraid Black');
        await page.addStyleTag({ url: `${baseUrl}/plugins/Aurora-Theme/styles/enhance.css` });
        await page.evaluate(() => themeApi.renderSummary());
        assert.equal(await activeLabel(), 'Unraid Black', 'enhancements alone are not the active color theme');
        await page.addStyleTag({ url: `${baseUrl}/plugins/Aurora-Theme/styles/theme.css?v=123` });
        await page.evaluate(() => themeApi.renderWorkspace());
        assert.equal(await activeLabel(), 'Aurora Theme');
        assert.equal(await page.locator('.fv-theme-summary-card strong').nth(1).innerText(), 'None');
        assert.equal(await page.locator('#fv-theme-disable-managed').isDisabled(), true);
        assert.match(await page.locator('#fv-theme-workspace-status').innerText(), /Host theme: Aurora Theme/);
        await page.evaluate(() => { document.querySelector('link[href*="/Aurora-Theme/styles/theme.css"]').disabled = true; themeApi.renderSummary(); });
        assert.equal(await activeLabel(), 'Unraid Black');
        await page.evaluate(() => {
            document.querySelector('link[href*="/Aurora-Theme/styles/theme.css"]').remove();
            document.documentElement.setAttribute('data-fvplus-host-theme', 'white');
            document.body.setAttribute('data-fvplus-host-theme', 'white');
            window.FolderViewPlusThemeResolver.applyResolvedThemeTokens('fixture', { root: '#fv-settings-root', sampleRoot: 'body' });
            themeApi.renderSummary();
        });
        assert.equal(await activeLabel(), 'Unraid White');
        await page.waitForFunction(() => {
            const title = document.querySelector('.fv-theme-module-head .settings-mini-title');
            const probe = document.createElement('span');
            probe.style.color = 'var(--fvplus-settings-accent-strong)';
            title.parentNode.append(probe);
            const settled = getComputedStyle(title).color === getComputedStyle(probe).color;
            probe.remove();
            return settled;
        });
        await page.evaluate(async () => {
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            await Promise.all(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity)
                .map(animation => animation.finished.catch(() => {})));
        });
        assert.equal(await page.evaluate(() => themeApi.getWorkspace().themes.length), 0);
    });

    test('Themes managed controls scan, import, activate, update and delete through existing actions', async ({ page }) => {
        await mount(page, baseUrl);
        await page.evaluate(() => {
            const theme = { id: 'fixture', name: 'Fixture theme', files: [{ path: 'docker.css', tabs: ['docker'] }], source: { input: 'fixture/theme' } };
            window.themePost = async payload => {
                if (payload.action === 'scan_github') return { theme };
                if (payload.action === 'import_github') themeState = { ...themeApi.getWorkspace(), themes: [theme], activeThemeId: theme.id };
                if (payload.action === 'deactivate') themeState.activeThemeId = '';
                if (payload.action === 'activate') themeState.activeThemeId = payload.themeId;
                if (payload.action === 'check_updates') themeState.themes[0].updateAvailable = true;
                if (payload.action === 'update_theme' || payload.action === 'update_themes') themeState.themes[0].updateAvailable = false;
                if (payload.action === 'preview_theme_updates') return { plan: { updateCount: 1 } };
                if (payload.action === 'delete') themeState = { ...themeState, themes: [], activeThemeId: '' };
                return { workspace: structuredClone(themeState) };
            };
        });
        await page.locator('#fv-theme-github-source').fill('fixture/theme');
        await page.locator('[data-fv-onclick="scanThemeWorkspaceGithub()"]').click();
        await page.locator('#fv-theme-scan-result').waitFor({ state: 'visible' });
        assert.equal(await page.locator('.fv-theme-workspace-entry').count(), 0);
        await page.locator('[data-fv-onclick="importThemeWorkspaceGithub()"]').click();
        await page.locator('.fv-theme-workspace-entry.is-active').waitFor();
        await page.locator('#fv-theme-disable-managed').click();
        await page.waitForFunction(() => themeApi.getWorkspace().activeThemeId === '');
        await page.locator('[data-fv-onclick^="activateThemeWorkspaceTheme"]').click();
        await page.locator('.fv-theme-workspace-entry.is-active').waitFor();
        await page.locator('[data-fv-onclick="checkThemeWorkspaceUpdates()"]').click();
        await page.waitForFunction(() => !document.getElementById('fv-theme-update-available').disabled);
        await page.locator('#fv-theme-update-available').click();
        await page.waitForFunction(() => document.getElementById('fv-theme-update-available').disabled);
        await page.locator('[data-fv-onclick^="updateThemeWorkspaceTheme"]').click();
        await page.locator('[data-fv-onclick^="deleteThemeWorkspaceTheme"]').click();
        await page.waitForFunction(() => themeApi.getWorkspace().themes.length === 0);
        assert.deepEqual(await page.evaluate(() => themeCalls.map(call => call.action)), ['scan_github', 'import_github', 'deactivate', 'activate', 'check_updates', 'preview_theme_updates', 'update_themes', 'update_theme', 'delete']);
        assert.equal(await page.evaluate(() => themeErrors.length), 0);
    });

    test('Appearance keeps scoped preview, profile saves and errors visible after the tab split', async ({ page }) => {
        await mount(page, baseUrl);
        await chooseTab(page, 'appearance');
        await page.locator('#fv-theme-profile-scope').selectOption('docker');
        await page.locator('#fv-theme-custom-css').fill('.draft { opacity: .9; }');
        await page.locator('[data-fv-theme-preset="green"]').click();
        await page.locator('[data-fv-onclick="saveThemeWorkspaceCustomize()"]').click();
        await page.waitForFunction(() => themeCalls.length === 2);
        const saves = await page.evaluate(() => themeCalls);
        assert.deepEqual(saves.map(call => call.action), ['preview_profile', 'save_profile']);
        assert.equal(saves[1].scope, 'docker');
        assert.equal(saves[1].customCss, '.draft { opacity: .9; }');
        assert.equal(JSON.parse(saves[1].variables)['--fvplus-theme-accent'], '#22c55e');
        assert.match(await page.locator('#fv-theme-profile-plan').innerText(), /Customization layer saved/);
        await page.evaluate(async () => {
            window.themePost = async () => { throw new Error('Synthetic validation failure'); };
            try { await themeApi.saveCustomize(); } catch { /* expected error is displayed in Appearance */ }
        });
        assert.match(await page.locator('#fv-theme-profile-plan').innerText(), /failed/);
        assert.equal(await page.locator('#fv-theme-profile-plan').isVisible(), true);
        assert.equal(await page.evaluate(() => themeErrors.length), 1);
    });
};
