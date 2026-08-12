import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(process.cwd());
const scriptsRoot = path.join(
    repoRoot,
    'src', 'folderview.plus', 'usr', 'local', 'emhttp', 'plugins', 'folderview.plus', 'scripts'
);
const settingsSearch = require(path.join(scriptsRoot, 'folderviewplus.settings-search.js'));
const wizardPersistence = require(path.join(scriptsRoot, 'folderviewplus.wizard-persistence.js'));
const wizardReview = require(path.join(scriptsRoot, 'folderviewplus.wizard-review.js'));

class MemoryStorage {
    constructor() {
        this.values = new Map();
    }

    getItem(key) {
        return this.values.has(key) ? this.values.get(key) : null;
    }

    setItem(key, value) {
        this.values.set(key, String(value));
    }

    removeItem(key) {
        this.values.delete(key);
    }
}

const createWizardState = () => ({
    open: true,
    applying: false,
    step: 0,
    route: 'new',
    mode: 'basic',
    experienceMode: 'guided',
    applySafetyMode: 'auto',
    selectedPresetId: '',
    presetDraftName: '',
    quickPreset: 'balanced',
    profile: 'balanced',
    applyProfileDefaults: true,
    environmentPreset: 'home_lab',
    applyEnvironmentDefaults: true,
    dryRunOnly: false,
    focusModeEnabled: true,
    collapsedChipRows: {},
    importPlans: {
        docker: { include: false, mode: 'merge' },
        vm: { include: false, mode: 'merge' }
    },
    templateBootstrap: {
        docker: { enabled: true, category: 'smart', selectedTemplateNames: ['Media'], autoAssignExisting: true },
        vm: { enabled: false, category: 'smart', selectedTemplateNames: [], autoAssignExisting: false }
    },
    ruleBootstrap: {
        docker: { enabled: false, suggestions: [] },
        vm: { enabled: false, suggestions: [] }
    },
    behavior: { docker: {}, vm: {} }
});

const createPersistenceApi = (state, storage) => wizardPersistence.createApi({
    storage,
    getState: () => state,
    constants: {
        version: 2,
        draftStorageKey: 'draft',
        presetsStorageKey: 'presets',
        presetsMax: 4,
        draftMaxAgeMs: 60_000,
        setupDoneStorageKey: 'setup-done',
        wizardDoneStorageKey: 'wizard-done'
    },
    profilePresets: { balanced: {} },
    normalizeExperienceMode: (value) => value === 'expert' ? 'expert' : 'guided',
    normalizeSafetyMode: (value) => value || 'auto',
    normalizeQuickPreset: (value) => value || 'balanced',
    normalizeEnvironmentPreset: (value) => value || 'home_lab',
    normalizeImportMode: (value) => value === 'replace' ? 'replace' : 'merge',
    normalizeTemplateCategory: (_type, value) => value || 'smart',
    normalizeTemplateSelections: (values) => [...values],
    normalizeRuleSuggestions: (values) => [...values],
    normalizeBehavior: (_type, value) => ({ ...value }),
    createImportPlan: () => ({ include: false, mode: 'merge' }),
    getTemplateBootstrap: (type) => state.templateBootstrap[type],
    refreshTemplateSelection: () => {},
    refreshTemplateSelections: () => {},
    summarizeImportPlan: () => {},
    clampStep: () => {},
    getStepSequence: () => ['welcome', 'review']
});

test('settings search normalization and tokenization are module-owned and deterministic', () => {
    assert.equal(settingsSearch.normalizeText('  Héalth & Status  '), 'health status');
    assert.deepEqual(settingsSearch.tokenize('Status health status'), ['status', 'health']);
    assert.equal(settingsSearch.createApi({}).evaluate().total, 0);
});

test('wizard persistence owns draft, preset dedupe, and completion storage', () => {
    const storage = new MemoryStorage();
    const state = createWizardState();
    const api = createPersistenceApi(state, storage);

    api.persistDraft();
    assert.equal(JSON.parse(storage.getItem('draft')).route, 'new');
    const first = api.savePreset('Home lab');
    const second = api.savePreset('home LAB');
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(api.readPresetStore().length, 1);

    api.markCompleted();
    assert.equal(api.isCompleted(), true);
    assert.equal(storage.getItem('draft'), null);
});

test('wizard persistence remains usable when browser storage access is blocked', () => {
    const state = createWizardState();
    const api = wizardPersistence.createApi({
        getStorage: () => {
            throw new Error('blocked');
        },
        getState: () => state,
        constants: {},
        profilePresets: {},
        normalizeExperienceMode: (value) => value,
        normalizeSafetyMode: (value) => value,
        normalizeQuickPreset: (value) => value,
        normalizeEnvironmentPreset: (value) => value,
        normalizeImportMode: (value) => value,
        normalizeTemplateCategory: (_type, value) => value,
        normalizeTemplateSelections: (values) => values,
        normalizeRuleSuggestions: (values) => values,
        normalizeBehavior: (_type, value) => value
    });
    assert.doesNotThrow(() => api.persistDraft());
    assert.equal(api.isCompleted(), false);
    assert.doesNotThrow(() => api.markCompleted());
});

test('wizard review owns impact deltas and actionable validation hints', () => {
    const api = wizardReview.createApi({ escapeHtml: (value) => String(value) });
    const current = {
        imports: { totals: { totalOps: 3 } },
        templates: { totals: { creatable: 2, autoAssignMatched: 1 } },
        prefs: { totalChanges: 4 },
        rules: { creatable: 2 },
        totalPlannedChanges: 12
    };
    const baseline = {
        imports: { totals: { totalOps: 1 } },
        templates: { totals: { creatable: 1, autoAssignMatched: 0 } },
        prefs: { totalChanges: 2 },
        rules: { creatable: 1 },
        totalPlannedChanges: 5
    };
    assert.deepEqual(api.getImpactDelta(current, baseline), {
        imports: 2,
        templates: 2,
        prefs: 2,
        rules: 1,
        total: 7
    });
    assert.deepEqual(api.buildFixHints('behavior', {
        blockers: ['DOCKER status warn threshold must be between 0 and 100.'],
        warnings: []
    }), ['Set status warn threshold to a value from 0 to 100 (recommended: 60).']);
});

test('Phase 5 entrypoints delegate instead of retaining extracted implementations', () => {
    const settingsEntrypoint = fs.readFileSync(path.join(scriptsRoot, 'folderviewplus.js'), 'utf8');
    const wizardEntrypoint = fs.readFileSync(path.join(scriptsRoot, 'folderviewplus.wizard.js'), 'utf8');
    assert.match(settingsEntrypoint, /settingsSearchModule\.createApi/);
    assert.doesNotMatch(settingsEntrypoint, /const buildSettingsSearchIndex =/);
    assert.match(wizardEntrypoint, /wizardPersistenceModule\.createApi/);
    assert.match(wizardEntrypoint, /wizardReviewModule\.createApi/);
    assert.doesNotMatch(wizardEntrypoint, /const readSetupAssistantPresetStore = \(\) => \{\s*try/);
    assert.doesNotMatch(wizardEntrypoint, /const buildSetupAssistantPrefsDiffForType =/);
});
