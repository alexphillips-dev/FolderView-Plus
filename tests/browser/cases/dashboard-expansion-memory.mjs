import assert from 'node:assert/strict';

export const registerDashboardExpansionMemoryCase = ({ test, baseUrl, installFixture, hydrateFixture }) => {
    test('Dashboard expansion memory merges rapid clicks and cannot resurrect cleared Docker or VM state', async ({ page }) => {
        await installFixture(page, baseUrl);
        await page.clock.install({ time: new Date('2026-10-12T12:00:00Z') });
        await page.clock.pauseAt(new Date('2026-10-12T12:00:01Z'));
        try {
        for (const type of ['docker', 'vm']) {
            await page.evaluate(type => {
                for (const id of ['parent', 'child', 'grandchild']) document.getElementById(`${type}-${id}`).click();
            }, type);
            const snapshot = await page.evaluate(type => window.fixtureDashboardAccordion.snapshot(type), type);
            for (const id of ['parent', 'child', 'grandchild']) {
                assert.equal(snapshot.saved[id], true);
                assert.equal(snapshot.folders[id].expanded, true);
                assert.equal(snapshot.folders[id].ariaExpanded, true);
            }
            assert.deepEqual(await page.evaluate(type => window.fixtureDashboardAccordion.disk(type), type), {});
        }
        await page.clock.runFor(79);
        assert.deepEqual(await page.evaluate(() => window.fixtureDashboardAccordion.disk('docker')), {});
        // Native pagehide must synchronously flush both keys before a fresh document.
        await page.reload(); await hydrateFixture(page, baseUrl);
        for (const type of ['docker', 'vm']) {
            const restored = await page.evaluate(type => window.fixtureDashboardAccordion.snapshot(type), type);
            for (const id of ['parent', 'child', 'grandchild']) assert.equal(restored.folders[id].expanded, true);
        }
        await page.evaluate(() => document.getElementById('docker-sibling').click());
        const accordion = await page.evaluate(() => window.fixtureDashboardAccordion.snapshot('docker'));
        assert.equal(accordion.saved.child, false); assert.equal(accordion.saved.grandchild, false);
        assert.equal(accordion.saved.sibling, true); assert.equal(accordion.saved.parent, true);
        await page.evaluate(() => {
            window.fixtureDashboardAccordion.clear('docker');
            window.dispatchEvent(new StorageEvent('storage', {
                key: window.FolderViewPlusDashboardStateStore.EXPANDED_STATE_STORAGE_KEYS.docker,
                newValue: '{"stale":true}', storageArea: localStorage
            }));
            window.dispatchEvent(new Event('pagehide'));
        });
        await page.clock.runFor(1000);
        assert.deepEqual(await page.evaluate(() => window.fixtureDashboardAccordion.disk('docker')), {});
        assert.deepEqual(await page.evaluate(() => window.fixtureDashboardAccordion.snapshot('docker').saved), {});
        assert.equal(await page.evaluate(() => window.fixtureDashboardAccordion.disk('vm').grandchild), true);
        await page.reload(); await hydrateFixture(page, baseUrl);
        assert.deepEqual(await page.evaluate(() => window.fixtureDashboardAccordion.snapshot('docker').saved), {});
        assert.equal(await page.evaluate(() => window.fixtureDashboardAccordion.snapshot('vm').folders.grandchild.expanded), true);
        } finally { await page.clock.resume(); }
    });
};
