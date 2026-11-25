// @ts-check
(function vmRuntimeLifecycleModule(root, factory) {
    const fallbackWindow = typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : {});
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(fallbackWindow, require('./folderviewplus.utils-foundation.js'));
        return;
    }
    root.FolderViewPlusVmRuntimeLifecycle = factory(fallbackWindow, root.FolderViewPlusFoundationModules?.utilityFoundation);
    root.FolderViewPlusVmRuntimeLifecycleModuleLoaded = true;
}(typeof window !== 'undefined' ? window : {}, function vmRuntimeLifecycleFactory(fallbackWindow, utilityFoundation) {
    'use strict';

    const VM_LIFECYCLE_STORAGE_KEY = 'fv.support.bundle.vm.lifecycle.v1';
    const VM_LIFECYCLE_CALLBACK_NAME = '__fvplusVmLifecycleRefresh';
    const VM_LIFECYCLE_DELAYS_MS = Object.freeze([0, 500, 1250, 2500]);
    const VM_NATIVE_REQUEST_TIMEOUT_MS = 120000;
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
        const jquery = deps.$ || win.jQuery || win.$;
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
        let disposed = false;
        const isPageCurrent = () => !disposed && (typeof deps.isPageCurrent !== 'function' || deps.isPageCurrent());
        const storage = utilityFoundation.resolveBrowserStorage(deps.storage, win);
        const requestedCallbackName = String(deps.callbackName || '').trim();
        const callbackName = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(requestedCallbackName)
            ? requestedCallbackName
            : VM_LIFECYCLE_CALLBACK_NAME;
        const delaysMs = Array.isArray(deps.delaysMs) && deps.delaysMs.length > 0
            ? Object.freeze(deps.delaysMs.map((delay) => Math.max(0, Number(delay) || 0)))
            : VM_LIFECYCLE_DELAYS_MS;
        const events = [];
        const nativeCallbacks = new Map();
        const owners = new Map();
        const pending = new Map();
        const boundHooks = new Set();
        let generation = 0;
        let fallbackCount = 0;
        let staleGenerationCount = 0;
        let bound = false;
        let latest = null;
        let activeNativeDispatch = null;

        const schedule = (handler, delayMs) => {
            const setTimer = typeof win?.setTimeout === 'function' ? win.setTimeout.bind(win) : setTimeout;
            return setTimer(handler, Math.max(0, Number(delayMs) || 0));
        };
        const collectSurfaceSnapshot = (requests = [...pending.values()]) => {
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
                activeGeneration: generation,
                fallbackCount,
                staleGenerationCount,
                eventGroups: countBy(events, 'eventType'),
                latest,
                pending: [...pending.values()].map((request) => ({ ...request })),
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
        const begin = (requests) => {
            const requestGeneration = ++generation;
            requests.forEach((request) => {
                owners.set(request.uuid, requestGeneration);
                pending.set(request.uuid, request);
                captureSurface(request);
            });
            return requestGeneration;
        };
        const ownedBy = (requestGeneration, requests) => requests.filter((request) => owners.get(request.uuid) === requestGeneration);
        const finalize = (requestGeneration, requests, outcome = {}) => {
            requests.forEach((request) => {
                pending.delete(request.uuid);
                restoreSurface(request);
            });
            if (outcome.settled !== true && outcome.fallback !== false) {
                fallbackCount += 1;
                schedule(() => {
                    const current = ownedBy(requestGeneration, requests);
                    if (isPageCurrent() && current.length) {
                        queueNativeRefresh({ reason: 'vm-lifecycle-attempts-exhausted', requests: current });
                    }
                }, 0);
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
            if (!isPageCurrent()) return Promise.resolve({ settled: false, canceled: true });
            const normalized = normalizeRequests(requests);
            if (normalized.length === 0) return Promise.resolve({ settled: false, skipped: true });
            const requestGeneration = options.requestGeneration ?? begin(normalized);
            const reconcileOnly = options.reconcileOnly === true;
            const currentRequests = () => reconcileOnly ? normalized : ownedBy(requestGeneration, normalized);
            emit('lifecycleRefreshScheduled', {
                generation: requestGeneration,
                source: String(options.source || 'native-dispatch'),
                requestCount: normalized.length,
                actions: normalized.map((request) => request.action),
                attempts: delaysMs.length
            });
            return new Promise((resolve) => {
                const cancelIfSuperseded = (attemptIndex) => {
                    if (!isPageCurrent()) {
                        resolve({ settled: false, canceled: true });
                        return true;
                    }
                    if (currentRequests().length) return false;
                    staleGenerationCount += 1;
                    emit('lifecycleStaleGenerationCancelled', { generation: requestGeneration, attempt: attemptIndex + 1 });
                    resolve({ settled: false, canceled: true });
                    return true;
                };
                const attempt = (attemptIndex) => {
                    if (cancelIfSuperseded(attemptIndex)) return;
                    const delayMs = delaysMs[attemptIndex] ?? 0;
                    schedule(() => {
                        if (cancelIfSuperseded(attemptIndex)) return;
                        Promise.resolve(refreshRuntimeStateInPlace({
                            preserveGroupedDom: true,
                            lifecycle: true,
                            requests: currentRequests()
                        })).then((success) => {
                            if (cancelIfSuperseded(attemptIndex)) return;
                            const current = currentRequests();
                            const settled = success === true && (reconcileOnly || current.every((request) => isSettled(request, getRuntimeEntry(request.uuid)) === true));
                            emit('lifecycleRefreshResult', {
                                generation: requestGeneration,
                                requestCount: current.length,
                                attempt: attemptIndex + 1,
                                delayMs,
                                success: success === true,
                                settled,
                                observedStates: current.map((request) => ({ uuid: request.uuid, state: stateForEntry(getRuntimeEntry(request.uuid)) }))
                            });
                            if (settled) {
                                if (!reconcileOnly) finalize(requestGeneration, current, { reason: 'settled', settled: true, success: true, attempt: attemptIndex + 1 });
                                resolve({ settled: true, attempt: attemptIndex + 1 });
                                return;
                            }
                            if (attemptIndex + 1 >= delaysMs.length) {
                                if (!reconcileOnly) finalize(requestGeneration, current, { reason: 'attempts-exhausted', settled: false, success: success === true, attempt: attemptIndex + 1 });
                                resolve({ settled: false, attempt: attemptIndex + 1 });
                                return;
                            }
                            attempt(attemptIndex + 1);
                        }).catch((error) => {
                            if (cancelIfSuperseded(attemptIndex)) return;
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
                                if (!reconcileOnly) finalize(requestGeneration, currentRequests(), { reason: 'attempts-exhausted', settled: false, success: false, attempt: attemptIndex + 1 });
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
            if (!normalized || !isPageCurrent() || shouldTrackRequest(normalized) !== true) return false;
            const requestGeneration = begin([normalized]);
            const name = `${callbackName}_${requestGeneration}`;
            const callback = () => handleNativeCallback(name);
            nativeCallbacks.set(name, { request: normalized, requestGeneration, callback });
            win[name] = callback;
            emit('lifecycleDispatchIntercepted', { action: normalized.action, intent: normalized.intent, uuid: normalized.uuid });
            return name;
        };
        const removeCallback = (name) => {
            const entry = nativeCallbacks.get(name);
            if (entry && win[name] === entry.callback) delete win[name];
            nativeCallbacks.delete(name);
            return entry;
        };
        const handleNativeCallback = (name) => {
            if (!isPageCurrent()) return Promise.resolve(false);
            const entry = removeCallback(name);
            if (!entry) {
                if (name) return Promise.resolve(false);
                emit('lifecycleCallbackWithoutRequest');
                queueNativeRefresh({ reason: 'vm-lifecycle-callback-without-request', requests: [] });
                return Promise.resolve(false);
            }
            const reconcileOnly = !ownedBy(entry.requestGeneration, [entry.request]).length;
            return run([entry.request], { source: 'native-dispatch', requestGeneration: entry.requestGeneration, reconcileOnly });
        };
        const handleNativeTransportFailure = (name) => {
            const entry = removeCallback(name);
            if (!entry || !isPageCurrent()) return;
            const { request, requestGeneration } = entry;
            if (!ownedBy(requestGeneration, [request]).length) return;
            finalize(requestGeneration, [request], { reason: 'native-transport-failed', settled: false, success: false, fallback: false });
            return run([request], { source: 'native-transport-failed', requestGeneration, reconcileOnly: true });
        };
        const bindDispatchHooks = () => {
            if (!hostAdapter || typeof hostAdapter.wrapHook !== 'function') return false;
            if (typeof win[callbackName] !== 'function') win[callbackName] = handleNativeCallback;
            // The Unraid dispatch functions return no jqXHR. Observe only the
            // request created synchronously by the wrapped dispatch.
            jquery?.ajaxPrefilter?.((settings, original, xhr) => {
                const dispatch = activeNativeDispatch;
                if (!dispatch || original.data !== dispatch.params
                    || settings.url !== '/plugins/dynamix.vm.manager/include/VMajax.php') return;
                if (!settings.timeout) settings.timeout = VM_NATIVE_REQUEST_TIMEOUT_MS;
                xhr.fail(() => handleNativeTransportFailure(dispatch.name));
            });
            let wrapped = 0;
            VM_DISPATCH_HOOKS.forEach((hookName) => {
                if (typeof win[hookName] !== 'function') return;
                hostAdapter.wrapHook(hookName, ({ args, invokeOriginal }) => {
                    const request = normalizeRequest(args?.[0]);
                    const refreshTarget = String(args?.[1] || '').trim();
                    const name = request && (refreshTarget === 'loadlist' || refreshTarget === callbackName)
                        ? enqueueNativeRequest(request) : false;
                    if (!name) return invokeOriginal(...args);
                    args[1] = name;
                    const previousDispatch = activeNativeDispatch;
                    activeNativeDispatch = { name, params: args[0] };
                    try {
                        return invokeOriginal(...args);
                    } catch (error) {
                        handleNativeTransportFailure(name);
                        throw error;
                    } finally {
                        activeNativeDispatch = previousDispatch;
                    }
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
            activeGeneration: generation,
            fallbackCount,
            staleGenerationCount,
            queuedRequestCount: nativeCallbacks.size,
            boundHooks: Array.from(boundHooks),
            latest,
            pending: [...pending.values()].map((request) => ({ ...request })),
            surface: collectSurfaceSnapshot(),
            eventGroups: countBy(events, 'eventType'),
            events: events.slice()
        });

        const dispose = () => {
            disposed = true;
            for (const name of nativeCallbacks.keys()) removeCallback(name);
            if (win[callbackName] === handleNativeCallback) delete win[callbackName];
            pending.clear();
            owners.clear();
        };
        const api = Object.freeze({
            bind,
            bindDispatchHooks,
            bindContextStatePatch,
            enqueueNativeRequest,
            handleNativeCallback,
            run,
            dispose,
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
