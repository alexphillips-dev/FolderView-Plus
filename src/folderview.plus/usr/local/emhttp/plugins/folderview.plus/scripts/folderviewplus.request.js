(() => {
    const DEFAULT_TOKEN_STORAGE_KEY = 'fv.request.token';
    const DEFAULT_TIMEOUT_MS = 15000;
    const DEFAULT_RETRIES = 1;
    const DEFAULT_RETRY_DELAY_MS = 220;
    const RETRYABLE_STATUS_CODES = new Set([0, 408, 425, 429, 500, 502, 503, 504]);

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));

    const isMetaTag = (node) => (
        node
        && typeof node === 'object'
        && typeof node.content === 'string'
    );

    const getOptionalRequestToken = (tokenStorageKey = DEFAULT_TOKEN_STORAGE_KEY) => {
        const metaToken = document.querySelector('meta[name="fv-request-token"]');
        if (isMetaTag(metaToken)) {
            return String(metaToken.content || '').trim();
        }
        try {
            return String(localStorage.getItem(tokenStorageKey) || '').trim();
        } catch (_error) {
            return '';
        }
    };

    const buildHeaders = (extraHeaders = {}, tokenStorageKey = DEFAULT_TOKEN_STORAGE_KEY, resolvedToken = '') => {
        const headers = {
            'X-FV-Request': '1',
            ...(extraHeaders || {})
        };
        const token = String(resolvedToken || getOptionalRequestToken(tokenStorageKey) || '').trim();
        if (token) {
            headers['X-FV-Token'] = token;
        }
        return headers;
    };

    const isPlainObject = (value) => (
        value !== null
        && typeof value === 'object'
        && Object.prototype.toString.call(value) === '[object Object]'
    );

    const addMutationPayloadMarkers = (method, data, token) => {
        if (String(method || '').toUpperCase() !== 'POST') {
            return data;
        }
        const safeToken = String(token || '').trim();
        if (typeof FormData !== 'undefined' && data instanceof FormData) {
            if (!data.has('_fv_request')) {
                data.append('_fv_request', '1');
            }
            if (safeToken && !data.has('token')) {
                data.append('token', safeToken);
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
            return data;
        }
        const payload = isPlainObject(data) ? { ...data } : {};
        if (!Object.prototype.hasOwnProperty.call(payload, '_fv_request')) {
            payload._fv_request = '1';
        }
        if (safeToken && !Object.prototype.hasOwnProperty.call(payload, 'token')) {
            payload.token = safeToken;
        }
        return payload;
    };

    const configureSecurityHeaders = ({ tokenStorageKey = DEFAULT_TOKEN_STORAGE_KEY } = {}) => {
        if (!window.$ || typeof window.$.ajaxSetup !== 'function') {
            return;
        }
        window.$.ajaxSetup({
            headers: buildHeaders({}, tokenStorageKey)
        });
    };

    const toAjaxPromise = (options) => new Promise((resolve, reject) => {
        if (!window.$ || typeof window.$.ajax !== 'function') {
            reject(new Error('jQuery.ajax is not available.'));
            return;
        }

        window.$.ajax(options)
            .done((data, textStatus, jqXHR) => {
                resolve({ data, textStatus, jqXHR });
            })
            .fail((jqXHR, textStatus, errorThrown) => {
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

    const formatAjaxError = (error, url) => {
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
        return new Error(pieces.join(' '));
    };

    const request = async ({
        method = 'GET',
        url,
        data = undefined,
        timeoutMs = DEFAULT_TIMEOUT_MS,
        retries = DEFAULT_RETRIES,
        retryDelayMs = DEFAULT_RETRY_DELAY_MS,
        headers = {},
        tokenStorageKey = DEFAULT_TOKEN_STORAGE_KEY
    }) => {
        if (!url) {
            throw new Error('Request URL is required.');
        }
        const safeRetries = Math.max(0, Number(retries) || 0);
        const safeTimeoutMs = Math.max(1000, Number(timeoutMs) || DEFAULT_TIMEOUT_MS);
        let lastError = null;

        const normalizedMethod = String(method || 'GET').toUpperCase();
        const token = getOptionalRequestToken(tokenStorageKey);
        const payload = addMutationPayloadMarkers(normalizedMethod, data, token);

        for (let attempt = 0; attempt <= safeRetries; attempt += 1) {
            try {
                return await toAjaxPromise({
                    url,
                    method: normalizedMethod,
                    data: payload,
                    timeout: safeTimeoutMs,
                    headers: buildHeaders(headers, tokenStorageKey, token)
                });
            } catch (error) {
                lastError = error;
                const shouldRetry = attempt < safeRetries && shouldRetryError(error);
                if (!shouldRetry) {
                    throw formatAjaxError(error, url);
                }
                await wait((attempt + 1) * retryDelayMs);
            }
        }

        throw formatAjaxError(lastError, url);
    };

    const parseJsonStrict = (payload, url) => {
        if (typeof payload === 'string') {
            const trimmed = payload.trim();
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

    const getText = async (url, {
        data = undefined,
        timeoutMs = DEFAULT_TIMEOUT_MS,
        retries = DEFAULT_RETRIES,
        retryDelayMs = DEFAULT_RETRY_DELAY_MS,
        headers = {},
        tokenStorageKey = DEFAULT_TOKEN_STORAGE_KEY
    } = {}) => {
        const response = await request({
            method: 'GET',
            url,
            data,
            timeoutMs,
            retries,
            retryDelayMs,
            headers,
            tokenStorageKey
        });
        return response.data;
    };

    const postText = async (url, data = {}, {
        timeoutMs = DEFAULT_TIMEOUT_MS,
        retries = DEFAULT_RETRIES,
        retryDelayMs = DEFAULT_RETRY_DELAY_MS,
        headers = {},
        tokenStorageKey = DEFAULT_TOKEN_STORAGE_KEY
    } = {}) => {
        const response = await request({
            method: 'POST',
            url,
            data,
            timeoutMs,
            retries,
            retryDelayMs,
            headers,
            tokenStorageKey
        });
        return response.data;
    };

    const getJson = async (url, {
        data = undefined,
        timeoutMs = DEFAULT_TIMEOUT_MS,
        retries = DEFAULT_RETRIES,
        retryDelayMs = DEFAULT_RETRY_DELAY_MS,
        headers = {},
        tokenStorageKey = DEFAULT_TOKEN_STORAGE_KEY
    } = {}) => {
        const response = await request({
            method: 'GET',
            url,
            data,
            timeoutMs,
            retries,
            retryDelayMs,
            headers,
            tokenStorageKey
        });
        return parseJsonStrict(response.data, url);
    };

    const postJson = async (url, data = {}, {
        timeoutMs = DEFAULT_TIMEOUT_MS,
        retries = DEFAULT_RETRIES,
        retryDelayMs = DEFAULT_RETRY_DELAY_MS,
        headers = {},
        tokenStorageKey = DEFAULT_TOKEN_STORAGE_KEY
    } = {}) => {
        const response = await request({
            method: 'POST',
            url,
            data,
            timeoutMs,
            retries,
            retryDelayMs,
            headers,
            tokenStorageKey
        });
        return parseJsonStrict(response.data, url);
    };

    window.FolderViewPlusRequest = Object.freeze({
        configureSecurityHeaders,
        request,
        getText,
        postText,
        getJson,
        postJson
    });

    configureSecurityHeaders();
})();
