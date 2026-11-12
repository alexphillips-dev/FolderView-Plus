import fs from 'node:fs';
import assert from 'node:assert/strict';
import { mountSettingsEditor } from './folder-editor-settings-host.mjs';
const source = fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js', 'utf8');
const snapshot = source.match(/const computeFormSnapshot = \(\) => \{([\s\S]*?)\n\};/)[1];

export const verifyFolderEditorSubmit = async (page, baseUrl) => {
    for (const viewport of [{ width: 1180, height: 720 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(viewport);
        for (const type of ['docker', 'vm']) {
            await mountSettingsEditor(page, baseUrl, type);
            await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/folder.editor.submit.js` });
            await page.locator('[name="name"]').fill('Fixture');
            await page.evaluate(({ snapshot, type }) => {
                const form = settingsFixture.form;
                const compute = new Function('$', 'getForm', `return () => {${snapshot}}`)(window.$, () => form);
                const baseline = compute(), saved = settingsFixture.serialize();
                window.makeSubmitFixture = () => {
                    let finishSave, failSave, finishSync, pending, revision = 7;
                    const state = { requests: [], syncs: 0, diagnostics: [], alerts: [], suppressUnloadPrompt: false };
                    const location = { pathname: type === 'docker' ? '/Docker/Folder' : '/VMs/Folder', href: 'editor' };
                    const run = window.FolderViewPlusFoundationModules.folderEditorSubmit.createSubmitHandler({
                        window: { location, alert: message => state.alerts.push(message) },
                        getState: () => ({ activeFolderEditorFolderId: 'fixture', folderId: 'fixture', allFoldersById: { fixture: saved },
                            editingFolderDefaults: false, initialSnapshot: baseline, folderEditorExpectedFolderRevision: revision, type }),
                        validateForm: () => true, buildFolderPayloadFromForm: () => settingsFixture.serialize(),
                        normalizeFolderRecordForEditor: value => value, computeFormSnapshot: compute,
                        recordDiagnostics: entry => state.diagnostics.push(entry),
                        setExpectedRevision: value => { revision = value; },
                        setSuppressUnloadPrompt: value => { state.suppressUnloadPrompt = value; },
                        securePost: (url, payload) => { state.requests.push({ url, payload }); return new Promise((resolve, reject) => { finishSave = resolve; failSave = reject; }); },
                        flushPostSaveTypeSync: () => { state.syncs++; return new Promise(resolve => { finishSync = resolve; }); },
                        extractAjaxErrorMessage: error => error.message
                    });
                    return { start: () => { pending = run(form); },
                        finishSave: () => finishSave({ metadata: { folderRevision: 8 }, timings: { bootstrapMs: 2, guardMs: 3, saveMs: 4 } }),
                        failSave: () => failSave(new Error('Fixture save rejected')),
                        finishSync: () => finishSync(), done: () => pending,
                        read: () => ({ ...state, revision, href: location.href }) };
                };
                window.submitFixture = makeSubmitFixture(); submitFixture.start();
            }, { snapshot, type });
            await page.evaluate(() => submitFixture.done());
            const unchanged = await page.evaluate(() => submitFixture.read());
            assert.equal(unchanged.href, type === 'docker' ? '/Docker' : '/VMs');
            assert.deepEqual(unchanged.requests, [], 'unchanged Submit sends no token or save requests');
            assert.equal(unchanged.syncs, 0);
            assert.equal(unchanged.diagnostics[0].unchanged, true);
            assert.equal(unchanged.suppressUnloadPrompt, true);
            await page.locator('[name="icon"]').fill('/fixture-icon.png');
            await page.evaluate(() => { window.submitFixture = makeSubmitFixture(); submitFixture.start(); });
            const waiting = await page.evaluate(() => submitFixture.read());
            assert.equal(waiting.href, 'editor', 'changed edit waits for confirmed save');
            assert.equal(waiting.requests.length, 1);
            assert.equal(JSON.parse(waiting.requests[0].payload.content).icon, '/fixture-icon.png');
            assert.equal(waiting.requests[0].payload.expectedRevision, 7);
            await page.evaluate(() => submitFixture.finishSave());
            const syncing = await page.evaluate(() => submitFixture.read());
            assert.equal(syncing.href, 'editor', 'navigation also waits for post-save synchronization');
            assert.equal(syncing.syncs, 1);
            await page.evaluate(() => { submitFixture.finishSync(); return submitFixture.done(); });
            const saved = await page.evaluate(() => submitFixture.read());
            assert.equal(saved.href, type === 'docker' ? '/Docker' : '/VMs');
            assert.equal(saved.revision, 8);
            assert.equal(saved.diagnostics[0].ok, true);
            assert.equal(saved.diagnostics[0].saveMs, 4);
            await page.evaluate(() => { window.submitFixture = makeSubmitFixture(); submitFixture.start(); submitFixture.failSave(); return submitFixture.done(); });
            const failed = await page.evaluate(() => submitFixture.read());
            assert.equal(failed.href, 'editor', 'failed saves retain the editor and unsaved values');
            assert.equal(failed.syncs, 0);
            assert.equal(failed.suppressUnloadPrompt, false);
            assert.deepEqual(failed.alerts, ['Fixture save rejected']);
            assert.equal(failed.diagnostics[0].ok, false);
        }
    }
};
