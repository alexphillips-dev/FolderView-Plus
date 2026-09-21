import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const root = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus';
const source = fs.readFileSync(`${root}/scripts/folderviewplus.js`, 'utf8');
const workspaces = require(`../${root}/scripts/folderviewplus.settings-workspaces.js`);
const noop = () => {};
const summary = { exportedAt: '2026-09-18T05:18:26Z', pluginVersion: 'fixture', docker: { folderCount: 1 }, vm: { folderCount: 1 } };
const snapshot = { kind: 'environment_snapshot', schemaVersion: 1, pluginVersion: 'fixture', exportedAt: summary.exportedAt,
    types: { docker: { folders: { one: { name: 'Docker fixture' } }, prefs: {} }, vm: { folders: { two: { name: 'VM fixture' } }, prefs: {} } }, themeWorkspace: {} };

test('Settings status labels translate the running state through the registered wrapper', () => {
    const block = source.slice(source.indexOf('const statusLabelForKey ='), source.indexOf('\n};', source.indexOf('const statusLabelForKey =')) + 3);
    const context = vm.createContext({ surfaceT: (key, fallback) => key === 'started' ? 'Läuft' : fallback });
    assert.equal(vm.runInContext(`${block}\nstatusLabelForKey('started');`, context), 'Läuft');
});

const productionFactory = (overrides = {}) => {
    const block = source.slice(source.indexOf('const getSettingsWorkspacesApi ='), source.indexOf('const getBulkAssignmentApi ='));
    // Exercise the actual composition root: missing production dependencies must not
    // be concealed by constructing the workspace with a different test-only wiring.
    const stubs = Object.fromEntries([...block.matchAll(/^            (\w+),?$/gm)].map(([, key]) => [key, noop]));
    const context = vm.createContext({ ...stubs, window: { setTimeout: fn => fn() }, document: {},
        $: () => ({ length: 0 }), utils: {}, prefsByType: {}, recoverySelectedBackupByType: {}, filtersByType: {},
        templatesByType: {}, selectedOperationsTemplateIdByType: {}, settingsWorkspacesModule: workspaces,
        getFolderMap: () => ({}), folderNameForId: noop, getSortedBackupsForType: () => [],
        activeRecoveryWorkspaceType: 'docker', activeRulesWorkspaceType: 'docker', activeOperationsWorkspaceType: 'docker',
        claimAdvancedOperationLock: () => true, ensureRuntimeConflictActionAllowed: () => true,
        toPrettyJson: value => JSON.stringify(value), ...overrides });
    return vm.runInContext(`${block}\ngetSettingsWorkspacesApi();`, context);
};

test('production environment export fetches and downloads the actual complete snapshot', async () => {
    const requests = [], downloads = [], notices = [];
    const api = productionFactory({ apiGetJson: async (...args) => { requests.push(args); return { snapshot, summary }; },
        downloadFile: (...args) => downloads.push(args), showToastMessage: value => notices.push(value) });
    await api.exportEnvironmentSnapshot();
    assert.equal(requests.length, 1);
    assert.equal(requests[0][0], '/plugins/folderview.plus/server/environment_snapshot.php');
    assert.equal(requests[0][1].data.action, 'export');
    assert.deepEqual(JSON.parse(downloads[0][1]), snapshot);
    assert.equal(notices.length, 1);
    assert.match(notices[0].message, /browser downloads/);
});

test('environment export fails closed for absent clients and incomplete responses', async () => {
    for (const response of [undefined, {}, { snapshot: {}, summary }, { snapshot: { ...snapshot, types: { docker: {}, vm: {} } }, summary }]) {
        const downloads = [], errors = [];
        const api = workspaces.createApi({ apiGetJson: async () => response,
            downloadFile: (...args) => downloads.push(args), showError: (...args) => errors.push(args) });
        await assert.rejects(api.exportEnvironmentSnapshot());
        assert.equal(downloads.length, 0);
        assert.equal(errors.length, 1);
    }
    await assert.rejects(workspaces.createApi().exportEnvironmentSnapshot(), /request client is unavailable/);
});

