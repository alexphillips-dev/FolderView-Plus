import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
export const withFolderView3Host = async (page, baseUrl, run) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fvplus-browser-migration-'));
    const call = data => {
        fs.writeFileSync(path.join(root, 'request.json'), JSON.stringify(data));
        return JSON.parse(execFileSync('php', [path.resolve('tests/fixtures/folderview3-browser.php'), root,
            path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server')], { encoding: 'utf8', timeout: 30000 }));
    };
    try {
        call({ action: 'fixture_read' });
        await page.route('**/server/environment_snapshot.php', async route => route.fulfill({ json: call(Object.fromEntries(new URLSearchParams(route.request().postData() || ''))) }));
        await page.goto(`${baseUrl}/import`);
        await page.evaluate(() => {
            document.getElementById('fv-settings-root').innerHTML = '<h1>FolderView3 migration fixture</h1><button data-fv-folderview3-action="preview-export">Preview full backup</button><div id="fv-recovery-folderview3-summary" role="status" aria-live="polite"></div><div id="fixture-result" role="status"></div>';
            window.migrationErrors = []; window.migrationRefreshCount = 0;
            window.migrationPost = async (url, data) => {
                const r = await fetch(url, { method: 'POST', body: new URLSearchParams(data) }); const json = await r.json();
                if (json.ok === false) throw new Error(json.error); return json;
            };
        });
        for (const name of ['report', 'apply', 'model', 'migration']) await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/folderviewplus.folderview3-${name}.js` });
        await page.evaluate(() => {
            window.migrationApi = window.FolderViewPlusFoundationModules.folderView3Migration.createApi({
                window, document, apiPostJson: window.migrationPost,
                showError: (title, error) => window.migrationErrors.push(`${title}: ${error.message}`),
                afterApply: async () => { await window.migrationPost('/plugins/folderview.plus/server/environment_snapshot.php', { action: 'fixture_read' }); window.migrationRefreshCount++; },
                showToastMessage: ({ message }) => document.getElementById('fixture-result').textContent = message
            }); window.migrationApi.bind();
        });
        const editor = fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folder.js', 'utf8');
        await run(call, editor.slice(editor.indexOf('    const includedMemberNames ='), editor.indexOf('    const memberIdentities =', editor.indexOf('const buildFolderPayloadFromForm'))));
    } finally {
        const resolved = path.resolve(root);
        if (!resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(resolved).startsWith('fvplus-browser-migration-')) throw new Error('Unexpected fixture cleanup path');
        fs.rmSync(resolved, { recursive: true, force: true });
    }
};
