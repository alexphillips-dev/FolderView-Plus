(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusSettingsActionSupport = factory();
    root.FolderViewPlusSettingsActionSupportModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const fallbackWindow = typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : null);

    const normalizeType = (type) => type === 'vm' ? 'vm' : 'docker';

    const createSupportActions = (deps = {}) => {
        const utils = deps.utils || {};
        const swalFn = typeof deps.swal === 'function' ? deps.swal : null;
        const showError = typeof deps.showError === 'function' ? deps.showError : (() => {});
        const setUpdateStatus = typeof deps.setUpdateStatus === 'function' ? deps.setUpdateStatus : (() => {});
        const setRollbackStatus = typeof deps.setRollbackStatus === 'function' ? deps.setRollbackStatus : (() => {});
        const updateTools = deps.updateTools || null;

        const runScheduledBackupNow = async (type) => {
            const resolvedType = normalizeType(type);
            await deps.withAdvancedOperationLock(resolvedType, 'backups', `${resolvedType.toUpperCase()} scheduled backup run`, async () => {
                try {
                    await deps.runScheduledBackup(resolvedType);
                    await Promise.all([deps.refreshType(resolvedType), deps.refreshBackups(resolvedType)]);
                    swalFn?.({
                        title: 'Scheduler run complete',
                        text: `Scheduled backup check executed for ${resolvedType.toUpperCase()}.`,
                        type: 'success'
                    });
                } catch (error) {
                    showError('Scheduler run failed', error);
                }
            });
        };

        const runConflictInspector = async (type) => {
            const resolvedType = normalizeType(type);
            const folders = deps.getFolderMap(resolvedType);
            const prefs = deps.prefsByType?.[resolvedType] || utils.normalizePrefs?.({}) || {};
            const info = deps.infoByType?.[resolvedType] || {};
            const report = utils.getConflictReport({
                type: resolvedType,
                folders,
                prefs,
                infoByName: info
            });
            const conflicts = report.rows.filter((row) => row.hasConflict);
            const blocked = report.rows.filter((row) => row.blockedByRule);

            const lines = [
                `${resolvedType === 'docker' ? 'Docker' : 'VM'} conflict scan`,
                `Scanned ${report.totalItems} item(s).`,
                `${report.conflictingItems} conflicting item(s), ${blocked.length} blocked by exclude rule(s).`,
                ''
            ];
            if (!conflicts.length && !blocked.length) {
                lines.push('No conflicts or blocked items were detected.');
            } else {
                conflicts.forEach((row) => {
                    const folderList = Array.isArray(row.matchedFolders)
                        ? row.matchedFolders.map((entry) => `${entry.folderName} (${Array.isArray(entry.reasons) ? entry.reasons.join(', ') : '-'})`).join(' ; ')
                        : '';
                    lines.push(`CONFLICT | ${row.item || '(unknown)'} | ${folderList || 'No folder details available.'}`);
                });
                blocked.forEach((row) => {
                    const blockInfo = row.blockedByRule
                        ? `blocked by rule ${row.blockedByRule.id || '(unknown id)'} targeting ${row.blockedByRule.folderId || '(unknown folder)'}`
                        : 'blocked by an exclude rule';
                    const folderList = Array.isArray(row.matchedFolders)
                        ? row.matchedFolders.map((entry) => `${entry.folderName} (${Array.isArray(entry.reasons) ? entry.reasons.join(', ') : '-'})`).join(' ; ')
                        : '';
                    lines.push(`BLOCKED | ${row.item || '(unknown)'} | ${blockInfo}${folderList ? ` | matched folders: ${folderList}` : ''}`);
                });
            }

            deps.$?.(`#${resolvedType}-conflict-output`).text(lines.join('\n'));
            await deps.trackDiagnosticsEvent?.({
                eventType: 'conflict_scan',
                type: resolvedType,
                details: {
                    totalItems: report.totalItems,
                    conflictingItems: report.conflictingItems,
                    blockedByExcludeRules: blocked.length
                }
            });
        };

        const checkForUpdatesNow = async () => {
            if (updateTools && typeof updateTools.checkForUpdatesNow === 'function') {
                return updateTools.checkForUpdatesNow({
                    apiGetJson: deps.apiGetJson,
                    setUpdateStatus,
                    showError,
                    swalFn
                });
            }
            setUpdateStatus('Update helper module unavailable.');
            swalFn?.({
                title: 'Update helper unavailable',
                text: 'Reload the page to load update helper scripts.',
                type: 'warning'
            });
            return null;
        };

        const showDevForceRefreshHelper = async () => {
            if (updateTools && typeof updateTools.showDevForceRefreshHelper === 'function') {
                return updateTools.showDevForceRefreshHelper({
                    apiGetJson: deps.apiGetJson,
                    apiGetText: deps.apiGetText,
                    setUpdateStatus,
                    showError,
                    swalFn
                });
            }
            setUpdateStatus('Force-refresh helper unavailable.');
            swalFn?.({
                title: 'Force-refresh helper unavailable',
                text: 'Reload the page to load helper scripts.',
                type: 'warning'
            });
            return null;
        };

        const createRollbackCheckpoint = async () => {
            try {
                const checkpoint = await deps.createGlobalRollbackCheckpointApi('manual');
                const message = checkpoint?.name ? `Created: ${checkpoint.name}` : 'Rollback checkpoint created.';
                setRollbackStatus(message);
                swalFn?.({
                    title: 'Rollback checkpoint created',
                    text: message,
                    type: 'success'
                });
            } catch (error) {
                setRollbackStatus('Rollback checkpoint failed.');
                showError('Rollback checkpoint failed', error);
            }
        };

        const rollbackLatestCheckpoint = () => {
            swalFn?.({
                title: 'Rollback plugin settings?',
                text: 'This restores Docker + VM folders and settings from the previous rollback snapshot.',
                type: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Rollback now',
                cancelButtonText: 'Cancel',
                showLoaderOnConfirm: true
            }, async (confirmed) => {
                if (!confirmed) {
                    return;
                }
                try {
                    const restore = await deps.restorePreviousGlobalRollbackCheckpointApi();
                    await deps.refreshAll();
                    const target = restore?.targetName || restore?.name || 'previous snapshot';
                    const undo = restore?.undoSnapshot ? `\nUndo snapshot created: ${restore.undoSnapshot}` : '';
                    const status = `Restored ${target}`;
                    setRollbackStatus(status);
                    swalFn?.({
                        title: 'Rollback complete',
                        text: `${status}${undo}`,
                        type: 'success'
                    });
                } catch (error) {
                    setRollbackStatus('Rollback failed.');
                    showError('Rollback failed', error);
                }
            });
        };

        const fileManager = () => {
            const locationRef = deps.window?.location || fallbackWindow?.location;
            if (!locationRef) {
                return;
            }
            locationRef.href = `${locationRef.pathname}/Browse?dir=/boot/config/plugins/folderview.plus`;
        };

        const downloadDocker = (id) => deps.downloadType('docker', id);
        const downloadVm = (id) => deps.downloadType('vm', id);
        const importDocker = () => deps.importType('docker');
        const importVm = () => deps.importType('vm');
        const clearDocker = (id) => deps.clearType('docker', id);
        const clearVm = (id) => deps.clearType('vm', id);

        return Object.freeze({
            runScheduledBackupNow,
            runConflictInspector,
            checkForUpdatesNow,
            showDevForceRefreshHelper,
            createRollbackCheckpoint,
            rollbackLatestCheckpoint,
            fileManager,
            downloadDocker,
            downloadVm,
            importDocker,
            importVm,
            clearDocker,
            clearVm
        });
    };

    const registerWindowActions = (target, actions = {}) => {
        const host = target && typeof target === 'object' ? target : (fallbackWindow || {});
        Object.assign(host, actions && typeof actions === 'object' ? actions : {});
        return host;
    };

    return Object.freeze({
        createSupportActions,
        registerWindowActions
    });
}));
