import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import utils from '../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.utils.js';
import importSelection from '../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.import-selection.js';

const source = fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.wizard.js', 'utf8');
const extract = name => {
    const start = source.indexOf(`const ${name} =`);
    assert.ok(start >= 0);
    return source.slice(start, source.indexOf('\nconst ', start + 1));
};
const load = (names, dependencies) => vm.runInNewContext(`${names.map(extract).join('\n')}\n({${names.join(',')}})`, dependencies);
const window = { FolderViewPlusFoundationModules: { importSelection } };

test('cleared and deselected templates stay empty across render and restored selection refreshes', () => {
    const bootstrap = { category: 'smart', selectedTemplateNames: [] };
    const { refreshSetupAssistantTemplateSelection: refresh } = load(['refreshSetupAssistantTemplateSelection'], {
        normalizeManagedType: value => value, getSetupAssistantTemplateBootstrap: () => bootstrap,
        getSetupAssistantTemplateCategoryState: () => ({ blueprints: [{ name: 'Media' }, { name: 'Cloud' }], defaultCategoryId: 'smart', categoryIndexBuckets: new Map([['smart', [0, 1]]]) }),
        normalizeSetupAssistantTemplateCategory: (_type, value) => value, serializeSetupAssistantTemplateSelections: value => value || []
    });
    assert.equal(refresh('docker').selectedNames.length, 0);
    assert.equal(refresh('docker').selectedNames.length, 0);
    assert.deepEqual(Array.from(refresh('docker', { forceAllSelected: true }).selectedNames), ['Media', 'Cloud']);
    bootstrap.selectedTemplateNames = ['Media'];
    assert.deepEqual(Array.from(refresh('docker').selectedNames), ['Media']);
    bootstrap.selectedTemplateNames = ['deleted-template'];
    assert.equal(refresh('docker').selectedNames.length, 0);
    assert.equal(refresh('docker', { resetSelection: true }).selectedNames.length, 2);
});

const assignmentFixture = (targetPresent, folderRevision = 8) => {
    const calls = [];
    const folders = { old: { name: 'Original', icon: 'authoritative', containers: ['media-app', 'untouched'] }, ...(targetPresent ? { target: { name: 'Media', containers: [] } } : {}) };
    const api = load(['requireSetupAssistantFolderRevision', 'applySetupAssistantTemplateAssignmentsForType'], {
        window, normalizeManagedType: value => value, fetchFolders: async () => ({ folders, folderRevision }),
        setupAssistantT: (_key, fallback) => fallback,
        resolveSetupAssistantFolderId: () => targetPresent ? 'target' : '',
        buildSetupAssistantTemplateAssignmentPreview: () => ({ totalItems: 2, matched: 1, unmatched: 1, assignedByTemplate: { Media: ['media-app'] } }),
        utils: { normalizeFolderMembers: values => [...values] },
        requestFolderBatchMutation: async (_type, payload, options) => calls.push({ payload, options }), refreshType: async () => ({ hasErrors: false })
    });
    return { calls, folders, run: () => api.applySetupAssistantTemplateAssignmentsForType('docker', { autoAssignEnabled: true, selectedBlueprints: [{ name: 'Media' }] }) };
};

test('missing assignment target cannot remove members from their existing folders', async () => {
    const f = assignmentFixture(false);
    await assert.rejects(f.run(), /target|folder/i);
    assert.equal(f.calls.length, 0);
    assert.deepEqual(f.folders.old.containers, ['media-app', 'untouched']);
});

test('verified assignment target moves selected members with one atomic batch', async () => {
    const f = assignmentFixture(true);
    const result = await f.run();
    assert.equal(result.updatedFolders, 2);
    assert.equal(f.calls.length, 1);
    const { payload, options } = JSON.parse(JSON.stringify(f.calls[0]));
    assert.deepEqual(payload.upserts.find(row => row.id === 'old').folder.containers, ['untouched']);
    assert.equal(payload.upserts.find(row => row.id === 'old').folder.icon, 'authoritative');
    assert.deepEqual(payload.upserts.find(row => row.id === 'target').folder.containers, ['media-app']);
    assert.deepEqual(options, { expectedRevision: 8 });
});

test('template assignment never writes without an authoritative folder revision', async () => {
    const f = assignmentFixture(true, null);
    await assert.rejects(f.run(), /configuration revision is unavailable/);
    assert.equal(f.calls.length, 0);
});

