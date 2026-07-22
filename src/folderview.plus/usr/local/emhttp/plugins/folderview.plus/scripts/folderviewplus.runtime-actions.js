// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusSettingsRuntimeActions = factory();
    root.FolderViewPlusSettingsRuntimeActionsModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const fallbackWindow = typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : null);

    const createApi = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        const $ = deps.$ || win?.jQuery || win?.$ || null;
        const swal = typeof deps.swal === 'function' ? deps.swal : (() => {});
        const utils = deps.utils || {};
        const normalizeManagedType = typeof deps.normalizeManagedType === 'function'
            ? deps.normalizeManagedType
            : ((value) => String(value || '').trim().toLowerCase() === 'vm' ? 'vm' : 'docker');
        const getFolderMap = typeof deps.getFolderMap === 'function' ? deps.getFolderMap : (() => ({}));
        const getFolderNameForId = typeof deps.getFolderNameForId === 'function'
            ? deps.getFolderNameForId
            : ((type, id) => String(id || ''));
        const buildFolderHierarchyMeta = typeof deps.buildFolderHierarchyMeta === 'function'
            ? deps.buildFolderHierarchyMeta
            : (() => ({ childrenById: {}, depthById: {}, idSet: new Set() }));
        const getFolderBranchIds = typeof deps.getFolderBranchIds === 'function'
            ? deps.getFolderBranchIds
            : (() => []);
        const prefsByType = deps.prefsByType || { docker: {}, vm: {} };
        const postPrefs = typeof deps.postPrefs === 'function' ? deps.postPrefs : (async (type, value) => value);
        const createBackup = typeof deps.createBackup === 'function' ? deps.createBackup : (async () => null);
        const refreshType = typeof deps.refreshType === 'function' ? deps.refreshType : (async () => {});
        const refreshBackups = typeof deps.refreshBackups === 'function' ? deps.refreshBackups : (async () => {});
        const offerUndoAction = typeof deps.offerUndoAction === 'function' ? deps.offerUndoAction : (async () => {});
        const showToastMessage = typeof deps.showToastMessage === 'function' ? deps.showToastMessage : (() => {});
        const showError = typeof deps.showError === 'function' ? deps.showError : (() => {});
        const downloadFile = typeof deps.downloadFile === 'function' ? deps.downloadFile : (() => {});
        const toPrettyJson = typeof deps.toPrettyJson === 'function' ? deps.toPrettyJson : ((value) => JSON.stringify(value, null, 2));
        const trackDiagnosticsEvent = typeof deps.trackDiagnosticsEvent === 'function' ? deps.trackDiagnosticsEvent : (async () => {});
        const getPluginVersion = typeof deps.getPluginVersion === 'function' ? deps.getPluginVersion : (() => '0.0.0');
        const selectJsonFile = typeof deps.selectJsonFile === 'function'
            ? deps.selectJsonFile
            : (async () => null);
        const applyImportOperations = typeof deps.applyImportOperations === 'function'
            ? deps.applyImportOperations
            : (async () => {});
        const ensureRuntimeConflictActionAllowed = typeof deps.ensureRuntimeConflictActionAllowed === 'function'
            ? deps.ensureRuntimeConflictActionAllowed
            : (() => true);
        const setRuntimePreviewOutput = typeof deps.setRuntimePreviewOutput === 'function'
            ? deps.setRuntimePreviewOutput
            : (() => {});
        const buildRuntimePreviewHtml = typeof deps.buildRuntimePreviewHtml === 'function'
            ? deps.buildRuntimePreviewHtml
            : (() => '');
        const getRuntimePlanForFolder = typeof deps.getRuntimePlanForFolder === 'function'
            ? deps.getRuntimePlanForFolder
            : (() => null);
        const executeFolderRuntimeAction = typeof deps.executeFolderRuntimeAction === 'function'
            ? deps.executeFolderRuntimeAction
            : (async () => ({}));
        const treeIntegrityApi = deps.treeIntegrityApi
            || (deps.treeIntegrityModule && typeof deps.treeIntegrityModule.createApi === 'function'
                ? deps.treeIntegrityModule.createApi(deps)
                : null);
        const scanFolderTreeIntegrity = (...args) => treeIntegrityApi?.scan(...args);
        const runTreeIntegrityCheck = (...args) => treeIntegrityApi?.run(...args);

        const setFolderBranchPinned = async (type, folderId, pinned = true) => {
            const resolvedType = normalizeManagedType(type);
            if (!ensureRuntimeConflictActionAllowed('Pin/unpin folder branch')) {
                return;
            }
            const folders = getFolderMap(resolvedType);
            const hierarchyMeta = buildFolderHierarchyMeta(folders);
            const branchIds = getFolderBranchIds(resolvedType, folderId, hierarchyMeta);
            if (!branchIds.length) {
                return;
            }
            const current = utils.normalizePrefs(prefsByType[resolvedType]);
            const pinnedSet = new Set(Array.isArray(current.pinnedFolderIds) ? current.pinnedFolderIds : []);
            if (pinned) {
                branchIds.forEach((id) => pinnedSet.add(String(id)));
            } else {
                branchIds.forEach((id) => pinnedSet.delete(String(id)));
            }
            const next = {
                ...current,
                pinnedFolderIds: Array.from(pinnedSet)
            };
            const branchLabel = `${branchIds.length} folder${branchIds.length === 1 ? '' : 's'}`;
            let backup = null;
            try {
                backup = await createBackup(resolvedType, pinned ? `before-pin-branch-${folderId}` : `before-unpin-branch-${folderId}`);
                prefsByType[resolvedType] = await postPrefs(resolvedType, next);
                await refreshType(resolvedType);
                if (backup?.name) {
                    await offerUndoAction(resolvedType, backup, pinned ? 'Pin branch' : 'Unpin branch');
                }
                showToastMessage({
                    title: pinned ? 'Branch pinned' : 'Branch unpinned',
                    message: `${branchLabel} updated.`,
                    level: 'success',
                    durationMs: 3200
                });
            } catch (error) {
                showError('Branch pin update failed', error);
            }
        };

        const exportFolderBranch = async (type, folderId) => {
            const resolvedType = normalizeManagedType(type);
            const folders = getFolderMap(resolvedType);
            const hierarchyMeta = buildFolderHierarchyMeta(folders);
            const branchIds = getFolderBranchIds(resolvedType, folderId, hierarchyMeta);
            if (!branchIds.length) {
                swal({ title: 'Export failed', text: 'Folder branch no longer exists.', type: 'error' });
                return;
            }
            const branchFolders = {};
            branchIds.forEach((id) => {
                if (Object.prototype.hasOwnProperty.call(folders, id)) {
                    branchFolders[id] = folders[id];
                }
            });
            const sourceFolder = folders[String(folderId || '').trim()] || {};
            const payload = utils.buildFullExportPayload({
                type: resolvedType,
                folders: branchFolders,
                pluginVersion: String(getPluginVersion() || '0.0.0')
            });
            payload.mode = 'branch';
            payload.branchRootId = String(folderId || '').trim();
            payload.branchSize = branchIds.length;
            const baseName = String(sourceFolder.name || folderId || 'folder-branch').trim() || 'folder-branch';
            downloadFile(`${baseName}-branch.json`, toPrettyJson(payload));
            await trackDiagnosticsEvent({
                eventType: 'export',
                type: resolvedType,
                details: {
                    mode: 'branch',
                    folderCount: branchIds.length,
                    schemaVersion: utils.EXPORT_SCHEMA_VERSION
                }
            });
        };

        const importFolderBranch = async (type, targetFolderId) => {
            const resolvedType = normalizeManagedType(type);
            const targetId = String(targetFolderId || '').trim();
            const folders = getFolderMap(resolvedType);
            if (!targetId || !Object.prototype.hasOwnProperty.call(folders, targetId)) {
                swal({ title: 'Import failed', text: 'Target folder is required.', type: 'error' });
                return;
            }
            if (!ensureRuntimeConflictActionAllowed(`Import ${resolvedType === 'docker' ? 'Docker' : 'VM'} branch`)) {
                return;
            }
            let selected;
            try {
                selected = await selectJsonFile();
            } catch (error) {
                showError('Import failed', error);
                return;
            }
            if (!selected) {
                return;
            }
            let parsedFile;
            try {
                parsedFile = JSON.parse(selected.text);
            } catch (_error) {
                swal({ title: 'Import failed', text: 'Invalid JSON file.', type: 'error' });
                return;
            }
            const parsed = utils.parseImportPayload(parsedFile, resolvedType);
            if (!parsed.ok) {
                swal({ title: 'Import failed', text: parsed.error || 'Invalid branch payload.', type: 'error' });
                return;
            }

            const sourceFolders = parsed.mode === 'single'
                ? { [String(parsed.folderId || `branch-${Date.now()}`)]: parsed.folder }
                : utils.normalizeFolderMap(parsed.folders || {});
            const sourceIds = Object.keys(sourceFolders);
            if (!sourceIds.length) {
                swal({ title: 'Import failed', text: 'No folders found in selected file.', type: 'error' });
                return;
            }
            const existingIds = new Set(Object.keys(folders || {}));
            const remapId = {};
            const uniqueIdFor = (base, index) => {
                let candidate = String(base || `branch-${index + 1}`).trim() || `branch-${index + 1}`;
                candidate = candidate.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || `branch-${index + 1}`;
                if (!existingIds.has(candidate) && !Object.values(remapId).includes(candidate)) {
                    return candidate;
                }
                let counter = 1;
                while (existingIds.has(`${candidate}-${counter}`) || Object.values(remapId).includes(`${candidate}-${counter}`)) {
                    counter += 1;
                }
                return `${candidate}-${counter}`;
            };
            sourceIds.forEach((sourceId, index) => {
                remapId[sourceId] = uniqueIdFor(sourceId, index);
            });
            const sourceSet = new Set(sourceIds);
            const upserts = sourceIds.map((sourceId) => {
                const folder = utils.normalizeFolderMap({ [sourceId]: sourceFolders[sourceId] })[sourceId];
                const mappedId = remapId[sourceId];
                const sourceParentId = String(folder?.parentId || '').trim();
                const remappedParentId = sourceSet.has(sourceParentId)
                    ? remapId[sourceParentId]
                    : targetId;
                return {
                    id: mappedId,
                    folder: {
                        ...(folder || {}),
                        parentId: remappedParentId
                    }
                };
            });
            const operations = {
                deletes: [],
                upserts,
                creates: []
            };
            let backup = null;
            try {
                backup = await createBackup(resolvedType, `before-branch-import-${targetId}`);
                await applyImportOperations(resolvedType, operations);
                await Promise.all([refreshType(resolvedType), refreshBackups(resolvedType)]);
                await offerUndoAction(resolvedType, backup, 'Branch import');
                showToastMessage({
                    title: 'Branch imported',
                    message: `Imported ${upserts.length} folder${upserts.length === 1 ? '' : 's'} under ${folders[targetId]?.name || targetId}.`,
                    level: 'success',
                    durationMs: 4200
                });
            } catch (error) {
                showError('Branch import failed', error);
            }
        };

        const previewFolderRuntimeAction = (type) => {
            const folderId = String($(`#${type}-runtime-folder`).val() || '');
            const action = String($(`#${type}-runtime-action`).val() || '');
            if (!folderId || !action) {
                setRuntimePreviewOutput(type, `
            <div class="fv-recovery-empty-state">
                <strong>Select a folder and action first.</strong>
                <span>Pick the target folder and the runtime action you want to preview.</span>
            </div>
        `);
                return;
            }
            const plan = getRuntimePlanForFolder(type, folderId, action);
            setRuntimePreviewOutput(type, buildRuntimePreviewHtml(type, folderId, action, plan));
        };

        const applyFolderRuntimeAction = (type) => {
            const folderId = String($(`#${type}-runtime-folder`).val() || '');
            const action = String($(`#${type}-runtime-action`).val() || '');
            if (!folderId || !action) {
                setRuntimePreviewOutput(type, `
            <div class="fv-recovery-empty-state">
                <strong>Select a folder and action first.</strong>
                <span>Pick the target folder and the runtime action you want to apply.</span>
            </div>
        `);
                return;
            }
            const plan = getRuntimePlanForFolder(type, folderId, action);
            if (!plan) {
                setRuntimePreviewOutput(type, `
            <div class="fv-recovery-empty-state">
                <strong>No valid action plan was generated.</strong>
                <span>Refresh the source data and try the preview again.</span>
            </div>
        `);
                return;
            }
            if (!plan.eligible.length) {
                setRuntimePreviewOutput(type, buildRuntimePreviewHtml(type, folderId, action, plan));
                swal({
                    title: 'Nothing to apply',
                    text: 'No eligible items were found for this action.',
                    type: 'info'
                });
                return;
            }

            const folderName = getFolderNameForId(type, folderId);
            swal({
                title: 'Apply folder action?',
                text: `${action.toUpperCase()} on "${folderName}"\nEligible: ${plan.eligible.length}\nSkipped: ${plan.skipped.length}`,
                type: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Apply',
                cancelButtonText: 'Cancel',
                showLoaderOnConfirm: true
            }, async (confirmed) => {
                if (!confirmed) {
                    return;
                }
                try {
                    const result = await executeFolderRuntimeAction(type, action, plan.eligible.map((row) => row.name));
                    await refreshType(type);
                    setRuntimePreviewOutput(type, buildRuntimePreviewHtml(type, folderId, action, plan, result));
                    await trackDiagnosticsEvent({
                        eventType: 'runtime_bulk_action',
                        type,
                        details: {
                            action,
                            folderId,
                            requested: plan.requestedCount,
                            eligible: plan.eligible.length,
                            executed: result.executed || 0,
                            failed: result.failed || 0
                        }
                    });
                    swal({
                        title: 'Action complete',
                        text: `Executed: ${result.executed || 0}, succeeded: ${result.succeeded || 0}, failed: ${result.failed || 0}, skipped: ${(result.skipped || []).length}`,
                        type: (result.failed || 0) > 0 ? 'warning' : 'success'
                    });
                } catch (error) {
                    showError('Folder runtime action failed', error);
                }
            });
        };

        return Object.freeze({
            setFolderBranchPinned,
            exportFolderBranch,
            importFolderBranch,
            scanFolderTreeIntegrity,
            runTreeIntegrityCheck,
            previewFolderRuntimeAction,
            applyFolderRuntimeAction
        });
    };

    return Object.freeze({
        createApi
    });
}));
