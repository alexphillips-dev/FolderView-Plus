// Isolated inventory and mutation adapter; no live Unraid requests are made.
(() => {
    const folders = { docker: { target: { name: 'Audiobooks', containers: ['already'] }, media: { name: 'Media', containers: ['alpha', 'beta', 'offline'] } }, vm: { target: { name: 'Work', containers: [] }, source: { name: 'Home', containers: ['Desktop'] } } };
    const info = { docker: { alpha: { running: true }, beta: { running: true, paused: true }, gamma: { running: false }, already: { running: true } }, vm: { Desktop: { state: 'running' }, Server: { state: 'shutoff' } } };
    const fixture = window.fixtureBulk = { folders, info, requests: [], backups: 0, undo: 0, refreshes: [], confirmations: [], errors: [], defer: false, fail: false, pending: [] };
    const api = window.FolderViewPlusBulkAssignment.createApi({
        window, document, $, utils, escapeHtml, getItemRuntimeStateKind: window.fixtureRuntimeKind,
        getFolderMap: type => folders[type], getInfoByType: type => info[type], getFolderNameForId: (type, id) => folders[type][id]?.name || id,
        swal: (options, callback) => { if (callback) fixture.confirmations.push({ options, callback }); },
        createBackup: async () => { fixture.backups++; return { name: 'synthetic-safety-backup' }; },
        refreshType: async type => fixture.refreshes.push(type), refreshBackups: async () => fixture.refreshes.push('backups'),
        offerUndoAction: async () => { fixture.undo++; }, showError: (_, error) => fixture.errors.push(error.message),
        apiPostJson: async (url, payload) => {
            fixture.requests.push({ url, ...payload });
            if (fixture.defer) await new Promise(resolve => fixture.pending.push(resolve));
            if (fixture.fail) return { ok: false, error: 'Synthetic request failure' };
            const names = JSON.parse(payload.items);
            for (const folder of Object.values(folders[payload.type])) folder.containers = folder.containers.filter(name => !names.includes(name));
            folders[payload.type][payload.folderId].containers.push(...names);
            return { ok: true, result: { assigned: names } };
        }
    });
    fixture.api = api;
    fixture.confirm = value => fixture.confirmations.shift().callback(value);
    fixture.release = () => fixture.pending.splice(0).forEach(resolve => resolve());
    fixture.render = type => {
        const select = document.getElementById(type + '-bulk-folder');
        select.replaceChildren(...Object.entries(folders[type]).map(([id, folder]) => new Option(folder.name, id)));
        select.disabled = !select.options.length;
        api.renderBulkItemOptions(type);
    };
    $(document).off('.fixturebulk').on('change.fixturebulk', '.bulk-item-checkbox', event => api.setBulkItemChecked(event.target.dataset.fvBulkType, event.target.value, event.target.checked))
        .on('change.fixturebulk', '#docker-bulk-folder, #vm-bulk-folder', event => {
            const type = event.target.id.startsWith('vm-') ? 'vm' : 'docker';
            api.clearBulkExecutionState(type); api.renderBulkResultPanel(type, null); api.updateBulkResultActions(type); api.updateBulkPreviewPanel(type);
        });
    window.FolderViewPlusCspEvents.registerActions({
        filterBulkItems: api.filterBulkItems, bulkItemSelectionAction: api.bulkItemSelectionAction,
        assignSelectedItems: api.assignSelectedItems, updateBulkSelectedCount: api.updateBulkSelectedCount, retryFailedBulkItems: api.retryFailedBulkItems
    }, { owner: 'bulk-assignment-fixture' });
    ['docker', 'vm'].forEach(fixture.render);
})();
