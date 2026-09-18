import assert from 'node:assert/strict';
import { registerDiagnosticsOrphanFixtureCases } from './diagnostics-orphans.mjs';
import { registerLocalizedEditorStateCases } from './localization-editor-state.mjs';
import { registerLocalizationAuditCases } from './localization-audit.mjs';
import { registerLocalizationRepairBoundaryCases } from './localization-repair-boundaries.mjs';

const loadI18n = async (page, baseUrl) => {
    await page.addScriptTag({ url: baseUrl + '/vendor/jquery.js' });
    for (const script of ['CLDRPluralRuleParser', 'jquery.i18n', 'jquery.i18n.messagestore',
        'jquery.i18n.fallbacks', 'jquery.i18n.language', 'jquery.i18n.parser',
        'jquery.i18n.emitter', 'jquery.i18n.emitter.bidi']) {
        await page.addScriptTag({ url: baseUrl + '/plugin/scripts/include/' + script + '.js' });
    }
    await page.addScriptTag({ url: baseUrl + '/plugin/scripts/folderviewplus.i18n.js' });
};

const configureGerman = (wait = true) => {
    const namespaces = ['common', 'settings', 'docker', 'diagnostics', 'legacy-surface'];
    const ready = window.FolderViewPlusI18n.configure({
        requestedLocale: 'de-DE', resolvedLocale: 'de', fallbackChain: ['de-DE', 'de', 'en'], namespaces,
        assets: ['en', 'de'].flatMap(locale => [
            { locale, namespace: 'legacy', url: '/plugin/langs/' + locale + '.json' },
            ...namespaces.map(namespace => ({ locale, namespace,
                url: '/plugin/langs/namespaces/' + locale + '/' + namespace + '.json' }))
        ])
    });
    if (wait) return ready;
    window.catalogReady = ready;
};

