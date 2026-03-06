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

    const buildHeaders = (extraHeaders = {}, tokenStorageKey = DEFAULT_TOKEN_STORAGE_KEY) => {
        const headers = {
            'X-FV-Request': '1',
            ...(extraHeaders || {})
        };
        const token = getOptionalRequestToken(tokenStorageKey);
        if (token) {
            headers['X-FV-Token'] = token;
        }
        return headers;
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

    const formatAjaxError = (error, url) => {
        if (error instanceof Error) {
            return error;
        }
        const status = Number(error?.jqXHR?.status || 0);
        const textStatus = String(error?.textStatus || '').trim();
        const statusText = String(error?.jqXHR?.statusText || '').trim();
        const errorThrown = String(error?.errorThrown || '').trim();
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

        for (let attempt = 0; attempt <= safeRetries; attempt += 1) {
            try {
                return await toAjaxPromise({
                    url,
                    method,
                    data,
                    timeout: safeTimeoutMs,
                    headers: buildHeaders(headers, tokenStorageKey)
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
