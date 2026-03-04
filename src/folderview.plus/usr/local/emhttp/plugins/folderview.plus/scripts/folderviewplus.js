const utils = window.FolderViewPlusUtils;
const EXPORT_BASENAME = 'FolderView Plus Export';

let dockers = {};
let vms = {};
let pluginVersion = '0.0.0';
let prefsByType = {
    docker: utils.normalizePrefs({}),
    vm: utils.normalizePrefs({})
};
let infoByType = {
    docker: {},
    vm: {}
};
let backupsByType = {
    docker: [],
    vm: []
};
let templatesByType = {
    docker: [],
    vm: []
};
let importSelectionState = null;
let lastDiagnostics = null;

const toPrettyJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
const tableIdByType = { docker: 'docker', vm: 'vms' };
const parseJsonResponse = (value) => (typeof value === 'string' ? JSON.parse(value) : value);
const typeFolders = (type) => (type === 'docker' ? dockers : vms);

const setTypeFolders = (type, value) => {
    if (type === 'docker') {
        dockers = value;
        return;
    }
    vms = value;
};

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getFolderMap = (type) => utils.normalizeFolderMap(typeFolders(type));

const folderNameForId = (type, id) => {
    const folders = getFolderMap(type);
    return folders[id]?.name || id;
};

const apiGetJson = async (url) => parseJsonResponse(await $.get(url).promise());

const fetchPluginVersion = async () => {
    try {
        pluginVersion = (await $.get('/plugins/folderview.plus/server/version.php').promise()).trim() || '0.0.0';
    } catch (error) {
        pluginVersion = '0.0.0';
    }
};

const fetchFolders = async (type) => apiGetJson(`/plugins/folderview.plus/server/read.php?type=${type}`);
const fetchTypeInfo = async (type) => apiGetJson(`/plugins/folderview.plus/server/read_info.php?type=${type}`);

const fetchBackups = async (type) => {
    const response = parseJsonResponse(await $.get('/plugins/folderview.plus/server/backup.php', {
        type,
        action: 'list'
    }).promise());
    if (!response.ok) {
        throw new Error(response.error || 'Failed to fetch backups.');
    }
    return Array.isArray(response.backups) ? response.backups : [];
};

const restoreBackupByName = async (type, name) => {
    const response = parseJsonResponse(await $.post('/plugins/folderview.plus/server/backup.php', {
        type,
        action: 'restore',
        name
    }).promise());
    if (!response.ok) {
        throw new Error(response.error || 'Restore failed.');
    }
    return response.restore;
};

const deleteBackupByName = async (type, name) => {
    const response = parseJsonResponse(await $.post('/plugins/folderview.plus/server/backup.php', {
        type,
        action: 'delete',
        name
    }).promise());
    if (!response.ok) {
        throw new Error(response.error || 'Delete failed.');
    }
    return Array.isArray(response.backups) ? response.backups : [];
};

const fetchTemplates = async (type) => {
    const response = parseJsonResponse(await $.get('/plugins/folderview.plus/server/templates.php', {
        type,
        action: 'list'
    }).promise());
    if (!response.ok) {
        throw new Error(response.error || 'Failed to fetch templates.');
    }
    return Array.isArray(response.templates) ? response.templates : [];
};

const createTemplate = async (type, folderId, name) => {
    const response = parseJsonResponse(await $.post('/plugins/folderview.plus/server/templates.php', {
        type,
        action: 'create',
        folderId,
        name
    }).promise());
    if (!response.ok) {
        throw new Error(response.error || 'Template create failed.');
    }
    return Array.isArray(response.templates) ? response.templates : [];
};

const deleteTemplate = async (type, templateId) => {
    const response = parseJsonResponse(await $.post('/plugins/folderview.plus/server/templates.php', {
        type,
        action: 'delete',
        templateId
    }).promise());
    if (!response.ok) {
        throw new Error(response.error || 'Template delete failed.');
    }
    return Array.isArray(response.templates) ? response.templates : [];
};

const applyTemplate = async (type, templateId, folderId) => {
    const response = parseJsonResponse(await $.post('/plugins/folderview.plus/server/templates.php', {
        type,
        action: 'apply',
        templateId,
        folderId
    }).promise());
    if (!response.ok) {
        throw new Error(response.error || 'Template apply failed.');
    }
    return response.apply || {};
};

const bulkAssign = async (type, folderId, items) => {
    const response = parseJsonResponse(await $.post('/plugins/folderview.plus/server/bulk_assign.php', {
        type,
        folderId,
        items: JSON.stringify(items || [])
    }).promise());
    if (!response.ok) {
        throw new Error(response.error || 'Bulk assignment failed.');
    }
    return response.result;
};

const getDiagnostics = async (privacy = 'sanitized') => {
    const response = await apiGetJson(`/plugins/folderview.plus/server/diagnostics.php?action=report&privacy=${encodeURIComponent(privacy || 'sanitized')}`);
    if (!response.ok) {
        throw new Error(response.error || 'Diagnostics failed.');
    }
    return response.diagnostics || {};
};

const getSupportBundle = async (privacy = 'sanitized') => {
    const response = await apiGetJson(`/plugins/folderview.plus/server/diagnostics.php?action=support_bundle&privacy=${encodeURIComponent(privacy || 'sanitized')}`);
    if (!response.ok) {
        throw new Error(response.error || 'Support bundle failed.');
    }
    return response.bundle || {};
};

const runDiagnosticAction = async (action, type, privacy = 'sanitized') => {
    const payload = { action };
    if (type) {
        payload.type = type;
    }
    payload.privacy = privacy || 'sanitized';
    const response = parseJsonResponse(await $.post('/plugins/folderview.plus/server/diagnostics.php', payload).promise());
    if (!response.ok) {
        throw new Error(response.error || 'Diagnostics action failed.');
    }
    return response.diagnostics || {};
};

const trackDiagnosticsEvent = async ({ eventType, type = null, status = 'ok', source = 'ui', details = {} }) => {
    if (!eventType) {
        return;
    }
    const payload = {
        action: 'track_event',
        eventType: String(eventType),
        status: String(status || 'ok'),
        source: String(source || 'ui'),
        details: JSON.stringify(details || {})
    };
    if (type) {
        payload.type = type;
    }
    try {
        await $.post('/plugins/folderview.plus/server/diagnostics.php', payload).promise();
    } catch (error) {
        // Event tracking is best-effort and should never block UI actions.
    }
};

const fetchPrefs = async (type) => {
    try {
        const response = await apiGetJson(`/plugins/folderview.plus/server/prefs.php?type=${type}`);
        if (response.ok && response.prefs) {
            return utils.normalizePrefs(response.prefs);
        }
    } catch (error) {
        // Keep defaults.
    }
    return utils.normalizePrefs({});
};