export const registerLocalizationWorkspaceFixtureCases = ({ test, baseUrl }) => {
    registerLocalizedEditorStateCases({ test, baseUrl, loadI18n });
    registerLocalizationAuditCases({ test, baseUrl, loadI18n });
    registerLocalizationRepairBoundaryCases({ test, baseUrl, loadI18n });
    registerDiagnosticsOrphanFixtureCases({ test, baseUrl });
    test('delayed German catalogs translate Docker controls in place across navigation', async ({ page }) => {
        for (let visit = 0; visit < 2; visit += 1) {
            await page.goto(baseUrl + '/runtime');
            await loadI18n(page, baseUrl);
            await page.addScriptTag({ url: baseUrl + '/plugin/scripts/docker.runtime.action-bar.js' });
            await page.evaluate(() => {
                let release;
                const gate = new Promise(resolve => { release = resolve; });
                window.releaseGerman = release;
                const nativeFetch = window.fetch.bind(window);
                window.fetch = async (url, options) => {
                    if (String(url).includes('/namespaces/de/')) {
                        window.germanRequested = true;
                        await gate;
                    }
                    return nativeFetch(url, options);
                };
            });
            // Keep configure pending without blocking the browser test.
            await page.evaluate(configureGerman, false);
            await page.waitForFunction(() => window.germanRequested === true);
            await page.evaluate(() => {
                document.body.insertAdjacentHTML('beforeend', '<p class="appname">Expand All</p>');
                window.actions = window.FolderViewPlusDockerRuntimeActionBar.createApi({ window, document });
                window.actions.sync();
                window.originalExpand = document.querySelector('[data-fvplus-docker-action="expand-all"]');
                window.originalExpand.focus();
                const label = document.createElement('p');
                label.id = 'early-health';
                label.textContent = window.FolderViewPlusI18n.t('common.health.folder-summary',
                    'Folder health: $1 started | $2 paused | $3 stopped', 0, 0, 3);
                document.body.append(label);
            });
            assert.match(await page.locator('[data-fvplus-docker-action="expand-all"]').innerText(), /Expand All/i);
            await page.evaluate(async () => { window.releaseGerman(); await window.catalogReady; });
            assert.match(await page.locator('[data-fvplus-docker-action="expand-all"]').textContent(), /Alles erweitern/);
            assert.match(await page.locator('#early-health').innerText(), /Ordnerstatus: 0 gestartet.*3 gestoppt/);
            assert.equal(await page.locator('.appname').last().innerText(), 'Expand All', 'user names must remain unchanged');
            assert.equal(await page.evaluate(() => document.activeElement === window.originalExpand
                && document.querySelector('[data-fvplus-docker-action="expand-all"]') === window.originalExpand), true);
            assert.equal(await page.evaluate(() => window.FolderViewPlusI18n.snapshot().missingKeyCount), 0);
        }
    });

    test('German workspaces use production markup and fit long labels at desktop and phone widths', async ({ page }) => {
        await page.goto(baseUrl + '/settings');
        await loadI18n(page, baseUrl);
        for (const name of ['folderviewplus.theme-profiles', 'folderviewplus.theme-workspace', 'folderviewplus.settings-workspaces']) {
            await page.addScriptTag({ url: baseUrl + '/plugin/scripts/' + name + '.js' });
        }
        await page.addStyleTag({ url: baseUrl + '/plugin/styles/theme-profiles.css' });
        await page.addStyleTag({ content: 'html{font-size:10px}body{font-size:13px}button[type="button"]{white-space:nowrap;letter-spacing:1.8px;text-transform:uppercase}' });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.evaluate(configureGerman);
        await page.evaluate(async () => {
            const source = await fetch('/plugin/FolderViewPlus.page').then(response => response.text());
            const parsed = new DOMParser().parseFromString(source, 'text/html');
            const root = document.getElementById('fv-settings-root');
            root.innerHTML = ['fv-activity-feed-panel', 'fv-theme-workspace-panel']
                .map(id => parsed.getElementById(id).outerHTML).join('')
                + '<section id="german-recovery"></section><section id="german-operations"></section><section id="german-support"></section>';
            const escapeHtml = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;').replaceAll('"', '&quot;');
            const t = (...args) => window.FolderViewPlusI18n.t(...args);
            window.themeSaves = [];
            window.germanTheme = window.FolderViewPlusThemeWorkspace.createApi({ document, $: window.jQuery, escapeHtml,
                apiPostJson: async (_url, payload) => {
                    window.themeSaves.push(payload);
                    return { workspace: window.germanTheme.getWorkspace() };
                }
            });
            window.germanTheme.bindEvents();
            window.germanTheme.setWorkspace({ variables: {
                '--fvplus-status-paused': '#f0c04a', '--fvplus-status-stopped': '#ff7373'
            } });
            const folders = { one: { name: 'History' }, two: { name: '<private>' } };
            const backup = { name: 'fixture-before-repair.json', reason: 'before-repair-orphaned-members', count: 2, createdAt: '2026-09-12T18:34:08Z' };
            const workspace = window.FolderViewPlusSettingsWorkspaces.createApi({
                window, document, $: window.jQuery, escapeHtml, getFolderMap: () => folders,
                getSortedBackupsForType: () => [backup], formatTimestamp: () => '12.9.2026, 18:34:08'
            });
            document.getElementById('german-recovery').innerHTML = workspace.buildRecoveryOverviewHtml('docker')
                + workspace.buildRecoveryBackupHistoryHtml('vm');
            document.getElementById('german-operations').innerHTML = workspace.buildOperationsOverviewHtml('vm');
            const preview = window.FolderViewPlusSupportBundlePreview.createApi({ t, escapeHtml });
            const bundle = { bundleMeta: { privacyMode: 'sanitized', previewOnly: true }, system: {}, pluginState: {},
                runtimeState: {}, uiTelemetry: {}, healthAndHistory: {}, redactionManifest: {} };
            document.getElementById('german-support').innerHTML = preview.buildSupportBundleOverviewHtml(bundle)
                + preview.buildSupportBundleRedactionPreviewHtml(bundle);
            window.FolderViewPlusI18n.translate(root);
            window.originalProfiles = JSON.stringify(window.germanTheme.getWorkspace().profiles);
        });
        assert.match(await page.locator('#fv-activity-center-toggle').textContent(), /Verlauf/);
        assert.equal((await page.locator('#fv-activity-center-clear').textContent()).trim(), 'Leeren');
        assert.match(await page.locator('#german-recovery').innerText(), /Vor dem Entfernen fehlender Verweise/);
        assert.match(await page.locator('#german-recovery').innerText(), /Aktuelle Ordner: 2/);
        assert.match(await page.locator('#german-operations').innerText(), /Noch keine gespeicherten VM-Vorlagen/);
        assert.match(await page.locator('#fv-theme-workspace-summary').innerText(), /Standardprofil \/ Global/);
        assert.equal(await page.locator('.fv-support-bundle-section-badge').first().innerText(), 'Enthalten');
        await page.locator('#fv-theme-profile-name').fill('History');
        await page.locator('#fv-theme-profile-name').focus();
        for (const width of [1670, 1400, 1180, 1000, 375, 320]) {
            await page.setViewportSize({ width, height: 939 });
            const metrics = await page.evaluate(() => {
                const bounds = node => node.getBoundingClientRect();
                const inside = (child, parent) => {
                    const c = bounds(child), p = bounds(parent);
                    return c.left >= p.left - 1 && c.right <= p.right + 1;
                };
                return {
                    badgesFit: [...document.querySelectorAll('.fv-support-bundle-section-badge')]
                        .every(node => inside(node, node.closest('.fv-support-bundle-section-card'))),
                    buttonsFit: [...document.querySelectorAll('.fv-theme-module button, .fv-theme-profile-toolbar button')]
                        .every(node => inside(node, node.closest('.fv-theme-module')) && node.scrollWidth <= node.clientWidth + 1),
                    themeFits: document.getElementById('fv-theme-workspace-panel').scrollWidth <= document.documentElement.clientWidth,
                    focused: document.activeElement?.id,
                    profileName: document.getElementById('fv-theme-profile-name').value,
                    profilesUnchanged: JSON.stringify(window.germanTheme.getWorkspace().profiles) === window.originalProfiles
                };
            });
            assert.equal(metrics.badgesFit, true, 'support badges must fit at ' + width);
            assert.equal(metrics.buttonsFit, true, 'Appearance button labels must fit at ' + width);
            assert.equal(metrics.themeFits, true, 'Appearance must not overflow at ' + width);
            assert.equal(metrics.focused, 'fv-theme-profile-name');
            assert.equal(metrics.profileName, 'History');
            assert.equal(metrics.profilesUnchanged, true);
        }
        await page.evaluate(() => {
            const profile = window.germanTheme.getWorkspace().profiles[0];
            window.germanTheme.setWorkspace({ profiles: [{ ...profile, id: 'personal', name: 'History' }], activeProfileId: 'personal' });
            window.FolderViewPlusI18n.translate(document.getElementById('fv-theme-workspace-panel'));
        });
        assert.equal(await page.locator('#fv-theme-profile-select option:checked').textContent(), 'History');
        assert.match(await page.locator('#fv-theme-workspace-summary').textContent(), /History \/ Global/);
        await page.locator('#fv-theme-profile-scope').selectOption('docker');
        await page.locator('[data-fv-theme-preset="blue"]').focus();
        await page.evaluate(() => { window.presetButton = document.activeElement; });
        await page.keyboard.press('Enter');
        assert.equal(await page.evaluate(() => document.activeElement === window.presetButton && window.presetButton.isConnected), true);
        assert.equal(await page.locator('[data-fv-theme-preset="blue"]').getAttribute('aria-pressed'), 'true');
        assert.equal(await page.evaluate(() => window.themeSaves.length), 0);
        await page.locator('#fv-theme-custom-css').fill('.fixture-custom { opacity: .95; }');
        await page.locator('[data-fv-theme-preset="green"]').click();
        assert.equal(await page.locator('#fv-theme-custom-css').inputValue(), '.fixture-custom { opacity: .95; }');
        await page.locator('#fv-theme-preset-undo').click();
        assert.equal(await page.evaluate(() => window.germanTheme.getWorkspace().profiles[0].layers.docker.variables['--fvplus-theme-accent']), undefined);
        await page.locator('[data-fv-theme-preset="green"]').click();
        await page.locator('#fv-theme-profile-name').fill('Green copy');
        await page.locator('#fv-theme-save-as-profile').click();
        await page.waitForFunction(() => window.themeSaves.length === 1 && !document.getElementById('fv-theme-save-as-profile').disabled);
        const saved = await page.evaluate(() => window.themeSaves[0]);
        assert.equal(saved.action, 'create_profile');
        assert.equal(saved.sourceProfileId, 'personal');
        assert.equal(saved.scope, 'docker');
        assert.equal(saved.name, 'Green copy');
        assert.equal(JSON.parse(saved.variables)['--fvplus-theme-accent'], '#22c55e');
        assert.equal(await page.evaluate(() => window.FolderViewPlusI18n.snapshot().missingKeyCount), 0);
    });
};
