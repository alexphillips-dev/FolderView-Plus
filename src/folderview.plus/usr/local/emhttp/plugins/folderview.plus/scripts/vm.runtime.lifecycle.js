// @ts-check
(function vmRuntimeLifecycleModule(root, factory) {
    const fallbackWindow = typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : {});
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(fallbackWindow);
        return;
    }
    root.FolderViewPlusVmRuntimeLifecycle = factory(fallbackWindow);
    root.FolderViewPlusVmRuntimeLifecycleModuleLoaded = true;
}(typeof window !== 'undefined' ? window : {}, function vmRuntimeLifecycleFactory(fallbackWindow) {
    'use strict';

    const VM_LIFECYCLE_STORAGE_KEY = 'fv.support.bundle.vm.lifecycle.v1';
    const VM_LIFECYCLE_CALLBACK_NAME = '__fvplusVmLifecycleRefresh';
    const VM_LIFECYCLE_DELAYS_MS = Object.freeze([0, 500, 1250, 2500]);
    const VM_DISPATCH_HOOKS = Object.freeze([
        'ajaxVMDispatch',
        'ajaxVMDispatchconsole',
        'ajaxVMDispatchconsoleRV'
    ]);
    const VM_TRANSIENT_ICON_CLASSES = Object.freeze([
        'fa-refresh',
        'fa-spin',
        'fa-spinner',
        'fa-circle-o-notch'
    ]);
    const HOST_ICON_CLASSES_ATTRIBUTE = 'data-fvplus-vm-host-icon-classes';
    const HOST_ICON_STYLE_ATTRIBUTE = 'data-fvplus-vm-host-icon-style';
    const MAX_DIAGNOSTIC_EVENTS = 60;

    const ACTION_INTENTS = Object.freeze({
        'domain-start': 'start',
        'domain-start-console': 'start',
        'domain-start-consolerv': 'start',
        'domain-stop': 'stop',
        'domain-destroy': 'stop',
        'domain-pause': 'pause',
        'domain-pmsuspend': 'pause',
        'domain-resume': 'resume',
        'domain-pmwakeup': 'resume',
        'domain-restart': 'restart'
    });

    const isoNow = () => new Date().toISOString();
    const normalizeAction = (value) => String(value || '').trim().toLowerCase();
    const normalizeRequest = (request = {}) => {
        const action = normalizeAction(request?.action);
        const uuid = String(request?.uuid || request?.container || '').trim();
        const intent = ACTION_INTENTS[action] || '';
        return intent && uuid ? { action, intent, uuid } : null;
    };
    const normalizeRequests = (requests) => {
        const source = Array.isArray(requests) ? requests : [requests];
        const seen = new Set();
        return source.flatMap((request) => {
            const normalized = normalizeRequest(request);
            if (!normalized) return [];
            const key = `${normalized.action}:${normalized.uuid}`;
            if (seen.has(key)) return [];
            seen.add(key);
            return [normalized];
        });
    };
    const stateForEntry = (entry = {}) => String(entry?.state || 'unknown').trim().toLowerCase();
    const defaultIsSettled = (request, entry) => {
        if (!request || !entry) return false;
        const state = stateForEntry(entry);
        if (request.intent === 'start' || request.intent === 'resume' || request.intent === 'restart') {
            return state === 'running';
        }
        if (request.intent === 'pause') {
            return state === 'paused' || state === 'pmsuspended' || state === 'unknown';
        }
        if (request.intent === 'stop') {
            return state !== 'running' && state !== 'paused' && state !== 'pmsuspended' && state !== 'unknown';
        }
        return false;
    };
    const countBy = (events, key) => events.reduce((counts, event) => {
        const value = String(event?.[key] || 'unknown');
        counts[value] = (counts[value] || 0) + 1;
        return counts;
    }, {});

    const createApi = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        const hostAdapter = deps.hostAdapter || null;
        const refreshRuntimeStateInPlace = typeof deps.refreshRuntimeStateInPlace === 'function'
            ? deps.refreshRuntimeStateInPlace
            : (() => Promise.resolve(false));
        const getRuntimeEntry = typeof deps.getRuntimeEntry === 'function'
            ? deps.getRuntimeEntry
            : (() => null);
        const getSurfaces = typeof deps.getSurfaces === 'function'
            ? deps.getSurfaces
            : (() => []);
        const syncRuntimeState = typeof deps.syncRuntimeState === 'function'
            ? deps.syncRuntimeState
            : (() => {});
        const queueNativeRefresh = typeof deps.queueNativeRefresh === 'function'
            ? deps.queueNativeRefresh
            : (() => {});
        const isSettled = typeof deps.isSettled === 'function'
            ? deps.isSettled
            : ((request) => defaultIsSettled(request, getRuntimeEntry(request.uuid)));
        const shouldTrackRequest = typeof deps.shouldTrackRequest === 'function'
            ? deps.shouldTrackRequest
            : (() => true);
        const storage = deps.storage || win.localStorage || null;
        const requestedCallbackName = String(deps.callbackName || '').trim();
        const callbackName = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(requestedCallbackName)
            ? requestedCallbackName
            : VM_LIFECYCLE_CALLBACK_NAME;
        const delaysMs = Array.isArray(deps.delaysMs) && deps.delaysMs.length > 0
            ? Object.freeze(deps.delaysMs.map((delay) => Math.max(0, Number(delay) || 0)))
            : VM_LIFECYCLE_DELAYS_MS;
        const events = [];
        const requestQueue = [];
        const boundHooks = new Set();
        let generation = 0;
        let activeGeneration = 0;
        let finalizedGeneration = 0;
        let fallbackCount = 0;
        let staleGenerationCount = 0;
        let bound = false;
        let latest = null;
        let pending = [];

        const schedule = (handler, delayMs) => {
            const setTimer = typeof win?.setTimeout === 'function' ? win.setTimeout.bind(win) : setTimeout;
            return setTimer(handler, Math.max(0, Number(delayMs) || 0));
        };
        const collectSurfaceSnapshot = (requests = pending) => {
            const surfaces = requests.flatMap((request) => Array.from(getSurfaces(request) || []));
            const unique = Array.from(new Set(surfaces.filter(Boolean)));
            const icons = unique.flatMap((surface) => Array.from(surface?.querySelectorAll?.('i') || []));
            return {
                surfaceCount: unique.length,
                iconCount: icons.length,
                capturedIconCount: icons.filter((icon) => icon.hasAttribute?.(HOST_ICON_CLASSES_ATTRIBUTE)).length,
                busyIconCount: icons.filter((icon) => VM_TRANSIENT_ICON_CLASSES.some((name) => icon.classList?.contains?.(name))).length
            };
        };
        const persist = () => {
            if (!storage || typeof storage.setItem !== 'function') return false;
            const record = {
                schemaVersion: 1,
                strategy: 'state-aware-incremental',
                updatedAt: isoNow(),
                generation,
                activeGeneration,
                fallbackCount,
                staleGenerationCount,
                eventGroups: countBy(events, 'eventType'),
                latest,
                pending: pending.map((request) => ({ ...request })),
                surface: collectSurfaceSnapshot(),
                hostAdapter: hostAdapter?.getSnapshot?.() || null,
                events: events.slice(-MAX_DIAGNOSTIC_EVENTS)
            };
            try {
                storage.setItem(VM_LIFECYCLE_STORAGE_KEY, JSON.stringify(record));
                return true;
            } catch (_error) {
                return false;
            }
        };
        const emit = (eventType, details = {}) => {
            const event = { eventType: String(eventType || 'vmLifecycleEvent'), capturedAt: isoNow(), ...details };
            events.push(event);
            if (events.length > MAX_DIAGNOSTIC_EVENTS) events.splice(0, events.length - MAX_DIAGNOSTIC_EVENTS);
            latest = event;
            persist();
            return event;
        };
        const captureSurface = (request) => {
            const surfaces = Array.from(getSurfaces(request) || []);
            surfaces.forEach((surface) => {
                Array.from(surface?.querySelectorAll?.('i') || []).forEach((icon) => {
                    if (!icon.hasAttribute(HOST_ICON_CLASSES_ATTRIBUTE)) {
                        icon.setAttribute(HOST_ICON_CLASSES_ATTRIBUTE, String(icon.getAttribute('class') || ''));
                        icon.setAttribute(HOST_ICON_STYLE_ATTRIBUTE, String(icon.getAttribute('style') || ''));
                    }
                    icon.setAttribute('aria-busy', 'true');
                });
            });
            emit('lifecycleSurfacePrepared', { action: request.action, intent: request.intent, uuid: request.uuid, surfaceCount: surfaces.length });
            return surfaces.length > 0;
        };
        const restoreSurface = (request) => {
            const surfaces = Array.from(getSurfaces(request) || []);
            surfaces.forEach((surface) => {
                Array.from(surface?.querySelectorAll?.('i') || []).forEach((icon) => {
                    if (icon.hasAttribute(HOST_ICON_CLASSES_ATTRIBUTE)) {
                        icon.setAttribute('class', String(icon.getAttribute(HOST_ICON_CLASSES_ATTRIBUTE) || ''));
                        const style = String(icon.getAttribute(HOST_ICON_STYLE_ATTRIBUTE) || '');
                        if (style) icon.setAttribute('style', style);
                        else icon.removeAttribute('style');
                        icon.removeAttribute(HOST_ICON_CLASSES_ATTRIBUTE);
                        icon.removeAttribute(HOST_ICON_STYLE_ATTRIBUTE);
                    } else {
                        VM_TRANSIENT_ICON_CLASSES.forEach((className) => icon.classList?.remove?.(className));
                    }
                    icon.removeAttribute('aria-busy');
                });
            });
            syncRuntimeState(request);
            return surfaces.length > 0;
        };
        const finalize = (requestGeneration, requests, outcome = {}) => {
            if (requestGeneration !== activeGeneration || requestGeneration === finalizedGeneration) return false;
            finalizedGeneration = requestGeneration;
            pending = [];
            requests.forEach((request) => restoreSurface(request));
            if (outcome.settled !== true) {
                fallbackCount += 1;
                schedule(() => queueNativeRefresh({ reason: 'vm-lifecycle-attempts-exhausted', requests }), 0);
                emit('lifecycleNativeRefreshFallback', {
                    generation: requestGeneration,
                    requestCount: requests.length,
                    reason: String(outcome.reason || 'attempts-exhausted')
                });
            }
            emit('lifecycleSurfaceFinalized', {
                generation: requestGeneration,
                requestCount: requests.length,
                action: requests.length === 1 ? requests[0].action : 'batch',
                reason: String(outcome.reason || 'settled'),
                settled: outcome.settled === true,
                success: outcome.success === true,
                attempt: Number(outcome.attempt || 0),
                observedStates: requests.map((request) => ({
                    uuid: request.uuid,
                    state: stateForEntry(getRuntimeEntry(request.uuid))
                }))
            });
            return true;
        };
        const run = (requests, options = {}) => {
            const normalized = normalizeRequests(requests);
            if (normalized.length === 0) return Promise.resolve({ settled: false, skipped: true });
            const requestGeneration = ++generation;
            activeGeneration = requestGeneration;
            finalizedGeneration = 0;
            pending = normalized.map((request) => ({ ...request }));
            normalized.forEach(captureSurface);
            emit('lifecycleRefreshScheduled', {
                generation: requestGeneration,
                source: String(options.source || 'native-dispatch'),
                requestCount: normalized.length,
                actions: normalized.map((request) => request.action),
                attempts: delaysMs.length
            });
            return new Promise((resolve) => {
                const attempt = (attemptIndex) => {
                    if (requestGeneration !== activeGeneration) {
                        staleGenerationCount += 1;
                        emit('lifecycleStaleGenerationCancelled', { generation: requestGeneration, attempt: attemptIndex + 1 });
                        resolve({ settled: false, canceled: true });
                        return;
                    }
                    const delayMs = delaysMs[attemptIndex] ?? 0;
                    schedule(() => {
                        if (requestGeneration !== activeGeneration) {
                            staleGenerationCount += 1;
                            emit('lifecycleStaleGenerationCancelled', { generation: requestGeneration, attempt: attemptIndex + 1 });
                            resolve({ settled: false, canceled: true });
                            return;
                        }
                        Promise.resolve(refreshRuntimeStateInPlace({
                            preserveGroupedDom: true,
                            lifecycle: true,
                            requests: normalized
                        })).then((success) => {
                            const settled = success === true && normalized.every((request) => isSettled(request, getRuntimeEntry(request.uuid)) === true);
                            emit('lifecycleRefreshResult', {
                                generation: requestGeneration,
                                requestCount: normalized.length,
                                attempt: attemptIndex + 1,
                                delayMs,
                                success: success === true,
                                settled,
                                observedStates: normalized.map((request) => ({ uuid: request.uuid, state: stateForEntry(getRuntimeEntry(request.uuid)) }))
                            });
                            if (settled) {
                                finalize(requestGeneration, normalized, { reason: 'settled', settled: true, success: true, attempt: attemptIndex + 1 });
                                resolve({ settled: true, attempt: attemptIndex + 1 });
                                return;
                            }
                            if (attemptIndex + 1 >= delaysMs.length) {
                                finalize(requestGeneration, normalized, { reason: 'attempts-exhausted', settled: false, success: success === true, attempt: attemptIndex + 1 });
                                resolve({ settled: false, attempt: attemptIndex + 1 });
                                return;
                            }
                            attempt(attemptIndex + 1);
                        }).catch((error) => {
                            emit('lifecycleRefreshResult', {
                                generation: requestGeneration,
                                requestCount: normalized.length,
                                attempt: attemptIndex + 1,
                                delayMs,
                                success: false,
                                settled: false,
                                message: String(error?.message || error || 'VM lifecycle refresh failed')
                            });
                            if (attemptIndex + 1 >= delaysMs.length) {
                                finalize(requestGeneration, normalized, { reason: 'attempts-exhausted', settled: false, success: false, attempt: attemptIndex + 1 });
                                resolve({ settled: false, attempt: attemptIndex + 1 });
                            } else {
                                attempt(attemptIndex + 1);
                            }
                        });
                    }, delayMs);
                };
                attempt(0);
            });
        };
        const enqueueNativeRequest = (request) => {
            const normalized = normalizeRequest(request);
            if (!normalized || shouldTrackRequest(normalized) !== true) return false;
            requestQueue.push(normalized);
            captureSurface(normalized);
            emit('lifecycleDispatchIntercepted', { action: normalized.action, intent: normalized.intent, uuid: normalized.uuid });
            return true;
        };
        const handleNativeCallback = () => {
            const request = requestQueue.shift();
            if (!request) {
                emit('lifecycleCallbackWithoutRequest');
                queueNativeRefresh({ reason: 'vm-lifecycle-callback-without-request', requests: [] });
                return Promise.resolve(false);
            }
            return run([request], { source: 'native-dispatch' });
        };
        const bindDispatchHooks = () => {
            if (!hostAdapter || typeof hostAdapter.wrapHook !== 'function') return false;
            if (typeof win[callbackName] !== 'function') win[callbackName] = handleNativeCallback;
            let wrapped = 0;
            VM_DISPATCH_HOOKS.forEach((hookName) => {
                if (typeof win[hookName] !== 'function') return;
                hostAdapter.wrapHook(hookName, ({ args, invokeOriginal }) => {
                    const request = normalizeRequest(args?.[0]);
                    const refreshTarget = String(args?.[1] || '').trim();
                    if (request && (refreshTarget === 'loadlist' || refreshTarget === callbackName) && enqueueNativeRequest(request)) {
                        args[1] = callbackName;
                    }
                    return invokeOriginal(...args);
                }, { legacyAlias: `${hookName}_original` });
                boundHooks.add(hookName);
                wrapped += 1;
            });
            return wrapped > 0;
        };
        const bindContextStatePatch = () => {
            if (!hostAdapter || typeof hostAdapter.wrapHook !== 'function' || typeof win.addVMContext !== 'function') return false;
            hostAdapter.wrapHook('addVMContext', ({ args, invokeOriginal }) => {
                const name = String(args?.[0] || '').trim();
                const uuid = String(args?.[1] || '').trim();
                const entry = getRuntimeEntry(uuid, name);
                if (entry && stateForEntry(entry)) {
                    args[3] = stateForEntry(entry);
                    emit('lifecycleContextStateResolved', { uuid, state: args[3] });
                }
                return invokeOriginal(...args);
            }, { legacyAlias: 'addVMContext_original' });
            boundHooks.add('addVMContext');
            return true;
        };
        const bind = () => {
            if (bound) return api;
            const dispatchBound = bindDispatchHooks();
            const contextBound = bindContextStatePatch();
            bound = dispatchBound || contextBound;
            emit('lifecycleHooksBound', { dispatchBound, contextBound, hooks: Array.from(boundHooks) });
            return api;
        };
        const getSnapshot = () => ({
            schemaVersion: 1,
            strategy: 'state-aware-incremental',
            bound,
            callbackName,
            generation,
            activeGeneration,
            fallbackCount,
            staleGenerationCount,
            queuedRequestCount: requestQueue.length,
            boundHooks: Array.from(boundHooks),
            latest,
            pending: pending.map((request) => ({ ...request })),
            surface: collectSurfaceSnapshot(),
            eventGroups: countBy(events, 'eventType'),
            events: events.slice()
        });

        const api = Object.freeze({
            bind,
            bindDispatchHooks,
            bindContextStatePatch,
            enqueueNativeRequest,
            handleNativeCallback,
            run,
            getSnapshot,
            normalizeRequest,
            isSettled: (request) => {
                const normalized = normalizeRequest(request);
                return normalized ? isSettled(normalized, getRuntimeEntry(normalized.uuid)) === true : false;
            }
        });
        return api;
    };

    return Object.freeze({
        VM_LIFECYCLE_STORAGE_KEY,
        VM_LIFECYCLE_CALLBACK_NAME,
        VM_LIFECYCLE_DELAYS_MS,
        VM_DISPATCH_HOOKS,
        ACTION_INTENTS,
        normalizeRequest,
        normalizeRequests,
        defaultIsSettled,
        createApi
    });
}));
