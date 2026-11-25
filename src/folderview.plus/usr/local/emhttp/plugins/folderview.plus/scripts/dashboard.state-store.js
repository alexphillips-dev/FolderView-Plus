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
        const newState = () => ({ pending: new Map(), disk: {}, epoch: '', failedReset: null });
        const states = { docker: newState(), vm: newState() };
        const storageKeys = () => Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(Boolean);
        const resetKey = type => `${EXPANDED_STATE_STORAGE_KEYS[type]}.reset`;
        const entryPrefix = type => `${EXPANDED_STATE_STORAGE_KEYS[type]}.entry.`;
        const getReset = (type) => {
            const raw = storage.getItem(resetKey(type));
            if (raw) {
                try {
                    const reset = JSON.parse(raw);
                    if (/^[A-Za-z0-9-]+$/.test(reset?.epoch || '')) {
                        return { epoch: reset.epoch, baseline: normalizeExpandedStateMap(reset.baseline) };
                    }
                } catch (_error) { /* Fall back to the legacy map. */ }
            }
            return { epoch: 'legacy', baseline: parseMap(storage.getItem(EXPANDED_STATE_STORAGE_KEYS[type])) };
        };

        const read = (type) => {
            const resolvedType = normalizeType(type), state = states[resolvedType];
            try {
                if (storage && !state.failedReset) {
                    const { epoch, baseline } = getReset(resolvedType);
                    const prefix = `${entryPrefix(resolvedType)}${epoch}.`;
                    const entries = [];
                    for (const key of storageKeys()) {
                        if (!key.startsWith(prefix)) continue;
                        const value = storage.getItem(key);
                        if (value === '1' || value === '0') {
                            try { entries.push([decodeURIComponent(key.slice(prefix.length)), value === '1']); }
                            catch (_error) { /* Ignore malformed storage keys. */ }
                        }
                    }
                    if (state.epoch !== epoch) state.pending.clear();
                    state.epoch = epoch;
                    state.disk = { ...baseline, ...Object.fromEntries(entries) };
                }
            } catch (_error) {
                // Keep the current session usable when browser storage becomes unavailable.
            }
            return { ...state.disk, ...Object.fromEntries([...state.pending].map(([id, draft]) => [id, draft.value])) };
        };

        const queue = (type, id, value) => {
            const state = states[type], epoch = state.epoch || 'legacy';
            const key = `${entryPrefix(type)}${epoch}.${encodeURIComponent(id)}`;
            const draft = { value };
            state.pending.set(id, draft);
            const serialize = () => {
                if (state.pending.get(id) !== draft || state.failedReset || getReset(type).epoch !== epoch) {
                    throw new Error('Dashboard expansion write was superseded.');
                }
                return value ? '1' : '0';
            };
            const committed = () => {
                state.disk = { ...state.disk, [id]: value };
                if (state.pending.get(id) === draft) state.pending.delete(id);
            };
            try {
                if (typeof writer?.updateItem === 'function') {
                    writer.updateItem(key, serialize, { delayMs: 80, idle: true, onCommit: committed });
                } else {
                    storage.setItem(key, serialize());
                    committed();
                }
                return true;
            } catch (_error) {
                return false;
            }
        };

        const write = (type, map) => {
            if (!storage) return false;
            const resolvedType = normalizeType(type), state = states[resolvedType];
            const reset = { epoch: utilityFoundation.createSecureRuntimeId('reset'), baseline: normalizeExpandedStateMap(map) };
            state.pending.clear();
            state.disk = reset.baseline;
            state.epoch = reset.epoch;
            state.failedReset = reset;
            try {
                const obsolete = storageKeys().filter(key => key.startsWith(entryPrefix(resolvedType)));
                storage.setItem(resetKey(resolvedType), JSON.stringify(reset));
                state.failedReset = null;
                for (const key of obsolete) {
                    try { storage.removeItem(key); } catch (_error) { /* Retired entries are ignored. */ }
                }
                return true;
            } catch (_error) {
                return false;
            }
        };

        const patch = (type, changes) => {
            if (!storage) return false;
            const resolvedType = normalizeType(type);
            const state = states[resolvedType];
            const current = read(resolvedType);
            const dirty = Object.entries(normalizeExpandedStateMap(changes)).filter(([id, expanded]) => current[id] !== expanded);
            if (!dirty.length) return false;
            if (state.failedReset) return write(resolvedType, { ...current, ...Object.fromEntries(dirty) });
            for (const [id, expanded] of dirty) queue(resolvedType, id, expanded);
            // Include earlier drafts whose asynchronous write may have failed.
            const changed = new Set(dirty.map(([id]) => id));
            for (const [id, draft] of state.pending) {
                if (!changed.has(id)) queue(resolvedType, id, draft.value);
            }
            return true;
        };

        const clear = (type) => write(type, {});

        return Object.freeze({ read, write, patch, clear });
    };

    return Object.freeze({
        EXPANDED_STATE_STORAGE_KEYS,
        normalizeExpandedStateMap,
        createStore
    });
}));
