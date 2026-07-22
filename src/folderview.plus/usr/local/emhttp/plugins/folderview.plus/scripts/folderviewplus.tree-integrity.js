// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusTreeIntegrity = factory();
    root.FolderViewPlusTreeIntegrityModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const createApi = (deps = {}) => {
        const swal = typeof deps.swal === 'function' ? deps.swal : (() => {});
        const utils = deps.utils || {};
        const normalizeManagedType = typeof deps.normalizeManagedType === 'function'
            ? deps.normalizeManagedType
            : ((value) => String(value || '').trim().toLowerCase() === 'vm' ? 'vm' : 'docker');
        const getFolderMap = typeof deps.getFolderMap === 'function' ? deps.getFolderMap : (() => ({}));
        const buildFolderHierarchyMeta = typeof deps.buildFolderHierarchyMeta === 'function'
            ? deps.buildFolderHierarchyMeta
            : (() => ({ childrenById: {}, depthById: {}, idSet: new Set() }));
        const createBackup = typeof deps.createBackup === 'function' ? deps.createBackup : (async () => null);
        const offerUndoAction = typeof deps.offerUndoAction === 'function' ? deps.offerUndoAction : (async () => {});
        const showToastMessage = typeof deps.showToastMessage === 'function' ? deps.showToastMessage : (() => {});
        const showError = typeof deps.showError === 'function' ? deps.showError : (() => {});
        const requestFolderBatchMutation = typeof deps.requestFolderBatchMutation === 'function'
            ? deps.requestFolderBatchMutation
            : (async () => ({}));
        const ensureRuntimeConflictActionAllowed = typeof deps.ensureRuntimeConflictActionAllowed === 'function'
            ? deps.ensureRuntimeConflictActionAllowed
            : (() => true);
        const refreshTreeIntegrityState = typeof deps.refreshTreeIntegrityState === 'function'
            ? deps.refreshTreeIntegrityState
            : (async () => ({ expectedRevision: null }));
        const setTreeIntegrityBusy = typeof deps.setTreeIntegrityBusy === 'function'
            ? deps.setTreeIntegrityBusy
            : (() => {});
        const depthWarnLevel = Number.isFinite(Number(deps.TREE_INTEGRITY_DEPTH_WARN_LEVEL))
            ? Number(deps.TREE_INTEGRITY_DEPTH_WARN_LEVEL)
            : 6;
        const busyByType = { docker: false, vm: false };

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

        const scan = (type, foldersInput = null) => {
            const resolvedType = normalizeManagedType(type);
            const { folders, parentMap } = buildRawParentMap(foldersInput || getFolderMap(resolvedType));
            const ids = Object.keys(folders);
            const idSet = new Set(ids);
            const selfParents = [];
            const orphans = [];
            const cycles = [];
            const cycleKeys = new Set();

            ids.forEach((id) => {
                const parentId = String(parentMap[id] || '').trim();
                if (!parentId) return;
                if (parentId === id) {
                    selfParents.push(id);
                    return;
                }
                if (!idSet.has(parentId)) orphans.push(id);
            });

            const visited = new Set();
            const inPath = new Set();
            const traverse = (id, chain = []) => {
                if (inPath.has(id)) {
                    const startIndex = chain.indexOf(id);
                    if (startIndex >= 0) {
                        const uniqueCycleIds = Array.from(new Set(chain.slice(startIndex)));
                        if (uniqueCycleIds.length > 1) {
                            const canonicalStart = uniqueCycleIds.reduce((bestIndex, candidate, index) => (
                                String(candidate).localeCompare(String(uniqueCycleIds[bestIndex])) < 0 ? index : bestIndex
                            ), 0);
                            const canonicalIds = uniqueCycleIds
                                .slice(canonicalStart)
                                .concat(uniqueCycleIds.slice(0, canonicalStart));
                            const cycleKey = canonicalIds.slice().sort().join('\u0000');
                            if (!cycleKeys.has(cycleKey)) {
                                cycleKeys.add(cycleKey);
                                cycles.push(canonicalIds.concat(canonicalIds[0]));
                            }
                        }
                    }
                    return;
                }
                if (visited.has(id)) return;
                visited.add(id);
                inPath.add(id);
                const parentId = String(parentMap[id] || '').trim();
                if (parentId && idSet.has(parentId)) traverse(parentId, chain.concat(id));
                inPath.delete(id);
            };
            ids.forEach((id) => traverse(id, []));

            const structurallyInvalidIds = new Set([...selfParents, ...orphans]);
            cycles.forEach((cycle) => {
                cycle.slice(0, -1).forEach((id) => structurallyInvalidIds.add(String(id || '').trim()));
            });

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
                if (!safeId) return 0;
                if (Object.prototype.hasOwnProperty.call(branchMemberCache, safeId)) {
                    return Number(branchMemberCache[safeId] || 0);
                }
                if (seen.has(safeId)) return 0;
                seen.add(safeId);
                const folder = folders[safeId] || {};
                const directMembers = typeof utils.normalizeFolderMembers === 'function'
                    ? utils.normalizeFolderMembers(folder?.containers || []).length
                    : (Array.isArray(folder?.containers) ? folder.containers.length : 0);
                let total = directMembers;
                const children = Array.isArray(childrenById[safeId]) ? childrenById[safeId] : [];
                for (const childId of children) total += getBranchMemberCount(childId, seen);
                seen.delete(safeId);
                branchMemberCache[safeId] = total;
                return total;
            };
            const depthWarnings = [];
            const emptyBranches = [];
            let maxDepth = 0;
            for (const id of ids) {
                if (structurallyInvalidIds.has(id)) continue;
                const depth = Math.max(0, Number(depthById[id] || 0));
                if (depth > maxDepth) maxDepth = depth;
                if (depth > depthWarnLevel) {
                    depthWarnings.push({ id, name: String(folders[id]?.name || id), depth });
                }
                const children = Array.isArray(childrenById[id]) ? childrenById[id] : [];
                if (children.length > 0 && getBranchMemberCount(id) <= 0) {
                    emptyBranches.push({ id, name: String(folders[id]?.name || id), depth });
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
                emptyBranches,
                structurallyInvalidIds: Array.from(structurallyInvalidIds)
            };
        };

        const getCounts = (report) => {
            const safeReport = report && typeof report === 'object' ? report : {};
            const selfParentCount = Array.isArray(safeReport.selfParents) ? safeReport.selfParents.length : 0;
            const orphanCount = Array.isArray(safeReport.orphans) ? safeReport.orphans.length : 0;
            const cycleCount = Array.isArray(safeReport.cycles) ? safeReport.cycles.length : 0;
            const depthWarningCount = Array.isArray(safeReport.depthWarnings) ? safeReport.depthWarnings.length : 0;
            const emptyBranchCount = Array.isArray(safeReport.emptyBranches) ? safeReport.emptyBranches.length : 0;
            return {
                selfParentCount,
                orphanCount,
                cycleCount,
                depthWarningCount,
                emptyBranchCount,
                repairableIssueCount: selfParentCount + orphanCount + cycleCount,
                advisoryIssueCount: depthWarningCount + emptyBranchCount
            };
        };

        const getRepairIds = (report, folders) => {
            const repairIds = new Set([
                ...(Array.isArray(report?.selfParents) ? report.selfParents : []),
                ...(Array.isArray(report?.orphans) ? report.orphans : [])
            ]);
            (Array.isArray(report?.cycles) ? report.cycles : []).forEach((cycle) => {
                const first = Array.isArray(cycle) ? String(cycle[0] || '').trim() : '';
                if (first) repairIds.add(first);
            });
            return Array.from(repairIds).filter((id) => Object.prototype.hasOwnProperty.call(folders, id));
        };

        const run = async (type, options = {}) => {
            const repair = typeof options === 'boolean' ? options : options?.repair === true;
            const resolvedType = normalizeManagedType(type);
            if (busyByType[resolvedType]) return;
            busyByType[resolvedType] = true;
            setTreeIntegrityBusy(resolvedType, true, repair ? 'repair' : 'scan');
            try {
                const refreshedState = await refreshTreeIntegrityState(resolvedType, { reason: repair ? 'repair' : 'scan' });
                const report = scan(resolvedType);
                const counts = getCounts(report);
                if (counts.repairableIssueCount + counts.advisoryIssueCount <= 0) {
                    swal({
                        title: 'Tree integrity healthy',
                        text: `${resolvedType.toUpperCase()} nested folder structure has no cycle/orphan/depth/empty-branch issues.`,
                        type: 'success'
                    });
                    return;
                }
                if (!repair) {
                    const cyclePreview = report.cycles.slice(0, 3).map((cycle) => cycle.join(' -> ')).join('\n');
                    const depthPreview = report.depthWarnings.slice(0, 4).map((row) => `${row.name} (depth ${row.depth})`).join('\n');
                    const emptyBranchPreview = report.emptyBranches.slice(0, 4).map((row) => `${row.name} (depth ${row.depth})`).join('\n');
                    const details = [
                        'Repairable link errors',
                        `Self-parent links: ${counts.selfParentCount}`,
                        `Orphans: ${counts.orphanCount}`,
                        `Cycles: ${counts.cycleCount}`,
                        '',
                        'Advisory warnings',
                        `Depth warnings (> ${depthWarnLevel}): ${counts.depthWarningCount}`,
                        `Empty branches (no members in subtree): ${counts.emptyBranchCount}`,
                        `Max valid depth: ${report.maxDepth}`,
                        cyclePreview ? `\nCycle preview:\n${cyclePreview}` : '',
                        depthPreview ? `\nDeep branch preview:\n${depthPreview}` : '',
                        emptyBranchPreview ? `\nEmpty branch preview:\n${emptyBranchPreview}` : ''
                    ].join('\n');
                    swal({
                        title: 'Tree integrity issues found',
                        text: details,
                        type: counts.repairableIssueCount > 0 ? 'warning' : 'info'
                    });
                    return;
                }
                if (counts.repairableIssueCount <= 0) {
                    swal({
                        title: 'No repairable link issues',
                        text: `Detected ${counts.advisoryIssueCount} advisory issue(s) (depth/empty branch), but no orphan/cycle link errors to auto-repair.`,
                        type: 'info'
                    });
                    return;
                }
                const folders = getFolderMap(resolvedType);
                const toRepair = getRepairIds(report, folders);
                if (!toRepair.length) return;
                if (!ensureRuntimeConflictActionAllowed(`Repair ${resolvedType.toUpperCase()} nested tree integrity`)) return;
                const expectedRevision = Number(refreshedState?.expectedRevision);
                if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
                    throw new Error('Unable to verify the current folder configuration revision. Refresh and try again.');
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
                if (!confirmed) return;
                const backup = await createBackup(resolvedType, `before-tree-integrity-repair-${Date.now()}`);
                if (!backup?.name) {
                    throw new Error('A pre-repair backup could not be verified, so no folder links were changed.');
                }
                await requestFolderBatchMutation(resolvedType, {
                    deletes: [],
                    creates: [],
                    upserts: toRepair.map((id) => ({
                        id,
                        folder: { ...folders[id], parentId: '' }
                    }))
                }, { expectedRevision });
                await offerUndoAction(resolvedType, backup, 'Tree integrity repair');
                try {
                    await refreshTreeIntegrityState(resolvedType, { reason: 'verify' });
                } catch (verificationError) {
                    showToastMessage({
                        title: 'Repair saved; verification unavailable',
                        message: `Fixed ${toRepair.length} folder link${toRepair.length === 1 ? '' : 's'}, but the saved tree could not be reloaded for verification. ${verificationError?.message || verificationError}`,
                        level: 'warning',
                        durationMs: 7000
                    });
                    return;
                }
                const verifiedCounts = getCounts(scan(resolvedType));
                swal({
                    title: verifiedCounts.repairableIssueCount > 0 ? 'Repair incomplete' : 'Repair complete',
                    text: `Fixed ${toRepair.length} folder link${toRepair.length === 1 ? '' : 's'}. Verified remaining link errors: ${verifiedCounts.repairableIssueCount}. Remaining advisory warnings: ${verifiedCounts.advisoryIssueCount}.`,
                    type: verifiedCounts.repairableIssueCount > 0 ? 'warning' : 'success'
                });
            } catch (error) {
                showError(repair ? 'Tree integrity repair failed' : 'Tree integrity scan failed', error);
            } finally {
                busyByType[resolvedType] = false;
                setTreeIntegrityBusy(resolvedType, false, repair ? 'repair' : 'scan');
            }
        };

        return Object.freeze({ scan, run });
    };

    return Object.freeze({ createApi });
}));
