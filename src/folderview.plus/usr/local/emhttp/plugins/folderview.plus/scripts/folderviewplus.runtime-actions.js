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
        const saveFolderRecord = typeof deps.saveFolderRecord === 'function'
            ? deps.saveFolderRecord
            : (async () => {});
        const ensureRuntimeConflictActionAllowed = typeof deps.ensureRuntimeConflictActionAllowed === 'function'
            ? deps.ensureRuntimeConflictActionAllowed
            : (() => true);
        const TREE_INTEGRITY_DEPTH_WARN_LEVEL = Number.isFinite(Number(deps.TREE_INTEGRITY_DEPTH_WARN_LEVEL))
            ? Number(deps.TREE_INTEGRITY_DEPTH_WARN_LEVEL)
            : 6;
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

        const buildRawParentMap = (foldersInput = null) => {
            const folders = utils.normalizeFolderMap(foldersInput || {});
            const parentMap = {};
            for (const [id, folder] of Object.entries(folders)) {
                const rawParent = typeof folder?.parentId === 'string'
                    ? folder.parentId
                    : (typeof folder?.parent_id === 'string' ? folder.parent_id : '');
                parentMap[id] = String(rawParent || '').trim();
            }
            return { folders, parentMap };
        };

        const scanFolderTreeIntegrity = (type, foldersInput = null) => {
            const resolvedType = normalizeManagedType(type);
            const { folders, parentMap } = buildRawParentMap(foldersInput || getFolderMap(resolvedType));
            const ids = Object.keys(folders);
            const idSet = new Set(ids);
            const selfParents = [];
            const orphans = [];
            const cycles = [];

            ids.forEach((id) => {
                const parentId = String(parentMap[id] || '').trim();
                if (!parentId) {
                    return;
                }
                if (parentId === id) {
                    selfParents.push(id);
                    return;
                }
                if (!idSet.has(parentId)) {
                    orphans.push(id);
                }
            });

            const visited = new Set();
            const inPath = new Set();
            const traverse = (id, chain = []) => {
                if (inPath.has(id)) {
                    const startIndex = chain.indexOf(id);
                    if (startIndex >= 0) {
                        cycles.push(chain.slice(startIndex).concat(id));
                    }
                    return;
                }
                if (visited.has(id)) {
                    return;
                }
                visited.add(id);
                inPath.add(id);
                const parentId = String(parentMap[id] || '').trim();
                if (parentId && idSet.has(parentId)) {
                    traverse(parentId, chain.concat(id));
                }
                inPath.delete(id);
            };
            ids.forEach((id) => traverse(id, []));

            const hierarchyMeta = buildFolderHierarchyMeta(folders);
            const childrenById = hierarchyMeta?.childrenById && typeof hierarchyMeta.childrenById === 'object'
                ? hierarchyMeta.childrenById
                : {};
            const depthById = hierarchyMeta?.depthById && typeof hierarchyMeta.depthById === 'object'
                ? hierarchyMeta.depthById
                : {};
            const branchMemberCache = {};
            const getBranchMemberCount = (id, seen = new Set()) => {
                const safeId = String(id || '').trim();
                if (!safeId) {
                    return 0;
                }
                if (Object.prototype.hasOwnProperty.call(branchMemberCache, safeId)) {
                    return Number(branchMemberCache[safeId] || 0);
                }
                if (seen.has(safeId)) {
                    return 0;
                }
                seen.add(safeId);
                const folder = folders[safeId] || {};
                const directMembers = (utils && typeof utils.normalizeFolderMembers === 'function')
                    ? utils.normalizeFolderMembers(folder?.containers || []).length
                    : (Array.isArray(folder?.containers) ? folder.containers.length : 0);
                let total = directMembers;
                const children = Array.isArray(childrenById[safeId]) ? childrenById[safeId] : [];
                for (const childId of children) {
                    total += getBranchMemberCount(childId, seen);
                }
                seen.delete(safeId);
                branchMemberCache[safeId] = total;
                return total;
            };
            const depthWarnings = [];
            const emptyBranches = [];
            let maxDepth = 0;
            for (const id of ids) {
                const depth = Math.max(0, Number(depthById[id] || 0));
                if (depth > maxDepth) {
                    maxDepth = depth;
                }
                if (depth > TREE_INTEGRITY_DEPTH_WARN_LEVEL) {
                    depthWarnings.push({
                        id,
                        name: String(folders[id]?.name || id),
                        depth
                    });
                }
                const children = Array.isArray(childrenById[id]) ? childrenById[id] : [];
                if (children.length <= 0) {
                    continue;
                }
                const branchMembers = getBranchMemberCount(id);
                if (branchMembers <= 0) {
                    emptyBranches.push({
                        id,
                        name: String(folders[id]?.name || id),
                        depth
                    });
                }
            }

            return {
                type: resolvedType,
                totalFolders: ids.length,
                selfParents,
                orphans,
                cycles,
                maxDepth,
                depthWarnings,
                emptyBranches
            };
        };

        const normalizeTreeIntegrityOptions = (options) => {
            if (typeof options === 'boolean') {
                return { repair: options };
            }
            if (!options || typeof options !== 'object') {
                return { repair: false };
            }
            return { repair: options.repair === true };
        };

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

        const runTreeIntegrityCheck = async (type, options = {}) => {
            const normalizedOptions = normalizeTreeIntegrityOptions(options);
            const repair = normalizedOptions.repair === true;
            const resolvedType = normalizeManagedType(type);
            const report = scanFolderTreeIntegrity(resolvedType);
            const linkIssueCount = report.selfParents.length + report.orphans.length + report.cycles.length;
            const advisoryIssueCount = report.depthWarnings.length + report.emptyBranches.length;
            const totalIssues = linkIssueCount + advisoryIssueCount;
            if (totalIssues <= 0) {
                swal({
                    title: 'Tree integrity healthy',
                    text: `${resolvedType.toUpperCase()} nested folder structure has no cycle/orphan/depth/empty-branch issues.`,
                    type: 'success'
                });
                return;
            }
            if (!repair) {
                const cyclePreview = report.cycles.slice(0, 3).map((cycle) => cycle.join(' -> ')).join('\n');
                const depthPreview = report.depthWarnings
                    .slice(0, 4)
                    .map((row) => `${row.name} (depth ${row.depth})`)
                    .join('\n');
                const emptyBranchPreview = report.emptyBranches
                    .slice(0, 4)
                    .map((row) => `${row.name} (depth ${row.depth})`)
                    .join('\n');
                const details = [
                    `Self-parent links: ${report.selfParents.length}`,
                    `Orphans: ${report.orphans.length}`,
                    `Cycles: ${report.cycles.length}`,
                    `Depth warnings (> ${TREE_INTEGRITY_DEPTH_WARN_LEVEL}): ${report.depthWarnings.length}`,
                    `Empty branches (no members in subtree): ${report.emptyBranches.length}`,
                    `Max depth: ${report.maxDepth}`,
                    cyclePreview ? `\nCycle preview:\n${cyclePreview}` : '',
                    depthPreview ? `\nDeep branch preview:\n${depthPreview}` : '',
                    emptyBranchPreview ? `\nEmpty branch preview:\n${emptyBranchPreview}` : ''
                ].join('\n');
                swal({
                    title: 'Tree integrity issues found',
                    text: details,
                    type: 'warning'
                });
                return;
            }
            if (linkIssueCount <= 0) {
                swal({
                    title: 'No repairable link issues',
                    text: `Detected ${advisoryIssueCount} advisory issue(s) (depth/empty branch), but no orphan/cycle link errors to auto-repair.`,
                    type: 'info'
                });
                return;
            }
            const folders = getFolderMap(resolvedType);
            const toRepairSet = new Set([...report.selfParents, ...report.orphans]);
            report.cycles.forEach((cycle) => {
                const first = Array.isArray(cycle) ? String(cycle[0] || '').trim() : '';
                if (first) {
                    toRepairSet.add(first);
                }
            });
            const toRepair = Array.from(toRepairSet).filter((id) => Object.prototype.hasOwnProperty.call(folders, id));
            if (!toRepair.length) {
                return;
            }
            if (!ensureRuntimeConflictActionAllowed(`Repair ${resolvedType.toUpperCase()} nested tree integrity`)) {
                return;
            }
            const confirmed = await new Promise((resolve) => {
                swal({
                    title: 'Repair tree integrity?',
                    text: `This will reset parent links to root for ${toRepair.length} folder(s). Advisory depth/empty-branch warnings are reported but not auto-changed.`,
                    type: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Repair',
                    cancelButtonText: 'Cancel'
                }, (ok) => resolve(ok === true));
            });
            if (!confirmed) {
                return;
            }
            let backup = null;
            try {
                backup = await createBackup(resolvedType, `before-tree-integrity-repair-${Date.now()}`);
                for (const id of toRepair) {
                    const folder = folders[id];
                    await saveFolderRecord(resolvedType, id, {
                        ...folder,
                        parentId: ''
                    });
                }
                await refreshType(resolvedType);
                if (backup?.name) {
                    await offerUndoAction(resolvedType, backup, 'Tree integrity repair');
                }
                swal({
                    title: 'Repair complete',
                    text: `Fixed ${toRepair.length} folder link${toRepair.length === 1 ? '' : 's'}. Remaining advisory warnings: ${advisoryIssueCount}.`,
                    type: 'success'
                });
            } catch (error) {
                showError('Tree integrity repair failed', error);
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
            runTreeIntegrityCheck,
            previewFolderRuntimeAction,
            applyFolderRuntimeAction
        });
    };

    return Object.freeze({
        createApi
    });
}));
