(function folderViewPlusActivityDiagnosticsModule(window, document) {
if (window.FolderViewPlusDiagnosticsModuleLoaded === true) {
    return;
}
const diagnosticsThemeResolver = window.FolderViewPlusThemeResolver || null;
const diagnosticsUtils = window.FolderViewPlusUtils || null;
const diagnosticsPrefsStoreModule = window.FolderViewPlusPrefsStore || null;
const diagnosticsPrefsCoordinator = diagnosticsPrefsStoreModule && typeof diagnosticsPrefsStoreModule.getDefaultCoordinator === 'function'
    ? diagnosticsPrefsStoreModule.getDefaultCoordinator({
        normalizePrefs: diagnosticsUtils?.normalizePrefs,
        request: window.FolderViewPlusRequest
    })
    : null;
const supportBundlePreviewModule = window.FolderViewPlusSupportBundlePreview || null;
const supportBundleTelemetryModule = window.FolderViewPlusSupportBundleTelemetry || null;
const diagnosticsViewModelModule = window.FolderViewPlusDiagnosticsViewModel || null;
const diagnosticsViewModule = window.FolderViewPlusDiagnosticsView || null;
const diagnosticsT = (key, fallback = '', ...params) => (
    window.FolderViewPlusI18n?.t?.(key, fallback, ...params) || String(fallback || key).replace(/\$(\d+)/g, (token, n) => String(params[Number(n) - 1] ?? token))
);
const diagnosticsSwal = typeof window.swal === 'function'
    ? window.swal.bind(window)
    : ((options) => {
        const title = String(options?.title || 'FolderView Plus').trim();
        const text = String(options?.text || '').trim();
        if (typeof window.alert === 'function') {
        window.alert(window.FolderViewPlusI18n?.message?.(text ? `${title}\n\n${text}` : title) || (text ? `${title}\n\n${text}` : title));
        }
    });
const diagnosticsShowToastMessage = (options = {}) => {
    if (typeof window.showToastMessage === 'function') {
        window.showToastMessage(options);
        return;
    }
    const title = String(options?.title || '').trim();
    const message = String(options?.message || '').trim();
    if (message && window.console && typeof window.console.info === 'function') {
        window.console.info(`[FolderView Plus] ${title ? `${title}: ` : ''}${message}`);
    }
};
const diagnosticsShowError = (title, error) => {
    if (typeof window.showError === 'function') {
        window.showError(title, error);
        return;
    }
    const message = String(error?.message || error || 'Unknown error');
    if (window.console && typeof window.console.error === 'function') {
        window.console.error(`[FolderView Plus] ${title}: ${message}`, error);
    }
};
const diagnosticsEscapeHtml = (value) => {
    if (diagnosticsUtils && typeof diagnosticsUtils.escapeHtml === 'function') {
        return diagnosticsUtils.escapeHtml(value);
    }
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};
const diagnosticsToPrettyJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
const diagnosticsDownloadFile = (name, content) => {
    if (typeof window.downloadFile === 'function') {
        window.downloadFile(name, content);
        return;
    }
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
const normalizeDiagnosticsThemeMode = (value) => {
    if (diagnosticsThemeResolver && typeof diagnosticsThemeResolver.normalizeThemeCompatibilityMode === 'function') {
        return diagnosticsThemeResolver.normalizeThemeCompatibilityMode(value);
    }
    if (diagnosticsUtils && typeof diagnosticsUtils.normalizeThemeCompatibilityMode === 'function') {
        return diagnosticsUtils.normalizeThemeCompatibilityMode(value);
    }
    const normalized = String(value || '').trim().toLowerCase();
    return ['auto', 'host', 'safe', 'highcontrast'].includes(normalized) ? normalized : 'auto';
};
const buildDiagnosticsThemeSnapshot = (modeInput = null, options = {}) => (
    diagnosticsThemeResolver && typeof diagnosticsThemeResolver.buildResolvedThemeSnapshot === 'function'
        ? diagnosticsThemeResolver.buildResolvedThemeSnapshot(modeInput, options)
        : { requestedMode: 'auto', appliedMode: 'auto', classification: 'mixed', autoHealed: false, contrastChecks: [], statusChecks: {}, tokens: {}, adjustments: [], warnings: [] }
);
const applyDiagnosticsThemeTokens = (reason = 'runtime', options = {}) => (
    diagnosticsThemeResolver && typeof diagnosticsThemeResolver.applyResolvedThemeTokens === 'function'
        ? diagnosticsThemeResolver.applyResolvedThemeTokens(reason, options)
        : buildDiagnosticsThemeSnapshot(options.modeInput ?? null, options)
);
let lastDiagnostics = null;
let lastThemeDiagnostics = null;
let supportBundlePreviewApi = null;
let supportBundleTelemetryApi = null;
let diagnosticsViewApi = null;
let diagnosticsRunState = Object.freeze({ running: false, errorMessage: '' });
const ACTIVITY_FEED_MAX_ENTRIES = 100;
const ACTIVITY_FEED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const ACTIVITY_FEED_STORAGE_KEY = 'fv.settings.logs.v1';
const ACTIVITY_FEED_MAX_MESSAGE_LENGTH = 4096;
let activityFeedRestored = false;
let activityFeedClearedAt = 0;
let activityFeedClearedServerKeys = [];
const LOGGED_DIAGNOSTIC_EVENTS = new Set([
    'import', 'delete_folder', 'clear_folders', 'runtime_bulk_action', 'bulk_assign',
    'diagnostics_export', 'support_bundle_export'
]);
const PERF_DIAGNOSTICS_SAMPLE_LIMIT = 30;
const PERF_DIAGNOSTICS_SAMPLE_TTL_MS = 24 * 60 * 60 * 1000;
const PERF_DIAGNOSTICS_EVALUATION_WINDOW_MS = 30 * 60 * 1000;
const PERF_DIAGNOSTICS_STORAGE_KEY = 'fv.performance.diagnostics.history.v1';
const PERF_DIAGNOSTICS_RECENT_WINDOW = 3;
const PERF_DIAGNOSTICS_REPEAT_THRESHOLD = 2;
const PERF_DIAGNOSTICS_EXTREME_MULTIPLIER = 3;
const PERF_DIAGNOSTICS_BUDGET_MS = Object.freeze({
    refresh: Object.freeze({ docker: 1500, vm: 1500 }),
    runtimehydration: Object.freeze({ docker: 2500, vm: 2500 }),
    import: Object.freeze({ docker: 5000, vm: 5000 }),
    wizard: Object.freeze({ apply: 8000 }),
    settings: Object.freeze({ bootstrap: 2500, configbootstrap: 1500, manualrefresh: 5000, diagnostics: 3000 })
});
const REQUEST_ERROR_DIAGNOSTICS_LIMIT = 40;
const performanceDiagnosticsState = {
    refresh: { docker: [], vm: [] },
    runtimeHydration: { docker: [], vm: [] },
    import: { docker: [], vm: [] },
    wizard: { apply: [] },
    settings: { bootstrap: [], configbootstrap: [], manualrefresh: [], diagnostics: [] },
    updatedAt: 0
};
let performanceDiagnosticsPersistTimer = null;
const requestErrorDiagnostics = [];
const EDITOR_DEBUG_LAUNCH_STORAGE_KEY = 'fv.folder.editor.debug.launch.v1';
const EDITOR_DEBUG_BOOTSTRAP_STORAGE_KEY = 'fv.folder.editor.debug.bootstrap.v1';
const EDITOR_DEBUG_SURFACE_STORAGE_KEY = 'fv.folder.editor.debug.surface.v1';
const readClientDiagnosticsStorageRecord = (storageKey) => {
    try {
        if (typeof localStorage === 'undefined') {
            return null;
        }
        const raw = String(localStorage.getItem(storageKey) || '').trim();
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_error) {
        return null;
    }
};
const surfaceT = (key, fallback, ...params) => globalThis.FolderViewPlusI18n?.t?.(key, fallback, ...params) || fallback.replace(/\$(\d+)/g, (token, n) => String(params[Number(n) - 1] ?? token));
const getPerformanceDiagnosticsSeries = () => ([
    performanceDiagnosticsState.refresh.docker,
    performanceDiagnosticsState.refresh.vm,
    performanceDiagnosticsState.runtimeHydration.docker,
    performanceDiagnosticsState.runtimeHydration.vm,
    performanceDiagnosticsState.import.docker,
    performanceDiagnosticsState.import.vm,
    performanceDiagnosticsState.wizard.apply,
    performanceDiagnosticsState.settings.bootstrap,
    performanceDiagnosticsState.settings.configbootstrap,
    performanceDiagnosticsState.settings.manualrefresh,
    performanceDiagnosticsState.settings.diagnostics
]);

const sanitizePerformanceDiagnosticsDetails = (details) => Object.fromEntries(
    Object.entries(details && typeof details === 'object' && !Array.isArray(details) ? details : {})
        .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
        .slice(0, 16)
        .map(([key, value]) => [String(key).slice(0, 64), typeof value === 'string' ? value.slice(0, 160) : value])
);

const sanitizePersistedPerformanceSample = (sample, now = Date.now()) => {
    const at = Number(sample?.at);
    const durationMs = Number(sample?.durationMs);
    if (!Number.isFinite(at) || at <= 0 || at < now - PERF_DIAGNOSTICS_SAMPLE_TTL_MS || !Number.isFinite(durationMs) || durationMs < 0) {
        return null;
    }
    return {
        at,
        durationMs: Number(durationMs.toFixed(2)),
        details: sanitizePerformanceDiagnosticsDetails(sample?.details)
    };
};

const restorePerformanceDiagnosticsHistory = () => {
    const stored = readClientDiagnosticsStorageRecord(PERF_DIAGNOSTICS_STORAGE_KEY);
    if (Number(stored?.schemaVersion || 0) !== 1 || !stored.state || typeof stored.state !== 'object') {
        return;
    }
    const now = Date.now();
    const copySeries = (target, source, classificationVersion = 0) => {
        const restored = (Array.isArray(source) ? source : [])
            .map((sample) => sanitizePersistedPerformanceSample(sample, now))
            .filter(Boolean)
            .filter((sample) => !classificationVersion || sample.details.classificationVersion === classificationVersion)
            .slice(-PERF_DIAGNOSTICS_SAMPLE_LIMIT);
        target.splice(0, target.length, ...restored);
    };
    copySeries(performanceDiagnosticsState.refresh.docker, stored.state.refresh?.docker);
    copySeries(performanceDiagnosticsState.refresh.vm, stored.state.refresh?.vm);
    copySeries(performanceDiagnosticsState.runtimeHydration.docker, stored.state.runtimeHydration?.docker, 2);
    copySeries(performanceDiagnosticsState.runtimeHydration.vm, stored.state.runtimeHydration?.vm, 2);
    copySeries(performanceDiagnosticsState.import.docker, stored.state.import?.docker);
    copySeries(performanceDiagnosticsState.import.vm, stored.state.import?.vm);
    copySeries(performanceDiagnosticsState.wizard.apply, stored.state.wizard?.apply);
    copySeries(performanceDiagnosticsState.settings.bootstrap, stored.state.settings?.bootstrap);
    copySeries(performanceDiagnosticsState.settings.configbootstrap, stored.state.settings?.configbootstrap);
    copySeries(performanceDiagnosticsState.settings.manualrefresh, stored.state.settings?.manualrefresh);
    copySeries(performanceDiagnosticsState.settings.diagnostics, stored.state.settings?.diagnostics);
    const latestSampleAt = getPerformanceDiagnosticsSeries()
        .flat()
        .reduce((latest, sample) => Math.max(latest, Number(sample?.at) || 0), 0);
    performanceDiagnosticsState.updatedAt = latestSampleAt;
};

const persistPerformanceDiagnosticsHistory = () => {
    performanceDiagnosticsPersistTimer = null;
    try {
        localStorage.setItem(PERF_DIAGNOSTICS_STORAGE_KEY, JSON.stringify({
            schemaVersion: 1,
            savedAt: new Date().toISOString(),
            state: performanceDiagnosticsState
        }));
    } catch (_error) {
        // Browser performance history is optional and must never block Settings.
    }
};

const schedulePerformanceDiagnosticsHistoryPersist = () => {
    if (performanceDiagnosticsPersistTimer !== null) {
        clearTimeout(performanceDiagnosticsPersistTimer);
    }
    performanceDiagnosticsPersistTimer = setTimeout(persistPerformanceDiagnosticsHistory, 120);
};

restorePerformanceDiagnosticsHistory();
window.addEventListener?.('pagehide', persistPerformanceDiagnosticsHistory);

const collectFolderEditorDebugDiagnostics = () => {
    const launch = readClientDiagnosticsStorageRecord(EDITOR_DEBUG_LAUNCH_STORAGE_KEY);
    const bootstrap = readClientDiagnosticsStorageRecord(EDITOR_DEBUG_BOOTSTRAP_STORAGE_KEY);
    const surface = readClientDiagnosticsStorageRecord(EDITOR_DEBUG_SURFACE_STORAGE_KEY);
    const launchId = String(launch?.id || '').trim();
    const launchType = String(launch?.type || '').trim();
    const bootstrapRouteId = String(bootstrap?.routeFolderId || '').trim();
    const bootstrapEffectiveId = String(bootstrap?.effectiveFolderId || '').trim();
    const bootstrapType = String(bootstrap?.routeType || bootstrap?.pageType || '').trim();
    const surfaceSummary = String(surface?.summary || '').trim();
    const surfaceTone = String(surface?.tone || '').trim();
    const launchMatchedBootstrap = Boolean(
        launchId
        && bootstrapEffectiveId
        && launchId === bootstrapEffectiveId
        && (!launchType || !bootstrapType || launchType === bootstrapType)
    );
    return {
        checkedAt: new Date().toISOString(),
        currentPage: String(location?.href || ''),
        launch,
        bootstrap,
        surface,
        comparison: {
            launchId,
            launchType,
            bootstrapRouteId,
            bootstrapEffectiveId,
            bootstrapType,
            bootstrapResult: String(bootstrap?.result || '').trim(),
            surfaceSummary,
            surfaceTone,
            launchMatchedBootstrap,
            routeTargetRecovered: bootstrap?.routeTargetRecovered === true,
            routeTargetMismatch: bootstrap?.routeTargetMismatch === true,
            summary: !launch && !bootstrap
                ? 'No folder editor debug records have been captured in this browser yet.'
                : (launchMatchedBootstrap
                    ? 'Last folder editor launch and bootstrap targets match.'
                    : 'Last folder editor launch and bootstrap targets do not fully match.')
        }
    };
};

const renderFolderEditorDebugDiagnostics = () => {
    const host = $('#folder-editor-diagnostics-output');
    const snapshot = collectFolderEditorDebugDiagnostics();
    if (!host.length) {
        return snapshot;
    }
    host.text(diagnosticsToPrettyJson(snapshot));
    return snapshot;
};

const copyFolderEditorDebugDiagnostics = async () => {
    try {
        const snapshot = renderFolderEditorDebugDiagnostics();
        const text = diagnosticsToPrettyJson(snapshot);
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
        diagnosticsSwal({
            title: 'Copied',
            text: 'Folder editor diagnostics copied to clipboard.',
            type: 'success'
        });
    } catch (error) {
        diagnosticsShowError('Copy folder editor diagnostics failed', error);
    }
};

const perfNowMs = () => ((window.performance && typeof window.performance.now === 'function')
    ? window.performance.now()
    : Date.now());

const recordRequestErrorTelemetry = (method, url, error, extra = {}) => {
    const statusMatch = String(error?.message || '').match(/\bHTTP\s+(\d{3})\b/i);
    const statusCode = statusMatch ? Number(statusMatch[1]) : 0;
    requestErrorDiagnostics.push({
        at: new Date().toISOString(),
        method: String(method || '').toUpperCase() || 'GET',
        url: String(url || ''),
        status: Number.isFinite(statusCode) ? Number(statusCode) : 0,
        message: String(error?.message || error || 'Unknown request error'),
        source: String(extra.source || ''),
        retries: Number.isFinite(Number(extra.retries)) ? Number(extra.retries) : null,
        timeoutMs: Number.isFinite(Number(extra.timeoutMs)) ? Number(extra.timeoutMs) : null
    });
    while (requestErrorDiagnostics.length > REQUEST_ERROR_DIAGNOSTICS_LIMIT) {
        requestErrorDiagnostics.shift();
    }
};

const getRequestErrorDiagnosticsSnapshot = () => ({
    count: requestErrorDiagnostics.length,
    last: requestErrorDiagnostics.length > 0 ? requestErrorDiagnostics[requestErrorDiagnostics.length - 1] : null,
    samples: requestErrorDiagnostics.slice(-REQUEST_ERROR_DIAGNOSTICS_LIMIT)
});

const resolvePerformanceDiagnosticsSamples = (bucket, type = 'global') => {
    if (!performanceDiagnosticsState[bucket] || typeof performanceDiagnosticsState[bucket] !== 'object') {
        return null;
    }
    if (bucket === 'refresh' || bucket === 'runtimeHydration' || bucket === 'import') {
        const resolvedType = String(type || '').trim() === 'vm' ? 'vm' : 'docker';
        return Array.isArray(performanceDiagnosticsState[bucket][resolvedType])
            ? performanceDiagnosticsState[bucket][resolvedType]
            : null;
    }
    const resolvedSeries = String(type || 'global').trim().toLowerCase() || 'global';
    return Array.isArray(performanceDiagnosticsState[bucket][resolvedSeries])
        ? performanceDiagnosticsState[bucket][resolvedSeries]
        : null;
};

const recordPerformanceDiagnosticsSample = (bucket, type, durationMs, details = {}) => {
    const target = resolvePerformanceDiagnosticsSamples(bucket, type);
    if (!target) {
        return;
    }
    const duration = Number(durationMs);
    if (!Number.isFinite(duration) || duration < 0) {
        return;
    }
    const capturedAt = Date.now();
    target.push({
        at: capturedAt,
        durationMs: Number(duration.toFixed(2)),
        details: sanitizePerformanceDiagnosticsDetails(details)
    });
    const retentionCutoff = capturedAt - PERF_DIAGNOSTICS_SAMPLE_TTL_MS;
    for (let index = target.length - 1; index >= 0; index -= 1) {
        const sampleAt = Number(target[index]?.at);
        if (Number.isFinite(sampleAt) && sampleAt > 0 && sampleAt < retentionCutoff) {
            target.splice(index, 1);
        }
    }
    if (target.length > PERF_DIAGNOSTICS_SAMPLE_LIMIT) {
        target.splice(0, target.length - PERF_DIAGNOSTICS_SAMPLE_LIMIT);
    }
    performanceDiagnosticsState.updatedAt = capturedAt;
    schedulePerformanceDiagnosticsHistoryPersist();
    renderPerformanceDiagnostics();
};

const resolvePerformanceDiagnosticsBudgetMs = (bucket, type = 'global') => {
    const bucketKey = String(bucket || '').trim().toLowerCase();
    const typeKey = String(type || 'global').trim().toLowerCase() || 'global';
    const budget = PERF_DIAGNOSTICS_BUDGET_MS[bucketKey]?.[typeKey];
    const numericBudget = Number(budget);
    return Number.isFinite(numericBudget) && numericBudget > 0 ? numericBudget : null;
};

const summarizePerformanceDiagnosticsSamples = (samples, budgetMs = null) => {
    const now = Date.now();
    const retentionCutoff = now - PERF_DIAGNOSTICS_EVALUATION_WINDOW_MS;
    const list = (Array.isArray(samples) ? samples : []).filter((row) => {
        const sampleAt = Number(row?.at);
        return !Number.isFinite(sampleAt) || sampleAt <= 0 || sampleAt >= retentionCutoff;
    });
    if (!list.length) {
        return null;
    }
    const normalizedSamples = list
        .map((row) => ({
            durationMs: Number(row?.durationMs),
            coldLoad: row?.details?.coldLoad === true
        }))
        .filter((row) => Number.isFinite(row.durationMs) && row.durationMs >= 0);
    const durations = normalizedSamples.map((row) => row.durationMs);
    if (!durations.length) {
        return null;
    }
    const total = durations.reduce((sum, value) => sum + value, 0);
    const resolvedBudgetMs = Number(budgetMs);
    const hasBudget = Number.isFinite(resolvedBudgetMs) && resolvedBudgetMs > 0;
    const maxMs = Number(Math.max(...durations).toFixed(2));
    const sortedDurations = [...durations].sort((left, right) => left - right);
    const medianIndex = Math.floor(sortedDurations.length / 2);
    const medianMs = sortedDurations.length % 2 === 0
        ? (sortedDurations[medianIndex - 1] + sortedDurations[medianIndex]) / 2
        : sortedDurations[medianIndex];
    const p95Index = Math.max(0, Math.ceil(sortedDurations.length * 0.95) - 1);
    const warmSamples = normalizedSamples.filter((row) => row.coldLoad !== true);
    const recentWarmSamples = warmSamples.slice(-PERF_DIAGNOSTICS_RECENT_WINDOW);
    const recentWarmDurations = recentWarmSamples.map((row) => row.durationMs);
    const recentAverageMs = recentWarmDurations.length > 0
        ? recentWarmDurations.reduce((sum, value) => sum + value, 0) / recentWarmDurations.length
        : null;
    const recentOverBudgetCount = hasBudget
        ? recentWarmDurations.filter((value) => value > resolvedBudgetMs).length
        : 0;
    const repeatedOverBudget = hasBudget
        && recentWarmDurations.length >= PERF_DIAGNOSTICS_REPEAT_THRESHOLD
        && recentOverBudgetCount >= PERF_DIAGNOSTICS_REPEAT_THRESHOLD;
    const extremeOverBudget = hasBudget
        && recentWarmDurations.some((value) => value >= resolvedBudgetMs * PERF_DIAGNOSTICS_EXTREME_MULTIPLIER);
    const latestWarmDuration = recentWarmDurations.length > 0
        ? recentWarmDurations[recentWarmDurations.length - 1]
        : null;
    const coldLoadCount = normalizedSamples.filter((row) => row.coldLoad === true).length;
    const isolatedOverBudget = hasBudget && (
        normalizedSamples.some((row) => row.durationMs > resolvedBudgetMs)
        || recentOverBudgetCount > 0
    );
    return {
        count: durations.length,
        lastMs: Number(durations[durations.length - 1].toFixed(2)),
        avgMs: Number((total / durations.length).toFixed(2)),
        maxMs,
        medianMs: Number(medianMs.toFixed(2)),
        p95Ms: Number(sortedDurations[p95Index].toFixed(2)),
        recentAverageMs: Number.isFinite(recentAverageMs) ? Number(recentAverageMs.toFixed(2)) : null,
        recentSampleCount: recentWarmDurations.length,
        recentOverBudgetCount,
        coldLoadCount,
        warmSampleCount: warmSamples.length,
        budgetMs: hasBudget ? Number(resolvedBudgetMs.toFixed(2)) : null,
        latestOverBudget: hasBudget && Number.isFinite(latestWarmDuration) ? latestWarmDuration > resolvedBudgetMs : false,
        repeatedOverBudget,
        extremeOverBudget,
        isolatedOverBudget,
        overBudget: repeatedOverBudget || extremeOverBudget,
        evaluation: repeatedOverBudget || extremeOverBudget
            ? 'follow-up'
            : (isolatedOverBudget ? 'observed' : 'within-budget')
    };
};

const getRuntimePerfTelemetrySnapshot = () => ({
    docker: typeof window.getDockerRuntimePerfTelemetrySnapshot === 'function'
        ? window.getDockerRuntimePerfTelemetrySnapshot()
        : {},
    vm: typeof window.getVmRuntimePerfTelemetrySnapshot === 'function'
        ? window.getVmRuntimePerfTelemetrySnapshot()
        : {}
});

const getStandardRequestDiagnosticsSnapshot = () => {
    const entries = typeof window.FolderViewPlusRequest?.diagnostics === 'function'
        ? window.FolderViewPlusRequest.diagnostics()
        : [];
    const safeEntries = Array.isArray(entries) ? entries.slice(-100) : [];
    return {
        count: safeEntries.length,
        failures: safeEntries.filter((entry) => ['error', 'rejected', 'unavailable'].includes(String(entry?.outcome || ''))).length,
        retries: safeEntries.reduce((total, entry) => total + Math.max(0, (Number(entry?.attempts) || 1) - 1), 0),
        entries: safeEntries
    };
};

const collectClientPerformanceTelemetry = () => ({
    updatedAt: performanceDiagnosticsState.updatedAt > 0
        ? new Date(performanceDiagnosticsState.updatedAt).toISOString()
        : '',
    settings: {
        refresh: {
            docker: summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.refresh.docker, resolvePerformanceDiagnosticsBudgetMs('refresh', 'docker')),
            vm: summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.refresh.vm, resolvePerformanceDiagnosticsBudgetMs('refresh', 'vm'))
        },
        runtimeHydration: {
            docker: summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.runtimeHydration.docker, resolvePerformanceDiagnosticsBudgetMs('runtimeHydration', 'docker')),
            vm: summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.runtimeHydration.vm, resolvePerformanceDiagnosticsBudgetMs('runtimeHydration', 'vm'))
        },
        import: {
            docker: summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.import.docker, resolvePerformanceDiagnosticsBudgetMs('import', 'docker')),
            vm: summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.import.vm, resolvePerformanceDiagnosticsBudgetMs('import', 'vm'))
        },
        wizardApply: summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.wizard.apply, resolvePerformanceDiagnosticsBudgetMs('wizard', 'apply')),
        configBootstrap: summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.settings.configbootstrap, resolvePerformanceDiagnosticsBudgetMs('settings', 'configBootstrap')),
        settingsBootstrap: summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.settings.bootstrap, resolvePerformanceDiagnosticsBudgetMs('settings', 'bootstrap')),
        manualRefresh: summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.settings.manualrefresh, resolvePerformanceDiagnosticsBudgetMs('settings', 'manualRefresh')),
        diagnosticsRefresh: summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.settings.diagnostics, resolvePerformanceDiagnosticsBudgetMs('settings', 'diagnostics'))
    },
    history: {
        persisted: true,
        retentionHours: Math.round(PERF_DIAGNOSTICS_SAMPLE_TTL_MS / 3600000),
        evaluationWindowMinutes: Math.round(PERF_DIAGNOSTICS_EVALUATION_WINDOW_MS / 60000),
        storedSampleCount: getPerformanceDiagnosticsSeries().reduce((total, series) => total + series.length, 0)
    },
    runtime: getRuntimePerfTelemetrySnapshot(),
    requestErrors: getRequestErrorDiagnosticsSnapshot()
});

