/* Settings tree and hierarchy helpers extracted from folderviewplus.js. */
const TREE_MOVE_PLACEMENTS = new Set(['before', 'after', 'inside']);

const normalizeTreeMovePlacement = (value) => (
    TREE_MOVE_PLACEMENTS.has(String(value || '').trim().toLowerCase())
        ? String(value || '').trim().toLowerCase()
        : 'inside'
);

const buildFolderPathLabel = (type, folderId, foldersInput = null, hierarchyMeta = null) => {
    const resolvedType = normalizeManagedType(type);
    const folders = utils.normalizeFolderMap(foldersInput || getFolderMap(resolvedType));
    const safeId = String(folderId || '').trim();
    if (!safeId || !Object.prototype.hasOwnProperty.call(folders, safeId)) {
        return safeId;
    }
    const meta = hierarchyMeta || buildFolderHierarchyMeta(folders);
    const parts = [];
    const seen = new Set();
    let cursor = safeId;
    while (cursor && !seen.has(cursor)) {
        seen.add(cursor);
        parts.unshift(String(folders[cursor]?.name || cursor));
        cursor = String(meta.parentById?.[cursor] || '').trim();
    }
    return parts.join(' / ');
};

const buildFolderHierarchyMeta = (foldersInput) => {
    const folders = utils.normalizeFolderMap(foldersInput || {});
    const ids = Object.keys(folders);
    const idSet = new Set(ids);
    const parentById = {};
    const childrenById = {};
    const depthById = {};
    const descendantsById = {};
    const indexById = new Map(ids.map((id, index) => [id, index]));

    for (const id of ids) {
        childrenById[id] = [];
    }

    for (const id of ids) {
        const rawParent = String(folders[id]?.parentId || '').trim();
        const safeParent = (rawParent && rawParent !== id && idSet.has(rawParent)) ? rawParent : '';
        parentById[id] = safeParent;
        if (safeParent) {
            childrenById[safeParent].push(id);
        }
    }

    const sortBySourceOrder = (left, right) => (
        (indexById.get(left) || 0) - (indexById.get(right) || 0)
    );
    for (const children of Object.values(childrenById)) {
        children.sort(sortBySourceOrder);
    }

    const visitedDepth = new Set();
    const assignDepth = (id, depth, path = new Set()) => {
        if (!idSet.has(id) || path.has(id)) {
            return;
        }
        const nextPath = new Set(path);
        nextPath.add(id);
        if (!Object.prototype.hasOwnProperty.call(depthById, id)) {
            depthById[id] = depth;
        } else {
            depthById[id] = Math.min(depthById[id], depth);
        }
        for (const childId of (childrenById[id] || [])) {
            assignDepth(childId, depth + 1, nextPath);
        }
        visitedDepth.add(id);
    };

    const rootIds = ids.filter((id) => !parentById[id]);
    rootIds.sort(sortBySourceOrder);
    for (const rootId of rootIds) {
        assignDepth(rootId, 0);
    }
    for (const id of ids) {
        if (!visitedDepth.has(id)) {
            assignDepth(id, 0);
        }
    }

    const collectDescendants = (id, path = new Set()) => {
        if (!idSet.has(id) || path.has(id)) {
            return [];
        }
        const nextPath = new Set(path);
        nextPath.add(id);
        const output = [];
        for (const childId of (childrenById[id] || [])) {
            if (!output.includes(childId)) {
                output.push(childId);
            }
            const childDescendants = collectDescendants(childId, nextPath);
            for (const descendantId of childDescendants) {
                if (!output.includes(descendantId)) {
                    output.push(descendantId);
                }
            }
        }
        return output;
    };

    for (const id of ids) {
        descendantsById[id] = collectDescendants(id);
    }

    return {
        ids,
        idSet,
        parentById,
        childrenById,
        depthById,
        descendantsById
    };
};

const areStringSetsEqual = (left, right) => {
    if (!(left instanceof Set) || !(right instanceof Set)) {
        return false;
    }
    if (left.size !== right.size) {
        return false;
    }
    for (const value of left) {
        if (!right.has(value)) {
            return false;
        }
    }
    return true;
};

