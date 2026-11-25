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
    const parseMap = (raw) => {
        try { return raw ? normalizeExpandedStateMap(JSON.parse(raw)) : {}; }
        catch (_error) { return {}; }
    };

    const createStore = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        const storage = utilityFoundation.resolveBrowserStorage(deps.storage, win);
        const writer = deps.writer || null;
        const maps = {}, stored = {}, pending = {};

        const read = (type) => {
            const resolvedType = normalizeType(type), storageKey = EXPANDED_STATE_STORAGE_KEYS[resolvedType];
            try {
                const raw = storage?.getItem?.(storageKey) ?? null;
                if (!maps[resolvedType] || raw !== stored[resolvedType]) {
                    maps[resolvedType] = parseMap(raw);
                    stored[resolvedType] = raw;
                }
            } catch (_error) {
                // Keep the current session usable when browser storage becomes unavailable.
            }
            const draft = pending[resolvedType];
            return { ...(draft?.replace ? {} : maps[resolvedType]), ...draft?.changes };
        };

        const queue = (type, draft) => {
            const storageKey = EXPANDED_STATE_STORAGE_KEYS[type];
            pending[type] = draft;
            const serialize = (raw) => JSON.stringify({ ...(draft.replace ? {} : parseMap(raw)), ...draft.changes });
            const committed = (payload) => {
                maps[type] = parseMap(payload);
                stored[type] = payload;
                if (pending[type] === draft) delete pending[type];
            };
            const options = { delayMs: 80, idle: true };
            try {
                if (typeof writer?.updateItem === 'function') {
                    writer.updateItem(storageKey, serialize, { ...options, onCommit: committed });
                } else {
                    const payload = serialize(storage.getItem(storageKey));
                    if (typeof writer?.setItem === 'function') writer.setItem(storageKey, payload, options);
                    else storage.setItem(storageKey, payload);
                    committed(payload);
                }
                return true;
            } catch (_error) {
                return false;
            }
        };
        const write = (type, map) => storage ? queue(normalizeType(type), { replace: true, changes: normalizeExpandedStateMap(map) }) : false;

        const patch = (type, changes) => {
            if (!storage) return false;
            const resolvedType = normalizeType(type);
            const current = read(resolvedType), draft = pending[resolvedType];
            const dirty = Object.entries(normalizeExpandedStateMap(changes)).filter(([id, expanded]) => current[id] !== expanded);
            return dirty.length ? queue(resolvedType, {
                replace: draft?.replace === true, changes: { ...draft?.changes, ...Object.fromEntries(dirty) }
            }) : false;
        };

        const clear = (type) => {
            if (!storage) return false;
            const resolvedType = normalizeType(type), storageKey = EXPANDED_STATE_STORAGE_KEYS[resolvedType];
            delete pending[resolvedType];
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