test('wizard import preflight requires new review if the revision changed', async () => {
    const parsed = { mode: 'full', folders: {} };
    const state = { importPlans: { docker: { include: true, parsed }, vm: null } };
    const folders = { old: { name: 'Original' } };
    let current = { folders, folderRevision: 4 };
    const translate = (_key, fallback) => fallback;
    const { summarizeSetupAssistantImportPlan: summarize } = load(['summarizeSetupAssistantImportPlan'], {
        window, utils, setupAssistantState: state, setupAssistantT: translate,
        getFolderMap: () => folders, readFolderConfigurationRevision: () => 4,
        normalizeManagedType: value => value, getSetupAssistantEffectiveImportMode: () => 'replace',
        countImportOperations: ({ deletes }) => deletes.length
    });
    const readReviewed = () => importSelection.readReviewedSetupImports({
        getPlans: () => state.importPlans, fetchFolders: async () => current, updatePlan: summarize, translate
    });
    summarize('docker');
    const reviewed = await readReviewed();
    assert.equal(reviewed.docker.expectedRevision, 4);
    assert.deepEqual(reviewed.docker.operations.deletes, ['old']);
    current = { folders: { ...folders, added: { name: 'Peer folder' } }, folderRevision: 5 };
    await assert.rejects(readReviewed(), /preview changed/i);
    assert.deepEqual(state.importPlans.docker.summary.deletes.map(row => row.name), ['Original', 'Peer folder']);
    summarize('docker');
    assert.equal(state.importPlans.docker.folderRevision, 5, 'a subsequent render against the old cached map keeps the fresher plan');
    const renewed = await readReviewed();
    assert.equal(renewed.docker.expectedRevision, 5);
    assert.deepEqual(renewed.docker.operations.deletes, ['old', 'added']);
});

test('wizard import retry sends only confirmed operations for the matching revision', async () => {
    const initial = { mode: 'replace', creates: [], upserts: [], deletes: ['old'] };
    const changed = { ...initial, deletes: ['new'] };
    const parsed = { mode: 'full', folders: {} };
    let revision = 4;
    let approval = null;
    const writes = [], dialogs = [];
    const api = load(['requireSetupAssistantFolderRevision', 'setupAssistantImportReviewChanged', 'retrySetupAssistantFailures'], {
        window, normalizeManagedType: value => value, setupAssistantT: (_key, fallback) => fallback,
        fetchFolders: async () => ({ folders: {}, folderRevision: revision }),
        showImportPreviewDialog: async (...args) => { dialogs.push(args); return approval; },
        setSetupAssistantProgress: () => {}, renderSetupAssistant: () => {}, swal: {},
        countImportOperations: plan => plan.deletes.length,
        applyImportOperations: async (_type, operations, _progress, options) => writes.push([operations, options.expectedRevision]),
        refreshType: async () => {}, refreshBackups: async () => {}, refreshAll: async () => {},
        refreshSettingsUx: () => {}, captureSettingsBaseline: () => {}
    });
    const failures = [{ type: 'docker', phase: 'import' }];
    const reviewed = { docker: { operations: initial, parsed, expectedRevision: 4 } };
    assert.equal((await api.retrySetupAssistantFailures(failures, reviewed)).resolved, 1);
    assert.deepEqual(writes, [[initial, 4]]);
    revision = 5;
    assert.equal((await api.retrySetupAssistantFailures(failures, reviewed)).remaining.length, 1);
    assert.equal(writes.length, 1);
    assert.equal(dialogs[0][3].initialMode, 'replace');
    approval = { operations: changed, dryRunOnly: false };
    assert.equal((await api.retrySetupAssistantFailures(failures, reviewed)).resolved, 1);
    assert.deepEqual(writes, [[initial, 4], [changed, 5]]);
});

test('zero warning threshold remains zero in the wizard input and review summary', () => {
    for (const value of [0, 60, 100]) {
        const api = load(['renderSetupAssistantBehaviorTypeCard', 'renderSetupAssistantBehaviorSummaryCard'], {
            setupAssistantState: { experienceMode: 'expert', behavior: { docker: { statusWarnStoppedPercent: value } } },
            normalizeManagedType: value => value, normalizeSetupAssistantExperienceMode: value => value,
            escapeHtml: String, getSetupAssistantBehaviorSortLabel: () => 'Created', getSetupAssistantBehaviorStatusLabel: () => 'Summary',
            renderSetupAssistantBehaviorSetting: () => ''
        });
        assert.equal(api.renderSetupAssistantBehaviorTypeCard('docker').match(/data-fv-setup-behavior-status-warn="docker" value="(\d+)"/)?.[1], String(value));
        assert.match(api.renderSetupAssistantBehaviorSummaryCard('docker'), new RegExp(`warning at ${value}%`));
    }
});
