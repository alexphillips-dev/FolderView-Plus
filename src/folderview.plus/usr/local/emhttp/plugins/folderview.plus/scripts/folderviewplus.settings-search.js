// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    const modules = root.FolderViewPlusFoundationModules || {};
    modules.settingsSearch = factory();
    root.FolderViewPlusFoundationModules = modules;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';

    const SETTINGS_SEARCH_FIELD_SELECTOR = [
        '[data-fv-search-item]',
        '.setting-toggle',
        '.setting-select',
        '.setting-inline-number',
        '.setting-button-row',
        '.fv-rule-builder-field',
        '.bulk-row',
        '.backup-compare-row',
        '.schedule-row',
        '.fv-theme-import-row',
        'label'
    ].join(',');
    const SETTINGS_SEARCH_CONTEXT_SELECTOR = [
        '.settings-mini-card',
        '.settings-privacy-section',
        '.fv-rule-stage',
        '.fv-recovery-stage',
        '.fv-operations-stage',
        '.bulk-stage-heading',
        '.rules-header',
        'summary'
    ].join(',');
    const SETTINGS_SEARCH_PRIVATE_SELECTOR = [
        'tbody',
        'option',
        'pre',
        '[role="listbox"]',
        '[data-fv-search-private]',
        '[id$="-list"]',
        '[id$="-output"]',
        '[id$="-suggestions"]',
        '[id$="-preview"]',
        '[id$="-result"]',
        '[id$="-summary"]',
        '[id$="-status"]',
        '[id$="-detail"]',
        '.fv-rule-list',
        '.bulk-items-list',
        '.fv-activity-feed-list',
        '.diagnostics-output',
        '.status-line'
    ].join(',');

    const normalizeText = (value) => String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const tokenize = (query) => Array.from(new Set(normalizeText(query).split(' ').filter(Boolean)));

    const createApi = (deps = {}) => {
        const runtimeWindow = deps.window || (typeof globalThis !== 'undefined' ? globalThis : null);
        const runtimeDocument = deps.document || runtimeWindow?.document || null;
        const getUiState = typeof deps.getUiState === 'function' ? deps.getUiState : (() => ({ sections: [] }));
        const getSectionAliases = typeof deps.getSectionAliases === 'function' ? deps.getSectionAliases : (() => '');
        const isBasicWorkspaceSection = typeof deps.isBasicWorkspaceSection === 'function'
            ? deps.isBasicWorkspaceSection
            : (() => false);
        const ElementConstructor = runtimeWindow?.Element;
        const HtmlElementConstructor = runtimeWindow?.HTMLElement;
        const HtmlButtonConstructor = runtimeWindow?.HTMLButtonElement;
        const HtmlDetailsConstructor = runtimeWindow?.HTMLDetailsElement;
        const isElement = (value) => typeof ElementConstructor === 'function' && value instanceof ElementConstructor;

        let index = [];
        let indexRevision = 0;
        let resultCache = null;
        let activeMatches = [];

        const matchesTokens = (text, tokens) => tokens.length > 0 && tokens.every((token) => text.includes(token));

        const invalidateIndex = () => {
            index = [];
            indexRevision += 1;
            resultCache = null;
        };

        const invalidateResults = () => {
            resultCache = null;
        };

        const getPrivacySafeText = (element) => {
            if (!isElement(element)) {
                return '';
            }
            const clone = element.cloneNode(true);
            if (isElement(clone)) {
                clone.querySelectorAll([
                    SETTINGS_SEARCH_PRIVATE_SELECTOR,
                    'input',
                    'select',
                    'textarea',
                    'script',
                    'style'
                ].join(',')).forEach((node) => node.remove());
            }
            const parts = [clone.textContent || ''];
            const attributeNodes = [element, ...Array.from(element.querySelectorAll('[aria-label], [title], [placeholder], [data-fv-search]'))];
            for (const node of attributeNodes) {
                if (node !== element && node.closest?.(SETTINGS_SEARCH_PRIVATE_SELECTOR)) {
                    continue;
                }
                for (const attribute of ['aria-label', 'title', 'placeholder', 'data-fv-search']) {
                    const value = String(node.getAttribute?.(attribute) || '').trim();
                    if (value) {
                        parts.push(value);
                    }
                }
            }
            return normalizeText(parts.join(' '));
        };

        const getFieldTarget = (control) => {
            if (!isElement(control)) {
                return null;
            }
            const field = control.closest(SETTINGS_SEARCH_FIELD_SELECTOR);
            return isElement(field) ? field : control;
        };

        const addIndexEntry = (entries, seenTargets, section, target, kind = 'field') => {
            if (!isElement(target) || seenTargets.has(target) || target.closest(SETTINGS_SEARCH_PRIVATE_SELECTOR)) {
                return;
            }
            const text = normalizeText([
                section.key,
                section.title,
                getPrivacySafeText(target)
            ].join(' '));
            if (!text) {
                return;
            }
            seenTargets.add(target);
            entries.push({ sectionKey: section.key, section, target, kind, text });
        };

        const buildIndex = () => {
            if (index.length > 0) {
                return index;
            }
            const entries = [];
            const state = getUiState();
            for (const section of state.sections || []) {
                const seenTargets = new Set();
                for (const sectionNode of section.nodes || []) {
                    if (!isElement(sectionNode)) {
                        continue;
                    }
                    const controls = sectionNode.matches?.('input, select, textarea, button') ? [sectionNode] : [];
                    controls.push(...Array.from(sectionNode.querySelectorAll('input, select, textarea, button')));
                    controls.forEach((control) => addIndexEntry(entries, seenTargets, section, getFieldTarget(control), 'field'));

                    const fields = sectionNode.matches?.(SETTINGS_SEARCH_FIELD_SELECTOR) ? [sectionNode] : [];
                    fields.push(...Array.from(sectionNode.querySelectorAll(SETTINGS_SEARCH_FIELD_SELECTOR)));
                    fields.forEach((field) => addIndexEntry(entries, seenTargets, section, field, 'field'));

                    const contexts = sectionNode.matches?.(SETTINGS_SEARCH_CONTEXT_SELECTOR) ? [sectionNode] : [];
                    contexts.push(...Array.from(sectionNode.querySelectorAll(SETTINGS_SEARCH_CONTEXT_SELECTOR)));
                    contexts.forEach((context) => addIndexEntry(entries, seenTargets, section, context, 'context'));
                }
                const sectionText = normalizeText([section.key, section.title, getSectionAliases(section)].join(' '));
                if (sectionText) {
                    entries.push({
                        sectionKey: section.key,
                        section,
                        target: section.heading,
                        kind: 'section',
                        text: sectionText
                    });
                }
            }
            index = entries;
            return index;
        };

        const getScopedSections = () => {
            const state = getUiState();
            return (state.sections || []).filter((section) => {
                if (state.mode === 'basic') {
                    return isBasicWorkspaceSection(section);
                }
                if (isBasicWorkspaceSection(section)) {
                    return false;
                }
                return state.searchAllAdvanced === true || section.advancedGroup === state.advancedTab;
            });
        };

        const reduceMatchesToSpecificTargets = (matches) => matches.filter((entry, entryIndex) => (
            !matches.some((candidate, candidateIndex) => (
                candidateIndex !== entryIndex
                && candidate.sectionKey === entry.sectionKey
                && entry.target !== candidate.target
                && entry.target.contains(candidate.target)
            ))
        ));

        const evaluate = () => {
            const state = getUiState();
            const tokens = tokenize(state.query);
            const cacheKey = [
                indexRevision,
                state.mode,
                state.advancedTab,
                state.searchAllAdvanced ? 'all' : 'current',
                tokens.join('|')
            ].join(':');
            if (resultCache?.key === cacheKey) {
                return resultCache.value;
            }
            if (tokens.length === 0) {
                const empty = { tokens, matches: [], sectionKeys: new Set(), total: 0 };
                resultCache = { key: cacheKey, value: empty };
                return empty;
            }
            const scopedSections = getScopedSections();
            const scopedKeys = new Set(scopedSections.map((section) => section.key));
            const entries = buildIndex();
            const matches = [];
            for (const section of scopedSections) {
                const sectionEntries = entries.filter((entry) => entry.sectionKey === section.key);
                const fieldMatches = sectionEntries.filter((entry) => entry.kind !== 'section' && matchesTokens(entry.text, tokens));
                if (fieldMatches.length > 0) {
                    matches.push(...reduceMatchesToSpecificTargets(fieldMatches));
                    continue;
                }
                const sectionMatch = sectionEntries.find((entry) => entry.kind === 'section' && matchesTokens(entry.text, tokens));
                if (sectionMatch) {
                    matches.push(sectionMatch);
                }
            }
            const uniqueMatches = matches.filter((entry, matchIndex) => (
                matches.findIndex((candidate) => candidate.target === entry.target) === matchIndex
                && scopedKeys.has(entry.sectionKey)
            ));
            const value = {
                tokens,
                matches: uniqueMatches,
                sectionKeys: new Set(uniqueMatches.map((entry) => entry.sectionKey)),
                total: uniqueMatches.length
            };
            resultCache = { key: cacheKey, value };
            return value;
        };

        const restoreOpenedDetails = () => {
            runtimeDocument?.querySelectorAll?.('details[data-fv-search-opened="1"]').forEach((details) => {
                details.open = false;
                delete details.dataset.fvSearchOpened;
            });
        };

        const ensureEmptyState = () => {
            let emptyState = runtimeDocument?.getElementById?.('fv-settings-search-empty');
            if (typeof HtmlElementConstructor === 'function' && emptyState instanceof HtmlElementConstructor) {
                return emptyState;
            }
            if (!runtimeDocument?.createElement) {
                return null;
            }
            emptyState = runtimeDocument.createElement('div');
            emptyState.id = 'fv-settings-search-empty';
            emptyState.className = 'fv-settings-search-empty';
            emptyState.hidden = true;
            emptyState.innerHTML = `
                <i class="fa fa-search" aria-hidden="true"></i>
                <div>
                    <strong>No settings found</strong>
                    <span>Try fewer words, another Advanced scope, or reset the search.</span>
                </div>
                <button type="button" data-fv-clear-settings-search><i class="fa fa-times" aria-hidden="true"></i> Reset search</button>
            `;
            runtimeDocument.getElementById('fv-settings-topbar')?.insertAdjacentElement('afterend', emptyState);
            return emptyState;
        };

        const renderFeedback = (evaluation) => {
            const hasQuery = tokenize(getUiState().query).length > 0;
            const total = Number(evaluation?.total || 0);
            const status = runtimeDocument?.getElementById?.('fv-settings-search-status');
            const clearButton = runtimeDocument?.getElementById?.('fv-settings-clear-search');
            if (status) {
                status.textContent = hasQuery
                    ? (total === 0 ? 'No settings found' : `${total} ${total === 1 ? 'setting' : 'settings'} found`)
                    : '';
                status.title = total > 0 ? 'Press Enter to jump to the first matching setting' : '';
            }
            if (typeof HtmlButtonConstructor === 'function' && clearButton instanceof HtmlButtonConstructor) {
                clearButton.hidden = !hasQuery;
            }
            const emptyState = ensureEmptyState();
            if (emptyState) {
                emptyState.hidden = !(hasQuery && total === 0);
            }
        };

        const syncPresentation = () => {
            runtimeDocument?.querySelectorAll?.('.fv-setting-search-match').forEach((element) => {
                element.classList.remove('fv-setting-search-match');
            });
            restoreOpenedDetails();
            const evaluation = evaluate();
            activeMatches = evaluation.matches.filter((entry) => entry.target?.isConnected);
            for (const entry of activeMatches) {
                entry.target.classList.add('fv-setting-search-match');
                const details = entry.target.closest('details');
                if (typeof HtmlDetailsConstructor === 'function' && details instanceof HtmlDetailsConstructor && !details.open) {
                    details.open = true;
                    details.dataset.fvSearchOpened = '1';
                }
            }
            renderFeedback(evaluation);
        };

        const focusFirstMatch = () => {
            const firstMatch = activeMatches.find((entry) => entry.target?.isConnected);
            if (!firstMatch) {
                return false;
            }
            const target = firstMatch.target;
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const focusTarget = target.matches('input, select, textarea, button, summary')
                ? target
                : target.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), summary');
            if (typeof HtmlElementConstructor === 'function' && focusTarget instanceof HtmlElementConstructor) {
                runtimeWindow.setTimeout(() => focusTarget.focus({ preventScroll: true }), 180);
            } else if (typeof HtmlElementConstructor === 'function' && target instanceof HtmlElementConstructor) {
                target.tabIndex = -1;
                runtimeWindow.setTimeout(() => target.focus({ preventScroll: true }), 180);
            }
            return true;
        };

        const dispose = () => {
            runtimeDocument?.querySelectorAll?.('.fv-setting-search-match').forEach((element) => {
                element.classList.remove('fv-setting-search-match');
            });
            restoreOpenedDetails();
            index = [];
            resultCache = null;
            activeMatches = [];
        };

        return Object.freeze({
            normalizeText,
            tokenize,
            invalidateIndex,
            invalidateResults,
            evaluate,
            syncPresentation,
            focusFirstMatch,
            dispose
        });
    };

    return Object.freeze({
        createApi,
        normalizeText,
        tokenize
    });
}));
