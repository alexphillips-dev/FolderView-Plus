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
    const NATIVE_ORGANIZER_SOURCES = new Set(['detect', 'docker-page', 'dashboard-page', 'settings', 'diagnostics']);
    const NATIVE_ORGANIZER_REASONS = new Set([
        '',
        'already_synced',
        'base_api_unavailable',
        'organizer_unavailable',
        'organizer_unsupported',
        'capability_available',
        'no_organizer_views',
        'sync_failed'
    ]);
    const NATIVE_ORGANIZER_FAILURE_CATEGORIES = new Set([
        '',
        'fetch_unavailable',
        'network',
        'authentication',
        'endpoint_unavailable',
        'http_error',
        'schema_unsupported',
        'graphql_error',
        'invalid_response',
        'aborted',
        'unknown'
    ]);
    const NATIVE_ORGANIZER_FAILURE_STAGES = new Set([
        '',
        'base_api_probe',
        'organizer_capability_probe',
        'organizer_read',
        'organizer_update',
        'organizer_create',
        'organizer_sync',
        'unknown'
    ]);

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
        const sanitizeUiRecord = (uiRedactor, fieldPath, key, value) => (
            uiRedactor && typeof uiRedactor.sanitizeValue === 'function'
                ? uiRedactor.sanitizeValue(fieldPath, key, value)
                : value
        );

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

        const normalizeEnum = (value, allowed, fallback = '') => {
            const normalized = String(value || '').trim().toLowerCase();
            const isAllowed = allowed instanceof Set
                ? allowed.has(normalized)
                : (Array.isArray(allowed) && allowed.includes(normalized));
            return isAllowed ? normalized : fallback;
        };

        const normalizeIsoTimestamp = (value) => {
            const parsed = Date.parse(String(value || ''));
            return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
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

        const collectClientStorageDiagnostics = () => {
            let preferenceSaves = null;
            try {
                const coordinator = root?.FolderViewPlusPrefsStore?.getDefaultCoordinator?.();
                preferenceSaves = coordinator?.getDiagnostics?.() || null;
            } catch (_error) {
                preferenceSaves = null;
            }
            const nativeOrganizerSource = readClientDiagnosticsStorageRecord(storageKeys.nativeOrganizer || '');
            const normalizePerformancePolicy = (source) => {
                if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
                return {
                    mode: normalizeEnum(source.mode, ['standard', 'adaptive', 'maximum'], 'standard'),
                    strict: source.strict === true,
                    reason: normalizeEnum(source.reason, ['standard-profile', 'adaptive-profile', 'large-library', 'measured-render-cost', 'maximum-profile'], 'standard-profile'),
                    folderCount: Math.max(0, Number(source.folderCount) || 0),
                    itemCount: Math.max(0, Number(source.itemCount) || 0),
                    renderMs: Math.max(0, Number(source.renderMs) || 0),
                    effectiveRefreshSeconds: Math.max(0, Number(source.effectiveRefreshSeconds) || 0),
                    expandRestoreLimit: source.expandRestoreLimit === null ? null : Math.max(0, Number(source.expandRestoreLimit) || 0),
                    previewStrategy: normalizeEnum(source.previewStrategy, ['immediate', 'deferred'], 'immediate'),
                    capturedAt: normalizeIsoTimestamp(source.capturedAt)
                };
            };
            const dockerPerformancePolicy = normalizePerformancePolicy(readClientDiagnosticsStorageRecord(storageKeys.dockerPerformancePolicy || ''));
            const vmPerformancePolicy = normalizePerformancePolicy(readClientDiagnosticsStorageRecord(storageKeys.vmPerformancePolicy || ''));
            const nativeOrganizer = nativeOrganizerSource && typeof nativeOrganizerSource === 'object'
                ? {
                    available: true,
                    schemaVersion: Math.max(0, Number(nativeOrganizerSource.schemaVersion) || 0),
                    checkedAt: normalizeIsoTimestamp(nativeOrganizerSource.checkedAt),
                    ok: nativeOrganizerSource.ok === true,
                    skipped: nativeOrganizerSource.skipped === true,
                    requested: nativeOrganizerSource.requested === true,
                    source: normalizeEnum(nativeOrganizerSource.source, NATIVE_ORGANIZER_SOURCES, 'detect'),
                    reason: normalizeEnum(nativeOrganizerSource.reason, NATIVE_ORGANIZER_REASONS),
                    failureCategory: normalizeEnum(nativeOrganizerSource.failureCategory, NATIVE_ORGANIZER_FAILURE_CATEGORIES),
                    failureStage: normalizeEnum(nativeOrganizerSource.failureStage, NATIVE_ORGANIZER_FAILURE_STAGES),
                    httpStatus: Math.max(0, Math.min(599, Number(nativeOrganizerSource.httpStatus) || 0)),
                    apiAvailable: nativeOrganizerSource.apiAvailable === true,
                    organizerApiAvailable: nativeOrganizerSource.organizerApiAvailable === true,
                    created: Math.max(0, Number(nativeOrganizerSource.created) || 0),
                    updated: Math.max(0, Number(nativeOrganizerSource.updated) || 0)
                }
                : { available: false };
            return {
                localStorageAvailable: clientStorageIsAvailable('localStorage'),
                sessionStorageAvailable: clientStorageIsAvailable('sessionStorage'),
                dockerListViewModeCookie: normalizeDockerListViewMode(readCookieValue('docker_listview_mode')),
                preferenceSaves,
                performancePolicies: {
                    docker: dockerPerformancePolicy,
                    vm: vmPerformancePolicy
                },
                nativeOrganizer,
                folderEditorDebug: {
                    launchPresent: Boolean(readClientDiagnosticsStorageRecord(storageKeys.launch || '')),
                    bootstrapPresent: Boolean(readClientDiagnosticsStorageRecord(storageKeys.bootstrap || '')),
                    surfacePresent: Boolean(readClientDiagnosticsStorageRecord(storageKeys.surface || ''))
                }
            };
        };

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

        const collectBrowserConsoleErrors = (options = {}) => {
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
            const sessionId = String(snapshot.sessionId || '').trim();
            const entries = (Array.isArray(snapshot.entries) ? snapshot.entries : [])
                .slice(-CONSOLE_ERROR_LIMIT)
                .map((entry) => {
                    const safeEntry = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry : {};
                    const entrySessionId = String(safeEntry.sessionId || '').trim();
                    return {
                        ...safeEntry,
                        observedPluginVersion: String(safeEntry.observedPluginVersion || 'unknown').trim() || 'unknown',
                        currentSession: safeEntry.currentSession === true || Boolean(sessionId && entrySessionId === sessionId)
                    };
                });
            const timestamps = entries
                .map((entry) => String(entry.at || '').trim())
                .filter(Boolean)
                .sort();
            const currentSessionCount = entries.filter((entry) => entry.currentSession === true).length;
            return {
                storageKey: String(snapshot.storageKey || CONSOLE_ERROR_STORAGE_KEY),
                maxEntries: Number.isFinite(Number(snapshot.maxEntries)) ? Number(snapshot.maxEntries) : CONSOLE_ERROR_LIMIT,
                count: entries.length,
                collectionPluginVersion: String(
                    snapshot.collectionPluginVersion || options.pluginVersion || 'unknown'
                ).trim() || 'unknown',
                firstSeenAt: String(snapshot.firstSeenAt || timestamps[0] || '').trim() || null,
                lastSeenAt: String(snapshot.lastSeenAt || timestamps[timestamps.length - 1] || '').trim() || null,
                sessionId: sessionId || null,
                sessionStartedAt: String(snapshot.sessionStartedAt || '').trim() || null,
                currentSessionCount,
                historicalCount: Math.max(0, entries.length - currentSessionCount),
                entries
            };
        };

        const collectDockerPageDiagnostics = (uiRedactor) => {
            const record = readClientDiagnosticsStorageRecord(storageKeys.dockerPage || '');
            if (!record || typeof record !== 'object' || Array.isArray(record)) {
                return { available: false };
            }
            return sanitizeUiRecord(uiRedactor, 'uiTelemetry.dockerDiagnostics.pageSnapshot', 'pageSnapshot', {
                available: true,
                ...record
            });
        };

        const collectDockerBulkUpdateTrace = (uiRedactor) => {
            const record = readClientDiagnosticsStorageRecord(storageKeys.dockerBulkUpdateTrace || '');
            if (!record || typeof record !== 'object' || Array.isArray(record)) {
                return { available: false };
            }
            return sanitizeUiRecord(uiRedactor, 'uiTelemetry.dockerDiagnostics.bulkUpdateTrace', 'bulkUpdateTrace', {
                available: true,
                ...record
            });
        };
        const collectDockerRequestBundleTrace = (uiRedactor) => {
            const record = readClientDiagnosticsStorageRecord(storageKeys.dockerRequestBundleTrace || '');
            if (!record || typeof record !== 'object' || Array.isArray(record)) {
                return { available: false };
            }
            return sanitizeUiRecord(uiRedactor, 'uiTelemetry.dockerDiagnostics.requestBundleTrace', 'requestBundleTrace', {
                available: true,
                ...record
            });
        };
        const collectDockerTraceHealth = (uiRedactor) => {
            const record = readClientDiagnosticsStorageRecord(storageKeys.dockerTraceHealth || '');
            if (!record || typeof record !== 'object' || Array.isArray(record)) {
                return { available: false };
            }
            return sanitizeUiRecord(uiRedactor, 'uiTelemetry.dockerDiagnostics.traceHealth', 'traceHealth', {
                available: true,
                ...record
            });
        };

        return Object.freeze({
            collectBrowserCapabilities,
            collectClientStorageDiagnostics,
            collectCurrentPageTelemetry,
            collectLoadedAssetTelemetry,
            collectBrowserConsoleErrors,
            collectDockerPageDiagnostics,
            collectDockerBulkUpdateTrace,
            collectDockerRequestBundleTrace,
            collectDockerTraceHealth
        });
    };

    return Object.freeze({
        createCollectors,
        clientStorageIsAvailable,
        CONSOLE_ERROR_STORAGE_KEY,
        CONSOLE_ERROR_LIMIT
    });
}));
