// @ts-check
(function runtimeTransportCoreModule(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    const modules = root.FolderViewPlusFoundationModules || {};
    modules.transportCore = factory();
    root.FolderViewPlusFoundationModules = modules;
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function runtimeTransportCoreFactory() {
    'use strict';

    const GRAPHQL_ENDPOINT = '/graphql';

    const createClient = (fallbackWindow = {}) => {
        const diagnostics = [];
        const staleGenerations = new Map();

        class RuntimeTransportError extends Error {
            constructor(message, options = {}) {
                super(String(message || 'Runtime transport request failed.'));
                this.name = 'RuntimeTransportError';
                this.category = String(options.category || 'request-failed');
                this.status = Number.isFinite(Number(options.status)) ? Number(options.status) : 0;
                this.retryable = options.retryable === true;
                this.partialData = options.partialData || null;
            }
        }

        const clone = (value) => {
            try {
                return JSON.parse(JSON.stringify(value));
            } catch (_error) {
                return null;
            }
        };
        const record = (event, details = {}) => {
            diagnostics.push({
                event: String(event || 'runtime-transport'),
                at: new Date().toISOString(),
                ...details
            });
            if (diagnostics.length > 100) diagnostics.splice(0, diagnostics.length - 100);
        };
        const csrfToken = (win = fallbackWindow) => String(win?.csrf_token || '').trim();
        const buildHeaders = (options = {}, win = fallbackWindow) => {
            const headers = {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            };
            const token = String(options.csrfToken || csrfToken(win)).trim();
            if (token && !Object.keys(headers).some((name) => name.toLowerCase() === 'x-csrf-token')) {
                headers['x-csrf-token'] = token;
            }
            return headers;
        };
        const classifyHttpError = (status) => {
            if (status === 401) return { category: 'authentication-required', message: 'GraphQL authentication is required.', retryable: false };
            if (status === 403) return { category: 'permission-denied', message: 'GraphQL permission was denied.', retryable: false };
            if (status === 429) return { category: 'rate-limited', message: 'GraphQL request was rate limited.', retryable: true };
            if (status >= 500) return { category: 'service-unavailable', message: 'The GraphQL service is unavailable.', retryable: true };
            return { category: 'http-error', message: 'The GraphQL request was rejected.', retryable: false };
        };
        const classifyGraphqlErrors = (errors = []) => {
            const text = errors.map((entry) => String(entry?.message || '')).join(' ').toLowerCase();
            const codes = errors.map((entry) => String(entry?.extensions?.code || '').toLowerCase());
            if (codes.some((code) => code.includes('unauth')) || /authenticat|not logged/.test(text)) {
                return { category: 'authentication-required', message: 'GraphQL authentication is required.', retryable: false };
            }
            if (codes.some((code) => code.includes('forbidden')) || /forbidden|permission|not authorized/.test(text)) {
                return { category: 'permission-denied', message: 'GraphQL permission was denied.', retryable: false };
            }
            if (/cannot query field|unknown (?:field|argument|type)|validation/.test(text)) {
                return { category: 'capability-unavailable', message: 'The requested GraphQL capability is unavailable.', retryable: false };
            }
            return { category: 'graphql-error', message: 'The GraphQL operation failed.', retryable: false };
        };
        const createAbortBoundary = (options = {}, win = fallbackWindow) => {
            const timeoutMs = Math.max(0, Number(options.timeoutMs) || 0);
            const externalSignal = options.signal || null;
            const Controller = win?.AbortController || (typeof AbortController !== 'undefined' ? AbortController : null);
            if (!Controller || (!timeoutMs && !externalSignal)) {
                return { signal: externalSignal || undefined, cleanup: () => {}, timedOut: () => false };
            }
            const controller = new Controller();
            let didTimeout = false;
            let timer = null;
            const abortFromExternal = () => controller.abort(externalSignal?.reason);
            if (externalSignal?.aborted) abortFromExternal();
            else externalSignal?.addEventListener?.('abort', abortFromExternal, { once: true });
            if (timeoutMs) {
                timer = win.setTimeout(() => {
                    didTimeout = true;
                    controller.abort();
                }, timeoutMs);
            }
            return {
                signal: controller.signal,
                timedOut: () => didTimeout,
                cleanup: () => {
                    if (timer !== null) win.clearTimeout(timer);
                    externalSignal?.removeEventListener?.('abort', abortFromExternal);
                }
            };
        };

        const query = async (document, variables = {}, options = {}) => {
            const win = options.window || fallbackWindow;
            if (typeof win?.fetch !== 'function') {
                throw new RuntimeTransportError('Fetch is unavailable.', {
                    category: 'fetch-unavailable',
                    retryable: false
                });
            }
            const operation = String(options.operation || 'graphql').trim() || 'graphql';
            const endpoint = String(options.endpoint || GRAPHQL_ENDPOINT);
            const staleKey = String(options.staleKey || '').trim();
            const generation = staleKey
                ? (staleGenerations.get(staleKey) || 0) + 1
                : 0;
            if (staleKey) staleGenerations.set(staleKey, generation);
            const abortBoundary = createAbortBoundary(options, win);
            const startedAt = Date.now();
            try {
                const response = await win.fetch(endpoint, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: buildHeaders(options, win),
                    body: JSON.stringify({
                        query: String(document || ''),
                        variables: variables && typeof variables === 'object' ? variables : {}
                    }),
                    signal: abortBoundary.signal
                });
                if (staleKey && staleGenerations.get(staleKey) !== generation) {
                    throw new RuntimeTransportError('A newer request replaced this response.', {
                        category: 'stale-response',
                        retryable: false
                    });
                }
                const payload = await response.json().catch(() => null);
                if (staleKey && staleGenerations.get(staleKey) !== generation) {
                    throw new RuntimeTransportError('A newer request replaced this response.', {
                        category: 'stale-response',
                        retryable: false
                    });
                }
                const durationMs = Date.now() - startedAt;
                if (!response.ok) {
                    const classification = classifyHttpError(response.status);
                    record('graphql', {
                        operation,
                        ok: false,
                        status: response.status,
                        durationMs,
                        category: classification.category
                    });
                    throw new RuntimeTransportError(classification.message, {
                        ...classification,
                        status: response.status
                    });
                }
                if (!payload || typeof payload !== 'object') {
                    record('graphql', {
                        operation,
                        ok: false,
                        status: response.status,
                        durationMs,
                        category: 'invalid-response'
                    });
                    throw new RuntimeTransportError('The GraphQL service returned an invalid response.', {
                        category: 'invalid-response',
                        retryable: true
                    });
                }
                if (Array.isArray(payload.errors) && payload.errors.length > 0) {
                    const classification = classifyGraphqlErrors(payload.errors);
                    const partialData = payload.data && typeof payload.data === 'object' ? payload.data : null;
                    record('graphql', {
                        operation,
                        ok: options.allowPartialData === true && Boolean(partialData),
                        partial: Boolean(partialData),
                        status: response.status,
                        durationMs,
                        category: classification.category
                    });
                    if (options.allowPartialData === true && partialData) return partialData;
                    throw new RuntimeTransportError(classification.message, {
                        ...classification,
                        partialData
                    });
                }
                record('graphql', {
                    operation,
                    ok: true,
                    status: response.status,
                    durationMs
                });
                return payload.data || {};
            } catch (rawError) {
                if (rawError instanceof RuntimeTransportError) throw rawError;
                const aborted = rawError?.name === 'AbortError';
                const category = aborted
                    ? (abortBoundary.timedOut() ? 'timeout' : 'aborted')
                    : 'offline';
                record('graphql', {
                    operation,
                    ok: false,
                    status: 0,
                    durationMs: Date.now() - startedAt,
                    category
                });
                throw new RuntimeTransportError(
                    category === 'timeout'
                        ? 'The GraphQL request timed out.'
                        : (category === 'aborted' ? 'The GraphQL request was cancelled.' : 'The GraphQL service could not be reached.'),
                    { category, retryable: category === 'timeout' || category === 'offline' }
                );
            } finally {
                abortBoundary.cleanup();
            }
        };

        return Object.freeze({
            RuntimeTransportError,
            clone,
            csrfToken,
            diagnostics: () => diagnostics.map((entry) => ({ ...entry })),
            query,
            record
        });
    };

    return Object.freeze({ createClient });
}));
