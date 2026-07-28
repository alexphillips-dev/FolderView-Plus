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
const axeScriptPath = path.join(rootDir, 'node_modules', 'axe-core', 'axe.min.js');
const accessibilityEnabled = !/^(0|false|no|off)$/i.test(String(process.env.FVPLUS_FIXTURE_ACCESSIBILITY || '1'));
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
        if (requestUrl.pathname === '/plugins/folderview.plus/server/security.php') {
            const rawBody = await readRequestBody(request);
            const body = Object.fromEntries(new URLSearchParams(rawBody));
            assert.equal(request.method, 'POST');
            assert.equal(body.action, 'issue_nonce');
            assert.equal(body.endpoint, 'echo.php');
            response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
            response.end(JSON.stringify({
                ok: true,
                nonce: 'a'.repeat(64)
            }));
            return;
        }

        if (requestUrl.pathname === '/api/echo.php') {
            const rawBody = await readRequestBody(request);
            const body = Object.fromEntries(new URLSearchParams(rawBody));
            response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
            response.end(JSON.stringify({
                ok: true,
                body,
                headers: {
                    request: request.headers['x-fv-request'] || '',
                    token: request.headers['x-fv-token'] || '',
                    trace: request.headers['x-fv-trace'] || '',
                    nonce: request.headers['x-fv-nonce'] || ''
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
        } else if (requestUrl.pathname === '/dashboard-lifecycle') {
            filePath = path.join(fixtureDir, 'dashboard-lifecycle.html');
        } else if (requestUrl.pathname === '/vm-lifecycle') {
            filePath = path.join(fixtureDir, 'vm-lifecycle.html');
        } else if (requestUrl.pathname === '/future-docker-host') {
            filePath = path.join(fixtureDir, 'future-docker-host.html');
        } else if (requestUrl.pathname === '/docker-layout-stability') {
            filePath = path.join(fixtureDir, 'docker-layout-stability.html');
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
        console.error('Fixture server request failed:', error);
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Internal fixture server error');
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
    assert.equal(snapshot.autoBoundMessageCount, 1581);
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

test('Docker preview hydration and cached-width bootstrap preserve first-frame geometry', async ({ page }) => {
    await page.goto(`${baseUrl}/docker-layout-stability`, { waitUntil: 'load' });
    const result = await page.evaluate(() => window.fixturePreviewActionStability.run());
    assert.equal(result.consoleNodePreserved, true, 'console action node must be reconciled in place');
    assert.equal(result.logsNodePreserved, true, 'logs action node must be reconciled in place');
    assert.ok(result.consoleShiftPx <= 0.1, `console action shifted ${result.consoleShiftPx}px`);
    assert.ok(result.logsShiftPx <= 0.1, `logs action shifted ${result.logsShiftPx}px`);
    assert.equal(result.webuiReady, true);
    assert.equal(result.pendingWebui, 0);
    assert.equal(result.slotWidths.length, 3);
    assert.equal(result.slotWidths.every((width) => Math.abs(width - 13) <= 0.1), true);
    assert.equal(result.bootstrapWidth, 286);
    assert.equal(result.firstVisibleWidth, 286);
    assert.equal(result.settledWidth, result.firstVisibleWidth);
});

test('Docker folder context menu opens from the first folder-icon click', async ({ page }) => {
    await page.goto(`${baseUrl}/docker-layout-stability`, { waitUntil: 'load' });
    const result = await page.evaluate(() => window.fixtureFolderContextFirstClick.run());
    assert.equal(result.attachCount, 1, 'the first click must prepare the folder context menu once');
    assert.equal(result.openCount, 1, 'the first click must reach the newly attached context-menu opener');
    assert.equal(result.defaultPrevented, false, 'menu preparation must not cancel the opening click');
});

test('Docker folder Unpin intent is retained while the preceding Pin save settles', async ({ page }) => {
    await page.goto(`${baseUrl}/docker-layout-stability`, { waitUntil: 'load' });
    const result = await page.evaluate(() => window.fixtureQueuedFolderPinIntent.run());
    assert.equal(result.queuedBeforeSave, true, 'Unpin must queue while Pin is saving');
    assert.equal(result.pinnedBeforeSave, false, 'Unpin must update the visible state before Pin finishes saving');
    assert.equal(result.pinned, false, 'one queued Unpin action must produce the requested final state');
    assert.deepEqual(result.transitions, ['pinned', 'unpinned', 'pin-saved', 'unpin-saved']);
    assert.equal(result.runningAfterSave, false);
    assert.equal(result.queuedAfterSave, false);
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

test('future native Docker host stays authoritative while compatibility diagnostics initialize', async ({ page }) => {
    await page.goto(`${baseUrl}/future-docker-host`, { waitUntil: 'load' });
    await page.waitForFunction(() => (
        window.fixtureFutureDocker?.snapshot().compatibility?.provider?.state === 'ready'
    ));
    const snapshot = await page.evaluate(() => window.fixtureFutureDocker.snapshot());
    assert.equal(snapshot.compatibility.hostGeneration, 'native-docker-vue');
    assert.equal(snapshot.compatibility.runtimeActivationAllowed, false);
    assert.equal(snapshot.compatibility.ownership.dockerPage, 'unraid-native');
    assert.equal(snapshot.compatibility.ownership.folderOverlayAllowed, false);
    assert.equal(snapshot.compatibility.ownership.nativeOrganizerMutationAllowed, false);
    assert.equal(snapshot.compatibility.graphql.endpointAvailable, true);
    assert.equal(snapshot.compatibility.graphql.apiVersion, '4.40.0-fixture');
    assert.equal(snapshot.compatibility.graphql.queryShape, 'docker.containers');
    assert.equal(snapshot.compatibility.graphql.mutations.restart, true);
    assert.equal(snapshot.compatibility.graphql.organizer.policy, 'detect-only');
    assert.equal(snapshot.providers.selected, 'unraid-graphql');
    assert.deepEqual(snapshot.providers.availableProviders, ['unraid-graphql']);
    assert.equal(snapshot.nativeMarkupAfter, snapshot.nativeMarkupBefore);
    assert.equal(snapshot.loadlistUnchanged, true);
    assert.equal(snapshot.classicTableCount, 0);
    assert.equal(snapshot.folderRowCount, 0);
    assert.equal(snapshot.pluginActionBarCount, 0);
    assert.equal(snapshot.enabledLegacyStyleCount, 0);
    assert.equal(snapshot.fatalBannerCount, 0);
    assert.deepEqual(snapshot.legacyRuntimeExports, {
        createFolderBtn: 'undefined',
        hostAdapterSnapshot: 'undefined'
    });
    assert.deepEqual(
        await page.evaluate(() => window.FolderViewPlusDockerBootstrapPromise),
        {
            loaded: false,
            hostGeneration: 'native-docker-vue',
            reason: 'compatibility-safe-mode'
        }
    );
    assert.equal(await page.evaluate(() => window.fixtureFutureDocker.fatalErrors.length), 0);
    assert.equal(
        await page.evaluate(() => window.fixtureFutureDocker.calls.every((entry) => entry.csrf === 'future-host-fixture-token')),
        true
    );

    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    assert.deepEqual(
        await page.evaluate(() => window.FolderViewPlusDockerProviders.getDefaultRegistry().snapshot().availableProviders),
        []
    );
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
    const wideVisual = await page.evaluate(() => window.fixtureDashboardLayout.captureVisual('wide-fixture'));
    assert.equal(wideVisual.layout.folderGrid.expectedColumns, 3);
    assert.equal(wideVisual.layout.folderGrid.appliedColumns, 3);
    assert.equal(wideVisual.layout.folderGrid.renderedColumns, 3);
    assert.equal(wideVisual.environment.viewportClass, 'desktop-size');
    assert.equal(wideVisual.verdict.noUnexpectedClipping, true);

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
    const narrowVisual = await page.evaluate(() => window.fixtureDashboardLayout.captureVisual('narrow-widget-fixture'));
    assert.equal(narrowVisual.layout.folderGrid.expectedColumns, 1);
    assert.equal(narrowVisual.layout.folderGrid.renderedColumns, 1);
    assert.equal(narrowVisual.layout.memberGrid.renderedColumns, 1);
    assert.equal(narrowVisual.verdict.noUnexpectedClipping, true);

    await page.evaluate(() => window.fixtureDashboardLayout.resize(1000));
    await page.waitForFunction(() => window.fixtureDashboardLayout.snapshot().folderColumns === 2);
    const restored = await page.evaluate(() => window.fixtureDashboardLayout.snapshot());
    assert.equal(restored.folderColumns, 2);
    assert.equal(restored.memberColumns, 2);
    assert.ok(restored.tileWidths.slice(0, 3).every((width) => width >= 220));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.fixtureDashboardLayout.resize(1180));
    await page.waitForFunction(() => window.fixtureDashboardLayout.snapshot().folderColumns === 1);
    const portraitVisual = await page.evaluate(() => window.fixtureDashboardLayout.captureVisual('phone-portrait-fixture'));
    assert.equal(portraitVisual.environment.viewportClass, 'phone-size');
    assert.equal(portraitVisual.environment.viewport.width, 390);
    assert.equal(portraitVisual.layout.folderGrid.renderedColumns, 1);
    assert.equal(portraitVisual.layout.memberGrid.renderedColumns, 1);
    assert.equal(portraitVisual.verdict.noUnexpectedClipping, true);

    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForFunction(() => window.fixtureDashboardLayout.snapshot().folderColumns === 2);
    const landscapeVisual = await page.evaluate(() => window.fixtureDashboardLayout.captureVisual('phone-landscape-fixture'));
    assert.equal(landscapeVisual.environment.viewportClass, 'tablet-size');
    assert.equal(landscapeVisual.environment.viewport.width, 844);
    assert.equal(landscapeVisual.layout.folderGrid.renderedColumns, 2);
    assert.equal(landscapeVisual.verdict.noUnexpectedClipping, true);
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
    const capture = popover.locator('[data-fv-view-action="capture-diagnostics"]');
    assert.equal(await capture.count(), 1);
    await capture.click();
    assert.equal(await page.evaluate(() => window.fixtureDashboardLayout.state.captureCount), 1);
    assert.equal(
        await page.evaluate(() => window.fixtureDashboardLayout.visualRecord().latest.trigger),
        'manual'
    );
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

test('Dashboard Started only filters expanded and collapsed members and reconciles live state', async ({ page }) => {
    await page.goto(`${baseUrl}/dashboard-layout`, { waitUntil: 'load' });
    assert.equal(await page.locator('#fixture-stopped-member.fv-dashboard-started-only-hidden').count(), 0);
    assert.equal(await page.locator('#fixture-stopped-folder.fv-dashboard-started-only-hidden').count(), 0);

    await page.locator('[data-fv-quick-action="running-only"]').click();
    assert.equal(await page.locator('#fixture-running-member.fv-dashboard-started-only-hidden').count(), 0);
    assert.equal(await page.locator('#fixture-paused-member.fv-dashboard-started-only-hidden').count(), 0);
    assert.equal(await page.locator('#fixture-stopped-member.fv-dashboard-started-only-hidden').count(), 1);
    assert.equal(await page.locator('#fixture-collapsed-stopped-member.fv-dashboard-started-only-hidden').count(), 1);
    assert.equal(await page.locator('#fixture-stopped-folder.fv-dashboard-started-only-hidden').count(), 1);
    assert.equal(await page.locator('#fixture-nested-running-folder.fv-dashboard-started-only-hidden').count(), 0);
    assert.equal(await page.locator('#fixture-nested-parent.fv-dashboard-started-only-hidden').count(), 0, 'a running descendant keeps its parent folder visible');
    assert.equal(await page.locator('#fixture-running-member').isVisible(), true);
    assert.equal(await page.locator('#fixture-stopped-member').isVisible(), false);

    const reconciliation = await page.evaluate(() => window.fixtureDashboardLayout.setRuntimeState('#fixture-running-member', 'stopped'));
    assert.equal(reconciliation.enabled, true);
    assert.equal(await page.locator('[data-fv-folder-id="system"].fv-dashboard-started-only-hidden').count(), 0, 'paused members keep a mixed folder visible');
    await page.evaluate(() => window.fixtureDashboardLayout.setRuntimeState('#fixture-paused-member', 'stopped'));
    assert.equal(await page.locator('[data-fv-folder-id="system"].fv-dashboard-started-only-hidden').count(), 1);

    await page.evaluate(() => {
        const toggle = document.querySelector('#apps');
        toggle.checked = false;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForFunction(() => document.querySelectorAll('.fv-dashboard-started-only-hidden').length === 0);
    assert.equal(await page.locator('.fv-dashboard-started-only-hidden').count(), 0);
    assert.equal(await page.locator('#fixture-stopped-member').isVisible(), true);
    assert.equal(await page.locator('#fixture-stopped-folder').isVisible(), true);
});

test('Dashboard Started only applies the same runtime-state policy to VM folders', async ({ page }) => {
    await page.goto(`${baseUrl}/dashboard-layout`, { waitUntil: 'load' });
    await page.evaluate(() => {
        const toggle = document.querySelector('#vms');
        toggle.checked = true;
        toggle.dispatchEvent(new Event('change', { bubbles: true }));
        window.fixtureDashboardLayout.controller.applyDashboardStartedOnlyFilterForType('vm');
    });
    await page.waitForFunction(() => document.querySelector('#fixture-vm-stopped')?.classList.contains('fv-dashboard-started-only-hidden'));
    assert.equal(await page.locator('#fixture-vm-running.fv-dashboard-started-only-hidden').count(), 0);
    assert.equal(await page.locator('#fixture-vm-paused.fv-dashboard-started-only-hidden').count(), 0);
    assert.equal(await page.locator('#fixture-vm-stopped.fv-dashboard-started-only-hidden').count(), 1);
    assert.equal(await page.locator('#fixture-vm-folder.fv-dashboard-started-only-hidden').count(), 0);
});

test('Dashboard lifecycle keeps native cards, folder totals, icons, and context actions synchronized', async ({ page }) => {
    await page.goto(`${baseUrl}/dashboard-lifecycle`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.fixtureDashboardLifecycle?.getSnapshot().memberState === 'running');

    await page.click('#fixture-audiobookshelf-card');
    assert.deepEqual(await page.locator('#fixture-context-menu [data-action]').evaluateAll((buttons) => buttons.map((button) => button.dataset.action)), [
        'stop', 'pause', 'restart'
    ]);
    await page.click('#fixture-context-menu [data-action="stop"]');
    await page.waitForFunction(() => {
        const snapshot = window.fixtureDashboardLifecycle.getSnapshot();
        return snapshot.memberState === 'stopped' && snapshot.busyIconCount === 0;
    });
    let snapshot = await page.evaluate(() => window.fixtureDashboardLifecycle.getSnapshot());
    assert.equal(snapshot.folderState, 'stopped');
    assert.equal(snapshot.folderText, '2/2 stopped');
    assert.match(snapshot.memberIconClasses, /fa-square/);
    assert.match(snapshot.memberIconClasses, /red-text/);
    assert.doesNotMatch(snapshot.memberIconClasses, /fa-spin|fa-refresh/);

    await page.click('#fixture-audiobookshelf-card');
    assert.deepEqual(await page.locator('#fixture-context-menu [data-action]').evaluateAll((buttons) => buttons.map((button) => button.dataset.action)), ['start']);
    await page.click('#fixture-context-menu [data-action="start"]');
    await page.waitForFunction(() => {
        const current = window.fixtureDashboardLifecycle.getSnapshot();
        return current.memberState === 'running' && current.busyIconCount === 0;
    });
    snapshot = await page.evaluate(() => window.fixtureDashboardLifecycle.getSnapshot());
    assert.equal(snapshot.folderState, 'running');
    assert.equal(snapshot.folderText, '1/2 started');
    assert.match(snapshot.memberIconClasses, /fa-play/);
    assert.match(snapshot.memberIconClasses, /green-text/);
    assert.doesNotMatch(snapshot.memberIconClasses, /fa-spin|fa-refresh/);

    await page.click('#fixture-audiobookshelf-card');
    assert.deepEqual(await page.locator('#fixture-context-menu [data-action]').evaluateAll((buttons) => buttons.map((button) => button.dataset.action)), [
        'stop', 'pause', 'restart'
    ]);
    snapshot = await page.evaluate(() => window.fixtureDashboardLifecycle.getSnapshot());
    assert.equal(snapshot.hostContextCallCount, 3, 'idempotent context wrapping must invoke the native builder once per open');
});

test('Dashboard Started only follows rapid Stop then Start reconciliation without stale tails', async ({ page }) => {
    await page.goto(`${baseUrl}/dashboard-lifecycle`, { waitUntil: 'load' });
    await page.check('#apps');
    await page.waitForFunction(() => document.querySelector('#fixture-paperless-card')?.classList.contains('fv-dashboard-started-only-hidden'));
    assert.equal(await page.locator('#fixture-audiobookshelf-card').isVisible(), true);

    await page.click('#fixture-audiobookshelf-card');
    await page.click('#fixture-context-menu [data-action="stop"]');
    await page.waitForFunction(() => window.fixtureDashboardLifecycle.getSnapshot().folderHidden === true);
    let snapshot = await page.evaluate(() => window.fixtureDashboardLifecycle.getSnapshot());
    assert.equal(snapshot.memberHidden, true);
    assert.equal(snapshot.busyIconCount, 0);

    await page.uncheck('#apps');
    await page.click('#fixture-audiobookshelf-card');
    await page.click('#fixture-context-menu [data-action="start"]');
    await page.waitForFunction(() => window.fixtureDashboardLifecycle.getSnapshot().memberState === 'running');
    await page.check('#apps');
    await page.waitForFunction(() => window.fixtureDashboardLifecycle.getSnapshot().folderHidden === false);
    snapshot = await page.evaluate(() => window.fixtureDashboardLifecycle.getSnapshot());
    assert.equal(snapshot.memberHidden, false);
    assert.equal(snapshot.folderText, '1/2 started');
    assert.equal(snapshot.busyIconCount, 0);
    const finalizedActions = await page.evaluate(() => window.fixtureDashboardLifecycle.events
        .filter((event) => event.type === 'finalize')
        .map((event) => ({ action: event.action, settled: event.settled })));
    assert.deepEqual(finalizedActions, [
        { action: 'stop', settled: true },
        { action: 'start', settled: true }
    ]);
});

test('VM lifecycle keeps native rows, folder totals, icons, and context actions synchronized', async ({ page }) => {
    await page.goto(`${baseUrl}/vm-lifecycle`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.fixtureVmLifecycle?.getSnapshot().runtimeState === 'running');

    await page.click('#fixture-vm-row');
    assert.deepEqual(await page.locator('#fixture-context-menu [data-action]').evaluateAll((buttons) => buttons.map((button) => button.dataset.action)), [
        'domain-stop', 'domain-pause', 'domain-restart'
    ]);
    await page.click('#fixture-context-menu [data-action="domain-stop"]');
    await page.waitForFunction(() => {
        const snapshot = window.fixtureVmLifecycle.getSnapshot();
        return snapshot.runtimeState === 'shutoff' && snapshot.busyIconCount === 0;
    });
    let snapshot = await page.evaluate(() => window.fixtureVmLifecycle.getSnapshot());
    assert.equal(snapshot.folderText, '1/1 stopped');
    assert.match(snapshot.memberIconClasses, /fa-square/);
    assert.match(snapshot.memberIconClasses, /red-text/);
    assert.equal(snapshot.consoleIconClasses, 'fa fa-desktop');
    assert.equal(snapshot.menuIconClasses, 'fa fa-bars');
    assert.equal(snapshot.nativeLoadlistCount, 0);

    await page.click('#fixture-vm-row');
    assert.deepEqual(await page.locator('#fixture-context-menu [data-action]').evaluateAll((buttons) => buttons.map((button) => button.dataset.action)), ['domain-start']);
    await page.click('#fixture-context-menu [data-action="domain-start"]');
    await page.waitForFunction(() => {
        const current = window.fixtureVmLifecycle.getSnapshot();
        return current.runtimeState === 'running' && current.busyIconCount === 0;
    });
    snapshot = await page.evaluate(() => window.fixtureVmLifecycle.getSnapshot());
    assert.equal(snapshot.folderText, '1/1 started');
    assert.match(snapshot.memberIconClasses, /fa-play/);
    assert.match(snapshot.memberIconClasses, /green-text/);
    assert.equal(snapshot.lifecycle.fallbackCount, 0);
    assert.equal(snapshot.lifecycle.eventGroups.lifecycleSurfaceFinalized, 2);
    assert.equal(snapshot.contextCallCount, 2);
});

test('VM lifecycle reconciles Pause and Resume without stale native menus or spinner tails', async ({ page }) => {
    await page.goto(`${baseUrl}/vm-lifecycle`, { waitUntil: 'load' });
    await page.click('#fixture-vm-row');
    await page.click('#fixture-context-menu [data-action="domain-pause"]');
    await page.waitForFunction(() => {
        const snapshot = window.fixtureVmLifecycle.getSnapshot();
        return snapshot.runtimeState === 'paused' && snapshot.busyIconCount === 0;
    });
    let snapshot = await page.evaluate(() => window.fixtureVmLifecycle.getSnapshot());
    assert.equal(snapshot.folderText, '1/1 paused');
    assert.match(snapshot.memberIconClasses, /fa-pause/);
    assert.match(snapshot.memberIconClasses, /orange-text/);

    await page.click('#fixture-vm-row');
    assert.deepEqual(await page.locator('#fixture-context-menu [data-action]').evaluateAll((buttons) => buttons.map((button) => button.dataset.action)), [
        'domain-resume', 'domain-destroy'
    ]);
    await page.click('#fixture-context-menu [data-action="domain-resume"]');
    await page.waitForFunction(() => {
        const current = window.fixtureVmLifecycle.getSnapshot();
        return current.runtimeState === 'running' && current.busyIconCount === 0;
    });
    snapshot = await page.evaluate(() => window.fixtureVmLifecycle.getSnapshot());
    assert.equal(snapshot.nativeLoadlistCount, 0);
    assert.equal(snapshot.lifecycle.fallbackCount, 0);
    assert.equal(snapshot.consoleIconClasses, 'fa fa-desktop');
    assert.equal(snapshot.menuIconClasses, 'fa fa-bars');
});

test('Dashboard lifecycle performs one native fallback when Start snapshots remain stale', async ({ page }) => {
    await page.goto(`${baseUrl}/dashboard-lifecycle`, { waitUntil: 'load' });
    await page.click('#fixture-audiobookshelf-card');
    await page.click('#fixture-context-menu [data-action="stop"]');
    await page.waitForFunction(() => window.fixtureDashboardLifecycle.getSnapshot().memberState === 'stopped');

    await page.click('#fixture-audiobookshelf-card');
    await page.evaluate(() => window.fixtureDashboardLifecycle.setStaleRefreshBudget(3));
    await page.click('#fixture-context-menu [data-action="start"]');
    await page.waitForFunction(() => {
        const snapshot = window.fixtureDashboardLifecycle.getSnapshot();
        return snapshot.memberState === 'running' && snapshot.nativeLoadlistCount === 1 && snapshot.busyIconCount === 0;
    });
    const snapshot = await page.evaluate(() => window.fixtureDashboardLifecycle.getSnapshot());
    assert.equal(snapshot.nativeLoadlistCount, 1);
    assert.match(snapshot.memberIconClasses, /fa-play/);
    assert.match(snapshot.memberIconClasses, /green-text/);
    assert.doesNotMatch(snapshot.memberIconClasses, /fa-spin|fa-refresh/);
    const fallbackFinalizers = await page.evaluate(() => window.fixtureDashboardLifecycle.events
        .filter((event) => event.type === 'finalize' && event.action === 'start')
        .map((event) => ({ reason: event.reason, settled: event.settled })));
    assert.deepEqual(fallbackFinalizers, [{ reason: 'attempts-exhausted', settled: false }]);
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

test('Docker Privacy toggle preserves its widget through optimistic, confirmed, external, and failed saves', async ({ page }) => {
    await page.goto(`${baseUrl}/runtime`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.fixtureRuntime?.privacyToggle);
    await page.evaluate(() => {
        window.fixtureRuntime.privacyToggle.rememberIdentity();
        window.fixtureRuntime.privacyToggle.syncRepeatedly(8);
    });

    const initial = await page.evaluate(() => window.fixtureRuntime.privacyToggle.snapshot());
    assert.equal(initial.mounted, true);
    assert.equal(initial.enabled, false);
    assert.equal(initial.pending, false);
    assert.equal(initial.mountCount, 1);
    assert.equal(initial.switchInitializeCount, 1);
    assert.equal(initial.privacySwitchInitializeCount, 1);
    assert.equal(initial.identityStable, true);

    await page.click('#fixture-privacy-shell .switch-button-background');
    const optimistic = await page.evaluate(() => window.fixtureRuntime.privacyToggle.snapshot());
    assert.equal(optimistic.enabled, true);
    assert.equal(optimistic.state.enabled, true);
    assert.equal(optimistic.pending, true);
    assert.equal(optimistic.widgetChecked, 'true');
    assert.equal(optimistic.identityStable, true);
    assert.equal(optimistic.mountCount, 1);
    assert.equal(optimistic.switchInitializeCount, 1);
    assert.deepEqual(
        optimistic.events.filter((entry) => entry.type === 'toggle'),
        [{ type: 'toggle', enabled: true }]
    );

    await page.evaluate(() => {
        window.fixtureRuntime.privacyToggle.syncRepeatedly(8);
        window.fixtureRuntime.privacyToggle.resolveSave();
    });
    const confirmed = await page.evaluate(() => window.fixtureRuntime.privacyToggle.snapshot());
    assert.equal(confirmed.enabled, true);
    assert.equal(confirmed.pending, false);
    assert.equal(confirmed.widgetChecked, 'true');
    assert.equal(confirmed.identityStable, true);
    assert.equal(confirmed.mountCount, 1);
    assert.equal(confirmed.switchInitializeCount, 1);

    await page.evaluate(() => window.fixtureRuntime.privacyToggle.applyExternalState(false));
    const external = await page.evaluate(() => window.fixtureRuntime.privacyToggle.snapshot());
    assert.equal(external.enabled, false);
    assert.equal(external.widgetChecked, 'false');
    assert.equal(external.identityStable, true);
    assert.equal(external.events.filter((entry) => entry.type === 'toggle').length, 1, 'programmatic synchronization must not queue another save');

    await page.click('#fixture-privacy-shell .switch-button-background');
    await page.evaluate(() => window.fixtureRuntime.privacyToggle.rejectSave());
    await page.waitForFunction(() => (
        window.fixtureRuntime.privacyToggle.snapshot().events.some((entry) => entry.type === 'error')
    ));
    const failed = await page.evaluate(() => window.fixtureRuntime.privacyToggle.snapshot());
    assert.equal(failed.enabled, true);
    assert.equal(failed.state.enabled, true);
    assert.equal(failed.pending, false);
    assert.equal(failed.widgetChecked, 'true');
    assert.equal(failed.identityStable, true);
    assert.equal(failed.mountCount, 1);
    assert.equal(failed.switchInitializeCount, 1);
    assert.equal(failed.privacySwitchInitializeCount, 1);
    assert.equal(failed.events.filter((entry) => entry.type === 'toggle').length, 2, 'repeated synchronization must not duplicate the change handler');
    assert.deepEqual(
        failed.events.filter((entry) => entry.type === 'error').map((entry) => entry.message),
        ['fixture save failed']
    );
});

test('Standard request client sends mutation markers, token, and trace ID', async ({ page }) => {
    await page.goto(`${baseUrl}/runtime`, { waitUntil: 'load' });
    const response = await page.evaluate(() => window.FolderViewPlusRequest.postJson('/api/echo.php', { hello: 'world' }));
    assert.equal(response.ok, true);
    assert.equal(response.body.hello, 'world');
    assert.equal(response.body._fv_request, '1');
    assert.equal(response.body._fv_nonce, 'a'.repeat(64));
    assert.equal(response.headers.request, '1');
    assert.equal(response.headers.token, 'fixture-request-token-1234567890');
    assert.equal(response.headers.nonce, 'a'.repeat(64));
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

test('Filters and view settings uses the responsive card workspace without clipping', async ({ page }) => {
    const readLayout = async () => page.evaluate(async () => {
        await window.fixtureSettings.viewSettingsReady;
        const panel = document.getElementById('docker-view-settings');
        const grid = panel.querySelector('.fv-view-settings-grid');
        const cards = [...grid.children];
        const panelRect = panel.getBoundingClientRect();
        const gridColumns = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
        return {
            cardCount: cards.length,
            gridColumns,
            panelWidth: panelRect.width,
            cardsInsidePanel: cards.every((card) => {
                const rect = card.getBoundingClientRect();
                return rect.left >= panelRect.left - 1 && rect.right <= panelRect.right + 1;
            }),
            privacyIsCard: document.getElementById('docker-dashboard-privacy-options')?.closest('.fv-settings-card-privacy') !== null,
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth
        };
    });

    await page.setViewportSize({ width: 1700, height: 980 });
    await page.goto(`${baseUrl}/settings`, { waitUntil: 'load' });
    let layout = await readLayout();
    assert.equal(layout.cardCount, 8);
    assert.equal(layout.gridColumns, 4);
    assert.equal(layout.cardsInsidePanel, true);
    assert.equal(layout.privacyIsCard, true);
    assert.ok(layout.scrollWidth <= layout.clientWidth + 1, 'desktop panel must not cause horizontal overflow');

    await page.setViewportSize({ width: 1200, height: 900 });
    layout = await readLayout();
    assert.equal(layout.gridColumns, 2);
    assert.equal(layout.cardsInsidePanel, true);
    assert.ok(layout.scrollWidth <= layout.clientWidth + 1, 'tablet panel must not cause horizontal overflow');

    await page.setViewportSize({ width: 700, height: 900 });
    layout = await readLayout();
    assert.equal(layout.gridColumns, 1);
    assert.equal(layout.cardsInsidePanel, true);
    assert.ok(layout.scrollWidth <= layout.clientWidth + 1, 'mobile panel must not cause horizontal overflow');
});

test('Diagnostics workspace renders stable health states without desktop or mobile overflow', async ({ page }) => {
    const readDiagnosticsLayout = async () => page.evaluate(async () => {
        await window.fixtureSettings.diagnosticsReady;
        const workspace = document.getElementById('fv-diagnostics-workspace');
        const coreGrid = workspace.querySelector('.fv-diagnostics-card-section.is-system .fv-diagnostics-health-grid');
        const additionalSection = workspace.querySelector('.fv-diagnostics-card-section.is-additional');
        const workspaceRect = workspace.getBoundingClientRect();
        const cards = [...workspace.querySelectorAll('.fv-diagnostics-health-card')];
        const systemCards = [...coreGrid.querySelectorAll('.fv-diagnostics-health-card')];
        const systemFooters = systemCards.map((card) => card.querySelector('.fv-diagnostics-health-card-foot'));
        const themeFooter = coreGrid.querySelector('[data-fv-diagnostics-card="theme"] .fv-diagnostics-health-card-foot');
        const toolbarButtons = [...workspace.querySelectorAll('.fv-diagnostics-toolbar > .fv-ui-button')];
        const hero = workspace.querySelector('.fv-diagnostics-hero');
        const metricsGrid = workspace.querySelector('.fv-diagnostics-metrics');
        const coreProgress = workspace.querySelector('.fv-diagnostics-core-progress');
        const coreProgressFill = coreProgress?.firstElementChild;
        const coreMetric = coreProgress?.closest('.fv-diagnostics-metric');
        const systemIcons = [...workspace.querySelectorAll('.fv-diagnostics-health-card-icon .fv-ui-svg-icon')];
        const storageUpdateIcons = [...workspace.querySelectorAll(
            '.fv-diagnostics-health-card-icon:is(.is-storage, .is-update) .fv-ui-svg-icon'
        )];
        const metricIcons = [...workspace.querySelectorAll('.fv-diagnostics-metric.has-icon > .fv-ui-svg-icon')];
        const metricTitles = [...workspace.querySelectorAll('.fv-diagnostics-metrics dt')];
        const metrics = [...workspace.querySelectorAll('.fv-diagnostics-metrics > div')];
        const supportCards = [...workspace.querySelectorAll('.fv-support-bundle-section-card')];
        const supportIcons = [...workspace.querySelectorAll('.fv-support-bundle-section-icon .fv-ui-svg-icon')];
        const supportIconTiles = [...workspace.querySelectorAll('.fv-support-bundle-section-icon')];
        const supportOverview = workspace.querySelector('.fv-support-bundle-overview');
        const supportSectionGrid = workspace.querySelector('.fv-support-bundle-section-grid');
        const supportOverviewDescription = workspace.querySelector('.fv-support-bundle-overview > p');
        const supportOverviewMeta = [...workspace.querySelectorAll('.fv-support-bundle-preview-meta > span')];
        const supportHeaderIcons = [...workspace.querySelectorAll(
            '.fv-diagnostics-support-card-head > div > .fv-ui-svg-icon'
        )];
        const privacyBadges = [...workspace.querySelectorAll('.fv-support-bundle-privacy-item > strong')];
        const privacyCard = workspace.querySelector('.fv-support-bundle-redaction-card');
        const privacySummary = workspace.querySelector('.fv-support-bundle-privacy-summary');
        const privacyItems = workspace.querySelector('.fv-support-bundle-privacy-items');
        const privacyStatusBadge = workspace.querySelector('.fv-support-bundle-privacy-summary .fv-diagnostics-status-badge');
        const privacyLink = workspace.querySelector('.fv-support-bundle-privacy-disclosure');
        const privacyOmittedBadge = workspace.querySelector('.fv-support-bundle-privacy-item.is-omitted > strong');
        const readableText = [...workspace.querySelectorAll(
            '.fv-diagnostics-health-card-foot, .fv-diagnostics-health-card-detail, .fv-diagnostics-metrics small, .fv-support-bundle-preview-meta'
        )];
        const primaryButton = workspace.querySelector('.fv-diagnostics-toolbar .fv-ui-button.is-primary');
        const neutralButton = workspace.querySelector('.fv-diagnostics-toolbar .fv-ui-button:not(.is-primary):not(.is-export)');
        const exportButton = workspace.querySelector('.fv-diagnostics-toolbar .fv-ui-button.is-export');
        const exportIcon = exportButton?.querySelector('i, .fv-ui-svg-icon');
        const primaryStyle = getComputedStyle(primaryButton);
        const neutralStyle = getComputedStyle(neutralButton);
        const exportStyle = getComputedStyle(exportButton);
        const accentProbe = document.createElement('span');
        accentProbe.style.color = 'var(--fvplus-settings-accent)';
        workspace.append(accentProbe);
        const accent = getComputedStyle(accentProbe).color;
        accentProbe.remove();
        const accentStrongProbe = document.createElement('span');
        accentStrongProbe.style.color = 'var(--fvplus-settings-accent-strong)';
        workspace.append(accentStrongProbe);
        const accentStrong = getComputedStyle(accentStrongProbe).color;
        accentStrongProbe.remove();
        const privacyContentBounds = privacySummary
            ? [...privacySummary.children].reduce((bounds, child) => {
                const rect = child.getBoundingClientRect();
                return {
                    left: Math.min(bounds.left, rect.left),
                    right: Math.max(bounds.right, rect.right)
                };
            }, { left: Number.POSITIVE_INFINITY, right: Number.NEGATIVE_INFINITY })
            : null;
        const privacyCardRect = privacyCard?.getBoundingClientRect();
        const privacySummaryRect = privacySummary?.getBoundingClientRect();
        const privacyItemsRect = privacyItems?.getBoundingClientRect();
        const privacyStatusBadgeRect = privacyStatusBadge?.getBoundingClientRect();
        const privacyLinkRect = privacyLink?.getBoundingClientRect();
        const privacyOmittedStyle = privacyOmittedBadge ? getComputedStyle(privacyOmittedBadge) : null;
        return {
            accentColor: accent,
            coreCards: coreGrid?.children.length || 0,
            additionalSectionVisible: additionalSection !== null,
            secondaryHealthCardsVisible: [...workspace.querySelectorAll('.fv-diagnostics-health-card-head > strong')]
                .some((label) => ['Performance advisories', 'Localization'].includes(label.textContent.trim())),
            technicalDetailsCount: workspace.querySelectorAll('.fv-diagnostics-card-details').length,
            coreColumns: getComputedStyle(coreGrid).gridTemplateColumns.split(' ').filter(Boolean).length,
            hasHealthySummary: workspace.querySelector('.fv-diagnostics-hero.is-healthy') !== null,
            hasClearFindings: workspace.querySelector('.fv-diagnostics-findings.is-clear') !== null,
            metricSvgIcons: metricIcons.length,
            metricIconWidths: metricIcons.map((icon) => icon.getBoundingClientRect().width),
            metricIconColors: metricIcons.map((icon) => getComputedStyle(icon).color),
            metricTitleSizes: metricTitles.map((title) => parseFloat(getComputedStyle(title).fontSize)),
            metricIconsAreTopLeft: metricIcons.every((icon) => {
                const metricRect = icon.closest('.fv-diagnostics-metric').getBoundingClientRect();
                const iconRect = icon.getBoundingClientRect();
                const leftOffset = iconRect.left - metricRect.left;
                const topOffset = iconRect.top - metricRect.top;
                return leftOffset >= 8 && leftOffset <= 16 && topOffset >= 8 && topOffset <= 16;
            }),
            metricCopyIsHorizontallyCentered: metrics
                .filter((metric) => metric.classList.contains('has-icon'))
                .every((metric) => {
                    const metricRect = metric.getBoundingClientRect();
                    const center = metricRect.left + (metricRect.width / 2);
                    return [...metric.querySelectorAll('dt, dd, small')].every((element) => {
                        const rect = element.getBoundingClientRect();
                        return Math.abs((rect.left + (rect.width / 2)) - center) <= 1;
                    });
                }),
            metricCopyIsVerticallyCentered: metrics
                .filter((metric) => metric.classList.contains('has-icon'))
                .every((metric) => {
                    const metricRect = metric.getBoundingClientRect();
                    const copy = [...metric.querySelectorAll('dt, dd, small')];
                    const copyTop = Math.min(...copy.map((element) => element.getBoundingClientRect().top));
                    const copyBottom = Math.max(...copy.map((element) => element.getBoundingClientRect().bottom));
                    return Math.abs(
                        ((copyTop + copyBottom) / 2)
                        - (metricRect.top + (metricRect.height / 2))
                    ) <= 2;
                }),
            metricTextIsCentered: metrics.every((metric) => {
                const metricRect = metric.getBoundingClientRect();
                const center = metricRect.left + (metricRect.width / 2);
                return [...metric.querySelectorAll('dt, dd, small')].every((element) => {
                    const rect = element.getBoundingClientRect();
                    return Math.abs((rect.left + (rect.width / 2)) - center) <= 1;
                });
            }),
            systemSvgIcons: systemIcons.length,
            systemIconWidths: systemIcons.map((icon) => icon.getBoundingClientRect().width),
            systemIconColors: systemIcons.map((icon) => getComputedStyle(icon).color),
            systemFooterBottomInsets: systemCards.map((card, index) => (
                card.getBoundingClientRect().bottom - systemFooters[index].getBoundingClientRect().bottom
            )),
            systemFooterLeftInsets: systemCards.map((card, index) => (
                systemFooters[index].getBoundingClientRect().left - card.getBoundingClientRect().left
            )),
            themeFooterLabel: themeFooter?.textContent.trim() || '',
            storageUpdateIconColors: storageUpdateIcons.map((icon) => getComputedStyle(icon).color),
            supportHeaderIconColors: supportHeaderIcons.map((icon) => getComputedStyle(icon).color),
            toolbarButtonCount: toolbarButtons.length,
            toolbarButtonLabels: toolbarButtons.map((button) => button.textContent.trim()),
            toolbarButtonHeights: toolbarButtons.map((button) => button.getBoundingClientRect().height),
            metricsGridVerticallyCentered: Boolean(hero && metricsGrid)
                && Math.abs(
                    (metricsGrid.getBoundingClientRect().top + (metricsGrid.getBoundingClientRect().height / 2))
                    - (hero.getBoundingClientRect().top + (hero.getBoundingClientRect().height / 2))
                ) <= 1,
            coreProgressRatio: coreProgress && coreProgressFill
                ? coreProgressFill.getBoundingClientRect().width / coreProgress.getBoundingClientRect().width
                : 0,
            coreProgressTrackRatio: coreProgress && coreMetric
                ? (() => {
                    const metricStyle = getComputedStyle(coreMetric);
                    const metricContentWidth = coreMetric.clientWidth
                        - parseFloat(metricStyle.paddingLeft)
                        - parseFloat(metricStyle.paddingRight);
                    return coreProgress.getBoundingClientRect().width / metricContentWidth;
                })()
                : 0,
            supportSvgIcons: supportIcons.length,
            supportIconWidths: supportIcons.map((icon) => icon.getBoundingClientRect().width),
            supportIconColors: supportIcons.map((icon) => getComputedStyle(icon).color),
            supportIconBackgrounds: supportIconTiles.map((icon) => getComputedStyle(icon).backgroundColor),
            supportCardHeights: supportCards.map((card) => card.getBoundingClientRect().height),
            supportCardsShareHeight: supportCards.length > 0
                && Math.max(...supportCards.map((card) => card.getBoundingClientRect().height))
                    - Math.min(...supportCards.map((card) => card.getBoundingClientRect().height)) <= 1,
            supportCardContentStartsAtTop: supportCards.every((card) => {
                const cardRect = card.getBoundingClientRect();
                const iconRect = card.querySelector('.fv-support-bundle-section-icon')?.getBoundingClientRect();
                const copyRect = card.querySelector('.fv-support-bundle-section-copy')?.getBoundingClientRect();
                return iconRect
                    && copyRect
                    && iconRect.top - cardRect.top <= 9
                    && copyRect.top - cardRect.top <= 9
                    && Math.abs(iconRect.top - copyRect.top) <= 1;
            }),
            supportBadgesCenteredAndLower: supportCards.every((card) => {
                const cardRect = card.getBoundingClientRect();
                const badgeRect = card.querySelector('.fv-support-bundle-section-badge')?.getBoundingClientRect();
                const copyRect = card.querySelector('.fv-support-bundle-section-copy')?.getBoundingClientRect();
                return badgeRect
                    && copyRect
                    && Math.abs(
                        (badgeRect.left + (badgeRect.width / 2))
                        - (cardRect.left + (cardRect.width / 2))
                    ) <= 1
                    && badgeRect.top >= copyRect.bottom + 4;
            }),
            supportCardsReachOverviewBottom: Boolean(supportOverview && supportSectionGrid)
                && supportOverview.getBoundingClientRect().bottom
                    - supportSectionGrid.getBoundingClientRect().bottom <= 14,
            supportOverviewDescription: supportOverviewDescription?.textContent.trim() || '',
            supportOverviewMeta: supportOverviewMeta.map((item) => item.textContent.trim()),
            supportIconsAreLeft: supportCards.every((card) => {
                const icon = card.querySelector('.fv-support-bundle-section-icon')?.getBoundingClientRect();
                const copy = card.querySelector('.fv-support-bundle-section-copy')?.getBoundingClientRect();
                return icon && copy && icon.left < copy.left;
            }),
            privacyBadgeCount: privacyBadges.length,
            privacyBadgesAreColored: privacyBadges.every((badge) => {
                const style = getComputedStyle(badge);
                return style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.borderTopColor !== 'rgba(0, 0, 0, 0)';
            }),
            privacyBadgeRadii: privacyBadges.map((badge) => parseFloat(getComputedStyle(badge).borderTopLeftRadius)),
            privacyContentLeftAligned: Boolean(privacyContentBounds && privacyCardRect)
                && privacyContentBounds.left - privacyCardRect.left <= 18,
            privacyContentVerticallyCentered: Boolean(privacySummaryRect && privacyCardRect)
                && Math.abs(
                    (privacySummaryRect.top + (privacySummaryRect.height / 2))
                    - (privacyCardRect.top + (privacyCardRect.height / 2))
                ) <= 2,
            privacyBadgesMatchStatusHeight: Boolean(privacyStatusBadgeRect)
                && privacyBadges.every((badge) => (
                    Math.abs(badge.getBoundingClientRect().height - privacyStatusBadgeRect.height) <= 1
                )),
            privacyBadgesCentered: Boolean(privacyItemsRect && privacyCardRect)
                && Math.abs(
                    (privacyItemsRect.left + (privacyItemsRect.width / 2))
                    - (privacyCardRect.left + (privacyCardRect.width / 2))
                ) <= 2,
            privacyOmittedBorderVisible: Boolean(privacyOmittedStyle)
                && parseFloat(privacyOmittedStyle.borderTopWidth) >= 1
                && privacyOmittedStyle.borderTopColor !== 'rgba(0, 0, 0, 0)'
                && privacyOmittedStyle.borderTopColor !== privacyOmittedStyle.backgroundColor,
            privacyCardHeight: privacyCardRect?.height || 0,
            privacyLinkUsesAccent: getComputedStyle(privacyLink).color === accentStrong,
            privacyLinkVisible: Boolean(privacyLinkRect)
                && privacyLinkRect.width > 0
                && privacyLinkRect.height > 0
                && getComputedStyle(privacyLink).opacity === '1',
            smallestSupportingTextPx: Math.min(...readableText.map((element) => parseFloat(getComputedStyle(element).fontSize))),
            primaryRestMatchesNeutral: primaryStyle.backgroundImage === 'none'
                && primaryStyle.backgroundColor === neutralStyle.backgroundColor
                && primaryStyle.borderTopColor === neutralStyle.borderTopColor
                && primaryStyle.color === neutralStyle.color,
            exportUsesSemanticColor: Boolean(exportIcon)
                && exportStyle.color === getComputedStyle(exportIcon).color
                && exportStyle.color !== neutralStyle.color
                && exportStyle.borderTopColor !== neutralStyle.borderTopColor,
            neutralAvoidsAccentTreatment: neutralStyle.color !== accent && neutralStyle.borderTopColor !== accent,
            cardsInsideWorkspace: cards.every((card) => {
                const rect = card.getBoundingClientRect();
                return rect.left >= workspaceRect.left - 1 && rect.right <= workspaceRect.right + 1;
            }),
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth
        };
    });

    await page.setViewportSize({ width: 1700, height: 1100 });
    await page.goto(`${baseUrl}/settings`, { waitUntil: 'load' });
    let layout = await readDiagnosticsLayout();
    assert.equal(layout.coreCards, 6);
    assert.equal(layout.additionalSectionVisible, false);
    assert.equal(layout.secondaryHealthCardsVisible, false);
    assert.equal(layout.technicalDetailsCount, 0);
    assert.equal(layout.coreColumns, 6);
    assert.equal(layout.hasHealthySummary, true);
    assert.equal(layout.hasClearFindings, true);
    assert.equal(layout.metricSvgIcons, 3);
    assert.equal(layout.metricIconWidths.every((width) => width >= 41), true);
    assert.equal(layout.metricIconColors.some((color) => color === 'rgb(0, 0, 0)'), false);
    assert.equal(layout.metricTitleSizes.every((size) => size >= 20.7), true);
    assert.equal(layout.metricIconsAreTopLeft, true);
    assert.equal(layout.metricCopyIsHorizontallyCentered, true);
    assert.equal(layout.metricCopyIsVerticallyCentered, true);
    assert.equal(layout.metricTextIsCentered, true);
    assert.equal(layout.systemSvgIcons, 6);
    assert.equal(layout.systemIconWidths.every((width) => width >= 32), true);
    assert.equal(layout.systemIconColors.some((color) => color === 'rgb(0, 0, 0)'), false);
    assert.ok(
        Math.max(...layout.systemFooterBottomInsets) - Math.min(...layout.systemFooterBottomInsets) <= 1,
        'System health timestamps should share one bottom inset'
    );
    assert.ok(
        Math.max(...layout.systemFooterLeftInsets) - Math.min(...layout.systemFooterLeftInsets) <= 1,
        'System health timestamps should share one left inset'
    );
    assert.match(layout.themeFooterLabel, /^Checked\s/);
    assert.doesNotMatch(layout.themeFooterLabel, /^Theme checked\s/);
    assert.equal(layout.storageUpdateIconColors.length, 2);
    assert.equal(layout.storageUpdateIconColors.every((color) => color !== 'rgb(0, 0, 0)' && color !== layout.accentColor), true);
    assert.equal(layout.supportHeaderIconColors.length, 2);
    assert.equal(layout.supportHeaderIconColors.every((color) => color !== 'rgb(0, 0, 0)' && color !== layout.accentColor), true);
    assert.equal(new Set(layout.supportHeaderIconColors).size, 2);
    assert.equal(layout.toolbarButtonCount, 3);
    assert.equal(layout.toolbarButtonLabels.some((label) => label === 'Copy issue report'), false);
    assert.equal(layout.toolbarButtonHeights.every((height) => height >= 35 && height <= 37), true);
    assert.ok(
        Math.max(...layout.toolbarButtonHeights) - Math.min(...layout.toolbarButtonHeights) <= 1,
        'diagnostics toolbar buttons should share one compact height'
    );
    assert.equal(layout.metricsGridVerticallyCentered, true);
    assert.ok(layout.coreProgressRatio > 0.98, 'healthy core progress bar should span the metric');
    assert.ok(
        layout.coreProgressTrackRatio >= 0.49 && layout.coreProgressTrackRatio <= 0.51,
        'core progress track should use half of the metric width'
    );
    assert.equal(layout.supportSvgIcons, 7);
    assert.equal(layout.supportIconWidths.every((width) => width >= 28), true);
    assert.equal(new Set(layout.supportIconColors).size, 7);
    assert.equal(new Set(layout.supportIconBackgrounds).size, 7);
    assert.equal(layout.supportIconsAreLeft, true);
    assert.equal(layout.supportCardContentStartsAtTop, true);
    assert.equal(layout.supportBadgesCenteredAndLower, true);
    assert.equal(layout.supportCardsReachOverviewBottom, true);
    assert.equal(layout.supportCardsShareHeight, true);
    assert.equal(layout.supportCardHeights.every((height) => height >= 70), true);
    assert.match(layout.supportOverviewDescription, /diagnostic data prepared for support/);
    assert.match(layout.supportOverviewDescription, /sanitized privacy profile before download/);
    assert.deepEqual(layout.supportOverviewMeta, [
        'Bundle schema: v2',
        'Section coverage: 7 of 7 included',
        'Preview generated: 2026-07-24T22:05:24Z'
    ]);
    assert.equal(layout.privacyBadgeCount, 4);
    assert.equal(layout.privacyBadgesAreColored, true);
    assert.equal(layout.privacyBadgeRadii.every((radius) => radius >= 5.9 && radius <= 6.1), true);
    assert.equal(layout.privacyContentLeftAligned, true);
    assert.equal(layout.privacyContentVerticallyCentered, true);
    assert.equal(layout.privacyBadgesMatchStatusHeight, true);
    assert.equal(layout.privacyBadgesCentered, true);
    assert.equal(layout.privacyOmittedBorderVisible, true);
    assert.ok(layout.privacyCardHeight < 60, 'privacy row should remain compact');
    assert.equal(layout.privacyLinkUsesAccent, true);
    assert.equal(layout.privacyLinkVisible, true);
    assert.ok(layout.smallestSupportingTextPx >= 17, 'supporting diagnostics text must remain readable');
    assert.equal(layout.primaryRestMatchesNeutral, true);
    assert.equal(layout.exportUsesSemanticColor, true);
    assert.equal(layout.neutralAvoidsAccentTreatment, true);
    assert.equal(layout.cardsInsideWorkspace, true);
    assert.ok(layout.scrollWidth <= layout.clientWidth + 1, 'desktop diagnostics must not overflow');

    const collapsedPrivacyDisclosure = await page.locator('.fv-support-bundle-privacy-disclosure').boundingBox();
    const collapsedPrivacyCard = await page.locator('.fv-support-bundle-redaction-card').boundingBox();
    await page.locator('.fv-support-bundle-privacy-header').click();
    const expandedPrivacy = await page.evaluate(() => {
        const details = document.querySelector('.fv-support-bundle-privacy-details');
        const card = document.querySelector('.fv-support-bundle-redaction-card');
        const disclosure = document.querySelector('.fv-support-bundle-privacy-disclosure');
        const arrow = disclosure?.querySelector('i');
        const explanation = document.querySelector('.fv-support-bundle-privacy-explanation');
        const definitionCards = [...(explanation?.querySelectorAll('dl > div') || [])];
        const longestDescription = definitionCards[0]?.querySelector('dd');
        if (longestDescription) {
            longestDescription.append(` ${'Additional verified privacy-handling context. '.repeat(6)}`);
        }
        const cardRect = card?.getBoundingClientRect();
        const disclosureRect = disclosure?.getBoundingClientRect();
        return {
            open: details?.open === true,
            cardRect: cardRect ? {
                left: cardRect.left,
                top: cardRect.top,
                right: cardRect.right,
                bottom: cardRect.bottom
            } : null,
            disclosureRect: disclosureRect ? {
                left: disclosureRect.left,
                top: disclosureRect.top,
                width: disclosureRect.width,
                height: disclosureRect.height
            } : null,
            arrowTransform: arrow ? getComputedStyle(arrow).transform : 'none',
            definitionCount: explanation?.querySelectorAll('dt').length || 0,
            descriptionCount: explanation?.querySelectorAll('dd').length || 0,
            definitionCardHeights: definitionCards.map((definition) => definition.getBoundingClientRect().height),
            definitionCardWidths: definitionCards.map((definition) => definition.getBoundingClientRect().width),
            definitionTitlesLeftAligned: definitionCards.every((definition) => {
                const title = definition.querySelector('dt');
                const definitionRect = definition.getBoundingClientRect();
                const titleRect = title?.getBoundingClientRect();
                return title
                    && titleRect
                    && getComputedStyle(title).textAlign === 'left'
                    && titleRect.left > definitionRect.left
                    && titleRect.left - definitionRect.left <= 14;
            }),
            text: explanation?.textContent || ''
        };
    });
    assert.equal(expandedPrivacy.open, true);
    assert.ok(collapsedPrivacyDisclosure && collapsedPrivacyCard && expandedPrivacy.disclosureRect && expandedPrivacy.cardRect);
    assert.ok(
        Math.abs(
            (collapsedPrivacyCard.x + collapsedPrivacyCard.width)
            - (collapsedPrivacyDisclosure.x + collapsedPrivacyDisclosure.width)
            - (expandedPrivacy.cardRect.right - (expandedPrivacy.disclosureRect.left + expandedPrivacy.disclosureRect.width))
        ) <= 1
            && Math.abs(
                (collapsedPrivacyDisclosure.y - collapsedPrivacyCard.y)
                - (expandedPrivacy.disclosureRect.top - expandedPrivacy.cardRect.top)
            ) <= 1,
        'privacy disclosure should remain anchored when expanded'
    );
    assert.notEqual(expandedPrivacy.arrowTransform, 'none', 'expanded privacy arrow should point down');
    assert.equal(expandedPrivacy.definitionCount, 4);
    assert.equal(expandedPrivacy.descriptionCount, 4);
    assert.equal(expandedPrivacy.definitionTitlesLeftAligned, true);
    assert.ok(
        Math.max(...expandedPrivacy.definitionCardHeights) - Math.min(...expandedPrivacy.definitionCardHeights) <= 1,
        'privacy definition cards should have equal heights'
    );
    assert.ok(
        Math.max(...expandedPrivacy.definitionCardWidths) - Math.min(...expandedPrivacy.definitionCardWidths) <= 1,
        'privacy definition cards should have equal widths'
    );
    assert.match(expandedPrivacy.text, /One-way identifiers link matching values/);
    assert.match(expandedPrivacy.text, /Partial context remains/);
    assert.match(expandedPrivacy.text, /Unneeded diagnostic fields are removed/);
    assert.match(expandedPrivacy.text, /Long values or lists are shortened and marked incomplete/);
    assert.match(expandedPrivacy.text, /fresh salt changes identifiers between bundles/);
    await page.locator('.fv-support-bundle-privacy-header').click();

    await page.locator('.fv-diagnostics-toolbar .fv-ui-button.is-primary').hover();
    await page.waitForTimeout(250);
    const healthHoverUsesAccent = await page.evaluate(() => {
        const workspace = document.getElementById('fv-diagnostics-workspace');
        const button = workspace.querySelector('.fv-diagnostics-toolbar .fv-ui-button.is-primary');
        const neutral = workspace.querySelector('.fv-diagnostics-toolbar .fv-ui-button:not(.is-primary):not(.is-export)');
        const accentProbe = document.createElement('span');
        accentProbe.style.color = 'var(--fvplus-settings-accent-strong)';
        workspace.append(accentProbe);
        const accentStrong = getComputedStyle(accentProbe).color;
        accentProbe.remove();
        return getComputedStyle(button).color === accentStrong
            && getComputedStyle(button).borderTopColor !== getComputedStyle(neutral).borderTopColor;
    });
    assert.equal(healthHoverUsesAccent, true);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(250);

    await page.evaluate(() => document.body.setAttribute('data-fvplus-host-theme', 'white'));
    await page.waitForTimeout(250);
    layout = await readDiagnosticsLayout();
    assert.equal(layout.metricIconColors.some((color) => color === 'rgb(0, 0, 0)'), false);
    assert.equal(layout.systemIconColors.some((color) => color === 'rgb(0, 0, 0)'), false);
    assert.equal(layout.storageUpdateIconColors.some((color) => color === 'rgb(0, 0, 0)'), false);
    assert.equal(layout.supportHeaderIconColors.some((color) => color === 'rgb(0, 0, 0)'), false);
    assert.equal(layout.supportIconColors.some((color) => color === 'rgb(0, 0, 0)'), false);
    assert.equal(new Set(layout.supportIconColors).size, 7);
    assert.equal(new Set(layout.supportIconBackgrounds).size, 7);
    assert.equal(layout.privacyBadgesAreColored, true);
    assert.equal(layout.privacyLinkUsesAccent, true);
    assert.equal(layout.privacyLinkVisible, true);
    assert.equal(layout.primaryRestMatchesNeutral, true);
    assert.equal(layout.exportUsesSemanticColor, true);
    assert.equal(layout.neutralAvoidsAccentTreatment, true);

    await page.setViewportSize({ width: 1000, height: 1100 });
    layout = await readDiagnosticsLayout();
    assert.equal(layout.coreColumns, 3);
    assert.equal(layout.additionalSectionVisible, false);
    assert.equal(layout.metricIconsAreTopLeft, true);
    assert.equal(layout.metricCopyIsHorizontallyCentered, true);
    assert.equal(layout.metricCopyIsVerticallyCentered, true);
    assert.equal(layout.metricTextIsCentered, true);
    assert.ok(Math.max(...layout.systemFooterBottomInsets) - Math.min(...layout.systemFooterBottomInsets) <= 1);
    assert.ok(Math.max(...layout.systemFooterLeftInsets) - Math.min(...layout.systemFooterLeftInsets) <= 1);
    assert.equal(layout.cardsInsideWorkspace, true);
    assert.ok(layout.scrollWidth <= layout.clientWidth + 1, 'tablet diagnostics must not overflow');

    await page.setViewportSize({ width: 700, height: 1000 });
    layout = await readDiagnosticsLayout();
    assert.equal(layout.coreColumns, 1);
    assert.equal(layout.additionalSectionVisible, false);
    assert.ok(Math.max(...layout.systemFooterBottomInsets) - Math.min(...layout.systemFooterBottomInsets) <= 1);
    assert.ok(Math.max(...layout.systemFooterLeftInsets) - Math.min(...layout.systemFooterLeftInsets) <= 1);
    assert.equal(layout.cardsInsideWorkspace, true);
    assert.ok(layout.scrollWidth <= layout.clientWidth + 1, 'mobile diagnostics must not overflow');
});

test('Mobile reorder persists click state and isolates Docker and VM controls', async ({ page }) => {
    await page.setViewportSize({ width: 1700, height: 900 });
    await page.goto(`${baseUrl}/settings`, { waitUntil: 'load' });
    await page.evaluate(() => window.fixtureSettings.viewSettingsReady);
    assert.equal(await page.locator('#docker-tree-reorder-toggle').isHidden(), true, 'mobile-only control should be hidden on desktop');

    await page.evaluate(() => {
        const root = document.getElementById('fv-settings-root');
        root.classList.add('fv-mobile-compact');
        document.body.classList.add('fv-mobile-compact');
        root.insertAdjacentHTML('beforeend', `
            <button id="vm-tree-reorder-toggle" type="button" data-fv-onclick="toggleMobileTreeReorderMode('vm')" aria-pressed="false">Mobile reorder</button>
            <div class="folder-table"><table><tbody id="docker"><tr><td class="order-cell"><span class="row-order-actions"><button type="button">Docker move</button></span></td><td>Docker</td><td class="actions-cell">Actions</td></tr></tbody></table></div>
            <div class="folder-table"><table><tbody id="vms"><tr><td class="order-cell"><span class="row-order-actions"><button type="button">VM move</button></span></td><td>VM</td><td class="actions-cell">Actions</td></tr></tbody></table></div>
        `);
        const state = { docker: false, vm: false };
        const calls = { persists: 0, renders: [] };
        const api = window.FolderViewPlusMobileReorder.createApi({
            document,
            readMode: (type) => state[type] === true,
            writeMode: (type, enabled) => { state[type] = enabled === true; },
            persist: () => { calls.persists += 1; },
            render: (type) => calls.renders.push(type)
        });
        window.__mobileReorderFixture = { state, calls, api };
        window.toggleMobileTreeReorderMode = (type) => api.toggle(type);
        api.refresh();
    });

    const readState = async () => page.evaluate(() => {
        const display = (selector) => getComputedStyle(document.querySelector(selector)).display;
        return {
            state: { ...window.__mobileReorderFixture.state },
            calls: {
                persists: window.__mobileReorderFixture.calls.persists,
                renders: [...window.__mobileReorderFixture.calls.renders]
            },
            dockerPressed: document.getElementById('docker-tree-reorder-toggle').getAttribute('aria-pressed'),
            vmPressed: document.getElementById('vm-tree-reorder-toggle').getAttribute('aria-pressed'),
            dockerCell: display('tbody#docker td.order-cell'),
            vmCell: display('tbody#vms td.order-cell')
        };
    });

    await page.locator('#docker-tree-reorder-toggle').click();
    let state = await readState();
    assert.deepEqual(state.state, { docker: true, vm: false });
    assert.equal(state.dockerPressed, 'true');
    assert.equal(state.vmPressed, 'false');
    assert.equal(state.dockerCell, 'table-cell');
    assert.equal(state.vmCell, 'none');
    assert.deepEqual(state.calls, { persists: 1, renders: ['docker'] });

    await page.locator('#vm-tree-reorder-toggle').click();
    await page.locator('#docker-tree-reorder-toggle').click();
    state = await readState();
    assert.deepEqual(state.state, { docker: false, vm: true });
    assert.equal(state.dockerCell, 'none');
    assert.equal(state.vmCell, 'table-cell');
    assert.deepEqual(state.calls, { persists: 3, renders: ['docker', 'vm', 'docker'] });
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
                    if (accessibilityEnabled) {
                        await page.addScriptTag({ path: axeScriptPath });
                        const violations = await page.evaluate(async () => {
                            const result = await window.axe.run(document, {
                                runOnly: {
                                    type: 'tag',
                                    values: ['wcag2a', 'wcag2aa', 'wcag21aa']
                                },
                                resultTypes: ['violations']
                            });
                            return result.violations
                                .filter((violation) => ['critical', 'serious'].includes(String(violation.impact || '')))
                                .map((violation) => ({
                                    id: violation.id,
                                    impact: violation.impact,
                                    help: violation.help,
                                    nodes: violation.nodes.slice(0, 5).map((node) => ({
                                        target: node.target,
                                        summary: node.failureSummary,
                                        html: node.html
                                    }))
                                }));
                        });
                        assert.deepEqual(violations, [], `axe accessibility violations:\n${JSON.stringify(violations, null, 2)}`);
                    }
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
