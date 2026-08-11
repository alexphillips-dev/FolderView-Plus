// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    root.FolderViewPlusFoundationModules = root.FolderViewPlusFoundationModules || {};
    root.FolderViewPlusFoundationModules.diagnosticsActions = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const REPAIR_ACTIONS = new Set([
        'sync_docker_order',
        'normalize_prefs',
        'repair_config_metadata',
        'repair_paths',
        'repair_missing_custom_icons',
        'repair_orphaned_members'
    ]);
    const cardId = (key) => `fv-diagnostics-card-${String(key || 'status').replace(/[^a-z0-9_-]/gi, '-')}`;

    const createApi = (deps = {}) => {
        const win = deps.window || (typeof window !== 'undefined' ? window : null);
        const doc = deps.document || win?.document || null;
        const runRepair = typeof deps.runRepair === 'function' ? deps.runRepair : (() => Promise.resolve(false));
        const setBusy = typeof deps.setBusy === 'function' ? deps.setBusy : (() => {});
        const showError = typeof deps.showError === 'function' ? deps.showError : (() => {});
        const escapeHtml = typeof deps.escapeHtml === 'function' ? deps.escapeHtml : ((value) => String(value ?? ''));
        const translate = typeof deps.translate === 'function' ? deps.translate : ((_key, fallback) => fallback);
        const svgIcon = typeof deps.svgIcon === 'function' ? deps.svgIcon : (() => '');
        const statusConfig = typeof deps.statusConfig === 'function' ? deps.statusConfig : (() => ({ icon: 'info-circle' }));
        const actionData = typeof deps.actionData === 'function' ? deps.actionData : (() => '{}');
        let actionsBound = false;

        const resolveRecommendedActionCardKey = (actionName, diagnostics = {}) => {
            const action = String(actionName || '').trim();
            if (action === 'sync_docker_order') return 'docker';
            if (action === 'repair_paths') return 'storage';
            if (action === 'repair_missing_custom_icons') return 'custom_icons';
            const dockerIssues = Number(diagnostics?.types?.docker?.integrityChecks?.issuesCount || 0);
            const vmIssues = Number(diagnostics?.types?.vm?.integrityChecks?.issuesCount || 0);
            if (action === 'repair_orphaned_members') {
                return Number(diagnostics?.types?.docker?.integrityChecks?.orphanedMembers?.count || 0) > 0
                    ? 'docker'
                    : 'vm';
            }
            return action === 'normalize_prefs' || action === 'repair_config_metadata'
                ? (dockerIssues > 0 || vmIssues <= 0 ? 'docker' : 'vm')
                : '';
        };

        const decorateCardsWithRecommendedActions = (cards = [], diagnostics = {}, summary = {}) => {
            const actionsByCard = new Map();
            (Array.isArray(summary?.recommendedActions) ? summary.recommendedActions : []).forEach((entry) => {
                const action = String(entry?.action || '').trim();
                const key = REPAIR_ACTIONS.has(action) ? resolveRecommendedActionCardKey(action, diagnostics) : '';
                if (!key) return;
                const actions = actionsByCard.get(key) || [];
                actions.push({
                    action,
                    label: String(entry?.label || 'Run recommended repair').trim(),
                    reason: String(entry?.reason || '').trim()
                });
                actionsByCard.set(key, actions);
            });
            return cards.map((card) => {
                const actions = actionsByCard.get(String(card?.key || '').trim()) || [];
                return {
                    ...card,
                    actions,
                    technicalDetails: Array.from(new Set([
                        ...(Array.isArray(card?.technicalDetails) ? card.technicalDetails : []),
                        ...actions.map((action) => action.reason).filter(Boolean)
                    ]))
                };
            });
        };

        const focusCard = ({ data = {} } = {}) => {
            const key = String(data?.key || '').replace(/[^a-z0-9_-]/gi, '-');
            const card = key ? doc?.getElementById?.(cardId(key)) : null;
            if (!card) return false;
            const details = card.querySelector('.fv-diagnostics-card-details');
            if (details) details.open = true;
            const reduceMotion = typeof win?.matchMedia === 'function'
                && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
            card.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
            card.focus?.({ preventScroll: true });
            card.classList.add('is-focused');
            win?.setTimeout?.(() => card.classList.remove('is-focused'), 1600);
            return true;
        };

        const confirmRepair = async ({ data = {}, trigger = null } = {}) => {
            const action = String(data?.action || '').trim();
            if (!REPAIR_ACTIONS.has(action)) {
                showError('Repair unavailable', new Error('The recommended diagnostics action is not supported.'));
                return false;
            }
            const label = String(data?.label || 'Run recommended repair').trim();
            const reason = String(data?.reason || '').trim();
            const createsBackup = ['repair_orphaned_members', 'repair_missing_custom_icons'].includes(action);
            const backupDetail = createsBackup
                ? 'A configuration backup is created before saved references are changed.'
                : '';
            const options = {
                title: 'Confirm changes',
                message: label,
                detail: [reason, backupDetail].filter(Boolean).join(' '),
                confirmLabel: 'Run repair',
                cancelLabel: 'Cancel',
                tone: 'warning'
            };
            const confirmed = typeof win?.FolderViewPlusUI?.confirm === 'function'
                ? await win.FolderViewPlusUI.confirm(options)
                : (typeof win?.confirm === 'function' && win.confirm([label, reason, backupDetail].filter(Boolean).join('\n\n')));
            if (!confirmed) return false;
            if (trigger) trigger.disabled = true;
            setBusy(true);
            try {
                return await runRepair(action);
            } finally {
                setBusy(false);
                if (trigger?.isConnected) trigger.disabled = false;
            }
        };

        const bindActions = () => {
            if (actionsBound || typeof win?.FolderViewPlusUI?.registerAction !== 'function') return false;
            win.FolderViewPlusUI.registerAction('diagnostics-focus-card', focusCard);
            win.FolderViewPlusUI.registerAction('diagnostics-repair', confirmRepair);
            actionsBound = true;
            return true;
        };

        const buildFindings = (model) => {
            if (!model.findings.length) {
                return `
                    <section class="fv-diagnostics-findings is-clear" aria-labelledby="fv-diagnostics-findings-title">
                        <div class="fv-diagnostics-findings-head">
                            <h3 id="fv-diagnostics-findings-title">${escapeHtml(translate('diagnostics.findings.title', 'Priority findings'))}</h3>
                        </div>
                        <div class="fv-diagnostics-clear-result">${svgIcon('check-circle')}<span><strong>${escapeHtml(translate('diagnostics.findings.none-title', 'No urgent issues detected'))}</strong><small>${escapeHtml(translate('diagnostics.findings.none-detail', 'Your system is operating normally.'))}</small></span></div>
                    </section>
                `;
            }
            const coreCardKeys = new Set(model.coreCards.map((card) => card.key));
            return `
                <section class="fv-diagnostics-findings" aria-labelledby="fv-diagnostics-findings-title">
                    <div class="fv-diagnostics-findings-head"><h3 id="fv-diagnostics-findings-title">${escapeHtml(translate('diagnostics.findings.title', 'Priority findings'))}</h3><span>${escapeHtml(`${model.findings.length} ${model.findings.length === 1 ? 'finding' : 'findings'}`)}</span></div>
                    <div class="fv-diagnostics-findings-list">
                        ${model.findings.map((finding) => {
                            const status = statusConfig(finding.status);
                            const content = `${svgIcon(status.icon)}<span><strong>${escapeHtml(finding.label)}</strong><small>${escapeHtml(finding.headline)}</small></span>`;
                            if (coreCardKeys.has(finding.key)) {
                                return `<button type="button" class="fv-diagnostics-finding is-${escapeHtml(finding.status)}" data-fv-ui-action="diagnostics-focus-card" data-fv-ui-action-data="${actionData({ key: finding.key })}" aria-controls="${escapeHtml(cardId(finding.key))}">${content}<i class="fa fa-angle-right" aria-hidden="true"></i></button>`;
                            }
                            return `<div class="fv-diagnostics-finding is-${escapeHtml(finding.status)} is-summary-only">${content}</div>`;
                        }).join('')}
                    </div>
                </section>
            `;
        };

        return Object.freeze({
            cardId,
            bindActions,
            focusCard,
            confirmRepair,
            resolveRecommendedActionCardKey,
            decorateCardsWithRecommendedActions,
            buildFindings
        });
    };

    return Object.freeze({ createApi, REPAIR_ACTIONS, cardId });
}));
