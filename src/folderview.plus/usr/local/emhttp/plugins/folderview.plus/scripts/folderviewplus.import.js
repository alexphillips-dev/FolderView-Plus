const importT = (key, fallback = '', ...params) => {
    if (window.FolderViewPlusI18n?.t) {
        return window.FolderViewPlusI18n.t(key, fallback, ...params);
    }
    return String(fallback || key).replace(/\$(\d+)/g, (match, index) => (
        params[Number(index) - 1] === undefined ? match : String(params[Number(index) - 1])
    ));
};

const closeImportApplyProgressDialog = () => {
    const overlay = $('#import-apply-progress-overlay');
    const dialog = $('#import-apply-progress-dialog');
    if (!dialog.length) {
        return;
    }
    overlay.hide();
    dialog.hide().attr('aria-hidden', 'true');
};

const updateImportApplyProgressDialog = ({
    completed = 0,
    total = 1,
    label = '',
    title = '',
    kicker = '',
    current = '',
    note = '',
    state = 'running',
    completedLabel = null,
    remainingLabel = null
} = {}) => {
    const safeTotal = Math.max(1, Number(total) || 1);
    const safeCompleted = Math.max(0, Math.min(safeTotal, Number(completed) || 0));
    const safeRemaining = Math.max(0, safeTotal - safeCompleted);
    const percent = Math.round((safeCompleted / safeTotal) * 100);
    const normalizedState = ['running', 'success', 'error'].includes(String(state || '').toLowerCase())
        ? String(state || '').toLowerCase()
        : 'running';
    const safeTitle = String(title || '').trim() || 'Working on FolderView Plus settings';
    const safeKicker = String(kicker || '').trim() || 'FolderView Plus';
    const safeLabel = String(label || '').trim() || 'Applying changes...';
    const safeCurrent = String(current || '').trim() || safeLabel;
    const safeNote = String(note || '').trim() || (normalizedState === 'success'
        ? 'Operation complete. The settings view will refresh shortly.'
        : 'Do not close this page until the operation completes.');
    const dialog = $('#import-apply-progress-dialog');
    dialog
        .removeClass('is-running is-success is-error')
        .addClass(`is-${normalizedState}`);
    $('#import-apply-progress-kicker').text(safeKicker);
    $('#import-apply-progress-title').text(safeTitle);
    $('#import-apply-progress-state').text(normalizedState === 'success' ? 'Complete' : (normalizedState === 'error' ? 'Stopped' : 'Running'));
    $('#import-apply-progress-label').text(safeLabel);
    $('#import-apply-progress-current').text(safeCurrent);
    $('#import-apply-progress-step').text(`Step ${safeCompleted} of ${safeTotal}`);
    $('#import-apply-progress-percent').text(`Progress ${percent}%`);
    $('#import-apply-progress-bar').css('width', `${percent}%`);
    $('#import-apply-progress-completed').text(completedLabel !== null ? String(completedLabel) : String(safeCompleted));
    $('#import-apply-progress-remaining').text(remainingLabel !== null ? String(remainingLabel) : String(safeRemaining));
    $('#import-apply-progress-total').text(String(safeTotal));
    $('#import-apply-progress-note').text(safeNote);
};

const openImportApplyProgressDialog = (type, totalSteps, options = {}) => {
    const resolvedType = normalizeManagedType(type);
    const overlay = $('#import-apply-progress-overlay');
    const dialog = $('#import-apply-progress-dialog');
    if (!dialog.length || !overlay.length) {
        return;
    }
    closeImportApplyProgressDialog();
    dialog.removeClass('fv-section-hidden fv-section-content-hidden');
    updateImportApplyProgressDialog({
        completed: 0,
        total: totalSteps,
        label: `Preparing ${resolvedType === 'docker' ? 'Docker' : 'VM'} import...`,
        title: options.title || `Applying ${resolvedType === 'docker' ? 'Docker' : 'VM'} changes`,
        kicker: options.kicker || `${resolvedType === 'docker' ? 'Docker' : 'VM'} operation`,
        current: options.current || 'Preparing operation...',
        note: options.note || undefined
    });
    overlay.show();
    dialog.show().attr('aria-hidden', 'false');
};

const readFileAsText = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsText(file, 'UTF-8');
});

const selectJsonFile = () => new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    input.onchange = async (event) => {
        const file = event.target.files?.[0];
        document.body.removeChild(input);
        if (!file) {
            resolve(null);
            return;
        }
        try {
            const text = await readFileAsText(file);
            resolve({
                name: file.name,
                text,
                size: Number(file.size) || 0,
                lastModified: Number(file.lastModified) || 0
            });
        } catch (error) {
            reject(error);
        }
    };
    document.body.appendChild(input);
    input.click();
});

const downloadFile = (name, content) => {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const element = document.createElement('a');
    element.href = url;
    element.download = name;
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(url);
};

const formatSummaryList = (label, rows) => {
    if (!rows.length) {
        return `${label}: 0`;
    }
    const names = rows.slice(0, 10).map((row) => row.name || row.id || 'unnamed');
    const extra = rows.length > 10 ? ` (+${rows.length - 10} more)` : '';
    return `${label}: ${rows.length} | ${names.join(', ')}${extra}`;
};

const formatImportSummary = (summary) => [
    formatSummaryList('Create', summary.creates),
    formatSummaryList('Update', summary.updates),
    formatSummaryList('Skip', summary.skipped),
    formatSummaryList('Unchanged', summary.unchanged),
    formatSummaryList('Delete', summary.deletes),
    ...summary.notes
].join('\n');

const renderImportDiffTable = (rows, options = {}) => {
    const container = $('#import-preview-diff');
    const shouldResetPage = options?.resetPage === true;
    if (Array.isArray(rows)) {
        importDiffPagingState.rows = rows;
    }
    if (shouldResetPage) {
        importDiffPagingState.page = 1;
    }
    const effectiveRows = Array.isArray(importDiffPagingState.rows) ? importDiffPagingState.rows : [];
    if (!effectiveRows.length) {
        container.html('<div class="hint-line">No row-level changes detected.</div>');
        return;
    }
    const totalPages = Math.max(1, Math.ceil(effectiveRows.length / importDiffPagingState.pageSize));
    importDiffPagingState.page = Math.max(1, Math.min(totalPages, Number(importDiffPagingState.page) || 1));
    const start = (importDiffPagingState.page - 1) * importDiffPagingState.pageSize;
    const pageRows = effectiveRows.slice(start, start + importDiffPagingState.pageSize);
    const body = pageRows.map((row) => {
        const action = String(row.action || '').toUpperCase();
        const id = row.id ? escapeHtml(String(row.id)) : '-';
        const name = escapeHtml(String(row.name || '-'));
        const fields = Array.isArray(row.fields) ? row.fields.join(', ') : '';
        return `<tr><td>${escapeHtml(action)}</td><td>${id}</td><td>${name}</td><td>${escapeHtml(fields || '-')}</td></tr>`;
    }).join('');

    container.html(`
        <table>
            <thead>
                <tr>
                    <th>Action</th>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Changed fields</th>
                </tr>
            </thead>
            <tbody>${body}</tbody>
        </table>
        <div class="fv-table-pager">
            <button type="button" class="fv-import-diff-prev" ${importDiffPagingState.page <= 1 ? 'disabled' : ''}>Prev</button>
            <span class="fv-table-pager-info">Page ${importDiffPagingState.page} / ${totalPages}</span>
            <button type="button" class="fv-import-diff-next" ${importDiffPagingState.page >= totalPages ? 'disabled' : ''}>Next</button>
        </div>
    `);
    utils.bindEventOnce(container.find('.fv-import-diff-prev'), 'click.fvimport', () => {
        if (importDiffPagingState.page > 1) {
            importDiffPagingState.page -= 1;
            renderImportDiffTable(null);
        }
    });
    utils.bindEventOnce(container.find('.fv-import-diff-next'), 'click.fvimport', () => {
        if (importDiffPagingState.page < totalPages) {
            importDiffPagingState.page += 1;
            renderImportDiffTable(null);
        }
    });
};

