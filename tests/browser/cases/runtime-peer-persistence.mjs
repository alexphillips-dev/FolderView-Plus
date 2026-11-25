import assert from 'node:assert/strict';
import { createDockerBadgeHost } from '../helpers/folder-badges-host.mjs';
import { closeFilterViewHost, createFilterViewSettingsHost, mountFilterViewVmHost } from '../helpers/filter-view-settings-host.mjs';

const withRuntime = async (page, type, prepare, run) => {
    const vm = type === 'vm';
    const host = vm ? await createFilterViewSettingsHost(page) : await createDockerBadgeHost(page);
    const prefs = () => host.prefs(type);
    const target = vm ? 'fixture-folder-0' : 'leaf';
    const names = vm ? host.names : Object.keys(host.runtime);
    try {
        prepare({ host, prefs, vm, target, names });
        if (vm) await mountFilterViewVmHost(page, host);
        else await page.goto(host.url, { waitUntil: 'load' });
        await run({ host, prefs, vm, target, names });
    } finally { await closeFilterViewHost(page, host); }
};

export const registerRuntimePeerPersistenceCases = ({ test }) => {
    test('Docker and VM regroup after a committed peer rule with live refresh off', async ({ page }) => {
        for (const type of ['docker', 'vm']) {
            await withRuntime(page, type, ({ host, prefs, vm, target, names }) => {
                if (vm) host.folders[target].containers = [names[0]];
                else delete host.folders.direct;
                Object.assign(prefs(), { groupUnassignedItems: true, liveRefreshEnabled: false });
            }, async ({ host, prefs, target, names }) => {
                const group = page.locator('[data-fv-unassigned-group]');
                const member = page.locator('[data-fv-unassigned-item]').filter({ hasText: names[1] });
                await group.waitFor();
                assert.equal(await member.count(), 1);
                const before = await page.evaluate(() => window.fixtureNativeRefreshCount);
                prefs().autoRules = [{ id: 'peer-rule', folderId: target, enabled: true, effect: 'include', kind: 'name_regex', pattern: `^${names[1]}$` }];
                prefs()._metadata.prefsRevision++;
                const peer = await page.context().newPage();
                try {
                    await peer.route('**/fixture-rule-peer', route => route.fulfill({ contentType: 'text/html', body: '<title>Rules peer</title>' }));
                    await peer.goto(new URL('/fixture-rule-peer', host.url).href);
                    await peer.evaluate(({ type, prefs }) => {
                        window.fixtureRuleChannel = new BroadcastChannel('fvplus-prefs-sync-v1');
                        window.fixtureRuleChannel.postMessage({ sourceId: 'fixture-rule-peer', action: 'committed', type, prefs });
                    }, { type, prefs: prefs() });
                    await group.waitFor({ state: 'detached' });
                    const assigned = page.locator(`tr[class~="folder-${target}-element"]`).filter({ hasText: names[1] });
                    await assigned.waitFor({ state: 'attached' });
                    assert.equal(await page.evaluate(() => window.fixtureNativeRefreshCount), before + 1);
                } finally { await peer.close(); }
            });
        }
    }, { skipAccessibility: true });

    test('Docker and VM preserve folder expansion through a reload before the save debounce', async ({ page }) => {
        for (const type of ['docker', 'vm']) {
            const id = type === 'vm' ? 'fixture-folder-0' : 'parent';
            await withRuntime(page, type, ({ prefs }) => { prefs().expandedFolderState = { [id]: false }; },
                async ({ prefs }) => {
                    const toggle = page.locator(`.dropDown-${id}`);
                    await toggle.waitFor();
                    await page.waitForLoadState('networkidle');
                    const navigation = page.waitForEvent('domcontentloaded');
                    const state = await toggle.evaluate(button => {
                        button.click();
                        window.location.reload();
                        return button.getAttribute('active');
                    });
                    assert.equal(state, 'true');
                    assert.equal(prefs().expandedFolderState[id], false);
                    await navigation;
                    await toggle.waitFor();
                    assert.equal(await toggle.getAttribute('active'), 'true');
                    for (let i = 0; i < 100 && prefs().expandedFolderState[id] !== true; i++) await page.waitForTimeout(40);
                    assert.equal(prefs().expandedFolderState[id], true);
                    await page.waitForFunction(type => sessionStorage.getItem(`fvplus.runtime.expand.${type}.v1.pending`) === null, type);
                    await page.waitForLoadState('networkidle');
                });
        }
    }, { skipAccessibility: true });
};
