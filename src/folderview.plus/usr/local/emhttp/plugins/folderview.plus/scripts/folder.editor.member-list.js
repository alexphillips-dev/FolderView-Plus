// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    const modules = root.FolderViewPlusFoundationModules || {};
    modules.folderEditorMemberList = factory();
    root.FolderViewPlusFoundationModules = modules;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';

    const normalizeChildFolderOrder = (value) => {
        const seen = new Set();
        const result = [];
        (Array.isArray(value) ? value : []).forEach((entry) => {
            const id = String(entry || '').trim();
            if (!id || seen.has(id)) {
                return;
            }
            seen.add(id);
            result.push(id);
        });
        return result;
    };

    const createApi = (deps = {}) => {
        const runtimeWindow = deps.window || (typeof globalThis !== 'undefined' ? globalThis : null);
        const jq = deps.$;
        const escapeHtml = typeof deps.escapeHtml === 'function' ? deps.escapeHtml : ((value) => String(value || ''));
        const translate = typeof deps.translate === 'function' ? deps.translate : ((_key, fallback) => fallback);
        const getMemberStateKey = typeof deps.getMemberStateKey === 'function' ? deps.getMemberStateKey : (() => 'unknown');
        const getMemberCollections = typeof deps.getMemberCollections === 'function'
            ? deps.getMemberCollections
            : (() => ({ selected: [], choose: [], selectedRegex: [], hiddenPreviewMembers: new Set() }));
        const getAllFolders = typeof deps.getAllFolders === 'function' ? deps.getAllFolders : (() => ({}));
        const getActiveFolderId = typeof deps.getActiveFolderId === 'function' ? deps.getActiveFolderId : (() => '');
        const normalizeParentFolderId = typeof deps.normalizeParentFolderId === 'function'
            ? deps.normalizeParentFolderId
            : ((value) => String(value || '').trim());
        const normalizeFolderRecord = typeof deps.normalizeFolderRecord === 'function' ? deps.normalizeFolderRecord : ((folder) => folder || {});
        const updateLiveSummary = typeof deps.updateLiveSummary === 'function' ? deps.updateLiveSummary : (() => {});
        const updateUnsavedIndicator = typeof deps.updateUnsavedIndicator === 'function' ? deps.updateUnsavedIndicator : (() => {});
        const moveMemberRow = typeof deps.moveMemberRow === 'function' ? deps.moveMemberRow : (() => {});
        const bindMemberDragReorder = typeof deps.bindMemberDragReorder === 'function' ? deps.bindMemberDragReorder : (() => {});
        const applyMemberFilters = typeof deps.applyMemberFilters === 'function' ? deps.applyMemberFilters : (() => {});
        const updateMemberStats = typeof deps.updateMemberStats === 'function' ? deps.updateMemberStats : (() => {});
        const updateRegexSimulator = typeof deps.updateRegexSimulator === 'function' ? deps.updateRegexSimulator : (() => {});
        const validateForm = typeof deps.validateForm === 'function' ? deps.validateForm : (() => {});
        const isFormInitialized = typeof deps.isFormInitialized === 'function' ? deps.isFormInitialized : (() => false);
        const defaultFolderIconPath = String(deps.defaultFolderIconPath || '');
        const iconFallbackPath = String(deps.iconFallbackPath || '');
        const renderChunkSize = Math.max(1, Number(deps.renderChunkSize) || 140);
        let childFolderOrder = [];
        let memberListRenderToken = 0;

        const scheduleTask = (callback) => {
            if (typeof callback !== 'function') {
                return;
            }
            if (typeof runtimeWindow?.requestAnimationFrame === 'function') {
                runtimeWindow.requestAnimationFrame(callback);
                return;
            }
            const setTimer = typeof runtimeWindow?.setTimeout === 'function'
                ? runtimeWindow.setTimeout.bind(runtimeWindow)
                : setTimeout;
            setTimer(callback, 16);
        };

        const setChildFolderOrder = (value) => {
            childFolderOrder = normalizeChildFolderOrder(value);
            return childFolderOrder.slice();
        };

        const getChildFolderOrder = () => childFolderOrder.slice();

        const getDirectChildFolderEntries = () => {
            const parentId = String(getActiveFolderId() || '').trim();
            if (!parentId) {
                return [];
            }
            return Object.entries(getAllFolders() || {})
                .filter(([candidateId, candidateFolder]) => {
                    const childId = String(candidateId || '').trim();
                    if (!childId || childId === parentId || !candidateFolder || typeof candidateFolder !== 'object') {
                        return false;
                    }
                    return normalizeParentFolderId(candidateFolder.parentId || candidateFolder.parent_id || '') === parentId;
                })
                .map(([candidateId, candidateFolder], sourceIndex) => {
                    const normalizedFolder = normalizeFolderRecord(candidateFolder);
                    return {
                        id: String(candidateId || '').trim(),
                        sourceIndex,
                        name: String(normalizedFolder.name || candidateId || '').trim(),
                        icon: String(normalizedFolder.icon || defaultFolderIconPath || iconFallbackPath).trim(),
                        memberCount: Array.isArray(normalizedFolder.containers) ? normalizedFolder.containers.length : 0
                    };
                });
        };

        const sortChildFolderEntries = (entries, order = childFolderOrder) => {
            const orderIndex = new Map(normalizeChildFolderOrder(order).map((id, index) => [id, index]));
            return [...(Array.isArray(entries) ? entries : [])].sort((left, right) => {
                const leftOrder = orderIndex.has(left.id) ? orderIndex.get(left.id) : Number.MAX_SAFE_INTEGER;
                const rightOrder = orderIndex.has(right.id) ? orderIndex.get(right.id) : Number.MAX_SAFE_INTEGER;
                return leftOrder !== rightOrder ? leftOrder - rightOrder : left.sourceIndex - right.sourceIndex;
            });
        };

        const syncChildFolderOrderFromTable = () => {
            if (typeof jq !== 'function') {
                return getChildFolderOrder();
            }
            return setChildFolderOrder(
                jq('#fvFolderMembersBody > tr[data-child-folder-id]').map((_, row) => jq(row).attr('data-child-folder-id')).get()
            );
        };

        const getChildFolderOrderIds = () => sortChildFolderEntries(getDirectChildFolderEntries()).map((entry) => entry.id);

        const moveChildFolderRow = (button, direction) => {
            const row = jq(button).closest('tr');
            if (!row.length) {
                return;
            }
            if (direction === 'up') {
                const previous = row.prev('tr');
                if (previous.length) {
                    previous.before(row);
                }
            } else if (direction === 'down') {
                const next = row.next('tr');
                if (next.length) {
                    next.after(row);
                }
            }
            syncChildFolderOrderFromTable();
            updateLiveSummary();
            if (isFormInitialized()) {
                updateUnsavedIndicator();
            }
        };

        const bindChildFolderDragReorder = () => {
            const tableBody = jq('#fvFolderMembersBody');
            if (!tableBody.length) {
                return;
            }
            tableBody.off('.fvChildFolderDrag');
            let draggedRow = null;
            tableBody
                .on('dragstart.fvChildFolderDrag', '.folder-member-drag-handle', function(event) {
                    draggedRow = jq(this).closest('tr')[0] || null;
                    if (!draggedRow) {
                        return;
                    }
                    jq(draggedRow).addClass('is-dragging');
                    const originalEvent = event.originalEvent || event;
                    if (originalEvent.dataTransfer) {
                        originalEvent.dataTransfer.effectAllowed = 'move';
                        originalEvent.dataTransfer.setData('text/plain', jq(draggedRow).attr('data-child-folder-id') || '');
                    }
                })
                .on('dragover.fvChildFolderDrag', 'tr[data-child-folder-id]', function(event) {
                    if (!draggedRow || draggedRow === this) {
                        return;
                    }
                    event.preventDefault();
                    const targetRect = this.getBoundingClientRect();
                    const originalEvent = event.originalEvent || event;
                    const beforeTarget = originalEvent.clientY < targetRect.top + (targetRect.height / 2);
                    this.parentNode.insertBefore(draggedRow, beforeTarget ? this : this.nextSibling);
                })
                .on('drop.fvChildFolderDrag', 'tr[data-child-folder-id]', (event) => event.preventDefault())
                .on('dragend.fvChildFolderDrag', '.folder-member-drag-handle', function() {
                    if (draggedRow) {
                        jq(draggedRow).removeClass('is-dragging');
                    }
                    draggedRow = null;
                    syncChildFolderOrderFromTable();
                    updateLiveSummary();
                    if (isFormInitialized()) {
                        updateUnsavedIndicator();
                    }
                });
        };

        const renderFolderMembersSection = () => {
            const section = jq('#fvFolderMembersSection');
            const body = jq('#fvFolderMembersBody');
            const empty = jq('#fvFolderMembersEmpty');
            const summary = jq('#fvFolderMembersSummary');
            if (!section.length || !body.length) {
                return;
            }
            const entries = sortChildFolderEntries(getDirectChildFolderEntries());
            const countLabel = `${entries.length} folder${entries.length === 1 ? '' : 's'}`;
            summary.text(countLabel);
            section.prop('hidden', entries.length === 0);
            body.empty();
            empty.prop('hidden', entries.length !== 0);
            if (!entries.length) {
                return;
            }
            const rows = entries.map((entry) => `
                <tr class="fv-folder-member-row" data-child-folder-id="${escapeHtml(entry.id)}" draggable="false">
                    <td class="order-col"><div class="order-buttons"><button type="button" class="folder-member-drag-handle fv-six-dot-drag-handle" draggable="true" title="Drag to reorder folder" aria-label="Drag to reorder folder"><span class="fv-six-dot-drag-dot" aria-hidden="true"></span><span class="fv-six-dot-drag-dot" aria-hidden="true"></span><span class="fv-six-dot-drag-dot" aria-hidden="true"></span><span class="fv-six-dot-drag-dot" aria-hidden="true"></span><span class="fv-six-dot-drag-dot" aria-hidden="true"></span><span class="fv-six-dot-drag-dot" aria-hidden="true"></span></button><button type="button" class="folder-member-move" data-direction="up" title="Move up"><i class="fa fa-chevron-up" aria-hidden="true"></i></button><button type="button" class="folder-member-move" data-direction="down" title="Move down"><i class="fa fa-chevron-down" aria-hidden="true"></i></button></div></td>
                    <td class="fv-folder-member-name"><img src="${escapeHtml(entry.icon)}" class="img" data-fv-onerror="this.src='${iconFallbackPath}';"><span>${escapeHtml(entry.name)}</span><small>${entry.memberCount} item${entry.memberCount === 1 ? '' : 's'}</small></td>
                </tr>
            `).join('');
            body.append(jq(rows));
            body.find('.folder-member-move').off('click').on('click', function() {
                moveChildFolderRow(this, jq(this).data('direction'));
            });
            bindChildFolderDragReorder();
        };

        const updateList = (afterRender = null) => {
            const table = jq('.sortable > tbody');
            table.empty();
            const token = ++memberListRenderToken;
            const collections = getMemberCollections() || {};
            const hiddenPreviewMembers = collections.hiddenPreviewMembers instanceof Set
                ? collections.hiddenPreviewMembers
                : new Set();
            const rows = [];
            (Array.isArray(collections.selectedRegex) ? collections.selectedRegex : []).forEach((member) => rows.push({ member, membership: 'regex', checked: true, locked: true }));
            (Array.isArray(collections.selected) ? collections.selected : []).forEach((member) => rows.push({ member, membership: 'manual', checked: true, locked: false }));
            (Array.isArray(collections.choose) ? collections.choose : []).forEach((member) => rows.push({ member, membership: 'available', checked: false, locked: false }));

            const renderRowHtml = ({ member, membership, checked, locked }) => {
                const icon = escapeHtml(member.Icon || iconFallbackPath);
                const name = escapeHtml(member.Name);
                const stateKey = getMemberStateKey(member);
                const previewVisible = !hiddenPreviewMembers.has(String(member.Name || '').trim());
                const dragLabel = escapeHtml(translate('editor.members.drag-reorder', 'Drag to reorder'));
                const orderControls = locked
                    ? `<span class="order-lock" title="${escapeHtml(translate('editor.members.auto-included', 'Auto-included by regex or label'))}"><i class="fa fa-lock" aria-hidden="true"></i></span>`
                    : `<div class="order-buttons"><button type="button" class="member-drag-handle fv-six-dot-drag-handle" draggable="true" title="${dragLabel}" aria-label="${dragLabel}"><span class="fv-six-dot-drag-dot" aria-hidden="true"></span><span class="fv-six-dot-drag-dot" aria-hidden="true"></span><span class="fv-six-dot-drag-dot" aria-hidden="true"></span><span class="fv-six-dot-drag-dot" aria-hidden="true"></span><span class="fv-six-dot-drag-dot" aria-hidden="true"></span><span class="fv-six-dot-drag-dot" aria-hidden="true"></span></button><button type="button" class="member-move" data-direction="up" title="${escapeHtml(translate('editor.members.move-up', 'Move up'))}"><i class="fa fa-chevron-up" aria-hidden="true"></i></button><button type="button" class="member-move" data-direction="down" title="${escapeHtml(translate('editor.members.move-down', 'Move down'))}"><i class="fa fa-chevron-down" aria-hidden="true"></i></button></div>`;
                return `
                    <tr class="item" data-name="${name}" data-membership="${membership}" data-state="${stateKey}" draggable="false">
                        <td class="order-col">${orderControls}</td>
                        <td class="name-col"><span data-fvplus-style="fv-u-pyafsr" data-fv-onclick="setIconAsContainer(this)"><img src="${icon}" class="img" data-fv-onerror="this.src='${iconFallbackPath}';"></span>${name}</td>
                        <td><input class="container-switch" ${checked ? 'checked' : ''} ${locked ? 'disabled' : ''} type="checkbox" name="containers[]" value="${name}" data-fvplus-style="fv-u-569beu"></td>
                        <td><label class="fv-member-preview-toggle" title="${escapeHtml(translate('editor.members.toggle-preview-help', 'Keep this member in the folder but hide it from the collapsed preview'))}"><input class="member-preview-switch" type="checkbox" ${previewVisible ? 'checked' : ''} ${checked ? '' : 'disabled'}><span>${escapeHtml(translate('editor.members.visible', 'Visible'))}</span></label></td>
                    </tr>
                `;
            };

            const finalizeMemberListRender = () => {
                if (token !== memberListRenderToken) {
                    return;
                }
                jq('table.sortable > tbody > tr > td > input.container-switch').switchButton({ show_labels: false });
                jq('table.sortable > tbody > tr > td > input.container-switch:disabled').each(function() {
                    const input = jq(this);
                    input.closest('td').find('*').css('opacity', '0.5').css('cursor', 'default').off();
                    this.checked = true;
                });
                jq('.item').css('border-color', jq('body').css('color'));
                jq('.member-move').off('click').on('click', function() {
                    moveMemberRow(this, jq(this).data('direction'));
                });
                bindMemberDragReorder();
                renderFolderMembersSection();
                jq('input.container-switch').off('change').on('change', function() {
                    const row = jq(this).closest('tr');
                    const previewInput = row.find('input.member-preview-switch').get(0);
                    if (previewInput) {
                        previewInput.disabled = this.checked !== true;
                        if (this.checked !== true) {
                            previewInput.checked = true;
                            const name = String(row.attr('data-name') || '').trim();
                            if (name) {
                                hiddenPreviewMembers.delete(name);
                            }
                        }
                    }
                    updateMemberStats();
                    updateLiveSummary();
                    if (isFormInitialized()) {
                        validateForm();
                        updateUnsavedIndicator();
                    }
                });
                jq('input.member-preview-switch').off('change').on('change', function() {
                    const name = String(jq(this).closest('tr').attr('data-name') || '').trim();
                    if (name) {
                        if (this.checked === true) {
                            hiddenPreviewMembers.delete(name);
                        } else {
                            hiddenPreviewMembers.add(name);
                        }
                    }
                    updateMemberStats();
                    updateLiveSummary();
                    if (isFormInitialized()) {
                        validateForm();
                        updateUnsavedIndicator();
                    }
                });
                applyMemberFilters();
                updateMemberStats();
                updateLiveSummary();
                updateRegexSimulator();
                if (isFormInitialized()) {
                    validateForm();
                    updateUnsavedIndicator();
                }
                if (typeof afterRender === 'function') {
                    afterRender();
                }
            };

            if (rows.length <= renderChunkSize) {
                if (rows.length > 0) {
                    table.append(jq(rows.map((row) => renderRowHtml(row)).join('')));
                }
                finalizeMemberListRender();
                return;
            }
            let offset = 0;
            const appendChunk = () => {
                if (token !== memberListRenderToken) {
                    return;
                }
                const chunk = rows.slice(offset, offset + renderChunkSize);
                if (!chunk.length) {
                    finalizeMemberListRender();
                    return;
                }
                table.append(jq(chunk.map((row) => renderRowHtml(row)).join('')));
                offset += chunk.length;
                if (offset < rows.length) {
                    scheduleTask(appendChunk);
                    return;
                }
                finalizeMemberListRender();
            };
            appendChunk();
        };

        const dispose = () => {
            memberListRenderToken += 1;
            if (typeof jq === 'function') {
                jq('#fvFolderMembersBody').off('.fvChildFolderDrag');
                jq('.folder-member-move, .member-move').off('click');
                jq('input.container-switch, input.member-preview-switch').off('change');
            }
        };

        return Object.freeze({
            normalizeChildFolderOrder,
            setChildFolderOrder,
            getChildFolderOrder,
            getDirectChildFolderEntries,
            sortChildFolderEntries,
            syncChildFolderOrderFromTable,
            getChildFolderOrderIds,
            renderFolderMembersSection,
            updateList,
            dispose
        });
    };

    return Object.freeze({ createApi, normalizeChildFolderOrder });
}));
