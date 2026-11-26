import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';

const server = process.env.FVPLUS_TRANSACTION_BOUNDARY_SERVER || path.resolve('src/folderview.plus/usr/local/emhttp/plugins/folderview.plus/server');
const fixture = process.env.FVPLUS_TRANSACTION_BOUNDARY_FIXTURE || path.resolve('tests/fixtures/transaction-boundaries.php');
const setup = () => {
    const base = fs.realpathSync(os.tmpdir());
    const root = fs.mkdtempSync(path.join(base, 'fvplus-transaction-boundaries-'));
    for (const directory of ['config', 'source', 'host']) fs.mkdirSync(path.join(root, directory));
    const env = { ...process.env, FVPLUS_TEST_CONFIG_DIR: path.join(root, 'config'),
        FVPLUS_TEST_SOURCE_DIR: path.join(root, 'source'), FVPLUS_TEST_STORAGE_DIR: root,
        FVPLUS_TEST_DOCKER_AUTOSTART_FILE: path.join(root, 'config/autostart') };
    const args = operation => [fixture, server, root, ...operation];
    return { root, env, args, run: (...operation) => JSON.parse(execFileSync('php', args(operation), { encoding: 'utf8', timeout: 30000, env })),
        cleanup: () => { assert.equal(path.dirname(fs.realpathSync(root)), base); fs.rmSync(root, { recursive: true, force: true }); } };
};

test('automatic Setup Assistant rollback validates confirmed writes and protects all peer configuration', () => {
    const harness = setup();
    try {
        const result = harness.run('setup-rollback-fence');
        assert.deepEqual(result.normal, [200, 200, 200, true, ['initial'], false]);
        assert.deepEqual(result.native, [200, true, true, true, true, true, 200, 'synced', 'peer-during-restore 15\n']);
        assert.deepEqual(Object.keys(result.rejections), ['prefs', 'folders', 'theme']);
        for (const [peer, outcome] of Object.entries(result.rejections)) {
            assert.deepEqual(outcome, [409, 409, true, 200, true], peer);
        }
    } finally { harness.cleanup(); }
});

test('global rollback reuses compensated transaction and retains selected checkpoint through each failure', () => {
    const harness = setup();
    try {
        const result = harness.run('rollback');
        for (const [stage, detail] of Object.entries(result)) {
            if (['success', 'targetApplied', 'nativePreserved', 'retention'].includes(stage)) continue;
            assert.ok(detail.error, stage);
            assert.equal(detail.exactRestored, true, stage);
            assert.equal(detail.targetRetained, true, stage);
        }
        assert.equal(result.success.verified, true);
        assert.equal(result.targetApplied, true);
        assert.equal(result.nativePreserved, true);
        assert.equal(result.retention, 20);
        assert.ok(result.success.undoSnapshot);
    } finally { harness.cleanup(); }
});

for (const mode of ['latest', 'previous']) {
    test('global ' + mode + ' restore skips damaged checkpoints and requires the reviewed target', () => {
        const harness = setup();
        try {
            const result = harness.run('rollback-select-' + mode);
            assert.deepEqual(Object.values(result.rows), [false, false, true]);
            assert.equal(result.staleConfirmationRejected, true);
            assert.equal(result.selected, result.originalName);
            assert.deepEqual(result.folderIds, ['original']);
            assert.equal(result.verified, true);
            assert.equal(result.originalRestorable, true);
        } finally { harness.cleanup(); }
    });
}
test('public environment boundaries reject incomplete and unsupported envelopes before mutation', () => {
    const harness = setup();
    try {
        const result = harness.run('envelopes');
        for (const [name, checks] of Object.entries(result)) {
            if (['validRoundtrip', 'internalPartialAccepted'].includes(name)) continue;
            for (const [entry, detail] of Object.entries(checks)) {
                assert.equal(detail.rejected, true, `${name}/${entry}`);
                assert.equal(detail.unchanged, true, `${name}/${entry}`);
            }
        }
        assert.equal(result.validRoundtrip, true);
        assert.equal(result.internalPartialAccepted, true);
    } finally { harness.cleanup(); }
});

