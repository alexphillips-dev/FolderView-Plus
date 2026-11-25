import assert from 'node:assert/strict';
import { closeFilterViewHost as closeHost, createFilterViewSettingsHost, mountFilterViewVmHost } from '../helpers/filter-view-settings-host.mjs';
import { createDockerBadgeHost } from '../helpers/folder-badges-host.mjs';
import { registerVmRuntimeRecoveryCases } from './vm-runtime-recovery.mjs';

const waitFor = async (page, predicate, message) => {
    for (let i = 0; i < 150; i++) {
        if (await predicate()) return;
        await page.waitForTimeout(40);
    }
    assert.fail(message);
};
const openSettings = async (page, host) => {
    await page.goto(host.url, { waitUntil: 'load' });
    await page.waitForFunction(() => document.getElementById('fv-settings-root') && !document.getElementById('fv-settings-root').classList.contains('fv-settings-bootstrap-pending'));
    await page.evaluate(async () => {
        await window.FolderViewPlusSettingsRuntimeHydrationPromise;
        for (const type of ['docker', 'vm']) document.getElementById(type + '-view-settings').open = true;
    });
};
const publishFromSettingsPeer = async (page, url, type, prefs) => {
    const peer = await page.context().newPage();
    try {
        await peer.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Preference peer</title>' }));
        await peer.goto(new URL('/audit-settings-peer', url).href);
        await peer.evaluate(({ type, prefs }) => {
            window.fixtureChannel = new BroadcastChannel('fvplus-prefs-sync-v1');
            window.fixtureChannel.postMessage({ sourceId: 'fixture-settings-peer', action: 'committed', type, prefs });
        }, { type, prefs });
        await page.waitForFunction(({ type, revision }) => window.FolderViewPlusPrefsStore.getDefaultCoordinator().getOptimisticPrefs(type)._metadata.prefsRevision === revision,
            { type, revision: prefs._metadata.prefsRevision });
    } finally { await peer.close(); }
};

