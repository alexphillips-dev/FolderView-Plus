import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';

const scriptPath = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(scriptPath), '..');
const pluginDir = path.join(rootDir, 'src', 'folderview.plus', 'usr', 'local', 'emhttp', 'plugins', 'folderview.plus');
const fixtureDir = path.join(rootDir, 'tests', 'browser', 'fixtures');
const artifactDir = path.resolve(process.env.FVPLUS_FIXTURE_BROWSER_ARTIFACT_DIR || path.join(rootDir, 'tmp', 'fixture-browser-artifacts'));
const timeoutMs = Math.max(5000, Number(process.env.FVPLUS_FIXTURE_BROWSER_TIMEOUT_MS) || 20000);
const requestedBrowsers = String(process.env.FVPLUS_FIXTURE_BROWSERS || 'chromium')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
const browserTypes = { chromium, firefox, webkit };
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const englishSurfaceCatalog = readJson(path.join(pluginDir, 'langs', 'namespaces', 'en', 'legacy-surface.json'));
const germanSurfaceCatalog = readJson(path.join(pluginDir, 'langs', 'namespaces', 'de', 'legacy-surface.json'));
const surfaceKeyFor = (phrase) => Object.keys(englishSurfaceCatalog).find((key) => englishSurfaceCatalog[key] === phrase);

fs.mkdirSync(artifactDir, { recursive: true });

const mimeTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml'
};

const safeResolve = (base, relativePath) => {
    const resolvedBase = path.resolve(base);
    const resolved = path.resolve(resolvedBase, String(relativePath || '').replace(/^[/\\]+/, ''));
    return resolved === resolvedBase || resolved.startsWith(`${resolvedBase}${path.sep}`) ? resolved : '';
};

const readRequestBody = (request) => new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
        size += chunk.length;
        if (size > 1024 * 1024) {
            reject(new Error('Fixture request body exceeded 1 MiB.'));
            request.destroy();
            return;
        }
        chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
});

const fixtureServer = http.createServer(async (request, response) => {
    try {
        const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
        if (requestUrl.pathname === '/api/echo') {
            const rawBody = await readRequestBody(request);
            const body = Object.fromEntries(new URLSearchParams(rawBody));
            response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
            response.end(JSON.stringify({
                ok: true,
                body,
                headers: {
                    request: request.headers['x-fv-request'] || '',
                    token: request.headers['x-fv-token'] || '',
                    trace: request.headers['x-fv-trace'] || ''
                }
            }));
            return;
        }

        let filePath = '';
        if (requestUrl.pathname === '/' || requestUrl.pathname === '/runtime') {
            filePath = path.join(fixtureDir, 'runtime.html');
        } else if (requestUrl.pathname === '/settings') {
            filePath = path.join(fixtureDir, 'settings.html');
        } else if (requestUrl.pathname === '/folder-editor') {
            filePath = path.join(fixtureDir, 'folder-editor.html');
        } else if (requestUrl.pathname === '/import') {
            filePath = path.join(fixtureDir, 'import.html');
        } else if (requestUrl.pathname === '/localization') {
            filePath = path.join(fixtureDir, 'localization.html');
        } else if (requestUrl.pathname === '/ui-primitives') {
            filePath = path.join(fixtureDir, 'ui-primitives.html');
        } else if (requestUrl.pathname === '/dashboard-layout') {
            filePath = path.join(fixtureDir, 'dashboard-layout.html');
        } else if (requestUrl.pathname.startsWith('/plugin/')) {
            filePath = safeResolve(pluginDir, requestUrl.pathname.slice('/plugin/'.length));
        } else if (requestUrl.pathname.startsWith('/fixtures/')) {
            filePath = safeResolve(fixtureDir, requestUrl.pathname.slice('/fixtures/'.length));
        } else if (requestUrl.pathname === '/vendor/jquery.js') {
            filePath = path.join(rootDir, 'node_modules', 'jquery', 'dist', 'jquery.min.js');
        }

        if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
            response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end('Not found');
            return;
        }
        const extension = path.extname(filePath).toLowerCase();
        response.writeHead(200, {
            'Content-Type': mimeTypes[extension] || 'application/octet-stream',
            'Cache-Control': 'no-store'
        });
        fs.createReadStream(filePath).pipe(response);
    } catch (error) {
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end(String(error?.stack || error));
    }
});

await new Promise((resolve, reject) => {
    fixtureServer.once('error', reject);
    fixtureServer.listen(0, '127.0.0.1', resolve);
});
const address = fixtureServer.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