const buildOperationSelectionState = (operations, existingFolders) => {
    const folders = utils.normalizeFolderMap(existingFolders);
    return {
        creates: operations.creates.map((item, index) => ({ index, checked: true, label: item.folder?.name || `New folder ${index + 1}` })),
        upserts: operations.upserts.map((item, index) => ({ index, checked: true, label: item.folder?.name || folders[item.id]?.name || item.id || `Folder ${index + 1}` })),
        deletes: operations.deletes.map((id, index) => ({ index, checked: true, label: folders[id]?.name || id }))
    };
};

const filterOperationsBySelection = (operations) => {
    if (!importSelectionState) {
        return operations;
    }
    const createIndexes = new Set(importSelectionState.creates.filter((item) => item.checked).map((item) => item.index));
    const upsertIndexes = new Set(importSelectionState.upserts.filter((item) => item.checked).map((item) => item.index));
    const deleteIndexes = new Set(importSelectionState.deletes.filter((item) => item.checked).map((item) => item.index));

    return {
        mode: operations.mode,
        creates: operations.creates.filter((_, index) => createIndexes.has(index)),
        upserts: operations.upserts.filter((_, index) => upsertIndexes.has(index)),
        deletes: operations.deletes.filter((_, index) => deleteIndexes.has(index)),
        pathMappings: Array.isArray(operations.pathMappings) ? operations.pathMappings.slice() : [],
        pathConflicts: Array.isArray(operations.pathConflicts) ? operations.pathConflicts.slice() : []
    };
};

const renderOperationSelection = (onSelectionChanged = null) => {
    const container = $('#import-preview-selection');
    if (!importSelectionState) {
        container.empty();
        return;
    }
    const previousScrollTop = Number(container.scrollTop()) || 0;

    const sections = [
        { key: 'creates', title: 'Create', items: importSelectionState.creates },
        { key: 'upserts', title: 'Update', items: importSelectionState.upserts },
        { key: 'deletes', title: 'Delete', items: importSelectionState.deletes }
    ];

    const html = sections.map((section) => {
        if (!section.items.length) {
            return '';
        }
        const allChecked = section.items.every((item) => item.checked);
        const rows = section.items.map((item) => (`<label class="import-selection-item"><input type="checkbox" data-group="${section.key}" data-index="${item.index}" ${item.checked ? 'checked' : ''}> ${escapeHtml(item.label)}</label>`)).join('');
        return `<div class="import-selection-group"><h4><label><input type="checkbox" data-group-toggle="${section.key}" ${allChecked ? 'checked' : ''}> ${section.title} (${section.items.length})</label></h4>${rows}</div>`;
    }).join('');

    container.html(html);
    if (previousScrollTop > 0) {
        const maxScroll = Math.max(0, container.prop('scrollHeight') - container.innerHeight());
        container.scrollTop(Math.min(previousScrollTop, maxScroll));
    }

    utils.bindEventOnce(container.find('input[data-group-toggle]'), 'change.fvimport', (event) => {
        const group = String($(event.currentTarget).attr('data-group-toggle') || '');
        const checked = Boolean($(event.currentTarget).prop('checked'));
        if (Array.isArray(importSelectionState[group])) {
            importSelectionState[group].forEach((item) => {
                item.checked = checked;
            });
        }
        renderOperationSelection(onSelectionChanged);
    });

    utils.bindEventOnce(container.find('input[data-group]'), 'change.fvimport', (event) => {
        const group = String($(event.currentTarget).attr('data-group') || '');
        const index = Number($(event.currentTarget).attr('data-index'));
        if (Array.isArray(importSelectionState[group])) {
            const row = importSelectionState[group].find((item) => item.index === index);
            if (row) {
                row.checked = Boolean($(event.currentTarget).prop('checked'));
            }
        }
        renderOperationSelection(onSelectionChanged);
    });

    if (typeof onSelectionChanged === 'function') {
        onSelectionChanged();
    }
};

