(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusRuntimeStateObservers = factory();
    root.FolderViewPlusRuntimeStateObserversModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const fallbackWindow = typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : null);

    const normalizeExpandedStateMap = (value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return {};
        }
        const next = {};
        for (const [rawId, expanded] of Object.entries(value)) {
            const id = String(rawId || '').trim();
            if (!id) {
                continue;
            }
            next[id] = expanded === true;
        }
        return next;
    };

    const createExpandedStateController = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        const doc = deps.document || (typeof document !== 'undefined' ? document : null);
        const jq = deps.$;
        const normalizePrefs = typeof deps.normalizePrefs === 'function' ? deps.normalizePrefs : ((value) => value || {});
        const readServerMap = typeof deps.readServerMap === 'function' ? deps.readServerMap : (() => ({}));
        const writeServerMap = typeof deps.writeServerMap === 'function' ? deps.writeServerMap : (() => {});
        const readFolders = typeof deps.readFolders === 'function' ? deps.readFolders : (() => ({}));
        const storageWriter = deps.storageWriter || null;
        const storageKey = String(deps.storageKey || '').trim();
        const syncDelayMs = Number.isFinite(Number(deps.syncDelayMs)) ? Math.max(0, Number(deps.syncDelayMs)) : 420;
        const prefsType = String(deps.type || '').trim();
        const preferenceCoordinator = deps.preferenceCoordinator || null;
        const readPrefs = typeof deps.readPrefs === 'function' ? deps.readPrefs : (() => ({}));

        let syncTimer = null;
        let syncInFlight = false;
        let syncQueued = false;
        let lastSyncedPayload = '';
        let lifecycleHooksBound = false;

        const readLocalMap = () => {
            try {
                const raw = win.localStorage && storageKey ? win.localStorage.getItem(storageKey) : '';
                if (!raw) {
                    return {};
                }
                return normalizeExpandedStateMap(JSON.parse(raw));
            } catch (_error) {
                return {};
            }
        };

        const writeLocalMap = (map) => {
            try {
                if (!win.localStorage || !storageKey) {
                    return;
                }
                const serialized = JSON.stringify(normalizeExpandedStateMap(map));
                if (storageWriter && typeof storageWriter.setItem === 'function') {
                    storageWriter.setItem(storageKey, serialized, { delayMs: 80, idle: true });
                } else {
                    win.localStorage.setItem(storageKey, serialized);
                }
            } catch (_error) {
                // Best effort only.
            }
        };

        const readServerExpandedStateMap = () => normalizeExpandedStateMap(readServerMap() || {});

        const writeServerExpandedStateMap = (map) => {
            writeServerMap(normalizeExpandedStateMap(map));
        };

        const syncExpandedStateToServer = async () => {
            const request = deps.requestClient || win.FolderViewPlusRequest;
            const coordinatorAvailable = preferenceCoordinator && typeof preferenceCoordinator.save === 'function';
            if ((!coordinatorAvailable && (!request || typeof request.postJson !== 'function')) || !prefsType) {
                return;
            }
            if (syncInFlight) {
                syncQueued = true;
                return;
            }

            const payloadMap = readServerExpandedStateMap();
            const payloadString = JSON.stringify(payloadMap);
            if (payloadString === lastSyncedPayload) {
                return;
            }

            syncInFlight = true;
            try {
                const nextPrefs = preferenceCoordinator && typeof preferenceCoordinator.save === 'function'
                    ? normalizePrefs(await preferenceCoordinator.save(prefsType, {
                        expandedFolderState: payloadMap
                    }, {
                        currentPrefs: readPrefs(),
                        immediate: true
                    }))
                    : normalizePrefs((await request.postJson('/plugins/folderview.plus/server/prefs.php', {
                        type: prefsType,
                        prefs: JSON.stringify({
                            expandedFolderState: payloadMap
                        })
                    }, {
                        retries: 1,
                        retryDelayMs: 260
                    }))?.prefs || {});
                writeServerExpandedStateMap(nextPrefs.expandedFolderState || payloadMap);
                lastSyncedPayload = JSON.stringify(readServerExpandedStateMap());
            } catch (_error) {
                // Best effort only; local persistence still retains behavior.
            } finally {
                syncInFlight = false;
                if (syncQueued) {
                    syncQueued = false;
                    scheduleExpandedStateSync();
                }
            }
        };

        const scheduleExpandedStateSync = () => {
            if (syncTimer) {
                win.clearTimeout(syncTimer);
            }
            syncTimer = win.setTimeout(() => {
                syncTimer = null;
                syncExpandedStateToServer();
            }, syncDelayMs);
        };

        const buildStateMap = (folders, previousFolders = {}, serverMap = {}) => {
            const source = folders && typeof folders === 'object' ? folders : {};
            const previous = previousFolders && typeof previousFolders === 'object' ? previousFolders : {};
            const persistedServer = normalizeExpandedStateMap(serverMap);
            const persistedLocal = readLocalMap();
            const resolved = {};
            for (const [id, folder] of Object.entries(source)) {
                if (Object.prototype.hasOwnProperty.call(persistedServer, id)) {
                    resolved[id] = persistedServer[id] === true;
                    continue;
                }
                if (Object.prototype.hasOwnProperty.call(persistedLocal, id)) {
                    resolved[id] = persistedLocal[id] === true;
                    continue;
                }
                resolved[id] = (previous[id]?.status?.expanded === true) || folder?.settings?.expand_tab === true;
            }
            writeLocalMap(resolved);
            writeServerExpandedStateMap(resolved);
            return resolved;
        };

        const persistStateMap = (map, syncServer = true) => {
            const normalized = normalizeExpandedStateMap(map);
            writeLocalMap(normalized);
            writeServerExpandedStateMap(normalized);
            if (syncServer) {
                scheduleExpandedStateSync();
            }
        };

        const persistStateFromGlobal = (syncServer = true) => {
            const map = {};
            for (const [id, folder] of Object.entries(readFolders() || {})) {
                map[id] = folder?.status?.expanded === true;
            }
            if (typeof deps.onPersistFromGlobal === 'function') {
                deps.onPersistFromGlobal(map);
            }
            persistStateMap(map, syncServer);
        };

        const readStateFromDom = () => {
            const map = {};
            const seen = new Set();
            jq?.('button.folder-dropdown').each((_, node) => {
                const className = String(node.className || '');
                const match = className.match(/\bdropDown-([A-Za-z0-9_-]+)\b/);
                if (!match || !match[1]) {
                    return;
                }
                const id = String(match[1]);
                if (seen.has(id)) {
                    return;
                }
                seen.add(id);
                map[id] = String(jq(node).attr('active') || '').toLowerCase() === 'true';
            });
            return map;
        };

        const persistStateFromDom = () => {
            const domState = readStateFromDom();
            if (!Object.keys(domState).length) {
                return;
            }
            const current = readLocalMap();
            persistStateMap({ ...current, ...domState }, true);
        };

        const ensureLifecycleHooks = () => {
            if (lifecycleHooksBound || !doc || !win?.addEventListener) {
                return;
            }
            lifecycleHooksBound = true;
            win.addEventListener('pagehide', persistStateFromDom, { passive: true });
            win.addEventListener('beforeunload', persistStateFromDom, { passive: true });
            doc.addEventListener('visibilitychange', () => {
                if (doc.hidden) {
                    persistStateFromDom();
                }
            });
        };

        return Object.freeze({
            normalizeExpandedStateMap,
            readLocalMap,
            readServerExpandedStateMap,
            buildStateMap,
            persistStateMap,
            persistStateFromGlobal,
            readStateFromDom,
            persistStateFromDom,
            ensureLifecycleHooks,
            scheduleExpandedStateSync,
            syncExpandedStateToServer
        });
    };

    const createThemeReflowController = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        const doc = deps.document || (typeof document !== 'undefined' ? document : null);
        const scheduleReflow = typeof deps.scheduleReflow === 'function' ? deps.scheduleReflow : (() => {});
        const onQueueReason = typeof deps.onQueueReason === 'function' ? deps.onQueueReason : null;
        const viewportReason = String(deps.viewportReason || 'viewport-change');
        const viewportDelayMs = Number.isFinite(Number(deps.viewportDelayMs)) ? Math.max(0, Number(deps.viewportDelayMs)) : 48;
        const themeDelayMs = Number.isFinite(Number(deps.themeDelayMs)) ? Math.max(0, Number(deps.themeDelayMs)) : 40;
        const themeReasonPrefix = String(deps.themeReasonPrefix || 'theme');

        let viewportBound = false;
        let themeReflowBound = false;
        let themeReflowObserver = null;
        let themeReflowTimer = null;

        const bindViewportWidthSync = () => {
            if (viewportBound || !win?.addEventListener) {
                return;
            }
            viewportBound = true;
            const reapply = () => scheduleReflow(viewportReason, viewportDelayMs);
            win.addEventListener('resize', reapply, { passive: true });
            win.addEventListener('orientationchange', reapply, { passive: true });
        };

        const queueThemeReflow = (reason = 'theme-change') => {
            const nextReason = String(reason || 'theme-change');
            if (themeReflowTimer !== null) {
                win.clearTimeout(themeReflowTimer);
            }
            themeReflowTimer = win.setTimeout(() => {
                themeReflowTimer = null;
                onQueueReason?.(nextReason);
                scheduleReflow(`${themeReasonPrefix}:${nextReason}`, 20);
            }, themeDelayMs);
        };

        const bindThemeReflow = () => {
            if (themeReflowBound || !doc) {
                return;
            }
            themeReflowBound = true;
            const onThemeChange = () => queueThemeReflow('observer');
            if (typeof MutationObserver === 'function') {
                themeReflowObserver = new MutationObserver((mutations) => {
                    for (const mutation of mutations || []) {
                        if (mutation.type !== 'attributes') {
                            continue;
                        }
                        const attr = String(mutation.attributeName || '').toLowerCase();
                        if (!attr || attr === 'class' || attr === 'style' || attr.includes('theme')) {
                            onThemeChange();
                            return;
                        }
                    }
                });
                if (doc.documentElement) {
                    themeReflowObserver.observe(doc.documentElement, {
                        attributes: true,
                        attributeFilter: ['class', 'style', 'data-theme', 'theme', 'data-color-scheme', 'data-bs-theme']
                    });
                }
                if (doc.body) {
                    themeReflowObserver.observe(doc.body, {
                        attributes: true,
                        attributeFilter: ['class', 'style', 'data-theme', 'theme', 'data-color-scheme', 'data-bs-theme']
                    });
                }
            }
            if (typeof win.matchMedia === 'function') {
                const media = win.matchMedia('(prefers-color-scheme: dark)');
                if (media && typeof media.addEventListener === 'function') {
                    media.addEventListener('change', () => queueThemeReflow('prefers-color-scheme'));
                } else if (media && typeof media.addListener === 'function') {
                    media.addListener(() => queueThemeReflow('prefers-color-scheme'));
                }
            }
        };

        return Object.freeze({
            bindViewportWidthSync,
            queueThemeReflow,
            bindThemeReflow
        });
    };

    return Object.freeze({
        createExpandedStateController,
        createThemeReflowController
    });
}));
