import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(process.cwd());
const treeIntegrityPath = path.join(
    repoRoot,
    'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.tree-integrity.js'
);
const treeIntegrityModule = require(treeIntegrityPath);

const buildHierarchyMeta = (folders) => {
    const ids = Object.keys(folders || {});
    const idSet = new Set(ids);
    const childrenById = Object.fromEntries(ids.map((id) => [id, []]));
    const parentById = {};
    for (const id of ids) {
        const rawParent = String(folders[id]?.parentId || '').trim();
        const parentId = rawParent && rawParent !== id && idSet.has(rawParent) ? rawParent : '';
        parentById[id] = parentId;
        if (parentId) {
            childrenById[parentId].push(id);
        }
    }
    const depthById = {};
    const depthFor = (id, pathIds = new Set()) => {
        if (pathIds.has(id)) {
            return 0;
        }
        const parentId = parentById[id];
        if (!parentId) {
            return 0;
        }
        const nextPath = new Set(pathIds);
        nextPath.add(id);
        return depthFor(parentId, nextPath) + 1;
    };
    ids.forEach((id) => {
        depthById[id] = depthFor(id);
    });
    return { idSet, parentById, childrenById, depthById };
};

const createHarness = ({
    initialFolders,
    confirmRepair = true,
    initialRevision = 7,
    createBackupImpl = async () => ({ name: 'tree-backup' }),
    requestMutationImpl = null,
    refreshImpl = null
} = {}) => {
    let folders = structuredClone(initialFolders || {});
    let revision = initialRevision;
    const modals = [];
    const busy = [];
    const mutations = [];
    const undo = [];
    const errors = [];
    const toasts = [];
    let refreshCount = 0;
    const api = treeIntegrityModule.createApi({
        utils: {
            normalizeFolderMap: (value) => structuredClone(value || {}),
            normalizeFolderMembers: (value) => Array.isArray(value) ? value : []
        },
        getFolderMap: () => folders,
        buildFolderHierarchyMeta: buildHierarchyMeta,
        TREE_INTEGRITY_DEPTH_WARN_LEVEL: 4,
        swal: (options, callback) => {
            modals.push(options);
            if (typeof callback === 'function') {
                callback(confirmRepair);
            }
        },
        ensureRuntimeConflictActionAllowed: () => true,
        refreshTreeIntegrityState: async (...args) => {
            refreshCount += 1;
            if (typeof refreshImpl === 'function') {
                return refreshImpl({ args, folders, revision, setFolders: (value) => { folders = value; } });
            }
            return { expectedRevision: revision };
        },
        setTreeIntegrityBusy: (...args) => busy.push(args),
        createBackup: createBackupImpl,
        requestFolderBatchMutation: async (...args) => {
            mutations.push(args);
            if (typeof requestMutationImpl === 'function') {
                return requestMutationImpl({ args, folders, revision });
            }
            const [, operations] = args;
            for (const entry of operations.upserts || []) {
                folders[entry.id] = structuredClone(entry.folder);
            }
            revision += 1;
            return { updatedIds: (operations.upserts || []).map((entry) => entry.id) };
        },
        offerUndoAction: async (...args) => undo.push(args),
        showToastMessage: (options) => toasts.push(options),
        showError: (...args) => errors.push(args)
    });
    return {
        api,
        modals,
        busy,
        mutations,
        undo,
        errors,
        toasts,
        getRefreshCount: () => refreshCount,
        getFolders: () => folders
    };
};

test('tree integrity scan reports a healthy valid tree', () => {
    const harness = createHarness({
        initialFolders: {
            root: { name: 'Root', parentId: '', containers: ['one'] },
            child: { name: 'Child', parentId: 'root', containers: ['two'] }
        }
    });
    const report = harness.api.scan('docker', harness.getFolders());
    assert.deepEqual(report.selfParents, []);
    assert.deepEqual(report.orphans, []);
    assert.deepEqual(report.cycles, []);
    assert.deepEqual(report.depthWarnings, []);
    assert.deepEqual(report.emptyBranches, []);
});

test('tree integrity scan deduplicates self-links and excludes invalid nodes from advisories', () => {
    const harness = createHarness({
        initialFolders: {
            self: { name: 'Self', parentId: 'self', containers: [] },
            orphan: { name: 'Orphan', parentId: 'missing', containers: [] },
            cycleA: { name: 'Cycle A', parentId: 'cycleB', containers: [] },
            cycleB: { name: 'Cycle B', parentId: 'cycleA', containers: [] },
            root: { name: 'Root', parentId: '', containers: [] },
            deep1: { name: 'Deep 1', parentId: 'root', containers: [] },
            deep2: { name: 'Deep 2', parentId: 'deep1', containers: [] },
            deep3: { name: 'Deep 3', parentId: 'deep2', containers: [] },
            deep4: { name: 'Deep 4', parentId: 'deep3', containers: [] },
            deep5: { name: 'Deep 5', parentId: 'deep4', containers: ['member'] },
            emptyRoot: { name: 'Empty Root', parentId: '', containers: [] },
            emptyChild: { name: 'Empty Child', parentId: 'emptyRoot', containers: [] }
        }
    });
    const report = harness.api.scan('docker', harness.getFolders());
    assert.deepEqual(report.selfParents, ['self']);
    assert.deepEqual(report.orphans, ['orphan']);
    assert.equal(report.cycles.length, 1);
    assert.deepEqual(new Set(report.cycles[0].slice(0, -1)), new Set(['cycleA', 'cycleB']));
    assert.deepEqual(report.depthWarnings.map((row) => row.id), ['deep5']);
    assert.deepEqual(report.emptyBranches.map((row) => row.id), ['emptyRoot']);
    assert.deepEqual(
        new Set(report.structurallyInvalidIds),
        new Set(['self', 'orphan', 'cycleA', 'cycleB'])
    );
});

