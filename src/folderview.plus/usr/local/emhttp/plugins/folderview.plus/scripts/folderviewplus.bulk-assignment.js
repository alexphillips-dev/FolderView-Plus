// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusBulkAssignment = factory();
    root.FolderViewPlusBulkAssignmentModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const fallbackWindow = typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : null);
    const BULK_ASSIGN_CHUNK_SIZE = 40;
    const BULK_ASSIGN_CHUNK_PAUSE_MS = 20;
    const BULK_LIST_RENDER_CHUNK_SIZE = 120;

    const createBulkAssignUiState = () => ({
        selected: new Set(),
        allNames: [],
        visibleNames: [],
        failedNames: [],
        lastTargetFolderId: '',
        lastResult: null,
        applying: false,
        renderToken: 0
    });

    const createApi = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        const documentRef = deps.document || win?.document || null;
        const $ = deps.$ || win?.jQuery || win?.$ || null;
        const utils = deps.utils || {};
        const swal = typeof deps.swal === 'function' ? deps.swal : (() => {});
        const escapeHtml = typeof deps.escapeHtml === 'function' ? deps.escapeHtml : ((value) => String(value ?? ''));
        const normalizeManagedType = typeof deps.normalizeManagedType === 'function'
            ? deps.normalizeManagedType
            : ((value) => String(value || '').trim().toLowerCase() === 'vm' ? 'vm' : 'docker');
        const normalizedFilter = typeof deps.normalizedFilter === 'function'
            ? deps.normalizedFilter
            : ((value) => String(value || '').trim().toLowerCase());
        const getFolderMap = typeof deps.getFolderMap === 'function'
            ? deps.getFolderMap
            : (() => ({}));
        const getFolderNameForId = typeof deps.getFolderNameForId === 'function'
            ? deps.getFolderNameForId
            : ((type, id) => String(id || ''));
        const getInfoByType = typeof deps.getInfoByType === 'function'
            ? deps.getInfoByType
            : (() => ({}));
        const filtersByType = deps.filtersByType || { docker: {}, vm: {} };
        const persistTableUiState = typeof deps.persistTableUiState === 'function'
            ? deps.persistTableUiState
            : (() => {});
        const apiPostJson = typeof deps.apiPostJson === 'function'
            ? deps.apiPostJson
            : (async () => ({ ok: false, error: 'Bulk assignment API unavailable.' }));
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
        const claimAdvancedOperationLock = typeof deps.claimAdvancedOperationLock === 'function'
            ? deps.claimAdvancedOperationLock
            : (() => true);
        const releaseAdvancedOperationLock = typeof deps.releaseAdvancedOperationLock === 'function'
            ? deps.releaseAdvancedOperationLock
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
        const showError = typeof deps.showError === 'function'
            ? deps.showError
            : (() => {});
        const requestAnimationFrameRef = typeof deps.requestAnimationFrameRef === 'function'
            ? deps.requestAnimationFrameRef
            : (typeof win?.requestAnimationFrame === 'function'
                ? win.requestAnimationFrame.bind(win)
                : ((callback) => win?.setTimeout?.(callback, 16) ?? setTimeout(callback, 16)));
        const setTimeoutRef = typeof deps.setTimeoutRef === 'function'
            ? deps.setTimeoutRef
            : (typeof win?.setTimeout === 'function' ? win.setTimeout.bind(win) : setTimeout);

        let bulkAssignStateByType = {
            docker: createBulkAssignUiState(),
            vm: createBulkAssignUiState()
        };

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

        const getBulkState = (type) => {
            const resolvedType = normalizeManagedType(type);
            if (!bulkAssignStateByType[resolvedType] || typeof bulkAssignStateByType[resolvedType] !== 'object') {
                bulkAssignStateByType[resolvedType] = createBulkAssignUiState();
            }
            return bulkAssignStateByType[resolvedType];
        };

        const getBulkAssignableNames = (type) => {
            const names = new Set();
            const infoByName = getInfoByType(type) || {};
            for (const name of Object.keys(infoByName || {})) {
                const safeName = String(name || '').trim();
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
                    const safeName = String(member || '').trim();
                    if (safeName) {
                        names.add(safeName);
                    }
                }
            }
            return Array.from(names).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
        };

        const getBulkItemsFilterQuery = (type) => {
            const resolvedType = normalizeManagedType(type);
            const fromState = normalizedFilter(filtersByType[resolvedType]?.bulk);
            if (fromState) {
                return fromState;
            }
            return normalizedFilter($ ? $(`#${resolvedType}-bulk-filter`).val() : '');
        };

        const getBulkMemberFolderLookup = (type, foldersInput = null) => {
            const resolvedType = normalizeManagedType(type);
            const folders = utils.normalizeFolderMap(foldersInput || getFolderMap(resolvedType));
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

        const normalizeBulkSelectionForType = (type) => {
            const state = getBulkState(type);
            const validNames = new Set((state.allNames || []).map((name) => sanitizeBulkItemName(name)).filter(Boolean));
            const normalized = new Set();
            for (const value of Array.from(state.selected || [])) {
                const safeName = sanitizeBulkItemName(value);
                if (!safeName || !validNames.has(safeName)) {
                    continue;
                }
                normalized.add(safeName);
            }
            state.selected = normalized;
        };

        const syncBulkLegacySelect = (type, names, { disabled = false } = {}) => {
            const selectEl = documentRef?.getElementById?.(`${type}-bulk-items`);
            if (!(selectEl instanceof HTMLSelectElement)) {
                return;
            }
            const state = getBulkState(type);
            const safeNames = Array.isArray(names)
                ? names.map((name) => sanitizeBulkItemName(name)).filter(Boolean)
                : [];
            if (!safeNames.length) {
                selectEl.innerHTML = '<option value="" disabled>(No items detected yet)</option>';
                selectEl.disabled = true;
                return;
            }
            const selected = state.selected || new Set();
            const options = safeNames
                .map((name) => {
                    const isSelected = selected.has(name) ? ' selected' : '';
                    return `<option value="${escapeHtml(name)}"${isSelected}>${escapeHtml(name)}</option>`;
                })
                .join('');
            selectEl.innerHTML = options;
            selectEl.disabled = disabled === true;
        };

        const clearBulkExecutionState = (type) => {
            const state = getBulkState(type);
            state.failedNames = [];
            state.lastResult = null;
        };

        const updateBulkStepState = (type, plan) => {
            const root = documentRef?.querySelector?.(`.bulk-module[data-fv-bulk-type="${normalizeManagedType(type)}"]`);
            if (!(root instanceof HTMLElement)) {
                return;
            }
            const state = getBulkState(type);
            const hasTarget = Boolean(plan?.targetFolderId);
            const hasSelection = Array.isArray(plan?.selectedNames) && plan.selectedNames.length > 0;
            const hasResult = !!(state.lastResult && typeof state.lastResult === 'object');
            const activeStep = !hasTarget ? 'target' : (!hasSelection ? 'select' : 'review');
            root.setAttribute('data-fv-bulk-active-step', activeStep);
            root.querySelectorAll('.bulk-step-pill[data-fv-bulk-step]').forEach((pill) => {
                if (!(pill instanceof HTMLElement)) {
                    return;
                }
                const step = String(pill.getAttribute('data-fv-bulk-step') || '').trim().toLowerCase();
                const isComplete = (step === 'target' && hasTarget)
                    || (step === 'select' && hasSelection)
                    || (step === 'review' && hasResult && state.applying !== true);
                pill.classList.toggle('is-active', step === activeStep);
                pill.classList.toggle('is-complete', isComplete);
            });
        };

        const updateBulkSummaryCards = (type, plan) => {
            const state = getBulkState(type);
            const availableCount = Array.isArray(state.allNames) ? state.allNames.length : 0;
            const visibleNames = Array.isArray(state.visibleNames) ? state.visibleNames : [];
            const visibleSelectedCount = visibleNames.filter((name) => state.selected.has(name)).length;
            const hiddenSelectedCount = Math.max(0, (plan?.selectedNames || []).length - visibleSelectedCount);
            const summaryValues = [
                {
                    id: `${type}-bulk-target-summary`,
                    value: plan?.targetFolderName || 'Choose a folder',
                    title: plan?.targetFolderName || 'Pick a target folder before selecting items.',
                    ready: Boolean(plan?.targetFolderId)
                },
                {
                    id: `${type}-bulk-available-summary`,
                    value: String(availableCount),
                    title: `${availableCount} item${availableCount === 1 ? '' : 's'} available for assignment.`,
                    ready: availableCount > 0
                },
                {
                    id: `${type}-bulk-selected-summary`,
                    value: String((plan?.selectedNames || []).length),
                    title: hiddenSelectedCount > 0
                        ? `${hiddenSelectedCount} selected item${hiddenSelectedCount === 1 ? '' : 's'} hidden by the current filter.`
                        : `${(plan?.selectedNames || []).length} item${(plan?.selectedNames || []).length === 1 ? '' : 's'} selected.`,
                    ready: (plan?.selectedNames || []).length > 0
                },
                {
                    id: `${type}-bulk-action-summary`,
                    value: String((plan?.actionableNames || []).length),
                    title: plan?.targetFolderId
                        ? `${(plan?.actionableNames || []).length} item${(plan?.actionableNames || []).length === 1 ? '' : 's'} will change folders.`
                        : 'Select a target folder to see how many items will change.',
                    ready: (plan?.actionableNames || []).length > 0
                }
            ];
            for (const entry of summaryValues) {
                const node = documentRef?.getElementById?.(entry.id);
                if (!(node instanceof HTMLElement)) {
                    continue;
                }
                node.textContent = entry.value;
                node.title = entry.title;
                const card = node.closest('.bulk-summary-card');
                if (card instanceof HTMLElement) {
                    card.classList.toggle('is-ready', entry.ready === true);
                    card.classList.toggle('is-empty', entry.ready !== true);
                }
            }
        };

        const updateBulkPrimaryAction = (type, plan) => {
            const button = documentRef?.getElementById?.(`${type}-bulk-assign-btn`);
            if (!(button instanceof HTMLButtonElement)) {
                return;
            }
            const state = getBulkState(type);
            const folderSelect = documentRef?.getElementById?.(`${type}-bulk-folder`);
            const folderSelectDisabled = folderSelect instanceof HTMLSelectElement && folderSelect.disabled === true;
            let icon = 'fa-list-alt';
            let label = 'Preview changes';
            let disabled = false;
            if (state.applying === true) {
                icon = 'fa-spinner fa-spin';
                label = 'Applying changes';
                disabled = true;
            } else if (folderSelectDisabled) {
                icon = 'fa-folder-open-o';
                label = 'Create a folder first';
                disabled = true;
            } else if (!plan?.targetFolderId) {
                icon = 'fa-crosshairs';
                label = 'Choose target first';
                disabled = true;
            } else if (!Array.isArray(plan?.selectedNames) || plan.selectedNames.length <= 0) {
                icon = 'fa-check-square-o';
                label = 'Select items first';
                disabled = true;
            } else if (!Array.isArray(plan?.actionableNames) || plan.actionableNames.length <= 0) {
                icon = 'fa-check';
                label = 'No changes needed';
                disabled = true;
            } else {
                const changeCount = plan.actionableNames.length;
                icon = 'fa-check';
                label = `Apply ${changeCount} change${changeCount === 1 ? '' : 's'}`;
                disabled = false;
            }
            button.innerHTML = `<i class="fa ${icon}"></i> ${escapeHtml(label)}`;
            button.disabled = disabled;
            button.setAttribute('data-fv-bulk-state', state.applying === true ? 'applying' : (disabled ? 'idle' : 'ready'));
        };

        const buildBulkAssignmentPlan = (type, folderId, namesInput = null) => {
            const resolvedType = normalizeManagedType(type);
            const folders = getFolderMap(resolvedType);
            const targetFolderId = String(folderId || '').trim();
            const targetFolderName = targetFolderId ? String(getFolderNameForId(resolvedType, targetFolderId) || targetFolderId) : '';
            const sourceNames = Array.isArray(namesInput) ? namesInput : Array.from(getBulkState(resolvedType).selected || []);
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

        const syncBulkWorkflowUi = (type, planInput = null) => {
            const resolvedType = normalizeManagedType(type);
            const folderId = String($ ? $(`#${resolvedType}-bulk-folder`).val() : '').trim();
            const state = getBulkState(resolvedType);
            const plan = planInput && typeof planInput === 'object'
                ? planInput
                : buildBulkAssignmentPlan(resolvedType, folderId, Array.from(state.selected || []));
            updateBulkSummaryCards(resolvedType, plan);
            updateBulkStepState(resolvedType, plan);
            updateBulkPrimaryAction(resolvedType, plan);
            return plan;
        };

        const renderBulkResultPanel = (type, result = null) => {
            if (!$) {
                return;
            }
            const panel = $(`#${type}-bulk-result`);
            if (!panel.length) {
                return;
            }
            panel.removeClass('is-success is-warning is-error is-progress');
            if (!result || typeof result !== 'object') {
                panel.prop('hidden', true);
                panel.empty();
                syncBulkWorkflowUi(type);
                return;
            }
            panel.prop('hidden', false);
            const level = String(result.level || 'info').toLowerCase();
            if (level === 'success') {
                panel.addClass('is-success');
            } else if (level === 'warning') {
                panel.addClass('is-warning');
            } else if (level === 'error') {
                panel.addClass('is-error');
            } else if (level === 'progress') {
                panel.addClass('is-progress');
            }
            const lines = Array.isArray(result.lines) ? result.lines.slice(0, 220) : [];
            if (!lines.length) {
                panel.html(`<div class="bulk-result-summary">${escapeHtml(String(result.summary || 'No updates.'))}</div>`);
                syncBulkWorkflowUi(type);
                return;
            }
            const rowHtml = lines.map((line) => {
                const status = String(line.status || 'info').trim().toLowerCase();
                const label = status === 'success'
                    ? 'Assigned'
                    : (status === 'skip' ? 'Skipped' : (status === 'invalid' ? 'Invalid' : (status === 'failed' ? 'Failed' : 'Info')));
                return `<li class="bulk-result-line is-${escapeHtml(status)}">
            <span class="bulk-result-badge">${escapeHtml(label)}</span>
            <span class="bulk-result-name">${escapeHtml(String(line.name || ''))}</span>
            <span class="bulk-result-detail">${escapeHtml(String(line.detail || ''))}</span>
        </li>`;
            }).join('');
            panel.html(`
        <div class="bulk-result-summary">${escapeHtml(String(result.summary || 'Bulk assignment update'))}</div>
        <ul class="bulk-result-list">${rowHtml}</ul>
    `);
            syncBulkWorkflowUi(type);
        };

        const updateBulkResultActions = (type) => {
            if (!$) {
                return;
            }
            const state = getBulkState(type);
            const retryButton = $(`#${type}-bulk-retry-failed`);
            if (!retryButton.length) {
                return;
            }
            const failedCount = Array.isArray(state.failedNames) ? state.failedNames.length : 0;
            const actionRow = retryButton.closest('.bulk-result-actions');
            retryButton.toggleClass('is-hidden', failedCount <= 0);
            actionRow.toggleClass('is-hidden', failedCount <= 0 || !(state.lastResult && typeof state.lastResult === 'object'));
            retryButton.prop('disabled', state.applying === true);
            if (failedCount > 0) {
                retryButton.html(`<i class="fa fa-repeat"></i> Retry failed (${failedCount})`);
            }
        };

        const confirmBulkAssignmentPlan = (typeLabel, plan) => new Promise((resolve) => {
            const summary = [
                `Target: ${plan.targetFolderName || plan.targetFolderId}`,
                `Create: ${plan.creates.length}`,
                `Move: ${plan.moves.length}`,
                `Unchanged: ${plan.unchanged.length}`,
                `Invalid: ${plan.invalidNames.length}`,
                `Duplicates dropped: ${plan.duplicateNames.length}`
            ].join('\n');
            swal({
                title: `Apply ${typeLabel} bulk assignment?`,
                text: summary,
                type: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Apply',
                cancelButtonText: 'Cancel',
                closeOnConfirm: true
            }, (confirmed) => {
                resolve(confirmed === true);
            });
        });

        const updateBulkPreviewPanel = (type) => {
            if (!$) {
                return;
            }
            const panel = $(`#${type}-bulk-preview`);
            if (!panel.length) {
                return;
            }
            const folderId = String($(`#${type}-bulk-folder`).val() || '').trim();
            const plan = syncBulkWorkflowUi(type);
            if (!folderId) {
                panel.html('<div class="bulk-preview-empty">Select a target folder to preview planned changes.</div>');
                return;
            }
            if (!plan.selectedNames.length) {
                panel.html('<div class="bulk-preview-empty">Select one or more items to preview folder moves.</div>');
                return;
            }
            const listLimit = 8;
            const movePreview = plan.moves.slice(0, listLimit)
                .map((entry) => `${entry.name} (${entry.currentFolderName} -> ${plan.targetFolderName})`)
                .join(', ');
            const createPreview = plan.creates.slice(0, listLimit).map((entry) => entry.name).join(', ');
            const unchangedPreview = plan.unchanged.slice(0, listLimit).map((entry) => entry.name).join(', ');
            const previewCounts = [
                ['Create', plan.creates.length, 'create'],
                ['Move', plan.moves.length, 'move'],
                ['Unchanged', plan.unchanged.length, 'skip'],
                ['Invalid', plan.invalidNames.length, 'invalid']
            ];
            if (plan.conflicts.length) {
                previewCounts.push(['Conflicts', plan.conflicts.length, 'conflict']);
            }
            const previewLines = [];
            previewLines.push(`<div class="bulk-preview-line"><strong>Create</strong><span>${createPreview ? escapeHtml(createPreview) : '<span class="bulk-preview-none">none</span>'}${plan.creates.length > listLimit ? `<span class="bulk-preview-more"> (+${plan.creates.length - listLimit} more)</span>` : ''}</span></div>`);
            previewLines.push(`<div class="bulk-preview-line"><strong>Move</strong><span>${movePreview ? escapeHtml(movePreview) : '<span class="bulk-preview-none">none</span>'}${plan.moves.length > listLimit ? `<span class="bulk-preview-more"> (+${plan.moves.length - listLimit} more)</span>` : ''}</span></div>`);
            previewLines.push(`<div class="bulk-preview-line"><strong>Unchanged</strong><span>${unchangedPreview ? escapeHtml(unchangedPreview) : '<span class="bulk-preview-none">none</span>'}${plan.unchanged.length > listLimit ? `<span class="bulk-preview-more"> (+${plan.unchanged.length - listLimit} more)</span>` : ''}</span></div>`);
            if (plan.duplicateNames.length) {
                previewLines.push(`<div class="bulk-preview-line"><strong>Duplicates</strong><span>${escapeHtml(`${plan.duplicateNames.length} duplicate selection${plan.duplicateNames.length === 1 ? '' : 's'} dropped automatically.`)}</span></div>`);
            }
            if (plan.conflicts.length) {
                previewLines.push(`<div class="bulk-preview-line"><strong>Conflicts</strong><span>${escapeHtml(`${plan.conflicts.length} selected item${plan.conflicts.length === 1 ? '' : 's'} already match multiple folders.`)}</span></div>`);
            }
            panel.html(`
        <div class="bulk-preview-summary">${escapeHtml(`Target folder: ${plan.targetFolderName || plan.targetFolderId}`)}</div>
        <div class="bulk-preview-counts">
            ${previewCounts.map(([label, value, stateClass]) => `<span class="bulk-preview-count is-${escapeHtml(String(stateClass))}"><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(String(label))}</span></span>`).join('')}
        </div>
        <div class="bulk-preview-lists">
            ${previewLines.join('')}
        </div>
    `);
        };

        const updateBulkSelectedCount = (type) => {
            if (!$) {
                return 0;
            }
            normalizeBulkSelectionForType(type);
            const state = getBulkState(type);
            const selectedCount = state.selected.size;
            const visibleCount = (state.visibleNames || []).length;
            const hiddenSelectedCount = Math.max(0, selectedCount - (state.visibleNames || []).filter((name) => state.selected.has(name)).length);
            let label = `${selectedCount} selected`;
            if (hiddenSelectedCount > 0) {
                label += ` (${hiddenSelectedCount} hidden by filter)`;
            } else if (visibleCount && visibleCount !== (state.allNames || []).length) {
                label += ` (${visibleCount} shown)`;
            }
            $(`#${type}-bulk-selected-count`).text(label);
            syncBulkWorkflowUi(type);
            updateBulkPreviewPanel(type);
            return selectedCount;
        };

        const updateBulkHelpText = (type, {
            allCount = 0,
            visibleCount = 0,
            filter = ''
        } = {}) => {
            if (!$) {
                return;
            }
            const help = $(`#${type}-bulk-help`);
            if (!help.length) {
                return;
            }
            if (!allCount) {
                help.text('No items detected yet. Refresh the page after Docker/VM inventory loads.');
                return;
            }
            if (filter) {
                if (!visibleCount) {
                    help.text(`No items match "${filter}". Try a broader filter.`);
                    return;
                }
                help.text(`Showing ${visibleCount} of ${allCount} item${allCount === 1 ? '' : 's'} (${BULK_LIST_RENDER_CHUNK_SIZE}/frame render chunks).`);
                return;
            }
            const perfHint = allCount > BULK_LIST_RENDER_CHUNK_SIZE ? ' Rendering is chunked for large inventories.' : '';
            help.text(`${allCount} item${allCount === 1 ? '' : 's'} available for assignment.${perfHint}`);
        };

        const renderBulkChecklist = (type, visibleNames) => {
            const list = documentRef?.getElementById?.(`${type}-bulk-items-list`);
            if (!(list instanceof HTMLElement)) {
                return;
            }
            const state = getBulkState(type);
            state.renderToken += 1;
            const renderToken = state.renderToken;
            list.innerHTML = '';
            if (!Array.isArray(visibleNames) || !visibleNames.length) {
                list.innerHTML = '<div class="bulk-items-empty">No items match this filter.</div>';
                return;
            }
            const selected = state.selected || new Set();
            let cursor = 0;
            const appendChunk = () => {
                if (renderToken !== state.renderToken) {
                    return;
                }
                const end = Math.min(cursor + BULK_LIST_RENDER_CHUNK_SIZE, visibleNames.length);
                const fragment = documentRef.createDocumentFragment();
                while (cursor < end) {
                    const name = visibleNames[cursor];
                    cursor += 1;
                    const row = documentRef.createElement('label');
                    row.className = 'bulk-item-row';
                    row.title = name;
                    const checkbox = documentRef.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.className = 'bulk-item-checkbox';
                    checkbox.value = name;
                    checkbox.checked = selected.has(name);
                    checkbox.setAttribute('data-fv-bulk-type', type);
                    checkbox.setAttribute('aria-label', `Select ${name}`);
                    const nameNode = documentRef.createElement('span');
                    nameNode.className = 'bulk-item-name';
                    nameNode.textContent = name;
                    row.appendChild(checkbox);
                    row.appendChild(nameNode);
                    fragment.appendChild(row);
                }
                list.appendChild(fragment);
                if (cursor < visibleNames.length) {
                    requestAnimationFrameRef(appendChunk);
                }
            };
            appendChunk();
        };

        const renderBulkItemOptions = (type) => {
            if (!$) {
                return;
            }
            const items = $(`#${type}-bulk-items`);
            if (!items.length) {
                return;
            }
            const state = getBulkState(type);
            const hasTargetFolders = $(`#${type}-bulk-folder`).prop('disabled') !== true;
            const allNames = getBulkAssignableNames(type);
            const filter = getBulkItemsFilterQuery(type);
            const visibleNames = filter
                ? allNames.filter((name) => name.toLowerCase().includes(filter))
                : allNames;
            state.allNames = allNames;
            state.visibleNames = visibleNames;
            normalizeBulkSelectionForType(type);
            syncBulkLegacySelect(type, allNames, { disabled: !hasTargetFolders || !allNames.length });
            if (!allNames.length) {
                renderBulkChecklist(type, []);
                renderBulkResultPanel(type, state.lastResult);
                updateBulkResultActions(type);
                updateBulkSelectedCount(type);
                updateBulkHelpText(type, { allCount: 0, visibleCount: 0, filter });
                return;
            }
            renderBulkChecklist(type, visibleNames);
            updateBulkSelectedCount(type);
            if (!hasTargetFolders) {
                updateBulkHelpText(type, { allCount: 0, visibleCount: 0, filter: '' });
                $(`#${type}-bulk-help`).text('Create a folder first, then assign selected items.');
            } else {
                updateBulkHelpText(type, { allCount: allNames.length, visibleCount: visibleNames.length, filter });
            }
            renderBulkResultPanel(type, state.lastResult);
            updateBulkResultActions(type);
        };

        const filterBulkItems = (type, value = '') => {
            if (!$) {
                return;
            }
            const resolvedType = normalizeManagedType(type);
            const displayValue = String(value || '');
            const normalized = normalizedFilter(displayValue);
            if (!filtersByType[resolvedType]) {
                filtersByType[resolvedType] = {
                    folders: '',
                    rules: '',
                    backups: '',
                    templates: '',
                    bulk: ''
                };
            }
            filtersByType[resolvedType].bulk = normalized;
            const input = $(`#${resolvedType}-bulk-filter`);
            if (input.length && input.val() !== displayValue) {
                input.val(displayValue);
            }
            persistTableUiState();
            renderBulkItemOptions(resolvedType);
        };

        const bulkItemSelectionAction = (type, action = 'all') => {
            if (!$) {
                return;
            }
            const state = getBulkState(type);
            if (state.applying === true) {
                updateBulkSelectedCount(type);
                return;
            }
            const normalizedAction = String(action || '').trim().toLowerCase();
            const visible = Array.isArray(state.visibleNames) ? state.visibleNames : [];
            for (const name of visible) {
                if (!name) {
                    continue;
                }
                if (normalizedAction === 'none') {
                    state.selected.delete(name);
                } else if (normalizedAction === 'invert') {
                    if (state.selected.has(name)) {
                        state.selected.delete(name);
                    } else {
                        state.selected.add(name);
                    }
                } else {
                    state.selected.add(name);
                }
            }
            clearBulkExecutionState(type);
            renderBulkResultPanel(type, null);
            updateBulkResultActions(type);
            syncBulkLegacySelect(type, state.allNames || [], { disabled: $(`#${type}-bulk-folder`).prop('disabled') === true });
            renderBulkChecklist(type, state.visibleNames || []);
            updateBulkSelectedCount(type);
        };

        const setBulkItemChecked = (type, name, checked) => {
            if (!$) {
                return;
            }
            const state = getBulkState(type);
            if (state.applying === true) {
                return;
            }
            const safeName = sanitizeBulkItemName(name);
            if (!safeName) {
                return;
            }
            if (checked === true) {
                state.selected.add(safeName);
            } else {
                state.selected.delete(safeName);
            }
            clearBulkExecutionState(type);
            renderBulkResultPanel(type, null);
            updateBulkResultActions(type);
            syncBulkLegacySelect(type, state.allNames || [], { disabled: $(`#${type}-bulk-folder`).prop('disabled') === true });
            updateBulkSelectedCount(type);
        };

        const bulkAssign = async (type, folderId, items) => {
            assertRuntimeConflictActionAllowed(`Bulk assign ${type === 'docker' ? 'Docker' : 'VM'} items`);
            const response = await apiPostJson('/plugins/folderview.plus/server/bulk_assign.php', {
                type,
                folderId,
                items: JSON.stringify(items || [])
            });
            if (!response.ok) {
                throw new Error(response.error || 'Bulk assignment failed.');
            }
            return response.result;
        };

        const retryFailedBulkItems = async (type) => {
            if (!$) {
                return;
            }
            const state = getBulkState(type);
            const failed = Array.isArray(state.failedNames) ? state.failedNames.map((name) => sanitizeBulkItemName(name)).filter(Boolean) : [];
            if (!failed.length) {
                swal({
                    title: 'No failed items',
                    text: 'There are no failed items to retry.',
                    type: 'info'
                });
                return;
            }
            const folderId = state.lastTargetFolderId || String($(`#${type}-bulk-folder`).val() || '').trim();
            if (!folderId) {
                swal({
                    title: 'Missing target folder',
                    text: 'Select a target folder before retrying failed items.',
                    type: 'error'
                });
                return;
            }
            await assignSelectedItems(type, failed);
        };

        const assignSelectedItems = async (type, namesOverride = null) => {
            if (!$) {
                return;
            }
            const resolvedType = normalizeManagedType(type);
            const state = getBulkState(resolvedType);
            if (state.applying === true) {
                return;
            }
            const folderId = String($(`#${resolvedType}-bulk-folder`).val() || '');
            const selectedSource = Array.isArray(namesOverride) ? namesOverride : Array.from(state.selected || []);
            const plan = buildBulkAssignmentPlan(resolvedType, folderId, selectedSource);
            const typeLabel = resolvedType === 'docker' ? 'Docker' : 'VM';
            updateBulkPreviewPanel(resolvedType);

            if (!plan.targetFolderId) {
                swal({ title: 'Error', text: 'Select a folder for bulk assignment.', type: 'error' });
                return;
            }
            const folders = getFolderMap(resolvedType);
            if (!Object.prototype.hasOwnProperty.call(folders, plan.targetFolderId)) {
                swal({ title: 'Error', text: 'Target folder no longer exists. Refresh and try again.', type: 'error' });
                return;
            }
            if (!plan.selectedNames.length) {
                swal({ title: 'Error', text: 'Select at least one item to assign.', type: 'error' });
                return;
            }
            const resultLines = [];
            for (const name of plan.invalidNames) {
                resultLines.push({ status: 'invalid', name, detail: 'Blocked by validation guard.' });
            }
            for (const name of plan.unchanged.map((entry) => entry.name)) {
                resultLines.push({ status: 'skip', name, detail: 'Already assigned to the selected folder.' });
            }
            if (plan.duplicateNames.length > 0) {
                const uniqueDuplicateNames = Array.from(new Set(plan.duplicateNames));
                for (const name of uniqueDuplicateNames) {
                    resultLines.push({ status: 'skip', name, detail: 'Duplicate selection dropped.' });
                }
            }
            if (!plan.actionableNames.length) {
                const summary = `No-op: all selected ${typeLabel} items are already assigned or invalid.`;
                state.lastResult = {
                    level: 'warning',
                    summary,
                    lines: resultLines
                };
                state.failedNames = [];
                renderBulkResultPanel(resolvedType, state.lastResult);
                updateBulkResultActions(resolvedType);
                swal({ title: 'Nothing to apply', text: summary, type: 'info' });
                return;
            }
            const confirmed = await confirmBulkAssignmentPlan(typeLabel, plan);
            if (!confirmed) {
                return;
            }
            if (!claimAdvancedOperationLock(resolvedType, 'bulk', `${typeLabel} bulk assignment`)) {
                return;
            }
            let backup = null;
            state.applying = true;
            updateBulkPrimaryAction(resolvedType, plan);
            updateBulkResultActions(resolvedType);
            renderBulkResultPanel(resolvedType, {
                level: 'progress',
                summary: `Applying ${plan.actionableNames.length} item${plan.actionableNames.length === 1 ? '' : 's'} in chunks...`,
                lines: []
            });
            const failedNames = [];
            try {
                backup = await createBackup(resolvedType, 'before-bulk-assign');
                const chunks = [];
                for (let index = 0; index < plan.actionableNames.length; index += BULK_ASSIGN_CHUNK_SIZE) {
                    chunks.push(plan.actionableNames.slice(index, index + BULK_ASSIGN_CHUNK_SIZE));
                }
                for (let index = 0; index < chunks.length; index += 1) {
                    const chunk = chunks[index];
                    const chunkNumber = index + 1;
                    renderBulkResultPanel(resolvedType, {
                        level: 'progress',
                        summary: `Applying chunk ${chunkNumber}/${chunks.length} (${chunk.length} item${chunk.length === 1 ? '' : 's'})...`,
                        lines: resultLines
                    });
                    try {
                        const result = await bulkAssign(resolvedType, plan.targetFolderId, chunk);
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
                                resultLines.push({ status: 'success', name, detail: `Assigned to ${plan.targetFolderName}.` });
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
                    if (index < chunks.length - 1) {
                        await new Promise((resolve) => setTimeoutRef(resolve, BULK_ASSIGN_CHUNK_PAUSE_MS));
                    }
                }
                await Promise.all([refreshType(resolvedType), refreshBackups(resolvedType)]);
                const assignedCount = resultLines.filter((row) => row.status === 'success').length;
                const skippedCount = resultLines.filter((row) => row.status === 'skip').length;
                const invalidCount = resultLines.filter((row) => row.status === 'invalid').length;
                const summaryBits = [
                    `${assignedCount} assigned`,
                    `${failedNames.length} failed`,
                    `${skippedCount} skipped`,
                    `${invalidCount} invalid`
                ];
                const statusLevel = failedNames.length > 0 ? 'warning' : 'success';
                const statusMessage = summaryBits.join(' | ');
                state.failedNames = Array.from(new Set(failedNames));
                state.lastTargetFolderId = plan.targetFolderId;
                state.lastResult = {
                    level: statusLevel,
                    summary: statusMessage,
                    lines: resultLines
                };
                renderBulkResultPanel(resolvedType, state.lastResult);
                updateBulkResultActions(resolvedType);
                state.selected = state.failedNames.length ? new Set(state.failedNames) : new Set();
                renderBulkItemOptions(resolvedType);
                showActionSummaryToast({
                    title: `${typeLabel} bulk assignment complete`,
                    message: statusMessage,
                    level: statusLevel,
                    type: resolvedType,
                    focusFolderId: plan.targetFolderId
                });
                if (failedNames.length > 0) {
                    swal({
                        title: 'Some items failed',
                        text: `Assigned: ${assignedCount}\nFailed: ${failedNames.length}\n\nUse "Retry failed" to try those items again.`,
                        type: 'warning'
                    });
                }
                await trackDiagnosticsEvent({
                    eventType: 'bulk_assign',
                    type: resolvedType,
                    details: {
                        folderId: plan.targetFolderId,
                        itemCount: plan.selectedNames.length,
                        assignedCount,
                        skippedCount: skippedCount,
                        skippedInvalidCount: invalidCount,
                        failedCount: failedNames.length,
                        chunkCount: Math.max(1, Math.ceil(plan.actionableNames.length / BULK_ASSIGN_CHUNK_SIZE))
                    }
                });
                await offerUndoAction(resolvedType, backup, 'Bulk assignment');
            } catch (error) {
                state.lastResult = {
                    level: 'error',
                    summary: `Bulk assignment failed: ${error?.message || error}`,
                    lines: resultLines
                };
                renderBulkResultPanel(resolvedType, state.lastResult);
                showError('Bulk assignment failed', error);
            } finally {
                state.applying = false;
                releaseAdvancedOperationLock(resolvedType, 'bulk');
                syncBulkWorkflowUi(resolvedType);
                updateBulkResultActions(resolvedType);
            }
        };

        return Object.freeze({
            getBulkAssignableNames,
            clearBulkExecutionState,
            renderBulkResultPanel,
            updateBulkResultActions,
            updateBulkPreviewPanel,
            setBulkItemChecked,
            renderBulkItemOptions,
            updateBulkSelectedCount,
            filterBulkItems,
            bulkItemSelectionAction,
            retryFailedBulkItems,
            assignSelectedItems
        });
    };

    return Object.freeze({
        createApi
    });
}));
