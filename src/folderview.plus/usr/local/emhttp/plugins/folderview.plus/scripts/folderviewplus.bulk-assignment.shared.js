// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusBulkAssignmentShared = factory();
    root.FolderViewPlusBulkAssignmentSharedModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const fallbackWindow = typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : null);
    const DEFAULT_BULK_ASSIGN_CHUNK_SIZE = 40;
    const DEFAULT_BULK_ASSIGN_CHUNK_PAUSE_MS = 20;

    const createApi = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        const utils = deps.utils || {};
        const normalizeManagedType = typeof deps.normalizeManagedType === 'function'
            ? deps.normalizeManagedType
            : ((value) => String(value || '').trim().toLowerCase() === 'vm' ? 'vm' : 'docker');
        const getFolderMap = typeof deps.getFolderMap === 'function'
            ? deps.getFolderMap
            : (() => ({}));
        const getFolderNameForId = typeof deps.getFolderNameForId === 'function'
            ? deps.getFolderNameForId
            : ((type, id) => String(id || ''));
        const getInfoByType = typeof deps.getInfoByType === 'function'
            ? deps.getInfoByType
            : (() => ({}));
        const apiPostJson = typeof deps.apiPostJson === 'function'
            ? deps.apiPostJson
            : null;
        const requestBulkAssign = typeof deps.requestBulkAssign === 'function'
            ? deps.requestBulkAssign
            : (async (type, folderId, items) => {
                if (typeof apiPostJson !== 'function') {
                    throw new Error('Bulk assignment request API unavailable.');
                }
                const response = await apiPostJson('/plugins/folderview.plus/server/bulk_assign.php', {
                    type,
                    folderId,
                    items: JSON.stringify(items || [])
                });
                if (!response?.ok) {
                    throw new Error(response?.error || 'Bulk assignment failed.');
                }
                return response.result || {};
            });
        const assertRuntimeConflictActionAllowed = typeof deps.assertRuntimeConflictActionAllowed === 'function'
            ? deps.assertRuntimeConflictActionAllowed
            : (() => {});
        const createBackup = typeof deps.createBackup === 'function'
            ? deps.createBackup
            : (async () => null);
        const refreshType = typeof deps.refreshType === 'function'
            ? deps.refreshType
            : (async () => {});
        const refreshBackups = typeof deps.refreshBackups === 'function'
            ? deps.refreshBackups
            : (async () => {});
        const claimOperationLock = typeof deps.claimOperationLock === 'function'
            ? deps.claimOperationLock
            : (() => true);
        const releaseOperationLock = typeof deps.releaseOperationLock === 'function'
            ? deps.releaseOperationLock
            : (() => {});
        const showActionSummaryToast = typeof deps.showActionSummaryToast === 'function'
            ? deps.showActionSummaryToast
            : (() => {});
        const trackDiagnosticsEvent = typeof deps.trackDiagnosticsEvent === 'function'
            ? deps.trackDiagnosticsEvent
            : (async () => {});
        const offerUndoAction = typeof deps.offerUndoAction === 'function'
            ? deps.offerUndoAction
            : (async () => {});
        const setTimeoutRef = typeof deps.setTimeoutRef === 'function'
            ? deps.setTimeoutRef
            : (typeof win?.setTimeout === 'function' ? win.setTimeout.bind(win) : setTimeout);

        const sanitizeBulkItemName = (value) => String(value || '').trim();

        const isValidBulkItemName = (name) => {
            if (!name) {
                return false;
            }
            if (name.length > 255) {
                return false;
            }
            return !/[\x00-\x1F\x7F]/u.test(name);
        };

        const getBulkAssignableNames = (type) => {
            const names = new Set();
            const infoByName = getInfoByType(type) || {};
            for (const name of Object.keys(infoByName || {})) {
                const safeName = sanitizeBulkItemName(name);
                if (safeName) {
                    names.add(safeName);
                }
            }
            const folders = getFolderMap(type);
            for (const folder of Object.values(folders || {})) {
                const members = (utils && typeof utils.normalizeFolderMembers === 'function')
                    ? utils.normalizeFolderMembers(folder?.containers || [])
                    : (Array.isArray(folder?.containers) ? folder.containers.map((value) => String(value || '').trim()).filter(Boolean) : []);
                for (const member of members) {
                    const safeName = sanitizeBulkItemName(member);
                    if (safeName) {
                        names.add(safeName);
                    }
                }
            }
            return Array.from(names).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
        };

        const getBulkMemberFolderLookup = (type, foldersInput = null) => {
            const resolvedType = normalizeManagedType(type);
            const folders = (utils && typeof utils.normalizeFolderMap === 'function')
                ? utils.normalizeFolderMap(foldersInput || getFolderMap(resolvedType))
                : (foldersInput || getFolderMap(resolvedType) || {});
            const byName = {};
            const conflicts = {};
            for (const [folderId, folder] of Object.entries(folders || {})) {
                const members = (utils && typeof utils.normalizeFolderMembers === 'function')
                    ? utils.normalizeFolderMembers(folder?.containers || [])
                    : (Array.isArray(folder?.containers) ? folder.containers.map((value) => String(value || '').trim()).filter(Boolean) : []);
                for (const member of members) {
                    const safeName = sanitizeBulkItemName(member);
                    if (!safeName) {
                        continue;
                    }
                    const previousFolderId = String(byName[safeName] || '').trim();
                    if (!previousFolderId) {
                        byName[safeName] = folderId;
                        continue;
                    }
                    if (previousFolderId === folderId) {
                        continue;
                    }
                    if (!Array.isArray(conflicts[safeName])) {
                        conflicts[safeName] = [previousFolderId];
                    }
                    if (!conflicts[safeName].includes(folderId)) {
                        conflicts[safeName].push(folderId);
                    }
                }
            }
            return { byName, conflicts };
        };

        const buildBulkAssignmentPlan = (type, folderId, namesInput = null) => {
            const resolvedType = normalizeManagedType(type);
            const folders = getFolderMap(resolvedType);
            const targetFolderId = String(folderId || '').trim();
            const targetFolderName = targetFolderId ? String(getFolderNameForId(resolvedType, targetFolderId) || targetFolderId) : '';
            const sourceNames = Array.isArray(namesInput) ? namesInput : [];
            const deduped = [];
            const duplicateNames = [];
            const seen = new Set();
            for (const value of sourceNames) {
                const safeName = sanitizeBulkItemName(value);
                if (!safeName) {
                    continue;
                }
                if (seen.has(safeName)) {
                    duplicateNames.push(safeName);
                    continue;
                }
                seen.add(safeName);
                deduped.push(safeName);
            }
            const invalidNames = deduped.filter((name) => !isValidBulkItemName(name));
            const validNames = deduped.filter((name) => isValidBulkItemName(name));
            const lookup = getBulkMemberFolderLookup(resolvedType, folders);
            const creates = [];
            const moves = [];
            const unchanged = [];
            const conflicts = [];
            for (const name of validNames) {
                const currentFolderId = String(lookup.byName?.[name] || '').trim();
                if (Array.isArray(lookup.conflicts?.[name]) && lookup.conflicts[name].length > 1) {
                    conflicts.push(name);
                }
                if (currentFolderId && currentFolderId === targetFolderId) {
                    unchanged.push({
                        name,
                        currentFolderId,
                        currentFolderName: getFolderNameForId(resolvedType, currentFolderId)
                    });
                    continue;
                }
                if (currentFolderId) {
                    moves.push({
                        name,
                        currentFolderId,
                        currentFolderName: getFolderNameForId(resolvedType, currentFolderId)
                    });
                    continue;
                }
                creates.push({ name });
            }
            return {
                type: resolvedType,
                targetFolderId,
                targetFolderName,
                selectedNames: deduped,
                duplicateNames,
                invalidNames,
                validNames,
                creates,
                moves,
                unchanged,
                conflicts,
                actionableNames: [...creates.map((entry) => entry.name), ...moves.map((entry) => entry.name)]
            };
        };

        const buildBulkAssignmentPreludeLines = (plan, options = {}) => {
            const sourcePlan = plan && typeof plan === 'object' ? plan : {};
            const lines = [];
            for (const name of (Array.isArray(sourcePlan.invalidNames) ? sourcePlan.invalidNames : [])) {
                lines.push({ status: 'invalid', name, detail: String(options.invalidDetail || 'Blocked by validation guard.') });
            }
            for (const name of (Array.isArray(sourcePlan.unchanged) ? sourcePlan.unchanged.map((entry) => entry?.name) : [])) {
                if (!name) {
                    continue;
                }
                lines.push({ status: 'skip', name, detail: String(options.unchangedDetail || 'Already assigned to the selected folder.') });
            }
            if (Array.isArray(sourcePlan.duplicateNames) && sourcePlan.duplicateNames.length > 0) {
                const uniqueDuplicateNames = Array.from(new Set(sourcePlan.duplicateNames));
                for (const name of uniqueDuplicateNames) {
                    lines.push({ status: 'skip', name, detail: String(options.duplicateDetail || 'Duplicate selection dropped.') });
                }
            }
            const extraSkipped = Array.isArray(options.extraSkipped) ? options.extraSkipped : [];
            extraSkipped.forEach((entry) => {
                const safeName = sanitizeBulkItemName(entry?.name);
                if (!safeName) {
                    return;
                }
                lines.push({
                    status: String(entry?.status || 'skip').trim().toLowerCase() || 'skip',
                    name: safeName,
                    detail: String(entry?.detail || 'Skipped.').trim() || 'Skipped.'
                });
            });
            return lines;
        };

        const executeBulkAssignmentPlan = async (type, planInput, options = {}) => {
            const resolvedType = normalizeManagedType(type);
            const plan = planInput && typeof planInput === 'object'
                ? planInput
                : buildBulkAssignmentPlan(resolvedType, '', []);
            const typeLabel = String(options.typeLabel || (resolvedType === 'docker' ? 'Docker' : 'VM')).trim() || 'Item';
            const operationScope = String(options.operationScope || 'bulk').trim() || 'bulk';
            const operationLabel = String(options.operationLabel || `${typeLabel} bulk assignment`).trim() || `${typeLabel} bulk assignment`;
            const backupReason = String(options.backupReason || 'before-bulk-assign').trim() || 'before-bulk-assign';
            const preludeLines = Array.isArray(options.preludeLines)
                ? options.preludeLines.slice()
                : buildBulkAssignmentPreludeLines(plan, options);
            const showUndo = options.offerUndo !== false;
            const trackDiagnostics = options.trackDiagnostics !== false;
            const chunkSize = Number.isFinite(Number(options.chunkSize))
                ? Math.max(1, Number(options.chunkSize))
                : DEFAULT_BULK_ASSIGN_CHUNK_SIZE;
            const chunkPauseMs = Number.isFinite(Number(options.chunkPauseMs))
                ? Math.max(0, Number(options.chunkPauseMs))
                : DEFAULT_BULK_ASSIGN_CHUNK_PAUSE_MS;
            const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
            const actionableNames = Array.isArray(plan.actionableNames) ? plan.actionableNames.filter(Boolean) : [];
            const targetFolderId = String(plan.targetFolderId || '').trim();
            const targetFolderName = String(plan.targetFolderName || targetFolderId).trim() || targetFolderId;

            if (!targetFolderId) {
                throw new Error('Target folder is required.');
            }
            if (actionableNames.length <= 0) {
                return {
                    ok: true,
                    type: resolvedType,
                    backup: null,
                    plan,
                    level: 'warning',
                    summary: `No-op: all selected ${typeLabel} items are already assigned or invalid.`,
                    lines: preludeLines,
                    failedNames: [],
                    assignedCount: 0,
                    skippedCount: preludeLines.filter((entry) => String(entry?.status || '') === 'skip').length,
                    invalidCount: preludeLines.filter((entry) => String(entry?.status || '') === 'invalid').length
                };
            }

            assertRuntimeConflictActionAllowed(`Bulk assign ${typeLabel} items`);
            if (!claimOperationLock(resolvedType, operationScope, operationLabel)) {
                return {
                    ok: false,
                    cancelled: true,
                    type: resolvedType,
                    plan,
                    lines: preludeLines,
                    failedNames: [],
                    assignedCount: 0,
                    skippedCount: 0,
                    invalidCount: 0,
                    summary: `${operationLabel} is already running.`
                };
            }

            let backup = null;
            const failedNames = [];
            const resultLines = preludeLines.slice();

            try {
                backup = await createBackup(resolvedType, backupReason);
                const chunks = [];
                for (let index = 0; index < actionableNames.length; index += chunkSize) {
                    chunks.push(actionableNames.slice(index, index + chunkSize));
                }
                for (let index = 0; index < chunks.length; index += 1) {
                    const chunk = chunks[index];
                    if (onProgress) {
                        onProgress({
                            chunkNumber: index + 1,
                            chunkCount: chunks.length,
                            chunkSize: chunk.length,
                            actionableCount: actionableNames.length,
                            targetFolderId,
                            targetFolderName,
                            resultLines: resultLines.slice()
                        });
                    }
                    try {
                        const result = await requestBulkAssign(resolvedType, targetFolderId, chunk);
                        const assignedSet = new Set(
                            (Array.isArray(result?.assigned) ? result.assigned : [])
                                .map((name) => sanitizeBulkItemName(name))
                                .filter(Boolean)
                        );
                        const invalidSet = new Set(
                            (Array.isArray(result?.skippedInvalid) ? result.skippedInvalid : [])
                                .map((name) => sanitizeBulkItemName(name))
                                .filter(Boolean)
                        );
                        for (const name of chunk) {
                            if (assignedSet.has(name)) {
                                resultLines.push({ status: 'success', name, detail: `Assigned to ${targetFolderName}.` });
                            } else if (invalidSet.has(name)) {
                                resultLines.push({ status: 'invalid', name, detail: 'Blocked by request guard validation.' });
                            } else {
                                failedNames.push(name);
                                resultLines.push({ status: 'failed', name, detail: 'Not applied by server response.' });
                            }
                        }
                    } catch (error) {
                        const message = error?.message || 'Chunk request failed.';
                        for (const name of chunk) {
                            failedNames.push(name);
                            resultLines.push({ status: 'failed', name, detail: message });
                        }
                    }
                    if (index < chunks.length - 1 && chunkPauseMs > 0) {
                        await new Promise((resolve) => setTimeoutRef(resolve, chunkPauseMs));
                    }
                }

                await Promise.allSettled([refreshType(resolvedType), refreshBackups(resolvedType)]);

                const assignedCount = resultLines.filter((row) => row.status === 'success').length;
                const skippedCount = resultLines.filter((row) => row.status === 'skip').length;
                const invalidCount = resultLines.filter((row) => row.status === 'invalid').length;
                const uniqueFailedNames = Array.from(new Set(failedNames));
                const summary = [
                    `${assignedCount} assigned`,
                    `${uniqueFailedNames.length} failed`,
                    `${skippedCount} skipped`,
                    `${invalidCount} invalid`
                ].join(' | ');
                const level = uniqueFailedNames.length > 0 ? 'warning' : 'success';

                showActionSummaryToast({
                    title: `${typeLabel} bulk assignment complete`,
                    message: summary,
                    level,
                    type: resolvedType,
                    focusFolderId: targetFolderId
                });

                if (trackDiagnostics) {
                    await trackDiagnosticsEvent({
                        eventType: 'bulk_assign',
                        type: resolvedType,
                        details: {
                            folderId: targetFolderId,
                            itemCount: Array.isArray(plan.selectedNames) ? plan.selectedNames.length : actionableNames.length,
                            assignedCount,
                            skippedCount,
                            skippedInvalidCount: invalidCount,
                            failedCount: uniqueFailedNames.length,
                            chunkCount: Math.max(1, Math.ceil(actionableNames.length / chunkSize))
                        }
                    });
                }

                if (showUndo) {
                    await offerUndoAction(resolvedType, backup, 'Bulk assignment');
                }

                return {
                    ok: true,
                    type: resolvedType,
                    backup,
                    plan,
                    level,
                    summary,
                    lines: resultLines,
                    failedNames: uniqueFailedNames,
                    assignedCount,
                    skippedCount,
                    invalidCount
                };
            } finally {
                releaseOperationLock(resolvedType, operationScope);
            }
        };

        return Object.freeze({
            sanitizeBulkItemName,
            isValidBulkItemName,
            getBulkAssignableNames,
            getBulkMemberFolderLookup,
            buildBulkAssignmentPlan,
            buildBulkAssignmentPreludeLines,
            executeBulkAssignmentPlan
        });
    };

    return Object.freeze({
        DEFAULT_BULK_ASSIGN_CHUNK_SIZE,
        DEFAULT_BULK_ASSIGN_CHUNK_PAUSE_MS,
        createApi
    });
}));
