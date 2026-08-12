/* Folder row editor and tree-move helpers extracted from folderviewplus.js. */
const buildFolderQuickActionSummary = (type, folderId) => {
    const resolvedType = normalizeManagedType(type);
    const folderMap = getFolderMap(resolvedType);
    const folder = folderMap[folderId];
    if (!folder) {
        return null;
    }

    const memberSnapshot = getEffectiveMemberSnapshot(resolvedType, folderMap);
    const members = Array.isArray(memberSnapshot[folderId]?.members) ? memberSnapshot[folderId].members : [];
    const infoByName = infoByType[resolvedType] || {};
    const countsByState = { started: 0, paused: 0, stopped: 0 };
    for (const member of members) {
        const runtimeState = getItemRuntimeStateKind(resolvedType, infoByName[member] || {});
        if (runtimeState === 'started') {
            countsByState.started += 1;
        } else if (runtimeState === 'paused') {
            countsByState.paused += 1;
        } else {
            countsByState.stopped += 1;
        }
    }

    const rules = (prefsByType[resolvedType]?.autoRules || []).filter(
        (rule) => String(rule?.folderId || '') === String(folderId)
    );
    const activeRuleCount = rules.reduce((count, rule) => (rule?.enabled === false ? count : count + 1), 0);
    const lastChangedRaw = String(folder.updatedAt || folder.createdAt || '').trim();
    const pinned = isFolderPinned(resolvedType, folderId);
    const summary = {
        type: resolvedType,
        folderId: String(folderId || ''),
        folderName: String(folder.name || folderId),
        membersCount: members.length,
        countsByState,
        rulesCount: rules.length,
        activeRulesCount: activeRuleCount,
        lastChanged: lastChangedRaw ? formatTimestamp(lastChangedRaw) : 'Unknown',
        pinned: pinned === true
    };

    if (resolvedType === 'docker') {
        const updateNames = [];
        for (const member of members) {
            if (isDockerUpdateAvailable(infoByName[member] || {})) {
                updateNames.push(String(member));
            }
        }
        const health = evaluateDockerFolderHealth(
            folder,
            members.length,
            countsByState,
            updateNames.length,
            Number(normalizeHealthPrefs('docker').warnStoppedPercent) || 60
        );
        summary.updatesCount = updateNames.length;
        summary.health = health?.text || 'Unknown';
    } else {
        const vmResources = collectVmFolderResources(members, infoByName);
        const vmResourceBadge = evaluateVmResourceBadge(vmResources, normalizeHealthPrefs('vm'));
        summary.autostart = `${vmResources.autostartCount}/${members.length}`;
        summary.resources = vmResourceBadge.text;
        summary.resourceSeverity = vmResourceBadge.severity;
        summary.resourceThresholds = String(vmResourceBadge.title || '');
        summary.resourceChips = vmResourceBadge.chips || null;
    }

    return summary;
};

const buildSettingsFolderEditorUrl = (type, folderId) => {
    const resolvedType = normalizeManagedType(type);
    const params = new URLSearchParams();
    const hashParams = new URLSearchParams();
    params.set('type', resolvedType);
    hashParams.set('type', resolvedType);
    if (String(folderId || '').trim()) {
        params.set('id', String(folderId || '').trim());
        hashParams.set('id', String(folderId || '').trim());
    }
    params.set('_', String(Date.now()));
    return `/${resolvedType === 'vm' ? 'VMs' : 'Docker'}/Folder?${params.toString()}#${hashParams.toString()}`;
};

const openSettingsFolderEditor = (type, folderId) => {
    location.href = buildSettingsFolderEditorUrl(type, folderId);
};

