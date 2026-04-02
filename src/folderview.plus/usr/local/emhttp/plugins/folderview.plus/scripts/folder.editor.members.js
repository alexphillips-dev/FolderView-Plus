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
            syncMemberArraysFromTable();
            updateLiveSummary();
            if (isFormInitialized()) {
                updateUnsavedIndicator();
            }
        };

        return Object.freeze({
            applyMemberFilters,
            setVisibleMemberSelection,
            syncMemberArraysFromTable,
            moveMemberRow,
            syncMemberSearchUiState
        });
    };

    return Object.freeze({
        createApi
    });
}));
