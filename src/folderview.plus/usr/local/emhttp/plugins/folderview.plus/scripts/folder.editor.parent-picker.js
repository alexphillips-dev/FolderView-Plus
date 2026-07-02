// @ts-check
(function fvplusFolderEditorParentPickerScope(window) {
    'use strict';

    const createApi = (deps = {}) => {
        const rootWindow = deps.window || window;
        const rootDocument = deps.document || rootWindow.document;
        const $ = deps.$ || rootWindow.jQuery || rootWindow.$;
        const getForm = typeof deps.getForm === 'function' ? deps.getForm : (() => null);
        const escapeHtml = typeof deps.escapeHtml === 'function' ? deps.escapeHtml : ((value) => String(value ?? ''));
        const normalizeParentFolderId = typeof deps.normalizeParentFolderId === 'function'
            ? deps.normalizeParentFolderId
            : ((value) => String(value || '').trim());

        const state = {
            entries: [],
            search: ''
        };

        const normalizeEntries = (entries = []) => (
            Array.isArray(entries)
                ? entries.map((entry) => {
                    const id = normalizeParentFolderId(entry?.id || '');
                    const name = String(entry?.name || id).trim() || id;
                    const path = String(entry?.path || name).trim() || name;
                    const depth = Math.max(0, Number(entry?.depth || 0));
                    if (!id) {
                        return null;
                    }
                    return {
                        id,
                        name,
                        path,
                        depth
                    };
                }).filter(Boolean)
                : []
        );

        const buildTopLevelEntry = () => ({
            id: '',
            name: 'No parent (top level)',
            path: 'Keep this folder at the top level.',
            depth: 0,
            scope: 'Top level'
        });

        const getSelectedParentId = () => {
            const form = getForm();
            return normalizeParentFolderId(form?.parent_folder_id?.value || '');
        };

        const findSelectedEntry = (selectedParentId = '') => {
            const safeSelected = normalizeParentFolderId(selectedParentId);
            if (!safeSelected) {
                return buildTopLevelEntry();
            }
            return state.entries.find((entry) => entry.id === safeSelected) || buildTopLevelEntry();
        };

        const filterEntries = () => {
            const needle = String(state.search || '').trim().toLowerCase();
            if (!needle) {
                return state.entries.slice();
            }
            return state.entries.filter((entry) => {
                const name = String(entry?.name || '').toLowerCase();
                const path = String(entry?.path || '').toLowerCase();
                return name.includes(needle) || path.includes(needle);
            });
        };

        const formatEntryPath = (entry) => {
            const name = String(entry?.name || '').trim();
            const path = String(entry?.path || '').trim();
            if (!path) {
                return '';
            }
            if (path === 'Keep this folder at the top level.') {
                return path;
            }
            return path === name ? `/${path}` : `/${path}`;
        };

        const buildOptionHtml = (entry, selectedParentId) => {
            const safeSelected = normalizeParentFolderId(selectedParentId);
            const safeId = normalizeParentFolderId(entry?.id || '');
            const isTopLevel = safeId === '';
            const isSelected = safeId === safeSelected;
            const scopeLabel = String(entry?.scope || (isTopLevel ? 'Top level' : entry?.depth > 0 ? `Depth ${entry.depth}` : 'Root folder')).trim();
            const optionIcon = isTopLevel ? 'fa-level-up' : 'fa-folder-o';
            const pathLabel = formatEntryPath(entry);
            return `
                <button
                    type="button"
                    class="fv-parent-picker-option${isSelected ? ' is-selected' : ''}${isTopLevel ? ' is-top-level' : ''}"
                    data-parent-folder-id="${escapeHtml(safeId)}"
                    role="option"
                    aria-selected="${isSelected ? 'true' : 'false'}">
                    <span class="fv-parent-picker-option-icon" aria-hidden="true"><i class="fa ${optionIcon}"></i></span>
                    <span class="fv-parent-picker-option-main">
                        <span class="fv-parent-picker-option-name">${escapeHtml(String(entry?.name || ''))}</span>
                        ${pathLabel ? `<span class="fv-parent-picker-option-path">${escapeHtml(pathLabel)}</span>` : ''}
                    </span>
                    <span class="fv-parent-picker-option-meta">
                        ${isSelected ? '<span class="fv-parent-picker-option-check" aria-hidden="true"><i class="fa fa-check"></i></span>' : ''}
                        <span class="fv-parent-picker-option-scope">${escapeHtml(scopeLabel)}</span>
                    </span>
                </button>
            `;
        };

        const ensureShell = () => {
            const form = getForm();
            const select = form?.parent_folder_id;
            if (!(select instanceof rootWindow.HTMLSelectElement)) {
                return null;
            }
            select.classList.add('fv-parent-picker-native');
            select.setAttribute('aria-hidden', 'true');
            select.tabIndex = -1;
            const dd = select.closest('dd');
            if (!(dd instanceof rootWindow.HTMLElement)) {
                return null;
            }
            let shell = dd.querySelector('#fvParentFolderPicker');
            if (!(shell instanceof rootWindow.HTMLElement)) {
                shell = rootDocument.createElement('div');
                shell.id = 'fvParentFolderPicker';
                shell.className = 'fv-parent-picker-shell';
                const existingNote = dd.querySelector('.fv-parent-defaults-note');
                if (existingNote instanceof rootWindow.HTMLElement) {
                    dd.insertBefore(shell, existingNote);
                } else {
                    dd.appendChild(shell);
                }
            }
            return shell;
        };

        const render = ({
            entries = [],
            selectedParentId = ''
        } = {}) => {
            const shell = ensureShell();
            if (!(shell instanceof rootWindow.HTMLElement)) {
                return;
            }

            const searchFieldHadFocus = rootDocument.activeElement instanceof rootWindow.HTMLInputElement
                && rootDocument.activeElement.classList.contains('fv-parent-picker-search-input');
            const previousSelectionStart = searchFieldHadFocus ? rootDocument.activeElement.selectionStart : null;
            const previousSelectionEnd = searchFieldHadFocus ? rootDocument.activeElement.selectionEnd : null;

            state.entries = normalizeEntries(entries);
            const safeSelected = normalizeParentFolderId(selectedParentId || getSelectedParentId());
            const selectedEntry = findSelectedEntry(safeSelected);
            const selectedIsTopLevel = !safeSelected;
            const filteredEntries = filterEntries();
            const resultCount = filteredEntries.length;
            const availableCount = state.entries.length;
            const selectedPathLabel = formatEntryPath(selectedEntry);

            shell.innerHTML = `
                <div class="fv-parent-picker-current">
                    <span class="fv-parent-picker-current-icon" aria-hidden="true">
                        <i class="fa ${selectedIsTopLevel ? 'fa-level-up' : 'fa-folder-open-o'}"></i>
                    </span>
                    <div class="fv-parent-picker-current-copy">
                        <span class="fv-parent-picker-kicker">Current location</span>
                        <strong>${escapeHtml(selectedEntry.name)}</strong>
                        <span>${escapeHtml(selectedPathLabel || 'Keep this folder at the top level.')}</span>
                    </div>
                    <div class="fv-parent-picker-current-stats">
                        <span class="fv-parent-picker-chip${selectedIsTopLevel ? ' is-accent' : ''}">${selectedIsTopLevel ? 'Top level' : 'Nested'}</span>
                        <span class="fv-parent-picker-chip">${escapeHtml(String(availableCount))} folder${availableCount === 1 ? '' : 's'}</span>
                        ${state.search ? `<span class="fv-parent-picker-chip is-accent">${escapeHtml(String(resultCount))} match${resultCount === 1 ? '' : 'es'}</span>` : ''}
                        ${selectedIsTopLevel ? '' : '<button type="button" class="fv-parent-picker-current-action" data-parent-folder-id=""><i class="fa fa-level-up" aria-hidden="true"></i> Move to top level</button>'}
                    </div>
                </div>
                <div class="fv-parent-picker-toolbar">
                    <label class="fv-parent-picker-search">
                        <span>Choose parent</span>
                        <span class="fv-parent-picker-search-control">
                            <span class="fv-parent-picker-search-input-wrap">
                                <input
                                    type="text"
                                    class="fv-parent-picker-search-input"
                                    value="${escapeHtml(state.search)}"
                                    placeholder="Search folders by name or path"
                                    autocomplete="off">
                            </span>
                            <button type="button" class="fv-parent-picker-clear"${state.search ? '' : ' disabled'} aria-label="Clear parent search"><i class="fa fa-times" aria-hidden="true"></i><span>Clear</span></button>
                        </span>
                    </label>
                </div>
                <div class="fv-parent-picker-pinned" role="listbox" aria-label="Pinned parent folder option">
                    ${buildOptionHtml(buildTopLevelEntry(), safeSelected)}
                </div>
                <div class="fv-parent-picker-meta">
                    ${state.search
                        ? `Showing ${escapeHtml(String(resultCount))} of ${escapeHtml(String(availableCount))} folders.`
                        : `Choose a destination folder or keep this folder at the top level.`}
                </div>
                <div class="fv-parent-picker-list" role="listbox" aria-label="Parent folder options">
                    ${filteredEntries.length > 0
                        ? filteredEntries.map((entry) => buildOptionHtml(entry, safeSelected)).join('')
                        : `<div class="fv-parent-picker-empty">${state.search ? 'No folders match this search.' : 'No available parent folders yet.'}</div>`}
                </div>
            `;

            if (searchFieldHadFocus) {
                const input = shell.querySelector('.fv-parent-picker-search-input');
                if (input instanceof rootWindow.HTMLInputElement) {
                    input.focus();
                    if (typeof previousSelectionStart === 'number' && typeof previousSelectionEnd === 'number') {
                        input.setSelectionRange(previousSelectionStart, previousSelectionEnd);
                    }
                }
            }

            if (!$ || shell.dataset.bound === '1') {
                return;
            }

            const form = getForm();
            const select = form?.parent_folder_id;
            if (select instanceof rootWindow.HTMLSelectElement) {
                $(select).on('change.fvParentPicker', () => {
                    render({
                        entries: state.entries,
                        selectedParentId: normalizeParentFolderId(select.value || '')
                    });
                });
            }

            $(shell)
                .on('input', '.fv-parent-picker-search-input', function onParentPickerSearchInput(event) {
                    event.stopPropagation();
                    state.search = String($(this).val() || '');
                    render({
                        entries: state.entries,
                        selectedParentId: getSelectedParentId()
                    });
                })
                .on('change', '.fv-parent-picker-search-input', function onParentPickerSearchChange(event) {
                    event.stopPropagation();
                })
                .on('keydown', '.fv-parent-picker-search-input', function onParentPickerSearchKeydown(event) {
                    event.stopPropagation();
                    if (event.key === 'Escape') {
                        state.search = '';
                        $(this).val('');
                        render({
                            entries: state.entries,
                            selectedParentId: getSelectedParentId()
                        });
                    }
                })
                .on('click', '.fv-parent-picker-clear', function onParentPickerClearClick(event) {
                    event.preventDefault();
                    state.search = '';
                    render({
                        entries: state.entries,
                        selectedParentId: getSelectedParentId()
                    });
                })
                .on('click', '[data-parent-folder-id]', function onParentPickerOptionClick(event) {
                    event.preventDefault();
                    const safeParentId = normalizeParentFolderId($(this).attr('data-parent-folder-id') || '');
                    const activeForm = getForm();
                    const activeSelect = activeForm?.parent_folder_id;
                    if (!(activeSelect instanceof rootWindow.HTMLSelectElement) || !$) {
                        return;
                    }
                    state.search = '';
                    $(activeSelect).val(safeParentId).trigger('change');
                });

            shell.dataset.bound = '1';
        };

        return Object.freeze({
            render
        });
    };

    window.FolderViewPlusFolderEditorParentPicker = Object.freeze({
        createApi
    });
    window.FolderViewPlusFolderEditorParentPickerModuleLoaded = true;
}(window));
