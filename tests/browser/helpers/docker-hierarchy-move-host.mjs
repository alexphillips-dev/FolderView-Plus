import { createDockerHideEmptyHost } from './docker-hide-empty-host.mjs';
import { installDockerHierarchyMoveMenu, createDockerHierarchyMoveInteractions } from './docker-hierarchy-move-interactions.mjs';

export const createDockerHierarchyMoveHost = async page => {
    const host = await createDockerHideEmptyHost(page, true);
    host.prefs().hideEmptyFolders = false;
    let failing = false;
    let releaseFailure = () => {};
    let failureGate = Promise.resolve();
    let updateCount = 0;
    await page.route('**/server/batch.php', async route => {
        updateCount++;
        if (failing) {
            await failureGate;
            return route.fulfill({ status: 409, json: { ok: false, error: 'Synthetic revision conflict' } });
        }
        const payload = Object.fromEntries(new URLSearchParams(route.request().postData()));
        try { await route.fulfill({ json: host.applyBatch(payload) }); }
        catch (error) { await route.fulfill({ status: error.status || 500, json: { ok: false, error: error.message } }); }
    });
    await installDockerHierarchyMoveMenu(page);
    return { ...host, ...createDockerHierarchyMoveInteractions(page), failUpdates: value => {
        failing = value;
        if (value) failureGate = new Promise(resolve => { releaseFailure = resolve; });
    }, releaseFailure: () => releaseFailure(), updateCount: () => updateCount };
};
