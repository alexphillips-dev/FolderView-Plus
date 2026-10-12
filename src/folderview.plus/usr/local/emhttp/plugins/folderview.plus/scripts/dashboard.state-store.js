// @ts-check
(function dashboardStateStoreModule(root, factory) {
    const fallbackWindow = typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : {});
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(fallbackWindow, require('./folderviewplus.utils-foundation.js'));
        return;
    }
    root.FolderViewPlusDashboardStateStore = factory(fallbackWindow, root.FolderViewPlusFoundationModules?.utilityFoundation);
    root.FolderViewPlusDashboardStateStoreModuleLoaded = true;
}(typeof window !== 'undefined' ? window : {}, function dashboardStateStoreFactory(fallbackWindow, utilityFoundation) {
    'use strict';

    const EXPANDED_STATE_STORAGE_KEYS = Object.freeze({
        docker: 'fvplus.runtime.expand.dashboard.docker.v1',
        vm: 'fvplus.runtime.expand.dashboard.vm.v1'
    });
    const normalizeType = (type) => type === 'vm' ? 'vm' : 'docker';
    const normalizeExpandedStateMap = (value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
        return Object.fromEntries(Object.entries(value).flatMap(([rawId, expanded]) => {
            const id = String(rawId || '').trim();
            return id ? [[id, expanded === true]] : [];
        }));
    };

    const createStore = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        const storage = utilityFoundation.resolveBrowserStorage(deps.storage, win);
        const writer = deps.writer || null;
        const maps = {}, stored = {};

        const read = (type) => {
            const resolvedType = normalizeType(type), storageKey = EXPANDED_STATE_STORAGE_KEYS[resolvedType];
            try {
                let raw = storage?.getItem?.(storageKey) ?? null;
                if (maps[resolvedType] && raw !== stored[resolvedType]) {
                    // Settle queued local writes before adopting current external storage.
                    writer?.flush?.(storageKey);
                    raw = storage?.getItem?.(storageKey) ?? null;
                }
                if (!maps[resolvedType] || raw !== stored[resolvedType]) {
                    try { maps[resolvedType] = raw ? normalizeExpandedStateMap(JSON.parse(raw)) : {}; }
                    catch (_error) { maps[resolvedType] = {}; }
                    stored[resolvedType] = raw;
                }
            } catch (_error) {
                // Keep the current session usable when browser storage becomes unavailable.
            }
            return { ...(maps[resolvedType] || {}) };
        };

        const write = (type, map) => {
            if (!storage) return false;
            const resolvedType = normalizeType(type), storageKey = EXPANDED_STATE_STORAGE_KEYS[resolvedType];
            read(resolvedType);
            maps[resolvedType] = normalizeExpandedStateMap(map);
            const payload = JSON.stringify(maps[resolvedType]);
            try {
                if (writer && typeof writer.setItem === 'function') {
                    writer.setItem(storageKey, payload, { delayMs: 80, idle: true });
                } else {
                    storage?.setItem?.(storageKey, payload);
                }
                return true;
            } catch (_error) {
                return false;
            }
        };

        const patch = (type, changes) => {
            if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return false;
            const current = read(type);
            let dirty = false;
            Object.entries(changes).forEach(([rawId, expanded]) => {
                const id = String(rawId || '').trim();
                if (!id) return;
                const nextValue = expanded === true;
                if (current[id] === nextValue) return;
                current[id] = nextValue;
                dirty = true;
            });
            return dirty ? write(type, current) : false;
        };

        const clear = (type) => {
            if (!storage) return false;
            const resolvedType = normalizeType(type), storageKey = EXPANDED_STATE_STORAGE_KEYS[resolvedType];
            maps[resolvedType] = {};
            try {
                writer?.removeItem?.(storageKey, { delayMs: 0, idle: false });
                storage?.removeItem?.(storageKey);
                stored[resolvedType] = null;
                return true;
            } catch (_error) {
                return false;
            }
        };

        return Object.freeze({ read, write, patch, clear });
    };

    return Object.freeze({
        EXPANDED_STATE_STORAGE_KEYS,
        normalizeExpandedStateMap,
        createStore
    });
}));
