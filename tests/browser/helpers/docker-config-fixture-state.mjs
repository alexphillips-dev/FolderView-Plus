import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { mergePatch } = require('../../../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/folderviewplus.prefs-store.js');

// One fixture owner for the persisted configuration, revisions and snapshot projections.
export const createDockerConfigFixtureState = ({ folders, runtime, names }) => {
    let folderRevision = 1;
    let prefs = { hideEmptyFolders: true, sortMode: 'alpha', setupWizardCompleted: true,
        performanceProfile: 'standard', lazyPreviewEnabled: false, autoRules: [],
        _metadata: { folderRevision, prefsRevision: 1 } };
    const metadata = () => ({ ...prefs._metadata, folderRevision });
    const revisions = () => ({ folder: folderRevision, prefs: prefs._metadata.prefsRevision });
    const assertRevision = (expected, actual) => {
        if (Number(expected) !== actual) throw Object.assign(new Error('Synthetic revision conflict'), { status: 409 });
    };
    const replacePrefs = patch => {
        prefs = { ...mergePatch(prefs, patch),
            _metadata: { ...metadata(), prefsRevision: prefs._metadata.prefsRevision + 1 } };
    };
    const savePrefs = payload => {
        if (payload.expectedRevision) assertRevision(payload.expectedRevision, revisions().prefs);
        replacePrefs(JSON.parse(payload.prefs));
        return { ok: true, prefs, metadata: metadata(), clientMutationId: payload.clientMutationId };
    };
    const applyBatch = payload => {
        const operations = JSON.parse(payload.operations);
        assertRevision(payload.expectedRevision, folderRevision);
        assertRevision(operations.expectedPrefsRevision, revisions().prefs);
        if (!Array.isArray(operations.upserts) || !Array.isArray(operations.manualOrder)
            || operations.deletes?.length || operations.creates?.length) throw new Error('Unsupported hierarchy fixture mutation');
        const replacements = Object.fromEntries(operations.upserts.map(entry => [entry.id, structuredClone(entry.folder)]));
        // Validate both revisions before publishing either half of the transaction.
        Object.assign(folders, replacements);
        folderRevision++;
        replacePrefs({ sortMode: 'manual', manualOrder: operations.manualOrder });
        return { ok: true, result: { updatedIds: Object.keys(replacements), metadata: metadata() } };
    };
    const snapshot = () => ({ ok: true, kind: 'runtime_snapshot', schemaVersion: 1, type: 'docker',
        folders, runtime, runtimeIncluded: true, order: Object.keys(folders).map(id => 'folder-' + id).concat(names),
        prefs, metadata: metadata(), revisions: revisions(),
        snapshotToken: folderRevision.toString(16).padStart(32, '0') + revisions().prefs.toString(16).padStart(32, '0'),
        revision: 'a'.repeat(64) });
    return { prefs: () => prefs, metadata, revisions, savePrefs, applyBatch, snapshot };
};