const normalizeCollapsedTreeParentsForType = (type, foldersInput = null, hierarchyMeta = null) => {
    const resolvedType = normalizeManagedType(type);
    const folders = foldersInput && typeof foldersInput === 'object'
        ? utils.normalizeFolderMap(foldersInput)
        : getFolderMap(resolvedType);
    const meta = hierarchyMeta || buildFolderHierarchyMeta(folders);
    const source = collapsedTreeParentsByType[resolvedType] instanceof Set
        ? collapsedTreeParentsByType[resolvedType]
        : new Set();
    const normalized = new Set();
    for (const rawId of source) {
        const id = String(rawId || '').trim();
        if (!id || !meta.idSet.has(id)) {
            continue;
        }
        if (Array.isArray(meta.childrenById[id]) && meta.childrenById[id].length > 0) {
            normalized.add(id);
        }
    }
    return normalized;
};

const syncCollapsedTreeParentsForType = (type, foldersInput = null, hierarchyMeta = null, { persist = false } = {}) => {
    const resolvedType = normalizeManagedType(type);
    const normalized = normalizeCollapsedTreeParentsForType(resolvedType, foldersInput, hierarchyMeta);
    const previous = collapsedTreeParentsByType[resolvedType] instanceof Set
        ? collapsedTreeParentsByType[resolvedType]
        : new Set();
    const changed = !areStringSetsEqual(previous, normalized);
    collapsedTreeParentsByType[resolvedType] = normalized;
    if (persist || changed) {
        persistTableUiState();
    }
    return normalized;
};

const isFolderHiddenByCollapsedAncestor = (folderId, parentById, collapsedSet) => {
    const safeFolderId = String(folderId || '').trim();
    if (!safeFolderId || !(collapsedSet instanceof Set) || collapsedSet.size <= 0) {
        return false;
    }
    const visited = new Set([safeFolderId]);
    let cursor = String(parentById?.[safeFolderId] || '').trim();
    while (cursor) {
        if (collapsedSet.has(cursor)) {
            return true;
        }
        if (visited.has(cursor)) {
            break;
        }
        visited.add(cursor);
        cursor = String(parentById?.[cursor] || '').trim();
    }
    return false;
};

const canFolderUseTreeMove = (type, sourceFolderId, hierarchyMeta = null) => {
    const resolvedType = normalizeManagedType(type);
    const safeFolderId = String(sourceFolderId || '').trim();
    if (!safeFolderId) {
        return false;
    }
    const folders = getFolderMap(resolvedType);
    if (!Object.prototype.hasOwnProperty.call(folders, safeFolderId)) {
        return false;
    }
    const meta = hierarchyMeta || buildFolderHierarchyMeta(folders);
    const blocked = new Set([safeFolderId, ...(meta.descendantsById[safeFolderId] || [])]);
    for (const candidateId of Object.keys(folders)) {
        if (!blocked.has(candidateId)) {
            return true;
        }
    }
    return false;
};

const treePathHintSelectorByType = Object.freeze({
    docker: '#docker-tree-path-hint',
    vm: '#vm-tree-path-hint'
});

const updateMobileTreePathHint = (type, folderId = '') => {
    const resolvedType = normalizeManagedType(type);
    const selector = treePathHintSelectorByType[resolvedType];
    const host = selector ? $(selector) : $();
    if (!host.length) {
        return;
    }
    const id = String(folderId || '').trim();
    if (!id) {
        host.text('Path: select a folder');
        return;
    }
    const folders = getFolderMap(resolvedType);
    if (!Object.prototype.hasOwnProperty.call(folders, id)) {
        host.text('Path: folder unavailable');
        return;
    }
    const hierarchyMeta = buildFolderHierarchyMeta(folders);
    const path = buildFolderPathLabel(resolvedType, id, folders, hierarchyMeta);
    host.text(`Path: ${path}`);
};