const postPrefs = async (type, prefs) => {
    const response = parseJsonResponse(await $.post('/plugins/folderview.plus/server/prefs.php', {
        type,
        prefs: JSON.stringify(prefs)
    }).promise());
    if (!response.ok) {
        throw new Error(response.error || 'Failed to save preferences.');
    }
    return utils.normalizePrefs(response.prefs || prefs);
};

const createBackup = async (type, reason) => {
    const response = parseJsonResponse(await $.post('/plugins/folderview.plus/server/backup.php', {
        type,
        action: 'create',
        reason
    }).promise());
    if (!response.ok) {
        throw new Error(response.error || 'Backup failed.');
    }
    return response.backup;
};

const restoreLatest = async (type) => {
    const response = parseJsonResponse(await $.post('/plugins/folderview.plus/server/backup.php', {
        type,
        action: 'restore_latest'
    }).promise());
    if (!response.ok) {
        throw new Error(response.error || 'Restore failed.');
    }
    return response.restore;
};

const syncDockerOrder = async () => {
    await $.post('/plugins/folderview.plus/server/sync_order.php', { type: 'docker' }).promise();
};

const setUpdateStatus = (text) => {
    $('#update-check-status').text(text || '');
};

const formatTimestamp = (isoString) => {
    if (!isoString) {
        return 'Unknown';
    }
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
        return String(isoString);
    }
    return date.toLocaleString();
};

const showError = (title, error) => {
    swal({
        title,
        text: error?.message || String(error),
        type: 'error'
    });
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
            resolve({ name: file.name, text });
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
        deletes: operations.deletes.filter((_, index) => deleteIndexes.has(index))
    };
};

const renderOperationSelection = () => {
    const container = $('#import-preview-selection');
    if (!importSelectionState) {
        container.empty();
        return;
    }

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

    container.find('input[data-group-toggle]').off('change.fvimport').on('change.fvimport', (event) => {
        const group = String($(event.currentTarget).attr('data-group-toggle') || '');
        const checked = Boolean($(event.currentTarget).prop('checked'));
        if (Array.isArray(importSelectionState[group])) {
            importSelectionState[group].forEach((item) => {
                item.checked = checked;
            });
        }
        renderOperationSelection();
    });

    container.find('input[data-group]').off('change.fvimport').on('change.fvimport', (event) => {
        const group = String($(event.currentTarget).attr('data-group') || '');
        const index = Number($(event.currentTarget).attr('data-index'));
        if (Array.isArray(importSelectionState[group])) {
            const row = importSelectionState[group].find((item) => item.index === index);
            if (row) {
                row.checked = Boolean($(event.currentTarget).prop('checked'));
            }
        }
        renderOperationSelection();
    });
};