const renderPerformanceDiagnostics = () => {
    const host = $('#performance-diagnostics-output');
    if (!host.length) {
        return;
    }
    const renderRow = (label, summary, budgetMs = null) => {
        if (!summary) {
            return `<tr><th>${diagnosticsEscapeHtml(label)}</th><td colspan="5">${diagnosticsEscapeHtml(diagnosticsT('diagnostics.performance.no-samples', 'No samples yet'))}</td></tr>`;
        }
        const resolvedBudgetMs = Number(summary.budgetMs || budgetMs);
        const budgetLabel = Number.isFinite(resolvedBudgetMs) && resolvedBudgetMs > 0 ? `${resolvedBudgetMs}ms` : '-';
        const statusLabel = summary.overBudget
            ? `Follow up · ${summary.recentOverBudgetCount}/${summary.recentSampleCount} recent`
            : (summary.isolatedOverBudget
                ? `${summary.coldLoadCount > 0 && summary.warmSampleCount <= 0 ? 'Cold load' : 'Observed'} · needs repetition`
                : 'Within budget');
        return `<tr><th>${diagnosticsEscapeHtml(label)}</th><td>${summary.count}</td><td>${summary.lastMs}ms</td><td>${summary.avgMs}ms</td><td>${summary.maxMs}ms</td><td>${diagnosticsEscapeHtml(`${statusLabel} (${budgetLabel})`)}</td></tr>`;
    };
    const rows = [
        renderRow('Configuration first paint', summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.settings.configbootstrap, resolvePerformanceDiagnosticsBudgetMs('settings', 'configBootstrap'))),
        renderRow('Docker runtime hydration', summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.runtimeHydration.docker, resolvePerformanceDiagnosticsBudgetMs('runtimeHydration', 'docker'))),
        renderRow('VM runtime hydration', summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.runtimeHydration.vm, resolvePerformanceDiagnosticsBudgetMs('runtimeHydration', 'vm'))),
        renderRow('Full Settings refresh', summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.settings.manualrefresh, resolvePerformanceDiagnosticsBudgetMs('settings', 'manualRefresh'))),
        renderRow('Docker import', summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.import.docker, resolvePerformanceDiagnosticsBudgetMs('import', 'docker'))),
        renderRow('VM import', summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.import.vm, resolvePerformanceDiagnosticsBudgetMs('import', 'vm'))),
        renderRow('Wizard apply', summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.wizard.apply, resolvePerformanceDiagnosticsBudgetMs('wizard', 'apply'))),
        renderRow('Diagnostics refresh', summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.settings.diagnostics, resolvePerformanceDiagnosticsBudgetMs('settings', 'diagnostics')))
    ].join('');
    const runtimeSnapshot = getRuntimePerfTelemetrySnapshot();
    const updatedAt = performanceDiagnosticsState.updatedAt > 0
        ? (globalThis.FolderViewPlusI18n?.formatDate?.(performanceDiagnosticsState.updatedAt, { dateStyle: 'short', timeStyle: 'medium' }) || new Date(performanceDiagnosticsState.updatedAt).toLocaleString('en'))
        : 'Not yet sampled';
    host.html(`
        <div class="fv-perf-summary-note">${diagnosticsEscapeHtml(diagnosticsT('diagnostics.performance.note', 'Rolling UI timings are retained for 24 hours across refreshes; health evaluation uses the most recent 30 minutes. Cold loads are observed but do not trigger a warning by themselves.'))}</div>
        <table class="fv-perf-table">
            <thead>
                <tr><th>${diagnosticsEscapeHtml(diagnosticsT('diagnostics.performance.operation', 'Operation'))}</th><th>${diagnosticsEscapeHtml(diagnosticsT('diagnostics.performance.samples', 'Samples'))}</th><th>${diagnosticsEscapeHtml(diagnosticsT('diagnostics.performance.last', 'Last'))}</th><th>${diagnosticsEscapeHtml(diagnosticsT('diagnostics.performance.average', 'Avg'))}</th><th>${diagnosticsEscapeHtml(diagnosticsT('diagnostics.performance.maximum', 'Max'))}</th><th>${diagnosticsEscapeHtml(diagnosticsT('diagnostics.performance.budget', 'Budget'))}</th></tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
        <div class="fv-perf-summary-note">Runtime telemetry: Docker actions ${diagnosticsEscapeHtml(String(Object.keys(runtimeSnapshot.docker || {}).length))}, VM actions ${diagnosticsEscapeHtml(String(Object.keys(runtimeSnapshot.vm || {}).length))}</div>
        <div class="fv-perf-summary-note">Updated: ${diagnosticsEscapeHtml(updatedAt)}</div>
    `);
};

