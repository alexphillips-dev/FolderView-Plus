(function(root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
        return;
    }
    root.FolderViewPlusPrefsStore = api;
    root.FolderViewPlusPrefsStoreModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function(root) {
    const STORAGE_PREFIX = 'fvplus.prefs.outbox.v1.';
    const CHANNEL_NAME = 'fvplus-prefs-sync-v1';
    const DEFAULT_DEBOUNCE_MS = 90;
    const DEFAULT_RETRY_DELAY_MS = 1200;
    const MAX_CONFLICT_RETRIES = 2;

    const isPlainObject = (value) => (
        value !== null
        && typeof value === 'object'
        && !Array.isArray(value)
        && Object.prototype.toString.call(value) === '[object Object]'
    );

    const cloneValue = (value) => {
        if (Array.isArray(value)) {
            return value.map((entry) => cloneValue(entry));
        }
        if (isPlainObject(value)) {
            return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)]));
        }
        return value;
    };

    const mergePatch = (base, patch) => {
        const source = isPlainObject(base) ? base : {};
        if (!isPlainObject(patch)) {
            return cloneValue(patch);
        }
        const next = { ...source };
        for (const [key, value] of Object.entries(patch)) {
            if (key === '_metadata') {
                continue;
            }
            next[key] = isPlainObject(value)
                ? mergePatch(isPlainObject(source[key]) ? source[key] : {}, value)
                : cloneValue(value);
        }
        return next;
    };

    const cleanPatch = (patch) => {
        if (!isPlainObject(patch)) {
            return {};
        }
        return Object.fromEntries(
            Object.entries(patch)
                .filter(([key]) => key !== '_metadata')
                .map(([key, value]) => [key, cloneValue(value)])
        );
    };

    const patchIsEmpty = (patch) => !isPlainObject(patch) || Object.keys(patch).length === 0;
    const readRevision = (prefs) => Math.max(0, Number.parseInt(String(prefs?._metadata?.prefsRevision ?? '0'), 10) || 0);
    const normalizeType = (value) => (String(value || '').trim().toLowerCase() === 'vm' ? 'vm' : 'docker');
    const createSourceId = () => `prefs-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
    const createMutationId = (sourceId, generation) => `${sourceId}-${Math.max(0, Number(generation) || 0).toString(36)}`.slice(0, 96);
    const isRetryableSyncError = (error) => {
        const status = Number(error?.status || error?.httpStatus || 0);
        return status === 0 || status === 408 || status === 425 || status === 429 || status >= 500;
    };

    const createPreferenceSaveCoordinator = (options = {}) => {
        const normalizePrefs = typeof options.normalizePrefs === 'function' ? options.normalizePrefs : ((value) => value || {});
        const fetchPrefs = typeof options.fetchPrefs === 'function' ? options.fetchPrefs : null;
        const writePrefs = typeof options.writePrefs === 'function' ? options.writePrefs : null;
        const win = options.window || root || null;
        const storage = options.storage || (() => {
            try {
                return win?.localStorage || null;
            } catch (_error) {
                return null;
            }
        })();
        const storagePrefix = String(options.storagePrefix || STORAGE_PREFIX);
        const sourceId = String(options.sourceId || createSourceId());
        const debounceMs = Math.max(0, Number(options.debounceMs ?? DEFAULT_DEBOUNCE_MS) || 0);
        const retryDelayMs = Math.max(250, Number(options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS) || DEFAULT_RETRY_DELAY_MS);
        const setTimer = typeof options.setTimeout === 'function' ? options.setTimeout : setTimeout;
        const clearTimer = typeof options.clearTimeout === 'function' ? options.clearTimeout : clearTimeout;
        const now = typeof options.now === 'function' ? options.now : Date.now;
        const states = new Map();
        const subscribers = new Set();
        let broadcastChannel = null;

        const storageKeyForType = (type) => `${storagePrefix}${normalizeType(type)}`;
        const newState = (type) => ({
            type: normalizeType(type),
            hydrated: false,
            confirmedPrefs: null,
            optimisticPrefs: null,
            pendingPatch: {},
            inFlightPatch: {},
            externalPatch: {},
            generation: 0,
            flushTimer: null,
            retryTimer: null,
            flushing: false,
            conflictRetries: 0,
            failureStreak: 0,
            lastRetryDelayMs: 0,
            waiters: [],
            status: 'saved',
            lastError: '',
            lastMutationId: '',
            lastBackup: null,
            lastSavedAt: '',
            lastLatencyMs: 0,
            stats: {
                queuedMutations: 0,
                requests: 0,
                commits: 0,
                failures: 0,
                conflicts: 0,
                retries: 0,
                coalescedMutations: 0,
                totalLatencyMs: 0,
                maxLatencyMs: 0
            }
        });
        const getState = (type) => {
            const resolvedType = normalizeType(type);
            if (!states.has(resolvedType)) {
                states.set(resolvedType, newState(resolvedType));
            }
            return states.get(resolvedType);
        };

        const buildOptimisticPrefs = (state) => {
            let next = state.confirmedPrefs || normalizePrefs({});
            next = mergePatch(next, state.externalPatch);
            next = mergePatch(next, state.inFlightPatch);
            next = mergePatch(next, state.pendingPatch);
            return normalizePrefs(next);
        };

        const publicSnapshot = (state, includePrefs = true) => ({
            type: state.type,
            status: state.status,
            hydrated: state.hydrated,
            pending: !patchIsEmpty(state.pendingPatch) || !patchIsEmpty(state.inFlightPatch),
            pendingFieldCount: new Set([
                ...Object.keys(state.inFlightPatch || {}),
                ...Object.keys(state.pendingPatch || {})
            ]).size,
            revision: readRevision(state.confirmedPrefs),
            lastError: state.lastError,
            lastMutationId: state.lastMutationId,
            lastBackup: state.lastBackup,
            lastSavedAt: state.lastSavedAt,
            lastLatencyMs: state.lastLatencyMs,
            stats: { ...state.stats },
            ...(includePrefs ? { prefs: state.optimisticPrefs || state.confirmedPrefs || normalizePrefs({}) } : {})
        });

        const emit = (state) => {
            state.optimisticPrefs = buildOptimisticPrefs(state);
            const snapshot = publicSnapshot(state, true);
            for (const subscriber of subscribers) {
                try {
                    subscriber(snapshot);
                } catch (_error) {
                    // A feature subscriber must not stop preference persistence.
                }
            }
            try {
                if (win && typeof win.dispatchEvent === 'function' && typeof win.CustomEvent === 'function') {
                    win.dispatchEvent(new win.CustomEvent('fvplus:prefs-save-state', {
                        detail: publicSnapshot(state, false)
                    }));
                }
            } catch (_error) {
                // Custom events are an optional integration surface.
            }
        };

        const readStoredOutbox = (type) => {
            if (!storage || typeof storage.getItem !== 'function') {
                return null;
            }
            try {
                const parsed = JSON.parse(String(storage.getItem(storageKeyForType(type)) || 'null'));
                if (!isPlainObject(parsed) || Number(parsed.schemaVersion) !== 1 || !isPlainObject(parsed.patch)) {
                    return null;
                }
                return parsed;
            } catch (_error) {
                return null;
            }
        };

        const combinedOwnPatch = (state) => mergePatch(state.inFlightPatch, state.pendingPatch);
        const persistOutbox = (state) => {
            if (!storage) {
                return;
            }
            let patch = combinedOwnPatch(state);
            const existing = readStoredOutbox(state.type);
            if (existing && existing.sourceId !== sourceId && isPlainObject(existing.patch)) {
                patch = mergePatch(existing.patch, patch);
            }
            try {
                if (patchIsEmpty(patch)) {
                    storage.removeItem(storageKeyForType(state.type));
                    return;
                }
                storage.setItem(storageKeyForType(state.type), JSON.stringify({
                    schemaVersion: 1,
                    type: state.type,
                    sourceId,
                    updatedAt: new Date(now()).toISOString(),
                    patch
                }));
            } catch (_error) {
                // Server persistence remains available when browser storage is blocked.
            }
        };

        const restoreOutbox = (state) => {
            const stored = readStoredOutbox(state.type);
            if (!stored || patchIsEmpty(stored.patch)) {
                return false;
            }
            state.pendingPatch = mergePatch(state.pendingPatch, stored.patch);
            state.status = 'sync-pending';
            return true;
        };

        const broadcast = (payload) => {
            try {
                broadcastChannel?.postMessage({ ...payload, sourceId });
            } catch (_error) {
                // Storage events and server hydration remain as fallbacks.
            }
        };

        const reconcile = (type, prefs, settings = {}) => {
            const state = getState(type);
            const normalized = normalizePrefs(prefs || {});
            const incomingRevision = readRevision(normalized);
            const currentRevision = readRevision(state.confirmedPrefs);
            if (!state.hydrated || incomingRevision >= currentRevision || settings.force === true) {
                state.confirmedPrefs = normalized;
                state.hydrated = true;
            }
            if (settings.restoreOutbox !== false && patchIsEmpty(state.pendingPatch) && patchIsEmpty(state.inFlightPatch)) {
                restoreOutbox(state);
            }
            if (patchIsEmpty(state.pendingPatch) && patchIsEmpty(state.inFlightPatch)) {
                state.status = 'saved';
                state.lastError = '';
            }
            emit(state);
            return state.optimisticPrefs;
        };

        const hydrateFromServer = async (type, settings = {}) => {
            if (!fetchPrefs) {
                return getState(type).optimisticPrefs || normalizePrefs({});
            }
            const response = await fetchPrefs(normalizeType(type));
            const prefs = response?.prefs && isPlainObject(response.prefs)
                ? { ...response.prefs, _metadata: response.metadata || response.prefs._metadata || {} }
                : response;
            const optimistic = reconcile(type, prefs || {}, settings);
            const state = getState(type);
            if (!patchIsEmpty(state.pendingPatch) && settings.replay !== false) {
                scheduleFlush(state, 0);
            }
            return optimistic;
        };

        const resolveWaiters = (state, generation, value) => {
            const remaining = [];
            for (const waiter of state.waiters) {
                if (waiter.generation <= generation) {
                    waiter.resolve(value);
                } else {
                    remaining.push(waiter);
                }
            }
            state.waiters = remaining;
        };

        const rejectWaiters = (state, generation, error) => {
            const remaining = [];
            for (const waiter of state.waiters) {
                if (waiter.generation <= generation) {
                    waiter.reject(error);
                } else {
                    remaining.push(waiter);
                }
            }
            state.waiters = remaining;
        };

        const scheduleRetry = (state) => {
            if (state.retryTimer || patchIsEmpty(state.pendingPatch)) {
                return;
            }
            const delayMs = Math.min(30000, retryDelayMs * Math.max(1, 2 ** Math.max(0, state.failureStreak - 1)));
            state.lastRetryDelayMs = delayMs;
            state.retryTimer = setTimer(() => {
                state.retryTimer = null;
                state.stats.retries += 1;
                scheduleFlush(state, 0);
            }, delayMs);
        };

        const runFlush = async (state) => {
            if (state.flushing || patchIsEmpty(state.pendingPatch) || !writePrefs) {
                return;
            }
            if (!state.hydrated && fetchPrefs) {
                try {
                    await hydrateFromServer(state.type, { replay: false });
                } catch (_error) {
                    // The write can still proceed without a revision for legacy servers.
                }
            }

            const batchPatch = state.pendingPatch;
            const batchGeneration = state.generation;
            const mutationId = createMutationId(sourceId, batchGeneration);
            state.pendingPatch = {};
            state.inFlightPatch = batchPatch;
            state.flushing = true;
            state.status = 'saving';
            state.lastMutationId = mutationId;
            persistOutbox(state);
            emit(state);
            const startedAt = now();

            try {
                state.stats.requests += 1;
                const response = await writePrefs(state.type, batchPatch, {
                    expectedRevision: readRevision(state.confirmedPrefs),
                    clientMutationId: mutationId
                });
                if (response?.ok === false) {
                    throw new Error(String(response.error || 'Failed to save preferences.'));
                }
                const savedPrefs = response?.prefs && isPlainObject(response.prefs)
                    ? { ...response.prefs, _metadata: response.metadata || response.prefs._metadata || {} }
                    : response;
                state.confirmedPrefs = normalizePrefs(savedPrefs || mergePatch(state.confirmedPrefs, batchPatch));
                state.lastBackup = response?.backup || null;
                state.inFlightPatch = {};
                state.flushing = false;
                state.conflictRetries = 0;
                state.failureStreak = 0;
                state.lastRetryDelayMs = 0;
                state.stats.commits += 1;
                state.lastLatencyMs = Math.max(0, now() - startedAt);
                state.stats.totalLatencyMs += state.lastLatencyMs;
                state.stats.maxLatencyMs = Math.max(state.stats.maxLatencyMs, state.lastLatencyMs);
                state.lastSavedAt = new Date(now()).toISOString();
                state.lastError = '';
                state.status = patchIsEmpty(state.pendingPatch) ? 'saved' : 'saving';
                persistOutbox(state);
                emit(state);
                resolveWaiters(state, batchGeneration, state.optimisticPrefs);
                broadcast({
                    action: 'committed',
                    type: state.type,
                    mutationId,
                    prefs: state.confirmedPrefs
                });
                if (!patchIsEmpty(state.pendingPatch)) {
                    scheduleFlush(state, 0);
                }
            } catch (error) {
                state.inFlightPatch = {};
                state.flushing = false;
                state.pendingPatch = mergePatch(batchPatch, state.pendingPatch);
                const isConflict = Number(error?.status || error?.httpStatus || 0) === 409;
                if (isConflict && fetchPrefs && state.conflictRetries < MAX_CONFLICT_RETRIES) {
                    state.conflictRetries += 1;
                    state.stats.conflicts += 1;
                    state.status = 'sync-pending';
                    state.lastError = 'Preferences changed in another page. Rebasing pending changes.';
                    persistOutbox(state);
                    emit(state);
                    try {
                        await hydrateFromServer(state.type, { restoreOutbox: false, replay: false, force: true });
                        scheduleFlush(state, 0);
                        return;
                    } catch (refreshError) {
                        error = refreshError;
                    }
                }
                state.stats.failures += 1;
                state.failureStreak += 1;
                state.status = 'sync-pending';
                state.lastError = String(error?.message || error || 'Preference synchronization failed.');
                persistOutbox(state);
                emit(state);
                rejectWaiters(state, batchGeneration, error);
                if (isRetryableSyncError(error)) {
                    scheduleRetry(state);
                }
            }
        };

        function scheduleFlush(state, delayMs = debounceMs) {
            if (state.flushTimer) {
                clearTimer(state.flushTimer);
            }
            state.flushTimer = setTimer(() => {
                state.flushTimer = null;
                runFlush(state);
            }, Math.max(0, Number(delayMs) || 0));
        }

        const save = (type, patch, settings = {}) => {
            const state = getState(type);
            const normalizedPatch = cleanPatch(patch);
            if (patchIsEmpty(normalizedPatch)) {
                return Promise.resolve(state.optimisticPrefs || state.confirmedPrefs || normalizePrefs({}));
            }
            if (!state.hydrated && settings.currentPrefs) {
                reconcile(state.type, settings.currentPrefs, { restoreOutbox: true, force: true });
            }
            if (!patchIsEmpty(state.externalPatch)) {
                state.pendingPatch = mergePatch(state.externalPatch, state.pendingPatch);
                state.externalPatch = {};
            }
            const alreadyPending = !patchIsEmpty(state.pendingPatch);
            state.pendingPatch = mergePatch(state.pendingPatch, normalizedPatch);
            state.generation += 1;
            state.stats.queuedMutations += 1;
            if (alreadyPending || state.flushing) {
                state.stats.coalescedMutations += 1;
            }
            state.status = state.flushing ? 'saving' : 'sync-pending';
            state.lastError = '';
            persistOutbox(state);
            emit(state);
            const promise = new Promise((resolve, reject) => {
                state.waiters.push({ generation: state.generation, resolve, reject });
            });
            scheduleFlush(state, settings.immediate === true ? 0 : debounceMs);
            return promise;
        };

        const flush = (type) => {
            const state = getState(type);
            if (patchIsEmpty(state.pendingPatch) && patchIsEmpty(state.inFlightPatch)) {
                return Promise.resolve(state.optimisticPrefs || state.confirmedPrefs || normalizePrefs({}));
            }
            const promise = new Promise((resolve, reject) => {
                state.waiters.push({ generation: state.generation, resolve, reject });
            });
            if (!patchIsEmpty(state.pendingPatch)) {
                scheduleFlush(state, 0);
            }
            return promise;
        };

        const getDiagnostics = () => {
            const types = {};
            for (const type of ['docker', 'vm']) {
                const state = getState(type);
                const stats = { ...state.stats };
                types[type] = {
                    status: state.status,
                    hydrated: state.hydrated,
                    pending: !patchIsEmpty(state.pendingPatch) || !patchIsEmpty(state.inFlightPatch),
                    pendingFieldCount: new Set([
                        ...Object.keys(state.inFlightPatch || {}),
                        ...Object.keys(state.pendingPatch || {})
                    ]).size,
                    revision: readRevision(state.confirmedPrefs),
                    lastSavedAt: state.lastSavedAt || null,
                    lastLatencyMs: state.lastLatencyMs,
                    averageLatencyMs: stats.commits > 0 ? Math.round(stats.totalLatencyMs / stats.commits) : 0,
                    maxLatencyMs: stats.maxLatencyMs,
                    requests: stats.requests,
                    commits: stats.commits,
                    failures: stats.failures,
                    conflicts: stats.conflicts,
                    retries: stats.retries,
                    failureStreak: state.failureStreak,
                    nextRetryDelayMs: state.lastRetryDelayMs,
                    queuedMutations: stats.queuedMutations,
                    coalescedMutations: stats.coalescedMutations,
                    lastError: state.lastError || null
                };
            }
            return {
                schemaVersion: 1,
                debounceMs,
                retryDelayMs,
                types
            };
        };

        const subscribe = (listener) => {
            if (typeof listener !== 'function') {
                return () => {};
            }
            subscribers.add(listener);
            return () => subscribers.delete(listener);
        };

        const handleStorageEvent = (event) => {
            const key = String(event?.key || '');
            if (!key.startsWith(storagePrefix)) {
                return;
            }
            const type = normalizeType(key.slice(storagePrefix.length));
            const state = getState(type);
            if (!event?.newValue) {
                state.externalPatch = {};
                if (fetchPrefs) {
                    hydrateFromServer(type, { restoreOutbox: false, replay: false, force: true }).catch(() => {});
                } else {
                    emit(state);
                }
                return;
            }
            try {
                const record = JSON.parse(String(event.newValue));
                if (!isPlainObject(record) || record.sourceId === sourceId || !isPlainObject(record.patch)) {
                    return;
                }
                state.externalPatch = record.patch;
                state.status = state.flushing ? 'saving' : 'sync-pending';
                emit(state);
            } catch (_error) {
                // Ignore malformed browser state.
            }
        };

        const handleBroadcast = (event) => {
            const message = event?.data;
            if (!isPlainObject(message) || message.sourceId === sourceId || message.action !== 'committed') {
                return;
            }
            const state = getState(message.type);
            state.externalPatch = {};
            reconcile(message.type, message.prefs || {}, { restoreOutbox: false });
        };

        try {
            const Channel = options.BroadcastChannel || win?.BroadcastChannel;
            if (typeof Channel === 'function') {
                broadcastChannel = new Channel(CHANNEL_NAME);
                broadcastChannel.addEventListener('message', handleBroadcast);
            }
        } catch (_error) {
            broadcastChannel = null;
        }
        try {
            win?.addEventListener?.('storage', handleStorageEvent);
            win?.addEventListener?.('online', () => {
                for (const state of states.values()) {
                    if (!patchIsEmpty(state.pendingPatch) && !state.flushing) {
                        if (state.retryTimer) {
                            clearTimer(state.retryTimer);
                            state.retryTimer = null;
                        }
                        scheduleFlush(state, 0);
                    }
                }
            });
        } catch (_error) {
            // Cross-tab synchronization is best effort.
        }

        return Object.freeze({
            save,
            flush,
            reconcile,
            hydrateFromServer,
            subscribe,
            getSnapshot: (type) => publicSnapshot(getState(type), true),
            getOptimisticPrefs: (type) => getState(type).optimisticPrefs || getState(type).confirmedPrefs || normalizePrefs({}),
            getDiagnostics,
            mergePatch,
            storageKeyForType
        });
    };

    let defaultCoordinator = null;
    const getDefaultCoordinator = (options = {}) => {
        if (defaultCoordinator) {
            return defaultCoordinator;
        }
        const normalizePrefs = typeof options.normalizePrefs === 'function'
            ? options.normalizePrefs
            : (root?.FolderViewPlusUtils?.normalizePrefs || ((value) => value || {}));
        const request = options.request || root?.FolderViewPlusRequest || null;
        defaultCoordinator = createPreferenceSaveCoordinator({
            ...options,
            window: options.window || root,
            normalizePrefs,
            fetchPrefs: options.fetchPrefs || (async (type) => {
                if (!request?.getJson) {
                    throw new Error('Preference request client is unavailable.');
                }
                return request.getJson(`/plugins/folderview.plus/server/prefs.php?type=${type}&_=${Date.now()}`, {
                    retries: 1,
                    retryDelayMs: 220
                });
            }),
            writePrefs: options.writePrefs || (async (type, patch, context = {}) => {
                if (!request?.postJson) {
                    throw new Error('Preference request client is unavailable.');
                }
                const payload = {
                    type,
                    prefs: JSON.stringify(cleanPatch(patch)),
                    clientMutationId: String(context.clientMutationId || '')
                };
                if (Number(context.expectedRevision) > 0) {
                    payload.expectedRevision = Number(context.expectedRevision);
                }
                return request.postJson('/plugins/folderview.plus/server/prefs.php', payload, {
                    retries: 1,
                    retryDelayMs: 260
                });
            })
        });
        return defaultCoordinator;
    };

    return Object.freeze({
        createPreferenceSaveCoordinator,
        getDefaultCoordinator,
        mergePatch,
        cleanPatch,
        isRetryableSyncError,
        STORAGE_PREFIX,
        CHANNEL_NAME
    });
}));
