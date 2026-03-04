const utils = window.FolderViewPlusUtils;
const EXPORT_BASENAME = 'FolderView Plus Export';

let dockers = {};
let vms = {};
let pluginVersion = '0.0.0';
let prefsByType = {
    docker: utils.normalizePrefs({}),
    vm: utils.normalizePrefs({})
};

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
        throw new Error(response.error || 'Failed to save preferences');
    }
    return utils.normalizePrefs(response.prefs || prefs);
};

const createBackup = async (type, reason) => {
    const response = parseJsonResponse(await $.post('/plugins/folderview.plus/server/backup.php', { type, action: 'create', reason }).promise());
    if (!response.ok) {
        throw new Error(response.error || 'Backup failed.');
    }
    return response.backup;
};

const restoreLatest = async (type) => {
    const response = parseJsonResponse(await $.post('/plugins/folderview.plus/server/backup.php', { type, action: 'restore_latest' }).promise());
    if (!response.ok) {
        throw new Error(response.error || 'Restore failed.');
    }
    return response.restore;
};

const syncDockerOrder = async () => {
    await $.post('/plugins/folderview.plus/server/sync_order.php', { type: 'docker' }).promise();
};

const setUpdateStatus = (text) => {
    $('#update-check-status').text(text);
};

const readFileAsText = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsText(file, 'UTF-8');
});

const selectJsonFile = () => new Promise((resolve) => {
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
        const text = await readFileAsText(file);
        resolve({ name: file.name, text });
    };
    document.body.appendChild(input);
    input.click();
});

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

const showImportPreviewDialog = (type, parsed) => new Promise((resolve) => {
    const dialog = $('#import-preview-dialog');
    const modeSelect = $('#import-mode-select');
    const previewText = $('#import-preview-text');
    const meta = $('#import-preview-meta');
    const folders = getFolderMap(type);

    const renderPreview = () => {
        const mode = modeSelect.val();
        const summary = utils.summarizeImport(folders, parsed, mode);
        previewText.val(formatImportSummary(summary));
        const metaParts = [
            `Type: ${type}`,
            `Mode: ${parsed.mode}${parsed.legacy ? ' (legacy format)' : ''}`,
            parsed.schemaVersion !== null ? `Schema: v${parsed.schemaVersion}` : 'Schema: legacy',
            parsed.pluginVersion ? `Plugin: ${parsed.pluginVersion}` : null,
            parsed.exportedAt ? `Exported: ${parsed.exportedAt}` : null
        ].filter(Boolean);
        meta.text(metaParts.join(' | '));
        return summary;
    };

    modeSelect.off('change.fvimport').on('change.fvimport', () => renderPreview());
    modeSelect.val('merge');
    renderPreview();

    dialog.dialog({
        title: `Import ${type === 'docker' ? 'Docker' : 'VM'} Folders`,
        resizable: false,
        width: 760,
        modal: true,
        show: { effect: 'fade', duration: 120 },
        hide: { effect: 'fade', duration: 120 },
        close: () => resolve(null),
        buttons: {
            'Apply Import': function() {
                const mode = modeSelect.val();
                const summary = renderPreview();
                $(this).dialog('close');
                resolve({ mode, summary });
            },
            Cancel: function() {
                $(this).dialog('close');
                resolve(null);
            }
        }
    });
});

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

const importType = async (type) => {
    let selected;
    try {
        selected = await selectJsonFile();
    } catch (error) {
        swal({
            title: 'Error',
            text: error.message || 'Unable to open selected file.',
            type: 'error',
        });
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
            type: 'error',
        });
        return;
    }

    const parsed = utils.parseImportPayload(parsedFile, type);
    if (!parsed.ok) {
        swal({
            title: 'Error',
            text: parsed.error || 'Invalid import format.',
            type: 'error',
        });
        return;
    }

    const dialogResult = await showImportPreviewDialog(type, parsed);
    if (!dialogResult) {
        return;
    }

    try {
        const backup = await createBackup(type, `before-import-${dialogResult.mode}`);
        const operations = utils.buildImportOperations(getFolderMap(type), parsed, dialogResult.mode);
        await applyImportOperations(type, operations);
        await refreshType(type);
        swal({
            title: 'Import complete',
            text: `Applied import in ${dialogResult.mode} mode. Backup created: ${backup.name}`,
            type: 'success',
        });
    } catch (error) {
        swal({
            title: 'Import failed',
            text: error.message || String(error),
            type: 'error',
        });
    }
};