const showImportPreviewDialog = (type, parsed) => new Promise((resolve) => {
    const dialog = $('#import-preview-dialog');
    dialog.removeClass('fv-section-hidden fv-section-content-hidden');
    const modeSelect = $('#import-mode-select');
    const presetSelect = $('#import-preset-select');
    const presetSaveButton = $('#import-preset-save');
    const presetDefaultButton = $('#import-preset-default');
    const presetDeleteButton = $('#import-preset-delete');
    const previewText = $('#import-preview-text');
    const meta = $('#import-preview-meta');
    const result = $('#import-preview-result');
    const counts = $('#import-preview-counts');
    const changeDetailsLabel = $('#import-change-details-label');
    const trustLabel = $('#import-trust-label');
    const modeChoices = dialog.find('[data-import-mode-option]');
    const previewFirstToggle = $('#import-preview-first-toggle');
    const reviewAckRow = $('#import-review-ack-row');
    const reviewAck = $('#import-review-ack');
    const folders = getFolderMap(type);
    let dialogResult = null;
    let activePresetId = '';
    let currentOperations = { mode: 'merge', creates: [], upserts: [], deletes: [] };
    let currentDryRunOnly = false;
    let currentTrustInfo = { level: 'trusted', label: 'Trusted', reason: '' };
    let dialogLayoutObserver = null;
    let dialogLayoutFrame = 0;
    const isPreviewFirstEnabled = () => (
        previewFirstToggle.length ? previewFirstToggle.prop('checked') === true : true
    );
    const setPreviewFirstEnabled = (enabled) => {
        if (previewFirstToggle.length) {
            previewFirstToggle.prop('checked', enabled === true);
        }
    };
    const isImportReviewAcked = () => (
        reviewAck.length ? reviewAck.prop('checked') === true : false
    );
    const setImportReviewAcked = (enabled) => {
        if (reviewAck.length) {
            reviewAck.prop('checked', enabled === true);
        }
    };
    const syncModeChoiceUi = () => {
        const activeMode = normalizeImportMode(modeSelect.val());
        modeChoices.each((_, element) => {
            const button = $(element);
            const selected = String(button.attr('data-import-mode-option') || '') === activeMode;
            button.toggleClass('is-selected', selected).attr('aria-pressed', selected ? 'true' : 'false');
        });
    };
    const getImportApplyButton = () => dialog.closest('.ui-dialog').find('.ui-dialog-buttonpane button')
        .filter((_, element) => String($(element).text() || '').trim().toLowerCase() === 'apply import')
        .first();
    const applyImportDialogButtonSkin = (element) => {
        if (!element?.style) return;
        element.style.setProperty('border', '1px solid color-mix(in srgb, var(--fvplus-settings-text-primary) 28%, transparent)', 'important');
        element.style.setProperty('background', 'var(--fvplus-settings-surface-strong)', 'important');
        element.style.setProperty('color', 'var(--fvplus-settings-text-primary)', 'important');
        element.style.setProperty('box-shadow', 'var(--fvplus-settings-button-shadow)', 'important');
    };
    const getImportDialogWidths = () => {
        const shellWidth = Math.min(566, Math.max(320, Math.floor(window.innerWidth - 16)));
        const contentWidth = Math.min(520, Math.max(280, shellWidth - 46));
        return { shellWidth, contentWidth };
    };
    const getImportDialogShell = () => {
        try {
            const widget = dialog.dialog('widget');
            if (widget?.length) return widget;
        } catch (_error) {
            // The widget is not available until jQuery UI finishes initialization.
        }
        return dialog.closest('.ui-dialog');
    };
    const enforceImportTextMinimum = (dialogShell) => {
        const rootFontSize = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
        const minimumFontSize = rootFontSize * 1.2;
        dialogShell
            .find('.ui-dialog-title, #import-preview-dialog, #import-preview-dialog *, .ui-dialog-buttonpane button')
            .each((_, element) => {
                if (
                    !element?.style
                    || String(element.tagName || '').toLowerCase() === 'i'
                    || element.classList?.contains('import-mode-choice-badge')
                ) return;
                const renderedFontSize = Number.parseFloat(window.getComputedStyle(element).fontSize);
                if (Number.isFinite(renderedFontSize) && renderedFontSize + 0.01 < minimumFontSize) {
                    element.style.setProperty('font-size', '1.2rem', 'important');
                }
            });
    };
    const applyImportDialogLayout = () => {
        const { shellWidth, contentWidth } = getImportDialogWidths();
        const dialogShell = getImportDialogShell();
        if (dialog.hasClass('ui-dialog-content') && Number(dialog.dialog('option', 'width')) !== shellWidth) {
            dialog.dialog('option', 'width', shellWidth);
        }
        if (dialogShell[0]?.style) {
            dialogShell[0].style.setProperty('width', `${shellWidth}px`, 'important');
            dialogShell[0].style.setProperty('max-width', `${shellWidth}px`, 'important');
            dialogShell[0].style.setProperty('min-width', `${shellWidth}px`, 'important');
            dialogShell[0].style.setProperty('inline-size', `${shellWidth}px`, 'important');
            dialogShell[0].style.setProperty('max-inline-size', `${shellWidth}px`, 'important');
            dialogShell[0].style.setProperty('min-inline-size', `${shellWidth}px`, 'important');
            dialogShell[0].style.setProperty('box-sizing', 'border-box', 'important');
        }
        if (dialog[0]?.style) {
            dialog[0].style.setProperty('row-gap', '0.55rem', 'important');
        }
        dialog.children().each((_, element) => {
            if (!element?.style) return;
            element.style.setProperty('width', `${contentWidth}px`, 'important');
            element.style.setProperty('max-width', 'calc(100vw - 2.5rem)', 'important');
            element.style.setProperty('min-width', '0', 'important');
            element.style.setProperty('margin-left', 'auto', 'important');
            element.style.setProperty('margin-right', 'auto', 'important');
            element.style.setProperty('justify-self', 'center', 'important');
            element.style.setProperty('box-sizing', 'border-box', 'important');
        });
        dialog.find('.import-disclosures > .import-disclosure, .import-disclosure-body, .import-mode-choice, #import-preview-diff, #import-preview-selection')
            .each((_, element) => {
                if (!element?.style) return;
                element.style.setProperty('width', '100%', 'important');
                element.style.setProperty('max-width', '100%', 'important');
                element.style.setProperty('min-width', '0', 'important');
                element.style.setProperty('box-sizing', 'border-box', 'important');
            });
        enforceImportTextMinimum(dialogShell);
    };
    const queueImportDialogLayout = () => {
        if (dialogLayoutFrame) return;
        dialogLayoutFrame = window.requestAnimationFrame(() => {
            dialogLayoutFrame = 0;
            applyImportDialogLayout();
            dialog.dialog('option', 'position', { my: 'center', at: 'center', of: window });
        });
    };
    const startImportDialogLayoutLock = () => {
        dialogLayoutObserver?.disconnect();
        dialogLayoutObserver = null;
        const dialogShell = getImportDialogShell();
        if (typeof window.ResizeObserver !== 'function' || !dialogShell[0]) return;
        dialogLayoutObserver = new window.ResizeObserver(() => {
            const { shellWidth } = getImportDialogWidths();
            const actualWidth = Math.round(dialogShell[0].getBoundingClientRect().width);
            if (actualWidth !== shellWidth) queueImportDialogLayout();
        });
        dialogLayoutObserver.observe(dialogShell[0]);
    };
    const getImportRiskInfo = (selectedOperations) => {
        const deletes = Array.isArray(selectedOperations?.deletes) ? selectedOperations.deletes.length : 0;
        if (deletes > 0) {
            return {
                level: 'destructive',
                label: `Deletes ${deletes} folder${deletes === 1 ? '' : 's'}`,
                requiresReview: true
            };
        }
        if (currentTrustInfo.level && currentTrustInfo.level !== 'trusted') {
            return {
                level: 'untrusted',
                label: currentTrustInfo.label || 'Untrusted export',
                requiresReview: true
            };
        }
        return {
            level: 'normal',
            label: 'Normal',
            requiresReview: false
        };
    };
    const syncImportSafetyUi = () => {
        const selectedOperations = filterOperationsBySelection(currentOperations);
        const selectedCount = countImportOperations(selectedOperations);
        const previewFirstEnabled = isPreviewFirstEnabled();
        const riskInfo = getImportRiskInfo(selectedOperations);
        const requireAck = currentDryRunOnly !== true && (previewFirstEnabled === true || riskInfo.requiresReview === true);
        if (reviewAckRow.length) {
            reviewAckRow.css('display', requireAck ? 'flex' : 'none');
            reviewAckRow.attr('aria-hidden', requireAck ? 'false' : 'true');
            reviewAckRow.attr('title', riskInfo.requiresReview ? `${riskInfo.label} requires review before apply.` : '');
        }
        if (!requireAck) {
            setImportReviewAcked(false);
        }
        const applyButton = getImportApplyButton();
        if (applyButton.length) {
            applyButton.prop('disabled', selectedCount <= 0 || (requireAck && !isImportReviewAcked()));
        }
    };
    const isImportDryRunOnly = () => {
        const checkbox = $('#import-dry-run-only');
        return checkbox.length ? checkbox.prop('checked') === true : false;
    };
    const setImportDryRunOnly = (enabled) => {
        const checkbox = $('#import-dry-run-only');
        if (checkbox.length) {
            checkbox.prop('checked', enabled === true);
        }
    };
    const updateSelectionSummary = () => {
        const selectedOperations = filterOperationsBySelection(currentOperations);
        const selectedCount = countImportOperations(selectedOperations);
        const selectedCreates = selectedOperations.creates.length;
        const selectedUpdates = selectedOperations.upserts.length;
        const selectedDeletes = selectedOperations.deletes.length;

        const riskInfo = getImportRiskInfo(selectedOperations);
        let statusMessage = '';
        let statusLevel = 'normal';
        if (selectedCount === 0) {
            statusMessage = 'Select at least one change to continue.';
            statusLevel = 'warning';
        } else if (currentDryRunOnly) {
            statusMessage = 'Preview only is enabled. No changes will be saved.';
            statusLevel = 'info';
        } else if (selectedDeletes > 0) {
            statusMessage = `${selectedDeletes} folder${selectedDeletes === 1 ? '' : 's'} will be deleted. Review and confirm below.`;
            statusLevel = 'warning';
        } else if (currentTrustInfo.level && currentTrustInfo.level !== 'trusted') {
            statusMessage = 'This export could not be fully validated. Review and confirm below.';
            statusLevel = 'warning';
        }

        result
            .removeClass('is-info is-warning')
            .addClass(statusLevel === 'normal' ? '' : `is-${statusLevel}`)
            .text(statusMessage)
            .toggle(statusMessage !== '');

        counts.html(`
            <div class="import-summary-total">
                <strong>${selectedCount}</strong>
                <span>${escapeHtml(currentDryRunOnly
                    ? importT('import.summary.planned-change', selectedCount === 1 ? 'planned change in preview' : 'planned changes in preview', selectedCount)
                    : importT('import.summary.folder-change', selectedCount === 1 ? 'folder change' : 'folder changes', selectedCount))}</span>
            </div>
            <div class="import-summary-breakdown">
                <span class="is-create"><i class="fa fa-plus" aria-hidden="true"></i> ${escapeHtml(importT('import.summary.new', '$1 new', selectedCreates))}</span>
                <span class="is-update"><i class="fa fa-refresh" aria-hidden="true"></i> ${escapeHtml(importT('import.summary.update', `$1 update${selectedUpdates === 1 ? '' : 's'}`, selectedUpdates))}</span>
                <span class="is-delete"><i class="fa fa-trash" aria-hidden="true"></i> ${escapeHtml(importT('import.summary.delete', `$1 delete${selectedDeletes === 1 ? '' : 's'}`, selectedDeletes))}</span>
                ${riskInfo.level === 'normal' ? '' : `<span class="is-risk"><i class="fa fa-exclamation-triangle" aria-hidden="true"></i> ${escapeHtml(riskInfo.label)}</span>`}
            </div>
        `);
        changeDetailsLabel.text(selectedCount > 0
            ? importT('import.review.count', `Review $1 planned change${selectedCount === 1 ? '' : 's'}`, selectedCount)
            : importT('import.review.title', 'Review planned changes'));
        syncImportSafetyUi();
    };
    const refreshPresetControls = () => {
        if (!presetSelect.length) {
            return;
        }
        const presets = getImportPresetsForType(type);
        const defaultPresetId = getDefaultImportPresetIdForType(type);
        const knownIds = new Set(presets.map((preset) => preset.id));
        const selectedIsCustomUnsaved = activePresetId === '__custom__';

        const options = presets.map((preset) => {
            const isDefault = preset.id === defaultPresetId;
            const label = isDefault ? `${formatImportPresetLabel(preset)} (default)` : formatImportPresetLabel(preset);
            return `<option value="${escapeHtml(preset.id)}">${escapeHtml(label)}</option>`;
        });
        if (selectedIsCustomUnsaved) {
            options.push('<option value="__custom__">Custom (unsaved)</option>');
        }
        presetSelect.html(options.join(''));

        if (!activePresetId || (!knownIds.has(activePresetId) && activePresetId !== '__custom__')) {
            activePresetId = defaultPresetId;
        }
        if (activePresetId && (knownIds.has(activePresetId) || activePresetId === '__custom__')) {
            presetSelect.val(activePresetId);
        } else if (presets.length) {
            activePresetId = presets[0].id;
            presetSelect.val(activePresetId);
        }

        const selectedPresetId = String(presetSelect.val() || '');
        const canSetDefault = selectedPresetId !== '' && selectedPresetId !== '__custom__';
        const canDelete = selectedPresetId.startsWith('custom:');
        presetDefaultButton.prop('disabled', !canSetDefault);
        presetDeleteButton.prop('disabled', !canDelete);
    };
    const applyPresetById = (presetId) => {
        const preset = findImportPresetById(type, presetId);
        if (!preset) {
            return false;
        }
        modeSelect.val(normalizeImportMode(preset.mode));
        setImportDryRunOnly(preset.dryRunOnly === true);
        activePresetId = preset.id;
        refreshPresetControls();
        return true;
    };
    const syncPresetFromCurrentInputs = () => {
        const matched = findImportPresetByModeAndDryRun(type, modeSelect.val(), isImportDryRunOnly());
        activePresetId = matched ? matched.id : '__custom__';
        refreshPresetControls();
    };

    modeSelect.html(`
        <option value="merge">Merge (add new + update existing)</option>
        <option value="replace">Replace (sync exactly, delete missing)</option>
        <option value="skip">Skip existing (only add new)</option>
    `);

    if (!$('#import-dry-run-row').length) {
        modeSelect.after('<label id="import-dry-run-row"><input id="import-dry-run-only" type="checkbox"> Dry run only (preview changes, do not modify folders)</label>');
    }
    // Safety default: keep dry-run disabled unless a user preset explicitly turns it on.
    $('#import-dry-run-only').prop('checked', false);
    setPreviewFirstEnabled(getImportPreviewFirstPreference());
    setImportReviewAcked(false);
    if (!applyPresetById(getDefaultImportPresetForType(type)?.id || IMPORT_PRESET_DEFAULT_ID)) {
        modeSelect.val('merge');
        setImportDryRunOnly(false);
        activePresetId = '__custom__';
    }

    const renderPreview = () => {
        const mode = modeSelect.val();
        const summary = utils.summarizeImport(folders, parsed, mode);
        const operations = utils.buildImportOperations(folders, parsed, mode);
        const diffRows = utils.buildImportDiffRows(folders, parsed, mode);
        const trust = resolveImportTrustInfo(parsed);
        const dryRunOnly = isImportDryRunOnly();
        currentOperations = operations;
        currentDryRunOnly = dryRunOnly;
        currentTrustInfo = trust;
        importSelectionState = buildOperationSelectionState(operations, folders);
        setImportReviewAcked(false);
        renderOperationSelection(updateSelectionSummary);
        renderImportDiffTable(diffRows, { resetPage: true });
        previewText.val(formatImportSummary(summary));
        syncModeChoiceUi();

        const metaItems = [
            { label: 'Type', value: type },
            { label: 'Format', value: `${parsed.mode}${parsed.legacy ? ' (legacy)' : ''}` },
            { label: 'Schema', value: parsed.schemaVersion !== null ? `v${parsed.schemaVersion}` : 'legacy' },
            { label: 'Plugin', value: parsed.pluginVersion || 'unknown' },
            { label: 'Exported', value: parsed.exportedAt || 'unknown' },
            { label: 'Safety', value: 'Auto backup before apply' },
            {
                label: 'Trust',
                value: trust.label,
                className: `is-trust-${trust.level}`,
                title: trust.reason || ''
            }
        ];
        meta.html(metaItems.map((item) => (
            `<span class="preview-meta-item ${escapeHtml(String(item.className || '').trim())}" title="${escapeHtml(String(item.title || '').trim())}"><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(String(item.value))}</span>`
        )).join(''));
        trustLabel
            .removeClass('is-trust-trusted is-trust-legacy is-trust-untrusted')
            .addClass(`is-trust-${trust.level}`)
            .text(trust.label);
        if (trust.reason && trust.level !== 'trusted') {
            result.attr('title', trust.reason);
        } else {
            result.attr('title', '');
        }
        syncPresetFromCurrentInputs();
        syncImportSafetyUi();
    };

    utils.bindEventOnce(modeSelect, 'change.fvimport', () => {
        renderPreview();
    });
    utils.bindEventOnce(modeChoices, 'click.fvimportmode', (event) => {
        const requestedMode = normalizeImportMode($(event.currentTarget).attr('data-import-mode-option'));
        if (requestedMode === normalizeImportMode(modeSelect.val())) return;
        modeSelect.val(requestedMode);
        renderPreview();
    });
    utils.bindEventOnce($('#import-dry-run-only'), 'change.fvimport', () => {
        renderPreview();
    });
    utils.bindEventOnce(previewFirstToggle, 'change.fvimportsafety', () => {
        setImportPreviewFirstPreference(isPreviewFirstEnabled());
        if (isPreviewFirstEnabled()) {
            setImportReviewAcked(false);
        }
        syncImportSafetyUi();
    });
    utils.bindEventOnce(reviewAck, 'change.fvimportsafety', () => {
        syncImportSafetyUi();
    });
    utils.bindEventOnce($(window), 'resize.fvimportdialog', () => {
        queueImportDialogLayout();
    });
    utils.bindEventOnce(presetSelect, 'change.fvimportpreset', () => {
        const selectedId = String(presetSelect.val() || '');
        if (selectedId === '' || selectedId === '__custom__') {
            return;
        }
        if (applyPresetById(selectedId)) {
            renderPreview();
        }
    });
    utils.bindEventOnce(presetSaveButton, 'click.fvimportpreset', async () => {
        const suggestedName = String((findImportPresetById(type, activePresetId)?.name || 'My import preset')).trim();
        const name = window.prompt('Preset name:', suggestedName);
        const trimmedName = String(name || '').trim();
        if (!trimmedName) {
            return;
        }
        try {
            const saved = await saveCustomImportPresetForType(type, {
                name: trimmedName,
                mode: modeSelect.val(),
                dryRunOnly: isImportDryRunOnly()
            });
            activePresetId = saved.id;
            refreshPresetControls();
        } catch (error) {
            showError('Failed to save preset', error);
        }
    });
    utils.bindEventOnce(presetDefaultButton, 'click.fvimportpreset', async () => {
        const selectedId = String(presetSelect.val() || '');
        if (!selectedId || selectedId === '__custom__') {
            return;
        }
        try {
            await setDefaultImportPresetIdForType(type, selectedId);
            activePresetId = selectedId;
            refreshPresetControls();
        } catch (error) {
            showError('Failed to set default preset', error);
        }
    });
    utils.bindEventOnce(presetDeleteButton, 'click.fvimportpreset', () => {
        const selectedId = String(presetSelect.val() || '');
        if (!selectedId || !selectedId.startsWith('custom:')) {
            return;
        }
        swal({
            title: 'Delete import preset?',
            text: 'This only removes the saved custom preset.',
            type: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Delete',
            cancelButtonText: 'Cancel'
        }, async (confirmed) => {
            if (!confirmed) {
                return;
            }
            try {
                const deleted = await deleteCustomImportPresetForType(type, selectedId);
                if (deleted) {
                    activePresetId = getDefaultImportPresetIdForType(type);
                    refreshPresetControls();
                    renderPreview();
                }
            } catch (error) {
                showError('Failed to delete preset', error);
            }
        });
    });

    refreshPresetControls();
    $('#import-preview-kind').text(type === 'docker'
        ? importT('import.kind.docker-folder', 'Docker folder')
        : importT('import.kind.vm-folder', 'VM folder'));
    renderPreview();

    const modalWidth = getImportDialogWidths().shellWidth;
    const modalMaxHeight = Math.max(480, Math.floor(window.innerHeight - 24));
    dialog.dialog({
        title: type === 'docker'
            ? importT('import.dialog.docker-title', 'Import Docker Folders')
            : importT('import.dialog.vm-title', 'Import VM Folders'),
        resizable: false,
        width: modalWidth,
        maxHeight: modalMaxHeight,
        modal: true,
        dialogClass: 'fv-import-preview-modal',
        closeText: '',
        show: { effect: 'fade', duration: 120 },
        hide: { effect: 'fade', duration: 120 },
        open: () => {
            const dialogShell = dialog.closest('.ui-dialog');
            const buttonPane = dialogShell.find('.ui-dialog-buttonpane');
            const applyButton = getImportApplyButton();
            applyButton.addClass('fv-import-apply-button').html(`<i class="fa fa-check" aria-hidden="true"></i> ${escapeHtml(importT('import.actions.apply', 'Apply import'))}`);
            const dialogButtons = buttonPane.find('button');
            dialogButtons.addClass('fv-import-dialog-button');
            dialogButtons.not(applyButton).addClass('fv-import-cancel-button');
            dialogButtons.each((_, element) => applyImportDialogButtonSkin(element));
            dialogShell.find('.ui-dialog-titlebar-close').each((_, element) => {
                element.style.setProperty('display', 'none', 'important');
            });
            startImportDialogLayoutLock();
            applyImportDialogLayout();
            window.requestAnimationFrame(() => {
                applyImportDialogLayout();
                dialog.dialog('option', 'position', { my: 'center', at: 'center', of: window });
            });
            window.setTimeout(queueImportDialogLayout, 150);
            window.setTimeout(queueImportDialogLayout, 500);
            syncImportSafetyUi();
        },
        close: () => {
            dialogLayoutObserver?.disconnect();
            dialogLayoutObserver = null;
            if (dialogLayoutFrame) {
                window.cancelAnimationFrame(dialogLayoutFrame);
                dialogLayoutFrame = 0;
            }
            resolve(dialogResult);
        },
        buttons: {
            'Apply Import': function() {
                const mode = modeSelect.val();
                const operations = filterOperationsBySelection(utils.buildImportOperations(folders, parsed, mode));
                const dryRunOnly = isImportDryRunOnly();
                const riskInfo = getImportRiskInfo(operations);
                const requireAck = dryRunOnly !== true && (isPreviewFirstEnabled() === true || riskInfo.requiresReview === true);
                if (requireAck && !isImportReviewAcked()) {
                    swal({
                        title: 'Review required',
                        text: riskInfo.requiresReview
                            ? `${riskInfo.label} requires review. Confirm the acknowledgement checkbox before applying import.`
                            : 'Review the diff and confirm the acknowledgement checkbox before applying import.',
                        type: 'warning'
                    });
                    return;
                }
                dialogResult = { mode, operations, dryRunOnly };
                $(this).dialog('close');
            },
            Cancel: function() {
                dialogResult = null;
                $(this).dialog('close');
            }
        }
    });
});
const countImportOperations = (operations) => (
    operations.creates.length + operations.upserts.length + operations.deletes.length
);

