(function folderViewPlusFatalBannerBootstrap(root) {
    'use strict';

    const fallbackWindow = typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : root);
    const win = root || fallbackWindow;
    if (!win || !win.document) {
        return;
    }

    const doc = win.document;
    const STYLE_ID = 'fvplus-fatal-banner-style';
    const PANEL_ID = 'fvplus-fatal-banner';
    const COPY_BUTTON_ID = 'fvplus-fatal-copy-report';
    const RETRY_BUTTON_ID = 'fvplus-fatal-retry';
    const RELOAD_BUTTON_ID = 'fvplus-fatal-reload';
    const DOWNLOAD_BUTTON_ID = 'fvplus-fatal-download';
    const BROWSER_ERROR_STORAGE_KEY = 'fv.support.bundle.consoleErrors.v1';
    const STARTUP_INCIDENT_STORAGE_KEY = 'fv.support.bundle.startupIncident.v1';
    const INCIDENT_SCHEMA_VERSION = 1;
    const INCIDENT_TTL_MS = 24 * 60 * 60 * 1000;
    const DIAGNOSTIC_REQUEST_LIMIT = 16;
    const DIAGNOSTIC_STEP_LIMIT = 10;
    const DIAGNOSTIC_ACTION_LIMIT = 10;
    const BROWSER_ERROR_LIMIT = 30;
    const MODULE_EVENT_LIMIT = 80;
    const RECOVERY_ATTEMPT_LIMIT = 8;
    const browserErrorSessionStartedAt = new Date().toISOString();
    let browserErrorSessionCounter = 0;
    const createBrowserErrorSessionId = () => {
        const cryptoApi = window.crypto || null;
        if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
            return `fvplus-browser-${cryptoApi.randomUUID()}`;
        }
        if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
            const bytes = new Uint8Array(16);
            cryptoApi.getRandomValues(bytes);
            return `fvplus-browser-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
        }
        browserErrorSessionCounter += 1;
        return `fvplus-browser-${Date.now().toString(36)}-${browserErrorSessionCounter.toString(36)}`;
    };
    const browserErrorSessionId = createBrowserErrorSessionId();

    const state = {
        environment: {
            page: 'Settings',
            url: '',
            pluginVersion: 'unknown',
            unraidVersion: 'unknown',
            channel: 'unknown',
            userAgent: '',
            timestamp: ''
        },
        currentPhase: 'bootstrap',
        lastStep: '',
        steps: [],
        lastAction: '',
        actions: [],
        modules: {},
        requests: [],
        moduleEvents: [],
        recoveryAttempts: [],
        recoveryHandlers: {},
        activeRecovery: false,
        prefs: {
            fetched: false,
            normalized: false,
            sourceType: '',
            rawSchemaVersion: 'unknown',
            normalizedSchemaVersion: 'unknown',
            fallbackUsed: false,
            migrationApplied: false,
            normalizeError: ''
        },
        activeIssue: null,
        issueHistory: {}
    };

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const toDetailList = (details) => {
        if (!Array.isArray(details)) {
            return [];
        }
        return details
            .map((entry) => String(entry ?? '').trim())
            .filter((entry) => entry !== '');
    };

    const trimString = (value) => String(value ?? '').trim();

    const t = (key, fallback, ...params) => {
        try {
            const early = trimString(win.FolderViewPlusEarlyI18n?.messages?.[key] || '');
            if (early) {
                return params.reduce(
                    (message, value, index) => message.split(`$${index + 1}`).join(String(value ?? '')),
                    early
                );
            }
            const translated = win.FolderViewPlusI18n?.t?.(key, fallback, ...params);
            return trimString(translated || fallback || key) || trimString(fallback || key);
        } catch (_error) {
            return trimString(fallback || key);
        }
    };

    const createIncidentId = () => {
        const cryptoApi = win.crypto || null;
        if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
            return `fvplus-incident-${cryptoApi.randomUUID()}`;
        }
        browserErrorSessionCounter += 1;
        return `fvplus-incident-${Date.now().toString(36)}-${browserErrorSessionCounter.toString(36)}`;
    };

    const sanitizeUrl = (value) => {
        const raw = trimString(value);
        if (!raw) {
            return 'unknown';
        }
        try {
            const parsed = new URL(raw, win.location?.href || 'http://localhost/');
            return parsed.pathname || '/';
        } catch (_error) {
            return raw.split('?')[0].split('#')[0] || 'unknown';
        }
    };

    const sanitizeDiagnosticText = (value) => {
        let text = String(value ?? '');
        text = text.replace(/https?:\/\/[^\s/]+/gi, '[private-host]');
        text = text.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[private-address]');
        text = text.replace(/\b[a-f0-9]{0,4}:[a-f0-9:]+\b/gi, '[private-address]');
        text = text.replace(/\b[A-Za-z]:\\[^\s|]+/g, '[private-path]');
        text = text.replace(/\/(?:mnt|boot|root|home|tmp|var\/tmp)\/[^\s|)]+/g, '[private-path]');
        return text;
    };

    const normalizePrivacyMode = (value) => trimString(value).toLowerCase() === 'full' ? 'full' : 'sanitized';

    const classifyError = (error, fallbackCategory = 'runtime-failed') => {
        const status = Number(error?.jqXHR?.status || error?.status || 0);
        const message = trimString(error?.message || error).toLowerCase();
        if (status === 401 || message.includes('http 401') || message.includes('invalid request token')) return 'auth-failed';
        if (status === 403 || message.includes('http 403') || message.includes('request guard')) return 'request-guard';
        if (status === 404 || message.includes('http 404') || message.includes('missing endpoint')) return 'missing-endpoint';
        if (status >= 500 || /\bhttp 5\d\d\b/.test(message)) return 'server-error';
        if (message.includes('timed out') || message.includes('timeout')) return 'asset-timeout';
        if (message.includes('content security policy') || message.includes('csp')) return 'csp-violation';
        if (message.includes('missing modules') || message.includes('module did not load')) return 'missing-module';
        if (message.includes('failed to load') && (message.includes('.js') || message.includes('.css') || message.includes('module'))) return 'missing-asset';
        if (message.includes('version') && (message.includes('mismatch') || message.includes('stale'))) return 'version-mismatch';
        if (message.includes('invalid json') || message.includes('unexpected json') || (message.includes('json') && message.includes('parse'))) return 'invalid-response';
        if (message.includes('prefs') || message.includes('preference')) return 'prefs-corrupt';
        if (message.includes('render')) return 'render-failed';
        return trimString(fallbackCategory || 'runtime-failed') || 'runtime-failed';
    };

    const summarizeUrl = (value) => {
        const raw = trimString(value);
        if (!raw) {
            return 'unknown';
        }
        try {
            const parsed = new URL(raw, win.location?.href || 'http://localhost/');
            return `${parsed.pathname || '/'}${parsed.search || ''}`;
        } catch (_error) {
            return raw;
        }
    };

    const readStoredBrowserErrors = () => {
        try {
            const raw = String(win.localStorage?.getItem(BROWSER_ERROR_STORAGE_KEY) || '').trim();
            if (!raw) {
                return [];
            }
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.filter((entry) => entry && typeof entry === 'object') : [];
        } catch (_error) {
            return [];
        }
    };

    const persistBrowserError = (entry = {}) => {
        try {
            const rows = readStoredBrowserErrors();
            rows.push({
                at: trimString(entry.at || new Date().toISOString()),
                sessionId: browserErrorSessionId,
                observedPluginVersion: trimString(state.environment.pluginVersion || 'unknown') || 'unknown',
                page: trimString(entry.page || state.environment.page || 'Plugin') || 'Plugin',
                category: trimString(entry.category || 'runtime-failed') || 'runtime-failed',
                phase: trimString(entry.phase || state.currentPhase || 'runtime') || 'runtime',
                message: trimString(entry.message || 'Unknown error') || 'Unknown error',
                sourceUrl: trimString(entry.sourceUrl || ''),
                stack: String(entry.stack || '').slice(0, 2000),
                detail: String(entry.detail || '').slice(0, 800)
            });
            win.localStorage?.setItem(
                BROWSER_ERROR_STORAGE_KEY,
                JSON.stringify(rows.slice(-BROWSER_ERROR_LIMIT))
            );
        } catch (_error) {
            // Never let telemetry persistence break the runtime page.
        }
    };

    const getBrowserConsoleErrorSnapshot = () => {
        const entries = readStoredBrowserErrors().slice(-BROWSER_ERROR_LIMIT).map((entry) => ({
            ...entry,
            observedPluginVersion: trimString(entry?.observedPluginVersion || 'unknown') || 'unknown',
            currentSession: trimString(entry?.sessionId) === browserErrorSessionId
        }));
        const timestamps = entries
            .map((entry) => trimString(entry?.at))
            .filter(Boolean)
            .sort();
        const currentSessionCount = entries.filter((entry) => entry.currentSession === true).length;
        return {
            storageKey: BROWSER_ERROR_STORAGE_KEY,
            maxEntries: BROWSER_ERROR_LIMIT,
            count: entries.length,
            collectionPluginVersion: trimString(state.environment.pluginVersion || 'unknown') || 'unknown',
            firstSeenAt: timestamps[0] || null,
            lastSeenAt: timestamps[timestamps.length - 1] || null,
            sessionId: browserErrorSessionId,
            sessionStartedAt: browserErrorSessionStartedAt,
            currentSessionCount,
            historicalCount: Math.max(0, entries.length - currentSessionCount),
            entries
        };
    };

    const getRuntimeConfig = () => {
        const value = win.FolderViewPlusFatalRuntimeContext;
        if (value && typeof value === 'object') {
            return value;
        }
        if (typeof value === 'string' && value.trim() !== '') {
            return { page: value.trim() };
        }
        return {};
    };

    const resolveContext = (contextOverride) => {
        const direct = String(contextOverride || '').trim();
        if (direct) {
            return direct;
        }
        const config = getRuntimeConfig();
        const page = String(config.page || '').trim();
        return page || 'Plugin';
    };

    const seedEnvironmentFromRuntimeContext = () => {
        const config = getRuntimeConfig();
        state.environment.page = trimString(config.page || state.environment.page || 'Settings') || 'Settings';
        state.environment.url = trimString(win.location?.href || state.environment.url || '');
        state.environment.userAgent = trimString(win.navigator?.userAgent || state.environment.userAgent || '');
        state.environment.pluginVersion = trimString(config.pluginVersion || state.environment.pluginVersion || 'unknown') || 'unknown';
        state.environment.unraidVersion = trimString(config.unraidVersion || state.environment.unraidVersion || 'unknown') || 'unknown';
        state.environment.channel = trimString(config.channel || state.environment.channel || 'unknown') || 'unknown';
    };
    seedEnvironmentFromRuntimeContext();

    const markStep = (step) => {
        const normalized = trimString(step);
        if (!normalized) {
            return;
        }
        state.lastStep = normalized;
        state.steps.push(normalized);
        if (state.steps.length > DIAGNOSTIC_STEP_LIMIT) {
            state.steps = state.steps.slice(-DIAGNOSTIC_STEP_LIMIT);
        }
    };

    const setPhase = (phase) => {
        const normalized = trimString(phase);
        if (!normalized) {
            return;
        }
        state.currentPhase = normalized;
    };

    const recordAction = (action) => {
        const normalized = trimString(action);
        if (!normalized) {
            return;
        }
        const entry = {
            action: normalized,
            at: new Date().toISOString()
        };
        state.lastAction = normalized;
        state.actions.push(entry);
        if (state.actions.length > DIAGNOSTIC_ACTION_LIMIT) {
            state.actions = state.actions.slice(-DIAGNOSTIC_ACTION_LIMIT);
        }
    };

    const setEnvironment = (patch = {}) => {
        if (!patch || typeof patch !== 'object') {
            return;
        }
        state.environment = {
            ...state.environment,
            ...Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, trimString(value)]))
        };
    };

    const setModuleStatus = (name, status = 'ok', detail = '') => {
        const normalizedName = trimString(name);
        if (!normalizedName) {
            return;
        }
        state.modules[normalizedName] = {
            status: trimString(status || 'unknown') || 'unknown',
            detail: trimString(detail)
        };
    };

    const recordModuleEvent = (entry = {}) => {
        const name = trimString(entry.name || getAssetFileName(entry.url || '')) || 'unknown';
        const event = {
            name,
            stage: trimString(entry.stage || state.currentPhase || 'bootstrap') || 'bootstrap',
            outcome: trimString(entry.outcome || 'unknown') || 'unknown',
            startedAt: trimString(entry.startedAt || ''),
            completedAt: trimString(entry.completedAt || ''),
            durationMs: Math.max(0, Number(entry.durationMs) || 0),
            version: trimString(entry.version || ''),
            retry: entry.retry === true,
            detail: sanitizeDiagnosticText(trimString(entry.detail || ''))
        };
        state.moduleEvents.push(event);
        if (state.moduleEvents.length > MODULE_EVENT_LIMIT) {
            state.moduleEvents = state.moduleEvents.slice(-MODULE_EVENT_LIMIT);
        }
        setModuleStatus(name, event.outcome, event.detail || `${event.stage}; ${event.durationMs} ms`);
        return Object.freeze({ ...event });
    };

    const registerRecoveryHandler = (name, handler) => {
        const key = trimString(name);
        if (!key || typeof handler !== 'function') {
            return false;
        }
        state.recoveryHandlers[key] = handler;
        return true;
    };

    const unregisterRecoveryHandler = (name) => {
        const key = trimString(name);
        if (!key || !Object.prototype.hasOwnProperty.call(state.recoveryHandlers, key)) {
            return false;
        }
        delete state.recoveryHandlers[key];
        return true;
    };

    const readPersistedStartupIncident = () => {
        try {
            const raw = trimString(win.sessionStorage?.getItem(STARTUP_INCIDENT_STORAGE_KEY));
            if (!raw) {
                return null;
            }
            const parsed = JSON.parse(raw);
            const expiresAtMs = Date.parse(String(parsed?.expiresAt || ''));
            if (!parsed || typeof parsed !== 'object' || Number.isNaN(expiresAtMs) || expiresAtMs <= Date.now()) {
                win.sessionStorage?.removeItem(STARTUP_INCIDENT_STORAGE_KEY);
                return null;
            }
            return parsed;
        } catch (_error) {
            return null;
        }
    };

    const getStartupIncidentSnapshot = () => {
        const active = state.activeIssue;
        const persisted = readPersistedStartupIncident();
        if (!active) {
            return persisted || { available: false, schemaVersion: INCIDENT_SCHEMA_VERSION };
        }
        return {
            available: true,
            schemaVersion: INCIDENT_SCHEMA_VERSION,
            incidentId: trimString(active.incidentId),
            status: trimString(active.status || 'active') || 'active',
            surface: trimString(state.environment.page || 'Plugin') || 'Plugin',
            code: trimString(active.code),
            severity: trimString(active.severity),
            category: trimString(active.category),
            phase: trimString(active.phase),
            firstSeenAt: trimString(active.firstSeenAt),
            lastSeenAt: trimString(active.lastSeenAt),
            route: sanitizeUrl(state.environment.url || win.location?.href || ''),
            pluginVersion: trimString(state.environment.pluginVersion || 'unknown') || 'unknown',
            unraidVersion: trimString(state.environment.unraidVersion || 'unknown') || 'unknown',
            lastStep: sanitizeDiagnosticText(state.lastStep),
            lastAction: sanitizeDiagnosticText(state.lastAction),
            modules: state.moduleEvents.slice(-MODULE_EVENT_LIMIT).map((entry) => ({ ...entry })),
            recoveryAttempts: state.recoveryAttempts.slice(-RECOVERY_ATTEMPT_LIMIT).map((entry) => ({ ...entry }))
        };
    };

    const persistStartupIncident = () => {
        try {
            const snapshot = getStartupIncidentSnapshot();
            if (snapshot?.available !== true) {
                return;
            }
            const persistedAt = new Date().toISOString();
            win.sessionStorage?.setItem(STARTUP_INCIDENT_STORAGE_KEY, JSON.stringify({
                ...snapshot,
                persistedAt,
                expiresAt: new Date(Date.now() + INCIDENT_TTL_MS).toISOString()
            }));
        } catch (_error) {
            // Startup reporting must remain available when storage is restricted.
        }
    };

    const recordRecoveryAttempt = (entry = {}) => {
        const attempt = {
            action: trimString(entry.action || 'retry') || 'retry',
            status: trimString(entry.status || 'started') || 'started',
            startedAt: trimString(entry.startedAt || new Date().toISOString()),
            completedAt: trimString(entry.completedAt || ''),
            durationMs: Math.max(0, Number(entry.durationMs) || 0),
            detail: sanitizeDiagnosticText(trimString(entry.detail || ''))
        };
        state.recoveryAttempts.push(attempt);
        if (state.recoveryAttempts.length > RECOVERY_ATTEMPT_LIMIT) {
            state.recoveryAttempts = state.recoveryAttempts.slice(-RECOVERY_ATTEMPT_LIMIT);
        }
        persistStartupIncident();
        return attempt;
    };

    const recordRequest = (entry = {}) => {
        const method = trimString(entry.method || 'GET') || 'GET';
        const url = summarizeUrl(entry.url);
        const outcome = trimString(entry.outcome || 'unknown') || 'unknown';
        const nextEntry = {
            method,
            url,
            outcome,
            status: trimString(entry.status || ''),
            traceId: trimString(entry.traceId || ''),
            source: trimString(entry.source || ''),
            category: trimString(entry.category || ''),
            detail: trimString(entry.detail || ''),
            responseSnippet: trimString(entry.responseSnippet || '')
        };
        state.requests.push(nextEntry);
        if (state.requests.length > DIAGNOSTIC_REQUEST_LIMIT) {
            state.requests = state.requests.slice(-DIAGNOSTIC_REQUEST_LIMIT);
        }
    };

    const setPrefsStatus = (patch = {}) => {
        if (!patch || typeof patch !== 'object') {
            return;
        }
        state.prefs = {
            ...state.prefs,
            ...patch
        };
    };

    const registerIssueOccurrence = (issue = {}) => {
        const signature = JSON.stringify([
            trimString(issue.code || 'FVPLUS-SET-RUNTIME-001') || 'FVPLUS-SET-RUNTIME-001',
            trimString(issue.phase || state.currentPhase || 'unknown') || 'unknown',
            trimString(issue.category || 'runtime-failed') || 'runtime-failed',
            trimString(issue.severity || 'fatal') || 'fatal',
            trimString(issue.title || ''),
            trimString(issue.message || ''),
            ...toDetailList(issue.details)
        ]);
        const now = new Date().toISOString();
        const existing = state.issueHistory[signature];
        if (existing) {
            existing.count += 1;
            existing.lastSeenAt = now;
            return existing;
        }
        const created = {
            count: 1,
            firstSeenAt: now,
            lastSeenAt: now
        };
        state.issueHistory[signature] = created;
        return created;
    };

    const buildSupportReport = (issue = null, options = {}) => {
        const privacyMode = normalizePrivacyMode(options.privacy || 'sanitized');
        const protect = (value) => privacyMode === 'full' ? String(value ?? '') : sanitizeDiagnosticText(value);
        const activeIssue = issue || state.activeIssue || {};
        const environmentLines = [
            `page: ${trimString(state.environment.page || 'Settings') || 'Settings'}`,
            `pluginVersion: ${trimString(state.environment.pluginVersion || 'unknown') || 'unknown'}`,
            `channel: ${trimString(state.environment.channel || 'unknown') || 'unknown'}`,
            `unraidVersion: ${trimString(state.environment.unraidVersion || 'unknown') || 'unknown'}`,
            `url: ${privacyMode === 'full' ? (trimString(state.environment.url || 'unknown') || 'unknown') : sanitizeUrl(state.environment.url || 'unknown')}`,
            `userAgent: ${protect(trimString(state.environment.userAgent || 'unknown') || 'unknown')}`
        ];
        const moduleLines = Object.entries(state.modules)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([name, info]) => `${name}: ${trimString(info?.status || 'unknown')}${trimString(info?.detail) ? ` (${protect(trimString(info.detail))})` : ''}`);
        const requestLines = state.requests.map((entry) => {
            const parts = [
                `${entry.method} ${privacyMode === 'full' ? entry.url : sanitizeUrl(entry.url)}`,
                `outcome=${entry.outcome}`
            ];
            if (entry.status) {
                parts.push(`status=${entry.status}`);
            }
            if (entry.traceId) {
                parts.push(`trace=${entry.traceId}`);
            }
            if (entry.source) {
                parts.push(`source=${entry.source}`);
            }
            if (entry.category) {
                parts.push(`category=${entry.category}`);
            }
            if (entry.detail) {
                parts.push(`detail=${protect(entry.detail)}`);
            }
            if (entry.responseSnippet) {
                parts.push(`response=${protect(entry.responseSnippet)}`);
            }
            return parts.join(' | ');
        });
        const moduleEventLines = state.moduleEvents.length > 0
            ? state.moduleEvents.map((entry) => [
                `${entry.name}: ${entry.outcome}`,
                `stage=${entry.stage}`,
                `durationMs=${entry.durationMs}`,
                entry.version ? `version=${entry.version}` : '',
                entry.retry ? 'retry=yes' : '',
                entry.detail ? `detail=${protect(entry.detail)}` : ''
            ].filter(Boolean).join(' | '))
            : ['none'];
        const recoveryLines = state.recoveryAttempts.length > 0
            ? state.recoveryAttempts.map((entry) => [
                `${entry.startedAt} | ${entry.action} | ${entry.status}`,
                entry.durationMs ? `durationMs=${entry.durationMs}` : '',
                entry.detail ? `detail=${protect(entry.detail)}` : ''
            ].filter(Boolean).join(' | '))
            : ['none'];
        const stepLines = state.steps.length > 0 ? state.steps : ['none'];
        const actionLines = state.actions.length > 0
            ? state.actions.map((entry) => `${trimString(entry.at || 'unknown') || 'unknown'} | ${trimString(entry.action || 'unknown') || 'unknown'}`)
            : ['none'];
        const prefsLines = [
            `fetched: ${state.prefs.fetched === true ? 'yes' : 'no'}`,
            `normalized: ${state.prefs.normalized === true ? 'yes' : 'no'}`,
            `sourceType: ${trimString(state.prefs.sourceType || 'unknown') || 'unknown'}`,
            `rawSchemaVersion: ${trimString(state.prefs.rawSchemaVersion || 'unknown') || 'unknown'}`,
            `normalizedSchemaVersion: ${trimString(state.prefs.normalizedSchemaVersion || 'unknown') || 'unknown'}`,
            `fallbackUsed: ${state.prefs.fallbackUsed === true ? 'yes' : 'no'}`,
            `migrationApplied: ${state.prefs.migrationApplied === true ? 'yes' : 'no'}`,
            `normalizeError: ${trimString(state.prefs.normalizeError || 'none') || 'none'}`
        ];
        const affectedAreaLines = toDetailList(activeIssue.details).map(protect);
        return [
            `FolderView Plus ${trimString(state.environment.page || 'Plugin') || 'Plugin'} Diagnostics`,
            `schemaVersion: ${INCIDENT_SCHEMA_VERSION}`,
            `incidentId: ${trimString(activeIssue.incidentId || 'unknown') || 'unknown'}`,
            `privacyMode: ${privacyMode}`,
            `errorCode: ${trimString(activeIssue.code || 'FVPLUS-SET-RUNTIME-001') || 'FVPLUS-SET-RUNTIME-001'}`,
            `phase: ${trimString(activeIssue.phase || state.currentPhase || 'unknown') || 'unknown'}`,
            `severity: ${trimString(activeIssue.severity || 'fatal') || 'fatal'}`,
            `category: ${trimString(activeIssue.category || 'runtime-failed') || 'runtime-failed'}`,
            `occurrences: ${Number(activeIssue.occurrences || 1) || 1}`,
            `firstSeenAt: ${trimString(activeIssue.firstSeenAt || 'unknown') || 'unknown'}`,
            `lastSeenAt: ${trimString(activeIssue.lastSeenAt || 'unknown') || 'unknown'}`,
            `lastStep: ${protect(trimString(state.lastStep || 'unknown') || 'unknown')}`,
            `lastAction: ${protect(trimString(state.lastAction || 'unknown') || 'unknown')}`,
            `summary: ${protect(trimString(activeIssue.message || activeIssue.summary || 'unknown') || 'unknown')}`,
            '',
            '[affected-areas]',
            ...(affectedAreaLines.length > 0 ? affectedAreaLines : ['none']),
            '',
            '[environment]',
            ...environmentLines,
            '',
            '[modules]',
            ...(moduleLines.length > 0 ? moduleLines : ['none']),
            '',
            '[module-events]',
            ...moduleEventLines,
            '',
            '[requests]',
            ...(requestLines.length > 0 ? requestLines : ['none']),
            '',
            '[prefs]',
            ...prefsLines,
            '',
            '[steps]',
            ...stepLines.map(protect),
            '',
            '[recent-actions]',
            ...actionLines.map(protect),
            '',
            '[recovery-attempts]',
            ...recoveryLines
        ].join('\n');
    };

    const copyDiagnostics = async () => {
        const text = buildSupportReport(null, { privacy: 'sanitized' });
        if (!text) {
            return false;
        }
        try {
            if (win.navigator?.clipboard && typeof win.navigator.clipboard.writeText === 'function') {
                await win.navigator.clipboard.writeText(text);
                return true;
            }
        } catch (_error) {
            // Fallback below.
        }
        const textarea = doc.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', 'readonly');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        doc.body.appendChild(textarea);
        textarea.select();
        let copied = false;
        try {
            copied = doc.execCommand('copy');
        } catch (_error) {
            copied = false;
        } finally {
            textarea.remove();
        }
        return copied;
    };

    const downloadDiagnostics = () => {
        const text = buildSupportReport(null, { privacy: 'sanitized' });
        if (!text || typeof win.Blob !== 'function' || typeof win.URL?.createObjectURL !== 'function') {
            return false;
        }
        let objectUrl = '';
        try {
            const blob = new win.Blob([text], { type: 'text/plain;charset=utf-8' });
            objectUrl = win.URL.createObjectURL(blob);
            const anchor = doc.createElement('a');
            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            anchor.href = objectUrl;
            anchor.download = `FolderView-Plus-Startup-Report-${stamp}.txt`;
            anchor.style.display = 'none';
            (doc.body || doc.documentElement).appendChild(anchor);
            anchor.click();
            anchor.remove();
            recordAction('Downloaded sanitized startup report');
            return true;
        } catch (_error) {
            return false;
        } finally {
            if (objectUrl) {
                win.setTimeout(() => win.URL.revokeObjectURL(objectUrl), 0);
            }
        }
    };

    const setBootstrapPresentationState = (mode = 'failed') => {
        const root = doc.getElementById('fv-settings-root');
        const shell = doc.getElementById('fv-settings-bootstrap-shell');
        if (!root) {
            return;
        }
        if (mode === 'retrying') {
            root.classList.remove('fv-settings-bootstrap-failed');
            root.classList.add('fv-settings-bootstrap-pending');
            root.setAttribute('aria-busy', 'true');
            if (shell) shell.hidden = false;
            win.FolderViewPlusMarkSettingsBootstrapState?.({
                ready: false,
                failed: false,
                lastPhase: 'bootstrap-retry',
                lastAction: 'Retry Settings startup'
            });
            return;
        }
        if (mode === 'ready') {
            root.classList.remove('fv-settings-bootstrap-failed', 'fv-settings-bootstrap-pending');
            root.setAttribute('aria-busy', 'false');
            if (shell) shell.hidden = true;
            win.FolderViewPlusMarkSettingsBootstrapState?.({ ready: true, failed: false });
            return;
        }
        root.classList.remove('fv-settings-bootstrap-pending');
        root.classList.add('fv-settings-bootstrap-failed');
        root.setAttribute('aria-busy', 'false');
        if (shell) shell.hidden = true;
        win.FolderViewPlusMarkSettingsBootstrapState?.({
            ready: false,
            failed: true,
            lastPhase: state.currentPhase || 'bootstrap',
            lastAction: 'Display startup error'
        });
    };

    const updateRecoveryButton = (label, disabled = false) => {
        const button = doc.getElementById(RETRY_BUTTON_ID);
        if (!button) return;
        button.textContent = label;
        button.disabled = disabled;
        button.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    };

    const runRecovery = async (name = 'retry') => {
        const normalizedName = trimString(name) || 'retry';
        const handler = state.recoveryHandlers[normalizedName];
        const priorAttempts = state.recoveryAttempts.filter((entry) => (
            entry.action === normalizedName && entry.status === 'started'
        )).length;
        if (normalizedName === 'retry' && priorAttempts >= 1) {
            return false;
        }
        if (typeof handler !== 'function' || state.activeRecovery) {
            return false;
        }
        state.activeRecovery = true;
        const startedAt = new Date().toISOString();
        const startedMs = Date.now();
        recordRecoveryAttempt({ action: normalizedName, status: 'started', startedAt });
        updateRecoveryButton(t('diagnostics.bootstrap.retrying', 'Trying again…'), true);
        setBootstrapPresentationState('retrying');
        try {
            await handler();
            const completedAt = new Date().toISOString();
            recordRecoveryAttempt({
                action: normalizedName,
                status: 'succeeded',
                startedAt,
                completedAt,
                durationMs: Date.now() - startedMs
            });
            if (state.activeIssue) {
                state.activeIssue.status = 'recovered';
                state.activeIssue.lastSeenAt = completedAt;
                persistStartupIncident();
            }
            recordAction('Startup recovery succeeded');
            updateRecoveryButton(t('diagnostics.bootstrap.retry-succeeded', 'Loading resumed'), true);
            return true;
        } catch (error) {
            const completedAt = new Date().toISOString();
            recordRecoveryAttempt({
                action: normalizedName,
                status: 'failed',
                startedAt,
                completedAt,
                durationMs: Date.now() - startedMs,
                detail: error?.message || error
            });
            recordAction('Startup recovery failed');
            setBootstrapPresentationState('failed');
            updateRecoveryButton(t('diagnostics.bootstrap.retry-failed', 'Try again failed'), true);
            return false;
        } finally {
            state.activeRecovery = false;
        }
    };

    const resolveHost = (hostSelectorOverride) => {
        const config = getRuntimeConfig();
        const selectors = [
            hostSelectorOverride,
            config.hostSelector,
            '#fv-settings-root',
            '.canvas',
            'body'
        ]
            .flatMap((entry) => typeof entry === 'string' ? entry.split(',') : [])
            .map((entry) => entry.trim())
            .filter((entry) => entry !== '');
        for (const selector of selectors) {
            const host = doc.querySelector(selector);
            if (host) {
                return host;
            }
        }
        return doc.body || doc.documentElement || null;
    };

    const ensureStyles = () => {
        if (doc.getElementById(STYLE_ID)) {
            return;
        }
        const style = doc.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
#${PANEL_ID} {
    display: grid;
    gap: 0.45rem;
    margin: 0 0 0.85rem;
    padding: 0.8rem 0.95rem;
    border: 1px solid var(--orange, var(--fvplus-theme-accent, currentColor));
    border-radius: 8px;
    background: var(--fvplus-theme-surface-panel, transparent);
    color: var(--fvplus-theme-text-primary, currentColor);
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.22);
}
#${PANEL_ID}.is-degraded {
    border-color: var(--link, var(--fvplus-theme-accent, currentColor));
    background: var(--fvplus-theme-surface-panel, transparent);
    color: var(--fvplus-theme-text-primary, currentColor);
}
#${PANEL_ID} .fvplus-fatal-title {
    font-size: 1.03rem;
    font-weight: 700;
    color: var(--orange, var(--fvplus-theme-accent, currentColor));
}
#${PANEL_ID}.is-degraded .fvplus-fatal-title {
    color: var(--link, var(--fvplus-theme-accent, currentColor));
}
#${PANEL_ID} .fvplus-fatal-title i {
    margin-right: 0.45rem;
}
#${PANEL_ID} .fvplus-fatal-text,
#${PANEL_ID} .fvplus-fatal-help {
    line-height: 1.35;
}
#${PANEL_ID} .fvplus-fatal-facts {
    display: grid;
    gap: 0.16rem;
    margin: 0.1rem 0;
}
#${PANEL_ID} .fvplus-fatal-fact {
    color: var(--fvplus-theme-text-muted, currentColor);
    font-size: 0.98rem;
}
#${PANEL_ID} .fvplus-fatal-list-title {
    font-weight: 600;
    color: var(--orange, var(--fvplus-theme-accent, currentColor));
}
#${PANEL_ID} .fvplus-fatal-list {
    margin: 0;
    padding-left: 1.1rem;
}
#${PANEL_ID} .fvplus-fatal-list li {
    margin: 0.1rem 0;
}
#${PANEL_ID} .fvplus-fatal-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
}
#${PANEL_ID} .fvplus-fatal-actions button {
    min-height: 30px;
    padding: 0.16rem 0.62rem;
}
#${PANEL_ID} .fvplus-fatal-actions button:focus-visible,
#${PANEL_ID} .fvplus-fatal-details summary:focus-visible {
    outline: 2px solid var(--link, var(--fvplus-theme-accent, currentColor));
    outline-offset: 2px;
}
#${PANEL_ID} .fvplus-fatal-reference {
    font-weight: 700;
}
#${PANEL_ID} details.fvplus-fatal-details {
    border-top: 1px solid var(--fvplus-theme-border-subtle, currentColor);
    padding-top: 0.45rem;
}
#${PANEL_ID} .fvplus-fatal-details summary {
    cursor: pointer;
    font-weight: 600;
}
#${PANEL_ID} .fvplus-fatal-pre {
    margin: 0.45rem 0 0;
    padding: 0.65rem 0.75rem;
    border-radius: 6px;
    background: var(--fvplus-theme-surface-muted, transparent);
    color: var(--fvplus-theme-text-primary, currentColor);
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 0.95rem;
    line-height: 1.35;
}
@media (prefers-reduced-motion: reduce) {
    #${PANEL_ID} *,
    #${PANEL_ID} *::before,
    #${PANEL_ID} *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
}
        `.trim();
        (doc.head || doc.documentElement || doc.body).appendChild(style);
    };

    const getPanel = () => doc.getElementById(PANEL_ID);

    const RECOVERABLE_CATEGORIES = Object.freeze(new Set([
        'missing-asset',
        'missing-module',
        'asset-timeout',
        'version-mismatch',
        'auth-failed',
        'request-guard',
        'missing-endpoint',
        'server-error',
        'invalid-response',
        'runtime-failed',
        'promise-rejection',
        'render-failed',
        'blank-page'
    ]));

    const getUserFacingCopy = (context, category, severity, options = {}) => {
        const isDegraded = severity === 'degraded';
        const fallbackTitle = isDegraded
            ? `${context} loaded with limited functionality`
            : `FolderView Plus could not finish loading ${context}`;
        const messages = {
            'missing-asset': 'A required plugin file did not load.',
            'missing-module': 'A required plugin component is unavailable.',
            'asset-timeout': 'A required plugin file took too long to load.',
            'version-mismatch': 'The browser and installed plugin appear to be using different versions.',
            'auth-failed': 'The page request expired before startup completed.',
            'request-guard': 'Unraid rejected a startup request before FolderView Plus could finish loading.',
            'missing-endpoint': 'A required plugin service could not be found.',
            'server-error': 'Unraid returned a server error while FolderView Plus was starting.',
            'invalid-response': 'A plugin service returned data that could not be read.',
            'prefs-corrupt': 'Saved FolderView Plus preferences could not be read safely.',
            'csp-violation': 'The browser blocked a required FolderView Plus resource.',
            'render-failed': 'The plugin loaded, but its interface could not be displayed.',
            'blank-page': 'The plugin started, but no usable interface became visible.',
            'promise-rejection': 'A plugin startup task stopped unexpectedly.',
            'runtime-failed': 'FolderView Plus encountered an unexpected startup error.'
        };
        const fallbackMessage = isDegraded
            ? `FolderView Plus kept ${context} available, but part of the plugin may be incomplete.`
            : (messages[category] || messages['runtime-failed']);
        return {
            title: trimString(options.userTitle || options.title || fallbackTitle) || fallbackTitle,
            message: trimString(options.userMessage || options.message || fallbackMessage) || fallbackMessage,
            help: trimString(options.help || (isDegraded
                ? 'You can continue using the available controls. Download the startup report if support asks for more detail.'
                : 'Try the available recovery action. If the problem continues, download the sanitized startup report for support.'))
        };
    };

    const createIncidentRecord = (options = {}) => {
        const context = resolveContext(options.context);
        const code = trimString(options.code || 'FVPLUS-SET-RUNTIME-001') || 'FVPLUS-SET-RUNTIME-001';
        const phase = trimString(options.phase || state.currentPhase || 'unknown') || 'unknown';
        const severity = trimString(options.severity || 'fatal') || 'fatal';
        const category = trimString(options.category || 'runtime-failed') || 'runtime-failed';
        const copy = getUserFacingCopy(context, category, severity, options);
        const details = toDetailList(options.details);
        const occurrence = registerIssueOccurrence({
            title: copy.title,
            message: copy.message,
            details,
            code,
            phase,
            severity,
            category
        });
        const sameIncident = state.activeIssue
            && state.activeIssue.code === code
            && state.activeIssue.phase === phase
            && state.activeIssue.category === category;
        state.activeIssue = {
            incidentId: sameIncident ? state.activeIssue.incidentId : createIncidentId(),
            status: 'active',
            title: copy.title,
            message: copy.message,
            help: copy.help,
            detailLabel: trimString(options.detailLabel || 'Details') || 'Details',
            details,
            code,
            phase,
            severity,
            category,
            occurrences: occurrence.count,
            firstSeenAt: occurrence.firstSeenAt,
            lastSeenAt: occurrence.lastSeenAt
        };
        state.environment.timestamp = new Date().toISOString();
        persistStartupIncident();
        return state.activeIssue;
    };

    const captureIncident = (options = {}) => Object.freeze({ ...createIncidentRecord(options) });

    const clearResolvedIssue = () => {
        if (state.activeIssue) {
            state.activeIssue.status = 'recovered';
            state.activeIssue.lastSeenAt = new Date().toISOString();
            persistStartupIncident();
        } else {
            const persisted = readPersistedStartupIncident();
            if (
                persisted?.available === true
                && persisted.status === 'active'
                && persisted.surface === (trimString(state.environment.page || 'Plugin') || 'Plugin')
            ) {
                try {
                    win.sessionStorage?.setItem(STARTUP_INCIDENT_STORAGE_KEY, JSON.stringify({
                        ...persisted,
                        status: 'recovered',
                        recoveredAt: new Date().toISOString(),
                        expiresAt: new Date(Date.now() + INCIDENT_TTL_MS).toISOString()
                    }));
                } catch (_error) {
                    // Recovery history is best effort only.
                }
            }
        }
        state.activeIssue = null;
        const panel = getPanel();
        if (panel && panel.parentNode) {
            panel.parentNode.removeChild(panel);
        }
    };

    const renderPanel = (options = {}) => {
        const context = resolveContext(options.context);
        const incident = createIncidentRecord(options);
        const {
            title,
            message,
            help,
            detailLabel,
            details,
            code: errorCode,
            phase,
            severity,
            category,
            occurrences
        } = incident;
        const occurrence = { count: occurrences };
        const signature = JSON.stringify([context, title, message, detailLabel, details.join('|'), severity, category, phase, occurrence.count]);
        const host = resolveHost(options.hostSelector);
        if (!host) {
            return null;
        }
        ensureStyles();

        let panel = getPanel();
        if (!panel) {
            panel = doc.createElement('div');
            panel.id = PANEL_ID;
            panel.className = 'fvplus-fatal-banner';
        }
        if (panel.dataset.fvplusSignature === signature) {
            return panel;
        }
        panel.dataset.fvplusSignature = signature;

        const visibleDetails = details.map(sanitizeDiagnosticText);
        const listHtml = visibleDetails.length > 0 && options.showDetailsInline === true
            ? `
<div class="fvplus-fatal-list-title">${escapeHtml(detailLabel)}</div>
<ul class="fvplus-fatal-list">${visibleDetails.map((entry) => `<li>${escapeHtml(entry)}</li>`).join('')}</ul>
            `.trim()
            : '';
        const facts = [
            `<span class="fvplus-fatal-reference">${escapeHtml(t('diagnostics.bootstrap.reference', 'Reference'))}: ${escapeHtml(errorCode)}</span>`,
            state.lastStep ? `${escapeHtml(t('diagnostics.bootstrap.last-step', 'Last completed step'))}: ${escapeHtml(sanitizeDiagnosticText(state.lastStep))}` : '',
            occurrence.count > 1 ? `${escapeHtml(t('diagnostics.bootstrap.occurrences', 'Occurrences'))}: ${occurrence.count}` : ''
        ].filter((entry) => entry);
        const detailsReport = buildSupportReport(state.activeIssue);
        const canRetry = severity !== 'degraded'
            && RECOVERABLE_CATEGORIES.has(category)
            && typeof state.recoveryHandlers.retry === 'function'
            && state.recoveryAttempts.filter((entry) => entry.action === 'retry' && entry.status === 'started').length < 1;
        const retryAction = canRetry
            ? `<button type="button" id="${RETRY_BUTTON_ID}"><i class="fa fa-repeat" aria-hidden="true"></i> ${escapeHtml(t('diagnostics.bootstrap.retry', 'Try loading again'))}</button>`
            : '';
        const reloadAction = severity !== 'degraded'
            ? `<button type="button" id="${RELOAD_BUTTON_ID}"><i class="fa fa-refresh" aria-hidden="true"></i> ${escapeHtml(t('diagnostics.bootstrap.reload', 'Reload page'))}</button>`
            : '';
        panel.className = `fvplus-fatal-banner${severity === 'degraded' ? ' is-degraded' : ''}`;
        panel.setAttribute('role', severity === 'degraded' ? 'status' : 'alert');
        panel.setAttribute('aria-live', severity === 'degraded' ? 'polite' : 'assertive');
        panel.setAttribute('aria-atomic', 'true');
        panel.setAttribute('aria-labelledby', 'fvplus-fatal-title');
        panel.tabIndex = severity === 'degraded' ? 0 : -1;
        panel.innerHTML = `
<div class="fvplus-fatal-title" id="fvplus-fatal-title"><i class="fa fa-exclamation-triangle" aria-hidden="true"></i>${escapeHtml(title)}</div>
<div class="fvplus-fatal-text">${escapeHtml(message)}</div>
<div class="fvplus-fatal-facts">${facts.map((entry) => `<div class="fvplus-fatal-fact">${entry}</div>`).join('')}</div>
${listHtml}
<div class="fvplus-fatal-actions">
    ${retryAction}
    ${reloadAction}
    <button type="button" id="${COPY_BUTTON_ID}"><i class="fa fa-copy" aria-hidden="true"></i> ${escapeHtml(t('diagnostics.bootstrap.copy', 'Copy support code'))}</button>
    <button type="button" id="${DOWNLOAD_BUTTON_ID}"><i class="fa fa-download" aria-hidden="true"></i> ${escapeHtml(t('diagnostics.bootstrap.download', 'Download startup report'))}</button>
</div>
<details class="fvplus-fatal-details">
    <summary>${escapeHtml(t('diagnostics.cards.technical-details', 'Technical details'))}</summary>
    <pre class="fvplus-fatal-pre">${escapeHtml(detailsReport)}</pre>
</details>
<div class="fvplus-fatal-help">${escapeHtml(help)}</div>
        `.trim();
        if (panel.parentNode !== host) {
            host.prepend(panel);
        } else if (host.firstChild !== panel) {
            host.prepend(panel);
        }
        const copyButton = panel.querySelector(`#${COPY_BUTTON_ID}`);
        if (copyButton) {
            copyButton.addEventListener('click', async () => {
                const copied = await copyDiagnostics();
                copyButton.textContent = copied
                    ? t('diagnostics.bootstrap.copied', 'Support code copied')
                    : t('diagnostics.bootstrap.copy-failed', 'Copy failed');
                win.setTimeout(() => {
                    copyButton.innerHTML = `<i class="fa fa-copy" aria-hidden="true"></i> ${escapeHtml(t('diagnostics.bootstrap.copy', 'Copy support code'))}`;
                }, 1600);
            });
        }
        const retryButton = panel.querySelector(`#${RETRY_BUTTON_ID}`);
        retryButton?.addEventListener('click', () => {
            void runRecovery('retry');
        }, { once: true });
        const reloadButton = panel.querySelector(`#${RELOAD_BUTTON_ID}`);
        reloadButton?.addEventListener('click', () => {
            const startedAt = new Date().toISOString();
            recordRecoveryAttempt({ action: 'reload', status: 'requested', startedAt });
            recordAction('Reloaded page from startup error');
            win.location?.reload?.();
        }, { once: true });
        const downloadButton = panel.querySelector(`#${DOWNLOAD_BUTTON_ID}`);
        downloadButton?.addEventListener('click', () => {
            const downloaded = downloadDiagnostics();
            downloadButton.textContent = downloaded
                ? t('diagnostics.bootstrap.downloaded', 'Startup report downloaded')
                : t('diagnostics.bootstrap.download-failed', 'Download failed');
        });
        if (severity !== 'degraded') {
            setBootstrapPresentationState('failed');
            win.requestAnimationFrame?.(() => {
                try {
                    panel.focus({ preventScroll: true });
                } catch (_error) {
                    panel.focus?.();
                }
            });
        }
        return panel;
    };

    const getAssetFileName = (rawUrl) => {
        const candidate = String(rawUrl || '').trim();
        if (!candidate) {
            return 'Unknown asset';
        }
        try {
            const parsed = new URL(candidate, win.location?.href || 'http://localhost/');
            const pathName = String(parsed.pathname || '');
            const match = pathName.match(/\/([^/?#]+)$/);
            return match ? match[1] : candidate;
        } catch (_error) {
            const stripped = candidate.split('?')[0].split('#')[0];
            const segments = stripped.split('/');
            return segments[segments.length - 1] || stripped;
        }
    };

    const isPluginRelatedError = ({ filename = '', message = '', stack = '', sourceUrl = '' } = {}) => {
        const haystack = [filename, message, stack, sourceUrl]
            .map((entry) => String(entry || ''))
            .join('\n');
        return haystack.includes('/plugins/folderview.plus/')
            || /FolderView Plus/i.test(haystack)
            || /folderview\.plus/i.test(haystack);
    };

    const reportMissingModules = (missingModules = [], options = {}) => {
        const context = resolveContext(options.context);
        for (const entry of toDetailList(missingModules)) {
            setModuleStatus(entry, 'missing', 'required settings module did not load');
        }
        return renderPanel({
            ...options,
            context,
            code: options.code || 'FVPLUS-SET-BOOT-001',
            phase: options.phase || 'module-load',
            category: options.category || 'missing-module',
            severity: options.severity || 'fatal',
            ...(options.title ? { title: String(options.title).trim() } : {}),
            ...(options.message ? { message: String(options.message).trim() } : {}),
            detailLabel: options.detailLabel || 'Missing modules',
            details: toDetailList(missingModules)
        });
    };

    const reportFatalError = (error, options = {}) => {
        const context = resolveContext(options.context);
        if (error && typeof error === 'object') {
            error.fvplusBannerShown = true;
        }
        const rawMessage = error instanceof Error
            ? error.message
            : (typeof error === 'string' ? error : String(error?.message || error || 'Unknown error'));
        const details = toDetailList(options.details);
        if (String(rawMessage || '').trim()) {
            details.push(String(rawMessage).trim());
        }
        const sourceFile = getAssetFileName(options.sourceUrl);
        if (sourceFile && sourceFile !== 'Unknown asset') {
            details.push(`Source: ${sourceFile}`);
        }
        return renderPanel({
            ...options,
            context,
            code: options.code || 'FVPLUS-SET-RUNTIME-001',
            phase: options.phase || 'runtime',
            category: options.category || classifyError(error, 'runtime-failed'),
            severity: options.severity || 'fatal',
            ...(options.title ? { title: String(options.title).trim() } : {}),
            ...(options.message ? { message: String(options.message).trim() } : {}),
            detailLabel: options.detailLabel || 'Error details',
            details
        });
    };

    const reportDegradedState = (error, options = {}) => {
        const context = resolveContext(options.context);
        const rawMessage = error instanceof Error
            ? error.message
            : (typeof error === 'string' ? error : String(error?.message || error || 'Some settings data could not be loaded.'));
        const details = toDetailList(options.details);
        if (details.length <= 0 && String(rawMessage || '').trim()) {
            details.push(String(rawMessage).trim());
        }
        return renderPanel({
            ...options,
            context,
            code: options.code || 'FVPLUS-SET-BOOT-003',
            phase: options.phase || state.currentPhase || 'bootstrap-data',
            category: options.category || 'degraded-mode',
            severity: options.severity || 'degraded',
            title: String(options.title || `${context} loaded in degraded mode`).trim(),
            message: String(options.message || `FolderView Plus kept the ${context.toLowerCase()} page open, but part of the page failed to load.`).trim(),
            detailLabel: options.detailLabel || 'Affected areas',
            details,
            help: String(options.help || 'Some sections may be incomplete until the underlying issue is fixed. Copy diagnostics if you need support.').trim()
        });
    };

    const installGlobalHandlers = () => {
        if (win.FolderViewPlusFatalBannerHandlersInstalled === true) {
            return;
        }
        win.FolderViewPlusFatalBannerHandlersInstalled = true;

        win.addEventListener('error', (event) => {
            const target = event?.target || null;
            if (target && target !== win && (target.tagName === 'SCRIPT' || target.tagName === 'LINK')) {
                const assetUrl = String(target.src || target.href || '').trim();
                if (assetUrl.includes('/plugins/folderview.plus/')) {
                    persistBrowserError({
                        page: resolveContext(),
                        category: 'missing-asset',
                        phase: state.currentPhase || 'bootstrap',
                        message: 'Required plugin asset failed to load.',
                        sourceUrl: assetUrl,
                        detail: getAssetFileName(assetUrl)
                    });
                    renderPanel({
                        context: resolveContext(),
                        title: `${resolveContext()} bootstrap failed`,
                        message: 'FolderView Plus could not start because a required plugin asset failed to load.',
                        detailLabel: target.tagName === 'LINK' ? 'Missing assets' : 'Missing files',
                        details: [getAssetFileName(assetUrl)],
                        category: 'missing-asset'
                    });
                }
                return;
            }

            const error = event?.error || null;
            if (error && error.fvplusBannerShown === true) {
                return;
            }
            const filename = String(event?.filename || '').trim();
            const message = String(event?.message || error?.message || '').trim();
            const stack = String(error?.stack || '').trim();
            if (!isPluginRelatedError({ filename, message, stack })) {
                return;
            }
            persistBrowserError({
                page: resolveContext(),
                category: 'runtime-failed',
                phase: state.currentPhase || 'runtime',
                message: message || 'Unknown error',
                sourceUrl: filename,
                stack
            });
            reportFatalError(error || message || 'Unknown error', {
                context: resolveContext(),
                sourceUrl: filename,
                phase: state.currentPhase || 'runtime',
                category: 'runtime-failed'
            });
        }, true);

        win.addEventListener('unhandledrejection', (event) => {
            const reason = event?.reason;
            if (reason && reason.fvplusBannerShown === true) {
                return;
            }
            const message = reason instanceof Error
                ? reason.message
                : String(reason?.message || reason || '').trim();
            const stack = String(reason?.stack || '').trim();
            if (!isPluginRelatedError({ message, stack })) {
                return;
            }
            persistBrowserError({
                page: resolveContext(),
                category: 'promise-rejection',
                phase: state.currentPhase || 'runtime',
                message: message || 'Unhandled promise rejection',
                stack
            });
            reportFatalError(reason || message || 'Unhandled promise rejection', {
                context: resolveContext(),
                phase: state.currentPhase || 'runtime',
                category: 'promise-rejection'
            });
        }, true);

        win.addEventListener('securitypolicyviolation', (event) => {
            const blockedUri = trimString(event?.blockedURI || '');
            const sourceFile = trimString(event?.sourceFile || '');
            if (!isPluginRelatedError({ sourceUrl: blockedUri, filename: sourceFile })) {
                return;
            }
            const directive = trimString(event?.effectiveDirective || event?.violatedDirective || 'unknown');
            persistBrowserError({
                page: resolveContext(),
                category: 'csp-violation',
                phase: state.currentPhase || 'bootstrap',
                message: 'Content Security Policy blocked a FolderView Plus resource.',
                sourceUrl: blockedUri || sourceFile,
                detail: directive
            });
            reportFatalError(new Error('Content Security Policy blocked a required FolderView Plus resource.'), {
                context: resolveContext(),
                sourceUrl: blockedUri || sourceFile,
                phase: state.currentPhase || 'bootstrap',
                category: 'csp-violation',
                details: [`Directive: ${directive}`]
            });
        }, true);
    };

    const api = Object.freeze({
        renderPanel,
        clearResolvedIssue,
        reportMissingModules,
        reportFatalError,
        installGlobalHandlers,
        setEnvironment,
        markStep,
        setPhase,
        recordAction,
        setModuleStatus,
        recordModuleEvent,
        recordRequest,
        setPrefsStatus,
        buildSupportReport,
        copyDiagnostics,
        downloadDiagnostics,
        reportDegradedState,
        getBrowserConsoleErrorSnapshot,
        getStartupIncidentSnapshot,
        readPersistedStartupIncident,
        captureIncident,
        classifyError,
        registerRecoveryHandler,
        unregisterRecoveryHandler,
        runRecovery,
        setBootstrapPresentationState,
        constants: Object.freeze({
            incidentSchemaVersion: INCIDENT_SCHEMA_VERSION,
            startupIncidentStorageKey: STARTUP_INCIDENT_STORAGE_KEY
        })
    });

    win.FolderViewPlusFatalBanner = api;
    win.FolderViewPlusFatalBannerModuleLoaded = true;
    installGlobalHandlers();
})(typeof window !== 'undefined' ? window : this);