test('guarded Recovery fences an in-flight preference save and preserves normal revision conflicts', async () => {
    const harness = setup();
    const require = createRequire(import.meta.url);
    const { getDefaultCoordinator } = require(path.join(server, '../scripts/folderviewplus.prefs-store.js'));
    const call = (endpoint, method, fields) => harness.run('recovery-request', JSON.stringify([endpoint, method, fields]));
    const readPrefs = type => call('prefs.php', 'GET', { type })[1];
    const unwrap = ([status, body]) => {
        if (status !== 200) throw Object.assign(new Error(body.error), { status });
        return body;
    };
    let markStarted, releaseWrite;
    const started = new Promise(resolve => { markStarted = resolve; });
    const held = new Promise(resolve => { releaseWrite = resolve; });
    let requests = 0;
    const coordinator = getDefaultCoordinator({ window: {}, normalizePrefs: prefs => prefs, debounceMs: 0, request: {
        getJson: async () => readPrefs('vm'),
        postJson: async (_url, fields) => {
            requests++;
            if (requests === 1) {
                assert.equal(fields.expectedRecoveryRevision, 0);
                markStarted();
                await held;
            }
            return unwrap(call('prefs.php', 'POST', fields));
        }
    } });
    try {
        harness.run('seed-export');
        const initial = readPrefs('vm');
        assert.equal(initial.metadata.prefsRecoveryRevision, 0);
        await coordinator.hydrateFromServer('vm');
        const stale = assert.rejects(coordinator.save('vm', { backupSchedule: { retention: 12 } }),
            error => error.status === 422);
        await started;
        const target = unwrap(call('environment_snapshot.php', 'GET', { action: 'export' })).snapshot;
        target.types.vm.prefs.backupSchedule.retention = 30;
        assert.equal(unwrap(call('environment_snapshot.php', 'POST', {
            action: 'apply', payload: JSON.stringify(target)
        })).import.verified, true);
        const recovered = readPrefs('vm');
        assert.equal(recovered.metadata.prefsRecoveryRevision, recovered.metadata.prefsRevision);
        assert.equal(recovered.prefs.backupSchedule.retention, 30);
        releaseWrite();
        await stale;
        assert.equal(requests, 1, 'the old operation never rebases across Recovery');
        assert.equal(coordinator.getConfirmedPrefs('vm').backupSchedule.retention, 30);
        assert.equal(coordinator.getSnapshot('vm').pending, false);

        const post = (fields, retention) => call('prefs.php', 'POST', {
            type: 'vm', prefs: JSON.stringify({ backupSchedule: { retention } }), ...fields
        });
        assert.equal(post({ expectedRevision: initial.metadata.prefsRevision }, 13)[0], 422, 'older clients get a terminal rejection');
        assert.equal(post({
            expectedRevision: recovered.metadata.prefsRevision, expectedRecoveryRevision: initial.metadata.prefsRecoveryRevision
        }, 14)[0], 422, 'a refreshed revision cannot mask a stale recovery baseline');
        await coordinator.save('vm', { backupSchedule: { retention: 22 } });
        assert.equal(readPrefs('vm').prefs.backupSchedule.retention, 22);
        assert.equal(post({ expectedRevision: recovered.metadata.prefsRevision }, 20)[0], 409, 'ordinary revision conflicts still permit a rebase');
    } finally {
        releaseWrite();
        harness.cleanup();
    }
});

test('failed environment transactions preserve backup and checkpoint history before verification', () => {
    const harness = setup();
    try {
        const result = harness.run('environment-retention');
        assert.match(result.error, /Injected late environment failure.*restored/);
        assert.equal(result.unchanged, true);
        assert.equal(result.oldTypesPreserved, true);
        assert.equal(result.oldGlobalsPreserved, true);
        assert.equal(result.afterSuccess, true);
    } finally { harness.cleanup(); }
});

