// @ts-check
(function dockerRuntimeApiCoordinatorModule(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./docker.runtime.container-model.js'), require('./docker.runtime.api-integration.js'));
        return;
    }
    root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    root.FolderViewPlusFoundationModules.dockerApiCoordinator = factory(root.FolderViewPlusDockerContainerModel, root.FolderViewPlusFoundationModules.dockerApiIntegration);
}(typeof window !== 'undefined' ? window : {}, function dockerRuntimeApiCoordinatorFactory(containerModel, integrationModule) {
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
            ? { ...container.labels }
            : { ...asObject(source.Labels || asObject(info.Config).Labels) };
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
            name: normalizeName(container.name) || normalizeName(source.name), id: String(container.id || source.id || '').trim(),
            shortId: String(container.shortId || source.shortId || '').trim(),
            state: String(container.state || source.state || '').trim(), status: String(container.status || source.status || '').trim(),
            running: flags.running, paused: flags.paused,
            autostart: container.autoStart === true,
            Labels: labels, info: {
                ...info,
                Id: String(container.id || info.Id || '').trim(),
                Config: { ...asObject(info.Config), Labels: labels }, State: nextState
            }
        };
        if (fields.image === true && container.image) {
            next.image = next.Image = String(container.image).trim();
            next.info.Config.Image = next.image;
        }
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
            running: state.Running === true, paused: state.Paused === true,
            status: String(state.Status || ''), autostart: state.Autostart === true,
            updated: typeof state.Updated === 'boolean' ? state.Updated : null,
            orphaned: entry.isOrphaned === true,
            rebuild: typeof entry.isRebuildReady === 'boolean' ? entry.isRebuildReady : null,
            labels: Object.entries(asObject(entry.Labels || asObject(asObject(entry.info).Config).Labels)).sort(([a], [b]) => a.localeCompare(b)),
            image: String(entry.image ?? entry.Image ?? asObject(asObject(entry.info).Config).Image ?? ''),
            webui: String(state.WebUi || ''), icon: String(entry.icon || '')
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
        const getRuntimeGeneration = typeof deps.getRuntimeGeneration === 'function' ? deps.getRuntimeGeneration : () => null;
        const onStatus = typeof deps.onStatus === 'function' ? deps.onStatus : () => {};
        const onIdentityMismatch = typeof deps.onIdentityMismatch === 'function' ? deps.onIdentityMismatch : () => {};
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
        const isCurrent = (activeGeneration, runtimeGeneration, options = {}) => !disposed
            && activeGeneration === generation && runtimeGeneration === getRuntimeGeneration()
            && options.isCurrent?.() !== false;
        const run = (work) => {
            if (inFlight) return inFlight;
            const currentGeneration = ++generation;
            const runtimeGeneration = getRuntimeGeneration();
            const Controller = deps.AbortController
                || (typeof AbortController !== 'undefined' ? AbortController : null);
            abortController = Controller ? new Controller() : null;
            inFlight = Promise.resolve()
                .then(() => work({ generation: currentGeneration, runtimeGeneration, signal: abortController?.signal }))
                .finally(() => {
                    if (currentGeneration === generation) abortController = null;
                    inFlight = null;
                });
            return inFlight;
        };
        const applyContainers = (containers, options = {}) => {
            if (!isCurrent(options.generation, options.runtimeGeneration, options)) return { applied: false, stale: true };
            const merged = mergeProviderContainers(getRuntimeMap(), containers, capabilitySnapshot());
            if (merged.structuralChanged) {
                onIdentityMismatch({ providerOnlyCount: merged.providerOnlyCount, runtimeOnlyCount: merged.runtimeOnlyCount, hostReloadRequested: false });
                return { applied: false, structuralChanged: true, ...merged };
            }
            if (merged.changed.length > 0) applyRuntimeMap(merged.runtimeMap, merged);
            resetFailure();
            lastSource = 'unraid-graphql';
            lastSuccessAt = new Date(now()).toISOString();
            publishStatus();
            return { applied: true, structuralChanged: false, ...merged };
        };
        const refreshAll = (options = {}) => run(async ({ generation: activeGeneration, runtimeGeneration, signal }) => {
            if (!isCurrent(activeGeneration, runtimeGeneration, options)) return { applied: false, stale: true };
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
                return applyContainers(containers, { ...options, generation: activeGeneration, runtimeGeneration });
            } catch (error) {
                if (!isCurrent(activeGeneration, runtimeGeneration, options)) return { applied: false, stale: true };
                recordFailure(error);
                if (options.fallback !== false && !NON_FAILURES.has(normalizeCategory(error))) {
                    await requestLegacyFallback({ reason: normalizeCategory(error) });
                }
                return { applied: false, fallback: options.fallback !== false, errorCategory: normalizeCategory(error) };
            }
        });
        const reconcileContainer = (identity, options = {}) => run(async ({ generation: activeGeneration, runtimeGeneration, signal }) => {
            if (!isCurrent(activeGeneration, runtimeGeneration, options)) return { applied: false, stale: true };
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
                if (!isCurrent(activeGeneration, runtimeGeneration, options)) return { applied: false, stale: true };
                const currentMap = getRuntimeMap();
                const key = findRuntimeKey(entry, currentMap);
                if (!key) {
                    onIdentityMismatch({ targeted: true, providerOnlyCount: 1, runtimeOnlyCount: 0, hostReloadRequested: false });
                    return { applied: false, structuralChanged: true };
                }
                const mergedEntry = mergeContainerIntoRuntimeEntry(currentMap[key], entry, capabilitySnapshot());
                const changed = runtimeStateSignature(mergedEntry) !== runtimeStateSignature(currentMap[key]);
                if (!isCurrent(activeGeneration, runtimeGeneration, options)) return { applied: false, stale: true };
                if (changed) applyRuntimeMap({ ...currentMap, [key]: mergedEntry }, {
                    changed: [key], structuralChanged: false, matchedCount: 1
                });
                resetFailure();
                lastSource = 'unraid-graphql-targeted';
                lastSuccessAt = new Date(now()).toISOString();
                publishStatus();
                return { applied: true, changed: changed ? [key] : [], structuralChanged: false };
            } catch (error) {
                if (!isCurrent(activeGeneration, runtimeGeneration, options)) return { applied: false, stale: true };
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
            if (disposed) return null;
            if (selected && typeof selected.ready === 'function') {
                await selected.ready({
                    ...options,
                    timeoutMs: Math.max(1000, Number(options.timeoutMs) || 4000)
                });
            }
            if (disposed) return null;
            if (options.refresh !== false) await refreshAll({ fallback: false, staleKey: 'docker-api-coordinator-prepare' });
            return selected || provider();
        };
        const recheck = async (options = {}) => {
            if (disposed) return { applied: false, stale: true };
            resetFailure();
            await provider()?.ready?.({ ...options, force: true });
            if (disposed) return { applied: false, stale: true };
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

    // Preserve the public facade while one module owns integration lifecycle state.
    const createIntegration = (deps = {}) => integrationModule.createIntegration({
        ...deps, createCoordinator: () => createCoordinator(deps)
    });

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