const getDiagnostics = async (privacy = 'sanitized') => {
    const response = await apiGetJson(`/plugins/folderview.plus/server/diagnostics.php?action=report&privacy=${encodeURIComponent(privacy || 'sanitized')}`);
    if (!response.ok) {
        throw new Error(response.error || 'Diagnostics failed.');
    }
    return response.diagnostics || {};
};

const getSupportBundle = async (privacy = 'sanitized') => {
    const response = await apiGetJson(`/plugins/folderview.plus/server/diagnostics.php?action=support_bundle&privacy=${encodeURIComponent(privacy || 'sanitized')}`);
    if (!response.ok) {
        throw new Error(response.error || 'Support bundle failed.');
    }
    return normalizeSupportBundleV2Payload(response.bundle || {}, privacy);
};

const getSupportBundlePreview = async (privacy = 'sanitized') => {
    const response = await apiGetJson(`/plugins/folderview.plus/server/diagnostics.php?action=support_bundle_preview&privacy=${encodeURIComponent(privacy || 'sanitized')}`);
    if (!response.ok) {
        throw new Error(response.error || 'Support bundle preview failed.');
    }
    return normalizeSupportBundleV2Payload(response.bundle || {}, privacy);
};

const normalizeSupportBundleV2Payload = (bundle, privacy = 'sanitized') => {
    const payload = (bundle && typeof bundle === 'object' && !Array.isArray(bundle)) ? { ...bundle } : {};
    const mode = privacy === 'full' ? 'full' : 'sanitized';
    payload.bundleMeta = (
        payload.bundleMeta && typeof payload.bundleMeta === 'object' && !Array.isArray(payload.bundleMeta)
    ) ? { ...payload.bundleMeta } : {};
    payload.system = (
        payload.system && typeof payload.system === 'object' && !Array.isArray(payload.system)
    ) ? { ...payload.system } : {};
    payload.pluginState = (
        payload.pluginState && typeof payload.pluginState === 'object' && !Array.isArray(payload.pluginState)
    ) ? { ...payload.pluginState } : {};
    payload.runtimeState = (
        payload.runtimeState && typeof payload.runtimeState === 'object' && !Array.isArray(payload.runtimeState)
    ) ? { ...payload.runtimeState } : {};
    payload.uiTelemetry = (
        payload.uiTelemetry && typeof payload.uiTelemetry === 'object' && !Array.isArray(payload.uiTelemetry)
    ) ? { ...payload.uiTelemetry } : {};
    payload.healthAndHistory = (
        payload.healthAndHistory && typeof payload.healthAndHistory === 'object' && !Array.isArray(payload.healthAndHistory)
    ) ? { ...payload.healthAndHistory } : {};
    payload.redactionManifest = (
        payload.redactionManifest && typeof payload.redactionManifest === 'object' && !Array.isArray(payload.redactionManifest)
    ) ? { ...payload.redactionManifest } : {};
    payload.bundleMeta.bundleType = payload.bundleMeta.bundleType || 'FolderViewPlusSupportBundle';
    payload.bundleMeta.bundleVersion = Number.isFinite(Number(payload.bundleMeta.bundleVersion))
        ? Number(payload.bundleMeta.bundleVersion)
        : 2;
    payload.bundleMeta.schemaVersion = Number.isFinite(Number(payload.bundleMeta.schemaVersion))
        ? Number(payload.bundleMeta.schemaVersion)
        : 0;
    payload.bundleMeta.generatedAt = payload.bundleMeta.generatedAt || new Date().toISOString();
    payload.bundleMeta.pluginVersion = payload.bundleMeta.pluginVersion || 'unknown';
    payload.bundleMeta.channel = payload.bundleMeta.channel || 'dev';
    payload.bundleMeta.privacyMode = payload.bundleMeta.privacyMode === 'full' ? 'full' : mode;
    payload.healthAndHistory.summary = (
        payload.healthAndHistory.summary && typeof payload.healthAndHistory.summary === 'object' && !Array.isArray(payload.healthAndHistory.summary)
    ) ? { ...payload.healthAndHistory.summary } : {};
    payload.healthAndHistory.recentTimeline = Array.isArray(payload.healthAndHistory.recentTimeline)
        ? payload.healthAndHistory.recentTimeline.slice(0)
        : [];
    payload.system.request = (
        payload.system.request && typeof payload.system.request === 'object' && !Array.isArray(payload.system.request)
    ) ? { ...payload.system.request } : {};
    return payload;
};
const getSupportBundleTelemetryApi = () => {
    if (!supportBundleTelemetryApi && supportBundleTelemetryModule && typeof supportBundleTelemetryModule.createApi === 'function') {
        supportBundleTelemetryApi = supportBundleTelemetryModule.createApi({
            normalizeSupportBundleV2Payload,
            collectClientPerformanceTelemetry,
            getRequestErrorDiagnosticsSnapshot,
            getStandardRequestDiagnosticsSnapshot,
            collectFolderEditorDebugDiagnostics,
            collectThemeTelemetrySnapshot,
            getLocalizationDiagnosticsSnapshot: () => window.FolderViewPlusI18n?.snapshot?.() || {
                requestedLocale: document.documentElement?.lang || 'en',
                resolvedLocale: 'en',
                activeLocale: document.documentElement?.lang || 'en',
                initialized: false
            },
            getDiagnosticsSummary: () => lastDiagnostics?.privacyMode === 'full' ? null : (lastDiagnostics?.summary || null),
            readClientDiagnosticsStorageRecord,
            storageKeys: {
                launch: EDITOR_DEBUG_LAUNCH_STORAGE_KEY,
                bootstrap: EDITOR_DEBUG_BOOTSTRAP_STORAGE_KEY,
                surface: EDITOR_DEBUG_SURFACE_STORAGE_KEY,
                dockerPage: 'fv.support.bundle.docker.page.v1',
                dockerCompatibility: 'fv.support.bundle.docker.compatibility.v1',
                dockerBulkUpdateTrace: 'fv.support.bundle.docker.bulkUpdateTrace.v1',
                dockerRequestBundleTrace: 'fv.support.bundle.docker.requestBundleTrace.v1',
                dockerTraceHealth: 'fv.support.bundle.docker.traceHealth.v1',
                dockerRefreshDiagnostics: 'fv.support.bundle.docker.refreshDiagnostics.v1',
                dockerPreviewContext: 'fv.support.bundle.docker.previewContextBridge.v1',
                dashboardLayoutDocker: 'fv.support.bundle.dashboard.layout.docker.v1',
                dashboardLayoutVm: 'fv.support.bundle.dashboard.layout.vm.v1',
                dashboardVisualDocker: 'fv.support.bundle.dashboard.visual.docker.v1',
                dashboardVisualVm: 'fv.support.bundle.dashboard.visual.vm.v1',
                runtimePageDiagnostics: 'fv.support.bundle.runtime.pages.v1',
                dashboardLifecycle: 'fv.support.bundle.dashboard.lifecycle.v1',
                vmLifecycle: 'fv.support.bundle.vm.lifecycle.v1',
                downloadAttempts: 'fv.support.bundle.downloadAttempts.v1',
                runtimePerformance: {
                    docker: 'fv.support.bundle.runtime.performance.docker.v1',
                    vm: 'fv.support.bundle.runtime.performance.vm.v1',
                    dashboard: 'fv.support.bundle.runtime.performance.dashboard.v1',
                    settings: 'fv.support.bundle.runtime.performance.settings.v1',
                    folderEditor: 'fv.support.bundle.runtime.performance.folder-editor.v1'
                },
                dockerPerformancePolicy: 'fv.performancePolicy.docker.v1',
                vmPerformancePolicy: 'fv.performancePolicy.vm.v1'
            }
        });
    }
    return supportBundleTelemetryApi;
};
const collectSupportBundleUiTelemetry = (bundle) => {
    const telemetryApi = getSupportBundleTelemetryApi();
    if (telemetryApi && typeof telemetryApi.collectSupportBundleUiTelemetry === 'function') {
        return telemetryApi.collectSupportBundleUiTelemetry(bundle);
    }
    const payload = normalizeSupportBundleV2Payload(bundle, bundle?.bundleMeta?.privacyMode || 'sanitized');
    const loadedAssetEntries = Array.from(document.querySelectorAll('script[src*="/plugins/folderview.plus/"], link[href*="/plugins/folderview.plus/"]'))
        .map((node) => ({
            tag: String(node?.tagName || '').toLowerCase() || 'asset',
            url: String(node?.src || node?.href || '').replace(/^https?:\/\/[^/?#]+/i, ''),
            loaded: node?.tagName === 'LINK' ? Boolean(node.sheet) : true
        }));
    payload.uiTelemetry = {
        loadedAssets: {
            count: loadedAssetEntries.length,
            entries: loadedAssetEntries
        },
        performance: collectClientPerformanceTelemetry(),
        requestActivity: getStandardRequestDiagnosticsSnapshot(),
        requestErrors: getRequestErrorDiagnosticsSnapshot(),
        browserConsoleErrors: fatalBanner && typeof fatalBanner.getBrowserConsoleErrorSnapshot === 'function'
            ? fatalBanner.getBrowserConsoleErrorSnapshot()
            : { count: 0, entries: [] },
        startupIncident: fatalBanner && typeof fatalBanner.getStartupIncidentSnapshot === 'function'
            ? fatalBanner.getStartupIncidentSnapshot()
            : { available: false, schemaVersion: 1 },
        folderEditorDebug: collectFolderEditorDebugDiagnostics(),
        theme: collectThemeTelemetrySnapshot(),
        localization: window.FolderViewPlusI18n?.snapshot?.() || {
            requestedLocale: document.documentElement?.lang || 'en',
            resolvedLocale: 'en',
            activeLocale: document.documentElement?.lang || 'en',
            initialized: false
        }
    };
    return payload;
};

const getSupportBundlePreviewApi = () => {
    if (!supportBundlePreviewApi && supportBundlePreviewModule && typeof supportBundlePreviewModule.createApi === 'function') {
        supportBundlePreviewApi = supportBundlePreviewModule.createApi({
            $,
            escapeHtml: diagnosticsEscapeHtml,
            formatCheckedAtLabel,
            normalizeSupportBundleV2Payload,
            getSupportBundlePreview,
            enrichSupportBundlePreview: collectSupportBundleUiTelemetry,
            showError: diagnosticsShowError,
            svgIcon: window.FolderViewPlusUI?.svgIcon,
            t: diagnosticsT
        });
    }
    return supportBundlePreviewApi;
};

const renderSupportBundlePreview = (bundle = null) => {
    const previewApi = getSupportBundlePreviewApi();
    if (previewApi) {
        previewApi.renderSupportBundlePreview(bundle);
    }
};

const refreshSupportBundlePreview = async ({ privacy = 'sanitized', quiet = true } = {}) => {
    const previewApi = getSupportBundlePreviewApi();
    if (!previewApi) {
        return null;
    }
    return previewApi.refreshSupportBundlePreview({ privacy, quiet });
};

const runDiagnosticAction = async (action, type, privacy = 'sanitized') => {
    const payload = { action };
    if (type) {
        payload.type = type;
    }
    payload.privacy = privacy || 'sanitized';
    const response = await apiPostJson('/plugins/folderview.plus/server/diagnostics.php', payload);
    if (!response.ok) {
        throw new Error(response.error || 'Diagnostics action failed.');
    }
    return response;
};

const trackDiagnosticsEvent = async ({ eventType, type = null, status = 'ok', source = 'ui', details = {} }) => {
    if (!eventType) {
        return;
    }
    const statusValue = String(status || 'ok');
    const activityMessage = describeTrackedEvent(eventType, type, details);
    if (activityMessage && (statusValue !== 'ok' || LOGGED_DIAGNOSTIC_EVENTS.has(String(eventType)))) {
        addActivityEntry(activityMessage, statusValue === 'ok' ? 'success' : 'error');
        if (statusValue === 'ok' && ['import', 'clear_folders', 'delete_folder', 'runtime_bulk_action', 'bulk_assign'].includes(String(eventType))) {
            diagnosticsShowToastMessage({
                title: 'Action completed',
                message: activityMessage,
                level: 'success',
                durationMs: 4200
            });
        }
    }

    const payload = {
        action: 'track_event',
        eventType: String(eventType),
        status: statusValue,
        source: String(source || 'ui'),
        details: JSON.stringify(details || {})
    };
    if (type) {
        payload.type = type;
    }
    try {
        await apiPostText('/plugins/folderview.plus/server/diagnostics.php', payload, {
            retries: 0,
            timeoutMs: 8000
        });
    } catch (error) {
        // Event tracking is best-effort and should never block UI actions.
    }
};

const fetchPrefs = async (type) => {
    if (diagnosticsPrefsCoordinator) {
        try {
            return await diagnosticsPrefsCoordinator.hydrateFromServer(type);
        } catch (error) {
            // Preserve the established defaults fallback when preferences cannot load.
        }
    }
    try {
        const response = await apiGetJson(`/plugins/folderview.plus/server/prefs.php?type=${type}`);
        if (response.ok && response.prefs) {
            return utils.normalizePrefs({
                ...response.prefs,
                _metadata: response.metadata || {}
            });
        }
    } catch (error) {
        // Keep defaults.
    }
    return utils.normalizePrefs({});
};

const protectDashboardLayoutFromBroadPrefsWrite = (prefs, options = {}) => {
    if (typeof diagnosticsPrefsStoreModule?.protectDashboardLayoutFromBroadPrefsWrite === 'function') {
        return diagnosticsPrefsStoreModule.protectDashboardLayoutFromBroadPrefsWrite(prefs, options);
    }
    if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs) || options.allowDashboardLayoutWrite === true) {
        return prefs;
    }
    const dashboard = prefs.dashboard;
    if (!dashboard || typeof dashboard !== 'object' || Array.isArray(dashboard) || !Object.prototype.hasOwnProperty.call(dashboard, 'layout')) {
        return prefs;
    }
    const topLevelKeys = Object.keys(prefs).filter((key) => key !== '_metadata');
    const dashboardKeys = Object.keys(dashboard);
    const layoutOnlyPatch = topLevelKeys.length === 1 && topLevelKeys[0] === 'dashboard'
        && dashboardKeys.length === 1 && dashboardKeys[0] === 'layout';
    if (layoutOnlyPatch) {
        return prefs;
    }
    const nextDashboard = { ...dashboard };
    delete nextDashboard.layout;
    const nextPrefs = { ...prefs };
    if (Object.keys(nextDashboard).length > 0) {
        nextPrefs.dashboard = nextDashboard;
    } else {
        delete nextPrefs.dashboard;
    }
    return nextPrefs;
};

