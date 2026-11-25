import assert from 'node:assert/strict';
import { createProductionPerfFixture } from '../../../scripts/lib/production-perf-fixture.mjs';
import { phpOrder } from '../../helpers/docker-order-fixture.mjs';

const checkDockerPageStartOrder = async (page, dockerRowPlacement) => {
    const host = createProductionPerfFixture(process.cwd(), { folders: 0, members: 8 });
    const names = host.names;
    const folders = {
        solo: { name: 'Solo', containers: [names[0]] },
        parent: { name: 'Parent', containers: [names[2]], settings: { child_folder_order: ['second', 'first'] } },
        first: { name: 'First child', parentId: 'parent', containers: [names[4]] },
        second: { name: 'Second child', parentId: 'parent', containers: [names[5]] },
        new: { name: 'Unslotted', containers: [names[7]], membershipPolicy: 'folderview3' }
    };
    const native = ['folder-solo', names[6], 'folder-first', 'folder-parent', 'folder-obsolete', 'folder-second', names[3]];
    const prefs = { sortMode: 'created', pinnedFolderIds: ['first'], dockerRowPlacement };
    const plan = phpOrder({ folders, prefs, native, names });
    if (dockerRowPlacement === 'folders-first') {
        assert.deepEqual(plan.order, [names[2], names[5], names[4], names[0], names[7], names[6], names[3], names[1]]);
    } else {
        assert.ok(plan.order.indexOf(names[6]) < plan.order.indexOf(names[0]), 'the saved standalone slot precedes a later folder');
    }

    await new Promise(resolve => host.server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${host.server.address().port}`;
    const routes = `${origin}/plugins/folderview.plus/server/{runtime_snapshot,prefs}.php*`;
    try {
        await page.route(routes, async route => {
            const response = await route.fetch();
            const data = await response.json();
            if (data.kind === 'runtime_snapshot') {
                data.order = plan.savedOrder;
                data.folders = plan.folders;
            }
            data.prefs = { ...data.prefs, ...prefs };
            await route.fulfill({ response, json: data });
        });
        await page.goto(`${origin}/docker`, { waitUntil: 'load' });
        await page.waitForFunction(() => document.querySelectorAll('#docker_list > tr.folder').length === 5);
        for (const id of ['parent', 'second', 'first', 'solo', 'new']) {
            await page.locator(`tr.folder-id-${id} button.folder-dropdown`).click();
        }
        const displayed = await page.locator('#docker_list > tr[data-name]').evaluateAll(rows => rows.map(row => row.dataset.name));
        assert.deepEqual(displayed, plan.sequence.map(entry => entry.name));
    } finally {
        await page.goto('about:blank');
        await page.unroute(routes);
        host.server.closeAllConnections();
        await new Promise(resolve => host.server.close(resolve));
    }
};

export const exerciseDockerPageStartOrder = async ({ page }) => {
    await checkDockerPageStartOrder(page, 'folders-first');
    await checkDockerPageStartOrder(page, 'saved-order');
};