for (const operation of ['rule-preview-retention', 'folder-transfer-retention', 'editor-bulk-retention']) {
    test(operation + ' preserves old recovery points until a successful folder write', () => {
        const harness = setup();
        try {
            const result = harness.run(operation);
            assert.match(result.failure.error, /Injected durable storage failure at 'rename'/);
            assert.equal(result.failure.configUnchanged, true);
            assert.equal(result.failure.previousRetained, true);
            assert.equal(result.failure.archives, operation === 'folder-transfer-retention' ? 2 : 1);
            if (operation === 'editor-bulk-retention') assert.equal(result.staleProtected, true);
            assert.equal(result.applied, true);
            assert.ok(result.backup.pruned.includes(result.oldName));
            assert.deepEqual(result.remaining, [result.backup.name]);
        } finally { harness.cleanup(); }
    });
}

test('failed environment transactions restore legacy adoption eligibility as well as active files', () => {
    const harness = setup();
    try {
        const result = harness.run('environment-legacy-markers');
        assert.match(result.error, /Injected legacy environment failure.*restored/);
        assert.equal(result.unchanged, true);
        assert.equal(result.noMarkers, true);
        assert.deepEqual(result.legacyFolders, ['legacy']);
        assert.equal(result.legacyPrefs, true);
    } finally { harness.cleanup(); }
});

