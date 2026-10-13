(function(root, factory) {
    if (typeof module === 'object' && module.exports) { module.exports = factory(); return; }
    root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    root.FolderViewPlusFoundationModules.requestTransport = factory();
}(typeof window !== 'undefined' ? window : globalThis, function() {
    const createApi = ({ window: win = {} } = {}) => {
        const isSameOrigin = (url) => {
            try {
                const origin = win.location?.origin || 'http://localhost';
                const parsed = new URL(String(url || ''), origin);
                return parsed.origin === origin && !parsed.username && !parsed.password
                    && /^https?:$/.test(parsed.protocol);
            } catch (_error) { return false; }
        };
        const isPluginUrl = url => isSameOrigin(url)
            && new URL(String(url), win.location?.origin || 'http://localhost').pathname.startsWith('/plugins/folderview.plus/');
        const requireMutationContext = (url) => {
            if (!isSameOrigin(url)) throw Object.assign(new Error(), { reasonCode: 'origin-mismatch' });
            const token = String(win.csrf_token || '').trim();
            if (!token) throw Object.assign(new Error(), { reasonCode: 'csrf-missing' });
            return token;
        };
        const mutationHeaders = (url, headers = {}) => {
            const token = requireMutationContext(url);
            const result = Object.fromEntries(Object.entries(headers).filter(([name]) => name.toLowerCase() !== 'x-csrf-token'));
            result['X-CSRF-Token'] = token;
            return result;
        };
        const toAjaxPromise = (options, signal = null, onRequest = null) => new Promise((resolve, reject) => {
            if (!win.$ || typeof win.$.ajax !== 'function') {
                reject(new Error('jQuery.ajax is not available.'));
                return;
            }
            const request = win.$.ajax(options);
            if (typeof onRequest === 'function') onRequest(request);
            const abortRequest = () => request?.abort?.();
            if (signal?.aborted === true) abortRequest();
            else signal?.addEventListener?.('abort', abortRequest, { once: true });
            const cleanup = () => signal?.removeEventListener?.('abort', abortRequest);
            request.done((data, textStatus, jqXHR) => {
                cleanup(); resolve({ data, textStatus, jqXHR });
            }).fail(async (jqXHR, textStatus, errorThrown) => {
                cleanup();
                const body = jqXHR.response;
                if (body?.size <= 65536 && typeof body.text === 'function' && /json/i.test(body.type)) {
                    try { jqXHR.responseJSON = JSON.parse(await body.text()); } catch (_error) { /* Keep the HTTP failure. */ }
                }
                reject({ jqXHR, textStatus, errorThrown });
            });
        });
        const toMultipartPromise = (options, signal = null, onRequest = null, onProgress = null) => new Promise((resolve, reject) => {
            const headers = mutationHeaders(options.url, options.headers);
            // Earlier supported Unraid releases require the POST field; newer ones also accept the header.
            options.data.set('csrf_token', headers['X-CSRF-Token']);
            const xhr = new win.XMLHttpRequest();
            let settled = false;
            const progress = event => {
                if (event.lengthComputable && typeof onProgress === 'function') onProgress(Number(event.loaded || 0), Number(event.total || 0));
            };
            const nativeAbort = xhr.abort.bind(xhr);
            const abortRequest = () => { finish('abort'); nativeAbort(); };
            const finish = (textStatus) => {
                if (settled) return;
                settled = true;
                signal?.removeEventListener?.('abort', abortRequest);
                xhr.upload?.removeEventListener?.('progress', progress);
                xhr.onload = xhr.onerror = xhr.ontimeout = xhr.onabort = null;
                if (textStatus === 'success') resolve({ data: xhr.responseText, textStatus, jqXHR: xhr });
                else {
                    try { xhr.responseJSON = JSON.parse(xhr.responseText); } catch (_error) { /* Preserve HTTP and transport errors. */ }
                    reject({ jqXHR: xhr, textStatus, errorThrown: xhr.statusText });
                }
            };
            xhr.open('POST', options.url, true);
            xhr.timeout = options.timeout;
            Object.entries(headers).forEach(([name, value]) => {
                // The browser must supply the multipart boundary.
                if (name.toLowerCase() !== 'content-type') xhr.setRequestHeader(name, value);
            });
            xhr.onload = () => finish(xhr.status >= 200 && xhr.status < 300 ? 'success' : 'error');
            xhr.onerror = () => finish('error');
            xhr.ontimeout = () => finish('timeout');
            xhr.onabort = () => finish('abort');
            xhr.abort = abortRequest;
            xhr.upload?.addEventListener?.('progress', progress);
            if (signal?.aborted) { finish('abort'); return; }
            signal?.addEventListener?.('abort', abortRequest, { once: true });
            if (typeof onRequest === 'function') onRequest(xhr);
            if (!settled) xhr.send(options.data);
        });
        const queueKeepalive = (url, body, headers, record) => {
            const csrf = requireMutationContext(url);
            body.set('csrf_token', csrf);
            try {
                const nav = win.navigator || (typeof navigator !== 'undefined' ? navigator : null);
                if (typeof nav?.sendBeacon === 'function') {
                    const accepted = nav.sendBeacon(url, body);
                    record({ outcome: accepted ? 'queued' : 'rejected' });
                    if (accepted) return true;
                }
            } catch (_error) { /* Continue with the response-aware fetch fallback. */ }
            if (typeof win.fetch !== 'function') { record({ outcome: 'unavailable' }); return false; }
            try {
                const fetchHeaders = mutationHeaders(url, headers);
                body.set('csrf_token', fetchHeaders['X-CSRF-Token']);
                win.fetch(url, {
                    method: 'POST', body, keepalive: true, credentials: 'same-origin',
                    headers: fetchHeaders
                }).then(response => record({ outcome: response?.ok ? 'ok' : 'error', status: response?.status }))
                    .catch(() => record({ outcome: 'error' }));
                return true;
            } catch (_error) { record({ outcome: 'error' }); return false; }
        };
        return Object.freeze({ isSameOrigin, isPluginUrl, requireMutationContext, mutationHeaders, toAjaxPromise, toMultipartPromise, queueKeepalive });
    };
    return Object.freeze({ createApi });
}));
