(() => {
    const DEFAULT_TOKEN_STORAGE_KEY = 'fv.request.token';
    const DEFAULT_TIMEOUT_MS = 15000;
    const DEFAULT_GET_RETRIES = 1;
    const DEFAULT_MUTATION_RETRIES = 0;
    const DEFAULT_RETRY_DELAY_MS = 220;
    const MAX_DIAGNOSTICS = 100;
    const RETRYABLE_STATUS_CODES = new Set([0, 408, 425, 429, 500, 502, 503, 504]);
    const TRACE_HEADER_NAME = 'X-FV-Trace';
    const TRACE_PAYLOAD_KEY = '_fv_trace';
    const TRANSACTION_HEADER_NAME = 'X-FV-Transaction';
    const TRANSACTION_PAYLOAD_KEY = '_fv_transaction';
    const requestDiagnostics = [];
    let securityPrefilterConfigured = false;

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
    const newTraceId = () => {
        const rand = Math.random().toString(16).slice(2, 10);
        return `fv-${Date.now().toString(36)}-${rand}`;
    };
    const transactionIdForTrace = (traceId) => `tx-${String(traceId || '').replace(/^fv-/, '').slice(0, 80)}`;

    const sanitizeDiagnosticUrl = (url) => {
        const raw = String(url || '').trim();
        if (!raw) {
            return '';
        }
        try {
            return new URL(raw, window.location?.origin || 'http://localhost').pathname;
        } catch (_error) {
            return raw.split(/[?#]/, 1)[0].slice(0, 240);
        }
    };

    const recordDiagnostic = (entry = {}) => {
        requestDiagnostics.push({
            at: new Date().toISOString(),
            method: String(entry.method || 'GET').toUpperCase(),
            endpoint: sanitizeDiagnosticUrl(entry.url),
            outcome: String(entry.outcome || 'unknown'),
            status: Math.max(0, Number(entry.status) || 0),
            durationMs: Math.max(0, Number(entry.durationMs) || 0),
            attempts: Math.max(1, Number(entry.attempts) || 1),
            traceId: String(entry.traceId || '').slice(0, 96),
            transactionId: String(entry.transactionId || '').slice(0, 96)
        });
        if (requestDiagnostics.length > MAX_DIAGNOSTICS) {
            requestDiagnostics.splice(0, requestDiagnostics.length - MAX_DIAGNOSTICS);
        }
    };

    const getDiagnostics = () => requestDiagnostics.map((entry) => ({ ...entry }));
    const clearDiagnostics = () => {
        requestDiagnostics.splice(0, requestDiagnostics.length);
    };

    const buildUrl = (url, query = {}) => {
        const raw = String(url || '').trim();
        if (!raw) {
            throw new Error('Request URL is required.');
        }
        const hashIndex = raw.indexOf('#');
        const hash = hashIndex >= 0 ? raw.slice(hashIndex) : '';
        const withoutHash = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw;
        const separator = withoutHash.includes('?') ? '&' : '?';
        const params = new URLSearchParams();
        Object.entries(query && typeof query === 'object' ? query : {}).forEach(([key, value]) => {
            if (value === undefined || value === null || value === '') {
                return;
            }
            if (Array.isArray(value)) {
                value.forEach((item) => params.append(key, String(item)));
                return;
            }
            params.set(key, String(value));
        });
        const encoded = params.toString();
        return encoded ? `${withoutHash}${separator}${encoded}${hash}` : raw;
    };

    const isMetaTag = (node) => (
        node
        && typeof node === 'object'
        && typeof node.content === 'string'
    );

    const getOptionalRequestToken = (_tokenStorageKey = DEFAULT_TOKEN_STORAGE_KEY) => {
        const metaToken = document.querySelector('meta[name="fv-request-token"]');
        if (isMetaTag(metaToken)) {
            return String(metaToken.content || '').trim();
        }
        return '';
    };

    const buildHeaders = (extraHeaders = {}, tokenStorageKey = DEFAULT_TOKEN_STORAGE_KEY, resolvedToken = '', traceId = '') => {
        const headers = {
            'X-FV-Request': '1',
            ...(extraHeaders || {})
        };
        const token = String(resolvedToken || getOptionalRequestToken(tokenStorageKey) || '').trim();
        if (token) {
            headers['X-FV-Token'] = token;
        }
        const trace = String(traceId || '').trim();
        if (trace) {
            headers[TRACE_HEADER_NAME] = trace;
            headers[TRANSACTION_HEADER_NAME] = transactionIdForTrace(trace);
        }
        return headers;
    };

    const isPlainObject = (value) => (
        value !== null
        && typeof value === 'object'
        && Object.prototype.toString.call(value) === '[object Object]'
    );

    const addMutationPayloadMarkers = (method, data, token, traceId = '') => {
        if (String(method || '').toUpperCase() !== 'POST') {
            return data;
        }
        const safeToken = String(token || '').trim();
        const safeTraceId = String(traceId || '').trim();
        const safeTransactionId = safeTraceId ? transactionIdForTrace(safeTraceId) : '';
        if (typeof FormData !== 'undefined' && data instanceof FormData) {
            if (!data.has('_fv_request')) {
                data.append('_fv_request', '1');
            }
            if (safeToken && !data.has('token')) {
                data.append('token', safeToken);
            }
            if (safeTraceId && !data.has(TRACE_PAYLOAD_KEY)) {
                data.append(TRACE_PAYLOAD_KEY, safeTraceId);
            }
            if (safeTransactionId && !data.has(TRANSACTION_PAYLOAD_KEY)) {
                data.append(TRANSACTION_PAYLOAD_KEY, safeTransactionId);
            }
            return data;
        }
        if (typeof URLSearchParams !== 'undefined' && data instanceof URLSearchParams) {
            if (!data.has('_fv_request')) {
                data.set('_fv_request', '1');
            }
            if (safeToken && !data.has('token')) {
                data.set('token', safeToken);
            }
            if (safeTraceId && !data.has(TRACE_PAYLOAD_KEY)) {
                data.set(TRACE_PAYLOAD_KEY, safeTraceId);
            }
            if (safeTransactionId && !data.has(TRANSACTION_PAYLOAD_KEY)) {
                data.set(TRANSACTION_PAYLOAD_KEY, safeTransactionId);
            }
            return data;
        }
        const payload = isPlainObject(data) ? { ...data } : {};
        if (!Object.prototype.hasOwnProperty.call(payload, '_fv_request')) {
            payload._fv_request = '1';
        }
        if (safeToken && !Object.prototype.hasOwnProperty.call(payload, 'token')) {
            payload.token = safeToken;
        }
        if (safeTraceId && !Object.prototype.hasOwnProperty.call(payload, TRACE_PAYLOAD_KEY)) {
            payload[TRACE_PAYLOAD_KEY] = safeTraceId;
        }
        if (safeTransactionId && !Object.prototype.hasOwnProperty.call(payload, TRANSACTION_PAYLOAD_KEY)) {
            payload[TRANSACTION_PAYLOAD_KEY] = safeTransactionId;
        }
        return payload;
    };

    const configureSecurityHeaders = ({ tokenStorageKey = DEFAULT_TOKEN_STORAGE_KEY } = {}) => {
        if (securityPrefilterConfigured || !window.$ || typeof window.$.ajaxPrefilter !== 'function') {
            return;
        }
        securityPrefilterConfigured = true;
        window.$.ajaxPrefilter((options = {}) => {
            const endpoint = sanitizeDiagnosticUrl(options.url);
            if (!endpoint.startsWith('/plugins/folderview.plus/')) {
                return;
            }
            options.headers = buildHeaders(options.headers || {}, tokenStorageKey);
        });
    };

    const toAjaxPromise = (options, signal = null, onRequest = null) => new Promise((resolve, reject) => {
        if (!window.$ || typeof window.$.ajax !== 'function') {
            reject(new Error('jQuery.ajax is not available.'));
            return;
        }

        const request = window.$.ajax(options);
        if (typeof onRequest === 'function') {
            onRequest(request);
        }
        const abortRequest = () => {
            if (request && typeof request.abort === 'function') {
                request.abort();
            }
        };
        if (signal?.aborted === true) {
            abortRequest();
        } else if (signal && typeof signal.addEventListener === 'function') {
            signal.addEventListener('abort', abortRequest, { once: true });
        }
        const cleanup = () => {
            if (signal && typeof signal.removeEventListener === 'function') {
                signal.removeEventListener('abort', abortRequest);
            }
        };

        request
            .done((data, textStatus, jqXHR) => {
                cleanup();
                resolve({ data, textStatus, jqXHR });
            })
            .fail((jqXHR, textStatus, errorThrown) => {
                cleanup();
                reject({ jqXHR, textStatus, errorThrown });
            });
    });

    const shouldRetryError = (error) => {
        const textStatus = String(error?.textStatus || '').toLowerCase();
        const status = Number(error?.jqXHR?.status || 0);
        if (textStatus === 'abort') {
            return false;
        }
        if (textStatus === 'timeout') {
            return true;
        }
        return RETRYABLE_STATUS_CODES.has(status);
    };

    const extractServerErrorMessage = (error) => {
        const responseJson = error?.jqXHR?.responseJSON;
        if (responseJson && typeof responseJson === 'object') {
            const jsonMessage = responseJson.error || responseJson.message || responseJson.detail || '';
            if (jsonMessage) {
                return String(jsonMessage).trim();
            }
        }

        const responseText = String(error?.jqXHR?.responseText || '').trim();
        if (!responseText) {
            return '';
        }

        try {
            const parsed = JSON.parse(responseText);
            if (parsed && typeof parsed === 'object') {
                const parsedMessage = parsed.error || parsed.message || parsed.detail || '';
                if (parsedMessage) {
                    return String(parsedMessage).trim();
                }
            }
        } catch (_ignored) {
            // Plain-text response; keep fallback below.
        }

        const firstLine = responseText.split(/\r?\n/).find((line) => String(line || '').trim() !== '');
        if (!firstLine) {
            return '';
        }
        const trimmed = String(firstLine).trim();
        return trimmed.length > 240 ? `${trimmed.slice(0, 237)}...` : trimmed;
    };

    const formatAjaxError = (error, url, traceId = '') => {
        if (error instanceof Error) {
            return error;
        }
        const status = Number(error?.jqXHR?.status || 0);
        const textStatus = String(error?.textStatus || '').trim();
        const statusText = String(error?.jqXHR?.statusText || '').trim();
        const errorThrown = String(error?.errorThrown || '').trim();
        const serverDetail = extractServerErrorMessage(error);
        const pieces = [
            `Request failed for ${url}.`
        ];
        if (status) {
            pieces.push(`HTTP ${status}`);
        }
        if (statusText) {
            pieces.push(statusText);
        }
        if (textStatus && textStatus !== statusText) {
            pieces.push(`(${textStatus})`);
        }
        if (errorThrown && errorThrown !== statusText) {
            pieces.push(errorThrown);
        }
        if (serverDetail) {
            pieces.push(`- ${serverDetail}`);
        }
        if (traceId) {
            pieces.push(`(trace: ${traceId})`);
        }
        const formatted = new Error(pieces.join(' '));
        formatted.status = status;
        formatted.httpStatus = status;
        formatted.traceId = traceId;
        formatted.response = error?.jqXHR?.responseJSON || null;
        return formatted;
    };

    const request = async ({
        method = 'GET',
        url,
        data = undefined,
        timeoutMs = DEFAULT_TIMEOUT_MS,
        retries = null,
        retryDelayMs = DEFAULT_RETRY_DELAY_MS,
        headers = {},
        tokenStorageKey = DEFAULT_TOKEN_STORAGE_KEY,
        cache = undefined,
        processData = undefined,
        contentType = undefined,
        dataType = undefined,
        xhr = undefined,
        signal = null,
        onRequest = null
    }) => {
        if (!url) {
            throw new Error('Request URL is required.');
        }
        const normalizedMethod = String(method || 'GET').toUpperCase();
        const defaultRetries = ['GET', 'HEAD'].includes(normalizedMethod)
            ? DEFAULT_GET_RETRIES
            : DEFAULT_MUTATION_RETRIES;
        const safeRetries = retries === null || retries === undefined
            ? defaultRetries
            : Math.max(0, Number(retries) || 0);
        const safeTimeoutMs = Math.max(1000, Number(timeoutMs) || DEFAULT_TIMEOUT_MS);
        const startedAt = Date.now();
        let lastError = null;
        let attempts = 0;
        const token = getOptionalRequestToken(tokenStorageKey);
        if (normalizedMethod === 'POST' && !token) {
            throw new Error('A mutation request token is required. Refresh the FolderView Plus page and try again.');
        }
        const traceId = newTraceId();
        const transactionId = transactionIdForTrace(traceId);
        const payload = addMutationPayloadMarkers(normalizedMethod, data, token, traceId);

        for (let attempt = 0; attempt <= safeRetries; attempt += 1) {
            attempts = attempt + 1;
            try {
                const ajaxOptions = {
                    url,
                    method: normalizedMethod,
                    data: payload,
                    timeout: safeTimeoutMs,
                    headers: buildHeaders(headers, tokenStorageKey, token, traceId)
                };
                if (typeof cache === 'boolean') ajaxOptions.cache = cache;
                if (typeof processData === 'boolean') ajaxOptions.processData = processData;
                if (contentType !== undefined) ajaxOptions.contentType = contentType;
                if (dataType !== undefined) ajaxOptions.dataType = dataType;
                if (typeof xhr === 'function') ajaxOptions.xhr = xhr;
                const response = await toAjaxPromise(ajaxOptions, signal, onRequest);
                response.traceId = traceId;
                response.transactionId = transactionId;
                recordDiagnostic({
                    method: normalizedMethod,
                    url,
                    outcome: 'ok',
                    status: response?.jqXHR?.status,
                    durationMs: Date.now() - startedAt,
                    attempts,
                    traceId,
                    transactionId
                });
                return response;
            } catch (error) {
                lastError = error;
                const shouldRetry = attempt < safeRetries && shouldRetryError(error);
                if (!shouldRetry) {
                    const formatted = formatAjaxError(error, url, traceId);
                    formatted.method = normalizedMethod;
                    formatted.attempts = attempts;
                    formatted.retryable = shouldRetryError(error);
                    recordDiagnostic({
                        method: normalizedMethod,
                        url,
                        outcome: String(error?.textStatus || '').toLowerCase() === 'abort' ? 'aborted' : 'error',
                        status: error?.jqXHR?.status,
                        durationMs: Date.now() - startedAt,
                        attempts,
                        traceId,
                        transactionId
                    });
                    throw formatted;
                }
                await wait((attempt + 1) * retryDelayMs);
            }
        }

        const formatted = formatAjaxError(lastError, url, traceId);
        formatted.method = normalizedMethod;
        formatted.attempts = attempts;
        formatted.retryable = shouldRetryError(lastError);
        recordDiagnostic({
            method: normalizedMethod,
            url,
            outcome: 'error',
            status: lastError?.jqXHR?.status,
            durationMs: Date.now() - startedAt,
            attempts,
            traceId,
            transactionId
        });
        throw formatted;
    };

    const parseJsonStrict = (payload, url) => {
        if (typeof payload === 'string') {
            const trimmed = payload.replace(/^\uFEFF/, '').trim();
            if (!trimmed) {
                throw new Error(`JSON response from ${url} was empty.`);
            }
            try {
                return JSON.parse(trimmed);
            } catch (error) {
                throw new Error(`Invalid JSON response from ${url}: ${error?.message || error}`);
            }
        }
        if (payload && typeof payload === 'object') {
            return payload;
        }
        throw new Error(`Unexpected JSON response type from ${url}.`);
    };

    const parseResponseJson = (response, url) => {
        const parsed = parseJsonStrict(response?.data, url);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return parsed;
        }
        if (!parsed.traceId && response?.traceId) parsed.traceId = response.traceId;
        if (!parsed.transactionId && response?.transactionId) parsed.transactionId = response.transactionId;
        return parsed;
    };

    const getText = async (url, {
        data = undefined,
        timeoutMs = DEFAULT_TIMEOUT_MS,
        retries = null,
        retryDelayMs = DEFAULT_RETRY_DELAY_MS,
        headers = {},
        tokenStorageKey = DEFAULT_TOKEN_STORAGE_KEY,
        cache = undefined,
        signal = null
    } = {}) => {
        const response = await request({
            method: 'GET',
            url,
            data,
            timeoutMs,
            retries,
            retryDelayMs,
            headers,
            tokenStorageKey,
            cache,
            signal
        });
        return response.data;
    };

    const postText = async (url, data = {}, {
        timeoutMs = DEFAULT_TIMEOUT_MS,
        retries = null,
        retryDelayMs = DEFAULT_RETRY_DELAY_MS,
        headers = {},
        tokenStorageKey = DEFAULT_TOKEN_STORAGE_KEY,
        signal = null
    } = {}) => {
        const response = await request({
            method: 'POST',
            url,
            data,
            timeoutMs,
            retries,
            retryDelayMs,
            headers,
            tokenStorageKey,
            signal
        });
        return response.data;
    };

    const getJson = async (url, {
        data = undefined,
        timeoutMs = DEFAULT_TIMEOUT_MS,
        retries = null,
        retryDelayMs = DEFAULT_RETRY_DELAY_MS,
        headers = {},
        tokenStorageKey = DEFAULT_TOKEN_STORAGE_KEY,
        cache = undefined,
        signal = null
    } = {}) => {
        const response = await request({
            method: 'GET',
            url,
            data,
            timeoutMs,
            retries,
            retryDelayMs,
            headers,
            tokenStorageKey,
            cache,
            signal
        });
        return parseResponseJson(response, url);
    };

    const postJson = async (url, data = {}, {
        timeoutMs = DEFAULT_TIMEOUT_MS,
        retries = null,
        retryDelayMs = DEFAULT_RETRY_DELAY_MS,
        headers = {},
        tokenStorageKey = DEFAULT_TOKEN_STORAGE_KEY,
        signal = null
    } = {}) => {
        const response = await request({
            method: 'POST',
            url,
            data,
            timeoutMs,
            retries,
            retryDelayMs,
            headers,
            tokenStorageKey,
            signal
        });
        return parseResponseJson(response, url);
    };

    const uploadJson = async (url, formData, {
        timeoutMs = 30000,
        headers = {},
        tokenStorageKey = DEFAULT_TOKEN_STORAGE_KEY,
        signal = null,
        onProgress = null,
        onRequest = null
    } = {}) => {
        const response = await request({
            method: 'POST',
            url,
            data: formData,
            timeoutMs,
            retries: 0,
            headers,
            tokenStorageKey,
            cache: false,
            processData: false,
            contentType: false,
            dataType: 'text',
            signal,
            onRequest,
            xhr: () => {
                const xhr = window.$?.ajaxSettings?.xhr?.();
                if (xhr?.upload && typeof onProgress === 'function') {
                    xhr.upload.addEventListener('progress', (event) => {
                        if (event?.lengthComputable === true) {
                            onProgress(Number(event.loaded || 0), Number(event.total || 0));
                        }
                    });
                }
                return xhr;
            }
        });
        return parseResponseJson(response, url);
    };

    const sendKeepalive = (url, data = {}, {
        headers = {},
        tokenStorageKey = DEFAULT_TOKEN_STORAGE_KEY
    } = {}) => {
        if (!url) {
            return false;
        }
        const startedAt = Date.now();
        const token = getOptionalRequestToken(tokenStorageKey);
        if (!token) {
            recordDiagnostic({
                method: 'POST',
                url,
                outcome: 'blocked-missing-token',
                durationMs: 0,
                attempts: 1
            });
            return false;
        }
        const traceId = newTraceId();
        const transactionId = transactionIdForTrace(traceId);
        const markedPayload = addMutationPayloadMarkers('POST', data, token, traceId);
        const body = (
            (typeof FormData !== 'undefined' && markedPayload instanceof FormData)
            || (typeof URLSearchParams !== 'undefined' && markedPayload instanceof URLSearchParams)
        ) ? markedPayload : new URLSearchParams(Object.entries(markedPayload || {}).map(([key, value]) => [key, String(value)]));
        try {
            if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
                const accepted = navigator.sendBeacon(url, body);
                recordDiagnostic({
                    method: 'POST', url, outcome: accepted ? 'queued' : 'rejected',
                    durationMs: Date.now() - startedAt, attempts: 1, traceId, transactionId
                });
                if (accepted) {
                    return true;
                }
            }
        } catch (_error) {
            // Continue to the fetch keepalive fallback.
        }
        if (typeof window.fetch !== 'function') {
            recordDiagnostic({ method: 'POST', url, outcome: 'unavailable', durationMs: 0, attempts: 1, traceId, transactionId });
            return false;
        }
        try {
            window.fetch(url, {
                method: 'POST',
                body,
                keepalive: true,
                credentials: 'same-origin',
                headers: buildHeaders(headers, tokenStorageKey, token, traceId)
            }).then((response) => {
                recordDiagnostic({
                    method: 'POST', url, outcome: response?.ok ? 'ok' : 'error', status: response?.status,
                    durationMs: Date.now() - startedAt, attempts: 1, traceId, transactionId
                });
            }).catch(() => {
                recordDiagnostic({ method: 'POST', url, outcome: 'error', durationMs: Date.now() - startedAt, attempts: 1, traceId, transactionId });
            });
            return true;
        } catch (_error) {
            recordDiagnostic({ method: 'POST', url, outcome: 'error', durationMs: Date.now() - startedAt, attempts: 1, traceId, transactionId });
            return false;
        }
    };

    window.FolderViewPlusRequest = Object.freeze({
        configureSecurityHeaders,
        newTraceId,
        buildUrl,
        request,
        getText,
        postText,
        getJson,
        postJson,
        uploadJson,
        sendKeepalive,
        diagnostics: getDiagnostics,
        clearDiagnostics
    });

    configureSecurityHeaders();
})();
