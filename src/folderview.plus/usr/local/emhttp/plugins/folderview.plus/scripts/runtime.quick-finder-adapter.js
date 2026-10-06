// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./runtime.quick-finder.js'));
        return;
    }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.runtimeQuickFinderAdapter = factory(modules.runtimeQuickFinder);
}(typeof globalThis !== 'undefined' ? globalThis : this, function(finder) {
    'use strict';
    const findViewToggleAnchor = (doc, table) => {
        if (!table) return null;
        const scopes = [table.parentElement, table.parentElement?.parentElement, doc.body].filter(Boolean);
        for (const scope of scopes) {
            const switches = Array.from(scope.querySelectorAll('input[type="checkbox"], .switch-button, .switch-button-background'));
            for (const toggle of switches) {
                const candidates = [toggle.closest('label'), toggle.closest('span'), toggle.closest('div'), toggle.parentElement, toggle.parentElement?.parentElement].filter(Boolean);
                for (const candidate of candidates) {
                    if (String(candidate.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase().includes('basic view')) return candidate;
                }
            }
        }
        return null;
    };
    const findVmRows = (doc, name) => {
        const safeName = String(name || '').trim();
        if (!safeName) return [];
        return Array.from(doc.querySelectorAll('#kvm_list tr')).filter((row) => !row.classList.contains('folder')
            && String(row.querySelector('td.vm-name span.outer span.inner a')?.textContent || '').trim() === safeName);
    };
    const resolveMount = (doc, table, type) => {
        if (!table) return null;
        const host = doc.querySelector('.ToggleViewMode');
        if (host) return { host, anchor: Array.from(host.children).find((node) => !node.classList.contains('fv-quickfinder')) || null };
        const id = `fvplus-${type}-quick-finder-fallback`;
        let fallback = doc.getElementById(id);
        if (!fallback) {
            fallback = doc.createElement('div'); fallback.id = id; fallback.className = 'fv-quickfinder-fallback';
            table.parentElement.insertBefore(fallback, table);
        }
        return { host: fallback };
    };
    const createApi = (deps = {}) => {
        const { window: win, document: doc } = deps;
        const type = deps.type === 'vm' ? 'vm' : 'docker';
        let active = true;
        const getFolders = deps.getFolders;
        const table = () => deps.hostAdapter.getTable();
        const folderRow = (id) => Array.from(table()?.querySelectorAll('tr.folder') || []).find((row) => row.classList.contains(`folder-id-${id}`)) || null;
        const itemRow = (name) => Array.from(table()?.querySelectorAll('tr') || []).find((row) => {
            if (row.classList.contains('folder')) return false;
            if (type === 'docker' && row.id === `ct-${name}`) return true;
            const label = deps.readRowName ? deps.readRowName(row) : String(row.getAttribute('data-name')
                || row.querySelector(type === 'vm' ? 'td.vm-name span.outer span.inner a' : 'td.ct-name .appname')?.textContent || '').trim();
            return label === name;
        }) || null;
        const findRow = (item) => item.kind === 'folder' ? folderRow(item.id) : itemRow(item.id);
        const getIcon = (item) => {
            const sanitize = win.FolderViewPlusFoundationModules?.utilityFoundation?.sanitizeImageUrl;
            if (!sanitize) return '';
            const configured = sanitize(item.entry.icon, '');
            if (configured) return configured;
            const selector = item.kind === 'folder' ? '.folder-name img.folder-img' : type === 'vm' ? 'td.vm-name img' : 'td.ct-name img';
            return sanitize(findRow(item)?.querySelector(selector)?.getAttribute('src'), '');
        };
        const getState = (item) => {
            const entry = item.entry;
            if (type === 'docker') return entry.state === true ? (entry.pause === true ? 'paused' : 'running') : 'stopped';
            return entry.state === 'running' ? 'running' : ['paused', 'pmsuspended'].includes(entry.state) ? 'paused' : 'stopped';
        };
        const nativeTrigger = (item) => findRow(item)?.querySelector(type === 'vm'
            ? '.vm-name .hand, .vm-name [onclick*="addVMContext"], .vm-name [data-fv-onclick*="addVMContext"]'
            : '.ct-name .hand');
        const getActions = (item) => {
            if (item.kind === 'folder') return [...(folderRow(item.id) ? ['reveal', 'focus'] : []), 'edit'];
            const actions = findRow(item) ? ['reveal'] : [];
            if (type === 'docker') {
                actions.push('webui', 'console', 'logs');
            } else {
                if (item.entry.logs && typeof win.openTerminal === 'function') actions.push('logs');
                if (nativeTrigger(item)) actions.push('actions');
            }
            return actions;
        };
        const isActionEnabled = (item, action) => {
            if (type !== 'docker' || item.kind !== 'item') return true;
            if (action === 'webui') return getState(item) === 'running' && Boolean(deps.safeWebui(item.entry.webui));
            if (action === 'console') return getState(item) === 'running' && typeof win.openTerminal === 'function';
            if (action === 'logs') return typeof win.openTerminal === 'function';
            return true;
        };
        const prepareReveal = async (item) => {
            const generation = deps.getRenderGeneration?.();
            const changed = await deps.prepareView?.();
            if (changed) {
                const deadline = Date.now() + 10000;
                while (active && (deps.getRenderGeneration?.() === generation || deps.isViewReady?.() !== true)) {
                    if (Date.now() >= deadline) throw new Error('view-unavailable');
                    await new Promise(resolve => win.setTimeout(resolve, 50));
                }
            }
            if (!active) return;
            deps.clearFocus();
            deps.clearFilters?.();
            deps.revealHidden?.(item);
            const folders = getFolders();
            const ids = [...item.ancestors, ...(item.kind === 'folder' ? [item.id] : [])];
            ids.forEach((id) => {
                if (folderRow(id) && folders[id]?.status?.expanded !== true) deps.expand(id);
            });
        };
        const runAction = async (item, action) => {
            if (action === 'edit') return deps.edit(item.id);
            if (action === 'focus') { await prepareReveal(item); if (active) return deps.focus(item.id); return; }
            if (action === 'webui') return deps.openWebui(deps.safeWebui(item.entry.webui));
            if (action === 'console') return win.openTerminal('docker', item.id, item.entry.shell || '/bin/sh');
            if (action === 'logs') return win.openTerminal(type === 'vm' ? 'log' : 'docker', item.id, type === 'vm' ? item.entry.logs : '.log');
            if (action === 'actions') {
                await prepareReveal(item);
                if (!active) return;
                const trigger = nativeTrigger(item);
                trigger?.scrollIntoView({ block: 'nearest' });
                trigger?.click();
            }
        };
        const api = finder.createApi({
            window: win, document: doc, type,
            resolveMount: () => resolveMount(doc, table(), type),
            getEntries: () => finder.buildIndex(getFolders(), deps.getRuntime(), deps.getMembers),
            getActions, isActionEnabled, getState, getIcon, findRow, prepareReveal, runAction,
            onError: deps.onError, onDispose: () => { active = false; }
        });
        return Object.freeze({ ...api, dispose: () => { active = false; api.dispose(); } });
    };
    return Object.freeze({ createApi, resolveMount, findViewToggleAnchor, findVmRows });
}));
