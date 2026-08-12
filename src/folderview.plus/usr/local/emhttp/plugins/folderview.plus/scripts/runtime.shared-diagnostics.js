// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(typeof globalThis !== 'undefined' ? globalThis : root);
        return;
    }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.runtimeSharedDiagnostics = factory(root);
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function(window) {
    'use strict';
    const pluginRequestClient = window.FolderViewPlusRequest || null;

    const createDebugLogger = (enabled = false, namespace = 'folderview.plus') => {
        const shouldLog = enabled === true;
        const prefix = String(namespace || 'folderview.plus').trim() || 'folderview.plus';
        const emit = (method, args) => {
            if (!shouldLog || typeof console?.[method] !== 'function') {
                return;
            }
            console[method](`[${prefix}]`, ...args);
        };
        return Object.freeze({
            log: (...args) => emit('log', args),
            warn: (...args) => emit('warn', args),
            error: (...args) => emit('error', args)
        });
    };

    const createRuntimeDiagnosticsBridge = (options = {}) => {
        const fatalBanner = window.FolderViewPlusFatalBanner || null;
        const runtimeContext = options.runtimeContext && typeof options.runtimeContext === 'object'
            ? options.runtimeContext
            : {};
        const context = String(options.context || runtimeContext.page || 'Runtime').trim() || 'Runtime';
        const hostSelector = String(options.hostSelector || runtimeContext.hostSelector || 'body').trim() || 'body';
        const codePrefix = String(options.codePrefix || 'FVPLUS-RUN').trim() || 'FVPLUS-RUN';
        const defaultFatalTitle = String(options.fatalTitle || `${context} runtime failed`).trim() || `${context} runtime failed`;
        const defaultFatalMessage = String(options.fatalMessage || `FolderView Plus could not finish rendering folders on the ${context.toLowerCase()} page.`).trim()
            || `FolderView Plus could not finish rendering folders on the ${context.toLowerCase()} page.`;
        const defaultDegradedTitle = String(options.degradedTitle || `${context} page loaded in degraded mode`).trim() || `${context} page loaded in degraded mode`;
        const defaultDegradedMessage = String(options.degradedMessage || `FolderView Plus kept the ${context.toLowerCase()} page open, but part of the folder runtime did not load.`).trim()
            || `FolderView Plus kept the ${context.toLowerCase()} page open, but part of the folder runtime did not load.`;
        const trimDiagnostic = (value) => String(value ?? '').trim();
        const setEnvironment = (patch = {}) => {
            if (!fatalBanner || typeof fatalBanner.setEnvironment !== 'function') {
                return;
            }
            fatalBanner.setEnvironment({
                page: context,
                pluginVersion: trimDiagnostic(runtimeContext.pluginVersion || 'unknown') || 'unknown',
                channel: trimDiagnostic(runtimeContext.channel || 'unknown') || 'unknown',
                unraidVersion: trimDiagnostic(runtimeContext.unraidVersion || 'unknown') || 'unknown',
                url: trimDiagnostic(window.location?.href || ''),
                userAgent: trimDiagnostic(window.navigator?.userAgent || ''),
                ...patch
            });
        };
        const extractTraceId = (error) => {
            const jqXhrTrace = trimDiagnostic(
                typeof error?.jqXHR?.getResponseHeader === 'function'
                    ? error.jqXHR.getResponseHeader('X-FV-Trace')
                    : ''
            );
            if (jqXhrTrace) {
                return jqXhrTrace;
            }
            const direct = trimDiagnostic(error?.traceId);
            if (direct) {
                return direct;
            }
            const message = trimDiagnostic(error?.message || error);
            const match = message.match(/\(trace:\s*([^)]+)\)/i);
            return match ? trimDiagnostic(match[1]) : '';
        };
        const extractStatus = (error) => {
            const direct = Number(error?.jqXHR?.status || error?.status || 0);
            if (Number.isFinite(direct) && direct > 0) {
                return String(direct);
            }
            const message = trimDiagnostic(error?.message || error);
            const match = message.match(/\bHTTP\s+(\d{3})\b/i);
            return match ? trimDiagnostic(match[1]) : '';
        };
        const extractResponseSnippet = (error) => {
            const responseText = trimDiagnostic(error?.jqXHR?.responseText || error?.responseText || '');
            if (!responseText) {
                return '';
            }
            const normalized = responseText.replace(/\s+/g, ' ').trim();
            if (!normalized) {
                return '';
            }
            return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
        };
        const inferCategory = (error, fallbackCategory = 'runtime-failed') => {
            if (fatalBanner && typeof fatalBanner.classifyError === 'function') {
                return fatalBanner.classifyError(error, fallbackCategory);
            }
            const message = trimDiagnostic(error?.message || error).toLowerCase();
            if (!message) {
                return fallbackCategory;
            }
            if (message.includes('missing modules') || message.includes('module did not load')) {
                return 'missing-module';
            }
            if (message.includes('http 401') || message.includes('invalid request token')) {
                return 'auth-failed';
            }
            if (message.includes('http 403') || message.includes('blocked by request guard')) {
                return 'request-guard';
            }
            if (message.includes('http 404')) {
                return 'missing-endpoint';
            }
            if (message.includes('http 5')) {
                return 'server-error';
            }
            if (message.includes('json') && message.includes('parse')) {
                return 'invalid-response';
            }
            return fallbackCategory;
        };
        const markStep = (step) => fatalBanner?.markStep?.(step);
        const setPhase = (phase) => fatalBanner?.setPhase?.(phase);
        const recordAction = (action) => fatalBanner?.recordAction?.(action);
        const setModuleStatus = (name, status, detail = '') => fatalBanner?.setModuleStatus?.(name, status, detail);
        const recordRequest = (entry = {}) => fatalBanner?.recordRequest?.(entry);
        const reportMissingModules = (missingModules = [], overrides = {}) => {
            fatalBanner?.reportMissingModules?.(missingModules, {
                context,
                hostSelector,
                code: `${codePrefix}-BOOT-001`,
                phase: 'module-load',
                message: `FolderView Plus could not start because required ${context.toLowerCase()} runtime modules failed to load.`,
                ...overrides
            });
        };
        const reportFatalError = (error, overrides = {}) => {
            fatalBanner?.reportFatalError?.(error, {
                context,
                hostSelector,
                title: defaultFatalTitle,
                message: defaultFatalMessage,
                code: `${codePrefix}-BOOT-002`,
                phase: overrides.phase || error?.fvplusPhase || 'runtime',
                category: overrides.category || error?.fvplusCategory || inferCategory(error, 'runtime-failed'),
                ...overrides
            });
        };
        const reportDegradedState = (error, overrides = {}) => {
            fatalBanner?.reportDegradedState?.(error, {
                context,
                hostSelector,
                title: defaultDegradedTitle,
                message: defaultDegradedMessage,
                code: `${codePrefix}-BOOT-003`,
                phase: overrides.phase || error?.fvplusPhase || 'bootstrap-data',
                category: overrides.category || error?.fvplusCategory || 'degraded-mode',
                ...overrides
            });
        };
        const buildRequestError = (label, url, jqXHR, textStatus, errorThrown, requestOptions = {}) => {
            const status = trimDiagnostic(typeof jqXHR?.status === 'number' && jqXHR.status > 0 ? jqXHR.status : '');
            const traceId = trimDiagnostic(
                typeof jqXHR?.getResponseHeader === 'function'
                    ? jqXHR.getResponseHeader('X-FV-Trace')
                    : ''
            );
            const detail = trimDiagnostic(errorThrown || textStatus || 'request failed');
            const messageParts = [`${label} request failed for ${url}`];
            if (status) {
                messageParts.push(`HTTP ${status}`);
            }
            if (detail && detail.toLowerCase() !== 'error') {
                messageParts.push(detail);
            }
            if (traceId) {
                messageParts.push(`trace: ${traceId}`);
            }
            const error = new Error(messageParts.join(' | '));
            error.jqXHR = jqXHR;
            error.status = status;
            error.traceId = traceId;
            error.responseText = jqXHR?.responseText || '';
            error.fvplusPhase = requestOptions.phase || 'bootstrap-data';
            error.fvplusCategory = inferCategory(error, requestOptions.category || 'request-failed');
            return error;
        };
        const createRequest = (url, requestOptions = {}) => {
            const method = trimDiagnostic(requestOptions.method || 'GET') || 'GET';
            const source = trimDiagnostic(requestOptions.source || `${context.toLowerCase()}-runtime`);
            const detail = trimDiagnostic(requestOptions.detail || '');
            const label = trimDiagnostic(requestOptions.label || source || url);
            const allowFallback = requestOptions.allowFallback === true;
            const fallbackValue = requestOptions.fallbackValue;
            const requestPromise = method.toUpperCase() === 'POST'
                ? pluginRequestClient?.postText?.(url, requestOptions.data || {}, requestOptions)
                : pluginRequestClient?.getText?.(url, requestOptions);
            if (!requestPromise || typeof requestPromise.then !== 'function') {
                return Promise.reject(new Error('FolderView Plus request client is unavailable.'));
            }
            return requestPromise.then(
                (data) => {
                    recordRequest({
                        method,
                        url,
                        source,
                        outcome: 'ok',
                        detail
                    });
                    return data;
                },
                (requestError) => {
                    const error = requestError instanceof Error
                        ? requestError
                        : buildRequestError(label, url, requestError?.jqXHR, requestError?.textStatus, requestError?.errorThrown, requestOptions);
                    recordRequest({
                        method,
                        url,
                        source,
                        outcome: allowFallback ? 'fallback' : 'error',
                        status: extractStatus(error),
                        traceId: extractTraceId(error),
                        category: inferCategory(error, allowFallback ? 'degraded-mode' : 'request-failed'),
                        detail: trimDiagnostic(error.message),
                        responseSnippet: extractResponseSnippet(error)
                    });
                    if (allowFallback) {
                        reportDegradedState(error, {
                            title: requestOptions.fallbackTitle || `${context} runtime preferences could not be loaded`,
                            message: requestOptions.fallbackMessage || `FolderView Plus kept the ${context.toLowerCase()} page open, but the runtime had to fall back to default ${context.toLowerCase()} folder preferences.`,
                            detailLabel: requestOptions.fallbackDetailLabel || 'Fallback request',
                            details: [
                                requestOptions.fallbackLead || `${label} request fell back to defaults.`,
                                trimDiagnostic(error.message)
                            ].filter(Boolean)
                        });
                        return fallbackValue;
                    }
                    throw error;
                }
            );
        };

        setEnvironment();
        setPhase('bootstrap');
        recordAction(`${context} runtime bootstrap started`);

        return Object.freeze({
            setEnvironment,
            markStep,
            setPhase,
            recordAction,
            setModuleStatus,
            recordRequest,
            reportMissingModules,
            reportFatalError,
            reportDegradedState,
            inferCategory,
            createRequest
        });
    };


    return Object.freeze({
        createDebugLogger,
        createRuntimeDiagnosticsBridge
    });
}));
