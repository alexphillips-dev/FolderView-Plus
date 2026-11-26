import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const root = 'src/folderview.plus/usr/local/emhttp/plugins/folderview.plus';
const source = fs.readFileSync(`${root}/scripts/folderviewplus.js`, 'utf8');
const workspaces = require(`../${root}/scripts/folderviewplus.settings-workspaces.js`);
const preferenceStore = require(`../${root}/scripts/folderviewplus.prefs-store.js`);
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
        $: () => ({ length: 0 }), utils: {}, prefsByType: {}, backupScheduleByType: {}, recoverySelectedBackupByType: {}, filtersByType: {},
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
        apiPostJson: async (_url, data) => { calls.push(data.action); return data.action === 'preview' ? { summary } : { import: { summary, verified: true } }; },
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

test('manual Global Rollback and portable import wait for both in-flight preference saves', async () => {
    const diagnostics = fs.readFileSync(`${root}/scripts/folderviewplus.activity-diagnostics.js`, 'utf8');
    const start = source.indexOf('const flushRecoveryPreferenceSaves =');
    assert.ok(start >= 0, 'the production preflight must be shared');
    const preflight = source.slice(start, source.indexOf('\n};', start) + 3);
    const rollback = diagnostics.slice(diagnostics.indexOf('const globalRollbackApi ='), diagnostics.indexOf('const restoreLatest ='));
    for (const operation of ['rollback', 'portable']) {
        const completed = [];
        const server = {
            docker: { backupSchedule: { retention: 30 }, _metadata: { prefsRevision: 1 } },
            vm: { backupSchedule: { retention: 30 }, _metadata: { prefsRevision: 1 } }
        };
        const deferred = Object.fromEntries(['docker', 'vm'].map(type => {
            let begin, release;
            const started = new Promise(resolve => { begin = resolve; });
            const wait = new Promise(resolve => { release = resolve; });
            return [type, { begin, release, started, wait }];
        }));
        const coordinator = preferenceStore.createPreferenceSaveCoordinator({
            window: {}, storage: null, debounceMs: 0, normalizePrefs: prefs => prefs,
            writePrefs: async (type, patch, { expectedRevision }) => {
                deferred[type].begin();
                await deferred[type].wait;
                assert.equal(expectedRevision, server[type]._metadata.prefsRevision);
                server[type] = { ...preferenceStore.mergePatch(server[type], patch), _metadata: { prefsRevision: expectedRevision + 1 } };
                completed.push(type);
                return server[type];
            }
        });
        const commits = Object.keys(server).map(type => {
            coordinator.reconcile(type, server[type]);
            return coordinator.save(type, { backupSchedule: { retention: 20 } });
        });
        await Promise.all(Object.values(deferred).map(gate => gate.started));
        const apply = async () => {
            completed.push('apply');
            for (const type of ['docker', 'vm']) {
                assert.equal(server[type].backupSchedule.retention, 20, `${operation} should wait for ${type}`);
                server[type] = { backupSchedule: { retention: 12 }, _metadata: { prefsRevision: 3 } };
            }
            return { ok: true, restore: { verified: true }, import: { verified: true, summary } };
        };
        const context = vm.createContext({
            diagnosticsPrefsCoordinator: coordinator, flushDockerStartOrderSaveQueue: () => coordinator.flush('docker'),
            assertRuntimeConflictActionAllowed: noop, apiPostJson: apply
        });
        let restoring;
        if (operation === 'rollback') {
            const api = vm.runInContext(`${preflight}\n${rollback}\nglobalRollbackApi;`, context);
            restoring = api('rollback_restore_previous', { expectedName: 'fixture', reviewHash: 'a'.repeat(64) });
        } else {
            let confirm;
            const flushRecoveryPreferenceSaves = vm.runInContext(`${preflight}\nflushRecoveryPreferenceSaves;`, context);
            const api = productionFactory({
                selectJsonFile: async () => ({ name: 'fixture.json', text: JSON.stringify(snapshot) }),
                swal: (_options, callback) => { if (callback) confirm = callback; },
                apiPostJson: async (_url, { action }) => action === 'preview' ? { summary } : apply(),
                flushRecoveryPreferenceSaves
            });
            await api.importEnvironmentSnapshot();
            restoring = confirm(true);
        }
        assert.deepEqual(completed, []);
        deferred.vm.release();
        await commits[1];
        assert.deepEqual(completed, ['vm']);
        deferred.docker.release();
        await Promise.all([restoring, ...commits]);
        assert.deepEqual(completed, ['vm', 'docker', 'apply']);
        assert.deepEqual(Object.values(server).map(prefs => prefs.backupSchedule.retention), [12, 12]);
    }
});

