(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.folderRenderRecovery = factory(root);
}(typeof window !== 'undefined' ? window : globalThis, function(defaultWindow) {
    'use strict';

    let activeCleanups = null;
    const registerCleanup = (cleanup) => activeCleanups?.push(cleanup);

    const restoreMutations = (records) => {
        for (let index = records.length - 1; index >= 0; index--) {
            const record = records[index];
            if (record.type === 'attributes') {
                if (record.oldValue === null) record.target.removeAttribute(record.attributeName);
                else record.target.setAttribute(record.attributeName, record.oldValue);
            } else if (record.type === 'characterData') {
                record.target.data = record.oldValue;
            } else if (record.type === 'childList') {
                for (const node of record.addedNodes) {
                    if (node.parentNode === record.target) record.target.removeChild(node);
                }
                const next = record.nextSibling?.parentNode === record.target ? record.nextSibling : null;
                for (const node of record.removedNodes) record.target.insertBefore(node, next);
            }
        }
    };

    const create = (options = {}) => {
        const win = options.window || defaultWindow;
        const doc = options.document || win.document;
        const failures = new Map();
        let notice = null;
        let recoveredCount = 0;
        const translate = (key, fallback) => {
            const value = win.jQuery?.i18n?.(key);
            return value && value !== key ? value : fallback;
        };
        const clearNotice = () => {
            notice?.remove();
            notice = null;
        };
        const begin = () => {
            clearNotice();
            failures.clear();
            recoveredCount = 0;
        };
        const render = (folder, id, order, run) => {
            const target = options.getRoot?.() || doc.body;
            const observer = new win.MutationObserver(() => {});
            const beforeOrder = order.slice();
            const beforeFolder = JSON.parse(JSON.stringify(folder));
            const activeElement = doc.activeElement;
            const scrollX = win.scrollX;
            const scrollY = win.scrollY;
            const parentCleanups = activeCleanups;
            const cleanups = activeCleanups = [];
            observer.observe(target, { childList: true, subtree: true, attributes: true, attributeOldValue: true, characterData: true, characterDataOldValue: true });
            try {
                const value = run();
                observer.disconnect();
                parentCleanups?.push(...cleanups);
                return value;
            } catch (_error) {
                const records = observer.takeRecords();
                observer.disconnect();
                for (const cleanup of cleanups.reverse()) {
                    try { cleanup(); } catch (_cleanupError) { /* Continue restoring native rows. */ }
                }
                // Replay native node moves instead of replacing rows with HTML copies.
                // Their host event handlers, focus targets, and input state must survive.
                restoreMutations(records);
                order.length = 0;
                for (const entry of beforeOrder) order.push(entry);
                for (const key of Object.keys(folder)) delete folder[key];
                Object.assign(folder, beforeFolder);
                failures.set(String(id), beforeFolder);
                const slot = order.indexOf(`folder-${id}`);
                if (slot >= 0) order.splice(slot, 1);
                options.onRollback?.(String(id));
                if (activeElement?.isConnected && doc.activeElement !== activeElement) activeElement.focus?.({ preventScroll: true });
                if (win.scrollX !== scrollX || win.scrollY !== scrollY) win.scrollTo?.(scrollX, scrollY);
                recoveredCount++;
                return slot >= 0 ? 1 : 0;
            } finally {
                observer.disconnect();
                activeCleanups = parentCleanups;
            }
        };
        const finish = () => {
            clearNotice();
            const target = options.getRoot?.();
            target?.setAttribute('data-fv-folder-render-failures', String(failures.size));
            if (!failures.size || !target) return;
            notice = doc.createElement('div');
            notice.className = 'fv-folder-render-warning';
            notice.dataset.folderType = options.type;
            notice.setAttribute('role', 'status');
            const title = doc.createElement('strong');
            title.dataset.i18n = 'common.folder-render.title';
            title.textContent = translate('common.folder-render.title', 'Some folders could not be displayed.');
            const help = doc.createElement('p');
            help.dataset.i18n = 'common.folder-render.help';
            help.textContent = translate('common.folder-render.help', 'Containers and VMs remain accessible. Review the affected folders in Settings, then reload this page.');
            notice.append(title, help);
            const list = doc.createElement('ul');
            for (const [id, folder] of [...failures].slice(0, 30)) {
                const item = doc.createElement('li');
                const link = doc.createElement('a');
                const type = options.type === 'docker' ? 'docker' : 'vm';
                const params = new URLSearchParams({ type, id });
                link.href = `/${type === 'docker' ? 'Docker' : 'VMs'}/Folder?${params}#${params}`;
                const label = doc.createElement('span');
                label.dataset.i18n = 'common.folder-render.review';
                label.textContent = translate('common.folder-render.review', 'Review folder');
                const name = doc.createElement('span');
                name.className = 'fv-folder-render-warning-name folder-appname';
                name.textContent = String(folder?.name || id);
                link.append(label, doc.createTextNode(': '), name);
                item.append(link);
                list.append(item);
            }
            notice.append(list);
            if (failures.size > 30) {
                const all = doc.createElement('a');
                all.href = '/Settings/FolderViewPlus';
                all.dataset.i18n = 'common.folder-render.all';
                all.textContent = translate('common.folder-render.all', 'Review all folders in Settings');
                notice.append(all);
            }
            const anchor = target.closest('table') || target;
            anchor.before(notice);
        };
        return Object.freeze({
            begin, render, finish,
            hasFailed: (id) => failures.has(String(id)),
            failedIds: () => [...failures.keys()],
            failedFolders: () => Object.fromEntries(failures),
            snapshot: () => ({ failedFolderCount: failures.size, recoveredFolderCount: recoveredCount })
        });
    };
    const createForPage = (type, selector, dependencies = {}) => create({
        window: defaultWindow, type,
        getRoot: () => defaultWindow.document.querySelector(selector),
        onRollback: (id) => {
            const released = dependencies.grouping?.()?.rollbackFolder?.(id) || [];
            for (const name of released) dependencies.binders?.delete(name);
            dependencies.deferred?.discardDisconnected?.();
        }
    });
    return Object.freeze({ create, createForPage, restoreMutations, registerCleanup });
}));