const buildFolderActionRegistry = ({
    resolvedType,
    folderId,
    folder,
    branchIds,
    branchCollapsed,
    branchPinned,
    hasChildren,
    hasParent,
    treeMoveAvailable
}) => {
    const isBranch = branchIds.length > 1;
    const moveAvailable = hasParent || treeMoveAvailable;
    const branchSize = branchIds.length;
    const deleteFolder = () => (
        resolvedType === 'docker'
            ? clearDocker(folderId)
            : clearVm(folderId)
    );

    return [
        {
            title: 'Organize',
            actions: [
                {
                    id: 'move',
                    label: 'Move folder...',
                    description: 'Move to root, into another folder, or beside it.',
                    icon: 'fa-sitemap',
                    opensDialog: true,
                    disabledReason: moveAvailable ? '' : 'No other folder or parent location is available.',
                    run: () => openFolderTreeMoveDialog(resolvedType, folderId)
                },
                hasChildren ? {
                    id: branchCollapsed ? 'branchExpand' : 'branchCollapse',
                    label: branchCollapsed ? 'Expand branch' : 'Collapse branch',
                    description: `${branchCollapsed ? 'Show' : 'Hide'} nested folders in this branch.`,
                    icon: branchCollapsed ? 'fa-expand' : 'fa-compress',
                    run: () => setFolderBranchCollapse(resolvedType, folderId, !branchCollapsed)
                } : null,
                hasChildren ? {
                    id: branchPinned ? 'branchUnpin' : 'branchPin',
                    label: branchPinned ? 'Unpin entire branch' : 'Pin entire branch',
                    description: `${branchPinned ? 'Remove' : 'Keep'} ${branchSize} folders ${branchPinned ? 'from' : 'at'} the pinned area.`,
                    icon: 'fa-thumb-tack',
                    run: () => setFolderBranchPinned(resolvedType, folderId, !branchPinned)
                } : null
            ].filter(Boolean)
        },
        {
            title: 'Data',
            actions: [
                {
                    id: 'export',
                    label: isBranch ? 'Export branch...' : 'Export folder...',
                    description: isBranch
                        ? `Download this folder and its ${branchSize - 1} nested folder${branchSize === 2 ? '' : 's'}.`
                        : 'Download this folder configuration.',
                    icon: 'fa-download',
                    run: () => (
                        isBranch
                            ? exportFolderBranch(resolvedType, folderId)
                            : (resolvedType === 'docker' ? downloadDocker(folderId) : downloadVm(folderId))
                    )
                },
                {
                    id: 'import',
                    label: 'Import into this folder...',
                    description: 'Preview an import and place its folders under this one.',
                    icon: 'fa-sign-in',
                    opensDialog: true,
                    run: () => importFolderBranch(resolvedType, folderId)
                }
            ]
        },
        {
            title: '',
            danger: true,
            actions: [
                {
                    id: 'delete',
                    label: 'Delete folder',
                    description: `Remove ${String(folder?.name || folderId)} from FolderView. Members are not deleted.`,
                    icon: 'fa-trash',
                    danger: true,
                    run: deleteFolder
                }
            ]
        }
    ].map((group) => ({
        ...group,
        actions: group.actions.map((action) => ({
            ...action,
            folderName: String(folder?.name || folderId)
        }))
    }));
};

const findFolderActionById = (groups, actionId) => {
    for (const group of groups) {
        const action = group.actions.find((entry) => entry.id === actionId);
        if (action) {
            return action;
        }
    }
    return null;
};

const renderFolderActionButton = (action) => {
    const disabled = String(action.disabledReason || '').trim();
    const classes = [
        'fv-row-quick-action',
        'fv-ui-button',
        action.danger ? 'is-danger' : ''
    ].filter(Boolean).join(' ');
    return `
        <button type="button"
            class="${classes}"
            data-action="${escapeHtml(action.id)}"
            ${disabled ? 'disabled aria-disabled="true"' : ''}
            title="${escapeHtml(disabled || action.label)}">
            <span class="fv-folder-action-sheet-action-icon"><i class="fa ${escapeHtml(action.icon)}" aria-hidden="true"></i></span>
            <span class="fv-folder-action-sheet-action-copy">
                <strong>${escapeHtml(action.label)}</strong>
                <small>${escapeHtml(disabled || action.description || '')}</small>
            </span>
            ${action.opensDialog ? '<i class="fa fa-angle-right fv-folder-action-sheet-action-chevron" aria-hidden="true"></i>' : ''}
        </button>
    `;
};

const renderFolderActionGroup = (group) => `
    <section class="fv-folder-action-sheet-group${group.danger ? ' is-danger' : ''}">
        ${group.title ? `<h3>${escapeHtml(group.title)}</h3>` : ''}
        <div class="fv-folder-action-sheet-action-list">
            ${group.actions.map(renderFolderActionButton).join('')}
        </div>
    </section>
`;

let folderActionSheetState = null;

const getFolderActionSheetFocusables = (sheet) => Array.from(sheet.querySelectorAll(
    'button:not(:disabled), details > summary, [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
));

const closeFolderActionSheet = ({ restoreFocus = true } = {}) => {
    const state = folderActionSheetState;
    if (!state) {
        return;
    }
    document.removeEventListener('keydown', state.keydownHandler, true);
    state.backdrop.remove();
    document.body.classList.remove('fv-folder-action-sheet-open');
    folderActionSheetState = null;
    if (restoreFocus && state.trigger instanceof HTMLElement && state.trigger.isConnected) {
        state.trigger.focus({ preventScroll: true });
    }
};