const applyImportOperations = async (type, operations, onProgress = null) => {
    const resolvedType = normalizeManagedType(type);
    const startedAt = perfNowMs();
    const deletes = Array.isArray(operations?.deletes) ? operations.deletes : [];
    const upserts = Array.isArray(operations?.upserts) ? operations.upserts : [];
    const creates = Array.isArray(operations?.creates) ? operations.creates : [];
    const totalSteps = deletes.length + upserts.length + creates.length;
    const emit = (completed, label) => {
        if (typeof onProgress === 'function') {
            onProgress({ completed, total: totalSteps, label: String(label || '') });
        }
    };
    if (totalSteps <= 0) {
        return { completed: 0, total: 0 };
    }

    emit(0, `Applying ${totalSteps} folder change${totalSteps === 1 ? '' : 's'} in one transaction...`);
    const result = await requestFolderBatchMutation(resolvedType, { deletes, upserts, creates });
    emit(totalSteps, `Applied ${totalSteps} folder change${totalSteps === 1 ? '' : 's'}`);

    recordPerformanceDiagnosticsSample('import', resolvedType, perfNowMs() - startedAt, {
        deletes: deletes.length,
        updates: upserts.length,
        creates: creates.length,
        transport: 'atomic-batch',
        serverDurationMs: Number(result.durationMs) || 0
    });

    return {
        ...result,
        completed: totalSteps,
        total: totalSteps
    };
};

