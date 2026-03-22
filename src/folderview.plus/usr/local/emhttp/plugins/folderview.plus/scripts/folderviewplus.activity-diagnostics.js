/* Activity feed and diagnostics helpers extracted from folderviewplus.js. */
let lastDiagnostics = null;
const ACTIVITY_FEED_MAX_ENTRIES = 12;

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
    setAdvancedModuleStatus('change_history', 'loading');
    try {
        const diagnostics = await getDiagnostics('sanitized');
        renderDiagnostics(diagnostics);
        renderChangeHistory(diagnostics);
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
    try {
        const diagnostics = await getDiagnostics();
        renderDiagnostics(diagnostics);
        runThemeDiagnostics();
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
    exportSupportBundle
});
window.FolderViewPlusDiagnosticsModuleLoaded = true;
