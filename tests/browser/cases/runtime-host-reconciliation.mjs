import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createDockerHideEmptyHost } from '../helpers/docker-hide-empty-host.mjs';
import { closeFilterViewHost, createFilterViewSettingsHost, mountFilterViewVmHost } from '../helpers/filter-view-settings-host.mjs';
import { nativeSwitchSource } from '../helpers/docker-native-switch.mjs';

const mountRuntime = async (page, type) => {
    if (type === 'vm') {
        const host = await createFilterViewSettingsHost(page);
        host.prefs('vm').groupUnassignedItems = true;
        host.folders['fixture-folder-0'].containers = [host.names[0]];
        await mountFilterViewVmHost(page, host);
        return { ...host, runtime: host.runtime.vm, refresh: () => page.evaluate(() => refreshVmRuntimeStateInPlace()),
            rowId: 'fixture-vm-0', close: () => closeFilterViewHost(page, host) };
    }
    const host = await createDockerHideEmptyHost(page, true);
    const names = Object.keys(host.runtime);
    delete host.folders.direct;
    host.prefs().groupUnassignedItems = true;
    const source = fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/docker.js', 'utf8');
    const end = '})(window, window.jQuery || window.$);';
    assert.equal(source.split(end).length, 2);
    await page.route('**/scripts/docker.js*', route => route.fulfill({
        contentType: 'text/javascript', body: source.replace(end, () => [
            'window.fixtureRuntimeRefresh = () => refreshDockerRuntimeStateInPlace({ apiFirst: false });',
            'window.fixtureLifecycle = id => getDockerRuntimeReconcileApi().runDockerLifecycleRefresh({ action: "stop", container: id });',
            'window.fixtureRenderedRevision = () => lastDockerRuntimeSnapshotRevisions.folder;',
            end
        ].join('\n'))
    }));
    await page.goto(host.url, { waitUntil: 'load' });
    await page.locator('tr.folder-id-leaf').waitFor({ state: 'attached' });
    await page.waitForFunction(() => window.fixtureRenderedRevision() === 1);
    return { ...host, names, refresh: () => page.evaluate(() => window.fixtureRuntimeRefresh()),
        rowId: 'ct-' + host.runtime[names[0]].id.slice(0, 12),
        close: async () => { await page.goto('about:blank'); await page.unrouteAll({ behavior: 'wait' }); await host.close(); } };
};

const nativeRefreshCount = (page) => page.evaluate(() => window.fixtureNativeRefreshCount);

