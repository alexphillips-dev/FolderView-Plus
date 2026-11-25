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
    const surfaceT = (key, fallback, ...params) => globalThis.FolderViewPlusI18n?.t?.(key, fallback, ...params) || fallback.replace(/\$(\d+)/g, (token, n) => String(params[Number(n) - 1] ?? token));
    const createApi = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        const $ = deps.$ || win?.jQuery || win?.$ || null;
        const escapeHtml = deps.escapeHtml || win?.FolderViewPlusUI?.escapeHtml;
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
        const buildDownloadDiagnosticsEventDetails = typeof deps.buildDownloadDiagnosticsEventDetails === 'function'
            ? deps.buildDownloadDiagnosticsEventDetails
            : ((attempt = {}) => ({
                mode: String(attempt?.mode || 'other'),
                folderCount: Math.max(0, Number(attempt?.folderCount) || 0),
                schemaVersion: String(attempt?.exportSchemaVersion || ''),
                lifecycle: String(attempt?.lifecycle || 'download-dispatch-attempted'),
                verdict: String(attempt?.verdict?.status || 'indeterminate'),
                verdictCode: String(attempt?.verdict?.code || 'browser-save-unconfirmed')
            }));
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
        const getRuntimeInfo = deps.getRuntimeInfo || (() => ({}));
        const runtimePreviewByType = { docker: null, vm: null };
        const pendingRuntimeActions = new Set();
        const runtimePlanSignature = (plan) => JSON.stringify({
            requestedCount: plan.requestedCount,
            eligible: plan.eligible.map((item) => [item.name, item.state]),
            skipped: plan.skipped.map((item) => [item.name, item.state])
        });
        const invalidateFolderRuntimePreview = (type, html = '') => {
            const resolvedType = normalizeManagedType(type);
            runtimePreviewByType[resolvedType] = null;
            setRuntimePreviewOutput(resolvedType, html);
        };
        const invalidateChangedRuntimePreview = (type) => {
            const title = surfaceT("legacy.surface.3a580cdc4b8de001", "Folder state changed.");
            const detail = surfaceT("legacy.surface.017d57696dc59152", "Preview the action again before applying it.");
            invalidateFolderRuntimePreview(type, `<div class="fv-recovery-empty-state"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></div>`);
        };
        const treeIntegrityApi = deps.treeIntegrityApi
            || (deps.treeIntegrityModule && typeof deps.treeIntegrityModule.createApi === 'function'
                ? deps.treeIntegrityModule.createApi(deps)
                : null);
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
            const branchLabel = surfaceT("common.runtime.folders-1", "Folders: $1", branchIds.length);
            try {
                prefsByType[resolvedType] = await postPrefs(resolvedType, next, { baselinePrefs: current });
                await refreshType(resolvedType);
                showToastMessage({
                    title: pinned ? 'Branch pinned' : 'Branch unpinned',
                    message: `${branchLabel} updated.`,
                    level: 'success',
                    durationMs: 3200
                });
            } catch (error) {
                showError(surfaceT("common.repair.branch-pin-update-failed-a2d9f2", "Branch pin update failed"), error);
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
            try {
                const downloadAttempt = downloadFile(`${baseName}-branch.json`, toPrettyJson(payload), {
                    type: resolvedType,
                    mode: 'branch',
                    surface: 'settings',
                    folderCount: branchIds.length,
                    schemaVersion: utils.EXPORT_SCHEMA_VERSION
                });
                await trackDiagnosticsEvent({
                    eventType: 'export',
                    type: resolvedType,
                    details: downloadAttempt
                        ? buildDownloadDiagnosticsEventDetails(downloadAttempt)
                        : {
                            mode: 'branch',
                            folderCount: branchIds.length,
                            schemaVersion: utils.EXPORT_SCHEMA_VERSION,
                            lifecycle: 'download-dispatch-attempted',
                            verdict: 'indeterminate',
                            verdictCode: 'telemetry-module-unavailable'
                        }
                });
            } catch (error) {
                if (error?.fvplusDownloadAttempt) {
                    await trackDiagnosticsEvent({
                        eventType: 'export',
                        type: resolvedType,
                        status: 'error',
                        details: buildDownloadDiagnosticsEventDetails(error.fvplusDownloadAttempt)
                    });
                }
                showError('Export failed', error);
            }
        };

        const importFolderBranch = async (type, targetFolderId) => {
            const resolvedType = normalizeManagedType(type);
            const targetId = String(targetFolderId || '').trim();
            if (!targetId || !Object.hasOwn(getFolderMap(resolvedType), targetId)) {
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
            let folders, folderRevision;
            try {
                ({ folders, folderRevision } = await deps.fetchFolders(resolvedType));
                if (!Number.isSafeInteger(folderRevision) || folderRevision < 1) {
                    throw new Error(surfaceT('legacy.surface.332e7fb224979d90', 'The current folder configuration revision is unavailable.'));
                }
                if (!Object.hasOwn(folders, targetId)) {
                    throw new Error(surfaceT('common.server.target-folder-not-found-b0f5ad', 'Target folder not found.'));
                }
            } catch (error) {
                showError(surfaceT("common.repair.branch-import-failed-a0d261", "Branch import failed"), error);
                return;
            }
            const existingIds = new Set(Object.keys(folders || {}));
            const remapId = Object.create(null);
            const uniqueIdFor = (base, index) => {
                const prefix = String(base || '').trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
                    || `branch-${index + 1}`;
                let candidate = prefix.slice(0, 128);
                let counter = 1;
                while (existingIds.has(candidate)) {
                    const suffix = `-${counter++}`;
                    candidate = prefix.slice(0, 128 - suffix.length) + suffix;
                }
                existingIds.add(candidate);
                return candidate;
            };
            sourceIds.forEach((sourceId, index) => {
                remapId[sourceId] = uniqueIdFor(sourceId, index);
            });
            const sourceSet = new Set(sourceIds);
            const upserts = sourceIds.map((sourceId) => {
                const sourceFolder = utils.normalizeFolderMap({ [sourceId]: sourceFolders[sourceId] })[sourceId];
                const folder = utils.remapImportedChildOrder(sourceFolder, childId => (
                    sourceFolders[childId]?.parentId === sourceId ? remapId[childId] : ''
                ));
                const mappedId = remapId[sourceId];
                const sourceParentId = String(folder?.parentId || '').trim();
                const remappedParentId = sourceSet.has(sourceParentId)
                    ? remapId[sourceParentId]
                    : targetId;
                return {
                    id: mappedId,
                    createOnly: true,
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
                await applyImportOperations(resolvedType, operations, null, { expectedRevision: folderRevision });
                await Promise.all([refreshType(resolvedType), refreshBackups(resolvedType)]);
                await offerUndoAction(resolvedType, backup, 'Branch import');
                showToastMessage({
                    title: 'Branch imported',
                    message: surfaceT("common.counts.folders-imported", "Folders imported: $1. Parent: $2.", upserts.length, folders[targetId]?.name || targetId),
                    level: 'success',
                    durationMs: 4200
                });
            } catch (error) {
                showError(surfaceT("common.repair.branch-import-failed-a0d261", "Branch import failed"), error);
            }
        };

        const previewFolderRuntimeAction = (type) => {
            const resolvedType = normalizeManagedType(type);
            const folderId = String($(`#${resolvedType}-runtime-folder`).val() || '');
            const action = String($(`#${resolvedType}-runtime-action`).val() || '');
            if (!folderId || !action) {
                invalidateFolderRuntimePreview(resolvedType, '<div class="fv-recovery-empty-state"><strong>Select a folder and action first.</strong><span>Pick the target folder and the runtime action you want to preview.</span></div>');
                return;
            }
            const plan = getRuntimePlanForFolder(resolvedType, folderId, action);
            if (!plan) {
                invalidateFolderRuntimePreview(resolvedType, buildRuntimePreviewHtml(resolvedType, folderId, action, null));
                return;
            }
            runtimePreviewByType[resolvedType] = { folderId, action, signature: runtimePlanSignature(plan) };
            const eligibleCount = plan.eligible.length;
            setRuntimePreviewOutput(resolvedType, buildRuntimePreviewHtml(resolvedType, folderId, action, plan),
                eligibleCount ? surfaceT('settings.operations.ready-to-apply', 'Ready to apply') : surfaceT('settings.operations.no-eligible', 'No eligible items'));
        };

        const runFolderRuntimeAction = async (resolvedType) => {
            const folderId = String($(`#${resolvedType}-runtime-folder`).val() || '');
            const action = String($(`#${resolvedType}-runtime-action`).val() || '');
            if (!folderId || !action) {
                invalidateFolderRuntimePreview(resolvedType, '<div class="fv-recovery-empty-state"><strong>Select a folder and action first.</strong><span>Pick the target folder and the runtime action you want to apply.</span></div>');
                return;
            }
            const preview = runtimePreviewByType[resolvedType];
            if (!preview || preview.folderId !== folderId || preview.action !== action) {
                invalidateFolderRuntimePreview(resolvedType, '<div class="fv-recovery-empty-state">Preview this action before applying it.</div>');
                return;
            }
            const plan = getRuntimePlanForFolder(resolvedType, folderId, action);
            if (!plan || runtimePlanSignature(plan) !== preview.signature) {
                invalidateChangedRuntimePreview(resolvedType);
                return;
            }
            if (!plan.eligible.length) {
                invalidateFolderRuntimePreview(resolvedType, buildRuntimePreviewHtml(resolvedType, folderId, action, plan));
                void win?.FolderViewPlusUI?.alert({
                    title: surfaceT('settings.operations.no-eligible', 'No eligible items'),
                    message: surfaceT("settings.operations.no-eligible-detail", "No eligible items were found for this action.")
                });
                return;
            }

            const folderName = getFolderNameForId(resolvedType, folderId);
            const ui = win?.FolderViewPlusUI;
            const confirmed = await ui?.confirm({
                title: surfaceT("settings.operations.confirm-action", "Apply folder action?"),
                message: surfaceT("settings.operations.confirm-details", '$1 on "$2" Eligible: $3 Skipped: $4',
                    surfaceT(action, action), folderName, plan.eligible.length, plan.skipped.length),
                confirmLabel: surfaceT("common.actions.apply", "Apply")
            });
            if (!confirmed) return;
            let current;
            try {
                const refresh = await refreshType(resolvedType, { render: false });
                if (refresh?.runtimeFetched === true && !refresh.hasErrors) {
                    current = getRuntimePlanForFolder(resolvedType, folderId, action);
                }
            } catch {
                // An unavailable snapshot cannot validate the preview.
            }
            if (runtimePreviewByType[resolvedType] !== preview) return;
            if (!current || runtimePlanSignature(current) !== preview.signature
                || String($(`#${resolvedType}-runtime-folder`).val() || '') !== folderId
                || String($(`#${resolvedType}-runtime-action`).val() || '') !== action) {
                invalidateChangedRuntimePreview(resolvedType);
                return;
            }
            invalidateFolderRuntimePreview(resolvedType);
            let result;
            try {
                result = await executeFolderRuntimeAction(resolvedType, folderId, action, current.eligible.map((row) => row.name));
            } catch (error) {
                showError(surfaceT("common.repair.folder-runtime-action-failed-8cc3b7", "Folder runtime action failed"), error);
                return;
            }

            let refreshFailed;
            try {
                const refresh = await refreshType(resolvedType);
                refreshFailed = refresh?.hasErrors === true || refresh?.runtimeFetched !== true;
            } catch {
                refreshFailed = true;
            }
            const observed = refreshFailed ? {} : getRuntimeInfo(resolvedType);
            // Planning treats unknown runtime states as eligible or stopped in some cases.
            // Verification requires a state explicitly returned by the host.
            const expected = {
                start: ['running', 'started'],
                stop: ['stopped', 'exited', 'created', 'shutoff', 'shut off'],
                pause: ['paused'],
                resume: ['running', 'started']
            }[action] || [];
            const verified = (result.results || []).filter(row => {
                const item = observed[row.item];
                const state = resolvedType === 'docker' && item?.paused === true ? 'paused' : String(item?.state || '').trim().toLowerCase();
                return row.ok === true && expected.includes(state);
            }).length;
            const skipped = (result.skipped || []).length;
            const unconfirmed = verified < (result.succeeded || 0);
            const warning = refreshFailed || unconfirmed || (result.failed || 0) > 0 || skipped > 0;
            const status = warning
                ? surfaceT("legacy.surface.9ea2e0345bba54c7", "Completed with warnings")
                : surfaceT('settings.operations.action-complete', 'Action complete');
            const notice = refreshFailed
                ? surfaceT("legacy.surface.43fdf4e612fdabf7", "Refresh failed.")
                : unconfirmed ? surfaceT("settings.operations.runtime-unconfirmed", "Current runtime status could not be confirmed.") : '';
            setRuntimePreviewOutput(resolvedType, buildRuntimePreviewHtml(resolvedType, folderId, action, plan, { ...result, notice }), status);
            void ui.alert({
                title: status,
                message: [surfaceT("legacy.surface.a38c47a703c5feff", "Executed: $1, succeeded: $2, failed: $3, skipped: $4",
                    result.executed || 0, result.succeeded || 0, result.failed || 0, skipped), notice].filter(Boolean).join(' '),
                tone: warning ? 'warning' : 'success'
            });
            await trackDiagnosticsEvent({
                eventType: 'runtime_bulk_action',
                type: resolvedType,
                status: warning ? 'warning' : 'ok',
                details: {
                    action,
                    folderId,
                    requested: plan.requestedCount,
                    eligible: plan.eligible.length,
                    executed: result.executed || 0,
                    failed: result.failed || 0
                }
            });
        };
        const applyFolderRuntimeAction = async (type) => {
            const resolvedType = normalizeManagedType(type);
            if (pendingRuntimeActions.has(resolvedType)) return;
            pendingRuntimeActions.add(resolvedType);
            try {
                return await runFolderRuntimeAction(resolvedType);
            } finally {
                pendingRuntimeActions.delete(resolvedType);
            }
        };

        return Object.freeze({
            setFolderBranchPinned,
            exportFolderBranch,
            importFolderBranch,
            runTreeIntegrityCheck,
            invalidateFolderRuntimePreview,
            previewFolderRuntimeAction,
            applyFolderRuntimeAction
        });
    };

    return Object.freeze({
        createApi
    });
}));