for (const kind of ['folders', 'prefs', 'theme']) test(`${kind} read repair holds the mutation lock before deriving replacement state`, async () => {
    const harness = setup(); const children = [];
    const launch = operation => {
        const child = spawn('php', harness.args(operation), { env: harness.env }); children.push(child);
        let stdout = ''; let stderr = '';
        child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
        const done = new Promise((resolve, reject) => {
            child.on('error', reject);
            child.on('close', code => code === 0 ? resolve(JSON.parse(stdout)) : reject(new Error(stderr || stdout)));
        });
        done.catch(() => {}); return done;
    };
    const waitFor = async marker => {
        const deadline = Date.now() + 15000;
        while (!fs.existsSync(path.join(harness.root, marker))) {
            assert.ok(Date.now() < deadline, `timed out waiting for ${marker}`);
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    };
    try {
        harness.run('seed-read');
        const reader = launch(['reader', kind]); await waitFor('reader-paused');
        const writer = launch(['writer', kind]); await waitFor('writer-started');
        await new Promise(resolve => setTimeout(resolve, 100));
        assert.equal(fs.existsSync(path.join(harness.root, 'writer-finished')), false);
        fs.writeFileSync(path.join(harness.root, 'release-reader'), 'yes');
        await Promise.all([reader, writer]);
        assert.equal(harness.run('read-final', kind).current, true);
    } finally {
        for (const child of children) if (child.exitCode === null) child.kill();
        await Promise.all(children.filter(child => child.exitCode === null).map(child => new Promise(resolve => child.once('close', resolve))));
        harness.cleanup();
    }
});

test('same-second checkpoints retain unique bytes and deterministic latest/previous order after failed restore', () => {
    const harness = setup();
    try {
        const result = harness.run('checkpoint-collision');
        assert.equal(result.unique, true);
        assert.equal(result.latestCorrect, true);
        assert.equal(result.previousCorrect, true);
        assert.match(result.error, /Injected checkpoint collision failure/);
        assert.equal(result.targetBytesRetained, true);
        assert.equal(result.configRestored, true);
    } finally { harness.cleanup(); }
});
test('checkpoint pruning records only actual deletions and continues after a failed unlink', () => {
    const harness = setup();
    try {
        const result = harness.run('checkpoint-prune-fault');
        assert.equal(result.blockedRetained, true);
        assert.equal(result.removed.includes(result.blocked), false);
        assert.equal(result.removed.length, 1);
        assert.equal(result.remaining, 2);
    } finally { harness.cleanup(); }
});

test('source backup pruning reports only successful deletes and preserves the protected snapshot', () => {
    const harness = setup();
    try {
        const result = harness.run('backup-prune-fault');
        assert.deepEqual(result.removed, ['vm-stale.json']);
        assert.deepEqual(result.remaining, ['vm-new.json', 'vm-blocked.json', 'vm-safety.json']);
    } finally { harness.cleanup(); }
});

test('fresh per-type and global archives survive retention when existing timestamps are ahead', () => {
    const harness = setup();
    try {
        const result = harness.run('fresh-checkpoint-retention');
        assert.equal(result.backupRetained, true);
        assert.equal(result.globalRetained, true);
        assert.equal(result.priorTypePruned, true);
        assert.equal(result.globalCount, result.globalLimit);
    } finally { harness.cleanup(); }
});

for (const action of ['checkpoint', 'export', 'docker-order', 'history']) test(action + ' respects the configuration lock across competing requests', async () => {
    const harness = setup(); const children = [];
    const launch = operation => {
        const child = spawn('php', harness.args(operation), { env: harness.env }); children.push(child);
        let stdout = ''; let stderr = '';
        child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
        const done = new Promise((resolve, reject) => {
            child.on('error', reject);
            child.on('close', code => code === 0 ? resolve(JSON.parse(stdout)) : reject(new Error(stderr || stdout)));
        });
        done.catch(() => {}); return done;
    };
    const waitFor = async marker => {
        const deadline = Date.now() + 15000;
        while (!fs.existsSync(path.join(harness.root, marker))) {
            assert.ok(Date.now() < deadline, `timed out waiting for ${marker}`);
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    };
    try {
        harness.run('seed-export');
        const reader = launch([action === 'docker-order' ? 'checkpoint-reader' : action + '-reader']); await waitFor('reader-paused');
        const writer = launch([action === 'docker-order' ? 'setup-order-sync-writer' : action === 'history' ? 'history-writer' : 'checkpoint-writer']);
        await waitFor('writer-started');
        assert.equal(fs.readFileSync(path.join(harness.root, 'writer-started'), 'utf8'), 'blocked');
        await new Promise(resolve => setTimeout(resolve, 100));
        assert.equal(fs.existsSync(path.join(harness.root, 'writer-finished')), false);
        fs.writeFileSync(path.join(harness.root, 'release-reader'), 'yes');
        const [snapshot, writerResult] = await Promise.all([reader, writer]);
        assert.equal(fs.existsSync(path.join(harness.root, 'writer-finished')), true);
        if (action === 'docker-order') assert.equal(writerResult.syncOutcome, 'unmanaged');
        if (action === 'history') {
            assert.deepEqual(harness.run('history-current').map(event => event.id).sort(), [snapshot.id, writerResult.id].sort());
        }
        if (action === 'export') {
            const current = harness.run('export-current');
            for (const type of ['docker', 'vm']) {
                assert.deepEqual(Object.keys(snapshot.types[type].folders), ['initial']);
                assert.deepEqual(Object.keys(current.types[type].folders), ['writer']);
                assert.deepEqual(snapshot.types[type].prefs.manualOrder, ['initial']);
                assert.deepEqual(current.types[type].prefs.manualOrder, ['writer']);
            }
            assert.match(JSON.stringify(snapshot.themeWorkspace), /\.initial \{/);
            assert.match(JSON.stringify(current.themeWorkspace), /\.writer \{/);
        }
    } finally {
        for (const child of children) if (child.exitCode === null) child.kill();
        await Promise.all(children.filter(child => child.exitCode === null).map(child => new Promise(resolve => child.once('close', resolve))));
        harness.cleanup();
    }
});
