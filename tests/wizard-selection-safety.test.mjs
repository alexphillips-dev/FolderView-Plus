import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.wizard.js', 'utf8');
const extract = name => {
    const start = source.indexOf(`const ${name} =`);
    assert.ok(start >= 0);
    return source.slice(start, source.indexOf('\nconst ', start + 1));
};
const load = (names, dependencies) => vm.runInNewContext(`${names.map(extract).join('\n')}\n({${names.join(',')}})`, dependencies);

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

const assignmentFixture = targetPresent => {
    const calls = [];
    const folders = { old: { name: 'Original', containers: ['media-app', 'untouched'] }, ...(targetPresent ? { target: { name: 'Media', containers: [] } } : {}) };
    const api = load(['applySetupAssistantTemplateAssignmentsForType'], {
        normalizeManagedType: value => value, getFolderMap: () => folders,
        setupAssistantT: (_key, fallback) => fallback,
        resolveSetupAssistantFolderId: () => targetPresent ? 'target' : '',
        buildSetupAssistantTemplateAssignmentPreview: () => ({ totalItems: 2, matched: 1, unmatched: 1, assignedByTemplate: { Media: ['media-app'] } }),
        utils: { normalizeFolderMembers: values => [...values] },
        requestFolderBatchMutation: async (_type, payload) => calls.push(payload), refreshType: async () => ({ hasErrors: false })
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
    const payload = JSON.parse(JSON.stringify(f.calls[0]));
    assert.deepEqual(payload.upserts.find(row => row.id === 'old').folder.containers, ['untouched']);
    assert.deepEqual(payload.upserts.find(row => row.id === 'target').folder.containers, ['media-app']);
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