const tests = [];
const test = (name, handler) => tests.push({ name, handler });
const slug = (value) => String(value || 'test').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90);

test('Shared UI primitives provide accessible modal, action, toast, and progress behavior', async ({ page }) => {
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

    await page.evaluate(() => { window.fixtureUI.showToast(); });
    assert.equal(await page.locator('.fv-ui-toast.is-success').count(), 1);
    await page.click('.fv-ui-toast-close');

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
    assert.equal(snapshot.autoBoundMessageCount, 1566);
    assert.ok(snapshot.autoTranslatedNodeCount >= 303);
    assert.equal(settledSnapshot.autoTranslatedNodeCount, snapshot.autoTranslatedNodeCount, 'localization must settle without observing its own writes forever');
});

test('Docker action bar is idempotent and reports fixture counts', async ({ page }) => {
    await page.goto(`${baseUrl}/runtime`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.fixtureRuntime?.api);
    await page.evaluate(() => window.fixtureRuntime.syncRepeatedly(8));
    assert.equal(await page.locator('#fvplus-docker-action-bar').count(), 1);
    assert.equal(await page.locator('[data-fvplus-docker-action="filter-unassigned"] .fvplus-docker-action-count').textContent(), '1');
    assert.equal(await page.locator('[data-fvplus-docker-action="filter-updates"] .fvplus-docker-action-count').textContent(), '1');
    assert.equal(await page.locator('[data-fvplus-docker-action="filter-empty"] .fvplus-docker-action-count').textContent(), '1');
});

test('Docker and VM host adapters share row, structure, and idempotent hook contracts', async ({ page }) => {
    await page.goto(`${baseUrl}/runtime`, { waitUntil: 'load' });
    const result = await page.evaluate(() => window.fixtureRuntime.exerciseHostAdapters());
    assert.equal(result.dockerSnapshot.structure.valid, true);
    assert.equal(result.dockerSnapshot.structure.rowCounts.folders, 3);
    assert.deepEqual(result.dockerNames, ['plex', 'sonarr', 'toolbox', 'orphan']);
    assert.equal(result.vmStructure.ok, true);
    assert.equal(result.vmSnapshot.structure.rowCounts.items, 1);
    assert.equal(result.wrapperReused, true);
    assert.equal(result.hookSnapshot.hooks.loadlist.callCount, 1);
    assert.equal(result.restored, true);
    assert.deepEqual(result.calls, [
        ['second-handler', 'refresh'],
        ['original', 'refresh']
    ]);
});