const postPrefs = async (type, prefs, options = {}) => {
    const protectedPrefs = diagnosticsPrefsStoreModule?.cleanPatch(
        protectDashboardLayoutFromBroadPrefsWrite(prefs, options), options.baselinePrefs || (options.currentPrefs ? null : prefsByType?.[type])
    ) || protectDashboardLayoutFromBroadPrefsWrite(prefs, options);
    if (diagnosticsPrefsCoordinator) {
        const savedPrefs = await diagnosticsPrefsCoordinator.save(type, protectedPrefs, {
            currentPrefs: options.currentPrefs || prefsByType?.[type] || null,
            immediate: options.immediate === true
        });
        latestPrefsBackupByType[type] = diagnosticsPrefsCoordinator.getSnapshot(type)?.lastBackup || null;
        return utils.normalizePrefs(savedPrefs);
    }
    const expectedRevision = Math.max(
        0,
        Number.parseInt(String(
            protectedPrefs?._metadata?.prefsRevision
            ?? prefsByType?.[type]?._metadata?.prefsRevision
            ?? '0'
        ), 10) || 0
    );
    const payload = {
        type,
        prefs: JSON.stringify(Object.fromEntries(
            Object.entries(protectedPrefs || {}).filter(([key]) => key !== '_metadata')
        ))
    };
    if (expectedRevision > 0) {
        payload.expectedRevision = expectedRevision;
    }
    const response = await apiPostJson('/plugins/folderview.plus/server/prefs.php', payload);
    if (!response.ok) {
        throw new Error(response.error || 'Failed to save preferences.');
    }
    latestPrefsBackupByType[type] = response.backup || null;
    const fallbackPrefs = typeof diagnosticsPrefsStoreModule?.mergePatch === 'function'
        ? diagnosticsPrefsStoreModule.mergePatch(prefsByType?.[type] || {}, protectedPrefs || {})
        : { ...(prefsByType?.[type] || {}), ...(protectedPrefs || {}) };
    return utils.normalizePrefs({
        ...(response.prefs || fallbackPrefs),
        _metadata: response.metadata || {}
    });
};

const createBackup = async (type, reason) => {
    const resolvedType = normalizeManagedType(type);
    assertRuntimeConflictActionAllowed(`Create ${resolvedType === 'docker' ? 'Docker' : 'VM'} backup`);
    const response = await apiPostJson('/plugins/folderview.plus/server/backup.php', {
        type: resolvedType,
        action: 'create',
        reason
    });
    if (!response.ok) {
        throw new Error(response.error || 'Backup failed.');
    }
    return response.backup;
};

const createGlobalRollbackCheckpointApi = async (reason = 'manual') => {
    assertRuntimeConflictActionAllowed('Create rollback checkpoint');
    const response = await apiPostJson('/plugins/folderview.plus/server/backup.php', {
        action: 'rollback_checkpoint',
        reason
    });
    if (!response.ok) {
        throw new Error(response.error || 'Rollback checkpoint failed.');
    }
    return response.rollback || {};
};

const restorePreviousGlobalRollbackCheckpointApi = async () => {
    assertRuntimeConflictActionAllowed('Restore rollback checkpoint');
    const response = await apiPostJson('/plugins/folderview.plus/server/backup.php', {
        action: 'rollback_restore_previous'
    });
    if (!response.ok) {
        throw new Error(response.error || 'Rollback restore failed.');
    }
    return response.restore || {};
};

const restoreLatest = async (type) => {
    const resolvedType = normalizeManagedType(type);
    assertRuntimeConflictActionAllowed(`Restore latest ${resolvedType === 'docker' ? 'Docker' : 'VM'} backup`);
    await diagnosticsPrefsCoordinator?.flush?.(resolvedType);
    const response = await apiPostJson('/plugins/folderview.plus/server/backup.php', { type: resolvedType, action: 'restore_latest' });
    if (!response.ok) {
        throw new Error(response.error || 'Restore failed.');
    }
    return response.restore;
};

const restoreLatestUndo = async (type) => {
    const resolvedType = normalizeManagedType(type);
    assertRuntimeConflictActionAllowed(`Undo latest ${resolvedType === 'docker' ? 'Docker' : 'VM'} restore`);
    await diagnosticsPrefsCoordinator?.flush?.(resolvedType);
    const response = await apiPostJson('/plugins/folderview.plus/server/backup.php', { type: resolvedType, action: 'restore_latest_undo' });
    if (!response.ok) {
        throw new Error(response.error || 'Undo restore failed.');
    }
    return response.restore;
};

const executeFolderRuntimeAction = async (type, runtimeAction, items) => {
    const response = await apiPostJson('/plugins/folderview.plus/server/bulk_folder_action.php', {
        type,
        runtimeAction,
        items: JSON.stringify(items || [])
    });
    if (!response.ok) {
        throw new Error(response.error || 'Runtime action failed.');
    }
    return response.result || {};
};

const runScheduledBackup = async (type) => {
    const payload = {
        action: 'run_schedule'
    };
    if (type) {
        payload.type = type;
    }
    const response = await apiPostJson('/plugins/folderview.plus/server/backup.php', payload);
    if (!response.ok) {
        throw new Error(response.error || 'Scheduled backup run failed.');
    }
    return response.schedules || {};
};

const setUpdateStatus = (text) => {
    $('#update-check-status').text(text || '');
};

const setRollbackStatus = (text) => {
    $('#rollback-status').text(text || '');
};