const offerUndoAction = async (type, backup, actionLabel) => {
    if (!backup || !backup.name) {
        return;
    }
    const undoKey = `${type}:${backup.name}`;
    if (pendingUndoTimers.has(undoKey)) {
        window.clearTimeout(pendingUndoTimers.get(undoKey));
        pendingUndoTimers.delete(undoKey);
    }
    const undoSeconds = Math.round(UNDO_WINDOW_MS / 1000);
    addActivityEntry(`${actionLabel} completed. Undo available for ${undoSeconds} seconds.`, 'warning');
    const expireTimer = window.setTimeout(() => {
        pendingUndoTimers.delete(undoKey);
    }, UNDO_WINDOW_MS);
    pendingUndoTimers.set(undoKey, expireTimer);

    showToastMessage({
        title: `${actionLabel} complete`,
        message: `Backup created: ${backup.name}.`,
        level: 'warning',
        durationMs: UNDO_WINDOW_MS,
        actionLabel: 'Undo',
        onAction: async () => {
            if (!pendingUndoTimers.has(undoKey)) {
                showToastMessage({
                    title: 'Undo expired',
                    message: 'This undo window has expired.',
                    level: 'warning',
                    durationMs: 2600
                });
                return;
            }
            window.clearTimeout(pendingUndoTimers.get(undoKey));
            pendingUndoTimers.delete(undoKey);
            try {
                const restore = await restoreBackupByName(type, backup.name);
                await Promise.all([refreshType(type), refreshBackups(type)]);
                addActivityEntry(`Undo applied: restored ${restore?.name || backup.name}.`, 'success');
                showToastMessage({
                    title: 'Undo complete',
                    message: `Restored ${restore?.name || backup.name}`,
                    level: 'success',
                    durationMs: 3600
                });
            } catch (error) {
                showError('Undo failed', error);
            }
        }
    });
};

