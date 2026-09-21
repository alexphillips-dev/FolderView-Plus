import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const plugin = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus');
const source = fs.readFileSync(path.join(plugin, 'scripts/folderviewplus.js'), 'utf8');
const downloadSource = source.slice(source.indexOf('const downloadBackupEntry = async'), source.indexOf('const deleteBackupEntry ='));
assert.ok(downloadSource.includes('requestClient.postBlob'));
const locales = fs.readdirSync(path.join(plugin, 'langs/namespaces'));

const loadDownload = async (page, baseUrl) => {
    await page.goto(`${baseUrl}/settings`);
    await page.addScriptTag({ url: `${baseUrl}/vendor/jquery.js` });
    await page.evaluate(() => {
        const meta = document.createElement('meta');
        meta.name = 'fv-request-token'; meta.content = 'synthetic-download-token'; document.head.append(meta);
        window.downloadErrors = [];
        window.downloadActivity = [];
    });
    for (const file of ['folderviewplus.request-diagnostics', 'folderviewplus.request']) {
        await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/${file}.js` });
    }
    await page.addScriptTag({ content: `(() => {
        const requestClient = window.FolderViewPlusRequest;
        const normalizeManagedType = type => type;
        const addActivityEntry = (message, level) => window.downloadActivity.push({ message, level });
        const surfaceT = (_key, fallback) => fallback;
        const showError = (_title, error) => window.downloadErrors.push({ message: error.message, status: error.status, reason: error.reasonCode });
        ${downloadSource}
        window.fixtureDownloadBackup = downloadBackupEntry;
    })();` });
};

export const registerBackupMobileReportCases = ({ test, baseUrl }) => {
    test('backup attachment downloads use real jQuery conversion and preserve Docker and VM bytes', async ({ page }) => {
        const requests = [];
        const payload = JSON.stringify({ schemaVersion: 1, folders: { fixture: { name: 'Synthetic backup' } } });
        await page.route('**/plugins/folderview.plus/server/security.php', async route => {
            requests.push({ endpoint: 'nonce', body: new URLSearchParams(route.request().postData()) });
            await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, nonce: 'a'.repeat(64) }) });
        });
        await page.route('**/plugins/folderview.plus/server/backup.php', async route => {
            const request = route.request();
            assert.equal(request.method(), 'POST');
            assert.equal(request.headers()['x-fv-request'], '1');
            assert.equal(request.headers()['x-fv-nonce'], 'a'.repeat(64));
            const body = new URLSearchParams(request.postData());
            assert.equal(body.get('action'), 'download_post');
            requests.push({ endpoint: 'download', body });
            await route.fulfill({ contentType: 'application/json', headers: { 'content-disposition': `attachment; filename="${body.get('name')}"` }, body: payload });
        });
        await loadDownload(page, baseUrl);
        await page.evaluate(() => {
            window.downloadCleanup = [];
            const revoke = URL.revokeObjectURL.bind(URL);
            URL.revokeObjectURL = url => { window.downloadCleanup.push(url); revoke(url); };
        });
        for (const type of ['docker', 'vm']) {
            const pending = page.waitForEvent('download');
            await page.evaluate(type => window.fixtureDownloadBackup(type, `${type}-synthetic.json`), type);
            const download = await pending;
            assert.equal(download.suggestedFilename(), `${type}-synthetic.json`);
            assert.equal(await download.failure(), null);
            assert.equal(fs.readFileSync(await download.path(), 'utf8'), payload);
        }
        await page.waitForFunction(() => window.downloadCleanup.length === 2);
        assert.deepEqual(await page.evaluate(() => window.downloadErrors), []);
        assert.deepEqual(await page.evaluate(() => window.downloadActivity.map(entry => entry.level)), ['success', 'success']);
        assert.deepEqual(requests.map(row => row.endpoint), ['nonce', 'download', 'nonce', 'download']);
        assert.deepEqual(requests.filter(row => row.endpoint === 'download').map(row => row.body.get('type')), ['docker', 'vm']);
        assert.equal(await page.locator('a[download="docker-synthetic.json"], a[download="vm-synthetic.json"]').count(), 0);
    });

    test('binary backup errors retain HTTP and guard details without download or mutation replay', async ({ page }) => {
        let calls = 0, mode = 'missing';
        const downloads = [];
        page.on('download', download => downloads.push(download));
        await page.route('**/plugins/folderview.plus/server/security.php', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, nonce: 'b'.repeat(64) }) }));
        await page.route('**/plugins/folderview.plus/server/backup.php', async route => {
            calls++;
            const response = mode === 'guard'
                ? { status: 403, body: JSON.stringify({ error: 'Mutation nonce is expired, invalid, or already used.', requestFailure: { source: 'folderview-plus', reasonCode: 'nonce-stale' } }) }
                : mode === 'malformed' ? { status: 500, body: '{invalid' }
                    : { status: 400, body: JSON.stringify({ error: 'Backup file not found.' }) };
            await route.fulfill({ contentType: 'application/json', ...response });
        });
        await loadDownload(page, baseUrl);
        for (const next of ['missing', 'guard', 'malformed']) {
            mode = next;
            await page.evaluate(() => window.fixtureDownloadBackup('docker', 'synthetic.json'));
        }
        const errors = await page.evaluate(() => window.downloadErrors);
        assert.match(errors[0].message, /Backup file not found/);
        assert.equal(errors[0].status, 400);
        assert.equal(errors[1].status, 403);
        assert.equal(errors[1].reason, 'nonce-stale');
        assert.equal(errors[2].status, 500);
        assert.equal(calls, 3, 'failed downloads must not replay secured POST requests');
        assert.equal(downloads.length, 0);
        const aborted = await page.evaluate(async () => {
            const controller = new AbortController(); controller.abort();
            try { await window.FolderViewPlusRequest.postBlob('/plugins/folderview.plus/server/backup.php', {}, { signal: controller.signal }); }
            catch (error) { return error.reasonCode; }
        });
        assert.equal(aborted, 'aborted');
        assert.equal(calls, 3);
    }, { allowedConsoleErrors: [/Failed to load resource:.*(?:400|403|500)/, /the server responded with a status of (?:400|403|500)/] });

    test('Diagnostics toolbar labels fit every locale with host typography at phone and desktop widths', async ({ page }) => {
        await page.goto(`${baseUrl}/settings`);
        await page.addStyleTag({ content: 'html{font-size:10px}body{font-size:13px}button[type="button"]{white-space:nowrap;letter-spacing:1.8px;text-transform:uppercase}' });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const markup = fs.readFileSync(path.join(plugin, 'FolderViewPlus.page'), 'utf8');
        for (const locale of locales) {
            const catalog = JSON.parse(fs.readFileSync(path.join(plugin, `langs/namespaces/${locale}/diagnostics.json`), 'utf8'));
            await page.evaluate(({ markup, catalog, locale }) => {
                document.documentElement.lang = locale;
                document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
                const parsed = new DOMParser().parseFromString(markup, 'text/html');
                const toolbar = parsed.querySelector('.fv-diagnostics-toolbar');
                document.getElementById('fv-settings-root').replaceChildren(toolbar);
                for (const label of toolbar.querySelectorAll('[data-i18n]')) label.textContent = catalog[label.dataset.i18n] || label.textContent;
                // Catalog completeness must not substitute for measuring rendered text.
                window.fixtureLocaleCoverage = { coveragePercent: 100 };
            }, { markup, catalog, locale });
            for (const width of [320, 375, 432, 760, 1180]) {
                await page.setViewportSize({ width, height: 810 });
                const geometry = await page.locator('.fv-diagnostics-toolbar button').evaluateAll(buttons => buttons.map(button => {
                    const bounds = button.getBoundingClientRect(), label = button.querySelector('span').getBoundingClientRect();
                    return { inside: label.left >= bounds.left - 1 && label.right <= bounds.right + 1,
                        overflow: button.scrollWidth > button.clientWidth + 1, height: bounds.height,
                        pageFits: document.documentElement.scrollWidth <= innerWidth + 1 };
                }));
                assert.equal(geometry.length, 3);
                assert.ok(geometry.every(row => row.inside && !row.overflow && row.height >= 36 && row.pageFits), `${locale} at ${width}: ${JSON.stringify(geometry)}`);
            }
        }
        const first = page.locator('.fv-diagnostics-toolbar button').first();
        await first.focus();
        await page.keyboard.press('Tab');
        assert.equal(await page.locator('.fv-diagnostics-toolbar button').nth(1).evaluate(button => button === document.activeElement), true);
    });
};
