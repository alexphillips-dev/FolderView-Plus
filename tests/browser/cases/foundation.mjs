import assert from 'node:assert/strict';

export const registerFoundationFixtureCases = ({ test, baseUrl, surfaceKeyFor, germanSurfaceCatalog }) => {
test('CSP and Trusted Types fixture renders malicious persisted values as inert text', async ({ page }) => {
    await page.goto(`${baseUrl}/csp-hardening`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__fvCspFixtureReady === true);
    const evidence = await page.evaluate(() => ({
        injection: window.__fvInjection,
        rejected: window.__fvUnsafeAttributeRejected,
        trustedTypesAvailable: window.__fvTrustedTypesAvailable,
        values: [...document.querySelectorAll('.csp-malicious-value')].map((node) => ({
            kind: node.getAttribute('data-value-kind'),
            text: node.textContent,
            childElements: node.children.length
        }))
    }));
    assert.equal(evidence.injection, 0);
    assert.equal(evidence.rejected, true);
    assert.equal(evidence.values.length, 6);
    assert.equal(evidence.values.every((entry) => entry.childElements === 0), true);
    assert.deepEqual(evidence.values.map((entry) => entry.kind), [
        'folderName',
        'containerName',
        'templateMetadata',
        'importedConfiguration',
        'translation',
        'diagnostics'
    ]);
}, { skipAccessibility: true });

test('Shared UI primitives provide accessible modal, action, status, and progress behavior', async ({ page }) => {
    await page.goto(`${baseUrl}/ui-primitives`, { waitUntil: 'load' });
    await page.click('[data-fv-ui-action="fixture-action"]');
    assert.equal(await page.evaluate(() => window.fixtureActionCount), 1);

    await page.evaluate(() => {
        document.querySelector('#fixture-opener').focus();
        window.fixtureConfirmPromise = window.fixtureUI.openConfirm();
    });
    await page.waitForSelector('.fv-ui-modal[role="dialog"]');
    assert.equal(await page.locator('.fv-ui-modal').getAttribute('aria-modal'), 'true');
    assert.equal(await page.locator('[data-fv-ui-action="modal-confirm"]').evaluate((element) => element === document.activeElement), true);
    await page.click('[data-fv-ui-action="modal-confirm"]');
    assert.equal(await page.evaluate(() => window.fixtureConfirmPromise), true);
    assert.equal(await page.locator('#fixture-opener').evaluate((element) => element === document.activeElement), true, 'focus restores to the element active when the modal opened');

    await page.evaluate(() => { window.fixtureAlertPromise = window.fixtureUI.openAlert(); });
    await page.keyboard.press('Escape');
    await page.waitForSelector('.fv-ui-modal', { state: 'detached' });
    await page.evaluate(() => window.fixtureAlertPromise);

    await page.evaluate(() => { window.fixtureUI.announceStatus(); });
    await page.waitForFunction(() => document.querySelector('.fv-ui-announcer')?.textContent === 'Complete. Operation completed.');
    assert.equal(await page.locator('.fv-ui-toast-region, .fv-ui-toast, .fv-toast-host, .fv-toast').count(), 0);

    await page.evaluate(() => { window.fixtureProgress = window.fixtureUI.showProgress(); });
    assert.equal(await page.locator('.fv-ui-progress-state progress').getAttribute('value'), '3');
    assert.equal(await page.locator('[data-fv-ui-progress-label]').textContent(), 'Saving folders');
    await page.click('[data-fv-ui-action="progress-cancel"]');
    await page.waitForSelector('.fv-ui-progress-state', { state: 'detached' });
});

test('Generated localization covers initial, attributed, parameterized, and dynamic UI text', async ({ page }) => {
    const searchKey = surfaceKeyFor('Search built-in icons');
    const pageKey = surfaceKeyFor('Page $1 / $2');
    assert.ok(searchKey && pageKey, 'fixture phrases must exist in the generated surface catalog');
    const expectedSearch = germanSurfaceCatalog[searchKey];
    const expectedPage = germanSurfaceCatalog[pageKey].replace('$1', '2').replace('$2', '7');

    await page.goto(`${baseUrl}/localization`, { waitUntil: 'load' });
    await page.addScriptTag({ url: `${baseUrl}/vendor/jquery.js` });
    for (const script of [
        'CLDRPluralRuleParser.js', 'jquery.i18n.js', 'jquery.i18n.messagestore.js', 'jquery.i18n.fallbacks.js',
        'jquery.i18n.language.js', 'jquery.i18n.parser.js', 'jquery.i18n.emitter.js', 'jquery.i18n.emitter.bidi.js'
    ]) {
        await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/include/${script}` });
    }
    await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/folderviewplus.i18n.js` });
    await page.evaluate(async () => window.FolderViewPlusI18n.configure({
        requestedLocale: 'de',
        resolvedLocale: 'de',
        fallbackChain: ['de', 'en'],
        namespaces: ['legacy-surface'],
        assets: [
            { locale: 'en', namespace: 'legacy-surface', url: '/plugin/langs/namespaces/en/legacy-surface.json' },
            { locale: 'de', namespace: 'legacy-surface', url: '/plugin/langs/namespaces/de/legacy-surface.json' }
        ]
    }));
    assert.equal(await page.locator('#initial-label').textContent(), expectedSearch);
    assert.equal(await page.locator('#initial-attribute').getAttribute('placeholder'), expectedSearch);
    assert.equal(await page.locator('#user-content').textContent(), 'Search built-in icons', 'runtime data selectors must be ignored');
    await page.evaluate(() => {
        const label = document.createElement('span');
        label.id = 'dynamic-label';
        label.textContent = 'Page 2 / 7';
        document.querySelector('#dynamic-root').append(label);
    });
    await page.waitForFunction((expected) => document.querySelector('#dynamic-label')?.textContent === expected, expectedPage);
    await page.evaluate(({ key }) => {
        const fragment = document.createDocumentFragment();
        const explicit = document.createElement('div');
        explicit.id = 'dynamic-explicit-label';
        explicit.setAttribute('data-i18n', key);
        explicit.textContent = 'Search built-in icons';
        fragment.append(explicit);
        for (let index = 0; index < 300; index += 1) {
            const label = document.createElement('span');
            label.className = 'settings-localization-stress-label';
            label.textContent = 'Search built-in icons';
            fragment.append(label);
        }
        document.querySelector('#dynamic-root').append(fragment);
        window.__localizationHeartbeat = false;
        setTimeout(() => { window.__localizationHeartbeat = true; }, 25);
    }, { key: searchKey });
    await page.waitForFunction((expected) => (
        window.__localizationHeartbeat === true
        && document.querySelector('#dynamic-explicit-label')?.textContent === expected
        && [...document.querySelectorAll('.settings-localization-stress-label')].every((node) => node.textContent === expected)
    ), expectedSearch);
    const snapshot = await page.evaluate(() => window.FolderViewPlusI18n.snapshot());
    await page.waitForTimeout(150);
    const settledSnapshot = await page.evaluate(() => window.FolderViewPlusI18n.snapshot());
    assert.equal(snapshot.dynamicTranslationObserver, true);
    assert.equal(snapshot.autoBoundMessageCount, 1574);
    assert.ok(snapshot.autoTranslatedNodeCount >= 303);
    assert.equal(settledSnapshot.autoTranslatedNodeCount, snapshot.autoTranslatedNodeCount, 'localization must settle without observing its own writes forever');
});

