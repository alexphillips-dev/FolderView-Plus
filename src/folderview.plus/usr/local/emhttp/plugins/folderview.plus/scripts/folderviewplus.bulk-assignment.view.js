// Presentation and interaction for the Settings bulk move workspace.
(function(root, factory) {
    if (typeof module === 'object' && module.exports) { module.exports = factory(); return; }
    root.FolderViewPlusBulkAssignmentView = factory();
    root.FolderViewPlusBulkAssignmentViewModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const createApi = (deps) => {
        const { document: documentRef, window: win, $, getBulkState, getFolderMap, getInfoByType, createSafeElement } = deps;
        const surfaceT = (key, fallback, ...params) => win.FolderViewPlusI18n?.t?.(key, fallback, ...params)
            || fallback.replace(/\$(\d+)/g, (token, n) => String(params[Number(n) - 1] ?? token));
        const root = documentRef.querySelector('.fv-bulk-workspace');
        if (!root) return null;
        const rowsByType = { docker: new Map(), vm: new Map() };
        const filters = { docker: { folder: '', status: '', sort: 'name', direction: 1 }, vm: { folder: '', status: '', sort: 'name', direction: 1 } };
        const node = (type, suffix) => documentRef.getElementById(type + '-bulk-' + suffix);
        const statusLabels = () => ({ started: surfaceT("legacy.surface.f4ccae29e1bb0c20", "Running"), stopped: surfaceT("legacy.surface.1a4f630ac1b69fd0", "Stopped"), paused: surfaceT("legacy.surface.e159b06187d369a0", "Paused"), unknown: surfaceT("legacy.surface.b764cdc0eab71374", "Unknown") });
        const setSource = (type) => {
            root.querySelectorAll('[data-fv-bulk-source]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.fvBulkSource === type)));
            root.querySelectorAll('.bulk-module').forEach(panel => { panel.hidden = panel.dataset.fvBulkType !== type; });
            const title = documentRef.getElementById('fv-bulk-title');
            const description = documentRef.getElementById('fv-bulk-description');
            if (title) {
                title.textContent = type === 'vm' ? surfaceT("legacy.surface.c5427c94abb0a037", "Bulk Move VMs") : surfaceT("legacy.surface.0642b3314a465c06", "Bulk Move Containers");
                title.setAttribute('data-i18n', type === 'vm' ? 'legacy.surface.c5427c94abb0a037' : 'legacy.surface.0642b3314a465c06');
            }
            if (description) {
                description.textContent = type === 'vm' ? surfaceT("legacy.surface.8dd26eceec3d988f", "Move multiple VMs to a target folder in one action.") : surfaceT("legacy.surface.3c4efec284ac00c0", "Move multiple Docker containers to a target folder in one action.");
                description.setAttribute('data-i18n', type === 'vm' ? 'legacy.surface.8dd26eceec3d988f' : 'legacy.surface.3c4efec284ac00c0');
            }
            const icon = title?.closest('.fv-bulk-hero')?.querySelector(':scope > i');
            if (icon) icon.className = type === 'vm' ? 'fa fa-desktop' : 'fa fa-cube';
        };
        const filterItems = (type, names) => {
            node(type, 'table-filter').value = node(type, 'filter').value;
            const lookup = deps.getBulkMemberFolderLookup(type);
            const folders = getFolderMap(type);
            const info = getInfoByType(type) || {};
            const labels = statusLabels();
            const options = [[ '', surfaceT("legacy.surface.226fd0e51f770b0b", "All folders") ], ['__unassigned__', surfaceT("legacy.surface.14d33bd014e6b4e7", "Unassigned")], ['__conflict__', surfaceT("legacy.surface.5972c319ea2e8828", "Multiple folders")],
                ...Object.entries(folders).map(([id, folder]) => [id, String(folder.name || id)])];
            const select = node(type, 'current-folder');
            if (select) {
                const value = options.some(([id]) => id === filters[type].folder) ? filters[type].folder : '';
                select.replaceChildren(...options.map(([id, label]) => createSafeElement('option', { text: label, attributes: { value: id, 'data-i18n-ignore': true } })));
                select.value = value;
                filters[type].folder = value;
            }
            rowsByType[type] = new Map(names.map(name => {
                const conflictIds = lookup.conflicts[name] || [];
                const folderId = conflictIds.length > 1 ? '__conflict__' : lookup.byName[name] || '__unassigned__';
                const folder = folderId === '__conflict__' ? surfaceT("legacy.surface.5972c319ea2e8828", "Multiple folders")
                    : folderId === '__unassigned__' ? surfaceT("legacy.surface.14d33bd014e6b4e7", "Unassigned") : String(folders[folderId]?.name || folderId);
                const status = Object.prototype.hasOwnProperty.call(info, name) ? deps.getItemRuntimeStateKind(type, info[name]) : 'unknown';
                return [name, { name, folderId, folder, status, statusLabel: labels[status] || labels.unknown }];
            }));
            const state = filters[type];
            const rows = [...rowsByType[type].values()].filter(row => (!state.folder || row.folderId === state.folder) && (!state.status || row.status === state.status));
            const value = row => state.sort === 'folder' ? row.folder : state.sort === 'status' ? row.statusLabel : row.name;
            return rows.sort((a, b) => state.direction * (value(a).localeCompare(value(b), undefined, { sensitivity: 'base', numeric: true }) || a.name.localeCompare(b.name))).map(row => row.name);
        };
        const renderItems = (type, names) => {
            const list = node(type, 'items-list');
            if (!list) return;
            const state = getBulkState(type);
            const token = ++state.renderToken;
            list.replaceChildren();
            if (!names.length) {
                list.appendChild(createSafeElement('tr', { children: [createSafeElement('td', {
                    className: 'bulk-items-empty', text: state.allNames.length ? surfaceT("legacy.surface.da10bc311a7049ab", "No items match these filters.") : surfaceT("legacy.surface.4d7f822269c0e992", "No items detected yet."), attributes: { colspan: 4 }
                })] }));
                return;
            }
            let cursor = 0;
            const append = () => {
                if (token !== state.renderToken || !list.isConnected || list.closest('.bulk-module').hidden) return;
                const fragment = documentRef.createDocumentFragment();
                const end = Math.min(cursor + 120, names.length);
                while (cursor < end) {
                    const row = rowsByType[type].get(names[cursor]);
                    const id = type + '-bulk-check-' + cursor++;
                    const checkbox = createSafeElement('input', { className: 'bulk-item-checkbox', attributes: {
                        type: 'checkbox', id, value: row.name, 'data-fv-bulk-type': type, 'data-fv-track-save': '0', 'aria-label': surfaceT("legacy.surface.8cfac97d26e7f244", "Select $1", row.name)
                    } });
                    checkbox.checked = state.selected.has(row.name);
                    checkbox.disabled = state.applying || state.confirming || !Object.keys(getFolderMap(type)).length;
                    fragment.appendChild(createSafeElement('tr', { className: 'bulk-item-row', children: [
                        createSafeElement('td', { className: 'bulk-check-cell', children: [checkbox] }),
                        createSafeElement('td', { children: [createSafeElement('label', { className: 'bulk-item-name', text: row.name, attributes: { for: id, 'data-i18n-ignore': true } })] }),
                        createSafeElement('td', { children: [createSafeElement('span', { className: 'bulk-folder-badge', text: row.folder, attributes: { 'data-i18n-ignore': true } })] }),
                        createSafeElement('td', { children: [createSafeElement('span', { className: 'bulk-runtime-status is-' + row.status, text: row.statusLabel, attributes: { 'data-i18n-ignore': true } })] })
                    ] }));
                }
                list.appendChild(fragment);
                if (cursor < names.length) deps.requestAnimationFrameRef(append);
            };
            append();
        };
        const update = (type, plan) => {
            const state = getBulkState(type);
            const panel = root.querySelector('.bulk-module[data-fv-bulk-type="' + type + '"]');
            const hasFolders = Object.keys(getFolderMap(type)).length > 0;
            const busy = state.applying || state.confirming;
            panel.querySelectorAll('input, select, button').forEach(control => { control.disabled = busy || !hasFolders; });
            root.querySelectorAll('[data-fv-bulk-source]').forEach(button => { button.disabled = ['docker', 'vm'].some(source => getBulkState(source).applying || getBulkState(source).confirming); });
            const all = node(type, 'toggle-all');
            const selected = state.visibleNames.filter(name => state.selected.has(name)).length;
            all.checked = state.visibleNames.length > 0 && selected === state.visibleNames.length;
            all.indeterminate = selected > 0 && selected < state.visibleNames.length;
            all.disabled = busy || !hasFolders || !state.visibleNames.length;
            panel.querySelectorAll('.bulk-item-checkbox').forEach(checkbox => { checkbox.checked = state.selected.has(checkbox.value); });
            panel.querySelectorAll('[data-fv-bulk-sort]').forEach(button => button.closest('th').setAttribute('aria-sort', button.dataset.fvBulkSort === filters[type].sort ? (filters[type].direction === 1 ? 'ascending' : 'descending') : 'none'));
            node(type, 'visible-count').textContent = surfaceT("legacy.surface.fa7f6e591471d6be", "Showing $1 of $2", state.visibleNames.length, state.allNames.length);
            node(type, 'footer-target').textContent = plan.targetFolderName ? surfaceT("legacy.surface.287ef93dc903036c", "Move to: $1", plan.targetFolderName) : surfaceT("legacy.surface.5c71b8cd7822a418", "Choose a folder");
            node(type, 'footer-count').textContent = type === 'vm' ? surfaceT("legacy.surface.f415640a1bfb6a02", "VMs to move: $1", plan.actionableNames.length) : surfaceT("legacy.surface.bdc28eb63e184adb", "Containers to move: $1", plan.actionableNames.length);
            node(type, 'selected-count').textContent = type === 'vm' ? surfaceT("legacy.surface.59463ea0882a7b02", "Selected VMs: $1", plan.selectedNames.length) : surfaceT("legacy.surface.9ce894c920957f29", "Selected containers: $1", plan.selectedNames.length);
            const hiddenSelected = plan.selectedNames.length - selected;
            if (hiddenSelected > 0) node(type, 'selected-count').textContent += ' · ' + surfaceT('common.repair.selected-items-hidden-by-the-current-filter-1-987859', 'Selected items hidden by the current filter: $1.', hiddenSelected);
            node(type, 'help').textContent = plan.selectedNames.length ? surfaceT("legacy.surface.b766465b7ab9bb5e", "Review the planned changes before confirming the move.") : surfaceT("legacy.surface.a2b72fbd348bebf9", "Select items from the list to preview folder moves.");
            node(type, 'selection-description').textContent = type === 'vm' ? surfaceT("legacy.surface.a807b88cd46eff72", "Choose the VMs you want to move to $1.", plan.targetFolderName || surfaceT("legacy.surface.5c71b8cd7822a418", "Choose a folder")) : surfaceT("legacy.surface.d64012ad24cf9259", "Choose the containers you want to move to $1.", plan.targetFolderName || surfaceT("legacy.surface.5c71b8cd7822a418", "Choose a folder"));
        };
        const typeFor = target => target.closest('.bulk-module')?.dataset.fvBulkType || 'docker';
        $(root).off('.fvbulkworkspace').on('click.fvbulkworkspace', '[data-fv-bulk-source], [data-fv-bulk-action], [data-fv-bulk-sort]', event => {
            const target = event.currentTarget;
            if (target.disabled) return;
            const type = typeFor(target);
            if (target.dataset.fvBulkSource) {
                setSource(target.dataset.fvBulkSource);
                deps.renderBulkItemOptions(target.dataset.fvBulkSource);
            } else if (target.dataset.fvBulkSort) {
                const state = filters[type];
                state.direction = state.sort === target.dataset.fvBulkSort ? -state.direction : 1;
                state.sort = target.dataset.fvBulkSort;
                deps.renderBulkItemOptions(type);
            } else if (target.dataset.fvBulkAction === 'destination') node(type, 'folder').focus();
            else if (target.dataset.fvBulkAction === 'clear-filters') {
                filters[type].folder = ''; filters[type].status = '';
                node(type, 'status-filter').value = '';
                deps.filterBulkItems(type, '');
            }
        }).on('change.fvbulkworkspace', '[data-fv-bulk-filter], [data-fv-bulk-action="toggle-all"]', event => {
            const target = event.currentTarget;
            const type = typeFor(target);
            if (target.dataset.fvBulkFilter) {
                filters[type][target.dataset.fvBulkFilter] = target.value;
                deps.renderBulkItemOptions(type);
            } else deps.bulkItemSelectionAction(type, target.checked ? 'all' : 'none');
        }).on('input.fvbulkworkspace', '[data-fv-bulk-search]', event => deps.filterBulkItems(typeFor(event.currentTarget), event.currentTarget.value));
        setSource('docker');
        return Object.freeze({ filterItems, renderItems, update });
    };
    return Object.freeze({ createApi });
}));
