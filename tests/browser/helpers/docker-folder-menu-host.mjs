import { createDockerHierarchyMoveHost } from './docker-hierarchy-move-host.mjs';

export const createDockerFolderMenuHost = async page => {
    const host = await createDockerHierarchyMoveHost(page);
    await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
        const options = new Map();
        const bound = new WeakSet();
        window.context.attach = (selector, items) => {
            options.set(selector, items);
            const node = document.querySelector(selector);
            if (!node || bound.has(node)) return;
            bound.add(node);
            node.addEventListener('click', () => {
                document.getElementById('synthetic-folder-menu')?.remove();
                const menu = document.createElement('ul');
                menu.id = 'synthetic-folder-menu';
                menu.className = 'contextMenuPlugin';
                menu.style.cssText = 'position:fixed;inset:0 auto auto 0;z-index:99999;list-style:none';
                for (const item of options.get(selector) || []) {
                    const row = document.createElement('li');
                    if (item.divider) row.className = 'divider';
                    else {
                        const link = document.createElement('a');
                        link.href = '#';
                        link.textContent = item.text;
                        const icon = document.createElement('i');
                        icon.className = 'fa ' + item.icon;
                        link.prepend(icon);
                        link.addEventListener('click', event => {
                            event.preventDefault();
                            if (item.action) { menu.remove(); item.action(event); }
                        });
                        row.append(link);
                    }
                    menu.append(row);
                }
                document.body.append(menu);
            });
        };
    }));
    return host;
};
