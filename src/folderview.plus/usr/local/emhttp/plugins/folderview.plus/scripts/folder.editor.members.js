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
            collectBulkMoveScope
        });
    };

    return Object.freeze({
        createApi
    });
}));
