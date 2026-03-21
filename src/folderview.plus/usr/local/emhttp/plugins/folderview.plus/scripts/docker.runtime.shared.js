// @ts-check
(function fvplusDockerRuntimeSharedScope(window) {
    'use strict';

    /**
     * @template T
     * @param {T} value
     * @returns {T}
     */
    const clonePlain = (value) => {
        if (!value || typeof value !== 'object') {
            return value;
        }
        return /** @type {T} */ ({ ...value });
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
            const $quickItems = $menu.children('li').filter((_, item) => isQuickItem($(item))).slice(0, 3);
            if ($quickItems.length < 3) {
                return false;
            }
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
            enhance,
            queueEnhance
        };
    };

    /**
     * Structured perf telemetry for action-level timing.
     * @param {string} namespace
     * @param {boolean} enabled
     */
    const createRuntimePerfTelemetry = (namespace = 'folderview-plus.docker', enabled = false) => {
        const on = Boolean(enabled && typeof performance !== 'undefined');
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
            console.debug(`[FV_PERF][${namespace}] ${key}: ${elapsed.toFixed(2)}ms`, metadata);
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
            strictFolderCount: 34,
            strictItemCount: 220,
            strictExpandRestoreLimit: 8,
            strictLiveRefreshSeconds: 30
        })
    });

    /**
     * Resolves effective runtime performance profile for large installs.
     * @param {{performanceMode?: boolean}} prefs
     * @param {{folderCount?: number, itemCount?: number}} counts
     * @param {{strictFolderCount?: number, strictItemCount?: number, strictExpandRestoreLimit?: number, strictLiveRefreshSeconds?: number}} overrides
     */
    const resolveRuntimePerformanceProfile = (prefs = {}, counts = {}, overrides = {}) => {
        const perf = runtimeContracts.performance;
        const performanceMode = prefs?.performanceMode === true;
        const folderCount = Math.max(0, Number(counts?.folderCount || 0));
        const itemCount = Math.max(0, Number(counts?.itemCount || 0));
        const strictFolderCount = Math.max(1, Number(overrides.strictFolderCount || perf.strictFolderCount));
        const strictItemCount = Math.max(1, Number(overrides.strictItemCount || perf.strictItemCount));
        const strictExpandRestoreLimit = Math.max(1, Number(overrides.strictExpandRestoreLimit || perf.strictExpandRestoreLimit));
        const strictLiveRefreshSeconds = Math.max(10, Number(overrides.strictLiveRefreshSeconds || perf.strictLiveRefreshSeconds));
        const strict = performanceMode && (folderCount >= strictFolderCount || itemCount >= strictItemCount);
        return Object.freeze({
            performanceMode,
            strict,
            folderCount,
            itemCount,
            strictFolderCount,
            strictItemCount,
            expandRestoreLimit: strict ? strictExpandRestoreLimit : null,
            minLiveRefreshSeconds: strict ? strictLiveRefreshSeconds : null
        });
    };

    /**
     * Deduplicates UI-triggered async actions by key to avoid racey double-click behavior.
     * @param {{onError?: (error: Error, actionKey: string) => void, onBusy?: (actionKey: string) => void}} options
     */
    const createSafeUiActionRunner = (options = {}) => {
        const inFlight = new Set();
        const onError = typeof options.onError === 'function'
            ? options.onError
            : (error, actionKey) => console.error(`folderview.plus: safe ui action failed (${actionKey})`, error);
        const onBusy = typeof options.onBusy === 'function' ? options.onBusy : null;
        return {
            isRunning: (actionKey) => inFlight.has(String(actionKey || '')),
            run: async (actionKey, action) => {
                const key = String(actionKey || '').trim() || 'action';
                if (inFlight.has(key)) {
                    if (onBusy) {
                        onBusy(key);
                    }
                    return { ok: false, skipped: true, reason: 'in-flight' };
                }
                if (typeof action !== 'function') {
                    return { ok: false, skipped: true, reason: 'invalid-action' };
                }
                inFlight.add(key);
                try {
                    const value = await action();
                    return { ok: true, value };
                } catch (rawError) {
                    const error = rawError instanceof Error ? rawError : new Error(String(rawError || 'Unknown error'));
                    onError(error, key);
                    return { ok: false, error };
                } finally {
                    inFlight.delete(key);
                }
            }
        };
    };

    const layoutTokens = Object.freeze({
        folderRightGutterPx: 28,
        folderOuterReservedPx: 106,
        folderDropdownRightMarginPx: 16,
        contextQuickItemWidthPx: 34,
        contextQuickLinkWidthPx: 30,
        contextQuickLinkHeightPx: 26
    });

    window.FolderViewDockerRuntimeShared = {
        createRuntimeStateStore,
        createAsyncActionBoundary,
        createContextMenuQuickStripAdapter,
        createRuntimePerfTelemetry,
        createSafeUiActionRunner,
        resolveRuntimePerformanceProfile,
        runtimeContracts,
        layoutTokens
    };
})(window);