const showImportPreviewDialog = (type, parsed) => new Promise((resolve) => {
    const dialog = $('#import-preview-dialog');
    const modeSelect = $('#import-mode-select');
    const previewText = $('#import-preview-text');
    const meta = $('#import-preview-meta');
    const result = $('#import-preview-result');
    const folders = getFolderMap(type);
    let dialogResult = null;

    const renderPreview = () => {
        const mode = modeSelect.val();
        const summary = utils.summarizeImport(folders, parsed, mode);
        const operations = utils.buildImportOperations(folders, parsed, mode);
        importSelectionState = buildOperationSelectionState(operations, folders);
        renderOperationSelection();
        previewText.val(formatImportSummary(summary));
        result.text(`Selected operations: ${countImportOperations(filterOperationsBySelection(operations))} | Creates: ${operations.creates.length}, Updates: ${operations.upserts.length}, Deletes: ${operations.deletes.length}`);

        const metaParts = [
            `Type: ${type}`,
            `Mode: ${parsed.mode}${parsed.legacy ? ' (legacy format)' : ''}`,
            parsed.schemaVersion !== null ? `Schema: v${parsed.schemaVersion}` : 'Schema: legacy',
            parsed.pluginVersion ? `Plugin: ${parsed.pluginVersion}` : null,
            parsed.exportedAt ? `Exported: ${parsed.exportedAt}` : null
        ].filter(Boolean);
        meta.text(metaParts.join(' | '));
    };

    modeSelect.off('change.fvimport').on('change.fvimport', () => {
        renderPreview();
    });

    modeSelect.val('merge');
    renderPreview();

    dialog.dialog({
        title: `Import ${type === 'docker' ? 'Docker' : 'VM'} Folders`,
        resizable: false,
        width: 760,
        modal: true,
        show: { effect: 'fade', duration: 120 },
        hide: { effect: 'fade', duration: 120 },
        close: () => resolve(dialogResult),
        buttons: {
            'Apply Import': function() {
                const mode = modeSelect.val();
                const operations = filterOperationsBySelection(utils.buildImportOperations(folders, parsed, mode));
                dialogResult = { mode, operations };
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

const applyImportOperations = async (type, operations) => {
    for (const id of operations.deletes) {
        await $.get(`/plugins/folderview.plus/server/delete.php?type=${type}&id=${encodeURIComponent(id)}`).promise();
    }

    for (const item of operations.upserts) {
        await $.post('/plugins/folderview.plus/server/update.php', {
            type,
            id: item.id,
            content: JSON.stringify(item.folder)
        }).promise();
    }

    for (const item of operations.creates) {
        await $.post('/plugins/folderview.plus/server/create.php', {
            type,
            content: JSON.stringify(item.folder)
        }).promise();
    }

    if (type === 'docker') {
        await syncDockerOrder();
    }
};

const offerUndoAction = async (type, backup, actionLabel) => {
    if (!backup || !backup.name) {
        return;
    }

    swal({
        title: `${actionLabel} complete`,
        text: `Backup created: ${backup.name}\nUndo this change now?`,
        type: 'success',
        showCancelButton: true,
        confirmButtonText: 'Undo now',
        cancelButtonText: 'Keep changes',
        closeOnConfirm: false,
        showLoaderOnConfirm: true
    }, async (shouldUndo) => {
        if (!shouldUndo) {
            return;
        }

        try {
            const restore = await restoreBackupByName(type, backup.name);
            await Promise.all([refreshType(type), refreshBackups(type)]);
            swal({
                title: 'Undo complete',
                text: `Restored ${restore.name}`,
                type: 'success'
            });
        } catch (error) {
            showError('Undo failed', error);
        }
    });
};

const buildRowsHtml = (type, folders) => {
    const rows = [];
    for (const [id, folder] of Object.entries(folders)) {
        const safeName = escapeHtml(folder.name);
        const safeIcon = escapeHtml(folder.icon || '');
        rows.push(
            `<tr data-folder-id="${escapeHtml(id)}">`
            + `<td><span class="row-order-actions"><button title="Move up" onclick="moveFolderRow('${type}','${escapeHtml(id)}',-1)"><i class="fa fa-chevron-up"></i></button><button title="Move down" onclick="moveFolderRow('${type}','${escapeHtml(id)}',1)"><i class="fa fa-chevron-down"></i></button></span></td>`
            + `<td>${escapeHtml(id)}</td>`
            + `<td class="name-cell"><span class="name-cell-content"><img src="${safeIcon}" class="img" onerror="this.src='/plugins/dynamix.docker.manager/images/question.png';"><span class="name-cell-text">${safeName}</span></span></td>`
            + `<td><button title="Export" onclick="${type === 'docker' ? 'downloadDocker' : 'downloadVm'}('${escapeHtml(id)}')"><i class="fa fa-download"></i></button> <button title="Delete" onclick="${type === 'docker' ? 'clearDocker' : 'clearVm'}('${escapeHtml(id)}')"><i class="fa fa-trash"></i></button></td>`
            + '</tr>'
        );
    }
    return rows.join('');
};

const currentOrderedIdsFromTable = (type) => {
    const tbodyId = tableIdByType[type];
    return $(`tbody#${tbodyId} tr[data-folder-id]`).map((_, row) => $(row).attr('data-folder-id')).get();
};

const persistManualOrderFromDom = async (type) => {
    const order = currentOrderedIdsFromTable(type);
    const reorderResponse = parseJsonResponse(await $.post('/plugins/folderview.plus/server/reorder.php', {
        type,
        order: JSON.stringify(order)
    }).promise());

    if (!reorderResponse.ok) {
        throw new Error(reorderResponse.error || 'Failed to persist folder order.');
    }

    const nextPrefs = utils.normalizePrefs({
        ...prefsByType[type],
        sortMode: 'manual',
        manualOrder: order
    });

    try {
        prefsByType[type] = await postPrefs(type, nextPrefs);
    } catch (error) {
        prefsByType[type] = nextPrefs;
    }

    await refreshType(type);
};

const moveFolderRow = async (type, folderId, direction) => {
    let sortMode = prefsByType[type]?.sortMode || 'created';
    if (sortMode !== 'manual') {
        await changeSortMode(type, 'manual');
        sortMode = 'manual';
    }

    if (sortMode !== 'manual') {
        return;
    }

    const tbodyId = tableIdByType[type];
    const tbody = $(`tbody#${tbodyId}`);
    const row = tbody.find(`tr[data-folder-id="${folderId}"]`);
    if (!row.length) {
        return;
    }

    if (direction < 0) {
        const prev = row.prev('tr[data-folder-id]');
        if (prev.length) {
            prev.before(row);
        }
    } else if (direction > 0) {
        const next = row.next('tr[data-folder-id]');
        if (next.length) {
            next.after(row);
        }
    }

    try {
        await persistManualOrderFromDom(type);
    } catch (error) {
        showError('Order save failed', error);
    }
};

const renderFolderSelectOptions = (type) => {
    const folders = getFolderMap(type);
    const entries = Object.entries(folders);
    const options = entries.map(([id, folder]) => `<option value="${escapeHtml(id)}">${escapeHtml(folder.name || id)}</option>`).join('');

    $(`#${type}-rule-folder`).html(options);
    $(`#${type}-bulk-folder`).html(options);
    $(`#${type}-template-source-folder`).html(options);
};

const renderBadgeToggles = (type) => {
    const badges = prefsByType[type]?.badges || {};
    $(`#${type}-badge-running`).prop('checked', badges.running !== false);
    $(`#${type}-badge-stopped`).prop('checked', badges.stopped === true);
    if (type === 'docker') {
        $('#docker-badge-updates').prop('checked', badges.updates !== false);
    }
};

const renderRuntimeControls = (type) => {
    const prefs = utils.normalizePrefs(prefsByType[type]);
    $(`#${type}-live-refresh-enabled`).prop('checked', prefs.liveRefreshEnabled !== false);
    $(`#${type}-live-refresh-seconds`).val(String(prefs.liveRefreshSeconds || 20));
    $(`#${type}-performance-mode`).prop('checked', prefs.performanceMode === true);
};

const renderBackupScheduleControls = (type) => {
    const prefs = utils.normalizePrefs(prefsByType[type]);
    const schedule = prefs.backupSchedule || {};
    $(`#${type}-backup-schedule-enabled`).prop('checked', schedule.enabled === true);
    $(`#${type}-backup-interval-hours`).val(String(schedule.intervalHours || 24));
    $(`#${type}-backup-retention`).val(String(schedule.retention || 25));
    const lastRunText = schedule.lastRunAt ? `Last scheduled run: ${formatTimestamp(schedule.lastRunAt)}` : 'Last scheduled run: never';
    $(`#${type}-backup-last-run`).text(lastRunText);
};

const ruleDescription = (rule) => {
    const effect = rule.effect === 'exclude' ? 'Exclude' : 'Include';
    if (rule.kind === 'label') {
        return `${effect} | Label equals: ${rule.labelKey || '(missing key)'}${rule.labelValue ? ` = ${rule.labelValue}` : ' (any value)'}`;
    }
    if (rule.kind === 'label_contains') {
        return `${effect} | Label contains: ${rule.labelKey || '(missing key)'} contains "${rule.labelValue || ''}"`;
    }
    if (rule.kind === 'label_starts_with') {
        return `${effect} | Label starts with: ${rule.labelKey || '(missing key)'} starts "${rule.labelValue || ''}"`;
    }
    if (rule.kind === 'image_regex') {
        return `${effect} | Image regex: ${rule.pattern || '(empty)'}`;
    }
    if (rule.kind === 'compose_project_regex') {
        return `${effect} | Compose project regex: ${rule.pattern || '(empty)'}`;
    }
    return `${effect} | Name regex: ${rule.pattern || '(empty)'}`;
};

const renderRulesTable = (type) => {
    const rulesBody = $(`#${type}-rules`);
    const rules = prefsByType[type]?.autoRules || [];

    if (!rules.length) {
        rulesBody.html('<tr><td colspan="4">No rules defined.</td></tr>');
        return;
    }

    const rows = rules.map((rule, index) => {
        const folderName = folderNameForId(type, rule.folderId);
        const stateLabel = rule.enabled ? 'Disable' : 'Enable';
        const stateIcon = rule.enabled ? 'fa-eye-slash' : 'fa-eye';
        const upDisabled = index === 0 ? 'disabled' : '';
        const downDisabled = index === rules.length - 1 ? 'disabled' : '';

        return `<tr>
            <td>
                <span>#${index + 1}</span>
                <span class="rule-priority-actions">
                    <button ${upDisabled} title="Move up" onclick="moveAutoRule('${type}','${escapeHtml(rule.id)}',-1)"><i class="fa fa-chevron-up"></i></button>
                    <button ${downDisabled} title="Move down" onclick="moveAutoRule('${type}','${escapeHtml(rule.id)}',1)"><i class="fa fa-chevron-down"></i></button>
                </span>
            </td>
            <td>${escapeHtml(folderName)}</td>
            <td>${escapeHtml(ruleDescription(rule))}</td>
            <td>
                <button onclick="toggleAutoRule('${type}','${escapeHtml(rule.id)}')"><i class="fa ${stateIcon}"></i> ${stateLabel}</button>
                <button onclick="deleteAutoRule('${type}','${escapeHtml(rule.id)}')"><i class="fa fa-trash"></i> Delete</button>
            </td>
        </tr>`;
    });

    rulesBody.html(rows.join(''));
};

const renderBulkItemOptions = (type) => {
    const infoByName = infoByType[type] || {};
    const names = Object.keys(infoByName).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
    const options = names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
    $(`#${type}-bulk-items`).html(options);
};

const renderBackupRows = (type) => {
    const rowsEl = $(`#${type}-backups`);
    const backups = backupsByType[type] || [];
    if (!backups.length) {
        rowsEl.html('<tr><td colspan="4">No backups found.</td></tr>');
        return;
    }

    const rows = backups.map((backup) => {
        const name = String(backup.name || '');
        const count = Number.isFinite(Number(backup.count)) ? Number(backup.count) : '-';
        const reason = backup.reason ? escapeHtml(backup.reason) : '-';
        return `<tr>
            <td>${escapeHtml(formatTimestamp(backup.createdAt))}</td>
            <td>${reason}</td>
            <td>${count}</td>
            <td>
                <button onclick="restoreBackupEntry('${type}','${escapeHtml(name)}')"><i class="fa fa-history"></i> Restore</button>
                <button onclick="downloadBackupEntry('${type}','${escapeHtml(name)}')"><i class="fa fa-download"></i> Download</button>
                <button onclick="deleteBackupEntry('${type}','${escapeHtml(name)}')"><i class="fa fa-trash"></i> Delete</button>
            </td>
        </tr>`;
    });

    rowsEl.html(rows.join(''));
};

const renderTemplateRows = (type) => {
    const rowsEl = $(`#${type}-templates`);
    const templates = templatesByType[type] || [];
    const folders = getFolderMap(type);
    const folderOptions = Object.entries(folders).map(([id, folder]) => (
        `<option value="${escapeHtml(id)}">${escapeHtml(folder.name || id)}</option>`
    )).join('');

    if (!templates.length) {
        rowsEl.html('<tr><td colspan="3">No templates saved.</td></tr>');
        return;
    }

    const rows = templates.map((template) => {
        const templateId = String(template.id || '');
        const templateName = String(template.name || templateId);
        const selectId = `${type}-template-target-${templateId}`;
        return `<tr>
            <td>${escapeHtml(templateName)}</td>
            <td>${escapeHtml(formatTimestamp(template.updatedAt || template.createdAt))}</td>
            <td>
                <select id="${escapeHtml(selectId)}">${folderOptions}</select>
                <button onclick="applyTemplateToFolder('${type}','${escapeHtml(templateId)}','${escapeHtml(selectId)}')"><i class="fa fa-clone"></i> Apply</button>
                <button onclick="deleteTemplateEntry('${type}','${escapeHtml(templateId)}')"><i class="fa fa-trash"></i> Delete</button>
            </td>
        </tr>`;
    });
    rowsEl.html(rows.join(''));
};

const renderTable = (type) => {
    const folders = getFolderMap(type);
    const ordered = utils.orderFoldersByPrefs(folders, prefsByType[type]);
    setTypeFolders(type, ordered);

    const sortMode = prefsByType[type]?.sortMode || 'created';
    $(`#${type}-sort-mode`).val(sortMode);
    const tbodyId = tableIdByType[type];
    $(`tbody#${tbodyId}`).html(buildRowsHtml(type, ordered));

    renderFolderSelectOptions(type);
    renderBadgeToggles(type);
    renderRuntimeControls(type);
    renderBackupScheduleControls(type);
    renderRulesTable(type);
    renderBulkItemOptions(type);
    renderTemplateRows(type);
};

const refreshType = async (type) => {
    const [folders, prefs, info] = await Promise.all([
        fetchFolders(type),
        fetchPrefs(type),
        fetchTypeInfo(type).catch(() => ({}))
    ]);

    prefsByType[type] = utils.normalizePrefs(prefs || {});
    infoByType[type] = info && typeof info === 'object' ? info : {};
    setTypeFolders(type, folders);
    renderTable(type);
};

const refreshBackups = async (type) => {
    try {
        backupsByType[type] = await fetchBackups(type);
    } catch (error) {
        backupsByType[type] = [];
        showError(`Failed to load ${type.toUpperCase()} backups`, error);
    }
    renderBackupRows(type);
    renderBackupScheduleControls(type);
};

const refreshTemplates = async (type) => {
    try {
        templatesByType[type] = await fetchTemplates(type);
    } catch (error) {
        templatesByType[type] = [];
        showError(`Failed to load ${type.toUpperCase()} templates`, error);
    }
    renderTemplateRows(type);
};

const refreshAll = async () => {
    await Promise.all([refreshType('docker'), refreshType('vm')]);
    await Promise.all([refreshBackups('docker'), refreshBackups('vm')]);
    await Promise.all([refreshTemplates('docker'), refreshTemplates('vm')]);
    toggleRuleKindFields('docker');
};

const downloadType = (type, id) => {
    const folders = getFolderMap(type);

    if (id) {
        const folder = folders[id];
        if (!folder) {
            return;
        }
        const payload = utils.buildSingleExportPayload({
            type,
            folderId: id,
            folder,
            pluginVersion
        });
        downloadFile(`${folder.name}.json`, toPrettyJson(payload));
        trackDiagnosticsEvent({
            eventType: 'export',
            type,
            details: {
                mode: 'single',
                folderCount: 1,
                schemaVersion: utils.EXPORT_SCHEMA_VERSION
            }
        });
        return;
    }

    const payload = utils.buildFullExportPayload({
        type,
        folders,
        pluginVersion
    });

    const name = type === 'docker' ? `${EXPORT_BASENAME}.json` : `${EXPORT_BASENAME} VM.json`;
    downloadFile(name, toPrettyJson(payload));
    trackDiagnosticsEvent({
        eventType: 'export',
        type,
        details: {
            mode: 'full',
            folderCount: Object.keys(folders).length,
            schemaVersion: utils.EXPORT_SCHEMA_VERSION
        }
    });
};
const importType = async (type) => {
    let selected;
    try {
        selected = await selectJsonFile();
    } catch (error) {
        showError('Error', error);
        return;
    }

    if (!selected) {
        return;
    }

    let parsedFile;
    try {
        parsedFile = JSON.parse(selected.text);
    } catch (error) {
        swal({
            title: 'Error',
            text: 'Error parsing the input file, please select a valid JSON file.',
            type: 'error'
        });
        return;
    }

    const parsed = utils.parseImportPayload(parsedFile, type);
    if (!parsed.ok) {
        swal({
            title: 'Error',
            text: parsed.error || 'Invalid import format.',
            type: 'error'
        });
        return;
    }

    const dialogResult = await showImportPreviewDialog(type, parsed);
    if (!dialogResult) {
        return;
    }

    const operations = dialogResult.operations;
    if (!operations || countImportOperations(operations) === 0) {
        swal({
            title: 'No changes selected',
            text: 'Nothing was selected to import.',
            type: 'info'
        });
        return;
    }

    let transactionBackup = null;
    try {
        transactionBackup = await createBackup(type, `before-import-transaction-${dialogResult.mode}`);
        await applyImportOperations(type, operations);
        await Promise.all([refreshType(type), refreshBackups(type)]);
        await trackDiagnosticsEvent({
            eventType: 'import',
            type,
            details: {
                mode: dialogResult.mode,
                creates: operations.creates.length,
                updates: operations.upserts.length,
                deletes: operations.deletes.length
            }
        });
        await offerUndoAction(type, transactionBackup, 'Import');
    } catch (error) {
        let rollbackMessage = 'No rollback backup available.';
        if (transactionBackup && transactionBackup.name) {
            try {
                await restoreBackupByName(type, transactionBackup.name);
                await Promise.all([refreshType(type), refreshBackups(type)]);
                rollbackMessage = `Automatic rollback restored backup: ${transactionBackup.name}`;
            } catch (rollbackError) {
                rollbackMessage = `Rollback failed: ${rollbackError?.message || rollbackError}`;
            }
        }
        showError('Import failed', new Error(`${error?.message || error}\n${rollbackMessage}`));
    }
};

const clearType = (type, id) => {
    const folders = getFolderMap(type);
    const folderName = id ? folders[id]?.name : null;
    const text = id ? `Remove folder: ${folderName || id}` : 'Remove ALL folders';

    swal({
        title: 'Are you sure?',
        text,
        type: 'warning',
        html: true,
        showCancelButton: true,
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel',
        showLoaderOnConfirm: true
    }, async (confirmed) => {
        if (!confirmed) {
            return;
        }

        try {
            const backup = await createBackup(type, id ? `before-delete-${id}` : 'before-clear-all');

            if (id) {
                await $.get(`/plugins/folderview.plus/server/delete.php?type=${type}&id=${encodeURIComponent(id)}`).promise();
            } else {
                for (const currentId of Object.keys(folders)) {
                    await $.get(`/plugins/folderview.plus/server/delete.php?type=${type}&id=${encodeURIComponent(currentId)}`).promise();
                }
            }

            if (type === 'docker') {
                await syncDockerOrder();
            }

            await Promise.all([refreshType(type), refreshBackups(type)]);
            await trackDiagnosticsEvent({
                eventType: id ? 'delete_folder' : 'clear_folders',
                type,
                details: {
                    deletedCount: id ? 1 : Object.keys(folders).length,
                    singleFolder: Boolean(id)
                }
            });
            await offerUndoAction(type, backup, id ? 'Delete folder' : 'Clear folders');
        } catch (error) {
            showError('Delete failed', error);
        }
    });
};

const changeSortMode = async (type, mode) => {
    const current = utils.normalizePrefs(prefsByType[type]);
    const next = {
        ...current,
        sortMode: mode
    };

    if (mode === 'manual' && (!Array.isArray(next.manualOrder) || next.manualOrder.length === 0)) {
        next.manualOrder = Object.keys(getFolderMap(type));
    }

    try {
        prefsByType[type] = await postPrefs(type, next);
        await refreshType(type);
    } catch (error) {
        showError('Sort mode save failed', error);
    }
};

const changeBadgePref = async (type, badgeKey, checked) => {
    const current = utils.normalizePrefs(prefsByType[type]);
    const next = {
        ...current,
        badges: {
            ...current.badges,
            [badgeKey]: Boolean(checked)
        }
    };

    try {
        prefsByType[type] = await postPrefs(type, next);
        renderBadgeToggles(type);
    } catch (error) {
        showError('Badge preferences save failed', error);
    }
};

const changeRuntimePref = async (type, key, value) => {
    const current = utils.normalizePrefs(prefsByType[type]);
    const next = {
        ...current
    };
    if (key === 'liveRefreshEnabled') {
        next.liveRefreshEnabled = value === true;
    } else if (key === 'liveRefreshSeconds') {
        const parsed = Number(value);
        next.liveRefreshSeconds = Number.isFinite(parsed) ? Math.min(300, Math.max(10, Math.round(parsed))) : current.liveRefreshSeconds;
    } else if (key === 'performanceMode') {
        next.performanceMode = value === true;
    } else {
        return;
    }

    try {
        prefsByType[type] = await postPrefs(type, next);
        renderRuntimeControls(type);
    } catch (error) {
        showError('Runtime preference save failed', error);
    }
};

const changeBackupSchedulePref = async (type, key, value) => {
    const current = utils.normalizePrefs(prefsByType[type]);
    const schedule = {
        ...(current.backupSchedule || {})
    };

    if (key === 'enabled') {
        schedule.enabled = value === true;
    } else if (key === 'intervalHours') {
        const parsed = Number(value);
        schedule.intervalHours = Number.isFinite(parsed) ? Math.min(168, Math.max(1, Math.round(parsed))) : schedule.intervalHours || 24;
    } else if (key === 'retention') {
        const parsed = Number(value);
        schedule.retention = Number.isFinite(parsed) ? Math.min(200, Math.max(1, Math.round(parsed))) : schedule.retention || 25;
    } else {
        return;
    }

    try {
        prefsByType[type] = await postPrefs(type, {
            ...current,
            backupSchedule: schedule
        });
        renderBackupScheduleControls(type);
    } catch (error) {
        showError('Backup schedule save failed', error);
    }
};

const addAutoRule = async (type) => {
    const folderId = String($(`#${type}-rule-folder`).val() || '');
    const effect = String($(`#${type}-rule-effect`).val() || 'include');
    const kind = String($(`#${type}-rule-kind`).val() || 'name_regex');
    const pattern = String($(`#${type}-rule-pattern`).val() || '').trim();
    const labelKey = String($(`#${type}-rule-label-key`).val() || '').trim();
    const labelValue = String($(`#${type}-rule-label-value`).val() || '').trim();
    const regexKinds = ['name_regex', 'image_regex', 'compose_project_regex'];
    const labelKinds = ['label', 'label_contains', 'label_starts_with'];

    if (!folderId) {
        swal({ title: 'Error', text: 'Select a folder before adding a rule.', type: 'error' });
        return;
    }

    if (regexKinds.includes(kind)) {
        if (!pattern) {
            swal({ title: 'Error', text: 'Regex pattern cannot be empty.', type: 'error' });
            return;
        }
        try {
            new RegExp(pattern);
        } catch (error) {
            swal({ title: 'Error', text: `Invalid regex: ${error.message}`, type: 'error' });
            return;
        }
    }

    if (labelKinds.includes(kind) && !labelKey) {
        swal({ title: 'Error', text: 'Label key cannot be empty for label rules.', type: 'error' });
        return;
    }
    if ((kind === 'label_contains' || kind === 'label_starts_with') && !labelValue) {
        swal({ title: 'Error', text: 'Label value cannot be empty for contains/starts-with rules.', type: 'error' });
        return;
    }

    const nextRule = {
        id: `rule-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        enabled: true,
        folderId,
        effect: effect === 'exclude' ? 'exclude' : 'include',
        kind,
        pattern: regexKinds.includes(kind) ? pattern : '',
        labelKey: labelKinds.includes(kind) ? labelKey : '',
        labelValue: labelKinds.includes(kind) ? labelValue : ''
    };

    try {
        const nextPrefs = utils.normalizePrefs({
            ...prefsByType[type],
            autoRules: [...(prefsByType[type].autoRules || []), nextRule]
        });
        prefsByType[type] = await postPrefs(type, nextPrefs);

        $(`#${type}-rule-pattern`).val('');
        $(`#${type}-rule-label-key`).val('');
        $(`#${type}-rule-label-value`).val('');
        $(`#${type}-rule-effect`).val('include');
        renderRulesTable(type);
    } catch (error) {
        showError('Rule save failed', error);
    }
};

const toggleAutoRule = async (type, ruleId) => {
    const rules = [...(prefsByType[type].autoRules || [])];
    const index = rules.findIndex((rule) => rule.id === ruleId);
    if (index === -1) {
        return;
    }

    rules[index] = {
        ...rules[index],
        enabled: !rules[index].enabled
    };

    try {
        prefsByType[type] = await postPrefs(type, {
            ...prefsByType[type],
            autoRules: rules
        });
        renderRulesTable(type);
    } catch (error) {
        showError('Rule update failed', error);
    }
};

const deleteAutoRule = async (type, ruleId) => {
    const rules = (prefsByType[type].autoRules || []).filter((rule) => rule.id !== ruleId);
    try {
        prefsByType[type] = await postPrefs(type, {
            ...prefsByType[type],
            autoRules: rules
        });
        renderRulesTable(type);
    } catch (error) {
        showError('Rule delete failed', error);
    }
};

const moveAutoRule = async (type, ruleId, direction) => {
    const rules = [...(prefsByType[type].autoRules || [])];
    const index = rules.findIndex((rule) => rule.id === ruleId);
    if (index === -1) {
        return;
    }

    const newIndex = direction < 0 ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= rules.length) {
        return;
    }

    const [moved] = rules.splice(index, 1);
    rules.splice(newIndex, 0, moved);

    try {
        prefsByType[type] = await postPrefs(type, {
            ...prefsByType[type],
            autoRules: rules
        });
        renderRulesTable(type);
    } catch (error) {
        showError('Rule reorder failed', error);
    }
};

const toggleRuleKindFields = (type) => {
    if (type !== 'docker') {
        return;
    }

    const kind = String($('#docker-rule-kind').val() || 'name_regex');
    const regexKinds = ['name_regex', 'image_regex', 'compose_project_regex'];
    const labelKinds = ['label', 'label_contains', 'label_starts_with'];
    $('#docker-rule-pattern').attr('placeholder', kind === 'image_regex'
        ? 'Regex pattern (example: linuxserver/)'
        : kind === 'compose_project_regex'
            ? 'Regex pattern (example: ^media$)'
            : 'Regex pattern (example: ^media-)');
    $('#docker-rule-pattern').toggle(regexKinds.includes(kind));
    $('#docker-rule-label-key').toggle(labelKinds.includes(kind));
    $('#docker-rule-label-value').toggle(labelKinds.includes(kind));
};

const testAutoRule = (type) => {
    const rules = prefsByType[type]?.autoRules || [];
    const output = $(`#${type}-rule-test-output`);

    const testName = String($(`#${type}-rule-test-name`).val() || '').trim();
    if (!testName) {
        output.text('Enter a test name first.');
        return;
    }

    const info = {
        ...(infoByType[type] || {})
    };

    if (type === 'docker') {
        const key = String($('#docker-rule-test-label-key').val() || '').trim();
        const value = String($('#docker-rule-test-label-value').val() || '').trim();
        const image = String($('#docker-rule-test-image').val() || '').trim();
        const compose = String($('#docker-rule-test-compose').val() || '').trim();
        if (key) {
            const existing = info[testName] || {};
            const existingLabels = existing.Labels || existing.info?.Config?.Labels || {};
            info[testName] = {
                ...existing,
                Labels: {
                    ...existingLabels,
                    [key]: value || '1'
                }
            };
        }
        if (image) {
            const existing = info[testName] || {};
            info[testName] = {
                ...existing,
                info: {
                    ...(existing.info || {}),
                    Config: {
                        ...((existing.info || {}).Config || {}),
                        Image: image,
                        Labels: {
                            ...(((existing.info || {}).Config || {}).Labels || existing.Labels || {}),
                            ...(compose ? { 'com.docker.compose.project': compose } : {})
                        }
                    }
                }
            };
        } else if (compose) {
            const existing = info[testName] || {};
            const existingLabels = existing.Labels || existing.info?.Config?.Labels || {};
            info[testName] = {
                ...existing,
                Labels: {
                    ...existingLabels,
                    'com.docker.compose.project': compose
                }
            };
        }
    }

    const decision = utils.getAutoRuleDecision({
        rules,
        name: testName,
        infoByName: info,
        type
    });
    const firstMatch = decision.assignedRule;

    if (decision.blockedBy) {
        const blockedPriority = rules.findIndex((rule) => rule.id === decision.blockedBy.id) + 1;
        output.text(`Blocked by exclude rule #${blockedPriority}: ${ruleDescription(decision.blockedBy)}`);
        return;
    }

    if (!firstMatch) {
        output.text('No matching rule. This item would remain unassigned.');
        return;
    }

    const priority = rules.findIndex((rule) => rule.id === firstMatch.id) + 1;
    output.text(`Matched priority #${priority}: ${folderNameForId(type, firstMatch.folderId)} (${ruleDescription(firstMatch)})`);
};

const assignSelectedItems = async (type) => {
    const folderId = String($(`#${type}-bulk-folder`).val() || '');
    const selected = ($(`#${type}-bulk-items`).val() || []).map((name) => String(name));

    if (!folderId) {
        swal({ title: 'Error', text: 'Select a folder for bulk assignment.', type: 'error' });
        return;
    }

    if (!selected.length) {
        swal({ title: 'Error', text: 'Select at least one item to assign.', type: 'error' });
        return;
    }

    try {
        const backup = await createBackup(type, 'before-bulk-assign');
        await bulkAssign(type, folderId, selected);
        await Promise.all([refreshType(type), refreshBackups(type)]);
        await trackDiagnosticsEvent({
            eventType: 'bulk_assign',
            type,
            details: {
                folderId,
                itemCount: selected.length
            }
        });
        await offerUndoAction(type, backup, 'Bulk assignment');
    } catch (error) {
        showError('Bulk assignment failed', error);
    }
};
const createManualBackup = async (type) => {
    try {
        const backup = await createBackup(type, 'manual');
        await refreshBackups(type);
        swal({
            title: 'Backup created',
            text: backup.name,
            type: 'success'
        });
    } catch (error) {
        showError('Backup failed', error);
    }
};

const restoreBackupEntry = (type, name) => {
    swal({
        title: 'Restore this backup?',
        text: `This will overwrite current ${type} folders.`,
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Restore',
        cancelButtonText: 'Cancel',
        showLoaderOnConfirm: true
    }, async (confirmed) => {
        if (!confirmed) {
            return;
        }

        try {
            const undoBackup = await createBackup(type, `before-restore-${name}`);
            await restoreBackupByName(type, name);
            await Promise.all([refreshType(type), refreshBackups(type)]);
            await offerUndoAction(type, undoBackup, 'Backup restore');
        } catch (error) {
            showError('Restore failed', error);
        }
    });
};

const restoreLatestBackup = (type) => {
    swal({
        title: 'Restore latest backup?',
        text: `This will overwrite current ${type} folders with the latest backup snapshot.`,
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Restore',
        cancelButtonText: 'Cancel',
        showLoaderOnConfirm: true
    }, async (confirmed) => {
        if (!confirmed) {
            return;
        }

        try {
            const undoBackup = await createBackup(type, 'before-restore-latest');
            await restoreLatest(type);
            await Promise.all([refreshType(type), refreshBackups(type)]);
            await offerUndoAction(type, undoBackup, 'Restore latest backup');
        } catch (error) {
            showError('Restore failed', error);
        }
    });
};

const downloadBackupEntry = (type, name) => {
    const url = `/plugins/folderview.plus/server/backup.php?type=${encodeURIComponent(type)}&action=download&name=${encodeURIComponent(name)}`;
    const link = document.createElement('a');
    link.href = url;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const deleteBackupEntry = (type, name) => {
    swal({
        title: 'Delete backup?',
        text: `Delete ${name}? This cannot be undone.`,
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel',
        showLoaderOnConfirm: true
    }, async (confirmed) => {
        if (!confirmed) {
            return;
        }

        try {
            backupsByType[type] = await deleteBackupByName(type, name);
            renderBackupRows(type);
        } catch (error) {
            showError('Delete failed', error);
        }
    });
};

const createTemplateFromFolder = async (type) => {
    const folderId = String($(`#${type}-template-source-folder`).val() || '');
    const templateName = String($(`#${type}-template-name`).val() || '').trim();
    if (!folderId) {
        swal({ title: 'Error', text: 'Select a source folder first.', type: 'error' });
        return;
    }
    if (!templateName) {
        swal({ title: 'Error', text: 'Enter a template name.', type: 'error' });
        return;
    }
    try {
        templatesByType[type] = await createTemplate(type, folderId, templateName);
        $(`#${type}-template-name`).val('');
        renderTemplateRows(type);
        swal({ title: 'Template saved', text: 'Template created successfully.', type: 'success' });
    } catch (error) {
        showError('Template create failed', error);
    }
};

const applyTemplateToFolder = (type, templateId, selectId) => {
    const folderId = String($(`#${selectId}`).val() || '');
    if (!folderId) {
        swal({ title: 'Error', text: 'Select a target folder.', type: 'error' });
        return;
    }
    swal({
        title: 'Apply template?',
        text: 'This overwrites icon/settings/actions/regex on the target folder.',
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
            const backup = await createBackup(type, 'before-template-apply');
            await applyTemplate(type, templateId, folderId);
            await Promise.all([refreshType(type), refreshBackups(type)]);
            await offerUndoAction(type, backup, 'Template apply');
        } catch (error) {
            showError('Template apply failed', error);
        }
    });
};

const deleteTemplateEntry = (type, templateId) => {
    swal({
        title: 'Delete template?',
        text: 'This cannot be undone.',
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel',
        showLoaderOnConfirm: true
    }, async (confirmed) => {
        if (!confirmed) {
            return;
        }
        try {
            templatesByType[type] = await deleteTemplate(type, templateId);
            renderTemplateRows(type);
        } catch (error) {
            showError('Template delete failed', error);
        }
    });
};

const renderDiagnostics = (diagnostics) => {
    lastDiagnostics = diagnostics || null;
    if (!diagnostics) {
        $('#diagnostics-output').text('No diagnostics data.');
        return;
    }
    $('#diagnostics-output').text(toPrettyJson(diagnostics));
};

const runDiagnostics = async () => {
    try {
        const diagnostics = await getDiagnostics();
        renderDiagnostics(diagnostics);
    } catch (error) {
        showError('Diagnostics failed', error);
    }
};

const repairDiagnostics = async (action) => {
    try {
        const diagnostics = await runDiagnosticAction(action);
        renderDiagnostics(diagnostics);
        swal({
            title: 'Repair complete',
            text: 'Repair action finished successfully.',
            type: 'success'
        });
        await Promise.all([refreshType('docker'), refreshType('vm'), refreshBackups('docker'), refreshBackups('vm')]);
    } catch (error) {
        showError('Repair failed', error);
    }
};

const exportDiagnosticsByMode = async (privacy = 'sanitized') => {
    const mode = privacy === 'full' ? 'full' : 'sanitized';
    let diagnostics = null;

    const cachedMode = (lastDiagnostics?.privacyMode || 'sanitized');
    if (lastDiagnostics && cachedMode === mode) {
        diagnostics = lastDiagnostics;
    }

    if (!diagnostics) {
        try {
            diagnostics = await getDiagnostics(mode);
            renderDiagnostics(diagnostics);
        } catch (error) {
            if (lastDiagnostics) {
                diagnostics = lastDiagnostics;
            } else {
                diagnostics = {
                    schemaVersion: 2,
                    privacyMode: mode,
                    checkedAt: new Date().toISOString(),
                    error: error?.message || String(error)
                };
            }
        }
    }

    downloadFile('FolderView Plus Diagnostics.json', toPrettyJson(diagnostics || {}));
    trackDiagnosticsEvent({
        eventType: 'diagnostics_export',
        details: {
            privacyMode: mode,
            schemaVersion: diagnostics?.schemaVersion || null
        }
    });
};

const exportDiagnostics = () => {
    swal({
        title: 'Export diagnostics',
        text: 'Choose export mode.\nFull includes all details. Sanitized redacts sensitive fields.',
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Full export',
        cancelButtonText: 'Sanitized export',
        closeOnConfirm: true,
        closeOnCancel: true
    }, (useFull) => {
        void exportDiagnosticsByMode(useFull ? 'full' : 'sanitized');
    });
};

const exportSupportBundleByMode = async (privacy = 'sanitized') => {
    const mode = privacy === 'full' ? 'full' : 'sanitized';
    try {
        const bundle = await getSupportBundle(mode);
        const generatedAt = String(bundle.generatedAt || '').replace(/[:]/g, '-');
        const suffix = generatedAt ? `-${generatedAt}` : '';
        downloadFile(`FolderView Plus Support Bundle${suffix}.json`, toPrettyJson(bundle));
        await trackDiagnosticsEvent({
            eventType: 'support_bundle_export',
            details: {
                privacyMode: mode,
                bundleVersion: bundle?.bundleVersion || null
            }
        });
    } catch (error) {
        showError('Support bundle export failed', error);
    }
};

const exportSupportBundle = () => {
    swal({
        title: 'Export support bundle',
        text: 'Choose export mode.\nFull includes all details. Sanitized redacts sensitive fields.',
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Full export',
        cancelButtonText: 'Sanitized export',
        closeOnConfirm: true,
        closeOnCancel: true
    }, (useFull) => {
        void exportSupportBundleByMode(useFull ? 'full' : 'sanitized');
    });
};

const runConflictInspector = async (type) => {
    const resolvedType = type === 'vm' ? 'vm' : 'docker';
    const folders = getFolderMap(resolvedType);
    const prefs = prefsByType[resolvedType] || utils.normalizePrefs({});
    const info = infoByType[resolvedType] || {};

    const report = utils.getConflictReport({
        type: resolvedType,
        folders,
        prefs,
        infoByName: info
    });

    const conflicts = report.rows.filter((row) => row.hasConflict);
    const blocked = report.rows.filter((row) => row.blockedByRule);
    const output = {
        type: resolvedType,
        scannedAt: new Date().toISOString(),
        summary: {
            totalItems: report.totalItems,
            conflictingItems: report.conflictingItems,
            blockedByExcludeRules: blocked.length
        },
        conflictingRows: conflicts,
        blockedRows: blocked
    };

    $('#conflict-output').text(toPrettyJson(output));
    await trackDiagnosticsEvent({
        eventType: 'conflict_scan',
        type: resolvedType,
        details: {
            totalItems: report.totalItems,
            conflictingItems: report.conflictingItems,
            blockedByExcludeRules: blocked.length
        }
    });
};

const checkForUpdatesNow = async () => {
    setUpdateStatus('Checking for updates...');

    try {
        const response = await apiGetJson('/plugins/folderview.plus/server/update_check.php');
        if (!response.ok) {
            setUpdateStatus('Update check failed.');
            swal({
                title: 'Update check failed',
                text: response.error || 'Unable to check for updates right now.',
                type: 'error'
            });
            return;
        }

        const message = response.updateAvailable
            ? `Update available: ${response.currentVersion} -> ${response.remoteVersion}`
            : `Up to date: ${response.currentVersion}`;

        setUpdateStatus(`${message} (checked ${response.checkedAt})`);
        swal({
            title: response.updateAvailable ? 'Update available' : 'No update available',
            text: `${message}\nSource: ${response.manifestUrl}`,
            type: response.updateAvailable ? 'warning' : 'success'
        });
    } catch (error) {
        setUpdateStatus('Update check failed.');
        showError('Update check failed', error);
    }
};

const fileManager = () => {
    location.href = `${location.pathname}/Browse?dir=/boot/config/plugins/folderview.plus`;
};

const downloadDocker = (id) => downloadType('docker', id);
const downloadVm = (id) => downloadType('vm', id);
const importDocker = () => importType('docker');
const importVm = () => importType('vm');
const clearDocker = (id) => clearType('docker', id);
const clearVm = (id) => clearType('vm', id);

window.downloadDocker = downloadDocker;
window.downloadVm = downloadVm;
window.importDocker = importDocker;
window.importVm = importVm;
window.clearDocker = clearDocker;
window.clearVm = clearVm;
window.fileManager = fileManager;
window.changeSortMode = changeSortMode;
window.changeBadgePref = changeBadgePref;
window.changeRuntimePref = changeRuntimePref;
window.changeBackupSchedulePref = changeBackupSchedulePref;
window.addAutoRule = addAutoRule;
window.toggleAutoRule = toggleAutoRule;
window.deleteAutoRule = deleteAutoRule;
window.moveAutoRule = moveAutoRule;
window.toggleRuleKindFields = toggleRuleKindFields;
window.testAutoRule = testAutoRule;
window.assignSelectedItems = assignSelectedItems;
window.createManualBackup = createManualBackup;
window.refreshBackups = refreshBackups;
window.restoreLatestBackup = restoreLatestBackup;
window.restoreBackupEntry = restoreBackupEntry;
window.downloadBackupEntry = downloadBackupEntry;
window.deleteBackupEntry = deleteBackupEntry;
window.createTemplateFromFolder = createTemplateFromFolder;
window.applyTemplateToFolder = applyTemplateToFolder;
window.deleteTemplateEntry = deleteTemplateEntry;
window.runDiagnostics = runDiagnostics;
window.repairDiagnostics = repairDiagnostics;
window.exportDiagnostics = exportDiagnostics;
window.exportSupportBundle = exportSupportBundle;
window.runConflictInspector = runConflictInspector;
window.checkForUpdatesNow = checkForUpdatesNow;
window.moveFolderRow = moveFolderRow;

(async () => {
    try {
        await fetchPluginVersion();
        await refreshAll();
    } catch (error) {
        showError('Initialization failed', error);
    }
})();