test('Compact Matrix responds to the Dashboard widget width without clipping long names', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${baseUrl}/dashboard-layout`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.fixtureDashboardLayout?.snapshot().folderColumns === 3);

    const wide = await page.evaluate(() => window.fixtureDashboardLayout.snapshot());
    assert.equal(wide.folderColumns, 3);
    assert.equal(wide.horizontalOverflow, false);
    assert.equal(wide.telemetry.folderColumns, 3);
    assert.ok(wide.telemetry.widgetWidthPx > 1000);

    await page.evaluate(() => window.fixtureDashboardLayout.resize(900));
    await page.waitForFunction(() => window.fixtureDashboardLayout.snapshot().folderColumns === 2);
    const narrowDesktopWidget = await page.evaluate(() => window.fixtureDashboardLayout.snapshot());
    assert.equal(narrowDesktopWidget.folderColumns, 2, 'a narrow widget in a wide browser must not retain three columns');
    assert.equal(narrowDesktopWidget.horizontalOverflow, false);

    await page.evaluate(() => window.fixtureDashboardLayout.resize(390));
    await page.waitForFunction(() => window.fixtureDashboardLayout.snapshot().folderColumns === 1);
    const mobile = await page.evaluate(() => window.fixtureDashboardLayout.snapshot());
    assert.equal(mobile.folderColumns, 1);
    assert.equal(mobile.memberColumns, 1);
    assert.equal(mobile.horizontalOverflow, false);
    assert.ok(mobile.tileWidths.every((width) => width > 300), 'mobile member tiles should use the full folder width');

    await page.evaluate(() => window.fixtureDashboardLayout.resize(1000));
    await page.waitForFunction(() => window.fixtureDashboardLayout.snapshot().folderColumns === 2);
    const restored = await page.evaluate(() => window.fixtureDashboardLayout.snapshot());
    assert.equal(restored.folderColumns, 2);
    assert.equal(restored.memberColumns, 2);
    assert.ok(restored.tileWidths.slice(0, 3).every((width) => width >= 220));
});

test('Dashboard action rail exposes accessible primary controls and a keyboard-safe view popover', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 760 });
    await page.goto(`${baseUrl}/dashboard-layout`, { waitUntil: 'load' });
    const rail = page.locator('.fv-dashboard-layout-quick-rail');
    await rail.waitFor();
    assert.deepEqual(await rail.locator('.fv-dashboard-quick-action').evaluateAll((buttons) => buttons.map((button) => button.dataset.fvQuickAction)), [
        'layout-menu', 'expand-toggle', 'running-only', 'view-options'
    ]);
    const buttonBox = await rail.locator('[data-fv-quick-action="layout-menu"]').boundingBox();
    assert.ok(buttonBox.width >= 24 && buttonBox.height >= 24, 'desktop action buttons must remain usable mouse targets');

    const layoutTrigger = rail.locator('[data-fv-quick-action="layout-menu"]');
    await layoutTrigger.click();
    const popover = page.locator('.fv-dashboard-view-popover-shell');
    await popover.waitFor();
    const layoutSelect = popover.locator('[data-fv-layout-select]');
    assert.equal(await layoutSelect.locator('option').count(), 7);
    assert.equal(await layoutSelect.inputValue(), 'compactmatrix');
    const compactButtonStyles = await popover.evaluate((root) => {
        const displayGrid = root.querySelector('.fv-dashboard-view-options');
        const layoutControl = root.querySelector('[data-fv-layout-select]');
        const displayButton = root.querySelector('[data-fv-view-action="running-only"]');
        const colorProbe = document.createElement('span');
        colorProbe.style.color = 'var(--fvplus-ui-text-primary)';
        colorProbe.style.border = '1px solid var(--fvplus-ui-border-subtle)';
        root.append(colorProbe);
        const layoutStyle = getComputedStyle(layoutControl);
        const buttonStyle = getComputedStyle(displayButton);
        const probeStyle = getComputedStyle(colorProbe);
        const snapshot = {
            gap: Number.parseFloat(getComputedStyle(displayGrid).gap || '0'),
            layoutMarginTop: Number.parseFloat(layoutStyle.marginTop || '0'),
            layoutColor: layoutStyle.color,
            marginTop: Number.parseFloat(buttonStyle.marginTop || '0'),
            marginRight: Number.parseFloat(buttonStyle.marginRight || '0'),
            color: buttonStyle.color,
            expectedColor: probeStyle.color,
            borderColor: buttonStyle.borderTopColor,
            expectedBorderColor: probeStyle.borderTopColor
        };
        colorProbe.remove();
        return snapshot;
    });
    assert.ok(compactButtonStyles.gap <= 2, 'display choices should be tightly grouped');
    assert.equal(compactButtonStyles.layoutMarginTop, 0);
    assert.equal(compactButtonStyles.layoutColor, compactButtonStyles.expectedColor, 'the layout dropdown should use neutral theme text');
    assert.equal(compactButtonStyles.marginTop, 0);
    assert.equal(compactButtonStyles.marginRight, 0);
    assert.equal(compactButtonStyles.color, compactButtonStyles.expectedColor, 'global Unraid button colors must not override the neutral popover text');
    assert.equal(compactButtonStyles.borderColor, compactButtonStyles.expectedBorderColor, 'global Unraid button borders must not override the neutral popover border');
    await layoutSelect.focus();
    await page.keyboard.press('Escape');
    await popover.waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-fv-quick-action')), 'layout-menu');

    await rail.locator('[data-fv-quick-action="view-options"]').click();
    await popover.locator('[data-fv-view-action="health-emphasis"]').click();
    assert.equal(await popover.locator('[data-fv-view-action="health-emphasis"]').getAttribute('aria-pressed'), 'true');
    await popover.locator('[data-fv-view-action="running-only"]').click();
    assert.equal(await rail.locator('[data-fv-quick-action="running-only"]').getAttribute('aria-pressed'), 'true');
    await popover.locator('[data-fv-layout-select]').selectOption('classic');
    await page.waitForFunction(() => window.fixtureDashboardLayout.state.layout === 'classic');
    assert.equal(await layoutTrigger.getAttribute('data-fv-layout'), 'classic');

    await rail.locator('[data-fv-quick-action="view-options"]').click();
    const reset = popover.locator('[data-fv-view-action="reset-view"]');
    assert.equal(await reset.isDisabled(), false);
    await reset.click();
    await rail.locator('[data-fv-quick-action="view-options"]').click();
    assert.equal(await popover.locator('[data-fv-view-action="reset-view"]').isDisabled(), true);
    await page.locator('body').click({ position: { x: 4, y: 4 } });
    await popover.waitFor({ state: 'detached' });

    await page.evaluate(() => window.fixtureDashboardLayout.resize(390));
    await page.waitForFunction(() => document.querySelector('.fv-dashboard-layout-inline-host')?.classList.contains('is-narrow'));
    assert.deepEqual((await page.evaluate(() => window.fixtureDashboardLayout.snapshot())).visibleQuickActions, ['expand-toggle', 'view-options']);
    const mobileButtonBox = await rail.locator('[data-fv-quick-action="view-options"]').boundingBox();
    assert.ok(mobileButtonBox.width >= 30 && mobileButtonBox.height >= 30, 'narrow action buttons must retain larger touch targets');
});

test('Docker folder filters and Reset view reconcile immediately', async ({ page }) => {
    await page.goto(`${baseUrl}/runtime`, { waitUntil: 'load' });
    await page.click('[data-fvplus-docker-action="filter-empty"]');
    const visibleFolderIds = await page.locator('#docker_list > tr.folder:not(.fv-toolbar-filter-hidden)').evaluateAll((rows) => rows.map((row) => row.dataset.folderId));
    assert.deepEqual(visibleFolderIds, ['empty']);
    await page.click('[data-fvplus-docker-menu="tools"]');
    await page.click('[data-fvplus-docker-tool="reset"]');
    assert.equal(await page.locator('#docker_list > tr.folder.fv-toolbar-filter-hidden').count(), 0);
    assert.equal(await page.evaluate(() => window.fixtureRuntime.api.getFilterMode()), 'all');
});

test('Docker View menu switches Host list and FolderView without duplicating rows', async ({ page }) => {
    await page.goto(`${baseUrl}/runtime`, { waitUntil: 'load' });
    const initialRows = await page.locator('#docker_list > tr').count();
    for (const mode of ['host', 'folderview', 'host', 'folderview']) {
        await page.click('[data-fvplus-docker-menu="view"]');
        await page.click(`[data-fvplus-docker-view="${mode}"]`);
        await page.waitForFunction((expected) => document.body.dataset.fixtureView === expected, mode);
    }
    assert.equal(await page.locator('#docker_list > tr').count(), initialRows);
    assert.equal(await page.locator('#fvplus-docker-action-bar').count(), 1);
    assert.equal(await page.evaluate(() => window.fixtureRuntime.getRefreshCount()), 4);
});

test('Docker action menus support keyboard open and Escape close', async ({ page }) => {
    await page.goto(`${baseUrl}/runtime`, { waitUntil: 'load' });
    const trigger = page.locator('[data-fvplus-docker-menu="view"]');
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('Escape');
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-fvplus-docker-menu')), 'view');
});

test('Privacy classifier honors each secondary masking preference independently', async ({ page }) => {
    await page.goto(`${baseUrl}/runtime`, { waitUntil: 'load' });
    await page.evaluate(() => window.FolderViewPlusRuntimePrivacy.apply('docker', true, {
        privacyMaskVolumePaths: false,
        privacyMaskImageRegistry: true,
        privacyMaskPublicIps: true,
        privacyMaskInterfaces: true,
        privacyMaskExternalUrls: true
    }));
    await page.waitForFunction(() => document.querySelector('#fixture-public-ip')?.classList.contains('fvplus-sensitive-public-ip'));
    assert.equal(await page.locator('body.fvplus-privacy-docker-sensitive-publicIps').count(), 1);
    assert.equal(await page.locator('body.fvplus-privacy-docker-sensitive-volumePaths').count(), 0);
    assert.equal(await page.locator('#fixture-volume.fvplus-sensitive-volume-path').count(), 1);
    assert.equal(await page.locator('#fixture-public-ip.fvplus-sensitive-public-ip').count(), 1);
    assert.equal(await page.locator('#fixture-private-ip.fvplus-sensitive-public-ip').count(), 0);
    assert.equal(await page.locator('#fixture-interface.fvplus-sensitive-interface').count(), 1);
    assert.equal(await page.locator('#fixture-external-url.fvplus-sensitive-external-url').count(), 1);
    const maskedFilter = await page.locator('#fixture-public-ip').evaluate((node) => getComputedStyle(node).filter);
    const unmaskedFilter = await page.locator('#fixture-volume').evaluate((node) => getComputedStyle(node).filter);
    assert.notEqual(maskedFilter, 'none');
    assert.equal(unmaskedFilter, 'none');
    await page.evaluate(() => window.FolderViewPlusRuntimePrivacy.apply('docker', false, {}));
    assert.equal(await page.locator('body.fvplus-privacy-docker-sensitive').count(), 0);
});

test('Standard request client sends mutation markers, token, and trace ID', async ({ page }) => {
    await page.goto(`${baseUrl}/runtime`, { waitUntil: 'load' });
    const response = await page.evaluate(() => window.FolderViewPlusRequest.postJson('/api/echo', { hello: 'world' }));
    assert.equal(response.ok, true);
    assert.equal(response.body.hello, 'world');
    assert.equal(response.body._fv_request, '1');
    assert.equal(response.headers.request, '1');
    assert.equal(response.headers.token, 'fixture-request-token-1234567890');
    assert.match(response.headers.trace, /^fv-/);
});

test('Lifecycle reconciliation replaces host loadlist with incremental refreshes', async ({ page }) => {
    await page.goto(`${baseUrl}/runtime`, { waitUntil: 'load' });
    const result = await page.evaluate(() => window.fixtureRuntime.exerciseLifecyclePatch());
    assert.equal(result.callbackName, '__fvplusDockerLifecycleRefresh');
    assert.equal(result.calls, 1);
    assert.equal(result.lifecycleRefreshes, 3);
});

test('Settings chrome keeps search and mode controls aligned without clipping', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 720 });
    await page.goto(`${baseUrl}/settings`, { waitUntil: 'load' });
    const metrics = await page.evaluate(() => {
        const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
        const search = rect('.fv-settings-search-wrap');
        const basic = rect('[data-mode="basic"]');
        const advanced = rect('[data-mode="advanced"]');
        const wizard = rect('#fv-run-wizard');
        return {
            searchRight: search.right,
            basicLeft: basic.left,
            tops: [basic.top, advanced.top, wizard.top],
            heights: [basic.height, advanced.height, wizard.height],
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth
        };
    });
    assert.ok(metrics.searchRight <= metrics.basicLeft + 1, 'search must not overlap the Basic button');
    assert.ok(Math.max(...metrics.tops) - Math.min(...metrics.tops) <= 2, 'mode and Wizard buttons must share a row');
    assert.ok(Math.max(...metrics.heights) - Math.min(...metrics.heights) <= 4, 'mode and Wizard buttons should have compatible heights');
    assert.ok(metrics.scrollWidth <= metrics.clientWidth + 1, 'Settings chrome must not cause horizontal overflow');
    assert.equal(await page.locator('#fv-settings-clear-search').isHidden(), true);
    await page.locator('#fv-settings-clear-search').evaluate((button) => { button.hidden = false; });
    const clearBox = await page.locator('#fv-settings-clear-search').boundingBox();
    assert.ok(clearBox.width <= 40 && clearBox.height <= 40, 'clear search control must stay compact');
});

test('Folder action sheet uses the compact retained action set and accessible dialog', async ({ page }) => {
    await page.goto(`${baseUrl}/folder-editor`, { waitUntil: 'load' });
    await page.click('#open-folder-actions');
    const dialog = page.getByRole('dialog', { name: 'Media' });
    await dialog.waitFor();
    assert.equal(await page.locator('#fv-folder-action-sheet-backdrop').count(), 1);
    assert.equal(await dialog.locator('[data-action="move"]').count(), 1);
    assert.equal(await dialog.locator('[data-action="export"]').count(), 1);
    assert.equal(await dialog.locator('[data-action="import"]').count(), 1);
    assert.equal(await dialog.locator('[data-action="delete"]').count(), 1);
    assert.equal(await dialog.getByText('Scan tree integrity').count(), 0);
    assert.equal(await dialog.getByText('Repair tree integrity').count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement?.matches('[data-close-folder-actions]')), true);
});

test('Folder action sheet traps focus, copies details, and restores trigger focus', async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {
                writeText: async (value) => {
                    window.__fixtureCopiedText = String(value);
                }
            }
        });
    });
    await page.goto(`${baseUrl}/folder-editor`, { waitUntil: 'load' });
    await page.click('#open-folder-actions');
    await page.locator('.fv-folder-action-sheet-details summary').click();
    await page.click('[data-copy-folder-id]');
    await page.waitForFunction(() => window.__fixtureCopiedText === 'media');
    assert.equal(await page.locator('[data-copy-folder-id] span').textContent(), 'Copied');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#fv-folder-action-sheet-backdrop').count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'open-folder-actions');
    await page.click('#open-folder-actions');
    await page.click('[data-action="delete"]');
    assert.equal(await page.evaluate(() => window.fixtureFolderEditor.calls.includes('delete')), true);
    assert.equal(await page.locator('#fv-folder-action-sheet-backdrop').count(), 0);
});

test('Import selection applies group choices without mutating unrelated operations', async ({ page }) => {
    await page.goto(`${baseUrl}/import`, { waitUntil: 'load' });
    const operations = {
        mode: 'replace',
        creates: [{ folder: { name: 'New Media' } }],
        upserts: [{ id: 'media', folder: { name: 'Media' } }],
        deletes: ['old'],
        pathMappings: [],
        pathConflicts: []
    };
    await page.evaluate((value) => window.fixtureImport.renderSelection(value, { old: { name: 'Old folder' } }), operations);
    assert.equal(await page.locator('#import-preview-selection .import-selection-item').count(), 3);
    await page.locator('input[data-group-toggle="creates"]').uncheck();
    const filtered = await page.evaluate((value) => window.fixtureImport.filteredSelection(value), operations);
    assert.equal(filtered.creates.length, 0);
    assert.equal(filtered.upserts.length, 1);
    assert.equal(filtered.deletes.length, 1);
});

test('Import progress dialog reports deterministic progress and closes cleanly', async ({ page }) => {
    await page.goto(`${baseUrl}/import`, { waitUntil: 'load' });
    await page.evaluate(() => window.fixtureImport.openProgress('docker', 4, { title: 'Applying Docker changes' }));
    assert.equal(await page.locator('#import-apply-progress-dialog').getAttribute('aria-hidden'), 'false');
    await page.evaluate(() => window.fixtureImport.updateProgress({ completed: 2, total: 4, label: 'Updating Media' }));
    assert.equal(await page.locator('#import-apply-progress-step').textContent(), 'Step 2 of 4');
    assert.equal(await page.locator('#import-apply-progress-percent').textContent(), 'Progress 50%');
    assert.equal(await page.locator('#import-apply-progress-bar').getAttribute('style'), 'width: 50%;');
    await page.evaluate(() => window.fixtureImport.closeProgress());
    assert.equal(await page.locator('#import-apply-progress-dialog').getAttribute('aria-hidden'), 'true');
});

const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    browsers: requestedBrowsers,
    tests: [],
    passed: 0,
    failed: 0
};

let exitCode = 0;
try {
    for (const browserName of requestedBrowsers) {
        const browserType = browserTypes[browserName];
        if (!browserType) {
            throw new Error(`Unsupported fixture browser: ${browserName}`);
        }
        const browser = await browserType.launch({ headless: true });
        try {
            for (const entry of tests) {
                const context = await browser.newContext({ viewport: { width: 1180, height: 720 }, colorScheme: 'dark' });
                const page = await context.newPage();
                page.setDefaultTimeout(timeoutMs);
                const browserErrors = [];
                page.on('pageerror', (error) => browserErrors.push(`pageerror: ${String(error?.stack || error)}`));
                page.on('console', (message) => {
                    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
                });
                const startedAt = Date.now();
                const result = { browser: browserName, name: entry.name, durationMs: 0, pass: false, errors: [] };
                try {
                    await entry.handler({ page, context, browserName });
                    assert.deepEqual(browserErrors, [], `browser emitted errors:\n${browserErrors.join('\n')}`);
                    result.pass = true;
                    report.passed += 1;
                    console.log(`PASS [${browserName}] ${entry.name}`);
                } catch (error) {
                    exitCode = 1;
                    report.failed += 1;
                    result.errors.push(String(error?.stack || error));
                    result.errors.push(...browserErrors);
                    const screenshotPath = path.join(artifactDir, `${slug(browserName)}-${slug(entry.name)}.png`);
                    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
                    result.screenshot = path.relative(rootDir, screenshotPath).replaceAll('\\', '/');
                    console.error(`FAIL [${browserName}] ${entry.name}`);
                    console.error(result.errors.join('\n'));
                } finally {
                    result.durationMs = Date.now() - startedAt;
                    report.tests.push(result);
                    await context.close();
                }
            }
        } finally {
            await browser.close();
        }
    }
} finally {
    await new Promise((resolve) => fixtureServer.close(resolve));
    fs.writeFileSync(path.join(artifactDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

console.log(`Fixture browser suite: ${report.passed} passed, ${report.failed} failed.`);
process.exitCode = exitCode;
