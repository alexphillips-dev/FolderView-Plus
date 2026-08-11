// @ts-check
(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
        return;
    }
    const modules = root.FolderViewPlusFoundationModules || {};
    modules.wizardPersistence = factory();
    root.FolderViewPlusFoundationModules = modules;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';

    const createApi = (deps = {}) => {
        const runtimeWindow = deps.window || (typeof globalThis !== 'undefined' ? globalThis : null);
        const getStorage = () => {
            try {
                return deps.storage || deps.getStorage?.() || runtimeWindow?.localStorage || null;
            } catch (_error) {
                return null;
            }
        };
        const getState = typeof deps.getState === 'function' ? deps.getState : (() => ({}));
        const constants = deps.constants && typeof deps.constants === 'object' ? deps.constants : {};
        const profilePresets = deps.profilePresets && typeof deps.profilePresets === 'object' ? deps.profilePresets : {};
        const normalizeExperienceMode = deps.normalizeExperienceMode;
        const normalizeSafetyMode = deps.normalizeSafetyMode;
        const normalizeQuickPreset = deps.normalizeQuickPreset;
        const normalizeEnvironmentPreset = deps.normalizeEnvironmentPreset;
        const normalizeImportMode = deps.normalizeImportMode;
        const normalizeTemplateCategory = deps.normalizeTemplateCategory;
        const normalizeTemplateSelections = deps.normalizeTemplateSelections;
        const normalizeRuleSuggestions = deps.normalizeRuleSuggestions;
        const normalizeBehavior = deps.normalizeBehavior;
        const createImportPlan = deps.createImportPlan;
        const getTemplateBootstrap = deps.getTemplateBootstrap;
        const refreshTemplateSelection = deps.refreshTemplateSelection;
        const refreshTemplateSelections = deps.refreshTemplateSelections;
        const summarizeImportPlan = deps.summarizeImportPlan;
        const clampStep = deps.clampStep;
        const getStepSequence = deps.getStepSequence;
        const maxPresets = Math.max(1, Number(constants.presetsMax) || 20);

        const serializeImportPlan = (plan, includeSource = true) => ({
            include: plan?.include === true,
            mode: normalizeImportMode(plan?.mode),
            ...(includeSource ? {
                fileName: String(plan?.fileName || ''),
                fileSizeBytes: Number(plan?.fileSizeBytes) || 0,
                fileLastModified: String(plan?.fileLastModified || ''),
                parsed: plan?.parsed || null
            } : {})
        });

        const serializeTemplateBootstrap = (type, bootstrap) => ({
            enabled: bootstrap?.enabled === true,
            category: normalizeTemplateCategory(type, bootstrap?.category || 'smart'),
            selectedTemplateNames: normalizeTemplateSelections(bootstrap?.selectedTemplateNames || []),
            autoAssignExisting: bootstrap?.autoAssignExisting === true
        });

        const serializeBehavior = (state) => ({
            docker: normalizeBehavior('docker', state.behavior?.docker || {}),
            vm: normalizeBehavior('vm', state.behavior?.vm || {})
        });

        const serializeDraft = () => {
            const state = getState();
            return {
                version: constants.version,
                savedAt: new Date().toISOString(),
                step: Number(state.step) || 0,
                route: String(state.route || 'new'),
                mode: String(state.mode || 'basic'),
                experienceMode: normalizeExperienceMode(state.experienceMode),
                applySafetyMode: normalizeSafetyMode(state.applySafetyMode),
                selectedPresetId: String(state.selectedPresetId || ''),
                presetDraftName: String(state.presetDraftName || ''),
                quickPreset: normalizeQuickPreset(state.quickPreset),
                profile: String(state.profile || 'balanced'),
                applyProfileDefaults: state.applyProfileDefaults === true,
                environmentPreset: normalizeEnvironmentPreset(state.environmentPreset),
                applyEnvironmentDefaults: state.applyEnvironmentDefaults !== false,
                dryRunOnly: state.dryRunOnly === true,
                focusModeEnabled: state.focusModeEnabled !== false,
                collapsedChipRows: state.collapsedChipRows && typeof state.collapsedChipRows === 'object'
                    ? { ...state.collapsedChipRows }
                    : {},
                importPlans: {
                    docker: serializeImportPlan(state.importPlans?.docker),
                    vm: serializeImportPlan(state.importPlans?.vm)
                },
                templateBootstrap: {
                    docker: serializeTemplateBootstrap('docker', state.templateBootstrap?.docker),
                    vm: serializeTemplateBootstrap('vm', state.templateBootstrap?.vm)
                },
                ruleBootstrap: {
                    docker: {
                        enabled: state.ruleBootstrap?.docker?.enabled === true,
                        suggestions: normalizeRuleSuggestions(state.ruleBootstrap?.docker?.suggestions || [])
                    },
                    vm: {
                        enabled: state.ruleBootstrap?.vm?.enabled === true,
                        suggestions: normalizeRuleSuggestions(state.ruleBootstrap?.vm?.suggestions || [])
                    }
                },
                behavior: serializeBehavior(state)
            };
        };

        const persistDraft = () => {
            const state = getState();
            const storage = getStorage();
            if (!state.open || state.applying || !storage) {
                return;
            }
            try {
                storage.setItem(constants.draftStorageKey, JSON.stringify(serializeDraft()));
            } catch (_error) {
                // Local storage is optional; the wizard remains functional without draft persistence.
            }
        };

        const clearDraft = () => {
            try {
                getStorage()?.removeItem?.(constants.draftStorageKey);
            } catch (_error) {
                // Local storage is optional.
            }
        };

        const readPresetStore = () => {
            try {
                const raw = getStorage()?.getItem?.(constants.presetsStorageKey);
                if (!raw) {
                    return [];
                }
                const parsed = JSON.parse(raw);
                if (!Array.isArray(parsed)) {
                    return [];
                }
                return parsed.filter((entry) => (
                    entry
                    && typeof entry === 'object'
                    && String(entry.id || '').trim()
                    && String(entry.name || '').trim()
                    && entry.payload
                    && typeof entry.payload === 'object'
                )).slice(0, maxPresets);
            } catch (_error) {
                return [];
            }
        };

        const writePresetStore = (rows) => {
            const safeRows = Array.isArray(rows) ? rows.slice(0, maxPresets) : [];
            try {
                getStorage()?.setItem?.(constants.presetsStorageKey, JSON.stringify(safeRows));
            } catch (_error) {
                // Local storage is optional.
            }
        };

        const buildPresetPayload = () => {
            const state = getState();
            return {
                route: String(state.route || 'new'),
                mode: String(state.mode || 'basic'),
                experienceMode: normalizeExperienceMode(state.experienceMode),
                applySafetyMode: normalizeSafetyMode(state.applySafetyMode),
                quickPreset: normalizeQuickPreset(state.quickPreset),
                profile: String(state.profile || 'balanced'),
                applyProfileDefaults: state.applyProfileDefaults === true,
                environmentPreset: normalizeEnvironmentPreset(state.environmentPreset),
                applyEnvironmentDefaults: state.applyEnvironmentDefaults !== false,
                dryRunOnly: state.dryRunOnly === true,
                focusModeEnabled: state.focusModeEnabled !== false,
                importPlans: {
                    docker: serializeImportPlan(state.importPlans?.docker, false),
                    vm: serializeImportPlan(state.importPlans?.vm, false)
                },
                templateBootstrap: {
                    docker: serializeTemplateBootstrap('docker', state.templateBootstrap?.docker),
                    vm: serializeTemplateBootstrap('vm', state.templateBootstrap?.vm)
                },
                ruleBootstrap: {
                    docker: { enabled: state.ruleBootstrap?.docker?.enabled === true },
                    vm: { enabled: state.ruleBootstrap?.vm?.enabled === true }
                },
                behavior: serializeBehavior(state)
            };
        };

        const applyPresetPayload = (payload) => {
            if (!payload || typeof payload !== 'object') {
                return false;
            }
            const state = getState();
            state.route = ['new', 'migrate', 'advanced'].includes(String(payload.route || ''))
                ? String(payload.route)
                : state.route;
            state.mode = String(payload.mode || '').toLowerCase() === 'advanced' ? 'advanced' : 'basic';
            state.experienceMode = normalizeExperienceMode(payload.experienceMode);
            state.applySafetyMode = normalizeSafetyMode(payload.applySafetyMode);
            state.quickPreset = normalizeQuickPreset(payload.quickPreset);
            state.profile = Object.prototype.hasOwnProperty.call(profilePresets, String(payload.profile || ''))
                ? String(payload.profile)
                : state.profile;
            state.applyProfileDefaults = payload.applyProfileDefaults === true;
            state.environmentPreset = normalizeEnvironmentPreset(payload.environmentPreset);
            state.applyEnvironmentDefaults = payload.applyEnvironmentDefaults !== false;
            state.dryRunOnly = payload.dryRunOnly === true;
            state.focusModeEnabled = payload.focusModeEnabled !== false;
            state.collapsedChipRows = {};

            for (const type of ['docker', 'vm']) {
                const incomingPlan = payload.importPlans?.[type];
                if (incomingPlan && typeof incomingPlan === 'object') {
                    state.importPlans[type].include = incomingPlan.include === true;
                    state.importPlans[type].mode = normalizeImportMode(incomingPlan.mode);
                    summarizeImportPlan(type);
                }
                const incomingTemplates = payload.templateBootstrap?.[type];
                if (incomingTemplates && typeof incomingTemplates === 'object') {
                    const bootstrap = getTemplateBootstrap(type);
                    Object.assign(bootstrap, serializeTemplateBootstrap(type, incomingTemplates));
                    refreshTemplateSelection(type);
                }
                const incomingRules = payload.ruleBootstrap?.[type];
                if (incomingRules && typeof incomingRules === 'object') {
                    state.ruleBootstrap[type].enabled = incomingRules.enabled === true;
                }
                const incomingBehavior = payload.behavior?.[type];
                if (incomingBehavior && typeof incomingBehavior === 'object') {
                    state.behavior[type] = normalizeBehavior(type, incomingBehavior);
                }
            }
            refreshTemplateSelections();
            clampStep();
            return true;
        };

        const savePreset = (name) => {
            const label = String(name || '').trim();
            if (!label) {
                return { ok: false, error: 'Preset name is required.' };
            }
            const nextEntry = {
                id: `setup-preset-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
                name: label.slice(0, 60),
                savedAt: new Date().toISOString(),
                payload: buildPresetPayload()
            };
            const deduped = readPresetStore().filter((entry) => (
                String(entry.name || '').trim().toLowerCase() !== nextEntry.name.toLowerCase()
            ));
            deduped.unshift(nextEntry);
            writePresetStore(deduped);
            return { ok: true, id: nextEntry.id, name: nextEntry.name };
        };

        const loadPreset = (presetId) => {
            const key = String(presetId || '').trim();
            const selected = key ? readPresetStore().find((entry) => String(entry.id || '') === key) : null;
            return selected ? applyPresetPayload(selected.payload || {}) : false;
        };

        const deletePreset = (presetId) => {
            const key = String(presetId || '').trim();
            if (!key) {
                return false;
            }
            const existing = readPresetStore();
            const next = existing.filter((entry) => String(entry.id || '') !== key);
            if (next.length === existing.length) {
                return false;
            }
            writePresetStore(next);
            return true;
        };

        const restoreDraft = () => {
            let parsed = null;
            try {
                const raw = getStorage()?.getItem?.(constants.draftStorageKey);
                if (!raw) {
                    return false;
                }
                parsed = JSON.parse(raw);
            } catch (_error) {
                clearDraft();
                return false;
            }
            const savedAt = Date.parse(String(parsed?.savedAt || ''));
            if (!parsed || typeof parsed !== 'object' || !Number.isFinite(savedAt)
                || (Date.now() - savedAt) > Number(constants.draftMaxAgeMs || 0)) {
                clearDraft();
                return false;
            }
            const state = getState();
            const restoredRoute = ['new', 'migrate', 'advanced'].includes(String(parsed.route || ''))
                ? String(parsed.route)
                : state.route;
            state.route = restoredRoute;
            const stepSequence = getStepSequence(restoredRoute);
            state.step = Math.max(0, Math.min(stepSequence.length - 1, Number(parsed.step) || 0));
            state.mode = String(parsed.mode || '').toLowerCase() === 'advanced' ? 'advanced' : 'basic';
            state.experienceMode = normalizeExperienceMode(parsed.experienceMode);
            state.applySafetyMode = normalizeSafetyMode(parsed.applySafetyMode);
            state.selectedPresetId = String(parsed.selectedPresetId || '');
            state.presetDraftName = String(parsed.presetDraftName || '');
            state.quickPreset = normalizeQuickPreset(parsed.quickPreset);
            if (!state.presetDraftName) {
                state.presetDraftName = `${state.quickPreset}-profile`;
            }
            state.profile = Object.prototype.hasOwnProperty.call(profilePresets, String(parsed.profile || ''))
                ? String(parsed.profile)
                : state.profile;
            state.applyProfileDefaults = parsed.applyProfileDefaults === true;
            state.environmentPreset = normalizeEnvironmentPreset(parsed.environmentPreset);
            state.applyEnvironmentDefaults = parsed.applyEnvironmentDefaults !== false;
            state.dryRunOnly = parsed.dryRunOnly === true;
            state.focusModeEnabled = parsed.focusModeEnabled !== false;
            state.collapsedChipRows = parsed.collapsedChipRows && typeof parsed.collapsedChipRows === 'object'
                ? { ...parsed.collapsedChipRows }
                : {};

            for (const type of ['docker', 'vm']) {
                const incomingPlan = parsed.importPlans?.[type];
                if (incomingPlan && typeof incomingPlan === 'object') {
                    state.importPlans[type] = {
                        ...createImportPlan(),
                        include: incomingPlan.include === true,
                        mode: normalizeImportMode(incomingPlan.mode),
                        fileName: String(incomingPlan.fileName || ''),
                        fileSizeBytes: Math.max(0, Number(incomingPlan.fileSizeBytes) || 0),
                        fileLastModified: String(incomingPlan.fileLastModified || ''),
                        parsed: incomingPlan.parsed && typeof incomingPlan.parsed === 'object'
                            ? incomingPlan.parsed
                            : null
                    };
                }
                const incomingTemplates = parsed.templateBootstrap?.[type];
                if (incomingTemplates && typeof incomingTemplates === 'object') {
                    const bootstrap = getTemplateBootstrap(type);
                    Object.assign(bootstrap, serializeTemplateBootstrap(type, incomingTemplates));
                    refreshTemplateSelection(type);
                }
                const incomingRules = parsed.ruleBootstrap?.[type];
                if (incomingRules && typeof incomingRules === 'object') {
                    state.ruleBootstrap[type].enabled = incomingRules.enabled === true;
                    state.ruleBootstrap[type].suggestions = normalizeRuleSuggestions(incomingRules.suggestions || []).map((row, index) => ({
                        id: `setup-rule-${type}-draft-${index + 1}`,
                        enabled: row.enabled !== false,
                        folderIdHint: row.folderIdHint,
                        folderName: row.folderName,
                        kind: 'name_regex',
                        effect: 'include',
                        pattern: row.pattern,
                        note: `Matches names starting with "${String(row.pattern || '').replace(/^\^/, '')}".`
                    }));
                }
                const incomingBehavior = parsed.behavior?.[type];
                if (incomingBehavior && typeof incomingBehavior === 'object') {
                    state.behavior[type] = normalizeBehavior(type, incomingBehavior);
                }
            }
            refreshTemplateSelections();
            state.draftRestored = true;
            state.restoredDraftSavedAt = String(parsed.savedAt || '');
            return true;
        };

        const isCompleted = () => {
            try {
                const storage = getStorage();
                return storage?.getItem?.(constants.setupDoneStorageKey) === '1'
                    || storage?.getItem?.(constants.wizardDoneStorageKey) === '1';
            } catch (_error) {
                return false;
            }
        };

        const markCompleted = () => {
            try {
                const storage = getStorage();
                storage?.setItem?.(constants.wizardDoneStorageKey, '1');
                storage?.setItem?.(constants.setupDoneStorageKey, '1');
                clearDraft();
            } catch (_error) {
                // Local storage is optional.
            }
        };

        return Object.freeze({
            serializeDraft,
            persistDraft,
            clearDraft,
            readPresetStore,
            writePresetStore,
            buildPresetPayload,
            applyPresetPayload,
            savePreset,
            loadPreset,
            deletePreset,
            restoreDraft,
            isCompleted,
            markCompleted
        });
    };

    return Object.freeze({ createApi });
}));