test('production environment import previews, confirms, locks, applies and refreshes both types and appearance', async () => {
    const calls = [];
    let confirm;
    const api = productionFactory({
        selectJsonFile: async () => ({ name: 'fixture.json', text: JSON.stringify(snapshot) }),
        apiPostJson: async (_url, data) => { calls.push(data.action); return data.action === 'preview' ? { summary } : { import: { summary } }; },
        swal: (_options, callback) => { if (callback) confirm = callback; },
        claimAdvancedOperationLock: (type, scope) => { calls.push(`lock:${type}:${scope}`); return true; },
        releaseAdvancedOperationLock: (type, scope) => calls.push(`unlock:${type}:${scope}`),
        refreshType: async type => calls.push(`refresh:${type}`), refreshBackups: async type => calls.push(`backups:${type}`),
        getThemeWorkspaceApi: () => ({ readWorkspace: async () => calls.push('appearance') }),
        openImportApplyProgressDialog: () => calls.push('progress:open'), closeImportApplyProgressDialog: () => calls.push('progress:close'),
        updateImportApplyProgressDialog: noop
    });
    await api.importEnvironmentSnapshot();
    assert.deepEqual(calls, ['preview'], 'preview must not mutate before confirmation');
    assert.equal(typeof confirm, 'function');
    await confirm(true);
    for (const entry of ['apply', 'refresh:docker', 'refresh:vm', 'backups:docker', 'backups:vm', 'appearance', 'progress:open', 'progress:close']) assert.ok(calls.includes(entry), entry);
    assert.equal(calls.filter(value => value.startsWith('lock:')).length, calls.filter(value => value.startsWith('unlock:')).length);
});

test('out-of-order backup loads cannot replace a newer result and failures preserve known backups', async () => {
    const pending = [];
    const backups = { docker: [{ name: 'initial' }], vm: [] };
    const context = vm.createContext({ normalizeManagedType: value => value, backupsByType: backups,
        fetchBackups: () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
        setAdvancedModuleStatus: noop, markAdvancedModuleLoadSuccess: noop, markAdvancedModuleLoadError: noop,
        renderBackupRows: noop, renderBackupScheduleControls: noop, refreshSettingsUx: noop });
    const block = source.slice(source.indexOf('const backupRefreshSequence ='), source.indexOf('const refreshTemplates ='));
    const refresh = vm.runInContext(`${block}\nrefreshBackups;`, context);
    const old = refresh('docker', { quiet: true }), current = refresh('docker', { quiet: true });
    pending[1].resolve([{ name: 'newest' }]); await current;
    pending[0].resolve([{ name: 'obsolete' }]); await old;
    assert.equal(backups.docker[0].name, 'newest');
    const failed = refresh('docker', { quiet: true }); pending[2].reject(new Error('offline')); await failed;
    assert.equal(backups.docker[0].name, 'newest');
});

test('history formats persisted ISO timestamps without replacing them with the current time', () => {
    const diagnostics = fs.readFileSync(`${root}/scripts/folderviewplus.activity-diagnostics.js`, 'utf8');
    const block = diagnostics.slice(diagnostics.indexOf('const formatActivityTimestamp ='), diagnostics.indexOf('const normalizeActivityLevel ='));
    const format = vm.runInNewContext(`${block}\nformatActivityTimestamp;`, {
        FolderViewPlusI18n: { formatDate: date => date.toISOString() }
    });
    assert.equal(format('2026-09-18T05:18:26Z'), '2026-09-18T05:18:26.000Z');
    assert.equal(format(0), '1970-01-01T00:00:00.000Z');
    for (const value of ['', undefined, null, 'invalid']) assert.equal(format(value), '');
});
