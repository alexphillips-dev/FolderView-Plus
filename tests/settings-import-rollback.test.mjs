import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const scripts = new URL('../src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/scripts/', import.meta.url);
const main = fs.readFileSync(new URL('folderviewplus.js', scripts), 'utf8');
const imports = fs.readFileSync(new URL('folderviewplus.import.js', scripts), 'utf8');
const section = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end));
const implementation = [
    section(main, 'const requestFolderBatchMutation =', 'const fetchPluginVersion ='),
    section(imports, 'const applyImportOperations =', 'const offerUndoAction ='),
    section(main, 'const importType =', 'const clearType =')
].join('\n');

function fixture(type, failure = '', { dryRun = false, cancelled = false, revision = 0 } = {}) {
    const events = [];
    const state = { folders: ['original'], prefs: 'original', revision };
    const reviewedFolders = { original: { name: 'Original' } };
    const backup = { name: 'fixture-backup' };
    const operations = { deletes: [], upserts: [], creates: [{ folder: { name: 'Imported' } }] };
    const noop = () => {};
    const translate = (_key, text) => text;
    const context = {
        normalizeManagedType: value => value,
        ensureRuntimeConflictActionAllowed: () => true,
        selectJsonFile: async () => cancelled ? null : { text: '{}' },
        utils: { parseImportPayload: () => ({ ok: true }), normalizeFolderMap: folders => folders },
        apiGetJson: async (url, { data }) => {
            assert.equal(url, '/plugins/folderview.plus/server/read.php');
            assert.equal(data.type, type);
            assert.equal(data.includeMetadata, '1');
            return { ok: true, folders: reviewedFolders, metadata: { folderRevision: state.revision } };
        },
        showImportPreviewDialog: async (_type, _parsed, folders) => {
            assert.deepEqual(Object.entries(folders).map(([id, folder]) => [id, folder.name]), [['original', 'Original']]);
            if (failure === 'conflict') {
                state.revision += 1;
                state.folders.push('concurrent');
            }
            return { mode: 'merge', operations, dryRunOnly: dryRun };
        },
        countImportOperations: () => 1,
        apiPostJson: async (url, payload) => {
            const operations = JSON.parse(payload.operations);
            events.push({ url, type: payload.type, operations, revision: payload.expectedRevision });
            if (payload.expectedRevision !== undefined && Number(payload.expectedRevision) !== state.revision) {
                throw new Error('This folder configuration changed in another page or browser tab.');
            }
            assert.equal(operations.backupReason, 'before-import-transaction-merge');
            assert.equal(operations.preserveParentLinks, true);
            if (failure === 'backup') throw new Error('Backup failed');
            events.push('backup');
            if (failure !== 'conflict') state.folders.push('concurrent');
            state.prefs = 'concurrent';
            if (failure === 'batch') throw new Error('Atomic batch rejected');
            state.folders.push('imported');
            return { ok: true, result: { createdIds: ['imported'], backup } };
        },
        restoreBackupByName: async () => {
            events.push('restore');
            state.folders = ['original'];
            state.prefs = 'original';
        },
        openImportApplyProgressDialog: () => events.push('open'),
        closeImportApplyProgressDialog: () => events.push('close'),
        updateImportApplyProgressDialog: entry => {
            if (failure === 'progress' && entry.completed === 2) throw new Error('Progress failed');
        },
        refreshType: async () => {
            if (failure === 'refresh') throw new Error('Refresh failed');
        },
        refreshBackups: async () => true,
        trackDiagnosticsEvent: async () => {
            if (failure === 'telemetry') throw new Error('Telemetry failed');
        },
        resolveAffectedFolderIdsFromOperations: () => ['imported'],
        showActionSummaryToast: () => events.push('success'),
        offerUndoAction: async (_type, saved) => events.push({ offeredBackup: saved }),
        showError: (title, error) => events.push({ title, error: error?.message }),
        swal: noop,
        surfaceT: translate,
        importT: translate,
        perfNowMs: () => 0,
        recordPerformanceDiagnosticsSample: noop
    };
    vm.runInNewContext(`${implementation}\nglobalThis.run = () => importType(${JSON.stringify(type)});`, context);
    return { events, state, backup, run: context.run };
}