const formatActivityTimestamp = (at) => {
    if (at === null || at === undefined || at === '') return '';
    const numeric = typeof at === 'number' || /^\d+$/.test(String(at));
    const date = new Date(numeric ? Number(at) : at);
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    const options = numeric ? { hour: '2-digit', minute: '2-digit' }
        : { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return (globalThis.FolderViewPlusI18n?.formatDate?.(date, options) || date.toLocaleString('en', options));
};

const normalizeActivityLevel = (level) => {
    const normalized = String(level || 'info').trim().toLowerCase();
    if (['error', 'danger', 'failed', 'fatal'].includes(normalized)) {
        return 'error';
    }
    if (normalized === 'success' || normalized === 'ok') {
        return 'success';
    }
    if (['warning', 'warn', 'degraded', 'partial'].includes(normalized)) {
        return 'warning';
    }
    return 'info';
};

const normalizeActivityClearedAt = (value, now = Date.now()) => {
    const at = Number(value);
    return Number.isSafeInteger(at) && at > now - ACTIVITY_FEED_RETENTION_MS && at <= now ? at : 0;
};

const normalizeActivityClearedServerKeys = (value) => (Array.isArray(value) ? value : [])
    .filter((key) => typeof key === 'string' && /^s:[a-zA-Z0-9_-]{1,48}$/.test(key))
    .slice(0, 80);

const retainActivityEntries = (entries, now = Date.now()) => (Array.isArray(entries) ? entries : [])
    .map((entry) => {
        const at = Number(entry?.at);
        const message = typeof entry?.message === 'string' ? entry.message.trim().slice(0, ACTIVITY_FEED_MAX_MESSAGE_LENGTH) : '';
        if (!Number.isSafeInteger(at) || at <= now - ACTIVITY_FEED_RETENTION_MS || at > now || !message) {
            return null;
        }
        const serverKey = typeof entry.serverKey === 'string' && /^s:[a-zA-Z0-9_-]{1,48}$/.test(entry.serverKey)
            ? entry.serverKey : '';
        return { at, level: normalizeActivityLevel(entry.level), message, ...(serverKey ? { serverKey } : {}) };
    })
    .filter(Boolean)
    .sort((left, right) => right.at - left.at)
    .slice(0, ACTIVITY_FEED_MAX_ENTRIES);

const persistActivityFeed = () => {
    try {
        activityFeedClearedAt = normalizeActivityClearedAt(activityFeedClearedAt);
        if (!activityFeedEntries.length && !activityFeedClearedAt) {
            localStorage.removeItem(ACTIVITY_FEED_STORAGE_KEY);
            return;
        }
        localStorage.setItem(ACTIVITY_FEED_STORAGE_KEY, JSON.stringify({
            schemaVersion: 1,
            clearedAt: activityFeedClearedAt,
            clearedServerKeys: activityFeedClearedAt ? activityFeedClearedServerKeys : [],
            entries: activityFeedEntries
        }));
    } catch (_error) {
        // Browser storage is optional; the in-memory feed remains usable.
    }
};

const restoreActivityFeed = () => {
    if (activityFeedRestored) return;
    activityFeedRestored = true;
    const stored = readClientDiagnosticsStorageRecord(ACTIVITY_FEED_STORAGE_KEY);
    const entries = Number(stored?.schemaVersion) === 1 ? stored.entries : [];
    activityFeedClearedAt = normalizeActivityClearedAt(stored?.clearedAt);
    activityFeedClearedServerKeys = activityFeedClearedAt ? normalizeActivityClearedServerKeys(stored?.clearedServerKeys) : [];
    activityFeedEntries = retainActivityEntries([...activityFeedEntries, ...(Array.isArray(entries) ? entries : [])]);
    persistActivityFeed();
};

const syncActivityFeedFromStorage = (event) => {
    if (event.key !== ACTIVITY_FEED_STORAGE_KEY && event.key !== null) return;
    activityFeedRestored = true;
    const stored = readClientDiagnosticsStorageRecord(ACTIVITY_FEED_STORAGE_KEY);
    activityFeedClearedAt = normalizeActivityClearedAt(stored?.clearedAt);
    activityFeedClearedServerKeys = activityFeedClearedAt ? normalizeActivityClearedServerKeys(stored?.clearedServerKeys) : [];
    activityFeedEntries = retainActivityEntries(Number(stored?.schemaVersion) === 1 ? stored.entries : []);
    renderActivityFeed();
};

const getActivityLevelMeta = (level) => {
    switch (normalizeActivityLevel(level)) {
        case 'success':
            return { label: 'Complete', icon: 'fa-check-circle' };
        case 'warning':
            return { label: 'Attention', icon: 'fa-exclamation-triangle' };
        case 'error':
            return { label: 'Issue', icon: 'fa-times-circle' };
        case 'info':
        default:
            return { label: 'Info', icon: 'fa-info-circle' };
    }
};

const summarizeActivityFeed = () => {
    const counts = activityFeedEntries.reduce((acc, entry) => {
        const level = normalizeActivityLevel(entry?.level);
        acc[level] = (acc[level] || 0) + 1;
        return acc;
    }, {});
    const total = activityFeedEntries.length;
    if (!total) {
        return diagnosticsT("diagnostics.activity.empty", "No recent activity.");
    }
    if (counts.error > 0) {
        return diagnosticsT("diagnostics.activity.errors", "Issues needing attention: $1.", counts.error);
    }
    if (counts.warning > 0) {
        return `${surfaceT('common.audit.review-action', 'Review recent action')} · ${diagnosticsT('diagnostics.activity.warnings', 'Items needing review: $1.', counts.warning)}`;
    }
    if (counts.success > 0) {
        return diagnosticsT("diagnostics.activity.successes", "Completed actions: $1.", counts.success);
    }
    return diagnosticsT("diagnostics.activity.updates", "Recent updates: $1.", total);
};

const renderActivityFeed = () => {
    const panel = $('#fv-activity-feed-panel');
    const list = $('#fv-activity-feed-list');
    const summary = $('#fv-activity-center-summary');
    const clear = $('#fv-activity-center-clear');
    if (!panel.length || !list.length) {
        return;
    }
    restoreActivityFeed();
    const retained = retainActivityEntries(activityFeedEntries);
    if (retained.length !== activityFeedEntries.length) {
        activityFeedEntries = retained;
        persistActivityFeed();
    }
    summary.text(summarizeActivityFeed());
    if (!activityFeedEntries.length) {
        list.html(`<li class="fv-activity-empty"><strong>${diagnosticsEscapeHtml(diagnosticsT('diagnostics.activity.ready', 'Ready'))}</strong><span>${diagnosticsEscapeHtml(diagnosticsT('diagnostics.activity.empty-description', 'Folder changes, backups, imports, and recovery actions will appear here.'))}</span></li>`);
        clear.prop('disabled', true).attr('title', diagnosticsT('diagnostics.activity.empty-title', 'No activity yet'));
        return;
    }
    clear.removeAttr('title');
    const rows = activityFeedEntries.map((entry) => {
        const level = normalizeActivityLevel(entry?.level);
        const meta = getActivityLevelMeta(level);
        return `<li class="fv-activity-item is-${diagnosticsEscapeHtml(level)}"><span class="fv-activity-level"><i class="fa ${diagnosticsEscapeHtml(meta.icon)}" aria-hidden="true"></i>${diagnosticsEscapeHtml(meta.label)}</span><span class="fv-activity-time">${diagnosticsEscapeHtml(formatActivityTimestamp(entry.at))}</span><span class="fv-activity-text">${diagnosticsEscapeHtml(String(entry.message || ''))}</span></li>`;
    }).join('');
    list.html(rows);
    clear.prop('disabled', false);
};

const addActivityEntry = (message, level = 'info') => {
    restoreActivityFeed();
    const text = String(message || '').trim().slice(0, ACTIVITY_FEED_MAX_MESSAGE_LENGTH);
    if (!text) {
        return;
    }
    activityFeedEntries.unshift({
        at: Date.now(),
        level: String(level || 'info'),
        message: text
    });
    activityFeedEntries = retainActivityEntries(activityFeedEntries);
    persistActivityFeed();
    renderActivityFeed();
};

const clearActivityFeed = () => {
    activityFeedRestored = true;
    const boundary = Math.floor(Date.now() / 1000) * 1000;
    const serverEvents = Array.isArray(lastDiagnostics?.importExportHistory?.events)
        ? lastDiagnostics.importExportHistory.events : [];
    activityFeedClearedServerKeys = normalizeActivityClearedServerKeys([
        ...activityFeedEntries.filter((entry) => entry.at === boundary).map((entry) => entry.serverKey),
        ...serverEvents.filter((row) => Date.parse(String(row?.timestamp || '')) === boundary).map(serverActivityKey)
    ]);
    activityFeedEntries = [];
    activityFeedClearedAt = boundary;
    persistActivityFeed();
    renderActivityFeed();
};

const ADVANCED_MODULE_STATUS_CONFIG = Object.freeze({
    docker_backups: Object.freeze({
        anchorSelector: '#docker-backups',
        label: 'Docker backups'
    }),
    vm_backups: Object.freeze({
        anchorSelector: '#vm-backups',
        label: 'VM backups'
    }),
    docker_templates: Object.freeze({
        anchorSelector: '#docker-templates',
        label: 'Docker templates'
    }),
    vm_templates: Object.freeze({
        anchorSelector: '#vm-templates',
        label: 'VM templates'
    }),
    change_history: Object.freeze({
        anchorSelector: '#fv-activity-feed-list',
        label: 'Logs'
    })
});

const ensureAdvancedModuleStatusHost = (moduleKey) => {
    const config = ADVANCED_MODULE_STATUS_CONFIG[moduleKey];
    if (!config) {
        return null;
    }
    const anchor = document.querySelector(config.anchorSelector);
    if (!(anchor instanceof HTMLElement)) {
        return null;
    }
    const panel = anchor.closest('.rules-panel') || anchor.parentElement;
    if (!(panel instanceof HTMLElement)) {
        return null;
    }
    let host = panel.querySelector(`[data-fv-advanced-module-status="${moduleKey}"]`);
    if (!(host instanceof HTMLElement)) {
        host = document.createElement('div');
        host.className = 'inline-validation-hint fv-advanced-module-status';
        host.setAttribute('data-fv-advanced-module-status', moduleKey);
        const header = panel.querySelector('.rules-header, .fv-activity-center-head');
        if (header instanceof HTMLElement) {
            header.insertAdjacentElement('afterend', host);
        } else {
            panel.insertBefore(host, panel.firstChild || null);
        }
    }
    return host;
};

const renderAdvancedModuleStatus = (moduleKey) => {
    const status = advancedModuleStatusByKey[moduleKey];
    const config = ADVANCED_MODULE_STATUS_CONFIG[moduleKey];
    const host = ensureAdvancedModuleStatusHost(moduleKey);
    if (!status || !config || !(host instanceof HTMLElement)) {
        return;
    }
    if (status.state === 'loading') {
        host.classList.remove('is-error');
        host.classList.add('is-info');
        host.innerHTML = `<i class="fa fa-refresh fa-spin"></i> Refreshing ${diagnosticsEscapeHtml(config.label)}...`;
        host.style.display = '';
        return;
    }
    if (status.state === 'error') {
        const message = String(status.message || 'Refresh failed.');
        host.classList.remove('is-info');
        host.classList.add('is-error');
        host.innerHTML = `${diagnosticsEscapeHtml(config.label)} failed: ${diagnosticsEscapeHtml(message)} <button type="button" data-fv-advanced-module-retry="${diagnosticsEscapeHtml(moduleKey)}"><i class="fa fa-repeat"></i> ${diagnosticsEscapeHtml(diagnosticsT('diagnostics.actions.retry', 'Retry'))}</button>`;
        host.style.display = '';
        return;
    }
    host.classList.remove('is-error', 'is-info');
    host.textContent = '';
    host.style.display = 'none';
};

const setAdvancedModuleStatus = (moduleKey, state = 'idle', message = '') => {
    if (!Object.prototype.hasOwnProperty.call(advancedModuleStatusByKey, moduleKey)) {
        return;
    }
    advancedModuleStatusByKey[moduleKey] = {
        state,
        message: String(message || '')
    };
    renderAdvancedModuleStatus(moduleKey);
};

const claimAdvancedOperationLock = (type, scope, actionLabel = 'Operation') => {
    const resolvedType = normalizeManagedType(type);
    const map = advancedOperationLockByType[resolvedType];
    if (!map || !Object.prototype.hasOwnProperty.call(map, scope)) {
        return true;
    }
    if (map[scope] === true) {
        diagnosticsSwal({
            title: 'Please wait',
            text: `${actionLabel} is already running for ${resolvedType.toUpperCase()}.`,
            type: 'info'
        });
        return false;
    }
    map[scope] = true;
    return true;
};

const releaseAdvancedOperationLock = (type, scope) => {
    const resolvedType = normalizeManagedType(type);
    const map = advancedOperationLockByType[resolvedType];
    if (!map || !Object.prototype.hasOwnProperty.call(map, scope)) {
        return;
    }
    map[scope] = false;
};

const withAdvancedOperationLock = async (type, scope, actionLabel, callback) => {
    const resolvedType = normalizeManagedType(type);
    if (!claimAdvancedOperationLock(resolvedType, scope, actionLabel)) {
        return null;
    }
    try {
        return await callback();
    } finally {
        releaseAdvancedOperationLock(resolvedType, scope);
    }
};

const getCachedDiagnostics = () => lastDiagnostics;

const serverActivityLabel = (action) => {
    switch (String(action || '')) {
        case 'backup_create': return diagnosticsT('legacy.surface.ebc91c7ac728323f', 'Backup created');
        case 'backup_restore': return diagnosticsT('diagnostics.history.backup-restored', 'Backup restored');
        case 'backup_delete': return diagnosticsT('diagnostics.history.backup-deleted', 'Backup deleted');
        case 'backup_delete_all': return diagnosticsT('legacy.surface.477235d571fd27bc', 'Backups deleted');
        case 'rollback_create': return diagnosticsT('legacy.surface.488de119a17f3cb0', 'Rollback checkpoint created');
        case 'rollback_restore': return diagnosticsT('legacy.surface.4a326363548eeb45', 'Rollback restored');
        case 'environment_export': return diagnosticsT('legacy.surface.eae1fdd133376e8b', 'Environment exported');
        case 'environment_import': return diagnosticsT('legacy.surface.6f50d668c818bd67', 'Environment imported');
        case 'folder_create': return diagnosticsT('legacy.surface.b1dfe0e9670cba07', 'Folder created');
        case 'folder_update': return diagnosticsT('legacy.surface.1bafabfde564c2ff', 'Folder updated');
        case 'folder_delete':
        case 'delete_folder': return diagnosticsT('legacy.surface.796dc50ba898b20e', 'Folder deleted');
        case 'folder_batch_mutation': return diagnosticsT('legacy.surface.3b82ea5d8d562750', 'Folders changed');
        case 'folder_settings_apply': return diagnosticsT('legacy.surface.30eeaf5fbcbf6551', 'Folder settings applied');
        case 'folder_batch_assignment':
        case 'bulk_assign': return diagnosticsT('legacy.surface.108df9023de0f1ef', 'Folders assigned');
        case 'reorder': return diagnosticsT('legacy.surface.9932c276701d61cb', 'Folder order changed');
        case 'runtime_bulk_action': return diagnosticsT('legacy.surface.0f26990ce5039407', 'Runtime action completed');
        case 'template_create': return diagnosticsT('legacy.surface.1b34f8ff69d42e9b', 'Template saved');
        case 'template_delete': return diagnosticsT('legacy.surface.8fa9d4a8b8272f35', 'Template deleted');
        case 'template_apply': return diagnosticsT('legacy.surface.d71a690c533f0773', 'Template applied');
        case 'import': return diagnosticsT('legacy.surface.fbf4233b76201b64', 'Import applied');
        case 'clear_folders': return diagnosticsT('legacy.surface.4831800dd74859de', 'Folders cleared');
        default: return '';
    }
};

const serverActivityFailureLabel = (action) => {
    const name = String(action || '');
    if (name.startsWith('backup_')) return diagnosticsT('common.repair.backup-failed-0e7112', 'Backup failed');
    if (name === 'import' || name === 'environment_import') return diagnosticsT('legacy.surface.0a26f41abd00f95e', 'Import failed');
    if (name === 'environment_export') return diagnosticsT('legacy.surface.e94d3ee06ecf6aac', 'Export failed');
    if (name.startsWith('folder_') || ['delete_folder', 'clear_folders', 'bulk_assign', 'reorder'].includes(name)) {
        return diagnosticsT('legacy.surface.5ea309a60ed8fe70', 'Folder change failed');
    }
    if (name === 'runtime_bulk_action') return diagnosticsT('legacy.surface.138dfeb0adcc5e76', 'Runtime action failed');
    if (name.startsWith('template_')) return diagnosticsT('legacy.surface.775c54cd56850c18', 'Template action failed');
    if (name.startsWith('rollback_')) return diagnosticsT('legacy.surface.07d59065ece38c26', 'Recovery action failed');
    return diagnosticsT('legacy.surface.2ead3b8f92a1292d', 'Server action failed');
};

const serverActivityKey = (row) => {
    const id = String(row?.id || '');
    if (/^[a-zA-Z0-9_-]{1,48}$/.test(id)) return 's:' + id;
    const signature = [row?.timestamp, row?.type, row?.action, row?.status, row?.summary].join('|');
    let hash = 2166136261;
    for (let index = 0; index < signature.length; index++) {
        hash = Math.imul(hash ^ signature.charCodeAt(index), 16777619);
    }
    return 's:' + (hash >>> 0).toString(16);
};

const renderChangeHistory = (diagnostics = lastDiagnostics) => {
    if (!document.getElementById('fv-activity-feed-panel')) return;
    restoreActivityFeed();
    const events = Array.isArray(diagnostics?.importExportHistory?.events)
        ? diagnostics.importExportHistory.events
        : (Array.isArray(diagnostics?.recentTimeline) ? diagnostics.recentTimeline : []);
    const knownKeys = new Set(activityFeedEntries.map((entry) => entry.serverKey).filter(Boolean));
    const now = Date.now();
    let added = false;
    for (const row of events) {
        const at = Date.parse(String(row?.timestamp || ''));
        if (!Number.isSafeInteger(at) || at <= now - ACTIVITY_FEED_RETENTION_MS || at > now || at < activityFeedClearedAt) continue;
        const level = normalizeActivityLevel(row?.status || 'ok');
        const action = serverActivityLabel(row?.action);
        if (!action && level !== 'warning' && level !== 'error') continue;
        const serverKey = serverActivityKey(row);
        if (knownKeys.has(serverKey) || (at === activityFeedClearedAt && activityFeedClearedServerKeys.includes(serverKey))) continue;
        const source = String(row?.type || '').toLowerCase();
        const sourceLabel = source === 'docker' ? 'Docker' : (source === 'vm' ? 'VM' : '');
        const label = level === 'error' ? serverActivityFailureLabel(row?.action)
            : (level === 'warning' ? diagnosticsT('legacy.surface.c7ca4f1d51295f49', 'Server warning') : action);
        activityFeedEntries.push({
            at,
            level,
            message: sourceLabel ? sourceLabel + ' · ' + label : label,
            serverKey
        });
        knownKeys.add(serverKey);
        added = true;
    }
    if (added) {
        activityFeedEntries = retainActivityEntries(activityFeedEntries);
        persistActivityFeed();
    }
    renderActivityFeed();
};

const refreshChangeHistory = async ({ quiet = false } = {}) => {
    const startedAt = perfNowMs();
    const previousDiagnostics = lastDiagnostics;
    setAdvancedModuleStatus('change_history', 'loading');
    try {
        const diagnostics = await getDiagnostics('full');
        if (lastDiagnostics === previousDiagnostics && !diagnosticsRunState.running) renderDiagnostics(diagnostics);
        renderChangeHistory(diagnostics);
        recordPerformanceDiagnosticsSample('settings', 'diagnostics', perfNowMs() - startedAt, {
            source: 'change-history'
        });
        markAdvancedModuleLoadSuccess('change_history');
    } catch (error) {
        markAdvancedModuleLoadError('change_history', error);
        if (!quiet) {
            diagnosticsShowError('Logs refresh failed', error);
        }
        return false;
    }
    return true;
};

const formatCheckedAtLabel = (value) => {
    const date = new Date(String(value || '').trim());
    if (Number.isNaN(date.getTime())) {
        return diagnosticsT('diagnostics.value.just-now', 'just now');
    }
    return (globalThis.FolderViewPlusI18n?.formatDate?.(date, { dateStyle: 'short', timeStyle: 'medium' }) || date.toLocaleString('en'));
};

const buildThemeDiagnosticsSummaryCard = () => {
    if (!lastThemeDiagnostics || !diagnosticsViewModelModule?.buildThemeCard) return null;
    return diagnosticsViewModelModule.buildThemeCard(lastThemeDiagnostics, {
        t: diagnosticsT,
        appliedMode: String(lastThemeDiagnostics.resolver?.appliedMode || '').trim()
            || normalizeDiagnosticsThemeMode(lastThemeDiagnostics.modeByType?.effective),
        checkedAtLabel: formatCheckedAtLabel(lastThemeDiagnostics.generatedAt)
    });
};

const buildPerformanceBudgetDiagnosticsSummaryCard = () => {
    const telemetry = collectClientPerformanceTelemetry();
    const settingsTelemetry = telemetry?.settings && typeof telemetry.settings === 'object'
        ? telemetry.settings
        : {};
    const entries = [
        { key: 'config-bootstrap', group: 'settings-first-paint', label: 'Configuration first paint', summary: settingsTelemetry.configBootstrap },
        { key: 'docker-runtime-hydration', group: 'runtime-hydration', label: 'Docker runtime hydration', summary: settingsTelemetry.runtimeHydration?.docker },
        { key: 'vm-runtime-hydration', group: 'runtime-hydration', label: 'VM runtime hydration', summary: settingsTelemetry.runtimeHydration?.vm },
        { key: 'manual-refresh', group: 'settings-refresh', label: 'Full Settings refresh', summary: settingsTelemetry.manualRefresh },
        { key: 'docker-import', group: 'docker-import', label: 'Docker import', summary: settingsTelemetry.import?.docker },
        { key: 'vm-import', group: 'vm-import', label: 'VM import', summary: settingsTelemetry.import?.vm },
        { key: 'wizard-apply', group: 'wizard-apply', label: 'Wizard apply', summary: settingsTelemetry.wizardApply },
        { key: 'diagnostics-refresh', group: 'diagnostics-refresh', label: 'Diagnostics refresh', summary: settingsTelemetry.diagnosticsRefresh }
    ].filter((entry) => entry.summary && typeof entry.summary === 'object');
    if (!entries.length) {
        return null;
    }
    const overBudget = entries.filter((entry) => entry.summary.overBudget === true);
    const observed = entries.filter((entry) => entry.summary.isolatedOverBudget === true && entry.summary.overBudget !== true);
    const advisoryGroups = new Set(overBudget.map((entry) => entry.group));
    const slowest = entries.reduce((current, entry) => {
        const durationMs = Number(entry.summary.recentAverageMs ?? entry.summary.maxMs);
        const currentDurationMs = Number(current?.summary?.recentAverageMs ?? current?.summary?.maxMs);
        if (!Number.isFinite(durationMs)) {
            return current;
        }
        if (!current || !Number.isFinite(currentDurationMs) || durationMs > currentDurationMs) {
            return entry;
        }
        return current;
    }, null);
    const measuredAt = telemetry.updatedAt ? formatCheckedAtLabel(telemetry.updatedAt) : 'this page session';
    const technicalDetails = entries.map((entry) => {
        const summary = entry.summary;
        const recentAverage = Number(summary.recentAverageMs);
        const averageLabel = Number.isFinite(recentAverage) ? `${recentAverage.toFixed(0)}ms recent average` : `${Number(summary.avgMs).toFixed(0)}ms session average`;
        const budgetLabel = Number.isFinite(Number(summary.budgetMs)) ? `${Number(summary.budgetMs).toFixed(0)}ms target` : 'no target';
        const recentLabel = summary.recentSampleCount > 0
            ? `${summary.recentOverBudgetCount}/${summary.recentSampleCount} recent warm samples over target`
            : surfaceT("common.repair.cold-load-samples-1-983e40", "Cold-load samples: $1", summary.coldLoadCount || 0);
        return `${entry.label}: ${Number(summary.lastMs).toFixed(0)}ms latest, ${averageLabel}, ${budgetLabel}, ${recentLabel}.`;
    });
    const hasWarning = advisoryGroups.size > 0;
    const hasObservation = observed.length > 0;
    const slowestDuration = Number(slowest?.summary?.recentAverageMs ?? slowest?.summary?.maxMs);
    const slowestBudget = Number(slowest?.summary?.budgetMs);
    return {
        key: 'performanceBudget',
        label: 'Performance Budgets',
        status: hasWarning ? 'warning' : (hasObservation ? 'info' : 'healthy'),
        badgeLabel: hasObservation && !hasWarning ? 'Observed' : '',
        headline: hasWarning
            ? surfaceT('common.startup.performance-followup', 'Repeated performance warnings requiring follow-up: $1.', advisoryGroups.size)
            : (hasObservation
                ? 'A cold or isolated slow sample was observed.'
                : 'Recent UI timings are within budget.'),
        detail: hasWarning && slowest
            ? `${slowest.label} is averaging ${slowestDuration.toFixed(0)}ms${Number.isFinite(slowestBudget) ? ` against a ${slowestBudget.toFixed(0)}ms target` : ''}.`
            : (hasObservation
                ? 'No warning was raised because the slowdown has not repeated across warm measurements.'
                : 'No repeated performance slowdown was detected.'),
        count: advisoryGroups.size,
        meta: hasWarning ? 'Repeated slowdown' : (hasObservation ? 'Observation only' : 'No extra action needed'),
        freshness: `Measured ${measuredAt}`,
        technicalDetails,
        actionKey: 'retest_performance'
    };
};

const buildLocalizationDiagnosticsSummaryCard = () => {
    const snapshot = window.FolderViewPlusI18n?.snapshot?.();
    if (!snapshot || typeof snapshot !== 'object') {
        return null;
    }
    const requestedLocale = String(snapshot.requestedLocale || 'en');
    const resolvedLocale = String(snapshot.resolvedLocale || 'en');
    const report = snapshot.requestedLocaleReport && typeof snapshot.requestedLocaleReport === 'object'
        ? snapshot.requestedLocaleReport
        : (snapshot.activeLocaleReport && typeof snapshot.activeLocaleReport === 'object' ? snapshot.activeLocaleReport : null);
    const coverage = Math.max(0, Math.min(100, Number(report?.coveragePercent) || 0));
    const translated = Math.max(0, Number(report?.translatedMessages) || 0);
    const total = Math.max(0, Number(report?.totalSourceMessages) || Number(snapshot.catalogSummary?.sourceMessageCount) || 0);
    const missing = Math.max(0, Number(report?.missingMessages) || (total - translated));
    const stale = Math.max(0, Number(report?.potentiallyStaleMessages) || 0);
    const loadErrorCount = Array.isArray(snapshot.loadErrors) ? snapshot.loadErrors.length : 0;
    const runtimeMissingCount = Math.max(0, Number(snapshot.missingKeyCount) || 0);
    const isSource = resolvedLocale === 'en' && requestedLocale === 'en';
    const usesFallback = requestedLocale !== resolvedLocale;
    const reviewedCurrent = report?.reviewedAgainstCurrentSource === true;
    const status = loadErrorCount > 0 || runtimeMissingCount > 0
        ? 'warning'
        : (isSource || (coverage === 100 && reviewedCurrent) ? 'healthy' : 'info');
    let headline = diagnosticsT('diagnostics.localization.healthy', 'The active language catalog is current.');
    if (loadErrorCount > 0) {
        headline = diagnosticsT('diagnostics.localization.load-error', 'One or more language catalogs could not be loaded.');
    } else if (runtimeMissingCount > 0) {
        headline = diagnosticsT('diagnostics.localization.runtime-missing', '$1 missing keys were observed in this page session.', runtimeMissingCount);
    } else if (usesFallback) {
        headline = diagnosticsT('diagnostics.localization.fallback', '$1 is using the $2 fallback.', requestedLocale, resolvedLocale);
    } else if (!reviewedCurrent) {
        headline = diagnosticsT('diagnostics.localization.review-needed', '$1 is partially translated and needs human review.', requestedLocale);
    }
    const detail = isSource
        ? diagnosticsT('diagnostics.localization.source-detail', '$1 source messages across $2 namespaces are loaded.', total, Number(snapshot.catalogSummary?.namespaceCount) || 0)
        : diagnosticsT('diagnostics.localization.coverage-detail', '$1% translated: $2 complete, $3 missing.', coverage, translated, missing);
    const technicalDetails = [
        diagnosticsT('diagnostics.localization.catalog-version', 'Catalog version: $1', String(snapshot.catalogVersion || 'unknown')),
        diagnosticsT('diagnostics.localization.requested-resolved', 'Requested: $1; resolved: $2', requestedLocale, resolvedLocale),
        Number(snapshot.catalogSummary?.extractionCandidateCount) > 0
            ? diagnosticsT('diagnostics.localization.extraction-debt', '$1 legacy UI string candidates still need explicit catalog bindings.', snapshot.catalogSummary.extractionCandidateCount)
            : '',
        stale > 0 ? diagnosticsT('diagnostics.localization.stale', '$1 translated messages may predate the current English source.', stale) : '',
        snapshot.missingKeyCount > 0 ? diagnosticsT('diagnostics.localization.runtime-missing', '$1 missing keys were observed in this page session.', snapshot.missingKeyCount) : '',
        ...(Array.isArray(snapshot.loadErrors)
            ? snapshot.loadErrors.map((entry) => `${entry.locale || 'unknown'}/${entry.namespace || 'catalog'}: ${entry.error || 'load failed'}`)
            : []),
        ...Object.entries(snapshot.localeCoverage || {})
            .filter(([locale]) => locale !== 'en')
            .sort(([left], [right]) => window.FolderViewPlusI18n?.compare?.(left, right) ?? left.localeCompare(right))
            .map(([locale, localeReport]) => diagnosticsT(
                'diagnostics.localization.locale-row',
                '$1: $2% translated, $3, review $4.',
                locale,
                Number(localeReport?.coveragePercent) || 0,
                String(localeReport?.status || 'placeholder'),
                localeReport?.reviewedAgainstCurrentSource === true ? 'current' : 'needed'
            ))
    ].filter(Boolean);
    return {
        key: 'localization',
        label: diagnosticsT('diagnostics.localization.label', 'Localization'),
        status,
        badgeLabel: isSource ? diagnosticsT('diagnostics.localization.source', 'Source') : `${coverage}%`,
        headline,
        detail,
        count: loadErrorCount + runtimeMissingCount,
        meta: isSource
            ? diagnosticsT('diagnostics.localization.current', 'Current source catalog')
            : diagnosticsT('diagnostics.localization.progress', '$1 of $2 messages', translated, total),
        freshness: diagnosticsT('diagnostics.localization.ready', 'Catalog loaded $1', formatCheckedAtLabel(snapshot.readyAt)),
        technicalDetails
    };
};

const getDiagnosticsViewApi = () => {
    if (diagnosticsViewApi) {
        return diagnosticsViewApi;
    }
    if (!diagnosticsViewModule || typeof diagnosticsViewModule.createApi !== 'function') {
        return null;
    }
    diagnosticsViewApi = diagnosticsViewModule.createApi({
        window, document,
        escapeHtml: diagnosticsEscapeHtml,
        svgIcon: window.FolderViewPlusUI?.svgIcon,
        t: diagnosticsT, runRepair: (action, type) => repairDiagnostics(action, type), setBusy: (busy) => setDiagnosticsWorkspaceBusy(busy), showError: diagnosticsShowError
    }); diagnosticsViewApi.bindActions?.();
    return diagnosticsViewApi;
};
const setDiagnosticsWorkspaceBusy = (busy) => {
    const workspace = document.getElementById('fv-diagnostics-workspace');
    workspace?.setAttribute('aria-busy', busy ? 'true' : 'false');
    document.querySelectorAll('[data-fv-ui-action^="diagnostics-"]').forEach((button) => {
        button.disabled = busy;
    });
};

const renderDiagnosticsSummary = (diagnostics = lastDiagnostics) => {
    const summaryHost = document.getElementById('fv-diagnostics-summary');
    const viewApi = getDiagnosticsViewApi();
    if (!summaryHost || !viewApi || !diagnosticsViewModelModule?.buildDiagnosticsViewModel) {
        return;
    }
    const hasResults = Boolean(diagnostics && typeof diagnostics === 'object');
    const checkedAt = hasResults ? formatCheckedAtLabel(diagnostics.checkedAt) : '';
    const summary = hasResults && diagnostics.summary && typeof diagnostics.summary === 'object'
        ? diagnostics.summary
        : {};
    const rawCoreCards = hasResults
        ? (Array.isArray(summary.cards) ? summary.cards : []).map((card) => ({
            ...card,
            freshness: String(card?.freshness || '').trim() || diagnosticsT('diagnostics.cards.checked', 'Checked $1', checkedAt)
        }))
        : []; const coreCards = viewApi.decorateCardsWithRecommendedActions(rawCoreCards, diagnostics, summary);
    const themeCard = hasResults ? buildThemeDiagnosticsSummaryCard() : null;
    if (themeCard) {
        coreCards.push(themeCard);
    }
    const performanceCard = hasResults ? buildPerformanceBudgetDiagnosticsSummaryCard() : null;
    const localizationCard = hasResults ? buildLocalizationDiagnosticsSummaryCard() : null;
    const advisoryCards = [performanceCard, localizationCard]
        .filter((card) => card && ['warning', 'error'].includes(card.status));
    const model = diagnosticsViewModelModule.buildDiagnosticsViewModel({
        t: diagnosticsT,
        hasResults,
        running: diagnosticsRunState.running,
        errorMessage: diagnosticsRunState.errorMessage,
        checkedAt: diagnostics?.checkedAt,
        checkedAtLabel: checkedAt,
        pluginVersion: diagnostics?.pluginVersion,
        coreCards,
        advisoryCards
    });
    viewApi.render(summaryHost, model);
    setDiagnosticsWorkspaceBusy(diagnosticsRunState.running);
};

const renderDiagnostics = (diagnostics) => {
    lastDiagnostics = diagnostics || null;
    if (!diagnostics) {
        renderDiagnosticsSummary(null);
        renderChangeHistory(null);
        return;
    }
    renderDiagnosticsSummary(diagnostics);
    renderChangeHistory(diagnostics);
    void refreshSupportBundlePreview({ privacy: 'sanitized', quiet: true });
};

const runDiagnostics = async () => {
    if (diagnosticsRunState.running) {
        return;
    }
    const startedAt = perfNowMs();
    diagnosticsRunState = Object.freeze({ running: true, errorMessage: '' });
    renderDiagnosticsSummary(lastDiagnostics);
    try {
        const diagnostics = await getDiagnostics('full');
        diagnosticsRunState = Object.freeze({ running: false, errorMessage: '' });
        renderDiagnostics(diagnostics);
        runThemeDiagnostics();
        recordPerformanceDiagnosticsSample('settings', 'diagnostics', perfNowMs() - startedAt, {
            source: 'health-check'
        });
    } catch (error) {
        diagnosticsRunState = Object.freeze({
            running: false,
            errorMessage: String(error?.message || error || 'Unknown diagnostics error')
        });
        renderDiagnosticsSummary(lastDiagnostics);
        diagnosticsShowError('Diagnostics failed', error);
    }
};

const retestPerformanceDiagnostics = async () => {
    const buttons = Array.from(document.querySelectorAll('[data-fv-ui-action="diagnostics-retest-performance"]'));
    buttons.forEach((button) => { button.disabled = true; });
    try {
        if (typeof window.FolderViewPlusRefreshCoreData !== 'function') {
            throw new Error('The Settings performance refresh is not available yet.');
        }
        await window.FolderViewPlusRefreshCoreData();
        renderPerformanceDiagnostics();
        renderDiagnosticsSummary(lastDiagnostics);
        void refreshSupportBundlePreview({ privacy: 'sanitized', quiet: true });
        diagnosticsShowToastMessage({
            title: 'Performance retest complete',
            message: 'The health summary now reflects the latest warm Settings measurement.'
        });
    } catch (error) {
        diagnosticsShowError('Performance retest failed', error);
    } finally {
        buttons.forEach((button) => { button.disabled = false; });
    }
};

const repairDiagnostics = async (action, type = '') => {
    try {
        if (action === 'repair_orphaned_members' && !['docker', 'vm'].includes(type)) {
            throw new Error(diagnosticsT('diagnostics.repair.invalid-scope', 'Refresh Diagnostics and select a repair for Docker or VM.'));
        }
        const response = await runDiagnosticAction(action, type, 'full');
        const diagnostics = response?.diagnostics || {};
        renderDiagnostics(diagnostics);
        diagnosticsSwal({
            title: diagnosticsT('diagnostics.repair.complete', 'Repair complete'),
            text: action === 'repair_orphaned_members'
                ? (type === 'docker'
                    ? diagnosticsT('diagnostics.repair.done-docker', 'Removed $1 missing Docker references from $2 folders.', response?.repair?.repairedMemberCount || 0, response?.repair?.repairedFolderCount || 0)
                    : diagnosticsT('diagnostics.repair.done-vm', 'Removed $1 missing VM references from $2 folders.', response?.repair?.repairedMemberCount || 0, response?.repair?.repairedFolderCount || 0))
                : (window.FolderViewPlusI18n?.serverMessage?.(response) || diagnosticsT('diagnostics.repair.finished', 'Repair action finished successfully.')),
            type: 'success'
        });
        await Promise.all([refreshType('docker'), refreshType('vm'), refreshBackups('docker'), refreshBackups('vm')]);
    } catch (error) {
        diagnosticsShowError(diagnosticsT('diagnostics.repair.failed', 'Repair failed'), error);
    }
};

const exportDiagnosticsByMode = async (privacy = 'sanitized') => {
    const mode = privacy === 'full' ? 'full' : 'sanitized';
    try {
        const payload = collectSupportBundleUiTelemetry(await getSupportBundle(mode));
        diagnosticsDownloadFile('FolderView Plus Diagnostics.json', diagnosticsToPrettyJson(payload));
        await trackDiagnosticsEvent({
            eventType: 'diagnostics_export',
            details: {
                privacyMode: mode,
                schemaVersion: payload?.bundleMeta?.schemaVersion || null,
                bundleVersion: payload?.bundleMeta?.bundleVersion || null,
                requestErrors: payload?.uiTelemetry?.requestErrors?.count || 0
            }
        });
    } catch (error) {
        diagnosticsShowError('Diagnostics export failed', error);
    }
};

const exportDiagnostics = () => {
    void exportDiagnosticsByMode('sanitized');
};

const exportFullDiagnostics = () => {
    void exportDiagnosticsByMode('full');
};

const exportSupportBundleByMode = async (privacy = 'sanitized') => {
    const mode = privacy === 'full' ? 'full' : 'sanitized';
    try {
        const bundle = collectSupportBundleUiTelemetry(await getSupportBundle(mode));
        const generatedAt = String(bundle?.bundleMeta?.generatedAt || '').replace(/[:]/g, '-');
        const suffix = generatedAt ? `-${generatedAt}` : '';
        diagnosticsDownloadFile(`FolderView Plus Support Bundle${suffix}.json`, diagnosticsToPrettyJson(bundle));
        await trackDiagnosticsEvent({
            eventType: 'support_bundle_export',
            details: {
                privacyMode: mode,
                schemaVersion: bundle?.bundleMeta?.schemaVersion || null,
                bundleVersion: bundle?.bundleMeta?.bundleVersion || null,
                requestErrors: bundle?.uiTelemetry?.requestErrors?.count || 0
            }
        });
        if (mode === 'sanitized') {
            const previewApi = getSupportBundlePreviewApi();
            if (previewApi) {
                previewApi.setLastSupportBundlePreview(bundle);
            }
            renderSupportBundlePreview(bundle);
        }
    } catch (error) {
        diagnosticsShowError('Support bundle export failed', error);
    }
};

const exportSupportBundle = () => {
    void exportSupportBundleByMode('sanitized');
};

const exportFullSupportBundle = () => {
    void exportSupportBundleByMode('full');
};

const formatIssueReportCount = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
};