const getFolderBranchIds = (type, folderId, hierarchyMeta = null) => {
    const resolvedType = normalizeManagedType(type);
    const sourceId = String(folderId || '').trim();
    if (!sourceId) {
        return [];
    }
    const folders = getFolderMap(resolvedType);
    if (!Object.prototype.hasOwnProperty.call(folders, sourceId)) {
        return [];
    }
    const meta = hierarchyMeta || buildFolderHierarchyMeta(folders);
    return [sourceId, ...(meta.descendantsById[sourceId] || [])];
};

const setFolderBranchCollapse = (type, folderId, collapse = true) => {
    const resolvedType = normalizeManagedType(type);
    const folders = getFolderMap(resolvedType);
    const hierarchyMeta = buildFolderHierarchyMeta(folders);
    const branchIds = getFolderBranchIds(resolvedType, folderId, hierarchyMeta);
    if (!branchIds.length) {
        return;
    }
    const collapsed = syncCollapsedTreeParentsForType(resolvedType, folders, hierarchyMeta);
    if (collapse) {
        for (const id of branchIds) {
            const children = Array.isArray(hierarchyMeta.childrenById[id]) ? hierarchyMeta.childrenById[id] : [];
            if (children.length > 0) {
                collapsed.add(id);
            }
        }
    } else {
        for (const id of branchIds) {
            collapsed.delete(id);
        }
    }
    collapsedTreeParentsByType[resolvedType] = collapsed;
    persistTableUiState();
    scheduleTableRender(resolvedType);
};

const toggleFolderTreeCollapse = (type, folderId) => {
    const resolvedType = normalizeManagedType(type);
    const safeFolderId = String(folderId || '').trim();
    if (!safeFolderId) {
        return;
    }
    const folders = getFolderMap(resolvedType);
    if (!Object.prototype.hasOwnProperty.call(folders, safeFolderId)) {
        return;
    }
    const hierarchyMeta = buildFolderHierarchyMeta(folders);
    const children = Array.isArray(hierarchyMeta.childrenById[safeFolderId])
        ? hierarchyMeta.childrenById[safeFolderId]
        : [];
    if (children.length <= 0) {
        return;
    }
    const collapsed = syncCollapsedTreeParentsForType(resolvedType, folders, hierarchyMeta);
    if (collapsed.has(safeFolderId)) {
        collapsed.delete(safeFolderId);
    } else {
        collapsed.add(safeFolderId);
    }
    collapsedTreeParentsByType[resolvedType] = collapsed;
    persistTableUiState();
    scheduleTableRender(resolvedType);
};

const expandAllFolderTrees = (type) => {
    const resolvedType = normalizeManagedType(type);
    collapsedTreeParentsByType[resolvedType] = new Set();
    persistTableUiState();
    scheduleTableRender(resolvedType);
};

const collapseAllFolderTrees = (type) => {
    const resolvedType = normalizeManagedType(type);
    const folders = getFolderMap(resolvedType);
    const hierarchyMeta = buildFolderHierarchyMeta(folders);
    const collapsed = new Set();
    Object.entries(hierarchyMeta.childrenById || {}).forEach(([folderId, children]) => {
        if (Array.isArray(children) && children.length > 0) {
            collapsed.add(String(folderId || ''));
        }
    });
    collapsedTreeParentsByType[resolvedType] = collapsed;
    persistTableUiState();
    scheduleTableRender(resolvedType);
};

const getOrderedFolderIdsForTreeOps = (type) => {
    const resolvedType = normalizeManagedType(type);
    const orderedMap = utils.orderFoldersByPrefs(getFolderMap(resolvedType), prefsByType[resolvedType] || {});
    return Object.keys(orderedMap);
};

const findLastMatchingOrderIndex = (orderIds, candidateIds) => {
    const list = Array.isArray(orderIds) ? orderIds : [];
    const candidates = new Set(Array.isArray(candidateIds) ? candidateIds : []);
    for (let index = list.length - 1; index >= 0; index -= 1) {
        if (candidates.has(String(list[index] || ''))) {
            return index;
        }
    }
    return -1;
};

