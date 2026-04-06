const diagnosticsThemeResolver = window.FolderViewPlusThemeResolver || null;
const diagnosticsUtils = window.FolderViewPlusUtils || null;
const supportBundlePreviewModule = window.FolderViewPlusSupportBundlePreview || null;
const supportBundleTelemetryModule = window.FolderViewPlusSupportBundleTelemetry || null;
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
        : { requestedMode: 'auto', appliedMode: 'auto', classification: 'mixed', autoHealed: false, contrastChecks: [], statusChecks: {}, tokens: {}, warnings: [] }
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
const DIAGNOSTICS_STATUS_CONFIG = Object.freeze({
    healthy: Object.freeze({ label: 'Healthy', icon: 'fa-check-circle' }),
    warning: Object.freeze({ label: 'Follow up', icon: 'fa-exclamation-triangle' }),
    error: Object.freeze({ label: 'Needs action', icon: 'fa-times-circle' })
});
const DIAGNOSTICS_ACTION_CONFIG = Object.freeze({
    sync_docker_order: Object.freeze({
        label: 'Rebuild Docker order index',
        icon: 'fa-sort',
        handler: "repairDiagnostics('sync_docker_order')"
    }),
    normalize_prefs: Object.freeze({
        label: 'Validate and normalize prefs',
        icon: 'fa-wrench',
        handler: "repairDiagnostics('normalize_prefs')"
    }),
    repair_paths: Object.freeze({
        label: 'Repair plugin paths',
        icon: 'fa-folder-open',
        handler: "repairDiagnostics('repair_paths')"
    }),
    repair_missing_custom_icons: Object.freeze({
        label: 'Reset missing custom icon refs',
        icon: 'fa-picture-o',
        handler: "repairDiagnostics('repair_missing_custom_icons')"
    }),
    repair_orphaned_members: Object.freeze({
        label: 'Remove orphaned member refs',
        icon: 'fa-chain-broken',
        handler: "repairDiagnostics('repair_orphaned_members')"
    }),
    run_theme_self_heal: Object.freeze({
        label: 'Theme self-heal now',
        icon: 'fa-magic',
        handler: 'runThemeSelfHeal()'
    })
});
const ACTIVITY_FEED_MAX_ENTRIES = 12;
const PERF_DIAGNOSTICS_SAMPLE_LIMIT = 30;
const REQUEST_ERROR_DIAGNOSTICS_LIMIT = 40;
const performanceDiagnosticsState = {
    refresh: { docker: [], vm: [] },
    import: { docker: [], vm: [] },
    wizard: { apply: [] },
    settings: { bootstrap: [], diagnostics: [] },
    updatedAt: 0
};
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
    host.text(toPrettyJson(snapshot));
    return snapshot;
};

const copyFolderEditorDebugDiagnostics = async () => {
    try {
        const snapshot = renderFolderEditorDebugDiagnostics();
        const text = toPrettyJson(snapshot);
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
        swal({
            title: 'Copied',
            text: 'Folder editor diagnostics copied to clipboard.',
            type: 'success'
        });
    } catch (error) {
        showError('Copy folder editor diagnostics failed', error);
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
    if (bucket === 'refresh' || bucket === 'import') {
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
    target.push({
        at: Date.now(),
        durationMs: Number(duration.toFixed(2)),
        details: details && typeof details === 'object' ? details : {}
    });
    if (target.length > PERF_DIAGNOSTICS_SAMPLE_LIMIT) {
        target.splice(0, target.length - PERF_DIAGNOSTICS_SAMPLE_LIMIT);
    }
    performanceDiagnosticsState.updatedAt = Date.now();
    renderPerformanceDiagnostics();
};

const summarizePerformanceDiagnosticsSamples = (samples) => {
    const list = Array.isArray(samples) ? samples : [];
    if (!list.length) {
        return null;
    }
    const durations = list
        .map((row) => Number(row?.durationMs))
        .filter((value) => Number.isFinite(value) && value >= 0);
    if (!durations.length) {
        return null;
    }
    const total = durations.reduce((sum, value) => sum + value, 0);
    return {
        count: durations.length,
        lastMs: Number(durations[durations.length - 1].toFixed(2)),
        avgMs: Number((total / durations.length).toFixed(2)),
        maxMs: Number(Math.max(...durations).toFixed(2))
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

const collectClientPerformanceTelemetry = () => ({
    updatedAt: performanceDiagnosticsState.updatedAt > 0
        ? new Date(performanceDiagnosticsState.updatedAt).toISOString()
        : '',
    settings: {
        refresh: {
            docker: summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.refresh.docker),
            vm: summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.refresh.vm)
        },
        import: {
            docker: summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.import.docker),
            vm: summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.import.vm)
        },
        wizardApply: summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.wizard.apply),
        settingsBootstrap: summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.settings.bootstrap),
        diagnosticsRefresh: summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.settings.diagnostics)
    },
    runtime: getRuntimePerfTelemetrySnapshot(),
    requestErrors: getRequestErrorDiagnosticsSnapshot()
});