const buildRowsHtml = (type, folders, manualMode) => {
    const rows = [];
    for (const [id, folder] of Object.entries(folders)) {
        const safeName = escapeHtml(folder.name);
        const safeIcon = escapeHtml(folder.icon || '');
        const orderControls = `<span class="row-order-actions"><button title="Move up" onclick="moveFolderRow('${type}', '${escapeHtml(id)}', -1)"><i class="fa fa-chevron-up"></i></button><button title="Move down" onclick="moveFolderRow('${type}', '${escapeHtml(id)}', 1)"><i class="fa fa-chevron-down"></i></button></span>`;
        rows.push(
            `<tr data-folder-id="${escapeHtml(id)}" class="${manualMode ? 'folder-row-manual' : ''}">` +
            `<td>${orderControls}</td>` +
            `<td>${escapeHtml(id)}</td>` +
            `<td class="name-cell"><span class="name-cell-content"><img src="${safeIcon}" class="img" onerror="this.src='/plugins/dynamix.docker.manager/images/question.png';"><span class="name-cell-text">${safeName}</span></span></td>` +
            `<td><button title="Export" onclick="${type === 'docker' ? 'downloadDocker' : 'downloadVm'}('${escapeHtml(id)}')"><i class="fa fa-download"></i></button>` +
            `<button title="Delete" onclick="${type === 'docker' ? 'clearDocker' : 'clearVm'}('${escapeHtml(id)}')"><i class="fa fa-trash"></i></button></td>` +
            '</tr>'
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
        // Folder order is already persisted by reorder.php; prefs write is best-effort.
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
        swal({
            title: 'Order save failed',
            text: error.message || String(error),
            type: 'error',
        });
    }
};

const bindManualDrag = (type) => {
    // Drag-and-drop intentionally removed for reliability.
    // Ordering is performed through explicit up/down controls.
    return;
};

const renderFolderSelectOptions = (type) => {
    const folders = getFolderMap(type);
    const options = Object.entries(folders)
        .map(([id, folder]) => `<option value="${escapeHtml(id)}">${escapeHtml(folder.name || id)}</option>`)
        .join('');
    $(`#${type}-rule-folder`).html(options);
};

const renderRulesTable = (type) => {
    const rulesBody = $(`#${type}-rules`);
    const rules = prefsByType[type].autoRules || [];
    const rows = rules.map((rule) => {
        const folderName = folderNameForId(type, rule.folderId);
        const matchText = rule.kind === 'label'
            ? `Label: ${rule.labelKey || '(missing key)'}${rule.labelValue ? ` = ${rule.labelValue}` : ' (any value)'}`
            : `Name regex: ${rule.pattern || '(empty)'}`;
        const stateLabel = rule.enabled ? 'Disable' : 'Enable';
        const stateIcon = rule.enabled ? 'fa-eye-slash' : 'fa-eye';
        return `<tr>
            <td>${escapeHtml(folderName)}</td>
            <td>${escapeHtml(matchText)}</td>
            <td>
                <button onclick="toggleAutoRule('${type}', '${escapeHtml(rule.id)}')"><i class="fa ${stateIcon}"></i> ${stateLabel}</button>
                <button onclick="deleteAutoRule('${type}', '${escapeHtml(rule.id)}')"><i class="fa fa-trash"></i> Delete</button>
            </td>
        </tr>`;
    });
    rulesBody.html(rows.join(''));
};

const renderTable = (type) => {
    const folders = getFolderMap(type);
    const ordered = utils.orderFoldersByPrefs(folders, prefsByType[type]);
    setTypeFolders(type, ordered);

    const sortMode = prefsByType[type]?.sortMode || 'created';
    $(`#${type}-sort-mode`).val(sortMode);
    const tbodyId = tableIdByType[type];
    $(`tbody#${tbodyId}`).html(buildRowsHtml(type, ordered, sortMode === 'manual'));
    bindManualDrag(type);
    renderFolderSelectOptions(type);
    renderRulesTable(type);
};

const refreshType = async (type) => {
    const [folders, prefs] = await Promise.all([fetchFolders(type), fetchPrefs(type)]);
    prefsByType[type] = prefs;
    setTypeFolders(type, folders);
    renderTable(type);
};

const refreshAll = async () => {
    await Promise.all([refreshType('docker'), refreshType('vm')]);
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
        return;
    }

    const payload = utils.buildFullExportPayload({
        type,
        folders,
        pluginVersion
    });
    const name = type === 'docker' ? `${EXPORT_BASENAME}.json` : `${EXPORT_BASENAME} VM.json`;
    downloadFile(name, toPrettyJson(payload));
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
        await refreshType(type);
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
    prefsByType[type] = await postPrefs(type, next);
    await refreshType(type);
};

