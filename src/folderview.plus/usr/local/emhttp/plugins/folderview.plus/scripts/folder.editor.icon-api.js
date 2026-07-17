(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusFolderIconApi = factory();
    root.FolderViewPlusFolderIconApiModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const fallbackWindow = typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : null);

    const createApi = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        const asArray = typeof deps.asArray === 'function' ? deps.asArray : ((value) => Array.isArray(value) ? value : []);
        const uploadApiPath = String(deps.iconUploadApiPath || '').trim();
        const uploadMaxBytes = Number.isFinite(Number(deps.uploadMaxBytes)) ? Math.max(1, Number(deps.uploadMaxBytes)) : 4194304;
        const allowedExtensions = Array.isArray(deps.allowedExtensions) ? deps.allowedExtensions.map((entry) => String(entry || '').toLowerCase()) : [];
        const uploadContext = String(deps.uploadContext || 'icon upload endpoint').trim() || 'icon upload endpoint';
        const managerContext = String(deps.managerContext || 'custom icon manager').trim() || 'custom icon manager';
        const builtInIconFallback = Array.isArray(deps.builtInIconFallback) ? deps.builtInIconFallback : [];
        const requestClient = deps.requestClient || win?.FolderViewPlusRequest || null;

        const parseJsonPayload = (value, context = 'response') => {
            if (value && typeof value === 'object') {
                return value;
            }
            if (typeof value !== 'string') {
                throw new Error(`Unexpected ${context} type.`);
            }
            const normalized = value.replace(/^\uFEFF/, '').trim();
            if (!normalized) {
                throw new Error(`${context} returned an empty response.`);
            }
            try {
                return JSON.parse(normalized);
            } catch (_error) {
                const start = normalized.indexOf('{');
                const end = normalized.lastIndexOf('}');
                if (start >= 0 && end > start) {
                    const candidate = normalized.slice(start, end + 1);
                    try {
                        return JSON.parse(candidate);
                    } catch (_ignored) {
                        // Keep flowing to the structured error below.
                    }
                }
                throw new Error(`Invalid JSON from ${context}.`);
            }
        };

        const extractAjaxErrorMessage = (error, context = 'request') => {
            const responseText = String(error?.jqXHR?.responseText || error?.responseText || '').trim();
            if (responseText) {
                try {
                    const payload = parseJsonPayload(responseText, context);
                    const serverMessage = String(payload?.error || '').trim();
                    if (serverMessage) {
                        return serverMessage;
                    }
                } catch (_parseError) {
                    // Fall through to HTTP-level details.
                }
            }

            const status = Number(error?.jqXHR?.status || error?.status || 0);
            if (status > 0) {
                const statusText = String(error?.jqXHR?.statusText || error?.statusText || '').trim();
                return statusText ? `Request failed. HTTP ${status} ${statusText}.` : `Request failed. HTTP ${status}.`;
            }

            const textStatus = String(error?.textStatus || '').trim();
            if (textStatus) {
                return `Request failed (${textStatus}).`;
            }

            const thrown = String(error?.errorThrown || '').trim();
            if (thrown) {
                return `Request failed (${thrown}).`;
            }

            const message = String(error?.message || '').trim();
            if (message) {
                return message;
            }

            return `Request failed for ${context}.`;
        };

        const securePost = async (url, data = {}) => {
            if (!requestClient || typeof requestClient.postJson !== 'function') {
                throw new Error('FolderView Plus request client is unavailable.');
            }
            return requestClient.postJson(url, data, { retries: 0 });
        };

        const normalizeBuiltInIconEntry = (entry, basePath) => {
            if (!entry || typeof entry !== 'object') {
                return null;
            }
            const id = String(entry.id || entry.name || '').trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
            if (!id) {
                return null;
            }
            const file = String(entry.file || '').trim();
            const path = String(entry.path || '').trim() || (file ? `${basePath}${file}` : '');
            if (!path) {
                return null;
            }
            const name = String(entry.name || id).trim() || id;
            const tags = asArray(entry.tags).map((tag) => String(tag || '').trim().toLowerCase()).filter((tag) => tag !== '');
            return { id, name, path, tags };
        };

        const normalizeBuiltInIconManifest = (payload) => {
            const source = payload && typeof payload === 'object' ? payload : {};
            const basePath = String(source.basePath || '/plugins/folderview.plus/images/icons/').trim();
            const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
            const icons = asArray(source.icons)
                .map((entry) => normalizeBuiltInIconEntry(entry, normalizedBase))
                .filter(Boolean);
            if (icons.length === 0) {
                return [...builtInIconFallback];
            }
            return icons;
        };

        const formatByteCount = (bytes) => {
            const value = Number(bytes || 0);
            if (!Number.isFinite(value) || value <= 0) {
                return '0 B';
            }
            const units = ['B', 'KB', 'MB', 'GB'];
            let current = value;
            let idx = 0;
            while (current >= 1024 && idx < units.length - 1) {
                current /= 1024;
                idx += 1;
            }
            const precision = current >= 100 || idx === 0 ? 0 : (current >= 10 ? 1 : 2);
            return `${current.toFixed(precision)} ${units[idx]}`;
        };

        const validateCustomIconFileBeforeUpload = (file) => {
            if (!(file instanceof File)) {
                throw new Error('No icon file selected.');
            }
            const name = String(file.name || '').trim();
            const extension = String(name.split('.').pop() || '').toLowerCase();
            if (!extension || !allowedExtensions.includes(extension)) {
                throw new Error('Unsupported icon format.');
            }
            const size = Number(file.size || 0);
            if (!Number.isFinite(size) || size <= 0) {
                throw new Error('Uploaded file is empty.');
            }
            if (size > uploadMaxBytes) {
                throw new Error('Uploaded file exceeds 4MB limit.');
            }
        };

        const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
            if (!(file instanceof File)) {
                reject(new Error('No icon file selected.'));
                return;
            }
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('Unable to read selected file.'));
            reader.onload = () => {
                const result = String(reader.result || '').trim();
                if (!result) {
                    reject(new Error('Unable to read selected file.'));
                    return;
                }
                resolve(result);
            };
            reader.readAsDataURL(file);
        });

        const shouldUseInlineUploadFallback = (error) => {
            const message = String(error?.message || '').toLowerCase();
            if (!message) {
                return false;
            }
            return message.includes('empty response')
                || message.includes('invalid json')
                || message.includes('unexpected');
        };

        const uploadCustomIconFileInline = async (file, options = {}) => {
            const inlinePayload = await readFileAsDataUrl(file);
            const body = {
                action: 'upload',
                icon_inline_name: String(file.name || 'icon').trim() || 'icon',
                icon_inline_data: inlinePayload,
                replace: options?.replace ? '1' : '0',
                dedupe: options?.dedupe === false ? '0' : '1'
            };
            return requestClient.postJson(uploadApiPath, body, {
                retries: 0,
                timeoutMs: 30000
            });
        };

        const uploadCustomIconFile = async (file, options = {}) => {
            if (!file || typeof file.name !== 'string') {
                throw new Error('No icon file selected.');
            }
            validateCustomIconFileBeforeUpload(file);

            const formData = new FormData();
            formData.append('action', 'upload');
            formData.append('icon', file);
            formData.append('replace', options?.replace ? '1' : '0');
            formData.append('dedupe', options?.dedupe === false ? '0' : '1');

            let payload;
            const onProgress = typeof options?.onProgress === 'function' ? options.onProgress : null;
            try {
                payload = await requestClient.uploadJson(uploadApiPath, formData, {
                    timeoutMs: 30000,
                    onProgress,
                    onRequest: (request) => {
                        if (typeof options?.setActiveRequest === 'function') {
                            options.setActiveRequest(request);
                        }
                    }
                });
            } catch (error) {
                const aborted = String(error?.textStatus || '').toLowerCase() === 'abort'
                    || String(error?.statusText || '').toLowerCase() === 'abort'
                    || String(error?.message || '').toLowerCase().includes('abort');
                if (aborted) {
                    throw new Error('Upload cancelled.');
                }
                const primaryError = error instanceof Error
                    ? error
                    : new Error(extractAjaxErrorMessage(error, uploadContext));
                if (!shouldUseInlineUploadFallback(primaryError)) {
                    throw new Error(extractAjaxErrorMessage(error, uploadContext));
                }
                try {
                    payload = await uploadCustomIconFileInline(file, options);
                } catch (inlineError) {
                    throw new Error(extractAjaxErrorMessage(inlineError, uploadContext));
                }
            } finally {
                if (typeof options?.setActiveRequest === 'function') {
                    options.setActiveRequest(null);
                }
            }

            if (!payload || payload.ok !== true) {
                throw new Error(String(payload?.error || 'Upload failed.'));
            }
            const url = String(payload.url || '').trim();
            if (!url) {
                throw new Error('Upload did not return an icon URL.');
            }
            return {
                name: String(payload.name || file.name).trim() || file.name,
                url,
                duplicate: payload?.duplicate === true,
                replaced: payload?.replaced === true,
                message: String(payload?.message || '').trim(),
                metadata: payload?.metadata || null,
                stats: payload?.stats || null
            };
        };

        const requestCustomIconApi = async (action, payload = {}, method = 'GET') => {
            const normalizedMethod = String(method || 'GET').toUpperCase();
            const data = {
                action: String(action || '').trim(),
                ...(payload && typeof payload === 'object' ? payload : {})
            };
            if (normalizedMethod === 'GET') {
                const parsed = await requestClient.getJson(uploadApiPath, { data });
                if (!parsed || parsed.ok !== true) {
                    throw new Error(String(parsed?.error || 'Request failed.'));
                }
                return parsed;
            }
            const parsed = await requestClient.postJson(uploadApiPath, data, {
                retries: 0,
                timeoutMs: 15000
            });
            if (!parsed || parsed.ok !== true) {
                throw new Error(String(parsed?.error || 'Request failed.'));
            }
            return parsed;
        };

        return Object.freeze({
            parseJsonPayload,
            extractAjaxErrorMessage,
            securePost,
            normalizeBuiltInIconEntry,
            normalizeBuiltInIconManifest,
            formatByteCount,
            validateCustomIconFileBeforeUpload,
            readFileAsDataUrl,
            shouldUseInlineUploadFallback,
            uploadCustomIconFileInline,
            uploadCustomIconFile,
            requestCustomIconApi
        });
    };

    return Object.freeze({
        createApi
    });
}));