const renderFolderActionSheetDetails = ({ resolvedType, folderId, folderMap, hierarchyMeta, summary, pinned }) => {
    const parentId = String(hierarchyMeta.parentById?.[folderId] || '').trim();
    const parentName = parentId ? String(folderMap[parentId]?.name || parentId) : 'Root level';
    const ruleText = summary.rulesCount <= 0 ? '0' : `${summary.activeRulesCount}/${summary.rulesCount} active`;
    const details = [
        ['Parent', parentName],
        ['Members', String(summary.membersCount)],
        ['Rules', ruleText],
        ['Pinned', pinned ? 'Yes' : 'No'],
        ['Last changed', String(summary.lastChanged || 'Unknown')]
    ];
    if (resolvedType === 'docker') {
        details.push(['Updates', String(Number(summary.updatesCount || 0))]);
        details.push(['Health', String(summary.health || 'Unknown')]);
    } else {
        details.push(['Autostart', String(summary.autostart || '0/0')]);
        details.push(['Resources', String(summary.resources || '0 vCPU | 0 GB')]);
    }
    return `
        <details class="fv-folder-action-sheet-details fv-ui-disclosure">
            <summary><span><i class="fa fa-info-circle" aria-hidden="true"></i> Folder details</span><i class="fa fa-angle-down" aria-hidden="true"></i></summary>
            <dl>
                ${details.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}
                <div class="is-id"><dt>Folder ID</dt><dd><code>${escapeHtml(folderId)}</code><button type="button" class="fv-folder-action-sheet-copy" data-copy-folder-id title="Copy folder ID" aria-label="Copy folder ID"><i class="fa fa-clipboard" aria-hidden="true"></i><span>Copy</span></button></dd></div>
            </dl>
        </details>
    `;
};

