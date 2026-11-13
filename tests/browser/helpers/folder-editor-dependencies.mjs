import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mountSettingsEditor } from './folder-editor-settings-host.mjs';
import { nativeSwitchSource, nativeSwitchCss } from './docker-native-switch.mjs';
const source = fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js', 'utf8');
const snapshot = source.match(/const computeFormSnapshot = \(\) => \{[\s\S]*?\n\};/)[0];
const cancel = source.match(/const cancelBtn = \(\) => \{[\s\S]*?\n\};/)[0];
const openEditor = async (page, baseUrl, type, record, eventSource) => {
    await mountSettingsEditor(page, baseUrl, type, eventSource);
    await page.evaluate(record => {
        const form = settingsFixture.form;
        if (record) Object.entries({ ...record.settings, name: record.name, icon: record.icon }).forEach(([name, value]) => {
            const field = form.elements.namedItem(name); if (!field) return;
            if (field.type === 'checkbox') field.checked = value === true; else field.value = String(value ?? '');
        });
        else form.name.value = 'Fixture';
        settingsFixture.refresh(); // Initial saved-state hydration, before any tested interaction.
    }, record);
    for (const name of ['folder.editor.state', 'folder.editor.submit']) await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/${name}.js` });
    await page.addStyleTag({ content: nativeSwitchCss }); await page.addScriptTag({ content: nativeSwitchSource });
    await page.evaluate(({ snapshot, cancel, record, type }) => {
        const form = settingsFixture.form;
        $('input.basic-switch').switchButton({ labels_placement: 'right' });
        const compute = new Function('$', 'getForm', `${snapshot}; return computeFormSnapshot;`)($, () => form);
        const fixture = window.dependencyFixture = { baseline: compute(), record: record || settingsFixture.serialize(), accept: false, suppress: false,
            location: { pathname: type === 'docker' ? '/Docker/Folder' : '/VMs/Folder', href: 'editor' } };
        const state = FolderViewPlusFolderEditorState.createApi({ $, getForm: () => form, getInitialSnapshot: () => fixture.baseline, computeFormSnapshot: compute });
        window.cancelBtn = new Function('location', 'confirm', 'surfaceT', 'updateUnsavedIndicator', `let suppressUnloadPrompt = false; const editingFolderDefaults = false;
            ${cancel}; return () => { cancelBtn(); return suppressUnloadPrompt; };`)(fixture.location, () => fixture.accept, (_key, fallback) => fallback, state.updateUnsavedIndicator);
        const actualCancel = window.cancelBtn; window.cancelBtn = () => { fixture.suppress = actualCancel(); };
        settingsFixture.readDependencies = names => names.map(name => {
            const field = form.elements.namedItem(name), gray = field.closest('.fv-dependent-disabled');
            let focused = null; if (!field.disabled && field.type !== 'checkbox' && field.getBoundingClientRect().height > 0) { field.focus(); focused = document.activeElement === field; }
            return { name, disabled: field.disabled, gray: Boolean(gray), aria: Boolean(field.closest('[aria-disabled="true"]')), focused };
        });
        const submit = FolderViewPlusFoundationModules.folderEditorSubmit.createSubmitHandler({
            window: { location: fixture.location, alert: message => { throw new Error(message); } },
            getState: () => ({ activeFolderEditorFolderId: 'fixture', folderId: 'fixture', allFoldersById: { fixture: fixture.record }, editingFolderDefaults: false,
                initialSnapshot: fixture.baseline, folderEditorExpectedFolderRevision: 1, type }),
            validateForm: () => true, buildFolderPayloadFromForm: () => settingsFixture.serialize(), normalizeFolderRecordForEditor: value => value,
            computeFormSnapshot: compute, setSuppressUnloadPrompt: value => { fixture.suppress = value; }, setExpectedRevision: () => {}, recordDiagnostics: () => {},
            securePost: async (url, payload) => { const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); return response.json(); },
            flushPostSaveTypeSync: async () => {}, extractAjaxErrorMessage: error => error.message
        });
        fixture.submit = () => submit(form);
    }, { snapshot, cancel, record, type });
    await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/folderviewplus.csp-events.js` });
};
const change = (page, name, value, targets) => page.evaluate(({ name, value, targets }) => {
    const field = settingsFixture.form.elements.namedItem(name);
    if (field.type === 'checkbox') {
        if (field.checked !== value) $(field).data('fixture-native-switch').button_bg[0].click();
    } else { field.value = String(value); field.dispatchEvent(new Event('change', { bubbles: true })); }
    return settingsFixture.readDependencies(targets); // Capture synchronously in the same event task.
}, { name, value, targets });
const expectState = (states, enabled, context) => {
    for (const state of states) {
        assert.equal(state.disabled, !enabled, `${context}/${state.name}: immediately usable`);
        assert.equal(state.gray, !enabled, `${context}/${state.name}: immediate dimming state`);
        assert.equal(state.aria, !enabled, `${context}/${state.name}: immediate aria-disabled state`);
        if (enabled && state.focused !== null) assert.equal(state.focused, true, `${context}/${state.name}: keyboard focus works`);
    }
};
export const verifyFolderEditorDependencies = async (page, baseUrl, { eventSource } = {}) => {
    const networkWrites = [], watch = request => { if (!['GET', 'HEAD'].includes(request.method())) networkWrites.push(request.url()); };
    page.on('request', watch);
    try {
        for (const [colorScheme, width] of [['dark', 1440], ['light', 390]]) {
            await page.emulateMedia({ colorScheme }); await page.setViewportSize({ width, height: 844 });
            for (const type of ['docker', 'vm']) {
                let stored, writes = 0; const startWrites = networkWrites.length;
                const endpoint = `${baseUrl}/plugins/folderview.plus/server/update.php`;
                await page.route(endpoint, route => {
                    stored = JSON.parse(route.request().postDataJSON().content); writes++;
                    return route.fulfill({ json: { metadata: { folderRevision: 2 } } });
                });
                try {
                    await openEditor(page, baseUrl, type, null, eventSource);
                    stored = await page.evaluate(() => dependencyFixture.record);
                    const baseline = JSON.stringify(stored), context = `${type}/${colorScheme}/${width}`;
                    for (const [controller, section, targets] of [
                        ['folder_webui', 'general', ['folder_webui_url']], ['folder_accent_enabled', 'status', ['folder_accent_color']],
                        ['preview_border', 'preview', ['preview_border_color', 'preview_border_width', 'preview_border_glow']],
                        ['preview_vertical_bars', 'preview', ['preview_vertical_bars_color']], ['preview_row_separator', 'preview', ['preview_row_separator_color']]
                    ]) {
                        await page.evaluate(section => settingsFixture.switchSection(section), section);
                        expectState(await change(page, controller, false, targets), false, context);
                        expectState(await change(page, controller, true, targets), true, context);
                    }
                    await page.evaluate(() => settingsFixture.switchSection('preview'));
                    const previews = ['preview_hover', 'preview_text_width', 'preview_overflow', 'preview_border_color', 'preview_border_width', 'preview_vertical_bars_color', 'preview_row_separator_color', 'dropdown_style'];
                    expectState(await change(page, 'preview', '0', previews), false, context);
                    expectState(await change(page, 'preview_border', false, ['preview_border_color']), false, context);
                    assert.equal(await page.locator('[name="preview_border"]').isChecked(), true, 'disabled prerequisite widget cannot change');
                    expectState(await change(page, 'preview', '1', previews), true, context);
                    expectState(await change(page, 'preview', '2', ['preview_text_width']), false, context);
                    expectState(await change(page, 'preview', '2', ['preview_overflow']), true, context);
                    expectState(await change(page, 'preview', '1', previews), true, context);
                    if (type === 'docker') {
                        expectState(await change(page, 'context', '0', ['context_graph', 'context_graph_time']), false, context);
                        expectState(await change(page, 'context', '2', ['context_graph', 'context_graph_time']), true, context);
                        expectState(await change(page, 'context_graph', '0', ['context_graph_time']), false, context);
                        expectState(await change(page, 'context_graph', '1', ['context_graph_time']), true, context);
                        expectState(await change(page, 'context', '0', ['context_graph_time']), false, context);
                        expectState(await change(page, 'context', '2', ['context_graph_time']), true, context);
                    } else assert.equal(await page.locator('[name="context"]').isVisible(), false, 'VM Docker-only controls stay hidden');
                    await page.evaluate(() => settingsFixture.switchSection('general'));
                    await page.locator('[name="folder_webui_url"]').fill('https://example.invalid/draft');
                    await page.locator('.folder-btn-cancel').click();
                    assert.equal(await page.evaluate(() => dependencyFixture.location.href), 'editor', 'declining Cancel retains the draft');
                    await page.evaluate(() => { dependencyFixture.accept = true; }); await page.locator('.folder-btn-cancel').click();
                    assert.deepEqual(await page.evaluate(() => ({ href: dependencyFixture.location.href, suppress: dependencyFixture.suppress })), { href: type === 'docker' ? '/Docker' : '/VMs', suppress: true });
                    assert.equal(writes, 0); assert.equal(networkWrites.length, startWrites, 'live edits and Cancel send no writes');
                    assert.equal(JSON.stringify(stored), baseline, 'Cancel preserves the persisted record');
                    await openEditor(page, baseUrl, type, stored, eventSource);
                    expectState(await page.evaluate(() => settingsFixture.readDependencies(['folder_webui_url'])), false, 'reopen saved-off baseline');
                    assert.equal(await page.locator('[name="folder_webui"]').isChecked(), false);
                    if (width === 1440) {
                        expectState(await change(page, 'folder_webui', true, ['folder_webui_url']), true, context);
                        await page.locator('[name="folder_webui_url"]').fill('https://example.invalid/saved');
                        assert.equal(writes, 0, 'draft remains local before Submit');
                        await page.evaluate(() => dependencyFixture.submit());
                        assert.equal(writes, 1); assert.equal(stored.settings.folder_webui, true);
                        await openEditor(page, baseUrl, type, stored, eventSource);
                        expectState(await change(page, 'folder_webui', false, ['folder_webui_url']), false, context);
                        await page.evaluate(() => { dependencyFixture.accept = true; }); await page.locator('.folder-btn-cancel').click();
                        assert.equal(writes, 1, 'Cancel after a saved-on baseline adds no writes');
                        await openEditor(page, baseUrl, type, stored, eventSource);
                        expectState(await page.evaluate(() => settingsFixture.readDependencies(['folder_webui_url'])), true, 'reopen saved-on baseline');
                        assert.equal(await page.locator('[name="folder_webui_url"]').inputValue(), 'https://example.invalid/saved');
                    }
                } finally { await page.unroute(endpoint); }
            }
        }
        await page.evaluate(() => settingsFixture.switchSection('status'));
    } finally { page.off('request', watch); }
};
