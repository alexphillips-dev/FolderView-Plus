(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusSettingsWorkspaces = factory();
    root.FolderViewPlusSettingsWorkspacesModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const createApi = (deps = {}) => {
    const repairT710d5dec = (key, fallback, ...params) => globalThis.FolderViewPlusI18n?.t?.(key, fallback, ...params) || fallback.replace(/\$(\d+)/g, (token, n) => String(params[Number(n) - 1] ?? token));
        const windowRef = deps.window || (typeof window !== 'undefined' ? window : null);
        const documentRef = deps.document || windowRef?.document || null;
        const $ = deps.$ || windowRef?.jQuery || windowRef?.$ || null;
        const utils = deps.utils || {};
        const translate = (key, fallback, ...params) => windowRef?.FolderViewPlusI18n?.t?.(key, fallback, ...params)
            || String(fallback || key).replace(/\$(\d+)/g, (match, index) => String(params[Number(index) - 1] ?? match));
        const escapeHtml = typeof deps.escapeHtml === 'function' ? deps.escapeHtml : ((value) => String(value ?? ''));
        const escapeJsString = (value) => String(value ?? '')
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/\r/g, '\\r')
            .replace(/\n/g, '\\n');
        const getFolderMap = typeof deps.getFolderMap === 'function' ? deps.getFolderMap : (() => ({}));
        const getFolderNameForId = typeof deps.getFolderNameForId === 'function' ? deps.getFolderNameForId : ((type, id) => String(id || ''));
        const getSortedBackupsForType = typeof deps.getSortedBackupsForType === 'function' ? deps.getSortedBackupsForType : (() => []);
        const prefsByType = deps.prefsByType || { docker: {}, vm: {} };
        const formatTimestamp = typeof deps.formatTimestamp === 'function' ? deps.formatTimestamp : ((value) => String(value || ''));
        const writeSettingsStorage = typeof deps.writeSettingsStorage === 'function' ? deps.writeSettingsStorage : (() => {});
        const RECOVERY_WORKSPACE_STORAGE_KEY = String(deps.RECOVERY_WORKSPACE_STORAGE_KEY || 'fv.settings.recoveryWorkspace.v1');
        const RULES_WORKSPACE_STORAGE_KEY = String(deps.RULES_WORKSPACE_STORAGE_KEY || 'fv.settings.rulesWorkspace.v1');
        const OPERATIONS_WORKSPACE_STORAGE_KEY = String(deps.OPERATIONS_WORKSPACE_STORAGE_KEY || 'fv.settings.operationsWorkspace.v1');
        const getActiveRecoveryWorkspaceTypeValue = typeof deps.getActiveRecoveryWorkspaceTypeValue === 'function' ? deps.getActiveRecoveryWorkspaceTypeValue : (() => 'docker');
        const setActiveRecoveryWorkspaceTypeValue = typeof deps.setActiveRecoveryWorkspaceTypeValue === 'function' ? deps.setActiveRecoveryWorkspaceTypeValue : (() => {});
        const recoverySelectedBackupByType = deps.recoverySelectedBackupByType || { docker: '', vm: '' };
        const filtersByType = deps.filtersByType || { docker: {}, vm: {} };
        const persistTableUiState = typeof deps.persistTableUiState === 'function' ? deps.persistTableUiState : (() => {});
        const renderBackupRows = typeof deps.renderBackupRows === 'function' ? deps.renderBackupRows : (() => {});
        const createManualBackup = typeof deps.createManualBackup === 'function' ? deps.createManualBackup : (() => {});
        const restoreLatestBackup = typeof deps.restoreLatestBackup === 'function' ? deps.restoreLatestBackup : (() => {});
        const restoreBackupEntry = typeof deps.restoreBackupEntry === 'function' ? deps.restoreBackupEntry : (() => {});
        const downloadBackupEntry = typeof deps.downloadBackupEntry === 'function' ? deps.downloadBackupEntry : (() => {});
        const deleteBackupEntry = typeof deps.deleteBackupEntry === 'function' ? deps.deleteBackupEntry : (() => {});
        const deleteAllBackupEntries = typeof deps.deleteAllBackupEntries === 'function' ? deps.deleteAllBackupEntries : (() => {});
        const runScheduledBackupNow = typeof deps.runScheduledBackupNow === 'function' ? deps.runScheduledBackupNow : (() => {});
        const compareBackupSnapshots = typeof deps.compareBackupSnapshots === 'function' ? deps.compareBackupSnapshots : (() => {});
        const changeBackupSchedulePref = typeof deps.changeBackupSchedulePref === 'function' ? deps.changeBackupSchedulePref : (() => {});
        const undoLatestChange = typeof deps.undoLatestChange === 'function' ? deps.undoLatestChange : (() => {});
        const getActiveRulesWorkspaceTypeValue = typeof deps.getActiveRulesWorkspaceTypeValue === 'function' ? deps.getActiveRulesWorkspaceTypeValue : (() => 'docker');
        const setActiveRulesWorkspaceTypeValue = typeof deps.setActiveRulesWorkspaceTypeValue === 'function' ? deps.setActiveRulesWorkspaceTypeValue : (() => {});
        const renderRulesTable = typeof deps.renderRulesTable === 'function' ? deps.renderRulesTable : (() => {});
        const updateRuleLiveMatch = typeof deps.updateRuleLiveMatch === 'function' ? deps.updateRuleLiveMatch : (() => {});
        const updateRuleValidationHint = typeof deps.updateRuleValidationHint === 'function' ? deps.updateRuleValidationHint : (() => {});
        const getActiveOperationsWorkspaceTypeValue = typeof deps.getActiveOperationsWorkspaceTypeValue === 'function' ? deps.getActiveOperationsWorkspaceTypeValue : (() => 'docker');
        const setActiveOperationsWorkspaceTypeValue = typeof deps.setActiveOperationsWorkspaceTypeValue === 'function' ? deps.setActiveOperationsWorkspaceTypeValue : (() => {});
        const templatesByType = deps.templatesByType || { docker: [], vm: [] };
        const selectedOperationsTemplateIdByType = deps.selectedOperationsTemplateIdByType || { docker: '', vm: '' };
        const downloadFile = typeof deps.downloadFile === 'function' ? deps.downloadFile : (() => {});
        const toPrettyJson = typeof deps.toPrettyJson === 'function' ? deps.toPrettyJson : ((value) => JSON.stringify(value, null, 2));
        const showError = typeof deps.showError === 'function' ? deps.showError : (() => {});
        const swal = typeof deps.swal === 'function' ? deps.swal : windowRef?.swal || null;
        const apiGetJson = typeof deps.apiGetJson === 'function' ? deps.apiGetJson : (async () => ({}));
        const apiPostJson = typeof deps.apiPostJson === 'function' ? deps.apiPostJson : (async () => ({}));
        const selectJsonFile = typeof deps.selectJsonFile === 'function' ? deps.selectJsonFile : (async () => null);
        const showToastMessage = typeof deps.showToastMessage === 'function' ? deps.showToastMessage : (() => {});
        const claimAdvancedOperationLock = typeof deps.claimAdvancedOperationLock === 'function' ? deps.claimAdvancedOperationLock : (() => true);
        const releaseAdvancedOperationLock = typeof deps.releaseAdvancedOperationLock === 'function' ? deps.releaseAdvancedOperationLock : (() => {});
        const refreshType = typeof deps.refreshType === 'function' ? deps.refreshType : (async () => {});
        const refreshBackups = typeof deps.refreshBackups === 'function' ? deps.refreshBackups : (async () => {});
        const refreshThemeWorkspace = typeof deps.refreshThemeWorkspace === 'function' ? deps.refreshThemeWorkspace : (async () => {});
        const openImportApplyProgressDialog = typeof deps.openImportApplyProgressDialog === 'function' ? deps.openImportApplyProgressDialog : (() => {});
        const updateImportApplyProgressDialog = typeof deps.updateImportApplyProgressDialog === 'function' ? deps.updateImportApplyProgressDialog : (() => {});
        const closeImportApplyProgressDialog = typeof deps.closeImportApplyProgressDialog === 'function' ? deps.closeImportApplyProgressDialog : (() => {});
        const ensureRuntimeConflictActionAllowed = typeof deps.ensureRuntimeConflictActionAllowed === 'function' ? deps.ensureRuntimeConflictActionAllowed : (() => true);
        let recoveryEnvironmentSummary = null;
        let recoveryEnvironmentMode = 'idle';

        const normalizeRecoveryWorkspaceType = (value) => (
            String(value || '').trim().toLowerCase() === 'vm' ? 'vm' : 'docker'
        );

        const getActiveRecoveryWorkspaceType = () => normalizeRecoveryWorkspaceType(getActiveRecoveryWorkspaceTypeValue());

        const normalizeRecoveryEnvironmentSummary = (value) => {
            const source = value && typeof value === 'object' ? value : {};
            const docker = source.docker && typeof source.docker === 'object' ? source.docker : {};
            const vm = source.vm && typeof source.vm === 'object' ? source.vm : {};
            const themeWorkspace = source.themeWorkspace && typeof source.themeWorkspace === 'object' ? source.themeWorkspace : {};
            return {
                kind: String(source.kind || '').trim(),
                schemaVersion: Number(source.schemaVersion || 1),
                pluginVersion: String(source.pluginVersion || '').trim(),
                currentPluginVersion: String(source.currentPluginVersion || '').trim(),
                exportedAt: String(source.exportedAt || '').trim(),
                sourceName: String(source.sourceName || '').trim(),
                docker: {
                    folderCount: Math.max(0, Number(docker.folderCount) || 0),
                    sortMode: String(docker.sortMode || '').trim()
                },
                vm: {
                    folderCount: Math.max(0, Number(vm.folderCount) || 0),
                    sortMode: String(vm.sortMode || '').trim()
                },
                themeWorkspace: {
                    managedThemeCount: Math.max(0, Number(themeWorkspace.managedThemeCount) || 0),
                    activeThemeId: String(themeWorkspace.activeThemeId || '').trim(),
                    activeThemeName: String(themeWorkspace.activeThemeName || '').trim(),
                    customCssBytes: Math.max(0, Number(themeWorkspace.customCssBytes) || 0)
                },
                warnings: Array.isArray(source.warnings)
                    ? source.warnings.map((entry) => String(entry || '').trim()).filter(Boolean)
                    : []
            };
        };

        const getRecoveryEnvironmentModeLabel = (mode) => {
            if (mode === 'export') {
                return 'Export ready';
            }
            if (mode === 'preview') {
                return 'Preview ready';
            }
            if (mode === 'import') {
                return 'Imported';
            }
            return 'Portable backup';
        };

        const buildRecoveryEnvironmentSummaryHtml = () => {
            if (!recoveryEnvironmentSummary) {
                return `
                    <div class="fv-recovery-empty-state">
                        <strong>Export a full-environment JSON or import one from another install.</strong>
                        <span>Environment snapshots include Docker folders, VM folders, preferences, folder defaults, and Theme Workspace customization.</span>
                    </div>
                `;
            }

            const summary = recoveryEnvironmentSummary;
            const themeLabel = summary.themeWorkspace.activeThemeName || summary.themeWorkspace.activeThemeId || 'No active managed theme';
            const exportedAt = summary.exportedAt ? formatTimestamp(summary.exportedAt) : 'Unknown export time';
            const warningHtml = summary.warnings.map((warning) => (
                `<div class="fv-recovery-callout">${escapeHtml(warning)}</div>`
            )).join('');

            return `
                <article class="fv-recovery-history-card fv-recovery-environment-card">
                    <div class="fv-recovery-history-head">
                        <div>
                            <div class="fv-recovery-history-title">${escapeHtml(getRecoveryEnvironmentModeLabel(recoveryEnvironmentMode))}</div>
                            <div class="fv-recovery-history-copy">${escapeHtml(summary.sourceName || 'FolderView Plus Environment snapshot')}</div>
                        </div>
                        <span class="fv-recovery-history-badge">${escapeHtml(summary.kind || 'environment')}</span>
                    </div>
                    <div class="fv-recovery-history-meta">
                        <span>${escapeHtml(`Exported ${exportedAt}`)}</span>
                        <span>${escapeHtml(`Snapshot plugin ${summary.pluginVersion || 'unknown'}`)}</span>
                        <span>${escapeHtml(repairT710d5dec("common.repair.docker-folders-1-41f18c", "Docker folders: $1", summary.docker.folderCount))}</span>
                        <span>${escapeHtml(repairT710d5dec("common.repair.vm-folders-1-e73ec2", "VM folders: $1", summary.vm.folderCount))}</span>
                        <span>${escapeHtml(repairT710d5dec("common.repair.managed-themes-1-91e84d", "Managed themes: $1", summary.themeWorkspace.managedThemeCount))}</span>
                    </div>
                    <div class="fv-recovery-environment-meta">
                        <span>${escapeHtml(`Docker sort: ${summary.docker.sortMode || 'created'}`)}</span>
                        <span>${escapeHtml(`VM sort: ${summary.vm.sortMode || 'created'}`)}</span>
                        <span>${escapeHtml(`Theme: ${themeLabel}`)}</span>
                        <span>${escapeHtml(`Custom CSS ${summary.themeWorkspace.customCssBytes} bytes`)}</span>
                    </div>
                    ${warningHtml}
                </article>
            `;
        };

        const renderRecoveryEnvironmentSummary = () => {
            const host = $('#fv-recovery-environment-summary');
            if (!host.length) {
                return;
            }
            host.html(buildRecoveryEnvironmentSummaryHtml());
        };

        const setRecoveryEnvironmentSummary = (summary, mode = 'idle') => {
            recoveryEnvironmentSummary = normalizeRecoveryEnvironmentSummary(summary);
            recoveryEnvironmentMode = String(mode || 'idle').trim().toLowerCase() || 'idle';
            renderRecoveryEnvironmentSummary();
            return recoveryEnvironmentSummary;
        };

        const buildEnvironmentSnapshotFileName = (summary) => {
            const exportedAt = String(summary?.exportedAt || '').trim();
            const stamp = exportedAt
                ? exportedAt.replace(/[:]/g, '-').replace(/\.\d+Z?$/, 'Z').replace(/[^0-9A-Za-zTZ_-]+/g, '_')
                : new Date().toISOString().replace(/[:]/g, '-').replace(/\.\d+Z$/, 'Z');
            return `FolderView Plus Environment ${stamp}.json`;
        };

        const buildRecoveryEnvironmentConfirmHtml = (summary) => `
            <div class="preview-meta-grid">
                <div class="preview-meta-item"><span>Docker folders</span><strong>${escapeHtml(String(summary.docker.folderCount))}</strong></div>
                <div class="preview-meta-item"><span>VM folders</span><strong>${escapeHtml(String(summary.vm.folderCount))}</strong></div>
                <div class="preview-meta-item"><span>Managed themes</span><strong>${escapeHtml(String(summary.themeWorkspace.managedThemeCount))}</strong></div>
                <div class="preview-meta-item"><span>Exported</span><strong>${escapeHtml(summary.exportedAt ? formatTimestamp(summary.exportedAt) : 'Unknown')}</strong></div>
            </div>
            <p class="rules-help">This replaces Docker folders, VM folders, preferences, folder defaults, and Theme Workspace on this install. A rollback checkpoint plus fresh Docker and VM safety backups are created first.</p>
            ${summary.warnings.map((warning) => `<div class="fv-recovery-callout">${escapeHtml(warning)}</div>`).join('')}
        `;

        const withRecoveryEnvironmentImportLock = async (actionLabel, callback) => {
            const acquired = [];
            for (const type of ['docker', 'vm']) {
                if (!claimAdvancedOperationLock(type, 'backups', actionLabel)) {
                    acquired.reverse().forEach(([lockedType, scope]) => releaseAdvancedOperationLock(lockedType, scope));
                    return null;
                }
                acquired.push([type, 'backups']);
            }
            try {
                return await callback();
            } finally {
                acquired.reverse().forEach(([lockedType, scope]) => releaseAdvancedOperationLock(lockedType, scope));
            }
        };

        const applyEnvironmentSnapshotSelection = async (selectedFile, previewSummary = null) => withRecoveryEnvironmentImportLock('Environment import', async () => {
            const progressTotal = 7;
            let progressOpen = false;
            const setProgress = (completed, label) => {
                updateImportApplyProgressDialog({
                    completed: Math.max(0, Math.min(progressTotal, Number(completed) || 0)),
                    total: progressTotal,
                    label
                });
            };

            try {
                openImportApplyProgressDialog('docker', progressTotal);
                progressOpen = true;
                setProgress(0, 'Preparing environment import...');
                const response = await apiPostJson('/plugins/folderview.plus/server/environment_snapshot.php', {
                    action: 'apply',
                    payload: String(selectedFile?.text || ''),
                    fileName: String(selectedFile?.name || '')
                });
                const importResult = response.import || {};
                const importedSummary = setRecoveryEnvironmentSummary(importResult.summary || previewSummary || {}, 'import');
                setProgress(1, translate("common.audit.environment-applied", "Environment snapshot applied."));

                await refreshType('docker');
                setProgress(2, translate("common.audit.folders-refreshed", "Refreshed Docker folders and preferences."));

                await refreshType('vm');
                setProgress(3, repairT710d5dec("common.repair.refreshed-vm-folders-and-preferences-6f71bb", "Refreshed VM folders and preferences."));

                await refreshBackups('docker', { quiet: true });
                setProgress(4, repairT710d5dec("common.repair.refreshed-docker-safety-backups-18b9f0", "Refreshed Docker safety backups."));

                await refreshBackups('vm', { quiet: true });
                setProgress(5, repairT710d5dec("common.repair.refreshed-vm-safety-backups-a21bd9", "Refreshed VM safety backups."));

                let themeRefreshMessage = 'Refreshed Theme Workspace.';
                try {
                    await refreshThemeWorkspace();
                } catch (themeError) {
                    themeRefreshMessage = 'Theme Workspace changed. Reload the Appearance tab if needed.';
                }
                setProgress(6, themeRefreshMessage);

                setProgress(progressTotal, translate("common.audit.environment-complete", "Environment import complete."));
                await new Promise((resolve) => {
                    const timer = windowRef?.setTimeout || setTimeout;
                    timer(resolve, 180);
                });
                closeImportApplyProgressDialog();
                progressOpen = false;

                const rollbackName = String(importResult.rollback?.name || '').trim();
                const title = 'Environment imported';
                const text = rollbackName
                    ? `Environment snapshot applied. Rollback checkpoint: ${rollbackName}.`
                    : translate("common.audit.environment-applied", "Environment snapshot applied.");
                if (swal) {
                    swal({ title, text, type: 'success' });
                }
                showToastMessage({
                    title,
                    message: rollbackName
                        ? `Portable environment applied. Rollback checkpoint: ${rollbackName}.`
                        : 'Portable environment applied.',
                    level: 'success',
                    durationMs: 4200
                });
                return importedSummary;
            } catch (error) {
                if (progressOpen) {
                    closeImportApplyProgressDialog();
                }
                showError(repairT710d5dec("common.repair.environment-import-failed-9e80d3", "Environment import failed"), error);
                throw error;
            }
        });

        const exportEnvironmentSnapshot = async () => {
            try {
                const response = await apiGetJson('/plugins/folderview.plus/server/environment_snapshot.php', {
                    data: { action: 'export' }
                });
                const summary = setRecoveryEnvironmentSummary(response.summary || {}, 'export');
                downloadFile(buildEnvironmentSnapshotFileName(summary), toPrettyJson(response.snapshot || {}));
                showToastMessage({
                    title: 'Environment exported',
                    message: 'Portable environment snapshot downloaded.',
                    level: 'success',
                    durationMs: 3600
                });
                return summary;
            } catch (error) {
                showError(repairT710d5dec("common.repair.environment-export-failed-d84f08", "Environment export failed"), error);
                throw error;
            }
        };

        const importEnvironmentSnapshot = async () => {
            if (!ensureRuntimeConflictActionAllowed('Import full FolderView Plus environment')) {
                return;
            }

            let selected = null;
            try {
                selected = await selectJsonFile();
            } catch (error) {
                showError(repairT710d5dec("common.repair.environment-snapshot-selection-failed-d3345b", "Environment snapshot selection failed"), error);
                return;
            }
            if (!selected) {
                return;
            }

            try {
                const previewResponse = await apiPostJson('/plugins/folderview.plus/server/environment_snapshot.php', {
                    action: 'preview',
                    payload: String(selected.text || ''),
                    fileName: String(selected.name || '')
                });
                const summary = setRecoveryEnvironmentSummary(previewResponse.summary || {}, 'preview');
                const previewHtml = buildRecoveryEnvironmentConfirmHtml(summary);

                if (!swal) {
                    const confirmed = windowRef?.confirm(translate("legacy.surface.ffc450f2a4795269", "Import environment snapshot?"));
                    if (confirmed) {
                        await applyEnvironmentSnapshotSelection(selected, summary);
                    }
                    return;
                }

                swal({
                    title: 'Import environment snapshot?',
                    text: previewHtml,
                    type: 'warning',
                    html: true,
                    showCancelButton: true,
                    confirmButtonText: 'Import environment',
                    cancelButtonText: 'Cancel',
                    showLoaderOnConfirm: true
                }, async (confirmed) => {
                    if (!confirmed) {
                        return;
                    }
                    await applyEnvironmentSnapshotSelection(selected, summary);
                });
            } catch (error) {
                showError(repairT710d5dec("common.repair.environment-snapshot-preview-failed-c3759a", "Environment snapshot preview failed"), error);
            }
        };

        const formatRecoveryReasonLabel = (value) => {
            const raw = String(value || '').trim();
            const reasons = {
                manual: translate("settings.recovery.reason-manual", "Manual backup"),
                'before-repair-orphaned-members': translate("settings.recovery.reason-repair", "Before removing missing references"),
                'before-prefs-update': translate("settings.recovery.reason-preferences", "Before updating preferences"),
                scheduled: translate("settings.recovery.reason-scheduled", "Scheduled backup")
            };
            return Object.prototype.hasOwnProperty.call(reasons, raw || 'manual') ? reasons[raw || 'manual'] : raw;
        };

        const getRecoveryBackupFolderCount = (backup) => {
            const count = Number(backup?.count);
            return Number.isFinite(count) ? Math.max(0, count) : null;
        };

        const isRecoveryBackupEmpty = (backup) => getRecoveryBackupFolderCount(backup) === 0;

        const getLatestRestorableRecoveryBackup = (backups) => {
            const list = Array.isArray(backups) ? backups : [];
            return list.find((backup) => !isRecoveryBackupEmpty(backup)) || null;
        };

        const formatRecoveryBackupFolderCount = (backup) => {
            const count = getRecoveryBackupFolderCount(backup);
            if (count === null) {
                return translate("settings.recovery.count-unavailable", "Folder count unavailable");
            }
            return translate("settings.recovery.folder-count", "Folders: $1", count);
        };

        const buildRecoveryOverviewHtml = (type) => {
            const resolvedType = normalizeRecoveryWorkspaceType(type);
            const title = resolvedType === 'docker' ? 'Docker' : 'VMs';
            const folders = getFolderMap(resolvedType);
            const backups = getSortedBackupsForType(resolvedType);
            const prefs = typeof utils.normalizePrefs === 'function' ? utils.normalizePrefs(prefsByType[resolvedType]) : (prefsByType[resolvedType] || {});
            const schedule = prefs.backupSchedule || {};
            const latest = backups[0] || null;
            const latestRestorable = getLatestRestorableRecoveryBackup(backups);
            const backupCount = backups.length;
            const emptyCount = backups.filter(isRecoveryBackupEmpty).length;
            const scheduleEnabled = schedule.enabled === true;
            const retention = Number.isFinite(Number(schedule.retention)) ? Number(schedule.retention) : 25;
            const interval = Number.isFinite(Number(schedule.intervalHours)) ? Number(schedule.intervalHours) : 24;
            const latestCreated = latest?.createdAt ? formatTimestamp(latest.createdAt) : translate("settings.recovery.not-created", "Not created yet");
            const latestRestorableCreated = latestRestorable?.createdAt ? formatTimestamp(latestRestorable.createdAt) : translate("settings.recovery.none-available", "None available");
            const latestRestorableReason = latestRestorable ? formatRecoveryReasonLabel(latestRestorable.reason) : translate("settings.recovery.create-after-folders", "Create a backup after folders exist");
            const folderCount = Object.keys(folders || {}).length;
            const statusClass = latestRestorable
                ? (scheduleEnabled ? 'is-healthy' : 'is-warning')
                : 'is-warning';
            const statusLabel = latestRestorable
                ? (scheduleEnabled ? translate("common.state.ready", "Ready") : translate("settings.recovery.manual-backups", "Manual backups"))
                : translate("settings.recovery.no-backup", "No backup yet");
            const headline = latestRestorable
                ? translate("settings.recovery.ready", "$1 recovery is ready.", title)
                : translate("settings.recovery.no-restorable", "No restorable $1 backup is available yet.", title);
            const copy = latestRestorable
                ? translate("settings.recovery.restore-summary", "Restore Latest will use $1 and create a fresh safety backup first when folders exist.", latestRestorableCreated)
                : (latest
                    ? translate("settings.recovery.only-empty", "Only empty snapshots were found. Restore Latest skips empty backups so it does not roll you back to no folders.")
                    : translate("settings.recovery.create-first", "Create a manual backup before making larger changes so you have a safe rollback point."));
            const scheduleCopy = scheduleEnabled
                ? translate("settings.recovery.schedule-summary", "Runs every $1 h and keeps $2 snapshots.", interval, retention)
                : translate("settings.recovery.manual-help", "Manual only. Enable scheduled backups if you want automatic recovery points.");
            const latestRawCopy = latest
                ? `${escapeHtml(latestCreated)} (${escapeHtml(formatRecoveryBackupFolderCount(latest))})`
                : escapeHtml(translate("settings.recovery.no-snapshots", "No snapshots yet"));

            return `
                <div class="fv-recovery-hero">
                    <div class="fv-recovery-overview-head">
                        <div>
                            <span class="fv-recovery-source-label">${escapeHtml(title)}</span>
                            <div class="fv-recovery-headline">${escapeHtml(headline)}</div>
                            <div class="fv-recovery-copy">${escapeHtml(copy)}</div>
                        </div>
                        <span class="fv-rules-status-chip ${statusClass}">${escapeHtml(statusLabel)}</span>
                    </div>
                    <div class="fv-recovery-chip-row">
                        <span class="fv-recovery-chip">${escapeHtml(translate("settings.recovery.live-count", "Current folders: $1", folderCount))}</span>
                        <span class="fv-recovery-chip">${escapeHtml(translate("settings.recovery.snapshot-count", "Snapshots: $1", backupCount))}</span>
                        ${emptyCount > 0 ? `<span class="fv-recovery-chip is-warning">${escapeHtml(translate("settings.recovery.empty-count", "Empty snapshots skipped by Restore Latest: $1", emptyCount))}</span>` : ''}
                        <span class="fv-recovery-chip ${scheduleEnabled ? 'is-success' : ''}">${escapeHtml(scheduleEnabled ? translate("settings.recovery.scheduled-every", "Scheduled every $1 h", interval) : translate("settings.recovery.manual-backups", "Manual backups"))}</span>
                    </div>
                </div>
                <div class="fv-recovery-stat-grid">
                    <div class="fv-recovery-stat-card">
                        <span class="fv-recovery-stat-label">Restore Latest uses</span>
                        <strong>${escapeHtml(latestRestorableCreated)}</strong>
                        <span>${escapeHtml(latestRestorableReason)}</span>
                    </div>
                    <div class="fv-recovery-stat-card">
                        <span class="fv-recovery-stat-label">Newest snapshot</span>
                        <strong>${escapeHtml(latestCreated)}</strong>
                        <span>${latestRawCopy}</span>
                    </div>
                    <div class="fv-recovery-stat-card">
                        <span class="fv-recovery-stat-label">Backup policy</span>
                        <strong>${escapeHtml(scheduleEnabled ? translate("settings.recovery.every-hours", "Every $1 h", interval) : translate("settings.recovery.manual-only", "Manual only"))}</strong>
                        <span>${escapeHtml(schedule.lastRunAt ? translate("settings.recovery.last-run", "Last run: $1", formatTimestamp(schedule.lastRunAt)) : scheduleCopy)}</span>
                    </div>
                    <div class="fv-recovery-stat-card">
                        <span class="fv-recovery-stat-label">What is protected</span>
                        <strong>FolderView setup</strong>
                        <span>Folders, rules, preferences, defaults, and workspace settings. Container data and VM disks are not included.</span>
                    </div>
                </div>
                <div class="fv-recovery-explainer-grid">
                    <div class="fv-recovery-explainer-card">
                        <strong>Restore safely</strong>
                        <span>Restores create a fresh checkpoint first when there are folders to protect.</span>
                    </div>
                    <div class="fv-recovery-explainer-card">
                        <strong>Compare before restoring</strong>
                        <span>Use Compare Snapshots to inspect preference and folder differences before applying a restore.</span>
                    </div>
                </div>
            `;
        };

        const buildRecoveryBackupHistoryHtml = (type) => {
            const resolvedType = normalizeRecoveryWorkspaceType(type);
            const backups = getSortedBackupsForType(resolvedType);
            const summaryEl = $('#fv-recovery-history-summary');
            const title = resolvedType === 'docker' ? 'Docker' : 'VM';
            if (!backups.length) {
                recoverySelectedBackupByType[resolvedType] = '';
                summaryEl.text(translate("settings.recovery.no-history", "No backup snapshots are available yet."));
                return `
                    <div class="fv-recovery-empty-state">
                        <strong>${escapeHtml(translate("settings.recovery.none-for-type", "No $1 backups yet.", title))}</strong>
                        <span>Create a manual backup or run the scheduler to build recovery history.</span>
                    </div>
                `;
            }

            const selectedName = String(recoverySelectedBackupByType[resolvedType] || '').trim();
            const selectedBackup = backups.find((backup) => String(backup?.name || '').trim() === selectedName) || backups[0];
            const resolvedSelectedName = String(selectedBackup?.name || '').trim();
            recoverySelectedBackupByType[resolvedType] = resolvedSelectedName;
            const created = formatTimestamp(selectedBackup?.createdAt || '');
            const reason = formatRecoveryReasonLabel(selectedBackup?.reason);
            const countLabel = formatRecoveryBackupFolderCount(selectedBackup);
            const isEmpty = isRecoveryBackupEmpty(selectedBackup);
            const latestName = String(backups[0]?.name || '').trim();
            const latestBadge = resolvedSelectedName === latestName ? '<span class="fv-recovery-history-badge">Latest</span>' : '';
            const emptyBadge = isEmpty ? '<span class="fv-recovery-history-badge is-warning">Empty</span>' : '';
            const optionsHtml = backups.map((backup, index) => {
                const name = String(backup?.name || '').trim();
                const emptyLabel = isRecoveryBackupEmpty(backup) ? translate("settings.recovery.empty-suffix", " - empty") : '';
                const label = `${formatTimestamp(backup?.createdAt || '')}${index === 0 ? translate("settings.recovery.latest-suffix", " (latest)") : ''}${emptyLabel}`;
                const selectedAttr = name === resolvedSelectedName ? ' selected' : '';
                return `<option value="${escapeHtml(name)}"${selectedAttr}>${escapeHtml(label)}</option>`;
            }).join('');
            const recentHtml = backups.slice(0, 5).map((backup, index) => {
                const name = String(backup?.name || '').trim();
                const activeClass = name === resolvedSelectedName ? ' is-active' : '';
                const backupCountLabel = formatRecoveryBackupFolderCount(backup);
                const backupReason = formatRecoveryReasonLabel(backup?.reason);
                const backupCreated = formatTimestamp(backup?.createdAt || '');
                const backupBadges = [
                    index === 0 ? '<span class="fv-recovery-history-badge">Latest</span>' : '',
                    isRecoveryBackupEmpty(backup) ? '<span class="fv-recovery-history-badge is-warning">Empty</span>' : ''
                ].join('');
                return `
                    <button type="button" class="fv-recovery-snapshot-item${activeClass}" data-fv-onclick="selectActiveRecoveryBackup('${escapeJsString(name)}')">
                        <span>
                            <strong>${escapeHtml(backupCreated)}</strong>
                            <small>${escapeHtml(`${backupReason} - ${backupCountLabel}`)}</small>
                        </span>
                        <span class="fv-recovery-history-badges">${backupBadges}</span>
                    </button>
                `;
            }).join('');

            summaryEl.text(translate("settings.recovery.history-summary", "Snapshots available: $1. Empty snapshots remain in the history but Restore Latest skips them.", backups.length));
            return `
                <div class="fv-recovery-history-picker-row">
                    <label for="recovery-backup-entry-select">Choose snapshot</label>
                    <select id="recovery-backup-entry-select" data-fv-onchange="selectActiveRecoveryBackup(this.value)">
                        ${optionsHtml}
                    </select>
                </div>
                <article class="fv-recovery-history-card fv-recovery-history-selection">
                    <div class="fv-recovery-history-head">
                        <div>
                            <div class="fv-recovery-history-title">${escapeHtml(created)}</div>
                            <div class="fv-recovery-history-copy">${escapeHtml(reason)}</div>
                        </div>
                        <div class="fv-recovery-history-badges">${latestBadge}${emptyBadge}</div>
                    </div>
                    <div class="fv-recovery-history-meta">
                        <span>${escapeHtml(countLabel)}</span>
                        <span>${escapeHtml(resolvedSelectedName)}</span>
                    </div>
                    ${isEmpty ? '<div class="fv-recovery-history-callout">This snapshot contains 0 folders. Restore Latest will skip it, but direct restore is still available if you intentionally select it.</div>' : ''}
                    <div class="backup-actions fv-recovery-history-actions-row">
                        <button type="button" data-fv-onclick="restoreSelectedActiveRecoveryBackup()"><i class="fa fa-history"></i> Restore</button>
                        <button type="button" data-fv-onclick="downloadSelectedActiveRecoveryBackup()"><i class="fa fa-download"></i> Download</button>
                        <button type="button" data-fv-onclick="deleteSelectedActiveRecoveryBackup()"><i class="fa fa-trash"></i> Delete</button>
                        <button type="button" class="fv-recovery-danger-action" data-fv-onclick="deleteAllActiveRecoveryBackups()"><i class="fa fa-trash"></i> Delete all backups</button>
                    </div>
                </article>
                <div class="fv-recovery-snapshot-list">
                    <div class="fv-recovery-snapshot-list-head">
                        <strong>Recent snapshots</strong>
                        <span>Click a snapshot to inspect or restore it.</span>
                    </div>
                    <div class="fv-recovery-snapshot-items">
                        ${recentHtml}
                    </div>
                </div>
            `;
        };

        const syncVisibleRecoveryCompareControls = (type) => {
            const resolvedType = normalizeRecoveryWorkspaceType(type);
            const visibleLeft = $('#recovery-backup-compare-left');
            const visibleRight = $('#recovery-backup-compare-right');
            const visiblePrefs = $('#recovery-backup-compare-include-prefs');
            const sourceLeft = $(`#${resolvedType}-backup-compare-left`);
            const sourceRight = $(`#${resolvedType}-backup-compare-right`);
            const sourcePrefs = $(`#${resolvedType}-backup-compare-include-prefs`);
            if (!visibleLeft.length || !visibleRight.length || !visiblePrefs.length || !sourceLeft.length || !sourceRight.length || !sourcePrefs.length) {
                return;
            }

            visibleLeft.html(sourceLeft.html()).prop('disabled', sourceLeft.prop('disabled'));
            visibleRight.html(sourceRight.html()).prop('disabled', sourceRight.prop('disabled'));
            visiblePrefs.prop('checked', sourcePrefs.prop('checked') === true).prop('disabled', sourcePrefs.prop('disabled'));
            visibleLeft.val(String(sourceLeft.val() || ''));
            visibleRight.val(String(sourceRight.val() || '__current__'));
        };

        const syncHiddenRecoveryCompareControls = (type) => {
            const resolvedType = normalizeRecoveryWorkspaceType(type);
            const visibleLeft = $('#recovery-backup-compare-left');
            const visibleRight = $('#recovery-backup-compare-right');
            const visiblePrefs = $('#recovery-backup-compare-include-prefs');
            const sourceLeft = $(`#${resolvedType}-backup-compare-left`);
            const sourceRight = $(`#${resolvedType}-backup-compare-right`);
            const sourcePrefs = $(`#${resolvedType}-backup-compare-include-prefs`);
            if (!visibleLeft.length || !visibleRight.length || !visiblePrefs.length || !sourceLeft.length || !sourceRight.length || !sourcePrefs.length) {
                return;
            }
            sourceLeft.val(String(visibleLeft.val() || ''));
            sourceRight.val(String(visibleRight.val() || '__current__'));
            sourcePrefs.prop('checked', visiblePrefs.prop('checked') === true);
            sourceLeft.triggerHandler('change');
            sourceRight.triggerHandler('change');
            sourcePrefs.triggerHandler('change');
        };

        const renderRecoveryWorkspace = (type = getActiveRecoveryWorkspaceType()) => {
            const resolvedType = normalizeRecoveryWorkspaceType(type);
            const overviewHost = $('#fv-recovery-overview');
            const listHost = $('#fv-recovery-backup-list');
            const policySummary = $('#fv-recovery-policy-summary');
            const safetyNote = $('#fv-recovery-safety-note');
            if (!overviewHost.length || !listHost.length) {
                return;
            }

            setActiveRecoveryWorkspaceTypeValue(resolvedType);
            const backups = getSortedBackupsForType(resolvedType);
            const prefs = typeof utils.normalizePrefs === 'function' ? utils.normalizePrefs(prefsByType[resolvedType]) : (prefsByType[resolvedType] || {});
            const schedule = prefs.backupSchedule || {};
            const latest = backups[0] || null;
            const latestRestorable = getLatestRestorableRecoveryBackup(backups);
            const title = resolvedType === 'docker' ? 'Docker' : 'VM';

            overviewHost.html(buildRecoveryOverviewHtml(resolvedType));
            listHost.html(buildRecoveryBackupHistoryHtml(resolvedType));
            renderRecoveryEnvironmentSummary();
            safetyNote.text(latestRestorable
                ? translate("settings.recovery.restore-summary", "Restore Latest will use $1 and create a fresh safety backup first when folders exist.", formatTimestamp(latestRestorable.createdAt || ''))
                : (latest
                    ? translate("settings.recovery.empty-for-type", "Only empty $1 snapshots are available. Create a new backup after folders exist before using Restore Latest.", title)
                    : translate("settings.recovery.create-for-type", "No $1 backup exists yet. Create one before making larger changes.", title)));
            policySummary.text(schedule.enabled === true
                ? translate("settings.recovery.policy-summary", "Every $1 h; retain $2; $3.", schedule.intervalHours || 24, schedule.retention || 25, schedule.lastRunAt ? translate("settings.recovery.last-run", "Last run: $1", formatTimestamp(schedule.lastRunAt)) : translate("settings.recovery.waiting", "Waiting for first run"))
                : translate("settings.recovery.manual-help", "Manual only. Enable scheduled backups if you want automatic recovery points."));
            syncVisibleRecoveryCompareControls(resolvedType);
            windowRef?.FolderViewPlusDiagnostics?.renderRecoveryChangeHistoryFromDiagnostics?.();
        };

        const syncRecoveryWorkspaceUi = () => {
            const activeType = normalizeRecoveryWorkspaceType(getActiveRecoveryWorkspaceTypeValue());
            documentRef?.querySelectorAll('[data-fv-recovery-source-toggle]').forEach((button) => {
                if (!(button instanceof windowRef.HTMLButtonElement)) {
                    return;
                }
                const buttonType = normalizeRecoveryWorkspaceType(button.getAttribute('data-fv-recovery-source-toggle'));
                const isActive = buttonType === activeType;
                button.classList.toggle('is-active', isActive);
                button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            });
            renderRecoveryWorkspace(activeType);
        };

        const setRecoveryWorkspaceType = (type, persist = true) => {
            const resolvedType = normalizeRecoveryWorkspaceType(type);
            setActiveRecoveryWorkspaceTypeValue(resolvedType);
            if (persist) {
                writeSettingsStorage(RECOVERY_WORKSPACE_STORAGE_KEY, resolvedType, { delayMs: 60, idle: true });
            }
            syncRecoveryWorkspaceUi();
        };

        const selectActiveRecoveryBackup = (name = '') => {
            const resolvedType = getActiveRecoveryWorkspaceType();
            recoverySelectedBackupByType[resolvedType] = String(name || '').trim();
            renderRecoveryWorkspace(resolvedType);
        };

        const filterActiveRecoveryBackups = (value = '') => {
            const resolvedType = getActiveRecoveryWorkspaceType();
            const displayValue = String(value || '');
            if (!filtersByType[resolvedType]) {
                filtersByType[resolvedType] = { folders: '', rules: '', backups: '', templates: '', bulk: '' };
            }
            filtersByType[resolvedType].backups = String(displayValue || '').trim().toLowerCase();
            persistTableUiState();
            renderBackupRows(resolvedType);
        };

        const createActiveRecoveryBackup = () => createManualBackup(getActiveRecoveryWorkspaceType());
        const restoreLatestActiveRecoveryBackup = () => restoreLatestBackup(getActiveRecoveryWorkspaceType());
        const restoreSelectedActiveRecoveryBackup = () => {
            const resolvedType = getActiveRecoveryWorkspaceType();
            const selectedName = String(recoverySelectedBackupByType[resolvedType] || '').trim();
            if (!selectedName) {
                showError(repairT710d5dec("common.repair.restore-failed-b8476c", "Restore failed"), new Error(translate("common.audit.select-backup", "Select a backup first.")));
                return;
            }
            restoreBackupEntry(resolvedType, selectedName);
        };
        const downloadSelectedActiveRecoveryBackup = () => {
            const resolvedType = getActiveRecoveryWorkspaceType();
            const selectedName = String(recoverySelectedBackupByType[resolvedType] || '').trim();
            if (!selectedName) {
                showError('Download failed', new Error(translate("common.audit.select-backup", "Select a backup first.")));
                return;
            }
            downloadBackupEntry(resolvedType, selectedName);
        };
        const deleteSelectedActiveRecoveryBackup = () => {
            const resolvedType = getActiveRecoveryWorkspaceType();
            const selectedName = String(recoverySelectedBackupByType[resolvedType] || '').trim();
            if (!selectedName) {
                showError(repairT710d5dec("common.repair.delete-failed-8727e2", "Delete failed"), new Error(translate("common.audit.select-backup", "Select a backup first.")));
                return;
            }
            deleteBackupEntry(resolvedType, selectedName);
        };
        const deleteAllActiveRecoveryBackups = () => deleteAllBackupEntries(getActiveRecoveryWorkspaceType());
        const runActiveRecoveryScheduler = () => runScheduledBackupNow(getActiveRecoveryWorkspaceType());
        const compareActiveRecoverySnapshots = () => {
            const resolvedType = getActiveRecoveryWorkspaceType();
            syncHiddenRecoveryCompareControls(resolvedType);
            compareBackupSnapshots(resolvedType);
        };
        const changeActiveBackupSchedulePref = (key, value) => changeBackupSchedulePref(getActiveRecoveryWorkspaceType(), key, value);
        const undoActiveRecoveryChange = () => undoLatestChange(getActiveRecoveryWorkspaceType());

        const normalizeRulesWorkspaceType = (value) => (
            String(value || '').trim().toLowerCase() === 'vm' ? 'vm' : 'docker'
        );

        const syncRulesWorkspaceUi = () => {
            const activeType = normalizeRulesWorkspaceType(getActiveRulesWorkspaceTypeValue());
            documentRef?.querySelectorAll('[data-fv-rules-source-toggle]').forEach((button) => {
                if (!(button instanceof windowRef.HTMLButtonElement)) {
                    return;
                }
                const buttonType = normalizeRulesWorkspaceType(button.getAttribute('data-fv-rules-source-toggle'));
                const isActive = buttonType === activeType;
                button.classList.toggle('is-active', isActive);
                button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            });
            documentRef?.querySelectorAll('.fv-rules-workspace[data-fv-rules-type], .fv-rule-troubleshoot-panel[data-fv-rules-type]').forEach((panel) => {
                if (!(panel instanceof windowRef.HTMLElement)) {
                    return;
                }
                const panelType = normalizeRulesWorkspaceType(panel.getAttribute('data-fv-rules-type'));
                const isActive = panelType === activeType;
                panel.hidden = !isActive;
                panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
            });
        };

        const setRulesWorkspaceType = (type, persist = true) => {
            const resolvedType = normalizeRulesWorkspaceType(type);
            setActiveRulesWorkspaceTypeValue(resolvedType);
            if (persist) {
                writeSettingsStorage(RULES_WORKSPACE_STORAGE_KEY, resolvedType, { delayMs: 60, idle: true });
            }
            syncRulesWorkspaceUi();
            renderRulesTable(resolvedType);
            updateRuleLiveMatch(resolvedType);
            updateRuleValidationHint(resolvedType);
        };

        const normalizeOperationsWorkspaceType = (value) => (
            String(value || '').trim().toLowerCase() === 'vm' ? 'vm' : 'docker'
        );

        const getLatestTemplateForType = (type) => {
            const resolvedType = normalizeOperationsWorkspaceType(type);
            const templates = Array.isArray(templatesByType[resolvedType]) ? templatesByType[resolvedType] : [];
            if (!templates.length) {
                return null;
            }
            return [...templates].sort((left, right) => {
                const leftTime = Date.parse(String(left?.updatedAt || left?.createdAt || 0));
                const rightTime = Date.parse(String(right?.updatedAt || right?.createdAt || 0));
                return rightTime - leftTime;
            })[0] || null;
        };

        const buildOperationsOverviewHtml = (type) => {
            const resolvedType = normalizeOperationsWorkspaceType(type);
            const title = resolvedType === 'docker' ? 'Docker' : 'VM';
            const folders = Object.keys(getFolderMap(resolvedType));
            const folderCount = folders.length;
            const templates = Array.isArray(templatesByType[resolvedType]) ? templatesByType[resolvedType] : [];
            const templateCount = templates.length;
            const latestTemplate = getLatestTemplateForType(resolvedType);
            const latestLabel = latestTemplate ? formatTimestamp(latestTemplate.updatedAt || latestTemplate.createdAt || '') : translate("settings.operations.not-saved", "Not saved yet");
            const headline = templateCount
                ? translate("settings.operations.summary", "Saved templates: $1. Available folders: $2.", templateCount, folderCount)
                : translate("settings.operations.no-templates", "No saved $1 templates yet.", title);
            const copy = folderCount
                ? translate("settings.operations.available-help", "Run folder actions or reuse templates here. Available $1 folders: $2.", title, folderCount)
                : translate("settings.operations.create-first", "Create your first $1 folder to use folder actions and reusable templates here.", title);
            return `
                <div class="fv-operations-overview-head">
                    <div>
                        <span class="fv-operations-source-label">${escapeHtml(title)}</span>
                        <div class="fv-operations-headline">${escapeHtml(headline)}</div>
                        <div class="fv-operations-copy">${escapeHtml(copy)}</div>
                    </div>
                    <span class="fv-recovery-history-badge">${escapeHtml(templateCount > 0 ? translate("common.state.ready", "Ready") : translate("settings.operations.needs-template", "Needs first template"))}</span>
                </div>
                <div class="fv-operations-stat-grid">
                    <div class="fv-operations-stat-card">
                        <span class="fv-operations-stat-label">Folders</span>
                        <strong>${escapeHtml(String(folderCount))}</strong>
                        <span>${escapeHtml(translate("settings.operations.folders-available", "$1 folders available", title))}</span>
                    </div>
                    <div class="fv-operations-stat-card">
                        <span class="fv-operations-stat-label">Templates</span>
                        <strong>${escapeHtml(String(templateCount))}</strong>
                        <span>${escapeHtml(translate("settings.operations.presets-ready", "Saved presets ready"))}</span>
                    </div>
                    <div class="fv-operations-stat-card">
                        <span class="fv-operations-stat-label">Live actions</span>
                        <strong>4</strong>
                        <span>Start, stop, pause, resume</span>
                    </div>
                    <div class="fv-operations-stat-card">
                        <span class="fv-operations-stat-label">Latest template</span>
                        <strong>${escapeHtml(latestLabel)}</strong>
                        <span ${latestTemplate?.name ? 'data-fvplus-user-content' : ''}>${escapeHtml(latestTemplate?.name || translate("settings.operations.save-help", "Save one from a folder"))}</span>
                    </div>
                </div>
            `;
        };

        const renderOperationsOverview = (type) => {
            const resolvedType = normalizeOperationsWorkspaceType(type);
            const host = $(`#${resolvedType}-operations-overview`);
            if (!host.length) {
                return;
            }
            host.html(buildOperationsOverviewHtml(resolvedType));
        };

        const buildRuntimePreviewHtml = (type, folderId, action, plan, result = null) => {
            const resolvedType = normalizeOperationsWorkspaceType(type);
            if (!plan) {
                return `
                    <div class="fv-recovery-empty-state">
                        <strong>No runtime action preview yet.</strong>
                        <span>${escapeHtml(translate("settings.operations.preview-help", "Select a $1 folder and action, then preview the plan before applying it.", resolvedType === 'docker' ? 'Docker' : 'VM'))}</span>
                    </div>
                `;
            }
            const folderName = getFolderNameForId(resolvedType, folderId);
            const eligiblePreview = plan.eligible.slice(0, 6);
            const skippedPreview = plan.skipped.slice(0, 6);
            const eligibleOverflow = Math.max(0, plan.eligible.length - eligiblePreview.length);
            const skippedOverflow = Math.max(0, plan.skipped.length - skippedPreview.length);
            const resultCopy = result
                ? `Applied ${action} to ${result.executed || 0} item(s). ${result.succeeded || 0} succeeded, ${result.failed || 0} failed.`
                : `Preview which ${resolvedType === 'docker' ? 'containers' : 'VMs'} will change before applying ${action}.`;
            return `
                <div class="fv-operations-runtime-summary">
                    <div class="fv-operations-runtime-head">
                        <div>
                            <div class="fv-operations-runtime-title">${escapeHtml(folderName)} - ${escapeHtml(String(action || '').toUpperCase())}</div>
                            <div class="fv-operations-runtime-copy">${escapeHtml(resultCopy)}</div>
                        </div>
                        ${result ? `<span class="fv-recovery-history-badge">${(result.failed || 0) > 0 ? 'Completed with warnings' : 'Applied'}</span>` : ''}
                    </div>
                    <div class="fv-operations-stat-grid fv-operations-runtime-stats">
                        <div class="fv-operations-stat-card">
                            <span class="fv-operations-stat-label">Requested</span>
                            <strong>${escapeHtml(String(plan.requestedCount || 0))}</strong>
                            <span>Items in folder</span>
                        </div>
                        <div class="fv-operations-stat-card">
                            <span class="fv-operations-stat-label">Eligible</span>
                            <strong>${escapeHtml(String(plan.eligible.length || 0))}</strong>
                            <span>Can change now</span>
                        </div>
                        <div class="fv-operations-stat-card">
                            <span class="fv-operations-stat-label">Skipped</span>
                            <strong>${escapeHtml(String(plan.skipped.length || 0))}</strong>
                            <span>Already in desired state</span>
                        </div>
                        <div class="fv-operations-stat-card">
                            <span class="fv-operations-stat-label">State mix</span>
                            <strong>${escapeHtml(`${plan.countsByState?.started || 0}/${plan.countsByState?.paused || 0}/${plan.countsByState?.stopped || 0}`)}</strong>
                            <span>started / paused / stopped</span>
                        </div>
                    </div>
                    <div class="fv-operations-runtime-columns">
                        <div class="fv-operations-runtime-list">
                            <strong>Will change</strong>
                            ${eligiblePreview.length ? `
                                <ul>
                                    ${eligiblePreview.map((row) => `<li>${escapeHtml(row.name)} <span>${escapeHtml(row.state || 'unknown')}</span></li>`).join('')}
                                </ul>
                                ${eligibleOverflow > 0 ? `<div class="fv-operations-runtime-more">+${eligibleOverflow} more eligible item(s)</div>` : ''}
                            ` : '<div class="fv-operations-runtime-empty">No eligible items for this action.</div>'}
                        </div>
                        <div class="fv-operations-runtime-list">
                            <strong>Skipped</strong>
                            ${skippedPreview.length ? `
                                <ul>
                                    ${skippedPreview.map((row) => `<li>${escapeHtml(row.name)} <span>${escapeHtml(row.reason || row.state || 'skipped')}</span></li>`).join('')}
                                </ul>
                                ${skippedOverflow > 0 ? `<div class="fv-operations-runtime-more">+${skippedOverflow} more skipped item(s)</div>` : ''}
                            ` : '<div class="fv-operations-runtime-empty">Nothing is being skipped.</div>'}
                        </div>
                    </div>
                </div>
            `;
        };

        const setRuntimePreviewOutput = (type, html) => {
            const resolvedType = normalizeOperationsWorkspaceType(type);
            const host = $(`#${resolvedType}-runtime-preview-output`);
            if (!host.length) {
                return;
            }
            host.html(String(html || ''));
        };

        const renderOperationsWorkspace = () => {
            const activeType = normalizeOperationsWorkspaceType(getActiveOperationsWorkspaceTypeValue());
            documentRef?.querySelectorAll('[data-fv-operations-source-toggle]').forEach((button) => {
                if (!(button instanceof windowRef.HTMLButtonElement)) {
                    return;
                }
                const buttonType = normalizeOperationsWorkspaceType(button.getAttribute('data-fv-operations-source-toggle'));
                const isActive = buttonType === activeType;
                button.classList.toggle('is-active', isActive);
                button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            });
            documentRef?.querySelectorAll('[data-fv-operations-panel]').forEach((panel) => {
                if (!(panel instanceof windowRef.HTMLElement)) {
                    return;
                }
                const panelType = normalizeOperationsWorkspaceType(panel.getAttribute('data-fv-operations-panel'));
                const isActive = panelType === activeType;
                panel.hidden = !isActive;
                panel.classList.toggle('is-active', isActive);
            });
        };

        const setOperationsWorkspaceType = (type, persist = true) => {
            const resolvedType = normalizeOperationsWorkspaceType(type);
            setActiveOperationsWorkspaceTypeValue(resolvedType);
            if (persist) {
                writeSettingsStorage(OPERATIONS_WORKSPACE_STORAGE_KEY, resolvedType, { delayMs: 60, idle: true });
            }
            renderOperationsWorkspace();
        };

        const selectOperationsTemplate = (type, templateId) => {
            const resolvedType = normalizeOperationsWorkspaceType(type);
            selectedOperationsTemplateIdByType[resolvedType] = String(templateId || '').trim();
            renderTemplateRows(resolvedType);
        };

        const exportTemplateEntry = (type, templateId) => {
            const resolvedType = normalizeOperationsWorkspaceType(type);
            const template = (templatesByType[resolvedType] || []).find((entry) => String(entry?.id || '') === String(templateId || ''));
            if (!template) {
                windowRef?.swal?.({ title: 'Template not found', text: 'Select a valid template first.', type: 'warning' });
                return;
            }
            const payload = {
                schemaVersion: 1,
                exportedAt: new Date().toISOString(),
                type: resolvedType,
                mode: 'templates',
                templates: [template]
            };
            downloadFile(`FolderView Plus ${resolvedType.toUpperCase()} Template - ${template.name || template.id}.json`, toPrettyJson(payload));
        };

        const renderTemplateRows = (type) => {
            const resolvedType = normalizeOperationsWorkspaceType(type);
            const host = $(`#${resolvedType}-operations-template-library`);
            if (!host.length) {
                return;
            }
            const allTemplates = templatesByType[resolvedType] || [];
            const folders = getFolderMap(resolvedType);
            const folderOptions = Object.entries(folders).map(([id, folder]) => (
                `<option value="${escapeHtml(id)}">${escapeHtml(folder.name || id)}</option>`
            )).join('');

            if (!allTemplates.length) {
                selectedOperationsTemplateIdByType[resolvedType] = '';
                host.html(`
                    <div class="fv-recovery-empty-state">
                        <strong>${escapeHtml(translate("settings.operations.no-templates", "No saved $1 templates yet.", resolvedType === 'docker' ? 'Docker' : 'VM'))}</strong>
                        <span>Create one from an existing folder to reuse icon, settings, actions, and matching logic faster.</span>
                    </div>
                `);
                return;
            }

            const selectedTemplateId = String(selectedOperationsTemplateIdByType[resolvedType] || '').trim();
            const selectedTemplate = allTemplates.find((template) => String(template?.id || '') === selectedTemplateId) || allTemplates[0];
            const resolvedTemplateId = String(selectedTemplate?.id || '').trim();
            selectedOperationsTemplateIdByType[resolvedType] = resolvedTemplateId;
            const templateSelectOptions = allTemplates.map((template) => {
                const templateId = String(template?.id || '');
                const templateName = String(template?.name || templateId);
                const updated = formatTimestamp(template?.updatedAt || template?.createdAt || '');
                const selectedAttr = templateId === resolvedTemplateId ? ' selected' : '';
                const optionLabel = [templateName, updated].filter(Boolean).join(' - ');
                return `<option value="${escapeHtml(templateId)}"${selectedAttr}>${escapeHtml(optionLabel)}</option>`;
            }).join('');
            const targetSelectId = `${resolvedType}-operations-template-target-folder`;
            const templateUpdated = formatTimestamp(selectedTemplate?.updatedAt || selectedTemplate?.createdAt || '');
            const templateName = String(selectedTemplate?.name || resolvedTemplateId);
            const folderCount = Object.keys(folders).length;
            host.html(`
                <div class="fv-operations-template-picker-row">
                    <label for="${escapeHtml(`${resolvedType}-operations-template-select`)}">Saved template</label>
                    <select id="${escapeHtml(`${resolvedType}-operations-template-select`)}" data-fv-onchange="selectOperationsTemplate('${resolvedType}', this.value)">
                        ${templateSelectOptions}
                    </select>
                </div>
                <div class="fv-operations-template-card">
                    <div class="fv-operations-template-head">
                        <div>
                            <div class="fv-operations-template-title" data-fvplus-user-content>${escapeHtml(templateName)}</div>
                            <div class="fv-operations-template-copy">${escapeHtml(repairT710d5dec("common.repair.updated-1-ready-to-apply-to-folders-count-2-e1356a", "Updated: $1. Ready to apply to folders (count: $2).", templateUpdated, folderCount))}</div>
                        </div>
                        <span class="fv-recovery-history-badge">${escapeHtml(selectedTemplate?.id || '')}</span>
                    </div>
                    <div class="fv-operations-template-target-row">
                        <label for="${escapeHtml(targetSelectId)}">Apply to folder</label>
                        <select id="${escapeHtml(targetSelectId)}">${folderOptions}</select>
                    </div>
                    <div class="backup-actions fv-operations-template-actions">
                        <button type="button" data-fv-onclick="applyTemplateToFolder('${resolvedType}','${escapeHtml(resolvedTemplateId)}','${escapeHtml(targetSelectId)}')"><i class="fa fa-clone"></i> Apply to folder</button>
                        <button type="button" data-fv-onclick="exportTemplateEntry('${resolvedType}','${escapeHtml(resolvedTemplateId)}')"><i class="fa fa-download"></i> Export</button>
                        <button type="button" data-fv-onclick="deleteTemplateEntry('${resolvedType}','${escapeHtml(resolvedTemplateId)}')"><i class="fa fa-trash"></i> Delete</button>
                    </div>
                </div>
            `);
        };

        return Object.freeze({
            normalizeRecoveryWorkspaceType,
            getActiveRecoveryWorkspaceType,
            buildRecoveryOverviewHtml,
            buildRecoveryBackupHistoryHtml,
            syncVisibleRecoveryCompareControls,
            syncHiddenRecoveryCompareControls,
            renderRecoveryWorkspace,
            syncRecoveryWorkspaceUi,
            setRecoveryWorkspaceType,
            selectActiveRecoveryBackup,
            filterActiveRecoveryBackups,
            createActiveRecoveryBackup,
            restoreLatestActiveRecoveryBackup,
            restoreSelectedActiveRecoveryBackup,
            downloadSelectedActiveRecoveryBackup,
            deleteSelectedActiveRecoveryBackup,
            deleteAllActiveRecoveryBackups,
            renderRecoveryEnvironmentSummary,
            exportEnvironmentSnapshot,
            importEnvironmentSnapshot,
            runActiveRecoveryScheduler,
            compareActiveRecoverySnapshots,
            changeActiveBackupSchedulePref,
            undoActiveRecoveryChange,
            normalizeRulesWorkspaceType,
            syncRulesWorkspaceUi,
            setRulesWorkspaceType,
            normalizeOperationsWorkspaceType,
            buildOperationsOverviewHtml,
            renderOperationsOverview,
            buildRuntimePreviewHtml,
            setRuntimePreviewOutput,
            renderOperationsWorkspace,
            setOperationsWorkspaceType,
            selectOperationsTemplate,
            exportTemplateEntry,
            renderTemplateRows
        });
    };

    return Object.freeze({
        createApi
    });
}));
