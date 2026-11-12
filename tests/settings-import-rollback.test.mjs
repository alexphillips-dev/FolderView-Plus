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

function fixture(type, failure = '', { dryRun = false, cancelled = false } = {}) {
    const events = [];
    const state = { folders: ['original'], prefs: 'original' };
    const backup = { name: 'fixture-backup' };
    const operations = { deletes: [], upserts: [], creates: [{ folder: { name: 'Imported' } }] };
    const noop = () => {};
    const translate = (_key, text) => text;
    const context = {
        normalizeManagedType: value => value,
        ensureRuntimeConflictActionAllowed: () => true,
        selectJsonFile: async () => cancelled ? null : { text: '{}' },
        utils: { parseImportPayload: () => ({ ok: true }) },
        showImportPreviewDialog: async () => ({ mode: 'merge', operations, dryRunOnly: dryRun }),
        countImportOperations: () => 1,
        createBackup: async () => {
            events.push('backup');
            if (failure === 'backup') throw new Error('Backup failed');
            return backup;
        },
        apiPostJson: async (url, payload) => {
            events.push({ url, type: payload.type, operations: JSON.parse(payload.operations) });
            state.folders.push('concurrent');
            state.prefs = 'concurrent';
            if (failure === 'batch') throw new Error('Atomic batch rejected');
            state.folders.push('imported');
            return { ok: true, result: { createdIds: ['imported'] } };
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
    });
}

test('cancel, dry run and failed safety backup never apply or restore configuration', async () => {
    for (const f of [fixture('docker', '', { cancelled: true }), fixture('vm', '', { dryRun: true }), fixture('docker', 'backup')]) {
        await f.run();
        assert.ok(!f.events.some(event => event?.url));
        assert.ok(!f.events.includes('restore'));
        assert.deepEqual(f.state.folders, ['original']);
    }
});
