// @ts-check
(function dockerRuntimeApiIntegrationModule(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    root.FolderViewPlusFoundationModules.dockerApiIntegration = factory();
}(typeof window !== 'undefined' ? window : {}, function dockerRuntimeApiIntegrationFactory() {
    'use strict';

    const createIntegration = (deps = {}) => {
        let coordinator = null;
        let preparePromise = null;
        let disposed = false;
        const getRuntimeGeneration = typeof deps.getRuntimeGeneration === 'function' ? deps.getRuntimeGeneration : () => null;
        const createCurrentCheck = (options = {}) => {
            const runtimeGeneration = getRuntimeGeneration();
            return () => !disposed && runtimeGeneration === getRuntimeGeneration() && options.isCurrent?.() !== false;
        };
        const getCoordinator = () => {
            if (disposed) return null;
            if (!coordinator) {
                if (typeof deps.createCoordinator !== 'function') throw new Error('Docker API coordinator factory is unavailable.');
                coordinator = deps.createCoordinator();
            }
            return coordinator;
        };
        const prepare = (options = {}) => {
            const isCurrent = createCurrentCheck(options);
            if (!isCurrent()) return Promise.resolve(null);
            if (!preparePromise) {
                preparePromise = Promise.resolve(getCoordinator().prepare({
                    ...(deps.prepareOptions || {}), refresh: false
                })).catch((error) => {
                    preparePromise = null;
                    throw error;
                });
            }
            return preparePromise.then(async () => {
                if (!isCurrent()) return null;
                if (options.refresh === true) {
                    await getCoordinator().refreshAll({
                        fallback: false, isCurrent,
                        staleKey: String(options.staleKey || 'docker-api-initial-enrichment')
                    });
                }
                return isCurrent() ? getCoordinator() : null;
            });
        };
        const refresh = async (options = {}) => {
            const isCurrent = createCurrentCheck(options);
            if (!isCurrent()) return false;
            const active = await prepare({ isCurrent });
            if (!active || !isCurrent()) return false;
            const identity = String(options.containerId || options.container || '').trim();
            const run = () => !isCurrent() ? Promise.resolve({ applied: false, stale: true }) : identity
                ? active.reconcileContainer(identity, { fallback: false, isCurrent })
                : active.refreshAll({
                    fallback: false, isCurrent,
                    staleKey: String(options.staleKey || 'docker-api-runtime-refresh')
                });
            const result = await run();
            if (!isCurrent()) return false;
            const followupDelayMs = Math.max(0, Number(options.followupDelayMs) || 0);
            if (result?.applied === true && followupDelayMs > 0) {
                deps.setTimeout?.(() => Promise.resolve(run()).catch(() => {}), followupDelayMs);
            }
            return result?.applied === true;
        };
        const tick = async (options = {}) => {
            const isCurrent = createCurrentCheck(options);
            if (!isCurrent()) return false;
            let configSnapshot = null;
            try { configSnapshot = await deps.readConfigSnapshot?.(); }
            catch (_error) { configSnapshot = null; }
            if (!isCurrent()) return false;
            if (configSnapshot && deps.isConfigCurrent?.(configSnapshot) === false) {
                deps.requestStructuralRefresh?.({ reason: 'config-revision-changed' });
                return true;
            }
            return refresh({ ...options, isCurrent });
        };
        const dispose = () => {
            disposed = true;
            coordinator?.dispose();
            coordinator = null;
            preparePromise = null;
        };
        return Object.freeze({ prepare, refresh, tick, status: () => coordinator?.status() || null, dispose });
    };

    return Object.freeze({ createIntegration });
}));
