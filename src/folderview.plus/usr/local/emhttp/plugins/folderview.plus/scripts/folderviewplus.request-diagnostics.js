(function(root, factory) {
    if (typeof module === 'object' && module.exports) { module.exports = factory(); return; }
    root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    root.FolderViewPlusFoundationModules.requestDiagnostics = factory();
}(typeof window !== 'undefined' ? window : globalThis, function() {
    const createApi = ({ window = {}, requestDiagnostics = [], extractServerErrorMessage = () => '' } = {}) => {
        const FAILURE_STORAGE_KEY = 'fv.request.failures.v1';
        const FAILURE_REASONS = new Set([
            'marker-missing', 'plugin-token-missing', 'plugin-token-invalid', 'plugin-token-unavailable',
            'origin-mismatch', 'referer-mismatch', 'nonce-invalid', 'nonce-stale', 'nonce-target-mismatch',
            'nonce-response-invalid', 'transaction-invalid', 'transaction-replayed', 'security-state-unavailable',
            'rate-limited', 'request-guard', 'csrf-missing', 'csrf-invalid', 'csrf-uninitialized',
            'authentication-required', 'timeout', 'aborted', 'http-error', 'unexpected-response'
        ]);
        const translate = (key, fallback, ...params) => window.FolderViewPlusI18n?.t?.(key, fallback, ...params)
            || String(fallback || key).replace(/\$(\d+)/g, (match, index) => String(params[Number(index) - 1] ?? match));

        const normalizeFailure = (entry) => {
            const timestamp = Date.parse(String(entry?.at || ''));
            if (!Number.isFinite(timestamp) || timestamp < Date.now() - 86400000 || timestamp > Date.now()
                || !FAILURE_REASONS.has(entry?.reasonCode) || entry.reasonCode === 'aborted') return null;
            const endpoint = String(entry?.endpoint || '');
            if (!/^\/plugins\/folderview\.plus\/server\/[a-z0-9_-]+\.php$/.test(endpoint)) return null;
            return {
                at: new Date(timestamp).toISOString(),
                endpoint,
                status: Math.max(0, Math.min(599, Number(entry.status) || 0)),
                phase: ['token', 'nonce', 'request'].includes(entry.phase) ? entry.phase : 'request',
                failureSource: ['folderview-plus', 'unraid', 'transport', 'client'].includes(entry.failureSource) ? entry.failureSource : 'client',
                reasonCode: entry.reasonCode
            };
        };
        const storedFailures = () => {
            try {
                const rows = JSON.parse(window.sessionStorage?.getItem(FAILURE_STORAGE_KEY) || '[]');
                return Array.isArray(rows) ? rows.slice(-20).map(normalizeFailure).filter(Boolean) : [];
            } catch (_error) { return []; }
        };
        const failureDiagnostics = () => {
            const rows = [...storedFailures(), ...requestDiagnostics.map(normalizeFailure).filter(Boolean)];
            return [...new Map(rows.map((entry) => [JSON.stringify(entry), entry])).values()].slice(-20);
        };

        const classifyFailure = (error) => {
            let response = error?.jqXHR?.responseJSON || error?.response || null;
            if (!response) {
                try { response = JSON.parse(error?.jqXHR?.responseText || 'null'); } catch (_error) { /* Not JSON. */ }
            }
            const declared = response?.requestFailure;
            if (declared?.source === 'folderview-plus' && FAILURE_REASONS.has(declared.reasonCode)) {
                return { failureSource: 'folderview-plus', reasonCode: declared.reasonCode };
            }
            const detail = String(response?.error || '').trim();
            const csrf = new Map([['missing csrf_token', 'csrf-missing'], ['wrong csrf_token', 'csrf-invalid'], ['uninitialized csrf_token', 'csrf-uninitialized']]).get(detail);
            if (csrf) return { failureSource: 'unraid', reasonCode: csrf };
            const legacy = new Map([['Blocked by request guard.', 'request-guard'], ['Invalid request token.', 'plugin-token-invalid']]).get(detail);
            if (legacy) return { failureSource: 'folderview-plus', reasonCode: legacy };
            if (FAILURE_REASONS.has(error?.reasonCode)) return { failureSource: 'client', reasonCode: error.reasonCode };
            const status = Number(error?.jqXHR?.status || error?.status || 0);
            if (status === 401) return { failureSource: 'unraid', reasonCode: 'authentication-required' };
            const textStatus = String(error?.textStatus || '').toLowerCase();
            const reasonCode = textStatus === 'abort' ? 'aborted' : textStatus === 'timeout' ? 'timeout'
                : textStatus === 'parsererror' ? 'unexpected-response' : 'http-error';
            return { failureSource: 'transport', reasonCode };
        };

        const failureMessage = (reason) => {
            if (['plugin-token-missing', 'plugin-token-invalid', 'nonce-invalid', 'nonce-stale', 'nonce-response-invalid'].includes(reason)) {
                return translate('request.failure.refresh', 'The page security information is missing or expired. Refresh the Unraid webGUI, then retry your change.');
            }
            if (['csrf-missing', 'csrf-invalid', 'csrf-uninitialized', 'authentication-required'].includes(reason)) {
                return translate('request.failure.session', 'Unraid rejected the session security check. Refresh the webGUI and sign in again if prompted, then retry your change.');
            }
            if (['origin-mismatch', 'referer-mismatch'].includes(reason)) {
                return translate('request.failure.origin', 'The page address does not match the server request. If you use a reverse proxy, try direct Unraid access and check the proxy headers.');
            }
            if (reason === 'marker-missing') {
                return translate('request.failure.marker', 'The request security marker did not reach the plugin. Hard-refresh the webGUI; if this continues, check browser extensions or proxy filtering.');
            }
            if (['security-state-unavailable', 'plugin-token-unavailable'].includes(reason)) {
                return translate('request.failure.state', 'The plugin could not prepare secure changes. Check the plugin logs and export a sanitized support bundle.');
            }
            if (['nonce-target-mismatch', 'transaction-invalid', 'transaction-replayed', 'request-guard'].includes(reason)) {
                return translate('request.failure.guard', 'The plugin rejected this change. Refresh the webGUI and check whether it was already applied before trying again. Include this support code if the problem continues.');
            }
            return '';
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
        const persist = () => { try { window.sessionStorage?.setItem(FAILURE_STORAGE_KEY, JSON.stringify(failureDiagnostics())); } catch (_error) { /* Storage is optional. */ } };
        const clear = () => { try { window.sessionStorage?.removeItem(FAILURE_STORAGE_KEY); } catch (_error) { /* Storage is optional. */ } };
        return { formatAjaxError, failureDiagnostics, classifyFailure, failureMessage, translate, persist, clear, isKnownReason: reason => FAILURE_REASONS.has(reason) };
    };
    return Object.freeze({ createApi });
}));
