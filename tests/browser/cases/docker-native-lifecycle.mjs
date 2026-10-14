import assert from 'node:assert/strict';

export const registerDockerNativeLifecycleCases = ({ test, baseUrl }) => {
    for (const scenario of ['native', 'canonical', 'expanded', 'collapsed', 'name-only']) {
        test(`Docker lifecycle reconciliation preserves native menus and clears spinners (${scenario})`, async ({ page }) => {
            await page.goto(`${baseUrl}/fixtures/docker-native-lifecycle.html?scenario=${scenario}`, { waitUntil: 'load' });
            await page.waitForFunction(() => window.fixtureNativeLifecycle);
            await page.emulateMedia({ reducedMotion: 'reduce' });
            for (const [index, action] of ['stop', 'start', 'pause', 'resume', 'restart', 'stop', 'start'].entries()) {
                await page.locator('[data-fixture-trigger="true"]').click();
                await page.getByRole('button', { name: action, exact: true }).click();
                await page.waitForFunction((count) => window.fixtureNativeLifecycle.snapshot().finalizations.length === count, index + 1);
                const result = await page.evaluate(() => window.fixtureNativeLifecycle.snapshot());
                assert.equal(result.finalizations.at(-1).matchedRuntimeEntry, true);
                assert.equal(result.finalizations.at(-1).settled, true);
                assert.equal(result.busyIcons, 0);
                assert.equal(result.label, action === 'stop' ? 'stopped' : (action === 'pause' ? 'paused' : 'started'));
                assert.equal(result.hostReloads, 0);
                assert.equal(result.rowPreserved, true);
                assert.equal(result.unrelatedLabel, 'started');
                assert.equal(result.requestCount, index + 1);
                assert.equal(result.menuOpens, index + 1);
            }
            const result = await page.evaluate(() => window.fixtureNativeLifecycle.snapshot());
            assert.ok(result.callbacks.every((callback) => callback === '__fvplusDockerLifecycleRefresh'));
            await page.reload({ waitUntil: 'load' });
            await page.locator('[data-fixture-trigger="true"]').click();
            assert.equal(await page.getByRole('button', { name: 'stop', exact: true }).count(), 1);
        });
    }
};
