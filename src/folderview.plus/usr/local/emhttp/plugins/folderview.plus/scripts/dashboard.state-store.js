// @ts-check
(function dashboardStateStoreModule(root, factory) {
    const fallbackWindow = typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : {});
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(fallbackWindow);
        return;
    }
    root.FolderViewPlusDashboardStateStore = factory(fallbackWindow);
    root.FolderViewPlusDashboardStateStoreModuleLoaded = true;
}(typeof window !== 'undefined' ? window : {}, function dashboardStateStoreFactory(fallbackWindow) {
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
        const storage = deps.storage || win.localStorage || null;
        const writer = deps.writer || null;

        const read = (type) => {
            const storageKey = EXPANDED_STATE_STORAGE_KEYS[normalizeType(type)];
            try {
                const raw = storage?.getItem?.(storageKey);
                return raw ? normalizeExpandedStateMap(JSON.parse(raw)) : {};
            } catch (_error) {
                return {};
            }
        };

        const write = (type, map) => {
            const storageKey = EXPANDED_STATE_STORAGE_KEYS[normalizeType(type)];
            const payload = JSON.stringify(normalizeExpandedStateMap(map));
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
            const storageKey = EXPANDED_STATE_STORAGE_KEYS[normalizeType(type)];
            try {
                storage?.removeItem?.(storageKey);
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