export const registerFilterViewSettingsFixes = ({ test }) => {
    registerVmRuntimeRecoveryCases({ test });

    test('Docker start order restores a rejected mode and reports failed native sync after a saved plan', async ({ page }) => {
        const host = await createFilterViewSettingsHost(page);
        const [first, second] = host.names;
        const enabled = new Set([first, second]);
        const writes = [];
        const prefs = host.prefs('docker');
        let loseToggleResponse = true;
        const preview = () => ({
            mode: prefs.dockerStartOrder.mode, managed: prefs.dockerStartOrder.mode !== 'unmanaged',
            sequence: [...enabled].map(name => ({ name, wait: name === first ? 7 : 19 })),
            autostartOrder: [...enabled],
            autostartCount: enabled.size, containerCount: host.names.length
        });
        for (const name of enabled) host.runtime.docker[name].autostart = true;
        await page.route('**/plugins/dynamix.docker.manager/images/question.png', route => route.fulfill({ status: 204 }));
        await page.route('**/server/templates.php**', route => route.fulfill({ json: { ok: true, templates: [] } }));
        await page.route('**/server/docker_start_order.php**', route => {
            if (route.request().method() === 'GET') return route.fulfill({ json: { ok: true, preview: preview() } });
            const post = Object.fromEntries(new URLSearchParams(route.request().postData() || ''));
            if (post.action === 'autostart') {
                writes.push({ name: post.container, enabled: post.enabled });
                if (post.enabled === '1') enabled.add(post.container);
                else enabled.delete(post.container);
                if (loseToggleResponse) {
                    loseToggleResponse = false;
                    return route.fulfill({ status: 400, json: { ok: false, error: 'Fixture lost toggle response' } });
                }
                return route.fulfill({ json: { ok: true, enabled: post.enabled === '1' } });
            }
            return route.fulfill({ json: { ok: true, syncOutcome: 'synced', preview: preview() } });
        });
        await page.route('**/server/prefs.php**', route => {
            if (route.request().method() !== 'POST') return route.fallback();
            const post = new URLSearchParams(route.request().postData() || '');
            const mode = JSON.parse(post.get('prefs') || '{}').dockerStartOrder?.mode;
            if (mode === 'unmanaged') return route.fulfill({ status: 400, json: { ok: false, error: 'Fixture rejected mode' } });
            if (mode !== 'custom-batches') return route.fallback();
            prefs.dockerStartOrder.mode = mode;
            prefs._metadata.prefsRevision++;
            return route.fulfill({ json: { ok: true, prefs, metadata: prefs._metadata, dockerOrderSync: 'failed' } });
        });
        try {
            await openSettings(page, host);
            await page.locator('[data-mode="advanced"]').click();
            await page.locator('[data-fv-advanced-tab="startup"]').click();
            const mode = page.locator('#docker-start-order-mode');
            const rows = page.locator('.fv-docker-start-order-sequence > li');
            await waitFor(page, async () => await rows.count() === 2, 'stored mode preview loads');
            await mode.selectOption('unmanaged');
            await waitFor(page, async () => await mode.inputValue() === 'docker-page', 'rejected mode reverts to the stored mode');
            const dismiss = page.getByRole('button', { name: 'OK', exact: true });
            if (await dismiss.isVisible()) await dismiss.click();
            const previewRequest = page.waitForResponse(response => response.request().method() === 'GET' && response.url().includes('docker_start_order.php?action=preview'));
            await page.locator('[data-fv-onclick="refreshDockerStartOrderPreview()"]').dispatchEvent('click');
            await previewRequest;
            await waitFor(page, async () => await rows.count() === 2, 'manual preview loads after a rejected mode');
            await rows.filter({ hasText: first }).locator('input[type="checkbox"]').evaluate(input => {
                input.checked = false;
                input.dispatchEvent(new Event('change', { bubbles: true }));
            });
            await waitFor(page, async () => await rows.count() === 1, 'a single managed toggle removes its row');
            assert.deepEqual(writes, [{ name: first, enabled: '0' }]);
            assert.equal(await rows.first().locator('input[type="number"]').inputValue(), '19');
            const disabled = page.locator('.fv-docker-start-order-disabled');
            assert.match(await disabled.locator('button').textContent(), new RegExp(first));
            if (await dismiss.isVisible()) await dismiss.click();
            await disabled.locator('button').dispatchEvent('click');
            await waitFor(page, async () => await rows.count() === 2, 'the lost response leaves the correct re-enable control');
            assert.deepEqual(writes, [{ name: first, enabled: '0' }, { name: first, enabled: '1' }]);
            await mode.selectOption('custom-batches');
            const syncStatus = page.locator('#docker-start-order-sync-status');
            await syncStatus.waitFor({ state: 'visible' });
            assert.match(await syncStatus.innerText(), /sync failed/i);
            assert.equal(await mode.inputValue(), 'custom-batches');
            await page.locator('[data-fv-onclick="syncDockerStartOrderNow()"]').dispatchEvent('click');
            await syncStatus.waitFor({ state: 'hidden' });
        } finally { await closeHost(page, host); }
    }, { skipAccessibility: true, allowedConsoleErrors: [/Failed to load resource:.*400/] });

    test('Filters and view settings save Docker row placement after a cached page restore and reload', async ({ page }) => {
        const host = await createFilterViewSettingsHost(page);
        const placement = page.locator('#docker-view-settings #docker-row-placement');
        const nativeWrites = [];
        page.on('request', request => {
            if (request.method() === 'POST' && /(?:sync_order|reorder|docker_start_order|autostart)\.php(?:\?|$)/i.test(request.url())) {
                nativeWrites.push(request.url());
            }
        });
        try {
            await openSettings(page, host);
            assert.equal(await placement.inputValue(), 'folders-first');
            assert.equal(await placement.isVisible(), true);
            assert.equal(await page.locator('#vm-view-settings [id$="-row-placement"]').count(), 0);
            await page.evaluate(() => {
                window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
                window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
            });
            for (const value of ['saved-order', 'folders-first']) {
                const sent = page.waitForRequest(request => request.url().includes('/server/prefs.php') && request.method() === 'POST');
                await placement.selectOption(value);
                const payload = new URLSearchParams((await sent).postData());
                assert.equal(payload.get('type'), 'docker');
                assert.deepEqual(JSON.parse(payload.get('prefs')), { dockerRowPlacement: value });
                await waitFor(page, () => host.prefs('docker').dockerRowPlacement === value, 'Docker row placement persisted');
                await openSettings(page, host);
                assert.equal(await placement.inputValue(), value);
            }
            assert.equal(host.prefs('vm')._metadata.prefsRevision, 1);
            assert.deepEqual(nativeWrites, []);
        } finally { await closeHost(page, host); }
    }, { skipAccessibility: true });

    test('Filters and view settings persist unassigned grouping independently for Docker and VMs', async ({ page }) => {
        const host = await createFilterViewSettingsHost(page);
        const toggle = type => page.locator(`#${type}-group-unassigned-items`);
        const save = async (type, enabled) => {
            const sent = page.waitForRequest(request => request.url().includes('/server/prefs.php') && request.method() === 'POST');
            await toggle(type).setChecked(enabled);
            const payload = new URLSearchParams((await sent).postData());
            assert.equal(payload.get('type'), type);
            assert.deepEqual(JSON.parse(payload.get('prefs')), { groupUnassignedItems: enabled });
            await waitFor(page, () => host.prefs(type).groupUnassignedItems === enabled, 'grouping toggle persisted');
        };
        try {
            await openSettings(page, host);
            for (const type of ['docker', 'vm']) {
                assert.equal(await toggle(type).isChecked(), false);
                assert.equal(await page.locator(`#${type}-view-settings .fv-settings-card-layout label:has(#${type}-hide-empty-folders) + label #${type}-group-unassigned-items`).count(), 1);
            }
            await save('docker', true);
            assert.equal(host.prefs('vm').groupUnassignedItems, false);
            await openSettings(page, host);
            assert.equal(await toggle('docker').isChecked(), true);
            assert.equal(await toggle('vm').isChecked(), false);
            await save('vm', true);
            await save('docker', false);
            await openSettings(page, host);
            assert.equal(await toggle('docker').isChecked(), false);
            assert.equal(await toggle('vm').isChecked(), true);
        } finally { await closeHost(page, host); }
    }, { skipAccessibility: true });

    test('Filters and view settings clear defaults, replace smaller profiles and announce exact no-op counts', async ({ page }) => {
        const host = await createFilterViewSettingsHost(page);
        host.folders['fixture-folder-0'].settings = { preview: 4, preview_rows: 3 };
        host.folders.empty.settings = { preview: 1 };
        let applied = false;
        const requests = [];
        await page.route('**/server/apply_folder_settings.php', route => {
            const payload = new URLSearchParams(route.request().postData());
            requests.push([payload.get('preview'), payload.get('expectedRevision')]);
            const metadata = host.prefs('docker')._metadata;
            const result = applied
                ? { updatedCount: 0, unchangedCount: 2, skippedIds: ['fixture-folder-0', 'empty'] }
                : { updatedCount: 1, unchangedCount: 1, skippedIds: ['empty'] };
            if (!payload.has('preview') && !applied) {
                applied = true;
                metadata.folderRevision++;
            }
            return route.fulfill({ json: { ok: true, result: { ...result, folderRevision: metadata.folderRevision } } });
        });
        try {
            for (const type of ['docker', 'vm']) {
                await openSettings(page, host);
                await page.locator('#' + type + '-folder-defaults-source').selectOption('fixture-folder-0');
                await page.locator('.fv-folder-defaults-save[data-fv-onclick*="' + type + '"]').click();
                await waitFor(page, () => host.prefs(type).folderDefaults.profile.settings.preview_rows === 3, 'full default profile saved');
                await page.locator('#' + type + '-folder-defaults-source').selectOption('empty');
                await page.locator('.fv-folder-defaults-save[data-fv-onclick*="' + type + '"]').click();
                await waitFor(page, () => host.prefs(type).folderDefaults.sourceId === 'empty', 'replacement default profile saved');
                assert.equal(host.prefs(type).folderDefaults.profile.settings.preview_rows, undefined);
                if (type === 'docker') {
                    await page.evaluate(() => {
                        window.fixtureAnnouncements = [];
                        window.FolderViewPlusUI = { ...window.FolderViewPlusUI, announce: payload => window.fixtureAnnouncements.push(payload) };
                    });
                    for (const expected of ['Updated: 1. Unchanged: 1. Skipped: 0.', 'Updated: 0. Unchanged: 2. Skipped: 0.']) {
                        const count = await page.evaluate(() => window.fixtureAnnouncements.length);
                        await page.locator('.fv-folder-defaults-apply[data-fv-onclick*="docker"]').click();
                        await page.waitForFunction(count => window.fixtureAnnouncements.length > count, count);
                        assert.ok((await page.evaluate(() => window.fixtureAnnouncements.at(-1).message)).includes(expected));
                    }
                    assert.deepEqual(requests, [['1', '1'], [null, '1'], ['1', '2']]);
                }
                await page.locator('#' + type + '-view-settings').evaluate(node => { node.open = true; });
                await page.locator('.fv-folder-defaults-clear[data-fv-onclick*="' + type + '"]').click();
                await waitFor(page, () => Object.keys(host.prefs(type).folderDefaults.profile.settings).length === 0, 'Clear removes all saved settings');
                await openSettings(page, host);
                assert.match(await page.locator('#' + type + '-folder-defaults-summary').innerText(), /No .* folder defaults saved/);
            }
        } finally { await closeHost(page, host); }
    }, { skipAccessibility: true });

    test('Filters and view settings preserve graph None, zero scoring and visible normalized thresholds', async ({ page }) => {
        const host = await createFilterViewSettingsHost(page);
        try {
            await openSettings(page, host);
            await page.locator('#docker-dashboard-preview-context').selectOption('advanced');
            await page.locator('#docker-dashboard-preview-graph').selectOption('0');
            await waitFor(page, () => host.prefs('docker').dashboard.previewGraph === 0, 'None persisted');
            await page.waitForLoadState('networkidle');
            assert.equal(await page.locator('#docker-dashboard-preview-graph').inputValue(), '0');
            const warn = page.locator('#docker-health-warn-threshold'), critical = page.locator('#docker-health-critical-threshold');
            await warn.fill('0'); await warn.press('Tab');
            await waitFor(page, () => host.prefs('docker').health.warnStoppedPercent === 0, 'zero warning persisted');
            await page.waitForLoadState('networkidle');
            await page.waitForFunction(() => document.querySelector('tbody#docker tr[data-folder-id="fixture-folder-0"] .health-chip.is-warning'));
            assert.equal(await page.evaluate(() => window.FolderViewPlusFolderEditor.buildFolderQuickActionSummary('docker', 'fixture-folder-0').health), 'Degraded');
            await warn.fill('60');
            await page.evaluate(() => renderHealthControls('docker'));
            assert.equal(await warn.inputValue(), '60', 'background reconciliation preserves an active numeric draft');
            await warn.press('Tab');
            await waitFor(page, () => host.prefs('docker').health.warnStoppedPercent === 60, 'warning threshold restored');
            await page.waitForLoadState('networkidle');
            await critical.fill('20'); await critical.press('Tab');
            await waitFor(page, () => host.prefs('docker').health.criticalStoppedPercent === 65, 'critical threshold normalized to scoring policy');
            await openSettings(page, host);
            assert.equal(await page.locator('#docker-dashboard-preview-graph').inputValue(), '0');
            assert.equal(await critical.inputValue(), '65');
            const policy = await page.evaluate(() => resolveFolderHealthPolicy({ settings: {} }));
            assert.equal(policy.warnThreshold, 60); assert.equal(policy.criticalThreshold, 65);
            const override = await page.evaluate(() => resolveFolderHealthPolicy({ settings: {
                health_warn_stopped_percent: 0, health_critical_stopped_percent: 20, health_updates_mode: 'ignore', health_all_stopped_mode: 'warn'
            } }));
            assert.equal(override.warnThreshold, 0); assert.equal(override.criticalThreshold, 20);
            assert.equal(override.updatesMode, 'ignore'); assert.equal(override.allStoppedMode, 'warn');
        } finally { await closeHost(page, host); }
    }, { skipAccessibility: true });

    test('Filters and view settings retain Docker and VM numeric drafts across table reconciliation', async ({ page }) => {
        const host = await createFilterViewSettingsHost(page);
        try {
            await openSettings(page, host);
            for (const type of ['docker', 'vm']) {
                await page.locator(`#${type}-live-refresh-enabled`).check();
                await page.waitForLoadState('networkidle');
                await page.locator(`#${type}-lazy-preview-enabled`).check();
                await page.waitForLoadState('networkidle');
                const fields = [
                    ['live-refresh-seconds', '45', prefs => prefs.liveRefreshSeconds],
                    ['lazy-preview-threshold', '40', prefs => prefs.lazyPreviewThreshold],
                    ['status-warn-threshold', '55', prefs => prefs.status.warnStoppedPercent]
                ];
                if (type === 'vm') fields.push(['resource-warn-vcpu', '8', prefs => prefs.health.vmResourceWarnVcpus], ['resource-warn-gib', '12', prefs => prefs.health.vmResourceWarnGiB]);
                for (const [suffix, value, read] of fields) {
                    const field = page.locator(`#${type}-${suffix}`);
                    await field.fill(value);
                    await page.evaluate(type => { renderRuntimeControls(type); renderStatusControls(type); renderHealthControls(type); }, type);
                    assert.equal(await field.inputValue(), value, `${type} ${suffix} draft retained`);
                    await field.press('Tab');
                    await waitFor(page, () => String(read(host.prefs(type))) === value, `${type} ${suffix} persisted`);
                    await page.waitForLoadState('networkidle');
                }
            }
        } finally { await closeHost(page, host); }
    }, { skipAccessibility: true });

    test('Filters and view settings warning helper text meets contrast in light and dark on desktop and phone', async ({ page }) => {
        const host = await createFilterViewSettingsHost(page);
        try {
            await openSettings(page, host);
            await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
            const violations = await page.evaluate(async () => (await window.axe.run({ include: [
                '#docker-status-warn-threshold-row', '#vm-status-warn-threshold-row'
            ] }, { runOnly: ['color-contrast'] })).violations);
            assert.deepEqual(violations, []);
        } finally { await closeHost(page, host); }
    }, { skipAccessibility: true });

    test('Docker view preferences reconcile badges, updates, empty folders and page modes without reload', async ({ page }) => {
        const host = await createDockerBadgeHost(page, { running: true, stopped: true, updates: true });
        try {
            host.prefs().expandedFolderState = { parent: false };
            await page.goto(host.url, { waitUntil: 'load' });
            await page.waitForFunction(() => document.querySelector('tr.folder-id-direct'));
            const foldersBefore = JSON.stringify(host.folders);
            // Coordinator broadcasts are the same entry point used by Settings and other tabs.
            const save = patch => page.evaluate(patch => window.FolderViewPlusPrefsStore.getDefaultCoordinator().save('docker', patch, { immediate: true }), patch);
            await save({ badges: { running: false, stopped: false, updates: false } });
            await page.waitForFunction(() => {
                const row = document.querySelector('tr.folder-id-parent');
                return row && !row.querySelector('td.updatecolumn') && getComputedStyle(row.querySelector('.folder-load-status')).display === 'none';
            });
            await save({ badges: { running: true, stopped: true, updates: true }, hideEmptyFolders: false });
            await page.waitForFunction(() => document.querySelector('tr.folder-id-empty') && document.querySelector('tr.folder-id-parent > td.updatecolumn'));
            await page.waitForFunction(() => window.fixtureDockerBadges.refreshSettled());
            await page.locator('.dropDown-parent').click();
            await page.locator('tr.folder-id-branch').waitFor({ state: 'visible' });
            // The badge test starts from committed expansion before testing unrelated preference changes.
            await save({ expandedFolderState: { parent: true } });
            assert.equal(host.prefs().expandedFolderState?.parent, true);
            for (const entry of Object.values(host.runtime)) {
                entry.running = false; entry.state = 'stopped'; entry.State.Running = false; entry.info.State.Running = false;
            }
            await page.evaluate(() => window.fixtureDockerBadges.state('stopped'));
            await save({ badges: { running: true, stopped: false, updates: false } });
            await page.waitForFunction(() => {
                const icon = document.querySelector('tr.folder-id-direct .folder-load-status');
                return icon?.classList.contains('stopped') && getComputedStyle(icon).display === 'none';
            });
            await save({ badges: { running: true, stopped: true, updates: false } });
            await page.waitForFunction(() => {
                const icon = document.querySelector('tr.folder-id-direct .folder-load-status');
                return icon?.classList.contains('stopped') && getComputedStyle(icon).display !== 'none';
            });
            await save({ badges: { running: false, stopped: false, updates: false } });
            await page.waitForFunction(() => {
                const row = document.querySelector('tr.folder-id-parent');
                return row && !row.querySelector('td.updatecolumn');
            });
            await page.waitForFunction(() => window.fixtureDockerBadges.refreshSettled());
            await page.locator('tr.folder-id-branch').waitFor({ state: 'visible' });
            for (const mode of ['host', 'command', 'folderview', 'host', 'folderview']) {
                await save({ pageViewMode: mode });
                await page.waitForFunction(mode => {
                    if (document.body.getAttribute('data-fvplus-docker-page-view') !== mode) return false;
                    if (mode === 'host') return !document.querySelector('#docker_list tr.folder') && document.querySelectorAll('#docker_list > tr.sortable').length === 2;
                    if (mode === 'command') return !!document.querySelector('.fv-docker-command-view');
                    return !!document.querySelector('tr.folder-id-parent');
                }, mode);
            }
            assert.equal(await page.locator('#docker_list tr[id^="ct-"]').count(), 2, 'native rows survive repeated view changes without duplicates');
            assert.equal(await page.locator('tr.folder-id-direct > td.updatecolumn').count(), 0, 'folder update-column override remains authoritative');
            await save({ hideEmptyFolders: true });
            await page.waitForFunction(() => !document.querySelector('tr.folder-id-empty'));
            await page.waitForTimeout(500);
            const refreshes = await page.evaluate(() => window.fixtureNativeRefreshCount);
            await save({ health: { runtimeBadgeEnabled: true }, dashboard: { privacyMaskNames: false } });
            await page.waitForTimeout(600);
            assert.equal(await page.evaluate(() => window.fixtureNativeRefreshCount), refreshes, 'unrelated preference saves do not rebuild Docker');
            Object.assign(host.prefs(), { hideEmptyFolders: false, badges: { running: true, stopped: true, updates: true } });
            host.prefs()._metadata.prefsRevision++;
            await publishFromSettingsPeer(page, host.url, 'docker', host.prefs());
            await page.waitForFunction(() => document.querySelector('tr.folder-id-empty') && document.querySelector('tr.folder-id-parent > td.updatecolumn'));
            assert.equal(JSON.stringify(host.folders), foldersBefore, 'view preferences do not change folder configuration');
        } finally { await closeHost(page, host); }
    }, { skipAccessibility: true });

    test('VM view preferences reconcile running, stopped and empty folders through the native AJAX path', async ({ page }) => {
        const host = await createFilterViewSettingsHost(page);
        try {
            await mountFilterViewVmHost(page, host);
            const save = patch => page.evaluate(patch => vmPrefsCoordinator.save('vm', patch, { currentPrefs: folderTypePrefs, immediate: true }), patch);
            await save({ badges: { running: false, stopped: false }, hideEmptyFolders: true });
            await page.waitForFunction(() => {
                const row = document.querySelector('tr.folder-id-fixture-folder-0');
                return row && !document.querySelector('tr.folder-id-empty') && getComputedStyle(row.querySelector('.folder-load-status')).display === 'none';
            });
            await save({ badges: { running: true, stopped: true }, hideEmptyFolders: false });
            await page.waitForFunction(() => {
                const row = document.querySelector('tr.folder-id-fixture-folder-0');
                return !!document.querySelector('tr.folder-id-empty') && row && getComputedStyle(row.querySelector('.folder-load-status')).display !== 'none';
            });
            for (const entry of Object.values(host.runtime.vm)) {
                entry.running = false; entry.state = 'shutoff'; entry.State.Running = false; entry.info.State.Running = false;
            }
            await save({ badges: { running: true, stopped: false } });
            await page.waitForFunction(() => {
                const icon = document.querySelector('tr.folder-id-fixture-folder-0 .folder-load-status');
                return icon?.classList.contains('stopped') && getComputedStyle(icon).display === 'none';
            });
            await save({ badges: { running: true, stopped: true } });
            await page.waitForFunction(() => {
                const icon = document.querySelector('tr.folder-id-fixture-folder-0 .folder-load-status');
                return icon?.classList.contains('stopped') && getComputedStyle(icon).display !== 'none';
            });
            const refreshes = await page.evaluate(() => window.fixtureNativeRefreshCount);
            await save({ dashboard: { privacyMaskNames: false }, health: { runtimeBadgeEnabled: true } });
            await page.waitForTimeout(600);
            assert.equal(await page.evaluate(() => window.fixtureNativeRefreshCount), refreshes, 'unrelated live preferences do not rebuild native rows');
            assert.equal(await page.locator('#fv-runtime-health-badge-vm').count(), 1);
            assert.equal(await page.locator('#kvm_list tr[id^="fixture-vm-"]').count(), 2);
            host.prefs('vm').hideEmptyFolders = true;
            host.prefs('vm')._metadata.prefsRevision++;
            await publishFromSettingsPeer(page, host.url, 'vm', host.prefs('vm'));
            await page.waitForFunction(() => !document.querySelector('tr.folder-id-empty'));
        } finally { await closeHost(page, host); }
    }, { skipAccessibility: true });
};