const getBackupCompareOptionLabel = (backup) => {
    const created = formatTimestamp(backup?.createdAt || '');
    const reason = String(backup?.reason || '').trim();
    const base = String(backup?.name || '');
    if (!reason) {
        return `${created} | ${base}`;
    }
    return `${created} | ${reason} | ${base}`;
};

const renderBackupCompareControls = (type) => {
    const resolvedType = normalizeManagedType(type);
    const leftSelect = $(`#${resolvedType}-backup-compare-left`);
    const rightSelect = $(`#${resolvedType}-backup-compare-right`);
    const includePrefsCheckbox = $(`#${resolvedType}-backup-compare-include-prefs`);
    if (!leftSelect.length || !rightSelect.length || !includePrefsCheckbox.length) {
        return;
    }

    const backups = Array.isArray(backupsByType[resolvedType]) ? backupsByType[resolvedType] : [];
    if (!backups.length) {
        leftSelect.html('<option value="">No backups available</option>').prop('disabled', true);
        rightSelect.html('<option value="__current__">Current live folders</option>').prop('disabled', true);
        includePrefsCheckbox.prop('checked', true).prop('disabled', true);
        backupCompareSelectionByType[resolvedType] = {
            left: '',
            right: '__current__',
            includePrefs: true
        };
        return;
    }

    leftSelect.prop('disabled', false);
    rightSelect.prop('disabled', false);
    includePrefsCheckbox.prop('disabled', false);
    const previous = backupCompareSelectionByType[resolvedType] || { left: '', right: '__current__', includePrefs: true };
    const availableNames = new Set(backups.map((backup) => String(backup?.name || '')));

    const leftOptions = backups.map((backup) => (
        `<option value="${escapeHtml(String(backup?.name || ''))}">${escapeHtml(getBackupCompareOptionLabel(backup))}</option>`
    )).join('');
    const rightOptions = [
        '<option value="__current__">Current live folders</option>',
        ...backups.map((backup) => (
            `<option value="${escapeHtml(String(backup?.name || ''))}">${escapeHtml(getBackupCompareOptionLabel(backup))}</option>`
        ))
    ].join('');

    leftSelect.html(leftOptions);
    rightSelect.html(rightOptions);

    const defaultLeft = availableNames.has(previous.left) ? previous.left : String(backups[0]?.name || '');
    let defaultRight = previous.right;
    if (defaultRight !== '__current__' && !availableNames.has(defaultRight)) {
        defaultRight = '__current__';
    }
    if (!defaultRight) {
        defaultRight = '__current__';
    }
    if (defaultRight === defaultLeft) {
        defaultRight = '__current__';
    }

    leftSelect.val(defaultLeft);
    rightSelect.val(defaultRight);
    includePrefsCheckbox.prop('checked', previous.includePrefs !== false);

    backupCompareSelectionByType[resolvedType] = {
        left: String(leftSelect.val() || ''),
        right: String(rightSelect.val() || '__current__'),
        includePrefs: includePrefsCheckbox.prop('checked') === true
    };

    utils.bindEventOnce(leftSelect, 'change.fvcompare', () => {
        backupCompareSelectionByType[resolvedType].left = String(leftSelect.val() || '');
        if (String(rightSelect.val() || '') === backupCompareSelectionByType[resolvedType].left) {
            rightSelect.val('__current__');
            backupCompareSelectionByType[resolvedType].right = '__current__';
        }
    });
    utils.bindEventOnce(rightSelect, 'change.fvcompare', () => {
        backupCompareSelectionByType[resolvedType].right = String(rightSelect.val() || '__current__');
        if (backupCompareSelectionByType[resolvedType].right === backupCompareSelectionByType[resolvedType].left) {
            backupCompareSelectionByType[resolvedType].right = '__current__';
            rightSelect.val('__current__');
        }
    });
    utils.bindEventOnce(includePrefsCheckbox, 'change.fvcompare', () => {
        backupCompareSelectionByType[resolvedType].includePrefs = includePrefsCheckbox.prop('checked') === true;
    });
};

