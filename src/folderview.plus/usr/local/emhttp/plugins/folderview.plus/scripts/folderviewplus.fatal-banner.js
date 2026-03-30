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
    const DEFAULT_HELP = 'Try a hard refresh. If this persists, reinstall the plugin package to restore missing files.';
    const DIAGNOSTIC_REQUEST_LIMIT = 16;
    const DIAGNOSTIC_STEP_LIMIT = 10;
    const DIAGNOSTIC_ACTION_LIMIT = 10;

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

    const buildSupportReport = (issue = null) => {
        const activeIssue = issue || state.activeIssue || {};
        const environmentLines = [
            `page: ${trimString(state.environment.page || 'Settings') || 'Settings'}`,
            `pluginVersion: ${trimString(state.environment.pluginVersion || 'unknown') || 'unknown'}`,
            `channel: ${trimString(state.environment.channel || 'unknown') || 'unknown'}`,
            `unraidVersion: ${trimString(state.environment.unraidVersion || 'unknown') || 'unknown'}`,
            `url: ${trimString(state.environment.url || 'unknown') || 'unknown'}`,
            `userAgent: ${trimString(state.environment.userAgent || 'unknown') || 'unknown'}`
        ];
        const moduleLines = Object.entries(state.modules)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([name, info]) => `${name}: ${trimString(info?.status || 'unknown')}${trimString(info?.detail) ? ` (${trimString(info.detail)})` : ''}`);
        const requestLines = state.requests.map((entry) => {
            const parts = [
                `${entry.method} ${entry.url}`,
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
                parts.push(`detail=${entry.detail}`);
            }
            if (entry.responseSnippet) {
                parts.push(`response=${entry.responseSnippet}`);
            }
            return parts.join(' | ');
        });
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
        const affectedAreaLines = toDetailList(activeIssue.details);
        return [
            'FolderView Plus Settings Diagnostics',
            `errorCode: ${trimString(activeIssue.code || 'FVPLUS-SET-RUNTIME-001') || 'FVPLUS-SET-RUNTIME-001'}`,
            `phase: ${trimString(activeIssue.phase || state.currentPhase || 'unknown') || 'unknown'}`,
            `severity: ${trimString(activeIssue.severity || 'fatal') || 'fatal'}`,
            `category: ${trimString(activeIssue.category || 'runtime-failed') || 'runtime-failed'}`,
            `occurrences: ${Number(activeIssue.occurrences || 1) || 1}`,
            `firstSeenAt: ${trimString(activeIssue.firstSeenAt || 'unknown') || 'unknown'}`,
            `lastSeenAt: ${trimString(activeIssue.lastSeenAt || 'unknown') || 'unknown'}`,
            `lastStep: ${trimString(state.lastStep || 'unknown') || 'unknown'}`,
            `lastAction: ${trimString(state.lastAction || 'unknown') || 'unknown'}`,
            `summary: ${trimString(activeIssue.message || activeIssue.summary || 'unknown') || 'unknown'}`,
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
            '[requests]',
            ...(requestLines.length > 0 ? requestLines : ['none']),
            '',
            '[prefs]',
            ...prefsLines,
            '',
            '[steps]',
            ...stepLines,
            '',
            '[recent-actions]',
            ...actionLines
        ].join('\n');
    };

    const copyDiagnostics = async () => {
        const text = buildSupportReport();
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
    border: 1px solid rgba(255, 190, 84, 0.48);
    border-radius: 8px;
    background: linear-gradient(180deg, rgba(58, 40, 12, 0.92), rgba(35, 23, 7, 0.96));
    color: #f7e6c5;
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.22);
}
#${PANEL_ID}.is-degraded {
    border-color: rgba(111, 197, 255, 0.46);
    background: linear-gradient(180deg, rgba(18, 44, 66, 0.92), rgba(10, 26, 41, 0.96));
    color: #dbefff;
}
#${PANEL_ID} .fvplus-fatal-title {
    font-size: 1.03rem;
    font-weight: 700;
    color: #ffd484;
}
#${PANEL_ID}.is-degraded .fvplus-fatal-title {
    color: #9fd7ff;
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
    color: #f0d7aa;
    font-size: 0.98rem;
}
#${PANEL_ID} .fvplus-fatal-list-title {
    font-weight: 600;
    color: #ffe2a8;
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
#${PANEL_ID} details.fvplus-fatal-details {
    border-top: 1px solid rgba(255, 224, 156, 0.22);
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
    background: rgba(0, 0, 0, 0.24);
    color: #f9e6bf;
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 0.95rem;
    line-height: 1.35;
}
        `.trim();
        (doc.head || doc.documentElement || doc.body).appendChild(style);
    };

    const getPanel = () => doc.getElementById(PANEL_ID);

    const clearResolvedIssue = () => {
        state.activeIssue = null;
        const panel = getPanel();
        if (panel && panel.parentNode) {
            panel.parentNode.removeChild(panel);
        }
    };

    const renderPanel = (options = {}) => {
        const context = resolveContext(options.context);
        const title = String(options.title || `${context} bootstrap failed`).trim();
        const message = String(options.message || 'FolderView Plus hit a fatal error and could not continue.').trim();
        const help = String(options.help || DEFAULT_HELP).trim();
        const detailLabel = String(options.detailLabel || 'Details').trim();
        const details = toDetailList(options.details);
        const errorCode = trimString(options.code || 'FVPLUS-SET-RUNTIME-001') || 'FVPLUS-SET-RUNTIME-001';
        const phase = trimString(options.phase || state.currentPhase || 'unknown') || 'unknown';
        const severity = trimString(options.severity || 'fatal') || 'fatal';
        const category = trimString(options.category || 'runtime-failed') || 'runtime-failed';
        state.environment.timestamp = new Date().toISOString();
        const occurrence = registerIssueOccurrence({
            title,
            message,
            details,
            code: errorCode,
            phase,
            severity,
            category
        });
        state.activeIssue = {
            title,
            message,
            detailLabel,
            details,
            code: errorCode,
            phase,
            severity,
            category,
            occurrences: occurrence.count,
            firstSeenAt: occurrence.firstSeenAt,
            lastSeenAt: occurrence.lastSeenAt
        };
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

        const listHtml = details.length > 0
            ? `
