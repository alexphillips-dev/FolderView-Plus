import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

export const registerDownloadNoticeFixtureCases = ({ test, baseUrl }) => {
test('Successful Docker and VM exports show neutral dismissible notices without recording failure', async ({ page }) => {
    await page.goto(`${baseUrl}/import`);
    for (const type of ['docker', 'vm']) {
        const pending = page.waitForEvent('download');
        await page.evaluate(type => downloadFile('fixture.json', '{"folders":{}}', { type, mode: 'full' }), type);
        const download = await pending;
        assert.equal(await download.failure(), null);
        assert.equal(fs.readFileSync(await download.path(), 'utf8'), '{"folders":{}}');
        const status = page.locator(`#${type}-download-status`);
        assert.match(await status.getAttribute('class'), /is-requested/);
        assert.doesNotMatch(await status.getAttribute('class'), /is-warning|is-error/);
        assert.equal(await status.locator('strong').textContent(), 'Export sent to your browser');
        assert.equal(await status.locator('small').textContent(), 'Check your Downloads folder.');
        assert.equal(await status.locator('.fv-download-status-report').textContent(), 'File missing? Get help');
        const before = await page.evaluate(() => window.fixtureImport.downloadAttempts());
        await status.locator('.fv-download-status-dismiss').focus();
        await page.keyboard.press('Enter');
        assert.equal(await status.isHidden(), true);
        assert.equal(await page.locator(`[data-fv-onclick="${type === 'vm' ? 'downloadVm()' : 'downloadDocker()'}"]`).evaluate(el => el === document.activeElement), true);
        assert.deepEqual(await page.evaluate(() => window.fixtureImport.downloadAttempts()), before);
        assert.deepEqual(await page.evaluate(() => window.fixtureDiagnosticEvents), []);
        await page.evaluate(type => downloadFile('fixture.json', '{}', { type }), type);
        assert.equal(await status.isVisible(), true);
        assert.equal(await status.locator('.fv-download-status-dismiss').count(), 1);
    }
});

test('Dismissed and replaced notices ignore delayed missing-file and retry responses', async ({ page }) => {
    await page.goto(`${baseUrl}/import`);
    const status = page.locator('#docker-download-status');
    for (const action of ['report', 'retry']) {
        for (const replace of [false, true]) {
            await page.evaluate(() => window.fixtureImport.requestDownload());
            if (action === 'retry') await status.locator('.fv-download-status-report').click();
            await page.evaluate(() => {
                window.originalTrack = window.trackDiagnosticsEvent;
                window.trackDiagnosticsEvent = () => new Promise(resolve => { window.finishTracking = resolve; });
            });
            await status.locator(`.fv-download-status-${action}`).click();
            await page.waitForFunction(() => typeof window.finishTracking === 'function');
            await status.locator('.fv-download-status-dismiss').click();
            if (replace) await page.evaluate(() => window.fixtureImport.requestDownload());
            const expected = await status.innerHTML();
            await page.evaluate(() => {
                window.trackDiagnosticsEvent = window.originalTrack;
                window.finishTracking();
                delete window.finishTracking;
            });
            assert.equal(await status.innerHTML(), expected);
            assert.equal(await status.isHidden(), !replace);
        }
    }
});

test('A real retry dispatch failure still displays an error and remains dismissible', async ({ page }) => {
    await page.goto(`${baseUrl}/import`);
    await page.evaluate(() => window.fixtureImport.requestDownload());
    const status = page.locator('#docker-download-status');
    await status.locator('.fv-download-status-report').click();
    assert.match(await status.getAttribute('class'), /is-warning/);
    await page.evaluate(() => { URL.createObjectURL = () => { throw new Error('Synthetic browser failure'); }; });
    await status.locator('.fv-download-status-retry').click();
    await page.waitForFunction(() => document.querySelector('#docker-download-status').classList.contains('is-error'));
    assert.equal(await status.locator('strong').textContent(), 'Download request failed');
    assert.equal(await status.locator('.fv-download-status-report').count(), 0);
    assert.equal(await page.evaluate(() => window.fixtureImport.downloadAttempts().attempts.at(-1).lifecycle), 'synchronous-failure');
    await status.locator('.fv-download-status-dismiss').click();
    assert.equal(await status.isHidden(), true);
});

test('Download notice translations fit every locale and override alarming host button styles', async ({ page }) => {
    await page.goto(`${baseUrl}/import`);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addStyleTag({ content: 'button { border: 3px solid red !important; border-image: linear-gradient(red, orange) 1 !important; text-transform: uppercase !important; letter-spacing: 3px !important; }' });
    const localeRoot = path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/langs/namespaces');
    for (const locale of fs.readdirSync(localeRoot)) {
        const catalog = Object.assign({}, ...['common', 'legacy-surface'].map(name => JSON.parse(fs.readFileSync(path.join(localeRoot, locale, `${name}.json`), 'utf8'))));
        await page.evaluate(({ catalog, locale }) => {
            document.documentElement.lang = locale;
            document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
            window.FolderViewPlusI18n = { t: (key, fallback) => catalog[key] ?? fallback };
            window.FolderViewPlusFoundationModules.downloadStatus.render({ type: 'docker', attemptId: 'fixture', lifecycle: 'download-dispatch-attempted' });
        }, { catalog, locale });
        const status = page.locator('#docker-download-status');
        assert.equal(await status.locator('strong').textContent(), catalog['common.download.sent']);
        assert.equal(await status.locator('small').textContent(), catalog['common.download.check']);
        assert.equal(await status.locator('.fv-download-status-report').textContent(), catalog['common.download.help']);
        assert.equal(await status.locator('.fv-download-status-dismiss').textContent(), catalog['legacy.surface.48845bff334a50a5']);
        const geometry = await status.evaluate(panel => [...panel.querySelectorAll('button')].map(button => {
            const box = button.getBoundingClientRect();
            const bounds = panel.getBoundingClientRect();
            const style = getComputedStyle(button);
            return { fits: box.left >= bounds.left && box.right <= bounds.right && button.scrollWidth <= button.clientWidth + 1,
                pageFits: document.documentElement.scrollWidth <= innerWidth, height: box.height,
                neutral: style.borderImageSource === 'none' && style.borderColor !== 'rgb(255, 0, 0)' && style.textTransform === 'none' };
        }));
        assert.ok(geometry.every(row => row.fits && row.pageFits && row.height >= 36 && row.neutral), `${locale}: ${JSON.stringify(geometry)}`);
    }
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('.fv-download-status-dismiss').evaluate(el => el.matches(':focus-visible') && parseFloat(getComputedStyle(el).outlineWidth) >= 2), true);
});
};
