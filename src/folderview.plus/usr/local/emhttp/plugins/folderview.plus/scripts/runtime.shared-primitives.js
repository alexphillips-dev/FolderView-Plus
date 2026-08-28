// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(typeof globalThis !== 'undefined' ? globalThis : root);
        return;
    }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.runtimeSharedPrimitives = factory(root);
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function(window) {
    'use strict';
    const clonePlain = (value) => {
        if (!value || typeof value !== 'object') {
            return value;
        }
        return { ...value };
    };

    /**
     * Lightweight runtime store for Docker tab state.
     * @param {Record<string, any>} initialState
     */
    const createRuntimeStateStore = (initialState = {}) => {
        let state = clonePlain(initialState);
        const listeners = new Set();

        const notify = (nextState, prevState, patch) => {
            listeners.forEach((listener) => {
                try {
                    listener(nextState, prevState, patch);
                } catch (error) {
                    console.error('folderview.plus: runtime store listener failed', error);
                }
            });
        };

        return {
            getState: () => clonePlain(state),
            get: (key, fallback = undefined) => (
                Object.prototype.hasOwnProperty.call(state, key) ? state[key] : fallback
            ),
            set: (patch = {}) => {
                if (!patch || typeof patch !== 'object') {
                    return clonePlain(state);
                }
                const previous = clonePlain(state);
                const next = clonePlain(state);
                let changed = false;
                Object.entries(patch).forEach(([key, value]) => {
                    if (next[key] !== value) {
                        next[key] = value;
                        changed = true;
                    }
                });
                if (!changed) {
                    return clonePlain(state);
                }
                state = next;
                notify(clonePlain(state), previous, clonePlain(patch));
                return clonePlain(state);
            },
            subscribe: (listener) => {
                if (typeof listener !== 'function') {
                    return () => {};
                }
                listeners.add(listener);
                return () => listeners.delete(listener);
            }
        };
    };

    /**
     * Async action wrapper with uniform error routing.
     * @param {{prefix?: string, onError?: (actionName: string, error: Error, context?: any) => void}} options
     */
    const createAsyncActionBoundary = (options = {}) => {
        const prefix = String(options.prefix || 'folderview.plus');
        const onError = typeof options.onError === 'function'
            ? options.onError
            : (actionName, error) => console.error(`${prefix}: ${actionName} failed`, error);
        return {
            run: async (actionName, action, context = {}) => {
                if (typeof action !== 'function') {
                    return { ok: false, error: new Error('Action handler must be a function') };
                }
                try {
                    const value = await action();
                    return { ok: true, value };
                } catch (rawError) {
                    const error = rawError instanceof Error ? rawError : new Error(String(rawError || 'Unknown error'));
                    onError(String(actionName || 'action'), error, context);
                    return { ok: false, error };
                }
            }
        };
    };

    const normalizeLabel = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

    /**
     * Context-menu adapter for icon-only top quick actions.
     * It matches quick items by either label or icon class to stay resilient to markup changes.
     * @param {{
     *  menuClassName?: string,
     *  quickItemClassName?: string,
     *  clearClassName?: string,
     *  labelSet?: Set<string>,
     *  iconClassCandidates?: string[],
     *  selectors?: string[]
     * }} options
     */
    const createContextMenuQuickStripAdapter = (options = {}) => {
        const menuClassName = String(options.menuClassName || 'fvplus-docker-context-menu');
        const quickItemClassName = String(options.quickItemClassName || 'fvplus-docker-quick-item');
        const clearClassName = String(options.clearClassName || 'fvplus-docker-quick-clear');
        const labelSet = options.labelSet instanceof Set ? options.labelSet : new Set();
        const iconClassCandidates = Array.isArray(options.iconClassCandidates) ? options.iconClassCandidates : [];
        const minimumItems = Math.max(1, Number(options.minimumItems) || 3), maximumItems = Math.max(minimumItems, Number(options.maximumItems) || minimumItems);
        const selectors = Array.isArray(options.selectors) && options.selectors.length
            ? options.selectors
            : [
                'ul.context-menu-list:visible',
                'ul.contextMenuPlugin:visible',
                'ul.context-menu:visible',
                'ul.dropdown-menu:visible'
            ];

        const findVisibleMenu = () => {
            const $ = window.jQuery || window.$;
            if (!$) {
                return null;
            }
            for (const selector of selectors) {
                const menus = $(selector);
                for (let idx = menus.length - 1; idx >= 0; idx -= 1) {
                    const $menu = $(menus.get(idx));
                    if (!$menu || !$menu.length) {
                        continue;
                    }
                    return $menu;
                }
            }
            return null;
        };

        const isQuickItem = ($item) => {
            const text = normalizeLabel($item.text());
            if (labelSet.has(text)) {
                return true;
            }
            const icon = $item.find('i.fa').first();
            if (!icon.length) {
                return false;
            }
            for (const iconClass of iconClassCandidates) {
                if (icon.hasClass(iconClass)) {
                    return true;
                }
            }
            return false;
        };

        const enhance = () => {
            const $ = window.jQuery || window.$;
            if (!$) {
                return false;
            }
            const $menu = findVisibleMenu();
            if (!$menu || !$menu.length) {
                return false;
            }
            const $quickItems = $menu.children('li').filter((_, item) => isQuickItem($(item))).slice(0, maximumItems);
            if ($quickItems.length < minimumItems) return false;
            $menu.addClass(menuClassName);
            $quickItems.each((_, item) => {
                const $item = $(item);
                const label = String($item.text() || '').trim().replace(/\s+/g, ' ');
                $item.addClass(quickItemClassName);
                const $interactive = $item.find('a, .context-menu-item').first();
                if ($interactive.length) {
                    $interactive.attr('title', label);
                    $interactive.attr('aria-label', label);
                } else {
                    $item.attr('title', label);
                    $item.attr('aria-label', label);
                }
            });
            const $firstNonQuick = $menu.children('li').not(`.${quickItemClassName}`).first();
            if ($firstNonQuick.length) {
                $firstNonQuick.addClass(clearClassName);
            }
            return true;
        };

        const queueEnhance = (attempt = 0) => {
            if (enhance()) {
                return;
            }
            const safeAttempt = Number.isFinite(Number(attempt)) ? Number(attempt) : 0;
            if (safeAttempt >= 8) {
                return;
            }
            window.setTimeout(() => queueEnhance(safeAttempt + 1), 18 * (safeAttempt + 1));
        };

        return {
            queueEnhance
        };
    };

    /**
     * Structured perf telemetry for action-level timing.
     * @param {string} namespace
     * @param {boolean} enabled
     */
    const createRuntimePerfTelemetry = (namespace = 'folderview-plus.docker', enabled = false) => {
        const on = typeof performance !== 'undefined';
        const debug = enabled === true;
        const marks = new Map();
        const aggregates = new Map();
        const begin = (name) => {
            if (!on) return;
            marks.set(String(name || ''), performance.now());
        };
        const end = (name, metadata = {}) => {
            if (!on) return 0;
            const key = String(name || '');
            const start = marks.get(key);
            if (typeof start !== 'number') return 0;
            const elapsed = performance.now() - start;
            marks.delete(key);
            const prev = aggregates.get(key) || { count: 0, totalMs: 0, maxMs: 0 };
            const next = {
                count: prev.count + 1,
                totalMs: prev.totalMs + elapsed,
                maxMs: Math.max(prev.maxMs, elapsed)
            };
            aggregates.set(key, next);
            if (debug) console.debug(`[FV_PERF][${namespace}] ${key}: ${elapsed.toFixed(2)}ms`, metadata);
            return elapsed;
        };
        const snapshot = () => {
            const rows = {};
            aggregates.forEach((entry, key) => {
                rows[key] = {
                    count: entry.count,
                    totalMs: Number(entry.totalMs.toFixed(2)),
                    avgMs: Number((entry.totalMs / Math.max(1, entry.count)).toFixed(2)),
                    maxMs: Number(entry.maxMs.toFixed(2))
                };
            });
            return rows;
        };
        return { enabled: on, begin, end, snapshot };
    };

    const runtimeContracts = Object.freeze({
        folderLabelKeys: Object.freeze(['folderview.plus', 'folder.view3', 'folder.view2', 'folder.view']),
        performance: Object.freeze({
            standardLiveRefreshSeconds: 10,
            adaptiveLiveRefreshSeconds: 20,
            adaptiveExpandRestoreLimit: 12,
            strictFolderCount: 34,
            strictItemCount: 220,
            strictRenderMs: 140,
            strictExitFolderCount: 30,
            strictExitItemCount: 200,
            strictExitRenderMs: 100,
            strictExpandRestoreLimit: 8,
            strictLiveRefreshSeconds: 30,
            maximumExpandRestoreLimit: 6,
            maximumLiveRefreshSeconds: 45
        })
    });

    const normalizePerformanceProfileMode = (prefs = {}) => {
        const raw = String(prefs?.performanceProfile || '').trim().toLowerCase();
        if (['standard', 'adaptive', 'maximum'].includes(raw)) {
            return raw;
        }
        return prefs?.performanceMode === true ? 'adaptive' : 'standard';
    };

    /**
     * Resolves effective runtime performance profile for large installs.
     * @param {{performanceMode?: boolean}} prefs
     * @param {{folderCount?: number, itemCount?: number}} counts
     * @param {{strictFolderCount?: number, strictItemCount?: number, strictExpandRestoreLimit?: number, strictLiveRefreshSeconds?: number}} overrides
     */
    const resolveRuntimePerformanceProfile = (prefs = {}, counts = {}, overrides = {}) => {
        const perf = runtimeContracts.performance;
        const mode = normalizePerformanceProfileMode(prefs);
        const performanceMode = mode !== 'standard';
        const folderCount = Math.max(0, Number(counts?.folderCount || 0));
        const itemCount = Math.max(0, Number(counts?.itemCount || 0));
        const strictFolderCount = Math.max(1, Number(overrides.strictFolderCount || perf.strictFolderCount));
        const strictItemCount = Math.max(1, Number(overrides.strictItemCount || perf.strictItemCount));
        const renderMs = Math.max(0, Number(counts?.renderMs || 0));
        const previousStrict = counts?.previousStrict === true;
        const strictExpandRestoreLimit = Math.max(1, Number(overrides.strictExpandRestoreLimit || perf.strictExpandRestoreLimit));
        const strictLiveRefreshSeconds = Math.max(10, Number(overrides.strictLiveRefreshSeconds || perf.strictLiveRefreshSeconds));
        const slowRender = renderMs >= Number(perf.strictRenderMs || 140);
        const largeLibrary = folderCount >= strictFolderCount || itemCount >= strictItemCount || slowRender;
        const remainsLarge = previousStrict && (
            folderCount >= Number(perf.strictExitFolderCount || 30)
            || itemCount >= Number(perf.strictExitItemCount || 200)
            || renderMs >= Number(perf.strictExitRenderMs || 100)
        );
        const strict = mode === 'maximum' || (mode === 'adaptive' && (largeLibrary || remainsLarge));
        const requestedRefreshSeconds = Math.max(10, Math.min(300, Number(prefs?.liveRefreshSeconds) || 20));
        const minLiveRefreshSeconds = mode === 'maximum'
            ? Math.max(strictLiveRefreshSeconds, Number(perf.maximumLiveRefreshSeconds || 45))
            : (strict
                ? strictLiveRefreshSeconds
                : (mode === 'adaptive' ? Number(perf.adaptiveLiveRefreshSeconds || 20) : 0));
        const expandRestoreLimit = mode === 'maximum'
            ? Math.max(1, Number(perf.maximumExpandRestoreLimit || 6))
            : (strict
                ? strictExpandRestoreLimit
                : (mode === 'adaptive' ? Number(perf.adaptiveExpandRestoreLimit || 12) : null));
        const deferredPreviews = prefs?.lazyPreviewEnabled === true || strict;
        const reason = mode === 'standard'
            ? 'standard-profile'
            : (mode === 'maximum'
                ? 'maximum-profile'
                : (slowRender ? 'measured-render-cost' : ((largeLibrary || remainsLarge) ? 'large-library' : 'adaptive-profile')));
        return Object.freeze({
            mode,
            performanceMode,
            strict,
            largeLibrary,
            reason,
            folderCount,
            itemCount,
            renderMs,
            previousStrict,
            strictFolderCount,
            strictItemCount,
            reduceMotion: performanceMode,
            previewStrategy: deferredPreviews ? 'deferred' : 'immediate',
            deferredPreviews,
            lazyPreviewThreshold: Math.max(10, Math.min(200, Number(prefs?.lazyPreviewThreshold) || 30)),
            expandRestoreLimit,
            minLiveRefreshSeconds,
            requestedRefreshSeconds,
            effectiveRefreshSeconds: Math.max(requestedRefreshSeconds, minLiveRefreshSeconds || 0)
        });
    };

    /**
     * Defers already-built preview content until its owning row/card approaches the viewport.
     * Folder settings remain immutable; the detached fragment is restored on visibility or interaction.
     */
    const createDeferredPreviewController = (options = {}) => {
        const pending = new Map();
        const rootMargin = String(options.rootMargin || '480px 0px');
        let active = true;
        const removeInteractionListeners = (entry) => {
            if (!entry?.interactionTarget || !entry.hydrateOnInteraction) return;
            entry.interactionTarget.removeEventListener('pointerenter', entry.hydrateOnInteraction);
            entry.interactionTarget.removeEventListener('focusin', entry.hydrateOnInteraction);
            entry.interactionTarget.removeEventListener('click', entry.hydrateOnInteraction);
        };
        const hydrate = (target) => {
            const entry = pending.get(target);
            if (!entry) return false;
            pending.delete(target);
            observer?.unobserve(target);
            removeInteractionListeners(entry);
            entry.placeholder?.remove();
            target.appendChild(entry.fragment);
            target.classList.remove('fv-preview-deferred');
            target.setAttribute('data-fv-preview-hydrated', '1');
            if (typeof entry.onHydrated === 'function') entry.onHydrated(target);
            return true;
        };
        const observer = typeof window.IntersectionObserver === 'function'
            ? new window.IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting || entry.intersectionRatio > 0) hydrate(entry.target);
                });
            }, { root: null, rootMargin, threshold: 0 })
            : null;
        const defer = (target, metadata = {}) => {
            if (!active || !(target instanceof Element) || pending.has(target) || target.childNodes.length === 0) return false;
            const interactionTarget = metadata.interactionTarget instanceof Element ? metadata.interactionTarget : target;
            if (typeof interactionTarget.getBoundingClientRect === 'function') {
                const rect = interactionTarget.getBoundingClientRect();
                const viewportHeight = Math.max(0, Number(window.innerHeight || document.documentElement?.clientHeight || 0));
                if (viewportHeight > 0 && rect.bottom >= -480 && rect.top <= viewportHeight + 480) return false;
            }
            const fragment = document.createDocumentFragment();
            while (target.firstChild) fragment.appendChild(target.firstChild);
            const placeholder = document.createElement('span');
            placeholder.className = 'fv-preview-deferred-placeholder';
            placeholder.textContent = String(metadata.placeholder || 'Preview loads when visible');
            target.appendChild(placeholder);
            target.classList.add('fv-preview-deferred');
            target.setAttribute('data-fv-preview-hydrated', '0');
            const hydrateOnInteraction = () => hydrate(target);
            pending.set(target, {
                fragment,
                placeholder,
                onHydrated: metadata.onHydrated,
                interactionTarget,
                hydrateOnInteraction
            });
            interactionTarget.addEventListener('pointerenter', hydrateOnInteraction, { once: true, passive: true });
            interactionTarget.addEventListener('focusin', hydrateOnInteraction, { once: true });
            interactionTarget.addEventListener('click', hydrateOnInteraction, { once: true });
            if (observer) observer.observe(target);
            else window.setTimeout(() => hydrate(target), 0);
            return true;
        };
        const flush = () => Array.from(pending.keys()).forEach((target) => hydrate(target));
        const start = () => {
            active = true;
            return api;
        };
        const refresh = () => flush();
        const destroy = () => {
            flush();
            observer?.disconnect();
            active = false;
        };
        const snapshot = () => Object.freeze({ active, pending: pending.size, rootMargin });
        const api = Object.freeze({ start, defer, refresh, flush, destroy, snapshot });
        return api;
    };

    /**
     * Deduplicates UI-triggered async actions by key to avoid racey double-click behavior.
     * Reversible controls can apply the latest intent immediately and retain its action
     * while the current request settles.
     * @param {{onError?: (error: Error, actionKey: string) => void, onBusy?: (actionKey: string) => void}} options
     */
    const createSafeUiActionRunner = (options = {}) => {
        const inFlight = new Set();
        const queued = new Map();
        const intentGenerations = new Map();
        const onError = typeof options.onError === 'function'
            ? options.onError
            : (error, actionKey) => console.error(`folderview.plus: safe ui action failed (${actionKey})`, error);
        const onBusy = typeof options.onBusy === 'function' ? options.onBusy : null;
        const execute = async (key, action, intent) => {
            inFlight.add(key);
            let result;
            try {
                const value = await action(intent);
                result = { ok: true, value };
            } catch (rawError) {
                const error = rawError instanceof Error ? rawError : new Error(String(rawError || 'Unknown error'));
                onError(error, key);
                result = { ok: false, error };
            } finally {
                inFlight.delete(key);
                const pending = queued.get(key);
                if (pending) {
                    queued.delete(key);
                    void execute(key, pending.action, pending.intent).then(pending.resolve);
                }
            }
            return result;
        };
        return {
            isRunning: (actionKey) => inFlight.has(String(actionKey || '')),
            isQueued: (actionKey) => queued.has(String(actionKey || '')),
            run: async (actionKey, action, settings = {}) => {
                const key = String(actionKey || '').trim() || 'action';
                if (typeof action !== 'function') {
                    return { ok: false, skipped: true, reason: 'invalid-action' };
                }
                if (inFlight.has(key) && settings.queueIfBusy !== true) {
                    if (onBusy) {
                        onBusy(key);
                    }
                    return { ok: false, skipped: true, reason: 'in-flight' };
                }
                const generation = Number(intentGenerations.get(key) || 0) + 1;
                intentGenerations.set(key, generation);
                const intent = Object.freeze({
                    generation,
                    isLatest: () => Number(intentGenerations.get(key) || 0) === generation
                });
                if (typeof settings.onIntent === 'function') {
                    settings.onIntent(intent);
                }
                if (inFlight.has(key)) {
                    const pending = queued.get(key);
                    if (pending) {
                        pending.action = action;
                        pending.intent = intent;
                        return pending.promise;
                    }
                    let resolveQueued;
                    const promise = new Promise((resolve) => {
                        resolveQueued = resolve;
                    });
                    queued.set(key, {
                        action,
                        intent,
                        promise,
                        resolve: resolveQueued
                    });
                    return promise;
                }
                return execute(key, action, intent);
            }
        };
    };


    return Object.freeze({
        createRuntimeStateStore,
        createAsyncActionBoundary,
        createContextMenuQuickStripAdapter,
        createRuntimePerfTelemetry,
        createDeferredPreviewController,
        createSafeUiActionRunner,
        resolveRuntimePerformanceProfile,
        normalizePerformanceProfileMode,
        runtimeContracts
    });
}));