export const registerRuntimeHostReconciliationCases = ({ test }) => {
    test('Docker and VM native autostart reconciles without change events or repeated animation', async ({ page }) => {
        for (const type of ['docker', 'vm']) {
            const host = await mountRuntime(page, type);
            const endpoint = '/fixture-autostart';
            const writes = [];
            await page.route('**' + endpoint, route => {
                writes.push(route.request().postData());
                return route.fulfill({ json: { ok: true } });
            });
            try {
                await page.addScriptTag({ content: nativeSwitchSource });
                await page.evaluate(({ rowId, endpoint }) => {
                    const jq = window.jQuery;
                    const $input = jq(document.getElementById(rowId)).find('input[type="checkbox"]').first().addClass('autostart');
                    $input.switchButton({ labels_placement: 'right' });
                    const widget = $input.data('sylightsUI-switchButton');
                    $input.on('change.fixture', () => jq.post(endpoint, { checked: $input.prop('checked') }));
                    const animate = jq.fn.animate;
                    window.fixtureSwitchAnimationCount = 0;
                    jq.fn.animate = function (...args) {
                        if (this[0] === widget.button[0]) window.fixtureSwitchAnimationCount++;
                        return animate.apply(this, args);
                    };
                    window.readFixtureSwitch = () => ({
                        checked: $input.prop('checked'), visual: widget.button_bg.hasClass('checked'),
                        widget: widget.options.checked, animations: window.fixtureSwitchAnimationCount
                    });
                    window.clickFixtureSwitch = () => widget.button_bg.trigger('click');
                }, { rowId: host.rowId, endpoint });
                const read = () => page.evaluate(() => window.readFixtureSwitch());
                assert.deepEqual(await read(), { checked: false, visual: false, widget: false, animations: 0 });
                const entry = host.runtime[host.names[0]];
                for (const checked of [true, false]) {
                    entry.autostart = checked;
                    if (type === 'docker') entry.State.Autostart = entry.info.State.Autostart = checked;
                    assert.equal(await host.refresh(), true);
                    assert.equal(await host.refresh(), true);
                    assert.deepEqual(await read(), { checked, visual: checked, widget: checked, animations: 0 });
                }
                assert.deepEqual(writes, []);
                const clicked = page.waitForResponse(response => response.url().endsWith(endpoint));
                const checkedAfterClick = await page.evaluate(() => {
                    window.clickFixtureSwitch();
                    return window.readFixtureSwitch().checked;
                });
                await clicked;
                assert.deepEqual(writes, ['checked=true']);
                assert.equal(checkedAfterClick, true);
            } finally { await host.close(); }
        }
    }, { skipAccessibility: true });

    test('Docker lifecycle applies deferred folder configuration after Stop settles', async ({ page }) => {
        const host = await mountRuntime(page, 'docker');
        const [stopped, assigned] = host.names;
        const header = page.locator('#docker_list [data-fv-unassigned-group]');
        try {
            await header.waitFor({ state: 'attached' });
            const before = await nativeRefreshCount(page);
            host.folders.added = { name: 'New configured group', containers: [assigned], settings: {}, actions: [] };
            Object.assign(host.runtime[stopped], { running: false, state: 'stopped' });
            host.runtime[stopped].State.Running = host.runtime[stopped].info.State.Running = false;
            await page.route(url => url.pathname.endsWith('/server/runtime_snapshot.php') && url.searchParams.get('mode') === 'state', route => route.fulfill({
                json: { ok: true, kind: 'runtime_snapshot', schemaVersion: 1, type: 'docker', runtime: host.runtime,
                    folders: host.folders, order: Object.keys(host.folders).map(id => 'folder-' + id), prefs: host.prefs(),
                    metadata: { folderRevision: 2, prefsRevision: 1 }, revisions: { folder: 2, prefs: 1 }, snapshotToken: 'b'.repeat(64) }
            }));
            await page.evaluate(id => window.fixtureLifecycle(id), host.runtime[stopped].id);
            await page.locator('tr.folder-id-added').waitFor({ state: 'attached' });
            await header.waitFor({ state: 'detached' });
            assert.equal(await page.evaluate(() => window.fixtureRenderedRevision()), 2);
            assert.equal(await nativeRefreshCount(page), before + 1);
        } finally { await host.close(); }
    }, { skipAccessibility: true });

    test('Docker and VM Unassigned restores keyboard focus only when the user leaves it in place', async ({ page }) => {
        for (const type of ['docker', 'vm']) {
            const host = await mountRuntime(page, type);
            try {
                const button = page.locator('[data-fv-unassigned-group] button');
                await button.focus();
                await button.press('Enter');
                const before = await nativeRefreshCount(page);
                await page.evaluate(() => { window.loadlist(); });
                await page.waitForFunction(count => window.fixtureNativeRefreshCount > count, before);
                assert.equal(await button.evaluate(node => node === document.activeElement), true);
                assert.equal(await button.getAttribute('aria-expanded'), 'true');
                await page.evaluate(() => {
                    window.loadlist();
                    const other = document.createElement('button');
                    Object.assign(other, { id: 'fixture-other-focus', textContent: 'Other control' });
                    document.body.append(other);
                    other.focus();
                });
                await page.waitForFunction(count => window.fixtureNativeRefreshCount === count + 2, before);
                await button.waitFor();
                assert.equal(await page.evaluate(() => document.activeElement.id), 'fixture-other-focus');
            } finally { await host.close(); }
        }
    }, { skipAccessibility: true });
};
