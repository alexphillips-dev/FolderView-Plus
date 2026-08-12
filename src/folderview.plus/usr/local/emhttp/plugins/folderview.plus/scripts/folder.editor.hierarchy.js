(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusFolderHierarchy = factory();
    root.FolderViewPlusFolderHierarchyModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const createApi = (deps = {}) => {
        const jq = deps.$;
        const getForm = typeof deps.getForm === 'function' ? deps.getForm : (() => null);
        const getFolderId = typeof deps.getFolderId === 'function' ? deps.getFolderId : (() => '');
        const getAllFolders = typeof deps.getAllFolders === 'function' ? deps.getAllFolders : (() => ({}));
        const updateForm = typeof deps.updateForm === 'function' ? deps.updateForm : (() => {});
        const validateForm = typeof deps.validateForm === 'function' ? deps.validateForm : (() => {});
        const updateLiveSummary = typeof deps.updateLiveSummary === 'function' ? deps.updateLiveSummary : (() => {});
        const updateRegexSimulator = typeof deps.updateRegexSimulator === 'function' ? deps.updateRegexSimulator : (() => {});
        const escapeHtml = typeof deps.escapeHtml === 'function' ? deps.escapeHtml : ((value) => String(value || ''));
        const smartDefaultFieldNames = deps.smartDefaultFieldNames instanceof Set ? deps.smartDefaultFieldNames : new Set();
        const getParentDefaults = typeof deps.getParentDefaults === 'function' ? deps.getParentDefaults : (() => ({}));

        const state = {
            currentFolderDescendantIds: new Set(),
            smartDefaultTouchedFields: new Set(),
            isApplyingParentDefaults: false
        };

        const normalizeParentFolderId = (value) => String(value || '').trim();

        const computeFolderDescendantIds = (foldersMap, rootId) => {
            const source = foldersMap && typeof foldersMap === 'object' ? foldersMap : {};
            const rootFolderId = normalizeParentFolderId(rootId);
            if (!rootFolderId) {
                return new Set();
            }
            const descendants = new Set();
            const queue = [rootFolderId];
            while (queue.length > 0) {
                const current = queue.shift();
                for (const [id, folder] of Object.entries(source)) {
                    const parentId = normalizeParentFolderId(folder?.parentId || '');
                    if (parentId !== current || descendants.has(id)) {
                        continue;
                    }
                    descendants.add(id);
                    queue.push(id);
                }
            }
            descendants.delete(rootFolderId);
            return descendants;
        };

        const buildNestedFolderOrder = (foldersMap) => {
            const source = foldersMap && typeof foldersMap === 'object' ? foldersMap : {};
            const ids = Object.keys(source);
            if (ids.length <= 0) {
                return [];
            }
            const indexById = new Map(ids.map((id, idx) => [id, idx]));
            const childrenByParent = new Map();
            for (const id of ids) {
                const parentIdRaw = normalizeParentFolderId(source[id]?.parentId || source[id]?.parent_id || '');
                const parentId = parentIdRaw && parentIdRaw !== id && indexById.has(parentIdRaw) ? parentIdRaw : '';
                const key = parentId || '__root__';
                if (!childrenByParent.has(key)) {
                    childrenByParent.set(key, []);
                }
                childrenByParent.get(key).push(id);
            }
            const sortBySourceIndex = (a, b) => (indexById.get(a) || 0) - (indexById.get(b) || 0);
            for (const list of childrenByParent.values()) {
                list.sort(sortBySourceIndex);
            }
            const rows = [];
            const visiting = new Set();
            const visited = new Set();
            const visit = (id, depth) => {
                if (!id || visited.has(id) || visiting.has(id)) {
                    return;
                }
                visiting.add(id);
                rows.push({ id, folder: source[id], depth: Math.max(0, depth) });
                for (const childId of (childrenByParent.get(id) || [])) {
                    visit(childId, depth + 1);
                }
                visiting.delete(id);
                visited.add(id);
            };
            for (const rootId of (childrenByParent.get('__root__') || [])) {
                visit(rootId, 0);
            }
            for (const id of ids) {
                visit(id, 0);
            }
            return rows;
        };

        const buildParentFolderEntries = (foldersMap, blockedIds = new Set()) => {
            const blocked = blockedIds instanceof Set ? blockedIds : new Set();
            const rows = buildNestedFolderOrder(foldersMap);
            if (!rows.length) {
                return [];
            }
            const pathById = new Map();
            const entries = [];
            for (const row of rows) {
                const id = normalizeParentFolderId(row?.id || '');
                if (!id || blocked.has(id)) {
                    continue;
                }
                const folder = row?.folder && typeof row.folder === 'object' ? row.folder : {};
                const name = String(folder?.name || id).trim() || id;
                const parentId = normalizeParentFolderId(folder?.parentId || folder?.parent_id || '');
                const parentPath = parentId && pathById.has(parentId) ? String(pathById.get(parentId) || '').trim() : '';
                const path = parentPath ? `${parentPath} / ${name}` : name;
                const depth = Math.max(0, Number(row?.depth || 0));
                pathById.set(id, path);
                entries.push({
                    id,
                    depth,
                    name,
                    path
                });
            }
            return entries;
        };

        const populateParentFolderOptions = (foldersMap, selectedParentId = '', blockedIds = new Set()) => {
            const form = getForm();
            const select = form?.parent_folder_id;
            if (!select) {
                return;
            }
            const selected = normalizeParentFolderId(selectedParentId);
            const blocked = blockedIds instanceof Set ? blockedIds : new Set();
            const options = ['<option value="">No parent (top level)</option>'];
            for (const entry of buildParentFolderEntries(foldersMap, blocked)) {
                options.push(`<option value="${escapeHtml(entry.id)}">${escapeHtml(entry.path)}</option>`);
            }
            jq(select).html(options.join(''));
            select.value = (selected && !blocked.has(selected)) ? selected : '';
        };

        const getSiblingNameCollision = (nameValue, parentId, excludeFolderId = '') => {
            const nameNeedle = String(nameValue || '').trim().toLowerCase();
            if (!nameNeedle) {
                return null;
            }
            const targetParent = normalizeParentFolderId(parentId);
            const excludeId = normalizeParentFolderId(excludeFolderId);
            for (const [id, folder] of Object.entries(getAllFolders() || {})) {
                const safeId = normalizeParentFolderId(id);
                if (!safeId || (excludeId && safeId === excludeId)) {
                    continue;
                }
                const folderName = String(folder?.name || '').trim().toLowerCase();
                if (!folderName || folderName !== nameNeedle) {
                    continue;
                }
                const folderParent = normalizeParentFolderId(folder?.parentId || folder?.parent_id || '');
                if (folderParent === targetParent) {
                    return {
                        id: safeId,
                        name: String(folder?.name || '').trim() || safeId
                    };
                }
            }
            return null;
        };

        const suggestSiblingName = (baseName, parentId, excludeFolderId = '') => {
            const trimmedBase = String(baseName || '').trim() || 'Folder';
            if (!getSiblingNameCollision(trimmedBase, parentId, excludeFolderId)) {
                return trimmedBase;
            }
            let index = 2;
            while (index < 500) {
                const candidate = `${trimmedBase} (${index})`;
                if (!getSiblingNameCollision(candidate, parentId, excludeFolderId)) {
                    return candidate;
                }
                index += 1;
            }
            return `${trimmedBase} ${Date.now()}`;
        };

        const setParentDefaultsNote = (message = '', level = 'info') => {
            const form = getForm();
            const select = jq(form?.elements?.parent_folder_id);
            if (!select.length) {
                return;
            }
            const dd = select.closest('dd');
            if (!dd.length) {
                return;
            }
            let note = dd.find('.fv-parent-defaults-note');
            if (!note.length) {
                note = jq('<div class="fv-parent-defaults-note" data-fvplus-style="fv-u-xcjvns"></div>');
                dd.append(note);
            }
            note.removeClass('is-info is-success is-warning').addClass(
                level === 'success' ? 'is-success' : (level === 'warning' ? 'is-warning' : 'is-info')
            );
            const safeMessage = String(message || '').trim();
            if (!safeMessage) {
                note.hide().text('');
                return;
            }
            note.text(safeMessage).show();
        };

        const applySmartDefaultsFromParent = (parentId, config = {}) => {
            if (getFolderId()) {
                return 0;
            }
            const safeParentId = normalizeParentFolderId(parentId);
            if (!safeParentId) {
                setParentDefaultsNote('');
                return 0;
            }
            const parentFolder = getAllFolders()?.[safeParentId];
            if (!parentFolder || typeof parentFolder !== 'object') {
                setParentDefaultsNote('');
                return 0;
            }
            const form = getForm();
            if (!form) {
                return 0;
            }
            const defaults = config.defaults && typeof config.defaults === 'object'
                ? config.defaults
                : getParentDefaults(parentFolder, safeParentId, config);

            let applied = 0;
            state.isApplyingParentDefaults = true;
            try {
                for (const [fieldName, value] of Object.entries(defaults)) {
                    if (!smartDefaultFieldNames.has(fieldName)) {
                        continue;
                    }
                    if (config.force !== true && state.smartDefaultTouchedFields.has(fieldName)) {
                        continue;
                    }
                    const input = form.elements?.[fieldName];
                    if (!input) {
                        continue;
                    }
                    if (typeof value === 'boolean') {
                        input.checked = value;
                        applied += 1;
                        continue;
                    }
                    const nextValue = String(value || '');
                    if (!nextValue) {
                        continue;
                    }
                    input.value = nextValue;
                    applied += 1;
                }
            } finally {
                state.isApplyingParentDefaults = false;
            }

            if (applied > 0) {
                const parentName = String(parentFolder?.name || safeParentId).trim() || safeParentId;
                setParentDefaultsNote(`Inherited ${applied} default${applied === 1 ? '' : 's'} from parent "${parentName}".`, 'success');
            } else {
                setParentDefaultsNote('Parent selected. Existing custom values were kept.', 'info');
            }

            updateForm();
            validateForm();
            updateLiveSummary();
            updateRegexSimulator();
            return applied;
        };

        const markSmartDefaultFieldTouched = (fieldName) => {
            const safeName = String(fieldName || '').trim();
            if (!safeName || !smartDefaultFieldNames.has(safeName) || state.isApplyingParentDefaults) {
                return;
            }
            state.smartDefaultTouchedFields.add(safeName);
        };

        return Object.freeze({
            state,
            normalizeParentFolderId,
            computeFolderDescendantIds,
            buildNestedFolderOrder,
            buildParentFolderEntries,
            populateParentFolderOptions,
            getSiblingNameCollision,
            suggestSiblingName,
            setParentDefaultsNote,
            applySmartDefaultsFromParent,
            markSmartDefaultFieldTouched
        });
    };

    return Object.freeze({
        createApi
    });
}));
