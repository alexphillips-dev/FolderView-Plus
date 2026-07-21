// @ts-check
(function dashboardHostAdapterModule(root, factory) {
    const fallbackWindow = typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : {});
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(fallbackWindow);
        return;
    }
    root.FolderViewPlusDashboardHostAdapter = factory(fallbackWindow);
    root.FolderViewPlusDashboardHostAdapterModuleLoaded = true;
}(typeof window !== 'undefined' ? window : {}, function dashboardHostAdapterFactory(fallbackWindow) {
    'use strict';

    const DASHBOARD_APPS_PATH = '/webGui/include/DashboardApps.php';
    const registry = new WeakMap();

    const isoNow = () => new Date().toISOString();
    const normalizePathname = (value, baseHref = 'http://localhost/') => {
        const raw = String(value || '').trim();
        if (!raw) return '';
        try {
            return new URL(raw, baseHref).pathname.replace(/\/{2,}/g, '/');
        } catch (_error) {
            return raw.split(/[?#]/, 1)[0].replace(/\/{2,}/g, '/');
        }
    };
    const isDashboardAppsRequest = (value, baseHref) => (
        normalizePathname(value, baseHref) === DASHBOARD_APPS_PATH
    );

    const createAdapter = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        const doc = deps.document || win.document || null;
        const jquery = deps.$ || win.jQuery || win.$ || null;
        const runtimeAdapters = deps.runtimeHostAdapters || win.FolderViewPlusRuntimeHostAdapters || null;
        const runtimeHostAdapter = deps.runtimeHostAdapter
            || runtimeAdapters?.getOrCreate?.('docker', { window: win, document: doc })
            || null;
        const prepareFolderRequests = typeof deps.prepareFolderRequests === 'function'
            ? deps.prepareFolderRequests
            : () => [];
        const renderFolders = typeof deps.renderFolders === 'function'
            ? deps.renderFolders
            : () => Promise.resolve(false);
        const hideSpinner = typeof deps.hideSpinner === 'function'
            ? deps.hideSpinner
            : () => jquery?.('div.spinner.fixed')?.hide?.();
        const onEvent = typeof deps.onEvent === 'function' ? deps.onEvent : () => {};
        const maxEvents = Math.max(10, Number(deps.maxEvents || 60));
        const events = [];
        const state = {
            bound: false,
            loadlistBound: false,
            prefilterBound: false,
            disposed: false,
            generation: 0,
            foldersGrouped: false,
            renderGeneration: 0,
            nativeRequestCount: 0,
            nativeRowsLoadedCount: 0,
            foldersGroupedCount: 0,
            runtimeActionCompletedCount: 0,
            staleCompletionCount: 0,
            renderFailureCount: 0,
            lastNativeRowsLoadedAt: null,
            lastFoldersGroupedAt: null,
            lastRuntimeActionCompletedAt: null,
            lastError: null
        };

        const emit = (name, details = {}) => {
            const event = {
                name: String(name || 'dashboardEvent'),
                generation: state.generation,
                capturedAt: isoNow(),
                ...details
            };
            events.push(event);
            if (events.length > maxEvents) events.splice(0, events.length - maxEvents);
            onEvent(event);
            if (typeof win.CustomEvent === 'function' && typeof win.dispatchEvent === 'function') {
                win.dispatchEvent(new win.CustomEvent(`fvplus:dashboard:${event.name}`, { detail: event }));
            }
            return event;
        };

        const beginGeneration = (reason = 'native-loadlist') => {
            state.generation += 1;
            state.foldersGrouped = false;
            state.renderGeneration = 0;
            state.lastError = null;
            emit('nativeRowsLoading', { reason });
            return state.generation;
        };

        const markNativeRowsLoaded = (generation, details = {}) => {
            if (generation !== state.generation) {
                state.staleCompletionCount += 1;
                emit('staleNativeRowsIgnored', { requestGeneration: generation, ...details });
                return false;
            }
            state.nativeRowsLoadedCount += 1;
            state.lastNativeRowsLoadedAt = isoNow();
            emit('nativeRowsLoaded', details);
            return true;
        };

        const markFoldersGrouped = (generation, details = {}) => {
            if (generation !== state.generation) {
                state.staleCompletionCount += 1;
                emit('staleFolderRenderIgnored', { requestGeneration: generation, ...details });
                return false;
            }
            state.foldersGrouped = true;
            state.foldersGroupedCount += 1;
            state.lastFoldersGroupedAt = isoNow();
            state.lastError = null;
            emit('foldersGrouped', details);
            return true;
        };

        const markRenderFailed = (generation, error) => {
            if (generation !== state.generation) return false;
            state.foldersGrouped = false;
            state.renderGeneration = 0;
            state.renderFailureCount += 1;
            state.lastError = String(error?.message || error || 'Dashboard folder render failed.');
            emit('folderRenderFailed', { message: state.lastError });
            return true;
        };

        const handleNativeRowsResponse = (generation, requestUrl) => {
            if (!markNativeRowsLoaded(generation, { requestUrl })) return Promise.resolve(false);
            if (state.foldersGrouped || state.renderGeneration === generation) return Promise.resolve(false);
            state.renderGeneration = generation;
            return Promise.resolve(renderFolders({ generation, requestUrl }))
                .then((rendered) => {
                    if (rendered === false) {
                        state.renderGeneration = 0;
                        return false;
                    }
                    return markFoldersGrouped(generation, { requestUrl });
                })
                .catch((error) => {
                    markRenderFailed(generation, error);
                    throw error;
                })
                .finally(() => {
                    hideSpinner();
                });
        };

        const bindLoadlist = () => {
            if (state.loadlistBound) return true;
            if (!runtimeHostAdapter || typeof runtimeHostAdapter.wrapHook !== 'function') return false;
            runtimeHostAdapter.wrapHook('loadlist', ({ args, invokeOriginal }) => {
                if (state.disposed) return invokeOriginal(...args);
                beginGeneration('loadlist');
                prepareFolderRequests('docker');
                prepareFolderRequests('vm');
                return invokeOriginal(...args);
            }, { legacyAlias: 'loadlist_original' });
            state.loadlistBound = true;
            return true;
        };

        const bindAjaxPrefilter = () => {
            if (state.prefilterBound) return true;
            if (!jquery || typeof jquery.ajaxPrefilter !== 'function') return false;
            jquery.ajaxPrefilter((options = {}, _originalOptions, jqXHR) => {
                if (state.disposed || !isDashboardAppsRequest(options.url, win.location?.href)) return;
                const generation = state.generation > 0 ? state.generation : beginGeneration('dashboard-apps-request');
                const requestUrl = String(options.url || DASHBOARD_APPS_PATH);
                state.nativeRequestCount += 1;
                const promise = typeof jqXHR?.promise === 'function' ? jqXHR.promise() : jqXHR;
                Promise.resolve(promise)
                    .then(() => handleNativeRowsResponse(generation, requestUrl))
                    .catch(() => {
                        // Render failures are recorded by handleNativeRowsResponse. Native request
                        // failures remain owned by Unraid and must not produce an unhandled rejection.
                    });
            });
            state.prefilterBound = true;
            return true;
        };

        const bind = () => {
            if (state.bound) return api;
            const loadlistBound = bindLoadlist();
            const prefilterBound = bindAjaxPrefilter();
            state.bound = loadlistBound || prefilterBound;
            emit('adapterBound', { loadlistBound, prefilterBound });
            return api;
        };

        const notifyRuntimeActionCompleted = (details = {}) => {
            state.runtimeActionCompletedCount += 1;
            state.lastRuntimeActionCompletedAt = isoNow();
            return emit('runtimeActionCompleted', details);
        };

        const getSnapshot = () => ({
            schemaVersion: 1,
            bound: state.bound,
            loadlistBound: state.loadlistBound,
            prefilterBound: state.prefilterBound,
            disposed: state.disposed,
            generation: state.generation,
            foldersGrouped: state.foldersGrouped,
            renderGeneration: state.renderGeneration,
            nativeRequestCount: state.nativeRequestCount,
            nativeRowsLoadedCount: state.nativeRowsLoadedCount,
            foldersGroupedCount: state.foldersGroupedCount,
            runtimeActionCompletedCount: state.runtimeActionCompletedCount,
            staleCompletionCount: state.staleCompletionCount,
            renderFailureCount: state.renderFailureCount,
            lastNativeRowsLoadedAt: state.lastNativeRowsLoadedAt,
            lastFoldersGroupedAt: state.lastFoldersGroupedAt,
            lastRuntimeActionCompletedAt: state.lastRuntimeActionCompletedAt,
            lastError: state.lastError,
            events: events.slice(),
            runtimeHost: runtimeHostAdapter?.getSnapshot?.() || null
        });

        const dispose = (options = {}) => {
            state.disposed = true;
            state.bound = false;
            if (options.restoreLoadlist === true && state.loadlistBound) {
                runtimeHostAdapter?.restoreHook?.('loadlist');
            }
            emit('adapterDisposed');
        };

        const api = Object.freeze({
            bind,
            bindLoadlist,
            bindAjaxPrefilter,
            beginGeneration,
            isFoldersGrouped: () => state.foldersGrouped,
            markFoldersGrouped,
            markRenderFailed,
            notifyRuntimeActionCompleted,
            getSnapshot,
            dispose
        });
        return api;
    };

    const getOrCreate = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        if (!registry.has(win)) registry.set(win, createAdapter(deps));
        return registry.get(win);
    };

    const release = (options = {}) => {
        const win = options.window || fallbackWindow;
        const adapter = registry.get(win);
        if (!adapter) return false;
        adapter.dispose({ restoreLoadlist: options.restoreLoadlist === true });
        registry.delete(win);
        return true;
    };

    return Object.freeze({
        DASHBOARD_APPS_PATH,
        normalizePathname,
        isDashboardAppsRequest,
        createAdapter,
        getOrCreate,
        release
    });
}));