const renderPerformanceDiagnostics = () => {
    const host = $('#performance-diagnostics-output');
    if (!host.length) {
        return;
    }
    const renderRow = (label, summary) => {
        if (!summary) {
            return `<tr><th>${escapeHtml(label)}</th><td colspan="4">No samples yet</td></tr>`;
        }
        return `<tr><th>${escapeHtml(label)}</th><td>${summary.count}</td><td>${summary.lastMs}ms</td><td>${summary.avgMs}ms</td><td>${summary.maxMs}ms</td></tr>`;
    };
    const rows = [
        renderRow('Docker refresh', summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.refresh.docker)),
        renderRow('VM refresh', summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.refresh.vm)),
        renderRow('Docker import', summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.import.docker)),
        renderRow('VM import', summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.import.vm)),
        renderRow('Wizard apply', summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.wizard.apply)),
        renderRow('Settings bootstrap', summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.settings.bootstrap)),
        renderRow('Diagnostics refresh', summarizePerformanceDiagnosticsSamples(performanceDiagnosticsState.settings.diagnostics))
    ].join('');
    const runtimeSnapshot = getRuntimePerfTelemetrySnapshot();
    const updatedAt = performanceDiagnosticsState.updatedAt > 0
        ? new Date(performanceDiagnosticsState.updatedAt).toLocaleString()
        : 'Not yet sampled';
    host.html(`
        <div class="fv-perf-summary-note">Recent UI operation timings from this browser session.</div>
        <table class="fv-perf-table">
            <thead>
                <tr><th>Operation</th><th>Samples</th><th>Last</th><th>Avg</th><th>Max</th></tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
        <div class="fv-perf-summary-note">Runtime telemetry: Docker actions ${escapeHtml(String(Object.keys(runtimeSnapshot.docker || {}).length))}, VM actions ${escapeHtml(String(Object.keys(runtimeSnapshot.vm || {}).length))}</div>
        <div class="fv-perf-summary-note">Updated: ${escapeHtml(updatedAt)}</div>
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
            collectFolderEditorDebugDiagnostics,
            collectThemeTelemetrySnapshot,
            readClientDiagnosticsStorageRecord,
            storageKeys: {
                launch: EDITOR_DEBUG_LAUNCH_STORAGE_KEY,
                bootstrap: EDITOR_DEBUG_BOOTSTRAP_STORAGE_KEY,
                surface: EDITOR_DEBUG_SURFACE_STORAGE_KEY
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
        requestErrors: getRequestErrorDiagnosticsSnapshot(),
        browserConsoleErrors: fatalBanner && typeof fatalBanner.getBrowserConsoleErrorSnapshot === 'function'
            ? fatalBanner.getBrowserConsoleErrorSnapshot()
            : { count: 0, entries: [] },
        folderEditorDebug: collectFolderEditorDebugDiagnostics(),
        theme: collectThemeTelemetrySnapshot()
    };
    return payload;
};

const getSupportBundlePreviewApi = () => {
    if (!supportBundlePreviewApi && supportBundlePreviewModule && typeof supportBundlePreviewModule.createApi === 'function') {
        supportBundlePreviewApi = supportBundlePreviewModule.createApi({
            $,
            escapeHtml,
            formatCheckedAtLabel,
            normalizeSupportBundleV2Payload,
            getSupportBundle,
            showError
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
    if (activityMessage) {
        addActivityEntry(activityMessage, statusValue === 'ok' ? 'info' : 'error');
        if (statusValue === 'ok' && ['import', 'clear_folders', 'delete_folder', 'runtime_bulk_action', 'bulk_assign'].includes(String(eventType))) {
            showToastMessage({
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
    try {
        const response = await apiGetJson(`/plugins/folderview.plus/server/prefs.php?type=${type}`);
        if (response.ok && response.prefs) {
            return utils.normalizePrefs(response.prefs);
        }
    } catch (error) {
        // Keep defaults.
    }
    return utils.normalizePrefs({});
};

const postPrefs = async (type, prefs) => {
    const response = await apiPostJson('/plugins/folderview.plus/server/prefs.php', {
        type,
        prefs: JSON.stringify(prefs)
    });
    if (!response.ok) {
        throw new Error(response.error || 'Failed to save preferences.');
    }
    latestPrefsBackupByType[type] = response.backup || null;
    return utils.normalizePrefs(response.prefs || prefs);
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
    const response = await apiPostJson('/plugins/folderview.plus/server/backup.php', {
        type: resolvedType,
        action: 'restore_latest'
    });
    if (!response.ok) {
        throw new Error(response.error || 'Restore failed.');
    }
    return response.restore;
};

const restoreLatestUndo = async (type) => {
    const resolvedType = normalizeManagedType(type);
    assertRuntimeConflictActionAllowed(`Undo latest ${resolvedType === 'docker' ? 'Docker' : 'VM'} restore`);
    const response = await apiPostJson('/plugins/folderview.plus/server/backup.php', {
        type: resolvedType,
        action: 'restore_latest_undo'
    });
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

const syncDockerOrder = async () => {
    await apiPostText('/plugins/folderview.plus/server/sync_order.php', { type: 'docker' });
};

const setUpdateStatus = (text) => {
    $('#update-check-status').text(text || '');
};

const setRollbackStatus = (text) => {
    $('#rollback-status').text(text || '');
};

const formatActivityTimestamp = (at) => {
    const date = new Date(Number(at) || Date.now());
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const renderActivityFeed = () => {
    const panel = $('#fv-activity-feed-panel');
    const list = $('#fv-activity-feed-list');
    if (!panel.length || !list.length) {
        return;
    }
    if (!activityFeedEntries.length) {
        panel.hide();
        list.empty();
        return;
    }
    const rows = activityFeedEntries.map((entry) => {
        const level = String(entry?.level || 'info');
        return `<li class="fv-activity-item is-${escapeHtml(level)}"><span class="fv-activity-time">${escapeHtml(formatActivityTimestamp(entry.at))}</span><span class="fv-activity-text">${escapeHtml(String(entry.message || ''))}</span></li>`;
    }).join('');
    list.html(rows);
    panel.show();
};

const addActivityEntry = (message, level = 'info') => {
    const text = String(message || '').trim();
    if (!text) {
        return;
    }
    activityFeedEntries.unshift({
        at: Date.now(),
        level: String(level || 'info'),
        message: text
    });
    if (activityFeedEntries.length > ACTIVITY_FEED_MAX_ENTRIES) {
        activityFeedEntries = activityFeedEntries.slice(0, ACTIVITY_FEED_MAX_ENTRIES);
    }
    renderActivityFeed();
};

const clearActivityFeed = () => {
    activityFeedEntries = [];
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
        anchorSelector: '#change-history-output',
        label: 'Change history'
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
        const header = panel.querySelector('.rules-header');
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
        host.innerHTML = `<i class="fa fa-refresh fa-spin"></i> Refreshing ${escapeHtml(config.label)}...`;
        host.style.display = '';
        return;
    }
    if (status.state === 'error') {
        const message = String(status.message || 'Refresh failed.');
        host.classList.remove('is-info');
        host.classList.add('is-error');
        host.innerHTML = `${escapeHtml(config.label)} failed: ${escapeHtml(message)} <button type="button" data-fv-advanced-module-retry="${escapeHtml(moduleKey)}"><i class="fa fa-repeat"></i> Retry</button>`;
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
        swal({
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

const getRecoveryTimelineStatusClass = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'error' || normalized === 'failed' || normalized === 'fatal') {
        return 'is-danger';
    }
    if (normalized === 'warning' || normalized === 'degraded' || normalized === 'partial') {
        return 'is-warning';
    }
    return 'is-healthy';
};

const renderRecoveryChangeHistoryFromDiagnostics = (diagnostics = lastDiagnostics) => {
    const summaryHost = $('#fv-recovery-change-history-summary');
    const listHost = $('#recovery-change-history-list');
    if (!summaryHost.length || !listHost.length) {
        return;
    }

    const activeType = (typeof window.getActiveRecoveryWorkspaceType === 'function' && window.getActiveRecoveryWorkspaceType() === 'vm')
        ? 'vm'
        : 'docker';
    const typeLabel = activeType === 'docker' ? 'Docker' : 'VM';
    const timeline = Array.isArray(diagnostics?.recentTimeline) ? diagnostics.recentTimeline : [];
    const filteredTimeline = timeline.filter((row) => {
        const rowType = String(row?.type || '').trim().toLowerCase();
        return !rowType || rowType === activeType;
    });

    if (!filteredTimeline.length) {
        summaryHost.html(`
            <div class="fv-recovery-empty-state">
                <strong>No recent ${escapeHtml(typeLabel)} changes found.</strong>
                <span>Refresh history after a save, import, restore, or undo to review the latest recovery-safe events.</span>
            </div>
        `);
        listHost.html(`
            <div class="fv-recovery-empty-state">
                <strong>No timeline entries yet.</strong>
                <span>Recent change cards will appear here for the selected recovery source.</span>
            </div>
        `);
        return;
    }

    const latest = filteredTimeline[0] || {};
    const latestStatus = String(latest.status || 'ok').trim() || 'ok';
    const latestAction = String(latest.action || 'Recent change').trim() || 'Recent change';
    const latestSummary = String(latest.summary || '').trim();
    summaryHost.html(`
        <div class="fv-recovery-undo-head">
            <div>
                <div class="fv-recovery-undo-title">Latest ${escapeHtml(typeLabel)} change</div>
                <div class="fv-recovery-undo-copy">${escapeHtml(latestAction)}${latestSummary ? ` - ${escapeHtml(latestSummary)}` : ''}</div>
            </div>
            <span class="fv-rules-status-chip ${getRecoveryTimelineStatusClass(latestStatus)}">${escapeHtml(latestStatus)}</span>
        </div>
        <div class="fv-recovery-undo-meta">
            <span>${escapeHtml(formatActivityTimestamp(latest.timestamp || ''))}</span>
            <span>Undo latest change restores the newest undo-safe backup for ${escapeHtml(typeLabel)}.</span>
        </div>
    `);

    listHost.html(filteredTimeline.slice(0, 12).map((row) => {
        const status = String(row?.status || 'ok').trim() || 'ok';
        const action = String(row?.action || 'Recent change').trim() || 'Recent change';
        const summary = String(row?.summary || '').trim();
        const timestamp = formatActivityTimestamp(row?.timestamp || '');
        return `
            <article class="fv-recovery-timeline-card">
                <div class="fv-recovery-timeline-head">
                    <div class="fv-recovery-timeline-title">${escapeHtml(action)}</div>
                    <span class="fv-rules-status-chip ${getRecoveryTimelineStatusClass(status)}">${escapeHtml(status)}</span>
                </div>
                <div class="fv-recovery-timeline-meta">${escapeHtml(timestamp)}</div>
                <div class="fv-recovery-timeline-copy">${escapeHtml(summary || 'No extra detail was recorded for this change.')}</div>
            </article>
        `;
    }).join(''));
};

const renderChangeHistory = (diagnostics) => {
    const timeline = Array.isArray(diagnostics?.recentTimeline) ? diagnostics.recentTimeline : [];
    if ($('#change-history-output').length) {
        if (!timeline.length) {
            $('#change-history-output').text('No recent changes found.');
        } else {
            const lines = [];
            lines.push(`Recent events: ${timeline.length}`);
            lines.push('');
            for (const row of timeline.slice(0, 40)) {
                const ts = row.timestamp || '';
                const action = row.action || '';
                const type = row.type || '-';
                const status = row.status || 'ok';
                const summary = row.summary ? ` | ${row.summary}` : '';
                lines.push(`${ts} | ${action} | ${type} | ${status}${summary}`);
            }
            $('#change-history-output').text(`${lines.join('\n')}\n`);
        }
    }
    renderRecoveryChangeHistoryFromDiagnostics(diagnostics);
};

const refreshChangeHistory = async ({ quiet = false } = {}) => {
    const startedAt = perfNowMs();
    setAdvancedModuleStatus('change_history', 'loading');
    try {
        const diagnostics = await getDiagnostics('sanitized');
        renderDiagnostics(diagnostics);
        renderChangeHistory(diagnostics);
        recordPerformanceDiagnosticsSample('settings', 'diagnostics', perfNowMs() - startedAt, {
            source: 'change-history'
        });
        markAdvancedModuleLoadSuccess('change_history');
    } catch (error) {
        markAdvancedModuleLoadError('change_history', error);
        if (!quiet) {
            showError('Change history refresh failed', error);
        }
        return false;
    }
    return true;
};

const normalizeDiagnosticsStatus = (value) => {
    const status = String(value || '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(DIAGNOSTICS_STATUS_CONFIG, status) ? status : 'healthy';
};

const formatCheckedAtLabel = (value) => {
    const date = new Date(String(value || '').trim());
    if (Number.isNaN(date.getTime())) {
        return 'just now';
    }
    return date.toLocaleString();
};

const buildThemeDiagnosticsSummaryCard = () => {
    if (!lastThemeDiagnostics || typeof lastThemeDiagnostics !== 'object') {
        return null;
    }
    const warnings = Array.isArray(lastThemeDiagnostics.warnings)
        ? lastThemeDiagnostics.warnings.map((warning) => String(warning || '').trim()).filter(Boolean)
        : [];
    const resolver = lastThemeDiagnostics.resolver && typeof lastThemeDiagnostics.resolver === 'object'
        ? lastThemeDiagnostics.resolver
        : {};
    const status = warnings.length > 0 || resolver.autoHealed === true ? 'warning' : 'healthy';
    const appliedMode = String(resolver.appliedMode || '').trim() || normalizeDiagnosticsThemeMode(lastThemeDiagnostics.modeByType?.effective);
    return {
        key: 'theme',
        label: 'Theme',
        status,
        headline: status === 'warning'
            ? (warnings[0] || `Theme fallback mode ${appliedMode || 'safe'} is active.`)
            : 'Theme diagnostics look healthy.',
        detail: appliedMode
            ? `Effective mode: ${appliedMode}.`
            : 'Theme compatibility checks did not report any warnings.',
        count: warnings.length,
        recommendedAction: status === 'warning' ? 'run_theme_self_heal' : ''
    };
};

const resolveDiagnosticsRecommendedActions = (diagnostics) => {
    const summary = diagnostics?.summary && typeof diagnostics.summary === 'object' ? diagnostics.summary : {};
    const actions = Array.isArray(summary.recommendedActions) ? [...summary.recommendedActions] : [];
    const themeCard = buildThemeDiagnosticsSummaryCard();
    if (themeCard?.recommendedAction) {
        actions.push({
            action: themeCard.recommendedAction,
            label: 'Theme self-heal now',
            reason: themeCard.headline
        });
    }
    const deduped = [];
    const seen = new Set();
    for (const action of actions) {
        const key = String(action?.action || '').trim();
        if (!key || seen.has(key)) {
            continue;
        }
        seen.add(key);
        deduped.push({
            action: key,
            label: String(action?.label || DIAGNOSTICS_ACTION_CONFIG[key]?.label || 'Run fix'),
            reason: String(action?.reason || '').trim()
        });
    }
    const repairPathsAction = deduped.find((action) => action.action === 'repair_paths');
    const repairMissingIconsAction = deduped.find((action) => action.action === 'repair_missing_custom_icons');
    if (repairPathsAction && repairMissingIconsAction) {
        repairMissingIconsAction.parentAction = 'repair_paths';
    }
    return deduped;
};

const renderDiagnosticsActionCards = (actions) => {
    const actionHost = $('#fv-diagnostics-actions');
    if (!actionHost.length) {
        return;
    }
    if (!Array.isArray(actions) || actions.length === 0) {
        actionHost.html(`
            <div class="fv-diagnostics-empty-state is-compact">
                <strong>No repair actions are recommended right now.</strong>
                <span>The current health check does not suggest any one-click fixes.</span>
            </div>
        `);
        return;
    }

    const grouped = [];
    const byAction = new Map();
    for (const action of actions) {
        const entry = { ...action, children: [] };
        byAction.set(action.action, entry);
    }
    for (const action of actions) {
        const entry = byAction.get(action.action);
        if (!entry) {
            continue;
        }
        const parentKey = String(action.parentAction || '').trim();
        if (parentKey && parentKey !== action.action && byAction.has(parentKey)) {
            byAction.get(parentKey).children.push(entry);
            continue;
        }
        grouped.push(entry);
    }

    actionHost.html(grouped.map((action) => {
        const buttonConfigs = [action, ...(Array.isArray(action.children) ? action.children : [])]
            .map((entry) => ({
                action: entry.action,
                config: DIAGNOSTICS_ACTION_CONFIG[entry.action] || DIAGNOSTICS_ACTION_CONFIG.normalize_prefs
            }));
        return `
            <div class="fv-diagnostics-action-card">
                <div class="fv-diagnostics-action-title">${escapeHtml(action.label)}</div>
                <div class="fv-diagnostics-action-copy">${escapeHtml(action.reason || 'Recommended based on the latest health check.')}</div>
                <div class="backup-actions">
                    ${buttonConfigs.map(({ config }) => `
                        <button type="button" onclick="${config.handler}"><i class="fa ${config.icon}"></i> ${escapeHtml(config.label)}</button>
                    `).join('')}
                </div>
            </div>
        `;
    }).join(''));
};

const renderDiagnosticsSummary = (diagnostics) => {
    const summaryHost = $('#fv-diagnostics-summary');
    if (!summaryHost.length) {
        return;
    }
    const themeCard = buildThemeDiagnosticsSummaryCard();
    if (!diagnostics || typeof diagnostics !== 'object') {
        if (!themeCard) {
            summaryHost.html(`
                <div class="fv-diagnostics-empty-state">
                    <strong>Run health check to inspect the plugin state.</strong>
                    <span>The summary will call out Docker, VM, storage, icon, and update issues without dumping raw JSON first.</span>
                </div>
            `);
            renderDiagnosticsActionCards([]);
            return;
        }

        const status = normalizeDiagnosticsStatus(themeCard.status);
        const config = DIAGNOSTICS_STATUS_CONFIG[status];
        const countValue = Number(themeCard.count);
        const themeCheckedAt = formatCheckedAtLabel(lastThemeDiagnostics?.generatedAt);
        summaryHost.html(`
            <div class="fv-diagnostics-overview is-${status}">
                <div class="fv-diagnostics-overview-label"><i class="fa ${config.icon}" aria-hidden="true"></i>${escapeHtml(config.label)}</div>
                <div class="fv-diagnostics-overview-headline">Theme diagnostics are live before a full health check.</div>
                <div class="fv-diagnostics-overview-detail">Run health check to refresh Docker, VM, storage, icon, and update cards. The theme card below updates immediately on page load.</div>
                <div class="fv-diagnostics-overview-meta">
                    <span class="fv-diagnostics-pill">Theme checked ${escapeHtml(themeCheckedAt)}</span>
                </div>
            </div>
            <div class="fv-diagnostics-card-grid">
                <div class="fv-diagnostics-card is-${status}">
                    <div class="fv-diagnostics-card-top">
                        <span class="fv-diagnostics-card-label">${escapeHtml(String(themeCard.label || themeCard.key || 'Theme'))}</span>
                        <span class="fv-diagnostics-card-badge"><i class="fa ${config.icon}" aria-hidden="true"></i>${escapeHtml(config.label)}</span>
                    </div>
                    <div class="fv-diagnostics-card-headline">${escapeHtml(String(themeCard.headline || 'No summary available.'))}</div>
                    <div class="fv-diagnostics-card-detail">${escapeHtml(String(themeCard.detail || ''))}</div>
                    <div class="fv-diagnostics-card-meta">${Number.isFinite(countValue) && countValue > 0 ? `${countValue} related issue${countValue === 1 ? '' : 's'}` : 'No extra action needed'}</div>
                </div>
            </div>
        `);
        renderDiagnosticsActionCards(resolveDiagnosticsRecommendedActions({ summary: { recommendedActions: [] } }));
        return;
    }

    const summary = diagnostics.summary && typeof diagnostics.summary === 'object' ? diagnostics.summary : {};
    const cards = Array.isArray(summary.cards) ? [...summary.cards] : [];
    if (themeCard) {
        cards.push(themeCard);
    }

    const themeWarningCount = themeCard?.status === 'warning' ? 1 : 0;
    const themeErrorCount = themeCard?.status === 'error' ? 1 : 0;
    const errorCount = (Number(summary.errorCount) || 0) + themeErrorCount;
    const warningCount = (Number(summary.warningCount) || 0) + themeWarningCount;
    const overallStatus = normalizeDiagnosticsStatus(
        errorCount > 0 ? 'error' : (warningCount > 0 ? 'warning' : summary.status)
    );
    const overallConfig = DIAGNOSTICS_STATUS_CONFIG[overallStatus];
    const checkedAt = formatCheckedAtLabel(diagnostics.checkedAt);
    const totalIssues = Number(summary.totalIssues) || 0;
    const overallHeadline = themeCard?.status === 'warning' && totalIssues <= 0 && (Number(summary.warningCount) || 0) <= 0
        ? 'Plugin is healthy, but theme follow-up is recommended.'
        : String(summary.headline || 'Diagnostics summary is ready.');
    const overallDetail = themeCard?.status === 'warning' && totalIssues <= 0 && (Number(summary.warningCount) || 0) <= 0
        ? String(themeCard.headline || summary.detail || 'Review the theme warning and apply self-heal if needed.')
        : String(summary.detail || 'Review the cards below for the current plugin state.');
    const pills = [
        totalIssues > 0 ? `${totalIssues} issue${totalIssues === 1 ? '' : 's'}` : '',
        errorCount > 0 ? `${errorCount} error card${errorCount === 1 ? '' : 's'}` : '',
        warningCount > 0 ? `${warningCount} warning card${warningCount === 1 ? '' : 's'}` : '',
        `Checked ${checkedAt}`
    ].filter(Boolean);
    const cardsHtml = cards.map((card) => {
        const status = normalizeDiagnosticsStatus(card?.status);
        const config = DIAGNOSTICS_STATUS_CONFIG[status];
        const countValue = Number(card?.count);
        return `
            <div class="fv-diagnostics-card is-${status}">
                <div class="fv-diagnostics-card-top">
                    <span class="fv-diagnostics-card-label">${escapeHtml(String(card?.label || card?.key || 'Status'))}</span>
                    <span class="fv-diagnostics-card-badge"><i class="fa ${config.icon}" aria-hidden="true"></i>${escapeHtml(config.label)}</span>
                </div>
                <div class="fv-diagnostics-card-headline">${escapeHtml(String(card?.headline || 'No summary available.'))}</div>
                <div class="fv-diagnostics-card-detail">${escapeHtml(String(card?.detail || ''))}</div>
                <div class="fv-diagnostics-card-meta">${Number.isFinite(countValue) && countValue > 0 ? `${countValue} related issue${countValue === 1 ? '' : 's'}` : 'No extra action needed'}</div>
            </div>
        `;
    }).join('');

    summaryHost.html(`
        <div class="fv-diagnostics-overview is-${overallStatus}">
            <div class="fv-diagnostics-overview-label"><i class="fa ${overallConfig.icon}" aria-hidden="true"></i>${escapeHtml(overallConfig.label)}</div>
            <div class="fv-diagnostics-overview-headline">${escapeHtml(overallHeadline)}</div>
            <div class="fv-diagnostics-overview-detail">${escapeHtml(overallDetail)}</div>
            <div class="fv-diagnostics-overview-meta">${pills.map((pill) => `<span class="fv-diagnostics-pill">${escapeHtml(pill)}</span>`).join('')}</div>
        </div>
        <div class="fv-diagnostics-card-grid">${cardsHtml}</div>
    `);

    renderDiagnosticsActionCards(resolveDiagnosticsRecommendedActions(diagnostics));
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
    const startedAt = perfNowMs();
    try {
        const diagnostics = await getDiagnostics();
        renderDiagnostics(diagnostics);
        runThemeDiagnostics();
        recordPerformanceDiagnosticsSample('settings', 'diagnostics', perfNowMs() - startedAt, {
            source: 'health-check'
        });
    } catch (error) {
        showError('Diagnostics failed', error);
    }
};

const repairDiagnostics = async (action, type = '') => {
    try {
        const response = await runDiagnosticAction(action, type);
        const diagnostics = response?.diagnostics || {};
        renderDiagnostics(diagnostics);
        swal({
            title: 'Repair complete',
            text: String(response?.message || 'Repair action finished successfully.'),
            type: 'success'
        });
        await Promise.all([refreshType('docker'), refreshType('vm'), refreshBackups('docker'), refreshBackups('vm')]);
    } catch (error) {
        showError('Repair failed', error);
    }
};

const exportDiagnosticsByMode = async (privacy = 'sanitized') => {
    const mode = privacy === 'full' ? 'full' : 'sanitized';
    try {
        const payload = collectSupportBundleUiTelemetry(await getSupportBundle(mode));
        downloadFile('FolderView Plus Diagnostics.json', toPrettyJson(payload));
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
        showError('Diagnostics export failed', error);
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
        downloadFile(`FolderView Plus Support Bundle${suffix}.json`, toPrettyJson(bundle));
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
        showError('Support bundle export failed', error);
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
    void refreshSupportBundlePreview({ privacy: 'sanitized', quiet: true });
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
        swal({
            title: 'Copied',
            text: 'Issue report copied to clipboard.',
            type: 'success'
        });
    } catch (error) {
        showError('Copy issue report failed', error);
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

    const warnings = [];
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
    if (resolverSnapshot?.autoHealed) {
        warnings.push(`Theme resolver auto-heal applied mode ${resolverSnapshot.appliedMode}.`);
    }
    if (Array.isArray(resolverSnapshot?.warnings)) {
        warnings.push(...resolverSnapshot.warnings);
    }

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
        showError('Theme diagnostics failed', error);
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
        const needsHeal = contrastFailures.length > 0 || statusFailures.length > 0 || snapshot?.autoHealed === true;
        if (!needsHeal) {
            applyDiagnosticsThemeTokens('self-heal-noop');
            swal({
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
        swal({
            title: 'Theme self-heal applied',
            text: `Fallback mode switched to ${targetMode}.`,
            type: 'success'
        });
    } catch (error) {
        showError('Theme self-heal failed', error);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        runThemeDiagnostics();
        initializeClientDiagnosticsPanels();
    }, { once: true });
} else {
    runThemeDiagnostics();
    initializeClientDiagnosticsPanels();
}

Object.assign(window, {
    lastDiagnostics,
    ACTIVITY_FEED_MAX_ENTRIES,
    PERF_DIAGNOSTICS_SAMPLE_LIMIT,
    performanceDiagnosticsState,
    perfNowMs,
    recordPerformanceDiagnosticsSample,
    renderPerformanceDiagnostics,
    recordRequestErrorTelemetry,
    getRequestErrorDiagnosticsSnapshot,
    collectClientPerformanceTelemetry,
    getDiagnostics,
    getSupportBundle,
    runDiagnosticAction,
    trackDiagnosticsEvent,
    fetchPrefs,
    postPrefs,
    createBackup,
    createGlobalRollbackCheckpointApi,
    restorePreviousGlobalRollbackCheckpointApi,
    restoreLatest,
    restoreLatestUndo,
    executeFolderRuntimeAction,
    runScheduledBackup,
    syncDockerOrder,
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
    renderRecoveryChangeHistoryFromDiagnostics,
    refreshChangeHistory,
    renderDiagnostics,
    runDiagnostics,
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
    renderRecoveryChangeHistoryFromDiagnostics,
    refreshChangeHistory,
    renderDiagnostics,
    runDiagnostics,
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
    renderPerformanceDiagnostics,
    recordRequestErrorTelemetry,
    getRequestErrorDiagnosticsSnapshot,
    collectClientPerformanceTelemetry
});
window.FolderViewPlusDiagnosticsModuleLoaded = true;
