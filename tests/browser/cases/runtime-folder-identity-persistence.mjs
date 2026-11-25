import assert from 'node:assert/strict';
import { createDockerBadgeHost } from '../helpers/folder-badges-host.mjs';
import { closeFilterViewHost, createFilterViewSettingsHost, mountFilterViewVmHost } from '../helpers/filter-view-settings-host.mjs';
import { installDashboardLoadingFixture } from './dashboard-tile-loading.mjs';
import { membershipSnapshot, nativeMarkupFor } from '../helpers/dashboard-membership-host.mjs';

const literalId = 'fixture.group:branch-1';
const openDocker = async (page, host) => {
    await page.goto(host.url, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('tr.folder-id-parent') && window.fixtureDockerBadges.refreshSettled());
};

export const registerRuntimeFolderIdentityPersistenceCases = ({ test, baseUrl }) => {
    test('Docker and VM operate on literal period and colon folder IDs', async ({ page }) => {
        for (const type of ['docker', 'vm']) {
            const isVm = type === 'vm';
            const host = isVm ? await createFilterViewSettingsHost(page) : await createDockerBadgeHost(page);
            const source = isVm ? 'fixture-folder-0' : 'direct';
            host.folders[literalId] = { ...host.folders[source] };
            if (isVm) {
                host.folders[literalId].containers = [host.names[0]];
                host.folders[source].containers = [host.names[1]];
            } else delete host.folders[source];
            try {
                if (isVm) await mountFilterViewVmHost(page, host);
                else await openDocker(page, host);
                const header = page.locator(`tr[class~="folder-id-${literalId}"]`);
                const toggle = header.locator('button.folder-dropdown');
                const member = page.locator(`tr[class~="folder-${literalId}-element"]`);
                await toggle.click();
                assert.equal(await toggle.getAttribute('active'), 'true');
                await member.waitFor();
                const prefs = () => host.prefs(type).expandedFolderState;
                for (let i = 0; i < 100 && prefs()?.[literalId] !== true; i++) await page.waitForTimeout(40);
                assert.equal(prefs()?.[literalId], true);
                assert.equal(Object.hasOwn(prefs(), 'fixture'), false, 'no truncated ID is persisted');
                await toggle.click();
                await member.waitFor({ state: 'hidden' });
                assert.equal(await toggle.getAttribute('active'), 'false');
            } finally { await closeFilterViewHost(page, host); }
        }
    }, { skipAccessibility: true });

    test('Dashboard attaches and expands members under literal period and colon folder IDs', async ({ page }) => {
        const rows = { docker: { 'fixture-docker': 'abcdabcd0001' }, vm: { 'fixture-vm': 'fixture-uuid' } };
        const host = await installDashboardLoadingFixture(page, baseUrl, {
            nativeMarkup: type => nativeMarkupFor(type, rows[type])
        });
        await host.load();
        for (const type of ['docker', 'vm']) {
            const parent = `${literalId}-${type}`;
            const child = `${parent}.child:1`;
            const snapshot = membershipSnapshot(type, rows[type]);
            snapshot.folders = {
                [parent]: { id: parent, name: 'Parent', containers: [], settings: {}, actions: [] },
                [child]: { id: child, parentId: parent, name: 'Child', containers: [`fixture-${type}`], settings: {}, actions: [] }
            };
            snapshot.order = [`folder-${parent}`, `folder-${child}`];
            host.settle(type, 0, 1, false, snapshot);
            await host.waitForState(type, 'ready');
            const card = host.widget(type).locator(`[data-fv-folder-id="${parent}"]`);
            const nested = card.locator(`[data-fv-folder-id="${child}"]`);
            for (const folder of [card, nested]) await folder.locator(':scope > [data-fv-dashboard-folder-toggle]').click();
            assert.equal(await nested.locator(`[data-fv-runtime-name="fixture-${type}"]`).isVisible(), true);
        }
    }, { skipAccessibility: true });

    test('Docker keeps pending folder expansion during a rapid badge preference refresh', async ({ page }) => {
        const host = await createDockerBadgeHost(page, { running: true, stopped: true, updates: true });
        host.prefs().expandedFolderState = { parent: false };
        try {
            await openDocker(page, host);
            const before = await page.evaluate(() => window.fixtureNativeRefreshCount);
            await page.evaluate(async () => {
                document.querySelector('.dropDown-parent').click();
                await window.fixtureDockerBadges.save({ running: false, stopped: true, updates: true });
            });
            await page.waitForFunction(before => window.fixtureNativeRefreshCount > before && window.fixtureDockerBadges.refreshSettled(), before);
            assert.equal(await page.locator('tr.folder-id-branch').isVisible(), true);
            await page.waitForFunction(() => JSON.parse(localStorage.getItem('fvplus.runtime.expand.docker.v1'))?.parent === true);
            for (let i = 0; i < 100 && host.prefs().expandedFolderState.parent !== true; i++) await page.waitForTimeout(40);
            assert.equal(host.prefs().expandedFolderState.parent, true);
        } finally { await closeFilterViewHost(page, host); }
    }, { skipAccessibility: true });
};
