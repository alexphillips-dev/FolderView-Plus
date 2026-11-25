import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus';
const settings = fs.readFileSync(`${root}/scripts/folderviewplus.js`, 'utf8');
const diagnostics = fs.readFileSync(`${root}/scripts/folderviewplus.activity-diagnostics.js`, 'utf8');
const extract = (source, name, ending = '\n};') => {
    const start = source.indexOf(`const ${name} =`);
    assert.ok(start >= 0, name);
    const end = source.indexOf(ending, start);
    assert.ok(end > start, name);
    return source.slice(start, end + ending.length);
};

for (const type of ['docker', 'vm']) {
    for (const latest of [false, true]) {
        for (const failure of [false, true]) {
            test(`${type} ${latest ? 'latest' : 'selected'} restore ${failure ? 'failure' : 'success'} uses one guarded server transaction`, async () => {
                const calls = [], errors = [];
                let confirmation;
                const backup = { name: `${type}-safety.json` };
                let latestName = `${type}-selected.json`;
                let latestHash = 'a'.repeat(64);
                const createdAt = '2026-11-24T12:00:00Z';
                const context = vm.createContext({
                    surfaceT: (_key, fallback) => fallback,
                    normalizeManagedType: value => value,
                    assertRuntimeConflictActionAllowed() {}, ensureRuntimeConflictActionAllowed: () => true,
                    fetchBackups: async () => ({ backups: [{ name: latestName, reviewHash: latestHash, createdAt, count: 1 }] }),
                    formatTimestamp: value => value,
                    swal: (options, handler) => {
                        if (latest) assert.ok(options.text.includes(createdAt), 'latest confirmation should display the reviewed timestamp');
                        confirmation = handler;
                    },
                    withAdvancedOperationLock: async (_type, _area, _label, action) => action(),
                    createBackup: async () => { throw new Error('Safety backup must be owned by the server transaction'); },
                    diagnosticsPrefsCoordinator: { flush: async value => calls.push(`flush:${value}`) },
                    apiPostJson: async (url, payload) => {
                        calls.push({ url, ...payload });
                        if (failure) throw new Error('Synthetic restore failure');
                        return { ok: true, restore: { name: `${type}-selected.json`, backup, templatesRestored: !latest } };
                    },
                    refreshType: async value => calls.push(`refresh:${value}`),
                    refreshBackups: async value => calls.push(`backups:${value}`),
                    refreshTemplates: async value => calls.push(`templates:${value}`),
                    offerUndoAction: async (value, returned) => calls.push(`undo:${value}:${returned.name}`),
                    showError: (_title, error) => errors.push(error.message),
                    openImportApplyProgressDialog: () => calls.push('progress-open'),
                    closeImportApplyProgressDialog: () => calls.push('progress-close'),
                    updateImportApplyProgressDialog() {}, setTimeout: handler => handler()
                });
                const code = [extract(settings, 'refreshRestoredConfiguration', '\n]);'),
                    extract(settings, 'restoreBackupByName'), extract(diagnostics, 'restoreLatest'),
                    extract(settings, latest ? 'restoreLatestBackup' : 'restoreBackupEntry')].join('\n');
                await vm.runInContext(`${code}\n${latest ? 'restoreLatestBackup' : 'restoreBackupEntry'}('${type}', '${type}-selected.json');`, context);
                assert.equal(calls.length, 0, 'confirmation must precede all mutations');
                await confirmation(false);
                assert.equal(calls.length, 0, 'cancel must not mutate');
                latestName = `${type}-newer.json`;
                latestHash = 'b'.repeat(64);
                await confirmation(true);
                const requests = calls.filter(value => typeof value === 'object');
                assert.ok(calls.indexOf(`flush:${type}`) < calls.findIndex(value => typeof value === 'object'));
                assert.equal(requests.length, 1);
                assert.equal(requests[0].type, type);
                assert.equal(requests[0].action, latest ? 'restore_latest' : 'restore');
                if (latest) {
                    assert.equal(requests[0].expectedName, `${type}-selected.json`);
                    assert.equal(requests[0].reviewHash, 'a'.repeat(64));
                } else {
                    assert.equal(requests[0].name, `${type}-selected.json`);
                    assert.equal(requests[0].createSafetyBackup, true);
                }
                assert.equal(calls.includes(`undo:${type}:${backup.name}`), !failure);
                assert.equal(calls.includes(`refresh:${type}`), !failure);
                assert.equal(calls.includes(`templates:${type}`), !failure && !latest);
                assert.deepEqual(errors, failure ? ['Synthetic restore failure'] : []);
                if (latest) assert.equal(calls.at(-1) === 'progress-close' || calls.includes('progress-close'), true);
            });
        }
    }
}

test('backup endpoint forwards only the safety flag and keeps restore hooks server-owned', () => {
    const source = fs.readFileSync(`${root}/server/backup.php`, 'utf8');
    assert.match(source, /'createSafetyBackup' => normalizeBool\(\$_POST\['createSafetyBackup'\] \?\? false\)/);
    assert.doesNotMatch(source, /\$_POST\['(?:afterStage|prune)'\]/);
});

test('pending preference save failure prevents all restore request variants', async () => {
    for (const name of ['restoreBackupByName', 'restoreLatest', 'restoreLatestUndo']) {
        let requests = 0;
        const context = vm.createContext({
            normalizeManagedType: value => value, assertRuntimeConflictActionAllowed() {},
            diagnosticsPrefsCoordinator: { flush: async () => { throw new Error('Pending save failed'); } },
            apiPostJson: async () => { requests++; }
        });
        const source = name === 'restoreBackupByName' ? settings : diagnostics;
        const run = vm.runInContext(`${extract(source, name)}\n() => ${name}('docker', 'docker-selected.json');`, context);
        await assert.rejects(run(), /Pending save failed/);
        assert.equal(requests, 0, name);
    }
});
