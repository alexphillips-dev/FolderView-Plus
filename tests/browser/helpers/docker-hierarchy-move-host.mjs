import { createDockerHideEmptyHost } from './docker-hide-empty-host.mjs';

export const createDockerHierarchyMoveHost = async page => {
    const host = await createDockerHideEmptyHost(page, true);
    host.prefs().hideEmptyFolders = false;
    let failing = false;
    let releaseFailure = () => {};
    let failureGate = Promise.resolve();
    let updateCount = 0;
    await page.route('**/server/update.php', async route => {
        updateCount++;
        if (failing) {
            await failureGate;
            return route.fulfill({ status: 409, json: { ok: false, error: 'Synthetic revision conflict' } });
        }
        const payload = Object.fromEntries(new URLSearchParams(route.request().postData()));
        host.folders[payload.id] = JSON.parse(payload.content);
        await route.fulfill({ json: { metadata: { folderRevision: updateCount + 1 } } });
    });
    await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
        if (!window.context) return;
        window.eventURL = '/plugins/dynamix.docker.manager/include/DockerEvents.php';
        const reportError = console.error.bind(console);
        console.error = (...args) => reportError(...args.map(value => value instanceof Error ? value.message : value));
        const options = new Map();
        const bound = new WeakSet();
        window.context.settings = () => {};
        window.context.attach = (selector, items) => {
            options.set(selector, items);
            const node = document.querySelector(selector);
            if (!node || bound.has(node)) return;
            bound.add(node);
            node.addEventListener('click', () => {
                document.getElementById('synthetic-folder-menu')?.remove();
                const menu = document.createElement('div');
                menu.id = 'synthetic-folder-menu';
                menu.style.cssText = 'position:fixed;inset:0 auto auto 0;z-index:99999;background:#333;color:white;';
                for (const item of options.get(selector) || []) {
                    if (!item.action) continue;
                    const button = document.createElement('button');
                    button.textContent = item.text;
                    button.addEventListener('click', event => { menu.remove(); item.action(event); });
                    menu.append(button);
                }
                document.body.append(menu);
            });
        };
    }));
    return { ...host, failUpdates: value => {
        failing = value;
        if (value) failureGate = new Promise(resolve => { releaseFailure = resolve; });
    }, releaseFailure: () => releaseFailure(), updateCount: () => updateCount };
};
