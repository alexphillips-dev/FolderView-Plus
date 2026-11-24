import assert from 'node:assert/strict';
import { installDashboardLoadingFixture } from './dashboard-tile-loading.mjs';
import { membershipSnapshot, nativeMarkupFor, unassignedNames } from '../helpers/dashboard-membership-host.mjs';
import { closeFilterViewHost, createFilterViewSettingsHost, mountFilterViewVmHost } from '../helpers/filter-view-settings-host.mjs';

export const registerRuntimeNativeIdentityCases = ({ test, baseUrl }) => {
    test('Dashboard lifecycle distinguishes real folder-prefixed names from saved folder positions', async ({ page }) => {
        const types = ['docker', 'vm'];
        const names = type => [`folder-assigned-${type}`, `folder-${type}-group`, `fixture-${type}`, `folder-free-${type}`];
        const fixtureIds = {
            docker: ['abcdabcd0001', 'abcdabcd0002', 'abcdabcd0003', 'abcdabcd0004'],
            vm: ['fixture-uuid-1', 'fixture-uuid-2', 'fixture-uuid-3', 'fixture-uuid-4']
        };
        const rows = type => Object.fromEntries(names(type).map((name, index) => [name, fixtureIds[type][index]]));
        const fixture = await installDashboardLoadingFixture(page, baseUrl, {
            nativeMarkup: type => nativeMarkupFor(type, rows(type))
        });
        await fixture.load();
        for (const type of types) {
            const [prefixed, collision, ordinary, unassigned] = names(type);
            const snapshot = membershipSnapshot(type, rows(type));
            snapshot.folders[`${type}-group`].containers = [prefixed, collision];
            snapshot.folders.secondary = { id: 'secondary', name: 'Second folder', containers: [ordinary], settings: { expand_dashboard: true }, actions: [] };
            snapshot.order = [collision, 'folder-secondary', prefixed, ordinary, unassigned];
            snapshot.prefs.sortMode = 'alpha';
            fixture.settle(type, 0, 1, false, snapshot);
            await fixture.waitForState(type, 'ready');
            const widget = fixture.widget(type);
            const members = (id) => widget.locator(`[data-fv-folder-id="${id}"] .folder-showcase [data-fv-runtime-name]`)
                .evaluateAll(nodes => nodes.map(node => node.getAttribute('data-fv-runtime-name')).sort());
            assert.deepEqual(await members(`${type}-group`), [prefixed, collision].sort());
            assert.deepEqual(await members('secondary'), [ordinary]);
            assert.deepEqual(await unassignedNames(widget), [unassigned]);
            for (const name of [prefixed, collision, ordinary]) {
                assert.equal(await widget.getByRole('button', { name: `Native ${name} control` }).count(), 1);
            }
        }
    });

    test('VM view preferences reload the native controls when a VM keeps its name but changes UUID', async ({ page }) => {
        const host = await createFilterViewSettingsHost(page);
        const name = host.names[0];
        const oldUuid = host.runtime.vm[name].uuid;
        const newUuid = '12b45678-1234-4234-8234-123456789abc';
        const token = () => host.runtime.vm[name].uuid === oldUuid ? 'a'.repeat(64) : 'b'.repeat(64);
        await page.route(url => url.pathname.endsWith('/server/runtime_snapshot.php') && url.searchParams.get('type') === 'vm', route => route.fulfill({
            json: { ...host.snapshot('vm'), revisions: { folder: 0, prefs: 1 }, snapshotToken: token() }
        }));
        try {
            await mountFilterViewVmHost(page, host);
            const refresh = () => page.evaluate(() => refreshVmRuntimeStateInPlace({ preserveGroupedDom: true }));
            const read = () => page.evaluate(name => ({
                uuid: vmRuntimeInfoByName[name]?.uuid, member: globalFolders['fixture-folder-0']?.containers?.[name]?.id,
                token: lastVmRuntimeSnapshotToken, nativeReloads: window.fixtureNativeRefreshCount
            }), name);
            host.runtime.vm[name].state = 'shutoff';
            assert.equal(await refresh(), true);
            assert.equal(await page.locator(`#${oldUuid}`).getAttribute('data-fv-runtime-state'), 'shutoff');
            assert.equal((await read()).nativeReloads, 1);

            host.runtime.vm[name].uuid = newUuid;
            const replacement = await page.evaluate(async name => {
                const applied = await refreshVmRuntimeStateInPlace({ preserveGroupedDom: true });
                return { applied, uuid: vmRuntimeInfoByName[name]?.uuid, token: lastVmRuntimeSnapshotToken };
            }, name);
            assert.deepEqual(replacement, { applied: false, uuid: oldUuid, token: 'a'.repeat(64) });
            await page.waitForFunction(uuid => document.getElementById(`vm-${uuid}`)
                && lastVmRuntimeSnapshotToken === 'b'.repeat(64), newUuid);
            assert.equal(await page.locator(`tr.folder-id-fixture-folder-0 .folder-storage #${oldUuid}`).count(), 0);
            assert.equal(await page.locator(`tr.folder-id-fixture-folder-0 .folder-storage input[uuid="${newUuid}"]`).count(), 1);
            assert.deepEqual(await read(), { uuid: newUuid, member: newUuid, token: 'b'.repeat(64), nativeReloads: 2 });
        } finally { await closeFilterViewHost(page, host); }
    }, { skipAccessibility: true });
};
