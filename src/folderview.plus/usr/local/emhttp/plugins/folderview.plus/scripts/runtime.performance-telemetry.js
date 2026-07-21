// @ts-check
(function runtimePerformanceTelemetryModule(root, factory) {
    const fallbackWindow = typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : {});
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(fallbackWindow);
        return;
    }
    root.FolderViewPlusRuntimePerformanceTelemetry = factory(fallbackWindow);
    root.FolderViewPlusRuntimePerformanceTelemetryModuleLoaded = true;
}(typeof window !== 'undefined' ? window : {}, function runtimePerformanceTelemetryFactory(fallbackWindow) {
    'use strict';

    const STORAGE_PREFIX = 'fv.support.bundle.runtime.performance';
    const ALLOWED_SURFACES = Object.freeze(['docker', 'vm', 'dashboard', 'settings', 'folder-editor']);
    const MAX_EVENTS = 60;
    const MAX_OPERATION_SAMPLES = 30;
    const registry = new WeakMap();

    const normalizeSurface = (value) => {
        const surface = String(value || '').trim().toLowerCase();
        return ALLOWED_SURFACES.includes(surface) ? surface : 'settings';
    };
    const storageKeyForSurface = (surface) => `${STORAGE_PREFIX}.${normalizeSurface(surface)}.v1`;
    const roundMs = (value) => Number(Math.max(0, Number(value) || 0).toFixed(2));
    const nowIso = () => new Date().toISOString();
    const percentile = (values, ratio) => {
        const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
        if (!sorted.length) return 0;
        return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)];
    };
    const sanitizeDetails = (details = {}) => {
        const source = details && typeof details === 'object' && !Array.isArray(details) ? details : {};
        const safe = {};
        Object.entries(source).slice(0, 20).forEach(([key, value]) => {
            const safeKey = String(key || '').replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 48);
            if (!safeKey || /(?:name|uuid|url|path|id)$/i.test(safeKey)) return;
            if (typeof value === 'boolean') safe[safeKey] = value;
            else if (typeof value === 'number' && Number.isFinite(value)) safe[safeKey] = Number(value.toFixed(2));
            else if (typeof value === 'string') safe[safeKey] = value.slice(0, 80);
        });
        return safe;
    };

    const createCollector = (surfaceInput, deps = {}) => {
        const win = deps.window || fallbackWindow;
        const doc = deps.document || win.document || null;
        const surface = normalizeSurface(surfaceInput);
        const debug = deps.debug === true;
        const startedAtEpoch = Date.now();
        const perf = win.performance || null;
        const startedAt = perf && typeof perf.now === 'function' ? perf.now() : 0;
        const marks = new Map();
        const operations = new Map();
        const events = [];
        const milestones = {};
        let mutationObserver = null;
        let mutationRoot = null;
        let resourceObserver = null;
        let longTaskObserver = null;
        let disposed = false;
        let persistTimer = 0;

        const workload = {
            mutations: { callbacks: 0, records: 0, addedNodes: 0, removedNodes: 0 },
            resources: { count: 0, durationMs: 0, maxDurationMs: 0, transferBytes: 0 },
            longTasks: { count: 0, durationMs: 0, maxDurationMs: 0 },
            dom: { totalNodes: 0, folderRows: 0, nativeRows: 0, previewNodes: 0, heapBytes: 0, sampledAt: '' }
        };

        const now = () => (perf && typeof perf.now === 'function' ? perf.now() : Date.now() - startedAtEpoch);
        const elapsed = () => roundMs(now() - startedAt);
        const getStorage = () => {
            if (deps.storage) return deps.storage;
            try {
                return win.localStorage || null;
            } catch (_error) {
                return null;
            }
        };
        const summarizeOperations = () => {
            const result = {};
            operations.forEach((samples, name) => {
                const durations = samples.map((sample) => Number(sample.durationMs)).filter(Number.isFinite);
                if (!durations.length) return;
                const total = durations.reduce((sum, value) => sum + value, 0);
                result[name] = {
                    count: durations.length,
                    lastMs: roundMs(durations[durations.length - 1]),
                    avgMs: roundMs(total / durations.length),
                    maxMs: roundMs(Math.max(...durations)),
                    p50Ms: roundMs(percentile(durations, 0.5)),
                    p95Ms: roundMs(percentile(durations, 0.95))
                };
            });
            return result;
        };
        const getSnapshot = () => ({
            schemaVersion: 1,
            strategy: 'passive-bounded-runtime',
            surface,
            capturedAt: nowIso(),
            sessionAgeMs: Math.max(0, Date.now() - startedAtEpoch),
            milestones: { ...milestones },
            operations: summarizeOperations(),
            workload: JSON.parse(JSON.stringify(workload)),
            eventCount: events.length,
            events: events.slice(-MAX_EVENTS)
        });
        const persist = () => {
            persistTimer = 0;
            const storage = getStorage();
            if (!storage || typeof storage.setItem !== 'function') return false;
            try {
                storage.setItem(storageKeyForSurface(surface), JSON.stringify(getSnapshot()));
                return true;
            } catch (_error) {
                return false;
            }
        };
        const schedulePersist = () => {
            if (persistTimer || disposed) return;
            const setTimer = typeof win.setTimeout === 'function' ? win.setTimeout.bind(win) : setTimeout;
            persistTimer = setTimer(persist, 250);
        };
        const appendEvent = (eventType, name, details = {}) => {
            const event = {
                eventType: String(eventType || 'runtime-event').slice(0, 48),
                name: String(name || '').slice(0, 64),
                elapsedMs: elapsed(),
                capturedAt: nowIso(),
                details: sanitizeDetails(details)
            };
            events.push(event);
            if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
            schedulePersist();
            return event;
        };
        const mark = (nameInput, details = {}) => {
            const name = String(nameInput || '').trim().slice(0, 64);
            if (!name) return 0;
            const atMs = elapsed();
            const safeDetails = sanitizeDetails(details);
            if (!milestones[name]) milestones[name] = { firstMs: atMs, lastMs: atMs, count: 1, details: safeDetails };
            else milestones[name] = { ...milestones[name], lastMs: atMs, count: milestones[name].count + 1, details: safeDetails };
            appendEvent('milestone', name, details);
            if (debug && win.console?.debug) win.console.debug(`[FV_PERF][${surface}] ${name} @${atMs}ms`, safeDetails);
            return atMs;
        };
        const begin = (nameInput) => {
            const name = String(nameInput || '').trim().slice(0, 64);
            if (!name) return 0;
            marks.set(name, now());
            return marks.get(name);
        };
        const end = (nameInput, details = {}) => {
            const name = String(nameInput || '').trim().slice(0, 64);
            const start = marks.get(name);
            if (!name || !Number.isFinite(start)) return 0;
            marks.delete(name);
            const durationMs = roundMs(now() - start);
            const samples = operations.get(name) || [];
            samples.push({ durationMs, capturedAt: nowIso(), details: sanitizeDetails(details) });
            if (samples.length > MAX_OPERATION_SAMPLES) samples.splice(0, samples.length - MAX_OPERATION_SAMPLES);
            operations.set(name, samples);
            appendEvent('operation', name, { ...details, durationMs });
            if (debug && win.console?.debug) win.console.debug(`[FV_PERF][${surface}] ${name}: ${durationMs}ms`, sanitizeDetails(details));
            return durationMs;
        };
        const record = (nameInput, durationMsInput, details = {}) => {
            const name = String(nameInput || '').trim().slice(0, 64);
            const durationMs = roundMs(durationMsInput);
            if (!name || !Number.isFinite(Number(durationMsInput)) || Number(durationMsInput) < 0) return 0;
            const samples = operations.get(name) || [];
            samples.push({ durationMs, capturedAt: nowIso(), details: sanitizeDetails(details) });
            if (samples.length > MAX_OPERATION_SAMPLES) samples.splice(0, samples.length - MAX_OPERATION_SAMPLES);
            operations.set(name, samples);
            appendEvent('operation', name, { ...details, durationMs });
            return durationMs;
        };
        const sampleDom = (reason = 'manual') => {
            const rootNode = mutationRoot || doc?.body || null;
            if (!rootNode || typeof rootNode.querySelectorAll !== 'function') return { ...workload.dom };
            workload.dom = {
                totalNodes: rootNode.querySelectorAll('*').length,
                folderRows: rootNode.querySelectorAll('tr.folder, .folder-showcase-outer').length,
                nativeRows: rootNode.querySelectorAll('tr.sortable:not(.folder), span.outer:not(.folder-docker):not(.folder-vm)').length,
                previewNodes: rootNode.querySelectorAll('.folder-preview-wrapper, .folder-showcase > span.outer').length,
                heapBytes: Math.max(0, Number(perf?.memory?.usedJSHeapSize || 0)),
                sampledAt: nowIso()
            };
            appendEvent('dom-sample', String(reason || 'manual'), workload.dom);
            return { ...workload.dom };
        };
        const observe = (rootNode) => {
            if (mutationObserver && typeof mutationObserver.disconnect === 'function') mutationObserver.disconnect();
            mutationRoot = rootNode && typeof rootNode.querySelectorAll === 'function' ? rootNode : null;
            if (!mutationRoot || typeof win.MutationObserver !== 'function') return false;
            mutationObserver = new win.MutationObserver((records) => {
                workload.mutations.callbacks += 1;
                workload.mutations.records += records.length;
                records.forEach((entry) => {
                    workload.mutations.addedNodes += Number(entry?.addedNodes?.length || 0);
                    workload.mutations.removedNodes += Number(entry?.removedNodes?.length || 0);
                });
                schedulePersist();
            });
            mutationObserver.observe(mutationRoot, { childList: true, subtree: true });
            return true;
        };
        const captureResource = (entry) => {
            const resourceName = String(entry?.name || '');
            if (!resourceName.includes('/plugins/folderview.plus/') && !resourceName.includes('/webGui/include/DashboardApps.php')) return;
            const durationMs = roundMs(entry?.duration || 0);
            workload.resources.count += 1;
            workload.resources.durationMs = roundMs(workload.resources.durationMs + durationMs);
            workload.resources.maxDurationMs = Math.max(workload.resources.maxDurationMs, durationMs);
            workload.resources.transferBytes += Math.max(0, Number(entry?.transferSize || 0));
        };
        const bindPerformanceObservers = () => {
            if (!perf || typeof win.PerformanceObserver !== 'function') return false;
            try {
                resourceObserver = new win.PerformanceObserver((list) => {
                    list.getEntries().forEach(captureResource);
                    schedulePersist();
                });
                resourceObserver.observe({ type: 'resource', buffered: true });
            } catch (_error) {
                resourceObserver = null;
                Array.from(perf.getEntriesByType?.('resource') || []).forEach(captureResource);
            }
            try {
                longTaskObserver = new win.PerformanceObserver((list) => {
                    list.getEntries().forEach((entry) => {
                        const durationMs = roundMs(entry?.duration || 0);
                        workload.longTasks.count += 1;
                        workload.longTasks.durationMs = roundMs(workload.longTasks.durationMs + durationMs);
                        workload.longTasks.maxDurationMs = Math.max(workload.longTasks.maxDurationMs, durationMs);
                    });
                    schedulePersist();
                });
                longTaskObserver.observe({ type: 'longtask', buffered: true });
            } catch (_error) {
                longTaskObserver = null;
            }
            return Boolean(resourceObserver || longTaskObserver);
        };
        const dispose = () => {
            if (disposed) return;
            disposed = true;
            mutationObserver?.disconnect?.();
            resourceObserver?.disconnect?.();
            longTaskObserver?.disconnect?.();
            if (persistTimer && typeof win.clearTimeout === 'function') win.clearTimeout(persistTimer);
            persist();
        };

        bindPerformanceObservers();
        mark('collectorReady');
        if (typeof win.addEventListener === 'function') win.addEventListener('pagehide', persist, { once: true });

        return Object.freeze({
            surface,
            storageKey: storageKeyForSurface(surface),
            mark,
            begin,
            end,
            record,
            observe,
            sampleDom,
            persist,
            getSnapshot,
            dispose
        });
    };

    const getOrCreate = (surfaceInput, deps = {}) => {
        const win = deps.window || fallbackWindow;
        const surface = normalizeSurface(surfaceInput);
        if (!registry.has(win)) registry.set(win, new Map());
        const surfaces = registry.get(win);
        if (!surfaces.has(surface)) surfaces.set(surface, createCollector(surface, { ...deps, window: win }));
        return surfaces.get(surface);
    };
    const getSnapshot = (surfaceInput, win = fallbackWindow) => registry.get(win)?.get(normalizeSurface(surfaceInput))?.getSnapshot?.() || null;
    const getAllSnapshots = (win = fallbackWindow) => {
        const result = {};
        registry.get(win)?.forEach((collector, surface) => { result[surface] = collector.getSnapshot(); });
        return result;
    };

    return Object.freeze({
        STORAGE_PREFIX,
        ALLOWED_SURFACES,
        MAX_EVENTS,
        MAX_OPERATION_SAMPLES,
        normalizeSurface,
        storageKeyForSurface,
        sanitizeDetails,
        createCollector,
        getOrCreate,
        getSnapshot,
        getAllSnapshots
    });
}));