test('Unraid zh_CN activates the canonical Simplified Chinese catalog in a real browser', async ({ page }) => {
    await page.goto(`${baseUrl}/localization`, { waitUntil: 'load' });
    await page.addScriptTag({ url: `${baseUrl}/vendor/jquery.js` });
    for (const script of [
        'CLDRPluralRuleParser.js', 'jquery.i18n.js', 'jquery.i18n.messagestore.js', 'jquery.i18n.fallbacks.js',
        'jquery.i18n.language.js', 'jquery.i18n.parser.js', 'jquery.i18n.emitter.js', 'jquery.i18n.emitter.bidi.js'
    ]) {
        await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/include/${script}` });
    }
    await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/folderviewplus.i18n.js` });
    const result = await page.evaluate(async () => {
        const label = document.createElement('span');
        label.id = 'simplified-chinese-label';
        label.setAttribute('data-i18n', 'common.close');
        label.textContent = 'Close';
        document.body.append(label);
        const snapshot = await window.FolderViewPlusI18n.configure({
            requestedLocale: 'zh_CN',
            resolvedLocale: 'zh-Hans',
            fallbackChain: ['zh-CN', 'zh-Hans', 'en'],
            namespaces: ['common'],
            assets: [
                { locale: 'en', namespace: 'common', url: '/plugin/langs/namespaces/en/common.json' },
                { locale: 'zh-Hans', namespace: 'common', url: '/plugin/langs/namespaces/zh-Hans/common.json' }
            ]
        });
        return {
            snapshot,
            documentLocale: document.documentElement.lang,
            translatedLabel: label.textContent,
            directTranslation: window.FolderViewPlusI18n.t('common.close')
        };
    });

    assert.equal(result.snapshot.requestedLocale, 'zh-CN');
    assert.equal(result.snapshot.resolvedLocale, 'zh-Hans');
    assert.equal(result.snapshot.activeLocale, 'zh-Hans');
    assert.deepEqual(result.snapshot.fallbackChain, ['zh-CN', 'zh-Hans', 'en']);
    assert.equal(result.documentLocale, 'zh-CN');
    assert.equal(result.translatedLabel, '关闭');
    assert.equal(result.directTranslation, '关闭');
});

