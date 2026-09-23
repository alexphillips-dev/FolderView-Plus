import assert from 'node:assert/strict';

export const registerRecoverySupportCases = ({ test, baseUrl, loadI18n }) => {
    test('Activity History and Clear respond after successful actions and return to the empty state', async ({ page }) => {
        await page.goto(`${baseUrl}/settings`);
        await page.addScriptTag({ url: `${baseUrl}/vendor/jquery.js` });
        await page.evaluate(async () => {
            const parsed = new DOMParser().parseFromString(await fetch('/plugin/FolderViewPlus.page').then(r => r.text()), 'text/html');
            document.getElementById('fv-settings-root').innerHTML = parsed.getElementById('fv-activity-feed-panel').outerHTML;
            window.activityFeedEntries = [];
            Object.defineProperty(document, 'readyState', { configurable: true, get: () => 'loading' });
        });
        await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/folderviewplus.activity-diagnostics.js` });
        await page.evaluate(() => {
            delete document.readyState;
            const api = window.FolderViewPlusDiagnostics;
            window.FolderViewPlusCspEvents.registerActions({ toggleActivityCenterHistory: api.toggleActivityCenterHistory,
                clearActivityFeed: api.clearActivityFeed }, { owner: 'activity-fixture' });
            api.renderActivityFeed();
        });
        const history = page.locator('#fv-activity-center-toggle'), clear = page.locator('#fv-activity-center-clear');
        assert.equal(await history.isDisabled(), true);
        await page.evaluate(() => window.FolderViewPlusDiagnostics.addActivityEntry('Backup created', 'success'));
        assert.equal(await history.isDisabled(), false);
        await history.click();
        assert.equal(await history.getAttribute('aria-expanded'), 'true');
        assert.equal(await page.locator('#fv-activity-feed-list').isVisible(), true);
        await history.click();
        assert.equal(await history.getAttribute('aria-expanded'), 'false');
        await clear.click();
        assert.equal(await history.isDisabled(), true);
        assert.equal(await clear.isDisabled(), true);
        assert.equal(await page.locator('#fv-activity-feed-list li').count(), 0);
    });

    test('German Dashboard options wrap inside a narrow widget and member icons retain padding', async ({ page }) => {
        await page.goto(`${baseUrl}/dashboard-layout`);
        await loadI18n(page, baseUrl);
        await page.addStyleTag({ content: 'body button{white-space:nowrap;letter-spacing:2px;text-transform:uppercase}' });
        await page.evaluate(async () => {
            await window.FolderViewPlusI18n.configure({ requestedLocale: 'de', resolvedLocale: 'de', fallbackChain: ['de', 'en'],
                namespaces: ['common', 'dashboard', 'legacy-surface'], assets: ['en', 'de'].flatMap(locale =>
                    ['common', 'dashboard', 'legacy-surface'].map(namespace => ({ locale, namespace, url: `/plugin/langs/namespaces/${locale}/${namespace}.json` }))) });
            window.fixtureDashboardLayout.resize(440);
        });
        await page.locator('[data-fv-quick-action="view-options"]').first().click();
        const popover = page.locator('.fv-dashboard-view-popover-shell');
        await popover.waitFor();
        for (const width of [1180, 390]) {
            await page.setViewportSize({ width, height: 800 });
            const overflow = await popover.locator('button').evaluateAll(buttons => buttons.some(button => button.scrollWidth > button.clientWidth + 2));
            assert.equal(overflow, false);
        }
        await page.keyboard.press('Escape');
        const padding = await page.locator('#fixture-running-member').evaluate(member => {
            const outer = member.getBoundingClientRect(), icon = member.querySelector('.img').getBoundingClientRect();
            return { left: icon.left - outer.left, top: icon.top - outer.top };
        });
        assert.ok(padding.left >= 5 && padding.top >= 5, JSON.stringify(padding));
    });

    for (const locale of ['de', 'fr', 'ar', 'ja']) {
        test(`${locale} Recovery renders translated controls immediately and preserves focus on refresh`, async ({ page }) => {
            await page.goto(`${baseUrl}/settings`);
            await loadI18n(page, baseUrl);
            await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/folderviewplus.environment.js` });
            await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/folderviewplus.settings-workspaces.js` });
            await page.evaluate(async locale => {
                const namespaces = ['common', 'settings', 'diagnostics', 'import', 'legacy-surface'];
                document.getElementById('fv-settings-root').replaceChildren();
                await window.FolderViewPlusI18n.configure({ requestedLocale: locale, resolvedLocale: locale,
                    fallbackChain: [locale, 'en'], namespaces,
                    assets: ['en', locale].flatMap(language => [{ locale: language, namespace: 'legacy', url: `/plugin/langs/${language}.json` }, ...namespaces.map(namespace => ({
                        locale: language, namespace, url: `/plugin/langs/namespaces/${language}/${namespace}.json`
                    }))]) });
                const root = document.getElementById('fv-settings-root');
                root.innerHTML = '<div id="fv-recovery-overview"></div><div id="fv-recovery-backup-list"></div><p id="fv-recovery-history-summary"></p><div id="fv-recovery-environment-summary"></div>';
                const escapeHtml = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
                window.recovery = window.FolderViewPlusSettingsWorkspaces.createApi({ window, document, $: window.jQuery, escapeHtml,
                    apiGetJson: async () => ({ snapshot: { kind: 'environment_snapshot', schemaVersion: 1, types: { docker: { folders: {}, prefs: {} }, vm: { folders: {}, prefs: {} } }, themeWorkspace: {} },
                        summary: { exportedAt: '2026-09-18T05:18:26Z', pluginVersion: 'fixture', themeWorkspace: { activeThemeName: 'User theme' } } }),
                    getSortedBackupsForType: () => [{ name: 'fixture.json', count: 2, reason: 'manual', createdAt: '2026-09-18T05:18:26Z' }],
                    getFolderMap: () => ({ one: {}, two: {} }), formatTimestamp: value => window.FolderViewPlusI18n.formatDate(value) });
            }, locale);
            const result = await page.evaluate(async () => {
                await window.recovery.exportEnvironmentSnapshot();
                window.recovery.renderRecoveryWorkspace('docker');
                const picker = document.getElementById('recovery-backup-entry-select');
                picker.focus();
                const before = document.getElementById('fv-recovery-backup-list').textContent;
                window.recovery.renderRecoveryWorkspace('docker');
                return { before, after: document.getElementById('fv-recovery-backup-list').textContent,
                    environment: document.getElementById('fv-recovery-environment-summary').textContent,
                    preserved: document.activeElement === picker && picker.isConnected,
                    missing: window.FolderViewPlusI18n.snapshot().recentMissingKeys };
            });
            assert.doesNotMatch(result.before, /Choose snapshot|Recent snapshots|Delete all backups/);
            assert.doesNotMatch(result.environment, /Export ready|FolderView Plus Environment snapshot|Theme:|\bcreated\b/);
            assert.match(result.environment, /User theme/);
            assert.equal(result.before, result.after);
            assert.equal(result.preserved, true);
            assert.deepEqual(result.missing, []);
        });
    }

    test('plugin button themes resist native skins while native controls remain unchanged', async ({ page }) => {
        await page.goto(`${baseUrl}/settings`);
        await loadI18n(page, baseUrl);
        await page.addStyleTag({ content: `body button, body input[type=submit] {
            background: linear-gradient(red, blue) !important; color: red !important;
            border: 3px double red !important; letter-spacing: 3px !important;
            text-transform: uppercase !important; white-space: nowrap !important;
            clip-path: polygon(8% 0, 100% 0, 92% 100%, 0 100%);
        }` });
        await page.evaluate(async () => {
            const root = document.getElementById('fv-settings-root');
            const parsed = new DOMParser().parseFromString(await fetch('/plugin/FolderViewPlus.page').then(r => r.text()), 'text/html');
            root.innerHTML = parsed.getElementById('fv-activity-feed-panel').outerHTML
                + '<button type="button">Lange übersetzte Schaltfläche zur Wiederherstellung</button><input type="submit" value="Speichern">'
                + '<button id="selected-fixture" class="is-selected">Selected</button><button id="danger-fixture" class="fv-ui-button is-danger">Delete</button>';
            document.body.insertAdjacentHTML('beforeend', '<button id="native-sentinel">Native host</button>');
            window.FolderViewPlusUI.openModal({ title: 'Theme fixture', content: '<p>Modal controls</p>',
                actions: window.FolderViewPlusUI.button({ label: 'Wiederherstellung überprüfen und bestätigen' }) });
        });
        for (const width of [1180, 390]) {
            await page.setViewportSize({ width, height: 800 });
            const styles = await page.evaluate(() => ({
                native: getComputedStyle(document.getElementById('native-sentinel')).backgroundImage,
                buttons: [...document.querySelectorAll('#fv-settings-root button, #fv-settings-root input[type=submit], .fv-ui-modal button')]
                    .filter(button => button.getClientRects().length).map(button => {
                        const style = getComputedStyle(button);
                        return { image: style.backgroundImage,
                            clip: style.clipPath, overflow: button.scrollWidth > button.clientWidth + 2 };
                    }),
                close: document.querySelector('.fv-ui-modal-close').getBoundingClientRect().width,
                selected: getComputedStyle(document.getElementById('selected-fixture')).backgroundColor,
                normal: getComputedStyle(document.querySelector('#fv-settings-root input')).backgroundColor,
                danger: getComputedStyle(document.getElementById('danger-fixture')).color,
                normalText: getComputedStyle(document.getElementById('selected-fixture')).color
            }));
            assert.match(styles.native, /gradient/);
            for (const button of styles.buttons) assert.deepEqual(button, { image: 'none', clip: 'none', overflow: false });
            assert.equal(styles.close, 32);
            assert.notEqual(styles.selected, styles.normal);
            assert.notEqual(styles.danger, styles.normalText);
        }
        await page.keyboard.press('Escape');
    });

    test('button fallback preserves main typography and component skins across themes and narrow layouts', async ({ page }) => {
        await page.goto(`${baseUrl}/settings`);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.addStyleTag({ url: `${baseUrl}/plugin/styles/folder.css` });
        await page.addStyleTag({ url: `${baseUrl}/plugin/styles/dashboard.css` });
        await page.evaluate(() => {
            document.getElementById('fv-settings-root').innerHTML = `
                <button class="fv-ui-button">Restore latest backup</button>
                <button class="fv-ui-button is-primary">Restore</button>
                <div class="backup-actions"><button>Download</button></div>
                <div class="fv-diagnostics-toolbar"><button class="fv-ui-button">Run health check</button></div>
                <div class="fv-dashboard-view-popover"><button class="fv-dashboard-view-option is-active"><i></i><span><strong>Running only</strong></span><i></i></button></div>
                <form id="fvFolderEditorForm" class="folder-editor-form"><button class="fv-webui-profile-button">Add profile</button></form>`;
        });
        const capture = () => page.locator('#fv-settings-root button').evaluateAll(buttons => buttons.map(button => {
            const s = getComputedStyle(button), box = button.getBoundingClientRect();
            return { font: s.fontSize, weight: s.fontWeight, transform: s.textTransform, spacing: s.letterSpacing,
                line: s.lineHeight, padding: s.padding, color: s.color, background: s.backgroundColor,
                border: s.border, radius: s.borderRadius, shadow: s.boxShadow, width: box.width, height: box.height };
        }));
        for (const theme of ['black', 'white']) for (const width of [1180, 390]) {
            await page.setViewportSize({ width, height: 800 });
            await page.evaluate(theme => {
                document.documentElement.dataset.fvplusHostTheme = theme;
                document.querySelector('link[href$="ui.host-buttons.css"]').disabled = true;
            }, theme);
            const baseline = await capture();
            await page.evaluate(() => { document.querySelector('link[href$="ui.host-buttons.css"]').disabled = false; });
            const styled = await capture();
            assert.deepEqual(styled, baseline);
            assert.equal(styled[0].transform, 'uppercase');
            assert.ok(Math.abs(parseFloat(styled[0].spacing) - parseFloat(styled[0].font) * 0.05) < 0.01);
            assert.ok(styled[0].height >= 34);
            assert.ok(styled[3].height >= 36);
            await page.locator('.backup-actions button').hover();
            const hovered = await capture();
            await page.evaluate(() => { document.querySelector('link[href$="ui.host-buttons.css"]').disabled = true; });
            assert.deepEqual(await capture(), hovered);
            await page.mouse.move(0, 0);
        }
    });

    test('component button skins preserve minimal chevrons, semantic status colors and unboxed pin switches', async ({ page }) => {
        await page.goto(`${baseUrl}/settings`);
        await page.addStyleTag({ url: `${baseUrl}/plugin/styles/runtime.shared.css` });
        await page.evaluate(() => {
            document.getElementById('fv-settings-root').innerHTML = `
                <button class="folder-dropdown" data-fv-onclick="fixture" aria-label="Expand folder"
                    style="--fvplus-folder-dropdown-border-width:0px;--fvplus-folder-dropdown-border-color:transparent;
                    --fvplus-folder-dropdown-bg:transparent;--fvplus-folder-dropdown-shadow:none;
                    --fvplus-folder-dropdown-color:#12ab34;--fvplus-folder-dropdown-hover-color:#12ab34;
                    --fvplus-folder-dropdown-hover-border-color:transparent;--fvplus-folder-dropdown-hover-bg:transparent;
                    --fvplus-folder-dropdown-hover-shadow:none">⌄</button>
                <button class="folder-runtime-status status-chip is-started">Running</button>
                <button class="folder-runtime-status status-chip is-stopped">Stopped</button>
                <button class="folder-runtime-status status-chip is-mixed">Mixed</button>
                <button class="folder-metric-chip health-chip is-ok">Healthy</button>
                <button class="folder-metric-chip health-chip is-danger">Critical</button>
                <button class="folder-pin-switch" role="switch" aria-checked="false" aria-label="Pin folder">
                    <span class="folder-pin-switch-track"><span class="folder-pin-switch-knob"></span></span>
                </button>`;
        });
        const capture = () => page.locator('#fv-settings-root button').evaluateAll(buttons => buttons.map(button => {
            const style = getComputedStyle(button);
            return { color: style.color, background: style.backgroundColor, border: style.borderTopWidth,
                borderColor: style.borderTopColor, radius: style.borderRadius, padding: style.padding, shadow: style.boxShadow };
        }));
        for (const width of [1180, 390]) {
            await page.setViewportSize({ width, height: 800 });
            await page.evaluate(() => { document.querySelector('link[href$="ui.host-buttons.css"]').disabled = true; });
            const componentStyles = await capture();
            assert.equal(componentStyles[0].color, 'rgb(18, 171, 52)');
            assert.equal(componentStyles[0].border, '0px');
            assert.notEqual(componentStyles[1].color, componentStyles[2].color);
            assert.notEqual(componentStyles[3].color, componentStyles[1].color);
            assert.notEqual(componentStyles[4].color, componentStyles[5].color);
            assert.equal(componentStyles[6].border, '0px');
            await page.evaluate(() => { document.querySelector('link[href$="ui.host-buttons.css"]').disabled = false; });
            assert.deepEqual(await capture(), componentStyles);
            await page.locator('.folder-dropdown').hover();
            assert.equal((await capture())[0].color, 'rgb(18, 171, 52)');
            assert.equal((await capture())[0].background, 'rgba(0, 0, 0, 0)');
            await page.locator('.folder-pin-switch').hover();
            assert.equal((await capture())[6].border, '0px');
            assert.equal((await capture())[6].background, 'rgba(0, 0, 0, 0)');
            await page.mouse.move(0, 0);
        }
        await page.locator('.folder-pin-switch').focus();
        assert.notEqual(await page.locator('.folder-pin-switch').evaluate(button => getComputedStyle(button).outlineStyle), 'none');
    });

    test('theme update with no available updates makes no mutation request', async ({ page }) => {
        await page.goto(`${baseUrl}/settings`);
        await page.addScriptTag({ url: `${baseUrl}/vendor/jquery.js` });
        for (const script of ['folderviewplus.theme-profiles', 'folderviewplus.theme-workspace']) {
            await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/${script}.js` });
        }
        await page.evaluate(() => {
            const root = document.getElementById('fv-settings-root');
            root.innerHTML = '<button id="fv-theme-update-available">Update</button><p id="fv-theme-workspace-status"></p>';
            window.themeRequests = [];
            window.theme = window.FolderViewPlusThemeWorkspace.createApi({ document, $: window.jQuery,
                apiPostJson: async (_url, payload) => { window.themeRequests.push(payload); return {}; } });
            window.theme.bindEvents(); window.theme.setWorkspace({ themes: [] });
            window.jQuery('#fv-theme-update-available').triggerHandler('click');
        });
        assert.equal(await page.locator('#fv-theme-update-available').isDisabled(), true);
        assert.equal(await page.evaluate(() => window.themeRequests.length), 0);
    });
};
