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

const renderFolderQuickActionSummaryHtml = (summary) => {
    if (!summary) {
        return '';
    }
    const statusText = `${summary.countsByState.started} started | ${summary.countsByState.paused} paused | ${summary.countsByState.stopped} stopped`;
    const rows = [
        { label: 'Members', value: String(summary.membersCount) },
        { label: 'Status', value: statusText },
        {
            label: 'Rules',
            value: summary.rulesCount <= 0
                ? '0'
                : `${summary.activeRulesCount}/${summary.rulesCount} active`
        },
        { label: 'Last changed', value: String(summary.lastChanged || 'Unknown') },
        { label: 'Pinned', value: summary.pinned ? 'Yes' : 'No' }
    ];
    if (summary.type === 'docker') {
        rows.push({ label: 'Updates', value: `${Number(summary.updatesCount || 0)}` });
        rows.push({ label: 'Health', value: String(summary.health || 'Unknown') });
    } else {
        rows.push({ label: 'Autostart', value: String(summary.autostart || '0/0') });
        const resourceSeverity = String(summary.resourceSeverity || 'good');
        const resourceLabel = resourceSeverity === 'critical'
            ? 'Resources (critical)'
            : (resourceSeverity === 'warn' ? 'Resources (warn)' : 'Resources');
        rows.push({ label: resourceLabel, value: String(summary.resources || '0 vCPU | 0 GB') });
    }
    return `
        <div class="fv-row-quick-actions-summary">
            ${rows.map((row) => `
                <div class="fv-row-quick-actions-summary-row">
                    <span>${escapeHtml(row.label)}</span>
                    <strong>${escapeHtml(row.value)}</strong>
                </div>
            `).join('')}
        </div>
    `;
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
    pinned,
    hasParent,
    treeMoveAvailable
}) => {
    const typeLabel = resolvedType === 'docker' ? 'Docker' : 'VM';
    const treeDisabled = treeMoveAvailable
        ? ''
        : 'No valid target folders are available for this move.';
    const canEdit = typeof openSettingsFolderEditor === 'function';
    const exportFolder = () => (
        resolvedType === 'docker'
            ? downloadDocker(folderId)
            : downloadVm(folderId)
    );
    const deleteFolder = () => (
        resolvedType === 'docker'
            ? clearDocker(folderId)
            : clearVm(folderId)
    );

    return [
        {
            title: 'Quick actions',
            description: 'Common actions for this folder.',
            actions: [
                {
                    id: 'edit',
                    label: 'Edit folder',
                    icon: 'fa-pencil',
                    primary: true,
                    closeBeforeRun: true,
                    disabledReason: canEdit ? '' : 'Folder editor launcher is unavailable on this page.',
                    run: () => openSettingsFolderEditor(resolvedType, folderId)
                },
                {
                    id: 'pin',
                    label: pinned ? 'Unpin from top' : 'Pin to top',
                    icon: pinned ? 'fa-star-o' : 'fa-star',
                    run: () => toggleFolderPin(resolvedType, folderId)
                },
                {
                    id: 'up',
                    label: 'Move up',
                    icon: 'fa-chevron-up',
                    run: () => moveFolderRow(resolvedType, folderId, -1)
                },
                {
                    id: 'down',
                    label: 'Move down',
                    icon: 'fa-chevron-down',
                    run: () => moveFolderRow(resolvedType, folderId, 1)
                },
                {
                    id: 'branchCollapse',
                    label: 'Collapse branch',
                    icon: 'fa-compress',
                    run: () => setFolderBranchCollapse(resolvedType, folderId, true)
                },
                {
                    id: 'branchExpand',
                    label: 'Expand branch',
                    icon: 'fa-expand',
                    run: () => setFolderBranchCollapse(resolvedType, folderId, false)
                }
            ]
        },
        {
            title: 'Move and hierarchy',
            description: 'Change where this folder sits in the tree.',
            actions: [
                {
                    id: 'root',
                    label: 'Move to root',
                    icon: 'fa-level-up',
                    disabledReason: hasParent ? '' : 'This folder is already at the top level.',
                    run: () => moveFolderToRootQuick(resolvedType, folderId)
                },
                {
                    id: 'under',
                    label: 'Move under...',
                    icon: 'fa-level-down',
                    closeBeforeRun: true,
                    disabledReason: treeDisabled,
                    run: () => moveFolderUnderDialog(resolvedType, folderId)
                },
                {
                    id: 'tree',
                    label: 'Tree move...',
                    icon: 'fa-sitemap',
                    closeBeforeRun: true,
                    disabledReason: treeDisabled,
                    run: () => openFolderTreeMoveDialog(resolvedType, folderId)
                },
                {
                    id: 'branchPin',
                    label: 'Pin branch',
                    icon: 'fa-thumb-tack',
                    run: () => setFolderBranchPinned(resolvedType, folderId, true)
                },
                {
                    id: 'branchUnpin',
                    label: 'Unpin branch',
                    icon: 'fa-thumb-tack',
                    run: () => setFolderBranchPinned(resolvedType, folderId, false)
                }
            ]
        },
        {
            title: 'Branch tools',
            description: 'Export, import, and validate this folder branch.',
            actions: [
                {
                    id: 'branchExport',
                    label: 'Export branch',
                    icon: 'fa-sign-out',
                    closeBeforeRun: true,
                    run: () => exportFolderBranch(resolvedType, folderId)
                },
                {
                    id: 'branchImport',
                    label: 'Import branch here',
                    icon: 'fa-sign-in',
                    closeBeforeRun: true,
                    run: () => importFolderBranch(resolvedType, folderId)
                },
                {
                    id: 'treeScan',
                    label: 'Scan tree integrity',
                    icon: 'fa-stethoscope',
                    closeBeforeRun: true,
                    run: () => runTreeIntegrityCheck(resolvedType)
                },
                {
                    id: 'treeRepair',
                    label: 'Repair tree integrity',
                    icon: 'fa-wrench',
                    closeBeforeRun: true,
                    run: () => runTreeIntegrityCheck(resolvedType, { repair: true })
                }
            ]
        },
        {
            title: 'Info and diagnostics',
            description: `Inspect or copy details for this ${typeLabel} folder.`,
            actions: [
                {
                    id: 'status',
                    label: 'Status breakdown',
                    icon: 'fa-info-circle',
                    closeBeforeRun: true,
                    run: () => showFolderStatusBreakdown(resolvedType, folderId)
                },
                {
                    id: 'copy',
                    label: 'Copy ID',
                    icon: 'fa-clipboard',
                    run: () => copyFolderId(resolvedType, folderId)
                },
                {
                    id: 'export',
                    label: 'Export folder',
                    icon: 'fa-download',
                    closeBeforeRun: true,
                    run: exportFolder
                }
            ]
        },
        {
            title: 'Danger zone',
            description: 'Permanent or disruptive actions.',
            danger: true,
            actions: [
                {
                    id: 'delete',
                    label: 'Delete folder',
                    icon: 'fa-trash',
                    danger: true,
                    closeBeforeRun: true,
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
        action.primary ? 'is-primary' : '',
        action.danger ? 'is-danger' : ''
    ].filter(Boolean).join(' ');
    return `
        <button type="button"
            class="${classes}"
            data-action="${escapeHtml(action.id)}"
            ${disabled ? 'disabled aria-disabled="true"' : ''}
            title="${escapeHtml(disabled || action.label)}">
            <i class="fa ${escapeHtml(action.icon)}"></i>
            <span>${escapeHtml(action.label)}</span>
            ${disabled ? `<small>${escapeHtml(disabled)}</small>` : ''}
        </button>
    `;
};

const renderFolderActionGroup = (group) => `
    <section class="fv-row-quick-action-group${group.danger ? ' is-danger' : ''}">
        <div class="fv-row-quick-action-group-head">
            <strong>${escapeHtml(group.title)}</strong>
            <span>${escapeHtml(group.description || '')}</span>
        </div>
        <div class="fv-row-quick-actions-grid">
            ${group.actions.map(renderFolderActionButton).join('')}
        </div>
    </section>
`;

const setFolderActionModalStatus = (text = '', tone = 'info') => {
    const host = document.querySelector('#fv-row-quick-action-status');
    if (!host) {
        return;
    }
    const message = String(text || '').trim();
    host.textContent = message;
    host.className = `fv-row-quick-action-status ${message ? 'is-visible' : ''} is-${String(tone || 'info').trim() || 'info'}`;
};

const setFolderActionModalBusy = (button, busy = true) => {
    if (!(button instanceof HTMLButtonElement)) {
        return;
    }
    button.classList.toggle('is-running', busy);
    button.disabled = busy || button.getAttribute('aria-disabled') === 'true';
    const label = button.querySelector('span');
    if (!label) {
        return;
    }
    if (busy) {
        button.setAttribute('data-original-label', label.textContent || '');
        label.textContent = 'Running...';
        return;
    }
    const original = String(button.getAttribute('data-original-label') || '').trim();
    if (original) {
        label.textContent = original;
    }
    button.removeAttribute('data-original-label');
};

const closeVmRowDetailsDrawer = () => {
    const current = rowDetailsDrawerByType.vm;
    if (!current) {
        return;
    }
    const tbodyId = tableIdByType.vm;
    const tbody = $(`tbody#${tbodyId}`);
    tbody.find('tr.fv-row-details-drawer').remove();
    tbody.find('tr.is-details-open').removeClass('is-details-open');
    rowDetailsDrawerByType.vm = null;
};

const runVmRowDrawerAction = async (action, folderId) => {
    const id = String(folderId || '').trim();
    if (!id) {
        return;
    }
    const handlers = {
        up: () => moveFolderRow('vm', id, -1),
        down: () => moveFolderRow('vm', id, 1),
        pin: () => toggleFolderPin('vm', id),
        root: () => moveFolderToRootQuick('vm', id),
        under: () => moveFolderUnderDialog('vm', id),
        tree: () => openFolderTreeMoveDialog('vm', id),
        branchCollapse: () => setFolderBranchCollapse('vm', id, true),
        branchExpand: () => setFolderBranchCollapse('vm', id, false),
        branchPin: () => setFolderBranchPinned('vm', id, true),
        branchUnpin: () => setFolderBranchPinned('vm', id, false),
        branchExport: () => exportFolderBranch('vm', id),
        branchImport: () => importFolderBranch('vm', id),
        treeScan: () => runTreeIntegrityCheck('vm'),
        treeRepair: () => runTreeIntegrityCheck('vm', { repair: true }),
        status: () => {
            showFolderStatusBreakdown('vm', id);
            return Promise.resolve();
        },
        copy: () => copyFolderId('vm', id),
        export: () => downloadVm(id),
        delete: () => clearVm(id)
    };
    if (Object.prototype.hasOwnProperty.call(handlers, action)) {
        await handlers[action]();
    }
};

const buildVmRowDetailsDrawerHtml = (folderId, folder, summary, pinned) => {
    const safeFolderName = escapeHtml(String(folder?.name || folderId || 'VM folder'));
    const safeFolderId = escapeHtml(String(folderId || ''));
    const hierarchyMeta = buildFolderHierarchyMeta(getFolderMap('vm'));
    const hasParent = Boolean(String(hierarchyMeta.parentById?.[String(folderId || '')] || '').trim());
    const treeMoveAvailable = canFolderUseTreeMove('vm', folderId, hierarchyMeta);
    const resourceTitle = escapeHtml(String(summary?.resourceThresholds || ''));
    const chips = summary?.resourceChips && typeof summary.resourceChips === 'object'
        ? summary.resourceChips
        : null;
    const cpuChip = chips?.cpu || { text: '0 vCPU', className: 'is-empty', title: 'CPU total: 0 vCPU' };
    const memoryChip = chips?.memory || { text: '0 GB RAM', className: 'is-empty', title: 'Memory total: 0 GB' };
    const storageChip = chips?.storage || { text: '0 B Storage', className: 'is-empty', title: 'Storage total: 0 B' };
    const statusText = `${summary?.countsByState?.started || 0} started | ${summary?.countsByState?.paused || 0} paused | ${summary?.countsByState?.stopped || 0} stopped`;
    const detailRows = [
        ['Members', summary?.membersCount || 0],
        ['Status', statusText],
        ['Rules', summary?.rulesCount || 0],
        ['Pinned', pinned ? 'Yes' : 'No'],
        ['Last changed', summary?.lastChanged || 'Unknown'],
        ['Autostart', summary?.autostart || '0/0']
    ].map(([label, value]) => (
        `<div class="fv-row-details-item"><span>${escapeHtml(String(label))}</span><strong>${escapeHtml(String(value))}</strong></div>`
    )).join('');
    const actions = [
        ['up', 'fa-chevron-up', 'Move up', '', true],
        ['down', 'fa-chevron-down', 'Move down', '', true],
        ['pin', pinned ? 'fa-star-o' : 'fa-star', pinned ? 'Unpin' : 'Pin to top', '', true],
        ['root', 'fa-level-up', 'Move to root', '', hasParent],
        ['under', 'fa-level-down', 'Move under...', '', treeMoveAvailable],
        ['tree', 'fa-sitemap', 'Tree move...', '', treeMoveAvailable],
        ['branchCollapse', 'fa-compress', 'Collapse branch', '', true],
        ['branchExpand', 'fa-expand', 'Expand branch', '', true],
        ['branchPin', 'fa-thumb-tack', 'Pin branch', '', true],
        ['branchUnpin', 'fa-thumb-tack', 'Unpin branch', '', true],
        ['branchExport', 'fa-sign-out', 'Export branch', '', true],
        ['branchImport', 'fa-sign-in', 'Import branch here', '', true],
        ['treeScan', 'fa-stethoscope', 'Scan tree integrity', '', true],
        ['treeRepair', 'fa-wrench', 'Repair tree integrity', '', true],
        ['status', 'fa-info-circle', 'Status breakdown', '', true],
        ['copy', 'fa-clipboard', 'Copy ID', '', true],
        ['export', 'fa-download', 'Export', '', true],
        ['delete', 'fa-trash', 'Delete', ' is-danger', true]
    ].filter(([, , , , isVisible]) => isVisible === true).map(([action, icon, label, extraClass]) => (
        `<button type="button" class="fv-row-quick-action${extraClass}" data-fv-vm-drawer-action="${escapeHtml(String(action))}" data-fv-vm-drawer-folder="${safeFolderId}"><i class="fa ${escapeHtml(String(icon))}"></i> ${escapeHtml(String(label))}</button>`
    )).join('');
    return `<div class="fv-row-details-panel"><div class="fv-row-details-head"><div class="fv-row-details-title">${safeFolderName}</div><div class="fv-row-details-meta">ID: <code>${safeFolderId}</code></div></div><div class="fv-row-details-grid">${detailRows}</div><div class="fv-row-details-resource"><span class="vm-resource-stack" title="${resourceTitle}"><span class="folder-metric-chip vm-resource-chip is-cpu ${escapeHtml(String(cpuChip.className || 'is-empty'))}" title="${escapeHtml(String(cpuChip.title || ''))}"><i class="fa fa-microchip" aria-hidden="true"></i><span class="vm-resource-value">${escapeHtml(String(cpuChip.text || '0 vCPU'))}</span></span><span class="folder-metric-chip vm-resource-chip is-ram ${escapeHtml(String(memoryChip.className || 'is-empty'))}" title="${escapeHtml(String(memoryChip.title || ''))}"><i class="fa fa-hdd-o" aria-hidden="true"></i><span class="vm-resource-value">${escapeHtml(String(memoryChip.text || '0 GB RAM'))}</span></span><span class="folder-metric-chip vm-resource-chip is-storage ${escapeHtml(String(storageChip.className || 'is-empty'))}" title="${escapeHtml(String(storageChip.title || ''))}"><i class="fa fa-database" aria-hidden="true"></i><span class="vm-resource-value">${escapeHtml(String(storageChip.text || '0 B Storage'))}</span></span></span></div><div class="fv-row-details-actions">${actions}</div></div>`;
};

const toggleVmRowDetailsDrawer = (folderId) => {
    const id = String(folderId || '').trim();
    if (!id) {
        return;
    }
    const current = rowDetailsDrawerByType.vm;
    if (current && current.folderId === id) {
        closeVmRowDetailsDrawer();
        return;
    }
    const tbodyId = tableIdByType.vm;
    const tbody = $(`tbody#${tbodyId}`);
    const row = tbody.find(`tr[data-folder-id="${id}"]`).first();
    if (!row.length) {
        return;
    }
    const folders = getFolderMap('vm');
    const folder = folders[id];
    if (!folder) {
        return;
    }
    closeVmRowDetailsDrawer();
    const summary = buildFolderQuickActionSummary('vm', id);
    const pinned = isFolderPinned('vm', id);
    const drawerHtml = buildVmRowDetailsDrawerHtml(id, folder, summary, pinned);
    const drawerRow = `<tr class="fv-row-details-drawer" data-folder-id="${escapeHtml(id)}"><td colspan="${SETTINGS_TABLE_COLUMN_COUNT}">${drawerHtml}</td></tr>`;
    row.after(drawerRow);
    row.addClass('is-details-open');
    rowDetailsDrawerByType.vm = { folderId: id };
};

const showFolderRowQuickActions = (type, folderId) => {
    const resolvedType = normalizeManagedType(type);
    if (resolvedType === 'vm') {
        toggleVmRowDetailsDrawer(folderId);
        return;
    }
    const folderMap = getFolderMap(resolvedType);
    const folder = folderMap[folderId];
    if (!folder) {
        return;
    }
    const summary = buildFolderQuickActionSummary(resolvedType, folderId);
    const pinned = isFolderPinned(resolvedType, folderId);
    const hierarchyMeta = buildFolderHierarchyMeta(folderMap);
    const hasParent = Boolean(String(hierarchyMeta.parentById?.[String(folderId || '')] || '').trim());
    const treeMoveAvailable = canFolderUseTreeMove(resolvedType, folderId, hierarchyMeta);
    const safeFolderName = escapeHtml(String(folder.name || folderId));
    const safeFolderId = escapeHtml(String(folderId || ''));
    const typeLabel = resolvedType === 'docker' ? 'Docker' : 'VM';
    const actionGroups = buildFolderActionRegistry({
        resolvedType,
        folderId,
        folder,
        pinned,
        hasParent,
        treeMoveAvailable
    });
    const html = `
        <div class="fv-row-quick-actions">
            <div class="fv-row-quick-actions-header">
                <div>
                    <div class="fv-row-quick-actions-title">${safeFolderName}</div>
                    <div class="fv-row-quick-actions-meta">${typeLabel} folder <span>ID: <code>${safeFolderId}</code></span></div>
                </div>
                <button type="button" class="fv-row-quick-copy-id" data-action="copy" title="Copy folder ID"><i class="fa fa-clipboard"></i></button>
            </div>
            ${renderFolderQuickActionSummaryHtml(summary)}
            <div id="fv-row-quick-action-status" class="fv-row-quick-action-status" role="status" aria-live="polite"></div>
            ${actionGroups.map(renderFolderActionGroup).join('')}
        </div>
    `;
    $('.sweet-alert').removeClass('fv-row-quick-actions-modal');
    swal({
        title: '',
        text: html,
        html: true,
        customClass: 'fv-row-quick-actions-modal',
        confirmButtonText: 'Close'
    });
    window.setTimeout(() => {
        $('.sweet-alert:visible').addClass('fv-row-quick-actions-modal');
        $('.fv-row-quick-action, .fv-row-quick-copy-id').off('click.fvrowquick').on('click.fvrowquick', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            const button = event.currentTarget;
            const actionId = String($(button).attr('data-action') || '');
            const action = findFolderActionById(actionGroups, actionId);
            if (!action || action.disabledReason) {
                return;
            }
            if (action.closeBeforeRun) {
                swal.close();
                try {
                    await Promise.resolve(action.run());
                } catch (error) {
                    showError('Action failed', error);
                }
                return;
            }
            setFolderActionModalBusy(button, true);
            setFolderActionModalStatus(`${action.label} is running...`, 'info');
            try {
                await Promise.resolve(action.run());
                setFolderActionModalStatus(`${action.label} complete.`, 'success');
            } catch (error) {
                setFolderActionModalStatus(error?.message || 'Action failed.', 'error');
                showError('Action failed', error);
            } finally {
                setFolderActionModalBusy(button, false);
            }
        });
    }, 0);
};

const openFolderRowQuickActions = (type, folderId, event = null) => {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }
    if (event && typeof event.stopPropagation === 'function') {
        event.stopPropagation();
    }
    showFolderRowQuickActions(type, folderId);
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
    const vmDrawerActionSelector = `${tbodySelector} [data-fv-vm-drawer-action]`;

    $(document).off(`touchstart${namespace}`, `${tbodySelector} tr[data-folder-id]`);
    $(document).off(`touchmove${namespace}`, `${tbodySelector} tr[data-folder-id]`);
    $(document).off(`touchend${namespace}`, `${tbodySelector} tr[data-folder-id]`);
    $(document).off(`touchcancel${namespace}`, `${tbodySelector} tr[data-folder-id]`);
    $(document).off(`contextmenu${namespace}`, `${tbodySelector} tr[data-folder-id]`);
    $(document).off(`mouseenter${namespace}`, `${tbodySelector} tr[data-folder-id]`);
    $(document).off(`focusin${namespace}`, `${tbodySelector} tr[data-folder-id]`);
    $(document).off(`click${namespace}`, overflowSelector);
    $(document).off(`touchend${namespace}`, overflowSelector);
    $(document).off(`click${namespace}`, vmDrawerActionSelector);

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
        showFolderRowQuickActions(resolvedType, folderId);
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
        showFolderRowQuickActions(resolvedType, folderId);
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
        showFolderRowQuickActions(resolvedType, folderId);
    });

    $(document).on(`click${namespace}`, vmDrawerActionSelector, (event) => {
        event.preventDefault();
        event.stopPropagation();
        const button = $(event.currentTarget);
        const action = String(button.attr('data-fv-vm-drawer-action') || '').trim();
        const folderId = String(button.attr('data-fv-vm-drawer-folder') || '').trim();
        if (!action || !folderId) {
            return;
        }
        closeVmRowDetailsDrawer();
        Promise.resolve(runVmRowDrawerAction(action, folderId)).catch((error) => {
            showError('Action failed', error);
        });
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

const copyFolderId = async (type, folderId) => {
    const resolvedType = normalizeManagedType(type);
    const resolvedId = String(folderId || '').trim();
    if (!resolvedId) {
        return;
    }
    try {
        await copyTextToClipboard(resolvedId);
        swal({
            title: 'Copied',
            text: `${resolvedType === 'docker' ? 'Docker' : 'VM'} folder ID copied:\n${resolvedId}`,
            type: 'success',
            timer: 1400,
            showConfirmButton: false
        });
    } catch (error) {
        showError('Copy failed', error);
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
    let insertIndex = orderWithoutSource.length;
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
    if (!canFolderUseTreeMove(resolvedType, sourceId, hierarchyMeta)) {
        setFolderTreeMoveError(resolvedType, sourceId, 'No valid target folders available.');
        return;
    }
    const targetOptions = buildTreeMoveTargetOptions(resolvedType, sourceId, hierarchyMeta);
    if (!targetOptions) {
        setFolderTreeMoveError(resolvedType, sourceId, 'No valid target folders available.');
        return;
    }
    const modeInsideOnly = options?.modeInsideOnly === true;
    const preferredPlacement = modeInsideOnly
        ? 'inside'
        : normalizeTreeMovePlacement(options?.placement || 'inside');
    const placementSelectHtml = modeInsideOnly
        ? '<input type="hidden" id="fv-tree-move-placement" value="inside">'
        : `<label class="fv-tree-move-field-label" for="fv-tree-move-placement">Placement</label>
           <select id="fv-tree-move-placement">
             <option value="inside"${preferredPlacement === 'inside' ? ' selected' : ''}>Inside target</option>
             <option value="before"${preferredPlacement === 'before' ? ' selected' : ''}>Before target</option>
             <option value="after"${preferredPlacement === 'after' ? ' selected' : ''}>After target</option>
           </select>`;
    const sourceName = escapeHtml(String(folder.name || sourceId));
    const targetLabel = modeInsideOnly ? 'Move under folder' : 'Target folder';
    swal({
        title: modeInsideOnly ? 'Move under...' : 'Tree move',
        text: `
            <div class="fv-tree-move-dialog">
                <div class="fv-tree-move-source">Source: <strong>${sourceName}</strong></div>
                <label class="fv-tree-move-field-label" for="fv-tree-move-target">${targetLabel}</label>
                <select id="fv-tree-move-target">${targetOptions}</select>
                ${placementSelectHtml}
            </div>
        `,
        html: true,
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: modeInsideOnly ? 'Move under folder' : 'Apply tree move',
        cancelButtonText: 'Cancel',
        closeOnConfirm: true
    }, (confirmed) => {
        if (!confirmed) {
            return;
        }
        const targetId = String($('#fv-tree-move-target').val() || '').trim();
        const placement = modeInsideOnly
            ? 'inside'
            : normalizeTreeMovePlacement($('#fv-tree-move-placement').val() || preferredPlacement);
        void applyFolderTreeMove(resolvedType, sourceId, targetId, placement);
    });
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

const moveFolderUnderDialog = (type, folderId) => {
    openFolderTreeMoveDialog(type, folderId, { modeInsideOnly: true, placement: 'inside' });
};

Object.assign(window, {
    buildFolderQuickActionSummary,
    renderFolderQuickActionSummaryHtml,
    closeVmRowDetailsDrawer,
    runVmRowDrawerAction,
    buildVmRowDetailsDrawerHtml,
    toggleVmRowDetailsDrawer,
    showFolderRowQuickActions,
    openFolderRowQuickActions,
    clearRowLongPressState,
    bindRowTouchQuickActions,
    copyTextToClipboard,
    copyFolderId,
    saveFolderRecord,
    ensureFolderSortModeManual,
    buildTreeMoveTargetOptions,
    applyFolderTreeMove,
    openFolderTreeMoveDialog,
    moveFolderToRootQuick,
    moveFolderUnderDialog
});

window.FolderViewPlusFolderEditor = Object.freeze({
    buildFolderQuickActionSummary,
    renderFolderQuickActionSummaryHtml,
    showFolderRowQuickActions,
    openFolderRowQuickActions,
    bindRowTouchQuickActions,
    copyTextToClipboard,
    copyFolderId,
    saveFolderRecord,
    openFolderTreeMoveDialog,
    moveFolderToRootQuick,
    moveFolderUnderDialog
});
window.FolderViewPlusFolderEditorModuleLoaded = true;
