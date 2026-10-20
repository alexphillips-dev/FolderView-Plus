import assert from 'node:assert/strict';
import { createFilterViewSettingsHost, mountFilterViewVmHost } from '../helpers/filter-view-settings-host.mjs';
import { createDockerBadgeHost } from '../helpers/folder-badges-host.mjs';

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
const closeHost = async (page, host) => {
    await page.goto('about:blank');
    await page.unrouteAll({ behavior: 'wait' });
    await host.close();
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
    test('Filters and view settings clear defaults, replace smaller profiles and announce exact no-op counts', async ({ page }) => {
        const host = await createFilterViewSettingsHost(page);
        host.folders['fixture-folder-0'].settings = { preview: 4, preview_rows: 3 };
        host.folders.empty.settings = { preview: 1 };
        let applied = false;
        await page.route('**/server/apply_folder_settings.php', route => route.fulfill({ json: { ok: true, result: applied
            ? { updatedCount: 0, unchangedCount: 2, skippedIds: ['fixture-folder-0', 'empty'] }
            : (applied = true, { updatedCount: 1, unchangedCount: 1, skippedIds: ['empty'] }) } }));
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
            await warn.fill('60'); await warn.press('Tab');
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
            await page.locator('.dropDown-parent').click();
            await page.locator('tr.folder-id-branch').waitFor({ state: 'visible' });
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