const buildBackupSnapshotDiff = (leftFolders, rightFolders) => {
    const left = utils.normalizeFolderMap(leftFolders);
    const right = utils.normalizeFolderMap(rightFolders);
    const ids = Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).sort((a, b) => a.localeCompare(b));
    const rows = [];
    const counts = {
        create: 0,
        update: 0,
        delete: 0,
        unchanged: 0
    };

    for (const id of ids) {
        const before = left[id];
        const after = right[id];
        if (!before && after) {
            counts.create += 1;
            rows.push({
                action: 'create',
                id,
                beforeName: '-',
                afterName: String(after.name || id),
                fields: ['folder']
            });
            continue;
        }
        if (before && !after) {
            counts.delete += 1;
            rows.push({
                action: 'delete',
                id,
                beforeName: String(before.name || id),
                afterName: '-',
                fields: ['folder']
            });
            continue;
        }
        const fields = utils.diffFolderFields(before, after);
        if (fields.length === 0) {
            counts.unchanged += 1;
            continue;
        }
        counts.update += 1;
        rows.push({
            action: 'update',
            id,
            beforeName: String(before?.name || id),
            afterName: String(after?.name || id),
            fields
        });
    }

    return {
        rows,
        counts,
        totalCompared: ids.length,
        leftCount: Object.keys(left).length,
        rightCount: Object.keys(right).length
    };
};

const getObjectValueByPath = (source, path) => {
    const segments = String(path || '').split('.').filter((segment) => segment !== '');
    let cursor = source;
    for (const segment of segments) {
        if (!cursor || typeof cursor !== 'object' || !Object.prototype.hasOwnProperty.call(cursor, segment)) {
            return undefined;
        }
        cursor = cursor[segment];
    }
    return cursor;
};

const serializePrefsDiffValue = (value) => {
    if (value === undefined) {
        return '(unset)';
    }
    if (Array.isArray(value)) {
        const preview = value.slice(0, 5).map((item) => String(item));
        const suffix = value.length > 5 ? ` (+${value.length - 5} more)` : '';
        return `${value.length} item(s): ${preview.join(', ')}${suffix}`;
    }
    if (value && typeof value === 'object') {
        const json = JSON.stringify(value);
        if (json.length <= 220) {
            return json;
        }
        return `${json.slice(0, 217)}...`;
    }
    return String(value);
};

const buildBackupPrefsDiff = (leftPrefs, rightPrefs) => {
    const left = utils.normalizePrefs(leftPrefs || {});
    const right = utils.normalizePrefs(rightPrefs || {});
    const descriptors = [
        { key: 'sortMode', label: 'Sort mode' },
        { key: 'manualOrder', label: 'Manual order' },
        { key: 'pinnedFolderIds', label: 'Pinned folders' },
        { key: 'hideEmptyFolders', label: 'Hide empty folders' },
        { key: 'appColumnWidth', label: 'Application width' },
        { key: 'badges', label: 'Badge visibility' },
        { key: 'liveRefreshEnabled', label: 'Live refresh enabled' },
        { key: 'liveRefreshSeconds', label: 'Live refresh interval' },
        { key: 'performanceMode', label: 'Performance mode' },
        { key: 'lazyPreviewEnabled', label: 'Lazy previews' },
        { key: 'lazyPreviewThreshold', label: 'Lazy preview threshold' },
        { key: 'health', label: 'Health card settings' },
        { key: 'status', label: 'Status column settings' },
        { key: 'backupSchedule', label: 'Backup schedule' },
        { key: 'importPresets', label: 'Import preset settings' }
    ];
    const rows = [];
    for (const descriptor of descriptors) {
        const before = getObjectValueByPath(left, descriptor.key);
        const after = getObjectValueByPath(right, descriptor.key);
        if (JSON.stringify(before) === JSON.stringify(after)) {
            continue;
        }
        rows.push({
            key: descriptor.key,
            label: descriptor.label,
            before,
            after
        });
    }
    return {
        rows,
        comparedCount: descriptors.length
    };
};

const renderBackupCompareDiffTable = (rows, options = {}) => {
    const container = $('#backup-compare-diff');
    if (Array.isArray(rows)) {
        backupCompareDiffPagingState.rows = rows;
    }
    if (options?.resetPage === true) {
        backupCompareDiffPagingState.page = 1;
    }
    const effectiveRows = Array.isArray(backupCompareDiffPagingState.rows) ? backupCompareDiffPagingState.rows : [];
    if (!effectiveRows.length) {
        container.html('<div class="hint-line">No differences found between the selected snapshots.</div>');
        return;
    }
    const totalPages = Math.max(1, Math.ceil(effectiveRows.length / backupCompareDiffPagingState.pageSize));
    backupCompareDiffPagingState.page = Math.max(1, Math.min(totalPages, Number(backupCompareDiffPagingState.page) || 1));
    const start = (backupCompareDiffPagingState.page - 1) * backupCompareDiffPagingState.pageSize;
    const pageRows = effectiveRows.slice(start, start + backupCompareDiffPagingState.pageSize);
    const body = pageRows.map((row) => (
        `<tr>
            <td>${escapeHtml(String(row.action || '').toUpperCase())}</td>
            <td>${escapeHtml(String(row.id || '-'))}</td>
            <td>${escapeHtml(String(row.beforeName || '-'))}</td>
            <td>${escapeHtml(String(row.afterName || '-'))}</td>
            <td>${escapeHtml(Array.isArray(row.fields) ? row.fields.join(', ') : '-')}</td>
        </tr>`
    )).join('');
    container.html(`
        <table>
            <thead>
                <tr>
                    <th>Action</th>
                    <th>ID</th>
                    <th>Before</th>
                    <th>After</th>
                    <th>Changed fields</th>
                </tr>
            </thead>
            <tbody>${body}</tbody>
        </table>
        <div class="fv-table-pager">
            <button type="button" class="fv-backup-diff-prev" ${backupCompareDiffPagingState.page <= 1 ? 'disabled' : ''}>Prev</button>
            <span class="fv-table-pager-info">Page ${backupCompareDiffPagingState.page} / ${totalPages}</span>
            <button type="button" class="fv-backup-diff-next" ${backupCompareDiffPagingState.page >= totalPages ? 'disabled' : ''}>Next</button>
        </div>
    `);
    utils.bindEventOnce(container.find('.fv-backup-diff-prev'), 'click.fvbackupdiff', () => {
        if (backupCompareDiffPagingState.page > 1) {
            backupCompareDiffPagingState.page -= 1;
            renderBackupCompareDiffTable(null);
        }
    });
    utils.bindEventOnce(container.find('.fv-backup-diff-next'), 'click.fvbackupdiff', () => {
        if (backupCompareDiffPagingState.page < totalPages) {
            backupCompareDiffPagingState.page += 1;
            renderBackupCompareDiffTable(null);
        }
    });
};

