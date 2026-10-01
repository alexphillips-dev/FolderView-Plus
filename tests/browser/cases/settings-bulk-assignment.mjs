import assert from 'node:assert/strict';

const mountBulk = async (page, baseUrl) => {
    await page.goto(`${baseUrl}/import`);
    await page.evaluate(async () => {
        const parsed = new DOMParser().parseFromString(await fetch('/plugin/FolderViewPlus.page').then(response => response.text()), 'text/html');
        const root = document.getElementById('fv-settings-root'); root.replaceChildren(parsed.querySelector('.fv-bulk-hero'), parsed.querySelector('.fv-bulk-workspace'));
        root.dataset.fvThemeClass = document.body.dataset.fvThemeClass;
        // Measure the actual Recovery surface in the same root and theme, without exposing duplicate controls.
        const recovery = parsed.querySelector('.fv-recovery-module-wrap');
        recovery.inert = true; recovery.setAttribute('aria-hidden', 'true');
        recovery.style.cssText = 'position:fixed;left:0;top:0;width:900px;visibility:hidden;pointer-events:none';
        recovery.querySelector('#fv-recovery-overview').innerHTML = '<div class="fv-recovery-headline">Recovery</div><div class="fv-recovery-stat-card"><i class="fa fa-folder-o"></i><div><strong>5</strong><span>folders</span></div></div>';
        root.append(recovery);
        // Use the production runtime normalizer, including nested Docker state and VM pause semantics.
        const source = await fetch('/plugin/scripts/folderviewplus.js').then(response => response.text());
        const helper = source.slice(source.indexOf('const getItemRuntimeStateKind ='), source.indexOf('const valueIsTruthy ='));
        const script = document.createElement('script'); script.textContent = helper + '\nwindow.fixtureRuntimeKind = getItemRuntimeStateKind;'; document.head.append(script);
    });
    await page.addStyleTag({ content: 'html{font-size:10px}body{margin:0}#fv-settings-root{padding:24px}button{letter-spacing:2px}select,input{font:inherit}#fv-settings-root{overflow:visible}' });
    for (const style of ['ui.host-buttons', 'bulk-assignment-workspace']) await page.addStyleTag({ url: `${baseUrl}/plugin/styles/${style}.css` });
    for (const script of ['safe-dom', 'bulk-assignment.shared', 'bulk-assignment.view', 'bulk-assignment', 'csp-events']) await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/folderviewplus.${script}.js` });
    await page.addScriptTag({ url: `${baseUrl}/fixtures/bulk-assignment.fixture.js` });
};
const rows = page => page.locator('#docker-bulk-items-list .bulk-item-name').allTextContents();
const selected = page => page.locator('#docker-bulk-items').evaluate(select => [...select.selectedOptions].map(option => option.value).sort());
const verifyLayout = async page => {
    const metrics = await page.evaluate(() => {
        const panel = document.querySelector('.bulk-module:not([hidden])');
        const rect = node => node.getBoundingClientRect();
        const style = selector => getComputedStyle(document.querySelector(selector));
        const matches = (bulk, recovery, property = 'fontSize') => Math.abs(parseFloat(style(bulk)[property]) - parseFloat(style(recovery)[property])) < 0.1;
        const recoveryScale = matches('.bulk-item-name', '.fv-recovery-intro span') && matches('#fv-bulk-title', '.fv-recovery-headline')
            && matches('.bulk-source-switch button', '.fv-recovery-source-switch button') && matches('.bulk-move-button', '.fv-recovery-primary-actions button')
            && matches('.bulk-stage-heading strong', '.fv-recovery-stage-head > div > strong') && matches('.bulk-stage-heading span', '.fv-recovery-stage-head > div > span')
            && matches('.bulk-summary-value', '.fv-recovery-stat-card strong') && matches('.bulk-summary-label', '.fv-recovery-stat-card span')
            && matches('.bulk-summary-card > i', '.fv-recovery-stat-card > i') && matches('.bulk-stage', '.fv-recovery-stage', 'paddingTop');
        const footer = rect(panel.querySelector('.bulk-stage-review')); const body = rect(panel.querySelector('.bulk-workspace-body'));
        return { overflow: document.documentElement.scrollWidth > innerWidth + 1, columns: getComputedStyle(panel.querySelector('.bulk-workspace-body')).gridTemplateColumns.split(' ').length,
            summaryColumns: getComputedStyle(panel.querySelector('.bulk-summary-grid')).gridTemplateColumns.split(' ').length,
            footerBelow: footer.top >= body.bottom - 1, readable: recoveryScale,
            destinationTextClear: parseFloat(getComputedStyle(panel.querySelector('.bulk-select-wrap select')).paddingInlineStart) >= rect(panel.querySelector('.bulk-select-wrap > i')).width + 18,
            controls: [...panel.querySelectorAll('.bulk-workspace-actions button, .bulk-move-button')].map(button => ({ width: rect(button).width, height: rect(button).height, top: rect(button).top, bottom: rect(button).bottom })),
            inside: [...panel.querySelectorAll('.bulk-stage')].every(node => rect(node).left >= 0 && rect(node).right <= innerWidth + 1),
            sourceCount: [...document.querySelectorAll('.bulk-module')].filter(node => getComputedStyle(node).display !== 'none').length };
    });
    assert.equal(metrics.overflow, false, JSON.stringify(metrics));
    assert.equal(metrics.inside, true, JSON.stringify(metrics));
    assert.equal(metrics.readable, true, 'Bulk typography, icons, and panel padding must match Recovery in the same rendered root');
    assert.equal(metrics.destinationTextClear, true, 'the destination icon must not cover its text');
    assert.equal(metrics.sourceCount, 1);
    assert.ok(metrics.controls.every(control => control.width >= 44 && control.height >= 40), JSON.stringify(metrics));
    return metrics;
};
export const registerBulkAssignmentCases = ({ test, baseUrl }) => {
    test('Bulk move workspace matches the desktop layout and keeps filtered selection, sorting, and source state', async ({ page }) => {
        await page.setViewportSize({ width: 1672, height: 1100 }); await mountBulk(page, baseUrl);
        let layout = await verifyLayout(page); assert.equal(layout.columns, 2); assert.equal(layout.summaryColumns, 4); assert.equal(layout.footerBelow, true);
        assert.equal(await page.locator('#docker-bulk-available-summary').textContent(), '5');
        assert.deepEqual(await rows(page), ['alpha', 'already', 'beta', 'gamma', 'offline']);
        assert.deepEqual(await page.locator('#docker-bulk-items-list .bulk-runtime-status').allTextContents(), ['Running', 'Running', 'Paused', 'Stopped', 'Unknown']);
        assert.equal(await page.locator('#docker-bulk-assign-btn').isDisabled(), true);
        await page.locator('#docker-bulk-items-list input[value="alpha"]').check();
        await page.locator('#docker-bulk-filter').fill('beta');
        assert.equal(await page.locator('#docker-bulk-table-filter').inputValue(), 'beta'); assert.deepEqual(await rows(page), ['beta']);
        await page.locator('#docker-bulk-toggle-all').check(); assert.deepEqual(await selected(page), ['alpha', 'beta']);
        assert.match(await page.locator('#docker-bulk-selected-count').textContent(), /hidden.*1/);
        await page.locator('.bulk-module:not([hidden]) [data-fv-onclick*="none"]').click(); assert.deepEqual(await selected(page), ['alpha']);
        await page.locator('.bulk-module:not([hidden]) [data-fv-onclick*="invert"]').click(); assert.deepEqual(await selected(page), ['alpha', 'beta']);
        await page.locator('.bulk-module:not([hidden]) [data-fv-bulk-action="clear-filters"]').click();
        await page.locator('#docker-bulk-current-folder').selectOption('media'); await page.locator('#docker-bulk-status-filter').selectOption('started'); assert.deepEqual(await rows(page), ['alpha']);
        await page.locator('.bulk-module:not([hidden]) [data-fv-bulk-action="clear-filters"]').click();
        await page.locator('.bulk-module:not([hidden]) [data-fv-bulk-sort="name"]').click(); assert.deepEqual(await rows(page), ['offline', 'gamma', 'beta', 'already', 'alpha']);
        assert.equal(await page.locator('.bulk-module:not([hidden]) th[aria-sort="descending"]').count(), 1);
        await page.locator('#docker-bulk-folder').selectOption('media'); assert.equal(await page.locator('#docker-bulk-action-summary').textContent(), '0'); assert.equal(await page.locator('#docker-bulk-assign-btn').isDisabled(), true);
        await page.locator('#docker-bulk-folder').selectOption('target'); assert.match(await page.locator('#docker-bulk-assign-btn').textContent(), /Move containers \(2\)/);
        await page.locator('[data-fv-bulk-source="vm"]').click(); assert.equal(await page.locator('#fv-bulk-title').textContent(), 'Bulk Move VMs');
        await page.locator('#vm-bulk-items-list input[value="Desktop"]').check(); assert.match(await page.locator('#vm-bulk-assign-btn').textContent(), /Move VMs \(1\)/);
        await page.locator('[data-fv-bulk-source="docker"]').click(); assert.deepEqual(await selected(page), ['alpha', 'beta']);
        await page.locator('.bulk-module:not([hidden]) [data-fv-bulk-action="destination"]').click(); assert.equal(await page.locator('#docker-bulk-folder').evaluate(node => node === document.activeElement), true);
        await page.screenshot({ path: 'tmp/fixture-browser-artifacts/bulk-workspace-desktop.png' });
        await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 390, height: 844 }); layout = await verifyLayout(page); assert.equal(layout.columns, 1); assert.equal(layout.summaryColumns, 2);
        await page.screenshot({ path: 'tmp/fixture-browser-artifacts/bulk-workspace-mobile.png' });
        await page.evaluate(() => document.documentElement.dir = 'rtl'); await verifyLayout(page);
    });
    test('Bulk move locks confirmation and application, preserves cancel, and retains atomic backup, retry, and undo', async ({ page }) => {
        await mountBulk(page, baseUrl); await page.locator('#docker-bulk-items-list input[value="alpha"]').check();
        await page.locator('#docker-bulk-assign-btn').click();
        assert.equal(await page.locator('#docker-bulk-folder').isDisabled(), true); assert.equal(await page.locator('[data-fv-bulk-source="vm"]').isDisabled(), true);
        await page.evaluate(() => { fixtureBulk.api.assignSelectedItems('docker'); fixtureBulk.confirm(false); });
        assert.equal(await page.evaluate(() => fixtureBulk.confirmations.length), 0); assert.equal(await page.evaluate(() => fixtureBulk.requests.length), 0);
        assert.deepEqual(await selected(page), ['alpha']); assert.equal(await page.locator('#docker-bulk-folder').isDisabled(), false);
        await page.evaluate(() => { fixtureBulk.defer = true; fixtureBulk.fail = true; });
        await page.locator('#docker-bulk-assign-btn').click(); await page.evaluate(() => fixtureBulk.confirm(true)); await page.waitForFunction(() => fixtureBulk.requests.length === 1);
        assert.equal(await page.locator('#docker-bulk-items-list input[value="alpha"]').isDisabled(), true); assert.equal(await page.locator('#docker-bulk-assign-btn').isDisabled(), true);
        await page.evaluate(() => fixtureBulk.release()); await page.locator('#docker-bulk-retry-failed').waitFor({ state: 'visible' }); await page.waitForFunction(() => !document.getElementById('docker-bulk-retry-failed').disabled);
        assert.deepEqual(await selected(page), ['alpha']); assert.match(await page.locator('#docker-bulk-result').textContent(), /failed/);
        await page.evaluate(() => { fixtureBulk.defer = false; fixtureBulk.fail = false; }); await page.locator('#docker-bulk-retry-failed').click(); await page.evaluate(() => fixtureBulk.confirm(true));
        await page.waitForFunction(() => fixtureBulk.requests.length === 2 && document.getElementById('docker-bulk-result').classList.contains('is-success'));
        assert.deepEqual(await selected(page), []); assert.equal(await page.locator('#docker-bulk-retry-failed').isHidden(), true);
        const result = await page.evaluate(() => ({ backups: fixtureBulk.backups, undo: fixtureBulk.undo, requests: fixtureBulk.requests.map(request => ({ url: request.url, items: JSON.parse(request.items) })), refreshes: fixtureBulk.refreshes }));
        assert.equal(result.backups, 2); assert.equal(result.undo, 2); assert.equal(result.requests.length, 2); assert.deepEqual(result.requests.map(request => request.items), [['alpha'], ['alpha']]);
        assert.ok(result.requests.every(request => request.url.endsWith('/bulk_assign.php'))); assert.deepEqual(result.refreshes, ['docker', 'backups', 'docker', 'backups']);
        await page.locator('[data-fv-bulk-source="vm"]').click(); await page.locator('#vm-bulk-items-list input[value="Desktop"]').check(); await page.locator('#vm-bulk-assign-btn').click(); await page.evaluate(() => fixtureBulk.confirm(true));
        await page.waitForFunction(() => document.getElementById('vm-bulk-result').classList.contains('is-success')); assert.equal(await page.evaluate(() => fixtureBulk.requests[2].type), 'vm');
    });
    test('Bulk move safely handles empty, hostile, and large inventories without stale rows or duplicate handlers', async ({ page }) => {
        await mountBulk(page, baseUrl);
        await page.evaluate(() => { fixtureBulk.info.docker = {}; fixtureBulk.folders.docker = {}; fixtureBulk.render('docker'); });
        assert.match(await page.locator('#docker-bulk-items-list').textContent(), /No items detected/); assert.equal(await page.locator('#docker-bulk-folder').isDisabled(), true);
        await page.evaluate(() => {
            fixtureBulk.folders.docker = { target: { name: '<img src=x onerror=alert(1)>', containers: [] } };
            fixtureBulk.info.docker = Object.fromEntries(Array.from({ length: 280 }, (_, i) => ['item-' + i, { running: true }]));
            fixtureBulk.info.docker['<script>unsafe</script>'] = { running: true }; fixtureBulk.render('docker');
            fixtureBulk.api.filterBulkItems('docker', 'item-279');
        });
        await page.waitForFunction(() => document.querySelectorAll('#docker-bulk-items-list .bulk-item-row').length === 1);
        assert.deepEqual(await rows(page), ['item-279']); assert.equal(await page.locator('.fv-bulk-workspace img, .fv-bulk-workspace script').count(), 0);
        await page.locator('#docker-bulk-table-filter').fill(''); await page.waitForFunction(() => document.querySelectorAll('#docker-bulk-items-list .bulk-item-row').length === 281);
        assert.equal(await page.locator('#docker-bulk-items-list .bulk-item-name').first().textContent(), '<script>unsafe</script>');
        await page.locator('#docker-bulk-toggle-all').check(); assert.equal((await selected(page)).length, 281);
        await page.locator('#docker-bulk-table-filter').fill('nothing-matches'); assert.match(await page.locator('#docker-bulk-items-list').textContent(), /No items match/);
        assert.equal(await page.locator('#docker-bulk-toggle-all').isDisabled(), true); assert.equal((await selected(page)).length, 281);
        for (let i = 0; i < 3; i++) { await page.locator('[data-fv-bulk-source="vm"]').click(); await page.locator('[data-fv-bulk-source="docker"]').click(); }
        await page.locator('.bulk-module:not([hidden]) [data-fv-bulk-action="clear-filters"]').click(); await page.waitForFunction(() => document.querySelectorAll('#docker-bulk-items-list .bulk-item-row').length === 281);
        await page.locator('.bulk-module:not([hidden]) [data-fv-bulk-sort="name"]').click(); assert.equal(await page.locator('.bulk-module:not([hidden]) th[aria-sort="descending"]').count(), 1);
        assert.equal(await page.evaluate(() => fixtureBulk.errors.length), 0);
    });
    test('Bulk move translates static controls and dynamic counts while preserving member and folder names', async ({ page }) => {
        for (const locale of ['de', 'ar']) {
            await mountBulk(page, baseUrl);
            for (const script of ['CLDRPluralRuleParser', 'jquery.i18n', 'jquery.i18n.messagestore', 'jquery.i18n.fallbacks', 'jquery.i18n.language', 'jquery.i18n.parser', 'jquery.i18n.emitter', 'jquery.i18n.emitter.bidi']) await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/include/${script}.js` });
            await page.addScriptTag({ url: `${baseUrl}/plugin/scripts/folderviewplus.i18n.js` });
            await page.evaluate(async locale => {
                await FolderViewPlusI18n.configure({ requestedLocale: locale, resolvedLocale: locale, fallbackChain: [locale, 'en'], direction: locale === 'ar' ? 'rtl' : 'ltr', namespaces: ['common', 'legacy-surface'],
                    assets: ['en', locale].flatMap(language => ['common', 'legacy-surface'].map(namespace => ({ locale: language, namespace, url: `/plugin/langs/namespaces/${language}/${namespace}.json` }))) });
                fixtureBulk.api.renderBulkItemOptions('docker');
            }, locale);
            await page.locator('#docker-bulk-items-list input[value="alpha"]').check();
            assert.doesNotMatch(await page.locator('#docker-bulk-assign-btn').textContent(), /Move containers|\$1/);
            assert.match(await page.locator('#docker-bulk-assign-btn').textContent(), /1/);
            assert.deepEqual(await rows(page), ['alpha', 'already', 'beta', 'gamma', 'offline']);
            assert.equal(await page.locator('#docker-bulk-folder').inputValue(), 'target'); assert.match(await page.locator('#docker-bulk-footer-target').textContent(), /Audiobooks/);
            await page.locator('[data-fv-bulk-source="vm"]').click();
            assert.doesNotMatch(await page.locator('#fv-bulk-title').textContent(), /Bulk Move VMs/);
            await page.setViewportSize({ width: 390, height: 844 }); await verifyLayout(page);
        }
    });
};