<div class="fvplus-fatal-list-title">${escapeHtml(detailLabel)}</div>
<ul class="fvplus-fatal-list">${details.map((entry) => `<li>${escapeHtml(entry)}</li>`).join('')}</ul>
            `.trim()
            : '';
        const facts = [
            `Error code: ${errorCode}`,
            `Severity: ${severity}`,
            `Category: ${category}`,
            `Phase: ${phase}`,
            state.lastStep ? `Last successful step: ${state.lastStep}` : '',
            state.lastAction ? `Last action: ${state.lastAction}` : '',
            occurrence.count > 1 ? `Occurrences: ${occurrence.count}` : ''
        ].filter((entry) => entry);
        const detailsReport = buildSupportReport(state.activeIssue);
        panel.className = `fvplus-fatal-banner${severity === 'degraded' ? ' is-degraded' : ''}`;
        panel.innerHTML = `
<div class="fvplus-fatal-title"><i class="fa fa-exclamation-triangle" aria-hidden="true"></i>${escapeHtml(title)}</div>
<div class="fvplus-fatal-text">${escapeHtml(message)}</div>
<div class="fvplus-fatal-facts">${facts.map((entry) => `<div class="fvplus-fatal-fact">${escapeHtml(entry)}</div>`).join('')}</div>
${listHtml}
<div class="fvplus-fatal-actions">
    <button type="button" id="${COPY_BUTTON_ID}"><i class="fa fa-copy" aria-hidden="true"></i> Copy diagnostics</button>
</div>
<details class="fvplus-fatal-details">
    <summary>Show technical details</summary>
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
                copyButton.textContent = copied ? 'Copied diagnostics' : 'Copy failed';
                win.setTimeout(() => {
                    copyButton.innerHTML = '<i class="fa fa-copy" aria-hidden="true"></i> Copy diagnostics';
                }, 1600);
            }, { once: true });
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
            title: String(options.title || `${context} bootstrap failed`).trim(),
            message: String(options.message || `FolderView Plus could not start because required ${context.toLowerCase()} modules failed to load.`).trim(),
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
        const details = [];
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
            category: options.category || 'runtime-failed',
            severity: options.severity || 'fatal',
            title: String(options.title || `${context} runtime failed`).trim(),
            message: String(options.message || `FolderView Plus hit a fatal error and could not continue on the ${context.toLowerCase()} page.`).trim(),
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
            reportFatalError(reason || message || 'Unhandled promise rejection', {
                context: resolveContext(),
                phase: state.currentPhase || 'runtime',
                category: 'promise-rejection'
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
        recordRequest,
        setPrefsStatus,
        buildSupportReport,
        copyDiagnostics,
        reportDegradedState
    });

    win.FolderViewPlusFatalBanner = api;
    win.FolderViewPlusFatalBannerModuleLoaded = true;
    installGlobalHandlers();
})(typeof window !== 'undefined' ? window : this);
