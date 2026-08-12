// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    const modules = root.FolderViewPlusFoundationModules || {};
    modules.wizardReview = factory();
    root.FolderViewPlusFoundationModules = modules;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';

    const createApi = (deps = {}) => {
        const getState = typeof deps.getState === 'function' ? deps.getState : (() => ({}));
        const getPrefs = typeof deps.getPrefs === 'function' ? deps.getPrefs : (() => ({}));
        const normalizePrefs = typeof deps.normalizePrefs === 'function' ? deps.normalizePrefs : ((value) => value || {});
        const applyProfileToPrefs = deps.applyProfileToPrefs;
        const applyBehaviorToPrefs = deps.applyBehaviorToPrefs;
        const buildTemplatePlan = deps.buildTemplatePlan;
        const previewRuleOutcomes = deps.previewRuleOutcomes;
        const validateImportPlans = deps.validateImportPlans;
        const getTemplateBootstrap = deps.getTemplateBootstrap;
        const getStepSequence = deps.getStepSequence;
        const getCurrentStepKey = deps.getCurrentStepKey;
        const escapeHtml = typeof deps.escapeHtml === 'function'
            ? deps.escapeHtml
            : ((value) => String(value ?? ''));
        const profilePresets = deps.profilePresets && typeof deps.profilePresets === 'object' ? deps.profilePresets : {};
        const environmentPresets = deps.environmentPresets && typeof deps.environmentPresets === 'object' ? deps.environmentPresets : {};

        const buildPrefsDiffForType = (type) => {
            const state = getState();
            const current = normalizePrefs(getPrefs(type) || {});
            let next = normalizePrefs({
                ...current,
                settingsMode: state.mode,
                setupWizardCompleted: true
            });
            if (state.applyProfileDefaults) {
                next = applyProfileToPrefs(next, state.profile);
            }
            next = applyBehaviorToPrefs(next, state.behavior[type]);

            const changes = [];
            const register = (label, currentValue, nextValue) => {
                if (String(currentValue ?? '') !== String(nextValue ?? '')) {
                    changes.push(label);
                }
            };
            register('settings mode', current.settingsMode || 'basic', next.settingsMode || 'basic');
            register('setup completed flag', current.setupWizardCompleted === true ? '1' : '0', next.setupWizardCompleted === true ? '1' : '0');
            register('sort mode', current.sortMode || 'created', next.sortMode || 'created');
            register('hide empty folders', current.hideEmptyFolders === true ? '1' : '0', next.hideEmptyFolders === true ? '1' : '0');
            register('status mode', current?.status?.mode || 'summary', next?.status?.mode || 'summary');
            register('status warn %', Number(current?.status?.warnStoppedPercent ?? 60), Number(next?.status?.warnStoppedPercent ?? 60));
            register('health cards', current?.health?.cardsEnabled !== false ? '1' : '0', next?.health?.cardsEnabled !== false ? '1' : '0');
            register('runtime badge', current?.health?.runtimeBadgeEnabled === true ? '1' : '0', next?.health?.runtimeBadgeEnabled === true ? '1' : '0');
            register('health profile', current?.health?.profile || 'balanced', next?.health?.profile || 'balanced');
            register('health updates mode', current?.health?.updatesMode || 'maintenance', next?.health?.updatesMode || 'maintenance');
            register('health all stopped mode', current?.health?.allStoppedMode || 'critical', next?.health?.allStoppedMode || 'critical');
            register('health critical %', Number(current?.health?.criticalStoppedPercent ?? 90), Number(next?.health?.criticalStoppedPercent ?? 90));
            if (state.applyProfileDefaults) {
                register('live refresh', current.liveRefreshEnabled === true ? '1' : '0', next.liveRefreshEnabled === true ? '1' : '0');
                register('refresh interval', Number(current.liveRefreshSeconds ?? 20), Number(next.liveRefreshSeconds ?? 20));
                register('performance profile', current.performanceProfile || (current.performanceMode === true ? 'adaptive' : 'standard'), next.performanceProfile || (next.performanceMode === true ? 'adaptive' : 'standard'));
                register('deferred previews', current.lazyPreviewEnabled === true ? '1' : '0', next.lazyPreviewEnabled === true ? '1' : '0');
                register('preview threshold', Number(current.lazyPreviewThreshold ?? 30), Number(next.lazyPreviewThreshold ?? 30));
            }
            return { count: changes.length, changes };
        };

        const buildImpactSummary = () => {
            const state = getState();
            const importByType = {};
            const importTotals = { creates: 0, updates: 0, deletes: 0, totalOps: 0 };
            const prefByType = {};
            let totalPrefChanges = 0;
            const templateByType = {};
            const templateTotals = {
                selected: 0,
                creatable: 0,
                skippedExisting: 0,
                autoAssignMatched: 0,
                autoAssignUnmatched: 0,
                autoAssignReviewNeeded: 0
            };

            for (const type of ['docker', 'vm']) {
                const plan = state.importPlans[type];
                const summary = plan?.summary || { creates: [], updates: [], deletes: [] };
                const includeImport = plan?.include === true && plan?.parsed;
                const creates = includeImport ? (summary.creates?.length || 0) : 0;
                const updates = includeImport ? (summary.updates?.length || 0) : 0;
                const deletes = includeImport ? (summary.deletes?.length || 0) : 0;
                const totalOps = creates + updates + deletes;
                importByType[type] = { creates, updates, deletes, totalOps };
                importTotals.creates += creates;
                importTotals.updates += updates;
                importTotals.deletes += deletes;
                importTotals.totalOps += totalOps;

                const diff = buildPrefsDiffForType(type);
                prefByType[type] = diff;
                totalPrefChanges += diff.count;

                const templatePlan = buildTemplatePlan(type);
                templateByType[type] = {
                    enabled: templatePlan.enabled,
                    selected: templatePlan.selectedCount,
                    creatable: templatePlan.creatable,
                    skippedExisting: templatePlan.skippedExisting,
                    autoAssignEnabled: templatePlan.autoAssignEnabled,
                    autoAssignMatched: templatePlan.assignment?.matched || 0,
                    autoAssignUnmatched: templatePlan.assignment?.unmatched || 0,
                    autoAssignReviewNeeded: templatePlan.assignment?.reviewNeededCount || 0,
                    autoAssignReviewItems: Array.isArray(templatePlan.assignment?.reviewItems) ? templatePlan.assignment.reviewItems.slice(0, 8) : [],
                    autoAssignItemDetails: Array.isArray(templatePlan.assignment?.itemDetails) ? templatePlan.assignment.itemDetails.slice(0, 12) : []
                };
                templateTotals.selected += templateByType[type].selected;
                templateTotals.creatable += templateByType[type].creatable;
                templateTotals.skippedExisting += templateByType[type].skippedExisting;
                templateTotals.autoAssignMatched += templateByType[type].autoAssignMatched;
                templateTotals.autoAssignUnmatched += templateByType[type].autoAssignUnmatched;
                templateTotals.autoAssignReviewNeeded += templateByType[type].autoAssignReviewNeeded;
            }

            const ruleDocker = previewRuleOutcomes('docker');
            const ruleVm = previewRuleOutcomes('vm');
            const rules = {
                docker: ruleDocker,
                vm: ruleVm,
                selected: ruleDocker.selected + ruleVm.selected,
                creatable: ruleDocker.creatable + ruleVm.creatable,
                duplicates: ruleDocker.duplicates + ruleVm.duplicates,
                unresolvedFolder: ruleDocker.unresolvedFolder + ruleVm.unresolvedFolder,
                invalidPattern: ruleDocker.invalidPattern + ruleVm.invalidPattern
            };
            return {
                imports: { byType: importByType, totals: importTotals },
                templates: { byType: templateByType, totals: templateTotals },
                prefs: { byType: prefByType, totalChanges: totalPrefChanges },
                rules,
                totalPlannedChanges: importTotals.totalOps + totalPrefChanges + rules.creatable + templateTotals.creatable + templateTotals.autoAssignMatched
            };
        };

        const getImpactDelta = (currentImpact, baselineImpact = null) => {
            const current = currentImpact && typeof currentImpact === 'object' ? currentImpact : buildImpactSummary();
            const baseline = baselineImpact && typeof baselineImpact === 'object'
                ? baselineImpact
                : (getState().impactBaseline || {
                    imports: { totals: { totalOps: 0 } },
                    templates: { totals: { creatable: 0, autoAssignMatched: 0 } },
                    prefs: { totalChanges: 0 },
                    rules: { creatable: 0 },
                    totalPlannedChanges: 0
                });
            const templateImpact = (value) => Number(value?.templates?.totals?.creatable || 0)
                + Number(value?.templates?.totals?.autoAssignMatched || 0);
            return {
                imports: Number(current.imports?.totals?.totalOps || 0) - Number(baseline.imports?.totals?.totalOps || 0),
                templates: templateImpact(current) - templateImpact(baseline),
                prefs: Number(current.prefs?.totalChanges || 0) - Number(baseline.prefs?.totalChanges || 0),
                rules: Number(current.rules?.creatable || 0) - Number(baseline.rules?.creatable || 0),
                total: Number(current.totalPlannedChanges || 0) - Number(baseline.totalPlannedChanges || 0)
            };
        };

        const getStepDeltaSummary = (stepKey, deltaSummary = null) => {
            const delta = deltaSummary && typeof deltaSummary === 'object'
                ? deltaSummary
                : getImpactDelta(buildImpactSummary());
            const chips = [];
            const addChip = (label, value, className = '') => {
                const amount = Number(value) || 0;
                if (amount === 0) {
                    return;
                }
                chips.push(`<span class="fv-setup-chip ${className}">${escapeHtml(label)} ${amount > 0 ? '+' : '-'}${Math.abs(amount)}</span>`);
            };
            if (stepKey === 'profile' || stepKey === 'behavior') {
                addChip('Settings', delta.prefs, 'is-update');
            } else if (stepKey === 'templates') {
                addChip('Starter folders', delta.templates, delta.templates < 0 ? 'is-delete' : 'is-create');
            } else if (stepKey === 'import') {
                addChip('Import ops', delta.imports, delta.imports < 0 ? 'is-delete' : 'is-update');
            } else if (stepKey === 'rules') {
                addChip('Starter rules', delta.rules, delta.rules < 0 ? 'is-delete' : 'is-create');
            } else if (stepKey === 'review' || stepKey === 'welcome') {
                addChip('Net impact', delta.total, delta.total < 0 ? 'is-delete' : 'is-update');
            }
            return chips.length ? chips.join('') : '<span class="fv-setup-chip">No delta on this step yet</span>';
        };

        const getStepValidation = (stepKey = getCurrentStepKey()) => {
            const state = getState();
            const step = String(stepKey || '').trim();
            const blockers = [];
            const warnings = [];
            if (step === 'profile') {
                if (state.applyProfileDefaults === true && !Object.prototype.hasOwnProperty.call(profilePresets, state.profile)) {
                    blockers.push('Choose a valid profile preset.');
                }
                if (state.applyEnvironmentDefaults === true && !Object.prototype.hasOwnProperty.call(environmentPresets, state.environmentPreset)) {
                    blockers.push('Choose a valid environment preset.');
                }
            }
            if (step === 'import' || step === 'review') {
                const result = validateImportPlans(state.importPlans);
                blockers.push(...result.blockers);
                warnings.push(...result.warnings);
            }
            if (step === 'templates' || step === 'review') {
                for (const type of ['docker', 'vm']) {
                    const bootstrap = getTemplateBootstrap(type);
                    if (bootstrap.enabled !== true) {
                        continue;
                    }
                    const plan = buildTemplatePlan(type);
                    if (plan.selectedCount <= 0) {
                        blockers.push(`${type.toUpperCase()} templates are enabled with no selected folders.`);
                    }
                    if (bootstrap.autoAssignExisting === true && bootstrap.category !== 'smart') {
                        warnings.push(`${type.toUpperCase()} auto-assign works only with Smart category and is currently disabled.`);
                    }
                }
            }
            if (step === 'behavior' || step === 'review') {
                for (const type of ['docker', 'vm']) {
                    const warn = Number(state.behavior?.[type]?.statusWarnStoppedPercent);
                    if (!Number.isFinite(warn) || warn < 0 || warn > 100) {
                        blockers.push(`${type.toUpperCase()} status warn threshold must be between 0 and 100.`);
                    }
                }
            }
            if (step === 'rules' || step === 'review') {
                for (const type of ['docker', 'vm']) {
                    const bootstrap = state.ruleBootstrap?.[type];
                    if (bootstrap?.enabled === true && (bootstrap.suggestions || []).filter((row) => row.enabled !== false).length <= 0) {
                        warnings.push(`${type.toUpperCase()} starter rules are enabled with no selected entries.`);
                    }
                }
            }
            if (step === 'review') {
                const impact = buildImpactSummary();
                if (impact.totalPlannedChanges <= 0 && state.dryRunOnly !== true) {
                    warnings.push('No changes are currently planned. Enable imports/rules or adjust behavior before apply.');
                }
                if (state.dryRunOnly === true) {
                    warnings.push('Dry run mode is ON. Apply will preview only and will not persist changes.');
                }
            }
            return { blockers, warnings };
        };

        const buildStepStatusMap = () => {
            const state = getState();
            return getStepSequence().map((stepKey, index) => {
                const isCurrent = index === state.step;
                const isPast = index < state.step;
                const validation = isCurrent ? getStepValidation(stepKey) : { blockers: [], warnings: [] };
                let status = 'ok';
                if (isPast) status = 'complete';
                else if (!isCurrent) status = 'pending';
                else if (validation.blockers.length > 0) status = 'blocked';
                else if (validation.warnings.length > 0) status = 'warn';
                return { key: stepKey, index, status, blockers: validation.blockers, warnings: validation.warnings };
            });
        };

        const buildFixHints = (_stepKey, validation) => {
            const hints = [];
            const addHint = (text) => {
                const value = String(text || '').trim();
                if (value && !hints.includes(value)) hints.push(value);
            };
            (validation?.blockers || []).forEach((message) => {
                if (/no file is selected/i.test(message)) addHint('Use "Select Docker/VM export" and keep Include enabled only for files you want to apply.');
                else if (/between 0 and 100/i.test(message)) addHint('Set status warn threshold to a value from 0 to 100 (recommended: 60).');
                else if (/valid profile preset/i.test(message)) addHint('Pick one of the available profile presets or disable "Apply profile defaults".');
                else if (/valid environment preset/i.test(message)) addHint('Choose a listed environment preset or disable "Apply environment defaults".');
                else if (/templates are enabled with no selected folders/i.test(message)) addHint('Use the Templates step to select at least one starter folder per enabled type.');
                else addHint(`Resolve: ${message}`);
            });
            (validation?.warnings || []).forEach((message) => {
                if (/legacy format/i.test(message)) addHint('Legacy imports are supported, but inspect the diff and icon/settings fields before applying.');
                else if (/replace mode will delete/i.test(message)) addHint('Switch import mode to Merge for a safer pass, or keep Replace only if cleanup is intentional.');
                else if (/no changes are currently planned/i.test(message)) addHint('Enable imports/rules or adjust behavior to produce at least one planned change.');
                else if (/dry run mode is on/i.test(message)) addHint('Turn off Dry run only when you are ready to persist changes.');
                else if (/auto-assign works only with smart category/i.test(message)) addHint('Switch category to Smart before enabling auto-assign for detected workloads.');
            });
            return hints.slice(0, 4);
        };

        const renderInlineGuidance = (stepKey, validation) => {
            if (!Array.isArray(validation?.blockers) || validation.blockers.length === 0) {
                return '';
            }
            const hints = buildFixHints(stepKey, validation);
            return hints.length ? `
                <section class="fv-setup-inline-guidance is-blocking" role="status" aria-live="polite" aria-atomic="true">
                    <div class="fv-setup-inline-guidance-title"><i class="fa fa-lightbulb-o"></i> How to fix before continuing</div>
                    <ul>${hints.map((hint) => `<li>${escapeHtml(hint)}</li>`).join('')}</ul>
                </section>
            ` : '';
        };

        return Object.freeze({
            buildPrefsDiffForType,
            buildImpactSummary,
            getImpactDelta,
            getStepDeltaSummary,
            buildStepStatusMap,
            getStepValidation,
            buildFixHints,
            renderInlineGuidance
        });
    };

    return Object.freeze({ createApi });
}));