test('reopening Settings hydrates and drains durable preferences before a reviewed rollback', async () => {
    const values = new Map();
    const storage = {
        get length() { return values.size; },
        key: index => [...values.keys()][index],
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key)
    };
    const server = Object.fromEntries(['docker', 'vm'].map(type => [type, { backupSchedule: { retention: 30 }, _metadata: { prefsRevision: 1 } }]));
    const leaving = preferenceStore.createPreferenceSaveCoordinator({
        window: {}, storage, sourceId: 'recovery-origin', normalizePrefs: prefs => prefs,
        setTimeout: () => 1, clearTimeout: noop
    });
    for (const type of Object.keys(server)) {
        leaving.reconcile(type, server[type]);
        void leaving.save(type, { backupSchedule: { retention: 20 } });
    }
    const events = [];
    const reopened = preferenceStore.createPreferenceSaveCoordinator({
        window: {}, storage, sourceId: 'recovery-reopened', normalizePrefs: prefs => prefs,
        fetchPrefs: async type => { events.push(`read:${type}`); return server[type]; },
        writePrefs: async (type, patch, { expectedRevision }) => {
            events.push(`write:${type}`);
            assert.equal(expectedRevision, server[type]._metadata.prefsRevision);
            server[type] = { ...preferenceStore.mergePatch(server[type], patch), _metadata: { prefsRevision: expectedRevision + 1 } };
            return server[type];
        }
    });
    const start = source.indexOf('const flushRecoveryPreferenceSaves =');
    const preflight = source.slice(start, source.indexOf('\n};', start) + 3);
    const run = vm.runInNewContext(`${preflight}\nflushRecoveryPreferenceSaves;`, {
        diagnosticsPrefsCoordinator: reopened, flushDockerStartOrderSaveQueue: () => reopened.flush('docker')
    });
    assert.equal(reopened.getSnapshot('docker').hydrated, false);
    assert.equal(reopened.getSnapshot('vm').hydrated, false);
    await run();
    assert.deepEqual(events.slice(0, 2).sort(), ['read:docker', 'read:vm']);
    assert.deepEqual(events.slice(2).sort(), ['write:docker', 'write:vm']);
    for (const type of Object.keys(server)) {
        assert.equal(reopened.getSnapshot(type).pending, false);
        assert.equal(server[type].backupSchedule.retention, 20);
    }
});

