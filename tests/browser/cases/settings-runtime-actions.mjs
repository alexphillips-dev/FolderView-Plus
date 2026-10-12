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
            requests.push({ method: route.request().method(), type: body.get('type'), action: body.get('runtimeAction'), items });
            await route.fulfill({ json: { ok: true, result: { executed: items.length, succeeded: items.length, failed: 0, skipped: [] } } });
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
                window.fixtureActionConfirmations = [];
                window.swal = (options, callback) => {
                    if (options.title === 'Apply folder action?') {
                        window.fixtureActionConfirmations.push(options);
                        callback(true);
                    }
                };
                window.swal.close = () => {};
            });
            await page.locator('#docker-runtime-folder').selectOption('fixture-folder-0');
            const expected = { start: [names[2]], stop: names.slice(0, 2), pause: [names[0]], resume: [names[1]] };
            for (const [action, items] of Object.entries(expected)) {
                await page.locator('#docker-runtime-action').selectOption(action);
                await page.locator('[data-fv-onclick="previewFolderRuntimeAction(\'docker\')"]').click();
                const plan = await page.evaluate(action => getRuntimePlanForFolder('docker', 'fixture-folder-0', action), action);
                assert.deepEqual(plan.countsByState, { started: 1, paused: 1, stopped: 1 });
                assert.deepEqual(plan.eligible.map(row => row.name), items);
                assert.equal(plan.skipped.length, 3 - items.length);
                assert.equal(await page.locator('#docker-runtime-preview-output .fv-operations-runtime-copy').textContent(), `${items.length} eligible, ${3 - items.length} skipped`);
                assert.equal(await page.locator('#docker-runtime-apply').isEnabled(), true);
                await page.locator('#docker-runtime-apply').click();
                await page.waitForFunction(count => window.fixtureActionConfirmations.length === count, Object.keys(expected).indexOf(action) + 1);
                const confirmation = await page.evaluate(() => window.fixtureActionConfirmations.at(-1));
                assert.match(confirmation.text, new RegExp(`Eligible: ${items.length}\\nSkipped: ${3 - items.length}`));
                await page.waitForFunction(() => document.getElementById('docker-runtime-preview-status').textContent === 'Action complete');
                assert.deepEqual(requests.at(-1), { method: 'POST', type: 'docker', action, items });
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