const clearFolderTreeMoveError = (type, folderId, { rerender = true } = {}) => {
    const resolvedType = normalizeManagedType(type);
    const safeFolderId = String(folderId || '').trim();
    if (!safeFolderId) {
        return;
    }
    if (folderTreeMoveErrorTimersByType[resolvedType]?.[safeFolderId]) {
        window.clearTimeout(folderTreeMoveErrorTimersByType[resolvedType][safeFolderId]);
        delete folderTreeMoveErrorTimersByType[resolvedType][safeFolderId];
    }
    if (folderTreeMoveErrorsByType[resolvedType]?.[safeFolderId]) {
        delete folderTreeMoveErrorsByType[resolvedType][safeFolderId];
        if (rerender) {
            scheduleTableRender(resolvedType);
        }
    }
};

const setFolderTreeMoveError = (type, folderId, message) => {
    const resolvedType = normalizeManagedType(type);
    const safeFolderId = String(folderId || '').trim();
    const safeMessage = String(message || '').trim();
    if (!safeFolderId || !safeMessage) {
        return;
    }
    folderTreeMoveErrorsByType[resolvedType][safeFolderId] = safeMessage;
    if (folderTreeMoveErrorTimersByType[resolvedType]?.[safeFolderId]) {
        window.clearTimeout(folderTreeMoveErrorTimersByType[resolvedType][safeFolderId]);
    }
    folderTreeMoveErrorTimersByType[resolvedType][safeFolderId] = window.setTimeout(() => {
        clearFolderTreeMoveError(resolvedType, safeFolderId);
    }, 7000);
    scheduleTableRender(resolvedType);
};

const getFolderInheritanceFlags = (folder) => {
    const settings = (folder && typeof folder.settings === 'object' && folder.settings !== null)
        ? folder.settings
        : {};
    return {
        icon: settings.inherit_parent_icon === true,
        status: settings.inherit_parent_status === true,
        runtime: settings.inherit_parent_runtime === true
    };
};

const resolveInheritedFolderIcon = (type, folderId, foldersInput = null, hierarchyMeta = null) => {
    const resolvedType = normalizeManagedType(type);
    const folders = utils.normalizeFolderMap(foldersInput || getFolderMap(resolvedType));
    const sourceId = String(folderId || '').trim();
    if (!sourceId || !Object.prototype.hasOwnProperty.call(folders, sourceId)) {
        return '/plugins/folderview.plus/images/folder-icon.png';
    }
    const meta = hierarchyMeta || buildFolderHierarchyMeta(folders);
    const sourceFolder = folders[sourceId];
    const sourceFlags = getFolderInheritanceFlags(sourceFolder);
    const ownIcon = String(sourceFolder?.icon || '').trim();
    if (!sourceFlags.icon) {
        return ownIcon || '/plugins/folderview.plus/images/folder-icon.png';
    }
    const visited = new Set([sourceId]);
    let cursor = String(meta.parentById?.[sourceId] || '').trim();
    while (cursor && !visited.has(cursor) && Object.prototype.hasOwnProperty.call(folders, cursor)) {
        visited.add(cursor);
        const folder = folders[cursor];
        const icon = String(folder?.icon || '').trim();
        if (icon) {
            return icon;
        }
        const flags = getFolderInheritanceFlags(folder);
        if (!flags.icon) {
            break;
        }
        cursor = String(meta.parentById?.[cursor] || '').trim();
    }
    return ownIcon || '/plugins/folderview.plus/images/folder-icon.png';
};

