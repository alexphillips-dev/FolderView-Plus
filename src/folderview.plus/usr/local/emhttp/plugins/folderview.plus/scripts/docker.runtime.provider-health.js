// @ts-check
(function dockerRuntimeProviderHealthModule(root, factory) {
    const fallbackWindow = typeof window !== 'undefined'
        ? window
        : (typeof globalThis !== 'undefined' ? globalThis : {});
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(fallbackWindow);
        return;
    }
    root.FolderViewPlusDockerProviderHealth = factory(fallbackWindow);
}(typeof window !== 'undefined' ? window : {}, function dockerRuntimeProviderHealthFactory(
    fallbackWindow
) {
    'use strict';

    const count = (value) => Math.max(0, Number(value) || 0);
    const translate = (key, fallback, ...params) => fallbackWindow?.FolderViewPlusI18n?.t?.(key, fallback, ...params) || params.reduce((text, value, index) => text.split(`$${index + 1}`).join(String(value)), fallback || key);
    const createController = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        const providerRegistry = deps.providerRegistry
            || win?.FolderViewPlusDockerProviders?.getDefaultRegistry?.()
            || null;
        const refreshMs = Math.max(10000, Number(deps.refreshMs) || 60000);
        let summary = null;
        let refreshPromise = null;
        let lastAttemptAt = 0;
        let disposed = false;
        let abortController = null;

        const provider = () => providerRegistry?.getDefault?.() || null;
        const readProviderSnapshot = () => {
            const current = provider()?.health?.getLastSummary?.();
            if (current && typeof current === 'object' && current.detailsAvailable === true) {
                summary = Object.freeze({ ...current });
            }
            return summary;
        };
        const refresh = (options = {}) => {
            if (disposed) return Promise.resolve(null);
            const current = readProviderSnapshot();
            const now = Date.now();
            if (options.force !== true && now - lastAttemptAt < refreshMs) {
                return Promise.resolve(current);
            }
            if (refreshPromise) return refreshPromise;
            const health = provider()?.health;
            if (typeof health?.getSummary !== 'function') return Promise.resolve(null);
            const Controller = win?.AbortController
                || (typeof AbortController !== 'undefined' ? AbortController : null);
            abortController = Controller ? new Controller() : null;
            lastAttemptAt = now;
            refreshPromise = Promise.resolve()
                .then(() => health.getSummary({
                    timeoutMs: Math.max(1000, Number(options.timeoutMs) || 8000),
                    signal: options.signal || abortController?.signal,
                    staleKey: String(options.staleKey || 'docker-runtime-health')
                }))
                .then((nextSummary) => {
                    if (disposed) return null;
                    summary = nextSummary && typeof nextSummary === 'object'
                        ? Object.freeze({ ...nextSummary })
                        : null;
                    return summary;
                })
                .catch(() => null)
                .finally(() => {
                    refreshPromise = null;
                    abortController = null;
                });
            return refreshPromise;
        };
        const getModel = (options = {}) => {
            const current = readProviderSnapshot();
            if (!current && !refreshPromise) {
                void refresh().then((nextSummary) => {
                    if (!disposed && nextSummary) options.onUpdate?.();
                });
            }
            if (!current?.detailsAvailable) return null;
            const updates = count(current.updateAvailableCount);
            const rebuilds = count(current.rebuildReadyCount);
            const orphaned = count(current.orphanedCount);
            const conflicts = count(current.containerPortConflictCount)
                + count(current.lanPortConflictCount);
            return Object.freeze({
                updates,
                rebuilds,
                orphaned,
                conflicts,
                severity: conflicts > 0
                    ? 'danger'
                    : ((updates > 0 || rebuilds > 0 || orphaned > 0) ? 'warning' : 'healthy'),
                text: translate('docker.health.api-summary',
                    'Docker API: $1 update$2, $3 rebuild-ready, $4 orphaned, $5 port conflict$6',
                    updates, updates === 1 ? '' : 's', rebuilds, orphaned,
                    conflicts, conflicts === 1 ? '' : 's')
            });
        };
        const dispose = () => {
            disposed = true;
            abortController?.abort?.();
            abortController = null;
            summary = null;
            refreshPromise = null;
        };
        return Object.freeze({
            refresh,
            getModel,
            getSnapshot: () => ({
                available: summary?.detailsAvailable === true,
                checkedAt: summary?.checkedAt || null,
                inFlight: Boolean(refreshPromise),
                disposed
            }),
            dispose
        });
    };

    return Object.freeze({
        createController
    });
}));
