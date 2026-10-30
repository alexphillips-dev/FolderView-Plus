export const installDockerHierarchyMoveMenu = async page => {
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
};

export const createDockerHierarchyMoveInteractions = page => {
    const settle = async () => {
        await page.waitForFunction(() => document.querySelector('#fvplus-docker-action-bar')?.getAttribute('aria-busy') === 'false');
        await page.waitForLoadState('networkidle');
    };
    const expand = async id => { await page.locator(`.dropDown-${id}`).click(); await settle(); };
    const move = async (waitForSave = true) => {
        const saved = waitForSave ? page.waitForResponse(response => response.url().includes('/server/batch.php')
            && response.request().method() === 'POST') : null;
        await page.locator('#branch').click();
        await page.locator('#synthetic-folder-menu button').filter({ hasText: /^Move to root$/ }).click();
        if (saved) await saved;
    };
    return { settle, expand, move };
};