const moveFolderRow = async (type, folderId, direction) => {
    const resolvedType = normalizeManagedType(type);
    if (!ensureRuntimeConflictActionAllowed(`Reorder ${resolvedType === 'docker' ? 'Docker' : 'VM'} folders`)) {
        return;
    }

    const safeFolderId = String(folderId || '').trim();
    if (!safeFolderId) {
        return;
    }

    let sortMode = prefsByType[resolvedType]?.sortMode || 'created';
    if (sortMode !== 'manual') {
        await changeSortMode(resolvedType, 'manual');
        sortMode = 'manual';
    }

    if (sortMode !== 'manual') {
        return;
    }

    if (direction !== -1 && direction !== 1) {
        return;
    }

    const folders = getFolderMap(resolvedType);
    if (!Object.prototype.hasOwnProperty.call(folders, safeFolderId)) {
        setFolderTreeMoveError(resolvedType, safeFolderId, 'Folder no longer exists.');
        return;
    }

    const hierarchyMeta = buildFolderHierarchyMeta(folders);
    const parentById = hierarchyMeta.parentById || {};
    const currentParentId = String(parentById[safeFolderId] || '').trim();
    const fullOrder = getOrderedFolderIdsForTreeOps(resolvedType);
    const siblingIds = fullOrder.filter((id) => String(parentById[id] || '').trim() === currentParentId);
    const sourceSiblingIndex = siblingIds.indexOf(safeFolderId);
    if (sourceSiblingIndex < 0) {
        setFolderTreeMoveError(resolvedType, safeFolderId, 'Folder order could not be resolved.');
        return;
    }

    const targetSiblingIndex = sourceSiblingIndex + direction;
    if (targetSiblingIndex < 0 || targetSiblingIndex >= siblingIds.length) {
        setFolderTreeMoveError(
            resolvedType,
            safeFolderId,
            direction < 0
                ? 'Already first in this level. Use Tree move to change level.'
                : 'Already last in this level. Use Tree move to change level.'
        );
        return;
    }

    const targetSiblingId = String(siblingIds[targetSiblingIndex] || '').trim();
    if (!targetSiblingId) {
        setFolderTreeMoveError(resolvedType, safeFolderId, 'No sibling found for this move.');
        return;
    }

    const sourceSubtreeIds = [safeFolderId, ...(hierarchyMeta.descendantsById[safeFolderId] || [])];
    const targetSubtreeIds = [targetSiblingId, ...(hierarchyMeta.descendantsById[targetSiblingId] || [])];
    const sourceSubtreeSet = new Set(sourceSubtreeIds);
    const orderWithoutSource = fullOrder.filter((id) => !sourceSubtreeSet.has(String(id || '')));
    let insertIndex = orderWithoutSource.length;
    if (direction < 0) {
        const firstTargetIndex = orderWithoutSource.findIndex((id) => targetSubtreeIds.includes(String(id || '')));
        insertIndex = firstTargetIndex >= 0 ? firstTargetIndex : orderWithoutSource.length;
    } else {
        const lastTargetIndex = findLastMatchingOrderIndex(orderWithoutSource, targetSubtreeIds);
        insertIndex = lastTargetIndex >= 0 ? (lastTargetIndex + 1) : orderWithoutSource.length;
    }
    const nextOrder = orderWithoutSource.slice();
    nextOrder.splice(Math.max(0, Math.min(insertIndex, nextOrder.length)), 0, ...sourceSubtreeIds);
    const orderChanged = nextOrder.length === fullOrder.length
        && nextOrder.some((id, index) => String(id || '') !== String(fullOrder[index] || ''));
    if (!orderChanged) {
        setFolderTreeMoveError(resolvedType, safeFolderId, 'Folder is already in that position.');
        return;
    }

    let backup = null;

    try {
        clearFolderTreeMoveError(resolvedType, safeFolderId, { rerender: false });
        backup = await createBackup(resolvedType, `before-reorder-${safeFolderId}`);
        await persistManualOrder(resolvedType, nextOrder, { refresh: false });
        await refreshType(resolvedType);
        if (backup?.name) {
            await recordTreeMoveHistoryFromBackup(resolvedType, backup.name, 'Reorder folders', safeFolderId);
        }
        const sourceName = String(folders[safeFolderId]?.name || safeFolderId);
        const targetName = String(folders[targetSiblingId]?.name || targetSiblingId);
        addActivityEntry(`Reordered folder: ${sourceName} ${direction < 0 ? 'before' : 'after'} ${targetName}.`, 'success');
        focusFolderRow(resolvedType, safeFolderId);
    } catch (error) {
        await refreshType(resolvedType);
        setFolderTreeMoveError(resolvedType, safeFolderId, error?.message || 'Order save failed.');
        showError('Order save failed', error);
    }
};

