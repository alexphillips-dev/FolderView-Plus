// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusFolderEditorMembers = factory();
    root.FolderViewPlusFolderEditorMembersModuleLoaded = true;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const fallbackWindow = typeof globalThis !== 'undefined'
        ? globalThis
        : (typeof window !== 'undefined' ? window : null);
    const MEMBER_REGEX_SEARCH_FILTER = 'contains_regex';
    const MEMBER_SEARCH_PLACEHOLDER = 'Search members';
    const MEMBER_REGEX_SEARCH_PLACEHOLDER = 'Regex search members';
    const MEMBER_REGEX_SEARCH_HINT = 'Use a regex pattern such as sentry-.* to filter member names.';
    const MEMBER_BULK_SCOPE_VALUES = Object.freeze(new Set(['shown', 'included_shown', 'excluded_shown', 'all_included']));
    const ASSIGNMENT_REASONS = ['manual', 'label', 'regex', 'rule'];

    const buildAssignmentDetails = ({ utils, type, folders, prefs, folderId, draft, infoByName, order,
        ordering, memberIdentity, unnamedFolderName = '(unnamed)' }) => {
        const saved = Object.hasOwn(folders, folderId) ? folders[folderId] : null;
        let activeId = folderId;
        if (!saved) {
            activeId = '__folderview_editor_draft__';
            while (Object.hasOwn(folders, activeId)) activeId += '_';
        }
        const normalizedMembers = (record) => utils.normalizeFolderMembers(record?.containers || []);
        const savedMembers = new Set(normalizedMembers(saved));
        const draftMembers = normalizedMembers(draft);
        const preview = !saved || draft.name !== String(saved.name || '') || draft.regex !== String(saved.regex || '')
            || savedMembers.size !== draftMembers.length || draftMembers.some((name) => !savedMembers.has(name));
        const candidateFolders = preview ? { ...folders, [activeId]: { ...saved, ...draft } } : folders;
        const configuration = memberIdentity?.reconcileFolders(type, candidateFolders, infoByName)?.folders || candidateFolders;
        if (Array.isArray(order) && ordering) {
            order = ordering.reorderFolderSlotsInBaseOrder(order, configuration, prefs, {
                orderFolders: utils.orderFoldersByPrefs,
                isFolderToken: (entry) => entry.startsWith('folder-') && (type === 'vm' || Object.hasOwn(configuration, entry.slice(7)))
            });
        }
        const displayFolderIds = Array.isArray(order)
            ? order.filter((key) => typeof key === 'string' && key.startsWith('folder-')).map((key) => key.slice(7))
            : [];
        const snapshot = utils.buildMembershipSnapshot({ type, folders: configuration, rules: prefs?.autoRules, infoByName, displayFolderIds });
        const assignments = new Map();
        const liveCountByName = new Map();
        for (const [id, entry] of Object.entries(snapshot.byFolder)) {
            const configuredName = snapshot.configuration.folders[id].name;
            const folderName = configuredName || unnamedFolderName;
            const imported = snapshot.configuration.folders[id].membershipPolicy === 'folderview3';
            const importedManual = imported ? new Set(entry.manualMembers) : null;
            for (const name of entry.liveMembers) liveCountByName.set(name, (liveCountByName.get(name) || 0) + 1);
            for (const [name, reasons] of Object.entries(entry.reasonsByName)) {
                // The shared evaluator marks accepted FolderView3 matches as legacy. Describe only accepted matches.
                let reason = ASSIGNMENT_REASONS.find((value) => reasons.includes(value));
                if (reasons.includes('legacy')) {
                    if (importedManual?.has(name)) reason = 'manual';
                    else if (type === 'docker' && configuredName && utils.getFolderLabelValue(snapshot.factsByName[name]?.Labels) === configuredName) reason = 'label';
                    else reason = snapshot.decisionsByName[name]?.assignedRule?.kind === 'name_regex' ? 'regex' : 'rule';
                }
                if (!reason) continue;
                if (!assignments.has(name)) assignments.set(name, []);
                assignments.get(name).push({ id, folderName, reason });
            }
            if (id === activeId && imported) {
                for (const name of entry.manualMembers) {
                    if (!Object.hasOwn(snapshot.factsByName, name)) {
                        if (!assignments.has(name)) assignments.set(name, []);
                        assignments.get(name).push({ id, folderName, reason: 'manual' });
                    }
                }
            }
        }
        return {
            activeId,
            preview,
            rows: new Map([...assignments].map(([name, matches]) => {
                const liveOwnerId = snapshot.primaryOwnerByName[name];
                const owner = (Array.isArray(order) || liveCountByName.get(name) === 1)
                    ? matches.find(({ id }) => id === liveOwnerId) : null;
                const active = matches.find(({ id }) => id === activeId);
                return [name, { owner: owner || null, active: active || null, matches }];
            }))
        };
    };

    const createApi = (deps = {}) => {
        const win = deps.window || fallbackWindow;
        const $ = deps.$ || win?.jQuery || win?.$;
        const getAllMembers = typeof deps.getAllMembers === 'function' ? deps.getAllMembers : (() => []);
        const setMemberCollections = typeof deps.setMemberCollections === 'function' ? deps.setMemberCollections : (() => {});
        const updateMemberStats = typeof deps.updateMemberStats === 'function' ? deps.updateMemberStats : (() => {});
        const validateForm = typeof deps.validateForm === 'function' ? deps.validateForm : (() => {});
        const updateUnsavedIndicator = typeof deps.updateUnsavedIndicator === 'function' ? deps.updateUnsavedIndicator : (() => false);
        const updateLiveSummary = typeof deps.updateLiveSummary === 'function' ? deps.updateLiveSummary : (() => {});
        const isFormInitialized = typeof deps.isFormInitialized === 'function' ? deps.isFormInitialized : (() => false);
        const translate = (key, fallback, ...values) => deps.translate?.(key, fallback, ...values)
            || fallback.replace(/\$(\d+)/g, (token, number) => String(values[Number(number) - 1] ?? token));
        let assignmentInventory = {};
        let assignmentNames = [];
        let assignmentRows = new Map();
        let assignmentContext;
        let assignmentForm;
        let assignmentOrder;
        let assignmentRenderId = 0;
        let assignmentRenderQueued = false;
        let assignmentDisposed = false;

        const setAssignmentInventory = (infoByName, members) => {
            assignmentInventory = infoByName;
            assignmentNames = members.map(({ Name }) => Name);
        };

        const getReasonLabel = (reason) => ({
            manual: translate('editor.members.assignment-manual', 'Manually assigned'),
            label: translate('editor.members.assignment-label', 'Matched by label'),
            regex: translate('editor.members.assignment-regex', 'Matched by regex'),
            rule: translate('editor.members.assignment-rule', 'Matched by rule')
        }[reason]);

        const getAssignmentText = ({ owner, matches = [] } = {}, preview = false) => {
            const lines = [];
            if (owner) {
                lines.push(translate('editor.members.assignment-owner', 'Assigned to $1 · $2', owner.folderName, getReasonLabel(owner.reason)));
            }
            for (const match of matches) {
                if (match === owner) continue;
                lines.push(translate('editor.members.assignment-match', 'Matches $1 · $2', match.folderName, getReasonLabel(match.reason)));
            }
            const value = lines.join(' · ') || translate('editor.members.assignment-none', 'No folder assignment');
            return preview ? translate('editor.members.assignment-preview', 'Preview · $1', value) : value;
        };

        const refreshAssignmentDetails = () => {
            if (assignmentDisposed || !deps.getAssignmentContext
                || (!assignmentContext?.open && ![...assignmentRows.values()].some((details) => details.open))) return;
            assignmentRenderId += 1;
            if (assignmentRenderQueued) return;
            assignmentRenderQueued = true;
            Promise.resolve().then(async () => {
                assignmentRenderQueued = false;
                const renderId = assignmentRenderId;
                assignmentOrder ||= Promise.resolve().then(() => deps.readAssignmentOrder?.()).catch(() => null);
                const order = await assignmentOrder;
                if (assignmentDisposed || renderId !== assignmentRenderId) return;
                const context = deps.getAssignmentContext();
                if (!context?.utils?.buildMembershipSnapshot) return;
                const unnamedFolderName = translate('common.runtime.unnamed', '(unnamed)');
                const { rows, preview, activeId } = buildAssignmentDetails({ ...context, infoByName: assignmentInventory, order, unnamedFolderName });
                for (const [name, details] of assignmentRows) {
                    if (details.open && details.isConnected) details.lastElementChild.textContent = getAssignmentText(rows.get(name), preview);
                }
                if (!assignmentContext?.open || !assignmentContext.isConnected) return;
                const list = win.document.createElement('ul');
                for (const name of assignmentNames) {
                    const row = rows.get(name);
                    if (assignmentRows.has(name) || !row?.matches.some(({ id }) => id !== activeId)) continue;
                    const item = win.document.createElement('li');
                    const nameLabel = win.document.createElement('strong');
                    nameLabel.textContent = name;
                    item.append(nameLabel, win.document.createTextNode(` · ${getAssignmentText(row, preview)}`));
                    list.append(item);
                }
                assignmentContext.lastElementChild.replaceChildren(list.childElementCount ? list
                    : win.document.createTextNode(translate('editor.members.assignment-none', 'No folder assignment')));
            });
        };

        const createAssignmentDisclosure = (className, label) => {
            const details = win.document.createElement('details');
            details.className = className;
            const summary = win.document.createElement('summary');
            summary.textContent = label;
            const output = win.document.createElement('div');
            output.setAttribute('aria-live', 'polite');
            output.textContent = translate('editor.members.assignment-loading', 'Loading assignment…');
            details.append(summary, output);
            details.addEventListener('toggle', () => {
                if (details.open && details.isConnected) refreshAssignmentDetails();
            });
            return details;
        };

        const renderAssignmentDetails = () => {
            if (!deps.getAssignmentContext || deps.showAssignmentDetails?.() === false || assignmentDisposed) return;
            const table = $('table.sortable').get(0);
            if (!table) return;
            const form = table.closest('form');
            if (form && form !== assignmentForm) {
                $(assignmentForm).off('.fvMemberAssignment');
                assignmentForm = form;
                $(form).on('input.fvMemberAssignment change.fvMemberAssignment',
                    'input[name="name"], input[name="regex"], input[name="containers[]"]', refreshAssignmentDetails);
            }
            const nextRows = new Map();
            for (const row of table.querySelectorAll('tbody > tr[data-name]')) {
                const cell = row.querySelector('.name-col');
                if (!cell) continue;
                const name = row.dataset.name;
                const previous = assignmentRows.get(name);
                const details = previous || createAssignmentDisclosure('fv-member-assignment',
                    translate('editor.members.assignment-why', 'Why this folder?'));
                if (details.parentElement !== cell) cell.append(details);
                nextRows.set(name, details);
            }
            assignmentRows = nextRows;
            if (assignmentNames.some((name) => !assignmentRows.has(name))) {
                assignmentContext ||= createAssignmentDisclosure('fv-member-assignment-context',
                    translate('editor.members.assignment-elsewhere', 'Assigned to other folders'));
                if (!assignmentContext.isConnected) table.after(assignmentContext);
                assignmentContext.hidden = false;
            } else if (assignmentContext) {
                assignmentContext.hidden = true;
                assignmentContext.open = false;
            }
            refreshAssignmentDetails();
        };

        const disposeAssignmentDetails = () => {
            assignmentDisposed = true;
            $(assignmentForm).off('.fvMemberAssignment');
            assignmentRows.clear();
            assignmentInventory = {};
            assignmentNames = [];
        };

        const isRegexMemberSearchEnabled = () => (($ && $('#fvMemberFilter').val()) || 'all') === MEMBER_REGEX_SEARCH_FILTER;

        const isMemberReorderFiltered = () => {
            if (!$) {
                return false;
            }
            return String($('#fvMemberSearch').val() || '').trim() !== ''
                || String($('#fvMemberFilter').val() || 'all') !== 'all'
                || String($('#fvMemberStateFilter').val() || 'all') !== 'all';
        };

        const isLockedMemberRow = (row) => {
            if (!$ || !row) {
                return true;
            }
            const $row = $(row);
            return String($row.attr('data-membership') || '').trim().toLowerCase() === 'regex'
                || $row.find('input.container-switch:disabled').length > 0;
        };

        const commitMemberRowOrderChange = () => {
            syncMemberArraysFromTable();
            updateLiveSummary();
            if (isFormInitialized()) {
                validateForm();
                updateUnsavedIndicator();
            }
        };

        const setMemberDragState = () => {
            if (!$) {
                return;
            }
            const filtered = isMemberReorderFiltered();
            const disabledTitle = filtered
                ? 'Clear member search and filters before drag reordering.'
                : 'Drag to reorder this member.';
            $('table.sortable')
                .toggleClass('fv-member-drag-disabled', filtered)
                .attr('data-drag-disabled', filtered ? 'true' : null);
            $('table.sortable > tbody > tr').each((_, row) => {
                const $row = $(row);
                const locked = isLockedMemberRow(row);
                const draggable = !filtered && !locked;
                $row
                    .toggleClass('fv-member-row-locked', locked)
                    .toggleClass('fv-member-row-draggable', draggable)
                    .attr('draggable', 'false');
                $row.find('.member-drag-handle')
                    .toggleClass('is-disabled', !draggable)
                    .attr('aria-disabled', draggable ? 'false' : 'true')
                    .attr('draggable', draggable ? 'true' : 'false')
                    .attr('title', locked ? 'Auto-included members cannot be manually reordered.' : disabledTitle);
            });
        };

        const setMemberSearchValidationState = (message = '') => {
            if (!$) {
                return;
            }
            const $search = $('#fvMemberSearch');
            const input = $search.get(0);
            if (!input) {
                return;
            }
            const nextMessage = String(message || '').trim();
            if (typeof input.setCustomValidity === 'function') {
                input.setCustomValidity(nextMessage);
            }
            $search
                .attr('aria-invalid', nextMessage ? 'true' : 'false')
                .attr('title', nextMessage || (isRegexMemberSearchEnabled() ? MEMBER_REGEX_SEARCH_HINT : ''));
        };

        const syncMemberSearchUiState = () => {
            if (!$) {
                return;
            }
            const regexSearchEnabled = isRegexMemberSearchEnabled();
            $('#fvMemberSearch')
                .attr('placeholder', regexSearchEnabled ? MEMBER_REGEX_SEARCH_PLACEHOLDER : MEMBER_SEARCH_PLACEHOLDER)
                .attr('aria-label', regexSearchEnabled ? 'Search folder members using a regex' : 'Search folder members')
                .attr('autocomplete', 'off');
            if (!regexSearchEnabled) {
                setMemberSearchValidationState('');
            }
        };

        const applyMemberFilters = () => {
            if (!$) {
                return;
            }
            const rawQuery = ($('#fvMemberSearch').val() || '').trim();
            const query = rawQuery.toLowerCase();
            const filter = $('#fvMemberFilter').val() || 'all';
            const stateFilter = $('#fvMemberStateFilter').val() || 'all';
            const regexSearchEnabled = filter === MEMBER_REGEX_SEARCH_FILTER;
            let queryRegex = null;

            syncMemberSearchUiState();

            if (regexSearchEnabled && rawQuery) {
                try {
                    queryRegex = new RegExp(rawQuery, 'i');
                    setMemberSearchValidationState('');
                } catch (error) {
                    setMemberSearchValidationState(`Invalid regex: ${error.message}`);
                }
            } else {
                setMemberSearchValidationState('');
            }

            $('table.sortable > tbody > tr').each((_, row) => {
                const $row = $(row);
                const rawName = String($row.attr('data-name') || '');
                const name = rawName.toLowerCase();
                const membership = $row.attr('data-membership');
                const included = $row.find('input.container-switch').prop('checked');
                const state = String($row.attr('data-state') || 'stopped').trim().toLowerCase();
                const matchesQuery = regexSearchEnabled
                    ? (!rawQuery || (queryRegex ? queryRegex.test(rawName) : false))
                    : (!query || name.includes(query));

                let matchesFilter = true;
                if (filter === 'included') {
                    matchesFilter = included;
                } else if (filter === 'excluded') {
                    matchesFilter = !included;
                } else if (filter === 'regex') {
                    matchesFilter = membership === 'regex';
                } else if (filter === 'manual') {
                    matchesFilter = membership === 'manual';
                }

                let matchesState = true;
                if (stateFilter !== 'all') {
                    matchesState = state === stateFilter;
                }

                $row.toggle(matchesQuery && matchesFilter && matchesState);
            });

            setMemberDragState();
            updateMemberStats();
        };

        const setVisibleMemberSelection = (checked) => {
            if (!$) {
                return;
            }
            $('table.sortable > tbody > tr:visible').each((_, row) => {
                const input = $(row).find('input.container-switch').get(0);
                if (!input || input.disabled) {
                    return;
                }
                input.checked = checked === true;
                $(input).trigger('change');
            });
            applyMemberFilters();
            if (isFormInitialized()) {
                validateForm();
                updateUnsavedIndicator();
            }
        };

        const syncMemberArraysFromTable = () => {
            if (!$) {
                return;
            }
            const rows = $('table.sortable > tbody > tr');
            if (!rows.length) {
                return;
            }
            const memberMap = new Map(getAllMembers().map((member) => [member.Name, member]));
            const nextSelected = [];
            const nextChoose = [];
            const nextSelectedRegex = [];

            rows.each((_, row) => {
                const name = $(row).attr('data-name');
                const member = memberMap.get(name);
                if (!member) {
                    return;
                }
                const membership = $(row).attr('data-membership');
                const checked = $(row).find('input.container-switch').prop('checked');
                if (membership === 'regex') {
                    nextSelectedRegex.push(member);
                } else if (checked) {
                    nextSelected.push(member);
                } else {
                    nextChoose.push(member);
                }
            });

            setMemberCollections({
                selected: nextSelected,
                choose: nextChoose,
                selectedRegex: nextSelectedRegex
            });
        };

        const moveMemberRow = (button, direction) => {
            if (!$) {
                return;
            }
            const row = $(button).closest('tr');
            if (!row.length) {
                return;
            }
            let moved = false;
            if (direction === 'up') {
                const prev = row.prev('tr');
                if (prev.length) {
                    prev.before(row);
                    moved = true;
                }
            } else {
                const next = row.next('tr');
                if (next.length) {
                    next.after(row);
                    moved = true;
                }
            }
            if (!moved) {
                return;
            }
            commitMemberRowOrderChange();
        };

        const bindMemberDragReorder = () => {
            if (!$) {
                return;
            }
            const tableBody = $('table.sortable > tbody');
            if (!tableBody.length) {
                return;
            }

            let draggedRow = null;
            let moved = false;

            tableBody.off('.fvMemberDrag');
            tableBody
                .on('dragstart.fvMemberDrag', '.member-drag-handle', function(event) {
                    const originalEvent = event.originalEvent || event;
                    const row = $(this).closest('tr').get(0);
                    if (!row || isMemberReorderFiltered() || isLockedMemberRow(row)) {
                        event.preventDefault();
                        return false;
                    }
                    draggedRow = row;
                    moved = false;
                    $(row).addClass('is-dragging');
                    if (originalEvent.dataTransfer) {
                        originalEvent.dataTransfer.effectAllowed = 'move';
                        originalEvent.dataTransfer.setData('text/plain', String($(row).attr('data-name') || 'member'));
                    }
                    return true;
                })
                .on('dragover.fvMemberDrag', 'tr', function(event) {
                    if (!draggedRow || this === draggedRow || isMemberReorderFiltered() || isLockedMemberRow(this)) {
                        return;
                    }
                    event.preventDefault();
                    const originalEvent = event.originalEvent || event;
                    const rect = this.getBoundingClientRect();
                    const before = originalEvent.clientY < rect.top + (rect.height / 2);
                    const $target = $(this);
                    if (before) {
                        $target.before(draggedRow);
                    } else {
                        $target.after(draggedRow);
                    }
                    moved = true;
                })
                .on('drop.fvMemberDrag', 'tr', function(event) {
                    if (draggedRow) {
                        event.preventDefault();
                    }
                })
                .on('dragend.fvMemberDrag', 'tr', function() {
                    $('table.sortable > tbody > tr').removeClass('is-dragging');
                    if (draggedRow && moved) {
                        commitMemberRowOrderChange();
                    }
                    draggedRow = null;
                    moved = false;
                    setMemberDragState();
                });

            setMemberDragState();
        };

        const collectBulkMoveScope = (scope = 'shown') => {
            if (!$) {
                return {
                    scope: 'shown',
                    names: [],
                    skippedRegexNames: [],
                    candidateCount: 0,
                    movableCount: 0
                };
            }
            const resolvedScope = MEMBER_BULK_SCOPE_VALUES.has(String(scope || '').trim().toLowerCase())
                ? String(scope || '').trim().toLowerCase()
                : 'shown';
            const names = [];
            const skippedRegexNames = [];
            const seen = new Set();
            $('table.sortable > tbody > tr').each((_, row) => {
                const $row = $(row);
                const membership = String($row.attr('data-membership') || 'available').trim().toLowerCase();
                const visible = $row.is(':visible');
                const checked = $row.find('input.container-switch').prop('checked') === true;
                const name = String($row.attr('data-name') || '').trim();
                let includedByScope = false;
                if (resolvedScope === 'all_included') {
                    includedByScope = checked;
                } else if (resolvedScope === 'included_shown') {
                    includedByScope = visible && checked;
                } else if (resolvedScope === 'excluded_shown') {
                    includedByScope = visible && !checked;
                } else {
                    includedByScope = visible;
                }
                if (!includedByScope || !name) {
                    return;
                }
                if (membership === 'regex') {
                    skippedRegexNames.push(name);
                    return;
                }
                if (seen.has(name)) {
                    return;
                }
                seen.add(name);
                names.push(name);
            });
            return {
                scope: resolvedScope,
                names,
                skippedRegexNames,
                candidateCount: names.length + skippedRegexNames.length,
                movableCount: names.length
            };
        };

        return Object.freeze({
            applyMemberFilters,
            setVisibleMemberSelection,
            syncMemberArraysFromTable,
            moveMemberRow,
            bindMemberDragReorder,
            setMemberDragState,
            syncMemberSearchUiState,
            collectBulkMoveScope,
            setAssignmentInventory,
            refreshAssignmentDetails,
            renderAssignmentDetails,
            disposeAssignmentDetails
        });
    };

    return Object.freeze({
        createApi,
        buildAssignmentDetails
    });
}));