const showFolderRowQuickActions = (type, folderId, { trigger = null } = {}) => {
    const resolvedType = normalizeManagedType(type);
    const safeId = String(folderId || '').trim();
    const folderMap = getFolderMap(resolvedType);
    const folder = folderMap[safeId];
    if (!folder) {
        return;
    }
    closeFolderActionSheet({ restoreFocus: false });
    const summary = buildFolderQuickActionSummary(resolvedType, safeId);
    const pinned = isFolderPinned(resolvedType, safeId);
    const hierarchyMeta = buildFolderHierarchyMeta(folderMap);
    const hasParent = Boolean(String(hierarchyMeta.parentById?.[safeId] || '').trim());
    const children = Array.isArray(hierarchyMeta.childrenById?.[safeId]) ? hierarchyMeta.childrenById[safeId] : [];
    const hasChildren = children.length > 0;
    const branchIds = getFolderBranchIds(resolvedType, safeId, hierarchyMeta);
    const branchParentIds = branchIds.filter((id) => (hierarchyMeta.childrenById?.[id] || []).length > 0);
    const collapsed = syncCollapsedTreeParentsForType(resolvedType, folderMap, hierarchyMeta);
    const branchCollapsed = branchParentIds.length > 0 && branchParentIds.every((id) => collapsed.has(id));
    const pinnedSet = new Set(Array.isArray(prefsByType[resolvedType]?.pinnedFolderIds) ? prefsByType[resolvedType].pinnedFolderIds.map(String) : []);
    const branchPinned = branchIds.length > 0 && branchIds.every((id) => pinnedSet.has(id));
    const treeMoveAvailable = canFolderUseTreeMove(resolvedType, safeId, hierarchyMeta);
    const safeFolderName = escapeHtml(String(folder.name || safeId));
    const typeLabel = resolvedType === 'docker' ? 'Docker' : 'VM';
    const pathLabel = buildFolderPathLabel(resolvedType, safeId, folderMap, hierarchyMeta);
    const status = summary.countsByState;
    const actionGroups = buildFolderActionRegistry({
        resolvedType,
        folderId: safeId,
        folder,
        branchIds,
        branchCollapsed,
        branchPinned,
        hasChildren,
        hasParent,
        treeMoveAvailable
    });
    const html = `
        <div class="fv-folder-action-sheet-backdrop" id="fv-folder-action-sheet-backdrop">
            <section class="fv-folder-action-sheet" role="dialog" aria-modal="true" aria-labelledby="fv-folder-action-sheet-title">
                <header class="fv-folder-action-sheet-header">
                    <span class="fv-folder-action-sheet-folder-icon"><i class="fa fa-folder" aria-hidden="true"></i></span>
                    <div class="fv-folder-action-sheet-heading">
                        <span class="fv-folder-action-sheet-eyebrow">${escapeHtml(typeLabel)} folder</span>
                        <h2 id="fv-folder-action-sheet-title">${safeFolderName}</h2>
                        <p title="${escapeHtml(pathLabel)}">${escapeHtml(pathLabel)}</p>
                    </div>
                    <button type="button" class="fv-folder-action-sheet-close fv-ui-button fv-ui-icon-button" data-close-folder-actions aria-label="Close folder actions"><i class="fa fa-times" aria-hidden="true"></i></button>
                </header>
                <div class="fv-folder-action-sheet-status" aria-label="Folder status">
                    <span>${summary.membersCount} member${summary.membersCount === 1 ? '' : 's'}</span>
                    <span class="is-started"><i class="fa fa-play" aria-hidden="true"></i>${status.started}</span>
                    ${status.paused > 0 ? `<span class="is-paused"><i class="fa fa-pause" aria-hidden="true"></i>${status.paused}</span>` : ''}
                    <span class="is-stopped"><i class="fa fa-stop" aria-hidden="true"></i>${status.stopped}</span>
                </div>
                <div class="fv-folder-action-sheet-body">
                    ${actionGroups.filter((group) => !group.danger).map(renderFolderActionGroup).join('')}
                    ${renderFolderActionSheetDetails({ resolvedType, folderId: safeId, folderMap, hierarchyMeta, summary, pinned })}
                    ${actionGroups.filter((group) => group.danger).map(renderFolderActionGroup).join('')}
                </div>
                <div class="fv-folder-action-sheet-live" role="status" aria-live="polite"></div>
            </section>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    document.body.classList.add('fv-folder-action-sheet-open');
    const backdrop = document.querySelector('#fv-folder-action-sheet-backdrop');
    const sheet = backdrop?.querySelector('.fv-folder-action-sheet');
    if (!backdrop || !sheet) {
        backdrop?.remove();
        document.body.classList.remove('fv-folder-action-sheet-open');
        return;
    }
    const keydownHandler = (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeFolderActionSheet();
            return;
        }
        if (event.key !== 'Tab') {
            return;
        }
        const focusable = getFolderActionSheetFocusables(sheet);
        if (!focusable.length) {
            event.preventDefault();
            return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };
    folderActionSheetState = {
        backdrop,
        trigger: trigger instanceof HTMLElement ? trigger : null,
        keydownHandler
    };
    document.addEventListener('keydown', keydownHandler, true);
    backdrop.addEventListener('mousedown', (event) => {
        if (event.target === backdrop) {
            closeFolderActionSheet();
        }
    });
    sheet.querySelector('[data-close-folder-actions]')?.addEventListener('click', () => closeFolderActionSheet());
    sheet.querySelector('[data-copy-folder-id]')?.addEventListener('click', async (event) => {
        const button = event.currentTarget;
        const label = button.querySelector('span');
        try {
            await copyTextToClipboard(safeId);
            if (label) {
                label.textContent = 'Copied';
            }
            window.setTimeout(() => {
                if (label?.isConnected) {
                    label.textContent = 'Copy';
                }
            }, 1400);
        } catch (error) {
            showError('Copy failed', error);
        }
    });
    sheet.querySelectorAll('.fv-row-quick-action').forEach((button) => {
        button.addEventListener('click', async (event) => {
            event.preventDefault();
            const action = findFolderActionById(actionGroups, button.dataset.action || '');
            if (!action || action.disabledReason) {
                return;
            }
            closeFolderActionSheet({ restoreFocus: false });
            try {
                await Promise.resolve(action.run());
            } catch (error) {
                showError('Action failed', error);
            }
        });
    });
    window.setTimeout(() => sheet.querySelector('[data-close-folder-actions]')?.focus({ preventScroll: true }), 0);
};

const openFolderRowQuickActions = (type, folderId, event = null) => {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }
    if (event && typeof event.stopPropagation === 'function') {
        event.stopPropagation();
    }
    showFolderRowQuickActions(type, folderId, {
        trigger: event?.currentTarget instanceof HTMLElement ? event.currentTarget : null
    });
};

const clearRowLongPressState = (type) => {
    const resolvedType = normalizeManagedType(type);
    const state = rowLongPressByType[resolvedType];
    if (state?.timer) {
        window.clearTimeout(state.timer);
    }
    if (state?.row && state.row.classList) {
        state.row.classList.remove('is-long-press-active');
    }
    rowLongPressByType[resolvedType] = null;
};

const bindRowTouchQuickActions = (type) => {
    const resolvedType = normalizeManagedType(type);
    const tbodySelector = `tbody#${tableIdByType[resolvedType]}`;
    const namespace = `.fvrowtouch${resolvedType}`;
    const overflowSelector = `${tbodySelector} .folder-overflow-btn`;

    $(document).off(`touchstart${namespace}`, `${tbodySelector} tr[data-folder-id]`);
    $(document).off(`touchmove${namespace}`, `${tbodySelector} tr[data-folder-id]`);
    $(document).off(`touchend${namespace}`, `${tbodySelector} tr[data-folder-id]`);
    $(document).off(`touchcancel${namespace}`, `${tbodySelector} tr[data-folder-id]`);
    $(document).off(`contextmenu${namespace}`, `${tbodySelector} tr[data-folder-id]`);
    $(document).off(`mouseenter${namespace}`, `${tbodySelector} tr[data-folder-id]`);
    $(document).off(`focusin${namespace}`, `${tbodySelector} tr[data-folder-id]`);
    $(document).off(`click${namespace}`, overflowSelector);
    $(document).off(`touchend${namespace}`, overflowSelector);

    $(document).on(`touchstart${namespace}`, `${tbodySelector} tr[data-folder-id]`, (event) => {
        if (!supportsTouchInput()) {
            return;
        }
        const target = event.target instanceof Element ? event.target : null;
        if (target && target.closest('button, a, input, select, textarea, label')) {
            return;
        }
        const row = event.currentTarget;
        const folderId = String($(row).attr('data-folder-id') || '').trim();
        if (!folderId) {
            return;
        }
        clearRowLongPressState(resolvedType);
        row.classList.add('is-long-press-active');
        const timer = window.setTimeout(() => {
            showFolderRowQuickActions(resolvedType, folderId);
            clearRowLongPressState(resolvedType);
        }, LONG_PRESS_DELAY_MS);
        rowLongPressByType[resolvedType] = {
            timer,
            row
        };
    });

    $(document).on(`touchmove${namespace}`, `${tbodySelector} tr[data-folder-id]`, () => {
        clearRowLongPressState(resolvedType);
    });
    $(document).on(`touchend${namespace}`, `${tbodySelector} tr[data-folder-id]`, () => {
        clearRowLongPressState(resolvedType);
    });
    $(document).on(`touchcancel${namespace}`, `${tbodySelector} tr[data-folder-id]`, () => {
        clearRowLongPressState(resolvedType);
    });
    $(document).on(`contextmenu${namespace}`, `${tbodySelector} tr[data-folder-id]`, (event) => {
        if (event.target instanceof Element && event.target.closest('button, a, input, select, textarea, label')) {
            return;
        }
        event.preventDefault();
        const folderId = String($(event.currentTarget).attr('data-folder-id') || '').trim();
        if (!folderId) {
            return;
        }
        showFolderRowQuickActions(resolvedType, folderId, { trigger: event.currentTarget });
    });
    $(document).on(`mouseenter${namespace}`, `${tbodySelector} tr[data-folder-id]`, (event) => {
        const folderId = String($(event.currentTarget).attr('data-folder-id') || '').trim();
        if (!folderId) {
            return;
        }
        updateMobileTreePathHint(resolvedType, folderId);
    });
    $(document).on(`focusin${namespace}`, `${tbodySelector} tr[data-folder-id]`, (event) => {
        const folderId = String($(event.currentTarget).attr('data-folder-id') || '').trim();
        if (!folderId) {
            return;
        }
        updateMobileTreePathHint(resolvedType, folderId);
    });

    $(document).on(`click${namespace}`, overflowSelector, (event) => {
        event.preventDefault();
        event.stopPropagation();
        const row = $(event.currentTarget).closest('tr[data-folder-id]');
        const folderId = String(row.attr('data-folder-id') || '').trim();
        if (!folderId) {
            return;
        }
        clearRowLongPressState(resolvedType);
        showFolderRowQuickActions(resolvedType, folderId, { trigger: event.currentTarget });
    });

    $(document).on(`touchend${namespace}`, overflowSelector, (event) => {
        event.preventDefault();
        event.stopPropagation();
        const row = $(event.currentTarget).closest('tr[data-folder-id]');
        const folderId = String(row.attr('data-folder-id') || '').trim();
        if (!folderId) {
            return;
        }
        clearRowLongPressState(resolvedType);
        showFolderRowQuickActions(resolvedType, folderId, { trigger: event.currentTarget });
    });
};