const formatIssueReportBackupDetail = (countValue, lastBackup) => {
    const count = formatIssueReportCount(countValue);
    if (!lastBackup || typeof lastBackup !== 'object') {
        return `count=${count}, latest=none`;
    }
    const name = String(lastBackup.name || '').trim() || 'unknown';
    const reason = String(lastBackup.reason || '').trim() || 'unspecified';
    const createdAt = String(lastBackup.createdAt || '').trim() || 'unknown';
    return `count=${count}, latest=${name}, reason=${reason}, createdAt=${createdAt}`;
};

const issueReportFromDiagnostics = (diagnostics) => {
    const report = normalizeSupportBundleV2Payload(diagnostics || {}, diagnostics?.bundleMeta?.privacyMode || 'sanitized');
    const lines = [];
    lines.push('# FolderView Plus Issue Report');
    lines.push(`Generated: ${report.bundleMeta?.generatedAt || new Date().toISOString()}`);
    lines.push(`Plugin version: ${report.bundleMeta?.pluginVersion || 'unknown'}`);
    lines.push(`Bundle version: ${report.bundleMeta?.bundleVersion || 2}`);
    lines.push(`Privacy mode: ${report.bundleMeta?.privacyMode || 'sanitized'}`);
    lines.push('');

    const env = report.system || {};
    lines.push('## Environment');
    lines.push(`- Unraid: ${env.unraidVersion || 'unknown'}`);
    lines.push(`- PHP: ${env.phpVersion || 'unknown'}`);
    lines.push(`- OS: ${env.kernel || 'unknown'}`);
    lines.push('');

    lines.push('## Type Summary');
    for (const type of ['docker', 'vm']) {
        const typeData = report.pluginState?.[type] || {};
        const integrity = report.healthAndHistory?.integrityFindings?.[type] || {};
        const issueCount = formatIssueReportCount(integrity.issuesCount, formatIssueReportCount(integrity.issueCount));
        const counts = typeData.counts || {};
        const folderMeta = typeData.folders || {};
        const prefs = typeData.prefs || {};
        const orphanedMembers = formatIssueReportCount(integrity.orphanedMembers?.count);
        const assignmentConflicts = formatIssueReportCount(integrity.duplicateAssignments?.effective?.count);
        const invalidRules = formatIssueReportCount(integrity.invalidAutoRules?.count);
        const pathIssues = Array.isArray(integrity.pathHealth?.issues) ? integrity.pathHealth.issues : [];
        const pathIssueCount = pathIssues.length;
        lines.push(`- ${type.toUpperCase()}: folders=${formatIssueReportCount(counts.folders)}, rules=${formatIssueReportCount(counts.rules)}, backups=${formatIssueReportCount(counts.backups)}, templates=${formatIssueReportCount(counts.templates)}, issueCount=${issueCount}`);
        lines.push(`  Folder details: file=${folderMeta.path || `${type}.json`}, exists=${folderMeta.exists === false ? 'no' : 'yes'}, manualOrder=${formatIssueReportCount(folderMeta.manualOrderCount, formatIssueReportCount(counts.manualOrder))}, pinned=${formatIssueReportCount(folderMeta.pinnedFolderCount, formatIssueReportCount(counts.pinnedFolders))}`);
        lines.push(`  Rules details: sortMode=${prefs.sortMode || 'created'}, settingsMode=${prefs.settingsMode || 'basic'}, rules=${formatIssueReportCount(counts.rules)}, templates=${formatIssueReportCount(counts.templates)}`);
        lines.push(`  Backup details: ${formatIssueReportBackupDetail(counts.backups, typeData.lastBackup)}`);
        if (issueCount > 0 || orphanedMembers > 0 || assignmentConflicts > 0 || invalidRules > 0 || pathIssueCount > 0) {
            lines.push(`  Integrity details: orphanedMembers=${orphanedMembers}, assignmentConflicts=${assignmentConflicts}, invalidRules=${invalidRules}, pathIssues=${pathIssueCount}`);
        }
    }
    lines.push('');

    const timeline = Array.isArray(report.healthAndHistory?.recentTimeline)
        ? report.healthAndHistory.recentTimeline.slice(0, 15)
        : [];
    lines.push('## Recent Timeline');
    if (!timeline.length) {
        lines.push('- No recent timeline events available.');
    } else {
        for (const row of timeline) {
            lines.push(`- ${row.timestamp || ''} | ${row.action || ''} | ${row.type || '-'} | ${row.status || 'ok'}${row.summary ? ` | ${row.summary}` : ''}`);
        }
    }
    lines.push('');
    const folderEditorDebug = report.uiTelemetry?.folderEditorDebug || null;
    lines.push('## Folder Editor Debug');
    if (!folderEditorDebug) {
        lines.push('- No folder editor debug snapshot available.');
    } else {
        const comparison = folderEditorDebug.comparison || {};
        lines.push(`- Summary: ${comparison.summary || 'No summary available.'}`);
        lines.push(`- Launch target: ${comparison.launchType || '?'} / ${comparison.launchId || '(empty)'}`);
        lines.push(`- Bootstrap route target: ${comparison.bootstrapType || '?'} / ${comparison.bootstrapRouteId || '(empty)'}`);
        lines.push(`- Bootstrap effective target: ${comparison.bootstrapEffectiveId || '(empty)'}`);
        lines.push(`- Bootstrap result: ${comparison.bootstrapResult || '(empty)'}`);
        if (folderEditorDebug.surface) {
            lines.push(`- Bootstrap banner: ${comparison.surfaceTone || '?'} / ${comparison.surfaceSummary || '(empty)'}`);
        }
    }
    lines.push('');
    lines.push('## Notes');
    lines.push('- Attach the v2 support bundle export if available.');
    return lines.join('\n');
};

