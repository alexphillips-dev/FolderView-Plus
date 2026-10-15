import assert from 'node:assert/strict';
import { mountIconBrowser } from '../helpers/icon-browser-host.mjs';
import { mountSettingsEditor } from '../helpers/folder-editor-settings-host.mjs';
const showSettings = async (page, baseUrl) => {
    await page.route(`${baseUrl}/settings-diagnostics`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><title>Settings diagnostics</title><body><main><h1>Diagnostics</h1></main></body></html>' }));
    await page.goto(`${baseUrl}/settings-diagnostics`);
};

export const registerEditorDiagnosticsCases = ({ test, baseUrl }) => {
    test('Editor diagnostics retain safe icon workflow and layout evidence after navigation to Settings', async ({ page }) => {
        for (const type of ['docker', 'vm']) {
            await mountIconBrowser(page, baseUrl, type);
            const input = page.locator('[name="icon"]'), original = await input.inputValue();
            const footer = page.locator('.fv-icon-browser-footer');
            await page.evaluate(() => { document.querySelector('[name="icon"]').title = 'private-name'; document.documentElement.dir = 'rtl'; });
            await page.locator('[data-icon-value$="?tools"]').click();
            await footer.getByRole('button', { name: 'Use icon', exact: true }).click();
            await footer.getByRole('button', { name: 'Cancel', exact: true }).click();
            assert.equal(await input.inputValue(), original);
            const initial = await page.evaluate(type => window.FolderViewPlusUiStateDiagnostics.collect().channels.editor[type], type);
            assert.equal(initial.latest.data.cancelRestored, true);
            assert.equal(initial.latest.data.cancelRestorationAttempted, true);
            assert.equal(initial.latest.data.applyCount, 1); assert.equal(initial.latest.data.cancelCount, 1);
            await page.evaluate(() => { window.dispatchEvent(new Event('pagehide')); window.dispatchEvent(new Event('pageshow')); });
            await page.locator('[data-icon-value$="?tools"]').click(); await footer.getByRole('button', { name: 'Use icon', exact: true }).click();
            await footer.getByRole('button', { name: 'Cancel', exact: true }).click();
            assert.equal(await page.evaluate(type => window.FolderViewPlusUiStateDiagnostics.collect().channels.editor[type].latest.data.applyCount, type), 2);
            await page.getByRole('tab', { name: 'My uploads', exact: true }).click();
            await page.evaluate(() => { window.iconBrowserFixture.uploads = [{ name: 'private-upload.png', url: '/plugins/folderview.plus/images/folder-icon.png?private-upload', usageCount: 0 }]; });
            await page.locator('#fv-custom-icon-refresh').click();
            await page.evaluate(() => { window.iconBrowserFixture.uploadFail = true; });
            await page.locator('#fv-icon-upload-file').setInputFiles({ name: 'private-failed.png', mimeType: 'image/png', buffer: Buffer.from('fixture') });
            await page.waitForFunction(type => window.FolderViewPlusUiStateDiagnostics.collect().channels.editor[type].latest.data.uploadErrorCount === 1, type);
            assert.equal(await page.evaluate(type => window.FolderViewPlusUiStateDiagnostics.collect().channels.editor[type].latest.data.reason, type), 'transport');
            await page.evaluate(() => { window.iconBrowserFixture.uploadFail = false; window.iconBrowserFixture.pending = true; });
            await page.locator('#fv-icon-upload-file').setInputFiles({ name: 'private-late.png', mimeType: 'image/png', buffer: Buffer.from('fixture') });
            await page.waitForFunction(() => typeof window.iconBrowserFixture.complete === 'function');
            await footer.getByRole('button', { name: 'Cancel', exact: true }).click();
            await page.evaluate(() => { window.iconBrowserFixture.complete(); window.iconBrowserFixture.pending = false; });
            await page.waitForFunction(type => window.FolderViewPlusUiStateDiagnostics.collect().channels.editor[type].latest.data.discardedCompletions > 0, type);
            assert.equal(await input.inputValue(), original);
            await page.locator('[data-custom-icon="private-upload.png"] [data-action="use"]').click();
            await footer.getByRole('button', { name: 'Use icon', exact: true }).click();
            await footer.getByRole('button', { name: 'Cancel', exact: true }).click();
            await page.evaluate(() => {
                const card = document.querySelector('.fv-custom-icon-row');
                for (let index = 0; index < 200; index++) card.parentElement.appendChild(card.cloneNode(true));
                card.querySelector('.fv-custom-icon-actions').style.gap = '80px'; window.dispatchEvent(new Event('resize'));
            });
            await page.waitForFunction(type => window.FolderViewPlusUiStateDiagnostics.collect().channels.editor[type].latest.data.overflowingButtonRows > 0, type);
            await showSettings(page, baseUrl);
            await page.evaluate(() => { window.FolderViewPlusFatalRuntimeContext = { pluginVersion: '2026.10.15.01' }; });
            for (const name of ['folderviewplus.editor-diagnostics-model', 'folderviewplus.ui-state-diagnostics', 'folderviewplus.support-bundle-telemetry']) await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/${name}.js` });
            const bundles = await page.evaluate(() => {
                const exporter = window.FolderViewPlusSupportBundleTelemetry.createApi({ normalizeSupportBundleV2Payload: value => ({ ...value }) });
                return ['sanitized', 'full'].map(privacyMode => exporter.collectSupportBundleUiTelemetry({ bundleMeta: { privacyMode }, uiTelemetry: {}, healthAndHistory: {}, redactionManifest: {} }));
            });
            for (const bundle of bundles) {
                const channel = bundle.uiTelemetry.uiState.channels.editor[type], data = channel.latest.data;
                assert.equal(channel.available, true); assert.equal(channel.versionMismatch, false);
                assert.equal(data.cancelRestored, true); assert.equal(data.captureReason, 'leave');
                assert.equal(data.source, 'uploads'); assert.equal(data.direction, 'rtl');
                assert.equal(data.viewportWidthPx, page.viewportSize().width);
                assert.ok(data.overflowingButtonRows > 0 && data.pickerInitialized && data.pickerModuleLoaded && data.helpModuleLoaded);
                assert.ok(channel.snapshots.length <= 8);
                assert.ok(data.cardCount > 32 && data.sampledCards <= 32 && data.truncated);
                assert.doesNotMatch(JSON.stringify(bundle.uiTelemetry.uiState), /private-|collection=|folder-icon|https?:|\/plugins/);
            }
        }
    });
    test('Editor diagnostics measure disabled settings and missing help targets without reading form content', async ({ page }) => {
        for (const type of ['docker', 'vm']) {
            await mountSettingsEditor(page, baseUrl, type);
            await page.evaluate(() => { window.FolderViewPlusFolderEditorPageBuildVersion = '2026.10.15.01'; });
            for (const name of ['folderviewplus.ui', 'folder.editor.help', 'folderviewplus.editor-diagnostics-model', 'folderviewplus.ui-state-diagnostics', 'folder.editor.diagnostics']) await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/${name}.js` });
            await page.evaluate(() => {
                const { form, refresh } = window.settingsFixture;
                form.elements.namedItem('name').setAttribute('aria-label', 'Folder name'); // Native host labeling is outside this isolated fixture.
                form.preview.value = '0'; form.context.value = '2'; form.context_graph.value = '1';
                form.folder_webui_url.value = 'http://192.168.1.2/private-url'; refresh();
                const info = form.querySelector('[data-fv-setting-info]'); info.dataset.fvSettingInfo = 'private-missing-help';
                form.querySelector('.fv-section-nav button[data-target="preview"]').click();
                form.dispatchEvent(new Event('change', { bubbles: true }));
            });
            await page.waitForFunction(type => window.FolderViewPlusUiStateDiagnostics.collect().channels.editor[type]?.latest?.data.disabledRows > 0, type);
            const result = await page.evaluate(type => window.FolderViewPlusUiStateDiagnostics.collect().channels.editor[type].latest.data, type);
            assert.ok(result.previewDisabledRows > 0 && result.disabledControls > 0 && result.helpButtons > 0);
            assert.equal(result.missingHelpTargets, 1); assert.equal(result.helpInitialized, true);
            assert.doesNotMatch(JSON.stringify(result), /private-|192\.168|http|folder_webui_url/);
            await page.locator('.fv-section-nav button[data-target="general"]').click();
            await showSettings(page, baseUrl); // This deliberately partial editor host has no icon-picker controller.
        }
    });
};
