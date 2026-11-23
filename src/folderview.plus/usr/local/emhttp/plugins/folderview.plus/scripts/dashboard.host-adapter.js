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
    const WIDGET_TYPES = ['docker', 'vm'];
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
        const hasWidget = typeof deps.hasWidget === 'function' ? deps.hasWidget : () => true;
        const renderFolders = typeof deps.renderFolders === 'function'
            ? deps.renderFolders
            : () => Promise.resolve(false);
        const hideSpinner = typeof deps.hideSpinner === 'function'
            ? deps.hideSpinner
            : () => jquery?.('div.spinner.fixed')?.hide?.();
        const onEvent = typeof deps.onEvent === 'function' ? deps.onEvent : () => {};
        const maxEvents = Math.max(10, Number(deps.maxEvents || 60));
        const events = [];
        const pendingNativeRequests = new Set();
        const state = {
            bound: false,
            loadlistBound: false,
            prefilterBound: false,
            disposed: false,
            generation: 0,
            foldersGrouped: false,
            renderGeneration: 0,
            widgetRenderStates: { docker: 'idle', vm: 'idle' },
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
            state.widgetRenderStates = { docker: 'idle', vm: 'idle' };
            state.lastError = null;
            emit('nativeRowsLoading', { reason });
            // The native success callback replaces both tile bodies. Superseding the
            // previous request also prevents its body from replacing newer grouped rows.
            for (const request of pendingNativeRequests) request.abort?.();
            pendingNativeRequests.clear();
            WIDGET_TYPES.forEach((type) => prepareFolderRequests(type));
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
            if (state.disposed || generation !== state.generation) return false;
            state.foldersGrouped = false;
            state.renderFailureCount += 1;
            state.lastError = String(error?.message || error || 'Dashboard folder render failed.');
            emit('folderRenderFailed', { message: state.lastError });
            return true;
        };
        const handleNativeRowsResponse = async (generation, requestUrl) => {
            if (state.disposed || !markNativeRowsLoaded(generation, { requestUrl })) return false;
            const isCurrent = () => !state.disposed && generation === state.generation;
            if (!isCurrent()) return false;
            if (state.renderGeneration === generation) return false;
            state.renderGeneration = generation;
            const renders = WIDGET_TYPES.map(async (type) => {
                if (!isCurrent()) return;
                if (!hasWidget(type)) {
                    state.widgetRenderStates[type] = 'skipped';
                    return;
                }
                state.widgetRenderStates[type] = 'pending';
                let outcome;
                try {
                    const rendered = await renderFolders({ type, generation, requestUrl, isCurrent });
                    outcome = rendered === false ? 'skipped' : 'ready';
                } catch (_error) {
                    outcome = 'failed';
                }
                if (!isCurrent()) return;
                state.widgetRenderStates[type] = outcome;
                emit('widgetRenderSettled', { type, outcome });
            });
            // Each widget now has its own loading indicator. Keep the ready one usable
            // even if the other request takes a long time to settle.
            if (isCurrent()) hideSpinner();
            await Promise.all(renders);
            if (!isCurrent()) return false;
            if (Object.values(state.widgetRenderStates).includes('failed')) {
                markRenderFailed(generation, new Error('Dashboard widget render failed.'));
                return false;
            }
            return markFoldersGrouped(generation, { requestUrl });
        };

        const bindLoadlist = () => {
            if (state.loadlistBound) return true;
            if (!runtimeHostAdapter || typeof runtimeHostAdapter.wrapHook !== 'function') return false;
            runtimeHostAdapter.wrapHook('loadlist', ({ args, invokeOriginal }) => {
                if (state.disposed) return invokeOriginal(...args);
                beginGeneration('loadlist');
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
                const data = options.data;
                // Unraid uses the same endpoint for the clock synchronization tooltip.
                if (data && (typeof data === 'string' ? new URLSearchParams(data).has('ntp') : Object.hasOwn(data, 'ntp'))) return;
                const generation = state.generation > 0 ? state.generation : beginGeneration('dashboard-apps-request');
                const requestUrl = String(options.url || DASHBOARD_APPS_PATH);
                state.nativeRequestCount += 1;
                const promise = typeof jqXHR?.promise === 'function' ? jqXHR.promise() : jqXHR;
                if (jqXHR) pendingNativeRequests.add(jqXHR);
                Promise.resolve(promise)
                    .then(() => {
                        pendingNativeRequests.delete(jqXHR);
                        return handleNativeRowsResponse(generation, requestUrl);
                    })
                    .catch(() => {
                        // Native request failures remain owned by Unraid.
                        pendingNativeRequests.delete(jqXHR);
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
            widgetRenderStates: { ...state.widgetRenderStates },
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
            pendingNativeRequests.clear();
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
            isDisposed: () => state.disposed,
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
