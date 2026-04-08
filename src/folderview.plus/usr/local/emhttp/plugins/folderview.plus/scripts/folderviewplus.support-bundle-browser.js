(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(root);
        return;
    }
    root.FolderViewPlusSupportBundleBrowser = factory(root);
    root.FolderViewPlusSupportBundleBrowserModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function(root) {
    const CONSOLE_ERROR_STORAGE_KEY = 'fv.support.bundle.consoleErrors.v1';
    const CONSOLE_ERROR_LIMIT = 30;

    const clientStorageIsAvailable = (kind) => {
        try {
            return typeof root?.[kind] !== 'undefined';
        } catch (_error) {
            return false;
        }
    };

    const createCollectors = (deps = {}) => {
        const readClientDiagnosticsStorageRecord = typeof deps.readClientDiagnosticsStorageRecord === 'function'
            ? deps.readClientDiagnosticsStorageRecord
            : (() => null);
        const storageKeys = deps.storageKeys && typeof deps.storageKeys === 'object' && !Array.isArray(deps.storageKeys)
            ? deps.storageKeys
            : {};

        const readCookieValue = (name) => {
            const safeName = String(name || '').trim();
            const rawCookie = String(root?.document?.cookie || '');
            if (!safeName || !rawCookie) {
                return '';
            }
            const prefix = `${safeName}=`;
            const parts = rawCookie.split(';');
            for (const part of parts) {
                const candidate = String(part || '').trim();
                if (candidate.startsWith(prefix)) {
                    try {
                        return decodeURIComponent(candidate.slice(prefix.length));
                    } catch (_error) {
                        return candidate.slice(prefix.length);
                    }
                }
            }
            return '';
        };

        const normalizeDockerListViewMode = (value) => {
            const raw = String(value || '').trim().toLowerCase();
            if (raw === 'advanced' || raw === 'basic') {
                return raw;
            }
            return null;
        };

        const normalizeAssetVersionToken = (value) => {
            const raw = String(value || '').trim();
            if (!raw || raw === '0' || raw === 'null' || raw === 'undefined' || raw === 'false') {
                return '';
            }
            return raw;
        };

        const collectBrowserCapabilities = () => ({
            clipboardWrite: Boolean(root?.navigator?.clipboard && typeof root.navigator.clipboard.writeText === 'function'),
            cookieEnabled: root?.navigator?.cookieEnabled !== false,
            fetch: typeof root?.fetch === 'function',
            mutationObserver: typeof root?.MutationObserver === 'function',
            pointerEvent: typeof root?.PointerEvent === 'function',
            resizeObserver: typeof root?.ResizeObserver === 'function',
            touchPoints: Number.isFinite(Number(root?.navigator?.maxTouchPoints)) ? Number(root.navigator.maxTouchPoints) : 0,
            viewport: {
                width: Number.isFinite(Number(root?.innerWidth)) ? Number(root.innerWidth) : 0,
                height: Number.isFinite(Number(root?.innerHeight)) ? Number(root.innerHeight) : 0,
                devicePixelRatio: Number.isFinite(Number(root?.devicePixelRatio)) ? Number(root.devicePixelRatio) : 1
            }
        });

        const collectClientStorageDiagnostics = () => ({
            localStorageAvailable: clientStorageIsAvailable('localStorage'),
            sessionStorageAvailable: clientStorageIsAvailable('sessionStorage'),
            dockerListViewModeCookie: normalizeDockerListViewMode(readCookieValue('docker_listview_mode')),
            folderEditorDebug: {
                launchPresent: Boolean(readClientDiagnosticsStorageRecord(storageKeys.launch || '')),
                bootstrapPresent: Boolean(readClientDiagnosticsStorageRecord(storageKeys.bootstrap || '')),
                surfacePresent: Boolean(readClientDiagnosticsStorageRecord(storageKeys.surface || ''))
            }
        });

        const collectCurrentPageTelemetry = (uiRedactor) => {
            const href = String(root?.location?.href || '');
            return {
                path: String(root?.location?.pathname || ''),
                href: uiRedactor ? uiRedactor.redactUrl('uiTelemetry.currentPage.href', href) : href
            };
        };

        const collectLoadedAssetTelemetry = (uiRedactor, options = {}) => {
            const doc = root?.document || null;
            if (!doc || typeof doc.querySelectorAll !== 'function') {
                return { count: 0, entries: [] };
            }
            const entries = [];
            const seen = new Set();
            const fallbackVersionToken = normalizeAssetVersionToken(options?.pluginVersion || '');
            doc.querySelectorAll('script[src*="/plugins/folderview.plus/"], link[href*="/plugins/folderview.plus/"]').forEach((node) => {
                const rawUrl = String(node?.src || node?.href || '').trim();
                if (!rawUrl || seen.has(rawUrl)) {
                    return;
                }
                seen.add(rawUrl);
                let pathname = rawUrl;
                let rawVersionQuery = '';
                let versionQuery = '';
                let bootQuery = '';
                let versionSource = 'none';
                try {
                    const parsed = new URL(rawUrl, root?.location?.origin || 'http://fvplus.local');
                    pathname = parsed.pathname || rawUrl;
                    rawVersionQuery = String(parsed.searchParams.get('v') || '');
                    versionQuery = normalizeAssetVersionToken(rawVersionQuery);
                    bootQuery = String(parsed.searchParams.get('boot') || '');
                } catch (_error) {
                    pathname = rawUrl.replace(/^https?:\/\/[^/?#]+/i, '').replace(/[?#].*$/, '') || rawUrl;
                }
                if (versionQuery) {
                    versionSource = 'query';
                } else if (fallbackVersionToken) {
                    versionQuery = fallbackVersionToken;
                    versionSource = 'bundleMeta.pluginVersion';
                }
                entries.push({
                    tag: String(node?.tagName || '').toLowerCase() || 'asset',
                    url: uiRedactor ? uiRedactor.redactUrl(`uiTelemetry.loadedAssets.entries.${entries.length}.url`, rawUrl) : pathname,
                    path: pathname,
                    rawVersionQuery,
                    versionQuery,
                    versionSource,
                    bootQuery,
                    async: node?.async === true,
                    defer: node?.defer === true,
                    rel: String(node?.rel || ''),
                    media: String(node?.media || ''),
                    loaded: node?.tagName === 'LINK' ? Boolean(node.sheet) : true
                });
            });
            return {
                count: entries.length,
                entries
            };
        };

        const collectBrowserConsoleErrors = () => {
            const fallbackStorage = readClientDiagnosticsStorageRecord(CONSOLE_ERROR_STORAGE_KEY);
            const apiSnapshot = (
                root?.FolderViewPlusFatalBanner
                && typeof root.FolderViewPlusFatalBanner.getBrowserConsoleErrorSnapshot === 'function'
            )
                ? root.FolderViewPlusFatalBanner.getBrowserConsoleErrorSnapshot()
                : null;
            const snapshot = apiSnapshot && typeof apiSnapshot === 'object' && !Array.isArray(apiSnapshot)
                ? apiSnapshot
                : {
                    storageKey: CONSOLE_ERROR_STORAGE_KEY,
                    maxEntries: CONSOLE_ERROR_LIMIT,
                    count: Array.isArray(fallbackStorage) ? fallbackStorage.length : 0,
                    entries: Array.isArray(fallbackStorage) ? fallbackStorage : []
                };
            return {
                storageKey: String(snapshot.storageKey || CONSOLE_ERROR_STORAGE_KEY),
                maxEntries: Number.isFinite(Number(snapshot.maxEntries)) ? Number(snapshot.maxEntries) : CONSOLE_ERROR_LIMIT,
                count: Number.isFinite(Number(snapshot.count)) ? Number(snapshot.count) : 0,
                entries: Array.isArray(snapshot.entries) ? snapshot.entries.slice(-CONSOLE_ERROR_LIMIT) : []
            };
        };

        return Object.freeze({
            collectBrowserCapabilities,
            collectClientStorageDiagnostics,
            collectCurrentPageTelemetry,
            collectLoadedAssetTelemetry,
            collectBrowserConsoleErrors
        });
    };

    return Object.freeze({
        createCollectors,
        clientStorageIsAvailable,
        CONSOLE_ERROR_STORAGE_KEY,
        CONSOLE_ERROR_LIMIT
    });
}));