for (const type of ['docker', 'vm']) {
    for (const failure of ['batch', 'progress', 'refresh', 'telemetry']) {
        test(`${type} import preserves authoritative state after ${failure} failure`, async () => {
            const f = fixture(type, failure);
            await f.run();
            assert.ok(!f.events.includes('restore'), 'an old safety backup must not replace authoritative state');
            assert.deepEqual(f.state.folders, failure === 'batch' ? ['original', 'concurrent'] : ['original', 'concurrent', 'imported']);
            assert.equal(f.state.prefs, 'concurrent');
            assert.equal(f.events.filter(event => event?.url).length, 1);
            assert.ok(f.events.some(event => event?.title === 'Import failed'));
            assert.ok(f.events.includes('close'));
        });
    }

    test(`${type} successful import retains safety backup and recovery guidance`, async () => {
        const f = fixture(type);
        await f.run();
        assert.deepEqual(f.state.folders, ['original', 'concurrent', 'imported']);
        assert.ok(f.events.includes('success'));
        assert.equal(f.events.find(event => event?.offeredBackup)?.offeredBackup, f.backup);
        assert.ok(!f.events.includes('restore'));
        assert.equal(f.events.find(event => event?.url)?.type, type);
        assert.equal(f.events.find(event => event?.url)?.revision, '0');
    });
}

test('cancel and dry run submit no batch, and failed safety backup prevents the same batch from mutating', async () => {
    for (const f of [fixture('docker', '', { cancelled: true }), fixture('vm', '', { dryRun: true })]) {
        await f.run();
        assert.ok(!f.events.some(event => event?.url));
        assert.ok(!f.events.includes('restore'));
        assert.deepEqual(f.state.folders, ['original']);
    }
    const failed = fixture('docker', 'backup');
    await failed.run();
    assert.equal(failed.events.filter(event => event?.url).length, 1);
    assert.ok(!failed.events.includes('restore'));
    assert.ok(failed.events.some(event => event?.error === 'Backup failed'));
    assert.deepEqual(failed.state.folders, ['original']);
});

test('ordinary import carries the reviewed revision even when another tab saves before apply', async () => {
    const f = fixture('docker', 'conflict', { revision: 9 });
    await f.run();
    assert.equal(f.events.find(event => event?.url)?.revision, '9');
    assert.equal(f.state.revision, 10);
    assert.deepEqual(f.state.folders, ['original', 'concurrent']);
    assert.ok(f.events.some(event => /configuration changed/.test(event?.error)));
    assert.ok(!f.events.includes('backup'));
    assert.ok(!f.events.includes('restore'));
});

test('Settings clear submits the ids and revision captured before confirmation', async () => {
    let folders = { original: { name: 'Original' } };
    let revision = 4;
    let confirm;
    const requests = [];
    const context = {
        normalizeManagedType: type => type, getFolderMap: () => folders,
        readFolderConfigurationRevision: () => revision, ensureRuntimeConflictActionAllowed: () => true,
        escapeHtml: text => text, surfaceT: (_key, text) => text,
        swal: (_dialog, callback) => { confirm = callback; },
        apiPostJson: async (_url, payload) => {
            requests.push({ revision: payload.expectedRevision, ...JSON.parse(payload.operations) });
            throw new Error('Synthetic revision conflict');
        },
        openImportApplyProgressDialog() {}, updateImportApplyProgressDialog() {}, closeImportApplyProgressDialog() {},
        showError() {}, setTimeout: callback => callback()
    };
    vm.runInNewContext([
        section(main, 'const requestFolderBatchMutation =', 'const fetchPluginVersion ='),
        section(main, 'const clearType =', 'const updatePrefsPartial ='),
        'globalThis.clear = clearType;'
    ].join('\n'), context);
    context.clear('docker');
    folders = { ...folders, peer: { name: 'Peer created' } };
    revision = 5;
    await confirm(true);
    assert.deepEqual(requests[0].deletes, ['original']);
    assert.equal(requests[0].revision, '4');
    assert.equal(requests[0].backupReason, 'before-clear-all');
    assert.equal(requests[0].preserveParentLinks, undefined);
});

test('ordinary import without a verifiable snapshot never opens a write transaction', async () => {
    const f = fixture('vm', '', { revision: null });
    await f.run();
    assert.ok(f.events.some(event => /configuration revision is unavailable/.test(event?.error)));
    assert.ok(!f.events.includes('backup'));
    assert.ok(!f.events.some(event => event?.url));
    assert.deepEqual(f.state.folders, ['original']);
});
