import assert from 'node:assert/strict';
import fs from 'node:fs';
const plugin = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/';
const read = file => fs.readFileSync(plugin + file, 'utf8');
const review = JSON.parse(fs.readFileSync('scripts/lib/i18n_reviewed_startup.json', 'utf8'));
const blankMessage = read('scripts/folderviewplus.settings-watchdog.js').match(/'FolderView Plus detected that[^']+'/)[0].slice(1, -1);
const shell = read('FolderViewPlus.page').match(/<div id="fv-settings-bootstrap-shell"[\s\S]*?<\/div>/)[0]
    .replace(/<\?=htmlspecialchars\([\s\S]*?\?>/, review.en[1]);

export const registerSettingsStartupRepairCases = ({ test, baseUrl, loadI18n, locales = ['en', ...Object.keys(review.locales)] }) => {
    for (const [locale, messages] of Object.entries({ en: review.en, ...review.locales }).filter(([locale]) => locales.includes(locale))) {
test(`Startup shell and complete performance messages translate at full catalog coverage in ${locale}`, async ({ page }) => {
        await page.goto(baseUrl + '/localization');
        await loadI18n(page, baseUrl);
        await page.evaluate(({ shell, locale, blankMessage }) => {
            document.getElementById('dynamic-root').innerHTML = shell + '<p id="blank-message"></p>';
            document.getElementById('blank-message').textContent = blankMessage;
            document.documentElement.lang = locale;
            document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
        }, { shell, locale, blankMessage });
        const result = await page.evaluate(async locale => {
            await window.FolderViewPlusI18n.configure({ requestedLocale: locale, resolvedLocale: locale,
                catalogReport: { locales: { [locale]: { coveragePercent: 100, missingMessages: 0 } } },
                assets: [...new Set(['en', locale])].flatMap(language => ['common', 'legacy-surface'].map(namespace => ({
                    locale: language, namespace, url: '/plugin/langs/namespaces/' + language + '/' + namespace + '.json'
                }))) });
            window.FolderViewPlusI18n.translate(document.getElementById('dynamic-root'));
            return [0, 1, 2, 5].map(count => window.FolderViewPlusI18n.t('common.startup.performance-followup', '', count));
        }, locale);
        assert.equal(await page.locator('[data-i18n="common.startup.preparing"]').textContent(), messages[1], locale);
        assert.deepEqual(result, [0, 1, 2, 5].map(count => messages[0].replace('$1', count)), locale);
        assert.ok(await page.locator('#fv-settings-bootstrap-shell').isVisible(), locale);
        const legacy = JSON.parse(read(`langs/namespaces/${locale}/legacy-surface.json`));
        assert.equal(await page.locator('#blank-message').textContent(), legacy['legacy.surface.273f838c039ee10f'], locale);
});
    }

test('Visible Settings startup survives late blank checks and reports only a bounded loading timeout', async ({ page }) => {
    await page.goto(baseUrl + '/localization');
    await page.clock.install();
    await page.addStyleTag({ url: baseUrl + '/plugin/styles/folderviewplus.bootstrap.css' });
    const common = JSON.parse(read('langs/namespaces/de/common.json'));
    await page.evaluate(({ shell, common }) => {
        document.getElementById('dynamic-root').innerHTML = '<div id="fv-settings-root" class="fv-settings-bootstrap-pending" aria-busy="true">' + shell + '</div>';
        window.FolderViewPlusEarlyI18n = { messages: common };
        window.startupReports = [];
        window.FolderViewPlusFatalBanner = { reportFatalError: (error, options) => window.startupReports.push(options) };
    }, { shell, common });
    await page.addScriptTag({ url: baseUrl + '/plugin/scripts/folderviewplus.settings-watchdog.js' });
    await page.clock.fastForward(8500);
    assert.deepEqual(await page.evaluate(() => window.startupReports), []);
    assert.equal(await page.locator('#fv-settings-bootstrap-shell').isVisible(), true);
    await page.clock.fastForward(51500);
    const reports = await page.evaluate(() => window.startupReports);
    assert.equal(reports.length, 1);
    assert.equal(reports[0].code, 'FVPLUS-SET-LOAD-001');
    assert.equal(reports[0].title, common['common.startup.timeout']);
    assert.equal(reports[0].message, common['common.startup.timeout-detail']);
});
};