const addAutoRule = async (type) => {
    const folderId = String($(`#${type}-rule-folder`).val() || '');
    const kind = String($(`#${type}-rule-kind`).val() || 'name_regex');
    const pattern = String($(`#${type}-rule-pattern`).val() || '').trim();
    const labelKey = String($(`#${type}-rule-label-key`).val() || '').trim();
    const labelValue = String($(`#${type}-rule-label-value`).val() || '').trim();

    if (!folderId) {
        swal({ title: 'Error', text: 'Select a folder before adding a rule.', type: 'error' });
        return;
    }

    if (kind === 'name_regex') {
        if (!pattern) {
            swal({ title: 'Error', text: 'Regex pattern cannot be empty.', type: 'error' });
            return;
        }
        try {
            // Validate regex now to avoid runtime surprises.
            new RegExp(pattern);
        } catch (error) {
            swal({ title: 'Error', text: `Invalid regex: ${error.message}`, type: 'error' });
            return;
        }
    }

    if (kind === 'label' && !labelKey) {
        swal({ title: 'Error', text: 'Label key cannot be empty for label rules.', type: 'error' });
        return;
    }

    const nextRule = {
        id: `rule-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        enabled: true,
        folderId,
        kind,
        pattern: kind === 'name_regex' ? pattern : '',
        labelKey: kind === 'label' ? labelKey : '',
        labelValue: kind === 'label' ? labelValue : ''
    };

    const nextPrefs = utils.normalizePrefs({
        ...prefsByType[type],
        autoRules: [...(prefsByType[type].autoRules || []), nextRule]
    });
    prefsByType[type] = await postPrefs(type, nextPrefs);

    $(`#${type}-rule-pattern`).val('');
    $(`#${type}-rule-label-key`).val('');
    $(`#${type}-rule-label-value`).val('');

    renderRulesTable(type);
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
    prefsByType[type] = await postPrefs(type, {
        ...prefsByType[type],
        autoRules: rules
    });
    renderRulesTable(type);
};

const deleteAutoRule = async (type, ruleId) => {
    const rules = (prefsByType[type].autoRules || []).filter((rule) => rule.id !== ruleId);
    prefsByType[type] = await postPrefs(type, {
        ...prefsByType[type],
        autoRules: rules
    });
    renderRulesTable(type);
};

const toggleRuleKindFields = (type) => {
    if (type !== 'docker') {
        return;
    }
    const kind = String($('#docker-rule-kind').val() || 'name_regex');
    const showLabel = kind === 'label';
    $('#docker-rule-pattern').toggle(!showLabel);
    $('#docker-rule-label-key').toggle(showLabel);
    $('#docker-rule-label-value').toggle(showLabel);
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
            const restore = await restoreLatest(type);
            await refreshType(type);
            swal({
                title: 'Restore complete',
                text: `Restored backup ${restore.name}`,
                type: 'success'
            });
        } catch (error) {
            swal({
                title: 'Restore failed',
                text: error.message || String(error),
                type: 'error'
            });
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
        swal({
            title: 'Update check failed',
            text: error.message || String(error),
            type: 'error'
        });
    }
};

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

const fileManager = async () => {
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
window.addAutoRule = addAutoRule;
window.toggleAutoRule = toggleAutoRule;
window.deleteAutoRule = deleteAutoRule;
window.toggleRuleKindFields = toggleRuleKindFields;
window.restoreLatestBackup = restoreLatestBackup;
window.checkForUpdatesNow = checkForUpdatesNow;
window.moveFolderRow = moveFolderRow;

(async () => {
    await fetchPluginVersion();
    await refreshAll();
})();
