/* Activity feed and diagnostics helpers extracted from folderviewplus.js. */
let lastDiagnostics = null;
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
    return response.bundle || {};
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
    return response.diagnostics || {};
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


const renderChangeHistory = (diagnostics) => {
    const timeline = Array.isArray(diagnostics?.recentTimeline) ? diagnostics.recentTimeline : [];
    if (!timeline.length) {
        $('#change-history-output').text('No recent changes found.');
        return;
    }
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

const renderDiagnostics = (diagnostics) => {
    lastDiagnostics = diagnostics || null;
    if (!diagnostics) {
        $('#diagnostics-output').text('No diagnostics data.');
        renderChangeHistory(null);
        return;
    }
    $('#diagnostics-output').text(toPrettyJson(diagnostics));
    renderChangeHistory(diagnostics);
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

const repairDiagnostics = async (action) => {
    try {
        const diagnostics = await runDiagnosticAction(action);
        renderDiagnostics(diagnostics);
        swal({
            title: 'Repair complete',
            text: 'Repair action finished successfully.',
            type: 'success'
        });
        await Promise.all([refreshType('docker'), refreshType('vm'), refreshBackups('docker'), refreshBackups('vm')]);
    } catch (error) {
        showError('Repair failed', error);
    }
};

const exportDiagnosticsByMode = async (privacy = 'sanitized') => {
    const mode = privacy === 'full' ? 'full' : 'sanitized';
    let diagnostics = null;

    const cachedMode = (lastDiagnostics?.privacyMode || 'sanitized');
    if (lastDiagnostics && cachedMode === mode) {
        diagnostics = lastDiagnostics;
    }

    if (!diagnostics) {
        try {
            diagnostics = await getDiagnostics(mode);
            renderDiagnostics(diagnostics);
        } catch (error) {
            if (lastDiagnostics) {
                diagnostics = lastDiagnostics;
            } else {
                diagnostics = {
                    schemaVersion: 2,
                    privacyMode: mode,
                    checkedAt: new Date().toISOString(),
                    error: error?.message || String(error)
                };
            }
        }
    }

    const payload = (diagnostics && typeof diagnostics === 'object') ? { ...diagnostics } : {};
    const existingClientTelemetry = (
        payload.clientTelemetry && typeof payload.clientTelemetry === 'object' && !Array.isArray(payload.clientTelemetry)
    ) ? { ...payload.clientTelemetry } : {};
    existingClientTelemetry.performance = collectClientPerformanceTelemetry();
    existingClientTelemetry.requestErrors = getRequestErrorDiagnosticsSnapshot();
    payload.clientTelemetry = existingClientTelemetry;

    downloadFile('FolderView Plus Diagnostics.json', toPrettyJson(payload));
    trackDiagnosticsEvent({
        eventType: 'diagnostics_export',
        details: {
            privacyMode: mode,
            schemaVersion: diagnostics?.schemaVersion || null,
            requestErrors: payload?.clientTelemetry?.requestErrors?.count || 0
        }
    });
};

const exportDiagnostics = () => {
    swal({
        title: 'Export diagnostics',
        text: 'Choose export mode.\nFull includes all details. Sanitized redacts sensitive fields.',
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Full export',
        cancelButtonText: 'Sanitized export',
        closeOnConfirm: true,
        closeOnCancel: true
    }, (useFull) => {
        void exportDiagnosticsByMode(useFull ? 'full' : 'sanitized');
    });
};

const exportSupportBundleByMode = async (privacy = 'sanitized') => {
    const mode = privacy === 'full' ? 'full' : 'sanitized';
    try {
        const bundle = await getSupportBundle(mode);
        const existingClientTelemetry = (
            bundle.clientTelemetry && typeof bundle.clientTelemetry === 'object' && !Array.isArray(bundle.clientTelemetry)
        ) ? { ...bundle.clientTelemetry } : {};
        existingClientTelemetry.performance = collectClientPerformanceTelemetry();
        existingClientTelemetry.requestErrors = getRequestErrorDiagnosticsSnapshot();
        bundle.clientTelemetry = existingClientTelemetry;
        const generatedAt = String(bundle.generatedAt || '').replace(/[:]/g, '-');
        const suffix = generatedAt ? `-${generatedAt}` : '';
        downloadFile(`FolderView Plus Support Bundle${suffix}.json`, toPrettyJson(bundle));
        await trackDiagnosticsEvent({
            eventType: 'support_bundle_export',
            details: {
                privacyMode: mode,
                bundleVersion: bundle?.bundleVersion || null
            }
        });
    } catch (error) {
        showError('Support bundle export failed', error);
    }
};

const exportSupportBundle = () => {
    swal({
        title: 'Export support bundle',
        text: 'Choose export mode.\nFull includes all details. Sanitized redacts sensitive fields.',
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Full export',
        cancelButtonText: 'Sanitized export',
        closeOnConfirm: true,
        closeOnCancel: true
    }, (useFull) => {
        void exportSupportBundleByMode(useFull ? 'full' : 'sanitized');
    });
};

const issueReportFromDiagnostics = (diagnostics) => {
    const report = diagnostics || {};
    const lines = [];
    lines.push('# FolderView Plus Issue Report');
    lines.push(`Generated: ${report.checkedAt || new Date().toISOString()}`);
    lines.push(`Plugin version: ${report.pluginVersion || 'unknown'}`);
    lines.push(`Privacy mode: ${report.privacyMode || 'sanitized'}`);
    lines.push('');

    const env = report.environment || {};
    lines.push('## Environment');
    lines.push(`- Unraid: ${env.unraidVersion || 'unknown'}`);
    lines.push(`- PHP: ${env.phpVersion || 'unknown'}`);
    lines.push(`- OS: ${env.os || 'unknown'}`);
    lines.push('');

    lines.push('## Type Summary');
    for (const type of ['docker', 'vm']) {
        const typeData = report.types?.[type] || {};
        const integrity = typeData.integrityChecks || {};
        const issueCount = Number.isFinite(Number(integrity.issuesCount))
            ? Number(integrity.issuesCount)
            : Number(integrity.issueCount || 0);
        lines.push(`- ${type.toUpperCase()}: folders=${typeData.folderCount || 0}, rules=${typeData.ruleCount || 0}, backups=${typeData.backupCount || 0}, templates=${typeData.templateCount || 0}, issueCount=${issueCount}`);
    }
    lines.push('');

    const timeline = Array.isArray(report.recentTimeline) ? report.recentTimeline.slice(0, 15) : [];
    lines.push('## Recent Timeline');
    if (!timeline.length) {
        lines.push('- No recent timeline events available.');
    } else {
        for (const row of timeline) {
            lines.push(`- ${row.timestamp || ''} | ${row.action || ''} | ${row.type || '-'} | ${row.status || 'ok'}${row.summary ? ` | ${row.summary}` : ''}`);
        }
    }
    lines.push('');
    lines.push('## Notes');
    lines.push('- Attach `FolderView Plus Diagnostics.json` and support bundle export if available.');
    return lines.join('\n');
};

const copyIssueReport = async () => {
    try {
        let diagnostics = lastDiagnostics;
        if (!diagnostics) {
            diagnostics = await getDiagnostics('sanitized');
            renderDiagnostics(diagnostics);
        }
        const text = issueReportFromDiagnostics(diagnostics);

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
    '--fvplus-settings-border-subtle'
]);

const readThemeTokenSnapshot = (styleDeclaration) => {
    const output = {};
    for (const token of THEME_DIAGNOSTIC_TOKENS) {
        output[token] = styleDeclaration ? String(styleDeclaration.getPropertyValue(token) || '').trim() : '';
    }
    return output;
};

const collectThemeDiagnostics = () => {
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
    if (!htmlTokens['--fvplus-status-started']) {
        warnings.push('Missing --fvplus-status-started token value on document root.');
    }
    if (htmlTokens['--fvplus-status-started'] && htmlTokens['--fvplus-status-started'] === htmlTokens['--fvplus-status-stopped']) {
        warnings.push('Started and stopped status tokens resolve to the same value.');
    }
    const startedSampleColor = firstStartedState ? window.getComputedStyle(firstStartedState).color : '';
    const stoppedSampleColor = firstStoppedState ? window.getComputedStyle(firstStoppedState).color : '';
    if (startedSampleColor && stoppedSampleColor && startedSampleColor === stoppedSampleColor) {
        warnings.push('Runtime started/stopped state colors currently resolve to the same computed color.');
    }
    const resolverSnapshot = applyResolvedThemeTokens('diagnostics');
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
            docker: normalizeThemeCompatibilityMode(prefsByType?.docker?.themeCompatibilityMode),
            vm: normalizeThemeCompatibilityMode(prefsByType?.vm?.themeCompatibilityMode),
            effective: normalizeThemeCompatibilityMode(getEffectiveThemeCompatibilityMode())
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
        $('#theme-diagnostics-output').text(toPrettyJson(diagnostics));
        return diagnostics;
    } catch (error) {
        showError('Theme diagnostics failed', error);
        return null;
    }
};

const runThemeSelfHeal = async () => {
    try {
        const snapshot = buildResolvedThemeSnapshot('auto');
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
            applyResolvedThemeTokens('self-heal-noop');
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
            if (normalizeThemeCompatibilityMode(current.themeCompatibilityMode) === targetMode) {
                continue;
            }
            const next = {
                ...current,
                themeCompatibilityMode: targetMode
            };
            prefsByType[type] = await postPrefs(type, next);
            renderRuntimeControls(type);
        }
        applyResolvedThemeTokens('self-heal-apply');
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
    refreshChangeHistory,
    renderDiagnostics,
    runDiagnostics,
    repairDiagnostics,
    exportDiagnosticsByMode,
    exportDiagnostics,
    exportSupportBundleByMode,
    exportSupportBundle,
    issueReportFromDiagnostics,
    copyIssueReport,
    collectThemeDiagnostics,
    runThemeDiagnostics,
    runThemeSelfHeal
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
    refreshChangeHistory,
    renderDiagnostics,
    runDiagnostics,
    repairDiagnostics,
    exportDiagnosticsByMode,
    exportDiagnostics,
    exportSupportBundleByMode,
    exportSupportBundle,
    issueReportFromDiagnostics,
    copyIssueReport,
    collectThemeDiagnostics,
    runThemeDiagnostics,
    runThemeSelfHeal,
    perfNowMs,
    recordPerformanceDiagnosticsSample,
    renderPerformanceDiagnostics,
    recordRequestErrorTelemetry,
    getRequestErrorDiagnosticsSnapshot,
    collectClientPerformanceTelemetry
});
window.FolderViewPlusDiagnosticsModuleLoaded = true;