const handleFolderRowKeydown = (type, folderId, event) => {
    if (!event) {
        return;
    }
    if (!event.altKey) {
        return;
    }
    if (event.key === 'ArrowUp') {
        event.preventDefault();
        void moveFolderRow(type, folderId, -1);
        return;
    }
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        void moveFolderRow(type, folderId, 1);
    }
};

const renderFolderSelectOptions = (type) => {
    const folders = getFolderMap(type);
    const entries = Object.entries(folders);
    const hasFolders = entries.length > 0;
    const setOptionsPreserveValue = (selector, html, disabled) => {
        const select = $(selector);
        if (!select.length) {
            return;
        }
        const previous = String(select.val() || '').trim();
        select.html(html).prop('disabled', disabled === true);
        if (!previous) {
            return;
        }
        const hasPrevious = select.find('option').toArray().some((option) => String(option.value || '') === previous);
        if (hasPrevious) {
            select.val(previous);
        }
    };

    const simpleOptions = hasFolders
        ? entries.map(([id, folder]) => `<option value="${escapeHtml(id)}">${escapeHtml(folder.name || id)}</option>`).join('')
        : '<option value="">(Create a folder first)</option>';
    let bulkOptions = '<option value="">(Create a folder first)</option>';
    if (hasFolders) {
        const hierarchyMeta = buildFolderHierarchyMeta(folders);
        const orderedIds = getOrderedFolderIdsForTreeOps(type);
        bulkOptions = orderedIds.map((id) => {
            if (!Object.prototype.hasOwnProperty.call(folders, id)) {
                return '';
            }
            const depth = Math.max(0, Number(hierarchyMeta.depthById?.[id] || 0));
            const indent = depth > 0 ? '&nbsp;'.repeat(Math.min(12, depth) * 2) : '';
            const label = buildFolderPathLabel(type, id, folders, hierarchyMeta);
            return `<option value="${escapeHtml(id)}">${indent}${escapeHtml(label)}</option>`;
        }).join('');
    }

    setOptionsPreserveValue(`#${type}-rule-folder`, simpleOptions, !hasFolders);
    setOptionsPreserveValue(`#${type}-bulk-folder`, bulkOptions, !hasFolders);
    setOptionsPreserveValue(`#${type}-template-source-folder`, simpleOptions, !hasFolders);
    setOptionsPreserveValue(`#${type}-runtime-folder`, simpleOptions, !hasFolders);
    $(`#${type}-bulk-assign-btn`).prop('disabled', !hasFolders);
    if (!hasFolders) {
        $(`#${type}-bulk-help`).text('Create at least one folder first, then assign items here.');
    }
};

window.FolderViewPlusSettingsTree = Object.freeze({
    normalizeTreeMovePlacement,
    buildFolderPathLabel,
    buildFolderHierarchyMeta,
    normalizeCollapsedTreeParentsForType,
    syncCollapsedTreeParentsForType,
    isFolderHiddenByCollapsedAncestor,
    canFolderUseTreeMove,
    updateMobileTreePathHint,
    getFolderBranchIds,
    setFolderBranchCollapse,
    toggleFolderTreeCollapse,
    expandAllFolderTrees,
    collapseAllFolderTrees,
    getOrderedFolderIdsForTreeOps,
    findLastMatchingOrderIndex,
    clearFolderTreeMoveError,
    setFolderTreeMoveError,
    resolveInheritedFolderIcon,
    moveFolderRow,
    handleFolderRowKeydown,
    renderFolderSelectOptions
});
window.FolderViewPlusSettingsTreeModuleLoaded = true;