const renderBackupComparePrefsDiff = ({ includePrefs, prefsDiff, prefsAvailable }) => {
    const container = $('#backup-compare-prefs');
    if (!container.length) {
        return;
    }
    if (!includePrefs) {
        container.html('<div class="backup-compare-prefs-empty">Preference comparison is disabled for this run.</div>');
        return;
    }
    if (!prefsAvailable) {
        container.html('<div class="backup-compare-prefs-empty">Preference data is unavailable in one of the selected snapshots.</div>');
        return;
    }
    if (!prefsDiff || !Array.isArray(prefsDiff.rows) || prefsDiff.rows.length === 0) {
        container.html('<div class="backup-compare-prefs-empty">No preference differences detected.</div>');
        return;
    }
    const body = prefsDiff.rows.map((row) => (
        `<tr>
            <td>${escapeHtml(String(row.label || row.key || '-'))}</td>
            <td>${escapeHtml(serializePrefsDiffValue(row.before))}</td>
            <td>${escapeHtml(serializePrefsDiffValue(row.after))}</td>
        </tr>`
    )).join('');
    container.html(`
        <p class="backup-compare-prefs-title">Preference changes (${prefsDiff.rows.length})</p>
        <table>
            <thead>
                <tr>
                    <th>Field</th>
                    <th>Before</th>
                    <th>After</th>
                </tr>
            </thead>
            <tbody>${body}</tbody>
        </table>
    `);
};

const renderBackupCompareDialog = ({ type, leftSnapshot, rightSnapshot, diff, includePrefs, prefsDiff, prefsAvailable }) => {
    const dialog = $('#backup-compare-dialog');
    const meta = $('#backup-compare-meta');
    const counts = $('#backup-compare-counts');
    if (!dialog.length || !meta.length || !counts.length) {
        return;
    }

    const metaItems = [
        { label: 'Type', value: type === 'vm' ? 'vm' : 'docker' },
        { label: 'From', value: leftSnapshot.label },
        { label: 'To', value: rightSnapshot.label },
        { label: 'From folders', value: diff.leftCount },
        { label: 'To folders', value: diff.rightCount }
    ];
    meta.html(metaItems.map((item) => (
        `<span class="preview-meta-item"><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(String(item.value))}</span>`
    )).join(''));

    counts.html(`
        <span class="import-count-chip is-create">Create: ${diff.counts.create}</span>
        <span class="import-count-chip is-update">Update: ${diff.counts.update}</span>
        <span class="import-count-chip is-delete">Delete: ${diff.counts.delete}</span>
        <span class="import-count-chip is-selected">Unchanged: ${diff.counts.unchanged}</span>
        <span class="import-count-chip is-dryrun">Prefs changed: ${includePrefs && prefsAvailable ? (prefsDiff?.rows?.length || 0) : 'n/a'}</span>
    `);

    renderBackupCompareDiffTable(diff.rows, { resetPage: true });
    renderBackupComparePrefsDiff({ includePrefs, prefsDiff, prefsAvailable });

    const modalWidth = Math.min(980, Math.max(760, Math.floor(window.innerWidth * 0.92)));
    dialog.dialog({
        title: `Compare ${type === 'docker' ? 'Docker' : 'VM'} snapshots`,
        resizable: false,
        width: modalWidth,
        modal: true,
        dialogClass: 'fv-backup-compare-modal',
        buttons: {
            Close: function() {
                $(this).dialog('close');
            }
        }
    });
};

const resolveBackupCompareSnapshot = async (type, target) => {
    const resolvedType = normalizeManagedType(type);
    const targetId = String(target || '').trim();
    if (!targetId || targetId === '__current__') {
        const folders = getFolderMap(resolvedType);
        const prefs = utils.normalizePrefs(prefsByType[resolvedType]);
        return {
            targetId: '__current__',
            label: 'Current live folders',
            folders,
            prefs
        };
    }
    const snapshot = await fetchBackupSnapshot(resolvedType, targetId);
    const labelReason = String(snapshot.reason || '').trim();
    const labelPrefix = formatTimestamp(snapshot.createdAt || '');
    const label = labelReason
        ? `${labelPrefix} | ${labelReason}`
        : `${labelPrefix} | ${targetId}`;
    return {
        targetId,
        label,
        folders: utils.normalizeFolderMap(snapshot.folders || {}),
        prefs: snapshot && typeof snapshot === 'object' && snapshot.prefs && typeof snapshot.prefs === 'object'
            ? snapshot.prefs
            : null
    };
};

const compareBackupSnapshots = async (type) => {
    let resolvedType;
    try {
        resolvedType = normalizeManagedType(type);
    } catch (error) {
        showError('Compare failed', error);
        return;
    }

    const leftTarget = String($(`#${resolvedType}-backup-compare-left`).val() || '').trim();
    const rightTarget = String($(`#${resolvedType}-backup-compare-right`).val() || '__current__').trim() || '__current__';
    const includePrefs = $(`#${resolvedType}-backup-compare-include-prefs`).prop('checked') === true;
    if (!leftTarget) {
        swal({
            title: 'Compare unavailable',
            text: 'Create at least one backup snapshot first.',
            type: 'warning'
        });
        return;
    }
    if (leftTarget === rightTarget) {
        swal({
            title: 'Choose different snapshots',
            text: 'Select two different targets to compare.',
            type: 'warning'
        });
        return;
    }

    try {
        const [leftSnapshot, rightSnapshot] = await Promise.all([
            resolveBackupCompareSnapshot(resolvedType, leftTarget),
            resolveBackupCompareSnapshot(resolvedType, rightTarget)
        ]);
        const diff = buildBackupSnapshotDiff(leftSnapshot.folders, rightSnapshot.folders);
        const prefsAvailable = leftSnapshot.prefs !== null && rightSnapshot.prefs !== null;
        const prefsDiff = includePrefs && prefsAvailable
            ? buildBackupPrefsDiff(leftSnapshot.prefs, rightSnapshot.prefs)
            : { rows: [], comparedCount: 0 };
        renderBackupCompareDialog({
            type: resolvedType,
            leftSnapshot,
            rightSnapshot,
            diff,
            includePrefs,
            prefsDiff,
            prefsAvailable
        });
    } catch (error) {
        showError('Compare failed', error);
    }
};

window.FolderViewPlusImportModuleLoaded = true;
