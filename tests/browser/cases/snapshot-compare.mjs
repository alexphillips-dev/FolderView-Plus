import assert from 'node:assert/strict';

const mountCompare = async (page, baseUrl) => {
    await page.goto(`${baseUrl}/import`);
    await page.evaluate(async () => {
        const parsed = new DOMParser().parseFromString(await fetch('/plugin/FolderViewPlus.page').then(response => response.text()), 'text/html');
        for (const id of ['backup-compare-picker', 'backup-compare-dialog']) { document.body.append(parsed.getElementById(id)); $(`#${id}`).hide(); }
        const button = parsed.querySelector('[data-fv-onclick="openActiveRecoverySnapshotCompare()"]'); button.id = 'compare-open';
        document.getElementById('fv-settings-root').innerHTML = button.outerHTML + ['docker', 'vm'].map(type => `<div hidden><select id="${type}-backup-compare-left"></select><select id="${type}-backup-compare-right"></select><input id="${type}-backup-compare-include-prefs" type="checkbox" checked></div>`).join('');
        document.getElementById('fv-settings-root').dataset.fvThemeClass = document.body.dataset.fvThemeClass;
    });
    await page.addStyleTag({ content: 'html{font-size:10px}.ui-dialog p{font-size:10px;white-space:pre-line}.ui-dialog strong{font-size:inherit}button{letter-spacing:2px} .ui-dialog-content{box-sizing:border-box}' });
    await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/folderviewplus.settings-workspaces.js` });
    await page.addScriptTag({ url: `${baseUrl}/fixtures/snapshot-compare.fixture.js` });
    await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/folderviewplus.csp-events.js` });
    await page.evaluate(() => window.FolderViewPlusCspEvents.registerActions({ openActiveRecoverySnapshotCompare: () => window.fixtureCompare.open('docker') }, { owner: 'snapshot-compare-fixture' }));
};

const verifyModal = async (page) => {
    const layout = await page.locator('.ui-dialog:visible').evaluate(modal => {
        const box = modal.getBoundingClientRect(); const content = modal.querySelector('.ui-dialog-content');
        const footer = modal.querySelector('.ui-dialog-buttonpane').getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, viewport: innerWidth, height: innerHeight,
            footer: footer.bottom, overflow: content.scrollWidth > content.clientWidth + 1,
            bodySize: parseFloat(getComputedStyle(content).fontSize), scrolls: content.scrollHeight > content.clientHeight };
    });
    assert.ok(layout.left >= -1 && layout.right <= layout.viewport + 1 && layout.top >= -1 && layout.bottom <= layout.height + 1, JSON.stringify(layout));
    assert.ok(layout.footer <= layout.height && layout.bodySize >= 14 && !layout.overflow, JSON.stringify(layout));
    return layout;
};

