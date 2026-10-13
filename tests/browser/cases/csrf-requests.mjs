import assert from 'node:assert/strict';

export const registerCsrfRequestCases = ({ test, baseUrl }) => {
    test('Unraid 7.3.3 prefilter preserves form icon uploads through 16 MiB and standard plugin POSTs', async ({ page }) => {
        const requests = [];
        await page.route('**/plugins/folderview.plus/server/**', async route => {
            const request = route.request();
            const body = request.postDataBuffer()?.toString('utf8') || '';
            const headers = request.headers();
            requests.push({ path: new URL(request.url()).pathname, body, headers });
            assert.equal(headers['x-csrf-token'], 'fixture-unraid-token');
            assert.equal(headers['x-fv-request'], '1');
            assert.equal(headers['x-fv-token'], 'fixture-plugin-token');
            await route.fulfill({ contentType: 'application/json', body: JSON.stringify({
                ok: true, nonce: 'a'.repeat(64), url: '/fixture.png', name: 'fixture.png'
            }) });
        });
        await page.goto(`${baseUrl}/folder-editor`);
        await page.evaluate(() => {
            document.head.insertAdjacentHTML('beforeend', '<meta name="fv-request-token" content="fixture-plugin-token">');
            window.csrf_token = 'fixture-unraid-token';
            // Exact token injection behavior from Unraid webgui tag 7.3.3, HeadInlineJS.php.
            $.ajaxPrefilter(function(s) {
                if (s.type.toLowerCase() === 'post' && !s.crossDomain) {
                    s.data = s.data || ''; s.data += s.data ? '&' : ''; s.data += 'csrf_token=' + csrf_token;
                }
            });
        });
        for (const name of ['folderviewplus.request-diagnostics', 'folderviewplus.request-transport', 'folderviewplus.request', 'folder.editor.icon-api']) {
            await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/${name}.js` });
        }
        const result = await page.evaluate(async () => {
            const client = window.FolderViewPlusRequest;
            let evidence, progress = 0;
            const requestClient = { ...client, uploadJson: async (...args) => {
                const payload = await client.uploadJson(...args); evidence = payload.evidence; return payload;
            } };
            const api = window.FolderViewPlusFolderIconApi.createApi({ window, requestClient,
                iconUploadApiPath: '/api/csrf-upload.php', allowedExtensions: ['png'] });
            const uploads = [];
            for (const size of [22528, 1060000, 16777216]) {
                const file = new File([new Uint8Array(size).fill(255)], 'fixture.png', { type: 'image/png' });
                const upload = await api.uploadCustomIconFile(file, { onProgress: () => { progress++; } });
                uploads.push({ url: upload.url, evidence });
            }
            await client.postJson('/plugins/folderview.plus/server/prefs.php', new URLSearchParams('type=docker&prefs=%7B%7D'));
            return { uploads, progress, diagnostics: client.diagnostics() };
        });
        for (const [index, upload] of result.uploads.entries()) {
            assert.equal(upload.url, '/fixture.png');
            assert.match(upload.evidence.contentType, /^application\/x-www-form-urlencoded/);
            assert.equal(upload.evidence.bytes, [22528, 1060000, 16777216][index]);
            assert.ok(upload.evidence.bodyBytes < 1024 * 1024);
            assert.equal(upload.evidence.file, true, 'verify decoded file bytes at the receiving HTTP server');
            assert.equal(upload.evidence.filename, true);
            assert.equal(upload.evidence.nonce, true);
            assert.equal(upload.evidence.csrf, true);
            assert.equal(upload.evidence.corrupted, false);
        }
        assert.ok(result.progress > 0);
        const prefs = requests.find(request => request.path.endsWith('/prefs.php'));
        const fields = new URLSearchParams(prefs.body);
        assert.equal(fields.get('type'), 'docker');
        assert.equal(fields.get('csrf_token'), 'fixture-unraid-token');
        assert.equal(fields.get('_fv_nonce'), 'a'.repeat(64));
        assert.doesNotMatch(JSON.stringify(result.diagnostics), /fixture-unraid-token|fixture-plugin-token|fixture-file-bytes/);
    }, { timeoutMs: 60000 });
};