const copyTextToClipboard = async (text) => {
    const value = String(text || '');
    if (!value) {
        throw new Error('Nothing to copy.');
    }

    if (navigator?.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(value);
        return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', 'readonly');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    let copied = false;
    try {
        copied = document.execCommand('copy');
    } finally {
        document.body.removeChild(textarea);
    }
    if (!copied) {
        throw new Error('Clipboard access is unavailable in this browser context.');
    }
};

const saveFolderRecord = async (type, folderId, folderPayload) => {
    const resolvedType = normalizeManagedType(type);
    const safeFolderId = String(folderId || '').trim();
    if (!safeFolderId) {
        throw new Error('Missing folder ID.');
    }
    const payload = folderPayload && typeof folderPayload === 'object' ? folderPayload : {};
    await apiPostText('/plugins/folderview.plus/server/update.php', {
        type: resolvedType,
        id: safeFolderId,
        content: JSON.stringify(payload)
    });
};

const ensureFolderSortModeManual = async (type) => {
    const resolvedType = normalizeManagedType(type);
    let sortMode = prefsByType[resolvedType]?.sortMode || 'created';
    if (sortMode !== 'manual') {
        await changeSortMode(resolvedType, 'manual');
        sortMode = prefsByType[resolvedType]?.sortMode || 'created';
    }
    return sortMode === 'manual';
};

const buildTreeMoveTargetOptions = (type, sourceFolderId, hierarchyMeta = null) => {
    const resolvedType = normalizeManagedType(type);
    const folders = getFolderMap(resolvedType);
    const sourceId = String(sourceFolderId || '').trim();
    const meta = hierarchyMeta || buildFolderHierarchyMeta(folders);
    const blocked = new Set([sourceId, ...(meta.descendantsById[sourceId] || [])]);
    const orderedIds = getOrderedFolderIdsForTreeOps(resolvedType);
    const options = [];
    for (const id of orderedIds) {
        if (!Object.prototype.hasOwnProperty.call(folders, id) || blocked.has(id)) {
            continue;
        }
        const folderName = String(folders[id]?.name || id);
        const depth = Math.max(0, Number(meta.depthById[id] || 0));
        const indent = depth > 0 ? '&nbsp;'.repeat(Math.min(10, depth) * 3) : '';
        const prefix = depth > 0 ? '&#8627;&nbsp;' : '';
        options.push(`<option value="${escapeHtml(id)}">${indent}${prefix}${escapeHtml(folderName)}</option>`);
    }
    return options.join('');
};

const applyFolderTreeMove = async (type, sourceFolderId, targetFolderId, placement) => {
    const resolvedType = normalizeManagedType(type);
    const sourceId = String(sourceFolderId || '').trim();
    const targetId = String(targetFolderId || '').trim();
    const mode = normalizeTreeMovePlacement(placement);
    if (!sourceId) {
        return;
    }
    const folders = getFolderMap(resolvedType);
    const sourceFolder = folders[sourceId];
    if (!sourceFolder) {
        setFolderTreeMoveError(resolvedType, sourceId, 'Folder no longer exists.');
        return;
    }
    const hierarchyMeta = buildFolderHierarchyMeta(folders);
    const descendants = hierarchyMeta.descendantsById[sourceId] || [];
    const parentById = hierarchyMeta.parentById || {};
    const existingParentId = String(parentById[sourceId] || '').trim();
    const allowedModes = mode === 'inside' ? ['inside'] : ['before', 'after', 'inside'];
    if (!allowedModes.includes(mode)) {
        setFolderTreeMoveError(resolvedType, sourceId, 'Invalid tree move mode.');
        return;
    }
    if (!targetId) {
        setFolderTreeMoveError(resolvedType, sourceId, 'Choose a target folder.');
        return;
    }
    if (!Object.prototype.hasOwnProperty.call(folders, targetId)) {
        setFolderTreeMoveError(resolvedType, sourceId, 'Target folder no longer exists.');
        return;
    }
    if (targetId === sourceId) {
        setFolderTreeMoveError(resolvedType, sourceId, 'A folder cannot be moved onto itself.');
        return;
    }
    if (descendants.includes(targetId)) {
        setFolderTreeMoveError(resolvedType, sourceId, 'Cannot move a folder into one of its own children.');
        return;
    }

    let nextParentId = '';
    if (mode === 'inside') {
        nextParentId = targetId;
    } else {
        nextParentId = String(parentById[targetId] || '').trim();
    }
    if (nextParentId === sourceId || descendants.includes(nextParentId)) {
        setFolderTreeMoveError(resolvedType, sourceId, 'This move would create a parent cycle.');
        return;
    }

    const fullOrder = getOrderedFolderIdsForTreeOps(resolvedType);
    const orderWithoutSource = fullOrder.filter((id) => id !== sourceId);
    let insertIndex;
    if (mode === 'before') {
        const targetIndex = orderWithoutSource.indexOf(targetId);
        insertIndex = targetIndex >= 0 ? targetIndex : orderWithoutSource.length;
    } else if (mode === 'after') {
        const targetSubtree = [targetId, ...(hierarchyMeta.descendantsById[targetId] || [])];
        const anchorIndex = findLastMatchingOrderIndex(orderWithoutSource, targetSubtree);
        insertIndex = anchorIndex >= 0 ? (anchorIndex + 1) : orderWithoutSource.length;
    } else {
        const parentSubtree = [targetId, ...(hierarchyMeta.descendantsById[targetId] || [])];
        const anchorIndex = findLastMatchingOrderIndex(orderWithoutSource, parentSubtree);
        insertIndex = anchorIndex >= 0 ? (anchorIndex + 1) : orderWithoutSource.length;
    }

    const nextOrder = orderWithoutSource.slice();
    nextOrder.splice(Math.max(0, Math.min(insertIndex, nextOrder.length)), 0, sourceId);
    const parentChanged = nextParentId !== existingParentId;
    const orderChanged = nextOrder.some((id, index) => id !== fullOrder[index]);
    if (!parentChanged && !orderChanged) {
        setFolderTreeMoveError(resolvedType, sourceId, 'Folder is already in that position.');
        return;
    }

    let backup = null;
    try {
        const manualReady = await ensureFolderSortModeManual(resolvedType);
        if (!manualReady) {
            throw new Error('Manual sort mode is required for tree move.');
        }
        clearFolderTreeMoveError(resolvedType, sourceId, { rerender: false });
        backup = await createBackup(resolvedType, `before-tree-move-${sourceId}`);
        if (parentChanged) {
            const nextFolder = {
                ...sourceFolder,
                parentId: nextParentId
            };
            await saveFolderRecord(resolvedType, sourceId, nextFolder);
        }
        if (orderChanged) {
            await persistManualOrder(resolvedType, nextOrder, { refresh: false });
        }
        await refreshType(resolvedType);
        if (backup?.name) {
            await recordTreeMoveHistoryFromBackup(resolvedType, backup.name, 'Tree move', sourceId);
        }
        focusFolderRow(resolvedType, sourceId);
        const destinationText = mode === 'inside'
            ? `inside ${folders[targetId]?.name || targetId}`
            : (mode === 'before'
                ? `before ${folders[targetId]?.name || targetId}`
                : `after ${folders[targetId]?.name || targetId}`);
        addActivityEntry(`Tree move complete: ${(sourceFolder?.name || sourceId)} -> ${destinationText}.`, 'success');
    } catch (error) {
        await refreshType(resolvedType);
        setFolderTreeMoveError(resolvedType, sourceId, error?.message || 'Tree move failed.');
        showError('Tree move failed', error);
    }
};

const openFolderTreeMoveDialog = (type, folderId, options = {}) => {
    const resolvedType = normalizeManagedType(type);
    const sourceId = String(folderId || '').trim();
    if (!sourceId) {
        return;
    }
    const folders = getFolderMap(resolvedType);
    const folder = folders[sourceId];
    if (!folder) {
        return;
    }
    const hierarchyMeta = buildFolderHierarchyMeta(folders);
    const hasParent = Boolean(String(hierarchyMeta.parentById?.[sourceId] || '').trim());
    const targetOptions = buildTreeMoveTargetOptions(resolvedType, sourceId, hierarchyMeta);
    const modeInsideOnly = options?.modeInsideOnly === true;
    if ((!targetOptions && !hasParent) || (modeInsideOnly && !targetOptions)) {
        setFolderTreeMoveError(resolvedType, sourceId, 'No valid folder locations are available.');
        return;
    }
    const preferredPlacement = modeInsideOnly
        ? 'inside'
        : normalizeTreeMovePlacement(options?.placement || 'inside');
    const placementSelectHtml = modeInsideOnly
        ? '<input type="hidden" id="fv-tree-move-placement" value="inside">'
        : `<div id="fv-tree-move-placement-field">
             <label class="fv-tree-move-field-label" for="fv-tree-move-placement">Placement</label>
             <select id="fv-tree-move-placement">
               <option value="inside"${preferredPlacement === 'inside' ? ' selected' : ''}>Inside target</option>
               <option value="before"${preferredPlacement === 'before' ? ' selected' : ''}>Before target</option>
               <option value="after"${preferredPlacement === 'after' ? ' selected' : ''}>After target</option>
             </select>
           </div>`;
    const sourceName = escapeHtml(String(folder.name || sourceId));
    const targetLabel = modeInsideOnly ? 'Move under folder' : 'Destination';
    const rootOption = (!modeInsideOnly && hasParent)
        ? '<option value="__root__">Root level</option>'
        : '';
    swal({
        title: modeInsideOnly ? 'Move under...' : 'Move folder',
        text: `
            <div class="fv-tree-move-dialog">
                <div class="fv-tree-move-source">Source: <strong>${sourceName}</strong></div>
                <label class="fv-tree-move-field-label" for="fv-tree-move-target">${targetLabel}</label>
                <select id="fv-tree-move-target">${rootOption}${targetOptions}</select>
                ${placementSelectHtml}
            </div>
        `,
        html: true,
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: modeInsideOnly ? 'Move under folder' : 'Move folder',
        cancelButtonText: 'Cancel',
        closeOnConfirm: true
    }, (confirmed) => {
        if (!confirmed) {
            return;
        }
        const targetId = String($('#fv-tree-move-target').val() || '').trim();
        if (!modeInsideOnly && targetId === '__root__') {
            void moveFolderToRootQuick(resolvedType, sourceId);
            return;
        }
        const placement = modeInsideOnly
            ? 'inside'
            : normalizeTreeMovePlacement($('#fv-tree-move-placement').val() || preferredPlacement);
        void applyFolderTreeMove(resolvedType, sourceId, targetId, placement);
    });
    if (!modeInsideOnly) {
        window.setTimeout(() => {
            const target = document.querySelector('#fv-tree-move-target');
            const placementField = document.querySelector('#fv-tree-move-placement-field');
            if (!(target instanceof HTMLSelectElement) || !(placementField instanceof HTMLElement)) {
                return;
            }
            const syncPlacementVisibility = () => {
                placementField.hidden = target.value === '__root__';
            };
            target.addEventListener('change', syncPlacementVisibility);
            syncPlacementVisibility();
        }, 0);
    }
};

const moveFolderToRootQuick = async (type, folderId) => {
    const resolvedType = normalizeManagedType(type);
    const sourceId = String(folderId || '').trim();
    if (!sourceId) {
        return;
    }
    const folders = getFolderMap(resolvedType);
    const sourceFolder = folders[sourceId];
    if (!sourceFolder) {
        return;
    }
    const hierarchyMeta = buildFolderHierarchyMeta(folders);
    const currentParentId = String(hierarchyMeta.parentById[sourceId] || '').trim();
    if (!currentParentId) {
        setFolderTreeMoveError(resolvedType, sourceId, 'Folder is already at root level.');
        return;
    }
    let backup = null;
    try {
        const manualReady = await ensureFolderSortModeManual(resolvedType);
        if (!manualReady) {
            throw new Error('Manual sort mode is required for root move.');
        }
        clearFolderTreeMoveError(resolvedType, sourceId, { rerender: false });
        backup = await createBackup(resolvedType, `before-root-move-${sourceId}`);
        await saveFolderRecord(resolvedType, sourceId, {
            ...sourceFolder,
            parentId: ''
        });
        await refreshType(resolvedType);
        if (backup?.name) {
            await recordTreeMoveHistoryFromBackup(resolvedType, backup.name, 'Move to root', sourceId);
        }
        focusFolderRow(resolvedType, sourceId);
        addActivityEntry(`Folder moved to root: ${sourceFolder.name || sourceId}.`, 'success');
    } catch (error) {
        await refreshType(resolvedType);
        setFolderTreeMoveError(resolvedType, sourceId, error?.message || 'Move to root failed.');
        showError('Move to root failed', error);
    }
};

Object.assign(window, {
    buildFolderQuickActionSummary,
    closeFolderActionSheet,
    showFolderRowQuickActions,
    openFolderRowQuickActions,
    clearRowLongPressState,
    bindRowTouchQuickActions,
    copyTextToClipboard,
    saveFolderRecord,
    ensureFolderSortModeManual,
    buildTreeMoveTargetOptions,
    applyFolderTreeMove,
    openFolderTreeMoveDialog,
    moveFolderToRootQuick
});

window.FolderViewPlusFolderEditor = Object.freeze({
    buildFolderQuickActionSummary,
    showFolderRowQuickActions,
    openFolderRowQuickActions,
    bindRowTouchQuickActions,
    copyTextToClipboard,
    saveFolderRecord,
    openFolderTreeMoveDialog,
    moveFolderToRootQuick
});
window.FolderViewPlusFolderEditorModuleLoaded = true;