export const registerSnapshotCompareCases = ({ test, baseUrl }) => {
    test('Snapshot comparison opens a chooser and explains Docker and VM changes in readable dialogs', async ({ page }) => {
        await mountCompare(page, baseUrl);
        for (const script of ['CLDRPluralRuleParser', 'jquery.i18n', 'jquery.i18n.messagestore', 'jquery.i18n.fallbacks', 'jquery.i18n.language', 'jquery.i18n.parser', 'jquery.i18n.emitter', 'jquery.i18n.emitter.bidi']) await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/include/${script}.js` });
        await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/folderviewplus.i18n.js` });
        for (const state of [{ type: 'docker', width: 1180, locale: 'en' }, { type: 'vm', width: 390, locale: 'ar' }]) {
            await page.setViewportSize({ width: state.width, height: 720 });
            await page.emulateMedia({ reducedMotion: 'reduce' });
            await page.evaluate(async locale => {
                await window.FolderViewPlusI18n.configure({ requestedLocale: locale, resolvedLocale: locale, fallbackChain: [locale, 'en'], direction: locale === 'ar' ? 'rtl' : 'ltr',
                    namespaces: ['common', 'legacy-surface', 'import'], assets: [...new Set(['en', locale])].flatMap(language => ['common', 'legacy-surface', 'import'].map(namespace => ({ locale: language, namespace, url: `/plugin/langs/namespaces/${language}/${namespace}.json` }))) });
            }, state.locale);
            await page.evaluate(type => window.fixtureCompare.open(type), state.type);
            await verifyModal(page);
            assert.equal(await page.locator('#recovery-backup-compare-left').inputValue(), 'first');
            assert.equal(await page.locator('#recovery-backup-compare-right').inputValue(), '__current__');
            await page.locator('#recovery-backup-compare-right').selectOption('second');
            await page.screenshot({ path: `tmp/fixture-browser-artifacts/snapshot-chooser-${state.type}.png` });
            await page.locator('.fv-backup-compare-picker-modal .fv-compare-primary').click();
            await page.locator('.fv-backup-compare-modal').waitFor({ state: 'visible' });
            assert.deepEqual(await page.locator('.fv-compare-count strong').allTextContents(), ['1', '1', '1', '1']);
            assert.equal(await page.locator('#backup-compare-diff .fv-compare-change').count(), 3);
            assert.equal(await page.locator('#backup-compare-prefs .fv-compare-change').count(), 1);
            await page.screenshot({ path: `tmp/fixture-browser-artifacts/snapshot-results-summary-${state.type}.png` });
            await page.locator('.fv-compare-values summary').click();
            assert.match(await page.locator('.fv-compare-values').textContent(), /Media library/);
            await verifyModal(page);
            await page.screenshot({ path: `tmp/fixture-browser-artifacts/snapshot-results-${state.type}.png` });
            await page.locator('.fv-backup-compare-modal .ui-dialog-buttonpane button').first().click();
            assert.equal(await page.locator('#recovery-backup-compare-right').inputValue(), 'second');
            await page.locator('#recovery-backup-compare-include-prefs').uncheck();
            await page.locator('#recovery-backup-compare-left').selectOption('second');
            assert.equal(await page.locator('#recovery-backup-compare-right').inputValue(), '__current__');
            await page.locator('.fv-backup-compare-picker-modal .fv-compare-primary').click();
            await page.locator('.fv-backup-compare-modal').waitFor({ state: 'visible' });
            assert.deepEqual(await page.locator('.fv-compare-count strong').allTextContents(), ['0', '0', '0', '3']);
            assert.equal(await page.locator('#backup-compare-prefs .fv-compare-change').count(), 0);
            await page.locator('.fv-backup-compare-modal .fv-compare-primary').click();
        }
        assert.equal(await page.locator('.ui-dialog:visible').count(), 0);
        assert.deepEqual(await page.evaluate(() => window.compareErrors), []);
    });

    test('Snapshot chooser handles empty history, failures, cancellation, pagination and hostile values', async ({ page }) => {
        await mountCompare(page, baseUrl);
        await page.evaluate(() => { backupsByType.vm = []; window.fixtureCompare.open('vm'); });
        assert.equal(await page.locator('.fv-backup-compare-picker-modal .fv-compare-primary').isDisabled(), true);
        assert.equal(await page.locator('#backup-compare-picker-status').isVisible(), true);
        await page.locator('.fv-backup-compare-picker-modal').press('Escape');
        await page.evaluate(() => { window.fixtureCompare.defer = true; window.fixtureCompare.reset(); });
        await page.locator('#compare-open').click();
        await page.locator('.fv-backup-compare-picker-modal .fv-compare-primary').click();
        assert.equal(await page.locator('.fv-backup-compare-picker-modal .fv-compare-primary').isDisabled(), true);
        await page.locator('.fv-backup-compare-picker-modal').press('Escape');
        await page.evaluate(() => { window.fixtureCompare.release(); window.fixtureCompare.defer = false; });
        assert.equal(await page.locator('.ui-dialog:visible').count(), 0);
        assert.equal(await page.locator('#compare-open').evaluate(node => node === document.activeElement), true);
        await page.evaluate(() => { window.fixtureCompare.fail = true; });
        await page.locator('#compare-open').click();
        await page.locator('.fv-backup-compare-picker-modal .fv-compare-primary').click();
        await page.waitForFunction(() => window.compareErrors.length === 1);
        assert.equal(await page.locator('.fv-backup-compare-picker-modal .fv-compare-primary').isEnabled(), true);
        await page.locator('.fv-backup-compare-picker-modal').press('Escape');
        await page.evaluate(() => {
            window.fixtureCompare.fail = false;
            window.fixtureCompare.snapshots.first.folders = Object.fromEntries(Array.from({ length: 45 }, (_, index) => [`f${index}`, { name: '<img src=x onerror="alert(1)"> hostile folder ' + index }]));
            window.fixtureCompare.snapshots.first.prefs = null;
        });
        await page.setViewportSize({ width: 390, height: 720 });
        await page.locator('#compare-open').click();
        await page.locator('.fv-backup-compare-picker-modal .fv-compare-primary').click();
        await page.locator('.fv-backup-compare-modal').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#backup-compare-diff img').count(), 0);
        assert.equal(await page.locator('#backup-compare-diff .fv-compare-change').count(), 20);
        assert.equal((await verifyModal(page)).scrolls, true);
        await page.locator('.fv-backup-diff-next').click();
        assert.match(await page.locator('.fv-table-pager-info').textContent(), /2/);
        await page.locator('.fv-backup-compare-modal .fv-compare-primary').focus();
        await page.locator('.fv-backup-compare-modal .fv-compare-primary').press('Tab');
        assert.equal(await page.locator('.fv-backup-compare-modal').evaluate(modal => modal.contains(document.activeElement)), true);
        await page.locator('.fv-backup-compare-modal').press('Escape');
        assert.equal(await page.locator('.ui-dialog:visible').count(), 0);
        assert.deepEqual(await page.evaluate(() => window.compareRequests.map(request => request.type).filter(type => !['docker', 'vm'].includes(type))), []);
    });
};
