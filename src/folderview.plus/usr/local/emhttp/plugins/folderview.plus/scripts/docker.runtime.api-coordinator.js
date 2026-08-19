// @ts-check
(function dockerRuntimeApiCoordinatorModule(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./docker.runtime.container-model.js'));
        return;
    }
    root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    root.FolderViewPlusFoundationModules.dockerApiCoordinator = factory(root.FolderViewPlusDockerContainerModel);
}(typeof window !== 'undefined' ? window : {}, function dockerRuntimeApiCoordinatorFactory(containerModel) {
    'use strict';

    const PERMANENT_FAILURES = new Set([
        'authentication-required',
        'permission-denied',
        'capability-unavailable',
        'fetch-unavailable'
    ]);
    const NON_FAILURES = new Set(['aborted', 'stale-response']);
    const TRANSIENT_COOLDOWNS_MS = Object.freeze([15000, 30000, 60000, 120000, 300000]);

    const asObject = (value) => (
        value && typeof value === 'object' && !Array.isArray(value) ? value : {}
    );
    const normalizeName = (value) => String(value || '').trim().replace(/^\/+/, '');
    const normalizeCategory = (error) => String(error?.category || 'request-failed').trim() || 'request-failed';
    const stateFlags = (state) => {
        const normalized = String(state || '').trim().toLowerCase();
        return {
            running: normalized === 'running' || normalized === 'paused',
            paused: normalized === 'paused'
        };
    };
    const runtimeIdentity = (entry = {}, fallbackName = '') => {
        const source = asObject(entry);
        const info = asObject(source.info);
        return String(source.id || source.shortId || info.Id || fallbackName || '').trim();
    };
    const findRuntimeKey = (container, runtimeMap = {}) => {
        const names = new Set([
            container?.name,
            ...(Array.isArray(container?.names) ? container.names : [])
        ].map(normalizeName).filter(Boolean));
        for (const key of Object.keys(runtimeMap)) {
            if (names.has(normalizeName(key))) return key;
        }
        const containerId = String(container?.id || container?.shortId || '').split(':').pop() || '';
        if (!containerId) return '';
        const matches = Object.entries(runtimeMap).filter(([key, entry]) => {
            const candidate = runtimeIdentity(entry, key).replace(/^sha256:/i, '').split(':').pop() || '';
            return candidate === containerId
                || (containerId.length >= 8 && candidate.startsWith(containerId))
                || (candidate.length >= 8 && containerId.startsWith(candidate));
        });
        return matches.length === 1 ? matches[0][0] : '';
    };
    const mergeContainerIntoRuntimeEntry = (current = {}, container = {}, capabilities = {}) => {
        const source = asObject(current);
        const info = asObject(source.info);
        const previousState = asObject(info.State);
        const fields = asObject(capabilities.containerFields);
        const flags = stateFlags(container.state);
        const labels = fields.labels === true && container.labels && typeof container.labels === 'object'
            ? { ...asObject(source.Labels), ...container.labels }
            : { ...asObject(source.Labels) };
        const nextState = {
            ...previousState,
            Running: flags.running,
            Paused: flags.paused,
            Status: String(container.status || previousState.Status || '').trim(),
            Autostart: container.autoStart === true
        };
        if (fields.isUpdateAvailable === true && typeof container.isUpdateAvailable === 'boolean') {
            nextState.Updated = container.isUpdateAvailable !== true;
        }
        if (fields.webUiUrl === true && container.webUiUrl !== null) {
            nextState.WebUi = String(container.webUiUrl || '').trim();
        }
        const next = {
            ...source,
            name: normalizeName(container.name) || normalizeName(source.name),
            id: String(container.id || source.id || '').trim(),
            shortId: String(container.shortId || source.shortId || '').trim(),
            state: String(container.state || source.state || '').trim(),
            status: String(container.status || source.status || '').trim(),
            running: flags.running,
            paused: flags.paused,
            autostart: container.autoStart === true,
            Labels: labels,
            info: {
                ...info,
                Id: String(container.id || info.Id || '').trim(),
                State: nextState
            }
        };
        if (fields.image === true) next.image = String(container.image || source.image || '').trim();
        if (fields.iconUrl === true && container.iconUrl !== null) {
            next.icon = String(container.iconUrl || source.icon || '').trim();
        }
        if (fields.isOrphaned === true) next.isOrphaned = container.isOrphaned === true;
        if (fields.isRebuildReady === true && typeof container.isRebuildReady === 'boolean') {
            next.isRebuildReady = container.isRebuildReady;
        }
        return next;
    };
    const runtimeStateSignature = (entry = {}) => {
        const state = asObject(asObject(entry.info).State);
        return JSON.stringify({
            id: runtimeIdentity(entry),
            running: state.Running === true,
            paused: state.Paused === true,
            status: String(state.Status || ''),
            autostart: state.Autostart === true,
            updated: typeof state.Updated === 'boolean' ? state.Updated : null,
            orphaned: entry.isOrphaned === true,
            rebuild: typeof entry.isRebuildReady === 'boolean' ? entry.isRebuildReady : null
        });
    };
    const mergeProviderContainers = (runtimeMap = {}, containers = [], capabilities = {}) => {
        const sourceMap = asObject(runtimeMap);
        const nextMap = { ...sourceMap };
        const matchedKeys = new Set();
        const unmatchedProviderNames = [];
        const changed = [];
        for (const rawContainer of Array.isArray(containers) ? containers : []) {
            const container = rawContainer?.schemaVersion === 1
                ? rawContainer
                : containerModel?.normalizeContainer?.(rawContainer, { source: 'unraid-graphql' });
            if (!container) continue;
            const key = findRuntimeKey(container, sourceMap);
            if (!key) {
                unmatchedProviderNames.push(normalizeName(container.name));
                continue;
            }
            matchedKeys.add(key);
            const merged = mergeContainerIntoRuntimeEntry(sourceMap[key], container, capabilities);
            nextMap[key] = merged;
            if (runtimeStateSignature(merged) !== runtimeStateSignature(sourceMap[key])) changed.push(key);
        }
        const unmatchedRuntimeKeys = Object.keys(sourceMap).filter((key) => !matchedKeys.has(key));
        return Object.freeze({
            runtimeMap: nextMap,
            changed: Object.freeze(changed),
            structuralChanged: unmatchedProviderNames.length > 0 || unmatchedRuntimeKeys.length > 0,
            providerOnlyCount: unmatchedProviderNames.length,
            runtimeOnlyCount: unmatchedRuntimeKeys.length,
            matchedCount: matchedKeys.size
        });
    };

    const createCoordinator = (deps = {}) => {
        const providerRegistry = deps.providerRegistry || null;
        const now = typeof deps.now === 'function' ? deps.now : Date.now;
        const getRuntimeMap = typeof deps.getRuntimeMap === 'function' ? deps.getRuntimeMap : () => ({});
        const applyRuntimeMap = typeof deps.applyRuntimeMap === 'function' ? deps.applyRuntimeMap : () => true;
        const requestLegacyFallback = typeof deps.requestLegacyFallback === 'function'
            ? deps.requestLegacyFallback
            : async () => false;
        const requestStructuralRefresh = typeof deps.requestStructuralRefresh === 'function'
            ? deps.requestStructuralRefresh
            : () => {};
        const onStatus = typeof deps.onStatus === 'function' ? deps.onStatus : () => {};
        let disposed = false;
        let generation = 0;
        let inFlight = null;
        let abortController = null;
        let consecutiveFailures = 0;
        let cooldownUntil = 0;
        let permanentlyUnavailable = false;
        let lastErrorCategory = null;
        let lastSuccessAt = null;
        let lastSource = 'not-checked';
        let structuralRefreshPending = false;
        const status = () => Object.freeze({
            schemaVersion: 1,
            state: disposed
                ? 'disposed'
                : (permanentlyUnavailable
                    ? 'unavailable'
                    : (now() < cooldownUntil ? 'cooldown' : (lastSuccessAt ? 'ready' : 'not-checked'))),
            source: lastSource,
            lastSuccessAt,
            lastErrorCategory,
            consecutiveFailures,
            cooldownRemainingMs: cooldownUntil === Number.MAX_SAFE_INTEGER
                ? null
                : Math.max(0, cooldownUntil - now()),
            requestInFlight: Boolean(inFlight),
            structuralRefreshPending
        });
        const publishStatus = () => {
            try {
                onStatus(status());
            } catch (_error) {
                // Diagnostics must never interfere with runtime reconciliation.
            }
        };

        const provider = () => providerRegistry?.getDefault?.() || null;
        const capabilitySnapshot = () => (
            provider()?.getCapabilities?.()
            || provider()?.getCapabilitySnapshot?.()
            || deps.transport?.getCapabilitySnapshot?.()
            || {}
        );
        const available = () => {
            const active = provider();
            return !disposed
                && !permanentlyUnavailable
                && now() >= cooldownUntil
                && active
                && typeof active.listContainers === 'function'
                && active.supports?.('query.containers') !== false;
        };
        const resetFailure = () => {
            consecutiveFailures = 0;
            cooldownUntil = 0;
            permanentlyUnavailable = false;
            lastErrorCategory = null;
        };
        const recordFailure = (error) => {
            const category = normalizeCategory(error);
            lastErrorCategory = category;
            if (NON_FAILURES.has(category)) return;
            consecutiveFailures += 1;
            if (PERMANENT_FAILURES.has(category)) {
                permanentlyUnavailable = true;
                cooldownUntil = Number.MAX_SAFE_INTEGER;
                publishStatus();
                return;
            }
            const index = Math.min(TRANSIENT_COOLDOWNS_MS.length - 1, consecutiveFailures - 1);
            cooldownUntil = now() + TRANSIENT_COOLDOWNS_MS[index];
            publishStatus();
        };
        const scheduleStructuralRefresh = (details) => {
            if (structuralRefreshPending || disposed) return;
            structuralRefreshPending = true;
            Promise.resolve().then(() => requestStructuralRefresh(details)).finally(() => {
                structuralRefreshPending = false;
            });
        };
        const run = (work) => {
            if (inFlight) return inFlight;
            const currentGeneration = ++generation;
            const Controller = deps.AbortController
                || (typeof AbortController !== 'undefined' ? AbortController : null);
            abortController = Controller ? new Controller() : null;
            inFlight = Promise.resolve()
                .then(() => work({ generation: currentGeneration, signal: abortController?.signal }))
                .finally(() => {
                    if (currentGeneration === generation) abortController = null;
                    inFlight = null;
                });
            return inFlight;
        };
        const applyContainers = (containers, options = {}) => {
            if (disposed || options.generation !== generation) return { applied: false, stale: true };
            const merged = mergeProviderContainers(getRuntimeMap(), containers, capabilitySnapshot());
            if (merged.structuralChanged) {
                return { applied: false, structuralChanged: true, ...merged };
            }
            if (merged.changed.length > 0) applyRuntimeMap(merged.runtimeMap, merged);
            resetFailure();
            lastSource = 'unraid-graphql';
            lastSuccessAt = new Date(now()).toISOString();
            publishStatus();
            return { applied: true, structuralChanged: false, ...merged };
        };
        const refreshAll = (options = {}) => run(async ({ generation: activeGeneration, signal }) => {
            if (!available()) {
                if (options.fallback !== false) await requestLegacyFallback({ reason: 'api-unavailable' });
                return { applied: false, fallback: options.fallback !== false, unavailable: true };
            }
            try {
                const containers = await provider().listContainers({
                    signal,
                    timeoutMs: Math.max(1000, Number(options.timeoutMs) || 6000),
                    staleKey: String(options.staleKey || 'docker-api-coordinator-list')
                });
                return applyContainers(containers, { generation: activeGeneration });
            } catch (error) {
                recordFailure(error);
                if (options.fallback !== false && !NON_FAILURES.has(normalizeCategory(error))) {
                    await requestLegacyFallback({ reason: normalizeCategory(error) });
                }
                return { applied: false, fallback: options.fallback !== false, errorCategory: normalizeCategory(error) };
            }
        });
        const reconcileContainer = (identity, options = {}) => run(async ({ generation: activeGeneration, signal }) => {
            if (!available()) {
                if (options.fallback !== false) await requestLegacyFallback({ reason: 'api-unavailable', identity });
                return { applied: false, fallback: options.fallback !== false, unavailable: true };
            }
            try {
                const activeProvider = provider();
                const entry = typeof activeProvider.reconcileContainer === 'function'
                    ? await activeProvider.reconcileContainer(identity, {
                        signal,
                        timeoutMs: Math.max(1000, Number(options.timeoutMs) || 6000),
                        staleKey: `docker-api-coordinator-container:${String(identity || '')}`
                    })
                    : null;
                if (!entry) throw Object.assign(new Error('Targeted container reconciliation returned no data.'), {
                    category: 'empty-response'
                });
                const currentMap = getRuntimeMap();
                const key = findRuntimeKey(entry, currentMap);
                if (!key) {
                    scheduleStructuralRefresh({ reason: 'api-target-identity-missing' });
                    return { applied: false, structuralChanged: true };
                }
                const mergedEntry = mergeContainerIntoRuntimeEntry(currentMap[key], entry, capabilitySnapshot());
                const changed = runtimeStateSignature(mergedEntry) !== runtimeStateSignature(currentMap[key]);
                if (activeGeneration !== generation || disposed) return { applied: false, stale: true };
                if (changed) applyRuntimeMap({ ...currentMap, [key]: mergedEntry }, {
                    changed: [key], structuralChanged: false, matchedCount: 1
                });
                resetFailure();
                lastSource = 'unraid-graphql-targeted';
                lastSuccessAt = new Date(now()).toISOString();
                publishStatus();
                return { applied: true, changed: changed ? [key] : [], structuralChanged: false };
            } catch (error) {
                recordFailure(error);
                if (options.fallback !== false && !NON_FAILURES.has(normalizeCategory(error))) {
                    await requestLegacyFallback({ reason: normalizeCategory(error), identity });
                }
                return { applied: false, fallback: options.fallback !== false, errorCategory: normalizeCategory(error) };
            }
        });
        const prepare = async (options = {}) => {
            if (disposed) return null;
            const selected = await providerRegistry?.prepare?.(options);
            if (selected && typeof selected.ready === 'function') {
                await selected.ready({
                    ...options,
                    timeoutMs: Math.max(1000, Number(options.timeoutMs) || 4000)
                });
            }
            if (options.refresh !== false) await refreshAll({ fallback: false, staleKey: 'docker-api-coordinator-prepare' });
            return selected || provider();
        };
        const recheck = async (options = {}) => {
            resetFailure();
            await provider()?.ready?.({ ...options, force: true });
            return refreshAll({ ...options, fallback: false });
        };
        const dispose = () => {
            if (disposed) return;
            disposed = true;
            generation += 1;
            abortController?.abort?.();
            abortController = null;
            inFlight = null;
            publishStatus();
        };
        return Object.freeze({
            prepare,
            refreshAll,
            reconcileContainer,
            recheck,
            status,
            dispose
        });
    };

    const createIntegration = (deps = {}) => {
        let coordinator = null;
        let preparePromise = null;
        const getCoordinator = () => {
            if (!coordinator) coordinator = createCoordinator(deps);
            return coordinator;
        };
        const prepare = (options = {}) => {
            if (!preparePromise) {
                preparePromise = Promise.resolve(getCoordinator().prepare({
                    ...(deps.prepareOptions || {}),
                    refresh: false
                })).catch((error) => {
                    preparePromise = null;
                    throw error;
                });
            }
            return preparePromise.then(async () => {
                if (options.refresh === true) {
                    await getCoordinator().refreshAll({
                        fallback: false,
                        staleKey: String(options.staleKey || 'docker-api-initial-enrichment')
                    });
                }
                return getCoordinator();
            });
        };
        const refresh = async (options = {}) => {
            const active = await prepare();
            const identity = String(options.containerId || options.container || '').trim();
            const run = () => identity
                ? active.reconcileContainer(identity, { fallback: false })
                : active.refreshAll({
                    fallback: false,
                    staleKey: String(options.staleKey || 'docker-api-runtime-refresh')
                });
            const result = await run();
            const followupDelayMs = Math.max(0, Number(options.followupDelayMs) || 0);
            if (result?.applied === true && followupDelayMs > 0) {
                deps.setTimeout?.(() => Promise.resolve(run()).catch(() => {}), followupDelayMs);
            }
            return result?.applied === true;
        };
        const tick = async (options = {}) => {
            let configSnapshot = null;
            try {
                configSnapshot = await deps.readConfigSnapshot?.();
            } catch (_error) {
                configSnapshot = null;
            }
            if (configSnapshot && deps.isConfigCurrent?.(configSnapshot) === false) {
                deps.requestStructuralRefresh?.({ reason: 'config-revision-changed' });
                return true;
            }
            return refresh(options);
        };
        const dispose = () => {
            coordinator?.dispose();
            coordinator = null;
            preparePromise = null;
        };
        return Object.freeze({ prepare, refresh, tick, status: () => coordinator?.status() || null, dispose });
    };

    return Object.freeze({
        PERMANENT_FAILURES,
        TRANSIENT_COOLDOWNS_MS,
        findRuntimeKey,
        mergeContainerIntoRuntimeEntry,
        mergeProviderContainers,
        createCoordinator,
        createIntegration
    });
}));
