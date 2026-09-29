(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./folderviewplus.environment.js'));
        return;
    }
    root.FolderViewPlusSettingsWorkspaces = factory(root.FolderViewPlusFoundationModules?.environment);
    root.FolderViewPlusSettingsWorkspacesModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function(environmentModule) {
    const boundRecoveryDocuments = new WeakSet();
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
        const recoveryShowAllByType = { docker: false, vm: false };
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
        const unavailableRequest = async () => { throw new Error(translate('settings.environment.client-unavailable', 'The environment request client is unavailable. Refresh the page and try again.')); };
        const apiGetJson = typeof deps.apiGetJson === 'function' ? deps.apiGetJson : unavailableRequest;
        const apiPostJson = typeof deps.apiPostJson === 'function' ? deps.apiPostJson : unavailableRequest;
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
                return translate('legacy.surface.6d2b3b0b56fe2760', 'Export ready');
            }
            if (mode === 'preview') {
                return translate('legacy.surface.954fcf76ac50e19a', 'Preview ready');
            }
            if (mode === 'import') {
                return translate('import.folderview3.order-imported', 'Imported');
            }
            return translate('legacy.surface.df5ddf26cf00e6be', 'Portable backup');
        };
        const environmentSortLabel = (mode) => environmentModule.sortModeLabel(mode, translate);
        const buildRecoveryEnvironmentSummaryHtml = () => {
            if (!recoveryEnvironmentSummary) {
                return '';
            }

            const summary = recoveryEnvironmentSummary;
            const themeLabel = summary.themeWorkspace.activeThemeName || summary.themeWorkspace.activeThemeId || translate('legacy.surface.be30919530bc7097', 'No active managed theme');
            const exportedAt = summary.exportedAt ? formatTimestamp(summary.exportedAt) : translate('legacy.surface.a00372c6eccfb986', 'Unknown export time');
            const warningHtml = summary.warnings.map((warning) => (
                `<div class="fv-recovery-callout">${escapeHtml(warning)}</div>`
            )).join('');

            return `
                <article class="fv-recovery-history-card fv-recovery-environment-card">
                    <div class="fv-recovery-history-head">
                        <div>
                            <div class="fv-recovery-history-title">${escapeHtml(getRecoveryEnvironmentModeLabel(recoveryEnvironmentMode))}</div>
                            <div class="fv-recovery-history-copy" data-i18n-ignore>${escapeHtml(summary.sourceName || translate('legacy.surface.288a085ed7ff8e0f', 'FolderView Plus Environment snapshot'))}</div>
                        </div>
                        <span class="fv-recovery-history-badge">${escapeHtml(translate('settings.environment.badge', 'Environment'))}</span>
                    </div>
                    <div class="fv-recovery-history-meta">
                        <span>${escapeHtml(translate('legacy.surface.6a38c3740360964f', 'Exported $1', exportedAt))}</span>
                        <span>${escapeHtml(translate('legacy.surface.e6613a7c1200cead', 'Snapshot plugin $1', summary.pluginVersion || translate('common.runtime.unknown', 'Unknown')))}</span>
                        <span>${escapeHtml(repairT710d5dec("common.repair.docker-folders-1-41f18c", "Docker folders: $1", summary.docker.folderCount))}</span>
                        <span>${escapeHtml(repairT710d5dec("common.repair.vm-folders-1-e73ec2", "VM folders: $1", summary.vm.folderCount))}</span>
                        <span>${escapeHtml(repairT710d5dec("common.repair.managed-themes-1-91e84d", "Managed themes: $1", summary.themeWorkspace.managedThemeCount))}</span>
                    </div>
                    <div class="fv-recovery-environment-meta">
                        <span>${escapeHtml(translate('legacy.surface.40dab9de15aeeaf8', 'Docker sort: $1', environmentSortLabel(summary.docker.sortMode)))}</span>
                        <span>${escapeHtml(translate('legacy.surface.edff718d85e25ea9', 'VM sort: $1', environmentSortLabel(summary.vm.sortMode)))}</span>
                        <span>${escapeHtml(translate('diagnostics.cards.theme', 'Theme'))}: <span data-i18n-ignore>${escapeHtml(themeLabel)}</span></span>
                        <span>${escapeHtml(translate('legacy.surface.8a36f1c826a82414', 'Custom CSS $1 bytes', summary.themeWorkspace.customCssBytes))}</span>
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
                <div class="preview-meta-item"><span>${escapeHtml(translate("legacy.surface.f4185ed93100719d", "Docker folders"))}</span><strong>${escapeHtml(String(summary.docker.folderCount))}</strong></div>
                <div class="preview-meta-item"><span>${escapeHtml(translate("legacy.surface.50a1502d1a6beddb", "VM folders"))}</span><strong>${escapeHtml(String(summary.vm.folderCount))}</strong></div>
                <div class="preview-meta-item"><span>${escapeHtml(translate("settings.theme.managed-themes", "Managed themes"))}</span><strong>${escapeHtml(String(summary.themeWorkspace.managedThemeCount))}</strong></div>
                <div class="preview-meta-item"><span>${escapeHtml(translate("legacy.surface.391065e4dc23592a", "Exported"))}</span><strong>${escapeHtml(summary.exportedAt ? formatTimestamp(summary.exportedAt) : translate('common.runtime.unknown', 'Unknown'))}</strong></div>
            </div>
            <p class="rules-help">${escapeHtml(translate("legacy.surface.0f7ba62a28a752d6", "This replaces Docker folders, VM folders, preferences, folder defaults, and Theme Workspace on this install. A rollback checkpoint plus fresh Docker and VM safety backups are created first."))}</p>
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

        const exportEnvironmentSnapshot = () => environmentModule.exportSnapshot({
            apiGetJson, setRecoveryEnvironmentSummary, downloadFile, buildEnvironmentSnapshotFileName,
            toPrettyJson, showToastMessage, showError, translate
        });

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
            const scheduleEnabled = schedule.enabled === true;
            const interval = Number.isFinite(Number(schedule.intervalHours)) ? Number(schedule.intervalHours) : 1;
            const latestCreated = latest?.createdAt ? formatTimestamp(latest.createdAt) : translate("settings.recovery.not-created", "Not created yet");
            const latestRestorableCreated = latestRestorable?.createdAt ? formatTimestamp(latestRestorable.createdAt) : translate("settings.recovery.none-available", "None available");
            const folderCount = Object.keys(folders || {}).length;
            const headline = latestRestorable
                ? translate("settings.recovery.ready", "$1 recovery is ready.", title)
                : translate("settings.recovery.no-restorable", "No restorable $1 backup is available yet.", title);
            const copy = latestRestorable
                ? translate("settings.recovery.restore-summary", "Restore Latest will use $1 and create a fresh safety backup first when folders exist.", latestRestorableCreated)
                : (latest
                    ? translate("settings.recovery.only-empty", "Only empty snapshots were found. Restore Latest skips empty backups so it does not roll you back to no folders.")
                    : translate("settings.recovery.create-first", "Create a manual backup before making larger changes so you have a safe rollback point."));
            return `
                <div class="fv-recovery-hero">
                    <div class="fv-recovery-hero-status ${latestRestorable ? 'is-ready' : 'is-warning'}" aria-hidden="true">${latestRestorable ? '&#10003;' : '!'}</div>
                    <div class="fv-recovery-hero-copy">
                        <div class="fv-recovery-headline">${escapeHtml(headline)}</div>
                        <div class="fv-recovery-copy">${escapeHtml(copy)}</div>
                    </div>
                    <div class="fv-recovery-stat-grid">
                        <div class="fv-recovery-stat-card"><i class="fa fa-folder-o" aria-hidden="true"></i><div><strong>${escapeHtml(folderCount)}</strong><span>${escapeHtml(translate('settings.recovery.folders-label', 'folders'))}</span></div></div>
                        <div class="fv-recovery-stat-card"><i class="fa fa-database" aria-hidden="true"></i><div><strong>${escapeHtml(backupCount)}</strong><span>${escapeHtml(translate('settings.recovery.snapshots-label', 'snapshots'))}</span></div></div>
                        <div class="fv-recovery-stat-card"><i class="fa fa-calendar" aria-hidden="true"></i><div><strong>${escapeHtml(latestCreated)}</strong><span>${escapeHtml(translate('settings.recovery.latest-snapshot', 'latest snapshot'))}</span></div></div>
                        <div class="fv-recovery-stat-card"><i class="fa fa-file-text-o" aria-hidden="true"></i><div><strong>${escapeHtml(scheduleEnabled ? translate("settings.recovery.every-hours", "Every $1 h", interval) : translate("settings.recovery.manual-only", "Manual only"))}</strong><span>${escapeHtml(translate("legacy.surface.d18859e1983720b1", "Backup policy"))}</span></div></div>
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
                        <span>${escapeHtml(translate("legacy.surface.0ca3fb7e46a9d1d6", "Create a manual backup or run the scheduler to build recovery history."))}</span>
                    </div>
                `;
            }

            const selectedName = String(recoverySelectedBackupByType[resolvedType] || '').trim();
            const selectedBackup = backups.find((backup) => String(backup?.name || '').trim() === selectedName) || backups[0];
            const resolvedSelectedName = String(selectedBackup?.name || '').trim();
            recoverySelectedBackupByType[resolvedType] = resolvedSelectedName;
            const visibleBackups = recoveryShowAllByType[resolvedType] ? backups : backups.slice(0, 5);
            const recentHtml = visibleBackups.map((backup, index) => {
                const name = String(backup?.name || '').trim();
                const activeClass = name === resolvedSelectedName ? ' is-active' : '';
                const backupCreated = formatTimestamp(backup?.createdAt || '');
                const isSelected = name === resolvedSelectedName;
                return `
                    <div class="fv-recovery-snapshot-row${activeClass}">
                        <button type="button" class="fv-recovery-snapshot-item" data-fv-onclick="selectActiveRecoveryBackup('${escapeHtml(escapeJsString(name))}')" aria-pressed="${isSelected}">
                            <strong>${escapeHtml(backupCreated)}</strong>
                            <small>${escapeHtml(formatRecoveryReasonLabel(backup?.reason))} · ${escapeHtml(formatRecoveryBackupFolderCount(backup))}</small>
                            <span class="fv-recovery-snapshot-filename" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
                        </button>
                        <span class="fv-recovery-history-badges">${index === 0 ? `<span class="fv-recovery-history-badge">${escapeHtml(translate("legacy.surface.8730d3c2022abf1f", "Latest"))}</span>` : ''}${isRecoveryBackupEmpty(backup) ? `<span class="fv-recovery-history-badge is-warning">${escapeHtml(translate("legacy.surface.c6c094bc0054f9cb", "Empty"))}</span>` : ''}</span>
                        ${isSelected ? `<div class="fv-recovery-history-actions-row">
                            <button type="button" data-fv-onclick="restoreSelectedActiveRecoveryBackup()"><i class="fa fa-history" aria-hidden="true"></i> ${escapeHtml(translate("legacy.surface.a76e13b9839270eb", "Restore"))}</button>
                            <button type="button" data-fv-onclick="downloadSelectedActiveRecoveryBackup()"><i class="fa fa-download" aria-hidden="true"></i> ${escapeHtml(translate("legacy.surface.d6eafe8235910042", "Download"))}</button>
                            <button type="button" class="fv-recovery-danger-action" data-fv-onclick="deleteSelectedActiveRecoveryBackup()"><i class="fa fa-trash" aria-hidden="true"></i> ${escapeHtml(translate("legacy.surface.e2d0a54968ead24e", "Delete"))}</button>
                        </div>` : `<i class="fa fa-chevron-right fv-recovery-row-chevron" aria-hidden="true"></i>`}
                    </div>
                `;
            }).join('');

            summaryEl.text(translate("settings.recovery.history-summary", "Snapshots available: $1. Empty snapshots remain in the history but Restore Latest skips them.", backups.length));
            return `
                <div class="fv-recovery-snapshot-items">${recentHtml}</div>
                ${backups.length > 5 ? `<button type="button" class="fv-recovery-view-all" data-fv-onclick="toggleAllRecoverySnapshots()">${escapeHtml(recoveryShowAllByType[resolvedType] ? translate('settings.recovery.show-recent', 'Show recent snapshots') : translate('settings.recovery.view-all', 'View all snapshots'))} <i class="fa fa-arrow-right" aria-hidden="true"></i></button>` : ''}
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

        const recoveryMarkup = new WeakMap();
        const updateRecoveryHtml = (host, html) => {
            const node = host[0];
            if (node && recoveryMarkup.get(node) === html) return;
            host.html(html);
            if (node) recoveryMarkup.set(node, html);
        };
        const renderRecoveryWorkspace = (type = getActiveRecoveryWorkspaceType()) => {
            const resolvedType = normalizeRecoveryWorkspaceType(type);
            const overviewHost = $('#fv-recovery-overview');
            const listHost = $('#fv-recovery-backup-list');
            const policySummary = $('#fv-recovery-policy-summary');
            if (!overviewHost.length || !listHost.length) {
                return;
            }

            setActiveRecoveryWorkspaceTypeValue(resolvedType);
            const prefs = typeof utils.normalizePrefs === 'function' ? utils.normalizePrefs(prefsByType[resolvedType]) : (prefsByType[resolvedType] || {});
            const schedule = prefs.backupSchedule || {};
            const latestRestorable = getLatestRestorableRecoveryBackup(getSortedBackupsForType(resolvedType));

            $('#fv-recovery-restore-latest').prop('disabled', !latestRestorable);
            updateRecoveryHtml(overviewHost, buildRecoveryOverviewHtml(resolvedType));
            updateRecoveryHtml(listHost, buildRecoveryBackupHistoryHtml(resolvedType));
            renderRecoveryEnvironmentSummary();
            policySummary.text(schedule.enabled === true
                ? translate("settings.recovery.every-hours", "Every $1 h", schedule.intervalHours || 1)
                : translate("settings.recovery.manual-only", "Manual only"));
            const policyDetails = $('#fv-recovery-policy-details');
            if (policyDetails.length) {
                const scheduleEnabled = schedule.enabled === true;
                const interval = Number(schedule.intervalHours) || 1;
                const retention = Number(schedule.retention) || 25;
                const detailRows = [
                    ['fa-clock-o', translate('settings.recovery.scheduled-backups', 'Scheduled backups'), scheduleEnabled ? translate('settings.recovery.enabled', 'Enabled') : translate('settings.recovery.disabled', 'Disabled')],
                    ['fa-clock-o', translate('settings.recovery.interval', 'Interval'), translate('settings.recovery.every-hours', 'Every $1 h', interval)],
                    ['fa-database', translate('settings.recovery.retention', 'Retention (snapshots)'), retention],
                    ['fa-calendar', translate('settings.recovery.last-scheduled-label', 'Last scheduled run'), schedule.lastRunAt ? formatTimestamp(schedule.lastRunAt) : translate('settings.recovery.never', 'Never')],
                    ['fa-shield', translate('settings.recovery.protected-items', 'Protected items'), translate('legacy.surface.630ecf9943abba05', 'Folders, rules, preferences, defaults, and workspace settings. Container data and VM disks are not included.')]
                ];
                updateRecoveryHtml(policyDetails, detailRows.map(([icon, label, value]) => `<div class="fv-recovery-policy-row"><i class="fa ${icon}" aria-hidden="true"></i><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join(''));
            }
            $('#recovery-backup-schedule-enabled').prop('checked', schedule.enabled === true);
            $('#recovery-backup-interval-hours').val(String(schedule.intervalHours || 1));
            $('#recovery-backup-retention').val(String(schedule.retention || 25));
            $('#recovery-backup-last-run').text(schedule.lastRunAt ? translate('settings.recovery.last-run', 'Last run: $1', formatTimestamp(schedule.lastRunAt)) : translate('settings.recovery.never-scheduled', 'Last scheduled run: never'));
            syncVisibleRecoveryCompareControls(resolvedType);
        };

        const syncRecoveryWorkspaceUi = () => {
            if (documentRef?.addEventListener && !boundRecoveryDocuments.has(documentRef)) {
                documentRef.addEventListener('click', (event) => {
                    const button = event.target?.closest?.('[data-fv-recovery-disclosure], [data-fv-recovery-action]');
                    if (!button?.closest?.('.fv-recovery-module-wrap')) return;
                    const disclosure = button.getAttribute('data-fv-recovery-disclosure');
                    if (disclosure === 'fv-recovery-compare-panel' || disclosure === 'fv-recovery-policy-editor') {
                        toggleRecoveryDisclosure(disclosure);
                    } else if (button.getAttribute('data-fv-recovery-action') === 'delete-all') {
                        deleteAllActiveRecoveryBackups();
                    }
                });
                boundRecoveryDocuments.add(documentRef);
            }
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
            const keepFocus = documentRef?.activeElement?.classList?.contains('fv-recovery-snapshot-item') === true;
            recoverySelectedBackupByType[resolvedType] = String(name || '').trim();
            renderRecoveryWorkspace(resolvedType);
            if (keepFocus) documentRef.querySelector('.fv-recovery-snapshot-item[aria-pressed="true"]')?.focus({ preventScroll: true });
        };

        const toggleAllRecoverySnapshots = () => {
            const type = getActiveRecoveryWorkspaceType();
            const keepFocus = documentRef?.activeElement?.classList?.contains('fv-recovery-view-all') === true;
            recoveryShowAllByType[type] = !recoveryShowAllByType[type];
            if (!recoveryShowAllByType[type]) {
                const recent = getSortedBackupsForType(type).slice(0, 5);
                if (!recent.some((backup) => String(backup?.name || '').trim() === recoverySelectedBackupByType[type])) {
                    recoverySelectedBackupByType[type] = String(recent[0]?.name || '').trim();
                }
            }
            renderRecoveryWorkspace(type);
            if (keepFocus) documentRef.querySelector('.fv-recovery-view-all')?.focus({ preventScroll: true });
        };

        const toggleRecoveryDisclosure = (id) => {
            const target = documentRef?.getElementById(id);
            if (!target || !['fv-recovery-compare-panel', 'fv-recovery-policy-editor'].includes(id)) return;
            target.hidden = !target.hidden;
            documentRef.querySelectorAll(`[data-fv-recovery-disclosure="${id}"]`).forEach((button) => {
                button.setAttribute('aria-expanded', target.hidden ? 'false' : 'true');
            });
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

        const buildRuntimePreviewHtml = (type, folderId, action, plan, result = null) => {
            const resolvedType = normalizeOperationsWorkspaceType(type);
            if (!plan) {
                return `
                    <div class="fv-recovery-empty-state">
                        <strong>${escapeHtml(translate("settings.operations.preview-unavailable", "Unable to preview this action."))}</strong>
                        <span>${escapeHtml(translate("settings.operations.preview-retry", "Refresh the folder data and try again."))}</span>
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
                : translate("settings.operations.plan-summary", "$1 eligible, $2 skipped", plan.eligible.length, plan.skipped.length);
            return `
                <div class="fv-operations-runtime-summary">
                    <div class="fv-operations-runtime-head">
                        <div>
                            <div class="fv-operations-runtime-title">${escapeHtml(folderName)} - ${escapeHtml(String(action || '').toUpperCase())}</div>
                            <div class="fv-operations-runtime-copy">${escapeHtml(resultCopy)}</div>
                        </div>
                        ${result ? `<span class="fv-recovery-history-badge">${(result.failed || 0) > 0 ? 'Completed with warnings' : 'Applied'}</span>` : ''}
                    </div>
                    <div class="fv-operations-runtime-columns">
                        <div class="fv-operations-runtime-list">
                            <strong>${escapeHtml(translate("legacy.surface.de1b6744e82ff61e", "Will change"))}</strong>
                            ${eligiblePreview.length ? `
                                <ul>
                                    ${eligiblePreview.map((row) => `<li>${escapeHtml(row.name)} <span>${escapeHtml(row.state || 'unknown')}</span></li>`).join('')}
                                </ul>
                                ${eligibleOverflow > 0 ? `<div class="fv-operations-runtime-more">+${eligibleOverflow} more eligible item(s)</div>` : ''}
                            ` : `<div class="fv-operations-runtime-empty">${escapeHtml(translate("legacy.surface.85e2efe37bad1a44", "No eligible items for this action."))}</div>`}
                        </div>
                        <div class="fv-operations-runtime-list">
                            <strong>${escapeHtml(translate("legacy.surface.12698ce1ea5cd4ab", "Skipped"))}</strong>
                            ${skippedPreview.length ? `
                                <ul>
                                    ${skippedPreview.map((row) => `<li>${escapeHtml(row.name)} <span>${escapeHtml(row.reason || row.state || 'skipped')}</span></li>`).join('')}
                                </ul>
                                ${skippedOverflow > 0 ? `<div class="fv-operations-runtime-more">+${skippedOverflow} more skipped item(s)</div>` : ''}
                            ` : `<div class="fv-operations-runtime-empty">${escapeHtml(translate("legacy.surface.fdb7e1bfcb00e684", "Nothing is being skipped."))}</div>`}
                        </div>
                    </div>
                </div>
            `;
        };

        const setRuntimePreviewOutput = (type, html, status = '') => {
            const resolvedType = normalizeOperationsWorkspaceType(type);
            const host = $(`#${resolvedType}-runtime-preview-output`);
            if (!host.length) {
                return;
            }
            const content = String(html || '');
            host.html(content || `
                <div class="fv-operations-empty">
                    <i class="fa fa-file-text-o" aria-hidden="true"></i>
                    <strong>${escapeHtml(translate('settings.operations.preview-empty', 'No runtime action preview yet.'))}</strong>
                    <span>${escapeHtml(translate('settings.operations.preview-empty-help', 'Select a folder and action, then click Preview to see the planned changes before applying them.'))}</span>
                </div>
            `).prop('hidden', false);
            $(`#${resolvedType}-runtime-preview-status`).text(status || (content
                ? translate('settings.operations.preview-needed', 'Preview needed')
                : translate('settings.operations.no-action-selected', 'No action selected')));
        };

        const renderOperationsWorkspace = () => {
            const activeType = normalizeOperationsWorkspaceType(getActiveOperationsWorkspaceTypeValue());
            documentRef?.querySelectorAll('[data-fv-operations-template-search]').forEach((input) => {
                if (input.dataset.fvOperationsSearchBound === '1') {
                    return;
                }
                input.dataset.fvOperationsSearchBound = '1';
                input.addEventListener('input', () => filterOperationsTemplates(input.getAttribute('data-fv-operations-template-search')));
            });
            documentRef?.querySelectorAll('.fv-operations-template-library').forEach((library) => {
                if (library.dataset.fvOperationsCreateBound === '1') {
                    return;
                }
                library.dataset.fvOperationsCreateBound = '1';
                library.addEventListener('click', (event) => {
                    const button = event.target.closest('[data-fv-operations-create-cta]');
                    if (button && library.contains(button)) {
                        documentRef.getElementById(`${normalizeOperationsWorkspaceType(button.getAttribute('data-fv-operations-create-cta'))}-template-name`)?.focus();
                    }
                });
            });
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

        const filterOperationsTemplates = (type) => {
            renderTemplateRows(normalizeOperationsWorkspaceType(type));
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
            const query = String($(`#${resolvedType}-operations-template-search`).val() || '').trim().toLocaleLowerCase();
            const visibleTemplates = query
                ? allTemplates.filter((template) => String(template?.name || '').toLocaleLowerCase().includes(query))
                : allTemplates;
            const folders = getFolderMap(resolvedType);
            const folderOptions = Object.entries(folders).map(([id, folder]) => (
                `<option value="${escapeHtml(id)}">${escapeHtml(folder.name || id)}</option>`
            )).join('');

            if (!allTemplates.length) {
                selectedOperationsTemplateIdByType[resolvedType] = '';
                host.html(`
                    <div class="fv-operations-empty">
                        <i class="fa fa-file-text-o" aria-hidden="true"></i>
                        <strong>${escapeHtml(translate("settings.operations.no-templates", "No saved $1 templates yet.", resolvedType === 'docker' ? 'Docker' : 'VM'))}</strong>
                        <span>${escapeHtml(translate("settings.operations.empty-help-template", "Save a template from an existing folder to reuse its structure, settings, actions, and matching rules later."))}</span>
                        <button type="button" class="fv-operations-create-cta" data-fv-operations-create-cta="${resolvedType}"><i class="fa fa-plus" aria-hidden="true"></i> ${escapeHtml(translate('settings.operations.create-first-template', 'Create your first template'))}</button>
                    </div>
                `);
                return;
            }

            if (!visibleTemplates.length) {
                host.html(`<div class="fv-operations-empty"><i class="fa fa-search" aria-hidden="true"></i><strong>${escapeHtml(translate('settings.operations.no-search-results', 'No matching templates'))}</strong><span>${escapeHtml(translate('settings.operations.search-help', 'Try another search term or save a new template from a folder.'))}</span></div>`);
                return;
            }

            const selectedTemplateId = String(selectedOperationsTemplateIdByType[resolvedType] || '').trim();
            const selectedTemplate = visibleTemplates.find((template) => String(template?.id || '') === selectedTemplateId) || visibleTemplates[0];
            const resolvedTemplateId = String(selectedTemplate?.id || '').trim();
            selectedOperationsTemplateIdByType[resolvedType] = resolvedTemplateId;
            const templateSelectOptions = visibleTemplates.map((template) => {
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
                    <label for="${escapeHtml(`${resolvedType}-operations-template-select`)}">${escapeHtml(translate("legacy.surface.45f95a450344da81", "Saved template"))}</label>
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
                        <label for="${escapeHtml(targetSelectId)}">${escapeHtml(translate("legacy.surface.e3248784451162bb", "Apply to folder"))}</label>
                        <select id="${escapeHtml(targetSelectId)}">${folderOptions}</select>
                    </div>
                    <div class="backup-actions fv-operations-template-actions">
                        <button type="button" data-fv-onclick="applyTemplateToFolder('${resolvedType}','${escapeHtml(resolvedTemplateId)}','${escapeHtml(targetSelectId)}')"><i class="fa fa-clone"></i> ${escapeHtml(translate("legacy.surface.e3248784451162bb", "Apply to folder"))}</button>
                        <button type="button" data-fv-onclick="exportTemplateEntry('${resolvedType}','${escapeHtml(resolvedTemplateId)}')"><i class="fa fa-download"></i> ${escapeHtml(translate("legacy.surface.3664895579f0a7e6", "Export"))}</button>
                        <button type="button" data-fv-onclick="deleteTemplateEntry('${resolvedType}','${escapeHtml(resolvedTemplateId)}')"><i class="fa fa-trash"></i> ${escapeHtml(translate("legacy.surface.e2d0a54968ead24e", "Delete"))}</button>
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
            toggleAllRecoverySnapshots,
            toggleRecoveryDisclosure,
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
            buildRuntimePreviewHtml,
            setRuntimePreviewOutput,
            renderOperationsWorkspace,
            setOperationsWorkspaceType,
            selectOperationsTemplate,
            filterOperationsTemplates,
            exportTemplateEntry,
            renderTemplateRows
        });
    };

    return Object.freeze({
        createApi
    });
}));
