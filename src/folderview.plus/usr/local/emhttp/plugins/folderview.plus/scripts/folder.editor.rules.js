// @ts-check
(function fvplusFolderEditorRulesScope(window) {
    'use strict';

    const RULE_KIND_LABELS = Object.freeze({
        name_regex: 'Name regex',
        image_regex: 'Image regex',
        compose_project_regex: 'Compose project regex',
        label: 'Label equals',
        label_contains: 'Label contains',
        label_starts_with: 'Label starts with'
    });

    const createApi = (deps = {}) => {
        const rootWindow = deps.window || window;
        const rootDocument = deps.document || rootWindow.document;
        const $ = deps.$ || rootWindow.jQuery || rootWindow.$;
        const requestClient = rootWindow.FolderViewPlusRequest || null;
        const utils = deps.utils || rootWindow.FolderViewPlusUtils || null;
        const type = String(deps.type || rootWindow.FolderViewPlusFolderEditorPageType || 'docker').trim().toLowerCase() === 'vm'
            ? 'vm'
            : 'docker';
        const shouldRender = typeof deps.shouldRender === 'function' ? deps.shouldRender : (() => true);
        const getActiveFolderId = typeof deps.getActiveFolderId === 'function' ? deps.getActiveFolderId : (() => '');
        const escapeHtml = typeof deps.escapeHtml === 'function' ? deps.escapeHtml : ((value) => String(value ?? ''));
        const extractAjaxErrorMessage = typeof deps.extractAjaxErrorMessage === 'function'
            ? deps.extractAjaxErrorMessage
            : ((error, context = 'request') => String(error?.message || `Request failed for ${context}.`));
        const normalizePrefs = (prefs = {}) => (
            utils && typeof utils.normalizePrefs === 'function'
                ? utils.normalizePrefs(prefs)
                : (prefs && typeof prefs === 'object' ? prefs : {})
        );
        const defaultRulesConfig = type === 'docker'
            ? Object.freeze({
                regexKinds: Object.freeze(['name_regex', 'image_regex', 'compose_project_regex']),
                subjectLabel: 'container',
                nameRegexExample: '^media-',
                patternPlaceholders: Object.freeze({
                    image_regex: 'Regex pattern (example: linuxserver/)',
                    compose_project_regex: 'Regex pattern (example: ^media$)'
                })
            })
            : Object.freeze({
                regexKinds: Object.freeze(['name_regex']),
                subjectLabel: 'VM',
                nameRegexExample: '^Windows-',
                patternPlaceholders: Object.freeze({})
            });
        const rawRulesConfig = deps.ruleConfig && typeof deps.ruleConfig === 'object' ? deps.ruleConfig : defaultRulesConfig;
        const ruleRegexKindsSource = Array.isArray(rawRulesConfig.regexKinds) && rawRulesConfig.regexKinds.length > 0
            ? rawRulesConfig.regexKinds
            : defaultRulesConfig.regexKinds;
        const normalizedRuleRegexKinds = ruleRegexKindsSource
            .map((kind) => String(kind || '').trim().toLowerCase())
            .filter((kind) => Object.prototype.hasOwnProperty.call(RULE_KIND_LABELS, kind));
        const ruleRegexKinds = Object.freeze(normalizedRuleRegexKinds.length > 0
            ? normalizedRuleRegexKinds
            : defaultRulesConfig.regexKinds);
        const ruleSubjectLabel = String(rawRulesConfig.subjectLabel || defaultRulesConfig.subjectLabel || 'item').trim() || 'item';
        const nameRegexExample = String(rawRulesConfig.nameRegexExample || defaultRulesConfig.nameRegexExample || '^item-').trim() || '^item-';
        const rulePatternPlaceholders = rawRulesConfig.patternPlaceholders && typeof rawRulesConfig.patternPlaceholders === 'object'
            ? rawRulesConfig.patternPlaceholders
            : defaultRulesConfig.patternPlaceholders;
        const fullRulesWorkspaceHref = `/Settings/FolderViewPlus?fvMode=advanced&fvAdvancedTab=rules&fvSection=auto-assignment&fvRulesType=${encodeURIComponent(type)}`;

        let folderEditorPrefs = normalizePrefs({});
        let folderEditorPrefsLoaded = false;
        let folderEditorPrefsLoadPromise = null;
        let folderEditorPrefsLoading = false;
        let folderEditorRulesBusy = false;
        let folderEditorRuleDraft = {
            effect: 'include',
            kind: ruleRegexKinds[0] || 'name_regex',
            pattern: ''
        };
        let folderEditorRulesMessage = {
            tone: 'info',
            text: ''
        };

        const setFolderEditorRulesMessage = (text = '', tone = 'info') => {
            folderEditorRulesMessage = {
                tone: tone === 'error' ? 'error' : tone === 'success' ? 'success' : tone === 'warning' ? 'warning' : 'info',
                text: String(text || '').trim()
            };
        };

        const normalizeFolderEditorRuleKind = (kind) => {
            const normalized = String(kind || '').trim().toLowerCase();
            return Object.prototype.hasOwnProperty.call(RULE_KIND_LABELS, normalized)
                ? normalized
                : (ruleRegexKinds[0] || 'name_regex');
        };

        const getFolderEditorRuleKindLabel = (kind) => RULE_KIND_LABELS[normalizeFolderEditorRuleKind(kind)] || RULE_KIND_LABELS.name_regex;

        const getFolderEditorRulePatternPlaceholder = (kind) => {
            const normalized = normalizeFolderEditorRuleKind(kind);
            const configuredPlaceholder = String(rulePatternPlaceholders?.[normalized] || '').trim();
            if (configuredPlaceholder) {
                return configuredPlaceholder;
            }
            return `Regex pattern (example: ${nameRegexExample})`;
        };

        const buildFolderEditorRuleDescription = (rule) => {
            const effect = rule?.effect === 'exclude' ? 'Exclude' : 'Include';
            const kind = normalizeFolderEditorRuleKind(rule?.kind);
            const pattern = String(rule?.pattern || '').trim();
            const labelKey = String(rule?.labelKey || '').trim();
            const labelValue = String(rule?.labelValue || '').trim();
            if (kind === 'image_regex') {
                return `${effect} when the image name matches "${pattern || '(missing regex)'}".`;
            }
            if (kind === 'compose_project_regex') {
                return `${effect} when the compose project matches "${pattern || '(missing regex)'}".`;
            }
            if (kind === 'label') {
                return `${effect} when label ${labelKey || '(missing key)'} ${labelValue ? `equals "${labelValue}"` : 'exists'}.`;
            }
            if (kind === 'label_contains') {
                return `${effect} when label ${labelKey || '(missing key)'} contains "${labelValue || ''}".`;
            }
            if (kind === 'label_starts_with') {
                return `${effect} when label ${labelKey || '(missing key)'} starts with "${labelValue || ''}".`;
            }
            return `${effect} when the ${ruleSubjectLabel} name matches "${pattern || '(missing regex)'}".`;
        };

        const getFolderEditorRuleIssues = (rule) => {
            const issues = [];
            const kind = normalizeFolderEditorRuleKind(rule?.kind);
            const pattern = String(rule?.pattern || '').trim();
            if (ruleRegexKinds.includes(kind)) {
                if (!pattern) {
                    issues.push('Empty regex');
                } else {
                    try {
                        // eslint-disable-next-line no-new
                        new RegExp(pattern);
                    } catch (_error) {
                        issues.push('Invalid regex');
                    }
                }
            }
            return issues;
        };

        const getFolderEditorAutoRules = () => {
            const rules = Array.isArray(folderEditorPrefs?.autoRules) ? folderEditorPrefs.autoRules : [];
            const activeFolderId = String(getActiveFolderId() || '').trim();
            if (!activeFolderId) {
                return [];
            }
            return rules.filter((rule) => String(rule?.folderId || '').trim() === activeFolderId);
        };

        const loadFolderEditorPrefs = async ({
            forceReload = false
        } = {}) => {
            if (!requestClient || typeof requestClient.getJson !== 'function') {
                throw new Error('Advanced rule controls are unavailable because the shared request client did not load.');
            }
            if (folderEditorPrefsLoaded && !forceReload) {
                return folderEditorPrefs;
            }
            if (folderEditorPrefsLoading && folderEditorPrefsLoadPromise) {
                return folderEditorPrefsLoadPromise;
            }
            folderEditorPrefsLoading = true;
            folderEditorPrefsLoadPromise = (async () => {
                const response = await requestClient.getJson(`/plugins/folderview.plus/server/prefs.php?type=${encodeURIComponent(type)}`);
                if (response?.ok === false) {
                    throw new Error(String(response.error || 'Failed to load folder editor preferences.'));
                }
                folderEditorPrefs = normalizePrefs(response?.prefs || {});
                folderEditorPrefsLoaded = true;
                return folderEditorPrefs;
            })();
            try {
                return await folderEditorPrefsLoadPromise;
            } finally {
                folderEditorPrefsLoading = false;
            }
        };

        const saveFolderEditorPrefs = async (nextPrefs) => {
            if (!requestClient || typeof requestClient.postJson !== 'function') {
                throw new Error('Advanced rule controls are unavailable because the shared request client did not load.');
            }
            const response = await requestClient.postJson('/plugins/folderview.plus/server/prefs.php', {
                type,
                prefs: JSON.stringify(nextPrefs)
            });
            if (response?.ok === false) {
                throw new Error(String(response.error || 'Failed to save folder editor preferences.'));
            }
            folderEditorPrefs = normalizePrefs(response?.prefs || nextPrefs);
            folderEditorPrefsLoaded = true;
            return folderEditorPrefs;
        };

        const buildFolderAutoRulesPanelStatusHtml = () => {
            if (!folderEditorRulesMessage.text) {
                return '';
            }
            const tone = folderEditorRulesMessage.tone === 'error'
                ? 'is-error'
                : folderEditorRulesMessage.tone === 'success'
                    ? 'is-success'
                    : folderEditorRulesMessage.tone === 'warning'
                        ? 'is-warning'
                        : 'is-info';
            return `<div class="fv-folder-auto-rules-status ${tone}" role="status">${escapeHtml(folderEditorRulesMessage.text)}</div>`;
        };

        const buildFolderAutoRulesEmptyStateHtml = (message, detail) => `
            <div class="fv-folder-auto-rules-empty">
                <strong>${escapeHtml(message)}</strong>
                <span>${escapeHtml(detail)}</span>
            </div>
        `;

        const buildFolderAutoRuleCardHtml = (rule, globalIndex, totalRules) => {
            const issues = getFolderEditorRuleIssues(rule);
            const enabled = rule?.enabled !== false;
            const stateLabel = enabled ? 'Disable' : 'Enable';
            const chips = [
                `<span class="fv-folder-auto-rule-chip ${enabled ? 'is-active' : 'is-muted'}">${escapeHtml(enabled ? 'Active' : 'Disabled')}</span>`,
                `<span class="fv-folder-auto-rule-chip ${rule?.effect === 'exclude' ? 'is-warning' : 'is-info'}">${escapeHtml(rule?.effect === 'exclude' ? 'Exclude rule' : 'Include rule')}</span>`,
                `<span class="fv-folder-auto-rule-chip">${escapeHtml(getFolderEditorRuleKindLabel(rule?.kind))}</span>`,
                ...issues.map((issue) => `<span class="fv-folder-auto-rule-chip is-invalid">${escapeHtml(issue)}</span>`)
            ];
            return `
                <article class="fv-folder-auto-rule-card${enabled ? '' : ' is-disabled'}${issues.length > 0 ? ' is-invalid' : ''}" data-fv-folder-rule-id="${escapeHtml(String(rule?.id || ''))}">
                    <div class="fv-folder-auto-rule-card-top">
                        <span class="fv-folder-auto-rule-priority">Priority ${globalIndex + 1} of ${totalRules}</span>
                        <span class="fv-folder-auto-rule-kind">${escapeHtml(getFolderEditorRuleKindLabel(rule?.kind))}</span>
                    </div>
                    <div class="fv-folder-auto-rule-summary">${escapeHtml(buildFolderEditorRuleDescription(rule))}</div>
                    <div class="fv-folder-auto-rule-meta">${chips.join('')}</div>
                    <div class="fv-folder-auto-rule-actions">
                        <button type="button" data-fv-folder-rule-action="toggle" data-rule-id="${escapeHtml(String(rule?.id || ''))}"><i class="fa ${enabled ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i> ${escapeHtml(stateLabel)}</button>
                        <button type="button" data-fv-folder-rule-action="delete" data-rule-id="${escapeHtml(String(rule?.id || ''))}"><i class="fa fa-trash" aria-hidden="true"></i> Delete</button>
                    </div>
                </article>
            `;
        };

        const ensurePanel = () => {
            if (!shouldRender()) {
                return null;
            }
            const body = rootDocument.querySelector('.fv-section-shell[data-section-shell="rules"] .fv-section-shell-body');
            if (!(body instanceof rootWindow.HTMLElement)) {
                return null;
            }
            let panel = rootDocument.getElementById('fvFolderAutoRulesPanel');
            if (!(panel instanceof rootWindow.HTMLElement) || panel.parentElement !== body) {
                if (panel instanceof rootWindow.HTMLElement) {
                    panel.remove();
                }
                panel = rootDocument.createElement('section');
                panel.id = 'fvFolderAutoRulesPanel';
                panel.className = 'basic fv-modern-field-row is-rules-row fv-folder-auto-rules-panel';
                body.appendChild(panel);
            }
            return panel;
        };

        const render = () => {
            const panel = ensurePanel();
            if (!(panel instanceof rootWindow.HTMLElement)) {
                return;
            }
            const activeFolderId = String(getActiveFolderId() || '').trim();
            const rules = getFolderEditorAutoRules();
            const totalRules = Array.isArray(folderEditorPrefs?.autoRules) ? folderEditorPrefs.autoRules.length : 0;
            const busyAttr = folderEditorRulesBusy ? ' disabled' : '';
            const kinds = ruleRegexKinds.map((kind) => `
                <option value="${escapeHtml(kind)}"${folderEditorRuleDraft.kind === kind ? ' selected' : ''}>${escapeHtml(getFolderEditorRuleKindLabel(kind))}</option>
            `).join('');

            let bodyHtml = '';
            if (!requestClient || typeof requestClient.getJson !== 'function' || typeof requestClient.postJson !== 'function') {
                bodyHtml = buildFolderAutoRulesEmptyStateHtml(
                    'Advanced rule controls are unavailable.',
                    'The shared request client did not load, so plugin-wide auto-rules cannot be read or saved from this editor.'
                );
            } else if (!activeFolderId) {
                bodyHtml = buildFolderAutoRulesEmptyStateHtml(
                    'Save this folder first to create advanced rules.',
                    'Advanced auto-rules are stored in plugin settings and need a saved folder id before they can target this folder.'
                );
            } else if (folderEditorPrefsLoading && !folderEditorPrefsLoaded) {
                bodyHtml = buildFolderAutoRulesEmptyStateHtml(
                    'Loading advanced rules for this folder.',
                    'Reading the existing plugin-wide rule set now.'
                );
            } else {
                const listHtml = rules.length > 0
                    ? rules.map((rule) => {
                        const globalIndex = (folderEditorPrefs.autoRules || []).findIndex((entry) => entry.id === rule.id);
                        return buildFolderAutoRuleCardHtml(rule, globalIndex > -1 ? globalIndex : 0, Math.max(totalRules, 1));
                    }).join('')
                    : buildFolderAutoRulesEmptyStateHtml(
                        'No advanced rules target this folder yet.',
                        'Add a regex rule below, or open the full Rules workspace for label-based rules and global reordering.'
                    );
                bodyHtml = `
                    <div class="fv-folder-auto-rules-summary-row">
                        <span class="fv-folder-auto-rules-summary-pill">${escapeHtml(String(rules.length))} rule${rules.length === 1 ? '' : 's'} for this folder</span>
                        <span class="fv-folder-auto-rules-summary-pill">${escapeHtml(String(totalRules))} total plugin rule${totalRules === 1 ? '' : 's'}</span>
                    </div>
                    <div class="fv-folder-auto-rules-builder">
                        <label class="fv-folder-auto-rules-builder-field">
                            <span>Effect</span>
                            <select id="fvFolderAutoRulesEffect"${busyAttr}>
                                <option value="include"${folderEditorRuleDraft.effect === 'exclude' ? '' : ' selected'}>Include</option>
                                <option value="exclude"${folderEditorRuleDraft.effect === 'exclude' ? ' selected' : ''}>Exclude</option>
                            </select>
                        </label>
                        <label class="fv-folder-auto-rules-builder-field">
                            <span>Match on</span>
                            <select id="fvFolderAutoRulesKind"${busyAttr}>
                                ${kinds}
                            </select>
                        </label>
                        <label class="fv-folder-auto-rules-builder-field is-pattern">
                            <span>Pattern</span>
                            <input type="text" id="fvFolderAutoRulesPattern" value="${escapeHtml(folderEditorRuleDraft.pattern)}" placeholder="${escapeHtml(getFolderEditorRulePatternPlaceholder(folderEditorRuleDraft.kind))}"${busyAttr}>
                        </label>
                        <button type="button" class="fv-folder-auto-rules-add" data-fv-folder-rule-action="add"${busyAttr}><i class="fa fa-plus" aria-hidden="true"></i> Add rule</button>
                    </div>
                    <div class="fv-folder-auto-rules-list">
                        ${listHtml}
                    </div>
                `;
            }

            panel.innerHTML = `
                <dl>
                    <dt>Advanced auto-rules:</dt>
                    <dd>
                        <div class="fv-folder-auto-rules-head">
                            <div class="fv-folder-auto-rules-copy">
                                <strong>Rules targeting this folder</strong>
                                <span>Create regex-based plugin rules directly from the folder editor without leaving this page.</span>
                            </div>
                            <a class="fv-folder-auto-rules-link" href="${escapeHtml(fullRulesWorkspaceHref)}">Open full Rules workspace</a>
                        </div>
                        ${buildFolderAutoRulesPanelStatusHtml()}
                        ${bodyHtml}
                    </dd>
                </dl>
                <blockquote class="inline_help">
                    <span>These advanced rules use the plugin-wide engine and still run in global priority order. Use the full Rules workspace to reorder rules or build label-based matches.</span>
                </blockquote>
            `;

            if (!$ || panel.dataset.bound === '1') {
                return;
            }
            $(panel)
                .on('input', '#fvFolderAutoRulesPattern', function onFolderRulePatternInput() {
                    folderEditorRuleDraft.pattern = String($(this).val() || '');
                    $(this).attr('aria-invalid', 'false').removeAttr('title');
                })
                .on('change', '#fvFolderAutoRulesEffect', function onFolderRuleEffectChange() {
                    folderEditorRuleDraft.effect = String($(this).val() || 'include') === 'exclude' ? 'exclude' : 'include';
                })
                .on('change', '#fvFolderAutoRulesKind', function onFolderRuleKindChange() {
                    folderEditorRuleDraft.kind = normalizeFolderEditorRuleKind($(this).val());
                    const pattern = rootDocument.getElementById('fvFolderAutoRulesPattern');
                    if (pattern instanceof rootWindow.HTMLInputElement) {
                        pattern.placeholder = getFolderEditorRulePatternPlaceholder(folderEditorRuleDraft.kind);
                        pattern.setAttribute('aria-invalid', 'false');
                        pattern.removeAttribute('title');
                    }
                })
                .on('click', '[data-fv-folder-rule-action]', function onFolderRuleActionClick() {
                    const action = String($(this).attr('data-fv-folder-rule-action') || '').trim();
                    const ruleId = String($(this).attr('data-rule-id') || '').trim();
                    if (!action || folderEditorRulesBusy) {
                        return;
                    }
                    if (action === 'add') {
                        void addFolderEditorAutoRule();
                        return;
                    }
                    if (!ruleId) {
                        return;
                    }
                    if (action === 'toggle') {
                        void toggleFolderEditorAutoRule(ruleId);
                        return;
                    }
                    if (action === 'delete') {
                        void deleteFolderEditorAutoRule(ruleId);
                    }
                });
            panel.dataset.bound = '1';
        };

        const addFolderEditorAutoRule = async () => {
            const activeFolderId = String(getActiveFolderId() || '').trim();
            if (!activeFolderId || folderEditorRulesBusy) {
                return;
            }
            const patternInput = rootDocument.getElementById('fvFolderAutoRulesPattern');
            const pattern = String(folderEditorRuleDraft.pattern || '').trim();
            folderEditorRuleDraft.pattern = pattern;
            if (!pattern) {
                setFolderEditorRulesMessage('Regex pattern cannot be empty.', 'error');
                if (patternInput instanceof rootWindow.HTMLInputElement) {
                    patternInput.setAttribute('aria-invalid', 'true');
                    patternInput.setAttribute('title', 'Regex pattern cannot be empty.');
                    patternInput.focus();
                }
                render();
                return;
            }
            try {
                // eslint-disable-next-line no-new
                new RegExp(pattern);
            } catch (error) {
                setFolderEditorRulesMessage(`Invalid regex: ${error?.message || error}`, 'error');
                if (patternInput instanceof rootWindow.HTMLInputElement) {
                    patternInput.setAttribute('aria-invalid', 'true');
                    patternInput.setAttribute('title', String(error?.message || error));
                    patternInput.focus();
                }
                render();
                return;
            }

            folderEditorRulesBusy = true;
            setFolderEditorRulesMessage('Saving advanced rule...', 'info');
            render();
            try {
                const nextRule = {
                    id: `rule-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
                    enabled: true,
                    folderId: activeFolderId,
                    effect: folderEditorRuleDraft.effect === 'exclude' ? 'exclude' : 'include',
                    kind: normalizeFolderEditorRuleKind(folderEditorRuleDraft.kind),
                    pattern,
                    labelKey: '',
                    labelValue: ''
                };
                const nextPrefs = normalizePrefs({
                    ...folderEditorPrefs,
                    autoRules: [...(folderEditorPrefs.autoRules || []), nextRule]
                });
                await saveFolderEditorPrefs(nextPrefs);
                folderEditorRuleDraft.pattern = '';
                setFolderEditorRulesMessage('Advanced rule saved for this folder.', 'success');
            } catch (error) {
                setFolderEditorRulesMessage(extractAjaxErrorMessage(error, 'folder advanced rule save'), 'error');
            } finally {
                folderEditorRulesBusy = false;
                render();
            }
        };

        const toggleFolderEditorAutoRule = async (ruleId) => {
            if (!ruleId || folderEditorRulesBusy) {
                return;
            }
            const rules = [...(folderEditorPrefs.autoRules || [])];
            const index = rules.findIndex((rule) => String(rule?.id || '') === ruleId);
            if (index === -1) {
                return;
            }
            folderEditorRulesBusy = true;
            setFolderEditorRulesMessage('Updating advanced rule...', 'info');
            render();
            try {
                rules[index] = {
                    ...rules[index],
                    enabled: rules[index].enabled === false
                };
                await saveFolderEditorPrefs({
                    ...folderEditorPrefs,
                    autoRules: rules
                });
                setFolderEditorRulesMessage('Advanced rule updated.', 'success');
            } catch (error) {
                setFolderEditorRulesMessage(extractAjaxErrorMessage(error, 'folder advanced rule update'), 'error');
            } finally {
                folderEditorRulesBusy = false;
                render();
            }
        };

        const deleteFolderEditorAutoRule = async (ruleId) => {
            if (!ruleId || folderEditorRulesBusy) {
                return;
            }
            folderEditorRulesBusy = true;
            setFolderEditorRulesMessage('Deleting advanced rule...', 'info');
            render();
            try {
                await saveFolderEditorPrefs({
                    ...folderEditorPrefs,
                    autoRules: (folderEditorPrefs.autoRules || []).filter((rule) => String(rule?.id || '') !== ruleId)
                });
                setFolderEditorRulesMessage('Advanced rule deleted.', 'success');
            } catch (error) {
                setFolderEditorRulesMessage(extractAjaxErrorMessage(error, 'folder advanced rule delete'), 'error');
            } finally {
                folderEditorRulesBusy = false;
                render();
            }
        };

        const refresh = async ({
            forceReload = false
        } = {}) => {
            render();
            const activeFolderId = String(getActiveFolderId() || '').trim();
            if (!shouldRender() || !activeFolderId) {
                return;
            }
            if (!requestClient || typeof requestClient.getJson !== 'function') {
                return;
            }
            if (folderEditorPrefsLoaded && !forceReload) {
                return;
            }
            try {
                await loadFolderEditorPrefs({ forceReload });
            } catch (error) {
                setFolderEditorRulesMessage(extractAjaxErrorMessage(error, 'folder advanced rules'), 'error');
            }
            render();
        };

        return Object.freeze({
            refresh
        });
    };

    window.FolderViewPlusFolderEditorRules = Object.freeze({
        createApi
    });
    window.FolderViewPlusFolderEditorRulesModuleLoaded = true;
})(window);