test('tree scan refreshes first and separates repairable errors from advisory warnings', async () => {
    const harness = createHarness({
        initialFolders: {
            orphan: { name: 'Orphan', parentId: 'missing', containers: [] },
            emptyRoot: { name: 'Empty Root', parentId: '', containers: [] },
            emptyChild: { name: 'Empty Child', parentId: 'emptyRoot', containers: [] }
        }
    });
    await harness.api.run('docker');
    assert.equal(harness.getRefreshCount(), 1);
    assert.equal(harness.modals.at(-1)?.title, 'Tree integrity issues found');
    assert.match(harness.modals.at(-1)?.text || '', /Repairable link errors/);
    assert.match(harness.modals.at(-1)?.text || '', /Advisory warnings/);
    assert.deepEqual(harness.busy.map((entry) => entry[1]), [true, false]);
});

test('tree repair cancellation performs no backup or mutation', async () => {
    let backupCount = 0;
    const harness = createHarness({
        initialFolders: { orphan: { name: 'Orphan', parentId: 'missing', containers: [] } },
        confirmRepair: false,
        createBackupImpl: async () => { backupCount += 1; return { name: 'unused' }; }
    });
    await harness.api.run('docker', { repair: true });
    assert.equal(backupCount, 0);
    assert.equal(harness.mutations.length, 0);
    assert.deepEqual(harness.busy.map((entry) => entry[1]), [true, false]);
});

test('tree repair submits the refreshed revision, creates undo, and verifies saved state', async () => {
    const harness = createHarness({
        initialFolders: {
            orphan: { name: 'Orphan', parentId: 'missing', containers: [] },
            cycleA: { name: 'Cycle A', parentId: 'cycleB', containers: [] },
            cycleB: { name: 'Cycle B', parentId: 'cycleA', containers: [] }
        },
        initialRevision: 12
    });
    await harness.api.run('vm', { repair: true });
    assert.equal(harness.getRefreshCount(), 2, 'repair should refresh before scanning and after saving');
    assert.equal(harness.mutations.length, 1);
    assert.equal(harness.mutations[0][2].expectedRevision, 12);
    assert.deepEqual(harness.mutations[0][1].upserts.map((entry) => entry.id).sort(), ['cycleA', 'orphan']);
    assert.equal(harness.getFolders().orphan.parentId, '');
    assert.equal(harness.getFolders().cycleA.parentId, '');
    assert.equal(harness.undo.length, 1);
    assert.equal(harness.modals.at(-1)?.title, 'Repair complete');
    assert.match(harness.modals.at(-1)?.text || '', /Verified remaining link errors: 0/);
});

test('tree repair stops safely when backup or mutation fails', async () => {
    const backupFailure = createHarness({
        initialFolders: { orphan: { name: 'Orphan', parentId: 'missing', containers: [] } },
        createBackupImpl: async () => { throw new Error('backup unavailable'); }
    });
    await backupFailure.api.run('docker', { repair: true });
    assert.equal(backupFailure.mutations.length, 0);
    assert.equal(backupFailure.errors.at(-1)?.[0], 'Tree integrity repair failed');

    const mutationFailure = createHarness({
        initialFolders: { orphan: { name: 'Orphan', parentId: 'missing', containers: [] } },
        requestMutationImpl: async () => { throw new Error('revision conflict'); }
    });
    await mutationFailure.api.run('docker', { repair: true });
    assert.equal(mutationFailure.mutations.length, 1);
    assert.equal(mutationFailure.undo.length, 0);
    assert.equal(mutationFailure.errors.at(-1)?.[0], 'Tree integrity repair failed');
    assert.deepEqual(mutationFailure.busy.map((entry) => entry[1]), [true, false]);
});

test('tree repair distinguishes a saved repair from a post-save verification failure', async () => {
    let refreshCall = 0;
    const harness = createHarness({
        initialFolders: { orphan: { name: 'Orphan', parentId: 'missing', containers: [] } },
        refreshImpl: async () => {
            refreshCall += 1;
            if (refreshCall > 1) {
                throw new Error('reload unavailable');
            }
            return { expectedRevision: 9 };
        }
    });
    await harness.api.run('docker', { repair: true });
    assert.equal(harness.mutations.length, 1);
    assert.equal(harness.undo.length, 1);
    assert.equal(harness.errors.length, 0);
    assert.equal(harness.toasts.at(-1)?.title, 'Repair saved; verification unavailable');
    assert.equal(harness.toasts.at(-1)?.level, 'warning');
});

test('tree integrity operations are single-flight per type', async () => {
    let releaseRefresh;
    const refreshGate = new Promise((resolve) => { releaseRefresh = resolve; });
    const harness = createHarness({
        initialFolders: { root: { name: 'Root', parentId: '', containers: ['one'] } },
        refreshImpl: async () => {
            await refreshGate;
            return { expectedRevision: 3 };
        }
    });
    const first = harness.api.run('docker');
    const second = harness.api.run('docker', { repair: true });
    releaseRefresh();
    await Promise.all([first, second]);
    assert.equal(harness.getRefreshCount(), 1);
    assert.deepEqual(harness.busy.map((entry) => entry[1]), [true, false]);
});