const initializeClientDiagnosticsPanels = () => {
    renderDiagnosticsSummary(lastDiagnostics);
    const previewApi = getSupportBundlePreviewApi();
    renderSupportBundlePreview(previewApi ? previewApi.getLastSupportBundlePreview() : null);
};

let diagnosticsPreviewHydrationPromise = null;
let diagnosticsPreviewHydratedAt = 0;
const DIAGNOSTICS_PREVIEW_TTL_MS = 2 * 60 * 1000;

const hydrateDiagnosticsPreview = async ({ force = false } = {}) => {
    const age = Date.now() - diagnosticsPreviewHydratedAt;
    if (force !== true && diagnosticsPreviewHydratedAt > 0 && age < DIAGNOSTICS_PREVIEW_TTL_MS) {
        return getSupportBundlePreviewApi()?.getLastSupportBundlePreview?.() || null;
    }
    if (diagnosticsPreviewHydrationPromise) {
        return diagnosticsPreviewHydrationPromise;
    }
    diagnosticsPreviewHydrationPromise = refreshSupportBundlePreview({ privacy: 'sanitized', quiet: true })
        .then((bundle) => {
            if (bundle) {
                diagnosticsPreviewHydratedAt = Date.now();
            }
            return bundle;
        })
        .finally(() => {
            diagnosticsPreviewHydrationPromise = null;
        });
    return diagnosticsPreviewHydrationPromise;
};

window.collectFolderEditorDebugDiagnostics = collectFolderEditorDebugDiagnostics;
window.renderFolderEditorDebugDiagnostics = renderFolderEditorDebugDiagnostics;
window.copyFolderEditorDebugDiagnostics = copyFolderEditorDebugDiagnostics;

const copyIssueReport = async () => {
    try {
        const bundle = collectSupportBundleUiTelemetry(await getSupportBundle('sanitized'));
        const text = issueReportFromDiagnostics(bundle);

        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
        diagnosticsSwal({
            title: 'Copied',
            text: 'Issue report copied to clipboard.',
            type: 'success'
        });
    } catch (error) {
        diagnosticsShowError('Copy issue report failed', error);
    }
};