test('Unraid zh_TW activates the canonical Traditional Chinese catalog in a real browser', async ({ page }) => {
    await page.goto(`${baseUrl}/localization`, { waitUntil: 'load' });
    await page.addScriptTag({ url: `${baseUrl}/vendor/jquery.js` });
    for (const script of [
        'CLDRPluralRuleParser.js', 'jquery.i18n.js', 'jquery.i18n.messagestore.js', 'jquery.i18n.fallbacks.js',
        'jquery.i18n.language.js', 'jquery.i18n.parser.js', 'jquery.i18n.emitter.js', 'jquery.i18n.emitter.bidi.js'
    ]) {
        await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/include/${script}` });
    }
    await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/folderviewplus.i18n.js` });
    const result = await page.evaluate(async () => {
        const label = document.createElement('span');
        label.setAttribute('data-i18n', 'common.close');
        label.textContent = 'Close';
        document.body.append(label);
        const snapshot = await window.FolderViewPlusI18n.configure({
            requestedLocale: 'zh_TW',
            resolvedLocale: 'zh-Hant',
            fallbackChain: ['zh-TW', 'zh-Hant', 'en'],
            direction: 'ltr',
            namespaces: ['common'],
            assets: [
                { locale: 'en', namespace: 'common', url: '/plugin/langs/namespaces/en/common.json' },
                { locale: 'zh-Hant', namespace: 'common', url: '/plugin/langs/namespaces/zh-Hant/common.json' }
            ]
        });
        return {
            snapshot,
            documentLocale: document.documentElement.lang,
            documentDirection: document.documentElement.dir,
            translatedLabel: label.textContent,
            directTranslation: window.FolderViewPlusI18n.t('common.close')
        };
    });

    assert.equal(result.snapshot.requestedLocale, 'zh-TW');
    assert.equal(result.snapshot.resolvedLocale, 'zh-Hant');
    assert.equal(result.snapshot.activeLocale, 'zh-Hant');
    assert.equal(result.documentLocale, 'zh-TW');
    assert.equal(result.documentDirection, 'ltr');
    assert.equal(result.translatedLabel, '關閉');
    assert.equal(result.directTranslation, '關閉');
});

test('Unraid ar_AR activates the Arabic catalog and production RTL direction in a real browser', async ({ page }) => {
    await page.goto(`${baseUrl}/localization`, { waitUntil: 'load' });
    await page.addScriptTag({ url: `${baseUrl}/vendor/jquery.js` });
    for (const script of [
        'CLDRPluralRuleParser.js', 'jquery.i18n.js', 'jquery.i18n.messagestore.js', 'jquery.i18n.fallbacks.js',
        'jquery.i18n.language.js', 'jquery.i18n.parser.js', 'jquery.i18n.emitter.js', 'jquery.i18n.emitter.bidi.js'
    ]) {
        await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/include/${script}` });
    }
    await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/folderviewplus.i18n.js` });
    const result = await page.evaluate(async () => {
        const label = document.createElement('span');
        label.setAttribute('data-i18n', 'common.close');
        label.textContent = 'Close';
        document.body.append(label);
        const snapshot = await window.FolderViewPlusI18n.configure({
            requestedLocale: 'ar_AR',
            resolvedLocale: 'ar',
            fallbackChain: ['ar-AR', 'ar', 'en'],
            direction: 'rtl',
            namespaces: ['common'],
            assets: [
                { locale: 'en', namespace: 'common', url: '/plugin/langs/namespaces/en/common.json' },
                { locale: 'ar', namespace: 'common', url: '/plugin/langs/namespaces/ar/common.json' }
            ]
        });
        return {
            snapshot,
            documentLocale: document.documentElement.lang,
            documentDirection: document.documentElement.dir,
            translatedLabel: label.textContent,
            directTranslation: window.FolderViewPlusI18n.t('common.close')
        };
    });

    assert.equal(result.snapshot.requestedLocale, 'ar-AR');
    assert.equal(result.snapshot.resolvedLocale, 'ar');
    assert.equal(result.snapshot.activeLocale, 'ar');
    assert.equal(result.documentLocale, 'ar-AR');
    assert.equal(result.documentDirection, 'rtl');
    assert.equal(result.translatedLabel, 'إغلاق');
    assert.equal(result.directTranslation, 'إغلاق');
});
};
