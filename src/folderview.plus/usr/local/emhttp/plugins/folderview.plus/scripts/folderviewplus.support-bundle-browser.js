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
    const DOWNLOAD_ATTEMPTS_STORAGE_KEY = 'fv.support.bundle.downloadAttempts.v1';
    const DOWNLOAD_ATTEMPTS_LIMIT = 12;
    const DOWNLOAD_ATTEMPTS_TTL_MS = 24 * 60 * 60 * 1000;
    const DASHBOARD_VISUAL_STALE_AFTER_MS = 30 * 60 * 1000;
    const clientStorageIsAvailable = (kind) => {
        try {
            return typeof root?.[kind] !== 'undefined';
        } catch (_error) {
            return false;
        }
    };

    const createDownloadDiagnostics = (options = {}) => {
        const storageKey = String(options.storageKey || DOWNLOAD_ATTEMPTS_STORAGE_KEY);
        const maxAttempts = Math.max(1, Math.min(50, Number(options.maxAttempts) || DOWNLOAD_ATTEMPTS_LIMIT));
        const ttlMs = Math.max(60_000, Number(options.ttlMs) || DOWNLOAD_ATTEMPTS_TTL_MS);
        const retryPayloads = new Map();

        const normalizeEnum = (value, allowed, fallback) => {
            const normalized = String(value || '').trim().toLowerCase();
            return allowed.includes(normalized) ? normalized : fallback;
        };
        const normalizeCount = (value) => Math.max(0, Math.min(100000, Math.floor(Number(value) || 0)));
        const normalizeVersion = (value) => String(value ?? '').trim().slice(0, 32);
        const normalizeAttemptId = (value) => String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
        const nowIso = () => new Date().toISOString();
        const createAttemptId = () => {
            try {
                if (root?.crypto && typeof root.crypto.randomUUID === 'function') {
                    return normalizeAttemptId(root.crypto.randomUUID());
                }
            } catch (_error) {
                // Fall through to a short, non-identifying random identifier.
            }
            const randomPart = Math.random().toString(16).slice(2, 18);
            return normalizeAttemptId(`download-${Date.now().toString(36)}-${randomPart}`);
        };
        const payloadSizeBucket = (size) => {
            const bytes = Math.max(0, Number(size) || 0);
            if (bytes === 0) return 'empty';
            if (bytes < 100 * 1024) return 'under-100-kib';
            if (bytes < 1024 * 1024) return '100-kib-to-1-mib';
            if (bytes < 10 * 1024 * 1024) return '1-to-10-mib';
            return 'over-10-mib';
        };
        const getStorage = () => {
            try {
                return root?.localStorage || null;
            } catch (_error) {
                return null;
            }
        };
        const readRecord = () => {
            try {
                const raw = String(getStorage()?.getItem(storageKey) || '').trim();
                if (!raw) return { schemaVersion: 1, updatedAt: '', attempts: [] };
                const parsed = JSON.parse(raw);
                return {
                    schemaVersion: 1,
                    updatedAt: String(parsed?.updatedAt || ''),
                    attempts: Array.isArray(parsed?.attempts) ? parsed.attempts : []
                };
            } catch (_error) {
                return { schemaVersion: 1, updatedAt: '', attempts: [] };
            }
        };
        const writeAttempts = (attempts) => {
            const cutoff = Date.now() - ttlMs;
            const retained = (Array.isArray(attempts) ? attempts : [])
                .filter((entry) => {
                    const timestamp = Date.parse(String(entry?.attemptedAt || entry?.updatedAt || ''));
                    return Number.isFinite(timestamp) && timestamp >= cutoff;
                })
                .slice(-maxAttempts);
            try {
                getStorage()?.setItem(storageKey, JSON.stringify({
                    schemaVersion: 1,
                    updatedAt: nowIso(),
                    attempts: retained
                }));
                return true;
            } catch (_error) {
                return false;
            }
        };
        const persistAttempt = (attempt) => {
            const record = readRecord();
            const attemptId = normalizeAttemptId(attempt?.attemptId);
            const next = record.attempts.filter((entry) => normalizeAttemptId(entry?.attemptId) !== attemptId);
            next.push(attempt);
            return writeAttempts(next);
        };
        const updateAttempt = (attemptId, updater) => {
            const normalizedId = normalizeAttemptId(attemptId);
            const record = readRecord();
            let updated = null;
            const attempts = record.attempts.map((entry) => {
                if (normalizeAttemptId(entry?.attemptId) !== normalizedId) return entry;
                updated = updater({ ...entry });
                return updated;
            });
            if (updated) writeAttempts(attempts);
            return updated;
        };
        const rememberRetryPayload = (attemptId, payload) => {
            retryPayloads.set(attemptId, payload);
            while (retryPayloads.size > 3) {
                retryPayloads.delete(retryPayloads.keys().next().value);
            }
        };
        const browserContext = (documentRef) => {
            const activation = root?.navigator?.userActivation;
            let focused = null;
            try {
                focused = documentRef && typeof documentRef.hasFocus === 'function'
                    ? documentRef.hasFocus() === true
                    : null;
            } catch (_error) {
                focused = null;
            }
            return {
                blobAvailable: typeof root?.Blob === 'function',
                objectUrlAvailable: Boolean(root?.URL && typeof root.URL.createObjectURL === 'function'),
                downloadAttributeAvailable: false,
                userActivationAvailable: Boolean(activation),
                userActivationActive: activation ? activation.isActive === true : null,
                userActivationEverActive: activation ? activation.hasBeenActive === true : null,
                visibilityState: normalizeEnum(documentRef?.visibilityState, ['visible', 'hidden', 'prerender'], 'unknown'),
                documentFocused: focused,
                secureContext: typeof root?.isSecureContext === 'boolean' ? root.isSecureContext : null
            };
        };
        const normalizeContext = (context = {}) => ({
            type: normalizeEnum(context.type, ['docker', 'vm', 'plugin'], 'plugin'),
            mode: normalizeEnum(
                context.mode,
                ['single', 'full', 'branch', 'rules', 'templates', 'environment', 'support-bundle', 'other'],
                'other'
            ),
            surface: normalizeEnum(context.surface, ['settings', 'docker', 'vm', 'dashboard', 'unknown'], 'settings'),
            folderCount: normalizeCount(context.folderCount),
            exportSchemaVersion: normalizeVersion(context.schemaVersion)
        });
        const createFailure = (code, message) => {
            const error = new Error(message);
            error.name = 'DownloadDispatchError';
            error.fvplusDownloadFailureCode = code;
            return error;
        };

        const dispatch = ({ name = '', content = '', context = {}, retryOf = null } = {}) => {
            const documentRef = root?.document || null;
            const safeContext = normalizeContext(context);
            const attemptedAt = nowIso();
            const attemptId = createAttemptId();
            const retryOfId = normalizeAttemptId(retryOf);
            const stages = [{ state: 'payload-generated', at: attemptedAt }];
            const browser = browserContext(documentRef);
            let blob = null;
            let url = '';
            let element = null;
            let appended = false;
            let attempt = null;

            try {
                if (!documentRef || typeof documentRef.createElement !== 'function' || !documentRef.body) {
                    throw createFailure('document-unavailable', 'The page cannot create a download element.');
                }
                if (typeof root?.Blob !== 'function') {
                    throw createFailure('blob-unavailable', 'The browser does not provide Blob downloads.');
                }
                if (!root?.URL || typeof root.URL.createObjectURL !== 'function') {
                    throw createFailure('object-url-unavailable', 'The browser does not provide object URL downloads.');
                }

                blob = new root.Blob([content], { type: 'application/json' });
                element = documentRef.createElement('a');
                browser.downloadAttributeAvailable = 'download' in element;
                if (!browser.downloadAttributeAvailable) {
                    throw createFailure('download-attribute-unavailable', 'The browser does not support file download links.');
                }
                url = root.URL.createObjectURL(blob);
                element.href = url;
                element.download = String(name || 'folderview-plus-export.json');
                element.style.display = 'none';
                documentRef.body.appendChild(element);
                appended = true;
                element.click();
                stages.push({ state: 'download-dispatch-attempted', at: nowIso() });
                attempt = {
                    schemaVersion: 1,
                    attemptId,
                    attemptedAt,
                    updatedAt: nowIso(),
                    ...safeContext,
                    payloadSizeBucket: payloadSizeBucket(blob.size),
                    mechanism: 'blob-anchor',
                    browser,
                    lifecycle: 'download-dispatch-attempted',
                    stages,
                    verdict: {
                        status: 'indeterminate',
                        code: 'browser-save-unconfirmed'
                    },
                    fallback: {
                        used: Boolean(retryOfId),
                        retryOf: retryOfId || null
                    },
                    storagePersisted: false
                };
                attempt.storagePersisted = persistAttempt(attempt);
                if (attempt.storagePersisted) persistAttempt(attempt);
                rememberRetryPayload(attemptId, {
                    name: String(name || 'folderview-plus-export.json'),
                    content,
                    context: safeContext
                });
                const cleanup = () => {
                    try {
                        if (appended && element?.parentNode) element.parentNode.removeChild(element);
                    } catch (_error) {
                        // Cleanup must not alter the export result.
                    }
                    try {
                        if (url) root.URL.revokeObjectURL(url);
                    } catch (_error) {
                        // Cleanup must not alter the export result.
                    }
                };
                if (typeof root?.setTimeout === 'function') {
                    root.setTimeout(cleanup, 1000);
                } else {
                    cleanup();
                }
                return attempt;
            } catch (error) {
                try {
                    if (appended && element?.parentNode) element.parentNode.removeChild(element);
                } catch (_cleanupError) {
                    // Preserve the original dispatch failure.
                }
                try {
                    if (url && root?.URL) root.URL.revokeObjectURL(url);
                } catch (_cleanupError) {
                    // Preserve the original dispatch failure.
                }
                const failureCode = String(error?.fvplusDownloadFailureCode || 'dispatch-exception').slice(0, 64);
                stages.push({ state: 'synchronous-failure', at: nowIso() });
                attempt = {
                    schemaVersion: 1,
                    attemptId,
                    attemptedAt,
                    updatedAt: nowIso(),
                    ...safeContext,
                    payloadSizeBucket: payloadSizeBucket(blob?.size || String(content || '').length),
                    mechanism: 'blob-anchor',
                    browser,
                    lifecycle: 'synchronous-failure',
                    stages,
                    verdict: {
                        status: 'confirmed-failure',
                        code: failureCode
                    },
                    fallback: {
                        used: Boolean(retryOfId),
                        retryOf: retryOfId || null
                    },
                    exceptionName: String(error?.name || 'Error').slice(0, 64),
                    storagePersisted: false
                };
                attempt.storagePersisted = persistAttempt(attempt);
                if (attempt.storagePersisted) persistAttempt(attempt);
                rememberRetryPayload(attemptId, {
                    name: String(name || 'folderview-plus-export.json'),
                    content,
                    context: safeContext
                });
                error.fvplusDownloadAttempt = attempt;
                throw error;
            }
        };

        const reportMissing = (attemptId) => updateAttempt(attemptId, (entry) => {
            const at = nowIso();
            const stages = Array.isArray(entry.stages) ? entry.stages.slice(-7) : [];
            stages.push({ state: 'user-reported-missing', at });
            return {
                ...entry,
                updatedAt: at,
                lifecycle: 'user-reported-missing',
                stages,
                verdict: {
                    status: 'probable-browser-restriction',
                    code: entry?.browser?.userActivationActive === false
                        ? 'missing-without-active-user-gesture'
                        : 'browser-save-not-observed'
                }
            };
        });

        const retry = (attemptId) => {
            const normalizedId = normalizeAttemptId(attemptId);
            const payload = retryPayloads.get(normalizedId);
            if (!payload) {
                return {
                    ok: false,
                    reason: 'retry-payload-unavailable',
                    attempt: updateAttempt(normalizedId, (entry) => ({
                        ...entry,
                        updatedAt: nowIso(),
                        fallback: {
                            ...(entry.fallback || {}),
                            used: false,
                            unavailable: true
                        }
                    }))
                };
            }
            updateAttempt(normalizedId, (entry) => ({
                ...entry,
                updatedAt: nowIso(),
                fallback: {
                    ...(entry.fallback || {}),
                    used: true,
                    retryRequestedAt: nowIso()
                }
            }));
            return {
                ok: true,
                attempt: dispatch({
                    ...payload,
                    retryOf: normalizedId
                })
            };
        };

        return Object.freeze({
            dispatch,
            reportMissing,
            retry,
            readRecord
        });
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
            return {
                localStorageAvailable: clientStorageIsAvailable('localStorage'),
                sessionStorageAvailable: clientStorageIsAvailable('sessionStorage'),
                dockerListViewModeCookie: normalizeDockerListViewMode(readCookieValue('docker_listview_mode')),
                preferenceSaves,
                performancePolicies: {
                    docker: dockerPerformancePolicy,
                    vm: vmPerformancePolicy
                },
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

        const collectDockerCompatibilityDiagnostics = (uiRedactor) => {
            const record = readClientDiagnosticsStorageRecord(storageKeys.dockerCompatibility || '');
            if (!record || typeof record !== 'object' || Array.isArray(record)) {
                return { available: false };
            }
            return sanitizeUiRecord(
                uiRedactor,
                'uiTelemetry.dockerDiagnostics.compatibility',
                'compatibility',
                { available: true, ...record }
            );
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

        const collectDashboardLayoutDiagnostics = (uiRedactor) => {
            const collectType = (type, storageKey) => {
                const record = readClientDiagnosticsStorageRecord(storageKey || '');
                if (!record || typeof record !== 'object' || Array.isArray(record)) {
                    return { available: false };
                }
                return sanitizeUiRecord(
                    uiRedactor,
                    `uiTelemetry.dashboardLayout.${type}`,
                    type,
                    { available: true, ...record }
                );
            };
            return {
                docker: collectType('docker', storageKeys.dashboardLayoutDocker),
                vm: collectType('vm', storageKeys.dashboardLayoutVm)
            };
        };

        const collectDashboardVisualDiagnostics = (uiRedactor, options = {}) => {
            const currentPluginVersion = String(options.pluginVersion || '').trim();
            const currentCapabilities = collectBrowserCapabilities();
            const collectType = (type, storageKey) => {
                const record = readClientDiagnosticsStorageRecord(storageKey || '');
                if (!record || typeof record !== 'object' || Array.isArray(record)) {
                    return {
                        available: false,
                        freshness: 'unavailable',
                        captureQuality: {
                            status: 'missing',
                            reasons: ['no-dashboard-visual-snapshot']
                        }
                    };
                }
                const latest = record.latest && typeof record.latest === 'object' && !Array.isArray(record.latest)
                    ? record.latest
                    : null;
                if (!latest) {
                    return {
                        available: false,
                        freshness: 'unavailable',
                        captureQuality: {
                            status: 'missing',
                            reasons: ['no-dashboard-visual-snapshot']
                        }
                    };
                }
                const capturedAtMs = Date.parse(String(latest.capturedAt || ''));
                const ageMs = Number.isFinite(capturedAtMs) ? Math.max(0, Date.now() - capturedAtMs) : null;
                const capturedPluginVersion = String(latest.pluginVersion || '').trim();
                const versionMismatch = Boolean(
                    currentPluginVersion
                    && capturedPluginVersion
                    && currentPluginVersion !== capturedPluginVersion
                );
                const stale = ageMs === null || ageMs > DASHBOARD_VISUAL_STALE_AFTER_MS;
                const capturedTouchCapable = Boolean(
                    Number(latest.environment?.input?.touchPoints || 0) > 0
                    || latest.environment?.input?.coarsePointer === true
                    || latest.environment?.input?.mobileHint === true
                );
                const currentTouchCapable = Boolean(
                    Number(currentCapabilities.touchPoints || 0) > 0
                    || root?.matchMedia?.('(pointer: coarse)')?.matches === true
                    || root?.navigator?.userAgentData?.mobile === true
                );
                const environmentMismatch = capturedTouchCapable !== currentTouchCapable
                    || String(latest.environment?.viewportClass || '') !== (
                        currentCapabilities.viewport?.width <= 600
                            ? 'phone-size'
                            : (currentCapabilities.viewport?.width <= 1024 ? 'tablet-size' : 'desktop-size')
                    );
                const reasons = [];
                if (versionMismatch) reasons.push('plugin-version-mismatch');
                if (stale) reasons.push('stale-dashboard-snapshot');
                if (environmentMismatch) reasons.push('export-environment-differs');
                if (latest.verdict?.status === 'error') reasons.push('render-verdict-error');
                if (latest.verdict?.status === 'warning') reasons.push('render-verdict-warning');
                const freshness = versionMismatch ? 'version-mismatch' : (stale ? 'stale' : 'fresh');
                const result = {
                    available: true,
                    schemaVersion: Math.max(1, Number(record.schemaVersion) || 1),
                    type,
                    capturedAt: String(latest.capturedAt || '') || null,
                    ageMs,
                    freshness,
                    capturedPluginVersion: capturedPluginVersion || null,
                    currentPluginVersion: currentPluginVersion || null,
                    capturedOnTouchCapableDevice: capturedTouchCapable,
                    capturedViewportClass: String(latest.environment?.viewportClass || '') || null,
                    environmentComparison: {
                        currentRoute: String(root?.location?.pathname || ''),
                        capturedRoute: String(latest.origin?.route || latest.environment?.route || ''),
                        currentTouchCapable,
                        capturedTouchCapable,
                        differs: environmentMismatch
                    },
                    captureQuality: {
                        status: reasons.length === 0 ? 'ready' : (latest.verdict?.status === 'error' ? 'error' : 'attention'),
                        reasons
                    },
                    latest,
                    historyCount: Array.isArray(record.snapshots) ? record.snapshots.length : 0,
                    snapshots: Array.isArray(record.snapshots) ? record.snapshots.slice(-12) : []
                };
                return sanitizeUiRecord(
                    uiRedactor,
                    `uiTelemetry.dashboardVisual.${type}`,
                    type,
                    result
                );
            };
            return {
                schemaVersion: 1,
                staleAfterMs: DASHBOARD_VISUAL_STALE_AFTER_MS,
                docker: collectType('docker', storageKeys.dashboardVisualDocker),
                vm: collectType('vm', storageKeys.dashboardVisualVm)
            };
        };

        const collectDashboardLifecycleDiagnostics = (uiRedactor) => {
            const record = readClientDiagnosticsStorageRecord(storageKeys.dashboardLifecycle || '');
            if (!record || typeof record !== 'object' || Array.isArray(record)) {
                return { available: false };
            }
            return sanitizeUiRecord(uiRedactor, 'uiTelemetry.dashboardLifecycle', 'dashboardLifecycle', {
                available: true,
                ...record
            });
        };

        const collectVmLifecycleDiagnostics = (uiRedactor) => {
            const record = readClientDiagnosticsStorageRecord(storageKeys.vmLifecycle || '');
            if (!record || typeof record !== 'object' || Array.isArray(record)) {
                return { available: false };
            }
            return sanitizeUiRecord(uiRedactor, 'uiTelemetry.vmLifecycle', 'vmLifecycle', {
                available: true,
                ...record
            });
        };

        const collectDownloadAttempts = (uiRedactor) => {
            const record = readClientDiagnosticsStorageRecord(
                storageKeys.downloadAttempts || DOWNLOAD_ATTEMPTS_STORAGE_KEY
            );
            const now = Date.now();
            const attempts = (Array.isArray(record?.attempts) ? record.attempts : [])
                .filter((entry) => {
                    const timestamp = Date.parse(String(entry?.attemptedAt || entry?.updatedAt || ''));
                    return Number.isFinite(timestamp) && timestamp >= now - DOWNLOAD_ATTEMPTS_TTL_MS;
                })
                .slice(-DOWNLOAD_ATTEMPTS_LIMIT)
                .map((entry) => ({
                    schemaVersion: 1,
                    attemptId: String(entry?.attemptId || '').slice(0, 80),
                    attemptedAt: String(entry?.attemptedAt || ''),
                    updatedAt: String(entry?.updatedAt || ''),
                    type: normalizeEnum(entry?.type, ['docker', 'vm', 'plugin'], 'plugin'),
                    mode: normalizeEnum(
                        entry?.mode,
                        ['single', 'full', 'branch', 'rules', 'templates', 'environment', 'support-bundle', 'other'],
                        'other'
                    ),
                    surface: normalizeEnum(entry?.surface, ['settings', 'docker', 'vm', 'dashboard', 'unknown'], 'unknown'),
                    folderCount: Math.max(0, Number(entry?.folderCount) || 0),
                    exportSchemaVersion: String(entry?.exportSchemaVersion || '').slice(0, 32),
                    payloadSizeBucket: normalizeEnum(
                        entry?.payloadSizeBucket,
                        ['empty', 'under-100-kib', '100-kib-to-1-mib', '1-to-10-mib', 'over-10-mib'],
                        'empty'
                    ),
                    mechanism: 'blob-anchor',
                    browser: {
                        blobAvailable: entry?.browser?.blobAvailable === true,
                        objectUrlAvailable: entry?.browser?.objectUrlAvailable === true,
                        downloadAttributeAvailable: entry?.browser?.downloadAttributeAvailable === true,
                        userActivationAvailable: entry?.browser?.userActivationAvailable === true,
                        userActivationActive: typeof entry?.browser?.userActivationActive === 'boolean'
                            ? entry.browser.userActivationActive
                            : null,
                        userActivationEverActive: typeof entry?.browser?.userActivationEverActive === 'boolean'
                            ? entry.browser.userActivationEverActive
                            : null,
                        visibilityState: normalizeEnum(
                            entry?.browser?.visibilityState,
                            ['visible', 'hidden', 'prerender', 'unknown'],
                            'unknown'
                        ),
                        documentFocused: typeof entry?.browser?.documentFocused === 'boolean'
                            ? entry.browser.documentFocused
                            : null,
                        secureContext: typeof entry?.browser?.secureContext === 'boolean'
                            ? entry.browser.secureContext
                            : null
                    },
                    lifecycle: normalizeEnum(
                        entry?.lifecycle,
                        ['download-dispatch-attempted', 'synchronous-failure', 'user-reported-missing'],
                        'download-dispatch-attempted'
                    ),
                    stages: (Array.isArray(entry?.stages) ? entry.stages : []).slice(-8).map((stage) => ({
                        state: normalizeEnum(
                            stage?.state,
                            ['payload-generated', 'download-dispatch-attempted', 'synchronous-failure', 'user-reported-missing'],
                            'payload-generated'
                        ),
                        at: String(stage?.at || '')
                    })),
                    verdict: {
                        status: normalizeEnum(
                            entry?.verdict?.status,
                            ['indeterminate', 'confirmed-failure', 'probable-browser-restriction'],
                            'indeterminate'
                        ),
                        code: String(entry?.verdict?.code || 'browser-save-unconfirmed').slice(0, 80)
                    },
                    fallback: {
                        used: entry?.fallback?.used === true,
                        retryOf: entry?.fallback?.retryOf ? String(entry.fallback.retryOf).slice(0, 80) : null,
                        unavailable: entry?.fallback?.unavailable === true
                    },
                    storagePersisted: entry?.storagePersisted === true,
                    exceptionName: entry?.exceptionName ? String(entry.exceptionName).slice(0, 64) : null
                }));
            const confirmedFailureCount = attempts.filter((entry) => entry.verdict.status === 'confirmed-failure').length;
            const probableRestrictionCount = attempts.filter((entry) => entry.verdict.status === 'probable-browser-restriction').length;
            const indeterminateCount = attempts.filter((entry) => entry.verdict.status === 'indeterminate').length;
            return sanitizeUiRecord(uiRedactor, 'uiTelemetry.downloadAttempts', 'downloadAttempts', {
                schemaVersion: 1,
                available: attempts.length > 0,
                count: attempts.length,
                confirmedFailureCount,
                probableRestrictionCount,
                indeterminateCount,
                latestVerdict: attempts.length > 0 ? attempts[attempts.length - 1].verdict : null,
                attempts
            });
        };

        return Object.freeze({
            collectBrowserCapabilities,
            collectClientStorageDiagnostics,
            collectCurrentPageTelemetry,
            collectLoadedAssetTelemetry,
            collectBrowserConsoleErrors,
            collectDockerPageDiagnostics,
            collectDockerCompatibilityDiagnostics,
            collectDockerBulkUpdateTrace,
            collectDockerRequestBundleTrace,
            collectDockerTraceHealth,
            collectDashboardLayoutDiagnostics,
            collectDashboardVisualDiagnostics,
            collectDashboardLifecycleDiagnostics,
            collectVmLifecycleDiagnostics,
            collectDownloadAttempts
        });
    };

    return Object.freeze({
        createDownloadDiagnostics,
        createCollectors,
        clientStorageIsAvailable,
        CONSOLE_ERROR_STORAGE_KEY,
        CONSOLE_ERROR_LIMIT,
        DOWNLOAD_ATTEMPTS_STORAGE_KEY,
        DOWNLOAD_ATTEMPTS_LIMIT,
        DOWNLOAD_ATTEMPTS_TTL_MS,
        DASHBOARD_VISUAL_STALE_AFTER_MS
    });
}));
