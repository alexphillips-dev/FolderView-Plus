(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    modules.ruleTemplateWorkspace = factory();
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function() {
    'use strict';

    const createApi = (deps = {}) => {
        const model = deps.model;
        const type = deps.type === 'vm' ? 'vm' : 'docker';
        const escapeHtml = deps.escapeHtml || ((value) => String(value ?? ''));
        const getFolderId = deps.getFolderId || (() => '');
        const getContext = deps.getContext || (() => ({}));
        const getPrefs = deps.getPrefs || (() => ({}));
        const savePrefs = deps.savePrefs || (async () => {});
        const setMessage = deps.setMessage || (() => {});
        const requestRender = deps.render || (() => {});
        const isBusy = deps.isBusy || (() => false);
        const setBusy = deps.setBusy || (() => {});
        const utils = deps.utils || null;
        const extractError = deps.extractError || ((error) => String(error?.message || error)); const translate = deps.translate || ((key, fallback) => globalThis?.FolderViewPlusI18n?.t?.(key, fallback) || fallback || key);
        const templates = model?.listTemplates?.(type) || [];
        const draft = { templateId: templates[0]?.id || '', value: '', effect: 'include' };
        let preview = null;

        const selectedTemplate = () => templates.find((entry) => entry.id === draft.templateId) || templates[0];
        const buildCandidate = (withId = false) => model.buildTemplateRule({
            templateId: draft.templateId,
            type,
            folderId: getFolderId(),
            value: draft.value,
            effect: draft.effect,
            ...(withId ? {} : { id: 'template-preview' })
        });
        const insertRules = (rules, additions) => model?.insertBeforeCatchAll
            ? model.insertBeforeCatchAll(rules, additions)
            : [...(Array.isArray(rules) ? rules : []), ...(Array.isArray(additions) ? additions : [additions])];

        const buildHtml = () => {
            if (!model || templates.length === 0) {
                return '';
            }
            const selected = selectedTemplate();
            const disabled = isBusy() ? ' disabled' : '';
            const previewHtml = preview ? `
                <div class="fv-folder-rule-template-preview" role="status">
                    <span><strong>${escapeHtml(String(preview.matched.length))}</strong> matched</span>
                    <span><strong>${escapeHtml(String(preview.newlyAssigned.length))}</strong> newly assigned</span>
                    <span><strong>${escapeHtml(String(preview.alreadyControlled.length))}</strong> already controlled</span>
                    <span><strong>${escapeHtml(String(preview.manualMembers.length))}</strong> manual members unchanged</span>
                </div>` : '';
            return `
                <div class="fv-folder-rule-templates">
                    <div class="fv-folder-rule-templates-copy"><strong>${escapeHtml(translate('editor.rules.templates.title', 'Rule templates'))}</strong><span>${escapeHtml(translate('editor.rules.templates.help', 'Build a compatible rule, preview its current effect, or add one final catch-all. Manual folder members are never changed.'))}</span></div>
                    <div class="fv-folder-rule-template-fields">
                        <label><span>${escapeHtml(translate('editor.rules.templates.template-label', 'Template'))}</span><select id="fvFolderRuleTemplate"${disabled}>${templates.map((entry) => `<option value="${escapeHtml(entry.id)}"${entry.id === selected?.id ? ' selected' : ''}>${escapeHtml(entry.label)}</option>`).join('')}</select></label>
                        <label><span>Effect</span><select id="fvFolderRuleTemplateEffect"${disabled}><option value="include"${draft.effect === 'exclude' ? '' : ' selected'}>Include</option><option value="exclude"${draft.effect === 'exclude' ? ' selected' : ''}>Exclude</option></select></label>
                        <label class="is-value"><span>Match value</span><input id="fvFolderRuleTemplateValue" type="text" value="${escapeHtml(draft.value)}" placeholder="${escapeHtml(selected?.placeholder || 'Match value')}"${disabled}></label>
                    </div>
                    <div class="fv-folder-rule-template-actions">
                        <button type="button" data-fv-folder-rule-action="preview-template"${disabled}><i class="fa fa-eye" aria-hidden="true"></i> Preview template</button>
                        <button type="button" data-fv-folder-rule-action="apply-template"${disabled}><i class="fa fa-magic" aria-hidden="true"></i> Add template rule</button>
                        <button type="button" data-fv-folder-rule-action="add-catch-all"${disabled}><i class="fa fa-level-down" aria-hidden="true"></i> Add final catch-all</button>
                    </div>${previewHtml}
                </div>`;
        };

        const updateField = (field, value) => {
            if (field === 'template') {
                draft.templateId = String(value || '');
                requestRender();
            } else if (field === 'effect') {
                draft.effect = String(value || '') === 'exclude' ? 'exclude' : 'include';
            } else if (field === 'value') {
                draft.value = String(value || '');
            }
            preview = null;
        };

        const previewTemplate = () => {
            try {
                const context = getContext() || {};
                preview = model.previewRuleEffect({
                    rule: buildCandidate(), rules: getPrefs()?.autoRules || [], items: context.items,
                    folders: context.folders, type, utils
                });
                setMessage('Template preview refreshed. No settings were changed.', 'info');
            } catch (error) {
                preview = null;
                setMessage(String(error?.message || error), 'error');
            }
            requestRender();
        };

        const saveGenerated = async (rule, message) => {
            setBusy(true);
            setMessage('Saving generated rule...', 'info');
            requestRender();
            try {
                const prefs = getPrefs() || {};
                const rules = prefs.autoRules || [];
                const nextRules = model.isExplicitCatchAll(rule) ? [...rules, rule] : insertRules(rules, rule);
                await savePrefs({ ...prefs, autoRules: nextRules });
                draft.value = '';
                preview = null;
                setMessage(message, 'success');
            } catch (error) {
                setMessage(extractError(error, 'generated rule save'), 'error');
            } finally {
                setBusy(false);
                requestRender();
            }
        };

        const handleAction = async (action) => {
            if (!model || isBusy()) {
                return false;
            }
            if (action === 'preview-template') {
                previewTemplate();
                return true;
            }
            if (action === 'apply-template') {
                try {
                    await saveGenerated(buildCandidate(true), 'Template rule added before the final catch-all.');
                } catch (error) {
                    setMessage(String(error?.message || error), 'error');
                    requestRender();
                }
                return true;
            }
            if (action === 'add-catch-all') {
                const rules = getPrefs()?.autoRules || [];
                if (rules.some(model.isExplicitCatchAll)) {
                    setMessage('An explicit catch-all already exists. Reorder or remove it in the full Rules workspace.', 'warning');
                    requestRender();
                    return true;
                }
                try {
                    await saveGenerated(model.buildCatchAllRule({ folderId: getFolderId(), effect: draft.effect }), 'Final catch-all rule added.');
                } catch (error) {
                    setMessage(String(error?.message || error), 'error');
                    requestRender();
                }
                return true;
            }
            return false;
        };

        return Object.freeze({ buildHtml, updateField, handleAction, insertRules });
    };

    return Object.freeze({ createApi });
}));
