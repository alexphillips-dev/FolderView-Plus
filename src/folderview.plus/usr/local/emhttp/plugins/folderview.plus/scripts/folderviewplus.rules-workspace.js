(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) {
        const modules = root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
        modules.rulesWorkspace = api;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';
    const escapeLiteral = value => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const normalizeBuilderRule = ({ type, folderId, effect, kind, pattern, labelKey, labelValue }) => {
        const rule = { id: '', enabled: true, folderId: String(folderId || '').trim(), effect: effect === 'exclude' ? 'exclude' : 'include',
            kind: 'name_regex', pattern: '', labelKey: '', labelValue: '' };
        const simple = String(kind || '').match(/^(name|image|compose_project)_(contains|starts_with|ends_with|exact|equals)$/);
        if (simple && (type === 'docker' || simple[1] === 'name')) {
            rule.kind = `${simple[1]}_regex`;
            const literal = escapeLiteral(String(pattern || '').trim());
            if (!literal) return rule;
            rule.pattern = ['starts_with', 'exact', 'equals'].includes(simple[2]) ? `^${literal}` : literal;
            if (['ends_with', 'exact', 'equals'].includes(simple[2])) rule.pattern += '$';
        } else if (type === 'docker' && ['label', 'label_contains', 'label_starts_with'].includes(kind)) {
            rule.kind = kind;
            rule.labelKey = String(labelKey || '').trim();
            rule.labelValue = String(labelValue || '').trim();
        } else {
            rule.kind = type === 'docker' && ['image_regex', 'compose_project_regex'].includes(kind) ? kind : 'name_regex';
            rule.pattern = String(pattern || '').trim();
        }
        return rule;
    };
    const describeCondition = rule => {
        if (String(rule.kind).startsWith('label')) return { field: 'label', operator: rule.kind === 'label' ? 'exact' : rule.kind.slice(6),
            value: String(rule.labelValue || ''), labelKey: String(rule.labelKey || ''), regex: false };
        const field = rule.kind === 'image_regex' ? 'image' : (rule.kind === 'compose_project_regex' ? 'compose_project' : 'name');
        const pattern = String(rule.pattern || '');
        const trailingSlashes = pattern.match(/(\\*)\$$/)?.[1].length || 0;
        const start = pattern.startsWith('^'), end = pattern.endsWith('$') && trailingSlashes % 2 === 0;
        const body = pattern.slice(start ? 1 : 0, end ? -1 : undefined);
        const literal = body.replace(/\\([.*+?^${}()|[\]\\])/g, '$1');
        const regex = !literal || escapeLiteral(literal) !== body;
        return { field, operator: start && end ? 'exact' : (start ? 'starts_with' : (end ? 'ends_with' : 'contains')),
            value: regex ? pattern : literal, labelKey: '', regex };
    };
    const reorderRules = (rules, sourceId, targetId, after = false) => {
        if (sourceId === targetId) return null;
        const source = rules.findIndex(rule => rule.id === sourceId);
        if (source < 0 || !rules.some(rule => rule.id === targetId)) return null;
        const next = [...rules], [moved] = next.splice(source, 1);
        const target = next.findIndex(rule => rule.id === targetId);
        next.splice(target + (after ? 1 : 0), 0, moved);
        return next;
    };
    const createApi = (deps) => {
        const { document, window, ui } = deps;
        const translate = deps.translate;
        const root = document.getElementById('fv-settings-root');
        const hydrateIcons = () => {
            if (!root.querySelector('.fv-rules-redesign')?.getClientRects().length) return;
            root.querySelectorAll('[data-rule-icon]:empty').forEach(element => { element.innerHTML = ui.svgIcon(element.dataset.ruleIcon); });
        };
        const value = (type, key) => document.getElementById(`${type}-rule-${key}`);
        let drag = null, busy = false, menu = null;
        const saving = new Set();
        const controller = new window.AbortController();
        const on = (target, event, callback) => target.addEventListener(event, callback, { signal: controller.signal });
        const closeMenu = () => { menu?.close('refresh', { restoreFocus: false }); menu = null; };
        const sync = type => {
            hydrateIcons();
            if (saving.has(type)) return;
            const field = value(type, 'field').value;
            const regex = value(type, 'regex');
            regex.disabled = field === 'label';
            if (regex.disabled) regex.checked = false;
            const operator = value(type, 'operator');
            if (field === 'label' && operator.value === 'ends_with') operator.value = 'exact';
            value(type, 'kind').value = field === 'label'
                ? (operator.value === 'exact' ? 'label' : `label_${operator.value}`)
                : `${field}_${regex.checked ? 'regex' : operator.value}`;
            value(type, 'label-value').value = value(type, 'pattern').value;
            value(type, 'label-key').closest('.fv-rule-label-field').hidden = field !== 'label';
            const panel = document.querySelector(`.fv-rules-workspace[data-fv-rules-type="${type}"]`);
            panel.querySelectorAll('[data-rule-choice]').forEach(button => {
                const choice = button.dataset.ruleChoice;
                button.setAttribute('aria-pressed', String(value(type, choice).value === button.dataset.ruleValue));
                button.disabled = choice === 'operator' && (regex.checked || (field === 'label' && button.dataset.ruleValue === 'ends_with'));
            });
            if (field === 'label' || regex.checked) value(type, 'advanced').open = true;
            value(type, 'pattern').placeholder = regex.checked
                ? translate('settings.rules.regex-placeholder', 'Regex pattern (e.g. ^media-)')
                : translate('settings.rules.match-placeholder', 'e.g. arr, sonarr, audiobooks');
            deps.onDraftChange(type);
        };
        const setSaving = (type, pending) => {
            if (pending) saving.add(type); else saving.delete(type);
            document.querySelectorAll(`.fv-rules-workspace[data-fv-rules-type="${type}"] .fv-rule-create :is(input, select, button)`)
                .forEach(control => {
                    if (pending) control.dataset.ruleWasDisabled = String(control.disabled);
                    control.disabled = pending || control.dataset.ruleWasDisabled === 'true';
                    if (!pending) delete control.dataset.ruleWasDisabled;
                });
            if (!pending) sync(type);
        };
        const updateSuggestions = type => {
            const checked = document.querySelectorAll(`#${type}-rule-suggestions input:checked`).length;
            document.getElementById(`${type}-rules-save-suggestions`).disabled = checked === 0;
        };
        const reset = type => {
            value(type, 'editing').value = '';
            value(type, 'pattern').value = '';
            value(type, 'label-key').value = '';
            value(type, 'label-value').value = '';
            value(type, 'effect').value = 'include';
            document.getElementById(`${type}-rule-submit-copy`).textContent = translate('legacy.surface.a27cff51a2e03e61', 'Add rule');
            document.getElementById(`${type}-rule-submit-copy`).dataset.i18n = 'legacy.surface.a27cff51a2e03e61';
            document.getElementById(`${type}-rule-cancel-edit`).hidden = true;
            sync(type);
        };
        const edit = (type, rule) => {
            const condition = describeCondition(rule);
            value(type, 'editing').value = rule.id;
            value(type, 'folder').value = rule.folderId;
            value(type, 'effect').value = rule.effect;
            value(type, 'field').value = condition.field;
            value(type, 'operator').value = condition.operator;
            value(type, 'regex').checked = condition.regex;
            value(type, 'pattern').value = condition.value;
            value(type, 'label-key').value = condition.labelKey;
            document.getElementById(`${type}-rule-submit-copy`).textContent = translate('settings.rules.save-changes', 'Save changes');
            document.getElementById(`${type}-rule-submit-copy`).dataset.i18n = 'settings.rules.save-changes';
            document.getElementById(`${type}-rule-cancel-edit`).hidden = false;
            sync(type);
            value(type, 'pattern').scrollIntoView({ block: 'center', behavior: 'auto' });
            value(type, 'pattern').focus({ preventScroll: true });
        };
        const runMove = async (type, id, target, after, direction) => {
            if (busy) return;
            busy = true;
            try {
                if (direction) await deps.onMove(type, id, direction);
                else await deps.onReorder(type, id, target, after);
                const rows = document.querySelectorAll(`#${type}-rules [data-fv-rule-id]`);
                const active = document.activeElement;
                if (active === document.body || (active?.matches('[data-rule-drag]') && active.closest('[data-fv-rule-id]')?.dataset.fvRuleId === id)) {
                    [...rows].find(row => row.dataset.fvRuleId === id)?.querySelector('[data-rule-drag]')?.focus({ preventScroll: true });
                }
            } finally { busy = false; }
        };
        on(root, 'click', event => {
            const choice = event.target.closest('[data-rule-choice]');
            if (choice) {
                const type = choice.closest('[data-fv-rules-type]').dataset.fvRulesType;
                value(type, choice.dataset.ruleChoice).value = choice.dataset.ruleValue;
                sync(type);
            }
            const cancel = event.target.closest('[data-rule-cancel]');
            if (cancel) reset(cancel.dataset.ruleCancel);
            const tester = event.target.closest('[data-rule-tester]');
            if (tester) {
                const details = document.getElementById('fv-rules-tester');
                details.open = tester.dataset.ruleTester === 'open';
                document.querySelector('[data-rule-tester="open"]').setAttribute('aria-expanded', String(details.open));
                if (details.open) {
                    details.scrollIntoView({ block: 'start', behavior: 'auto' });
                    document.querySelector(`.fv-rule-troubleshoot-panel:not([hidden]) input`)?.focus({ preventScroll: true });
                } else document.querySelector('[data-rule-tester="open"]').focus();
            }
            const trigger = event.target.closest('[data-rule-menu]');
            if (!trigger) return;
            const row = trigger.closest('[data-fv-rule-id]'), type = row.dataset.ruleType, id = row.dataset.fvRuleId;
            const rule = deps.getRules(type).find(rule => rule.id === id);
            if (!rule) return;
            const index = deps.getRules(type).indexOf(rule);
            const actions = [
                ['edit', translate('edit', 'Edit'), false],
                ['toggle', rule.enabled ? translate('legacy.surface.b7e3e4aa4257b9a1', 'Disable') : translate('legacy.surface.5342e09f2729fbc6', 'Enable'), false],
                ['up', translate('legacy.surface.c66feb5eb8f217c7', 'Move up'), index === 0],
                ['down', translate('legacy.surface.40bb50da160cdc21', 'Move down'), index === deps.getRules(type).length - 1],
                ['delete', translate('legacy.surface.e2d0a54968ead24e', 'Delete'), false]
            ];
            menu = ui.openPopover({ trigger, className: 'fv-rules-menu', ariaLabel: translate('settings.rules.actions', 'Rule actions'),
                content: actions.map(([action, label, disabled]) => `<button type="button" class="fv-ui-button${action === 'delete' ? ' is-danger' : ''}" data-rule-menu-action="${action}" ${disabled ? 'disabled' : ''}>${ui.escapeHtml(label)}</button>`).join('') });
            menu?.element.addEventListener('click', async event => {
                const action = event.target.closest('[data-rule-menu-action]')?.dataset.ruleMenuAction;
                if (!action) return;
                closeMenu();
                if (action === 'edit') edit(type, rule);
                else if (action === 'up' || action === 'down') await runMove(type, id, null, false, action === 'up' ? -1 : 1);
                else await deps.onAction(type, id, action);
            });
        });
        on(root, 'input', event => {
            const panel = event.target.closest('.fv-rules-workspace');
            if (panel && event.target.closest('.fv-rule-create')) sync(panel.dataset.fvRulesType);
        });
        on(root, 'change', event => {
            const panel = event.target.closest('.fv-rules-workspace');
            if (!panel) return;
            if (event.target.closest('.fv-rule-create')) sync(panel.dataset.fvRulesType);
            if (event.target.matches('[data-smart-rule-index]')) updateSuggestions(panel.dataset.fvRulesType);
        });
        on(root, 'dragstart', event => {
            const handle = event.target.closest('[data-rule-drag]');
            if (!handle || busy) { if (handle) event.preventDefault(); return; }
            const row = handle.closest('[data-fv-rule-id]');
            drag = { id: row.dataset.fvRuleId, type: row.dataset.ruleType };
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', drag.id);
            row.classList.add('is-dragging');
        });
        on(root, 'dragover', event => {
            const row = event.target.closest('[data-fv-rule-id]');
            if (drag && row?.dataset.ruleType === drag.type) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }
        });
        on(root, 'drop', event => {
            const row = event.target.closest('[data-fv-rule-id]');
            if (!drag || !row || row.dataset.ruleType !== drag.type) return;
            event.preventDefault();
            const source = drag; drag = null;
            const rect = row.getBoundingClientRect();
            void runMove(source.type, source.id, row.dataset.fvRuleId, event.clientY > rect.top + rect.height / 2);
        });
        on(root, 'dragend', () => { drag = null; root.querySelectorAll('.is-dragging').forEach(row => row.classList.remove('is-dragging')); });
        on(root, 'keydown', event => {
            const handle = event.target.closest('[data-rule-drag]');
            if (!handle || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
            event.preventDefault();
            const row = handle.closest('[data-fv-rule-id]');
            void runMove(row.dataset.ruleType, row.dataset.fvRuleId, null, false, event.key === 'ArrowUp' ? -1 : 1);
        });
        const dispose = () => { closeMenu(); controller.abort(); };
        window.addEventListener('pagehide', dispose, { once: true });
        return { sync, reset, edit, updateSuggestions, closeMenu, dispose, hydrateIcons, setSaving, isSaving: type => saving.has(type) };
    };
    return { escapeLiteral, normalizeBuilderRule, describeCondition, reorderRules, createApi };
}));
