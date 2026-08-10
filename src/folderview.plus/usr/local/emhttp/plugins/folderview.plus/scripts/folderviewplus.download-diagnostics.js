(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(root);
        return;
    }
    root.FolderViewPlusDownloadDiagnostics = factory(root);
}(typeof globalThis !== 'undefined' ? globalThis : this, function(root) {
    const STORAGE_KEY = 'fv.support.bundle.downloadAttempts.v1';
    const ATTEMPT_LIMIT = 12;
    const ATTEMPT_TTL_MS = 24 * 60 * 60 * 1000;
    const TYPES = ['docker', 'vm', 'plugin'];
    const MODES = ['single', 'full', 'branch', 'rules', 'templates', 'environment', 'support-bundle', 'other'];
    const SURFACES = ['settings', 'docker', 'vm', 'dashboard', 'unknown'];

    const normalizeEnum = (value, allowed, fallback) => {
        const normalized = String(value || '').trim().toLowerCase();
        return allowed.includes(normalized) ? normalized : fallback;
    };
    const normalizeAttemptId = (value) => (
        String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)
    );
    const nowIso = () => new Date().toISOString();
    const payloadSizeBucket = (size) => {
        const bytes = Math.max(0, Number(size) || 0);
        if (bytes === 0) return 'empty';
        if (bytes < 100 * 1024) return 'under-100-kib';
        if (bytes < 1024 * 1024) return '100-kib-to-1-mib';
        if (bytes < 10 * 1024 * 1024) return '1-to-10-mib';
        return 'over-10-mib';
    };
    const createAttemptId = () => {
        try {
            if (root?.crypto && typeof root.crypto.randomUUID === 'function') {
                return normalizeAttemptId(root.crypto.randomUUID());
            }
        } catch (_error) {
            // Fall through to a short, opaque random identifier.
        }
        return normalizeAttemptId(`download-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 18)}`);
    };
    const normalizeContext = (context = {}) => ({
        type: normalizeEnum(context.type, TYPES, 'plugin'),
        mode: normalizeEnum(context.mode, MODES, 'other'),
        surface: normalizeEnum(context.surface, SURFACES, 'settings'),
        folderCount: Math.max(0, Math.min(100000, Math.floor(Number(context.folderCount) || 0))),
        exportSchemaVersion: String(context.schemaVersion ?? '').trim().slice(0, 32)
    });
    const createFailure = (code, message) => {
        const error = new Error(message);
        error.name = 'DownloadDispatchError';
        error.fvplusDownloadFailureCode = code;
        return error;
    };

    const createDownloadDiagnostics = (options = {}) => {
        const storageKey = String(options.storageKey || STORAGE_KEY);
        const maxAttempts = Math.max(1, Math.min(50, Number(options.maxAttempts) || ATTEMPT_LIMIT));
        const ttlMs = Math.max(60_000, Number(options.ttlMs) || ATTEMPT_TTL_MS);
        const retryPayloads = new Map();

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
                return Boolean(getStorage());
            } catch (_error) {
                return false;
            }
        };
        const persistAttempt = (attempt) => {
            const record = readRecord();
            const attemptId = normalizeAttemptId(attempt?.attemptId);
            const attempts = record.attempts.filter((entry) => (
                normalizeAttemptId(entry?.attemptId) !== attemptId
            ));
            attempts.push({ ...attempt, storagePersisted: true });
            const persisted = writeAttempts(attempts);
            attempt.storagePersisted = persisted;
            return persisted;
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
                visibilityState: normalizeEnum(
                    documentRef?.visibilityState,
                    ['visible', 'hidden', 'prerender'],
                    'unknown'
                ),
                documentFocused: focused,
                secureContext: typeof root?.isSecureContext === 'boolean' ? root.isSecureContext : null
            };
        };
        const rememberAttempt = (attempt, name, content, context) => {
            persistAttempt(attempt);
            rememberRetryPayload(attempt.attemptId, {
                name: String(name || 'folderview-plus-export.json'),
                content,
                context
            });
            return attempt;
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
                const attempt = rememberAttempt({
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
                    verdict: { status: 'indeterminate', code: 'browser-save-unconfirmed' },
                    fallback: { used: Boolean(retryOfId), retryOf: retryOfId || null },
                    storagePersisted: false
                }, name, content, safeContext);
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
                if (typeof root?.setTimeout === 'function') root.setTimeout(cleanup, 1000);
                else cleanup();
                return attempt;
            } catch (error) {
                try {
                    if (appended && element?.parentNode) element.parentNode.removeChild(element);
                    if (url && root?.URL) root.URL.revokeObjectURL(url);
                } catch (_cleanupError) {
                    // Preserve the original dispatch failure.
                }
                stages.push({ state: 'synchronous-failure', at: nowIso() });
                const attempt = rememberAttempt({
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
                        code: String(error?.fvplusDownloadFailureCode || 'dispatch-exception').slice(0, 64)
                    },
                    fallback: { used: Boolean(retryOfId), retryOf: retryOfId || null },
                    exceptionName: String(error?.name || 'Error').slice(0, 64),
                    storagePersisted: false
                }, name, content, safeContext);
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
                        fallback: { ...(entry.fallback || {}), used: false, unavailable: true }
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
                attempt: dispatch({ ...payload, retryOf: normalizedId })
            };
        };

        return Object.freeze({ dispatch, reportMissing, retry, readRecord });
    };

    const createCollectors = (deps = {}) => {
        const readRecord = typeof deps.readClientDiagnosticsStorageRecord === 'function'
            ? deps.readClientDiagnosticsStorageRecord
            : (() => null);
        const storageKeys = deps.storageKeys && typeof deps.storageKeys === 'object'
            ? deps.storageKeys
            : {};
        const sanitize = (uiRedactor, fieldPath, key, value) => (
            uiRedactor && typeof uiRedactor.sanitizeValue === 'function'
                ? uiRedactor.sanitizeValue(fieldPath, key, value)
                : value
        );

        const collectDownloadAttempts = (uiRedactor) => {
            const record = readRecord(storageKeys.downloadAttempts || STORAGE_KEY);
            const cutoff = Date.now() - ATTEMPT_TTL_MS;
            const attempts = (Array.isArray(record?.attempts) ? record.attempts : [])
                .filter((entry) => {
                    const timestamp = Date.parse(String(entry?.attemptedAt || entry?.updatedAt || ''));
                    return Number.isFinite(timestamp) && timestamp >= cutoff;
                })
                .slice(-ATTEMPT_LIMIT)
                .map((entry) => ({
                    schemaVersion: 1,
                    attemptId: normalizeAttemptId(entry?.attemptId),
                    attemptedAt: String(entry?.attemptedAt || ''),
                    updatedAt: String(entry?.updatedAt || ''),
                    type: normalizeEnum(entry?.type, TYPES, 'plugin'),
                    mode: normalizeEnum(entry?.mode, MODES, 'other'),
                    surface: normalizeEnum(entry?.surface, SURFACES, 'unknown'),
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
                        retryOf: entry?.fallback?.retryOf
                            ? normalizeAttemptId(entry.fallback.retryOf)
                            : null,
                        unavailable: entry?.fallback?.unavailable === true
                    },
                    storagePersisted: entry?.storagePersisted === true,
                    exceptionName: entry?.exceptionName ? String(entry.exceptionName).slice(0, 64) : null
                }));
            const countStatus = (status) => attempts.filter((entry) => entry.verdict.status === status).length;
            return sanitize(uiRedactor, 'uiTelemetry.downloadAttempts', 'downloadAttempts', {
                schemaVersion: 1,
                available: attempts.length > 0,
                count: attempts.length,
                confirmedFailureCount: countStatus('confirmed-failure'),
                probableRestrictionCount: countStatus('probable-browser-restriction'),
                indeterminateCount: countStatus('indeterminate'),
                latestVerdict: attempts.length ? attempts[attempts.length - 1].verdict : null,
                attempts
            });
        };

        return Object.freeze({ collectDownloadAttempts });
    };

    return Object.freeze({
        createDownloadDiagnostics,
        createCollectors,
        DOWNLOAD_ATTEMPTS_STORAGE_KEY: STORAGE_KEY,
        DOWNLOAD_ATTEMPTS_LIMIT: ATTEMPT_LIMIT,
        DOWNLOAD_ATTEMPTS_TTL_MS: ATTEMPT_TTL_MS
    });
}));