test('out-of-order backup loads cannot replace a newer result and failures preserve known backups', async () => {
    const pending = [];
    const backups = { docker: [{ name: 'initial' }], vm: [] };
    const schedules = { docker: {}, vm: {} };
    const context = vm.createContext({ normalizeManagedType: value => value, backupsByType: backups, backupScheduleByType: schedules,
        fetchBackups: () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
        setAdvancedModuleStatus: noop, markAdvancedModuleLoadSuccess: noop, markAdvancedModuleLoadError: noop,
        renderBackupRows: noop, renderBackupScheduleControls: noop, refreshSettingsUx: noop });
    const block = source.slice(source.indexOf('const backupRefreshSequence ='), source.indexOf('const refreshTemplates ='));
    const refresh = vm.runInContext(`${block}\nrefreshBackups;`, context);
    const old = refresh('docker', { quiet: true }), current = refresh('docker', { quiet: true });
    pending[1].resolve({ backups: [{ name: 'newest' }], schedule: { lastRunAt: 'newest' } }); await current;
    pending[0].resolve({ backups: [{ name: 'obsolete' }], schedule: { lastRunAt: 'obsolete' } }); await old;
    assert.equal(backups.docker[0].name, 'newest');
    assert.equal(schedules.docker.lastRunAt, 'newest');
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

test('saved numeric log timestamps include their calendar date across locales and time zones', () => {
    const diagnostics = fs.readFileSync(`${root}/scripts/folderviewplus.activity-diagnostics.js`, 'utf8');
    const block = diagnostics.slice(diagnostics.indexOf('const formatActivityTimestamp ='), diagnostics.indexOf('const normalizeActivityLevel ='));
    const at = Date.UTC(2026, 0, 2, 1, 4);
    for (const locale of ['en-US', 'de-DE', 'ar']) for (const timeZone of ['UTC', 'America/New_York', 'Asia/Tokyo']) {
        const format = vm.runInNewContext(`${block}\nformatActivityTimestamp;`, {
            FolderViewPlusI18n: { formatDate: (date, options) => new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(date) }
        });
        const displayed = format(at);
        const parts = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric', timeZone }).formatToParts(at);
        assert.ok(parts.filter(part => part.type !== 'literal').every(part => displayed.includes(part.value)), `${locale}/${timeZone}: ${displayed}`);
        assert.equal(format(String(at)), displayed);
        assert.equal(format(new Date(at).toISOString()), displayed);
        assert.notEqual(format(at + 86400000), displayed, 'events at the same time on different dates must be distinguishable');
    }
    const fallback = vm.runInNewContext(`${block}\nformatActivityTimestamp;`);
    assert.match(fallback(at), /2026/);
});

test('Recovery keeps the server ordering for snapshots created within the same displayed second', () => {
    const start = source.indexOf('const getSortedBackupsForType =');
    const end = source.indexOf('const buildRecoveryOverviewHtml =', start);
    const load = new Function('backupsByType', 'normalizeRecoveryWorkspaceType', `
        ${source.slice(start, end)}
        return getSortedBackupsForType;
    `);
    const backups = [
        { name: 'docker-20261124-010000-a.json', reason: 'newer', count: 2, createdAt: '2026-11-24T01:00:00+00:00' },
        { name: 'docker-20261124-010000-z.json', reason: 'older', count: 1, createdAt: '2026-11-24T01:00:00+00:00' }
    ];
    const getSortedBackupsForType = load({ docker: backups }, type => type);
    const api = workspaces.createApi({ $: () => ({ text: noop }), getSortedBackupsForType, escapeHtml: String });
    const history = api.buildRecoveryBackupHistoryHtml('docker');
    assert.match(history, /docker-20261124-010000-a\.json[\s\S]*Latest[\s\S]*docker-20261124-010000-z\.json/);
    assert.deepEqual(getSortedBackupsForType('docker').map(backup => backup.name), backups.map(backup => backup.name));
    assert.deepEqual(getSortedBackupsForType('vm'), []);
});

test('Recovery history keeps selected actions on the active row and expands all snapshots', () => {
    const backups = Array.from({ length: 7 }, (_, index) => ({ name: `snapshot-${index}.json`, count: index === 0 ? 0 : 2,
        createdAt: `2026-09-2${9 - index}T12:00:00Z`, reason: 'manual', reviewHash: String(index).repeat(64) }));
    const selected = { docker: '', vm: '' };
    let currentType = 'docker';
    const summaryHost = { text: () => summaryHost };
    const api = workspaces.createApi({ $: selector => selector === '#fv-recovery-history-summary' ? summaryHost : { length: 0 },
        escapeHtml: value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;'),
        getSortedBackupsForType: type => type === 'docker' ? backups : [],
        recoverySelectedBackupByType: selected, getActiveRecoveryWorkspaceTypeValue: () => currentType,
        formatTimestamp: value => value });
    const recent = api.buildRecoveryBackupHistoryHtml('docker');
    assert.equal((recent.match(/fv-recovery-snapshot-row/g) || []).length, 5);
    assert.match(recent, /snapshot-0\.json[\s\S]*Empty/);
    assert.match(recent, /restoreSelectedActiveRecoveryBackup\('0{64}'\)/);
    assert.match(recent, /toggleAllRecoverySnapshots\(\)/);
    assert.equal(selected.docker, 'snapshot-0.json');
    currentType = 'vm';
    assert.match(api.buildRecoveryBackupHistoryHtml('vm'), /No VM backups yet/);
    assert.equal(selected.vm, '');
});

test('Recovery distinguishes unreadable snapshots from empty ones and previews the newest valid fallback', () => {
    const item = (name, count, createdAt) => ({ name, count, createdAt, reason: 'manual' });
    const invalid = item('broken.json', null, '2026-11-24T02:00:00Z');
    const empty = item('empty.json', 0, '2026-11-24T01:00:00Z');
    const good = item('good.json', 2, '2026-11-24T00:00:00Z');
    let backups = [invalid];
    const api = workspaces.createApi({ $: () => ({ text: noop }), getSortedBackupsForType: () => backups,
        formatTimestamp: String, escapeHtml: String });
    const brokenHistory = api.buildRecoveryBackupHistoryHtml('vm');
    assert.match(brokenHistory, /Folder count unavailable/);
    assert.doesNotMatch(brokenHistory, /Folders: 0|>Empty</);
    assert.doesNotMatch(api.buildRecoveryOverviewHtml('vm'), /Only empty snapshots|Restore Latest will use/);
    backups = [invalid, empty, good];
    assert.match(api.buildRecoveryOverviewHtml('vm'), /Restore Latest will use 2026-11-24T00:00:00Z/);
    assert.match(api.buildRecoveryBackupHistoryHtml('vm'), /Folders: 0/);
    backups = [empty];
    assert.match(api.buildRecoveryOverviewHtml('vm'), /Only empty snapshots/);
});
