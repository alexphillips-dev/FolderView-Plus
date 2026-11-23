import assert from 'node:assert/strict';
import { createProductionPerfFixture } from '../../../scripts/lib/production-perf-fixture.mjs';

export const registerSettingsRuntimeActionCase = ({ test }) => {
    test('Settings Docker actions use lightweight states for previews, confirmations and requests', async ({ page }) => {
        const { server, folders, names } = createProductionPerfFixture(process.cwd(), { members: 3, folders: 1 });
        const states = ['running', 'paused', 'stopped'];
        const requests = [], snapshotModes = [];
        const runtime = Object.fromEntries(names.map((name, index) => [name, { name, state: states[index], running: index < 2, paused: index === 1 }]));
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        await page.route('**/server/templates.php?*', route => route.fulfill({ json: { ok: true, templates: [] } }));
        await page.route('**/server/diagnostics.php', route => route.fulfill({ json: { ok: true } }));
        await page.route('**/server/runtime_snapshot.php?*', async route => {
            const response = await route.fetch(), body = await response.json();
            snapshotModes.push(new URL(route.request().url()).searchParams.get('mode'));
            const patch = snapshot => Object.assign(snapshot, { folders, runtime, runtimeIncluded: true });
            if (body.snapshots) patch(body.snapshots.docker); else if (body.type === 'docker') patch(body);
            await route.fulfill({ response, json: body });
        });
        await page.route('**/server/bulk_folder_action.php', async route => {
            const body = new URLSearchParams(route.request().postData());
            const items = JSON.parse(body.get('items'));
            const action = body.get('runtimeAction');
            requests.push({ method: route.request().method(), type: body.get('type'), folderId: body.get('folderId'), action, items });
            for (const name of items) {
                runtime[name].state = { start: 'running', stop: 'stopped', pause: 'paused', resume: 'running' }[action];
                runtime[name].running = action !== 'stop';
                runtime[name].paused = action === 'pause';
            }
            await route.fulfill({ json: { ok: true, result: {
                executed: items.length, succeeded: items.length, failed: 0, skipped: [],
                results: items.map(item => ({ item, ok: true }))
            } } });
        });
        try {
            await page.goto(`http://127.0.0.1:${server.address().port}/settings`);
            await page.waitForFunction(() => !document.getElementById('fv-settings-root').classList.contains('fv-settings-bootstrap-pending'));
            await page.locator('[data-mode="advanced"]').click();
            const sectionPicker = page.locator('#fv-advanced-section-picker');
            if (await sectionPicker.isVisible()) await sectionPicker.selectOption('operations');
            else await page.locator('[data-fv-advanced-tab="operations"]').click();
            await page.evaluate(async () => {
                document.title = 'FolderView Plus Settings action fixture';
                await refreshType('docker');
            });
            await page.locator('#docker-runtime-folder').selectOption('fixture-folder-0');
            const expected = { start: [names[2]], stop: names.slice(0, 2), pause: [names[0]], resume: [names[1]] };
            for (const [action, items] of Object.entries(expected)) {
                names.forEach((name, index) => Object.assign(runtime[name], { state: states[index], running: index < 2, paused: index === 1 }));
                await page.evaluate(() => refreshType('docker'));
                await page.locator('#docker-runtime-action').selectOption(action);
                await page.locator('[data-fv-onclick="previewFolderRuntimeAction(\'docker\')"]').click();
                const plan = await page.evaluate(action => getRuntimePlanForFolder('docker', 'fixture-folder-0', action), action);
                assert.deepEqual(plan.countsByState, { started: 1, paused: 1, stopped: 1 });
                assert.deepEqual(plan.eligible.map(row => row.name), items);
                assert.equal(plan.skipped.length, 3 - items.length);
                assert.equal(await page.locator('#docker-runtime-preview-output .fv-operations-runtime-copy').textContent(), `${items.length} eligible, ${3 - items.length} skipped`);
                assert.equal(await page.locator('#docker-runtime-apply').isEnabled(), true);
                await page.locator('#docker-runtime-apply').click();
                const confirmation = page.getByRole('dialog').filter({ hasText: 'Apply folder action?' });
                await confirmation.waitFor();
                assert.match(await confirmation.innerText(), new RegExp(`Eligible: ${items.length} Skipped: ${3 - items.length}`));
                if (action === 'start') {
                    await confirmation.getByRole('button', { name: 'Cancel' }).click();
                    assert.equal(requests.length, 0);
                    await page.locator('#docker-runtime-apply').click();
                }
                await confirmation.getByRole('button', { name: 'Apply' }).click();
                await page.waitForFunction(() => document.getElementById('docker-runtime-preview-status').textContent === 'Action complete');
                assert.deepEqual(requests.at(-1), { method: 'POST', type: 'docker', folderId: 'fixture-folder-0', action, items });
                await page.getByRole('dialog').locator('[data-fv-ui-action="modal-acknowledge"]').click();
            }
            assert.equal(requests.length, 4);
            assert.ok(snapshotModes.includes('state'), 'the real Settings refresh must request lightweight state');
        } finally {
            await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
            await page.waitForLoadState('networkidle');
            await page.unrouteAll({ behavior: 'wait' });
            server.closeAllConnections();
            await new Promise(resolve => server.close(resolve));
        }
    });
};
