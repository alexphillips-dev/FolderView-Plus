const closeImportApplyProgressDialog = () => {
    const overlay = $('#import-apply-progress-overlay');
    const dialog = $('#import-apply-progress-dialog');
    if (!dialog.length) {
        return;
    }
    overlay.hide();
    dialog.hide().attr('aria-hidden', 'true');
};

const updateImportApplyProgressDialog = ({ completed = 0, total = 1, label = '' }) => {
    const safeTotal = Math.max(1, Number(total) || 1);
    const safeCompleted = Math.max(0, Math.min(safeTotal, Number(completed) || 0));
    const percent = Math.round((safeCompleted / safeTotal) * 100);
    $('#import-apply-progress-label').text(label || 'Applying import...');
    $('#import-apply-progress-step').text(`Step ${safeCompleted} of ${safeTotal}`);
    $('#import-apply-progress-percent').text(`Progress ${percent}%`);
    $('#import-apply-progress-bar').css('width', `${percent}%`);
};

const openImportApplyProgressDialog = (type, totalSteps) => {
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
        label: `Preparing ${resolvedType === 'docker' ? 'Docker' : 'VM'} import...`
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
    const previewFirstToggle = $('#import-preview-first-toggle');
    const reviewAckRow = $('#import-review-ack-row');
    const reviewAck = $('#import-review-ack');
    const folders = getFolderMap(type);
    let dialogResult = null;
    let activePresetId = '';
    let currentOperations = { mode: 'merge', creates: [], upserts: [], deletes: [] };
    let currentDryRunOnly = false;
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
    const getImportApplyButton = () => dialog.closest('.ui-dialog').find('.ui-dialog-buttonpane button')
        .filter((_, element) => String($(element).text() || '').trim().toLowerCase() === 'apply import')
        .first();
    const syncImportSafetyUi = () => {
        const selectedOperations = filterOperationsBySelection(currentOperations);
        const selectedCount = countImportOperations(selectedOperations);
        const previewFirstEnabled = isPreviewFirstEnabled();
        const requireAck = currentDryRunOnly !== true && previewFirstEnabled === true;
        if (reviewAckRow.length) {
            reviewAckRow.toggle(requireAck);
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

        if (selectedCount === 0) {
            result.text('No operations selected yet. Use the checkboxes below to include at least one change.');
        } else if (currentDryRunOnly) {
            result.text(`${selectedCount} operation${selectedCount === 1 ? '' : 's'} selected. Dry run is ON, so no folder changes will be applied.`);
        } else {
            result.text(`${selectedCount} operation${selectedCount === 1 ? '' : 's'} selected and ready to apply.`);
        }

        counts.html(`
            <span class="import-count-chip is-create">Create: ${selectedCreates}/${currentOperations.creates.length}</span>
            <span class="import-count-chip is-update">Update: ${selectedUpdates}/${currentOperations.upserts.length}</span>
            <span class="import-count-chip is-delete">Delete: ${selectedDeletes}/${currentOperations.deletes.length}</span>
            <span class="import-count-chip is-selected">Selected: ${selectedCount}</span>
            <span class="import-count-chip is-dryrun">Dry run: ${currentDryRunOnly ? 'ON' : 'OFF'}</span>
        `);
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

    if (!$('#import-mode-help').length) {
        modeSelect.after('<div id="import-mode-help">Optional dry run: enable preview-only mode if you want to review without applying changes.</div>');
    }
    if (!$('#import-dry-run-row').length) {
        $('#import-mode-help').after('<label id="import-dry-run-row"><input id="import-dry-run-only" type="checkbox"> Dry run only (preview changes, do not modify folders)</label>');
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
        importSelectionState = buildOperationSelectionState(operations, folders);
        setImportReviewAcked(false);
        renderOperationSelection(updateSelectionSummary);
        renderImportDiffTable(diffRows, { resetPage: true });
        previewText.val(formatImportSummary(summary));

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
    renderPreview();

    const modalWidth = Math.min(980, Math.max(760, Math.floor(window.innerWidth * 0.92)));
    dialog.dialog({
        title: `Import ${type === 'docker' ? 'Docker' : 'VM'} Folders`,
        resizable: false,
        width: modalWidth,
        modal: true,
        dialogClass: 'fv-import-preview-modal',
        closeText: '',
        show: { effect: 'fade', duration: 120 },
        hide: { effect: 'fade', duration: 120 },
        open: () => {
            syncImportSafetyUi();
        },
        close: () => resolve(dialogResult),
        buttons: {
            'Apply Import': function() {
                const mode = modeSelect.val();
                const operations = filterOperationsBySelection(utils.buildImportOperations(folders, parsed, mode));
                const dryRunOnly = isImportDryRunOnly();
                const requireAck = dryRunOnly !== true && isPreviewFirstEnabled() === true;
                if (requireAck && !isImportReviewAcked()) {
                    swal({
                        title: 'Review required',
                        text: 'Review the diff and confirm the acknowledgement checkbox before applying import.',
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

const pauseImportApplyChunk = () => new Promise((resolve) => {
    window.setTimeout(resolve, IMPORT_APPLY_CHUNK_PAUSE_MS);
});

const runImportChunked = async (items, runner) => {
    const list = Array.isArray(items) ? items : [];
    for (let start = 0; start < list.length; start += IMPORT_APPLY_CHUNK_SIZE) {
        const end = Math.min(start + IMPORT_APPLY_CHUNK_SIZE, list.length);
        for (let index = start; index < end; index += 1) {
            await runner(list[index], index);
        }
        if (end < list.length) {
            await pauseImportApplyChunk();
        }
    }
};

const applyImportOperations = async (type, operations, onProgress = null) => {
    const resolvedType = normalizeManagedType(type);
    const startedAt = perfNowMs();
    const deletes = Array.isArray(operations?.deletes) ? operations.deletes : [];
    const upserts = Array.isArray(operations?.upserts) ? operations.upserts : [];
    const creates = Array.isArray(operations?.creates) ? operations.creates : [];
    const currentFolders = getFolderMap(resolvedType);
    const totalSteps = deletes.length + upserts.length + creates.length + (resolvedType === 'docker' ? 1 : 0);
    let completed = 0;
    const emit = (label) => {
        if (typeof onProgress === 'function') {
            onProgress({ completed, total: totalSteps, label: String(label || '') });
        }
    };

    await runImportChunked(deletes, async (id) => {
        const folderName = String(currentFolders[id]?.name || id || 'folder');
        await apiPostText('/plugins/folderview.plus/server/delete.php', { type: resolvedType, id });
        completed += 1;
        emit(`Deleted ${folderName}`);
    });

    await runImportChunked(upserts, async (item) => {
        const folderName = String(item?.folder?.name || currentFolders[item?.id]?.name || item?.id || 'folder');
        await apiPostText('/plugins/folderview.plus/server/update.php', {
            type: resolvedType,
            id: item.id,
            content: JSON.stringify(item.folder)
        });
        completed += 1;
        emit(`Updated ${folderName}`);
    });

    await runImportChunked(creates, async (item) => {
        const folderName = String(item?.folder?.name || 'folder');
        await apiPostText('/plugins/folderview.plus/server/create.php', {
            type: resolvedType,
            content: JSON.stringify(item.folder)
        });
        completed += 1;
        emit(`Created ${folderName}`);
    });

    if (resolvedType === 'docker') {
        await syncDockerOrder();
        completed += 1;
        emit('Synced Docker folder order');
    }

    recordPerformanceDiagnosticsSample('import', resolvedType, perfNowMs() - startedAt, {
        deletes: deletes.length,
        updates: upserts.length,
        creates: creates.length
    });

    return {
        completed,
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
