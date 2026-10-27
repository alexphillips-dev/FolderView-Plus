import { createDockerHierarchyMoveHost } from './docker-hierarchy-move-host.mjs';

export const createDockerFolderMenuHost = async (page, { nativeLayout = false } = {}) => {
    const host = await createDockerHierarchyMoveHost(page);
    await page.addInitScript(({ nativeLayout }) => document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style'); style.textContent = '.contextMenuPlugin a,.contextMenuPlugin ul a{display:block;padding:6px 10px;white-space:nowrap}.contextMenuPlugin ul{min-width:180px}'; document.head.append(style);
        // Synthetic geometry for Unraid ContextJS, including its margins and floated arrow.
        if (nativeLayout) style.textContent += '.dropdown-menu{margin:2px 0 30px;min-width:160px}.dropdown-menu a{line-height:24px;padding:2px 20px 2px 6px}.dropdown-submenu>a:after{display:block;float:right;width:0;height:0;margin-top:5px;margin-right:-10px;border-color:transparent;border-left-color:#ccc;border-style:solid;border-width:5px 0 5px 5px;content:" "}';
        const options = new Map();
        const bound = new WeakSet();
        window.context.attach = (selector, items) => {
            options.set(selector, items);
            const node = document.querySelector(selector);
            if (!node || bound.has(node)) return;
            bound.add(node);
            node.addEventListener('click', event => {
                document.getElementById('synthetic-folder-menu')?.remove();
                const menu = document.createElement('ul');
                menu.id = 'synthetic-folder-menu'; menu.className = nativeLayout ? 'contextMenuPlugin dropdown-menu dropdown-context' : 'contextMenuPlugin';
                menu.style.cssText = `position:${nativeLayout ? 'absolute' : 'fixed'};left:${nativeLayout ? event.pageX : event.clientX}px;top:${nativeLayout ? event.pageY + 24 : event.clientY}px;z-index:99999;list-style:none`;
                const render = (items, list) => { for (const item of items) {
                    const row = document.createElement('li');
                    if (item.divider) row.className = 'divider';
                    else {
                        const link = document.createElement('a');
                        link.href = '#'; link.innerHTML = item.text;
                        const icon = document.createElement('i');
                        icon.className = 'fa ' + item.icon;
                        link.prepend(icon);
                        link.addEventListener('click', event => {
                            event.preventDefault();
                            if (item.action) { menu.remove(); item.action(event); }
                        });
                        row.append(link);
                        if (item.subMenu) {
                            row.classList.add('dropdown-submenu'); row.style.position = 'relative';
                            const child = document.createElement('ul'); child.className = 'dropdown-menu';
                            child.style.cssText = 'display:none;position:absolute;left:100%;top:0;list-style:none';
                            render(item.subMenu, child); row.append(child);
                        }
                    }
                    list.append(row);
                } };
                render(options.get(selector) || [], menu);
                document.body.append(menu);
            });
        };
    }), { nativeLayout });
    return host;
};