const THEME_DIAGNOSTIC_TOKENS = Object.freeze([
    '--fvplus-theme-foreground',
    '--fvplus-runtime-theme-foreground',
    '--fvplus-runtime-status-started',
    '--fvplus-runtime-status-paused',
    '--fvplus-runtime-status-stopped',
    '--fvplus-status-started',
    '--fvplus-status-paused',
    '--fvplus-status-stopped',
    '--fvplus-folder-status-started',
    '--fvplus-folder-status-paused',
    '--fvplus-folder-status-stopped',
    '--fvplus-theme-text-primary',
    '--fvplus-theme-text-muted',
    '--fvplus-theme-text-dim',
    '--fvplus-theme-border-subtle',
    '--fvplus-theme-border-faint',
    '--fvplus-theme-surface-muted',
    '--fvplus-theme-surface-strong',
    '--fvplus-theme-surface-panel',
    '--fvplus-theme-accent',
    '--fvplus-theme-accent-soft',
    '--fvplus-theme-focus-ring',
    '--fvplus-settings-text-primary',
    '--fvplus-settings-text-muted',
    '--fvplus-settings-surface-muted',
    '--fvplus-settings-border-subtle',
    '--fvplus-editor-bg',
    '--fvplus-editor-panel',
    '--fvplus-editor-text-primary',
    '--fvplus-editor-muted',
    '--fvplus-editor-border',
    '--fvplus-editor-control-border',
    '--fvplus-editor-input-bg'
]);

const readThemeTokenSnapshot = (styleDeclaration) => {
    const output = {};
    for (const token of THEME_DIAGNOSTIC_TOKENS) {
        output[token] = styleDeclaration ? String(styleDeclaration.getPropertyValue(token) || '').trim() : '';
    }
    return output;
};

const resolveThemeDiagnosticStatusToken = (tokens, statusName = 'started') => {
    const source = tokens && typeof tokens === 'object' ? tokens : {};
    const suffix = String(statusName || 'started').trim() || 'started';
    for (const token of [
        `--fvplus-status-${suffix}`,
        `--fvplus-runtime-status-${suffix}`,
        `--fvplus-folder-status-${suffix}`
    ]) {
        const value = String(source[token] || '').trim();
        if (value) {
            return value;
        }
    }
    return '';
};

const collectThemeDiagnostics = () => {
    const resolverSnapshot = applyDiagnosticsThemeTokens('diagnostics');
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('fv-settings-root');
    const htmlStyle = html ? window.getComputedStyle(html) : null;
    const bodyStyle = body ? window.getComputedStyle(body) : null;
    const rootStyle = root ? window.getComputedStyle(root) : null;
    const firstStartedState = document.querySelector('.folder-state.fv-folder-state-started');
    const firstStoppedState = document.querySelector('.folder-state.fv-folder-state-stopped');
    const firstStartedIcon = document.querySelector('i.folder-load-status.started');
    const firstStoppedIcon = document.querySelector('i.folder-load-status.stopped');
    const customStyleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"][href]'))
        .map((node) => String(node.getAttribute('href') || '').trim())
        .filter((href) => href.includes('/plugins/folderview.plus/'));
    const customScriptLinks = Array.from(document.querySelectorAll('script[src]'))
        .map((node) => String(node.getAttribute('src') || '').trim())
        .filter((src) => src.includes('/plugins/folderview.plus/'));

    const warnings = [], adjustments = [];
    const htmlTokens = readThemeTokenSnapshot(htmlStyle);
    const startedStatusToken = resolveThemeDiagnosticStatusToken(htmlTokens, 'started');
    const stoppedStatusToken = resolveThemeDiagnosticStatusToken(htmlTokens, 'stopped');
    if (!startedStatusToken) {
        warnings.push('Missing started status token value on document root.');
    }
    if (startedStatusToken && stoppedStatusToken && startedStatusToken === stoppedStatusToken) {
        warnings.push('Started and stopped status tokens resolve to the same value.');
    }
    const startedSampleColor = firstStartedState ? window.getComputedStyle(firstStartedState).color : '';
    const stoppedSampleColor = firstStoppedState ? window.getComputedStyle(firstStoppedState).color : '';
    if (startedSampleColor && stoppedSampleColor && startedSampleColor === stoppedSampleColor) {
        warnings.push('Runtime started/stopped state colors currently resolve to the same computed color.');
    }
    if (resolverSnapshot?.autoHealed) adjustments.push(`Theme resolver auto-heal applied mode ${resolverSnapshot.appliedMode}.`);
    if (Array.isArray(resolverSnapshot?.warnings)) warnings.push(...resolverSnapshot.warnings);
    if (Array.isArray(resolverSnapshot?.adjustments)) adjustments.push(...resolverSnapshot.adjustments);

    return {
        generatedAt: new Date().toISOString(),
        page: window.location.pathname || '',
        htmlClassList: html ? Array.from(html.classList) : [],
        bodyClassList: body ? Array.from(body.classList) : [],
        htmlAttributes: html ? {
            dataTheme: html.getAttribute('data-theme') || '',
            dataBsTheme: html.getAttribute('data-bs-theme') || '',
            theme: html.getAttribute('theme') || ''
        } : {},
        bodyAttributes: body ? {
            dataTheme: body.getAttribute('data-theme') || '',
            dataBsTheme: body.getAttribute('data-bs-theme') || '',
            theme: body.getAttribute('theme') || ''
        } : {},
        tokens: {
            html: htmlTokens,
            body: readThemeTokenSnapshot(bodyStyle),
            root: readThemeTokenSnapshot(rootStyle)
        },
        samples: {
            rootBackgroundColor: rootStyle ? String(rootStyle.backgroundColor || '').trim() : '',
            rootTextColor: rootStyle ? String(rootStyle.color || '').trim() : '',
            startedStateColor: startedSampleColor,
            stoppedStateColor: stoppedSampleColor,
            startedIconColor: firstStartedIcon ? window.getComputedStyle(firstStartedIcon).color : '',
            stoppedIconColor: firstStoppedIcon ? window.getComputedStyle(firstStoppedIcon).color : ''
        },
        modeByType: {
            docker: normalizeDiagnosticsThemeMode(prefsByType?.docker?.themeCompatibilityMode),
            vm: normalizeDiagnosticsThemeMode(prefsByType?.vm?.themeCompatibilityMode),
            effective: normalizeDiagnosticsThemeMode(getEffectiveThemeCompatibilityMode())
        },
        resolver: resolverSnapshot,
        runtimeSelectors: {
            startedStateCount: document.querySelectorAll('.folder-state.fv-folder-state-started').length,
            stoppedStateCount: document.querySelectorAll('.folder-state.fv-folder-state-stopped').length,
            startedIconCount: document.querySelectorAll('i.folder-load-status.started').length,
            stoppedIconCount: document.querySelectorAll('i.folder-load-status.stopped').length
        },
        pluginAssets: {
            stylesheets: customStyleLinks,
            scripts: customScriptLinks
        },
        adjustments,
        warnings
    };
};

const runThemeDiagnostics = () => {
    try {
        const diagnostics = collectThemeDiagnostics();
        lastThemeDiagnostics = diagnostics;
        if (lastDiagnostics) {
            renderDiagnosticsSummary(lastDiagnostics);
        }
        return diagnostics;
    } catch (error) {
        diagnosticsShowError('Theme diagnostics failed', error);
        return null;
    }
};

const collectThemeTelemetrySnapshot = () => {
    try {
        lastThemeDiagnostics = collectThemeDiagnostics();
        return lastThemeDiagnostics;
    } catch (_error) {
        return lastThemeDiagnostics || null;
    }
};

const runThemeSelfHeal = async () => {
    try {
        const snapshot = buildDiagnosticsThemeSnapshot('auto');
        const contrastFailures = Array.isArray(snapshot?.contrastChecks)
            ? snapshot.contrastChecks.filter((check) => !check.passed)
            : [];
        const statusFailures = [
            snapshot?.statusChecks?.started,
            snapshot?.statusChecks?.paused,
            snapshot?.statusChecks?.stopped
        ].filter((check) => check && Number(check.ratio || 0) < Number(check.minRatio || 0));
        const needsHeal = contrastFailures.length > 0 || statusFailures.length > 0;
        if (!needsHeal) {
            applyDiagnosticsThemeTokens('self-heal-noop');
            diagnosticsSwal({
                title: 'Theme looks healthy',
                text: 'No fallback changes were needed.',
                type: 'success',
                timer: 1800,
                showConfirmButton: false
            });
            runThemeDiagnostics();
            return;
        }
        const targetMode = contrastFailures.some((check) => check.name === 'textPrimary')
            ? 'highcontrast'
            : 'safe';
        for (const type of ['docker', 'vm']) {
            const current = utils.normalizePrefs(prefsByType[type] || {});
            if (normalizeDiagnosticsThemeMode(current.themeCompatibilityMode) === targetMode) {
                continue;
            }
            const next = {
                ...current,
                themeCompatibilityMode: targetMode
            };
            prefsByType[type] = await postPrefs(type, next);
            renderRuntimeControls(type);
        }
        applyDiagnosticsThemeTokens('self-heal-apply');
        queueSettingsThemeAwareReflow('theme-self-heal');
        runThemeDiagnostics();
        diagnosticsSwal({
            title: 'Theme self-heal applied',
            text: `Fallback mode switched to ${targetMode}.`,
            type: 'success'
        });
    } catch (error) {
        diagnosticsShowError('Theme self-heal failed', error);
    }
};

Object.assign(window, {
    lastDiagnostics,
    ACTIVITY_FEED_MAX_ENTRIES,
    PERF_DIAGNOSTICS_SAMPLE_LIMIT,
    performanceDiagnosticsState,
    perfNowMs,
    recordPerformanceDiagnosticsSample,
    summarizePerformanceDiagnosticsSamples,
    renderPerformanceDiagnostics,
    recordRequestErrorTelemetry,
    getRequestErrorDiagnosticsSnapshot,
    collectClientPerformanceTelemetry,
    getDiagnostics,
    getSupportBundle,
    FolderViewPlusHydrateDiagnosticsPreview: hydrateDiagnosticsPreview,
    runDiagnosticAction,
    trackDiagnosticsEvent,
    fetchPrefs,
    postPrefs,
    diagnosticsPrefsCoordinator,
    createBackup,
    createGlobalRollbackCheckpointApi,
    restorePreviousGlobalRollbackCheckpointApi,
    restoreLatest,
    restoreLatestUndo,
    executeFolderRuntimeAction,
    runScheduledBackup,
    setUpdateStatus,
    setRollbackStatus,
    formatActivityTimestamp,
    renderActivityFeed,
    addActivityEntry,
    clearActivityFeed,
    ADVANCED_MODULE_STATUS_CONFIG,
    ensureAdvancedModuleStatusHost,
    renderAdvancedModuleStatus,
    setAdvancedModuleStatus,
    claimAdvancedOperationLock,
    releaseAdvancedOperationLock,
    withAdvancedOperationLock,
    renderChangeHistory,
    refreshChangeHistory,
    renderDiagnostics,
    runDiagnostics,
    retestPerformanceDiagnostics,
    repairDiagnostics,
    renderDiagnosticsSummary,
    exportDiagnosticsByMode,
    exportDiagnostics,
    exportFullDiagnostics,
    exportSupportBundleByMode,
    exportSupportBundle,
    exportFullSupportBundle,
    issueReportFromDiagnostics,
    copyIssueReport,
    collectThemeDiagnostics,
    runThemeDiagnostics,
    runThemeSelfHeal,
    getCachedDiagnostics,
    collectFolderEditorDebugDiagnostics,
    renderFolderEditorDebugDiagnostics,
    copyFolderEditorDebugDiagnostics
});

window.FolderViewPlusDiagnostics = Object.freeze({
    initialize: () => initializeActivityDiagnosticsRuntime(),
    getDiagnostics,
    getSupportBundle,
    runDiagnosticAction,
    trackDiagnosticsEvent,
    renderActivityFeed,
    addActivityEntry,
    clearActivityFeed,
    setAdvancedModuleStatus,
    claimAdvancedOperationLock,
    releaseAdvancedOperationLock,
    withAdvancedOperationLock,
    renderChangeHistory,
    refreshChangeHistory,
    renderDiagnostics,
    runDiagnostics,
    retestPerformanceDiagnostics,
    repairDiagnostics,
    renderDiagnosticsSummary,
    exportDiagnosticsByMode,
    exportDiagnostics,
    exportFullDiagnostics,
    exportSupportBundleByMode,
    exportSupportBundle,
    exportFullSupportBundle,
    issueReportFromDiagnostics,
    copyIssueReport,
    collectThemeDiagnostics,
    runThemeDiagnostics,
    runThemeSelfHeal,
    getCachedDiagnostics,
    collectFolderEditorDebugDiagnostics,
    renderFolderEditorDebugDiagnostics,
    copyFolderEditorDebugDiagnostics,
    perfNowMs,
    recordPerformanceDiagnosticsSample,
    summarizePerformanceDiagnosticsSamples,
    renderPerformanceDiagnostics,
    recordRequestErrorTelemetry,
    getRequestErrorDiagnosticsSnapshot,
    collectClientPerformanceTelemetry
});
window.FolderViewPlusDiagnosticsModuleLoaded = true;

let activityDiagnosticsInitialized = false;
const initializeActivityDiagnosticsRuntime = () => {
    if (activityDiagnosticsInitialized) return;
    activityDiagnosticsInitialized = true;
    window.addEventListener?.('storage', syncActivityFeedFromStorage);
    document.addEventListener?.('visibilitychange', () => {
        if (!document.hidden) renderActivityFeed();
    });
    const startupActions = [
        ['activity feed', renderActivityFeed],
        ['theme diagnostics', runThemeDiagnostics],
        ['diagnostics panels', initializeClientDiagnosticsPanels]
    ];
    for (const [label, action] of startupActions) {
        try {
            const result = action();
            if (result && typeof result.catch === 'function') {
                result.catch((error) => {
                    diagnosticsShowError(`Unable to initialize ${label}`, error);
                });
            }
        } catch (error) {
            diagnosticsShowError(`Unable to initialize ${label}`, error);
        }
    }
};

})(window, document);
